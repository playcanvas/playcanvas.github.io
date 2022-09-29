/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { version, revision } from '../core/core.js';
import { platform } from '../core/platform.js';
import { now } from '../core/time.js';
import { path } from '../core/path.js';
import { EventHandler } from '../core/event-handler.js';
import { Debug } from '../core/debug.js';
import { TRACEID_RENDER_FRAME } from '../core/constants.js';
import { math } from '../math/math.js';
import { Color } from '../math/color.js';
import { Vec3 } from '../math/vec3.js';
import { Mat4 } from '../math/mat4.js';
import { Quat } from '../math/quat.js';
import { http } from '../net/http.js';
import { PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN } from '../graphics/constants.js';
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
import { BundleHandler } from '../resources/bundle.js';
import { ResourceLoader } from '../resources/loader.js';
import { Asset } from '../asset/asset.js';
import { AssetRegistry } from '../asset/asset-registry.js';
import { BundleRegistry } from '../bundles/bundle-registry.js';
import { ScriptRegistry } from '../script/script-registry.js';
import { I18n } from '../i18n/i18n.js';
import { ComponentSystemRegistry } from './components/registry.js';
import { script } from './script.js';
import { ApplicationStats } from './stats.js';
import { Entity } from './entity.js';
import { SceneRegistry } from './scene-registry.js';
import { SceneGrab } from './scene-grab.js';
import { FILLMODE_KEEP_ASPECT, RESOLUTION_FIXED, RESOLUTION_AUTO, FILLMODE_FILL_WINDOW } from './constants.js';
import { getApplication, setApplication } from './globals.js';

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

    this._initDefaultMaterial();

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLWJhc2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLWJhc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gI2lmIF9ERUJVR1xuaW1wb3J0IHsgdmVyc2lvbiwgcmV2aXNpb24gfSBmcm9tICcuLi9jb3JlL2NvcmUuanMnO1xuLy8gI2VuZGlmXG5cbmltcG9ydCB7IHBsYXRmb3JtIH0gZnJvbSAnLi4vY29yZS9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBub3cgfSBmcm9tICcuLi9jb3JlL3RpbWUuanMnO1xuaW1wb3J0IHsgcGF0aCB9IGZyb20gJy4uL2NvcmUvcGF0aC5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfUkVOREVSX0ZSQU1FIH0gZnJvbSAnLi4vY29yZS9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vbWF0aC92ZWMzLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9tYXRoL21hdDQuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uL21hdGgvcXVhdC5qcyc7XG5cbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7XG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQXG59IGZyb20gJy4uL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9ERVBUSCwgTEFZRVJJRF9JTU1FRElBVEUsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX1dPUkxELFxuICAgIFNPUlRNT0RFX05PTkUsIFNPUlRNT0RFX01BTlVBTCwgU1BFQ1VMQVJfQkxJTk5cbn0gZnJvbSAnLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEZvcndhcmRSZW5kZXJlciB9IGZyb20gJy4uL3NjZW5lL3JlbmRlcmVyL2ZvcndhcmQtcmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgRnJhbWVHcmFwaCB9IGZyb20gJy4uL3NjZW5lL2ZyYW1lLWdyYXBoLmpzJztcbmltcG9ydCB7IEFyZWFMaWdodEx1dHMgfSBmcm9tICcuLi9zY2VuZS9hcmVhLWxpZ2h0LWx1dHMuanMnO1xuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tICcuLi9zY2VuZS9sYXllci5qcyc7XG5pbXBvcnQgeyBMYXllckNvbXBvc2l0aW9uIH0gZnJvbSAnLi4vc2NlbmUvY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU2NlbmUgfSBmcm9tICcuLi9zY2VuZS9zY2VuZS5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBMaWdodHNCdWZmZXIgfSBmcm9tICcuLi9zY2VuZS9saWdodGluZy9saWdodHMtYnVmZmVyLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgc2V0RGVmYXVsdE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL2RlZmF1bHQtbWF0ZXJpYWwuanMnO1xuXG5pbXBvcnQgeyBCdW5kbGVIYW5kbGVyIH0gZnJvbSAnLi4vcmVzb3VyY2VzL2J1bmRsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxvYWRlciB9IGZyb20gJy4uL3Jlc291cmNlcy9sb2FkZXIuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uL2Fzc2V0L2Fzc2V0LmpzJztcbmltcG9ydCB7IEFzc2V0UmVnaXN0cnkgfSBmcm9tICcuLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5cbmltcG9ydCB7IEJ1bmRsZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vYnVuZGxlcy9idW5kbGUtcmVnaXN0cnkuanMnO1xuXG5pbXBvcnQgeyBTY3JpcHRSZWdpc3RyeSB9IGZyb20gJy4uL3NjcmlwdC9zY3JpcHQtcmVnaXN0cnkuanMnO1xuXG5pbXBvcnQgeyBJMThuIH0gZnJvbSAnLi4vaTE4bi9pMThuLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50U3lzdGVtUmVnaXN0cnkgfSBmcm9tICcuL2NvbXBvbmVudHMvcmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgc2NyaXB0IH0gZnJvbSAnLi9zY3JpcHQuanMnO1xuaW1wb3J0IHsgQXBwbGljYXRpb25TdGF0cyB9IGZyb20gJy4vc3RhdHMuanMnO1xuaW1wb3J0IHsgRW50aXR5IH0gZnJvbSAnLi9lbnRpdHkuanMnO1xuaW1wb3J0IHsgU2NlbmVSZWdpc3RyeSB9IGZyb20gJy4vc2NlbmUtcmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgU2NlbmVHcmFiIH0gZnJvbSAnLi9zY2VuZS1ncmFiLmpzJztcblxuaW1wb3J0IHtcbiAgICBGSUxMTU9ERV9GSUxMX1dJTkRPVywgRklMTE1PREVfS0VFUF9BU1BFQ1QsXG4gICAgUkVTT0xVVElPTl9BVVRPLCBSRVNPTFVUSU9OX0ZJWEVEXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHtcbiAgICBnZXRBcHBsaWNhdGlvbixcbiAgICBzZXRBcHBsaWNhdGlvblxufSBmcm9tICcuL2dsb2JhbHMuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9IFRleHR1cmUgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9pbnB1dC9lbGVtZW50LWlucHV0LmpzJykuRWxlbWVudElucHV0fSBFbGVtZW50SW5wdXQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9pbnB1dC9nYW1lLXBhZHMuanMnKS5HYW1lUGFkc30gR2FtZVBhZHMgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9pbnB1dC9rZXlib2FyZC5qcycpLktleWJvYXJkfSBLZXlib2FyZCAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2lucHV0L21vdXNlLmpzJykuTW91c2V9IE1vdXNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vaW5wdXQvdG91Y2gtZGV2aWNlLmpzJykuVG91Y2hEZXZpY2V9IFRvdWNoRGV2aWNlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcycpLkdyYXBoTm9kZX0gR3JhcGhOb2RlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vc2NlbmUvbWVzaC5qcycpLk1lc2h9IE1lc2ggKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlfSBNZXNoSW5zdGFuY2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9zY2VuZS9saWdodG1hcHBlci9saWdodG1hcHBlci5qcycpLkxpZ2h0bWFwcGVyfSBMaWdodG1hcHBlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLW1hbmFnZXIuanMnKS5CYXRjaE1hbmFnZXJ9IEJhdGNoTWFuYWdlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vYXBwLW9wdGlvbnMuanMnKS5BcHBPcHRpb25zfSBBcHBPcHRpb25zICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4veHIveHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gWHJNYW5hZ2VyICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn0gU291bmRNYW5hZ2VyICovXG5cbi8vIE1pbmktb2JqZWN0IHVzZWQgdG8gbWVhc3VyZSBwcm9ncmVzcyBvZiBsb2FkaW5nIHNldHNcbmNsYXNzIFByb2dyZXNzIHtcbiAgICBjb25zdHJ1Y3RvcihsZW5ndGgpIHtcbiAgICAgICAgdGhpcy5sZW5ndGggPSBsZW5ndGg7XG4gICAgICAgIHRoaXMuY291bnQgPSAwO1xuICAgIH1cblxuICAgIGluYygpIHtcbiAgICAgICAgdGhpcy5jb3VudCsrO1xuICAgIH1cblxuICAgIGRvbmUoKSB7XG4gICAgICAgIHJldHVybiAodGhpcy5jb3VudCA9PT0gdGhpcy5sZW5ndGgpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBcHBCYXNlI2NvbmZpZ3VyZX0gd2hlbiBjb25maWd1cmF0aW9uIGZpbGUgaXMgbG9hZGVkIGFuZCBwYXJzZWQgKG9yXG4gKiBhbiBlcnJvciBvY2N1cnMpLlxuICpcbiAqIEBjYWxsYmFjayBDb25maWd1cmVBcHBDYWxsYmFja1xuICogQHBhcmFtIHtzdHJpbmd8bnVsbH0gZXJyIC0gVGhlIGVycm9yIG1lc3NhZ2UgaW4gdGhlIGNhc2Ugd2hlcmUgdGhlIGxvYWRpbmcgb3IgcGFyc2luZyBmYWlscy5cbiAqL1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEFwcEJhc2UjcHJlbG9hZH0gd2hlbiBhbGwgYXNzZXRzIChtYXJrZWQgYXMgJ3ByZWxvYWQnKSBhcmUgbG9hZGVkLlxuICpcbiAqIEBjYWxsYmFjayBQcmVsb2FkQXBwQ2FsbGJhY2tcbiAqL1xuXG5sZXQgYXBwID0gbnVsbDtcblxuLyoqXG4gKiBBbiBBcHBsaWNhdGlvbiByZXByZXNlbnRzIGFuZCBtYW5hZ2VzIHlvdXIgUGxheUNhbnZhcyBhcHBsaWNhdGlvbi4gSWYgeW91IGFyZSBkZXZlbG9waW5nIHVzaW5nXG4gKiB0aGUgUGxheUNhbnZhcyBFZGl0b3IsIHRoZSBBcHBsaWNhdGlvbiBpcyBjcmVhdGVkIGZvciB5b3UuIFlvdSBjYW4gYWNjZXNzIHlvdXIgQXBwbGljYXRpb25cbiAqIGluc3RhbmNlIGluIHlvdXIgc2NyaXB0cy4gQmVsb3cgaXMgYSBza2VsZXRvbiBzY3JpcHQgd2hpY2ggc2hvd3MgaG93IHlvdSBjYW4gYWNjZXNzIHRoZVxuICogYXBwbGljYXRpb24gJ2FwcCcgcHJvcGVydHkgaW5zaWRlIHRoZSBpbml0aWFsaXplIGFuZCB1cGRhdGUgZnVuY3Rpb25zOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vIEVkaXRvciBleGFtcGxlOiBhY2Nlc3NpbmcgdGhlIHBjLkFwcGxpY2F0aW9uIGZyb20gYSBzY3JpcHRcbiAqIHZhciBNeVNjcmlwdCA9IHBjLmNyZWF0ZVNjcmlwdCgnbXlTY3JpcHQnKTtcbiAqXG4gKiBNeVNjcmlwdC5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKCkge1xuICogICAgIC8vIEV2ZXJ5IHNjcmlwdCBpbnN0YW5jZSBoYXMgYSBwcm9wZXJ0eSAndGhpcy5hcHAnIGFjY2Vzc2libGUgaW4gdGhlIGluaXRpYWxpemUuLi5cbiAqICAgICB2YXIgYXBwID0gdGhpcy5hcHA7XG4gKiB9O1xuICpcbiAqIE15U2NyaXB0LnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihkdCkge1xuICogICAgIC8vIC4uLmFuZCB1cGRhdGUgZnVuY3Rpb25zLlxuICogICAgIHZhciBhcHAgPSB0aGlzLmFwcDtcbiAqIH07XG4gKiBgYGBcbiAqXG4gKiBJZiB5b3UgYXJlIHVzaW5nIHRoZSBFbmdpbmUgd2l0aG91dCB0aGUgRWRpdG9yLCB5b3UgaGF2ZSB0byBjcmVhdGUgdGhlIGFwcGxpY2F0aW9uIGluc3RhbmNlXG4gKiBtYW51YWxseS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEFwcEJhc2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBcHBCYXNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtFbGVtZW50fSBjYW52YXMgLSBUaGUgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBFbmdpbmUtb25seSBleGFtcGxlOiBjcmVhdGUgdGhlIGFwcGxpY2F0aW9uIG1hbnVhbGx5XG4gICAgICogdmFyIG9wdGlvbnMgPSBuZXcgQXBwT3B0aW9ucygpO1xuICAgICAqIHZhciBhcHAgPSBuZXcgcGMuQXBwQmFzZShjYW52YXMpO1xuICAgICAqIGFwcC5pbml0KG9wdGlvbnMpO1xuICAgICAqXG4gICAgICogLy8gU3RhcnQgdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wXG4gICAgICogYXBwLnN0YXJ0KCk7XG4gICAgICpcbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY2FudmFzKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodmVyc2lvbj8uaW5kZXhPZignJCcpIDwgMCkge1xuICAgICAgICAgICAgRGVidWcubG9nKGBQb3dlcmVkIGJ5IFBsYXlDYW52YXMgJHt2ZXJzaW9ufSAke3JldmlzaW9ufWApO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIFN0b3JlIGFwcGxpY2F0aW9uIGluc3RhbmNlXG4gICAgICAgIEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tjYW52YXMuaWRdID0gdGhpcztcbiAgICAgICAgc2V0QXBwbGljYXRpb24odGhpcyk7XG5cbiAgICAgICAgYXBwID0gdGhpcztcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9pbkZyYW1lVXBkYXRlID0gZmFsc2U7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3RpbWUgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTY2FsZXMgdGhlIGdsb2JhbCB0aW1lIGRlbHRhLiBEZWZhdWx0cyB0byAxLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgdGhlIGFwcCB0byBydW4gYXQgaGFsZiBzcGVlZFxuICAgICAgICAgKiB0aGlzLmFwcC50aW1lU2NhbGUgPSAwLjU7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRpbWVTY2FsZSA9IDE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENsYW1wcyBwZXItZnJhbWUgZGVsdGEgdGltZSB0byBhbiB1cHBlciBib3VuZC4gVXNlZnVsIHNpbmNlIHJldHVybmluZyBmcm9tIGEgdGFiXG4gICAgICAgICAqIGRlYWN0aXZhdGlvbiBjYW4gZ2VuZXJhdGUgaHVnZSB2YWx1ZXMgZm9yIGR0LCB3aGljaCBjYW4gYWR2ZXJzZWx5IGFmZmVjdCBnYW1lIHN0YXRlLlxuICAgICAgICAgKiBEZWZhdWx0cyB0byAwLjEgKHNlY29uZHMpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBEb24ndCBjbGFtcCBpbnRlci1mcmFtZSB0aW1lcyBvZiAyMDBtcyBvciBsZXNzXG4gICAgICAgICAqIHRoaXMuYXBwLm1heERlbHRhVGltZSA9IDAuMjtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWF4RGVsdGFUaW1lID0gMC4xOyAvLyBNYXhpbXVtIGRlbHRhIGlzIDAuMXMgb3IgMTAgZnBzLlxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgbnVtYmVyIG9mIGZyYW1lcyB0aGUgYXBwbGljYXRpb24gaGFzIHVwZGF0ZWQgc2luY2Ugc3RhcnQoKSB3YXMgY2FsbGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmZyYW1lID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogV2hlbiB0cnVlLCB0aGUgYXBwbGljYXRpb24ncyByZW5kZXIgZnVuY3Rpb24gaXMgY2FsbGVkIGV2ZXJ5IGZyYW1lLiBTZXR0aW5nIGF1dG9SZW5kZXJcbiAgICAgICAgICogdG8gZmFsc2UgaXMgdXNlZnVsIHRvIGFwcGxpY2F0aW9ucyB3aGVyZSB0aGUgcmVuZGVyZWQgaW1hZ2UgbWF5IG9mdGVuIGJlIHVuY2hhbmdlZCBvdmVyXG4gICAgICAgICAqIHRpbWUuIFRoaXMgY2FuIGhlYXZpbHkgcmVkdWNlIHRoZSBhcHBsaWNhdGlvbidzIGxvYWQgb24gdGhlIENQVSBhbmQgR1BVLiBEZWZhdWx0cyB0b1xuICAgICAgICAgKiB0cnVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gRGlzYWJsZSByZW5kZXJpbmcgZXZlcnkgZnJhbWUgYW5kIG9ubHkgcmVuZGVyIG9uIGEga2V5ZG93biBldmVudFxuICAgICAgICAgKiB0aGlzLmFwcC5hdXRvUmVuZGVyID0gZmFsc2U7XG4gICAgICAgICAqIHRoaXMuYXBwLmtleWJvYXJkLm9uKCdrZXlkb3duJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAqICAgICB0aGlzLmFwcC5yZW5kZXJOZXh0RnJhbWUgPSB0cnVlO1xuICAgICAgICAgKiB9LCB0aGlzKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXV0b1JlbmRlciA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCB0byB0cnVlIHRvIHJlbmRlciB0aGUgc2NlbmUgb24gdGhlIG5leHQgaXRlcmF0aW9uIG9mIHRoZSBtYWluIGxvb3AuIFRoaXMgb25seSBoYXMgYW5cbiAgICAgICAgICogZWZmZWN0IGlmIHtAbGluayBBcHBCYXNlI2F1dG9SZW5kZXJ9IGlzIHNldCB0byBmYWxzZS4gVGhlIHZhbHVlIG9mIHJlbmRlck5leHRGcmFtZVxuICAgICAgICAgKiBpcyBzZXQgYmFjayB0byBmYWxzZSBhZ2FpbiBhcyBzb29uIGFzIHRoZSBzY2VuZSBoYXMgYmVlbiByZW5kZXJlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFJlbmRlciB0aGUgc2NlbmUgb25seSB3aGlsZSBzcGFjZSBrZXkgaXMgcHJlc3NlZFxuICAgICAgICAgKiBpZiAodGhpcy5hcHAua2V5Ym9hcmQuaXNQcmVzc2VkKHBjLktFWV9TUEFDRSkpIHtcbiAgICAgICAgICogICAgIHRoaXMuYXBwLnJlbmRlck5leHRGcmFtZSA9IHRydWU7XG4gICAgICAgICAqIH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVuZGVyTmV4dEZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEVuYWJsZSBpZiB5b3Ugd2FudCBlbnRpdHkgdHlwZSBzY3JpcHQgYXR0cmlidXRlcyB0byBub3QgYmUgcmUtbWFwcGVkIHdoZW4gYW4gZW50aXR5IGlzXG4gICAgICAgICAqIGNsb25lZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyA9IHNjcmlwdC5sZWdhY3k7XG5cbiAgICAgICAgdGhpcy5fbGlicmFyaWVzTG9hZGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZpbGxNb2RlID0gRklMTE1PREVfS0VFUF9BU1BFQ1Q7XG4gICAgICAgIHRoaXMuX3Jlc29sdXRpb25Nb2RlID0gUkVTT0xVVElPTl9GSVhFRDtcbiAgICAgICAgdGhpcy5fYWxsb3dSZXNpemUgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBzY3JpcHRzIDEuMC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0FwcEJhc2V9XG4gICAgICAgICAqIEBkZXByZWNhdGVkXG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgYXBwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcHBPcHRpb25zfSBhcHBPcHRpb25zIC0gT3B0aW9ucyBzcGVjaWZ5aW5nIHRoZSBpbml0IHBhcmFtZXRlcnMgZm9yIHRoZSBhcHAuXG4gICAgICovXG4gICAgaW5pdChhcHBPcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IGFwcE9wdGlvbnMuZ3JhcGhpY3NEZXZpY2U7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KGRldmljZSwgXCJUaGUgYXBwbGljYXRpb24gY2Fubm90IGJlIGNyZWF0ZWQgd2l0aG91dCBhIHZhbGlkIEdyYXBoaWNzRGV2aWNlXCIpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R3JhcGhpY3NEZXZpY2V9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlID0gZGV2aWNlO1xuXG4gICAgICAgIHRoaXMuX2luaXREZWZhdWx0TWF0ZXJpYWwoKTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IG5ldyBBcHBsaWNhdGlvblN0YXRzKGRldmljZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtTb3VuZE1hbmFnZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIgPSBhcHBPcHRpb25zLnNvdW5kTWFuYWdlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJlc291cmNlIGxvYWRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1Jlc291cmNlTG9hZGVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2FkZXIgPSBuZXcgUmVzb3VyY2VMb2FkZXIodGhpcyk7XG5cbiAgICAgICAgTGlnaHRzQnVmZmVyLmluaXQoZGV2aWNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmVzIGFsbCBlbnRpdGllcyB0aGF0IGhhdmUgYmVlbiBjcmVhdGVkIGZvciB0aGlzIGFwcCBieSBndWlkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgRW50aXR5Pn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZW50aXR5SW5kZXggPSB7fTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNjZW5lIG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NlbmV9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCB0aGUgdG9uZSBtYXBwaW5nIHByb3BlcnR5IG9mIHRoZSBhcHBsaWNhdGlvbidzIHNjZW5lXG4gICAgICAgICAqIHRoaXMuYXBwLnNjZW5lLnRvbmVNYXBwaW5nID0gcGMuVE9ORU1BUF9GSUxNSUM7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjZW5lID0gbmV3IFNjZW5lKGRldmljZSk7XG4gICAgICAgIHRoaXMuX3JlZ2lzdGVyU2NlbmVJbW1lZGlhdGUodGhpcy5zY2VuZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSByb290IGVudGl0eSBvZiB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFJldHVybiB0aGUgZmlyc3QgZW50aXR5IGNhbGxlZCAnQ2FtZXJhJyBpbiBhIGRlcHRoLWZpcnN0IHNlYXJjaCBvZiB0aGUgc2NlbmUgaGllcmFyY2h5XG4gICAgICAgICAqIHZhciBjYW1lcmEgPSB0aGlzLmFwcC5yb290LmZpbmRCeU5hbWUoJ0NhbWVyYScpO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yb290ID0gbmV3IEVudGl0eSgpO1xuICAgICAgICB0aGlzLnJvb3QuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhc3NldCByZWdpc3RyeSBtYW5hZ2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Fzc2V0UmVnaXN0cnl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNlYXJjaCB0aGUgYXNzZXQgcmVnaXN0cnkgZm9yIGFsbCBhc3NldHMgd2l0aCB0aGUgdGFnICd2ZWhpY2xlJ1xuICAgICAgICAgKiB2YXIgdmVoaWNsZUFzc2V0cyA9IHRoaXMuYXBwLmFzc2V0cy5maW5kQnlUYWcoJ3ZlaGljbGUnKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXNzZXRzID0gbmV3IEFzc2V0UmVnaXN0cnkodGhpcy5sb2FkZXIpO1xuICAgICAgICBpZiAoYXBwT3B0aW9ucy5hc3NldFByZWZpeCkgdGhpcy5hc3NldHMucHJlZml4ID0gYXBwT3B0aW9ucy5hc3NldFByZWZpeDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0J1bmRsZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmJ1bmRsZXMgPSBuZXcgQnVuZGxlUmVnaXN0cnkodGhpcy5hc3NldHMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgdGhpcyB0byBmYWxzZSBpZiB5b3Ugd2FudCB0byBydW4gd2l0aG91dCB1c2luZyBidW5kbGVzLiBXZSBzZXQgaXQgdG8gdHJ1ZSBvbmx5IGlmXG4gICAgICAgICAqIFRleHREZWNvZGVyIGlzIGF2YWlsYWJsZSBiZWNhdXNlIHdlIGN1cnJlbnRseSByZWx5IG9uIGl0IGZvciB1bnRhcnJpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVuYWJsZUJ1bmRsZXMgPSAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJyk7XG5cbiAgICAgICAgdGhpcy5zY3JpcHRzT3JkZXIgPSBhcHBPcHRpb25zLnNjcmlwdHNPcmRlciB8fCBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uJ3Mgc2NyaXB0IHJlZ2lzdHJ5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NyaXB0UmVnaXN0cnl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBuZXcgU2NyaXB0UmVnaXN0cnkodGhpcyk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXMgbG9jYWxpemF0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7STE4bn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaTE4biA9IG5ldyBJMThuKHRoaXMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2NlbmUgcmVnaXN0cnkgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTY2VuZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZWFyY2ggdGhlIHNjZW5lIHJlZ2lzdHJ5IGZvciBhIGl0ZW0gd2l0aCB0aGUgbmFtZSAncmFjZXRyYWNrMSdcbiAgICAgICAgICogdmFyIHNjZW5lSXRlbSA9IHRoaXMuYXBwLnNjZW5lcy5maW5kKCdyYWNldHJhY2sxJyk7XG4gICAgICAgICAqXG4gICAgICAgICAqIC8vIExvYWQgdGhlIHNjZW5lIHVzaW5nIHRoZSBpdGVtJ3MgdXJsXG4gICAgICAgICAqIHRoaXMuYXBwLnNjZW5lcy5sb2FkU2NlbmUoc2NlbmVJdGVtLnVybCk7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjZW5lcyA9IG5ldyBTY2VuZVJlZ2lzdHJ5KHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllcldvcmxkID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIG5hbWU6IFwiV29ybGRcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX1dPUkxEXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuc2NlbmVHcmFiID0gbmV3IFNjZW5lR3JhYih0aGlzKTtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aCA9IHRoaXMuc2NlbmVHcmFiLmxheWVyO1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyU2t5Ym94ID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiBcIlNreWJveFwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfU0tZQk9YLFxuICAgICAgICAgICAgb3BhcXVlU29ydE1vZGU6IFNPUlRNT0RFX05PTkVcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyVWkgPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG5hbWU6IFwiVUlcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX1VJLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnRTb3J0TW9kZTogU09SVE1PREVfTUFOVUFMLFxuICAgICAgICAgICAgcGFzc1Rocm91Z2g6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSA9IG5ldyBMYXllcih7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbmFtZTogXCJJbW1lZGlhdGVcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX0lNTUVESUFURSxcbiAgICAgICAgICAgIG9wYXF1ZVNvcnRNb2RlOiBTT1JUTU9ERV9OT05FLFxuICAgICAgICAgICAgcGFzc1Rocm91Z2g6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZGVmYXVsdExheWVyQ29tcG9zaXRpb24gPSBuZXcgTGF5ZXJDb21wb3NpdGlvbihcImRlZmF1bHRcIik7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJXb3JsZCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJEZXB0aCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJTa3lib3gpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQodGhpcy5kZWZhdWx0TGF5ZXJXb3JsZCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQodGhpcy5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQodGhpcy5kZWZhdWx0TGF5ZXJVaSk7XG4gICAgICAgIHRoaXMuc2NlbmUubGF5ZXJzID0gZGVmYXVsdExheWVyQ29tcG9zaXRpb247XG5cbiAgICAgICAgLy8gRGVmYXVsdCBsYXllcnMgcGF0Y2hcbiAgICAgICAgdGhpcy5zY2VuZS5vbignc2V0OmxheWVycycsIGZ1bmN0aW9uIChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgICAgICBjb25zdCBsaXN0ID0gbmV3Q29tcC5sYXllckxpc3Q7XG4gICAgICAgICAgICBsZXQgbGF5ZXI7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsYXllciA9IGxpc3RbaV07XG4gICAgICAgICAgICAgICAgc3dpdGNoIChsYXllci5pZCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIExBWUVSSURfREVQVEg6XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNjZW5lR3JhYi5wYXRjaChsYXllcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBMQVlFUklEX1VJOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIucGFzc1Rocm91Z2ggPSBzZWxmLmRlZmF1bHRMYXllclVpLnBhc3NUaHJvdWdoO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTEFZRVJJRF9JTU1FRElBVEU6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5wYXNzVGhyb3VnaCA9IHNlbGYuZGVmYXVsdExheWVySW1tZWRpYXRlLnBhc3NUaHJvdWdoO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBwbGFjZWhvbGRlciB0ZXh0dXJlIGZvciBhcmVhIGxpZ2h0IExVVHNcbiAgICAgICAgQXJlYUxpZ2h0THV0cy5jcmVhdGVQbGFjZWhvbGRlcihkZXZpY2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZm9yd2FyZCByZW5kZXJlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0ZvcndhcmRSZW5kZXJlcn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IG5ldyBGb3J3YXJkUmVuZGVyZXIoZGV2aWNlKTtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zY2VuZSA9IHRoaXMuc2NlbmU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBmcmFtZSBncmFwaC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0ZyYW1lR3JhcGh9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZnJhbWVHcmFwaCA9IG5ldyBGcmFtZUdyYXBoKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBydW4tdGltZSBsaWdodG1hcHBlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0xpZ2h0bWFwcGVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG51bGw7XG4gICAgICAgIGlmIChhcHBPcHRpb25zLmxpZ2h0bWFwcGVyKSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyID0gbmV3IGFwcE9wdGlvbnMubGlnaHRtYXBwZXIoZGV2aWNlLCB0aGlzLnJvb3QsIHRoaXMuc2NlbmUsIHRoaXMucmVuZGVyZXIsIHRoaXMuYXNzZXRzKTtcbiAgICAgICAgICAgIHRoaXMub25jZSgncHJlcmVuZGVyJywgdGhpcy5fZmlyc3RCYWtlLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBiYXRjaCBtYW5hZ2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7QmF0Y2hNYW5hZ2VyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG51bGw7XG4gICAgICAgIGlmIChhcHBPcHRpb25zLmJhdGNoTWFuYWdlcikge1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG5ldyBhcHBPcHRpb25zLmJhdGNoTWFuYWdlcihkZXZpY2UsIHRoaXMucm9vdCwgdGhpcy5zY2VuZSk7XG4gICAgICAgICAgICB0aGlzLm9uY2UoJ3ByZXJlbmRlcicsIHRoaXMuX2ZpcnN0QmF0Y2gsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBrZXlib2FyZCBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLZXlib2FyZH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMua2V5Ym9hcmQgPSBhcHBPcHRpb25zLmtleWJvYXJkIHx8IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBtb3VzZSBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtNb3VzZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubW91c2UgPSBhcHBPcHRpb25zLm1vdXNlIHx8IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZWQgdG8gZ2V0IHRvdWNoIGV2ZW50cyBpbnB1dC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1RvdWNoRGV2aWNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50b3VjaCA9IGFwcE9wdGlvbnMudG91Y2ggfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBhY2Nlc3MgR2FtZVBhZCBpbnB1dC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0dhbWVQYWRzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5nYW1lcGFkcyA9IGFwcE9wdGlvbnMuZ2FtZXBhZHMgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBoYW5kbGUgaW5wdXQgZm9yIHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtFbGVtZW50SW5wdXR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dCA9IGFwcE9wdGlvbnMuZWxlbWVudElucHV0IHx8IG51bGw7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRJbnB1dClcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudElucHV0LmFwcCA9IHRoaXM7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBYUiBNYW5hZ2VyIHRoYXQgcHJvdmlkZXMgYWJpbGl0eSB0byBzdGFydCBWUi9BUiBzZXNzaW9ucy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1hyTWFuYWdlcn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gY2hlY2sgaWYgVlIgaXMgYXZhaWxhYmxlXG4gICAgICAgICAqIGlmIChhcHAueHIuaXNBdmFpbGFibGUocGMuWFJUWVBFX1ZSKSkge1xuICAgICAgICAgKiAgICAgLy8gVlIgaXMgYXZhaWxhYmxlXG4gICAgICAgICAqIH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMueHIgPSBhcHBPcHRpb25zLnhyID8gbmV3IGFwcE9wdGlvbnMueHIodGhpcykgOiBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRJbnB1dClcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudElucHV0LmF0dGFjaFNlbGVjdEV2ZW50cygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faW5Ub29scyA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7QXNzZXR8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NreWJveEFzc2V0ID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2NyaXB0UHJlZml4ID0gYXBwT3B0aW9ucy5zY3JpcHRQcmVmaXggfHwgJyc7XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlQnVuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIuYWRkSGFuZGxlcihcImJ1bmRsZVwiLCBuZXcgQnVuZGxlSGFuZGxlcih0aGlzKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgYW5kIHJlZ2lzdGVyIGFsbCByZXF1aXJlZCByZXNvdXJjZSBoYW5kbGVyc1xuICAgICAgICBhcHBPcHRpb25zLnJlc291cmNlSGFuZGxlcnMuZm9yRWFjaCgocmVzb3VyY2VIYW5kbGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gbmV3IHJlc291cmNlSGFuZGxlcih0aGlzKTtcbiAgICAgICAgICAgIHRoaXMubG9hZGVyLmFkZEhhbmRsZXIoaGFuZGxlci5oYW5kbGVyVHlwZSwgaGFuZGxlcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBjb21wb25lbnQgc3lzdGVtIHJlZ2lzdHJ5LiBUaGUgQXBwbGljYXRpb24gY29uc3RydWN0b3IgYWRkcyB0aGVcbiAgICAgICAgICogZm9sbG93aW5nIGNvbXBvbmVudCBzeXN0ZW1zIHRvIGl0cyBjb21wb25lbnQgc3lzdGVtIHJlZ2lzdHJ5OlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIGFuaW0gKHtAbGluayBBbmltQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBhbmltYXRpb24gKHtAbGluayBBbmltYXRpb25Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGF1ZGlvbGlzdGVuZXIgKHtAbGluayBBdWRpb0xpc3RlbmVyQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBidXR0b24gKHtAbGluayBCdXR0b25Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGNhbWVyYSAoe0BsaW5rIENhbWVyYUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gY29sbGlzaW9uICh7QGxpbmsgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBlbGVtZW50ICh7QGxpbmsgRWxlbWVudENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbGF5b3V0Y2hpbGQgKHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbGF5b3V0Z3JvdXAgKHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbGlnaHQgKHtAbGluayBMaWdodENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbW9kZWwgKHtAbGluayBNb2RlbENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gcGFydGljbGVzeXN0ZW0gKHtAbGluayBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gcmlnaWRib2R5ICh7QGxpbmsgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSByZW5kZXIgKHtAbGluayBSZW5kZXJDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcmVlbiAoe0BsaW5rIFNjcmVlbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2NyaXB0ICh7QGxpbmsgU2NyaXB0Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JvbGxiYXIgKHtAbGluayBTY3JvbGxiYXJDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcm9sbHZpZXcgKHtAbGluayBTY3JvbGxWaWV3Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzb3VuZCAoe0BsaW5rIFNvdW5kQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzcHJpdGUgKHtAbGluayBTcHJpdGVDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Q29tcG9uZW50U3lzdGVtUmVnaXN0cnl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCBnbG9iYWwgZ3Jhdml0eSB0byB6ZXJvXG4gICAgICAgICAqIHRoaXMuYXBwLnN5c3RlbXMucmlnaWRib2R5LmdyYXZpdHkuc2V0KDAsIDAsIDApO1xuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgdGhlIGdsb2JhbCBzb3VuZCB2b2x1bWUgdG8gNTAlXG4gICAgICAgICAqIHRoaXMuYXBwLnN5c3RlbXMuc291bmQudm9sdW1lID0gMC41O1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zeXN0ZW1zID0gbmV3IENvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5KCk7XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCByZWdpc3RlciBhbGwgcmVxdWlyZWQgY29tcG9uZW50IHN5c3RlbXNcbiAgICAgICAgYXBwT3B0aW9ucy5jb21wb25lbnRTeXN0ZW1zLmZvckVhY2goKGNvbXBvbmVudFN5c3RlbSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLmFkZChuZXcgY29tcG9uZW50U3lzdGVtKHRoaXMpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyID0gdGhpcy5vblZpc2liaWxpdHlDaGFuZ2UuYmluZCh0aGlzKTtcblxuICAgICAgICAvLyBEZXBlbmRpbmcgb24gYnJvd3NlciBhZGQgdGhlIGNvcnJlY3QgdmlzaWJpbGl0eWNoYW5nZSBldmVudCBhbmQgc3RvcmUgdGhlIG5hbWUgb2YgdGhlXG4gICAgICAgIC8vIGhpZGRlbiBhdHRyaWJ1dGUgaW4gdGhpcy5faGlkZGVuQXR0ci5cbiAgICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5oaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnaGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQubW96SGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ21vekhpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW96dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRvY3VtZW50Lm1zSGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ21zSGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtc3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkb2N1bWVudC53ZWJraXRIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnd2Via2l0SGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd3ZWJraXR2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGJpbmQgdGljayBmdW5jdGlvbiB0byBjdXJyZW50IHNjb3BlXG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZSAqL1xuICAgICAgICB0aGlzLnRpY2sgPSBtYWtlVGljayh0aGlzKTsgLy8gQ2lyY3VsYXIgbGludGluZyBpc3N1ZSBhcyBtYWtlVGljayBhbmQgQXBwbGljYXRpb24gcmVmZXJlbmNlIGVhY2ggb3RoZXJcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbmFtZSBhcHBcbiAgICAgKiBAdHlwZSB7QXBwQmFzZXx1bmRlZmluZWR9XG4gICAgICogQGRlc2NyaXB0aW9uIEdldHMgdGhlIGN1cnJlbnQgYXBwbGljYXRpb24sIGlmIGFueS5cbiAgICAgKi9cblxuICAgIHN0YXRpYyBfYXBwbGljYXRpb25zID0ge307XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGN1cnJlbnQgYXBwbGljYXRpb24uIEluIHRoZSBjYXNlIHdoZXJlIHRoZXJlIGFyZSBtdWx0aXBsZSBydW5uaW5nIGFwcGxpY2F0aW9ucywgdGhlXG4gICAgICogZnVuY3Rpb24gY2FuIGdldCBhbiBhcHBsaWNhdGlvbiBiYXNlZCBvbiBhIHN1cHBsaWVkIGNhbnZhcyBpZC4gVGhpcyBmdW5jdGlvbiBpcyBwYXJ0aWN1bGFybHlcbiAgICAgKiB1c2VmdWwgd2hlbiB0aGUgY3VycmVudCBBcHBsaWNhdGlvbiBpcyBub3QgcmVhZGlseSBhdmFpbGFibGUuIEZvciBleGFtcGxlLCBpbiB0aGUgSmF2YVNjcmlwdFxuICAgICAqIGNvbnNvbGUgb2YgdGhlIGJyb3dzZXIncyBkZXZlbG9wZXIgdG9vbHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2lkXSAtIElmIGRlZmluZWQsIHRoZSByZXR1cm5lZCBhcHBsaWNhdGlvbiBzaG91bGQgdXNlIHRoZSBjYW52YXMgd2hpY2ggaGFzXG4gICAgICogdGhpcyBpZC4gT3RoZXJ3aXNlIGN1cnJlbnQgYXBwbGljYXRpb24gd2lsbCBiZSByZXR1cm5lZC5cbiAgICAgKiBAcmV0dXJucyB7QXBwQmFzZXx1bmRlZmluZWR9IFRoZSBydW5uaW5nIGFwcGxpY2F0aW9uLCBpZiBhbnkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgYXBwID0gcGMuQXBwQmFzZS5nZXRBcHBsaWNhdGlvbigpO1xuICAgICAqL1xuICAgIHN0YXRpYyBnZXRBcHBsaWNhdGlvbihpZCkge1xuICAgICAgICByZXR1cm4gaWQgPyBBcHBCYXNlLl9hcHBsaWNhdGlvbnNbaWRdIDogZ2V0QXBwbGljYXRpb24oKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfaW5pdERlZmF1bHRNYXRlcmlhbCgpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuICAgICAgICBtYXRlcmlhbC5uYW1lID0gXCJEZWZhdWx0IE1hdGVyaWFsXCI7XG4gICAgICAgIG1hdGVyaWFsLnNoYWRpbmdNb2RlbCA9IFNQRUNVTEFSX0JMSU5OO1xuICAgICAgICBzZXREZWZhdWx0TWF0ZXJpYWwodGhpcy5ncmFwaGljc0RldmljZSwgbWF0ZXJpYWwpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtTb3VuZE1hbmFnZXJ9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldCBzb3VuZE1hbmFnZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zb3VuZE1hbmFnZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGFwcGxpY2F0aW9uJ3MgYmF0Y2ggbWFuYWdlci4gVGhlIGJhdGNoIG1hbmFnZXIgaXMgdXNlZCB0byBtZXJnZSBtZXNoIGluc3RhbmNlcyBpblxuICAgICAqIHRoZSBzY2VuZSwgd2hpY2ggcmVkdWNlcyB0aGUgb3ZlcmFsbCBudW1iZXIgb2YgZHJhdyBjYWxscywgdGhlcmVieSBib29zdGluZyBwZXJmb3JtYW5jZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtCYXRjaE1hbmFnZXJ9XG4gICAgICovXG4gICAgZ2V0IGJhdGNoZXIoKSB7XG4gICAgICAgIERlYnVnLmFzc2VydCh0aGlzLl9iYXRjaGVyLCBcIkJhdGNoTWFuYWdlciBoYXMgbm90IGJlZW4gY3JlYXRlZCBhbmQgaXMgcmVxdWlyZWQgZm9yIGNvcnJlY3QgZnVuY3Rpb25hbGl0eS5cIik7XG4gICAgICAgIHJldHVybiB0aGlzLl9iYXRjaGVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IGZpbGwgbW9kZSBvZiB0aGUgY2FudmFzLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9OT05FfTogdGhlIGNhbnZhcyB3aWxsIGFsd2F5cyBtYXRjaCB0aGUgc2l6ZSBwcm92aWRlZC5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9GSUxMX1dJTkRPV306IHRoZSBjYW52YXMgd2lsbCBzaW1wbHkgZmlsbCB0aGUgd2luZG93LCBjaGFuZ2luZyBhc3BlY3QgcmF0aW8uXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfS0VFUF9BU1BFQ1R9OiB0aGUgY2FudmFzIHdpbGwgZ3JvdyB0byBmaWxsIHRoZSB3aW5kb3cgYXMgYmVzdCBpdCBjYW4gd2hpbGVcbiAgICAgKiBtYWludGFpbmluZyB0aGUgYXNwZWN0IHJhdGlvLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBnZXQgZmlsbE1vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9maWxsTW9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCByZXNvbHV0aW9uIG1vZGUgb2YgdGhlIGNhbnZhcywgQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUkVTT0xVVElPTl9BVVRPfTogaWYgd2lkdGggYW5kIGhlaWdodCBhcmUgbm90IHByb3ZpZGVkLCBjYW52YXMgd2lsbCBiZSByZXNpemVkIHRvXG4gICAgICogbWF0Y2ggY2FudmFzIGNsaWVudCBzaXplLlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fRklYRUR9OiByZXNvbHV0aW9uIG9mIGNhbnZhcyB3aWxsIGJlIGZpeGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBnZXQgcmVzb2x1dGlvbk1vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZXNvbHV0aW9uTW9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkIHRoZSBhcHBsaWNhdGlvbiBjb25maWd1cmF0aW9uIGZpbGUgYW5kIGFwcGx5IGFwcGxpY2F0aW9uIHByb3BlcnRpZXMgYW5kIGZpbGwgdGhlIGFzc2V0XG4gICAgICogcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdXJsIC0gVGhlIFVSTCBvZiB0aGUgY29uZmlndXJhdGlvbiBmaWxlIHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtDb25maWd1cmVBcHBDYWxsYmFja30gY2FsbGJhY2sgLSBUaGUgRnVuY3Rpb24gY2FsbGVkIHdoZW4gdGhlIGNvbmZpZ3VyYXRpb24gZmlsZSBpc1xuICAgICAqIGxvYWRlZCBhbmQgcGFyc2VkIChvciBhbiBlcnJvciBvY2N1cnMpLlxuICAgICAqL1xuICAgIGNvbmZpZ3VyZSh1cmwsIGNhbGxiYWNrKSB7XG4gICAgICAgIGh0dHAuZ2V0KHVybCwgKGVyciwgcmVzcG9uc2UpID0+IHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcHJvcHMgPSByZXNwb25zZS5hcHBsaWNhdGlvbl9wcm9wZXJ0aWVzO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmVzID0gcmVzcG9uc2Uuc2NlbmVzO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gcmVzcG9uc2UuYXNzZXRzO1xuXG4gICAgICAgICAgICB0aGlzLl9wYXJzZUFwcGxpY2F0aW9uUHJvcGVydGllcyhwcm9wcywgKGVycikgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlU2NlbmVzKHNjZW5lcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VBc3NldHMoYXNzZXRzKTtcbiAgICAgICAgICAgICAgICBpZiAoIWVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkIGFsbCBhc3NldHMgaW4gdGhlIGFzc2V0IHJlZ2lzdHJ5IHRoYXQgYXJlIG1hcmtlZCBhcyAncHJlbG9hZCcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ByZWxvYWRBcHBDYWxsYmFja30gY2FsbGJhY2sgLSBGdW5jdGlvbiBjYWxsZWQgd2hlbiBhbGwgYXNzZXRzIGFyZSBsb2FkZWQuXG4gICAgICovXG4gICAgcHJlbG9hZChjYWxsYmFjaykge1xuICAgICAgICB0aGlzLmZpcmUoXCJwcmVsb2FkOnN0YXJ0XCIpO1xuXG4gICAgICAgIC8vIGdldCBsaXN0IG9mIGFzc2V0cyB0byBwcmVsb2FkXG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuYXNzZXRzLmxpc3Qoe1xuICAgICAgICAgICAgcHJlbG9hZDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBwcm9ncmVzcyA9IG5ldyBQcm9ncmVzcyhhc3NldHMubGVuZ3RoKTtcblxuICAgICAgICBsZXQgX2RvbmUgPSBmYWxzZTtcblxuICAgICAgICAvLyBjaGVjayBpZiBhbGwgbG9hZGluZyBpcyBkb25lXG4gICAgICAgIGNvbnN0IGRvbmUgPSAoKSA9PiB7XG4gICAgICAgICAgICAvLyBkbyBub3QgcHJvY2VlZCBpZiBhcHBsaWNhdGlvbiBkZXN0cm95ZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5ncmFwaGljc0RldmljZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFfZG9uZSAmJiBwcm9ncmVzcy5kb25lKCkpIHtcbiAgICAgICAgICAgICAgICBfZG9uZSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKFwicHJlbG9hZDplbmRcIik7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICAvLyB0b3RhbHMgbG9hZGluZyBwcm9ncmVzcyBvZiBhc3NldHNcbiAgICAgICAgY29uc3QgdG90YWwgPSBhc3NldHMubGVuZ3RoO1xuXG4gICAgICAgIGlmIChwcm9ncmVzcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IG9uQXNzZXRMb2FkID0gKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdwcmVsb2FkOnByb2dyZXNzJywgcHJvZ3Jlc3MuY291bnQgLyB0b3RhbCk7XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MuZG9uZSgpKVxuICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCBvbkFzc2V0RXJyb3IgPSAoZXJyLCBhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2dyZXNzLmluYygpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgncHJlbG9hZDpwcm9ncmVzcycsIHByb2dyZXNzLmNvdW50IC8gdG90YWwpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSlcbiAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gZm9yIGVhY2ggYXNzZXRcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXNzZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldHNbaV0ubG9hZGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0c1tpXS5vbmNlKCdsb2FkJywgb25Bc3NldExvYWQpO1xuICAgICAgICAgICAgICAgICAgICBhc3NldHNbaV0ub25jZSgnZXJyb3InLCBvbkFzc2V0RXJyb3IpO1xuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLmxvYWQoYXNzZXRzW2ldKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maXJlKFwicHJlbG9hZDpwcm9ncmVzc1wiLCBwcm9ncmVzcy5jb3VudCAvIHRvdGFsKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MuZG9uZSgpKVxuICAgICAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9wcmVsb2FkU2NyaXB0cyhzY2VuZURhdGEsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghc2NyaXB0LmxlZ2FjeSkge1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IHRydWU7XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0cyA9IHRoaXMuX2dldFNjcmlwdFJlZmVyZW5jZXMoc2NlbmVEYXRhKTtcblxuICAgICAgICBjb25zdCBsID0gc2NyaXB0cy5sZW5ndGg7XG4gICAgICAgIGNvbnN0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKGwpO1xuICAgICAgICBjb25zdCByZWdleCA9IC9eaHR0cChzKT86XFwvXFwvLztcblxuICAgICAgICBpZiAobCkge1xuICAgICAgICAgICAgY29uc3Qgb25Mb2FkID0gKGVyciwgU2NyaXB0VHlwZSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChlcnIpXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcblxuICAgICAgICAgICAgICAgIHByb2dyZXNzLmluYygpO1xuICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsZXQgc2NyaXB0VXJsID0gc2NyaXB0c1tpXTtcbiAgICAgICAgICAgICAgICAvLyBzdXBwb3J0IGFic29sdXRlIFVSTHMgKGZvciBub3cpXG4gICAgICAgICAgICAgICAgaWYgKCFyZWdleC50ZXN0KHNjcmlwdFVybC50b0xvd2VyQ2FzZSgpKSAmJiB0aGlzLl9zY3JpcHRQcmVmaXgpXG4gICAgICAgICAgICAgICAgICAgIHNjcmlwdFVybCA9IHBhdGguam9pbih0aGlzLl9zY3JpcHRQcmVmaXgsIHNjcmlwdHNbaV0pO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkZXIubG9hZChzY3JpcHRVcmwsICdzY3JpcHQnLCBvbkxvYWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gZmFsc2U7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2V0IGFwcGxpY2F0aW9uIHByb3BlcnRpZXMgZnJvbSBkYXRhIGZpbGVcbiAgICBfcGFyc2VBcHBsaWNhdGlvblByb3BlcnRpZXMocHJvcHMsIGNhbGxiYWNrKSB7XG4gICAgICAgIC8vIGNvbmZpZ3VyZSByZXRyeWluZyBhc3NldHNcbiAgICAgICAgaWYgKHR5cGVvZiBwcm9wcy5tYXhBc3NldFJldHJpZXMgPT09ICdudW1iZXInICYmIHByb3BzLm1heEFzc2V0UmV0cmllcyA+IDApIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVyLmVuYWJsZVJldHJ5KHByb3BzLm1heEFzc2V0UmV0cmllcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUT0RPOiByZW1vdmUgdGhpcyB0ZW1wb3JhcnkgYmxvY2sgYWZ0ZXIgbWlncmF0aW5nIHByb3BlcnRpZXNcbiAgICAgICAgaWYgKCFwcm9wcy51c2VEZXZpY2VQaXhlbFJhdGlvKVxuICAgICAgICAgICAgcHJvcHMudXNlRGV2aWNlUGl4ZWxSYXRpbyA9IHByb3BzLnVzZV9kZXZpY2VfcGl4ZWxfcmF0aW87XG4gICAgICAgIGlmICghcHJvcHMucmVzb2x1dGlvbk1vZGUpXG4gICAgICAgICAgICBwcm9wcy5yZXNvbHV0aW9uTW9kZSA9IHByb3BzLnJlc29sdXRpb25fbW9kZTtcbiAgICAgICAgaWYgKCFwcm9wcy5maWxsTW9kZSlcbiAgICAgICAgICAgIHByb3BzLmZpbGxNb2RlID0gcHJvcHMuZmlsbF9tb2RlO1xuXG4gICAgICAgIHRoaXMuX3dpZHRoID0gcHJvcHMud2lkdGg7XG4gICAgICAgIHRoaXMuX2hlaWdodCA9IHByb3BzLmhlaWdodDtcbiAgICAgICAgaWYgKHByb3BzLnVzZURldmljZVBpeGVsUmF0aW8pIHtcbiAgICAgICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UubWF4UGl4ZWxSYXRpbyA9IHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXRDYW52YXNSZXNvbHV0aW9uKHByb3BzLnJlc29sdXRpb25Nb2RlLCB0aGlzLl93aWR0aCwgdGhpcy5faGVpZ2h0KTtcbiAgICAgICAgdGhpcy5zZXRDYW52YXNGaWxsTW9kZShwcm9wcy5maWxsTW9kZSwgdGhpcy5fd2lkdGgsIHRoaXMuX2hlaWdodCk7XG5cbiAgICAgICAgLy8gc2V0IHVwIGxheWVyc1xuICAgICAgICBpZiAocHJvcHMubGF5ZXJzICYmIHByb3BzLmxheWVyT3JkZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvc2l0aW9uID0gbmV3IExheWVyQ29tcG9zaXRpb24oXCJhcHBsaWNhdGlvblwiKTtcblxuICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0ge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBwcm9wcy5sYXllcnMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gcHJvcHMubGF5ZXJzW2tleV07XG4gICAgICAgICAgICAgICAgZGF0YS5pZCA9IHBhcnNlSW50KGtleSwgMTApO1xuICAgICAgICAgICAgICAgIC8vIGRlcHRoIGxheWVyIHNob3VsZCBvbmx5IGJlIGVuYWJsZWQgd2hlbiBuZWVkZWRcbiAgICAgICAgICAgICAgICAvLyBieSBpbmNyZW1lbnRpbmcgaXRzIHJlZiBjb3VudGVyXG4gICAgICAgICAgICAgICAgZGF0YS5lbmFibGVkID0gZGF0YS5pZCAhPT0gTEFZRVJJRF9ERVBUSDtcbiAgICAgICAgICAgICAgICBsYXllcnNba2V5XSA9IG5ldyBMYXllcihkYXRhKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHByb3BzLmxheWVyT3JkZXIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWJsYXllciA9IHByb3BzLmxheWVyT3JkZXJbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnNbc3VibGF5ZXIubGF5ZXJdO1xuICAgICAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKHN1YmxheWVyLnRyYW5zcGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudChsYXllcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9zaXRpb24ucHVzaE9wYXF1ZShsYXllcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29tcG9zaXRpb24uc3ViTGF5ZXJFbmFibGVkW2ldID0gc3VibGF5ZXIuZW5hYmxlZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMgPSBjb21wb3NpdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkZCBiYXRjaCBncm91cHNcbiAgICAgICAgaWYgKHByb3BzLmJhdGNoR3JvdXBzKSB7XG4gICAgICAgICAgICBjb25zdCBiYXRjaGVyID0gdGhpcy5iYXRjaGVyO1xuICAgICAgICAgICAgaWYgKGJhdGNoZXIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcHJvcHMuYmF0Y2hHcm91cHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ3JwID0gcHJvcHMuYmF0Y2hHcm91cHNbaV07XG4gICAgICAgICAgICAgICAgICAgIGJhdGNoZXIuYWRkR3JvdXAoZ3JwLm5hbWUsIGdycC5keW5hbWljLCBncnAubWF4QWFiYlNpemUsIGdycC5pZCwgZ3JwLmxheWVycyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IGxvY2FsaXphdGlvbiBhc3NldHNcbiAgICAgICAgaWYgKHByb3BzLmkxOG5Bc3NldHMpIHtcbiAgICAgICAgICAgIHRoaXMuaTE4bi5hc3NldHMgPSBwcm9wcy5pMThuQXNzZXRzO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbG9hZExpYnJhcmllcyhwcm9wcy5saWJyYXJpZXMsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSB1cmxzIC0gTGlzdCBvZiBVUkxzIHRvIGxvYWQuXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBDYWxsYmFjayBmdW5jdGlvbi5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9sb2FkTGlicmFyaWVzKHVybHMsIGNhbGxiYWNrKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IHVybHMubGVuZ3RoO1xuICAgICAgICBsZXQgY291bnQgPSBsZW47XG5cbiAgICAgICAgY29uc3QgcmVnZXggPSAvXmh0dHAocyk/OlxcL1xcLy87XG5cbiAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgY29uc3Qgb25Mb2FkID0gKGVyciwgc2NyaXB0KSA9PiB7XG4gICAgICAgICAgICAgICAgY291bnQtLTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uTGlicmFyaWVzTG9hZGVkKCk7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgICAgICAgICAgICBsZXQgdXJsID0gdXJsc1tpXTtcblxuICAgICAgICAgICAgICAgIGlmICghcmVnZXgudGVzdCh1cmwudG9Mb3dlckNhc2UoKSkgJiYgdGhpcy5fc2NyaXB0UHJlZml4KVxuICAgICAgICAgICAgICAgICAgICB1cmwgPSBwYXRoLmpvaW4odGhpcy5fc2NyaXB0UHJlZml4LCB1cmwpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5sb2FkZXIubG9hZCh1cmwsICdzY3JpcHQnLCBvbkxvYWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5vbkxpYnJhcmllc0xvYWRlZCgpO1xuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgc2NlbmUgbmFtZS91cmxzIGludG8gdGhlIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSBzY2VuZXMgLSBTY2VuZXMgdG8gYWRkIHRvIHRoZSBzY2VuZSByZWdpc3RyeS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVNjZW5lcyhzY2VuZXMpIHtcbiAgICAgICAgaWYgKCFzY2VuZXMpIHJldHVybjtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjZW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5zY2VuZXMuYWRkKHNjZW5lc1tpXS5uYW1lLCBzY2VuZXNbaV0udXJsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydCBhc3NldHMgaW50byByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gYXNzZXRzIC0gQXNzZXRzIHRvIGluc2VydC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZUFzc2V0cyhhc3NldHMpIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IFtdO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdHNJbmRleCA9IHt9O1xuICAgICAgICBjb25zdCBidW5kbGVzSW5kZXggPSB7fTtcblxuICAgICAgICBpZiAoIXNjcmlwdC5sZWdhY3kpIHtcbiAgICAgICAgICAgIC8vIGFkZCBzY3JpcHRzIGluIG9yZGVyIG9mIGxvYWRpbmcgZmlyc3RcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zY3JpcHRzT3JkZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpZCA9IHRoaXMuc2NyaXB0c09yZGVyW2ldO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXRzW2lkXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBzY3JpcHRzSW5kZXhbaWRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRoZW4gYWRkIGJ1bmRsZXNcbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZUJ1bmRsZXMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRzW2lkXS50eXBlID09PSAnYnVuZGxlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVuZGxlc0luZGV4W2lkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRoZW4gYWRkIHJlc3Qgb2YgYXNzZXRzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgIGlmIChzY3JpcHRzSW5kZXhbaWRdIHx8IGJ1bmRsZXNJbmRleFtpZF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlQnVuZGxlcykge1xuICAgICAgICAgICAgICAgIC8vIGFkZCBidW5kbGVzXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0c1tpZF0udHlwZSA9PT0gJ2J1bmRsZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1bmRsZXNJbmRleFtpZF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0aGVuIGFkZCByZXN0IG9mIGFzc2V0c1xuICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoYnVuZGxlc0luZGV4W2lkXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBsaXN0W2ldO1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBuZXcgQXNzZXQoZGF0YS5uYW1lLCBkYXRhLnR5cGUsIGRhdGEuZmlsZSwgZGF0YS5kYXRhKTtcbiAgICAgICAgICAgIGFzc2V0LmlkID0gcGFyc2VJbnQoZGF0YS5pZCwgMTApO1xuICAgICAgICAgICAgYXNzZXQucHJlbG9hZCA9IGRhdGEucHJlbG9hZCA/IGRhdGEucHJlbG9hZCA6IGZhbHNlO1xuICAgICAgICAgICAgLy8gaWYgdGhpcyBpcyBhIHNjcmlwdCBhc3NldCBhbmQgaGFzIGFscmVhZHkgYmVlbiBlbWJlZGRlZCBpbiB0aGUgcGFnZSB0aGVuXG4gICAgICAgICAgICAvLyBtYXJrIGl0IGFzIGxvYWRlZFxuICAgICAgICAgICAgYXNzZXQubG9hZGVkID0gZGF0YS50eXBlID09PSAnc2NyaXB0JyAmJiBkYXRhLmRhdGEgJiYgZGF0YS5kYXRhLmxvYWRpbmdUeXBlID4gMDtcbiAgICAgICAgICAgIC8vIHRhZ3NcbiAgICAgICAgICAgIGFzc2V0LnRhZ3MuYWRkKGRhdGEudGFncyk7XG4gICAgICAgICAgICAvLyBpMThuXG4gICAgICAgICAgICBpZiAoZGF0YS5pMThuKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBsb2NhbGUgaW4gZGF0YS5pMThuKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0LmFkZExvY2FsaXplZEFzc2V0SWQobG9jYWxlLCBkYXRhLmkxOG5bbG9jYWxlXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gcmVnaXN0cnlcbiAgICAgICAgICAgIHRoaXMuYXNzZXRzLmFkZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1NjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZS5cbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IC0gVGhlIGxpc3Qgb2Ygc2NyaXB0cyB0aGF0IGFyZSByZWZlcmVuY2VkIGJ5IHRoZSBzY2VuZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRTY3JpcHRSZWZlcmVuY2VzKHNjZW5lKSB7XG4gICAgICAgIGxldCBwcmlvcml0eVNjcmlwdHMgPSBbXTtcbiAgICAgICAgaWYgKHNjZW5lLnNldHRpbmdzLnByaW9yaXR5X3NjcmlwdHMpIHtcbiAgICAgICAgICAgIHByaW9yaXR5U2NyaXB0cyA9IHNjZW5lLnNldHRpbmdzLnByaW9yaXR5X3NjcmlwdHM7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBfc2NyaXB0cyA9IFtdO1xuICAgICAgICBjb25zdCBfaW5kZXggPSB7fTtcblxuICAgICAgICAvLyBmaXJzdCBhZGQgcHJpb3JpdHkgc2NyaXB0c1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByaW9yaXR5U2NyaXB0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgX3NjcmlwdHMucHVzaChwcmlvcml0eVNjcmlwdHNbaV0pO1xuICAgICAgICAgICAgX2luZGV4W3ByaW9yaXR5U2NyaXB0c1tpXV0gPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdGhlbiBpdGVyYXRlIGhpZXJhcmNoeSB0byBnZXQgcmVmZXJlbmNlZCBzY3JpcHRzXG4gICAgICAgIGNvbnN0IGVudGl0aWVzID0gc2NlbmUuZW50aXRpZXM7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGVudGl0aWVzKSB7XG4gICAgICAgICAgICBpZiAoIWVudGl0aWVzW2tleV0uY29tcG9uZW50cy5zY3JpcHQpIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc2NyaXB0cyA9IGVudGl0aWVzW2tleV0uY29tcG9uZW50cy5zY3JpcHQuc2NyaXB0cztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NyaXB0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChfaW5kZXhbc2NyaXB0c1tpXS51cmxdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBfc2NyaXB0cy5wdXNoKHNjcmlwdHNbaV0udXJsKTtcbiAgICAgICAgICAgICAgICBfaW5kZXhbc2NyaXB0c1tpXS51cmxdID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBfc2NyaXB0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdGFydCB0aGUgYXBwbGljYXRpb24uIFRoaXMgZnVuY3Rpb24gZG9lcyB0aGUgZm9sbG93aW5nOlxuICAgICAqXG4gICAgICogMS4gRmlyZXMgYW4gZXZlbnQgb24gdGhlIGFwcGxpY2F0aW9uIG5hbWVkICdzdGFydCdcbiAgICAgKiAyLiBDYWxscyBpbml0aWFsaXplIGZvciBhbGwgY29tcG9uZW50cyBvbiBlbnRpdGllcyBpbiB0aGUgaGllcmFyY2h5XG4gICAgICogMy4gRmlyZXMgYW4gZXZlbnQgb24gdGhlIGFwcGxpY2F0aW9uIG5hbWVkICdpbml0aWFsaXplJ1xuICAgICAqIDQuIENhbGxzIHBvc3RJbml0aWFsaXplIGZvciBhbGwgY29tcG9uZW50cyBvbiBlbnRpdGllcyBpbiB0aGUgaGllcmFyY2h5XG4gICAgICogNS4gRmlyZXMgYW4gZXZlbnQgb24gdGhlIGFwcGxpY2F0aW9uIG5hbWVkICdwb3N0aW5pdGlhbGl6ZSdcbiAgICAgKiA2LiBTdGFydHMgZXhlY3V0aW5nIHRoZSBtYWluIGxvb3Agb2YgdGhlIGFwcGxpY2F0aW9uXG4gICAgICpcbiAgICAgKiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBpbnRlcm5hbGx5IGJ5IFBsYXlDYW52YXMgYXBwbGljYXRpb25zIG1hZGUgaW4gdGhlIEVkaXRvciBidXQgeW91XG4gICAgICogd2lsbCBuZWVkIHRvIGNhbGwgc3RhcnQgeW91cnNlbGYgaWYgeW91IGFyZSB1c2luZyB0aGUgZW5naW5lIHN0YW5kLWFsb25lLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuc3RhcnQoKTtcbiAgICAgKi9cbiAgICBzdGFydCgpIHtcbiAgICAgICAgdGhpcy5mcmFtZSA9IDA7XG5cbiAgICAgICAgdGhpcy5maXJlKFwic3RhcnRcIiwge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBub3coKSxcbiAgICAgICAgICAgIHRhcmdldDogdGhpc1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXRoaXMuX2xpYnJhcmllc0xvYWRlZCkge1xuICAgICAgICAgICAgdGhpcy5vbkxpYnJhcmllc0xvYWRlZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ2luaXRpYWxpemUnLCB0aGlzLnJvb3QpO1xuICAgICAgICB0aGlzLmZpcmUoJ2luaXRpYWxpemUnKTtcblxuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgncG9zdEluaXRpYWxpemUnLCB0aGlzLnJvb3QpO1xuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgncG9zdFBvc3RJbml0aWFsaXplJywgdGhpcy5yb290KTtcbiAgICAgICAgdGhpcy5maXJlKCdwb3N0aW5pdGlhbGl6ZScpO1xuXG4gICAgICAgIHRoaXMudGljaygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBhbGwgaW5wdXQgZGV2aWNlcyBtYW5hZ2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgaW5wdXRVcGRhdGUoZHQpIHtcbiAgICAgICAgaWYgKHRoaXMuY29udHJvbGxlcikge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLnVwZGF0ZShkdCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMubW91c2UpIHtcbiAgICAgICAgICAgIHRoaXMubW91c2UudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMua2V5Ym9hcmQpIHtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZ2FtZXBhZHMpIHtcbiAgICAgICAgICAgIHRoaXMuZ2FtZXBhZHMudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIGFwcGxpY2F0aW9uLiBUaGlzIGZ1bmN0aW9uIHdpbGwgY2FsbCB0aGUgdXBkYXRlIGZ1bmN0aW9ucyBhbmQgdGhlbiB0aGUgcG9zdFVwZGF0ZVxuICAgICAqIGZ1bmN0aW9ucyBvZiBhbGwgZW5hYmxlZCBjb21wb25lbnRzLiBJdCB3aWxsIHRoZW4gdXBkYXRlIHRoZSBjdXJyZW50IHN0YXRlIG9mIGFsbCBjb25uZWN0ZWRcbiAgICAgKiBpbnB1dCBkZXZpY2VzLiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBpbnRlcm5hbGx5IGluIHRoZSBhcHBsaWNhdGlvbidzIG1haW4gbG9vcCBhbmQgZG9lc1xuICAgICAqIG5vdCBuZWVkIHRvIGJlIGNhbGxlZCBleHBsaWNpdGx5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIHRpbWUgZGVsdGEgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS5cbiAgICAgKi9cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgdGhpcy5mcmFtZSsrO1xuXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UudXBkYXRlQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS51cGRhdGVTdGFydCA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBQZXJmb3JtIENvbXBvbmVudFN5c3RlbSB1cGRhdGVcbiAgICAgICAgaWYgKHNjcmlwdC5sZWdhY3kpXG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgnZml4ZWRVcGRhdGUnLCAxLjAgLyA2MC4wKTtcblxuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSh0aGlzLl9pblRvb2xzID8gJ3Rvb2xzVXBkYXRlJyA6ICd1cGRhdGUnLCBkdCk7XG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdhbmltYXRpb25VcGRhdGUnLCBkdCk7XG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdwb3N0VXBkYXRlJywgZHQpO1xuXG4gICAgICAgIC8vIGZpcmUgdXBkYXRlIGV2ZW50XG4gICAgICAgIHRoaXMuZmlyZShcInVwZGF0ZVwiLCBkdCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGlucHV0IGRldmljZXNcbiAgICAgICAgdGhpcy5pbnB1dFVwZGF0ZShkdCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnVwZGF0ZVRpbWUgPSBub3coKSAtIHRoaXMuc3RhdHMuZnJhbWUudXBkYXRlU3RhcnQ7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlciB0aGUgYXBwbGljYXRpb24ncyBzY2VuZS4gTW9yZSBzcGVjaWZpY2FsbHksIHRoZSBzY2VuZSdzIHtAbGluayBMYXllckNvbXBvc2l0aW9ufSBpc1xuICAgICAqIHJlbmRlcmVkLiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBpbnRlcm5hbGx5IGluIHRoZSBhcHBsaWNhdGlvbidzIG1haW4gbG9vcCBhbmQgZG9lcyBub3RcbiAgICAgKiBuZWVkIHRvIGJlIGNhbGxlZCBleHBsaWNpdGx5LlxuICAgICAqL1xuICAgIHJlbmRlcigpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnJlbmRlclN0YXJ0ID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuZmlyZSgncHJlcmVuZGVyJyk7XG4gICAgICAgIHRoaXMucm9vdC5zeW5jSGllcmFyY2h5KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIudXBkYXRlQWxsKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIEZvcndhcmRSZW5kZXJlci5fc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyByZW5kZXIgdGhlIHNjZW5lIGNvbXBvc2l0aW9uXG4gICAgICAgIHRoaXMucmVuZGVyQ29tcG9zaXRpb24odGhpcy5zY2VuZS5sYXllcnMpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgncG9zdHJlbmRlcicpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS5yZW5kZXJUaW1lID0gbm93KCkgLSB0aGlzLnN0YXRzLmZyYW1lLnJlbmRlclN0YXJ0O1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvLyByZW5kZXIgYSBsYXllciBjb21wb3NpdGlvblxuICAgIHJlbmRlckNvbXBvc2l0aW9uKGxheWVyQ29tcG9zaXRpb24pIHtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5idWlsZEZyYW1lR3JhcGgodGhpcy5mcmFtZUdyYXBoLCBsYXllckNvbXBvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5mcmFtZUdyYXBoLnJlbmRlcigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBub3cgLSBUaGUgdGltZXN0YW1wIHBhc3NlZCB0byB0aGUgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGRlbHRhIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuIFRoaXMgaXMgc3ViamVjdCB0byB0aGVcbiAgICAgKiBhcHBsaWNhdGlvbidzIHRpbWUgc2NhbGUgYW5kIG1heCBkZWx0YSB2YWx1ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG1zIC0gVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2ZpbGxGcmFtZVN0YXRzQmFzaWMobm93LCBkdCwgbXMpIHtcbiAgICAgICAgLy8gVGltaW5nIHN0YXRzXG4gICAgICAgIGNvbnN0IHN0YXRzID0gdGhpcy5zdGF0cy5mcmFtZTtcbiAgICAgICAgc3RhdHMuZHQgPSBkdDtcbiAgICAgICAgc3RhdHMubXMgPSBtcztcbiAgICAgICAgaWYgKG5vdyA+IHN0YXRzLl90aW1lVG9Db3VudEZyYW1lcykge1xuICAgICAgICAgICAgc3RhdHMuZnBzID0gc3RhdHMuX2Zwc0FjY3VtO1xuICAgICAgICAgICAgc3RhdHMuX2Zwc0FjY3VtID0gMDtcbiAgICAgICAgICAgIHN0YXRzLl90aW1lVG9Db3VudEZyYW1lcyA9IG5vdyArIDEwMDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0cy5fZnBzQWNjdW0rKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRvdGFsIGRyYXcgY2FsbFxuICAgICAgICB0aGlzLnN0YXRzLmRyYXdDYWxscy50b3RhbCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuX2RyYXdDYWxsc1BlckZyYW1lO1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLl9kcmF3Q2FsbHNQZXJGcmFtZSA9IDA7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZpbGxGcmFtZVN0YXRzKCkge1xuICAgICAgICBsZXQgc3RhdHMgPSB0aGlzLnN0YXRzLmZyYW1lO1xuXG4gICAgICAgIC8vIFJlbmRlciBzdGF0c1xuICAgICAgICBzdGF0cy5jYW1lcmFzID0gdGhpcy5yZW5kZXJlci5fY2FtZXJhc1JlbmRlcmVkO1xuICAgICAgICBzdGF0cy5tYXRlcmlhbHMgPSB0aGlzLnJlbmRlcmVyLl9tYXRlcmlhbFN3aXRjaGVzO1xuICAgICAgICBzdGF0cy5zaGFkZXJzID0gdGhpcy5ncmFwaGljc0RldmljZS5fc2hhZGVyU3dpdGNoZXNQZXJGcmFtZTtcbiAgICAgICAgc3RhdHMuc2hhZG93TWFwVXBkYXRlcyA9IHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFVwZGF0ZXM7XG4gICAgICAgIHN0YXRzLnNoYWRvd01hcFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lO1xuICAgICAgICBzdGF0cy5kZXB0aE1hcFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9kZXB0aE1hcFRpbWU7XG4gICAgICAgIHN0YXRzLmZvcndhcmRUaW1lID0gdGhpcy5yZW5kZXJlci5fZm9yd2FyZFRpbWU7XG4gICAgICAgIGNvbnN0IHByaW1zID0gdGhpcy5ncmFwaGljc0RldmljZS5fcHJpbXNQZXJGcmFtZTtcbiAgICAgICAgc3RhdHMudHJpYW5nbGVzID0gcHJpbXNbUFJJTUlUSVZFX1RSSUFOR0xFU10gLyAzICtcbiAgICAgICAgICAgIE1hdGgubWF4KHByaW1zW1BSSU1JVElWRV9UUklTVFJJUF0gLSAyLCAwKSArXG4gICAgICAgICAgICBNYXRoLm1heChwcmltc1tQUklNSVRJVkVfVFJJRkFOXSAtIDIsIDApO1xuICAgICAgICBzdGF0cy5jdWxsVGltZSA9IHRoaXMucmVuZGVyZXIuX2N1bGxUaW1lO1xuICAgICAgICBzdGF0cy5zb3J0VGltZSA9IHRoaXMucmVuZGVyZXIuX3NvcnRUaW1lO1xuICAgICAgICBzdGF0cy5za2luVGltZSA9IHRoaXMucmVuZGVyZXIuX3NraW5UaW1lO1xuICAgICAgICBzdGF0cy5tb3JwaFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9tb3JwaFRpbWU7XG4gICAgICAgIHN0YXRzLmxpZ2h0Q2x1c3RlcnMgPSB0aGlzLnJlbmRlcmVyLl9saWdodENsdXN0ZXJzO1xuICAgICAgICBzdGF0cy5saWdodENsdXN0ZXJzVGltZSA9IHRoaXMucmVuZGVyZXIuX2xpZ2h0Q2x1c3RlcnNUaW1lO1xuICAgICAgICBzdGF0cy5vdGhlclByaW1pdGl2ZXMgPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByaW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaSA8IFBSSU1JVElWRV9UUklBTkdMRVMpIHtcbiAgICAgICAgICAgICAgICBzdGF0cy5vdGhlclByaW1pdGl2ZXMgKz0gcHJpbXNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcmltc1tpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZW5kZXJlci5fY2FtZXJhc1JlbmRlcmVkID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbWF0ZXJpYWxTd2l0Y2hlcyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFVwZGF0ZXMgPSAwO1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fY3VsbFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2xpZ2h0Q2x1c3RlcnNUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc29ydFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9za2luVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX21vcnBoVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9kZXB0aE1hcFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZSA9IDA7XG5cbiAgICAgICAgLy8gRHJhdyBjYWxsIHN0YXRzXG4gICAgICAgIHN0YXRzID0gdGhpcy5zdGF0cy5kcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLmZvcndhcmQgPSB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkRHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5jdWxsZWQgPSB0aGlzLnJlbmRlcmVyLl9udW1EcmF3Q2FsbHNDdWxsZWQ7XG4gICAgICAgIHN0YXRzLmRlcHRoID0gMDtcbiAgICAgICAgc3RhdHMuc2hhZG93ID0gdGhpcy5yZW5kZXJlci5fc2hhZG93RHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5za2lubmVkID0gdGhpcy5yZW5kZXJlci5fc2tpbkRyYXdDYWxscztcbiAgICAgICAgc3RhdHMuaW1tZWRpYXRlID0gMDtcbiAgICAgICAgc3RhdHMuaW5zdGFuY2VkID0gMDtcbiAgICAgICAgc3RhdHMucmVtb3ZlZEJ5SW5zdGFuY2luZyA9IDA7XG4gICAgICAgIHN0YXRzLm1pc2MgPSBzdGF0cy50b3RhbCAtIChzdGF0cy5mb3J3YXJkICsgc3RhdHMuc2hhZG93KTtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fZGVwdGhEcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dEcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbnVtRHJhd0NhbGxzQ3VsbGVkID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2tpbkRyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ltbWVkaWF0ZVJlbmRlcmVkID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5faW5zdGFuY2VkRHJhd0NhbGxzID0gMDtcblxuICAgICAgICB0aGlzLnN0YXRzLm1pc2MucmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lID0gdGhpcy5ncmFwaGljc0RldmljZS5yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWU7XG5cbiAgICAgICAgc3RhdHMgPSB0aGlzLnN0YXRzLnBhcnRpY2xlcztcbiAgICAgICAgc3RhdHMudXBkYXRlc1BlckZyYW1lID0gc3RhdHMuX3VwZGF0ZXNQZXJGcmFtZTtcbiAgICAgICAgc3RhdHMuZnJhbWVUaW1lID0gc3RhdHMuX2ZyYW1lVGltZTtcbiAgICAgICAgc3RhdHMuX3VwZGF0ZXNQZXJGcmFtZSA9IDA7XG4gICAgICAgIHN0YXRzLl9mcmFtZVRpbWUgPSAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnRyb2xzIGhvdyB0aGUgY2FudmFzIGZpbGxzIHRoZSB3aW5kb3cgYW5kIHJlc2l6ZXMgd2hlbiB0aGUgd2luZG93IGNoYW5nZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSAtIFRoZSBtb2RlIHRvIHVzZSB3aGVuIHNldHRpbmcgdGhlIHNpemUgb2YgdGhlIGNhbnZhcy4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfTk9ORX06IHRoZSBjYW52YXMgd2lsbCBhbHdheXMgbWF0Y2ggdGhlIHNpemUgcHJvdmlkZWQuXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfRklMTF9XSU5ET1d9OiB0aGUgY2FudmFzIHdpbGwgc2ltcGx5IGZpbGwgdGhlIHdpbmRvdywgY2hhbmdpbmcgYXNwZWN0IHJhdGlvLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0tFRVBfQVNQRUNUfTogdGhlIGNhbnZhcyB3aWxsIGdyb3cgdG8gZmlsbCB0aGUgd2luZG93IGFzIGJlc3QgaXQgY2FuIHdoaWxlXG4gICAgICogbWFpbnRhaW5pbmcgdGhlIGFzcGVjdCByYXRpby5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2lkdGhdIC0gVGhlIHdpZHRoIG9mIHRoZSBjYW52YXMgKG9ubHkgdXNlZCB3aGVuIG1vZGUgaXMge0BsaW5rIEZJTExNT0RFX05PTkV9KS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgaGVpZ2h0IG9mIHRoZSBjYW52YXMgKG9ubHkgdXNlZCB3aGVuIG1vZGUgaXMge0BsaW5rIEZJTExNT0RFX05PTkV9KS5cbiAgICAgKi9cbiAgICBzZXRDYW52YXNGaWxsTW9kZShtb2RlLCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuX2ZpbGxNb2RlID0gbW9kZTtcbiAgICAgICAgdGhpcy5yZXNpemVDYW52YXMod2lkdGgsIGhlaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hhbmdlIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBjYW52YXMsIGFuZCBzZXQgdGhlIHdheSBpdCBiZWhhdmVzIHdoZW4gdGhlIHdpbmRvdyBpcyByZXNpemVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgLSBUaGUgbW9kZSB0byB1c2Ugd2hlbiBzZXR0aW5nIHRoZSByZXNvbHV0aW9uLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0FVVE99OiBpZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBub3QgcHJvdmlkZWQsIGNhbnZhcyB3aWxsIGJlIHJlc2l6ZWQgdG9cbiAgICAgKiBtYXRjaCBjYW52YXMgY2xpZW50IHNpemUuXG4gICAgICogLSB7QGxpbmsgUkVTT0xVVElPTl9GSVhFRH06IHJlc29sdXRpb24gb2YgY2FudmFzIHdpbGwgYmUgZml4ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3dpZHRoXSAtIFRoZSBob3Jpem9udGFsIHJlc29sdXRpb24sIG9wdGlvbmFsIGluIEFVVE8gbW9kZSwgaWYgbm90IHByb3ZpZGVkXG4gICAgICogY2FudmFzIGNsaWVudFdpZHRoIGlzIHVzZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtoZWlnaHRdIC0gVGhlIHZlcnRpY2FsIHJlc29sdXRpb24sIG9wdGlvbmFsIGluIEFVVE8gbW9kZSwgaWYgbm90IHByb3ZpZGVkXG4gICAgICogY2FudmFzIGNsaWVudEhlaWdodCBpcyB1c2VkLlxuICAgICAqL1xuICAgIHNldENhbnZhc1Jlc29sdXRpb24obW9kZSwgd2lkdGgsIGhlaWdodCkge1xuICAgICAgICB0aGlzLl9yZXNvbHV0aW9uTW9kZSA9IG1vZGU7XG5cbiAgICAgICAgLy8gSW4gQVVUTyBtb2RlIHRoZSByZXNvbHV0aW9uIGlzIHRoZSBzYW1lIGFzIHRoZSBjYW52YXMgc2l6ZSwgdW5sZXNzIHNwZWNpZmllZFxuICAgICAgICBpZiAobW9kZSA9PT0gUkVTT0xVVElPTl9BVVRPICYmICh3aWR0aCA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgICAgICAgd2lkdGggPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5jbGllbnRXaWR0aDtcbiAgICAgICAgICAgIGhlaWdodCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLmNsaWVudEhlaWdodDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UucmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFF1ZXJpZXMgdGhlIHZpc2liaWxpdHkgb2YgdGhlIHdpbmRvdyBvciB0YWIgaW4gd2hpY2ggdGhlIGFwcGxpY2F0aW9uIGlzIHJ1bm5pbmcuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYXBwbGljYXRpb24gaXMgbm90IHZpc2libGUgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBpc0hpZGRlbigpIHtcbiAgICAgICAgcmV0dXJuIGRvY3VtZW50W3RoaXMuX2hpZGRlbkF0dHJdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSB2aXNpYmlsaXR5IHN0YXRlIG9mIHRoZSBjdXJyZW50IHRhYi93aW5kb3cgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25WaXNpYmlsaXR5Q2hhbmdlKCkge1xuICAgICAgICBpZiAodGhpcy5pc0hpZGRlbigpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc291bmRNYW5hZ2VyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc291bmRNYW5hZ2VyLnN1c3BlbmQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIucmVzdW1lKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNpemUgdGhlIGFwcGxpY2F0aW9uJ3MgY2FudmFzIGVsZW1lbnQgaW4gbGluZSB3aXRoIHRoZSBjdXJyZW50IGZpbGwgbW9kZS5cbiAgICAgKlxuICAgICAqIC0gSW4ge0BsaW5rIEZJTExNT0RFX0tFRVBfQVNQRUNUfSBtb2RlLCB0aGUgY2FudmFzIHdpbGwgZ3JvdyB0byBmaWxsIHRoZSB3aW5kb3cgYXMgYmVzdCBpdFxuICAgICAqIGNhbiB3aGlsZSBtYWludGFpbmluZyB0aGUgYXNwZWN0IHJhdGlvLlxuICAgICAqIC0gSW4ge0BsaW5rIEZJTExNT0RFX0ZJTExfV0lORE9XfSBtb2RlLCB0aGUgY2FudmFzIHdpbGwgc2ltcGx5IGZpbGwgdGhlIHdpbmRvdywgY2hhbmdpbmdcbiAgICAgKiBhc3BlY3QgcmF0aW8uXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfTk9ORX0gbW9kZSwgdGhlIGNhbnZhcyB3aWxsIGFsd2F5cyBtYXRjaCB0aGUgc2l6ZSBwcm92aWRlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2lkdGhdIC0gVGhlIHdpZHRoIG9mIHRoZSBjYW52YXMuIE9ubHkgdXNlZCBpZiBjdXJyZW50IGZpbGwgbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtoZWlnaHRdIC0gVGhlIGhlaWdodCBvZiB0aGUgY2FudmFzLiBPbmx5IHVzZWQgaWYgY3VycmVudCBmaWxsIG1vZGUgaXMge0BsaW5rIEZJTExNT0RFX05PTkV9LlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IEEgb2JqZWN0IGNvbnRhaW5pbmcgdGhlIHZhbHVlcyBjYWxjdWxhdGVkIHRvIHVzZSBhcyB3aWR0aCBhbmQgaGVpZ2h0LlxuICAgICAqL1xuICAgIHJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIGlmICghdGhpcy5fYWxsb3dSZXNpemUpIHJldHVybiB1bmRlZmluZWQ7IC8vIHByZXZlbnQgcmVzaXppbmcgKGUuZy4gaWYgcHJlc2VudGluZyBpbiBWUiBITUQpXG5cbiAgICAgICAgLy8gcHJldmVudCByZXNpemluZyB3aGVuIGluIFhSIHNlc3Npb25cbiAgICAgICAgaWYgKHRoaXMueHIgJiYgdGhpcy54ci5zZXNzaW9uKVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcblxuICAgICAgICBjb25zdCB3aW5kb3dXaWR0aCA9IHdpbmRvdy5pbm5lcldpZHRoO1xuICAgICAgICBjb25zdCB3aW5kb3dIZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX2ZpbGxNb2RlID09PSBGSUxMTU9ERV9LRUVQX0FTUEVDVCkge1xuICAgICAgICAgICAgY29uc3QgciA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLndpZHRoIC8gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuaGVpZ2h0O1xuICAgICAgICAgICAgY29uc3Qgd2luUiA9IHdpbmRvd1dpZHRoIC8gd2luZG93SGVpZ2h0O1xuXG4gICAgICAgICAgICBpZiAociA+IHdpblIpIHtcbiAgICAgICAgICAgICAgICB3aWR0aCA9IHdpbmRvd1dpZHRoO1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHdpZHRoIC8gcjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gd2luZG93SGVpZ2h0O1xuICAgICAgICAgICAgICAgIHdpZHRoID0gaGVpZ2h0ICogcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9maWxsTW9kZSA9PT0gRklMTE1PREVfRklMTF9XSU5ET1cpIHtcbiAgICAgICAgICAgIHdpZHRoID0gd2luZG93V2lkdGg7XG4gICAgICAgICAgICBoZWlnaHQgPSB3aW5kb3dIZWlnaHQ7XG4gICAgICAgIH1cbiAgICAgICAgLy8gT1RIRVJXSVNFOiBGSUxMTU9ERV9OT05FIHVzZSB3aWR0aCBhbmQgaGVpZ2h0IHRoYXQgYXJlIHByb3ZpZGVkXG5cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuc3R5bGUud2lkdGggPSB3aWR0aCArICdweCc7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLnN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG5cbiAgICAgICAgdGhpcy51cGRhdGVDYW52YXNTaXplKCk7XG5cbiAgICAgICAgLy8gcmV0dXJuIHRoZSBmaW5hbCB2YWx1ZXMgY2FsY3VsYXRlZCBmb3Igd2lkdGggYW5kIGhlaWdodFxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgd2lkdGg6IHdpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGVzIHRoZSB7QGxpbmsgR3JhcGhpY3NEZXZpY2V9IGNhbnZhcyBzaXplIHRvIG1hdGNoIHRoZSBjYW52YXMgc2l6ZSBvbiB0aGUgZG9jdW1lbnRcbiAgICAgKiBwYWdlLiBJdCBpcyByZWNvbW1lbmRlZCB0byBjYWxsIHRoaXMgZnVuY3Rpb24gd2hlbiB0aGUgY2FudmFzIHNpemUgY2hhbmdlcyAoZS5nIG9uIHdpbmRvd1xuICAgICAqIHJlc2l6ZSBhbmQgb3JpZW50YXRpb24gY2hhbmdlIGV2ZW50cykgc28gdGhhdCB0aGUgY2FudmFzIHJlc29sdXRpb24gaXMgaW1tZWRpYXRlbHkgdXBkYXRlZC5cbiAgICAgKi9cbiAgICB1cGRhdGVDYW52YXNTaXplKCkge1xuICAgICAgICAvLyBEb24ndCB1cGRhdGUgaWYgd2UgYXJlIGluIFZSIG9yIFhSXG4gICAgICAgIGlmICgoIXRoaXMuX2FsbG93UmVzaXplKSB8fCAodGhpcy54cj8uYWN0aXZlKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSW4gQVVUTyBtb2RlIHRoZSByZXNvbHV0aW9uIGlzIGNoYW5nZWQgdG8gbWF0Y2ggdGhlIGNhbnZhcyBzaXplXG4gICAgICAgIGlmICh0aGlzLl9yZXNvbHV0aW9uTW9kZSA9PT0gUkVTT0xVVElPTl9BVVRPKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgY2FudmFzIERPTSBoYXMgY2hhbmdlZCBzaXplXG4gICAgICAgICAgICBjb25zdCBjYW52YXMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcztcbiAgICAgICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UucmVzaXplQ2FudmFzKGNhbnZhcy5jbGllbnRXaWR0aCwgY2FudmFzLmNsaWVudEhlaWdodCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFdmVudCBoYW5kbGVyIGNhbGxlZCB3aGVuIGFsbCBjb2RlIGxpYnJhcmllcyBoYXZlIGJlZW4gbG9hZGVkLiBDb2RlIGxpYnJhcmllcyBhcmUgcGFzc2VkXG4gICAgICogaW50byB0aGUgY29uc3RydWN0b3Igb2YgdGhlIEFwcGxpY2F0aW9uIGFuZCB0aGUgYXBwbGljYXRpb24gd29uJ3Qgc3RhcnQgcnVubmluZyBvciBsb2FkXG4gICAgICogcGFja3MgdW50aWwgYWxsIGxpYnJhcmllcyBoYXZlIGJlZW4gbG9hZGVkLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxpYnJhcmllc0xvYWRlZCgpIHtcbiAgICAgICAgdGhpcy5fbGlicmFyaWVzTG9hZGVkID0gdHJ1ZTtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW1zLnJpZ2lkYm9keSkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLnJpZ2lkYm9keS5vbkxpYnJhcnlMb2FkZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGx5IHNjZW5lIHNldHRpbmdzIHRvIHRoZSBjdXJyZW50IHNjZW5lLiBVc2VmdWwgd2hlbiB5b3VyIHNjZW5lIHNldHRpbmdzIGFyZSBwYXJzZWQgb3JcbiAgICAgKiBnZW5lcmF0ZWQgZnJvbSBhIG5vbi1VUkwgc291cmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzIC0gVGhlIHNjZW5lIHNldHRpbmdzIHRvIGJlIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzLnBoeXNpY3MgLSBUaGUgcGh5c2ljcyBzZXR0aW5ncyB0byBiZSBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnBoeXNpY3MuZ3Jhdml0eSAtIFRoZSB3b3JsZCBzcGFjZSB2ZWN0b3IgcmVwcmVzZW50aW5nIGdsb2JhbFxuICAgICAqIGdyYXZpdHkgaW4gdGhlIHBoeXNpY3Mgc2ltdWxhdGlvbi4gTXVzdCBiZSBhIGZpeGVkIHNpemUgYXJyYXkgd2l0aCB0aHJlZSBudW1iZXIgZWxlbWVudHMsXG4gICAgICogY29ycmVzcG9uZGluZyB0byBlYWNoIGF4aXMgWyBYLCBZLCBaIF0uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IHNldHRpbmdzLnJlbmRlciAtIFRoZSByZW5kZXJpbmcgc2V0dGluZ3MgdG8gYmUgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5yZW5kZXIuZ2xvYmFsX2FtYmllbnQgLSBUaGUgY29sb3Igb2YgdGhlIHNjZW5lJ3MgYW1iaWVudCBsaWdodC5cbiAgICAgKiBNdXN0IGJlIGEgZml4ZWQgc2l6ZSBhcnJheSB3aXRoIHRocmVlIG51bWJlciBlbGVtZW50cywgY29ycmVzcG9uZGluZyB0byBlYWNoIGNvbG9yIGNoYW5uZWxcbiAgICAgKiBbIFIsIEcsIEIgXS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2V0dGluZ3MucmVuZGVyLmZvZyAtIFRoZSB0eXBlIG9mIGZvZyB1c2VkIGJ5IHRoZSBzY2VuZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRk9HX05PTkV9XG4gICAgICogLSB7QGxpbmsgRk9HX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGT0dfRVhQfVxuICAgICAqIC0ge0BsaW5rIEZPR19FWFAyfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucmVuZGVyLmZvZ19jb2xvciAtIFRoZSBjb2xvciBvZiB0aGUgZm9nIChpZiBlbmFibGVkKS4gTXVzdCBiZSBhXG4gICAgICogZml4ZWQgc2l6ZSBhcnJheSB3aXRoIHRocmVlIG51bWJlciBlbGVtZW50cywgY29ycmVzcG9uZGluZyB0byBlYWNoIGNvbG9yIGNoYW5uZWwgWyBSLCBHLCBCIF0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5mb2dfZGVuc2l0eSAtIFRoZSBkZW5zaXR5IG9mIHRoZSBmb2cgKGlmIGVuYWJsZWQpLiBUaGlzXG4gICAgICogcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0VYUH0gb3Ige0BsaW5rIEZPR19FWFAyfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmZvZ19zdGFydCAtIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgd2hlcmUgbGluZWFyIGZvZ1xuICAgICAqIGJlZ2lucy4gVGhpcyBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfTElORUFSfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmZvZ19lbmQgLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdmlld3BvaW50IHdoZXJlIGxpbmVhciBmb2dcbiAgICAgKiByZWFjaGVzIGl0cyBtYXhpbXVtLiBUaGlzIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZ2FtbWFfY29ycmVjdGlvbiAtIFRoZSBnYW1tYSBjb3JyZWN0aW9uIHRvIGFwcGx5IHdoZW5cbiAgICAgKiByZW5kZXJpbmcgdGhlIHNjZW5lLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBHQU1NQV9OT05FfVxuICAgICAqIC0ge0BsaW5rIEdBTU1BX1NSR0J9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnRvbmVtYXBwaW5nIC0gVGhlIHRvbmVtYXBwaW5nIHRyYW5zZm9ybSB0byBhcHBseSB3aGVuXG4gICAgICogd3JpdGluZyBmcmFnbWVudHMgdG8gdGhlIGZyYW1lIGJ1ZmZlci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9GSUxNSUN9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9IRUpMfVxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfQUNFU31cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZXhwb3N1cmUgLSBUaGUgZXhwb3N1cmUgdmFsdWUgdHdlYWtzIHRoZSBvdmVyYWxsIGJyaWdodG5lc3NcbiAgICAgKiBvZiB0aGUgc2NlbmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ8bnVsbH0gW3NldHRpbmdzLnJlbmRlci5za3lib3hdIC0gVGhlIGFzc2V0IElEIG9mIHRoZSBjdWJlIG1hcCB0ZXh0dXJlIHRvIGJlXG4gICAgICogdXNlZCBhcyB0aGUgc2NlbmUncyBza3lib3guIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5za3lib3hJbnRlbnNpdHkgLSBNdWx0aXBsaWVyIGZvciBza3lib3ggaW50ZW5zaXR5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94THVtaW5hbmNlIC0gTHV4IChsbS9tXjIpIHZhbHVlIGZvciBza3lib3ggaW50ZW5zaXR5IHdoZW4gcGh5c2ljYWwgbGlnaHQgdW5pdHMgYXJlIGVuYWJsZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5za3lib3hNaXAgLSBUaGUgbWlwIGxldmVsIG9mIHRoZSBza3lib3ggdG8gYmUgZGlzcGxheWVkLlxuICAgICAqIE9ubHkgdmFsaWQgZm9yIHByZWZpbHRlcmVkIGN1YmVtYXAgc2t5Ym94ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucmVuZGVyLnNreWJveFJvdGF0aW9uIC0gUm90YXRpb24gb2Ygc2t5Ym94LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRtYXBTaXplTXVsdGlwbGllciAtIFRoZSBsaWdodG1hcCByZXNvbHV0aW9uIG11bHRpcGxpZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodG1hcE1heFJlc29sdXRpb24gLSBUaGUgbWF4aW11bSBsaWdodG1hcCByZXNvbHV0aW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRtYXBNb2RlIC0gVGhlIGxpZ2h0bWFwIGJha2luZyBtb2RlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUkRJUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcCArIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbiAodXNlZCBmb3IgYnVtcC9zcGVjdWxhcilcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlIC0gRW5hYmxlIGJha2luZyBhbWJpZW50IGxpZ2h0IGludG8gbGlnaHRtYXBzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VOdW1TYW1wbGVzIC0gTnVtYmVyIG9mIHNhbXBsZXMgdG8gdXNlIHdoZW4gYmFraW5nIGFtYmllbnQgbGlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZVNwaGVyZVBhcnQgLSBIb3cgbXVjaCBvZiB0aGUgc3BoZXJlIHRvIGluY2x1ZGUgd2hlbiBiYWtpbmcgYW1iaWVudCBsaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcyAtIEJyaWdobmVzcyBvZiB0aGUgYmFrZWQgYW1iaWVudCBvY2NsdXNpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0IC0gQ29udHJhc3Qgb2YgdGhlIGJha2VkIGFtYmllbnQgb2NjbHVzaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEx1bWluYW5jZSAtIEx1eCAobG0vbV4yKSB2YWx1ZSBmb3IgYW1iaWVudCBsaWdodCBpbnRlbnNpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgLSBFbmFibGUgY2x1c3RlcmVkIGxpZ2h0aW5nLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nU2hhZG93c0VuYWJsZWQgLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgc2hhZG93cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0Nvb2tpZXNFbmFibGVkIC0gSWYgc2V0IHRvIHRydWUsIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgd2lsbCBzdXBwb3J0IGNvb2tpZSB0ZXh0dXJlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0FyZWFMaWdodHNFbmFibGVkIC0gSWYgc2V0IHRvIHRydWUsIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgd2lsbCBzdXBwb3J0IGFyZWEgbGlnaHRzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdTaGFkb3dBdGxhc1Jlc29sdXRpb24gLSBSZXNvbHV0aW9uIG9mIHRoZSBhdGxhcyB0ZXh0dXJlIHN0b3JpbmcgYWxsIG5vbi1kaXJlY3Rpb25hbCBzaGFkb3cgdGV4dHVyZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0Nvb2tpZUF0bGFzUmVzb2x1dGlvbiAtIFJlc29sdXRpb24gb2YgdGhlIGF0bGFzIHRleHR1cmUgc3RvcmluZyBhbGwgbm9uLWRpcmVjdGlvbmFsIGNvb2tpZSB0ZXh0dXJlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nTWF4TGlnaHRzUGVyQ2VsbCAtIE1heGltdW0gbnVtYmVyIG9mIGxpZ2h0cyBhIGNlbGwgY2FuIHN0b3JlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdTaGFkb3dUeXBlIC0gVGhlIHR5cGUgb2Ygc2hhZG93IGZpbHRlcmluZyB1c2VkIGJ5IGFsbCBzaGFkb3dzLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBTSEFET1dfUENGMX06IFBDRiAxeDEgc2FtcGxpbmcuXG4gICAgICogLSB7QGxpbmsgU0hBRE9XX1BDRjN9OiBQQ0YgM3gzIHNhbXBsaW5nLlxuICAgICAqIC0ge0BsaW5rIFNIQURPV19QQ0Y1fTogUENGIDV4NSBzYW1wbGluZy4gRmFsbHMgYmFjayB0byB7QGxpbmsgU0hBRE9XX1BDRjN9IG9uIFdlYkdMIDEuMC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQ2VsbHMgLSBOdW1iZXIgb2YgY2VsbHMgYWxvbmcgZWFjaCB3b3JsZC1zcGFjZSBheGlzIHRoZSBzcGFjZSBjb250YWluaW5nIGxpZ2h0c1xuICAgICAqIGlzIHN1YmRpdmlkZWQgaW50by5cbiAgICAgKlxuICAgICAqIE9ubHkgbGlnaHRzIHdpdGggYmFrZURpcj10cnVlIHdpbGwgYmUgdXNlZCBmb3IgZ2VuZXJhdGluZyB0aGUgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiB2YXIgc2V0dGluZ3MgPSB7XG4gICAgICogICAgIHBoeXNpY3M6IHtcbiAgICAgKiAgICAgICAgIGdyYXZpdHk6IFswLCAtOS44LCAwXVxuICAgICAqICAgICB9LFxuICAgICAqICAgICByZW5kZXI6IHtcbiAgICAgKiAgICAgICAgIGZvZ19lbmQ6IDEwMDAsXG4gICAgICogICAgICAgICB0b25lbWFwcGluZzogMCxcbiAgICAgKiAgICAgICAgIHNreWJveDogbnVsbCxcbiAgICAgKiAgICAgICAgIGZvZ19kZW5zaXR5OiAwLjAxLFxuICAgICAqICAgICAgICAgZ2FtbWFfY29ycmVjdGlvbjogMSxcbiAgICAgKiAgICAgICAgIGV4cG9zdXJlOiAxLFxuICAgICAqICAgICAgICAgZm9nX3N0YXJ0OiAxLFxuICAgICAqICAgICAgICAgZ2xvYmFsX2FtYmllbnQ6IFswLCAwLCAwXSxcbiAgICAgKiAgICAgICAgIHNreWJveEludGVuc2l0eTogMSxcbiAgICAgKiAgICAgICAgIHNreWJveFJvdGF0aW9uOiBbMCwgMCwgMF0sXG4gICAgICogICAgICAgICBmb2dfY29sb3I6IFswLCAwLCAwXSxcbiAgICAgKiAgICAgICAgIGxpZ2h0bWFwTW9kZTogMSxcbiAgICAgKiAgICAgICAgIGZvZzogJ25vbmUnLFxuICAgICAqICAgICAgICAgbGlnaHRtYXBNYXhSZXNvbHV0aW9uOiAyMDQ4LFxuICAgICAqICAgICAgICAgc2t5Ym94TWlwOiAyLFxuICAgICAqICAgICAgICAgbGlnaHRtYXBTaXplTXVsdGlwbGllcjogMTZcbiAgICAgKiAgICAgfVxuICAgICAqIH07XG4gICAgICogYXBwLmFwcGx5U2NlbmVTZXR0aW5ncyhzZXR0aW5ncyk7XG4gICAgICovXG4gICAgYXBwbHlTY2VuZVNldHRpbmdzKHNldHRpbmdzKSB7XG4gICAgICAgIGxldCBhc3NldDtcblxuICAgICAgICBpZiAodGhpcy5zeXN0ZW1zLnJpZ2lkYm9keSAmJiB0eXBlb2YgQW1tbyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXZpdHkgPSBzZXR0aW5ncy5waHlzaWNzLmdyYXZpdHk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMucmlnaWRib2R5LmdyYXZpdHkuc2V0KGdyYXZpdHlbMF0sIGdyYXZpdHlbMV0sIGdyYXZpdHlbMl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zY2VuZS5hcHBseVNldHRpbmdzKHNldHRpbmdzKTtcblxuICAgICAgICBpZiAoc2V0dGluZ3MucmVuZGVyLmhhc093blByb3BlcnR5KCdza3lib3gnKSkge1xuICAgICAgICAgICAgaWYgKHNldHRpbmdzLnJlbmRlci5za3lib3gpIHtcbiAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuYXNzZXRzLmdldChzZXR0aW5ncy5yZW5kZXIuc2t5Ym94KTtcblxuICAgICAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNldFNreWJveChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub25jZSgnYWRkOicgKyBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94LCB0aGlzLnNldFNreWJveCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFNreWJveChudWxsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGFyZWEgbGlnaHQgTFVUIHRhYmxlcyBmb3IgdGhpcyBhcHAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBsdGNNYXQxIC0gTFVUIHRhYmxlIG9mIHR5cGUgYGFycmF5YCB0byBiZSBzZXQuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbHRjTWF0MiAtIExVVCB0YWJsZSBvZiB0eXBlIGBhcnJheWAgdG8gYmUgc2V0LlxuICAgICAqL1xuICAgIHNldEFyZWFMaWdodEx1dHMobHRjTWF0MSwgbHRjTWF0Mikge1xuXG4gICAgICAgIGlmIChsdGNNYXQxICYmIGx0Y01hdDIpIHtcbiAgICAgICAgICAgIEFyZWFMaWdodEx1dHMuc2V0KHRoaXMuZ3JhcGhpY3NEZXZpY2UsIGx0Y01hdDEsIGx0Y01hdDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgRGVidWcud2FybihcInNldEFyZWFMaWdodEx1dHM6IExVVHMgZm9yIGFyZWEgbGlnaHQgYXJlIG5vdCB2YWxpZFwiKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIHNreWJveCBhc3NldCB0byBjdXJyZW50IHNjZW5lLCBhbmQgc3Vic2NyaWJlcyB0byBhc3NldCBsb2FkL2NoYW5nZSBldmVudHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIEFzc2V0IG9mIHR5cGUgYHNreWJveGAgdG8gYmUgc2V0IHRvLCBvciBudWxsIHRvIHJlbW92ZSBza3lib3guXG4gICAgICovXG4gICAgc2V0U2t5Ym94KGFzc2V0KSB7XG4gICAgICAgIGlmIChhc3NldCAhPT0gdGhpcy5fc2t5Ym94QXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IG9uU2t5Ym94UmVtb3ZlZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnNldFNreWJveChudWxsKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG9uU2t5Ym94Q2hhbmdlZCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnNjZW5lLnNldFNreWJveCh0aGlzLl9za3lib3hBc3NldCA/IHRoaXMuX3NreWJveEFzc2V0LnJlc291cmNlcyA6IG51bGwpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgLy8gY2xlYW51cCBwcmV2aW91cyBhc3NldFxuICAgICAgICAgICAgaWYgKHRoaXMuX3NreWJveEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub2ZmKCdsb2FkOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vZmYoJ3JlbW92ZTonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQub2ZmKCdjaGFuZ2UnLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgbmV3IGFzc2V0XG4gICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldCA9IGFzc2V0O1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NreWJveEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub24oJ2xvYWQ6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9uY2UoJ3JlbW92ZTonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94UmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQub24oJ2NoYW5nZScsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zY2VuZS5za3lib3hNaXAgPT09IDAgJiYgIXRoaXMuX3NreWJveEFzc2V0LmxvYWRGYWNlcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldC5sb2FkRmFjZXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLmxvYWQodGhpcy5fc2t5Ym94QXNzZXQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBvblNreWJveENoYW5nZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9maXJzdEJha2UoKSB7XG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXI/LmJha2UobnVsbCwgdGhpcy5zY2VuZS5saWdodG1hcE1vZGUpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9maXJzdEJhdGNoKCkge1xuICAgICAgICB0aGlzLmJhdGNoZXI/LmdlbmVyYXRlKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvdmlkZSBhbiBvcHBvcnR1bml0eSB0byBtb2RpZnkgdGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3RpbWVzdGFtcF0gLSBUaGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfHVuZGVmaW5lZH0gVGhlIG1vZGlmaWVkIHRpbWVzdGFtcC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX3Byb2Nlc3NUaW1lc3RhbXAodGltZXN0YW1wKSB7XG4gICAgICAgIHJldHVybiB0aW1lc3RhbXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBzaW5nbGUgbGluZS4gTGluZSBzdGFydCBhbmQgZW5kIGNvb3JkaW5hdGVzIGFyZSBzcGVjaWZpZWQgaW4gd29ybGQtc3BhY2UuIFRoZSBsaW5lXG4gICAgICogd2lsbCBiZSBmbGF0LXNoYWRlZCB3aXRoIHRoZSBzcGVjaWZpZWQgY29sb3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHN0YXJ0IC0gVGhlIHN0YXJ0IHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgb2YgdGhlIGxpbmUuXG4gICAgICogQHBhcmFtIHtWZWMzfSBlbmQgLSBUaGUgZW5kIHdvcmxkLXNwYWNlIGNvb3JkaW5hdGUgb2YgdGhlIGxpbmUuXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW2NvbG9yXSAtIFRoZSBjb2xvciBvZiB0aGUgbGluZS4gSXQgZGVmYXVsdHMgdG8gd2hpdGUgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBsaW5lIGlzIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbGluZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgMS11bml0IGxvbmcgd2hpdGUgbGluZVxuICAgICAqIHZhciBzdGFydCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIHZhciBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd0xpbmUoc3RhcnQsIGVuZCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSAxLXVuaXQgbG9uZyByZWQgbGluZSB3aGljaCBpcyBub3QgZGVwdGggdGVzdGVkIGFuZCByZW5kZXJzIG9uIHRvcCBvZiBvdGhlciBnZW9tZXRyeVxuICAgICAqIHZhciBzdGFydCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIHZhciBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd0xpbmUoc3RhcnQsIGVuZCwgcGMuQ29sb3IuUkVELCBmYWxzZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSAxLXVuaXQgbG9uZyB3aGl0ZSBsaW5lIGludG8gdGhlIHdvcmxkIGxheWVyXG4gICAgICogdmFyIHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIHZhciB3b3JsZExheWVyID0gYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQocGMuTEFZRVJJRF9XT1JMRCk7XG4gICAgICogYXBwLmRyYXdMaW5lKHN0YXJ0LCBlbmQsIHBjLkNvbG9yLldISVRFLCB0cnVlLCB3b3JsZExheWVyKTtcbiAgICAgKi9cbiAgICBkcmF3TGluZShzdGFydCwgZW5kLCBjb2xvciwgZGVwdGhUZXN0LCBsYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmRyYXdMaW5lKHN0YXJ0LCBlbmQsIGNvbG9yLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIGFyYml0cmFyeSBudW1iZXIgb2YgZGlzY3JldGUgbGluZSBzZWdtZW50cy4gVGhlIGxpbmVzIGFyZSBub3QgY29ubmVjdGVkIGJ5IGVhY2hcbiAgICAgKiBzdWJzZXF1ZW50IHBvaW50IGluIHRoZSBhcnJheS4gSW5zdGVhZCwgdGhleSBhcmUgaW5kaXZpZHVhbCBzZWdtZW50cyBzcGVjaWZpZWQgYnkgdHdvXG4gICAgICogcG9pbnRzLiBUaGVyZWZvcmUsIHRoZSBsZW5ndGhzIG9mIHRoZSBzdXBwbGllZCBwb3NpdGlvbiBhbmQgY29sb3IgYXJyYXlzIG11c3QgYmUgdGhlIHNhbWVcbiAgICAgKiBhbmQgYWxzbyBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMi4gVGhlIGNvbG9ycyBvZiB0aGUgZW5kcyBvZiBlYWNoIGxpbmUgc2VnbWVudCB3aWxsIGJlXG4gICAgICogaW50ZXJwb2xhdGVkIGFsb25nIHRoZSBsZW5ndGggb2YgZWFjaCBsaW5lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIHBvaW50cyB0byBkcmF3IGxpbmVzIGJldHdlZW4uIFRoZSBsZW5ndGggb2YgdGhlXG4gICAgICogYXJyYXkgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDIuXG4gICAgICogQHBhcmFtIHtDb2xvcltdfSBjb2xvcnMgLSBBbiBhcnJheSBvZiBjb2xvcnMgdG8gY29sb3IgdGhlIGxpbmVzLiBUaGlzIG11c3QgYmUgdGhlIHNhbWVcbiAgICAgKiBsZW5ndGggYXMgdGhlIHBvc2l0aW9uIGFycmF5LiBUaGUgbGVuZ3RoIG9mIHRoZSBhcnJheSBtdXN0IGFsc28gYmUgYSBtdWx0aXBsZSBvZiAyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGUgZGVwdGhcbiAgICAgKiBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIGxpbmVzIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSBzaW5nbGUgbGluZSwgd2l0aCB1bmlxdWUgY29sb3JzIGZvciBlYWNoIHBvaW50XG4gICAgICogdmFyIHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3TGluZXMoW3N0YXJ0LCBlbmRdLCBbcGMuQ29sb3IuUkVELCBwYy5Db2xvci5XSElURV0pO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIDIgZGlzY3JldGUgbGluZSBzZWdtZW50c1xuICAgICAqIHZhciBwb2ludHMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICBuZXcgcGMuVmVjMygwLCAwLCAwKSxcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMSwgMCwgMCksXG4gICAgICogICAgIC8vIExpbmUgMlxuICAgICAqICAgICBuZXcgcGMuVmVjMygxLCAxLCAwKSxcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMSwgMSwgMSlcbiAgICAgKiBdO1xuICAgICAqIHZhciBjb2xvcnMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICBwYy5Db2xvci5SRUQsXG4gICAgICogICAgIHBjLkNvbG9yLllFTExPVyxcbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIHBjLkNvbG9yLkNZQU4sXG4gICAgICogICAgIHBjLkNvbG9yLkJMVUVcbiAgICAgKiBdO1xuICAgICAqIGFwcC5kcmF3TGluZXMocG9pbnRzLCBjb2xvcnMpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5kcmF3TGluZXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gYXJiaXRyYXJ5IG51bWJlciBvZiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzLiBUaGUgbGluZXMgYXJlIG5vdCBjb25uZWN0ZWQgYnkgZWFjaFxuICAgICAqIHN1YnNlcXVlbnQgcG9pbnQgaW4gdGhlIGFycmF5LiBJbnN0ZWFkLCB0aGV5IGFyZSBpbmRpdmlkdWFsIHNlZ21lbnRzIHNwZWNpZmllZCBieSB0d29cbiAgICAgKiBwb2ludHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiBwb2ludHMgdG8gZHJhdyBsaW5lcyBiZXR3ZWVuLiBFYWNoIHBvaW50IGlzXG4gICAgICogcmVwcmVzZW50ZWQgYnkgMyBudW1iZXJzIC0geCwgeSBhbmQgeiBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGNvbG9ycyAtIEFuIGFycmF5IG9mIGNvbG9ycyB0byBjb2xvciB0aGUgbGluZXMuIFRoaXMgbXVzdCBiZSB0aGUgc2FtZVxuICAgICAqIGxlbmd0aCBhcyB0aGUgcG9zaXRpb24gYXJyYXkuIFRoZSBsZW5ndGggb2YgdGhlIGFycmF5IG11c3QgYWxzbyBiZSBhIG11bHRpcGxlIG9mIDIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbGluZXMgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciAyIGRpc2NyZXRlIGxpbmUgc2VnbWVudHNcbiAgICAgKiB2YXIgcG9pbnRzID0gW1xuICAgICAqICAgICAvLyBMaW5lIDFcbiAgICAgKiAgICAgMCwgMCwgMCxcbiAgICAgKiAgICAgMSwgMCwgMCxcbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIDEsIDEsIDAsXG4gICAgICogICAgIDEsIDEsIDFcbiAgICAgKiBdO1xuICAgICAqIHZhciBjb2xvcnMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICAxLCAwLCAwLCAxLCAgLy8gcmVkXG4gICAgICogICAgIDAsIDEsIDAsIDEsICAvLyBncmVlblxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgMCwgMCwgMSwgMSwgIC8vIGJsdWVcbiAgICAgKiAgICAgMSwgMSwgMSwgMSAgIC8vIHdoaXRlXG4gICAgICogXTtcbiAgICAgKiBhcHAuZHJhd0xpbmVBcnJheXMocG9pbnRzLCBjb2xvcnMpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lQXJyYXlzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmRyYXdMaW5lQXJyYXlzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHdpcmVmcmFtZSBzcGhlcmUgd2l0aCBjZW50ZXIsIHJhZGl1cyBhbmQgY29sb3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGNlbnRlciAtIFRoZSBjZW50ZXIgb2YgdGhlIHNwaGVyZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmFkaXVzIC0gVGhlIHJhZGl1cyBvZiB0aGUgc3BoZXJlLlxuICAgICAqIEBwYXJhbSB7Q29sb3J9IFtjb2xvcl0gLSBUaGUgY29sb3Igb2YgdGhlIHNwaGVyZS4gSXQgZGVmYXVsdHMgdG8gd2hpdGUgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3NlZ21lbnRzXSAtIE51bWJlciBvZiBsaW5lIHNlZ21lbnRzIHVzZWQgdG8gcmVuZGVyIHRoZSBjaXJjbGVzIGZvcm1pbmcgdGhlXG4gICAgICogc3BoZXJlLiBEZWZhdWx0cyB0byAyMC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBzcGhlcmUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZVxuICAgICAqIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgc3BoZXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSByZWQgd2lyZSBzcGhlcmUgd2l0aCByYWRpdXMgb2YgMVxuICAgICAqIHZhciBjZW50ZXIgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd1dpcmVTcGhlcmUoY2VudGVyLCAxLjAsIHBjLkNvbG9yLlJFRCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdXaXJlU3BoZXJlKGNlbnRlciwgcmFkaXVzLCBjb2xvciA9IENvbG9yLldISVRFLCBzZWdtZW50cyA9IDIwLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3V2lyZVNwaGVyZShjZW50ZXIsIHJhZGl1cywgY29sb3IsIHNlZ21lbnRzLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHdpcmVmcmFtZSBheGlzIGFsaWduZWQgYm94IHNwZWNpZmllZCBieSBtaW4gYW5kIG1heCBwb2ludHMgYW5kIGNvbG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBtaW5Qb2ludCAtIFRoZSBtaW4gY29ybmVyIHBvaW50IG9mIHRoZSBib3guXG4gICAgICogQHBhcmFtIHtWZWMzfSBtYXhQb2ludCAtIFRoZSBtYXggY29ybmVyIHBvaW50IG9mIHRoZSBib3guXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW2NvbG9yXSAtIFRoZSBjb2xvciBvZiB0aGUgc3BoZXJlLiBJdCBkZWZhdWx0cyB0byB3aGl0ZSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIHNwaGVyZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlXG4gICAgICogZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBzcGhlcmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIHJlZCB3aXJlIGFsaWduZWQgYm94XG4gICAgICogdmFyIG1pbiA9IG5ldyBwYy5WZWMzKC0xLCAtMSwgLTEpO1xuICAgICAqIHZhciBtYXggPSBuZXcgcGMuVmVjMygxLCAxLCAxKTtcbiAgICAgKiBhcHAuZHJhd1dpcmVBbGlnbmVkQm94KG1pbiwgbWF4LCBwYy5Db2xvci5SRUQpO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3V2lyZUFsaWduZWRCb3gobWluUG9pbnQsIG1heFBvaW50LCBjb2xvciA9IENvbG9yLldISVRFLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3V2lyZUFsaWduZWRCb3gobWluUG9pbnQsIG1heFBvaW50LCBjb2xvciwgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBtZXNoSW5zdGFuY2UgYXQgdGhpcyBmcmFtZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtNZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlIHRvIGRyYXcuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIG1lc2ggaW5zdGFuY2UgaW50by4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3TWVzaEluc3RhbmNlKG1lc2hJbnN0YW5jZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobnVsbCwgbnVsbCwgbnVsbCwgbWVzaEluc3RhbmNlLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBtZXNoIGF0IHRoaXMgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01lc2h9IG1lc2ggLSBUaGUgbWVzaCB0byBkcmF3LlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSB0byByZW5kZXIgdGhlIG1lc2guXG4gICAgICogQHBhcmFtIHtNYXQ0fSBtYXRyaXggLSBUaGUgbWF0cml4IHRvIHVzZSB0byByZW5kZXIgdGhlIG1lc2guXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIG1lc2ggaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd01lc2gobWVzaCwgbWF0ZXJpYWwsIG1hdHJpeCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgbWVzaCwgbnVsbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXcgcXVhZCBvZiBzaXplIFstMC41LCAwLjVdIGF0IHRoaXMgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IG1hdHJpeCAtIFRoZSBtYXRyaXggdG8gdXNlIHRvIHJlbmRlciB0aGUgcXVhZC5cbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB0byB1c2UgdG8gcmVuZGVyIHRoZSBxdWFkLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBxdWFkIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdRdWFkKG1hdHJpeCwgbWF0ZXJpYWwsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdNZXNoKG1hdGVyaWFsLCBtYXRyaXgsIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmdldFF1YWRNZXNoKCksIG51bGwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHRleHR1cmUgYXQgW3gsIHldIHBvc2l0aW9uIG9uIHNjcmVlbiwgd2l0aCBzaXplIFt3aWR0aCwgaGVpZ2h0XS4gVGhlIG9yaWdpbiBvZiB0aGVcbiAgICAgKiBzY3JlZW4gaXMgdG9wLWxlZnQgWzAsIDBdLiBDb29yZGluYXRlcyBhbmQgc2l6ZXMgYXJlIGluIHByb2plY3RlZCBzcGFjZSAoLTEgLi4gMSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgd2lkdGggb2YgdGhlIHJlY3RhbmdsZSBvZiB0aGUgcmVuZGVyZWQgdGV4dHVyZS4gU2hvdWxkIGJlIGluIHRoZVxuICAgICAqIHJhbmdlIFswLCAyXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW5cbiAgICAgKiB0aGUgcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7VGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHJlbmRlci5cbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB1c2VkIHdoZW4gcmVuZGVyaW5nIHRoZSB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSB0ZXh0dXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdUZXh0dXJlKHgsIHksIHdpZHRoLCBoZWlnaHQsIHRleHR1cmUsIG1hdGVyaWFsLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuXG4gICAgICAgIC8vIFRPRE86IGlmIHRoaXMgaXMgdXNlZCBmb3IgYW55dGhpbmcgb3RoZXIgdGhhbiBkZWJ1ZyB0ZXh0dXJlIGRpc3BsYXksIHdlIHNob3VsZCBvcHRpbWl6ZSB0aGlzIHRvIGF2b2lkIGFsbG9jYXRpb25zXG4gICAgICAgIGNvbnN0IG1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIG1hdHJpeC5zZXRUUlMobmV3IFZlYzMoeCwgeSwgMC4wKSwgUXVhdC5JREVOVElUWSwgbmV3IFZlYzMod2lkdGgsIGhlaWdodCwgMC4wKSk7XG5cbiAgICAgICAgaWYgKCFtYXRlcmlhbCkge1xuICAgICAgICAgICAgbWF0ZXJpYWwgPSBuZXcgTWF0ZXJpYWwoKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNldFBhcmFtZXRlcihcImNvbG9yTWFwXCIsIHRleHR1cmUpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2hhZGVyID0gdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0VGV4dHVyZVNoYWRlcigpO1xuICAgICAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRyYXdRdWFkKG1hdHJpeCwgbWF0ZXJpYWwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIGRlcHRoIHRleHR1cmUgYXQgW3gsIHldIHBvc2l0aW9uIG9uIHNjcmVlbiwgd2l0aCBzaXplIFt3aWR0aCwgaGVpZ2h0XS4gVGhlIG9yaWdpbiBvZlxuICAgICAqIHRoZSBzY3JlZW4gaXMgdG9wLWxlZnQgWzAsIDBdLiBDb29yZGluYXRlcyBhbmQgc2l6ZXMgYXJlIGluIHByb2plY3RlZCBzcGFjZSAoLTEgLi4gMSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgd2lkdGggb2YgdGhlIHJlY3RhbmdsZSBvZiB0aGUgcmVuZGVyZWQgdGV4dHVyZS4gU2hvdWxkIGJlIGluIHRoZVxuICAgICAqIHJhbmdlIFswLCAyXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW5cbiAgICAgKiB0aGUgcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSB0ZXh0dXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdEZXB0aFRleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgTWF0ZXJpYWwoKTtcbiAgICAgICAgbWF0ZXJpYWwuc2hhZGVyID0gdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0RGVwdGhUZXh0dXJlU2hhZGVyKCk7XG4gICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgIHRoaXMuZHJhd1RleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgbnVsbCwgbWF0ZXJpYWwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyBhcHBsaWNhdGlvbiBhbmQgcmVtb3ZlcyBhbGwgZXZlbnQgbGlzdGVuZXJzIGF0IHRoZSBlbmQgb2YgdGhlIGN1cnJlbnQgZW5naW5lIGZyYW1lXG4gICAgICogdXBkYXRlLiBIb3dldmVyLCBpZiBjYWxsZWQgb3V0c2lkZSBvZiB0aGUgZW5naW5lIGZyYW1lIHVwZGF0ZSwgY2FsbGluZyBkZXN0cm95KCkgd2lsbFxuICAgICAqIGRlc3Ryb3kgdGhlIGFwcGxpY2F0aW9uIGltbWVkaWF0ZWx5LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuZGVzdHJveSgpO1xuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbkZyYW1lVXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95UmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNhbnZhc0lkID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuaWQ7XG5cbiAgICAgICAgdGhpcy5vZmYoJ2xpYnJhcmllc2xvYWRlZCcpO1xuXG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21venZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbXN2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmtpdHZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnJvb3QuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJvb3QgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLm1vdXNlKSB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLm9mZigpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZS5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMubW91c2UgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMua2V5Ym9hcmQpIHtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQub2ZmKCk7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkLmRldGFjaCgpO1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50b3VjaCkge1xuICAgICAgICAgICAgdGhpcy50b3VjaC5vZmYoKTtcbiAgICAgICAgICAgIHRoaXMudG91Y2guZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLnRvdWNoID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRJbnB1dCkge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5jb250cm9sbGVyKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRyb2xsZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmRlc3Ryb3koKTtcblxuICAgICAgICAvLyBsYXllciBjb21wb3NpdGlvblxuICAgICAgICBpZiAodGhpcy5zY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc2NlbmUubGF5ZXJzLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlc3Ryb3kgYWxsIHRleHR1cmUgcmVzb3VyY2VzXG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuYXNzZXRzLmxpc3QoKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFzc2V0c1tpXS51bmxvYWQoKTtcbiAgICAgICAgICAgIGFzc2V0c1tpXS5vZmYoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmFzc2V0cy5vZmYoKTtcblxuXG4gICAgICAgIC8vIGRlc3Ryb3kgYnVuZGxlIHJlZ2lzdHJ5XG4gICAgICAgIHRoaXMuYnVuZGxlcy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuYnVuZGxlcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5pMThuLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5pMThuID0gbnVsbDtcblxuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiB0aGlzLmxvYWRlci5nZXRIYW5kbGVyKCdzY3JpcHQnKS5fY2FjaGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLmxvYWRlci5nZXRIYW5kbGVyKCdzY3JpcHQnKS5fY2FjaGVba2V5XTtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IGVsZW1lbnQucGFyZW50Tm9kZTtcbiAgICAgICAgICAgIGlmIChwYXJlbnQpIHBhcmVudC5yZW1vdmVDaGlsZChlbGVtZW50KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxvYWRlci5nZXRIYW5kbGVyKCdzY3JpcHQnKS5fY2FjaGUgPSB7fTtcblxuICAgICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnNjZW5lLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zY2VuZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zID0gbnVsbDtcbiAgICAgICAgdGhpcy5jb250ZXh0ID0gbnVsbDtcblxuICAgICAgICAvLyBzY3JpcHQgcmVnaXN0cnlcbiAgICAgICAgdGhpcy5zY3JpcHRzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zY3JpcHRzID0gbnVsbDtcblxuICAgICAgICB0aGlzLnNjZW5lcy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2NlbmVzID0gbnVsbDtcblxuICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyPy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXIgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaGVyKSB7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaGVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZW50aXR5SW5kZXggPSB7fTtcblxuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoLm9uUHJlUmVuZGVyT3BhcXVlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vblBvc3RSZW5kZXJPcGFxdWUgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoLm9uRGlzYWJsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25FbmFibGUgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJXb3JsZCA9IG51bGw7XG5cbiAgICAgICAgdGhpcz8ueHIuZW5kKCk7XG4gICAgICAgIHRoaXM/LnhyLmRlc3Ryb3koKTtcblxuICAgICAgICB0aGlzLnJlbmRlcmVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UgPSBudWxsO1xuXG4gICAgICAgIHRoaXMudGljayA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5vZmYoKTsgLy8gcmVtb3ZlIGFsbCBldmVudHNcblxuICAgICAgICBpZiAodGhpcy5fc291bmRNYW5hZ2VyKSB7XG4gICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5fc291bmRNYW5hZ2VyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNjcmlwdC5hcHAgPSBudWxsO1xuXG4gICAgICAgIEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tjYW52YXNJZF0gPSBudWxsO1xuXG4gICAgICAgIGlmIChnZXRBcHBsaWNhdGlvbigpID09PSB0aGlzKSB7XG4gICAgICAgICAgICBzZXRBcHBsaWNhdGlvbihudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBlbnRpdHkgZnJvbSB0aGUgaW5kZXggYnkgZ3VpZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBndWlkIC0gVGhlIEdVSUQgdG8gc2VhcmNoIGZvci5cbiAgICAgKiBAcmV0dXJucyB7RW50aXR5fSBUaGUgRW50aXR5IHdpdGggdGhlIEdVSUQgb3IgbnVsbC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0RW50aXR5RnJvbUluZGV4KGd1aWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VudGl0eUluZGV4W2d1aWRdO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlZ2lzdGVyU2NlbmVJbW1lZGlhdGUoc2NlbmUpIHtcbiAgICAgICAgdGhpcy5vbigncG9zdHJlbmRlcicsIHNjZW5lLmltbWVkaWF0ZS5vblBvc3RSZW5kZXIsIHNjZW5lLmltbWVkaWF0ZSk7XG4gICAgfVxufVxuXG4vLyBzdGF0aWMgZGF0YVxuY29uc3QgX2ZyYW1lRW5kRGF0YSA9IHt9O1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEFwcEJhc2Ujc3RhcnR9IGFuZCBpdHNlbGYgdG8gcmVxdWVzdFxuICogdGhlIHJlbmRlcmluZyBvZiBhIG5ldyBhbmltYXRpb24gZnJhbWUuXG4gKlxuICogQGNhbGxiYWNrIE1ha2VUaWNrQ2FsbGJhY2tcbiAqIEBwYXJhbSB7bnVtYmVyfSBbdGltZXN0YW1wXSAtIFRoZSB0aW1lc3RhbXAgc3VwcGxpZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLlxuICogQHBhcmFtIHsqfSBbZnJhbWVdIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAqIEBpZ25vcmVcbiAqL1xuXG4vKipcbiAqIENyZWF0ZSB0aWNrIGZ1bmN0aW9uIHRvIGJlIHdyYXBwZWQgaW4gY2xvc3VyZS5cbiAqXG4gKiBAcGFyYW0ge0FwcEJhc2V9IF9hcHAgLSBUaGUgYXBwbGljYXRpb24uXG4gKiBAcmV0dXJucyB7TWFrZVRpY2tDYWxsYmFja30gVGhlIHRpY2sgZnVuY3Rpb24uXG4gKiBAcHJpdmF0ZVxuICovXG5jb25zdCBtYWtlVGljayA9IGZ1bmN0aW9uIChfYXBwKSB7XG4gICAgY29uc3QgYXBwbGljYXRpb24gPSBfYXBwO1xuICAgIGxldCBmcmFtZVJlcXVlc3Q7XG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt0aW1lc3RhbXBdIC0gVGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gICAgICogQHBhcmFtIHsqfSBbZnJhbWVdIC0gWFJGcmFtZSBmcm9tIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKi9cbiAgICByZXR1cm4gZnVuY3Rpb24gKHRpbWVzdGFtcCwgZnJhbWUpIHtcbiAgICAgICAgaWYgKCFhcHBsaWNhdGlvbi5ncmFwaGljc0RldmljZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBzZXRBcHBsaWNhdGlvbihhcHBsaWNhdGlvbik7XG5cbiAgICAgICAgaWYgKGZyYW1lUmVxdWVzdCkge1xuICAgICAgICAgICAgd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lKGZyYW1lUmVxdWVzdCk7XG4gICAgICAgICAgICBmcmFtZVJlcXVlc3QgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaGF2ZSBjdXJyZW50IGFwcGxpY2F0aW9uIHBvaW50ZXIgaW4gcGNcbiAgICAgICAgYXBwID0gYXBwbGljYXRpb247XG5cbiAgICAgICAgY29uc3QgY3VycmVudFRpbWUgPSBhcHBsaWNhdGlvbi5fcHJvY2Vzc1RpbWVzdGFtcCh0aW1lc3RhbXApIHx8IG5vdygpO1xuICAgICAgICBjb25zdCBtcyA9IGN1cnJlbnRUaW1lIC0gKGFwcGxpY2F0aW9uLl90aW1lIHx8IGN1cnJlbnRUaW1lKTtcbiAgICAgICAgbGV0IGR0ID0gbXMgLyAxMDAwLjA7XG4gICAgICAgIGR0ID0gbWF0aC5jbGFtcChkdCwgMCwgYXBwbGljYXRpb24ubWF4RGVsdGFUaW1lKTtcbiAgICAgICAgZHQgKj0gYXBwbGljYXRpb24udGltZVNjYWxlO1xuXG4gICAgICAgIGFwcGxpY2F0aW9uLl90aW1lID0gY3VycmVudFRpbWU7XG5cbiAgICAgICAgLy8gU3VibWl0IGEgcmVxdWVzdCB0byBxdWV1ZSB1cCBhIG5ldyBhbmltYXRpb24gZnJhbWUgaW1tZWRpYXRlbHlcbiAgICAgICAgaWYgKGFwcGxpY2F0aW9uLnhyPy5zZXNzaW9uKSB7XG4gICAgICAgICAgICBmcmFtZVJlcXVlc3QgPSBhcHBsaWNhdGlvbi54ci5zZXNzaW9uLnJlcXVlc3RBbmltYXRpb25GcmFtZShhcHBsaWNhdGlvbi50aWNrKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IHBsYXRmb3JtLmJyb3dzZXIgPyB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFwcGxpY2F0aW9uLnRpY2spIDogbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhcHBsaWNhdGlvbi5ncmFwaGljc0RldmljZS5jb250ZXh0TG9zdClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBhcHBsaWNhdGlvbi5fZmlsbEZyYW1lU3RhdHNCYXNpYyhjdXJyZW50VGltZSwgZHQsIG1zKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIGFwcGxpY2F0aW9uLl9maWxsRnJhbWVTdGF0cygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBhcHBsaWNhdGlvbi5faW5GcmFtZVVwZGF0ZSA9IHRydWU7XG4gICAgICAgIGFwcGxpY2F0aW9uLmZpcmUoXCJmcmFtZXVwZGF0ZVwiLCBtcyk7XG5cbiAgICAgICAgbGV0IHNob3VsZFJlbmRlckZyYW1lID0gdHJ1ZTtcblxuICAgICAgICBpZiAoZnJhbWUpIHtcbiAgICAgICAgICAgIHNob3VsZFJlbmRlckZyYW1lID0gYXBwbGljYXRpb24ueHI/LnVwZGF0ZShmcmFtZSk7XG4gICAgICAgICAgICBhcHBsaWNhdGlvbi5ncmFwaGljc0RldmljZS5kZWZhdWx0RnJhbWVidWZmZXIgPSBmcmFtZS5zZXNzaW9uLnJlbmRlclN0YXRlLmJhc2VMYXllci5mcmFtZWJ1ZmZlcjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2hvdWxkUmVuZGVyRnJhbWUpIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLnVwZGF0ZShkdCk7XG5cbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmZpcmUoXCJmcmFtZXJlbmRlclwiKTtcblxuICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfRlJBTUUsIGAtLS0gRnJhbWUgJHthcHBsaWNhdGlvbi5mcmFtZX1gKTtcblxuICAgICAgICAgICAgaWYgKGFwcGxpY2F0aW9uLmF1dG9SZW5kZXIgfHwgYXBwbGljYXRpb24ucmVuZGVyTmV4dEZyYW1lKSB7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24udXBkYXRlQ2FudmFzU2l6ZSgpO1xuICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uLnJlbmRlcigpO1xuICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uLnJlbmRlck5leHRGcmFtZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgZXZlbnQgZGF0YVxuICAgICAgICAgICAgX2ZyYW1lRW5kRGF0YS50aW1lc3RhbXAgPSBub3coKTtcbiAgICAgICAgICAgIF9mcmFtZUVuZERhdGEudGFyZ2V0ID0gYXBwbGljYXRpb247XG5cbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmZpcmUoXCJmcmFtZWVuZFwiLCBfZnJhbWVFbmREYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9pbkZyYW1lVXBkYXRlID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGFwcGxpY2F0aW9uLl9kZXN0cm95UmVxdWVzdGVkKSB7XG4gICAgICAgICAgICBhcHBsaWNhdGlvbi5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9O1xufTtcblxuZXhwb3J0IHsgYXBwLCBBcHBCYXNlIH07XG4iXSwibmFtZXMiOlsiUHJvZ3Jlc3MiLCJjb25zdHJ1Y3RvciIsImxlbmd0aCIsImNvdW50IiwiaW5jIiwiZG9uZSIsImFwcCIsIkFwcEJhc2UiLCJFdmVudEhhbmRsZXIiLCJjYW52YXMiLCJ2ZXJzaW9uIiwiaW5kZXhPZiIsIkRlYnVnIiwibG9nIiwicmV2aXNpb24iLCJfYXBwbGljYXRpb25zIiwiaWQiLCJzZXRBcHBsaWNhdGlvbiIsIl9kZXN0cm95UmVxdWVzdGVkIiwiX2luRnJhbWVVcGRhdGUiLCJfdGltZSIsInRpbWVTY2FsZSIsIm1heERlbHRhVGltZSIsImZyYW1lIiwiYXV0b1JlbmRlciIsInJlbmRlck5leHRGcmFtZSIsInVzZUxlZ2FjeVNjcmlwdEF0dHJpYnV0ZUNsb25pbmciLCJzY3JpcHQiLCJsZWdhY3kiLCJfbGlicmFyaWVzTG9hZGVkIiwiX2ZpbGxNb2RlIiwiRklMTE1PREVfS0VFUF9BU1BFQ1QiLCJfcmVzb2x1dGlvbk1vZGUiLCJSRVNPTFVUSU9OX0ZJWEVEIiwiX2FsbG93UmVzaXplIiwiY29udGV4dCIsImluaXQiLCJhcHBPcHRpb25zIiwiZGV2aWNlIiwiZ3JhcGhpY3NEZXZpY2UiLCJhc3NlcnQiLCJfaW5pdERlZmF1bHRNYXRlcmlhbCIsInN0YXRzIiwiQXBwbGljYXRpb25TdGF0cyIsIl9zb3VuZE1hbmFnZXIiLCJzb3VuZE1hbmFnZXIiLCJsb2FkZXIiLCJSZXNvdXJjZUxvYWRlciIsIkxpZ2h0c0J1ZmZlciIsIl9lbnRpdHlJbmRleCIsInNjZW5lIiwiU2NlbmUiLCJfcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZSIsInJvb3QiLCJFbnRpdHkiLCJfZW5hYmxlZEluSGllcmFyY2h5IiwiYXNzZXRzIiwiQXNzZXRSZWdpc3RyeSIsImFzc2V0UHJlZml4IiwicHJlZml4IiwiYnVuZGxlcyIsIkJ1bmRsZVJlZ2lzdHJ5IiwiZW5hYmxlQnVuZGxlcyIsIlRleHREZWNvZGVyIiwic2NyaXB0c09yZGVyIiwic2NyaXB0cyIsIlNjcmlwdFJlZ2lzdHJ5IiwiaTE4biIsIkkxOG4iLCJzY2VuZXMiLCJTY2VuZVJlZ2lzdHJ5Iiwic2VsZiIsImRlZmF1bHRMYXllcldvcmxkIiwiTGF5ZXIiLCJuYW1lIiwiTEFZRVJJRF9XT1JMRCIsInNjZW5lR3JhYiIsIlNjZW5lR3JhYiIsImRlZmF1bHRMYXllckRlcHRoIiwibGF5ZXIiLCJkZWZhdWx0TGF5ZXJTa3lib3giLCJlbmFibGVkIiwiTEFZRVJJRF9TS1lCT1giLCJvcGFxdWVTb3J0TW9kZSIsIlNPUlRNT0RFX05PTkUiLCJkZWZhdWx0TGF5ZXJVaSIsIkxBWUVSSURfVUkiLCJ0cmFuc3BhcmVudFNvcnRNb2RlIiwiU09SVE1PREVfTUFOVUFMIiwicGFzc1Rocm91Z2giLCJkZWZhdWx0TGF5ZXJJbW1lZGlhdGUiLCJMQVlFUklEX0lNTUVESUFURSIsImRlZmF1bHRMYXllckNvbXBvc2l0aW9uIiwiTGF5ZXJDb21wb3NpdGlvbiIsInB1c2hPcGFxdWUiLCJwdXNoVHJhbnNwYXJlbnQiLCJsYXllcnMiLCJvbiIsIm9sZENvbXAiLCJuZXdDb21wIiwibGlzdCIsImxheWVyTGlzdCIsImkiLCJMQVlFUklEX0RFUFRIIiwicGF0Y2giLCJBcmVhTGlnaHRMdXRzIiwiY3JlYXRlUGxhY2Vob2xkZXIiLCJyZW5kZXJlciIsIkZvcndhcmRSZW5kZXJlciIsImZyYW1lR3JhcGgiLCJGcmFtZUdyYXBoIiwibGlnaHRtYXBwZXIiLCJvbmNlIiwiX2ZpcnN0QmFrZSIsIl9iYXRjaGVyIiwiYmF0Y2hNYW5hZ2VyIiwiX2ZpcnN0QmF0Y2giLCJrZXlib2FyZCIsIm1vdXNlIiwidG91Y2giLCJnYW1lcGFkcyIsImVsZW1lbnRJbnB1dCIsInhyIiwiYXR0YWNoU2VsZWN0RXZlbnRzIiwiX2luVG9vbHMiLCJfc2t5Ym94QXNzZXQiLCJfc2NyaXB0UHJlZml4Iiwic2NyaXB0UHJlZml4IiwiYWRkSGFuZGxlciIsIkJ1bmRsZUhhbmRsZXIiLCJyZXNvdXJjZUhhbmRsZXJzIiwiZm9yRWFjaCIsInJlc291cmNlSGFuZGxlciIsImhhbmRsZXIiLCJoYW5kbGVyVHlwZSIsInN5c3RlbXMiLCJDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSIsImNvbXBvbmVudFN5c3RlbXMiLCJjb21wb25lbnRTeXN0ZW0iLCJhZGQiLCJfdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIiLCJvblZpc2liaWxpdHlDaGFuZ2UiLCJiaW5kIiwiZG9jdW1lbnQiLCJoaWRkZW4iLCJ1bmRlZmluZWQiLCJfaGlkZGVuQXR0ciIsImFkZEV2ZW50TGlzdGVuZXIiLCJtb3pIaWRkZW4iLCJtc0hpZGRlbiIsIndlYmtpdEhpZGRlbiIsInRpY2siLCJtYWtlVGljayIsImdldEFwcGxpY2F0aW9uIiwibWF0ZXJpYWwiLCJTdGFuZGFyZE1hdGVyaWFsIiwic2hhZGluZ01vZGVsIiwiU1BFQ1VMQVJfQkxJTk4iLCJzZXREZWZhdWx0TWF0ZXJpYWwiLCJiYXRjaGVyIiwiZmlsbE1vZGUiLCJyZXNvbHV0aW9uTW9kZSIsImNvbmZpZ3VyZSIsInVybCIsImNhbGxiYWNrIiwiaHR0cCIsImdldCIsImVyciIsInJlc3BvbnNlIiwicHJvcHMiLCJhcHBsaWNhdGlvbl9wcm9wZXJ0aWVzIiwiX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzIiwiX3BhcnNlU2NlbmVzIiwiX3BhcnNlQXNzZXRzIiwicHJlbG9hZCIsImZpcmUiLCJwcm9ncmVzcyIsIl9kb25lIiwidG90YWwiLCJvbkFzc2V0TG9hZCIsImFzc2V0Iiwib25Bc3NldEVycm9yIiwibG9hZGVkIiwibG9hZCIsIl9wcmVsb2FkU2NyaXB0cyIsInNjZW5lRGF0YSIsInByZWxvYWRpbmciLCJfZ2V0U2NyaXB0UmVmZXJlbmNlcyIsImwiLCJyZWdleCIsIm9uTG9hZCIsIlNjcmlwdFR5cGUiLCJjb25zb2xlIiwiZXJyb3IiLCJzY3JpcHRVcmwiLCJ0ZXN0IiwidG9Mb3dlckNhc2UiLCJwYXRoIiwiam9pbiIsIm1heEFzc2V0UmV0cmllcyIsImVuYWJsZVJldHJ5IiwidXNlRGV2aWNlUGl4ZWxSYXRpbyIsInVzZV9kZXZpY2VfcGl4ZWxfcmF0aW8iLCJyZXNvbHV0aW9uX21vZGUiLCJmaWxsX21vZGUiLCJfd2lkdGgiLCJ3aWR0aCIsIl9oZWlnaHQiLCJoZWlnaHQiLCJtYXhQaXhlbFJhdGlvIiwid2luZG93IiwiZGV2aWNlUGl4ZWxSYXRpbyIsInNldENhbnZhc1Jlc29sdXRpb24iLCJzZXRDYW52YXNGaWxsTW9kZSIsImxheWVyT3JkZXIiLCJjb21wb3NpdGlvbiIsImtleSIsImRhdGEiLCJwYXJzZUludCIsImxlbiIsInN1YmxheWVyIiwidHJhbnNwYXJlbnQiLCJzdWJMYXllckVuYWJsZWQiLCJiYXRjaEdyb3VwcyIsImdycCIsImFkZEdyb3VwIiwiZHluYW1pYyIsIm1heEFhYmJTaXplIiwiaTE4bkFzc2V0cyIsIl9sb2FkTGlicmFyaWVzIiwibGlicmFyaWVzIiwidXJscyIsIm9uTGlicmFyaWVzTG9hZGVkIiwic2NyaXB0c0luZGV4IiwiYnVuZGxlc0luZGV4IiwicHVzaCIsInR5cGUiLCJBc3NldCIsImZpbGUiLCJsb2FkaW5nVHlwZSIsInRhZ3MiLCJsb2NhbGUiLCJhZGRMb2NhbGl6ZWRBc3NldElkIiwicHJpb3JpdHlTY3JpcHRzIiwic2V0dGluZ3MiLCJwcmlvcml0eV9zY3JpcHRzIiwiX3NjcmlwdHMiLCJfaW5kZXgiLCJlbnRpdGllcyIsImNvbXBvbmVudHMiLCJzdGFydCIsInRpbWVzdGFtcCIsIm5vdyIsInRhcmdldCIsImlucHV0VXBkYXRlIiwiZHQiLCJjb250cm9sbGVyIiwidXBkYXRlIiwidXBkYXRlQ2xpZW50UmVjdCIsInVwZGF0ZVN0YXJ0IiwidXBkYXRlVGltZSIsInJlbmRlciIsInJlbmRlclN0YXJ0Iiwic3luY0hpZXJhcmNoeSIsInVwZGF0ZUFsbCIsIl9za2lwUmVuZGVyQ291bnRlciIsInJlbmRlckNvbXBvc2l0aW9uIiwicmVuZGVyVGltZSIsImxheWVyQ29tcG9zaXRpb24iLCJidWlsZEZyYW1lR3JhcGgiLCJfZmlsbEZyYW1lU3RhdHNCYXNpYyIsIm1zIiwiX3RpbWVUb0NvdW50RnJhbWVzIiwiZnBzIiwiX2Zwc0FjY3VtIiwiZHJhd0NhbGxzIiwiX2RyYXdDYWxsc1BlckZyYW1lIiwiX2ZpbGxGcmFtZVN0YXRzIiwiY2FtZXJhcyIsIl9jYW1lcmFzUmVuZGVyZWQiLCJtYXRlcmlhbHMiLCJfbWF0ZXJpYWxTd2l0Y2hlcyIsInNoYWRlcnMiLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsInNoYWRvd01hcFVwZGF0ZXMiLCJfc2hhZG93TWFwVXBkYXRlcyIsInNoYWRvd01hcFRpbWUiLCJfc2hhZG93TWFwVGltZSIsImRlcHRoTWFwVGltZSIsIl9kZXB0aE1hcFRpbWUiLCJmb3J3YXJkVGltZSIsIl9mb3J3YXJkVGltZSIsInByaW1zIiwiX3ByaW1zUGVyRnJhbWUiLCJ0cmlhbmdsZXMiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwiTWF0aCIsIm1heCIsIlBSSU1JVElWRV9UUklTVFJJUCIsIlBSSU1JVElWRV9UUklGQU4iLCJjdWxsVGltZSIsIl9jdWxsVGltZSIsInNvcnRUaW1lIiwiX3NvcnRUaW1lIiwic2tpblRpbWUiLCJfc2tpblRpbWUiLCJtb3JwaFRpbWUiLCJfbW9ycGhUaW1lIiwibGlnaHRDbHVzdGVycyIsIl9saWdodENsdXN0ZXJzIiwibGlnaHRDbHVzdGVyc1RpbWUiLCJfbGlnaHRDbHVzdGVyc1RpbWUiLCJvdGhlclByaW1pdGl2ZXMiLCJfbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUiLCJmb3J3YXJkIiwiX2ZvcndhcmREcmF3Q2FsbHMiLCJjdWxsZWQiLCJfbnVtRHJhd0NhbGxzQ3VsbGVkIiwiZGVwdGgiLCJzaGFkb3ciLCJfc2hhZG93RHJhd0NhbGxzIiwic2tpbm5lZCIsIl9za2luRHJhd0NhbGxzIiwiaW1tZWRpYXRlIiwiaW5zdGFuY2VkIiwicmVtb3ZlZEJ5SW5zdGFuY2luZyIsIm1pc2MiLCJfZGVwdGhEcmF3Q2FsbHMiLCJfaW1tZWRpYXRlUmVuZGVyZWQiLCJfaW5zdGFuY2VkRHJhd0NhbGxzIiwicmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lIiwicGFydGljbGVzIiwidXBkYXRlc1BlckZyYW1lIiwiX3VwZGF0ZXNQZXJGcmFtZSIsImZyYW1lVGltZSIsIl9mcmFtZVRpbWUiLCJtb2RlIiwicmVzaXplQ2FudmFzIiwiUkVTT0xVVElPTl9BVVRPIiwiY2xpZW50V2lkdGgiLCJjbGllbnRIZWlnaHQiLCJpc0hpZGRlbiIsInN1c3BlbmQiLCJyZXN1bWUiLCJzZXNzaW9uIiwid2luZG93V2lkdGgiLCJpbm5lcldpZHRoIiwid2luZG93SGVpZ2h0IiwiaW5uZXJIZWlnaHQiLCJyIiwid2luUiIsIkZJTExNT0RFX0ZJTExfV0lORE9XIiwic3R5bGUiLCJ1cGRhdGVDYW52YXNTaXplIiwiYWN0aXZlIiwicmlnaWRib2R5Iiwib25MaWJyYXJ5TG9hZGVkIiwiYXBwbHlTY2VuZVNldHRpbmdzIiwiQW1tbyIsImdyYXZpdHkiLCJwaHlzaWNzIiwic2V0IiwiYXBwbHlTZXR0aW5ncyIsImhhc093blByb3BlcnR5Iiwic2t5Ym94Iiwic2V0U2t5Ym94Iiwic2V0QXJlYUxpZ2h0THV0cyIsImx0Y01hdDEiLCJsdGNNYXQyIiwid2FybiIsIm9uU2t5Ym94UmVtb3ZlZCIsIm9uU2t5Ym94Q2hhbmdlZCIsInJlc291cmNlcyIsIm9mZiIsInNreWJveE1pcCIsImxvYWRGYWNlcyIsImJha2UiLCJsaWdodG1hcE1vZGUiLCJnZW5lcmF0ZSIsIl9wcm9jZXNzVGltZXN0YW1wIiwiZHJhd0xpbmUiLCJlbmQiLCJjb2xvciIsImRlcHRoVGVzdCIsImRyYXdMaW5lcyIsInBvc2l0aW9ucyIsImNvbG9ycyIsImRlZmF1bHREcmF3TGF5ZXIiLCJkcmF3TGluZUFycmF5cyIsImRyYXdXaXJlU3BoZXJlIiwiY2VudGVyIiwicmFkaXVzIiwiQ29sb3IiLCJXSElURSIsInNlZ21lbnRzIiwiZHJhd1dpcmVBbGlnbmVkQm94IiwibWluUG9pbnQiLCJtYXhQb2ludCIsImRyYXdNZXNoSW5zdGFuY2UiLCJtZXNoSW5zdGFuY2UiLCJkcmF3TWVzaCIsIm1lc2giLCJtYXRyaXgiLCJkcmF3UXVhZCIsImdldFF1YWRNZXNoIiwiZHJhd1RleHR1cmUiLCJ4IiwieSIsInRleHR1cmUiLCJNYXQ0Iiwic2V0VFJTIiwiVmVjMyIsIlF1YXQiLCJJREVOVElUWSIsIk1hdGVyaWFsIiwic2V0UGFyYW1ldGVyIiwic2hhZGVyIiwiZ2V0VGV4dHVyZVNoYWRlciIsImRyYXdEZXB0aFRleHR1cmUiLCJnZXREZXB0aFRleHR1cmVTaGFkZXIiLCJkZXN0cm95IiwiY2FudmFzSWQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiZGV0YWNoIiwidW5sb2FkIiwiZ2V0SGFuZGxlciIsIl9jYWNoZSIsImVsZW1lbnQiLCJwYXJlbnQiLCJwYXJlbnROb2RlIiwicmVtb3ZlQ2hpbGQiLCJvblByZVJlbmRlck9wYXF1ZSIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsIm9uRGlzYWJsZSIsIm9uRW5hYmxlIiwiZ2V0RW50aXR5RnJvbUluZGV4IiwiZ3VpZCIsIm9uUG9zdFJlbmRlciIsIl9mcmFtZUVuZERhdGEiLCJfYXBwIiwiYXBwbGljYXRpb24iLCJmcmFtZVJlcXVlc3QiLCJjYW5jZWxBbmltYXRpb25GcmFtZSIsImN1cnJlbnRUaW1lIiwibWF0aCIsImNsYW1wIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwicGxhdGZvcm0iLCJicm93c2VyIiwiY29udGV4dExvc3QiLCJzaG91bGRSZW5kZXJGcmFtZSIsImRlZmF1bHRGcmFtZWJ1ZmZlciIsInJlbmRlclN0YXRlIiwiYmFzZUxheWVyIiwiZnJhbWVidWZmZXIiLCJ0cmFjZSIsIlRSQUNFSURfUkVOREVSX0ZSQU1FIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBb0ZBLE1BQU1BLFFBQU4sQ0FBZTtFQUNYQyxXQUFXLENBQUNDLE1BQUQsRUFBUztJQUNoQixJQUFLQSxDQUFBQSxNQUFMLEdBQWNBLE1BQWQsQ0FBQTtJQUNBLElBQUtDLENBQUFBLEtBQUwsR0FBYSxDQUFiLENBQUE7QUFDSCxHQUFB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
