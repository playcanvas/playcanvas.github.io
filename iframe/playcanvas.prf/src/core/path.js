const path = {
  delimiter: '/',
  join(...sections) {
    let result = sections[0];
    for (let i = 0; i < sections.length - 1; i++) {
      const one = sections[i];
      const two = sections[i + 1];
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
  normalize(pathname) {
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
  split(pathname) {
    const lastDelimiterIndex = pathname.lastIndexOf(path.delimiter);
    if (lastDelimiterIndex !== -1) {
      return [pathname.substring(0, lastDelimiterIndex), pathname.substring(lastDelimiterIndex + 1)];
    }
    return ["", pathname];
  },
  getBasename(pathname) {
    return path.split(pathname)[1];
  },
  getDirectory(pathname) {
    return path.split(pathname)[0];
  },
  getExtension(pathname) {
    const ext = pathname.split('?')[0].split('.').pop();
    if (ext !== pathname) {
      return '.' + ext;
    }
    return '';
  },
  isRelativePath(pathname) {
    return pathname.charAt(0) !== '/' && pathname.match(/:\/\//) === null;
  },
  extractPath(pathname) {
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
