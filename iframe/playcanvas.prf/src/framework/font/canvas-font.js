import { string } from '../../core/string.js';
import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { PIXELFORMAT_RGBA8, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

const MAX_TEXTURE_SIZE = 4096;
const DEFAULT_TEXTURE_SIZE = 512;
class Atlas {
  constructor(device, width, height, name) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.texture = new Texture(device, {
      name: name,
      format: PIXELFORMAT_RGBA8,
      width: width,
      height: height,
      mipmaps: true,
      minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: FILTER_LINEAR,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      levels: [this.canvas]
    });
    this.ctx = this.canvas.getContext('2d', {
      alpha: true
    });
  }
  destroy() {
    this.texture.destroy();
  }
  clear(clearColor) {
    const {
      width,
      height
    } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = clearColor;
    this.ctx.fillRect(0, 0, width, height);
  }
}
class CanvasFont extends EventHandler {
  constructor(app, options = {}) {
    super();
    this.type = 'bitmap';
    this.app = app;
    this.intensity = 0;
    this.fontWeight = options.fontWeight || 'normal';
    this.fontSize = parseInt(options.fontSize, 10);
    this.glyphSize = this.fontSize;
    this.fontName = options.fontName || 'Arial';
    this.color = options.color || new Color(1, 1, 1);
    this.padding = options.padding || 0;
    this.width = Math.min(MAX_TEXTURE_SIZE, options.width || DEFAULT_TEXTURE_SIZE);
    this.height = Math.min(MAX_TEXTURE_SIZE, options.height || DEFAULT_TEXTURE_SIZE);
    this.atlases = [];
    this.chars = '';
    this.data = {};
  }
  createTextures(text) {
    const _chars = this._normalizeCharsSet(text);
    if (_chars.length !== this.chars.length) {
      this._renderAtlas(_chars);
      return;
    }
    for (let i = 0; i < _chars.length; i++) {
      if (_chars[i] !== this.chars[i]) {
        this._renderAtlas(_chars);
        return;
      }
    }
  }
  updateTextures(text) {
    const _chars = this._normalizeCharsSet(text);
    const newCharsSet = [];
    for (let i = 0; i < _chars.length; i++) {
      const char = _chars[i];
      if (!this.data.chars[char]) {
        newCharsSet.push(char);
      }
    }
    if (newCharsSet.length > 0) {
      this._renderAtlas(this.chars.concat(newCharsSet));
    }
  }
  destroy() {
    this.atlases.forEach(atlas => atlas.destroy());
    this.chars = null;
    this.color = null;
    this.data = null;
    this.fontName = null;
    this.fontSize = null;
    this.glyphSize = null;
    this.intensity = null;
    this.atlases = null;
    this.type = null;
    this.fontWeight = null;
  }
  _colorToRgbString(color, alpha) {
    let str;
    const r = Math.round(255 * color.r);
    const g = Math.round(255 * color.g);
    const b = Math.round(255 * color.b);
    if (alpha) {
      str = `rgba(${r}, ${g}, ${b}, ${color.a})`;
    } else {
      str = `rgb(${r}, ${g}, ${b})`;
    }
    return str;
  }
  renderCharacter(context, char, x, y, color) {
    context.fillStyle = color;
    context.fillText(char, x, y);
  }
  _getAtlas(index) {
    if (index >= this.atlases.length) {
      this.atlases[index] = new Atlas(this.app.graphicsDevice, this.width, this.height, `font-atlas-${this.fontName}-${index}`);
    }
    return this.atlases[index];
  }
  _renderAtlas(charsArray) {
    this.chars = charsArray;
    const w = this.width;
    const h = this.height;
    const color = this._colorToRgbString(this.color, false);
    const a = this.color.a;
    this.color.a = 1 / 255;
    const transparent = this._colorToRgbString(this.color, true);
    this.color.a = a;
    const TEXT_ALIGN = 'center';
    const TEXT_BASELINE = 'alphabetic';
    let atlasIndex = 0;
    let atlas = this._getAtlas(atlasIndex++);
    atlas.clear(transparent);
    this.data = this._createJson(this.chars, this.fontName, w, h);
    const symbols = string.getSymbols(this.chars.join(''));
    let maxHeight = 0;
    let maxDescent = 0;
    const metrics = {};
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      metrics[ch] = this._getTextMetrics(ch);
      maxHeight = Math.max(maxHeight, metrics[ch].height);
      maxDescent = Math.max(maxDescent, metrics[ch].descent);
    }
    this.glyphSize = Math.max(this.glyphSize, maxHeight);
    const sx = this.glyphSize + this.padding * 2;
    const sy = this.glyphSize + this.padding * 2;
    const _xOffset = this.glyphSize / 2 + this.padding;
    const _yOffset = sy - maxDescent - this.padding;
    let _x = 0;
    let _y = 0;
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      const code = string.getCodePoint(symbols[i]);
      let fs = this.fontSize;
      atlas.ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
      atlas.ctx.textAlign = TEXT_ALIGN;
      atlas.ctx.textBaseline = TEXT_BASELINE;
      let width = atlas.ctx.measureText(ch).width;
      if (width > fs) {
        fs = this.fontSize * this.fontSize / width;
        atlas.ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
        width = this.fontSize;
      }
      this.renderCharacter(atlas.ctx, ch, _x + _xOffset, _y + _yOffset, color);
      const xoffset = this.padding + (this.glyphSize - width) / 2;
      const yoffset = -this.padding + metrics[ch].descent - maxDescent;
      const xadvance = width;
      this._addChar(this.data, ch, code, _x, _y, sx, sy, xoffset, yoffset, xadvance, atlasIndex - 1, w, h);
      _x += sx;
      if (_x + sx > w) {
        _x = 0;
        _y += sy;
        if (_y + sy > h) {
          atlas = this._getAtlas(atlasIndex++);
          atlas.clear(transparent);
          _y = 0;
        }
      }
    }
    this.atlases.splice(atlasIndex).forEach(atlas => atlas.destroy());
    this.atlases.forEach(atlas => atlas.texture.upload());
    this.fire('render');
  }
  _createJson(chars, fontName, width, height) {
    const base = {
      'version': 3,
      'intensity': this.intensity,
      'info': {
        'face': fontName,
        'width': width,
        'height': height,
        'maps': [{
          'width': width,
          'height': height
        }]
      },
      'chars': {}
    };
    return base;
  }
  _addChar(json, char, charCode, x, y, w, h, xoffset, yoffset, xadvance, mapNum, mapW, mapH) {
    if (json.info.maps.length < mapNum + 1) {
      json.info.maps.push({
        'width': mapW,
        'height': mapH
      });
    }
    const scale = this.fontSize / 32;
    json.chars[char] = {
      'id': charCode,
      'letter': char,
      'x': x,
      'y': y,
      'width': w,
      'height': h,
      'xadvance': xadvance / scale,
      'xoffset': xoffset / scale,
      'yoffset': (yoffset + this.padding) / scale,
      'scale': scale,
      'range': 1,
      'map': mapNum,
      'bounds': [0, 0, w / scale, h / scale]
    };
  }
  _normalizeCharsSet(text) {
    const unicodeConverterFunc = this.app.systems.element.getUnicodeConverter();
    if (unicodeConverterFunc) {
      text = unicodeConverterFunc(text);
    }
    const set = {};
    const symbols = string.getSymbols(text);
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      if (set[ch]) continue;
      set[ch] = ch;
    }
    const chars = Object.keys(set);
    return chars.sort();
  }
  _getTextMetrics(text) {
    const textSpan = document.createElement('span');
    textSpan.id = 'content-span';
    textSpan.innerHTML = text;
    const block = document.createElement('div');
    block.id = 'content-block';
    block.style.display = 'inline-block';
    block.style.width = '1px';
    block.style.height = '0px';
    const div = document.createElement('div');
    div.appendChild(textSpan);
    div.appendChild(block);
    div.style.font = this.fontSize + 'px ' + this.fontName;
    const body = document.body;
    body.appendChild(div);
    let ascent = -1;
    let descent = -1;
    let height = -1;
    try {
      block.style['vertical-align'] = 'baseline';
      ascent = block.offsetTop - textSpan.offsetTop;
      block.style['vertical-align'] = 'bottom';
      height = block.offsetTop - textSpan.offsetTop;
      descent = height - ascent;
    } finally {
      document.body.removeChild(div);
    }
    return {
      ascent: ascent,
      descent: descent,
      height: height
    };
  }
  get textures() {
    return this.atlases.map(atlas => atlas.texture);
  }
}

export { CanvasFont };
