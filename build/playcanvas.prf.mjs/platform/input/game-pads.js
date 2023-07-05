import { EventHandler } from '../../core/event-handler.js';
import { EVENT_GAMEPADCONNECTED, EVENT_GAMEPADDISCONNECTED, PAD_FACE_1, PAD_FACE_2, PAD_FACE_3, PAD_FACE_4, PAD_L_SHOULDER_1, PAD_R_SHOULDER_1, PAD_L_SHOULDER_2, PAD_R_SHOULDER_2, PAD_SELECT, PAD_START, PAD_L_STICK_BUTTON, PAD_R_STICK_BUTTON, PAD_UP, PAD_DOWN, PAD_LEFT, PAD_RIGHT, PAD_VENDOR, XRPAD_TRIGGER, XRPAD_SQUEEZE, XRPAD_TOUCHPAD_BUTTON, XRPAD_STICK_BUTTON, XRPAD_A, XRPAD_B, PAD_L_STICK_X, PAD_L_STICK_Y, PAD_R_STICK_X, PAD_R_STICK_Y, XRPAD_TOUCHPAD_X, XRPAD_TOUCHPAD_Y, XRPAD_STICK_X, XRPAD_STICK_Y } from './constants.js';
import { math } from '../../core/math/math.js';
import { platform } from '../../core/platform.js';

const dummyArray = Object.freeze([]);
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
		buttons: ['PAD_FACE_1', 'PAD_FACE_2', 'PAD_FACE_3', 'PAD_FACE_4', 'PAD_L_SHOULDER_1', 'PAD_R_SHOULDER_1', 'PAD_L_SHOULDER_2', 'PAD_R_SHOULDER_2', 'PAD_SELECT', 'PAD_START', 'PAD_L_STICK_BUTTON', 'PAD_R_STICK_BUTTON', 'PAD_UP', 'PAD_DOWN', 'PAD_LEFT', 'PAD_RIGHT', 'PAD_VENDOR'],
		axes: ['PAD_L_STICK_X', 'PAD_L_STICK_Y', 'PAD_R_STICK_X', 'PAD_R_STICK_Y']
	},
	DEFAULT_DUAL: {
		buttons: ['PAD_FACE_1', 'PAD_FACE_2', 'PAD_FACE_3', 'PAD_FACE_4', 'PAD_L_SHOULDER_1', 'PAD_R_SHOULDER_1', 'PAD_L_SHOULDER_2', 'PAD_R_SHOULDER_2', 'PAD_SELECT', 'PAD_START', 'PAD_L_STICK_BUTTON', 'PAD_R_STICK_BUTTON', 'PAD_VENDOR'],
		axes: ['PAD_L_STICK_X', 'PAD_L_STICK_Y', 'PAD_R_STICK_X', 'PAD_R_STICK_Y'],
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
		buttons: ['PAD_FACE_1', 'PAD_FACE_2', 'PAD_FACE_4', 'PAD_FACE_3', 'PAD_L_SHOULDER_1', 'PAD_R_SHOULDER_1', 'PAD_L_SHOULDER_2', 'PAD_R_SHOULDER_2', 'PAD_SELECT', 'PAD_START', 'PAD_L_STICK_BUTTON', 'PAD_R_STICK_BUTTON', 'PAD_UP', 'PAD_DOWN', 'PAD_LEFT', 'PAD_RIGHT', 'PAD_VENDOR'],
		axes: ['PAD_L_STICK_X', 'PAD_L_STICK_Y', 'PAD_R_STICK_X', 'PAD_R_STICK_Y'],
		mapping: 'standard'
	},
	DEFAULT_XR: {
		buttons: ['XRPAD_TRIGGER', 'XRPAD_SQUEEZE', 'XRPAD_TOUCHPAD_BUTTON', 'XRPAD_STICK_BUTTON', 'XRPAD_A', 'XRPAD_B'],
		axes: ['XRPAD_TOUCHPAD_X', 'XRPAD_TOUCHPAD_Y', 'XRPAD_STICK_X', 'XRPAD_STICK_Y'],
		mapping: 'xr-standard'
	}
};
const PRODUCT_CODES = {
	'Product: 0268': 'PS3'
};
const custom_maps = {};
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
function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}
class GamePadButton {
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
class GamePad {
	constructor(gamepad, map) {
		this._compiledMapping = {
			buttons: [],
			axes: []
		};
		this.id = gamepad.id;
		this.index = gamepad.index;
		this._buttons = gamepad.buttons.map(b => new GamePadButton(b));
		this._axes = [...gamepad.axes];
		this._previousAxes = [...gamepad.axes];
		this.mapping = map.mapping;
		this.map = map;
		this.hand = gamepad.hand || 'none';
		this.pad = gamepad;
		this._compileMapping();
	}
	get connected() {
		return this.pad.connected;
	}
	_compileMapping() {
		const {
			axes,
			buttons
		} = this._compiledMapping;
		const axesIndexes = MAPS_INDEXES.axes;
		const buttonsIndexes = MAPS_INDEXES.buttons;
		axes.length = 0;
		buttons.length = 0;
		const axesMap = this.map.axes;
		if (axesMap) {
			this.map.axes.forEach((axis, i) => {
				axes[axesIndexes[axis]] = () => this.pad.axes[i] || 0;
			});
		}
		for (let i = 0, l = axes.length; i < l; i++) {
			if (!axes[i]) {
				axes[i] = () => 0;
			}
		}
		const buttonsMap = this.map.buttons;
		if (buttonsMap) {
			buttonsMap.forEach((button, i) => {
				buttons[buttonsIndexes[button]] = () => this._buttons[i] || dummyButton;
			});
		}
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
		for (let i = 0, l = buttons.length; i < l; i++) {
			if (!buttons[i]) {
				buttons[i] = () => dummyButton;
			}
		}
	}
	update(gamepad) {
		this.pad = gamepad;
		const previousAxes = this._previousAxes;
		const axes = this._axes;
		previousAxes.length = 0;
		previousAxes.push(...axes);
		axes.length = 0;
		axes.push(...gamepad.axes);
		const buttons = this._buttons;
		for (let i = 0, l = buttons.length; i < l; i++) {
			buttons[i].update(gamepad.buttons[i]);
		}
		return this;
	}
	updateMap(map) {
		map.mapping = 'custom';
		custom_maps[this.id] = map;
		this.map = map;
		this.mapping = 'custom';
		this._compileMapping();
	}
	resetMap() {
		if (custom_maps[this.id]) {
			delete custom_maps[this.id];
			const map = getMap(this.pad);
			this.map = map;
			this.mapping = map.mapping;
			this._compileMapping();
		}
	}
	get axes() {
		return this._compiledMapping.axes.map(a => a());
	}
	get buttons() {
		return this._compiledMapping.buttons.map(b => b());
	}
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
	getButton(index) {
		const button = this._compiledMapping.buttons[index];
		return button ? button() : dummyButton;
	}
	isPressed(button) {
		return this.getButton(button).pressed;
	}
	wasPressed(button) {
		return this.getButton(button).wasPressed;
	}
	wasReleased(button) {
		return this.getButton(button).wasReleased;
	}
	isTouched(button) {
		return this.getButton(button).touched;
	}
	wasTouched(button) {
		return this.getButton(button).wasTouched;
	}
	getValue(button) {
		return this.getButton(button).value;
	}
	getAxis(axis) {
		const a = this.axes[axis];
		return a && Math.abs(a) > deadZone ? a : 0;
	}
}
class GamePads extends EventHandler {
	constructor() {
		super();
		this.gamepadsSupported = platform.gamepads;
		this.current = [];
		this._previous = [];
		this._ongamepadconnectedHandler = this._ongamepadconnected.bind(this);
		this._ongamepaddisconnectedHandler = this._ongamepaddisconnected.bind(this);
		window.addEventListener('gamepadconnected', this._ongamepadconnectedHandler, false);
		window.addEventListener('gamepaddisconnected', this._ongamepaddisconnectedHandler, false);
		this.poll();
	}
	set deadZone(value) {
		deadZone = value;
	}
	get deadZone() {
		return deadZone;
	}
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
	_ongamepaddisconnected(event) {
		const current = this.current;
		const padIndex = current.findIndex(gp => gp.index === event.gamepad.index);
		if (padIndex !== -1) {
			this.fire(EVENT_GAMEPADDISCONNECTED, current[padIndex]);
			current.splice(padIndex, 1);
		}
	}
	update() {
		this.poll();
	}
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
	destroy() {
		window.removeEventListener('gamepadconnected', this._ongamepadconnectedHandler, false);
		window.removeEventListener('gamepaddisconnected', this._ongamepaddisconnectedHandler, false);
	}
	getMap(pad) {
		return getMap(pad);
	}
	isPressed(orderIndex, button) {
		var _this$current$orderIn;
		return ((_this$current$orderIn = this.current[orderIndex]) == null ? void 0 : _this$current$orderIn.isPressed(button)) || false;
	}
	wasPressed(orderIndex, button) {
		var _this$current$orderIn2;
		return ((_this$current$orderIn2 = this.current[orderIndex]) == null ? void 0 : _this$current$orderIn2.wasPressed(button)) || false;
	}
	wasReleased(orderIndex, button) {
		var _this$current$orderIn3;
		return ((_this$current$orderIn3 = this.current[orderIndex]) == null ? void 0 : _this$current$orderIn3.wasReleased(button)) || false;
	}
	getAxis(orderIndex, axis) {
		var _this$current$orderIn4;
		return ((_this$current$orderIn4 = this.current[orderIndex]) == null ? void 0 : _this$current$orderIn4.getAxis(axis)) || 0;
	}
	pulse(orderIndex, intensity, duration, options) {
		const pad = this.current[orderIndex];
		return pad ? pad.pulse(intensity, duration, options) : Promise.resolve(false);
	}
	pulseAll(intensity, duration, options) {
		return Promise.all(this.current.map(pad => pad.pulse(intensity, duration, options)));
	}
	findById(id) {
		return this.current.find(gp => gp && gp.id === id) || null;
	}
	findByIndex(index) {
		return this.current.find(gp => gp && gp.index === index) || null;
	}
}

export { GamePad, GamePadButton, GamePads };
