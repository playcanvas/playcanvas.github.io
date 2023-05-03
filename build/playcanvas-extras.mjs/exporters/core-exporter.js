/**
 * @license
 * PlayCanvas Engine v1.63.0 revision 29d4ce307
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class CoreExporter {
	textureToCanvas(texture, options = {}) {
		const image = texture.getSource();
		if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement || typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas || typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {
			let {
				width,
				height
			} = image;
			const maxTextureSize = options.maxTextureSize;
			if (maxTextureSize) {
				const scale = Math.min(maxTextureSize / Math.max(width, height), 1);
				width = Math.round(width * scale);
				height = Math.round(height * scale);
			}
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext('2d');
			context.drawImage(image, 0, 0, canvas.width, canvas.height);
			if (options.color) {
				const {
					r,
					g,
					b
				} = options.color;
				const imagedata = context.getImageData(0, 0, width, height);
				const data = imagedata.data;
				for (let i = 0; i < data.length; i += 4) {
					data[i + 0] = data[i + 0] * r;
					data[i + 1] = data[i + 1] * g;
					data[i + 2] = data[i + 2] * b;
				}
				context.putImageData(imagedata, 0, 0);
			}
			return canvas;
		}
	}
}

export { CoreExporter };
