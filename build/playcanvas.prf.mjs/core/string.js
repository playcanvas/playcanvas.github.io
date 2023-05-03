const ASCII_LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const ASCII_UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ASCII_LETTERS = ASCII_LOWERCASE + ASCII_UPPERCASE;
const HIGH_SURROGATE_BEGIN = 0xD800;
const HIGH_SURROGATE_END = 0xDBFF;
const LOW_SURROGATE_BEGIN = 0xDC00;
const LOW_SURROGATE_END = 0xDFFF;
const ZERO_WIDTH_JOINER = 0x200D;
const REGIONAL_INDICATOR_BEGIN = 0x1F1E6;
const REGIONAL_INDICATOR_END = 0x1F1FF;
const FITZPATRICK_MODIFIER_BEGIN = 0x1F3FB;
const FITZPATRICK_MODIFIER_END = 0x1F3FF;
const DIACRITICAL_MARKS_BEGIN = 0x20D0;
const DIACRITICAL_MARKS_END = 0x20FF;
const VARIATION_MODIFIER_BEGIN = 0xFE00;
const VARIATION_MODIFIER_END = 0xFE0F;
function getCodePointData(string, i = 0) {
	const size = string.length;
	if (i < 0 || i >= size) {
		return null;
	}
	const first = string.charCodeAt(i);
	if (size > 1 && first >= HIGH_SURROGATE_BEGIN && first <= HIGH_SURROGATE_END) {
		const second = string.charCodeAt(i + 1);
		if (second >= LOW_SURROGATE_BEGIN && second <= LOW_SURROGATE_END) {
			return {
				code: (first - HIGH_SURROGATE_BEGIN) * 0x400 + second - LOW_SURROGATE_BEGIN + 0x10000,
				long: true
			};
		}
	}
	return {
		code: first,
		long: false
	};
}
function isCodeBetween(string, begin, end) {
	if (!string) return false;
	const codeData = getCodePointData(string);
	if (codeData) {
		const code = codeData.code;
		return code >= begin && code <= end;
	}
	return false;
}
function numCharsToTakeForNextSymbol(string, index) {
	if (index === string.length - 1) {
		return 1;
	}
	if (isCodeBetween(string[index], HIGH_SURROGATE_BEGIN, HIGH_SURROGATE_END)) {
		const first = string.substring(index, index + 2);
		const second = string.substring(index + 2, index + 4);
		if (isCodeBetween(second, FITZPATRICK_MODIFIER_BEGIN, FITZPATRICK_MODIFIER_END) || isCodeBetween(first, REGIONAL_INDICATOR_BEGIN, REGIONAL_INDICATOR_END) && isCodeBetween(second, REGIONAL_INDICATOR_BEGIN, REGIONAL_INDICATOR_END)) {
			return 4;
		}
		if (isCodeBetween(second, VARIATION_MODIFIER_BEGIN, VARIATION_MODIFIER_END)) {
			return 3;
		}
		return 2;
	}
	if (isCodeBetween(string[index + 1], VARIATION_MODIFIER_BEGIN, VARIATION_MODIFIER_END)) {
		return 2;
	}
	return 1;
}
const string = {
	ASCII_LOWERCASE: ASCII_LOWERCASE,
	ASCII_UPPERCASE: ASCII_UPPERCASE,
	ASCII_LETTERS: ASCII_LETTERS,
	format: function (s) {
		for (let i = 1; i < arguments.length; i++) {
			s = s.replace('{' + (i - 1) + '}', arguments[i]);
		}
		return s;
	},
	toBool: function (s, strict = false) {
		if (s === 'true') {
			return true;
		}
		if (strict) {
			if (s === 'false') {
				return false;
			}
			throw new TypeError('Not a boolean string');
		}
		return false;
	},
	getCodePoint: function (string, i) {
		const codePointData = getCodePointData(string, i);
		return codePointData && codePointData.code;
	},
	getCodePoints: function (string) {
		if (typeof string !== 'string') {
			throw new TypeError('Not a string');
		}
		let i = 0;
		const arr = [];
		let codePoint;
		while (!!(codePoint = getCodePointData(string, i))) {
			arr.push(codePoint.code);
			i += codePoint.long ? 2 : 1;
		}
		return arr;
	},
	getSymbols: function (string) {
		if (typeof string !== 'string') {
			throw new TypeError('Not a string');
		}
		let index = 0;
		const length = string.length;
		const output = [];
		let take = 0;
		let ch;
		while (index < length) {
			take += numCharsToTakeForNextSymbol(string, index + take);
			ch = string[index + take];
			if (isCodeBetween(ch, DIACRITICAL_MARKS_BEGIN, DIACRITICAL_MARKS_END)) {
				ch = string[index + take++];
			}
			if (isCodeBetween(ch, VARIATION_MODIFIER_BEGIN, VARIATION_MODIFIER_END)) {
				ch = string[index + take++];
			}
			if (ch && ch.charCodeAt(0) === ZERO_WIDTH_JOINER) {
				ch = string[index + take++];
				continue;
			}
			const char = string.substring(index, index + take);
			output.push(char);
			index += take;
			take = 0;
		}
		return output;
	},
	fromCodePoint: function () {
		const chars = [];
		let current;
		let codePoint;
		let units;
		for (let i = 0; i < arguments.length; ++i) {
			current = Number(arguments[i]);
			codePoint = current - 0x10000;
			units = current > 0xFFFF ? [(codePoint >> 10) + 0xD800, codePoint % 0x400 + 0xDC00] : [current];
			chars.push(String.fromCharCode.apply(null, units));
		}
		return chars.join('');
	}
};

export { string };
