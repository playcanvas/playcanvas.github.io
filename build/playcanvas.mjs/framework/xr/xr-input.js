import { EventHandler } from '../../core/event-handler.js';
import { XrInputSource } from './xr-input-source.js';

class XrInput extends EventHandler {
	constructor(manager) {
		super();
		this.manager = void 0;
		this._inputSources = [];
		this._onInputSourcesChangeEvt = void 0;
		this.manager = manager;
		this._onInputSourcesChangeEvt = evt => {
			this._onInputSourcesChange(evt);
		};
		this.manager.on('start', this._onSessionStart, this);
		this.manager.on('end', this._onSessionEnd, this);
	}
	_onSessionStart() {
		const session = this.manager.session;
		session.addEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
		session.addEventListener('select', evt => {
			const inputSource = this._getByInputSource(evt.inputSource);
			inputSource.update(evt.frame);
			inputSource.fire('select', evt);
			this.fire('select', inputSource, evt);
		});
		session.addEventListener('selectstart', evt => {
			const inputSource = this._getByInputSource(evt.inputSource);
			inputSource.update(evt.frame);
			inputSource._selecting = true;
			inputSource.fire('selectstart', evt);
			this.fire('selectstart', inputSource, evt);
		});
		session.addEventListener('selectend', evt => {
			const inputSource = this._getByInputSource(evt.inputSource);
			inputSource.update(evt.frame);
			inputSource._selecting = false;
			inputSource.fire('selectend', evt);
			this.fire('selectend', inputSource, evt);
		});
		session.addEventListener('squeeze', evt => {
			const inputSource = this._getByInputSource(evt.inputSource);
			inputSource.update(evt.frame);
			inputSource.fire('squeeze', evt);
			this.fire('squeeze', inputSource, evt);
		});
		session.addEventListener('squeezestart', evt => {
			const inputSource = this._getByInputSource(evt.inputSource);
			inputSource.update(evt.frame);
			inputSource._squeezing = true;
			inputSource.fire('squeezestart', evt);
			this.fire('squeezestart', inputSource, evt);
		});
		session.addEventListener('squeezeend', evt => {
			const inputSource = this._getByInputSource(evt.inputSource);
			inputSource.update(evt.frame);
			inputSource._squeezing = false;
			inputSource.fire('squeezeend', evt);
			this.fire('squeezeend', inputSource, evt);
		});
		const inputSources = session.inputSources;
		for (let i = 0; i < inputSources.length; i++) {
			this._addInputSource(inputSources[i]);
		}
	}
	_onSessionEnd() {
		let i = this._inputSources.length;
		while (i--) {
			const inputSource = this._inputSources[i];
			this._inputSources.splice(i, 1);
			inputSource.fire('remove');
			this.fire('remove', inputSource);
		}
		const session = this.manager.session;
		session.removeEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
	}
	_onInputSourcesChange(evt) {
		for (let i = 0; i < evt.removed.length; i++) {
			this._removeInputSource(evt.removed[i]);
		}
		for (let i = 0; i < evt.added.length; i++) {
			this._addInputSource(evt.added[i]);
		}
	}
	_getByInputSource(xrInputSource) {
		for (let i = 0; i < this._inputSources.length; i++) {
			if (this._inputSources[i].inputSource === xrInputSource) {
				return this._inputSources[i];
			}
		}
		return null;
	}
	_addInputSource(xrInputSource) {
		if (this._getByInputSource(xrInputSource)) return;
		const inputSource = new XrInputSource(this.manager, xrInputSource);
		this._inputSources.push(inputSource);
		this.fire('add', inputSource);
	}
	_removeInputSource(xrInputSource) {
		for (let i = 0; i < this._inputSources.length; i++) {
			if (this._inputSources[i].inputSource !== xrInputSource) continue;
			const inputSource = this._inputSources[i];
			this._inputSources.splice(i, 1);
			let h = inputSource.hitTestSources.length;
			while (h--) {
				inputSource.hitTestSources[h].remove();
			}
			inputSource.fire('remove');
			this.fire('remove', inputSource);
			return;
		}
	}
	update(frame) {
		for (let i = 0; i < this._inputSources.length; i++) {
			this._inputSources[i].update(frame);
		}
	}
	get inputSources() {
		return this._inputSources;
	}
}

export { XrInput };
