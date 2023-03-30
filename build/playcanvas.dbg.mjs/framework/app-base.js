/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
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
    Debug.call(() => {
      Debug.assert(!this._alreadyStarted, "The application can be started only one time.");
      this._alreadyStarted = true;
    });
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
  frameStart() {
    this.graphicsDevice.frameStart();
  }

  /**
   * Render the application's scene. More specifically, the scene's {@link LayerComposition} is
   * rendered. This function is called internally in the application's main loop and does not
   * need to be called explicitly.
   *
   * @ignore
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
   * @param {boolean} [filterable] - Indicate if the texture can be sampled using filtering.
   * Passing false uses unfiltered sampling, allowing a depth texture to be sampled on WebGPU.
   * Defaults to true.
   * @ignore
   */
  drawTexture(x, y, width, height, texture, material, layer = this.scene.defaultDrawLayer, filterable = true) {
    // only WebGPU supports filterable parameter to be false, allowing a depth texture / shadow
    // map to be fetched (without filtering) and rendered
    if (filterable === false && !this.graphicsDevice.isWebGPU) return;

    // TODO: if this is used for anything other than debug texture display, we should optimize this to avoid allocations
    const matrix = new Mat4();
    matrix.setTRS(new Vec3(x, y, 0.0), Quat.IDENTITY, new Vec3(width, height, 0.0));
    if (!material) {
      material = new Material();
      material.setParameter("colorMap", texture);
      material.shader = filterable ? this.scene.immediate.getTextureShader() : this.scene.immediate.getUnfilterableTextureShader();
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
    if (this.gamepads) {
      this.gamepads.destroy();
      this.gamepads = null;
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
        application.frameStart();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLWJhc2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLWJhc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gI2lmIF9ERUJVR1xuaW1wb3J0IHsgdmVyc2lvbiwgcmV2aXNpb24gfSBmcm9tICcuLi9jb3JlL2NvcmUuanMnO1xuLy8gI2VuZGlmXG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgVFJBQ0VJRF9SRU5ERVJfRlJBTUUsIFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUgfSBmcm9tICcuLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi9wbGF0Zm9ybS9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9ERVBUSCwgTEFZRVJJRF9JTU1FRElBVEUsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX1dPUkxELFxuICAgIFNPUlRNT0RFX05PTkUsIFNPUlRNT0RFX01BTlVBTCwgU1BFQ1VMQVJfQkxJTk5cbn0gZnJvbSAnLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IHNldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH0gZnJvbSAnLi4vc2NlbmUvcmVuZGVyZXIvZm9yd2FyZC1yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBGcmFtZUdyYXBoIH0gZnJvbSAnLi4vc2NlbmUvZnJhbWUtZ3JhcGguanMnO1xuaW1wb3J0IHsgQXJlYUxpZ2h0THV0cyB9IGZyb20gJy4uL3NjZW5lL2FyZWEtbGlnaHQtbHV0cy5qcyc7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4uL3NjZW5lL2xheWVyLmpzJztcbmltcG9ydCB7IExheWVyQ29tcG9zaXRpb24gfSBmcm9tICcuLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBTY2VuZSB9IGZyb20gJy4uL3NjZW5lL3NjZW5lLmpzJztcbmltcG9ydCB7IE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcbmltcG9ydCB7IExpZ2h0c0J1ZmZlciB9IGZyb20gJy4uL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBzZXREZWZhdWx0TWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi9hc3NldC9hc3NldC5qcyc7XG5pbXBvcnQgeyBBc3NldFJlZ2lzdHJ5IH0gZnJvbSAnLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBCdW5kbGVSZWdpc3RyeSB9IGZyb20gJy4vYnVuZGxlL2J1bmRsZS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSB9IGZyb20gJy4vY29tcG9uZW50cy9yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBTY2VuZUdyYWIgfSBmcm9tICcuLi9zY2VuZS9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcbmltcG9ydCB7IEJ1bmRsZUhhbmRsZXIgfSBmcm9tICcuL2hhbmRsZXJzL2J1bmRsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxvYWRlciB9IGZyb20gJy4vaGFuZGxlcnMvbG9hZGVyLmpzJztcbmltcG9ydCB7IEkxOG4gfSBmcm9tICcuL2kxOG4vaTE4bi5qcyc7XG5pbXBvcnQgeyBTY3JpcHRSZWdpc3RyeSB9IGZyb20gJy4vc2NyaXB0L3NjcmlwdC1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBTY2VuZVJlZ2lzdHJ5IH0gZnJvbSAnLi9zY2VuZS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBzY3JpcHQgfSBmcm9tICcuL3NjcmlwdC5qcyc7XG5pbXBvcnQgeyBBcHBsaWNhdGlvblN0YXRzIH0gZnJvbSAnLi9zdGF0cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgRklMTE1PREVfRklMTF9XSU5ET1csIEZJTExNT0RFX0tFRVBfQVNQRUNULFxuICAgIFJFU09MVVRJT05fQVVUTywgUkVTT0xVVElPTl9GSVhFRFxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgZ2V0QXBwbGljYXRpb24sXG4gICAgc2V0QXBwbGljYXRpb25cbn0gZnJvbSAnLi9nbG9iYWxzLmpzJztcblxuLy8gTWluaS1vYmplY3QgdXNlZCB0byBtZWFzdXJlIHByb2dyZXNzIG9mIGxvYWRpbmcgc2V0c1xuY2xhc3MgUHJvZ3Jlc3Mge1xuICAgIGNvbnN0cnVjdG9yKGxlbmd0aCkge1xuICAgICAgICB0aGlzLmxlbmd0aCA9IGxlbmd0aDtcbiAgICAgICAgdGhpcy5jb3VudCA9IDA7XG4gICAgfVxuXG4gICAgaW5jKCkge1xuICAgICAgICB0aGlzLmNvdW50Kys7XG4gICAgfVxuXG4gICAgZG9uZSgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmNvdW50ID09PSB0aGlzLmxlbmd0aCk7XG4gICAgfVxufVxuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEFwcEJhc2UjY29uZmlndXJlfSB3aGVuIGNvbmZpZ3VyYXRpb24gZmlsZSBpcyBsb2FkZWQgYW5kIHBhcnNlZCAob3JcbiAqIGFuIGVycm9yIG9jY3VycykuXG4gKlxuICogQGNhbGxiYWNrIENvbmZpZ3VyZUFwcENhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgbG9hZGluZyBvciBwYXJzaW5nIGZhaWxzLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNwcmVsb2FkfSB3aGVuIGFsbCBhc3NldHMgKG1hcmtlZCBhcyAncHJlbG9hZCcpIGFyZSBsb2FkZWQuXG4gKlxuICogQGNhbGxiYWNrIFByZWxvYWRBcHBDYWxsYmFja1xuICovXG5cbmxldCBhcHAgPSBudWxsO1xuXG4vKipcbiAqIEFuIEFwcGxpY2F0aW9uIHJlcHJlc2VudHMgYW5kIG1hbmFnZXMgeW91ciBQbGF5Q2FudmFzIGFwcGxpY2F0aW9uLiBJZiB5b3UgYXJlIGRldmVsb3BpbmcgdXNpbmdcbiAqIHRoZSBQbGF5Q2FudmFzIEVkaXRvciwgdGhlIEFwcGxpY2F0aW9uIGlzIGNyZWF0ZWQgZm9yIHlvdS4gWW91IGNhbiBhY2Nlc3MgeW91ciBBcHBsaWNhdGlvblxuICogaW5zdGFuY2UgaW4geW91ciBzY3JpcHRzLiBCZWxvdyBpcyBhIHNrZWxldG9uIHNjcmlwdCB3aGljaCBzaG93cyBob3cgeW91IGNhbiBhY2Nlc3MgdGhlXG4gKiBhcHBsaWNhdGlvbiAnYXBwJyBwcm9wZXJ0eSBpbnNpZGUgdGhlIGluaXRpYWxpemUgYW5kIHVwZGF0ZSBmdW5jdGlvbnM6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gRWRpdG9yIGV4YW1wbGU6IGFjY2Vzc2luZyB0aGUgcGMuQXBwbGljYXRpb24gZnJvbSBhIHNjcmlwdFxuICogdmFyIE15U2NyaXB0ID0gcGMuY3JlYXRlU2NyaXB0KCdteVNjcmlwdCcpO1xuICpcbiAqIE15U2NyaXB0LnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24oKSB7XG4gKiAgICAgLy8gRXZlcnkgc2NyaXB0IGluc3RhbmNlIGhhcyBhIHByb3BlcnR5ICd0aGlzLmFwcCcgYWNjZXNzaWJsZSBpbiB0aGUgaW5pdGlhbGl6ZS4uLlxuICogICAgIHZhciBhcHAgPSB0aGlzLmFwcDtcbiAqIH07XG4gKlxuICogTXlTY3JpcHQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKGR0KSB7XG4gKiAgICAgLy8gLi4uYW5kIHVwZGF0ZSBmdW5jdGlvbnMuXG4gKiAgICAgdmFyIGFwcCA9IHRoaXMuYXBwO1xuICogfTtcbiAqIGBgYFxuICpcbiAqIElmIHlvdSBhcmUgdXNpbmcgdGhlIEVuZ2luZSB3aXRob3V0IHRoZSBFZGl0b3IsIHlvdSBoYXZlIHRvIGNyZWF0ZSB0aGUgYXBwbGljYXRpb24gaW5zdGFuY2VcbiAqIG1hbnVhbGx5LlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgQXBwQmFzZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEFwcEJhc2UgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxDYW52YXNFbGVtZW50fSBjYW52YXMgLSBUaGUgY2FudmFzIGVsZW1lbnQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBFbmdpbmUtb25seSBleGFtcGxlOiBjcmVhdGUgdGhlIGFwcGxpY2F0aW9uIG1hbnVhbGx5XG4gICAgICogdmFyIG9wdGlvbnMgPSBuZXcgQXBwT3B0aW9ucygpO1xuICAgICAqIHZhciBhcHAgPSBuZXcgcGMuQXBwQmFzZShjYW52YXMpO1xuICAgICAqIGFwcC5pbml0KG9wdGlvbnMpO1xuICAgICAqXG4gICAgICogLy8gU3RhcnQgdGhlIGFwcGxpY2F0aW9uJ3MgbWFpbiBsb29wXG4gICAgICogYXBwLnN0YXJ0KCk7XG4gICAgICpcbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY2FudmFzKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodmVyc2lvbj8uaW5kZXhPZignJCcpIDwgMCkge1xuICAgICAgICAgICAgRGVidWcubG9nKGBQb3dlcmVkIGJ5IFBsYXlDYW52YXMgJHt2ZXJzaW9ufSAke3JldmlzaW9ufWApO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIC8vIFN0b3JlIGFwcGxpY2F0aW9uIGluc3RhbmNlXG4gICAgICAgIEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tjYW52YXMuaWRdID0gdGhpcztcbiAgICAgICAgc2V0QXBwbGljYXRpb24odGhpcyk7XG5cbiAgICAgICAgYXBwID0gdGhpcztcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fZGVzdHJveVJlcXVlc3RlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9pbkZyYW1lVXBkYXRlID0gZmFsc2U7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3RpbWUgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTY2FsZXMgdGhlIGdsb2JhbCB0aW1lIGRlbHRhLiBEZWZhdWx0cyB0byAxLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgdGhlIGFwcCB0byBydW4gYXQgaGFsZiBzcGVlZFxuICAgICAgICAgKiB0aGlzLmFwcC50aW1lU2NhbGUgPSAwLjU7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRpbWVTY2FsZSA9IDE7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENsYW1wcyBwZXItZnJhbWUgZGVsdGEgdGltZSB0byBhbiB1cHBlciBib3VuZC4gVXNlZnVsIHNpbmNlIHJldHVybmluZyBmcm9tIGEgdGFiXG4gICAgICAgICAqIGRlYWN0aXZhdGlvbiBjYW4gZ2VuZXJhdGUgaHVnZSB2YWx1ZXMgZm9yIGR0LCB3aGljaCBjYW4gYWR2ZXJzZWx5IGFmZmVjdCBnYW1lIHN0YXRlLlxuICAgICAgICAgKiBEZWZhdWx0cyB0byAwLjEgKHNlY29uZHMpLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBEb24ndCBjbGFtcCBpbnRlci1mcmFtZSB0aW1lcyBvZiAyMDBtcyBvciBsZXNzXG4gICAgICAgICAqIHRoaXMuYXBwLm1heERlbHRhVGltZSA9IDAuMjtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWF4RGVsdGFUaW1lID0gMC4xOyAvLyBNYXhpbXVtIGRlbHRhIGlzIDAuMXMgb3IgMTAgZnBzLlxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgdG90YWwgbnVtYmVyIG9mIGZyYW1lcyB0aGUgYXBwbGljYXRpb24gaGFzIHVwZGF0ZWQgc2luY2Ugc3RhcnQoKSB3YXMgY2FsbGVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmZyYW1lID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogV2hlbiB0cnVlLCB0aGUgYXBwbGljYXRpb24ncyByZW5kZXIgZnVuY3Rpb24gaXMgY2FsbGVkIGV2ZXJ5IGZyYW1lLiBTZXR0aW5nIGF1dG9SZW5kZXJcbiAgICAgICAgICogdG8gZmFsc2UgaXMgdXNlZnVsIHRvIGFwcGxpY2F0aW9ucyB3aGVyZSB0aGUgcmVuZGVyZWQgaW1hZ2UgbWF5IG9mdGVuIGJlIHVuY2hhbmdlZCBvdmVyXG4gICAgICAgICAqIHRpbWUuIFRoaXMgY2FuIGhlYXZpbHkgcmVkdWNlIHRoZSBhcHBsaWNhdGlvbidzIGxvYWQgb24gdGhlIENQVSBhbmQgR1BVLiBEZWZhdWx0cyB0b1xuICAgICAgICAgKiB0cnVlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gRGlzYWJsZSByZW5kZXJpbmcgZXZlcnkgZnJhbWUgYW5kIG9ubHkgcmVuZGVyIG9uIGEga2V5ZG93biBldmVudFxuICAgICAgICAgKiB0aGlzLmFwcC5hdXRvUmVuZGVyID0gZmFsc2U7XG4gICAgICAgICAqIHRoaXMuYXBwLmtleWJvYXJkLm9uKCdrZXlkb3duJywgZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgICAqICAgICB0aGlzLmFwcC5yZW5kZXJOZXh0RnJhbWUgPSB0cnVlO1xuICAgICAgICAgKiB9LCB0aGlzKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXV0b1JlbmRlciA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldCB0byB0cnVlIHRvIHJlbmRlciB0aGUgc2NlbmUgb24gdGhlIG5leHQgaXRlcmF0aW9uIG9mIHRoZSBtYWluIGxvb3AuIFRoaXMgb25seSBoYXMgYW5cbiAgICAgICAgICogZWZmZWN0IGlmIHtAbGluayBBcHBCYXNlI2F1dG9SZW5kZXJ9IGlzIHNldCB0byBmYWxzZS4gVGhlIHZhbHVlIG9mIHJlbmRlck5leHRGcmFtZVxuICAgICAgICAgKiBpcyBzZXQgYmFjayB0byBmYWxzZSBhZ2FpbiBhcyBzb29uIGFzIHRoZSBzY2VuZSBoYXMgYmVlbiByZW5kZXJlZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFJlbmRlciB0aGUgc2NlbmUgb25seSB3aGlsZSBzcGFjZSBrZXkgaXMgcHJlc3NlZFxuICAgICAgICAgKiBpZiAodGhpcy5hcHAua2V5Ym9hcmQuaXNQcmVzc2VkKHBjLktFWV9TUEFDRSkpIHtcbiAgICAgICAgICogICAgIHRoaXMuYXBwLnJlbmRlck5leHRGcmFtZSA9IHRydWU7XG4gICAgICAgICAqIH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucmVuZGVyTmV4dEZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEVuYWJsZSBpZiB5b3Ugd2FudCBlbnRpdHkgdHlwZSBzY3JpcHQgYXR0cmlidXRlcyB0byBub3QgYmUgcmUtbWFwcGVkIHdoZW4gYW4gZW50aXR5IGlzXG4gICAgICAgICAqIGNsb25lZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyA9IHNjcmlwdC5sZWdhY3k7XG5cbiAgICAgICAgdGhpcy5fbGlicmFyaWVzTG9hZGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2ZpbGxNb2RlID0gRklMTE1PREVfS0VFUF9BU1BFQ1Q7XG4gICAgICAgIHRoaXMuX3Jlc29sdXRpb25Nb2RlID0gUkVTT0xVVElPTl9GSVhFRDtcbiAgICAgICAgdGhpcy5fYWxsb3dSZXNpemUgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBzY3JpcHRzIDEuMC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0FwcEJhc2V9XG4gICAgICAgICAqIEBkZXByZWNhdGVkXG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuY29udGV4dCA9IHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSB0aGUgYXBwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYXBwLW9wdGlvbnMuanMnKS5BcHBPcHRpb25zfSBhcHBPcHRpb25zIC0gT3B0aW9ucyBzcGVjaWZ5aW5nIHRoZSBpbml0XG4gICAgICogcGFyYW1ldGVycyBmb3IgdGhlIGFwcC5cbiAgICAgKi9cbiAgICBpbml0KGFwcE9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZGV2aWNlID0gYXBwT3B0aW9ucy5ncmFwaGljc0RldmljZTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoZGV2aWNlLCBcIlRoZSBhcHBsaWNhdGlvbiBjYW5ub3QgYmUgY3JlYXRlZCB3aXRob3V0IGEgdmFsaWQgR3JhcGhpY3NEZXZpY2VcIik7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZSA9IGRldmljZTtcbiAgICAgICAgR3JhcGhpY3NEZXZpY2VBY2Nlc3Muc2V0KGRldmljZSk7XG5cbiAgICAgICAgdGhpcy5faW5pdERlZmF1bHRNYXRlcmlhbCgpO1xuICAgICAgICB0aGlzLl9pbml0UHJvZ3JhbUxpYnJhcnkoKTtcbiAgICAgICAgdGhpcy5zdGF0cyA9IG5ldyBBcHBsaWNhdGlvblN0YXRzKGRldmljZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL3NvdW5kL21hbmFnZXIuanMnKS5Tb3VuZE1hbmFnZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIgPSBhcHBPcHRpb25zLnNvdW5kTWFuYWdlcjtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJlc291cmNlIGxvYWRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1Jlc291cmNlTG9hZGVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5sb2FkZXIgPSBuZXcgUmVzb3VyY2VMb2FkZXIodGhpcyk7XG5cbiAgICAgICAgTGlnaHRzQnVmZmVyLmluaXQoZGV2aWNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmVzIGFsbCBlbnRpdGllcyB0aGF0IGhhdmUgYmVlbiBjcmVhdGVkIGZvciB0aGlzIGFwcCBieSBndWlkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgRW50aXR5Pn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZW50aXR5SW5kZXggPSB7fTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNjZW5lIG1hbmFnZWQgYnkgdGhlIGFwcGxpY2F0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NlbmV9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCB0aGUgdG9uZSBtYXBwaW5nIHByb3BlcnR5IG9mIHRoZSBhcHBsaWNhdGlvbidzIHNjZW5lXG4gICAgICAgICAqIHRoaXMuYXBwLnNjZW5lLnRvbmVNYXBwaW5nID0gcGMuVE9ORU1BUF9GSUxNSUM7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjZW5lID0gbmV3IFNjZW5lKGRldmljZSk7XG4gICAgICAgIHRoaXMuX3JlZ2lzdGVyU2NlbmVJbW1lZGlhdGUodGhpcy5zY2VuZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSByb290IGVudGl0eSBvZiB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtFbnRpdHl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFJldHVybiB0aGUgZmlyc3QgZW50aXR5IGNhbGxlZCAnQ2FtZXJhJyBpbiBhIGRlcHRoLWZpcnN0IHNlYXJjaCBvZiB0aGUgc2NlbmUgaGllcmFyY2h5XG4gICAgICAgICAqIHZhciBjYW1lcmEgPSB0aGlzLmFwcC5yb290LmZpbmRCeU5hbWUoJ0NhbWVyYScpO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yb290ID0gbmV3IEVudGl0eSgpO1xuICAgICAgICB0aGlzLnJvb3QuX2VuYWJsZWRJbkhpZXJhcmNoeSA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhc3NldCByZWdpc3RyeSBtYW5hZ2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0Fzc2V0UmVnaXN0cnl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNlYXJjaCB0aGUgYXNzZXQgcmVnaXN0cnkgZm9yIGFsbCBhc3NldHMgd2l0aCB0aGUgdGFnICd2ZWhpY2xlJ1xuICAgICAgICAgKiB2YXIgdmVoaWNsZUFzc2V0cyA9IHRoaXMuYXBwLmFzc2V0cy5maW5kQnlUYWcoJ3ZlaGljbGUnKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXNzZXRzID0gbmV3IEFzc2V0UmVnaXN0cnkodGhpcy5sb2FkZXIpO1xuICAgICAgICBpZiAoYXBwT3B0aW9ucy5hc3NldFByZWZpeCkgdGhpcy5hc3NldHMucHJlZml4ID0gYXBwT3B0aW9ucy5hc3NldFByZWZpeDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0J1bmRsZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmJ1bmRsZXMgPSBuZXcgQnVuZGxlUmVnaXN0cnkodGhpcy5hc3NldHMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgdGhpcyB0byBmYWxzZSBpZiB5b3Ugd2FudCB0byBydW4gd2l0aG91dCB1c2luZyBidW5kbGVzLiBXZSBzZXQgaXQgdG8gdHJ1ZSBvbmx5IGlmXG4gICAgICAgICAqIFRleHREZWNvZGVyIGlzIGF2YWlsYWJsZSBiZWNhdXNlIHdlIGN1cnJlbnRseSByZWx5IG9uIGl0IGZvciB1bnRhcnJpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVuYWJsZUJ1bmRsZXMgPSAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJyk7XG5cbiAgICAgICAgdGhpcy5zY3JpcHRzT3JkZXIgPSBhcHBPcHRpb25zLnNjcmlwdHNPcmRlciB8fCBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uJ3Mgc2NyaXB0IHJlZ2lzdHJ5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NyaXB0UmVnaXN0cnl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBuZXcgU2NyaXB0UmVnaXN0cnkodGhpcyk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXMgbG9jYWxpemF0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7STE4bn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaTE4biA9IG5ldyBJMThuKHRoaXMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2NlbmUgcmVnaXN0cnkgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTY2VuZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZWFyY2ggdGhlIHNjZW5lIHJlZ2lzdHJ5IGZvciBhIGl0ZW0gd2l0aCB0aGUgbmFtZSAncmFjZXRyYWNrMSdcbiAgICAgICAgICogdmFyIHNjZW5lSXRlbSA9IHRoaXMuYXBwLnNjZW5lcy5maW5kKCdyYWNldHJhY2sxJyk7XG4gICAgICAgICAqXG4gICAgICAgICAqIC8vIExvYWQgdGhlIHNjZW5lIHVzaW5nIHRoZSBpdGVtJ3MgdXJsXG4gICAgICAgICAqIHRoaXMuYXBwLnNjZW5lcy5sb2FkU2NlbmUoc2NlbmVJdGVtLnVybCk7XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjZW5lcyA9IG5ldyBTY2VuZVJlZ2lzdHJ5KHRoaXMpO1xuXG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllcldvcmxkID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIG5hbWU6IFwiV29ybGRcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX1dPUkxEXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuc2NlbmVHcmFiID0gbmV3IFNjZW5lR3JhYih0aGlzLmdyYXBoaWNzRGV2aWNlLCB0aGlzLnNjZW5lKTtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aCA9IHRoaXMuc2NlbmVHcmFiLmxheWVyO1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyU2t5Ym94ID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiBcIlNreWJveFwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfU0tZQk9YLFxuICAgICAgICAgICAgb3BhcXVlU29ydE1vZGU6IFNPUlRNT0RFX05PTkVcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyVWkgPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG5hbWU6IFwiVUlcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX1VJLFxuICAgICAgICAgICAgdHJhbnNwYXJlbnRTb3J0TW9kZTogU09SVE1PREVfTUFOVUFMLFxuICAgICAgICAgICAgcGFzc1Rocm91Z2g6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSA9IG5ldyBMYXllcih7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbmFtZTogXCJJbW1lZGlhdGVcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX0lNTUVESUFURSxcbiAgICAgICAgICAgIG9wYXF1ZVNvcnRNb2RlOiBTT1JUTU9ERV9OT05FLFxuICAgICAgICAgICAgcGFzc1Rocm91Z2g6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgZGVmYXVsdExheWVyQ29tcG9zaXRpb24gPSBuZXcgTGF5ZXJDb21wb3NpdGlvbihcImRlZmF1bHRcIik7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJXb3JsZCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJEZXB0aCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJTa3lib3gpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQodGhpcy5kZWZhdWx0TGF5ZXJXb3JsZCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hPcGFxdWUodGhpcy5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQodGhpcy5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUpO1xuICAgICAgICBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQodGhpcy5kZWZhdWx0TGF5ZXJVaSk7XG4gICAgICAgIHRoaXMuc2NlbmUubGF5ZXJzID0gZGVmYXVsdExheWVyQ29tcG9zaXRpb247XG5cbiAgICAgICAgLy8gRGVmYXVsdCBsYXllcnMgcGF0Y2hcbiAgICAgICAgdGhpcy5zY2VuZS5vbignc2V0OmxheWVycycsIGZ1bmN0aW9uIChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgICAgICBjb25zdCBsaXN0ID0gbmV3Q29tcC5sYXllckxpc3Q7XG4gICAgICAgICAgICBsZXQgbGF5ZXI7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsYXllciA9IGxpc3RbaV07XG4gICAgICAgICAgICAgICAgc3dpdGNoIChsYXllci5pZCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIExBWUVSSURfREVQVEg6XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnNjZW5lR3JhYi5wYXRjaChsYXllcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBMQVlFUklEX1VJOlxuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIucGFzc1Rocm91Z2ggPSBzZWxmLmRlZmF1bHRMYXllclVpLnBhc3NUaHJvdWdoO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTEFZRVJJRF9JTU1FRElBVEU6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5wYXNzVGhyb3VnaCA9IHNlbGYuZGVmYXVsdExheWVySW1tZWRpYXRlLnBhc3NUaHJvdWdoO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBwbGFjZWhvbGRlciB0ZXh0dXJlIGZvciBhcmVhIGxpZ2h0IExVVHNcbiAgICAgICAgQXJlYUxpZ2h0THV0cy5jcmVhdGVQbGFjZWhvbGRlcihkZXZpY2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgZm9yd2FyZCByZW5kZXJlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0ZvcndhcmRSZW5kZXJlcn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZW5kZXJlciA9IG5ldyBGb3J3YXJkUmVuZGVyZXIoZGV2aWNlKTtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5zY2VuZSA9IHRoaXMuc2NlbmU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBmcmFtZSBncmFwaC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0ZyYW1lR3JhcGh9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZnJhbWVHcmFwaCA9IG5ldyBGcmFtZUdyYXBoKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBydW4tdGltZSBsaWdodG1hcHBlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9saWdodG1hcHBlci9saWdodG1hcHBlci5qcycpLkxpZ2h0bWFwcGVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG51bGw7XG4gICAgICAgIGlmIChhcHBPcHRpb25zLmxpZ2h0bWFwcGVyKSB7XG4gICAgICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyID0gbmV3IGFwcE9wdGlvbnMubGlnaHRtYXBwZXIoZGV2aWNlLCB0aGlzLnJvb3QsIHRoaXMuc2NlbmUsIHRoaXMucmVuZGVyZXIsIHRoaXMuYXNzZXRzKTtcbiAgICAgICAgICAgIHRoaXMub25jZSgncHJlcmVuZGVyJywgdGhpcy5fZmlyc3RCYWtlLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBiYXRjaCBtYW5hZ2VyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1tYW5hZ2VyLmpzJykuQmF0Y2hNYW5hZ2VyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG51bGw7XG4gICAgICAgIGlmIChhcHBPcHRpb25zLmJhdGNoTWFuYWdlcikge1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG5ldyBhcHBPcHRpb25zLmJhdGNoTWFuYWdlcihkZXZpY2UsIHRoaXMucm9vdCwgdGhpcy5zY2VuZSk7XG4gICAgICAgICAgICB0aGlzLm9uY2UoJ3ByZXJlbmRlcicsIHRoaXMuX2ZpcnN0QmF0Y2gsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBrZXlib2FyZCBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2tleWJvYXJkLmpzJykuS2V5Ym9hcmR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmtleWJvYXJkID0gYXBwT3B0aW9ucy5rZXlib2FyZCB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgbW91c2UgZGV2aWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC9tb3VzZS5qcycpLk1vdXNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tb3VzZSA9IGFwcE9wdGlvbnMubW91c2UgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBnZXQgdG91Y2ggZXZlbnRzIGlucHV0LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9pbnB1dC90b3VjaC1kZXZpY2UuanMnKS5Ub3VjaERldmljZX1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudG91Y2ggPSBhcHBPcHRpb25zLnRvdWNoIHx8IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFVzZWQgdG8gYWNjZXNzIEdhbWVQYWQgaW5wdXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L2dhbWUtcGFkcy5qcycpLkdhbWVQYWRzfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5nYW1lcGFkcyA9IGFwcE9wdGlvbnMuZ2FtZXBhZHMgfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBoYW5kbGUgaW5wdXQgZm9yIHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vaW5wdXQvZWxlbWVudC1pbnB1dC5qcycpLkVsZW1lbnRJbnB1dH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZWxlbWVudElucHV0ID0gYXBwT3B0aW9ucy5lbGVtZW50SW5wdXQgfHwgbnVsbDtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudElucHV0KVxuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuYXBwID0gdGhpcztcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIFhSIE1hbmFnZXIgdGhhdCBwcm92aWRlcyBhYmlsaXR5IHRvIHN0YXJ0IFZSL0FSIHNlc3Npb25zLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL3hyL3hyLW1hbmFnZXIuanMnKS5Yck1hbmFnZXJ9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIGNoZWNrIGlmIFZSIGlzIGF2YWlsYWJsZVxuICAgICAgICAgKiBpZiAoYXBwLnhyLmlzQXZhaWxhYmxlKHBjLlhSVFlQRV9WUikpIHtcbiAgICAgICAgICogICAgIC8vIFZSIGlzIGF2YWlsYWJsZVxuICAgICAgICAgKiB9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnhyID0gYXBwT3B0aW9ucy54ciA/IG5ldyBhcHBPcHRpb25zLnhyKHRoaXMpIDogbnVsbDtcblxuICAgICAgICBpZiAodGhpcy5lbGVtZW50SW5wdXQpXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dC5hdHRhY2hTZWxlY3RFdmVudHMoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2luVG9vbHMgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0Fzc2V0fG51bGx9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9za3lib3hBc3NldCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NjcmlwdFByZWZpeCA9IGFwcE9wdGlvbnMuc2NyaXB0UHJlZml4IHx8ICcnO1xuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZUJ1bmRsZXMpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVyLmFkZEhhbmRsZXIoXCJidW5kbGVcIiwgbmV3IEJ1bmRsZUhhbmRsZXIodGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCByZWdpc3RlciBhbGwgcmVxdWlyZWQgcmVzb3VyY2UgaGFuZGxlcnNcbiAgICAgICAgYXBwT3B0aW9ucy5yZXNvdXJjZUhhbmRsZXJzLmZvckVhY2goKHJlc291cmNlSGFuZGxlcikgPT4ge1xuICAgICAgICAgICAgY29uc3QgaGFuZGxlciA9IG5ldyByZXNvdXJjZUhhbmRsZXIodGhpcyk7XG4gICAgICAgICAgICB0aGlzLmxvYWRlci5hZGRIYW5kbGVyKGhhbmRsZXIuaGFuZGxlclR5cGUsIGhhbmRsZXIpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uJ3MgY29tcG9uZW50IHN5c3RlbSByZWdpc3RyeS4gVGhlIEFwcGxpY2F0aW9uIGNvbnN0cnVjdG9yIGFkZHMgdGhlXG4gICAgICAgICAqIGZvbGxvd2luZyBjb21wb25lbnQgc3lzdGVtcyB0byBpdHMgY29tcG9uZW50IHN5c3RlbSByZWdpc3RyeTpcbiAgICAgICAgICpcbiAgICAgICAgICogLSBhbmltICh7QGxpbmsgQW5pbUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gYW5pbWF0aW9uICh7QGxpbmsgQW5pbWF0aW9uQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBhdWRpb2xpc3RlbmVyICh7QGxpbmsgQXVkaW9MaXN0ZW5lckNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gYnV0dG9uICh7QGxpbmsgQnV0dG9uQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBjYW1lcmEgKHtAbGluayBDYW1lcmFDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGNvbGxpc2lvbiAoe0BsaW5rIENvbGxpc2lvbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gZWxlbWVudCAoe0BsaW5rIEVsZW1lbnRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGxheW91dGNoaWxkICh7QGxpbmsgTGF5b3V0Q2hpbGRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGxheW91dGdyb3VwICh7QGxpbmsgTGF5b3V0R3JvdXBDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGxpZ2h0ICh7QGxpbmsgTGlnaHRDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIG1vZGVsICh7QGxpbmsgTW9kZWxDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHBhcnRpY2xlc3lzdGVtICh7QGxpbmsgUGFydGljbGVTeXN0ZW1Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHJpZ2lkYm9keSAoe0BsaW5rIFJpZ2lkQm9keUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gcmVuZGVyICh7QGxpbmsgUmVuZGVyQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JlZW4gKHtAbGluayBTY3JlZW5Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcmlwdCAoe0BsaW5rIFNjcmlwdENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2Nyb2xsYmFyICh7QGxpbmsgU2Nyb2xsYmFyQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JvbGx2aWV3ICh7QGxpbmsgU2Nyb2xsVmlld0NvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc291bmQgKHtAbGluayBTb3VuZENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc3ByaXRlICh7QGxpbmsgU3ByaXRlQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgZ2xvYmFsIGdyYXZpdHkgdG8gemVyb1xuICAgICAgICAgKiB0aGlzLmFwcC5zeXN0ZW1zLnJpZ2lkYm9keS5ncmF2aXR5LnNldCgwLCAwLCAwKTtcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2V0IHRoZSBnbG9iYWwgc291bmQgdm9sdW1lIHRvIDUwJVxuICAgICAgICAgKiB0aGlzLmFwcC5zeXN0ZW1zLnNvdW5kLnZvbHVtZSA9IDAuNTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc3lzdGVtcyA9IG5ldyBDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSgpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhbmQgcmVnaXN0ZXIgYWxsIHJlcXVpcmVkIGNvbXBvbmVudCBzeXN0ZW1zXG4gICAgICAgIGFwcE9wdGlvbnMuY29tcG9uZW50U3lzdGVtcy5mb3JFYWNoKChjb21wb25lbnRTeXN0ZW0pID0+IHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5hZGQobmV3IGNvbXBvbmVudFN5c3RlbSh0aGlzKSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciA9IHRoaXMub25WaXNpYmlsaXR5Q2hhbmdlLmJpbmQodGhpcyk7XG5cbiAgICAgICAgLy8gRGVwZW5kaW5nIG9uIGJyb3dzZXIgYWRkIHRoZSBjb3JyZWN0IHZpc2liaWxpdHljaGFuZ2UgZXZlbnQgYW5kIHN0b3JlIHRoZSBuYW1lIG9mIHRoZVxuICAgICAgICAvLyBoaWRkZW4gYXR0cmlidXRlIGluIHRoaXMuX2hpZGRlbkF0dHIuXG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQuaGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ2hpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRvY3VtZW50Lm1vekhpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICdtb3pIaWRkZW4nO1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21venZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkb2N1bWVudC5tc0hpZGRlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faGlkZGVuQXR0ciA9ICdtc0hpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbXN2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQud2Via2l0SGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ3dlYmtpdEhpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignd2Via2l0dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBiaW5kIHRpY2sgZnVuY3Rpb24gdG8gY3VycmVudCBzY29wZVxuICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdXNlLWJlZm9yZS1kZWZpbmUgKi9cbiAgICAgICAgdGhpcy50aWNrID0gbWFrZVRpY2sodGhpcyk7IC8vIENpcmN1bGFyIGxpbnRpbmcgaXNzdWUgYXMgbWFrZVRpY2sgYW5kIEFwcGxpY2F0aW9uIHJlZmVyZW5jZSBlYWNoIG90aGVyXG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHByaXZhdGVcbiAgICAgKiBAc3RhdGljXG4gICAgICogQG5hbWUgYXBwXG4gICAgICogQHR5cGUge0FwcEJhc2V8dW5kZWZpbmVkfVxuICAgICAqIEBkZXNjcmlwdGlvbiBHZXRzIHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uLCBpZiBhbnkuXG4gICAgICovXG5cbiAgICBzdGF0aWMgX2FwcGxpY2F0aW9ucyA9IHt9O1xuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBjdXJyZW50IGFwcGxpY2F0aW9uLiBJbiB0aGUgY2FzZSB3aGVyZSB0aGVyZSBhcmUgbXVsdGlwbGUgcnVubmluZyBhcHBsaWNhdGlvbnMsIHRoZVxuICAgICAqIGZ1bmN0aW9uIGNhbiBnZXQgYW4gYXBwbGljYXRpb24gYmFzZWQgb24gYSBzdXBwbGllZCBjYW52YXMgaWQuIFRoaXMgZnVuY3Rpb24gaXMgcGFydGljdWxhcmx5XG4gICAgICogdXNlZnVsIHdoZW4gdGhlIGN1cnJlbnQgQXBwbGljYXRpb24gaXMgbm90IHJlYWRpbHkgYXZhaWxhYmxlLiBGb3IgZXhhbXBsZSwgaW4gdGhlIEphdmFTY3JpcHRcbiAgICAgKiBjb25zb2xlIG9mIHRoZSBicm93c2VyJ3MgZGV2ZWxvcGVyIHRvb2xzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtpZF0gLSBJZiBkZWZpbmVkLCB0aGUgcmV0dXJuZWQgYXBwbGljYXRpb24gc2hvdWxkIHVzZSB0aGUgY2FudmFzIHdoaWNoIGhhc1xuICAgICAqIHRoaXMgaWQuIE90aGVyd2lzZSBjdXJyZW50IGFwcGxpY2F0aW9uIHdpbGwgYmUgcmV0dXJuZWQuXG4gICAgICogQHJldHVybnMge0FwcEJhc2V8dW5kZWZpbmVkfSBUaGUgcnVubmluZyBhcHBsaWNhdGlvbiwgaWYgYW55LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGFwcCA9IHBjLkFwcEJhc2UuZ2V0QXBwbGljYXRpb24oKTtcbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0QXBwbGljYXRpb24oaWQpIHtcbiAgICAgICAgcmV0dXJuIGlkID8gQXBwQmFzZS5fYXBwbGljYXRpb25zW2lkXSA6IGdldEFwcGxpY2F0aW9uKCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2luaXREZWZhdWx0TWF0ZXJpYWwoKSB7XG4gICAgICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFN0YW5kYXJkTWF0ZXJpYWwoKTtcbiAgICAgICAgbWF0ZXJpYWwubmFtZSA9IFwiRGVmYXVsdCBNYXRlcmlhbFwiO1xuICAgICAgICBtYXRlcmlhbC5zaGFkaW5nTW9kZWwgPSBTUEVDVUxBUl9CTElOTjtcbiAgICAgICAgc2V0RGVmYXVsdE1hdGVyaWFsKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIG1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfaW5pdFByb2dyYW1MaWJyYXJ5KCkge1xuICAgICAgICBjb25zdCBsaWJyYXJ5ID0gbmV3IFByb2dyYW1MaWJyYXJ5KHRoaXMuZ3JhcGhpY3NEZXZpY2UsIG5ldyBTdGFuZGFyZE1hdGVyaWFsKCkpO1xuICAgICAgICBzZXRQcm9ncmFtTGlicmFyeSh0aGlzLmdyYXBoaWNzRGV2aWNlLCBsaWJyYXJ5KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9zb3VuZC9tYW5hZ2VyLmpzJykuU291bmRNYW5hZ2VyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgc291bmRNYW5hZ2VyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc291bmRNYW5hZ2VyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIGJhdGNoIG1hbmFnZXIuIFRoZSBiYXRjaCBtYW5hZ2VyIGlzIHVzZWQgdG8gbWVyZ2UgbWVzaCBpbnN0YW5jZXMgaW5cbiAgICAgKiB0aGUgc2NlbmUsIHdoaWNoIHJlZHVjZXMgdGhlIG92ZXJhbGwgbnVtYmVyIG9mIGRyYXcgY2FsbHMsIHRoZXJlYnkgYm9vc3RpbmcgcGVyZm9ybWFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1tYW5hZ2VyLmpzJykuQmF0Y2hNYW5hZ2VyfVxuICAgICAqL1xuICAgIGdldCBiYXRjaGVyKCkge1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5fYmF0Y2hlciwgXCJCYXRjaE1hbmFnZXIgaGFzIG5vdCBiZWVuIGNyZWF0ZWQgYW5kIGlzIHJlcXVpcmVkIGZvciBjb3JyZWN0IGZ1bmN0aW9uYWxpdHkuXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5fYmF0Y2hlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBmaWxsIG1vZGUgb2YgdGhlIGNhbnZhcy4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfTk9ORX06IHRoZSBjYW52YXMgd2lsbCBhbHdheXMgbWF0Y2ggdGhlIHNpemUgcHJvdmlkZWQuXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfRklMTF9XSU5ET1d9OiB0aGUgY2FudmFzIHdpbGwgc2ltcGx5IGZpbGwgdGhlIHdpbmRvdywgY2hhbmdpbmcgYXNwZWN0IHJhdGlvLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0tFRVBfQVNQRUNUfTogdGhlIGNhbnZhcyB3aWxsIGdyb3cgdG8gZmlsbCB0aGUgd2luZG93IGFzIGJlc3QgaXQgY2FuIHdoaWxlXG4gICAgICogbWFpbnRhaW5pbmcgdGhlIGFzcGVjdCByYXRpby5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IGZpbGxNb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZmlsbE1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgcmVzb2x1dGlvbiBtb2RlIG9mIHRoZSBjYW52YXMsIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fQVVUT306IGlmIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG5vdCBwcm92aWRlZCwgY2FudmFzIHdpbGwgYmUgcmVzaXplZCB0b1xuICAgICAqIG1hdGNoIGNhbnZhcyBjbGllbnQgc2l6ZS5cbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0ZJWEVEfTogcmVzb2x1dGlvbiBvZiBjYW52YXMgd2lsbCBiZSBmaXhlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0IHJlc29sdXRpb25Nb2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVzb2x1dGlvbk1vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCB0aGUgYXBwbGljYXRpb24gY29uZmlndXJhdGlvbiBmaWxlIGFuZCBhcHBseSBhcHBsaWNhdGlvbiBwcm9wZXJ0aWVzIGFuZCBmaWxsIHRoZSBhc3NldFxuICAgICAqIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHVybCAtIFRoZSBVUkwgb2YgdGhlIGNvbmZpZ3VyYXRpb24gZmlsZSB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7Q29uZmlndXJlQXBwQ2FsbGJhY2t9IGNhbGxiYWNrIC0gVGhlIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgaXNcbiAgICAgKiBsb2FkZWQgYW5kIHBhcnNlZCAob3IgYW4gZXJyb3Igb2NjdXJzKS5cbiAgICAgKi9cbiAgICBjb25maWd1cmUodXJsLCBjYWxsYmFjaykge1xuICAgICAgICBodHRwLmdldCh1cmwsIChlcnIsIHJlc3BvbnNlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByb3BzID0gcmVzcG9uc2UuYXBwbGljYXRpb25fcHJvcGVydGllcztcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lcyA9IHJlc3BvbnNlLnNjZW5lcztcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IHJlc3BvbnNlLmFzc2V0cztcblxuICAgICAgICAgICAgdGhpcy5fcGFyc2VBcHBsaWNhdGlvblByb3BlcnRpZXMocHJvcHMsIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZVNjZW5lcyhzY2VuZXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQXNzZXRzKGFzc2V0cyk7XG4gICAgICAgICAgICAgICAgaWYgKCFlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTG9hZCBhbGwgYXNzZXRzIGluIHRoZSBhc3NldCByZWdpc3RyeSB0aGF0IGFyZSBtYXJrZWQgYXMgJ3ByZWxvYWQnLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtQcmVsb2FkQXBwQ2FsbGJhY2t9IGNhbGxiYWNrIC0gRnVuY3Rpb24gY2FsbGVkIHdoZW4gYWxsIGFzc2V0cyBhcmUgbG9hZGVkLlxuICAgICAqL1xuICAgIHByZWxvYWQoY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy5maXJlKFwicHJlbG9hZDpzdGFydFwiKTtcblxuICAgICAgICAvLyBnZXQgbGlzdCBvZiBhc3NldHMgdG8gcHJlbG9hZFxuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLmFzc2V0cy5saXN0KHtcbiAgICAgICAgICAgIHByZWxvYWQ6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MoYXNzZXRzLmxlbmd0aCk7XG5cbiAgICAgICAgbGV0IF9kb25lID0gZmFsc2U7XG5cbiAgICAgICAgLy8gY2hlY2sgaWYgYWxsIGxvYWRpbmcgaXMgZG9uZVxuICAgICAgICBjb25zdCBkb25lID0gKCkgPT4ge1xuICAgICAgICAgICAgLy8gZG8gbm90IHByb2NlZWQgaWYgYXBwbGljYXRpb24gZGVzdHJveWVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghX2RvbmUgJiYgcHJvZ3Jlc3MuZG9uZSgpKSB7XG4gICAgICAgICAgICAgICAgX2RvbmUgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6ZW5kXCIpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gdG90YWxzIGxvYWRpbmcgcHJvZ3Jlc3Mgb2YgYXNzZXRzXG4gICAgICAgIGNvbnN0IHRvdGFsID0gYXNzZXRzLmxlbmd0aDtcblxuICAgICAgICBpZiAocHJvZ3Jlc3MubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zdCBvbkFzc2V0TG9hZCA9IChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgIHByb2dyZXNzLmluYygpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgncHJlbG9hZDpwcm9ncmVzcycsIHByb2dyZXNzLmNvdW50IC8gdG90YWwpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSlcbiAgICAgICAgICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3Qgb25Bc3NldEVycm9yID0gKGVyciwgYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3ByZWxvYWQ6cHJvZ3Jlc3MnLCBwcm9ncmVzcy5jb3VudCAvIHRvdGFsKTtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGZvciBlYWNoIGFzc2V0XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXRzW2ldLmxvYWRlZCkge1xuICAgICAgICAgICAgICAgICAgICBhc3NldHNbaV0ub25jZSgnbG9hZCcsIG9uQXNzZXRMb2FkKTtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2ldLm9uY2UoJ2Vycm9yJywgb25Bc3NldEVycm9yKTtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5sb2FkKGFzc2V0c1tpXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6cHJvZ3Jlc3NcIiwgcHJvZ3Jlc3MuY291bnQgLyB0b3RhbCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkb25lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcHJlbG9hZFNjcmlwdHMoc2NlbmVEYXRhLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXNjcmlwdC5sZWdhY3kpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSB0cnVlO1xuXG4gICAgICAgIGNvbnN0IHNjcmlwdHMgPSB0aGlzLl9nZXRTY3JpcHRSZWZlcmVuY2VzKHNjZW5lRGF0YSk7XG5cbiAgICAgICAgY29uc3QgbCA9IHNjcmlwdHMubGVuZ3RoO1xuICAgICAgICBjb25zdCBwcm9ncmVzcyA9IG5ldyBQcm9ncmVzcyhsKTtcbiAgICAgICAgY29uc3QgcmVnZXggPSAvXmh0dHAocyk/OlxcL1xcLy87XG5cbiAgICAgICAgaWYgKGwpIHtcbiAgICAgICAgICAgIGNvbnN0IG9uTG9hZCA9IChlcnIsIFNjcmlwdFR5cGUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyKVxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG5cbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MuZG9uZSgpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGV0IHNjcmlwdFVybCA9IHNjcmlwdHNbaV07XG4gICAgICAgICAgICAgICAgLy8gc3VwcG9ydCBhYnNvbHV0ZSBVUkxzIChmb3Igbm93KVxuICAgICAgICAgICAgICAgIGlmICghcmVnZXgudGVzdChzY3JpcHRVcmwudG9Mb3dlckNhc2UoKSkgJiYgdGhpcy5fc2NyaXB0UHJlZml4KVxuICAgICAgICAgICAgICAgICAgICBzY3JpcHRVcmwgPSBwYXRoLmpvaW4odGhpcy5fc2NyaXB0UHJlZml4LCBzY3JpcHRzW2ldKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGVyLmxvYWQoc2NyaXB0VXJsLCAnc2NyaXB0Jywgb25Mb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5zY3JpcHQucHJlbG9hZGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHNldCBhcHBsaWNhdGlvbiBwcm9wZXJ0aWVzIGZyb20gZGF0YSBmaWxlXG4gICAgX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzKHByb3BzLCBjYWxsYmFjaykge1xuICAgICAgICAvLyBjb25maWd1cmUgcmV0cnlpbmcgYXNzZXRzXG4gICAgICAgIGlmICh0eXBlb2YgcHJvcHMubWF4QXNzZXRSZXRyaWVzID09PSAnbnVtYmVyJyAmJiBwcm9wcy5tYXhBc3NldFJldHJpZXMgPiAwKSB7XG4gICAgICAgICAgICB0aGlzLmxvYWRlci5lbmFibGVSZXRyeShwcm9wcy5tYXhBc3NldFJldHJpZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgdGVtcG9yYXJ5IGJsb2NrIGFmdGVyIG1pZ3JhdGluZyBwcm9wZXJ0aWVzXG4gICAgICAgIGlmICghcHJvcHMudXNlRGV2aWNlUGl4ZWxSYXRpbylcbiAgICAgICAgICAgIHByb3BzLnVzZURldmljZVBpeGVsUmF0aW8gPSBwcm9wcy51c2VfZGV2aWNlX3BpeGVsX3JhdGlvO1xuICAgICAgICBpZiAoIXByb3BzLnJlc29sdXRpb25Nb2RlKVxuICAgICAgICAgICAgcHJvcHMucmVzb2x1dGlvbk1vZGUgPSBwcm9wcy5yZXNvbHV0aW9uX21vZGU7XG4gICAgICAgIGlmICghcHJvcHMuZmlsbE1vZGUpXG4gICAgICAgICAgICBwcm9wcy5maWxsTW9kZSA9IHByb3BzLmZpbGxfbW9kZTtcblxuICAgICAgICB0aGlzLl93aWR0aCA9IHByb3BzLndpZHRoO1xuICAgICAgICB0aGlzLl9oZWlnaHQgPSBwcm9wcy5oZWlnaHQ7XG4gICAgICAgIGlmIChwcm9wcy51c2VEZXZpY2VQaXhlbFJhdGlvKSB7XG4gICAgICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLm1heFBpeGVsUmF0aW8gPSB3aW5kb3cuZGV2aWNlUGl4ZWxSYXRpbztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0Q2FudmFzUmVzb2x1dGlvbihwcm9wcy5yZXNvbHV0aW9uTW9kZSwgdGhpcy5fd2lkdGgsIHRoaXMuX2hlaWdodCk7XG4gICAgICAgIHRoaXMuc2V0Q2FudmFzRmlsbE1vZGUocHJvcHMuZmlsbE1vZGUsIHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQpO1xuXG4gICAgICAgIC8vIHNldCB1cCBsYXllcnNcbiAgICAgICAgaWYgKHByb3BzLmxheWVycyAmJiBwcm9wcy5sYXllck9yZGVyKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wb3NpdGlvbiA9IG5ldyBMYXllckNvbXBvc2l0aW9uKFwiYXBwbGljYXRpb25cIik7XG5cbiAgICAgICAgICAgIGNvbnN0IGxheWVycyA9IHt9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gcHJvcHMubGF5ZXJzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YSA9IHByb3BzLmxheWVyc1trZXldO1xuICAgICAgICAgICAgICAgIGRhdGEuaWQgPSBwYXJzZUludChrZXksIDEwKTtcbiAgICAgICAgICAgICAgICAvLyBkZXB0aCBsYXllciBzaG91bGQgb25seSBiZSBlbmFibGVkIHdoZW4gbmVlZGVkXG4gICAgICAgICAgICAgICAgLy8gYnkgaW5jcmVtZW50aW5nIGl0cyByZWYgY291bnRlclxuICAgICAgICAgICAgICAgIGRhdGEuZW5hYmxlZCA9IGRhdGEuaWQgIT09IExBWUVSSURfREVQVEg7XG4gICAgICAgICAgICAgICAgbGF5ZXJzW2tleV0gPSBuZXcgTGF5ZXIoZGF0YSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wcy5sYXllck9yZGVyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3VibGF5ZXIgPSBwcm9wcy5sYXllck9yZGVyW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzW3N1YmxheWVyLmxheWVyXTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmIChzdWJsYXllci50cmFuc3BhcmVudCkge1xuICAgICAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5wdXNoVHJhbnNwYXJlbnQobGF5ZXIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvc2l0aW9uLnB1c2hPcGFxdWUobGF5ZXIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbXBvc2l0aW9uLnN1YkxheWVyRW5hYmxlZFtpXSA9IHN1YmxheWVyLmVuYWJsZWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuc2NlbmUubGF5ZXJzID0gY29tcG9zaXRpb247XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGQgYmF0Y2ggZ3JvdXBzXG4gICAgICAgIGlmIChwcm9wcy5iYXRjaEdyb3Vwcykge1xuICAgICAgICAgICAgY29uc3QgYmF0Y2hlciA9IHRoaXMuYmF0Y2hlcjtcbiAgICAgICAgICAgIGlmIChiYXRjaGVyKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHByb3BzLmJhdGNoR3JvdXBzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdycCA9IHByb3BzLmJhdGNoR3JvdXBzW2ldO1xuICAgICAgICAgICAgICAgICAgICBiYXRjaGVyLmFkZEdyb3VwKGdycC5uYW1lLCBncnAuZHluYW1pYywgZ3JwLm1heEFhYmJTaXplLCBncnAuaWQsIGdycC5sYXllcnMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCBsb2NhbGl6YXRpb24gYXNzZXRzXG4gICAgICAgIGlmIChwcm9wcy5pMThuQXNzZXRzKSB7XG4gICAgICAgICAgICB0aGlzLmkxOG4uYXNzZXRzID0gcHJvcHMuaTE4bkFzc2V0cztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2xvYWRMaWJyYXJpZXMocHJvcHMubGlicmFyaWVzLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmdbXX0gdXJscyAtIExpc3Qgb2YgVVJMcyB0byBsb2FkLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gQ2FsbGJhY2sgZnVuY3Rpb24uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9hZExpYnJhcmllcyh1cmxzLCBjYWxsYmFjaykge1xuICAgICAgICBjb25zdCBsZW4gPSB1cmxzLmxlbmd0aDtcbiAgICAgICAgbGV0IGNvdW50ID0gbGVuO1xuXG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gL15odHRwKHMpPzpcXC9cXC8vO1xuXG4gICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgIGNvbnN0IG9uTG9hZCA9IChlcnIsIHNjcmlwdCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvdW50LS07XG4gICAgICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhlcnIpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoY291bnQgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vbkxpYnJhcmllc0xvYWRlZCgpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHVybCA9IHVybHNbaV07XG5cbiAgICAgICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3QodXJsLnRvTG93ZXJDYXNlKCkpICYmIHRoaXMuX3NjcmlwdFByZWZpeClcbiAgICAgICAgICAgICAgICAgICAgdXJsID0gcGF0aC5qb2luKHRoaXMuX3NjcmlwdFByZWZpeCwgdXJsKTtcblxuICAgICAgICAgICAgICAgIHRoaXMubG9hZGVyLmxvYWQodXJsLCAnc2NyaXB0Jywgb25Mb2FkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IHNjZW5lIG5hbWUvdXJscyBpbnRvIHRoZSByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Kn0gc2NlbmVzIC0gU2NlbmVzIHRvIGFkZCB0byB0aGUgc2NlbmUgcmVnaXN0cnkuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VTY2VuZXMoc2NlbmVzKSB7XG4gICAgICAgIGlmICghc2NlbmVzKSByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2VuZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuc2NlbmVzLmFkZChzY2VuZXNbaV0ubmFtZSwgc2NlbmVzW2ldLnVybCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgYXNzZXRzIGludG8gcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IGFzc2V0cyAtIEFzc2V0cyB0byBpbnNlcnQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VBc3NldHMoYXNzZXRzKSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSBbXTtcblxuICAgICAgICBjb25zdCBzY3JpcHRzSW5kZXggPSB7fTtcbiAgICAgICAgY29uc3QgYnVuZGxlc0luZGV4ID0ge307XG5cbiAgICAgICAgaWYgKCFzY3JpcHQubGVnYWN5KSB7XG4gICAgICAgICAgICAvLyBhZGQgc2NyaXB0cyBpbiBvcmRlciBvZiBsb2FkaW5nIGZpcnN0XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2NyaXB0c09yZGVyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSB0aGlzLnNjcmlwdHNPcmRlcltpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0c1tpZF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgc2NyaXB0c0luZGV4W2lkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0aGVuIGFkZCBidW5kbGVzXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0c1tpZF0udHlwZSA9PT0gJ2J1bmRsZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJ1bmRsZXNJbmRleFtpZF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB0aGVuIGFkZCByZXN0IG9mIGFzc2V0c1xuICAgICAgICAgICAgZm9yIChjb25zdCBpZCBpbiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoc2NyaXB0c0luZGV4W2lkXSB8fCBidW5kbGVzSW5kZXhbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZUJ1bmRsZXMpIHtcbiAgICAgICAgICAgICAgICAvLyBhZGQgYnVuZGxlc1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldHNbaWRdLnR5cGUgPT09ICdidW5kbGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidW5kbGVzSW5kZXhbaWRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgcmVzdCBvZiBhc3NldHNcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJ1bmRsZXNJbmRleFtpZF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgbGlzdC5wdXNoKGFzc2V0c1tpZF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gbGlzdFtpXTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gbmV3IEFzc2V0KGRhdGEubmFtZSwgZGF0YS50eXBlLCBkYXRhLmZpbGUsIGRhdGEuZGF0YSk7XG4gICAgICAgICAgICBhc3NldC5pZCA9IHBhcnNlSW50KGRhdGEuaWQsIDEwKTtcbiAgICAgICAgICAgIGFzc2V0LnByZWxvYWQgPSBkYXRhLnByZWxvYWQgPyBkYXRhLnByZWxvYWQgOiBmYWxzZTtcbiAgICAgICAgICAgIC8vIGlmIHRoaXMgaXMgYSBzY3JpcHQgYXNzZXQgYW5kIGhhcyBhbHJlYWR5IGJlZW4gZW1iZWRkZWQgaW4gdGhlIHBhZ2UgdGhlblxuICAgICAgICAgICAgLy8gbWFyayBpdCBhcyBsb2FkZWRcbiAgICAgICAgICAgIGFzc2V0LmxvYWRlZCA9IGRhdGEudHlwZSA9PT0gJ3NjcmlwdCcgJiYgZGF0YS5kYXRhICYmIGRhdGEuZGF0YS5sb2FkaW5nVHlwZSA+IDA7XG4gICAgICAgICAgICAvLyB0YWdzXG4gICAgICAgICAgICBhc3NldC50YWdzLmFkZChkYXRhLnRhZ3MpO1xuICAgICAgICAgICAgLy8gaTE4blxuICAgICAgICAgICAgaWYgKGRhdGEuaTE4bikge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbG9jYWxlIGluIGRhdGEuaTE4bikge1xuICAgICAgICAgICAgICAgICAgICBhc3NldC5hZGRMb2NhbGl6ZWRBc3NldElkKGxvY2FsZSwgZGF0YS5pMThuW2xvY2FsZV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIHJlZ2lzdHJ5XG4gICAgICAgICAgICB0aGlzLmFzc2V0cy5hZGQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHJldHVybnMge0FycmF5fSAtIFRoZSBsaXN0IG9mIHNjcmlwdHMgdGhhdCBhcmUgcmVmZXJlbmNlZCBieSB0aGUgc2NlbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0U2NyaXB0UmVmZXJlbmNlcyhzY2VuZSkge1xuICAgICAgICBsZXQgcHJpb3JpdHlTY3JpcHRzID0gW107XG4gICAgICAgIGlmIChzY2VuZS5zZXR0aW5ncy5wcmlvcml0eV9zY3JpcHRzKSB7XG4gICAgICAgICAgICBwcmlvcml0eVNjcmlwdHMgPSBzY2VuZS5zZXR0aW5ncy5wcmlvcml0eV9zY3JpcHRzO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgX3NjcmlwdHMgPSBbXTtcbiAgICAgICAgY29uc3QgX2luZGV4ID0ge307XG5cbiAgICAgICAgLy8gZmlyc3QgYWRkIHByaW9yaXR5IHNjcmlwdHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmlvcml0eVNjcmlwdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIF9zY3JpcHRzLnB1c2gocHJpb3JpdHlTY3JpcHRzW2ldKTtcbiAgICAgICAgICAgIF9pbmRleFtwcmlvcml0eVNjcmlwdHNbaV1dID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRoZW4gaXRlcmF0ZSBoaWVyYXJjaHkgdG8gZ2V0IHJlZmVyZW5jZWQgc2NyaXB0c1xuICAgICAgICBjb25zdCBlbnRpdGllcyA9IHNjZW5lLmVudGl0aWVzO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBlbnRpdGllcykge1xuICAgICAgICAgICAgaWYgKCFlbnRpdGllc1trZXldLmNvbXBvbmVudHMuc2NyaXB0KSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNjcmlwdHMgPSBlbnRpdGllc1trZXldLmNvbXBvbmVudHMuc2NyaXB0LnNjcmlwdHM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjcmlwdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoX2luZGV4W3NjcmlwdHNbaV0udXJsXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgX3NjcmlwdHMucHVzaChzY3JpcHRzW2ldLnVybCk7XG4gICAgICAgICAgICAgICAgX2luZGV4W3NjcmlwdHNbaV0udXJsXSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX3NjcmlwdHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgdGhlIGFwcGxpY2F0aW9uLiBUaGlzIGZ1bmN0aW9uIGRvZXMgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIDEuIEZpcmVzIGFuIGV2ZW50IG9uIHRoZSBhcHBsaWNhdGlvbiBuYW1lZCAnc3RhcnQnXG4gICAgICogMi4gQ2FsbHMgaW5pdGlhbGl6ZSBmb3IgYWxsIGNvbXBvbmVudHMgb24gZW50aXRpZXMgaW4gdGhlIGhpZXJhcmNoeVxuICAgICAqIDMuIEZpcmVzIGFuIGV2ZW50IG9uIHRoZSBhcHBsaWNhdGlvbiBuYW1lZCAnaW5pdGlhbGl6ZSdcbiAgICAgKiA0LiBDYWxscyBwb3N0SW5pdGlhbGl6ZSBmb3IgYWxsIGNvbXBvbmVudHMgb24gZW50aXRpZXMgaW4gdGhlIGhpZXJhcmNoeVxuICAgICAqIDUuIEZpcmVzIGFuIGV2ZW50IG9uIHRoZSBhcHBsaWNhdGlvbiBuYW1lZCAncG9zdGluaXRpYWxpemUnXG4gICAgICogNi4gU3RhcnRzIGV4ZWN1dGluZyB0aGUgbWFpbiBsb29wIG9mIHRoZSBhcHBsaWNhdGlvblxuICAgICAqXG4gICAgICogVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgaW50ZXJuYWxseSBieSBQbGF5Q2FudmFzIGFwcGxpY2F0aW9ucyBtYWRlIGluIHRoZSBFZGl0b3IgYnV0IHlvdVxuICAgICAqIHdpbGwgbmVlZCB0byBjYWxsIHN0YXJ0IHlvdXJzZWxmIGlmIHlvdSBhcmUgdXNpbmcgdGhlIGVuZ2luZSBzdGFuZC1hbG9uZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnN0YXJ0KCk7XG4gICAgICovXG4gICAgc3RhcnQoKSB7XG5cbiAgICAgICAgRGVidWcuY2FsbCgoKSA9PiB7XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQoIXRoaXMuX2FscmVhZHlTdGFydGVkLCBcIlRoZSBhcHBsaWNhdGlvbiBjYW4gYmUgc3RhcnRlZCBvbmx5IG9uZSB0aW1lLlwiKTtcbiAgICAgICAgICAgIHRoaXMuX2FscmVhZHlTdGFydGVkID0gdHJ1ZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5mcmFtZSA9IDA7XG5cbiAgICAgICAgdGhpcy5maXJlKFwic3RhcnRcIiwge1xuICAgICAgICAgICAgdGltZXN0YW1wOiBub3coKSxcbiAgICAgICAgICAgIHRhcmdldDogdGhpc1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXRoaXMuX2xpYnJhcmllc0xvYWRlZCkge1xuICAgICAgICAgICAgdGhpcy5vbkxpYnJhcmllc0xvYWRlZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ2luaXRpYWxpemUnLCB0aGlzLnJvb3QpO1xuICAgICAgICB0aGlzLmZpcmUoJ2luaXRpYWxpemUnKTtcblxuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgncG9zdEluaXRpYWxpemUnLCB0aGlzLnJvb3QpO1xuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgncG9zdFBvc3RJbml0aWFsaXplJywgdGhpcy5yb290KTtcbiAgICAgICAgdGhpcy5maXJlKCdwb3N0aW5pdGlhbGl6ZScpO1xuXG4gICAgICAgIHRoaXMudGljaygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZSBhbGwgaW5wdXQgZGV2aWNlcyBtYW5hZ2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgaW5wdXRVcGRhdGUoZHQpIHtcbiAgICAgICAgaWYgKHRoaXMuY29udHJvbGxlcikge1xuICAgICAgICAgICAgdGhpcy5jb250cm9sbGVyLnVwZGF0ZShkdCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMubW91c2UpIHtcbiAgICAgICAgICAgIHRoaXMubW91c2UudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMua2V5Ym9hcmQpIHtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZ2FtZXBhZHMpIHtcbiAgICAgICAgICAgIHRoaXMuZ2FtZXBhZHMudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIGFwcGxpY2F0aW9uLiBUaGlzIGZ1bmN0aW9uIHdpbGwgY2FsbCB0aGUgdXBkYXRlIGZ1bmN0aW9ucyBhbmQgdGhlbiB0aGUgcG9zdFVwZGF0ZVxuICAgICAqIGZ1bmN0aW9ucyBvZiBhbGwgZW5hYmxlZCBjb21wb25lbnRzLiBJdCB3aWxsIHRoZW4gdXBkYXRlIHRoZSBjdXJyZW50IHN0YXRlIG9mIGFsbCBjb25uZWN0ZWRcbiAgICAgKiBpbnB1dCBkZXZpY2VzLiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBpbnRlcm5hbGx5IGluIHRoZSBhcHBsaWNhdGlvbidzIG1haW4gbG9vcCBhbmQgZG9lc1xuICAgICAqIG5vdCBuZWVkIHRvIGJlIGNhbGxlZCBleHBsaWNpdGx5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIHRpbWUgZGVsdGEgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS5cbiAgICAgKi9cbiAgICB1cGRhdGUoZHQpIHtcbiAgICAgICAgdGhpcy5mcmFtZSsrO1xuXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UudXBkYXRlQ2xpZW50UmVjdCgpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS51cGRhdGVTdGFydCA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyBQZXJmb3JtIENvbXBvbmVudFN5c3RlbSB1cGRhdGVcbiAgICAgICAgaWYgKHNjcmlwdC5sZWdhY3kpXG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgnZml4ZWRVcGRhdGUnLCAxLjAgLyA2MC4wKTtcblxuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSh0aGlzLl9pblRvb2xzID8gJ3Rvb2xzVXBkYXRlJyA6ICd1cGRhdGUnLCBkdCk7XG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdhbmltYXRpb25VcGRhdGUnLCBkdCk7XG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdwb3N0VXBkYXRlJywgZHQpO1xuXG4gICAgICAgIC8vIGZpcmUgdXBkYXRlIGV2ZW50XG4gICAgICAgIHRoaXMuZmlyZShcInVwZGF0ZVwiLCBkdCk7XG5cbiAgICAgICAgLy8gdXBkYXRlIGlucHV0IGRldmljZXNcbiAgICAgICAgdGhpcy5pbnB1dFVwZGF0ZShkdCk7XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnVwZGF0ZVRpbWUgPSBub3coKSAtIHRoaXMuc3RhdHMuZnJhbWUudXBkYXRlU3RhcnQ7XG4gICAgICAgIC8vICNlbmRpZlxuICAgIH1cblxuICAgIGZyYW1lU3RhcnQoKSB7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuZnJhbWVTdGFydCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlciB0aGUgYXBwbGljYXRpb24ncyBzY2VuZS4gTW9yZSBzcGVjaWZpY2FsbHksIHRoZSBzY2VuZSdzIHtAbGluayBMYXllckNvbXBvc2l0aW9ufSBpc1xuICAgICAqIHJlbmRlcmVkLiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBpbnRlcm5hbGx5IGluIHRoZSBhcHBsaWNhdGlvbidzIG1haW4gbG9vcCBhbmQgZG9lcyBub3RcbiAgICAgKiBuZWVkIHRvIGJlIGNhbGxlZCBleHBsaWNpdGx5LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbmRlcigpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnJlbmRlclN0YXJ0ID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuZmlyZSgncHJlcmVuZGVyJyk7XG4gICAgICAgIHRoaXMucm9vdC5zeW5jSGllcmFyY2h5KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIudXBkYXRlQWxsKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIEZvcndhcmRSZW5kZXJlci5fc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyByZW5kZXIgdGhlIHNjZW5lIGNvbXBvc2l0aW9uXG4gICAgICAgIHRoaXMucmVuZGVyQ29tcG9zaXRpb24odGhpcy5zY2VuZS5sYXllcnMpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgncG9zdHJlbmRlcicpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS5yZW5kZXJUaW1lID0gbm93KCkgLSB0aGlzLnN0YXRzLmZyYW1lLnJlbmRlclN0YXJ0O1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvLyByZW5kZXIgYSBsYXllciBjb21wb3NpdGlvblxuICAgIHJlbmRlckNvbXBvc2l0aW9uKGxheWVyQ29tcG9zaXRpb24pIHtcbiAgICAgICAgRGVidWdHcmFwaGljcy5jbGVhckdwdU1hcmtlcnMoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5idWlsZEZyYW1lR3JhcGgodGhpcy5mcmFtZUdyYXBoLCBsYXllckNvbXBvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5mcmFtZUdyYXBoLnJlbmRlcih0aGlzLmdyYXBoaWNzRGV2aWNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbm93IC0gVGhlIHRpbWVzdGFtcCBwYXNzZWQgdG8gdGhlIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgdGltZSBkZWx0YSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGZyYW1lLiBUaGlzIGlzIHN1YmplY3QgdG8gdGhlXG4gICAgICogYXBwbGljYXRpb24ncyB0aW1lIHNjYWxlIGFuZCBtYXggZGVsdGEgdmFsdWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtcyAtIFRoZSB0aW1lIGluIG1pbGxpc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9maWxsRnJhbWVTdGF0c0Jhc2ljKG5vdywgZHQsIG1zKSB7XG4gICAgICAgIC8vIFRpbWluZyBzdGF0c1xuICAgICAgICBjb25zdCBzdGF0cyA9IHRoaXMuc3RhdHMuZnJhbWU7XG4gICAgICAgIHN0YXRzLmR0ID0gZHQ7XG4gICAgICAgIHN0YXRzLm1zID0gbXM7XG4gICAgICAgIGlmIChub3cgPiBzdGF0cy5fdGltZVRvQ291bnRGcmFtZXMpIHtcbiAgICAgICAgICAgIHN0YXRzLmZwcyA9IHN0YXRzLl9mcHNBY2N1bTtcbiAgICAgICAgICAgIHN0YXRzLl9mcHNBY2N1bSA9IDA7XG4gICAgICAgICAgICBzdGF0cy5fdGltZVRvQ291bnRGcmFtZXMgPSBub3cgKyAxMDAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdHMuX2Zwc0FjY3VtKys7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0b3RhbCBkcmF3IGNhbGxcbiAgICAgICAgdGhpcy5zdGF0cy5kcmF3Q2FsbHMudG90YWwgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9kcmF3Q2FsbHNQZXJGcmFtZTtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5fZHJhd0NhbGxzUGVyRnJhbWUgPSAwO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9maWxsRnJhbWVTdGF0cygpIHtcbiAgICAgICAgbGV0IHN0YXRzID0gdGhpcy5zdGF0cy5mcmFtZTtcblxuICAgICAgICAvLyBSZW5kZXIgc3RhdHNcbiAgICAgICAgc3RhdHMuY2FtZXJhcyA9IHRoaXMucmVuZGVyZXIuX2NhbWVyYXNSZW5kZXJlZDtcbiAgICAgICAgc3RhdHMubWF0ZXJpYWxzID0gdGhpcy5yZW5kZXJlci5fbWF0ZXJpYWxTd2l0Y2hlcztcbiAgICAgICAgc3RhdHMuc2hhZGVycyA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWU7XG4gICAgICAgIHN0YXRzLnNoYWRvd01hcFVwZGF0ZXMgPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzO1xuICAgICAgICBzdGF0cy5zaGFkb3dNYXBUaW1lID0gdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZTtcbiAgICAgICAgc3RhdHMuZGVwdGhNYXBUaW1lID0gdGhpcy5yZW5kZXJlci5fZGVwdGhNYXBUaW1lO1xuICAgICAgICBzdGF0cy5mb3J3YXJkVGltZSA9IHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lO1xuICAgICAgICBjb25zdCBwcmltcyA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuX3ByaW1zUGVyRnJhbWU7XG4gICAgICAgIHN0YXRzLnRyaWFuZ2xlcyA9IHByaW1zW1BSSU1JVElWRV9UUklBTkdMRVNdIC8gMyArXG4gICAgICAgICAgICBNYXRoLm1heChwcmltc1tQUklNSVRJVkVfVFJJU1RSSVBdIC0gMiwgMCkgK1xuICAgICAgICAgICAgTWF0aC5tYXgocHJpbXNbUFJJTUlUSVZFX1RSSUZBTl0gLSAyLCAwKTtcbiAgICAgICAgc3RhdHMuY3VsbFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9jdWxsVGltZTtcbiAgICAgICAgc3RhdHMuc29ydFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9zb3J0VGltZTtcbiAgICAgICAgc3RhdHMuc2tpblRpbWUgPSB0aGlzLnJlbmRlcmVyLl9za2luVGltZTtcbiAgICAgICAgc3RhdHMubW9ycGhUaW1lID0gdGhpcy5yZW5kZXJlci5fbW9ycGhUaW1lO1xuICAgICAgICBzdGF0cy5saWdodENsdXN0ZXJzID0gdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVycztcbiAgICAgICAgc3RhdHMubGlnaHRDbHVzdGVyc1RpbWUgPSB0aGlzLnJlbmRlcmVyLl9saWdodENsdXN0ZXJzVGltZTtcbiAgICAgICAgc3RhdHMub3RoZXJQcmltaXRpdmVzID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmltcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPCBQUklNSVRJVkVfVFJJQU5HTEVTKSB7XG4gICAgICAgICAgICAgICAgc3RhdHMub3RoZXJQcmltaXRpdmVzICs9IHByaW1zW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJpbXNbaV0gPSAwO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2NhbWVyYXNSZW5kZXJlZCA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX21hdGVyaWFsU3dpdGNoZXMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzID0gMDtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5fc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2N1bGxUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9saWdodENsdXN0ZXJzVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NvcnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2tpblRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9tb3JwaFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fZGVwdGhNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fZm9yd2FyZFRpbWUgPSAwO1xuXG4gICAgICAgIC8vIERyYXcgY2FsbCBzdGF0c1xuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHMuZHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5mb3J3YXJkID0gdGhpcy5yZW5kZXJlci5fZm9yd2FyZERyYXdDYWxscztcbiAgICAgICAgc3RhdHMuY3VsbGVkID0gdGhpcy5yZW5kZXJlci5fbnVtRHJhd0NhbGxzQ3VsbGVkO1xuICAgICAgICBzdGF0cy5kZXB0aCA9IDA7XG4gICAgICAgIHN0YXRzLnNoYWRvdyA9IHRoaXMucmVuZGVyZXIuX3NoYWRvd0RyYXdDYWxscztcbiAgICAgICAgc3RhdHMuc2tpbm5lZCA9IHRoaXMucmVuZGVyZXIuX3NraW5EcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLmltbWVkaWF0ZSA9IDA7XG4gICAgICAgIHN0YXRzLmluc3RhbmNlZCA9IDA7XG4gICAgICAgIHN0YXRzLnJlbW92ZWRCeUluc3RhbmNpbmcgPSAwO1xuICAgICAgICBzdGF0cy5taXNjID0gc3RhdHMudG90YWwgLSAoc3RhdHMuZm9yd2FyZCArIHN0YXRzLnNoYWRvdyk7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2RlcHRoRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93RHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fZm9yd2FyZERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX251bURyYXdDYWxsc0N1bGxlZCA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NraW5EcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9pbW1lZGlhdGVSZW5kZXJlZCA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2luc3RhbmNlZERyYXdDYWxscyA9IDA7XG5cbiAgICAgICAgdGhpcy5zdGF0cy5taXNjLnJlbmRlclRhcmdldENyZWF0aW9uVGltZSA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UucmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lO1xuXG4gICAgICAgIHN0YXRzID0gdGhpcy5zdGF0cy5wYXJ0aWNsZXM7XG4gICAgICAgIHN0YXRzLnVwZGF0ZXNQZXJGcmFtZSA9IHN0YXRzLl91cGRhdGVzUGVyRnJhbWU7XG4gICAgICAgIHN0YXRzLmZyYW1lVGltZSA9IHN0YXRzLl9mcmFtZVRpbWU7XG4gICAgICAgIHN0YXRzLl91cGRhdGVzUGVyRnJhbWUgPSAwO1xuICAgICAgICBzdGF0cy5fZnJhbWVUaW1lID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyBob3cgdGhlIGNhbnZhcyBmaWxscyB0aGUgd2luZG93IGFuZCByZXNpemVzIHdoZW4gdGhlIHdpbmRvdyBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgLSBUaGUgbW9kZSB0byB1c2Ugd2hlbiBzZXR0aW5nIHRoZSBzaXplIG9mIHRoZSBjYW52YXMuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX05PTkV9OiB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0ZJTExfV0lORE9XfTogdGhlIGNhbnZhcyB3aWxsIHNpbXBseSBmaWxsIHRoZSB3aW5kb3csIGNoYW5naW5nIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9LRUVQX0FTUEVDVH06IHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0IGNhbiB3aGlsZVxuICAgICAqIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3dpZHRoXSAtIFRoZSB3aWR0aCBvZiB0aGUgY2FudmFzIChvbmx5IHVzZWQgd2hlbiBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtoZWlnaHRdIC0gVGhlIGhlaWdodCBvZiB0aGUgY2FudmFzIChvbmx5IHVzZWQgd2hlbiBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfSkuXG4gICAgICovXG4gICAgc2V0Q2FudmFzRmlsbE1vZGUobW9kZSwgd2lkdGgsIGhlaWdodCkge1xuICAgICAgICB0aGlzLl9maWxsTW9kZSA9IG1vZGU7XG4gICAgICAgIHRoaXMucmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoYW5nZSB0aGUgcmVzb2x1dGlvbiBvZiB0aGUgY2FudmFzLCBhbmQgc2V0IHRoZSB3YXkgaXQgYmVoYXZlcyB3aGVuIHRoZSB3aW5kb3cgaXMgcmVzaXplZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIC0gVGhlIG1vZGUgdG8gdXNlIHdoZW4gc2V0dGluZyB0aGUgcmVzb2x1dGlvbi4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUkVTT0xVVElPTl9BVVRPfTogaWYgd2lkdGggYW5kIGhlaWdodCBhcmUgbm90IHByb3ZpZGVkLCBjYW52YXMgd2lsbCBiZSByZXNpemVkIHRvXG4gICAgICogbWF0Y2ggY2FudmFzIGNsaWVudCBzaXplLlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fRklYRUR9OiByZXNvbHV0aW9uIG9mIGNhbnZhcyB3aWxsIGJlIGZpeGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgaG9yaXpvbnRhbCByZXNvbHV0aW9uLCBvcHRpb25hbCBpbiBBVVRPIG1vZGUsIGlmIG5vdCBwcm92aWRlZFxuICAgICAqIGNhbnZhcyBjbGllbnRXaWR0aCBpcyB1c2VkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaGVpZ2h0XSAtIFRoZSB2ZXJ0aWNhbCByZXNvbHV0aW9uLCBvcHRpb25hbCBpbiBBVVRPIG1vZGUsIGlmIG5vdCBwcm92aWRlZFxuICAgICAqIGNhbnZhcyBjbGllbnRIZWlnaHQgaXMgdXNlZC5cbiAgICAgKi9cbiAgICBzZXRDYW52YXNSZXNvbHV0aW9uKG1vZGUsIHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgdGhpcy5fcmVzb2x1dGlvbk1vZGUgPSBtb2RlO1xuXG4gICAgICAgIC8vIEluIEFVVE8gbW9kZSB0aGUgcmVzb2x1dGlvbiBpcyB0aGUgc2FtZSBhcyB0aGUgY2FudmFzIHNpemUsIHVubGVzcyBzcGVjaWZpZWRcbiAgICAgICAgaWYgKG1vZGUgPT09IFJFU09MVVRJT05fQVVUTyAmJiAod2lkdGggPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgICAgIHdpZHRoID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuY2xpZW50V2lkdGg7XG4gICAgICAgICAgICBoZWlnaHQgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5jbGllbnRIZWlnaHQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLnJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHRoZSB2aXNpYmlsaXR5IG9mIHRoZSB3aW5kb3cgb3IgdGFiIGluIHdoaWNoIHRoZSBhcHBsaWNhdGlvbiBpcyBydW5uaW5nLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGFwcGxpY2F0aW9uIGlzIG5vdCB2aXNpYmxlIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgaXNIaWRkZW4oKSB7XG4gICAgICAgIHJldHVybiBkb2N1bWVudFt0aGlzLl9oaWRkZW5BdHRyXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgdmlzaWJpbGl0eSBzdGF0ZSBvZiB0aGUgY3VycmVudCB0YWIvd2luZG93IGNoYW5nZXMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uVmlzaWJpbGl0eUNoYW5nZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNIaWRkZW4oKSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NvdW5kTWFuYWdlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5zdXNwZW5kKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc291bmRNYW5hZ2VyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc291bmRNYW5hZ2VyLnJlc3VtZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzaXplIHRoZSBhcHBsaWNhdGlvbidzIGNhbnZhcyBlbGVtZW50IGluIGxpbmUgd2l0aCB0aGUgY3VycmVudCBmaWxsIG1vZGUuXG4gICAgICpcbiAgICAgKiAtIEluIHtAbGluayBGSUxMTU9ERV9LRUVQX0FTUEVDVH0gbW9kZSwgdGhlIGNhbnZhcyB3aWxsIGdyb3cgdG8gZmlsbCB0aGUgd2luZG93IGFzIGJlc3QgaXRcbiAgICAgKiBjYW4gd2hpbGUgbWFpbnRhaW5pbmcgdGhlIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIEluIHtAbGluayBGSUxMTU9ERV9GSUxMX1dJTkRPV30gbW9kZSwgdGhlIGNhbnZhcyB3aWxsIHNpbXBseSBmaWxsIHRoZSB3aW5kb3csIGNoYW5naW5nXG4gICAgICogYXNwZWN0IHJhdGlvLlxuICAgICAqIC0gSW4ge0BsaW5rIEZJTExNT0RFX05PTkV9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBhbHdheXMgbWF0Y2ggdGhlIHNpemUgcHJvdmlkZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3dpZHRoXSAtIFRoZSB3aWR0aCBvZiB0aGUgY2FudmFzLiBPbmx5IHVzZWQgaWYgY3VycmVudCBmaWxsIG1vZGUgaXMge0BsaW5rIEZJTExNT0RFX05PTkV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcy4gT25seSB1c2VkIGlmIGN1cnJlbnQgZmlsbCBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfS5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSBBIG9iamVjdCBjb250YWluaW5nIHRoZSB2YWx1ZXMgY2FsY3VsYXRlZCB0byB1c2UgYXMgd2lkdGggYW5kIGhlaWdodC5cbiAgICAgKi9cbiAgICByZXNpemVDYW52YXMod2lkdGgsIGhlaWdodCkge1xuICAgICAgICBpZiAoIXRoaXMuX2FsbG93UmVzaXplKSByZXR1cm4gdW5kZWZpbmVkOyAvLyBwcmV2ZW50IHJlc2l6aW5nIChlLmcuIGlmIHByZXNlbnRpbmcgaW4gVlIgSE1EKVxuXG4gICAgICAgIC8vIHByZXZlbnQgcmVzaXppbmcgd2hlbiBpbiBYUiBzZXNzaW9uXG4gICAgICAgIGlmICh0aGlzLnhyICYmIHRoaXMueHIuc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG5cbiAgICAgICAgY29uc3Qgd2luZG93V2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgICAgY29uc3Qgd2luZG93SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLl9maWxsTW9kZSA9PT0gRklMTE1PREVfS0VFUF9BU1BFQ1QpIHtcbiAgICAgICAgICAgIGNvbnN0IHIgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy53aWR0aCAvIHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLmhlaWdodDtcbiAgICAgICAgICAgIGNvbnN0IHdpblIgPSB3aW5kb3dXaWR0aCAvIHdpbmRvd0hlaWdodDtcblxuICAgICAgICAgICAgaWYgKHIgPiB3aW5SKSB7XG4gICAgICAgICAgICAgICAgd2lkdGggPSB3aW5kb3dXaWR0aDtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSB3aWR0aCAvIHI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHdpbmRvd0hlaWdodDtcbiAgICAgICAgICAgICAgICB3aWR0aCA9IGhlaWdodCAqIHI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fZmlsbE1vZGUgPT09IEZJTExNT0RFX0ZJTExfV0lORE9XKSB7XG4gICAgICAgICAgICB3aWR0aCA9IHdpbmRvd1dpZHRoO1xuICAgICAgICAgICAgaGVpZ2h0ID0gd2luZG93SGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIC8vIE9USEVSV0lTRTogRklMTE1PREVfTk9ORSB1c2Ugd2lkdGggYW5kIGhlaWdodCB0aGF0IGFyZSBwcm92aWRlZFxuXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLnN0eWxlLndpZHRoID0gd2lkdGggKyAncHgnO1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5zdHlsZS5oZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xuXG4gICAgICAgIHRoaXMudXBkYXRlQ2FudmFzU2l6ZSgpO1xuXG4gICAgICAgIC8vIHJldHVybiB0aGUgZmluYWwgdmFsdWVzIGNhbGN1bGF0ZWQgZm9yIHdpZHRoIGFuZCBoZWlnaHRcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB0aGUge0BsaW5rIEdyYXBoaWNzRGV2aWNlfSBjYW52YXMgc2l6ZSB0byBtYXRjaCB0aGUgY2FudmFzIHNpemUgb24gdGhlIGRvY3VtZW50XG4gICAgICogcGFnZS4gSXQgaXMgcmVjb21tZW5kZWQgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIHdoZW4gdGhlIGNhbnZhcyBzaXplIGNoYW5nZXMgKGUuZyBvbiB3aW5kb3dcbiAgICAgKiByZXNpemUgYW5kIG9yaWVudGF0aW9uIGNoYW5nZSBldmVudHMpIHNvIHRoYXQgdGhlIGNhbnZhcyByZXNvbHV0aW9uIGlzIGltbWVkaWF0ZWx5IHVwZGF0ZWQuXG4gICAgICovXG4gICAgdXBkYXRlQ2FudmFzU2l6ZSgpIHtcbiAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIGlmIHdlIGFyZSBpbiBWUiBvciBYUlxuICAgICAgICBpZiAoKCF0aGlzLl9hbGxvd1Jlc2l6ZSkgfHwgKHRoaXMueHI/LmFjdGl2ZSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEluIEFVVE8gbW9kZSB0aGUgcmVzb2x1dGlvbiBpcyBjaGFuZ2VkIHRvIG1hdGNoIHRoZSBjYW52YXMgc2l6ZVxuICAgICAgICBpZiAodGhpcy5fcmVzb2x1dGlvbk1vZGUgPT09IFJFU09MVVRJT05fQVVUTykge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIGNhbnZhcyBET00gaGFzIGNoYW5nZWQgc2l6ZVxuICAgICAgICAgICAgY29uc3QgY2FudmFzID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXM7XG4gICAgICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLnJlc2l6ZUNhbnZhcyhjYW52YXMuY2xpZW50V2lkdGgsIGNhbnZhcy5jbGllbnRIZWlnaHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXZlbnQgaGFuZGxlciBjYWxsZWQgd2hlbiBhbGwgY29kZSBsaWJyYXJpZXMgaGF2ZSBiZWVuIGxvYWRlZC4gQ29kZSBsaWJyYXJpZXMgYXJlIHBhc3NlZFxuICAgICAqIGludG8gdGhlIGNvbnN0cnVjdG9yIG9mIHRoZSBBcHBsaWNhdGlvbiBhbmQgdGhlIGFwcGxpY2F0aW9uIHdvbid0IHN0YXJ0IHJ1bm5pbmcgb3IgbG9hZFxuICAgICAqIHBhY2tzIHVudGlsIGFsbCBsaWJyYXJpZXMgaGF2ZSBiZWVuIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25MaWJyYXJpZXNMb2FkZWQoKSB7XG4gICAgICAgIHRoaXMuX2xpYnJhcmllc0xvYWRlZCA9IHRydWU7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtcy5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5yaWdpZGJvZHkub25MaWJyYXJ5TG9hZGVkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBzY2VuZSBzZXR0aW5ncyB0byB0aGUgY3VycmVudCBzY2VuZS4gVXNlZnVsIHdoZW4geW91ciBzY2VuZSBzZXR0aW5ncyBhcmUgcGFyc2VkIG9yXG4gICAgICogZ2VuZXJhdGVkIGZyb20gYSBub24tVVJMIHNvdXJjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzZXR0aW5ncyAtIFRoZSBzY2VuZSBzZXR0aW5ncyB0byBiZSBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzZXR0aW5ncy5waHlzaWNzIC0gVGhlIHBoeXNpY3Mgc2V0dGluZ3MgdG8gYmUgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5waHlzaWNzLmdyYXZpdHkgLSBUaGUgd29ybGQgc3BhY2UgdmVjdG9yIHJlcHJlc2VudGluZyBnbG9iYWxcbiAgICAgKiBncmF2aXR5IGluIHRoZSBwaHlzaWNzIHNpbXVsYXRpb24uIE11c3QgYmUgYSBmaXhlZCBzaXplIGFycmF5IHdpdGggdGhyZWUgbnVtYmVyIGVsZW1lbnRzLFxuICAgICAqIGNvcnJlc3BvbmRpbmcgdG8gZWFjaCBheGlzIFsgWCwgWSwgWiBdLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzZXR0aW5ncy5yZW5kZXIgLSBUaGUgcmVuZGVyaW5nIHNldHRpbmdzIHRvIGJlIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucmVuZGVyLmdsb2JhbF9hbWJpZW50IC0gVGhlIGNvbG9yIG9mIHRoZSBzY2VuZSdzIGFtYmllbnQgbGlnaHQuXG4gICAgICogTXVzdCBiZSBhIGZpeGVkIHNpemUgYXJyYXkgd2l0aCB0aHJlZSBudW1iZXIgZWxlbWVudHMsIGNvcnJlc3BvbmRpbmcgdG8gZWFjaCBjb2xvciBjaGFubmVsXG4gICAgICogWyBSLCBHLCBCIF0uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNldHRpbmdzLnJlbmRlci5mb2cgLSBUaGUgdHlwZSBvZiBmb2cgdXNlZCBieSB0aGUgc2NlbmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZPR19OT05FfVxuICAgICAqIC0ge0BsaW5rIEZPR19MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRk9HX0VYUH1cbiAgICAgKiAtIHtAbGluayBGT0dfRVhQMn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnJlbmRlci5mb2dfY29sb3IgLSBUaGUgY29sb3Igb2YgdGhlIGZvZyAoaWYgZW5hYmxlZCkuIE11c3QgYmUgYVxuICAgICAqIGZpeGVkIHNpemUgYXJyYXkgd2l0aCB0aHJlZSBudW1iZXIgZWxlbWVudHMsIGNvcnJlc3BvbmRpbmcgdG8gZWFjaCBjb2xvciBjaGFubmVsIFsgUiwgRywgQiBdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZm9nX2RlbnNpdHkgLSBUaGUgZGVuc2l0eSBvZiB0aGUgZm9nIChpZiBlbmFibGVkKS4gVGhpc1xuICAgICAqIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19FWFB9IG9yIHtAbGluayBGT0dfRVhQMn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5mb2dfc3RhcnQgLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdmlld3BvaW50IHdoZXJlIGxpbmVhciBmb2dcbiAgICAgKiBiZWdpbnMuIFRoaXMgcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5mb2dfZW5kIC0gVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCB3aGVyZSBsaW5lYXIgZm9nXG4gICAgICogcmVhY2hlcyBpdHMgbWF4aW11bS4gVGhpcyBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfTElORUFSfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmdhbW1hX2NvcnJlY3Rpb24gLSBUaGUgZ2FtbWEgY29ycmVjdGlvbiB0byBhcHBseSB3aGVuXG4gICAgICogcmVuZGVyaW5nIHRoZSBzY2VuZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgR0FNTUFfTk9ORX1cbiAgICAgKiAtIHtAbGluayBHQU1NQV9TUkdCfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci50b25lbWFwcGluZyAtIFRoZSB0b25lbWFwcGluZyB0cmFuc2Zvcm0gdG8gYXBwbHkgd2hlblxuICAgICAqIHdyaXRpbmcgZnJhZ21lbnRzIHRvIHRoZSBmcmFtZSBidWZmZXIuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfRklMTUlDfVxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfSEVKTH1cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0FDRVN9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmV4cG9zdXJlIC0gVGhlIGV4cG9zdXJlIHZhbHVlIHR3ZWFrcyB0aGUgb3ZlcmFsbCBicmlnaHRuZXNzXG4gICAgICogb2YgdGhlIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfG51bGx9IFtzZXR0aW5ncy5yZW5kZXIuc2t5Ym94XSAtIFRoZSBhc3NldCBJRCBvZiB0aGUgY3ViZSBtYXAgdGV4dHVyZSB0byBiZVxuICAgICAqIHVzZWQgYXMgdGhlIHNjZW5lJ3Mgc2t5Ym94LiBEZWZhdWx0cyB0byBudWxsLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94SW50ZW5zaXR5IC0gTXVsdGlwbGllciBmb3Igc2t5Ym94IGludGVuc2l0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnNreWJveEx1bWluYW5jZSAtIEx1eCAobG0vbV4yKSB2YWx1ZSBmb3Igc2t5Ym94IGludGVuc2l0eSB3aGVuIHBoeXNpY2FsIGxpZ2h0IHVuaXRzIGFyZSBlbmFibGVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94TWlwIC0gVGhlIG1pcCBsZXZlbCBvZiB0aGUgc2t5Ym94IHRvIGJlIGRpc3BsYXllZC5cbiAgICAgKiBPbmx5IHZhbGlkIGZvciBwcmVmaWx0ZXJlZCBjdWJlbWFwIHNreWJveGVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnJlbmRlci5za3lib3hSb3RhdGlvbiAtIFJvdGF0aW9uIG9mIHNreWJveC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgLSBUaGUgbGlnaHRtYXAgcmVzb2x1dGlvbiBtdWx0aXBsaWVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRtYXBNYXhSZXNvbHV0aW9uIC0gVGhlIG1heGltdW0gbGlnaHRtYXAgcmVzb2x1dGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0bWFwTW9kZSAtIFRoZSBsaWdodG1hcCBiYWtpbmcgbW9kZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcFxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1JESVJ9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXAgKyBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24gKHVzZWQgZm9yIGJ1bXAvc3BlY3VsYXIpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZSAtIEVuYWJsZSBiYWtpbmcgYW1iaWVudCBsaWdodCBpbnRvIGxpZ2h0bWFwcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlTnVtU2FtcGxlcyAtIE51bWJlciBvZiBzYW1wbGVzIHRvIHVzZSB3aGVuIGJha2luZyBhbWJpZW50IGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VTcGhlcmVQYXJ0IC0gSG93IG11Y2ggb2YgdGhlIHNwaGVyZSB0byBpbmNsdWRlIHdoZW4gYmFraW5nIGFtYmllbnQgbGlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MgLSBCcmlnaG5lc3Mgb2YgdGhlIGJha2VkIGFtYmllbnQgb2NjbHVzaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdCAtIENvbnRyYXN0IG9mIHRoZSBiYWtlZCBhbWJpZW50IG9jY2x1c2lvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRMdW1pbmFuY2UgLSBMdXggKGxtL21eMikgdmFsdWUgZm9yIGFtYmllbnQgbGlnaHQgaW50ZW5zaXR5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIC0gRW5hYmxlIGNsdXN0ZXJlZCBsaWdodGluZy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5saWdodGluZ1NoYWRvd3NFbmFibGVkIC0gSWYgc2V0IHRvIHRydWUsIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgd2lsbCBzdXBwb3J0IHNoYWRvd3MuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdDb29raWVzRW5hYmxlZCAtIElmIHNldCB0byB0cnVlLCB0aGUgY2x1c3RlcmVkIGxpZ2h0aW5nIHdpbGwgc3VwcG9ydCBjb29raWUgdGV4dHVyZXMuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZCAtIElmIHNldCB0byB0cnVlLCB0aGUgY2x1c3RlcmVkIGxpZ2h0aW5nIHdpbGwgc3VwcG9ydCBhcmVhIGxpZ2h0cy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nU2hhZG93QXRsYXNSZXNvbHV0aW9uIC0gUmVzb2x1dGlvbiBvZiB0aGUgYXRsYXMgdGV4dHVyZSBzdG9yaW5nIGFsbCBub24tZGlyZWN0aW9uYWwgc2hhZG93IHRleHR1cmVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdDb29raWVBdGxhc1Jlc29sdXRpb24gLSBSZXNvbHV0aW9uIG9mIHRoZSBhdGxhcyB0ZXh0dXJlIHN0b3JpbmcgYWxsIG5vbi1kaXJlY3Rpb25hbCBjb29raWUgdGV4dHVyZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ01heExpZ2h0c1BlckNlbGwgLSBNYXhpbXVtIG51bWJlciBvZiBsaWdodHMgYSBjZWxsIGNhbiBzdG9yZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nU2hhZG93VHlwZSAtIFRoZSB0eXBlIG9mIHNoYWRvdyBmaWx0ZXJpbmcgdXNlZCBieSBhbGwgc2hhZG93cy4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU0hBRE9XX1BDRjF9OiBQQ0YgMXgxIHNhbXBsaW5nLlxuICAgICAqIC0ge0BsaW5rIFNIQURPV19QQ0YzfTogUENGIDN4MyBzYW1wbGluZy5cbiAgICAgKiAtIHtAbGluayBTSEFET1dfUENGNX06IFBDRiA1eDUgc2FtcGxpbmcuIEZhbGxzIGJhY2sgdG8ge0BsaW5rIFNIQURPV19QQ0YzfSBvbiBXZWJHTCAxLjAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0NlbGxzIC0gTnVtYmVyIG9mIGNlbGxzIGFsb25nIGVhY2ggd29ybGQtc3BhY2UgYXhpcyB0aGUgc3BhY2UgY29udGFpbmluZyBsaWdodHNcbiAgICAgKiBpcyBzdWJkaXZpZGVkIGludG8uXG4gICAgICpcbiAgICAgKiBPbmx5IGxpZ2h0cyB3aXRoIGJha2VEaXI9dHJ1ZSB3aWxsIGJlIHVzZWQgZm9yIGdlbmVyYXRpbmcgdGhlIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqXG4gICAgICogdmFyIHNldHRpbmdzID0ge1xuICAgICAqICAgICBwaHlzaWNzOiB7XG4gICAgICogICAgICAgICBncmF2aXR5OiBbMCwgLTkuOCwgMF1cbiAgICAgKiAgICAgfSxcbiAgICAgKiAgICAgcmVuZGVyOiB7XG4gICAgICogICAgICAgICBmb2dfZW5kOiAxMDAwLFxuICAgICAqICAgICAgICAgdG9uZW1hcHBpbmc6IDAsXG4gICAgICogICAgICAgICBza3lib3g6IG51bGwsXG4gICAgICogICAgICAgICBmb2dfZGVuc2l0eTogMC4wMSxcbiAgICAgKiAgICAgICAgIGdhbW1hX2NvcnJlY3Rpb246IDEsXG4gICAgICogICAgICAgICBleHBvc3VyZTogMSxcbiAgICAgKiAgICAgICAgIGZvZ19zdGFydDogMSxcbiAgICAgKiAgICAgICAgIGdsb2JhbF9hbWJpZW50OiBbMCwgMCwgMF0sXG4gICAgICogICAgICAgICBza3lib3hJbnRlbnNpdHk6IDEsXG4gICAgICogICAgICAgICBza3lib3hSb3RhdGlvbjogWzAsIDAsIDBdLFxuICAgICAqICAgICAgICAgZm9nX2NvbG9yOiBbMCwgMCwgMF0sXG4gICAgICogICAgICAgICBsaWdodG1hcE1vZGU6IDEsXG4gICAgICogICAgICAgICBmb2c6ICdub25lJyxcbiAgICAgKiAgICAgICAgIGxpZ2h0bWFwTWF4UmVzb2x1dGlvbjogMjA0OCxcbiAgICAgKiAgICAgICAgIHNreWJveE1pcDogMixcbiAgICAgKiAgICAgICAgIGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXI6IDE2XG4gICAgICogICAgIH1cbiAgICAgKiB9O1xuICAgICAqIGFwcC5hcHBseVNjZW5lU2V0dGluZ3Moc2V0dGluZ3MpO1xuICAgICAqL1xuICAgIGFwcGx5U2NlbmVTZXR0aW5ncyhzZXR0aW5ncykge1xuICAgICAgICBsZXQgYXNzZXQ7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtcy5yaWdpZGJvZHkgJiYgdHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBncmF2aXR5ID0gc2V0dGluZ3MucGh5c2ljcy5ncmF2aXR5O1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLnJpZ2lkYm9keS5ncmF2aXR5LnNldChncmF2aXR5WzBdLCBncmF2aXR5WzFdLCBncmF2aXR5WzJdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2NlbmUuYXBwbHlTZXR0aW5ncyhzZXR0aW5ncyk7XG5cbiAgICAgICAgaWYgKHNldHRpbmdzLnJlbmRlci5oYXNPd25Qcm9wZXJ0eSgnc2t5Ym94JykpIHtcbiAgICAgICAgICAgIGlmIChzZXR0aW5ncy5yZW5kZXIuc2t5Ym94KSB7XG4gICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLmFzc2V0cy5nZXQoc2V0dGluZ3MucmVuZGVyLnNreWJveCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRTa3lib3goYXNzZXQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9uY2UoJ2FkZDonICsgc2V0dGluZ3MucmVuZGVyLnNreWJveCwgdGhpcy5zZXRTa3lib3gsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTa3lib3gobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBhcmVhIGxpZ2h0IExVVCB0YWJsZXMgZm9yIHRoaXMgYXBwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbHRjTWF0MSAtIExVVCB0YWJsZSBvZiB0eXBlIGBhcnJheWAgdG8gYmUgc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGx0Y01hdDIgLSBMVVQgdGFibGUgb2YgdHlwZSBgYXJyYXlgIHRvIGJlIHNldC5cbiAgICAgKi9cbiAgICBzZXRBcmVhTGlnaHRMdXRzKGx0Y01hdDEsIGx0Y01hdDIpIHtcblxuICAgICAgICBpZiAobHRjTWF0MSAmJiBsdGNNYXQyKSB7XG4gICAgICAgICAgICBBcmVhTGlnaHRMdXRzLnNldCh0aGlzLmdyYXBoaWNzRGV2aWNlLCBsdGNNYXQxLCBsdGNNYXQyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oXCJzZXRBcmVhTGlnaHRMdXRzOiBMVVRzIGZvciBhcmVhIGxpZ2h0IGFyZSBub3QgdmFsaWRcIik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBza3lib3ggYXNzZXQgdG8gY3VycmVudCBzY2VuZSwgYW5kIHN1YnNjcmliZXMgdG8gYXNzZXQgbG9hZC9jaGFuZ2UgZXZlbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBBc3NldCBvZiB0eXBlIGBza3lib3hgIHRvIGJlIHNldCB0bywgb3IgbnVsbCB0byByZW1vdmUgc2t5Ym94LlxuICAgICAqL1xuICAgIHNldFNreWJveChhc3NldCkge1xuICAgICAgICBpZiAoYXNzZXQgIT09IHRoaXMuX3NreWJveEFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBvblNreWJveFJlbW92ZWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTa3lib3gobnVsbCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCBvblNreWJveENoYW5nZWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5zY2VuZS5zZXRTa3lib3godGhpcy5fc2t5Ym94QXNzZXQgPyB0aGlzLl9za3lib3hBc3NldC5yZXNvdXJjZXMgOiBudWxsKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGNsZWFudXAgcHJldmlvdXMgYXNzZXRcbiAgICAgICAgICAgIGlmICh0aGlzLl9za3lib3hBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9mZignbG9hZDonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub2ZmKCdyZW1vdmU6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0Lm9mZignY2hhbmdlJywgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IG5ldyBhc3NldFxuICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQgPSBhc3NldDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9za3lib3hBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9uKCdsb2FkOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vbmNlKCdyZW1vdmU6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0Lm9uKCdjaGFuZ2UnLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NlbmUuc2t5Ym94TWlwID09PSAwICYmICF0aGlzLl9za3lib3hBc3NldC5sb2FkRmFjZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQubG9hZEZhY2VzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5sb2FkKHRoaXMuX3NreWJveEFzc2V0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb25Ta3lib3hDaGFuZ2VkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZmlyc3RCYWtlKCkge1xuICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyPy5iYWtlKG51bGwsIHRoaXMuc2NlbmUubGlnaHRtYXBNb2RlKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZmlyc3RCYXRjaCgpIHtcbiAgICAgICAgdGhpcy5iYXRjaGVyPy5nZW5lcmF0ZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGUgYW4gb3Bwb3J0dW5pdHkgdG8gbW9kaWZ5IHRoZSB0aW1lc3RhbXAgc3VwcGxpZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt0aW1lc3RhbXBdIC0gVGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gICAgICogQHJldHVybnMge251bWJlcnx1bmRlZmluZWR9IFRoZSBtb2RpZmllZCB0aW1lc3RhbXAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9wcm9jZXNzVGltZXN0YW1wKHRpbWVzdGFtcCkge1xuICAgICAgICByZXR1cm4gdGltZXN0YW1wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgc2luZ2xlIGxpbmUuIExpbmUgc3RhcnQgYW5kIGVuZCBjb29yZGluYXRlcyBhcmUgc3BlY2lmaWVkIGluIHdvcmxkLXNwYWNlLiBUaGUgbGluZVxuICAgICAqIHdpbGwgYmUgZmxhdC1zaGFkZWQgd2l0aCB0aGUgc3BlY2lmaWVkIGNvbG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzdGFydCAtIFRoZSBzdGFydCB3b3JsZC1zcGFjZSBjb29yZGluYXRlIG9mIHRoZSBsaW5lLlxuICAgICAqIEBwYXJhbSB7VmVjM30gZW5kIC0gVGhlIGVuZCB3b3JsZC1zcGFjZSBjb29yZGluYXRlIG9mIHRoZSBsaW5lLlxuICAgICAqIEBwYXJhbSB7Q29sb3J9IFtjb2xvcl0gLSBUaGUgY29sb3Igb2YgdGhlIGxpbmUuIEl0IGRlZmF1bHRzIHRvIHdoaXRlIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgbGluZSBpcyBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGUgZGVwdGhcbiAgICAgKiBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIGxpbmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIDEtdW5pdCBsb25nIHdoaXRlIGxpbmVcbiAgICAgKiB2YXIgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiB2YXIgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogYXBwLmRyYXdMaW5lKHN0YXJ0LCBlbmQpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgMS11bml0IGxvbmcgcmVkIGxpbmUgd2hpY2ggaXMgbm90IGRlcHRoIHRlc3RlZCBhbmQgcmVuZGVycyBvbiB0b3Agb2Ygb3RoZXIgZ2VvbWV0cnlcbiAgICAgKiB2YXIgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiB2YXIgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogYXBwLmRyYXdMaW5lKHN0YXJ0LCBlbmQsIHBjLkNvbG9yLlJFRCwgZmFsc2UpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgMS11bml0IGxvbmcgd2hpdGUgbGluZSBpbnRvIHRoZSB3b3JsZCBsYXllclxuICAgICAqIHZhciBzdGFydCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIHZhciBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiB2YXIgd29ybGRMYXllciA9IGFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHBjLkxBWUVSSURfV09STEQpO1xuICAgICAqIGFwcC5kcmF3TGluZShzdGFydCwgZW5kLCBwYy5Db2xvci5XSElURSwgdHJ1ZSwgd29ybGRMYXllcik7XG4gICAgICovXG4gICAgZHJhd0xpbmUoc3RhcnQsIGVuZCwgY29sb3IsIGRlcHRoVGVzdCwgbGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5kcmF3TGluZShzdGFydCwgZW5kLCBjb2xvciwgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVycyBhbiBhcmJpdHJhcnkgbnVtYmVyIG9mIGRpc2NyZXRlIGxpbmUgc2VnbWVudHMuIFRoZSBsaW5lcyBhcmUgbm90IGNvbm5lY3RlZCBieSBlYWNoXG4gICAgICogc3Vic2VxdWVudCBwb2ludCBpbiB0aGUgYXJyYXkuIEluc3RlYWQsIHRoZXkgYXJlIGluZGl2aWR1YWwgc2VnbWVudHMgc3BlY2lmaWVkIGJ5IHR3b1xuICAgICAqIHBvaW50cy4gVGhlcmVmb3JlLCB0aGUgbGVuZ3RocyBvZiB0aGUgc3VwcGxpZWQgcG9zaXRpb24gYW5kIGNvbG9yIGFycmF5cyBtdXN0IGJlIHRoZSBzYW1lXG4gICAgICogYW5kIGFsc28gbXVzdCBiZSBhIG11bHRpcGxlIG9mIDIuIFRoZSBjb2xvcnMgb2YgdGhlIGVuZHMgb2YgZWFjaCBsaW5lIHNlZ21lbnQgd2lsbCBiZVxuICAgICAqIGludGVycG9sYXRlZCBhbG9uZyB0aGUgbGVuZ3RoIG9mIGVhY2ggbGluZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM1tdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiBwb2ludHMgdG8gZHJhdyBsaW5lcyBiZXR3ZWVuLiBUaGUgbGVuZ3RoIG9mIHRoZVxuICAgICAqIGFycmF5IG11c3QgYmUgYSBtdWx0aXBsZSBvZiAyLlxuICAgICAqIEBwYXJhbSB7Q29sb3JbXX0gY29sb3JzIC0gQW4gYXJyYXkgb2YgY29sb3JzIHRvIGNvbG9yIHRoZSBsaW5lcy4gVGhpcyBtdXN0IGJlIHRoZSBzYW1lXG4gICAgICogbGVuZ3RoIGFzIHRoZSBwb3NpdGlvbiBhcnJheS4gVGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgbXVzdCBhbHNvIGJlIGEgbXVsdGlwbGUgb2YgMi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBsaW5lcyBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgc2luZ2xlIGxpbmUsIHdpdGggdW5pcXVlIGNvbG9ycyBmb3IgZWFjaCBwb2ludFxuICAgICAqIHZhciBzdGFydCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIHZhciBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd0xpbmVzKFtzdGFydCwgZW5kXSwgW3BjLkNvbG9yLlJFRCwgcGMuQ29sb3IuV0hJVEVdKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciAyIGRpc2NyZXRlIGxpbmUgc2VnbWVudHNcbiAgICAgKiB2YXIgcG9pbnRzID0gW1xuICAgICAqICAgICAvLyBMaW5lIDFcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMCwgMCwgMCksXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDEsIDAsIDApLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMSwgMSwgMCksXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDEsIDEsIDEpXG4gICAgICogXTtcbiAgICAgKiB2YXIgY29sb3JzID0gW1xuICAgICAqICAgICAvLyBMaW5lIDFcbiAgICAgKiAgICAgcGMuQ29sb3IuUkVELFxuICAgICAqICAgICBwYy5Db2xvci5ZRUxMT1csXG4gICAgICogICAgIC8vIExpbmUgMlxuICAgICAqICAgICBwYy5Db2xvci5DWUFOLFxuICAgICAqICAgICBwYy5Db2xvci5CTFVFXG4gICAgICogXTtcbiAgICAgKiBhcHAuZHJhd0xpbmVzKHBvaW50cywgY29sb3JzKTtcbiAgICAgKi9cbiAgICBkcmF3TGluZXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuZHJhd0xpbmVzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIGFyYml0cmFyeSBudW1iZXIgb2YgZGlzY3JldGUgbGluZSBzZWdtZW50cy4gVGhlIGxpbmVzIGFyZSBub3QgY29ubmVjdGVkIGJ5IGVhY2hcbiAgICAgKiBzdWJzZXF1ZW50IHBvaW50IGluIHRoZSBhcnJheS4gSW5zdGVhZCwgdGhleSBhcmUgaW5kaXZpZHVhbCBzZWdtZW50cyBzcGVjaWZpZWQgYnkgdHdvXG4gICAgICogcG9pbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gcG9zaXRpb25zIC0gQW4gYXJyYXkgb2YgcG9pbnRzIHRvIGRyYXcgbGluZXMgYmV0d2Vlbi4gRWFjaCBwb2ludCBpc1xuICAgICAqIHJlcHJlc2VudGVkIGJ5IDMgbnVtYmVycyAtIHgsIHkgYW5kIHogY29vcmRpbmF0ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBjb2xvcnMgLSBBbiBhcnJheSBvZiBjb2xvcnMgdG8gY29sb3IgdGhlIGxpbmVzLiBUaGlzIG11c3QgYmUgdGhlIHNhbWVcbiAgICAgKiBsZW5ndGggYXMgdGhlIHBvc2l0aW9uIGFycmF5LiBUaGUgbGVuZ3RoIG9mIHRoZSBhcnJheSBtdXN0IGFsc28gYmUgYSBtdWx0aXBsZSBvZiAyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGUgZGVwdGhcbiAgICAgKiBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIGxpbmVzIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgMiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzXG4gICAgICogdmFyIHBvaW50cyA9IFtcbiAgICAgKiAgICAgLy8gTGluZSAxXG4gICAgICogICAgIDAsIDAsIDAsXG4gICAgICogICAgIDEsIDAsIDAsXG4gICAgICogICAgIC8vIExpbmUgMlxuICAgICAqICAgICAxLCAxLCAwLFxuICAgICAqICAgICAxLCAxLCAxXG4gICAgICogXTtcbiAgICAgKiB2YXIgY29sb3JzID0gW1xuICAgICAqICAgICAvLyBMaW5lIDFcbiAgICAgKiAgICAgMSwgMCwgMCwgMSwgIC8vIHJlZFxuICAgICAqICAgICAwLCAxLCAwLCAxLCAgLy8gZ3JlZW5cbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIDAsIDAsIDEsIDEsICAvLyBibHVlXG4gICAgICogICAgIDEsIDEsIDEsIDEgICAvLyB3aGl0ZVxuICAgICAqIF07XG4gICAgICogYXBwLmRyYXdMaW5lQXJyYXlzKHBvaW50cywgY29sb3JzKTtcbiAgICAgKi9cbiAgICBkcmF3TGluZUFycmF5cyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5kcmF3TGluZUFycmF5cyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSB3aXJlZnJhbWUgc3BoZXJlIHdpdGggY2VudGVyLCByYWRpdXMgYW5kIGNvbG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBjZW50ZXIgLSBUaGUgY2VudGVyIG9mIHRoZSBzcGhlcmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJhZGl1cyAtIFRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZS5cbiAgICAgKiBAcGFyYW0ge0NvbG9yfSBbY29sb3JdIC0gVGhlIGNvbG9yIG9mIHRoZSBzcGhlcmUuIEl0IGRlZmF1bHRzIHRvIHdoaXRlIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtzZWdtZW50c10gLSBOdW1iZXIgb2YgbGluZSBzZWdtZW50cyB1c2VkIHRvIHJlbmRlciB0aGUgY2lyY2xlcyBmb3JtaW5nIHRoZVxuICAgICAqIHNwaGVyZS4gRGVmYXVsdHMgdG8gMjAuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgc3BoZXJlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGVcbiAgICAgKiBkZXB0aCBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHNwaGVyZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgcmVkIHdpcmUgc3BoZXJlIHdpdGggcmFkaXVzIG9mIDFcbiAgICAgKiB2YXIgY2VudGVyID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogYXBwLmRyYXdXaXJlU3BoZXJlKGNlbnRlciwgMS4wLCBwYy5Db2xvci5SRUQpO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3V2lyZVNwaGVyZShjZW50ZXIsIHJhZGl1cywgY29sb3IgPSBDb2xvci5XSElURSwgc2VnbWVudHMgPSAyMCwgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd1dpcmVTcGhlcmUoY2VudGVyLCByYWRpdXMsIGNvbG9yLCBzZWdtZW50cywgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSB3aXJlZnJhbWUgYXhpcyBhbGlnbmVkIGJveCBzcGVjaWZpZWQgYnkgbWluIGFuZCBtYXggcG9pbnRzIGFuZCBjb2xvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gbWluUG9pbnQgLSBUaGUgbWluIGNvcm5lciBwb2ludCBvZiB0aGUgYm94LlxuICAgICAqIEBwYXJhbSB7VmVjM30gbWF4UG9pbnQgLSBUaGUgbWF4IGNvcm5lciBwb2ludCBvZiB0aGUgYm94LlxuICAgICAqIEBwYXJhbSB7Q29sb3J9IFtjb2xvcl0gLSBUaGUgY29sb3Igb2YgdGhlIHNwaGVyZS4gSXQgZGVmYXVsdHMgdG8gd2hpdGUgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBzcGhlcmUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZVxuICAgICAqIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgc3BoZXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSByZWQgd2lyZSBhbGlnbmVkIGJveFxuICAgICAqIHZhciBtaW4gPSBuZXcgcGMuVmVjMygtMSwgLTEsIC0xKTtcbiAgICAgKiB2YXIgbWF4ID0gbmV3IHBjLlZlYzMoMSwgMSwgMSk7XG4gICAgICogYXBwLmRyYXdXaXJlQWxpZ25lZEJveChtaW4sIG1heCwgcGMuQ29sb3IuUkVEKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1dpcmVBbGlnbmVkQm94KG1pblBvaW50LCBtYXhQb2ludCwgY29sb3IgPSBDb2xvci5XSElURSwgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd1dpcmVBbGlnbmVkQm94KG1pblBvaW50LCBtYXhQb2ludCwgY29sb3IsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXcgbWVzaEluc3RhbmNlIGF0IHRoaXMgZnJhbWVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlfSBtZXNoSW5zdGFuY2UgLSBUaGUgbWVzaCBpbnN0YW5jZVxuICAgICAqIHRvIGRyYXcuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIG1lc2ggaW5zdGFuY2UgaW50by4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3TWVzaEluc3RhbmNlKG1lc2hJbnN0YW5jZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobnVsbCwgbnVsbCwgbnVsbCwgbWVzaEluc3RhbmNlLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBtZXNoIGF0IHRoaXMgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2NlbmUvbWVzaC5qcycpLk1lc2h9IG1lc2ggLSBUaGUgbWVzaCB0byBkcmF3LlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSB0byByZW5kZXIgdGhlIG1lc2guXG4gICAgICogQHBhcmFtIHtNYXQ0fSBtYXRyaXggLSBUaGUgbWF0cml4IHRvIHVzZSB0byByZW5kZXIgdGhlIG1lc2guXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIG1lc2ggaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd01lc2gobWVzaCwgbWF0ZXJpYWwsIG1hdHJpeCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgbWVzaCwgbnVsbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXcgcXVhZCBvZiBzaXplIFstMC41LCAwLjVdIGF0IHRoaXMgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IG1hdHJpeCAtIFRoZSBtYXRyaXggdG8gdXNlIHRvIHJlbmRlciB0aGUgcXVhZC5cbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB0byB1c2UgdG8gcmVuZGVyIHRoZSBxdWFkLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBxdWFkIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdRdWFkKG1hdHJpeCwgbWF0ZXJpYWwsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdNZXNoKG1hdGVyaWFsLCBtYXRyaXgsIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmdldFF1YWRNZXNoKCksIG51bGwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHRleHR1cmUgYXQgW3gsIHldIHBvc2l0aW9uIG9uIHNjcmVlbiwgd2l0aCBzaXplIFt3aWR0aCwgaGVpZ2h0XS4gVGhlIG9yaWdpbiBvZiB0aGVcbiAgICAgKiBzY3JlZW4gaXMgdG9wLWxlZnQgWzAsIDBdLiBDb29yZGluYXRlcyBhbmQgc2l6ZXMgYXJlIGluIHByb2plY3RlZCBzcGFjZSAoLTEgLi4gMSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgd2lkdGggb2YgdGhlIHJlY3RhbmdsZSBvZiB0aGUgcmVuZGVyZWQgdGV4dHVyZS4gU2hvdWxkIGJlIGluIHRoZVxuICAgICAqIHJhbmdlIFswLCAyXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW5cbiAgICAgKiB0aGUgcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHJlbmRlci5cbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB1c2VkIHdoZW4gcmVuZGVyaW5nIHRoZSB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSB0ZXh0dXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZmlsdGVyYWJsZV0gLSBJbmRpY2F0ZSBpZiB0aGUgdGV4dHVyZSBjYW4gYmUgc2FtcGxlZCB1c2luZyBmaWx0ZXJpbmcuXG4gICAgICogUGFzc2luZyBmYWxzZSB1c2VzIHVuZmlsdGVyZWQgc2FtcGxpbmcsIGFsbG93aW5nIGEgZGVwdGggdGV4dHVyZSB0byBiZSBzYW1wbGVkIG9uIFdlYkdQVS5cbiAgICAgKiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3VGV4dHVyZSh4LCB5LCB3aWR0aCwgaGVpZ2h0LCB0ZXh0dXJlLCBtYXRlcmlhbCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIsIGZpbHRlcmFibGUgPSB0cnVlKSB7XG5cbiAgICAgICAgLy8gb25seSBXZWJHUFUgc3VwcG9ydHMgZmlsdGVyYWJsZSBwYXJhbWV0ZXIgdG8gYmUgZmFsc2UsIGFsbG93aW5nIGEgZGVwdGggdGV4dHVyZSAvIHNoYWRvd1xuICAgICAgICAvLyBtYXAgdG8gYmUgZmV0Y2hlZCAod2l0aG91dCBmaWx0ZXJpbmcpIGFuZCByZW5kZXJlZFxuICAgICAgICBpZiAoZmlsdGVyYWJsZSA9PT0gZmFsc2UgJiYgIXRoaXMuZ3JhcGhpY3NEZXZpY2UuaXNXZWJHUFUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gVE9ETzogaWYgdGhpcyBpcyB1c2VkIGZvciBhbnl0aGluZyBvdGhlciB0aGFuIGRlYnVnIHRleHR1cmUgZGlzcGxheSwgd2Ugc2hvdWxkIG9wdGltaXplIHRoaXMgdG8gYXZvaWQgYWxsb2NhdGlvbnNcbiAgICAgICAgY29uc3QgbWF0cml4ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgbWF0cml4LnNldFRSUyhuZXcgVmVjMyh4LCB5LCAwLjApLCBRdWF0LklERU5USVRZLCBuZXcgVmVjMyh3aWR0aCwgaGVpZ2h0LCAwLjApKTtcblxuICAgICAgICBpZiAoIW1hdGVyaWFsKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKFwiY29sb3JNYXBcIiwgdGV4dHVyZSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zaGFkZXIgPSBmaWx0ZXJhYmxlID8gdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0VGV4dHVyZVNoYWRlcigpIDogdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0VW5maWx0ZXJhYmxlVGV4dHVyZVNoYWRlcigpO1xuICAgICAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRyYXdRdWFkKG1hdHJpeCwgbWF0ZXJpYWwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIGRlcHRoIHRleHR1cmUgYXQgW3gsIHldIHBvc2l0aW9uIG9uIHNjcmVlbiwgd2l0aCBzaXplIFt3aWR0aCwgaGVpZ2h0XS4gVGhlIG9yaWdpbiBvZlxuICAgICAqIHRoZSBzY3JlZW4gaXMgdG9wLWxlZnQgWzAsIDBdLiBDb29yZGluYXRlcyBhbmQgc2l6ZXMgYXJlIGluIHByb2plY3RlZCBzcGFjZSAoLTEgLi4gMSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgd2lkdGggb2YgdGhlIHJlY3RhbmdsZSBvZiB0aGUgcmVuZGVyZWQgdGV4dHVyZS4gU2hvdWxkIGJlIGluIHRoZVxuICAgICAqIHJhbmdlIFswLCAyXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW5cbiAgICAgKiB0aGUgcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSB0ZXh0dXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdEZXB0aFRleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgTWF0ZXJpYWwoKTtcbiAgICAgICAgbWF0ZXJpYWwuc2hhZGVyID0gdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0RGVwdGhUZXh0dXJlU2hhZGVyKCk7XG4gICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgIHRoaXMuZHJhd1RleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgbnVsbCwgbWF0ZXJpYWwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyBhcHBsaWNhdGlvbiBhbmQgcmVtb3ZlcyBhbGwgZXZlbnQgbGlzdGVuZXJzIGF0IHRoZSBlbmQgb2YgdGhlIGN1cnJlbnQgZW5naW5lIGZyYW1lXG4gICAgICogdXBkYXRlLiBIb3dldmVyLCBpZiBjYWxsZWQgb3V0c2lkZSBvZiB0aGUgZW5naW5lIGZyYW1lIHVwZGF0ZSwgY2FsbGluZyBkZXN0cm95KCkgd2lsbFxuICAgICAqIGRlc3Ryb3kgdGhlIGFwcGxpY2F0aW9uIGltbWVkaWF0ZWx5LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuZGVzdHJveSgpO1xuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbkZyYW1lVXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95UmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNhbnZhc0lkID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuaWQ7XG5cbiAgICAgICAgdGhpcy5vZmYoJ2xpYnJhcmllc2xvYWRlZCcpO1xuXG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21venZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbXN2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmtpdHZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnJvb3QuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJvb3QgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLm1vdXNlKSB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLm9mZigpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZS5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMubW91c2UgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMua2V5Ym9hcmQpIHtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQub2ZmKCk7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkLmRldGFjaCgpO1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50b3VjaCkge1xuICAgICAgICAgICAgdGhpcy50b3VjaC5vZmYoKTtcbiAgICAgICAgICAgIHRoaXMudG91Y2guZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLnRvdWNoID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRJbnB1dCkge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5nYW1lcGFkcykge1xuICAgICAgICAgICAgdGhpcy5nYW1lcGFkcy5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmdhbWVwYWRzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuZGVzdHJveSgpO1xuXG4gICAgICAgIC8vIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMuZGVzdHJveSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbGwgdGV4dHVyZSByZXNvdXJjZXNcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5hc3NldHMubGlzdCgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXNzZXRzW2ldLnVubG9hZCgpO1xuICAgICAgICAgICAgYXNzZXRzW2ldLm9mZigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYXNzZXRzLm9mZigpO1xuXG5cbiAgICAgICAgLy8gZGVzdHJveSBidW5kbGUgcmVnaXN0cnlcbiAgICAgICAgdGhpcy5idW5kbGVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5idW5kbGVzID0gbnVsbDtcblxuICAgICAgICB0aGlzLmkxOG4uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmkxOG4gPSBudWxsO1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZVtrZXldO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgaWYgKHBhcmVudCkgcGFyZW50LnJlbW92ZUNoaWxkKGVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSA9IHt9O1xuXG4gICAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcblxuICAgICAgICB0aGlzLnN5c3RlbXMgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xuXG4gICAgICAgIC8vIHNjcmlwdCByZWdpc3RyeVxuICAgICAgICB0aGlzLnNjcmlwdHMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zY2VuZXMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbnRpdHlJbmRleCA9IHt9O1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25QcmVSZW5kZXJPcGFxdWUgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoLm9uUG9zdFJlbmRlck9wYXF1ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25EaXNhYmxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vbkVuYWJsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGggPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllcldvcmxkID0gbnVsbDtcblxuICAgICAgICB0aGlzPy54ci5lbmQoKTtcbiAgICAgICAgdGhpcz8ueHIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMucmVuZGVyZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy50aWNrID0gbnVsbDtcblxuICAgICAgICB0aGlzLm9mZigpOyAvLyByZW1vdmUgYWxsIGV2ZW50c1xuXG4gICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgc2NyaXB0LmFwcCA9IG51bGw7XG5cbiAgICAgICAgQXBwQmFzZS5fYXBwbGljYXRpb25zW2NhbnZhc0lkXSA9IG51bGw7XG5cbiAgICAgICAgaWYgKGdldEFwcGxpY2F0aW9uKCkgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHNldEFwcGxpY2F0aW9uKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGVudGl0eSBmcm9tIHRoZSBpbmRleCBieSBndWlkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWQgLSBUaGUgR1VJRCB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtFbnRpdHl9IFRoZSBFbnRpdHkgd2l0aCB0aGUgR1VJRCBvciBudWxsLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRFbnRpdHlGcm9tSW5kZXgoZ3VpZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW50aXR5SW5kZXhbZ3VpZF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZShzY2VuZSkge1xuICAgICAgICB0aGlzLm9uKCdwb3N0cmVuZGVyJywgc2NlbmUuaW1tZWRpYXRlLm9uUG9zdFJlbmRlciwgc2NlbmUuaW1tZWRpYXRlKTtcbiAgICB9XG59XG5cbi8vIHN0YXRpYyBkYXRhXG5jb25zdCBfZnJhbWVFbmREYXRhID0ge307XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNzdGFydH0gYW5kIGl0c2VsZiB0byByZXF1ZXN0XG4gKiB0aGUgcmVuZGVyaW5nIG9mIGEgbmV3IGFuaW1hdGlvbiBmcmFtZS5cbiAqXG4gKiBAY2FsbGJhY2sgTWFrZVRpY2tDYWxsYmFja1xuICogQHBhcmFtIHtudW1iZXJ9IFt0aW1lc3RhbXBdIC0gVGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICogQGlnbm9yZVxuICovXG5cbi8qKlxuICogQ3JlYXRlIHRpY2sgZnVuY3Rpb24gdG8gYmUgd3JhcHBlZCBpbiBjbG9zdXJlLlxuICpcbiAqIEBwYXJhbSB7QXBwQmFzZX0gX2FwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAqIEByZXR1cm5zIHtNYWtlVGlja0NhbGxiYWNrfSBUaGUgdGljayBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmNvbnN0IG1ha2VUaWNrID0gZnVuY3Rpb24gKF9hcHApIHtcbiAgICBjb25zdCBhcHBsaWNhdGlvbiA9IF9hcHA7XG4gICAgbGV0IGZyYW1lUmVxdWVzdDtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3RpbWVzdGFtcF0gLSBUaGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqL1xuICAgIHJldHVybiBmdW5jdGlvbiAodGltZXN0YW1wLCBmcmFtZSkge1xuICAgICAgICBpZiAoIWFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHNldEFwcGxpY2F0aW9uKGFwcGxpY2F0aW9uKTtcblxuICAgICAgICBpZiAoZnJhbWVSZXF1ZXN0KSB7XG4gICAgICAgICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoZnJhbWVSZXF1ZXN0KTtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoYXZlIGN1cnJlbnQgYXBwbGljYXRpb24gcG9pbnRlciBpbiBwY1xuICAgICAgICBhcHAgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICBjb25zdCBjdXJyZW50VGltZSA9IGFwcGxpY2F0aW9uLl9wcm9jZXNzVGltZXN0YW1wKHRpbWVzdGFtcCkgfHwgbm93KCk7XG4gICAgICAgIGNvbnN0IG1zID0gY3VycmVudFRpbWUgLSAoYXBwbGljYXRpb24uX3RpbWUgfHwgY3VycmVudFRpbWUpO1xuICAgICAgICBsZXQgZHQgPSBtcyAvIDEwMDAuMDtcbiAgICAgICAgZHQgPSBtYXRoLmNsYW1wKGR0LCAwLCBhcHBsaWNhdGlvbi5tYXhEZWx0YVRpbWUpO1xuICAgICAgICBkdCAqPSBhcHBsaWNhdGlvbi50aW1lU2NhbGU7XG5cbiAgICAgICAgYXBwbGljYXRpb24uX3RpbWUgPSBjdXJyZW50VGltZTtcblxuICAgICAgICAvLyBTdWJtaXQgYSByZXF1ZXN0IHRvIHF1ZXVlIHVwIGEgbmV3IGFuaW1hdGlvbiBmcmFtZSBpbW1lZGlhdGVseVxuICAgICAgICBpZiAoYXBwbGljYXRpb24ueHI/LnNlc3Npb24pIHtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IGFwcGxpY2F0aW9uLnhyLnNlc3Npb24ucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFwcGxpY2F0aW9uLnRpY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJhbWVSZXF1ZXN0ID0gcGxhdGZvcm0uYnJvd3NlciA/IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYXBwbGljYXRpb24udGljaykgOiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmNvbnRleHRMb3N0KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9maWxsRnJhbWVTdGF0c0Jhc2ljKGN1cnJlbnRUaW1lLCBkdCwgbXMpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgYXBwbGljYXRpb24uX2ZpbGxGcmFtZVN0YXRzKCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9pbkZyYW1lVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1ldXBkYXRlXCIsIG1zKTtcblxuICAgICAgICBsZXQgc2hvdWxkUmVuZGVyRnJhbWUgPSB0cnVlO1xuXG4gICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgc2hvdWxkUmVuZGVyRnJhbWUgPSBhcHBsaWNhdGlvbi54cj8udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyLmZyYW1lYnVmZmVyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbGljYXRpb24uZ3JhcGhpY3NEZXZpY2UuZGVmYXVsdEZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaG91bGRSZW5kZXJGcmFtZSkge1xuXG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9GUkFNRSwgYC0tLS0gRnJhbWUgJHthcHBsaWNhdGlvbi5mcmFtZX1gKTtcbiAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUsIGAtLSBVcGRhdGVTdGFydCAke25vdygpLnRvRml4ZWQoMil9bXNgKTtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24udXBkYXRlKGR0KTtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lcmVuZGVyXCIpO1xuXG5cbiAgICAgICAgICAgIGlmIChhcHBsaWNhdGlvbi5hdXRvUmVuZGVyIHx8IGFwcGxpY2F0aW9uLnJlbmRlck5leHRGcmFtZSkge1xuXG4gICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfRlJBTUVfVElNRSwgYC0tIFJlbmRlclN0YXJ0ICR7bm93KCkudG9GaXhlZCgyKX1tc2ApO1xuXG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24udXBkYXRlQ2FudmFzU2l6ZSgpO1xuICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uLmZyYW1lU3RhcnQoKTtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi5yZW5kZXIoKTtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi5yZW5kZXJOZXh0RnJhbWUgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUsIGAtLSBSZW5kZXJFbmQgJHtub3coKS50b0ZpeGVkKDIpfW1zYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBldmVudCBkYXRhXG4gICAgICAgICAgICBfZnJhbWVFbmREYXRhLnRpbWVzdGFtcCA9IG5vdygpO1xuICAgICAgICAgICAgX2ZyYW1lRW5kRGF0YS50YXJnZXQgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lZW5kXCIsIF9mcmFtZUVuZERhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXBwbGljYXRpb24uX2luRnJhbWVVcGRhdGUgPSBmYWxzZTtcblxuICAgICAgICBpZiAoYXBwbGljYXRpb24uX2Rlc3Ryb3lSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG5leHBvcnQgeyBhcHAsIEFwcEJhc2UgfTtcbiJdLCJuYW1lcyI6WyJQcm9ncmVzcyIsImNvbnN0cnVjdG9yIiwibGVuZ3RoIiwiY291bnQiLCJpbmMiLCJkb25lIiwiYXBwIiwiQXBwQmFzZSIsIkV2ZW50SGFuZGxlciIsImNhbnZhcyIsInZlcnNpb24iLCJpbmRleE9mIiwiRGVidWciLCJsb2ciLCJyZXZpc2lvbiIsIl9hcHBsaWNhdGlvbnMiLCJpZCIsInNldEFwcGxpY2F0aW9uIiwiX2Rlc3Ryb3lSZXF1ZXN0ZWQiLCJfaW5GcmFtZVVwZGF0ZSIsIl90aW1lIiwidGltZVNjYWxlIiwibWF4RGVsdGFUaW1lIiwiZnJhbWUiLCJhdXRvUmVuZGVyIiwicmVuZGVyTmV4dEZyYW1lIiwidXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyIsInNjcmlwdCIsImxlZ2FjeSIsIl9saWJyYXJpZXNMb2FkZWQiLCJfZmlsbE1vZGUiLCJGSUxMTU9ERV9LRUVQX0FTUEVDVCIsIl9yZXNvbHV0aW9uTW9kZSIsIlJFU09MVVRJT05fRklYRUQiLCJfYWxsb3dSZXNpemUiLCJjb250ZXh0IiwiaW5pdCIsImFwcE9wdGlvbnMiLCJkZXZpY2UiLCJncmFwaGljc0RldmljZSIsImFzc2VydCIsIkdyYXBoaWNzRGV2aWNlQWNjZXNzIiwic2V0IiwiX2luaXREZWZhdWx0TWF0ZXJpYWwiLCJfaW5pdFByb2dyYW1MaWJyYXJ5Iiwic3RhdHMiLCJBcHBsaWNhdGlvblN0YXRzIiwiX3NvdW5kTWFuYWdlciIsInNvdW5kTWFuYWdlciIsImxvYWRlciIsIlJlc291cmNlTG9hZGVyIiwiTGlnaHRzQnVmZmVyIiwiX2VudGl0eUluZGV4Iiwic2NlbmUiLCJTY2VuZSIsIl9yZWdpc3RlclNjZW5lSW1tZWRpYXRlIiwicm9vdCIsIkVudGl0eSIsIl9lbmFibGVkSW5IaWVyYXJjaHkiLCJhc3NldHMiLCJBc3NldFJlZ2lzdHJ5IiwiYXNzZXRQcmVmaXgiLCJwcmVmaXgiLCJidW5kbGVzIiwiQnVuZGxlUmVnaXN0cnkiLCJlbmFibGVCdW5kbGVzIiwiVGV4dERlY29kZXIiLCJzY3JpcHRzT3JkZXIiLCJzY3JpcHRzIiwiU2NyaXB0UmVnaXN0cnkiLCJpMThuIiwiSTE4biIsInNjZW5lcyIsIlNjZW5lUmVnaXN0cnkiLCJzZWxmIiwiZGVmYXVsdExheWVyV29ybGQiLCJMYXllciIsIm5hbWUiLCJMQVlFUklEX1dPUkxEIiwic2NlbmVHcmFiIiwiU2NlbmVHcmFiIiwiZGVmYXVsdExheWVyRGVwdGgiLCJsYXllciIsImRlZmF1bHRMYXllclNreWJveCIsImVuYWJsZWQiLCJMQVlFUklEX1NLWUJPWCIsIm9wYXF1ZVNvcnRNb2RlIiwiU09SVE1PREVfTk9ORSIsImRlZmF1bHRMYXllclVpIiwiTEFZRVJJRF9VSSIsInRyYW5zcGFyZW50U29ydE1vZGUiLCJTT1JUTU9ERV9NQU5VQUwiLCJwYXNzVGhyb3VnaCIsImRlZmF1bHRMYXllckltbWVkaWF0ZSIsIkxBWUVSSURfSU1NRURJQVRFIiwiZGVmYXVsdExheWVyQ29tcG9zaXRpb24iLCJMYXllckNvbXBvc2l0aW9uIiwicHVzaE9wYXF1ZSIsInB1c2hUcmFuc3BhcmVudCIsImxheWVycyIsIm9uIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJsaXN0IiwibGF5ZXJMaXN0IiwiaSIsIkxBWUVSSURfREVQVEgiLCJwYXRjaCIsIkFyZWFMaWdodEx1dHMiLCJjcmVhdGVQbGFjZWhvbGRlciIsInJlbmRlcmVyIiwiRm9yd2FyZFJlbmRlcmVyIiwiZnJhbWVHcmFwaCIsIkZyYW1lR3JhcGgiLCJsaWdodG1hcHBlciIsIm9uY2UiLCJfZmlyc3RCYWtlIiwiX2JhdGNoZXIiLCJiYXRjaE1hbmFnZXIiLCJfZmlyc3RCYXRjaCIsImtleWJvYXJkIiwibW91c2UiLCJ0b3VjaCIsImdhbWVwYWRzIiwiZWxlbWVudElucHV0IiwieHIiLCJhdHRhY2hTZWxlY3RFdmVudHMiLCJfaW5Ub29scyIsIl9za3lib3hBc3NldCIsIl9zY3JpcHRQcmVmaXgiLCJzY3JpcHRQcmVmaXgiLCJhZGRIYW5kbGVyIiwiQnVuZGxlSGFuZGxlciIsInJlc291cmNlSGFuZGxlcnMiLCJmb3JFYWNoIiwicmVzb3VyY2VIYW5kbGVyIiwiaGFuZGxlciIsImhhbmRsZXJUeXBlIiwic3lzdGVtcyIsIkNvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5IiwiY29tcG9uZW50U3lzdGVtcyIsImNvbXBvbmVudFN5c3RlbSIsImFkZCIsIl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciIsIm9uVmlzaWJpbGl0eUNoYW5nZSIsImJpbmQiLCJkb2N1bWVudCIsImhpZGRlbiIsInVuZGVmaW5lZCIsIl9oaWRkZW5BdHRyIiwiYWRkRXZlbnRMaXN0ZW5lciIsIm1vekhpZGRlbiIsIm1zSGlkZGVuIiwid2Via2l0SGlkZGVuIiwidGljayIsIm1ha2VUaWNrIiwiZ2V0QXBwbGljYXRpb24iLCJtYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9CTElOTiIsInNldERlZmF1bHRNYXRlcmlhbCIsImxpYnJhcnkiLCJQcm9ncmFtTGlicmFyeSIsInNldFByb2dyYW1MaWJyYXJ5IiwiYmF0Y2hlciIsImZpbGxNb2RlIiwicmVzb2x1dGlvbk1vZGUiLCJjb25maWd1cmUiLCJ1cmwiLCJjYWxsYmFjayIsImh0dHAiLCJnZXQiLCJlcnIiLCJyZXNwb25zZSIsInByb3BzIiwiYXBwbGljYXRpb25fcHJvcGVydGllcyIsIl9wYXJzZUFwcGxpY2F0aW9uUHJvcGVydGllcyIsIl9wYXJzZVNjZW5lcyIsIl9wYXJzZUFzc2V0cyIsInByZWxvYWQiLCJmaXJlIiwicHJvZ3Jlc3MiLCJfZG9uZSIsInRvdGFsIiwib25Bc3NldExvYWQiLCJhc3NldCIsIm9uQXNzZXRFcnJvciIsImxvYWRlZCIsImxvYWQiLCJfcHJlbG9hZFNjcmlwdHMiLCJzY2VuZURhdGEiLCJwcmVsb2FkaW5nIiwiX2dldFNjcmlwdFJlZmVyZW5jZXMiLCJsIiwicmVnZXgiLCJvbkxvYWQiLCJTY3JpcHRUeXBlIiwiY29uc29sZSIsImVycm9yIiwic2NyaXB0VXJsIiwidGVzdCIsInRvTG93ZXJDYXNlIiwicGF0aCIsImpvaW4iLCJtYXhBc3NldFJldHJpZXMiLCJlbmFibGVSZXRyeSIsInVzZURldmljZVBpeGVsUmF0aW8iLCJ1c2VfZGV2aWNlX3BpeGVsX3JhdGlvIiwicmVzb2x1dGlvbl9tb2RlIiwiZmlsbF9tb2RlIiwiX3dpZHRoIiwid2lkdGgiLCJfaGVpZ2h0IiwiaGVpZ2h0IiwibWF4UGl4ZWxSYXRpbyIsIndpbmRvdyIsImRldmljZVBpeGVsUmF0aW8iLCJzZXRDYW52YXNSZXNvbHV0aW9uIiwic2V0Q2FudmFzRmlsbE1vZGUiLCJsYXllck9yZGVyIiwiY29tcG9zaXRpb24iLCJrZXkiLCJkYXRhIiwicGFyc2VJbnQiLCJsZW4iLCJzdWJsYXllciIsInRyYW5zcGFyZW50Iiwic3ViTGF5ZXJFbmFibGVkIiwiYmF0Y2hHcm91cHMiLCJncnAiLCJhZGRHcm91cCIsImR5bmFtaWMiLCJtYXhBYWJiU2l6ZSIsImkxOG5Bc3NldHMiLCJfbG9hZExpYnJhcmllcyIsImxpYnJhcmllcyIsInVybHMiLCJvbkxpYnJhcmllc0xvYWRlZCIsInNjcmlwdHNJbmRleCIsImJ1bmRsZXNJbmRleCIsInB1c2giLCJ0eXBlIiwiQXNzZXQiLCJmaWxlIiwibG9hZGluZ1R5cGUiLCJ0YWdzIiwibG9jYWxlIiwiYWRkTG9jYWxpemVkQXNzZXRJZCIsInByaW9yaXR5U2NyaXB0cyIsInNldHRpbmdzIiwicHJpb3JpdHlfc2NyaXB0cyIsIl9zY3JpcHRzIiwiX2luZGV4IiwiZW50aXRpZXMiLCJjb21wb25lbnRzIiwic3RhcnQiLCJjYWxsIiwiX2FscmVhZHlTdGFydGVkIiwidGltZXN0YW1wIiwibm93IiwidGFyZ2V0IiwiaW5wdXRVcGRhdGUiLCJkdCIsImNvbnRyb2xsZXIiLCJ1cGRhdGUiLCJ1cGRhdGVDbGllbnRSZWN0IiwidXBkYXRlU3RhcnQiLCJ1cGRhdGVUaW1lIiwiZnJhbWVTdGFydCIsInJlbmRlciIsInJlbmRlclN0YXJ0Iiwic3luY0hpZXJhcmNoeSIsInVwZGF0ZUFsbCIsIl9za2lwUmVuZGVyQ291bnRlciIsInJlbmRlckNvbXBvc2l0aW9uIiwicmVuZGVyVGltZSIsImxheWVyQ29tcG9zaXRpb24iLCJEZWJ1Z0dyYXBoaWNzIiwiY2xlYXJHcHVNYXJrZXJzIiwiYnVpbGRGcmFtZUdyYXBoIiwiX2ZpbGxGcmFtZVN0YXRzQmFzaWMiLCJtcyIsIl90aW1lVG9Db3VudEZyYW1lcyIsImZwcyIsIl9mcHNBY2N1bSIsImRyYXdDYWxscyIsIl9kcmF3Q2FsbHNQZXJGcmFtZSIsIl9maWxsRnJhbWVTdGF0cyIsImNhbWVyYXMiLCJfY2FtZXJhc1JlbmRlcmVkIiwibWF0ZXJpYWxzIiwiX21hdGVyaWFsU3dpdGNoZXMiLCJzaGFkZXJzIiwiX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUiLCJzaGFkb3dNYXBVcGRhdGVzIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJzaGFkb3dNYXBUaW1lIiwiX3NoYWRvd01hcFRpbWUiLCJkZXB0aE1hcFRpbWUiLCJfZGVwdGhNYXBUaW1lIiwiZm9yd2FyZFRpbWUiLCJfZm9yd2FyZFRpbWUiLCJwcmltcyIsIl9wcmltc1BlckZyYW1lIiwidHJpYW5nbGVzIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsIk1hdGgiLCJtYXgiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiY3VsbFRpbWUiLCJfY3VsbFRpbWUiLCJzb3J0VGltZSIsIl9zb3J0VGltZSIsInNraW5UaW1lIiwiX3NraW5UaW1lIiwibW9ycGhUaW1lIiwiX21vcnBoVGltZSIsImxpZ2h0Q2x1c3RlcnMiLCJfbGlnaHRDbHVzdGVycyIsImxpZ2h0Q2x1c3RlcnNUaW1lIiwiX2xpZ2h0Q2x1c3RlcnNUaW1lIiwib3RoZXJQcmltaXRpdmVzIiwiX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lIiwiZm9yd2FyZCIsIl9mb3J3YXJkRHJhd0NhbGxzIiwiY3VsbGVkIiwiX251bURyYXdDYWxsc0N1bGxlZCIsImRlcHRoIiwic2hhZG93IiwiX3NoYWRvd0RyYXdDYWxscyIsInNraW5uZWQiLCJfc2tpbkRyYXdDYWxscyIsImltbWVkaWF0ZSIsImluc3RhbmNlZCIsInJlbW92ZWRCeUluc3RhbmNpbmciLCJtaXNjIiwiX2RlcHRoRHJhd0NhbGxzIiwiX2ltbWVkaWF0ZVJlbmRlcmVkIiwiX2luc3RhbmNlZERyYXdDYWxscyIsInJlbmRlclRhcmdldENyZWF0aW9uVGltZSIsInBhcnRpY2xlcyIsInVwZGF0ZXNQZXJGcmFtZSIsIl91cGRhdGVzUGVyRnJhbWUiLCJmcmFtZVRpbWUiLCJfZnJhbWVUaW1lIiwibW9kZSIsInJlc2l6ZUNhbnZhcyIsIlJFU09MVVRJT05fQVVUTyIsImNsaWVudFdpZHRoIiwiY2xpZW50SGVpZ2h0IiwiaXNIaWRkZW4iLCJzdXNwZW5kIiwicmVzdW1lIiwic2Vzc2lvbiIsIndpbmRvd1dpZHRoIiwiaW5uZXJXaWR0aCIsIndpbmRvd0hlaWdodCIsImlubmVySGVpZ2h0IiwiciIsIndpblIiLCJGSUxMTU9ERV9GSUxMX1dJTkRPVyIsInN0eWxlIiwidXBkYXRlQ2FudmFzU2l6ZSIsIl90aGlzJHhyIiwiYWN0aXZlIiwicmlnaWRib2R5Iiwib25MaWJyYXJ5TG9hZGVkIiwiYXBwbHlTY2VuZVNldHRpbmdzIiwiQW1tbyIsImdyYXZpdHkiLCJwaHlzaWNzIiwiYXBwbHlTZXR0aW5ncyIsImhhc093blByb3BlcnR5Iiwic2t5Ym94Iiwic2V0U2t5Ym94Iiwic2V0QXJlYUxpZ2h0THV0cyIsImx0Y01hdDEiLCJsdGNNYXQyIiwid2FybiIsIm9uU2t5Ym94UmVtb3ZlZCIsIm9uU2t5Ym94Q2hhbmdlZCIsInJlc291cmNlcyIsIm9mZiIsInNreWJveE1pcCIsImxvYWRGYWNlcyIsIl90aGlzJGxpZ2h0bWFwcGVyIiwiYmFrZSIsImxpZ2h0bWFwTW9kZSIsIl90aGlzJGJhdGNoZXIiLCJnZW5lcmF0ZSIsIl9wcm9jZXNzVGltZXN0YW1wIiwiZHJhd0xpbmUiLCJlbmQiLCJjb2xvciIsImRlcHRoVGVzdCIsImRyYXdMaW5lcyIsInBvc2l0aW9ucyIsImNvbG9ycyIsImRlZmF1bHREcmF3TGF5ZXIiLCJkcmF3TGluZUFycmF5cyIsImRyYXdXaXJlU3BoZXJlIiwiY2VudGVyIiwicmFkaXVzIiwiQ29sb3IiLCJXSElURSIsInNlZ21lbnRzIiwiZHJhd1dpcmVBbGlnbmVkQm94IiwibWluUG9pbnQiLCJtYXhQb2ludCIsImRyYXdNZXNoSW5zdGFuY2UiLCJtZXNoSW5zdGFuY2UiLCJkcmF3TWVzaCIsIm1lc2giLCJtYXRyaXgiLCJkcmF3UXVhZCIsImdldFF1YWRNZXNoIiwiZHJhd1RleHR1cmUiLCJ4IiwieSIsInRleHR1cmUiLCJmaWx0ZXJhYmxlIiwiaXNXZWJHUFUiLCJNYXQ0Iiwic2V0VFJTIiwiVmVjMyIsIlF1YXQiLCJJREVOVElUWSIsIk1hdGVyaWFsIiwic2V0UGFyYW1ldGVyIiwic2hhZGVyIiwiZ2V0VGV4dHVyZVNoYWRlciIsImdldFVuZmlsdGVyYWJsZVRleHR1cmVTaGFkZXIiLCJkcmF3RGVwdGhUZXh0dXJlIiwiZ2V0RGVwdGhUZXh0dXJlU2hhZGVyIiwiZGVzdHJveSIsIl90aGlzJGxpZ2h0bWFwcGVyMiIsImNhbnZhc0lkIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImRldGFjaCIsInVubG9hZCIsImdldEhhbmRsZXIiLCJfY2FjaGUiLCJlbGVtZW50IiwicGFyZW50IiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblBvc3RSZW5kZXJPcGFxdWUiLCJvbkRpc2FibGUiLCJvbkVuYWJsZSIsImdldEVudGl0eUZyb21JbmRleCIsImd1aWQiLCJvblBvc3RSZW5kZXIiLCJfZnJhbWVFbmREYXRhIiwiX2FwcCIsImFwcGxpY2F0aW9uIiwiZnJhbWVSZXF1ZXN0IiwiX2FwcGxpY2F0aW9uJHhyIiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJjdXJyZW50VGltZSIsIm1hdGgiLCJjbGFtcCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInBsYXRmb3JtIiwiYnJvd3NlciIsImNvbnRleHRMb3N0Iiwic2hvdWxkUmVuZGVyRnJhbWUiLCJfYXBwbGljYXRpb24keHIyIiwiZGVmYXVsdEZyYW1lYnVmZmVyIiwicmVuZGVyU3RhdGUiLCJiYXNlTGF5ZXIiLCJmcmFtZWJ1ZmZlciIsInRyYWNlIiwiVFJBQ0VJRF9SRU5ERVJfRlJBTUUiLCJUUkFDRUlEX1JFTkRFUl9GUkFNRV9USU1FIiwidG9GaXhlZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7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
