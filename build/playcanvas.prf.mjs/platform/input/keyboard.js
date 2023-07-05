import '../../core/debug.js';
import { EventHandler } from '../../core/event-handler.js';
import { KeyboardEvent } from './keyboard-event.js';

const _keyboardEvent = new KeyboardEvent();
function makeKeyboardEvent(event) {
	_keyboardEvent.key = event.keyCode;
	_keyboardEvent.element = event.target;
	_keyboardEvent.event = event;
	return _keyboardEvent;
}
function toKeyCode(s) {
	if (typeof s === 'string') {
		return s.toUpperCase().charCodeAt(0);
	}
	return s;
}
const _keyCodeToKeyIdentifier = {
	'9': 'Tab',
	'13': 'Enter',
	'16': 'Shift',
	'17': 'Control',
	'18': 'Alt',
	'27': 'Escape',
	'37': 'Left',
	'38': 'Up',
	'39': 'Right',
	'40': 'Down',
	'46': 'Delete',
	'91': 'Win'
};
class Keyboard extends EventHandler {
	constructor(element, options = {}) {
		super();
		this._element = null;
		this._keyDownHandler = this._handleKeyDown.bind(this);
		this._keyUpHandler = this._handleKeyUp.bind(this);
		this._keyPressHandler = this._handleKeyPress.bind(this);
		this._visibilityChangeHandler = this._handleVisibilityChange.bind(this);
		this._windowBlurHandler = this._handleWindowBlur.bind(this);
		this._keymap = {};
		this._lastmap = {};
		if (element) {
			this.attach(element);
		}
		this.preventDefault = options.preventDefault || false;
		this.stopPropagation = options.stopPropagation || false;
	}
	attach(element) {
		if (this._element) {
			this.detach();
		}
		this._element = element;
		this._element.addEventListener('keydown', this._keyDownHandler, false);
		this._element.addEventListener('keypress', this._keyPressHandler, false);
		this._element.addEventListener('keyup', this._keyUpHandler, false);
		document.addEventListener('visibilitychange', this._visibilityChangeHandler, false);
		window.addEventListener('blur', this._windowBlurHandler, false);
	}
	detach() {
		if (!this._element) {
			return;
		}
		this._element.removeEventListener('keydown', this._keyDownHandler);
		this._element.removeEventListener('keypress', this._keyPressHandler);
		this._element.removeEventListener('keyup', this._keyUpHandler);
		this._element = null;
		document.removeEventListener('visibilitychange', this._visibilityChangeHandler, false);
		window.removeEventListener('blur', this._windowBlurHandler, false);
	}
	toKeyIdentifier(keyCode) {
		keyCode = toKeyCode(keyCode);
		const id = _keyCodeToKeyIdentifier[keyCode.toString()];
		if (id) {
			return id;
		}
		let hex = keyCode.toString(16).toUpperCase();
		const length = hex.length;
		for (let count = 0; count < 4 - length; count++) {
			hex = '0' + hex;
		}
		return 'U+' + hex;
	}
	_handleKeyDown(event) {
		const code = event.keyCode || event.charCode;
		if (code === undefined) return;
		const id = this.toKeyIdentifier(code);
		this._keymap[id] = true;
		this.fire('keydown', makeKeyboardEvent(event));
		if (this.preventDefault) {
			event.preventDefault();
		}
		if (this.stopPropagation) {
			event.stopPropagation();
		}
	}
	_handleKeyUp(event) {
		const code = event.keyCode || event.charCode;
		if (code === undefined) return;
		const id = this.toKeyIdentifier(code);
		delete this._keymap[id];
		this.fire('keyup', makeKeyboardEvent(event));
		if (this.preventDefault) {
			event.preventDefault();
		}
		if (this.stopPropagation) {
			event.stopPropagation();
		}
	}
	_handleKeyPress(event) {
		this.fire('keypress', makeKeyboardEvent(event));
		if (this.preventDefault) {
			event.preventDefault();
		}
		if (this.stopPropagation) {
			event.stopPropagation();
		}
	}
	_handleVisibilityChange() {
		if (document.visibilityState === 'hidden') {
			this._handleWindowBlur();
		}
	}
	_handleWindowBlur() {
		this._keymap = {};
		this._lastmap = {};
	}
	update() {
		for (const prop in this._lastmap) {
			delete this._lastmap[prop];
		}
		for (const prop in this._keymap) {
			if (this._keymap.hasOwnProperty(prop)) {
				this._lastmap[prop] = this._keymap[prop];
			}
		}
	}
	isPressed(key) {
		const keyCode = toKeyCode(key);
		const id = this.toKeyIdentifier(keyCode);
		return !!this._keymap[id];
	}
	wasPressed(key) {
		const keyCode = toKeyCode(key);
		const id = this.toKeyIdentifier(keyCode);
		return !!this._keymap[id] && !!!this._lastmap[id];
	}
	wasReleased(key) {
		const keyCode = toKeyCode(key);
		const id = this.toKeyIdentifier(keyCode);
		return !!!this._keymap[id] && !!this._lastmap[id];
	}
}

export { Keyboard };
