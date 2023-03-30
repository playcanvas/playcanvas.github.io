/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { string } from '../../core/string.js';
import { EventHandler } from '../../core/event-handler.js';
import { Color } from '../../core/math/color.js';
import { PIXELFORMAT_RGBA8, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

const MAX_TEXTURE_SIZE = 4096;
const DEFAULT_TEXTURE_SIZE = 512;

/**
 * Represents the resource of a canvas font asset.
 *
 * @augments EventHandler
 * @ignore
 */
class CanvasFont extends EventHandler {
  /**
   * Create a new CanvasFont instance.
   *
   * @param {import('../app-base.js').AppBase} app - The application.
   * @param {object} options - The font options.
   * @param {string} [options.fontName] - The name of the font. CSS font names are supported.
   * Defaults to 'Arial'.
   * @param {string} [options.fontWeight] - The weight of the font, e.g. 'normal', 'bold'.
   * Defaults to 'normal'.
   * @param {number} [options.fontSize] - The font size in pixels. Defaults to 32.
   * @param {Color} [options.color] - The font color.Defaults to white.
   * @param {number} [options.width] - The width of each texture atlas. Defaults to 512.
   * @param {number} [options.height] - The height of each texture atlas. Defaults to 512.
   * @param {number} [options.padding] - Amount of glyph padding in pixels that is added to each
   * glyph in the atlas. Defaults to 0.
   */
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
    const w = options.width > MAX_TEXTURE_SIZE ? MAX_TEXTURE_SIZE : options.width || DEFAULT_TEXTURE_SIZE;
    const h = options.height > MAX_TEXTURE_SIZE ? MAX_TEXTURE_SIZE : options.height || DEFAULT_TEXTURE_SIZE;

    // Create a canvas to do the text rendering
    const canvas = document.createElement('canvas');
    canvas.height = h;
    canvas.width = w;
    const texture = new Texture(this.app.graphicsDevice, {
      name: 'font',
      format: PIXELFORMAT_RGBA8,
      minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: FILTER_LINEAR,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      mipmaps: true
    });
    texture.setSource(canvas);
    this.textures = [texture];
    this.chars = '';
    this.data = {};
  }

  /**
   * Render the necessary textures for all characters in a string to be used for the canvas font.
   *
   * @param {string} text - The list of characters to render into the texture atlas.
   */
  createTextures(text) {
    const _chars = this._normalizeCharsSet(text);

    // different length so definitely update
    if (_chars.length !== this.chars.length) {
      this._renderAtlas(_chars);
      return;
    }

    // compare sorted characters for difference
    for (let i = 0; i < _chars.length; i++) {
      if (_chars[i] !== this.chars[i]) {
        this._renderAtlas(_chars);
        return;
      }
    }
  }

  /**
   * Update the list of characters to include in the atlas to include those provided and
   * re-render the texture atlas to include all the characters that have been supplied so far.
   *
   * @param {string} text - The list of characters to add to the texture atlas.
   */
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

  /**
   * Destroys the font. This also destroys the textures owned by the font.
   */
  destroy() {
    // call texture.destroy on any created textures
    for (let i = 0; i < this.textures.length; i++) {
      this.textures[i].destroy();
    }
    // null instance variables to make it obvious this font is no longer valid
    this.chars = null;
    this.color = null;
    this.data = null;
    this.fontName = null;
    this.fontSize = null;
    this.glyphSize = null;
    this.intensity = null;
    this.textures = null;
    this.type = null;
    this.fontWeight = null;
  }

  /**
   * @param {HTMLCanvasElement} canvas - The canvas used to render the font.
   * @param {string} clearColor - The color to clear the canvas with.
   * @returns {CanvasRenderingContext2D} - A 2D rendering contxt.
   * @private
   */
  _getAndClearContext(canvas, clearColor) {
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d', {
      alpha: true
    });
    ctx.clearRect(0, 0, w, h); // clear to black first to remove everything as clear color is transparent
    ctx.fillStyle = clearColor;
    ctx.fillRect(0, 0, w, h); // clear to color

    return ctx;
  }

  /**
   * @param {Color} color - The color to covert.
   * @param {boolean} alpha - Whether to include the alpha channel.
   * @returns {string} The hex string for the color.
   * @private
   */
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

  /**
   * @param {CanvasRenderingContext2D} context - The canvas 2D context.
   * @param {string} char - The character to render.
   * @param {number} x - The x position to render the character at.
   * @param {number} y - The y position to render the character at.
   * @param {number} color - The color to render the character in.
   * @ignore
   */
  renderCharacter(context, char, x, y, color) {
    context.fillStyle = color;
    context.fillText(char, x, y);
  }

  /**
   * Renders an array of characters into one or more textures atlases.
   *
   * @param {string[]} charsArray - The list of characters to render.
   * @private
   */
  _renderAtlas(charsArray) {
    this.chars = charsArray;
    let numTextures = 1;
    let canvas = this.textures[numTextures - 1].getSource();
    const w = canvas.width;
    const h = canvas.height;

    // fill color
    const color = this._colorToRgbString(this.color, false);

    // generate a "transparent" color for the background
    // browsers seem to optimize away all color data if alpha=0
    // so setting alpha to min value and hope this isn't noticeable
    const a = this.color.a;
    this.color.a = 1 / 255;
    const transparent = this._colorToRgbString(this.color, true);
    this.color.a = a;
    const TEXT_ALIGN = 'center';
    const TEXT_BASELINE = 'alphabetic';
    let ctx = this._getAndClearContext(canvas, transparent);
    ctx.font = this.fontWeight + ' ' + this.fontSize.toString() + 'px ' + this.fontName;
    ctx.textAlign = TEXT_ALIGN;
    ctx.textBaseline = TEXT_BASELINE;
    this.data = this._createJson(this.chars, this.fontName, w, h);
    const symbols = string.getSymbols(this.chars.join(''));
    const prevNumTextures = this.textures.length;
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
      ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
      ctx.textAlign = TEXT_ALIGN;
      ctx.textBaseline = TEXT_BASELINE;
      let width = ctx.measureText(ch).width;
      if (width > fs) {
        fs = this.fontSize * this.fontSize / width;
        ctx.font = this.fontWeight + ' ' + fs.toString() + 'px ' + this.fontName;
        width = this.fontSize;
      }
      this.renderCharacter(ctx, ch, _x + _xOffset, _y + _yOffset, color);
      const xoffset = this.padding + (this.glyphSize - width) / 2;
      const yoffset = -this.padding + metrics[ch].descent - maxDescent;
      const xadvance = width;
      this._addChar(this.data, ch, code, _x, _y, sx, sy, xoffset, yoffset, xadvance, numTextures - 1, w, h);
      _x += sx;
      if (_x + sx > w) {
        // Wrap to the next row of this canvas if the right edge of the next glyph would overflow
        _x = 0;
        _y += sy;
        if (_y + sy > h) {
          // We ran out of space on this texture!
          // Copy the canvas into the texture and upload it
          this.textures[numTextures - 1].upload();
          // Create a new texture (if needed) and continue on
          numTextures++;
          _y = 0;
          if (numTextures > prevNumTextures) {
            canvas = document.createElement('canvas');
            canvas.height = h;
            canvas.width = w;
            ctx = this._getAndClearContext(canvas, transparent);
            const texture = new Texture(this.app.graphicsDevice, {
              format: PIXELFORMAT_RGBA8,
              mipmaps: true,
              name: 'font-atlas'
            });
            texture.setSource(canvas);
            texture.minFilter = FILTER_LINEAR_MIPMAP_LINEAR;
            texture.magFilter = FILTER_LINEAR;
            texture.addressU = ADDRESS_CLAMP_TO_EDGE;
            texture.addressV = ADDRESS_CLAMP_TO_EDGE;
            this.textures.push(texture);
          } else {
            canvas = this.textures[numTextures - 1].getSource();
            ctx = this._getAndClearContext(canvas, transparent);
          }
        }
      }
    }
    // Copy any remaining characters in the canvas into the last texture and upload it
    this.textures[numTextures - 1].upload();

    // Cleanup any remaining (unused) textures
    if (numTextures < prevNumTextures) {
      for (let i = numTextures; i < prevNumTextures; i++) {
        this.textures[i].destroy();
      }
      this.textures.splice(numTextures);
    }

    // alert text-elements that the font has been re-rendered
    this.fire('render');
  }

  /**
   * @param {string[]} chars - A list of characters.
   * @param {string} fontName - The font name.
   * @param {number} width - The width of the texture atlas.
   * @param {number} height - The height of the texture atlas.
   * @returns {object} The font JSON object.
   * @private
   */
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

  /**
   * @param {object} json - Font data.
   * @param {string} char - The character to add.
   * @param {number} charCode - The code point number of the character to add.
   * @param {number} x - The x position of the character.
   * @param {number} y - The y position of the character.
   * @param {number} w - The width of the character.
   * @param {number} h - The height of the character.
   * @param {number} xoffset - The x offset of the character.
   * @param {number} yoffset - The y offset of the character.
   * @param {number} xadvance - The x advance of the character.
   * @param {number} mapNum - The map number of the character.
   * @param {number} mapW - The width of the map.
   * @param {number} mapH - The height of the map.
   * @private
   */
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

  /**
   * Take a unicode string and produce the set of characters used to create that string.
   * e.g. "abcabcabc" -> ['a', 'b', 'c']
   *
   * @param {string} text - The unicode string to process.
   * @returns {string[]} The set of characters used to create the string.
   * @private
   */
  _normalizeCharsSet(text) {
    // normalize unicode if needed
    const unicodeConverterFunc = this.app.systems.element.getUnicodeConverter();
    if (unicodeConverterFunc) {
      text = unicodeConverterFunc(text);
    }
    // strip duplicates
    const set = {};
    const symbols = string.getSymbols(text);
    for (let i = 0; i < symbols.length; i++) {
      const ch = symbols[i];
      if (set[ch]) continue;
      set[ch] = ch;
    }
    const chars = Object.keys(set);
    // sort
    return chars.sort();
  }

  /**
   * Calculate some metrics that aren't available via the browser API, notably character height
   * and descent size.
   *
   * @param {string} text - The text to measure.
   * @returns {{ascent: number, descent: number, height: number}} The metrics of the text.
   * @private
   */
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
}

export { CanvasFont };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FudmFzLWZvbnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvZm9udC9jYW52YXMtZm9udC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBzdHJpbmcgfSBmcm9tICcuLi8uLi9jb3JlL3N0cmluZy5qcyc7XG5pbXBvcnQgeyBFdmVudEhhbmRsZXIgfSBmcm9tICcuLi8uLi9jb3JlL2V2ZW50LWhhbmRsZXIuanMnO1xuXG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC9jb2xvci5qcyc7XG5cbmltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBQSVhFTEZPUk1BVF9SR0JBOFxufSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5jb25zdCBNQVhfVEVYVFVSRV9TSVpFID0gNDA5NjtcbmNvbnN0IERFRkFVTFRfVEVYVFVSRV9TSVpFID0gNTEyO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgdGhlIHJlc291cmNlIG9mIGEgY2FudmFzIGZvbnQgYXNzZXQuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICogQGlnbm9yZVxuICovXG5jbGFzcyBDYW52YXNGb250IGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQ2FudmFzRm9udCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyAtIFRoZSBmb250IG9wdGlvbnMuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmZvbnROYW1lXSAtIFRoZSBuYW1lIG9mIHRoZSBmb250LiBDU1MgZm9udCBuYW1lcyBhcmUgc3VwcG9ydGVkLlxuICAgICAqIERlZmF1bHRzIHRvICdBcmlhbCcuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmZvbnRXZWlnaHRdIC0gVGhlIHdlaWdodCBvZiB0aGUgZm9udCwgZS5nLiAnbm9ybWFsJywgJ2JvbGQnLlxuICAgICAqIERlZmF1bHRzIHRvICdub3JtYWwnLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5mb250U2l6ZV0gLSBUaGUgZm9udCBzaXplIGluIHBpeGVscy4gRGVmYXVsdHMgdG8gMzIuXG4gICAgICogQHBhcmFtIHtDb2xvcn0gW29wdGlvbnMuY29sb3JdIC0gVGhlIGZvbnQgY29sb3IuRGVmYXVsdHMgdG8gd2hpdGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLndpZHRoXSAtIFRoZSB3aWR0aCBvZiBlYWNoIHRleHR1cmUgYXRsYXMuIERlZmF1bHRzIHRvIDUxMi5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW29wdGlvbnMuaGVpZ2h0XSAtIFRoZSBoZWlnaHQgb2YgZWFjaCB0ZXh0dXJlIGF0bGFzLiBEZWZhdWx0cyB0byA1MTIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnBhZGRpbmddIC0gQW1vdW50IG9mIGdseXBoIHBhZGRpbmcgaW4gcGl4ZWxzIHRoYXQgaXMgYWRkZWQgdG8gZWFjaFxuICAgICAqIGdseXBoIGluIHRoZSBhdGxhcy4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHAsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMudHlwZSA9ICdiaXRtYXAnO1xuXG4gICAgICAgIHRoaXMuYXBwID0gYXBwO1xuXG4gICAgICAgIHRoaXMuaW50ZW5zaXR5ID0gMDtcblxuICAgICAgICB0aGlzLmZvbnRXZWlnaHQgPSBvcHRpb25zLmZvbnRXZWlnaHQgfHwgJ25vcm1hbCc7XG4gICAgICAgIHRoaXMuZm9udFNpemUgPSBwYXJzZUludChvcHRpb25zLmZvbnRTaXplLCAxMCk7XG4gICAgICAgIHRoaXMuZ2x5cGhTaXplID0gdGhpcy5mb250U2l6ZTtcbiAgICAgICAgdGhpcy5mb250TmFtZSA9IG9wdGlvbnMuZm9udE5hbWUgfHwgJ0FyaWFsJztcbiAgICAgICAgdGhpcy5jb2xvciA9IG9wdGlvbnMuY29sb3IgfHwgbmV3IENvbG9yKDEsIDEsIDEpO1xuICAgICAgICB0aGlzLnBhZGRpbmcgPSBvcHRpb25zLnBhZGRpbmcgfHwgMDtcblxuICAgICAgICBjb25zdCB3ID0gb3B0aW9ucy53aWR0aCA+IE1BWF9URVhUVVJFX1NJWkUgPyBNQVhfVEVYVFVSRV9TSVpFIDogKG9wdGlvbnMud2lkdGggfHwgREVGQVVMVF9URVhUVVJFX1NJWkUpO1xuICAgICAgICBjb25zdCBoID0gb3B0aW9ucy5oZWlnaHQgPiBNQVhfVEVYVFVSRV9TSVpFID8gTUFYX1RFWFRVUkVfU0laRSA6IChvcHRpb25zLmhlaWdodCB8fCBERUZBVUxUX1RFWFRVUkVfU0laRSk7XG5cbiAgICAgICAgLy8gQ3JlYXRlIGEgY2FudmFzIHRvIGRvIHRoZSB0ZXh0IHJlbmRlcmluZ1xuICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgY2FudmFzLmhlaWdodCA9IGg7XG4gICAgICAgIGNhbnZhcy53aWR0aCA9IHc7XG5cbiAgICAgICAgY29uc3QgdGV4dHVyZSA9IG5ldyBUZXh0dXJlKHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLCB7XG4gICAgICAgICAgICBuYW1lOiAnZm9udCcsXG4gICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1JHQkE4LFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTElORUFSX01JUE1BUF9MSU5FQVIsXG4gICAgICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9MSU5FQVIsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIG1pcG1hcHM6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGV4dHVyZS5zZXRTb3VyY2UoY2FudmFzKTtcblxuICAgICAgICB0aGlzLnRleHR1cmVzID0gW3RleHR1cmVdO1xuXG4gICAgICAgIHRoaXMuY2hhcnMgPSAnJztcbiAgICAgICAgdGhpcy5kYXRhID0ge307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVyIHRoZSBuZWNlc3NhcnkgdGV4dHVyZXMgZm9yIGFsbCBjaGFyYWN0ZXJzIGluIGEgc3RyaW5nIHRvIGJlIHVzZWQgZm9yIHRoZSBjYW52YXMgZm9udC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IC0gVGhlIGxpc3Qgb2YgY2hhcmFjdGVycyB0byByZW5kZXIgaW50byB0aGUgdGV4dHVyZSBhdGxhcy5cbiAgICAgKi9cbiAgICBjcmVhdGVUZXh0dXJlcyh0ZXh0KSB7XG4gICAgICAgIGNvbnN0IF9jaGFycyA9IHRoaXMuX25vcm1hbGl6ZUNoYXJzU2V0KHRleHQpO1xuXG4gICAgICAgIC8vIGRpZmZlcmVudCBsZW5ndGggc28gZGVmaW5pdGVseSB1cGRhdGVcbiAgICAgICAgaWYgKF9jaGFycy5sZW5ndGggIT09IHRoaXMuY2hhcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJBdGxhcyhfY2hhcnMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY29tcGFyZSBzb3J0ZWQgY2hhcmFjdGVycyBmb3IgZGlmZmVyZW5jZVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IF9jaGFycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKF9jaGFyc1tpXSAhPT0gdGhpcy5jaGFyc1tpXSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlckF0bGFzKF9jaGFycyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVXBkYXRlIHRoZSBsaXN0IG9mIGNoYXJhY3RlcnMgdG8gaW5jbHVkZSBpbiB0aGUgYXRsYXMgdG8gaW5jbHVkZSB0aG9zZSBwcm92aWRlZCBhbmRcbiAgICAgKiByZS1yZW5kZXIgdGhlIHRleHR1cmUgYXRsYXMgdG8gaW5jbHVkZSBhbGwgdGhlIGNoYXJhY3RlcnMgdGhhdCBoYXZlIGJlZW4gc3VwcGxpZWQgc28gZmFyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBUaGUgbGlzdCBvZiBjaGFyYWN0ZXJzIHRvIGFkZCB0byB0aGUgdGV4dHVyZSBhdGxhcy5cbiAgICAgKi9cbiAgICB1cGRhdGVUZXh0dXJlcyh0ZXh0KSB7XG4gICAgICAgIGNvbnN0IF9jaGFycyA9IHRoaXMuX25vcm1hbGl6ZUNoYXJzU2V0KHRleHQpO1xuICAgICAgICBjb25zdCBuZXdDaGFyc1NldCA9IFtdO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgX2NoYXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjaGFyID0gX2NoYXJzW2ldO1xuICAgICAgICAgICAgaWYgKCF0aGlzLmRhdGEuY2hhcnNbY2hhcl0pIHtcbiAgICAgICAgICAgICAgICBuZXdDaGFyc1NldC5wdXNoKGNoYXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld0NoYXJzU2V0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckF0bGFzKHRoaXMuY2hhcnMuY29uY2F0KG5ld0NoYXJzU2V0KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95cyB0aGUgZm9udC4gVGhpcyBhbHNvIGRlc3Ryb3lzIHRoZSB0ZXh0dXJlcyBvd25lZCBieSB0aGUgZm9udC5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyBjYWxsIHRleHR1cmUuZGVzdHJveSBvbiBhbnkgY3JlYXRlZCB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudGV4dHVyZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZXNbaV0uZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgICAgIC8vIG51bGwgaW5zdGFuY2UgdmFyaWFibGVzIHRvIG1ha2UgaXQgb2J2aW91cyB0aGlzIGZvbnQgaXMgbm8gbG9uZ2VyIHZhbGlkXG4gICAgICAgIHRoaXMuY2hhcnMgPSBudWxsO1xuICAgICAgICB0aGlzLmNvbG9yID0gbnVsbDtcbiAgICAgICAgdGhpcy5kYXRhID0gbnVsbDtcbiAgICAgICAgdGhpcy5mb250TmFtZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZm9udFNpemUgPSBudWxsO1xuICAgICAgICB0aGlzLmdseXBoU2l6ZSA9IG51bGw7XG4gICAgICAgIHRoaXMuaW50ZW5zaXR5ID0gbnVsbDtcbiAgICAgICAgdGhpcy50ZXh0dXJlcyA9IG51bGw7XG4gICAgICAgIHRoaXMudHlwZSA9IG51bGw7XG4gICAgICAgIHRoaXMuZm9udFdlaWdodCA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtIVE1MQ2FudmFzRWxlbWVudH0gY2FudmFzIC0gVGhlIGNhbnZhcyB1c2VkIHRvIHJlbmRlciB0aGUgZm9udC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2xlYXJDb2xvciAtIFRoZSBjb2xvciB0byBjbGVhciB0aGUgY2FudmFzIHdpdGguXG4gICAgICogQHJldHVybnMge0NhbnZhc1JlbmRlcmluZ0NvbnRleHQyRH0gLSBBIDJEIHJlbmRlcmluZyBjb250eHQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0QW5kQ2xlYXJDb250ZXh0KGNhbnZhcywgY2xlYXJDb2xvcikge1xuICAgICAgICBjb25zdCB3ID0gY2FudmFzLndpZHRoO1xuICAgICAgICBjb25zdCBoID0gY2FudmFzLmhlaWdodDtcblxuICAgICAgICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnLCB7XG4gICAgICAgICAgICBhbHBoYTogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICBjdHguY2xlYXJSZWN0KDAsIDAsIHcsIGgpOyAgLy8gY2xlYXIgdG8gYmxhY2sgZmlyc3QgdG8gcmVtb3ZlIGV2ZXJ5dGhpbmcgYXMgY2xlYXIgY29sb3IgaXMgdHJhbnNwYXJlbnRcbiAgICAgICAgY3R4LmZpbGxTdHlsZSA9IGNsZWFyQ29sb3I7XG4gICAgICAgIGN0eC5maWxsUmVjdCgwLCAwLCB3LCBoKTsgICAvLyBjbGVhciB0byBjb2xvclxuXG4gICAgICAgIHJldHVybiBjdHg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtDb2xvcn0gY29sb3IgLSBUaGUgY29sb3IgdG8gY292ZXJ0LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gYWxwaGEgLSBXaGV0aGVyIHRvIGluY2x1ZGUgdGhlIGFscGhhIGNoYW5uZWwuXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGhleCBzdHJpbmcgZm9yIHRoZSBjb2xvci5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jb2xvclRvUmdiU3RyaW5nKGNvbG9yLCBhbHBoYSkge1xuICAgICAgICBsZXQgc3RyO1xuICAgICAgICBjb25zdCByID0gTWF0aC5yb3VuZCgyNTUgKiBjb2xvci5yKTtcbiAgICAgICAgY29uc3QgZyA9IE1hdGgucm91bmQoMjU1ICogY29sb3IuZyk7XG4gICAgICAgIGNvbnN0IGIgPSBNYXRoLnJvdW5kKDI1NSAqIGNvbG9yLmIpO1xuXG4gICAgICAgIGlmIChhbHBoYSkge1xuICAgICAgICAgICAgc3RyID0gYHJnYmEoJHtyfSwgJHtnfSwgJHtifSwgJHtjb2xvci5hfSlgO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RyID0gYHJnYigke3J9LCAke2d9LCAke2J9KWA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Q2FudmFzUmVuZGVyaW5nQ29udGV4dDJEfSBjb250ZXh0IC0gVGhlIGNhbnZhcyAyRCBjb250ZXh0LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaGFyIC0gVGhlIGNoYXJhY3RlciB0byByZW5kZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHggLSBUaGUgeCBwb3NpdGlvbiB0byByZW5kZXIgdGhlIGNoYXJhY3RlciBhdC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB5IHBvc2l0aW9uIHRvIHJlbmRlciB0aGUgY2hhcmFjdGVyIGF0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjb2xvciAtIFRoZSBjb2xvciB0byByZW5kZXIgdGhlIGNoYXJhY3RlciBpbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgcmVuZGVyQ2hhcmFjdGVyKGNvbnRleHQsIGNoYXIsIHgsIHksIGNvbG9yKSB7XG4gICAgICAgIGNvbnRleHQuZmlsbFN0eWxlID0gY29sb3I7XG4gICAgICAgIGNvbnRleHQuZmlsbFRleHQoY2hhciwgeCwgeSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVuZGVycyBhbiBhcnJheSBvZiBjaGFyYWN0ZXJzIGludG8gb25lIG9yIG1vcmUgdGV4dHVyZXMgYXRsYXNlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nW119IGNoYXJzQXJyYXkgLSBUaGUgbGlzdCBvZiBjaGFyYWN0ZXJzIHRvIHJlbmRlci5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZW5kZXJBdGxhcyhjaGFyc0FycmF5KSB7XG4gICAgICAgIHRoaXMuY2hhcnMgPSBjaGFyc0FycmF5O1xuXG4gICAgICAgIGxldCBudW1UZXh0dXJlcyA9IDE7XG5cbiAgICAgICAgbGV0IGNhbnZhcyA9IHRoaXMudGV4dHVyZXNbbnVtVGV4dHVyZXMgLSAxXS5nZXRTb3VyY2UoKTtcbiAgICAgICAgY29uc3QgdyA9IGNhbnZhcy53aWR0aDtcbiAgICAgICAgY29uc3QgaCA9IGNhbnZhcy5oZWlnaHQ7XG5cbiAgICAgICAgLy8gZmlsbCBjb2xvclxuICAgICAgICBjb25zdCBjb2xvciA9IHRoaXMuX2NvbG9yVG9SZ2JTdHJpbmcodGhpcy5jb2xvciwgZmFsc2UpO1xuXG4gICAgICAgIC8vIGdlbmVyYXRlIGEgXCJ0cmFuc3BhcmVudFwiIGNvbG9yIGZvciB0aGUgYmFja2dyb3VuZFxuICAgICAgICAvLyBicm93c2VycyBzZWVtIHRvIG9wdGltaXplIGF3YXkgYWxsIGNvbG9yIGRhdGEgaWYgYWxwaGE9MFxuICAgICAgICAvLyBzbyBzZXR0aW5nIGFscGhhIHRvIG1pbiB2YWx1ZSBhbmQgaG9wZSB0aGlzIGlzbid0IG5vdGljZWFibGVcbiAgICAgICAgY29uc3QgYSA9IHRoaXMuY29sb3IuYTtcbiAgICAgICAgdGhpcy5jb2xvci5hID0gMSAvIDI1NTtcbiAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSB0aGlzLl9jb2xvclRvUmdiU3RyaW5nKHRoaXMuY29sb3IsIHRydWUpO1xuICAgICAgICB0aGlzLmNvbG9yLmEgPSBhO1xuXG4gICAgICAgIGNvbnN0IFRFWFRfQUxJR04gPSAnY2VudGVyJztcbiAgICAgICAgY29uc3QgVEVYVF9CQVNFTElORSA9ICdhbHBoYWJldGljJztcblxuICAgICAgICBsZXQgY3R4ID0gdGhpcy5fZ2V0QW5kQ2xlYXJDb250ZXh0KGNhbnZhcywgdHJhbnNwYXJlbnQpO1xuXG4gICAgICAgIGN0eC5mb250ID0gdGhpcy5mb250V2VpZ2h0ICsgJyAnICsgdGhpcy5mb250U2l6ZS50b1N0cmluZygpICsgJ3B4ICcgKyB0aGlzLmZvbnROYW1lO1xuICAgICAgICBjdHgudGV4dEFsaWduID0gVEVYVF9BTElHTjtcbiAgICAgICAgY3R4LnRleHRCYXNlbGluZSA9IFRFWFRfQkFTRUxJTkU7XG5cbiAgICAgICAgdGhpcy5kYXRhID0gdGhpcy5fY3JlYXRlSnNvbih0aGlzLmNoYXJzLCB0aGlzLmZvbnROYW1lLCB3LCBoKTtcblxuICAgICAgICBjb25zdCBzeW1ib2xzID0gc3RyaW5nLmdldFN5bWJvbHModGhpcy5jaGFycy5qb2luKCcnKSk7XG4gICAgICAgIGNvbnN0IHByZXZOdW1UZXh0dXJlcyA9IHRoaXMudGV4dHVyZXMubGVuZ3RoO1xuXG4gICAgICAgIGxldCBtYXhIZWlnaHQgPSAwO1xuICAgICAgICBsZXQgbWF4RGVzY2VudCA9IDA7XG4gICAgICAgIGNvbnN0IG1ldHJpY3MgPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzeW1ib2xzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjaCA9IHN5bWJvbHNbaV07XG4gICAgICAgICAgICBtZXRyaWNzW2NoXSA9IHRoaXMuX2dldFRleHRNZXRyaWNzKGNoKTtcbiAgICAgICAgICAgIG1heEhlaWdodCA9IE1hdGgubWF4KG1heEhlaWdodCwgbWV0cmljc1tjaF0uaGVpZ2h0KTtcbiAgICAgICAgICAgIG1heERlc2NlbnQgPSBNYXRoLm1heChtYXhEZXNjZW50LCBtZXRyaWNzW2NoXS5kZXNjZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZ2x5cGhTaXplID0gTWF0aC5tYXgodGhpcy5nbHlwaFNpemUsIG1heEhlaWdodCk7XG5cbiAgICAgICAgY29uc3Qgc3ggPSB0aGlzLmdseXBoU2l6ZSArIHRoaXMucGFkZGluZyAqIDI7XG4gICAgICAgIGNvbnN0IHN5ID0gdGhpcy5nbHlwaFNpemUgKyB0aGlzLnBhZGRpbmcgKiAyO1xuICAgICAgICBjb25zdCBfeE9mZnNldCA9IHRoaXMuZ2x5cGhTaXplIC8gMiArIHRoaXMucGFkZGluZztcbiAgICAgICAgY29uc3QgX3lPZmZzZXQgPSBzeSAtIG1heERlc2NlbnQgLSB0aGlzLnBhZGRpbmc7XG4gICAgICAgIGxldCBfeCA9IDA7XG4gICAgICAgIGxldCBfeSA9IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzeW1ib2xzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjaCA9IHN5bWJvbHNbaV07XG4gICAgICAgICAgICBjb25zdCBjb2RlID0gc3RyaW5nLmdldENvZGVQb2ludChzeW1ib2xzW2ldKTtcblxuICAgICAgICAgICAgbGV0IGZzID0gdGhpcy5mb250U2l6ZTtcbiAgICAgICAgICAgIGN0eC5mb250ID0gdGhpcy5mb250V2VpZ2h0ICsgJyAnICsgZnMudG9TdHJpbmcoKSArICdweCAnICsgdGhpcy5mb250TmFtZTtcbiAgICAgICAgICAgIGN0eC50ZXh0QWxpZ24gPSBURVhUX0FMSUdOO1xuICAgICAgICAgICAgY3R4LnRleHRCYXNlbGluZSA9IFRFWFRfQkFTRUxJTkU7XG5cbiAgICAgICAgICAgIGxldCB3aWR0aCA9IGN0eC5tZWFzdXJlVGV4dChjaCkud2lkdGg7XG5cbiAgICAgICAgICAgIGlmICh3aWR0aCA+IGZzKSB7XG4gICAgICAgICAgICAgICAgZnMgPSB0aGlzLmZvbnRTaXplICogdGhpcy5mb250U2l6ZSAvIHdpZHRoO1xuICAgICAgICAgICAgICAgIGN0eC5mb250ID0gdGhpcy5mb250V2VpZ2h0ICsgJyAnICsgZnMudG9TdHJpbmcoKSArICdweCAnICsgdGhpcy5mb250TmFtZTtcbiAgICAgICAgICAgICAgICB3aWR0aCA9IHRoaXMuZm9udFNpemU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucmVuZGVyQ2hhcmFjdGVyKGN0eCwgY2gsIF94ICsgX3hPZmZzZXQsIF95ICsgX3lPZmZzZXQsIGNvbG9yKTtcblxuICAgICAgICAgICAgY29uc3QgeG9mZnNldCA9IHRoaXMucGFkZGluZyArICh0aGlzLmdseXBoU2l6ZSAtIHdpZHRoKSAvIDI7XG4gICAgICAgICAgICBjb25zdCB5b2Zmc2V0ID0gLXRoaXMucGFkZGluZyArIG1ldHJpY3NbY2hdLmRlc2NlbnQgLSBtYXhEZXNjZW50O1xuICAgICAgICAgICAgY29uc3QgeGFkdmFuY2UgPSB3aWR0aDtcblxuICAgICAgICAgICAgdGhpcy5fYWRkQ2hhcih0aGlzLmRhdGEsIGNoLCBjb2RlLCBfeCwgX3ksIHN4LCBzeSwgeG9mZnNldCwgeW9mZnNldCwgeGFkdmFuY2UsIG51bVRleHR1cmVzIC0gMSwgdywgaCk7XG5cbiAgICAgICAgICAgIF94ICs9IHN4O1xuICAgICAgICAgICAgaWYgKF94ICsgc3ggPiB3KSB7XG4gICAgICAgICAgICAgICAgLy8gV3JhcCB0byB0aGUgbmV4dCByb3cgb2YgdGhpcyBjYW52YXMgaWYgdGhlIHJpZ2h0IGVkZ2Ugb2YgdGhlIG5leHQgZ2x5cGggd291bGQgb3ZlcmZsb3dcbiAgICAgICAgICAgICAgICBfeCA9IDA7XG4gICAgICAgICAgICAgICAgX3kgKz0gc3k7XG4gICAgICAgICAgICAgICAgaWYgKF95ICsgc3kgPiBoKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFdlIHJhbiBvdXQgb2Ygc3BhY2Ugb24gdGhpcyB0ZXh0dXJlIVxuICAgICAgICAgICAgICAgICAgICAvLyBDb3B5IHRoZSBjYW52YXMgaW50byB0aGUgdGV4dHVyZSBhbmQgdXBsb2FkIGl0XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudGV4dHVyZXNbbnVtVGV4dHVyZXMgLSAxXS51cGxvYWQoKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIGEgbmV3IHRleHR1cmUgKGlmIG5lZWRlZCkgYW5kIGNvbnRpbnVlIG9uXG4gICAgICAgICAgICAgICAgICAgIG51bVRleHR1cmVzKys7XG4gICAgICAgICAgICAgICAgICAgIF95ID0gMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG51bVRleHR1cmVzID4gcHJldk51bVRleHR1cmVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbnZhcy5oZWlnaHQgPSBoO1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FudmFzLndpZHRoID0gdztcblxuICAgICAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0QW5kQ2xlYXJDb250ZXh0KGNhbnZhcywgdHJhbnNwYXJlbnQpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gbmV3IFRleHR1cmUodGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2UsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3JtYXQ6IFBJWEVMRk9STUFUX1JHQkE4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1pcG1hcHM6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2ZvbnQtYXRsYXMnXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuc2V0U291cmNlKGNhbnZhcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLm1pbkZpbHRlciA9IEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUubWFnRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHR1cmUuYWRkcmVzc1UgPSBBRERSRVNTX0NMQU1QX1RPX0VER0U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0ZXh0dXJlLmFkZHJlc3NWID0gQUREUkVTU19DTEFNUF9UT19FREdFO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlcy5wdXNoKHRleHR1cmUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2FudmFzID0gdGhpcy50ZXh0dXJlc1tudW1UZXh0dXJlcyAtIDFdLmdldFNvdXJjZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY3R4ID0gdGhpcy5fZ2V0QW5kQ2xlYXJDb250ZXh0KGNhbnZhcywgdHJhbnNwYXJlbnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIENvcHkgYW55IHJlbWFpbmluZyBjaGFyYWN0ZXJzIGluIHRoZSBjYW52YXMgaW50byB0aGUgbGFzdCB0ZXh0dXJlIGFuZCB1cGxvYWQgaXRcbiAgICAgICAgdGhpcy50ZXh0dXJlc1tudW1UZXh0dXJlcyAtIDFdLnVwbG9hZCgpO1xuXG4gICAgICAgIC8vIENsZWFudXAgYW55IHJlbWFpbmluZyAodW51c2VkKSB0ZXh0dXJlc1xuICAgICAgICBpZiAobnVtVGV4dHVyZXMgPCBwcmV2TnVtVGV4dHVyZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSBudW1UZXh0dXJlczsgaSA8IHByZXZOdW1UZXh0dXJlczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50ZXh0dXJlc1tpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnRleHR1cmVzLnNwbGljZShudW1UZXh0dXJlcyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhbGVydCB0ZXh0LWVsZW1lbnRzIHRoYXQgdGhlIGZvbnQgaGFzIGJlZW4gcmUtcmVuZGVyZWRcbiAgICAgICAgdGhpcy5maXJlKCdyZW5kZXInKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ1tdfSBjaGFycyAtIEEgbGlzdCBvZiBjaGFyYWN0ZXJzLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBmb250TmFtZSAtIFRoZSBmb250IG5hbWUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIHdpZHRoIG9mIHRoZSB0ZXh0dXJlIGF0bGFzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSB0ZXh0dXJlIGF0bGFzLlxuICAgICAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSBmb250IEpTT04gb2JqZWN0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0ZUpzb24oY2hhcnMsIGZvbnROYW1lLCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIGNvbnN0IGJhc2UgPSB7XG4gICAgICAgICAgICAndmVyc2lvbic6IDMsXG4gICAgICAgICAgICAnaW50ZW5zaXR5JzogdGhpcy5pbnRlbnNpdHksXG4gICAgICAgICAgICAnaW5mbyc6IHtcbiAgICAgICAgICAgICAgICAnZmFjZSc6IGZvbnROYW1lLFxuICAgICAgICAgICAgICAgICd3aWR0aCc6IHdpZHRoLFxuICAgICAgICAgICAgICAgICdoZWlnaHQnOiBoZWlnaHQsXG4gICAgICAgICAgICAgICAgJ21hcHMnOiBbe1xuICAgICAgICAgICAgICAgICAgICAnd2lkdGgnOiB3aWR0aCxcbiAgICAgICAgICAgICAgICAgICAgJ2hlaWdodCc6IGhlaWdodFxuICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ2NoYXJzJzoge31cbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gYmFzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge29iamVjdH0ganNvbiAtIEZvbnQgZGF0YS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY2hhciAtIFRoZSBjaGFyYWN0ZXIgdG8gYWRkLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBjaGFyQ29kZSAtIFRoZSBjb2RlIHBvaW50IG51bWJlciBvZiB0aGUgY2hhcmFjdGVyIHRvIGFkZC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSB4IHBvc2l0aW9uIG9mIHRoZSBjaGFyYWN0ZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHkgLSBUaGUgeSBwb3NpdGlvbiBvZiB0aGUgY2hhcmFjdGVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3IC0gVGhlIHdpZHRoIG9mIHRoZSBjaGFyYWN0ZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGggLSBUaGUgaGVpZ2h0IG9mIHRoZSBjaGFyYWN0ZXIuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHhvZmZzZXQgLSBUaGUgeCBvZmZzZXQgb2YgdGhlIGNoYXJhY3Rlci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geW9mZnNldCAtIFRoZSB5IG9mZnNldCBvZiB0aGUgY2hhcmFjdGVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB4YWR2YW5jZSAtIFRoZSB4IGFkdmFuY2Ugb2YgdGhlIGNoYXJhY3Rlci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFwTnVtIC0gVGhlIG1hcCBudW1iZXIgb2YgdGhlIGNoYXJhY3Rlci5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWFwVyAtIFRoZSB3aWR0aCBvZiB0aGUgbWFwLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtYXBIIC0gVGhlIGhlaWdodCBvZiB0aGUgbWFwLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZENoYXIoanNvbiwgY2hhciwgY2hhckNvZGUsIHgsIHksIHcsIGgsIHhvZmZzZXQsIHlvZmZzZXQsIHhhZHZhbmNlLCBtYXBOdW0sIG1hcFcsIG1hcEgpIHtcbiAgICAgICAgaWYgKGpzb24uaW5mby5tYXBzLmxlbmd0aCA8IG1hcE51bSArIDEpIHtcbiAgICAgICAgICAgIGpzb24uaW5mby5tYXBzLnB1c2goeyAnd2lkdGgnOiBtYXBXLCAnaGVpZ2h0JzogbWFwSCB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNjYWxlID0gdGhpcy5mb250U2l6ZSAvIDMyO1xuXG4gICAgICAgIGpzb24uY2hhcnNbY2hhcl0gPSB7XG4gICAgICAgICAgICAnaWQnOiBjaGFyQ29kZSxcbiAgICAgICAgICAgICdsZXR0ZXInOiBjaGFyLFxuICAgICAgICAgICAgJ3gnOiB4LFxuICAgICAgICAgICAgJ3knOiB5LFxuICAgICAgICAgICAgJ3dpZHRoJzogdyxcbiAgICAgICAgICAgICdoZWlnaHQnOiBoLFxuICAgICAgICAgICAgJ3hhZHZhbmNlJzogeGFkdmFuY2UgLyBzY2FsZSxcbiAgICAgICAgICAgICd4b2Zmc2V0JzogeG9mZnNldCAvIHNjYWxlLFxuICAgICAgICAgICAgJ3lvZmZzZXQnOiAoeW9mZnNldCArIHRoaXMucGFkZGluZykgLyBzY2FsZSxcbiAgICAgICAgICAgICdzY2FsZSc6IHNjYWxlLFxuICAgICAgICAgICAgJ3JhbmdlJzogMSxcbiAgICAgICAgICAgICdtYXAnOiBtYXBOdW0sXG4gICAgICAgICAgICAnYm91bmRzJzogWzAsIDAsIHcgLyBzY2FsZSwgaCAvIHNjYWxlXVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRha2UgYSB1bmljb2RlIHN0cmluZyBhbmQgcHJvZHVjZSB0aGUgc2V0IG9mIGNoYXJhY3RlcnMgdXNlZCB0byBjcmVhdGUgdGhhdCBzdHJpbmcuXG4gICAgICogZS5nLiBcImFiY2FiY2FiY1wiIC0+IFsnYScsICdiJywgJ2MnXVxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBUaGUgdW5pY29kZSBzdHJpbmcgdG8gcHJvY2Vzcy5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nW119IFRoZSBzZXQgb2YgY2hhcmFjdGVycyB1c2VkIHRvIGNyZWF0ZSB0aGUgc3RyaW5nLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX25vcm1hbGl6ZUNoYXJzU2V0KHRleHQpIHtcbiAgICAgICAgLy8gbm9ybWFsaXplIHVuaWNvZGUgaWYgbmVlZGVkXG4gICAgICAgIGNvbnN0IHVuaWNvZGVDb252ZXJ0ZXJGdW5jID0gdGhpcy5hcHAuc3lzdGVtcy5lbGVtZW50LmdldFVuaWNvZGVDb252ZXJ0ZXIoKTtcbiAgICAgICAgaWYgKHVuaWNvZGVDb252ZXJ0ZXJGdW5jKSB7XG4gICAgICAgICAgICB0ZXh0ID0gdW5pY29kZUNvbnZlcnRlckZ1bmModGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gc3RyaXAgZHVwbGljYXRlc1xuICAgICAgICBjb25zdCBzZXQgPSB7fTtcbiAgICAgICAgY29uc3Qgc3ltYm9scyA9IHN0cmluZy5nZXRTeW1ib2xzKHRleHQpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN5bWJvbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNoID0gc3ltYm9sc1tpXTtcbiAgICAgICAgICAgIGlmIChzZXRbY2hdKSBjb250aW51ZTtcbiAgICAgICAgICAgIHNldFtjaF0gPSBjaDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjaGFycyA9IE9iamVjdC5rZXlzKHNldCk7XG4gICAgICAgIC8vIHNvcnRcbiAgICAgICAgcmV0dXJuIGNoYXJzLnNvcnQoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxjdWxhdGUgc29tZSBtZXRyaWNzIHRoYXQgYXJlbid0IGF2YWlsYWJsZSB2aWEgdGhlIGJyb3dzZXIgQVBJLCBub3RhYmx5IGNoYXJhY3RlciBoZWlnaHRcbiAgICAgKiBhbmQgZGVzY2VudCBzaXplLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBUaGUgdGV4dCB0byBtZWFzdXJlLlxuICAgICAqIEByZXR1cm5zIHt7YXNjZW50OiBudW1iZXIsIGRlc2NlbnQ6IG51bWJlciwgaGVpZ2h0OiBudW1iZXJ9fSBUaGUgbWV0cmljcyBvZiB0aGUgdGV4dC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRUZXh0TWV0cmljcyh0ZXh0KSB7XG4gICAgICAgIGNvbnN0IHRleHRTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICB0ZXh0U3Bhbi5pZCA9ICdjb250ZW50LXNwYW4nO1xuICAgICAgICB0ZXh0U3Bhbi5pbm5lckhUTUwgPSB0ZXh0O1xuXG4gICAgICAgIGNvbnN0IGJsb2NrID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGJsb2NrLmlkID0gJ2NvbnRlbnQtYmxvY2snO1xuICAgICAgICBibG9jay5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gICAgICAgIGJsb2NrLnN0eWxlLndpZHRoID0gJzFweCc7XG4gICAgICAgIGJsb2NrLnN0eWxlLmhlaWdodCA9ICcwcHgnO1xuXG4gICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBkaXYuYXBwZW5kQ2hpbGQodGV4dFNwYW4pO1xuICAgICAgICBkaXYuYXBwZW5kQ2hpbGQoYmxvY2spO1xuICAgICAgICBkaXYuc3R5bGUuZm9udCA9IHRoaXMuZm9udFNpemUgKyAncHggJyArIHRoaXMuZm9udE5hbWU7XG5cbiAgICAgICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmJvZHk7XG4gICAgICAgIGJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcblxuICAgICAgICBsZXQgYXNjZW50ID0gLTE7XG4gICAgICAgIGxldCBkZXNjZW50ID0gLTE7XG4gICAgICAgIGxldCBoZWlnaHQgPSAtMTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYmxvY2suc3R5bGVbJ3ZlcnRpY2FsLWFsaWduJ10gPSAnYmFzZWxpbmUnO1xuICAgICAgICAgICAgYXNjZW50ID0gYmxvY2sub2Zmc2V0VG9wIC0gdGV4dFNwYW4ub2Zmc2V0VG9wO1xuICAgICAgICAgICAgYmxvY2suc3R5bGVbJ3ZlcnRpY2FsLWFsaWduJ10gPSAnYm90dG9tJztcbiAgICAgICAgICAgIGhlaWdodCA9IGJsb2NrLm9mZnNldFRvcCAtIHRleHRTcGFuLm9mZnNldFRvcDtcbiAgICAgICAgICAgIGRlc2NlbnQgPSBoZWlnaHQgLSBhc2NlbnQ7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpdik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXNjZW50OiBhc2NlbnQsXG4gICAgICAgICAgICBkZXNjZW50OiBkZXNjZW50LFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHRcbiAgICAgICAgfTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IENhbnZhc0ZvbnQgfTtcbiJdLCJuYW1lcyI6WyJNQVhfVEVYVFVSRV9TSVpFIiwiREVGQVVMVF9URVhUVVJFX1NJWkUiLCJDYW52YXNGb250IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJvcHRpb25zIiwidHlwZSIsImludGVuc2l0eSIsImZvbnRXZWlnaHQiLCJmb250U2l6ZSIsInBhcnNlSW50IiwiZ2x5cGhTaXplIiwiZm9udE5hbWUiLCJjb2xvciIsIkNvbG9yIiwicGFkZGluZyIsInciLCJ3aWR0aCIsImgiLCJoZWlnaHQiLCJjYW52YXMiLCJkb2N1bWVudCIsImNyZWF0ZUVsZW1lbnQiLCJ0ZXh0dXJlIiwiVGV4dHVyZSIsImdyYXBoaWNzRGV2aWNlIiwibmFtZSIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwibWluRmlsdGVyIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwibWFnRmlsdGVyIiwiRklMVEVSX0xJTkVBUiIsImFkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiYWRkcmVzc1YiLCJtaXBtYXBzIiwic2V0U291cmNlIiwidGV4dHVyZXMiLCJjaGFycyIsImRhdGEiLCJjcmVhdGVUZXh0dXJlcyIsInRleHQiLCJfY2hhcnMiLCJfbm9ybWFsaXplQ2hhcnNTZXQiLCJsZW5ndGgiLCJfcmVuZGVyQXRsYXMiLCJpIiwidXBkYXRlVGV4dHVyZXMiLCJuZXdDaGFyc1NldCIsImNoYXIiLCJwdXNoIiwiY29uY2F0IiwiZGVzdHJveSIsIl9nZXRBbmRDbGVhckNvbnRleHQiLCJjbGVhckNvbG9yIiwiY3R4IiwiZ2V0Q29udGV4dCIsImFscGhhIiwiY2xlYXJSZWN0IiwiZmlsbFN0eWxlIiwiZmlsbFJlY3QiLCJfY29sb3JUb1JnYlN0cmluZyIsInN0ciIsInIiLCJNYXRoIiwicm91bmQiLCJnIiwiYiIsImEiLCJyZW5kZXJDaGFyYWN0ZXIiLCJjb250ZXh0IiwieCIsInkiLCJmaWxsVGV4dCIsImNoYXJzQXJyYXkiLCJudW1UZXh0dXJlcyIsImdldFNvdXJjZSIsInRyYW5zcGFyZW50IiwiVEVYVF9BTElHTiIsIlRFWFRfQkFTRUxJTkUiLCJmb250IiwidG9TdHJpbmciLCJ0ZXh0QWxpZ24iLCJ0ZXh0QmFzZWxpbmUiLCJfY3JlYXRlSnNvbiIsInN5bWJvbHMiLCJzdHJpbmciLCJnZXRTeW1ib2xzIiwiam9pbiIsInByZXZOdW1UZXh0dXJlcyIsIm1heEhlaWdodCIsIm1heERlc2NlbnQiLCJtZXRyaWNzIiwiY2giLCJfZ2V0VGV4dE1ldHJpY3MiLCJtYXgiLCJkZXNjZW50Iiwic3giLCJzeSIsIl94T2Zmc2V0IiwiX3lPZmZzZXQiLCJfeCIsIl95IiwiY29kZSIsImdldENvZGVQb2ludCIsImZzIiwibWVhc3VyZVRleHQiLCJ4b2Zmc2V0IiwieW9mZnNldCIsInhhZHZhbmNlIiwiX2FkZENoYXIiLCJ1cGxvYWQiLCJzcGxpY2UiLCJmaXJlIiwiYmFzZSIsImpzb24iLCJjaGFyQ29kZSIsIm1hcE51bSIsIm1hcFciLCJtYXBIIiwiaW5mbyIsIm1hcHMiLCJzY2FsZSIsInVuaWNvZGVDb252ZXJ0ZXJGdW5jIiwic3lzdGVtcyIsImVsZW1lbnQiLCJnZXRVbmljb2RlQ29udmVydGVyIiwic2V0IiwiT2JqZWN0Iiwia2V5cyIsInNvcnQiLCJ0ZXh0U3BhbiIsImlkIiwiaW5uZXJIVE1MIiwiYmxvY2siLCJzdHlsZSIsImRpc3BsYXkiLCJkaXYiLCJhcHBlbmRDaGlsZCIsImJvZHkiLCJhc2NlbnQiLCJvZmZzZXRUb3AiLCJyZW1vdmVDaGlsZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFZQSxNQUFNQSxnQkFBZ0IsR0FBRyxJ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
