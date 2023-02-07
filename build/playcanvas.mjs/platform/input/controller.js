import { type } from '../../core/core.js';
import { ACTION_KEYBOARD, ACTION_MOUSE, ACTION_GAMEPAD, PAD_1, PAD_L_STICK_Y, PAD_L_STICK_X, PAD_R_STICK_Y, PAD_R_STICK_X, EVENT_MOUSEMOVE } from './constants.js';
import { Keyboard } from './keyboard.js';
import { Mouse } from './mouse.js';

class Controller {
	constructor(element, options = {}) {
		this._keyboard = options.keyboard || null;
		this._mouse = options.mouse || null;
		this._gamepads = options.gamepads || null;
		this._element = null;
		this._actions = {};
		this._axes = {};
		this._axesValues = {};
		if (element) {
			this.attach(element);
		}
	}
	attach(element) {
		this._element = element;
		if (this._keyboard) {
			this._keyboard.attach(element);
		}
		if (this._mouse) {
			this._mouse.attach(element);
		}
	}
	detach() {
		if (this._keyboard) {
			this._keyboard.detach();
		}
		if (this._mouse) {
			this._mouse.detach();
		}
		this._element = null;
	}
	disableContextMenu() {
		if (!this._mouse) {
			this._enableMouse();
		}
		this._mouse.disableContextMenu();
	}
	enableContextMenu() {
		if (!this._mouse) {
			this._enableMouse();
		}
		this._mouse.enableContextMenu();
	}
	update(dt) {
		if (this._keyboard) {
			this._keyboard.update();
		}
		if (this._mouse) {
			this._mouse.update();
		}
		if (this._gamepads) {
			this._gamepads.update();
		}
		this._axesValues = {};
		for (const key in this._axes) {
			this._axesValues[key] = [];
		}
	}
	appendAction(action_name, action) {
		this._actions[action_name] = this._actions[action_name] || [];
		this._actions[action_name].push(action);
	}
	registerKeys(action, keys) {
		if (!this._keyboard) {
			this._enableKeyboard();
		}
		if (this._actions[action]) {
			throw new Error(`Action: ${action} already registered`);
		}
		if (keys === undefined) {
			throw new Error('Invalid button');
		}
		if (!keys.length) {
			keys = [keys];
		}
		this.appendAction(action, {
			type: ACTION_KEYBOARD,
			keys
		});
	}
	registerMouse(action, button) {
		if (!this._mouse) {
			this._enableMouse();
		}
		if (button === undefined) {
			throw new Error('Invalid button');
		}
		this.appendAction(action, {
			type: ACTION_MOUSE,
			button
		});
	}
	registerPadButton(action, pad, button) {
		if (button === undefined) {
			throw new Error('Invalid button');
		}
		this.appendAction(action, {
			type: ACTION_GAMEPAD,
			button,
			pad
		});
	}
	registerAxis(options) {
		const name = options.name;
		if (!this._axes[name]) {
			this._axes[name] = [];
		}
		const i = this._axes[name].push(name);
		options = options || {};
		options.pad = options.pad || PAD_1;
		const bind = function bind(controller, source, value, key) {
			switch (source) {
				case 'mousex':
					controller._mouse.on(EVENT_MOUSEMOVE, function (e) {
						controller._axesValues[name][i] = e.dx / 10;
					});
					break;
				case 'mousey':
					controller._mouse.on(EVENT_MOUSEMOVE, function (e) {
						controller._axesValues[name][i] = e.dy / 10;
					});
					break;
				case 'key':
					controller._axes[name].push(function () {
						return controller._keyboard.isPressed(key) ? value : 0;
					});
					break;
				case 'padrx':
					controller._axes[name].push(function () {
						return controller._gamepads.getAxis(options.pad, PAD_R_STICK_X);
					});
					break;
				case 'padry':
					controller._axes[name].push(function () {
						return controller._gamepads.getAxis(options.pad, PAD_R_STICK_Y);
					});
					break;
				case 'padlx':
					controller._axes[name].push(function () {
						return controller._gamepads.getAxis(options.pad, PAD_L_STICK_X);
					});
					break;
				case 'padly':
					controller._axes[name].push(function () {
						return controller._gamepads.getAxis(options.pad, PAD_L_STICK_Y);
					});
					break;
				default:
					throw new Error('Unknown axis');
			}
		};
		bind(this, options.positive, 1, options.positiveKey);
		if (options.negativeKey || options.negative !== options.positive) {
			bind(this, options.negative, -1, options.negativeKey);
		}
	}
	isPressed(actionName) {
		if (!this._actions[actionName]) {
			return false;
		}
		const length = this._actions[actionName].length;
		for (let index = 0; index < length; ++index) {
			const action = this._actions[actionName][index];
			switch (action.type) {
				case ACTION_KEYBOARD:
					if (this._keyboard) {
						const len = action.keys.length;
						for (let i = 0; i < len; i++) {
							if (this._keyboard.isPressed(action.keys[i])) {
								return true;
							}
						}
					}
					break;
				case ACTION_MOUSE:
					if (this._mouse && this._mouse.isPressed(action.button)) {
						return true;
					}
					break;
				case ACTION_GAMEPAD:
					if (this._gamepads && this._gamepads.isPressed(action.pad, action.button)) {
						return true;
					}
					break;
			}
		}
		return false;
	}
	wasPressed(actionName) {
		if (!this._actions[actionName]) {
			return false;
		}
		const length = this._actions[actionName].length;
		for (let index = 0; index < length; ++index) {
			const action = this._actions[actionName][index];
			switch (action.type) {
				case ACTION_KEYBOARD:
					if (this._keyboard) {
						const len = action.keys.length;
						for (let i = 0; i < len; i++) {
							if (this._keyboard.wasPressed(action.keys[i])) {
								return true;
							}
						}
					}
					break;
				case ACTION_MOUSE:
					if (this._mouse && this._mouse.wasPressed(action.button)) {
						return true;
					}
					break;
				case ACTION_GAMEPAD:
					if (this._gamepads && this._gamepads.wasPressed(action.pad, action.button)) {
						return true;
					}
					break;
			}
		}
		return false;
	}
	getAxis(name) {
		let value = 0;
		if (this._axes[name]) {
			const len = this._axes[name].length;
			for (let i = 0; i < len; i++) {
				if (type(this._axes[name][i]) === 'function') {
					const v = this._axes[name][i]();
					if (Math.abs(v) > Math.abs(value)) {
						value = v;
					}
				} else if (this._axesValues[name]) {
					if (Math.abs(this._axesValues[name][i]) > Math.abs(value)) {
						value = this._axesValues[name][i];
					}
				}
			}
		}
		return value;
	}
	_enableMouse() {
		this._mouse = new Mouse();
		if (!this._element) {
			throw new Error('Controller must be attached to an Element');
		}
		this._mouse.attach(this._element);
	}
	_enableKeyboard() {
		this._keyboard = new Keyboard();
		if (!this._element) {
			throw new Error('Controller must be attached to an Element');
		}
		this._keyboard.attach(this._element);
	}
}

export { Controller };
