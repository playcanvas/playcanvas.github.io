import { FONT_MSDF } from './constants.js';

class Font {
	constructor(textures, data) {
		this.type = data ? data.type || FONT_MSDF : FONT_MSDF;
		this.em = 1;
		this.textures = textures;
		this.intensity = 0.0;
		this._data = null;
		this.data = data;
	}
	set data(value) {
		this._data = value;
		if (!value) return;
		if (this._data.intensity !== undefined) {
			this.intensity = this._data.intensity;
		}
		if (!this._data.info) this._data.info = {};
		if (!this._data.version || this._data.version < 2) {
			this._data.info.maps = [{
				width: this._data.info.width,
				height: this._data.info.height
			}];
			if (this._data.chars) {
				for (const key in this._data.chars) {
					this._data.chars[key].map = 0;
				}
			}
		}
	}
	get data() {
		return this._data;
	}
}

export { Font };
