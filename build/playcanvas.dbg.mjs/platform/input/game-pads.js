import { EventHandler } from '../../core/event-handler.js';
import { EVENT_GAMEPADCONNECTED, EVENT_GAMEPADDISCONNECTED, PAD_FACE_1, PAD_FACE_2, PAD_FACE_3, PAD_FACE_4, PAD_L_SHOULDER_1, PAD_R_SHOULDER_1, PAD_L_SHOULDER_2, PAD_R_SHOULDER_2, PAD_SELECT, PAD_START, PAD_L_STICK_BUTTON, PAD_R_STICK_BUTTON, PAD_UP, PAD_DOWN, PAD_LEFT, PAD_RIGHT, PAD_VENDOR, XRPAD_TRIGGER, XRPAD_SQUEEZE, XRPAD_TOUCHPAD_BUTTON, XRPAD_STICK_BUTTON, XRPAD_A, XRPAD_B, PAD_L_STICK_X, PAD_L_STICK_Y, PAD_R_STICK_X, PAD_R_STICK_Y, XRPAD_TOUCHPAD_X, XRPAD_TOUCHPAD_Y, XRPAD_STICK_X, XRPAD_STICK_Y } from './constants.js';
import { math } from '../../core/math/math.js';
import { platform } from '../../core/platform.js';

const dummyArray = Object.freeze([]);

/**
 * Get Gamepads from API.
 *
 * @type {Function}
 * @returns {Gamepad[]} Retrieved gamepads from the device.
 * @ignore
 */
let _getGamepads = function getGamepads() {
  return dummyArray;
};
if (typeof navigator !== 'undefined') {
  _getGamepads = (navigator.getGamepads || navigator.webkitGetGamepads || _getGamepads).bind(navigator);
}
const MAPS_INDEXES = {
  buttons: {
    PAD_FACE_1,
    PAD_FACE_2,
    PAD_FACE_3,
    PAD_FACE_4,
    PAD_L_SHOULDER_1,
    PAD_R_SHOULDER_1,
    PAD_L_SHOULDER_2,
    PAD_R_SHOULDER_2,
    PAD_SELECT,
    PAD_START,
    PAD_L_STICK_BUTTON,
    PAD_R_STICK_BUTTON,
    PAD_UP,
    PAD_DOWN,
    PAD_LEFT,
    PAD_RIGHT,
    PAD_VENDOR,
    XRPAD_TRIGGER,
    XRPAD_SQUEEZE,
    XRPAD_TOUCHPAD_BUTTON,
    XRPAD_STICK_BUTTON,
    XRPAD_A,
    XRPAD_B
  },
  axes: {
    PAD_L_STICK_X,
    PAD_L_STICK_Y,
    PAD_R_STICK_X,
    PAD_R_STICK_Y,
    XRPAD_TOUCHPAD_X,
    XRPAD_TOUCHPAD_Y,
    XRPAD_STICK_X,
    XRPAD_STICK_Y
  }
};
const MAPS = {
  DEFAULT: {
    buttons: [
    // Face buttons
    'PAD_FACE_1', 'PAD_FACE_2', 'PAD_FACE_3', 'PAD_FACE_4',
    // Shoulder buttons
    'PAD_L_SHOULDER_1', 'PAD_R_SHOULDER_1', 'PAD_L_SHOULDER_2', 'PAD_R_SHOULDER_2',
    // Other buttons
    'PAD_SELECT', 'PAD_START', 'PAD_L_STICK_BUTTON', 'PAD_R_STICK_BUTTON',
    // D Pad
    'PAD_UP', 'PAD_DOWN', 'PAD_LEFT', 'PAD_RIGHT',
    // Vendor specific button
    'PAD_VENDOR'],
    axes: [
    // Analog Sticks
    'PAD_L_STICK_X', 'PAD_L_STICK_Y', 'PAD_R_STICK_X', 'PAD_R_STICK_Y']
  },
  DEFAULT_DUAL: {
    buttons: [
    // Face buttons
    'PAD_FACE_1', 'PAD_FACE_2', 'PAD_FACE_3', 'PAD_FACE_4',
    // Shoulder buttons
    'PAD_L_SHOULDER_1', 'PAD_R_SHOULDER_1', 'PAD_L_SHOULDER_2', 'PAD_R_SHOULDER_2',
    // Other buttons
    'PAD_SELECT', 'PAD_START', 'PAD_L_STICK_BUTTON', 'PAD_R_STICK_BUTTON',
    // Vendor specific button
    'PAD_VENDOR'],
    axes: [
    // Analog Sticks
    'PAD_L_STICK_X', 'PAD_L_STICK_Y', 'PAD_R_STICK_X', 'PAD_R_STICK_Y'],
    synthesizedButtons: {
      PAD_UP: {
        axis: 0,
        min: 0,
        max: 1
      },
      PAD_DOWN: {
        axis: 0,
        min: -1,
        max: 0
      },
      PAD_LEFT: {
        axis: 0,
        min: -1,
        max: 0
      },
      PAD_RIGHT: {
        axis: 0,
        min: 0,
        max: 1
      }
    }
  },
  PS3: {
    buttons: [
    // X, O, TRI, SQ
    'PAD_FACE_1', 'PAD_FACE_2', 'PAD_FACE_4', 'PAD_FACE_3',
    // Shoulder buttons
    'PAD_L_SHOULDER_1', 'PAD_R_SHOULDER_1', 'PAD_L_SHOULDER_2', 'PAD_R_SHOULDER_2',
    // Other buttons
    'PAD_SELECT', 'PAD_START', 'PAD_L_STICK_BUTTON', 'PAD_R_STICK_BUTTON',
    // D Pad
    'PAD_UP', 'PAD_DOWN', 'PAD_LEFT', 'PAD_RIGHT', 'PAD_VENDOR'],
    axes: [
    // Analog Sticks
    'PAD_L_STICK_X', 'PAD_L_STICK_Y', 'PAD_R_STICK_X', 'PAD_R_STICK_Y'],
    mapping: 'standard'
  },
  DEFAULT_XR: {
    buttons: [
    // Back buttons
    'XRPAD_TRIGGER', 'XRPAD_SQUEEZE',
    // Axes buttons
    'XRPAD_TOUCHPAD_BUTTON', 'XRPAD_STICK_BUTTON',
    // Face buttons
    'XRPAD_A', 'XRPAD_B'],
    axes: [
    // Analog Sticks
    'XRPAD_TOUCHPAD_X', 'XRPAD_TOUCHPAD_Y', 'XRPAD_STICK_X', 'XRPAD_STICK_Y'],
    mapping: 'xr-standard'
  }
};
const PRODUCT_CODES = {
  'Product: 0268': 'PS3'
};
const custom_maps = {};

/**
 * Retrieve the order for buttons and axes for given HTML5 Gamepad.
 *
 * @param {Gamepad} pad - The HTML5 Gamepad object.
 * @returns {object} Object defining the order of buttons and axes for given HTML5 Gamepad.
 * @ignore
 */
function getMap(pad) {
  const custom = custom_maps[pad.id];
  if (custom) {
    return custom;
  }
  for (const code in PRODUCT_CODES) {
    if (pad.id.indexOf(code) !== -1) {
      const product = PRODUCT_CODES[code];
      if (!pad.mapping) {
        const raw = MAPS['RAW_' + product];
        if (raw) {
          return raw;
        }
      }
      return MAPS[product];
    }
  }
  if (pad.mapping === 'xr-standard') {
    return MAPS.DEFAULT_XR;
  }
  const defaultmap = MAPS.DEFAULT;
  const map = pad.buttons.length < defaultmap.buttons.length ? MAPS.DEFAULT_DUAL : defaultmap;
  map.mapping = pad.mapping;
  return map;
}
let deadZone = 0.25;

/**
 * @param {number} ms - Number of milliseconds to sleep for.
 * @returns {Promise<void>}
 * @ignore
 */
function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * A GamePadButton stores information about a button from the Gamepad API.
 */
class GamePadButton {
  /**
   * Create a new GamePadButton instance.
   *
   * @param {number|GamepadButton} current - The original Gamepad API gamepad button.
   * @param {number|GamepadButton} [previous] - The previous Gamepad API gamepad button.
   * @hideconstructor
   */
  constructor(current, previous) {
    /**
     * The value for the button between 0 and 1, with 0 representing a button that is not pressed, and 1 representing a button that is fully pressed.
     *
     * @type {number}
     */
    this.value = 0;
    /**
     * Whether the button is currently down.
     *
     * @type {boolean}
     */
    this.pressed = false;
    /**
     * Whether the button is currently touched.
     *
     * @type {boolean}
     */
    this.touched = false;
    /**
     * Whether the button was pressed.
     *
     * @type {boolean}
     */
    this.wasPressed = false;
    /**
     * Whether the button was released since the last update.
     *
     * @type {boolean}
     */
    this.wasReleased = false;
    /**
     * Whether the button was touched since the last update.
     *
     * @type {boolean}
     */
    this.wasTouched = false;
    if (typeof current === 'number') {
      this.value = current;
      this.pressed = current === 1;
      this.touched = current > 0;
    } else {
      var _current$touched;
      this.value = current.value;
      this.pressed = current.pressed;
      this.touched = (_current$touched = current.touched) != null ? _current$touched : current.value > 0;
    }
    if (previous) {
      if (typeof previous === 'number') {
        this.wasPressed = previous !== 1 && this.pressed;
        this.wasReleased = previous === 1 && !this.pressed;
        this.wasTouched = previous === 0 && this.touched;
      } else {
        var _previous$touched;
        this.wasPressed = !previous.pressed && this.pressed;
        this.wasReleased = previous.pressed && !this.pressed;
        this.wasTouched = !((_previous$touched = previous.touched) != null ? _previous$touched : previous.value > 0) && this.touched;
      }
    }
  }

  /**
   * Update the existing GamePadButton Instance.
   *
   * @param {GamepadButton} button - The original Gamepad API gamepad button.
   * @ignore
   */
  update(button) {
    var _button$touched;
    const {
      value,
      pressed
    } = button;
    const touched = (_button$touched = button.touched) != null ? _button$touched : value > 0;
    this.wasPressed = !this.pressed && pressed;
    this.wasReleased = this.pressed && !pressed;
    this.wasTouched = !this.touched && touched;
    this.value = value;
    this.pressed = pressed;
    this.touched = touched;
  }
}
const dummyButton = Object.freeze(new GamePadButton(0));

/**
 * A GamePad stores information about a gamepad from the Gamepad API.
 */
class GamePad {
  /**
   * Create a new GamePad Instance.
   *
   * @param {Gamepad} gamepad - The original Gamepad API gamepad.
   * @param {object} map - The buttons and axes map.
   * @hideconstructor
   */
  constructor(gamepad, map) {
    /**
     * The compiled mapping to reduce lookup delay when retrieving buttons
     *
     * @type {object}
     * @private
     */
    this._compiledMapping = {
      buttons: [],
      axes: []
    };
    /**
     * The identifier for the gamepad. Its structure depends on device.
     *
     * @type {string}
     */
    this.id = gamepad.id;

    /**
     * The index for this controller. A gamepad that is disconnected and reconnected will retain the same index.
     *
     * @type {number}
     */
    this.index = gamepad.index;

    /**
     * The buttons present on the GamePad. Order is provided by API, use GamePad#buttons instead.
     *
     * @type {GamePadButton[]}
     * @ignore
     */
    this._buttons = gamepad.buttons.map(b => new GamePadButton(b));

    /**
     * The axes values from the GamePad. Order is provided by API, use GamePad#axes instead.
     *
     * @type {number[]}
     * @ignore
     */
    this._axes = [...gamepad.axes];

    /**
     * Previous value for the analog axes present on the gamepad. Values are between -1 and 1.
     *
     * @type {number[]}
     * @ignore
     */
    this._previousAxes = [...gamepad.axes];

    /**
     * The gamepad mapping detected by the browser. Value is either "standard", "xr-standard", "" or "custom". When empty string, you may need to update the mapping yourself. "custom" means you updated the mapping.
     *
     * @type {string}
     */
    this.mapping = map.mapping;

    /**
     * The buttons and axes map.
     *
     * @type {object}
     */
    this.map = map;

    /**
     * The hand this gamepad is usually handled on. Only relevant for XR pads. Value is either "left", "right" or "none".
     *
     * @type {string}
     */
    this.hand = gamepad.hand || 'none';

    /**
     * The original Gamepad API gamepad.
     *
     * @type {Gamepad}
     * @ignore
     */
    this.pad = gamepad;
    this._compileMapping();
  }

  /**
   * Whether the gamepad is connected.
   *
   * @type {boolean}
   */
  get connected() {
    return this.pad.connected;
  }

  /**
   * Compile the buttons mapping to reduce lookup delay.
   *
   * @private
   */
  _compileMapping() {
    const {
      axes,
      buttons
    } = this._compiledMapping;
    const axesIndexes = MAPS_INDEXES.axes;
    const buttonsIndexes = MAPS_INDEXES.buttons;

    // Clear existing
    axes.length = 0;
    buttons.length = 0;

    // Add axes
    const axesMap = this.map.axes;
    if (axesMap) {
      this.map.axes.forEach((axis, i) => {
        axes[axesIndexes[axis]] = () => this.pad.axes[i] || 0;
      });
    }

    // Fill empty indexes for axes
    for (let i = 0, l = axes.length; i < l; i++) {
      if (!axes[i]) {
        axes[i] = () => 0;
      }
    }

    // Add basic buttons
    const buttonsMap = this.map.buttons;
    if (buttonsMap) {
      buttonsMap.forEach((button, i) => {
        buttons[buttonsIndexes[button]] = () => this._buttons[i] || dummyButton;
      });
    }

    // Add synthesized buttons
    const synthesizedButtonsMap = this.map.synthesizedButtons;
    if (synthesizedButtonsMap) {
      Object.entries(synthesizedButtonsMap).forEach(button => {
        const {
          axis,
          max,
          min
        } = button[1];
        buttons[buttonsIndexes[button[0]]] = () => {
          var _this$_axes$axis, _this$_previousAxes$a;
          return new GamePadButton(Math.abs(math.clamp((_this$_axes$axis = this._axes[axis]) != null ? _this$_axes$axis : 0, min, max)), Math.abs(math.clamp((_this$_previousAxes$a = this._previousAxes[axis]) != null ? _this$_previousAxes$a : 0, min, max)));
        };
      });
    }

    // Fill empty indexes for buttons
    for (let i = 0, l = buttons.length; i < l; i++) {
      if (!buttons[i]) {
        buttons[i] = () => dummyButton;
      }
    }
  }

  /**
   * Update the existing GamePad Instance.
   *
   * @param {Gamepad} gamepad - The original Gamepad API gamepad.
   * @ignore
   */
  update(gamepad) {
    this.pad = gamepad;
    const previousAxes = this._previousAxes;
    const axes = this._axes;

    // Store previous values for axes for dual buttons.
    previousAxes.length = 0;
    previousAxes.push(...axes);

    // Update axes
    axes.length = 0;
    axes.push(...gamepad.axes);

    // Update buttons
    const buttons = this._buttons;
    for (let i = 0, l = buttons.length; i < l; i++) {
      buttons[i].update(gamepad.buttons[i]);
    }
    return this;
  }

  /**
   * Update the map for this gamepad.
   *
   * @param {object} map - The new mapping for this gamepad.
   * @param {string[]} map.buttons - Buttons mapping for this gamepad.
   * @param {string[]} map.axes - Axes mapping for this gamepad.
   * @param {object} [map.synthesizedButtons] - Information about buttons to pull from axes for this gamepad. Requires definition of axis index, min value and max value.
   * @param {"custom"} [map.mapping] - New mapping format. Will be forced into "custom".
   * @example
   * this.pad.updateMap({
   *     buttons: [[
   *         'PAD_FACE_1',
   *         'PAD_FACE_2',
   *         'PAD_FACE_3',
   *         'PAD_FACE_4',
   *         'PAD_L_SHOULDER_1',
   *         'PAD_R_SHOULDER_1',
   *         'PAD_L_SHOULDER_2',
   *         'PAD_R_SHOULDER_2',
   *         'PAD_SELECT',
   *         'PAD_START',
   *         'PAD_L_STICK_BUTTON',
   *         'PAD_R_STICK_BUTTON',
   *         'PAD_VENDOR'
   *     ],
   *     axes: [
   *         'PAD_L_STICK_X',
   *         'PAD_L_STICK_Y',
   *         'PAD_R_STICK_X',
   *         'PAD_R_STICK_Y'
   *     ],
   *     synthesizedButtons: {
   *         PAD_UP: { axis: 0, min: 0, max: 1 },
   *         PAD_DOWN: { axis: 0, min: -1, max: 0 },
   *         PAD_LEFT: { axis: 0, min: -1, max: 0 },
   *         PAD_RIGHT: { axis: 0, min: 0, max: 1 }
   *     }
   * });
   */
  updateMap(map) {
    map.mapping = 'custom';

    // Save the map in case of disconnection.
    custom_maps[this.id] = map;
    this.map = map;
    this.mapping = 'custom';
    this._compileMapping();
  }

  /**
   * Reset gamepad mapping to default.
   */
  resetMap() {
    if (custom_maps[this.id]) {
      delete custom_maps[this.id];
      const map = getMap(this.pad);
      this.map = map;
      this.mapping = map.mapping;
      this._compileMapping();
    }
  }

  /**
   * The values from analog axes present on the GamePad. Values are between -1 and 1.
   *
   * @type {number[]}
   */
  get axes() {
    return this._compiledMapping.axes.map(a => a());
  }

  /**
   * The buttons present on the GamePad.
   *
   * @type {GamePadButton[]}
   */
  get buttons() {
    return this._compiledMapping.buttons.map(b => b());
  }

  /**
   * Make the gamepad vibrate.
   *
   * @param {number} intensity - Intensity for the vibration in the range 0 to 1.
   * @param {number} duration - Duration for the vibration in milliseconds.
   * @param {object} [options] - Options for special vibration pattern.
   * @param {number} [options.startDelay] - Delay before the pattern starts, in milliseconds. Defaults to 0.
   * @param {number} [options.strongMagnitude] - Intensity for strong actuators in the range 0 to 1. Defaults to intensity.
   * @param {number} [options.weakMagnitude] - Intensity for weak actuators in the range 0 to 1. Defaults to intensity.
   * @returns {Promise<boolean>} Return a Promise resulting in true if the pulse was successfully completed.
   */
  async pulse(intensity, duration, options) {
    const actuators = this.pad.vibrationActuator ? [this.pad.vibrationActuator] : this.pad.hapticActuators || dummyArray;
    if (actuators.length) {
      var _options$startDelay, _options$strongMagnit, _options$weakMagnitud;
      const startDelay = (_options$startDelay = options == null ? void 0 : options.startDelay) != null ? _options$startDelay : 0;
      const strongMagnitude = (_options$strongMagnit = options == null ? void 0 : options.strongMagnitude) != null ? _options$strongMagnit : intensity;
      const weakMagnitude = (_options$weakMagnitud = options == null ? void 0 : options.weakMagnitude) != null ? _options$weakMagnitud : intensity;
      const results = await Promise.all(actuators.map(async function (actuator) {
        if (!actuator) {
          return true;
        }
        if (actuator.playEffect) {
          return actuator.playEffect(actuator.type, {
            duration,
            startDelay,
            strongMagnitude,
            weakMagnitude
          });
        } else if (actuator.pulse) {
          await sleep(startDelay);
          return actuator.pulse(intensity, duration);
        }
        return false;
      }));
      return results.some(r => r === true || r === 'complete');
    }
    return false;
  }

  /**
   * Retrieve a button from its index.
   *
   * @param {number} index - The index to return the button for.
   * @returns {GamePadButton} The button for the searched index. May be a placeholder if none found.
   */
  getButton(index) {
    const button = this._compiledMapping.buttons[index];
    return button ? button() : dummyButton;
  }

  /**
   * Returns true if the button is pressed.
   *
   * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
   * @returns {boolean} True if the button is pressed.
   */
  isPressed(button) {
    return this.getButton(button).pressed;
  }

  /**
   * Return true if the button was pressed since the last update.
   *
   * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
   * @returns {boolean} Return true if the button was pressed, false if not.
   */
  wasPressed(button) {
    return this.getButton(button).wasPressed;
  }

  /**
   * Return true if the button was released since the last update.
   *
   * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
   * @returns {boolean} Return true if the button was released, false if not.
   */
  wasReleased(button) {
    return this.getButton(button).wasReleased;
  }

  /**
   * Returns true if the button is touched.
   *
   * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
   * @returns {boolean} True if the button is touched.
   */
  isTouched(button) {
    return this.getButton(button).touched;
  }

  /**
   * Return true if the button was touched since the last update.
   *
   * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
   * @returns {boolean} Return true if the button was touched, false if not.
   */
  wasTouched(button) {
    return this.getButton(button).wasTouched;
  }

  /**
   * Returns the value of a button between 0 and 1, with 0 representing a button that is not pressed, and 1 representing a button that is fully pressed.
   *
   * @param {number} button - The button to retrieve, use constants {@link PAD_FACE_1}, etc.
   * @returns {number} The value of the button between 0 and 1.
   */
  getValue(button) {
    return this.getButton(button).value;
  }

  /**
   * Get the value of one of the analog axes of the pad.
   *
   * @param {number} axis - The axis to get the value of, use constants {@link PAD_L_STICK_X}, etc.
   * @returns {number} The value of the axis between -1 and 1.
   */
  getAxis(axis) {
    const a = this.axes[axis];
    return a && Math.abs(a) > deadZone ? a : 0;
  }
}

/**
 * Input handler for accessing GamePad input.
 *
 * @augments EventHandler
 */
class GamePads extends EventHandler {
  /**
   * Create a new GamePads instance.
   */
  constructor() {
    super();

    /**
     * Whether gamepads are supported by this device.
     *
     * @type {boolean}
     */
    this.gamepadsSupported = platform.gamepads;

    /**
     * The list of current gamepads.
     *
     * @type {GamePad[]}
     */
    this.current = [];

    /**
     * The list of previous buttons states
     *
     * @type {boolean[][]}
     * @ignore
     */
    this._previous = [];
    this._ongamepadconnectedHandler = this._ongamepadconnected.bind(this);
    this._ongamepaddisconnectedHandler = this._ongamepaddisconnected.bind(this);
    window.addEventListener('gamepadconnected', this._ongamepadconnectedHandler, false);
    window.addEventListener('gamepaddisconnected', this._ongamepaddisconnectedHandler, false);
    this.poll();
  }

  /**
   * Fired when a gamepad is connected.
   *
   * @event GamePads#gamepadconnected
   * @param {GamePad} gamepad - The gamepad that was just connected.
   * @example
   * const onPadConnected = function (pad) {
   *     if (!pad.mapping) {
   *         // Map the gamepad as the system could not find the proper map.
   *     } else {
   *         // Make the gamepad pulse.
   *     }
   * };
   * app.keyboard.on("gamepadconnected", onPadConnected, this);
   */

  /**
   * Fired when a gamepad is disconnected.
   *
   * @event GamePads#gamepaddisconnected
   * @param {GamePad} gamepad - The gamepad that was just disconnected.
   * @example
   * const onPadDisconnected = function (pad) {
   *     // Pause the game.
   * };
   * app.keyboard.on("gamepaddisconnected", onPadDisconnected, this);
   */

  /**
   * Threshold for axes to return values. Must be between 0 and 1.
   *
   * @type {number}
   * @ignore
   */
  set deadZone(value) {
    deadZone = value;
  }
  get deadZone() {
    return deadZone;
  }

  /**
   * The list of previous buttons states.
   *
   * @type {boolean[][]}
   * @ignore
   */
  get previous() {
    const current = this.current;
    for (let i = 0, l = current.length; i < l; i++) {
      const buttons = current[i]._buttons;
      if (!this._previous[i]) {
        this._previous[i] = [];
      }
      for (let j = 0, m = buttons.length; j < m; j++) {
        const button = buttons[i];
        this.previous[i][j] = button ? !button.wasPressed && button.pressed || button.wasReleased : false;
      }
    }
    this._previous.length = this.current.length;
    return this._previous;
  }

  /**
   * Callback function when a gamepad is connecting.
   *
   * @param {GamepadEvent} event - The event containing the connecting gamepad.
   * @private
   */
  _ongamepadconnected(event) {
    const pad = new GamePad(event.gamepad, this.getMap(event.gamepad));
    const current = this.current;
    let padIndex = current.findIndex(gp => gp.index === pad.index);
    while (padIndex !== -1) {
      current.splice(padIndex, 1);
      padIndex = current.findIndex(gp => gp.index === pad.index);
    }
    current.push(pad);
    this.fire(EVENT_GAMEPADCONNECTED, pad);
  }

  /**
   * Callback function when a gamepad is disconnecting.
   *
   * @param {GamepadEvent} event - The event containing the disconnecting gamepad.
   * @private
   */
  _ongamepaddisconnected(event) {
    const current = this.current;
    const padIndex = current.findIndex(gp => gp.index === event.gamepad.index);
    if (padIndex !== -1) {
      this.fire(EVENT_GAMEPADDISCONNECTED, current[padIndex]);
      current.splice(padIndex, 1);
    }
  }

  /**
   * Update the previous state of the gamepads. This must be called every frame for
   * `wasPressed` and `wasTouched` to work.
   *
   * @ignore
   */
  update() {
    this.poll();
  }

  /**
   * Poll for the latest data from the gamepad API.
   *
   * @param {GamePad[]} [pads] - An optional array used to receive the gamepads mapping. This
   * array will be returned by this function.
   * @returns {GamePad[]} An array of gamepads and mappings for the model of gamepad that is
   * attached.
   * @example
   * const gamepads = new pc.GamePads();
   * const pads = gamepads.poll();
   */
  poll(pads = []) {
    if (pads.length > 0) {
      pads.length = 0;
    }
    const padDevices = _getGamepads();
    for (let i = 0, len = padDevices.length; i < len; i++) {
      if (padDevices[i]) {
        const pad = this.findByIndex(padDevices[i].index);
        if (pad) {
          pads.push(pad.update(padDevices[i]));
        } else {
          const nPad = new GamePad(padDevices[i], this.getMap(padDevices[i]));
          this.current.push(nPad);
          pads.push(nPad);
        }
      }
    }
    return pads;
  }

  /**
   * Destroy the event listeners.
   *
   * @ignore
   */
  destroy() {
    window.removeEventListener('gamepadconnected', this._ongamepadconnectedHandler, false);
    window.removeEventListener('gamepaddisconnected', this._ongamepaddisconnectedHandler, false);
  }

  /**
   * Retrieve the order for buttons and axes for given HTML5 Gamepad.
   *
   * @param {Gamepad} pad - The HTML5 Gamepad object.
   * @returns {object} Object defining the order of buttons and axes for given HTML5 Gamepad.
   */
  getMap(pad) {
    return getMap(pad);
  }

  /**
   * Returns true if the button on the pad requested is pressed.
   *
   * @param {number} orderIndex - The order index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
   * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
   * @returns {boolean} True if the button is pressed.
   */
  isPressed(orderIndex, button) {
    var _this$current$orderIn;
    return ((_this$current$orderIn = this.current[orderIndex]) == null ? void 0 : _this$current$orderIn.isPressed(button)) || false;
  }

  /**
   * Returns true if the button was pressed since the last frame.
   *
   * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
   * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
   * @returns {boolean} True if the button was pressed since the last frame.
   */
  wasPressed(orderIndex, button) {
    var _this$current$orderIn2;
    return ((_this$current$orderIn2 = this.current[orderIndex]) == null ? void 0 : _this$current$orderIn2.wasPressed(button)) || false;
  }

  /**
   * Returns true if the button was released since the last frame.
   *
   * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
   * @param {number} button - The button to test, use constants {@link PAD_FACE_1}, etc.
   * @returns {boolean} True if the button was released since the last frame.
   */
  wasReleased(orderIndex, button) {
    var _this$current$orderIn3;
    return ((_this$current$orderIn3 = this.current[orderIndex]) == null ? void 0 : _this$current$orderIn3.wasReleased(button)) || false;
  }

  /**
   * Get the value of one of the analog axes of the pad.
   *
   * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
   * @param {number} axis - The axis to get the value of, use constants {@link PAD_L_STICK_X}, etc.
   * @returns {number} The value of the axis between -1 and 1.
   */
  getAxis(orderIndex, axis) {
    var _this$current$orderIn4;
    return ((_this$current$orderIn4 = this.current[orderIndex]) == null ? void 0 : _this$current$orderIn4.getAxis(axis)) || 0;
  }

  /**
   * Make the gamepad vibrate.
   *
   * @param {number} orderIndex - The index of the pad to check, use constants {@link PAD_1}, {@link PAD_2}, etc. For gamepad index call the function from the pad.
   * @param {number} intensity - Intensity for the vibration in the range 0 to 1.
   * @param {number} duration - Duration for the vibration in milliseconds.
   * @param {object} [options] - Options for special vibration pattern.
   * @param {number} [options.startDelay] - Delay before the pattern starts, in milliseconds. Defaults to 0.
   * @param {number} [options.strongMagnitude] - Intensity for strong actuators in the range 0 to 1. Defaults to intensity.
   * @param {number} [options.weakMagnitude] - Intensity for weak actuators in the range 0 to 1. Defaults to intensity.
   * @returns {Promise<boolean>} Return a Promise resulting in true if the pulse was successfully completed.
   */
  pulse(orderIndex, intensity, duration, options) {
    const pad = this.current[orderIndex];
    return pad ? pad.pulse(intensity, duration, options) : Promise.resolve(false);
  }

  /**
   * Make all gamepads vibrate.
   *
   * @param {number} intensity - Intensity for the vibration in the range 0 to 1.
   * @param {number} duration - Duration for the vibration in milliseconds.
   * @param {object} [options] - Options for special vibration pattern.
   * @param {number} [options.startDelay] - Delay before the pattern starts, in milliseconds. Defaults to 0.
   * @param {number} [options.strongMagnitude] - Intensity for strong actuators in the range 0 to 1. Defaults to intensity.
   * @param {number} [options.weakMagnitude] - Intensity for weak actuators in the range 0 to 1. Defaults to intensity.
   * @returns {Promise<boolean[]>} Return a Promise resulting in an array of booleans defining if the pulse was successfully completed for every gamepads.
   */
  pulseAll(intensity, duration, options) {
    return Promise.all(this.current.map(pad => pad.pulse(intensity, duration, options)));
  }

  /**
   * Find a connected {@link GamePad} from its identifier.
   *
   * @param {string} id - The identifier to search for.
   * @returns {GamePad|null} The {@link GamePad} with the matching identifier or null if no gamepad is found or the gamepad is not connected.
   */
  findById(id) {
    return this.current.find(gp => gp && gp.id === id) || null;
  }

  /**
   * Find a connected {@link GamePad} from its device index.
   *
   * @param {number} index - The device index to search for.
   * @returns {GamePad|null} The {@link GamePad} with the matching device index or null if no gamepad is found or the gamepad is not connected.
   */
  findByIndex(index) {
    return this.current.find(gp => gp && gp.index === index) || null;
  }
}

export { GamePad, GamePadButton, GamePads };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1wYWRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vaW5wdXQvZ2FtZS1wYWRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBFVkVOVF9HQU1FUEFEQ09OTkVDVEVELCBFVkVOVF9HQU1FUEFERElTQ09OTkVDVEVELCBQQURfRkFDRV8xLCBQQURfRkFDRV8yLCBQQURfRkFDRV8zLCBQQURfRkFDRV80LCBQQURfTF9TSE9VTERFUl8xLCBQQURfUl9TSE9VTERFUl8xLCBQQURfTF9TSE9VTERFUl8yLCBQQURfUl9TSE9VTERFUl8yLCBQQURfU0VMRUNULCBQQURfU1RBUlQsIFBBRF9MX1NUSUNLX0JVVFRPTiwgUEFEX1JfU1RJQ0tfQlVUVE9OLCBQQURfVVAsIFBBRF9ET1dOLCBQQURfTEVGVCwgUEFEX1JJR0hULCBQQURfVkVORE9SLCBYUlBBRF9UUklHR0VSLCBYUlBBRF9TUVVFRVpFLCBYUlBBRF9UT1VDSFBBRF9CVVRUT04sIFhSUEFEX1NUSUNLX0JVVFRPTiwgWFJQQURfQSwgWFJQQURfQiwgUEFEX0xfU1RJQ0tfWCwgUEFEX0xfU1RJQ0tfWSwgUEFEX1JfU1RJQ0tfWCwgUEFEX1JfU1RJQ0tfWSwgWFJQQURfVE9VQ0hQQURfWCwgWFJQQURfVE9VQ0hQQURfWSwgWFJQQURfU1RJQ0tfWCwgWFJQQURfU1RJQ0tfWSB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuXG5jb25zdCBkdW1teUFycmF5ID0gT2JqZWN0LmZyZWV6ZShbXSk7XG5cbi8qKlxuICogR2V0IEdhbWVwYWRzIGZyb20gQVBJLlxuICpcbiAqIEB0eXBlIHtGdW5jdGlvbn1cbiAqIEByZXR1cm5zIHtHYW1lcGFkW119IFJldHJpZXZlZCBnYW1lcGFkcyBmcm9tIHRoZSBkZXZpY2UuXG4gKiBAaWdub3JlXG4gKi9cbmxldCBnZXRHYW1lcGFkcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gZHVtbXlBcnJheTtcbn07XG5cbmlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJykge1xuICAgIGdldEdhbWVwYWRzID0gKG5hdmlnYXRvci5nZXRHYW1lcGFkcyB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0R2FtZXBhZHMgfHwgZ2V0R2FtZXBhZHMpLmJpbmQobmF2aWdhdG9yKTtcbn1cblxuY29uc3QgTUFQU19JTkRFWEVTID0ge1xuICAgIGJ1dHRvbnM6IHtcbiAgICAgICAgUEFEX0ZBQ0VfMSxcbiAgICAgICAgUEFEX0ZBQ0VfMixcbiAgICAgICAgUEFEX0ZBQ0VfMyxcbiAgICAgICAgUEFEX0ZBQ0VfNCxcbiAgICAgICAgUEFEX0xfU0hPVUxERVJfMSxcbiAgICAgICAgUEFEX1JfU0hPVUxERVJfMSxcbiAgICAgICAgUEFEX0xfU0hPVUxERVJfMixcbiAgICAgICAgUEFEX1JfU0hPVUxERVJfMixcbiAgICAgICAgUEFEX1NFTEVDVCxcbiAgICAgICAgUEFEX1NUQVJULFxuICAgICAgICBQQURfTF9TVElDS19CVVRUT04sXG4gICAgICAgIFBBRF9SX1NUSUNLX0JVVFRPTixcbiAgICAgICAgUEFEX1VQLFxuICAgICAgICBQQURfRE9XTixcbiAgICAgICAgUEFEX0xFRlQsXG4gICAgICAgIFBBRF9SSUdIVCxcbiAgICAgICAgUEFEX1ZFTkRPUixcbiAgICAgICAgWFJQQURfVFJJR0dFUixcbiAgICAgICAgWFJQQURfU1FVRUVaRSxcbiAgICAgICAgWFJQQURfVE9VQ0hQQURfQlVUVE9OLFxuICAgICAgICBYUlBBRF9TVElDS19CVVRUT04sXG4gICAgICAgIFhSUEFEX0EsXG4gICAgICAgIFhSUEFEX0JcbiAgICB9LFxuICAgIGF4ZXM6IHtcbiAgICAgICAgUEFEX0xfU1RJQ0tfWCxcbiAgICAgICAgUEFEX0xfU1RJQ0tfWSxcbiAgICAgICAgUEFEX1JfU1RJQ0tfWCxcbiAgICAgICAgUEFEX1JfU1RJQ0tfWSxcbiAgICAgICAgWFJQQURfVE9VQ0hQQURfWCxcbiAgICAgICAgWFJQQURfVE9VQ0hQQURfWSxcbiAgICAgICAgWFJQQURfU1RJQ0tfWCxcbiAgICAgICAgWFJQQURfU1RJQ0tfWVxuICAgIH1cbn07XG5cbmNvbnN0IE1BUFMgPSB7XG4gICAgREVGQVVMVDoge1xuICAgICAgICBidXR0b25zOiBbXG4gICAgICAgICAgICAvLyBGYWNlIGJ1dHRvbnNcbiAgICAgICAgICAgICdQQURfRkFDRV8xJyxcbiAgICAgICAgICAgICdQQURfRkFDRV8yJyxcbiAgICAgICAgICAgICdQQURfRkFDRV8zJyxcbiAgICAgICAgICAgICdQQURfRkFDRV80JyxcblxuICAgICAgICAgICAgLy8gU2hvdWxkZXIgYnV0dG9uc1xuICAgICAgICAgICAgJ1BBRF9MX1NIT1VMREVSXzEnLFxuICAgICAgICAgICAgJ1BBRF9SX1NIT1VMREVSXzEnLFxuICAgICAgICAgICAgJ1BBRF9MX1NIT1VMREVSXzInLFxuICAgICAgICAgICAgJ1BBRF9SX1NIT1VMREVSXzInLFxuXG4gICAgICAgICAgICAvLyBPdGhlciBidXR0b25zXG4gICAgICAgICAgICAnUEFEX1NFTEVDVCcsXG4gICAgICAgICAgICAnUEFEX1NUQVJUJyxcbiAgICAgICAgICAgICdQQURfTF9TVElDS19CVVRUT04nLFxuICAgICAgICAgICAgJ1BBRF9SX1NUSUNLX0JVVFRPTicsXG5cbiAgICAgICAgICAgIC8vIEQgUGFkXG4gICAgICAgICAgICAnUEFEX1VQJyxcbiAgICAgICAgICAgICdQQURfRE9XTicsXG4gICAgICAgICAgICAnUEFEX0xFRlQnLFxuICAgICAgICAgICAgJ1BBRF9SSUdIVCcsXG5cbiAgICAgICAgICAgICAvLyBWZW5kb3Igc3BlY2lmaWMgYnV0dG9uXG4gICAgICAgICAgICAnUEFEX1ZFTkRPUidcbiAgICAgICAgXSxcblxuICAgICAgICBheGVzOiBbXG4gICAgICAgICAgICAvLyBBbmFsb2cgU3RpY2tzXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfWScsXG4gICAgICAgICAgICAnUEFEX1JfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnUEFEX1JfU1RJQ0tfWSdcbiAgICAgICAgXVxuICAgIH0sXG5cbiAgICBERUZBVUxUX0RVQUw6IHtcbiAgICAgICAgYnV0dG9uczogW1xuICAgICAgICAgICAgLy8gRmFjZSBidXR0b25zXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMScsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMicsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMycsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfNCcsXG5cbiAgICAgICAgICAgIC8vIFNob3VsZGVyIGJ1dHRvbnNcbiAgICAgICAgICAgICdQQURfTF9TSE9VTERFUl8xJyxcbiAgICAgICAgICAgICdQQURfUl9TSE9VTERFUl8xJyxcbiAgICAgICAgICAgICdQQURfTF9TSE9VTERFUl8yJyxcbiAgICAgICAgICAgICdQQURfUl9TSE9VTERFUl8yJyxcblxuICAgICAgICAgICAgLy8gT3RoZXIgYnV0dG9uc1xuICAgICAgICAgICAgJ1BBRF9TRUxFQ1QnLFxuICAgICAgICAgICAgJ1BBRF9TVEFSVCcsXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfQlVUVE9OJyxcbiAgICAgICAgICAgICdQQURfUl9TVElDS19CVVRUT04nLFxuXG4gICAgICAgICAgICAgLy8gVmVuZG9yIHNwZWNpZmljIGJ1dHRvblxuICAgICAgICAgICAgJ1BBRF9WRU5ET1InXG4gICAgICAgIF0sXG5cbiAgICAgICAgYXhlczogW1xuICAgICAgICAgICAgLy8gQW5hbG9nIFN0aWNrc1xuICAgICAgICAgICAgJ1BBRF9MX1NUSUNLX1gnLFxuICAgICAgICAgICAgJ1BBRF9MX1NUSUNLX1knLFxuICAgICAgICAgICAgJ1BBRF9SX1NUSUNLX1gnLFxuICAgICAgICAgICAgJ1BBRF9SX1NUSUNLX1knXG4gICAgICAgIF0sXG5cbiAgICAgICAgc3ludGhlc2l6ZWRCdXR0b25zOiB7XG4gICAgICAgICAgICBQQURfVVA6IHsgYXhpczogMCwgbWluOiAwLCBtYXg6IDEgfSxcbiAgICAgICAgICAgIFBBRF9ET1dOOiB7IGF4aXM6IDAsIG1pbjogLTEsIG1heDogMCB9LFxuICAgICAgICAgICAgUEFEX0xFRlQ6IHsgYXhpczogMCwgbWluOiAtMSwgbWF4OiAwIH0sXG4gICAgICAgICAgICBQQURfUklHSFQ6IHsgYXhpczogMCwgbWluOiAwLCBtYXg6IDEgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIFBTMzoge1xuICAgICAgICBidXR0b25zOiBbXG4gICAgICAgICAgICAvLyBYLCBPLCBUUkksIFNRXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMScsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMicsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfNCcsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMycsXG5cbiAgICAgICAgICAgIC8vIFNob3VsZGVyIGJ1dHRvbnNcbiAgICAgICAgICAgICdQQURfTF9TSE9VTERFUl8xJyxcbiAgICAgICAgICAgICdQQURfUl9TSE9VTERFUl8xJyxcbiAgICAgICAgICAgICdQQURfTF9TSE9VTERFUl8yJyxcbiAgICAgICAgICAgICdQQURfUl9TSE9VTERFUl8yJyxcblxuICAgICAgICAgICAgLy8gT3RoZXIgYnV0dG9uc1xuICAgICAgICAgICAgJ1BBRF9TRUxFQ1QnLFxuICAgICAgICAgICAgJ1BBRF9TVEFSVCcsXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfQlVUVE9OJyxcbiAgICAgICAgICAgICdQQURfUl9TVElDS19CVVRUT04nLFxuXG4gICAgICAgICAgICAvLyBEIFBhZFxuICAgICAgICAgICAgJ1BBRF9VUCcsXG4gICAgICAgICAgICAnUEFEX0RPV04nLFxuICAgICAgICAgICAgJ1BBRF9MRUZUJyxcbiAgICAgICAgICAgICdQQURfUklHSFQnLFxuXG4gICAgICAgICAgICAnUEFEX1ZFTkRPUidcbiAgICAgICAgXSxcblxuICAgICAgICBheGVzOiBbXG4gICAgICAgICAgICAvLyBBbmFsb2cgU3RpY2tzXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfWScsXG4gICAgICAgICAgICAnUEFEX1JfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnUEFEX1JfU1RJQ0tfWSdcbiAgICAgICAgXSxcblxuICAgICAgICBtYXBwaW5nOiAnc3RhbmRhcmQnXG4gICAgfSxcblxuICAgIERFRkFVTFRfWFI6IHtcbiAgICAgICAgYnV0dG9uczogW1xuICAgICAgICAgICAgLy8gQmFjayBidXR0b25zXG4gICAgICAgICAgICAnWFJQQURfVFJJR0dFUicsXG4gICAgICAgICAgICAnWFJQQURfU1FVRUVaRScsXG5cbiAgICAgICAgICAgIC8vIEF4ZXMgYnV0dG9uc1xuICAgICAgICAgICAgJ1hSUEFEX1RPVUNIUEFEX0JVVFRPTicsXG4gICAgICAgICAgICAnWFJQQURfU1RJQ0tfQlVUVE9OJyxcblxuICAgICAgICAgICAgLy8gRmFjZSBidXR0b25zXG4gICAgICAgICAgICAnWFJQQURfQScsXG4gICAgICAgICAgICAnWFJQQURfQidcbiAgICAgICAgXSxcblxuICAgICAgICBheGVzOiBbXG4gICAgICAgICAgICAvLyBBbmFsb2cgU3RpY2tzXG4gICAgICAgICAgICAnWFJQQURfVE9VQ0hQQURfWCcsXG4gICAgICAgICAgICAnWFJQQURfVE9VQ0hQQURfWScsXG4gICAgICAgICAgICAnWFJQQURfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnWFJQQURfU1RJQ0tfWSdcbiAgICAgICAgXSxcblxuICAgICAgICBtYXBwaW5nOiAneHItc3RhbmRhcmQnXG4gICAgfVxufTtcblxuY29uc3QgUFJPRFVDVF9DT0RFUyA9IHtcbiAgICAnUHJvZHVjdDogMDI2OCc6ICdQUzMnXG59O1xuXG5jb25zdCBjdXN0b21fbWFwcyA9IHt9O1xuXG4vKipcbiAqIFJldHJpZXZlIHRoZSBvcmRlciBmb3IgYnV0dG9ucyBhbmQgYXhlcyBmb3IgZ2l2ZW4gSFRNTDUgR2FtZXBhZC5cbiAqXG4gKiBAcGFyYW0ge0dhbWVwYWR9IHBhZCAtIFRoZSBIVE1MNSBHYW1lcGFkIG9iamVjdC5cbiAqIEByZXR1cm5zIHtvYmplY3R9IE9iamVjdCBkZWZpbmluZyB0aGUgb3JkZXIgb2YgYnV0dG9ucyBhbmQgYXhlcyBmb3IgZ2l2ZW4gSFRNTDUgR2FtZXBhZC5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gZ2V0TWFwKHBhZCkge1xuICAgIGNvbnN0IGN1c3RvbSA9IGN1c3RvbV9tYXBzW3BhZC5pZF07XG4gICAgaWYgKGN1c3RvbSkge1xuICAgICAgICByZXR1cm4gY3VzdG9tO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgY29kZSBpbiBQUk9EVUNUX0NPREVTKSB7XG4gICAgICAgIGlmIChwYWQuaWQuaW5kZXhPZihjb2RlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb2R1Y3QgPSBQUk9EVUNUX0NPREVTW2NvZGVdO1xuXG4gICAgICAgICAgICBpZiAoIXBhZC5tYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gTUFQU1snUkFXXycgKyBwcm9kdWN0XTtcblxuICAgICAgICAgICAgICAgIGlmIChyYXcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJhdztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBNQVBTW3Byb2R1Y3RdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBhZC5tYXBwaW5nID09PSAneHItc3RhbmRhcmQnKSB7XG4gICAgICAgIHJldHVybiBNQVBTLkRFRkFVTFRfWFI7XG4gICAgfVxuXG4gICAgY29uc3QgZGVmYXVsdG1hcCA9IE1BUFMuREVGQVVMVDtcbiAgICBjb25zdCBtYXAgPSBwYWQuYnV0dG9ucy5sZW5ndGggPCBkZWZhdWx0bWFwLmJ1dHRvbnMubGVuZ3RoID8gTUFQUy5ERUZBVUxUX0RVQUwgOiBkZWZhdWx0bWFwO1xuICAgIG1hcC5tYXBwaW5nID0gcGFkLm1hcHBpbmc7XG4gICAgcmV0dXJuIG1hcDtcbn1cblxubGV0IGRlYWRab25lID0gMC4yNTtcblxuLyoqXG4gKiBAcGFyYW0ge251bWJlcn0gbXMgLSBOdW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIHNsZWVwIGZvci5cbiAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBzbGVlcChtcykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBBIEdhbWVQYWRCdXR0b24gc3RvcmVzIGluZm9ybWF0aW9uIGFib3V0IGEgYnV0dG9uIGZyb20gdGhlIEdhbWVwYWQgQVBJLlxuICovXG5jbGFzcyBHYW1lUGFkQnV0dG9uIHtcbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgZm9yIHRoZSBidXR0b24gYmV0d2VlbiAwIGFuZCAxLCB3aXRoIDAgcmVwcmVzZW50aW5nIGEgYnV0dG9uIHRoYXQgaXMgbm90IHByZXNzZWQsIGFuZCAxIHJlcHJlc2VudGluZyBhIGJ1dHRvbiB0aGF0IGlzIGZ1bGx5IHByZXNzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHZhbHVlID0gMDtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiBpcyBjdXJyZW50bHkgZG93bi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHByZXNzZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiBpcyBjdXJyZW50bHkgdG91Y2hlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRvdWNoZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiB3YXMgcHJlc3NlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHdhc1ByZXNzZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiB3YXMgcmVsZWFzZWQgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgd2FzUmVsZWFzZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiB3YXMgdG91Y2hlZCBzaW5jZSB0aGUgbGFzdCB1cGRhdGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB3YXNUb3VjaGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgR2FtZVBhZEJ1dHRvbiBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfEdhbWVwYWRCdXR0b259IGN1cnJlbnQgLSBUaGUgb3JpZ2luYWwgR2FtZXBhZCBBUEkgZ2FtZXBhZCBidXR0b24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ8R2FtZXBhZEJ1dHRvbn0gW3ByZXZpb3VzXSAtIFRoZSBwcmV2aW91cyBHYW1lcGFkIEFQSSBnYW1lcGFkIGJ1dHRvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY3VycmVudCwgcHJldmlvdXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjdXJyZW50ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy52YWx1ZSA9IGN1cnJlbnQ7XG4gICAgICAgICAgICB0aGlzLnByZXNzZWQgPSBjdXJyZW50ID09PSAxO1xuICAgICAgICAgICAgdGhpcy50b3VjaGVkID0gY3VycmVudCA+IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gY3VycmVudC52YWx1ZTtcbiAgICAgICAgICAgIHRoaXMucHJlc3NlZCA9IGN1cnJlbnQucHJlc3NlZDtcbiAgICAgICAgICAgIHRoaXMudG91Y2hlZCA9IGN1cnJlbnQudG91Y2hlZCA/PyBjdXJyZW50LnZhbHVlID4gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcmV2aW91cykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBwcmV2aW91cyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndhc1ByZXNzZWQgPSBwcmV2aW91cyAhPT0gMSAmJiB0aGlzLnByZXNzZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy53YXNSZWxlYXNlZCA9IHByZXZpb3VzID09PSAxICYmICF0aGlzLnByZXNzZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy53YXNUb3VjaGVkID0gcHJldmlvdXMgPT09IDAgJiYgdGhpcy50b3VjaGVkO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndhc1ByZXNzZWQgPSAhcHJldmlvdXMucHJlc3NlZCAmJiB0aGlzLnByZXNzZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy53YXNSZWxlYXNlZCA9IHByZXZpb3VzLnByZXNzZWQgJiYgIXRoaXMucHJlc3NlZDtcbiAgICAgICAgICAgICAgICB0aGlzLndhc1RvdWNoZWQgPSAhKHByZXZpb3VzLnRvdWNoZWQgPz8gcHJldmlvdXMudmFsdWUgPiAwKSAmJiB0aGlzLnRvdWNoZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIGV4aXN0aW5nIEdhbWVQYWRCdXR0b24gSW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dhbWVwYWRCdXR0b259IGJ1dHRvbiAtIFRoZSBvcmlnaW5hbCBHYW1lcGFkIEFQSSBnYW1lcGFkIGJ1dHRvbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGJ1dHRvbikge1xuICAgICAgICBjb25zdCB7IHZhbHVlLCBwcmVzc2VkIH0gPSBidXR0b247XG4gICAgICAgIGNvbnN0IHRvdWNoZWQgPSBidXR0b24udG91Y2hlZCA/PyB2YWx1ZSA+IDA7XG5cbiAgICAgICAgdGhpcy53YXNQcmVzc2VkID0gIXRoaXMucHJlc3NlZCAmJiBwcmVzc2VkO1xuICAgICAgICB0aGlzLndhc1JlbGVhc2VkID0gdGhpcy5wcmVzc2VkICYmICFwcmVzc2VkO1xuICAgICAgICB0aGlzLndhc1RvdWNoZWQgPSAhdGhpcy50b3VjaGVkICYmIHRvdWNoZWQ7XG5cbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLnByZXNzZWQgPSBwcmVzc2VkO1xuICAgICAgICB0aGlzLnRvdWNoZWQgPSB0b3VjaGVkO1xuICAgIH1cbn1cblxuY29uc3QgZHVtbXlCdXR0b24gPSBPYmplY3QuZnJlZXplKG5ldyBHYW1lUGFkQnV0dG9uKDApKTtcblxuLyoqXG4gKiBBIEdhbWVQYWQgc3RvcmVzIGluZm9ybWF0aW9uIGFib3V0IGEgZ2FtZXBhZCBmcm9tIHRoZSBHYW1lcGFkIEFQSS5cbiAqL1xuY2xhc3MgR2FtZVBhZCB7XG4gICAgLyoqXG4gICAgICogVGhlIGNvbXBpbGVkIG1hcHBpbmcgdG8gcmVkdWNlIGxvb2t1cCBkZWxheSB3aGVuIHJldHJpZXZpbmcgYnV0dG9uc1xuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jb21waWxlZE1hcHBpbmcgPSB7XG4gICAgICAgIGJ1dHRvbnM6IFtdLFxuICAgICAgICBheGVzOiBbXVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgR2FtZVBhZCBJbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R2FtZXBhZH0gZ2FtZXBhZCAtIFRoZSBvcmlnaW5hbCBHYW1lcGFkIEFQSSBnYW1lcGFkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBtYXAgLSBUaGUgYnV0dG9ucyBhbmQgYXhlcyBtYXAuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdhbWVwYWQsIG1hcCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGlkZW50aWZpZXIgZm9yIHRoZSBnYW1lcGFkLiBJdHMgc3RydWN0dXJlIGRlcGVuZHMgb24gZGV2aWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pZCA9IGdhbWVwYWQuaWQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbmRleCBmb3IgdGhpcyBjb250cm9sbGVyLiBBIGdhbWVwYWQgdGhhdCBpcyBkaXNjb25uZWN0ZWQgYW5kIHJlY29ubmVjdGVkIHdpbGwgcmV0YWluIHRoZSBzYW1lIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbmRleCA9IGdhbWVwYWQuaW5kZXg7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBidXR0b25zIHByZXNlbnQgb24gdGhlIEdhbWVQYWQuIE9yZGVyIGlzIHByb3ZpZGVkIGJ5IEFQSSwgdXNlIEdhbWVQYWQjYnV0dG9ucyBpbnN0ZWFkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R2FtZVBhZEJ1dHRvbltdfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9idXR0b25zID0gZ2FtZXBhZC5idXR0b25zLm1hcChiID0+IG5ldyBHYW1lUGFkQnV0dG9uKGIpKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGF4ZXMgdmFsdWVzIGZyb20gdGhlIEdhbWVQYWQuIE9yZGVyIGlzIHByb3ZpZGVkIGJ5IEFQSSwgdXNlIEdhbWVQYWQjYXhlcyBpbnN0ZWFkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2F4ZXMgPSBbLi4uZ2FtZXBhZC5heGVzXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUHJldmlvdXMgdmFsdWUgZm9yIHRoZSBhbmFsb2cgYXhlcyBwcmVzZW50IG9uIHRoZSBnYW1lcGFkLiBWYWx1ZXMgYXJlIGJldHdlZW4gLTEgYW5kIDEuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcHJldmlvdXNBeGVzID0gWy4uLmdhbWVwYWQuYXhlc107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBnYW1lcGFkIG1hcHBpbmcgZGV0ZWN0ZWQgYnkgdGhlIGJyb3dzZXIuIFZhbHVlIGlzIGVpdGhlciBcInN0YW5kYXJkXCIsIFwieHItc3RhbmRhcmRcIiwgXCJcIiBvciBcImN1c3RvbVwiLiBXaGVuIGVtcHR5IHN0cmluZywgeW91IG1heSBuZWVkIHRvIHVwZGF0ZSB0aGUgbWFwcGluZyB5b3Vyc2VsZi4gXCJjdXN0b21cIiBtZWFucyB5b3UgdXBkYXRlZCB0aGUgbWFwcGluZy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWFwcGluZyA9IG1hcC5tYXBwaW5nO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYnV0dG9ucyBhbmQgYXhlcyBtYXAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm1hcCA9IG1hcDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGhhbmQgdGhpcyBnYW1lcGFkIGlzIHVzdWFsbHkgaGFuZGxlZCBvbi4gT25seSByZWxldmFudCBmb3IgWFIgcGFkcy4gVmFsdWUgaXMgZWl0aGVyIFwibGVmdFwiLCBcInJpZ2h0XCIgb3IgXCJub25lXCIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmhhbmQgPSBnYW1lcGFkLmhhbmQgfHwgJ25vbmUnO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgb3JpZ2luYWwgR2FtZXBhZCBBUEkgZ2FtZXBhZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0dhbWVwYWR9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucGFkID0gZ2FtZXBhZDtcblxuICAgICAgICB0aGlzLl9jb21waWxlTWFwcGluZygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGdhbWVwYWQgaXMgY29ubmVjdGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGNvbm5lY3RlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFkLmNvbm5lY3RlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb21waWxlIHRoZSBidXR0b25zIG1hcHBpbmcgdG8gcmVkdWNlIGxvb2t1cCBkZWxheS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NvbXBpbGVNYXBwaW5nKCkge1xuICAgICAgICBjb25zdCB7IGF4ZXMsIGJ1dHRvbnMgfSA9IHRoaXMuX2NvbXBpbGVkTWFwcGluZztcbiAgICAgICAgY29uc3QgYXhlc0luZGV4ZXMgPSBNQVBTX0lOREVYRVMuYXhlcztcbiAgICAgICAgY29uc3QgYnV0dG9uc0luZGV4ZXMgPSBNQVBTX0lOREVYRVMuYnV0dG9ucztcblxuICAgICAgICAvLyBDbGVhciBleGlzdGluZ1xuICAgICAgICBheGVzLmxlbmd0aCA9IDA7XG4gICAgICAgIGJ1dHRvbnMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBBZGQgYXhlc1xuICAgICAgICBjb25zdCBheGVzTWFwID0gdGhpcy5tYXAuYXhlcztcbiAgICAgICAgaWYgKGF4ZXNNYXApIHtcbiAgICAgICAgICAgIHRoaXMubWFwLmF4ZXMuZm9yRWFjaCgoYXhpcywgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGF4ZXNbYXhlc0luZGV4ZXNbYXhpc11dID0gKCkgPT4gdGhpcy5wYWQuYXhlc1tpXSB8fCAwO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaWxsIGVtcHR5IGluZGV4ZXMgZm9yIGF4ZXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBheGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaWYgKCFheGVzW2ldKSB7XG4gICAgICAgICAgICAgICAgYXhlc1tpXSA9ICgpID0+IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgYmFzaWMgYnV0dG9uc1xuICAgICAgICBjb25zdCBidXR0b25zTWFwID0gdGhpcy5tYXAuYnV0dG9ucztcbiAgICAgICAgaWYgKGJ1dHRvbnNNYXApIHtcbiAgICAgICAgICAgIGJ1dHRvbnNNYXAuZm9yRWFjaCgoYnV0dG9uLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgYnV0dG9uc1tidXR0b25zSW5kZXhlc1tidXR0b25dXSA9ICgpID0+IHRoaXMuX2J1dHRvbnNbaV0gfHwgZHVtbXlCdXR0b247XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFkZCBzeW50aGVzaXplZCBidXR0b25zXG4gICAgICAgIGNvbnN0IHN5bnRoZXNpemVkQnV0dG9uc01hcCA9IHRoaXMubWFwLnN5bnRoZXNpemVkQnV0dG9ucztcbiAgICAgICAgaWYgKHN5bnRoZXNpemVkQnV0dG9uc01hcCkge1xuICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc3ludGhlc2l6ZWRCdXR0b25zTWFwKS5mb3JFYWNoKChidXR0b24pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGF4aXMsIG1heCwgbWluIH0gPSBidXR0b25bMV07XG4gICAgICAgICAgICAgICAgYnV0dG9uc1tidXR0b25zSW5kZXhlc1tidXR0b25bMF1dXSA9ICgpID0+IG5ldyBHYW1lUGFkQnV0dG9uKFxuICAgICAgICAgICAgICAgICAgICBNYXRoLmFicyhtYXRoLmNsYW1wKHRoaXMuX2F4ZXNbYXhpc10gPz8gMCwgbWluLCBtYXgpKSxcbiAgICAgICAgICAgICAgICAgICAgTWF0aC5hYnMobWF0aC5jbGFtcCh0aGlzLl9wcmV2aW91c0F4ZXNbYXhpc10gPz8gMCwgbWluLCBtYXgpKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbGwgZW1wdHkgaW5kZXhlcyBmb3IgYnV0dG9uc1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGJ1dHRvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIWJ1dHRvbnNbaV0pIHtcbiAgICAgICAgICAgICAgICBidXR0b25zW2ldID0gKCkgPT4gZHVtbXlCdXR0b247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIGV4aXN0aW5nIEdhbWVQYWQgSW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dhbWVwYWR9IGdhbWVwYWQgLSBUaGUgb3JpZ2luYWwgR2FtZXBhZCBBUEkgZ2FtZXBhZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGdhbWVwYWQpIHtcbiAgICAgICAgdGhpcy5wYWQgPSBnYW1lcGFkO1xuXG4gICAgICAgIGNvbnN0IHByZXZpb3VzQXhlcyA9IHRoaXMuX3ByZXZpb3VzQXhlcztcbiAgICAgICAgY29uc3QgYXhlcyA9IHRoaXMuX2F4ZXM7XG5cbiAgICAgICAgLy8gU3RvcmUgcHJldmlvdXMgdmFsdWVzIGZvciBheGVzIGZvciBkdWFsIGJ1dHRvbnMuXG4gICAgICAgIHByZXZpb3VzQXhlcy5sZW5ndGggPSAwO1xuICAgICAgICBwcmV2aW91c0F4ZXMucHVzaCguLi5heGVzKTtcblxuICAgICAgICAvLyBVcGRhdGUgYXhlc1xuICAgICAgICBheGVzLmxlbmd0aCA9IDA7XG4gICAgICAgIGF4ZXMucHVzaCguLi5nYW1lcGFkLmF4ZXMpO1xuXG4gICAgICAgIC8vIFVwZGF0ZSBidXR0b25zXG4gICAgICAgIGNvbnN0IGJ1dHRvbnMgPSB0aGlzLl9idXR0b25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGJ1dHRvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBidXR0b25zW2ldLnVwZGF0ZShnYW1lcGFkLmJ1dHRvbnNbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSBtYXAgZm9yIHRoaXMgZ2FtZXBhZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBtYXAgLSBUaGUgbmV3IG1hcHBpbmcgZm9yIHRoaXMgZ2FtZXBhZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBtYXAuYnV0dG9ucyAtIEJ1dHRvbnMgbWFwcGluZyBmb3IgdGhpcyBnYW1lcGFkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IG1hcC5heGVzIC0gQXhlcyBtYXBwaW5nIGZvciB0aGlzIGdhbWVwYWQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFttYXAuc3ludGhlc2l6ZWRCdXR0b25zXSAtIEluZm9ybWF0aW9uIGFib3V0IGJ1dHRvbnMgdG8gcHVsbCBmcm9tIGF4ZXMgZm9yIHRoaXMgZ2FtZXBhZC4gUmVxdWlyZXMgZGVmaW5pdGlvbiBvZiBheGlzIGluZGV4LCBtaW4gdmFsdWUgYW5kIG1heCB2YWx1ZS5cbiAgICAgKiBAcGFyYW0ge1wiY3VzdG9tXCJ9IFttYXAubWFwcGluZ10gLSBOZXcgbWFwcGluZyBmb3JtYXQuIFdpbGwgYmUgZm9yY2VkIGludG8gXCJjdXN0b21cIi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHRoaXMucGFkLnVwZGF0ZU1hcCh7XG4gICAgICogICAgIGJ1dHRvbnM6IFtbXG4gICAgICogICAgICAgICAnUEFEX0ZBQ0VfMScsXG4gICAgICogICAgICAgICAnUEFEX0ZBQ0VfMicsXG4gICAgICogICAgICAgICAnUEFEX0ZBQ0VfMycsXG4gICAgICogICAgICAgICAnUEFEX0ZBQ0VfNCcsXG4gICAgICogICAgICAgICAnUEFEX0xfU0hPVUxERVJfMScsXG4gICAgICogICAgICAgICAnUEFEX1JfU0hPVUxERVJfMScsXG4gICAgICogICAgICAgICAnUEFEX0xfU0hPVUxERVJfMicsXG4gICAgICogICAgICAgICAnUEFEX1JfU0hPVUxERVJfMicsXG4gICAgICogICAgICAgICAnUEFEX1NFTEVDVCcsXG4gICAgICogICAgICAgICAnUEFEX1NUQVJUJyxcbiAgICAgKiAgICAgICAgICdQQURfTF9TVElDS19CVVRUT04nLFxuICAgICAqICAgICAgICAgJ1BBRF9SX1NUSUNLX0JVVFRPTicsXG4gICAgICogICAgICAgICAnUEFEX1ZFTkRPUidcbiAgICAgKiAgICAgXSxcbiAgICAgKiAgICAgYXhlczogW1xuICAgICAqICAgICAgICAgJ1BBRF9MX1NUSUNLX1gnLFxuICAgICAqICAgICAgICAgJ1BBRF9MX1NUSUNLX1knLFxuICAgICAqICAgICAgICAgJ1BBRF9SX1NUSUNLX1gnLFxuICAgICAqICAgICAgICAgJ1BBRF9SX1NUSUNLX1knXG4gICAgICogICAgIF0sXG4gICAgICogICAgIHN5bnRoZXNpemVkQnV0dG9uczoge1xuICAgICAqICAgICAgICAgUEFEX1VQOiB7IGF4aXM6IDAsIG1pbjogMCwgbWF4OiAxIH0sXG4gICAgICogICAgICAgICBQQURfRE9XTjogeyBheGlzOiAwLCBtaW46IC0xLCBtYXg6IDAgfSxcbiAgICAgKiAgICAgICAgIFBBRF9MRUZUOiB7IGF4aXM6IDAsIG1pbjogLTEsIG1heDogMCB9LFxuICAgICAqICAgICAgICAgUEFEX1JJR0hUOiB7IGF4aXM6IDAsIG1pbjogMCwgbWF4OiAxIH1cbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHVwZGF0ZU1hcChtYXApIHtcbiAgICAgICAgbWFwLm1hcHBpbmcgPSAnY3VzdG9tJztcblxuICAgICAgICAvLyBTYXZlIHRoZSBtYXAgaW4gY2FzZSBvZiBkaXNjb25uZWN0aW9uLlxuICAgICAgICBjdXN0b21fbWFwc1t0aGlzLmlkXSA9IG1hcDtcblxuICAgICAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICAgICAgdGhpcy5tYXBwaW5nID0gJ2N1c3RvbSc7XG5cbiAgICAgICAgdGhpcy5fY29tcGlsZU1hcHBpbmcoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNldCBnYW1lcGFkIG1hcHBpbmcgdG8gZGVmYXVsdC5cbiAgICAgKi9cbiAgICByZXNldE1hcCgpIHtcbiAgICAgICAgaWYgKGN1c3RvbV9tYXBzW3RoaXMuaWRdKSB7XG4gICAgICAgICAgICBkZWxldGUgY3VzdG9tX21hcHNbdGhpcy5pZF07XG5cbiAgICAgICAgICAgIGNvbnN0IG1hcCA9IGdldE1hcCh0aGlzLnBhZCk7XG4gICAgICAgICAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICAgICAgICAgIHRoaXMubWFwcGluZyA9IG1hcC5tYXBwaW5nO1xuXG4gICAgICAgICAgICB0aGlzLl9jb21waWxlTWFwcGluZygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlcyBmcm9tIGFuYWxvZyBheGVzIHByZXNlbnQgb24gdGhlIEdhbWVQYWQuIFZhbHVlcyBhcmUgYmV0d2VlbiAtMSBhbmQgMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKi9cbiAgICBnZXQgYXhlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBpbGVkTWFwcGluZy5heGVzLm1hcChhID0+IGEoKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGJ1dHRvbnMgcHJlc2VudCBvbiB0aGUgR2FtZVBhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHYW1lUGFkQnV0dG9uW119XG4gICAgICovXG4gICAgZ2V0IGJ1dHRvbnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb21waWxlZE1hcHBpbmcuYnV0dG9ucy5tYXAoYiA9PiBiKCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1ha2UgdGhlIGdhbWVwYWQgdmlicmF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbnRlbnNpdHkgLSBJbnRlbnNpdHkgZm9yIHRoZSB2aWJyYXRpb24gaW4gdGhlIHJhbmdlIDAgdG8gMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHVyYXRpb24gLSBEdXJhdGlvbiBmb3IgdGhlIHZpYnJhdGlvbiBpbiBtaWxsaXNlY29uZHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbnMgZm9yIHNwZWNpYWwgdmlicmF0aW9uIHBhdHRlcm4uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0RGVsYXldIC0gRGVsYXkgYmVmb3JlIHRoZSBwYXR0ZXJuIHN0YXJ0cywgaW4gbWlsbGlzZWNvbmRzLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdHJvbmdNYWduaXR1ZGVdIC0gSW50ZW5zaXR5IGZvciBzdHJvbmcgYWN0dWF0b3JzIGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIGludGVuc2l0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMud2Vha01hZ25pdHVkZV0gLSBJbnRlbnNpdHkgZm9yIHdlYWsgYWN0dWF0b3JzIGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIGludGVuc2l0eS5cbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gUmV0dXJuIGEgUHJvbWlzZSByZXN1bHRpbmcgaW4gdHJ1ZSBpZiB0aGUgcHVsc2Ugd2FzIHN1Y2Nlc3NmdWxseSBjb21wbGV0ZWQuXG4gICAgICovXG4gICAgYXN5bmMgcHVsc2UoaW50ZW5zaXR5LCBkdXJhdGlvbiwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBhY3R1YXRvcnMgPSB0aGlzLnBhZC52aWJyYXRpb25BY3R1YXRvciA/IFt0aGlzLnBhZC52aWJyYXRpb25BY3R1YXRvcl0gOiB0aGlzLnBhZC5oYXB0aWNBY3R1YXRvcnMgfHwgZHVtbXlBcnJheTtcblxuICAgICAgICBpZiAoYWN0dWF0b3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3Qgc3RhcnREZWxheSA9IG9wdGlvbnM/LnN0YXJ0RGVsYXkgPz8gMDtcbiAgICAgICAgICAgIGNvbnN0IHN0cm9uZ01hZ25pdHVkZSA9IG9wdGlvbnM/LnN0cm9uZ01hZ25pdHVkZSA/PyBpbnRlbnNpdHk7XG4gICAgICAgICAgICBjb25zdCB3ZWFrTWFnbml0dWRlID0gb3B0aW9ucz8ud2Vha01hZ25pdHVkZSA/PyBpbnRlbnNpdHk7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgICAgICBhY3R1YXRvcnMubWFwKGFzeW5jIChhY3R1YXRvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFjdHVhdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChhY3R1YXRvci5wbGF5RWZmZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWN0dWF0b3IucGxheUVmZmVjdChhY3R1YXRvci50eXBlLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnREZWxheSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJvbmdNYWduaXR1ZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2Vha01hZ25pdHVkZVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0dWF0b3IucHVsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNsZWVwKHN0YXJ0RGVsYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjdHVhdG9yLnB1bHNlKGludGVuc2l0eSwgZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0cy5zb21lKHIgPT4gciA9PT0gdHJ1ZSB8fCByID09PSAnY29tcGxldGUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZSBhIGJ1dHRvbiBmcm9tIGl0cyBpbmRleC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCB0byByZXR1cm4gdGhlIGJ1dHRvbiBmb3IuXG4gICAgICogQHJldHVybnMge0dhbWVQYWRCdXR0b259IFRoZSBidXR0b24gZm9yIHRoZSBzZWFyY2hlZCBpbmRleC4gTWF5IGJlIGEgcGxhY2Vob2xkZXIgaWYgbm9uZSBmb3VuZC5cbiAgICAgKi9cbiAgICBnZXRCdXR0b24oaW5kZXgpIHtcbiAgICAgICAgY29uc3QgYnV0dG9uID0gdGhpcy5fY29tcGlsZWRNYXBwaW5nLmJ1dHRvbnNbaW5kZXhdO1xuICAgICAgICByZXR1cm4gYnV0dG9uID8gYnV0dG9uKCkgOiBkdW1teUJ1dHRvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGJ1dHRvbiBpcyBwcmVzc2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gdGVzdCwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0ZBQ0VfMX0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYnV0dG9uIGlzIHByZXNzZWQuXG4gICAgICovXG4gICAgaXNQcmVzc2VkKGJ1dHRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRCdXR0b24oYnV0dG9uKS5wcmVzc2VkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0cnVlIGlmIHRoZSBidXR0b24gd2FzIHByZXNzZWQgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gdGVzdCwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0ZBQ0VfMX0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJuIHRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcHJlc3NlZCwgZmFsc2UgaWYgbm90LlxuICAgICAqL1xuICAgIHdhc1ByZXNzZWQoYnV0dG9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldEJ1dHRvbihidXR0b24pLndhc1ByZXNzZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcmVsZWFzZWQgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gdGVzdCwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0ZBQ0VfMX0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJuIHRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcmVsZWFzZWQsIGZhbHNlIGlmIG5vdC5cbiAgICAgKi9cbiAgICB3YXNSZWxlYXNlZChidXR0b24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QnV0dG9uKGJ1dHRvbikud2FzUmVsZWFzZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBidXR0b24gaXMgdG91Y2hlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBidXR0b24gLSBUaGUgYnV0dG9uIHRvIHRlc3QsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9GQUNFXzF9LCBldGMuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGJ1dHRvbiBpcyB0b3VjaGVkLlxuICAgICAqL1xuICAgIGlzVG91Y2hlZChidXR0b24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QnV0dG9uKGJ1dHRvbikudG91Y2hlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdHJ1ZSBpZiB0aGUgYnV0dG9uIHdhcyB0b3VjaGVkIHNpbmNlIHRoZSBsYXN0IHVwZGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBidXR0b24gLSBUaGUgYnV0dG9uIHRvIHRlc3QsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9GQUNFXzF9LCBldGMuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybiB0cnVlIGlmIHRoZSBidXR0b24gd2FzIHRvdWNoZWQsIGZhbHNlIGlmIG5vdC5cbiAgICAgKi9cbiAgICB3YXNUb3VjaGVkKGJ1dHRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRCdXR0b24oYnV0dG9uKS53YXNUb3VjaGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHZhbHVlIG9mIGEgYnV0dG9uIGJldHdlZW4gMCBhbmQgMSwgd2l0aCAwIHJlcHJlc2VudGluZyBhIGJ1dHRvbiB0aGF0IGlzIG5vdCBwcmVzc2VkLCBhbmQgMSByZXByZXNlbnRpbmcgYSBidXR0b24gdGhhdCBpcyBmdWxseSBwcmVzc2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gcmV0cmlldmUsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9GQUNFXzF9LCBldGMuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIHZhbHVlIG9mIHRoZSBidXR0b24gYmV0d2VlbiAwIGFuZCAxLlxuICAgICAqL1xuICAgIGdldFZhbHVlKGJ1dHRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRCdXR0b24oYnV0dG9uKS52YWx1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHZhbHVlIG9mIG9uZSBvZiB0aGUgYW5hbG9nIGF4ZXMgb2YgdGhlIHBhZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBheGlzIC0gVGhlIGF4aXMgdG8gZ2V0IHRoZSB2YWx1ZSBvZiwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0xfU1RJQ0tfWH0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgdmFsdWUgb2YgdGhlIGF4aXMgYmV0d2VlbiAtMSBhbmQgMS5cbiAgICAgKi9cbiAgICBnZXRBeGlzKGF4aXMpIHtcbiAgICAgICAgY29uc3QgYSA9IHRoaXMuYXhlc1theGlzXTtcbiAgICAgICAgcmV0dXJuIGEgJiYgTWF0aC5hYnMoYSkgPiBkZWFkWm9uZSA/IGEgOiAwO1xuICAgIH1cbn1cblxuLyoqXG4gKiBJbnB1dCBoYW5kbGVyIGZvciBhY2Nlc3NpbmcgR2FtZVBhZCBpbnB1dC5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEdhbWVQYWRzIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgR2FtZVBhZHMgaW5zdGFuY2UuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdoZXRoZXIgZ2FtZXBhZHMgYXJlIHN1cHBvcnRlZCBieSB0aGlzIGRldmljZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdhbWVwYWRzU3VwcG9ydGVkID0gcGxhdGZvcm0uZ2FtZXBhZHM7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBsaXN0IG9mIGN1cnJlbnQgZ2FtZXBhZHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtHYW1lUGFkW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN1cnJlbnQgPSBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGxpc3Qgb2YgcHJldmlvdXMgYnV0dG9ucyBzdGF0ZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW5bXVtdfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9wcmV2aW91cyA9IFtdO1xuXG4gICAgICAgIHRoaXMuX29uZ2FtZXBhZGNvbm5lY3RlZEhhbmRsZXIgPSB0aGlzLl9vbmdhbWVwYWRjb25uZWN0ZWQuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb25nYW1lcGFkZGlzY29ubmVjdGVkSGFuZGxlciA9IHRoaXMuX29uZ2FtZXBhZGRpc2Nvbm5lY3RlZC5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdnYW1lcGFkY29ubmVjdGVkJywgdGhpcy5fb25nYW1lcGFkY29ubmVjdGVkSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZ2FtZXBhZGRpc2Nvbm5lY3RlZCcsIHRoaXMuX29uZ2FtZXBhZGRpc2Nvbm5lY3RlZEhhbmRsZXIsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLnBvbGwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgZ2FtZXBhZCBpcyBjb25uZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgR2FtZVBhZHMjZ2FtZXBhZGNvbm5lY3RlZFxuICAgICAqIEBwYXJhbSB7R2FtZVBhZH0gZ2FtZXBhZCAtIFRoZSBnYW1lcGFkIHRoYXQgd2FzIGp1c3QgY29ubmVjdGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgb25QYWRDb25uZWN0ZWQgPSBmdW5jdGlvbiAocGFkKSB7XG4gICAgICogICAgIGlmICghcGFkLm1hcHBpbmcpIHtcbiAgICAgKiAgICAgICAgIC8vIE1hcCB0aGUgZ2FtZXBhZCBhcyB0aGUgc3lzdGVtIGNvdWxkIG5vdCBmaW5kIHRoZSBwcm9wZXIgbWFwLlxuICAgICAqICAgICB9IGVsc2Uge1xuICAgICAqICAgICAgICAgLy8gTWFrZSB0aGUgZ2FtZXBhZCBwdWxzZS5cbiAgICAgKiAgICAgfVxuICAgICAqIH07XG4gICAgICogYXBwLmtleWJvYXJkLm9uKFwiZ2FtZXBhZGNvbm5lY3RlZFwiLCBvblBhZENvbm5lY3RlZCwgdGhpcyk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgZ2FtZXBhZCBpcyBkaXNjb25uZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgR2FtZVBhZHMjZ2FtZXBhZGRpc2Nvbm5lY3RlZFxuICAgICAqIEBwYXJhbSB7R2FtZVBhZH0gZ2FtZXBhZCAtIFRoZSBnYW1lcGFkIHRoYXQgd2FzIGp1c3QgZGlzY29ubmVjdGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgb25QYWREaXNjb25uZWN0ZWQgPSBmdW5jdGlvbiAocGFkKSB7XG4gICAgICogICAgIC8vIFBhdXNlIHRoZSBnYW1lLlxuICAgICAqIH07XG4gICAgICogYXBwLmtleWJvYXJkLm9uKFwiZ2FtZXBhZGRpc2Nvbm5lY3RlZFwiLCBvblBhZERpc2Nvbm5lY3RlZCwgdGhpcyk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBUaHJlc2hvbGQgZm9yIGF4ZXMgdG8gcmV0dXJuIHZhbHVlcy4gTXVzdCBiZSBiZXR3ZWVuIDAgYW5kIDEuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBzZXQgZGVhZFpvbmUodmFsdWUpIHtcbiAgICAgICAgZGVhZFpvbmUgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgZGVhZFpvbmUoKSB7XG4gICAgICAgIHJldHVybiBkZWFkWm9uZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbGlzdCBvZiBwcmV2aW91cyBidXR0b25zIHN0YXRlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFuW11bXX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgZ2V0IHByZXZpb3VzKCkge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5jdXJyZW50O1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gY3VycmVudC5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1dHRvbnMgPSBjdXJyZW50W2ldLl9idXR0b25zO1xuXG4gICAgICAgICAgICBpZiAoIXRoaXMuX3ByZXZpb3VzW2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcHJldmlvdXNbaV0gPSBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDAsIG0gPSBidXR0b25zLmxlbmd0aDsgaiA8IG07IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJ1dHRvbiA9IGJ1dHRvbnNbaV07XG4gICAgICAgICAgICAgICAgdGhpcy5wcmV2aW91c1tpXVtqXSA9IGJ1dHRvbiA/ICFidXR0b24ud2FzUHJlc3NlZCAmJiBidXR0b24ucHJlc3NlZCB8fCBidXR0b24ud2FzUmVsZWFzZWQgOiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3ByZXZpb3VzLmxlbmd0aCA9IHRoaXMuY3VycmVudC5sZW5ndGg7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcmV2aW91cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsYmFjayBmdW5jdGlvbiB3aGVuIGEgZ2FtZXBhZCBpcyBjb25uZWN0aW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHYW1lcGFkRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50IGNvbnRhaW5pbmcgdGhlIGNvbm5lY3RpbmcgZ2FtZXBhZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbmdhbWVwYWRjb25uZWN0ZWQoZXZlbnQpIHtcbiAgICAgICAgY29uc3QgcGFkID0gbmV3IEdhbWVQYWQoZXZlbnQuZ2FtZXBhZCwgdGhpcy5nZXRNYXAoZXZlbnQuZ2FtZXBhZCkpO1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5jdXJyZW50O1xuXG4gICAgICAgIGxldCBwYWRJbmRleCA9IGN1cnJlbnQuZmluZEluZGV4KGdwID0+IGdwLmluZGV4ID09PSBwYWQuaW5kZXgpO1xuICAgICAgICB3aGlsZSAocGFkSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICBjdXJyZW50LnNwbGljZShwYWRJbmRleCwgMSk7XG4gICAgICAgICAgICBwYWRJbmRleCA9IGN1cnJlbnQuZmluZEluZGV4KGdwID0+IGdwLmluZGV4ID09PSBwYWQuaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY3VycmVudC5wdXNoKHBhZCk7XG4gICAgICAgIHRoaXMuZmlyZShFVkVOVF9HQU1FUEFEQ09OTkVDVEVELCBwYWQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxiYWNrIGZ1bmN0aW9uIHdoZW4gYSBnYW1lcGFkIGlzIGRpc2Nvbm5lY3RpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dhbWVwYWRFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgY29udGFpbmluZyB0aGUgZGlzY29ubmVjdGluZyBnYW1lcGFkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uZ2FtZXBhZGRpc2Nvbm5lY3RlZChldmVudCkge1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gdGhpcy5jdXJyZW50O1xuICAgICAgICBjb25zdCBwYWRJbmRleCA9IGN1cnJlbnQuZmluZEluZGV4KGdwID0+IGdwLmluZGV4ID09PSBldmVudC5nYW1lcGFkLmluZGV4KTtcblxuICAgICAgICBpZiAocGFkSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLmZpcmUoRVZFTlRfR0FNRVBBRERJU0NPTk5FQ1RFRCwgY3VycmVudFtwYWRJbmRleF0pO1xuICAgICAgICAgICAgY3VycmVudC5zcGxpY2UocGFkSW5kZXgsIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSBwcmV2aW91cyBzdGF0ZSBvZiB0aGUgZ2FtZXBhZHMuIFRoaXMgbXVzdCBiZSBjYWxsZWQgZXZlcnkgZnJhbWUgZm9yXG4gICAgICogYHdhc1ByZXNzZWRgIGFuZCBgd2FzVG91Y2hlZGAgdG8gd29yay5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoKSB7XG4gICAgICAgIHRoaXMucG9sbCgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFBvbGwgZm9yIHRoZSBsYXRlc3QgZGF0YSBmcm9tIHRoZSBnYW1lcGFkIEFQSS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R2FtZVBhZFtdfSBbcGFkc10gLSBBbiBvcHRpb25hbCBhcnJheSB1c2VkIHRvIHJlY2VpdmUgdGhlIGdhbWVwYWRzIG1hcHBpbmcuIFRoaXNcbiAgICAgKiBhcnJheSB3aWxsIGJlIHJldHVybmVkIGJ5IHRoaXMgZnVuY3Rpb24uXG4gICAgICogQHJldHVybnMge0dhbWVQYWRbXX0gQW4gYXJyYXkgb2YgZ2FtZXBhZHMgYW5kIG1hcHBpbmdzIGZvciB0aGUgbW9kZWwgb2YgZ2FtZXBhZCB0aGF0IGlzXG4gICAgICogYXR0YWNoZWQuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBnYW1lcGFkcyA9IG5ldyBwYy5HYW1lUGFkcygpO1xuICAgICAqIGNvbnN0IHBhZHMgPSBnYW1lcGFkcy5wb2xsKCk7XG4gICAgICovXG4gICAgcG9sbChwYWRzID0gW10pIHtcbiAgICAgICAgaWYgKHBhZHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcGFkcy5sZW5ndGggPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGFkRGV2aWNlcyA9IGdldEdhbWVwYWRzKCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHBhZERldmljZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChwYWREZXZpY2VzW2ldKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFkID0gdGhpcy5maW5kQnlJbmRleChwYWREZXZpY2VzW2ldLmluZGV4KTtcblxuICAgICAgICAgICAgICAgIGlmIChwYWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGFkcy5wdXNoKHBhZC51cGRhdGUocGFkRGV2aWNlc1tpXSkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5QYWQgPSBuZXcgR2FtZVBhZChwYWREZXZpY2VzW2ldLCB0aGlzLmdldE1hcChwYWREZXZpY2VzW2ldKSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudC5wdXNoKG5QYWQpO1xuICAgICAgICAgICAgICAgICAgICBwYWRzLnB1c2goblBhZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHBhZHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSB0aGUgZXZlbnQgbGlzdGVuZXJzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdnYW1lcGFkY29ubmVjdGVkJywgdGhpcy5fb25nYW1lcGFkY29ubmVjdGVkSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignZ2FtZXBhZGRpc2Nvbm5lY3RlZCcsIHRoaXMuX29uZ2FtZXBhZGRpc2Nvbm5lY3RlZEhhbmRsZXIsIGZhbHNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZSB0aGUgb3JkZXIgZm9yIGJ1dHRvbnMgYW5kIGF4ZXMgZm9yIGdpdmVuIEhUTUw1IEdhbWVwYWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dhbWVwYWR9IHBhZCAtIFRoZSBIVE1MNSBHYW1lcGFkIG9iamVjdC5cbiAgICAgKiBAcmV0dXJucyB7b2JqZWN0fSBPYmplY3QgZGVmaW5pbmcgdGhlIG9yZGVyIG9mIGJ1dHRvbnMgYW5kIGF4ZXMgZm9yIGdpdmVuIEhUTUw1IEdhbWVwYWQuXG4gICAgICovXG4gICAgZ2V0TWFwKHBhZCkge1xuICAgICAgICByZXR1cm4gZ2V0TWFwKHBhZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBidXR0b24gb24gdGhlIHBhZCByZXF1ZXN0ZWQgaXMgcHJlc3NlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBvcmRlckluZGV4IC0gVGhlIG9yZGVyIGluZGV4IG9mIHRoZSBwYWQgdG8gY2hlY2ssIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF8xfSwge0BsaW5rIFBBRF8yfSwgZXRjLiBGb3IgZ2FtZXBhZCBpbmRleCBjYWxsIHRoZSBmdW5jdGlvbiBmcm9tIHRoZSBwYWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gdGVzdCwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0ZBQ0VfMX0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYnV0dG9uIGlzIHByZXNzZWQuXG4gICAgICovXG4gICAgaXNQcmVzc2VkKG9yZGVySW5kZXgsIGJ1dHRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50W29yZGVySW5kZXhdPy5pc1ByZXNzZWQoYnV0dG9uKSB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcHJlc3NlZCBzaW5jZSB0aGUgbGFzdCBmcmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBvcmRlckluZGV4IC0gVGhlIGluZGV4IG9mIHRoZSBwYWQgdG8gY2hlY2ssIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF8xfSwge0BsaW5rIFBBRF8yfSwgZXRjLiBGb3IgZ2FtZXBhZCBpbmRleCBjYWxsIHRoZSBmdW5jdGlvbiBmcm9tIHRoZSBwYWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gdGVzdCwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0ZBQ0VfMX0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYnV0dG9uIHdhcyBwcmVzc2VkIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqL1xuICAgIHdhc1ByZXNzZWQob3JkZXJJbmRleCwgYnV0dG9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmN1cnJlbnRbb3JkZXJJbmRleF0/Lndhc1ByZXNzZWQoYnV0dG9uKSB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcmVsZWFzZWQgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3JkZXJJbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgcGFkIHRvIGNoZWNrLCB1c2UgY29uc3RhbnRzIHtAbGluayBQQURfMX0sIHtAbGluayBQQURfMn0sIGV0Yy4gRm9yIGdhbWVwYWQgaW5kZXggY2FsbCB0aGUgZnVuY3Rpb24gZnJvbSB0aGUgcGFkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBidXR0b24gLSBUaGUgYnV0dG9uIHRvIHRlc3QsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9GQUNFXzF9LCBldGMuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcmVsZWFzZWQgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICovXG4gICAgd2FzUmVsZWFzZWQob3JkZXJJbmRleCwgYnV0dG9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmN1cnJlbnRbb3JkZXJJbmRleF0/Lndhc1JlbGVhc2VkKGJ1dHRvbikgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSB2YWx1ZSBvZiBvbmUgb2YgdGhlIGFuYWxvZyBheGVzIG9mIHRoZSBwYWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3JkZXJJbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgcGFkIHRvIGNoZWNrLCB1c2UgY29uc3RhbnRzIHtAbGluayBQQURfMX0sIHtAbGluayBQQURfMn0sIGV0Yy4gRm9yIGdhbWVwYWQgaW5kZXggY2FsbCB0aGUgZnVuY3Rpb24gZnJvbSB0aGUgcGFkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBheGlzIC0gVGhlIGF4aXMgdG8gZ2V0IHRoZSB2YWx1ZSBvZiwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0xfU1RJQ0tfWH0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgdmFsdWUgb2YgdGhlIGF4aXMgYmV0d2VlbiAtMSBhbmQgMS5cbiAgICAgKi9cbiAgICBnZXRBeGlzKG9yZGVySW5kZXgsIGF4aXMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VycmVudFtvcmRlckluZGV4XT8uZ2V0QXhpcyhheGlzKSB8fCAwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1ha2UgdGhlIGdhbWVwYWQgdmlicmF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBvcmRlckluZGV4IC0gVGhlIGluZGV4IG9mIHRoZSBwYWQgdG8gY2hlY2ssIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF8xfSwge0BsaW5rIFBBRF8yfSwgZXRjLiBGb3IgZ2FtZXBhZCBpbmRleCBjYWxsIHRoZSBmdW5jdGlvbiBmcm9tIHRoZSBwYWQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGludGVuc2l0eSAtIEludGVuc2l0eSBmb3IgdGhlIHZpYnJhdGlvbiBpbiB0aGUgcmFuZ2UgMCB0byAxLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkdXJhdGlvbiAtIER1cmF0aW9uIGZvciB0aGUgdmlicmF0aW9uIGluIG1pbGxpc2Vjb25kcy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9ucyBmb3Igc3BlY2lhbCB2aWJyYXRpb24gcGF0dGVybi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3RhcnREZWxheV0gLSBEZWxheSBiZWZvcmUgdGhlIHBhdHRlcm4gc3RhcnRzLCBpbiBtaWxsaXNlY29uZHMuIERlZmF1bHRzIHRvIDAuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0cm9uZ01hZ25pdHVkZV0gLSBJbnRlbnNpdHkgZm9yIHN0cm9uZyBhY3R1YXRvcnMgaW4gdGhlIHJhbmdlIDAgdG8gMS4gRGVmYXVsdHMgdG8gaW50ZW5zaXR5LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy53ZWFrTWFnbml0dWRlXSAtIEludGVuc2l0eSBmb3Igd2VhayBhY3R1YXRvcnMgaW4gdGhlIHJhbmdlIDAgdG8gMS4gRGVmYXVsdHMgdG8gaW50ZW5zaXR5LlxuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPGJvb2xlYW4+fSBSZXR1cm4gYSBQcm9taXNlIHJlc3VsdGluZyBpbiB0cnVlIGlmIHRoZSBwdWxzZSB3YXMgc3VjY2Vzc2Z1bGx5IGNvbXBsZXRlZC5cbiAgICAgKi9cbiAgICBwdWxzZShvcmRlckluZGV4LCBpbnRlbnNpdHksIGR1cmF0aW9uLCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IHBhZCA9IHRoaXMuY3VycmVudFtvcmRlckluZGV4XTtcbiAgICAgICAgcmV0dXJuIHBhZCA/IHBhZC5wdWxzZShpbnRlbnNpdHksIGR1cmF0aW9uLCBvcHRpb25zKSA6IFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFrZSBhbGwgZ2FtZXBhZHMgdmlicmF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbnRlbnNpdHkgLSBJbnRlbnNpdHkgZm9yIHRoZSB2aWJyYXRpb24gaW4gdGhlIHJhbmdlIDAgdG8gMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHVyYXRpb24gLSBEdXJhdGlvbiBmb3IgdGhlIHZpYnJhdGlvbiBpbiBtaWxsaXNlY29uZHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbnMgZm9yIHNwZWNpYWwgdmlicmF0aW9uIHBhdHRlcm4uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0RGVsYXldIC0gRGVsYXkgYmVmb3JlIHRoZSBwYXR0ZXJuIHN0YXJ0cywgaW4gbWlsbGlzZWNvbmRzLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdHJvbmdNYWduaXR1ZGVdIC0gSW50ZW5zaXR5IGZvciBzdHJvbmcgYWN0dWF0b3JzIGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIGludGVuc2l0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMud2Vha01hZ25pdHVkZV0gLSBJbnRlbnNpdHkgZm9yIHdlYWsgYWN0dWF0b3JzIGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIGludGVuc2l0eS5cbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuW10+fSBSZXR1cm4gYSBQcm9taXNlIHJlc3VsdGluZyBpbiBhbiBhcnJheSBvZiBib29sZWFucyBkZWZpbmluZyBpZiB0aGUgcHVsc2Ugd2FzIHN1Y2Nlc3NmdWxseSBjb21wbGV0ZWQgZm9yIGV2ZXJ5IGdhbWVwYWRzLlxuICAgICAqL1xuICAgIHB1bHNlQWxsKGludGVuc2l0eSwgZHVyYXRpb24sIG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKFxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Lm1hcChwYWQgPT4gcGFkLnB1bHNlKGludGVuc2l0eSwgZHVyYXRpb24sIG9wdGlvbnMpKVxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmQgYSBjb25uZWN0ZWQge0BsaW5rIEdhbWVQYWR9IGZyb20gaXRzIGlkZW50aWZpZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gaWQgLSBUaGUgaWRlbnRpZmllciB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtHYW1lUGFkfG51bGx9IFRoZSB7QGxpbmsgR2FtZVBhZH0gd2l0aCB0aGUgbWF0Y2hpbmcgaWRlbnRpZmllciBvciBudWxsIGlmIG5vIGdhbWVwYWQgaXMgZm91bmQgb3IgdGhlIGdhbWVwYWQgaXMgbm90IGNvbm5lY3RlZC5cbiAgICAgKi9cbiAgICBmaW5kQnlJZChpZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50LmZpbmQoZ3AgPT4gZ3AgJiYgZ3AuaWQgPT09IGlkKSB8fCBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpbmQgYSBjb25uZWN0ZWQge0BsaW5rIEdhbWVQYWR9IGZyb20gaXRzIGRldmljZSBpbmRleC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBkZXZpY2UgaW5kZXggdG8gc2VhcmNoIGZvci5cbiAgICAgKiBAcmV0dXJucyB7R2FtZVBhZHxudWxsfSBUaGUge0BsaW5rIEdhbWVQYWR9IHdpdGggdGhlIG1hdGNoaW5nIGRldmljZSBpbmRleCBvciBudWxsIGlmIG5vIGdhbWVwYWQgaXMgZm91bmQgb3IgdGhlIGdhbWVwYWQgaXMgbm90IGNvbm5lY3RlZC5cbiAgICAgKi9cbiAgICBmaW5kQnlJbmRleChpbmRleCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50LmZpbmQoZ3AgPT4gZ3AgJiYgZ3AuaW5kZXggPT09IGluZGV4KSB8fCBudWxsO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgR2FtZVBhZHMsIEdhbWVQYWQsIEdhbWVQYWRCdXR0b24gfTtcbiJdLCJuYW1lcyI6WyJkdW1teUFycmF5IiwiT2JqZWN0IiwiZnJlZXplIiwiZ2V0R2FtZXBhZHMiLCJuYXZpZ2F0b3IiLCJ3ZWJraXRHZXRHYW1lcGFkcyIsImJpbmQiLCJNQVBTX0lOREVYRVMiLCJidXR0b25zIiwiUEFEX0ZBQ0VfMSIsIlBBRF9GQUNFXzIiLCJQQURfRkFDRV8zIiwiUEFEX0ZBQ0VfNCIsIlBBRF9MX1NIT1VMREVSXzEiLCJQQURfUl9TSE9VTERFUl8xIiwiUEFEX0xfU0hPVUxERVJfMiIsIlBBRF9SX1NIT1VMREVSXzIiLCJQQURfU0VMRUNUIiwiUEFEX1NUQVJUIiwiUEFEX0xfU1RJQ0tfQlVUVE9OIiwiUEFEX1JfU1RJQ0tfQlVUVE9OIiwiUEFEX1VQIiwiUEFEX0RPV04iLCJQQURfTEVGVCIsIlBBRF9SSUdIVCIsIlBBRF9WRU5ET1IiLCJYUlBBRF9UUklHR0VSIiwiWFJQQURfU1FVRUVaRSIsIlhSUEFEX1RPVUNIUEFEX0JVVFRPTiIsIlhSUEFEX1NUSUNLX0JVVFRPTiIsIlhSUEFEX0EiLCJYUlBBRF9CIiwiYXhlcyIsIlBBRF9MX1NUSUNLX1giLCJQQURfTF9TVElDS19ZIiwiUEFEX1JfU1RJQ0tfWCIsIlBBRF9SX1NUSUNLX1kiLCJYUlBBRF9UT1VDSFBBRF9YIiwiWFJQQURfVE9VQ0hQQURfWSIsIlhSUEFEX1NUSUNLX1giLCJYUlBBRF9TVElDS19ZIiwiTUFQUyIsIkRFRkFVTFQiLCJERUZBVUxUX0RVQUwiLCJzeW50aGVzaXplZEJ1dHRvbnMiLCJheGlzIiwibWluIiwibWF4IiwiUFMzIiwibWFwcGluZyIsIkRFRkFVTFRfWFIiLCJQUk9EVUNUX0NPREVTIiwiY3VzdG9tX21hcHMiLCJnZXRNYXAiLCJwYWQiLCJjdXN0b20iLCJpZCIsImNvZGUiLCJpbmRleE9mIiwicHJvZHVjdCIsInJhdyIsImRlZmF1bHRtYXAiLCJtYXAiLCJsZW5ndGgiLCJkZWFkWm9uZSIsInNsZWVwIiwibXMiLCJQcm9taXNlIiwicmVzb2x2ZSIsInNldFRpbWVvdXQiLCJHYW1lUGFkQnV0dG9uIiwiY29uc3RydWN0b3IiLCJjdXJyZW50IiwicHJldmlvdXMiLCJ2YWx1ZSIsInByZXNzZWQiLCJ0b3VjaGVkIiwid2FzUHJlc3NlZCIsIndhc1JlbGVhc2VkIiwid2FzVG91Y2hlZCIsIl9jdXJyZW50JHRvdWNoZWQiLCJfcHJldmlvdXMkdG91Y2hlZCIsInVwZGF0ZSIsImJ1dHRvbiIsIl9idXR0b24kdG91Y2hlZCIsImR1bW15QnV0dG9uIiwiR2FtZVBhZCIsImdhbWVwYWQiLCJfY29tcGlsZWRNYXBwaW5nIiwiaW5kZXgiLCJfYnV0dG9ucyIsImIiLCJfYXhlcyIsIl9wcmV2aW91c0F4ZXMiLCJoYW5kIiwiX2NvbXBpbGVNYXBwaW5nIiwiY29ubmVjdGVkIiwiYXhlc0luZGV4ZXMiLCJidXR0b25zSW5kZXhlcyIsImF4ZXNNYXAiLCJmb3JFYWNoIiwiaSIsImwiLCJidXR0b25zTWFwIiwic3ludGhlc2l6ZWRCdXR0b25zTWFwIiwiZW50cmllcyIsIl90aGlzJF9heGVzJGF4aXMiLCJfdGhpcyRfcHJldmlvdXNBeGVzJGEiLCJNYXRoIiwiYWJzIiwibWF0aCIsImNsYW1wIiwicHJldmlvdXNBeGVzIiwicHVzaCIsInVwZGF0ZU1hcCIsInJlc2V0TWFwIiwiYSIsInB1bHNlIiwiaW50ZW5zaXR5IiwiZHVyYXRpb24iLCJvcHRpb25zIiwiYWN0dWF0b3JzIiwidmlicmF0aW9uQWN0dWF0b3IiLCJoYXB0aWNBY3R1YXRvcnMiLCJfb3B0aW9ucyRzdGFydERlbGF5IiwiX29wdGlvbnMkc3Ryb25nTWFnbml0IiwiX29wdGlvbnMkd2Vha01hZ25pdHVkIiwic3RhcnREZWxheSIsInN0cm9uZ01hZ25pdHVkZSIsIndlYWtNYWduaXR1ZGUiLCJyZXN1bHRzIiwiYWxsIiwiYWN0dWF0b3IiLCJwbGF5RWZmZWN0IiwidHlwZSIsInNvbWUiLCJyIiwiZ2V0QnV0dG9uIiwiaXNQcmVzc2VkIiwiaXNUb3VjaGVkIiwiZ2V0VmFsdWUiLCJnZXRBeGlzIiwiR2FtZVBhZHMiLCJFdmVudEhhbmRsZXIiLCJnYW1lcGFkc1N1cHBvcnRlZCIsInBsYXRmb3JtIiwiZ2FtZXBhZHMiLCJfcHJldmlvdXMiLCJfb25nYW1lcGFkY29ubmVjdGVkSGFuZGxlciIsIl9vbmdhbWVwYWRjb25uZWN0ZWQiLCJfb25nYW1lcGFkZGlzY29ubmVjdGVkSGFuZGxlciIsIl9vbmdhbWVwYWRkaXNjb25uZWN0ZWQiLCJ3aW5kb3ciLCJhZGRFdmVudExpc3RlbmVyIiwicG9sbCIsImoiLCJtIiwiZXZlbnQiLCJwYWRJbmRleCIsImZpbmRJbmRleCIsImdwIiwic3BsaWNlIiwiZmlyZSIsIkVWRU5UX0dBTUVQQURDT05ORUNURUQiLCJFVkVOVF9HQU1FUEFERElTQ09OTkVDVEVEIiwicGFkcyIsInBhZERldmljZXMiLCJsZW4iLCJmaW5kQnlJbmRleCIsIm5QYWQiLCJkZXN0cm95IiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsIm9yZGVySW5kZXgiLCJfdGhpcyRjdXJyZW50JG9yZGVySW4iLCJfdGhpcyRjdXJyZW50JG9yZGVySW4yIiwiX3RoaXMkY3VycmVudCRvcmRlckluMyIsIl90aGlzJGN1cnJlbnQkb3JkZXJJbjQiLCJwdWxzZUFsbCIsImZpbmRCeUlkIiwiZmluZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFLQSxNQUFNQSxVQUFVLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLEVBQUUs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
