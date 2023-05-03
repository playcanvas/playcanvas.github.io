import { math } from './math.js';

class Color {
	constructor(r = 0, g = 0, b = 0, a = 1) {
		this.r = void 0;
		this.g = void 0;
		this.b = void 0;
		this.a = void 0;
		const length = r.length;
		if (length === 3 || length === 4) {
			this.r = r[0];
			this.g = r[1];
			this.b = r[2];
			this.a = r[3] !== undefined ? r[3] : 1;
		} else {
			this.r = r;
			this.g = g;
			this.b = b;
			this.a = a;
		}
	}
	clone() {
		const cstr = this.constructor;
		return new cstr(this.r, this.g, this.b, this.a);
	}
	copy(rhs) {
		this.r = rhs.r;
		this.g = rhs.g;
		this.b = rhs.b;
		this.a = rhs.a;
		return this;
	}
	equals(rhs) {
		return this.r === rhs.r && this.g === rhs.g && this.b === rhs.b && this.a === rhs.a;
	}
	set(r, g, b, a = 1) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
		return this;
	}
	lerp(lhs, rhs, alpha) {
		this.r = lhs.r + alpha * (rhs.r - lhs.r);
		this.g = lhs.g + alpha * (rhs.g - lhs.g);
		this.b = lhs.b + alpha * (rhs.b - lhs.b);
		this.a = lhs.a + alpha * (rhs.a - lhs.a);
		return this;
	}
	fromString(hex) {
		const i = parseInt(hex.replace('#', '0x'), 16);
		let bytes;
		if (hex.length > 7) {
			bytes = math.intToBytes32(i);
		} else {
			bytes = math.intToBytes24(i);
			bytes[3] = 255;
		}
		this.set(bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, bytes[3] / 255);
		return this;
	}
	toString(alpha) {
		let s = '#' + ((1 << 24) + (Math.round(this.r * 255) << 16) + (Math.round(this.g * 255) << 8) + Math.round(this.b * 255)).toString(16).slice(1);
		if (alpha === true) {
			const a = Math.round(this.a * 255).toString(16);
			if (this.a < 16 / 255) {
				s += '0' + a;
			} else {
				s += a;
			}
		}
		return s;
	}
}
Color.BLACK = Object.freeze(new Color(0, 0, 0, 1));
Color.BLUE = Object.freeze(new Color(0, 0, 1, 1));
Color.CYAN = Object.freeze(new Color(0, 1, 1, 1));
Color.GRAY = Object.freeze(new Color(0.5, 0.5, 0.5, 1));
Color.GREEN = Object.freeze(new Color(0, 1, 0, 1));
Color.MAGENTA = Object.freeze(new Color(1, 0, 1, 1));
Color.RED = Object.freeze(new Color(1, 0, 0, 1));
Color.WHITE = Object.freeze(new Color(1, 1, 1, 1));
Color.YELLOW = Object.freeze(new Color(1, 1, 0, 1));

export { Color };
