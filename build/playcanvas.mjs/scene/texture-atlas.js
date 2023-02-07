import { EventHandler } from '../core/event-handler.js';

class TextureAtlas extends EventHandler {
	constructor() {
		super();
		this._texture = null;
		this._frames = null;
	}
	set texture(value) {
		this._texture = value;
		this.fire('set:texture', value);
	}
	get texture() {
		return this._texture;
	}
	set frames(value) {
		this._frames = value;
		this.fire('set:frames', value);
	}
	get frames() {
		return this._frames;
	}
	setFrame(key, data) {
		let frame = this._frames[key];
		if (!frame) {
			frame = {
				rect: data.rect.clone(),
				pivot: data.pivot.clone(),
				border: data.border.clone()
			};
			this._frames[key] = frame;
		} else {
			frame.rect.copy(data.rect);
			frame.pivot.copy(data.pivot);
			frame.border.copy(data.border);
		}
		this.fire('set:frame', key.toString(), frame);
	}
	removeFrame(key) {
		const frame = this._frames[key];
		if (frame) {
			delete this._frames[key];
			this.fire('remove:frame', key.toString(), frame);
		}
	}
	destroy() {
		if (this._texture) {
			this._texture.destroy();
		}
	}
}

export { TextureAtlas };
