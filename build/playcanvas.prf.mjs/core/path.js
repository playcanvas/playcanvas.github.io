/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { isDefined } from './core.js';

const path = {
  delimiter: '/',
  join: function () {
    const num = arguments.length;
    let result = arguments[0];
    for (let index = 0; index < num - 1; ++index) {
      const one = arguments[index];
      const two = arguments[index + 1];
      if (!isDefined(one) || !isDefined(two)) {
        throw new Error('undefined argument to pc.path.join');
      }
      if (two[0] === path.delimiter) {
        result = two;
        continue;
      }
      if (one && two && one[one.length - 1] !== path.delimiter && two[0] !== path.delimiter) {
        result += path.delimiter + two;
      } else {
        result += two;
      }
    }
    return result;
  },
  normalize: function (pathname) {
    const lead = pathname.startsWith(path.delimiter);
    const trail = pathname.endsWith(path.delimiter);
    const parts = pathname.split('/');
    let result = '';
    let cleaned = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '') continue;
      if (parts[i] === '.') continue;
      if (parts[i] === '..' && cleaned.length > 0) {
        cleaned = cleaned.slice(0, cleaned.length - 2);
        continue;
      }
      if (i > 0) cleaned.push(path.delimiter);
      cleaned.push(parts[i]);
    }
    result = cleaned.join('');
    if (!lead && result[0] === path.delimiter) {
      result = result.slice(1);
    }
    if (trail && result[result.length - 1] !== path.delimiter) {
      result += path.delimiter;
    }
    return result;
  },
  split: function (pathname) {
    const parts = pathname.split(path.delimiter);
    const tail = parts.slice(parts.length - 1)[0];
    const head = parts.slice(0, parts.length - 1).join(path.delimiter);
    return [head, tail];
  },
  getBasename: function (pathname) {
    return path.split(pathname)[1];
  },
  getDirectory: function (pathname) {
    const parts = pathname.split(path.delimiter);
    return parts.slice(0, parts.length - 1).join(path.delimiter);
  },
  getExtension: function (pathname) {
    const ext = pathname.split('?')[0].split('.').pop();
    if (ext !== pathname) {
      return '.' + ext;
    }
    return '';
  },
  isRelativePath: function (pathname) {
    return pathname.charAt(0) !== '/' && pathname.match(/:\/\//) === null;
  },
  extractPath: function (pathname) {
    let result = '';
    const parts = pathname.split('/');
    let i = 0;
    if (parts.length > 1) {
      if (path.isRelativePath(pathname)) {
        if (parts[0] === '.') {
          for (i = 0; i < parts.length - 1; ++i) {
            result += i === 0 ? parts[i] : '/' + parts[i];
          }
        } else if (parts[0] === '..') {
          for (i = 0; i < parts.length - 1; ++i) {
            result += i === 0 ? parts[i] : '/' + parts[i];
          }
        } else {
          result = '.';
          for (i = 0; i < parts.length - 1; ++i) {
            result += '/' + parts[i];
          }
        }
      } else {
        for (i = 0; i < parts.length - 1; ++i) {
          result += i === 0 ? parts[i] : '/' + parts[i];
        }
      }
    }
    return result;
  }
};

export { path };
