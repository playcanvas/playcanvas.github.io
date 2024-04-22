/**
 * AppOptions is an object that holds configuration settings utilized in the creation of AppBase. It
 * allows functionality to be included or excluded from the AppBase instance.
 */
class AppOptions {
  constructor() {
    /**
     * Input handler for {@link ElementComponent}s.
     *
     * @type {import('./input/element-input.js').ElementInput}
     */
    this.elementInput = void 0;
    /**
     * Keyboard handler for input.
     *
     * @type {import('../platform/input/keyboard.js').Keyboard}
     */
    this.keyboard = void 0;
    /**
     * Mouse handler for input.
     *
     * @type {import('../platform/input/mouse.js').Mouse}
     */
    this.mouse = void 0;
    /**
     * TouchDevice handler for input.
     *
     * @type {import('../platform/input/touch-device.js').TouchDevice}
     */
    this.touch = void 0;
    /**
     * Gamepad handler for input.
     *
     * @type {import('../platform/input/game-pads.js').GamePads}
     */
    this.gamepads = void 0;
    /**
     * Prefix to apply to script urls before loading.
     *
     * @type {string}
     */
    this.scriptPrefix = void 0;
    /**
     * Prefix to apply to asset urls before loading.
     *
     * @type {string}
     */
    this.assetPrefix = void 0;
    /**
     * Scripts in order of loading first.
     *
     * @type {string[]}
     */
    this.scriptsOrder = void 0;
    /**
     * The sound manager
     *
     * @type {import('../platform/sound/manager.js').SoundManager}
     */
    this.soundManager = void 0;
    /**
     * The graphics device.
     *
     * @type {import('../platform/graphics/graphics-device.js').GraphicsDevice}
     */
    this.graphicsDevice = void 0;
    /**
     * The lightmapper.
     *
     * @type {typeof import('./lightmapper/lightmapper.js').Lightmapper}
     */
    this.lightmapper = void 0;
    /**
     * The BatchManager.
     *
     * @type {typeof import('../scene/batching/batch-manager.js').BatchManager}
     */
    this.batchManager = void 0;
    /**
     * The XrManager.
     *
     * @type {typeof import('./xr/xr-manager.js').XrManager}
     */
    this.xr = void 0;
    /**
     * The component systems the app requires.
     *
     * @type {typeof import('./components/system.js').ComponentSystem[]}
     */
    this.componentSystems = [];
    /**
     * The resource handlers the app requires.
     *
     * @type {typeof import('./handlers/handler.js').ResourceHandler[]}
     */
    this.resourceHandlers = [];
  }
}

export { AppOptions };
