/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class I18nParser {
  _validate(data) {
    if (!data.header) {
      throw new Error('pc.I18n#addData: Missing "header" field');
    }

    if (!data.header.version) {
      throw new Error('pc.I18n#addData: Missing "header.version" field');
    }

    if (data.header.version !== 1) {
      throw new Error('pc.I18n#addData: Invalid "header.version" field');
    }

    if (!data.data) {
      throw new Error('pc.I18n#addData: Missing "data" field');
    } else if (!Array.isArray(data.data)) {
      throw new Error('pc.I18n#addData: "data" field must be an array');
    }

    for (let i = 0, len = data.data.length; i < len; i++) {
      const entry = data.data[i];

      if (!entry.info) {
        throw new Error(`pc.I18n#addData: missing "data[${i}].info" field`);
      }

      if (!entry.info.locale) {
        throw new Error(`pc.I18n#addData: missing "data[${i}].info.locale" field`);
      }

      if (typeof entry.info.locale !== 'string') {
        throw new Error(`pc.I18n#addData: "data[${i}].info.locale" must be a string`);
      }

      if (!entry.messages) {
        throw new Error(`pc.I18n#addData: missing "data[${i}].messages" field`);
      }
    }
  }

  parse(data) {
    return data.data;
  }

}

export { I18nParser };
