import { math } from './math.js';

const oneDiv255 = 1 / 255;
const floatView = new Float32Array(1);
const int32View = new Int32Array(floatView.buffer);
class FloatPacking {
	static float2Half(value) {
		floatView[0] = value;
		const x = int32View[0];
		let bits = x >> 16 & 0x8000;
		let m = x >> 12 & 0x07ff;
		const e = x >> 23 & 0xff;
		if (e < 103) {
			return bits;
		}
		if (e > 142) {
			bits |= 0x7c00;
			bits |= (e === 255 ? 0 : 1) && x & 0x007fffff;
			return bits;
		}
		if (e < 113) {
			m |= 0x0800;
			bits |= (m >> 114 - e) + (m >> 113 - e & 1);
			return bits;
		}
		bits |= e - 112 << 10 | m >> 1;
		bits += m & 1;
		return bits;
	}
	static float2Bytes(value, array, offset, numBytes) {
		const enc1 = 255.0 * value % 1;
		array[offset + 0] = Math.round((value % 1 - oneDiv255 * enc1) * 255);
		if (numBytes > 1) {
			const enc2 = 65025.0 * value % 1;
			array[offset + 1] = Math.round((enc1 - oneDiv255 * enc2) * 255);
			if (numBytes > 2) {
				const enc3 = 16581375.0 * value % 1;
				array[offset + 2] = Math.round((enc2 - oneDiv255 * enc3) * 255);
				if (numBytes > 3) {
					array[offset + 3] = Math.round(enc3 * 255);
				}
			}
		}
	}
	static float2BytesRange(value, array, offset, min, max, numBytes) {
		value = math.clamp((value - min) / (max - min), 0, 1);
		FloatPacking.float2Bytes(value, array, offset, numBytes);
	}
	static float2MantissaExponent(value, array, offset, numBytes) {
		const exponent = Math.floor(Math.log2(Math.abs(value))) + 1;
		value /= Math.pow(2, exponent);
		FloatPacking.float2BytesRange(value, array, offset, -1, 1, numBytes - 1);
		array[offset + numBytes - 1] = Math.round(exponent + 127);
	}
}

export { FloatPacking };
