/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { platform } from '../../core/platform.js';

class XrDomOverlay {
	constructor(manager) {
		this._manager = void 0;
		this._supported = platform.browser && !!window.XRDOMOverlayState;
		this._root = null;
		this._manager = manager;
	}
	get supported() {
		return this._supported;
	}
	get available() {
		return this._supported && this._manager.active && this._manager._session.domOverlayState !== null;
	}
	get state() {
		if (!this._supported || !this._manager.active || !this._manager._session.domOverlayState) return null;
		return this._manager._session.domOverlayState.type;
	}
	set root(value) {
		if (!this._supported || this._manager.active) return;
		this._root = value;
	}
	get root() {
		return this._root;
	}
}

export { XrDomOverlay };
