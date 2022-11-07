/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { version, revision } from '../core/core.js';
import { platform } from '../core/platform.js';
import { now } from '../core/time.js';
import { path } from '../core/path.js';
import { EventHandler } from '../core/event-handler.js';
import { Debug } from '../core/debug.js';
import { TRACEID_RENDER_FRAME } from '../core/constants.js';
import { math } from '../core/math/math.js';
import { Color } from '../core/math/color.js';
import { Vec3 } from '../core/math/vec3.js';
import { Mat4 } from '../core/math/mat4.js';
import { Quat } from '../core/math/quat.js';
import { http } from '../platform/net/http.js';
import { PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN } from '../platform/graphics/constants.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { setProgramLibrary } from '../scene/shader-lib/get-program-library.js';
import { ProgramLibrary } from '../scene/shader-lib/program-library.js';
import { LAYERID_WORLD, LAYERID_SKYBOX, SORTMODE_NONE, LAYERID_UI, SORTMODE_MANUAL, LAYERID_IMMEDIATE, LAYERID_DEPTH, SPECULAR_BLINN } from '../scene/constants.js';
import { ForwardRenderer } from '../scene/renderer/forward-renderer.js';
import { FrameGraph } from '../scene/frame-graph.js';
import { AreaLightLuts } from '../scene/area-light-luts.js';
import { Layer } from '../scene/layer.js';
import { LayerComposition } from '../scene/composition/layer-composition.js';
import { Scene } from '../scene/scene.js';
import { Material } from '../scene/materials/material.js';
import { LightsBuffer } from '../scene/lighting/lights-buffer.js';
import { StandardMaterial } from '../scene/materials/standard-material.js';
import { setDefaultMaterial } from '../scene/materials/default-material.js';
import { BundleHandler } from './handlers/bundle.js';
import { ResourceLoader } from './handlers/loader.js';
import { Asset } from './asset/asset.js';
import { AssetRegistry } from './asset/asset-registry.js';
import { BundleRegistry } from './bundle/bundle-registry.js';
import { ScriptRegistry } from './script/script-registry.js';
import { I18n } from './i18n/i18n.js';
import { ComponentSystemRegistry } from './components/registry.js';
import { script } from './script.js';
import { ApplicationStats } from './stats.js';
import { Entity } from './entity.js';
import { SceneRegistry } from './scene-registry.js';
import { SceneGrab } from './graphics/scene-grab.js';
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
    if ((version.indexOf('$')) < 0) {
      Debug.log(`Powered by PlayCanvas ${version} ${revision}`);
    }

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
    Debug.assert(device, "The application cannot be created without a valid GraphicsDevice");

    this.graphicsDevice = device;
    GraphicsDeviceAccess.set(device);
    this._initDefaultMaterial();
    this._initProgramLibrary();
    this.stats = new ApplicationStats(device);

    this._soundManager = appOptions.soundManager;

    this.loader = new ResourceLoader(this);
    LightsBuffer.init(device);

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
    const self = this;
    this.defaultLayerWorld = new Layer({
      name: "World",
      id: LAYERID_WORLD
    });
    this.sceneGrab = new SceneGrab(this);
    this.defaultLayerDepth = this.sceneGrab.layer;
    this.defaultLayerSkybox = new Layer({
      enabled: true,
      name: "Skybox",
      id: LAYERID_SKYBOX,
      opaqueSortMode: SORTMODE_NONE
    });
    this.defaultLayerUi = new Layer({
      enabled: true,
      name: "UI",
      id: LAYERID_UI,
      transparentSortMode: SORTMODE_MANUAL,
      passThrough: false
    });
    this.defaultLayerImmediate = new Layer({
      enabled: true,
      name: "Immediate",
      id: LAYERID_IMMEDIATE,
      opaqueSortMode: SORTMODE_NONE,
      passThrough: true
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

    this.scene.on('set:layers', function (oldComp, newComp) {
      const list = newComp.layerList;
      let layer;
      for (let i = 0; i < list.length; i++) {
        layer = list[i];
        switch (layer.id) {
          case LAYERID_DEPTH:
            self.sceneGrab.patch(layer);
            break;
          case LAYERID_UI:
            layer.passThrough = self.defaultLayerUi.passThrough;
            break;
          case LAYERID_IMMEDIATE:
            layer.passThrough = self.defaultLayerImmediate.passThrough;
            break;
        }
      }
    });

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
    Debug.assert(this._batcher, "BatchManager has not been created and is required for correct functionality.");
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
    this.frameGraph.render();
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
    } else {
      Debug.warn("setAreaLightLuts: LUTs for area light are not valid");
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
    (_this$lightmapper = this.lightmapper) == null ? void 0 : _this$lightmapper.bake(null, this.scene.lightmapMode);
  }

  _firstBatch() {
    var _this$batcher;
    (_this$batcher = this.batcher) == null ? void 0 : _this$batcher.generate();
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

  drawWireAlignedBox(minPoint, maxPoint, color = Color.WHITE, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawWireAlignedBox(minPoint, maxPoint, color, depthTest, layer);
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

  drawTexture(x, y, width, height, texture, material, layer = this.scene.defaultDrawLayer) {
    const matrix = new Mat4();
    matrix.setTRS(new Vec3(x, y, 0.0), Quat.IDENTITY, new Vec3(width, height, 0.0));
    if (!material) {
      material = new Material();
      material.setParameter("colorMap", texture);
      material.shader = this.scene.immediate.getTextureShader();
      material.update();
    }
    this.drawQuad(matrix, material, layer);
  }

  drawDepthTexture(x, y, width, height, layer = this.scene.defaultDrawLayer) {
    const material = new Material();
    material.shader = this.scene.immediate.getDepthTextureShader();
    material.update();
    this.drawTexture(x, y, width, height, null, material, layer);
  }

  destroy() {
    var _this$lightmapper2;
    if (this._inFrameUpdate) {
      this._destroyRequested = true;
      return;
    }
    const canvasId = this.graphicsDevice.canvas.id;
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
    for (const key in this.loader.getHandler('script')._cache) {
      const element = this.loader.getHandler('script')._cache[key];
      const parent = element.parentNode;
      if (parent) parent.removeChild(element);
    }
    this.loader.getHandler('script')._cache = {};
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
    (_this$lightmapper2 = this.lightmapper) == null ? void 0 : _this$lightmapper2.destroy();
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
    this == null ? void 0 : this.xr.end();
    this == null ? void 0 : this.xr.destroy();
    this.renderer.destroy();
    this.renderer = null;
    this.graphicsDevice.destroy();
    this.graphicsDevice = null;
    this.tick = null;
    this.off();

    if (this._soundManager) {
      this._soundManager.destroy();
      this._soundManager = null;
    }
    script.app = null;
    AppBase._applications[canvasId] = null;
    if (getApplication() === this) {
      setApplication(null);
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
  let frameRequest;
  return function (timestamp, frame) {
    var _application$xr;
    if (!application.graphicsDevice) return;
    setApplication(application);
    if (frameRequest) {
      window.cancelAnimationFrame(frameRequest);
      frameRequest = null;
    }

    app = application;
    const currentTime = application._processTimestamp(timestamp) || now();
    const ms = currentTime - (application._time || currentTime);
    let dt = ms / 1000.0;
    dt = math.clamp(dt, 0, application.maxDeltaTime);
    dt *= application.timeScale;
    application._time = currentTime;

    if ((_application$xr = application.xr) != null && _application$xr.session) {
      frameRequest = application.xr.session.requestAnimationFrame(application.tick);
    } else {
      frameRequest = platform.browser ? window.requestAnimationFrame(application.tick) : null;
    }
    if (application.graphicsDevice.contextLost) return;
    application._fillFrameStatsBasic(currentTime, dt, ms);
    application._fillFrameStats();
    application._inFrameUpdate = true;
    application.fire("frameupdate", ms);
    let shouldRenderFrame = true;
    if (frame) {
      var _application$xr2;
      shouldRenderFrame = (_application$xr2 = application.xr) == null ? void 0 : _application$xr2.update(frame);
      application.graphicsDevice.defaultFramebuffer = frame.session.renderState.baseLayer.framebuffer;
    } else {
      application.graphicsDevice.defaultFramebuffer = null;
    }
    if (shouldRenderFrame) {
      application.update(dt);
      application.fire("framerender");
      Debug.trace(TRACEID_RENDER_FRAME, `--- Frame ${application.frame}`);
      if (application.autoRender || application.renderNextFrame) {
        application.updateCanvasSize();
        application.render();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLWJhc2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLWJhc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gI2lmIF9ERUJVR1xuaW1wb3J0IHsgdmVyc2lvbiwgcmV2aXNpb24gfSBmcm9tICcuLi9jb3JlL2NvcmUuanMnO1xuLy8gI2VuZGlmXG5cbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfUkVOREVSX0ZSQU1FIH0gZnJvbSAnLi4vY29yZS9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuXG5pbXBvcnQgeyBodHRwIH0gZnJvbSAnLi4vcGxhdGZvcm0vbmV0L2h0dHAuanMnO1xuXG5pbXBvcnQge1xuICAgIFBSSU1JVElWRV9UUklBTkdMRVMsIFBSSU1JVElWRV9UUklGQU4sIFBSSU1JVElWRV9UUklTVFJJUFxufSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgR3JhcGhpY3NEZXZpY2VBY2Nlc3MgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UtYWNjZXNzLmpzJztcbmltcG9ydCB7IHNldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMnO1xuXG5pbXBvcnQge1xuICAgIExBWUVSSURfREVQVEgsIExBWUVSSURfSU1NRURJQVRFLCBMQVlFUklEX1NLWUJPWCwgTEFZRVJJRF9VSSwgTEFZRVJJRF9XT1JMRCxcbiAgICBTT1JUTU9ERV9OT05FLCBTT1JUTU9ERV9NQU5VQUwsIFNQRUNVTEFSX0JMSU5OXG59IGZyb20gJy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBGb3J3YXJkUmVuZGVyZXIgfSBmcm9tICcuLi9zY2VuZS9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEZyYW1lR3JhcGggfSBmcm9tICcuLi9zY2VuZS9mcmFtZS1ncmFwaC5qcyc7XG5pbXBvcnQgeyBBcmVhTGlnaHRMdXRzIH0gZnJvbSAnLi4vc2NlbmUvYXJlYS1saWdodC1sdXRzLmpzJztcbmltcG9ydCB7IExheWVyIH0gZnJvbSAnLi4vc2NlbmUvbGF5ZXIuanMnO1xuaW1wb3J0IHsgTGF5ZXJDb21wb3NpdGlvbiB9IGZyb20gJy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJztcbmltcG9ydCB7IFNjZW5lIH0gZnJvbSAnLi4vc2NlbmUvc2NlbmUuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTGlnaHRzQnVmZmVyIH0gZnJvbSAnLi4vc2NlbmUvbGlnaHRpbmcvbGlnaHRzLWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLmpzJztcbmltcG9ydCB7IHNldERlZmF1bHRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9kZWZhdWx0LW1hdGVyaWFsLmpzJztcblxuaW1wb3J0IHsgQnVuZGxlSGFuZGxlciB9IGZyb20gJy4uL2ZyYW1ld29yay9oYW5kbGVycy9idW5kbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VMb2FkZXIgfSBmcm9tICcuLi9mcmFtZXdvcmsvaGFuZGxlcnMvbG9hZGVyLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuL2Fzc2V0L2Fzc2V0LmpzJztcbmltcG9ydCB7IEFzc2V0UmVnaXN0cnkgfSBmcm9tICcuL2Fzc2V0L2Fzc2V0LXJlZ2lzdHJ5LmpzJztcblxuaW1wb3J0IHsgQnVuZGxlUmVnaXN0cnkgfSBmcm9tICcuL2J1bmRsZS9idW5kbGUtcmVnaXN0cnkuanMnO1xuXG5pbXBvcnQgeyBTY3JpcHRSZWdpc3RyeSB9IGZyb20gJy4vc2NyaXB0L3NjcmlwdC1yZWdpc3RyeS5qcyc7XG5cbmltcG9ydCB7IEkxOG4gfSBmcm9tICcuLi9mcmFtZXdvcmsvaTE4bi9pMThuLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50U3lzdGVtUmVnaXN0cnkgfSBmcm9tICcuL2NvbXBvbmVudHMvcmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgc2NyaXB0IH0gZnJvbSAnLi9zY3JpcHQuanMnO1xuaW1wb3J0IHsgQXBwbGljYXRpb25TdGF0cyB9IGZyb20gJy4vc3RhdHMuanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi9lbnRpdHkuanMnO1xuaW1wb3J0IHsgU2NlbmVSZWdpc3RyeSB9IGZyb20gJy4vc2NlbmUtcmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgU2NlbmVHcmFiIH0gZnJvbSAnLi9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcblxuaW1wb3J0IHtcbiAgICBGSUxMTU9ERV9GSUxMX1dJTkRPVywgRklMTE1PREVfS0VFUF9BU1BFQ1QsXG4gICAgUkVTT0xVVElPTl9BVVRPLCBSRVNPTFVUSU9OX0ZJWEVEXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHtcbiAgICBnZXRBcHBsaWNhdGlvbixcbiAgICBzZXRBcHBsaWNhdGlvblxufSBmcm9tICcuL2dsb2JhbHMuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9IFRleHR1cmUgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnKS5FbGVtZW50SW5wdXR9IEVsZW1lbnRJbnB1dCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2dhbWUtcGFkcy5qcycpLkdhbWVQYWRzfSBHYW1lUGFkcyAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2tleWJvYXJkLmpzJykuS2V5Ym9hcmR9IEtleWJvYXJkICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UuanMnKS5Nb3VzZX0gTW91c2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC90b3VjaC1kZXZpY2UuanMnKS5Ub3VjaERldmljZX0gVG91Y2hEZXZpY2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9zY2VuZS9ncmFwaC1ub2RlLmpzJykuR3JhcGhOb2RlfSBHcmFwaE5vZGUgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9zY2VuZS9tZXNoLmpzJykuTWVzaH0gTWVzaCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IE1lc2hJbnN0YW5jZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vbGlnaHRtYXBwZXIvbGlnaHRtYXBwZXIuanMnKS5MaWdodG1hcHBlcn0gTGlnaHRtYXBwZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1tYW5hZ2VyLmpzJykuQmF0Y2hNYW5hZ2VyfSBCYXRjaE1hbmFnZXIgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL2FwcC1vcHRpb25zLmpzJykuQXBwT3B0aW9uc30gQXBwT3B0aW9ucyAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4veHIveHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gWHJNYW5hZ2VyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn0gU291bmRNYW5hZ2VyICovXG5cbi8vIE1pbmktb2JqZWN0IHVzZWQgdG8gbWVhc3VyZSBwcm9ncmVzcyBvZiBsb2FkaW5nIHNldHNcbmNsYXNzIFByb2dyZXNzIHtcbiAgICBjb25zdHJ1Y3RvcihsZW5ndGgpIHtcbiAgICAgICAgdGhpcy5sZW5ndGggPSBsZW5ndGg7XG4gICAgICAgIHRoaXMuY291bnQgPSAwO1xuICAgIH1cblxuICAgIGluYygpIHtcbiAgICAgICAgdGhpcy5jb3VudCsrO1xuICAgIH1cblxuICAgIGRvbmUoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5jb3VudCA9PT0gdGhpcy5sZW5ndGgpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBcHBCYXNlI2NvbmZpZ3VyZX0gd2hlbiBjb25maWd1cmF0aW9uIGZpbGUgaXMgbG9hZGVkIGFuZCBwYXJzZWQgKG9yXG4gKiBhbiBlcnJvciBvY2N1cnMpLlxuICpcbiAqIEBjYWxsYmFjayBDb25maWd1cmVBcHBDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWRpbmcgb3IgcGFyc2luZyBmYWlscy5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEFwcEJhc2UjcHJlbG9hZH0gd2hlbiBhbGwgYXNzZXRzIChtYXJrZWQgYXMgJ3ByZWxvYWQnKSBhcmUgbG9hZGVkLlxuICpcbiAqIEBjYWxsYmFjayBQcmVsb2FkQXBwQ2FsbGJhY2tcbiAqL1xuXG5sZXQgYXBwID0gbnVsbDtcblxuLyoqXG4gKiBBbiBBcHBsaWNhdGlvbiByZXByZXNlbnRzIGFuZCBtYW5hZ2VzIHlvdXIgUGxheUNhbnZhcyBhcHBsaWNhdGlvbi4gSWYgeW91IGFyZSBkZXZlbG9waW5nIHVzaW5nXG4gKiB0aGUgUGxheUNhbnZhcyBFZGl0b3IsIHRoZSBBcHBsaWNhdGlvbiBpcyBjcmVhdGVkIGZvciB5b3UuIFlvdSBjYW4gYWNjZXNzIHlvdXIgQXBwbGljYXRpb25cbiAqIGluc3RhbmNlIGluIHlvdXIgc2NyaXB0cy4gQmVsb3cgaXMgYSBza2VsZXRvbiBzY3JpcHQgd2hpY2ggc2hvd3MgaG93IHlvdSBjYW4gYWNjZXNzIHRoZVxuICogYXBwbGljYXRpb24gJ2FwcCcgcHJvcGVydHkgaW5zaWRlIHRoZSBpbml0aWFsaXplIGFuZCB1cGRhdGUgZnVuY3Rpb25zOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vIEVkaXRvciBleGFtcGxlOiBhY2Nlc3NpbmcgdGhlIHBjLkFwcGxpY2F0aW9uIGZyb20gYSBzY3JpcHRcbiAqIHZhciBNeVNjcmlwdCA9IHBjLmNyZWF0ZVNjcmlwdCgnbXlTY3JpcHQnKTtcbiAqXG4gKiBNeVNjcmlwdC5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKCkge1xuICogICAgIC8vIEV2ZXJ5IHNjcmlwdCBpbnN0YW5jZSBoYXMgYSBwcm9wZXJ0eSAndGhpcy5hcHAnIGFjY2Vzc2libGUgaW4gdGhlIGluaXRpYWxpemUuLi5cbiAqICAgICB2YXIgYXBwID0gdGhpcy5hcHA7XG4gKiB9O1xuICpcbiAqIE15U2NyaXB0LnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihkdCkge1xuICogICAgIC8vIC4uLmFuZCB1cGRhdGUgZnVuY3Rpb25zLlxuICogICAgIHZhciBhcHAgPSB0aGlzLmFwcDtcbiAqIH07XG4gKiBgYGBcbiAqXG4gKiBJZiB5b3UgYXJlIHVzaW5nIHRoZSBFbmdpbmUgd2l0aG91dCB0aGUgRWRpdG9yLCB5b3UgaGF2ZSB0byBjcmVhdGUgdGhlIGFwcGxpY2F0aW9uIGluc3RhbmNlXG4gKiBtYW51YWxseS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEFwcEJhc2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBcHBCYXNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbGVtZW50fSBjYW52YXMgLSBUaGUgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBFbmdpbmUtb25seSBleGFtcGxlOiBjcmVhdGUgdGhlIGFwcGxpY2F0aW9uIG1hbnVhbGx5XG4gICAgICogdmFyIG9wdGlvbnMgPSBuZXcgQXBwT3B0aW9ucygpO1xuICAgICAqIHZhciBhcHAgPSBuZXcgcGMuQXBwQmFzZShjYW52YXMpO1xuICAgICAqIGFwcC5pbml0KG9wdGlvbnMpO1xuICAgICAqXG4gICAgICogLy8gU3RhcnQgdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wXG4gICAgICogYXBwLnN0YXJ0KCk7XG4gICAgICpcbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY2FudmFzKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodmVyc2lvbj8uaW5kZXhPZignJCcpIDwgMCkge1xuICAgICAgICAgICAgRGVidWcubG9nKGBQb3dlcmVkIGJ5IFBsYXlDYW52YXMgJHt2ZXJzaW9ufSAke3JldmlzaW9ufWApO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIFN0b3JlIGFwcGxpY2F0aW9uIGluc3RhbmNlXG4gICAgICAgIEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tjYW52YXMuaWRdID0gdGhpcztcbiAgICAgICAgc2V0QXBwbGljYXRpb24odGhpcyk7XG5cbiAgICAgICAgYXBwID0gdGhpcztcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9pbkZyYW1lVXBkYXRlID0gZmFsc2U7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3RpbWUgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTY2FsZXMgdGhlIGdsb2JhbCB0aW1lIGRlbHRhLiBEZWZhdWx0cyB0byAxLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgdGhlIGFwcCB0byBydW4gYXQgaGFsZiBzcGVlZFxuICAgICAgICAgKiB0aGlzLmFwcC50aW1lU2NhbGUgPSAwLjU7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRpbWVTY2FsZSA9IDE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENsYW1wcyBwZXItZnJhbWUgZGVsdGEgdGltZSB0byBhbiB1cHBlciBib3VuZC4gVXNlZnVsIHNpbmNlIHJldHVybmluZyBmcm9tIGEgdGFiXG4gICAgICAgICAqIGRlYWN0aXZhdGlvbiBjYW4gZ2VuZXJhdGUgaHVnZSB2YWx1ZXMgZm9yIGR0LCB3aGljaCBjYW4gYWR2ZXJzZWx5IGFmZmVjdCBnYW1lIHN0YXRlLlxuICAgICAgICAgKiBEZWZhdWx0cyB0byAwLjEgKHNlY29uZHMpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBEb24ndCBjbGFtcCBpbnRlci1mcmFtZSB0aW1lcyBvZiAyMDBtcyBvciBsZXNzXG4gICAgICAgICAqIHRoaXMuYXBwLm1heERlbHRhVGltZSA9IDAuMjtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWF4RGVsdGFUaW1lID0gMC4xOyAvLyBNYXhpbXVtIGRlbHRhIGlzIDAuMXMgb3IgMTAgZnBzLlxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgbnVtYmVyIG9mIGZyYW1lcyB0aGUgYXBwbGljYXRpb24gaGFzIHVwZGF0ZWQgc2luY2Ugc3RhcnQoKSB3YXMgY2FsbGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmZyYW1lID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogV2hlbiB0cnVlLCB0aGUgYXBwbGljYXRpb24ncyByZW5kZXIgZnVuY3Rpb24gaXMgY2FsbGVkIGV2ZXJ5IGZyYW1lLiBTZXR0aW5nIGF1dG9SZW5kZXJcbiAgICAgICAgICogdG8gZmFsc2UgaXMgdXNlZnVsIHRvIGFwcGxpY2F0aW9ucyB3aGVyZSB0aGUgcmVuZGVyZWQgaW1hZ2UgbWF5IG9mdGVuIGJlIHVuY2hhbmdlZCBvdmVyXG4gICAgICAgICAqIHRpbWUuIFRoaXMgY2FuIGhlYXZpbHkgcmVkdWNlIHRoZSBhcHBsaWNhdGlvbidzIGxvYWQgb24gdGhlIENQVSBhbmQgR1BVLiBEZWZhdWx0cyB0b1xuICAgICAgICAgKiB0cnVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gRGlzYWJsZSByZW5kZXJpbmcgZXZlcnkgZnJhbWUgYW5kIG9ubHkgcmVuZGVyIG9uIGEga2V5ZG93biBldmVudFxuICAgICAgICAgKiB0aGlzLmFwcC5hdXRvUmVuZGVyID0gZmFsc2U7XG4gICAgICAgICAqIHRoaXMuYXBwLmtleWJvYXJkLm9uKCdrZXlkb3duJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAqICAgICB0aGlzLmFwcC5yZW5kZXJOZXh0RnJhbWUgPSB0cnVlO1xuICAgICAgICAgKiB9LCB0aGlzKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXV0b1JlbmRlciA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCB0byB0cnVlIHRvIHJlbmRlciB0aGUgc2NlbmUgb24gdGhlIG5leHQgaXRlcmF0aW9uIG9mIHRoZSBtYWluIGxvb3AuIFRoaXMgb25seSBoYXMgYW5cbiAgICAgICAgICogZWZmZWN0IGlmIHtAbGluayBBcHBCYXNlI2F1dG9SZW5kZXJ9IGlzIHNldCB0byBmYWxzZS4gVGhlIHZhbHVlIG9mIHJlbmRlck5leHRGcmFtZVxuICAgICAgICAgKiBpcyBzZXQgYmFjayB0byBmYWxzZSBhZ2FpbiBhcyBzb29uIGFzIHRoZSBzY2VuZSBoYXMgYmVlbiByZW5kZXJlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFJlbmRlciB0aGUgc2NlbmUgb25seSB3aGlsZSBzcGFjZSBrZXkgaXMgcHJlc3NlZFxuICAgICAgICAgKiBpZiAodGhpcy5hcHAua2V5Ym9hcmQuaXNQcmVzc2VkKHBjLktFWV9TUEFDRSkpIHtcbiAgICAgICAgICogICAgIHRoaXMuYXBwLnJlbmRlck5leHRGcmFtZSA9IHRydWU7XG4gICAgICAgICAqIH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVuZGVyTmV4dEZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEVuYWJsZSBpZiB5b3Ugd2FudCBlbnRpdHkgdHlwZSBzY3JpcHQgYXR0cmlidXRlcyB0byBub3QgYmUgcmUtbWFwcGVkIHdoZW4gYW4gZW50aXR5IGlzXG4gICAgICAgICAqIGNsb25lZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyA9IHNjcmlwdC5sZWdhY3k7XG5cbiAgICAgICAgdGhpcy5fbGlicmFyaWVzTG9hZGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZpbGxNb2RlID0gRklMTE1PREVfS0VFUF9BU1BFQ1Q7XG4gICAgICAgIHRoaXMuX3Jlc29sdXRpb25Nb2RlID0gUkVTT0xVVElPTl9GSVhFRDtcbiAgICAgICAgdGhpcy5fYWxsb3dSZXNpemUgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBzY3JpcHRzIDEuMC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0FwcEJhc2V9XG4gICAgICAgICAqIEBkZXByZWNhdGVkXG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgYXBwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcHBPcHRpb25zfSBhcHBPcHRpb25zIC0gT3B0aW9ucyBzcGVjaWZ5aW5nIHRoZSBpbml0IHBhcmFtZXRlcnMgZm9yIHRoZSBhcHAuXG4gICAgICovXG4gICAgaW5pdChhcHBPcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IGFwcE9wdGlvbnMuZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KGRldmljZSwgXCJUaGUgYXBwbGljYXRpb24gY2Fubm90IGJlIGNyZWF0ZWQgd2l0aG91dCBhIHZhbGlkIEdyYXBoaWNzRGV2aWNlXCIpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R3JhcGhpY3NEZXZpY2V9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlID0gZGV2aWNlO1xuICAgICAgICBHcmFwaGljc0RldmljZUFjY2Vzcy5zZXQoZGV2aWNlKTtcblxuICAgICAgICB0aGlzLl9pbml0RGVmYXVsdE1hdGVyaWFsKCk7XG4gICAgICAgIHRoaXMuX2luaXRQcm9ncmFtTGlicmFyeSgpO1xuICAgICAgICB0aGlzLnN0YXRzID0gbmV3IEFwcGxpY2F0aW9uU3RhdHMoZGV2aWNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge1NvdW5kTWFuYWdlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlciA9IGFwcE9wdGlvbnMuc291bmRNYW5hZ2VyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcmVzb3VyY2UgbG9hZGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7UmVzb3VyY2VMb2FkZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvYWRlciA9IG5ldyBSZXNvdXJjZUxvYWRlcih0aGlzKTtcblxuICAgICAgICBMaWdodHNCdWZmZXIuaW5pdChkZXZpY2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZXMgYWxsIGVudGl0aWVzIHRoYXQgaGF2ZSBiZWVuIGNyZWF0ZWQgZm9yIHRoaXMgYXBwIGJ5IGd1aWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBFbnRpdHk+fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbnRpdHlJbmRleCA9IHt9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2NlbmUgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTY2VuZX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2V0IHRoZSB0b25lIG1hcHBpbmcgcHJvcGVydHkgb2YgdGhlIGFwcGxpY2F0aW9uJ3Mgc2NlbmVcbiAgICAgICAgICogdGhpcy5hcHAuc2NlbmUudG9uZU1hcHBpbmcgPSBwYy5UT05FTUFQX0ZJTE1JQztcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2NlbmUgPSBuZXcgU2NlbmUoZGV2aWNlKTtcbiAgICAgICAgdGhpcy5fcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZSh0aGlzLnNjZW5lKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJvb3QgZW50aXR5IG9mIHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VudGl0eX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gUmV0dXJuIHRoZSBmaXJzdCBlbnRpdHkgY2FsbGVkICdDYW1lcmEnIGluIGEgZGVwdGgtZmlyc3Qgc2VhcmNoIG9mIHRoZSBzY2VuZSBoaWVyYXJjaHlcbiAgICAgICAgICogdmFyIGNhbWVyYSA9IHRoaXMuYXBwLnJvb3QuZmluZEJ5TmFtZSgnQ2FtZXJhJyk7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJvb3QgPSBuZXcgRW50aXR5KCk7XG4gICAgICAgIHRoaXMucm9vdC5fZW5hYmxlZEluSGllcmFyY2h5ID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFzc2V0IHJlZ2lzdHJ5IG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7QXNzZXRSZWdpc3RyeX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2VhcmNoIHRoZSBhc3NldCByZWdpc3RyeSBmb3IgYWxsIGFzc2V0cyB3aXRoIHRoZSB0YWcgJ3ZlaGljbGUnXG4gICAgICAgICAqIHZhciB2ZWhpY2xlQXNzZXRzID0gdGhpcy5hcHAuYXNzZXRzLmZpbmRCeVRhZygndmVoaWNsZScpO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5hc3NldHMgPSBuZXcgQXNzZXRSZWdpc3RyeSh0aGlzLmxvYWRlcik7XG4gICAgICAgIGlmIChhcHBPcHRpb25zLmFzc2V0UHJlZml4KSB0aGlzLmFzc2V0cy5wcmVmaXggPSBhcHBPcHRpb25zLmFzc2V0UHJlZml4O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7QnVuZGxlUmVnaXN0cnl9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYnVuZGxlcyA9IG5ldyBCdW5kbGVSZWdpc3RyeSh0aGlzLmFzc2V0cyk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCB0aGlzIHRvIGZhbHNlIGlmIHlvdSB3YW50IHRvIHJ1biB3aXRob3V0IHVzaW5nIGJ1bmRsZXMuIFdlIHNldCBpdCB0byB0cnVlIG9ubHkgaWZcbiAgICAgICAgICogVGV4dERlY29kZXIgaXMgYXZhaWxhYmxlIGJlY2F1c2Ugd2UgY3VycmVudGx5IHJlbHkgb24gaXQgZm9yIHVudGFycmluZy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZW5hYmxlQnVuZGxlcyA9ICh0eXBlb2YgVGV4dERlY29kZXIgIT09ICd1bmRlZmluZWQnKTtcblxuICAgICAgICB0aGlzLnNjcmlwdHNPcmRlciA9IGFwcE9wdGlvbnMuc2NyaXB0c09yZGVyIHx8IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBzY3JpcHQgcmVnaXN0cnkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTY3JpcHRSZWdpc3RyeX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2NyaXB0cyA9IG5ldyBTY3JpcHRSZWdpc3RyeSh0aGlzKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogSGFuZGxlcyBsb2NhbGl6YXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtJMThufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pMThuID0gbmV3IEkxOG4odGhpcyk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzY2VuZSByZWdpc3RyeSBtYW5hZ2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1NjZW5lUmVnaXN0cnl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNlYXJjaCB0aGUgc2NlbmUgcmVnaXN0cnkgZm9yIGEgaXRlbSB3aXRoIHRoZSBuYW1lICdyYWNldHJhY2sxJ1xuICAgICAgICAgKiB2YXIgc2NlbmVJdGVtID0gdGhpcy5hcHAuc2NlbmVzLmZpbmQoJ3JhY2V0cmFjazEnKTtcbiAgICAgICAgICpcbiAgICAgICAgICogLy8gTG9hZCB0aGUgc2NlbmUgdXNpbmcgdGhlIGl0ZW0ncyB1cmxcbiAgICAgICAgICogdGhpcy5hcHAuc2NlbmVzLmxvYWRTY2VuZShzY2VuZUl0ZW0udXJsKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2NlbmVzID0gbmV3IFNjZW5lUmVnaXN0cnkodGhpcyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyV29ybGQgPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgbmFtZTogXCJXb3JsZFwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfV09STERcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5zY2VuZUdyYWIgPSBuZXcgU2NlbmVHcmFiKHRoaXMpO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoID0gdGhpcy5zY2VuZUdyYWIubGF5ZXI7XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJTa3lib3ggPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG5hbWU6IFwiU2t5Ym94XCIsXG4gICAgICAgICAgICBpZDogTEFZRVJJRF9TS1lCT1gsXG4gICAgICAgICAgICBvcGFxdWVTb3J0TW9kZTogU09SVE1PREVfTk9ORVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJVaSA9IG5ldyBMYXllcih7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbmFtZTogXCJVSVwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfVUksXG4gICAgICAgICAgICB0cmFuc3BhcmVudFNvcnRNb2RlOiBTT1JUTU9ERV9NQU5VQUwsXG4gICAgICAgICAgICBwYXNzVGhyb3VnaDogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVySW1tZWRpYXRlID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiBcIkltbWVkaWF0ZVwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfSU1NRURJQVRFLFxuICAgICAgICAgICAgb3BhcXVlU29ydE1vZGU6IFNPUlRNT0RFX05PTkUsXG4gICAgICAgICAgICBwYXNzVGhyb3VnaDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbiA9IG5ldyBMYXllckNvbXBvc2l0aW9uKFwiZGVmYXVsdFwiKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllcldvcmxkKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllckRlcHRoKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllclNreWJveCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllcldvcmxkKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllclVpKTtcbiAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMgPSBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbjtcblxuICAgICAgICAvLyBEZWZhdWx0IGxheWVycyBwYXRjaFxuICAgICAgICB0aGlzLnNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgZnVuY3Rpb24gKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgICAgIGNvbnN0IGxpc3QgPSBuZXdDb21wLmxheWVyTGlzdDtcbiAgICAgICAgICAgIGxldCBsYXllcjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGxheWVyID0gbGlzdFtpXTtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGxheWVyLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTEFZRVJJRF9ERVBUSDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc2NlbmVHcmFiLnBhdGNoKGxheWVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIExBWUVSSURfVUk6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5wYXNzVGhyb3VnaCA9IHNlbGYuZGVmYXVsdExheWVyVWkucGFzc1Rocm91Z2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBMQVlFUklEX0lNTUVESUFURTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnBhc3NUaHJvdWdoID0gc2VsZi5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUucGFzc1Rocm91Z2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHBsYWNlaG9sZGVyIHRleHR1cmUgZm9yIGFyZWEgbGlnaHQgTFVUc1xuICAgICAgICBBcmVhTGlnaHRMdXRzLmNyZWF0ZVBsYWNlaG9sZGVyKGRldmljZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBmb3J3YXJkIHJlbmRlcmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Rm9yd2FyZFJlbmRlcmVyfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbmV3IEZvcndhcmRSZW5kZXJlcihkZXZpY2UpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnNjZW5lID0gdGhpcy5zY2VuZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGZyYW1lIGdyYXBoLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnJhbWVHcmFwaH1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5mcmFtZUdyYXBoID0gbmV3IEZyYW1lR3JhcGgoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJ1bi10aW1lIGxpZ2h0bWFwcGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7TGlnaHRtYXBwZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyID0gbnVsbDtcbiAgICAgICAgaWYgKGFwcE9wdGlvbnMubGlnaHRtYXBwZXIpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRtYXBwZXIgPSBuZXcgYXBwT3B0aW9ucy5saWdodG1hcHBlcihkZXZpY2UsIHRoaXMucm9vdCwgdGhpcy5zY2VuZSwgdGhpcy5yZW5kZXJlciwgdGhpcy5hc3NldHMpO1xuICAgICAgICAgICAgdGhpcy5vbmNlKCdwcmVyZW5kZXInLCB0aGlzLl9maXJzdEJha2UsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIGJhdGNoIG1hbmFnZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtCYXRjaE1hbmFnZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9iYXRjaGVyID0gbnVsbDtcbiAgICAgICAgaWYgKGFwcE9wdGlvbnMuYmF0Y2hNYW5hZ2VyKSB7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaGVyID0gbmV3IGFwcE9wdGlvbnMuYmF0Y2hNYW5hZ2VyKGRldmljZSwgdGhpcy5yb290LCB0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgIHRoaXMub25jZSgncHJlcmVuZGVyJywgdGhpcy5fZmlyc3RCYXRjaCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGtleWJvYXJkIGRldmljZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0tleWJvYXJkfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5rZXlib2FyZCA9IGFwcE9wdGlvbnMua2V5Ym9hcmQgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG1vdXNlIGRldmljZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge01vdXNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tb3VzZSA9IGFwcE9wdGlvbnMubW91c2UgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBnZXQgdG91Y2ggZXZlbnRzIGlucHV0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7VG91Y2hEZXZpY2V9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRvdWNoID0gYXBwT3B0aW9ucy50b3VjaCB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVc2VkIHRvIGFjY2VzcyBHYW1lUGFkIGlucHV0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R2FtZVBhZHN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdhbWVwYWRzID0gYXBwT3B0aW9ucy5nYW1lcGFkcyB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVc2VkIHRvIGhhbmRsZSBpbnB1dCBmb3Ige0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VsZW1lbnRJbnB1dH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZWxlbWVudElucHV0ID0gYXBwT3B0aW9ucy5lbGVtZW50SW5wdXQgfHwgbnVsbDtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudElucHV0KVxuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuYXBwID0gdGhpcztcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFhSIE1hbmFnZXIgdGhhdCBwcm92aWRlcyBhYmlsaXR5IHRvIHN0YXJ0IFZSL0FSIHNlc3Npb25zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7WHJNYW5hZ2VyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBjaGVjayBpZiBWUiBpcyBhdmFpbGFibGVcbiAgICAgICAgICogaWYgKGFwcC54ci5pc0F2YWlsYWJsZShwYy5YUlRZUEVfVlIpKSB7XG4gICAgICAgICAqICAgICAvLyBWUiBpcyBhdmFpbGFibGVcbiAgICAgICAgICogfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy54ciA9IGFwcE9wdGlvbnMueHIgPyBuZXcgYXBwT3B0aW9ucy54cih0aGlzKSA6IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudElucHV0KVxuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuYXR0YWNoU2VsZWN0RXZlbnRzKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9pblRvb2xzID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtBc3NldHxudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zY3JpcHRQcmVmaXggPSBhcHBPcHRpb25zLnNjcmlwdFByZWZpeCB8fCAnJztcblxuICAgICAgICBpZiAodGhpcy5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRlci5hZGRIYW5kbGVyKFwiYnVuZGxlXCIsIG5ldyBCdW5kbGVIYW5kbGVyKHRoaXMpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgcmVnaXN0ZXIgYWxsIHJlcXVpcmVkIHJlc291cmNlIGhhbmRsZXJzXG4gICAgICAgIGFwcE9wdGlvbnMucmVzb3VyY2VIYW5kbGVycy5mb3JFYWNoKChyZXNvdXJjZUhhbmRsZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBuZXcgcmVzb3VyY2VIYW5kbGVyKHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIuYWRkSGFuZGxlcihoYW5kbGVyLmhhbmRsZXJUeXBlLCBoYW5kbGVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIGNvbXBvbmVudCBzeXN0ZW0gcmVnaXN0cnkuIFRoZSBBcHBsaWNhdGlvbiBjb25zdHJ1Y3RvciBhZGRzIHRoZVxuICAgICAgICAgKiBmb2xsb3dpbmcgY29tcG9uZW50IHN5c3RlbXMgdG8gaXRzIGNvbXBvbmVudCBzeXN0ZW0gcmVnaXN0cnk6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0gYW5pbSAoe0BsaW5rIEFuaW1Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGFuaW1hdGlvbiAoe0BsaW5rIEFuaW1hdGlvbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gYXVkaW9saXN0ZW5lciAoe0BsaW5rIEF1ZGlvTGlzdGVuZXJDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGJ1dHRvbiAoe0BsaW5rIEJ1dHRvbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gY2FtZXJhICh7QGxpbmsgQ2FtZXJhQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBjb2xsaXNpb24gKHtAbGluayBDb2xsaXNpb25Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGVsZW1lbnQgKHtAbGluayBFbGVtZW50Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBsYXlvdXRjaGlsZCAoe0BsaW5rIExheW91dENoaWxkQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBsYXlvdXRncm91cCAoe0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBsaWdodCAoe0BsaW5rIExpZ2h0Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBtb2RlbCAoe0BsaW5rIE1vZGVsQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBwYXJ0aWNsZXN5c3RlbSAoe0BsaW5rIFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSByaWdpZGJvZHkgKHtAbGluayBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHJlbmRlciAoe0BsaW5rIFJlbmRlckNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2NyZWVuICh7QGxpbmsgU2NyZWVuQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JpcHQgKHtAbGluayBTY3JpcHRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcm9sbGJhciAoe0BsaW5rIFNjcm9sbGJhckNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2Nyb2xsdmlldyAoe0BsaW5rIFNjcm9sbFZpZXdDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNvdW5kICh7QGxpbmsgU291bmRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNwcml0ZSAoe0BsaW5rIFNwcml0ZUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtDb21wb25lbnRTeXN0ZW1SZWdpc3RyeX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2V0IGdsb2JhbCBncmF2aXR5IHRvIHplcm9cbiAgICAgICAgICogdGhpcy5hcHAuc3lzdGVtcy5yaWdpZGJvZHkuZ3Jhdml0eS5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCB0aGUgZ2xvYmFsIHNvdW5kIHZvbHVtZSB0byA1MCVcbiAgICAgICAgICogdGhpcy5hcHAuc3lzdGVtcy5zb3VuZC52b2x1bWUgPSAwLjU7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnN5c3RlbXMgPSBuZXcgQ29tcG9uZW50U3lzdGVtUmVnaXN0cnkoKTtcblxuICAgICAgICAvLyBjcmVhdGUgYW5kIHJlZ2lzdGVyIGFsbCByZXF1aXJlZCBjb21wb25lbnQgc3lzdGVtc1xuICAgICAgICBhcHBPcHRpb25zLmNvbXBvbmVudFN5c3RlbXMuZm9yRWFjaCgoY29tcG9uZW50U3lzdGVtKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMuYWRkKG5ldyBjb21wb25lbnRTeXN0ZW0odGhpcykpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIgPSB0aGlzLm9uVmlzaWJpbGl0eUNoYW5nZS5iaW5kKHRoaXMpO1xuXG4gICAgICAgIC8vIERlcGVuZGluZyBvbiBicm93c2VyIGFkZCB0aGUgY29ycmVjdCB2aXNpYmlsaXR5Y2hhbmdlIGV2ZW50IGFuZCBzdG9yZSB0aGUgbmFtZSBvZiB0aGVcbiAgICAgICAgLy8gaGlkZGVuIGF0dHJpYnV0ZSBpbiB0aGlzLl9oaWRkZW5BdHRyLlxuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LmhpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICdoaWRkZW4nO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkb2N1bWVudC5tb3pIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnbW96SGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3p2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQubXNIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnbXNIaWRkZW4nO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21zdmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRvY3VtZW50LndlYmtpdEhpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICd3ZWJraXRIaWRkZW4nO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdHZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYmluZCB0aWNrIGZ1bmN0aW9uIHRvIGN1cnJlbnQgc2NvcGVcbiAgICAgICAgLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVzZS1iZWZvcmUtZGVmaW5lICovXG4gICAgICAgIHRoaXMudGljayA9IG1ha2VUaWNrKHRoaXMpOyAvLyBDaXJjdWxhciBsaW50aW5nIGlzc3VlIGFzIG1ha2VUaWNrIGFuZCBBcHBsaWNhdGlvbiByZWZlcmVuY2UgZWFjaCBvdGhlclxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBuYW1lIGFwcFxuICAgICAqIEB0eXBlIHtBcHBCYXNlfHVuZGVmaW5lZH1cbiAgICAgKiBAZGVzY3JpcHRpb24gR2V0cyB0aGUgY3VycmVudCBhcHBsaWNhdGlvbiwgaWYgYW55LlxuICAgICAqL1xuXG4gICAgc3RhdGljIF9hcHBsaWNhdGlvbnMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgY3VycmVudCBhcHBsaWNhdGlvbi4gSW4gdGhlIGNhc2Ugd2hlcmUgdGhlcmUgYXJlIG11bHRpcGxlIHJ1bm5pbmcgYXBwbGljYXRpb25zLCB0aGVcbiAgICAgKiBmdW5jdGlvbiBjYW4gZ2V0IGFuIGFwcGxpY2F0aW9uIGJhc2VkIG9uIGEgc3VwcGxpZWQgY2FudmFzIGlkLiBUaGlzIGZ1bmN0aW9uIGlzIHBhcnRpY3VsYXJseVxuICAgICAqIHVzZWZ1bCB3aGVuIHRoZSBjdXJyZW50IEFwcGxpY2F0aW9uIGlzIG5vdCByZWFkaWx5IGF2YWlsYWJsZS4gRm9yIGV4YW1wbGUsIGluIHRoZSBKYXZhU2NyaXB0XG4gICAgICogY29uc29sZSBvZiB0aGUgYnJvd3NlcidzIGRldmVsb3BlciB0b29scy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbaWRdIC0gSWYgZGVmaW5lZCwgdGhlIHJldHVybmVkIGFwcGxpY2F0aW9uIHNob3VsZCB1c2UgdGhlIGNhbnZhcyB3aGljaCBoYXNcbiAgICAgKiB0aGlzIGlkLiBPdGhlcndpc2UgY3VycmVudCBhcHBsaWNhdGlvbiB3aWxsIGJlIHJldHVybmVkLlxuICAgICAqIEByZXR1cm5zIHtBcHBCYXNlfHVuZGVmaW5lZH0gVGhlIHJ1bm5pbmcgYXBwbGljYXRpb24sIGlmIGFueS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhcHAgPSBwYy5BcHBCYXNlLmdldEFwcGxpY2F0aW9uKCk7XG4gICAgICovXG4gICAgc3RhdGljIGdldEFwcGxpY2F0aW9uKGlkKSB7XG4gICAgICAgIHJldHVybiBpZCA/IEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tpZF0gOiBnZXRBcHBsaWNhdGlvbigpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9pbml0RGVmYXVsdE1hdGVyaWFsKCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSBcIkRlZmF1bHQgTWF0ZXJpYWxcIjtcbiAgICAgICAgbWF0ZXJpYWwuc2hhZGluZ01vZGVsID0gU1BFQ1VMQVJfQkxJTk47XG4gICAgICAgIHNldERlZmF1bHRNYXRlcmlhbCh0aGlzLmdyYXBoaWNzRGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2luaXRQcm9ncmFtTGlicmFyeSgpIHtcbiAgICAgICAgY29uc3QgbGlicmFyeSA9IG5ldyBQcm9ncmFtTGlicmFyeSh0aGlzLmdyYXBoaWNzRGV2aWNlLCBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpKTtcbiAgICAgICAgc2V0UHJvZ3JhbUxpYnJhcnkodGhpcy5ncmFwaGljc0RldmljZSwgbGlicmFyeSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge1NvdW5kTWFuYWdlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHNvdW5kTWFuYWdlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NvdW5kTWFuYWdlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBiYXRjaCBtYW5hZ2VyLiBUaGUgYmF0Y2ggbWFuYWdlciBpcyB1c2VkIHRvIG1lcmdlIG1lc2ggaW5zdGFuY2VzIGluXG4gICAgICogdGhlIHNjZW5lLCB3aGljaCByZWR1Y2VzIHRoZSBvdmVyYWxsIG51bWJlciBvZiBkcmF3IGNhbGxzLCB0aGVyZWJ5IGJvb3N0aW5nIHBlcmZvcm1hbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0JhdGNoTWFuYWdlcn1cbiAgICAgKi9cbiAgICBnZXQgYmF0Y2hlcigpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuX2JhdGNoZXIsIFwiQmF0Y2hNYW5hZ2VyIGhhcyBub3QgYmVlbiBjcmVhdGVkIGFuZCBpcyByZXF1aXJlZCBmb3IgY29ycmVjdCBmdW5jdGlvbmFsaXR5LlwiKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgZmlsbCBtb2RlIG9mIHRoZSBjYW52YXMuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX05PTkV9OiB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0ZJTExfV0lORE9XfTogdGhlIGNhbnZhcyB3aWxsIHNpbXBseSBmaWxsIHRoZSB3aW5kb3csIGNoYW5naW5nIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9LRUVQX0FTUEVDVH06IHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0IGNhbiB3aGlsZVxuICAgICAqIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCBmaWxsTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbGxNb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IHJlc29sdXRpb24gbW9kZSBvZiB0aGUgY2FudmFzLCBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0FVVE99OiBpZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBub3QgcHJvdmlkZWQsIGNhbnZhcyB3aWxsIGJlIHJlc2l6ZWQgdG9cbiAgICAgKiBtYXRjaCBjYW52YXMgY2xpZW50IHNpemUuXG4gICAgICogLSB7QGxpbmsgUkVTT0xVVElPTl9GSVhFRH06IHJlc29sdXRpb24gb2YgY2FudmFzIHdpbGwgYmUgZml4ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCByZXNvbHV0aW9uTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc29sdXRpb25Nb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgdGhlIGFwcGxpY2F0aW9uIGNvbmZpZ3VyYXRpb24gZmlsZSBhbmQgYXBwbHkgYXBwbGljYXRpb24gcHJvcGVydGllcyBhbmQgZmlsbCB0aGUgYXNzZXRcbiAgICAgKiByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIG9mIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0NvbmZpZ3VyZUFwcENhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgY29uZmlndXJhdGlvbiBmaWxlIGlzXG4gICAgICogbG9hZGVkIGFuZCBwYXJzZWQgKG9yIGFuIGVycm9yIG9jY3VycykuXG4gICAgICovXG4gICAgY29uZmlndXJlKHVybCwgY2FsbGJhY2spIHtcbiAgICAgICAgaHR0cC5nZXQodXJsLCAoZXJyLCByZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcm9wcyA9IHJlc3BvbnNlLmFwcGxpY2F0aW9uX3Byb3BlcnRpZXM7XG4gICAgICAgICAgICBjb25zdCBzY2VuZXMgPSByZXNwb25zZS5zY2VuZXM7XG4gICAgICAgICAgICBjb25zdCBhc3NldHMgPSByZXNwb25zZS5hc3NldHM7XG5cbiAgICAgICAgICAgIHRoaXMuX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzKHByb3BzLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VTY2VuZXMoc2NlbmVzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFzc2V0cyhhc3NldHMpO1xuICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYWxsIGFzc2V0cyBpbiB0aGUgYXNzZXQgcmVnaXN0cnkgdGhhdCBhcmUgbWFya2VkIGFzICdwcmVsb2FkJy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UHJlbG9hZEFwcENhbGxiYWNrfSBjYWxsYmFjayAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIGFsbCBhc3NldHMgYXJlIGxvYWRlZC5cbiAgICAgKi9cbiAgICBwcmVsb2FkKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6c3RhcnRcIik7XG5cbiAgICAgICAgLy8gZ2V0IGxpc3Qgb2YgYXNzZXRzIHRvIHByZWxvYWRcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5hc3NldHMubGlzdCh7XG4gICAgICAgICAgICBwcmVsb2FkOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKGFzc2V0cy5sZW5ndGgpO1xuXG4gICAgICAgIGxldCBfZG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGNoZWNrIGlmIGFsbCBsb2FkaW5nIGlzIGRvbmVcbiAgICAgICAgY29uc3QgZG9uZSA9ICgpID0+IHtcbiAgICAgICAgICAgIC8vIGRvIG5vdCBwcm9jZWVkIGlmIGFwcGxpY2F0aW9uIGRlc3Ryb3llZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIV9kb25lICYmIHByb2dyZXNzLmRvbmUoKSkge1xuICAgICAgICAgICAgICAgIF9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoXCJwcmVsb2FkOmVuZFwiKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHRvdGFscyBsb2FkaW5nIHByb2dyZXNzIG9mIGFzc2V0c1xuICAgICAgICBjb25zdCB0b3RhbCA9IGFzc2V0cy5sZW5ndGg7XG5cbiAgICAgICAgaWYgKHByb2dyZXNzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3Qgb25Bc3NldExvYWQgPSAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3ByZWxvYWQ6cHJvZ3Jlc3MnLCBwcm9ncmVzcy5jb3VudCAvIHRvdGFsKTtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG9uQXNzZXRFcnJvciA9IChlcnIsIGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdwcmVsb2FkOnByb2dyZXNzJywgcHJvZ3Jlc3MuY291bnQgLyB0b3RhbCk7XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MuZG9uZSgpKVxuICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBmb3IgZWFjaCBhc3NldFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0c1tpXS5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2ldLm9uY2UoJ2xvYWQnLCBvbkFzc2V0TG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0c1tpXS5vbmNlKCdlcnJvcicsIG9uQXNzZXRFcnJvcik7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hc3NldHMubG9hZChhc3NldHNbaV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzLmluYygpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoXCJwcmVsb2FkOnByb2dyZXNzXCIsIHByb2dyZXNzLmNvdW50IC8gdG90YWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3ByZWxvYWRTY3JpcHRzKHNjZW5lRGF0YSwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCFzY3JpcHQubGVnYWN5KSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBzY3JpcHRzID0gdGhpcy5fZ2V0U2NyaXB0UmVmZXJlbmNlcyhzY2VuZURhdGEpO1xuXG4gICAgICAgIGNvbnN0IGwgPSBzY3JpcHRzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MobCk7XG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gL15odHRwKHMpPzpcXC9cXC8vO1xuXG4gICAgICAgIGlmIChsKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSAoZXJyLCBTY3JpcHRUeXBlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGxldCBzY3JpcHRVcmwgPSBzY3JpcHRzW2ldO1xuICAgICAgICAgICAgICAgIC8vIHN1cHBvcnQgYWJzb2x1dGUgVVJMcyAoZm9yIG5vdylcbiAgICAgICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3Qoc2NyaXB0VXJsLnRvTG93ZXJDYXNlKCkpICYmIHRoaXMuX3NjcmlwdFByZWZpeClcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0VXJsID0gcGF0aC5qb2luKHRoaXMuX3NjcmlwdFByZWZpeCwgc2NyaXB0c1tpXSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRlci5sb2FkKHNjcmlwdFVybCwgJ3NjcmlwdCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXQgYXBwbGljYXRpb24gcHJvcGVydGllcyBmcm9tIGRhdGEgZmlsZVxuICAgIF9wYXJzZUFwcGxpY2F0aW9uUHJvcGVydGllcyhwcm9wcywgY2FsbGJhY2spIHtcbiAgICAgICAgLy8gY29uZmlndXJlIHJldHJ5aW5nIGFzc2V0c1xuICAgICAgICBpZiAodHlwZW9mIHByb3BzLm1heEFzc2V0UmV0cmllcyA9PT0gJ251bWJlcicgJiYgcHJvcHMubWF4QXNzZXRSZXRyaWVzID4gMCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIuZW5hYmxlUmV0cnkocHJvcHMubWF4QXNzZXRSZXRyaWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIHRlbXBvcmFyeSBibG9jayBhZnRlciBtaWdyYXRpbmcgcHJvcGVydGllc1xuICAgICAgICBpZiAoIXByb3BzLnVzZURldmljZVBpeGVsUmF0aW8pXG4gICAgICAgICAgICBwcm9wcy51c2VEZXZpY2VQaXhlbFJhdGlvID0gcHJvcHMudXNlX2RldmljZV9waXhlbF9yYXRpbztcbiAgICAgICAgaWYgKCFwcm9wcy5yZXNvbHV0aW9uTW9kZSlcbiAgICAgICAgICAgIHByb3BzLnJlc29sdXRpb25Nb2RlID0gcHJvcHMucmVzb2x1dGlvbl9tb2RlO1xuICAgICAgICBpZiAoIXByb3BzLmZpbGxNb2RlKVxuICAgICAgICAgICAgcHJvcHMuZmlsbE1vZGUgPSBwcm9wcy5maWxsX21vZGU7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSBwcm9wcy53aWR0aDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gcHJvcHMuaGVpZ2h0O1xuICAgICAgICBpZiAocHJvcHMudXNlRGV2aWNlUGl4ZWxSYXRpbykge1xuICAgICAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5tYXhQaXhlbFJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldENhbnZhc1Jlc29sdXRpb24ocHJvcHMucmVzb2x1dGlvbk1vZGUsIHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQpO1xuICAgICAgICB0aGlzLnNldENhbnZhc0ZpbGxNb2RlKHByb3BzLmZpbGxNb2RlLCB0aGlzLl93aWR0aCwgdGhpcy5faGVpZ2h0KTtcblxuICAgICAgICAvLyBzZXQgdXAgbGF5ZXJzXG4gICAgICAgIGlmIChwcm9wcy5sYXllcnMgJiYgcHJvcHMubGF5ZXJPcmRlcikge1xuICAgICAgICAgICAgY29uc3QgY29tcG9zaXRpb24gPSBuZXcgTGF5ZXJDb21wb3NpdGlvbihcImFwcGxpY2F0aW9uXCIpO1xuXG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHByb3BzLmxheWVycykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBwcm9wcy5sYXllcnNba2V5XTtcbiAgICAgICAgICAgICAgICBkYXRhLmlkID0gcGFyc2VJbnQoa2V5LCAxMCk7XG4gICAgICAgICAgICAgICAgLy8gZGVwdGggbGF5ZXIgc2hvdWxkIG9ubHkgYmUgZW5hYmxlZCB3aGVuIG5lZWRlZFxuICAgICAgICAgICAgICAgIC8vIGJ5IGluY3JlbWVudGluZyBpdHMgcmVmIGNvdW50ZXJcbiAgICAgICAgICAgICAgICBkYXRhLmVuYWJsZWQgPSBkYXRhLmlkICE9PSBMQVlFUklEX0RFUFRIO1xuICAgICAgICAgICAgICAgIGxheWVyc1trZXldID0gbmV3IExheWVyKGRhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcHJvcHMubGF5ZXJPcmRlci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1YmxheWVyID0gcHJvcHMubGF5ZXJPcmRlcltpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyc1tzdWJsYXllci5sYXllcl07XG4gICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3VibGF5ZXIudHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9zaXRpb24ucHVzaFRyYW5zcGFyZW50KGxheWVyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5wdXNoT3BhcXVlKGxheWVyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5zdWJMYXllckVuYWJsZWRbaV0gPSBzdWJsYXllci5lbmFibGVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNjZW5lLmxheWVycyA9IGNvbXBvc2l0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIGJhdGNoIGdyb3Vwc1xuICAgICAgICBpZiAocHJvcHMuYmF0Y2hHcm91cHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoZXIgPSB0aGlzLmJhdGNoZXI7XG4gICAgICAgICAgICBpZiAoYmF0Y2hlcikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wcy5iYXRjaEdyb3Vwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBncnAgPSBwcm9wcy5iYXRjaEdyb3Vwc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgYmF0Y2hlci5hZGRHcm91cChncnAubmFtZSwgZ3JwLmR5bmFtaWMsIGdycC5tYXhBYWJiU2l6ZSwgZ3JwLmlkLCBncnAubGF5ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgbG9jYWxpemF0aW9uIGFzc2V0c1xuICAgICAgICBpZiAocHJvcHMuaTE4bkFzc2V0cykge1xuICAgICAgICAgICAgdGhpcy5pMThuLmFzc2V0cyA9IHByb3BzLmkxOG5Bc3NldHM7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2FkTGlicmFyaWVzKHByb3BzLmxpYnJhcmllcywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IHVybHMgLSBMaXN0IG9mIFVSTHMgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIENhbGxiYWNrIGZ1bmN0aW9uLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvYWRMaWJyYXJpZXModXJscywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbGVuID0gdXJscy5sZW5ndGg7XG4gICAgICAgIGxldCBjb3VudCA9IGxlbjtcblxuICAgICAgICBjb25zdCByZWdleCA9IC9eaHR0cChzKT86XFwvXFwvLztcblxuICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSAoZXJyLCBzY3JpcHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb3VudC0tO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgICAgIGxldCB1cmwgPSB1cmxzW2ldO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFyZWdleC50ZXN0KHVybC50b0xvd2VyQ2FzZSgpKSAmJiB0aGlzLl9zY3JpcHRQcmVmaXgpXG4gICAgICAgICAgICAgICAgICAgIHVybCA9IHBhdGguam9pbih0aGlzLl9zY3JpcHRQcmVmaXgsIHVybCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwgJ3NjcmlwdCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm9uTGlicmFyaWVzTG9hZGVkKCk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydCBzY2VuZSBuYW1lL3VybHMgaW50byB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHNjZW5lcyAtIFNjZW5lcyB0byBhZGQgdG8gdGhlIHNjZW5lIHJlZ2lzdHJ5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlU2NlbmVzKHNjZW5lcykge1xuICAgICAgICBpZiAoIXNjZW5lcykgcmV0dXJuO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NlbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lcy5hZGQoc2NlbmVzW2ldLm5hbWUsIHNjZW5lc1tpXS51cmwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IGFzc2V0cyBpbnRvIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSBhc3NldHMgLSBBc3NldHMgdG8gaW5zZXJ0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlQXNzZXRzKGFzc2V0cykge1xuICAgICAgICBjb25zdCBsaXN0ID0gW107XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0c0luZGV4ID0ge307XG4gICAgICAgIGNvbnN0IGJ1bmRsZXNJbmRleCA9IHt9O1xuXG4gICAgICAgIGlmICghc2NyaXB0LmxlZ2FjeSkge1xuICAgICAgICAgICAgLy8gYWRkIHNjcmlwdHMgaW4gb3JkZXIgb2YgbG9hZGluZyBmaXJzdFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNjcmlwdHNPcmRlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gdGhpcy5zY3JpcHRzT3JkZXJbaV07XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldHNbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIHNjcmlwdHNJbmRleFtpZF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgYnVuZGxlc1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlQnVuZGxlcykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldHNbaWRdLnR5cGUgPT09ICdidW5kbGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidW5kbGVzSW5kZXhbaWRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgcmVzdCBvZiBhc3NldHNcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdHNJbmRleFtpZF0gfHwgYnVuZGxlc0luZGV4W2lkXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIGJ1bmRsZXNcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRzW2lkXS50eXBlID09PSAnYnVuZGxlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVuZGxlc0luZGV4W2lkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRoZW4gYWRkIHJlc3Qgb2YgYXNzZXRzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgIGlmIChidW5kbGVzSW5kZXhbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGxpc3RbaV07XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IG5ldyBBc3NldChkYXRhLm5hbWUsIGRhdGEudHlwZSwgZGF0YS5maWxlLCBkYXRhLmRhdGEpO1xuICAgICAgICAgICAgYXNzZXQuaWQgPSBwYXJzZUludChkYXRhLmlkLCAxMCk7XG4gICAgICAgICAgICBhc3NldC5wcmVsb2FkID0gZGF0YS5wcmVsb2FkID8gZGF0YS5wcmVsb2FkIDogZmFsc2U7XG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGEgc2NyaXB0IGFzc2V0IGFuZCBoYXMgYWxyZWFkeSBiZWVuIGVtYmVkZGVkIGluIHRoZSBwYWdlIHRoZW5cbiAgICAgICAgICAgIC8vIG1hcmsgaXQgYXMgbG9hZGVkXG4gICAgICAgICAgICBhc3NldC5sb2FkZWQgPSBkYXRhLnR5cGUgPT09ICdzY3JpcHQnICYmIGRhdGEuZGF0YSAmJiBkYXRhLmRhdGEubG9hZGluZ1R5cGUgPiAwO1xuICAgICAgICAgICAgLy8gdGFnc1xuICAgICAgICAgICAgYXNzZXQudGFncy5hZGQoZGF0YS50YWdzKTtcbiAgICAgICAgICAgIC8vIGkxOG5cbiAgICAgICAgICAgIGlmIChkYXRhLmkxOG4pIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxvY2FsZSBpbiBkYXRhLmkxOG4pIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQuYWRkTG9jYWxpemVkQXNzZXRJZChsb2NhbGUsIGRhdGEuaTE4bltsb2NhbGVdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyByZWdpc3RyeVxuICAgICAgICAgICAgdGhpcy5hc3NldHMuYWRkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gLSBUaGUgbGlzdCBvZiBzY3JpcHRzIHRoYXQgYXJlIHJlZmVyZW5jZWQgYnkgdGhlIHNjZW5lLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFNjcmlwdFJlZmVyZW5jZXMoc2NlbmUpIHtcbiAgICAgICAgbGV0IHByaW9yaXR5U2NyaXB0cyA9IFtdO1xuICAgICAgICBpZiAoc2NlbmUuc2V0dGluZ3MucHJpb3JpdHlfc2NyaXB0cykge1xuICAgICAgICAgICAgcHJpb3JpdHlTY3JpcHRzID0gc2NlbmUuc2V0dGluZ3MucHJpb3JpdHlfc2NyaXB0cztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IF9zY3JpcHRzID0gW107XG4gICAgICAgIGNvbnN0IF9pbmRleCA9IHt9O1xuXG4gICAgICAgIC8vIGZpcnN0IGFkZCBwcmlvcml0eSBzY3JpcHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJpb3JpdHlTY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBfc2NyaXB0cy5wdXNoKHByaW9yaXR5U2NyaXB0c1tpXSk7XG4gICAgICAgICAgICBfaW5kZXhbcHJpb3JpdHlTY3JpcHRzW2ldXSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0aGVuIGl0ZXJhdGUgaGllcmFyY2h5IHRvIGdldCByZWZlcmVuY2VkIHNjcmlwdHNcbiAgICAgICAgY29uc3QgZW50aXRpZXMgPSBzY2VuZS5lbnRpdGllcztcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZW50aXRpZXMpIHtcbiAgICAgICAgICAgIGlmICghZW50aXRpZXNba2V5XS5jb21wb25lbnRzLnNjcmlwdCkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzY3JpcHRzID0gZW50aXRpZXNba2V5XS5jb21wb25lbnRzLnNjcmlwdC5zY3JpcHRzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKF9pbmRleFtzY3JpcHRzW2ldLnVybF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIF9zY3JpcHRzLnB1c2goc2NyaXB0c1tpXS51cmwpO1xuICAgICAgICAgICAgICAgIF9pbmRleFtzY3JpcHRzW2ldLnVybF0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9zY3JpcHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IHRoZSBhcHBsaWNhdGlvbi4gVGhpcyBmdW5jdGlvbiBkb2VzIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAxLiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ3N0YXJ0J1xuICAgICAqIDIuIENhbGxzIGluaXRpYWxpemUgZm9yIGFsbCBjb21wb25lbnRzIG9uIGVudGl0aWVzIGluIHRoZSBoaWVyYXJjaHlcbiAgICAgKiAzLiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ2luaXRpYWxpemUnXG4gICAgICogNC4gQ2FsbHMgcG9zdEluaXRpYWxpemUgZm9yIGFsbCBjb21wb25lbnRzIG9uIGVudGl0aWVzIGluIHRoZSBoaWVyYXJjaHlcbiAgICAgKiA1LiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ3Bvc3Rpbml0aWFsaXplJ1xuICAgICAqIDYuIFN0YXJ0cyBleGVjdXRpbmcgdGhlIG1haW4gbG9vcCBvZiB0aGUgYXBwbGljYXRpb25cbiAgICAgKlxuICAgICAqIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGludGVybmFsbHkgYnkgUGxheUNhbnZhcyBhcHBsaWNhdGlvbnMgbWFkZSBpbiB0aGUgRWRpdG9yIGJ1dCB5b3VcbiAgICAgKiB3aWxsIG5lZWQgdG8gY2FsbCBzdGFydCB5b3Vyc2VsZiBpZiB5b3UgYXJlIHVzaW5nIHRoZSBlbmdpbmUgc3RhbmQtYWxvbmUuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5zdGFydCgpO1xuICAgICAqL1xuICAgIHN0YXJ0KCkge1xuICAgICAgICB0aGlzLmZyYW1lID0gMDtcblxuICAgICAgICB0aGlzLmZpcmUoXCJzdGFydFwiLCB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5vdygpLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICghdGhpcy5fbGlicmFyaWVzTG9hZGVkKSB7XG4gICAgICAgICAgICB0aGlzLm9uTGlicmFyaWVzTG9hZGVkKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgnaW5pdGlhbGl6ZScsIHRoaXMucm9vdCk7XG4gICAgICAgIHRoaXMuZmlyZSgnaW5pdGlhbGl6ZScpO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdwb3N0SW5pdGlhbGl6ZScsIHRoaXMucm9vdCk7XG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdwb3N0UG9zdEluaXRpYWxpemUnLCB0aGlzLnJvb3QpO1xuICAgICAgICB0aGlzLmZpcmUoJ3Bvc3Rpbml0aWFsaXplJyk7XG5cbiAgICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIGFsbCBpbnB1dCBkZXZpY2VzIG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIHRpbWUgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCB1cGRhdGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBpbnB1dFVwZGF0ZShkdCkge1xuICAgICAgICBpZiAodGhpcy5jb250cm9sbGVyKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIudXBkYXRlKGR0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5tb3VzZSkge1xuICAgICAgICAgICAgdGhpcy5tb3VzZS51cGRhdGUoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5rZXlib2FyZCkge1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZC51cGRhdGUoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5nYW1lcGFkcykge1xuICAgICAgICAgICAgdGhpcy5nYW1lcGFkcy51cGRhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSB0aGUgYXBwbGljYXRpb24uIFRoaXMgZnVuY3Rpb24gd2lsbCBjYWxsIHRoZSB1cGRhdGUgZnVuY3Rpb25zIGFuZCB0aGVuIHRoZSBwb3N0VXBkYXRlXG4gICAgICogZnVuY3Rpb25zIG9mIGFsbCBlbmFibGVkIGNvbXBvbmVudHMuIEl0IHdpbGwgdGhlbiB1cGRhdGUgdGhlIGN1cnJlbnQgc3RhdGUgb2YgYWxsIGNvbm5lY3RlZFxuICAgICAqIGlucHV0IGRldmljZXMuIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGludGVybmFsbHkgaW4gdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wIGFuZCBkb2VzXG4gICAgICogbm90IG5lZWQgdG8gYmUgY2FsbGVkIGV4cGxpY2l0bHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgdGltZSBkZWx0YSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqL1xuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICB0aGlzLmZyYW1lKys7XG5cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS51cGRhdGVDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnVwZGF0ZVN0YXJ0ID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIFBlcmZvcm0gQ29tcG9uZW50U3lzdGVtIHVwZGF0ZVxuICAgICAgICBpZiAoc2NyaXB0LmxlZ2FjeSlcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdmaXhlZFVwZGF0ZScsIDEuMCAvIDYwLjApO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKHRoaXMuX2luVG9vbHMgPyAndG9vbHNVcGRhdGUnIDogJ3VwZGF0ZScsIGR0KTtcbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ2FuaW1hdGlvblVwZGF0ZScsIGR0KTtcbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ3Bvc3RVcGRhdGUnLCBkdCk7XG5cbiAgICAgICAgLy8gZmlyZSB1cGRhdGUgZXZlbnRcbiAgICAgICAgdGhpcy5maXJlKFwidXBkYXRlXCIsIGR0KTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5wdXQgZGV2aWNlc1xuICAgICAgICB0aGlzLmlucHV0VXBkYXRlKGR0KTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUudXBkYXRlVGltZSA9IG5vdygpIC0gdGhpcy5zdGF0cy5mcmFtZS51cGRhdGVTdGFydDtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHRoZSBhcHBsaWNhdGlvbidzIHNjZW5lLiBNb3JlIHNwZWNpZmljYWxseSwgdGhlIHNjZW5lJ3Mge0BsaW5rIExheWVyQ29tcG9zaXRpb259IGlzXG4gICAgICogcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGludGVybmFsbHkgaW4gdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wIGFuZCBkb2VzIG5vdFxuICAgICAqIG5lZWQgdG8gYmUgY2FsbGVkIGV4cGxpY2l0bHkuXG4gICAgICovXG4gICAgcmVuZGVyKCkge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUucmVuZGVyU3RhcnQgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgdGhpcy5maXJlKCdwcmVyZW5kZXInKTtcbiAgICAgICAgdGhpcy5yb290LnN5bmNIaWVyYXJjaHkoKTtcblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hlcikge1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlci51cGRhdGVBbGwoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgRm9yd2FyZFJlbmRlcmVyLl9za2lwUmVuZGVyQ291bnRlciA9IDA7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIHJlbmRlciB0aGUgc2NlbmUgY29tcG9zaXRpb25cbiAgICAgICAgdGhpcy5yZW5kZXJDb21wb3NpdGlvbih0aGlzLnNjZW5lLmxheWVycyk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdwb3N0cmVuZGVyJyk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnJlbmRlclRpbWUgPSBub3coKSAtIHRoaXMuc3RhdHMuZnJhbWUucmVuZGVyU3RhcnQ7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8vIHJlbmRlciBhIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgcmVuZGVyQ29tcG9zaXRpb24obGF5ZXJDb21wb3NpdGlvbikge1xuICAgICAgICB0aGlzLnJlbmRlcmVyLmJ1aWxkRnJhbWVHcmFwaCh0aGlzLmZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmZyYW1lR3JhcGgucmVuZGVyKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5vdyAtIFRoZSB0aW1lc3RhbXAgcGFzc2VkIHRvIHRoZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIHRpbWUgZGVsdGEgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS4gVGhpcyBpcyBzdWJqZWN0IHRvIHRoZVxuICAgICAqIGFwcGxpY2F0aW9uJ3MgdGltZSBzY2FsZSBhbmQgbWF4IGRlbHRhIHZhbHVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbXMgLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZmlsbEZyYW1lU3RhdHNCYXNpYyhub3csIGR0LCBtcykge1xuICAgICAgICAvLyBUaW1pbmcgc3RhdHNcbiAgICAgICAgY29uc3Qgc3RhdHMgPSB0aGlzLnN0YXRzLmZyYW1lO1xuICAgICAgICBzdGF0cy5kdCA9IGR0O1xuICAgICAgICBzdGF0cy5tcyA9IG1zO1xuICAgICAgICBpZiAobm93ID4gc3RhdHMuX3RpbWVUb0NvdW50RnJhbWVzKSB7XG4gICAgICAgICAgICBzdGF0cy5mcHMgPSBzdGF0cy5fZnBzQWNjdW07XG4gICAgICAgICAgICBzdGF0cy5fZnBzQWNjdW0gPSAwO1xuICAgICAgICAgICAgc3RhdHMuX3RpbWVUb0NvdW50RnJhbWVzID0gbm93ICsgMTAwMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRzLl9mcHNBY2N1bSsrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdG90YWwgZHJhdyBjYWxsXG4gICAgICAgIHRoaXMuc3RhdHMuZHJhd0NhbGxzLnRvdGFsID0gdGhpcy5ncmFwaGljc0RldmljZS5fZHJhd0NhbGxzUGVyRnJhbWU7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuX2RyYXdDYWxsc1BlckZyYW1lID0gMDtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZmlsbEZyYW1lU3RhdHMoKSB7XG4gICAgICAgIGxldCBzdGF0cyA9IHRoaXMuc3RhdHMuZnJhbWU7XG5cbiAgICAgICAgLy8gUmVuZGVyIHN0YXRzXG4gICAgICAgIHN0YXRzLmNhbWVyYXMgPSB0aGlzLnJlbmRlcmVyLl9jYW1lcmFzUmVuZGVyZWQ7XG4gICAgICAgIHN0YXRzLm1hdGVyaWFscyA9IHRoaXMucmVuZGVyZXIuX21hdGVyaWFsU3dpdGNoZXM7XG4gICAgICAgIHN0YXRzLnNoYWRlcnMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy5zaGFkb3dNYXBVcGRhdGVzID0gdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcztcbiAgICAgICAgc3RhdHMuc2hhZG93TWFwVGltZSA9IHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWU7XG4gICAgICAgIHN0YXRzLmRlcHRoTWFwVGltZSA9IHRoaXMucmVuZGVyZXIuX2RlcHRoTWFwVGltZTtcbiAgICAgICAgc3RhdHMuZm9yd2FyZFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZTtcbiAgICAgICAgY29uc3QgcHJpbXMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9wcmltc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy50cmlhbmdsZXMgPSBwcmltc1tQUklNSVRJVkVfVFJJQU5HTEVTXSAvIDMgK1xuICAgICAgICAgICAgTWF0aC5tYXgocHJpbXNbUFJJTUlUSVZFX1RSSVNUUklQXSAtIDIsIDApICtcbiAgICAgICAgICAgIE1hdGgubWF4KHByaW1zW1BSSU1JVElWRV9UUklGQU5dIC0gMiwgMCk7XG4gICAgICAgIHN0YXRzLmN1bGxUaW1lID0gdGhpcy5yZW5kZXJlci5fY3VsbFRpbWU7XG4gICAgICAgIHN0YXRzLnNvcnRUaW1lID0gdGhpcy5yZW5kZXJlci5fc29ydFRpbWU7XG4gICAgICAgIHN0YXRzLnNraW5UaW1lID0gdGhpcy5yZW5kZXJlci5fc2tpblRpbWU7XG4gICAgICAgIHN0YXRzLm1vcnBoVGltZSA9IHRoaXMucmVuZGVyZXIuX21vcnBoVGltZTtcbiAgICAgICAgc3RhdHMubGlnaHRDbHVzdGVycyA9IHRoaXMucmVuZGVyZXIuX2xpZ2h0Q2x1c3RlcnM7XG4gICAgICAgIHN0YXRzLmxpZ2h0Q2x1c3RlcnNUaW1lID0gdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVyc1RpbWU7XG4gICAgICAgIHN0YXRzLm90aGVyUHJpbWl0aXZlcyA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJpbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpIDwgUFJJTUlUSVZFX1RSSUFOR0xFUykge1xuICAgICAgICAgICAgICAgIHN0YXRzLm90aGVyUHJpbWl0aXZlcyArPSBwcmltc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByaW1zW2ldID0gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbmRlcmVyLl9jYW1lcmFzUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcyA9IDA7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9jdWxsVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVyc1RpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zb3J0VGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NraW5UaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbW9ycGhUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2RlcHRoTWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lID0gMDtcblxuICAgICAgICAvLyBEcmF3IGNhbGwgc3RhdHNcbiAgICAgICAgc3RhdHMgPSB0aGlzLnN0YXRzLmRyYXdDYWxscztcbiAgICAgICAgc3RhdHMuZm9yd2FyZCA9IHRoaXMucmVuZGVyZXIuX2ZvcndhcmREcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLmN1bGxlZCA9IHRoaXMucmVuZGVyZXIuX251bURyYXdDYWxsc0N1bGxlZDtcbiAgICAgICAgc3RhdHMuZGVwdGggPSAwO1xuICAgICAgICBzdGF0cy5zaGFkb3cgPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dEcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLnNraW5uZWQgPSB0aGlzLnJlbmRlcmVyLl9za2luRHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5pbW1lZGlhdGUgPSAwO1xuICAgICAgICBzdGF0cy5pbnN0YW5jZWQgPSAwO1xuICAgICAgICBzdGF0cy5yZW1vdmVkQnlJbnN0YW5jaW5nID0gMDtcbiAgICAgICAgc3RhdHMubWlzYyA9IHN0YXRzLnRvdGFsIC0gKHN0YXRzLmZvcndhcmQgKyBzdGF0cy5zaGFkb3cpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9kZXB0aERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd0RyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9udW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9za2luRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5faW1tZWRpYXRlUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9pbnN0YW5jZWREcmF3Q2FsbHMgPSAwO1xuXG4gICAgICAgIHRoaXMuc3RhdHMubWlzYy5yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLnJlbmRlclRhcmdldENyZWF0aW9uVGltZTtcblxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHMucGFydGljbGVzO1xuICAgICAgICBzdGF0cy51cGRhdGVzUGVyRnJhbWUgPSBzdGF0cy5fdXBkYXRlc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy5mcmFtZVRpbWUgPSBzdGF0cy5fZnJhbWVUaW1lO1xuICAgICAgICBzdGF0cy5fdXBkYXRlc1BlckZyYW1lID0gMDtcbiAgICAgICAgc3RhdHMuX2ZyYW1lVGltZSA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgaG93IHRoZSBjYW52YXMgZmlsbHMgdGhlIHdpbmRvdyBhbmQgcmVzaXplcyB3aGVuIHRoZSB3aW5kb3cgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIC0gVGhlIG1vZGUgdG8gdXNlIHdoZW4gc2V0dGluZyB0aGUgc2l6ZSBvZiB0aGUgY2FudmFzLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9OT05FfTogdGhlIGNhbnZhcyB3aWxsIGFsd2F5cyBtYXRjaCB0aGUgc2l6ZSBwcm92aWRlZC5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9GSUxMX1dJTkRPV306IHRoZSBjYW52YXMgd2lsbCBzaW1wbHkgZmlsbCB0aGUgd2luZG93LCBjaGFuZ2luZyBhc3BlY3QgcmF0aW8uXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfS0VFUF9BU1BFQ1R9OiB0aGUgY2FudmFzIHdpbGwgZ3JvdyB0byBmaWxsIHRoZSB3aW5kb3cgYXMgYmVzdCBpdCBjYW4gd2hpbGVcbiAgICAgKiBtYWludGFpbmluZyB0aGUgYXNwZWN0IHJhdGlvLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIGNhbnZhcyAob25seSB1c2VkIHdoZW4gbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0pLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyAob25seSB1c2VkIHdoZW4gbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0pLlxuICAgICAqL1xuICAgIHNldENhbnZhc0ZpbGxNb2RlKG1vZGUsIHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgdGhpcy5fZmlsbE1vZGUgPSBtb2RlO1xuICAgICAgICB0aGlzLnJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGFuZ2UgdGhlIHJlc29sdXRpb24gb2YgdGhlIGNhbnZhcywgYW5kIHNldCB0aGUgd2F5IGl0IGJlaGF2ZXMgd2hlbiB0aGUgd2luZG93IGlzIHJlc2l6ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSAtIFRoZSBtb2RlIHRvIHVzZSB3aGVuIHNldHRpbmcgdGhlIHJlc29sdXRpb24uIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fQVVUT306IGlmIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG5vdCBwcm92aWRlZCwgY2FudmFzIHdpbGwgYmUgcmVzaXplZCB0b1xuICAgICAqIG1hdGNoIGNhbnZhcyBjbGllbnQgc2l6ZS5cbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0ZJWEVEfTogcmVzb2x1dGlvbiBvZiBjYW52YXMgd2lsbCBiZSBmaXhlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2lkdGhdIC0gVGhlIGhvcml6b250YWwgcmVzb2x1dGlvbiwgb3B0aW9uYWwgaW4gQVVUTyBtb2RlLCBpZiBub3QgcHJvdmlkZWRcbiAgICAgKiBjYW52YXMgY2xpZW50V2lkdGggaXMgdXNlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgdmVydGljYWwgcmVzb2x1dGlvbiwgb3B0aW9uYWwgaW4gQVVUTyBtb2RlLCBpZiBub3QgcHJvdmlkZWRcbiAgICAgKiBjYW52YXMgY2xpZW50SGVpZ2h0IGlzIHVzZWQuXG4gICAgICovXG4gICAgc2V0Q2FudmFzUmVzb2x1dGlvbihtb2RlLCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuX3Jlc29sdXRpb25Nb2RlID0gbW9kZTtcblxuICAgICAgICAvLyBJbiBBVVRPIG1vZGUgdGhlIHJlc29sdXRpb24gaXMgdGhlIHNhbWUgYXMgdGhlIGNhbnZhcyBzaXplLCB1bmxlc3Mgc3BlY2lmaWVkXG4gICAgICAgIGlmIChtb2RlID09PSBSRVNPTFVUSU9OX0FVVE8gJiYgKHdpZHRoID09PSB1bmRlZmluZWQpKSB7XG4gICAgICAgICAgICB3aWR0aCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLmNsaWVudFdpZHRoO1xuICAgICAgICAgICAgaGVpZ2h0ID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuY2xpZW50SGVpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5yZXNpemVDYW52YXMod2lkdGgsIGhlaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgd2luZG93IG9yIHRhYiBpbiB3aGljaCB0aGUgYXBwbGljYXRpb24gaXMgcnVubmluZy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBhcHBsaWNhdGlvbiBpcyBub3QgdmlzaWJsZSBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGlzSGlkZGVuKCkge1xuICAgICAgICByZXR1cm4gZG9jdW1lbnRbdGhpcy5faGlkZGVuQXR0cl07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIHZpc2liaWxpdHkgc3RhdGUgb2YgdGhlIGN1cnJlbnQgdGFiL3dpbmRvdyBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblZpc2liaWxpdHlDaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmlzSGlkZGVuKCkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIuc3VzcGVuZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NvdW5kTWFuYWdlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5yZXN1bWUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2l6ZSB0aGUgYXBwbGljYXRpb24ncyBjYW52YXMgZWxlbWVudCBpbiBsaW5lIHdpdGggdGhlIGN1cnJlbnQgZmlsbCBtb2RlLlxuICAgICAqXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfS0VFUF9BU1BFQ1R9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0XG4gICAgICogY2FuIHdoaWxlIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfRklMTF9XSU5ET1d9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBzaW1wbHkgZmlsbCB0aGUgd2luZG93LCBjaGFuZ2luZ1xuICAgICAqIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIEluIHtAbGluayBGSUxMTU9ERV9OT05FfSBtb2RlLCB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIGNhbnZhcy4gT25seSB1c2VkIGlmIGN1cnJlbnQgZmlsbCBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgaGVpZ2h0IG9mIHRoZSBjYW52YXMuIE9ubHkgdXNlZCBpZiBjdXJyZW50IGZpbGwgbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0uXG4gICAgICogQHJldHVybnMge29iamVjdH0gQSBvYmplY3QgY29udGFpbmluZyB0aGUgdmFsdWVzIGNhbGN1bGF0ZWQgdG8gdXNlIGFzIHdpZHRoIGFuZCBoZWlnaHQuXG4gICAgICovXG4gICAgcmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbGxvd1Jlc2l6ZSkgcmV0dXJuIHVuZGVmaW5lZDsgLy8gcHJldmVudCByZXNpemluZyAoZS5nLiBpZiBwcmVzZW50aW5nIGluIFZSIEhNRClcblxuICAgICAgICAvLyBwcmV2ZW50IHJlc2l6aW5nIHdoZW4gaW4gWFIgc2Vzc2lvblxuICAgICAgICBpZiAodGhpcy54ciAmJiB0aGlzLnhyLnNlc3Npb24pXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICAgIGNvbnN0IHdpbmRvd1dpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcblxuICAgICAgICBpZiAodGhpcy5fZmlsbE1vZGUgPT09IEZJTExNT0RFX0tFRVBfQVNQRUNUKSB7XG4gICAgICAgICAgICBjb25zdCByID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMud2lkdGggLyB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5oZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCB3aW5SID0gd2luZG93V2lkdGggLyB3aW5kb3dIZWlnaHQ7XG5cbiAgICAgICAgICAgIGlmIChyID4gd2luUikge1xuICAgICAgICAgICAgICAgIHdpZHRoID0gd2luZG93V2lkdGg7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gd2lkdGggLyByO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSB3aW5kb3dIZWlnaHQ7XG4gICAgICAgICAgICAgICAgd2lkdGggPSBoZWlnaHQgKiByO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2ZpbGxNb2RlID09PSBGSUxMTU9ERV9GSUxMX1dJTkRPVykge1xuICAgICAgICAgICAgd2lkdGggPSB3aW5kb3dXaWR0aDtcbiAgICAgICAgICAgIGhlaWdodCA9IHdpbmRvd0hlaWdodDtcbiAgICAgICAgfVxuICAgICAgICAvLyBPVEhFUldJU0U6IEZJTExNT0RFX05PTkUgdXNlIHdpZHRoIGFuZCBoZWlnaHQgdGhhdCBhcmUgcHJvdmlkZWRcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5zdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcblxuICAgICAgICB0aGlzLnVwZGF0ZUNhbnZhc1NpemUoKTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIGZpbmFsIHZhbHVlcyBjYWxjdWxhdGVkIGZvciB3aWR0aCBhbmQgaGVpZ2h0XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIHtAbGluayBHcmFwaGljc0RldmljZX0gY2FudmFzIHNpemUgdG8gbWF0Y2ggdGhlIGNhbnZhcyBzaXplIG9uIHRoZSBkb2N1bWVudFxuICAgICAqIHBhZ2UuIEl0IGlzIHJlY29tbWVuZGVkIHRvIGNhbGwgdGhpcyBmdW5jdGlvbiB3aGVuIHRoZSBjYW52YXMgc2l6ZSBjaGFuZ2VzIChlLmcgb24gd2luZG93XG4gICAgICogcmVzaXplIGFuZCBvcmllbnRhdGlvbiBjaGFuZ2UgZXZlbnRzKSBzbyB0aGF0IHRoZSBjYW52YXMgcmVzb2x1dGlvbiBpcyBpbW1lZGlhdGVseSB1cGRhdGVkLlxuICAgICAqL1xuICAgIHVwZGF0ZUNhbnZhc1NpemUoKSB7XG4gICAgICAgIC8vIERvbid0IHVwZGF0ZSBpZiB3ZSBhcmUgaW4gVlIgb3IgWFJcbiAgICAgICAgaWYgKCghdGhpcy5fYWxsb3dSZXNpemUpIHx8ICh0aGlzLnhyPy5hY3RpdmUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbiBBVVRPIG1vZGUgdGhlIHJlc29sdXRpb24gaXMgY2hhbmdlZCB0byBtYXRjaCB0aGUgY2FudmFzIHNpemVcbiAgICAgICAgaWYgKHRoaXMuX3Jlc29sdXRpb25Nb2RlID09PSBSRVNPTFVUSU9OX0FVVE8pIHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBjYW52YXMgRE9NIGhhcyBjaGFuZ2VkIHNpemVcbiAgICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzO1xuICAgICAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5yZXNpemVDYW52YXMoY2FudmFzLmNsaWVudFdpZHRoLCBjYW52YXMuY2xpZW50SGVpZ2h0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV2ZW50IGhhbmRsZXIgY2FsbGVkIHdoZW4gYWxsIGNvZGUgbGlicmFyaWVzIGhhdmUgYmVlbiBsb2FkZWQuIENvZGUgbGlicmFyaWVzIGFyZSBwYXNzZWRcbiAgICAgKiBpbnRvIHRoZSBjb25zdHJ1Y3RvciBvZiB0aGUgQXBwbGljYXRpb24gYW5kIHRoZSBhcHBsaWNhdGlvbiB3b24ndCBzdGFydCBydW5uaW5nIG9yIGxvYWRcbiAgICAgKiBwYWNrcyB1bnRpbCBhbGwgbGlicmFyaWVzIGhhdmUgYmVlbiBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGlicmFyaWVzTG9hZGVkKCkge1xuICAgICAgICB0aGlzLl9saWJyYXJpZXNMb2FkZWQgPSB0cnVlO1xuXG4gICAgICAgIGlmICh0aGlzLnN5c3RlbXMucmlnaWRib2R5KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMucmlnaWRib2R5Lm9uTGlicmFyeUxvYWRlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgc2NlbmUgc2V0dGluZ3MgdG8gdGhlIGN1cnJlbnQgc2NlbmUuIFVzZWZ1bCB3aGVuIHlvdXIgc2NlbmUgc2V0dGluZ3MgYXJlIHBhcnNlZCBvclxuICAgICAqIGdlbmVyYXRlZCBmcm9tIGEgbm9uLVVSTCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2V0dGluZ3MgLSBUaGUgc2NlbmUgc2V0dGluZ3MgdG8gYmUgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2V0dGluZ3MucGh5c2ljcyAtIFRoZSBwaHlzaWNzIHNldHRpbmdzIHRvIGJlIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucGh5c2ljcy5ncmF2aXR5IC0gVGhlIHdvcmxkIHNwYWNlIHZlY3RvciByZXByZXNlbnRpbmcgZ2xvYmFsXG4gICAgICogZ3Jhdml0eSBpbiB0aGUgcGh5c2ljcyBzaW11bGF0aW9uLiBNdXN0IGJlIGEgZml4ZWQgc2l6ZSBhcnJheSB3aXRoIHRocmVlIG51bWJlciBlbGVtZW50cyxcbiAgICAgKiBjb3JyZXNwb25kaW5nIHRvIGVhY2ggYXhpcyBbIFgsIFksIFogXS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2V0dGluZ3MucmVuZGVyIC0gVGhlIHJlbmRlcmluZyBzZXR0aW5ncyB0byBiZSBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnJlbmRlci5nbG9iYWxfYW1iaWVudCAtIFRoZSBjb2xvciBvZiB0aGUgc2NlbmUncyBhbWJpZW50IGxpZ2h0LlxuICAgICAqIE11c3QgYmUgYSBmaXhlZCBzaXplIGFycmF5IHdpdGggdGhyZWUgbnVtYmVyIGVsZW1lbnRzLCBjb3JyZXNwb25kaW5nIHRvIGVhY2ggY29sb3IgY2hhbm5lbFxuICAgICAqIFsgUiwgRywgQiBdLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZXR0aW5ncy5yZW5kZXIuZm9nIC0gVGhlIHR5cGUgb2YgZm9nIHVzZWQgYnkgdGhlIHNjZW5lLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGT0dfTk9ORX1cbiAgICAgKiAtIHtAbGluayBGT0dfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIEZPR19FWFB9XG4gICAgICogLSB7QGxpbmsgRk9HX0VYUDJ9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5yZW5kZXIuZm9nX2NvbG9yIC0gVGhlIGNvbG9yIG9mIHRoZSBmb2cgKGlmIGVuYWJsZWQpLiBNdXN0IGJlIGFcbiAgICAgKiBmaXhlZCBzaXplIGFycmF5IHdpdGggdGhyZWUgbnVtYmVyIGVsZW1lbnRzLCBjb3JyZXNwb25kaW5nIHRvIGVhY2ggY29sb3IgY2hhbm5lbCBbIFIsIEcsIEIgXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmZvZ19kZW5zaXR5IC0gVGhlIGRlbnNpdHkgb2YgdGhlIGZvZyAoaWYgZW5hYmxlZCkuIFRoaXNcbiAgICAgKiBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfRVhQfSBvciB7QGxpbmsgRk9HX0VYUDJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZm9nX3N0YXJ0IC0gVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCB3aGVyZSBsaW5lYXIgZm9nXG4gICAgICogYmVnaW5zLiBUaGlzIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZm9nX2VuZCAtIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgd2hlcmUgbGluZWFyIGZvZ1xuICAgICAqIHJlYWNoZXMgaXRzIG1heGltdW0uIFRoaXMgcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5nYW1tYV9jb3JyZWN0aW9uIC0gVGhlIGdhbW1hIGNvcnJlY3Rpb24gdG8gYXBwbHkgd2hlblxuICAgICAqIHJlbmRlcmluZyB0aGUgc2NlbmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEdBTU1BX05PTkV9XG4gICAgICogLSB7QGxpbmsgR0FNTUFfU1JHQn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIudG9uZW1hcHBpbmcgLSBUaGUgdG9uZW1hcHBpbmcgdHJhbnNmb3JtIHRvIGFwcGx5IHdoZW5cbiAgICAgKiB3cml0aW5nIGZyYWdtZW50cyB0byB0aGUgZnJhbWUgYnVmZmVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0ZJTE1JQ31cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0hFSkx9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9BQ0VTfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5leHBvc3VyZSAtIFRoZSBleHBvc3VyZSB2YWx1ZSB0d2Vha3MgdGhlIG92ZXJhbGwgYnJpZ2h0bmVzc1xuICAgICAqIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxudWxsfSBbc2V0dGluZ3MucmVuZGVyLnNreWJveF0gLSBUaGUgYXNzZXQgSUQgb2YgdGhlIGN1YmUgbWFwIHRleHR1cmUgdG8gYmVcbiAgICAgKiB1c2VkIGFzIHRoZSBzY2VuZSdzIHNreWJveC4gRGVmYXVsdHMgdG8gbnVsbC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnNreWJveEludGVuc2l0eSAtIE11bHRpcGxpZXIgZm9yIHNreWJveCBpbnRlbnNpdHkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5za3lib3hMdW1pbmFuY2UgLSBMdXggKGxtL21eMikgdmFsdWUgZm9yIHNreWJveCBpbnRlbnNpdHkgd2hlbiBwaHlzaWNhbCBsaWdodCB1bml0cyBhcmUgZW5hYmxlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnNreWJveE1pcCAtIFRoZSBtaXAgbGV2ZWwgb2YgdGhlIHNreWJveCB0byBiZSBkaXNwbGF5ZWQuXG4gICAgICogT25seSB2YWxpZCBmb3IgcHJlZmlsdGVyZWQgY3ViZW1hcCBza3lib3hlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94Um90YXRpb24gLSBSb3RhdGlvbiBvZiBza3lib3guXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodG1hcFNpemVNdWx0aXBsaWVyIC0gVGhlIGxpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbiAtIFRoZSBtYXhpbXVtIGxpZ2h0bWFwIHJlc29sdXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodG1hcE1vZGUgLSBUaGUgbGlnaHRtYXAgYmFraW5nIG1vZGUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1J9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXBcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SRElSfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwICsgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uICh1c2VkIGZvciBidW1wL3NwZWN1bGFyKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2UgLSBFbmFibGUgYmFraW5nIGFtYmllbnQgbGlnaHQgaW50byBsaWdodG1hcHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZU51bVNhbXBsZXMgLSBOdW1iZXIgb2Ygc2FtcGxlcyB0byB1c2Ugd2hlbiBiYWtpbmcgYW1iaWVudCBsaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlU3BoZXJlUGFydCAtIEhvdyBtdWNoIG9mIHRoZSBzcGhlcmUgdG8gaW5jbHVkZSB3aGVuIGJha2luZyBhbWJpZW50IGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzIC0gQnJpZ2huZXNzIG9mIHRoZSBiYWtlZCBhbWJpZW50IG9jY2x1c2lvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QgLSBDb250cmFzdCBvZiB0aGUgYmFrZWQgYW1iaWVudCBvY2NsdXNpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50THVtaW5hbmNlIC0gTHV4IChsbS9tXjIpIHZhbHVlIGZvciBhbWJpZW50IGxpZ2h0IGludGVuc2l0eS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAtIEVuYWJsZSBjbHVzdGVyZWQgbGlnaHRpbmcuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdTaGFkb3dzRW5hYmxlZCAtIElmIHNldCB0byB0cnVlLCB0aGUgY2x1c3RlcmVkIGxpZ2h0aW5nIHdpbGwgc3VwcG9ydCBzaGFkb3dzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQ29va2llc0VuYWJsZWQgLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgY29va2llIHRleHR1cmVzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQgLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgYXJlYSBsaWdodHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ1NoYWRvd0F0bGFzUmVzb2x1dGlvbiAtIFJlc29sdXRpb24gb2YgdGhlIGF0bGFzIHRleHR1cmUgc3RvcmluZyBhbGwgbm9uLWRpcmVjdGlvbmFsIHNoYWRvdyB0ZXh0dXJlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQ29va2llQXRsYXNSZXNvbHV0aW9uIC0gUmVzb2x1dGlvbiBvZiB0aGUgYXRsYXMgdGV4dHVyZSBzdG9yaW5nIGFsbCBub24tZGlyZWN0aW9uYWwgY29va2llIHRleHR1cmVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdNYXhMaWdodHNQZXJDZWxsIC0gTWF4aW11bSBudW1iZXIgb2YgbGlnaHRzIGEgY2VsbCBjYW4gc3RvcmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ1NoYWRvd1R5cGUgLSBUaGUgdHlwZSBvZiBzaGFkb3cgZmlsdGVyaW5nIHVzZWQgYnkgYWxsIHNoYWRvd3MuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNIQURPV19QQ0YxfTogUENGIDF4MSBzYW1wbGluZy5cbiAgICAgKiAtIHtAbGluayBTSEFET1dfUENGM306IFBDRiAzeDMgc2FtcGxpbmcuXG4gICAgICogLSB7QGxpbmsgU0hBRE9XX1BDRjV9OiBQQ0YgNXg1IHNhbXBsaW5nLiBGYWxscyBiYWNrIHRvIHtAbGluayBTSEFET1dfUENGM30gb24gV2ViR0wgMS4wLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdDZWxscyAtIE51bWJlciBvZiBjZWxscyBhbG9uZyBlYWNoIHdvcmxkLXNwYWNlIGF4aXMgdGhlIHNwYWNlIGNvbnRhaW5pbmcgbGlnaHRzXG4gICAgICogaXMgc3ViZGl2aWRlZCBpbnRvLlxuICAgICAqXG4gICAgICogT25seSBsaWdodHMgd2l0aCBiYWtlRGlyPXRydWUgd2lsbCBiZSB1c2VkIGZvciBnZW5lcmF0aW5nIHRoZSBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBzZXR0aW5ncyA9IHtcbiAgICAgKiAgICAgcGh5c2ljczoge1xuICAgICAqICAgICAgICAgZ3Jhdml0eTogWzAsIC05LjgsIDBdXG4gICAgICogICAgIH0sXG4gICAgICogICAgIHJlbmRlcjoge1xuICAgICAqICAgICAgICAgZm9nX2VuZDogMTAwMCxcbiAgICAgKiAgICAgICAgIHRvbmVtYXBwaW5nOiAwLFxuICAgICAqICAgICAgICAgc2t5Ym94OiBudWxsLFxuICAgICAqICAgICAgICAgZm9nX2RlbnNpdHk6IDAuMDEsXG4gICAgICogICAgICAgICBnYW1tYV9jb3JyZWN0aW9uOiAxLFxuICAgICAqICAgICAgICAgZXhwb3N1cmU6IDEsXG4gICAgICogICAgICAgICBmb2dfc3RhcnQ6IDEsXG4gICAgICogICAgICAgICBnbG9iYWxfYW1iaWVudDogWzAsIDAsIDBdLFxuICAgICAqICAgICAgICAgc2t5Ym94SW50ZW5zaXR5OiAxLFxuICAgICAqICAgICAgICAgc2t5Ym94Um90YXRpb246IFswLCAwLCAwXSxcbiAgICAgKiAgICAgICAgIGZvZ19jb2xvcjogWzAsIDAsIDBdLFxuICAgICAqICAgICAgICAgbGlnaHRtYXBNb2RlOiAxLFxuICAgICAqICAgICAgICAgZm9nOiAnbm9uZScsXG4gICAgICogICAgICAgICBsaWdodG1hcE1heFJlc29sdXRpb246IDIwNDgsXG4gICAgICogICAgICAgICBza3lib3hNaXA6IDIsXG4gICAgICogICAgICAgICBsaWdodG1hcFNpemVNdWx0aXBsaWVyOiAxNlxuICAgICAqICAgICB9XG4gICAgICogfTtcbiAgICAgKiBhcHAuYXBwbHlTY2VuZVNldHRpbmdzKHNldHRpbmdzKTtcbiAgICAgKi9cbiAgICBhcHBseVNjZW5lU2V0dGluZ3Moc2V0dGluZ3MpIHtcbiAgICAgICAgbGV0IGFzc2V0O1xuXG4gICAgICAgIGlmICh0aGlzLnN5c3RlbXMucmlnaWRib2R5ICYmIHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29uc3QgZ3Jhdml0eSA9IHNldHRpbmdzLnBoeXNpY3MuZ3Jhdml0eTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5yaWdpZGJvZHkuZ3Jhdml0eS5zZXQoZ3Jhdml0eVswXSwgZ3Jhdml0eVsxXSwgZ3Jhdml0eVsyXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNjZW5lLmFwcGx5U2V0dGluZ3Moc2V0dGluZ3MpO1xuXG4gICAgICAgIGlmIChzZXR0aW5ncy5yZW5kZXIuaGFzT3duUHJvcGVydHkoJ3NreWJveCcpKSB7XG4gICAgICAgICAgICBpZiAoc2V0dGluZ3MucmVuZGVyLnNreWJveCkge1xuICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5hc3NldHMuZ2V0KHNldHRpbmdzLnJlbmRlci5za3lib3gpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0U2t5Ym94KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vbmNlKCdhZGQ6JyArIHNldHRpbmdzLnJlbmRlci5za3lib3gsIHRoaXMuc2V0U2t5Ym94LCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U2t5Ym94KG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgYXJlYSBsaWdodCBMVVQgdGFibGVzIGZvciB0aGlzIGFwcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGx0Y01hdDEgLSBMVVQgdGFibGUgb2YgdHlwZSBgYXJyYXlgIHRvIGJlIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBsdGNNYXQyIC0gTFVUIHRhYmxlIG9mIHR5cGUgYGFycmF5YCB0byBiZSBzZXQuXG4gICAgICovXG4gICAgc2V0QXJlYUxpZ2h0THV0cyhsdGNNYXQxLCBsdGNNYXQyKSB7XG5cbiAgICAgICAgaWYgKGx0Y01hdDEgJiYgbHRjTWF0Mikge1xuICAgICAgICAgICAgQXJlYUxpZ2h0THV0cy5zZXQodGhpcy5ncmFwaGljc0RldmljZSwgbHRjTWF0MSwgbHRjTWF0Mik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKFwic2V0QXJlYUxpZ2h0THV0czogTFVUcyBmb3IgYXJlYSBsaWdodCBhcmUgbm90IHZhbGlkXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc2t5Ym94IGFzc2V0IHRvIGN1cnJlbnQgc2NlbmUsIGFuZCBzdWJzY3JpYmVzIHRvIGFzc2V0IGxvYWQvY2hhbmdlIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gQXNzZXQgb2YgdHlwZSBgc2t5Ym94YCB0byBiZSBzZXQgdG8sIG9yIG51bGwgdG8gcmVtb3ZlIHNreWJveC5cbiAgICAgKi9cbiAgICBzZXRTa3lib3goYXNzZXQpIHtcbiAgICAgICAgaWYgKGFzc2V0ICE9PSB0aGlzLl9za3lib3hBc3NldCkge1xuICAgICAgICAgICAgY29uc3Qgb25Ta3lib3hSZW1vdmVkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U2t5Ym94KG51bGwpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3Qgb25Ta3lib3hDaGFuZ2VkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc2NlbmUuc2V0U2t5Ym94KHRoaXMuX3NreWJveEFzc2V0ID8gdGhpcy5fc2t5Ym94QXNzZXQucmVzb3VyY2VzIDogbnVsbCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBjbGVhbnVwIHByZXZpb3VzIGFzc2V0XG4gICAgICAgICAgICBpZiAodGhpcy5fc2t5Ym94QXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vZmYoJ2xvYWQ6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9mZigncmVtb3ZlOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldC5vZmYoJ2NoYW5nZScsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBuZXcgYXNzZXRcbiAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0ID0gYXNzZXQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2t5Ym94QXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vbignbG9hZDonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub25jZSgncmVtb3ZlOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldC5vbignY2hhbmdlJywgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjZW5lLnNreWJveE1pcCA9PT0gMCAmJiAhdGhpcy5fc2t5Ym94QXNzZXQubG9hZEZhY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0LmxvYWRGYWNlcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMubG9hZCh0aGlzLl9za3lib3hBc3NldCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG9uU2t5Ym94Q2hhbmdlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZpcnN0QmFrZSgpIHtcbiAgICAgICAgdGhpcy5saWdodG1hcHBlcj8uYmFrZShudWxsLCB0aGlzLnNjZW5lLmxpZ2h0bWFwTW9kZSk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZpcnN0QmF0Y2goKSB7XG4gICAgICAgIHRoaXMuYmF0Y2hlcj8uZ2VuZXJhdGUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlIGFuIG9wcG9ydHVuaXR5IHRvIG1vZGlmeSB0aGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdGltZXN0YW1wXSAtIFRoZSB0aW1lc3RhbXAgc3VwcGxpZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ8dW5kZWZpbmVkfSBUaGUgbW9kaWZpZWQgdGltZXN0YW1wLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfcHJvY2Vzc1RpbWVzdGFtcCh0aW1lc3RhbXApIHtcbiAgICAgICAgcmV0dXJuIHRpbWVzdGFtcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHNpbmdsZSBsaW5lLiBMaW5lIHN0YXJ0IGFuZCBlbmQgY29vcmRpbmF0ZXMgYXJlIHNwZWNpZmllZCBpbiB3b3JsZC1zcGFjZS4gVGhlIGxpbmVcbiAgICAgKiB3aWxsIGJlIGZsYXQtc2hhZGVkIHdpdGggdGhlIHNwZWNpZmllZCBjb2xvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc3RhcnQgLSBUaGUgc3RhcnQgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBvZiB0aGUgbGluZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSBlbmQgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBvZiB0aGUgbGluZS5cbiAgICAgKiBAcGFyYW0ge0NvbG9yfSBbY29sb3JdIC0gVGhlIGNvbG9yIG9mIHRoZSBsaW5lLiBJdCBkZWZhdWx0cyB0byB3aGl0ZSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIGxpbmUgaXMgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBsaW5lIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSAxLXVuaXQgbG9uZyB3aGl0ZSBsaW5lXG4gICAgICogdmFyIHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3TGluZShzdGFydCwgZW5kKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIDEtdW5pdCBsb25nIHJlZCBsaW5lIHdoaWNoIGlzIG5vdCBkZXB0aCB0ZXN0ZWQgYW5kIHJlbmRlcnMgb24gdG9wIG9mIG90aGVyIGdlb21ldHJ5XG4gICAgICogdmFyIHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3TGluZShzdGFydCwgZW5kLCBwYy5Db2xvci5SRUQsIGZhbHNlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIDEtdW5pdCBsb25nIHdoaXRlIGxpbmUgaW50byB0aGUgd29ybGQgbGF5ZXJcbiAgICAgKiB2YXIgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiB2YXIgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogdmFyIHdvcmxkTGF5ZXIgPSBhcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChwYy5MQVlFUklEX1dPUkxEKTtcbiAgICAgKiBhcHAuZHJhd0xpbmUoc3RhcnQsIGVuZCwgcGMuQ29sb3IuV0hJVEUsIHRydWUsIHdvcmxkTGF5ZXIpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lKHN0YXJ0LCBlbmQsIGNvbG9yLCBkZXB0aFRlc3QsIGxheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuZHJhd0xpbmUoc3RhcnQsIGVuZCwgY29sb3IsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gYXJiaXRyYXJ5IG51bWJlciBvZiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzLiBUaGUgbGluZXMgYXJlIG5vdCBjb25uZWN0ZWQgYnkgZWFjaFxuICAgICAqIHN1YnNlcXVlbnQgcG9pbnQgaW4gdGhlIGFycmF5LiBJbnN0ZWFkLCB0aGV5IGFyZSBpbmRpdmlkdWFsIHNlZ21lbnRzIHNwZWNpZmllZCBieSB0d29cbiAgICAgKiBwb2ludHMuIFRoZXJlZm9yZSwgdGhlIGxlbmd0aHMgb2YgdGhlIHN1cHBsaWVkIHBvc2l0aW9uIGFuZCBjb2xvciBhcnJheXMgbXVzdCBiZSB0aGUgc2FtZVxuICAgICAqIGFuZCBhbHNvIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAyLiBUaGUgY29sb3JzIG9mIHRoZSBlbmRzIG9mIGVhY2ggbGluZSBzZWdtZW50IHdpbGwgYmVcbiAgICAgKiBpbnRlcnBvbGF0ZWQgYWxvbmcgdGhlIGxlbmd0aCBvZiBlYWNoIGxpbmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzNbXX0gcG9zaXRpb25zIC0gQW4gYXJyYXkgb2YgcG9pbnRzIHRvIGRyYXcgbGluZXMgYmV0d2Vlbi4gVGhlIGxlbmd0aCBvZiB0aGVcbiAgICAgKiBhcnJheSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMi5cbiAgICAgKiBAcGFyYW0ge0NvbG9yW119IGNvbG9ycyAtIEFuIGFycmF5IG9mIGNvbG9ycyB0byBjb2xvciB0aGUgbGluZXMuIFRoaXMgbXVzdCBiZSB0aGUgc2FtZVxuICAgICAqIGxlbmd0aCBhcyB0aGUgcG9zaXRpb24gYXJyYXkuIFRoZSBsZW5ndGggb2YgdGhlIGFycmF5IG11c3QgYWxzbyBiZSBhIG11bHRpcGxlIG9mIDIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbGluZXMgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIHNpbmdsZSBsaW5lLCB3aXRoIHVuaXF1ZSBjb2xvcnMgZm9yIGVhY2ggcG9pbnRcbiAgICAgKiB2YXIgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiB2YXIgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogYXBwLmRyYXdMaW5lcyhbc3RhcnQsIGVuZF0sIFtwYy5Db2xvci5SRUQsIHBjLkNvbG9yLldISVRFXSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgMiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzXG4gICAgICogdmFyIHBvaW50cyA9IFtcbiAgICAgKiAgICAgLy8gTGluZSAxXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDAsIDAsIDApLFxuICAgICAqICAgICBuZXcgcGMuVmVjMygxLCAwLCAwKSxcbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDEsIDEsIDApLFxuICAgICAqICAgICBuZXcgcGMuVmVjMygxLCAxLCAxKVxuICAgICAqIF07XG4gICAgICogdmFyIGNvbG9ycyA9IFtcbiAgICAgKiAgICAgLy8gTGluZSAxXG4gICAgICogICAgIHBjLkNvbG9yLlJFRCxcbiAgICAgKiAgICAgcGMuQ29sb3IuWUVMTE9XLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgcGMuQ29sb3IuQ1lBTixcbiAgICAgKiAgICAgcGMuQ29sb3IuQkxVRVxuICAgICAqIF07XG4gICAgICogYXBwLmRyYXdMaW5lcyhwb2ludHMsIGNvbG9ycyk7XG4gICAgICovXG4gICAgZHJhd0xpbmVzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmRyYXdMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVycyBhbiBhcmJpdHJhcnkgbnVtYmVyIG9mIGRpc2NyZXRlIGxpbmUgc2VnbWVudHMuIFRoZSBsaW5lcyBhcmUgbm90IGNvbm5lY3RlZCBieSBlYWNoXG4gICAgICogc3Vic2VxdWVudCBwb2ludCBpbiB0aGUgYXJyYXkuIEluc3RlYWQsIHRoZXkgYXJlIGluZGl2aWR1YWwgc2VnbWVudHMgc3BlY2lmaWVkIGJ5IHR3b1xuICAgICAqIHBvaW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIHBvaW50cyB0byBkcmF3IGxpbmVzIGJldHdlZW4uIEVhY2ggcG9pbnQgaXNcbiAgICAgKiByZXByZXNlbnRlZCBieSAzIG51bWJlcnMgLSB4LCB5IGFuZCB6IGNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gY29sb3JzIC0gQW4gYXJyYXkgb2YgY29sb3JzIHRvIGNvbG9yIHRoZSBsaW5lcy4gVGhpcyBtdXN0IGJlIHRoZSBzYW1lXG4gICAgICogbGVuZ3RoIGFzIHRoZSBwb3NpdGlvbiBhcnJheS4gVGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgbXVzdCBhbHNvIGJlIGEgbXVsdGlwbGUgb2YgMi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBsaW5lcyBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIDIgZGlzY3JldGUgbGluZSBzZWdtZW50c1xuICAgICAqIHZhciBwb2ludHMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICAwLCAwLCAwLFxuICAgICAqICAgICAxLCAwLCAwLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgMSwgMSwgMCxcbiAgICAgKiAgICAgMSwgMSwgMVxuICAgICAqIF07XG4gICAgICogdmFyIGNvbG9ycyA9IFtcbiAgICAgKiAgICAgLy8gTGluZSAxXG4gICAgICogICAgIDEsIDAsIDAsIDEsICAvLyByZWRcbiAgICAgKiAgICAgMCwgMSwgMCwgMSwgIC8vIGdyZWVuXG4gICAgICogICAgIC8vIExpbmUgMlxuICAgICAqICAgICAwLCAwLCAxLCAxLCAgLy8gYmx1ZVxuICAgICAqICAgICAxLCAxLCAxLCAxICAgLy8gd2hpdGVcbiAgICAgKiBdO1xuICAgICAqIGFwcC5kcmF3TGluZUFycmF5cyhwb2ludHMsIGNvbG9ycyk7XG4gICAgICovXG4gICAgZHJhd0xpbmVBcnJheXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuZHJhd0xpbmVBcnJheXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgd2lyZWZyYW1lIHNwaGVyZSB3aXRoIGNlbnRlciwgcmFkaXVzIGFuZCBjb2xvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gY2VudGVyIC0gVGhlIGNlbnRlciBvZiB0aGUgc3BoZXJlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByYWRpdXMgLSBUaGUgcmFkaXVzIG9mIHRoZSBzcGhlcmUuXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW2NvbG9yXSAtIFRoZSBjb2xvciBvZiB0aGUgc3BoZXJlLiBJdCBkZWZhdWx0cyB0byB3aGl0ZSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbc2VnbWVudHNdIC0gTnVtYmVyIG9mIGxpbmUgc2VnbWVudHMgdXNlZCB0byByZW5kZXIgdGhlIGNpcmNsZXMgZm9ybWluZyB0aGVcbiAgICAgKiBzcGhlcmUuIERlZmF1bHRzIHRvIDIwLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIHNwaGVyZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlXG4gICAgICogZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBzcGhlcmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIHJlZCB3aXJlIHNwaGVyZSB3aXRoIHJhZGl1cyBvZiAxXG4gICAgICogdmFyIGNlbnRlciA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3V2lyZVNwaGVyZShjZW50ZXIsIDEuMCwgcGMuQ29sb3IuUkVEKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1dpcmVTcGhlcmUoY2VudGVyLCByYWRpdXMsIGNvbG9yID0gQ29sb3IuV0hJVEUsIHNlZ21lbnRzID0gMjAsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdXaXJlU3BoZXJlKGNlbnRlciwgcmFkaXVzLCBjb2xvciwgc2VnbWVudHMsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgd2lyZWZyYW1lIGF4aXMgYWxpZ25lZCBib3ggc3BlY2lmaWVkIGJ5IG1pbiBhbmQgbWF4IHBvaW50cyBhbmQgY29sb3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG1pblBvaW50IC0gVGhlIG1pbiBjb3JuZXIgcG9pbnQgb2YgdGhlIGJveC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG1heFBvaW50IC0gVGhlIG1heCBjb3JuZXIgcG9pbnQgb2YgdGhlIGJveC5cbiAgICAgKiBAcGFyYW0ge0NvbG9yfSBbY29sb3JdIC0gVGhlIGNvbG9yIG9mIHRoZSBzcGhlcmUuIEl0IGRlZmF1bHRzIHRvIHdoaXRlIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgc3BoZXJlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGVcbiAgICAgKiBkZXB0aCBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHNwaGVyZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgcmVkIHdpcmUgYWxpZ25lZCBib3hcbiAgICAgKiB2YXIgbWluID0gbmV3IHBjLlZlYzMoLTEsIC0xLCAtMSk7XG4gICAgICogdmFyIG1heCA9IG5ldyBwYy5WZWMzKDEsIDEsIDEpO1xuICAgICAqIGFwcC5kcmF3V2lyZUFsaWduZWRCb3gobWluLCBtYXgsIHBjLkNvbG9yLlJFRCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdXaXJlQWxpZ25lZEJveChtaW5Qb2ludCwgbWF4UG9pbnQsIGNvbG9yID0gQ29sb3IuV0hJVEUsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdXaXJlQWxpZ25lZEJveChtaW5Qb2ludCwgbWF4UG9pbnQsIGNvbG9yLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3IG1lc2hJbnN0YW5jZSBhdCB0aGlzIGZyYW1lXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZX0gbWVzaEluc3RhbmNlIC0gVGhlIG1lc2ggaW5zdGFuY2UgdG8gZHJhdy5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbWVzaCBpbnN0YW5jZSBpbnRvLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdNZXNoSW5zdGFuY2UobWVzaEluc3RhbmNlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChudWxsLCBudWxsLCBudWxsLCBtZXNoSW5zdGFuY2UsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3IG1lc2ggYXQgdGhpcyBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWVzaH0gbWVzaCAtIFRoZSBtZXNoIHRvIGRyYXcuXG4gICAgICogQHBhcmFtIHtNYXRlcmlhbH0gbWF0ZXJpYWwgLSBUaGUgbWF0ZXJpYWwgdG8gdXNlIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKiBAcGFyYW0ge01hdDR9IG1hdHJpeCAtIFRoZSBtYXRyaXggdG8gdXNlIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbWVzaCBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3TWVzaChtZXNoLCBtYXRlcmlhbCwgbWF0cml4LCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChtYXRlcmlhbCwgbWF0cml4LCBtZXNoLCBudWxsLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBxdWFkIG9mIHNpemUgWy0wLjUsIDAuNV0gYXQgdGhpcyBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbWF0cml4IC0gVGhlIG1hdHJpeCB0byB1c2UgdG8gcmVuZGVyIHRoZSBxdWFkLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSB0byByZW5kZXIgdGhlIHF1YWQuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHF1YWQgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1F1YWQobWF0cml4LCBtYXRlcmlhbCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0UXVhZE1lc2goKSwgbnVsbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgdGV4dHVyZSBhdCBbeCwgeV0gcG9zaXRpb24gb24gc2NyZWVuLCB3aXRoIHNpemUgW3dpZHRoLCBoZWlnaHRdLiBUaGUgb3JpZ2luIG9mIHRoZVxuICAgICAqIHNjcmVlbiBpcyB0b3AtbGVmdCBbMCwgMF0uIENvb3JkaW5hdGVzIGFuZCBzaXplcyBhcmUgaW4gcHJvamVjdGVkIHNwYWNlICgtMSAuLiAxKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW4gdGhlXG4gICAgICogcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpblxuICAgICAqIHRoZSByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtUZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gcmVuZGVyLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHVzZWQgd2hlbiByZW5kZXJpbmcgdGhlIHRleHR1cmUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHRleHR1cmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1RleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgdGV4dHVyZSwgbWF0ZXJpYWwsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG5cbiAgICAgICAgLy8gVE9ETzogaWYgdGhpcyBpcyB1c2VkIGZvciBhbnl0aGluZyBvdGhlciB0aGFuIGRlYnVnIHRleHR1cmUgZGlzcGxheSwgd2Ugc2hvdWxkIG9wdGltaXplIHRoaXMgdG8gYXZvaWQgYWxsb2NhdGlvbnNcbiAgICAgICAgY29uc3QgbWF0cml4ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgbWF0cml4LnNldFRSUyhuZXcgVmVjMyh4LCB5LCAwLjApLCBRdWF0LklERU5USVRZLCBuZXcgVmVjMyh3aWR0aCwgaGVpZ2h0LCAwLjApKTtcblxuICAgICAgICBpZiAoIW1hdGVyaWFsKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKFwiY29sb3JNYXBcIiwgdGV4dHVyZSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zaGFkZXIgPSB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRUZXh0dXJlU2hhZGVyKCk7XG4gICAgICAgICAgICBtYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZHJhd1F1YWQobWF0cml4LCBtYXRlcmlhbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgZGVwdGggdGV4dHVyZSBhdCBbeCwgeV0gcG9zaXRpb24gb24gc2NyZWVuLCB3aXRoIHNpemUgW3dpZHRoLCBoZWlnaHRdLiBUaGUgb3JpZ2luIG9mXG4gICAgICogdGhlIHNjcmVlbiBpcyB0b3AtbGVmdCBbMCwgMF0uIENvb3JkaW5hdGVzIGFuZCBzaXplcyBhcmUgaW4gcHJvamVjdGVkIHNwYWNlICgtMSAuLiAxKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW4gdGhlXG4gICAgICogcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpblxuICAgICAqIHRoZSByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHRleHR1cmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd0RlcHRoVGV4dHVyZSh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICBtYXRlcmlhbC5zaGFkZXIgPSB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXREZXB0aFRleHR1cmVTaGFkZXIoKTtcbiAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgdGhpcy5kcmF3VGV4dHVyZSh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBudWxsLCBtYXRlcmlhbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIGFwcGxpY2F0aW9uIGFuZCByZW1vdmVzIGFsbCBldmVudCBsaXN0ZW5lcnMgYXQgdGhlIGVuZCBvZiB0aGUgY3VycmVudCBlbmdpbmUgZnJhbWVcbiAgICAgKiB1cGRhdGUuIEhvd2V2ZXIsIGlmIGNhbGxlZCBvdXRzaWRlIG9mIHRoZSBlbmdpbmUgZnJhbWUgdXBkYXRlLCBjYWxsaW5nIGRlc3Ryb3koKSB3aWxsXG4gICAgICogZGVzdHJveSB0aGUgYXBwbGljYXRpb24gaW1tZWRpYXRlbHkuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5kZXN0cm95KCk7XG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luRnJhbWVVcGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2FudmFzSWQgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5pZDtcblxuICAgICAgICB0aGlzLm9mZignbGlicmFyaWVzbG9hZGVkJyk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW96dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtc3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2Via2l0dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucm9vdC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMucm9vdCA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMubW91c2UpIHtcbiAgICAgICAgICAgIHRoaXMubW91c2Uub2ZmKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLmRldGFjaCgpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5rZXlib2FyZCkge1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZC5vZmYoKTtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQuZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRvdWNoKSB7XG4gICAgICAgICAgICB0aGlzLnRvdWNoLm9mZigpO1xuICAgICAgICAgICAgdGhpcy50b3VjaC5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMudG91Y2ggPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudElucHV0KSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dC5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudElucHV0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuZGVzdHJveSgpO1xuXG4gICAgICAgIC8vIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMuZGVzdHJveSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbGwgdGV4dHVyZSByZXNvdXJjZXNcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5hc3NldHMubGlzdCgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXNzZXRzW2ldLnVubG9hZCgpO1xuICAgICAgICAgICAgYXNzZXRzW2ldLm9mZigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYXNzZXRzLm9mZigpO1xuXG5cbiAgICAgICAgLy8gZGVzdHJveSBidW5kbGUgcmVnaXN0cnlcbiAgICAgICAgdGhpcy5idW5kbGVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5idW5kbGVzID0gbnVsbDtcblxuICAgICAgICB0aGlzLmkxOG4uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmkxOG4gPSBudWxsO1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZVtrZXldO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgaWYgKHBhcmVudCkgcGFyZW50LnJlbW92ZUNoaWxkKGVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSA9IHt9O1xuXG4gICAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcblxuICAgICAgICB0aGlzLnN5c3RlbXMgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xuXG4gICAgICAgIC8vIHNjcmlwdCByZWdpc3RyeVxuICAgICAgICB0aGlzLnNjcmlwdHMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zY2VuZXMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbnRpdHlJbmRleCA9IHt9O1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25QcmVSZW5kZXJPcGFxdWUgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoLm9uUG9zdFJlbmRlck9wYXF1ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25EaXNhYmxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vbkVuYWJsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGggPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllcldvcmxkID0gbnVsbDtcblxuICAgICAgICB0aGlzPy54ci5lbmQoKTtcbiAgICAgICAgdGhpcz8ueHIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMucmVuZGVyZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy50aWNrID0gbnVsbDtcblxuICAgICAgICB0aGlzLm9mZigpOyAvLyByZW1vdmUgYWxsIGV2ZW50c1xuXG4gICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgc2NyaXB0LmFwcCA9IG51bGw7XG5cbiAgICAgICAgQXBwQmFzZS5fYXBwbGljYXRpb25zW2NhbnZhc0lkXSA9IG51bGw7XG5cbiAgICAgICAgaWYgKGdldEFwcGxpY2F0aW9uKCkgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHNldEFwcGxpY2F0aW9uKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGVudGl0eSBmcm9tIHRoZSBpbmRleCBieSBndWlkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWQgLSBUaGUgR1VJRCB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtFbnRpdHl9IFRoZSBFbnRpdHkgd2l0aCB0aGUgR1VJRCBvciBudWxsLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRFbnRpdHlGcm9tSW5kZXgoZ3VpZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW50aXR5SW5kZXhbZ3VpZF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZShzY2VuZSkge1xuICAgICAgICB0aGlzLm9uKCdwb3N0cmVuZGVyJywgc2NlbmUuaW1tZWRpYXRlLm9uUG9zdFJlbmRlciwgc2NlbmUuaW1tZWRpYXRlKTtcbiAgICB9XG59XG5cbi8vIHN0YXRpYyBkYXRhXG5jb25zdCBfZnJhbWVFbmREYXRhID0ge307XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNzdGFydH0gYW5kIGl0c2VsZiB0byByZXF1ZXN0XG4gKiB0aGUgcmVuZGVyaW5nIG9mIGEgbmV3IGFuaW1hdGlvbiBmcmFtZS5cbiAqXG4gKiBAY2FsbGJhY2sgTWFrZVRpY2tDYWxsYmFja1xuICogQHBhcmFtIHtudW1iZXJ9IFt0aW1lc3RhbXBdIC0gVGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICogQGlnbm9yZVxuICovXG5cbi8qKlxuICogQ3JlYXRlIHRpY2sgZnVuY3Rpb24gdG8gYmUgd3JhcHBlZCBpbiBjbG9zdXJlLlxuICpcbiAqIEBwYXJhbSB7QXBwQmFzZX0gX2FwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAqIEByZXR1cm5zIHtNYWtlVGlja0NhbGxiYWNrfSBUaGUgdGljayBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmNvbnN0IG1ha2VUaWNrID0gZnVuY3Rpb24gKF9hcHApIHtcbiAgICBjb25zdCBhcHBsaWNhdGlvbiA9IF9hcHA7XG4gICAgbGV0IGZyYW1lUmVxdWVzdDtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3RpbWVzdGFtcF0gLSBUaGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqL1xuICAgIHJldHVybiBmdW5jdGlvbiAodGltZXN0YW1wLCBmcmFtZSkge1xuICAgICAgICBpZiAoIWFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHNldEFwcGxpY2F0aW9uKGFwcGxpY2F0aW9uKTtcblxuICAgICAgICBpZiAoZnJhbWVSZXF1ZXN0KSB7XG4gICAgICAgICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoZnJhbWVSZXF1ZXN0KTtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoYXZlIGN1cnJlbnQgYXBwbGljYXRpb24gcG9pbnRlciBpbiBwY1xuICAgICAgICBhcHAgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICBjb25zdCBjdXJyZW50VGltZSA9IGFwcGxpY2F0aW9uLl9wcm9jZXNzVGltZXN0YW1wKHRpbWVzdGFtcCkgfHwgbm93KCk7XG4gICAgICAgIGNvbnN0IG1zID0gY3VycmVudFRpbWUgLSAoYXBwbGljYXRpb24uX3RpbWUgfHwgY3VycmVudFRpbWUpO1xuICAgICAgICBsZXQgZHQgPSBtcyAvIDEwMDAuMDtcbiAgICAgICAgZHQgPSBtYXRoLmNsYW1wKGR0LCAwLCBhcHBsaWNhdGlvbi5tYXhEZWx0YVRpbWUpO1xuICAgICAgICBkdCAqPSBhcHBsaWNhdGlvbi50aW1lU2NhbGU7XG5cbiAgICAgICAgYXBwbGljYXRpb24uX3RpbWUgPSBjdXJyZW50VGltZTtcblxuICAgICAgICAvLyBTdWJtaXQgYSByZXF1ZXN0IHRvIHF1ZXVlIHVwIGEgbmV3IGFuaW1hdGlvbiBmcmFtZSBpbW1lZGlhdGVseVxuICAgICAgICBpZiAoYXBwbGljYXRpb24ueHI/LnNlc3Npb24pIHtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IGFwcGxpY2F0aW9uLnhyLnNlc3Npb24ucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFwcGxpY2F0aW9uLnRpY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJhbWVSZXF1ZXN0ID0gcGxhdGZvcm0uYnJvd3NlciA/IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYXBwbGljYXRpb24udGljaykgOiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmNvbnRleHRMb3N0KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9maWxsRnJhbWVTdGF0c0Jhc2ljKGN1cnJlbnRUaW1lLCBkdCwgbXMpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgYXBwbGljYXRpb24uX2ZpbGxGcmFtZVN0YXRzKCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9pbkZyYW1lVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1ldXBkYXRlXCIsIG1zKTtcblxuICAgICAgICBsZXQgc2hvdWxkUmVuZGVyRnJhbWUgPSB0cnVlO1xuXG4gICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgc2hvdWxkUmVuZGVyRnJhbWUgPSBhcHBsaWNhdGlvbi54cj8udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyLmZyYW1lYnVmZmVyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbGljYXRpb24uZ3JhcGhpY3NEZXZpY2UuZGVmYXVsdEZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaG91bGRSZW5kZXJGcmFtZSkge1xuICAgICAgICAgICAgYXBwbGljYXRpb24udXBkYXRlKGR0KTtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lcmVuZGVyXCIpO1xuXG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9GUkFNRSwgYC0tLSBGcmFtZSAke2FwcGxpY2F0aW9uLmZyYW1lfWApO1xuXG4gICAgICAgICAgICBpZiAoYXBwbGljYXRpb24uYXV0b1JlbmRlciB8fCBhcHBsaWNhdGlvbi5yZW5kZXJOZXh0RnJhbWUpIHtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi51cGRhdGVDYW52YXNTaXplKCk7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24ucmVuZGVyKCk7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24ucmVuZGVyTmV4dEZyYW1lID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBldmVudCBkYXRhXG4gICAgICAgICAgICBfZnJhbWVFbmREYXRhLnRpbWVzdGFtcCA9IG5vdygpO1xuICAgICAgICAgICAgX2ZyYW1lRW5kRGF0YS50YXJnZXQgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lZW5kXCIsIF9mcmFtZUVuZERhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXBwbGljYXRpb24uX2luRnJhbWVVcGRhdGUgPSBmYWxzZTtcblxuICAgICAgICBpZiAoYXBwbGljYXRpb24uX2Rlc3Ryb3lSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG5leHBvcnQgeyBhcHAsIEFwcEJhc2UgfTtcbiJdLCJuYW1lcyI6WyJQcm9ncmVzcyIsImNvbnN0cnVjdG9yIiwibGVuZ3RoIiwiY291bnQiLCJpbmMiLCJkb25lIiwiYXBwIiwiQXBwQmFzZSIsIkV2ZW50SGFuZGxlciIsImNhbnZhcyIsInZlcnNpb24iLCJpbmRleE9mIiwiRGVidWciLCJsb2ciLCJyZXZpc2lvbiIsIl9hcHBsaWNhdGlvbnMiLCJpZCIsInNldEFwcGxpY2F0aW9uIiwiX2Rlc3Ryb3lSZXF1ZXN0ZWQiLCJfaW5GcmFtZVVwZGF0ZSIsIl90aW1lIiwidGltZVNjYWxlIiwibWF4RGVsdGFUaW1lIiwiZnJhbWUiLCJhdXRvUmVuZGVyIiwicmVuZGVyTmV4dEZyYW1lIiwidXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyIsInNjcmlwdCIsImxlZ2FjeSIsIl9saWJyYXJpZXNMb2FkZWQiLCJfZmlsbE1vZGUiLCJGSUxMTU9ERV9LRUVQX0FTUEVDVCIsIl9yZXNvbHV0aW9uTW9kZSIsIlJFU09MVVRJT05fRklYRUQiLCJfYWxsb3dSZXNpemUiLCJjb250ZXh0IiwiaW5pdCIsImFwcE9wdGlvbnMiLCJkZXZpY2UiLCJncmFwaGljc0RldmljZSIsImFzc2VydCIsIkdyYXBoaWNzRGV2aWNlQWNjZXNzIiwic2V0IiwiX2luaXREZWZhdWx0TWF0ZXJpYWwiLCJfaW5pdFByb2dyYW1MaWJyYXJ5Iiwic3RhdHMiLCJBcHBsaWNhdGlvblN0YXRzIiwiX3NvdW5kTWFuYWdlciIsInNvdW5kTWFuYWdlciIsImxvYWRlciIsIlJlc291cmNlTG9hZGVyIiwiTGlnaHRzQnVmZmVyIiwiX2VudGl0eUluZGV4Iiwic2NlbmUiLCJTY2VuZSIsIl9yZWdpc3RlclNjZW5lSW1tZWRpYXRlIiwicm9vdCIsIkVudGl0eSIsIl9lbmFibGVkSW5IaWVyYXJjaHkiLCJhc3NldHMiLCJBc3NldFJlZ2lzdHJ5IiwiYXNzZXRQcmVmaXgiLCJwcmVmaXgiLCJidW5kbGVzIiwiQnVuZGxlUmVnaXN0cnkiLCJlbmFibGVCdW5kbGVzIiwiVGV4dERlY29kZXIiLCJzY3JpcHRzT3JkZXIiLCJzY3JpcHRzIiwiU2NyaXB0UmVnaXN0cnkiLCJpMThuIiwiSTE4biIsInNjZW5lcyIsIlNjZW5lUmVnaXN0cnkiLCJzZWxmIiwiZGVmYXVsdExheWVyV29ybGQiLCJMYXllciIsIm5hbWUiLCJMQVlFUklEX1dPUkxEIiwic2NlbmVHcmFiIiwiU2NlbmVHcmFiIiwiZGVmYXVsdExheWVyRGVwdGgiLCJsYXllciIsImRlZmF1bHRMYXllclNreWJveCIsImVuYWJsZWQiLCJMQVlFUklEX1NLWUJPWCIsIm9wYXF1ZVNvcnRNb2RlIiwiU09SVE1PREVfTk9ORSIsImRlZmF1bHRMYXllclVpIiwiTEFZRVJJRF9VSSIsInRyYW5zcGFyZW50U29ydE1vZGUiLCJTT1JUTU9ERV9NQU5VQUwiLCJwYXNzVGhyb3VnaCIsImRlZmF1bHRMYXllckltbWVkaWF0ZSIsIkxBWUVSSURfSU1NRURJQVRFIiwiZGVmYXVsdExheWVyQ29tcG9zaXRpb24iLCJMYXllckNvbXBvc2l0aW9uIiwicHVzaE9wYXF1ZSIsInB1c2hUcmFuc3BhcmVudCIsImxheWVycyIsIm9uIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJsaXN0IiwibGF5ZXJMaXN0IiwiaSIsIkxBWUVSSURfREVQVEgiLCJwYXRjaCIsIkFyZWFMaWdodEx1dHMiLCJjcmVhdGVQbGFjZWhvbGRlciIsInJlbmRlcmVyIiwiRm9yd2FyZFJlbmRlcmVyIiwiZnJhbWVHcmFwaCIsIkZyYW1lR3JhcGgiLCJsaWdodG1hcHBlciIsIm9uY2UiLCJfZmlyc3RCYWtlIiwiX2JhdGNoZXIiLCJiYXRjaE1hbmFnZXIiLCJfZmlyc3RCYXRjaCIsImtleWJvYXJkIiwibW91c2UiLCJ0b3VjaCIsImdhbWVwYWRzIiwiZWxlbWVudElucHV0IiwieHIiLCJhdHRhY2hTZWxlY3RFdmVudHMiLCJfaW5Ub29scyIsIl9za3lib3hBc3NldCIsIl9zY3JpcHRQcmVmaXgiLCJzY3JpcHRQcmVmaXgiLCJhZGRIYW5kbGVyIiwiQnVuZGxlSGFuZGxlciIsInJlc291cmNlSGFuZGxlcnMiLCJmb3JFYWNoIiwicmVzb3VyY2VIYW5kbGVyIiwiaGFuZGxlciIsImhhbmRsZXJUeXBlIiwic3lzdGVtcyIsIkNvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5IiwiY29tcG9uZW50U3lzdGVtcyIsImNvbXBvbmVudFN5c3RlbSIsImFkZCIsIl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciIsIm9uVmlzaWJpbGl0eUNoYW5nZSIsImJpbmQiLCJkb2N1bWVudCIsImhpZGRlbiIsInVuZGVmaW5lZCIsIl9oaWRkZW5BdHRyIiwiYWRkRXZlbnRMaXN0ZW5lciIsIm1vekhpZGRlbiIsIm1zSGlkZGVuIiwid2Via2l0SGlkZGVuIiwidGljayIsIm1ha2VUaWNrIiwiZ2V0QXBwbGljYXRpb24iLCJtYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9CTElOTiIsInNldERlZmF1bHRNYXRlcmlhbCIsImxpYnJhcnkiLCJQcm9ncmFtTGlicmFyeSIsInNldFByb2dyYW1MaWJyYXJ5IiwiYmF0Y2hlciIsImZpbGxNb2RlIiwicmVzb2x1dGlvbk1vZGUiLCJjb25maWd1cmUiLCJ1cmwiLCJjYWxsYmFjayIsImh0dHAiLCJnZXQiLCJlcnIiLCJyZXNwb25zZSIsInByb3BzIiwiYXBwbGljYXRpb25fcHJvcGVydGllcyIsIl9wYXJzZUFwcGxpY2F0aW9uUHJvcGVydGllcyIsIl9wYXJzZVNjZW5lcyIsIl9wYXJzZUFzc2V0cyIsInByZWxvYWQiLCJmaXJlIiwicHJvZ3Jlc3MiLCJfZG9uZSIsInRvdGFsIiwib25Bc3NldExvYWQiLCJhc3NldCIsIm9uQXNzZXRFcnJvciIsImxvYWRlZCIsImxvYWQiLCJfcHJlbG9hZFNjcmlwdHMiLCJzY2VuZURhdGEiLCJwcmVsb2FkaW5nIiwiX2dldFNjcmlwdFJlZmVyZW5jZXMiLCJsIiwicmVnZXgiLCJvbkxvYWQiLCJTY3JpcHRUeXBlIiwiY29uc29sZSIsImVycm9yIiwic2NyaXB0VXJsIiwidGVzdCIsInRvTG93ZXJDYXNlIiwicGF0aCIsImpvaW4iLCJtYXhBc3NldFJldHJpZXMiLCJlbmFibGVSZXRyeSIsInVzZURldmljZVBpeGVsUmF0aW8iLCJ1c2VfZGV2aWNlX3BpeGVsX3JhdGlvIiwicmVzb2x1dGlvbl9tb2RlIiwiZmlsbF9tb2RlIiwiX3dpZHRoIiwid2lkdGgiLCJfaGVpZ2h0IiwiaGVpZ2h0IiwibWF4UGl4ZWxSYXRpbyIsIndpbmRvdyIsImRldmljZVBpeGVsUmF0aW8iLCJzZXRDYW52YXNSZXNvbHV0aW9uIiwic2V0Q2FudmFzRmlsbE1vZGUiLCJsYXllck9yZGVyIiwiY29tcG9zaXRpb24iLCJrZXkiLCJkYXRhIiwicGFyc2VJbnQiLCJsZW4iLCJzdWJsYXllciIsInRyYW5zcGFyZW50Iiwic3ViTGF5ZXJFbmFibGVkIiwiYmF0Y2hHcm91cHMiLCJncnAiLCJhZGRHcm91cCIsImR5bmFtaWMiLCJtYXhBYWJiU2l6ZSIsImkxOG5Bc3NldHMiLCJfbG9hZExpYnJhcmllcyIsImxpYnJhcmllcyIsInVybHMiLCJvbkxpYnJhcmllc0xvYWRlZCIsInNjcmlwdHNJbmRleCIsImJ1bmRsZXNJbmRleCIsInB1c2giLCJ0eXBlIiwiQXNzZXQiLCJmaWxlIiwibG9hZGluZ1R5cGUiLCJ0YWdzIiwibG9jYWxlIiwiYWRkTG9jYWxpemVkQXNzZXRJZCIsInByaW9yaXR5U2NyaXB0cyIsInNldHRpbmdzIiwicHJpb3JpdHlfc2NyaXB0cyIsIl9zY3JpcHRzIiwiX2luZGV4IiwiZW50aXRpZXMiLCJjb21wb25lbnRzIiwic3RhcnQiLCJ0aW1lc3RhbXAiLCJub3ciLCJ0YXJnZXQiLCJpbnB1dFVwZGF0ZSIsImR0IiwiY29udHJvbGxlciIsInVwZGF0ZSIsInVwZGF0ZUNsaWVudFJlY3QiLCJ1cGRhdGVTdGFydCIsInVwZGF0ZVRpbWUiLCJyZW5kZXIiLCJyZW5kZXJTdGFydCIsInN5bmNIaWVyYXJjaHkiLCJ1cGRhdGVBbGwiLCJfc2tpcFJlbmRlckNvdW50ZXIiLCJyZW5kZXJDb21wb3NpdGlvbiIsInJlbmRlclRpbWUiLCJsYXllckNvbXBvc2l0aW9uIiwiYnVpbGRGcmFtZUdyYXBoIiwiX2ZpbGxGcmFtZVN0YXRzQmFzaWMiLCJtcyIsIl90aW1lVG9Db3VudEZyYW1lcyIsImZwcyIsIl9mcHNBY2N1bSIsImRyYXdDYWxscyIsIl9kcmF3Q2FsbHNQZXJGcmFtZSIsIl9maWxsRnJhbWVTdGF0cyIsImNhbWVyYXMiLCJfY2FtZXJhc1JlbmRlcmVkIiwibWF0ZXJpYWxzIiwiX21hdGVyaWFsU3dpdGNoZXMiLCJzaGFkZXJzIiwiX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUiLCJzaGFkb3dNYXBVcGRhdGVzIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJzaGFkb3dNYXBUaW1lIiwiX3NoYWRvd01hcFRpbWUiLCJkZXB0aE1hcFRpbWUiLCJfZGVwdGhNYXBUaW1lIiwiZm9yd2FyZFRpbWUiLCJfZm9yd2FyZFRpbWUiLCJwcmltcyIsIl9wcmltc1BlckZyYW1lIiwidHJpYW5nbGVzIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsIk1hdGgiLCJtYXgiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiY3VsbFRpbWUiLCJfY3VsbFRpbWUiLCJzb3J0VGltZSIsIl9zb3J0VGltZSIsInNraW5UaW1lIiwiX3NraW5UaW1lIiwibW9ycGhUaW1lIiwiX21vcnBoVGltZSIsImxpZ2h0Q2x1c3RlcnMiLCJfbGlnaHRDbHVzdGVycyIsImxpZ2h0Q2x1c3RlcnNUaW1lIiwiX2xpZ2h0Q2x1c3RlcnNUaW1lIiwib3RoZXJQcmltaXRpdmVzIiwiX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lIiwiZm9yd2FyZCIsIl9mb3J3YXJkRHJhd0NhbGxzIiwiY3VsbGVkIiwiX251bURyYXdDYWxsc0N1bGxlZCIsImRlcHRoIiwic2hhZG93IiwiX3NoYWRvd0RyYXdDYWxscyIsInNraW5uZWQiLCJfc2tpbkRyYXdDYWxscyIsImltbWVkaWF0ZSIsImluc3RhbmNlZCIsInJlbW92ZWRCeUluc3RhbmNpbmciLCJtaXNjIiwiX2RlcHRoRHJhd0NhbGxzIiwiX2ltbWVkaWF0ZVJlbmRlcmVkIiwiX2luc3RhbmNlZERyYXdDYWxscyIsInJlbmRlclRhcmdldENyZWF0aW9uVGltZSIsInBhcnRpY2xlcyIsInVwZGF0ZXNQZXJGcmFtZSIsIl91cGRhdGVzUGVyRnJhbWUiLCJmcmFtZVRpbWUiLCJfZnJhbWVUaW1lIiwibW9kZSIsInJlc2l6ZUNhbnZhcyIsIlJFU09MVVRJT05fQVVUTyIsImNsaWVudFdpZHRoIiwiY2xpZW50SGVpZ2h0IiwiaXNIaWRkZW4iLCJzdXNwZW5kIiwicmVzdW1lIiwic2Vzc2lvbiIsIndpbmRvd1dpZHRoIiwiaW5uZXJXaWR0aCIsIndpbmRvd0hlaWdodCIsImlubmVySGVpZ2h0IiwiciIsIndpblIiLCJGSUxMTU9ERV9GSUxMX1dJTkRPVyIsInN0eWxlIiwidXBkYXRlQ2FudmFzU2l6ZSIsImFjdGl2ZSIsInJpZ2lkYm9keSIsIm9uTGlicmFyeUxvYWRlZCIsImFwcGx5U2NlbmVTZXR0aW5ncyIsIkFtbW8iLCJncmF2aXR5IiwicGh5c2ljcyIsImFwcGx5U2V0dGluZ3MiLCJoYXNPd25Qcm9wZXJ0eSIsInNreWJveCIsInNldFNreWJveCIsInNldEFyZWFMaWdodEx1dHMiLCJsdGNNYXQxIiwibHRjTWF0MiIsIndhcm4iLCJvblNreWJveFJlbW92ZWQiLCJvblNreWJveENoYW5nZWQiLCJyZXNvdXJjZXMiLCJvZmYiLCJza3lib3hNaXAiLCJsb2FkRmFjZXMiLCJiYWtlIiwibGlnaHRtYXBNb2RlIiwiZ2VuZXJhdGUiLCJfcHJvY2Vzc1RpbWVzdGFtcCIsImRyYXdMaW5lIiwiZW5kIiwiY29sb3IiLCJkZXB0aFRlc3QiLCJkcmF3TGluZXMiLCJwb3NpdGlvbnMiLCJjb2xvcnMiLCJkZWZhdWx0RHJhd0xheWVyIiwiZHJhd0xpbmVBcnJheXMiLCJkcmF3V2lyZVNwaGVyZSIsImNlbnRlciIsInJhZGl1cyIsIkNvbG9yIiwiV0hJVEUiLCJzZWdtZW50cyIsImRyYXdXaXJlQWxpZ25lZEJveCIsIm1pblBvaW50IiwibWF4UG9pbnQiLCJkcmF3TWVzaEluc3RhbmNlIiwibWVzaEluc3RhbmNlIiwiZHJhd01lc2giLCJtZXNoIiwibWF0cml4IiwiZHJhd1F1YWQiLCJnZXRRdWFkTWVzaCIsImRyYXdUZXh0dXJlIiwieCIsInkiLCJ0ZXh0dXJlIiwiTWF0NCIsInNldFRSUyIsIlZlYzMiLCJRdWF0IiwiSURFTlRJVFkiLCJNYXRlcmlhbCIsInNldFBhcmFtZXRlciIsInNoYWRlciIsImdldFRleHR1cmVTaGFkZXIiLCJkcmF3RGVwdGhUZXh0dXJlIiwiZ2V0RGVwdGhUZXh0dXJlU2hhZGVyIiwiZGVzdHJveSIsImNhbnZhc0lkIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImRldGFjaCIsInVubG9hZCIsImdldEhhbmRsZXIiLCJfY2FjaGUiLCJlbGVtZW50IiwicGFyZW50IiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblBvc3RSZW5kZXJPcGFxdWUiLCJvbkRpc2FibGUiLCJvbkVuYWJsZSIsImdldEVudGl0eUZyb21JbmRleCIsImd1aWQiLCJvblBvc3RSZW5kZXIiLCJfZnJhbWVFbmREYXRhIiwiX2FwcCIsImFwcGxpY2F0aW9uIiwiZnJhbWVSZXF1ZXN0IiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJjdXJyZW50VGltZSIsIm1hdGgiLCJjbGFtcCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInBsYXRmb3JtIiwiYnJvd3NlciIsImNvbnRleHRMb3N0Iiwic2hvdWxkUmVuZGVyRnJhbWUiLCJkZWZhdWx0RnJhbWVidWZmZXIiLCJyZW5kZXJTdGF0ZSIsImJhc2VMYXllciIsImZyYW1lYnVmZmVyIiwidHJhY2UiLCJUUkFDRUlEX1JFTkRFUl9GUkFNRSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXVGQSxNQUFNQSxRQUFRLENBQUM7RUFDWEMsV0FBVyxDQUFDQyxNQUFNLEVBQUU7SUFDaEIsSUFBSSxDQUFDQSxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtJQUNwQixJQUFJLENBQUNDLEtBQUssR0FBRyxDQUFDLENBQUE7QUFDbEIsR0FBQTtBQUVBQyxFQUFBQSxHQUFHLEdBQUc7SUFDRixJQUFJLENBQUNELEtBQUssRUFBRSxDQUFBO0FBQ2hCLEdBQUE7QUFFQUUsRUFBQUEsSUFBSSxHQUFHO0FBQ0gsSUFBQSxPQUFRLElBQUksQ0FBQ0YsS0FBSyxLQUFLLElBQUksQ0FBQ0QsTUFBTSxDQUFBO0FB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
