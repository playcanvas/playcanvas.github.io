import { platform } from '../../core/platform.js';
import { EventHandler } from '../../core/event-handler.js';
import { EVENT_MOUSEUP, EVENT_MOUSEDOWN, EVENT_MOUSEMOVE, EVENT_MOUSEWHEEL } from './constants.js';
import { isMousePointerLocked, MouseEvent } from './mouse-event.js';

class Mouse extends EventHandler {
	constructor(element) {
		super();
		this._lastX = 0;
		this._lastY = 0;
		this._buttons = [false, false, false];
		this._lastbuttons = [false, false, false];
		this._upHandler = this._handleUp.bind(this);
		this._downHandler = this._handleDown.bind(this);
		this._moveHandler = this._handleMove.bind(this);
		this._wheelHandler = this._handleWheel.bind(this);
		this._contextMenuHandler = event => {
			event.preventDefault();
		};
		this._target = null;
		this._attached = false;
		this.attach(element);
	}
	static isPointerLocked() {
		return isMousePointerLocked();
	}
	attach(element) {
		this._target = element;
		if (this._attached) return;
		this._attached = true;
		const opts = platform.passiveEvents ? {
			passive: false
		} : false;
		window.addEventListener('mouseup', this._upHandler, opts);
		window.addEventListener('mousedown', this._downHandler, opts);
		window.addEventListener('mousemove', this._moveHandler, opts);
		window.addEventListener('wheel', this._wheelHandler, opts);
	}
	detach() {
		if (!this._attached) return;
		this._attached = false;
		this._target = null;
		const opts = platform.passiveEvents ? {
			passive: false
		} : false;
		window.removeEventListener('mouseup', this._upHandler, opts);
		window.removeEventListener('mousedown', this._downHandler, opts);
		window.removeEventListener('mousemove', this._moveHandler, opts);
		window.removeEventListener('wheel', this._wheelHandler, opts);
	}
	disableContextMenu() {
		if (!this._target) return;
		this._target.addEventListener('contextmenu', this._contextMenuHandler);
	}
	enableContextMenu() {
		if (!this._target) return;
		this._target.removeEventListener('contextmenu', this._contextMenuHandler);
	}
	enablePointerLock(success, error) {
		if (!document.body.requestPointerLock) {
			if (error) error();
			return;
		}
		const s = () => {
			success();
			document.removeEventListener('pointerlockchange', s);
		};
		const e = () => {
			error();
			document.removeEventListener('pointerlockerror', e);
		};
		if (success) {
			document.addEventListener('pointerlockchange', s, false);
		}
		if (error) {
			document.addEventListener('pointerlockerror', e, false);
		}
		document.body.requestPointerLock();
	}
	disablePointerLock(success) {
		if (!document.exitPointerLock) {
			return;
		}
		const s = () => {
			success();
			document.removeEventListener('pointerlockchange', s);
		};
		if (success) {
			document.addEventListener('pointerlockchange', s, false);
		}
		document.exitPointerLock();
	}
	update() {
		this._lastbuttons[0] = this._buttons[0];
		this._lastbuttons[1] = this._buttons[1];
		this._lastbuttons[2] = this._buttons[2];
	}
	isPressed(button) {
		return this._buttons[button];
	}
	wasPressed(button) {
		return this._buttons[button] && !this._lastbuttons[button];
	}
	wasReleased(button) {
		return !this._buttons[button] && this._lastbuttons[button];
	}
	_handleUp(event) {
		this._buttons[event.button] = false;
		const e = new MouseEvent(this, event);
		if (!e.event) return;
		this.fire(EVENT_MOUSEUP, e);
	}
	_handleDown(event) {
		this._buttons[event.button] = true;
		const e = new MouseEvent(this, event);
		if (!e.event) return;
		this.fire(EVENT_MOUSEDOWN, e);
	}
	_handleMove(event) {
		const e = new MouseEvent(this, event);
		if (!e.event) return;
		this.fire(EVENT_MOUSEMOVE, e);
		this._lastX = e.x;
		this._lastY = e.y;
	}
	_handleWheel(event) {
		const e = new MouseEvent(this, event);
		if (!e.event) return;
		this.fire(EVENT_MOUSEWHEEL, e);
	}
	_getTargetCoords(event) {
		const rect = this._target.getBoundingClientRect();
		const left = Math.floor(rect.left);
		const top = Math.floor(rect.top);
		if (event.clientX < left || event.clientX >= left + this._target.clientWidth || event.clientY < top || event.clientY >= top + this._target.clientHeight) {
			return null;
		}
		return {
			x: event.clientX - left,
			y: event.clientY - top
		};
	}
}

export { Mouse };
