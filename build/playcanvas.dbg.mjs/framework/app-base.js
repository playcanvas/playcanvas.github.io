/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { version, revision } from '../core/core.js';
import { platform } from '../core/platform.js';
import { now } from '../core/time.js';
import { path } from '../core/path.js';
import { TRACEID_RENDER_FRAME } from '../core/constants.js';
import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { math } from '../core/math/math.js';
import { Quat } from '../core/math/quat.js';
import { Vec3 } from '../core/math/vec3.js';
import { PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN } from '../platform/graphics/constants.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { http } from '../platform/net/http.js';
import { LAYERID_WORLD, LAYERID_SKYBOX, SORTMODE_NONE, LAYERID_UI, SORTMODE_MANUAL, LAYERID_IMMEDIATE, LAYERID_DEPTH, SPECULAR_BLINN } from '../scene/constants.js';
import { setProgramLibrary } from '../scene/shader-lib/get-program-library.js';
import { ProgramLibrary } from '../scene/shader-lib/program-library.js';
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
import { Asset } from './asset/asset.js';
import { AssetRegistry } from './asset/asset-registry.js';
import { BundleRegistry } from './bundle/bundle-registry.js';
import { ComponentSystemRegistry } from './components/registry.js';
import { SceneGrab } from '../scene/graphics/scene-grab.js';
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
    this.sceneGrab = new SceneGrab(this.graphicsDevice, this.scene);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLWJhc2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLWJhc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gI2lmIF9ERUJVR1xuaW1wb3J0IHsgdmVyc2lvbiwgcmV2aXNpb24gfSBmcm9tICcuLi9jb3JlL2NvcmUuanMnO1xuLy8gI2VuZGlmXG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgVFJBQ0VJRF9SRU5ERVJfRlJBTUUgfSBmcm9tICcuLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgaHR0cCB9IGZyb20gJy4uL3BsYXRmb3JtL25ldC9odHRwLmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUklEX0RFUFRILCBMQVlFUklEX0lNTUVESUFURSwgTEFZRVJJRF9TS1lCT1gsIExBWUVSSURfVUksIExBWUVSSURfV09STEQsXG4gICAgU09SVE1PREVfTk9ORSwgU09SVE1PREVfTUFOVUFMLCBTUEVDVUxBUl9CTElOTlxufSBmcm9tICcuLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgc2V0UHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zY2VuZS9zaGFkZXItbGliL2dldC1wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgUHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuLi9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW0tbGlicmFyeS5qcyc7XG5pbXBvcnQgeyBGb3J3YXJkUmVuZGVyZXIgfSBmcm9tICcuLi9zY2VuZS9yZW5kZXJlci9mb3J3YXJkLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IEZyYW1lR3JhcGggfSBmcm9tICcuLi9zY2VuZS9mcmFtZS1ncmFwaC5qcyc7XG5pbXBvcnQgeyBBcmVhTGlnaHRMdXRzIH0gZnJvbSAnLi4vc2NlbmUvYXJlYS1saWdodC1sdXRzLmpzJztcbmltcG9ydCB7IExheWVyIH0gZnJvbSAnLi4vc2NlbmUvbGF5ZXIuanMnO1xuaW1wb3J0IHsgTGF5ZXJDb21wb3NpdGlvbiB9IGZyb20gJy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJztcbmltcG9ydCB7IFNjZW5lIH0gZnJvbSAnLi4vc2NlbmUvc2NlbmUuanMnO1xuaW1wb3J0IHsgTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgTGlnaHRzQnVmZmVyIH0gZnJvbSAnLi4vc2NlbmUvbGlnaHRpbmcvbGlnaHRzLWJ1ZmZlci5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLmpzJztcbmltcG9ydCB7IHNldERlZmF1bHRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9kZWZhdWx0LW1hdGVyaWFsLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuL2Fzc2V0L2Fzc2V0LmpzJztcbmltcG9ydCB7IEFzc2V0UmVnaXN0cnkgfSBmcm9tICcuL2Fzc2V0L2Fzc2V0LXJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEJ1bmRsZVJlZ2lzdHJ5IH0gZnJvbSAnLi9idW5kbGUvYnVuZGxlLXJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5IH0gZnJvbSAnLi9jb21wb25lbnRzL3JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFNjZW5lR3JhYiB9IGZyb20gJy4uL3NjZW5lL2dyYXBoaWNzL3NjZW5lLWdyYWIuanMnO1xuaW1wb3J0IHsgQnVuZGxlSGFuZGxlciB9IGZyb20gJy4vaGFuZGxlcnMvYnVuZGxlLmpzJztcbmltcG9ydCB7IFJlc291cmNlTG9hZGVyIH0gZnJvbSAnLi9oYW5kbGVycy9sb2FkZXIuanMnO1xuaW1wb3J0IHsgSTE4biB9IGZyb20gJy4vaTE4bi9pMThuLmpzJztcbmltcG9ydCB7IFNjcmlwdFJlZ2lzdHJ5IH0gZnJvbSAnLi9zY3JpcHQvc2NyaXB0LXJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4vZW50aXR5LmpzJztcbmltcG9ydCB7IFNjZW5lUmVnaXN0cnkgfSBmcm9tICcuL3NjZW5lLXJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHNjcmlwdCB9IGZyb20gJy4vc2NyaXB0LmpzJztcbmltcG9ydCB7IEFwcGxpY2F0aW9uU3RhdHMgfSBmcm9tICcuL3N0YXRzLmpzJztcblxuaW1wb3J0IHtcbiAgICBGSUxMTU9ERV9GSUxMX1dJTkRPVywgRklMTE1PREVfS0VFUF9BU1BFQ1QsXG4gICAgUkVTT0xVVElPTl9BVVRPLCBSRVNPTFVUSU9OX0ZJWEVEXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHtcbiAgICBnZXRBcHBsaWNhdGlvbixcbiAgICBzZXRBcHBsaWNhdGlvblxufSBmcm9tICcuL2dsb2JhbHMuanMnO1xuXG4vLyBNaW5pLW9iamVjdCB1c2VkIHRvIG1lYXN1cmUgcHJvZ3Jlc3Mgb2YgbG9hZGluZyBzZXRzXG5jbGFzcyBQcm9ncmVzcyB7XG4gICAgY29uc3RydWN0b3IobGVuZ3RoKSB7XG4gICAgICAgIHRoaXMubGVuZ3RoID0gbGVuZ3RoO1xuICAgICAgICB0aGlzLmNvdW50ID0gMDtcbiAgICB9XG5cbiAgICBpbmMoKSB7XG4gICAgICAgIHRoaXMuY291bnQrKztcbiAgICB9XG5cbiAgICBkb25lKCkge1xuICAgICAgICByZXR1cm4gKHRoaXMuY291bnQgPT09IHRoaXMubGVuZ3RoKTtcbiAgICB9XG59XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNjb25maWd1cmV9IHdoZW4gY29uZmlndXJhdGlvbiBmaWxlIGlzIGxvYWRlZCBhbmQgcGFyc2VkIChvclxuICogYW4gZXJyb3Igb2NjdXJzKS5cbiAqXG4gKiBAY2FsbGJhY2sgQ29uZmlndXJlQXBwQ2FsbGJhY2tcbiAqIEBwYXJhbSB7c3RyaW5nfG51bGx9IGVyciAtIFRoZSBlcnJvciBtZXNzYWdlIGluIHRoZSBjYXNlIHdoZXJlIHRoZSBsb2FkaW5nIG9yIHBhcnNpbmcgZmFpbHMuXG4gKi9cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBcHBCYXNlI3ByZWxvYWR9IHdoZW4gYWxsIGFzc2V0cyAobWFya2VkIGFzICdwcmVsb2FkJykgYXJlIGxvYWRlZC5cbiAqXG4gKiBAY2FsbGJhY2sgUHJlbG9hZEFwcENhbGxiYWNrXG4gKi9cblxubGV0IGFwcCA9IG51bGw7XG5cbi8qKlxuICogQW4gQXBwbGljYXRpb24gcmVwcmVzZW50cyBhbmQgbWFuYWdlcyB5b3VyIFBsYXlDYW52YXMgYXBwbGljYXRpb24uIElmIHlvdSBhcmUgZGV2ZWxvcGluZyB1c2luZ1xuICogdGhlIFBsYXlDYW52YXMgRWRpdG9yLCB0aGUgQXBwbGljYXRpb24gaXMgY3JlYXRlZCBmb3IgeW91LiBZb3UgY2FuIGFjY2VzcyB5b3VyIEFwcGxpY2F0aW9uXG4gKiBpbnN0YW5jZSBpbiB5b3VyIHNjcmlwdHMuIEJlbG93IGlzIGEgc2tlbGV0b24gc2NyaXB0IHdoaWNoIHNob3dzIGhvdyB5b3UgY2FuIGFjY2VzcyB0aGVcbiAqIGFwcGxpY2F0aW9uICdhcHAnIHByb3BlcnR5IGluc2lkZSB0aGUgaW5pdGlhbGl6ZSBhbmQgdXBkYXRlIGZ1bmN0aW9uczpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBFZGl0b3IgZXhhbXBsZTogYWNjZXNzaW5nIHRoZSBwYy5BcHBsaWNhdGlvbiBmcm9tIGEgc2NyaXB0XG4gKiB2YXIgTXlTY3JpcHQgPSBwYy5jcmVhdGVTY3JpcHQoJ215U2NyaXB0Jyk7XG4gKlxuICogTXlTY3JpcHQucHJvdG90eXBlLmluaXRpYWxpemUgPSBmdW5jdGlvbigpIHtcbiAqICAgICAvLyBFdmVyeSBzY3JpcHQgaW5zdGFuY2UgaGFzIGEgcHJvcGVydHkgJ3RoaXMuYXBwJyBhY2Nlc3NpYmxlIGluIHRoZSBpbml0aWFsaXplLi4uXG4gKiAgICAgdmFyIGFwcCA9IHRoaXMuYXBwO1xuICogfTtcbiAqXG4gKiBNeVNjcmlwdC5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZHQpIHtcbiAqICAgICAvLyAuLi5hbmQgdXBkYXRlIGZ1bmN0aW9ucy5cbiAqICAgICB2YXIgYXBwID0gdGhpcy5hcHA7XG4gKiB9O1xuICogYGBgXG4gKlxuICogSWYgeW91IGFyZSB1c2luZyB0aGUgRW5naW5lIHdpdGhvdXQgdGhlIEVkaXRvciwgeW91IGhhdmUgdG8gY3JlYXRlIHRoZSBhcHBsaWNhdGlvbiBpbnN0YW5jZVxuICogbWFudWFsbHkuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBBcHBCYXNlIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQXBwQmFzZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudH0gY2FudmFzIC0gVGhlIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRW5naW5lLW9ubHkgZXhhbXBsZTogY3JlYXRlIHRoZSBhcHBsaWNhdGlvbiBtYW51YWxseVxuICAgICAqIHZhciBvcHRpb25zID0gbmV3IEFwcE9wdGlvbnMoKTtcbiAgICAgKiB2YXIgYXBwID0gbmV3IHBjLkFwcEJhc2UoY2FudmFzKTtcbiAgICAgKiBhcHAuaW5pdChvcHRpb25zKTtcbiAgICAgKlxuICAgICAqIC8vIFN0YXJ0IHRoZSBhcHBsaWNhdGlvbidzIG1haW4gbG9vcFxuICAgICAqIGFwcC5zdGFydCgpO1xuICAgICAqXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNhbnZhcykge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHZlcnNpb24/LmluZGV4T2YoJyQnKSA8IDApIHtcbiAgICAgICAgICAgIERlYnVnLmxvZyhgUG93ZXJlZCBieSBQbGF5Q2FudmFzICR7dmVyc2lvbn0gJHtyZXZpc2lvbn1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBTdG9yZSBhcHBsaWNhdGlvbiBpbnN0YW5jZVxuICAgICAgICBBcHBCYXNlLl9hcHBsaWNhdGlvbnNbY2FudmFzLmlkXSA9IHRoaXM7XG4gICAgICAgIHNldEFwcGxpY2F0aW9uKHRoaXMpO1xuXG4gICAgICAgIGFwcCA9IHRoaXM7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lSZXF1ZXN0ZWQgPSBmYWxzZTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5faW5GcmFtZVVwZGF0ZSA9IGZhbHNlO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl90aW1lID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2NhbGVzIHRoZSBnbG9iYWwgdGltZSBkZWx0YS4gRGVmYXVsdHMgdG8gMS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2V0IHRoZSBhcHAgdG8gcnVuIGF0IGhhbGYgc3BlZWRcbiAgICAgICAgICogdGhpcy5hcHAudGltZVNjYWxlID0gMC41O1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50aW1lU2NhbGUgPSAxO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDbGFtcHMgcGVyLWZyYW1lIGRlbHRhIHRpbWUgdG8gYW4gdXBwZXIgYm91bmQuIFVzZWZ1bCBzaW5jZSByZXR1cm5pbmcgZnJvbSBhIHRhYlxuICAgICAgICAgKiBkZWFjdGl2YXRpb24gY2FuIGdlbmVyYXRlIGh1Z2UgdmFsdWVzIGZvciBkdCwgd2hpY2ggY2FuIGFkdmVyc2VseSBhZmZlY3QgZ2FtZSBzdGF0ZS5cbiAgICAgICAgICogRGVmYXVsdHMgdG8gMC4xIChzZWNvbmRzKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gRG9uJ3QgY2xhbXAgaW50ZXItZnJhbWUgdGltZXMgb2YgMjAwbXMgb3IgbGVzc1xuICAgICAgICAgKiB0aGlzLmFwcC5tYXhEZWx0YVRpbWUgPSAwLjI7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm1heERlbHRhVGltZSA9IDAuMTsgLy8gTWF4aW11bSBkZWx0YSBpcyAwLjFzIG9yIDEwIGZwcy5cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHRvdGFsIG51bWJlciBvZiBmcmFtZXMgdGhlIGFwcGxpY2F0aW9uIGhhcyB1cGRhdGVkIHNpbmNlIHN0YXJ0KCkgd2FzIGNhbGxlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5mcmFtZSA9IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdoZW4gdHJ1ZSwgdGhlIGFwcGxpY2F0aW9uJ3MgcmVuZGVyIGZ1bmN0aW9uIGlzIGNhbGxlZCBldmVyeSBmcmFtZS4gU2V0dGluZyBhdXRvUmVuZGVyXG4gICAgICAgICAqIHRvIGZhbHNlIGlzIHVzZWZ1bCB0byBhcHBsaWNhdGlvbnMgd2hlcmUgdGhlIHJlbmRlcmVkIGltYWdlIG1heSBvZnRlbiBiZSB1bmNoYW5nZWQgb3ZlclxuICAgICAgICAgKiB0aW1lLiBUaGlzIGNhbiBoZWF2aWx5IHJlZHVjZSB0aGUgYXBwbGljYXRpb24ncyBsb2FkIG9uIHRoZSBDUFUgYW5kIEdQVS4gRGVmYXVsdHMgdG9cbiAgICAgICAgICogdHJ1ZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIERpc2FibGUgcmVuZGVyaW5nIGV2ZXJ5IGZyYW1lIGFuZCBvbmx5IHJlbmRlciBvbiBhIGtleWRvd24gZXZlbnRcbiAgICAgICAgICogdGhpcy5hcHAuYXV0b1JlbmRlciA9IGZhbHNlO1xuICAgICAgICAgKiB0aGlzLmFwcC5rZXlib2FyZC5vbigna2V5ZG93bicsIGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgKiAgICAgdGhpcy5hcHAucmVuZGVyTmV4dEZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICogfSwgdGhpcyk7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmF1dG9SZW5kZXIgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgdG8gdHJ1ZSB0byByZW5kZXIgdGhlIHNjZW5lIG9uIHRoZSBuZXh0IGl0ZXJhdGlvbiBvZiB0aGUgbWFpbiBsb29wLiBUaGlzIG9ubHkgaGFzIGFuXG4gICAgICAgICAqIGVmZmVjdCBpZiB7QGxpbmsgQXBwQmFzZSNhdXRvUmVuZGVyfSBpcyBzZXQgdG8gZmFsc2UuIFRoZSB2YWx1ZSBvZiByZW5kZXJOZXh0RnJhbWVcbiAgICAgICAgICogaXMgc2V0IGJhY2sgdG8gZmFsc2UgYWdhaW4gYXMgc29vbiBhcyB0aGUgc2NlbmUgaGFzIGJlZW4gcmVuZGVyZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBSZW5kZXIgdGhlIHNjZW5lIG9ubHkgd2hpbGUgc3BhY2Uga2V5IGlzIHByZXNzZWRcbiAgICAgICAgICogaWYgKHRoaXMuYXBwLmtleWJvYXJkLmlzUHJlc3NlZChwYy5LRVlfU1BBQ0UpKSB7XG4gICAgICAgICAqICAgICB0aGlzLmFwcC5yZW5kZXJOZXh0RnJhbWUgPSB0cnVlO1xuICAgICAgICAgKiB9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlbmRlck5leHRGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBFbmFibGUgaWYgeW91IHdhbnQgZW50aXR5IHR5cGUgc2NyaXB0IGF0dHJpYnV0ZXMgdG8gbm90IGJlIHJlLW1hcHBlZCB3aGVuIGFuIGVudGl0eSBpc1xuICAgICAgICAgKiBjbG9uZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnVzZUxlZ2FjeVNjcmlwdEF0dHJpYnV0ZUNsb25pbmcgPSBzY3JpcHQubGVnYWN5O1xuXG4gICAgICAgIHRoaXMuX2xpYnJhcmllc0xvYWRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9maWxsTW9kZSA9IEZJTExNT0RFX0tFRVBfQVNQRUNUO1xuICAgICAgICB0aGlzLl9yZXNvbHV0aW9uTW9kZSA9IFJFU09MVVRJT05fRklYRUQ7XG4gICAgICAgIHRoaXMuX2FsbG93UmVzaXplID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IHdpdGggc2NyaXB0cyAxLjAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtBcHBCYXNlfVxuICAgICAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNvbnRleHQgPSB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgdGhlIGFwcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2FwcC1vcHRpb25zLmpzJykuQXBwT3B0aW9uc30gYXBwT3B0aW9ucyAtIE9wdGlvbnMgc3BlY2lmeWluZyB0aGUgaW5pdFxuICAgICAqIHBhcmFtZXRlcnMgZm9yIHRoZSBhcHAuXG4gICAgICovXG4gICAgaW5pdChhcHBPcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IGFwcE9wdGlvbnMuZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KGRldmljZSwgXCJUaGUgYXBwbGljYXRpb24gY2Fubm90IGJlIGNyZWF0ZWQgd2l0aG91dCBhIHZhbGlkIEdyYXBoaWNzRGV2aWNlXCIpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UgPSBkZXZpY2U7XG4gICAgICAgIEdyYXBoaWNzRGV2aWNlQWNjZXNzLnNldChkZXZpY2UpO1xuXG4gICAgICAgIHRoaXMuX2luaXREZWZhdWx0TWF0ZXJpYWwoKTtcbiAgICAgICAgdGhpcy5faW5pdFByb2dyYW1MaWJyYXJ5KCk7XG4gICAgICAgIHRoaXMuc3RhdHMgPSBuZXcgQXBwbGljYXRpb25TdGF0cyhkZXZpY2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9zb3VuZC9tYW5hZ2VyLmpzJykuU291bmRNYW5hZ2VyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc291bmRNYW5hZ2VyID0gYXBwT3B0aW9ucy5zb3VuZE1hbmFnZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSByZXNvdXJjZSBsb2FkZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtSZXNvdXJjZUxvYWRlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubG9hZGVyID0gbmV3IFJlc291cmNlTG9hZGVyKHRoaXMpO1xuXG4gICAgICAgIExpZ2h0c0J1ZmZlci5pbml0KGRldmljZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFN0b3JlcyBhbGwgZW50aXRpZXMgdGhhdCBoYXZlIGJlZW4gY3JlYXRlZCBmb3IgdGhpcyBhcHAgYnkgZ3VpZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdDxzdHJpbmcsIEVudGl0eT59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VudGl0eUluZGV4ID0ge307XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBzY2VuZSBtYW5hZ2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1NjZW5lfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgdGhlIHRvbmUgbWFwcGluZyBwcm9wZXJ0eSBvZiB0aGUgYXBwbGljYXRpb24ncyBzY2VuZVxuICAgICAgICAgKiB0aGlzLmFwcC5zY2VuZS50b25lTWFwcGluZyA9IHBjLlRPTkVNQVBfRklMTUlDO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY2VuZSA9IG5ldyBTY2VuZShkZXZpY2UpO1xuICAgICAgICB0aGlzLl9yZWdpc3RlclNjZW5lSW1tZWRpYXRlKHRoaXMuc2NlbmUpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcm9vdCBlbnRpdHkgb2YgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RW50aXR5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBSZXR1cm4gdGhlIGZpcnN0IGVudGl0eSBjYWxsZWQgJ0NhbWVyYScgaW4gYSBkZXB0aC1maXJzdCBzZWFyY2ggb2YgdGhlIHNjZW5lIGhpZXJhcmNoeVxuICAgICAgICAgKiB2YXIgY2FtZXJhID0gdGhpcy5hcHAucm9vdC5maW5kQnlOYW1lKCdDYW1lcmEnKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucm9vdCA9IG5ldyBFbnRpdHkoKTtcbiAgICAgICAgdGhpcy5yb290Ll9lbmFibGVkSW5IaWVyYXJjaHkgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXNzZXQgcmVnaXN0cnkgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtBc3NldFJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZWFyY2ggdGhlIGFzc2V0IHJlZ2lzdHJ5IGZvciBhbGwgYXNzZXRzIHdpdGggdGhlIHRhZyAndmVoaWNsZSdcbiAgICAgICAgICogdmFyIHZlaGljbGVBc3NldHMgPSB0aGlzLmFwcC5hc3NldHMuZmluZEJ5VGFnKCd2ZWhpY2xlJyk7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmFzc2V0cyA9IG5ldyBBc3NldFJlZ2lzdHJ5KHRoaXMubG9hZGVyKTtcbiAgICAgICAgaWYgKGFwcE9wdGlvbnMuYXNzZXRQcmVmaXgpIHRoaXMuYXNzZXRzLnByZWZpeCA9IGFwcE9wdGlvbnMuYXNzZXRQcmVmaXg7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtCdW5kbGVSZWdpc3RyeX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5idW5kbGVzID0gbmV3IEJ1bmRsZVJlZ2lzdHJ5KHRoaXMuYXNzZXRzKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IHRoaXMgdG8gZmFsc2UgaWYgeW91IHdhbnQgdG8gcnVuIHdpdGhvdXQgdXNpbmcgYnVuZGxlcy4gV2Ugc2V0IGl0IHRvIHRydWUgb25seSBpZlxuICAgICAgICAgKiBUZXh0RGVjb2RlciBpcyBhdmFpbGFibGUgYmVjYXVzZSB3ZSBjdXJyZW50bHkgcmVseSBvbiBpdCBmb3IgdW50YXJyaW5nLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbmFibGVCdW5kbGVzID0gKHR5cGVvZiBUZXh0RGVjb2RlciAhPT0gJ3VuZGVmaW5lZCcpO1xuXG4gICAgICAgIHRoaXMuc2NyaXB0c09yZGVyID0gYXBwT3B0aW9ucy5zY3JpcHRzT3JkZXIgfHwgW107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIHNjcmlwdCByZWdpc3RyeS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1NjcmlwdFJlZ2lzdHJ5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY3JpcHRzID0gbmV3IFNjcmlwdFJlZ2lzdHJ5KHRoaXMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBIYW5kbGVzIGxvY2FsaXphdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0kxOG59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmkxOG4gPSBuZXcgSTE4bih0aGlzKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNjZW5lIHJlZ2lzdHJ5IG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NlbmVSZWdpc3RyeX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2VhcmNoIHRoZSBzY2VuZSByZWdpc3RyeSBmb3IgYSBpdGVtIHdpdGggdGhlIG5hbWUgJ3JhY2V0cmFjazEnXG4gICAgICAgICAqIHZhciBzY2VuZUl0ZW0gPSB0aGlzLmFwcC5zY2VuZXMuZmluZCgncmFjZXRyYWNrMScpO1xuICAgICAgICAgKlxuICAgICAgICAgKiAvLyBMb2FkIHRoZSBzY2VuZSB1c2luZyB0aGUgaXRlbSdzIHVybFxuICAgICAgICAgKiB0aGlzLmFwcC5zY2VuZXMubG9hZFNjZW5lKHNjZW5lSXRlbS51cmwpO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zY2VuZXMgPSBuZXcgU2NlbmVSZWdpc3RyeSh0aGlzKTtcblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJXb3JsZCA9IG5ldyBMYXllcih7XG4gICAgICAgICAgICBuYW1lOiBcIldvcmxkXCIsXG4gICAgICAgICAgICBpZDogTEFZRVJJRF9XT1JMRFxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLnNjZW5lR3JhYiA9IG5ldyBTY2VuZUdyYWIodGhpcy5ncmFwaGljc0RldmljZSwgdGhpcy5zY2VuZSk7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGggPSB0aGlzLnNjZW5lR3JhYi5sYXllcjtcblxuICAgICAgICB0aGlzLmRlZmF1bHRMYXllclNreWJveCA9IG5ldyBMYXllcih7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbmFtZTogXCJTa3lib3hcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX1NLWUJPWCxcbiAgICAgICAgICAgIG9wYXF1ZVNvcnRNb2RlOiBTT1JUTU9ERV9OT05FXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllclVpID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiBcIlVJXCIsXG4gICAgICAgICAgICBpZDogTEFZRVJJRF9VSSxcbiAgICAgICAgICAgIHRyYW5zcGFyZW50U29ydE1vZGU6IFNPUlRNT0RFX01BTlVBTCxcbiAgICAgICAgICAgIHBhc3NUaHJvdWdoOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUgPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG5hbWU6IFwiSW1tZWRpYXRlXCIsXG4gICAgICAgICAgICBpZDogTEFZRVJJRF9JTU1FRElBVEUsXG4gICAgICAgICAgICBvcGFxdWVTb3J0TW9kZTogU09SVE1PREVfTk9ORSxcbiAgICAgICAgICAgIHBhc3NUaHJvdWdoOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGRlZmF1bHRMYXllckNvbXBvc2l0aW9uID0gbmV3IExheWVyQ29tcG9zaXRpb24oXCJkZWZhdWx0XCIpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoT3BhcXVlKHRoaXMuZGVmYXVsdExheWVyV29ybGQpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoT3BhcXVlKHRoaXMuZGVmYXVsdExheWVyRGVwdGgpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoT3BhcXVlKHRoaXMuZGVmYXVsdExheWVyU2t5Ym94KTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaFRyYW5zcGFyZW50KHRoaXMuZGVmYXVsdExheWVyV29ybGQpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoT3BhcXVlKHRoaXMuZGVmYXVsdExheWVySW1tZWRpYXRlKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaFRyYW5zcGFyZW50KHRoaXMuZGVmYXVsdExheWVySW1tZWRpYXRlKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaFRyYW5zcGFyZW50KHRoaXMuZGVmYXVsdExheWVyVWkpO1xuICAgICAgICB0aGlzLnNjZW5lLmxheWVycyA9IGRlZmF1bHRMYXllckNvbXBvc2l0aW9uO1xuXG4gICAgICAgIC8vIERlZmF1bHQgbGF5ZXJzIHBhdGNoXG4gICAgICAgIHRoaXMuc2NlbmUub24oJ3NldDpsYXllcnMnLCBmdW5jdGlvbiAob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICAgICAgY29uc3QgbGlzdCA9IG5ld0NvbXAubGF5ZXJMaXN0O1xuICAgICAgICAgICAgbGV0IGxheWVyO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIgPSBsaXN0W2ldO1xuICAgICAgICAgICAgICAgIHN3aXRjaCAobGF5ZXIuaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBMQVlFUklEX0RFUFRIOlxuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5zY2VuZUdyYWIucGF0Y2gobGF5ZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTEFZRVJJRF9VSTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnBhc3NUaHJvdWdoID0gc2VsZi5kZWZhdWx0TGF5ZXJVaS5wYXNzVGhyb3VnaDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIExBWUVSSURfSU1NRURJQVRFOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIucGFzc1Rocm91Z2ggPSBzZWxmLmRlZmF1bHRMYXllckltbWVkaWF0ZS5wYXNzVGhyb3VnaDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gcGxhY2Vob2xkZXIgdGV4dHVyZSBmb3IgYXJlYSBsaWdodCBMVVRzXG4gICAgICAgIEFyZWFMaWdodEx1dHMuY3JlYXRlUGxhY2Vob2xkZXIoZGV2aWNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGZvcndhcmQgcmVuZGVyZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGb3J3YXJkUmVuZGVyZXJ9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVuZGVyZXIgPSBuZXcgRm9yd2FyZFJlbmRlcmVyKGRldmljZSk7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuc2NlbmUgPSB0aGlzLnNjZW5lO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZnJhbWUgZ3JhcGguXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtGcmFtZUdyYXBofVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmZyYW1lR3JhcGggPSBuZXcgRnJhbWVHcmFwaCgpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcnVuLXRpbWUgbGlnaHRtYXBwZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbGlnaHRtYXBwZXIvbGlnaHRtYXBwZXIuanMnKS5MaWdodG1hcHBlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXIgPSBudWxsO1xuICAgICAgICBpZiAoYXBwT3B0aW9ucy5saWdodG1hcHBlcikge1xuICAgICAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG5ldyBhcHBPcHRpb25zLmxpZ2h0bWFwcGVyKGRldmljZSwgdGhpcy5yb290LCB0aGlzLnNjZW5lLCB0aGlzLnJlbmRlcmVyLCB0aGlzLmFzc2V0cyk7XG4gICAgICAgICAgICB0aGlzLm9uY2UoJ3ByZXJlbmRlcicsIHRoaXMuX2ZpcnN0QmFrZSwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uJ3MgYmF0Y2ggbWFuYWdlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtbWFuYWdlci5qcycpLkJhdGNoTWFuYWdlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2JhdGNoZXIgPSBudWxsO1xuICAgICAgICBpZiAoYXBwT3B0aW9ucy5iYXRjaE1hbmFnZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIgPSBuZXcgYXBwT3B0aW9ucy5iYXRjaE1hbmFnZXIoZGV2aWNlLCB0aGlzLnJvb3QsIHRoaXMuc2NlbmUpO1xuICAgICAgICAgICAgdGhpcy5vbmNlKCdwcmVyZW5kZXInLCB0aGlzLl9maXJzdEJhdGNoLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUga2V5Ym9hcmQgZGV2aWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC9rZXlib2FyZC5qcycpLktleWJvYXJkfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5rZXlib2FyZCA9IGFwcE9wdGlvbnMua2V5Ym9hcmQgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIG1vdXNlIGRldmljZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQvbW91c2UuanMnKS5Nb3VzZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubW91c2UgPSBhcHBPcHRpb25zLm1vdXNlIHx8IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZWQgdG8gZ2V0IHRvdWNoIGV2ZW50cyBpbnB1dC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQvdG91Y2gtZGV2aWNlLmpzJykuVG91Y2hEZXZpY2V9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRvdWNoID0gYXBwT3B0aW9ucy50b3VjaCB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVc2VkIHRvIGFjY2VzcyBHYW1lUGFkIGlucHV0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC9nYW1lLXBhZHMuanMnKS5HYW1lUGFkc31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZ2FtZXBhZHMgPSBhcHBPcHRpb25zLmdhbWVwYWRzIHx8IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZWQgdG8gaGFuZGxlIGlucHV0IGZvciB7QGxpbmsgRWxlbWVudENvbXBvbmVudH1zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2lucHV0L2VsZW1lbnQtaW5wdXQuanMnKS5FbGVtZW50SW5wdXR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dCA9IGFwcE9wdGlvbnMuZWxlbWVudElucHV0IHx8IG51bGw7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRJbnB1dClcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudElucHV0LmFwcCA9IHRoaXM7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBYUiBNYW5hZ2VyIHRoYXQgcHJvdmlkZXMgYWJpbGl0eSB0byBzdGFydCBWUi9BUiBzZXNzaW9ucy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi94ci94ci1tYW5hZ2VyLmpzJykuWHJNYW5hZ2VyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBjaGVjayBpZiBWUiBpcyBhdmFpbGFibGVcbiAgICAgICAgICogaWYgKGFwcC54ci5pc0F2YWlsYWJsZShwYy5YUlRZUEVfVlIpKSB7XG4gICAgICAgICAqICAgICAvLyBWUiBpcyBhdmFpbGFibGVcbiAgICAgICAgICogfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy54ciA9IGFwcE9wdGlvbnMueHIgPyBuZXcgYXBwT3B0aW9ucy54cih0aGlzKSA6IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudElucHV0KVxuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuYXR0YWNoU2VsZWN0RXZlbnRzKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9pblRvb2xzID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtBc3NldHxudWxsfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zY3JpcHRQcmVmaXggPSBhcHBPcHRpb25zLnNjcmlwdFByZWZpeCB8fCAnJztcblxuICAgICAgICBpZiAodGhpcy5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRlci5hZGRIYW5kbGVyKFwiYnVuZGxlXCIsIG5ldyBCdW5kbGVIYW5kbGVyKHRoaXMpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgcmVnaXN0ZXIgYWxsIHJlcXVpcmVkIHJlc291cmNlIGhhbmRsZXJzXG4gICAgICAgIGFwcE9wdGlvbnMucmVzb3VyY2VIYW5kbGVycy5mb3JFYWNoKChyZXNvdXJjZUhhbmRsZXIpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGhhbmRsZXIgPSBuZXcgcmVzb3VyY2VIYW5kbGVyKHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIuYWRkSGFuZGxlcihoYW5kbGVyLmhhbmRsZXJUeXBlLCBoYW5kbGVyKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIGNvbXBvbmVudCBzeXN0ZW0gcmVnaXN0cnkuIFRoZSBBcHBsaWNhdGlvbiBjb25zdHJ1Y3RvciBhZGRzIHRoZVxuICAgICAgICAgKiBmb2xsb3dpbmcgY29tcG9uZW50IHN5c3RlbXMgdG8gaXRzIGNvbXBvbmVudCBzeXN0ZW0gcmVnaXN0cnk6XG4gICAgICAgICAqXG4gICAgICAgICAqIC0gYW5pbSAoe0BsaW5rIEFuaW1Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGFuaW1hdGlvbiAoe0BsaW5rIEFuaW1hdGlvbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gYXVkaW9saXN0ZW5lciAoe0BsaW5rIEF1ZGlvTGlzdGVuZXJDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGJ1dHRvbiAoe0BsaW5rIEJ1dHRvbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gY2FtZXJhICh7QGxpbmsgQ2FtZXJhQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBjb2xsaXNpb24gKHtAbGluayBDb2xsaXNpb25Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGVsZW1lbnQgKHtAbGluayBFbGVtZW50Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBsYXlvdXRjaGlsZCAoe0BsaW5rIExheW91dENoaWxkQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBsYXlvdXRncm91cCAoe0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBsaWdodCAoe0BsaW5rIExpZ2h0Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBtb2RlbCAoe0BsaW5rIE1vZGVsQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBwYXJ0aWNsZXN5c3RlbSAoe0BsaW5rIFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSByaWdpZGJvZHkgKHtAbGluayBSaWdpZEJvZHlDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHJlbmRlciAoe0BsaW5rIFJlbmRlckNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2NyZWVuICh7QGxpbmsgU2NyZWVuQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JpcHQgKHtAbGluayBTY3JpcHRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcm9sbGJhciAoe0BsaW5rIFNjcm9sbGJhckNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2Nyb2xsdmlldyAoe0BsaW5rIFNjcm9sbFZpZXdDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNvdW5kICh7QGxpbmsgU291bmRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNwcml0ZSAoe0BsaW5rIFNwcml0ZUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtDb21wb25lbnRTeXN0ZW1SZWdpc3RyeX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2V0IGdsb2JhbCBncmF2aXR5IHRvIHplcm9cbiAgICAgICAgICogdGhpcy5hcHAuc3lzdGVtcy5yaWdpZGJvZHkuZ3Jhdml0eS5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCB0aGUgZ2xvYmFsIHNvdW5kIHZvbHVtZSB0byA1MCVcbiAgICAgICAgICogdGhpcy5hcHAuc3lzdGVtcy5zb3VuZC52b2x1bWUgPSAwLjU7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnN5c3RlbXMgPSBuZXcgQ29tcG9uZW50U3lzdGVtUmVnaXN0cnkoKTtcblxuICAgICAgICAvLyBjcmVhdGUgYW5kIHJlZ2lzdGVyIGFsbCByZXF1aXJlZCBjb21wb25lbnQgc3lzdGVtc1xuICAgICAgICBhcHBPcHRpb25zLmNvbXBvbmVudFN5c3RlbXMuZm9yRWFjaCgoY29tcG9uZW50U3lzdGVtKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMuYWRkKG5ldyBjb21wb25lbnRTeXN0ZW0odGhpcykpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIgPSB0aGlzLm9uVmlzaWJpbGl0eUNoYW5nZS5iaW5kKHRoaXMpO1xuXG4gICAgICAgIC8vIERlcGVuZGluZyBvbiBicm93c2VyIGFkZCB0aGUgY29ycmVjdCB2aXNpYmlsaXR5Y2hhbmdlIGV2ZW50IGFuZCBzdG9yZSB0aGUgbmFtZSBvZiB0aGVcbiAgICAgICAgLy8gaGlkZGVuIGF0dHJpYnV0ZSBpbiB0aGlzLl9oaWRkZW5BdHRyLlxuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LmhpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICdoaWRkZW4nO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkb2N1bWVudC5tb3pIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnbW96SGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3p2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQubXNIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnbXNIaWRkZW4nO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21zdmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRvY3VtZW50LndlYmtpdEhpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICd3ZWJraXRIaWRkZW4nO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3dlYmtpdHZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gYmluZCB0aWNrIGZ1bmN0aW9uIHRvIGN1cnJlbnQgc2NvcGVcbiAgICAgICAgLyogZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVzZS1iZWZvcmUtZGVmaW5lICovXG4gICAgICAgIHRoaXMudGljayA9IG1ha2VUaWNrKHRoaXMpOyAvLyBDaXJjdWxhciBsaW50aW5nIGlzc3VlIGFzIG1ha2VUaWNrIGFuZCBBcHBsaWNhdGlvbiByZWZlcmVuY2UgZWFjaCBvdGhlclxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQHN0YXRpY1xuICAgICAqIEBuYW1lIGFwcFxuICAgICAqIEB0eXBlIHtBcHBCYXNlfHVuZGVmaW5lZH1cbiAgICAgKiBAZGVzY3JpcHRpb24gR2V0cyB0aGUgY3VycmVudCBhcHBsaWNhdGlvbiwgaWYgYW55LlxuICAgICAqL1xuXG4gICAgc3RhdGljIF9hcHBsaWNhdGlvbnMgPSB7fTtcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgY3VycmVudCBhcHBsaWNhdGlvbi4gSW4gdGhlIGNhc2Ugd2hlcmUgdGhlcmUgYXJlIG11bHRpcGxlIHJ1bm5pbmcgYXBwbGljYXRpb25zLCB0aGVcbiAgICAgKiBmdW5jdGlvbiBjYW4gZ2V0IGFuIGFwcGxpY2F0aW9uIGJhc2VkIG9uIGEgc3VwcGxpZWQgY2FudmFzIGlkLiBUaGlzIGZ1bmN0aW9uIGlzIHBhcnRpY3VsYXJseVxuICAgICAqIHVzZWZ1bCB3aGVuIHRoZSBjdXJyZW50IEFwcGxpY2F0aW9uIGlzIG5vdCByZWFkaWx5IGF2YWlsYWJsZS4gRm9yIGV4YW1wbGUsIGluIHRoZSBKYXZhU2NyaXB0XG4gICAgICogY29uc29sZSBvZiB0aGUgYnJvd3NlcidzIGRldmVsb3BlciB0b29scy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbaWRdIC0gSWYgZGVmaW5lZCwgdGhlIHJldHVybmVkIGFwcGxpY2F0aW9uIHNob3VsZCB1c2UgdGhlIGNhbnZhcyB3aGljaCBoYXNcbiAgICAgKiB0aGlzIGlkLiBPdGhlcndpc2UgY3VycmVudCBhcHBsaWNhdGlvbiB3aWxsIGJlIHJldHVybmVkLlxuICAgICAqIEByZXR1cm5zIHtBcHBCYXNlfHVuZGVmaW5lZH0gVGhlIHJ1bm5pbmcgYXBwbGljYXRpb24sIGlmIGFueS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBhcHAgPSBwYy5BcHBCYXNlLmdldEFwcGxpY2F0aW9uKCk7XG4gICAgICovXG4gICAgc3RhdGljIGdldEFwcGxpY2F0aW9uKGlkKSB7XG4gICAgICAgIHJldHVybiBpZCA/IEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tpZF0gOiBnZXRBcHBsaWNhdGlvbigpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9pbml0RGVmYXVsdE1hdGVyaWFsKCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSBcIkRlZmF1bHQgTWF0ZXJpYWxcIjtcbiAgICAgICAgbWF0ZXJpYWwuc2hhZGluZ01vZGVsID0gU1BFQ1VMQVJfQkxJTk47XG4gICAgICAgIHNldERlZmF1bHRNYXRlcmlhbCh0aGlzLmdyYXBoaWNzRGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2luaXRQcm9ncmFtTGlicmFyeSgpIHtcbiAgICAgICAgY29uc3QgbGlicmFyeSA9IG5ldyBQcm9ncmFtTGlicmFyeSh0aGlzLmdyYXBoaWNzRGV2aWNlLCBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpKTtcbiAgICAgICAgc2V0UHJvZ3JhbUxpYnJhcnkodGhpcy5ncmFwaGljc0RldmljZSwgbGlicmFyeSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHNvdW5kTWFuYWdlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NvdW5kTWFuYWdlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBiYXRjaCBtYW5hZ2VyLiBUaGUgYmF0Y2ggbWFuYWdlciBpcyB1c2VkIHRvIG1lcmdlIG1lc2ggaW5zdGFuY2VzIGluXG4gICAgICogdGhlIHNjZW5lLCB3aGljaCByZWR1Y2VzIHRoZSBvdmVyYWxsIG51bWJlciBvZiBkcmF3IGNhbGxzLCB0aGVyZWJ5IGJvb3N0aW5nIHBlcmZvcm1hbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtbWFuYWdlci5qcycpLkJhdGNoTWFuYWdlcn1cbiAgICAgKi9cbiAgICBnZXQgYmF0Y2hlcigpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuX2JhdGNoZXIsIFwiQmF0Y2hNYW5hZ2VyIGhhcyBub3QgYmVlbiBjcmVhdGVkIGFuZCBpcyByZXF1aXJlZCBmb3IgY29ycmVjdCBmdW5jdGlvbmFsaXR5LlwiKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgZmlsbCBtb2RlIG9mIHRoZSBjYW52YXMuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX05PTkV9OiB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0ZJTExfV0lORE9XfTogdGhlIGNhbnZhcyB3aWxsIHNpbXBseSBmaWxsIHRoZSB3aW5kb3csIGNoYW5naW5nIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9LRUVQX0FTUEVDVH06IHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0IGNhbiB3aGlsZVxuICAgICAqIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCBmaWxsTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbGxNb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IHJlc29sdXRpb24gbW9kZSBvZiB0aGUgY2FudmFzLCBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0FVVE99OiBpZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBub3QgcHJvdmlkZWQsIGNhbnZhcyB3aWxsIGJlIHJlc2l6ZWQgdG9cbiAgICAgKiBtYXRjaCBjYW52YXMgY2xpZW50IHNpemUuXG4gICAgICogLSB7QGxpbmsgUkVTT0xVVElPTl9GSVhFRH06IHJlc29sdXRpb24gb2YgY2FudmFzIHdpbGwgYmUgZml4ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCByZXNvbHV0aW9uTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc29sdXRpb25Nb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgdGhlIGFwcGxpY2F0aW9uIGNvbmZpZ3VyYXRpb24gZmlsZSBhbmQgYXBwbHkgYXBwbGljYXRpb24gcHJvcGVydGllcyBhbmQgZmlsbCB0aGUgYXNzZXRcbiAgICAgKiByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIG9mIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0NvbmZpZ3VyZUFwcENhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgY29uZmlndXJhdGlvbiBmaWxlIGlzXG4gICAgICogbG9hZGVkIGFuZCBwYXJzZWQgKG9yIGFuIGVycm9yIG9jY3VycykuXG4gICAgICovXG4gICAgY29uZmlndXJlKHVybCwgY2FsbGJhY2spIHtcbiAgICAgICAgaHR0cC5nZXQodXJsLCAoZXJyLCByZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcm9wcyA9IHJlc3BvbnNlLmFwcGxpY2F0aW9uX3Byb3BlcnRpZXM7XG4gICAgICAgICAgICBjb25zdCBzY2VuZXMgPSByZXNwb25zZS5zY2VuZXM7XG4gICAgICAgICAgICBjb25zdCBhc3NldHMgPSByZXNwb25zZS5hc3NldHM7XG5cbiAgICAgICAgICAgIHRoaXMuX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzKHByb3BzLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VTY2VuZXMoc2NlbmVzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFzc2V0cyhhc3NldHMpO1xuICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYWxsIGFzc2V0cyBpbiB0aGUgYXNzZXQgcmVnaXN0cnkgdGhhdCBhcmUgbWFya2VkIGFzICdwcmVsb2FkJy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UHJlbG9hZEFwcENhbGxiYWNrfSBjYWxsYmFjayAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIGFsbCBhc3NldHMgYXJlIGxvYWRlZC5cbiAgICAgKi9cbiAgICBwcmVsb2FkKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6c3RhcnRcIik7XG5cbiAgICAgICAgLy8gZ2V0IGxpc3Qgb2YgYXNzZXRzIHRvIHByZWxvYWRcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5hc3NldHMubGlzdCh7XG4gICAgICAgICAgICBwcmVsb2FkOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKGFzc2V0cy5sZW5ndGgpO1xuXG4gICAgICAgIGxldCBfZG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGNoZWNrIGlmIGFsbCBsb2FkaW5nIGlzIGRvbmVcbiAgICAgICAgY29uc3QgZG9uZSA9ICgpID0+IHtcbiAgICAgICAgICAgIC8vIGRvIG5vdCBwcm9jZWVkIGlmIGFwcGxpY2F0aW9uIGRlc3Ryb3llZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIV9kb25lICYmIHByb2dyZXNzLmRvbmUoKSkge1xuICAgICAgICAgICAgICAgIF9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoXCJwcmVsb2FkOmVuZFwiKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHRvdGFscyBsb2FkaW5nIHByb2dyZXNzIG9mIGFzc2V0c1xuICAgICAgICBjb25zdCB0b3RhbCA9IGFzc2V0cy5sZW5ndGg7XG5cbiAgICAgICAgaWYgKHByb2dyZXNzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3Qgb25Bc3NldExvYWQgPSAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3ByZWxvYWQ6cHJvZ3Jlc3MnLCBwcm9ncmVzcy5jb3VudCAvIHRvdGFsKTtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG9uQXNzZXRFcnJvciA9IChlcnIsIGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdwcmVsb2FkOnByb2dyZXNzJywgcHJvZ3Jlc3MuY291bnQgLyB0b3RhbCk7XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MuZG9uZSgpKVxuICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBmb3IgZWFjaCBhc3NldFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0c1tpXS5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2ldLm9uY2UoJ2xvYWQnLCBvbkFzc2V0TG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0c1tpXS5vbmNlKCdlcnJvcicsIG9uQXNzZXRFcnJvcik7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hc3NldHMubG9hZChhc3NldHNbaV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzLmluYygpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoXCJwcmVsb2FkOnByb2dyZXNzXCIsIHByb2dyZXNzLmNvdW50IC8gdG90YWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3ByZWxvYWRTY3JpcHRzKHNjZW5lRGF0YSwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCFzY3JpcHQubGVnYWN5KSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBzY3JpcHRzID0gdGhpcy5fZ2V0U2NyaXB0UmVmZXJlbmNlcyhzY2VuZURhdGEpO1xuXG4gICAgICAgIGNvbnN0IGwgPSBzY3JpcHRzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MobCk7XG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gL15odHRwKHMpPzpcXC9cXC8vO1xuXG4gICAgICAgIGlmIChsKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSAoZXJyLCBTY3JpcHRUeXBlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGxldCBzY3JpcHRVcmwgPSBzY3JpcHRzW2ldO1xuICAgICAgICAgICAgICAgIC8vIHN1cHBvcnQgYWJzb2x1dGUgVVJMcyAoZm9yIG5vdylcbiAgICAgICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3Qoc2NyaXB0VXJsLnRvTG93ZXJDYXNlKCkpICYmIHRoaXMuX3NjcmlwdFByZWZpeClcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0VXJsID0gcGF0aC5qb2luKHRoaXMuX3NjcmlwdFByZWZpeCwgc2NyaXB0c1tpXSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRlci5sb2FkKHNjcmlwdFVybCwgJ3NjcmlwdCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXQgYXBwbGljYXRpb24gcHJvcGVydGllcyBmcm9tIGRhdGEgZmlsZVxuICAgIF9wYXJzZUFwcGxpY2F0aW9uUHJvcGVydGllcyhwcm9wcywgY2FsbGJhY2spIHtcbiAgICAgICAgLy8gY29uZmlndXJlIHJldHJ5aW5nIGFzc2V0c1xuICAgICAgICBpZiAodHlwZW9mIHByb3BzLm1heEFzc2V0UmV0cmllcyA9PT0gJ251bWJlcicgJiYgcHJvcHMubWF4QXNzZXRSZXRyaWVzID4gMCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIuZW5hYmxlUmV0cnkocHJvcHMubWF4QXNzZXRSZXRyaWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIHRlbXBvcmFyeSBibG9jayBhZnRlciBtaWdyYXRpbmcgcHJvcGVydGllc1xuICAgICAgICBpZiAoIXByb3BzLnVzZURldmljZVBpeGVsUmF0aW8pXG4gICAgICAgICAgICBwcm9wcy51c2VEZXZpY2VQaXhlbFJhdGlvID0gcHJvcHMudXNlX2RldmljZV9waXhlbF9yYXRpbztcbiAgICAgICAgaWYgKCFwcm9wcy5yZXNvbHV0aW9uTW9kZSlcbiAgICAgICAgICAgIHByb3BzLnJlc29sdXRpb25Nb2RlID0gcHJvcHMucmVzb2x1dGlvbl9tb2RlO1xuICAgICAgICBpZiAoIXByb3BzLmZpbGxNb2RlKVxuICAgICAgICAgICAgcHJvcHMuZmlsbE1vZGUgPSBwcm9wcy5maWxsX21vZGU7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSBwcm9wcy53aWR0aDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gcHJvcHMuaGVpZ2h0O1xuICAgICAgICBpZiAocHJvcHMudXNlRGV2aWNlUGl4ZWxSYXRpbykge1xuICAgICAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5tYXhQaXhlbFJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldENhbnZhc1Jlc29sdXRpb24ocHJvcHMucmVzb2x1dGlvbk1vZGUsIHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQpO1xuICAgICAgICB0aGlzLnNldENhbnZhc0ZpbGxNb2RlKHByb3BzLmZpbGxNb2RlLCB0aGlzLl93aWR0aCwgdGhpcy5faGVpZ2h0KTtcblxuICAgICAgICAvLyBzZXQgdXAgbGF5ZXJzXG4gICAgICAgIGlmIChwcm9wcy5sYXllcnMgJiYgcHJvcHMubGF5ZXJPcmRlcikge1xuICAgICAgICAgICAgY29uc3QgY29tcG9zaXRpb24gPSBuZXcgTGF5ZXJDb21wb3NpdGlvbihcImFwcGxpY2F0aW9uXCIpO1xuXG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHByb3BzLmxheWVycykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBwcm9wcy5sYXllcnNba2V5XTtcbiAgICAgICAgICAgICAgICBkYXRhLmlkID0gcGFyc2VJbnQoa2V5LCAxMCk7XG4gICAgICAgICAgICAgICAgLy8gZGVwdGggbGF5ZXIgc2hvdWxkIG9ubHkgYmUgZW5hYmxlZCB3aGVuIG5lZWRlZFxuICAgICAgICAgICAgICAgIC8vIGJ5IGluY3JlbWVudGluZyBpdHMgcmVmIGNvdW50ZXJcbiAgICAgICAgICAgICAgICBkYXRhLmVuYWJsZWQgPSBkYXRhLmlkICE9PSBMQVlFUklEX0RFUFRIO1xuICAgICAgICAgICAgICAgIGxheWVyc1trZXldID0gbmV3IExheWVyKGRhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcHJvcHMubGF5ZXJPcmRlci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1YmxheWVyID0gcHJvcHMubGF5ZXJPcmRlcltpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyc1tzdWJsYXllci5sYXllcl07XG4gICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3VibGF5ZXIudHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9zaXRpb24ucHVzaFRyYW5zcGFyZW50KGxheWVyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5wdXNoT3BhcXVlKGxheWVyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5zdWJMYXllckVuYWJsZWRbaV0gPSBzdWJsYXllci5lbmFibGVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNjZW5lLmxheWVycyA9IGNvbXBvc2l0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIGJhdGNoIGdyb3Vwc1xuICAgICAgICBpZiAocHJvcHMuYmF0Y2hHcm91cHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoZXIgPSB0aGlzLmJhdGNoZXI7XG4gICAgICAgICAgICBpZiAoYmF0Y2hlcikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wcy5iYXRjaEdyb3Vwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBncnAgPSBwcm9wcy5iYXRjaEdyb3Vwc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgYmF0Y2hlci5hZGRHcm91cChncnAubmFtZSwgZ3JwLmR5bmFtaWMsIGdycC5tYXhBYWJiU2l6ZSwgZ3JwLmlkLCBncnAubGF5ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgbG9jYWxpemF0aW9uIGFzc2V0c1xuICAgICAgICBpZiAocHJvcHMuaTE4bkFzc2V0cykge1xuICAgICAgICAgICAgdGhpcy5pMThuLmFzc2V0cyA9IHByb3BzLmkxOG5Bc3NldHM7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2FkTGlicmFyaWVzKHByb3BzLmxpYnJhcmllcywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IHVybHMgLSBMaXN0IG9mIFVSTHMgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIENhbGxiYWNrIGZ1bmN0aW9uLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvYWRMaWJyYXJpZXModXJscywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbGVuID0gdXJscy5sZW5ndGg7XG4gICAgICAgIGxldCBjb3VudCA9IGxlbjtcblxuICAgICAgICBjb25zdCByZWdleCA9IC9eaHR0cChzKT86XFwvXFwvLztcblxuICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSAoZXJyLCBzY3JpcHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb3VudC0tO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgICAgIGxldCB1cmwgPSB1cmxzW2ldO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFyZWdleC50ZXN0KHVybC50b0xvd2VyQ2FzZSgpKSAmJiB0aGlzLl9zY3JpcHRQcmVmaXgpXG4gICAgICAgICAgICAgICAgICAgIHVybCA9IHBhdGguam9pbih0aGlzLl9zY3JpcHRQcmVmaXgsIHVybCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwgJ3NjcmlwdCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm9uTGlicmFyaWVzTG9hZGVkKCk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydCBzY2VuZSBuYW1lL3VybHMgaW50byB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHNjZW5lcyAtIFNjZW5lcyB0byBhZGQgdG8gdGhlIHNjZW5lIHJlZ2lzdHJ5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlU2NlbmVzKHNjZW5lcykge1xuICAgICAgICBpZiAoIXNjZW5lcykgcmV0dXJuO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NlbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lcy5hZGQoc2NlbmVzW2ldLm5hbWUsIHNjZW5lc1tpXS51cmwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IGFzc2V0cyBpbnRvIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSBhc3NldHMgLSBBc3NldHMgdG8gaW5zZXJ0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlQXNzZXRzKGFzc2V0cykge1xuICAgICAgICBjb25zdCBsaXN0ID0gW107XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0c0luZGV4ID0ge307XG4gICAgICAgIGNvbnN0IGJ1bmRsZXNJbmRleCA9IHt9O1xuXG4gICAgICAgIGlmICghc2NyaXB0LmxlZ2FjeSkge1xuICAgICAgICAgICAgLy8gYWRkIHNjcmlwdHMgaW4gb3JkZXIgb2YgbG9hZGluZyBmaXJzdFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNjcmlwdHNPcmRlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gdGhpcy5zY3JpcHRzT3JkZXJbaV07XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldHNbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIHNjcmlwdHNJbmRleFtpZF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgYnVuZGxlc1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlQnVuZGxlcykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldHNbaWRdLnR5cGUgPT09ICdidW5kbGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidW5kbGVzSW5kZXhbaWRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgcmVzdCBvZiBhc3NldHNcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdHNJbmRleFtpZF0gfHwgYnVuZGxlc0luZGV4W2lkXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIGJ1bmRsZXNcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRzW2lkXS50eXBlID09PSAnYnVuZGxlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVuZGxlc0luZGV4W2lkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRoZW4gYWRkIHJlc3Qgb2YgYXNzZXRzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgIGlmIChidW5kbGVzSW5kZXhbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGxpc3RbaV07XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IG5ldyBBc3NldChkYXRhLm5hbWUsIGRhdGEudHlwZSwgZGF0YS5maWxlLCBkYXRhLmRhdGEpO1xuICAgICAgICAgICAgYXNzZXQuaWQgPSBwYXJzZUludChkYXRhLmlkLCAxMCk7XG4gICAgICAgICAgICBhc3NldC5wcmVsb2FkID0gZGF0YS5wcmVsb2FkID8gZGF0YS5wcmVsb2FkIDogZmFsc2U7XG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGEgc2NyaXB0IGFzc2V0IGFuZCBoYXMgYWxyZWFkeSBiZWVuIGVtYmVkZGVkIGluIHRoZSBwYWdlIHRoZW5cbiAgICAgICAgICAgIC8vIG1hcmsgaXQgYXMgbG9hZGVkXG4gICAgICAgICAgICBhc3NldC5sb2FkZWQgPSBkYXRhLnR5cGUgPT09ICdzY3JpcHQnICYmIGRhdGEuZGF0YSAmJiBkYXRhLmRhdGEubG9hZGluZ1R5cGUgPiAwO1xuICAgICAgICAgICAgLy8gdGFnc1xuICAgICAgICAgICAgYXNzZXQudGFncy5hZGQoZGF0YS50YWdzKTtcbiAgICAgICAgICAgIC8vIGkxOG5cbiAgICAgICAgICAgIGlmIChkYXRhLmkxOG4pIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxvY2FsZSBpbiBkYXRhLmkxOG4pIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQuYWRkTG9jYWxpemVkQXNzZXRJZChsb2NhbGUsIGRhdGEuaTE4bltsb2NhbGVdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyByZWdpc3RyeVxuICAgICAgICAgICAgdGhpcy5hc3NldHMuYWRkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gLSBUaGUgbGlzdCBvZiBzY3JpcHRzIHRoYXQgYXJlIHJlZmVyZW5jZWQgYnkgdGhlIHNjZW5lLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFNjcmlwdFJlZmVyZW5jZXMoc2NlbmUpIHtcbiAgICAgICAgbGV0IHByaW9yaXR5U2NyaXB0cyA9IFtdO1xuICAgICAgICBpZiAoc2NlbmUuc2V0dGluZ3MucHJpb3JpdHlfc2NyaXB0cykge1xuICAgICAgICAgICAgcHJpb3JpdHlTY3JpcHRzID0gc2NlbmUuc2V0dGluZ3MucHJpb3JpdHlfc2NyaXB0cztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IF9zY3JpcHRzID0gW107XG4gICAgICAgIGNvbnN0IF9pbmRleCA9IHt9O1xuXG4gICAgICAgIC8vIGZpcnN0IGFkZCBwcmlvcml0eSBzY3JpcHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJpb3JpdHlTY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBfc2NyaXB0cy5wdXNoKHByaW9yaXR5U2NyaXB0c1tpXSk7XG4gICAgICAgICAgICBfaW5kZXhbcHJpb3JpdHlTY3JpcHRzW2ldXSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0aGVuIGl0ZXJhdGUgaGllcmFyY2h5IHRvIGdldCByZWZlcmVuY2VkIHNjcmlwdHNcbiAgICAgICAgY29uc3QgZW50aXRpZXMgPSBzY2VuZS5lbnRpdGllcztcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZW50aXRpZXMpIHtcbiAgICAgICAgICAgIGlmICghZW50aXRpZXNba2V5XS5jb21wb25lbnRzLnNjcmlwdCkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzY3JpcHRzID0gZW50aXRpZXNba2V5XS5jb21wb25lbnRzLnNjcmlwdC5zY3JpcHRzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKF9pbmRleFtzY3JpcHRzW2ldLnVybF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIF9zY3JpcHRzLnB1c2goc2NyaXB0c1tpXS51cmwpO1xuICAgICAgICAgICAgICAgIF9pbmRleFtzY3JpcHRzW2ldLnVybF0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9zY3JpcHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IHRoZSBhcHBsaWNhdGlvbi4gVGhpcyBmdW5jdGlvbiBkb2VzIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAxLiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ3N0YXJ0J1xuICAgICAqIDIuIENhbGxzIGluaXRpYWxpemUgZm9yIGFsbCBjb21wb25lbnRzIG9uIGVudGl0aWVzIGluIHRoZSBoaWVyYXJjaHlcbiAgICAgKiAzLiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ2luaXRpYWxpemUnXG4gICAgICogNC4gQ2FsbHMgcG9zdEluaXRpYWxpemUgZm9yIGFsbCBjb21wb25lbnRzIG9uIGVudGl0aWVzIGluIHRoZSBoaWVyYXJjaHlcbiAgICAgKiA1LiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ3Bvc3Rpbml0aWFsaXplJ1xuICAgICAqIDYuIFN0YXJ0cyBleGVjdXRpbmcgdGhlIG1haW4gbG9vcCBvZiB0aGUgYXBwbGljYXRpb25cbiAgICAgKlxuICAgICAqIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGludGVybmFsbHkgYnkgUGxheUNhbnZhcyBhcHBsaWNhdGlvbnMgbWFkZSBpbiB0aGUgRWRpdG9yIGJ1dCB5b3VcbiAgICAgKiB3aWxsIG5lZWQgdG8gY2FsbCBzdGFydCB5b3Vyc2VsZiBpZiB5b3UgYXJlIHVzaW5nIHRoZSBlbmdpbmUgc3RhbmQtYWxvbmUuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5zdGFydCgpO1xuICAgICAqL1xuICAgIHN0YXJ0KCkge1xuICAgICAgICB0aGlzLmZyYW1lID0gMDtcblxuICAgICAgICB0aGlzLmZpcmUoXCJzdGFydFwiLCB7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5vdygpLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICghdGhpcy5fbGlicmFyaWVzTG9hZGVkKSB7XG4gICAgICAgICAgICB0aGlzLm9uTGlicmFyaWVzTG9hZGVkKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgnaW5pdGlhbGl6ZScsIHRoaXMucm9vdCk7XG4gICAgICAgIHRoaXMuZmlyZSgnaW5pdGlhbGl6ZScpO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdwb3N0SW5pdGlhbGl6ZScsIHRoaXMucm9vdCk7XG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdwb3N0UG9zdEluaXRpYWxpemUnLCB0aGlzLnJvb3QpO1xuICAgICAgICB0aGlzLmZpcmUoJ3Bvc3Rpbml0aWFsaXplJyk7XG5cbiAgICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIGFsbCBpbnB1dCBkZXZpY2VzIG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIHRpbWUgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCB1cGRhdGUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBpbnB1dFVwZGF0ZShkdCkge1xuICAgICAgICBpZiAodGhpcy5jb250cm9sbGVyKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIudXBkYXRlKGR0KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5tb3VzZSkge1xuICAgICAgICAgICAgdGhpcy5tb3VzZS51cGRhdGUoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5rZXlib2FyZCkge1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZC51cGRhdGUoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5nYW1lcGFkcykge1xuICAgICAgICAgICAgdGhpcy5nYW1lcGFkcy51cGRhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSB0aGUgYXBwbGljYXRpb24uIFRoaXMgZnVuY3Rpb24gd2lsbCBjYWxsIHRoZSB1cGRhdGUgZnVuY3Rpb25zIGFuZCB0aGVuIHRoZSBwb3N0VXBkYXRlXG4gICAgICogZnVuY3Rpb25zIG9mIGFsbCBlbmFibGVkIGNvbXBvbmVudHMuIEl0IHdpbGwgdGhlbiB1cGRhdGUgdGhlIGN1cnJlbnQgc3RhdGUgb2YgYWxsIGNvbm5lY3RlZFxuICAgICAqIGlucHV0IGRldmljZXMuIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGludGVybmFsbHkgaW4gdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wIGFuZCBkb2VzXG4gICAgICogbm90IG5lZWQgdG8gYmUgY2FsbGVkIGV4cGxpY2l0bHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgdGltZSBkZWx0YSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqL1xuICAgIHVwZGF0ZShkdCkge1xuICAgICAgICB0aGlzLmZyYW1lKys7XG5cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS51cGRhdGVDbGllbnRSZWN0KCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnVwZGF0ZVN0YXJ0ID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIFBlcmZvcm0gQ29tcG9uZW50U3lzdGVtIHVwZGF0ZVxuICAgICAgICBpZiAoc2NyaXB0LmxlZ2FjeSlcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdmaXhlZFVwZGF0ZScsIDEuMCAvIDYwLjApO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKHRoaXMuX2luVG9vbHMgPyAndG9vbHNVcGRhdGUnIDogJ3VwZGF0ZScsIGR0KTtcbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ2FuaW1hdGlvblVwZGF0ZScsIGR0KTtcbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ3Bvc3RVcGRhdGUnLCBkdCk7XG5cbiAgICAgICAgLy8gZmlyZSB1cGRhdGUgZXZlbnRcbiAgICAgICAgdGhpcy5maXJlKFwidXBkYXRlXCIsIGR0KTtcblxuICAgICAgICAvLyB1cGRhdGUgaW5wdXQgZGV2aWNlc1xuICAgICAgICB0aGlzLmlucHV0VXBkYXRlKGR0KTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUudXBkYXRlVGltZSA9IG5vdygpIC0gdGhpcy5zdGF0cy5mcmFtZS51cGRhdGVTdGFydDtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHRoZSBhcHBsaWNhdGlvbidzIHNjZW5lLiBNb3JlIHNwZWNpZmljYWxseSwgdGhlIHNjZW5lJ3Mge0BsaW5rIExheWVyQ29tcG9zaXRpb259IGlzXG4gICAgICogcmVuZGVyZWQuIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGludGVybmFsbHkgaW4gdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wIGFuZCBkb2VzIG5vdFxuICAgICAqIG5lZWQgdG8gYmUgY2FsbGVkIGV4cGxpY2l0bHkuXG4gICAgICovXG4gICAgcmVuZGVyKCkge1xuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUucmVuZGVyU3RhcnQgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgdGhpcy5maXJlKCdwcmVyZW5kZXInKTtcbiAgICAgICAgdGhpcy5yb290LnN5bmNIaWVyYXJjaHkoKTtcblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hlcikge1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlci51cGRhdGVBbGwoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgRm9yd2FyZFJlbmRlcmVyLl9za2lwUmVuZGVyQ291bnRlciA9IDA7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIHJlbmRlciB0aGUgc2NlbmUgY29tcG9zaXRpb25cbiAgICAgICAgdGhpcy5yZW5kZXJDb21wb3NpdGlvbih0aGlzLnNjZW5lLmxheWVycyk7XG5cbiAgICAgICAgdGhpcy5maXJlKCdwb3N0cmVuZGVyJyk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnJlbmRlclRpbWUgPSBub3coKSAtIHRoaXMuc3RhdHMuZnJhbWUucmVuZGVyU3RhcnQ7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8vIHJlbmRlciBhIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgcmVuZGVyQ29tcG9zaXRpb24obGF5ZXJDb21wb3NpdGlvbikge1xuICAgICAgICB0aGlzLnJlbmRlcmVyLmJ1aWxkRnJhbWVHcmFwaCh0aGlzLmZyYW1lR3JhcGgsIGxheWVyQ29tcG9zaXRpb24pO1xuICAgICAgICB0aGlzLmZyYW1lR3JhcGgucmVuZGVyKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5vdyAtIFRoZSB0aW1lc3RhbXAgcGFzc2VkIHRvIHRoZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIHRpbWUgZGVsdGEgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS4gVGhpcyBpcyBzdWJqZWN0IHRvIHRoZVxuICAgICAqIGFwcGxpY2F0aW9uJ3MgdGltZSBzY2FsZSBhbmQgbWF4IGRlbHRhIHZhbHVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbXMgLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZmlsbEZyYW1lU3RhdHNCYXNpYyhub3csIGR0LCBtcykge1xuICAgICAgICAvLyBUaW1pbmcgc3RhdHNcbiAgICAgICAgY29uc3Qgc3RhdHMgPSB0aGlzLnN0YXRzLmZyYW1lO1xuICAgICAgICBzdGF0cy5kdCA9IGR0O1xuICAgICAgICBzdGF0cy5tcyA9IG1zO1xuICAgICAgICBpZiAobm93ID4gc3RhdHMuX3RpbWVUb0NvdW50RnJhbWVzKSB7XG4gICAgICAgICAgICBzdGF0cy5mcHMgPSBzdGF0cy5fZnBzQWNjdW07XG4gICAgICAgICAgICBzdGF0cy5fZnBzQWNjdW0gPSAwO1xuICAgICAgICAgICAgc3RhdHMuX3RpbWVUb0NvdW50RnJhbWVzID0gbm93ICsgMTAwMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRzLl9mcHNBY2N1bSsrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdG90YWwgZHJhdyBjYWxsXG4gICAgICAgIHRoaXMuc3RhdHMuZHJhd0NhbGxzLnRvdGFsID0gdGhpcy5ncmFwaGljc0RldmljZS5fZHJhd0NhbGxzUGVyRnJhbWU7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuX2RyYXdDYWxsc1BlckZyYW1lID0gMDtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZmlsbEZyYW1lU3RhdHMoKSB7XG4gICAgICAgIGxldCBzdGF0cyA9IHRoaXMuc3RhdHMuZnJhbWU7XG5cbiAgICAgICAgLy8gUmVuZGVyIHN0YXRzXG4gICAgICAgIHN0YXRzLmNhbWVyYXMgPSB0aGlzLnJlbmRlcmVyLl9jYW1lcmFzUmVuZGVyZWQ7XG4gICAgICAgIHN0YXRzLm1hdGVyaWFscyA9IHRoaXMucmVuZGVyZXIuX21hdGVyaWFsU3dpdGNoZXM7XG4gICAgICAgIHN0YXRzLnNoYWRlcnMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy5zaGFkb3dNYXBVcGRhdGVzID0gdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcztcbiAgICAgICAgc3RhdHMuc2hhZG93TWFwVGltZSA9IHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWU7XG4gICAgICAgIHN0YXRzLmRlcHRoTWFwVGltZSA9IHRoaXMucmVuZGVyZXIuX2RlcHRoTWFwVGltZTtcbiAgICAgICAgc3RhdHMuZm9yd2FyZFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZTtcbiAgICAgICAgY29uc3QgcHJpbXMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9wcmltc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy50cmlhbmdsZXMgPSBwcmltc1tQUklNSVRJVkVfVFJJQU5HTEVTXSAvIDMgK1xuICAgICAgICAgICAgTWF0aC5tYXgocHJpbXNbUFJJTUlUSVZFX1RSSVNUUklQXSAtIDIsIDApICtcbiAgICAgICAgICAgIE1hdGgubWF4KHByaW1zW1BSSU1JVElWRV9UUklGQU5dIC0gMiwgMCk7XG4gICAgICAgIHN0YXRzLmN1bGxUaW1lID0gdGhpcy5yZW5kZXJlci5fY3VsbFRpbWU7XG4gICAgICAgIHN0YXRzLnNvcnRUaW1lID0gdGhpcy5yZW5kZXJlci5fc29ydFRpbWU7XG4gICAgICAgIHN0YXRzLnNraW5UaW1lID0gdGhpcy5yZW5kZXJlci5fc2tpblRpbWU7XG4gICAgICAgIHN0YXRzLm1vcnBoVGltZSA9IHRoaXMucmVuZGVyZXIuX21vcnBoVGltZTtcbiAgICAgICAgc3RhdHMubGlnaHRDbHVzdGVycyA9IHRoaXMucmVuZGVyZXIuX2xpZ2h0Q2x1c3RlcnM7XG4gICAgICAgIHN0YXRzLmxpZ2h0Q2x1c3RlcnNUaW1lID0gdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVyc1RpbWU7XG4gICAgICAgIHN0YXRzLm90aGVyUHJpbWl0aXZlcyA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJpbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpIDwgUFJJTUlUSVZFX1RSSUFOR0xFUykge1xuICAgICAgICAgICAgICAgIHN0YXRzLm90aGVyUHJpbWl0aXZlcyArPSBwcmltc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByaW1zW2ldID0gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbmRlcmVyLl9jYW1lcmFzUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcyA9IDA7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9jdWxsVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVyc1RpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zb3J0VGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NraW5UaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbW9ycGhUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2RlcHRoTWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lID0gMDtcblxuICAgICAgICAvLyBEcmF3IGNhbGwgc3RhdHNcbiAgICAgICAgc3RhdHMgPSB0aGlzLnN0YXRzLmRyYXdDYWxscztcbiAgICAgICAgc3RhdHMuZm9yd2FyZCA9IHRoaXMucmVuZGVyZXIuX2ZvcndhcmREcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLmN1bGxlZCA9IHRoaXMucmVuZGVyZXIuX251bURyYXdDYWxsc0N1bGxlZDtcbiAgICAgICAgc3RhdHMuZGVwdGggPSAwO1xuICAgICAgICBzdGF0cy5zaGFkb3cgPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dEcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLnNraW5uZWQgPSB0aGlzLnJlbmRlcmVyLl9za2luRHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5pbW1lZGlhdGUgPSAwO1xuICAgICAgICBzdGF0cy5pbnN0YW5jZWQgPSAwO1xuICAgICAgICBzdGF0cy5yZW1vdmVkQnlJbnN0YW5jaW5nID0gMDtcbiAgICAgICAgc3RhdHMubWlzYyA9IHN0YXRzLnRvdGFsIC0gKHN0YXRzLmZvcndhcmQgKyBzdGF0cy5zaGFkb3cpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9kZXB0aERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd0RyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9udW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9za2luRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5faW1tZWRpYXRlUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9pbnN0YW5jZWREcmF3Q2FsbHMgPSAwO1xuXG4gICAgICAgIHRoaXMuc3RhdHMubWlzYy5yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLnJlbmRlclRhcmdldENyZWF0aW9uVGltZTtcblxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHMucGFydGljbGVzO1xuICAgICAgICBzdGF0cy51cGRhdGVzUGVyRnJhbWUgPSBzdGF0cy5fdXBkYXRlc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy5mcmFtZVRpbWUgPSBzdGF0cy5fZnJhbWVUaW1lO1xuICAgICAgICBzdGF0cy5fdXBkYXRlc1BlckZyYW1lID0gMDtcbiAgICAgICAgc3RhdHMuX2ZyYW1lVGltZSA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgaG93IHRoZSBjYW52YXMgZmlsbHMgdGhlIHdpbmRvdyBhbmQgcmVzaXplcyB3aGVuIHRoZSB3aW5kb3cgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIC0gVGhlIG1vZGUgdG8gdXNlIHdoZW4gc2V0dGluZyB0aGUgc2l6ZSBvZiB0aGUgY2FudmFzLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9OT05FfTogdGhlIGNhbnZhcyB3aWxsIGFsd2F5cyBtYXRjaCB0aGUgc2l6ZSBwcm92aWRlZC5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9GSUxMX1dJTkRPV306IHRoZSBjYW52YXMgd2lsbCBzaW1wbHkgZmlsbCB0aGUgd2luZG93LCBjaGFuZ2luZyBhc3BlY3QgcmF0aW8uXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfS0VFUF9BU1BFQ1R9OiB0aGUgY2FudmFzIHdpbGwgZ3JvdyB0byBmaWxsIHRoZSB3aW5kb3cgYXMgYmVzdCBpdCBjYW4gd2hpbGVcbiAgICAgKiBtYWludGFpbmluZyB0aGUgYXNwZWN0IHJhdGlvLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIGNhbnZhcyAob25seSB1c2VkIHdoZW4gbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0pLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyAob25seSB1c2VkIHdoZW4gbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0pLlxuICAgICAqL1xuICAgIHNldENhbnZhc0ZpbGxNb2RlKG1vZGUsIHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgdGhpcy5fZmlsbE1vZGUgPSBtb2RlO1xuICAgICAgICB0aGlzLnJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGFuZ2UgdGhlIHJlc29sdXRpb24gb2YgdGhlIGNhbnZhcywgYW5kIHNldCB0aGUgd2F5IGl0IGJlaGF2ZXMgd2hlbiB0aGUgd2luZG93IGlzIHJlc2l6ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSAtIFRoZSBtb2RlIHRvIHVzZSB3aGVuIHNldHRpbmcgdGhlIHJlc29sdXRpb24uIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fQVVUT306IGlmIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG5vdCBwcm92aWRlZCwgY2FudmFzIHdpbGwgYmUgcmVzaXplZCB0b1xuICAgICAqIG1hdGNoIGNhbnZhcyBjbGllbnQgc2l6ZS5cbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0ZJWEVEfTogcmVzb2x1dGlvbiBvZiBjYW52YXMgd2lsbCBiZSBmaXhlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2lkdGhdIC0gVGhlIGhvcml6b250YWwgcmVzb2x1dGlvbiwgb3B0aW9uYWwgaW4gQVVUTyBtb2RlLCBpZiBub3QgcHJvdmlkZWRcbiAgICAgKiBjYW52YXMgY2xpZW50V2lkdGggaXMgdXNlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgdmVydGljYWwgcmVzb2x1dGlvbiwgb3B0aW9uYWwgaW4gQVVUTyBtb2RlLCBpZiBub3QgcHJvdmlkZWRcbiAgICAgKiBjYW52YXMgY2xpZW50SGVpZ2h0IGlzIHVzZWQuXG4gICAgICovXG4gICAgc2V0Q2FudmFzUmVzb2x1dGlvbihtb2RlLCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuX3Jlc29sdXRpb25Nb2RlID0gbW9kZTtcblxuICAgICAgICAvLyBJbiBBVVRPIG1vZGUgdGhlIHJlc29sdXRpb24gaXMgdGhlIHNhbWUgYXMgdGhlIGNhbnZhcyBzaXplLCB1bmxlc3Mgc3BlY2lmaWVkXG4gICAgICAgIGlmIChtb2RlID09PSBSRVNPTFVUSU9OX0FVVE8gJiYgKHdpZHRoID09PSB1bmRlZmluZWQpKSB7XG4gICAgICAgICAgICB3aWR0aCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLmNsaWVudFdpZHRoO1xuICAgICAgICAgICAgaGVpZ2h0ID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuY2xpZW50SGVpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5yZXNpemVDYW52YXMod2lkdGgsIGhlaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgd2luZG93IG9yIHRhYiBpbiB3aGljaCB0aGUgYXBwbGljYXRpb24gaXMgcnVubmluZy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBhcHBsaWNhdGlvbiBpcyBub3QgdmlzaWJsZSBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGlzSGlkZGVuKCkge1xuICAgICAgICByZXR1cm4gZG9jdW1lbnRbdGhpcy5faGlkZGVuQXR0cl07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIHZpc2liaWxpdHkgc3RhdGUgb2YgdGhlIGN1cnJlbnQgdGFiL3dpbmRvdyBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblZpc2liaWxpdHlDaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmlzSGlkZGVuKCkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIuc3VzcGVuZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NvdW5kTWFuYWdlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5yZXN1bWUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2l6ZSB0aGUgYXBwbGljYXRpb24ncyBjYW52YXMgZWxlbWVudCBpbiBsaW5lIHdpdGggdGhlIGN1cnJlbnQgZmlsbCBtb2RlLlxuICAgICAqXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfS0VFUF9BU1BFQ1R9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0XG4gICAgICogY2FuIHdoaWxlIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfRklMTF9XSU5ET1d9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBzaW1wbHkgZmlsbCB0aGUgd2luZG93LCBjaGFuZ2luZ1xuICAgICAqIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIEluIHtAbGluayBGSUxMTU9ERV9OT05FfSBtb2RlLCB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIGNhbnZhcy4gT25seSB1c2VkIGlmIGN1cnJlbnQgZmlsbCBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgaGVpZ2h0IG9mIHRoZSBjYW52YXMuIE9ubHkgdXNlZCBpZiBjdXJyZW50IGZpbGwgbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0uXG4gICAgICogQHJldHVybnMge29iamVjdH0gQSBvYmplY3QgY29udGFpbmluZyB0aGUgdmFsdWVzIGNhbGN1bGF0ZWQgdG8gdXNlIGFzIHdpZHRoIGFuZCBoZWlnaHQuXG4gICAgICovXG4gICAgcmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbGxvd1Jlc2l6ZSkgcmV0dXJuIHVuZGVmaW5lZDsgLy8gcHJldmVudCByZXNpemluZyAoZS5nLiBpZiBwcmVzZW50aW5nIGluIFZSIEhNRClcblxuICAgICAgICAvLyBwcmV2ZW50IHJlc2l6aW5nIHdoZW4gaW4gWFIgc2Vzc2lvblxuICAgICAgICBpZiAodGhpcy54ciAmJiB0aGlzLnhyLnNlc3Npb24pXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICAgIGNvbnN0IHdpbmRvd1dpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcblxuICAgICAgICBpZiAodGhpcy5fZmlsbE1vZGUgPT09IEZJTExNT0RFX0tFRVBfQVNQRUNUKSB7XG4gICAgICAgICAgICBjb25zdCByID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMud2lkdGggLyB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5oZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCB3aW5SID0gd2luZG93V2lkdGggLyB3aW5kb3dIZWlnaHQ7XG5cbiAgICAgICAgICAgIGlmIChyID4gd2luUikge1xuICAgICAgICAgICAgICAgIHdpZHRoID0gd2luZG93V2lkdGg7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gd2lkdGggLyByO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSB3aW5kb3dIZWlnaHQ7XG4gICAgICAgICAgICAgICAgd2lkdGggPSBoZWlnaHQgKiByO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2ZpbGxNb2RlID09PSBGSUxMTU9ERV9GSUxMX1dJTkRPVykge1xuICAgICAgICAgICAgd2lkdGggPSB3aW5kb3dXaWR0aDtcbiAgICAgICAgICAgIGhlaWdodCA9IHdpbmRvd0hlaWdodDtcbiAgICAgICAgfVxuICAgICAgICAvLyBPVEhFUldJU0U6IEZJTExNT0RFX05PTkUgdXNlIHdpZHRoIGFuZCBoZWlnaHQgdGhhdCBhcmUgcHJvdmlkZWRcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5zdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcblxuICAgICAgICB0aGlzLnVwZGF0ZUNhbnZhc1NpemUoKTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIGZpbmFsIHZhbHVlcyBjYWxjdWxhdGVkIGZvciB3aWR0aCBhbmQgaGVpZ2h0XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIHtAbGluayBpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBjYW52YXNcbiAgICAgKiBzaXplIHRvIG1hdGNoIHRoZSBjYW52YXMgc2l6ZSBvbiB0aGUgZG9jdW1lbnQgcGFnZS4gSXQgaXMgcmVjb21tZW5kZWQgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uXG4gICAgICogd2hlbiB0aGUgY2FudmFzIHNpemUgY2hhbmdlcyAoZS5nIG9uIHdpbmRvdyByZXNpemUgYW5kIG9yaWVudGF0aW9uIGNoYW5nZSBldmVudHMpIHNvIHRoYXRcbiAgICAgKiB0aGUgY2FudmFzIHJlc29sdXRpb24gaXMgaW1tZWRpYXRlbHkgdXBkYXRlZC5cbiAgICAgKi9cbiAgICB1cGRhdGVDYW52YXNTaXplKCkge1xuICAgICAgICAvLyBEb24ndCB1cGRhdGUgaWYgd2UgYXJlIGluIFZSIG9yIFhSXG4gICAgICAgIGlmICgoIXRoaXMuX2FsbG93UmVzaXplKSB8fCAodGhpcy54cj8uYWN0aXZlKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW4gQVVUTyBtb2RlIHRoZSByZXNvbHV0aW9uIGlzIGNoYW5nZWQgdG8gbWF0Y2ggdGhlIGNhbnZhcyBzaXplXG4gICAgICAgIGlmICh0aGlzLl9yZXNvbHV0aW9uTW9kZSA9PT0gUkVTT0xVVElPTl9BVVRPKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgY2FudmFzIERPTSBoYXMgY2hhbmdlZCBzaXplXG4gICAgICAgICAgICBjb25zdCBjYW52YXMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcztcbiAgICAgICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UucmVzaXplQ2FudmFzKGNhbnZhcy5jbGllbnRXaWR0aCwgY2FudmFzLmNsaWVudEhlaWdodCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFdmVudCBoYW5kbGVyIGNhbGxlZCB3aGVuIGFsbCBjb2RlIGxpYnJhcmllcyBoYXZlIGJlZW4gbG9hZGVkLiBDb2RlIGxpYnJhcmllcyBhcmUgcGFzc2VkXG4gICAgICogaW50byB0aGUgY29uc3RydWN0b3Igb2YgdGhlIEFwcGxpY2F0aW9uIGFuZCB0aGUgYXBwbGljYXRpb24gd29uJ3Qgc3RhcnQgcnVubmluZyBvciBsb2FkXG4gICAgICogcGFja3MgdW50aWwgYWxsIGxpYnJhcmllcyBoYXZlIGJlZW4gbG9hZGVkLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxpYnJhcmllc0xvYWRlZCgpIHtcbiAgICAgICAgdGhpcy5fbGlicmFyaWVzTG9hZGVkID0gdHJ1ZTtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW1zLnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLnJpZ2lkYm9keS5vbkxpYnJhcnlMb2FkZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGx5IHNjZW5lIHNldHRpbmdzIHRvIHRoZSBjdXJyZW50IHNjZW5lLiBVc2VmdWwgd2hlbiB5b3VyIHNjZW5lIHNldHRpbmdzIGFyZSBwYXJzZWQgb3JcbiAgICAgKiBnZW5lcmF0ZWQgZnJvbSBhIG5vbi1VUkwgc291cmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzIC0gVGhlIHNjZW5lIHNldHRpbmdzIHRvIGJlIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzLnBoeXNpY3MgLSBUaGUgcGh5c2ljcyBzZXR0aW5ncyB0byBiZSBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnBoeXNpY3MuZ3Jhdml0eSAtIFRoZSB3b3JsZCBzcGFjZSB2ZWN0b3IgcmVwcmVzZW50aW5nIGdsb2JhbFxuICAgICAqIGdyYXZpdHkgaW4gdGhlIHBoeXNpY3Mgc2ltdWxhdGlvbi4gTXVzdCBiZSBhIGZpeGVkIHNpemUgYXJyYXkgd2l0aCB0aHJlZSBudW1iZXIgZWxlbWVudHMsXG4gICAgICogY29ycmVzcG9uZGluZyB0byBlYWNoIGF4aXMgWyBYLCBZLCBaIF0uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzLnJlbmRlciAtIFRoZSByZW5kZXJpbmcgc2V0dGluZ3MgdG8gYmUgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5yZW5kZXIuZ2xvYmFsX2FtYmllbnQgLSBUaGUgY29sb3Igb2YgdGhlIHNjZW5lJ3MgYW1iaWVudCBsaWdodC5cbiAgICAgKiBNdXN0IGJlIGEgZml4ZWQgc2l6ZSBhcnJheSB3aXRoIHRocmVlIG51bWJlciBlbGVtZW50cywgY29ycmVzcG9uZGluZyB0byBlYWNoIGNvbG9yIGNoYW5uZWxcbiAgICAgKiBbIFIsIEcsIEIgXS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2V0dGluZ3MucmVuZGVyLmZvZyAtIFRoZSB0eXBlIG9mIGZvZyB1c2VkIGJ5IHRoZSBzY2VuZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRk9HX05PTkV9XG4gICAgICogLSB7QGxpbmsgRk9HX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGT0dfRVhQfVxuICAgICAqIC0ge0BsaW5rIEZPR19FWFAyfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucmVuZGVyLmZvZ19jb2xvciAtIFRoZSBjb2xvciBvZiB0aGUgZm9nIChpZiBlbmFibGVkKS4gTXVzdCBiZSBhXG4gICAgICogZml4ZWQgc2l6ZSBhcnJheSB3aXRoIHRocmVlIG51bWJlciBlbGVtZW50cywgY29ycmVzcG9uZGluZyB0byBlYWNoIGNvbG9yIGNoYW5uZWwgWyBSLCBHLCBCIF0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5mb2dfZGVuc2l0eSAtIFRoZSBkZW5zaXR5IG9mIHRoZSBmb2cgKGlmIGVuYWJsZWQpLiBUaGlzXG4gICAgICogcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0VYUH0gb3Ige0BsaW5rIEZPR19FWFAyfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmZvZ19zdGFydCAtIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgd2hlcmUgbGluZWFyIGZvZ1xuICAgICAqIGJlZ2lucy4gVGhpcyBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfTElORUFSfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmZvZ19lbmQgLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdmlld3BvaW50IHdoZXJlIGxpbmVhciBmb2dcbiAgICAgKiByZWFjaGVzIGl0cyBtYXhpbXVtLiBUaGlzIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZ2FtbWFfY29ycmVjdGlvbiAtIFRoZSBnYW1tYSBjb3JyZWN0aW9uIHRvIGFwcGx5IHdoZW5cbiAgICAgKiByZW5kZXJpbmcgdGhlIHNjZW5lLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBHQU1NQV9OT05FfVxuICAgICAqIC0ge0BsaW5rIEdBTU1BX1NSR0J9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnRvbmVtYXBwaW5nIC0gVGhlIHRvbmVtYXBwaW5nIHRyYW5zZm9ybSB0byBhcHBseSB3aGVuXG4gICAgICogd3JpdGluZyBmcmFnbWVudHMgdG8gdGhlIGZyYW1lIGJ1ZmZlci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9GSUxNSUN9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9IRUpMfVxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfQUNFU31cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZXhwb3N1cmUgLSBUaGUgZXhwb3N1cmUgdmFsdWUgdHdlYWtzIHRoZSBvdmVyYWxsIGJyaWdodG5lc3NcbiAgICAgKiBvZiB0aGUgc2NlbmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVsbH0gW3NldHRpbmdzLnJlbmRlci5za3lib3hdIC0gVGhlIGFzc2V0IElEIG9mIHRoZSBjdWJlIG1hcCB0ZXh0dXJlIHRvIGJlXG4gICAgICogdXNlZCBhcyB0aGUgc2NlbmUncyBza3lib3guIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5za3lib3hJbnRlbnNpdHkgLSBNdWx0aXBsaWVyIGZvciBza3lib3ggaW50ZW5zaXR5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94THVtaW5hbmNlIC0gTHV4IChsbS9tXjIpIHZhbHVlIGZvciBza3lib3ggaW50ZW5zaXR5IHdoZW4gcGh5c2ljYWwgbGlnaHQgdW5pdHMgYXJlIGVuYWJsZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5za3lib3hNaXAgLSBUaGUgbWlwIGxldmVsIG9mIHRoZSBza3lib3ggdG8gYmUgZGlzcGxheWVkLlxuICAgICAqIE9ubHkgdmFsaWQgZm9yIHByZWZpbHRlcmVkIGN1YmVtYXAgc2t5Ym94ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucmVuZGVyLnNreWJveFJvdGF0aW9uIC0gUm90YXRpb24gb2Ygc2t5Ym94LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRtYXBTaXplTXVsdGlwbGllciAtIFRoZSBsaWdodG1hcCByZXNvbHV0aW9uIG11bHRpcGxpZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodG1hcE1heFJlc29sdXRpb24gLSBUaGUgbWF4aW11bSBsaWdodG1hcCByZXNvbHV0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRtYXBNb2RlIC0gVGhlIGxpZ2h0bWFwIGJha2luZyBtb2RlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUkRJUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcCArIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbiAodXNlZCBmb3IgYnVtcC9zcGVjdWxhcilcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlIC0gRW5hYmxlIGJha2luZyBhbWJpZW50IGxpZ2h0IGludG8gbGlnaHRtYXBzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VOdW1TYW1wbGVzIC0gTnVtYmVyIG9mIHNhbXBsZXMgdG8gdXNlIHdoZW4gYmFraW5nIGFtYmllbnQgbGlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZVNwaGVyZVBhcnQgLSBIb3cgbXVjaCBvZiB0aGUgc3BoZXJlIHRvIGluY2x1ZGUgd2hlbiBiYWtpbmcgYW1iaWVudCBsaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcyAtIEJyaWdobmVzcyBvZiB0aGUgYmFrZWQgYW1iaWVudCBvY2NsdXNpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0IC0gQ29udHJhc3Qgb2YgdGhlIGJha2VkIGFtYmllbnQgb2NjbHVzaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEx1bWluYW5jZSAtIEx1eCAobG0vbV4yKSB2YWx1ZSBmb3IgYW1iaWVudCBsaWdodCBpbnRlbnNpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgLSBFbmFibGUgY2x1c3RlcmVkIGxpZ2h0aW5nLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nU2hhZG93c0VuYWJsZWQgLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgc2hhZG93cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0Nvb2tpZXNFbmFibGVkIC0gSWYgc2V0IHRvIHRydWUsIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgd2lsbCBzdXBwb3J0IGNvb2tpZSB0ZXh0dXJlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0FyZWFMaWdodHNFbmFibGVkIC0gSWYgc2V0IHRvIHRydWUsIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgd2lsbCBzdXBwb3J0IGFyZWEgbGlnaHRzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdTaGFkb3dBdGxhc1Jlc29sdXRpb24gLSBSZXNvbHV0aW9uIG9mIHRoZSBhdGxhcyB0ZXh0dXJlIHN0b3JpbmcgYWxsIG5vbi1kaXJlY3Rpb25hbCBzaGFkb3cgdGV4dHVyZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0Nvb2tpZUF0bGFzUmVzb2x1dGlvbiAtIFJlc29sdXRpb24gb2YgdGhlIGF0bGFzIHRleHR1cmUgc3RvcmluZyBhbGwgbm9uLWRpcmVjdGlvbmFsIGNvb2tpZSB0ZXh0dXJlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nTWF4TGlnaHRzUGVyQ2VsbCAtIE1heGltdW0gbnVtYmVyIG9mIGxpZ2h0cyBhIGNlbGwgY2FuIHN0b3JlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdTaGFkb3dUeXBlIC0gVGhlIHR5cGUgb2Ygc2hhZG93IGZpbHRlcmluZyB1c2VkIGJ5IGFsbCBzaGFkb3dzLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBTSEFET1dfUENGMX06IFBDRiAxeDEgc2FtcGxpbmcuXG4gICAgICogLSB7QGxpbmsgU0hBRE9XX1BDRjN9OiBQQ0YgM3gzIHNhbXBsaW5nLlxuICAgICAqIC0ge0BsaW5rIFNIQURPV19QQ0Y1fTogUENGIDV4NSBzYW1wbGluZy4gRmFsbHMgYmFjayB0byB7QGxpbmsgU0hBRE9XX1BDRjN9IG9uIFdlYkdMIDEuMC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQ2VsbHMgLSBOdW1iZXIgb2YgY2VsbHMgYWxvbmcgZWFjaCB3b3JsZC1zcGFjZSBheGlzIHRoZSBzcGFjZSBjb250YWluaW5nIGxpZ2h0c1xuICAgICAqIGlzIHN1YmRpdmlkZWQgaW50by5cbiAgICAgKlxuICAgICAqIE9ubHkgbGlnaHRzIHdpdGggYmFrZURpcj10cnVlIHdpbGwgYmUgdXNlZCBmb3IgZ2VuZXJhdGluZyB0aGUgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgc2V0dGluZ3MgPSB7XG4gICAgICogICAgIHBoeXNpY3M6IHtcbiAgICAgKiAgICAgICAgIGdyYXZpdHk6IFswLCAtOS44LCAwXVxuICAgICAqICAgICB9LFxuICAgICAqICAgICByZW5kZXI6IHtcbiAgICAgKiAgICAgICAgIGZvZ19lbmQ6IDEwMDAsXG4gICAgICogICAgICAgICB0b25lbWFwcGluZzogMCxcbiAgICAgKiAgICAgICAgIHNreWJveDogbnVsbCxcbiAgICAgKiAgICAgICAgIGZvZ19kZW5zaXR5OiAwLjAxLFxuICAgICAqICAgICAgICAgZ2FtbWFfY29ycmVjdGlvbjogMSxcbiAgICAgKiAgICAgICAgIGV4cG9zdXJlOiAxLFxuICAgICAqICAgICAgICAgZm9nX3N0YXJ0OiAxLFxuICAgICAqICAgICAgICAgZ2xvYmFsX2FtYmllbnQ6IFswLCAwLCAwXSxcbiAgICAgKiAgICAgICAgIHNreWJveEludGVuc2l0eTogMSxcbiAgICAgKiAgICAgICAgIHNreWJveFJvdGF0aW9uOiBbMCwgMCwgMF0sXG4gICAgICogICAgICAgICBmb2dfY29sb3I6IFswLCAwLCAwXSxcbiAgICAgKiAgICAgICAgIGxpZ2h0bWFwTW9kZTogMSxcbiAgICAgKiAgICAgICAgIGZvZzogJ25vbmUnLFxuICAgICAqICAgICAgICAgbGlnaHRtYXBNYXhSZXNvbHV0aW9uOiAyMDQ4LFxuICAgICAqICAgICAgICAgc2t5Ym94TWlwOiAyLFxuICAgICAqICAgICAgICAgbGlnaHRtYXBTaXplTXVsdGlwbGllcjogMTZcbiAgICAgKiAgICAgfVxuICAgICAqIH07XG4gICAgICogYXBwLmFwcGx5U2NlbmVTZXR0aW5ncyhzZXR0aW5ncyk7XG4gICAgICovXG4gICAgYXBwbHlTY2VuZVNldHRpbmdzKHNldHRpbmdzKSB7XG4gICAgICAgIGxldCBhc3NldDtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW1zLnJpZ2lkYm9keSAmJiB0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXZpdHkgPSBzZXR0aW5ncy5waHlzaWNzLmdyYXZpdHk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMucmlnaWRib2R5LmdyYXZpdHkuc2V0KGdyYXZpdHlbMF0sIGdyYXZpdHlbMV0sIGdyYXZpdHlbMl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zY2VuZS5hcHBseVNldHRpbmdzKHNldHRpbmdzKTtcblxuICAgICAgICBpZiAoc2V0dGluZ3MucmVuZGVyLmhhc093blByb3BlcnR5KCdza3lib3gnKSkge1xuICAgICAgICAgICAgaWYgKHNldHRpbmdzLnJlbmRlci5za3lib3gpIHtcbiAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuYXNzZXRzLmdldChzZXR0aW5ncy5yZW5kZXIuc2t5Ym94KTtcblxuICAgICAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFNreWJveChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub25jZSgnYWRkOicgKyBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94LCB0aGlzLnNldFNreWJveCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFNreWJveChudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGFyZWEgbGlnaHQgTFVUIHRhYmxlcyBmb3IgdGhpcyBhcHAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBsdGNNYXQxIC0gTFVUIHRhYmxlIG9mIHR5cGUgYGFycmF5YCB0byBiZSBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbHRjTWF0MiAtIExVVCB0YWJsZSBvZiB0eXBlIGBhcnJheWAgdG8gYmUgc2V0LlxuICAgICAqL1xuICAgIHNldEFyZWFMaWdodEx1dHMobHRjTWF0MSwgbHRjTWF0Mikge1xuXG4gICAgICAgIGlmIChsdGNNYXQxICYmIGx0Y01hdDIpIHtcbiAgICAgICAgICAgIEFyZWFMaWdodEx1dHMuc2V0KHRoaXMuZ3JhcGhpY3NEZXZpY2UsIGx0Y01hdDEsIGx0Y01hdDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgRGVidWcud2FybihcInNldEFyZWFMaWdodEx1dHM6IExVVHMgZm9yIGFyZWEgbGlnaHQgYXJlIG5vdCB2YWxpZFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNreWJveCBhc3NldCB0byBjdXJyZW50IHNjZW5lLCBhbmQgc3Vic2NyaWJlcyB0byBhc3NldCBsb2FkL2NoYW5nZSBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIEFzc2V0IG9mIHR5cGUgYHNreWJveGAgdG8gYmUgc2V0IHRvLCBvciBudWxsIHRvIHJlbW92ZSBza3lib3guXG4gICAgICovXG4gICAgc2V0U2t5Ym94KGFzc2V0KSB7XG4gICAgICAgIGlmIChhc3NldCAhPT0gdGhpcy5fc2t5Ym94QXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IG9uU2t5Ym94UmVtb3ZlZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFNreWJveChudWxsKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG9uU2t5Ym94Q2hhbmdlZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnNjZW5lLnNldFNreWJveCh0aGlzLl9za3lib3hBc3NldCA/IHRoaXMuX3NreWJveEFzc2V0LnJlc291cmNlcyA6IG51bGwpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gY2xlYW51cCBwcmV2aW91cyBhc3NldFxuICAgICAgICAgICAgaWYgKHRoaXMuX3NreWJveEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub2ZmKCdsb2FkOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vZmYoJ3JlbW92ZTonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQub2ZmKCdjaGFuZ2UnLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgbmV3IGFzc2V0XG4gICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldCA9IGFzc2V0O1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NreWJveEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub24oJ2xvYWQ6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9uY2UoJ3JlbW92ZTonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQub24oJ2NoYW5nZScsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2VuZS5za3lib3hNaXAgPT09IDAgJiYgIXRoaXMuX3NreWJveEFzc2V0LmxvYWRGYWNlcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldC5sb2FkRmFjZXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLmxvYWQodGhpcy5fc2t5Ym94QXNzZXQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvblNreWJveENoYW5nZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9maXJzdEJha2UoKSB7XG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXI/LmJha2UobnVsbCwgdGhpcy5zY2VuZS5saWdodG1hcE1vZGUpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9maXJzdEJhdGNoKCkge1xuICAgICAgICB0aGlzLmJhdGNoZXI/LmdlbmVyYXRlKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZSBhbiBvcHBvcnR1bml0eSB0byBtb2RpZnkgdGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3RpbWVzdGFtcF0gLSBUaGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfHVuZGVmaW5lZH0gVGhlIG1vZGlmaWVkIHRpbWVzdGFtcC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3Byb2Nlc3NUaW1lc3RhbXAodGltZXN0YW1wKSB7XG4gICAgICAgIHJldHVybiB0aW1lc3RhbXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBzaW5nbGUgbGluZS4gTGluZSBzdGFydCBhbmQgZW5kIGNvb3JkaW5hdGVzIGFyZSBzcGVjaWZpZWQgaW4gd29ybGQtc3BhY2UuIFRoZSBsaW5lXG4gICAgICogd2lsbCBiZSBmbGF0LXNoYWRlZCB3aXRoIHRoZSBzcGVjaWZpZWQgY29sb3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHN0YXJ0IC0gVGhlIHN0YXJ0IHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgb2YgdGhlIGxpbmUuXG4gICAgICogQHBhcmFtIHtWZWMzfSBlbmQgLSBUaGUgZW5kIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgb2YgdGhlIGxpbmUuXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW2NvbG9yXSAtIFRoZSBjb2xvciBvZiB0aGUgbGluZS4gSXQgZGVmYXVsdHMgdG8gd2hpdGUgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBsaW5lIGlzIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbGluZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgMS11bml0IGxvbmcgd2hpdGUgbGluZVxuICAgICAqIHZhciBzdGFydCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIHZhciBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd0xpbmUoc3RhcnQsIGVuZCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSAxLXVuaXQgbG9uZyByZWQgbGluZSB3aGljaCBpcyBub3QgZGVwdGggdGVzdGVkIGFuZCByZW5kZXJzIG9uIHRvcCBvZiBvdGhlciBnZW9tZXRyeVxuICAgICAqIHZhciBzdGFydCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIHZhciBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd0xpbmUoc3RhcnQsIGVuZCwgcGMuQ29sb3IuUkVELCBmYWxzZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSAxLXVuaXQgbG9uZyB3aGl0ZSBsaW5lIGludG8gdGhlIHdvcmxkIGxheWVyXG4gICAgICogdmFyIHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIHZhciB3b3JsZExheWVyID0gYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQocGMuTEFZRVJJRF9XT1JMRCk7XG4gICAgICogYXBwLmRyYXdMaW5lKHN0YXJ0LCBlbmQsIHBjLkNvbG9yLldISVRFLCB0cnVlLCB3b3JsZExheWVyKTtcbiAgICAgKi9cbiAgICBkcmF3TGluZShzdGFydCwgZW5kLCBjb2xvciwgZGVwdGhUZXN0LCBsYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmRyYXdMaW5lKHN0YXJ0LCBlbmQsIGNvbG9yLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIGFyYml0cmFyeSBudW1iZXIgb2YgZGlzY3JldGUgbGluZSBzZWdtZW50cy4gVGhlIGxpbmVzIGFyZSBub3QgY29ubmVjdGVkIGJ5IGVhY2hcbiAgICAgKiBzdWJzZXF1ZW50IHBvaW50IGluIHRoZSBhcnJheS4gSW5zdGVhZCwgdGhleSBhcmUgaW5kaXZpZHVhbCBzZWdtZW50cyBzcGVjaWZpZWQgYnkgdHdvXG4gICAgICogcG9pbnRzLiBUaGVyZWZvcmUsIHRoZSBsZW5ndGhzIG9mIHRoZSBzdXBwbGllZCBwb3NpdGlvbiBhbmQgY29sb3IgYXJyYXlzIG11c3QgYmUgdGhlIHNhbWVcbiAgICAgKiBhbmQgYWxzbyBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMi4gVGhlIGNvbG9ycyBvZiB0aGUgZW5kcyBvZiBlYWNoIGxpbmUgc2VnbWVudCB3aWxsIGJlXG4gICAgICogaW50ZXJwb2xhdGVkIGFsb25nIHRoZSBsZW5ndGggb2YgZWFjaCBsaW5lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIHBvaW50cyB0byBkcmF3IGxpbmVzIGJldHdlZW4uIFRoZSBsZW5ndGggb2YgdGhlXG4gICAgICogYXJyYXkgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDIuXG4gICAgICogQHBhcmFtIHtDb2xvcltdfSBjb2xvcnMgLSBBbiBhcnJheSBvZiBjb2xvcnMgdG8gY29sb3IgdGhlIGxpbmVzLiBUaGlzIG11c3QgYmUgdGhlIHNhbWVcbiAgICAgKiBsZW5ndGggYXMgdGhlIHBvc2l0aW9uIGFycmF5LiBUaGUgbGVuZ3RoIG9mIHRoZSBhcnJheSBtdXN0IGFsc28gYmUgYSBtdWx0aXBsZSBvZiAyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGUgZGVwdGhcbiAgICAgKiBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIGxpbmVzIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSBzaW5nbGUgbGluZSwgd2l0aCB1bmlxdWUgY29sb3JzIGZvciBlYWNoIHBvaW50XG4gICAgICogdmFyIHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3TGluZXMoW3N0YXJ0LCBlbmRdLCBbcGMuQ29sb3IuUkVELCBwYy5Db2xvci5XSElURV0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIDIgZGlzY3JldGUgbGluZSBzZWdtZW50c1xuICAgICAqIHZhciBwb2ludHMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICBuZXcgcGMuVmVjMygwLCAwLCAwKSxcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMSwgMCwgMCksXG4gICAgICogICAgIC8vIExpbmUgMlxuICAgICAqICAgICBuZXcgcGMuVmVjMygxLCAxLCAwKSxcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMSwgMSwgMSlcbiAgICAgKiBdO1xuICAgICAqIHZhciBjb2xvcnMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICBwYy5Db2xvci5SRUQsXG4gICAgICogICAgIHBjLkNvbG9yLllFTExPVyxcbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIHBjLkNvbG9yLkNZQU4sXG4gICAgICogICAgIHBjLkNvbG9yLkJMVUVcbiAgICAgKiBdO1xuICAgICAqIGFwcC5kcmF3TGluZXMocG9pbnRzLCBjb2xvcnMpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5kcmF3TGluZXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gYXJiaXRyYXJ5IG51bWJlciBvZiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzLiBUaGUgbGluZXMgYXJlIG5vdCBjb25uZWN0ZWQgYnkgZWFjaFxuICAgICAqIHN1YnNlcXVlbnQgcG9pbnQgaW4gdGhlIGFycmF5LiBJbnN0ZWFkLCB0aGV5IGFyZSBpbmRpdmlkdWFsIHNlZ21lbnRzIHNwZWNpZmllZCBieSB0d29cbiAgICAgKiBwb2ludHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiBwb2ludHMgdG8gZHJhdyBsaW5lcyBiZXR3ZWVuLiBFYWNoIHBvaW50IGlzXG4gICAgICogcmVwcmVzZW50ZWQgYnkgMyBudW1iZXJzIC0geCwgeSBhbmQgeiBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGNvbG9ycyAtIEFuIGFycmF5IG9mIGNvbG9ycyB0byBjb2xvciB0aGUgbGluZXMuIFRoaXMgbXVzdCBiZSB0aGUgc2FtZVxuICAgICAqIGxlbmd0aCBhcyB0aGUgcG9zaXRpb24gYXJyYXkuIFRoZSBsZW5ndGggb2YgdGhlIGFycmF5IG11c3QgYWxzbyBiZSBhIG11bHRpcGxlIG9mIDIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbGluZXMgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciAyIGRpc2NyZXRlIGxpbmUgc2VnbWVudHNcbiAgICAgKiB2YXIgcG9pbnRzID0gW1xuICAgICAqICAgICAvLyBMaW5lIDFcbiAgICAgKiAgICAgMCwgMCwgMCxcbiAgICAgKiAgICAgMSwgMCwgMCxcbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIDEsIDEsIDAsXG4gICAgICogICAgIDEsIDEsIDFcbiAgICAgKiBdO1xuICAgICAqIHZhciBjb2xvcnMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICAxLCAwLCAwLCAxLCAgLy8gcmVkXG4gICAgICogICAgIDAsIDEsIDAsIDEsICAvLyBncmVlblxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgMCwgMCwgMSwgMSwgIC8vIGJsdWVcbiAgICAgKiAgICAgMSwgMSwgMSwgMSAgIC8vIHdoaXRlXG4gICAgICogXTtcbiAgICAgKiBhcHAuZHJhd0xpbmVBcnJheXMocG9pbnRzLCBjb2xvcnMpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lQXJyYXlzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmRyYXdMaW5lQXJyYXlzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHdpcmVmcmFtZSBzcGhlcmUgd2l0aCBjZW50ZXIsIHJhZGl1cyBhbmQgY29sb3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGNlbnRlciAtIFRoZSBjZW50ZXIgb2YgdGhlIHNwaGVyZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmFkaXVzIC0gVGhlIHJhZGl1cyBvZiB0aGUgc3BoZXJlLlxuICAgICAqIEBwYXJhbSB7Q29sb3J9IFtjb2xvcl0gLSBUaGUgY29sb3Igb2YgdGhlIHNwaGVyZS4gSXQgZGVmYXVsdHMgdG8gd2hpdGUgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3NlZ21lbnRzXSAtIE51bWJlciBvZiBsaW5lIHNlZ21lbnRzIHVzZWQgdG8gcmVuZGVyIHRoZSBjaXJjbGVzIGZvcm1pbmcgdGhlXG4gICAgICogc3BoZXJlLiBEZWZhdWx0cyB0byAyMC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBzcGhlcmUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZVxuICAgICAqIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgc3BoZXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSByZWQgd2lyZSBzcGhlcmUgd2l0aCByYWRpdXMgb2YgMVxuICAgICAqIHZhciBjZW50ZXIgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd1dpcmVTcGhlcmUoY2VudGVyLCAxLjAsIHBjLkNvbG9yLlJFRCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdXaXJlU3BoZXJlKGNlbnRlciwgcmFkaXVzLCBjb2xvciA9IENvbG9yLldISVRFLCBzZWdtZW50cyA9IDIwLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3V2lyZVNwaGVyZShjZW50ZXIsIHJhZGl1cywgY29sb3IsIHNlZ21lbnRzLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHdpcmVmcmFtZSBheGlzIGFsaWduZWQgYm94IHNwZWNpZmllZCBieSBtaW4gYW5kIG1heCBwb2ludHMgYW5kIGNvbG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBtaW5Qb2ludCAtIFRoZSBtaW4gY29ybmVyIHBvaW50IG9mIHRoZSBib3guXG4gICAgICogQHBhcmFtIHtWZWMzfSBtYXhQb2ludCAtIFRoZSBtYXggY29ybmVyIHBvaW50IG9mIHRoZSBib3guXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW2NvbG9yXSAtIFRoZSBjb2xvciBvZiB0aGUgc3BoZXJlLiBJdCBkZWZhdWx0cyB0byB3aGl0ZSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIHNwaGVyZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlXG4gICAgICogZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBzcGhlcmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIHJlZCB3aXJlIGFsaWduZWQgYm94XG4gICAgICogdmFyIG1pbiA9IG5ldyBwYy5WZWMzKC0xLCAtMSwgLTEpO1xuICAgICAqIHZhciBtYXggPSBuZXcgcGMuVmVjMygxLCAxLCAxKTtcbiAgICAgKiBhcHAuZHJhd1dpcmVBbGlnbmVkQm94KG1pbiwgbWF4LCBwYy5Db2xvci5SRUQpO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3V2lyZUFsaWduZWRCb3gobWluUG9pbnQsIG1heFBvaW50LCBjb2xvciA9IENvbG9yLldISVRFLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3V2lyZUFsaWduZWRCb3gobWluUG9pbnQsIG1heFBvaW50LCBjb2xvciwgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBtZXNoSW5zdGFuY2UgYXQgdGhpcyBmcmFtZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlXG4gICAgICogdG8gZHJhdy5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbWVzaCBpbnN0YW5jZSBpbnRvLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdNZXNoSW5zdGFuY2UobWVzaEluc3RhbmNlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChudWxsLCBudWxsLCBudWxsLCBtZXNoSW5zdGFuY2UsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3IG1lc2ggYXQgdGhpcyBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zY2VuZS9tZXNoLmpzJykuTWVzaH0gbWVzaCAtIFRoZSBtZXNoIHRvIGRyYXcuXG4gICAgICogQHBhcmFtIHtNYXRlcmlhbH0gbWF0ZXJpYWwgLSBUaGUgbWF0ZXJpYWwgdG8gdXNlIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKiBAcGFyYW0ge01hdDR9IG1hdHJpeCAtIFRoZSBtYXRyaXggdG8gdXNlIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbWVzaCBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3TWVzaChtZXNoLCBtYXRlcmlhbCwgbWF0cml4LCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChtYXRlcmlhbCwgbWF0cml4LCBtZXNoLCBudWxsLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBxdWFkIG9mIHNpemUgWy0wLjUsIDAuNV0gYXQgdGhpcyBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbWF0cml4IC0gVGhlIG1hdHJpeCB0byB1c2UgdG8gcmVuZGVyIHRoZSBxdWFkLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSB0byByZW5kZXIgdGhlIHF1YWQuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHF1YWQgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1F1YWQobWF0cml4LCBtYXRlcmlhbCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0UXVhZE1lc2goKSwgbnVsbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgdGV4dHVyZSBhdCBbeCwgeV0gcG9zaXRpb24gb24gc2NyZWVuLCB3aXRoIHNpemUgW3dpZHRoLCBoZWlnaHRdLiBUaGUgb3JpZ2luIG9mIHRoZVxuICAgICAqIHNjcmVlbiBpcyB0b3AtbGVmdCBbMCwgMF0uIENvb3JkaW5hdGVzIGFuZCBzaXplcyBhcmUgaW4gcHJvamVjdGVkIHNwYWNlICgtMSAuLiAxKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW4gdGhlXG4gICAgICogcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpblxuICAgICAqIHRoZSByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gcmVuZGVyLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHVzZWQgd2hlbiByZW5kZXJpbmcgdGhlIHRleHR1cmUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHRleHR1cmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1RleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgdGV4dHVyZSwgbWF0ZXJpYWwsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG5cbiAgICAgICAgLy8gVE9ETzogaWYgdGhpcyBpcyB1c2VkIGZvciBhbnl0aGluZyBvdGhlciB0aGFuIGRlYnVnIHRleHR1cmUgZGlzcGxheSwgd2Ugc2hvdWxkIG9wdGltaXplIHRoaXMgdG8gYXZvaWQgYWxsb2NhdGlvbnNcbiAgICAgICAgY29uc3QgbWF0cml4ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgbWF0cml4LnNldFRSUyhuZXcgVmVjMyh4LCB5LCAwLjApLCBRdWF0LklERU5USVRZLCBuZXcgVmVjMyh3aWR0aCwgaGVpZ2h0LCAwLjApKTtcblxuICAgICAgICBpZiAoIW1hdGVyaWFsKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKFwiY29sb3JNYXBcIiwgdGV4dHVyZSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zaGFkZXIgPSB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRUZXh0dXJlU2hhZGVyKCk7XG4gICAgICAgICAgICBtYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZHJhd1F1YWQobWF0cml4LCBtYXRlcmlhbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgZGVwdGggdGV4dHVyZSBhdCBbeCwgeV0gcG9zaXRpb24gb24gc2NyZWVuLCB3aXRoIHNpemUgW3dpZHRoLCBoZWlnaHRdLiBUaGUgb3JpZ2luIG9mXG4gICAgICogdGhlIHNjcmVlbiBpcyB0b3AtbGVmdCBbMCwgMF0uIENvb3JkaW5hdGVzIGFuZCBzaXplcyBhcmUgaW4gcHJvamVjdGVkIHNwYWNlICgtMSAuLiAxKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW4gdGhlXG4gICAgICogcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpblxuICAgICAqIHRoZSByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHRleHR1cmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd0RlcHRoVGV4dHVyZSh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICBtYXRlcmlhbC5zaGFkZXIgPSB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXREZXB0aFRleHR1cmVTaGFkZXIoKTtcbiAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgdGhpcy5kcmF3VGV4dHVyZSh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBudWxsLCBtYXRlcmlhbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIGFwcGxpY2F0aW9uIGFuZCByZW1vdmVzIGFsbCBldmVudCBsaXN0ZW5lcnMgYXQgdGhlIGVuZCBvZiB0aGUgY3VycmVudCBlbmdpbmUgZnJhbWVcbiAgICAgKiB1cGRhdGUuIEhvd2V2ZXIsIGlmIGNhbGxlZCBvdXRzaWRlIG9mIHRoZSBlbmdpbmUgZnJhbWUgdXBkYXRlLCBjYWxsaW5nIGRlc3Ryb3koKSB3aWxsXG4gICAgICogZGVzdHJveSB0aGUgYXBwbGljYXRpb24gaW1tZWRpYXRlbHkuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5kZXN0cm95KCk7XG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2luRnJhbWVVcGRhdGUpIHtcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lSZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2FudmFzSWQgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5pZDtcblxuICAgICAgICB0aGlzLm9mZignbGlicmFyaWVzbG9hZGVkJyk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW96dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtc3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignd2Via2l0dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMucm9vdC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMucm9vdCA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMubW91c2UpIHtcbiAgICAgICAgICAgIHRoaXMubW91c2Uub2ZmKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLmRldGFjaCgpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5rZXlib2FyZCkge1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZC5vZmYoKTtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQuZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRvdWNoKSB7XG4gICAgICAgICAgICB0aGlzLnRvdWNoLm9mZigpO1xuICAgICAgICAgICAgdGhpcy50b3VjaC5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMudG91Y2ggPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudElucHV0KSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dC5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudElucHV0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuZGVzdHJveSgpO1xuXG4gICAgICAgIC8vIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMuZGVzdHJveSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbGwgdGV4dHVyZSByZXNvdXJjZXNcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5hc3NldHMubGlzdCgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXNzZXRzW2ldLnVubG9hZCgpO1xuICAgICAgICAgICAgYXNzZXRzW2ldLm9mZigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYXNzZXRzLm9mZigpO1xuXG5cbiAgICAgICAgLy8gZGVzdHJveSBidW5kbGUgcmVnaXN0cnlcbiAgICAgICAgdGhpcy5idW5kbGVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5idW5kbGVzID0gbnVsbDtcblxuICAgICAgICB0aGlzLmkxOG4uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmkxOG4gPSBudWxsO1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZVtrZXldO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgaWYgKHBhcmVudCkgcGFyZW50LnJlbW92ZUNoaWxkKGVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSA9IHt9O1xuXG4gICAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcblxuICAgICAgICB0aGlzLnN5c3RlbXMgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xuXG4gICAgICAgIC8vIHNjcmlwdCByZWdpc3RyeVxuICAgICAgICB0aGlzLnNjcmlwdHMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zY2VuZXMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbnRpdHlJbmRleCA9IHt9O1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25QcmVSZW5kZXJPcGFxdWUgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoLm9uUG9zdFJlbmRlck9wYXF1ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25EaXNhYmxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vbkVuYWJsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGggPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllcldvcmxkID0gbnVsbDtcblxuICAgICAgICB0aGlzPy54ci5lbmQoKTtcbiAgICAgICAgdGhpcz8ueHIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMucmVuZGVyZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy50aWNrID0gbnVsbDtcblxuICAgICAgICB0aGlzLm9mZigpOyAvLyByZW1vdmUgYWxsIGV2ZW50c1xuXG4gICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgc2NyaXB0LmFwcCA9IG51bGw7XG5cbiAgICAgICAgQXBwQmFzZS5fYXBwbGljYXRpb25zW2NhbnZhc0lkXSA9IG51bGw7XG5cbiAgICAgICAgaWYgKGdldEFwcGxpY2F0aW9uKCkgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHNldEFwcGxpY2F0aW9uKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGVudGl0eSBmcm9tIHRoZSBpbmRleCBieSBndWlkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWQgLSBUaGUgR1VJRCB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtFbnRpdHl9IFRoZSBFbnRpdHkgd2l0aCB0aGUgR1VJRCBvciBudWxsLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRFbnRpdHlGcm9tSW5kZXgoZ3VpZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW50aXR5SW5kZXhbZ3VpZF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZShzY2VuZSkge1xuICAgICAgICB0aGlzLm9uKCdwb3N0cmVuZGVyJywgc2NlbmUuaW1tZWRpYXRlLm9uUG9zdFJlbmRlciwgc2NlbmUuaW1tZWRpYXRlKTtcbiAgICB9XG59XG5cbi8vIHN0YXRpYyBkYXRhXG5jb25zdCBfZnJhbWVFbmREYXRhID0ge307XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNzdGFydH0gYW5kIGl0c2VsZiB0byByZXF1ZXN0XG4gKiB0aGUgcmVuZGVyaW5nIG9mIGEgbmV3IGFuaW1hdGlvbiBmcmFtZS5cbiAqXG4gKiBAY2FsbGJhY2sgTWFrZVRpY2tDYWxsYmFja1xuICogQHBhcmFtIHtudW1iZXJ9IFt0aW1lc3RhbXBdIC0gVGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICogQGlnbm9yZVxuICovXG5cbi8qKlxuICogQ3JlYXRlIHRpY2sgZnVuY3Rpb24gdG8gYmUgd3JhcHBlZCBpbiBjbG9zdXJlLlxuICpcbiAqIEBwYXJhbSB7QXBwQmFzZX0gX2FwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAqIEByZXR1cm5zIHtNYWtlVGlja0NhbGxiYWNrfSBUaGUgdGljayBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmNvbnN0IG1ha2VUaWNrID0gZnVuY3Rpb24gKF9hcHApIHtcbiAgICBjb25zdCBhcHBsaWNhdGlvbiA9IF9hcHA7XG4gICAgbGV0IGZyYW1lUmVxdWVzdDtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3RpbWVzdGFtcF0gLSBUaGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqL1xuICAgIHJldHVybiBmdW5jdGlvbiAodGltZXN0YW1wLCBmcmFtZSkge1xuICAgICAgICBpZiAoIWFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHNldEFwcGxpY2F0aW9uKGFwcGxpY2F0aW9uKTtcblxuICAgICAgICBpZiAoZnJhbWVSZXF1ZXN0KSB7XG4gICAgICAgICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoZnJhbWVSZXF1ZXN0KTtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoYXZlIGN1cnJlbnQgYXBwbGljYXRpb24gcG9pbnRlciBpbiBwY1xuICAgICAgICBhcHAgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICBjb25zdCBjdXJyZW50VGltZSA9IGFwcGxpY2F0aW9uLl9wcm9jZXNzVGltZXN0YW1wKHRpbWVzdGFtcCkgfHwgbm93KCk7XG4gICAgICAgIGNvbnN0IG1zID0gY3VycmVudFRpbWUgLSAoYXBwbGljYXRpb24uX3RpbWUgfHwgY3VycmVudFRpbWUpO1xuICAgICAgICBsZXQgZHQgPSBtcyAvIDEwMDAuMDtcbiAgICAgICAgZHQgPSBtYXRoLmNsYW1wKGR0LCAwLCBhcHBsaWNhdGlvbi5tYXhEZWx0YVRpbWUpO1xuICAgICAgICBkdCAqPSBhcHBsaWNhdGlvbi50aW1lU2NhbGU7XG5cbiAgICAgICAgYXBwbGljYXRpb24uX3RpbWUgPSBjdXJyZW50VGltZTtcblxuICAgICAgICAvLyBTdWJtaXQgYSByZXF1ZXN0IHRvIHF1ZXVlIHVwIGEgbmV3IGFuaW1hdGlvbiBmcmFtZSBpbW1lZGlhdGVseVxuICAgICAgICBpZiAoYXBwbGljYXRpb24ueHI/LnNlc3Npb24pIHtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IGFwcGxpY2F0aW9uLnhyLnNlc3Npb24ucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFwcGxpY2F0aW9uLnRpY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJhbWVSZXF1ZXN0ID0gcGxhdGZvcm0uYnJvd3NlciA/IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYXBwbGljYXRpb24udGljaykgOiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmNvbnRleHRMb3N0KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9maWxsRnJhbWVTdGF0c0Jhc2ljKGN1cnJlbnRUaW1lLCBkdCwgbXMpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgYXBwbGljYXRpb24uX2ZpbGxGcmFtZVN0YXRzKCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9pbkZyYW1lVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1ldXBkYXRlXCIsIG1zKTtcblxuICAgICAgICBsZXQgc2hvdWxkUmVuZGVyRnJhbWUgPSB0cnVlO1xuXG4gICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgc2hvdWxkUmVuZGVyRnJhbWUgPSBhcHBsaWNhdGlvbi54cj8udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyLmZyYW1lYnVmZmVyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbGljYXRpb24uZ3JhcGhpY3NEZXZpY2UuZGVmYXVsdEZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaG91bGRSZW5kZXJGcmFtZSkge1xuICAgICAgICAgICAgYXBwbGljYXRpb24udXBkYXRlKGR0KTtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lcmVuZGVyXCIpO1xuXG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9GUkFNRSwgYC0tLSBGcmFtZSAke2FwcGxpY2F0aW9uLmZyYW1lfWApO1xuXG4gICAgICAgICAgICBpZiAoYXBwbGljYXRpb24uYXV0b1JlbmRlciB8fCBhcHBsaWNhdGlvbi5yZW5kZXJOZXh0RnJhbWUpIHtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi51cGRhdGVDYW52YXNTaXplKCk7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24ucmVuZGVyKCk7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24ucmVuZGVyTmV4dEZyYW1lID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBldmVudCBkYXRhXG4gICAgICAgICAgICBfZnJhbWVFbmREYXRhLnRpbWVzdGFtcCA9IG5vdygpO1xuICAgICAgICAgICAgX2ZyYW1lRW5kRGF0YS50YXJnZXQgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lZW5kXCIsIF9mcmFtZUVuZERhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXBwbGljYXRpb24uX2luRnJhbWVVcGRhdGUgPSBmYWxzZTtcblxuICAgICAgICBpZiAoYXBwbGljYXRpb24uX2Rlc3Ryb3lSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG5leHBvcnQgeyBhcHAsIEFwcEJhc2UgfTtcbiJdLCJuYW1lcyI6WyJQcm9ncmVzcyIsImNvbnN0cnVjdG9yIiwibGVuZ3RoIiwiY291bnQiLCJpbmMiLCJkb25lIiwiYXBwIiwiQXBwQmFzZSIsIkV2ZW50SGFuZGxlciIsImNhbnZhcyIsInZlcnNpb24iLCJpbmRleE9mIiwiRGVidWciLCJsb2ciLCJyZXZpc2lvbiIsIl9hcHBsaWNhdGlvbnMiLCJpZCIsInNldEFwcGxpY2F0aW9uIiwiX2Rlc3Ryb3lSZXF1ZXN0ZWQiLCJfaW5GcmFtZVVwZGF0ZSIsIl90aW1lIiwidGltZVNjYWxlIiwibWF4RGVsdGFUaW1lIiwiZnJhbWUiLCJhdXRvUmVuZGVyIiwicmVuZGVyTmV4dEZyYW1lIiwidXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyIsInNjcmlwdCIsImxlZ2FjeSIsIl9saWJyYXJpZXNMb2FkZWQiLCJfZmlsbE1vZGUiLCJGSUxMTU9ERV9LRUVQX0FTUEVDVCIsIl9yZXNvbHV0aW9uTW9kZSIsIlJFU09MVVRJT05fRklYRUQiLCJfYWxsb3dSZXNpemUiLCJjb250ZXh0IiwiaW5pdCIsImFwcE9wdGlvbnMiLCJkZXZpY2UiLCJncmFwaGljc0RldmljZSIsImFzc2VydCIsIkdyYXBoaWNzRGV2aWNlQWNjZXNzIiwic2V0IiwiX2luaXREZWZhdWx0TWF0ZXJpYWwiLCJfaW5pdFByb2dyYW1MaWJyYXJ5Iiwic3RhdHMiLCJBcHBsaWNhdGlvblN0YXRzIiwiX3NvdW5kTWFuYWdlciIsInNvdW5kTWFuYWdlciIsImxvYWRlciIsIlJlc291cmNlTG9hZGVyIiwiTGlnaHRzQnVmZmVyIiwiX2VudGl0eUluZGV4Iiwic2NlbmUiLCJTY2VuZSIsIl9yZWdpc3RlclNjZW5lSW1tZWRpYXRlIiwicm9vdCIsIkVudGl0eSIsIl9lbmFibGVkSW5IaWVyYXJjaHkiLCJhc3NldHMiLCJBc3NldFJlZ2lzdHJ5IiwiYXNzZXRQcmVmaXgiLCJwcmVmaXgiLCJidW5kbGVzIiwiQnVuZGxlUmVnaXN0cnkiLCJlbmFibGVCdW5kbGVzIiwiVGV4dERlY29kZXIiLCJzY3JpcHRzT3JkZXIiLCJzY3JpcHRzIiwiU2NyaXB0UmVnaXN0cnkiLCJpMThuIiwiSTE4biIsInNjZW5lcyIsIlNjZW5lUmVnaXN0cnkiLCJzZWxmIiwiZGVmYXVsdExheWVyV29ybGQiLCJMYXllciIsIm5hbWUiLCJMQVlFUklEX1dPUkxEIiwic2NlbmVHcmFiIiwiU2NlbmVHcmFiIiwiZGVmYXVsdExheWVyRGVwdGgiLCJsYXllciIsImRlZmF1bHRMYXllclNreWJveCIsImVuYWJsZWQiLCJMQVlFUklEX1NLWUJPWCIsIm9wYXF1ZVNvcnRNb2RlIiwiU09SVE1PREVfTk9ORSIsImRlZmF1bHRMYXllclVpIiwiTEFZRVJJRF9VSSIsInRyYW5zcGFyZW50U29ydE1vZGUiLCJTT1JUTU9ERV9NQU5VQUwiLCJwYXNzVGhyb3VnaCIsImRlZmF1bHRMYXllckltbWVkaWF0ZSIsIkxBWUVSSURfSU1NRURJQVRFIiwiZGVmYXVsdExheWVyQ29tcG9zaXRpb24iLCJMYXllckNvbXBvc2l0aW9uIiwicHVzaE9wYXF1ZSIsInB1c2hUcmFuc3BhcmVudCIsImxheWVycyIsIm9uIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJsaXN0IiwibGF5ZXJMaXN0IiwiaSIsIkxBWUVSSURfREVQVEgiLCJwYXRjaCIsIkFyZWFMaWdodEx1dHMiLCJjcmVhdGVQbGFjZWhvbGRlciIsInJlbmRlcmVyIiwiRm9yd2FyZFJlbmRlcmVyIiwiZnJhbWVHcmFwaCIsIkZyYW1lR3JhcGgiLCJsaWdodG1hcHBlciIsIm9uY2UiLCJfZmlyc3RCYWtlIiwiX2JhdGNoZXIiLCJiYXRjaE1hbmFnZXIiLCJfZmlyc3RCYXRjaCIsImtleWJvYXJkIiwibW91c2UiLCJ0b3VjaCIsImdhbWVwYWRzIiwiZWxlbWVudElucHV0IiwieHIiLCJhdHRhY2hTZWxlY3RFdmVudHMiLCJfaW5Ub29scyIsIl9za3lib3hBc3NldCIsIl9zY3JpcHRQcmVmaXgiLCJzY3JpcHRQcmVmaXgiLCJhZGRIYW5kbGVyIiwiQnVuZGxlSGFuZGxlciIsInJlc291cmNlSGFuZGxlcnMiLCJmb3JFYWNoIiwicmVzb3VyY2VIYW5kbGVyIiwiaGFuZGxlciIsImhhbmRsZXJUeXBlIiwic3lzdGVtcyIsIkNvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5IiwiY29tcG9uZW50U3lzdGVtcyIsImNvbXBvbmVudFN5c3RlbSIsImFkZCIsIl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciIsIm9uVmlzaWJpbGl0eUNoYW5nZSIsImJpbmQiLCJkb2N1bWVudCIsImhpZGRlbiIsInVuZGVmaW5lZCIsIl9oaWRkZW5BdHRyIiwiYWRkRXZlbnRMaXN0ZW5lciIsIm1vekhpZGRlbiIsIm1zSGlkZGVuIiwid2Via2l0SGlkZGVuIiwidGljayIsIm1ha2VUaWNrIiwiZ2V0QXBwbGljYXRpb24iLCJtYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9CTElOTiIsInNldERlZmF1bHRNYXRlcmlhbCIsImxpYnJhcnkiLCJQcm9ncmFtTGlicmFyeSIsInNldFByb2dyYW1MaWJyYXJ5IiwiYmF0Y2hlciIsImZpbGxNb2RlIiwicmVzb2x1dGlvbk1vZGUiLCJjb25maWd1cmUiLCJ1cmwiLCJjYWxsYmFjayIsImh0dHAiLCJnZXQiLCJlcnIiLCJyZXNwb25zZSIsInByb3BzIiwiYXBwbGljYXRpb25fcHJvcGVydGllcyIsIl9wYXJzZUFwcGxpY2F0aW9uUHJvcGVydGllcyIsIl9wYXJzZVNjZW5lcyIsIl9wYXJzZUFzc2V0cyIsInByZWxvYWQiLCJmaXJlIiwicHJvZ3Jlc3MiLCJfZG9uZSIsInRvdGFsIiwib25Bc3NldExvYWQiLCJhc3NldCIsIm9uQXNzZXRFcnJvciIsImxvYWRlZCIsImxvYWQiLCJfcHJlbG9hZFNjcmlwdHMiLCJzY2VuZURhdGEiLCJwcmVsb2FkaW5nIiwiX2dldFNjcmlwdFJlZmVyZW5jZXMiLCJsIiwicmVnZXgiLCJvbkxvYWQiLCJTY3JpcHRUeXBlIiwiY29uc29sZSIsImVycm9yIiwic2NyaXB0VXJsIiwidGVzdCIsInRvTG93ZXJDYXNlIiwicGF0aCIsImpvaW4iLCJtYXhBc3NldFJldHJpZXMiLCJlbmFibGVSZXRyeSIsInVzZURldmljZVBpeGVsUmF0aW8iLCJ1c2VfZGV2aWNlX3BpeGVsX3JhdGlvIiwicmVzb2x1dGlvbl9tb2RlIiwiZmlsbF9tb2RlIiwiX3dpZHRoIiwid2lkdGgiLCJfaGVpZ2h0IiwiaGVpZ2h0IiwibWF4UGl4ZWxSYXRpbyIsIndpbmRvdyIsImRldmljZVBpeGVsUmF0aW8iLCJzZXRDYW52YXNSZXNvbHV0aW9uIiwic2V0Q2FudmFzRmlsbE1vZGUiLCJsYXllck9yZGVyIiwiY29tcG9zaXRpb24iLCJrZXkiLCJkYXRhIiwicGFyc2VJbnQiLCJsZW4iLCJzdWJsYXllciIsInRyYW5zcGFyZW50Iiwic3ViTGF5ZXJFbmFibGVkIiwiYmF0Y2hHcm91cHMiLCJncnAiLCJhZGRHcm91cCIsImR5bmFtaWMiLCJtYXhBYWJiU2l6ZSIsImkxOG5Bc3NldHMiLCJfbG9hZExpYnJhcmllcyIsImxpYnJhcmllcyIsInVybHMiLCJvbkxpYnJhcmllc0xvYWRlZCIsInNjcmlwdHNJbmRleCIsImJ1bmRsZXNJbmRleCIsInB1c2giLCJ0eXBlIiwiQXNzZXQiLCJmaWxlIiwibG9hZGluZ1R5cGUiLCJ0YWdzIiwibG9jYWxlIiwiYWRkTG9jYWxpemVkQXNzZXRJZCIsInByaW9yaXR5U2NyaXB0cyIsInNldHRpbmdzIiwicHJpb3JpdHlfc2NyaXB0cyIsIl9zY3JpcHRzIiwiX2luZGV4IiwiZW50aXRpZXMiLCJjb21wb25lbnRzIiwic3RhcnQiLCJ0aW1lc3RhbXAiLCJub3ciLCJ0YXJnZXQiLCJpbnB1dFVwZGF0ZSIsImR0IiwiY29udHJvbGxlciIsInVwZGF0ZSIsInVwZGF0ZUNsaWVudFJlY3QiLCJ1cGRhdGVTdGFydCIsInVwZGF0ZVRpbWUiLCJyZW5kZXIiLCJyZW5kZXJTdGFydCIsInN5bmNIaWVyYXJjaHkiLCJ1cGRhdGVBbGwiLCJfc2tpcFJlbmRlckNvdW50ZXIiLCJyZW5kZXJDb21wb3NpdGlvbiIsInJlbmRlclRpbWUiLCJsYXllckNvbXBvc2l0aW9uIiwiYnVpbGRGcmFtZUdyYXBoIiwiX2ZpbGxGcmFtZVN0YXRzQmFzaWMiLCJtcyIsIl90aW1lVG9Db3VudEZyYW1lcyIsImZwcyIsIl9mcHNBY2N1bSIsImRyYXdDYWxscyIsIl9kcmF3Q2FsbHNQZXJGcmFtZSIsIl9maWxsRnJhbWVTdGF0cyIsImNhbWVyYXMiLCJfY2FtZXJhc1JlbmRlcmVkIiwibWF0ZXJpYWxzIiwiX21hdGVyaWFsU3dpdGNoZXMiLCJzaGFkZXJzIiwiX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUiLCJzaGFkb3dNYXBVcGRhdGVzIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJzaGFkb3dNYXBUaW1lIiwiX3NoYWRvd01hcFRpbWUiLCJkZXB0aE1hcFRpbWUiLCJfZGVwdGhNYXBUaW1lIiwiZm9yd2FyZFRpbWUiLCJfZm9yd2FyZFRpbWUiLCJwcmltcyIsIl9wcmltc1BlckZyYW1lIiwidHJpYW5nbGVzIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsIk1hdGgiLCJtYXgiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiY3VsbFRpbWUiLCJfY3VsbFRpbWUiLCJzb3J0VGltZSIsIl9zb3J0VGltZSIsInNraW5UaW1lIiwiX3NraW5UaW1lIiwibW9ycGhUaW1lIiwiX21vcnBoVGltZSIsImxpZ2h0Q2x1c3RlcnMiLCJfbGlnaHRDbHVzdGVycyIsImxpZ2h0Q2x1c3RlcnNUaW1lIiwiX2xpZ2h0Q2x1c3RlcnNUaW1lIiwib3RoZXJQcmltaXRpdmVzIiwiX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lIiwiZm9yd2FyZCIsIl9mb3J3YXJkRHJhd0NhbGxzIiwiY3VsbGVkIiwiX251bURyYXdDYWxsc0N1bGxlZCIsImRlcHRoIiwic2hhZG93IiwiX3NoYWRvd0RyYXdDYWxscyIsInNraW5uZWQiLCJfc2tpbkRyYXdDYWxscyIsImltbWVkaWF0ZSIsImluc3RhbmNlZCIsInJlbW92ZWRCeUluc3RhbmNpbmciLCJtaXNjIiwiX2RlcHRoRHJhd0NhbGxzIiwiX2ltbWVkaWF0ZVJlbmRlcmVkIiwiX2luc3RhbmNlZERyYXdDYWxscyIsInJlbmRlclRhcmdldENyZWF0aW9uVGltZSIsInBhcnRpY2xlcyIsInVwZGF0ZXNQZXJGcmFtZSIsIl91cGRhdGVzUGVyRnJhbWUiLCJmcmFtZVRpbWUiLCJfZnJhbWVUaW1lIiwibW9kZSIsInJlc2l6ZUNhbnZhcyIsIlJFU09MVVRJT05fQVVUTyIsImNsaWVudFdpZHRoIiwiY2xpZW50SGVpZ2h0IiwiaXNIaWRkZW4iLCJzdXNwZW5kIiwicmVzdW1lIiwic2Vzc2lvbiIsIndpbmRvd1dpZHRoIiwiaW5uZXJXaWR0aCIsIndpbmRvd0hlaWdodCIsImlubmVySGVpZ2h0IiwiciIsIndpblIiLCJGSUxMTU9ERV9GSUxMX1dJTkRPVyIsInN0eWxlIiwidXBkYXRlQ2FudmFzU2l6ZSIsImFjdGl2ZSIsInJpZ2lkYm9keSIsIm9uTGlicmFyeUxvYWRlZCIsImFwcGx5U2NlbmVTZXR0aW5ncyIsIkFtbW8iLCJncmF2aXR5IiwicGh5c2ljcyIsImFwcGx5U2V0dGluZ3MiLCJoYXNPd25Qcm9wZXJ0eSIsInNreWJveCIsInNldFNreWJveCIsInNldEFyZWFMaWdodEx1dHMiLCJsdGNNYXQxIiwibHRjTWF0MiIsIndhcm4iLCJvblNreWJveFJlbW92ZWQiLCJvblNreWJveENoYW5nZWQiLCJyZXNvdXJjZXMiLCJvZmYiLCJza3lib3hNaXAiLCJsb2FkRmFjZXMiLCJiYWtlIiwibGlnaHRtYXBNb2RlIiwiZ2VuZXJhdGUiLCJfcHJvY2Vzc1RpbWVzdGFtcCIsImRyYXdMaW5lIiwiZW5kIiwiY29sb3IiLCJkZXB0aFRlc3QiLCJkcmF3TGluZXMiLCJwb3NpdGlvbnMiLCJjb2xvcnMiLCJkZWZhdWx0RHJhd0xheWVyIiwiZHJhd0xpbmVBcnJheXMiLCJkcmF3V2lyZVNwaGVyZSIsImNlbnRlciIsInJhZGl1cyIsIkNvbG9yIiwiV0hJVEUiLCJzZWdtZW50cyIsImRyYXdXaXJlQWxpZ25lZEJveCIsIm1pblBvaW50IiwibWF4UG9pbnQiLCJkcmF3TWVzaEluc3RhbmNlIiwibWVzaEluc3RhbmNlIiwiZHJhd01lc2giLCJtZXNoIiwibWF0cml4IiwiZHJhd1F1YWQiLCJnZXRRdWFkTWVzaCIsImRyYXdUZXh0dXJlIiwieCIsInkiLCJ0ZXh0dXJlIiwiTWF0NCIsInNldFRSUyIsIlZlYzMiLCJRdWF0IiwiSURFTlRJVFkiLCJNYXRlcmlhbCIsInNldFBhcmFtZXRlciIsInNoYWRlciIsImdldFRleHR1cmVTaGFkZXIiLCJkcmF3RGVwdGhUZXh0dXJlIiwiZ2V0RGVwdGhUZXh0dXJlU2hhZGVyIiwiZGVzdHJveSIsImNhbnZhc0lkIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImRldGFjaCIsInVubG9hZCIsImdldEhhbmRsZXIiLCJfY2FjaGUiLCJlbGVtZW50IiwicGFyZW50IiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblBvc3RSZW5kZXJPcGFxdWUiLCJvbkRpc2FibGUiLCJvbkVuYWJsZSIsImdldEVudGl0eUZyb21JbmRleCIsImd1aWQiLCJvblBvc3RSZW5kZXIiLCJfZnJhbWVFbmREYXRhIiwiX2FwcCIsImFwcGxpY2F0aW9uIiwiZnJhbWVSZXF1ZXN0IiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJjdXJyZW50VGltZSIsIm1hdGgiLCJjbGFtcCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInBsYXRmb3JtIiwiYnJvd3NlciIsImNvbnRleHRMb3N0Iiwic2hvdWxkUmVuZGVyRnJhbWUiLCJkZWZhdWx0RnJhbWVidWZmZXIiLCJyZW5kZXJTdGF0ZSIsImJhc2VMYXllciIsImZyYW1lYnVmZmVyIiwidHJhY2UiLCJUUkFDRUlEX1JFTkRFUl9GUkFNRSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQStEQSxNQUFNQSxRQUFRLENBQUM7RUFDWEMsV0FBVyxDQUFDQyxNQUFNLEVBQUU7SUFDaEIsSUFBSSxDQUFDQSxNQUFNLEdBQUdBLE1BQU0sQ0FBQTtJQUNwQixJQUFJLENBQUNDLEtBQUssR0FBRyxDQUFDLENBQUE7QUFDbEIsR0FBQTtBQUVBQyxFQUFBQSxHQUFHLEdBQUc7SUFDRixJQUFJLENBQUNELEtBQUssRUFBRSxDQUFBO0FBQ2hCLEdBQUE7QUFFQUUsRUFBQUEsSUFBSSxHQUFHO0FBQ0gsSUFBQSxPQUFRLElBQUksQ0FBQ0YsS0FBSyxLQUFLLElBQUksQ0FBQ0QsTUFBTSxDQUFBO0FBQ3RDLEdBQUE7QUFDSixDQUFBOztBQWdCSUksSUFBQUEsR0FBRyxHQUFHLEtBQUk7O0FBNEJkLE1BQU1DLE9BQU8sU0FBU0MsWUFBWSxDQUFDO0VBZ0IvQlAsV0FBVyxDQUFDUSxNQUFNLEVBQUU7QUFDaEIsSUFBQSxLQUFLLEVBQUUsQ0FBQTtJQUdQLElBQUksQ0FBQUMsT0FBTyxDQUFFQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUcsQ0FBQyxFQUFFO01BQzNCQyxLQUFLLENBQUNDLEdBQUcsQ0FBRSxDQUFBLHNCQUFBLEVBQXdCSCxPQUFRLENBQUdJLENBQUFBLEVBQUFBLFFBQVMsRUFBQyxDQUFDLENBQUE7QUFDN0QsS0FBQTs7SUFJQVAsT0FBTyxDQUFDUSxhQUFhLENBQUNOLE1BQU0sQ0FBQ08sRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFBO0lBQ3ZDQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUE7QUFFcEJYLElBQUFBLEdBQUcsR0FBRyxJQUFJLENBQUE7O0lBR1YsSUFBSSxDQUFDWSxpQkFBaUIsR0FBRyxLQUFLLENBQUE7O0lBRzlC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
