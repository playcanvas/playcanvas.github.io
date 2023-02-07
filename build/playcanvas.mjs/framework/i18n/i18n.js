import { EventHandler } from '../../core/event-handler.js';
import { Asset } from '../asset/asset.js';
import { I18nParser } from './i18n-parser.js';
import { DEFAULT_LOCALE, DEFAULT_LOCALE_FALLBACKS } from './constants.js';
import { getLang, replaceLang, getPluralFn, findAvailableLocale } from './utils.js';

class I18n extends EventHandler {
	constructor(app) {
		super();
		this.locale = DEFAULT_LOCALE;
		this._translations = {};
		this._availableLangs = {};
		this._app = app;
		this._assets = [];
		this._parser = new I18nParser();
	}
	set assets(value) {
		const index = {};
		for (let _i = 0, len = value.length; _i < len; _i++) {
			const id = value[_i] instanceof Asset ? value[_i].id : value[_i];
			index[id] = true;
		}
		let i = this._assets.length;
		while (i--) {
			const id = this._assets[i];
			if (!index[id]) {
				this._app.assets.off('add:' + id, this._onAssetAdd, this);
				const asset = this._app.assets.get(id);
				if (asset) {
					this._onAssetRemove(asset);
				}
				this._assets.splice(i, 1);
			}
		}
		for (const id in index) {
			const idNum = parseInt(id, 10);
			if (this._assets.indexOf(idNum) !== -1) continue;
			this._assets.push(idNum);
			const asset = this._app.assets.get(idNum);
			if (!asset) {
				this._app.assets.once('add:' + idNum, this._onAssetAdd, this);
			} else {
				this._onAssetAdd(asset);
			}
		}
	}
	get assets() {
		return this._assets;
	}
	set locale(value) {
		if (this._locale === value) {
			return;
		}
		let lang = getLang(value);
		if (lang === 'in') {
			lang = 'id';
			value = replaceLang(value, lang);
			if (this._locale === value) {
				return;
			}
		}
		const old = this._locale;
		this._locale = value;
		this._lang = lang;
		this._pluralFn = getPluralFn(this._lang);
		this.fire('set:locale', value, old);
	}
	get locale() {
		return this._locale;
	}
	static findAvailableLocale(desiredLocale, availableLocales) {
		return findAvailableLocale(desiredLocale, availableLocales);
	}
	findAvailableLocale(desiredLocale) {
		if (this._translations[desiredLocale]) {
			return desiredLocale;
		}
		const lang = getLang(desiredLocale);
		return this._findFallbackLocale(desiredLocale, lang);
	}
	getText(key, locale) {
		let result = key;
		let lang;
		if (!locale) {
			locale = this._locale;
			lang = this._lang;
		}
		let translations = this._translations[locale];
		if (!translations) {
			if (!lang) {
				lang = getLang(locale);
			}
			locale = this._findFallbackLocale(locale, lang);
			translations = this._translations[locale];
		}
		if (translations && translations.hasOwnProperty(key)) {
			result = translations[key];
			if (Array.isArray(result)) {
				result = result[0];
			}
			if (result === null || result === undefined) {
				result = key;
			}
		}
		return result;
	}
	getPluralText(key, n, locale) {
		let result = key;
		let lang;
		let pluralFn;
		if (!locale) {
			locale = this._locale;
			lang = this._lang;
			pluralFn = this._pluralFn;
		} else {
			lang = getLang(locale);
			pluralFn = getPluralFn(lang);
		}
		let translations = this._translations[locale];
		if (!translations) {
			locale = this._findFallbackLocale(locale, lang);
			lang = getLang(locale);
			pluralFn = getPluralFn(lang);
			translations = this._translations[locale];
		}
		if (translations && translations[key] && pluralFn) {
			const index = pluralFn(n);
			result = translations[key][index];
			if (result === null || result === undefined) {
				result = key;
			}
		}
		return result;
	}
	addData(data) {
		let parsed;
		try {
			parsed = this._parser.parse(data);
		} catch (err) {
			console.error(err);
			return;
		}
		for (let i = 0, len = parsed.length; i < len; i++) {
			const entry = parsed[i];
			const locale = entry.info.locale;
			const messages = entry.messages;
			if (!this._translations[locale]) {
				this._translations[locale] = {};
				const lang = getLang(locale);
				if (!this._availableLangs[lang]) {
					this._availableLangs[lang] = locale;
				}
			}
			Object.assign(this._translations[locale], messages);
			this.fire('data:add', locale, messages);
		}
	}
	removeData(data) {
		let parsed;
		try {
			parsed = this._parser.parse(data);
		} catch (err) {
			console.error(err);
			return;
		}
		for (let i = 0, len = parsed.length; i < len; i++) {
			const entry = parsed[i];
			const locale = entry.info.locale;
			const translations = this._translations[locale];
			if (!translations) continue;
			const messages = entry.messages;
			for (const key in messages) {
				delete translations[key];
			}
			if (Object.keys(translations).length === 0) {
				delete this._translations[locale];
				delete this._availableLangs[getLang(locale)];
			}
			this.fire('data:remove', locale, messages);
		}
	}
	destroy() {
		this._translations = null;
		this._availableLangs = null;
		this._assets = null;
		this._parser = null;
		this.off();
	}
	_findFallbackLocale(locale, lang) {
		let result = DEFAULT_LOCALE_FALLBACKS[locale];
		if (result && this._translations[result]) {
			return result;
		}
		result = DEFAULT_LOCALE_FALLBACKS[lang];
		if (result && this._translations[result]) {
			return result;
		}
		result = this._availableLangs[lang];
		if (result && this._translations[result]) {
			return result;
		}
		return DEFAULT_LOCALE;
	}
	_onAssetAdd(asset) {
		asset.on('load', this._onAssetLoad, this);
		asset.on('change', this._onAssetChange, this);
		asset.on('remove', this._onAssetRemove, this);
		asset.on('unload', this._onAssetUnload, this);
		if (asset.resource) {
			this._onAssetLoad(asset);
		}
	}
	_onAssetLoad(asset) {
		this.addData(asset.resource);
	}
	_onAssetChange(asset) {
		if (asset.resource) {
			this.addData(asset.resource);
		}
	}
	_onAssetRemove(asset) {
		asset.off('load', this._onAssetLoad, this);
		asset.off('change', this._onAssetChange, this);
		asset.off('remove', this._onAssetRemove, this);
		asset.off('unload', this._onAssetUnload, this);
		if (asset.resource) {
			this.removeData(asset.resource);
		}
		this._app.assets.once('add:' + asset.id, this._onAssetAdd, this);
	}
	_onAssetUnload(asset) {
		if (asset.resource) {
			this.removeData(asset.resource);
		}
	}
}

export { I18n };
