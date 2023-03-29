/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class Graph {
	constructor(name, app, watermark, textRefreshRate, timer) {
		this.name = name;
		this.device = app.graphicsDevice;
		this.timer = timer;
		this.watermark = watermark;
		this.enabled = false;
		this.textRefreshRate = textRefreshRate;
		this.avgTotal = 0;
		this.avgTimer = 0;
		this.avgCount = 0;
		this.timingText = '';
		this.texture = null;
		this.yOffset = 0;
		this.cursor = 0;
		this.sample = new Uint8ClampedArray(4);
		this.sample.set([0, 0, 0, 255]);
		app.on('frameupdate', this.update.bind(this));
		this.counter = 0;
	}
	loseContext() {
		if (this.timer && typeof this.timer.loseContext === 'function') {
			this.timer.loseContext();
		}
	}
	update(ms) {
		const timings = this.timer.timings;
		const total = timings.reduce((a, v) => a + v, 0);
		this.avgTotal += total;
		this.avgTimer += ms;
		this.avgCount++;
		if (this.avgTimer > this.textRefreshRate) {
			this.timingText = (this.avgTotal / this.avgCount).toFixed(this.timer.decimalPlaces);
			this.avgTimer = 0;
			this.avgTotal = 0;
			this.avgCount = 0;
		}
		if (this.enabled) {
			let value = 0;
			const range = 1.5 * this.watermark;
			for (let i = 0; i < timings.length; ++i) {
				value += Math.floor(timings[i] / range * 255);
				this.sample[i] = value;
			}
			this.sample[3] = this.watermark / range * 255;
			const gl = this.device.gl;
			this.device.bindTexture(this.texture);
			gl.texSubImage2D(gl.TEXTURE_2D, 0, this.cursor, this.yOffset, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.sample);
			this.cursor++;
			if (this.cursor === this.texture.width) {
				this.cursor = 0;
			}
		}
	}
	render(render2d, x, y, w, h) {
		render2d.quad(this.texture, x + w, y, -w, h, this.cursor, 0.5 + this.yOffset, -w, 0, this.enabled);
	}
}

export { Graph };
