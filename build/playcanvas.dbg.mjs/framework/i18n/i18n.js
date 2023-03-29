/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../core/event-handler.js';
import { Asset } from '../asset/asset.js';
import { I18nParser } from './i18n-parser.js';
import { DEFAULT_LOCALE, DEFAULT_LOCALE_FALLBACKS } from './constants.js';
import { getLang, replaceLang, getPluralFn, findAvailableLocale } from './utils.js';

/**
 * Handles localization. Responsible for loading localization assets and returning translations for
 * a certain key. Can also handle plural forms. To override its default behavior define a different
 * implementation for {@link I18n#getText} and {@link I18n#getPluralText}.
 *
 * @augments EventHandler
 */
class I18n extends EventHandler {
  /**
   * Create a new I18n instance.
   *
   * @param {import('../app-base.js').AppBase} app - The application.
   */
  constructor(app) {
    super();
    this.locale = DEFAULT_LOCALE;
    this._translations = {};
    this._availableLangs = {};
    this._app = app;
    this._assets = [];
    this._parser = new I18nParser();
  }

  /**
   * An array of asset ids or assets that contain localization data in the expected format. I18n
   * will automatically load translations from these assets as the assets are loaded and it will
   * also automatically unload translations if the assets get removed or unloaded at runtime.
   *
   * @type {number[]|Asset[]}
   */
  set assets(value) {
    const index = {};

    // convert array to dict
    for (let _i = 0, len = value.length; _i < len; _i++) {
      const id = value[_i] instanceof Asset ? value[_i].id : value[_i];
      index[id] = true;
    }

    // remove assets not in value
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

    // add assets in value that do not already exist here
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

  /**
   * The current locale for example "en-US". Changing the locale will raise an event which will
   * cause localized Text Elements to change language to the new locale.
   *
   * @type {string}
   */
  set locale(value) {
    if (this._locale === value) {
      return;
    }

    // replace 'in' language with 'id'
    // for Indonesian because both codes are valid
    // so that users only need to use the 'id' code
    let lang = getLang(value);
    if (lang === 'in') {
      lang = 'id';
      value = replaceLang(value, lang);
      if (this._locale === value) {
        return;
      }
    }
    const old = this._locale;
    // cache locale, lang and plural function
    this._locale = value;
    this._lang = lang;
    this._pluralFn = getPluralFn(this._lang);

    // raise event
    this.fire('set:locale', value, old);
  }
  get locale() {
    return this._locale;
  }

  /**
   * Returns the first available locale based on the desired locale specified. First tries to
   * find the desired locale and then tries to find an alternative locale based on the language.
   *
   * @param {string} desiredLocale - The desired locale e.g. en-US.
   * @param {object} availableLocales - A dictionary where each key is an available locale.
   * @returns {string} The locale found or if no locale is available returns the default en-US
   * locale.
   * @example
   * // With a defined dictionary of locales
   * var availableLocales = { en: 'en-US', fr: 'fr-FR' };
   * var locale = pc.I18n.getText('en-US', availableLocales);
   * // returns 'en'
   * @ignore
   */
  static findAvailableLocale(desiredLocale, availableLocales) {
    return findAvailableLocale(desiredLocale, availableLocales);
  }

  /**
   * Returns the first available locale based on the desired locale specified. First tries to
   * find the desired locale in the loaded translations and then tries to find an alternative
   * locale based on the language.
   *
   * @param {string} desiredLocale - The desired locale e.g. en-US.
   * @returns {string} The locale found or if no locale is available returns the default en-US
   * locale.
   * @example
   * var locale = this.app.i18n.getText('en-US');
   */
  findAvailableLocale(desiredLocale) {
    if (this._translations[desiredLocale]) {
      return desiredLocale;
    }
    const lang = getLang(desiredLocale);
    return this._findFallbackLocale(desiredLocale, lang);
  }

  /**
   * Returns the translation for the specified key and locale. If the locale is not specified it
   * will use the current locale.
   *
   * @param {string} key - The localization key.
   * @param {string} [locale] - The desired locale.
   * @returns {string} The translated text. If no translations are found at all for the locale
   * then it will return the en-US translation. If no translation exists for that key then it will
   * return the localization key.
   * @example
   * var localized = this.app.i18n.getText('localization-key');
   * var localizedFrench = this.app.i18n.getText('localization-key', 'fr-FR');
   */
  getText(key, locale) {
    // default translation is the key
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

      // if this is a plural key then return the first entry in the array
      if (Array.isArray(result)) {
        result = result[0];
      }

      // if null or undefined switch back to the key (empty string is allowed)
      if (result === null || result === undefined) {
        result = key;
      }
    }
    return result;
  }

  /**
   * Returns the pluralized translation for the specified key, number n and locale. If the locale
   * is not specified it will use the current locale.
   *
   * @param {string} key - The localization key.
   * @param {number} n - The number used to determine which plural form to use. E.g. For the
   * phrase "5 Apples" n equals 5.
   * @param {string} [locale] - The desired locale.
   * @returns {string} The translated text. If no translations are found at all for the locale
   * then it will return the en-US translation. If no translation exists for that key then it
   * will return the localization key.
   * @example
   * // manually replace {number} in the resulting translation with our number
   * var localized = this.app.i18n.getPluralText('{number} apples', number).replace("{number}", number);
   */
  getPluralText(key, n, locale) {
    // default translation is the key
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

      // if null or undefined switch back to the key (empty string is allowed)
      if (result === null || result === undefined) {
        result = key;
      }
    }
    return result;
  }

  /**
   * Adds localization data. If the locale and key for a translation already exists it will be
   * overwritten.
   *
   * @param {object} data - The localization data. See example for the expected format of the
   * data.
   * @example
   * this.app.i18n.addData({
   *     header: {
   *         version: 1
   *     },
   *     data: [{
   *         info: {
   *             locale: 'en-US'
   *         },
   *         messages: {
   *             "key": "translation",
   *             // The number of plural forms depends on the locale. See the manual for more information.
   *             "plural_key": ["one item", "more than one items"]
   *         }
   *     }, {
   *         info: {
   *             locale: 'fr-FR'
   *         },
   *         messages: {
   *             // ...
   *         }
   *     }]
   * });
   */
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

        // remember the first locale we've found for that language
        // in case we need to fall back to it
        if (!this._availableLangs[lang]) {
          this._availableLangs[lang] = locale;
        }
      }
      Object.assign(this._translations[locale], messages);
      this.fire('data:add', locale, messages);
    }
  }

  /**
   * Removes localization data.
   *
   * @param {object} data - The localization data. The data is expected to be in the same format
   * as {@link I18n#addData}.
   */
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

      // if no more entries for that locale then
      // delete the locale
      if (Object.keys(translations).length === 0) {
        delete this._translations[locale];
        delete this._availableLangs[getLang(locale)];
      }
      this.fire('data:remove', locale, messages);
    }
  }

  /**
   * Frees up memory.
   */
  destroy() {
    this._translations = null;
    this._availableLangs = null;
    this._assets = null;
    this._parser = null;
    this.off();
  }

  // Finds a fallback locale for the specified locale and language.
  // 1) First tries DEFAULT_LOCALE_FALLBACKS
  // 2) If no translation exists for that locale return the first locale available for that language.
  // 3) If no translation exists for that either then return the DEFAULT_LOCALE
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaTE4bi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9pMThuL2kxOG4uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi9hc3NldC9hc3NldC5qcyc7XG5pbXBvcnQgeyBJMThuUGFyc2VyIH0gZnJvbSAnLi9pMThuLXBhcnNlci5qcyc7XG5cbmltcG9ydCB7XG4gICAgREVGQVVMVF9MT0NBTEUsXG4gICAgREVGQVVMVF9MT0NBTEVfRkFMTEJBQ0tTXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHtcbiAgICByZXBsYWNlTGFuZyxcbiAgICBnZXRMYW5nLFxuICAgIGdldFBsdXJhbEZuLFxuICAgIGZpbmRBdmFpbGFibGVMb2NhbGVcbn0gZnJvbSAnLi91dGlscy5qcyc7XG5cbi8qKlxuICogSGFuZGxlcyBsb2NhbGl6YXRpb24uIFJlc3BvbnNpYmxlIGZvciBsb2FkaW5nIGxvY2FsaXphdGlvbiBhc3NldHMgYW5kIHJldHVybmluZyB0cmFuc2xhdGlvbnMgZm9yXG4gKiBhIGNlcnRhaW4ga2V5LiBDYW4gYWxzbyBoYW5kbGUgcGx1cmFsIGZvcm1zLiBUbyBvdmVycmlkZSBpdHMgZGVmYXVsdCBiZWhhdmlvciBkZWZpbmUgYSBkaWZmZXJlbnRcbiAqIGltcGxlbWVudGF0aW9uIGZvciB7QGxpbmsgSTE4biNnZXRUZXh0fSBhbmQge0BsaW5rIEkxOG4jZ2V0UGx1cmFsVGV4dH0uXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBJMThuIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgSTE4biBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLmxvY2FsZSA9IERFRkFVTFRfTE9DQUxFO1xuICAgICAgICB0aGlzLl90cmFuc2xhdGlvbnMgPSB7fTtcbiAgICAgICAgdGhpcy5fYXZhaWxhYmxlTGFuZ3MgPSB7fTtcbiAgICAgICAgdGhpcy5fYXBwID0gYXBwO1xuICAgICAgICB0aGlzLl9hc3NldHMgPSBbXTtcbiAgICAgICAgdGhpcy5fcGFyc2VyID0gbmV3IEkxOG5QYXJzZXIoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBhc3NldCBpZHMgb3IgYXNzZXRzIHRoYXQgY29udGFpbiBsb2NhbGl6YXRpb24gZGF0YSBpbiB0aGUgZXhwZWN0ZWQgZm9ybWF0LiBJMThuXG4gICAgICogd2lsbCBhdXRvbWF0aWNhbGx5IGxvYWQgdHJhbnNsYXRpb25zIGZyb20gdGhlc2UgYXNzZXRzIGFzIHRoZSBhc3NldHMgYXJlIGxvYWRlZCBhbmQgaXQgd2lsbFxuICAgICAqIGFsc28gYXV0b21hdGljYWxseSB1bmxvYWQgdHJhbnNsYXRpb25zIGlmIHRoZSBhc3NldHMgZ2V0IHJlbW92ZWQgb3IgdW5sb2FkZWQgYXQgcnVudGltZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXXxBc3NldFtdfVxuICAgICAqL1xuICAgIHNldCBhc3NldHModmFsdWUpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB7fTtcblxuICAgICAgICAvLyBjb252ZXJ0IGFycmF5IHRvIGRpY3RcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBpZCA9IHZhbHVlW2ldIGluc3RhbmNlb2YgQXNzZXQgPyB2YWx1ZVtpXS5pZCA6IHZhbHVlW2ldO1xuICAgICAgICAgICAgaW5kZXhbaWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlbW92ZSBhc3NldHMgbm90IGluIHZhbHVlXG4gICAgICAgIGxldCBpID0gdGhpcy5fYXNzZXRzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgY29uc3QgaWQgPSB0aGlzLl9hc3NldHNbaV07XG4gICAgICAgICAgICBpZiAoIWluZGV4W2lkXSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2FwcC5hc3NldHMub2ZmKCdhZGQ6JyArIGlkLCB0aGlzLl9vbkFzc2V0QWRkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX2FwcC5hc3NldHMuZ2V0KGlkKTtcbiAgICAgICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fb25Bc3NldFJlbW92ZShhc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZGQgYXNzZXRzIGluIHZhbHVlIHRoYXQgZG8gbm90IGFscmVhZHkgZXhpc3QgaGVyZVxuICAgICAgICBmb3IgKGNvbnN0IGlkIGluIGluZGV4KSB7XG4gICAgICAgICAgICBjb25zdCBpZE51bSA9IHBhcnNlSW50KGlkLCAxMCk7XG4gICAgICAgICAgICBpZiAodGhpcy5fYXNzZXRzLmluZGV4T2YoaWROdW0pICE9PSAtMSkgY29udGludWU7XG5cbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5wdXNoKGlkTnVtKTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fYXBwLmFzc2V0cy5nZXQoaWROdW0pO1xuICAgICAgICAgICAgaWYgKCFhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2FwcC5hc3NldHMub25jZSgnYWRkOicgKyBpZE51bSwgdGhpcy5fb25Bc3NldEFkZCwgdGhpcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX29uQXNzZXRBZGQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBsb2NhbGUgZm9yIGV4YW1wbGUgXCJlbi1VU1wiLiBDaGFuZ2luZyB0aGUgbG9jYWxlIHdpbGwgcmFpc2UgYW4gZXZlbnQgd2hpY2ggd2lsbFxuICAgICAqIGNhdXNlIGxvY2FsaXplZCBUZXh0IEVsZW1lbnRzIHRvIGNoYW5nZSBsYW5ndWFnZSB0byB0aGUgbmV3IGxvY2FsZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IGxvY2FsZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbG9jYWxlID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVwbGFjZSAnaW4nIGxhbmd1YWdlIHdpdGggJ2lkJ1xuICAgICAgICAvLyBmb3IgSW5kb25lc2lhbiBiZWNhdXNlIGJvdGggY29kZXMgYXJlIHZhbGlkXG4gICAgICAgIC8vIHNvIHRoYXQgdXNlcnMgb25seSBuZWVkIHRvIHVzZSB0aGUgJ2lkJyBjb2RlXG4gICAgICAgIGxldCBsYW5nID0gZ2V0TGFuZyh2YWx1ZSk7XG4gICAgICAgIGlmIChsYW5nID09PSAnaW4nKSB7XG4gICAgICAgICAgICBsYW5nID0gJ2lkJztcbiAgICAgICAgICAgIHZhbHVlID0gcmVwbGFjZUxhbmcodmFsdWUsIGxhbmcpO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2xvY2FsZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLl9sb2NhbGU7XG4gICAgICAgIC8vIGNhY2hlIGxvY2FsZSwgbGFuZyBhbmQgcGx1cmFsIGZ1bmN0aW9uXG4gICAgICAgIHRoaXMuX2xvY2FsZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9sYW5nID0gbGFuZztcbiAgICAgICAgdGhpcy5fcGx1cmFsRm4gPSBnZXRQbHVyYWxGbih0aGlzLl9sYW5nKTtcblxuICAgICAgICAvLyByYWlzZSBldmVudFxuICAgICAgICB0aGlzLmZpcmUoJ3NldDpsb2NhbGUnLCB2YWx1ZSwgb2xkKTtcbiAgICB9XG5cbiAgICBnZXQgbG9jYWxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbG9jYWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGZpcnN0IGF2YWlsYWJsZSBsb2NhbGUgYmFzZWQgb24gdGhlIGRlc2lyZWQgbG9jYWxlIHNwZWNpZmllZC4gRmlyc3QgdHJpZXMgdG9cbiAgICAgKiBmaW5kIHRoZSBkZXNpcmVkIGxvY2FsZSBhbmQgdGhlbiB0cmllcyB0byBmaW5kIGFuIGFsdGVybmF0aXZlIGxvY2FsZSBiYXNlZCBvbiB0aGUgbGFuZ3VhZ2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZGVzaXJlZExvY2FsZSAtIFRoZSBkZXNpcmVkIGxvY2FsZSBlLmcuIGVuLVVTLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBhdmFpbGFibGVMb2NhbGVzIC0gQSBkaWN0aW9uYXJ5IHdoZXJlIGVhY2gga2V5IGlzIGFuIGF2YWlsYWJsZSBsb2NhbGUuXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGxvY2FsZSBmb3VuZCBvciBpZiBubyBsb2NhbGUgaXMgYXZhaWxhYmxlIHJldHVybnMgdGhlIGRlZmF1bHQgZW4tVVNcbiAgICAgKiBsb2NhbGUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBXaXRoIGEgZGVmaW5lZCBkaWN0aW9uYXJ5IG9mIGxvY2FsZXNcbiAgICAgKiB2YXIgYXZhaWxhYmxlTG9jYWxlcyA9IHsgZW46ICdlbi1VUycsIGZyOiAnZnItRlInIH07XG4gICAgICogdmFyIGxvY2FsZSA9IHBjLkkxOG4uZ2V0VGV4dCgnZW4tVVMnLCBhdmFpbGFibGVMb2NhbGVzKTtcbiAgICAgKiAvLyByZXR1cm5zICdlbidcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc3RhdGljIGZpbmRBdmFpbGFibGVMb2NhbGUoZGVzaXJlZExvY2FsZSwgYXZhaWxhYmxlTG9jYWxlcykge1xuICAgICAgICByZXR1cm4gZmluZEF2YWlsYWJsZUxvY2FsZShkZXNpcmVkTG9jYWxlLCBhdmFpbGFibGVMb2NhbGVzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBmaXJzdCBhdmFpbGFibGUgbG9jYWxlIGJhc2VkIG9uIHRoZSBkZXNpcmVkIGxvY2FsZSBzcGVjaWZpZWQuIEZpcnN0IHRyaWVzIHRvXG4gICAgICogZmluZCB0aGUgZGVzaXJlZCBsb2NhbGUgaW4gdGhlIGxvYWRlZCB0cmFuc2xhdGlvbnMgYW5kIHRoZW4gdHJpZXMgdG8gZmluZCBhbiBhbHRlcm5hdGl2ZVxuICAgICAqIGxvY2FsZSBiYXNlZCBvbiB0aGUgbGFuZ3VhZ2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZGVzaXJlZExvY2FsZSAtIFRoZSBkZXNpcmVkIGxvY2FsZSBlLmcuIGVuLVVTLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBsb2NhbGUgZm91bmQgb3IgaWYgbm8gbG9jYWxlIGlzIGF2YWlsYWJsZSByZXR1cm5zIHRoZSBkZWZhdWx0IGVuLVVTXG4gICAgICogbG9jYWxlLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdmFyIGxvY2FsZSA9IHRoaXMuYXBwLmkxOG4uZ2V0VGV4dCgnZW4tVVMnKTtcbiAgICAgKi9cbiAgICBmaW5kQXZhaWxhYmxlTG9jYWxlKGRlc2lyZWRMb2NhbGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3RyYW5zbGF0aW9uc1tkZXNpcmVkTG9jYWxlXSkge1xuICAgICAgICAgICAgcmV0dXJuIGRlc2lyZWRMb2NhbGU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsYW5nID0gZ2V0TGFuZyhkZXNpcmVkTG9jYWxlKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZpbmRGYWxsYmFja0xvY2FsZShkZXNpcmVkTG9jYWxlLCBsYW5nKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSB0cmFuc2xhdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBrZXkgYW5kIGxvY2FsZS4gSWYgdGhlIGxvY2FsZSBpcyBub3Qgc3BlY2lmaWVkIGl0XG4gICAgICogd2lsbCB1c2UgdGhlIGN1cnJlbnQgbG9jYWxlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSAtIFRoZSBsb2NhbGl6YXRpb24ga2V5LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbG9jYWxlXSAtIFRoZSBkZXNpcmVkIGxvY2FsZS5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgdHJhbnNsYXRlZCB0ZXh0LiBJZiBubyB0cmFuc2xhdGlvbnMgYXJlIGZvdW5kIGF0IGFsbCBmb3IgdGhlIGxvY2FsZVxuICAgICAqIHRoZW4gaXQgd2lsbCByZXR1cm4gdGhlIGVuLVVTIHRyYW5zbGF0aW9uLiBJZiBubyB0cmFuc2xhdGlvbiBleGlzdHMgZm9yIHRoYXQga2V5IHRoZW4gaXQgd2lsbFxuICAgICAqIHJldHVybiB0aGUgbG9jYWxpemF0aW9uIGtleS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBsb2NhbGl6ZWQgPSB0aGlzLmFwcC5pMThuLmdldFRleHQoJ2xvY2FsaXphdGlvbi1rZXknKTtcbiAgICAgKiB2YXIgbG9jYWxpemVkRnJlbmNoID0gdGhpcy5hcHAuaTE4bi5nZXRUZXh0KCdsb2NhbGl6YXRpb24ta2V5JywgJ2ZyLUZSJyk7XG4gICAgICovXG4gICAgZ2V0VGV4dChrZXksIGxvY2FsZSkge1xuICAgICAgICAvLyBkZWZhdWx0IHRyYW5zbGF0aW9uIGlzIHRoZSBrZXlcbiAgICAgICAgbGV0IHJlc3VsdCA9IGtleTtcblxuICAgICAgICBsZXQgbGFuZztcbiAgICAgICAgaWYgKCFsb2NhbGUpIHtcbiAgICAgICAgICAgIGxvY2FsZSA9IHRoaXMuX2xvY2FsZTtcbiAgICAgICAgICAgIGxhbmcgPSB0aGlzLl9sYW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHRyYW5zbGF0aW9ucyA9IHRoaXMuX3RyYW5zbGF0aW9uc1tsb2NhbGVdO1xuICAgICAgICBpZiAoIXRyYW5zbGF0aW9ucykge1xuICAgICAgICAgICAgaWYgKCFsYW5nKSB7XG4gICAgICAgICAgICAgICAgbGFuZyA9IGdldExhbmcobG9jYWxlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbG9jYWxlID0gdGhpcy5fZmluZEZhbGxiYWNrTG9jYWxlKGxvY2FsZSwgbGFuZyk7XG4gICAgICAgICAgICB0cmFuc2xhdGlvbnMgPSB0aGlzLl90cmFuc2xhdGlvbnNbbG9jYWxlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0cmFuc2xhdGlvbnMgJiYgdHJhbnNsYXRpb25zLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHRyYW5zbGF0aW9uc1trZXldO1xuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGEgcGx1cmFsIGtleSB0aGVuIHJldHVybiB0aGUgZmlyc3QgZW50cnkgaW4gdGhlIGFycmF5XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShyZXN1bHQpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gcmVzdWx0WzBdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiBudWxsIG9yIHVuZGVmaW5lZCBzd2l0Y2ggYmFjayB0byB0aGUga2V5IChlbXB0eSBzdHJpbmcgaXMgYWxsb3dlZClcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgcmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBrZXk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIHBsdXJhbGl6ZWQgdHJhbnNsYXRpb24gZm9yIHRoZSBzcGVjaWZpZWQga2V5LCBudW1iZXIgbiBhbmQgbG9jYWxlLiBJZiB0aGUgbG9jYWxlXG4gICAgICogaXMgbm90IHNwZWNpZmllZCBpdCB3aWxsIHVzZSB0aGUgY3VycmVudCBsb2NhbGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IC0gVGhlIGxvY2FsaXphdGlvbiBrZXkuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gLSBUaGUgbnVtYmVyIHVzZWQgdG8gZGV0ZXJtaW5lIHdoaWNoIHBsdXJhbCBmb3JtIHRvIHVzZS4gRS5nLiBGb3IgdGhlXG4gICAgICogcGhyYXNlIFwiNSBBcHBsZXNcIiBuIGVxdWFscyA1LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbbG9jYWxlXSAtIFRoZSBkZXNpcmVkIGxvY2FsZS5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgdHJhbnNsYXRlZCB0ZXh0LiBJZiBubyB0cmFuc2xhdGlvbnMgYXJlIGZvdW5kIGF0IGFsbCBmb3IgdGhlIGxvY2FsZVxuICAgICAqIHRoZW4gaXQgd2lsbCByZXR1cm4gdGhlIGVuLVVTIHRyYW5zbGF0aW9uLiBJZiBubyB0cmFuc2xhdGlvbiBleGlzdHMgZm9yIHRoYXQga2V5IHRoZW4gaXRcbiAgICAgKiB3aWxsIHJldHVybiB0aGUgbG9jYWxpemF0aW9uIGtleS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIG1hbnVhbGx5IHJlcGxhY2Uge251bWJlcn0gaW4gdGhlIHJlc3VsdGluZyB0cmFuc2xhdGlvbiB3aXRoIG91ciBudW1iZXJcbiAgICAgKiB2YXIgbG9jYWxpemVkID0gdGhpcy5hcHAuaTE4bi5nZXRQbHVyYWxUZXh0KCd7bnVtYmVyfSBhcHBsZXMnLCBudW1iZXIpLnJlcGxhY2UoXCJ7bnVtYmVyfVwiLCBudW1iZXIpO1xuICAgICAqL1xuICAgIGdldFBsdXJhbFRleHQoa2V5LCBuLCBsb2NhbGUpIHtcbiAgICAgICAgLy8gZGVmYXVsdCB0cmFuc2xhdGlvbiBpcyB0aGUga2V5XG4gICAgICAgIGxldCByZXN1bHQgPSBrZXk7XG5cbiAgICAgICAgbGV0IGxhbmc7XG4gICAgICAgIGxldCBwbHVyYWxGbjtcblxuICAgICAgICBpZiAoIWxvY2FsZSkge1xuICAgICAgICAgICAgbG9jYWxlID0gdGhpcy5fbG9jYWxlO1xuICAgICAgICAgICAgbGFuZyA9IHRoaXMuX2xhbmc7XG4gICAgICAgICAgICBwbHVyYWxGbiA9IHRoaXMuX3BsdXJhbEZuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGFuZyA9IGdldExhbmcobG9jYWxlKTtcbiAgICAgICAgICAgIHBsdXJhbEZuID0gZ2V0UGx1cmFsRm4obGFuZyk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgdHJhbnNsYXRpb25zID0gdGhpcy5fdHJhbnNsYXRpb25zW2xvY2FsZV07XG4gICAgICAgIGlmICghdHJhbnNsYXRpb25zKSB7XG4gICAgICAgICAgICBsb2NhbGUgPSB0aGlzLl9maW5kRmFsbGJhY2tMb2NhbGUobG9jYWxlLCBsYW5nKTtcbiAgICAgICAgICAgIGxhbmcgPSBnZXRMYW5nKGxvY2FsZSk7XG4gICAgICAgICAgICBwbHVyYWxGbiA9IGdldFBsdXJhbEZuKGxhbmcpO1xuICAgICAgICAgICAgdHJhbnNsYXRpb25zID0gdGhpcy5fdHJhbnNsYXRpb25zW2xvY2FsZV07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHJhbnNsYXRpb25zICYmIHRyYW5zbGF0aW9uc1trZXldICYmIHBsdXJhbEZuKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IHBsdXJhbEZuKG4pO1xuICAgICAgICAgICAgcmVzdWx0ID0gdHJhbnNsYXRpb25zW2tleV1baW5kZXhdO1xuXG4gICAgICAgICAgICAvLyBpZiBudWxsIG9yIHVuZGVmaW5lZCBzd2l0Y2ggYmFjayB0byB0aGUga2V5IChlbXB0eSBzdHJpbmcgaXMgYWxsb3dlZClcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwgfHwgcmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBrZXk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgbG9jYWxpemF0aW9uIGRhdGEuIElmIHRoZSBsb2NhbGUgYW5kIGtleSBmb3IgYSB0cmFuc2xhdGlvbiBhbHJlYWR5IGV4aXN0cyBpdCB3aWxsIGJlXG4gICAgICogb3ZlcndyaXR0ZW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIFRoZSBsb2NhbGl6YXRpb24gZGF0YS4gU2VlIGV4YW1wbGUgZm9yIHRoZSBleHBlY3RlZCBmb3JtYXQgb2YgdGhlXG4gICAgICogZGF0YS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHRoaXMuYXBwLmkxOG4uYWRkRGF0YSh7XG4gICAgICogICAgIGhlYWRlcjoge1xuICAgICAqICAgICAgICAgdmVyc2lvbjogMVxuICAgICAqICAgICB9LFxuICAgICAqICAgICBkYXRhOiBbe1xuICAgICAqICAgICAgICAgaW5mbzoge1xuICAgICAqICAgICAgICAgICAgIGxvY2FsZTogJ2VuLVVTJ1xuICAgICAqICAgICAgICAgfSxcbiAgICAgKiAgICAgICAgIG1lc3NhZ2VzOiB7XG4gICAgICogICAgICAgICAgICAgXCJrZXlcIjogXCJ0cmFuc2xhdGlvblwiLFxuICAgICAqICAgICAgICAgICAgIC8vIFRoZSBudW1iZXIgb2YgcGx1cmFsIGZvcm1zIGRlcGVuZHMgb24gdGhlIGxvY2FsZS4gU2VlIHRoZSBtYW51YWwgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gICAgICogICAgICAgICAgICAgXCJwbHVyYWxfa2V5XCI6IFtcIm9uZSBpdGVtXCIsIFwibW9yZSB0aGFuIG9uZSBpdGVtc1wiXVxuICAgICAqICAgICAgICAgfVxuICAgICAqICAgICB9LCB7XG4gICAgICogICAgICAgICBpbmZvOiB7XG4gICAgICogICAgICAgICAgICAgbG9jYWxlOiAnZnItRlInXG4gICAgICogICAgICAgICB9LFxuICAgICAqICAgICAgICAgbWVzc2FnZXM6IHtcbiAgICAgKiAgICAgICAgICAgICAvLyAuLi5cbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgfV1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBhZGREYXRhKGRhdGEpIHtcbiAgICAgICAgbGV0IHBhcnNlZDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHBhcnNlZCA9IHRoaXMuX3BhcnNlci5wYXJzZShkYXRhKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcGFyc2VkLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHBhcnNlZFtpXTtcbiAgICAgICAgICAgIGNvbnN0IGxvY2FsZSA9IGVudHJ5LmluZm8ubG9jYWxlO1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZXMgPSBlbnRyeS5tZXNzYWdlcztcbiAgICAgICAgICAgIGlmICghdGhpcy5fdHJhbnNsYXRpb25zW2xvY2FsZV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl90cmFuc2xhdGlvbnNbbG9jYWxlXSA9IHt9O1xuICAgICAgICAgICAgICAgIGNvbnN0IGxhbmcgPSBnZXRMYW5nKGxvY2FsZSk7XG5cbiAgICAgICAgICAgICAgICAvLyByZW1lbWJlciB0aGUgZmlyc3QgbG9jYWxlIHdlJ3ZlIGZvdW5kIGZvciB0aGF0IGxhbmd1YWdlXG4gICAgICAgICAgICAgICAgLy8gaW4gY2FzZSB3ZSBuZWVkIHRvIGZhbGwgYmFjayB0byBpdFxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fYXZhaWxhYmxlTGFuZ3NbbGFuZ10pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYXZhaWxhYmxlTGFuZ3NbbGFuZ10gPSBsb2NhbGU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBPYmplY3QuYXNzaWduKHRoaXMuX3RyYW5zbGF0aW9uc1tsb2NhbGVdLCBtZXNzYWdlcyk7XG5cbiAgICAgICAgICAgIHRoaXMuZmlyZSgnZGF0YTphZGQnLCBsb2NhbGUsIG1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgbG9jYWxpemF0aW9uIGRhdGEuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIFRoZSBsb2NhbGl6YXRpb24gZGF0YS4gVGhlIGRhdGEgaXMgZXhwZWN0ZWQgdG8gYmUgaW4gdGhlIHNhbWUgZm9ybWF0XG4gICAgICogYXMge0BsaW5rIEkxOG4jYWRkRGF0YX0uXG4gICAgICovXG4gICAgcmVtb3ZlRGF0YShkYXRhKSB7XG4gICAgICAgIGxldCBwYXJzZWQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBwYXJzZWQgPSB0aGlzLl9wYXJzZXIucGFyc2UoZGF0YSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHBhcnNlZC5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZW50cnkgPSBwYXJzZWRbaV07XG4gICAgICAgICAgICBjb25zdCBsb2NhbGUgPSBlbnRyeS5pbmZvLmxvY2FsZTtcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zbGF0aW9ucyA9IHRoaXMuX3RyYW5zbGF0aW9uc1tsb2NhbGVdO1xuICAgICAgICAgICAgaWYgKCF0cmFuc2xhdGlvbnMpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlcyA9IGVudHJ5Lm1lc3NhZ2VzO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gbWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdHJhbnNsYXRpb25zW2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIG5vIG1vcmUgZW50cmllcyBmb3IgdGhhdCBsb2NhbGUgdGhlblxuICAgICAgICAgICAgLy8gZGVsZXRlIHRoZSBsb2NhbGVcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyh0cmFuc2xhdGlvbnMpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl90cmFuc2xhdGlvbnNbbG9jYWxlXTtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5fYXZhaWxhYmxlTGFuZ3NbZ2V0TGFuZyhsb2NhbGUpXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5maXJlKCdkYXRhOnJlbW92ZScsIGxvY2FsZSwgbWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgdXAgbWVtb3J5LlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX3RyYW5zbGF0aW9ucyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F2YWlsYWJsZUxhbmdzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXNzZXRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fcGFyc2VyID0gbnVsbDtcbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG5cbiAgICAvLyBGaW5kcyBhIGZhbGxiYWNrIGxvY2FsZSBmb3IgdGhlIHNwZWNpZmllZCBsb2NhbGUgYW5kIGxhbmd1YWdlLlxuICAgIC8vIDEpIEZpcnN0IHRyaWVzIERFRkFVTFRfTE9DQUxFX0ZBTExCQUNLU1xuICAgIC8vIDIpIElmIG5vIHRyYW5zbGF0aW9uIGV4aXN0cyBmb3IgdGhhdCBsb2NhbGUgcmV0dXJuIHRoZSBmaXJzdCBsb2NhbGUgYXZhaWxhYmxlIGZvciB0aGF0IGxhbmd1YWdlLlxuICAgIC8vIDMpIElmIG5vIHRyYW5zbGF0aW9uIGV4aXN0cyBmb3IgdGhhdCBlaXRoZXIgdGhlbiByZXR1cm4gdGhlIERFRkFVTFRfTE9DQUxFXG4gICAgX2ZpbmRGYWxsYmFja0xvY2FsZShsb2NhbGUsIGxhbmcpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IERFRkFVTFRfTE9DQUxFX0ZBTExCQUNLU1tsb2NhbGVdO1xuICAgICAgICBpZiAocmVzdWx0ICYmIHRoaXMuX3RyYW5zbGF0aW9uc1tyZXN1bHRdKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0ID0gREVGQVVMVF9MT0NBTEVfRkFMTEJBQ0tTW2xhbmddO1xuICAgICAgICBpZiAocmVzdWx0ICYmIHRoaXMuX3RyYW5zbGF0aW9uc1tyZXN1bHRdKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0ID0gdGhpcy5fYXZhaWxhYmxlTGFuZ3NbbGFuZ107XG4gICAgICAgIGlmIChyZXN1bHQgJiYgdGhpcy5fdHJhbnNsYXRpb25zW3Jlc3VsdF0pIHtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gREVGQVVMVF9MT0NBTEU7XG4gICAgfVxuXG4gICAgX29uQXNzZXRBZGQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbkFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbkFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25Bc3NldFVubG9hZCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbkFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25Bc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5hZGREYXRhKGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICBfb25Bc3NldENoYW5nZShhc3NldCkge1xuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkRGF0YShhc3NldC5yZXNvdXJjZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25Bc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbkFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25Bc3NldENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25Bc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25Bc3NldFVubG9hZCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZURhdGEoYXNzZXQucmVzb3VyY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYXBwLmFzc2V0cy5vbmNlKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbkFzc2V0QWRkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25Bc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlRGF0YShhc3NldC5yZXNvdXJjZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IEkxOG4gfTtcbiJdLCJuYW1lcyI6WyJJMThuIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJsb2NhbGUiLCJERUZBVUxUX0xPQ0FMRSIsIl90cmFuc2xhdGlvbnMiLCJfYXZhaWxhYmxlTGFuZ3MiLCJfYXBwIiwiX2Fzc2V0cyIsIl9wYXJzZXIiLCJJMThuUGFyc2VyIiwiYXNzZXRzIiwidmFsdWUiLCJpbmRleCIsImkiLCJsZW4iLCJsZW5ndGgiLCJpZCIsIkFzc2V0Iiwib2ZmIiwiX29uQXNzZXRBZGQiLCJhc3NldCIsImdldCIsIl9vbkFzc2V0UmVtb3ZlIiwic3BsaWNlIiwiaWROdW0iLCJwYXJzZUludCIsImluZGV4T2YiLCJwdXNoIiwib25jZSIsIl9sb2NhbGUiLCJsYW5nIiwiZ2V0TGFuZyIsInJlcGxhY2VMYW5nIiwib2xkIiwiX2xhbmciLCJfcGx1cmFsRm4iLCJnZXRQbHVyYWxGbiIsImZpcmUiLCJmaW5kQXZhaWxhYmxlTG9jYWxlIiwiZGVzaXJlZExvY2FsZSIsImF2YWlsYWJsZUxvY2FsZXMiLCJfZmluZEZhbGxiYWNrTG9jYWxlIiwiZ2V0VGV4dCIsImtleSIsInJlc3VsdCIsInRyYW5zbGF0aW9ucyIsImhhc093blByb3BlcnR5IiwiQXJyYXkiLCJpc0FycmF5IiwidW5kZWZpbmVkIiwiZ2V0UGx1cmFsVGV4dCIsIm4iLCJwbHVyYWxGbiIsImFkZERhdGEiLCJkYXRhIiwicGFyc2VkIiwicGFyc2UiLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiLCJlbnRyeSIsImluZm8iLCJtZXNzYWdlcyIsIk9iamVjdCIsImFzc2lnbiIsInJlbW92ZURhdGEiLCJrZXlzIiwiZGVzdHJveSIsIkRFRkFVTFRfTE9DQUxFX0ZBTExCQUNLUyIsIm9uIiwiX29uQXNzZXRMb2FkIiwiX29uQXNzZXRDaGFuZ2UiLCJfb25Bc3NldFVubG9hZCIsInJlc291cmNlIl0sIm1hcHBpbmdzIjoi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
