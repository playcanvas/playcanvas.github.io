import { DEFAULT_LOCALE, DEFAULT_LOCALE_FALLBACKS } from './constants.js';

const PLURALS = {};
function definePluralFn(locales, fn) {
	for (let i = 0, len = locales.length; i < len; i++) {
		PLURALS[locales[i]] = fn;
	}
}
function getLang(locale) {
	const idx = locale.indexOf('-');
	if (idx !== -1) {
		return locale.substring(0, idx);
	}
	return locale;
}
function replaceLang(locale, desiredLang) {
	const idx = locale.indexOf('-');
	if (idx !== -1) {
		return desiredLang + locale.substring(idx);
	}
	return desiredLang;
}
function findAvailableLocale(desiredLocale, availableLocales) {
	if (availableLocales[desiredLocale]) {
		return desiredLocale;
	}
	let fallback = DEFAULT_LOCALE_FALLBACKS[desiredLocale];
	if (fallback && availableLocales[fallback]) {
		return fallback;
	}
	const lang = getLang(desiredLocale);
	fallback = DEFAULT_LOCALE_FALLBACKS[lang];
	if (availableLocales[fallback]) {
		return fallback;
	}
	if (availableLocales[lang]) {
		return lang;
	}
	return DEFAULT_LOCALE;
}
definePluralFn(['ja', 'ko', 'th', 'vi', 'zh', 'id'], function (n) {
	return 0;
});
definePluralFn(['fa', 'hi'], function (n) {
	if (n >= 0 && n <= 1) {
		return 0;
	}
	return 1;
});
definePluralFn(['fr', 'pt'], function (n) {
	if (n >= 0 && n < 2) {
		return 0;
	}
	return 1;
});
definePluralFn(['da'], function (n) {
	if (n === 1 || !Number.isInteger(n) && n >= 0 && n <= 1) {
		return 0;
	}
	return 1;
});
definePluralFn(['de', 'en', 'it', 'el', 'es', 'tr', 'fi', 'sv', 'nb', 'no', 'ur'], function (n) {
	if (n === 1) {
		return 0;
	}
	return 1;
});
definePluralFn(['ru', 'uk'], function (n) {
	if (Number.isInteger(n)) {
		const mod10 = n % 10;
		const mod100 = n % 100;
		if (mod10 === 1 && mod100 !== 11) {
			return 0;
		} else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
			return 1;
		} else if (mod10 === 0 || mod10 >= 5 && mod10 <= 9 || mod100 >= 11 && mod100 <= 14) {
			return 2;
		}
	}
	return 3;
});
definePluralFn(['pl'], function (n) {
	if (Number.isInteger(n)) {
		if (n === 1) {
			return 0;
		}
		const mod10 = n % 10;
		const mod100 = n % 100;
		if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
			return 1;
		} else if (mod10 >= 0 && mod10 <= 1 || mod10 >= 5 && mod10 <= 9 || mod100 >= 12 && mod100 <= 14) {
			return 2;
		}
	}
	return 3;
});
definePluralFn(['ar'], function (n) {
	if (n === 0) {
		return 0;
	} else if (n === 1) {
		return 1;
	} else if (n === 2) {
		return 2;
	}
	if (Number.isInteger(n)) {
		const mod100 = n % 100;
		if (mod100 >= 3 && mod100 <= 10) {
			return 3;
		} else if (mod100 >= 11 && mod100 <= 99) {
			return 4;
		}
	}
	return 5;
});
const DEFAULT_PLURAL_FN = PLURALS[getLang(DEFAULT_LOCALE)];
function getPluralFn(lang) {
	return PLURALS[lang] || DEFAULT_PLURAL_FN;
}

export { findAvailableLocale, getLang, getPluralFn, replaceLang };
