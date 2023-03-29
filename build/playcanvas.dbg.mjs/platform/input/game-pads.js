/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
   * The value for the button between 0 and 1, with 0 representing a button that is not pressed, and 1 representing a button that is fully pressed.
   *
   * @type {number}
   */

  /**
   * Whether the button is currently down.
   *
   * @type {boolean}
   */

  /**
   * Whether the button is currently touched.
   *
   * @type {boolean}
   */

  /**
   * Whether the button was pressed.
   *
   * @type {boolean}
   */

  /**
   * Whether the button was released since the last update.
   *
   * @type {boolean}
   */

  /**
   * Whether the button was touched since the last update.
   *
   * @type {boolean}
   */

  /**
   * Create a new GamePadButton instance.
   *
   * @param {number|GamepadButton} current - The original Gamepad API gamepad button.
   * @param {number|GamepadButton} [previous] - The previous Gamepad API gamepad button.
   * @hideconstructor
   */
  constructor(current, previous) {
    this.value = 0;
    this.pressed = false;
    this.touched = false;
    this.wasPressed = false;
    this.wasReleased = false;
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
   * The compiled mapping to reduce lookup delay when retrieving buttons
   *
   * @type {object}
   * @private
   */

  /**
   * Create a new GamePad Instance.
   *
   * @param {Gamepad} gamepad - The original Gamepad API gamepad.
   * @param {object} map - The buttons and axes map.
   * @hideconstructor
   */
  constructor(gamepad, map) {
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
   * var onPadConnected = function (pad) {
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
   * var onPadDisconnected = function (pad) {
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
   * var gamepads = new pc.GamePads();
   * var pads = gamepads.poll();
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2FtZS1wYWRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vaW5wdXQvZ2FtZS1wYWRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uLy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5pbXBvcnQgeyBFVkVOVF9HQU1FUEFEQ09OTkVDVEVELCBFVkVOVF9HQU1FUEFERElTQ09OTkVDVEVELCBQQURfRkFDRV8xLCBQQURfRkFDRV8yLCBQQURfRkFDRV8zLCBQQURfRkFDRV80LCBQQURfTF9TSE9VTERFUl8xLCBQQURfUl9TSE9VTERFUl8xLCBQQURfTF9TSE9VTERFUl8yLCBQQURfUl9TSE9VTERFUl8yLCBQQURfU0VMRUNULCBQQURfU1RBUlQsIFBBRF9MX1NUSUNLX0JVVFRPTiwgUEFEX1JfU1RJQ0tfQlVUVE9OLCBQQURfVVAsIFBBRF9ET1dOLCBQQURfTEVGVCwgUEFEX1JJR0hULCBQQURfVkVORE9SLCBYUlBBRF9UUklHR0VSLCBYUlBBRF9TUVVFRVpFLCBYUlBBRF9UT1VDSFBBRF9CVVRUT04sIFhSUEFEX1NUSUNLX0JVVFRPTiwgWFJQQURfQSwgWFJQQURfQiwgUEFEX0xfU1RJQ0tfWCwgUEFEX0xfU1RJQ0tfWSwgUEFEX1JfU1RJQ0tfWCwgUEFEX1JfU1RJQ0tfWSwgWFJQQURfVE9VQ0hQQURfWCwgWFJQQURfVE9VQ0hQQURfWSwgWFJQQURfU1RJQ0tfWCwgWFJQQURfU1RJQ0tfWSB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uL2NvcmUvcGxhdGZvcm0uanMnO1xuXG5jb25zdCBkdW1teUFycmF5ID0gT2JqZWN0LmZyZWV6ZShbXSk7XG5cbi8qKlxuICogR2V0IEdhbWVwYWRzIGZyb20gQVBJLlxuICpcbiAqIEB0eXBlIHtGdW5jdGlvbn1cbiAqIEByZXR1cm5zIHtHYW1lcGFkW119IFJldHJpZXZlZCBnYW1lcGFkcyBmcm9tIHRoZSBkZXZpY2UuXG4gKiBAaWdub3JlXG4gKi9cbmxldCBnZXRHYW1lcGFkcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gZHVtbXlBcnJheTtcbn07XG5cbmlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJykge1xuICAgIGdldEdhbWVwYWRzID0gKG5hdmlnYXRvci5nZXRHYW1lcGFkcyB8fCBuYXZpZ2F0b3Iud2Via2l0R2V0R2FtZXBhZHMgfHwgZ2V0R2FtZXBhZHMpLmJpbmQobmF2aWdhdG9yKTtcbn1cblxuY29uc3QgTUFQU19JTkRFWEVTID0ge1xuICAgIGJ1dHRvbnM6IHtcbiAgICAgICAgUEFEX0ZBQ0VfMSxcbiAgICAgICAgUEFEX0ZBQ0VfMixcbiAgICAgICAgUEFEX0ZBQ0VfMyxcbiAgICAgICAgUEFEX0ZBQ0VfNCxcbiAgICAgICAgUEFEX0xfU0hPVUxERVJfMSxcbiAgICAgICAgUEFEX1JfU0hPVUxERVJfMSxcbiAgICAgICAgUEFEX0xfU0hPVUxERVJfMixcbiAgICAgICAgUEFEX1JfU0hPVUxERVJfMixcbiAgICAgICAgUEFEX1NFTEVDVCxcbiAgICAgICAgUEFEX1NUQVJULFxuICAgICAgICBQQURfTF9TVElDS19CVVRUT04sXG4gICAgICAgIFBBRF9SX1NUSUNLX0JVVFRPTixcbiAgICAgICAgUEFEX1VQLFxuICAgICAgICBQQURfRE9XTixcbiAgICAgICAgUEFEX0xFRlQsXG4gICAgICAgIFBBRF9SSUdIVCxcbiAgICAgICAgUEFEX1ZFTkRPUixcbiAgICAgICAgWFJQQURfVFJJR0dFUixcbiAgICAgICAgWFJQQURfU1FVRUVaRSxcbiAgICAgICAgWFJQQURfVE9VQ0hQQURfQlVUVE9OLFxuICAgICAgICBYUlBBRF9TVElDS19CVVRUT04sXG4gICAgICAgIFhSUEFEX0EsXG4gICAgICAgIFhSUEFEX0JcbiAgICB9LFxuICAgIGF4ZXM6IHtcbiAgICAgICAgUEFEX0xfU1RJQ0tfWCxcbiAgICAgICAgUEFEX0xfU1RJQ0tfWSxcbiAgICAgICAgUEFEX1JfU1RJQ0tfWCxcbiAgICAgICAgUEFEX1JfU1RJQ0tfWSxcbiAgICAgICAgWFJQQURfVE9VQ0hQQURfWCxcbiAgICAgICAgWFJQQURfVE9VQ0hQQURfWSxcbiAgICAgICAgWFJQQURfU1RJQ0tfWCxcbiAgICAgICAgWFJQQURfU1RJQ0tfWVxuICAgIH1cbn07XG5cbmNvbnN0IE1BUFMgPSB7XG4gICAgREVGQVVMVDoge1xuICAgICAgICBidXR0b25zOiBbXG4gICAgICAgICAgICAvLyBGYWNlIGJ1dHRvbnNcbiAgICAgICAgICAgICdQQURfRkFDRV8xJyxcbiAgICAgICAgICAgICdQQURfRkFDRV8yJyxcbiAgICAgICAgICAgICdQQURfRkFDRV8zJyxcbiAgICAgICAgICAgICdQQURfRkFDRV80JyxcblxuICAgICAgICAgICAgLy8gU2hvdWxkZXIgYnV0dG9uc1xuICAgICAgICAgICAgJ1BBRF9MX1NIT1VMREVSXzEnLFxuICAgICAgICAgICAgJ1BBRF9SX1NIT1VMREVSXzEnLFxuICAgICAgICAgICAgJ1BBRF9MX1NIT1VMREVSXzInLFxuICAgICAgICAgICAgJ1BBRF9SX1NIT1VMREVSXzInLFxuXG4gICAgICAgICAgICAvLyBPdGhlciBidXR0b25zXG4gICAgICAgICAgICAnUEFEX1NFTEVDVCcsXG4gICAgICAgICAgICAnUEFEX1NUQVJUJyxcbiAgICAgICAgICAgICdQQURfTF9TVElDS19CVVRUT04nLFxuICAgICAgICAgICAgJ1BBRF9SX1NUSUNLX0JVVFRPTicsXG5cbiAgICAgICAgICAgIC8vIEQgUGFkXG4gICAgICAgICAgICAnUEFEX1VQJyxcbiAgICAgICAgICAgICdQQURfRE9XTicsXG4gICAgICAgICAgICAnUEFEX0xFRlQnLFxuICAgICAgICAgICAgJ1BBRF9SSUdIVCcsXG5cbiAgICAgICAgICAgICAvLyBWZW5kb3Igc3BlY2lmaWMgYnV0dG9uXG4gICAgICAgICAgICAnUEFEX1ZFTkRPUidcbiAgICAgICAgXSxcblxuICAgICAgICBheGVzOiBbXG4gICAgICAgICAgICAvLyBBbmFsb2cgU3RpY2tzXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfWScsXG4gICAgICAgICAgICAnUEFEX1JfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnUEFEX1JfU1RJQ0tfWSdcbiAgICAgICAgXVxuICAgIH0sXG5cbiAgICBERUZBVUxUX0RVQUw6IHtcbiAgICAgICAgYnV0dG9uczogW1xuICAgICAgICAgICAgLy8gRmFjZSBidXR0b25zXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMScsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMicsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMycsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfNCcsXG5cbiAgICAgICAgICAgIC8vIFNob3VsZGVyIGJ1dHRvbnNcbiAgICAgICAgICAgICdQQURfTF9TSE9VTERFUl8xJyxcbiAgICAgICAgICAgICdQQURfUl9TSE9VTERFUl8xJyxcbiAgICAgICAgICAgICdQQURfTF9TSE9VTERFUl8yJyxcbiAgICAgICAgICAgICdQQURfUl9TSE9VTERFUl8yJyxcblxuICAgICAgICAgICAgLy8gT3RoZXIgYnV0dG9uc1xuICAgICAgICAgICAgJ1BBRF9TRUxFQ1QnLFxuICAgICAgICAgICAgJ1BBRF9TVEFSVCcsXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfQlVUVE9OJyxcbiAgICAgICAgICAgICdQQURfUl9TVElDS19CVVRUT04nLFxuXG4gICAgICAgICAgICAgLy8gVmVuZG9yIHNwZWNpZmljIGJ1dHRvblxuICAgICAgICAgICAgJ1BBRF9WRU5ET1InXG4gICAgICAgIF0sXG5cbiAgICAgICAgYXhlczogW1xuICAgICAgICAgICAgLy8gQW5hbG9nIFN0aWNrc1xuICAgICAgICAgICAgJ1BBRF9MX1NUSUNLX1gnLFxuICAgICAgICAgICAgJ1BBRF9MX1NUSUNLX1knLFxuICAgICAgICAgICAgJ1BBRF9SX1NUSUNLX1gnLFxuICAgICAgICAgICAgJ1BBRF9SX1NUSUNLX1knXG4gICAgICAgIF0sXG5cbiAgICAgICAgc3ludGhlc2l6ZWRCdXR0b25zOiB7XG4gICAgICAgICAgICBQQURfVVA6IHsgYXhpczogMCwgbWluOiAwLCBtYXg6IDEgfSxcbiAgICAgICAgICAgIFBBRF9ET1dOOiB7IGF4aXM6IDAsIG1pbjogLTEsIG1heDogMCB9LFxuICAgICAgICAgICAgUEFEX0xFRlQ6IHsgYXhpczogMCwgbWluOiAtMSwgbWF4OiAwIH0sXG4gICAgICAgICAgICBQQURfUklHSFQ6IHsgYXhpczogMCwgbWluOiAwLCBtYXg6IDEgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIFBTMzoge1xuICAgICAgICBidXR0b25zOiBbXG4gICAgICAgICAgICAvLyBYLCBPLCBUUkksIFNRXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMScsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMicsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfNCcsXG4gICAgICAgICAgICAnUEFEX0ZBQ0VfMycsXG5cbiAgICAgICAgICAgIC8vIFNob3VsZGVyIGJ1dHRvbnNcbiAgICAgICAgICAgICdQQURfTF9TSE9VTERFUl8xJyxcbiAgICAgICAgICAgICdQQURfUl9TSE9VTERFUl8xJyxcbiAgICAgICAgICAgICdQQURfTF9TSE9VTERFUl8yJyxcbiAgICAgICAgICAgICdQQURfUl9TSE9VTERFUl8yJyxcblxuICAgICAgICAgICAgLy8gT3RoZXIgYnV0dG9uc1xuICAgICAgICAgICAgJ1BBRF9TRUxFQ1QnLFxuICAgICAgICAgICAgJ1BBRF9TVEFSVCcsXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfQlVUVE9OJyxcbiAgICAgICAgICAgICdQQURfUl9TVElDS19CVVRUT04nLFxuXG4gICAgICAgICAgICAvLyBEIFBhZFxuICAgICAgICAgICAgJ1BBRF9VUCcsXG4gICAgICAgICAgICAnUEFEX0RPV04nLFxuICAgICAgICAgICAgJ1BBRF9MRUZUJyxcbiAgICAgICAgICAgICdQQURfUklHSFQnLFxuXG4gICAgICAgICAgICAnUEFEX1ZFTkRPUidcbiAgICAgICAgXSxcblxuICAgICAgICBheGVzOiBbXG4gICAgICAgICAgICAvLyBBbmFsb2cgU3RpY2tzXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnUEFEX0xfU1RJQ0tfWScsXG4gICAgICAgICAgICAnUEFEX1JfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnUEFEX1JfU1RJQ0tfWSdcbiAgICAgICAgXSxcblxuICAgICAgICBtYXBwaW5nOiAnc3RhbmRhcmQnXG4gICAgfSxcblxuICAgIERFRkFVTFRfWFI6IHtcbiAgICAgICAgYnV0dG9uczogW1xuICAgICAgICAgICAgLy8gQmFjayBidXR0b25zXG4gICAgICAgICAgICAnWFJQQURfVFJJR0dFUicsXG4gICAgICAgICAgICAnWFJQQURfU1FVRUVaRScsXG5cbiAgICAgICAgICAgIC8vIEF4ZXMgYnV0dG9uc1xuICAgICAgICAgICAgJ1hSUEFEX1RPVUNIUEFEX0JVVFRPTicsXG4gICAgICAgICAgICAnWFJQQURfU1RJQ0tfQlVUVE9OJyxcblxuICAgICAgICAgICAgLy8gRmFjZSBidXR0b25zXG4gICAgICAgICAgICAnWFJQQURfQScsXG4gICAgICAgICAgICAnWFJQQURfQidcbiAgICAgICAgXSxcblxuICAgICAgICBheGVzOiBbXG4gICAgICAgICAgICAvLyBBbmFsb2cgU3RpY2tzXG4gICAgICAgICAgICAnWFJQQURfVE9VQ0hQQURfWCcsXG4gICAgICAgICAgICAnWFJQQURfVE9VQ0hQQURfWScsXG4gICAgICAgICAgICAnWFJQQURfU1RJQ0tfWCcsXG4gICAgICAgICAgICAnWFJQQURfU1RJQ0tfWSdcbiAgICAgICAgXSxcblxuICAgICAgICBtYXBwaW5nOiAneHItc3RhbmRhcmQnXG4gICAgfVxufTtcblxuY29uc3QgUFJPRFVDVF9DT0RFUyA9IHtcbiAgICAnUHJvZHVjdDogMDI2OCc6ICdQUzMnXG59O1xuXG5jb25zdCBjdXN0b21fbWFwcyA9IHt9O1xuXG4vKipcbiAqIFJldHJpZXZlIHRoZSBvcmRlciBmb3IgYnV0dG9ucyBhbmQgYXhlcyBmb3IgZ2l2ZW4gSFRNTDUgR2FtZXBhZC5cbiAqXG4gKiBAcGFyYW0ge0dhbWVwYWR9IHBhZCAtIFRoZSBIVE1MNSBHYW1lcGFkIG9iamVjdC5cbiAqIEByZXR1cm5zIHtvYmplY3R9IE9iamVjdCBkZWZpbmluZyB0aGUgb3JkZXIgb2YgYnV0dG9ucyBhbmQgYXhlcyBmb3IgZ2l2ZW4gSFRNTDUgR2FtZXBhZC5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gZ2V0TWFwKHBhZCkge1xuICAgIGNvbnN0IGN1c3RvbSA9IGN1c3RvbV9tYXBzW3BhZC5pZF07XG4gICAgaWYgKGN1c3RvbSkge1xuICAgICAgICByZXR1cm4gY3VzdG9tO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgY29kZSBpbiBQUk9EVUNUX0NPREVTKSB7XG4gICAgICAgIGlmIChwYWQuaWQuaW5kZXhPZihjb2RlKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb2R1Y3QgPSBQUk9EVUNUX0NPREVTW2NvZGVdO1xuXG4gICAgICAgICAgICBpZiAoIXBhZC5tYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gTUFQU1snUkFXXycgKyBwcm9kdWN0XTtcblxuICAgICAgICAgICAgICAgIGlmIChyYXcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJhdztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBNQVBTW3Byb2R1Y3RdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBhZC5tYXBwaW5nID09PSAneHItc3RhbmRhcmQnKSB7XG4gICAgICAgIHJldHVybiBNQVBTLkRFRkFVTFRfWFI7XG4gICAgfVxuXG4gICAgY29uc3QgZGVmYXVsdG1hcCA9IE1BUFMuREVGQVVMVDtcbiAgICBjb25zdCBtYXAgPSBwYWQuYnV0dG9ucy5sZW5ndGggPCBkZWZhdWx0bWFwLmJ1dHRvbnMubGVuZ3RoID8gTUFQUy5ERUZBVUxUX0RVQUwgOiBkZWZhdWx0bWFwO1xuICAgIG1hcC5tYXBwaW5nID0gcGFkLm1hcHBpbmc7XG4gICAgcmV0dXJuIG1hcDtcbn1cblxubGV0IGRlYWRab25lID0gMC4yNTtcblxuLyoqXG4gKiBAcGFyYW0ge251bWJlcn0gbXMgLSBOdW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIHNsZWVwIGZvci5cbiAqIEByZXR1cm5zIHtQcm9taXNlPHZvaWQ+fVxuICogQGlnbm9yZVxuICovXG5mdW5jdGlvbiBzbGVlcChtcykge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBBIEdhbWVQYWRCdXR0b24gc3RvcmVzIGluZm9ybWF0aW9uIGFib3V0IGEgYnV0dG9uIGZyb20gdGhlIEdhbWVwYWQgQVBJLlxuICovXG5jbGFzcyBHYW1lUGFkQnV0dG9uIHtcbiAgICAvKipcbiAgICAgKiBUaGUgdmFsdWUgZm9yIHRoZSBidXR0b24gYmV0d2VlbiAwIGFuZCAxLCB3aXRoIDAgcmVwcmVzZW50aW5nIGEgYnV0dG9uIHRoYXQgaXMgbm90IHByZXNzZWQsIGFuZCAxIHJlcHJlc2VudGluZyBhIGJ1dHRvbiB0aGF0IGlzIGZ1bGx5IHByZXNzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHZhbHVlID0gMDtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiBpcyBjdXJyZW50bHkgZG93bi5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHByZXNzZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiBpcyBjdXJyZW50bHkgdG91Y2hlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHRvdWNoZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiB3YXMgcHJlc3NlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHdhc1ByZXNzZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiB3YXMgcmVsZWFzZWQgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgd2FzUmVsZWFzZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGJ1dHRvbiB3YXMgdG91Y2hlZCBzaW5jZSB0aGUgbGFzdCB1cGRhdGUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICB3YXNUb3VjaGVkID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgR2FtZVBhZEJ1dHRvbiBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfEdhbWVwYWRCdXR0b259IGN1cnJlbnQgLSBUaGUgb3JpZ2luYWwgR2FtZXBhZCBBUEkgZ2FtZXBhZCBidXR0b24uXG4gICAgICogQHBhcmFtIHtudW1iZXJ8R2FtZXBhZEJ1dHRvbn0gW3ByZXZpb3VzXSAtIFRoZSBwcmV2aW91cyBHYW1lcGFkIEFQSSBnYW1lcGFkIGJ1dHRvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoY3VycmVudCwgcHJldmlvdXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjdXJyZW50ID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy52YWx1ZSA9IGN1cnJlbnQ7XG4gICAgICAgICAgICB0aGlzLnByZXNzZWQgPSBjdXJyZW50ID09PSAxO1xuICAgICAgICAgICAgdGhpcy50b3VjaGVkID0gY3VycmVudCA+IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLnZhbHVlID0gY3VycmVudC52YWx1ZTtcbiAgICAgICAgICAgIHRoaXMucHJlc3NlZCA9IGN1cnJlbnQucHJlc3NlZDtcbiAgICAgICAgICAgIHRoaXMudG91Y2hlZCA9IGN1cnJlbnQudG91Y2hlZCA/PyBjdXJyZW50LnZhbHVlID4gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcmV2aW91cykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBwcmV2aW91cyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICB0aGlzLndhc1ByZXNzZWQgPSBwcmV2aW91cyAhPT0gMSAmJiB0aGlzLnByZXNzZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy53YXNSZWxlYXNlZCA9IHByZXZpb3VzID09PSAxICYmICF0aGlzLnByZXNzZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy53YXNUb3VjaGVkID0gcHJldmlvdXMgPT09IDAgJiYgdGhpcy50b3VjaGVkO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLndhc1ByZXNzZWQgPSAhcHJldmlvdXMucHJlc3NlZCAmJiB0aGlzLnByZXNzZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy53YXNSZWxlYXNlZCA9IHByZXZpb3VzLnByZXNzZWQgJiYgIXRoaXMucHJlc3NlZDtcbiAgICAgICAgICAgICAgICB0aGlzLndhc1RvdWNoZWQgPSAhKHByZXZpb3VzLnRvdWNoZWQgPz8gcHJldmlvdXMudmFsdWUgPiAwKSAmJiB0aGlzLnRvdWNoZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIGV4aXN0aW5nIEdhbWVQYWRCdXR0b24gSW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dhbWVwYWRCdXR0b259IGJ1dHRvbiAtIFRoZSBvcmlnaW5hbCBHYW1lcGFkIEFQSSBnYW1lcGFkIGJ1dHRvbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGJ1dHRvbikge1xuICAgICAgICBjb25zdCB7IHZhbHVlLCBwcmVzc2VkIH0gPSBidXR0b247XG4gICAgICAgIGNvbnN0IHRvdWNoZWQgPSBidXR0b24udG91Y2hlZCA/PyB2YWx1ZSA+IDA7XG5cbiAgICAgICAgdGhpcy53YXNQcmVzc2VkID0gIXRoaXMucHJlc3NlZCAmJiBwcmVzc2VkO1xuICAgICAgICB0aGlzLndhc1JlbGVhc2VkID0gdGhpcy5wcmVzc2VkICYmICFwcmVzc2VkO1xuICAgICAgICB0aGlzLndhc1RvdWNoZWQgPSAhdGhpcy50b3VjaGVkICYmIHRvdWNoZWQ7XG5cbiAgICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLnByZXNzZWQgPSBwcmVzc2VkO1xuICAgICAgICB0aGlzLnRvdWNoZWQgPSB0b3VjaGVkO1xuICAgIH1cbn1cblxuY29uc3QgZHVtbXlCdXR0b24gPSBPYmplY3QuZnJlZXplKG5ldyBHYW1lUGFkQnV0dG9uKDApKTtcblxuLyoqXG4gKiBBIEdhbWVQYWQgc3RvcmVzIGluZm9ybWF0aW9uIGFib3V0IGEgZ2FtZXBhZCBmcm9tIHRoZSBHYW1lcGFkIEFQSS5cbiAqL1xuY2xhc3MgR2FtZVBhZCB7XG4gICAgLyoqXG4gICAgICogVGhlIGNvbXBpbGVkIG1hcHBpbmcgdG8gcmVkdWNlIGxvb2t1cCBkZWxheSB3aGVuIHJldHJpZXZpbmcgYnV0dG9uc1xuICAgICAqXG4gICAgICogQHR5cGUge29iamVjdH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jb21waWxlZE1hcHBpbmcgPSB7XG4gICAgICAgIGJ1dHRvbnM6IFtdLFxuICAgICAgICBheGVzOiBbXVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgR2FtZVBhZCBJbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R2FtZXBhZH0gZ2FtZXBhZCAtIFRoZSBvcmlnaW5hbCBHYW1lcGFkIEFQSSBnYW1lcGFkLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBtYXAgLSBUaGUgYnV0dG9ucyBhbmQgYXhlcyBtYXAuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdhbWVwYWQsIG1hcCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGlkZW50aWZpZXIgZm9yIHRoZSBnYW1lcGFkLiBJdHMgc3RydWN0dXJlIGRlcGVuZHMgb24gZGV2aWNlLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pZCA9IGdhbWVwYWQuaWQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbmRleCBmb3IgdGhpcyBjb250cm9sbGVyLiBBIGdhbWVwYWQgdGhhdCBpcyBkaXNjb25uZWN0ZWQgYW5kIHJlY29ubmVjdGVkIHdpbGwgcmV0YWluIHRoZSBzYW1lIGluZGV4LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbmRleCA9IGdhbWVwYWQuaW5kZXg7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBidXR0b25zIHByZXNlbnQgb24gdGhlIEdhbWVQYWQuIE9yZGVyIGlzIHByb3ZpZGVkIGJ5IEFQSSwgdXNlIEdhbWVQYWQjYnV0dG9ucyBpbnN0ZWFkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7R2FtZVBhZEJ1dHRvbltdfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9idXR0b25zID0gZ2FtZXBhZC5idXR0b25zLm1hcChiID0+IG5ldyBHYW1lUGFkQnV0dG9uKGIpKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGF4ZXMgdmFsdWVzIGZyb20gdGhlIEdhbWVQYWQuIE9yZGVyIGlzIHByb3ZpZGVkIGJ5IEFQSSwgdXNlIEdhbWVQYWQjYXhlcyBpbnN0ZWFkLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2F4ZXMgPSBbLi4uZ2FtZXBhZC5heGVzXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogUHJldmlvdXMgdmFsdWUgZm9yIHRoZSBhbmFsb2cgYXhlcyBwcmVzZW50IG9uIHRoZSBnYW1lcGFkLiBWYWx1ZXMgYXJlIGJldHdlZW4gLTEgYW5kIDEuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcHJldmlvdXNBeGVzID0gWy4uLmdhbWVwYWQuYXhlc107XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBnYW1lcGFkIG1hcHBpbmcgZGV0ZWN0ZWQgYnkgdGhlIGJyb3dzZXIuIFZhbHVlIGlzIGVpdGhlciBcInN0YW5kYXJkXCIsIFwieHItc3RhbmRhcmRcIiwgXCJcIiBvciBcImN1c3RvbVwiLiBXaGVuIGVtcHR5IHN0cmluZywgeW91IG1heSBuZWVkIHRvIHVwZGF0ZSB0aGUgbWFwcGluZyB5b3Vyc2VsZi4gXCJjdXN0b21cIiBtZWFucyB5b3UgdXBkYXRlZCB0aGUgbWFwcGluZy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMubWFwcGluZyA9IG1hcC5tYXBwaW5nO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgYnV0dG9ucyBhbmQgYXhlcyBtYXAuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtvYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLm1hcCA9IG1hcDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGhhbmQgdGhpcyBnYW1lcGFkIGlzIHVzdWFsbHkgaGFuZGxlZCBvbi4gT25seSByZWxldmFudCBmb3IgWFIgcGFkcy4gVmFsdWUgaXMgZWl0aGVyIFwibGVmdFwiLCBcInJpZ2h0XCIgb3IgXCJub25lXCIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmhhbmQgPSBnYW1lcGFkLmhhbmQgfHwgJ25vbmUnO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgb3JpZ2luYWwgR2FtZXBhZCBBUEkgZ2FtZXBhZC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0dhbWVwYWR9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucGFkID0gZ2FtZXBhZDtcblxuICAgICAgICB0aGlzLl9jb21waWxlTWFwcGluZygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgdGhlIGdhbWVwYWQgaXMgY29ubmVjdGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2V0IGNvbm5lY3RlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFkLmNvbm5lY3RlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb21waWxlIHRoZSBidXR0b25zIG1hcHBpbmcgdG8gcmVkdWNlIGxvb2t1cCBkZWxheS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NvbXBpbGVNYXBwaW5nKCkge1xuICAgICAgICBjb25zdCB7IGF4ZXMsIGJ1dHRvbnMgfSA9IHRoaXMuX2NvbXBpbGVkTWFwcGluZztcbiAgICAgICAgY29uc3QgYXhlc0luZGV4ZXMgPSBNQVBTX0lOREVYRVMuYXhlcztcbiAgICAgICAgY29uc3QgYnV0dG9uc0luZGV4ZXMgPSBNQVBTX0lOREVYRVMuYnV0dG9ucztcblxuICAgICAgICAvLyBDbGVhciBleGlzdGluZ1xuICAgICAgICBheGVzLmxlbmd0aCA9IDA7XG4gICAgICAgIGJ1dHRvbnMubGVuZ3RoID0gMDtcblxuICAgICAgICAvLyBBZGQgYXhlc1xuICAgICAgICBjb25zdCBheGVzTWFwID0gdGhpcy5tYXAuYXhlcztcbiAgICAgICAgaWYgKGF4ZXNNYXApIHtcbiAgICAgICAgICAgIHRoaXMubWFwLmF4ZXMuZm9yRWFjaCgoYXhpcywgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGF4ZXNbYXhlc0luZGV4ZXNbYXhpc11dID0gKCkgPT4gdGhpcy5wYWQuYXhlc1tpXSB8fCAwO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaWxsIGVtcHR5IGluZGV4ZXMgZm9yIGF4ZXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBheGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaWYgKCFheGVzW2ldKSB7XG4gICAgICAgICAgICAgICAgYXhlc1tpXSA9ICgpID0+IDA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBZGQgYmFzaWMgYnV0dG9uc1xuICAgICAgICBjb25zdCBidXR0b25zTWFwID0gdGhpcy5tYXAuYnV0dG9ucztcbiAgICAgICAgaWYgKGJ1dHRvbnNNYXApIHtcbiAgICAgICAgICAgIGJ1dHRvbnNNYXAuZm9yRWFjaCgoYnV0dG9uLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgYnV0dG9uc1tidXR0b25zSW5kZXhlc1tidXR0b25dXSA9ICgpID0+IHRoaXMuX2J1dHRvbnNbaV0gfHwgZHVtbXlCdXR0b247XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFkZCBzeW50aGVzaXplZCBidXR0b25zXG4gICAgICAgIGNvbnN0IHN5bnRoZXNpemVkQnV0dG9uc01hcCA9IHRoaXMubWFwLnN5bnRoZXNpemVkQnV0dG9ucztcbiAgICAgICAgaWYgKHN5bnRoZXNpemVkQnV0dG9uc01hcCkge1xuICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMoc3ludGhlc2l6ZWRCdXR0b25zTWFwKS5mb3JFYWNoKChidXR0b24pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGF4aXMsIG1heCwgbWluIH0gPSBidXR0b25bMV07XG4gICAgICAgICAgICAgICAgYnV0dG9uc1tidXR0b25zSW5kZXhlc1tidXR0b25bMF1dXSA9ICgpID0+IG5ldyBHYW1lUGFkQnV0dG9uKFxuICAgICAgICAgICAgICAgICAgICBNYXRoLmFicyhtYXRoLmNsYW1wKHRoaXMuX2F4ZXNbYXhpc10gPz8gMCwgbWluLCBtYXgpKSxcbiAgICAgICAgICAgICAgICAgICAgTWF0aC5hYnMobWF0aC5jbGFtcCh0aGlzLl9wcmV2aW91c0F4ZXNbYXhpc10gPz8gMCwgbWluLCBtYXgpKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZpbGwgZW1wdHkgaW5kZXhlcyBmb3IgYnV0dG9uc1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGJ1dHRvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIWJ1dHRvbnNbaV0pIHtcbiAgICAgICAgICAgICAgICBidXR0b25zW2ldID0gKCkgPT4gZHVtbXlCdXR0b247XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIGV4aXN0aW5nIEdhbWVQYWQgSW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dhbWVwYWR9IGdhbWVwYWQgLSBUaGUgb3JpZ2luYWwgR2FtZXBhZCBBUEkgZ2FtZXBhZC5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgdXBkYXRlKGdhbWVwYWQpIHtcbiAgICAgICAgdGhpcy5wYWQgPSBnYW1lcGFkO1xuXG4gICAgICAgIGNvbnN0IHByZXZpb3VzQXhlcyA9IHRoaXMuX3ByZXZpb3VzQXhlcztcbiAgICAgICAgY29uc3QgYXhlcyA9IHRoaXMuX2F4ZXM7XG5cbiAgICAgICAgLy8gU3RvcmUgcHJldmlvdXMgdmFsdWVzIGZvciBheGVzIGZvciBkdWFsIGJ1dHRvbnMuXG4gICAgICAgIHByZXZpb3VzQXhlcy5sZW5ndGggPSAwO1xuICAgICAgICBwcmV2aW91c0F4ZXMucHVzaCguLi5heGVzKTtcblxuICAgICAgICAvLyBVcGRhdGUgYXhlc1xuICAgICAgICBheGVzLmxlbmd0aCA9IDA7XG4gICAgICAgIGF4ZXMucHVzaCguLi5nYW1lcGFkLmF4ZXMpO1xuXG4gICAgICAgIC8vIFVwZGF0ZSBidXR0b25zXG4gICAgICAgIGNvbnN0IGJ1dHRvbnMgPSB0aGlzLl9idXR0b25zO1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGJ1dHRvbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBidXR0b25zW2ldLnVwZGF0ZShnYW1lcGFkLmJ1dHRvbnNbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSBtYXAgZm9yIHRoaXMgZ2FtZXBhZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBtYXAgLSBUaGUgbmV3IG1hcHBpbmcgZm9yIHRoaXMgZ2FtZXBhZC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBtYXAuYnV0dG9ucyAtIEJ1dHRvbnMgbWFwcGluZyBmb3IgdGhpcyBnYW1lcGFkLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IG1hcC5heGVzIC0gQXhlcyBtYXBwaW5nIGZvciB0aGlzIGdhbWVwYWQuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFttYXAuc3ludGhlc2l6ZWRCdXR0b25zXSAtIEluZm9ybWF0aW9uIGFib3V0IGJ1dHRvbnMgdG8gcHVsbCBmcm9tIGF4ZXMgZm9yIHRoaXMgZ2FtZXBhZC4gUmVxdWlyZXMgZGVmaW5pdGlvbiBvZiBheGlzIGluZGV4LCBtaW4gdmFsdWUgYW5kIG1heCB2YWx1ZS5cbiAgICAgKiBAcGFyYW0ge1wiY3VzdG9tXCJ9IFttYXAubWFwcGluZ10gLSBOZXcgbWFwcGluZyBmb3JtYXQuIFdpbGwgYmUgZm9yY2VkIGludG8gXCJjdXN0b21cIi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHRoaXMucGFkLnVwZGF0ZU1hcCh7XG4gICAgICogICAgIGJ1dHRvbnM6IFtbXG4gICAgICogICAgICAgICAnUEFEX0ZBQ0VfMScsXG4gICAgICogICAgICAgICAnUEFEX0ZBQ0VfMicsXG4gICAgICogICAgICAgICAnUEFEX0ZBQ0VfMycsXG4gICAgICogICAgICAgICAnUEFEX0ZBQ0VfNCcsXG4gICAgICogICAgICAgICAnUEFEX0xfU0hPVUxERVJfMScsXG4gICAgICogICAgICAgICAnUEFEX1JfU0hPVUxERVJfMScsXG4gICAgICogICAgICAgICAnUEFEX0xfU0hPVUxERVJfMicsXG4gICAgICogICAgICAgICAnUEFEX1JfU0hPVUxERVJfMicsXG4gICAgICogICAgICAgICAnUEFEX1NFTEVDVCcsXG4gICAgICogICAgICAgICAnUEFEX1NUQVJUJyxcbiAgICAgKiAgICAgICAgICdQQURfTF9TVElDS19CVVRUT04nLFxuICAgICAqICAgICAgICAgJ1BBRF9SX1NUSUNLX0JVVFRPTicsXG4gICAgICogICAgICAgICAnUEFEX1ZFTkRPUidcbiAgICAgKiAgICAgXSxcbiAgICAgKiAgICAgYXhlczogW1xuICAgICAqICAgICAgICAgJ1BBRF9MX1NUSUNLX1gnLFxuICAgICAqICAgICAgICAgJ1BBRF9MX1NUSUNLX1knLFxuICAgICAqICAgICAgICAgJ1BBRF9SX1NUSUNLX1gnLFxuICAgICAqICAgICAgICAgJ1BBRF9SX1NUSUNLX1knXG4gICAgICogICAgIF0sXG4gICAgICogICAgIHN5bnRoZXNpemVkQnV0dG9uczoge1xuICAgICAqICAgICAgICAgUEFEX1VQOiB7IGF4aXM6IDAsIG1pbjogMCwgbWF4OiAxIH0sXG4gICAgICogICAgICAgICBQQURfRE9XTjogeyBheGlzOiAwLCBtaW46IC0xLCBtYXg6IDAgfSxcbiAgICAgKiAgICAgICAgIFBBRF9MRUZUOiB7IGF4aXM6IDAsIG1pbjogLTEsIG1heDogMCB9LFxuICAgICAqICAgICAgICAgUEFEX1JJR0hUOiB7IGF4aXM6IDAsIG1pbjogMCwgbWF4OiAxIH1cbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHVwZGF0ZU1hcChtYXApIHtcbiAgICAgICAgbWFwLm1hcHBpbmcgPSAnY3VzdG9tJztcblxuICAgICAgICAvLyBTYXZlIHRoZSBtYXAgaW4gY2FzZSBvZiBkaXNjb25uZWN0aW9uLlxuICAgICAgICBjdXN0b21fbWFwc1t0aGlzLmlkXSA9IG1hcDtcblxuICAgICAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICAgICAgdGhpcy5tYXBwaW5nID0gJ2N1c3RvbSc7XG5cbiAgICAgICAgdGhpcy5fY29tcGlsZU1hcHBpbmcoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNldCBnYW1lcGFkIG1hcHBpbmcgdG8gZGVmYXVsdC5cbiAgICAgKi9cbiAgICByZXNldE1hcCgpIHtcbiAgICAgICAgaWYgKGN1c3RvbV9tYXBzW3RoaXMuaWRdKSB7XG4gICAgICAgICAgICBkZWxldGUgY3VzdG9tX21hcHNbdGhpcy5pZF07XG5cbiAgICAgICAgICAgIGNvbnN0IG1hcCA9IGdldE1hcCh0aGlzLnBhZCk7XG4gICAgICAgICAgICB0aGlzLm1hcCA9IG1hcDtcbiAgICAgICAgICAgIHRoaXMubWFwcGluZyA9IG1hcC5tYXBwaW5nO1xuXG4gICAgICAgICAgICB0aGlzLl9jb21waWxlTWFwcGluZygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlcyBmcm9tIGFuYWxvZyBheGVzIHByZXNlbnQgb24gdGhlIEdhbWVQYWQuIFZhbHVlcyBhcmUgYmV0d2VlbiAtMSBhbmQgMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKi9cbiAgICBnZXQgYXhlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbXBpbGVkTWFwcGluZy5heGVzLm1hcChhID0+IGEoKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGJ1dHRvbnMgcHJlc2VudCBvbiB0aGUgR2FtZVBhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtHYW1lUGFkQnV0dG9uW119XG4gICAgICovXG4gICAgZ2V0IGJ1dHRvbnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb21waWxlZE1hcHBpbmcuYnV0dG9ucy5tYXAoYiA9PiBiKCkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1ha2UgdGhlIGdhbWVwYWQgdmlicmF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbnRlbnNpdHkgLSBJbnRlbnNpdHkgZm9yIHRoZSB2aWJyYXRpb24gaW4gdGhlIHJhbmdlIDAgdG8gMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHVyYXRpb24gLSBEdXJhdGlvbiBmb3IgdGhlIHZpYnJhdGlvbiBpbiBtaWxsaXNlY29uZHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbnMgZm9yIHNwZWNpYWwgdmlicmF0aW9uIHBhdHRlcm4uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0RGVsYXldIC0gRGVsYXkgYmVmb3JlIHRoZSBwYXR0ZXJuIHN0YXJ0cywgaW4gbWlsbGlzZWNvbmRzLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdHJvbmdNYWduaXR1ZGVdIC0gSW50ZW5zaXR5IGZvciBzdHJvbmcgYWN0dWF0b3JzIGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIGludGVuc2l0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMud2Vha01hZ25pdHVkZV0gLSBJbnRlbnNpdHkgZm9yIHdlYWsgYWN0dWF0b3JzIGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIGludGVuc2l0eS5cbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gUmV0dXJuIGEgUHJvbWlzZSByZXN1bHRpbmcgaW4gdHJ1ZSBpZiB0aGUgcHVsc2Ugd2FzIHN1Y2Nlc3NmdWxseSBjb21wbGV0ZWQuXG4gICAgICovXG4gICAgYXN5bmMgcHVsc2UoaW50ZW5zaXR5LCBkdXJhdGlvbiwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBhY3R1YXRvcnMgPSB0aGlzLnBhZC52aWJyYXRpb25BY3R1YXRvciA/IFt0aGlzLnBhZC52aWJyYXRpb25BY3R1YXRvcl0gOiB0aGlzLnBhZC5oYXB0aWNBY3R1YXRvcnMgfHwgZHVtbXlBcnJheTtcblxuICAgICAgICBpZiAoYWN0dWF0b3JzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3Qgc3RhcnREZWxheSA9IG9wdGlvbnM/LnN0YXJ0RGVsYXkgPz8gMDtcbiAgICAgICAgICAgIGNvbnN0IHN0cm9uZ01hZ25pdHVkZSA9IG9wdGlvbnM/LnN0cm9uZ01hZ25pdHVkZSA/PyBpbnRlbnNpdHk7XG4gICAgICAgICAgICBjb25zdCB3ZWFrTWFnbml0dWRlID0gb3B0aW9ucz8ud2Vha01hZ25pdHVkZSA/PyBpbnRlbnNpdHk7XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICAgICAgICBhY3R1YXRvcnMubWFwKGFzeW5jIChhY3R1YXRvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWFjdHVhdG9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmIChhY3R1YXRvci5wbGF5RWZmZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYWN0dWF0b3IucGxheUVmZmVjdChhY3R1YXRvci50eXBlLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnREZWxheSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJvbmdNYWduaXR1ZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2Vha01hZ25pdHVkZVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0dWF0b3IucHVsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNsZWVwKHN0YXJ0RGVsYXkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjdHVhdG9yLnB1bHNlKGludGVuc2l0eSwgZHVyYXRpb24pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0cy5zb21lKHIgPT4gciA9PT0gdHJ1ZSB8fCByID09PSAnY29tcGxldGUnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZSBhIGJ1dHRvbiBmcm9tIGl0cyBpbmRleC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCB0byByZXR1cm4gdGhlIGJ1dHRvbiBmb3IuXG4gICAgICogQHJldHVybnMge0dhbWVQYWRCdXR0b259IFRoZSBidXR0b24gZm9yIHRoZSBzZWFyY2hlZCBpbmRleC4gTWF5IGJlIGEgcGxhY2Vob2xkZXIgaWYgbm9uZSBmb3VuZC5cbiAgICAgKi9cbiAgICBnZXRCdXR0b24oaW5kZXgpIHtcbiAgICAgICAgY29uc3QgYnV0dG9uID0gdGhpcy5fY29tcGlsZWRNYXBwaW5nLmJ1dHRvbnNbaW5kZXhdO1xuICAgICAgICByZXR1cm4gYnV0dG9uID8gYnV0dG9uKCkgOiBkdW1teUJ1dHRvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGJ1dHRvbiBpcyBwcmVzc2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gdGVzdCwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0ZBQ0VfMX0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB0aGUgYnV0dG9uIGlzIHByZXNzZWQuXG4gICAgICovXG4gICAgaXNQcmVzc2VkKGJ1dHRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRCdXR0b24oYnV0dG9uKS5wcmVzc2VkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0cnVlIGlmIHRoZSBidXR0b24gd2FzIHByZXNzZWQgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gdGVzdCwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0ZBQ0VfMX0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJuIHRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcHJlc3NlZCwgZmFsc2UgaWYgbm90LlxuICAgICAqL1xuICAgIHdhc1ByZXNzZWQoYnV0dG9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldEJ1dHRvbihidXR0b24pLndhc1ByZXNzZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcmVsZWFzZWQgc2luY2UgdGhlIGxhc3QgdXBkYXRlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gdGVzdCwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0ZBQ0VfMX0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJuIHRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcmVsZWFzZWQsIGZhbHNlIGlmIG5vdC5cbiAgICAgKi9cbiAgICB3YXNSZWxlYXNlZChidXR0b24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QnV0dG9uKGJ1dHRvbikud2FzUmVsZWFzZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBidXR0b24gaXMgdG91Y2hlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBidXR0b24gLSBUaGUgYnV0dG9uIHRvIHRlc3QsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9GQUNFXzF9LCBldGMuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGJ1dHRvbiBpcyB0b3VjaGVkLlxuICAgICAqL1xuICAgIGlzVG91Y2hlZChidXR0b24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QnV0dG9uKGJ1dHRvbikudG91Y2hlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdHJ1ZSBpZiB0aGUgYnV0dG9uIHdhcyB0b3VjaGVkIHNpbmNlIHRoZSBsYXN0IHVwZGF0ZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBidXR0b24gLSBUaGUgYnV0dG9uIHRvIHRlc3QsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9GQUNFXzF9LCBldGMuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybiB0cnVlIGlmIHRoZSBidXR0b24gd2FzIHRvdWNoZWQsIGZhbHNlIGlmIG5vdC5cbiAgICAgKi9cbiAgICB3YXNUb3VjaGVkKGJ1dHRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRCdXR0b24oYnV0dG9uKS53YXNUb3VjaGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHZhbHVlIG9mIGEgYnV0dG9uIGJldHdlZW4gMCBhbmQgMSwgd2l0aCAwIHJlcHJlc2VudGluZyBhIGJ1dHRvbiB0aGF0IGlzIG5vdCBwcmVzc2VkLCBhbmQgMSByZXByZXNlbnRpbmcgYSBidXR0b24gdGhhdCBpcyBmdWxseSBwcmVzc2VkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGJ1dHRvbiAtIFRoZSBidXR0b24gdG8gcmV0cmlldmUsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9GQUNFXzF9LCBldGMuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIHZhbHVlIG9mIHRoZSBidXR0b24gYmV0d2VlbiAwIGFuZCAxLlxuICAgICAqL1xuICAgIGdldFZhbHVlKGJ1dHRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRCdXR0b24oYnV0dG9uKS52YWx1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIHZhbHVlIG9mIG9uZSBvZiB0aGUgYW5hbG9nIGF4ZXMgb2YgdGhlIHBhZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBheGlzIC0gVGhlIGF4aXMgdG8gZ2V0IHRoZSB2YWx1ZSBvZiwgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEX0xfU1RJQ0tfWH0sIGV0Yy5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgdmFsdWUgb2YgdGhlIGF4aXMgYmV0d2VlbiAtMSBhbmQgMS5cbiAgICAgKi9cbiAgICBnZXRBeGlzKGF4aXMpIHtcbiAgICAgICAgY29uc3QgYSA9IHRoaXMuYXhlc1theGlzXTtcbiAgICAgICAgcmV0dXJuIGEgJiYgTWF0aC5hYnMoYSkgPiBkZWFkWm9uZSA/IGEgOiAwO1xuICAgIH1cbn1cblxuLyoqXG4gKiBJbnB1dCBoYW5kbGVyIGZvciBhY2Nlc3NpbmcgR2FtZVBhZCBpbnB1dC5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIEdhbWVQYWRzIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgR2FtZVBhZHMgaW5zdGFuY2UuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFdoZXRoZXIgZ2FtZXBhZHMgYXJlIHN1cHBvcnRlZCBieSB0aGlzIGRldmljZS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmdhbWVwYWRzU3VwcG9ydGVkID0gcGxhdGZvcm0uZ2FtZXBhZHM7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBsaXN0IG9mIGN1cnJlbnQgZ2FtZXBhZHMuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtHYW1lUGFkW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmN1cnJlbnQgPSBbXTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGxpc3Qgb2YgcHJldmlvdXMgYnV0dG9ucyBzdGF0ZXNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW5bXVtdfVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9wcmV2aW91cyA9IFtdO1xuXG4gICAgICAgIHRoaXMuX29uZ2FtZXBhZGNvbm5lY3RlZEhhbmRsZXIgPSB0aGlzLl9vbmdhbWVwYWRjb25uZWN0ZWQuYmluZCh0aGlzKTtcbiAgICAgICAgdGhpcy5fb25nYW1lcGFkZGlzY29ubmVjdGVkSGFuZGxlciA9IHRoaXMuX29uZ2FtZXBhZGRpc2Nvbm5lY3RlZC5iaW5kKHRoaXMpO1xuXG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdnYW1lcGFkY29ubmVjdGVkJywgdGhpcy5fb25nYW1lcGFkY29ubmVjdGVkSGFuZGxlciwgZmFsc2UpO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignZ2FtZXBhZGRpc2Nvbm5lY3RlZCcsIHRoaXMuX29uZ2FtZXBhZGRpc2Nvbm5lY3RlZEhhbmRsZXIsIGZhbHNlKTtcblxuICAgICAgICB0aGlzLnBvbGwoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIGEgZ2FtZXBhZCBpcyBjb25uZWN0ZWQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgR2FtZVBhZHMjZ2FtZXBhZGNvbm5lY3RlZFxuICAgICAqIEBwYXJhbSB7R2FtZVBhZH0gZ2FtZXBhZCAtIFRoZSBnYW1lcGFkIHRoYXQgd2FzIGp1c3QgY29ubmVjdGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIG9uUGFkQ29ubmVjdGVkID0gZnVuY3Rpb24gKHBhZCkge1xuICAgICAqICAgICBpZiAoIXBhZC5tYXBwaW5nKSB7XG4gICAgICogICAgICAgICAvLyBNYXAgdGhlIGdhbWVwYWQgYXMgdGhlIHN5c3RlbSBjb3VsZCBub3QgZmluZCB0aGUgcHJvcGVyIG1hcC5cbiAgICAgKiAgICAgfSBlbHNlIHtcbiAgICAgKiAgICAgICAgIC8vIE1ha2UgdGhlIGdhbWVwYWQgcHVsc2UuXG4gICAgICogICAgIH1cbiAgICAgKiB9O1xuICAgICAqIGFwcC5rZXlib2FyZC5vbihcImdhbWVwYWRjb25uZWN0ZWRcIiwgb25QYWRDb25uZWN0ZWQsIHRoaXMpO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBhIGdhbWVwYWQgaXMgZGlzY29ubmVjdGVkLlxuICAgICAqXG4gICAgICogQGV2ZW50IEdhbWVQYWRzI2dhbWVwYWRkaXNjb25uZWN0ZWRcbiAgICAgKiBAcGFyYW0ge0dhbWVQYWR9IGdhbWVwYWQgLSBUaGUgZ2FtZXBhZCB0aGF0IHdhcyBqdXN0IGRpc2Nvbm5lY3RlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBvblBhZERpc2Nvbm5lY3RlZCA9IGZ1bmN0aW9uIChwYWQpIHtcbiAgICAgKiAgICAgLy8gUGF1c2UgdGhlIGdhbWUuXG4gICAgICogfTtcbiAgICAgKiBhcHAua2V5Ym9hcmQub24oXCJnYW1lcGFkZGlzY29ubmVjdGVkXCIsIG9uUGFkRGlzY29ubmVjdGVkLCB0aGlzKTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIFRocmVzaG9sZCBmb3IgYXhlcyB0byByZXR1cm4gdmFsdWVzLiBNdXN0IGJlIGJldHdlZW4gMCBhbmQgMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNldCBkZWFkWm9uZSh2YWx1ZSkge1xuICAgICAgICBkZWFkWm9uZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBkZWFkWm9uZSgpIHtcbiAgICAgICAgcmV0dXJuIGRlYWRab25lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBsaXN0IG9mIHByZXZpb3VzIGJ1dHRvbnMgc3RhdGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW5bXVtdfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBnZXQgcHJldmlvdXMoKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLmN1cnJlbnQ7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjdXJyZW50Lmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgYnV0dG9ucyA9IGN1cnJlbnRbaV0uX2J1dHRvbnM7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fcHJldmlvdXNbaV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wcmV2aW91c1tpXSA9IFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMCwgbSA9IGJ1dHRvbnMubGVuZ3RoOyBqIDwgbTsgaisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYnV0dG9uID0gYnV0dG9uc1tpXTtcbiAgICAgICAgICAgICAgICB0aGlzLnByZXZpb3VzW2ldW2pdID0gYnV0dG9uID8gIWJ1dHRvbi53YXNQcmVzc2VkICYmIGJ1dHRvbi5wcmVzc2VkIHx8IGJ1dHRvbi53YXNSZWxlYXNlZCA6IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fcHJldmlvdXMubGVuZ3RoID0gdGhpcy5jdXJyZW50Lmxlbmd0aDtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZXZpb3VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxiYWNrIGZ1bmN0aW9uIHdoZW4gYSBnYW1lcGFkIGlzIGNvbm5lY3RpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0dhbWVwYWRFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQgY29udGFpbmluZyB0aGUgY29ubmVjdGluZyBnYW1lcGFkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uZ2FtZXBhZGNvbm5lY3RlZChldmVudCkge1xuICAgICAgICBjb25zdCBwYWQgPSBuZXcgR2FtZVBhZChldmVudC5nYW1lcGFkLCB0aGlzLmdldE1hcChldmVudC5nYW1lcGFkKSk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLmN1cnJlbnQ7XG5cbiAgICAgICAgbGV0IHBhZEluZGV4ID0gY3VycmVudC5maW5kSW5kZXgoZ3AgPT4gZ3AuaW5kZXggPT09IHBhZC5pbmRleCk7XG4gICAgICAgIHdoaWxlIChwYWRJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgIGN1cnJlbnQuc3BsaWNlKHBhZEluZGV4LCAxKTtcbiAgICAgICAgICAgIHBhZEluZGV4ID0gY3VycmVudC5maW5kSW5kZXgoZ3AgPT4gZ3AuaW5kZXggPT09IHBhZC5pbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBjdXJyZW50LnB1c2gocGFkKTtcbiAgICAgICAgdGhpcy5maXJlKEVWRU5UX0dBTUVQQURDT05ORUNURUQsIHBhZCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGJhY2sgZnVuY3Rpb24gd2hlbiBhIGdhbWVwYWQgaXMgZGlzY29ubmVjdGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R2FtZXBhZEV2ZW50fSBldmVudCAtIFRoZSBldmVudCBjb250YWluaW5nIHRoZSBkaXNjb25uZWN0aW5nIGdhbWVwYWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25nYW1lcGFkZGlzY29ubmVjdGVkKGV2ZW50KSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLmN1cnJlbnQ7XG4gICAgICAgIGNvbnN0IHBhZEluZGV4ID0gY3VycmVudC5maW5kSW5kZXgoZ3AgPT4gZ3AuaW5kZXggPT09IGV2ZW50LmdhbWVwYWQuaW5kZXgpO1xuXG4gICAgICAgIGlmIChwYWRJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuZmlyZShFVkVOVF9HQU1FUEFERElTQ09OTkVDVEVELCBjdXJyZW50W3BhZEluZGV4XSk7XG4gICAgICAgICAgICBjdXJyZW50LnNwbGljZShwYWRJbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVcGRhdGUgdGhlIHByZXZpb3VzIHN0YXRlIG9mIHRoZSBnYW1lcGFkcy4gVGhpcyBtdXN0IGJlIGNhbGxlZCBldmVyeSBmcmFtZSBmb3JcbiAgICAgKiBgd2FzUHJlc3NlZGAgYW5kIGB3YXNUb3VjaGVkYCB0byB3b3JrLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHVwZGF0ZSgpIHtcbiAgICAgICAgdGhpcy5wb2xsKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUG9sbCBmb3IgdGhlIGxhdGVzdCBkYXRhIGZyb20gdGhlIGdhbWVwYWQgQVBJLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHYW1lUGFkW119IFtwYWRzXSAtIEFuIG9wdGlvbmFsIGFycmF5IHVzZWQgdG8gcmVjZWl2ZSB0aGUgZ2FtZXBhZHMgbWFwcGluZy4gVGhpc1xuICAgICAqIGFycmF5IHdpbGwgYmUgcmV0dXJuZWQgYnkgdGhpcyBmdW5jdGlvbi5cbiAgICAgKiBAcmV0dXJucyB7R2FtZVBhZFtdfSBBbiBhcnJheSBvZiBnYW1lcGFkcyBhbmQgbWFwcGluZ3MgZm9yIHRoZSBtb2RlbCBvZiBnYW1lcGFkIHRoYXQgaXNcbiAgICAgKiBhdHRhY2hlZC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBnYW1lcGFkcyA9IG5ldyBwYy5HYW1lUGFkcygpO1xuICAgICAqIHZhciBwYWRzID0gZ2FtZXBhZHMucG9sbCgpO1xuICAgICAqL1xuICAgIHBvbGwocGFkcyA9IFtdKSB7XG4gICAgICAgIGlmIChwYWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHBhZHMubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhZERldmljZXMgPSBnZXRHYW1lcGFkcygpO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBwYWREZXZpY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAocGFkRGV2aWNlc1tpXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhZCA9IHRoaXMuZmluZEJ5SW5kZXgocGFkRGV2aWNlc1tpXS5pbmRleCk7XG5cbiAgICAgICAgICAgICAgICBpZiAocGFkKSB7XG4gICAgICAgICAgICAgICAgICAgIHBhZHMucHVzaChwYWQudXBkYXRlKHBhZERldmljZXNbaV0pKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBuUGFkID0gbmV3IEdhbWVQYWQocGFkRGV2aWNlc1tpXSwgdGhpcy5nZXRNYXAocGFkRGV2aWNlc1tpXSkpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnQucHVzaChuUGFkKTtcbiAgICAgICAgICAgICAgICAgICAgcGFkcy5wdXNoKG5QYWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBwYWRzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgdGhlIGV2ZW50IGxpc3RlbmVycy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignZ2FtZXBhZGNvbm5lY3RlZCcsIHRoaXMuX29uZ2FtZXBhZGNvbm5lY3RlZEhhbmRsZXIsIGZhbHNlKTtcbiAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2dhbWVwYWRkaXNjb25uZWN0ZWQnLCB0aGlzLl9vbmdhbWVwYWRkaXNjb25uZWN0ZWRIYW5kbGVyLCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0cmlldmUgdGhlIG9yZGVyIGZvciBidXR0b25zIGFuZCBheGVzIGZvciBnaXZlbiBIVE1MNSBHYW1lcGFkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtHYW1lcGFkfSBwYWQgLSBUaGUgSFRNTDUgR2FtZXBhZCBvYmplY3QuXG4gICAgICogQHJldHVybnMge29iamVjdH0gT2JqZWN0IGRlZmluaW5nIHRoZSBvcmRlciBvZiBidXR0b25zIGFuZCBheGVzIGZvciBnaXZlbiBIVE1MNSBHYW1lcGFkLlxuICAgICAqL1xuICAgIGdldE1hcChwYWQpIHtcbiAgICAgICAgcmV0dXJuIGdldE1hcChwYWQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgYnV0dG9uIG9uIHRoZSBwYWQgcmVxdWVzdGVkIGlzIHByZXNzZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3JkZXJJbmRleCAtIFRoZSBvcmRlciBpbmRleCBvZiB0aGUgcGFkIHRvIGNoZWNrLCB1c2UgY29uc3RhbnRzIHtAbGluayBQQURfMX0sIHtAbGluayBQQURfMn0sIGV0Yy4gRm9yIGdhbWVwYWQgaW5kZXggY2FsbCB0aGUgZnVuY3Rpb24gZnJvbSB0aGUgcGFkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBidXR0b24gLSBUaGUgYnV0dG9uIHRvIHRlc3QsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9GQUNFXzF9LCBldGMuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGJ1dHRvbiBpcyBwcmVzc2VkLlxuICAgICAqL1xuICAgIGlzUHJlc3NlZChvcmRlckluZGV4LCBidXR0b24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VycmVudFtvcmRlckluZGV4XT8uaXNQcmVzc2VkKGJ1dHRvbikgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBidXR0b24gd2FzIHByZXNzZWQgc2luY2UgdGhlIGxhc3QgZnJhbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3JkZXJJbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgcGFkIHRvIGNoZWNrLCB1c2UgY29uc3RhbnRzIHtAbGluayBQQURfMX0sIHtAbGluayBQQURfMn0sIGV0Yy4gRm9yIGdhbWVwYWQgaW5kZXggY2FsbCB0aGUgZnVuY3Rpb24gZnJvbSB0aGUgcGFkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBidXR0b24gLSBUaGUgYnV0dG9uIHRvIHRlc3QsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9GQUNFXzF9LCBldGMuXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIGJ1dHRvbiB3YXMgcHJlc3NlZCBzaW5jZSB0aGUgbGFzdCBmcmFtZS5cbiAgICAgKi9cbiAgICB3YXNQcmVzc2VkKG9yZGVySW5kZXgsIGJ1dHRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50W29yZGVySW5kZXhdPy53YXNQcmVzc2VkKGJ1dHRvbikgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHRoZSBidXR0b24gd2FzIHJlbGVhc2VkIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG9yZGVySW5kZXggLSBUaGUgaW5kZXggb2YgdGhlIHBhZCB0byBjaGVjaywgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEXzF9LCB7QGxpbmsgUEFEXzJ9LCBldGMuIEZvciBnYW1lcGFkIGluZGV4IGNhbGwgdGhlIGZ1bmN0aW9uIGZyb20gdGhlIHBhZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYnV0dG9uIC0gVGhlIGJ1dHRvbiB0byB0ZXN0LCB1c2UgY29uc3RhbnRzIHtAbGluayBQQURfRkFDRV8xfSwgZXRjLlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBidXR0b24gd2FzIHJlbGVhc2VkIHNpbmNlIHRoZSBsYXN0IGZyYW1lLlxuICAgICAqL1xuICAgIHdhc1JlbGVhc2VkKG9yZGVySW5kZXgsIGJ1dHRvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5jdXJyZW50W29yZGVySW5kZXhdPy53YXNSZWxlYXNlZChidXR0b24pIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgdmFsdWUgb2Ygb25lIG9mIHRoZSBhbmFsb2cgYXhlcyBvZiB0aGUgcGFkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG9yZGVySW5kZXggLSBUaGUgaW5kZXggb2YgdGhlIHBhZCB0byBjaGVjaywgdXNlIGNvbnN0YW50cyB7QGxpbmsgUEFEXzF9LCB7QGxpbmsgUEFEXzJ9LCBldGMuIEZvciBnYW1lcGFkIGluZGV4IGNhbGwgdGhlIGZ1bmN0aW9uIGZyb20gdGhlIHBhZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gYXhpcyAtIFRoZSBheGlzIHRvIGdldCB0aGUgdmFsdWUgb2YsIHVzZSBjb25zdGFudHMge0BsaW5rIFBBRF9MX1NUSUNLX1h9LCBldGMuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIHZhbHVlIG9mIHRoZSBheGlzIGJldHdlZW4gLTEgYW5kIDEuXG4gICAgICovXG4gICAgZ2V0QXhpcyhvcmRlckluZGV4LCBheGlzKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmN1cnJlbnRbb3JkZXJJbmRleF0/LmdldEF4aXMoYXhpcykgfHwgMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYWtlIHRoZSBnYW1lcGFkIHZpYnJhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3JkZXJJbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgcGFkIHRvIGNoZWNrLCB1c2UgY29uc3RhbnRzIHtAbGluayBQQURfMX0sIHtAbGluayBQQURfMn0sIGV0Yy4gRm9yIGdhbWVwYWQgaW5kZXggY2FsbCB0aGUgZnVuY3Rpb24gZnJvbSB0aGUgcGFkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbnRlbnNpdHkgLSBJbnRlbnNpdHkgZm9yIHRoZSB2aWJyYXRpb24gaW4gdGhlIHJhbmdlIDAgdG8gMS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZHVyYXRpb24gLSBEdXJhdGlvbiBmb3IgdGhlIHZpYnJhdGlvbiBpbiBtaWxsaXNlY29uZHMuXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbnMgZm9yIHNwZWNpYWwgdmlicmF0aW9uIHBhdHRlcm4uXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnN0YXJ0RGVsYXldIC0gRGVsYXkgYmVmb3JlIHRoZSBwYXR0ZXJuIHN0YXJ0cywgaW4gbWlsbGlzZWNvbmRzLiBEZWZhdWx0cyB0byAwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdHJvbmdNYWduaXR1ZGVdIC0gSW50ZW5zaXR5IGZvciBzdHJvbmcgYWN0dWF0b3JzIGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIGludGVuc2l0eS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMud2Vha01hZ25pdHVkZV0gLSBJbnRlbnNpdHkgZm9yIHdlYWsgYWN0dWF0b3JzIGluIHRoZSByYW5nZSAwIHRvIDEuIERlZmF1bHRzIHRvIGludGVuc2l0eS5cbiAgICAgKiBAcmV0dXJucyB7UHJvbWlzZTxib29sZWFuPn0gUmV0dXJuIGEgUHJvbWlzZSByZXN1bHRpbmcgaW4gdHJ1ZSBpZiB0aGUgcHVsc2Ugd2FzIHN1Y2Nlc3NmdWxseSBjb21wbGV0ZWQuXG4gICAgICovXG4gICAgcHVsc2Uob3JkZXJJbmRleCwgaW50ZW5zaXR5LCBkdXJhdGlvbiwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBwYWQgPSB0aGlzLmN1cnJlbnRbb3JkZXJJbmRleF07XG4gICAgICAgIHJldHVybiBwYWQgPyBwYWQucHVsc2UoaW50ZW5zaXR5LCBkdXJhdGlvbiwgb3B0aW9ucykgOiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1ha2UgYWxsIGdhbWVwYWRzIHZpYnJhdGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW50ZW5zaXR5IC0gSW50ZW5zaXR5IGZvciB0aGUgdmlicmF0aW9uIGluIHRoZSByYW5nZSAwIHRvIDEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGR1cmF0aW9uIC0gRHVyYXRpb24gZm9yIHRoZSB2aWJyYXRpb24gaW4gbWlsbGlzZWNvbmRzLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25zIGZvciBzcGVjaWFsIHZpYnJhdGlvbiBwYXR0ZXJuLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5zdGFydERlbGF5XSAtIERlbGF5IGJlZm9yZSB0aGUgcGF0dGVybiBzdGFydHMsIGluIG1pbGxpc2Vjb25kcy4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuc3Ryb25nTWFnbml0dWRlXSAtIEludGVuc2l0eSBmb3Igc3Ryb25nIGFjdHVhdG9ycyBpbiB0aGUgcmFuZ2UgMCB0byAxLiBEZWZhdWx0cyB0byBpbnRlbnNpdHkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLndlYWtNYWduaXR1ZGVdIC0gSW50ZW5zaXR5IGZvciB3ZWFrIGFjdHVhdG9ycyBpbiB0aGUgcmFuZ2UgMCB0byAxLiBEZWZhdWx0cyB0byBpbnRlbnNpdHkuXG4gICAgICogQHJldHVybnMge1Byb21pc2U8Ym9vbGVhbltdPn0gUmV0dXJuIGEgUHJvbWlzZSByZXN1bHRpbmcgaW4gYW4gYXJyYXkgb2YgYm9vbGVhbnMgZGVmaW5pbmcgaWYgdGhlIHB1bHNlIHdhcyBzdWNjZXNzZnVsbHkgY29tcGxldGVkIGZvciBldmVyeSBnYW1lcGFkcy5cbiAgICAgKi9cbiAgICBwdWxzZUFsbChpbnRlbnNpdHksIGR1cmF0aW9uLCBvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChcbiAgICAgICAgICAgIHRoaXMuY3VycmVudC5tYXAocGFkID0+IHBhZC5wdWxzZShpbnRlbnNpdHksIGR1cmF0aW9uLCBvcHRpb25zKSlcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaW5kIGEgY29ubmVjdGVkIHtAbGluayBHYW1lUGFkfSBmcm9tIGl0cyBpZGVudGlmaWVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGlkIC0gVGhlIGlkZW50aWZpZXIgdG8gc2VhcmNoIGZvci5cbiAgICAgKiBAcmV0dXJucyB7R2FtZVBhZHxudWxsfSBUaGUge0BsaW5rIEdhbWVQYWR9IHdpdGggdGhlIG1hdGNoaW5nIGlkZW50aWZpZXIgb3IgbnVsbCBpZiBubyBnYW1lcGFkIGlzIGZvdW5kIG9yIHRoZSBnYW1lcGFkIGlzIG5vdCBjb25uZWN0ZWQuXG4gICAgICovXG4gICAgZmluZEJ5SWQoaWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VycmVudC5maW5kKGdwID0+IGdwICYmIGdwLmlkID09PSBpZCkgfHwgbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaW5kIGEgY29ubmVjdGVkIHtAbGluayBHYW1lUGFkfSBmcm9tIGl0cyBkZXZpY2UgaW5kZXguXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBUaGUgZGV2aWNlIGluZGV4IHRvIHNlYXJjaCBmb3IuXG4gICAgICogQHJldHVybnMge0dhbWVQYWR8bnVsbH0gVGhlIHtAbGluayBHYW1lUGFkfSB3aXRoIHRoZSBtYXRjaGluZyBkZXZpY2UgaW5kZXggb3IgbnVsbCBpZiBubyBnYW1lcGFkIGlzIGZvdW5kIG9yIHRoZSBnYW1lcGFkIGlzIG5vdCBjb25uZWN0ZWQuXG4gICAgICovXG4gICAgZmluZEJ5SW5kZXgoaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY3VycmVudC5maW5kKGdwID0+IGdwICYmIGdwLmluZGV4ID09PSBpbmRleCkgfHwgbnVsbDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEdhbWVQYWRzLCBHYW1lUGFkLCBHYW1lUGFkQnV0dG9uIH07XG4iXSwibmFtZXMiOlsiZHVtbXlBcnJheSIsIk9iamVjdCIsImZyZWV6ZSIsImdldEdhbWVwYWRzIiwibmF2aWdhdG9yIiwid2Via2l0R2V0R2FtZXBhZHMiLCJiaW5kIiwiTUFQU19JTkRFWEVTIiwiYnV0dG9ucyIsIlBBRF9GQUNFXzEiLCJQQURfRkFDRV8yIiwiUEFEX0ZBQ0VfMyIsIlBBRF9GQUNFXzQiLCJQQURfTF9TSE9VTERFUl8xIiwiUEFEX1JfU0hPVUxERVJfMSIsIlBBRF9MX1NIT1VMREVSXzIiLCJQQURfUl9TSE9VTERFUl8yIiwiUEFEX1NFTEVDVCIsIlBBRF9TVEFSVCIsIlBBRF9MX1NUSUNLX0JVVFRPTiIsIlBBRF9SX1NUSUNLX0JVVFRPTiIsIlBBRF9VUCIsIlBBRF9ET1dOIiwiUEFEX0xFRlQiLCJQQURfUklHSFQiLCJQQURfVkVORE9SIiwiWFJQQURfVFJJR0dFUiIsIlhSUEFEX1NRVUVFWkUiLCJYUlBBRF9UT1VDSFBBRF9CVVRUT04iLCJYUlBBRF9TVElDS19CVVRUT04iLCJYUlBBRF9BIiwiWFJQQURfQiIsImF4ZXMiLCJQQURfTF9TVElDS19YIiwiUEFEX0xfU1RJQ0tfWSIsIlBBRF9SX1NUSUNLX1giLCJQQURfUl9TVElDS19ZIiwiWFJQQURfVE9VQ0hQQURfWCIsIlhSUEFEX1RPVUNIUEFEX1kiLCJYUlBBRF9TVElDS19YIiwiWFJQQURfU1RJQ0tfWSIsIk1BUFMiLCJERUZBVUxUIiwiREVGQVVMVF9EVUFMIiwic3ludGhlc2l6ZWRCdXR0b25zIiwiYXhpcyIsIm1pbiIsIm1heCIsIlBTMyIsIm1hcHBpbmciLCJERUZBVUxUX1hSIiwiUFJPRFVDVF9DT0RFUyIsImN1c3RvbV9tYXBzIiwiZ2V0TWFwIiwicGFkIiwiY3VzdG9tIiwiaWQiLCJjb2RlIiwiaW5kZXhPZiIsInByb2R1Y3QiLCJyYXciLCJkZWZhdWx0bWFwIiwibWFwIiwibGVuZ3RoIiwiZGVhZFpvbmUiLCJzbGVlcCIsIm1zIiwiUHJvbWlzZSIsInJlc29sdmUiLCJzZXRUaW1lb3V0IiwiR2FtZVBhZEJ1dHRvbiIsImNvbnN0cnVjdG9yIiwiY3VycmVudCIsInByZXZpb3VzIiwidmFsdWUiLCJwcmVzc2VkIiwidG91Y2hlZCIsIndhc1ByZXNzZWQiLCJ3YXNSZWxlYXNlZCIsIndhc1RvdWNoZWQiLCJ1cGRhdGUiLCJidXR0b24iLCJkdW1teUJ1dHRvbiIsIkdhbWVQYWQiLCJnYW1lcGFkIiwiX2NvbXBpbGVkTWFwcGluZyIsImluZGV4IiwiX2J1dHRvbnMiLCJiIiwiX2F4ZXMiLCJfcHJldmlvdXNBeGVzIiwiaGFuZCIsIl9jb21waWxlTWFwcGluZyIsImNvbm5lY3RlZCIsImF4ZXNJbmRleGVzIiwiYnV0dG9uc0luZGV4ZXMiLCJheGVzTWFwIiwiZm9yRWFjaCIsImkiLCJsIiwiYnV0dG9uc01hcCIsInN5bnRoZXNpemVkQnV0dG9uc01hcCIsImVudHJpZXMiLCJNYXRoIiwiYWJzIiwibWF0aCIsImNsYW1wIiwicHJldmlvdXNBeGVzIiwicHVzaCIsInVwZGF0ZU1hcCIsInJlc2V0TWFwIiwiYSIsInB1bHNlIiwiaW50ZW5zaXR5IiwiZHVyYXRpb24iLCJvcHRpb25zIiwiYWN0dWF0b3JzIiwidmlicmF0aW9uQWN0dWF0b3IiLCJoYXB0aWNBY3R1YXRvcnMiLCJzdGFydERlbGF5Iiwic3Ryb25nTWFnbml0dWRlIiwid2Vha01hZ25pdHVkZSIsInJlc3VsdHMiLCJhbGwiLCJhY3R1YXRvciIsInBsYXlFZmZlY3QiLCJ0eXBlIiwic29tZSIsInIiLCJnZXRCdXR0b24iLCJpc1ByZXNzZWQiLCJpc1RvdWNoZWQiLCJnZXRWYWx1ZSIsImdldEF4aXMiLCJHYW1lUGFkcyIsIkV2ZW50SGFuZGxlciIsImdhbWVwYWRzU3VwcG9ydGVkIiwicGxhdGZvcm0iLCJnYW1lcGFkcyIsIl9wcmV2aW91cyIsIl9vbmdhbWVwYWRjb25uZWN0ZWRIYW5kbGVyIiwiX29uZ2FtZXBhZGNvbm5lY3RlZCIsIl9vbmdhbWVwYWRkaXNjb25uZWN0ZWRIYW5kbGVyIiwiX29uZ2FtZXBhZGRpc2Nvbm5lY3RlZCIsIndpbmRvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJwb2xsIiwiaiIsIm0iLCJldmVudCIsInBhZEluZGV4IiwiZmluZEluZGV4IiwiZ3AiLCJzcGxpY2UiLCJmaXJlIiwiRVZFTlRfR0FNRVBBRENPTk5FQ1RFRCIsIkVWRU5UX0dBTUVQQURESVNDT05ORUNURUQiLCJwYWRzIiwicGFkRGV2aWNlcyIsImxlbiIsImZpbmRCeUluZGV4IiwiblBhZCIsImRlc3Ryb3kiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwib3JkZXJJbmRleCIsInB1bHNlQWxsIiwiZmluZEJ5SWQiLCJmaW5kIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBS0EsTUFBTUEsVUFBVSxHQUFHQyxNQUFNLENBQUNDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQTs7QUFFcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJQyxZQUFXLEdBQUcsU0FBZEEsV0FBVyxHQUFlO0FBQzFCLEVBQUEsT0FBT0gsVUFBVSxDQUFBO0FBQ3JCLENBQUMsQ0FBQTtBQUVELElBQUksT0FBT0ksU0FBUyxLQUFLLFdBQVcsRUFBRTtBQUNsQ0QsRUFBQUEsWUFBVyxHQUFHLENBQUNDLFNBQVMsQ0FBQ0QsV0FBVyxJQUFJQyxTQUFTLENBQUNDLGlCQUFpQixJQUFJRixZQUFXLEVBQUVHLElBQUksQ0FBQ0YsU0FBUyxDQUFDLENB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
