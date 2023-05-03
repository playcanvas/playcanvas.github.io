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
 *     const app = this.app;
 * };
 *
 * MyScript.prototype.update = function(dt) {
 *     // ...and update functions.
 *     const app = this.app;
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
   * const options = new AppOptions();
   * const app = new pc.AppBase(canvas);
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
     * const camera = this.app.root.findByName('Camera');
     */
    this.root = new Entity();
    this.root._enabledInHierarchy = true;

    /**
     * The asset registry managed by the application.
     *
     * @type {AssetRegistry}
     * @example
     * // Search the asset registry for all assets with the tag 'vehicle'
     * const vehicleAssets = this.app.assets.findByTag('vehicle');
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
     * const sceneItem = this.app.scenes.find('racetrack1');
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
   * const app = pc.AppBase.getApplication();
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
   * @param {number} settings.render.ambientBakeOcclusionBrightness - Brightness of the baked ambient occlusion.
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
   * const settings = {
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
   * const start = new pc.Vec3(0, 0, 0);
   * const end = new pc.Vec3(1, 0, 0);
   * app.drawLine(start, end);
   * @example
   * // Render a 1-unit long red line which is not depth tested and renders on top of other geometry
   * const start = new pc.Vec3(0, 0, 0);
   * const end = new pc.Vec3(1, 0, 0);
   * app.drawLine(start, end, pc.Color.RED, false);
   * @example
   * // Render a 1-unit long white line into the world layer
   * const start = new pc.Vec3(0, 0, 0);
   * const end = new pc.Vec3(1, 0, 0);
   * const worldLayer = app.scene.layers.getLayerById(pc.LAYERID_WORLD);
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
   * const start = new pc.Vec3(0, 0, 0);
   * const end = new pc.Vec3(1, 0, 0);
   * app.drawLines([start, end], [pc.Color.RED, pc.Color.WHITE]);
   * @example
   * // Render 2 discrete line segments
   * const points = [
   *     // Line 1
   *     new pc.Vec3(0, 0, 0),
   *     new pc.Vec3(1, 0, 0),
   *     // Line 2
   *     new pc.Vec3(1, 1, 0),
   *     new pc.Vec3(1, 1, 1)
   * ];
   * const colors = [
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
   * const points = [
   *     // Line 1
   *     0, 0, 0,
   *     1, 0, 0,
   *     // Line 2
   *     1, 1, 0,
   *     1, 1, 1
   * ];
   * const colors = [
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
   * const center = new pc.Vec3(0, 0, 0);
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
   * const min = new pc.Vec3(-1, -1, -1);
   * const max = new pc.Vec3(1, 1, 1);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLWJhc2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLWJhc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gI2lmIF9ERUJVR1xuaW1wb3J0IHsgdmVyc2lvbiwgcmV2aXNpb24gfSBmcm9tICcuLi9jb3JlL2NvcmUuanMnO1xuLy8gI2VuZGlmXG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgVFJBQ0VJRF9SRU5ERVJfRlJBTUUsIFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUgfSBmcm9tICcuLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi9wbGF0Zm9ybS9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9ERVBUSCwgTEFZRVJJRF9JTU1FRElBVEUsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX1dPUkxELFxuICAgIFNPUlRNT0RFX05PTkUsIFNPUlRNT0RFX01BTlVBTCwgU1BFQ1VMQVJfQkxJTk5cbn0gZnJvbSAnLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IHNldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH0gZnJvbSAnLi4vc2NlbmUvcmVuZGVyZXIvZm9yd2FyZC1yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBGcmFtZUdyYXBoIH0gZnJvbSAnLi4vc2NlbmUvZnJhbWUtZ3JhcGguanMnO1xuaW1wb3J0IHsgQXJlYUxpZ2h0THV0cyB9IGZyb20gJy4uL3NjZW5lL2FyZWEtbGlnaHQtbHV0cy5qcyc7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4uL3NjZW5lL2xheWVyLmpzJztcbmltcG9ydCB7IExheWVyQ29tcG9zaXRpb24gfSBmcm9tICcuLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBTY2VuZSB9IGZyb20gJy4uL3NjZW5lL3NjZW5lLmpzJztcbmltcG9ydCB7IE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcbmltcG9ydCB7IExpZ2h0c0J1ZmZlciB9IGZyb20gJy4uL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBzZXREZWZhdWx0TWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi9hc3NldC9hc3NldC5qcyc7XG5pbXBvcnQgeyBBc3NldFJlZ2lzdHJ5IH0gZnJvbSAnLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBCdW5kbGVSZWdpc3RyeSB9IGZyb20gJy4vYnVuZGxlL2J1bmRsZS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSB9IGZyb20gJy4vY29tcG9uZW50cy9yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBTY2VuZUdyYWIgfSBmcm9tICcuLi9zY2VuZS9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcbmltcG9ydCB7IEJ1bmRsZUhhbmRsZXIgfSBmcm9tICcuL2hhbmRsZXJzL2J1bmRsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxvYWRlciB9IGZyb20gJy4vaGFuZGxlcnMvbG9hZGVyLmpzJztcbmltcG9ydCB7IEkxOG4gfSBmcm9tICcuL2kxOG4vaTE4bi5qcyc7XG5pbXBvcnQgeyBTY3JpcHRSZWdpc3RyeSB9IGZyb20gJy4vc2NyaXB0L3NjcmlwdC1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBTY2VuZVJlZ2lzdHJ5IH0gZnJvbSAnLi9zY2VuZS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBzY3JpcHQgfSBmcm9tICcuL3NjcmlwdC5qcyc7XG5pbXBvcnQgeyBBcHBsaWNhdGlvblN0YXRzIH0gZnJvbSAnLi9zdGF0cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgRklMTE1PREVfRklMTF9XSU5ET1csIEZJTExNT0RFX0tFRVBfQVNQRUNULFxuICAgIFJFU09MVVRJT05fQVVUTywgUkVTT0xVVElPTl9GSVhFRFxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgZ2V0QXBwbGljYXRpb24sXG4gICAgc2V0QXBwbGljYXRpb25cbn0gZnJvbSAnLi9nbG9iYWxzLmpzJztcblxuLy8gTWluaS1vYmplY3QgdXNlZCB0byBtZWFzdXJlIHByb2dyZXNzIG9mIGxvYWRpbmcgc2V0c1xuY2xhc3MgUHJvZ3Jlc3Mge1xuICAgIGNvbnN0cnVjdG9yKGxlbmd0aCkge1xuICAgICAgICB0aGlzLmxlbmd0aCA9IGxlbmd0aDtcbiAgICAgICAgdGhpcy5jb3VudCA9IDA7XG4gICAgfVxuXG4gICAgaW5jKCkge1xuICAgICAgICB0aGlzLmNvdW50Kys7XG4gICAgfVxuXG4gICAgZG9uZSgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmNvdW50ID09PSB0aGlzLmxlbmd0aCk7XG4gICAgfVxufVxuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEFwcEJhc2UjY29uZmlndXJlfSB3aGVuIGNvbmZpZ3VyYXRpb24gZmlsZSBpcyBsb2FkZWQgYW5kIHBhcnNlZCAob3JcbiAqIGFuIGVycm9yIG9jY3VycykuXG4gKlxuICogQGNhbGxiYWNrIENvbmZpZ3VyZUFwcENhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgbG9hZGluZyBvciBwYXJzaW5nIGZhaWxzLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNwcmVsb2FkfSB3aGVuIGFsbCBhc3NldHMgKG1hcmtlZCBhcyAncHJlbG9hZCcpIGFyZSBsb2FkZWQuXG4gKlxuICogQGNhbGxiYWNrIFByZWxvYWRBcHBDYWxsYmFja1xuICovXG5cbmxldCBhcHAgPSBudWxsO1xuXG4vKipcbiAqIEFuIEFwcGxpY2F0aW9uIHJlcHJlc2VudHMgYW5kIG1hbmFnZXMgeW91ciBQbGF5Q2FudmFzIGFwcGxpY2F0aW9uLiBJZiB5b3UgYXJlIGRldmVsb3BpbmcgdXNpbmdcbiAqIHRoZSBQbGF5Q2FudmFzIEVkaXRvciwgdGhlIEFwcGxpY2F0aW9uIGlzIGNyZWF0ZWQgZm9yIHlvdS4gWW91IGNhbiBhY2Nlc3MgeW91ciBBcHBsaWNhdGlvblxuICogaW5zdGFuY2UgaW4geW91ciBzY3JpcHRzLiBCZWxvdyBpcyBhIHNrZWxldG9uIHNjcmlwdCB3aGljaCBzaG93cyBob3cgeW91IGNhbiBhY2Nlc3MgdGhlXG4gKiBhcHBsaWNhdGlvbiAnYXBwJyBwcm9wZXJ0eSBpbnNpZGUgdGhlIGluaXRpYWxpemUgYW5kIHVwZGF0ZSBmdW5jdGlvbnM6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gRWRpdG9yIGV4YW1wbGU6IGFjY2Vzc2luZyB0aGUgcGMuQXBwbGljYXRpb24gZnJvbSBhIHNjcmlwdFxuICogdmFyIE15U2NyaXB0ID0gcGMuY3JlYXRlU2NyaXB0KCdteVNjcmlwdCcpO1xuICpcbiAqIE15U2NyaXB0LnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24oKSB7XG4gKiAgICAgLy8gRXZlcnkgc2NyaXB0IGluc3RhbmNlIGhhcyBhIHByb3BlcnR5ICd0aGlzLmFwcCcgYWNjZXNzaWJsZSBpbiB0aGUgaW5pdGlhbGl6ZS4uLlxuICogICAgIGNvbnN0IGFwcCA9IHRoaXMuYXBwO1xuICogfTtcbiAqXG4gKiBNeVNjcmlwdC5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZHQpIHtcbiAqICAgICAvLyAuLi5hbmQgdXBkYXRlIGZ1bmN0aW9ucy5cbiAqICAgICBjb25zdCBhcHAgPSB0aGlzLmFwcDtcbiAqIH07XG4gKiBgYGBcbiAqXG4gKiBJZiB5b3UgYXJlIHVzaW5nIHRoZSBFbmdpbmUgd2l0aG91dCB0aGUgRWRpdG9yLCB5b3UgaGF2ZSB0byBjcmVhdGUgdGhlIGFwcGxpY2F0aW9uIGluc3RhbmNlXG4gKiBtYW51YWxseS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEFwcEJhc2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBcHBCYXNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudH0gY2FudmFzIC0gVGhlIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRW5naW5lLW9ubHkgZXhhbXBsZTogY3JlYXRlIHRoZSBhcHBsaWNhdGlvbiBtYW51YWxseVxuICAgICAqIGNvbnN0IG9wdGlvbnMgPSBuZXcgQXBwT3B0aW9ucygpO1xuICAgICAqIGNvbnN0IGFwcCA9IG5ldyBwYy5BcHBCYXNlKGNhbnZhcyk7XG4gICAgICogYXBwLmluaXQob3B0aW9ucyk7XG4gICAgICpcbiAgICAgKiAvLyBTdGFydCB0aGUgYXBwbGljYXRpb24ncyBtYWluIGxvb3BcbiAgICAgKiBhcHAuc3RhcnQoKTtcbiAgICAgKlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihjYW52YXMpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh2ZXJzaW9uPy5pbmRleE9mKCckJykgPCAwKSB7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coYFBvd2VyZWQgYnkgUGxheUNhbnZhcyAke3ZlcnNpb259ICR7cmV2aXNpb259YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gU3RvcmUgYXBwbGljYXRpb24gaW5zdGFuY2VcbiAgICAgICAgQXBwQmFzZS5fYXBwbGljYXRpb25zW2NhbnZhcy5pZF0gPSB0aGlzO1xuICAgICAgICBzZXRBcHBsaWNhdGlvbih0aGlzKTtcblxuICAgICAgICBhcHAgPSB0aGlzO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9kZXN0cm95UmVxdWVzdGVkID0gZmFsc2U7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX2luRnJhbWVVcGRhdGUgPSBmYWxzZTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fdGltZSA9IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNjYWxlcyB0aGUgZ2xvYmFsIHRpbWUgZGVsdGEuIERlZmF1bHRzIHRvIDEuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCB0aGUgYXBwIHRvIHJ1biBhdCBoYWxmIHNwZWVkXG4gICAgICAgICAqIHRoaXMuYXBwLnRpbWVTY2FsZSA9IDAuNTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudGltZVNjYWxlID0gMTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2xhbXBzIHBlci1mcmFtZSBkZWx0YSB0aW1lIHRvIGFuIHVwcGVyIGJvdW5kLiBVc2VmdWwgc2luY2UgcmV0dXJuaW5nIGZyb20gYSB0YWJcbiAgICAgICAgICogZGVhY3RpdmF0aW9uIGNhbiBnZW5lcmF0ZSBodWdlIHZhbHVlcyBmb3IgZHQsIHdoaWNoIGNhbiBhZHZlcnNlbHkgYWZmZWN0IGdhbWUgc3RhdGUuXG4gICAgICAgICAqIERlZmF1bHRzIHRvIDAuMSAoc2Vjb25kcykuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIERvbid0IGNsYW1wIGludGVyLWZyYW1lIHRpbWVzIG9mIDIwMG1zIG9yIGxlc3NcbiAgICAgICAgICogdGhpcy5hcHAubWF4RGVsdGFUaW1lID0gMC4yO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tYXhEZWx0YVRpbWUgPSAwLjE7IC8vIE1heGltdW0gZGVsdGEgaXMgMC4xcyBvciAxMCBmcHMuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0b3RhbCBudW1iZXIgb2YgZnJhbWVzIHRoZSBhcHBsaWNhdGlvbiBoYXMgdXBkYXRlZCBzaW5jZSBzdGFydCgpIHdhcyBjYWxsZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGVuIHRydWUsIHRoZSBhcHBsaWNhdGlvbidzIHJlbmRlciBmdW5jdGlvbiBpcyBjYWxsZWQgZXZlcnkgZnJhbWUuIFNldHRpbmcgYXV0b1JlbmRlclxuICAgICAgICAgKiB0byBmYWxzZSBpcyB1c2VmdWwgdG8gYXBwbGljYXRpb25zIHdoZXJlIHRoZSByZW5kZXJlZCBpbWFnZSBtYXkgb2Z0ZW4gYmUgdW5jaGFuZ2VkIG92ZXJcbiAgICAgICAgICogdGltZS4gVGhpcyBjYW4gaGVhdmlseSByZWR1Y2UgdGhlIGFwcGxpY2F0aW9uJ3MgbG9hZCBvbiB0aGUgQ1BVIGFuZCBHUFUuIERlZmF1bHRzIHRvXG4gICAgICAgICAqIHRydWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBEaXNhYmxlIHJlbmRlcmluZyBldmVyeSBmcmFtZSBhbmQgb25seSByZW5kZXIgb24gYSBrZXlkb3duIGV2ZW50XG4gICAgICAgICAqIHRoaXMuYXBwLmF1dG9SZW5kZXIgPSBmYWxzZTtcbiAgICAgICAgICogdGhpcy5hcHAua2V5Ym9hcmQub24oJ2tleWRvd24nLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgICogICAgIHRoaXMuYXBwLnJlbmRlck5leHRGcmFtZSA9IHRydWU7XG4gICAgICAgICAqIH0sIHRoaXMpO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5hdXRvUmVuZGVyID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IHRvIHRydWUgdG8gcmVuZGVyIHRoZSBzY2VuZSBvbiB0aGUgbmV4dCBpdGVyYXRpb24gb2YgdGhlIG1haW4gbG9vcC4gVGhpcyBvbmx5IGhhcyBhblxuICAgICAgICAgKiBlZmZlY3QgaWYge0BsaW5rIEFwcEJhc2UjYXV0b1JlbmRlcn0gaXMgc2V0IHRvIGZhbHNlLiBUaGUgdmFsdWUgb2YgcmVuZGVyTmV4dEZyYW1lXG4gICAgICAgICAqIGlzIHNldCBiYWNrIHRvIGZhbHNlIGFnYWluIGFzIHNvb24gYXMgdGhlIHNjZW5lIGhhcyBiZWVuIHJlbmRlcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gUmVuZGVyIHRoZSBzY2VuZSBvbmx5IHdoaWxlIHNwYWNlIGtleSBpcyBwcmVzc2VkXG4gICAgICAgICAqIGlmICh0aGlzLmFwcC5rZXlib2FyZC5pc1ByZXNzZWQocGMuS0VZX1NQQUNFKSkge1xuICAgICAgICAgKiAgICAgdGhpcy5hcHAucmVuZGVyTmV4dEZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICogfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZW5kZXJOZXh0RnJhbWUgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRW5hYmxlIGlmIHlvdSB3YW50IGVudGl0eSB0eXBlIHNjcmlwdCBhdHRyaWJ1dGVzIHRvIG5vdCBiZSByZS1tYXBwZWQgd2hlbiBhbiBlbnRpdHkgaXNcbiAgICAgICAgICogY2xvbmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy51c2VMZWdhY3lTY3JpcHRBdHRyaWJ1dGVDbG9uaW5nID0gc2NyaXB0LmxlZ2FjeTtcblxuICAgICAgICB0aGlzLl9saWJyYXJpZXNMb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZmlsbE1vZGUgPSBGSUxMTU9ERV9LRUVQX0FTUEVDVDtcbiAgICAgICAgdGhpcy5fcmVzb2x1dGlvbk1vZGUgPSBSRVNPTFVUSU9OX0ZJWEVEO1xuICAgICAgICB0aGlzLl9hbGxvd1Jlc2l6ZSA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIHNjcmlwdHMgMS4wLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7QXBwQmFzZX1cbiAgICAgICAgICogQGRlcHJlY2F0ZWRcbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jb250ZXh0ID0gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHRoZSBhcHAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9hcHAtb3B0aW9ucy5qcycpLkFwcE9wdGlvbnN9IGFwcE9wdGlvbnMgLSBPcHRpb25zIHNwZWNpZnlpbmcgdGhlIGluaXRcbiAgICAgKiBwYXJhbWV0ZXJzIGZvciB0aGUgYXBwLlxuICAgICAqL1xuICAgIGluaXQoYXBwT3B0aW9ucykge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSBhcHBPcHRpb25zLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIERlYnVnLmFzc2VydChkZXZpY2UsIFwiVGhlIGFwcGxpY2F0aW9uIGNhbm5vdCBiZSBjcmVhdGVkIHdpdGhvdXQgYSB2YWxpZCBHcmFwaGljc0RldmljZVwiKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlID0gZGV2aWNlO1xuICAgICAgICBHcmFwaGljc0RldmljZUFjY2Vzcy5zZXQoZGV2aWNlKTtcblxuICAgICAgICB0aGlzLl9pbml0RGVmYXVsdE1hdGVyaWFsKCk7XG4gICAgICAgIHRoaXMuX2luaXRQcm9ncmFtTGlicmFyeSgpO1xuICAgICAgICB0aGlzLnN0YXRzID0gbmV3IEFwcGxpY2F0aW9uU3RhdHMoZGV2aWNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlciA9IGFwcE9wdGlvbnMuc291bmRNYW5hZ2VyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcmVzb3VyY2UgbG9hZGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7UmVzb3VyY2VMb2FkZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvYWRlciA9IG5ldyBSZXNvdXJjZUxvYWRlcih0aGlzKTtcblxuICAgICAgICBMaWdodHNCdWZmZXIuaW5pdChkZXZpY2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZXMgYWxsIGVudGl0aWVzIHRoYXQgaGF2ZSBiZWVuIGNyZWF0ZWQgZm9yIHRoaXMgYXBwIGJ5IGd1aWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBFbnRpdHk+fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbnRpdHlJbmRleCA9IHt9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2NlbmUgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTY2VuZX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2V0IHRoZSB0b25lIG1hcHBpbmcgcHJvcGVydHkgb2YgdGhlIGFwcGxpY2F0aW9uJ3Mgc2NlbmVcbiAgICAgICAgICogdGhpcy5hcHAuc2NlbmUudG9uZU1hcHBpbmcgPSBwYy5UT05FTUFQX0ZJTE1JQztcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2NlbmUgPSBuZXcgU2NlbmUoZGV2aWNlKTtcbiAgICAgICAgdGhpcy5fcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZSh0aGlzLnNjZW5lKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJvb3QgZW50aXR5IG9mIHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VudGl0eX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gUmV0dXJuIHRoZSBmaXJzdCBlbnRpdHkgY2FsbGVkICdDYW1lcmEnIGluIGEgZGVwdGgtZmlyc3Qgc2VhcmNoIG9mIHRoZSBzY2VuZSBoaWVyYXJjaHlcbiAgICAgICAgICogY29uc3QgY2FtZXJhID0gdGhpcy5hcHAucm9vdC5maW5kQnlOYW1lKCdDYW1lcmEnKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucm9vdCA9IG5ldyBFbnRpdHkoKTtcbiAgICAgICAgdGhpcy5yb290Ll9lbmFibGVkSW5IaWVyYXJjaHkgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXNzZXQgcmVnaXN0cnkgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtBc3NldFJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZWFyY2ggdGhlIGFzc2V0IHJlZ2lzdHJ5IGZvciBhbGwgYXNzZXRzIHdpdGggdGhlIHRhZyAndmVoaWNsZSdcbiAgICAgICAgICogY29uc3QgdmVoaWNsZUFzc2V0cyA9IHRoaXMuYXBwLmFzc2V0cy5maW5kQnlUYWcoJ3ZlaGljbGUnKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXNzZXRzID0gbmV3IEFzc2V0UmVnaXN0cnkodGhpcy5sb2FkZXIpO1xuICAgICAgICBpZiAoYXBwT3B0aW9ucy5hc3NldFByZWZpeCkgdGhpcy5hc3NldHMucHJlZml4ID0gYXBwT3B0aW9ucy5hc3NldFByZWZpeDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0J1bmRsZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmJ1bmRsZXMgPSBuZXcgQnVuZGxlUmVnaXN0cnkodGhpcy5hc3NldHMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgdGhpcyB0byBmYWxzZSBpZiB5b3Ugd2FudCB0byBydW4gd2l0aG91dCB1c2luZyBidW5kbGVzLiBXZSBzZXQgaXQgdG8gdHJ1ZSBvbmx5IGlmXG4gICAgICAgICAqIFRleHREZWNvZGVyIGlzIGF2YWlsYWJsZSBiZWNhdXNlIHdlIGN1cnJlbnRseSByZWx5IG9uIGl0IGZvciB1bnRhcnJpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVuYWJsZUJ1bmRsZXMgPSAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJyk7XG5cbiAgICAgICAgdGhpcy5zY3JpcHRzT3JkZXIgPSBhcHBPcHRpb25zLnNjcmlwdHNPcmRlciB8fCBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uJ3Mgc2NyaXB0IHJlZ2lzdHJ5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NyaXB0UmVnaXN0cnl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBuZXcgU2NyaXB0UmVnaXN0cnkodGhpcyk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXMgbG9jYWxpemF0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7STE4bn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaTE4biA9IG5ldyBJMThuKHRoaXMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2NlbmUgcmVnaXN0cnkgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTY2VuZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZWFyY2ggdGhlIHNjZW5lIHJlZ2lzdHJ5IGZvciBhIGl0ZW0gd2l0aCB0aGUgbmFtZSAncmFjZXRyYWNrMSdcbiAgICAgICAgICogY29uc3Qgc2NlbmVJdGVtID0gdGhpcy5hcHAuc2NlbmVzLmZpbmQoJ3JhY2V0cmFjazEnKTtcbiAgICAgICAgICpcbiAgICAgICAgICogLy8gTG9hZCB0aGUgc2NlbmUgdXNpbmcgdGhlIGl0ZW0ncyB1cmxcbiAgICAgICAgICogdGhpcy5hcHAuc2NlbmVzLmxvYWRTY2VuZShzY2VuZUl0ZW0udXJsKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2NlbmVzID0gbmV3IFNjZW5lUmVnaXN0cnkodGhpcyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyV29ybGQgPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgbmFtZTogXCJXb3JsZFwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfV09STERcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5zY2VuZUdyYWIgPSBuZXcgU2NlbmVHcmFiKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIHRoaXMuc2NlbmUpO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoID0gdGhpcy5zY2VuZUdyYWIubGF5ZXI7XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJTa3lib3ggPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG5hbWU6IFwiU2t5Ym94XCIsXG4gICAgICAgICAgICBpZDogTEFZRVJJRF9TS1lCT1gsXG4gICAgICAgICAgICBvcGFxdWVTb3J0TW9kZTogU09SVE1PREVfTk9ORVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJVaSA9IG5ldyBMYXllcih7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbmFtZTogXCJVSVwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfVUksXG4gICAgICAgICAgICB0cmFuc3BhcmVudFNvcnRNb2RlOiBTT1JUTU9ERV9NQU5VQUwsXG4gICAgICAgICAgICBwYXNzVGhyb3VnaDogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVySW1tZWRpYXRlID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiBcIkltbWVkaWF0ZVwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfSU1NRURJQVRFLFxuICAgICAgICAgICAgb3BhcXVlU29ydE1vZGU6IFNPUlRNT0RFX05PTkUsXG4gICAgICAgICAgICBwYXNzVGhyb3VnaDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbiA9IG5ldyBMYXllckNvbXBvc2l0aW9uKFwiZGVmYXVsdFwiKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllcldvcmxkKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllckRlcHRoKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllclNreWJveCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllcldvcmxkKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllclVpKTtcbiAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMgPSBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbjtcblxuICAgICAgICAvLyBEZWZhdWx0IGxheWVycyBwYXRjaFxuICAgICAgICB0aGlzLnNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgZnVuY3Rpb24gKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgICAgIGNvbnN0IGxpc3QgPSBuZXdDb21wLmxheWVyTGlzdDtcbiAgICAgICAgICAgIGxldCBsYXllcjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGxheWVyID0gbGlzdFtpXTtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGxheWVyLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTEFZRVJJRF9ERVBUSDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc2NlbmVHcmFiLnBhdGNoKGxheWVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIExBWUVSSURfVUk6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5wYXNzVGhyb3VnaCA9IHNlbGYuZGVmYXVsdExheWVyVWkucGFzc1Rocm91Z2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBMQVlFUklEX0lNTUVESUFURTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnBhc3NUaHJvdWdoID0gc2VsZi5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUucGFzc1Rocm91Z2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHBsYWNlaG9sZGVyIHRleHR1cmUgZm9yIGFyZWEgbGlnaHQgTFVUc1xuICAgICAgICBBcmVhTGlnaHRMdXRzLmNyZWF0ZVBsYWNlaG9sZGVyKGRldmljZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBmb3J3YXJkIHJlbmRlcmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Rm9yd2FyZFJlbmRlcmVyfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbmV3IEZvcndhcmRSZW5kZXJlcihkZXZpY2UpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnNjZW5lID0gdGhpcy5zY2VuZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGZyYW1lIGdyYXBoLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnJhbWVHcmFwaH1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5mcmFtZUdyYXBoID0gbmV3IEZyYW1lR3JhcGgoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJ1bi10aW1lIGxpZ2h0bWFwcGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2xpZ2h0bWFwcGVyL2xpZ2h0bWFwcGVyLmpzJykuTGlnaHRtYXBwZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyID0gbnVsbDtcbiAgICAgICAgaWYgKGFwcE9wdGlvbnMubGlnaHRtYXBwZXIpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRtYXBwZXIgPSBuZXcgYXBwT3B0aW9ucy5saWdodG1hcHBlcihkZXZpY2UsIHRoaXMucm9vdCwgdGhpcy5zY2VuZSwgdGhpcy5yZW5kZXJlciwgdGhpcy5hc3NldHMpO1xuICAgICAgICAgICAgdGhpcy5vbmNlKCdwcmVyZW5kZXInLCB0aGlzLl9maXJzdEJha2UsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIGJhdGNoIG1hbmFnZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLW1hbmFnZXIuanMnKS5CYXRjaE1hbmFnZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9iYXRjaGVyID0gbnVsbDtcbiAgICAgICAgaWYgKGFwcE9wdGlvbnMuYmF0Y2hNYW5hZ2VyKSB7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaGVyID0gbmV3IGFwcE9wdGlvbnMuYmF0Y2hNYW5hZ2VyKGRldmljZSwgdGhpcy5yb290LCB0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgIHRoaXMub25jZSgncHJlcmVuZGVyJywgdGhpcy5fZmlyc3RCYXRjaCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGtleWJvYXJkIGRldmljZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQva2V5Ym9hcmQuanMnKS5LZXlib2FyZH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMua2V5Ym9hcmQgPSBhcHBPcHRpb25zLmtleWJvYXJkIHx8IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBtb3VzZSBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L21vdXNlLmpzJykuTW91c2V9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm1vdXNlID0gYXBwT3B0aW9ucy5tb3VzZSB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVc2VkIHRvIGdldCB0b3VjaCBldmVudHMgaW5wdXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L3RvdWNoLWRldmljZS5qcycpLlRvdWNoRGV2aWNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50b3VjaCA9IGFwcE9wdGlvbnMudG91Y2ggfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBhY2Nlc3MgR2FtZVBhZCBpbnB1dC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQvZ2FtZS1wYWRzLmpzJykuR2FtZVBhZHN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdhbWVwYWRzID0gYXBwT3B0aW9ucy5nYW1lcGFkcyB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVc2VkIHRvIGhhbmRsZSBpbnB1dCBmb3Ige0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9pbnB1dC9lbGVtZW50LWlucHV0LmpzJykuRWxlbWVudElucHV0fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQgPSBhcHBPcHRpb25zLmVsZW1lbnRJbnB1dCB8fCBudWxsO1xuICAgICAgICBpZiAodGhpcy5lbGVtZW50SW5wdXQpXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dC5hcHAgPSB0aGlzO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgWFIgTWFuYWdlciB0aGF0IHByb3ZpZGVzIGFiaWxpdHkgdG8gc3RhcnQgVlIvQVIgc2Vzc2lvbnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHIveHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gY2hlY2sgaWYgVlIgaXMgYXZhaWxhYmxlXG4gICAgICAgICAqIGlmIChhcHAueHIuaXNBdmFpbGFibGUocGMuWFJUWVBFX1ZSKSkge1xuICAgICAgICAgKiAgICAgLy8gVlIgaXMgYXZhaWxhYmxlXG4gICAgICAgICAqIH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMueHIgPSBhcHBPcHRpb25zLnhyID8gbmV3IGFwcE9wdGlvbnMueHIodGhpcykgOiBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRJbnB1dClcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudElucHV0LmF0dGFjaFNlbGVjdEV2ZW50cygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faW5Ub29scyA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7QXNzZXR8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NreWJveEFzc2V0ID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2NyaXB0UHJlZml4ID0gYXBwT3B0aW9ucy5zY3JpcHRQcmVmaXggfHwgJyc7XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlQnVuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIuYWRkSGFuZGxlcihcImJ1bmRsZVwiLCBuZXcgQnVuZGxlSGFuZGxlcih0aGlzKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgYW5kIHJlZ2lzdGVyIGFsbCByZXF1aXJlZCByZXNvdXJjZSBoYW5kbGVyc1xuICAgICAgICBhcHBPcHRpb25zLnJlc291cmNlSGFuZGxlcnMuZm9yRWFjaCgocmVzb3VyY2VIYW5kbGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gbmV3IHJlc291cmNlSGFuZGxlcih0aGlzKTtcbiAgICAgICAgICAgIHRoaXMubG9hZGVyLmFkZEhhbmRsZXIoaGFuZGxlci5oYW5kbGVyVHlwZSwgaGFuZGxlcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBjb21wb25lbnQgc3lzdGVtIHJlZ2lzdHJ5LiBUaGUgQXBwbGljYXRpb24gY29uc3RydWN0b3IgYWRkcyB0aGVcbiAgICAgICAgICogZm9sbG93aW5nIGNvbXBvbmVudCBzeXN0ZW1zIHRvIGl0cyBjb21wb25lbnQgc3lzdGVtIHJlZ2lzdHJ5OlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIGFuaW0gKHtAbGluayBBbmltQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBhbmltYXRpb24gKHtAbGluayBBbmltYXRpb25Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGF1ZGlvbGlzdGVuZXIgKHtAbGluayBBdWRpb0xpc3RlbmVyQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBidXR0b24gKHtAbGluayBCdXR0b25Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGNhbWVyYSAoe0BsaW5rIENhbWVyYUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gY29sbGlzaW9uICh7QGxpbmsgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBlbGVtZW50ICh7QGxpbmsgRWxlbWVudENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbGF5b3V0Y2hpbGQgKHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbGF5b3V0Z3JvdXAgKHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbGlnaHQgKHtAbGluayBMaWdodENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbW9kZWwgKHtAbGluayBNb2RlbENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gcGFydGljbGVzeXN0ZW0gKHtAbGluayBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gcmlnaWRib2R5ICh7QGxpbmsgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSByZW5kZXIgKHtAbGluayBSZW5kZXJDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcmVlbiAoe0BsaW5rIFNjcmVlbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2NyaXB0ICh7QGxpbmsgU2NyaXB0Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JvbGxiYXIgKHtAbGluayBTY3JvbGxiYXJDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcm9sbHZpZXcgKHtAbGluayBTY3JvbGxWaWV3Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzb3VuZCAoe0BsaW5rIFNvdW5kQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzcHJpdGUgKHtAbGluayBTcHJpdGVDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Q29tcG9uZW50U3lzdGVtUmVnaXN0cnl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCBnbG9iYWwgZ3Jhdml0eSB0byB6ZXJvXG4gICAgICAgICAqIHRoaXMuYXBwLnN5c3RlbXMucmlnaWRib2R5LmdyYXZpdHkuc2V0KDAsIDAsIDApO1xuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgdGhlIGdsb2JhbCBzb3VuZCB2b2x1bWUgdG8gNTAlXG4gICAgICAgICAqIHRoaXMuYXBwLnN5c3RlbXMuc291bmQudm9sdW1lID0gMC41O1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zeXN0ZW1zID0gbmV3IENvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5KCk7XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCByZWdpc3RlciBhbGwgcmVxdWlyZWQgY29tcG9uZW50IHN5c3RlbXNcbiAgICAgICAgYXBwT3B0aW9ucy5jb21wb25lbnRTeXN0ZW1zLmZvckVhY2goKGNvbXBvbmVudFN5c3RlbSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLmFkZChuZXcgY29tcG9uZW50U3lzdGVtKHRoaXMpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyID0gdGhpcy5vblZpc2liaWxpdHlDaGFuZ2UuYmluZCh0aGlzKTtcblxuICAgICAgICAvLyBEZXBlbmRpbmcgb24gYnJvd3NlciBhZGQgdGhlIGNvcnJlY3QgdmlzaWJpbGl0eWNoYW5nZSBldmVudCBhbmQgc3RvcmUgdGhlIG5hbWUgb2YgdGhlXG4gICAgICAgIC8vIGhpZGRlbiBhdHRyaWJ1dGUgaW4gdGhpcy5faGlkZGVuQXR0ci5cbiAgICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5oaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnaGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQubW96SGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ21vekhpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW96dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRvY3VtZW50Lm1zSGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ21zSGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtc3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkb2N1bWVudC53ZWJraXRIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnd2Via2l0SGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd3ZWJraXR2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGJpbmQgdGljayBmdW5jdGlvbiB0byBjdXJyZW50IHNjb3BlXG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZSAqL1xuICAgICAgICB0aGlzLnRpY2sgPSBtYWtlVGljayh0aGlzKTsgLy8gQ2lyY3VsYXIgbGludGluZyBpc3N1ZSBhcyBtYWtlVGljayBhbmQgQXBwbGljYXRpb24gcmVmZXJlbmNlIGVhY2ggb3RoZXJcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbmFtZSBhcHBcbiAgICAgKiBAdHlwZSB7QXBwQmFzZXx1bmRlZmluZWR9XG4gICAgICogQGRlc2NyaXB0aW9uIEdldHMgdGhlIGN1cnJlbnQgYXBwbGljYXRpb24sIGlmIGFueS5cbiAgICAgKi9cblxuICAgIHN0YXRpYyBfYXBwbGljYXRpb25zID0ge307XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGN1cnJlbnQgYXBwbGljYXRpb24uIEluIHRoZSBjYXNlIHdoZXJlIHRoZXJlIGFyZSBtdWx0aXBsZSBydW5uaW5nIGFwcGxpY2F0aW9ucywgdGhlXG4gICAgICogZnVuY3Rpb24gY2FuIGdldCBhbiBhcHBsaWNhdGlvbiBiYXNlZCBvbiBhIHN1cHBsaWVkIGNhbnZhcyBpZC4gVGhpcyBmdW5jdGlvbiBpcyBwYXJ0aWN1bGFybHlcbiAgICAgKiB1c2VmdWwgd2hlbiB0aGUgY3VycmVudCBBcHBsaWNhdGlvbiBpcyBub3QgcmVhZGlseSBhdmFpbGFibGUuIEZvciBleGFtcGxlLCBpbiB0aGUgSmF2YVNjcmlwdFxuICAgICAqIGNvbnNvbGUgb2YgdGhlIGJyb3dzZXIncyBkZXZlbG9wZXIgdG9vbHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2lkXSAtIElmIGRlZmluZWQsIHRoZSByZXR1cm5lZCBhcHBsaWNhdGlvbiBzaG91bGQgdXNlIHRoZSBjYW52YXMgd2hpY2ggaGFzXG4gICAgICogdGhpcyBpZC4gT3RoZXJ3aXNlIGN1cnJlbnQgYXBwbGljYXRpb24gd2lsbCBiZSByZXR1cm5lZC5cbiAgICAgKiBAcmV0dXJucyB7QXBwQmFzZXx1bmRlZmluZWR9IFRoZSBydW5uaW5nIGFwcGxpY2F0aW9uLCBpZiBhbnkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhcHAgPSBwYy5BcHBCYXNlLmdldEFwcGxpY2F0aW9uKCk7XG4gICAgICovXG4gICAgc3RhdGljIGdldEFwcGxpY2F0aW9uKGlkKSB7XG4gICAgICAgIHJldHVybiBpZCA/IEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tpZF0gOiBnZXRBcHBsaWNhdGlvbigpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9pbml0RGVmYXVsdE1hdGVyaWFsKCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSBcIkRlZmF1bHQgTWF0ZXJpYWxcIjtcbiAgICAgICAgbWF0ZXJpYWwuc2hhZGluZ01vZGVsID0gU1BFQ1VMQVJfQkxJTk47XG4gICAgICAgIHNldERlZmF1bHRNYXRlcmlhbCh0aGlzLmdyYXBoaWNzRGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2luaXRQcm9ncmFtTGlicmFyeSgpIHtcbiAgICAgICAgY29uc3QgbGlicmFyeSA9IG5ldyBQcm9ncmFtTGlicmFyeSh0aGlzLmdyYXBoaWNzRGV2aWNlLCBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpKTtcbiAgICAgICAgc2V0UHJvZ3JhbUxpYnJhcnkodGhpcy5ncmFwaGljc0RldmljZSwgbGlicmFyeSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHNvdW5kTWFuYWdlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NvdW5kTWFuYWdlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBiYXRjaCBtYW5hZ2VyLiBUaGUgYmF0Y2ggbWFuYWdlciBpcyB1c2VkIHRvIG1lcmdlIG1lc2ggaW5zdGFuY2VzIGluXG4gICAgICogdGhlIHNjZW5lLCB3aGljaCByZWR1Y2VzIHRoZSBvdmVyYWxsIG51bWJlciBvZiBkcmF3IGNhbGxzLCB0aGVyZWJ5IGJvb3N0aW5nIHBlcmZvcm1hbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtbWFuYWdlci5qcycpLkJhdGNoTWFuYWdlcn1cbiAgICAgKi9cbiAgICBnZXQgYmF0Y2hlcigpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuX2JhdGNoZXIsIFwiQmF0Y2hNYW5hZ2VyIGhhcyBub3QgYmVlbiBjcmVhdGVkIGFuZCBpcyByZXF1aXJlZCBmb3IgY29ycmVjdCBmdW5jdGlvbmFsaXR5LlwiKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgZmlsbCBtb2RlIG9mIHRoZSBjYW52YXMuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX05PTkV9OiB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0ZJTExfV0lORE9XfTogdGhlIGNhbnZhcyB3aWxsIHNpbXBseSBmaWxsIHRoZSB3aW5kb3csIGNoYW5naW5nIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9LRUVQX0FTUEVDVH06IHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0IGNhbiB3aGlsZVxuICAgICAqIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCBmaWxsTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbGxNb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IHJlc29sdXRpb24gbW9kZSBvZiB0aGUgY2FudmFzLCBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0FVVE99OiBpZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBub3QgcHJvdmlkZWQsIGNhbnZhcyB3aWxsIGJlIHJlc2l6ZWQgdG9cbiAgICAgKiBtYXRjaCBjYW52YXMgY2xpZW50IHNpemUuXG4gICAgICogLSB7QGxpbmsgUkVTT0xVVElPTl9GSVhFRH06IHJlc29sdXRpb24gb2YgY2FudmFzIHdpbGwgYmUgZml4ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCByZXNvbHV0aW9uTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc29sdXRpb25Nb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgdGhlIGFwcGxpY2F0aW9uIGNvbmZpZ3VyYXRpb24gZmlsZSBhbmQgYXBwbHkgYXBwbGljYXRpb24gcHJvcGVydGllcyBhbmQgZmlsbCB0aGUgYXNzZXRcbiAgICAgKiByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIG9mIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0NvbmZpZ3VyZUFwcENhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgY29uZmlndXJhdGlvbiBmaWxlIGlzXG4gICAgICogbG9hZGVkIGFuZCBwYXJzZWQgKG9yIGFuIGVycm9yIG9jY3VycykuXG4gICAgICovXG4gICAgY29uZmlndXJlKHVybCwgY2FsbGJhY2spIHtcbiAgICAgICAgaHR0cC5nZXQodXJsLCAoZXJyLCByZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcm9wcyA9IHJlc3BvbnNlLmFwcGxpY2F0aW9uX3Byb3BlcnRpZXM7XG4gICAgICAgICAgICBjb25zdCBzY2VuZXMgPSByZXNwb25zZS5zY2VuZXM7XG4gICAgICAgICAgICBjb25zdCBhc3NldHMgPSByZXNwb25zZS5hc3NldHM7XG5cbiAgICAgICAgICAgIHRoaXMuX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzKHByb3BzLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VTY2VuZXMoc2NlbmVzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFzc2V0cyhhc3NldHMpO1xuICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYWxsIGFzc2V0cyBpbiB0aGUgYXNzZXQgcmVnaXN0cnkgdGhhdCBhcmUgbWFya2VkIGFzICdwcmVsb2FkJy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UHJlbG9hZEFwcENhbGxiYWNrfSBjYWxsYmFjayAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIGFsbCBhc3NldHMgYXJlIGxvYWRlZC5cbiAgICAgKi9cbiAgICBwcmVsb2FkKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6c3RhcnRcIik7XG5cbiAgICAgICAgLy8gZ2V0IGxpc3Qgb2YgYXNzZXRzIHRvIHByZWxvYWRcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5hc3NldHMubGlzdCh7XG4gICAgICAgICAgICBwcmVsb2FkOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKGFzc2V0cy5sZW5ndGgpO1xuXG4gICAgICAgIGxldCBfZG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGNoZWNrIGlmIGFsbCBsb2FkaW5nIGlzIGRvbmVcbiAgICAgICAgY29uc3QgZG9uZSA9ICgpID0+IHtcbiAgICAgICAgICAgIC8vIGRvIG5vdCBwcm9jZWVkIGlmIGFwcGxpY2F0aW9uIGRlc3Ryb3llZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIV9kb25lICYmIHByb2dyZXNzLmRvbmUoKSkge1xuICAgICAgICAgICAgICAgIF9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoXCJwcmVsb2FkOmVuZFwiKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHRvdGFscyBsb2FkaW5nIHByb2dyZXNzIG9mIGFzc2V0c1xuICAgICAgICBjb25zdCB0b3RhbCA9IGFzc2V0cy5sZW5ndGg7XG5cbiAgICAgICAgaWYgKHByb2dyZXNzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3Qgb25Bc3NldExvYWQgPSAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3ByZWxvYWQ6cHJvZ3Jlc3MnLCBwcm9ncmVzcy5jb3VudCAvIHRvdGFsKTtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG9uQXNzZXRFcnJvciA9IChlcnIsIGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdwcmVsb2FkOnByb2dyZXNzJywgcHJvZ3Jlc3MuY291bnQgLyB0b3RhbCk7XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MuZG9uZSgpKVxuICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBmb3IgZWFjaCBhc3NldFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0c1tpXS5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2ldLm9uY2UoJ2xvYWQnLCBvbkFzc2V0TG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0c1tpXS5vbmNlKCdlcnJvcicsIG9uQXNzZXRFcnJvcik7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hc3NldHMubG9hZChhc3NldHNbaV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzLmluYygpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoXCJwcmVsb2FkOnByb2dyZXNzXCIsIHByb2dyZXNzLmNvdW50IC8gdG90YWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3ByZWxvYWRTY3JpcHRzKHNjZW5lRGF0YSwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCFzY3JpcHQubGVnYWN5KSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBzY3JpcHRzID0gdGhpcy5fZ2V0U2NyaXB0UmVmZXJlbmNlcyhzY2VuZURhdGEpO1xuXG4gICAgICAgIGNvbnN0IGwgPSBzY3JpcHRzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MobCk7XG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gL15odHRwKHMpPzpcXC9cXC8vO1xuXG4gICAgICAgIGlmIChsKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSAoZXJyLCBTY3JpcHRUeXBlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGxldCBzY3JpcHRVcmwgPSBzY3JpcHRzW2ldO1xuICAgICAgICAgICAgICAgIC8vIHN1cHBvcnQgYWJzb2x1dGUgVVJMcyAoZm9yIG5vdylcbiAgICAgICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3Qoc2NyaXB0VXJsLnRvTG93ZXJDYXNlKCkpICYmIHRoaXMuX3NjcmlwdFByZWZpeClcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0VXJsID0gcGF0aC5qb2luKHRoaXMuX3NjcmlwdFByZWZpeCwgc2NyaXB0c1tpXSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRlci5sb2FkKHNjcmlwdFVybCwgJ3NjcmlwdCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXQgYXBwbGljYXRpb24gcHJvcGVydGllcyBmcm9tIGRhdGEgZmlsZVxuICAgIF9wYXJzZUFwcGxpY2F0aW9uUHJvcGVydGllcyhwcm9wcywgY2FsbGJhY2spIHtcbiAgICAgICAgLy8gY29uZmlndXJlIHJldHJ5aW5nIGFzc2V0c1xuICAgICAgICBpZiAodHlwZW9mIHByb3BzLm1heEFzc2V0UmV0cmllcyA9PT0gJ251bWJlcicgJiYgcHJvcHMubWF4QXNzZXRSZXRyaWVzID4gMCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIuZW5hYmxlUmV0cnkocHJvcHMubWF4QXNzZXRSZXRyaWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIHRlbXBvcmFyeSBibG9jayBhZnRlciBtaWdyYXRpbmcgcHJvcGVydGllc1xuICAgICAgICBpZiAoIXByb3BzLnVzZURldmljZVBpeGVsUmF0aW8pXG4gICAgICAgICAgICBwcm9wcy51c2VEZXZpY2VQaXhlbFJhdGlvID0gcHJvcHMudXNlX2RldmljZV9waXhlbF9yYXRpbztcbiAgICAgICAgaWYgKCFwcm9wcy5yZXNvbHV0aW9uTW9kZSlcbiAgICAgICAgICAgIHByb3BzLnJlc29sdXRpb25Nb2RlID0gcHJvcHMucmVzb2x1dGlvbl9tb2RlO1xuICAgICAgICBpZiAoIXByb3BzLmZpbGxNb2RlKVxuICAgICAgICAgICAgcHJvcHMuZmlsbE1vZGUgPSBwcm9wcy5maWxsX21vZGU7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSBwcm9wcy53aWR0aDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gcHJvcHMuaGVpZ2h0O1xuICAgICAgICBpZiAocHJvcHMudXNlRGV2aWNlUGl4ZWxSYXRpbykge1xuICAgICAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5tYXhQaXhlbFJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldENhbnZhc1Jlc29sdXRpb24ocHJvcHMucmVzb2x1dGlvbk1vZGUsIHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQpO1xuICAgICAgICB0aGlzLnNldENhbnZhc0ZpbGxNb2RlKHByb3BzLmZpbGxNb2RlLCB0aGlzLl93aWR0aCwgdGhpcy5faGVpZ2h0KTtcblxuICAgICAgICAvLyBzZXQgdXAgbGF5ZXJzXG4gICAgICAgIGlmIChwcm9wcy5sYXllcnMgJiYgcHJvcHMubGF5ZXJPcmRlcikge1xuICAgICAgICAgICAgY29uc3QgY29tcG9zaXRpb24gPSBuZXcgTGF5ZXJDb21wb3NpdGlvbihcImFwcGxpY2F0aW9uXCIpO1xuXG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHByb3BzLmxheWVycykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBwcm9wcy5sYXllcnNba2V5XTtcbiAgICAgICAgICAgICAgICBkYXRhLmlkID0gcGFyc2VJbnQoa2V5LCAxMCk7XG4gICAgICAgICAgICAgICAgLy8gZGVwdGggbGF5ZXIgc2hvdWxkIG9ubHkgYmUgZW5hYmxlZCB3aGVuIG5lZWRlZFxuICAgICAgICAgICAgICAgIC8vIGJ5IGluY3JlbWVudGluZyBpdHMgcmVmIGNvdW50ZXJcbiAgICAgICAgICAgICAgICBkYXRhLmVuYWJsZWQgPSBkYXRhLmlkICE9PSBMQVlFUklEX0RFUFRIO1xuICAgICAgICAgICAgICAgIGxheWVyc1trZXldID0gbmV3IExheWVyKGRhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcHJvcHMubGF5ZXJPcmRlci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1YmxheWVyID0gcHJvcHMubGF5ZXJPcmRlcltpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyc1tzdWJsYXllci5sYXllcl07XG4gICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3VibGF5ZXIudHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9zaXRpb24ucHVzaFRyYW5zcGFyZW50KGxheWVyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5wdXNoT3BhcXVlKGxheWVyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5zdWJMYXllckVuYWJsZWRbaV0gPSBzdWJsYXllci5lbmFibGVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNjZW5lLmxheWVycyA9IGNvbXBvc2l0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIGJhdGNoIGdyb3Vwc1xuICAgICAgICBpZiAocHJvcHMuYmF0Y2hHcm91cHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoZXIgPSB0aGlzLmJhdGNoZXI7XG4gICAgICAgICAgICBpZiAoYmF0Y2hlcikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wcy5iYXRjaEdyb3Vwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBncnAgPSBwcm9wcy5iYXRjaEdyb3Vwc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgYmF0Y2hlci5hZGRHcm91cChncnAubmFtZSwgZ3JwLmR5bmFtaWMsIGdycC5tYXhBYWJiU2l6ZSwgZ3JwLmlkLCBncnAubGF5ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgbG9jYWxpemF0aW9uIGFzc2V0c1xuICAgICAgICBpZiAocHJvcHMuaTE4bkFzc2V0cykge1xuICAgICAgICAgICAgdGhpcy5pMThuLmFzc2V0cyA9IHByb3BzLmkxOG5Bc3NldHM7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2FkTGlicmFyaWVzKHByb3BzLmxpYnJhcmllcywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IHVybHMgLSBMaXN0IG9mIFVSTHMgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIENhbGxiYWNrIGZ1bmN0aW9uLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvYWRMaWJyYXJpZXModXJscywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbGVuID0gdXJscy5sZW5ndGg7XG4gICAgICAgIGxldCBjb3VudCA9IGxlbjtcblxuICAgICAgICBjb25zdCByZWdleCA9IC9eaHR0cChzKT86XFwvXFwvLztcblxuICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSAoZXJyLCBzY3JpcHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb3VudC0tO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgICAgIGxldCB1cmwgPSB1cmxzW2ldO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFyZWdleC50ZXN0KHVybC50b0xvd2VyQ2FzZSgpKSAmJiB0aGlzLl9zY3JpcHRQcmVmaXgpXG4gICAgICAgICAgICAgICAgICAgIHVybCA9IHBhdGguam9pbih0aGlzLl9zY3JpcHRQcmVmaXgsIHVybCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwgJ3NjcmlwdCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm9uTGlicmFyaWVzTG9hZGVkKCk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydCBzY2VuZSBuYW1lL3VybHMgaW50byB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHNjZW5lcyAtIFNjZW5lcyB0byBhZGQgdG8gdGhlIHNjZW5lIHJlZ2lzdHJ5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlU2NlbmVzKHNjZW5lcykge1xuICAgICAgICBpZiAoIXNjZW5lcykgcmV0dXJuO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NlbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lcy5hZGQoc2NlbmVzW2ldLm5hbWUsIHNjZW5lc1tpXS51cmwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IGFzc2V0cyBpbnRvIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSBhc3NldHMgLSBBc3NldHMgdG8gaW5zZXJ0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlQXNzZXRzKGFzc2V0cykge1xuICAgICAgICBjb25zdCBsaXN0ID0gW107XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0c0luZGV4ID0ge307XG4gICAgICAgIGNvbnN0IGJ1bmRsZXNJbmRleCA9IHt9O1xuXG4gICAgICAgIGlmICghc2NyaXB0LmxlZ2FjeSkge1xuICAgICAgICAgICAgLy8gYWRkIHNjcmlwdHMgaW4gb3JkZXIgb2YgbG9hZGluZyBmaXJzdFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNjcmlwdHNPcmRlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gdGhpcy5zY3JpcHRzT3JkZXJbaV07XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldHNbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIHNjcmlwdHNJbmRleFtpZF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgYnVuZGxlc1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlQnVuZGxlcykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldHNbaWRdLnR5cGUgPT09ICdidW5kbGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidW5kbGVzSW5kZXhbaWRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgcmVzdCBvZiBhc3NldHNcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdHNJbmRleFtpZF0gfHwgYnVuZGxlc0luZGV4W2lkXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIGJ1bmRsZXNcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRzW2lkXS50eXBlID09PSAnYnVuZGxlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVuZGxlc0luZGV4W2lkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRoZW4gYWRkIHJlc3Qgb2YgYXNzZXRzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgIGlmIChidW5kbGVzSW5kZXhbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGxpc3RbaV07XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IG5ldyBBc3NldChkYXRhLm5hbWUsIGRhdGEudHlwZSwgZGF0YS5maWxlLCBkYXRhLmRhdGEpO1xuICAgICAgICAgICAgYXNzZXQuaWQgPSBwYXJzZUludChkYXRhLmlkLCAxMCk7XG4gICAgICAgICAgICBhc3NldC5wcmVsb2FkID0gZGF0YS5wcmVsb2FkID8gZGF0YS5wcmVsb2FkIDogZmFsc2U7XG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGEgc2NyaXB0IGFzc2V0IGFuZCBoYXMgYWxyZWFkeSBiZWVuIGVtYmVkZGVkIGluIHRoZSBwYWdlIHRoZW5cbiAgICAgICAgICAgIC8vIG1hcmsgaXQgYXMgbG9hZGVkXG4gICAgICAgICAgICBhc3NldC5sb2FkZWQgPSBkYXRhLnR5cGUgPT09ICdzY3JpcHQnICYmIGRhdGEuZGF0YSAmJiBkYXRhLmRhdGEubG9hZGluZ1R5cGUgPiAwO1xuICAgICAgICAgICAgLy8gdGFnc1xuICAgICAgICAgICAgYXNzZXQudGFncy5hZGQoZGF0YS50YWdzKTtcbiAgICAgICAgICAgIC8vIGkxOG5cbiAgICAgICAgICAgIGlmIChkYXRhLmkxOG4pIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxvY2FsZSBpbiBkYXRhLmkxOG4pIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQuYWRkTG9jYWxpemVkQXNzZXRJZChsb2NhbGUsIGRhdGEuaTE4bltsb2NhbGVdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyByZWdpc3RyeVxuICAgICAgICAgICAgdGhpcy5hc3NldHMuYWRkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gLSBUaGUgbGlzdCBvZiBzY3JpcHRzIHRoYXQgYXJlIHJlZmVyZW5jZWQgYnkgdGhlIHNjZW5lLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFNjcmlwdFJlZmVyZW5jZXMoc2NlbmUpIHtcbiAgICAgICAgbGV0IHByaW9yaXR5U2NyaXB0cyA9IFtdO1xuICAgICAgICBpZiAoc2NlbmUuc2V0dGluZ3MucHJpb3JpdHlfc2NyaXB0cykge1xuICAgICAgICAgICAgcHJpb3JpdHlTY3JpcHRzID0gc2NlbmUuc2V0dGluZ3MucHJpb3JpdHlfc2NyaXB0cztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IF9zY3JpcHRzID0gW107XG4gICAgICAgIGNvbnN0IF9pbmRleCA9IHt9O1xuXG4gICAgICAgIC8vIGZpcnN0IGFkZCBwcmlvcml0eSBzY3JpcHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJpb3JpdHlTY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBfc2NyaXB0cy5wdXNoKHByaW9yaXR5U2NyaXB0c1tpXSk7XG4gICAgICAgICAgICBfaW5kZXhbcHJpb3JpdHlTY3JpcHRzW2ldXSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0aGVuIGl0ZXJhdGUgaGllcmFyY2h5IHRvIGdldCByZWZlcmVuY2VkIHNjcmlwdHNcbiAgICAgICAgY29uc3QgZW50aXRpZXMgPSBzY2VuZS5lbnRpdGllcztcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZW50aXRpZXMpIHtcbiAgICAgICAgICAgIGlmICghZW50aXRpZXNba2V5XS5jb21wb25lbnRzLnNjcmlwdCkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzY3JpcHRzID0gZW50aXRpZXNba2V5XS5jb21wb25lbnRzLnNjcmlwdC5zY3JpcHRzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKF9pbmRleFtzY3JpcHRzW2ldLnVybF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIF9zY3JpcHRzLnB1c2goc2NyaXB0c1tpXS51cmwpO1xuICAgICAgICAgICAgICAgIF9pbmRleFtzY3JpcHRzW2ldLnVybF0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9zY3JpcHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IHRoZSBhcHBsaWNhdGlvbi4gVGhpcyBmdW5jdGlvbiBkb2VzIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAxLiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ3N0YXJ0J1xuICAgICAqIDIuIENhbGxzIGluaXRpYWxpemUgZm9yIGFsbCBjb21wb25lbnRzIG9uIGVudGl0aWVzIGluIHRoZSBoaWVyYXJjaHlcbiAgICAgKiAzLiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ2luaXRpYWxpemUnXG4gICAgICogNC4gQ2FsbHMgcG9zdEluaXRpYWxpemUgZm9yIGFsbCBjb21wb25lbnRzIG9uIGVudGl0aWVzIGluIHRoZSBoaWVyYXJjaHlcbiAgICAgKiA1LiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ3Bvc3Rpbml0aWFsaXplJ1xuICAgICAqIDYuIFN0YXJ0cyBleGVjdXRpbmcgdGhlIG1haW4gbG9vcCBvZiB0aGUgYXBwbGljYXRpb25cbiAgICAgKlxuICAgICAqIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGludGVybmFsbHkgYnkgUGxheUNhbnZhcyBhcHBsaWNhdGlvbnMgbWFkZSBpbiB0aGUgRWRpdG9yIGJ1dCB5b3VcbiAgICAgKiB3aWxsIG5lZWQgdG8gY2FsbCBzdGFydCB5b3Vyc2VsZiBpZiB5b3UgYXJlIHVzaW5nIHRoZSBlbmdpbmUgc3RhbmQtYWxvbmUuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5zdGFydCgpO1xuICAgICAqL1xuICAgIHN0YXJ0KCkge1xuXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLl9hbHJlYWR5U3RhcnRlZCwgXCJUaGUgYXBwbGljYXRpb24gY2FuIGJlIHN0YXJ0ZWQgb25seSBvbmUgdGltZS5cIik7XG4gICAgICAgICAgICB0aGlzLl9hbHJlYWR5U3RhcnRlZCA9IHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuXG4gICAgICAgIHRoaXMuZmlyZShcInN0YXJ0XCIsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbm93KCksXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9saWJyYXJpZXNMb2FkZWQpIHtcbiAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdpbml0aWFsaXplJywgdGhpcy5yb290KTtcbiAgICAgICAgdGhpcy5maXJlKCdpbml0aWFsaXplJyk7XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ3Bvc3RJbml0aWFsaXplJywgdGhpcy5yb290KTtcbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ3Bvc3RQb3N0SW5pdGlhbGl6ZScsIHRoaXMucm9vdCk7XG4gICAgICAgIHRoaXMuZmlyZSgncG9zdGluaXRpYWxpemUnKTtcblxuICAgICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgYWxsIGlucHV0IGRldmljZXMgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgdGltZSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IHVwZGF0ZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGlucHV0VXBkYXRlKGR0KSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci51cGRhdGUoZHQpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm1vdXNlKSB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmtleWJvYXJkKSB7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmdhbWVwYWRzKSB7XG4gICAgICAgICAgICB0aGlzLmdhbWVwYWRzLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSBhcHBsaWNhdGlvbi4gVGhpcyBmdW5jdGlvbiB3aWxsIGNhbGwgdGhlIHVwZGF0ZSBmdW5jdGlvbnMgYW5kIHRoZW4gdGhlIHBvc3RVcGRhdGVcbiAgICAgKiBmdW5jdGlvbnMgb2YgYWxsIGVuYWJsZWQgY29tcG9uZW50cy4gSXQgd2lsbCB0aGVuIHVwZGF0ZSB0aGUgY3VycmVudCBzdGF0ZSBvZiBhbGwgY29ubmVjdGVkXG4gICAgICogaW5wdXQgZGV2aWNlcy4gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgaW50ZXJuYWxseSBpbiB0aGUgYXBwbGljYXRpb24ncyBtYWluIGxvb3AgYW5kIGRvZXNcbiAgICAgKiBub3QgbmVlZCB0byBiZSBjYWxsZWQgZXhwbGljaXRseS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGRlbHRhIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICovXG4gICAgdXBkYXRlKGR0KSB7XG4gICAgICAgIHRoaXMuZnJhbWUrKztcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLnVwZGF0ZUNsaWVudFJlY3QoKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUudXBkYXRlU3RhcnQgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gUGVyZm9ybSBDb21wb25lbnRTeXN0ZW0gdXBkYXRlXG4gICAgICAgIGlmIChzY3JpcHQubGVnYWN5KVxuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ2ZpeGVkVXBkYXRlJywgMS4wIC8gNjAuMCk7XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUodGhpcy5faW5Ub29scyA/ICd0b29sc1VwZGF0ZScgOiAndXBkYXRlJywgZHQpO1xuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgnYW5pbWF0aW9uVXBkYXRlJywgZHQpO1xuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgncG9zdFVwZGF0ZScsIGR0KTtcblxuICAgICAgICAvLyBmaXJlIHVwZGF0ZSBldmVudFxuICAgICAgICB0aGlzLmZpcmUoXCJ1cGRhdGVcIiwgZHQpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnB1dCBkZXZpY2VzXG4gICAgICAgIHRoaXMuaW5wdXRVcGRhdGUoZHQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS51cGRhdGVUaW1lID0gbm93KCkgLSB0aGlzLnN0YXRzLmZyYW1lLnVwZGF0ZVN0YXJ0O1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBmcmFtZVN0YXJ0KCkge1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmZyYW1lU3RhcnQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXIgdGhlIGFwcGxpY2F0aW9uJ3Mgc2NlbmUuIE1vcmUgc3BlY2lmaWNhbGx5LCB0aGUgc2NlbmUncyB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0gaXNcbiAgICAgKiByZW5kZXJlZC4gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgaW50ZXJuYWxseSBpbiB0aGUgYXBwbGljYXRpb24ncyBtYWluIGxvb3AgYW5kIGRvZXMgbm90XG4gICAgICogbmVlZCB0byBiZSBjYWxsZWQgZXhwbGljaXRseS5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICByZW5kZXIoKSB7XG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS5yZW5kZXJTdGFydCA9IG5vdygpO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICB0aGlzLmZpcmUoJ3ByZXJlbmRlcicpO1xuICAgICAgICB0aGlzLnJvb3Quc3luY0hpZXJhcmNoeSgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaGVyKSB7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaGVyLnVwZGF0ZUFsbCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICBGb3J3YXJkUmVuZGVyZXIuX3NraXBSZW5kZXJDb3VudGVyID0gMDtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gcmVuZGVyIHRoZSBzY2VuZSBjb21wb3NpdGlvblxuICAgICAgICB0aGlzLnJlbmRlckNvbXBvc2l0aW9uKHRoaXMuc2NlbmUubGF5ZXJzKTtcblxuICAgICAgICB0aGlzLmZpcmUoJ3Bvc3RyZW5kZXInKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUucmVuZGVyVGltZSA9IG5vdygpIC0gdGhpcy5zdGF0cy5mcmFtZS5yZW5kZXJTdGFydDtcbiAgICAgICAgLy8gI2VuZGlmXG4gICAgfVxuXG4gICAgLy8gcmVuZGVyIGEgbGF5ZXIgY29tcG9zaXRpb25cbiAgICByZW5kZXJDb21wb3NpdGlvbihsYXllckNvbXBvc2l0aW9uKSB7XG4gICAgICAgIERlYnVnR3JhcGhpY3MuY2xlYXJHcHVNYXJrZXJzKCk7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuYnVpbGRGcmFtZUdyYXBoKHRoaXMuZnJhbWVHcmFwaCwgbGF5ZXJDb21wb3NpdGlvbik7XG4gICAgICAgIHRoaXMuZnJhbWVHcmFwaC5yZW5kZXIodGhpcy5ncmFwaGljc0RldmljZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5vdyAtIFRoZSB0aW1lc3RhbXAgcGFzc2VkIHRvIHRoZSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUgY2FsbGJhY2suXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR0IC0gVGhlIHRpbWUgZGVsdGEgaW4gc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS4gVGhpcyBpcyBzdWJqZWN0IHRvIHRoZVxuICAgICAqIGFwcGxpY2F0aW9uJ3MgdGltZSBzY2FsZSBhbmQgbWF4IGRlbHRhIHZhbHVlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbXMgLSBUaGUgdGltZSBpbiBtaWxsaXNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZmlsbEZyYW1lU3RhdHNCYXNpYyhub3csIGR0LCBtcykge1xuICAgICAgICAvLyBUaW1pbmcgc3RhdHNcbiAgICAgICAgY29uc3Qgc3RhdHMgPSB0aGlzLnN0YXRzLmZyYW1lO1xuICAgICAgICBzdGF0cy5kdCA9IGR0O1xuICAgICAgICBzdGF0cy5tcyA9IG1zO1xuICAgICAgICBpZiAobm93ID4gc3RhdHMuX3RpbWVUb0NvdW50RnJhbWVzKSB7XG4gICAgICAgICAgICBzdGF0cy5mcHMgPSBzdGF0cy5fZnBzQWNjdW07XG4gICAgICAgICAgICBzdGF0cy5fZnBzQWNjdW0gPSAwO1xuICAgICAgICAgICAgc3RhdHMuX3RpbWVUb0NvdW50RnJhbWVzID0gbm93ICsgMTAwMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXRzLl9mcHNBY2N1bSsrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gdG90YWwgZHJhdyBjYWxsXG4gICAgICAgIHRoaXMuc3RhdHMuZHJhd0NhbGxzLnRvdGFsID0gdGhpcy5ncmFwaGljc0RldmljZS5fZHJhd0NhbGxzUGVyRnJhbWU7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuX2RyYXdDYWxsc1BlckZyYW1lID0gMDtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZmlsbEZyYW1lU3RhdHMoKSB7XG4gICAgICAgIGxldCBzdGF0cyA9IHRoaXMuc3RhdHMuZnJhbWU7XG5cbiAgICAgICAgLy8gUmVuZGVyIHN0YXRzXG4gICAgICAgIHN0YXRzLmNhbWVyYXMgPSB0aGlzLnJlbmRlcmVyLl9jYW1lcmFzUmVuZGVyZWQ7XG4gICAgICAgIHN0YXRzLm1hdGVyaWFscyA9IHRoaXMucmVuZGVyZXIuX21hdGVyaWFsU3dpdGNoZXM7XG4gICAgICAgIHN0YXRzLnNoYWRlcnMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy5zaGFkb3dNYXBVcGRhdGVzID0gdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcztcbiAgICAgICAgc3RhdHMuc2hhZG93TWFwVGltZSA9IHRoaXMucmVuZGVyZXIuX3NoYWRvd01hcFRpbWU7XG4gICAgICAgIHN0YXRzLmRlcHRoTWFwVGltZSA9IHRoaXMucmVuZGVyZXIuX2RlcHRoTWFwVGltZTtcbiAgICAgICAgc3RhdHMuZm9yd2FyZFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9mb3J3YXJkVGltZTtcbiAgICAgICAgY29uc3QgcHJpbXMgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9wcmltc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy50cmlhbmdsZXMgPSBwcmltc1tQUklNSVRJVkVfVFJJQU5HTEVTXSAvIDMgK1xuICAgICAgICAgICAgTWF0aC5tYXgocHJpbXNbUFJJTUlUSVZFX1RSSVNUUklQXSAtIDIsIDApICtcbiAgICAgICAgICAgIE1hdGgubWF4KHByaW1zW1BSSU1JVElWRV9UUklGQU5dIC0gMiwgMCk7XG4gICAgICAgIHN0YXRzLmN1bGxUaW1lID0gdGhpcy5yZW5kZXJlci5fY3VsbFRpbWU7XG4gICAgICAgIHN0YXRzLnNvcnRUaW1lID0gdGhpcy5yZW5kZXJlci5fc29ydFRpbWU7XG4gICAgICAgIHN0YXRzLnNraW5UaW1lID0gdGhpcy5yZW5kZXJlci5fc2tpblRpbWU7XG4gICAgICAgIHN0YXRzLm1vcnBoVGltZSA9IHRoaXMucmVuZGVyZXIuX21vcnBoVGltZTtcbiAgICAgICAgc3RhdHMubGlnaHRDbHVzdGVycyA9IHRoaXMucmVuZGVyZXIuX2xpZ2h0Q2x1c3RlcnM7XG4gICAgICAgIHN0YXRzLmxpZ2h0Q2x1c3RlcnNUaW1lID0gdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVyc1RpbWU7XG4gICAgICAgIHN0YXRzLm90aGVyUHJpbWl0aXZlcyA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJpbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpIDwgUFJJTUlUSVZFX1RSSUFOR0xFUykge1xuICAgICAgICAgICAgICAgIHN0YXRzLm90aGVyUHJpbWl0aXZlcyArPSBwcmltc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHByaW1zW2ldID0gMDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbmRlcmVyLl9jYW1lcmFzUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9tYXRlcmlhbFN3aXRjaGVzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVXBkYXRlcyA9IDA7XG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9jdWxsVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVyc1RpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zb3J0VGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NraW5UaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbW9ycGhUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2RlcHRoTWFwVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lID0gMDtcblxuICAgICAgICAvLyBEcmF3IGNhbGwgc3RhdHNcbiAgICAgICAgc3RhdHMgPSB0aGlzLnN0YXRzLmRyYXdDYWxscztcbiAgICAgICAgc3RhdHMuZm9yd2FyZCA9IHRoaXMucmVuZGVyZXIuX2ZvcndhcmREcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLmN1bGxlZCA9IHRoaXMucmVuZGVyZXIuX251bURyYXdDYWxsc0N1bGxlZDtcbiAgICAgICAgc3RhdHMuZGVwdGggPSAwO1xuICAgICAgICBzdGF0cy5zaGFkb3cgPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dEcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLnNraW5uZWQgPSB0aGlzLnJlbmRlcmVyLl9za2luRHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5pbW1lZGlhdGUgPSAwO1xuICAgICAgICBzdGF0cy5pbnN0YW5jZWQgPSAwO1xuICAgICAgICBzdGF0cy5yZW1vdmVkQnlJbnN0YW5jaW5nID0gMDtcbiAgICAgICAgc3RhdHMubWlzYyA9IHN0YXRzLnRvdGFsIC0gKHN0YXRzLmZvcndhcmQgKyBzdGF0cy5zaGFkb3cpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9kZXB0aERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NoYWRvd0RyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2ZvcndhcmREcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9udW1EcmF3Q2FsbHNDdWxsZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9za2luRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5faW1tZWRpYXRlUmVuZGVyZWQgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9pbnN0YW5jZWREcmF3Q2FsbHMgPSAwO1xuXG4gICAgICAgIHRoaXMuc3RhdHMubWlzYy5yZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLnJlbmRlclRhcmdldENyZWF0aW9uVGltZTtcblxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHMucGFydGljbGVzO1xuICAgICAgICBzdGF0cy51cGRhdGVzUGVyRnJhbWUgPSBzdGF0cy5fdXBkYXRlc1BlckZyYW1lO1xuICAgICAgICBzdGF0cy5mcmFtZVRpbWUgPSBzdGF0cy5fZnJhbWVUaW1lO1xuICAgICAgICBzdGF0cy5fdXBkYXRlc1BlckZyYW1lID0gMDtcbiAgICAgICAgc3RhdHMuX2ZyYW1lVGltZSA9IDA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29udHJvbHMgaG93IHRoZSBjYW52YXMgZmlsbHMgdGhlIHdpbmRvdyBhbmQgcmVzaXplcyB3aGVuIHRoZSB3aW5kb3cgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIC0gVGhlIG1vZGUgdG8gdXNlIHdoZW4gc2V0dGluZyB0aGUgc2l6ZSBvZiB0aGUgY2FudmFzLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9OT05FfTogdGhlIGNhbnZhcyB3aWxsIGFsd2F5cyBtYXRjaCB0aGUgc2l6ZSBwcm92aWRlZC5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9GSUxMX1dJTkRPV306IHRoZSBjYW52YXMgd2lsbCBzaW1wbHkgZmlsbCB0aGUgd2luZG93LCBjaGFuZ2luZyBhc3BlY3QgcmF0aW8uXG4gICAgICogLSB7QGxpbmsgRklMTE1PREVfS0VFUF9BU1BFQ1R9OiB0aGUgY2FudmFzIHdpbGwgZ3JvdyB0byBmaWxsIHRoZSB3aW5kb3cgYXMgYmVzdCBpdCBjYW4gd2hpbGVcbiAgICAgKiBtYWludGFpbmluZyB0aGUgYXNwZWN0IHJhdGlvLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIGNhbnZhcyAob25seSB1c2VkIHdoZW4gbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0pLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcyAob25seSB1c2VkIHdoZW4gbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0pLlxuICAgICAqL1xuICAgIHNldENhbnZhc0ZpbGxNb2RlKG1vZGUsIHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgdGhpcy5fZmlsbE1vZGUgPSBtb2RlO1xuICAgICAgICB0aGlzLnJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGFuZ2UgdGhlIHJlc29sdXRpb24gb2YgdGhlIGNhbnZhcywgYW5kIHNldCB0aGUgd2F5IGl0IGJlaGF2ZXMgd2hlbiB0aGUgd2luZG93IGlzIHJlc2l6ZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbW9kZSAtIFRoZSBtb2RlIHRvIHVzZSB3aGVuIHNldHRpbmcgdGhlIHJlc29sdXRpb24uIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fQVVUT306IGlmIHdpZHRoIGFuZCBoZWlnaHQgYXJlIG5vdCBwcm92aWRlZCwgY2FudmFzIHdpbGwgYmUgcmVzaXplZCB0b1xuICAgICAqIG1hdGNoIGNhbnZhcyBjbGllbnQgc2l6ZS5cbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0ZJWEVEfTogcmVzb2x1dGlvbiBvZiBjYW52YXMgd2lsbCBiZSBmaXhlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2lkdGhdIC0gVGhlIGhvcml6b250YWwgcmVzb2x1dGlvbiwgb3B0aW9uYWwgaW4gQVVUTyBtb2RlLCBpZiBub3QgcHJvdmlkZWRcbiAgICAgKiBjYW52YXMgY2xpZW50V2lkdGggaXMgdXNlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgdmVydGljYWwgcmVzb2x1dGlvbiwgb3B0aW9uYWwgaW4gQVVUTyBtb2RlLCBpZiBub3QgcHJvdmlkZWRcbiAgICAgKiBjYW52YXMgY2xpZW50SGVpZ2h0IGlzIHVzZWQuXG4gICAgICovXG4gICAgc2V0Q2FudmFzUmVzb2x1dGlvbihtb2RlLCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMuX3Jlc29sdXRpb25Nb2RlID0gbW9kZTtcblxuICAgICAgICAvLyBJbiBBVVRPIG1vZGUgdGhlIHJlc29sdXRpb24gaXMgdGhlIHNhbWUgYXMgdGhlIGNhbnZhcyBzaXplLCB1bmxlc3Mgc3BlY2lmaWVkXG4gICAgICAgIGlmIChtb2RlID09PSBSRVNPTFVUSU9OX0FVVE8gJiYgKHdpZHRoID09PSB1bmRlZmluZWQpKSB7XG4gICAgICAgICAgICB3aWR0aCA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLmNsaWVudFdpZHRoO1xuICAgICAgICAgICAgaGVpZ2h0ID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuY2xpZW50SGVpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5yZXNpemVDYW52YXMod2lkdGgsIGhlaWdodCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUXVlcmllcyB0aGUgdmlzaWJpbGl0eSBvZiB0aGUgd2luZG93IG9yIHRhYiBpbiB3aGljaCB0aGUgYXBwbGljYXRpb24gaXMgcnVubmluZy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBhcHBsaWNhdGlvbiBpcyBub3QgdmlzaWJsZSBhbmQgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGlzSGlkZGVuKCkge1xuICAgICAgICByZXR1cm4gZG9jdW1lbnRbdGhpcy5faGlkZGVuQXR0cl07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIHZpc2liaWxpdHkgc3RhdGUgb2YgdGhlIGN1cnJlbnQgdGFiL3dpbmRvdyBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvblZpc2liaWxpdHlDaGFuZ2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmlzSGlkZGVuKCkpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIuc3VzcGVuZCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NvdW5kTWFuYWdlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5yZXN1bWUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2l6ZSB0aGUgYXBwbGljYXRpb24ncyBjYW52YXMgZWxlbWVudCBpbiBsaW5lIHdpdGggdGhlIGN1cnJlbnQgZmlsbCBtb2RlLlxuICAgICAqXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfS0VFUF9BU1BFQ1R9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0XG4gICAgICogY2FuIHdoaWxlIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICogLSBJbiB7QGxpbmsgRklMTE1PREVfRklMTF9XSU5ET1d9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBzaW1wbHkgZmlsbCB0aGUgd2luZG93LCBjaGFuZ2luZ1xuICAgICAqIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIEluIHtAbGluayBGSUxMTU9ERV9OT05FfSBtb2RlLCB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgd2lkdGggb2YgdGhlIGNhbnZhcy4gT25seSB1c2VkIGlmIGN1cnJlbnQgZmlsbCBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2hlaWdodF0gLSBUaGUgaGVpZ2h0IG9mIHRoZSBjYW52YXMuIE9ubHkgdXNlZCBpZiBjdXJyZW50IGZpbGwgbW9kZSBpcyB7QGxpbmsgRklMTE1PREVfTk9ORX0uXG4gICAgICogQHJldHVybnMge29iamVjdH0gQSBvYmplY3QgY29udGFpbmluZyB0aGUgdmFsdWVzIGNhbGN1bGF0ZWQgdG8gdXNlIGFzIHdpZHRoIGFuZCBoZWlnaHQuXG4gICAgICovXG4gICAgcmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hbGxvd1Jlc2l6ZSkgcmV0dXJuIHVuZGVmaW5lZDsgLy8gcHJldmVudCByZXNpemluZyAoZS5nLiBpZiBwcmVzZW50aW5nIGluIFZSIEhNRClcblxuICAgICAgICAvLyBwcmV2ZW50IHJlc2l6aW5nIHdoZW4gaW4gWFIgc2Vzc2lvblxuICAgICAgICBpZiAodGhpcy54ciAmJiB0aGlzLnhyLnNlc3Npb24pXG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgICAgIGNvbnN0IHdpbmRvd1dpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XG4gICAgICAgIGNvbnN0IHdpbmRvd0hlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcblxuICAgICAgICBpZiAodGhpcy5fZmlsbE1vZGUgPT09IEZJTExNT0RFX0tFRVBfQVNQRUNUKSB7XG4gICAgICAgICAgICBjb25zdCByID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMud2lkdGggLyB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5oZWlnaHQ7XG4gICAgICAgICAgICBjb25zdCB3aW5SID0gd2luZG93V2lkdGggLyB3aW5kb3dIZWlnaHQ7XG5cbiAgICAgICAgICAgIGlmIChyID4gd2luUikge1xuICAgICAgICAgICAgICAgIHdpZHRoID0gd2luZG93V2lkdGg7XG4gICAgICAgICAgICAgICAgaGVpZ2h0ID0gd2lkdGggLyByO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSB3aW5kb3dIZWlnaHQ7XG4gICAgICAgICAgICAgICAgd2lkdGggPSBoZWlnaHQgKiByO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2ZpbGxNb2RlID09PSBGSUxMTU9ERV9GSUxMX1dJTkRPVykge1xuICAgICAgICAgICAgd2lkdGggPSB3aW5kb3dXaWR0aDtcbiAgICAgICAgICAgIGhlaWdodCA9IHdpbmRvd0hlaWdodDtcbiAgICAgICAgfVxuICAgICAgICAvLyBPVEhFUldJU0U6IEZJTExNT0RFX05PTkUgdXNlIHdpZHRoIGFuZCBoZWlnaHQgdGhhdCBhcmUgcHJvdmlkZWRcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5zdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuc3R5bGUuaGVpZ2h0ID0gaGVpZ2h0ICsgJ3B4JztcblxuICAgICAgICB0aGlzLnVwZGF0ZUNhbnZhc1NpemUoKTtcblxuICAgICAgICAvLyByZXR1cm4gdGhlIGZpbmFsIHZhbHVlcyBjYWxjdWxhdGVkIGZvciB3aWR0aCBhbmQgaGVpZ2h0XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFVwZGF0ZXMgdGhlIHtAbGluayBHcmFwaGljc0RldmljZX0gY2FudmFzIHNpemUgdG8gbWF0Y2ggdGhlIGNhbnZhcyBzaXplIG9uIHRoZSBkb2N1bWVudFxuICAgICAqIHBhZ2UuIEl0IGlzIHJlY29tbWVuZGVkIHRvIGNhbGwgdGhpcyBmdW5jdGlvbiB3aGVuIHRoZSBjYW52YXMgc2l6ZSBjaGFuZ2VzIChlLmcgb24gd2luZG93XG4gICAgICogcmVzaXplIGFuZCBvcmllbnRhdGlvbiBjaGFuZ2UgZXZlbnRzKSBzbyB0aGF0IHRoZSBjYW52YXMgcmVzb2x1dGlvbiBpcyBpbW1lZGlhdGVseSB1cGRhdGVkLlxuICAgICAqL1xuICAgIHVwZGF0ZUNhbnZhc1NpemUoKSB7XG4gICAgICAgIC8vIERvbid0IHVwZGF0ZSBpZiB3ZSBhcmUgaW4gVlIgb3IgWFJcbiAgICAgICAgaWYgKCghdGhpcy5fYWxsb3dSZXNpemUpIHx8ICh0aGlzLnhyPy5hY3RpdmUpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJbiBBVVRPIG1vZGUgdGhlIHJlc29sdXRpb24gaXMgY2hhbmdlZCB0byBtYXRjaCB0aGUgY2FudmFzIHNpemVcbiAgICAgICAgaWYgKHRoaXMuX3Jlc29sdXRpb25Nb2RlID09PSBSRVNPTFVUSU9OX0FVVE8pIHtcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSBjYW52YXMgRE9NIGhhcyBjaGFuZ2VkIHNpemVcbiAgICAgICAgICAgIGNvbnN0IGNhbnZhcyA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzO1xuICAgICAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5yZXNpemVDYW52YXMoY2FudmFzLmNsaWVudFdpZHRoLCBjYW52YXMuY2xpZW50SGVpZ2h0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEV2ZW50IGhhbmRsZXIgY2FsbGVkIHdoZW4gYWxsIGNvZGUgbGlicmFyaWVzIGhhdmUgYmVlbiBsb2FkZWQuIENvZGUgbGlicmFyaWVzIGFyZSBwYXNzZWRcbiAgICAgKiBpbnRvIHRoZSBjb25zdHJ1Y3RvciBvZiB0aGUgQXBwbGljYXRpb24gYW5kIHRoZSBhcHBsaWNhdGlvbiB3b24ndCBzdGFydCBydW5uaW5nIG9yIGxvYWRcbiAgICAgKiBwYWNrcyB1bnRpbCBhbGwgbGlicmFyaWVzIGhhdmUgYmVlbiBsb2FkZWQuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGlicmFyaWVzTG9hZGVkKCkge1xuICAgICAgICB0aGlzLl9saWJyYXJpZXNMb2FkZWQgPSB0cnVlO1xuXG4gICAgICAgIGlmICh0aGlzLnN5c3RlbXMucmlnaWRib2R5KSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMucmlnaWRib2R5Lm9uTGlicmFyeUxvYWRlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgc2NlbmUgc2V0dGluZ3MgdG8gdGhlIGN1cnJlbnQgc2NlbmUuIFVzZWZ1bCB3aGVuIHlvdXIgc2NlbmUgc2V0dGluZ3MgYXJlIHBhcnNlZCBvclxuICAgICAqIGdlbmVyYXRlZCBmcm9tIGEgbm9uLVVSTCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2V0dGluZ3MgLSBUaGUgc2NlbmUgc2V0dGluZ3MgdG8gYmUgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2V0dGluZ3MucGh5c2ljcyAtIFRoZSBwaHlzaWNzIHNldHRpbmdzIHRvIGJlIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucGh5c2ljcy5ncmF2aXR5IC0gVGhlIHdvcmxkIHNwYWNlIHZlY3RvciByZXByZXNlbnRpbmcgZ2xvYmFsXG4gICAgICogZ3Jhdml0eSBpbiB0aGUgcGh5c2ljcyBzaW11bGF0aW9uLiBNdXN0IGJlIGEgZml4ZWQgc2l6ZSBhcnJheSB3aXRoIHRocmVlIG51bWJlciBlbGVtZW50cyxcbiAgICAgKiBjb3JyZXNwb25kaW5nIHRvIGVhY2ggYXhpcyBbIFgsIFksIFogXS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gc2V0dGluZ3MucmVuZGVyIC0gVGhlIHJlbmRlcmluZyBzZXR0aW5ncyB0byBiZSBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnJlbmRlci5nbG9iYWxfYW1iaWVudCAtIFRoZSBjb2xvciBvZiB0aGUgc2NlbmUncyBhbWJpZW50IGxpZ2h0LlxuICAgICAqIE11c3QgYmUgYSBmaXhlZCBzaXplIGFycmF5IHdpdGggdGhyZWUgbnVtYmVyIGVsZW1lbnRzLCBjb3JyZXNwb25kaW5nIHRvIGVhY2ggY29sb3IgY2hhbm5lbFxuICAgICAqIFsgUiwgRywgQiBdLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZXR0aW5ncy5yZW5kZXIuZm9nIC0gVGhlIHR5cGUgb2YgZm9nIHVzZWQgYnkgdGhlIHNjZW5lLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBGT0dfTk9ORX1cbiAgICAgKiAtIHtAbGluayBGT0dfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIEZPR19FWFB9XG4gICAgICogLSB7QGxpbmsgRk9HX0VYUDJ9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5yZW5kZXIuZm9nX2NvbG9yIC0gVGhlIGNvbG9yIG9mIHRoZSBmb2cgKGlmIGVuYWJsZWQpLiBNdXN0IGJlIGFcbiAgICAgKiBmaXhlZCBzaXplIGFycmF5IHdpdGggdGhyZWUgbnVtYmVyIGVsZW1lbnRzLCBjb3JyZXNwb25kaW5nIHRvIGVhY2ggY29sb3IgY2hhbm5lbCBbIFIsIEcsIEIgXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmZvZ19kZW5zaXR5IC0gVGhlIGRlbnNpdHkgb2YgdGhlIGZvZyAoaWYgZW5hYmxlZCkuIFRoaXNcbiAgICAgKiBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfRVhQfSBvciB7QGxpbmsgRk9HX0VYUDJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZm9nX3N0YXJ0IC0gVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCB3aGVyZSBsaW5lYXIgZm9nXG4gICAgICogYmVnaW5zLiBUaGlzIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19MSU5FQVJ9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZm9nX2VuZCAtIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgd2hlcmUgbGluZWFyIGZvZ1xuICAgICAqIHJlYWNoZXMgaXRzIG1heGltdW0uIFRoaXMgcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5nYW1tYV9jb3JyZWN0aW9uIC0gVGhlIGdhbW1hIGNvcnJlY3Rpb24gdG8gYXBwbHkgd2hlblxuICAgICAqIHJlbmRlcmluZyB0aGUgc2NlbmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEdBTU1BX05PTkV9XG4gICAgICogLSB7QGxpbmsgR0FNTUFfU1JHQn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIudG9uZW1hcHBpbmcgLSBUaGUgdG9uZW1hcHBpbmcgdHJhbnNmb3JtIHRvIGFwcGx5IHdoZW5cbiAgICAgKiB3cml0aW5nIGZyYWdtZW50cyB0byB0aGUgZnJhbWUgYnVmZmVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0ZJTE1JQ31cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0hFSkx9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9BQ0VTfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5leHBvc3VyZSAtIFRoZSBleHBvc3VyZSB2YWx1ZSB0d2Vha3MgdGhlIG92ZXJhbGwgYnJpZ2h0bmVzc1xuICAgICAqIG9mIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcnxudWxsfSBbc2V0dGluZ3MucmVuZGVyLnNreWJveF0gLSBUaGUgYXNzZXQgSUQgb2YgdGhlIGN1YmUgbWFwIHRleHR1cmUgdG8gYmVcbiAgICAgKiB1c2VkIGFzIHRoZSBzY2VuZSdzIHNreWJveC4gRGVmYXVsdHMgdG8gbnVsbC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnNreWJveEludGVuc2l0eSAtIE11bHRpcGxpZXIgZm9yIHNreWJveCBpbnRlbnNpdHkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5za3lib3hMdW1pbmFuY2UgLSBMdXggKGxtL21eMikgdmFsdWUgZm9yIHNreWJveCBpbnRlbnNpdHkgd2hlbiBwaHlzaWNhbCBsaWdodCB1bml0cyBhcmUgZW5hYmxlZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnNreWJveE1pcCAtIFRoZSBtaXAgbGV2ZWwgb2YgdGhlIHNreWJveCB0byBiZSBkaXNwbGF5ZWQuXG4gICAgICogT25seSB2YWxpZCBmb3IgcHJlZmlsdGVyZWQgY3ViZW1hcCBza3lib3hlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94Um90YXRpb24gLSBSb3RhdGlvbiBvZiBza3lib3guXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodG1hcFNpemVNdWx0aXBsaWVyIC0gVGhlIGxpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbiAtIFRoZSBtYXhpbXVtIGxpZ2h0bWFwIHJlc29sdXRpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodG1hcE1vZGUgLSBUaGUgbGlnaHRtYXAgYmFraW5nIG1vZGUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1J9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXBcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SRElSfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwICsgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uICh1c2VkIGZvciBidW1wL3NwZWN1bGFyKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2UgLSBFbmFibGUgYmFraW5nIGFtYmllbnQgbGlnaHQgaW50byBsaWdodG1hcHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZU51bVNhbXBsZXMgLSBOdW1iZXIgb2Ygc2FtcGxlcyB0byB1c2Ugd2hlbiBiYWtpbmcgYW1iaWVudCBsaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlU3BoZXJlUGFydCAtIEhvdyBtdWNoIG9mIHRoZSBzcGhlcmUgdG8gaW5jbHVkZSB3aGVuIGJha2luZyBhbWJpZW50IGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzIC0gQnJpZ2h0bmVzcyBvZiB0aGUgYmFrZWQgYW1iaWVudCBvY2NsdXNpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0IC0gQ29udHJhc3Qgb2YgdGhlIGJha2VkIGFtYmllbnQgb2NjbHVzaW9uLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEx1bWluYW5jZSAtIEx1eCAobG0vbV4yKSB2YWx1ZSBmb3IgYW1iaWVudCBsaWdodCBpbnRlbnNpdHkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQgLSBFbmFibGUgY2x1c3RlcmVkIGxpZ2h0aW5nLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nU2hhZG93c0VuYWJsZWQgLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgc2hhZG93cy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0Nvb2tpZXNFbmFibGVkIC0gSWYgc2V0IHRvIHRydWUsIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgd2lsbCBzdXBwb3J0IGNvb2tpZSB0ZXh0dXJlcy5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0FyZWFMaWdodHNFbmFibGVkIC0gSWYgc2V0IHRvIHRydWUsIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgd2lsbCBzdXBwb3J0IGFyZWEgbGlnaHRzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdTaGFkb3dBdGxhc1Jlc29sdXRpb24gLSBSZXNvbHV0aW9uIG9mIHRoZSBhdGxhcyB0ZXh0dXJlIHN0b3JpbmcgYWxsIG5vbi1kaXJlY3Rpb25hbCBzaGFkb3cgdGV4dHVyZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ0Nvb2tpZUF0bGFzUmVzb2x1dGlvbiAtIFJlc29sdXRpb24gb2YgdGhlIGF0bGFzIHRleHR1cmUgc3RvcmluZyBhbGwgbm9uLWRpcmVjdGlvbmFsIGNvb2tpZSB0ZXh0dXJlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nTWF4TGlnaHRzUGVyQ2VsbCAtIE1heGltdW0gbnVtYmVyIG9mIGxpZ2h0cyBhIGNlbGwgY2FuIHN0b3JlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdTaGFkb3dUeXBlIC0gVGhlIHR5cGUgb2Ygc2hhZG93IGZpbHRlcmluZyB1c2VkIGJ5IGFsbCBzaGFkb3dzLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBTSEFET1dfUENGMX06IFBDRiAxeDEgc2FtcGxpbmcuXG4gICAgICogLSB7QGxpbmsgU0hBRE9XX1BDRjN9OiBQQ0YgM3gzIHNhbXBsaW5nLlxuICAgICAqIC0ge0BsaW5rIFNIQURPV19QQ0Y1fTogUENGIDV4NSBzYW1wbGluZy4gRmFsbHMgYmFjayB0byB7QGxpbmsgU0hBRE9XX1BDRjN9IG9uIFdlYkdMIDEuMC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQ2VsbHMgLSBOdW1iZXIgb2YgY2VsbHMgYWxvbmcgZWFjaCB3b3JsZC1zcGFjZSBheGlzIHRoZSBzcGFjZSBjb250YWluaW5nIGxpZ2h0c1xuICAgICAqIGlzIHN1YmRpdmlkZWQgaW50by5cbiAgICAgKlxuICAgICAqIE9ubHkgbGlnaHRzIHdpdGggYmFrZURpcj10cnVlIHdpbGwgYmUgdXNlZCBmb3IgZ2VuZXJhdGluZyB0aGUgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uLlxuICAgICAqIEBleGFtcGxlXG4gICAgICpcbiAgICAgKiBjb25zdCBzZXR0aW5ncyA9IHtcbiAgICAgKiAgICAgcGh5c2ljczoge1xuICAgICAqICAgICAgICAgZ3Jhdml0eTogWzAsIC05LjgsIDBdXG4gICAgICogICAgIH0sXG4gICAgICogICAgIHJlbmRlcjoge1xuICAgICAqICAgICAgICAgZm9nX2VuZDogMTAwMCxcbiAgICAgKiAgICAgICAgIHRvbmVtYXBwaW5nOiAwLFxuICAgICAqICAgICAgICAgc2t5Ym94OiBudWxsLFxuICAgICAqICAgICAgICAgZm9nX2RlbnNpdHk6IDAuMDEsXG4gICAgICogICAgICAgICBnYW1tYV9jb3JyZWN0aW9uOiAxLFxuICAgICAqICAgICAgICAgZXhwb3N1cmU6IDEsXG4gICAgICogICAgICAgICBmb2dfc3RhcnQ6IDEsXG4gICAgICogICAgICAgICBnbG9iYWxfYW1iaWVudDogWzAsIDAsIDBdLFxuICAgICAqICAgICAgICAgc2t5Ym94SW50ZW5zaXR5OiAxLFxuICAgICAqICAgICAgICAgc2t5Ym94Um90YXRpb246IFswLCAwLCAwXSxcbiAgICAgKiAgICAgICAgIGZvZ19jb2xvcjogWzAsIDAsIDBdLFxuICAgICAqICAgICAgICAgbGlnaHRtYXBNb2RlOiAxLFxuICAgICAqICAgICAgICAgZm9nOiAnbm9uZScsXG4gICAgICogICAgICAgICBsaWdodG1hcE1heFJlc29sdXRpb246IDIwNDgsXG4gICAgICogICAgICAgICBza3lib3hNaXA6IDIsXG4gICAgICogICAgICAgICBsaWdodG1hcFNpemVNdWx0aXBsaWVyOiAxNlxuICAgICAqICAgICB9XG4gICAgICogfTtcbiAgICAgKiBhcHAuYXBwbHlTY2VuZVNldHRpbmdzKHNldHRpbmdzKTtcbiAgICAgKi9cbiAgICBhcHBseVNjZW5lU2V0dGluZ3Moc2V0dGluZ3MpIHtcbiAgICAgICAgbGV0IGFzc2V0O1xuXG4gICAgICAgIGlmICh0aGlzLnN5c3RlbXMucmlnaWRib2R5ICYmIHR5cGVvZiBBbW1vICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29uc3QgZ3Jhdml0eSA9IHNldHRpbmdzLnBoeXNpY3MuZ3Jhdml0eTtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5yaWdpZGJvZHkuZ3Jhdml0eS5zZXQoZ3Jhdml0eVswXSwgZ3Jhdml0eVsxXSwgZ3Jhdml0eVsyXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNjZW5lLmFwcGx5U2V0dGluZ3Moc2V0dGluZ3MpO1xuXG4gICAgICAgIGlmIChzZXR0aW5ncy5yZW5kZXIuaGFzT3duUHJvcGVydHkoJ3NreWJveCcpKSB7XG4gICAgICAgICAgICBpZiAoc2V0dGluZ3MucmVuZGVyLnNreWJveCkge1xuICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5hc3NldHMuZ2V0KHNldHRpbmdzLnJlbmRlci5za3lib3gpO1xuXG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0U2t5Ym94KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vbmNlKCdhZGQ6JyArIHNldHRpbmdzLnJlbmRlci5za3lib3gsIHRoaXMuc2V0U2t5Ym94LCB0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U2t5Ym94KG51bGwpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgYXJlYSBsaWdodCBMVVQgdGFibGVzIGZvciB0aGlzIGFwcC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGx0Y01hdDEgLSBMVVQgdGFibGUgb2YgdHlwZSBgYXJyYXlgIHRvIGJlIHNldC5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBsdGNNYXQyIC0gTFVUIHRhYmxlIG9mIHR5cGUgYGFycmF5YCB0byBiZSBzZXQuXG4gICAgICovXG4gICAgc2V0QXJlYUxpZ2h0THV0cyhsdGNNYXQxLCBsdGNNYXQyKSB7XG5cbiAgICAgICAgaWYgKGx0Y01hdDEgJiYgbHRjTWF0Mikge1xuICAgICAgICAgICAgQXJlYUxpZ2h0THV0cy5zZXQodGhpcy5ncmFwaGljc0RldmljZSwgbHRjTWF0MSwgbHRjTWF0Mik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuKFwic2V0QXJlYUxpZ2h0THV0czogTFVUcyBmb3IgYXJlYSBsaWdodCBhcmUgbm90IHZhbGlkXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgc2t5Ym94IGFzc2V0IHRvIGN1cnJlbnQgc2NlbmUsIGFuZCBzdWJzY3JpYmVzIHRvIGFzc2V0IGxvYWQvY2hhbmdlIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gQXNzZXQgb2YgdHlwZSBgc2t5Ym94YCB0byBiZSBzZXQgdG8sIG9yIG51bGwgdG8gcmVtb3ZlIHNreWJveC5cbiAgICAgKi9cbiAgICBzZXRTa3lib3goYXNzZXQpIHtcbiAgICAgICAgaWYgKGFzc2V0ICE9PSB0aGlzLl9za3lib3hBc3NldCkge1xuICAgICAgICAgICAgY29uc3Qgb25Ta3lib3hSZW1vdmVkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U2t5Ym94KG51bGwpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3Qgb25Ta3lib3hDaGFuZ2VkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuc2NlbmUuc2V0U2t5Ym94KHRoaXMuX3NreWJveEFzc2V0ID8gdGhpcy5fc2t5Ym94QXNzZXQucmVzb3VyY2VzIDogbnVsbCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBjbGVhbnVwIHByZXZpb3VzIGFzc2V0XG4gICAgICAgICAgICBpZiAodGhpcy5fc2t5Ym94QXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vZmYoJ2xvYWQ6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9mZigncmVtb3ZlOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldC5vZmYoJ2NoYW5nZScsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBuZXcgYXNzZXRcbiAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0ID0gYXNzZXQ7XG4gICAgICAgICAgICBpZiAodGhpcy5fc2t5Ym94QXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vbignbG9hZDonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub25jZSgncmVtb3ZlOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hBc3NldC5vbignY2hhbmdlJywgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNjZW5lLnNreWJveE1pcCA9PT0gMCAmJiAhdGhpcy5fc2t5Ym94QXNzZXQubG9hZEZhY2VzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0LmxvYWRGYWNlcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMubG9hZCh0aGlzLl9za3lib3hBc3NldCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG9uU2t5Ym94Q2hhbmdlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZpcnN0QmFrZSgpIHtcbiAgICAgICAgdGhpcy5saWdodG1hcHBlcj8uYmFrZShudWxsLCB0aGlzLnNjZW5lLmxpZ2h0bWFwTW9kZSk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2ZpcnN0QmF0Y2goKSB7XG4gICAgICAgIHRoaXMuYmF0Y2hlcj8uZ2VuZXJhdGUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm92aWRlIGFuIG9wcG9ydHVuaXR5IHRvIG1vZGlmeSB0aGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdGltZXN0YW1wXSAtIFRoZSB0aW1lc3RhbXAgc3VwcGxpZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ8dW5kZWZpbmVkfSBUaGUgbW9kaWZpZWQgdGltZXN0YW1wLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfcHJvY2Vzc1RpbWVzdGFtcCh0aW1lc3RhbXApIHtcbiAgICAgICAgcmV0dXJuIHRpbWVzdGFtcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHNpbmdsZSBsaW5lLiBMaW5lIHN0YXJ0IGFuZCBlbmQgY29vcmRpbmF0ZXMgYXJlIHNwZWNpZmllZCBpbiB3b3JsZC1zcGFjZS4gVGhlIGxpbmVcbiAgICAgKiB3aWxsIGJlIGZsYXQtc2hhZGVkIHdpdGggdGhlIHNwZWNpZmllZCBjb2xvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM30gc3RhcnQgLSBUaGUgc3RhcnQgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBvZiB0aGUgbGluZS5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGVuZCAtIFRoZSBlbmQgd29ybGQtc3BhY2UgY29vcmRpbmF0ZSBvZiB0aGUgbGluZS5cbiAgICAgKiBAcGFyYW0ge0NvbG9yfSBbY29sb3JdIC0gVGhlIGNvbG9yIG9mIHRoZSBsaW5lLiBJdCBkZWZhdWx0cyB0byB3aGl0ZSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIGxpbmUgaXMgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBsaW5lIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSAxLXVuaXQgbG9uZyB3aGl0ZSBsaW5lXG4gICAgICogY29uc3Qgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBjb25zdCBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd0xpbmUoc3RhcnQsIGVuZCk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSAxLXVuaXQgbG9uZyByZWQgbGluZSB3aGljaCBpcyBub3QgZGVwdGggdGVzdGVkIGFuZCByZW5kZXJzIG9uIHRvcCBvZiBvdGhlciBnZW9tZXRyeVxuICAgICAqIGNvbnN0IHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogY29uc3QgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogYXBwLmRyYXdMaW5lKHN0YXJ0LCBlbmQsIHBjLkNvbG9yLlJFRCwgZmFsc2UpO1xuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgMS11bml0IGxvbmcgd2hpdGUgbGluZSBpbnRvIHRoZSB3b3JsZCBsYXllclxuICAgICAqIGNvbnN0IHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogY29uc3QgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogY29uc3Qgd29ybGRMYXllciA9IGFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHBjLkxBWUVSSURfV09STEQpO1xuICAgICAqIGFwcC5kcmF3TGluZShzdGFydCwgZW5kLCBwYy5Db2xvci5XSElURSwgdHJ1ZSwgd29ybGRMYXllcik7XG4gICAgICovXG4gICAgZHJhd0xpbmUoc3RhcnQsIGVuZCwgY29sb3IsIGRlcHRoVGVzdCwgbGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5kcmF3TGluZShzdGFydCwgZW5kLCBjb2xvciwgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVycyBhbiBhcmJpdHJhcnkgbnVtYmVyIG9mIGRpc2NyZXRlIGxpbmUgc2VnbWVudHMuIFRoZSBsaW5lcyBhcmUgbm90IGNvbm5lY3RlZCBieSBlYWNoXG4gICAgICogc3Vic2VxdWVudCBwb2ludCBpbiB0aGUgYXJyYXkuIEluc3RlYWQsIHRoZXkgYXJlIGluZGl2aWR1YWwgc2VnbWVudHMgc3BlY2lmaWVkIGJ5IHR3b1xuICAgICAqIHBvaW50cy4gVGhlcmVmb3JlLCB0aGUgbGVuZ3RocyBvZiB0aGUgc3VwcGxpZWQgcG9zaXRpb24gYW5kIGNvbG9yIGFycmF5cyBtdXN0IGJlIHRoZSBzYW1lXG4gICAgICogYW5kIGFsc28gbXVzdCBiZSBhIG11bHRpcGxlIG9mIDIuIFRoZSBjb2xvcnMgb2YgdGhlIGVuZHMgb2YgZWFjaCBsaW5lIHNlZ21lbnQgd2lsbCBiZVxuICAgICAqIGludGVycG9sYXRlZCBhbG9uZyB0aGUgbGVuZ3RoIG9mIGVhY2ggbGluZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVjM1tdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiBwb2ludHMgdG8gZHJhdyBsaW5lcyBiZXR3ZWVuLiBUaGUgbGVuZ3RoIG9mIHRoZVxuICAgICAqIGFycmF5IG11c3QgYmUgYSBtdWx0aXBsZSBvZiAyLlxuICAgICAqIEBwYXJhbSB7Q29sb3JbXX0gY29sb3JzIC0gQW4gYXJyYXkgb2YgY29sb3JzIHRvIGNvbG9yIHRoZSBsaW5lcy4gVGhpcyBtdXN0IGJlIHRoZSBzYW1lXG4gICAgICogbGVuZ3RoIGFzIHRoZSBwb3NpdGlvbiBhcnJheS4gVGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgbXVzdCBhbHNvIGJlIGEgbXVsdGlwbGUgb2YgMi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBsaW5lcyBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgc2luZ2xlIGxpbmUsIHdpdGggdW5pcXVlIGNvbG9ycyBmb3IgZWFjaCBwb2ludFxuICAgICAqIGNvbnN0IHN0YXJ0ID0gbmV3IHBjLlZlYzMoMCwgMCwgMCk7XG4gICAgICogY29uc3QgZW5kID0gbmV3IHBjLlZlYzMoMSwgMCwgMCk7XG4gICAgICogYXBwLmRyYXdMaW5lcyhbc3RhcnQsIGVuZF0sIFtwYy5Db2xvci5SRUQsIHBjLkNvbG9yLldISVRFXSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgMiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzXG4gICAgICogY29uc3QgcG9pbnRzID0gW1xuICAgICAqICAgICAvLyBMaW5lIDFcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMCwgMCwgMCksXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDEsIDAsIDApLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMSwgMSwgMCksXG4gICAgICogICAgIG5ldyBwYy5WZWMzKDEsIDEsIDEpXG4gICAgICogXTtcbiAgICAgKiBjb25zdCBjb2xvcnMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICBwYy5Db2xvci5SRUQsXG4gICAgICogICAgIHBjLkNvbG9yLllFTExPVyxcbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIHBjLkNvbG9yLkNZQU4sXG4gICAgICogICAgIHBjLkNvbG9yLkJMVUVcbiAgICAgKiBdO1xuICAgICAqIGFwcC5kcmF3TGluZXMocG9pbnRzLCBjb2xvcnMpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5kcmF3TGluZXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlcnMgYW4gYXJiaXRyYXJ5IG51bWJlciBvZiBkaXNjcmV0ZSBsaW5lIHNlZ21lbnRzLiBUaGUgbGluZXMgYXJlIG5vdCBjb25uZWN0ZWQgYnkgZWFjaFxuICAgICAqIHN1YnNlcXVlbnQgcG9pbnQgaW4gdGhlIGFycmF5LiBJbnN0ZWFkLCB0aGV5IGFyZSBpbmRpdmlkdWFsIHNlZ21lbnRzIHNwZWNpZmllZCBieSB0d29cbiAgICAgKiBwb2ludHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBwb3NpdGlvbnMgLSBBbiBhcnJheSBvZiBwb2ludHMgdG8gZHJhdyBsaW5lcyBiZXR3ZWVuLiBFYWNoIHBvaW50IGlzXG4gICAgICogcmVwcmVzZW50ZWQgYnkgMyBudW1iZXJzIC0geCwgeSBhbmQgeiBjb29yZGluYXRlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGNvbG9ycyAtIEFuIGFycmF5IG9mIGNvbG9ycyB0byBjb2xvciB0aGUgbGluZXMuIFRoaXMgbXVzdCBiZSB0aGUgc2FtZVxuICAgICAqIGxlbmd0aCBhcyB0aGUgcG9zaXRpb24gYXJyYXkuIFRoZSBsZW5ndGggb2YgdGhlIGFycmF5IG11c3QgYWxzbyBiZSBhIG11bHRpcGxlIG9mIDIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZSBkZXB0aFxuICAgICAqIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbGluZXMgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciAyIGRpc2NyZXRlIGxpbmUgc2VnbWVudHNcbiAgICAgKiBjb25zdCBwb2ludHMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICAwLCAwLCAwLFxuICAgICAqICAgICAxLCAwLCAwLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgMSwgMSwgMCxcbiAgICAgKiAgICAgMSwgMSwgMVxuICAgICAqIF07XG4gICAgICogY29uc3QgY29sb3JzID0gW1xuICAgICAqICAgICAvLyBMaW5lIDFcbiAgICAgKiAgICAgMSwgMCwgMCwgMSwgIC8vIHJlZFxuICAgICAqICAgICAwLCAxLCAwLCAxLCAgLy8gZ3JlZW5cbiAgICAgKiAgICAgLy8gTGluZSAyXG4gICAgICogICAgIDAsIDAsIDEsIDEsICAvLyBibHVlXG4gICAgICogICAgIDEsIDEsIDEsIDEgICAvLyB3aGl0ZVxuICAgICAqIF07XG4gICAgICogYXBwLmRyYXdMaW5lQXJyYXlzKHBvaW50cywgY29sb3JzKTtcbiAgICAgKi9cbiAgICBkcmF3TGluZUFycmF5cyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5kcmF3TGluZUFycmF5cyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhd3MgYSB3aXJlZnJhbWUgc3BoZXJlIHdpdGggY2VudGVyLCByYWRpdXMgYW5kIGNvbG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBjZW50ZXIgLSBUaGUgY2VudGVyIG9mIHRoZSBzcGhlcmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHJhZGl1cyAtIFRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZS5cbiAgICAgKiBAcGFyYW0ge0NvbG9yfSBbY29sb3JdIC0gVGhlIGNvbG9yIG9mIHRoZSBzcGhlcmUuIEl0IGRlZmF1bHRzIHRvIHdoaXRlIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtzZWdtZW50c10gLSBOdW1iZXIgb2YgbGluZSBzZWdtZW50cyB1c2VkIHRvIHJlbmRlciB0aGUgY2lyY2xlcyBmb3JtaW5nIHRoZVxuICAgICAqIHNwaGVyZS4gRGVmYXVsdHMgdG8gMjAuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgc3BoZXJlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGVcbiAgICAgKiBkZXB0aCBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHNwaGVyZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgcmVkIHdpcmUgc3BoZXJlIHdpdGggcmFkaXVzIG9mIDFcbiAgICAgKiBjb25zdCBjZW50ZXIgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd1dpcmVTcGhlcmUoY2VudGVyLCAxLjAsIHBjLkNvbG9yLlJFRCk7XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdXaXJlU3BoZXJlKGNlbnRlciwgcmFkaXVzLCBjb2xvciA9IENvbG9yLldISVRFLCBzZWdtZW50cyA9IDIwLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3V2lyZVNwaGVyZShjZW50ZXIsIHJhZGl1cywgY29sb3IsIHNlZ21lbnRzLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHdpcmVmcmFtZSBheGlzIGFsaWduZWQgYm94IHNwZWNpZmllZCBieSBtaW4gYW5kIG1heCBwb2ludHMgYW5kIGNvbG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBtaW5Qb2ludCAtIFRoZSBtaW4gY29ybmVyIHBvaW50IG9mIHRoZSBib3guXG4gICAgICogQHBhcmFtIHtWZWMzfSBtYXhQb2ludCAtIFRoZSBtYXggY29ybmVyIHBvaW50IG9mIHRoZSBib3guXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW2NvbG9yXSAtIFRoZSBjb2xvciBvZiB0aGUgc3BoZXJlLiBJdCBkZWZhdWx0cyB0byB3aGl0ZSBpZiBub3Qgc3BlY2lmaWVkLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIHNwaGVyZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlXG4gICAgICogZGVwdGggYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBzcGhlcmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIHJlZCB3aXJlIGFsaWduZWQgYm94XG4gICAgICogY29uc3QgbWluID0gbmV3IHBjLlZlYzMoLTEsIC0xLCAtMSk7XG4gICAgICogY29uc3QgbWF4ID0gbmV3IHBjLlZlYzMoMSwgMSwgMSk7XG4gICAgICogYXBwLmRyYXdXaXJlQWxpZ25lZEJveChtaW4sIG1heCwgcGMuQ29sb3IuUkVEKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1dpcmVBbGlnbmVkQm94KG1pblBvaW50LCBtYXhQb2ludCwgY29sb3IgPSBDb2xvci5XSElURSwgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd1dpcmVBbGlnbmVkQm94KG1pblBvaW50LCBtYXhQb2ludCwgY29sb3IsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXcgbWVzaEluc3RhbmNlIGF0IHRoaXMgZnJhbWVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlfSBtZXNoSW5zdGFuY2UgLSBUaGUgbWVzaCBpbnN0YW5jZVxuICAgICAqIHRvIGRyYXcuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIG1lc2ggaW5zdGFuY2UgaW50by4gRGVmYXVsdHMgdG9cbiAgICAgKiB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3TWVzaEluc3RhbmNlKG1lc2hJbnN0YW5jZSwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobnVsbCwgbnVsbCwgbnVsbCwgbWVzaEluc3RhbmNlLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBtZXNoIGF0IHRoaXMgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2NlbmUvbWVzaC5qcycpLk1lc2h9IG1lc2ggLSBUaGUgbWVzaCB0byBkcmF3LlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSB0byByZW5kZXIgdGhlIG1lc2guXG4gICAgICogQHBhcmFtIHtNYXQ0fSBtYXRyaXggLSBUaGUgbWF0cml4IHRvIHVzZSB0byByZW5kZXIgdGhlIG1lc2guXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIG1lc2ggaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd01lc2gobWVzaCwgbWF0ZXJpYWwsIG1hdHJpeCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgbWVzaCwgbnVsbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXcgcXVhZCBvZiBzaXplIFstMC41LCAwLjVdIGF0IHRoaXMgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge01hdDR9IG1hdHJpeCAtIFRoZSBtYXRyaXggdG8gdXNlIHRvIHJlbmRlciB0aGUgcXVhZC5cbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB0byB1c2UgdG8gcmVuZGVyIHRoZSBxdWFkLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBxdWFkIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdRdWFkKG1hdHJpeCwgbWF0ZXJpYWwsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdNZXNoKG1hdGVyaWFsLCBtYXRyaXgsIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmdldFF1YWRNZXNoKCksIG51bGwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHRleHR1cmUgYXQgW3gsIHldIHBvc2l0aW9uIG9uIHNjcmVlbiwgd2l0aCBzaXplIFt3aWR0aCwgaGVpZ2h0XS4gVGhlIG9yaWdpbiBvZiB0aGVcbiAgICAgKiBzY3JlZW4gaXMgdG9wLWxlZnQgWzAsIDBdLiBDb29yZGluYXRlcyBhbmQgc2l6ZXMgYXJlIGluIHByb2plY3RlZCBzcGFjZSAoLTEgLi4gMSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgd2lkdGggb2YgdGhlIHJlY3RhbmdsZSBvZiB0aGUgcmVuZGVyZWQgdGV4dHVyZS4gU2hvdWxkIGJlIGluIHRoZVxuICAgICAqIHJhbmdlIFswLCAyXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW5cbiAgICAgKiB0aGUgcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gdGV4dHVyZSAtIFRoZSB0ZXh0dXJlIHRvIHJlbmRlci5cbiAgICAgKiBAcGFyYW0ge01hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB1c2VkIHdoZW4gcmVuZGVyaW5nIHRoZSB0ZXh0dXJlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSB0ZXh0dXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZmlsdGVyYWJsZV0gLSBJbmRpY2F0ZSBpZiB0aGUgdGV4dHVyZSBjYW4gYmUgc2FtcGxlZCB1c2luZyBmaWx0ZXJpbmcuXG4gICAgICogUGFzc2luZyBmYWxzZSB1c2VzIHVuZmlsdGVyZWQgc2FtcGxpbmcsIGFsbG93aW5nIGEgZGVwdGggdGV4dHVyZSB0byBiZSBzYW1wbGVkIG9uIFdlYkdQVS5cbiAgICAgKiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3VGV4dHVyZSh4LCB5LCB3aWR0aCwgaGVpZ2h0LCB0ZXh0dXJlLCBtYXRlcmlhbCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIsIGZpbHRlcmFibGUgPSB0cnVlKSB7XG5cbiAgICAgICAgLy8gb25seSBXZWJHUFUgc3VwcG9ydHMgZmlsdGVyYWJsZSBwYXJhbWV0ZXIgdG8gYmUgZmFsc2UsIGFsbG93aW5nIGEgZGVwdGggdGV4dHVyZSAvIHNoYWRvd1xuICAgICAgICAvLyBtYXAgdG8gYmUgZmV0Y2hlZCAod2l0aG91dCBmaWx0ZXJpbmcpIGFuZCByZW5kZXJlZFxuICAgICAgICBpZiAoZmlsdGVyYWJsZSA9PT0gZmFsc2UgJiYgIXRoaXMuZ3JhcGhpY3NEZXZpY2UuaXNXZWJHUFUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gVE9ETzogaWYgdGhpcyBpcyB1c2VkIGZvciBhbnl0aGluZyBvdGhlciB0aGFuIGRlYnVnIHRleHR1cmUgZGlzcGxheSwgd2Ugc2hvdWxkIG9wdGltaXplIHRoaXMgdG8gYXZvaWQgYWxsb2NhdGlvbnNcbiAgICAgICAgY29uc3QgbWF0cml4ID0gbmV3IE1hdDQoKTtcbiAgICAgICAgbWF0cml4LnNldFRSUyhuZXcgVmVjMyh4LCB5LCAwLjApLCBRdWF0LklERU5USVRZLCBuZXcgVmVjMyh3aWR0aCwgaGVpZ2h0LCAwLjApKTtcblxuICAgICAgICBpZiAoIW1hdGVyaWFsKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuc2V0UGFyYW1ldGVyKFwiY29sb3JNYXBcIiwgdGV4dHVyZSk7XG4gICAgICAgICAgICBtYXRlcmlhbC5zaGFkZXIgPSBmaWx0ZXJhYmxlID8gdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0VGV4dHVyZVNoYWRlcigpIDogdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0VW5maWx0ZXJhYmxlVGV4dHVyZVNoYWRlcigpO1xuICAgICAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRyYXdRdWFkKG1hdHJpeCwgbWF0ZXJpYWwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIGRlcHRoIHRleHR1cmUgYXQgW3gsIHldIHBvc2l0aW9uIG9uIHNjcmVlbiwgd2l0aCBzaXplIFt3aWR0aCwgaGVpZ2h0XS4gVGhlIG9yaWdpbiBvZlxuICAgICAqIHRoZSBzY3JlZW4gaXMgdG9wLWxlZnQgWzAsIDBdLiBDb29yZGluYXRlcyBhbmQgc2l6ZXMgYXJlIGluIHByb2plY3RlZCBzcGFjZSAoLTEgLi4gMSkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IGNvb3JkaW5hdGUgb24gdGhlIHNjcmVlbiBvZiB0aGUgdG9wIGxlZnQgY29ybmVyIG9mIHRoZSB0ZXh0dXJlLlxuICAgICAqIFNob3VsZCBiZSBpbiB0aGUgcmFuZ2UgWy0xLCAxXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgd2lkdGggb2YgdGhlIHJlY3RhbmdsZSBvZiB0aGUgcmVuZGVyZWQgdGV4dHVyZS4gU2hvdWxkIGJlIGluIHRoZVxuICAgICAqIHJhbmdlIFswLCAyXS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW5cbiAgICAgKiB0aGUgcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSB0ZXh0dXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdEZXB0aFRleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgTWF0ZXJpYWwoKTtcbiAgICAgICAgbWF0ZXJpYWwuc2hhZGVyID0gdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0RGVwdGhUZXh0dXJlU2hhZGVyKCk7XG4gICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgIHRoaXMuZHJhd1RleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgbnVsbCwgbWF0ZXJpYWwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyBhcHBsaWNhdGlvbiBhbmQgcmVtb3ZlcyBhbGwgZXZlbnQgbGlzdGVuZXJzIGF0IHRoZSBlbmQgb2YgdGhlIGN1cnJlbnQgZW5naW5lIGZyYW1lXG4gICAgICogdXBkYXRlLiBIb3dldmVyLCBpZiBjYWxsZWQgb3V0c2lkZSBvZiB0aGUgZW5naW5lIGZyYW1lIHVwZGF0ZSwgY2FsbGluZyBkZXN0cm95KCkgd2lsbFxuICAgICAqIGRlc3Ryb3kgdGhlIGFwcGxpY2F0aW9uIGltbWVkaWF0ZWx5LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuZGVzdHJveSgpO1xuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbkZyYW1lVXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95UmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNhbnZhc0lkID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuaWQ7XG5cbiAgICAgICAgdGhpcy5vZmYoJ2xpYnJhcmllc2xvYWRlZCcpO1xuXG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21venZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbXN2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmtpdHZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnJvb3QuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJvb3QgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLm1vdXNlKSB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLm9mZigpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZS5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMubW91c2UgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMua2V5Ym9hcmQpIHtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQub2ZmKCk7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkLmRldGFjaCgpO1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50b3VjaCkge1xuICAgICAgICAgICAgdGhpcy50b3VjaC5vZmYoKTtcbiAgICAgICAgICAgIHRoaXMudG91Y2guZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLnRvdWNoID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRJbnB1dCkge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5nYW1lcGFkcykge1xuICAgICAgICAgICAgdGhpcy5nYW1lcGFkcy5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmdhbWVwYWRzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuZGVzdHJveSgpO1xuXG4gICAgICAgIC8vIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMuZGVzdHJveSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbGwgdGV4dHVyZSByZXNvdXJjZXNcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5hc3NldHMubGlzdCgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXNzZXRzW2ldLnVubG9hZCgpO1xuICAgICAgICAgICAgYXNzZXRzW2ldLm9mZigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYXNzZXRzLm9mZigpO1xuXG5cbiAgICAgICAgLy8gZGVzdHJveSBidW5kbGUgcmVnaXN0cnlcbiAgICAgICAgdGhpcy5idW5kbGVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5idW5kbGVzID0gbnVsbDtcblxuICAgICAgICB0aGlzLmkxOG4uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmkxOG4gPSBudWxsO1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZVtrZXldO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgaWYgKHBhcmVudCkgcGFyZW50LnJlbW92ZUNoaWxkKGVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSA9IHt9O1xuXG4gICAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcblxuICAgICAgICB0aGlzLnN5c3RlbXMgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xuXG4gICAgICAgIC8vIHNjcmlwdCByZWdpc3RyeVxuICAgICAgICB0aGlzLnNjcmlwdHMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zY2VuZXMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbnRpdHlJbmRleCA9IHt9O1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25QcmVSZW5kZXJPcGFxdWUgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoLm9uUG9zdFJlbmRlck9wYXF1ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25EaXNhYmxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vbkVuYWJsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGggPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllcldvcmxkID0gbnVsbDtcblxuICAgICAgICB0aGlzPy54ci5lbmQoKTtcbiAgICAgICAgdGhpcz8ueHIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMucmVuZGVyZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy50aWNrID0gbnVsbDtcblxuICAgICAgICB0aGlzLm9mZigpOyAvLyByZW1vdmUgYWxsIGV2ZW50c1xuXG4gICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgc2NyaXB0LmFwcCA9IG51bGw7XG5cbiAgICAgICAgQXBwQmFzZS5fYXBwbGljYXRpb25zW2NhbnZhc0lkXSA9IG51bGw7XG5cbiAgICAgICAgaWYgKGdldEFwcGxpY2F0aW9uKCkgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHNldEFwcGxpY2F0aW9uKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGVudGl0eSBmcm9tIHRoZSBpbmRleCBieSBndWlkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWQgLSBUaGUgR1VJRCB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtFbnRpdHl9IFRoZSBFbnRpdHkgd2l0aCB0aGUgR1VJRCBvciBudWxsLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRFbnRpdHlGcm9tSW5kZXgoZ3VpZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW50aXR5SW5kZXhbZ3VpZF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZShzY2VuZSkge1xuICAgICAgICB0aGlzLm9uKCdwb3N0cmVuZGVyJywgc2NlbmUuaW1tZWRpYXRlLm9uUG9zdFJlbmRlciwgc2NlbmUuaW1tZWRpYXRlKTtcbiAgICB9XG59XG5cbi8vIHN0YXRpYyBkYXRhXG5jb25zdCBfZnJhbWVFbmREYXRhID0ge307XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNzdGFydH0gYW5kIGl0c2VsZiB0byByZXF1ZXN0XG4gKiB0aGUgcmVuZGVyaW5nIG9mIGEgbmV3IGFuaW1hdGlvbiBmcmFtZS5cbiAqXG4gKiBAY2FsbGJhY2sgTWFrZVRpY2tDYWxsYmFja1xuICogQHBhcmFtIHtudW1iZXJ9IFt0aW1lc3RhbXBdIC0gVGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICogQGlnbm9yZVxuICovXG5cbi8qKlxuICogQ3JlYXRlIHRpY2sgZnVuY3Rpb24gdG8gYmUgd3JhcHBlZCBpbiBjbG9zdXJlLlxuICpcbiAqIEBwYXJhbSB7QXBwQmFzZX0gX2FwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAqIEByZXR1cm5zIHtNYWtlVGlja0NhbGxiYWNrfSBUaGUgdGljayBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmNvbnN0IG1ha2VUaWNrID0gZnVuY3Rpb24gKF9hcHApIHtcbiAgICBjb25zdCBhcHBsaWNhdGlvbiA9IF9hcHA7XG4gICAgbGV0IGZyYW1lUmVxdWVzdDtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3RpbWVzdGFtcF0gLSBUaGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqL1xuICAgIHJldHVybiBmdW5jdGlvbiAodGltZXN0YW1wLCBmcmFtZSkge1xuICAgICAgICBpZiAoIWFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHNldEFwcGxpY2F0aW9uKGFwcGxpY2F0aW9uKTtcblxuICAgICAgICBpZiAoZnJhbWVSZXF1ZXN0KSB7XG4gICAgICAgICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoZnJhbWVSZXF1ZXN0KTtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoYXZlIGN1cnJlbnQgYXBwbGljYXRpb24gcG9pbnRlciBpbiBwY1xuICAgICAgICBhcHAgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICBjb25zdCBjdXJyZW50VGltZSA9IGFwcGxpY2F0aW9uLl9wcm9jZXNzVGltZXN0YW1wKHRpbWVzdGFtcCkgfHwgbm93KCk7XG4gICAgICAgIGNvbnN0IG1zID0gY3VycmVudFRpbWUgLSAoYXBwbGljYXRpb24uX3RpbWUgfHwgY3VycmVudFRpbWUpO1xuICAgICAgICBsZXQgZHQgPSBtcyAvIDEwMDAuMDtcbiAgICAgICAgZHQgPSBtYXRoLmNsYW1wKGR0LCAwLCBhcHBsaWNhdGlvbi5tYXhEZWx0YVRpbWUpO1xuICAgICAgICBkdCAqPSBhcHBsaWNhdGlvbi50aW1lU2NhbGU7XG5cbiAgICAgICAgYXBwbGljYXRpb24uX3RpbWUgPSBjdXJyZW50VGltZTtcblxuICAgICAgICAvLyBTdWJtaXQgYSByZXF1ZXN0IHRvIHF1ZXVlIHVwIGEgbmV3IGFuaW1hdGlvbiBmcmFtZSBpbW1lZGlhdGVseVxuICAgICAgICBpZiAoYXBwbGljYXRpb24ueHI/LnNlc3Npb24pIHtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IGFwcGxpY2F0aW9uLnhyLnNlc3Npb24ucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFwcGxpY2F0aW9uLnRpY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJhbWVSZXF1ZXN0ID0gcGxhdGZvcm0uYnJvd3NlciA/IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYXBwbGljYXRpb24udGljaykgOiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmNvbnRleHRMb3N0KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9maWxsRnJhbWVTdGF0c0Jhc2ljKGN1cnJlbnRUaW1lLCBkdCwgbXMpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgYXBwbGljYXRpb24uX2ZpbGxGcmFtZVN0YXRzKCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9pbkZyYW1lVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1ldXBkYXRlXCIsIG1zKTtcblxuICAgICAgICBsZXQgc2hvdWxkUmVuZGVyRnJhbWUgPSB0cnVlO1xuXG4gICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgc2hvdWxkUmVuZGVyRnJhbWUgPSBhcHBsaWNhdGlvbi54cj8udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyLmZyYW1lYnVmZmVyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbGljYXRpb24uZ3JhcGhpY3NEZXZpY2UuZGVmYXVsdEZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaG91bGRSZW5kZXJGcmFtZSkge1xuXG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9GUkFNRSwgYC0tLS0gRnJhbWUgJHthcHBsaWNhdGlvbi5mcmFtZX1gKTtcbiAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUsIGAtLSBVcGRhdGVTdGFydCAke25vdygpLnRvRml4ZWQoMil9bXNgKTtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24udXBkYXRlKGR0KTtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lcmVuZGVyXCIpO1xuXG5cbiAgICAgICAgICAgIGlmIChhcHBsaWNhdGlvbi5hdXRvUmVuZGVyIHx8IGFwcGxpY2F0aW9uLnJlbmRlck5leHRGcmFtZSkge1xuXG4gICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfRlJBTUVfVElNRSwgYC0tIFJlbmRlclN0YXJ0ICR7bm93KCkudG9GaXhlZCgyKX1tc2ApO1xuXG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24udXBkYXRlQ2FudmFzU2l6ZSgpO1xuICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uLmZyYW1lU3RhcnQoKTtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi5yZW5kZXIoKTtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi5yZW5kZXJOZXh0RnJhbWUgPSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUsIGAtLSBSZW5kZXJFbmQgJHtub3coKS50b0ZpeGVkKDIpfW1zYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldCBldmVudCBkYXRhXG4gICAgICAgICAgICBfZnJhbWVFbmREYXRhLnRpbWVzdGFtcCA9IG5vdygpO1xuICAgICAgICAgICAgX2ZyYW1lRW5kRGF0YS50YXJnZXQgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lZW5kXCIsIF9mcmFtZUVuZERhdGEpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXBwbGljYXRpb24uX2luRnJhbWVVcGRhdGUgPSBmYWxzZTtcblxuICAgICAgICBpZiAoYXBwbGljYXRpb24uX2Rlc3Ryb3lSZXF1ZXN0ZWQpIHtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG5leHBvcnQgeyBhcHAsIEFwcEJhc2UgfTtcbiJdLCJuYW1lcyI6WyJQcm9ncmVzcyIsImNvbnN0cnVjdG9yIiwibGVuZ3RoIiwiY291bnQiLCJpbmMiLCJkb25lIiwiYXBwIiwiQXBwQmFzZSIsIkV2ZW50SGFuZGxlciIsImNhbnZhcyIsInZlcnNpb24iLCJpbmRleE9mIiwiRGVidWciLCJsb2ciLCJyZXZpc2lvbiIsIl9hcHBsaWNhdGlvbnMiLCJpZCIsInNldEFwcGxpY2F0aW9uIiwiX2Rlc3Ryb3lSZXF1ZXN0ZWQiLCJfaW5GcmFtZVVwZGF0ZSIsIl90aW1lIiwidGltZVNjYWxlIiwibWF4RGVsdGFUaW1lIiwiZnJhbWUiLCJhdXRvUmVuZGVyIiwicmVuZGVyTmV4dEZyYW1lIiwidXNlTGVnYWN5U2NyaXB0QXR0cmlidXRlQ2xvbmluZyIsInNjcmlwdCIsImxlZ2FjeSIsIl9saWJyYXJpZXNMb2FkZWQiLCJfZmlsbE1vZGUiLCJGSUxMTU9ERV9LRUVQX0FTUEVDVCIsIl9yZXNvbHV0aW9uTW9kZSIsIlJFU09MVVRJT05fRklYRUQiLCJfYWxsb3dSZXNpemUiLCJjb250ZXh0IiwiaW5pdCIsImFwcE9wdGlvbnMiLCJkZXZpY2UiLCJncmFwaGljc0RldmljZSIsImFzc2VydCIsIkdyYXBoaWNzRGV2aWNlQWNjZXNzIiwic2V0IiwiX2luaXREZWZhdWx0TWF0ZXJpYWwiLCJfaW5pdFByb2dyYW1MaWJyYXJ5Iiwic3RhdHMiLCJBcHBsaWNhdGlvblN0YXRzIiwiX3NvdW5kTWFuYWdlciIsInNvdW5kTWFuYWdlciIsImxvYWRlciIsIlJlc291cmNlTG9hZGVyIiwiTGlnaHRzQnVmZmVyIiwiX2VudGl0eUluZGV4Iiwic2NlbmUiLCJTY2VuZSIsIl9yZWdpc3RlclNjZW5lSW1tZWRpYXRlIiwicm9vdCIsIkVudGl0eSIsIl9lbmFibGVkSW5IaWVyYXJjaHkiLCJhc3NldHMiLCJBc3NldFJlZ2lzdHJ5IiwiYXNzZXRQcmVmaXgiLCJwcmVmaXgiLCJidW5kbGVzIiwiQnVuZGxlUmVnaXN0cnkiLCJlbmFibGVCdW5kbGVzIiwiVGV4dERlY29kZXIiLCJzY3JpcHRzT3JkZXIiLCJzY3JpcHRzIiwiU2NyaXB0UmVnaXN0cnkiLCJpMThuIiwiSTE4biIsInNjZW5lcyIsIlNjZW5lUmVnaXN0cnkiLCJzZWxmIiwiZGVmYXVsdExheWVyV29ybGQiLCJMYXllciIsIm5hbWUiLCJMQVlFUklEX1dPUkxEIiwic2NlbmVHcmFiIiwiU2NlbmVHcmFiIiwiZGVmYXVsdExheWVyRGVwdGgiLCJsYXllciIsImRlZmF1bHRMYXllclNreWJveCIsImVuYWJsZWQiLCJMQVlFUklEX1NLWUJPWCIsIm9wYXF1ZVNvcnRNb2RlIiwiU09SVE1PREVfTk9ORSIsImRlZmF1bHRMYXllclVpIiwiTEFZRVJJRF9VSSIsInRyYW5zcGFyZW50U29ydE1vZGUiLCJTT1JUTU9ERV9NQU5VQUwiLCJwYXNzVGhyb3VnaCIsImRlZmF1bHRMYXllckltbWVkaWF0ZSIsIkxBWUVSSURfSU1NRURJQVRFIiwiZGVmYXVsdExheWVyQ29tcG9zaXRpb24iLCJMYXllckNvbXBvc2l0aW9uIiwicHVzaE9wYXF1ZSIsInB1c2hUcmFuc3BhcmVudCIsImxheWVycyIsIm9uIiwib2xkQ29tcCIsIm5ld0NvbXAiLCJsaXN0IiwibGF5ZXJMaXN0IiwiaSIsIkxBWUVSSURfREVQVEgiLCJwYXRjaCIsIkFyZWFMaWdodEx1dHMiLCJjcmVhdGVQbGFjZWhvbGRlciIsInJlbmRlcmVyIiwiRm9yd2FyZFJlbmRlcmVyIiwiZnJhbWVHcmFwaCIsIkZyYW1lR3JhcGgiLCJsaWdodG1hcHBlciIsIm9uY2UiLCJfZmlyc3RCYWtlIiwiX2JhdGNoZXIiLCJiYXRjaE1hbmFnZXIiLCJfZmlyc3RCYXRjaCIsImtleWJvYXJkIiwibW91c2UiLCJ0b3VjaCIsImdhbWVwYWRzIiwiZWxlbWVudElucHV0IiwieHIiLCJhdHRhY2hTZWxlY3RFdmVudHMiLCJfaW5Ub29scyIsIl9za3lib3hBc3NldCIsIl9zY3JpcHRQcmVmaXgiLCJzY3JpcHRQcmVmaXgiLCJhZGRIYW5kbGVyIiwiQnVuZGxlSGFuZGxlciIsInJlc291cmNlSGFuZGxlcnMiLCJmb3JFYWNoIiwicmVzb3VyY2VIYW5kbGVyIiwiaGFuZGxlciIsImhhbmRsZXJUeXBlIiwic3lzdGVtcyIsIkNvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5IiwiY29tcG9uZW50U3lzdGVtcyIsImNvbXBvbmVudFN5c3RlbSIsImFkZCIsIl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciIsIm9uVmlzaWJpbGl0eUNoYW5nZSIsImJpbmQiLCJkb2N1bWVudCIsImhpZGRlbiIsInVuZGVmaW5lZCIsIl9oaWRkZW5BdHRyIiwiYWRkRXZlbnRMaXN0ZW5lciIsIm1vekhpZGRlbiIsIm1zSGlkZGVuIiwid2Via2l0SGlkZGVuIiwidGljayIsIm1ha2VUaWNrIiwiZ2V0QXBwbGljYXRpb24iLCJtYXRlcmlhbCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJzaGFkaW5nTW9kZWwiLCJTUEVDVUxBUl9CTElOTiIsInNldERlZmF1bHRNYXRlcmlhbCIsImxpYnJhcnkiLCJQcm9ncmFtTGlicmFyeSIsInNldFByb2dyYW1MaWJyYXJ5IiwiYmF0Y2hlciIsImZpbGxNb2RlIiwicmVzb2x1dGlvbk1vZGUiLCJjb25maWd1cmUiLCJ1cmwiLCJjYWxsYmFjayIsImh0dHAiLCJnZXQiLCJlcnIiLCJyZXNwb25zZSIsInByb3BzIiwiYXBwbGljYXRpb25fcHJvcGVydGllcyIsIl9wYXJzZUFwcGxpY2F0aW9uUHJvcGVydGllcyIsIl9wYXJzZVNjZW5lcyIsIl9wYXJzZUFzc2V0cyIsInByZWxvYWQiLCJmaXJlIiwicHJvZ3Jlc3MiLCJfZG9uZSIsInRvdGFsIiwib25Bc3NldExvYWQiLCJhc3NldCIsIm9uQXNzZXRFcnJvciIsImxvYWRlZCIsImxvYWQiLCJfcHJlbG9hZFNjcmlwdHMiLCJzY2VuZURhdGEiLCJwcmVsb2FkaW5nIiwiX2dldFNjcmlwdFJlZmVyZW5jZXMiLCJsIiwicmVnZXgiLCJvbkxvYWQiLCJTY3JpcHRUeXBlIiwiY29uc29sZSIsImVycm9yIiwic2NyaXB0VXJsIiwidGVzdCIsInRvTG93ZXJDYXNlIiwicGF0aCIsImpvaW4iLCJtYXhBc3NldFJldHJpZXMiLCJlbmFibGVSZXRyeSIsInVzZURldmljZVBpeGVsUmF0aW8iLCJ1c2VfZGV2aWNlX3BpeGVsX3JhdGlvIiwicmVzb2x1dGlvbl9tb2RlIiwiZmlsbF9tb2RlIiwiX3dpZHRoIiwid2lkdGgiLCJfaGVpZ2h0IiwiaGVpZ2h0IiwibWF4UGl4ZWxSYXRpbyIsIndpbmRvdyIsImRldmljZVBpeGVsUmF0aW8iLCJzZXRDYW52YXNSZXNvbHV0aW9uIiwic2V0Q2FudmFzRmlsbE1vZGUiLCJsYXllck9yZGVyIiwiY29tcG9zaXRpb24iLCJrZXkiLCJkYXRhIiwicGFyc2VJbnQiLCJsZW4iLCJzdWJsYXllciIsInRyYW5zcGFyZW50Iiwic3ViTGF5ZXJFbmFibGVkIiwiYmF0Y2hHcm91cHMiLCJncnAiLCJhZGRHcm91cCIsImR5bmFtaWMiLCJtYXhBYWJiU2l6ZSIsImkxOG5Bc3NldHMiLCJfbG9hZExpYnJhcmllcyIsImxpYnJhcmllcyIsInVybHMiLCJvbkxpYnJhcmllc0xvYWRlZCIsInNjcmlwdHNJbmRleCIsImJ1bmRsZXNJbmRleCIsInB1c2giLCJ0eXBlIiwiQXNzZXQiLCJmaWxlIiwibG9hZGluZ1R5cGUiLCJ0YWdzIiwibG9jYWxlIiwiYWRkTG9jYWxpemVkQXNzZXRJZCIsInByaW9yaXR5U2NyaXB0cyIsInNldHRpbmdzIiwicHJpb3JpdHlfc2NyaXB0cyIsIl9zY3JpcHRzIiwiX2luZGV4IiwiZW50aXRpZXMiLCJjb21wb25lbnRzIiwic3RhcnQiLCJjYWxsIiwiX2FscmVhZHlTdGFydGVkIiwidGltZXN0YW1wIiwibm93IiwidGFyZ2V0IiwiaW5wdXRVcGRhdGUiLCJkdCIsImNvbnRyb2xsZXIiLCJ1cGRhdGUiLCJ1cGRhdGVDbGllbnRSZWN0IiwidXBkYXRlU3RhcnQiLCJ1cGRhdGVUaW1lIiwiZnJhbWVTdGFydCIsInJlbmRlciIsInJlbmRlclN0YXJ0Iiwic3luY0hpZXJhcmNoeSIsInVwZGF0ZUFsbCIsIl9za2lwUmVuZGVyQ291bnRlciIsInJlbmRlckNvbXBvc2l0aW9uIiwicmVuZGVyVGltZSIsImxheWVyQ29tcG9zaXRpb24iLCJEZWJ1Z0dyYXBoaWNzIiwiY2xlYXJHcHVNYXJrZXJzIiwiYnVpbGRGcmFtZUdyYXBoIiwiX2ZpbGxGcmFtZVN0YXRzQmFzaWMiLCJtcyIsIl90aW1lVG9Db3VudEZyYW1lcyIsImZwcyIsIl9mcHNBY2N1bSIsImRyYXdDYWxscyIsIl9kcmF3Q2FsbHNQZXJGcmFtZSIsIl9maWxsRnJhbWVTdGF0cyIsImNhbWVyYXMiLCJfY2FtZXJhc1JlbmRlcmVkIiwibWF0ZXJpYWxzIiwiX21hdGVyaWFsU3dpdGNoZXMiLCJzaGFkZXJzIiwiX3NoYWRlclN3aXRjaGVzUGVyRnJhbWUiLCJzaGFkb3dNYXBVcGRhdGVzIiwiX3NoYWRvd01hcFVwZGF0ZXMiLCJzaGFkb3dNYXBUaW1lIiwiX3NoYWRvd01hcFRpbWUiLCJkZXB0aE1hcFRpbWUiLCJfZGVwdGhNYXBUaW1lIiwiZm9yd2FyZFRpbWUiLCJfZm9yd2FyZFRpbWUiLCJwcmltcyIsIl9wcmltc1BlckZyYW1lIiwidHJpYW5nbGVzIiwiUFJJTUlUSVZFX1RSSUFOR0xFUyIsIk1hdGgiLCJtYXgiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiY3VsbFRpbWUiLCJfY3VsbFRpbWUiLCJzb3J0VGltZSIsIl9zb3J0VGltZSIsInNraW5UaW1lIiwiX3NraW5UaW1lIiwibW9ycGhUaW1lIiwiX21vcnBoVGltZSIsImxpZ2h0Q2x1c3RlcnMiLCJfbGlnaHRDbHVzdGVycyIsImxpZ2h0Q2x1c3RlcnNUaW1lIiwiX2xpZ2h0Q2x1c3RlcnNUaW1lIiwib3RoZXJQcmltaXRpdmVzIiwiX2xheWVyQ29tcG9zaXRpb25VcGRhdGVUaW1lIiwiZm9yd2FyZCIsIl9mb3J3YXJkRHJhd0NhbGxzIiwiY3VsbGVkIiwiX251bURyYXdDYWxsc0N1bGxlZCIsImRlcHRoIiwic2hhZG93IiwiX3NoYWRvd0RyYXdDYWxscyIsInNraW5uZWQiLCJfc2tpbkRyYXdDYWxscyIsImltbWVkaWF0ZSIsImluc3RhbmNlZCIsInJlbW92ZWRCeUluc3RhbmNpbmciLCJtaXNjIiwiX2RlcHRoRHJhd0NhbGxzIiwiX2ltbWVkaWF0ZVJlbmRlcmVkIiwiX2luc3RhbmNlZERyYXdDYWxscyIsInJlbmRlclRhcmdldENyZWF0aW9uVGltZSIsInBhcnRpY2xlcyIsInVwZGF0ZXNQZXJGcmFtZSIsIl91cGRhdGVzUGVyRnJhbWUiLCJmcmFtZVRpbWUiLCJfZnJhbWVUaW1lIiwibW9kZSIsInJlc2l6ZUNhbnZhcyIsIlJFU09MVVRJT05fQVVUTyIsImNsaWVudFdpZHRoIiwiY2xpZW50SGVpZ2h0IiwiaXNIaWRkZW4iLCJzdXNwZW5kIiwicmVzdW1lIiwic2Vzc2lvbiIsIndpbmRvd1dpZHRoIiwiaW5uZXJXaWR0aCIsIndpbmRvd0hlaWdodCIsImlubmVySGVpZ2h0IiwiciIsIndpblIiLCJGSUxMTU9ERV9GSUxMX1dJTkRPVyIsInN0eWxlIiwidXBkYXRlQ2FudmFzU2l6ZSIsIl90aGlzJHhyIiwiYWN0aXZlIiwicmlnaWRib2R5Iiwib25MaWJyYXJ5TG9hZGVkIiwiYXBwbHlTY2VuZVNldHRpbmdzIiwiQW1tbyIsImdyYXZpdHkiLCJwaHlzaWNzIiwiYXBwbHlTZXR0aW5ncyIsImhhc093blByb3BlcnR5Iiwic2t5Ym94Iiwic2V0U2t5Ym94Iiwic2V0QXJlYUxpZ2h0THV0cyIsImx0Y01hdDEiLCJsdGNNYXQyIiwid2FybiIsIm9uU2t5Ym94UmVtb3ZlZCIsIm9uU2t5Ym94Q2hhbmdlZCIsInJlc291cmNlcyIsIm9mZiIsInNreWJveE1pcCIsImxvYWRGYWNlcyIsIl90aGlzJGxpZ2h0bWFwcGVyIiwiYmFrZSIsImxpZ2h0bWFwTW9kZSIsIl90aGlzJGJhdGNoZXIiLCJnZW5lcmF0ZSIsIl9wcm9jZXNzVGltZXN0YW1wIiwiZHJhd0xpbmUiLCJlbmQiLCJjb2xvciIsImRlcHRoVGVzdCIsImRyYXdMaW5lcyIsInBvc2l0aW9ucyIsImNvbG9ycyIsImRlZmF1bHREcmF3TGF5ZXIiLCJkcmF3TGluZUFycmF5cyIsImRyYXdXaXJlU3BoZXJlIiwiY2VudGVyIiwicmFkaXVzIiwiQ29sb3IiLCJXSElURSIsInNlZ21lbnRzIiwiZHJhd1dpcmVBbGlnbmVkQm94IiwibWluUG9pbnQiLCJtYXhQb2ludCIsImRyYXdNZXNoSW5zdGFuY2UiLCJtZXNoSW5zdGFuY2UiLCJkcmF3TWVzaCIsIm1lc2giLCJtYXRyaXgiLCJkcmF3UXVhZCIsImdldFF1YWRNZXNoIiwiZHJhd1RleHR1cmUiLCJ4IiwieSIsInRleHR1cmUiLCJmaWx0ZXJhYmxlIiwiaXNXZWJHUFUiLCJNYXQ0Iiwic2V0VFJTIiwiVmVjMyIsIlF1YXQiLCJJREVOVElUWSIsIk1hdGVyaWFsIiwic2V0UGFyYW1ldGVyIiwic2hhZGVyIiwiZ2V0VGV4dHVyZVNoYWRlciIsImdldFVuZmlsdGVyYWJsZVRleHR1cmVTaGFkZXIiLCJkcmF3RGVwdGhUZXh0dXJlIiwiZ2V0RGVwdGhUZXh0dXJlU2hhZGVyIiwiZGVzdHJveSIsIl90aGlzJGxpZ2h0bWFwcGVyMiIsImNhbnZhc0lkIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImRldGFjaCIsInVubG9hZCIsImdldEhhbmRsZXIiLCJfY2FjaGUiLCJlbGVtZW50IiwicGFyZW50IiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblBvc3RSZW5kZXJPcGFxdWUiLCJvbkRpc2FibGUiLCJvbkVuYWJsZSIsImdldEVudGl0eUZyb21JbmRleCIsImd1aWQiLCJvblBvc3RSZW5kZXIiLCJfZnJhbWVFbmREYXRhIiwiX2FwcCIsImFwcGxpY2F0aW9uIiwiZnJhbWVSZXF1ZXN0IiwiX2FwcGxpY2F0aW9uJHhyIiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJjdXJyZW50VGltZSIsIm1hdGgiLCJjbGFtcCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInBsYXRmb3JtIiwiYnJvd3NlciIsImNvbnRleHRMb3N0Iiwic2hvdWxkUmVuZGVyRnJhbWUiLCJfYXBwbGljYXRpb24keHIyIiwiZGVmYXVsdEZyYW1lYnVmZmVyIiwicmVuZGVyU3RhdGUiLCJiYXNlTGF5ZXIiLCJmcmFtZWJ1ZmZlciIsInRyYWNlIiwiVFJBQ0VJRF9SRU5ERVJfRlJBTUUiLCJUUkFDRUlEX1JFTkRFUl9GUkFN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
