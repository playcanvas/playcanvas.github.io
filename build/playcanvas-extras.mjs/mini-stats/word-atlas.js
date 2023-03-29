/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class WordAtlas {
	constructor(texture, words) {
		const canvas = document.createElement('canvas');
		canvas.width = texture.width;
		canvas.height = texture.height;
		const context = canvas.getContext('2d', {
			alpha: true
		});
		context.font = '10px "Lucida Console", Monaco, monospace';
		context.textAlign = 'left';
		context.textBaseline = 'alphabetic';
		context.fillStyle = 'rgb(255, 255, 255)';
		const padding = 5;
		let x = padding;
		let y = padding;
		const placements = [];
		for (let i = 0; i < words.length; ++i) {
			const measurement = context.measureText(words[i]);
			const l = Math.ceil(-measurement.actualBoundingBoxLeft);
			const r = Math.ceil(measurement.actualBoundingBoxRight);
			const a = Math.ceil(measurement.actualBoundingBoxAscent);
			const d = Math.ceil(measurement.actualBoundingBoxDescent);
			const w = l + r;
			const h = a + d;
			if (x + w >= canvas.width) {
				x = padding;
				y += 16;
			}
			context.fillStyle = words[i].length === 1 ? 'rgb(255, 255, 255)' : 'rgb(150, 150, 150)';
			context.fillText(words[i], x - l, y + a);
			placements.push({
				l: l,
				r: r,
				a: a,
				d: d,
				x: x,
				y: y,
				w: w,
				h: h
			});
			x += w + padding;
		}
		const wordMap = {};
		words.forEach((w, i) => {
			wordMap[w] = i;
		});
		this.words = words;
		this.wordMap = wordMap;
		this.placements = placements;
		this.texture = texture;
		const source = context.getImageData(0, 0, canvas.width, canvas.height);
		const dest = texture.lock();
		for (let _y = 0; _y < source.height; ++_y) {
			for (let _x = 0; _x < source.width; ++_x) {
				const offset = (_x + _y * texture.width) * 4;
				dest[offset] = 255;
				dest[offset + 1] = 255;
				dest[offset + 2] = 255;
				const red = source.data[(_x + (source.height - 1 - _y) * source.width) * 4];
				const alpha = source.data[(_x + (source.height - 1 - _y) * source.width) * 4 + 3];
				dest[offset + 3] = alpha * (red > 150 ? 1 : 0.7);
			}
		}
	}
	render(render2d, word, x, y) {
		const p = this.placements[this.wordMap[word]];
		if (p) {
			const padding = 1;
			render2d.quad(this.texture, x + p.l - padding, y - p.d + padding, p.w + padding * 2, p.h + padding * 2, p.x - padding, 64 - p.y - p.h - padding, undefined, undefined, true);
			return p.w;
		}
		return 0;
	}
}

export { WordAtlas };
