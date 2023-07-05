const math = {
	DEG_TO_RAD: Math.PI / 180,
	RAD_TO_DEG: 180 / Math.PI,
	clamp: function (value, min, max) {
		if (value >= max) return max;
		if (value <= min) return min;
		return value;
	},
	intToBytes24: function (i) {
		const r = i >> 16 & 0xff;
		const g = i >> 8 & 0xff;
		const b = i & 0xff;
		return [r, g, b];
	},
	intToBytes32: function (i) {
		const r = i >> 24 & 0xff;
		const g = i >> 16 & 0xff;
		const b = i >> 8 & 0xff;
		const a = i & 0xff;
		return [r, g, b, a];
	},
	bytesToInt24: function (r, g, b) {
		if (r.length) {
			b = r[2];
			g = r[1];
			r = r[0];
		}
		return r << 16 | g << 8 | b;
	},
	bytesToInt32: function (r, g, b, a) {
		if (r.length) {
			a = r[3];
			b = r[2];
			g = r[1];
			r = r[0];
		}
		return (r << 24 | g << 16 | b << 8 | a) >>> 0;
	},
	lerp: function (a, b, alpha) {
		return a + (b - a) * math.clamp(alpha, 0, 1);
	},
	lerpAngle: function (a, b, alpha) {
		if (b - a > 180) {
			b -= 360;
		}
		if (b - a < -180) {
			b += 360;
		}
		return math.lerp(a, b, math.clamp(alpha, 0, 1));
	},
	powerOfTwo: function (x) {
		return x !== 0 && !(x & x - 1);
	},
	nextPowerOfTwo: function (val) {
		val--;
		val |= val >> 1;
		val |= val >> 2;
		val |= val >> 4;
		val |= val >> 8;
		val |= val >> 16;
		val++;
		return val;
	},
	nearestPowerOfTwo: function (val) {
		return Math.pow(2, Math.round(Math.log(val) / Math.log(2)));
	},
	random: function (min, max) {
		const diff = max - min;
		return Math.random() * diff + min;
	},
	smoothstep: function (min, max, x) {
		if (x <= min) return 0;
		if (x >= max) return 1;
		x = (x - min) / (max - min);
		return x * x * (3 - 2 * x);
	},
	smootherstep: function (min, max, x) {
		if (x <= min) return 0;
		if (x >= max) return 1;
		x = (x - min) / (max - min);
		return x * x * x * (x * (x * 6 - 15) + 10);
	},
	roundUp: function (numToRound, multiple) {
		if (multiple === 0) return numToRound;
		return Math.ceil(numToRound / multiple) * multiple;
	},
	between: function (num, a, b, inclusive) {
		const min = Math.min(a, b);
		const max = Math.max(a, b);
		return inclusive ? num >= min && num <= max : num > min && num < max;
	}
};

export { math };
