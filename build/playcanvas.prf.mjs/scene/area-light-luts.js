import { FloatPacking } from '../core/math/float-packing.js';
import { Texture } from '../platform/graphics/texture.js';
import { DeviceCache } from '../platform/graphics/device-cache.js';
import { ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_DEFAULT, FILTER_LINEAR, FILTER_NEAREST, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F } from '../platform/graphics/constants.js';

class AreaLightCacheEntry {
	constructor(texture0, texture1) {
		this.texture0 = texture0;
		this.texture1 = texture1;
	}
	destroy() {
		var _this$texture, _this$texture2;
		(_this$texture = this.texture0) == null ? void 0 : _this$texture.destroy();
		(_this$texture2 = this.texture1) == null ? void 0 : _this$texture2.destroy();
	}
}
const deviceCache = new DeviceCache();
class AreaLightLuts {
	static createTexture(device, format, size, postfix = '') {
		const tex = new Texture(device, {
			name: `AreaLightLUT${postfix}`,
			width: size,
			height: size,
			format: format,
			addressU: ADDRESS_CLAMP_TO_EDGE,
			addressV: ADDRESS_CLAMP_TO_EDGE,
			type: TEXTURETYPE_DEFAULT,
			magFilter: FILTER_LINEAR,
			minFilter: FILTER_NEAREST,
			anisotropy: 1,
			mipmaps: false
		});
		return tex;
	}
	static applyTextures(device, texture1, texture2) {
		deviceCache.remove(device);
		deviceCache.get(device, () => {
			return new AreaLightCacheEntry(texture1, texture1 === texture2 ? null : texture2);
		});
		device.scope.resolve('areaLightsLutTex1').setValue(texture1);
		device.scope.resolve('areaLightsLutTex2').setValue(texture2);
	}
	static createPlaceholder(device) {
		const texture = AreaLightLuts.createTexture(device, device.areaLightLutFormat, 2, 'placeholder');
		const pixels = texture.lock();
		pixels.fill(0);
		texture.unlock();
		AreaLightLuts.applyTextures(device, texture, texture);
	}
	static set(device, ltcMat1, ltcMat2) {
		function buildTexture(device, data, format) {
			const texture = AreaLightLuts.createTexture(device, format, 64);
			texture.lock().set(data);
			texture.unlock();
			return texture;
		}
		function offsetScale(data, offset, scale) {
			const count = data.length;
			const ret = new Float32Array(count);
			for (let i = 0; i < count; i++) {
				const n = i % 4;
				ret[i] = (data[i] + offset[n]) * scale[n];
			}
			return ret;
		}
		function convertToHalfFloat(data) {
			const count = data.length;
			const ret = new Uint16Array(count);
			const float2Half = FloatPacking.float2Half;
			for (let i = 0; i < count; i++) {
				ret[i] = float2Half(data[i]);
			}
			return ret;
		}
		function convertToUint(data) {
			const count = data.length;
			const ret = new Uint8ClampedArray(count);
			for (let i = 0; i < count; i++) {
				ret[i] = data[i] * 255;
			}
			return ret;
		}
		const srcData1 = ltcMat1;
		const srcData2 = ltcMat2;
		let data1, data2;
		const format = device.areaLightLutFormat;
		if (format === PIXELFORMAT_RGBA32F) {
			data1 = srcData1;
			data2 = srcData2;
		} else if (format === PIXELFORMAT_RGBA16F) {
			data1 = convertToHalfFloat(srcData1);
			data2 = convertToHalfFloat(srcData2);
		} else {
			const o1 = [0.0, 0.2976, 0.01381, 0.0];
			const s1 = [0.999, 3.08737, 1.6546, 0.603249];
			const o2 = [-0.306897, 0.0, 0.0, 0.0];
			const s2 = [1.442787, 1.0, 1.0, 1.0];
			data1 = convertToUint(offsetScale(srcData1, o1, s1));
			data2 = convertToUint(offsetScale(srcData2, o2, s2));
		}
		const tex1 = buildTexture(device, data1, format);
		const tex2 = buildTexture(device, data2, format);
		AreaLightLuts.applyTextures(device, tex1, tex2);
	}
}

export { AreaLightLuts };
