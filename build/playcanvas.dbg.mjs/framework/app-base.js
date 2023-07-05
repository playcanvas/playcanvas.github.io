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
import { PRIMITIVE_TRIANGLES, PRIMITIVE_TRISTRIP, PRIMITIVE_TRIFAN, CULLFACE_NONE } from '../platform/graphics/constants.js';
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
  frameEnd() {
    this.graphicsDevice.frameEnd();
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
    material.cull = CULLFACE_NONE;
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
        application.frameEnd();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLWJhc2UuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYXBwLWJhc2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gI2lmIF9ERUJVR1xuaW1wb3J0IHsgdmVyc2lvbiwgcmV2aXNpb24gfSBmcm9tICcuLi9jb3JlL2NvcmUuanMnO1xuLy8gI2VuZGlmXG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgbm93IH0gZnJvbSAnLi4vY29yZS90aW1lLmpzJztcbmltcG9ydCB7IHBhdGggfSBmcm9tICcuLi9jb3JlL3BhdGguanMnO1xuaW1wb3J0IHsgVFJBQ0VJRF9SRU5ERVJfRlJBTUUsIFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUgfSBmcm9tICcuLi9jb3JlL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IE1hdDQgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0NC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uL2NvcmUvbWF0aC9xdWF0LmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5cbmltcG9ydCB7XG4gICAgUFJJTUlUSVZFX1RSSUFOR0xFUywgUFJJTUlUSVZFX1RSSUZBTiwgUFJJTUlUSVZFX1RSSVNUUklQLCBDVUxMRkFDRV9OT05FXG59IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IGh0dHAgfSBmcm9tICcuLi9wbGF0Zm9ybS9uZXQvaHR0cC5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9ERVBUSCwgTEFZRVJJRF9JTU1FRElBVEUsIExBWUVSSURfU0tZQk9YLCBMQVlFUklEX1VJLCBMQVlFUklEX1dPUkxELFxuICAgIFNPUlRNT0RFX05PTkUsIFNPUlRNT0RFX01BTlVBTCwgU1BFQ1VMQVJfQkxJTk5cbn0gZnJvbSAnLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IHNldFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9nZXQtcHJvZ3JhbS1saWJyYXJ5LmpzJztcbmltcG9ydCB7IFByb2dyYW1MaWJyYXJ5IH0gZnJvbSAnLi4vc2NlbmUvc2hhZGVyLWxpYi9wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgRm9yd2FyZFJlbmRlcmVyIH0gZnJvbSAnLi4vc2NlbmUvcmVuZGVyZXIvZm9yd2FyZC1yZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBGcmFtZUdyYXBoIH0gZnJvbSAnLi4vc2NlbmUvZnJhbWUtZ3JhcGguanMnO1xuaW1wb3J0IHsgQXJlYUxpZ2h0THV0cyB9IGZyb20gJy4uL3NjZW5lL2FyZWEtbGlnaHQtbHV0cy5qcyc7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4uL3NjZW5lL2xheWVyLmpzJztcbmltcG9ydCB7IExheWVyQ29tcG9zaXRpb24gfSBmcm9tICcuLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBTY2VuZSB9IGZyb20gJy4uL3NjZW5lL3NjZW5lLmpzJztcbmltcG9ydCB7IE1hdGVyaWFsIH0gZnJvbSAnLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJztcbmltcG9ydCB7IExpZ2h0c0J1ZmZlciB9IGZyb20gJy4uL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0cy1idWZmZXIuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9IGZyb20gJy4uL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC5qcyc7XG5pbXBvcnQgeyBzZXREZWZhdWx0TWF0ZXJpYWwgfSBmcm9tICcuLi9zY2VuZS9tYXRlcmlhbHMvZGVmYXVsdC1tYXRlcmlhbC5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi9hc3NldC9hc3NldC5qcyc7XG5pbXBvcnQgeyBBc3NldFJlZ2lzdHJ5IH0gZnJvbSAnLi9hc3NldC9hc3NldC1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBCdW5kbGVSZWdpc3RyeSB9IGZyb20gJy4vYnVuZGxlL2J1bmRsZS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb21wb25lbnRTeXN0ZW1SZWdpc3RyeSB9IGZyb20gJy4vY29tcG9uZW50cy9yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBTY2VuZUdyYWIgfSBmcm9tICcuLi9zY2VuZS9ncmFwaGljcy9zY2VuZS1ncmFiLmpzJztcbmltcG9ydCB7IEJ1bmRsZUhhbmRsZXIgfSBmcm9tICcuL2hhbmRsZXJzL2J1bmRsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZUxvYWRlciB9IGZyb20gJy4vaGFuZGxlcnMvbG9hZGVyLmpzJztcbmltcG9ydCB7IEkxOG4gfSBmcm9tICcuL2kxOG4vaTE4bi5qcyc7XG5pbXBvcnQgeyBTY3JpcHRSZWdpc3RyeSB9IGZyb20gJy4vc2NyaXB0L3NjcmlwdC1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFbnRpdHkgfSBmcm9tICcuL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBTY2VuZVJlZ2lzdHJ5IH0gZnJvbSAnLi9zY2VuZS1yZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBzY3JpcHQgfSBmcm9tICcuL3NjcmlwdC5qcyc7XG5pbXBvcnQgeyBBcHBsaWNhdGlvblN0YXRzIH0gZnJvbSAnLi9zdGF0cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgRklMTE1PREVfRklMTF9XSU5ET1csIEZJTExNT0RFX0tFRVBfQVNQRUNULFxuICAgIFJFU09MVVRJT05fQVVUTywgUkVTT0xVVElPTl9GSVhFRFxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7XG4gICAgZ2V0QXBwbGljYXRpb24sXG4gICAgc2V0QXBwbGljYXRpb25cbn0gZnJvbSAnLi9nbG9iYWxzLmpzJztcblxuLy8gTWluaS1vYmplY3QgdXNlZCB0byBtZWFzdXJlIHByb2dyZXNzIG9mIGxvYWRpbmcgc2V0c1xuY2xhc3MgUHJvZ3Jlc3Mge1xuICAgIGNvbnN0cnVjdG9yKGxlbmd0aCkge1xuICAgICAgICB0aGlzLmxlbmd0aCA9IGxlbmd0aDtcbiAgICAgICAgdGhpcy5jb3VudCA9IDA7XG4gICAgfVxuXG4gICAgaW5jKCkge1xuICAgICAgICB0aGlzLmNvdW50Kys7XG4gICAgfVxuXG4gICAgZG9uZSgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmNvdW50ID09PSB0aGlzLmxlbmd0aCk7XG4gICAgfVxufVxuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIEFwcEJhc2UjY29uZmlndXJlfSB3aGVuIGNvbmZpZ3VyYXRpb24gZmlsZSBpcyBsb2FkZWQgYW5kIHBhcnNlZCAob3JcbiAqIGFuIGVycm9yIG9jY3VycykuXG4gKlxuICogQGNhbGxiYWNrIENvbmZpZ3VyZUFwcENhbGxiYWNrXG4gKiBAcGFyYW0ge3N0cmluZ3xudWxsfSBlcnIgLSBUaGUgZXJyb3IgbWVzc2FnZSBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgbG9hZGluZyBvciBwYXJzaW5nIGZhaWxzLlxuICovXG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNwcmVsb2FkfSB3aGVuIGFsbCBhc3NldHMgKG1hcmtlZCBhcyAncHJlbG9hZCcpIGFyZSBsb2FkZWQuXG4gKlxuICogQGNhbGxiYWNrIFByZWxvYWRBcHBDYWxsYmFja1xuICovXG5cbmxldCBhcHAgPSBudWxsO1xuXG4vKipcbiAqIEFuIEFwcGxpY2F0aW9uIHJlcHJlc2VudHMgYW5kIG1hbmFnZXMgeW91ciBQbGF5Q2FudmFzIGFwcGxpY2F0aW9uLiBJZiB5b3UgYXJlIGRldmVsb3BpbmcgdXNpbmdcbiAqIHRoZSBQbGF5Q2FudmFzIEVkaXRvciwgdGhlIEFwcGxpY2F0aW9uIGlzIGNyZWF0ZWQgZm9yIHlvdS4gWW91IGNhbiBhY2Nlc3MgeW91ciBBcHBsaWNhdGlvblxuICogaW5zdGFuY2UgaW4geW91ciBzY3JpcHRzLiBCZWxvdyBpcyBhIHNrZWxldG9uIHNjcmlwdCB3aGljaCBzaG93cyBob3cgeW91IGNhbiBhY2Nlc3MgdGhlXG4gKiBhcHBsaWNhdGlvbiAnYXBwJyBwcm9wZXJ0eSBpbnNpZGUgdGhlIGluaXRpYWxpemUgYW5kIHVwZGF0ZSBmdW5jdGlvbnM6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gRWRpdG9yIGV4YW1wbGU6IGFjY2Vzc2luZyB0aGUgcGMuQXBwbGljYXRpb24gZnJvbSBhIHNjcmlwdFxuICogdmFyIE15U2NyaXB0ID0gcGMuY3JlYXRlU2NyaXB0KCdteVNjcmlwdCcpO1xuICpcbiAqIE15U2NyaXB0LnByb3RvdHlwZS5pbml0aWFsaXplID0gZnVuY3Rpb24oKSB7XG4gKiAgICAgLy8gRXZlcnkgc2NyaXB0IGluc3RhbmNlIGhhcyBhIHByb3BlcnR5ICd0aGlzLmFwcCcgYWNjZXNzaWJsZSBpbiB0aGUgaW5pdGlhbGl6ZS4uLlxuICogICAgIGNvbnN0IGFwcCA9IHRoaXMuYXBwO1xuICogfTtcbiAqXG4gKiBNeVNjcmlwdC5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24oZHQpIHtcbiAqICAgICAvLyAuLi5hbmQgdXBkYXRlIGZ1bmN0aW9ucy5cbiAqICAgICBjb25zdCBhcHAgPSB0aGlzLmFwcDtcbiAqIH07XG4gKiBgYGBcbiAqXG4gKiBJZiB5b3UgYXJlIHVzaW5nIHRoZSBFbmdpbmUgd2l0aG91dCB0aGUgRWRpdG9yLCB5b3UgaGF2ZSB0byBjcmVhdGUgdGhlIGFwcGxpY2F0aW9uIGluc3RhbmNlXG4gKiBtYW51YWxseS5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEFwcEJhc2UgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBBcHBCYXNlIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudH0gY2FudmFzIC0gVGhlIGNhbnZhcyBlbGVtZW50LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gRW5naW5lLW9ubHkgZXhhbXBsZTogY3JlYXRlIHRoZSBhcHBsaWNhdGlvbiBtYW51YWxseVxuICAgICAqIGNvbnN0IG9wdGlvbnMgPSBuZXcgQXBwT3B0aW9ucygpO1xuICAgICAqIGNvbnN0IGFwcCA9IG5ldyBwYy5BcHBCYXNlKGNhbnZhcyk7XG4gICAgICogYXBwLmluaXQob3B0aW9ucyk7XG4gICAgICpcbiAgICAgKiAvLyBTdGFydCB0aGUgYXBwbGljYXRpb24ncyBtYWluIGxvb3BcbiAgICAgKiBhcHAuc3RhcnQoKTtcbiAgICAgKlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihjYW52YXMpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh2ZXJzaW9uPy5pbmRleE9mKCckJykgPCAwKSB7XG4gICAgICAgICAgICBEZWJ1Zy5sb2coYFBvd2VyZWQgYnkgUGxheUNhbnZhcyAke3ZlcnNpb259ICR7cmV2aXNpb259YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gU3RvcmUgYXBwbGljYXRpb24gaW5zdGFuY2VcbiAgICAgICAgQXBwQmFzZS5fYXBwbGljYXRpb25zW2NhbnZhcy5pZF0gPSB0aGlzO1xuICAgICAgICBzZXRBcHBsaWNhdGlvbih0aGlzKTtcblxuICAgICAgICBhcHAgPSB0aGlzO1xuXG4gICAgICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgICAgICB0aGlzLl9kZXN0cm95UmVxdWVzdGVkID0gZmFsc2U7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX2luRnJhbWVVcGRhdGUgPSBmYWxzZTtcblxuICAgICAgICAvKiogQHByaXZhdGUgKi9cbiAgICAgICAgdGhpcy5fdGltZSA9IDA7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNjYWxlcyB0aGUgZ2xvYmFsIHRpbWUgZGVsdGEuIERlZmF1bHRzIHRvIDEuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCB0aGUgYXBwIHRvIHJ1biBhdCBoYWxmIHNwZWVkXG4gICAgICAgICAqIHRoaXMuYXBwLnRpbWVTY2FsZSA9IDAuNTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudGltZVNjYWxlID0gMTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQ2xhbXBzIHBlci1mcmFtZSBkZWx0YSB0aW1lIHRvIGFuIHVwcGVyIGJvdW5kLiBVc2VmdWwgc2luY2UgcmV0dXJuaW5nIGZyb20gYSB0YWJcbiAgICAgICAgICogZGVhY3RpdmF0aW9uIGNhbiBnZW5lcmF0ZSBodWdlIHZhbHVlcyBmb3IgZHQsIHdoaWNoIGNhbiBhZHZlcnNlbHkgYWZmZWN0IGdhbWUgc3RhdGUuXG4gICAgICAgICAqIERlZmF1bHRzIHRvIDAuMSAoc2Vjb25kcykuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIERvbid0IGNsYW1wIGludGVyLWZyYW1lIHRpbWVzIG9mIDIwMG1zIG9yIGxlc3NcbiAgICAgICAgICogdGhpcy5hcHAubWF4RGVsdGFUaW1lID0gMC4yO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tYXhEZWx0YVRpbWUgPSAwLjE7IC8vIE1heGltdW0gZGVsdGEgaXMgMC4xcyBvciAxMCBmcHMuXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0b3RhbCBudW1iZXIgb2YgZnJhbWVzIHRoZSBhcHBsaWNhdGlvbiBoYXMgdXBkYXRlZCBzaW5jZSBzdGFydCgpIHdhcyBjYWxsZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBXaGVuIHRydWUsIHRoZSBhcHBsaWNhdGlvbidzIHJlbmRlciBmdW5jdGlvbiBpcyBjYWxsZWQgZXZlcnkgZnJhbWUuIFNldHRpbmcgYXV0b1JlbmRlclxuICAgICAgICAgKiB0byBmYWxzZSBpcyB1c2VmdWwgdG8gYXBwbGljYXRpb25zIHdoZXJlIHRoZSByZW5kZXJlZCBpbWFnZSBtYXkgb2Z0ZW4gYmUgdW5jaGFuZ2VkIG92ZXJcbiAgICAgICAgICogdGltZS4gVGhpcyBjYW4gaGVhdmlseSByZWR1Y2UgdGhlIGFwcGxpY2F0aW9uJ3MgbG9hZCBvbiB0aGUgQ1BVIGFuZCBHUFUuIERlZmF1bHRzIHRvXG4gICAgICAgICAqIHRydWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBEaXNhYmxlIHJlbmRlcmluZyBldmVyeSBmcmFtZSBhbmQgb25seSByZW5kZXIgb24gYSBrZXlkb3duIGV2ZW50XG4gICAgICAgICAqIHRoaXMuYXBwLmF1dG9SZW5kZXIgPSBmYWxzZTtcbiAgICAgICAgICogdGhpcy5hcHAua2V5Ym9hcmQub24oJ2tleWRvd24nLCBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgICAgICogICAgIHRoaXMuYXBwLnJlbmRlck5leHRGcmFtZSA9IHRydWU7XG4gICAgICAgICAqIH0sIHRoaXMpO1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5hdXRvUmVuZGVyID0gdHJ1ZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0IHRvIHRydWUgdG8gcmVuZGVyIHRoZSBzY2VuZSBvbiB0aGUgbmV4dCBpdGVyYXRpb24gb2YgdGhlIG1haW4gbG9vcC4gVGhpcyBvbmx5IGhhcyBhblxuICAgICAgICAgKiBlZmZlY3QgaWYge0BsaW5rIEFwcEJhc2UjYXV0b1JlbmRlcn0gaXMgc2V0IHRvIGZhbHNlLiBUaGUgdmFsdWUgb2YgcmVuZGVyTmV4dEZyYW1lXG4gICAgICAgICAqIGlzIHNldCBiYWNrIHRvIGZhbHNlIGFnYWluIGFzIHNvb24gYXMgdGhlIHNjZW5lIGhhcyBiZWVuIHJlbmRlcmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gUmVuZGVyIHRoZSBzY2VuZSBvbmx5IHdoaWxlIHNwYWNlIGtleSBpcyBwcmVzc2VkXG4gICAgICAgICAqIGlmICh0aGlzLmFwcC5rZXlib2FyZC5pc1ByZXNzZWQocGMuS0VZX1NQQUNFKSkge1xuICAgICAgICAgKiAgICAgdGhpcy5hcHAucmVuZGVyTmV4dEZyYW1lID0gdHJ1ZTtcbiAgICAgICAgICogfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5yZW5kZXJOZXh0RnJhbWUgPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogRW5hYmxlIGlmIHlvdSB3YW50IGVudGl0eSB0eXBlIHNjcmlwdCBhdHRyaWJ1dGVzIHRvIG5vdCBiZSByZS1tYXBwZWQgd2hlbiBhbiBlbnRpdHkgaXNcbiAgICAgICAgICogY2xvbmVkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy51c2VMZWdhY3lTY3JpcHRBdHRyaWJ1dGVDbG9uaW5nID0gc2NyaXB0LmxlZ2FjeTtcblxuICAgICAgICB0aGlzLl9saWJyYXJpZXNMb2FkZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZmlsbE1vZGUgPSBGSUxMTU9ERV9LRUVQX0FTUEVDVDtcbiAgICAgICAgdGhpcy5fcmVzb2x1dGlvbk1vZGUgPSBSRVNPTFVUSU9OX0ZJWEVEO1xuICAgICAgICB0aGlzLl9hbGxvd1Jlc2l6ZSA9IHRydWU7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSB3aXRoIHNjcmlwdHMgMS4wLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7QXBwQmFzZX1cbiAgICAgICAgICogQGRlcHJlY2F0ZWRcbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jb250ZXh0ID0gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHRoZSBhcHAuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9hcHAtb3B0aW9ucy5qcycpLkFwcE9wdGlvbnN9IGFwcE9wdGlvbnMgLSBPcHRpb25zIHNwZWNpZnlpbmcgdGhlIGluaXRcbiAgICAgKiBwYXJhbWV0ZXJzIGZvciB0aGUgYXBwLlxuICAgICAqL1xuICAgIGluaXQoYXBwT3B0aW9ucykge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSBhcHBPcHRpb25zLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIERlYnVnLmFzc2VydChkZXZpY2UsIFwiVGhlIGFwcGxpY2F0aW9uIGNhbm5vdCBiZSBjcmVhdGVkIHdpdGhvdXQgYSB2YWxpZCBHcmFwaGljc0RldmljZVwiKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIGJ5IHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlID0gZGV2aWNlO1xuICAgICAgICBHcmFwaGljc0RldmljZUFjY2Vzcy5zZXQoZGV2aWNlKTtcblxuICAgICAgICB0aGlzLl9pbml0RGVmYXVsdE1hdGVyaWFsKCk7XG4gICAgICAgIHRoaXMuX2luaXRQcm9ncmFtTGlicmFyeSgpO1xuICAgICAgICB0aGlzLnN0YXRzID0gbmV3IEFwcGxpY2F0aW9uU3RhdHMoZGV2aWNlKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlciA9IGFwcE9wdGlvbnMuc291bmRNYW5hZ2VyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgcmVzb3VyY2UgbG9hZGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7UmVzb3VyY2VMb2FkZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxvYWRlciA9IG5ldyBSZXNvdXJjZUxvYWRlcih0aGlzKTtcblxuICAgICAgICBMaWdodHNCdWZmZXIuaW5pdChkZXZpY2UpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTdG9yZXMgYWxsIGVudGl0aWVzIHRoYXQgaGF2ZSBiZWVuIGNyZWF0ZWQgZm9yIHRoaXMgYXBwIGJ5IGd1aWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBFbnRpdHk+fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbnRpdHlJbmRleCA9IHt9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2NlbmUgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTY2VuZX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gU2V0IHRoZSB0b25lIG1hcHBpbmcgcHJvcGVydHkgb2YgdGhlIGFwcGxpY2F0aW9uJ3Mgc2NlbmVcbiAgICAgICAgICogdGhpcy5hcHAuc2NlbmUudG9uZU1hcHBpbmcgPSBwYy5UT05FTUFQX0ZJTE1JQztcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2NlbmUgPSBuZXcgU2NlbmUoZGV2aWNlKTtcbiAgICAgICAgdGhpcy5fcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZSh0aGlzLnNjZW5lKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJvb3QgZW50aXR5IG9mIHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VudGl0eX1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gUmV0dXJuIHRoZSBmaXJzdCBlbnRpdHkgY2FsbGVkICdDYW1lcmEnIGluIGEgZGVwdGgtZmlyc3Qgc2VhcmNoIG9mIHRoZSBzY2VuZSBoaWVyYXJjaHlcbiAgICAgICAgICogY29uc3QgY2FtZXJhID0gdGhpcy5hcHAucm9vdC5maW5kQnlOYW1lKCdDYW1lcmEnKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucm9vdCA9IG5ldyBFbnRpdHkoKTtcbiAgICAgICAgdGhpcy5yb290Ll9lbmFibGVkSW5IaWVyYXJjaHkgPSB0cnVlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXNzZXQgcmVnaXN0cnkgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtBc3NldFJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZWFyY2ggdGhlIGFzc2V0IHJlZ2lzdHJ5IGZvciBhbGwgYXNzZXRzIHdpdGggdGhlIHRhZyAndmVoaWNsZSdcbiAgICAgICAgICogY29uc3QgdmVoaWNsZUFzc2V0cyA9IHRoaXMuYXBwLmFzc2V0cy5maW5kQnlUYWcoJ3ZlaGljbGUnKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuYXNzZXRzID0gbmV3IEFzc2V0UmVnaXN0cnkodGhpcy5sb2FkZXIpO1xuICAgICAgICBpZiAoYXBwT3B0aW9ucy5hc3NldFByZWZpeCkgdGhpcy5hc3NldHMucHJlZml4ID0gYXBwT3B0aW9ucy5hc3NldFByZWZpeDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge0J1bmRsZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmJ1bmRsZXMgPSBuZXcgQnVuZGxlUmVnaXN0cnkodGhpcy5hc3NldHMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBTZXQgdGhpcyB0byBmYWxzZSBpZiB5b3Ugd2FudCB0byBydW4gd2l0aG91dCB1c2luZyBidW5kbGVzLiBXZSBzZXQgaXQgdG8gdHJ1ZSBvbmx5IGlmXG4gICAgICAgICAqIFRleHREZWNvZGVyIGlzIGF2YWlsYWJsZSBiZWNhdXNlIHdlIGN1cnJlbnRseSByZWx5IG9uIGl0IGZvciB1bnRhcnJpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVuYWJsZUJ1bmRsZXMgPSAodHlwZW9mIFRleHREZWNvZGVyICE9PSAndW5kZWZpbmVkJyk7XG5cbiAgICAgICAgdGhpcy5zY3JpcHRzT3JkZXIgPSBhcHBPcHRpb25zLnNjcmlwdHNPcmRlciB8fCBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGFwcGxpY2F0aW9uJ3Mgc2NyaXB0IHJlZ2lzdHJ5LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7U2NyaXB0UmVnaXN0cnl9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBuZXcgU2NyaXB0UmVnaXN0cnkodGhpcyk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEhhbmRsZXMgbG9jYWxpemF0aW9uLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7STE4bn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaTE4biA9IG5ldyBJMThuKHRoaXMpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2NlbmUgcmVnaXN0cnkgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtTY2VuZVJlZ2lzdHJ5fVxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZWFyY2ggdGhlIHNjZW5lIHJlZ2lzdHJ5IGZvciBhIGl0ZW0gd2l0aCB0aGUgbmFtZSAncmFjZXRyYWNrMSdcbiAgICAgICAgICogY29uc3Qgc2NlbmVJdGVtID0gdGhpcy5hcHAuc2NlbmVzLmZpbmQoJ3JhY2V0cmFjazEnKTtcbiAgICAgICAgICpcbiAgICAgICAgICogLy8gTG9hZCB0aGUgc2NlbmUgdXNpbmcgdGhlIGl0ZW0ncyB1cmxcbiAgICAgICAgICogdGhpcy5hcHAuc2NlbmVzLmxvYWRTY2VuZShzY2VuZUl0ZW0udXJsKTtcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuc2NlbmVzID0gbmV3IFNjZW5lUmVnaXN0cnkodGhpcyk7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyV29ybGQgPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgbmFtZTogXCJXb3JsZFwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfV09STERcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5zY2VuZUdyYWIgPSBuZXcgU2NlbmVHcmFiKHRoaXMuZ3JhcGhpY3NEZXZpY2UsIHRoaXMuc2NlbmUpO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoID0gdGhpcy5zY2VuZUdyYWIubGF5ZXI7XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJTa3lib3ggPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIG5hbWU6IFwiU2t5Ym94XCIsXG4gICAgICAgICAgICBpZDogTEFZRVJJRF9TS1lCT1gsXG4gICAgICAgICAgICBvcGFxdWVTb3J0TW9kZTogU09SVE1PREVfTk9ORVxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJVaSA9IG5ldyBMYXllcih7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbmFtZTogXCJVSVwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfVUksXG4gICAgICAgICAgICB0cmFuc3BhcmVudFNvcnRNb2RlOiBTT1JUTU9ERV9NQU5VQUwsXG4gICAgICAgICAgICBwYXNzVGhyb3VnaDogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVySW1tZWRpYXRlID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBuYW1lOiBcIkltbWVkaWF0ZVwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfSU1NRURJQVRFLFxuICAgICAgICAgICAgb3BhcXVlU29ydE1vZGU6IFNPUlRNT0RFX05PTkUsXG4gICAgICAgICAgICBwYXNzVGhyb3VnaDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbiA9IG5ldyBMYXllckNvbXBvc2l0aW9uKFwiZGVmYXVsdFwiKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllcldvcmxkKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllckRlcHRoKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllclNreWJveCk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllcldvcmxkKTtcbiAgICAgICAgZGVmYXVsdExheWVyQ29tcG9zaXRpb24ucHVzaE9wYXF1ZSh0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllckltbWVkaWF0ZSk7XG4gICAgICAgIGRlZmF1bHRMYXllckNvbXBvc2l0aW9uLnB1c2hUcmFuc3BhcmVudCh0aGlzLmRlZmF1bHRMYXllclVpKTtcbiAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMgPSBkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbjtcblxuICAgICAgICAvLyBEZWZhdWx0IGxheWVycyBwYXRjaFxuICAgICAgICB0aGlzLnNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgZnVuY3Rpb24gKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgICAgIGNvbnN0IGxpc3QgPSBuZXdDb21wLmxheWVyTGlzdDtcbiAgICAgICAgICAgIGxldCBsYXllcjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGxheWVyID0gbGlzdFtpXTtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGxheWVyLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTEFZRVJJRF9ERVBUSDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuc2NlbmVHcmFiLnBhdGNoKGxheWVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIExBWUVSSURfVUk6XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXllci5wYXNzVGhyb3VnaCA9IHNlbGYuZGVmYXVsdExheWVyVWkucGFzc1Rocm91Z2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBMQVlFUklEX0lNTUVESUFURTpcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnBhc3NUaHJvdWdoID0gc2VsZi5kZWZhdWx0TGF5ZXJJbW1lZGlhdGUucGFzc1Rocm91Z2g7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHBsYWNlaG9sZGVyIHRleHR1cmUgZm9yIGFyZWEgbGlnaHQgTFVUc1xuICAgICAgICBBcmVhTGlnaHRMdXRzLmNyZWF0ZVBsYWNlaG9sZGVyKGRldmljZSk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBmb3J3YXJkIHJlbmRlcmVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Rm9yd2FyZFJlbmRlcmVyfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbmV3IEZvcndhcmRSZW5kZXJlcihkZXZpY2UpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnNjZW5lID0gdGhpcy5zY2VuZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGZyYW1lIGdyYXBoLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RnJhbWVHcmFwaH1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5mcmFtZUdyYXBoID0gbmV3IEZyYW1lR3JhcGgoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHJ1bi10aW1lIGxpZ2h0bWFwcGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2xpZ2h0bWFwcGVyL2xpZ2h0bWFwcGVyLmpzJykuTGlnaHRtYXBwZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyID0gbnVsbDtcbiAgICAgICAgaWYgKGFwcE9wdGlvbnMubGlnaHRtYXBwZXIpIHtcbiAgICAgICAgICAgIHRoaXMubGlnaHRtYXBwZXIgPSBuZXcgYXBwT3B0aW9ucy5saWdodG1hcHBlcihkZXZpY2UsIHRoaXMucm9vdCwgdGhpcy5zY2VuZSwgdGhpcy5yZW5kZXJlciwgdGhpcy5hc3NldHMpO1xuICAgICAgICAgICAgdGhpcy5vbmNlKCdwcmVyZW5kZXInLCB0aGlzLl9maXJzdEJha2UsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBhcHBsaWNhdGlvbidzIGJhdGNoIG1hbmFnZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLW1hbmFnZXIuanMnKS5CYXRjaE1hbmFnZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9iYXRjaGVyID0gbnVsbDtcbiAgICAgICAgaWYgKGFwcE9wdGlvbnMuYmF0Y2hNYW5hZ2VyKSB7XG4gICAgICAgICAgICB0aGlzLl9iYXRjaGVyID0gbmV3IGFwcE9wdGlvbnMuYmF0Y2hNYW5hZ2VyKGRldmljZSwgdGhpcy5yb290LCB0aGlzLnNjZW5lKTtcbiAgICAgICAgICAgIHRoaXMub25jZSgncHJlcmVuZGVyJywgdGhpcy5fZmlyc3RCYXRjaCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGtleWJvYXJkIGRldmljZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQva2V5Ym9hcmQuanMnKS5LZXlib2FyZH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMua2V5Ym9hcmQgPSBhcHBPcHRpb25zLmtleWJvYXJkIHx8IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBtb3VzZSBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L21vdXNlLmpzJykuTW91c2V9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm1vdXNlID0gYXBwT3B0aW9ucy5tb3VzZSB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVc2VkIHRvIGdldCB0b3VjaCBldmVudHMgaW5wdXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2lucHV0L3RvdWNoLWRldmljZS5qcycpLlRvdWNoRGV2aWNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50b3VjaCA9IGFwcE9wdGlvbnMudG91Y2ggfHwgbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVXNlZCB0byBhY2Nlc3MgR2FtZVBhZCBpbnB1dC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vaW5wdXQvZ2FtZS1wYWRzLmpzJykuR2FtZVBhZHN9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdhbWVwYWRzID0gYXBwT3B0aW9ucy5nYW1lcGFkcyB8fCBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBVc2VkIHRvIGhhbmRsZSBpbnB1dCBmb3Ige0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9pbnB1dC9lbGVtZW50LWlucHV0LmpzJykuRWxlbWVudElucHV0fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQgPSBhcHBPcHRpb25zLmVsZW1lbnRJbnB1dCB8fCBudWxsO1xuICAgICAgICBpZiAodGhpcy5lbGVtZW50SW5wdXQpXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dC5hcHAgPSB0aGlzO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgWFIgTWFuYWdlciB0aGF0IHByb3ZpZGVzIGFiaWxpdHkgdG8gc3RhcnQgVlIvQVIgc2Vzc2lvbnMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4veHIveHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn1cbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogLy8gY2hlY2sgaWYgVlIgaXMgYXZhaWxhYmxlXG4gICAgICAgICAqIGlmIChhcHAueHIuaXNBdmFpbGFibGUocGMuWFJUWVBFX1ZSKSkge1xuICAgICAgICAgKiAgICAgLy8gVlIgaXMgYXZhaWxhYmxlXG4gICAgICAgICAqIH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMueHIgPSBhcHBPcHRpb25zLnhyID8gbmV3IGFwcE9wdGlvbnMueHIodGhpcykgOiBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRJbnB1dClcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudElucHV0LmF0dGFjaFNlbGVjdEV2ZW50cygpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faW5Ub29scyA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7QXNzZXR8bnVsbH1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3NreWJveEFzc2V0ID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2NyaXB0UHJlZml4ID0gYXBwT3B0aW9ucy5zY3JpcHRQcmVmaXggfHwgJyc7XG5cbiAgICAgICAgaWYgKHRoaXMuZW5hYmxlQnVuZGxlcykge1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIuYWRkSGFuZGxlcihcImJ1bmRsZVwiLCBuZXcgQnVuZGxlSGFuZGxlcih0aGlzKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgYW5kIHJlZ2lzdGVyIGFsbCByZXF1aXJlZCByZXNvdXJjZSBoYW5kbGVyc1xuICAgICAgICBhcHBPcHRpb25zLnJlc291cmNlSGFuZGxlcnMuZm9yRWFjaCgocmVzb3VyY2VIYW5kbGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBoYW5kbGVyID0gbmV3IHJlc291cmNlSGFuZGxlcih0aGlzKTtcbiAgICAgICAgICAgIHRoaXMubG9hZGVyLmFkZEhhbmRsZXIoaGFuZGxlci5oYW5kbGVyVHlwZSwgaGFuZGxlcik7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBjb21wb25lbnQgc3lzdGVtIHJlZ2lzdHJ5LiBUaGUgQXBwbGljYXRpb24gY29uc3RydWN0b3IgYWRkcyB0aGVcbiAgICAgICAgICogZm9sbG93aW5nIGNvbXBvbmVudCBzeXN0ZW1zIHRvIGl0cyBjb21wb25lbnQgc3lzdGVtIHJlZ2lzdHJ5OlxuICAgICAgICAgKlxuICAgICAgICAgKiAtIGFuaW0gKHtAbGluayBBbmltQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBhbmltYXRpb24gKHtAbGluayBBbmltYXRpb25Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGF1ZGlvbGlzdGVuZXIgKHtAbGluayBBdWRpb0xpc3RlbmVyQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBidXR0b24gKHtAbGluayBCdXR0b25Db21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIGNhbWVyYSAoe0BsaW5rIENhbWVyYUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gY29sbGlzaW9uICh7QGxpbmsgQ29sbGlzaW9uQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBlbGVtZW50ICh7QGxpbmsgRWxlbWVudENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbGF5b3V0Y2hpbGQgKHtAbGluayBMYXlvdXRDaGlsZENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbGF5b3V0Z3JvdXAgKHtAbGluayBMYXlvdXRHcm91cENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbGlnaHQgKHtAbGluayBMaWdodENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gbW9kZWwgKHtAbGluayBNb2RlbENvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gcGFydGljbGVzeXN0ZW0gKHtAbGluayBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gcmlnaWRib2R5ICh7QGxpbmsgUmlnaWRCb2R5Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSByZW5kZXIgKHtAbGluayBSZW5kZXJDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcmVlbiAoe0BsaW5rIFNjcmVlbkNvbXBvbmVudFN5c3RlbX0pXG4gICAgICAgICAqIC0gc2NyaXB0ICh7QGxpbmsgU2NyaXB0Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzY3JvbGxiYXIgKHtAbGluayBTY3JvbGxiYXJDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKiAtIHNjcm9sbHZpZXcgKHtAbGluayBTY3JvbGxWaWV3Q29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzb3VuZCAoe0BsaW5rIFNvdW5kQ29tcG9uZW50U3lzdGVtfSlcbiAgICAgICAgICogLSBzcHJpdGUgKHtAbGluayBTcHJpdGVDb21wb25lbnRTeXN0ZW19KVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Q29tcG9uZW50U3lzdGVtUmVnaXN0cnl9XG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIC8vIFNldCBnbG9iYWwgZ3Jhdml0eSB0byB6ZXJvXG4gICAgICAgICAqIHRoaXMuYXBwLnN5c3RlbXMucmlnaWRib2R5LmdyYXZpdHkuc2V0KDAsIDAsIDApO1xuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAvLyBTZXQgdGhlIGdsb2JhbCBzb3VuZCB2b2x1bWUgdG8gNTAlXG4gICAgICAgICAqIHRoaXMuYXBwLnN5c3RlbXMuc291bmQudm9sdW1lID0gMC41O1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5zeXN0ZW1zID0gbmV3IENvbXBvbmVudFN5c3RlbVJlZ2lzdHJ5KCk7XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuZCByZWdpc3RlciBhbGwgcmVxdWlyZWQgY29tcG9uZW50IHN5c3RlbXNcbiAgICAgICAgYXBwT3B0aW9ucy5jb21wb25lbnRTeXN0ZW1zLmZvckVhY2goKGNvbXBvbmVudFN5c3RlbSkgPT4ge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLmFkZChuZXcgY29tcG9uZW50U3lzdGVtKHRoaXMpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLyoqIEBwcml2YXRlICovXG4gICAgICAgIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyID0gdGhpcy5vblZpc2liaWxpdHlDaGFuZ2UuYmluZCh0aGlzKTtcblxuICAgICAgICAvLyBEZXBlbmRpbmcgb24gYnJvd3NlciBhZGQgdGhlIGNvcnJlY3QgdmlzaWJpbGl0eWNoYW5nZSBldmVudCBhbmQgc3RvcmUgdGhlIG5hbWUgb2YgdGhlXG4gICAgICAgIC8vIGhpZGRlbiBhdHRyaWJ1dGUgaW4gdGhpcy5faGlkZGVuQXR0ci5cbiAgICAgICAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5oaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnaGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZG9jdW1lbnQubW96SGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ21vekhpZGRlbic7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW96dmlzaWJpbGl0eWNoYW5nZScsIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyLCBmYWxzZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRvY3VtZW50Lm1zSGlkZGVuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9oaWRkZW5BdHRyID0gJ21zSGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdtc3Zpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkb2N1bWVudC53ZWJraXRIaWRkZW4gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZGRlbkF0dHIgPSAnd2Via2l0SGlkZGVuJztcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd3ZWJraXR2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGJpbmQgdGljayBmdW5jdGlvbiB0byBjdXJyZW50IHNjb3BlXG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11c2UtYmVmb3JlLWRlZmluZSAqL1xuICAgICAgICB0aGlzLnRpY2sgPSBtYWtlVGljayh0aGlzKTsgLy8gQ2lyY3VsYXIgbGludGluZyBpc3N1ZSBhcyBtYWtlVGljayBhbmQgQXBwbGljYXRpb24gcmVmZXJlbmNlIGVhY2ggb3RoZXJcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBzdGF0aWNcbiAgICAgKiBAbmFtZSBhcHBcbiAgICAgKiBAdHlwZSB7QXBwQmFzZXx1bmRlZmluZWR9XG4gICAgICogQGRlc2NyaXB0aW9uIEdldHMgdGhlIGN1cnJlbnQgYXBwbGljYXRpb24sIGlmIGFueS5cbiAgICAgKi9cblxuICAgIHN0YXRpYyBfYXBwbGljYXRpb25zID0ge307XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGN1cnJlbnQgYXBwbGljYXRpb24uIEluIHRoZSBjYXNlIHdoZXJlIHRoZXJlIGFyZSBtdWx0aXBsZSBydW5uaW5nIGFwcGxpY2F0aW9ucywgdGhlXG4gICAgICogZnVuY3Rpb24gY2FuIGdldCBhbiBhcHBsaWNhdGlvbiBiYXNlZCBvbiBhIHN1cHBsaWVkIGNhbnZhcyBpZC4gVGhpcyBmdW5jdGlvbiBpcyBwYXJ0aWN1bGFybHlcbiAgICAgKiB1c2VmdWwgd2hlbiB0aGUgY3VycmVudCBBcHBsaWNhdGlvbiBpcyBub3QgcmVhZGlseSBhdmFpbGFibGUuIEZvciBleGFtcGxlLCBpbiB0aGUgSmF2YVNjcmlwdFxuICAgICAqIGNvbnNvbGUgb2YgdGhlIGJyb3dzZXIncyBkZXZlbG9wZXIgdG9vbHMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2lkXSAtIElmIGRlZmluZWQsIHRoZSByZXR1cm5lZCBhcHBsaWNhdGlvbiBzaG91bGQgdXNlIHRoZSBjYW52YXMgd2hpY2ggaGFzXG4gICAgICogdGhpcyBpZC4gT3RoZXJ3aXNlIGN1cnJlbnQgYXBwbGljYXRpb24gd2lsbCBiZSByZXR1cm5lZC5cbiAgICAgKiBAcmV0dXJucyB7QXBwQmFzZXx1bmRlZmluZWR9IFRoZSBydW5uaW5nIGFwcGxpY2F0aW9uLCBpZiBhbnkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBhcHAgPSBwYy5BcHBCYXNlLmdldEFwcGxpY2F0aW9uKCk7XG4gICAgICovXG4gICAgc3RhdGljIGdldEFwcGxpY2F0aW9uKGlkKSB7XG4gICAgICAgIHJldHVybiBpZCA/IEFwcEJhc2UuX2FwcGxpY2F0aW9uc1tpZF0gOiBnZXRBcHBsaWNhdGlvbigpO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9pbml0RGVmYXVsdE1hdGVyaWFsKCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSBcIkRlZmF1bHQgTWF0ZXJpYWxcIjtcbiAgICAgICAgbWF0ZXJpYWwuc2hhZGluZ01vZGVsID0gU1BFQ1VMQVJfQkxJTk47XG4gICAgICAgIHNldERlZmF1bHRNYXRlcmlhbCh0aGlzLmdyYXBoaWNzRGV2aWNlLCBtYXRlcmlhbCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2luaXRQcm9ncmFtTGlicmFyeSgpIHtcbiAgICAgICAgY29uc3QgbGlicmFyeSA9IG5ldyBQcm9ncmFtTGlicmFyeSh0aGlzLmdyYXBoaWNzRGV2aWNlLCBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpKTtcbiAgICAgICAgc2V0UHJvZ3JhbUxpYnJhcnkodGhpcy5ncmFwaGljc0RldmljZSwgbGlicmFyeSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vc291bmQvbWFuYWdlci5qcycpLlNvdW5kTWFuYWdlcn1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHNvdW5kTWFuYWdlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NvdW5kTWFuYWdlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXBwbGljYXRpb24ncyBiYXRjaCBtYW5hZ2VyLiBUaGUgYmF0Y2ggbWFuYWdlciBpcyB1c2VkIHRvIG1lcmdlIG1lc2ggaW5zdGFuY2VzIGluXG4gICAgICogdGhlIHNjZW5lLCB3aGljaCByZWR1Y2VzIHRoZSBvdmVyYWxsIG51bWJlciBvZiBkcmF3IGNhbGxzLCB0aGVyZWJ5IGJvb3N0aW5nIHBlcmZvcm1hbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtbWFuYWdlci5qcycpLkJhdGNoTWFuYWdlcn1cbiAgICAgKi9cbiAgICBnZXQgYmF0Y2hlcigpIHtcbiAgICAgICAgRGVidWcuYXNzZXJ0KHRoaXMuX2JhdGNoZXIsIFwiQmF0Y2hNYW5hZ2VyIGhhcyBub3QgYmVlbiBjcmVhdGVkIGFuZCBpcyByZXF1aXJlZCBmb3IgY29ycmVjdCBmdW5jdGlvbmFsaXR5LlwiKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGN1cnJlbnQgZmlsbCBtb2RlIG9mIHRoZSBjYW52YXMuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX05PTkV9OiB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0ZJTExfV0lORE9XfTogdGhlIGNhbnZhcyB3aWxsIHNpbXBseSBmaWxsIHRoZSB3aW5kb3csIGNoYW5naW5nIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9LRUVQX0FTUEVDVH06IHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0IGNhbiB3aGlsZVxuICAgICAqIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCBmaWxsTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbGxNb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IHJlc29sdXRpb24gbW9kZSBvZiB0aGUgY2FudmFzLCBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRVNPTFVUSU9OX0FVVE99OiBpZiB3aWR0aCBhbmQgaGVpZ2h0IGFyZSBub3QgcHJvdmlkZWQsIGNhbnZhcyB3aWxsIGJlIHJlc2l6ZWQgdG9cbiAgICAgKiBtYXRjaCBjYW52YXMgY2xpZW50IHNpemUuXG4gICAgICogLSB7QGxpbmsgUkVTT0xVVElPTl9GSVhFRH06IHJlc29sdXRpb24gb2YgY2FudmFzIHdpbGwgYmUgZml4ZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIGdldCByZXNvbHV0aW9uTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jlc29sdXRpb25Nb2RlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgdGhlIGFwcGxpY2F0aW9uIGNvbmZpZ3VyYXRpb24gZmlsZSBhbmQgYXBwbHkgYXBwbGljYXRpb24gcHJvcGVydGllcyBhbmQgZmlsbCB0aGUgYXNzZXRcbiAgICAgKiByZWdpc3RyeS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSBUaGUgVVJMIG9mIHRoZSBjb25maWd1cmF0aW9uIGZpbGUgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0NvbmZpZ3VyZUFwcENhbGxiYWNrfSBjYWxsYmFjayAtIFRoZSBGdW5jdGlvbiBjYWxsZWQgd2hlbiB0aGUgY29uZmlndXJhdGlvbiBmaWxlIGlzXG4gICAgICogbG9hZGVkIGFuZCBwYXJzZWQgKG9yIGFuIGVycm9yIG9jY3VycykuXG4gICAgICovXG4gICAgY29uZmlndXJlKHVybCwgY2FsbGJhY2spIHtcbiAgICAgICAgaHR0cC5nZXQodXJsLCAoZXJyLCByZXNwb25zZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcm9wcyA9IHJlc3BvbnNlLmFwcGxpY2F0aW9uX3Byb3BlcnRpZXM7XG4gICAgICAgICAgICBjb25zdCBzY2VuZXMgPSByZXNwb25zZS5zY2VuZXM7XG4gICAgICAgICAgICBjb25zdCBhc3NldHMgPSByZXNwb25zZS5hc3NldHM7XG5cbiAgICAgICAgICAgIHRoaXMuX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzKHByb3BzLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcGFyc2VTY2VuZXMoc2NlbmVzKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFzc2V0cyhhc3NldHMpO1xuICAgICAgICAgICAgICAgIGlmICghZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExvYWQgYWxsIGFzc2V0cyBpbiB0aGUgYXNzZXQgcmVnaXN0cnkgdGhhdCBhcmUgbWFya2VkIGFzICdwcmVsb2FkJy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UHJlbG9hZEFwcENhbGxiYWNrfSBjYWxsYmFjayAtIEZ1bmN0aW9uIGNhbGxlZCB3aGVuIGFsbCBhc3NldHMgYXJlIGxvYWRlZC5cbiAgICAgKi9cbiAgICBwcmVsb2FkKGNhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuZmlyZShcInByZWxvYWQ6c3RhcnRcIik7XG5cbiAgICAgICAgLy8gZ2V0IGxpc3Qgb2YgYXNzZXRzIHRvIHByZWxvYWRcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5hc3NldHMubGlzdCh7XG4gICAgICAgICAgICBwcmVsb2FkOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHByb2dyZXNzID0gbmV3IFByb2dyZXNzKGFzc2V0cy5sZW5ndGgpO1xuXG4gICAgICAgIGxldCBfZG9uZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGNoZWNrIGlmIGFsbCBsb2FkaW5nIGlzIGRvbmVcbiAgICAgICAgY29uc3QgZG9uZSA9ICgpID0+IHtcbiAgICAgICAgICAgIC8vIGRvIG5vdCBwcm9jZWVkIGlmIGFwcGxpY2F0aW9uIGRlc3Ryb3llZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIV9kb25lICYmIHByb2dyZXNzLmRvbmUoKSkge1xuICAgICAgICAgICAgICAgIF9kb25lID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoXCJwcmVsb2FkOmVuZFwiKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHRvdGFscyBsb2FkaW5nIHByb2dyZXNzIG9mIGFzc2V0c1xuICAgICAgICBjb25zdCB0b3RhbCA9IGFzc2V0cy5sZW5ndGg7XG5cbiAgICAgICAgaWYgKHByb2dyZXNzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3Qgb25Bc3NldExvYWQgPSAoYXNzZXQpID0+IHtcbiAgICAgICAgICAgICAgICBwcm9ncmVzcy5pbmMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpcmUoJ3ByZWxvYWQ6cHJvZ3Jlc3MnLCBwcm9ncmVzcy5jb3VudCAvIHRvdGFsKTtcblxuICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgIGRvbmUoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNvbnN0IG9uQXNzZXRFcnJvciA9IChlcnIsIGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdwcmVsb2FkOnByb2dyZXNzJywgcHJvZ3Jlc3MuY291bnQgLyB0b3RhbCk7XG5cbiAgICAgICAgICAgICAgICBpZiAocHJvZ3Jlc3MuZG9uZSgpKVxuICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAvLyBmb3IgZWFjaCBhc3NldFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhc3NldHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0c1tpXS5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzW2ldLm9uY2UoJ2xvYWQnLCBvbkFzc2V0TG9hZCk7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0c1tpXS5vbmNlKCdlcnJvcicsIG9uQXNzZXRFcnJvcik7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hc3NldHMubG9hZChhc3NldHNbaV0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzLmluYygpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmZpcmUoXCJwcmVsb2FkOnByb2dyZXNzXCIsIHByb2dyZXNzLmNvdW50IC8gdG90YWwpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9ncmVzcy5kb25lKCkpXG4gICAgICAgICAgICAgICAgICAgICAgICBkb25lKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZG9uZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3ByZWxvYWRTY3JpcHRzKHNjZW5lRGF0YSwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCFzY3JpcHQubGVnYWN5KSB7XG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLnNjcmlwdC5wcmVsb2FkaW5nID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBzY3JpcHRzID0gdGhpcy5fZ2V0U2NyaXB0UmVmZXJlbmNlcyhzY2VuZURhdGEpO1xuXG4gICAgICAgIGNvbnN0IGwgPSBzY3JpcHRzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgcHJvZ3Jlc3MgPSBuZXcgUHJvZ3Jlc3MobCk7XG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gL15odHRwKHMpPzpcXC9cXC8vO1xuXG4gICAgICAgIGlmIChsKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSAoZXJyLCBTY3JpcHRUeXBlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGVycilcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3MuaW5jKCk7XG4gICAgICAgICAgICAgICAgaWYgKHByb2dyZXNzLmRvbmUoKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGxldCBzY3JpcHRVcmwgPSBzY3JpcHRzW2ldO1xuICAgICAgICAgICAgICAgIC8vIHN1cHBvcnQgYWJzb2x1dGUgVVJMcyAoZm9yIG5vdylcbiAgICAgICAgICAgICAgICBpZiAoIXJlZ2V4LnRlc3Qoc2NyaXB0VXJsLnRvTG93ZXJDYXNlKCkpICYmIHRoaXMuX3NjcmlwdFByZWZpeClcbiAgICAgICAgICAgICAgICAgICAgc2NyaXB0VXJsID0gcGF0aC5qb2luKHRoaXMuX3NjcmlwdFByZWZpeCwgc2NyaXB0c1tpXSk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRlci5sb2FkKHNjcmlwdFVybCwgJ3NjcmlwdCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbXMuc2NyaXB0LnByZWxvYWRpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzZXQgYXBwbGljYXRpb24gcHJvcGVydGllcyBmcm9tIGRhdGEgZmlsZVxuICAgIF9wYXJzZUFwcGxpY2F0aW9uUHJvcGVydGllcyhwcm9wcywgY2FsbGJhY2spIHtcbiAgICAgICAgLy8gY29uZmlndXJlIHJldHJ5aW5nIGFzc2V0c1xuICAgICAgICBpZiAodHlwZW9mIHByb3BzLm1heEFzc2V0UmV0cmllcyA9PT0gJ251bWJlcicgJiYgcHJvcHMubWF4QXNzZXRSZXRyaWVzID4gMCkge1xuICAgICAgICAgICAgdGhpcy5sb2FkZXIuZW5hYmxlUmV0cnkocHJvcHMubWF4QXNzZXRSZXRyaWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIHRlbXBvcmFyeSBibG9jayBhZnRlciBtaWdyYXRpbmcgcHJvcGVydGllc1xuICAgICAgICBpZiAoIXByb3BzLnVzZURldmljZVBpeGVsUmF0aW8pXG4gICAgICAgICAgICBwcm9wcy51c2VEZXZpY2VQaXhlbFJhdGlvID0gcHJvcHMudXNlX2RldmljZV9waXhlbF9yYXRpbztcbiAgICAgICAgaWYgKCFwcm9wcy5yZXNvbHV0aW9uTW9kZSlcbiAgICAgICAgICAgIHByb3BzLnJlc29sdXRpb25Nb2RlID0gcHJvcHMucmVzb2x1dGlvbl9tb2RlO1xuICAgICAgICBpZiAoIXByb3BzLmZpbGxNb2RlKVxuICAgICAgICAgICAgcHJvcHMuZmlsbE1vZGUgPSBwcm9wcy5maWxsX21vZGU7XG5cbiAgICAgICAgdGhpcy5fd2lkdGggPSBwcm9wcy53aWR0aDtcbiAgICAgICAgdGhpcy5faGVpZ2h0ID0gcHJvcHMuaGVpZ2h0O1xuICAgICAgICBpZiAocHJvcHMudXNlRGV2aWNlUGl4ZWxSYXRpbykge1xuICAgICAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5tYXhQaXhlbFJhdGlvID0gd2luZG93LmRldmljZVBpeGVsUmF0aW87XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnNldENhbnZhc1Jlc29sdXRpb24ocHJvcHMucmVzb2x1dGlvbk1vZGUsIHRoaXMuX3dpZHRoLCB0aGlzLl9oZWlnaHQpO1xuICAgICAgICB0aGlzLnNldENhbnZhc0ZpbGxNb2RlKHByb3BzLmZpbGxNb2RlLCB0aGlzLl93aWR0aCwgdGhpcy5faGVpZ2h0KTtcblxuICAgICAgICAvLyBzZXQgdXAgbGF5ZXJzXG4gICAgICAgIGlmIChwcm9wcy5sYXllcnMgJiYgcHJvcHMubGF5ZXJPcmRlcikge1xuICAgICAgICAgICAgY29uc3QgY29tcG9zaXRpb24gPSBuZXcgTGF5ZXJDb21wb3NpdGlvbihcImFwcGxpY2F0aW9uXCIpO1xuXG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IGluIHByb3BzLmxheWVycykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBwcm9wcy5sYXllcnNba2V5XTtcbiAgICAgICAgICAgICAgICBkYXRhLmlkID0gcGFyc2VJbnQoa2V5LCAxMCk7XG4gICAgICAgICAgICAgICAgLy8gZGVwdGggbGF5ZXIgc2hvdWxkIG9ubHkgYmUgZW5hYmxlZCB3aGVuIG5lZWRlZFxuICAgICAgICAgICAgICAgIC8vIGJ5IGluY3JlbWVudGluZyBpdHMgcmVmIGNvdW50ZXJcbiAgICAgICAgICAgICAgICBkYXRhLmVuYWJsZWQgPSBkYXRhLmlkICE9PSBMQVlFUklEX0RFUFRIO1xuICAgICAgICAgICAgICAgIGxheWVyc1trZXldID0gbmV3IExheWVyKGRhdGEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcHJvcHMubGF5ZXJPcmRlci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1YmxheWVyID0gcHJvcHMubGF5ZXJPcmRlcltpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyc1tzdWJsYXllci5sYXllcl07XG4gICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3VibGF5ZXIudHJhbnNwYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29tcG9zaXRpb24ucHVzaFRyYW5zcGFyZW50KGxheWVyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5wdXNoT3BhcXVlKGxheWVyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb21wb3NpdGlvbi5zdWJMYXllckVuYWJsZWRbaV0gPSBzdWJsYXllci5lbmFibGVkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnNjZW5lLmxheWVycyA9IGNvbXBvc2l0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIGJhdGNoIGdyb3Vwc1xuICAgICAgICBpZiAocHJvcHMuYmF0Y2hHcm91cHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGJhdGNoZXIgPSB0aGlzLmJhdGNoZXI7XG4gICAgICAgICAgICBpZiAoYmF0Y2hlcikge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwcm9wcy5iYXRjaEdyb3Vwcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBncnAgPSBwcm9wcy5iYXRjaEdyb3Vwc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgYmF0Y2hlci5hZGRHcm91cChncnAubmFtZSwgZ3JwLmR5bmFtaWMsIGdycC5tYXhBYWJiU2l6ZSwgZ3JwLmlkLCBncnAubGF5ZXJzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgbG9jYWxpemF0aW9uIGFzc2V0c1xuICAgICAgICBpZiAocHJvcHMuaTE4bkFzc2V0cykge1xuICAgICAgICAgICAgdGhpcy5pMThuLmFzc2V0cyA9IHByb3BzLmkxOG5Bc3NldHM7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9sb2FkTGlicmFyaWVzKHByb3BzLmxpYnJhcmllcywgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IHVybHMgLSBMaXN0IG9mIFVSTHMgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIENhbGxiYWNrIGZ1bmN0aW9uLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xvYWRMaWJyYXJpZXModXJscywgY2FsbGJhY2spIHtcbiAgICAgICAgY29uc3QgbGVuID0gdXJscy5sZW5ndGg7XG4gICAgICAgIGxldCBjb3VudCA9IGxlbjtcblxuICAgICAgICBjb25zdCByZWdleCA9IC9eaHR0cChzKT86XFwvXFwvLztcblxuICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICBjb25zdCBvbkxvYWQgPSAoZXJyLCBzY3JpcHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb3VudC0tO1xuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvdW50ID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobnVsbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgICAgIGxldCB1cmwgPSB1cmxzW2ldO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFyZWdleC50ZXN0KHVybC50b0xvd2VyQ2FzZSgpKSAmJiB0aGlzLl9zY3JpcHRQcmVmaXgpXG4gICAgICAgICAgICAgICAgICAgIHVybCA9IHBhdGguam9pbih0aGlzLl9zY3JpcHRQcmVmaXgsIHVybCk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwgJ3NjcmlwdCcsIG9uTG9hZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm9uTGlicmFyaWVzTG9hZGVkKCk7XG4gICAgICAgICAgICBjYWxsYmFjayhudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluc2VydCBzY2VuZSBuYW1lL3VybHMgaW50byB0aGUgcmVnaXN0cnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0geyp9IHNjZW5lcyAtIFNjZW5lcyB0byBhZGQgdG8gdGhlIHNjZW5lIHJlZ2lzdHJ5LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlU2NlbmVzKHNjZW5lcykge1xuICAgICAgICBpZiAoIXNjZW5lcykgcmV0dXJuO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2NlbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLnNjZW5lcy5hZGQoc2NlbmVzW2ldLm5hbWUsIHNjZW5lc1tpXS51cmwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0IGFzc2V0cyBpbnRvIHJlZ2lzdHJ5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHsqfSBhc3NldHMgLSBBc3NldHMgdG8gaW5zZXJ0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlQXNzZXRzKGFzc2V0cykge1xuICAgICAgICBjb25zdCBsaXN0ID0gW107XG5cbiAgICAgICAgY29uc3Qgc2NyaXB0c0luZGV4ID0ge307XG4gICAgICAgIGNvbnN0IGJ1bmRsZXNJbmRleCA9IHt9O1xuXG4gICAgICAgIGlmICghc2NyaXB0LmxlZ2FjeSkge1xuICAgICAgICAgICAgLy8gYWRkIHNjcmlwdHMgaW4gb3JkZXIgb2YgbG9hZGluZyBmaXJzdFxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNjcmlwdHNPcmRlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gdGhpcy5zY3JpcHRzT3JkZXJbaV07XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldHNbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIHNjcmlwdHNJbmRleFtpZF0gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgYnVuZGxlc1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlQnVuZGxlcykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldHNbaWRdLnR5cGUgPT09ICdidW5kbGUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBidW5kbGVzSW5kZXhbaWRdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdGhlbiBhZGQgcmVzdCBvZiBhc3NldHNcbiAgICAgICAgICAgIGZvciAoY29uc3QgaWQgaW4gYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHNjcmlwdHNJbmRleFtpZF0gfHwgYnVuZGxlc0luZGV4W2lkXSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVCdW5kbGVzKSB7XG4gICAgICAgICAgICAgICAgLy8gYWRkIGJ1bmRsZXNcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRzW2lkXS50eXBlID09PSAnYnVuZGxlJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgYnVuZGxlc0luZGV4W2lkXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaXN0LnB1c2goYXNzZXRzW2lkXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRoZW4gYWRkIHJlc3Qgb2YgYXNzZXRzXG4gICAgICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGFzc2V0cykge1xuICAgICAgICAgICAgICAgIGlmIChidW5kbGVzSW5kZXhbaWRdKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGxpc3QucHVzaChhc3NldHNbaWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGxpc3RbaV07XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IG5ldyBBc3NldChkYXRhLm5hbWUsIGRhdGEudHlwZSwgZGF0YS5maWxlLCBkYXRhLmRhdGEpO1xuICAgICAgICAgICAgYXNzZXQuaWQgPSBwYXJzZUludChkYXRhLmlkLCAxMCk7XG4gICAgICAgICAgICBhc3NldC5wcmVsb2FkID0gZGF0YS5wcmVsb2FkID8gZGF0YS5wcmVsb2FkIDogZmFsc2U7XG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGEgc2NyaXB0IGFzc2V0IGFuZCBoYXMgYWxyZWFkeSBiZWVuIGVtYmVkZGVkIGluIHRoZSBwYWdlIHRoZW5cbiAgICAgICAgICAgIC8vIG1hcmsgaXQgYXMgbG9hZGVkXG4gICAgICAgICAgICBhc3NldC5sb2FkZWQgPSBkYXRhLnR5cGUgPT09ICdzY3JpcHQnICYmIGRhdGEuZGF0YSAmJiBkYXRhLmRhdGEubG9hZGluZ1R5cGUgPiAwO1xuICAgICAgICAgICAgLy8gdGFnc1xuICAgICAgICAgICAgYXNzZXQudGFncy5hZGQoZGF0YS50YWdzKTtcbiAgICAgICAgICAgIC8vIGkxOG5cbiAgICAgICAgICAgIGlmIChkYXRhLmkxOG4pIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGxvY2FsZSBpbiBkYXRhLmkxOG4pIHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXQuYWRkTG9jYWxpemVkQXNzZXRJZChsb2NhbGUsIGRhdGEuaTE4bltsb2NhbGVdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyByZWdpc3RyeVxuICAgICAgICAgICAgdGhpcy5hc3NldHMuYWRkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gLSBUaGUgbGlzdCBvZiBzY3JpcHRzIHRoYXQgYXJlIHJlZmVyZW5jZWQgYnkgdGhlIHNjZW5lLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFNjcmlwdFJlZmVyZW5jZXMoc2NlbmUpIHtcbiAgICAgICAgbGV0IHByaW9yaXR5U2NyaXB0cyA9IFtdO1xuICAgICAgICBpZiAoc2NlbmUuc2V0dGluZ3MucHJpb3JpdHlfc2NyaXB0cykge1xuICAgICAgICAgICAgcHJpb3JpdHlTY3JpcHRzID0gc2NlbmUuc2V0dGluZ3MucHJpb3JpdHlfc2NyaXB0cztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IF9zY3JpcHRzID0gW107XG4gICAgICAgIGNvbnN0IF9pbmRleCA9IHt9O1xuXG4gICAgICAgIC8vIGZpcnN0IGFkZCBwcmlvcml0eSBzY3JpcHRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJpb3JpdHlTY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBfc2NyaXB0cy5wdXNoKHByaW9yaXR5U2NyaXB0c1tpXSk7XG4gICAgICAgICAgICBfaW5kZXhbcHJpb3JpdHlTY3JpcHRzW2ldXSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0aGVuIGl0ZXJhdGUgaGllcmFyY2h5IHRvIGdldCByZWZlcmVuY2VkIHNjcmlwdHNcbiAgICAgICAgY29uc3QgZW50aXRpZXMgPSBzY2VuZS5lbnRpdGllcztcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZW50aXRpZXMpIHtcbiAgICAgICAgICAgIGlmICghZW50aXRpZXNba2V5XS5jb21wb25lbnRzLnNjcmlwdCkge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzY3JpcHRzID0gZW50aXRpZXNba2V5XS5jb21wb25lbnRzLnNjcmlwdC5zY3JpcHRzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY3JpcHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKF9pbmRleFtzY3JpcHRzW2ldLnVybF0pXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIF9zY3JpcHRzLnB1c2goc2NyaXB0c1tpXS51cmwpO1xuICAgICAgICAgICAgICAgIF9pbmRleFtzY3JpcHRzW2ldLnVybF0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIF9zY3JpcHRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IHRoZSBhcHBsaWNhdGlvbi4gVGhpcyBmdW5jdGlvbiBkb2VzIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAxLiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ3N0YXJ0J1xuICAgICAqIDIuIENhbGxzIGluaXRpYWxpemUgZm9yIGFsbCBjb21wb25lbnRzIG9uIGVudGl0aWVzIGluIHRoZSBoaWVyYXJjaHlcbiAgICAgKiAzLiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ2luaXRpYWxpemUnXG4gICAgICogNC4gQ2FsbHMgcG9zdEluaXRpYWxpemUgZm9yIGFsbCBjb21wb25lbnRzIG9uIGVudGl0aWVzIGluIHRoZSBoaWVyYXJjaHlcbiAgICAgKiA1LiBGaXJlcyBhbiBldmVudCBvbiB0aGUgYXBwbGljYXRpb24gbmFtZWQgJ3Bvc3Rpbml0aWFsaXplJ1xuICAgICAqIDYuIFN0YXJ0cyBleGVjdXRpbmcgdGhlIG1haW4gbG9vcCBvZiB0aGUgYXBwbGljYXRpb25cbiAgICAgKlxuICAgICAqIFRoaXMgZnVuY3Rpb24gaXMgY2FsbGVkIGludGVybmFsbHkgYnkgUGxheUNhbnZhcyBhcHBsaWNhdGlvbnMgbWFkZSBpbiB0aGUgRWRpdG9yIGJ1dCB5b3VcbiAgICAgKiB3aWxsIG5lZWQgdG8gY2FsbCBzdGFydCB5b3Vyc2VsZiBpZiB5b3UgYXJlIHVzaW5nIHRoZSBlbmdpbmUgc3RhbmQtYWxvbmUuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGFwcC5zdGFydCgpO1xuICAgICAqL1xuICAgIHN0YXJ0KCkge1xuXG4gICAgICAgIERlYnVnLmNhbGwoKCkgPT4ge1xuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KCF0aGlzLl9hbHJlYWR5U3RhcnRlZCwgXCJUaGUgYXBwbGljYXRpb24gY2FuIGJlIHN0YXJ0ZWQgb25seSBvbmUgdGltZS5cIik7XG4gICAgICAgICAgICB0aGlzLl9hbHJlYWR5U3RhcnRlZCA9IHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuZnJhbWUgPSAwO1xuXG4gICAgICAgIHRoaXMuZmlyZShcInN0YXJ0XCIsIHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbm93KCksXG4gICAgICAgICAgICB0YXJnZXQ6IHRoaXNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9saWJyYXJpZXNMb2FkZWQpIHtcbiAgICAgICAgICAgIHRoaXMub25MaWJyYXJpZXNMb2FkZWQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc3lzdGVtcy5maXJlKCdpbml0aWFsaXplJywgdGhpcy5yb290KTtcbiAgICAgICAgdGhpcy5maXJlKCdpbml0aWFsaXplJyk7XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ3Bvc3RJbml0aWFsaXplJywgdGhpcy5yb290KTtcbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ3Bvc3RQb3N0SW5pdGlhbGl6ZScsIHRoaXMucm9vdCk7XG4gICAgICAgIHRoaXMuZmlyZSgncG9zdGluaXRpYWxpemUnKTtcblxuICAgICAgICB0aGlzLnRpY2soKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgYWxsIGlucHV0IGRldmljZXMgbWFuYWdlZCBieSB0aGUgYXBwbGljYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgdGltZSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IHVwZGF0ZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGlucHV0VXBkYXRlKGR0KSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlci51cGRhdGUoZHQpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLm1vdXNlKSB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmtleWJvYXJkKSB7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmdhbWVwYWRzKSB7XG4gICAgICAgICAgICB0aGlzLmdhbWVwYWRzLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSBhcHBsaWNhdGlvbi4gVGhpcyBmdW5jdGlvbiB3aWxsIGNhbGwgdGhlIHVwZGF0ZSBmdW5jdGlvbnMgYW5kIHRoZW4gdGhlIHBvc3RVcGRhdGVcbiAgICAgKiBmdW5jdGlvbnMgb2YgYWxsIGVuYWJsZWQgY29tcG9uZW50cy4gSXQgd2lsbCB0aGVuIHVwZGF0ZSB0aGUgY3VycmVudCBzdGF0ZSBvZiBhbGwgY29ubmVjdGVkXG4gICAgICogaW5wdXQgZGV2aWNlcy4gVGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgaW50ZXJuYWxseSBpbiB0aGUgYXBwbGljYXRpb24ncyBtYWluIGxvb3AgYW5kIGRvZXNcbiAgICAgKiBub3QgbmVlZCB0byBiZSBjYWxsZWQgZXhwbGljaXRseS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdCAtIFRoZSB0aW1lIGRlbHRhIGluIHNlY29uZHMgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICovXG4gICAgdXBkYXRlKGR0KSB7XG4gICAgICAgIHRoaXMuZnJhbWUrKztcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLnVwZGF0ZUNsaWVudFJlY3QoKTtcblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIHRoaXMuc3RhdHMuZnJhbWUudXBkYXRlU3RhcnQgPSBub3coKTtcbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgLy8gUGVyZm9ybSBDb21wb25lbnRTeXN0ZW0gdXBkYXRlXG4gICAgICAgIGlmIChzY3JpcHQubGVnYWN5KVxuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUoJ2ZpeGVkVXBkYXRlJywgMS4wIC8gNjAuMCk7XG5cbiAgICAgICAgdGhpcy5zeXN0ZW1zLmZpcmUodGhpcy5faW5Ub29scyA/ICd0b29sc1VwZGF0ZScgOiAndXBkYXRlJywgZHQpO1xuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgnYW5pbWF0aW9uVXBkYXRlJywgZHQpO1xuICAgICAgICB0aGlzLnN5c3RlbXMuZmlyZSgncG9zdFVwZGF0ZScsIGR0KTtcblxuICAgICAgICAvLyBmaXJlIHVwZGF0ZSBldmVudFxuICAgICAgICB0aGlzLmZpcmUoXCJ1cGRhdGVcIiwgZHQpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSBpbnB1dCBkZXZpY2VzXG4gICAgICAgIHRoaXMuaW5wdXRVcGRhdGUoZHQpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS51cGRhdGVUaW1lID0gbm93KCkgLSB0aGlzLnN0YXRzLmZyYW1lLnVwZGF0ZVN0YXJ0O1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICBmcmFtZVN0YXJ0KCkge1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmZyYW1lU3RhcnQoKTtcbiAgICB9XG5cbiAgICBmcmFtZUVuZCgpIHtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5mcmFtZUVuZCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbmRlciB0aGUgYXBwbGljYXRpb24ncyBzY2VuZS4gTW9yZSBzcGVjaWZpY2FsbHksIHRoZSBzY2VuZSdzIHtAbGluayBMYXllckNvbXBvc2l0aW9ufSBpc1xuICAgICAqIHJlbmRlcmVkLiBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBpbnRlcm5hbGx5IGluIHRoZSBhcHBsaWNhdGlvbidzIG1haW4gbG9vcCBhbmQgZG9lcyBub3RcbiAgICAgKiBuZWVkIHRvIGJlIGNhbGxlZCBleHBsaWNpdGx5LlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHJlbmRlcigpIHtcbiAgICAgICAgLy8gI2lmIF9QUk9GSUxFUlxuICAgICAgICB0aGlzLnN0YXRzLmZyYW1lLnJlbmRlclN0YXJ0ID0gbm93KCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIHRoaXMuZmlyZSgncHJlcmVuZGVyJyk7XG4gICAgICAgIHRoaXMucm9vdC5zeW5jSGllcmFyY2h5KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIudXBkYXRlQWxsKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAjaWYgX1BST0ZJTEVSXG4gICAgICAgIEZvcndhcmRSZW5kZXJlci5fc2tpcFJlbmRlckNvdW50ZXIgPSAwO1xuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICAvLyByZW5kZXIgdGhlIHNjZW5lIGNvbXBvc2l0aW9uXG4gICAgICAgIHRoaXMucmVuZGVyQ29tcG9zaXRpb24odGhpcy5zY2VuZS5sYXllcnMpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgncG9zdHJlbmRlcicpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgdGhpcy5zdGF0cy5mcmFtZS5yZW5kZXJUaW1lID0gbm93KCkgLSB0aGlzLnN0YXRzLmZyYW1lLnJlbmRlclN0YXJ0O1xuICAgICAgICAvLyAjZW5kaWZcbiAgICB9XG5cbiAgICAvLyByZW5kZXIgYSBsYXllciBjb21wb3NpdGlvblxuICAgIHJlbmRlckNvbXBvc2l0aW9uKGxheWVyQ29tcG9zaXRpb24pIHtcbiAgICAgICAgRGVidWdHcmFwaGljcy5jbGVhckdwdU1hcmtlcnMoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5idWlsZEZyYW1lR3JhcGgodGhpcy5mcmFtZUdyYXBoLCBsYXllckNvbXBvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5mcmFtZUdyYXBoLnJlbmRlcih0aGlzLmdyYXBoaWNzRGV2aWNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbm93IC0gVGhlIHRpbWVzdGFtcCBwYXNzZWQgdG8gdGhlIHJlcXVlc3RBbmltYXRpb25GcmFtZSBjYWxsYmFjay5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHQgLSBUaGUgdGltZSBkZWx0YSBpbiBzZWNvbmRzIHNpbmNlIHRoZSBsYXN0IGZyYW1lLiBUaGlzIGlzIHN1YmplY3QgdG8gdGhlXG4gICAgICogYXBwbGljYXRpb24ncyB0aW1lIHNjYWxlIGFuZCBtYXggZGVsdGEgdmFsdWVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtcyAtIFRoZSB0aW1lIGluIG1pbGxpc2Vjb25kcyBzaW5jZSB0aGUgbGFzdCBmcmFtZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9maWxsRnJhbWVTdGF0c0Jhc2ljKG5vdywgZHQsIG1zKSB7XG4gICAgICAgIC8vIFRpbWluZyBzdGF0c1xuICAgICAgICBjb25zdCBzdGF0cyA9IHRoaXMuc3RhdHMuZnJhbWU7XG4gICAgICAgIHN0YXRzLmR0ID0gZHQ7XG4gICAgICAgIHN0YXRzLm1zID0gbXM7XG4gICAgICAgIGlmIChub3cgPiBzdGF0cy5fdGltZVRvQ291bnRGcmFtZXMpIHtcbiAgICAgICAgICAgIHN0YXRzLmZwcyA9IHN0YXRzLl9mcHNBY2N1bTtcbiAgICAgICAgICAgIHN0YXRzLl9mcHNBY2N1bSA9IDA7XG4gICAgICAgICAgICBzdGF0cy5fdGltZVRvQ291bnRGcmFtZXMgPSBub3cgKyAxMDAwO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdHMuX2Zwc0FjY3VtKys7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB0b3RhbCBkcmF3IGNhbGxcbiAgICAgICAgdGhpcy5zdGF0cy5kcmF3Q2FsbHMudG90YWwgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLl9kcmF3Q2FsbHNQZXJGcmFtZTtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5fZHJhd0NhbGxzUGVyRnJhbWUgPSAwO1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9maWxsRnJhbWVTdGF0cygpIHtcbiAgICAgICAgbGV0IHN0YXRzID0gdGhpcy5zdGF0cy5mcmFtZTtcblxuICAgICAgICAvLyBSZW5kZXIgc3RhdHNcbiAgICAgICAgc3RhdHMuY2FtZXJhcyA9IHRoaXMucmVuZGVyZXIuX2NhbWVyYXNSZW5kZXJlZDtcbiAgICAgICAgc3RhdHMubWF0ZXJpYWxzID0gdGhpcy5yZW5kZXJlci5fbWF0ZXJpYWxTd2l0Y2hlcztcbiAgICAgICAgc3RhdHMuc2hhZGVycyA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuX3NoYWRlclN3aXRjaGVzUGVyRnJhbWU7XG4gICAgICAgIHN0YXRzLnNoYWRvd01hcFVwZGF0ZXMgPSB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzO1xuICAgICAgICBzdGF0cy5zaGFkb3dNYXBUaW1lID0gdGhpcy5yZW5kZXJlci5fc2hhZG93TWFwVGltZTtcbiAgICAgICAgc3RhdHMuZGVwdGhNYXBUaW1lID0gdGhpcy5yZW5kZXJlci5fZGVwdGhNYXBUaW1lO1xuICAgICAgICBzdGF0cy5mb3J3YXJkVGltZSA9IHRoaXMucmVuZGVyZXIuX2ZvcndhcmRUaW1lO1xuICAgICAgICBjb25zdCBwcmltcyA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UuX3ByaW1zUGVyRnJhbWU7XG4gICAgICAgIHN0YXRzLnRyaWFuZ2xlcyA9IHByaW1zW1BSSU1JVElWRV9UUklBTkdMRVNdIC8gMyArXG4gICAgICAgICAgICBNYXRoLm1heChwcmltc1tQUklNSVRJVkVfVFJJU1RSSVBdIC0gMiwgMCkgK1xuICAgICAgICAgICAgTWF0aC5tYXgocHJpbXNbUFJJTUlUSVZFX1RSSUZBTl0gLSAyLCAwKTtcbiAgICAgICAgc3RhdHMuY3VsbFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9jdWxsVGltZTtcbiAgICAgICAgc3RhdHMuc29ydFRpbWUgPSB0aGlzLnJlbmRlcmVyLl9zb3J0VGltZTtcbiAgICAgICAgc3RhdHMuc2tpblRpbWUgPSB0aGlzLnJlbmRlcmVyLl9za2luVGltZTtcbiAgICAgICAgc3RhdHMubW9ycGhUaW1lID0gdGhpcy5yZW5kZXJlci5fbW9ycGhUaW1lO1xuICAgICAgICBzdGF0cy5saWdodENsdXN0ZXJzID0gdGhpcy5yZW5kZXJlci5fbGlnaHRDbHVzdGVycztcbiAgICAgICAgc3RhdHMubGlnaHRDbHVzdGVyc1RpbWUgPSB0aGlzLnJlbmRlcmVyLl9saWdodENsdXN0ZXJzVGltZTtcbiAgICAgICAgc3RhdHMub3RoZXJQcmltaXRpdmVzID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmltcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPCBQUklNSVRJVkVfVFJJQU5HTEVTKSB7XG4gICAgICAgICAgICAgICAgc3RhdHMub3RoZXJQcmltaXRpdmVzICs9IHByaW1zW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcHJpbXNbaV0gPSAwO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2NhbWVyYXNSZW5kZXJlZCA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX21hdGVyaWFsU3dpdGNoZXMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBVcGRhdGVzID0gMDtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZS5fc2hhZGVyU3dpdGNoZXNQZXJGcmFtZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2N1bGxUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fbGF5ZXJDb21wb3NpdGlvblVwZGF0ZVRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9saWdodENsdXN0ZXJzVGltZSA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NvcnRUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2tpblRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9tb3JwaFRpbWUgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9zaGFkb3dNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fZGVwdGhNYXBUaW1lID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fZm9yd2FyZFRpbWUgPSAwO1xuXG4gICAgICAgIC8vIERyYXcgY2FsbCBzdGF0c1xuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHMuZHJhd0NhbGxzO1xuICAgICAgICBzdGF0cy5mb3J3YXJkID0gdGhpcy5yZW5kZXJlci5fZm9yd2FyZERyYXdDYWxscztcbiAgICAgICAgc3RhdHMuY3VsbGVkID0gdGhpcy5yZW5kZXJlci5fbnVtRHJhd0NhbGxzQ3VsbGVkO1xuICAgICAgICBzdGF0cy5kZXB0aCA9IDA7XG4gICAgICAgIHN0YXRzLnNoYWRvdyA9IHRoaXMucmVuZGVyZXIuX3NoYWRvd0RyYXdDYWxscztcbiAgICAgICAgc3RhdHMuc2tpbm5lZCA9IHRoaXMucmVuZGVyZXIuX3NraW5EcmF3Q2FsbHM7XG4gICAgICAgIHN0YXRzLmltbWVkaWF0ZSA9IDA7XG4gICAgICAgIHN0YXRzLmluc3RhbmNlZCA9IDA7XG4gICAgICAgIHN0YXRzLnJlbW92ZWRCeUluc3RhbmNpbmcgPSAwO1xuICAgICAgICBzdGF0cy5taXNjID0gc3RhdHMudG90YWwgLSAoc3RhdHMuZm9yd2FyZCArIHN0YXRzLnNoYWRvdyk7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2RlcHRoRHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fc2hhZG93RHJhd0NhbGxzID0gMDtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5fZm9yd2FyZERyYXdDYWxscyA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX251bURyYXdDYWxsc0N1bGxlZCA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX3NraW5EcmF3Q2FsbHMgPSAwO1xuICAgICAgICB0aGlzLnJlbmRlcmVyLl9pbW1lZGlhdGVSZW5kZXJlZCA9IDA7XG4gICAgICAgIHRoaXMucmVuZGVyZXIuX2luc3RhbmNlZERyYXdDYWxscyA9IDA7XG5cbiAgICAgICAgdGhpcy5zdGF0cy5taXNjLnJlbmRlclRhcmdldENyZWF0aW9uVGltZSA9IHRoaXMuZ3JhcGhpY3NEZXZpY2UucmVuZGVyVGFyZ2V0Q3JlYXRpb25UaW1lO1xuXG4gICAgICAgIHN0YXRzID0gdGhpcy5zdGF0cy5wYXJ0aWNsZXM7XG4gICAgICAgIHN0YXRzLnVwZGF0ZXNQZXJGcmFtZSA9IHN0YXRzLl91cGRhdGVzUGVyRnJhbWU7XG4gICAgICAgIHN0YXRzLmZyYW1lVGltZSA9IHN0YXRzLl9mcmFtZVRpbWU7XG4gICAgICAgIHN0YXRzLl91cGRhdGVzUGVyRnJhbWUgPSAwO1xuICAgICAgICBzdGF0cy5fZnJhbWVUaW1lID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb250cm9scyBob3cgdGhlIGNhbnZhcyBmaWxscyB0aGUgd2luZG93IGFuZCByZXNpemVzIHdoZW4gdGhlIHdpbmRvdyBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1vZGUgLSBUaGUgbW9kZSB0byB1c2Ugd2hlbiBzZXR0aW5nIHRoZSBzaXplIG9mIHRoZSBjYW52YXMuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX05PTkV9OiB0aGUgY2FudmFzIHdpbGwgYWx3YXlzIG1hdGNoIHRoZSBzaXplIHByb3ZpZGVkLlxuICAgICAqIC0ge0BsaW5rIEZJTExNT0RFX0ZJTExfV0lORE9XfTogdGhlIGNhbnZhcyB3aWxsIHNpbXBseSBmaWxsIHRoZSB3aW5kb3csIGNoYW5naW5nIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIHtAbGluayBGSUxMTU9ERV9LRUVQX0FTUEVDVH06IHRoZSBjYW52YXMgd2lsbCBncm93IHRvIGZpbGwgdGhlIHdpbmRvdyBhcyBiZXN0IGl0IGNhbiB3aGlsZVxuICAgICAqIG1haW50YWluaW5nIHRoZSBhc3BlY3QgcmF0aW8uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3dpZHRoXSAtIFRoZSB3aWR0aCBvZiB0aGUgY2FudmFzIChvbmx5IHVzZWQgd2hlbiBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfSkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtoZWlnaHRdIC0gVGhlIGhlaWdodCBvZiB0aGUgY2FudmFzIChvbmx5IHVzZWQgd2hlbiBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfSkuXG4gICAgICovXG4gICAgc2V0Q2FudmFzRmlsbE1vZGUobW9kZSwgd2lkdGgsIGhlaWdodCkge1xuICAgICAgICB0aGlzLl9maWxsTW9kZSA9IG1vZGU7XG4gICAgICAgIHRoaXMucmVzaXplQ2FudmFzKHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENoYW5nZSB0aGUgcmVzb2x1dGlvbiBvZiB0aGUgY2FudmFzLCBhbmQgc2V0IHRoZSB3YXkgaXQgYmVoYXZlcyB3aGVuIHRoZSB3aW5kb3cgaXMgcmVzaXplZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIC0gVGhlIG1vZGUgdG8gdXNlIHdoZW4gc2V0dGluZyB0aGUgcmVzb2x1dGlvbi4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUkVTT0xVVElPTl9BVVRPfTogaWYgd2lkdGggYW5kIGhlaWdodCBhcmUgbm90IHByb3ZpZGVkLCBjYW52YXMgd2lsbCBiZSByZXNpemVkIHRvXG4gICAgICogbWF0Y2ggY2FudmFzIGNsaWVudCBzaXplLlxuICAgICAqIC0ge0BsaW5rIFJFU09MVVRJT05fRklYRUR9OiByZXNvbHV0aW9uIG9mIGNhbnZhcyB3aWxsIGJlIGZpeGVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt3aWR0aF0gLSBUaGUgaG9yaXpvbnRhbCByZXNvbHV0aW9uLCBvcHRpb25hbCBpbiBBVVRPIG1vZGUsIGlmIG5vdCBwcm92aWRlZFxuICAgICAqIGNhbnZhcyBjbGllbnRXaWR0aCBpcyB1c2VkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaGVpZ2h0XSAtIFRoZSB2ZXJ0aWNhbCByZXNvbHV0aW9uLCBvcHRpb25hbCBpbiBBVVRPIG1vZGUsIGlmIG5vdCBwcm92aWRlZFxuICAgICAqIGNhbnZhcyBjbGllbnRIZWlnaHQgaXMgdXNlZC5cbiAgICAgKi9cbiAgICBzZXRDYW52YXNSZXNvbHV0aW9uKG1vZGUsIHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgdGhpcy5fcmVzb2x1dGlvbk1vZGUgPSBtb2RlO1xuXG4gICAgICAgIC8vIEluIEFVVE8gbW9kZSB0aGUgcmVzb2x1dGlvbiBpcyB0aGUgc2FtZSBhcyB0aGUgY2FudmFzIHNpemUsIHVubGVzcyBzcGVjaWZpZWRcbiAgICAgICAgaWYgKG1vZGUgPT09IFJFU09MVVRJT05fQVVUTyAmJiAod2lkdGggPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgICAgICAgIHdpZHRoID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuY2xpZW50V2lkdGg7XG4gICAgICAgICAgICBoZWlnaHQgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5jbGllbnRIZWlnaHQ7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLnJlc2l6ZUNhbnZhcyh3aWR0aCwgaGVpZ2h0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBRdWVyaWVzIHRoZSB2aXNpYmlsaXR5IG9mIHRoZSB3aW5kb3cgb3IgdGFiIGluIHdoaWNoIHRoZSBhcHBsaWNhdGlvbiBpcyBydW5uaW5nLlxuICAgICAqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGFwcGxpY2F0aW9uIGlzIG5vdCB2aXNpYmxlIGFuZCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgaXNIaWRkZW4oKSB7XG4gICAgICAgIHJldHVybiBkb2N1bWVudFt0aGlzLl9oaWRkZW5BdHRyXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgdmlzaWJpbGl0eSBzdGF0ZSBvZiB0aGUgY3VycmVudCB0YWIvd2luZG93IGNoYW5nZXMuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uVmlzaWJpbGl0eUNoYW5nZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuaXNIaWRkZW4oKSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3NvdW5kTWFuYWdlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5zdXNwZW5kKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fc291bmRNYW5hZ2VyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc291bmRNYW5hZ2VyLnJlc3VtZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzaXplIHRoZSBhcHBsaWNhdGlvbidzIGNhbnZhcyBlbGVtZW50IGluIGxpbmUgd2l0aCB0aGUgY3VycmVudCBmaWxsIG1vZGUuXG4gICAgICpcbiAgICAgKiAtIEluIHtAbGluayBGSUxMTU9ERV9LRUVQX0FTUEVDVH0gbW9kZSwgdGhlIGNhbnZhcyB3aWxsIGdyb3cgdG8gZmlsbCB0aGUgd2luZG93IGFzIGJlc3QgaXRcbiAgICAgKiBjYW4gd2hpbGUgbWFpbnRhaW5pbmcgdGhlIGFzcGVjdCByYXRpby5cbiAgICAgKiAtIEluIHtAbGluayBGSUxMTU9ERV9GSUxMX1dJTkRPV30gbW9kZSwgdGhlIGNhbnZhcyB3aWxsIHNpbXBseSBmaWxsIHRoZSB3aW5kb3csIGNoYW5naW5nXG4gICAgICogYXNwZWN0IHJhdGlvLlxuICAgICAqIC0gSW4ge0BsaW5rIEZJTExNT0RFX05PTkV9IG1vZGUsIHRoZSBjYW52YXMgd2lsbCBhbHdheXMgbWF0Y2ggdGhlIHNpemUgcHJvdmlkZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3dpZHRoXSAtIFRoZSB3aWR0aCBvZiB0aGUgY2FudmFzLiBPbmx5IHVzZWQgaWYgY3VycmVudCBmaWxsIG1vZGUgaXMge0BsaW5rIEZJTExNT0RFX05PTkV9LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgdGhlIGNhbnZhcy4gT25seSB1c2VkIGlmIGN1cnJlbnQgZmlsbCBtb2RlIGlzIHtAbGluayBGSUxMTU9ERV9OT05FfS5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSBBIG9iamVjdCBjb250YWluaW5nIHRoZSB2YWx1ZXMgY2FsY3VsYXRlZCB0byB1c2UgYXMgd2lkdGggYW5kIGhlaWdodC5cbiAgICAgKi9cbiAgICByZXNpemVDYW52YXMod2lkdGgsIGhlaWdodCkge1xuICAgICAgICBpZiAoIXRoaXMuX2FsbG93UmVzaXplKSByZXR1cm4gdW5kZWZpbmVkOyAvLyBwcmV2ZW50IHJlc2l6aW5nIChlLmcuIGlmIHByZXNlbnRpbmcgaW4gVlIgSE1EKVxuXG4gICAgICAgIC8vIHByZXZlbnQgcmVzaXppbmcgd2hlbiBpbiBYUiBzZXNzaW9uXG4gICAgICAgIGlmICh0aGlzLnhyICYmIHRoaXMueHIuc2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG5cbiAgICAgICAgY29uc3Qgd2luZG93V2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICAgICAgY29uc3Qgd2luZG93SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0O1xuXG4gICAgICAgIGlmICh0aGlzLl9maWxsTW9kZSA9PT0gRklMTE1PREVfS0VFUF9BU1BFQ1QpIHtcbiAgICAgICAgICAgIGNvbnN0IHIgPSB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy53aWR0aCAvIHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLmhlaWdodDtcbiAgICAgICAgICAgIGNvbnN0IHdpblIgPSB3aW5kb3dXaWR0aCAvIHdpbmRvd0hlaWdodDtcblxuICAgICAgICAgICAgaWYgKHIgPiB3aW5SKSB7XG4gICAgICAgICAgICAgICAgd2lkdGggPSB3aW5kb3dXaWR0aDtcbiAgICAgICAgICAgICAgICBoZWlnaHQgPSB3aWR0aCAvIHI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGhlaWdodCA9IHdpbmRvd0hlaWdodDtcbiAgICAgICAgICAgICAgICB3aWR0aCA9IGhlaWdodCAqIHI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fZmlsbE1vZGUgPT09IEZJTExNT0RFX0ZJTExfV0lORE9XKSB7XG4gICAgICAgICAgICB3aWR0aCA9IHdpbmRvd1dpZHRoO1xuICAgICAgICAgICAgaGVpZ2h0ID0gd2luZG93SGVpZ2h0O1xuICAgICAgICB9XG4gICAgICAgIC8vIE9USEVSV0lTRTogRklMTE1PREVfTk9ORSB1c2Ugd2lkdGggYW5kIGhlaWdodCB0aGF0IGFyZSBwcm92aWRlZFxuXG4gICAgICAgIHRoaXMuZ3JhcGhpY3NEZXZpY2UuY2FudmFzLnN0eWxlLndpZHRoID0gd2lkdGggKyAncHgnO1xuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmNhbnZhcy5zdHlsZS5oZWlnaHQgPSBoZWlnaHQgKyAncHgnO1xuXG4gICAgICAgIHRoaXMudXBkYXRlQ2FudmFzU2l6ZSgpO1xuXG4gICAgICAgIC8vIHJldHVybiB0aGUgZmluYWwgdmFsdWVzIGNhbGN1bGF0ZWQgZm9yIHdpZHRoIGFuZCBoZWlnaHRcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHdpZHRoOiB3aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlcyB0aGUge0BsaW5rIEdyYXBoaWNzRGV2aWNlfSBjYW52YXMgc2l6ZSB0byBtYXRjaCB0aGUgY2FudmFzIHNpemUgb24gdGhlIGRvY3VtZW50XG4gICAgICogcGFnZS4gSXQgaXMgcmVjb21tZW5kZWQgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIHdoZW4gdGhlIGNhbnZhcyBzaXplIGNoYW5nZXMgKGUuZyBvbiB3aW5kb3dcbiAgICAgKiByZXNpemUgYW5kIG9yaWVudGF0aW9uIGNoYW5nZSBldmVudHMpIHNvIHRoYXQgdGhlIGNhbnZhcyByZXNvbHV0aW9uIGlzIGltbWVkaWF0ZWx5IHVwZGF0ZWQuXG4gICAgICovXG4gICAgdXBkYXRlQ2FudmFzU2l6ZSgpIHtcbiAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIGlmIHdlIGFyZSBpbiBWUiBvciBYUlxuICAgICAgICBpZiAoKCF0aGlzLl9hbGxvd1Jlc2l6ZSkgfHwgKHRoaXMueHI/LmFjdGl2ZSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEluIEFVVE8gbW9kZSB0aGUgcmVzb2x1dGlvbiBpcyBjaGFuZ2VkIHRvIG1hdGNoIHRoZSBjYW52YXMgc2l6ZVxuICAgICAgICBpZiAodGhpcy5fcmVzb2x1dGlvbk1vZGUgPT09IFJFU09MVVRJT05fQVVUTykge1xuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIGNhbnZhcyBET00gaGFzIGNoYW5nZWQgc2l6ZVxuICAgICAgICAgICAgY29uc3QgY2FudmFzID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXM7XG4gICAgICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLnJlc2l6ZUNhbnZhcyhjYW52YXMuY2xpZW50V2lkdGgsIGNhbnZhcy5jbGllbnRIZWlnaHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXZlbnQgaGFuZGxlciBjYWxsZWQgd2hlbiBhbGwgY29kZSBsaWJyYXJpZXMgaGF2ZSBiZWVuIGxvYWRlZC4gQ29kZSBsaWJyYXJpZXMgYXJlIHBhc3NlZFxuICAgICAqIGludG8gdGhlIGNvbnN0cnVjdG9yIG9mIHRoZSBBcHBsaWNhdGlvbiBhbmQgdGhlIGFwcGxpY2F0aW9uIHdvbid0IHN0YXJ0IHJ1bm5pbmcgb3IgbG9hZFxuICAgICAqIHBhY2tzIHVudGlsIGFsbCBsaWJyYXJpZXMgaGF2ZSBiZWVuIGxvYWRlZC5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgb25MaWJyYXJpZXNMb2FkZWQoKSB7XG4gICAgICAgIHRoaXMuX2xpYnJhcmllc0xvYWRlZCA9IHRydWU7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtcy5yaWdpZGJvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtcy5yaWdpZGJvZHkub25MaWJyYXJ5TG9hZGVkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBzY2VuZSBzZXR0aW5ncyB0byB0aGUgY3VycmVudCBzY2VuZS4gVXNlZnVsIHdoZW4geW91ciBzY2VuZSBzZXR0aW5ncyBhcmUgcGFyc2VkIG9yXG4gICAgICogZ2VuZXJhdGVkIGZyb20gYSBub24tVVJMIHNvdXJjZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzZXR0aW5ncyAtIFRoZSBzY2VuZSBzZXR0aW5ncyB0byBiZSBhcHBsaWVkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzZXR0aW5ncy5waHlzaWNzIC0gVGhlIHBoeXNpY3Mgc2V0dGluZ3MgdG8gYmUgYXBwbGllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcltdfSBzZXR0aW5ncy5waHlzaWNzLmdyYXZpdHkgLSBUaGUgd29ybGQgc3BhY2UgdmVjdG9yIHJlcHJlc2VudGluZyBnbG9iYWxcbiAgICAgKiBncmF2aXR5IGluIHRoZSBwaHlzaWNzIHNpbXVsYXRpb24uIE11c3QgYmUgYSBmaXhlZCBzaXplIGFycmF5IHdpdGggdGhyZWUgbnVtYmVyIGVsZW1lbnRzLFxuICAgICAqIGNvcnJlc3BvbmRpbmcgdG8gZWFjaCBheGlzIFsgWCwgWSwgWiBdLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBzZXR0aW5ncy5yZW5kZXIgLSBUaGUgcmVuZGVyaW5nIHNldHRpbmdzIHRvIGJlIGFwcGxpZWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gc2V0dGluZ3MucmVuZGVyLmdsb2JhbF9hbWJpZW50IC0gVGhlIGNvbG9yIG9mIHRoZSBzY2VuZSdzIGFtYmllbnQgbGlnaHQuXG4gICAgICogTXVzdCBiZSBhIGZpeGVkIHNpemUgYXJyYXkgd2l0aCB0aHJlZSBudW1iZXIgZWxlbWVudHMsIGNvcnJlc3BvbmRpbmcgdG8gZWFjaCBjb2xvciBjaGFubmVsXG4gICAgICogWyBSLCBHLCBCIF0uXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNldHRpbmdzLnJlbmRlci5mb2cgLSBUaGUgdHlwZSBvZiBmb2cgdXNlZCBieSB0aGUgc2NlbmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZPR19OT05FfVxuICAgICAqIC0ge0BsaW5rIEZPR19MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRk9HX0VYUH1cbiAgICAgKiAtIHtAbGluayBGT0dfRVhQMn1cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnJlbmRlci5mb2dfY29sb3IgLSBUaGUgY29sb3Igb2YgdGhlIGZvZyAoaWYgZW5hYmxlZCkuIE11c3QgYmUgYVxuICAgICAqIGZpeGVkIHNpemUgYXJyYXkgd2l0aCB0aHJlZSBudW1iZXIgZWxlbWVudHMsIGNvcnJlc3BvbmRpbmcgdG8gZWFjaCBjb2xvciBjaGFubmVsIFsgUiwgRywgQiBdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuZm9nX2RlbnNpdHkgLSBUaGUgZGVuc2l0eSBvZiB0aGUgZm9nIChpZiBlbmFibGVkKS4gVGhpc1xuICAgICAqIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19FWFB9IG9yIHtAbGluayBGT0dfRVhQMn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5mb2dfc3RhcnQgLSBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdmlld3BvaW50IHdoZXJlIGxpbmVhciBmb2dcbiAgICAgKiBiZWdpbnMuIFRoaXMgcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGUgZm9nIHByb3BlcnR5IGlzIHNldCB0byB7QGxpbmsgRk9HX0xJTkVBUn0uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5mb2dfZW5kIC0gVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCB3aGVyZSBsaW5lYXIgZm9nXG4gICAgICogcmVhY2hlcyBpdHMgbWF4aW11bS4gVGhpcyBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfTElORUFSfS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmdhbW1hX2NvcnJlY3Rpb24gLSBUaGUgZ2FtbWEgY29ycmVjdGlvbiB0byBhcHBseSB3aGVuXG4gICAgICogcmVuZGVyaW5nIHRoZSBzY2VuZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgR0FNTUFfTk9ORX1cbiAgICAgKiAtIHtAbGluayBHQU1NQV9TUkdCfVxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci50b25lbWFwcGluZyAtIFRoZSB0b25lbWFwcGluZyB0cmFuc2Zvcm0gdG8gYXBwbHkgd2hlblxuICAgICAqIHdyaXRpbmcgZnJhZ21lbnRzIHRvIHRoZSBmcmFtZSBidWZmZXIuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfTElORUFSfVxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfRklMTUlDfVxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfSEVKTH1cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0FDRVN9XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmV4cG9zdXJlIC0gVGhlIGV4cG9zdXJlIHZhbHVlIHR3ZWFrcyB0aGUgb3ZlcmFsbCBicmlnaHRuZXNzXG4gICAgICogb2YgdGhlIHNjZW5lLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfG51bGx9IFtzZXR0aW5ncy5yZW5kZXIuc2t5Ym94XSAtIFRoZSBhc3NldCBJRCBvZiB0aGUgY3ViZSBtYXAgdGV4dHVyZSB0byBiZVxuICAgICAqIHVzZWQgYXMgdGhlIHNjZW5lJ3Mgc2t5Ym94LiBEZWZhdWx0cyB0byBudWxsLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94SW50ZW5zaXR5IC0gTXVsdGlwbGllciBmb3Igc2t5Ym94IGludGVuc2l0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLnNreWJveEx1bWluYW5jZSAtIEx1eCAobG0vbV4yKSB2YWx1ZSBmb3Igc2t5Ym94IGludGVuc2l0eSB3aGVuIHBoeXNpY2FsIGxpZ2h0IHVuaXRzIGFyZSBlbmFibGVkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuc2t5Ym94TWlwIC0gVGhlIG1pcCBsZXZlbCBvZiB0aGUgc2t5Ym94IHRvIGJlIGRpc3BsYXllZC5cbiAgICAgKiBPbmx5IHZhbGlkIGZvciBwcmVmaWx0ZXJlZCBjdWJlbWFwIHNreWJveGVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHNldHRpbmdzLnJlbmRlci5za3lib3hSb3RhdGlvbiAtIFJvdGF0aW9uIG9mIHNreWJveC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgLSBUaGUgbGlnaHRtYXAgcmVzb2x1dGlvbiBtdWx0aXBsaWVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRtYXBNYXhSZXNvbHV0aW9uIC0gVGhlIG1heGltdW0gbGlnaHRtYXAgcmVzb2x1dGlvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0bWFwTW9kZSAtIFRoZSBsaWdodG1hcCBiYWtpbmcgbW9kZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcFxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1JESVJ9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXAgKyBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24gKHVzZWQgZm9yIGJ1bXAvc3BlY3VsYXIpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZSAtIEVuYWJsZSBiYWtpbmcgYW1iaWVudCBsaWdodCBpbnRvIGxpZ2h0bWFwcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlTnVtU2FtcGxlcyAtIE51bWJlciBvZiBzYW1wbGVzIHRvIHVzZSB3aGVuIGJha2luZyBhbWJpZW50IGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIuYW1iaWVudEJha2VTcGhlcmVQYXJ0IC0gSG93IG11Y2ggb2YgdGhlIHNwaGVyZSB0byBpbmNsdWRlIHdoZW4gYmFraW5nIGFtYmllbnQgbGlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MgLSBCcmlnaHRuZXNzIG9mIHRoZSBiYWtlZCBhbWJpZW50IG9jY2x1c2lvbi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmFtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QgLSBDb250cmFzdCBvZiB0aGUgYmFrZWQgYW1iaWVudCBvY2NsdXNpb24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5hbWJpZW50THVtaW5hbmNlIC0gTHV4IChsbS9tXjIpIHZhbHVlIGZvciBhbWJpZW50IGxpZ2h0IGludGVuc2l0eS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAtIEVuYWJsZSBjbHVzdGVyZWQgbGlnaHRpbmcuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdTaGFkb3dzRW5hYmxlZCAtIElmIHNldCB0byB0cnVlLCB0aGUgY2x1c3RlcmVkIGxpZ2h0aW5nIHdpbGwgc3VwcG9ydCBzaGFkb3dzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQ29va2llc0VuYWJsZWQgLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgY29va2llIHRleHR1cmVzLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQgLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgYXJlYSBsaWdodHMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ1NoYWRvd0F0bGFzUmVzb2x1dGlvbiAtIFJlc29sdXRpb24gb2YgdGhlIGF0bGFzIHRleHR1cmUgc3RvcmluZyBhbGwgbm9uLWRpcmVjdGlvbmFsIHNoYWRvdyB0ZXh0dXJlcy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2V0dGluZ3MucmVuZGVyLmxpZ2h0aW5nQ29va2llQXRsYXNSZXNvbHV0aW9uIC0gUmVzb2x1dGlvbiBvZiB0aGUgYXRsYXMgdGV4dHVyZSBzdG9yaW5nIGFsbCBub24tZGlyZWN0aW9uYWwgY29va2llIHRleHR1cmVzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdNYXhMaWdodHNQZXJDZWxsIC0gTWF4aW11bSBudW1iZXIgb2YgbGlnaHRzIGEgY2VsbCBjYW4gc3RvcmUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNldHRpbmdzLnJlbmRlci5saWdodGluZ1NoYWRvd1R5cGUgLSBUaGUgdHlwZSBvZiBzaGFkb3cgZmlsdGVyaW5nIHVzZWQgYnkgYWxsIHNoYWRvd3MuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFNIQURPV19QQ0YxfTogUENGIDF4MSBzYW1wbGluZy5cbiAgICAgKiAtIHtAbGluayBTSEFET1dfUENGM306IFBDRiAzeDMgc2FtcGxpbmcuXG4gICAgICogLSB7QGxpbmsgU0hBRE9XX1BDRjV9OiBQQ0YgNXg1IHNhbXBsaW5nLiBGYWxscyBiYWNrIHRvIHtAbGluayBTSEFET1dfUENGM30gb24gV2ViR0wgMS4wLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzZXR0aW5ncy5yZW5kZXIubGlnaHRpbmdDZWxscyAtIE51bWJlciBvZiBjZWxscyBhbG9uZyBlYWNoIHdvcmxkLXNwYWNlIGF4aXMgdGhlIHNwYWNlIGNvbnRhaW5pbmcgbGlnaHRzXG4gICAgICogaXMgc3ViZGl2aWRlZCBpbnRvLlxuICAgICAqXG4gICAgICogT25seSBsaWdodHMgd2l0aCBiYWtlRGlyPXRydWUgd2lsbCBiZSB1c2VkIGZvciBnZW5lcmF0aW5nIHRoZSBkb21pbmFudCBsaWdodCBkaXJlY3Rpb24uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKlxuICAgICAqIGNvbnN0IHNldHRpbmdzID0ge1xuICAgICAqICAgICBwaHlzaWNzOiB7XG4gICAgICogICAgICAgICBncmF2aXR5OiBbMCwgLTkuOCwgMF1cbiAgICAgKiAgICAgfSxcbiAgICAgKiAgICAgcmVuZGVyOiB7XG4gICAgICogICAgICAgICBmb2dfZW5kOiAxMDAwLFxuICAgICAqICAgICAgICAgdG9uZW1hcHBpbmc6IDAsXG4gICAgICogICAgICAgICBza3lib3g6IG51bGwsXG4gICAgICogICAgICAgICBmb2dfZGVuc2l0eTogMC4wMSxcbiAgICAgKiAgICAgICAgIGdhbW1hX2NvcnJlY3Rpb246IDEsXG4gICAgICogICAgICAgICBleHBvc3VyZTogMSxcbiAgICAgKiAgICAgICAgIGZvZ19zdGFydDogMSxcbiAgICAgKiAgICAgICAgIGdsb2JhbF9hbWJpZW50OiBbMCwgMCwgMF0sXG4gICAgICogICAgICAgICBza3lib3hJbnRlbnNpdHk6IDEsXG4gICAgICogICAgICAgICBza3lib3hSb3RhdGlvbjogWzAsIDAsIDBdLFxuICAgICAqICAgICAgICAgZm9nX2NvbG9yOiBbMCwgMCwgMF0sXG4gICAgICogICAgICAgICBsaWdodG1hcE1vZGU6IDEsXG4gICAgICogICAgICAgICBmb2c6ICdub25lJyxcbiAgICAgKiAgICAgICAgIGxpZ2h0bWFwTWF4UmVzb2x1dGlvbjogMjA0OCxcbiAgICAgKiAgICAgICAgIHNreWJveE1pcDogMixcbiAgICAgKiAgICAgICAgIGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXI6IDE2XG4gICAgICogICAgIH1cbiAgICAgKiB9O1xuICAgICAqIGFwcC5hcHBseVNjZW5lU2V0dGluZ3Moc2V0dGluZ3MpO1xuICAgICAqL1xuICAgIGFwcGx5U2NlbmVTZXR0aW5ncyhzZXR0aW5ncykge1xuICAgICAgICBsZXQgYXNzZXQ7XG5cbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtcy5yaWdpZGJvZHkgJiYgdHlwZW9mIEFtbW8gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb25zdCBncmF2aXR5ID0gc2V0dGluZ3MucGh5c2ljcy5ncmF2aXR5O1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW1zLnJpZ2lkYm9keS5ncmF2aXR5LnNldChncmF2aXR5WzBdLCBncmF2aXR5WzFdLCBncmF2aXR5WzJdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2NlbmUuYXBwbHlTZXR0aW5ncyhzZXR0aW5ncyk7XG5cbiAgICAgICAgaWYgKHNldHRpbmdzLnJlbmRlci5oYXNPd25Qcm9wZXJ0eSgnc2t5Ym94JykpIHtcbiAgICAgICAgICAgIGlmIChzZXR0aW5ncy5yZW5kZXIuc2t5Ym94KSB7XG4gICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLmFzc2V0cy5nZXQoc2V0dGluZ3MucmVuZGVyLnNreWJveCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRTa3lib3goYXNzZXQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9uY2UoJ2FkZDonICsgc2V0dGluZ3MucmVuZGVyLnNreWJveCwgdGhpcy5zZXRTa3lib3gsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTa3lib3gobnVsbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBhcmVhIGxpZ2h0IExVVCB0YWJsZXMgZm9yIHRoaXMgYXBwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gbHRjTWF0MSAtIExVVCB0YWJsZSBvZiB0eXBlIGBhcnJheWAgdG8gYmUgc2V0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IGx0Y01hdDIgLSBMVVQgdGFibGUgb2YgdHlwZSBgYXJyYXlgIHRvIGJlIHNldC5cbiAgICAgKi9cbiAgICBzZXRBcmVhTGlnaHRMdXRzKGx0Y01hdDEsIGx0Y01hdDIpIHtcblxuICAgICAgICBpZiAobHRjTWF0MSAmJiBsdGNNYXQyKSB7XG4gICAgICAgICAgICBBcmVhTGlnaHRMdXRzLnNldCh0aGlzLmdyYXBoaWNzRGV2aWNlLCBsdGNNYXQxLCBsdGNNYXQyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oXCJzZXRBcmVhTGlnaHRMdXRzOiBMVVRzIGZvciBhcmVhIGxpZ2h0IGFyZSBub3QgdmFsaWRcIik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBza3lib3ggYXNzZXQgdG8gY3VycmVudCBzY2VuZSwgYW5kIHN1YnNjcmliZXMgdG8gYXNzZXQgbG9hZC9jaGFuZ2UgZXZlbnRzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBBc3NldCBvZiB0eXBlIGBza3lib3hgIHRvIGJlIHNldCB0bywgb3IgbnVsbCB0byByZW1vdmUgc2t5Ym94LlxuICAgICAqL1xuICAgIHNldFNreWJveChhc3NldCkge1xuICAgICAgICBpZiAoYXNzZXQgIT09IHRoaXMuX3NreWJveEFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBvblNreWJveFJlbW92ZWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTa3lib3gobnVsbCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCBvblNreWJveENoYW5nZWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5zY2VuZS5zZXRTa3lib3godGhpcy5fc2t5Ym94QXNzZXQgPyB0aGlzLl9za3lib3hBc3NldC5yZXNvdXJjZXMgOiBudWxsKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIGNsZWFudXAgcHJldmlvdXMgYXNzZXRcbiAgICAgICAgICAgIGlmICh0aGlzLl9za3lib3hBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9mZignbG9hZDonICsgdGhpcy5fc2t5Ym94QXNzZXQuaWQsIG9uU2t5Ym94Q2hhbmdlZCwgdGhpcyk7XG4gICAgICAgICAgICAgICAgdGhpcy5hc3NldHMub2ZmKCdyZW1vdmU6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0Lm9mZignY2hhbmdlJywgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IG5ldyBhc3NldFxuICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQgPSBhc3NldDtcbiAgICAgICAgICAgIGlmICh0aGlzLl9za3lib3hBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYXNzZXRzLm9uKCdsb2FkOicgKyB0aGlzLl9za3lib3hBc3NldC5pZCwgb25Ta3lib3hDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5vbmNlKCdyZW1vdmU6JyArIHRoaXMuX3NreWJveEFzc2V0LmlkLCBvblNreWJveFJlbW92ZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveEFzc2V0Lm9uKCdjaGFuZ2UnLCBvblNreWJveENoYW5nZWQsIHRoaXMpO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuc2NlbmUuc2t5Ym94TWlwID09PSAwICYmICF0aGlzLl9za3lib3hBc3NldC5sb2FkRmFjZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94QXNzZXQubG9hZEZhY2VzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmFzc2V0cy5sb2FkKHRoaXMuX3NreWJveEFzc2V0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgb25Ta3lib3hDaGFuZ2VkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZmlyc3RCYWtlKCkge1xuICAgICAgICB0aGlzLmxpZ2h0bWFwcGVyPy5iYWtlKG51bGwsIHRoaXMuc2NlbmUubGlnaHRtYXBNb2RlKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfZmlyc3RCYXRjaCgpIHtcbiAgICAgICAgdGhpcy5iYXRjaGVyPy5nZW5lcmF0ZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByb3ZpZGUgYW4gb3Bwb3J0dW5pdHkgdG8gbW9kaWZ5IHRoZSB0aW1lc3RhbXAgc3VwcGxpZWQgYnkgcmVxdWVzdEFuaW1hdGlvbkZyYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFt0aW1lc3RhbXBdIC0gVGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gICAgICogQHJldHVybnMge251bWJlcnx1bmRlZmluZWR9IFRoZSBtb2RpZmllZCB0aW1lc3RhbXAuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9wcm9jZXNzVGltZXN0YW1wKHRpbWVzdGFtcCkge1xuICAgICAgICByZXR1cm4gdGltZXN0YW1wO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgc2luZ2xlIGxpbmUuIExpbmUgc3RhcnQgYW5kIGVuZCBjb29yZGluYXRlcyBhcmUgc3BlY2lmaWVkIGluIHdvcmxkLXNwYWNlLiBUaGUgbGluZVxuICAgICAqIHdpbGwgYmUgZmxhdC1zaGFkZWQgd2l0aCB0aGUgc3BlY2lmaWVkIGNvbG9yLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzfSBzdGFydCAtIFRoZSBzdGFydCB3b3JsZC1zcGFjZSBjb29yZGluYXRlIG9mIHRoZSBsaW5lLlxuICAgICAqIEBwYXJhbSB7VmVjM30gZW5kIC0gVGhlIGVuZCB3b3JsZC1zcGFjZSBjb29yZGluYXRlIG9mIHRoZSBsaW5lLlxuICAgICAqIEBwYXJhbSB7Q29sb3J9IFtjb2xvcl0gLSBUaGUgY29sb3Igb2YgdGhlIGxpbmUuIEl0IGRlZmF1bHRzIHRvIHdoaXRlIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgbGluZSBpcyBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGUgZGVwdGhcbiAgICAgKiBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIGxpbmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIDEtdW5pdCBsb25nIHdoaXRlIGxpbmVcbiAgICAgKiBjb25zdCBzdGFydCA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIGNvbnN0IGVuZCA9IG5ldyBwYy5WZWMzKDEsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3TGluZShzdGFydCwgZW5kKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciBhIDEtdW5pdCBsb25nIHJlZCBsaW5lIHdoaWNoIGlzIG5vdCBkZXB0aCB0ZXN0ZWQgYW5kIHJlbmRlcnMgb24gdG9wIG9mIG90aGVyIGdlb21ldHJ5XG4gICAgICogY29uc3Qgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBjb25zdCBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd0xpbmUoc3RhcnQsIGVuZCwgcGMuQ29sb3IuUkVELCBmYWxzZSk7XG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSAxLXVuaXQgbG9uZyB3aGl0ZSBsaW5lIGludG8gdGhlIHdvcmxkIGxheWVyXG4gICAgICogY29uc3Qgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBjb25zdCBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiBjb25zdCB3b3JsZExheWVyID0gYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQocGMuTEFZRVJJRF9XT1JMRCk7XG4gICAgICogYXBwLmRyYXdMaW5lKHN0YXJ0LCBlbmQsIHBjLkNvbG9yLldISVRFLCB0cnVlLCB3b3JsZExheWVyKTtcbiAgICAgKi9cbiAgICBkcmF3TGluZShzdGFydCwgZW5kLCBjb2xvciwgZGVwdGhUZXN0LCBsYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmRyYXdMaW5lKHN0YXJ0LCBlbmQsIGNvbG9yLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGFuIGFyYml0cmFyeSBudW1iZXIgb2YgZGlzY3JldGUgbGluZSBzZWdtZW50cy4gVGhlIGxpbmVzIGFyZSBub3QgY29ubmVjdGVkIGJ5IGVhY2hcbiAgICAgKiBzdWJzZXF1ZW50IHBvaW50IGluIHRoZSBhcnJheS4gSW5zdGVhZCwgdGhleSBhcmUgaW5kaXZpZHVhbCBzZWdtZW50cyBzcGVjaWZpZWQgYnkgdHdvXG4gICAgICogcG9pbnRzLiBUaGVyZWZvcmUsIHRoZSBsZW5ndGhzIG9mIHRoZSBzdXBwbGllZCBwb3NpdGlvbiBhbmQgY29sb3IgYXJyYXlzIG11c3QgYmUgdGhlIHNhbWVcbiAgICAgKiBhbmQgYWxzbyBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMi4gVGhlIGNvbG9ycyBvZiB0aGUgZW5kcyBvZiBlYWNoIGxpbmUgc2VnbWVudCB3aWxsIGJlXG4gICAgICogaW50ZXJwb2xhdGVkIGFsb25nIHRoZSBsZW5ndGggb2YgZWFjaCBsaW5lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtWZWMzW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIHBvaW50cyB0byBkcmF3IGxpbmVzIGJldHdlZW4uIFRoZSBsZW5ndGggb2YgdGhlXG4gICAgICogYXJyYXkgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDIuXG4gICAgICogQHBhcmFtIHtDb2xvcltdfSBjb2xvcnMgLSBBbiBhcnJheSBvZiBjb2xvcnMgdG8gY29sb3IgdGhlIGxpbmVzLiBUaGlzIG11c3QgYmUgdGhlIHNhbWVcbiAgICAgKiBsZW5ndGggYXMgdGhlIHBvc2l0aW9uIGFycmF5LiBUaGUgbGVuZ3RoIG9mIHRoZSBhcnJheSBtdXN0IGFsc28gYmUgYSBtdWx0aXBsZSBvZiAyLlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2RlcHRoVGVzdF0gLSBTcGVjaWZpZXMgaWYgdGhlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGUgZGVwdGhcbiAgICAgKiBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIGxpbmVzIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSBzaW5nbGUgbGluZSwgd2l0aCB1bmlxdWUgY29sb3JzIGZvciBlYWNoIHBvaW50XG4gICAgICogY29uc3Qgc3RhcnQgPSBuZXcgcGMuVmVjMygwLCAwLCAwKTtcbiAgICAgKiBjb25zdCBlbmQgPSBuZXcgcGMuVmVjMygxLCAwLCAwKTtcbiAgICAgKiBhcHAuZHJhd0xpbmVzKFtzdGFydCwgZW5kXSwgW3BjLkNvbG9yLlJFRCwgcGMuQ29sb3IuV0hJVEVdKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIFJlbmRlciAyIGRpc2NyZXRlIGxpbmUgc2VnbWVudHNcbiAgICAgKiBjb25zdCBwb2ludHMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICBuZXcgcGMuVmVjMygwLCAwLCAwKSxcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMSwgMCwgMCksXG4gICAgICogICAgIC8vIExpbmUgMlxuICAgICAqICAgICBuZXcgcGMuVmVjMygxLCAxLCAwKSxcbiAgICAgKiAgICAgbmV3IHBjLlZlYzMoMSwgMSwgMSlcbiAgICAgKiBdO1xuICAgICAqIGNvbnN0IGNvbG9ycyA9IFtcbiAgICAgKiAgICAgLy8gTGluZSAxXG4gICAgICogICAgIHBjLkNvbG9yLlJFRCxcbiAgICAgKiAgICAgcGMuQ29sb3IuWUVMTE9XLFxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgcGMuQ29sb3IuQ1lBTixcbiAgICAgKiAgICAgcGMuQ29sb3IuQkxVRVxuICAgICAqIF07XG4gICAgICogYXBwLmRyYXdMaW5lcyhwb2ludHMsIGNvbG9ycyk7XG4gICAgICovXG4gICAgZHJhd0xpbmVzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmRyYXdMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVycyBhbiBhcmJpdHJhcnkgbnVtYmVyIG9mIGRpc2NyZXRlIGxpbmUgc2VnbWVudHMuIFRoZSBsaW5lcyBhcmUgbm90IGNvbm5lY3RlZCBieSBlYWNoXG4gICAgICogc3Vic2VxdWVudCBwb2ludCBpbiB0aGUgYXJyYXkuIEluc3RlYWQsIHRoZXkgYXJlIGluZGl2aWR1YWwgc2VnbWVudHMgc3BlY2lmaWVkIGJ5IHR3b1xuICAgICAqIHBvaW50cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHBvc2l0aW9ucyAtIEFuIGFycmF5IG9mIHBvaW50cyB0byBkcmF3IGxpbmVzIGJldHdlZW4uIEVhY2ggcG9pbnQgaXNcbiAgICAgKiByZXByZXNlbnRlZCBieSAzIG51bWJlcnMgLSB4LCB5IGFuZCB6IGNvb3JkaW5hdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJbXX0gY29sb3JzIC0gQW4gYXJyYXkgb2YgY29sb3JzIHRvIGNvbG9yIHRoZSBsaW5lcy4gVGhpcyBtdXN0IGJlIHRoZSBzYW1lXG4gICAgICogbGVuZ3RoIGFzIHRoZSBwb3NpdGlvbiBhcnJheS4gVGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgbXVzdCBhbHNvIGJlIGEgbXVsdGlwbGUgb2YgMi5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBsaW5lcyBhcmUgZGVwdGggdGVzdGVkIGFnYWluc3QgdGhlIGRlcHRoXG4gICAgICogYnVmZmVyLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqIEBwYXJhbSB7TGF5ZXJ9IFtsYXllcl0gLSBUaGUgbGF5ZXIgdG8gcmVuZGVyIHRoZSBsaW5lcyBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIDIgZGlzY3JldGUgbGluZSBzZWdtZW50c1xuICAgICAqIGNvbnN0IHBvaW50cyA9IFtcbiAgICAgKiAgICAgLy8gTGluZSAxXG4gICAgICogICAgIDAsIDAsIDAsXG4gICAgICogICAgIDEsIDAsIDAsXG4gICAgICogICAgIC8vIExpbmUgMlxuICAgICAqICAgICAxLCAxLCAwLFxuICAgICAqICAgICAxLCAxLCAxXG4gICAgICogXTtcbiAgICAgKiBjb25zdCBjb2xvcnMgPSBbXG4gICAgICogICAgIC8vIExpbmUgMVxuICAgICAqICAgICAxLCAwLCAwLCAxLCAgLy8gcmVkXG4gICAgICogICAgIDAsIDEsIDAsIDEsICAvLyBncmVlblxuICAgICAqICAgICAvLyBMaW5lIDJcbiAgICAgKiAgICAgMCwgMCwgMSwgMSwgIC8vIGJsdWVcbiAgICAgKiAgICAgMSwgMSwgMSwgMSAgIC8vIHdoaXRlXG4gICAgICogXTtcbiAgICAgKiBhcHAuZHJhd0xpbmVBcnJheXMocG9pbnRzLCBjb2xvcnMpO1xuICAgICAqL1xuICAgIGRyYXdMaW5lQXJyYXlzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmRyYXdMaW5lQXJyYXlzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3cyBhIHdpcmVmcmFtZSBzcGhlcmUgd2l0aCBjZW50ZXIsIHJhZGl1cyBhbmQgY29sb3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IGNlbnRlciAtIFRoZSBjZW50ZXIgb2YgdGhlIHNwaGVyZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gcmFkaXVzIC0gVGhlIHJhZGl1cyBvZiB0aGUgc3BoZXJlLlxuICAgICAqIEBwYXJhbSB7Q29sb3J9IFtjb2xvcl0gLSBUaGUgY29sb3Igb2YgdGhlIHNwaGVyZS4gSXQgZGVmYXVsdHMgdG8gd2hpdGUgaWYgbm90IHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3NlZ21lbnRzXSAtIE51bWJlciBvZiBsaW5lIHNlZ21lbnRzIHVzZWQgdG8gcmVuZGVyIHRoZSBjaXJjbGVzIGZvcm1pbmcgdGhlXG4gICAgICogc3BoZXJlLiBEZWZhdWx0cyB0byAyMC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZXB0aFRlc3RdIC0gU3BlY2lmaWVzIGlmIHRoZSBzcGhlcmUgbGluZXMgYXJlIGRlcHRoIHRlc3RlZCBhZ2FpbnN0IHRoZVxuICAgICAqIGRlcHRoIGJ1ZmZlci4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgc3BoZXJlIGludG8uIERlZmF1bHRzIHRvIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBSZW5kZXIgYSByZWQgd2lyZSBzcGhlcmUgd2l0aCByYWRpdXMgb2YgMVxuICAgICAqIGNvbnN0IGNlbnRlciA9IG5ldyBwYy5WZWMzKDAsIDAsIDApO1xuICAgICAqIGFwcC5kcmF3V2lyZVNwaGVyZShjZW50ZXIsIDEuMCwgcGMuQ29sb3IuUkVEKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1dpcmVTcGhlcmUoY2VudGVyLCByYWRpdXMsIGNvbG9yID0gQ29sb3IuV0hJVEUsIHNlZ21lbnRzID0gMjAsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5zY2VuZS5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIHRoaXMuc2NlbmUuaW1tZWRpYXRlLmRyYXdXaXJlU3BoZXJlKGNlbnRlciwgcmFkaXVzLCBjb2xvciwgc2VnbWVudHMsIGRlcHRoVGVzdCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgd2lyZWZyYW1lIGF4aXMgYWxpZ25lZCBib3ggc3BlY2lmaWVkIGJ5IG1pbiBhbmQgbWF4IHBvaW50cyBhbmQgY29sb3IuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG1pblBvaW50IC0gVGhlIG1pbiBjb3JuZXIgcG9pbnQgb2YgdGhlIGJveC5cbiAgICAgKiBAcGFyYW0ge1ZlYzN9IG1heFBvaW50IC0gVGhlIG1heCBjb3JuZXIgcG9pbnQgb2YgdGhlIGJveC5cbiAgICAgKiBAcGFyYW0ge0NvbG9yfSBbY29sb3JdIC0gVGhlIGNvbG9yIG9mIHRoZSBzcGhlcmUuIEl0IGRlZmF1bHRzIHRvIHdoaXRlIGlmIG5vdCBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVwdGhUZXN0XSAtIFNwZWNpZmllcyBpZiB0aGUgc3BoZXJlIGxpbmVzIGFyZSBkZXB0aCB0ZXN0ZWQgYWdhaW5zdCB0aGVcbiAgICAgKiBkZXB0aCBidWZmZXIuIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHNwaGVyZSBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gUmVuZGVyIGEgcmVkIHdpcmUgYWxpZ25lZCBib3hcbiAgICAgKiBjb25zdCBtaW4gPSBuZXcgcGMuVmVjMygtMSwgLTEsIC0xKTtcbiAgICAgKiBjb25zdCBtYXggPSBuZXcgcGMuVmVjMygxLCAxLCAxKTtcbiAgICAgKiBhcHAuZHJhd1dpcmVBbGlnbmVkQm94KG1pbiwgbWF4LCBwYy5Db2xvci5SRUQpO1xuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3V2lyZUFsaWduZWRCb3gobWluUG9pbnQsIG1heFBvaW50LCBjb2xvciA9IENvbG9yLldISVRFLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3V2lyZUFsaWduZWRCb3gobWluUG9pbnQsIG1heFBvaW50LCBjb2xvciwgZGVwdGhUZXN0LCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBtZXNoSW5zdGFuY2UgYXQgdGhpcyBmcmFtZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IG1lc2hJbnN0YW5jZSAtIFRoZSBtZXNoIGluc3RhbmNlXG4gICAgICogdG8gZHJhdy5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbWVzaCBpbnN0YW5jZSBpbnRvLiBEZWZhdWx0cyB0b1xuICAgICAqIHtAbGluayBMQVlFUklEX0lNTUVESUFURX0uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdNZXNoSW5zdGFuY2UobWVzaEluc3RhbmNlLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChudWxsLCBudWxsLCBudWxsLCBtZXNoSW5zdGFuY2UsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3IG1lc2ggYXQgdGhpcyBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9zY2VuZS9tZXNoLmpzJykuTWVzaH0gbWVzaCAtIFRoZSBtZXNoIHRvIGRyYXcuXG4gICAgICogQHBhcmFtIHtNYXRlcmlhbH0gbWF0ZXJpYWwgLSBUaGUgbWF0ZXJpYWwgdG8gdXNlIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKiBAcGFyYW0ge01hdDR9IG1hdHJpeCAtIFRoZSBtYXRyaXggdG8gdXNlIHRvIHJlbmRlciB0aGUgbWVzaC5cbiAgICAgKiBAcGFyYW0ge0xheWVyfSBbbGF5ZXJdIC0gVGhlIGxheWVyIHRvIHJlbmRlciB0aGUgbWVzaCBpbnRvLiBEZWZhdWx0cyB0byB7QGxpbmsgTEFZRVJJRF9JTU1FRElBVEV9LlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkcmF3TWVzaChtZXNoLCBtYXRlcmlhbCwgbWF0cml4LCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICB0aGlzLnNjZW5lLmltbWVkaWF0ZS5kcmF3TWVzaChtYXRlcmlhbCwgbWF0cml4LCBtZXNoLCBudWxsLCBsYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJhdyBxdWFkIG9mIHNpemUgWy0wLjUsIDAuNV0gYXQgdGhpcyBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7TWF0NH0gbWF0cml4IC0gVGhlIG1hdHJpeCB0byB1c2UgdG8gcmVuZGVyIHRoZSBxdWFkLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHRvIHVzZSB0byByZW5kZXIgdGhlIHF1YWQuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHF1YWQgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd1F1YWQobWF0cml4LCBtYXRlcmlhbCwgbGF5ZXIgPSB0aGlzLnNjZW5lLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZHJhd01lc2gobWF0ZXJpYWwsIG1hdHJpeCwgdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0UXVhZE1lc2goKSwgbnVsbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgdGV4dHVyZSBhdCBbeCwgeV0gcG9zaXRpb24gb24gc2NyZWVuLCB3aXRoIHNpemUgW3dpZHRoLCBoZWlnaHRdLiBUaGUgb3JpZ2luIG9mIHRoZVxuICAgICAqIHNjcmVlbiBpcyB0b3AtbGVmdCBbMCwgMF0uIENvb3JkaW5hdGVzIGFuZCBzaXplcyBhcmUgaW4gcHJvamVjdGVkIHNwYWNlICgtMSAuLiAxKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW4gdGhlXG4gICAgICogcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpblxuICAgICAqIHRoZSByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSB0ZXh0dXJlIC0gVGhlIHRleHR1cmUgdG8gcmVuZGVyLlxuICAgICAqIEBwYXJhbSB7TWF0ZXJpYWx9IG1hdGVyaWFsIC0gVGhlIG1hdGVyaWFsIHVzZWQgd2hlbiByZW5kZXJpbmcgdGhlIHRleHR1cmUuXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHRleHR1cmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtmaWx0ZXJhYmxlXSAtIEluZGljYXRlIGlmIHRoZSB0ZXh0dXJlIGNhbiBiZSBzYW1wbGVkIHVzaW5nIGZpbHRlcmluZy5cbiAgICAgKiBQYXNzaW5nIGZhbHNlIHVzZXMgdW5maWx0ZXJlZCBzYW1wbGluZywgYWxsb3dpbmcgYSBkZXB0aCB0ZXh0dXJlIHRvIGJlIHNhbXBsZWQgb24gV2ViR1BVLlxuICAgICAqIERlZmF1bHRzIHRvIHRydWUuXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRyYXdUZXh0dXJlKHgsIHksIHdpZHRoLCBoZWlnaHQsIHRleHR1cmUsIG1hdGVyaWFsLCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllciwgZmlsdGVyYWJsZSA9IHRydWUpIHtcblxuICAgICAgICAvLyBvbmx5IFdlYkdQVSBzdXBwb3J0cyBmaWx0ZXJhYmxlIHBhcmFtZXRlciB0byBiZSBmYWxzZSwgYWxsb3dpbmcgYSBkZXB0aCB0ZXh0dXJlIC8gc2hhZG93XG4gICAgICAgIC8vIG1hcCB0byBiZSBmZXRjaGVkICh3aXRob3V0IGZpbHRlcmluZykgYW5kIHJlbmRlcmVkXG4gICAgICAgIGlmIChmaWx0ZXJhYmxlID09PSBmYWxzZSAmJiAhdGhpcy5ncmFwaGljc0RldmljZS5pc1dlYkdQVSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyBUT0RPOiBpZiB0aGlzIGlzIHVzZWQgZm9yIGFueXRoaW5nIG90aGVyIHRoYW4gZGVidWcgdGV4dHVyZSBkaXNwbGF5LCB3ZSBzaG91bGQgb3B0aW1pemUgdGhpcyB0byBhdm9pZCBhbGxvY2F0aW9uc1xuICAgICAgICBjb25zdCBtYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICBtYXRyaXguc2V0VFJTKG5ldyBWZWMzKHgsIHksIDAuMCksIFF1YXQuSURFTlRJVFksIG5ldyBWZWMzKHdpZHRoLCAtaGVpZ2h0LCAwLjApKTtcblxuICAgICAgICBpZiAoIW1hdGVyaWFsKSB7XG4gICAgICAgICAgICBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICAgICAgbWF0ZXJpYWwuY3VsbCA9IENVTExGQUNFX05PTkU7XG4gICAgICAgICAgICBtYXRlcmlhbC5zZXRQYXJhbWV0ZXIoXCJjb2xvck1hcFwiLCB0ZXh0dXJlKTtcbiAgICAgICAgICAgIG1hdGVyaWFsLnNoYWRlciA9IGZpbHRlcmFibGUgPyB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRUZXh0dXJlU2hhZGVyKCkgOiB0aGlzLnNjZW5lLmltbWVkaWF0ZS5nZXRVbmZpbHRlcmFibGVUZXh0dXJlU2hhZGVyKCk7XG4gICAgICAgICAgICBtYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZHJhd1F1YWQobWF0cml4LCBtYXRlcmlhbCwgbGF5ZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERyYXdzIGEgZGVwdGggdGV4dHVyZSBhdCBbeCwgeV0gcG9zaXRpb24gb24gc2NyZWVuLCB3aXRoIHNpemUgW3dpZHRoLCBoZWlnaHRdLiBUaGUgb3JpZ2luIG9mXG4gICAgICogdGhlIHNjcmVlbiBpcyB0b3AtbGVmdCBbMCwgMF0uIENvb3JkaW5hdGVzIGFuZCBzaXplcyBhcmUgaW4gcHJvamVjdGVkIHNwYWNlICgtMSAuLiAxKS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4IC0gVGhlIHggY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB5IC0gVGhlIHkgY29vcmRpbmF0ZSBvbiB0aGUgc2NyZWVuIG9mIHRoZSB0b3AgbGVmdCBjb3JuZXIgb2YgdGhlIHRleHR1cmUuXG4gICAgICogU2hvdWxkIGJlIGluIHRoZSByYW5nZSBbLTEsIDFdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgcmVjdGFuZ2xlIG9mIHRoZSByZW5kZXJlZCB0ZXh0dXJlLiBTaG91bGQgYmUgaW4gdGhlXG4gICAgICogcmFuZ2UgWzAsIDJdLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSByZWN0YW5nbGUgb2YgdGhlIHJlbmRlcmVkIHRleHR1cmUuIFNob3VsZCBiZSBpblxuICAgICAqIHRoZSByYW5nZSBbMCwgMl0uXG4gICAgICogQHBhcmFtIHtMYXllcn0gW2xheWVyXSAtIFRoZSBsYXllciB0byByZW5kZXIgdGhlIHRleHR1cmUgaW50by4gRGVmYXVsdHMgdG8ge0BsaW5rIExBWUVSSURfSU1NRURJQVRFfS5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZHJhd0RlcHRoVGV4dHVyZSh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBsYXllciA9IHRoaXMuc2NlbmUuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBNYXRlcmlhbCgpO1xuICAgICAgICBtYXRlcmlhbC5jdWxsID0gQ1VMTEZBQ0VfTk9ORTtcbiAgICAgICAgbWF0ZXJpYWwuc2hhZGVyID0gdGhpcy5zY2VuZS5pbW1lZGlhdGUuZ2V0RGVwdGhUZXh0dXJlU2hhZGVyKCk7XG4gICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgIHRoaXMuZHJhd1RleHR1cmUoeCwgeSwgd2lkdGgsIGhlaWdodCwgbnVsbCwgbWF0ZXJpYWwsIGxheWVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyBhcHBsaWNhdGlvbiBhbmQgcmVtb3ZlcyBhbGwgZXZlbnQgbGlzdGVuZXJzIGF0IHRoZSBlbmQgb2YgdGhlIGN1cnJlbnQgZW5naW5lIGZyYW1lXG4gICAgICogdXBkYXRlLiBIb3dldmVyLCBpZiBjYWxsZWQgb3V0c2lkZSBvZiB0aGUgZW5naW5lIGZyYW1lIHVwZGF0ZSwgY2FsbGluZyBkZXN0cm95KCkgd2lsbFxuICAgICAqIGRlc3Ryb3kgdGhlIGFwcGxpY2F0aW9uIGltbWVkaWF0ZWx5LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAuZGVzdHJveSgpO1xuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbkZyYW1lVXBkYXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95UmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNhbnZhc0lkID0gdGhpcy5ncmFwaGljc0RldmljZS5jYW52YXMuaWQ7XG5cbiAgICAgICAgdGhpcy5vZmYoJ2xpYnJhcmllc2xvYWRlZCcpO1xuXG4gICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCd2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21venZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICAgICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignbXN2aXNpYmlsaXR5Y2hhbmdlJywgdGhpcy5fdmlzaWJpbGl0eUNoYW5nZUhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmtpdHZpc2liaWxpdHljaGFuZ2UnLCB0aGlzLl92aXNpYmlsaXR5Q2hhbmdlSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLnJvb3QuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJvb3QgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLm1vdXNlKSB7XG4gICAgICAgICAgICB0aGlzLm1vdXNlLm9mZigpO1xuICAgICAgICAgICAgdGhpcy5tb3VzZS5kZXRhY2goKTtcbiAgICAgICAgICAgIHRoaXMubW91c2UgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMua2V5Ym9hcmQpIHtcbiAgICAgICAgICAgIHRoaXMua2V5Ym9hcmQub2ZmKCk7XG4gICAgICAgICAgICB0aGlzLmtleWJvYXJkLmRldGFjaCgpO1xuICAgICAgICAgICAgdGhpcy5rZXlib2FyZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50b3VjaCkge1xuICAgICAgICAgICAgdGhpcy50b3VjaC5vZmYoKTtcbiAgICAgICAgICAgIHRoaXMudG91Y2guZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLnRvdWNoID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRJbnB1dCkge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50SW5wdXQuZGV0YWNoKCk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRJbnB1dCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5nYW1lcGFkcykge1xuICAgICAgICAgICAgdGhpcy5nYW1lcGFkcy5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmdhbWVwYWRzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuY29udHJvbGxlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbXMuZGVzdHJveSgpO1xuXG4gICAgICAgIC8vIGxheWVyIGNvbXBvc2l0aW9uXG4gICAgICAgIGlmICh0aGlzLnNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5zY2VuZS5sYXllcnMuZGVzdHJveSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbGwgdGV4dHVyZSByZXNvdXJjZXNcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5hc3NldHMubGlzdCgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2V0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXNzZXRzW2ldLnVubG9hZCgpO1xuICAgICAgICAgICAgYXNzZXRzW2ldLm9mZigpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYXNzZXRzLm9mZigpO1xuXG5cbiAgICAgICAgLy8gZGVzdHJveSBidW5kbGUgcmVnaXN0cnlcbiAgICAgICAgdGhpcy5idW5kbGVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5idW5kbGVzID0gbnVsbDtcblxuICAgICAgICB0aGlzLmkxOG4uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmkxOG4gPSBudWxsO1xuXG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZVtrZXldO1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gZWxlbWVudC5wYXJlbnROb2RlO1xuICAgICAgICAgICAgaWYgKHBhcmVudCkgcGFyZW50LnJlbW92ZUNoaWxkKGVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubG9hZGVyLmdldEhhbmRsZXIoJ3NjcmlwdCcpLl9jYWNoZSA9IHt9O1xuXG4gICAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmUuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjZW5lID0gbnVsbDtcblxuICAgICAgICB0aGlzLnN5c3RlbXMgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbnRleHQgPSBudWxsO1xuXG4gICAgICAgIC8vIHNjcmlwdCByZWdpc3RyeVxuICAgICAgICB0aGlzLnNjcmlwdHMuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNjcmlwdHMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuc2NlbmVzLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5zY2VuZXMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMubGlnaHRtYXBwZXI/LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5saWdodG1hcHBlciA9IG51bGw7XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2JhdGNoZXIuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5fYmF0Y2hlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9lbnRpdHlJbmRleCA9IHt9O1xuXG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25QcmVSZW5kZXJPcGFxdWUgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllckRlcHRoLm9uUG9zdFJlbmRlck9wYXF1ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGgub25EaXNhYmxlID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0TGF5ZXJEZXB0aC5vbkVuYWJsZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdExheWVyRGVwdGggPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRMYXllcldvcmxkID0gbnVsbDtcblxuICAgICAgICB0aGlzPy54ci5lbmQoKTtcbiAgICAgICAgdGhpcz8ueHIuZGVzdHJveSgpO1xuXG4gICAgICAgIHRoaXMucmVuZGVyZXIuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnJlbmRlcmVyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmdyYXBoaWNzRGV2aWNlLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5ncmFwaGljc0RldmljZSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy50aWNrID0gbnVsbDtcblxuICAgICAgICB0aGlzLm9mZigpOyAvLyByZW1vdmUgYWxsIGV2ZW50c1xuXG4gICAgICAgIGlmICh0aGlzLl9zb3VuZE1hbmFnZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX3NvdW5kTWFuYWdlci5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9zb3VuZE1hbmFnZXIgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgc2NyaXB0LmFwcCA9IG51bGw7XG5cbiAgICAgICAgQXBwQmFzZS5fYXBwbGljYXRpb25zW2NhbnZhc0lkXSA9IG51bGw7XG5cbiAgICAgICAgaWYgKGdldEFwcGxpY2F0aW9uKCkgPT09IHRoaXMpIHtcbiAgICAgICAgICAgIHNldEFwcGxpY2F0aW9uKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGVudGl0eSBmcm9tIHRoZSBpbmRleCBieSBndWlkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGd1aWQgLSBUaGUgR1VJRCB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtFbnRpdHl9IFRoZSBFbnRpdHkgd2l0aCB0aGUgR1VJRCBvciBudWxsLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXRFbnRpdHlGcm9tSW5kZXgoZ3VpZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW50aXR5SW5kZXhbZ3VpZF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVnaXN0ZXJTY2VuZUltbWVkaWF0ZShzY2VuZSkge1xuICAgICAgICB0aGlzLm9uKCdwb3N0cmVuZGVyJywgc2NlbmUuaW1tZWRpYXRlLm9uUG9zdFJlbmRlciwgc2NlbmUuaW1tZWRpYXRlKTtcbiAgICB9XG59XG5cbi8vIHN0YXRpYyBkYXRhXG5jb25zdCBfZnJhbWVFbmREYXRhID0ge307XG5cbi8qKlxuICogQ2FsbGJhY2sgdXNlZCBieSB7QGxpbmsgQXBwQmFzZSNzdGFydH0gYW5kIGl0c2VsZiB0byByZXF1ZXN0XG4gKiB0aGUgcmVuZGVyaW5nIG9mIGEgbmV3IGFuaW1hdGlvbiBmcmFtZS5cbiAqXG4gKiBAY2FsbGJhY2sgTWFrZVRpY2tDYWxsYmFja1xuICogQHBhcmFtIHtudW1iZXJ9IFt0aW1lc3RhbXBdIC0gVGhlIHRpbWVzdGFtcCBzdXBwbGllZCBieSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUuXG4gKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICogQGlnbm9yZVxuICovXG5cbi8qKlxuICogQ3JlYXRlIHRpY2sgZnVuY3Rpb24gdG8gYmUgd3JhcHBlZCBpbiBjbG9zdXJlLlxuICpcbiAqIEBwYXJhbSB7QXBwQmFzZX0gX2FwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAqIEByZXR1cm5zIHtNYWtlVGlja0NhbGxiYWNrfSBUaGUgdGljayBmdW5jdGlvbi5cbiAqIEBwcml2YXRlXG4gKi9cbmNvbnN0IG1ha2VUaWNrID0gZnVuY3Rpb24gKF9hcHApIHtcbiAgICBjb25zdCBhcHBsaWNhdGlvbiA9IF9hcHA7XG4gICAgbGV0IGZyYW1lUmVxdWVzdDtcbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3RpbWVzdGFtcF0gLSBUaGUgdGltZXN0YW1wIHN1cHBsaWVkIGJ5IHJlcXVlc3RBbmltYXRpb25GcmFtZS5cbiAgICAgKiBAcGFyYW0geyp9IFtmcmFtZV0gLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqL1xuICAgIHJldHVybiBmdW5jdGlvbiAodGltZXN0YW1wLCBmcmFtZSkge1xuICAgICAgICBpZiAoIWFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHNldEFwcGxpY2F0aW9uKGFwcGxpY2F0aW9uKTtcblxuICAgICAgICBpZiAoZnJhbWVSZXF1ZXN0KSB7XG4gICAgICAgICAgICB3aW5kb3cuY2FuY2VsQW5pbWF0aW9uRnJhbWUoZnJhbWVSZXF1ZXN0KTtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoYXZlIGN1cnJlbnQgYXBwbGljYXRpb24gcG9pbnRlciBpbiBwY1xuICAgICAgICBhcHAgPSBhcHBsaWNhdGlvbjtcblxuICAgICAgICBjb25zdCBjdXJyZW50VGltZSA9IGFwcGxpY2F0aW9uLl9wcm9jZXNzVGltZXN0YW1wKHRpbWVzdGFtcCkgfHwgbm93KCk7XG4gICAgICAgIGNvbnN0IG1zID0gY3VycmVudFRpbWUgLSAoYXBwbGljYXRpb24uX3RpbWUgfHwgY3VycmVudFRpbWUpO1xuICAgICAgICBsZXQgZHQgPSBtcyAvIDEwMDAuMDtcbiAgICAgICAgZHQgPSBtYXRoLmNsYW1wKGR0LCAwLCBhcHBsaWNhdGlvbi5tYXhEZWx0YVRpbWUpO1xuICAgICAgICBkdCAqPSBhcHBsaWNhdGlvbi50aW1lU2NhbGU7XG5cbiAgICAgICAgYXBwbGljYXRpb24uX3RpbWUgPSBjdXJyZW50VGltZTtcblxuICAgICAgICAvLyBTdWJtaXQgYSByZXF1ZXN0IHRvIHF1ZXVlIHVwIGEgbmV3IGFuaW1hdGlvbiBmcmFtZSBpbW1lZGlhdGVseVxuICAgICAgICBpZiAoYXBwbGljYXRpb24ueHI/LnNlc3Npb24pIHtcbiAgICAgICAgICAgIGZyYW1lUmVxdWVzdCA9IGFwcGxpY2F0aW9uLnhyLnNlc3Npb24ucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFwcGxpY2F0aW9uLnRpY2spO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZnJhbWVSZXF1ZXN0ID0gcGxhdGZvcm0uYnJvd3NlciA/IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYXBwbGljYXRpb24udGljaykgOiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmNvbnRleHRMb3N0KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9maWxsRnJhbWVTdGF0c0Jhc2ljKGN1cnJlbnRUaW1lLCBkdCwgbXMpO1xuXG4gICAgICAgIC8vICNpZiBfUFJPRklMRVJcbiAgICAgICAgYXBwbGljYXRpb24uX2ZpbGxGcmFtZVN0YXRzKCk7XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGFwcGxpY2F0aW9uLl9pbkZyYW1lVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1ldXBkYXRlXCIsIG1zKTtcblxuICAgICAgICBsZXQgc2hvdWxkUmVuZGVyRnJhbWUgPSB0cnVlO1xuXG4gICAgICAgIGlmIChmcmFtZSkge1xuICAgICAgICAgICAgc2hvdWxkUmVuZGVyRnJhbWUgPSBhcHBsaWNhdGlvbi54cj8udXBkYXRlKGZyYW1lKTtcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uLmdyYXBoaWNzRGV2aWNlLmRlZmF1bHRGcmFtZWJ1ZmZlciA9IGZyYW1lLnNlc3Npb24ucmVuZGVyU3RhdGUuYmFzZUxheWVyLmZyYW1lYnVmZmVyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbGljYXRpb24uZ3JhcGhpY3NEZXZpY2UuZGVmYXVsdEZyYW1lYnVmZmVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaG91bGRSZW5kZXJGcmFtZSkge1xuXG4gICAgICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1JFTkRFUl9GUkFNRSwgYC0tLS0gRnJhbWUgJHthcHBsaWNhdGlvbi5mcmFtZX1gKTtcbiAgICAgICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfUkVOREVSX0ZSQU1FX1RJTUUsIGAtLSBVcGRhdGVTdGFydCAke25vdygpLnRvRml4ZWQoMil9bXNgKTtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24udXBkYXRlKGR0KTtcblxuICAgICAgICAgICAgYXBwbGljYXRpb24uZmlyZShcImZyYW1lcmVuZGVyXCIpO1xuXG5cbiAgICAgICAgICAgIGlmIChhcHBsaWNhdGlvbi5hdXRvUmVuZGVyIHx8IGFwcGxpY2F0aW9uLnJlbmRlck5leHRGcmFtZSkge1xuXG4gICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfRlJBTUVfVElNRSwgYC0tIFJlbmRlclN0YXJ0ICR7bm93KCkudG9GaXhlZCgyKX1tc2ApO1xuXG4gICAgICAgICAgICAgICAgYXBwbGljYXRpb24udXBkYXRlQ2FudmFzU2l6ZSgpO1xuICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uLmZyYW1lU3RhcnQoKTtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi5yZW5kZXIoKTtcbiAgICAgICAgICAgICAgICBhcHBsaWNhdGlvbi5mcmFtZUVuZCgpO1xuICAgICAgICAgICAgICAgIGFwcGxpY2F0aW9uLnJlbmRlck5leHRGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9SRU5ERVJfRlJBTUVfVElNRSwgYC0tIFJlbmRlckVuZCAke25vdygpLnRvRml4ZWQoMil9bXNgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2V0IGV2ZW50IGRhdGFcbiAgICAgICAgICAgIF9mcmFtZUVuZERhdGEudGltZXN0YW1wID0gbm93KCk7XG4gICAgICAgICAgICBfZnJhbWVFbmREYXRhLnRhcmdldCA9IGFwcGxpY2F0aW9uO1xuXG4gICAgICAgICAgICBhcHBsaWNhdGlvbi5maXJlKFwiZnJhbWVlbmRcIiwgX2ZyYW1lRW5kRGF0YSk7XG4gICAgICAgIH1cblxuICAgICAgICBhcHBsaWNhdGlvbi5faW5GcmFtZVVwZGF0ZSA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChhcHBsaWNhdGlvbi5fZGVzdHJveVJlcXVlc3RlZCkge1xuICAgICAgICAgICAgYXBwbGljYXRpb24uZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgfTtcbn07XG5cbmV4cG9ydCB7IGFwcCwgQXBwQmFzZSB9O1xuIl0sIm5hbWVzIjpbIlByb2dyZXNzIiwiY29uc3RydWN0b3IiLCJsZW5ndGgiLCJjb3VudCIsImluYyIsImRvbmUiLCJhcHAiLCJBcHBCYXNlIiwiRXZlbnRIYW5kbGVyIiwiY2FudmFzIiwidmVyc2lvbiIsImluZGV4T2YiLCJEZWJ1ZyIsImxvZyIsInJldmlzaW9uIiwiX2FwcGxpY2F0aW9ucyIsImlkIiwic2V0QXBwbGljYXRpb24iLCJfZGVzdHJveVJlcXVlc3RlZCIsIl9pbkZyYW1lVXBkYXRlIiwiX3RpbWUiLCJ0aW1lU2NhbGUiLCJtYXhEZWx0YVRpbWUiLCJmcmFtZSIsImF1dG9SZW5kZXIiLCJyZW5kZXJOZXh0RnJhbWUiLCJ1c2VMZWdhY3lTY3JpcHRBdHRyaWJ1dGVDbG9uaW5nIiwic2NyaXB0IiwibGVnYWN5IiwiX2xpYnJhcmllc0xvYWRlZCIsIl9maWxsTW9kZSIsIkZJTExNT0RFX0tFRVBfQVNQRUNUIiwiX3Jlc29sdXRpb25Nb2RlIiwiUkVTT0xVVElPTl9GSVhFRCIsIl9hbGxvd1Jlc2l6ZSIsImNvbnRleHQiLCJpbml0IiwiYXBwT3B0aW9ucyIsImRldmljZSIsImdyYXBoaWNzRGV2aWNlIiwiYXNzZXJ0IiwiR3JhcGhpY3NEZXZpY2VBY2Nlc3MiLCJzZXQiLCJfaW5pdERlZmF1bHRNYXRlcmlhbCIsIl9pbml0UHJvZ3JhbUxpYnJhcnkiLCJzdGF0cyIsIkFwcGxpY2F0aW9uU3RhdHMiLCJfc291bmRNYW5hZ2VyIiwic291bmRNYW5hZ2VyIiwibG9hZGVyIiwiUmVzb3VyY2VMb2FkZXIiLCJMaWdodHNCdWZmZXIiLCJfZW50aXR5SW5kZXgiLCJzY2VuZSIsIlNjZW5lIiwiX3JlZ2lzdGVyU2NlbmVJbW1lZGlhdGUiLCJyb290IiwiRW50aXR5IiwiX2VuYWJsZWRJbkhpZXJhcmNoeSIsImFzc2V0cyIsIkFzc2V0UmVnaXN0cnkiLCJhc3NldFByZWZpeCIsInByZWZpeCIsImJ1bmRsZXMiLCJCdW5kbGVSZWdpc3RyeSIsImVuYWJsZUJ1bmRsZXMiLCJUZXh0RGVjb2RlciIsInNjcmlwdHNPcmRlciIsInNjcmlwdHMiLCJTY3JpcHRSZWdpc3RyeSIsImkxOG4iLCJJMThuIiwic2NlbmVzIiwiU2NlbmVSZWdpc3RyeSIsInNlbGYiLCJkZWZhdWx0TGF5ZXJXb3JsZCIsIkxheWVyIiwibmFtZSIsIkxBWUVSSURfV09STEQiLCJzY2VuZUdyYWIiLCJTY2VuZUdyYWIiLCJkZWZhdWx0TGF5ZXJEZXB0aCIsImxheWVyIiwiZGVmYXVsdExheWVyU2t5Ym94IiwiZW5hYmxlZCIsIkxBWUVSSURfU0tZQk9YIiwib3BhcXVlU29ydE1vZGUiLCJTT1JUTU9ERV9OT05FIiwiZGVmYXVsdExheWVyVWkiLCJMQVlFUklEX1VJIiwidHJhbnNwYXJlbnRTb3J0TW9kZSIsIlNPUlRNT0RFX01BTlVBTCIsInBhc3NUaHJvdWdoIiwiZGVmYXVsdExheWVySW1tZWRpYXRlIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJkZWZhdWx0TGF5ZXJDb21wb3NpdGlvbiIsIkxheWVyQ29tcG9zaXRpb24iLCJwdXNoT3BhcXVlIiwicHVzaFRyYW5zcGFyZW50IiwibGF5ZXJzIiwib24iLCJvbGRDb21wIiwibmV3Q29tcCIsImxpc3QiLCJsYXllckxpc3QiLCJpIiwiTEFZRVJJRF9ERVBUSCIsInBhdGNoIiwiQXJlYUxpZ2h0THV0cyIsImNyZWF0ZVBsYWNlaG9sZGVyIiwicmVuZGVyZXIiLCJGb3J3YXJkUmVuZGVyZXIiLCJmcmFtZUdyYXBoIiwiRnJhbWVHcmFwaCIsImxpZ2h0bWFwcGVyIiwib25jZSIsIl9maXJzdEJha2UiLCJfYmF0Y2hlciIsImJhdGNoTWFuYWdlciIsIl9maXJzdEJhdGNoIiwia2V5Ym9hcmQiLCJtb3VzZSIsInRvdWNoIiwiZ2FtZXBhZHMiLCJlbGVtZW50SW5wdXQiLCJ4ciIsImF0dGFjaFNlbGVjdEV2ZW50cyIsIl9pblRvb2xzIiwiX3NreWJveEFzc2V0IiwiX3NjcmlwdFByZWZpeCIsInNjcmlwdFByZWZpeCIsImFkZEhhbmRsZXIiLCJCdW5kbGVIYW5kbGVyIiwicmVzb3VyY2VIYW5kbGVycyIsImZvckVhY2giLCJyZXNvdXJjZUhhbmRsZXIiLCJoYW5kbGVyIiwiaGFuZGxlclR5cGUiLCJzeXN0ZW1zIiwiQ29tcG9uZW50U3lzdGVtUmVnaXN0cnkiLCJjb21wb25lbnRTeXN0ZW1zIiwiY29tcG9uZW50U3lzdGVtIiwiYWRkIiwiX3Zpc2liaWxpdHlDaGFuZ2VIYW5kbGVyIiwib25WaXNpYmlsaXR5Q2hhbmdlIiwiYmluZCIsImRvY3VtZW50IiwiaGlkZGVuIiwidW5kZWZpbmVkIiwiX2hpZGRlbkF0dHIiLCJhZGRFdmVudExpc3RlbmVyIiwibW96SGlkZGVuIiwibXNIaWRkZW4iLCJ3ZWJraXRIaWRkZW4iLCJ0aWNrIiwibWFrZVRpY2siLCJnZXRBcHBsaWNhdGlvbiIsIm1hdGVyaWFsIiwiU3RhbmRhcmRNYXRlcmlhbCIsInNoYWRpbmdNb2RlbCIsIlNQRUNVTEFSX0JMSU5OIiwic2V0RGVmYXVsdE1hdGVyaWFsIiwibGlicmFyeSIsIlByb2dyYW1MaWJyYXJ5Iiwic2V0UHJvZ3JhbUxpYnJhcnkiLCJiYXRjaGVyIiwiZmlsbE1vZGUiLCJyZXNvbHV0aW9uTW9kZSIsImNvbmZpZ3VyZSIsInVybCIsImNhbGxiYWNrIiwiaHR0cCIsImdldCIsImVyciIsInJlc3BvbnNlIiwicHJvcHMiLCJhcHBsaWNhdGlvbl9wcm9wZXJ0aWVzIiwiX3BhcnNlQXBwbGljYXRpb25Qcm9wZXJ0aWVzIiwiX3BhcnNlU2NlbmVzIiwiX3BhcnNlQXNzZXRzIiwicHJlbG9hZCIsImZpcmUiLCJwcm9ncmVzcyIsIl9kb25lIiwidG90YWwiLCJvbkFzc2V0TG9hZCIsImFzc2V0Iiwib25Bc3NldEVycm9yIiwibG9hZGVkIiwibG9hZCIsIl9wcmVsb2FkU2NyaXB0cyIsInNjZW5lRGF0YSIsInByZWxvYWRpbmciLCJfZ2V0U2NyaXB0UmVmZXJlbmNlcyIsImwiLCJyZWdleCIsIm9uTG9hZCIsIlNjcmlwdFR5cGUiLCJjb25zb2xlIiwiZXJyb3IiLCJzY3JpcHRVcmwiLCJ0ZXN0IiwidG9Mb3dlckNhc2UiLCJwYXRoIiwiam9pbiIsIm1heEFzc2V0UmV0cmllcyIsImVuYWJsZVJldHJ5IiwidXNlRGV2aWNlUGl4ZWxSYXRpbyIsInVzZV9kZXZpY2VfcGl4ZWxfcmF0aW8iLCJyZXNvbHV0aW9uX21vZGUiLCJmaWxsX21vZGUiLCJfd2lkdGgiLCJ3aWR0aCIsIl9oZWlnaHQiLCJoZWlnaHQiLCJtYXhQaXhlbFJhdGlvIiwid2luZG93IiwiZGV2aWNlUGl4ZWxSYXRpbyIsInNldENhbnZhc1Jlc29sdXRpb24iLCJzZXRDYW52YXNGaWxsTW9kZSIsImxheWVyT3JkZXIiLCJjb21wb3NpdGlvbiIsImtleSIsImRhdGEiLCJwYXJzZUludCIsImxlbiIsInN1YmxheWVyIiwidHJhbnNwYXJlbnQiLCJzdWJMYXllckVuYWJsZWQiLCJiYXRjaEdyb3VwcyIsImdycCIsImFkZEdyb3VwIiwiZHluYW1pYyIsIm1heEFhYmJTaXplIiwiaTE4bkFzc2V0cyIsIl9sb2FkTGlicmFyaWVzIiwibGlicmFyaWVzIiwidXJscyIsIm9uTGlicmFyaWVzTG9hZGVkIiwic2NyaXB0c0luZGV4IiwiYnVuZGxlc0luZGV4IiwicHVzaCIsInR5cGUiLCJBc3NldCIsImZpbGUiLCJsb2FkaW5nVHlwZSIsInRhZ3MiLCJsb2NhbGUiLCJhZGRMb2NhbGl6ZWRBc3NldElkIiwicHJpb3JpdHlTY3JpcHRzIiwic2V0dGluZ3MiLCJwcmlvcml0eV9zY3JpcHRzIiwiX3NjcmlwdHMiLCJfaW5kZXgiLCJlbnRpdGllcyIsImNvbXBvbmVudHMiLCJzdGFydCIsImNhbGwiLCJfYWxyZWFkeVN0YXJ0ZWQiLCJ0aW1lc3RhbXAiLCJub3ciLCJ0YXJnZXQiLCJpbnB1dFVwZGF0ZSIsImR0IiwiY29udHJvbGxlciIsInVwZGF0ZSIsInVwZGF0ZUNsaWVudFJlY3QiLCJ1cGRhdGVTdGFydCIsInVwZGF0ZVRpbWUiLCJmcmFtZVN0YXJ0IiwiZnJhbWVFbmQiLCJyZW5kZXIiLCJyZW5kZXJTdGFydCIsInN5bmNIaWVyYXJjaHkiLCJ1cGRhdGVBbGwiLCJfc2tpcFJlbmRlckNvdW50ZXIiLCJyZW5kZXJDb21wb3NpdGlvbiIsInJlbmRlclRpbWUiLCJsYXllckNvbXBvc2l0aW9uIiwiRGVidWdHcmFwaGljcyIsImNsZWFyR3B1TWFya2VycyIsImJ1aWxkRnJhbWVHcmFwaCIsIl9maWxsRnJhbWVTdGF0c0Jhc2ljIiwibXMiLCJfdGltZVRvQ291bnRGcmFtZXMiLCJmcHMiLCJfZnBzQWNjdW0iLCJkcmF3Q2FsbHMiLCJfZHJhd0NhbGxzUGVyRnJhbWUiLCJfZmlsbEZyYW1lU3RhdHMiLCJjYW1lcmFzIiwiX2NhbWVyYXNSZW5kZXJlZCIsIm1hdGVyaWFscyIsIl9tYXRlcmlhbFN3aXRjaGVzIiwic2hhZGVycyIsIl9zaGFkZXJTd2l0Y2hlc1BlckZyYW1lIiwic2hhZG93TWFwVXBkYXRlcyIsIl9zaGFkb3dNYXBVcGRhdGVzIiwic2hhZG93TWFwVGltZSIsIl9zaGFkb3dNYXBUaW1lIiwiZGVwdGhNYXBUaW1lIiwiX2RlcHRoTWFwVGltZSIsImZvcndhcmRUaW1lIiwiX2ZvcndhcmRUaW1lIiwicHJpbXMiLCJfcHJpbXNQZXJGcmFtZSIsInRyaWFuZ2xlcyIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJNYXRoIiwibWF4IiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiUFJJTUlUSVZFX1RSSUZBTiIsImN1bGxUaW1lIiwiX2N1bGxUaW1lIiwic29ydFRpbWUiLCJfc29ydFRpbWUiLCJza2luVGltZSIsIl9za2luVGltZSIsIm1vcnBoVGltZSIsIl9tb3JwaFRpbWUiLCJsaWdodENsdXN0ZXJzIiwiX2xpZ2h0Q2x1c3RlcnMiLCJsaWdodENsdXN0ZXJzVGltZSIsIl9saWdodENsdXN0ZXJzVGltZSIsIm90aGVyUHJpbWl0aXZlcyIsIl9sYXllckNvbXBvc2l0aW9uVXBkYXRlVGltZSIsImZvcndhcmQiLCJfZm9yd2FyZERyYXdDYWxscyIsImN1bGxlZCIsIl9udW1EcmF3Q2FsbHNDdWxsZWQiLCJkZXB0aCIsInNoYWRvdyIsIl9zaGFkb3dEcmF3Q2FsbHMiLCJza2lubmVkIiwiX3NraW5EcmF3Q2FsbHMiLCJpbW1lZGlhdGUiLCJpbnN0YW5jZWQiLCJyZW1vdmVkQnlJbnN0YW5jaW5nIiwibWlzYyIsIl9kZXB0aERyYXdDYWxscyIsIl9pbW1lZGlhdGVSZW5kZXJlZCIsIl9pbnN0YW5jZWREcmF3Q2FsbHMiLCJyZW5kZXJUYXJnZXRDcmVhdGlvblRpbWUiLCJwYXJ0aWNsZXMiLCJ1cGRhdGVzUGVyRnJhbWUiLCJfdXBkYXRlc1BlckZyYW1lIiwiZnJhbWVUaW1lIiwiX2ZyYW1lVGltZSIsIm1vZGUiLCJyZXNpemVDYW52YXMiLCJSRVNPTFVUSU9OX0FVVE8iLCJjbGllbnRXaWR0aCIsImNsaWVudEhlaWdodCIsImlzSGlkZGVuIiwic3VzcGVuZCIsInJlc3VtZSIsInNlc3Npb24iLCJ3aW5kb3dXaWR0aCIsImlubmVyV2lkdGgiLCJ3aW5kb3dIZWlnaHQiLCJpbm5lckhlaWdodCIsInIiLCJ3aW5SIiwiRklMTE1PREVfRklMTF9XSU5ET1ciLCJzdHlsZSIsInVwZGF0ZUNhbnZhc1NpemUiLCJfdGhpcyR4ciIsImFjdGl2ZSIsInJpZ2lkYm9keSIsIm9uTGlicmFyeUxvYWRlZCIsImFwcGx5U2NlbmVTZXR0aW5ncyIsIkFtbW8iLCJncmF2aXR5IiwicGh5c2ljcyIsImFwcGx5U2V0dGluZ3MiLCJoYXNPd25Qcm9wZXJ0eSIsInNreWJveCIsInNldFNreWJveCIsInNldEFyZWFMaWdodEx1dHMiLCJsdGNNYXQxIiwibHRjTWF0MiIsIndhcm4iLCJvblNreWJveFJlbW92ZWQiLCJvblNreWJveENoYW5nZWQiLCJyZXNvdXJjZXMiLCJvZmYiLCJza3lib3hNaXAiLCJsb2FkRmFjZXMiLCJfdGhpcyRsaWdodG1hcHBlciIsImJha2UiLCJsaWdodG1hcE1vZGUiLCJfdGhpcyRiYXRjaGVyIiwiZ2VuZXJhdGUiLCJfcHJvY2Vzc1RpbWVzdGFtcCIsImRyYXdMaW5lIiwiZW5kIiwiY29sb3IiLCJkZXB0aFRlc3QiLCJkcmF3TGluZXMiLCJwb3NpdGlvbnMiLCJjb2xvcnMiLCJkZWZhdWx0RHJhd0xheWVyIiwiZHJhd0xpbmVBcnJheXMiLCJkcmF3V2lyZVNwaGVyZSIsImNlbnRlciIsInJhZGl1cyIsIkNvbG9yIiwiV0hJVEUiLCJzZWdtZW50cyIsImRyYXdXaXJlQWxpZ25lZEJveCIsIm1pblBvaW50IiwibWF4UG9pbnQiLCJkcmF3TWVzaEluc3RhbmNlIiwibWVzaEluc3RhbmNlIiwiZHJhd01lc2giLCJtZXNoIiwibWF0cml4IiwiZHJhd1F1YWQiLCJnZXRRdWFkTWVzaCIsImRyYXdUZXh0dXJlIiwieCIsInkiLCJ0ZXh0dXJlIiwiZmlsdGVyYWJsZSIsImlzV2ViR1BVIiwiTWF0NCIsInNldFRSUyIsIlZlYzMiLCJRdWF0IiwiSURFTlRJVFkiLCJNYXRlcmlhbCIsImN1bGwiLCJDVUxMRkFDRV9OT05FIiwic2V0UGFyYW1ldGVyIiwic2hhZGVyIiwiZ2V0VGV4dHVyZVNoYWRlciIsImdldFVuZmlsdGVyYWJsZVRleHR1cmVTaGFkZXIiLCJkcmF3RGVwdGhUZXh0dXJlIiwiZ2V0RGVwdGhUZXh0dXJlU2hhZGVyIiwiZGVzdHJveSIsIl90aGlzJGxpZ2h0bWFwcGVyMiIsImNhbnZhc0lkIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImRldGFjaCIsInVubG9hZCIsImdldEhhbmRsZXIiLCJfY2FjaGUiLCJlbGVtZW50IiwicGFyZW50IiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwib25QcmVSZW5kZXJPcGFxdWUiLCJvblBvc3RSZW5kZXJPcGFxdWUiLCJvbkRpc2FibGUiLCJvbkVuYWJsZSIsImdldEVudGl0eUZyb21JbmRleCIsImd1aWQiLCJvblBvc3RSZW5kZXIiLCJfZnJhbWVFbmREYXRhIiwiX2FwcCIsImFwcGxpY2F0aW9uIiwiZnJhbWVSZXF1ZXN0IiwiX2FwcGxpY2F0aW9uJHhyIiwiY2FuY2VsQW5pbWF0aW9uRnJhbWUiLCJjdXJyZW50VGltZSIsIm1hdGgiLCJjbGFtcCIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsInBsYXRmb3JtIiwiYnJvd3NlciIsImNvbnRleHRMb3N0Iiwic2hvdWxkUmVuZGVyRnJhbWUiLCJfYXBwbGljYXRpb24keHIyIiwiZGVmYXVsdEZyYW1lYnVmZmVyIiwicmVuZGVyU3RhdGUiLCJiYXNlTGF5ZXIiLCJmcmFtZWJ1ZmZlciIsInRyYWNlIiwiVFJBQ0VJRF9SRU5ERVJfRlJBTUUiLCJUUkFDRUlEX1JFTkRFUl9GUkFNRV9USU1FIiwidG9GaXhlZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBK0RBO0FBQ0EsTUFBTUEsUUFBUSxDQUFDO0VBQ1hDLFdBQVdBLENBQUNDLE1BQU0sRUFBRTtJQUNoQixJQUFJLENBQUNBLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0lBQ3BCLElBQUksQ0FBQ0MsS0FBSyxHQUFHLENBQUMsQ0FBQTtBQUNsQixHQUFBO0FBRUFDLEVBQUFBLEdBQUdBLEdBQUc7SUFDRixJQUFJLENBQUNELEtBQUssRUFBRSxDQUFBO0FBQ2hCLEdBQUE7QUFFQUUsRUFBQUEsSUFBSUEsR0FBRztBQUNILElBQUEsT0FBUSxJQUFJLENBQUNGLEtBQUssS0FBSyxJQUFJLENBQUNELE1BQU0sQ0FBQTtBQUN0QyxHQUFBO0FBQ0osQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVJSSxJQUFBQSxHQUFHLEdBQUcsS0FBSTs7QUFFZDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsT0FBTyxTQUFTQyxZQUFZLENBQUM7QUFDL0I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lQLFdBQVdBLENBQUNRLE1BQU0sRUFBRTtBQUNoQixJQUFBLEtBQUssRUFBRSxDQUFBO0lBR1AsSUFBSSxDQUFBQyxPQUFPLENBQUVDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBRyxDQUFDLEVBQUU7TUFDM0JDLEtBQUssQ0FBQ0MsR0FBRyxDQUFFLENBQUEsc0JBQUEsRUFBd0JILE9BQVEsQ0FBR0ksQ0FBQUEsRUFBQUEsUUFBUyxFQUFDLENBQUMsQ0FBQTtBQUM3RCxLQUFBOztBQUdBO0lBQ0FQLE9BQU8sQ0FBQ1EsYUFBYSxDQUFDTixNQUFNLENBQUNPLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQTtJQUN2Q0MsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFBO0FBRXBCWCxJQUFBQSxHQUFHLEdBQUcsSUFBSSxDQUFBOztBQUVWO0lBQ0EsSUFBSSxDQUFDWSxpQkFBaUIsR0FBRyxLQUFLLENBQUE7O0FBRTlCO0lBQ0EsSUFBSSxDQUFDQyxjQUFjLEdBQUcsS0FBSyxDQUFBOztBQUUzQjtJQUNBLElBQUksQ0FBQ0MsS0FBSyxHQUFHLENBQUMsQ0FBQTs7QUFFZDtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxTQUFTLEdBQUcsQ0FBQyxDQUFBOztBQUVsQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDQyxZQUFZLEdBQUcsR0FBRyxDQUFDOztBQUV4QjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLEtBQUssR0FBRyxDQUFDLENBQUE7O0FBRWQ7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsVUFBVSxHQUFHLElBQUksQ0FBQTs7QUFFdEI7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxlQUFlLEdBQUcsS0FBSyxDQUFBOztBQUU1QjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDQywrQkFBK0IsR0FBR0MsTUFBTSxDQUFDQyxNQUFNLENBQUE7SUFFcEQsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxLQUFLLENBQUE7SUFDN0IsSUFBSSxDQUFDQyxTQUFTLEdBQUdDLG9CQUFvQixDQUFBO0lBQ3JDLElBQUksQ0FBQ0MsZUFBZSxHQUFHQyxnQkFBZ0IsQ0FBQTtJQUN2QyxJQUFJLENBQUNDLFlBQVksR0FBRyxJQUFJLENBQUE7O0FBRXhCO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLElBQUlBLENBQUNDLFVBQVUsRUFBRTtBQUNiLElBQUEsTUFBTUMsTUFBTSxHQUFHRCxVQUFVLENBQUNFLGNBQWMsQ0FBQTtBQUV4QzNCLElBQUFBLEtBQUssQ0FBQzRCLE1BQU0sQ0FBQ0YsTUFBTSxFQUFFLGtFQUFrRSxDQUFDLENBQUE7O0FBRXhGO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLGNBQWMsR0FBR0QsTUFBTSxDQUFBO0FBQzVCRyxJQUFBQSxvQkFBb0IsQ0FBQ0MsR0FBRyxDQUFDSixNQUFNLENBQUMsQ0FBQTtJQUVoQyxJQUFJLENBQUNLLG9CQUFvQixFQUFFLENBQUE7SUFDM0IsSUFBSSxDQUFDQyxtQkFBbUIsRUFBRSxDQUFBO0FBQzFCLElBQUEsSUFBSSxDQUFDQyxLQUFLLEdBQUcsSUFBSUMsZ0JBQWdCLENBQUNSLE1BQU0sQ0FBQyxDQUFBOztBQUV6QztBQUNSO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDUyxhQUFhLEdBQUdWLFVBQVUsQ0FBQ1csWUFBWSxDQUFBOztBQUU1QztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLE1BQU0sR0FBRyxJQUFJQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUE7QUFFdENDLElBQUFBLFlBQVksQ0FBQ2YsSUFBSSxDQUFDRSxNQUFNLENBQUMsQ0FBQTs7QUFFekI7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNjLFlBQVksR0FBRyxFQUFFLENBQUE7O0FBRXRCO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsS0FBSyxHQUFHLElBQUlDLEtBQUssQ0FBQ2hCLE1BQU0sQ0FBQyxDQUFBO0FBQzlCLElBQUEsSUFBSSxDQUFDaUIsdUJBQXVCLENBQUMsSUFBSSxDQUFDRixLQUFLLENBQUMsQ0FBQTs7QUFFeEM7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDRyxJQUFJLEdBQUcsSUFBSUMsTUFBTSxFQUFFLENBQUE7QUFDeEIsSUFBQSxJQUFJLENBQUNELElBQUksQ0FBQ0UsbUJBQW1CLEdBQUcsSUFBSSxDQUFBOztBQUVwQztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ1EsSUFBSSxDQUFDQyxNQUFNLEdBQUcsSUFBSUMsYUFBYSxDQUFDLElBQUksQ0FBQ1gsTUFBTSxDQUFDLENBQUE7QUFDNUMsSUFBQSxJQUFJWixVQUFVLENBQUN3QixXQUFXLEVBQUUsSUFBSSxDQUFDRixNQUFNLENBQUNHLE1BQU0sR0FBR3pCLFVBQVUsQ0FBQ3dCLFdBQVcsQ0FBQTs7QUFFdkU7QUFDUjtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNFLE9BQU8sR0FBRyxJQUFJQyxjQUFjLENBQUMsSUFBSSxDQUFDTCxNQUFNLENBQUMsQ0FBQTs7QUFFOUM7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ00sYUFBYSxHQUFJLE9BQU9DLFdBQVcsS0FBSyxXQUFZLENBQUE7QUFFekQsSUFBQSxJQUFJLENBQUNDLFlBQVksR0FBRzlCLFVBQVUsQ0FBQzhCLFlBQVksSUFBSSxFQUFFLENBQUE7O0FBRWpEO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsT0FBTyxHQUFHLElBQUlDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQTs7QUFFdkM7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDQyxJQUFJLEdBQUcsSUFBSUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBOztBQUUxQjtBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLE1BQU0sR0FBRyxJQUFJQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUE7SUFFckMsTUFBTUMsSUFBSSxHQUFHLElBQUksQ0FBQTtBQUNqQixJQUFBLElBQUksQ0FBQ0MsaUJBQWlCLEdBQUcsSUFBSUMsS0FBSyxDQUFDO0FBQy9CQyxNQUFBQSxJQUFJLEVBQUUsT0FBTztBQUNiN0QsTUFBQUEsRUFBRSxFQUFFOEQsYUFBQUE7QUFDUixLQUFDLENBQUMsQ0FBQTtBQUVGLElBQUEsSUFBSSxDQUFDQyxTQUFTLEdBQUcsSUFBSUMsU0FBUyxDQUFDLElBQUksQ0FBQ3pDLGNBQWMsRUFBRSxJQUFJLENBQUNjLEtBQUssQ0FBQyxDQUFBO0FBQy9ELElBQUEsSUFBSSxDQUFDNEIsaUJBQWlCLEdBQUcsSUFBSSxDQUFDRixTQUFTLENBQUNHLEtBQUssQ0FBQTtBQUU3QyxJQUFBLElBQUksQ0FBQ0Msa0JBQWtCLEdBQUcsSUFBSVAsS0FBSyxDQUFDO0FBQ2hDUSxNQUFBQSxPQUFPLEVBQUUsSUFBSTtBQUNiUCxNQUFBQSxJQUFJLEVBQUUsUUFBUTtBQUNkN0QsTUFBQUEsRUFBRSxFQUFFcUUsY0FBYztBQUNsQkMsTUFBQUEsY0FBYyxFQUFFQyxhQUFBQTtBQUNwQixLQUFDLENBQUMsQ0FBQTtBQUNGLElBQUEsSUFBSSxDQUFDQyxjQUFjLEdBQUcsSUFBSVosS0FBSyxDQUFDO0FBQzVCUSxNQUFBQSxPQUFPLEVBQUUsSUFBSTtBQUNiUCxNQUFBQSxJQUFJLEVBQUUsSUFBSTtBQUNWN0QsTUFBQUEsRUFBRSxFQUFFeUUsVUFBVTtBQUNkQyxNQUFBQSxtQkFBbUIsRUFBRUMsZUFBZTtBQUNwQ0MsTUFBQUEsV0FBVyxFQUFFLEtBQUE7QUFDakIsS0FBQyxDQUFDLENBQUE7QUFDRixJQUFBLElBQUksQ0FBQ0MscUJBQXFCLEdBQUcsSUFBSWpCLEtBQUssQ0FBQztBQUNuQ1EsTUFBQUEsT0FBTyxFQUFFLElBQUk7QUFDYlAsTUFBQUEsSUFBSSxFQUFFLFdBQVc7QUFDakI3RCxNQUFBQSxFQUFFLEVBQUU4RSxpQkFBaUI7QUFDckJSLE1BQUFBLGNBQWMsRUFBRUMsYUFBYTtBQUM3QkssTUFBQUEsV0FBVyxFQUFFLElBQUE7QUFDakIsS0FBQyxDQUFDLENBQUE7QUFFRixJQUFBLE1BQU1HLHVCQUF1QixHQUFHLElBQUlDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFBO0FBQy9ERCxJQUFBQSx1QkFBdUIsQ0FBQ0UsVUFBVSxDQUFDLElBQUksQ0FBQ3RCLGlCQUFpQixDQUFDLENBQUE7QUFDMURvQixJQUFBQSx1QkFBdUIsQ0FBQ0UsVUFBVSxDQUFDLElBQUksQ0FBQ2hCLGlCQUFpQixDQUFDLENBQUE7QUFDMURjLElBQUFBLHVCQUF1QixDQUFDRSxVQUFVLENBQUMsSUFBSSxDQUFDZCxrQkFBa0IsQ0FBQyxDQUFBO0FBQzNEWSxJQUFBQSx1QkFBdUIsQ0FBQ0csZUFBZSxDQUFDLElBQUksQ0FBQ3ZCLGlCQUFpQixDQUFDLENBQUE7QUFDL0RvQixJQUFBQSx1QkFBdUIsQ0FBQ0UsVUFBVSxDQUFDLElBQUksQ0FBQ0oscUJBQXFCLENBQUMsQ0FBQTtBQUM5REUsSUFBQUEsdUJBQXVCLENBQUNHLGVBQWUsQ0FBQyxJQUFJLENBQUNMLHFCQUFxQixDQUFDLENBQUE7QUFDbkVFLElBQUFBLHVCQUF1QixDQUFDRyxlQUFlLENBQUMsSUFBSSxDQUFDVixjQUFjLENBQUMsQ0FBQTtBQUM1RCxJQUFBLElBQUksQ0FBQ25DLEtBQUssQ0FBQzhDLE1BQU0sR0FBR0osdUJBQXVCLENBQUE7O0FBRTNDO0lBQ0EsSUFBSSxDQUFDMUMsS0FBSyxDQUFDK0MsRUFBRSxDQUFDLFlBQVksRUFBRSxVQUFVQyxPQUFPLEVBQUVDLE9BQU8sRUFBRTtBQUNwRCxNQUFBLE1BQU1DLElBQUksR0FBR0QsT0FBTyxDQUFDRSxTQUFTLENBQUE7QUFDOUIsTUFBQSxJQUFJdEIsS0FBSyxDQUFBO0FBQ1QsTUFBQSxLQUFLLElBQUl1QixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdGLElBQUksQ0FBQ3JHLE1BQU0sRUFBRXVHLENBQUMsRUFBRSxFQUFFO0FBQ2xDdkIsUUFBQUEsS0FBSyxHQUFHcUIsSUFBSSxDQUFDRSxDQUFDLENBQUMsQ0FBQTtRQUNmLFFBQVF2QixLQUFLLENBQUNsRSxFQUFFO0FBQ1osVUFBQSxLQUFLMEYsYUFBYTtBQUNkaEMsWUFBQUEsSUFBSSxDQUFDSyxTQUFTLENBQUM0QixLQUFLLENBQUN6QixLQUFLLENBQUMsQ0FBQTtBQUMzQixZQUFBLE1BQUE7QUFDSixVQUFBLEtBQUtPLFVBQVU7QUFDWFAsWUFBQUEsS0FBSyxDQUFDVSxXQUFXLEdBQUdsQixJQUFJLENBQUNjLGNBQWMsQ0FBQ0ksV0FBVyxDQUFBO0FBQ25ELFlBQUEsTUFBQTtBQUNKLFVBQUEsS0FBS0UsaUJBQWlCO0FBQ2xCWixZQUFBQSxLQUFLLENBQUNVLFdBQVcsR0FBR2xCLElBQUksQ0FBQ21CLHFCQUFxQixDQUFDRCxXQUFXLENBQUE7QUFDMUQsWUFBQSxNQUFBO0FBQ1IsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFDLENBQUMsQ0FBQTs7QUFFRjtBQUNBZ0IsSUFBQUEsYUFBYSxDQUFDQyxpQkFBaUIsQ0FBQ3ZFLE1BQU0sQ0FBQyxDQUFBOztBQUV2QztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ3dFLFFBQVEsR0FBRyxJQUFJQyxlQUFlLENBQUN6RSxNQUFNLENBQUMsQ0FBQTtBQUMzQyxJQUFBLElBQUksQ0FBQ3dFLFFBQVEsQ0FBQ3pELEtBQUssR0FBRyxJQUFJLENBQUNBLEtBQUssQ0FBQTs7QUFFaEM7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUMyRCxVQUFVLEdBQUcsSUFBSUMsVUFBVSxFQUFFLENBQUE7O0FBRWxDO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJLENBQUE7SUFDdkIsSUFBSTdFLFVBQVUsQ0FBQzZFLFdBQVcsRUFBRTtNQUN4QixJQUFJLENBQUNBLFdBQVcsR0FBRyxJQUFJN0UsVUFBVSxDQUFDNkUsV0FBVyxDQUFDNUUsTUFBTSxFQUFFLElBQUksQ0FBQ2tCLElBQUksRUFBRSxJQUFJLENBQUNILEtBQUssRUFBRSxJQUFJLENBQUN5RCxRQUFRLEVBQUUsSUFBSSxDQUFDbkQsTUFBTSxDQUFDLENBQUE7TUFDeEcsSUFBSSxDQUFDd0QsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUNDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUNqRCxLQUFBOztBQUVBO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsUUFBUSxHQUFHLElBQUksQ0FBQTtJQUNwQixJQUFJaEYsVUFBVSxDQUFDaUYsWUFBWSxFQUFFO0FBQ3pCLE1BQUEsSUFBSSxDQUFDRCxRQUFRLEdBQUcsSUFBSWhGLFVBQVUsQ0FBQ2lGLFlBQVksQ0FBQ2hGLE1BQU0sRUFBRSxJQUFJLENBQUNrQixJQUFJLEVBQUUsSUFBSSxDQUFDSCxLQUFLLENBQUMsQ0FBQTtNQUMxRSxJQUFJLENBQUM4RCxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQ0ksV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ2xELEtBQUE7O0FBRUE7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDQyxRQUFRLEdBQUduRixVQUFVLENBQUNtRixRQUFRLElBQUksSUFBSSxDQUFBOztBQUUzQztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLEtBQUssR0FBR3BGLFVBQVUsQ0FBQ29GLEtBQUssSUFBSSxJQUFJLENBQUE7O0FBRXJDO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDUSxJQUFBLElBQUksQ0FBQ0MsS0FBSyxHQUFHckYsVUFBVSxDQUFDcUYsS0FBSyxJQUFJLElBQUksQ0FBQTs7QUFFckM7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDQyxRQUFRLEdBQUd0RixVQUFVLENBQUNzRixRQUFRLElBQUksSUFBSSxDQUFBOztBQUUzQztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLFlBQVksR0FBR3ZGLFVBQVUsQ0FBQ3VGLFlBQVksSUFBSSxJQUFJLENBQUE7SUFDbkQsSUFBSSxJQUFJLENBQUNBLFlBQVksRUFDakIsSUFBSSxDQUFDQSxZQUFZLENBQUN0SCxHQUFHLEdBQUcsSUFBSSxDQUFBOztBQUVoQztBQUNSO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNRLElBQUEsSUFBSSxDQUFDdUgsRUFBRSxHQUFHeEYsVUFBVSxDQUFDd0YsRUFBRSxHQUFHLElBQUl4RixVQUFVLENBQUN3RixFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFBO0lBRXhELElBQUksSUFBSSxDQUFDRCxZQUFZLEVBQ2pCLElBQUksQ0FBQ0EsWUFBWSxDQUFDRSxrQkFBa0IsRUFBRSxDQUFBOztBQUUxQztBQUNSO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsUUFBUSxHQUFHLEtBQUssQ0FBQTs7QUFFckI7QUFDUjtBQUNBO0FBQ0E7SUFDUSxJQUFJLENBQUNDLFlBQVksR0FBRyxJQUFJLENBQUE7O0FBRXhCO0FBQ1I7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNDLGFBQWEsR0FBRzVGLFVBQVUsQ0FBQzZGLFlBQVksSUFBSSxFQUFFLENBQUE7SUFFbEQsSUFBSSxJQUFJLENBQUNqRSxhQUFhLEVBQUU7QUFDcEIsTUFBQSxJQUFJLENBQUNoQixNQUFNLENBQUNrRixVQUFVLENBQUMsUUFBUSxFQUFFLElBQUlDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO0FBQzdELEtBQUE7O0FBRUE7QUFDQS9GLElBQUFBLFVBQVUsQ0FBQ2dHLGdCQUFnQixDQUFDQyxPQUFPLENBQUVDLGVBQWUsSUFBSztBQUNyRCxNQUFBLE1BQU1DLE9BQU8sR0FBRyxJQUFJRCxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUE7TUFDekMsSUFBSSxDQUFDdEYsTUFBTSxDQUFDa0YsVUFBVSxDQUFDSyxPQUFPLENBQUNDLFdBQVcsRUFBRUQsT0FBTyxDQUFDLENBQUE7QUFDeEQsS0FBQyxDQUFDLENBQUE7O0FBRUY7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ1EsSUFBQSxJQUFJLENBQUNFLE9BQU8sR0FBRyxJQUFJQyx1QkFBdUIsRUFBRSxDQUFBOztBQUU1QztBQUNBdEcsSUFBQUEsVUFBVSxDQUFDdUcsZ0JBQWdCLENBQUNOLE9BQU8sQ0FBRU8sZUFBZSxJQUFLO01BQ3JELElBQUksQ0FBQ0gsT0FBTyxDQUFDSSxHQUFHLENBQUMsSUFBSUQsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUE7QUFDL0MsS0FBQyxDQUFDLENBQUE7O0FBRUY7SUFDQSxJQUFJLENBQUNFLHdCQUF3QixHQUFHLElBQUksQ0FBQ0Msa0JBQWtCLENBQUNDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTs7QUFFbEU7QUFDQTtBQUNBLElBQUEsSUFBSSxPQUFPQyxRQUFRLEtBQUssV0FBVyxFQUFFO0FBQ2pDLE1BQUEsSUFBSUEsUUFBUSxDQUFDQyxNQUFNLEtBQUtDLFNBQVMsRUFBRTtRQUMvQixJQUFJLENBQUNDLFdBQVcsR0FBRyxRQUFRLENBQUE7UUFDM0JILFFBQVEsQ0FBQ0ksZ0JBQWdCLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDUCx3QkFBd0IsRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUN2RixPQUFDLE1BQU0sSUFBSUcsUUFBUSxDQUFDSyxTQUFTLEtBQUtILFNBQVMsRUFBRTtRQUN6QyxJQUFJLENBQUNDLFdBQVcsR0FBRyxXQUFXLENBQUE7UUFDOUJILFFBQVEsQ0FBQ0ksZ0JBQWdCLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDUCx3QkFBd0IsRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUMxRixPQUFDLE1BQU0sSUFBSUcsUUFBUSxDQUFDTSxRQUFRLEtBQUtKLFNBQVMsRUFBRTtRQUN4QyxJQUFJLENBQUNDLFdBQVcsR0FBRyxVQUFVLENBQUE7UUFDN0JILFFBQVEsQ0FBQ0ksZ0JBQWdCLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDUCx3QkFBd0IsRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUN6RixPQUFDLE1BQU0sSUFBSUcsUUFBUSxDQUFDTyxZQUFZLEtBQUtMLFNBQVMsRUFBRTtRQUM1QyxJQUFJLENBQUNDLFdBQVcsR0FBRyxjQUFjLENBQUE7UUFDakNILFFBQVEsQ0FBQ0ksZ0JBQWdCLENBQUMsd0JBQXdCLEVBQUUsSUFBSSxDQUFDUCx3QkFBd0IsRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUM3RixPQUFBO0FBQ0osS0FBQTs7QUFFQTtBQUNBO0lBQ0EsSUFBSSxDQUFDVyxJQUFJLEdBQUdDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMvQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUlJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJLE9BQU9DLGNBQWNBLENBQUM1SSxFQUFFLEVBQUU7SUFDdEIsT0FBT0EsRUFBRSxHQUFHVCxPQUFPLENBQUNRLGFBQWEsQ0FBQ0MsRUFBRSxDQUFDLEdBQUc0SSxjQUFjLEVBQUUsQ0FBQTtBQUM1RCxHQUFBOztBQUVBO0FBQ0FqSCxFQUFBQSxvQkFBb0JBLEdBQUc7QUFDbkIsSUFBQSxNQUFNa0gsUUFBUSxHQUFHLElBQUlDLGdCQUFnQixFQUFFLENBQUE7SUFDdkNELFFBQVEsQ0FBQ2hGLElBQUksR0FBRyxrQkFBa0IsQ0FBQTtJQUNsQ2dGLFFBQVEsQ0FBQ0UsWUFBWSxHQUFHQyxjQUFjLENBQUE7QUFDdENDLElBQUFBLGtCQUFrQixDQUFDLElBQUksQ0FBQzFILGNBQWMsRUFBRXNILFFBQVEsQ0FBQyxDQUFBO0FBQ3JELEdBQUE7O0FBRUE7QUFDQWpILEVBQUFBLG1CQUFtQkEsR0FBRztBQUNsQixJQUFBLE1BQU1zSCxPQUFPLEdBQUcsSUFBSUMsY0FBYyxDQUFDLElBQUksQ0FBQzVILGNBQWMsRUFBRSxJQUFJdUgsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFBO0FBQy9FTSxJQUFBQSxpQkFBaUIsQ0FBQyxJQUFJLENBQUM3SCxjQUFjLEVBQUUySCxPQUFPLENBQUMsQ0FBQTtBQUNuRCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0VBQ0ksSUFBSWxILFlBQVlBLEdBQUc7SUFDZixPQUFPLElBQUksQ0FBQ0QsYUFBYSxDQUFBO0FBQzdCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSXNILE9BQU9BLEdBQUc7SUFDVnpKLEtBQUssQ0FBQzRCLE1BQU0sQ0FBQyxJQUFJLENBQUM2RSxRQUFRLEVBQUUsOEVBQThFLENBQUMsQ0FBQTtJQUMzRyxPQUFPLElBQUksQ0FBQ0EsUUFBUSxDQUFBO0FBQ3hCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSSxJQUFJaUQsUUFBUUEsR0FBRztJQUNYLE9BQU8sSUFBSSxDQUFDeEksU0FBUyxDQUFBO0FBQ3pCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSXlJLGNBQWNBLEdBQUc7SUFDakIsT0FBTyxJQUFJLENBQUN2SSxlQUFlLENBQUE7QUFDL0IsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0l3SSxFQUFBQSxTQUFTQSxDQUFDQyxHQUFHLEVBQUVDLFFBQVEsRUFBRTtJQUNyQkMsSUFBSSxDQUFDQyxHQUFHLENBQUNILEdBQUcsRUFBRSxDQUFDSSxHQUFHLEVBQUVDLFFBQVEsS0FBSztBQUM3QixNQUFBLElBQUlELEdBQUcsRUFBRTtRQUNMSCxRQUFRLENBQUNHLEdBQUcsQ0FBQyxDQUFBO0FBQ2IsUUFBQSxPQUFBO0FBQ0osT0FBQTtBQUVBLE1BQUEsTUFBTUUsS0FBSyxHQUFHRCxRQUFRLENBQUNFLHNCQUFzQixDQUFBO0FBQzdDLE1BQUEsTUFBTXhHLE1BQU0sR0FBR3NHLFFBQVEsQ0FBQ3RHLE1BQU0sQ0FBQTtBQUM5QixNQUFBLE1BQU1iLE1BQU0sR0FBR21ILFFBQVEsQ0FBQ25ILE1BQU0sQ0FBQTtBQUU5QixNQUFBLElBQUksQ0FBQ3NILDJCQUEyQixDQUFDRixLQUFLLEVBQUdGLEdBQUcsSUFBSztBQUM3QyxRQUFBLElBQUksQ0FBQ0ssWUFBWSxDQUFDMUcsTUFBTSxDQUFDLENBQUE7QUFDekIsUUFBQSxJQUFJLENBQUMyRyxZQUFZLENBQUN4SCxNQUFNLENBQUMsQ0FBQTtRQUN6QixJQUFJLENBQUNrSCxHQUFHLEVBQUU7VUFDTkgsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ2xCLFNBQUMsTUFBTTtVQUNIQSxRQUFRLENBQUNHLEdBQUcsQ0FBQyxDQUFBO0FBQ2pCLFNBQUE7QUFDSixPQUFDLENBQUMsQ0FBQTtBQUNOLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0lPLE9BQU9BLENBQUNWLFFBQVEsRUFBRTtBQUNkLElBQUEsSUFBSSxDQUFDVyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUE7O0FBRTFCO0FBQ0EsSUFBQSxNQUFNMUgsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFDNEMsSUFBSSxDQUFDO0FBQzVCNkUsTUFBQUEsT0FBTyxFQUFFLElBQUE7QUFDYixLQUFDLENBQUMsQ0FBQTtJQUVGLE1BQU1FLFFBQVEsR0FBRyxJQUFJdEwsUUFBUSxDQUFDMkQsTUFBTSxDQUFDekQsTUFBTSxDQUFDLENBQUE7SUFFNUMsSUFBSXFMLEtBQUssR0FBRyxLQUFLLENBQUE7O0FBRWpCO0lBQ0EsTUFBTWxMLElBQUksR0FBR0EsTUFBTTtBQUNmO0FBQ0EsTUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDa0MsY0FBYyxFQUFFO0FBQ3RCLFFBQUEsT0FBQTtBQUNKLE9BQUE7TUFFQSxJQUFJLENBQUNnSixLQUFLLElBQUlELFFBQVEsQ0FBQ2pMLElBQUksRUFBRSxFQUFFO0FBQzNCa0wsUUFBQUEsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUNaLFFBQUEsSUFBSSxDQUFDRixJQUFJLENBQUMsYUFBYSxDQUFDLENBQUE7QUFDeEJYLFFBQUFBLFFBQVEsRUFBRSxDQUFBO0FBQ2QsT0FBQTtLQUNILENBQUE7O0FBRUQ7QUFDQSxJQUFBLE1BQU1jLEtBQUssR0FBRzdILE1BQU0sQ0FBQ3pELE1BQU0sQ0FBQTtJQUUzQixJQUFJb0wsUUFBUSxDQUFDcEwsTUFBTSxFQUFFO01BQ2pCLE1BQU11TCxXQUFXLEdBQUlDLEtBQUssSUFBSztRQUMzQkosUUFBUSxDQUFDbEwsR0FBRyxFQUFFLENBQUE7UUFDZCxJQUFJLENBQUNpTCxJQUFJLENBQUMsa0JBQWtCLEVBQUVDLFFBQVEsQ0FBQ25MLEtBQUssR0FBR3FMLEtBQUssQ0FBQyxDQUFBO1FBRXJELElBQUlGLFFBQVEsQ0FBQ2pMLElBQUksRUFBRSxFQUNmQSxJQUFJLEVBQUUsQ0FBQTtPQUNiLENBQUE7QUFFRCxNQUFBLE1BQU1zTCxZQUFZLEdBQUdBLENBQUNkLEdBQUcsRUFBRWEsS0FBSyxLQUFLO1FBQ2pDSixRQUFRLENBQUNsTCxHQUFHLEVBQUUsQ0FBQTtRQUNkLElBQUksQ0FBQ2lMLElBQUksQ0FBQyxrQkFBa0IsRUFBRUMsUUFBUSxDQUFDbkwsS0FBSyxHQUFHcUwsS0FBSyxDQUFDLENBQUE7UUFFckQsSUFBSUYsUUFBUSxDQUFDakwsSUFBSSxFQUFFLEVBQ2ZBLElBQUksRUFBRSxDQUFBO09BQ2IsQ0FBQTs7QUFFRDtBQUNBLE1BQUEsS0FBSyxJQUFJb0csQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHOUMsTUFBTSxDQUFDekQsTUFBTSxFQUFFdUcsQ0FBQyxFQUFFLEVBQUU7QUFDcEMsUUFBQSxJQUFJLENBQUM5QyxNQUFNLENBQUM4QyxDQUFDLENBQUMsQ0FBQ21GLE1BQU0sRUFBRTtVQUNuQmpJLE1BQU0sQ0FBQzhDLENBQUMsQ0FBQyxDQUFDVSxJQUFJLENBQUMsTUFBTSxFQUFFc0UsV0FBVyxDQUFDLENBQUE7VUFDbkM5SCxNQUFNLENBQUM4QyxDQUFDLENBQUMsQ0FBQ1UsSUFBSSxDQUFDLE9BQU8sRUFBRXdFLFlBQVksQ0FBQyxDQUFBO1VBRXJDLElBQUksQ0FBQ2hJLE1BQU0sQ0FBQ2tJLElBQUksQ0FBQ2xJLE1BQU0sQ0FBQzhDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDL0IsU0FBQyxNQUFNO1VBQ0g2RSxRQUFRLENBQUNsTCxHQUFHLEVBQUUsQ0FBQTtVQUNkLElBQUksQ0FBQ2lMLElBQUksQ0FBQyxrQkFBa0IsRUFBRUMsUUFBUSxDQUFDbkwsS0FBSyxHQUFHcUwsS0FBSyxDQUFDLENBQUE7VUFFckQsSUFBSUYsUUFBUSxDQUFDakwsSUFBSSxFQUFFLEVBQ2ZBLElBQUksRUFBRSxDQUFBO0FBQ2QsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFDLE1BQU07QUFDSEEsTUFBQUEsSUFBSSxFQUFFLENBQUE7QUFDVixLQUFBO0FBQ0osR0FBQTtBQUVBeUwsRUFBQUEsZUFBZUEsQ0FBQ0MsU0FBUyxFQUFFckIsUUFBUSxFQUFFO0FBQ2pDLElBQUEsSUFBSSxDQUFDL0ksTUFBTSxDQUFDQyxNQUFNLEVBQUU7QUFDaEI4SSxNQUFBQSxRQUFRLEVBQUUsQ0FBQTtBQUNWLE1BQUEsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ2hDLE9BQU8sQ0FBQy9HLE1BQU0sQ0FBQ3FLLFVBQVUsR0FBRyxJQUFJLENBQUE7QUFFckMsSUFBQSxNQUFNNUgsT0FBTyxHQUFHLElBQUksQ0FBQzZILG9CQUFvQixDQUFDRixTQUFTLENBQUMsQ0FBQTtBQUVwRCxJQUFBLE1BQU1HLENBQUMsR0FBRzlILE9BQU8sQ0FBQ2xFLE1BQU0sQ0FBQTtBQUN4QixJQUFBLE1BQU1vTCxRQUFRLEdBQUcsSUFBSXRMLFFBQVEsQ0FBQ2tNLENBQUMsQ0FBQyxDQUFBO0lBQ2hDLE1BQU1DLEtBQUssR0FBRyxnQkFBZ0IsQ0FBQTtBQUU5QixJQUFBLElBQUlELENBQUMsRUFBRTtBQUNILE1BQUEsTUFBTUUsTUFBTSxHQUFHQSxDQUFDdkIsR0FBRyxFQUFFd0IsVUFBVSxLQUFLO0FBQ2hDLFFBQUEsSUFBSXhCLEdBQUcsRUFDSHlCLE9BQU8sQ0FBQ0MsS0FBSyxDQUFDMUIsR0FBRyxDQUFDLENBQUE7UUFFdEJTLFFBQVEsQ0FBQ2xMLEdBQUcsRUFBRSxDQUFBO0FBQ2QsUUFBQSxJQUFJa0wsUUFBUSxDQUFDakwsSUFBSSxFQUFFLEVBQUU7QUFDakIsVUFBQSxJQUFJLENBQUNxSSxPQUFPLENBQUMvRyxNQUFNLENBQUNxSyxVQUFVLEdBQUcsS0FBSyxDQUFBO0FBQ3RDdEIsVUFBQUEsUUFBUSxFQUFFLENBQUE7QUFDZCxTQUFBO09BQ0gsQ0FBQTtNQUVELEtBQUssSUFBSWpFLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3lGLENBQUMsRUFBRXpGLENBQUMsRUFBRSxFQUFFO0FBQ3hCLFFBQUEsSUFBSStGLFNBQVMsR0FBR3BJLE9BQU8sQ0FBQ3FDLENBQUMsQ0FBQyxDQUFBO0FBQzFCO0FBQ0EsUUFBQSxJQUFJLENBQUMwRixLQUFLLENBQUNNLElBQUksQ0FBQ0QsU0FBUyxDQUFDRSxXQUFXLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQ3pFLGFBQWEsRUFDMUR1RSxTQUFTLEdBQUdHLElBQUksQ0FBQ0MsSUFBSSxDQUFDLElBQUksQ0FBQzNFLGFBQWEsRUFBRTdELE9BQU8sQ0FBQ3FDLENBQUMsQ0FBQyxDQUFDLENBQUE7UUFFekQsSUFBSSxDQUFDeEQsTUFBTSxDQUFDNEksSUFBSSxDQUFDVyxTQUFTLEVBQUUsUUFBUSxFQUFFSixNQUFNLENBQUMsQ0FBQTtBQUNqRCxPQUFBO0FBQ0osS0FBQyxNQUFNO0FBQ0gsTUFBQSxJQUFJLENBQUMxRCxPQUFPLENBQUMvRyxNQUFNLENBQUNxSyxVQUFVLEdBQUcsS0FBSyxDQUFBO0FBQ3RDdEIsTUFBQUEsUUFBUSxFQUFFLENBQUE7QUFDZCxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNBTyxFQUFBQSwyQkFBMkJBLENBQUNGLEtBQUssRUFBRUwsUUFBUSxFQUFFO0FBQ3pDO0FBQ0EsSUFBQSxJQUFJLE9BQU9LLEtBQUssQ0FBQzhCLGVBQWUsS0FBSyxRQUFRLElBQUk5QixLQUFLLENBQUM4QixlQUFlLEdBQUcsQ0FBQyxFQUFFO01BQ3hFLElBQUksQ0FBQzVKLE1BQU0sQ0FBQzZKLFdBQVcsQ0FBQy9CLEtBQUssQ0FBQzhCLGVBQWUsQ0FBQyxDQUFBO0FBQ2xELEtBQUE7O0FBRUE7SUFDQSxJQUFJLENBQUM5QixLQUFLLENBQUNnQyxtQkFBbUIsRUFDMUJoQyxLQUFLLENBQUNnQyxtQkFBbUIsR0FBR2hDLEtBQUssQ0FBQ2lDLHNCQUFzQixDQUFBO0lBQzVELElBQUksQ0FBQ2pDLEtBQUssQ0FBQ1IsY0FBYyxFQUNyQlEsS0FBSyxDQUFDUixjQUFjLEdBQUdRLEtBQUssQ0FBQ2tDLGVBQWUsQ0FBQTtJQUNoRCxJQUFJLENBQUNsQyxLQUFLLENBQUNULFFBQVEsRUFDZlMsS0FBSyxDQUFDVCxRQUFRLEdBQUdTLEtBQUssQ0FBQ21DLFNBQVMsQ0FBQTtBQUVwQyxJQUFBLElBQUksQ0FBQ0MsTUFBTSxHQUFHcEMsS0FBSyxDQUFDcUMsS0FBSyxDQUFBO0FBQ3pCLElBQUEsSUFBSSxDQUFDQyxPQUFPLEdBQUd0QyxLQUFLLENBQUN1QyxNQUFNLENBQUE7SUFDM0IsSUFBSXZDLEtBQUssQ0FBQ2dDLG1CQUFtQixFQUFFO0FBQzNCLE1BQUEsSUFBSSxDQUFDeEssY0FBYyxDQUFDZ0wsYUFBYSxHQUFHQyxNQUFNLENBQUNDLGdCQUFnQixDQUFBO0FBQy9ELEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ0MsbUJBQW1CLENBQUMzQyxLQUFLLENBQUNSLGNBQWMsRUFBRSxJQUFJLENBQUM0QyxNQUFNLEVBQUUsSUFBSSxDQUFDRSxPQUFPLENBQUMsQ0FBQTtBQUN6RSxJQUFBLElBQUksQ0FBQ00saUJBQWlCLENBQUM1QyxLQUFLLENBQUNULFFBQVEsRUFBRSxJQUFJLENBQUM2QyxNQUFNLEVBQUUsSUFBSSxDQUFDRSxPQUFPLENBQUMsQ0FBQTs7QUFFakU7QUFDQSxJQUFBLElBQUl0QyxLQUFLLENBQUM1RSxNQUFNLElBQUk0RSxLQUFLLENBQUM2QyxVQUFVLEVBQUU7QUFDbEMsTUFBQSxNQUFNQyxXQUFXLEdBQUcsSUFBSTdILGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFBO01BRXZELE1BQU1HLE1BQU0sR0FBRyxFQUFFLENBQUE7QUFDakIsTUFBQSxLQUFLLE1BQU0ySCxHQUFHLElBQUkvQyxLQUFLLENBQUM1RSxNQUFNLEVBQUU7QUFDNUIsUUFBQSxNQUFNNEgsSUFBSSxHQUFHaEQsS0FBSyxDQUFDNUUsTUFBTSxDQUFDMkgsR0FBRyxDQUFDLENBQUE7UUFDOUJDLElBQUksQ0FBQy9NLEVBQUUsR0FBR2dOLFFBQVEsQ0FBQ0YsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFBO0FBQzNCO0FBQ0E7QUFDQUMsUUFBQUEsSUFBSSxDQUFDM0ksT0FBTyxHQUFHMkksSUFBSSxDQUFDL00sRUFBRSxLQUFLMEYsYUFBYSxDQUFBO1FBQ3hDUCxNQUFNLENBQUMySCxHQUFHLENBQUMsR0FBRyxJQUFJbEosS0FBSyxDQUFDbUosSUFBSSxDQUFDLENBQUE7QUFDakMsT0FBQTtBQUVBLE1BQUEsS0FBSyxJQUFJdEgsQ0FBQyxHQUFHLENBQUMsRUFBRXdILEdBQUcsR0FBR2xELEtBQUssQ0FBQzZDLFVBQVUsQ0FBQzFOLE1BQU0sRUFBRXVHLENBQUMsR0FBR3dILEdBQUcsRUFBRXhILENBQUMsRUFBRSxFQUFFO0FBQ3pELFFBQUEsTUFBTXlILFFBQVEsR0FBR25ELEtBQUssQ0FBQzZDLFVBQVUsQ0FBQ25ILENBQUMsQ0FBQyxDQUFBO0FBQ3BDLFFBQUEsTUFBTXZCLEtBQUssR0FBR2lCLE1BQU0sQ0FBQytILFFBQVEsQ0FBQ2hKLEtBQUssQ0FBQyxDQUFBO1FBQ3BDLElBQUksQ0FBQ0EsS0FBSyxFQUFFLFNBQUE7UUFFWixJQUFJZ0osUUFBUSxDQUFDQyxXQUFXLEVBQUU7QUFDdEJOLFVBQUFBLFdBQVcsQ0FBQzNILGVBQWUsQ0FBQ2hCLEtBQUssQ0FBQyxDQUFBO0FBQ3RDLFNBQUMsTUFBTTtBQUNIMkksVUFBQUEsV0FBVyxDQUFDNUgsVUFBVSxDQUFDZixLQUFLLENBQUMsQ0FBQTtBQUNqQyxTQUFBO1FBRUEySSxXQUFXLENBQUNPLGVBQWUsQ0FBQzNILENBQUMsQ0FBQyxHQUFHeUgsUUFBUSxDQUFDOUksT0FBTyxDQUFBO0FBQ3JELE9BQUE7QUFFQSxNQUFBLElBQUksQ0FBQy9CLEtBQUssQ0FBQzhDLE1BQU0sR0FBRzBILFdBQVcsQ0FBQTtBQUNuQyxLQUFBOztBQUVBO0lBQ0EsSUFBSTlDLEtBQUssQ0FBQ3NELFdBQVcsRUFBRTtBQUNuQixNQUFBLE1BQU1oRSxPQUFPLEdBQUcsSUFBSSxDQUFDQSxPQUFPLENBQUE7QUFDNUIsTUFBQSxJQUFJQSxPQUFPLEVBQUU7QUFDVCxRQUFBLEtBQUssSUFBSTVELENBQUMsR0FBRyxDQUFDLEVBQUV3SCxHQUFHLEdBQUdsRCxLQUFLLENBQUNzRCxXQUFXLENBQUNuTyxNQUFNLEVBQUV1RyxDQUFDLEdBQUd3SCxHQUFHLEVBQUV4SCxDQUFDLEVBQUUsRUFBRTtBQUMxRCxVQUFBLE1BQU02SCxHQUFHLEdBQUd2RCxLQUFLLENBQUNzRCxXQUFXLENBQUM1SCxDQUFDLENBQUMsQ0FBQTtVQUNoQzRELE9BQU8sQ0FBQ2tFLFFBQVEsQ0FBQ0QsR0FBRyxDQUFDekosSUFBSSxFQUFFeUosR0FBRyxDQUFDRSxPQUFPLEVBQUVGLEdBQUcsQ0FBQ0csV0FBVyxFQUFFSCxHQUFHLENBQUN0TixFQUFFLEVBQUVzTixHQUFHLENBQUNuSSxNQUFNLENBQUMsQ0FBQTtBQUNoRixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBRUE7SUFDQSxJQUFJNEUsS0FBSyxDQUFDMkQsVUFBVSxFQUFFO0FBQ2xCLE1BQUEsSUFBSSxDQUFDcEssSUFBSSxDQUFDWCxNQUFNLEdBQUdvSCxLQUFLLENBQUMyRCxVQUFVLENBQUE7QUFDdkMsS0FBQTtJQUVBLElBQUksQ0FBQ0MsY0FBYyxDQUFDNUQsS0FBSyxDQUFDNkQsU0FBUyxFQUFFbEUsUUFBUSxDQUFDLENBQUE7QUFDbEQsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lpRSxFQUFBQSxjQUFjQSxDQUFDRSxJQUFJLEVBQUVuRSxRQUFRLEVBQUU7QUFDM0IsSUFBQSxNQUFNdUQsR0FBRyxHQUFHWSxJQUFJLENBQUMzTyxNQUFNLENBQUE7SUFDdkIsSUFBSUMsS0FBSyxHQUFHOE4sR0FBRyxDQUFBO0lBRWYsTUFBTTlCLEtBQUssR0FBRyxnQkFBZ0IsQ0FBQTtBQUU5QixJQUFBLElBQUk4QixHQUFHLEVBQUU7QUFDTCxNQUFBLE1BQU03QixNQUFNLEdBQUdBLENBQUN2QixHQUFHLEVBQUVsSixNQUFNLEtBQUs7QUFDNUJ4QixRQUFBQSxLQUFLLEVBQUUsQ0FBQTtBQUNQLFFBQUEsSUFBSTBLLEdBQUcsRUFBRTtVQUNMSCxRQUFRLENBQUNHLEdBQUcsQ0FBQyxDQUFBO0FBQ2pCLFNBQUMsTUFBTSxJQUFJMUssS0FBSyxLQUFLLENBQUMsRUFBRTtVQUNwQixJQUFJLENBQUMyTyxpQkFBaUIsRUFBRSxDQUFBO1VBQ3hCcEUsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ2xCLFNBQUE7T0FDSCxDQUFBO01BRUQsS0FBSyxJQUFJakUsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHd0gsR0FBRyxFQUFFLEVBQUV4SCxDQUFDLEVBQUU7QUFDMUIsUUFBQSxJQUFJZ0UsR0FBRyxHQUFHb0UsSUFBSSxDQUFDcEksQ0FBQyxDQUFDLENBQUE7UUFFakIsSUFBSSxDQUFDMEYsS0FBSyxDQUFDTSxJQUFJLENBQUNoQyxHQUFHLENBQUNpQyxXQUFXLEVBQUUsQ0FBQyxJQUFJLElBQUksQ0FBQ3pFLGFBQWEsRUFDcER3QyxHQUFHLEdBQUdrQyxJQUFJLENBQUNDLElBQUksQ0FBQyxJQUFJLENBQUMzRSxhQUFhLEVBQUV3QyxHQUFHLENBQUMsQ0FBQTtRQUU1QyxJQUFJLENBQUN4SCxNQUFNLENBQUM0SSxJQUFJLENBQUNwQixHQUFHLEVBQUUsUUFBUSxFQUFFMkIsTUFBTSxDQUFDLENBQUE7QUFDM0MsT0FBQTtBQUNKLEtBQUMsTUFBTTtNQUNILElBQUksQ0FBQzBDLGlCQUFpQixFQUFFLENBQUE7TUFDeEJwRSxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDbEIsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lRLFlBQVlBLENBQUMxRyxNQUFNLEVBQUU7SUFDakIsSUFBSSxDQUFDQSxNQUFNLEVBQUUsT0FBQTtBQUViLElBQUEsS0FBSyxJQUFJaUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHakMsTUFBTSxDQUFDdEUsTUFBTSxFQUFFdUcsQ0FBQyxFQUFFLEVBQUU7QUFDcEMsTUFBQSxJQUFJLENBQUNqQyxNQUFNLENBQUNzRSxHQUFHLENBQUN0RSxNQUFNLENBQUNpQyxDQUFDLENBQUMsQ0FBQzVCLElBQUksRUFBRUwsTUFBTSxDQUFDaUMsQ0FBQyxDQUFDLENBQUNnRSxHQUFHLENBQUMsQ0FBQTtBQUNsRCxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSVUsWUFBWUEsQ0FBQ3hILE1BQU0sRUFBRTtJQUNqQixNQUFNNEMsSUFBSSxHQUFHLEVBQUUsQ0FBQTtJQUVmLE1BQU13SSxZQUFZLEdBQUcsRUFBRSxDQUFBO0lBQ3ZCLE1BQU1DLFlBQVksR0FBRyxFQUFFLENBQUE7QUFFdkIsSUFBQSxJQUFJLENBQUNyTixNQUFNLENBQUNDLE1BQU0sRUFBRTtBQUNoQjtBQUNBLE1BQUEsS0FBSyxJQUFJNkUsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ3RDLFlBQVksQ0FBQ2pFLE1BQU0sRUFBRXVHLENBQUMsRUFBRSxFQUFFO0FBQy9DLFFBQUEsTUFBTXpGLEVBQUUsR0FBRyxJQUFJLENBQUNtRCxZQUFZLENBQUNzQyxDQUFDLENBQUMsQ0FBQTtBQUMvQixRQUFBLElBQUksQ0FBQzlDLE1BQU0sQ0FBQzNDLEVBQUUsQ0FBQyxFQUNYLFNBQUE7QUFFSitOLFFBQUFBLFlBQVksQ0FBQy9OLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQTtBQUN2QnVGLFFBQUFBLElBQUksQ0FBQzBJLElBQUksQ0FBQ3RMLE1BQU0sQ0FBQzNDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDekIsT0FBQTs7QUFFQTtNQUNBLElBQUksSUFBSSxDQUFDaUQsYUFBYSxFQUFFO0FBQ3BCLFFBQUEsS0FBSyxNQUFNakQsRUFBRSxJQUFJMkMsTUFBTSxFQUFFO1VBQ3JCLElBQUlBLE1BQU0sQ0FBQzNDLEVBQUUsQ0FBQyxDQUFDa08sSUFBSSxLQUFLLFFBQVEsRUFBRTtBQUM5QkYsWUFBQUEsWUFBWSxDQUFDaE8sRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCdUYsWUFBQUEsSUFBSSxDQUFDMEksSUFBSSxDQUFDdEwsTUFBTSxDQUFDM0MsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUN6QixXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7O0FBRUE7QUFDQSxNQUFBLEtBQUssTUFBTUEsRUFBRSxJQUFJMkMsTUFBTSxFQUFFO1FBQ3JCLElBQUlvTCxZQUFZLENBQUMvTixFQUFFLENBQUMsSUFBSWdPLFlBQVksQ0FBQ2hPLEVBQUUsQ0FBQyxFQUNwQyxTQUFBO0FBRUp1RixRQUFBQSxJQUFJLENBQUMwSSxJQUFJLENBQUN0TCxNQUFNLENBQUMzQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ3pCLE9BQUE7QUFDSixLQUFDLE1BQU07TUFDSCxJQUFJLElBQUksQ0FBQ2lELGFBQWEsRUFBRTtBQUNwQjtBQUNBLFFBQUEsS0FBSyxNQUFNakQsRUFBRSxJQUFJMkMsTUFBTSxFQUFFO1VBQ3JCLElBQUlBLE1BQU0sQ0FBQzNDLEVBQUUsQ0FBQyxDQUFDa08sSUFBSSxLQUFLLFFBQVEsRUFBRTtBQUM5QkYsWUFBQUEsWUFBWSxDQUFDaE8sRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFBO0FBQ3ZCdUYsWUFBQUEsSUFBSSxDQUFDMEksSUFBSSxDQUFDdEwsTUFBTSxDQUFDM0MsRUFBRSxDQUFDLENBQUMsQ0FBQTtBQUN6QixXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7O0FBRUE7QUFDQSxNQUFBLEtBQUssTUFBTUEsRUFBRSxJQUFJMkMsTUFBTSxFQUFFO0FBQ3JCLFFBQUEsSUFBSXFMLFlBQVksQ0FBQ2hPLEVBQUUsQ0FBQyxFQUNoQixTQUFBO0FBRUp1RixRQUFBQSxJQUFJLENBQUMwSSxJQUFJLENBQUN0TCxNQUFNLENBQUMzQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ3pCLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxLQUFLLElBQUl5RixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdGLElBQUksQ0FBQ3JHLE1BQU0sRUFBRXVHLENBQUMsRUFBRSxFQUFFO0FBQ2xDLE1BQUEsTUFBTXNILElBQUksR0FBR3hILElBQUksQ0FBQ0UsQ0FBQyxDQUFDLENBQUE7TUFDcEIsTUFBTWlGLEtBQUssR0FBRyxJQUFJeUQsS0FBSyxDQUFDcEIsSUFBSSxDQUFDbEosSUFBSSxFQUFFa0osSUFBSSxDQUFDbUIsSUFBSSxFQUFFbkIsSUFBSSxDQUFDcUIsSUFBSSxFQUFFckIsSUFBSSxDQUFDQSxJQUFJLENBQUMsQ0FBQTtNQUNuRXJDLEtBQUssQ0FBQzFLLEVBQUUsR0FBR2dOLFFBQVEsQ0FBQ0QsSUFBSSxDQUFDL00sRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFBO01BQ2hDMEssS0FBSyxDQUFDTixPQUFPLEdBQUcyQyxJQUFJLENBQUMzQyxPQUFPLEdBQUcyQyxJQUFJLENBQUMzQyxPQUFPLEdBQUcsS0FBSyxDQUFBO0FBQ25EO0FBQ0E7QUFDQU0sTUFBQUEsS0FBSyxDQUFDRSxNQUFNLEdBQUdtQyxJQUFJLENBQUNtQixJQUFJLEtBQUssUUFBUSxJQUFJbkIsSUFBSSxDQUFDQSxJQUFJLElBQUlBLElBQUksQ0FBQ0EsSUFBSSxDQUFDc0IsV0FBVyxHQUFHLENBQUMsQ0FBQTtBQUMvRTtNQUNBM0QsS0FBSyxDQUFDNEQsSUFBSSxDQUFDeEcsR0FBRyxDQUFDaUYsSUFBSSxDQUFDdUIsSUFBSSxDQUFDLENBQUE7QUFDekI7TUFDQSxJQUFJdkIsSUFBSSxDQUFDekosSUFBSSxFQUFFO0FBQ1gsUUFBQSxLQUFLLE1BQU1pTCxNQUFNLElBQUl4QixJQUFJLENBQUN6SixJQUFJLEVBQUU7VUFDNUJvSCxLQUFLLENBQUM4RCxtQkFBbUIsQ0FBQ0QsTUFBTSxFQUFFeEIsSUFBSSxDQUFDekosSUFBSSxDQUFDaUwsTUFBTSxDQUFDLENBQUMsQ0FBQTtBQUN4RCxTQUFBO0FBQ0osT0FBQTtBQUNBO0FBQ0EsTUFBQSxJQUFJLENBQUM1TCxNQUFNLENBQUNtRixHQUFHLENBQUM0QyxLQUFLLENBQUMsQ0FBQTtBQUMxQixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0VBQ0lPLG9CQUFvQkEsQ0FBQzVJLEtBQUssRUFBRTtJQUN4QixJQUFJb00sZUFBZSxHQUFHLEVBQUUsQ0FBQTtBQUN4QixJQUFBLElBQUlwTSxLQUFLLENBQUNxTSxRQUFRLENBQUNDLGdCQUFnQixFQUFFO0FBQ2pDRixNQUFBQSxlQUFlLEdBQUdwTSxLQUFLLENBQUNxTSxRQUFRLENBQUNDLGdCQUFnQixDQUFBO0FBQ3JELEtBQUE7SUFFQSxNQUFNQyxRQUFRLEdBQUcsRUFBRSxDQUFBO0lBQ25CLE1BQU1DLE1BQU0sR0FBRyxFQUFFLENBQUE7O0FBRWpCO0FBQ0EsSUFBQSxLQUFLLElBQUlwSixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdnSixlQUFlLENBQUN2UCxNQUFNLEVBQUV1RyxDQUFDLEVBQUUsRUFBRTtBQUM3Q21KLE1BQUFBLFFBQVEsQ0FBQ1gsSUFBSSxDQUFDUSxlQUFlLENBQUNoSixDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2pDb0osTUFBQUEsTUFBTSxDQUFDSixlQUFlLENBQUNoSixDQUFDLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQTtBQUNyQyxLQUFBOztBQUVBO0FBQ0EsSUFBQSxNQUFNcUosUUFBUSxHQUFHek0sS0FBSyxDQUFDeU0sUUFBUSxDQUFBO0FBQy9CLElBQUEsS0FBSyxNQUFNaEMsR0FBRyxJQUFJZ0MsUUFBUSxFQUFFO01BQ3hCLElBQUksQ0FBQ0EsUUFBUSxDQUFDaEMsR0FBRyxDQUFDLENBQUNpQyxVQUFVLENBQUNwTyxNQUFNLEVBQUU7QUFDbEMsUUFBQSxTQUFBO0FBQ0osT0FBQTtNQUVBLE1BQU15QyxPQUFPLEdBQUcwTCxRQUFRLENBQUNoQyxHQUFHLENBQUMsQ0FBQ2lDLFVBQVUsQ0FBQ3BPLE1BQU0sQ0FBQ3lDLE9BQU8sQ0FBQTtBQUN2RCxNQUFBLEtBQUssSUFBSXFDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3JDLE9BQU8sQ0FBQ2xFLE1BQU0sRUFBRXVHLENBQUMsRUFBRSxFQUFFO1FBQ3JDLElBQUlvSixNQUFNLENBQUN6TCxPQUFPLENBQUNxQyxDQUFDLENBQUMsQ0FBQ2dFLEdBQUcsQ0FBQyxFQUN0QixTQUFBO1FBQ0ptRixRQUFRLENBQUNYLElBQUksQ0FBQzdLLE9BQU8sQ0FBQ3FDLENBQUMsQ0FBQyxDQUFDZ0UsR0FBRyxDQUFDLENBQUE7UUFDN0JvRixNQUFNLENBQUN6TCxPQUFPLENBQUNxQyxDQUFDLENBQUMsQ0FBQ2dFLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQTtBQUNqQyxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsT0FBT21GLFFBQVEsQ0FBQTtBQUNuQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lJLEVBQUFBLEtBQUtBLEdBQUc7SUFFSnBQLEtBQUssQ0FBQ3FQLElBQUksQ0FBQyxNQUFNO01BQ2JyUCxLQUFLLENBQUM0QixNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMwTixlQUFlLEVBQUUsK0NBQStDLENBQUMsQ0FBQTtNQUNwRixJQUFJLENBQUNBLGVBQWUsR0FBRyxJQUFJLENBQUE7QUFDL0IsS0FBQyxDQUFDLENBQUE7SUFFRixJQUFJLENBQUMzTyxLQUFLLEdBQUcsQ0FBQyxDQUFBO0FBRWQsSUFBQSxJQUFJLENBQUM4SixJQUFJLENBQUMsT0FBTyxFQUFFO01BQ2Y4RSxTQUFTLEVBQUVDLEdBQUcsRUFBRTtBQUNoQkMsTUFBQUEsTUFBTSxFQUFFLElBQUE7QUFDWixLQUFDLENBQUMsQ0FBQTtBQUVGLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3hPLGdCQUFnQixFQUFFO01BQ3hCLElBQUksQ0FBQ2lOLGlCQUFpQixFQUFFLENBQUE7QUFDNUIsS0FBQTtJQUVBLElBQUksQ0FBQ3BHLE9BQU8sQ0FBQzJDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDN0gsSUFBSSxDQUFDLENBQUE7QUFDMUMsSUFBQSxJQUFJLENBQUM2SCxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUE7SUFFdkIsSUFBSSxDQUFDM0MsT0FBTyxDQUFDMkMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQzdILElBQUksQ0FBQyxDQUFBO0lBQzlDLElBQUksQ0FBQ2tGLE9BQU8sQ0FBQzJDLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUM3SCxJQUFJLENBQUMsQ0FBQTtBQUNsRCxJQUFBLElBQUksQ0FBQzZILElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFBO0lBRTNCLElBQUksQ0FBQzNCLElBQUksRUFBRSxDQUFBO0FBQ2YsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSTRHLFdBQVdBLENBQUNDLEVBQUUsRUFBRTtJQUNaLElBQUksSUFBSSxDQUFDQyxVQUFVLEVBQUU7QUFDakIsTUFBQSxJQUFJLENBQUNBLFVBQVUsQ0FBQ0MsTUFBTSxDQUFDRixFQUFFLENBQUMsQ0FBQTtBQUM5QixLQUFBO0lBQ0EsSUFBSSxJQUFJLENBQUM5SSxLQUFLLEVBQUU7QUFDWixNQUFBLElBQUksQ0FBQ0EsS0FBSyxDQUFDZ0osTUFBTSxFQUFFLENBQUE7QUFDdkIsS0FBQTtJQUNBLElBQUksSUFBSSxDQUFDakosUUFBUSxFQUFFO0FBQ2YsTUFBQSxJQUFJLENBQUNBLFFBQVEsQ0FBQ2lKLE1BQU0sRUFBRSxDQUFBO0FBQzFCLEtBQUE7SUFDQSxJQUFJLElBQUksQ0FBQzlJLFFBQVEsRUFBRTtBQUNmLE1BQUEsSUFBSSxDQUFDQSxRQUFRLENBQUM4SSxNQUFNLEVBQUUsQ0FBQTtBQUMxQixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lBLE1BQU1BLENBQUNGLEVBQUUsRUFBRTtJQUNQLElBQUksQ0FBQ2hQLEtBQUssRUFBRSxDQUFBO0FBRVosSUFBQSxJQUFJLENBQUNnQixjQUFjLENBQUNtTyxnQkFBZ0IsRUFBRSxDQUFBO0lBR3RDLElBQUksQ0FBQzdOLEtBQUssQ0FBQ3RCLEtBQUssQ0FBQ29QLFdBQVcsR0FBR1AsR0FBRyxFQUFFLENBQUE7O0FBR3BDO0FBQ0EsSUFBQSxJQUFJek8sTUFBTSxDQUFDQyxNQUFNLEVBQ2IsSUFBSSxDQUFDOEcsT0FBTyxDQUFDMkMsSUFBSSxDQUFDLGFBQWEsRUFBRSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUE7QUFFaEQsSUFBQSxJQUFJLENBQUMzQyxPQUFPLENBQUMyQyxJQUFJLENBQUMsSUFBSSxDQUFDdEQsUUFBUSxHQUFHLGFBQWEsR0FBRyxRQUFRLEVBQUV3SSxFQUFFLENBQUMsQ0FBQTtJQUMvRCxJQUFJLENBQUM3SCxPQUFPLENBQUMyQyxJQUFJLENBQUMsaUJBQWlCLEVBQUVrRixFQUFFLENBQUMsQ0FBQTtJQUN4QyxJQUFJLENBQUM3SCxPQUFPLENBQUMyQyxJQUFJLENBQUMsWUFBWSxFQUFFa0YsRUFBRSxDQUFDLENBQUE7O0FBRW5DO0FBQ0EsSUFBQSxJQUFJLENBQUNsRixJQUFJLENBQUMsUUFBUSxFQUFFa0YsRUFBRSxDQUFDLENBQUE7O0FBRXZCO0FBQ0EsSUFBQSxJQUFJLENBQUNELFdBQVcsQ0FBQ0MsRUFBRSxDQUFDLENBQUE7QUFHcEIsSUFBQSxJQUFJLENBQUMxTixLQUFLLENBQUN0QixLQUFLLENBQUNxUCxVQUFVLEdBQUdSLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQ3ZOLEtBQUssQ0FBQ3RCLEtBQUssQ0FBQ29QLFdBQVcsQ0FBQTtBQUV0RSxHQUFBO0FBRUFFLEVBQUFBLFVBQVVBLEdBQUc7QUFDVCxJQUFBLElBQUksQ0FBQ3RPLGNBQWMsQ0FBQ3NPLFVBQVUsRUFBRSxDQUFBO0FBQ3BDLEdBQUE7QUFFQUMsRUFBQUEsUUFBUUEsR0FBRztBQUNQLElBQUEsSUFBSSxDQUFDdk8sY0FBYyxDQUFDdU8sUUFBUSxFQUFFLENBQUE7QUFDbEMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxNQUFNQSxHQUFHO0lBRUwsSUFBSSxDQUFDbE8sS0FBSyxDQUFDdEIsS0FBSyxDQUFDeVAsV0FBVyxHQUFHWixHQUFHLEVBQUUsQ0FBQTtBQUdwQyxJQUFBLElBQUksQ0FBQy9FLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQTtBQUN0QixJQUFBLElBQUksQ0FBQzdILElBQUksQ0FBQ3lOLGFBQWEsRUFBRSxDQUFBO0lBRXpCLElBQUksSUFBSSxDQUFDNUosUUFBUSxFQUFFO0FBQ2YsTUFBQSxJQUFJLENBQUNBLFFBQVEsQ0FBQzZKLFNBQVMsRUFBRSxDQUFBO0FBQzdCLEtBQUE7SUFHQW5LLGVBQWUsQ0FBQ29LLGtCQUFrQixHQUFHLENBQUMsQ0FBQTs7QUFHdEM7SUFDQSxJQUFJLENBQUNDLGlCQUFpQixDQUFDLElBQUksQ0FBQy9OLEtBQUssQ0FBQzhDLE1BQU0sQ0FBQyxDQUFBO0FBRXpDLElBQUEsSUFBSSxDQUFDa0YsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFBO0FBR3ZCLElBQUEsSUFBSSxDQUFDeEksS0FBSyxDQUFDdEIsS0FBSyxDQUFDOFAsVUFBVSxHQUFHakIsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDdk4sS0FBSyxDQUFDdEIsS0FBSyxDQUFDeVAsV0FBVyxDQUFBO0FBRXRFLEdBQUE7O0FBRUE7RUFDQUksaUJBQWlCQSxDQUFDRSxnQkFBZ0IsRUFBRTtJQUNoQ0MsYUFBYSxDQUFDQyxlQUFlLEVBQUUsQ0FBQTtJQUMvQixJQUFJLENBQUMxSyxRQUFRLENBQUMySyxlQUFlLENBQUMsSUFBSSxDQUFDekssVUFBVSxFQUFFc0ssZ0JBQWdCLENBQUMsQ0FBQTtJQUNoRSxJQUFJLENBQUN0SyxVQUFVLENBQUMrSixNQUFNLENBQUMsSUFBSSxDQUFDeE8sY0FBYyxDQUFDLENBQUE7QUFDL0MsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJbVAsRUFBQUEsb0JBQW9CQSxDQUFDdEIsR0FBRyxFQUFFRyxFQUFFLEVBQUVvQixFQUFFLEVBQUU7QUFDOUI7QUFDQSxJQUFBLE1BQU05TyxLQUFLLEdBQUcsSUFBSSxDQUFDQSxLQUFLLENBQUN0QixLQUFLLENBQUE7SUFDOUJzQixLQUFLLENBQUMwTixFQUFFLEdBQUdBLEVBQUUsQ0FBQTtJQUNiMU4sS0FBSyxDQUFDOE8sRUFBRSxHQUFHQSxFQUFFLENBQUE7QUFDYixJQUFBLElBQUl2QixHQUFHLEdBQUd2TixLQUFLLENBQUMrTyxrQkFBa0IsRUFBRTtBQUNoQy9PLE1BQUFBLEtBQUssQ0FBQ2dQLEdBQUcsR0FBR2hQLEtBQUssQ0FBQ2lQLFNBQVMsQ0FBQTtNQUMzQmpQLEtBQUssQ0FBQ2lQLFNBQVMsR0FBRyxDQUFDLENBQUE7QUFDbkJqUCxNQUFBQSxLQUFLLENBQUMrTyxrQkFBa0IsR0FBR3hCLEdBQUcsR0FBRyxJQUFJLENBQUE7QUFDekMsS0FBQyxNQUFNO01BQ0h2TixLQUFLLENBQUNpUCxTQUFTLEVBQUUsQ0FBQTtBQUNyQixLQUFBOztBQUVBO0lBQ0EsSUFBSSxDQUFDalAsS0FBSyxDQUFDa1AsU0FBUyxDQUFDdkcsS0FBSyxHQUFHLElBQUksQ0FBQ2pKLGNBQWMsQ0FBQ3lQLGtCQUFrQixDQUFBO0FBQ25FLElBQUEsSUFBSSxDQUFDelAsY0FBYyxDQUFDeVAsa0JBQWtCLEdBQUcsQ0FBQyxDQUFBO0FBQzlDLEdBQUE7O0FBRUE7QUFDQUMsRUFBQUEsZUFBZUEsR0FBRztBQUNkLElBQUEsSUFBSXBQLEtBQUssR0FBRyxJQUFJLENBQUNBLEtBQUssQ0FBQ3RCLEtBQUssQ0FBQTs7QUFFNUI7QUFDQXNCLElBQUFBLEtBQUssQ0FBQ3FQLE9BQU8sR0FBRyxJQUFJLENBQUNwTCxRQUFRLENBQUNxTCxnQkFBZ0IsQ0FBQTtBQUM5Q3RQLElBQUFBLEtBQUssQ0FBQ3VQLFNBQVMsR0FBRyxJQUFJLENBQUN0TCxRQUFRLENBQUN1TCxpQkFBaUIsQ0FBQTtBQUNqRHhQLElBQUFBLEtBQUssQ0FBQ3lQLE9BQU8sR0FBRyxJQUFJLENBQUMvUCxjQUFjLENBQUNnUSx1QkFBdUIsQ0FBQTtBQUMzRDFQLElBQUFBLEtBQUssQ0FBQzJQLGdCQUFnQixHQUFHLElBQUksQ0FBQzFMLFFBQVEsQ0FBQzJMLGlCQUFpQixDQUFBO0FBQ3hENVAsSUFBQUEsS0FBSyxDQUFDNlAsYUFBYSxHQUFHLElBQUksQ0FBQzVMLFFBQVEsQ0FBQzZMLGNBQWMsQ0FBQTtBQUNsRDlQLElBQUFBLEtBQUssQ0FBQytQLFlBQVksR0FBRyxJQUFJLENBQUM5TCxRQUFRLENBQUMrTCxhQUFhLENBQUE7QUFDaERoUSxJQUFBQSxLQUFLLENBQUNpUSxXQUFXLEdBQUcsSUFBSSxDQUFDaE0sUUFBUSxDQUFDaU0sWUFBWSxDQUFBO0FBQzlDLElBQUEsTUFBTUMsS0FBSyxHQUFHLElBQUksQ0FBQ3pRLGNBQWMsQ0FBQzBRLGNBQWMsQ0FBQTtBQUNoRHBRLElBQUFBLEtBQUssQ0FBQ3FRLFNBQVMsR0FBR0YsS0FBSyxDQUFDRyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsR0FDNUNDLElBQUksQ0FBQ0MsR0FBRyxDQUFDTCxLQUFLLENBQUNNLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUMxQ0YsSUFBSSxDQUFDQyxHQUFHLENBQUNMLEtBQUssQ0FBQ08sZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7QUFDNUMxUSxJQUFBQSxLQUFLLENBQUMyUSxRQUFRLEdBQUcsSUFBSSxDQUFDMU0sUUFBUSxDQUFDMk0sU0FBUyxDQUFBO0FBQ3hDNVEsSUFBQUEsS0FBSyxDQUFDNlEsUUFBUSxHQUFHLElBQUksQ0FBQzVNLFFBQVEsQ0FBQzZNLFNBQVMsQ0FBQTtBQUN4QzlRLElBQUFBLEtBQUssQ0FBQytRLFFBQVEsR0FBRyxJQUFJLENBQUM5TSxRQUFRLENBQUMrTSxTQUFTLENBQUE7QUFDeENoUixJQUFBQSxLQUFLLENBQUNpUixTQUFTLEdBQUcsSUFBSSxDQUFDaE4sUUFBUSxDQUFDaU4sVUFBVSxDQUFBO0FBQzFDbFIsSUFBQUEsS0FBSyxDQUFDbVIsYUFBYSxHQUFHLElBQUksQ0FBQ2xOLFFBQVEsQ0FBQ21OLGNBQWMsQ0FBQTtBQUNsRHBSLElBQUFBLEtBQUssQ0FBQ3FSLGlCQUFpQixHQUFHLElBQUksQ0FBQ3BOLFFBQVEsQ0FBQ3FOLGtCQUFrQixDQUFBO0lBQzFEdFIsS0FBSyxDQUFDdVIsZUFBZSxHQUFHLENBQUMsQ0FBQTtBQUN6QixJQUFBLEtBQUssSUFBSTNOLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR3VNLEtBQUssQ0FBQzlTLE1BQU0sRUFBRXVHLENBQUMsRUFBRSxFQUFFO01BQ25DLElBQUlBLENBQUMsR0FBRzBNLG1CQUFtQixFQUFFO0FBQ3pCdFEsUUFBQUEsS0FBSyxDQUFDdVIsZUFBZSxJQUFJcEIsS0FBSyxDQUFDdk0sQ0FBQyxDQUFDLENBQUE7QUFDckMsT0FBQTtBQUNBdU0sTUFBQUEsS0FBSyxDQUFDdk0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ2hCLEtBQUE7QUFDQSxJQUFBLElBQUksQ0FBQ0ssUUFBUSxDQUFDcUwsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLElBQUEsSUFBSSxDQUFDckwsUUFBUSxDQUFDdUwsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0FBQ25DLElBQUEsSUFBSSxDQUFDdkwsUUFBUSxDQUFDMkwsaUJBQWlCLEdBQUcsQ0FBQyxDQUFBO0FBQ25DLElBQUEsSUFBSSxDQUFDbFEsY0FBYyxDQUFDZ1EsdUJBQXVCLEdBQUcsQ0FBQyxDQUFBO0FBQy9DLElBQUEsSUFBSSxDQUFDekwsUUFBUSxDQUFDMk0sU0FBUyxHQUFHLENBQUMsQ0FBQTtBQUMzQixJQUFBLElBQUksQ0FBQzNNLFFBQVEsQ0FBQ3VOLDJCQUEyQixHQUFHLENBQUMsQ0FBQTtBQUM3QyxJQUFBLElBQUksQ0FBQ3ZOLFFBQVEsQ0FBQ3FOLGtCQUFrQixHQUFHLENBQUMsQ0FBQTtBQUNwQyxJQUFBLElBQUksQ0FBQ3JOLFFBQVEsQ0FBQzZNLFNBQVMsR0FBRyxDQUFDLENBQUE7QUFDM0IsSUFBQSxJQUFJLENBQUM3TSxRQUFRLENBQUMrTSxTQUFTLEdBQUcsQ0FBQyxDQUFBO0FBQzNCLElBQUEsSUFBSSxDQUFDL00sUUFBUSxDQUFDaU4sVUFBVSxHQUFHLENBQUMsQ0FBQTtBQUM1QixJQUFBLElBQUksQ0FBQ2pOLFFBQVEsQ0FBQzZMLGNBQWMsR0FBRyxDQUFDLENBQUE7QUFDaEMsSUFBQSxJQUFJLENBQUM3TCxRQUFRLENBQUMrTCxhQUFhLEdBQUcsQ0FBQyxDQUFBO0FBQy9CLElBQUEsSUFBSSxDQUFDL0wsUUFBUSxDQUFDaU0sWUFBWSxHQUFHLENBQUMsQ0FBQTs7QUFFOUI7QUFDQWxRLElBQUFBLEtBQUssR0FBRyxJQUFJLENBQUNBLEtBQUssQ0FBQ2tQLFNBQVMsQ0FBQTtBQUM1QmxQLElBQUFBLEtBQUssQ0FBQ3lSLE9BQU8sR0FBRyxJQUFJLENBQUN4TixRQUFRLENBQUN5TixpQkFBaUIsQ0FBQTtBQUMvQzFSLElBQUFBLEtBQUssQ0FBQzJSLE1BQU0sR0FBRyxJQUFJLENBQUMxTixRQUFRLENBQUMyTixtQkFBbUIsQ0FBQTtJQUNoRDVSLEtBQUssQ0FBQzZSLEtBQUssR0FBRyxDQUFDLENBQUE7QUFDZjdSLElBQUFBLEtBQUssQ0FBQzhSLE1BQU0sR0FBRyxJQUFJLENBQUM3TixRQUFRLENBQUM4TixnQkFBZ0IsQ0FBQTtBQUM3Qy9SLElBQUFBLEtBQUssQ0FBQ2dTLE9BQU8sR0FBRyxJQUFJLENBQUMvTixRQUFRLENBQUNnTyxjQUFjLENBQUE7SUFDNUNqUyxLQUFLLENBQUNrUyxTQUFTLEdBQUcsQ0FBQyxDQUFBO0lBQ25CbFMsS0FBSyxDQUFDbVMsU0FBUyxHQUFHLENBQUMsQ0FBQTtJQUNuQm5TLEtBQUssQ0FBQ29TLG1CQUFtQixHQUFHLENBQUMsQ0FBQTtBQUM3QnBTLElBQUFBLEtBQUssQ0FBQ3FTLElBQUksR0FBR3JTLEtBQUssQ0FBQzJJLEtBQUssSUFBSTNJLEtBQUssQ0FBQ3lSLE9BQU8sR0FBR3pSLEtBQUssQ0FBQzhSLE1BQU0sQ0FBQyxDQUFBO0FBQ3pELElBQUEsSUFBSSxDQUFDN04sUUFBUSxDQUFDcU8sZUFBZSxHQUFHLENBQUMsQ0FBQTtBQUNqQyxJQUFBLElBQUksQ0FBQ3JPLFFBQVEsQ0FBQzhOLGdCQUFnQixHQUFHLENBQUMsQ0FBQTtBQUNsQyxJQUFBLElBQUksQ0FBQzlOLFFBQVEsQ0FBQ3lOLGlCQUFpQixHQUFHLENBQUMsQ0FBQTtBQUNuQyxJQUFBLElBQUksQ0FBQ3pOLFFBQVEsQ0FBQzJOLG1CQUFtQixHQUFHLENBQUMsQ0FBQTtBQUNyQyxJQUFBLElBQUksQ0FBQzNOLFFBQVEsQ0FBQ2dPLGNBQWMsR0FBRyxDQUFDLENBQUE7QUFDaEMsSUFBQSxJQUFJLENBQUNoTyxRQUFRLENBQUNzTyxrQkFBa0IsR0FBRyxDQUFDLENBQUE7QUFDcEMsSUFBQSxJQUFJLENBQUN0TyxRQUFRLENBQUN1TyxtQkFBbUIsR0FBRyxDQUFDLENBQUE7SUFFckMsSUFBSSxDQUFDeFMsS0FBSyxDQUFDcVMsSUFBSSxDQUFDSSx3QkFBd0IsR0FBRyxJQUFJLENBQUMvUyxjQUFjLENBQUMrUyx3QkFBd0IsQ0FBQTtBQUV2RnpTLElBQUFBLEtBQUssR0FBRyxJQUFJLENBQUNBLEtBQUssQ0FBQzBTLFNBQVMsQ0FBQTtBQUM1QjFTLElBQUFBLEtBQUssQ0FBQzJTLGVBQWUsR0FBRzNTLEtBQUssQ0FBQzRTLGdCQUFnQixDQUFBO0FBQzlDNVMsSUFBQUEsS0FBSyxDQUFDNlMsU0FBUyxHQUFHN1MsS0FBSyxDQUFDOFMsVUFBVSxDQUFBO0lBQ2xDOVMsS0FBSyxDQUFDNFMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO0lBQzFCNVMsS0FBSyxDQUFDOFMsVUFBVSxHQUFHLENBQUMsQ0FBQTtBQUN4QixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0loSSxFQUFBQSxpQkFBaUJBLENBQUNpSSxJQUFJLEVBQUV4SSxLQUFLLEVBQUVFLE1BQU0sRUFBRTtJQUNuQyxJQUFJLENBQUN4TCxTQUFTLEdBQUc4VCxJQUFJLENBQUE7QUFDckIsSUFBQSxJQUFJLENBQUNDLFlBQVksQ0FBQ3pJLEtBQUssRUFBRUUsTUFBTSxDQUFDLENBQUE7QUFDcEMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lJLEVBQUFBLG1CQUFtQkEsQ0FBQ2tJLElBQUksRUFBRXhJLEtBQUssRUFBRUUsTUFBTSxFQUFFO0lBQ3JDLElBQUksQ0FBQ3RMLGVBQWUsR0FBRzRULElBQUksQ0FBQTs7QUFFM0I7QUFDQSxJQUFBLElBQUlBLElBQUksS0FBS0UsZUFBZSxJQUFLMUksS0FBSyxLQUFLaEUsU0FBVSxFQUFFO0FBQ25EZ0UsTUFBQUEsS0FBSyxHQUFHLElBQUksQ0FBQzdLLGNBQWMsQ0FBQzlCLE1BQU0sQ0FBQ3NWLFdBQVcsQ0FBQTtBQUM5Q3pJLE1BQUFBLE1BQU0sR0FBRyxJQUFJLENBQUMvSyxjQUFjLENBQUM5QixNQUFNLENBQUN1VixZQUFZLENBQUE7QUFDcEQsS0FBQTtJQUVBLElBQUksQ0FBQ3pULGNBQWMsQ0FBQ3NULFlBQVksQ0FBQ3pJLEtBQUssRUFBRUUsTUFBTSxDQUFDLENBQUE7QUFDbkQsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0kySSxFQUFBQSxRQUFRQSxHQUFHO0FBQ1AsSUFBQSxPQUFPL00sUUFBUSxDQUFDLElBQUksQ0FBQ0csV0FBVyxDQUFDLENBQUE7QUFDckMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lMLEVBQUFBLGtCQUFrQkEsR0FBRztBQUNqQixJQUFBLElBQUksSUFBSSxDQUFDaU4sUUFBUSxFQUFFLEVBQUU7TUFDakIsSUFBSSxJQUFJLENBQUNsVCxhQUFhLEVBQUU7QUFDcEIsUUFBQSxJQUFJLENBQUNBLGFBQWEsQ0FBQ21ULE9BQU8sRUFBRSxDQUFBO0FBQ2hDLE9BQUE7QUFDSixLQUFDLE1BQU07TUFDSCxJQUFJLElBQUksQ0FBQ25ULGFBQWEsRUFBRTtBQUNwQixRQUFBLElBQUksQ0FBQ0EsYUFBYSxDQUFDb1QsTUFBTSxFQUFFLENBQUE7QUFDL0IsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lOLEVBQUFBLFlBQVlBLENBQUN6SSxLQUFLLEVBQUVFLE1BQU0sRUFBRTtJQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDcEwsWUFBWSxFQUFFLE9BQU9rSCxTQUFTLENBQUM7O0FBRXpDO0lBQ0EsSUFBSSxJQUFJLENBQUN2QixFQUFFLElBQUksSUFBSSxDQUFDQSxFQUFFLENBQUN1TyxPQUFPLEVBQzFCLE9BQU9oTixTQUFTLENBQUE7QUFFcEIsSUFBQSxNQUFNaU4sV0FBVyxHQUFHN0ksTUFBTSxDQUFDOEksVUFBVSxDQUFBO0FBQ3JDLElBQUEsTUFBTUMsWUFBWSxHQUFHL0ksTUFBTSxDQUFDZ0osV0FBVyxDQUFBO0FBRXZDLElBQUEsSUFBSSxJQUFJLENBQUMxVSxTQUFTLEtBQUtDLG9CQUFvQixFQUFFO0FBQ3pDLE1BQUEsTUFBTTBVLENBQUMsR0FBRyxJQUFJLENBQUNsVSxjQUFjLENBQUM5QixNQUFNLENBQUMyTSxLQUFLLEdBQUcsSUFBSSxDQUFDN0ssY0FBYyxDQUFDOUIsTUFBTSxDQUFDNk0sTUFBTSxDQUFBO0FBQzlFLE1BQUEsTUFBTW9KLElBQUksR0FBR0wsV0FBVyxHQUFHRSxZQUFZLENBQUE7TUFFdkMsSUFBSUUsQ0FBQyxHQUFHQyxJQUFJLEVBQUU7QUFDVnRKLFFBQUFBLEtBQUssR0FBR2lKLFdBQVcsQ0FBQTtRQUNuQi9JLE1BQU0sR0FBR0YsS0FBSyxHQUFHcUosQ0FBQyxDQUFBO0FBQ3RCLE9BQUMsTUFBTTtBQUNIbkosUUFBQUEsTUFBTSxHQUFHaUosWUFBWSxDQUFBO1FBQ3JCbkosS0FBSyxHQUFHRSxNQUFNLEdBQUdtSixDQUFDLENBQUE7QUFDdEIsT0FBQTtBQUNKLEtBQUMsTUFBTSxJQUFJLElBQUksQ0FBQzNVLFNBQVMsS0FBSzZVLG9CQUFvQixFQUFFO0FBQ2hEdkosTUFBQUEsS0FBSyxHQUFHaUosV0FBVyxDQUFBO0FBQ25CL0ksTUFBQUEsTUFBTSxHQUFHaUosWUFBWSxDQUFBO0FBQ3pCLEtBQUE7QUFDQTs7SUFFQSxJQUFJLENBQUNoVSxjQUFjLENBQUM5QixNQUFNLENBQUNtVyxLQUFLLENBQUN4SixLQUFLLEdBQUdBLEtBQUssR0FBRyxJQUFJLENBQUE7SUFDckQsSUFBSSxDQUFDN0ssY0FBYyxDQUFDOUIsTUFBTSxDQUFDbVcsS0FBSyxDQUFDdEosTUFBTSxHQUFHQSxNQUFNLEdBQUcsSUFBSSxDQUFBO0lBRXZELElBQUksQ0FBQ3VKLGdCQUFnQixFQUFFLENBQUE7O0FBRXZCO0lBQ0EsT0FBTztBQUNIekosTUFBQUEsS0FBSyxFQUFFQSxLQUFLO0FBQ1pFLE1BQUFBLE1BQU0sRUFBRUEsTUFBQUE7S0FDWCxDQUFBO0FBQ0wsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0l1SixFQUFBQSxnQkFBZ0JBLEdBQUc7QUFBQSxJQUFBLElBQUFDLFFBQUEsQ0FBQTtBQUNmO0FBQ0EsSUFBQSxJQUFLLENBQUMsSUFBSSxDQUFDNVUsWUFBWSxLQUFBNFUsUUFBQSxHQUFNLElBQUksQ0FBQ2pQLEVBQUUsS0FBQSxJQUFBLElBQVBpUCxRQUFBLENBQVNDLE1BQU8sRUFBRTtBQUMzQyxNQUFBLE9BQUE7QUFDSixLQUFBOztBQUVBO0FBQ0EsSUFBQSxJQUFJLElBQUksQ0FBQy9VLGVBQWUsS0FBSzhULGVBQWUsRUFBRTtBQUMxQztBQUNBLE1BQUEsTUFBTXJWLE1BQU0sR0FBRyxJQUFJLENBQUM4QixjQUFjLENBQUM5QixNQUFNLENBQUE7QUFDekMsTUFBQSxJQUFJLENBQUM4QixjQUFjLENBQUNzVCxZQUFZLENBQUNwVixNQUFNLENBQUNzVixXQUFXLEVBQUV0VixNQUFNLENBQUN1VixZQUFZLENBQUMsQ0FBQTtBQUM3RSxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJbEgsRUFBQUEsaUJBQWlCQSxHQUFHO0lBQ2hCLElBQUksQ0FBQ2pOLGdCQUFnQixHQUFHLElBQUksQ0FBQTtBQUU1QixJQUFBLElBQUksSUFBSSxDQUFDNkcsT0FBTyxDQUFDc08sU0FBUyxFQUFFO0FBQ3hCLE1BQUEsSUFBSSxDQUFDdE8sT0FBTyxDQUFDc08sU0FBUyxDQUFDQyxlQUFlLEVBQUUsQ0FBQTtBQUM1QyxLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxrQkFBa0JBLENBQUN4SCxRQUFRLEVBQUU7QUFDekIsSUFBQSxJQUFJaEUsS0FBSyxDQUFBO0lBRVQsSUFBSSxJQUFJLENBQUNoRCxPQUFPLENBQUNzTyxTQUFTLElBQUksT0FBT0csSUFBSSxLQUFLLFdBQVcsRUFBRTtBQUN2RCxNQUFBLE1BQU1DLE9BQU8sR0FBRzFILFFBQVEsQ0FBQzJILE9BQU8sQ0FBQ0QsT0FBTyxDQUFBO01BQ3hDLElBQUksQ0FBQzFPLE9BQU8sQ0FBQ3NPLFNBQVMsQ0FBQ0ksT0FBTyxDQUFDMVUsR0FBRyxDQUFDMFUsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFQSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUVBLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQzFFLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQy9ULEtBQUssQ0FBQ2lVLGFBQWEsQ0FBQzVILFFBQVEsQ0FBQyxDQUFBO0lBRWxDLElBQUlBLFFBQVEsQ0FBQ3FCLE1BQU0sQ0FBQ3dHLGNBQWMsQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUMxQyxNQUFBLElBQUk3SCxRQUFRLENBQUNxQixNQUFNLENBQUN5RyxNQUFNLEVBQUU7QUFDeEI5TCxRQUFBQSxLQUFLLEdBQUcsSUFBSSxDQUFDL0gsTUFBTSxDQUFDaUgsR0FBRyxDQUFDOEUsUUFBUSxDQUFDcUIsTUFBTSxDQUFDeUcsTUFBTSxDQUFDLENBQUE7QUFFL0MsUUFBQSxJQUFJOUwsS0FBSyxFQUFFO0FBQ1AsVUFBQSxJQUFJLENBQUMrTCxTQUFTLENBQUMvTCxLQUFLLENBQUMsQ0FBQTtBQUN6QixTQUFDLE1BQU07QUFDSCxVQUFBLElBQUksQ0FBQy9ILE1BQU0sQ0FBQ3dELElBQUksQ0FBQyxNQUFNLEdBQUd1SSxRQUFRLENBQUNxQixNQUFNLENBQUN5RyxNQUFNLEVBQUUsSUFBSSxDQUFDQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDM0UsU0FBQTtBQUNKLE9BQUMsTUFBTTtBQUNILFFBQUEsSUFBSSxDQUFDQSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDeEIsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxnQkFBZ0JBLENBQUNDLE9BQU8sRUFBRUMsT0FBTyxFQUFFO0lBRS9CLElBQUlELE9BQU8sSUFBSUMsT0FBTyxFQUFFO01BQ3BCaFIsYUFBYSxDQUFDbEUsR0FBRyxDQUFDLElBQUksQ0FBQ0gsY0FBYyxFQUFFb1YsT0FBTyxFQUFFQyxPQUFPLENBQUMsQ0FBQTtBQUM1RCxLQUFDLE1BQU07QUFDSGhYLE1BQUFBLEtBQUssQ0FBQ2lYLElBQUksQ0FBQyxxREFBcUQsQ0FBQyxDQUFBO0FBQ3JFLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSUosU0FBU0EsQ0FBQy9MLEtBQUssRUFBRTtBQUNiLElBQUEsSUFBSUEsS0FBSyxLQUFLLElBQUksQ0FBQzFELFlBQVksRUFBRTtNQUM3QixNQUFNOFAsZUFBZSxHQUFHQSxNQUFNO0FBQzFCLFFBQUEsSUFBSSxDQUFDTCxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUE7T0FDdkIsQ0FBQTtNQUVELE1BQU1NLGVBQWUsR0FBR0EsTUFBTTtBQUMxQixRQUFBLElBQUksQ0FBQzFVLEtBQUssQ0FBQ29VLFNBQVMsQ0FBQyxJQUFJLENBQUN6UCxZQUFZLEdBQUcsSUFBSSxDQUFDQSxZQUFZLENBQUNnUSxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUE7T0FDL0UsQ0FBQTs7QUFFRDtNQUNBLElBQUksSUFBSSxDQUFDaFEsWUFBWSxFQUFFO0FBQ25CLFFBQUEsSUFBSSxDQUFDckUsTUFBTSxDQUFDc1UsR0FBRyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUNqUSxZQUFZLENBQUNoSCxFQUFFLEVBQUUrVyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDdEUsUUFBQSxJQUFJLENBQUNwVSxNQUFNLENBQUNzVSxHQUFHLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQ2pRLFlBQVksQ0FBQ2hILEVBQUUsRUFBRThXLGVBQWUsRUFBRSxJQUFJLENBQUMsQ0FBQTtRQUN4RSxJQUFJLENBQUM5UCxZQUFZLENBQUNpUSxHQUFHLENBQUMsUUFBUSxFQUFFRixlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDMUQsT0FBQTs7QUFFQTtNQUNBLElBQUksQ0FBQy9QLFlBQVksR0FBRzBELEtBQUssQ0FBQTtNQUN6QixJQUFJLElBQUksQ0FBQzFELFlBQVksRUFBRTtBQUNuQixRQUFBLElBQUksQ0FBQ3JFLE1BQU0sQ0FBQ3lDLEVBQUUsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDNEIsWUFBWSxDQUFDaEgsRUFBRSxFQUFFK1csZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3JFLFFBQUEsSUFBSSxDQUFDcFUsTUFBTSxDQUFDd0QsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUNhLFlBQVksQ0FBQ2hILEVBQUUsRUFBRThXLGVBQWUsRUFBRSxJQUFJLENBQUMsQ0FBQTtRQUN6RSxJQUFJLENBQUM5UCxZQUFZLENBQUM1QixFQUFFLENBQUMsUUFBUSxFQUFFMlIsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBRXJELFFBQUEsSUFBSSxJQUFJLENBQUMxVSxLQUFLLENBQUM2VSxTQUFTLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDbFEsWUFBWSxDQUFDbVEsU0FBUyxFQUFFO0FBQzVELFVBQUEsSUFBSSxDQUFDblEsWUFBWSxDQUFDbVEsU0FBUyxHQUFHLElBQUksQ0FBQTtBQUN0QyxTQUFBO1FBRUEsSUFBSSxDQUFDeFUsTUFBTSxDQUFDa0ksSUFBSSxDQUFDLElBQUksQ0FBQzdELFlBQVksQ0FBQyxDQUFBO0FBQ3ZDLE9BQUE7QUFFQStQLE1BQUFBLGVBQWUsRUFBRSxDQUFBO0FBQ3JCLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0EzUSxFQUFBQSxVQUFVQSxHQUFHO0FBQUEsSUFBQSxJQUFBZ1IsaUJBQUEsQ0FBQTtBQUNULElBQUEsQ0FBQUEsaUJBQUEsR0FBSSxJQUFBLENBQUNsUixXQUFXLEtBQUEsSUFBQSxHQUFBLEtBQUEsQ0FBQSxHQUFoQmtSLGlCQUFBLENBQWtCQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQ2hWLEtBQUssQ0FBQ2lWLFlBQVksQ0FBQyxDQUFBO0FBQ3pELEdBQUE7O0FBRUE7QUFDQS9RLEVBQUFBLFdBQVdBLEdBQUc7QUFBQSxJQUFBLElBQUFnUixhQUFBLENBQUE7SUFDVixDQUFBQSxhQUFBLE9BQUksQ0FBQ2xPLE9BQU8scUJBQVprTyxhQUFBLENBQWNDLFFBQVEsRUFBRSxDQUFBO0FBQzVCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsaUJBQWlCQSxDQUFDdEksU0FBUyxFQUFFO0FBQ3pCLElBQUEsT0FBT0EsU0FBUyxDQUFBO0FBQ3BCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0l1SSxRQUFRQSxDQUFDMUksS0FBSyxFQUFFMkksR0FBRyxFQUFFQyxLQUFLLEVBQUVDLFNBQVMsRUFBRTNULEtBQUssRUFBRTtBQUMxQyxJQUFBLElBQUksQ0FBQzdCLEtBQUssQ0FBQ3FWLFFBQVEsQ0FBQzFJLEtBQUssRUFBRTJJLEdBQUcsRUFBRUMsS0FBSyxFQUFFQyxTQUFTLEVBQUUzVCxLQUFLLENBQUMsQ0FBQTtBQUM1RCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJNFQsRUFBQUEsU0FBU0EsQ0FBQ0MsU0FBUyxFQUFFQyxNQUFNLEVBQUVILFNBQVMsR0FBRyxJQUFJLEVBQUUzVCxLQUFLLEdBQUcsSUFBSSxDQUFDN0IsS0FBSyxDQUFDNFYsZ0JBQWdCLEVBQUU7QUFDaEYsSUFBQSxJQUFJLENBQUM1VixLQUFLLENBQUN5VixTQUFTLENBQUNDLFNBQVMsRUFBRUMsTUFBTSxFQUFFSCxTQUFTLEVBQUUzVCxLQUFLLENBQUMsQ0FBQTtBQUM3RCxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSWdVLEVBQUFBLGNBQWNBLENBQUNILFNBQVMsRUFBRUMsTUFBTSxFQUFFSCxTQUFTLEdBQUcsSUFBSSxFQUFFM1QsS0FBSyxHQUFHLElBQUksQ0FBQzdCLEtBQUssQ0FBQzRWLGdCQUFnQixFQUFFO0FBQ3JGLElBQUEsSUFBSSxDQUFDNVYsS0FBSyxDQUFDNlYsY0FBYyxDQUFDSCxTQUFTLEVBQUVDLE1BQU0sRUFBRUgsU0FBUyxFQUFFM1QsS0FBSyxDQUFDLENBQUE7QUFDbEUsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lpVSxjQUFjQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRVQsS0FBSyxHQUFHVSxLQUFLLENBQUNDLEtBQUssRUFBRUMsUUFBUSxHQUFHLEVBQUUsRUFBRVgsU0FBUyxHQUFHLElBQUksRUFBRTNULEtBQUssR0FBRyxJQUFJLENBQUM3QixLQUFLLENBQUM0VixnQkFBZ0IsRUFBRTtBQUN0SCxJQUFBLElBQUksQ0FBQzVWLEtBQUssQ0FBQzBSLFNBQVMsQ0FBQ29FLGNBQWMsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUVULEtBQUssRUFBRVksUUFBUSxFQUFFWCxTQUFTLEVBQUUzVCxLQUFLLENBQUMsQ0FBQTtBQUMxRixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0l1VSxrQkFBa0JBLENBQUNDLFFBQVEsRUFBRUMsUUFBUSxFQUFFZixLQUFLLEdBQUdVLEtBQUssQ0FBQ0MsS0FBSyxFQUFFVixTQUFTLEdBQUcsSUFBSSxFQUFFM1QsS0FBSyxHQUFHLElBQUksQ0FBQzdCLEtBQUssQ0FBQzRWLGdCQUFnQixFQUFFO0FBQy9HLElBQUEsSUFBSSxDQUFDNVYsS0FBSyxDQUFDMFIsU0FBUyxDQUFDMEUsa0JBQWtCLENBQUNDLFFBQVEsRUFBRUMsUUFBUSxFQUFFZixLQUFLLEVBQUVDLFNBQVMsRUFBRTNULEtBQUssQ0FBQyxDQUFBO0FBQ3hGLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0kwVSxnQkFBZ0JBLENBQUNDLFlBQVksRUFBRTNVLEtBQUssR0FBRyxJQUFJLENBQUM3QixLQUFLLENBQUM0VixnQkFBZ0IsRUFBRTtBQUNoRSxJQUFBLElBQUksQ0FBQzVWLEtBQUssQ0FBQzBSLFNBQVMsQ0FBQytFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRUQsWUFBWSxFQUFFM1UsS0FBSyxDQUFDLENBQUE7QUFDeEUsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSTRVLEVBQUFBLFFBQVFBLENBQUNDLElBQUksRUFBRWxRLFFBQVEsRUFBRW1RLE1BQU0sRUFBRTlVLEtBQUssR0FBRyxJQUFJLENBQUM3QixLQUFLLENBQUM0VixnQkFBZ0IsRUFBRTtBQUNsRSxJQUFBLElBQUksQ0FBQzVWLEtBQUssQ0FBQzBSLFNBQVMsQ0FBQytFLFFBQVEsQ0FBQ2pRLFFBQVEsRUFBRW1RLE1BQU0sRUFBRUQsSUFBSSxFQUFFLElBQUksRUFBRTdVLEtBQUssQ0FBQyxDQUFBO0FBQ3RFLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJK1UsRUFBQUEsUUFBUUEsQ0FBQ0QsTUFBTSxFQUFFblEsUUFBUSxFQUFFM0UsS0FBSyxHQUFHLElBQUksQ0FBQzdCLEtBQUssQ0FBQzRWLGdCQUFnQixFQUFFO0lBQzVELElBQUksQ0FBQzVWLEtBQUssQ0FBQzBSLFNBQVMsQ0FBQytFLFFBQVEsQ0FBQ2pRLFFBQVEsRUFBRW1RLE1BQU0sRUFBRSxJQUFJLENBQUMzVyxLQUFLLENBQUMwUixTQUFTLENBQUNtRixXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUVoVixLQUFLLENBQUMsQ0FBQTtBQUNwRyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSWlWLFdBQVdBLENBQUNDLENBQUMsRUFBRUMsQ0FBQyxFQUFFak4sS0FBSyxFQUFFRSxNQUFNLEVBQUVnTixPQUFPLEVBQUV6USxRQUFRLEVBQUUzRSxLQUFLLEdBQUcsSUFBSSxDQUFDN0IsS0FBSyxDQUFDNFYsZ0JBQWdCLEVBQUVzQixVQUFVLEdBQUcsSUFBSSxFQUFFO0FBRXhHO0FBQ0E7SUFDQSxJQUFJQSxVQUFVLEtBQUssS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDaFksY0FBYyxDQUFDaVksUUFBUSxFQUNyRCxPQUFBOztBQUVKO0FBQ0EsSUFBQSxNQUFNUixNQUFNLEdBQUcsSUFBSVMsSUFBSSxFQUFFLENBQUE7SUFDekJULE1BQU0sQ0FBQ1UsTUFBTSxDQUFDLElBQUlDLElBQUksQ0FBQ1AsQ0FBQyxFQUFFQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUVPLElBQUksQ0FBQ0MsUUFBUSxFQUFFLElBQUlGLElBQUksQ0FBQ3ZOLEtBQUssRUFBRSxDQUFDRSxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQTtJQUVoRixJQUFJLENBQUN6RCxRQUFRLEVBQUU7QUFDWEEsTUFBQUEsUUFBUSxHQUFHLElBQUlpUixRQUFRLEVBQUUsQ0FBQTtNQUN6QmpSLFFBQVEsQ0FBQ2tSLElBQUksR0FBR0MsYUFBYSxDQUFBO0FBQzdCblIsTUFBQUEsUUFBUSxDQUFDb1IsWUFBWSxDQUFDLFVBQVUsRUFBRVgsT0FBTyxDQUFDLENBQUE7TUFDMUN6USxRQUFRLENBQUNxUixNQUFNLEdBQUdYLFVBQVUsR0FBRyxJQUFJLENBQUNsWCxLQUFLLENBQUMwUixTQUFTLENBQUNvRyxnQkFBZ0IsRUFBRSxHQUFHLElBQUksQ0FBQzlYLEtBQUssQ0FBQzBSLFNBQVMsQ0FBQ3FHLDRCQUE0QixFQUFFLENBQUE7TUFDNUh2UixRQUFRLENBQUM0RyxNQUFNLEVBQUUsQ0FBQTtBQUNyQixLQUFBO0lBRUEsSUFBSSxDQUFDd0osUUFBUSxDQUFDRCxNQUFNLEVBQUVuUSxRQUFRLEVBQUUzRSxLQUFLLENBQUMsQ0FBQTtBQUMxQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJbVcsRUFBQUEsZ0JBQWdCQSxDQUFDakIsQ0FBQyxFQUFFQyxDQUFDLEVBQUVqTixLQUFLLEVBQUVFLE1BQU0sRUFBRXBJLEtBQUssR0FBRyxJQUFJLENBQUM3QixLQUFLLENBQUM0VixnQkFBZ0IsRUFBRTtBQUN2RSxJQUFBLE1BQU1wUCxRQUFRLEdBQUcsSUFBSWlSLFFBQVEsRUFBRSxDQUFBO0lBQy9CalIsUUFBUSxDQUFDa1IsSUFBSSxHQUFHQyxhQUFhLENBQUE7SUFDN0JuUixRQUFRLENBQUNxUixNQUFNLEdBQUcsSUFBSSxDQUFDN1gsS0FBSyxDQUFDMFIsU0FBUyxDQUFDdUcscUJBQXFCLEVBQUUsQ0FBQTtJQUM5RHpSLFFBQVEsQ0FBQzRHLE1BQU0sRUFBRSxDQUFBO0FBRWpCLElBQUEsSUFBSSxDQUFDMEosV0FBVyxDQUFDQyxDQUFDLEVBQUVDLENBQUMsRUFBRWpOLEtBQUssRUFBRUUsTUFBTSxFQUFFLElBQUksRUFBRXpELFFBQVEsRUFBRTNFLEtBQUssQ0FBQyxDQUFBO0FBQ2hFLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJcVcsRUFBQUEsT0FBT0EsR0FBRztBQUFBLElBQUEsSUFBQUMsa0JBQUEsQ0FBQTtJQUNOLElBQUksSUFBSSxDQUFDcmEsY0FBYyxFQUFFO01BQ3JCLElBQUksQ0FBQ0QsaUJBQWlCLEdBQUcsSUFBSSxDQUFBO0FBQzdCLE1BQUEsT0FBQTtBQUNKLEtBQUE7SUFFQSxNQUFNdWEsUUFBUSxHQUFHLElBQUksQ0FBQ2xaLGNBQWMsQ0FBQzlCLE1BQU0sQ0FBQ08sRUFBRSxDQUFBO0FBRTlDLElBQUEsSUFBSSxDQUFDaVgsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUE7QUFFM0IsSUFBQSxJQUFJLE9BQU8vTyxRQUFRLEtBQUssV0FBVyxFQUFFO01BQ2pDQSxRQUFRLENBQUN3UyxtQkFBbUIsQ0FBQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMzUyx3QkFBd0IsRUFBRSxLQUFLLENBQUMsQ0FBQTtNQUN0RkcsUUFBUSxDQUFDd1MsbUJBQW1CLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDM1Msd0JBQXdCLEVBQUUsS0FBSyxDQUFDLENBQUE7TUFDekZHLFFBQVEsQ0FBQ3dTLG1CQUFtQixDQUFDLG9CQUFvQixFQUFFLElBQUksQ0FBQzNTLHdCQUF3QixFQUFFLEtBQUssQ0FBQyxDQUFBO01BQ3hGRyxRQUFRLENBQUN3UyxtQkFBbUIsQ0FBQyx3QkFBd0IsRUFBRSxJQUFJLENBQUMzUyx3QkFBd0IsRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUNoRyxLQUFBO0lBQ0EsSUFBSSxDQUFDQSx3QkFBd0IsR0FBRyxJQUFJLENBQUE7QUFFcEMsSUFBQSxJQUFJLENBQUN2RixJQUFJLENBQUMrWCxPQUFPLEVBQUUsQ0FBQTtJQUNuQixJQUFJLENBQUMvWCxJQUFJLEdBQUcsSUFBSSxDQUFBO0lBRWhCLElBQUksSUFBSSxDQUFDaUUsS0FBSyxFQUFFO0FBQ1osTUFBQSxJQUFJLENBQUNBLEtBQUssQ0FBQ3dRLEdBQUcsRUFBRSxDQUFBO0FBQ2hCLE1BQUEsSUFBSSxDQUFDeFEsS0FBSyxDQUFDa1UsTUFBTSxFQUFFLENBQUE7TUFDbkIsSUFBSSxDQUFDbFUsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUNyQixLQUFBO0lBRUEsSUFBSSxJQUFJLENBQUNELFFBQVEsRUFBRTtBQUNmLE1BQUEsSUFBSSxDQUFDQSxRQUFRLENBQUN5USxHQUFHLEVBQUUsQ0FBQTtBQUNuQixNQUFBLElBQUksQ0FBQ3pRLFFBQVEsQ0FBQ21VLE1BQU0sRUFBRSxDQUFBO01BQ3RCLElBQUksQ0FBQ25VLFFBQVEsR0FBRyxJQUFJLENBQUE7QUFDeEIsS0FBQTtJQUVBLElBQUksSUFBSSxDQUFDRSxLQUFLLEVBQUU7QUFDWixNQUFBLElBQUksQ0FBQ0EsS0FBSyxDQUFDdVEsR0FBRyxFQUFFLENBQUE7QUFDaEIsTUFBQSxJQUFJLENBQUN2USxLQUFLLENBQUNpVSxNQUFNLEVBQUUsQ0FBQTtNQUNuQixJQUFJLENBQUNqVSxLQUFLLEdBQUcsSUFBSSxDQUFBO0FBQ3JCLEtBQUE7SUFFQSxJQUFJLElBQUksQ0FBQ0UsWUFBWSxFQUFFO0FBQ25CLE1BQUEsSUFBSSxDQUFDQSxZQUFZLENBQUMrVCxNQUFNLEVBQUUsQ0FBQTtNQUMxQixJQUFJLENBQUMvVCxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBQzVCLEtBQUE7SUFFQSxJQUFJLElBQUksQ0FBQ0QsUUFBUSxFQUFFO0FBQ2YsTUFBQSxJQUFJLENBQUNBLFFBQVEsQ0FBQzRULE9BQU8sRUFBRSxDQUFBO01BQ3ZCLElBQUksQ0FBQzVULFFBQVEsR0FBRyxJQUFJLENBQUE7QUFDeEIsS0FBQTtJQUVBLElBQUksSUFBSSxDQUFDNkksVUFBVSxFQUFFO01BQ2pCLElBQUksQ0FBQ0EsVUFBVSxHQUFHLElBQUksQ0FBQTtBQUMxQixLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUM5SCxPQUFPLENBQUM2UyxPQUFPLEVBQUUsQ0FBQTs7QUFFdEI7QUFDQSxJQUFBLElBQUksSUFBSSxDQUFDbFksS0FBSyxDQUFDOEMsTUFBTSxFQUFFO0FBQ25CLE1BQUEsSUFBSSxDQUFDOUMsS0FBSyxDQUFDOEMsTUFBTSxDQUFDb1YsT0FBTyxFQUFFLENBQUE7QUFDL0IsS0FBQTs7QUFFQTtJQUNBLE1BQU01WCxNQUFNLEdBQUcsSUFBSSxDQUFDQSxNQUFNLENBQUM0QyxJQUFJLEVBQUUsQ0FBQTtBQUNqQyxJQUFBLEtBQUssSUFBSUUsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHOUMsTUFBTSxDQUFDekQsTUFBTSxFQUFFdUcsQ0FBQyxFQUFFLEVBQUU7QUFDcEM5QyxNQUFBQSxNQUFNLENBQUM4QyxDQUFDLENBQUMsQ0FBQ21WLE1BQU0sRUFBRSxDQUFBO0FBQ2xCalksTUFBQUEsTUFBTSxDQUFDOEMsQ0FBQyxDQUFDLENBQUN3UixHQUFHLEVBQUUsQ0FBQTtBQUNuQixLQUFBO0FBQ0EsSUFBQSxJQUFJLENBQUN0VSxNQUFNLENBQUNzVSxHQUFHLEVBQUUsQ0FBQTs7QUFHakI7QUFDQSxJQUFBLElBQUksQ0FBQ2xVLE9BQU8sQ0FBQ3dYLE9BQU8sRUFBRSxDQUFBO0lBQ3RCLElBQUksQ0FBQ3hYLE9BQU8sR0FBRyxJQUFJLENBQUE7QUFFbkIsSUFBQSxJQUFJLENBQUNPLElBQUksQ0FBQ2lYLE9BQU8sRUFBRSxDQUFBO0lBQ25CLElBQUksQ0FBQ2pYLElBQUksR0FBRyxJQUFJLENBQUE7QUFFaEIsSUFBQSxLQUFLLE1BQU13SixHQUFHLElBQUksSUFBSSxDQUFDN0ssTUFBTSxDQUFDNFksVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDQyxNQUFNLEVBQUU7QUFDdkQsTUFBQSxNQUFNQyxPQUFPLEdBQUcsSUFBSSxDQUFDOVksTUFBTSxDQUFDNFksVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDQyxNQUFNLENBQUNoTyxHQUFHLENBQUMsQ0FBQTtBQUM1RCxNQUFBLE1BQU1rTyxNQUFNLEdBQUdELE9BQU8sQ0FBQ0UsVUFBVSxDQUFBO0FBQ2pDLE1BQUEsSUFBSUQsTUFBTSxFQUFFQSxNQUFNLENBQUNFLFdBQVcsQ0FBQ0gsT0FBTyxDQUFDLENBQUE7QUFDM0MsS0FBQTtJQUNBLElBQUksQ0FBQzlZLE1BQU0sQ0FBQzRZLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQ0MsTUFBTSxHQUFHLEVBQUUsQ0FBQTtBQUU1QyxJQUFBLElBQUksQ0FBQzdZLE1BQU0sQ0FBQ3NZLE9BQU8sRUFBRSxDQUFBO0lBQ3JCLElBQUksQ0FBQ3RZLE1BQU0sR0FBRyxJQUFJLENBQUE7QUFFbEIsSUFBQSxJQUFJLENBQUNJLEtBQUssQ0FBQ2tZLE9BQU8sRUFBRSxDQUFBO0lBQ3BCLElBQUksQ0FBQ2xZLEtBQUssR0FBRyxJQUFJLENBQUE7SUFFakIsSUFBSSxDQUFDcUYsT0FBTyxHQUFHLElBQUksQ0FBQTtJQUNuQixJQUFJLENBQUN2RyxPQUFPLEdBQUcsSUFBSSxDQUFBOztBQUVuQjtBQUNBLElBQUEsSUFBSSxDQUFDaUMsT0FBTyxDQUFDbVgsT0FBTyxFQUFFLENBQUE7SUFDdEIsSUFBSSxDQUFDblgsT0FBTyxHQUFHLElBQUksQ0FBQTtBQUVuQixJQUFBLElBQUksQ0FBQ0ksTUFBTSxDQUFDK1csT0FBTyxFQUFFLENBQUE7SUFDckIsSUFBSSxDQUFDL1csTUFBTSxHQUFHLElBQUksQ0FBQTtJQUVsQixDQUFBZ1gsa0JBQUEsT0FBSSxDQUFDdFUsV0FBVyxxQkFBaEJzVSxrQkFBQSxDQUFrQkQsT0FBTyxFQUFFLENBQUE7SUFDM0IsSUFBSSxDQUFDclUsV0FBVyxHQUFHLElBQUksQ0FBQTtJQUV2QixJQUFJLElBQUksQ0FBQ0csUUFBUSxFQUFFO0FBQ2YsTUFBQSxJQUFJLENBQUNBLFFBQVEsQ0FBQ2tVLE9BQU8sRUFBRSxDQUFBO01BQ3ZCLElBQUksQ0FBQ2xVLFFBQVEsR0FBRyxJQUFJLENBQUE7QUFDeEIsS0FBQTtBQUVBLElBQUEsSUFBSSxDQUFDakUsWUFBWSxHQUFHLEVBQUUsQ0FBQTtBQUV0QixJQUFBLElBQUksQ0FBQzZCLGlCQUFpQixDQUFDa1gsaUJBQWlCLEdBQUcsSUFBSSxDQUFBO0FBQy9DLElBQUEsSUFBSSxDQUFDbFgsaUJBQWlCLENBQUNtWCxrQkFBa0IsR0FBRyxJQUFJLENBQUE7QUFDaEQsSUFBQSxJQUFJLENBQUNuWCxpQkFBaUIsQ0FBQ29YLFNBQVMsR0FBRyxJQUFJLENBQUE7QUFDdkMsSUFBQSxJQUFJLENBQUNwWCxpQkFBaUIsQ0FBQ3FYLFFBQVEsR0FBRyxJQUFJLENBQUE7SUFDdEMsSUFBSSxDQUFDclgsaUJBQWlCLEdBQUcsSUFBSSxDQUFBO0lBQzdCLElBQUksQ0FBQ04saUJBQWlCLEdBQUcsSUFBSSxDQUFBO0FBRTdCLElBQUEsSUFBSSxvQkFBSixJQUFJLENBQUVrRCxFQUFFLENBQUM4USxHQUFHLEVBQUUsQ0FBQTtBQUNkLElBQUEsSUFBSSxvQkFBSixJQUFJLENBQUU5USxFQUFFLENBQUMwVCxPQUFPLEVBQUUsQ0FBQTtBQUVsQixJQUFBLElBQUksQ0FBQ3pVLFFBQVEsQ0FBQ3lVLE9BQU8sRUFBRSxDQUFBO0lBQ3ZCLElBQUksQ0FBQ3pVLFFBQVEsR0FBRyxJQUFJLENBQUE7QUFFcEIsSUFBQSxJQUFJLENBQUN2RSxjQUFjLENBQUNnWixPQUFPLEVBQUUsQ0FBQTtJQUM3QixJQUFJLENBQUNoWixjQUFjLEdBQUcsSUFBSSxDQUFBO0lBRTFCLElBQUksQ0FBQ21ILElBQUksR0FBRyxJQUFJLENBQUE7QUFFaEIsSUFBQSxJQUFJLENBQUN1TyxHQUFHLEVBQUUsQ0FBQzs7SUFFWCxJQUFJLElBQUksQ0FBQ2xWLGFBQWEsRUFBRTtBQUNwQixNQUFBLElBQUksQ0FBQ0EsYUFBYSxDQUFDd1ksT0FBTyxFQUFFLENBQUE7TUFDNUIsSUFBSSxDQUFDeFksYUFBYSxHQUFHLElBQUksQ0FBQTtBQUM3QixLQUFBO0lBRUFwQixNQUFNLENBQUNyQixHQUFHLEdBQUcsSUFBSSxDQUFBO0FBRWpCQyxJQUFBQSxPQUFPLENBQUNRLGFBQWEsQ0FBQzBhLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQTtBQUV0QyxJQUFBLElBQUk3UixjQUFjLEVBQUUsS0FBSyxJQUFJLEVBQUU7TUFDM0IzSSxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDeEIsS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSXNiLGtCQUFrQkEsQ0FBQ0MsSUFBSSxFQUFFO0FBQ3JCLElBQUEsT0FBTyxJQUFJLENBQUNwWixZQUFZLENBQUNvWixJQUFJLENBQUMsQ0FBQTtBQUNsQyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0VBQ0lqWix1QkFBdUJBLENBQUNGLEtBQUssRUFBRTtBQUMzQixJQUFBLElBQUksQ0FBQytDLEVBQUUsQ0FBQyxZQUFZLEVBQUUvQyxLQUFLLENBQUMwUixTQUFTLENBQUMwSCxZQUFZLEVBQUVwWixLQUFLLENBQUMwUixTQUFTLENBQUMsQ0FBQTtBQUN4RSxHQUFBO0FBQ0osQ0FBQTs7QUFFQTtBQXI5RE14VSxPQUFPLENBd2ZGUSxhQUFhLEdBQUcsRUFBRSxDQUFBO0FBODlDN0IsTUFBTTJiLGFBQWEsR0FBRyxFQUFFLENBQUE7O0FBRXhCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU0vUyxRQUFRLEdBQUcsU0FBWEEsUUFBUUEsQ0FBYWdULElBQUksRUFBRTtFQUM3QixNQUFNQyxXQUFXLEdBQUdELElBQUksQ0FBQTtBQUN4QixFQUFBLElBQUlFLFlBQVksQ0FBQTtBQUNoQjtBQUNKO0FBQ0E7QUFDQTtBQUNJLEVBQUEsT0FBTyxVQUFVMU0sU0FBUyxFQUFFNU8sS0FBSyxFQUFFO0FBQUEsSUFBQSxJQUFBdWIsZUFBQSxDQUFBO0FBQy9CLElBQUEsSUFBSSxDQUFDRixXQUFXLENBQUNyYSxjQUFjLEVBQzNCLE9BQUE7SUFFSnRCLGNBQWMsQ0FBQzJiLFdBQVcsQ0FBQyxDQUFBO0FBRTNCLElBQUEsSUFBSUMsWUFBWSxFQUFFO0FBQ2RyUCxNQUFBQSxNQUFNLENBQUN1UCxvQkFBb0IsQ0FBQ0YsWUFBWSxDQUFDLENBQUE7QUFDekNBLE1BQUFBLFlBQVksR0FBRyxJQUFJLENBQUE7QUFDdkIsS0FBQTs7QUFFQTtBQUNBdmMsSUFBQUEsR0FBRyxHQUFHc2MsV0FBVyxDQUFBO0lBRWpCLE1BQU1JLFdBQVcsR0FBR0osV0FBVyxDQUFDbkUsaUJBQWlCLENBQUN0SSxTQUFTLENBQUMsSUFBSUMsR0FBRyxFQUFFLENBQUE7SUFDckUsTUFBTXVCLEVBQUUsR0FBR3FMLFdBQVcsSUFBSUosV0FBVyxDQUFDeGIsS0FBSyxJQUFJNGIsV0FBVyxDQUFDLENBQUE7QUFDM0QsSUFBQSxJQUFJek0sRUFBRSxHQUFHb0IsRUFBRSxHQUFHLE1BQU0sQ0FBQTtBQUNwQnBCLElBQUFBLEVBQUUsR0FBRzBNLElBQUksQ0FBQ0MsS0FBSyxDQUFDM00sRUFBRSxFQUFFLENBQUMsRUFBRXFNLFdBQVcsQ0FBQ3RiLFlBQVksQ0FBQyxDQUFBO0lBQ2hEaVAsRUFBRSxJQUFJcU0sV0FBVyxDQUFDdmIsU0FBUyxDQUFBO0lBRTNCdWIsV0FBVyxDQUFDeGIsS0FBSyxHQUFHNGIsV0FBVyxDQUFBOztBQUUvQjtJQUNBLElBQUFGLENBQUFBLGVBQUEsR0FBSUYsV0FBVyxDQUFDL1UsRUFBRSxLQUFkaVYsSUFBQUEsSUFBQUEsZUFBQSxDQUFnQjFHLE9BQU8sRUFBRTtBQUN6QnlHLE1BQUFBLFlBQVksR0FBR0QsV0FBVyxDQUFDL1UsRUFBRSxDQUFDdU8sT0FBTyxDQUFDK0cscUJBQXFCLENBQUNQLFdBQVcsQ0FBQ2xULElBQUksQ0FBQyxDQUFBO0FBQ2pGLEtBQUMsTUFBTTtBQUNIbVQsTUFBQUEsWUFBWSxHQUFHTyxRQUFRLENBQUNDLE9BQU8sR0FBRzdQLE1BQU0sQ0FBQzJQLHFCQUFxQixDQUFDUCxXQUFXLENBQUNsVCxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUE7QUFDM0YsS0FBQTtBQUVBLElBQUEsSUFBSWtULFdBQVcsQ0FBQ3JhLGNBQWMsQ0FBQythLFdBQVcsRUFDdEMsT0FBQTtJQUVKVixXQUFXLENBQUNsTCxvQkFBb0IsQ0FBQ3NMLFdBQVcsRUFBRXpNLEVBQUUsRUFBRW9CLEVBQUUsQ0FBQyxDQUFBO0lBR3JEaUwsV0FBVyxDQUFDM0ssZUFBZSxFQUFFLENBQUE7SUFHN0IySyxXQUFXLENBQUN6YixjQUFjLEdBQUcsSUFBSSxDQUFBO0FBQ2pDeWIsSUFBQUEsV0FBVyxDQUFDdlIsSUFBSSxDQUFDLGFBQWEsRUFBRXNHLEVBQUUsQ0FBQyxDQUFBO0lBRW5DLElBQUk0TCxpQkFBaUIsR0FBRyxJQUFJLENBQUE7QUFFNUIsSUFBQSxJQUFJaGMsS0FBSyxFQUFFO0FBQUEsTUFBQSxJQUFBaWMsZ0JBQUEsQ0FBQTtBQUNQRCxNQUFBQSxpQkFBaUIsR0FBQUMsQ0FBQUEsZ0JBQUEsR0FBR1osV0FBVyxDQUFDL1UsRUFBRSxLQUFkMlYsSUFBQUEsR0FBQUEsS0FBQUEsQ0FBQUEsR0FBQUEsZ0JBQUEsQ0FBZ0IvTSxNQUFNLENBQUNsUCxLQUFLLENBQUMsQ0FBQTtBQUNqRHFiLE1BQUFBLFdBQVcsQ0FBQ3JhLGNBQWMsQ0FBQ2tiLGtCQUFrQixHQUFHbGMsS0FBSyxDQUFDNlUsT0FBTyxDQUFDc0gsV0FBVyxDQUFDQyxTQUFTLENBQUNDLFdBQVcsQ0FBQTtBQUNuRyxLQUFDLE1BQU07QUFDSGhCLE1BQUFBLFdBQVcsQ0FBQ3JhLGNBQWMsQ0FBQ2tiLGtCQUFrQixHQUFHLElBQUksQ0FBQTtBQUN4RCxLQUFBO0FBRUEsSUFBQSxJQUFJRixpQkFBaUIsRUFBRTtNQUVuQjNjLEtBQUssQ0FBQ2lkLEtBQUssQ0FBQ0Msb0JBQW9CLEVBQUcsY0FBYWxCLFdBQVcsQ0FBQ3JiLEtBQU0sQ0FBQSxDQUFDLENBQUMsQ0FBQTtBQUNwRVgsTUFBQUEsS0FBSyxDQUFDaWQsS0FBSyxDQUFDRSx5QkFBeUIsRUFBRyxDQUFpQjNOLGVBQUFBLEVBQUFBLEdBQUcsRUFBRSxDQUFDNE4sT0FBTyxDQUFDLENBQUMsQ0FBRSxJQUFHLENBQUMsQ0FBQTtBQUU5RXBCLE1BQUFBLFdBQVcsQ0FBQ25NLE1BQU0sQ0FBQ0YsRUFBRSxDQUFDLENBQUE7QUFFdEJxTSxNQUFBQSxXQUFXLENBQUN2UixJQUFJLENBQUMsYUFBYSxDQUFDLENBQUE7QUFHL0IsTUFBQSxJQUFJdVIsV0FBVyxDQUFDcGIsVUFBVSxJQUFJb2IsV0FBVyxDQUFDbmIsZUFBZSxFQUFFO0FBRXZEYixRQUFBQSxLQUFLLENBQUNpZCxLQUFLLENBQUNFLHlCQUF5QixFQUFHLENBQWlCM04sZUFBQUEsRUFBQUEsR0FBRyxFQUFFLENBQUM0TixPQUFPLENBQUMsQ0FBQyxDQUFFLElBQUcsQ0FBQyxDQUFBO1FBRTlFcEIsV0FBVyxDQUFDL0YsZ0JBQWdCLEVBQUUsQ0FBQTtRQUM5QitGLFdBQVcsQ0FBQy9MLFVBQVUsRUFBRSxDQUFBO1FBQ3hCK0wsV0FBVyxDQUFDN0wsTUFBTSxFQUFFLENBQUE7UUFDcEI2TCxXQUFXLENBQUM5TCxRQUFRLEVBQUUsQ0FBQTtRQUN0QjhMLFdBQVcsQ0FBQ25iLGVBQWUsR0FBRyxLQUFLLENBQUE7QUFFbkNiLFFBQUFBLEtBQUssQ0FBQ2lkLEtBQUssQ0FBQ0UseUJBQXlCLEVBQUcsQ0FBZTNOLGFBQUFBLEVBQUFBLEdBQUcsRUFBRSxDQUFDNE4sT0FBTyxDQUFDLENBQUMsQ0FBRSxJQUFHLENBQUMsQ0FBQTtBQUNoRixPQUFBOztBQUVBO0FBQ0F0QixNQUFBQSxhQUFhLENBQUN2TSxTQUFTLEdBQUdDLEdBQUcsRUFBRSxDQUFBO01BQy9Cc00sYUFBYSxDQUFDck0sTUFBTSxHQUFHdU0sV0FBVyxDQUFBO0FBRWxDQSxNQUFBQSxXQUFXLENBQUN2UixJQUFJLENBQUMsVUFBVSxFQUFFcVIsYUFBYSxDQUFDLENBQUE7QUFDL0MsS0FBQTtJQUVBRSxXQUFXLENBQUN6YixjQUFjLEdBQUcsS0FBSyxDQUFBO0lBRWxDLElBQUl5YixXQUFXLENBQUMxYixpQkFBaUIsRUFBRTtNQUMvQjBiLFdBQVcsQ0FBQ3JCLE9BQU8sRUFBRSxDQUFBO0FBQ3pCLEtBQUE7R0FDSCxDQUFBO0FBQ0wsQ0FBQzs7OzsifQ==
