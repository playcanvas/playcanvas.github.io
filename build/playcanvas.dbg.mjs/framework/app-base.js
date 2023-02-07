/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { version, revision } from '../core/core.js';
import { platform } from '../core/platform.js';
import { now } from '../core/time.js';
import { path } from '../core/path.js';
import { TRACEID_RENDER_FRAME, TRACEID_RENDER_FRAME_TIME } from '../core/constants.js';
import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { math } from '../core/math/math.js';
import { Quat } from '../core/math/quat.js';
import { Vec3 } from '../core/math/vec3.js';
import { PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN } from '../platform/graphics/constants.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { DebugGraphics } from '../platform/graphics/debug-graphics.js';
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

// Mini-object used to measure progress of loading sets
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

/**
 * Callback used by {@link AppBase#configure} when configuration file is loaded and parsed (or
 * an error occurs).
 *
 * @callback ConfigureAppCallback
 * @param {string|null} err - The error message in the case where the loading or parsing fails.
 */

/**
 * Callback used by {@link AppBase#preload} when all assets (marked as 'preload') are loaded.
 *
 * @callback PreloadAppCallback
 */

let app = null;

/**
 * An Application represents and manages your PlayCanvas application. If you are developing using
 * the PlayCanvas Editor, the Application is created for you. You can access your Application
 * instance in your scripts. Below is a skeleton script which shows how you can access the
 * application 'app' property inside the initialize and update functions:
 *
 * ```javascript
 * // Editor example: accessing the pc.Application from a script
 * var MyScript = pc.createScript('myScript');
 *
 * MyScript.prototype.initialize = function() {
 *     // Every script instance has a property 'this.app' accessible in the initialize...
 *     var app = this.app;
 * };
 *
 * MyScript.prototype.update = function(dt) {
 *     // ...and update functions.
 *     var app = this.app;
 * };
 * ```
 *
 * If you are using the Engine without the Editor, you have to create the application instance
 * manually.
 *
 * @augments EventHandler
 */
class AppBase extends EventHandler {
  /**
   * Create a new AppBase instance.
   *
   * @param {HTMLCanvasElement} canvas - The canvas element.
   * @example
   * // Engine-only example: create the application manually
   * var options = new AppOptions();
   * var app = new pc.AppBase(canvas);
   * app.init(options);
   *
   * // Start the application's main loop
   * app.start();
   *
   * @hideconstructor
   */
  constructor(canvas) {
    super();
    if ((version.indexOf('$')) < 0) {
      Debug.log(`Powered by PlayCanvas ${version} ${revision}`);
    }

    // Store application instance
    AppBase._applications[canvas.id] = this;
    setApplication(this);
    app = this;

    /** @private */
    this._destroyRequested = false;

    /** @private */
    this._inFrameUpdate = false;

    /** @private */
    this._time = 0;

    /**
     * Scales the global time delta. Defaults to 1.
     *
     * @type {number}
     * @example
     * // Set the app to run at half speed
     * this.app.timeScale = 0.5;
     */
    this.timeScale = 1;

    /**
     * Clamps per-frame delta time to an upper bound. Useful since returning from a tab
     * deactivation can generate huge values for dt, which can adversely affect game state.
     * Defaults to 0.1 (seconds).
     *
     * @type {number}
     * @example
     * // Don't clamp inter-frame times of 200ms or less
     * this.app.maxDeltaTime = 0.2;
     */
    this.maxDeltaTime = 0.1; // Maximum delta is 0.1s or 10 fps.

    /**
     * The total number of frames the application has updated since start() was called.
     *
     * @type {number}
     * @ignore
     */
    this.frame = 0;

    /**
     * When true, the application's render function is called every frame. Setting autoRender
     * to false is useful to applications where the rendered image may often be unchanged over
     * time. This can heavily reduce the application's load on the CPU and GPU. Defaults to
     * true.
     *
     * @type {boolean}
     * @example
     * // Disable rendering every frame and only render on a keydown event
     * this.app.autoRender = false;
     * this.app.keyboard.on('keydown', function (event) {
     *     this.app.renderNextFrame = true;
     * }, this);
     */
    this.autoRender = true;

    /**
     * Set to true to render the scene on the next iteration of the main loop. This only has an
     * effect if {@link AppBase#autoRender} is set to false. The value of renderNextFrame
     * is set back to false again as soon as the scene has been rendered.
     *
     * @type {boolean}
     * @example
     * // Render the scene only while space key is pressed
     * if (this.app.keyboard.isPressed(pc.KEY_SPACE)) {
     *     this.app.renderNextFrame = true;
     * }
     */
    this.renderNextFrame = false;

    /**
     * Enable if you want entity type script attributes to not be re-mapped when an entity is
     * cloned.
     *
     * @type {boolean}
     * @ignore
     */
    this.useLegacyScriptAttributeCloning = script.legacy;
    this._librariesLoaded = false;
    this._fillMode = FILLMODE_KEEP_ASPECT;
    this._resolutionMode = RESOLUTION_FIXED;
    this._allowResize = true;

    /**
     * For backwards compatibility with scripts 1.0.
     *
     * @type {AppBase}
     * @deprecated
     * @ignore
     */
    this.context = this;
  }

  /**
   * Initialize the app.
   *
   * @param {import('./app-options.js').AppOptions} appOptions - Options specifying the init
   * parameters for the app.
   */
  init(appOptions) {
    const device = appOptions.graphicsDevice;
    Debug.assert(device, "The application cannot be created without a valid GraphicsDevice");

    /**
     * The graphics device used by the application.
     *
     * @type {import('../platform/graphics/graphics-device.js').GraphicsDevice}
     */
    this.graphicsDevice = device;
    GraphicsDeviceAccess.set(device);
    this._initDefaultMaterial();
    this._initProgramLibrary();
    this.stats = new ApplicationStats(device);

    /**
     * @type {import('../platform/sound/manager.js').SoundManager}
     * @private
     */
    this._soundManager = appOptions.soundManager;

    /**
     * The resource loader.
     *
     * @type {ResourceLoader}
     */
    this.loader = new ResourceLoader(this);
    LightsBuffer.init(device);

    /**
     * Stores all entities that have been created for this app by guid.
     *
     * @type {Object<string, Entity>}
     * @ignore
     */
    this._entityIndex = {};

    /**
     * The scene managed by the application.
     *
     * @type {Scene}
     * @example
     * // Set the tone mapping property of the application's scene
     * this.app.scene.toneMapping = pc.TONEMAP_FILMIC;
     */
    this.scene = new Scene(device);
    this._registerSceneImmediate(this.scene);

    /**
     * The root entity of the application.
     *
     * @type {Entity}
     * @example
     * // Return the first entity called 'Camera' in a depth-first search of the scene hierarchy
     * var camera = this.app.root.findByName('Camera');
     */
    this.root = new Entity();
    this.root._enabledInHierarchy = true;

    /**
     * The asset registry managed by the application.
     *
     * @type {AssetRegistry}
     * @example
     * // Search the asset registry for all assets with the tag 'vehicle'
     * var vehicleAssets = this.app.assets.findByTag('vehicle');
     */
    this.assets = new AssetRegistry(this.loader);
    if (appOptions.assetPrefix) this.assets.prefix = appOptions.assetPrefix;

    /**
     * @type {BundleRegistry}
     * @ignore
     */
    this.bundles = new BundleRegistry(this.assets);

    /**
     * Set this to false if you want to run without using bundles. We set it to true only if
     * TextDecoder is available because we currently rely on it for untarring.
     *
     * @type {boolean}
     * @ignore
     */
    this.enableBundles = typeof TextDecoder !== 'undefined';
    this.scriptsOrder = appOptions.scriptsOrder || [];

    /**
     * The application's script registry.
     *
     * @type {ScriptRegistry}
     */
    this.scripts = new ScriptRegistry(this);

    /**
     * Handles localization.
     *
     * @type {I18n}
     */
    this.i18n = new I18n(this);

    /**
     * The scene registry managed by the application.
     *
     * @type {SceneRegistry}
     * @example
     * // Search the scene registry for a item with the name 'racetrack1'
     * var sceneItem = this.app.scenes.find('racetrack1');
     *
     * // Load the scene using the item's url
     * this.app.scenes.loadScene(sceneItem.url);
     */
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

    // Default layers patch
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

    // placeholder texture for area light LUTs
    AreaLightLuts.createPlaceholder(device);

    /**
     * The forward renderer.
     *
     * @type {ForwardRenderer}
     * @ignore
     */
    this.renderer = new ForwardRenderer(device);
    this.renderer.scene = this.scene;

    /**
     * The frame graph.
     *
     * @type {FrameGraph}
     * @ignore
     */
    this.frameGraph = new FrameGraph();

    /**
     * The run-time lightmapper.
     *
     * @type {import('./lightmapper/lightmapper.js').Lightmapper}
     */
    this.lightmapper = null;
    if (appOptions.lightmapper) {
      this.lightmapper = new appOptions.lightmapper(device, this.root, this.scene, this.renderer, this.assets);
      this.once('prerender', this._firstBake, this);
    }

    /**
     * The application's batch manager.
     *
     * @type {import('../scene/batching/batch-manager.js').BatchManager}
     * @private
     */
    this._batcher = null;
    if (appOptions.batchManager) {
      this._batcher = new appOptions.batchManager(device, this.root, this.scene);
      this.once('prerender', this._firstBatch, this);
    }

    /**
     * The keyboard device.
     *
     * @type {import('../platform/input/keyboard.js').Keyboard}
     */
    this.keyboard = appOptions.keyboard || null;

    /**
     * The mouse device.
     *
     * @type {import('../platform/input/mouse.js').Mouse}
     */
    this.mouse = appOptions.mouse || null;

    /**
     * Used to get touch events input.
     *
     * @type {import('../platform/input/touch-device.js').TouchDevice}
     */
    this.touch = appOptions.touch || null;

    /**
     * Used to access GamePad input.
     *
     * @type {import('../platform/input/game-pads.js').GamePads}
     */
    this.gamepads = appOptions.gamepads || null;

    /**
     * Used to handle input for {@link ElementComponent}s.
     *
     * @type {import('./input/element-input.js').ElementInput}
     */
    this.elementInput = appOptions.elementInput || null;
    if (this.elementInput) this.elementInput.app = this;

    /**
     * The XR Manager that provides ability to start VR/AR sessions.
     *
     * @type {import('./xr/xr-manager.js').XrManager}
     * @example
     * // check if VR is available
     * if (app.xr.isAvailable(pc.XRTYPE_VR)) {
     *     // VR is available
     * }
     */
    this.xr = appOptions.xr ? new appOptions.xr(this) : null;
    if (this.elementInput) this.elementInput.attachSelectEvents();

    /**
     * @type {boolean}
     * @ignore
     */
    this._inTools = false;

    /**
     * @type {Asset|null}
     * @private
     */
    this._skyboxAsset = null;

    /**
     * @type {string}
     * @ignore
     */
    this._scriptPrefix = appOptions.scriptPrefix || '';
    if (this.enableBundles) {
      this.loader.addHandler("bundle", new BundleHandler(this));
    }

    // create and register all required resource handlers
    appOptions.resourceHandlers.forEach(resourceHandler => {
      const handler = new resourceHandler(this);
      this.loader.addHandler(handler.handlerType, handler);
    });

    /**
     * The application's component system registry. The Application constructor adds the
     * following component systems to its component system registry:
     *
     * - anim ({@link AnimComponentSystem})
     * - animation ({@link AnimationComponentSystem})
     * - audiolistener ({@link AudioListenerComponentSystem})
     * - button ({@link ButtonComponentSystem})
     * - camera ({@link CameraComponentSystem})
     * - collision ({@link CollisionComponentSystem})
     * - element ({@link ElementComponentSystem})
     * - layoutchild ({@link LayoutChildComponentSystem})
     * - layoutgroup ({@link LayoutGroupComponentSystem})
     * - light ({@link LightComponentSystem})
     * - model ({@link ModelComponentSystem})
     * - particlesystem ({@link ParticleSystemComponentSystem})
     * - rigidbody ({@link RigidBodyComponentSystem})
     * - render ({@link RenderComponentSystem})
     * - screen ({@link ScreenComponentSystem})
     * - script ({@link ScriptComponentSystem})
     * - scrollbar ({@link ScrollbarComponentSystem})
     * - scrollview ({@link ScrollViewComponentSystem})
     * - sound ({@link SoundComponentSystem})
     * - sprite ({@link SpriteComponentSystem})
     *
     * @type {ComponentSystemRegistry}
     * @example
     * // Set global gravity to zero
     * this.app.systems.rigidbody.gravity.set(0, 0, 0);
     * @example
     * // Set the global sound volume to 50%
     * this.app.systems.sound.volume = 0.5;
     */
    this.systems = new ComponentSystemRegistry();

    // create and register all required component systems
    appOptions.componentSystems.forEach(componentSystem => {
      this.systems.add(new componentSystem(this));
    });

    /** @private */
    this._visibilityChangeHandler = this.onVisibilityChange.bind(this);

    // Depending on browser add the correct visibilitychange event and store the name of the
    // hidden attribute in this._hiddenAttr.
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

    // bind tick function to current scope
    /* eslint-disable-next-line no-use-before-define */
    this.tick = makeTick(this); // Circular linting issue as makeTick and Application reference each other
  }

  /**
   * @private
   * @static
   * @name app
   * @type {AppBase|undefined}
   * @description Gets the current application, if any.
   */

  /**
   * Get the current application. In the case where there are multiple running applications, the
   * function can get an application based on a supplied canvas id. This function is particularly
   * useful when the current Application is not readily available. For example, in the JavaScript
   * console of the browser's developer tools.
   *
   * @param {string} [id] - If defined, the returned application should use the canvas which has
   * this id. Otherwise current application will be returned.
   * @returns {AppBase|undefined} The running application, if any.
   * @example
   * var app = pc.AppBase.getApplication();
   */
  static getApplication(id) {
    return id ? AppBase._applications[id] : getApplication();
  }

  /** @private */
  _initDefaultMaterial() {
    const material = new StandardMaterial();
    material.name = "Default Material";
    material.shadingModel = SPECULAR_BLINN;
    setDefaultMaterial(this.graphicsDevice, material);
  }

  /** @private */
  _initProgramLibrary() {
    const library = new ProgramLibrary(this.graphicsDevice, new StandardMaterial());
    setProgramLibrary(this.graphicsDevice, library);
  }

  /**
   * @type {import('../platform/sound/manager.js').SoundManager}
   * @ignore
   */
  get soundManager() {
    return this._soundManager;
  }

  /**
   * The application's batch manager. The batch manager is used to merge mesh instances in
   * the scene, which reduces the overall number of draw calls, thereby boosting performance.
   *
   * @type {import('../scene/batching/batch-manager.js').BatchManager}
   */
  get batcher() {
    Debug.assert(this._batcher, "BatchManager has not been created and is required for correct functionality.");
    return this._batcher;
  }

  /**
   * The current fill mode of the canvas. Can be:
   *
   * - {@link FILLMODE_NONE}: the canvas will always match the size provided.
   * - {@link FILLMODE_FILL_WINDOW}: the canvas will simply fill the window, changing aspect ratio.
   * - {@link FILLMODE_KEEP_ASPECT}: the canvas will grow to fill the window as best it can while
   * maintaining the aspect ratio.
   *
   * @type {string}
   */
  get fillMode() {
    return this._fillMode;
  }

  /**
   * The current resolution mode of the canvas, Can be:
   *
   * - {@link RESOLUTION_AUTO}: if width and height are not provided, canvas will be resized to
   * match canvas client size.
   * - {@link RESOLUTION_FIXED}: resolution of canvas will be fixed.
   *
   * @type {string}
   */
  get resolutionMode() {
    return this._resolutionMode;
  }

  /**
   * Load the application configuration file and apply application properties and fill the asset
   * registry.
   *
   * @param {string} url - The URL of the configuration file to load.
   * @param {ConfigureAppCallback} callback - The Function called when the configuration file is
   * loaded and parsed (or an error occurs).
   */
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

  /**
   * Load all assets in the asset registry that are marked as 'preload'.
   *
   * @param {PreloadAppCallback} callback - Function called when all assets are loaded.
   */
  preload(callback) {
    this.fire("preload:start");

    // get list of assets to preload
    const assets = this.assets.list({
      preload: true
    });
    const progress = new Progress(assets.length);
    let _done = false;

    // check if all loading is done
    const done = () => {
      // do not proceed if application destroyed
      if (!this.graphicsDevice) {
        return;
      }
      if (!_done && progress.done()) {
        _done = true;
        this.fire("preload:end");
        callback();
      }
    };

    // totals loading progress of assets
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

      // for each asset
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
        // support absolute URLs (for now)
        if (!regex.test(scriptUrl.toLowerCase()) && this._scriptPrefix) scriptUrl = path.join(this._scriptPrefix, scripts[i]);
        this.loader.load(scriptUrl, 'script', onLoad);
      }
    } else {
      this.systems.script.preloading = false;
      callback();
    }
  }

  // set application properties from data file
  _parseApplicationProperties(props, callback) {
    // configure retrying assets
    if (typeof props.maxAssetRetries === 'number' && props.maxAssetRetries > 0) {
      this.loader.enableRetry(props.maxAssetRetries);
    }

    // TODO: remove this temporary block after migrating properties
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

    // set up layers
    if (props.layers && props.layerOrder) {
      const composition = new LayerComposition("application");
      const layers = {};
      for (const key in props.layers) {
        const data = props.layers[key];
        data.id = parseInt(key, 10);
        // depth layer should only be enabled when needed
        // by incrementing its ref counter
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

    // add batch groups
    if (props.batchGroups) {
      const batcher = this.batcher;
      if (batcher) {
        for (let i = 0, len = props.batchGroups.length; i < len; i++) {
          const grp = props.batchGroups[i];
          batcher.addGroup(grp.name, grp.dynamic, grp.maxAabbSize, grp.id, grp.layers);
        }
      }
    }

    // set localization assets
    if (props.i18nAssets) {
      this.i18n.assets = props.i18nAssets;
    }
    this._loadLibraries(props.libraries, callback);
  }

  /**
   * @param {string[]} urls - List of URLs to load.
   * @param {Function} callback - Callback function.
   * @private
   */
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

  /**
   * Insert scene name/urls into the registry.
   *
   * @param {*} scenes - Scenes to add to the scene registry.
   * @private
   */
  _parseScenes(scenes) {
    if (!scenes) return;
    for (let i = 0; i < scenes.length; i++) {
      this.scenes.add(scenes[i].name, scenes[i].url);
    }
  }

  /**
   * Insert assets into registry.
   *
   * @param {*} assets - Assets to insert.
   * @private
   */
  _parseAssets(assets) {
    const list = [];
    const scriptsIndex = {};
    const bundlesIndex = {};
    if (!script.legacy) {
      // add scripts in order of loading first
      for (let i = 0; i < this.scriptsOrder.length; i++) {
        const id = this.scriptsOrder[i];
        if (!assets[id]) continue;
        scriptsIndex[id] = true;
        list.push(assets[id]);
      }

      // then add bundles
      if (this.enableBundles) {
        for (const id in assets) {
          if (assets[id].type === 'bundle') {
            bundlesIndex[id] = true;
            list.push(assets[id]);
          }
        }
      }

      // then add rest of assets
      for (const id in assets) {
        if (scriptsIndex[id] || bundlesIndex[id]) continue;
        list.push(assets[id]);
      }
    } else {
      if (this.enableBundles) {
        // add bundles
        for (const id in assets) {
          if (assets[id].type === 'bundle') {
            bundlesIndex[id] = true;
            list.push(assets[id]);
          }
        }
      }

      // then add rest of assets
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
      // if this is a script asset and has already been embedded in the page then
      // mark it as loaded
      asset.loaded = data.type === 'script' && data.data && data.data.loadingType > 0;
      // tags
      asset.tags.add(data.tags);
      // i18n
      if (data.i18n) {
        for (const locale in data.i18n) {
          asset.addLocalizedAssetId(locale, data.i18n[locale]);
        }
      }
      // registry
      this.assets.add(asset);
    }
  }

  /**
   * @param {Scene} scene - The scene.
   * @returns {Array} - The list of scripts that are referenced by the scene.
   * @private
   */
  _getScriptReferences(scene) {
    let priorityScripts = [];
    if (scene.settings.priority_scripts) {
      priorityScripts = scene.settings.priority_scripts;
    }
    const _scripts = [];
    const _index = {};

    // first add priority scripts
    for (let i = 0; i < priorityScripts.length; i++) {
      _scripts.push(priorityScripts[i]);
      _index[priorityScripts[i]] = true;
    }

    // then iterate hierarchy to get referenced scripts
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

  /**
   * Start the application. This function does the following:
   *
   * 1. Fires an event on the application named 'start'
   * 2. Calls initialize for all components on entities in the hierarchy
   * 3. Fires an event on the application named 'initialize'
   * 4. Calls postInitialize for all components on entities in the hierarchy
   * 5. Fires an event on the application named 'postinitialize'
   * 6. Starts executing the main loop of the application
   *
   * This function is called internally by PlayCanvas applications made in the Editor but you
   * will need to call start yourself if you are using the engine stand-alone.
   *
   * @example
   * app.start();
   */
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

  /**
   * Update all input devices managed by the application.
   *
   * @param {number} dt - The time in seconds since the last update.
   * @private
   */
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

  /**
   * Update the application. This function will call the update functions and then the postUpdate
   * functions of all enabled components. It will then update the current state of all connected
   * input devices. This function is called internally in the application's main loop and does
   * not need to be called explicitly.
   *
   * @param {number} dt - The time delta in seconds since the last frame.
   */
  update(dt) {
    this.frame++;
    this.graphicsDevice.updateClientRect();
    this.stats.frame.updateStart = now();

    // Perform ComponentSystem update
    if (script.legacy) this.systems.fire('fixedUpdate', 1.0 / 60.0);
    this.systems.fire(this._inTools ? 'toolsUpdate' : 'update', dt);
    this.systems.fire('animationUpdate', dt);
    this.systems.fire('postUpdate', dt);

    // fire update event
    this.fire("update", dt);

    // update input devices
    this.inputUpdate(dt);
    this.stats.frame.updateTime = now() - this.stats.frame.updateStart;
  }

  /**
   * Render the application's scene. More specifically, the scene's {@link LayerComposition} is
   * rendered. This function is called internally in the application's main loop and does not
   * need to be called explicitly.
   */
  render() {
    this.stats.frame.renderStart = now();
    this.fire('prerender');
    this.root.syncHierarchy();
    if (this._batcher) {
      this._batcher.updateAll();
    }
    ForwardRenderer._skipRenderCounter = 0;

    // render the scene composition
    this.renderComposition(this.scene.layers);
    this.fire('postrender');
    this.stats.frame.renderTime = now() - this.stats.frame.renderStart;
  }

  // render a layer composition
  renderComposition(layerComposition) {
    DebugGraphics.clearGpuMarkers();
    this.renderer.buildFrameGraph(this.frameGraph, layerComposition);
    this.frameGraph.render(this.graphicsDevice);
  }

  /**
   * @param {number} now - The timestamp passed to the requestAnimationFrame callback.
   * @param {number} dt - The time delta in seconds since the last frame. This is subject to the
   * application's time scale and max delta values.
   * @param {number} ms - The time in milliseconds since the last frame.
   * @private
   */
  _fillFrameStatsBasic(now, dt, ms) {
    // Timing stats
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

    // total draw call
    this.stats.drawCalls.total = this.graphicsDevice._drawCallsPerFrame;
    this.graphicsDevice._drawCallsPerFrame = 0;
  }

  /** @private */
  _fillFrameStats() {
    let stats = this.stats.frame;

    // Render stats
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

    // Draw call stats
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

  /**
   * Controls how the canvas fills the window and resizes when the window changes.
   *
   * @param {string} mode - The mode to use when setting the size of the canvas. Can be:
   *
   * - {@link FILLMODE_NONE}: the canvas will always match the size provided.
   * - {@link FILLMODE_FILL_WINDOW}: the canvas will simply fill the window, changing aspect ratio.
   * - {@link FILLMODE_KEEP_ASPECT}: the canvas will grow to fill the window as best it can while
   * maintaining the aspect ratio.
   *
   * @param {number} [width] - The width of the canvas (only used when mode is {@link FILLMODE_NONE}).
   * @param {number} [height] - The height of the canvas (only used when mode is {@link FILLMODE_NONE}).
   */
  setCanvasFillMode(mode, width, height) {
    this._fillMode = mode;
    this.resizeCanvas(width, height);
  }

  /**
   * Change the resolution of the canvas, and set the way it behaves when the window is resized.
   *
   * @param {string} mode - The mode to use when setting the resolution. Can be:
   *
   * - {@link RESOLUTION_AUTO}: if width and height are not provided, canvas will be resized to
   * match canvas client size.
   * - {@link RESOLUTION_FIXED}: resolution of canvas will be fixed.
   *
   * @param {number} [width] - The horizontal resolution, optional in AUTO mode, if not provided
   * canvas clientWidth is used.
   * @param {number} [height] - The vertical resolution, optional in AUTO mode, if not provided
   * canvas clientHeight is used.
   */
  setCanvasResolution(mode, width, height) {
    this._resolutionMode = mode;

    // In AUTO mode the resolution is the same as the canvas size, unless specified
    if (mode === RESOLUTION_AUTO && width === undefined) {
      width = this.graphicsDevice.canvas.clientWidth;
      height = this.graphicsDevice.canvas.clientHeight;
    }
    this.graphicsDevice.resizeCanvas(width, height);
  }

  /**
   * Queries the visibility of the window or tab in which the application is running.
   *
   * @returns {boolean} True if the application is not visible and false otherwise.
   */
  isHidden() {
    return document[this._hiddenAttr];
  }

  /**
   * Called when the visibility state of the current tab/window changes.
   *
   * @private
   */
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

  /**
   * Resize the application's canvas element in line with the current fill mode.
   *
   * - In {@link FILLMODE_KEEP_ASPECT} mode, the canvas will grow to fill the window as best it
   * can while maintaining the aspect ratio.
   * - In {@link FILLMODE_FILL_WINDOW} mode, the canvas will simply fill the window, changing
   * aspect ratio.
   * - In {@link FILLMODE_NONE} mode, the canvas will always match the size provided.
   *
   * @param {number} [width] - The width of the canvas. Only used if current fill mode is {@link FILLMODE_NONE}.
   * @param {number} [height] - The height of the canvas. Only used if current fill mode is {@link FILLMODE_NONE}.
   * @returns {object} A object containing the values calculated to use as width and height.
   */
  resizeCanvas(width, height) {
    if (!this._allowResize) return undefined; // prevent resizing (e.g. if presenting in VR HMD)

    // prevent resizing when in XR session
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
    // OTHERWISE: FILLMODE_NONE use width and height that are provided

    this.graphicsDevice.canvas.style.width = width + 'px';
    this.graphicsDevice.canvas.style.height = height + 'px';
    this.updateCanvasSize();

    // return the final values calculated for width and height
    return {
      width: width,
      height: height
    };
  }

  /**
   * Updates the {@link GraphicsDevice} canvas size to match the canvas size on the document
   * page. It is recommended to call this function when the canvas size changes (e.g on window
   * resize and orientation change events) so that the canvas resolution is immediately updated.
   */
  updateCanvasSize() {
    var _this$xr;
    // Don't update if we are in VR or XR
    if (!this._allowResize || (_this$xr = this.xr) != null && _this$xr.active) {
      return;
    }

    // In AUTO mode the resolution is changed to match the canvas size
    if (this._resolutionMode === RESOLUTION_AUTO) {
      // Check if the canvas DOM has changed size
      const canvas = this.graphicsDevice.canvas;
      this.graphicsDevice.resizeCanvas(canvas.clientWidth, canvas.clientHeight);
    }
  }

  /**
   * Event handler called when all code libraries have been loaded. Code libraries are passed
   * into the constructor of the Application and the application won't start running or load
   * packs until all libraries have been loaded.
   *
   * @private
   */
  onLibrariesLoaded() {
    this._librariesLoaded = true;
    if (this.systems.rigidbody) {
      this.systems.rigidbody.onLibraryLoaded();
    }
  }

  /**
   * Apply scene settings to the current scene. Useful when your scene settings are parsed or
   * generated from a non-URL source.
   *
   * @param {object} settings - The scene settings to be applied.
   * @param {object} settings.physics - The physics settings to be applied.
   * @param {number[]} settings.physics.gravity - The world space vector representing global
   * gravity in the physics simulation. Must be a fixed size array with three number elements,
   * corresponding to each axis [ X, Y, Z ].
   * @param {object} settings.render - The rendering settings to be applied.
   * @param {number[]} settings.render.global_ambient - The color of the scene's ambient light.
   * Must be a fixed size array with three number elements, corresponding to each color channel
   * [ R, G, B ].
   * @param {string} settings.render.fog - The type of fog used by the scene. Can be:
   *
   * - {@link FOG_NONE}
   * - {@link FOG_LINEAR}
   * - {@link FOG_EXP}
   * - {@link FOG_EXP2}
   *
   * @param {number[]} settings.render.fog_color - The color of the fog (if enabled). Must be a
   * fixed size array with three number elements, corresponding to each color channel [ R, G, B ].
   * @param {number} settings.render.fog_density - The density of the fog (if enabled). This
   * property is only valid if the fog property is set to {@link FOG_EXP} or {@link FOG_EXP2}.
   * @param {number} settings.render.fog_start - The distance from the viewpoint where linear fog
   * begins. This property is only valid if the fog property is set to {@link FOG_LINEAR}.
   * @param {number} settings.render.fog_end - The distance from the viewpoint where linear fog
   * reaches its maximum. This property is only valid if the fog property is set to {@link FOG_LINEAR}.
   * @param {number} settings.render.gamma_correction - The gamma correction to apply when
   * rendering the scene. Can be:
   *
   * - {@link GAMMA_NONE}
   * - {@link GAMMA_SRGB}
   *
   * @param {number} settings.render.tonemapping - The tonemapping transform to apply when
   * writing fragments to the frame buffer. Can be:
   *
   * - {@link TONEMAP_LINEAR}
   * - {@link TONEMAP_FILMIC}
   * - {@link TONEMAP_HEJL}
   * - {@link TONEMAP_ACES}
   *
   * @param {number} settings.render.exposure - The exposure value tweaks the overall brightness
   * of the scene.
   * @param {number|null} [settings.render.skybox] - The asset ID of the cube map texture to be
   * used as the scene's skybox. Defaults to null.
   * @param {number} settings.render.skyboxIntensity - Multiplier for skybox intensity.
   * @param {number} settings.render.skyboxLuminance - Lux (lm/m^2) value for skybox intensity when physical light units are enabled.
   * @param {number} settings.render.skyboxMip - The mip level of the skybox to be displayed.
   * Only valid for prefiltered cubemap skyboxes.
   * @param {number[]} settings.render.skyboxRotation - Rotation of skybox.
   * @param {number} settings.render.lightmapSizeMultiplier - The lightmap resolution multiplier.
   * @param {number} settings.render.lightmapMaxResolution - The maximum lightmap resolution.
   * @param {number} settings.render.lightmapMode - The lightmap baking mode. Can be:
   *
   * - {@link BAKE_COLOR}: single color lightmap
   * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for bump/specular)
   *
   * @param {boolean} settings.render.ambientBake - Enable baking ambient light into lightmaps.
   * @param {number} settings.render.ambientBakeNumSamples - Number of samples to use when baking ambient light.
   * @param {number} settings.render.ambientBakeSpherePart - How much of the sphere to include when baking ambient light.
   * @param {number} settings.render.ambientBakeOcclusionBrightness - Brighness of the baked ambient occlusion.
   * @param {number} settings.render.ambientBakeOcclusionContrast - Contrast of the baked ambient occlusion.
   * @param {number} settings.render.ambientLuminance - Lux (lm/m^2) value for ambient light intensity.
   *
   * @param {boolean} settings.render.clusteredLightingEnabled - Enable clustered lighting.
   * @param {boolean} settings.render.lightingShadowsEnabled - If set to true, the clustered lighting will support shadows.
   * @param {boolean} settings.render.lightingCookiesEnabled - If set to true, the clustered lighting will support cookie textures.
   * @param {boolean} settings.render.lightingAreaLightsEnabled - If set to true, the clustered lighting will support area lights.
   * @param {number} settings.render.lightingShadowAtlasResolution - Resolution of the atlas texture storing all non-directional shadow textures.
   * @param {number} settings.render.lightingCookieAtlasResolution - Resolution of the atlas texture storing all non-directional cookie textures.
   * @param {number} settings.render.lightingMaxLightsPerCell - Maximum number of lights a cell can store.
   * @param {number} settings.render.lightingShadowType - The type of shadow filtering used by all shadows. Can be:
   *
   * - {@link SHADOW_PCF1}: PCF 1x1 sampling.
   * - {@link SHADOW_PCF3}: PCF 3x3 sampling.
   * - {@link SHADOW_PCF5}: PCF 5x5 sampling. Falls back to {@link SHADOW_PCF3} on WebGL 1.0.
   *
   * @param {Vec3} settings.render.lightingCells - Number of cells along each world-space axis the space containing lights
   * is subdivided into.
   *
   * Only lights with bakeDir=true will be used for generating the dominant light direction.
   * @example
   *
   * var settings = {
   *     physics: {
   *         gravity: [0, -9.8, 0]
   *     },
   *     render: {
   *         fog_end: 1000,
   *         tonemapping: 0,
   *         skybox: null,
   *         fog_density: 0.01,
   *         gamma_correction: 1,
   *         exposure: 1,
   *         fog_start: 1,
   *         global_ambient: [0, 0, 0],
   *         skyboxIntensity: 1,
   *         skyboxRotation: [0, 0, 0],
   *         fog_color: [0, 0, 0],
   *         lightmapMode: 1,
   *         fog: 'none',
   *         lightmapMaxResolution: 2048,
   *         skyboxMip: 2,
   *         lightmapSizeMultiplier: 16
   *     }
   * };
   * app.applySceneSettings(settings);
   */
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

  /**
   * Sets the area light LUT tables for this app.
   *
   * @param {number[]} ltcMat1 - LUT table of type `array` to be set.
   * @param {number[]} ltcMat2 - LUT table of type `array` to be set.
   */
  setAreaLightLuts(ltcMat1, ltcMat2) {
    if (ltcMat1 && ltcMat2) {
      AreaLightLuts.set(this.graphicsDevice, ltcMat1, ltcMat2);
    } else {
      Debug.warn("setAreaLightLuts: LUTs for area light are not valid");
    }
  }

  /**
   * Sets the skybox asset to current scene, and subscribes to asset load/change events.
   *
   * @param {Asset} asset - Asset of type `skybox` to be set to, or null to remove skybox.
   */
  setSkybox(asset) {
    if (asset !== this._skyboxAsset) {
      const onSkyboxRemoved = () => {
        this.setSkybox(null);
      };
      const onSkyboxChanged = () => {
        this.scene.setSkybox(this._skyboxAsset ? this._skyboxAsset.resources : null);
      };

      // cleanup previous asset
      if (this._skyboxAsset) {
        this.assets.off('load:' + this._skyboxAsset.id, onSkyboxChanged, this);
        this.assets.off('remove:' + this._skyboxAsset.id, onSkyboxRemoved, this);
        this._skyboxAsset.off('change', onSkyboxChanged, this);
      }

      // set new asset
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

  /** @private */
  _firstBake() {
    var _this$lightmapper;
    (_this$lightmapper = this.lightmapper) == null ? void 0 : _this$lightmapper.bake(null, this.scene.lightmapMode);
  }

  /** @private */
  _firstBatch() {
    var _this$batcher;
    (_this$batcher = this.batcher) == null ? void 0 : _this$batcher.generate();
  }

  /**
   * Provide an opportunity to modify the timestamp supplied by requestAnimationFrame.
   *
   * @param {number} [timestamp] - The timestamp supplied by requestAnimationFrame.
   * @returns {number|undefined} The modified timestamp.
   * @ignore
   */
  _processTimestamp(timestamp) {
    return timestamp;
  }

  /**
   * Draws a single line. Line start and end coordinates are specified in world-space. The line
   * will be flat-shaded with the specified color.
   *
   * @param {Vec3} start - The start world-space coordinate of the line.
   * @param {Vec3} end - The end world-space coordinate of the line.
   * @param {Color} [color] - The color of the line. It defaults to white if not specified.
   * @param {boolean} [depthTest] - Specifies if the line is depth tested against the depth
   * buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the line into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @example
   * // Render a 1-unit long white line
   * var start = new pc.Vec3(0, 0, 0);
   * var end = new pc.Vec3(1, 0, 0);
   * app.drawLine(start, end);
   * @example
   * // Render a 1-unit long red line which is not depth tested and renders on top of other geometry
   * var start = new pc.Vec3(0, 0, 0);
   * var end = new pc.Vec3(1, 0, 0);
   * app.drawLine(start, end, pc.Color.RED, false);
   * @example
   * // Render a 1-unit long white line into the world layer
   * var start = new pc.Vec3(0, 0, 0);
   * var end = new pc.Vec3(1, 0, 0);
   * var worldLayer = app.scene.layers.getLayerById(pc.LAYERID_WORLD);
   * app.drawLine(start, end, pc.Color.WHITE, true, worldLayer);
   */
  drawLine(start, end, color, depthTest, layer) {
    this.scene.drawLine(start, end, color, depthTest, layer);
  }

  /**
   * Renders an arbitrary number of discrete line segments. The lines are not connected by each
   * subsequent point in the array. Instead, they are individual segments specified by two
   * points. Therefore, the lengths of the supplied position and color arrays must be the same
   * and also must be a multiple of 2. The colors of the ends of each line segment will be
   * interpolated along the length of each line.
   *
   * @param {Vec3[]} positions - An array of points to draw lines between. The length of the
   * array must be a multiple of 2.
   * @param {Color[]} colors - An array of colors to color the lines. This must be the same
   * length as the position array. The length of the array must also be a multiple of 2.
   * @param {boolean} [depthTest] - Specifies if the lines are depth tested against the depth
   * buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the lines into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @example
   * // Render a single line, with unique colors for each point
   * var start = new pc.Vec3(0, 0, 0);
   * var end = new pc.Vec3(1, 0, 0);
   * app.drawLines([start, end], [pc.Color.RED, pc.Color.WHITE]);
   * @example
   * // Render 2 discrete line segments
   * var points = [
   *     // Line 1
   *     new pc.Vec3(0, 0, 0),
   *     new pc.Vec3(1, 0, 0),
   *     // Line 2
   *     new pc.Vec3(1, 1, 0),
   *     new pc.Vec3(1, 1, 1)
   * ];
   * var colors = [
   *     // Line 1
   *     pc.Color.RED,
   *     pc.Color.YELLOW,
   *     // Line 2
   *     pc.Color.CYAN,
   *     pc.Color.BLUE
   * ];
   * app.drawLines(points, colors);
   */
  drawLines(positions, colors, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.drawLines(positions, colors, depthTest, layer);
  }

  /**
   * Renders an arbitrary number of discrete line segments. The lines are not connected by each
   * subsequent point in the array. Instead, they are individual segments specified by two
   * points.
   *
   * @param {number[]} positions - An array of points to draw lines between. Each point is
   * represented by 3 numbers - x, y and z coordinate.
   * @param {number[]} colors - An array of colors to color the lines. This must be the same
   * length as the position array. The length of the array must also be a multiple of 2.
   * @param {boolean} [depthTest] - Specifies if the lines are depth tested against the depth
   * buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the lines into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @example
   * // Render 2 discrete line segments
   * var points = [
   *     // Line 1
   *     0, 0, 0,
   *     1, 0, 0,
   *     // Line 2
   *     1, 1, 0,
   *     1, 1, 1
   * ];
   * var colors = [
   *     // Line 1
   *     1, 0, 0, 1,  // red
   *     0, 1, 0, 1,  // green
   *     // Line 2
   *     0, 0, 1, 1,  // blue
   *     1, 1, 1, 1   // white
   * ];
   * app.drawLineArrays(points, colors);
   */
  drawLineArrays(positions, colors, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.drawLineArrays(positions, colors, depthTest, layer);
  }

  /**
   * Draws a wireframe sphere with center, radius and color.
   *
   * @param {Vec3} center - The center of the sphere.
   * @param {number} radius - The radius of the sphere.
   * @param {Color} [color] - The color of the sphere. It defaults to white if not specified.
   * @param {number} [segments] - Number of line segments used to render the circles forming the
   * sphere. Defaults to 20.
   * @param {boolean} [depthTest] - Specifies if the sphere lines are depth tested against the
   * depth buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the sphere into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @example
   * // Render a red wire sphere with radius of 1
   * var center = new pc.Vec3(0, 0, 0);
   * app.drawWireSphere(center, 1.0, pc.Color.RED);
   * @ignore
   */
  drawWireSphere(center, radius, color = Color.WHITE, segments = 20, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawWireSphere(center, radius, color, segments, depthTest, layer);
  }

  /**
   * Draws a wireframe axis aligned box specified by min and max points and color.
   *
   * @param {Vec3} minPoint - The min corner point of the box.
   * @param {Vec3} maxPoint - The max corner point of the box.
   * @param {Color} [color] - The color of the sphere. It defaults to white if not specified.
   * @param {boolean} [depthTest] - Specifies if the sphere lines are depth tested against the
   * depth buffer. Defaults to true.
   * @param {Layer} [layer] - The layer to render the sphere into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @example
   * // Render a red wire aligned box
   * var min = new pc.Vec3(-1, -1, -1);
   * var max = new pc.Vec3(1, 1, 1);
   * app.drawWireAlignedBox(min, max, pc.Color.RED);
   * @ignore
   */
  drawWireAlignedBox(minPoint, maxPoint, color = Color.WHITE, depthTest = true, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawWireAlignedBox(minPoint, maxPoint, color, depthTest, layer);
  }

  /**
   * Draw meshInstance at this frame
   *
   * @param {import('../scene/mesh-instance.js').MeshInstance} meshInstance - The mesh instance
   * to draw.
   * @param {Layer} [layer] - The layer to render the mesh instance into. Defaults to
   * {@link LAYERID_IMMEDIATE}.
   * @ignore
   */
  drawMeshInstance(meshInstance, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawMesh(null, null, null, meshInstance, layer);
  }

  /**
   * Draw mesh at this frame.
   *
   * @param {import('../scene/mesh.js').Mesh} mesh - The mesh to draw.
   * @param {Material} material - The material to use to render the mesh.
   * @param {Mat4} matrix - The matrix to use to render the mesh.
   * @param {Layer} [layer] - The layer to render the mesh into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @ignore
   */
  drawMesh(mesh, material, matrix, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawMesh(material, matrix, mesh, null, layer);
  }

  /**
   * Draw quad of size [-0.5, 0.5] at this frame.
   *
   * @param {Mat4} matrix - The matrix to use to render the quad.
   * @param {Material} material - The material to use to render the quad.
   * @param {Layer} [layer] - The layer to render the quad into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @ignore
   */
  drawQuad(matrix, material, layer = this.scene.defaultDrawLayer) {
    this.scene.immediate.drawMesh(material, matrix, this.scene.immediate.getQuadMesh(), null, layer);
  }

  /**
   * Draws a texture at [x, y] position on screen, with size [width, height]. The origin of the
   * screen is top-left [0, 0]. Coordinates and sizes are in projected space (-1 .. 1).
   *
   * @param {number} x - The x coordinate on the screen of the top left corner of the texture.
   * Should be in the range [-1, 1].
   * @param {number} y - The y coordinate on the screen of the top left corner of the texture.
   * Should be in the range [-1, 1].
   * @param {number} width - The width of the rectangle of the rendered texture. Should be in the
   * range [0, 2].
   * @param {number} height - The height of the rectangle of the rendered texture. Should be in
   * the range [0, 2].
   * @param {import('../platform/graphics/texture.js').Texture} texture - The texture to render.
   * @param {Material} material - The material used when rendering the texture.
   * @param {Layer} [layer] - The layer to render the texture into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @ignore
   */
  drawTexture(x, y, width, height, texture, material, layer = this.scene.defaultDrawLayer) {
    // TODO: if this is used for anything other than debug texture display, we should optimize this to avoid allocations
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

  /**
   * Draws a depth texture at [x, y] position on screen, with size [width, height]. The origin of
   * the screen is top-left [0, 0]. Coordinates and sizes are in projected space (-1 .. 1).
   *
   * @param {number} x - The x coordinate on the screen of the top left corner of the texture.
   * Should be in the range [-1, 1].
   * @param {number} y - The y coordinate on the screen of the top left corner of the texture.
   * Should be in the range [-1, 1].
   * @param {number} width - The width of the rectangle of the rendered texture. Should be in the
   * range [0, 2].
   * @param {number} height - The height of the rectangle of the rendered texture. Should be in
   * the range [0, 2].
   * @param {Layer} [layer] - The layer to render the texture into. Defaults to {@link LAYERID_IMMEDIATE}.
   * @ignore
   */
  drawDepthTexture(x, y, width, height, layer = this.scene.defaultDrawLayer) {
    const material = new Material();
    material.shader = this.scene.immediate.getDepthTextureShader();
    material.update();
    this.drawTexture(x, y, width, height, null, material, layer);
  }

  /**
   * Destroys application and removes all event listeners at the end of the current engine frame
   * update. However, if called outside of the engine frame update, calling destroy() will
   * destroy the application immediately.
   *
   * @example
   * app.destroy();
   */
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

    // layer composition
    if (this.scene.layers) {
      this.scene.layers.destroy();
    }

    // destroy all texture resources
    const assets = this.assets.list();
    for (let i = 0; i < assets.length; i++) {
      assets[i].unload();
      assets[i].off();
    }
    this.assets.off();

    // destroy bundle registry
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

    // script registry
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
    this.off(); // remove all events

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

  /**
   * Get entity from the index by guid.
   *
   * @param {string} guid - The GUID to search for.
   * @returns {Entity} The Entity with the GUID or null.
   * @ignore
   */
  getEntityFromIndex(guid) {
    return this._entityIndex[guid];
  }

  /**
   * @param {Scene} scene - The scene.
   * @private
   */
  _registerSceneImmediate(scene) {
    this.on('postrender', scene.immediate.onPostRender, scene.immediate);
  }
}

// static data
AppBase._applications = {};
const _frameEndData = {};

/**
 * Callback used by {@link AppBase#start} and itself to request
 * the rendering of a new animation frame.
 *
 * @callback MakeTickCallback
 * @param {number} [timestamp] - The timestamp supplied by requestAnimationFrame.
 * @param {*} [frame] - XRFrame from requestAnimationFrame callback.
 * @ignore
 */

/**
 * Create tick function to be wrapped in closure.
 *
 * @param {AppBase} _app - The application.
 * @returns {MakeTickCallback} The tick function.
 * @private
 */
const makeTick = function makeTick(_app) {
  const application = _app;
  let frameRequest;
  /**
   * @param {number} [timestamp] - The timestamp supplied by requestAnimationFrame.
   * @param {*} [frame] - XRFrame from requestAnimationFrame callback.
   */
  return function (timestamp, frame) {
    var _application$xr;
    if (!application.graphicsDevice) return;
    setApplication(application);
    if (frameRequest) {
      window.cancelAnimationFrame(frameRequest);
      frameRequest = null;
    }

    // have current application pointer in pc
    app = application;
    const currentTime = application._processTimestamp(timestamp) || now();
    const ms = currentTime - (application._time || currentTime);
    let dt = ms / 1000.0;
    dt = math.clamp(dt, 0, application.maxDeltaTime);
    dt *= application.timeScale;
    application._time = currentTime;

    // Submit a request to queue up a new animation frame immediately
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
      Debug.trace(TRACEID_RENDER_FRAME, `---- Frame ${application.frame}`);
      Debug.trace(TRACEID_RENDER_FRAME_TIME, `-- UpdateStart ${now().toFixed(2)}ms`);
      application.update(dt);
      application.fire("framerender");
      if (application.autoRender || application.renderNextFrame) {
        Debug.trace(TRACEID_RENDER_FRAME_TIME, `-- RenderStart ${now().toFixed(2)}ms`);
        application.updateCanvasSize();
        application.render();
        application.renderNextFrame = false;
        Debug.trace(TRACEID_RENDER_FRAME_TIME, `-- RenderEnd ${now().toFixed(2)}ms`);
      }

      // set event data
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLWJhc2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLWJhc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gI2lmIF9ERUJVR1xuaW1wb3J0IHsgdmVyc2lvbiwgcmV2aXNpb24gfSBmcm9tICcuLi9jb3JlL2NvcmUuanMnO1xuLy8gI2VuZGlmXG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgVFJBQ0VJRF9SRU5ERVJfRlJBTUUsIFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUgfSBmcm9tICcuLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi9wbGF0Zm9ybS9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9ERVBUSCwgTEFZRVJJRF9JTU1FRElBVEUsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX1dPUkxELFxuICAgIFNPUlRNT0RFX05PTkUsIFNPUlRNT0RFX01BTlVBTCwgU1BFQ1VMQVJfQkxJTk5cbn0gZnJvbSAnLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IHNldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH0gZnJvbSAnLi4vc2NlbmUvcmVuZGVyZXIvZm9yd2FyZC1yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBGcmFtZUdyYXBoIH0gZnJvbSAnLi4vc2NlbmUvZnJhbWUtZ3JhcGguanMnO1xuaW1wb3J0IHsgQXJlYUxpZ2h0THV0cyB9IGZyb20gJy4uL3NjZW5lL2FyZWEtbGlnaHQtbHV0cy5qcyc7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4uL3NjZW5lL2xheWVyLmpzJztcbmltcG9ydCB7IExheWVyQ29tcG9zaXRpb24gfSBmcm9tICcuLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBTY2VuZSB9IGZyb20gJy4uL3NjZW5lL3NjZW5lLmpzJztcbmltcG9ydCB7IE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcbmltcG9ydCB7IExpZ2h0c0J1ZmZlciB9IGZyb20gJy4uL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBzZXREZWZhdWx0TWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi9hc3NldC9hc3NldC5qcyc7XG5pbXBvcnQgeyBBc3NldFJlZ2lzdHJ5IH0gZnJvbSAnLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBCdW5kbGVSZWdpc3RyeSB9IGZyb20gJy4vYnVuZGxlL2J1bmRsZS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSB9IGZyb20gJy4vY29tcG9uZW50cy9yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBTY2VuZUdyYWIgfSBmcm9tICcuLi9zY2VuZS9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcbmltcG9ydCB7IEJ1bmRsZUhhbmRsZXIgfSBmcm9tICcuL2hhbmRsZXJzL2J1bmRsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxvYWRlciB9IGZyb20gJy4vaGFuZGxlcnMvbG9hZGVyLmpzJztcbmltcG9ydCB7IEkxOG4gfSBmcm9tICcuL2kxOG4vaTE4bi5qcyc7XG5pbXBvcnQgeyBTY3JpcHRSZWdpc3RyeSB9IGZyb20gJy4vc2NyaXB0L3NjcmlwdC1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBTY2VuZVJlZ2lzdHJ5IH0gZnJvbSAnLi9zY2VuZS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBzY3JpcHQgfSBmcm9tICcuL3NjcmlwdC5qcyc7XG5pbXBvcnQgeyBBcHBsaWNhdGlvblN0YXRzIH0gZnJvbSAnLi9zdGF0cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgRklMTE1PREVfRklMTF9XSU5ET1csIEZJTExNT0RFX0tFRVBfQVNQRUNULFxuICAgIFJFU09MVVRJT05fQVVUTywgUkVTT0xVVElPTl9GSVhFRFxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgZ2V0QXBwbGljYXRpb24sXG4gICAgc2V0QXBwbGljYXRpb25cbn0gZnJvbSAnLi9nbG9iYWxzLmpzJztcblxuLy8gTWluaS1vYmplY3QgdXNlZCB0byBtZWFzdXJlIHByb2dyZXNzIG9mIGxvYWRpbmcgc2V0c1xuY2xhc3MgUHJvZ3Jlc3Mge1xuICAgIGNvbnN0cnVjdG9yKGxlbmd0aCkge1xuICAgICAgICB0aGlzLmxlbmd0aCA9IGxlbmd0aDtcbiAgICAgICAgdGhpcy5jb3VudCA9IDA7XG4gICAgfVxuXG4gICAgaW5jKCkge1xuICAgICAgICB0aGlzLmNvdW50Kys7XG4gICAgfVxuXG4gICAgZG9uZSgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmNvdW50ID09PSB0aGlzLmxlbmd0aCk7XG4gICAgfVxufVxuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEFwcEJhc2UjY29uZmlndXJlfSB3aGVuIGNvbmZpZ3VyYXRpb24gZmlsZSBpcyBsb2FkZWQgYW5kIHBhcnNlZCAob3JcbiAqIGFuIGVycm9yIG9jY3VycykuXG4gKlxuICogQGNhbGxiYWNrIENvbmZpZ3VyZUFwcENhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgbG9hZGluZyBvciBwYXJzaW5nIGZhaWxzLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNwcmVsb2FkfSB3aGVuIGFsbCBhc3NldHMgKG1hcmtlZCBhcyAncHJlbG9hZCcpIGFyZSBsb2FkZWQuXG4gKlxuICogQGNhbGxiYWNrIFByZWxvYWRBcHBDYWxsYmFja1xuICovXG5cbmxldCBhcHAgPSBudWxsO1xuXG4vKipcbiAqIEFuIEFwcGxpY2F0aW9uIHJlcHJlc2VudHMgYW5kIG1hbmFnZXMgeW91ciBQbGF5Q2FudmFzIGFwcGxpY2F0aW9uLiBJZiB5b3UgYXJlIGRldmVsb3BpbmcgdXNpbmdcbiAqIHRoZSBQbGF5Q2FudmFzIEVkaXRvciwgdGhlIEFwcGxpY2F0aW9uIGlzIGNyZWF0ZWQgZm9yIHlvdS4gWW91IGNhbiBhY2Nlc3MgeW91ciBBcHBsaWNhdGlvblxuICogaW5zdGFuY2UgaW4geW91ciBzY3JpcHRzLiBCZWxvdyBpcyBhIHNrZWxldG9uIHNjcmlwdCB3aGljaCBzaG93cyBob3cgeW91IGNhbiBhY2Nlc3MgdGhlXG4gKiBhcHBsaWNhdGlvbiAnYXBwJyBwcm9wZXJ0eSBpbnNpZGUgdGhlIGluaXRpYWxpemUgYW5kIHVwZGF0ZSBmdW5jdGlvbnM6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gRWRpdG9yIGV4YW1wbGU6IGFjY2Vzc2luZyB0aGUgcGMuQXBwbGljYXRpb24gZnJvbSBhIHNjcmlwdFxuICogdmFyIE15U2NyaXB0ID0gcGMuY3JlYXRlU2NyaXB0KCdteVNjcmlwdCcpO1xuICpcbiAqIE15U2NyaXB0LnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24oKSB7XG4gKiAgICAgLy8gRXZlcnkgc2NyaXB0IGluc3RhbmNlIGhhcyBhIHByb3BlcnR5ICd0aGlzLmFwcCcgYWNjZXNzaWJsZSBpbiB0aGUgaW5pdGlhbGl6ZS4uLlxuICogICAgIHZhciBhcHAgPSB0aGlzLmFwcDtcbiAqIH07XG4gKlxuICogTXlTY3JpcHQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKGR0KSB7XG4gKiAgICAgLy8gLi4uYW5kIHVwZGF0ZSBmdW5jdGlvbnMuXG4gKiAgICAgdmFyIGFwcCA9IHRoaXMuYXBwO1xuICogfTtcbiAqIGBgYFxuICpcbiAqIElmIHlvdSBhcmUgdXNpbmcgdGhlIEVuZ2luZSB3aXRob3V0IHRoZSBFZGl0b3IsIHlvdSBoYXZlIHRvIGNyZWF0ZSB0aGUgYXBwbGljYXRpb24gaW5zdGFuY2VcbiAqIG1hbnVhbGx5LlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgQXBwQmFzZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEFwcEJhc2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxDYW52YXNFbGVtZW50fSBjYW52YXMgLSBUaGUgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBFbmdpbmUtb25seSBleGFtcGxlOiBjcmVhdGUgdGhlIGFwcGxpY2F0aW9uIG1hbnVhbGx5XG4gICAgICogdmFyIG9wdGlvbnMgPSBuZXcgQXBwT3B0aW9ucygpO1xuICAgICAqIHZhciBhcHAgPSBuZXcgcGMuQXBwQmFzZShjYW52YXMpO1xuICAgICAqIGFwcC5pbml0KG9wdGlvbnMpO1xuICAgICAqXG4gICAgICogLy8gU3RhcnQgdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wXG4gICAgICogYXBwLnN0YXJ0KCk7XG4gICAgICpcbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY2FudmFzKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodmVyc2lvbj8uaW5kZXhPZignJCcpIDwgMCkge1xuICAgICAgICAgICAgRGVidWcubG9nKGBQb3dlcmVkIGJ5IFBsYXlDYW52YXMgJHt2ZXJzaW9ufSAke3JldmlzaW9ufWApO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIFN0b3JlIGFwcGxpY2F0aW9uIGluc3RhbmNlXG4gICAgICAgIEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tjYW52YXMuaWRdID0gdGhpcztcbiAgICAgICAgc2V0QXBwbGljYXRpb24odGhpcyk7XG5cbiAgICAgICAgYXBwID0gdGhpcztcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9pbkZyYW1lVXBkYXRlID0gZmFsc2U7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3RpbWUgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTY2FsZXMgdGhlIGdsb2JhbCB0aW1lIGRlbHRhLiBEZWZhdWx0cyB0byAxLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgdGhlIGFwcCB0byBydW4gYXQgaGFsZiBzcGVlZFxuICAgICAgICAgKiB0aGlzLmFwcC50aW1lU2NhbGUgPSAwLjU7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRpbWVTY2FsZSA9IDE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENsYW1wcyBwZXItZnJhbWUgZGVsdGEgdGltZSB0byBhbiB1cHBlciBib3VuZC4gVXNlZnVsIHNpbmNlIHJldHVybmluZyBmcm9tIGEgdGFiXG4gICAgICAgICAqIGRlYWN0aXZhdGlvbiBjYW4gZ2VuZXJhdGUgaHVnZSB2YWx1ZXMgZm9yIGR0LCB3aGljaCBjYW4gYWR2ZXJzZWx5IGFmZmVjdCBnYW1lIHN0YXRlLlxuICAgICAgICAgKiBEZWZhdWx0cyB0byAwLjEgKHNlY29uZHMpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBEb24ndCBjbGFtcCBpbnRlci1mcmFtZSB0aW1lcyBvZiAyMDBtcyBvciBsZXNzXG4gICAgICAgICAqIHRoaXMuYXBwLm1heERlbHRhVGltZSA9IDAuMjtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWF4RGVsdGFUaW1lID0gMC4xOyAvLyBNYXhpbXVtIGRlbHRhIGlzIDAuMXMgb3IgMTAgZnBzLlxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgbnVtYmVyIG9mIGZyYW1lcyB0aGUgYXBwbGljYXRpb24gaGFzIHVwZGF0ZWQgc2luY2Ugc3RhcnQoKSB3YXMgY2FsbGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmZyYW1lID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogV2hlbiB0cnVlLCB0aGUgYXBwbGljYXRpb24ncyByZW5kZXIgZnVuY3Rpb24gaXMgY2FsbGVkIGV2ZXJ5IGZyYW1lLiBTZXR0aW5nIGF1dG9SZW5kZXJcbiAgICAgICAgICogdG8gZmFsc2UgaXMgdXNlZnVsIHRvIGFwcGxpY2F0aW9ucyB3aGVyZSB0aGUgcmVuZGVyZWQgaW1hZ2UgbWF5IG9mdGVuIGJlIHVuY2hhbmdlZCBvdmVyXG4gICAgICAgICAqIHRpbWUuIFRoaXMgY2FuIGhlYXZpbHkgcmVkdWNlIHRoZSBhcHBsaWNhdGlvbidzIGxvYWQgb24gdGhlIENQVSBhbmQgR1BVLiBEZWZhdWx0cyB0b1xuICAgICAgICAgKiB0cnVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gRGlzYWJsZSByZW5kZXJpbmcgZXZlcnkgZnJhbWUgYW5kIG9ubHkgcmVuZGVyIG9uIGEga2V5ZG93biBldmVudFxuICAgICAgICAgKiB0aGlzLmFwcC5hdXRvUmVuZGVyID0gZmFsc2U7XG4gICAgICAgICAqIHRoaXMuYXBwLmtleWJvYXJkLm9uKCdrZXlkb3duJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAqICAgICB0aGlzLmFwcC5yZW5kZXJOZXh0RnJhbWUgPSB0cnVlO1xuICAgICAgICAgKiB9LCB0aGlzKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXV0b1JlbmRlciA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCB0byB0cnVlIHRvIHJlbmRlciB0aGUgc2NlbmUgb24gdGhlIG5leHQgaXRlcmF0aW9uIG9mIHRoZSBtYWluIGxvb3AuIFRoaXMgb25seSBoYXMgYW5cbiAgICAgICAgICogZWZmZWN0IGlmIHtAbGluayBBcHBCYXNlI2F1dG9SZW5kZXJ9IGlzIHNldCB0byBmYWxzZS4gVGhlIHZhbHVlIG9mIHJlbmRlck5leHRGcmFtZVxuICAgICAgICAgKiBpcyBzZXQgYmFjayB0byBmYWxzZSBhZ2FpbiBhcyBzb29uIGFzIHRoZSBzY2VuZSBoYXMgYmVlbiByZW5kZXJlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFJlbmRlciB0aGUgc2NlbmUgb25seSB3aGlsZSBzcGFjZSBrZXkgaXMgcHJlc3NlZFxuICAgICAgICAgKiBpZiAodGhpcy5hcHAua2V5Ym9hcmQuaXNQcmVzc2VkKHBjLktFWV9TUEFDRSkpIHtcbiAgICAgICAgICogICAgIHRoaXMuYXBwLnJlbmRlck5leHRGcmFtZSA9IHRydWU7XG4gICAgICAgICAqIH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVuZGVyTmV4dEZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEVuYWJsZSBpZiB5b3Ugd2FudCBlbnRpdHkgdHlwZSBzY3JpcHQgYXR0cmlidXRlcyB0byBub3QgYmUgcmUtbWFwcGVkIHdoZW4gYW4gZW50aXR5IGlzXG4gICAgICAgICAqIGNsb25lZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyA9IHNjcmlwdC5sZWdhY3k7XG5cbiAgICAgICAgdGhpcy5fbGlicmFyaWVzTG9hZGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZpbGxNb2RlID0gRklMTE1PREVfS0VFUF9BU1BFQ1Q7XG4gICAgICAgIHRoaXMuX3Jlc29sdXRpb25Nb2RlID0gUkVTT0xVVElPTl9GSVhFRDtcbiAgICAgICAgdGhpcy5fYWxsb3dSZXNpemUgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBzY3JpcHRzIDEuMC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0FwcEJhc2V9XG4gICAgICAgICAqIEBkZXByZWNhdGVkXG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgYXBwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYXBwLW9wdGlvbnMuanMnKS5BcHBPcHRpb25zfSBhcHBPcHRpb25zIC0gT3B0aW9ucyBzcGVjaWZ5aW5nIHRoZSBpbml0XG4gICAgICogcGFyYW1ldGVycyBmb3IgdGhlIGFwcC5cbiAgICAgKi9cbiAgICBpbml0KGFwcE9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gYXBwT3B0aW9ucy5ncmFwaGljc0RldmljZTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoZGV2aWNlLCBcIlRoZSBhcHBsaWNhdGlvbiBjYW5ub3QgYmUgY3JlYXRlZCB3aXRob3V0IGEgdmFsaWQgR3JhcGhpY3NEZXZpY2VcIik7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZSA9IGRldmljZTtcbiAgICAgICAgR3JhcGhpY3NEZXZpY2VBY2Nlc3Muc2V0KGRldmljZSk7XG5cbiAgICAgICAgdGhpcy5faW5pdERlZmF1bHRNYXRlcmlhbCgpO1xuICAgICAgICB0aGlzLl9pbml0UHJvZ3JhbUxpYnJhcnkoKTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IG5ldyBBcHBsaWNhdGlvblN0YXRzKGRldmljZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL3NvdW5kL21hbmFnZXIuanMnKS5Tb3VuZE1hbmFnZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIgPSBhcHBPcHRpb25zLnNvdW5kTWFuYWdlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJlc291cmNlIGxvYWRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1Jlc291cmNlTG9hZGVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2FkZXIgPSBuZXcgUmVzb3VyY2VMb2FkZXIodGhpcyk7XG5cbiAgICAgICAgTGlnaHRzQnVmZmVyLmluaXQoZGV2aWNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmVzIGFsbCBlbnRpdGllcyB0aGF0IGhhdmUgYmVlbiBjcmVhdGVkIGZvciB0aGlzIGFwcCBieSBndWlkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgRW50aXR5Pn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZW50aXR5SW5kZXggPSB7fTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNjZW5lIG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NlbmV9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCB0aGUgdG9uZSBtYXBwaW5nIHByb3BlcnR5IG9mIHRoZSBhcHBsaWNhdGlvbidzIHNjZW5lXG4gICAgICAgICAqIHRoaXMuYXBwLnNjZW5lLnRvbmVNYXBwaW5nID0gcGMuVE9ORU1BUF9GSUxNSUM7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjZW5lID0gbmV3IFNjZW5lKGRldmljZSk7XG4gICAgICAgIHRoaXMuX3JlZ2lzdGVyU2NlbmVJbW1lZGlhdGUodGhpcy5zY2VuZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSByb290IGVudGl0eSBvZiB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFJldHVybiB0aGUgZmlyc3QgZW50aXR5IGNhbGxlZCAnQ2FtZXJhJyBpbiBhIGRlcHRoLWZpcnN0IHNlYXJjaCBvZiB0aGUgc2NlbmUgaGllcmFyY2h5XG4gICAgICAgICAqIHZhciBjYW1lcmEgPSB0aGlzLmFwcC5yb290LmZpbmRCeU5hbWUoJ0NhbWVyYScpO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yb290ID0gbmV3IEVudGl0eSgpO1xuICAgICAgICB0aGlzLnJvb3QuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhc3NldCByZWdpc3RyeSBtYW5hZ2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Fzc2V0UmVnaXN0cnl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNlYXJjaCB0aGUgYXNzZXQgcmVnaXN0cnkgZm9yIGFsbCBhc3NldHMgd2l0aCB0aGUgdGFnICd2ZWhpY2xlJ1xuICAgICAgICAgKiB2YXIgdmVoaWNsZUFzc2V0cyA9IHRoaXMuYXBwLmFzc2V0cy5maW5kQnlUYWcoJ3ZlaGljbGUnKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXNzZXRzID0gbmV3IEFzc2V0UmVnaXN0cnkodGhpcy5sb2FkZXIpO1xuICAgICAgICBpZiAoYXBwT3B0aW9ucy5hc3NldFByZWZpeCkgdGhpcy5hc3NldHMucHJlZml4ID0gYXBwT3B0aW9ucy5hc3NldFByZWZpeDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0J1bmRsZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmJ1bmRsZXMgPSBuZXcgQnVuZGxlUmVnaXN0cnkodGhpcy5hc3NldHMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgdGhpcyB0byBmYWxzZSBpZiB5b3Ugd2FudCB0byBydW4gd2l0aG91dCB1c2luZyBidW5kbGVzLiBXZSBzZXQgaXQgdG8gdHJ1ZSBvbmx5IGlmXG4gICAgICAgICAqIFRleHREZWNvZGVyIGlzIGF2YWlsYWJsZSBiZWNhdXNlIHdlIGN1cnJlbnRseSByZWx5IG9uIGl0IGZvciB1bnRhcnJpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVuYWJsZUJ1bmRsZXMgPSAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJyk7XG5cbiAgICAgICAgdGhpcy5zY3JpcHRzT3JkZXIgPSBhcHBPcHRpb25zLnNjcmlwdHNPcmRlciB8fCBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uJ3Mgc2NyaXB0IHJlZ2lzdHJ5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NyaXB0UmVnaXN0cnl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBuZXcgU2NyaXB0UmVnaXN0cnkodGhpcyk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXMgbG9jYWxpemF0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7STE4bn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaTE4biA9IG5ldyBJMThuKHRoaXMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2NlbmUgcmVnaXN0cnkgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTY2VuZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZWFyY2ggdGhlIHNjZW5lIHJlZ2lzdHJ5IGZvciBhIGl0ZW0gd2l0aCB0aGUgbmFtZSAncmFjZXRyYWNrMSdcbiAgICAgICAgICogdmFyIHNjZW5lSXRlbSA9IHRoaXMuYXBwLnNjZW5lcy5maW5kKCdyYWNldHJhY2sxJyk7XG4gICAgICAgICAqXG4gICAgICAgICAqIC8vIExvYWQgdGhlIHNjZW5lIHVzaW5nIHRoZSBpdGVtJ3MgdXJsXG4gICAgICAgICAqIHRoaXMuYXBwLnNjZW5lcy5sb2FkU2NlbmUoc2NlbmVJdGVtLnVybCk7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjZW5lcyA9IG5ldyBTY2VuZVJlZ2lzdHJ5KHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllcldvcmxkID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIG5hbWU6IFwiV29ybGRcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX1dPUkxEXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuc2NlbmVHcmFiID0gbmV3IFNjZW5lR3JhYih0aGlzLmdyYXBoaWNzRGV2aWNlLCB0aGlzLnNjZW5lKTtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aCA9IHRoaXMuc2NlbmVHcmFiLmxheWVyO1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyU2t5Ym94ID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiBcIlNreWJveFwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfU0tZQk9YLFxuICAgICAgICAgICAgb3BhcXVlU29ydE1vZGU6IFNPUlRNT0RFX05PTkVcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyVWkgPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG5hbWU6IFwiVUlcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX1VJLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnRTb3J0TW9kZTogU09SVE1PREVfTUFOVUFMLFxuICAgICAgICAgICAgcGFzc1Rocm91Z2g6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSA9IG5ldyBMYXllcih7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbmFtZTogXCJJbW1lZGlhdGVcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX0lNTUVESUFURSxcbiAgICAgICAgICAgIG9wYXF1ZVNvcnRNb2RlOiBTT1JUTU9ERV9OT05FLFxuICAgICAgICAgICAgcGFzc1Rocm91Z2g6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZGVmYXVsdExheWVyQ29tcG9zaXRpb24gPSBuZXcgTGF5ZXJDb21wb3NpdGlvbihcImRlZmF1bHRcIik7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJXb3JsZCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJEZXB0aCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJTa3lib3gpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQodGhpcy5kZWZhdWx0TGF5ZXJXb3JsZCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQodGhpcy5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQodGhpcy5kZWZhdWx0TGF5ZXJVaSk7XG4gICAgICAgIHRoaXMuc2NlbmUubGF5ZXJzID0gZGVmYXVsdExheWVyQ29tcG9zaXRpb247XG5cbiAgICAgICAgLy8gRGVmYXVsdCBsYXllcnMgcGF0Y2hcbiAgICAgICAgdGhpcy5zY2VuZS5vbignc2V0OmxheWVycycsIGZ1bmN0aW9uIChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgICAgICBjb25zdCBsaXN0ID0gbmV3Q29tcC5sYXllckxpc3Q7XG4gICAgICAgICAgICBsZXQgbGF5ZXI7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsYXllciA9IGxpc3RbaV07XG4gICAgICAgICAgICAgICAgc3dpdGNoIChsYXllci5pZCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIExBWUVSSURfREVQVEg6XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNjZW5lR3JhYi5wYXRjaChsYXllcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBMQVlFUklEX1VJOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIucGFzc1Rocm91Z2ggPSBzZWxmLmRlZmF1bHRMYXllclVpLnBhc3NUaHJvdWdoO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTEFZRVJJRF9JTU1FRElBVEU6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5wYXNzVGhyb3VnaCA9IHNlbGYuZGVmYXVsdExheWVySW1tZWRpYXRlLnBhc3NUaHJvdWdoO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBwbGFjZWhvbGRlciB0ZXh0dXJlIGZvciBhcmVhIGxpZ2h0IExVVHNcbiAgICAgICAgQXJlYUxpZ2h0THV0cy5jcmVhdGVQbGFjZWhvbGRlcihkZXZpY2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZm9yd2FyZCByZW5kZXJlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0ZvcndhcmRSZW5kZXJlcn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IG5ldyBGb3J3YXJkUmVuZGVyZXIoZGV2aWNlKTtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zY2VuZSA9IHRoaXMuc2NlbmU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBmcmFtZSBncmFwaC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0ZyYW1lR3JhcGh9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZnJhbWVHcmFwaCA9IG5ldyBGcmFtZUdyYXBoKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBydW4tdGltZSBsaWdodG1hcHBlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9saWdodG1hcHBlci9saWdodG1hcHBlci5qcycpLkxpZ2h0bWFwcGVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG51bGw7XG4gICAgICAgIGlmIChhcHBPcHRpb25zLmxpZ2h0bWFwcGVyKSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyID0gbmV3IGFwcE9wdGlvbnMubGlnaHRtYXBwZXIoZGV2aWNlLCB0aGlzLnJvb3QsIHRoaXMuc2NlbmUsIHRoaXMucmVuZGVyZXIsIHRoaXMuYXNzZXRzKTtcbiAgICAgICAgICAgIHRoaXMub25jZSgncHJlcmVuZGVyJywgdGhpcy5fZmlyc3RCYWtlLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBiYXRjaCBtYW5hZ2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1tYW5hZ2VyLmpzJykuQmF0Y2hNYW5hZ2VyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG51bGw7XG4gICAgICAgIGlmIChhcHBPcHRpb25zLmJhdGNoTWFuYWdlcikge1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG5ldyBhcHBPcHRpb25zLmJhdGNoTWFuYWdlcihkZXZpY2UsIHRoaXMucm9vdCwgdGhpcy5zY2VuZSk7XG4gICAgICAgICAgICB0aGlzLm9uY2UoJ3ByZXJlbmRlcicsIHRoaXMuX2ZpcnN0QmF0Y2gsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBrZXlib2FyZCBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2tleWJvYXJkLmpzJykuS2V5Ym9hcmR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmtleWJvYXJkID0gYXBwT3B0aW9ucy5rZXlib2FyZCB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbW91c2UgZGV2aWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC9tb3VzZS5qcycpLk1vdXNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tb3VzZSA9IGFwcE9wdGlvbnMubW91c2UgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBnZXQgdG91Y2ggZXZlbnRzIGlucHV0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC90b3VjaC1kZXZpY2UuanMnKS5Ub3VjaERldmljZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudG91Y2ggPSBhcHBPcHRpb25zLnRvdWNoIHx8IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZWQgdG8gYWNjZXNzIEdhbWVQYWQgaW5wdXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2dhbWUtcGFkcy5qcycpLkdhbWVQYWRzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5nYW1lcGFkcyA9IGFwcE9wdGlvbnMuZ2FtZXBhZHMgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBoYW5kbGUgaW5wdXQgZm9yIHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vaW5wdXQvZWxlbWVudC1pbnB1dC5qcycpLkVsZW1lbnRJbnB1dH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZWxlbWVudElucHV0ID0gYXBwT3B0aW9ucy5lbGVtZW50SW5wdXQgfHwgbnVsbDtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudElucHV0KVxuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuYXBwID0gdGhpcztcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFhSIE1hbmFnZXIgdGhhdCBwcm92aWRlcyBhYmlsaXR5IHRvIHN0YXJ0IFZSL0FSIHNlc3Npb25zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIGNoZWNrIGlmIFZSIGlzIGF2YWlsYWJsZVxuICAgICAgICAgKiBpZiAoYXBwLnhyLmlzQXZhaWxhYmxlKHBjLlhSVFlQRV9WUikpIHtcbiAgICAgICAgICogICAgIC8vIFZSIGlzIGF2YWlsYWJsZVxuICAgICAgICAgKiB9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnhyID0gYXBwT3B0aW9ucy54ciA/IG5ldyBhcHBPcHRpb25zLnhyKHRoaXMpIDogbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5lbGVtZW50SW5wdXQpXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dC5hdHRhY2hTZWxlY3RFdmVudHMoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2luVG9vbHMgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0Fzc2V0fG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9za3lib3hBc3NldCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NjcmlwdFByZWZpeCA9IGFwcE9wdGlvbnMuc2NyaXB0UHJlZml4IHx8ICcnO1xuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZUJ1bmRsZXMpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVyLmFkZEhhbmRsZXIoXCJidW5kbGVcIiwgbmV3IEJ1bmRsZUhhbmRsZXIodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCByZWdpc3RlciBhbGwgcmVxdWlyZWQgcmVzb3VyY2UgaGFuZGxlcnNcbiAgICAgICAgYXBwT3B0aW9ucy5yZXNvdXJjZUhhbmRsZXJzLmZvckVhY2goKHJlc291cmNlSGFuZGxlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IG5ldyByZXNvdXJjZUhhbmRsZXIodGhpcyk7XG4gICAgICAgICAgICB0aGlzLmxvYWRlci5hZGRIYW5kbGVyKGhhbmRsZXIuaGFuZGxlclR5cGUsIGhhbmRsZXIpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uJ3MgY29tcG9uZW50IHN5c3RlbSByZWdpc3RyeS4gVGhlIEFwcGxpY2F0aW9uIGNvbnN0cnVjdG9yIGFkZHMgdGhlXG4gICAgICAgICAqIGZvbGxvd2luZyBjb21wb25lbnQgc3lzdGVtcyB0byBpdHMgY29tcG9uZW50IHN5c3RlbSByZWdpc3RyeTpcbiAgICAgICAgICpcbiAgICAgICAgICogLSBhbmltICh7QGxpbmsgQW5pbUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gYW5pbWF0aW9uICh7QGxpbmsgQW5pbWF0aW9uQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBhdWRpb2xpc3RlbmVyICh7QGxpbmsgQXVkaW9MaXN0ZW5lckNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gYnV0dG9uICh7QGxpbmsgQnV0dG9uQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBjYW1lcmEgKHtAbGluayBDYW1lcmFDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGNvbGxpc2lvbiAoe0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gZWxlbWVudCAoe0BsaW5rIEVsZW1lbnRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGxheW91dGNoaWxkICh7QGxpbmsgTGF5b3V0Q2hpbGRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGxheW91dGdyb3VwICh7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGxpZ2h0ICh7QGxpbmsgTGlnaHRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIG1vZGVsICh7QGxpbmsgTW9kZWxDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHBhcnRpY2xlc3lzdGVtICh7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHJpZ2lkYm9keSAoe0BsaW5rIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gcmVuZGVyICh7QGxpbmsgUmVuZGVyQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JlZW4gKHtAbGluayBTY3JlZW5Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcmlwdCAoe0BsaW5rIFNjcmlwdENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2Nyb2xsYmFyICh7QGxpbmsgU2Nyb2xsYmFyQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JvbGx2aWV3ICh7QGxpbmsgU2Nyb2xsVmlld0NvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc291bmQgKHtAbGluayBTb3VuZENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc3ByaXRlICh7QGxpbmsgU3ByaXRlQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgZ2xvYmFsIGdyYXZpdHkgdG8gemVyb1xuICAgICAgICAgKiB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5ncmF2aXR5LnNldCgwLCAwLCAwKTtcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2V0IHRoZSBnbG9iYWwgc291bmQgdm9sdW1lIHRvIDUwJVxuICAgICAgICAgKiB0aGlzLmFwcC5zeXN0ZW1zLnNvdW5kLnZvbHVtZSA9IDAuNTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc3lzdGVtcyA9IG5ldyBDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSgpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgcmVnaXN0ZXIgYWxsIHJlcXVpcmVkIGNvbXBvbmVudCBzeXN0ZW1zXG4gICAgICAgIGFwcE9wdGlvbnMuY29tcG9uZW50U3lzdGVtcy5mb3JFYWNoKChjb21wb25lbnRTeXN0ZW0pID0+IHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5hZGQobmV3IGNvbXBvbmVudFN5c3RlbSh0aGlzKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciA9IHRoaXMub25WaXNpYmlsaXR5Q2hhbmdlLmJpbmQodGhpcyk7XG5cbiAgICAgICAgLy8gRGVwZW5kaW5nIG9uIGJyb3dzZXIgYWRkIHRoZSBjb3JyZWN0IHZpc2liaWxpdHljaGFuZ2UgZXZlbnQgYW5kIHN0b3JlIHRoZSBuYW1lIG9mIHRoZVxuICAgICAgICAvLyBoaWRkZW4gYXR0cmlidXRlIGluIHRoaXMuX2hpZGRlbkF0dHIuXG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuaGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ2hpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRvY3VtZW50Lm1vekhpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICdtb3pIaWRkZW4nO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21venZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkb2N1bWVudC5tc0hpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICdtc0hpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbXN2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQud2Via2l0SGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ3dlYmtpdEhpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignd2Via2l0dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBiaW5kIHRpY2sgZnVuY3Rpb24gdG8gY3VycmVudCBzY29wZVxuICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdXNlLWJlZm9yZS1kZWZpbmUgKi9cbiAgICAgICAgdGhpcy50aWNrID0gbWFrZVRpY2sodGhpcyk7IC8vIENpcmN1bGFyIGxpbnRpbmcgaXNzdWUgYXMgbWFrZVRpY2sgYW5kIEFwcGxpY2F0aW9uIHJlZmVyZW5jZSBlYWNoIG90aGVyXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG5hbWUgYXBwXG4gICAgICogQHR5cGUge0FwcEJhc2V8dW5kZWZpbmVkfVxuICAgICAqIEBkZXNjcmlwdGlvbiBHZXRzIHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uLCBpZiBhbnkuXG4gICAgICovXG5cbiAgICBzdGF0aWMgX2FwcGxpY2F0aW9ucyA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uLiBJbiB0aGUgY2FzZSB3aGVyZSB0aGVyZSBhcmUgbXVsdGlwbGUgcnVubmluZyBhcHBsaWNhdGlvbnMsIHRoZVxuICAgICAqIGZ1bmN0aW9uIGNhbiBnZXQgYW4gYXBwbGljYXRpb24gYmFzZWQgb24gYSBzdXBwbGllZCBjYW52YXMgaWQuIFRoaXMgZnVuY3Rpb24gaXMgcGFydGljdWxhcmx5XG4gICAgICogdXNlZnVsIHdoZW4gdGhlIGN1cnJlbnQgQXBwbGljYXRpb24gaXMgbm90IHJlYWRpbHkgYXZhaWxhYmxlLiBGb3IgZXhhbXBsZSwgaW4gdGhlIEphdmFTY3JpcHRcbiAgICAgKiBjb25zb2xlIG9mIHRoZSBicm93c2VyJ3MgZGV2ZWxvcGVyIHRvb2xzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtpZF0gLSBJZiBkZWZpbmVkLCB0aGUgcmV0dXJuZWQgYXBwbGljYXRpb24gc2hvdWxkIHVzZSB0aGUgY2FudmFzIHdoaWNoIGhhc1xuICAgICAqIHRoaXMgaWQuIE90aGVyd2lzZSBjdXJyZW50IGFwcGxpY2F0aW9uIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAgICogQHJldHVybnMge0FwcEJhc2V8dW5kZWZpbmVkfSBUaGUgcnVubmluZyBhcHBsaWNhdGlvbiwgaWYgYW55LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFwcCA9IHBjLkFwcEJhc2UuZ2V0QXBwbGljYXRpb24oKTtcbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0QXBwbGljYXRpb24oaWQpIHtcbiAgICAgICAgcmV0dXJuIGlkID8gQXBwQmFzZS5fYXBwbGljYXRpb25zW2lkXSA6IGdldEFwcGxpY2F0aW9uKCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2luaXREZWZhdWx0TWF0ZXJpYWwoKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgICAgbWF0ZXJpYWwubmFtZSA9IFwiRGVmYXVsdCBNYXRlcmlhbFwiO1xuICAgICAgICBtYXRlcmlhbC5zaGFkaW5nTW9kZWwgPSBTUEVDVUxBUl9CTElOTjtcbiAgICAgICAgc2V0RGVmYXVsdE1hdGVyaWFsKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIG1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfaW5pdFByb2dyYW1MaWJyYXJ5KCkge1xuICAgICAgICBjb25zdCBsaWJyYXJ5ID0gbmV3IFByb2dyYW1MaWJyYXJ5KHRoaXMuZ3JhcGhpY3NEZXZpY2UsIG5ldyBTdGFuZGFyZE1hdGVyaWFsKCkpO1xuICAgICAgICBzZXRQcm9ncmFtTGlicmFyeSh0aGlzLmdyYXBoaWNzRGV2aWNlLCBsaWJyYXJ5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9zb3VuZC9tYW5hZ2VyLmpzJykuU291bmRNYW5hZ2VyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgc291bmRNYW5hZ2VyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc291bmRNYW5hZ2VyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIGJhdGNoIG1hbmFnZXIuIFRoZSBiYXRjaCBtYW5hZ2VyIGlzIHVzZWQgdG8gbWVyZ2UgbWVzaCBpbnN0YW5jZXMgaW5cbiAgICAgKiB0aGUgc2NlbmUsIHdoaWNoIHJlZHVjZXMgdGhlIG92ZXJhbGwgbnVtYmVyIG9mIGRyYXcgY2FsbHMsIHRoZXJlYnkgYm9vc3RpbmcgcGVyZm9ybWFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1tYW5hZ2VyLmpzJykuQmF0Y2hNYW5hZ2VyfVxuICAgICAqL1xuICAgIGdldCBiYXRjaGVyKCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5fYmF0Y2hlciwgXCJCYXRjaE1hbmFnZXIgaGFzIG5vdCBiZWVuIGNyZWF0ZWQgYW5kIGlzIHJlcXVpcmVkIGZvciBjb3JyZWN0IGZ1bmN0aW9uYWxpdHkuXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5fYmF0Y2hlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBmaWxsIG1vZGUgb2YgdGhlIGNhbnZhcy4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfTk9ORX06IHRoZSBjYW52YXMgd2lsbCBhbHdheXMgbWF0Y2ggdGhlIHNpemUgcHJvdmlkZWQuXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfRklMTF9XSU5ET1d9OiB0aGUgY2FudmFzIHdpbGwgc2ltcGx5IGZpbGwgdGhlIHdpbmRvdywgY2hhbmdpbmcgYXNwZWN0IHJhdGlvLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0tFRVBfQVNQRUNUfTogdGhlIGNhbnZhcyB3aWxsIGdyb3cgdG8gZmlsbCB0aGUgd2luZG93IGFzIGJlc3QgaXQgY2FuIHdoaWxlXG4gICAgICogbWFpbnRhaW5pbmcgdGhlIGFzcGVjdCByYXRpby5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IGZpbGxNb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmlsbE1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgcmVzb2x1dGlvbiBtb2RlIG9mIHRoZSBjYW52YXMsIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fQVVUT306IGlmIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG5vdCBwcm92aWRlZCwgY2FudmFzIHdpbGwgYmUgcmVzaXplZCB0b1xuICAgICAqIG1hdGNoIGNhbnZhcyBjbGllbnQgc2l6ZS5cbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0ZJWEVEfTogcmVzb2x1dGlvbiBvZiBjYW52YXMgd2lsbCBiZSBmaXhlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IHJlc29sdXRpb25Nb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVzb2x1dGlvbk1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCB0aGUgYXBwbGljYXRpb24gY29uZmlndXJhdGlvbiBmaWxlIGFuZCBhcHBseSBhcHBsaWNhdGlvbiBwcm9wZXJ0aWVzIGFuZCBmaWxsIHRoZSBhc3NldFxuICAgICAqIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgb2YgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZSB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7Q29uZmlndXJlQXBwQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgaXNcbiAgICAgKiBsb2FkZWQgYW5kIHBhcnNlZCAob3IgYW4gZXJyb3Igb2NjdXJzKS5cbiAgICAgKi9cbiAgICBjb25maWd1cmUodXJsLCBjYWxsYmFjaykge1xuICAgICAgICBodHRwLmdldCh1cmwsIChlcnIsIHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByb3BzID0gcmVzcG9uc2UuYXBwbGljYXRpb25fcHJvcGVydGllcztcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lcyA9IHJlc3BvbnNlLnNjZW5lcztcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IHJlc3BvbnNlLmFzc2V0cztcblxuICAgICAgICAgICAgdGhpcy5fcGFyc2VBcHBsaWNhdGlvblByb3BlcnRpZXMocHJvcHMsIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZVNjZW5lcyhzY2VuZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQXNzZXRzKGFzc2V0cyk7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBhbGwgYXNzZXRzIGluIHRoZSBhc3NldCByZWdpc3RyeSB0aGF0IGFyZSBtYXJrZWQgYXMgJ3ByZWxvYWQnLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtQcmVsb2FkQXBwQ2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gY2FsbGVkIHdoZW4gYWxsIGFzc2V0cyBhcmUgbG9hZGVkLlxuICAgICAqL1xuICAgIHByZWxvYWQoY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5maXJlKFwicHJlbG9hZDpzdGFydFwiKTtcblxuICAgICAgICAvLyBnZXQgbGlzdCBvZiBhc3NldHMgdG8gcHJlbG9hZFxuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLmFzc2V0cy5saXN0KHtcbiAgICAgICAgICAgIHByZWxvYWQ6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MoYXNzZXRzLmxlbmd0aCk7XG5cbiAgICAgICAgbGV0IF9kb25lID0gZmFsc2U7XG5cbiAgICAgICAgLy8gY2hlY2sgaWYgYWxsIGxvYWRpbmcgaXMgZG9uZVxuICAgICAgICBjb25zdCBkb25lID0gKCkgPT4ge1xuICAgICAgICAgICAgLy8gZG8gbm90IHByb2NlZWQgaWYgYXBwbGljYXRpb24gZGVzdHJveWVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghX2RvbmUgJiYgcHJvZ3Jlc3MuZG9uZSgpKSB7XG4gICAgICAgICAgICAgICAgX2RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6ZW5kXCIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gdG90YWxzIGxvYWRpbmcgcHJvZ3Jlc3Mgb2YgYXNzZXRzXG4gICAgICAgIGNvbnN0IHRvdGFsID0gYXNzZXRzLmxlbmd0aDtcblxuICAgICAgICBpZiAocHJvZ3Jlc3MubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zdCBvbkFzc2V0TG9hZCA9IChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2dyZXNzLmluYygpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgncHJlbG9hZDpwcm9ncmVzcycsIHByb2dyZXNzLmNvdW50IC8gdG90YWwpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSlcbiAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3Qgb25Bc3NldEVycm9yID0gKGVyciwgYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3ByZWxvYWQ6cHJvZ3Jlc3MnLCBwcm9ncmVzcy5jb3VudCAvIHRvdGFsKTtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGZvciBlYWNoIGFzc2V0XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXRzW2ldLmxvYWRlZCkge1xuICAgICAgICAgICAgICAgICAgICBhc3NldHNbaV0ub25jZSgnbG9hZCcsIG9uQXNzZXRMb2FkKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2ldLm9uY2UoJ2Vycm9yJywgb25Bc3NldEVycm9yKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5sb2FkKGFzc2V0c1tpXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6cHJvZ3Jlc3NcIiwgcHJvZ3Jlc3MuY291bnQgLyB0b3RhbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkb25lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcHJlbG9hZFNjcmlwdHMoc2NlbmVEYXRhLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXNjcmlwdC5sZWdhY3kpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSB0cnVlO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdHMgPSB0aGlzLl9nZXRTY3JpcHRSZWZlcmVuY2VzKHNjZW5lRGF0YSk7XG5cbiAgICAgICAgY29uc3QgbCA9IHNjcmlwdHMubGVuZ3RoO1xuICAgICAgICBjb25zdCBwcm9ncmVzcyA9IG5ldyBQcm9ncmVzcyhsKTtcbiAgICAgICAgY29uc3QgcmVnZXggPSAvXmh0dHAocyk/OlxcL1xcLy87XG5cbiAgICAgICAgaWYgKGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG9uTG9hZCA9IChlcnIsIFNjcmlwdFR5cGUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG5cbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MuZG9uZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGV0IHNjcmlwdFVybCA9IHNjcmlwdHNbaV07XG4gICAgICAgICAgICAgICAgLy8gc3VwcG9ydCBhYnNvbHV0ZSBVUkxzIChmb3Igbm93KVxuICAgICAgICAgICAgICAgIGlmICghcmVnZXgudGVzdChzY3JpcHRVcmwudG9Mb3dlckNhc2UoKSkgJiYgdGhpcy5fc2NyaXB0UHJlZml4KVxuICAgICAgICAgICAgICAgICAgICBzY3JpcHRVcmwgPSBwYXRoLmpvaW4odGhpcy5fc2NyaXB0UHJlZml4LCBzY3JpcHRzW2ldKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGVyLmxvYWQoc2NyaXB0VXJsLCAnc2NyaXB0Jywgb25Mb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNldCBhcHBsaWNhdGlvbiBwcm9wZXJ0aWVzIGZyb20gZGF0YSBmaWxlXG4gICAgX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzKHByb3BzLCBjYWxsYmFjaykge1xuICAgICAgICAvLyBjb25maWd1cmUgcmV0cnlpbmcgYXNzZXRzXG4gICAgICAgIGlmICh0eXBlb2YgcHJvcHMubWF4QXNzZXRSZXRyaWVzID09PSAnbnVtYmVyJyAmJiBwcm9wcy5tYXhBc3NldFJldHJpZXMgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRlci5lbmFibGVSZXRyeShwcm9wcy5tYXhBc3NldFJldHJpZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgdGVtcG9yYXJ5IGJsb2NrIGFmdGVyIG1pZ3JhdGluZyBwcm9wZXJ0aWVzXG4gICAgICAgIGlmICghcHJvcHMudXNlRGV2aWNlUGl4ZWxSYXRpbylcbiAgICAgICAgICAgIHByb3BzLnVzZURldmljZVBpeGVsUmF0aW8gPSBwcm9wcy51c2VfZGV2aWNlX3BpeGVsX3JhdGlvO1xuICAgICAgICBpZiAoIXByb3BzLnJlc29sdXRpb25Nb2RlKVxuICAgICAgICAgICAgcHJvcHMucmVzb2x1dGlvbk1vZGUgPSBwcm9wcy5yZXNvbHV0aW9uX21vZGU7XG4gICAgICAgIGlmICghcHJvcHMuZmlsbE1vZGUpXG4gICAgICAgICAgICBwcm9wcy5maWxsTW9kZSA9IHByb3BzLmZpbGxfbW9kZTtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHByb3BzLndpZHRoO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSBwcm9wcy5oZWlnaHQ7XG4gICAgICAgIGlmIChwcm9wcy51c2VEZXZpY2VQaXhlbFJhdGlvKSB7XG4gICAgICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLm1heFBpeGVsUmF0aW8gPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0Q2FudmFzUmVzb2x1dGlvbihwcm9wcy5yZXNvbHV0aW9uTW9kZSwgdGhpcy5fd2lkdGgsIHRoaXMuX2hlaWdodCk7XG4gICAgICAgIHRoaXMuc2V0Q2FudmFzRmlsbE1vZGUocHJvcHMuZmlsbE1vZGUsIHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQpO1xuXG4gICAgICAgIC8vIHNldCB1cCBsYXllcnNcbiAgICAgICAgaWYgKHByb3BzLmxheWVycyAmJiBwcm9wcy5sYXllck9yZGVyKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb3NpdGlvbiA9IG5ldyBMYXllckNvbXBvc2l0aW9uKFwiYXBwbGljYXRpb25cIik7XG5cbiAgICAgICAgICAgIGNvbnN0IGxheWVycyA9IHt9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gcHJvcHMubGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHByb3BzLmxheWVyc1trZXldO1xuICAgICAgICAgICAgICAgIGRhdGEuaWQgPSBwYXJzZUludChrZXksIDEwKTtcbiAgICAgICAgICAgICAgICAvLyBkZXB0aCBsYXllciBzaG91bGQgb25seSBiZSBlbmFibGVkIHdoZW4gbmVlZGVkXG4gICAgICAgICAgICAgICAgLy8gYnkgaW5jcmVtZW50aW5nIGl0cyByZWYgY291bnRlclxuICAgICAgICAgICAgICAgIGRhdGEuZW5hYmxlZCA9IGRhdGEuaWQgIT09IExBWUVSSURfREVQVEg7XG4gICAgICAgICAgICAgICAgbGF5ZXJzW2tleV0gPSBuZXcgTGF5ZXIoZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wcy5sYXllck9yZGVyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3VibGF5ZXIgPSBwcm9wcy5sYXllck9yZGVyW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzW3N1YmxheWVyLmxheWVyXTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmIChzdWJsYXllci50cmFuc3BhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQobGF5ZXIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvc2l0aW9uLnB1c2hPcGFxdWUobGF5ZXIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbXBvc2l0aW9uLnN1YkxheWVyRW5hYmxlZFtpXSA9IHN1YmxheWVyLmVuYWJsZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2NlbmUubGF5ZXJzID0gY29tcG9zaXRpb247XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGQgYmF0Y2ggZ3JvdXBzXG4gICAgICAgIGlmIChwcm9wcy5iYXRjaEdyb3Vwcykge1xuICAgICAgICAgICAgY29uc3QgYmF0Y2hlciA9IHRoaXMuYmF0Y2hlcjtcbiAgICAgICAgICAgIGlmIChiYXRjaGVyKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHByb3BzLmJhdGNoR3JvdXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdycCA9IHByb3BzLmJhdGNoR3JvdXBzW2ldO1xuICAgICAgICAgICAgICAgICAgICBiYXRjaGVyLmFkZEdyb3VwKGdycC5uYW1lLCBncnAuZHluYW1pYywgZ3JwLm1heEFhYmJTaXplLCBncnAuaWQsIGdycC5sYXllcnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBsb2NhbGl6YXRpb24gYXNzZXRzXG4gICAgICAgIGlmIChwcm9wcy5pMThuQXNzZXRzKSB7XG4gICAgICAgICAgICB0aGlzLmkxOG4uYXNzZXRzID0gcHJvcHMuaTE4bkFzc2V0cztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xvYWRMaWJyYXJpZXMocHJvcHMubGlicmFyaWVzLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gdXJscyAtIExpc3Qgb2YgVVJMcyB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9hZExpYnJhcmllcyh1cmxzLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBsZW4gPSB1cmxzLmxlbmd0aDtcbiAgICAgICAgbGV0IGNvdW50ID0gbGVuO1xuXG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gL15odHRwKHMpPzpcXC9cXC8vO1xuXG4gICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgIGNvbnN0IG9uTG9hZCA9IChlcnIsIHNjcmlwdCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvdW50LS07XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY291bnQgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkxpYnJhcmllc0xvYWRlZCgpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHVybCA9IHVybHNbaV07XG5cbiAgICAgICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3QodXJsLnRvTG93ZXJDYXNlKCkpICYmIHRoaXMuX3NjcmlwdFByZWZpeClcbiAgICAgICAgICAgICAgICAgICAgdXJsID0gcGF0aC5qb2luKHRoaXMuX3NjcmlwdFByZWZpeCwgdXJsKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGVyLmxvYWQodXJsLCAnc2NyaXB0Jywgb25Mb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IHNjZW5lIG5hbWUvdXJscyBpbnRvIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gc2NlbmVzIC0gU2NlbmVzIHRvIGFkZCB0byB0aGUgc2NlbmUgcmVnaXN0cnkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VTY2VuZXMoc2NlbmVzKSB7XG4gICAgICAgIGlmICghc2NlbmVzKSByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2VuZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuc2NlbmVzLmFkZChzY2VuZXNbaV0ubmFtZSwgc2NlbmVzW2ldLnVybCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgYXNzZXRzIGludG8gcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IGFzc2V0cyAtIEFzc2V0cyB0byBpbnNlcnQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VBc3NldHMoYXNzZXRzKSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSBbXTtcblxuICAgICAgICBjb25zdCBzY3JpcHRzSW5kZXggPSB7fTtcbiAgICAgICAgY29uc3QgYnVuZGxlc0luZGV4ID0ge307XG5cbiAgICAgICAgaWYgKCFzY3JpcHQubGVnYWN5KSB7XG4gICAgICAgICAgICAvLyBhZGQgc2NyaXB0cyBpbiBvcmRlciBvZiBsb2FkaW5nIGZpcnN0XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2NyaXB0c09yZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSB0aGlzLnNjcmlwdHNPcmRlcltpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0c1tpZF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgc2NyaXB0c0luZGV4W2lkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0aGVuIGFkZCBidW5kbGVzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0c1tpZF0udHlwZSA9PT0gJ2J1bmRsZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1bmRsZXNJbmRleFtpZF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0aGVuIGFkZCByZXN0IG9mIGFzc2V0c1xuICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0c0luZGV4W2lkXSB8fCBidW5kbGVzSW5kZXhbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZUJ1bmRsZXMpIHtcbiAgICAgICAgICAgICAgICAvLyBhZGQgYnVuZGxlc1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldHNbaWRdLnR5cGUgPT09ICdidW5kbGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidW5kbGVzSW5kZXhbaWRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgcmVzdCBvZiBhc3NldHNcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1bmRsZXNJbmRleFtpZF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gbGlzdFtpXTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gbmV3IEFzc2V0KGRhdGEubmFtZSwgZGF0YS50eXBlLCBkYXRhLmZpbGUsIGRhdGEuZGF0YSk7XG4gICAgICAgICAgICBhc3NldC5pZCA9IHBhcnNlSW50KGRhdGEuaWQsIDEwKTtcbiAgICAgICAgICAgIGFzc2V0LnByZWxvYWQgPSBkYXRhLnByZWxvYWQgPyBkYXRhLnByZWxvYWQgOiBmYWxzZTtcbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgYSBzY3JpcHQgYXNzZXQgYW5kIGhhcyBhbHJlYWR5IGJlZW4gZW1iZWRkZWQgaW4gdGhlIHBhZ2UgdGhlblxuICAgICAgICAgICAgLy8gbWFyayBpdCBhcyBsb2FkZWRcbiAgICAgICAgICAgIGFzc2V0LmxvYWRlZCA9IGRhdGEudHlwZSA9PT0gJ3NjcmlwdCcgJiYgZGF0YS5kYXRhICYmIGRhdGEuZGF0YS5sb2FkaW5nVHlwZSA+IDA7XG4gICAgICAgICAgICAvLyB0YWdzXG4gICAgICAgICAgICBhc3NldC50YWdzLmFkZChkYXRhLnRhZ3MpO1xuICAgICAgICAgICAgLy8gaTE4blxuICAgICAgICAgICAgaWYgKGRhdGEuaTE4bikge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbG9jYWxlIGluIGRhdGEuaTE4bikge1xuICAgICAgICAgICAgICAgICAgICBhc3NldC5hZGRMb2NhbGl6ZWRBc3NldElkKGxvY2FsZSwgZGF0YS5pMThuW2xvY2FsZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHJlZ2lzdHJ5XG4gICAgICAgICAgICB0aGlzLmFzc2V0cy5hZGQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHJldHVybnMge0FycmF5fSAtIFRoZSBsaXN0IG9mIHNjcmlwdHMgdGhhdCBhcmUgcmVmZXJlbmNlZCBieSB0aGUgc2NlbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0U2NyaXB0UmVmZXJlbmNlcyhzY2VuZSkge1xuICAgICAgICBsZXQgcHJpb3JpdHlTY3JpcHRzID0gW107XG4gICAgICAgIGlmIChzY2VuZS5zZXR0aW5ncy5wcmlvcml0eV9zY3JpcHRzKSB7XG4gICAgICAgICAgICBwcmlvcml0eVNjcmlwdHMgPSBzY2VuZS5zZXR0aW5ncy5wcmlvcml0eV9zY3JpcHRzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgX3NjcmlwdHMgPSBbXTtcbiAgICAgICAgY29uc3QgX2luZGV4ID0ge307XG5cbiAgICAgICAgLy8gZmlyc3QgYWRkIHByaW9yaXR5IHNjcmlwdHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmlvcml0eVNjcmlwdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIF9zY3JpcHRzLnB1c2gocHJpb3JpdHlTY3JpcHRzW2ldKTtcbiAgICAgICAgICAgIF9pbmRleFtwcmlvcml0eVNjcmlwdHNbaV1dID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRoZW4gaXRlcmF0ZSBoaWVyYXJjaHkgdG8gZ2V0IHJlZmVyZW5jZWQgc2NyaXB0c1xuICAgICAgICBjb25zdCBlbnRpdGllcyA9IHNjZW5lLmVudGl0aWVzO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBlbnRpdGllcykge1xuICAgICAgICAgICAgaWYgKCFlbnRpdGllc1trZXldLmNvbXBvbmVudHMuc2NyaXB0KSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdHMgPSBlbnRpdGllc1trZXldLmNvbXBvbmVudHMuc2NyaXB0LnNjcmlwdHM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjcmlwdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoX2luZGV4W3NjcmlwdHNbaV0udXJsXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgX3NjcmlwdHMucHVzaChzY3JpcHRzW2ldLnVybCk7XG4gICAgICAgICAgICAgICAgX2luZGV4W3NjcmlwdHNbaV0udXJsXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX3NjcmlwdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgdGhlIGFwcGxpY2F0aW9uLiBUaGlzIGZ1bmN0aW9uIGRvZXMgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIDEuIEZpcmVzIGFuIGV2ZW50IG9uIHRoZSBhcHBsaWNhdGlvbiBuYW1lZCAnc3RhcnQnXG4gICAgICogMi4gQ2FsbHMgaW5pdGlhbGl6ZSBmb3IgYWxsIGNvbXBvbmVudHMgb24gZW50aXRpZXMgaW4gdGhlIGhpZXJhcmNoeVxuICAgICAqIDMuIEZpcmVzIGFuIGV2ZW50IG9uIHRoZSBhcHBsaWNhdGlvbiBuYW1lZCAnaW5pdGlhbGl6ZSdcbiAgICAgKiA0LiBDYWxscyBwb3N0SW5pdGlhbGl6ZSBmb3IgYWxsIGNvbXBvbmVudHMgb24gZW50aXRpZXMgaW4gdGhlIGhpZXJhcmNoeVxuICAgICAqIDUuIEZpcmVzIGFuIGV2ZW50IG9uIHRoZSBhcHBsaWNhdGlvbiBuYW1lZCAncG9zdGluaXRpYWxpemUnXG4gICAgICogNi4gU3RhcnRzIGV4ZWN1dGluZyB0aGUgbWFpbiBsb29wIG9mIHRoZSBhcHBsaWNhdGlvblxuICAgICAqXG4gICAgICogVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgaW50ZXJuYWxseSBieSBQbGF5Q2FudmFzIGFwcGxpY2F0aW9ucyBtYWRlIGluIHRoZSBFZGl0b3IgYnV0IHlvdVxuICAgICAqIHdpbGwgbmVlZCB0byBjYWxsIHN0YXJ0IHlvdXJzZWxmIGlmIHlvdSBhcmUgdXNpbmcgdGhlIGVuZ2luZSBzdGFuZC1hbG9uZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnN0YXJ0KCk7XG4gICAgICovXG4gICAgc3RhcnQoKSB7XG4gICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuXG4gICAgICAgIHRoaXMuZmlyZShcInN0YXJ0XCIsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbm93KCksXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9saWJyYXJpZXNMb2FkZWQpIHtcbiAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdpbml0aWFsaXplJywgdGhpcy5yb290KTtcbiAgICAgICAgdGhpcy5maXJlKCdpbml0aWFsaXplJyk7XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ3Bvc3RJbml0aWFsaXplJywgdGhpcy5yb290KTtcbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ3Bvc3RQb3N0SW5pdGlhbGl6ZScsIHRoaXMucm9vdCk7XG4gICAgICAgIHRoaXMuZmlyZSgncG9zdGluaXRpYWxpemUnKTtcblxuICAgICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgYWxsIGlucHV0IGRldmljZXMgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgdGltZSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IHVwZGF0ZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGlucHV0VXBkYXRlKGR0KSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci51cGRhdGUoZHQpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm1vdXNlKSB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmtleWJvYXJkKSB7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmdhbWVwYWRzKSB7XG4gICAgICAgICAgICB0aGlzLmdhbWVwYWRzLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSBhcHBsaWNhdGlvbi4gVGhpcyBmdW5jdGlvbiB3aWxsIGNhbGwgdGhlIHVwZGF0ZSBmdW5jdGlvbnMgYW5kIHRoZW4gdGhlIHBvc3RVcGRhdGVcbiAgICAgKiBmdW5jdGlvbnMgb2YgYWxsIGVuYWJsZWQgY29tcG9uZW50cy4gSXQgd2lsbCB0aGVuIHVwZGF0ZSB0aGUgY3VycmVudCBzdGF0ZSBvZiBhbGwgY29ubmVjdGVkXG4gICAgICogaW5wdXQgZGV2aWNlcy4gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgaW50ZXJuYWxseSBpbiB0aGUgYXBwbGljYXRpb24ncyBtYWluIGxvb3AgYW5kIGRvZXNcbiAgICAgKiBub3QgbmVlZCB0byBiZSBjYWxsZWQgZXhwbGljaXRseS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGRlbHRhIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICovXG4gICAgdXBkYXRlKGR0KSB7XG4gICAgICAgIHRoaXMuZnJhbWUrKztcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLnVwZGF0ZUNsaWVudFJlY3QoKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUudXBkYXRlU3RhcnQgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gUGVyZm9ybSBDb21wb25lbnRTeXN0ZW0gdXBkYXRlXG4gICAgICAgIGlmIChzY3JpcHQubGVnYWN5KVxuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ2ZpeGVkVXBkYXRlJywgMS4wIC8gNjAuMCk7XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUodGhpcy5faW5Ub29scyA/ICd0b29sc1VwZGF0ZScgOiAndXBkYXRlJywgZHQpO1xuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgnYW5pbWF0aW9uVXBkYXRlJywgZHQpO1xuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgncG9zdFVwZGF0ZScsIGR0KTtcblxuICAgICAgICAvLyBmaXJlIHVwZGF0ZSBldmVudFxuICAgICAgICB0aGlzLmZpcmUoXCJ1cGRhdGVcIiwgZHQpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnB1dCBkZXZpY2VzXG4gICAgICAgIHRoaXMuaW5wdXRVcGRhdGUoZHQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS51cGRhdGVUaW1lID0gbm93KCkgLSB0aGlzLnN0YXRzLmZyYW1lLnVwZGF0ZVN0YXJ0O1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgdGhlIGFwcGxpY2F0aW9uJ3Mgc2NlbmUuIE1vcmUgc3BlY2lmaWNhbGx5LCB0aGUgc2NlbmUncyB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0gaXNcbiAgICAgKiByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgaW50ZXJuYWxseSBpbiB0aGUgYXBwbGljYXRpb24ncyBtYWluIGxvb3AgYW5kIGRvZXMgbm90XG4gICAgICogbmVlZCB0byBiZSBjYWxsZWQgZXhwbGljaXRseS5cbiAgICAgKi9cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS5yZW5kZXJTdGFydCA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0aGlzLmZpcmUoJ3ByZXJlbmRlcicpO1xuICAgICAgICB0aGlzLnJvb3Quc3luY0hpZXJhcmNoeSgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaGVyKSB7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaGVyLnVwZGF0ZUFsbCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBGb3J3YXJkUmVuZGVyZXIuX3NraXBSZW5kZXJDb3VudGVyID0gMDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gcmVuZGVyIHRoZSBzY2VuZSBjb21wb3NpdGlvblxuICAgICAgICB0aGlzLnJlbmRlckNvbXBvc2l0aW9uKHRoaXMuc2NlbmUubGF5ZXJzKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3Bvc3RyZW5kZXInKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUucmVuZGVyVGltZSA9IG5vdygpIC0gdGhpcy5zdGF0cy5mcmFtZS5yZW5kZXJTdGFydDtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLy8gcmVuZGVyIGEgbGF5ZXIgY29tcG9zaXRpb25cbiAgICByZW5kZXJDb21wb3NpdGlvbihsYXllckNvbXBvc2l0aW9uKSB7XG4gICAgICAgIERlYnVnR3JhcGhpY3MuY2xlYXJHcHVNYXJrZXJzKCk7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuYnVpbGRGcmFtZUdyYXBoKHRoaXMuZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbik7XG4gICAgICAgIHRoaXMuZnJhbWVHcmFwaC5yZW5kZXIodGhpcy5ncmFwaGljc0RldmljZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5vdyAtIFRoZSB0aW1lc3RhbXAgcGFzc2VkIHRvIHRoZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIHRpbWUgZGVsdGEgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS4gVGhpcyBpcyBzdWJqZWN0IHRvIHRoZVxuICAgICAqIGFwcGxpY2F0aW9uJ3MgdGltZSBzY2FsZSBhbmQgbWF4IGRlbHRhIHZhbHVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbXMgLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZmlsbEZyYW1lU3RhdHNCYXNpYyhub3csIGR0LCBtcykge1xuICAgICAgICAvLyBUaW1pbmcgc3RhdHNcbiAgICAgICAgY29uc3Qgc3RhdHMgPSB0aGlzLnN0YXRzLmZyYW1lO1xuICAgICAgICBzdGF0cy5kdCA9IGR0O1xuICAgICAgICBzdGF0cy5tcyA9IG1zO1xuICAgICAgICBpZiAobm93ID4gc3RhdHMuX3RpbWVUb0NvdW50RnJhbWVzKSB7XG4gICAgICAgICAgICBzdGF0cy5mcHMgPSBzdGF0cy5fZnBzQWNjdW07XG4gICAgICAgICAgICBzdGF0cy5fZnBzQWNjdW0gPSAwO1xuICAgICAgICAgICAgc3RhdHMuX3RpbWVUb0NvdW50RnJhbWVzID0gbm93ICsgMTAwMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRzLl9mcHNBY2N1bSsrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdG90YWwgZHJhdyBjYWxsXG4gICAgICAgIHRoaXMuc3RhdHMuZHJhd0NhbGxzLnRvdGFsID0gdGhpcy5ncmFwaGljc0RldmljZS5fZHJhd0NhbGxzUGVyRnJhbWU7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuX2RyYXdDYWxsc1BlckZyYW1lID0gMDtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZmlsbEZyYW1lU3RhdHMoKSB7XG4gICAgICAgIGxldCBzdGF0cyA9IHRoaXMuc3RhdHMuZnJhbWU7XG5cbiAgICAgICAgLy8gUmVuZGVyIHN0YXRzXG4gICAgICAgIHN0YXRzLmNhbWVyYXMgPSB0aGlzLnJlbmRlcmVyLl9jYW1lcmFzUmVuZGVyZWQ7XG4gICAgICAgIHN0YXRzLm1hdGVyaWFscyA9IHRoaXMucmVuZGVyZXIuX21hdGVyaWFsU3dpdGNoZXM7XG4gICAgICAgIHN0YXRzLnNoYWRlcnMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy5zaGFkb3dNYXBVcGRhdGVzID0gdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcztcbiAgICAgICAgc3RhdHMuc2hhZG93TWFwVGltZSA9IHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWU7XG4gICAgICAgIHN0YXRzLmRlcHRoTWFwVGltZSA9IHRoaXMucmVuZGVyZXIuX2RlcHRoTWFwVGltZTtcbiAgICAgICAgc3RhdHMuZm9yd2FyZFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZTtcbiAgICAgICAgY29uc3QgcHJpbXMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9wcmltc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy50cmlhbmdsZXMgPSBwcmltc1tQUklNSVRJVkVfVFJJQU5HTEVTXSAvIDMgK1xuICAgICAgICAgICAgTWF0aC5tYXgocHJpbXNbUFJJTUlUSVZFX1RSSVNUUklQXSAtIDIsIDApICtcbiAgICAgICAgICAgIE1hdGgubWF4KHByaW1zW1BSSU1JVElWRV9UUklGQU5dIC0gMiwgMCk7XG4gICAgICAgIHN0YXRzLmN1bGxUaW1lID0gdGhpcy5yZW5kZXJlci5fY3VsbFRpbWU7XG4gICAgICAgIHN0YXRzLnNvcnRUaW1lID0gdGhpcy5yZW5kZXJlci5fc29ydFRpbWU7XG4gICAgICAgIHN0YXRzLnNraW5UaW1lID0gdGhpcy5yZW5kZXJlci5fc2tpblRpbWU7XG4gICAgICAgIHN0YXRzLm1vcnBoVGltZSA9IHRoaXMucmVuZGVyZXIuX21vcnBoVGltZTtcbiAgICAgICAgc3RhdHMubGlnaHRDbHVzdGVycyA9IHRoaXMucmVuZGVyZXIuX2xpZ2h0Q2x1c3RlcnM7XG4gICAgICAgIHN0YXRzLmxpZ2h0Q2x1c3RlcnNUaW1lID0gdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVyc1RpbWU7XG4gICAgICAgIHN0YXRzLm90aGVyUHJpbWl0aXZlcyA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJpbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpIDwgUFJJTUlUSVZFX1RSSUFOR0xFUykge1xuICAgICAgICAgICAgICAgIHN0YXRzLm90aGVyUHJpbWl0aXZlcyArPSBwcmltc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByaW1zW2ldID0gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbmRlcmVyLl9jYW1lcmFzUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcyA9IDA7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9jdWxsVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVyc1RpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zb3J0VGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NraW5UaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbW9ycGhUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2RlcHRoTWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lID0gMDtcblxuICAgICAgICAvLyBEcmF3IGNhbGwgc3RhdHNcbiAgICAgICAgc3RhdHMgPSB0aGlzLnN0YXRzLmRyYXdDYWxscztcbiAgICAgICAgc3RhdHMuZm9yd2FyZCA9IHRoaXMucmVuZGVyZXIuX2ZvcndhcmREcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLmN1bGxlZCA9IHRoaXMucmVuZGVyZXIuX251bURyYXdDYWxsc0N1bGxlZDtcbiAgICAgICAgc3RhdHMuZGVwdGggPSAwO1xuICAgICAgICBzdGF0cy5zaGFkb3cgPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dEcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLnNraW5uZWQgPSB0aGlzLnJlbmRlcmVyLl9za2luRHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5pbW1lZGlhdGUgPSAwO1xuICAgICAgICBzdGF0cy5pbnN0YW5jZWQgPSAwO1xuICAgICAgICBzdGF0cy5yZW1vdmVkQnlJbnN0YW5jaW5nID0gMDtcbiAgICAgICAgc3RhdHMubWlzYyA9IHN0YXRzLnRvdGFsIC0gKHN0YXRzLmZvcndhcmQgKyBzdGF0cy5zaGFkb3cpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9kZXB0aERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd0RyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9udW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9za2luRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5faW1tZWRpYXRlUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9pbnN0YW5jZWREcmF3Q2FsbHMgPSAwO1xuXG4gICAgICAgIHRoaXMuc3RhdHMubWlzYy5yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLnJlbmRlclRhcmdldENyZWF0aW9uVGltZTtcblxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHMucGFydGljbGVzO1xuICAgICAgICBzdGF0cy51cGRhdGVzUGVyRnJhbWUgPSBzdGF0cy5fdXBkYXRlc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy5mcmFtZVRpbWUgPSBzdGF0cy5fZnJhbWVUaW1lO1xuICAgICAgICBzdGF0cy5fdXBkYXRlc1BlckZyYW1lID0gMDtcbiAgICAgICAgc3RhdHMuX2ZyYW1lVGltZSA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgaG93IHRoZSBjYW52YXMgZmlsbHMgdGhlIHdpbmRvdyBhbmQgcmVzaXplcyB3aGVuIHRoZSB3aW5kb3cgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIC0gVGhlIG1vZGUgdG8gdXNlIHdoZW4gc2V0dGluZyB0aGUgc2l6ZSBvZiB0aGUgY2FudmFzLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9OT05FfTogdGhlIGNhbnZhcyB3aWxsIGFsd2F5cyBtYXRjaCB0aGUgc2l6ZSBwcm92aWRlZC5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9GSUxMX1dJTkRPV306IHRoZSBjYW52YXMgd2lsbCBzaW1wbHkgZmlsbCB0aGUgd2luZG93LCBjaGFuZ2luZyBhc3BlY3QgcmF0aW8uXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfS0VFUF9BU1BFQ1R9OiB0aGUgY2FudmFzIHdpbGwgZ3JvdyB0byBmaWxsIHRoZSB3aW5kb3cgYXMgYmVzdCBpdCBjYW4gd2hpbGVcbiAgICAgKiBtYWludGFpbmluZyB0aGUgYXNwZWN0IHJhdGlvLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIGNhbnZhcyAob25seSB1c2VkIHdoZW4gbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0pLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyAob25seSB1c2VkIHdoZW4gbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0pLlxuICAgICAqL1xuICAgIHNldENhbnZhc0ZpbGxNb2RlKG1vZGUsIHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgdGhpcy5fZmlsbE1vZGUgPSBtb2RlO1xuICAgICAgICB0aGlzLnJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGFuZ2UgdGhlIHJlc29sdXRpb24gb2YgdGhlIGNhbnZhcywgYW5kIHNldCB0aGUgd2F5IGl0IGJlaGF2ZXMgd2hlbiB0aGUgd2luZG93IGlzIHJlc2l6ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSAtIFRoZSBtb2RlIHRvIHVzZSB3aGVuIHNldHRpbmcgdGhlIHJlc29sdXRpb24uIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fQVVUT306IGlmIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG5vdCBwcm92aWRlZCwgY2FudmFzIHdpbGwgYmUgcmVzaXplZCB0b1xuICAgICAqIG1hdGNoIGNhbnZhcyBjbGllbnQgc2l6ZS5cbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0ZJWEVEfTogcmVzb2x1dGlvbiBvZiBjYW52YXMgd2lsbCBiZSBmaXhlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2lkdGhdIC0gVGhlIGhvcml6b250YWwgcmVzb2x1dGlvbiwgb3B0aW9uYWwgaW4gQVVUTyBtb2RlLCBpZiBub3QgcHJvdmlkZWRcbiAgICAgKiBjYW52YXMgY2xpZW50V2lkdGggaXMgdXNlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgdmVydGljYWwgcmVzb2x1dGlvbiwgb3B0aW9uYWwgaW4gQVVUTyBtb2RlLCBpZiBub3QgcHJvdmlkZWRcbiAgICAgKiBjYW52YXMgY2xpZW50SGVpZ2h0IGlzIHVzZWQuXG4gICAgICovXG4gICAgc2V0Q2FudmFzUmVzb2x1dGlvbihtb2RlLCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuX3Jlc29sdXRpb25Nb2RlID0gbW9kZTtcblxuICAgICAgICAvLyBJbiBBVVRPIG1vZGUgdGhlIHJlc29sdXRpb24gaXMgdGhlIHNhbWUgYXMgdGhlIGNhbnZhcyBzaXplLCB1bmxlc3Mgc3BlY2lmaWVkXG4gICAgICAgIGlmIChtb2RlID09PSBSRVNPTFVUSU9OX0FVVE8gJiYgKHdpZHRoID09PSB1bmRlZmluZWQpKSB7XG4gICAgICAgICAgICB3aWR0aCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLmNsaWVudFdpZHRoO1xuICAgICAgICAgICAgaGVpZ2h0ID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuY2xpZW50SGVpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5yZXNpemVDYW52YXMod2lkdGgsIGhlaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgd2luZG93IG9yIHRhYiBpbiB3aGljaCB0aGUgYXBwbGljYXRpb24gaXMgcnVubmluZy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBhcHBsaWNhdGlvbiBpcyBub3QgdmlzaWJsZSBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGlzSGlkZGVuKCkge1xuICAgICAgICByZXR1cm4gZG9jdW1lbnRbdGhpcy5faGlkZGVuQXR0cl07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIHZpc2liaWxpdHkgc3RhdGUgb2YgdGhlIGN1cnJlbnQgdGFiL3dpbmRvdyBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblZpc2liaWxpdHlDaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmlzSGlkZGVuKCkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIuc3VzcGVuZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NvdW5kTWFuYWdlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5yZXN1bWUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2l6ZSB0aGUgYXBwbGljYXRpb24ncyBjYW52YXMgZWxlbWVudCBpbiBsaW5lIHdpdGggdGhlIGN1cnJlbnQgZmlsbCBtb2RlLlxuICAgICAqXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfS0VFUF9BU1BFQ1R9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0XG4gICAgICogY2FuIHdoaWxlIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfRklMTF9XSU5ET1d9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBzaW1wbHkgZmlsbCB0aGUgd2luZG93LCBjaGFuZ2luZ1xuICAgICAqIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIEluIHtAbGluayBGSUxMTU9ERV9OT05FfSBtb2RlLCB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIGNhbnZhcy4gT25seSB1c2VkIGlmIGN1cnJlbnQgZmlsbCBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgaGVpZ2h0IG9mIHRoZSBjYW52YXMuIE9ubHkgdXNlZCBpZiBjdXJyZW50IGZpbGwgbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0uXG4gICAgICogQHJldHVybnMge29iamVjdH0gQSBvYmplY3QgY29udGFpbmluZyB0aGUgdmFsdWVzIGNhbGN1bGF0ZWQgdG8gdXNlIGFzIHdpZHRoIGFuZCBoZWlnaHQuXG4gICAgICovXG4gICAgcmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbGxvd1Jlc2l6ZSkgcmV0dXJuIHVuZGVmaW5lZDsgLy8gcHJldmVudCByZXNpemluZyAoZS5nLiBpZiBwcmVzZW50aW5nIGluIFZSIEhNRClcblxuICAgICAgICAvLyBwcmV2ZW50IHJlc2l6aW5nIHdoZW4gaW4gWFIgc2Vzc2lvblxuICAgICAgICBpZiAodGhpcy54ciAmJiB0aGlzLnhyLnNlc3Npb24pXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICAgIGNvbnN0IHdpbmRvd1dpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcblxuICAgICAgICBpZiAodGhpcy5fZmlsbE1vZGUgPT09IEZJTExNT0RFX0tFRVBfQVNQRUNUKSB7XG4gICAgICAgICAgICBjb25zdCByID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMud2lkdGggLyB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5oZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCB3aW5SID0gd2luZG93V2lkdGggLyB3aW5kb3dIZWlnaHQ7XG5cbiAgICAgICAgICAgIGlmIChyID4gd2luUikge1xuICAgICAgICAgICAgICAgIHdpZHRoID0gd2luZG93V2lkdGg7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gd2lkdGggLyByO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSB3aW5kb3dIZWlnaHQ7XG4gICAgICAgICAgICAgICAgd2lkdGggPSBoZWlnaHQgKiByO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2ZpbGxNb2RlID09PSBGSUxMTU9ERV9GSUxMX1dJTkRPVykge1xuICAgICAgICAgICAgd2lkdGggPSB3aW5kb3dXaWR0aDtcbiAgICAgICAgICAgIGhlaWdodCA9IHdpbmRvd0hlaWdodDtcbiAgICAgICAgfVxuICAgICAgICAvLyBPVEhFUldJU0U6IEZJTExNT0RFX05PTkUgdXNlIHdpZHRoIGFuZCBoZWlnaHQgdGhhdCBhcmUgcHJvdmlkZWRcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5zdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcblxuICAgICAgICB0aGlzLnVwZGF0ZUNhbnZhc1NpemUoKTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIGZpbmFsIHZhbHVlcyBjYWxjdWxhdGVkIGZvciB3aWR0aCBhbmQgaGVpZ2h0XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIHtAbGluayBHcmFwaGljc0RldmljZX0gY2FudmFzIHNpemUgdG8gbWF0Y2ggdGhlIGNhbnZhcyBzaXplIG9uIHRoZSBkb2N1bWVudFxuICAgICAqIHBhZ2UuIEl0IGlzIHJlY29tbWVuZGVkIHRvIGNhbGwgdGhpcyBmdW5jdGlvbiB3aGVuIHRoZSBjYW52YXMgc2l6ZSBjaGFuZ2VzIChlLmcgb24gd2luZG93XG4gICAgICogcmVzaXplIGFuZCBvcmllbnRhdGlvbiBjaGFuZ2UgZXZlbnRzKSBzbyB0aGF0IHRoZSBjYW52YXMgcmVzb2x1dGlvbiBpcyBpbW1lZGlhdGVseSB1cGRhdGVkLlxuICAgICAqL1xuICAgIHVwZGF0ZUNhbnZhc1NpemUoKSB7XG4gICAgICAgIC8vIERvbid0IHVwZGF0ZSBpZiB3ZSBhcmUgaW4gVlIgb3IgWFJcbiAgICAgICAgaWYgKCghdGhpcy5fYWxsb3dSZXNpemUpIHx8ICh0aGlzLnhyPy5hY3RpdmUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbiBBVVRPIG1vZGUgdGhlIHJlc29sdXRpb24gaXMgY2hhbmdlZCB0byBtYXRjaCB0aGUgY2FudmFzIHNpemVcbiAgICAgICAgaWYgKHRoaXMuX3Jlc29sdXRpb25Nb2RlID09PSBSRVNPTFVUSU9OX0FVVE8pIHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBjYW52YXMgRE9NIGhhcyBjaGFuZ2VkIHNpemVcbiAgICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzO1xuICAgICAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5yZXNpemVDYW52YXMoY2FudmFzLmNsaWVudFdpZHRoLCBjYW52YXMuY2xpZW50SGVpZ2h0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV2ZW50IGhhbmRsZXIgY2FsbGVkIHdoZW4gYWxsIGNvZGUgbGlicmFyaWVzIGhhdmUgYmVlbiBsb2FkZWQuIENvZGUgbGlicmFyaWVzIGFyZSBwYXNzZWRcbiAgICAgKiBpbnRvIHRoZSBjb25zdHJ1Y3RvciBvZiB0aGUgQXBwbGljYXRpb24gYW5kIHRoZSBhcHBsaWNhdGlvbiB3b24ndCBzdGFydCBydW5uaW5nIG9yIGxvYWRcbiAgICAgKiBwYWNrcyB1bnRpbCBhbGwgbGlicmFyaWVzIGhhdmUgYmVlbiBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGlicmFyaWVzTG9hZGVkKCkge1xuICAgICAgICB0aGlzLl9saWJyYXJpZXNMb2FkZWQgPSB0cnVlO1xuXG4gICAgICAgIGlmICh0aGlzLnN5c3RlbXMucmlnaWRib2R5KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMucmlnaWRib2R5Lm9uTGlicmFyeUxvYWRlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgc2NlbmUgc2V0dGluZ3MgdG8gdGhlIGN1cnJlbnQgc2NlbmUuIFVzZWZ1bCB3aGVuIHlvdXIgc2NlbmUgc2V0dGluZ3MgYXJlIHBhcnNlZCBvclxuICAgICAqIGdlbmVyYXRlZCBmcm9tIGEgbm9uLVVSTCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2V0dGluZ3MgLSBUaGUgc2NlbmUgc2V0dGluZ3MgdG8gYmUgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2V0dGluZ3MucGh5c2ljcyAtIFRoZSBwaHlzaWNzIHNldHRpbmdzIHRvIGJlIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucGh5c2ljcy5ncmF2aXR5IC0gVGhlIHdvcmxkIHNwYWNlIHZlY3RvciByZXByZXNlbnRpbmcgZ2xvYmFsXG4gICAgICogZ3Jhdml0eSBpbiB0aGUgcGh5c2ljcyBzaW11bGF0aW9uLiBNdXN0IGJlIGEgZml4ZWQgc2l6ZSBhcnJheSB3aXRoIHRocmVlIG51bWJlciBlbGVtZW50cyxcbiAgICAgKiBjb3JyZXNwb25kaW5nIHRvIGVhY2ggYXhpcyBbIFgsIFksIFogXS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2V0dGluZ3MucmVuZGVyIC0gVGhlIHJlbmRlcmluZyBzZXR0aW5ncyB0byBiZSBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnJlbmRlci5nbG9iYWxfYW1iaWVudCAtIFRoZSBjb2xvciBvZiB0aGUgc2NlbmUncyBhbWJpZW50IGxpZ2h0LlxuICAgICAqIE11c3QgYmUgYSBmaXhlZCBzaXplIGFycmF5IHdpdGggdGhyZWUgbnVtYmVyIGVsZW1lbnRzLCBjb3JyZXNwb25kaW5nIHRvIGVhY2ggY29sb3IgY2hhbm5lbFxuICAgICAqIFsgUiwgRywgQiBdLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZXR0aW5ncy5yZW5kZXIuZm9nIC0gVGhlIHR5cGUgb2YgZm9nIHVzZWQgYnkgdGhlIHNjZW5lLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGT0dfTk9ORX1cbiAgICAgKiAtIHtAbGluayBGT0dfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIEZPR19FWFB9XG4gICAgICogLSB7QGxpbmsgRk9HX0VYUDJ9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5yZW5kZXIuZm9nX2NvbG9yIC0gVGhlIGNvbG9yIG9mIHRoZSBmb2cgKGlmIGVuYWJsZWQpLiBNdXN0IGJlIGFcbiAgICAgKiBmaXhlZCBzaXplIGFycmF5IHdpdGggdGhyZWUgbnVtYmVyIGVsZW1lbnRzLCBjb3JyZXNwb25kaW5nIHRvIGVhY2ggY29sb3IgY2hhbm5lbCBbIFIsIEcsIEIgXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmZvZ19kZW5zaXR5IC0gVGhlIGRlbnNpdHkgb2YgdGhlIGZvZyAoaWYgZW5hYmxlZCkuIFRoaXNcbiAgICAgKiBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfRVhQfSBvciB7QGxpbmsgRk9HX0VYUDJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZm9nX3N0YXJ0IC0gVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCB3aGVyZSBsaW5lYXIgZm9nXG4gICAgICogYmVnaW5zLiBUaGlzIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZm9nX2VuZCAtIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgd2hlcmUgbGluZWFyIGZvZ1xuICAgICAqIHJlYWNoZXMgaXRzIG1heGltdW0uIFRoaXMgcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5nYW1tYV9jb3JyZWN0aW9uIC0gVGhlIGdhbW1hIGNvcnJlY3Rpb24gdG8gYXBwbHkgd2hlblxuICAgICAqIHJlbmRlcmluZyB0aGUgc2NlbmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEdBTU1BX05PTkV9XG4gICAgICogLSB7QGxpbmsgR0FNTUFfU1JHQn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIudG9uZW1hcHBpbmcgLSBUaGUgdG9uZW1hcHBpbmcgdHJhbnNmb3JtIHRvIGFwcGx5IHdoZW5cbiAgICAgKiB3cml0aW5nIGZyYWdtZW50cyB0byB0aGUgZnJhbWUgYnVmZmVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0ZJTE1JQ31cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0hFSkx9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9BQ0VTfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5leHBvc3VyZSAtIFRoZSBleHBvc3VyZSB2YWx1ZSB0d2Vha3MgdGhlIG92ZXJhbGwgYnJpZ2h0bmVzc1xuICAgICAqIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxudWxsfSBbc2V0dGluZ3MucmVuZGVyLnNreWJveF0gLSBUaGUgYXNzZXQgSUQgb2YgdGhlIGN1YmUgbWFwIHRleHR1cmUgdG8gYmVcbiAgICAgKiB1c2VkIGFzIHRoZSBzY2VuZSdzIHNreWJveC4gRGVmYXVsdHMgdG8gbnVsbC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnNreWJveEludGVuc2l0eSAtIE11bHRpcGxpZXIgZm9yIHNreWJveCBpbnRlbnNpdHkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5za3lib3hMdW1pbmFuY2UgLSBMdXggKGxtL21eMikgdmFsdWUgZm9yIHNreWJveCBpbnRlbnNpdHkgd2hlbiBwaHlzaWNhbCBsaWdodCB1bml0cyBhcmUgZW5hYmxlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnNreWJveE1pcCAtIFRoZSBtaXAgbGV2ZWwgb2YgdGhlIHNreWJveCB0byBiZSBkaXNwbGF5ZWQuXG4gICAgICogT25seSB2YWxpZCBmb3IgcHJlZmlsdGVyZWQgY3ViZW1hcCBza3lib3hlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94Um90YXRpb24gLSBSb3RhdGlvbiBvZiBza3lib3guXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodG1hcFNpemVNdWx0aXBsaWVyIC0gVGhlIGxpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbiAtIFRoZSBtYXhpbXVtIGxpZ2h0bWFwIHJlc29sdXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodG1hcE1vZGUgLSBUaGUgbGlnaHRtYXAgYmFraW5nIG1vZGUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1J9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXBcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SRElSfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwICsgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uICh1c2VkIGZvciBidW1wL3NwZWN1bGFyKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2UgLSBFbmFibGUgYmFraW5nIGFtYmllbnQgbGlnaHQgaW50byBsaWdodG1hcHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZU51bVNhbXBsZXMgLSBOdW1iZXIgb2Ygc2FtcGxlcyB0byB1c2Ugd2hlbiBiYWtpbmcgYW1iaWVudCBsaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlU3BoZXJlUGFydCAtIEhvdyBtdWNoIG9mIHRoZSBzcGhlcmUgdG8gaW5jbHVkZSB3aGVuIGJha2luZyBhbWJpZW50IGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzIC0gQnJpZ2huZXNzIG9mIHRoZSBiYWtlZCBhbWJpZW50IG9jY2x1c2lvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QgLSBDb250cmFzdCBvZiB0aGUgYmFrZWQgYW1iaWVudCBvY2NsdXNpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50THVtaW5hbmNlIC0gTHV4IChsbS9tXjIpIHZhbHVlIGZvciBhbWJpZW50IGxpZ2h0IGludGVuc2l0eS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAtIEVuYWJsZSBjbHVzdGVyZWQgbGlnaHRpbmcuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdTaGFkb3dzRW5hYmxlZCAtIElmIHNldCB0byB0cnVlLCB0aGUgY2x1c3RlcmVkIGxpZ2h0aW5nIHdpbGwgc3VwcG9ydCBzaGFkb3dzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQ29va2llc0VuYWJsZWQgLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgY29va2llIHRleHR1cmVzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQgLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgYXJlYSBsaWdodHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ1NoYWRvd0F0bGFzUmVzb2x1dGlvbiAtIFJlc29sdXRpb24gb2YgdGhlIGF0bGFzIHRleHR1cmUgc3RvcmluZyBhbGwgbm9uLWRpcmVjdGlvbmFsIHNoYWRvdyB0ZXh0dXJlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQ29va2llQXRsYXNSZXNvbHV0aW9uIC0gUmVzb2x1dGlvbiBvZiB0aGUgYXRsYXMgdGV4dHVyZSBzdG9yaW5nIGFsbCBub24tZGlyZWN0aW9uYWwgY29va2llIHRleHR1cmVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdNYXhMaWdodHNQZXJDZWxsIC0gTWF4aW11bSBudW1iZXIgb2YgbGlnaHRzIGEgY2VsbCBjYW4gc3RvcmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ1NoYWRvd1R5cGUgLSBUaGUgdHlwZSBvZiBzaGFkb3cgZmlsdGVyaW5nIHVzZWQgYnkgYWxsIHNoYWRvd3MuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNIQURPV19QQ0YxfTogUENGIDF4MSBzYW1wbGluZy5cbiAgICAgKiAtIHtAbGluayBTSEFET1dfUENGM306IFBDRiAzeDMgc2FtcGxpbmcuXG4gICAgICogLSB7QGxpbmsgU0hBRE9XX1BDRjV9OiBQQ0YgNXg1IHNhbXBsaW5nLiBGYWxscyBiYWNrIHRvIHtAbGluayBTSEFET1dfUENGM30gb24gV2ViR0wgMS4wLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdDZWxscyAtIE51bWJlciBvZiBjZWxscyBhbG9uZyBlYWNoIHdvcmxkLXNwYWNlIGF4aXMgdGhlIHNwYWNlIGNvbnRhaW5pbmcgbGlnaHRzXG4gICAgICogaXMgc3ViZGl2aWRlZCBpbnRvLlxuICAgICAqXG4gICAgICogT25seSBsaWdodHMgd2l0aCBiYWtlRGlyPXRydWUgd2lsbCBiZSB1c2VkIGZvciBnZW5lcmF0aW5nIHRoZSBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIHZhciBzZXR0aW5ncyA9IHtcbiAgICAgKiAgICAgcGh5c2ljczoge1xuICAgICAqICAgICAgICAgZ3Jhdml0eTogWzAsIC05LjgsIDBdXG4gICAgICogICAgIH0sXG4gICAgICogICAgIHJlbmRlcjoge1xuICAgICAqICAgICAgICAgZm9nX2VuZDogMTAwMCxcbiAgICAgKiAgICAgICAgIHRvbmVtYXBwaW5nOiAwLFxuICAgICAqICAgICAgICAgc2t5Ym94OiBudWxsLFxuICAgICAqICAgICAgICAgZm9nX2RlbnNpdHk6IDAuMDEsXG4gICAgICogICAgICAgICBnYW1tYV9jb3JyZWN0aW9uOiAxLFxuICAgICAqICAgICAgICAgZXhwb3N1cmU6IDEsXG4gICAgICogICAgICAgICBmb2dfc3RhcnQ6IDEsXG4gICAgICogICAgICAgICBnbG9iYWxfYW1iaWVudDogWzAsIDAsIDBdLFxuICAgICAqICAgICAgICAgc2t5Ym94SW50ZW5zaXR5OiAxLFxuICAgICAqICAgICAgICAgc2t5Ym94Um90YXRpb246IFswLCAwLCAwXSxcbiAgICAgKiAgICAgICAgIGZvZ19jb2xvcjogWzAsIDAsIDBdLFxuICAgICAqICAgICAgICAgbGlnaHRtYXBNb2RlOiAxLFxuICAgICAqICAgICAgICAgZm9nOiAnbm9uZScsXG4gICAgICogICAgICAgICBsaWdodG1hcE1heFJlc29sdXRpb246IDIwNDgsXG4gICAgICogICAgICAgICBza3lib3hNaXA6IDIsXG4gICAgICogICAgICAgICBsaWdodG1hcFNpemVNdWx0aXBsaWVyOiAxNlxuICAgICAqICAgICB9XG4gICAgICogfTtcbiAgICAgKiBhcHAuYXBwbHlTY2VuZVNldHRpbmdzKHNldHRpbmdzKTtcbiAgICAgKi9cbiAgICBhcHBseVNjZW5lU2V0dGluZ3Moc2V0dGluZ3MpIHtcbiAgICAgICAgbGV0IGFzc2V0O1xuXG4gICAgICAgIGlmICh0aGlzLnN5c3RlbXMucmlnaWRib2R5ICYmIHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29uc3QgZ3Jhdml0eSA9IHNldHRpbmdzLnBoeXNpY3MuZ3Jhdml0eTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5yaWdpZGJvZHkuZ3Jhdml0eS5zZXQoZ3Jhdml0eVswXSwgZ3Jhdml0eVsxXSwgZ3Jhdml0eVsyXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNjZW5lLmFwcGx5U2V0dGluZ3Moc2V0dGluZ3MpO1xuXG4gICAgICAgIGlmIChzZXR0aW5ncy5yZW5kZXIuaGFzT3duUHJvcGVydHkoJ3NreWJveCcpKSB7XG4gICAgICAgICAgICBpZiAoc2V0dGluZ3MucmVuZGVyLnNreWJveCkge1xuICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5hc3NldHMuZ2V0KHNldHRpbmdzLnJlbmRlci5za3lib3gpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0U2t5Ym94KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vbmNlKCdhZGQ6JyArIHNldHRpbmdzLnJlbmRlci5za3lib3gsIHRoaXMuc2V0U2t5Ym94LCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U2t5Ym94KG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgYXJlYSBsaWdodCBMVVQgdGFibGVzIGZvciB0aGlzIGFwcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGx0Y01hdDEgLSBMVVQgdGFibGUgb2YgdHlwZSBgYXJyYXlgIHRvIGJlIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBsdGNNYXQyIC0gTFVUIHRhYmxlIG9mIHR5cGUgYGFycmF5YCB0byBiZSBzZXQuXG4gICAgICovXG4gICAgc2V0QXJlYUxpZ2h0THV0cyhsdGNNYXQxLCBsdGNNYXQyKSB7XG5cbiAgICAgICAgaWYgKGx0Y01hdDEgJiYgbHRjTWF0Mikge1xuICAgICAgICAgICAgQXJlYUxpZ2h0THV0cy5zZXQodGhpcy5ncmFwaGljc0RldmljZSwgbHRjTWF0MSwgbHRjTWF0Mik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKFwic2V0QXJlYUxpZ2h0THV0czogTFVUcyBmb3IgYXJlYSBsaWdodCBhcmUgbm90IHZhbGlkXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc2t5Ym94IGFzc2V0IHRvIGN1cnJlbnQgc2NlbmUsIGFuZCBzdWJzY3JpYmVzIHRvIGFzc2V0IGxvYWQvY2hhbmdlIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gQXNzZXQgb2YgdHlwZSBgc2t5Ym94YCB0byBiZSBzZXQgdG8sIG9yIG51bGwgdG8gcmVtb3ZlIHNreWJveC5cbiAgICAgKi9cbiAgICBzZXRTa3lib3goYXNzZXQpIHtcbiAgICAgICAgaWYgKGFzc2V0ICE9PSB0aGlzLl9za3lib3hBc3NldCkge1xuICAgICAgICAgICAgY29uc3Qgb25Ta3lib3hSZW1vdmVkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U2t5Ym94KG51bGwpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3Qgb25Ta3lib3hDaGFuZ2VkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc2NlbmUuc2V0U2t5Ym94KHRoaXMuX3NreWJveEFzc2V0ID8gdGhpcy5fc2t5Ym94QXNzZXQucmVzb3VyY2VzIDogbnVsbCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBjbGVhbnVwIHByZXZpb3VzIGFzc2V0XG4gICAgICAgICAgICBpZiAodGhpcy5fc2t5Ym94QXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vZmYoJ2xvYWQ6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9mZigncmVtb3ZlOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldC5vZmYoJ2NoYW5nZScsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBuZXcgYXNzZXRcbiAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0ID0gYXNzZXQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2t5Ym94QXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vbignbG9hZDonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub25jZSgncmVtb3ZlOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldC5vbignY2hhbmdlJywgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjZW5lLnNreWJveE1pcCA9PT0gMCAmJiAhdGhpcy5fc2t5Ym94QXNzZXQubG9hZEZhY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0LmxvYWRGYWNlcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMubG9hZCh0aGlzLl9za3lib3hBc3NldCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG9uU2t5Ym94Q2hhbmdlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZpcnN0QmFrZSgpIHtcbiAgICAgICAgdGhpcy5saWdodG1hcHBlcj8uYmFrZShudWxsLCB0aGlzLnNjZW5lLmxpZ2h0bWFwTW9kZSk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZpcnN0QmF0Y2goKSB7XG4gICAgICAgIHRoaXMuYmF0Y2hlcj8uZ2VuZXJhdGUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlIGFuIG9wcG9ydHVuaXR5IHRvIG1vZGlmeSB0aGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdGltZXN0YW1wXSAtIFRoZSB0aW1lc3RhbXAgc3VwcGxpZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ8dW5kZWZpbmVkfSBUaGUgbW9kaWZpZWQgdGltZXN0YW1wLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfcHJvY2Vzc1RpbWVzdGFtcCh0aW1lc3RhbXApIHtcbiAgICAgICAgcmV0dXJuIHRpbWVzdGFtcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHNpbmdsZSBsaW5lLiBMaW5lIHN0YXJ0IGFuZCBlbmQgY29vcmRpbmF0ZXMgYXJlIHNwZWNpZmllZCBpbiB3b3JsZC1zcGFjZS4gVGhlIGxpbmVcbiAgICAgKiB3aWxsIGJlIGZsYXQtc2hhZGVkIHdpdGggdGhlIHNwZWNpZmllZCBjb2xvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc3RhcnQgLSBUaGUgc3RhcnQgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBvZiB0aGUgbGluZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSBlbmQgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBvZiB0aGUgbGluZS5cbiAgICAgKiBAcGFyYW0ge0NvbG9yfSBbY29sb3JdIC0gVGhlIGNvbG9yIG9mIHRoZSBsaW5lLiBJdCBkZWZhdWx0cyB0byB3aGl0ZSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIGxpbmUgaXMgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBsaW5lIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSAxLXVuaXQgbG9uZyB3aGl0ZSBsaW5lXG4gICAgICogdmFyIHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3TGluZShzdGFydCwgZW5kKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIDEtdW5pdCBsb25nIHJlZCBsaW5lIHdoaWNoIGlzIG5vdCBkZXB0aCB0ZXN0ZWQgYW5kIHJlbmRlcnMgb24gdG9wIG9mIG90aGVyIGdlb21ldHJ5XG4gICAgICogdmFyIHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogdmFyIGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3TGluZShzdGFydCwgZW5kLCBwYy5Db2xvci5SRUQsIGZhbHNlKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIDEtdW5pdCBsb25nIHdoaXRlIGxpbmUgaW50byB0aGUgd29ybGQgbGF5ZXJcbiAgICAgKiB2YXIgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiB2YXIgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogdmFyIHdvcmxkTGF5ZXIgPSBhcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChwYy5MQVlFUklEX1dPUkxEKTtcbiAgICAgKiBhcHAuZHJhd0xpbmUoc3RhcnQsIGVuZCwgcGMuQ29sb3IuV0hJVEUsIHRydWUsIHdvcmxkTGF5ZXIpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lKHN0YXJ0LCBlbmQsIGNvbG9yLCBkZXB0aFRlc3QsIGxheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuZHJhd0xpbmUoc3RhcnQsIGVuZCwgY29sb3IsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gYXJiaXRyYXJ5IG51bWJlciBvZiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzLiBUaGUgbGluZXMgYXJlIG5vdCBjb25uZWN0ZWQgYnkgZWFjaFxuICAgICAqIHN1YnNlcXVlbnQgcG9pbnQgaW4gdGhlIGFycmF5LiBJbnN0ZWFkLCB0aGV5IGFyZSBpbmRpdmlkdWFsIHNlZ21lbnRzIHNwZWNpZmllZCBieSB0d29cbiAgICAgKiBwb2ludHMuIFRoZXJlZm9yZSwgdGhlIGxlbmd0aHMgb2YgdGhlIHN1cHBsaWVkIHBvc2l0aW9uIGFuZCBjb2xvciBhcnJheXMgbXVzdCBiZSB0aGUgc2FtZVxuICAgICAqIGFuZCBhbHNvIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAyLiBUaGUgY29sb3JzIG9mIHRoZSBlbmRzIG9mIGVhY2ggbGluZSBzZWdtZW50IHdpbGwgYmVcbiAgICAgKiBpbnRlcnBvbGF0ZWQgYWxvbmcgdGhlIGxlbmd0aCBvZiBlYWNoIGxpbmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzNbXX0gcG9zaXRpb25zIC0gQW4gYXJyYXkgb2YgcG9pbnRzIHRvIGRyYXcgbGluZXMgYmV0d2Vlbi4gVGhlIGxlbmd0aCBvZiB0aGVcbiAgICAgKiBhcnJheSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMi5cbiAgICAgKiBAcGFyYW0ge0NvbG9yW119IGNvbG9ycyAtIEFuIGFycmF5IG9mIGNvbG9ycyB0byBjb2xvciB0aGUgbGluZXMuIFRoaXMgbXVzdCBiZSB0aGUgc2FtZVxuICAgICAqIGxlbmd0aCBhcyB0aGUgcG9zaXRpb24gYXJyYXkuIFRoZSBsZW5ndGggb2YgdGhlIGFycmF5IG11c3QgYWxzbyBiZSBhIG11bHRpcGxlIG9mIDIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbGluZXMgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIHNpbmdsZSBsaW5lLCB3aXRoIHVuaXF1ZSBjb2xvcnMgZm9yIGVhY2ggcG9pbnRcbiAgICAgKiB2YXIgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiB2YXIgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogYXBwLmRyYXdMaW5lcyhbc3RhcnQsIGVuZF0sIFtwYy5Db2xvci5SRUQsIHBjLkNvbG9yLldISVRFXSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgMiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzXG4gICAgICogdmFyIHBvaW50cyA9IFtcbiAgICAgKiAgICAgLy8gTGluZSAxXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDAsIDAsIDApLFxuICAgICAqICAgICBuZXcgcGMuVmVjMygxLCAwLCAwKSxcbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDEsIDEsIDApLFxuICAgICAqICAgICBuZXcgcGMuVmVjMygxLCAxLCAxKVxuICAgICAqIF07XG4gICAgICogdmFyIGNvbG9ycyA9IFtcbiAgICAgKiAgICAgLy8gTGluZSAxXG4gICAgICogICAgIHBjLkNvbG9yLlJFRCxcbiAgICAgKiAgICAgcGMuQ29sb3IuWUVMTE9XLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgcGMuQ29sb3IuQ1lBTixcbiAgICAgKiAgICAgcGMuQ29sb3IuQkxVRVxuICAgICAqIF07XG4gICAgICogYXBwLmRyYXdMaW5lcyhwb2ludHMsIGNvbG9ycyk7XG4gICAgICovXG4gICAgZHJhd0xpbmVzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmRyYXdMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVycyBhbiBhcmJpdHJhcnkgbnVtYmVyIG9mIGRpc2NyZXRlIGxpbmUgc2VnbWVudHMuIFRoZSBsaW5lcyBhcmUgbm90IGNvbm5lY3RlZCBieSBlYWNoXG4gICAgICogc3Vic2VxdWVudCBwb2ludCBpbiB0aGUgYXJyYXkuIEluc3RlYWQsIHRoZXkgYXJlIGluZGl2aWR1YWwgc2VnbWVudHMgc3BlY2lmaWVkIGJ5IHR3b1xuICAgICAqIHBvaW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIHBvaW50cyB0byBkcmF3IGxpbmVzIGJldHdlZW4uIEVhY2ggcG9pbnQgaXNcbiAgICAgKiByZXByZXNlbnRlZCBieSAzIG51bWJlcnMgLSB4LCB5IGFuZCB6IGNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gY29sb3JzIC0gQW4gYXJyYXkgb2YgY29sb3JzIHRvIGNvbG9yIHRoZSBsaW5lcy4gVGhpcyBtdXN0IGJlIHRoZSBzYW1lXG4gICAgICogbGVuZ3RoIGFzIHRoZSBwb3NpdGlvbiBhcnJheS4gVGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgbXVzdCBhbHNvIGJlIGEgbXVsdGlwbGUgb2YgMi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBsaW5lcyBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIDIgZGlzY3JldGUgbGluZSBzZWdtZW50c1xuICAgICAqIHZhciBwb2ludHMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICAwLCAwLCAwLFxuICAgICAqICAgICAxLCAwLCAwLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgMSwgMSwgMCxcbiAgICAgKiAgICAgMSwgMSwgMVxuICAgICAqIF07XG4gICAgICogdmFyIGNvbG9ycyA9IFtcbiAgICAgKiAgICAgLy8gTGluZSAxXG4gICAgICogICAgIDEsIDAsIDAsIDEsICAvLyByZWRcbiAgICAgKiAgICAgMCwgMSwgMCwgMSwgIC8vIGdyZWVuXG4gICAgICogICAgIC8vIExpbmUgMlxuICAgICAqICAgICAwLCAwLCAxLCAxLCAgLy8gYmx1ZVxuICAgICAqICAgICAxLCAxLCAxLCAxICAgLy8gd2hpdGVcbiAgICAgKiBdO1xuICAgICAqIGFwcC5kcmF3TGluZUFycmF5cyhwb2ludHMsIGNvbG9ycyk7XG4gICAgICovXG4gICAgZHJhd0xpbmVBcnJheXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuZHJhd0xpbmVBcnJheXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgd2lyZWZyYW1lIHNwaGVyZSB3aXRoIGNlbnRlciwgcmFkaXVzIGFuZCBjb2xvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gY2VudGVyIC0gVGhlIGNlbnRlciBvZiB0aGUgc3BoZXJlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSByYWRpdXMgLSBUaGUgcmFkaXVzIG9mIHRoZSBzcGhlcmUuXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW2NvbG9yXSAtIFRoZSBjb2xvciBvZiB0aGUgc3BoZXJlLiBJdCBkZWZhdWx0cyB0byB3aGl0ZSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbc2VnbWVudHNdIC0gTnVtYmVyIG9mIGxpbmUgc2VnbWVudHMgdXNlZCB0byByZW5kZXIgdGhlIGNpcmNsZXMgZm9ybWluZyB0aGVcbiAgICAgKiBzcGhlcmUuIERlZmF1bHRzIHRvIDIwLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIHNwaGVyZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlXG4gICAgICogZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBzcGhlcmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIHJlZCB3aXJlIHNwaGVyZSB3aXRoIHJhZGl1cyBvZiAxXG4gICAgICogdmFyIGNlbnRlciA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3V2lyZVNwaGVyZShjZW50ZXIsIDEuMCwgcGMuQ29sb3IuUkVEKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1dpcmVTcGhlcmUoY2VudGVyLCByYWRpdXMsIGNvbG9yID0gQ29sb3IuV0hJVEUsIHNlZ21lbnRzID0gMjAsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdXaXJlU3BoZXJlKGNlbnRlciwgcmFkaXVzLCBjb2xvciwgc2VnbWVudHMsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgd2lyZWZyYW1lIGF4aXMgYWxpZ25lZCBib3ggc3BlY2lmaWVkIGJ5IG1pbiBhbmQgbWF4IHBvaW50cyBhbmQgY29sb3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG1pblBvaW50IC0gVGhlIG1pbiBjb3JuZXIgcG9pbnQgb2YgdGhlIGJveC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG1heFBvaW50IC0gVGhlIG1heCBjb3JuZXIgcG9pbnQgb2YgdGhlIGJveC5cbiAgICAgKiBAcGFyYW0ge0NvbG9yfSBbY29sb3JdIC0gVGhlIGNvbG9yIG9mIHRoZSBzcGhlcmUuIEl0IGRlZmF1bHRzIHRvIHdoaXRlIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgc3BoZXJlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGVcbiAgICAgKiBkZXB0aCBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHNwaGVyZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgcmVkIHdpcmUgYWxpZ25lZCBib3hcbiAgICAgKiB2YXIgbWluID0gbmV3IHBjLlZlYzMoLTEsIC0xLCAtMSk7XG4gICAgICogdmFyIG1heCA9IG5ldyBwYy5WZWMzKDEsIDEsIDEpO1xuICAgICAqIGFwcC5kcmF3V2lyZUFsaWduZWRCb3gobWluLCBtYXgsIHBjLkNvbG9yLlJFRCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdXaXJlQWxpZ25lZEJveChtaW5Qb2ludCwgbWF4UG9pbnQsIGNvbG9yID0gQ29sb3IuV0hJVEUsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdXaXJlQWxpZ25lZEJveChtaW5Qb2ludCwgbWF4UG9pbnQsIGNvbG9yLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3IG1lc2hJbnN0YW5jZSBhdCB0aGlzIGZyYW1lXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcycpLk1lc2hJbnN0YW5jZX0gbWVzaEluc3RhbmNlIC0gVGhlIG1lc2ggaW5zdGFuY2VcbiAgICAgKiB0byBkcmF3LlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBtZXNoIGluc3RhbmNlIGludG8uIERlZmF1bHRzIHRvXG4gICAgICoge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd01lc2hJbnN0YW5jZShtZXNoSW5zdGFuY2UsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdNZXNoKG51bGwsIG51bGwsIG51bGwsIG1lc2hJbnN0YW5jZSwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXcgbWVzaCBhdCB0aGlzIGZyYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NjZW5lL21lc2guanMnKS5NZXNofSBtZXNoIC0gVGhlIG1lc2ggdG8gZHJhdy5cbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB0byB1c2UgdG8gcmVuZGVyIHRoZSBtZXNoLlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbWF0cml4IC0gVGhlIG1hdHJpeCB0byB1c2UgdG8gcmVuZGVyIHRoZSBtZXNoLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBtZXNoIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdNZXNoKG1lc2gsIG1hdGVyaWFsLCBtYXRyaXgsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdNZXNoKG1hdGVyaWFsLCBtYXRyaXgsIG1lc2gsIG51bGwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3IHF1YWQgb2Ygc2l6ZSBbLTAuNSwgMC41XSBhdCB0aGlzIGZyYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtNYXQ0fSBtYXRyaXggLSBUaGUgbWF0cml4IHRvIHVzZSB0byByZW5kZXIgdGhlIHF1YWQuXG4gICAgICogQHBhcmFtIHtNYXRlcmlhbH0gbWF0ZXJpYWwgLSBUaGUgbWF0ZXJpYWwgdG8gdXNlIHRvIHJlbmRlciB0aGUgcXVhZC5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgcXVhZCBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3UXVhZChtYXRyaXgsIG1hdGVyaWFsLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChtYXRlcmlhbCwgbWF0cml4LCB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRRdWFkTWVzaCgpLCBudWxsLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSB0ZXh0dXJlIGF0IFt4LCB5XSBwb3NpdGlvbiBvbiBzY3JlZW4sIHdpdGggc2l6ZSBbd2lkdGgsIGhlaWdodF0uIFRoZSBvcmlnaW4gb2YgdGhlXG4gICAgICogc2NyZWVuIGlzIHRvcC1sZWZ0IFswLCAwXS4gQ29vcmRpbmF0ZXMgYW5kIHNpemVzIGFyZSBpbiBwcm9qZWN0ZWQgc3BhY2UgKC0xIC4uIDEpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeCBjb29yZGluYXRlIG9uIHRoZSBzY3JlZW4gb2YgdGhlIHRvcCBsZWZ0IGNvcm5lciBvZiB0aGUgdGV4dHVyZS5cbiAgICAgKiBTaG91bGQgYmUgaW4gdGhlIHJhbmdlIFstMSwgMV0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlIG9uIHRoZSBzY3JlZW4gb2YgdGhlIHRvcCBsZWZ0IGNvcm5lciBvZiB0aGUgdGV4dHVyZS5cbiAgICAgKiBTaG91bGQgYmUgaW4gdGhlIHJhbmdlIFstMSwgMV0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIHdpZHRoIG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpbiB0aGVcbiAgICAgKiByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBoZWlnaHQgb2YgdGhlIHJlY3RhbmdsZSBvZiB0aGUgcmVuZGVyZWQgdGV4dHVyZS4gU2hvdWxkIGJlIGluXG4gICAgICogdGhlIHJhbmdlIFswLCAyXS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9IHRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byByZW5kZXIuXG4gICAgICogQHBhcmFtIHtNYXRlcmlhbH0gbWF0ZXJpYWwgLSBUaGUgbWF0ZXJpYWwgdXNlZCB3aGVuIHJlbmRlcmluZyB0aGUgdGV4dHVyZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgdGV4dHVyZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3VGV4dHVyZSh4LCB5LCB3aWR0aCwgaGVpZ2h0LCB0ZXh0dXJlLCBtYXRlcmlhbCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcblxuICAgICAgICAvLyBUT0RPOiBpZiB0aGlzIGlzIHVzZWQgZm9yIGFueXRoaW5nIG90aGVyIHRoYW4gZGVidWcgdGV4dHVyZSBkaXNwbGF5LCB3ZSBzaG91bGQgb3B0aW1pemUgdGhpcyB0byBhdm9pZCBhbGxvY2F0aW9uc1xuICAgICAgICBjb25zdCBtYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICBtYXRyaXguc2V0VFJTKG5ldyBWZWMzKHgsIHksIDAuMCksIFF1YXQuSURFTlRJVFksIG5ldyBWZWMzKHdpZHRoLCBoZWlnaHQsIDAuMCkpO1xuXG4gICAgICAgIGlmICghbWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsID0gbmV3IE1hdGVyaWFsKCk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoXCJjb2xvck1hcFwiLCB0ZXh0dXJlKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNoYWRlciA9IHRoaXMuc2NlbmUuaW1tZWRpYXRlLmdldFRleHR1cmVTaGFkZXIoKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kcmF3UXVhZChtYXRyaXgsIG1hdGVyaWFsLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSBkZXB0aCB0ZXh0dXJlIGF0IFt4LCB5XSBwb3NpdGlvbiBvbiBzY3JlZW4sIHdpdGggc2l6ZSBbd2lkdGgsIGhlaWdodF0uIFRoZSBvcmlnaW4gb2ZcbiAgICAgKiB0aGUgc2NyZWVuIGlzIHRvcC1sZWZ0IFswLCAwXS4gQ29vcmRpbmF0ZXMgYW5kIHNpemVzIGFyZSBpbiBwcm9qZWN0ZWQgc3BhY2UgKC0xIC4uIDEpLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeCBjb29yZGluYXRlIG9uIHRoZSBzY3JlZW4gb2YgdGhlIHRvcCBsZWZ0IGNvcm5lciBvZiB0aGUgdGV4dHVyZS5cbiAgICAgKiBTaG91bGQgYmUgaW4gdGhlIHJhbmdlIFstMSwgMV0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBjb29yZGluYXRlIG9uIHRoZSBzY3JlZW4gb2YgdGhlIHRvcCBsZWZ0IGNvcm5lciBvZiB0aGUgdGV4dHVyZS5cbiAgICAgKiBTaG91bGQgYmUgaW4gdGhlIHJhbmdlIFstMSwgMV0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIHdpZHRoIG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpbiB0aGVcbiAgICAgKiByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGhlaWdodCAtIFRoZSBoZWlnaHQgb2YgdGhlIHJlY3RhbmdsZSBvZiB0aGUgcmVuZGVyZWQgdGV4dHVyZS4gU2hvdWxkIGJlIGluXG4gICAgICogdGhlIHJhbmdlIFswLCAyXS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgdGV4dHVyZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3RGVwdGhUZXh0dXJlKHgsIHksIHdpZHRoLCBoZWlnaHQsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IE1hdGVyaWFsKCk7XG4gICAgICAgIG1hdGVyaWFsLnNoYWRlciA9IHRoaXMuc2NlbmUuaW1tZWRpYXRlLmdldERlcHRoVGV4dHVyZVNoYWRlcigpO1xuICAgICAgICBtYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICB0aGlzLmRyYXdUZXh0dXJlKHgsIHksIHdpZHRoLCBoZWlnaHQsIG51bGwsIG1hdGVyaWFsLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveXMgYXBwbGljYXRpb24gYW5kIHJlbW92ZXMgYWxsIGV2ZW50IGxpc3RlbmVycyBhdCB0aGUgZW5kIG9mIHRoZSBjdXJyZW50IGVuZ2luZSBmcmFtZVxuICAgICAqIHVwZGF0ZS4gSG93ZXZlciwgaWYgY2FsbGVkIG91dHNpZGUgb2YgdGhlIGVuZ2luZSBmcmFtZSB1cGRhdGUsIGNhbGxpbmcgZGVzdHJveSgpIHdpbGxcbiAgICAgKiBkZXN0cm95IHRoZSBhcHBsaWNhdGlvbiBpbW1lZGlhdGVseS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLmRlc3Ryb3koKTtcbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBpZiAodGhpcy5faW5GcmFtZVVwZGF0ZSkge1xuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVJlcXVlc3RlZCA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYW52YXNJZCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLmlkO1xuXG4gICAgICAgIHRoaXMub2ZmKCdsaWJyYXJpZXNsb2FkZWQnKTtcblxuICAgICAgICBpZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3p2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21zdmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd3ZWJraXR2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5yb290LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5yb290ID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5tb3VzZSkge1xuICAgICAgICAgICAgdGhpcy5tb3VzZS5vZmYoKTtcbiAgICAgICAgICAgIHRoaXMubW91c2UuZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLm1vdXNlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmtleWJvYXJkKSB7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkLm9mZigpO1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZC5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudG91Y2gpIHtcbiAgICAgICAgICAgIHRoaXMudG91Y2gub2ZmKCk7XG4gICAgICAgICAgICB0aGlzLnRvdWNoLmRldGFjaCgpO1xuICAgICAgICAgICAgdGhpcy50b3VjaCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbGVtZW50SW5wdXQpIHtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudElucHV0LmRldGFjaCgpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY29udHJvbGxlcikge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5kZXN0cm95KCk7XG5cbiAgICAgICAgLy8gbGF5ZXIgY29tcG9zaXRpb25cbiAgICAgICAgaWYgKHRoaXMuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lLmxheWVycy5kZXN0cm95KCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZXN0cm95IGFsbCB0ZXh0dXJlIHJlc291cmNlc1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLmFzc2V0cy5saXN0KCk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXNzZXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhc3NldHNbaV0udW5sb2FkKCk7XG4gICAgICAgICAgICBhc3NldHNbaV0ub2ZmKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5hc3NldHMub2ZmKCk7XG5cblxuICAgICAgICAvLyBkZXN0cm95IGJ1bmRsZSByZWdpc3RyeVxuICAgICAgICB0aGlzLmJ1bmRsZXMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmJ1bmRsZXMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuaTE4bi5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuaTE4biA9IG51bGw7XG5cbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gdGhpcy5sb2FkZXIuZ2V0SGFuZGxlcignc2NyaXB0JykuX2NhY2hlKSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5sb2FkZXIuZ2V0SGFuZGxlcignc2NyaXB0JykuX2NhY2hlW2tleV07XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBlbGVtZW50LnBhcmVudE5vZGU7XG4gICAgICAgICAgICBpZiAocGFyZW50KSBwYXJlbnQucmVtb3ZlQ2hpbGQoZWxlbWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5sb2FkZXIuZ2V0SGFuZGxlcignc2NyaXB0JykuX2NhY2hlID0ge307XG5cbiAgICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zY2VuZS5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc3lzdGVtcyA9IG51bGw7XG4gICAgICAgIHRoaXMuY29udGV4dCA9IG51bGw7XG5cbiAgICAgICAgLy8gc2NyaXB0IHJlZ2lzdHJ5XG4gICAgICAgIHRoaXMuc2NyaXB0cy5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2NyaXB0cyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5zY2VuZXMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjZW5lcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5saWdodG1hcHBlcj8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyID0gbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hlcikge1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaGVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2VudGl0eUluZGV4ID0ge307XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vblByZVJlbmRlck9wYXF1ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25Qb3N0UmVuZGVyT3BhcXVlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vbkRpc2FibGUgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoLm9uRW5hYmxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyV29ybGQgPSBudWxsO1xuXG4gICAgICAgIHRoaXM/LnhyLmVuZCgpO1xuICAgICAgICB0aGlzPy54ci5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5yZW5kZXJlci5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMucmVuZGVyZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlID0gbnVsbDtcblxuICAgICAgICB0aGlzLnRpY2sgPSBudWxsO1xuXG4gICAgICAgIHRoaXMub2ZmKCk7IC8vIHJlbW92ZSBhbGwgZXZlbnRzXG5cbiAgICAgICAgaWYgKHRoaXMuX3NvdW5kTWFuYWdlcikge1xuICAgICAgICAgICAgdGhpcy5fc291bmRNYW5hZ2VyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBzY3JpcHQuYXBwID0gbnVsbDtcblxuICAgICAgICBBcHBCYXNlLl9hcHBsaWNhdGlvbnNbY2FudmFzSWRdID0gbnVsbDtcblxuICAgICAgICBpZiAoZ2V0QXBwbGljYXRpb24oKSA9PT0gdGhpcykge1xuICAgICAgICAgICAgc2V0QXBwbGljYXRpb24obnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgZW50aXR5IGZyb20gdGhlIGluZGV4IGJ5IGd1aWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZ3VpZCAtIFRoZSBHVUlEIHRvIHNlYXJjaCBmb3IuXG4gICAgICogQHJldHVybnMge0VudGl0eX0gVGhlIEVudGl0eSB3aXRoIHRoZSBHVUlEIG9yIG51bGwuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGdldEVudGl0eUZyb21JbmRleChndWlkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbnRpdHlJbmRleFtndWlkXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1NjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZWdpc3RlclNjZW5lSW1tZWRpYXRlKHNjZW5lKSB7XG4gICAgICAgIHRoaXMub24oJ3Bvc3RyZW5kZXInLCBzY2VuZS5pbW1lZGlhdGUub25Qb3N0UmVuZGVyLCBzY2VuZS5pbW1lZGlhdGUpO1xuICAgIH1cbn1cblxuLy8gc3RhdGljIGRhdGFcbmNvbnN0IF9mcmFtZUVuZERhdGEgPSB7fTtcblxuLyoqXG4gKiBDYWxsYmFjayB1c2VkIGJ5IHtAbGluayBBcHBCYXNlI3N0YXJ0fSBhbmQgaXRzZWxmIHRvIHJlcXVlc3RcbiAqIHRoZSByZW5kZXJpbmcgb2YgYSBuZXcgYW5pbWF0aW9uIGZyYW1lLlxuICpcbiAqIEBjYWxsYmFjayBNYWtlVGlja0NhbGxiYWNrXG4gKiBAcGFyYW0ge251bWJlcn0gW3RpbWVzdGFtcF0gLSBUaGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAqIEBwYXJhbSB7Kn0gW2ZyYW1lXSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gKiBAaWdub3JlXG4gKi9cblxuLyoqXG4gKiBDcmVhdGUgdGljayBmdW5jdGlvbiB0byBiZSB3cmFwcGVkIGluIGNsb3N1cmUuXG4gKlxuICogQHBhcmFtIHtBcHBCYXNlfSBfYXBwIC0gVGhlIGFwcGxpY2F0aW9uLlxuICogQHJldHVybnMge01ha2VUaWNrQ2FsbGJhY2t9IFRoZSB0aWNrIGZ1bmN0aW9uLlxuICogQHByaXZhdGVcbiAqL1xuY29uc3QgbWFrZVRpY2sgPSBmdW5jdGlvbiAoX2FwcCkge1xuICAgIGNvbnN0IGFwcGxpY2F0aW9uID0gX2FwcDtcbiAgICBsZXQgZnJhbWVSZXF1ZXN0O1xuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdGltZXN0YW1wXSAtIFRoZSB0aW1lc3RhbXAgc3VwcGxpZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLlxuICAgICAqIEBwYXJhbSB7Kn0gW2ZyYW1lXSAtIFhSRnJhbWUgZnJvbSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICovXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0aW1lc3RhbXAsIGZyYW1lKSB7XG4gICAgICAgIGlmICghYXBwbGljYXRpb24uZ3JhcGhpY3NEZXZpY2UpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgc2V0QXBwbGljYXRpb24oYXBwbGljYXRpb24pO1xuXG4gICAgICAgIGlmIChmcmFtZVJlcXVlc3QpIHtcbiAgICAgICAgICAgIHdpbmRvdy5jYW5jZWxBbmltYXRpb25GcmFtZShmcmFtZVJlcXVlc3QpO1xuICAgICAgICAgICAgZnJhbWVSZXF1ZXN0ID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGhhdmUgY3VycmVudCBhcHBsaWNhdGlvbiBwb2ludGVyIGluIHBjXG4gICAgICAgIGFwcCA9IGFwcGxpY2F0aW9uO1xuXG4gICAgICAgIGNvbnN0IGN1cnJlbnRUaW1lID0gYXBwbGljYXRpb24uX3Byb2Nlc3NUaW1lc3RhbXAodGltZXN0YW1wKSB8fCBub3coKTtcbiAgICAgICAgY29uc3QgbXMgPSBjdXJyZW50VGltZSAtIChhcHBsaWNhdGlvbi5fdGltZSB8fCBjdXJyZW50VGltZSk7XG4gICAgICAgIGxldCBkdCA9IG1zIC8gMTAwMC4wO1xuICAgICAgICBkdCA9IG1hdGguY2xhbXAoZHQsIDAsIGFwcGxpY2F0aW9uLm1heERlbHRhVGltZSk7XG4gICAgICAgIGR0ICo9IGFwcGxpY2F0aW9uLnRpbWVTY2FsZTtcblxuICAgICAgICBhcHBsaWNhdGlvbi5fdGltZSA9IGN1cnJlbnRUaW1lO1xuXG4gICAgICAgIC8vIFN1Ym1pdCBhIHJlcXVlc3QgdG8gcXVldWUgdXAgYSBuZXcgYW5pbWF0aW9uIGZyYW1lIGltbWVkaWF0ZWx5XG4gICAgICAgIGlmIChhcHBsaWNhdGlvbi54cj8uc2Vzc2lvbikge1xuICAgICAgICAgICAgZnJhbWVSZXF1ZXN0ID0gYXBwbGljYXRpb24ueHIuc2Vzc2lvbi5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYXBwbGljYXRpb24udGljayk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcmFtZVJlcXVlc3QgPSBwbGF0Zm9ybS5icm93c2VyID8gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShhcHBsaWNhdGlvbi50aWNrKSA6IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXBwbGljYXRpb24uZ3JhcGhpY3NEZXZpY2UuY29udGV4dExvc3QpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgYXBwbGljYXRpb24uX2ZpbGxGcmFtZVN0YXRzQmFzaWMoY3VycmVudFRpbWUsIGR0LCBtcyk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBhcHBsaWNhdGlvbi5fZmlsbEZyYW1lU3RhdHMoKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgYXBwbGljYXRpb24uX2luRnJhbWVVcGRhdGUgPSB0cnVlO1xuICAgICAgICBhcHBsaWNhdGlvbi5maXJlKFwiZnJhbWV1cGRhdGVcIiwgbXMpO1xuXG4gICAgICAgIGxldCBzaG91bGRSZW5kZXJGcmFtZSA9IHRydWU7XG5cbiAgICAgICAgaWYgKGZyYW1lKSB7XG4gICAgICAgICAgICBzaG91bGRSZW5kZXJGcmFtZSA9IGFwcGxpY2F0aW9uLnhyPy51cGRhdGUoZnJhbWUpO1xuICAgICAgICAgICAgYXBwbGljYXRpb24uZ3JhcGhpY3NEZXZpY2UuZGVmYXVsdEZyYW1lYnVmZmVyID0gZnJhbWUuc2Vzc2lvbi5yZW5kZXJTdGF0ZS5iYXNlTGF5ZXIuZnJhbWVidWZmZXI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcHBsaWNhdGlvbi5ncmFwaGljc0RldmljZS5kZWZhdWx0RnJhbWVidWZmZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNob3VsZFJlbmRlckZyYW1lKSB7XG5cbiAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0ZSQU1FLCBgLS0tLSBGcmFtZSAke2FwcGxpY2F0aW9uLmZyYW1lfWApO1xuICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfRlJBTUVfVElNRSwgYC0tIFVwZGF0ZVN0YXJ0ICR7bm93KCkudG9GaXhlZCgyKX1tc2ApO1xuXG4gICAgICAgICAgICBhcHBsaWNhdGlvbi51cGRhdGUoZHQpO1xuXG4gICAgICAgICAgICBhcHBsaWNhdGlvbi5maXJlKFwiZnJhbWVyZW5kZXJcIik7XG5cblxuICAgICAgICAgICAgaWYgKGFwcGxpY2F0aW9uLmF1dG9SZW5kZXIgfHwgYXBwbGljYXRpb24ucmVuZGVyTmV4dEZyYW1lKSB7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9GUkFNRV9USU1FLCBgLS0gUmVuZGVyU3RhcnQgJHtub3coKS50b0ZpeGVkKDIpfW1zYCk7XG5cbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi51cGRhdGVDYW52YXNTaXplKCk7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24ucmVuZGVyKCk7XG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24ucmVuZGVyTmV4dEZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9GUkFNRV9USU1FLCBgLS0gUmVuZGVyRW5kICR7bm93KCkudG9GaXhlZCgyKX1tc2ApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZXQgZXZlbnQgZGF0YVxuICAgICAgICAgICAgX2ZyYW1lRW5kRGF0YS50aW1lc3RhbXAgPSBub3coKTtcbiAgICAgICAgICAgIF9mcmFtZUVuZERhdGEudGFyZ2V0ID0gYXBwbGljYXRpb247XG5cbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmZpcmUoXCJmcmFtZWVuZFwiLCBfZnJhbWVFbmREYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9pbkZyYW1lVXBkYXRlID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGFwcGxpY2F0aW9uLl9kZXN0cm95UmVxdWVzdGVkKSB7XG4gICAgICAgICAgICBhcHBsaWNhdGlvbi5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9O1xufTtcblxuZXhwb3J0IHsgYXBwLCBBcHBCYXNlIH07XG4iXSwibmFtZXMiOlsiUHJvZ3Jlc3MiLCJjb25zdHJ1Y3RvciIsImxlbmd0aCIsImNvdW50IiwiaW5jIiwiZG9uZSIsImFwcCIsIkFwcEJhc2UiLCJFdmVudEhhbmRsZXIiLCJjYW52YXMiLCJ2ZXJzaW9uIiwiaW5kZXhPZiIsIkRlYnVnIiwibG9nIiwicmV2aXNpb24iLCJfYXBwbGljYXRpb25zIiwiaWQiLCJzZXRBcHBsaWNhdGlvbiIsIl9kZXN0cm95UmVxdWVzdGVkIiwiX2luRnJhbWVVcGRhdGUiLCJfdGltZSIsInRpbWVTY2FsZSIsIm1heERlbHRhVGltZSIsImZyYW1lIiwiYXV0b1JlbmRlciIsInJlbmRlck5leHRGcmFtZSIsInVzZUxlZ2FjeVNjcmlwdEF0dHJpYnV0ZUNsb25pbmciLCJzY3JpcHQiLCJsZWdhY3kiLCJfbGlicmFyaWVzTG9hZGVkIiwiX2ZpbGxNb2RlIiwiRklMTE1PREVfS0VFUF9BU1BFQ1QiLCJfcmVzb2x1dGlvbk1vZGUiLCJSRVNPTFVUSU9OX0ZJWEVEIiwiX2FsbG93UmVzaXplIiwiY29udGV4dCIsImluaXQiLCJhcHBPcHRpb25zIiwiZGV2aWNlIiwiZ3JhcGhpY3NEZXZpY2UiLCJhc3NlcnQiLCJHcmFwaGljc0RldmljZUFjY2VzcyIsInNldCIsIl9pbml0RGVmYXVsdE1hdGVyaWFsIiwiX2luaXRQcm9ncmFtTGlicmFyeSIsInN0YXRzIiwiQXBwbGljYXRpb25TdGF0cyIsIl9zb3VuZE1hbmFnZXIiLCJzb3VuZE1hbmFnZXIiLCJsb2FkZXIiLCJSZXNvdXJjZUxvYWRlciIsIkxpZ2h0c0J1ZmZlciIsIl9lbnRpdHlJbmRleCIsInNjZW5lIiwiU2NlbmUiLCJfcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZSIsInJvb3QiLCJFbnRpdHkiLCJfZW5hYmxlZEluSGllcmFyY2h5IiwiYXNzZXRzIiwiQXNzZXRSZWdpc3RyeSIsImFzc2V0UHJlZml4IiwicHJlZml4IiwiYnVuZGxlcyIsIkJ1bmRsZVJlZ2lzdHJ5IiwiZW5hYmxlQnVuZGxlcyIsIlRleHREZWNvZGVyIiwic2NyaXB0c09yZGVyIiwic2NyaXB0cyIsIlNjcmlwdFJlZ2lzdHJ5IiwiaTE4biIsIkkxOG4iLCJzY2VuZXMiLCJTY2VuZVJlZ2lzdHJ5Iiwic2VsZiIsImRlZmF1bHRMYXllcldvcmxkIiwiTGF5ZXIiLCJuYW1lIiwiTEFZRVJJRF9XT1JMRCIsInNjZW5lR3JhYiIsIlNjZW5lR3JhYiIsImRlZmF1bHRMYXllckRlcHRoIiwibGF5ZXIiLCJkZWZhdWx0TGF5ZXJTa3lib3giLCJlbmFibGVkIiwiTEFZRVJJRF9TS1lCT1giLCJvcGFxdWVTb3J0TW9kZSIsIlNPUlRNT0RFX05PTkUiLCJkZWZhdWx0TGF5ZXJVaSIsIkxBWUVSSURfVUkiLCJ0cmFuc3BhcmVudFNvcnRNb2RlIiwiU09SVE1PREVfTUFOVUFMIiwicGFzc1Rocm91Z2giLCJkZWZhdWx0TGF5ZXJJbW1lZGlhdGUiLCJMQVlFUklEX0lNTUVESUFURSIsImRlZmF1bHRMYXllckNvbXBvc2l0aW9uIiwiTGF5ZXJDb21wb3NpdGlvbiIsInB1c2hPcGFxdWUiLCJwdXNoVHJhbnNwYXJlbnQiLCJsYXllcnMiLCJvbiIsIm9sZENvbXAiLCJuZXdDb21wIiwibGlzdCIsImxheWVyTGlzdCIsImkiLCJMQVlFUklEX0RFUFRIIiwicGF0Y2giLCJBcmVhTGlnaHRMdXRzIiwiY3JlYXRlUGxhY2Vob2xkZXIiLCJyZW5kZXJlciIsIkZvcndhcmRSZW5kZXJlciIsImZyYW1lR3JhcGgiLCJGcmFtZUdyYXBoIiwibGlnaHRtYXBwZXIiLCJvbmNlIiwiX2ZpcnN0QmFrZSIsIl9iYXRjaGVyIiwiYmF0Y2hNYW5hZ2VyIiwiX2ZpcnN0QmF0Y2giLCJrZXlib2FyZCIsIm1vdXNlIiwidG91Y2giLCJnYW1lcGFkcyIsImVsZW1lbnRJbnB1dCIsInhyIiwiYXR0YWNoU2VsZWN0RXZlbnRzIiwiX2luVG9vbHMiLCJfc2t5Ym94QXNzZXQiLCJfc2NyaXB0UHJlZml4Iiwic2NyaXB0UHJlZml4IiwiYWRkSGFuZGxlciIsIkJ1bmRsZUhhbmRsZXIiLCJyZXNvdXJjZUhhbmRsZXJzIiwiZm9yRWFjaCIsInJlc291cmNlSGFuZGxlciIsImhhbmRsZXIiLCJoYW5kbGVyVHlwZSIsInN5c3RlbXMiLCJDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSIsImNvbXBvbmVudFN5c3RlbXMiLCJjb21wb25lbnRTeXN0ZW0iLCJhZGQiLCJfdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIiLCJvblZpc2liaWxpdHlDaGFuZ2UiLCJiaW5kIiwiZG9jdW1lbnQiLCJoaWRkZW4iLCJ1bmRlZmluZWQiLCJfaGlkZGVuQXR0ciIsImFkZEV2ZW50TGlzdGVuZXIiLCJtb3pIaWRkZW4iLCJtc0hpZGRlbiIsIndlYmtpdEhpZGRlbiIsInRpY2siLCJtYWtlVGljayIsImdldEFwcGxpY2F0aW9uIiwibWF0ZXJpYWwiLCJTdGFuZGFyZE1hdGVyaWFsIiwic2hhZGluZ01vZGVsIiwiU1BFQ1VMQVJfQkxJTk4iLCJzZXREZWZhdWx0TWF0ZXJpYWwiLCJsaWJyYXJ5IiwiUHJvZ3JhbUxpYnJhcnkiLCJzZXRQcm9ncmFtTGlicmFyeSIsImJhdGNoZXIiLCJmaWxsTW9kZSIsInJlc29sdXRpb25Nb2RlIiwiY29uZmlndXJlIiwidXJsIiwiY2FsbGJhY2siLCJodHRwIiwiZ2V0IiwiZXJyIiwicmVzcG9uc2UiLCJwcm9wcyIsImFwcGxpY2F0aW9uX3Byb3BlcnRpZXMiLCJfcGFyc2VBcHBsaWNhdGlvblByb3BlcnRpZXMiLCJfcGFyc2VTY2VuZXMiLCJfcGFyc2VBc3NldHMiLCJwcmVsb2FkIiwiZmlyZSIsInByb2dyZXNzIiwiX2RvbmUiLCJ0b3RhbCIsIm9uQXNzZXRMb2FkIiwiYXNzZXQiLCJvbkFzc2V0RXJyb3IiLCJsb2FkZWQiLCJsb2FkIiwiX3ByZWxvYWRTY3JpcHRzIiwic2NlbmVEYXRhIiwicHJlbG9hZGluZyIsIl9nZXRTY3JpcHRSZWZlcmVuY2VzIiwibCIsInJlZ2V4Iiwib25Mb2FkIiwiU2NyaXB0VHlwZSIsImNvbnNvbGUiLCJlcnJvciIsInNjcmlwdFVybCIsInRlc3QiLCJ0b0xvd2VyQ2FzZSIsInBhdGgiLCJqb2luIiwibWF4QXNzZXRSZXRyaWVzIiwiZW5hYmxlUmV0cnkiLCJ1c2VEZXZpY2VQaXhlbFJhdGlvIiwidXNlX2RldmljZV9waXhlbF9yYXRpbyIsInJlc29sdXRpb25fbW9kZSIsImZpbGxfbW9kZSIsIl93aWR0aCIsIndpZHRoIiwiX2hlaWdodCIsImhlaWdodCIsIm1heFBpeGVsUmF0aW8iLCJ3aW5kb3ciLCJkZXZpY2VQaXhlbFJhdGlvIiwic2V0Q2FudmFzUmVzb2x1dGlvbiIsInNldENhbnZhc0ZpbGxNb2RlIiwibGF5ZXJPcmRlciIsImNvbXBvc2l0aW9uIiwia2V5IiwiZGF0YSIsInBhcnNlSW50IiwibGVuIiwic3VibGF5ZXIiLCJ0cmFuc3BhcmVudCIsInN1YkxheWVyRW5hYmxlZCIsImJhdGNoR3JvdXBzIiwiZ3JwIiwiYWRkR3JvdXAiLCJkeW5hbWljIiwibWF4QWFiYlNpemUiLCJpMThuQXNzZXRzIiwiX2xvYWRMaWJyYXJpZXMiLCJsaWJyYXJpZXMiLCJ1cmxzIiwib25MaWJyYXJpZXNMb2FkZWQiLCJzY3JpcHRzSW5kZXgiLCJidW5kbGVzSW5kZXgiLCJwdXNoIiwidHlwZSIsIkFzc2V0IiwiZmlsZSIsImxvYWRpbmdUeXBlIiwidGFncyIsImxvY2FsZSIsImFkZExvY2FsaXplZEFzc2V0SWQiLCJwcmlvcml0eVNjcmlwdHMiLCJzZXR0aW5ncyIsInByaW9yaXR5X3NjcmlwdHMiLCJfc2NyaXB0cyIsIl9pbmRleCIsImVudGl0aWVzIiwiY29tcG9uZW50cyIsInN0YXJ0IiwidGltZXN0YW1wIiwibm93IiwidGFyZ2V0IiwiaW5wdXRVcGRhdGUiLCJkdCIsImNvbnRyb2xsZXIiLCJ1cGRhdGUiLCJ1cGRhdGVDbGllbnRSZWN0IiwidXBkYXRlU3RhcnQiLCJ1cGRhdGVUaW1lIiwicmVuZGVyIiwicmVuZGVyU3RhcnQiLCJzeW5jSGllcmFyY2h5IiwidXBkYXRlQWxsIiwiX3NraXBSZW5kZXJDb3VudGVyIiwicmVuZGVyQ29tcG9zaXRpb24iLCJyZW5kZXJUaW1lIiwibGF5ZXJDb21wb3NpdGlvbiIsIkRlYnVnR3JhcGhpY3MiLCJjbGVhckdwdU1hcmtlcnMiLCJidWlsZEZyYW1lR3JhcGgiLCJfZmlsbEZyYW1lU3RhdHNCYXNpYyIsIm1zIiwiX3RpbWVUb0NvdW50RnJhbWVzIiwiZnBzIiwiX2Zwc0FjY3VtIiwiZHJhd0NhbGxzIiwiX2RyYXdDYWxsc1BlckZyYW1lIiwiX2ZpbGxGcmFtZVN0YXRzIiwiY2FtZXJhcyIsIl9jYW1lcmFzUmVuZGVyZWQiLCJtYXRlcmlhbHMiLCJfbWF0ZXJpYWxTd2l0Y2hlcyIsInNoYWRlcnMiLCJfc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSIsInNoYWRvd01hcFVwZGF0ZXMiLCJfc2hhZG93TWFwVXBkYXRlcyIsInNoYWRvd01hcFRpbWUiLCJfc2hhZG93TWFwVGltZSIsImRlcHRoTWFwVGltZSIsIl9kZXB0aE1hcFRpbWUiLCJmb3J3YXJkVGltZSIsIl9mb3J3YXJkVGltZSIsInByaW1zIiwiX3ByaW1zUGVyRnJhbWUiLCJ0cmlhbmdsZXMiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwiTWF0aCIsIm1heCIsIlBSSU1JVElWRV9UUklTVFJJUCIsIlBSSU1JVElWRV9UUklGQU4iLCJjdWxsVGltZSIsIl9jdWxsVGltZSIsInNvcnRUaW1lIiwiX3NvcnRUaW1lIiwic2tpblRpbWUiLCJfc2tpblRpbWUiLCJtb3JwaFRpbWUiLCJfbW9ycGhUaW1lIiwibGlnaHRDbHVzdGVycyIsIl9saWdodENsdXN0ZXJzIiwibGlnaHRDbHVzdGVyc1RpbWUiLCJfbGlnaHRDbHVzdGVyc1RpbWUiLCJvdGhlclByaW1pdGl2ZXMiLCJfbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUiLCJmb3J3YXJkIiwiX2ZvcndhcmREcmF3Q2FsbHMiLCJjdWxsZWQiLCJfbnVtRHJhd0NhbGxzQ3VsbGVkIiwiZGVwdGgiLCJzaGFkb3ciLCJfc2hhZG93RHJhd0NhbGxzIiwic2tpbm5lZCIsIl9za2luRHJhd0NhbGxzIiwiaW1tZWRpYXRlIiwiaW5zdGFuY2VkIiwicmVtb3ZlZEJ5SW5zdGFuY2luZyIsIm1pc2MiLCJfZGVwdGhEcmF3Q2FsbHMiLCJfaW1tZWRpYXRlUmVuZGVyZWQiLCJfaW5zdGFuY2VkRHJhd0NhbGxzIiwicmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lIiwicGFydGljbGVzIiwidXBkYXRlc1BlckZyYW1lIiwiX3VwZGF0ZXNQZXJGcmFtZSIsImZyYW1lVGltZSIsIl9mcmFtZVRpbWUiLCJtb2RlIiwicmVzaXplQ2FudmFzIiwiUkVTT0xVVElPTl9BVVRPIiwiY2xpZW50V2lkdGgiLCJjbGllbnRIZWlnaHQiLCJpc0hpZGRlbiIsInN1c3BlbmQiLCJyZXN1bWUiLCJzZXNzaW9uIiwid2luZG93V2lkdGgiLCJpbm5lcldpZHRoIiwid2luZG93SGVpZ2h0IiwiaW5uZXJIZWlnaHQiLCJyIiwid2luUiIsIkZJTExNT0RFX0ZJTExfV0lORE9XIiwic3R5bGUiLCJ1cGRhdGVDYW52YXNTaXplIiwiYWN0aXZlIiwicmlnaWRib2R5Iiwib25MaWJyYXJ5TG9hZGVkIiwiYXBwbHlTY2VuZVNldHRpbmdzIiwiQW1tbyIsImdyYXZpdHkiLCJwaHlzaWNzIiwiYXBwbHlTZXR0aW5ncyIsImhhc093blByb3BlcnR5Iiwic2t5Ym94Iiwic2V0U2t5Ym94Iiwic2V0QXJlYUxpZ2h0THV0cyIsImx0Y01hdDEiLCJsdGNNYXQyIiwid2FybiIsIm9uU2t5Ym94UmVtb3ZlZCIsIm9uU2t5Ym94Q2hhbmdlZCIsInJlc291cmNlcyIsIm9mZiIsInNreWJveE1pcCIsImxvYWRGYWNlcyIsImJha2UiLCJsaWdodG1hcE1vZGUiLCJnZW5lcmF0ZSIsIl9wcm9jZXNzVGltZXN0YW1wIiwiZHJhd0xpbmUiLCJlbmQiLCJjb2xvciIsImRlcHRoVGVzdCIsImRyYXdMaW5lcyIsInBvc2l0aW9ucyIsImNvbG9ycyIsImRlZmF1bHREcmF3TGF5ZXIiLCJkcmF3TGluZUFycmF5cyIsImRyYXdXaXJlU3BoZXJlIiwiY2VudGVyIiwicmFkaXVzIiwiQ29sb3IiLCJXSElURSIsInNlZ21lbnRzIiwiZHJhd1dpcmVBbGlnbmVkQm94IiwibWluUG9pbnQiLCJtYXhQb2ludCIsImRyYXdNZXNoSW5zdGFuY2UiLCJtZXNoSW5zdGFuY2UiLCJkcmF3TWVzaCIsIm1lc2giLCJtYXRyaXgiLCJkcmF3UXVhZCIsImdldFF1YWRNZXNoIiwiZHJhd1RleHR1cmUiLCJ4IiwieSIsInRleHR1cmUiLCJNYXQ0Iiwic2V0VFJTIiwiVmVjMyIsIlF1YXQiLCJJREVOVElUWSIsIk1hdGVyaWFsIiwic2V0UGFyYW1ldGVyIiwic2hhZGVyIiwiZ2V0VGV4dHVyZVNoYWRlciIsImRyYXdEZXB0aFRleHR1cmUiLCJnZXREZXB0aFRleHR1cmVTaGFkZXIiLCJkZXN0cm95IiwiY2FudmFzSWQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiZGV0YWNoIiwidW5sb2FkIiwiZ2V0SGFuZGxlciIsIl9jYWNoZSIsImVsZW1lbnQiLCJwYXJlbnQiLCJwYXJlbnROb2RlIiwicmVtb3ZlQ2hpbGQiLCJvblByZVJlbmRlck9wYXF1ZSIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsIm9uRGlzYWJsZSIsIm9uRW5hYmxlIiwiZ2V0RW50aXR5RnJvbUluZGV4IiwiZ3VpZCIsIm9uUG9zdFJlbmRlciIsIl9mcmFtZUVuZERhdGEiLCJfYXBwIiwiYXBwbGljYXRpb24iLCJmcmFtZVJlcXVlc3QiLCJjYW5jZWxBbmltYXRpb25GcmFtZSIsImN1cnJlbnRUaW1lIiwibWF0aCIsImNsYW1wIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwicGxhdGZvcm0iLCJicm93c2VyIiwiY29udGV4dExvc3QiLCJzaG91bGRSZW5kZXJGcmFtZSIsImRlZmF1bHRGcmFtZWJ1ZmZlciIsInJlbmRlclN0YXRlIiwiYmFzZUxheWVyIiwiZnJhbWVidWZmZXIiLCJ0cmFjZSIsIlRSQUNFSURfUkVOREVSX0ZSQU1FIiwiVFJBQ0VJRF9SRU5ERVJfRlJBTUVfVElNRSIsInRvRml4ZWQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBK0RBO0FBQ0EsTUFBTUEsUUFBUSxDQUFDO0VBQ1hDLFdBQVcsQ0FBQ0MsTUFBTSxFQUFFO0lBQ2hCLElBQUksQ0FBQ0EsTUFBTSxHQUFHQSxNQUFNLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxLQUFLLEdBQUcsQ0FBQyxDQUFBO0FBQ2xCLEdBQUE7QUFFQUMsRUFBQUEsR0FBRyxHQUFHO0lBQ0YsSUFBSSxDQUFDRCxLQUFLLEVBQUUsQ0FBQTtBQUNoQixHQUFBO0FBRUFFLEVBQUFBLElBQUksR0FBRztBQUNILElBQUEsT0FBUSxJQUFJLENBQUNGLEtBQUssS0FBSyxJQUFJLENBQUNE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
