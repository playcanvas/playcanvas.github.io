// markup scanner

// list of scanner tokens
const EOF_TOKEN = 0;
const ERROR_TOKEN = 1;
const TEXT_TOKEN = 2;
const OPEN_BRACKET_TOKEN = 3;
const CLOSE_BRACKET_TOKEN = 4;
const EQUALS_TOKEN = 5;
const STRING_TOKEN = 6;
const IDENTIFIER_TOKEN = 7;
const WHITESPACE_TOKEN = 8;
const WHITESPACE_CHARS = ' \t\n\r\v\f';
const IDENTIFIER_REGEX = /[A-Z|a-z|0-9|_|-|/]/;
class Scanner {
  constructor(symbols) {
    this._symbols = symbols;
    this._index = 0;
    this._last = 0;
    this._cur = this._symbols.length > 0 ? this._symbols[0] : null;
    this._buf = [];
    this._mode = 'text';
    this._error = null;
  }

  // read the next token, ignore whitespace
  read() {
    let token = this._read();
    while (token === WHITESPACE_TOKEN) {
      token = this._read();
    }
    if (token !== EOF_TOKEN && token !== ERROR_TOKEN) {
      this._last = this._index;
    }
    return token;
  }

  // returns the buffer for the last returned token
  buf() {
    return this._buf;
  }

  // returns the index of end of the last successful token extraction
  last() {
    return this._last;
  }

  // return the error message
  error() {
    return this._error;
  }

  // print the scanner output
  debugPrint() {
    const tokenStrings = ['EOF', 'ERROR', 'TEXT', 'OPEN_BRACKET', 'CLOSE_BRACKET', 'EQUALS', 'STRING', 'IDENTIFIER', 'WHITESPACE'];
    let token = this.read();
    let result = '';
    while (true) {
      result += (result.length > 0 ? '\n' : '') + tokenStrings[token] + ' \'' + this.buf().join('') + '\'';
      if (token === EOF_TOKEN || token === ERROR_TOKEN) {
        break;
      }
      token = this.read();
    }
    return result;
  }

  // read the next token from the input stream and return the token
  _read() {
    this._buf = [];
    if (this._eof()) {
      return EOF_TOKEN;
    }
    return this._mode === 'text' ? this._text() : this._tag();
  }

  // read text block until eof or start of tag
  _text() {
    while (true) {
      switch (this._cur) {
        case null:
          // reached end of input
          return this._buf.length > 0 ? TEXT_TOKEN : EOF_TOKEN;
        case '[':
          // start of tag mode
          this._mode = 'tag';
          return this._buf.length > 0 ? TEXT_TOKEN : this._tag();
        case '\\':
          // handle escape sequence
          this._next(); // skip \
          switch (this._cur) {
            case '[':
              this._store();
              break;
            default:
              // if we don't recognize the escape sequence, output
              // the slash without interpretation and continue
              this._output('\\');
              break;
          }
          break;
        default:
          this._store();
          break;
      }
    }
  }

  // read tag block
  _tag() {
    switch (this._cur) {
      case null:
        this._error = 'unexpected end of input reading tag';
        return ERROR_TOKEN;
      case '[':
        this._store();
        return OPEN_BRACKET_TOKEN;
      case ']':
        this._store();
        this._mode = 'text';
        return CLOSE_BRACKET_TOKEN;
      case '=':
        this._store();
        return EQUALS_TOKEN;
      case ' ':
      case '\t':
      case '\n':
      case '\r':
      case '\v':
      case '\f':
        return this._whitespace();
      case '"':
        return this._string();
      default:
        if (!this._isIdentifierSymbol(this._cur)) {
          this._error = 'unrecognized character';
          return ERROR_TOKEN;
        }
        return this._identifier();
    }
  }
  _whitespace() {
    this._store();
    while (WHITESPACE_CHARS.indexOf(this._cur) !== -1) {
      this._store();
    }
    return WHITESPACE_TOKEN;
  }
  _string() {
    this._next(); // skip "
    while (true) {
      switch (this._cur) {
        case null:
          this._error = 'unexpected end of input reading string';
          return ERROR_TOKEN;
        case '"':
          this._next(); // skip "
          return STRING_TOKEN;
        default:
          this._store();
          break;
      }
    }
  }
  _identifier() {
    this._store();
    while (this._cur !== null && this._isIdentifierSymbol(this._cur)) {
      this._store();
    }
    return IDENTIFIER_TOKEN;
  }
  _isIdentifierSymbol(s) {
    return s.length === 1 && s.match(IDENTIFIER_REGEX) !== null;
  }
  _eof() {
    return this._cur === null;
  }
  _next() {
    if (!this._eof()) {
      this._index++;
      this._cur = this._index < this._symbols.length ? this._symbols[this._index] : null;
    }
    return this._cur;
  }
  _store() {
    this._buf.push(this._cur);
    return this._next();
  }
  _output(c) {
    this._buf.push(c);
  }
}

// markup parser
class Parser {
  constructor(symbols) {
    this._scanner = new Scanner(symbols);
    this._error = null;
  }

  // parse the incoming symbols placing resulting symbols in symbols
  // and tags in tags
  // tags is an array of the following structure:
  // {
  //     name: string;                    // tag name, for example 'color'
  //     value: string;                   // optional tag value, for example '#ff0000'
  //     attributes: {                    // list of attributes
  //         key: value;                  // optional key/value pairs
  //     }
  //     start: int;                      // first symbol to which this tag applies
  //     end: int;                        // last symbol to which this tag applies
  // }
  parse(symbols, tags) {
    while (true) {
      const token = this._scanner.read();
      switch (token) {
        case EOF_TOKEN:
          return true;
        case ERROR_TOKEN:
          return false;
        case TEXT_TOKEN:
          Array.prototype.push.apply(symbols, this._scanner.buf());
          break;
        case OPEN_BRACKET_TOKEN:
          if (!this._parseTag(symbols, tags)) {
            return false;
          }
          break;
        default:
          // any other tag at this point is an error
          return false;
      }
    }
  }

  // access an error message if the parser failed
  error() {
    return 'Error evaluating markup at #' + this._scanner.last().toString() + ' (' + (this._scanner.error() || this._error) + ')';
  }
  _parseTag(symbols, tags) {
    // first token after [ must be an identifier
    let token = this._scanner.read();
    if (token !== IDENTIFIER_TOKEN) {
      this._error = 'expected identifier';
      return false;
    }
    const name = this._scanner.buf().join('');

    // handle close tags
    if (name[0] === '/') {
      for (let index = tags.length - 1; index >= 0; --index) {
        if (name === '/' + tags[index].name && tags[index].end === null) {
          tags[index].end = symbols.length;
          token = this._scanner.read();
          if (token !== CLOSE_BRACKET_TOKEN) {
            this._error = 'expected close bracket';
            return false;
          }
          return true;
        }
      }
      this._error = 'failed to find matching tag';
      return false;
    }

    // else handle open tag
    const tag = {
      name: name,
      value: null,
      attributes: {},
      start: symbols.length,
      end: null
    };

    // read optional tag value
    token = this._scanner.read();
    if (token === EQUALS_TOKEN) {
      token = this._scanner.read();
      if (token !== STRING_TOKEN) {
        this._error = 'expected string';
        return false;
      }
      tag.value = this._scanner.buf().join('');
      token = this._scanner.read();
    }

    // read optional tag attributes
    while (true) {
      switch (token) {
        case CLOSE_BRACKET_TOKEN:
          tags.push(tag);
          return true;
        case IDENTIFIER_TOKEN:
          {
            const identifier = this._scanner.buf().join('');
            token = this._scanner.read();
            if (token !== EQUALS_TOKEN) {
              this._error = 'expected equals';
              return false;
            }
            token = this._scanner.read();
            if (token !== STRING_TOKEN) {
              this._error = 'expected string';
              return false;
            }
            const value = this._scanner.buf().join('');
            tag.attributes[identifier] = value;
            break;
          }
        default:
          this._error = 'expected close bracket or identifier';
          return false;
      }
      token = this._scanner.read();
    }
  }
}

// copy the contents of source object into target object (like a deep version
// of assign)
function merge(target, source) {
  for (const key in source) {
    if (!source.hasOwnProperty(key)) {
      continue;
    }
    const value = source[key];
    if (value instanceof Object) {
      if (!target.hasOwnProperty(key)) {
        target[key] = {};
      }
      merge(target[key], source[key]);
    } else {
      target[key] = value;
    }
  }
}
function combineTags(tags) {
  if (tags.length === 0) {
    return null;
  }
  const result = {};
  for (let index = 0; index < tags.length; ++index) {
    const tag = tags[index];
    const tmp = {};
    tmp[tag.name] = {
      value: tag.value,
      attributes: tag.attributes
    };
    merge(result, tmp);
  }
  return result;
}

// this function performs a simple task, but tries to do so in a relatively
// efficient manner. given the list of tags extracted from the text and
// ordered by start position, it calculates for each output symbol, the
// resulting effective tags.
// to do this we must determine which tags overlap each character and merge the
// tags together (since tags found later in the text can override the values of
// tags found earlier).
// returns an array containing the tag structure (or null) for each symbol
function resolveMarkupTags(tags, numSymbols) {
  if (tags.length === 0) {
    return null;
  }

  // make list of tag start/end edges
  const edges = {};
  for (let index = 0; index < tags.length; ++index) {
    const tag = tags[index];
    if (!edges.hasOwnProperty(tag.start)) {
      edges[tag.start] = {
        open: [tag],
        close: null
      };
    } else {
      if (edges[tag.start].open === null) {
        edges[tag.start].open = [tag];
      } else {
        edges[tag.start].open.push(tag);
      }
    }
    if (!edges.hasOwnProperty(tag.end)) {
      edges[tag.end] = {
        open: null,
        close: [tag]
      };
    } else {
      if (edges[tag.end].close === null) {
        edges[tag.end].close = [tag];
      } else {
        edges[tag.end].close.push(tag);
      }
    }
  }

  // build tag instances from open/close edges
  let tagStack = [];
  function removeTags(tags) {
    tagStack = tagStack.filter(function (tag) {
      return tags.find(function (t) {
        return t === tag;
      }) === undefined;
    });
  }
  function addTags(tags) {
    for (let index = 0; index < tags.length; ++index) {
      tagStack.push(tags[index]);
    }
  }
  const edgeKeys = Object.keys(edges).sort(function (a, b) {
    return a - b;
  });
  const resolvedTags = [];
  for (let index = 0; index < edgeKeys.length; ++index) {
    const edge = edges[edgeKeys[index]];

    // remove close tags
    if (edge.close !== null) {
      removeTags(edge.close);
    }

    // add open tags
    if (edge.open !== null) {
      addTags(edge.open);
    }

    // store the resolved tags
    resolvedTags.push({
      start: edgeKeys[index],
      tags: combineTags(tagStack)
    });
  }

  // assign the resolved tags per-character
  const result = [];
  let prevTag = null;
  for (let index = 0; index < resolvedTags.length; ++index) {
    const resolvedTag = resolvedTags[index];
    while (result.length < resolvedTag.start) {
      result.push(prevTag ? prevTag.tags : null);
    }
    prevTag = resolvedTag;
  }
  while (result.length < numSymbols) {
    result.push(null);
  }
  return result;
}

// evaluate the list of symbols, extract the markup tags and return an
// array of symbols and an array of symbol tags
function evaluateMarkup(symbols) {
  // log scanner output
  // console.info((new Scanner(symbols)).debugPrint());

  const parser = new Parser(symbols);
  const stripped_symbols = [];
  const tags = [];
  if (!parser.parse(stripped_symbols, tags)) {
    console.warn(parser.error());
    return {
      symbols: symbols,
      tags: null
    };
  }

  // if any tags were not correctly closed, return failure
  const invalidTag = tags.find(function (t) {
    return t.end === null;
  });
  if (invalidTag) {
    console.warn(`Markup error: found unclosed tag='${invalidTag.name}'`);
    return {
      symbols: symbols,
      tags: null
    };
  }

  // revolve tags per-character
  const resolved_tags = resolveMarkupTags(tags, stripped_symbols.length);
  return {
    symbols: stripped_symbols,
    tags: resolved_tags
  };
}
class Markup {
  static evaluate(symbols) {
    return evaluateMarkup(symbols);
  }
}

export { Markup };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFya3VwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9tYXJrdXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gbWFya3VwIHNjYW5uZXJcblxuLy8gbGlzdCBvZiBzY2FubmVyIHRva2Vuc1xuY29uc3QgRU9GX1RPS0VOID0gMDtcbmNvbnN0IEVSUk9SX1RPS0VOID0gMTtcbmNvbnN0IFRFWFRfVE9LRU4gPSAyO1xuY29uc3QgT1BFTl9CUkFDS0VUX1RPS0VOID0gMztcbmNvbnN0IENMT1NFX0JSQUNLRVRfVE9LRU4gPSA0O1xuY29uc3QgRVFVQUxTX1RPS0VOID0gNTtcbmNvbnN0IFNUUklOR19UT0tFTiA9IDY7XG5jb25zdCBJREVOVElGSUVSX1RPS0VOID0gNztcbmNvbnN0IFdISVRFU1BBQ0VfVE9LRU4gPSA4O1xuY29uc3QgV0hJVEVTUEFDRV9DSEFSUyA9ICcgXFx0XFxuXFxyXFx2XFxmJztcbmNvbnN0IElERU5USUZJRVJfUkVHRVggPSAvW0EtWnxhLXp8MC05fF98LXwvXS87XG5cbmNsYXNzIFNjYW5uZXIge1xuICAgIGNvbnN0cnVjdG9yKHN5bWJvbHMpIHtcbiAgICAgICAgdGhpcy5fc3ltYm9scyA9IHN5bWJvbHM7XG4gICAgICAgIHRoaXMuX2luZGV4ID0gMDtcbiAgICAgICAgdGhpcy5fbGFzdCA9IDA7XG4gICAgICAgIHRoaXMuX2N1ciA9ICh0aGlzLl9zeW1ib2xzLmxlbmd0aCA+IDApID8gdGhpcy5fc3ltYm9sc1swXSA6IG51bGw7XG4gICAgICAgIHRoaXMuX2J1ZiA9IFtdO1xuICAgICAgICB0aGlzLl9tb2RlID0gJ3RleHQnO1xuICAgICAgICB0aGlzLl9lcnJvciA9IG51bGw7XG4gICAgfVxuXG4gICAgLy8gcmVhZCB0aGUgbmV4dCB0b2tlbiwgaWdub3JlIHdoaXRlc3BhY2VcbiAgICByZWFkKCkge1xuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLl9yZWFkKCk7XG4gICAgICAgIHdoaWxlICh0b2tlbiA9PT0gV0hJVEVTUEFDRV9UT0tFTikge1xuICAgICAgICAgICAgdG9rZW4gPSB0aGlzLl9yZWFkKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRva2VuICE9PSBFT0ZfVE9LRU4gJiYgdG9rZW4gIT09IEVSUk9SX1RPS0VOKSB7XG4gICAgICAgICAgICB0aGlzLl9sYXN0ID0gdGhpcy5faW5kZXg7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRva2VuO1xuICAgIH1cblxuICAgIC8vIHJldHVybnMgdGhlIGJ1ZmZlciBmb3IgdGhlIGxhc3QgcmV0dXJuZWQgdG9rZW5cbiAgICBidWYoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9idWY7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyB0aGUgaW5kZXggb2YgZW5kIG9mIHRoZSBsYXN0IHN1Y2Nlc3NmdWwgdG9rZW4gZXh0cmFjdGlvblxuICAgIGxhc3QoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXN0O1xuICAgIH1cblxuICAgIC8vIHJldHVybiB0aGUgZXJyb3IgbWVzc2FnZVxuICAgIGVycm9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZXJyb3I7XG4gICAgfVxuXG4gICAgLy8gcHJpbnQgdGhlIHNjYW5uZXIgb3V0cHV0XG4gICAgZGVidWdQcmludCgpIHtcbiAgICAgICAgY29uc3QgdG9rZW5TdHJpbmdzID0gWydFT0YnLCAnRVJST1InLCAnVEVYVCcsICdPUEVOX0JSQUNLRVQnLCAnQ0xPU0VfQlJBQ0tFVCcsICdFUVVBTFMnLCAnU1RSSU5HJywgJ0lERU5USUZJRVInLCAnV0hJVEVTUEFDRSddO1xuICAgICAgICBsZXQgdG9rZW4gPSB0aGlzLnJlYWQoKTtcbiAgICAgICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgcmVzdWx0ICs9IChyZXN1bHQubGVuZ3RoID4gMCA/ICdcXG4nIDogJycpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRva2VuU3RyaW5nc1t0b2tlbl0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgJyBcXCcnICsgdGhpcy5idWYoKS5qb2luKCcnKSArICdcXCcnO1xuICAgICAgICAgICAgaWYgKHRva2VuID09PSBFT0ZfVE9LRU4gfHwgdG9rZW4gPT09IEVSUk9SX1RPS0VOKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0b2tlbiA9IHRoaXMucmVhZCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLy8gcmVhZCB0aGUgbmV4dCB0b2tlbiBmcm9tIHRoZSBpbnB1dCBzdHJlYW0gYW5kIHJldHVybiB0aGUgdG9rZW5cbiAgICBfcmVhZCgpIHtcbiAgICAgICAgdGhpcy5fYnVmID0gW107XG4gICAgICAgIGlmICh0aGlzLl9lb2YoKSkge1xuICAgICAgICAgICAgcmV0dXJuIEVPRl9UT0tFTjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKHRoaXMuX21vZGUgPT09ICd0ZXh0JykgPyB0aGlzLl90ZXh0KCkgOiB0aGlzLl90YWcoKTtcbiAgICB9XG5cbiAgICAvLyByZWFkIHRleHQgYmxvY2sgdW50aWwgZW9mIG9yIHN0YXJ0IG9mIHRhZ1xuICAgIF90ZXh0KCkge1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgc3dpdGNoICh0aGlzLl9jdXIpIHtcbiAgICAgICAgICAgICAgICBjYXNlIG51bGw6XG4gICAgICAgICAgICAgICAgICAgIC8vIHJlYWNoZWQgZW5kIG9mIGlucHV0XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAodGhpcy5fYnVmLmxlbmd0aCA+IDApID8gVEVYVF9UT0tFTiA6IEVPRl9UT0tFTjtcbiAgICAgICAgICAgICAgICBjYXNlICdbJzpcbiAgICAgICAgICAgICAgICAgICAgLy8gc3RhcnQgb2YgdGFnIG1vZGVcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbW9kZSA9ICd0YWcnO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gKHRoaXMuX2J1Zi5sZW5ndGggPiAwKSA/IFRFWFRfVE9LRU4gOiB0aGlzLl90YWcoKTtcbiAgICAgICAgICAgICAgICBjYXNlICdcXFxcJzpcbiAgICAgICAgICAgICAgICAgICAgLy8gaGFuZGxlIGVzY2FwZSBzZXF1ZW5jZVxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9uZXh0KCk7ICAgICAgICAgICAvLyBza2lwIFxcXG4gICAgICAgICAgICAgICAgICAgIHN3aXRjaCAodGhpcy5fY3VyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdbJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zdG9yZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB3ZSBkb24ndCByZWNvZ25pemUgdGhlIGVzY2FwZSBzZXF1ZW5jZSwgb3V0cHV0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHNsYXNoIHdpdGhvdXQgaW50ZXJwcmV0YXRpb24gYW5kIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3V0cHV0KCdcXFxcJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc3RvcmUoKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZWFkIHRhZyBibG9ja1xuICAgIF90YWcoKSB7XG4gICAgICAgIHN3aXRjaCAodGhpcy5fY3VyKSB7XG4gICAgICAgICAgICBjYXNlIG51bGw6XG4gICAgICAgICAgICAgICAgdGhpcy5fZXJyb3IgPSAndW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgcmVhZGluZyB0YWcnO1xuICAgICAgICAgICAgICAgIHJldHVybiBFUlJPUl9UT0tFTjtcbiAgICAgICAgICAgIGNhc2UgJ1snOlxuICAgICAgICAgICAgICAgIHRoaXMuX3N0b3JlKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9QRU5fQlJBQ0tFVF9UT0tFTjtcbiAgICAgICAgICAgIGNhc2UgJ10nOlxuICAgICAgICAgICAgICAgIHRoaXMuX3N0b3JlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fbW9kZSA9ICd0ZXh0JztcbiAgICAgICAgICAgICAgICByZXR1cm4gQ0xPU0VfQlJBQ0tFVF9UT0tFTjtcbiAgICAgICAgICAgIGNhc2UgJz0nOlxuICAgICAgICAgICAgICAgIHRoaXMuX3N0b3JlKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIEVRVUFMU19UT0tFTjtcbiAgICAgICAgICAgIGNhc2UgJyAnOlxuICAgICAgICAgICAgY2FzZSAnXFx0JzpcbiAgICAgICAgICAgIGNhc2UgJ1xcbic6XG4gICAgICAgICAgICBjYXNlICdcXHInOlxuICAgICAgICAgICAgY2FzZSAnXFx2JzpcbiAgICAgICAgICAgIGNhc2UgJ1xcZic6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3doaXRlc3BhY2UoKTtcbiAgICAgICAgICAgIGNhc2UgJ1wiJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc3RyaW5nKCk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5faXNJZGVudGlmaWVyU3ltYm9sKHRoaXMuX2N1cikpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXJyb3IgPSAndW5yZWNvZ25pemVkIGNoYXJhY3Rlcic7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBFUlJPUl9UT0tFTjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2lkZW50aWZpZXIoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF93aGl0ZXNwYWNlKCkge1xuICAgICAgICB0aGlzLl9zdG9yZSgpO1xuICAgICAgICB3aGlsZSAoV0hJVEVTUEFDRV9DSEFSUy5pbmRleE9mKHRoaXMuX2N1cikgIT09IC0xKSB7XG4gICAgICAgICAgICB0aGlzLl9zdG9yZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBXSElURVNQQUNFX1RPS0VOO1xuICAgIH1cblxuICAgIF9zdHJpbmcoKSB7XG4gICAgICAgIHRoaXMuX25leHQoKTsgICAgICAgLy8gc2tpcCBcIlxuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgc3dpdGNoICh0aGlzLl9jdXIpIHtcbiAgICAgICAgICAgICAgICBjYXNlIG51bGw6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2Vycm9yID0gJ3VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IHJlYWRpbmcgc3RyaW5nJztcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIEVSUk9SX1RPS0VOO1xuICAgICAgICAgICAgICAgIGNhc2UgJ1wiJzpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbmV4dCgpOyAgICAgICAgICAgLy8gc2tpcCBcIlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU1RSSU5HX1RPS0VOO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3N0b3JlKCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2lkZW50aWZpZXIoKSB7XG4gICAgICAgIHRoaXMuX3N0b3JlKCk7XG4gICAgICAgIHdoaWxlICh0aGlzLl9jdXIgIT09IG51bGwgJiZcbiAgICAgICAgICAgICAgICB0aGlzLl9pc0lkZW50aWZpZXJTeW1ib2wodGhpcy5fY3VyKSkge1xuICAgICAgICAgICAgdGhpcy5fc3RvcmUoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gSURFTlRJRklFUl9UT0tFTjtcbiAgICB9XG5cbiAgICBfaXNJZGVudGlmaWVyU3ltYm9sKHMpIHtcbiAgICAgICAgcmV0dXJuIHMubGVuZ3RoID09PSAxICYmIChzLm1hdGNoKElERU5USUZJRVJfUkVHRVgpICE9PSBudWxsKTtcbiAgICB9XG5cbiAgICBfZW9mKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VyID09PSBudWxsO1xuICAgIH1cblxuICAgIF9uZXh0KCkge1xuICAgICAgICBpZiAoIXRoaXMuX2VvZigpKSB7XG4gICAgICAgICAgICB0aGlzLl9pbmRleCsrO1xuICAgICAgICAgICAgdGhpcy5fY3VyID0gKHRoaXMuX2luZGV4IDwgdGhpcy5fc3ltYm9scy5sZW5ndGgpID8gdGhpcy5fc3ltYm9sc1t0aGlzLl9pbmRleF0gOiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jdXI7XG4gICAgfVxuXG4gICAgX3N0b3JlKCkge1xuICAgICAgICB0aGlzLl9idWYucHVzaCh0aGlzLl9jdXIpO1xuICAgICAgICByZXR1cm4gdGhpcy5fbmV4dCgpO1xuICAgIH1cblxuICAgIF9vdXRwdXQoYykge1xuICAgICAgICB0aGlzLl9idWYucHVzaChjKTtcbiAgICB9XG59XG5cbi8vIG1hcmt1cCBwYXJzZXJcbmNsYXNzIFBhcnNlciB7XG4gICAgY29uc3RydWN0b3Ioc3ltYm9scykge1xuICAgICAgICB0aGlzLl9zY2FubmVyID0gbmV3IFNjYW5uZXIoc3ltYm9scyk7XG4gICAgICAgIHRoaXMuX2Vycm9yID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBwYXJzZSB0aGUgaW5jb21pbmcgc3ltYm9scyBwbGFjaW5nIHJlc3VsdGluZyBzeW1ib2xzIGluIHN5bWJvbHNcbiAgICAvLyBhbmQgdGFncyBpbiB0YWdzXG4gICAgLy8gdGFncyBpcyBhbiBhcnJheSBvZiB0aGUgZm9sbG93aW5nIHN0cnVjdHVyZTpcbiAgICAvLyB7XG4gICAgLy8gICAgIG5hbWU6IHN0cmluZzsgICAgICAgICAgICAgICAgICAgIC8vIHRhZyBuYW1lLCBmb3IgZXhhbXBsZSAnY29sb3InXG4gICAgLy8gICAgIHZhbHVlOiBzdHJpbmc7ICAgICAgICAgICAgICAgICAgIC8vIG9wdGlvbmFsIHRhZyB2YWx1ZSwgZm9yIGV4YW1wbGUgJyNmZjAwMDAnXG4gICAgLy8gICAgIGF0dHJpYnV0ZXM6IHsgICAgICAgICAgICAgICAgICAgIC8vIGxpc3Qgb2YgYXR0cmlidXRlc1xuICAgIC8vICAgICAgICAga2V5OiB2YWx1ZTsgICAgICAgICAgICAgICAgICAvLyBvcHRpb25hbCBrZXkvdmFsdWUgcGFpcnNcbiAgICAvLyAgICAgfVxuICAgIC8vICAgICBzdGFydDogaW50OyAgICAgICAgICAgICAgICAgICAgICAvLyBmaXJzdCBzeW1ib2wgdG8gd2hpY2ggdGhpcyB0YWcgYXBwbGllc1xuICAgIC8vICAgICBlbmQ6IGludDsgICAgICAgICAgICAgICAgICAgICAgICAvLyBsYXN0IHN5bWJvbCB0byB3aGljaCB0aGlzIHRhZyBhcHBsaWVzXG4gICAgLy8gfVxuICAgIHBhcnNlKHN5bWJvbHMsIHRhZ3MpIHtcbiAgICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuID0gdGhpcy5fc2Nhbm5lci5yZWFkKCk7XG4gICAgICAgICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBFT0ZfVE9LRU46XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIGNhc2UgRVJST1JfVE9LRU46XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICBjYXNlIFRFWFRfVE9LRU46XG4gICAgICAgICAgICAgICAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHN5bWJvbHMsIHRoaXMuX3NjYW5uZXIuYnVmKCkpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlIE9QRU5fQlJBQ0tFVF9UT0tFTjpcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9wYXJzZVRhZyhzeW1ib2xzLCB0YWdzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIC8vIGFueSBvdGhlciB0YWcgYXQgdGhpcyBwb2ludCBpcyBhbiBlcnJvclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhY2Nlc3MgYW4gZXJyb3IgbWVzc2FnZSBpZiB0aGUgcGFyc2VyIGZhaWxlZFxuICAgIGVycm9yKCkge1xuICAgICAgICByZXR1cm4gJ0Vycm9yIGV2YWx1YXRpbmcgbWFya3VwIGF0ICMnICsgdGhpcy5fc2Nhbm5lci5sYXN0KCkudG9TdHJpbmcoKSArXG4gICAgICAgICAgICAgICAgJyAoJyArICh0aGlzLl9zY2FubmVyLmVycm9yKCkgfHwgdGhpcy5fZXJyb3IpICsgJyknO1xuICAgIH1cblxuICAgIF9wYXJzZVRhZyhzeW1ib2xzLCB0YWdzKSB7XG4gICAgICAgIC8vIGZpcnN0IHRva2VuIGFmdGVyIFsgbXVzdCBiZSBhbiBpZGVudGlmaWVyXG4gICAgICAgIGxldCB0b2tlbiA9IHRoaXMuX3NjYW5uZXIucmVhZCgpO1xuICAgICAgICBpZiAodG9rZW4gIT09IElERU5USUZJRVJfVE9LRU4pIHtcbiAgICAgICAgICAgIHRoaXMuX2Vycm9yID0gJ2V4cGVjdGVkIGlkZW50aWZpZXInO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmFtZSA9IHRoaXMuX3NjYW5uZXIuYnVmKCkuam9pbignJyk7XG5cbiAgICAgICAgLy8gaGFuZGxlIGNsb3NlIHRhZ3NcbiAgICAgICAgaWYgKG5hbWVbMF0gPT09ICcvJykge1xuICAgICAgICAgICAgZm9yIChsZXQgaW5kZXggPSB0YWdzLmxlbmd0aCAtIDE7IGluZGV4ID49IDA7IC0taW5kZXgpIHtcbiAgICAgICAgICAgICAgICBpZiAobmFtZSA9PT0gJy8nICsgdGFnc1tpbmRleF0ubmFtZSAmJiB0YWdzW2luZGV4XS5lbmQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFnc1tpbmRleF0uZW5kID0gc3ltYm9scy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuID0gdGhpcy5fc2Nhbm5lci5yZWFkKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0b2tlbiAhPT0gQ0xPU0VfQlJBQ0tFVF9UT0tFTikge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXJyb3IgPSAnZXhwZWN0ZWQgY2xvc2UgYnJhY2tldCc7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fZXJyb3IgPSAnZmFpbGVkIHRvIGZpbmQgbWF0Y2hpbmcgdGFnJztcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVsc2UgaGFuZGxlIG9wZW4gdGFnXG4gICAgICAgIGNvbnN0IHRhZyA9IHtcbiAgICAgICAgICAgIG5hbWU6IG5hbWUsXG4gICAgICAgICAgICB2YWx1ZTogbnVsbCxcbiAgICAgICAgICAgIGF0dHJpYnV0ZXM6IHsgfSxcbiAgICAgICAgICAgIHN0YXJ0OiBzeW1ib2xzLmxlbmd0aCxcbiAgICAgICAgICAgIGVuZDogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHJlYWQgb3B0aW9uYWwgdGFnIHZhbHVlXG4gICAgICAgIHRva2VuID0gdGhpcy5fc2Nhbm5lci5yZWFkKCk7XG4gICAgICAgIGlmICh0b2tlbiA9PT0gRVFVQUxTX1RPS0VOKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHRoaXMuX3NjYW5uZXIucmVhZCgpO1xuICAgICAgICAgICAgaWYgKHRva2VuICE9PSBTVFJJTkdfVE9LRU4pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9lcnJvciA9ICdleHBlY3RlZCBzdHJpbmcnO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRhZy52YWx1ZSA9IHRoaXMuX3NjYW5uZXIuYnVmKCkuam9pbignJyk7XG4gICAgICAgICAgICB0b2tlbiA9IHRoaXMuX3NjYW5uZXIucmVhZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVhZCBvcHRpb25hbCB0YWcgYXR0cmlidXRlc1xuICAgICAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICAgICAgc3dpdGNoICh0b2tlbikge1xuICAgICAgICAgICAgICAgIGNhc2UgQ0xPU0VfQlJBQ0tFVF9UT0tFTjpcbiAgICAgICAgICAgICAgICAgICAgdGFncy5wdXNoKHRhZyk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIGNhc2UgSURFTlRJRklFUl9UT0tFTjoge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gdGhpcy5fc2Nhbm5lci5idWYoKS5qb2luKCcnKTtcbiAgICAgICAgICAgICAgICAgICAgdG9rZW4gPSB0aGlzLl9zY2FubmVyLnJlYWQoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRva2VuICE9PSBFUVVBTFNfVE9LRU4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2Vycm9yID0gJ2V4cGVjdGVkIGVxdWFscyc7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdG9rZW4gPSB0aGlzLl9zY2FubmVyLnJlYWQoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRva2VuICE9PSBTVFJJTkdfVE9LRU4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2Vycm9yID0gJ2V4cGVjdGVkIHN0cmluZyc7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLl9zY2FubmVyLmJ1ZigpLmpvaW4oJycpO1xuICAgICAgICAgICAgICAgICAgICB0YWcuYXR0cmlidXRlc1tpZGVudGlmaWVyXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXJyb3IgPSAnZXhwZWN0ZWQgY2xvc2UgYnJhY2tldCBvciBpZGVudGlmaWVyJztcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG9rZW4gPSB0aGlzLl9zY2FubmVyLnJlYWQoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLy8gY29weSB0aGUgY29udGVudHMgb2Ygc291cmNlIG9iamVjdCBpbnRvIHRhcmdldCBvYmplY3QgKGxpa2UgYSBkZWVwIHZlcnNpb25cbi8vIG9mIGFzc2lnbilcbmZ1bmN0aW9uIG1lcmdlKHRhcmdldCwgc291cmNlKSB7XG4gICAgZm9yIChjb25zdCBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgIGlmICghc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHZhbHVlID0gc291cmNlW2tleV07XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdCkge1xuICAgICAgICAgICAgaWYgKCF0YXJnZXQuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFtrZXldID0geyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWVyZ2UodGFyZ2V0W2tleV0sIHNvdXJjZVtrZXldKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhcmdldFtrZXldID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNvbWJpbmVUYWdzKHRhZ3MpIHtcbiAgICBpZiAodGFncy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IHsgfTtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGFncy5sZW5ndGg7ICsraW5kZXgpIHtcbiAgICAgICAgY29uc3QgdGFnID0gdGFnc1tpbmRleF07XG4gICAgICAgIGNvbnN0IHRtcCA9IHsgfTtcbiAgICAgICAgdG1wW3RhZy5uYW1lXSA9IHsgdmFsdWU6IHRhZy52YWx1ZSwgYXR0cmlidXRlczogdGFnLmF0dHJpYnV0ZXMgfTtcbiAgICAgICAgbWVyZ2UocmVzdWx0LCB0bXApO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG4vLyB0aGlzIGZ1bmN0aW9uIHBlcmZvcm1zIGEgc2ltcGxlIHRhc2ssIGJ1dCB0cmllcyB0byBkbyBzbyBpbiBhIHJlbGF0aXZlbHlcbi8vIGVmZmljaWVudCBtYW5uZXIuIGdpdmVuIHRoZSBsaXN0IG9mIHRhZ3MgZXh0cmFjdGVkIGZyb20gdGhlIHRleHQgYW5kXG4vLyBvcmRlcmVkIGJ5IHN0YXJ0IHBvc2l0aW9uLCBpdCBjYWxjdWxhdGVzIGZvciBlYWNoIG91dHB1dCBzeW1ib2wsIHRoZVxuLy8gcmVzdWx0aW5nIGVmZmVjdGl2ZSB0YWdzLlxuLy8gdG8gZG8gdGhpcyB3ZSBtdXN0IGRldGVybWluZSB3aGljaCB0YWdzIG92ZXJsYXAgZWFjaCBjaGFyYWN0ZXIgYW5kIG1lcmdlIHRoZVxuLy8gdGFncyB0b2dldGhlciAoc2luY2UgdGFncyBmb3VuZCBsYXRlciBpbiB0aGUgdGV4dCBjYW4gb3ZlcnJpZGUgdGhlIHZhbHVlcyBvZlxuLy8gdGFncyBmb3VuZCBlYXJsaWVyKS5cbi8vIHJldHVybnMgYW4gYXJyYXkgY29udGFpbmluZyB0aGUgdGFnIHN0cnVjdHVyZSAob3IgbnVsbCkgZm9yIGVhY2ggc3ltYm9sXG5mdW5jdGlvbiByZXNvbHZlTWFya3VwVGFncyh0YWdzLCBudW1TeW1ib2xzKSB7XG4gICAgaWYgKHRhZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIG1ha2UgbGlzdCBvZiB0YWcgc3RhcnQvZW5kIGVkZ2VzXG4gICAgY29uc3QgZWRnZXMgPSB7IH07XG4gICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHRhZ3MubGVuZ3RoOyArK2luZGV4KSB7XG4gICAgICAgIGNvbnN0IHRhZyA9IHRhZ3NbaW5kZXhdO1xuICAgICAgICBpZiAoIWVkZ2VzLmhhc093blByb3BlcnR5KHRhZy5zdGFydCkpIHtcbiAgICAgICAgICAgIGVkZ2VzW3RhZy5zdGFydF0gPSB7IG9wZW46IFt0YWddLCBjbG9zZTogbnVsbCB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGVkZ2VzW3RhZy5zdGFydF0ub3BlbiA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVkZ2VzW3RhZy5zdGFydF0ub3BlbiA9IFt0YWddO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlZGdlc1t0YWcuc3RhcnRdLm9wZW4ucHVzaCh0YWcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFlZGdlcy5oYXNPd25Qcm9wZXJ0eSh0YWcuZW5kKSkge1xuICAgICAgICAgICAgZWRnZXNbdGFnLmVuZF0gPSB7IG9wZW46IG51bGwsIGNsb3NlOiBbdGFnXSB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGVkZ2VzW3RhZy5lbmRdLmNsb3NlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZWRnZXNbdGFnLmVuZF0uY2xvc2UgPSBbdGFnXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWRnZXNbdGFnLmVuZF0uY2xvc2UucHVzaCh0YWcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYnVpbGQgdGFnIGluc3RhbmNlcyBmcm9tIG9wZW4vY2xvc2UgZWRnZXNcbiAgICBsZXQgdGFnU3RhY2sgPSBbXTtcblxuICAgIGZ1bmN0aW9uIHJlbW92ZVRhZ3ModGFncykge1xuICAgICAgICB0YWdTdGFjayA9IHRhZ1N0YWNrLmZpbHRlcihmdW5jdGlvbiAodGFnKSB7XG4gICAgICAgICAgICByZXR1cm4gdGFncy5maW5kKGZ1bmN0aW9uICh0KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHQgPT09IHRhZztcbiAgICAgICAgICAgIH0pID09PSB1bmRlZmluZWQ7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFkZFRhZ3ModGFncykge1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgdGFncy5sZW5ndGg7ICsraW5kZXgpIHtcbiAgICAgICAgICAgIHRhZ1N0YWNrLnB1c2godGFnc1tpbmRleF0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZWRnZUtleXMgPSBPYmplY3Qua2V5cyhlZGdlcykuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYSAtIGI7XG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNvbHZlZFRhZ3MgPSBbXTtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgZWRnZUtleXMubGVuZ3RoOyArK2luZGV4KSB7XG4gICAgICAgIGNvbnN0IGVkZ2UgPSBlZGdlc1tlZGdlS2V5c1tpbmRleF1dO1xuXG4gICAgICAgIC8vIHJlbW92ZSBjbG9zZSB0YWdzXG4gICAgICAgIGlmIChlZGdlLmNsb3NlICE9PSBudWxsKSB7XG4gICAgICAgICAgICByZW1vdmVUYWdzKGVkZ2UuY2xvc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYWRkIG9wZW4gdGFnc1xuICAgICAgICBpZiAoZWRnZS5vcGVuICE9PSBudWxsKSB7XG4gICAgICAgICAgICBhZGRUYWdzKGVkZ2Uub3Blbik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzdG9yZSB0aGUgcmVzb2x2ZWQgdGFnc1xuICAgICAgICByZXNvbHZlZFRhZ3MucHVzaCh7XG4gICAgICAgICAgICBzdGFydDogZWRnZUtleXNbaW5kZXhdLFxuICAgICAgICAgICAgdGFnczogY29tYmluZVRhZ3ModGFnU3RhY2spXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIGFzc2lnbiB0aGUgcmVzb2x2ZWQgdGFncyBwZXItY2hhcmFjdGVyXG4gICAgY29uc3QgcmVzdWx0ID0gW107XG4gICAgbGV0IHByZXZUYWcgPSBudWxsO1xuICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCByZXNvbHZlZFRhZ3MubGVuZ3RoOyArK2luZGV4KSB7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkVGFnID0gcmVzb2x2ZWRUYWdzW2luZGV4XTtcbiAgICAgICAgd2hpbGUgKHJlc3VsdC5sZW5ndGggPCByZXNvbHZlZFRhZy5zdGFydCkge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2gocHJldlRhZyA/IHByZXZUYWcudGFncyA6IG51bGwpO1xuICAgICAgICB9XG4gICAgICAgIHByZXZUYWcgPSByZXNvbHZlZFRhZztcbiAgICB9XG4gICAgd2hpbGUgKHJlc3VsdC5sZW5ndGggPCBudW1TeW1ib2xzKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKG51bGwpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIGV2YWx1YXRlIHRoZSBsaXN0IG9mIHN5bWJvbHMsIGV4dHJhY3QgdGhlIG1hcmt1cCB0YWdzIGFuZCByZXR1cm4gYW5cbi8vIGFycmF5IG9mIHN5bWJvbHMgYW5kIGFuIGFycmF5IG9mIHN5bWJvbCB0YWdzXG5mdW5jdGlvbiBldmFsdWF0ZU1hcmt1cChzeW1ib2xzKSB7XG4gICAgLy8gbG9nIHNjYW5uZXIgb3V0cHV0XG4gICAgLy8gY29uc29sZS5pbmZvKChuZXcgU2Nhbm5lcihzeW1ib2xzKSkuZGVidWdQcmludCgpKTtcblxuICAgIGNvbnN0IHBhcnNlciA9IG5ldyBQYXJzZXIoc3ltYm9scyk7XG4gICAgY29uc3Qgc3RyaXBwZWRfc3ltYm9scyA9IFtdO1xuICAgIGNvbnN0IHRhZ3MgPSBbXTtcblxuICAgIGlmICghcGFyc2VyLnBhcnNlKHN0cmlwcGVkX3N5bWJvbHMsIHRhZ3MpKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihwYXJzZXIuZXJyb3IoKSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzeW1ib2xzOiBzeW1ib2xzLFxuICAgICAgICAgICAgdGFnczogbnVsbFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIGlmIGFueSB0YWdzIHdlcmUgbm90IGNvcnJlY3RseSBjbG9zZWQsIHJldHVybiBmYWlsdXJlXG4gICAgY29uc3QgaW52YWxpZFRhZyA9IHRhZ3MuZmluZChmdW5jdGlvbiAodCkge1xuICAgICAgICByZXR1cm4gdC5lbmQgPT09IG51bGw7XG4gICAgfSk7XG5cbiAgICBpZiAoaW52YWxpZFRhZykge1xuICAgICAgICBjb25zb2xlLndhcm4oYE1hcmt1cCBlcnJvcjogZm91bmQgdW5jbG9zZWQgdGFnPScke2ludmFsaWRUYWcubmFtZX0nYCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzeW1ib2xzOiBzeW1ib2xzLFxuICAgICAgICAgICAgdGFnczogbnVsbFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8vIHJldm9sdmUgdGFncyBwZXItY2hhcmFjdGVyXG4gICAgY29uc3QgcmVzb2x2ZWRfdGFncyA9IHJlc29sdmVNYXJrdXBUYWdzKHRhZ3MsIHN0cmlwcGVkX3N5bWJvbHMubGVuZ3RoKTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIHN5bWJvbHM6IHN0cmlwcGVkX3N5bWJvbHMsXG4gICAgICAgIHRhZ3M6IHJlc29sdmVkX3RhZ3NcbiAgICB9O1xufVxuXG5jbGFzcyBNYXJrdXAge1xuICAgIHN0YXRpYyBldmFsdWF0ZShzeW1ib2xzKSB7XG4gICAgICAgIHJldHVybiBldmFsdWF0ZU1hcmt1cChzeW1ib2xzKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IE1hcmt1cCB9O1xuIl0sIm5hbWVzIjpbIkVPRl9UT0tFTiIsIkVSUk9SX1RPS0VOIiwiVEVYVF9UT0tFTiIsIk9QRU5fQlJBQ0tFVF9UT0tFTiIsIkNMT1NFX0JSQUNLRVRfVE9LRU4iLCJFUVVBTFNfVE9LRU4iLCJTVFJJTkdfVE9LRU4iLCJJREVOVElGSUVSX1RPS0VOIiwiV0hJVEVTUEFDRV9UT0tFTiIsIldISVRFU1BBQ0VfQ0hBUlMiLCJJREVOVElGSUVSX1JFR0VYIiwiU2Nhbm5lciIsImNvbnN0cnVjdG9yIiwic3ltYm9scyIsIl9zeW1ib2xzIiwiX2luZGV4IiwiX2xhc3QiLCJfY3VyIiwibGVuZ3RoIiwiX2J1ZiIsIl9tb2RlIiwiX2Vycm9yIiwicmVhZCIsInRva2VuIiwiX3JlYWQiLCJidWYiLCJsYXN0IiwiZXJyb3IiLCJkZWJ1Z1ByaW50IiwidG9rZW5TdHJpbmdzIiwicmVzdWx0Iiwiam9pbiIsIl9lb2YiLCJfdGV4dCIsIl90YWciLCJfbmV4dCIsIl9zdG9yZSIsIl9vdXRwdXQiLCJfd2hpdGVzcGFjZSIsIl9zdHJpbmciLCJfaXNJZGVudGlmaWVyU3ltYm9sIiwiX2lkZW50aWZpZXIiLCJpbmRleE9mIiwicyIsIm1hdGNoIiwicHVzaCIsImMiLCJQYXJzZXIiLCJfc2Nhbm5lciIsInBhcnNlIiwidGFncyIsIkFycmF5IiwicHJvdG90eXBlIiwiYXBwbHkiLCJfcGFyc2VUYWciLCJ0b1N0cmluZyIsIm5hbWUiLCJpbmRleCIsImVuZCIsInRhZyIsInZhbHVlIiwiYXR0cmlidXRlcyIsInN0YXJ0IiwiaWRlbnRpZmllciIsIm1lcmdlIiwidGFyZ2V0Iiwic291cmNlIiwia2V5IiwiaGFzT3duUHJvcGVydHkiLCJPYmplY3QiLCJjb21iaW5lVGFncyIsInRtcCIsInJlc29sdmVNYXJrdXBUYWdzIiwibnVtU3ltYm9scyIsImVkZ2VzIiwib3BlbiIsImNsb3NlIiwidGFnU3RhY2siLCJyZW1vdmVUYWdzIiwiZmlsdGVyIiwiZmluZCIsInQiLCJ1bmRlZmluZWQiLCJhZGRUYWdzIiwiZWRnZUtleXMiLCJrZXlzIiwic29ydCIsImEiLCJiIiwicmVzb2x2ZWRUYWdzIiwiZWRnZSIsInByZXZUYWciLCJyZXNvbHZlZFRhZyIsImV2YWx1YXRlTWFya3VwIiwicGFyc2VyIiwic3RyaXBwZWRfc3ltYm9scyIsImNvbnNvbGUiLCJ3YXJuIiwiaW52YWxpZFRhZyIsInJlc29sdmVkX3RhZ3MiLCJNYXJrdXAiLCJldmFsdWF0ZSJdLCJtYXBwaW5ncyI6IkFBQUE7O0FBRUE7QUFDQSxNQUFNQSxTQUFTLEdBQUcsQ0FBQyxDQUFBO0FBQ25CLE1BQU1DLFdBQVcsR0FBRyxDQUFDLENBQUE7QUFDckIsTUFBTUMsVUFBVSxHQUFHLENBQUMsQ0FBQTtBQUNwQixNQUFNQyxrQkFBa0IsR0FBRyxDQUFDLENBQUE7QUFDNUIsTUFBTUMsbUJBQW1CLEdBQUcsQ0FBQyxDQUFBO0FBQzdCLE1BQU1DLFlBQVksR0FBRyxDQUFDLENBQUE7QUFDdEIsTUFBTUMsWUFBWSxHQUFHLENBQUMsQ0FBQTtBQUN0QixNQUFNQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUE7QUFDMUIsTUFBTUMsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO0FBQzFCLE1BQU1DLGdCQUFnQixHQUFHLGFBQWEsQ0FBQTtBQUN0QyxNQUFNQyxnQkFBZ0IsR0FBRyxxQkFBcUIsQ0FBQTtBQUU5QyxNQUFNQyxPQUFPLENBQUM7RUFDVkMsV0FBV0EsQ0FBQ0MsT0FBTyxFQUFFO0lBQ2pCLElBQUksQ0FBQ0MsUUFBUSxHQUFHRCxPQUFPLENBQUE7SUFDdkIsSUFBSSxDQUFDRSxNQUFNLEdBQUcsQ0FBQyxDQUFBO0lBQ2YsSUFBSSxDQUFDQyxLQUFLLEdBQUcsQ0FBQyxDQUFBO0FBQ2QsSUFBQSxJQUFJLENBQUNDLElBQUksR0FBSSxJQUFJLENBQUNILFFBQVEsQ0FBQ0ksTUFBTSxHQUFHLENBQUMsR0FBSSxJQUFJLENBQUNKLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUE7SUFDaEUsSUFBSSxDQUFDSyxJQUFJLEdBQUcsRUFBRSxDQUFBO0lBQ2QsSUFBSSxDQUFDQyxLQUFLLEdBQUcsTUFBTSxDQUFBO0lBQ25CLElBQUksQ0FBQ0MsTUFBTSxHQUFHLElBQUksQ0FBQTtBQUN0QixHQUFBOztBQUVBO0FBQ0FDLEVBQUFBLElBQUlBLEdBQUc7QUFDSCxJQUFBLElBQUlDLEtBQUssR0FBRyxJQUFJLENBQUNDLEtBQUssRUFBRSxDQUFBO0lBQ3hCLE9BQU9ELEtBQUssS0FBS2YsZ0JBQWdCLEVBQUU7QUFDL0JlLE1BQUFBLEtBQUssR0FBRyxJQUFJLENBQUNDLEtBQUssRUFBRSxDQUFBO0FBQ3hCLEtBQUE7QUFDQSxJQUFBLElBQUlELEtBQUssS0FBS3ZCLFNBQVMsSUFBSXVCLEtBQUssS0FBS3RCLFdBQVcsRUFBRTtBQUM5QyxNQUFBLElBQUksQ0FBQ2UsS0FBSyxHQUFHLElBQUksQ0FBQ0QsTUFBTSxDQUFBO0FBQzVCLEtBQUE7QUFDQSxJQUFBLE9BQU9RLEtBQUssQ0FBQTtBQUNoQixHQUFBOztBQUVBO0FBQ0FFLEVBQUFBLEdBQUdBLEdBQUc7SUFDRixPQUFPLElBQUksQ0FBQ04sSUFBSSxDQUFBO0FBQ3BCLEdBQUE7O0FBRUE7QUFDQU8sRUFBQUEsSUFBSUEsR0FBRztJQUNILE9BQU8sSUFBSSxDQUFDVixLQUFLLENBQUE7QUFDckIsR0FBQTs7QUFFQTtBQUNBVyxFQUFBQSxLQUFLQSxHQUFHO0lBQ0osT0FBTyxJQUFJLENBQUNOLE1BQU0sQ0FBQTtBQUN0QixHQUFBOztBQUVBO0FBQ0FPLEVBQUFBLFVBQVVBLEdBQUc7SUFDVCxNQUFNQyxZQUFZLEdBQUcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxDQUFBO0FBQzlILElBQUEsSUFBSU4sS0FBSyxHQUFHLElBQUksQ0FBQ0QsSUFBSSxFQUFFLENBQUE7SUFDdkIsSUFBSVEsTUFBTSxHQUFHLEVBQUUsQ0FBQTtBQUNmLElBQUEsT0FBTyxJQUFJLEVBQUU7QUFDVEEsTUFBQUEsTUFBTSxJQUFJLENBQUNBLE1BQU0sQ0FBQ1osTUFBTSxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRSxJQUM1QlcsWUFBWSxDQUFDTixLQUFLLENBQUMsR0FDbkIsS0FBSyxHQUFHLElBQUksQ0FBQ0UsR0FBRyxFQUFFLENBQUNNLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUE7QUFDOUMsTUFBQSxJQUFJUixLQUFLLEtBQUt2QixTQUFTLElBQUl1QixLQUFLLEtBQUt0QixXQUFXLEVBQUU7QUFDOUMsUUFBQSxNQUFBO0FBQ0osT0FBQTtBQUNBc0IsTUFBQUEsS0FBSyxHQUFHLElBQUksQ0FBQ0QsSUFBSSxFQUFFLENBQUE7QUFDdkIsS0FBQTtBQUNBLElBQUEsT0FBT1EsTUFBTSxDQUFBO0FBQ2pCLEdBQUE7O0FBRUE7QUFDQU4sRUFBQUEsS0FBS0EsR0FBRztJQUNKLElBQUksQ0FBQ0wsSUFBSSxHQUFHLEVBQUUsQ0FBQTtBQUNkLElBQUEsSUFBSSxJQUFJLENBQUNhLElBQUksRUFBRSxFQUFFO0FBQ2IsTUFBQSxPQUFPaEMsU0FBUyxDQUFBO0FBQ3BCLEtBQUE7QUFDQSxJQUFBLE9BQVEsSUFBSSxDQUFDb0IsS0FBSyxLQUFLLE1BQU0sR0FBSSxJQUFJLENBQUNhLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQ0MsSUFBSSxFQUFFLENBQUE7QUFDL0QsR0FBQTs7QUFFQTtBQUNBRCxFQUFBQSxLQUFLQSxHQUFHO0FBQ0osSUFBQSxPQUFPLElBQUksRUFBRTtNQUNULFFBQVEsSUFBSSxDQUFDaEIsSUFBSTtBQUNiLFFBQUEsS0FBSyxJQUFJO0FBQ0w7VUFDQSxPQUFRLElBQUksQ0FBQ0UsSUFBSSxDQUFDRCxNQUFNLEdBQUcsQ0FBQyxHQUFJaEIsVUFBVSxHQUFHRixTQUFTLENBQUE7QUFDMUQsUUFBQSxLQUFLLEdBQUc7QUFDSjtVQUNBLElBQUksQ0FBQ29CLEtBQUssR0FBRyxLQUFLLENBQUE7QUFDbEIsVUFBQSxPQUFRLElBQUksQ0FBQ0QsSUFBSSxDQUFDRCxNQUFNLEdBQUcsQ0FBQyxHQUFJaEIsVUFBVSxHQUFHLElBQUksQ0FBQ2dDLElBQUksRUFBRSxDQUFBO0FBQzVELFFBQUEsS0FBSyxJQUFJO0FBQ0w7QUFDQSxVQUFBLElBQUksQ0FBQ0MsS0FBSyxFQUFFLENBQUM7VUFDYixRQUFRLElBQUksQ0FBQ2xCLElBQUk7QUFDYixZQUFBLEtBQUssR0FBRztjQUNKLElBQUksQ0FBQ21CLE1BQU0sRUFBRSxDQUFBO0FBQ2IsY0FBQSxNQUFBO0FBQ0osWUFBQTtBQUNJO0FBQ0E7QUFDQSxjQUFBLElBQUksQ0FBQ0MsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ2xCLGNBQUEsTUFBQTtBQUNSLFdBQUE7QUFDQSxVQUFBLE1BQUE7QUFDSixRQUFBO1VBQ0ksSUFBSSxDQUFDRCxNQUFNLEVBQUUsQ0FBQTtBQUNiLFVBQUEsTUFBQTtBQUNSLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFFQTtBQUNBRixFQUFBQSxJQUFJQSxHQUFHO0lBQ0gsUUFBUSxJQUFJLENBQUNqQixJQUFJO0FBQ2IsTUFBQSxLQUFLLElBQUk7UUFDTCxJQUFJLENBQUNJLE1BQU0sR0FBRyxxQ0FBcUMsQ0FBQTtBQUNuRCxRQUFBLE9BQU9wQixXQUFXLENBQUE7QUFDdEIsTUFBQSxLQUFLLEdBQUc7UUFDSixJQUFJLENBQUNtQyxNQUFNLEVBQUUsQ0FBQTtBQUNiLFFBQUEsT0FBT2pDLGtCQUFrQixDQUFBO0FBQzdCLE1BQUEsS0FBSyxHQUFHO1FBQ0osSUFBSSxDQUFDaUMsTUFBTSxFQUFFLENBQUE7UUFDYixJQUFJLENBQUNoQixLQUFLLEdBQUcsTUFBTSxDQUFBO0FBQ25CLFFBQUEsT0FBT2hCLG1CQUFtQixDQUFBO0FBQzlCLE1BQUEsS0FBSyxHQUFHO1FBQ0osSUFBSSxDQUFDZ0MsTUFBTSxFQUFFLENBQUE7QUFDYixRQUFBLE9BQU8vQixZQUFZLENBQUE7QUFDdkIsTUFBQSxLQUFLLEdBQUcsQ0FBQTtBQUNSLE1BQUEsS0FBSyxJQUFJLENBQUE7QUFDVCxNQUFBLEtBQUssSUFBSSxDQUFBO0FBQ1QsTUFBQSxLQUFLLElBQUksQ0FBQTtBQUNULE1BQUEsS0FBSyxJQUFJLENBQUE7QUFDVCxNQUFBLEtBQUssSUFBSTtBQUNMLFFBQUEsT0FBTyxJQUFJLENBQUNpQyxXQUFXLEVBQUUsQ0FBQTtBQUM3QixNQUFBLEtBQUssR0FBRztBQUNKLFFBQUEsT0FBTyxJQUFJLENBQUNDLE9BQU8sRUFBRSxDQUFBO0FBQ3pCLE1BQUE7UUFDSSxJQUFJLENBQUMsSUFBSSxDQUFDQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUN2QixJQUFJLENBQUMsRUFBRTtVQUN0QyxJQUFJLENBQUNJLE1BQU0sR0FBRyx3QkFBd0IsQ0FBQTtBQUN0QyxVQUFBLE9BQU9wQixXQUFXLENBQUE7QUFDdEIsU0FBQTtBQUNBLFFBQUEsT0FBTyxJQUFJLENBQUN3QyxXQUFXLEVBQUUsQ0FBQTtBQUNqQyxLQUFBO0FBQ0osR0FBQTtBQUVBSCxFQUFBQSxXQUFXQSxHQUFHO0lBQ1YsSUFBSSxDQUFDRixNQUFNLEVBQUUsQ0FBQTtJQUNiLE9BQU8zQixnQkFBZ0IsQ0FBQ2lDLE9BQU8sQ0FBQyxJQUFJLENBQUN6QixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtNQUMvQyxJQUFJLENBQUNtQixNQUFNLEVBQUUsQ0FBQTtBQUNqQixLQUFBO0FBQ0EsSUFBQSxPQUFPNUIsZ0JBQWdCLENBQUE7QUFDM0IsR0FBQTtBQUVBK0IsRUFBQUEsT0FBT0EsR0FBRztBQUNOLElBQUEsSUFBSSxDQUFDSixLQUFLLEVBQUUsQ0FBQztBQUNiLElBQUEsT0FBTyxJQUFJLEVBQUU7TUFDVCxRQUFRLElBQUksQ0FBQ2xCLElBQUk7QUFDYixRQUFBLEtBQUssSUFBSTtVQUNMLElBQUksQ0FBQ0ksTUFBTSxHQUFHLHdDQUF3QyxDQUFBO0FBQ3RELFVBQUEsT0FBT3BCLFdBQVcsQ0FBQTtBQUN0QixRQUFBLEtBQUssR0FBRztBQUNKLFVBQUEsSUFBSSxDQUFDa0MsS0FBSyxFQUFFLENBQUM7QUFDYixVQUFBLE9BQU83QixZQUFZLENBQUE7QUFDdkIsUUFBQTtVQUNJLElBQUksQ0FBQzhCLE1BQU0sRUFBRSxDQUFBO0FBQ2IsVUFBQSxNQUFBO0FBQ1IsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUFLLEVBQUFBLFdBQVdBLEdBQUc7SUFDVixJQUFJLENBQUNMLE1BQU0sRUFBRSxDQUFBO0FBQ2IsSUFBQSxPQUFPLElBQUksQ0FBQ25CLElBQUksS0FBSyxJQUFJLElBQ2pCLElBQUksQ0FBQ3VCLG1CQUFtQixDQUFDLElBQUksQ0FBQ3ZCLElBQUksQ0FBQyxFQUFFO01BQ3pDLElBQUksQ0FBQ21CLE1BQU0sRUFBRSxDQUFBO0FBQ2pCLEtBQUE7QUFDQSxJQUFBLE9BQU83QixnQkFBZ0IsQ0FBQTtBQUMzQixHQUFBO0VBRUFpQyxtQkFBbUJBLENBQUNHLENBQUMsRUFBRTtBQUNuQixJQUFBLE9BQU9BLENBQUMsQ0FBQ3pCLE1BQU0sS0FBSyxDQUFDLElBQUt5QixDQUFDLENBQUNDLEtBQUssQ0FBQ2xDLGdCQUFnQixDQUFDLEtBQUssSUFBSyxDQUFBO0FBQ2pFLEdBQUE7QUFFQXNCLEVBQUFBLElBQUlBLEdBQUc7QUFDSCxJQUFBLE9BQU8sSUFBSSxDQUFDZixJQUFJLEtBQUssSUFBSSxDQUFBO0FBQzdCLEdBQUE7QUFFQWtCLEVBQUFBLEtBQUtBLEdBQUc7QUFDSixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUNILElBQUksRUFBRSxFQUFFO01BQ2QsSUFBSSxDQUFDakIsTUFBTSxFQUFFLENBQUE7TUFDYixJQUFJLENBQUNFLElBQUksR0FBSSxJQUFJLENBQUNGLE1BQU0sR0FBRyxJQUFJLENBQUNELFFBQVEsQ0FBQ0ksTUFBTSxHQUFJLElBQUksQ0FBQ0osUUFBUSxDQUFDLElBQUksQ0FBQ0MsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFBO0FBQ3hGLEtBQUE7SUFDQSxPQUFPLElBQUksQ0FBQ0UsSUFBSSxDQUFBO0FBQ3BCLEdBQUE7QUFFQW1CLEVBQUFBLE1BQU1BLEdBQUc7SUFDTCxJQUFJLENBQUNqQixJQUFJLENBQUMwQixJQUFJLENBQUMsSUFBSSxDQUFDNUIsSUFBSSxDQUFDLENBQUE7QUFDekIsSUFBQSxPQUFPLElBQUksQ0FBQ2tCLEtBQUssRUFBRSxDQUFBO0FBQ3ZCLEdBQUE7RUFFQUUsT0FBT0EsQ0FBQ1MsQ0FBQyxFQUFFO0FBQ1AsSUFBQSxJQUFJLENBQUMzQixJQUFJLENBQUMwQixJQUFJLENBQUNDLENBQUMsQ0FBQyxDQUFBO0FBQ3JCLEdBQUE7QUFDSixDQUFBOztBQUVBO0FBQ0EsTUFBTUMsTUFBTSxDQUFDO0VBQ1RuQyxXQUFXQSxDQUFDQyxPQUFPLEVBQUU7QUFDakIsSUFBQSxJQUFJLENBQUNtQyxRQUFRLEdBQUcsSUFBSXJDLE9BQU8sQ0FBQ0UsT0FBTyxDQUFDLENBQUE7SUFDcEMsSUFBSSxDQUFDUSxNQUFNLEdBQUcsSUFBSSxDQUFBO0FBQ3RCLEdBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E0QixFQUFBQSxLQUFLQSxDQUFDcEMsT0FBTyxFQUFFcUMsSUFBSSxFQUFFO0FBQ2pCLElBQUEsT0FBTyxJQUFJLEVBQUU7TUFDVCxNQUFNM0IsS0FBSyxHQUFHLElBQUksQ0FBQ3lCLFFBQVEsQ0FBQzFCLElBQUksRUFBRSxDQUFBO0FBQ2xDLE1BQUEsUUFBUUMsS0FBSztBQUNULFFBQUEsS0FBS3ZCLFNBQVM7QUFDVixVQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsUUFBQSxLQUFLQyxXQUFXO0FBQ1osVUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixRQUFBLEtBQUtDLFVBQVU7QUFDWGlELFVBQUFBLEtBQUssQ0FBQ0MsU0FBUyxDQUFDUCxJQUFJLENBQUNRLEtBQUssQ0FBQ3hDLE9BQU8sRUFBRSxJQUFJLENBQUNtQyxRQUFRLENBQUN2QixHQUFHLEVBQUUsQ0FBQyxDQUFBO0FBQ3hELFVBQUEsTUFBQTtBQUNKLFFBQUEsS0FBS3RCLGtCQUFrQjtVQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDbUQsU0FBUyxDQUFDekMsT0FBTyxFQUFFcUMsSUFBSSxDQUFDLEVBQUU7QUFDaEMsWUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixXQUFBO0FBQ0EsVUFBQSxNQUFBO0FBQ0osUUFBQTtBQUNJO0FBQ0EsVUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNwQixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7QUFDQXZCLEVBQUFBLEtBQUtBLEdBQUc7QUFDSixJQUFBLE9BQU8sOEJBQThCLEdBQUcsSUFBSSxDQUFDcUIsUUFBUSxDQUFDdEIsSUFBSSxFQUFFLENBQUM2QixRQUFRLEVBQUUsR0FDL0QsSUFBSSxJQUFJLElBQUksQ0FBQ1AsUUFBUSxDQUFDckIsS0FBSyxFQUFFLElBQUksSUFBSSxDQUFDTixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUE7QUFDL0QsR0FBQTtBQUVBaUMsRUFBQUEsU0FBU0EsQ0FBQ3pDLE9BQU8sRUFBRXFDLElBQUksRUFBRTtBQUNyQjtJQUNBLElBQUkzQixLQUFLLEdBQUcsSUFBSSxDQUFDeUIsUUFBUSxDQUFDMUIsSUFBSSxFQUFFLENBQUE7SUFDaEMsSUFBSUMsS0FBSyxLQUFLaEIsZ0JBQWdCLEVBQUU7TUFDNUIsSUFBSSxDQUFDYyxNQUFNLEdBQUcscUJBQXFCLENBQUE7QUFDbkMsTUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixLQUFBO0FBRUEsSUFBQSxNQUFNbUMsSUFBSSxHQUFHLElBQUksQ0FBQ1IsUUFBUSxDQUFDdkIsR0FBRyxFQUFFLENBQUNNLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQTs7QUFFekM7QUFDQSxJQUFBLElBQUl5QixJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO0FBQ2pCLE1BQUEsS0FBSyxJQUFJQyxLQUFLLEdBQUdQLElBQUksQ0FBQ2hDLE1BQU0sR0FBRyxDQUFDLEVBQUV1QyxLQUFLLElBQUksQ0FBQyxFQUFFLEVBQUVBLEtBQUssRUFBRTtBQUNuRCxRQUFBLElBQUlELElBQUksS0FBSyxHQUFHLEdBQUdOLElBQUksQ0FBQ08sS0FBSyxDQUFDLENBQUNELElBQUksSUFBSU4sSUFBSSxDQUFDTyxLQUFLLENBQUMsQ0FBQ0MsR0FBRyxLQUFLLElBQUksRUFBRTtVQUM3RFIsSUFBSSxDQUFDTyxLQUFLLENBQUMsQ0FBQ0MsR0FBRyxHQUFHN0MsT0FBTyxDQUFDSyxNQUFNLENBQUE7QUFDaENLLFVBQUFBLEtBQUssR0FBRyxJQUFJLENBQUN5QixRQUFRLENBQUMxQixJQUFJLEVBQUUsQ0FBQTtVQUM1QixJQUFJQyxLQUFLLEtBQUtuQixtQkFBbUIsRUFBRTtZQUMvQixJQUFJLENBQUNpQixNQUFNLEdBQUcsd0JBQXdCLENBQUE7QUFDdEMsWUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixXQUFBO0FBQ0EsVUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLFNBQUE7QUFDSixPQUFBO01BQ0EsSUFBSSxDQUFDQSxNQUFNLEdBQUcsNkJBQTZCLENBQUE7QUFDM0MsTUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixLQUFBOztBQUVBO0FBQ0EsSUFBQSxNQUFNc0MsR0FBRyxHQUFHO0FBQ1JILE1BQUFBLElBQUksRUFBRUEsSUFBSTtBQUNWSSxNQUFBQSxLQUFLLEVBQUUsSUFBSTtNQUNYQyxVQUFVLEVBQUUsRUFBRztNQUNmQyxLQUFLLEVBQUVqRCxPQUFPLENBQUNLLE1BQU07QUFDckJ3QyxNQUFBQSxHQUFHLEVBQUUsSUFBQTtLQUNSLENBQUE7O0FBRUQ7QUFDQW5DLElBQUFBLEtBQUssR0FBRyxJQUFJLENBQUN5QixRQUFRLENBQUMxQixJQUFJLEVBQUUsQ0FBQTtJQUM1QixJQUFJQyxLQUFLLEtBQUtsQixZQUFZLEVBQUU7QUFDeEJrQixNQUFBQSxLQUFLLEdBQUcsSUFBSSxDQUFDeUIsUUFBUSxDQUFDMUIsSUFBSSxFQUFFLENBQUE7TUFDNUIsSUFBSUMsS0FBSyxLQUFLakIsWUFBWSxFQUFFO1FBQ3hCLElBQUksQ0FBQ2UsTUFBTSxHQUFHLGlCQUFpQixDQUFBO0FBQy9CLFFBQUEsT0FBTyxLQUFLLENBQUE7QUFDaEIsT0FBQTtBQUNBc0MsTUFBQUEsR0FBRyxDQUFDQyxLQUFLLEdBQUcsSUFBSSxDQUFDWixRQUFRLENBQUN2QixHQUFHLEVBQUUsQ0FBQ00sSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3hDUixNQUFBQSxLQUFLLEdBQUcsSUFBSSxDQUFDeUIsUUFBUSxDQUFDMUIsSUFBSSxFQUFFLENBQUE7QUFDaEMsS0FBQTs7QUFFQTtBQUNBLElBQUEsT0FBTyxJQUFJLEVBQUU7QUFDVCxNQUFBLFFBQVFDLEtBQUs7QUFDVCxRQUFBLEtBQUtuQixtQkFBbUI7QUFDcEI4QyxVQUFBQSxJQUFJLENBQUNMLElBQUksQ0FBQ2MsR0FBRyxDQUFDLENBQUE7QUFDZCxVQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsUUFBQSxLQUFLcEQsZ0JBQWdCO0FBQUUsVUFBQTtBQUNuQixZQUFBLE1BQU13RCxVQUFVLEdBQUcsSUFBSSxDQUFDZixRQUFRLENBQUN2QixHQUFHLEVBQUUsQ0FBQ00sSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQy9DUixZQUFBQSxLQUFLLEdBQUcsSUFBSSxDQUFDeUIsUUFBUSxDQUFDMUIsSUFBSSxFQUFFLENBQUE7WUFDNUIsSUFBSUMsS0FBSyxLQUFLbEIsWUFBWSxFQUFFO2NBQ3hCLElBQUksQ0FBQ2dCLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQTtBQUMvQixjQUFBLE9BQU8sS0FBSyxDQUFBO0FBQ2hCLGFBQUE7QUFDQUUsWUFBQUEsS0FBSyxHQUFHLElBQUksQ0FBQ3lCLFFBQVEsQ0FBQzFCLElBQUksRUFBRSxDQUFBO1lBQzVCLElBQUlDLEtBQUssS0FBS2pCLFlBQVksRUFBRTtjQUN4QixJQUFJLENBQUNlLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQTtBQUMvQixjQUFBLE9BQU8sS0FBSyxDQUFBO0FBQ2hCLGFBQUE7QUFDQSxZQUFBLE1BQU11QyxLQUFLLEdBQUcsSUFBSSxDQUFDWixRQUFRLENBQUN2QixHQUFHLEVBQUUsQ0FBQ00sSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQzFDNEIsWUFBQUEsR0FBRyxDQUFDRSxVQUFVLENBQUNFLFVBQVUsQ0FBQyxHQUFHSCxLQUFLLENBQUE7QUFDbEMsWUFBQSxNQUFBO0FBQ0osV0FBQTtBQUNBLFFBQUE7VUFDSSxJQUFJLENBQUN2QyxNQUFNLEdBQUcsc0NBQXNDLENBQUE7QUFDcEQsVUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNwQixPQUFBO0FBQ0FFLE1BQUFBLEtBQUssR0FBRyxJQUFJLENBQUN5QixRQUFRLENBQUMxQixJQUFJLEVBQUUsQ0FBQTtBQUNoQyxLQUFBO0FBQ0osR0FBQTtBQUNKLENBQUE7O0FBRUE7QUFDQTtBQUNBLFNBQVMwQyxLQUFLQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUMzQixFQUFBLEtBQUssTUFBTUMsR0FBRyxJQUFJRCxNQUFNLEVBQUU7QUFDdEIsSUFBQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ0UsY0FBYyxDQUFDRCxHQUFHLENBQUMsRUFBRTtBQUM3QixNQUFBLFNBQUE7QUFDSixLQUFBO0FBQ0EsSUFBQSxNQUFNUCxLQUFLLEdBQUdNLE1BQU0sQ0FBQ0MsR0FBRyxDQUFDLENBQUE7SUFDekIsSUFBSVAsS0FBSyxZQUFZUyxNQUFNLEVBQUU7QUFDekIsTUFBQSxJQUFJLENBQUNKLE1BQU0sQ0FBQ0csY0FBYyxDQUFDRCxHQUFHLENBQUMsRUFBRTtBQUM3QkYsUUFBQUEsTUFBTSxDQUFDRSxHQUFHLENBQUMsR0FBRyxFQUFHLENBQUE7QUFDckIsT0FBQTtNQUNBSCxLQUFLLENBQUNDLE1BQU0sQ0FBQ0UsR0FBRyxDQUFDLEVBQUVELE1BQU0sQ0FBQ0MsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUNuQyxLQUFDLE1BQU07QUFDSEYsTUFBQUEsTUFBTSxDQUFDRSxHQUFHLENBQUMsR0FBR1AsS0FBSyxDQUFBO0FBQ3ZCLEtBQUE7QUFDSixHQUFBO0FBQ0osQ0FBQTtBQUVBLFNBQVNVLFdBQVdBLENBQUNwQixJQUFJLEVBQUU7QUFDdkIsRUFBQSxJQUFJQSxJQUFJLENBQUNoQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ25CLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBO0VBQ0EsTUFBTVksTUFBTSxHQUFHLEVBQUcsQ0FBQTtBQUNsQixFQUFBLEtBQUssSUFBSTJCLEtBQUssR0FBRyxDQUFDLEVBQUVBLEtBQUssR0FBR1AsSUFBSSxDQUFDaEMsTUFBTSxFQUFFLEVBQUV1QyxLQUFLLEVBQUU7QUFDOUMsSUFBQSxNQUFNRSxHQUFHLEdBQUdULElBQUksQ0FBQ08sS0FBSyxDQUFDLENBQUE7SUFDdkIsTUFBTWMsR0FBRyxHQUFHLEVBQUcsQ0FBQTtBQUNmQSxJQUFBQSxHQUFHLENBQUNaLEdBQUcsQ0FBQ0gsSUFBSSxDQUFDLEdBQUc7TUFBRUksS0FBSyxFQUFFRCxHQUFHLENBQUNDLEtBQUs7TUFBRUMsVUFBVSxFQUFFRixHQUFHLENBQUNFLFVBQUFBO0tBQVksQ0FBQTtBQUNoRUcsSUFBQUEsS0FBSyxDQUFDbEMsTUFBTSxFQUFFeUMsR0FBRyxDQUFDLENBQUE7QUFDdEIsR0FBQTtBQUNBLEVBQUEsT0FBT3pDLE1BQU0sQ0FBQTtBQUNqQixDQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTMEMsaUJBQWlCQSxDQUFDdEIsSUFBSSxFQUFFdUIsVUFBVSxFQUFFO0FBQ3pDLEVBQUEsSUFBSXZCLElBQUksQ0FBQ2hDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDbkIsSUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLEdBQUE7O0FBRUE7RUFDQSxNQUFNd0QsS0FBSyxHQUFHLEVBQUcsQ0FBQTtBQUNqQixFQUFBLEtBQUssSUFBSWpCLEtBQUssR0FBRyxDQUFDLEVBQUVBLEtBQUssR0FBR1AsSUFBSSxDQUFDaEMsTUFBTSxFQUFFLEVBQUV1QyxLQUFLLEVBQUU7QUFDOUMsSUFBQSxNQUFNRSxHQUFHLEdBQUdULElBQUksQ0FBQ08sS0FBSyxDQUFDLENBQUE7SUFDdkIsSUFBSSxDQUFDaUIsS0FBSyxDQUFDTixjQUFjLENBQUNULEdBQUcsQ0FBQ0csS0FBSyxDQUFDLEVBQUU7QUFDbENZLE1BQUFBLEtBQUssQ0FBQ2YsR0FBRyxDQUFDRyxLQUFLLENBQUMsR0FBRztRQUFFYSxJQUFJLEVBQUUsQ0FBQ2hCLEdBQUcsQ0FBQztBQUFFaUIsUUFBQUEsS0FBSyxFQUFFLElBQUE7T0FBTSxDQUFBO0FBQ25ELEtBQUMsTUFBTTtNQUNILElBQUlGLEtBQUssQ0FBQ2YsR0FBRyxDQUFDRyxLQUFLLENBQUMsQ0FBQ2EsSUFBSSxLQUFLLElBQUksRUFBRTtRQUNoQ0QsS0FBSyxDQUFDZixHQUFHLENBQUNHLEtBQUssQ0FBQyxDQUFDYSxJQUFJLEdBQUcsQ0FBQ2hCLEdBQUcsQ0FBQyxDQUFBO0FBQ2pDLE9BQUMsTUFBTTtRQUNIZSxLQUFLLENBQUNmLEdBQUcsQ0FBQ0csS0FBSyxDQUFDLENBQUNhLElBQUksQ0FBQzlCLElBQUksQ0FBQ2MsR0FBRyxDQUFDLENBQUE7QUFDbkMsT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLENBQUNlLEtBQUssQ0FBQ04sY0FBYyxDQUFDVCxHQUFHLENBQUNELEdBQUcsQ0FBQyxFQUFFO0FBQ2hDZ0IsTUFBQUEsS0FBSyxDQUFDZixHQUFHLENBQUNELEdBQUcsQ0FBQyxHQUFHO0FBQUVpQixRQUFBQSxJQUFJLEVBQUUsSUFBSTtRQUFFQyxLQUFLLEVBQUUsQ0FBQ2pCLEdBQUcsQ0FBQTtPQUFHLENBQUE7QUFDakQsS0FBQyxNQUFNO01BQ0gsSUFBSWUsS0FBSyxDQUFDZixHQUFHLENBQUNELEdBQUcsQ0FBQyxDQUFDa0IsS0FBSyxLQUFLLElBQUksRUFBRTtRQUMvQkYsS0FBSyxDQUFDZixHQUFHLENBQUNELEdBQUcsQ0FBQyxDQUFDa0IsS0FBSyxHQUFHLENBQUNqQixHQUFHLENBQUMsQ0FBQTtBQUNoQyxPQUFDLE1BQU07UUFDSGUsS0FBSyxDQUFDZixHQUFHLENBQUNELEdBQUcsQ0FBQyxDQUFDa0IsS0FBSyxDQUFDL0IsSUFBSSxDQUFDYyxHQUFHLENBQUMsQ0FBQTtBQUNsQyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBRUE7RUFDQSxJQUFJa0IsUUFBUSxHQUFHLEVBQUUsQ0FBQTtFQUVqQixTQUFTQyxVQUFVQSxDQUFDNUIsSUFBSSxFQUFFO0FBQ3RCMkIsSUFBQUEsUUFBUSxHQUFHQSxRQUFRLENBQUNFLE1BQU0sQ0FBQyxVQUFVcEIsR0FBRyxFQUFFO0FBQ3RDLE1BQUEsT0FBT1QsSUFBSSxDQUFDOEIsSUFBSSxDQUFDLFVBQVVDLENBQUMsRUFBRTtRQUMxQixPQUFPQSxDQUFDLEtBQUt0QixHQUFHLENBQUE7T0FDbkIsQ0FBQyxLQUFLdUIsU0FBUyxDQUFBO0FBQ3BCLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTtFQUVBLFNBQVNDLE9BQU9BLENBQUNqQyxJQUFJLEVBQUU7QUFDbkIsSUFBQSxLQUFLLElBQUlPLEtBQUssR0FBRyxDQUFDLEVBQUVBLEtBQUssR0FBR1AsSUFBSSxDQUFDaEMsTUFBTSxFQUFFLEVBQUV1QyxLQUFLLEVBQUU7QUFDOUNvQixNQUFBQSxRQUFRLENBQUNoQyxJQUFJLENBQUNLLElBQUksQ0FBQ08sS0FBSyxDQUFDLENBQUMsQ0FBQTtBQUM5QixLQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsTUFBTTJCLFFBQVEsR0FBR2YsTUFBTSxDQUFDZ0IsSUFBSSxDQUFDWCxLQUFLLENBQUMsQ0FBQ1ksSUFBSSxDQUFDLFVBQVVDLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0lBQ3JELE9BQU9ELENBQUMsR0FBR0MsQ0FBQyxDQUFBO0FBQ2hCLEdBQUMsQ0FBQyxDQUFBO0VBRUYsTUFBTUMsWUFBWSxHQUFHLEVBQUUsQ0FBQTtBQUN2QixFQUFBLEtBQUssSUFBSWhDLEtBQUssR0FBRyxDQUFDLEVBQUVBLEtBQUssR0FBRzJCLFFBQVEsQ0FBQ2xFLE1BQU0sRUFBRSxFQUFFdUMsS0FBSyxFQUFFO0lBQ2xELE1BQU1pQyxJQUFJLEdBQUdoQixLQUFLLENBQUNVLFFBQVEsQ0FBQzNCLEtBQUssQ0FBQyxDQUFDLENBQUE7O0FBRW5DO0FBQ0EsSUFBQSxJQUFJaUMsSUFBSSxDQUFDZCxLQUFLLEtBQUssSUFBSSxFQUFFO0FBQ3JCRSxNQUFBQSxVQUFVLENBQUNZLElBQUksQ0FBQ2QsS0FBSyxDQUFDLENBQUE7QUFDMUIsS0FBQTs7QUFFQTtBQUNBLElBQUEsSUFBSWMsSUFBSSxDQUFDZixJQUFJLEtBQUssSUFBSSxFQUFFO0FBQ3BCUSxNQUFBQSxPQUFPLENBQUNPLElBQUksQ0FBQ2YsSUFBSSxDQUFDLENBQUE7QUFDdEIsS0FBQTs7QUFFQTtJQUNBYyxZQUFZLENBQUM1QyxJQUFJLENBQUM7QUFDZGlCLE1BQUFBLEtBQUssRUFBRXNCLFFBQVEsQ0FBQzNCLEtBQUssQ0FBQztNQUN0QlAsSUFBSSxFQUFFb0IsV0FBVyxDQUFDTyxRQUFRLENBQUE7QUFDOUIsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBOztBQUVBO0VBQ0EsTUFBTS9DLE1BQU0sR0FBRyxFQUFFLENBQUE7RUFDakIsSUFBSTZELE9BQU8sR0FBRyxJQUFJLENBQUE7QUFDbEIsRUFBQSxLQUFLLElBQUlsQyxLQUFLLEdBQUcsQ0FBQyxFQUFFQSxLQUFLLEdBQUdnQyxZQUFZLENBQUN2RSxNQUFNLEVBQUUsRUFBRXVDLEtBQUssRUFBRTtBQUN0RCxJQUFBLE1BQU1tQyxXQUFXLEdBQUdILFlBQVksQ0FBQ2hDLEtBQUssQ0FBQyxDQUFBO0FBQ3ZDLElBQUEsT0FBTzNCLE1BQU0sQ0FBQ1osTUFBTSxHQUFHMEUsV0FBVyxDQUFDOUIsS0FBSyxFQUFFO01BQ3RDaEMsTUFBTSxDQUFDZSxJQUFJLENBQUM4QyxPQUFPLEdBQUdBLE9BQU8sQ0FBQ3pDLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQTtBQUM5QyxLQUFBO0FBQ0F5QyxJQUFBQSxPQUFPLEdBQUdDLFdBQVcsQ0FBQTtBQUN6QixHQUFBO0FBQ0EsRUFBQSxPQUFPOUQsTUFBTSxDQUFDWixNQUFNLEdBQUd1RCxVQUFVLEVBQUU7QUFDL0IzQyxJQUFBQSxNQUFNLENBQUNlLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNyQixHQUFBO0FBRUEsRUFBQSxPQUFPZixNQUFNLENBQUE7QUFDakIsQ0FBQTs7QUFFQTtBQUNBO0FBQ0EsU0FBUytELGNBQWNBLENBQUNoRixPQUFPLEVBQUU7QUFDN0I7QUFDQTs7QUFFQSxFQUFBLE1BQU1pRixNQUFNLEdBQUcsSUFBSS9DLE1BQU0sQ0FBQ2xDLE9BQU8sQ0FBQyxDQUFBO0VBQ2xDLE1BQU1rRixnQkFBZ0IsR0FBRyxFQUFFLENBQUE7RUFDM0IsTUFBTTdDLElBQUksR0FBRyxFQUFFLENBQUE7RUFFZixJQUFJLENBQUM0QyxNQUFNLENBQUM3QyxLQUFLLENBQUM4QyxnQkFBZ0IsRUFBRTdDLElBQUksQ0FBQyxFQUFFO0lBQ3ZDOEMsT0FBTyxDQUFDQyxJQUFJLENBQUNILE1BQU0sQ0FBQ25FLEtBQUssRUFBRSxDQUFDLENBQUE7SUFDNUIsT0FBTztBQUNIZCxNQUFBQSxPQUFPLEVBQUVBLE9BQU87QUFDaEJxQyxNQUFBQSxJQUFJLEVBQUUsSUFBQTtLQUNULENBQUE7QUFDTCxHQUFBOztBQUVBO0VBQ0EsTUFBTWdELFVBQVUsR0FBR2hELElBQUksQ0FBQzhCLElBQUksQ0FBQyxVQUFVQyxDQUFDLEVBQUU7QUFDdEMsSUFBQSxPQUFPQSxDQUFDLENBQUN2QixHQUFHLEtBQUssSUFBSSxDQUFBO0FBQ3pCLEdBQUMsQ0FBQyxDQUFBO0FBRUYsRUFBQSxJQUFJd0MsVUFBVSxFQUFFO0lBQ1pGLE9BQU8sQ0FBQ0MsSUFBSSxDQUFFLENBQUEsa0NBQUEsRUFBb0NDLFVBQVUsQ0FBQzFDLElBQUssR0FBRSxDQUFDLENBQUE7SUFDckUsT0FBTztBQUNIM0MsTUFBQUEsT0FBTyxFQUFFQSxPQUFPO0FBQ2hCcUMsTUFBQUEsSUFBSSxFQUFFLElBQUE7S0FDVCxDQUFBO0FBQ0wsR0FBQTs7QUFFQTtFQUNBLE1BQU1pRCxhQUFhLEdBQUczQixpQkFBaUIsQ0FBQ3RCLElBQUksRUFBRTZDLGdCQUFnQixDQUFDN0UsTUFBTSxDQUFDLENBQUE7RUFFdEUsT0FBTztBQUNITCxJQUFBQSxPQUFPLEVBQUVrRixnQkFBZ0I7QUFDekI3QyxJQUFBQSxJQUFJLEVBQUVpRCxhQUFBQTtHQUNULENBQUE7QUFDTCxDQUFBO0FBRUEsTUFBTUMsTUFBTSxDQUFDO0VBQ1QsT0FBT0MsUUFBUUEsQ0FBQ3hGLE9BQU8sRUFBRTtJQUNyQixPQUFPZ0YsY0FBYyxDQUFDaEYsT0FBTyxDQUFDLENBQUE7QUFDbEMsR0FBQTtBQUNKOzs7OyJ9
