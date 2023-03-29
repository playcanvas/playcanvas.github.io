/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from './debug.js';

/**
 * File path API.
 *
 * @namespace
 */
const path = {
  /**
   * The character that separates path segments.
   *
   * @type {string}
   */
  delimiter: '/',
  /**
   * Join two or more sections of file path together, inserting a delimiter if needed.
   *
   * @param {...string} section - Section of path to join. 2 or more can be provided as parameters.
   * @returns {string} The joined file path.
   * @example
   * var path = pc.path.join('foo', 'bar');
   * console.log(path); // Prints 'foo/bar'
   * @example
   * var path = pc.path.join('alpha', 'beta', 'gamma');
   * console.log(path); // Prints 'alpha/beta/gamma'
   */
  join: function () {
    const num = arguments.length;
    let result = arguments[0];
    for (let index = 0; index < num - 1; ++index) {
      const one = arguments[index];
      Debug.assert(one !== undefined);
      const two = arguments[index + 1];
      Debug.assert(two !== undefined);
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
  /**
   * Normalize the path by removing '.' and '..' instances.
   *
   * @param {string} pathname - The path to normalize.
   * @returns {string} The normalized path.
   */
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
  /**
   * Split the pathname path into a pair [head, tail] where tail is the final part of the path
   * after the last delimiter and head is everything leading up to that. tail will never contain
   * a slash.
   *
   * @param {string} pathname - The path to split.
   * @returns {string[]} The split path which is an array of two strings, the path and the
   * filename.
   */
  split: function (pathname) {
    const lastDelimiterIndex = pathname.lastIndexOf(path.delimiter);
    if (lastDelimiterIndex !== -1) {
      return [pathname.substring(0, lastDelimiterIndex), pathname.substring(lastDelimiterIndex + 1)];
    }
    return ["", pathname];
  },
  /**
   * Return the basename of the path. That is the second element of the pair returned by passing
   * path into {@link path.split}.
   *
   * @param {string} pathname - The path to process.
   * @returns {string} The basename.
   * @example
   * pc.path.getBasename("/path/to/file.txt"); // returns "file.txt"
   * pc.path.getBasename("/path/to/dir"); // returns "dir"
   */
  getBasename: function (pathname) {
    return path.split(pathname)[1];
  },
  /**
   * Get the directory name from the path. This is everything up to the final instance of
   * {@link path.delimiter}.
   *
   * @param {string} pathname - The path to get the directory from.
   * @returns {string} The directory part of the path.
   */
  getDirectory: function (pathname) {
    return path.split(pathname)[0];
  },
  /**
   * Return the extension of the path. Pop the last value of a list after path is split by
   * question mark and comma.
   *
   * @param {string} pathname - The path to process.
   * @returns {string} The extension.
   * @example
   * pc.path.getExtension("/path/to/file.txt"); // returns ".txt"
   * pc.path.getExtension("/path/to/file.jpg"); // returns ".jpg"
   * pc.path.getExtension("/path/to/file.txt?function=getExtension"); // returns ".txt"
   */
  getExtension: function (pathname) {
    const ext = pathname.split('?')[0].split('.').pop();
    if (ext !== pathname) {
      return '.' + ext;
    }
    return '';
  },
  /**
   * Check if a string s is relative path.
   *
   * @param {string} pathname - The path to process.
   * @returns {boolean} True if s doesn't start with slash and doesn't include colon and double
   * slash.
   *
   * @example
   * pc.path.isRelativePath("file.txt"); // returns true
   * pc.path.isRelativePath("path/to/file.txt"); // returns true
   * pc.path.isRelativePath("./path/to/file.txt"); // returns true
   * pc.path.isRelativePath("../path/to/file.jpg"); // returns true
   * pc.path.isRelativePath("/path/to/file.jpg"); // returns false
   * pc.path.isRelativePath("http://path/to/file.jpg"); // returns false
   */
  isRelativePath: function (pathname) {
    return pathname.charAt(0) !== '/' && pathname.match(/:\/\//) === null;
  },
  /**
   * Return the path without file name. If path is relative path, start with period.
   *
   * @param {string} pathname - The full path to process.
   * @returns {string} The path without a last element from list split by slash.
   * @example
   * pc.path.extractPath("path/to/file.txt");    // returns "./path/to"
   * pc.path.extractPath("./path/to/file.txt");  // returns "./path/to"
   * pc.path.extractPath("../path/to/file.txt"); // returns "../path/to"
   * pc.path.extractPath("/path/to/file.txt");   // returns "/path/to"
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGF0aC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvcGF0aC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4vZGVidWcuanMnO1xuXG4vKipcbiAqIEZpbGUgcGF0aCBBUEkuXG4gKlxuICogQG5hbWVzcGFjZVxuICovXG5jb25zdCBwYXRoID0ge1xuICAgIC8qKlxuICAgICAqIFRoZSBjaGFyYWN0ZXIgdGhhdCBzZXBhcmF0ZXMgcGF0aCBzZWdtZW50cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgZGVsaW1pdGVyOiAnLycsXG5cbiAgICAvKipcbiAgICAgKiBKb2luIHR3byBvciBtb3JlIHNlY3Rpb25zIG9mIGZpbGUgcGF0aCB0b2dldGhlciwgaW5zZXJ0aW5nIGEgZGVsaW1pdGVyIGlmIG5lZWRlZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Li4uc3RyaW5nfSBzZWN0aW9uIC0gU2VjdGlvbiBvZiBwYXRoIHRvIGpvaW4uIDIgb3IgbW9yZSBjYW4gYmUgcHJvdmlkZWQgYXMgcGFyYW1ldGVycy5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgam9pbmVkIGZpbGUgcGF0aC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBwYXRoID0gcGMucGF0aC5qb2luKCdmb28nLCAnYmFyJyk7XG4gICAgICogY29uc29sZS5sb2cocGF0aCk7IC8vIFByaW50cyAnZm9vL2JhcidcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciBwYXRoID0gcGMucGF0aC5qb2luKCdhbHBoYScsICdiZXRhJywgJ2dhbW1hJyk7XG4gICAgICogY29uc29sZS5sb2cocGF0aCk7IC8vIFByaW50cyAnYWxwaGEvYmV0YS9nYW1tYSdcbiAgICAgKi9cbiAgICBqb2luOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IG51bSA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGxldCByZXN1bHQgPSBhcmd1bWVudHNbMF07XG5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IG51bSAtIDE7ICsraW5kZXgpIHtcbiAgICAgICAgICAgIGNvbnN0IG9uZSA9IGFyZ3VtZW50c1tpbmRleF07XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQob25lICE9PSB1bmRlZmluZWQpO1xuXG4gICAgICAgICAgICBjb25zdCB0d28gPSBhcmd1bWVudHNbaW5kZXggKyAxXTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydCh0d28gIT09IHVuZGVmaW5lZCk7XG5cbiAgICAgICAgICAgIGlmICh0d29bMF0gPT09IHBhdGguZGVsaW1pdGVyKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdHdvO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAob25lICYmIHR3byAmJiBvbmVbb25lLmxlbmd0aCAtIDFdICE9PSBwYXRoLmRlbGltaXRlciAmJiB0d29bMF0gIT09IHBhdGguZGVsaW1pdGVyKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ICs9IChwYXRoLmRlbGltaXRlciArIHR3byk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdCArPSAodHdvKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE5vcm1hbGl6ZSB0aGUgcGF0aCBieSByZW1vdmluZyAnLicgYW5kICcuLicgaW5zdGFuY2VzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhuYW1lIC0gVGhlIHBhdGggdG8gbm9ybWFsaXplLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBub3JtYWxpemVkIHBhdGguXG4gICAgICovXG4gICAgbm9ybWFsaXplOiBmdW5jdGlvbiAocGF0aG5hbWUpIHtcbiAgICAgICAgY29uc3QgbGVhZCA9IHBhdGhuYW1lLnN0YXJ0c1dpdGgocGF0aC5kZWxpbWl0ZXIpO1xuICAgICAgICBjb25zdCB0cmFpbCA9IHBhdGhuYW1lLmVuZHNXaXRoKHBhdGguZGVsaW1pdGVyKTtcblxuICAgICAgICBjb25zdCBwYXJ0cyA9IHBhdGhuYW1lLnNwbGl0KCcvJyk7XG5cbiAgICAgICAgbGV0IHJlc3VsdCA9ICcnO1xuXG4gICAgICAgIGxldCBjbGVhbmVkID0gW107XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHBhcnRzW2ldID09PSAnJykgY29udGludWU7XG4gICAgICAgICAgICBpZiAocGFydHNbaV0gPT09ICcuJykgY29udGludWU7XG4gICAgICAgICAgICBpZiAocGFydHNbaV0gPT09ICcuLicgJiYgY2xlYW5lZC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY2xlYW5lZCA9IGNsZWFuZWQuc2xpY2UoMCwgY2xlYW5lZC5sZW5ndGggLSAyKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGkgPiAwKSBjbGVhbmVkLnB1c2gocGF0aC5kZWxpbWl0ZXIpO1xuICAgICAgICAgICAgY2xlYW5lZC5wdXNoKHBhcnRzW2ldKTtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgcmVzdWx0ID0gY2xlYW5lZC5qb2luKCcnKTtcbiAgICAgICAgaWYgKCFsZWFkICYmIHJlc3VsdFswXSA9PT0gcGF0aC5kZWxpbWl0ZXIpIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5zbGljZSgxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0cmFpbCAmJiByZXN1bHRbcmVzdWx0Lmxlbmd0aCAtIDFdICE9PSBwYXRoLmRlbGltaXRlcikge1xuICAgICAgICAgICAgcmVzdWx0ICs9IHBhdGguZGVsaW1pdGVyO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3BsaXQgdGhlIHBhdGhuYW1lIHBhdGggaW50byBhIHBhaXIgW2hlYWQsIHRhaWxdIHdoZXJlIHRhaWwgaXMgdGhlIGZpbmFsIHBhcnQgb2YgdGhlIHBhdGhcbiAgICAgKiBhZnRlciB0aGUgbGFzdCBkZWxpbWl0ZXIgYW5kIGhlYWQgaXMgZXZlcnl0aGluZyBsZWFkaW5nIHVwIHRvIHRoYXQuIHRhaWwgd2lsbCBuZXZlciBjb250YWluXG4gICAgICogYSBzbGFzaC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRobmFtZSAtIFRoZSBwYXRoIHRvIHNwbGl0LlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmdbXX0gVGhlIHNwbGl0IHBhdGggd2hpY2ggaXMgYW4gYXJyYXkgb2YgdHdvIHN0cmluZ3MsIHRoZSBwYXRoIGFuZCB0aGVcbiAgICAgKiBmaWxlbmFtZS5cbiAgICAgKi9cbiAgICBzcGxpdDogZnVuY3Rpb24gKHBhdGhuYW1lKSB7XG4gICAgICAgIGNvbnN0IGxhc3REZWxpbWl0ZXJJbmRleCA9IHBhdGhuYW1lLmxhc3RJbmRleE9mKHBhdGguZGVsaW1pdGVyKTtcbiAgICAgICAgaWYgKGxhc3REZWxpbWl0ZXJJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiBbcGF0aG5hbWUuc3Vic3RyaW5nKDAsIGxhc3REZWxpbWl0ZXJJbmRleCksIHBhdGhuYW1lLnN1YnN0cmluZyhsYXN0RGVsaW1pdGVySW5kZXggKyAxKV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFtcIlwiLCBwYXRobmFtZV07XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgYmFzZW5hbWUgb2YgdGhlIHBhdGguIFRoYXQgaXMgdGhlIHNlY29uZCBlbGVtZW50IG9mIHRoZSBwYWlyIHJldHVybmVkIGJ5IHBhc3NpbmdcbiAgICAgKiBwYXRoIGludG8ge0BsaW5rIHBhdGguc3BsaXR9LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhuYW1lIC0gVGhlIHBhdGggdG8gcHJvY2Vzcy5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgYmFzZW5hbWUuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwYy5wYXRoLmdldEJhc2VuYW1lKFwiL3BhdGgvdG8vZmlsZS50eHRcIik7IC8vIHJldHVybnMgXCJmaWxlLnR4dFwiXG4gICAgICogcGMucGF0aC5nZXRCYXNlbmFtZShcIi9wYXRoL3RvL2RpclwiKTsgLy8gcmV0dXJucyBcImRpclwiXG4gICAgICovXG4gICAgZ2V0QmFzZW5hbWU6IGZ1bmN0aW9uIChwYXRobmFtZSkge1xuICAgICAgICByZXR1cm4gcGF0aC5zcGxpdChwYXRobmFtZSlbMV07XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZGlyZWN0b3J5IG5hbWUgZnJvbSB0aGUgcGF0aC4gVGhpcyBpcyBldmVyeXRoaW5nIHVwIHRvIHRoZSBmaW5hbCBpbnN0YW5jZSBvZlxuICAgICAqIHtAbGluayBwYXRoLmRlbGltaXRlcn0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aG5hbWUgLSBUaGUgcGF0aCB0byBnZXQgdGhlIGRpcmVjdG9yeSBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBkaXJlY3RvcnkgcGFydCBvZiB0aGUgcGF0aC5cbiAgICAgKi9cbiAgICBnZXREaXJlY3Rvcnk6IGZ1bmN0aW9uIChwYXRobmFtZSkge1xuICAgICAgICByZXR1cm4gcGF0aC5zcGxpdChwYXRobmFtZSlbMF07XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgZXh0ZW5zaW9uIG9mIHRoZSBwYXRoLiBQb3AgdGhlIGxhc3QgdmFsdWUgb2YgYSBsaXN0IGFmdGVyIHBhdGggaXMgc3BsaXQgYnlcbiAgICAgKiBxdWVzdGlvbiBtYXJrIGFuZCBjb21tYS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRobmFtZSAtIFRoZSBwYXRoIHRvIHByb2Nlc3MuXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGV4dGVuc2lvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLnBhdGguZ2V0RXh0ZW5zaW9uKFwiL3BhdGgvdG8vZmlsZS50eHRcIik7IC8vIHJldHVybnMgXCIudHh0XCJcbiAgICAgKiBwYy5wYXRoLmdldEV4dGVuc2lvbihcIi9wYXRoL3RvL2ZpbGUuanBnXCIpOyAvLyByZXR1cm5zIFwiLmpwZ1wiXG4gICAgICogcGMucGF0aC5nZXRFeHRlbnNpb24oXCIvcGF0aC90by9maWxlLnR4dD9mdW5jdGlvbj1nZXRFeHRlbnNpb25cIik7IC8vIHJldHVybnMgXCIudHh0XCJcbiAgICAgKi9cbiAgICBnZXRFeHRlbnNpb246IGZ1bmN0aW9uIChwYXRobmFtZSkge1xuICAgICAgICBjb25zdCBleHQgPSBwYXRobmFtZS5zcGxpdCgnPycpWzBdLnNwbGl0KCcuJykucG9wKCk7XG4gICAgICAgIGlmIChleHQgIT09IHBhdGhuYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gJy4nICsgZXh0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ2hlY2sgaWYgYSBzdHJpbmcgcyBpcyByZWxhdGl2ZSBwYXRoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhuYW1lIC0gVGhlIHBhdGggdG8gcHJvY2Vzcy5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiBzIGRvZXNuJ3Qgc3RhcnQgd2l0aCBzbGFzaCBhbmQgZG9lc24ndCBpbmNsdWRlIGNvbG9uIGFuZCBkb3VibGVcbiAgICAgKiBzbGFzaC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcGMucGF0aC5pc1JlbGF0aXZlUGF0aChcImZpbGUudHh0XCIpOyAvLyByZXR1cm5zIHRydWVcbiAgICAgKiBwYy5wYXRoLmlzUmVsYXRpdmVQYXRoKFwicGF0aC90by9maWxlLnR4dFwiKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogcGMucGF0aC5pc1JlbGF0aXZlUGF0aChcIi4vcGF0aC90by9maWxlLnR4dFwiKTsgLy8gcmV0dXJucyB0cnVlXG4gICAgICogcGMucGF0aC5pc1JlbGF0aXZlUGF0aChcIi4uL3BhdGgvdG8vZmlsZS5qcGdcIik7IC8vIHJldHVybnMgdHJ1ZVxuICAgICAqIHBjLnBhdGguaXNSZWxhdGl2ZVBhdGgoXCIvcGF0aC90by9maWxlLmpwZ1wiKTsgLy8gcmV0dXJucyBmYWxzZVxuICAgICAqIHBjLnBhdGguaXNSZWxhdGl2ZVBhdGgoXCJodHRwOi8vcGF0aC90by9maWxlLmpwZ1wiKTsgLy8gcmV0dXJucyBmYWxzZVxuICAgICAqL1xuICAgIGlzUmVsYXRpdmVQYXRoOiBmdW5jdGlvbiAocGF0aG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHBhdGhuYW1lLmNoYXJBdCgwKSAhPT0gJy8nICYmIHBhdGhuYW1lLm1hdGNoKC86XFwvXFwvLykgPT09IG51bGw7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgcGF0aCB3aXRob3V0IGZpbGUgbmFtZS4gSWYgcGF0aCBpcyByZWxhdGl2ZSBwYXRoLCBzdGFydCB3aXRoIHBlcmlvZC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRobmFtZSAtIFRoZSBmdWxsIHBhdGggdG8gcHJvY2Vzcy5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBUaGUgcGF0aCB3aXRob3V0IGEgbGFzdCBlbGVtZW50IGZyb20gbGlzdCBzcGxpdCBieSBzbGFzaC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBjLnBhdGguZXh0cmFjdFBhdGgoXCJwYXRoL3RvL2ZpbGUudHh0XCIpOyAgICAvLyByZXR1cm5zIFwiLi9wYXRoL3RvXCJcbiAgICAgKiBwYy5wYXRoLmV4dHJhY3RQYXRoKFwiLi9wYXRoL3RvL2ZpbGUudHh0XCIpOyAgLy8gcmV0dXJucyBcIi4vcGF0aC90b1wiXG4gICAgICogcGMucGF0aC5leHRyYWN0UGF0aChcIi4uL3BhdGgvdG8vZmlsZS50eHRcIik7IC8vIHJldHVybnMgXCIuLi9wYXRoL3RvXCJcbiAgICAgKiBwYy5wYXRoLmV4dHJhY3RQYXRoKFwiL3BhdGgvdG8vZmlsZS50eHRcIik7ICAgLy8gcmV0dXJucyBcIi9wYXRoL3RvXCJcbiAgICAgKi9cbiAgICBleHRyYWN0UGF0aDogZnVuY3Rpb24gKHBhdGhuYW1lKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSAnJztcbiAgICAgICAgY29uc3QgcGFydHMgPSBwYXRobmFtZS5zcGxpdCgnLycpO1xuICAgICAgICBsZXQgaSA9IDA7XG5cbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIGlmIChwYXRoLmlzUmVsYXRpdmVQYXRoKHBhdGhuYW1lKSkge1xuICAgICAgICAgICAgICAgIGlmIChwYXJ0c1swXSA9PT0gJy4nKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGggLSAxOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSAoaSA9PT0gMCkgPyBwYXJ0c1tpXSA6ICcvJyArIHBhcnRzW2ldO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHBhcnRzWzBdID09PSAnLi4nKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGggLSAxOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCArPSAoaSA9PT0gMCkgPyBwYXJ0c1tpXSA6ICcvJyArIHBhcnRzW2ldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gJy4nO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoIC0gMTsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXN1bHQgKz0gJy8nICsgcGFydHNbaV07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGggLSAxOyArK2kpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ICs9IChpID09PSAwKSA/IHBhcnRzW2ldIDogJy8nICsgcGFydHNbaV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufTtcblxuZXhwb3J0IHsgcGF0aCB9O1xuIl0sIm5hbWVzIjpbInBhdGgiLCJkZWxpbWl0ZXIiLCJqb2luIiwibnVtIiwiYXJndW1lbnRzIiwibGVuZ3RoIiwicmVzdWx0IiwiaW5kZXgiLCJvbmUiLCJEZWJ1ZyIsImFzc2VydCIsInVuZGVmaW5lZCIsInR3byIsIm5vcm1hbGl6ZSIsInBhdGhuYW1lIiwibGVhZCIsInN0YXJ0c1dpdGgiLCJ0cmFpbCIsImVuZHNXaXRoIiwicGFydHMiLCJzcGxpdCIsImNsZWFuZWQiLCJpIiwic2xpY2UiLCJwdXNoIiwibGFzdERlbGltaXRlckluZGV4IiwibGFzdEluZGV4T2YiLCJzdWJzdHJpbmciLCJnZXRCYXNlbmFtZSIsImdldERpcmVjdG9yeSIsImdldEV4dGVuc2lvbiIsImV4dCIsInBvcCIsImlzUmVsYXRpdmVQYXRoIiwiY2hhckF0IiwibWF0Y2giLCJleHRyYWN0UGF0aCJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxJQUFJLEdBQUc7QUFDVDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFNBQVMsRUFBRSxHQUFHO0FBRWQ7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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
