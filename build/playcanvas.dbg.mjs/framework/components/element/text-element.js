/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { string } from '../../../core/string.js';
import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { SEMANTIC_POSITION, SEMANTIC_TEXCOORD0, SEMANTIC_COLOR, SEMANTIC_ATTR8, SEMANTIC_ATTR9, TYPE_FLOAT32 } from '../../../platform/graphics/constants.js';
import { VertexIterator } from '../../../platform/graphics/vertex-iterator.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { Mesh } from '../../../scene/mesh.js';
import { LocalizedAsset } from '../../asset/asset-localized.js';
import { FONT_MSDF, FONT_BITMAP } from '../../font/constants.js';
import { Markup } from './markup.js';

class MeshInfo {
  constructor() {
    this.count = 0;
    this.quad = 0;
    this.lines = {};
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
    this.indices = [];
    this.outlines = [];
    this.shadows = [];
    this.meshInstance = null;
  }
}

function createTextMesh(device, meshInfo) {
  const mesh = new Mesh(device);
  mesh.setPositions(meshInfo.positions);
  mesh.setNormals(meshInfo.normals);
  mesh.setColors32(meshInfo.colors);
  mesh.setUvs(0, meshInfo.uvs);
  mesh.setIndices(meshInfo.indices);
  mesh.setVertexStream(SEMANTIC_ATTR8, meshInfo.outlines, 3, undefined, TYPE_FLOAT32, false);
  mesh.setVertexStream(SEMANTIC_ATTR9, meshInfo.shadows, 3, undefined, TYPE_FLOAT32, false);
  mesh.update();
  return mesh;
}
const LINE_BREAK_CHAR = /^[\r\n]$/;
const WHITESPACE_CHAR = /^[ \t]$/;
const WORD_BOUNDARY_CHAR = /^[ \t\-]|[\u200b]$/;
const ALPHANUMERIC_CHAR = /^[a-z0-9]$/i;

const CJK_CHAR = /^[\u1100-\u11ff]|[\u3000-\u9fff]|[\ua960-\ua97f]|[\uac00-\ud7ff]$/;
const NO_LINE_BREAK_CJK_CHAR = /^[〕〉》」』】〙〗〟ヽヾーァィゥェォッャュョヮヵヶぁぃぅぇぉっゃゅょゎゕゖㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ々〻]$/;

const CONTROL_CHARS = ['\u200B',
'\u061C', '\u200E', '\u200F', '\u202A', '\u202B', '\u202C', '\u202D', '\u202E', '\u2066', '\u2067', '\u2068', '\u2069'];

const CONTROL_GLYPH_DATA = {
  width: 0,
  height: 0,
  xadvance: 0,
  xoffset: 0,
  yoffset: 0
};
const colorTmp = new Color();
const vec2Tmp = new Vec2();
class TextElement {
  constructor(element) {
    this._element = element;
    this._system = element.system;
    this._entity = element.entity;

    this._text = '';
    this._symbols = [];
    this._colorPalette = [];
    this._outlinePalette = [];
    this._shadowPalette = [];
    this._symbolColors = null;
    this._symbolOutlineParams = null;
    this._symbolShadowParams = null;
    this._i18nKey = null;
    this._fontAsset = new LocalizedAsset(this._system.app);
    this._fontAsset.disableLocalization = true;
    this._fontAsset.on('load', this._onFontLoad, this);
    this._fontAsset.on('change', this._onFontChange, this);
    this._fontAsset.on('remove', this._onFontRemove, this);
    this._font = null;
    this._color = new Color(1, 1, 1, 1);
    this._colorUniform = new Float32Array(3);
    this._spacing = 1;
    this._fontSize = 32;
    this._fontMinY = 0;
    this._fontMaxY = 0;
    this._originalFontSize = 32;
    this._maxFontSize = 32;
    this._minFontSize = 8;
    this._autoFitWidth = false;
    this._autoFitHeight = false;
    this._maxLines = -1;
    this._lineHeight = 32;
    this._scaledLineHeight = 32;
    this._wrapLines = false;
    this._drawOrder = 0;
    this._alignment = new Vec2(0.5, 0.5);
    this._autoWidth = true;
    this._autoHeight = true;
    this.width = 0;
    this.height = 0;

    this._node = new GraphNode();
    this._model = new Model();
    this._model.graph = this._node;
    this._entity.addChild(this._node);
    this._meshInfo = [];
    this._material = null;
    this._aabbDirty = true;
    this._aabb = new BoundingBox();
    this._noResize = false;

    this._currentMaterialType = null;
    this._maskedMaterialSrc = null;

    this._rtlReorder = false;
    this._unicodeConverter = false;
    this._rtl = false;

    this._outlineColor = new Color(0, 0, 0, 1);
    this._outlineColorUniform = new Float32Array(4);
    this._outlineThicknessScale = 0.2;
    this._outlineThickness = 0.0;
    this._shadowColor = new Color(0, 0, 0, 1);
    this._shadowColorUniform = new Float32Array(4);
    this._shadowOffsetScale = 0.005;
    this._shadowOffset = new Vec2(0, 0);
    this._shadowOffsetUniform = new Float32Array(2);
    this._enableMarkup = false;

    this._onScreenChange(this._element.screen);

    element.on('resize', this._onParentResize, this);
    element.on('set:screen', this._onScreenChange, this);
    element.on('screen:set:screenspace', this._onScreenSpaceChange, this);
    element.on('set:draworder', this._onDrawOrderChange, this);
    element.on('set:pivot', this._onPivotChange, this);
    this._system.app.i18n.on('set:locale', this._onLocaleSet, this);
    this._system.app.i18n.on('data:add', this._onLocalizationData, this);
    this._system.app.i18n.on('data:remove', this._onLocalizationData, this);

    this._rangeStart = 0;
    this._rangeEnd = 0;
  }
  destroy() {
    this._setMaterial(null);

    if (this._model) {
      this._element.removeModelFromLayers(this._model);
      this._model.destroy();
      this._model = null;
    }
    this._fontAsset.destroy();
    this.font = null;
    this._element.off('resize', this._onParentResize, this);
    this._element.off('set:screen', this._onScreenChange, this);
    this._element.off('screen:set:screenspace', this._onScreenSpaceChange, this);
    this._element.off('set:draworder', this._onDrawOrderChange, this);
    this._element.off('set:pivot', this._onPivotChange, this);
    this._system.app.i18n.off('set:locale', this._onLocaleSet, this);
    this._system.app.i18n.off('data:add', this._onLocalizationData, this);
    this._system.app.i18n.off('data:remove', this._onLocalizationData, this);
  }
  _onParentResize(width, height) {
    if (this._noResize) return;
    if (this._font) this._updateText();
  }
  _onScreenChange(screen) {
    if (screen) {
      this._updateMaterial(screen.screen.screenSpace);
    } else {
      this._updateMaterial(false);
    }
  }
  _onScreenSpaceChange(value) {
    this._updateMaterial(value);
  }
  _onDrawOrderChange(order) {
    this._drawOrder = order;
    if (this._model) {
      for (let i = 0, len = this._model.meshInstances.length; i < len; i++) {
        this._model.meshInstances[i].drawOrder = order;
      }
    }
  }
  _onPivotChange(pivot) {
    if (this._font) this._updateText();
  }
  _onLocaleSet(locale) {
    if (!this._i18nKey) return;

    if (this.fontAsset) {
      const asset = this._system.app.assets.get(this.fontAsset);
      if (!asset || !asset.resource || asset.resource !== this._font) {
        this.font = null;
      }
    }
    this._resetLocalizedText();
  }
  _onLocalizationData(locale, messages) {
    if (this._i18nKey && messages[this._i18nKey]) {
      this._resetLocalizedText();
    }
  }
  _resetLocalizedText() {
    this._setText(this._system.app.i18n.getText(this._i18nKey));
  }
  _setText(text) {
    if (this.unicodeConverter) {
      const unicodeConverterFunc = this._system.getUnicodeConverter();
      if (unicodeConverterFunc) {
        text = unicodeConverterFunc(text);
      } else {
        console.warn('Element created with unicodeConverter option but no unicodeConverter function registered');
      }
    }
    if (this._text !== text) {
      if (this._font) {
        this._updateText(text);
      }
      this._text = text;
    }
  }
  _updateText(text) {
    let tags;
    if (text === undefined) text = this._text;

    this._symbols = string.getSymbols(text.normalize ? text.normalize('NFC') : text);

    if (this._symbols.length === 0) {
      this._symbols = [' '];
    }

    if (this._enableMarkup) {
      const results = Markup.evaluate(this._symbols);
      this._symbols = results.symbols;
      tags = results.tags || [];
    }

    if (this._rtlReorder) {
      const rtlReorderFunc = this._system.app.systems.element.getRtlReorder();
      if (rtlReorderFunc) {
        const results = rtlReorderFunc(this._symbols);
        this._rtl = results.rtl;

        this._symbols = results.mapping.map(function (v) {
          return this._symbols[v];
        }, this);

        if (tags) {
          tags = results.mapping.map(function (v) {
            return tags[v];
          });
        }
      } else {
        console.warn('Element created with rtlReorder option but no rtlReorder function registered');
      }
    } else {
      this._rtl = false;
    }
    const getColorThicknessHash = (color, thickness) => {
      return `${color.toString(true).toLowerCase()}:${thickness.toFixed(2)}`;
    };
    const getColorOffsetHash = (color, offset) => {
      return `${color.toString(true).toLowerCase()}:${offset.x.toFixed(2)}:${offset.y.toFixed(2)}`;
    };

    if (tags) {
      const paletteMap = {};
      const outlinePaletteMap = {};
      const shadowPaletteMap = {};

      this._colorPalette = [Math.round(this._color.r * 255), Math.round(this._color.g * 255), Math.round(this._color.b * 255)];
      this._outlinePalette = [Math.round(this._outlineColor.r * 255), Math.round(this._outlineColor.g * 255), Math.round(this._outlineColor.b * 255), Math.round(this._outlineColor.a * 255), Math.round(this._outlineThickness * 255)];
      this._shadowPalette = [Math.round(this._shadowColor.r * 255), Math.round(this._shadowColor.g * 255), Math.round(this._shadowColor.b * 255), Math.round(this._shadowColor.a * 255), Math.round(this._shadowOffset.x * 127), Math.round(this._shadowOffset.y * 127)];
      this._symbolColors = [];
      this._symbolOutlineParams = [];
      this._symbolShadowParams = [];
      paletteMap[this._color.toString(false).toLowerCase()] = 0;
      outlinePaletteMap[getColorThicknessHash(this._outlineColor, this._outlineThickness)] = 0;
      shadowPaletteMap[getColorOffsetHash(this._shadowColor, this._shadowOffset)] = 0;
      for (let i = 0, len = this._symbols.length; i < len; ++i) {
        const tag = tags[i];
        let color = 0;

        if (tag && tag.color && tag.color.value) {
          const c = tag.color.value;

          if (c.length === 7 && c[0] === '#') {
            const hex = c.substring(1).toLowerCase();
            if (paletteMap.hasOwnProperty(hex)) {
              color = paletteMap[hex];
            } else {
              if (/^([0-9a-f]{2}){3}$/.test(hex)) {
                color = this._colorPalette.length / 3;
                paletteMap[hex] = color;
                this._colorPalette.push(parseInt(hex.substring(0, 2), 16));
                this._colorPalette.push(parseInt(hex.substring(2, 4), 16));
                this._colorPalette.push(parseInt(hex.substring(4, 6), 16));
              }
            }
          }
        }
        this._symbolColors.push(color);
        let outline = 0;

        if (tag && tag.outline && (tag.outline.attributes.color || tag.outline.attributes.thickness)) {
          let _color = tag.outline.attributes.color ? colorTmp.fromString(tag.outline.attributes.color) : this._outlineColor;
          let thickness = Number(tag.outline.attributes.thickness);
          if (Number.isNaN(_color.r) || Number.isNaN(_color.g) || Number.isNaN(_color.b) || Number.isNaN(_color.a)) {
            _color = this._outlineColor;
          }
          if (Number.isNaN(thickness)) {
            thickness = this._outlineThickness;
          }
          const outlineHash = getColorThicknessHash(_color, thickness);
          if (outlinePaletteMap.hasOwnProperty(outlineHash)) {
            outline = outlinePaletteMap[outlineHash];
          } else {
            outline = this._outlinePalette.length / 5;
            outlinePaletteMap[outlineHash] = outline;
            this._outlinePalette.push(Math.round(_color.r * 255), Math.round(_color.g * 255), Math.round(_color.b * 255), Math.round(_color.a * 255), Math.round(thickness * 255));
          }
        }
        this._symbolOutlineParams.push(outline);
        let shadow = 0;

        if (tag && tag.shadow && (tag.shadow.attributes.color || tag.shadow.attributes.offset || tag.shadow.attributes.offsetX || tag.shadow.attributes.offsetY)) {
          let _color2 = tag.shadow.attributes.color ? colorTmp.fromString(tag.shadow.attributes.color) : this._shadowColor;
          const off = Number(tag.shadow.attributes.offset);
          const offX = Number(tag.shadow.attributes.offsetX);
          const offY = Number(tag.shadow.attributes.offsetY);
          if (Number.isNaN(_color2.r) || Number.isNaN(_color2.g) || Number.isNaN(_color2.b) || Number.isNaN(_color2.a)) {
            _color2 = this._shadowColor;
          }
          const offset = vec2Tmp.set(!Number.isNaN(offX) ? offX : !Number.isNaN(off) ? off : this._shadowOffset.x, !Number.isNaN(offY) ? offY : !Number.isNaN(off) ? off : this._shadowOffset.y);
          const shadowHash = getColorOffsetHash(_color2, offset);
          if (shadowPaletteMap.hasOwnProperty(shadowHash)) {
            shadow = shadowPaletteMap[shadowHash];
          } else {
            shadow = this._shadowPalette.length / 6;
            shadowPaletteMap[shadowHash] = shadow;
            this._shadowPalette.push(Math.round(_color2.r * 255), Math.round(_color2.g * 255), Math.round(_color2.b * 255), Math.round(_color2.a * 255), Math.round(offset.x * 127), Math.round(offset.y * 127));
          }
        }
        this._symbolShadowParams.push(shadow);
      }
    } else {
      this._colorPalette = [];
      this._symbolColors = null;
      this._symbolOutlineParams = null;
      this._symbolShadowParams = null;
    }
    this._updateMaterialEmissive();
    this._updateMaterialOutline();
    this._updateMaterialShadow();
    const charactersPerTexture = this._calculateCharsPerTexture();
    let removedModel = false;
    const element = this._element;
    const screenSpace = element._isScreenSpace();
    const screenCulled = element._isScreenCulled();
    const visibleFn = function visibleFn(camera) {
      return element.isVisibleForCamera(camera);
    };
    for (let i = 0, len = this._meshInfo.length; i < len; i++) {
      const l = charactersPerTexture[i] || 0;
      const meshInfo = this._meshInfo[i];
      if (meshInfo.count !== l) {
        if (!removedModel) {
          element.removeModelFromLayers(this._model);
          removedModel = true;
        }
        meshInfo.count = l;
        meshInfo.positions.length = meshInfo.normals.length = l * 3 * 4;
        meshInfo.indices.length = l * 3 * 2;
        meshInfo.uvs.length = l * 2 * 4;
        meshInfo.colors.length = l * 4 * 4;
        meshInfo.outlines.length = l * 4 * 3;
        meshInfo.shadows.length = l * 4 * 3;

        if (meshInfo.meshInstance) {
          this._removeMeshInstance(meshInfo.meshInstance);
        }

        if (l === 0) {
          meshInfo.meshInstance = null;
          continue;
        }

        for (let v = 0; v < l; v++) {
          meshInfo.indices[v * 3 * 2 + 0] = v * 4;
          meshInfo.indices[v * 3 * 2 + 1] = v * 4 + 1;
          meshInfo.indices[v * 3 * 2 + 2] = v * 4 + 3;
          meshInfo.indices[v * 3 * 2 + 3] = v * 4 + 2;
          meshInfo.indices[v * 3 * 2 + 4] = v * 4 + 3;
          meshInfo.indices[v * 3 * 2 + 5] = v * 4 + 1;
          meshInfo.normals[v * 4 * 3 + 0] = 0;
          meshInfo.normals[v * 4 * 3 + 1] = 0;
          meshInfo.normals[v * 4 * 3 + 2] = -1;
          meshInfo.normals[v * 4 * 3 + 3] = 0;
          meshInfo.normals[v * 4 * 3 + 4] = 0;
          meshInfo.normals[v * 4 * 3 + 5] = -1;
          meshInfo.normals[v * 4 * 3 + 6] = 0;
          meshInfo.normals[v * 4 * 3 + 7] = 0;
          meshInfo.normals[v * 4 * 3 + 8] = -1;
          meshInfo.normals[v * 4 * 3 + 9] = 0;
          meshInfo.normals[v * 4 * 3 + 10] = 0;
          meshInfo.normals[v * 4 * 3 + 11] = -1;
        }
        const mesh = createTextMesh(this._system.app.graphicsDevice, meshInfo);
        const mi = new MeshInstance(mesh, this._material, this._node);
        mi.name = 'Text Element: ' + this._entity.name;
        mi.castShadow = false;
        mi.receiveShadow = false;
        mi.cull = !screenSpace;
        mi.screenSpace = screenSpace;
        mi.drawOrder = this._drawOrder;
        if (screenCulled) {
          mi.cull = true;
          mi.isVisibleFunc = visibleFn;
        }
        this._setTextureParams(mi, this._font.textures[i]);
        mi.setParameter('material_emissive', this._colorUniform);
        mi.setParameter('material_opacity', this._color.a);
        mi.setParameter('font_sdfIntensity', this._font.intensity);
        mi.setParameter('font_pxrange', this._getPxRange(this._font));
        mi.setParameter('font_textureWidth', this._font.data.info.maps[i].width);
        mi.setParameter('outline_color', this._outlineColorUniform);
        mi.setParameter('outline_thickness', this._outlineThicknessScale * this._outlineThickness);
        mi.setParameter('shadow_color', this._shadowColorUniform);
        if (this._symbolShadowParams) {
          this._shadowOffsetUniform[0] = 0;
          this._shadowOffsetUniform[1] = 0;
        } else {
          const ratio = -this._font.data.info.maps[i].width / this._font.data.info.maps[i].height;
          this._shadowOffsetUniform[0] = this._shadowOffsetScale * this._shadowOffset.x;
          this._shadowOffsetUniform[1] = ratio * this._shadowOffsetScale * this._shadowOffset.y;
        }
        mi.setParameter('shadow_offset', this._shadowOffsetUniform);
        meshInfo.meshInstance = mi;
        this._model.meshInstances.push(mi);
      }
    }

    if (this._element.maskedBy) {
      this._element._setMaskedBy(this._element.maskedBy);
    }
    if (removedModel && this._element.enabled && this._entity.enabled) {
      this._element.addModelToLayers(this._model);
    }
    this._updateMeshes();

    this._rangeStart = 0;
    this._rangeEnd = this._symbols.length;
    this._updateRenderRange();
  }
  _removeMeshInstance(meshInstance) {
    meshInstance.destroy();
    const idx = this._model.meshInstances.indexOf(meshInstance);
    if (idx !== -1) this._model.meshInstances.splice(idx, 1);
  }
  _setMaterial(material) {
    this._material = material;
    if (this._model) {
      for (let i = 0, len = this._model.meshInstances.length; i < len; i++) {
        const mi = this._model.meshInstances[i];
        mi.material = material;
      }
    }
  }
  _updateMaterial(screenSpace) {
    const element = this._element;
    const screenCulled = element._isScreenCulled();
    const visibleFn = function visibleFn(camera) {
      return element.isVisibleForCamera(camera);
    };
    const msdf = this._font && this._font.type === FONT_MSDF;
    this._material = this._system.getTextElementMaterial(screenSpace, msdf, this._enableMarkup);
    if (this._model) {
      for (let i = 0, len = this._model.meshInstances.length; i < len; i++) {
        const mi = this._model.meshInstances[i];
        mi.cull = !screenSpace;
        mi.material = this._material;
        mi.screenSpace = screenSpace;
        if (screenCulled) {
          mi.cull = true;
          mi.isVisibleFunc = visibleFn;
        } else {
          mi.isVisibleFunc = null;
        }
      }
    }
  }
  _updateMaterialEmissive() {
    if (this._symbolColors) {
      this._colorUniform[0] = 1;
      this._colorUniform[1] = 1;
      this._colorUniform[2] = 1;
    } else {
      this._colorUniform[0] = this._color.r;
      this._colorUniform[1] = this._color.g;
      this._colorUniform[2] = this._color.b;
    }
  }
  _updateMaterialOutline() {
    if (this._symbolOutlineParams) {
      this._outlineColorUniform[0] = 0;
      this._outlineColorUniform[1] = 0;
      this._outlineColorUniform[2] = 0;
      this._outlineColorUniform[3] = 1;
    } else {
      this._outlineColorUniform[0] = this._outlineColor.r;
      this._outlineColorUniform[1] = this._outlineColor.g;
      this._outlineColorUniform[2] = this._outlineColor.b;
      this._outlineColorUniform[3] = this._outlineColor.a;
    }
  }
  _updateMaterialShadow() {
    if (this._symbolOutlineParams) {
      this._shadowColorUniform[0] = 0;
      this._shadowColorUniform[1] = 0;
      this._shadowColorUniform[2] = 0;
      this._shadowColorUniform[3] = 0;
    } else {
      this._shadowColorUniform[0] = this._shadowColor.r;
      this._shadowColorUniform[1] = this._shadowColor.g;
      this._shadowColorUniform[2] = this._shadowColor.b;
      this._shadowColorUniform[3] = this._shadowColor.a;
    }
  }

  _isWordBoundary(char) {
    return WORD_BOUNDARY_CHAR.test(char);
  }
  _isValidNextChar(nextchar) {
    return nextchar !== null && !NO_LINE_BREAK_CJK_CHAR.test(nextchar);
  }

  _isNextCJKBoundary(char, nextchar) {
    return CJK_CHAR.test(char) && (WORD_BOUNDARY_CHAR.test(nextchar) || ALPHANUMERIC_CHAR.test(nextchar));
  }

  _isNextCJKWholeWord(nextchar) {
    return CJK_CHAR.test(nextchar);
  }
  _updateMeshes() {
    const json = this._font.data;
    const self = this;
    const minFont = Math.min(this._minFontSize, this._maxFontSize);
    const maxFont = this._maxFontSize;
    const autoFit = this._shouldAutoFit();
    if (autoFit) {
      this._fontSize = this._maxFontSize;
    }
    const MAGIC = 32;
    const l = this._symbols.length;
    let _x = 0;
    let _y = 0;
    let _z = 0;
    let _xMinusTrailingWhitespace = 0;
    let lines = 1;
    let wordStartX = 0;
    let wordStartIndex = 0;
    let lineStartIndex = 0;
    let numWordsThisLine = 0;
    let numCharsThisLine = 0;
    let numBreaksThisLine = 0;
    const splitHorizontalAnchors = Math.abs(this._element.anchor.x - this._element.anchor.z) >= 0.0001;
    let maxLineWidth = this._element.calculatedWidth;
    if (this.autoWidth && !splitHorizontalAnchors || !this._wrapLines) {
      maxLineWidth = Number.POSITIVE_INFINITY;
    }
    let fontMinY = 0;
    let fontMaxY = 0;
    let char, data, quad, nextchar;
    function breakLine(symbols, lineBreakIndex, lineBreakX) {
      self._lineWidths.push(Math.abs(lineBreakX));
      const sliceStart = lineStartIndex > lineBreakIndex ? lineBreakIndex + 1 : lineStartIndex;
      const sliceEnd = lineStartIndex > lineBreakIndex ? lineStartIndex + 1 : lineBreakIndex;
      const chars = symbols.slice(sliceStart, sliceEnd);

      if (numBreaksThisLine) {
        let i = chars.length;
        while (i-- && numBreaksThisLine > 0) {
          if (LINE_BREAK_CHAR.test(chars[i])) {
            chars.splice(i, 1);
            numBreaksThisLine--;
          }
        }
      }
      self._lineContents.push(chars.join(''));
      _x = 0;
      _y -= self._scaledLineHeight;
      lines++;
      numWordsThisLine = 0;
      numCharsThisLine = 0;
      numBreaksThisLine = 0;
      wordStartX = 0;
      lineStartIndex = lineBreakIndex;
    }
    let retryUpdateMeshes = true;
    while (retryUpdateMeshes) {
      retryUpdateMeshes = false;

      if (autoFit) {
        this._scaledLineHeight = this._lineHeight * this._fontSize / (this._maxFontSize || 0.0001);
      } else {
        this._scaledLineHeight = this._lineHeight;
      }
      this.width = 0;
      this.height = 0;
      this._lineWidths = [];
      this._lineContents = [];
      _x = 0;
      _y = 0;
      _z = 0;
      _xMinusTrailingWhitespace = 0;
      lines = 1;
      wordStartX = 0;
      wordStartIndex = 0;
      lineStartIndex = 0;
      numWordsThisLine = 0;
      numCharsThisLine = 0;
      numBreaksThisLine = 0;
      const scale = this._fontSize / MAGIC;

      fontMinY = this._fontMinY * scale;
      fontMaxY = this._fontMaxY * scale;
      for (let i = 0; i < this._meshInfo.length; i++) {
        this._meshInfo[i].quad = 0;
        this._meshInfo[i].lines = {};
      }

      let color_r = 255;
      let color_g = 255;
      let color_b = 255;

      let outline_color_rg = 255 + 255 * 256;
      let outline_color_ba = 255 + 255 * 256;
      let outline_thickness = 0;

      let shadow_color_rg = 255 + 255 * 256;
      let shadow_color_ba = 255 + 255 * 256;
      let shadow_offset_xy = 127 + 127 * 256;

      for (let i = 0; i < l; i++) {
        char = this._symbols[i];
        nextchar = i + 1 >= l ? null : this._symbols[i + 1];

        const isLineBreak = LINE_BREAK_CHAR.test(char);
        if (isLineBreak) {
          numBreaksThisLine++;
          if (!this._wrapLines || this._maxLines < 0 || lines < this._maxLines) {
            breakLine(this._symbols, i, _xMinusTrailingWhitespace);
            wordStartIndex = i + 1;
            lineStartIndex = i + 1;
          }
          continue;
        }
        let x = 0;
        let y = 0;
        let advance = 0;
        let quadsize = 1;
        let dataScale, size;
        data = json.chars[char];

        if (!data) {
          if (CONTROL_CHARS.indexOf(char) !== -1) {
            data = CONTROL_GLYPH_DATA;
          } else {
            if (json.chars[' ']) {
              data = json.chars[' '];
            } else {
              for (const key in json.chars) {
                data = json.chars[key];
                break;
              }
            }
            if (!json.missingChars) {
              json.missingChars = new Set();
            }
            if (!json.missingChars.has(char)) {
              console.warn(`Character '${char}' is missing from the font ${json.info.face}`);
              json.missingChars.add(char);
            }
          }
        }
        if (data) {
          let kerning = 0;
          if (numCharsThisLine > 0) {
            const kernTable = this._font.data.kerning;
            if (kernTable) {
              const kernLeft = kernTable[string.getCodePoint(this._symbols[i - 1]) || 0];
              if (kernLeft) {
                kerning = kernLeft[string.getCodePoint(this._symbols[i]) || 0] || 0;
              }
            }
          }
          dataScale = data.scale || 1;
          size = (data.width + data.height) / 2;
          quadsize = scale * size / dataScale;
          advance = (data.xadvance + kerning) * scale;
          x = (data.xoffset - kerning) * scale;
          y = data.yoffset * scale;
        } else {
          console.error(`Couldn't substitute missing character: '${char}'`);
        }
        const isWhitespace = WHITESPACE_CHAR.test(char);
        const meshInfoId = data && data.map || 0;
        const ratio = -this._font.data.info.maps[meshInfoId].width / this._font.data.info.maps[meshInfoId].height;
        const meshInfo = this._meshInfo[meshInfoId];
        const candidateLineWidth = _x + this._spacing * advance;

        if (candidateLineWidth > maxLineWidth && numCharsThisLine > 0 && !isWhitespace) {
          if (this._maxLines < 0 || lines < this._maxLines) {
            if (numWordsThisLine === 0) {
              wordStartIndex = i;
              breakLine(this._symbols, i, _xMinusTrailingWhitespace);
            } else {
              const backtrack = Math.max(i - wordStartIndex, 0);
              if (this._meshInfo.length <= 1) {
                meshInfo.lines[lines - 1] -= backtrack;
                meshInfo.quad -= backtrack;
              } else {
                const backtrackStart = wordStartIndex;
                const backtrackEnd = i;
                for (let j = backtrackStart; j < backtrackEnd; j++) {
                  const backChar = this._symbols[j];
                  const backCharData = json.chars[backChar];
                  const backMeshInfo = this._meshInfo[backCharData && backCharData.map || 0];
                  backMeshInfo.lines[lines - 1] -= 1;
                  backMeshInfo.quad -= 1;
                }
              }
              i -= backtrack + 1;
              breakLine(this._symbols, wordStartIndex, wordStartX);
              continue;
            }
          }
        }
        quad = meshInfo.quad;
        meshInfo.lines[lines - 1] = quad;
        let left = _x - x;
        let right = left + quadsize;
        const bottom = _y - y;
        const top = bottom + quadsize;
        if (this._rtl) {
          const shift = quadsize - x - this._spacing * advance - x;
          left -= shift;
          right -= shift;
        }
        meshInfo.positions[quad * 4 * 3 + 0] = left;
        meshInfo.positions[quad * 4 * 3 + 1] = bottom;
        meshInfo.positions[quad * 4 * 3 + 2] = _z;
        meshInfo.positions[quad * 4 * 3 + 3] = right;
        meshInfo.positions[quad * 4 * 3 + 4] = bottom;
        meshInfo.positions[quad * 4 * 3 + 5] = _z;
        meshInfo.positions[quad * 4 * 3 + 6] = right;
        meshInfo.positions[quad * 4 * 3 + 7] = top;
        meshInfo.positions[quad * 4 * 3 + 8] = _z;
        meshInfo.positions[quad * 4 * 3 + 9] = left;
        meshInfo.positions[quad * 4 * 3 + 10] = top;
        meshInfo.positions[quad * 4 * 3 + 11] = _z;
        this.width = Math.max(this.width, candidateLineWidth);

        let fontSize;
        if (this._shouldAutoFitWidth() && this.width > this._element.calculatedWidth) {
          fontSize = Math.floor(this._element.fontSize * this._element.calculatedWidth / (this.width || 0.0001));
          fontSize = math.clamp(fontSize, minFont, maxFont);
          if (fontSize !== this._element.fontSize) {
            this._fontSize = fontSize;
            retryUpdateMeshes = true;
            break;
          }
        }
        this.height = Math.max(this.height, fontMaxY - (_y + fontMinY));

        if (this._shouldAutoFitHeight() && this.height > this._element.calculatedHeight) {
          fontSize = math.clamp(this._fontSize - 1, minFont, maxFont);
          if (fontSize !== this._element.fontSize) {
            this._fontSize = fontSize;
            retryUpdateMeshes = true;
            break;
          }
        }

        _x += this._spacing * advance;

        if (!isWhitespace) {
          _xMinusTrailingWhitespace = _x;
        }
        if (this._isWordBoundary(char) || this._isValidNextChar(nextchar) && (this._isNextCJKBoundary(char, nextchar) || this._isNextCJKWholeWord(nextchar))) {
          numWordsThisLine++;
          wordStartX = _xMinusTrailingWhitespace;
          wordStartIndex = i + 1;
        }
        numCharsThisLine++;
        const uv = this._getUv(char);
        meshInfo.uvs[quad * 4 * 2 + 0] = uv[0];
        meshInfo.uvs[quad * 4 * 2 + 1] = 1.0 - uv[1];
        meshInfo.uvs[quad * 4 * 2 + 2] = uv[2];
        meshInfo.uvs[quad * 4 * 2 + 3] = 1.0 - uv[1];
        meshInfo.uvs[quad * 4 * 2 + 4] = uv[2];
        meshInfo.uvs[quad * 4 * 2 + 5] = 1.0 - uv[3];
        meshInfo.uvs[quad * 4 * 2 + 6] = uv[0];
        meshInfo.uvs[quad * 4 * 2 + 7] = 1.0 - uv[3];

        if (this._symbolColors) {
          const colorIdx = this._symbolColors[i] * 3;
          color_r = this._colorPalette[colorIdx];
          color_g = this._colorPalette[colorIdx + 1];
          color_b = this._colorPalette[colorIdx + 2];
        }
        meshInfo.colors[quad * 4 * 4 + 0] = color_r;
        meshInfo.colors[quad * 4 * 4 + 1] = color_g;
        meshInfo.colors[quad * 4 * 4 + 2] = color_b;
        meshInfo.colors[quad * 4 * 4 + 3] = 255;
        meshInfo.colors[quad * 4 * 4 + 4] = color_r;
        meshInfo.colors[quad * 4 * 4 + 5] = color_g;
        meshInfo.colors[quad * 4 * 4 + 6] = color_b;
        meshInfo.colors[quad * 4 * 4 + 7] = 255;
        meshInfo.colors[quad * 4 * 4 + 8] = color_r;
        meshInfo.colors[quad * 4 * 4 + 9] = color_g;
        meshInfo.colors[quad * 4 * 4 + 10] = color_b;
        meshInfo.colors[quad * 4 * 4 + 11] = 255;
        meshInfo.colors[quad * 4 * 4 + 12] = color_r;
        meshInfo.colors[quad * 4 * 4 + 13] = color_g;
        meshInfo.colors[quad * 4 * 4 + 14] = color_b;
        meshInfo.colors[quad * 4 * 4 + 15] = 255;

        if (this._symbolOutlineParams) {
          const outlineIdx = this._symbolOutlineParams[i] * 5;
          outline_color_rg = this._outlinePalette[outlineIdx] + this._outlinePalette[outlineIdx + 1] * 256;
          outline_color_ba = this._outlinePalette[outlineIdx + 2] + this._outlinePalette[outlineIdx + 3] * 256;
          outline_thickness = this._outlinePalette[outlineIdx + 4];
        }
        meshInfo.outlines[quad * 4 * 3 + 0] = outline_color_rg;
        meshInfo.outlines[quad * 4 * 3 + 1] = outline_color_ba;
        meshInfo.outlines[quad * 4 * 3 + 2] = outline_thickness;
        meshInfo.outlines[quad * 4 * 3 + 3] = outline_color_rg;
        meshInfo.outlines[quad * 4 * 3 + 4] = outline_color_ba;
        meshInfo.outlines[quad * 4 * 3 + 5] = outline_thickness;
        meshInfo.outlines[quad * 4 * 3 + 6] = outline_color_rg;
        meshInfo.outlines[quad * 4 * 3 + 7] = outline_color_ba;
        meshInfo.outlines[quad * 4 * 3 + 8] = outline_thickness;
        meshInfo.outlines[quad * 4 * 3 + 9] = outline_color_rg;
        meshInfo.outlines[quad * 4 * 3 + 10] = outline_color_ba;
        meshInfo.outlines[quad * 4 * 3 + 11] = outline_thickness;

        if (this._symbolShadowParams) {
          const shadowIdx = this._symbolShadowParams[i] * 6;
          shadow_color_rg = this._shadowPalette[shadowIdx] + this._shadowPalette[shadowIdx + 1] * 256;
          shadow_color_ba = this._shadowPalette[shadowIdx + 2] + this._shadowPalette[shadowIdx + 3] * 256;
          shadow_offset_xy = this._shadowPalette[shadowIdx + 4] + 127 + Math.round(ratio * this._shadowPalette[shadowIdx + 5] + 127) * 256;
        }
        meshInfo.shadows[quad * 4 * 3 + 0] = shadow_color_rg;
        meshInfo.shadows[quad * 4 * 3 + 1] = shadow_color_ba;
        meshInfo.shadows[quad * 4 * 3 + 2] = shadow_offset_xy;
        meshInfo.shadows[quad * 4 * 3 + 3] = shadow_color_rg;
        meshInfo.shadows[quad * 4 * 3 + 4] = shadow_color_ba;
        meshInfo.shadows[quad * 4 * 3 + 5] = shadow_offset_xy;
        meshInfo.shadows[quad * 4 * 3 + 6] = shadow_color_rg;
        meshInfo.shadows[quad * 4 * 3 + 7] = shadow_color_ba;
        meshInfo.shadows[quad * 4 * 3 + 8] = shadow_offset_xy;
        meshInfo.shadows[quad * 4 * 3 + 9] = shadow_color_rg;
        meshInfo.shadows[quad * 4 * 3 + 10] = shadow_color_ba;
        meshInfo.shadows[quad * 4 * 3 + 11] = shadow_offset_xy;
        meshInfo.quad++;
      }
      if (retryUpdateMeshes) {
        continue;
      }

      if (lineStartIndex < l) {
        breakLine(this._symbols, l, _x);
      }
    }

    this._noResize = true;
    this.autoWidth = this._autoWidth;
    this.autoHeight = this._autoHeight;
    this._noResize = false;

    const hp = this._element.pivot.x;
    const vp = this._element.pivot.y;
    const ha = this._alignment.x;
    const va = this._alignment.y;
    for (let i = 0; i < this._meshInfo.length; i++) {
      if (this._meshInfo[i].count === 0) continue;
      let prevQuad = 0;
      for (const line in this._meshInfo[i].lines) {
        const index = this._meshInfo[i].lines[line];
        const lw = this._lineWidths[parseInt(line, 10)];
        const hoffset = -hp * this._element.calculatedWidth + ha * (this._element.calculatedWidth - lw) * (this._rtl ? -1 : 1);
        const voffset = (1 - vp) * this._element.calculatedHeight - fontMaxY - (1 - va) * (this._element.calculatedHeight - this.height);
        for (let _quad = prevQuad; _quad <= index; _quad++) {
          this._meshInfo[i].positions[_quad * 4 * 3] += hoffset;
          this._meshInfo[i].positions[_quad * 4 * 3 + 3] += hoffset;
          this._meshInfo[i].positions[_quad * 4 * 3 + 6] += hoffset;
          this._meshInfo[i].positions[_quad * 4 * 3 + 9] += hoffset;
          this._meshInfo[i].positions[_quad * 4 * 3 + 1] += voffset;
          this._meshInfo[i].positions[_quad * 4 * 3 + 4] += voffset;
          this._meshInfo[i].positions[_quad * 4 * 3 + 7] += voffset;
          this._meshInfo[i].positions[_quad * 4 * 3 + 10] += voffset;
        }

        if (this._rtl) {
          for (let _quad2 = prevQuad; _quad2 <= index; _quad2++) {
            const idx = _quad2 * 4 * 3;

            for (let vert = 0; vert < 4; ++vert) {
              this._meshInfo[i].positions[idx + vert * 3] = this._element.calculatedWidth - this._meshInfo[i].positions[idx + vert * 3] + hoffset * 2;
            }

            const tmp0 = this._meshInfo[i].positions[idx + 3];
            const tmp1 = this._meshInfo[i].positions[idx + 6];
            this._meshInfo[i].positions[idx + 3] = this._meshInfo[i].positions[idx + 0];
            this._meshInfo[i].positions[idx + 6] = this._meshInfo[i].positions[idx + 9];
            this._meshInfo[i].positions[idx + 0] = tmp0;
            this._meshInfo[i].positions[idx + 9] = tmp1;
          }
        }
        prevQuad = index + 1;
      }

      const numVertices = this._meshInfo[i].count * 4;
      const vertMax = this._meshInfo[i].quad * 4;
      const it = new VertexIterator(this._meshInfo[i].meshInstance.mesh.vertexBuffer);
      for (let v = 0; v < numVertices; v++) {
        if (v >= vertMax) {
          it.element[SEMANTIC_POSITION].set(0, 0, 0);
          it.element[SEMANTIC_TEXCOORD0].set(0, 0);
          it.element[SEMANTIC_COLOR].set(0, 0, 0, 0);
          it.element[SEMANTIC_ATTR8].set(0, 0, 0, 0);
          it.element[SEMANTIC_ATTR9].set(0, 0, 0, 0);
        } else {
          it.element[SEMANTIC_POSITION].set(this._meshInfo[i].positions[v * 3 + 0], this._meshInfo[i].positions[v * 3 + 1], this._meshInfo[i].positions[v * 3 + 2]);
          it.element[SEMANTIC_TEXCOORD0].set(this._meshInfo[i].uvs[v * 2 + 0], this._meshInfo[i].uvs[v * 2 + 1]);
          it.element[SEMANTIC_COLOR].set(this._meshInfo[i].colors[v * 4 + 0], this._meshInfo[i].colors[v * 4 + 1], this._meshInfo[i].colors[v * 4 + 2], this._meshInfo[i].colors[v * 4 + 3]);
          it.element[SEMANTIC_ATTR8].set(this._meshInfo[i].outlines[v * 3 + 0], this._meshInfo[i].outlines[v * 3 + 1], this._meshInfo[i].outlines[v * 3 + 2]);
          it.element[SEMANTIC_ATTR9].set(this._meshInfo[i].shadows[v * 3 + 0], this._meshInfo[i].shadows[v * 3 + 1], this._meshInfo[i].shadows[v * 3 + 2]);
        }
        it.next();
      }
      it.end();
      this._meshInfo[i].meshInstance.mesh.aabb.compute(this._meshInfo[i].positions);

      this._meshInfo[i].meshInstance._aabbVer = -1;
    }

    this._aabbDirty = true;
  }
  _onFontRender() {
    this.font = this._font;
  }
  _onFontLoad(asset) {
    if (this.font !== asset.resource) {
      this.font = asset.resource;
    }
  }
  _onFontChange(asset, name, _new, _old) {
    if (name === 'data') {
      this._font.data = _new;
      const maps = this._font.data.info.maps.length;
      for (let i = 0; i < maps; i++) {
        if (!this._meshInfo[i]) continue;
        const mi = this._meshInfo[i].meshInstance;
        if (mi) {
          mi.setParameter('font_sdfIntensity', this._font.intensity);
          mi.setParameter('font_pxrange', this._getPxRange(this._font));
          mi.setParameter('font_textureWidth', this._font.data.info.maps[i].width);
        }
      }
    }
  }
  _onFontRemove(asset) {}
  _setTextureParams(mi, texture) {
    if (this._font) {
      if (this._font.type === FONT_MSDF) {
        mi.deleteParameter('texture_emissiveMap');
        mi.deleteParameter('texture_opacityMap');
        mi.setParameter('texture_msdfMap', texture);
      } else if (this._font.type === FONT_BITMAP) {
        mi.deleteParameter('texture_msdfMap');
        mi.setParameter('texture_emissiveMap', texture);
        mi.setParameter('texture_opacityMap', texture);
      }
    }
  }
  _getPxRange(font) {
    const keys = Object.keys(this._font.data.chars);
    for (let i = 0; i < keys.length; i++) {
      const char = this._font.data.chars[keys[i]];
      if (char.range) {
        return (char.scale || 1) * char.range;
      }
    }
    return 2;
  }

  _getUv(char) {
    const data = this._font.data;
    if (!data.chars[char]) {
      const space = ' ';
      if (data.chars[space]) {
        return this._getUv(space);
      }

      return [0, 0, 0, 0];
    }
    const map = data.chars[char].map;
    const width = data.info.maps[map].width;
    const height = data.info.maps[map].height;
    const x = data.chars[char].x;
    const y = data.chars[char].y;
    const x1 = x;
    const y1 = y;
    const x2 = x + data.chars[char].width;
    const y2 = y - data.chars[char].height;
    const edge = 1 - data.chars[char].height / height;
    return [x1 / width, edge - y1 / height,

    x2 / width, edge - y2 / height];
  }

  onEnable() {
    this._fontAsset.autoLoad = true;
    if (this._model) {
      this._element.addModelToLayers(this._model);
    }
  }
  onDisable() {
    this._fontAsset.autoLoad = false;
    if (this._model) {
      this._element.removeModelFromLayers(this._model);
    }
  }
  _setStencil(stencilParams) {
    if (this._model) {
      const instances = this._model.meshInstances;
      for (let i = 0; i < instances.length; i++) {
        instances[i].stencilFront = stencilParams;
        instances[i].stencilBack = stencilParams;
      }
    }
  }
  _shouldAutoFitWidth() {
    return this._autoFitWidth && !this._autoWidth;
  }
  _shouldAutoFitHeight() {
    return this._autoFitHeight && !this._autoHeight;
  }
  _shouldAutoFit() {
    return this._autoFitWidth && !this._autoWidth || this._autoFitHeight && !this._autoHeight;
  }

  _calculateCharsPerTexture(symbolIndex) {
    const charactersPerTexture = {};
    if (symbolIndex === undefined) {
      symbolIndex = this._symbols.length;
    }
    for (let i = 0, len = symbolIndex; i < len; i++) {
      const char = this._symbols[i];
      let info = this._font.data.chars[char];
      if (!info) {
        info = this._font.data.chars[' '];
        if (!info) {
          info = this._font.data.chars[Object.keys(this._font.data.chars)[0]];
        }
      }
      const map = info.map;
      if (!charactersPerTexture[map]) {
        charactersPerTexture[map] = 1;
      } else {
        charactersPerTexture[map]++;
      }
    }
    return charactersPerTexture;
  }
  _updateRenderRange() {
    const startChars = this._rangeStart === 0 ? 0 : this._calculateCharsPerTexture(this._rangeStart);
    const endChars = this._rangeEnd === 0 ? 0 : this._calculateCharsPerTexture(this._rangeEnd);
    for (let i = 0, len = this._meshInfo.length; i < len; i++) {
      const start = startChars[i] || 0;
      const end = endChars[i] || 0;
      const instance = this._meshInfo[i].meshInstance;
      if (instance) {
        const mesh = instance.mesh;
        if (mesh) {
          mesh.primitive[0].base = start * 3 * 2;
          mesh.primitive[0].count = (end - start) * 3 * 2;
        }
      }
    }
  }
  set text(value) {
    this._i18nKey = null;
    const str = value != null && value.toString() || '';
    this._setText(str);
  }
  get text() {
    return this._text;
  }
  set key(value) {
    const str = value !== null ? value.toString() : null;
    if (this._i18nKey === str) {
      return;
    }
    this._i18nKey = str;
    if (str) {
      this._fontAsset.disableLocalization = false;
      this._resetLocalizedText();
    } else {
      this._fontAsset.disableLocalization = true;
    }
  }
  get key() {
    return this._i18nKey;
  }
  set color(value) {
    const r = value.r;
    const g = value.g;
    const b = value.b;
    if (this._color === value) {
      console.warn('Setting element.color to itself will have no effect');
    }
    if (this._color.r === r && this._color.g === g && this._color.b === b) {
      return;
    }
    this._color.r = r;
    this._color.g = g;
    this._color.b = b;
    if (!this._model) {
      return;
    }
    if (this._symbolColors) {
      if (this._font) {
        this._updateText();
      }
    } else {
      this._colorUniform[0] = this._color.r;
      this._colorUniform[1] = this._color.g;
      this._colorUniform[2] = this._color.b;
      for (let i = 0, len = this._model.meshInstances.length; i < len; i++) {
        const mi = this._model.meshInstances[i];
        mi.setParameter('material_emissive', this._colorUniform);
      }
    }
    if (this._element) {
      this._element.fire('set:color', this._color);
    }
  }
  get color() {
    return this._color;
  }
  set opacity(value) {
    if (this._color.a !== value) {
      this._color.a = value;
      if (this._model) {
        for (let i = 0, len = this._model.meshInstances.length; i < len; i++) {
          const mi = this._model.meshInstances[i];
          mi.setParameter('material_opacity', value);
        }
      }
    }
    if (this._element) {
      this._element.fire('set:opacity', value);
    }
  }
  get opacity() {
    return this._color.a;
  }
  set lineHeight(value) {
    const _prev = this._lineHeight;
    this._lineHeight = value;
    this._scaledLineHeight = value;
    if (_prev !== value && this._font) {
      this._updateText();
    }
  }
  get lineHeight() {
    return this._lineHeight;
  }
  set wrapLines(value) {
    const _prev = this._wrapLines;
    this._wrapLines = value;
    if (_prev !== value && this._font) {
      this._updateText();
    }
  }
  get wrapLines() {
    return this._wrapLines;
  }
  get lines() {
    return this._lineContents;
  }
  set spacing(value) {
    const _prev = this._spacing;
    this._spacing = value;
    if (_prev !== value && this._font) {
      this._updateText();
    }
  }
  get spacing() {
    return this._spacing;
  }
  set fontSize(value) {
    const _prev = this._fontSize;
    this._fontSize = value;
    this._originalFontSize = value;
    if (_prev !== value && this._font) {
      this._updateText();
    }
  }
  get fontSize() {
    return this._fontSize;
  }
  set fontAsset(value) {
    this._fontAsset.defaultAsset = value;
  }
  get fontAsset() {
    return this._fontAsset.localizedAsset;
  }
  set font(value) {
    let previousFontType;
    if (this._font) {
      previousFontType = this._font.type;

      if (this._font.off) this._font.off('render', this._onFontRender, this);
    }
    this._font = value;
    this._fontMinY = 0;
    this._fontMaxY = 0;
    if (!value) return;

    const json = this._font.data;
    for (const charId in json.chars) {
      const data = json.chars[charId];
      if (data.bounds) {
        this._fontMinY = Math.min(this._fontMinY, data.bounds[1]);
        this._fontMaxY = Math.max(this._fontMaxY, data.bounds[3]);
      }
    }

    if (this._font.on) this._font.on('render', this._onFontRender, this);
    if (this._fontAsset.localizedAsset) {
      const asset = this._system.app.assets.get(this._fontAsset.localizedAsset);
      if (asset.resource !== this._font) {
        this._fontAsset.defaultAsset = null;
      }
    }

    if (value.type !== previousFontType) {
      const screenSpace = this._element._isScreenSpace();
      this._updateMaterial(screenSpace);
    }

    for (let i = 0, len = this._font.textures.length; i < len; i++) {
      if (!this._meshInfo[i]) {
        this._meshInfo[i] = new MeshInfo();
      } else {
        const mi = this._meshInfo[i].meshInstance;
        if (mi) {
          mi.setParameter('font_sdfIntensity', this._font.intensity);
          mi.setParameter('font_pxrange', this._getPxRange(this._font));
          mi.setParameter('font_textureWidth', this._font.data.info.maps[i].width);
          this._setTextureParams(mi, this._font.textures[i]);
        }
      }
    }

    let removedModel = false;
    for (let i = this._font.textures.length; i < this._meshInfo.length; i++) {
      if (this._meshInfo[i].meshInstance) {
        if (!removedModel) {
          this._element.removeModelFromLayers(this._model);
          removedModel = true;
        }
        this._removeMeshInstance(this._meshInfo[i].meshInstance);
      }
    }
    if (this._meshInfo.length > this._font.textures.length) this._meshInfo.length = this._font.textures.length;
    this._updateText();
  }
  get font() {
    return this._font;
  }
  set alignment(value) {
    if (value instanceof Vec2) {
      this._alignment.set(value.x, value.y);
    } else {
      this._alignment.set(value[0], value[1]);
    }
    if (this._font) this._updateText();
  }
  get alignment() {
    return this._alignment;
  }
  set autoWidth(value) {
    const old = this._autoWidth;
    this._autoWidth = value;

    if (value && Math.abs(this._element.anchor.x - this._element.anchor.z) < 0.0001) {
      this._element.width = this.width;
    }

    if (old !== value) {
      const newFontSize = this._shouldAutoFit() ? this._maxFontSize : this._originalFontSize;
      if (newFontSize !== this._fontSize) {
        this._fontSize = newFontSize;
        if (this._font) {
          this._updateText();
        }
      }
    }
  }
  get autoWidth() {
    return this._autoWidth;
  }
  set autoHeight(value) {
    const old = this._autoHeight;
    this._autoHeight = value;

    if (value && Math.abs(this._element.anchor.y - this._element.anchor.w) < 0.0001) {
      this._element.height = this.height;
    }

    if (old !== value) {
      const newFontSize = this._shouldAutoFit() ? this._maxFontSize : this._originalFontSize;
      if (newFontSize !== this._fontSize) {
        this._fontSize = newFontSize;
        if (this._font) {
          this._updateText();
        }
      }
    }
  }
  get autoHeight() {
    return this._autoHeight;
  }
  set rtlReorder(value) {
    if (this._rtlReorder !== value) {
      this._rtlReorder = value;
      if (this._font) {
        this._updateText();
      }
    }
  }
  get rtlReorder() {
    return this._rtlReorder;
  }
  set unicodeConverter(value) {
    if (this._unicodeConverter !== value) {
      this._unicodeConverter = value;
      this._setText(this._text);
    }
  }
  get unicodeConverter() {
    return this._unicodeConverter;
  }

  get aabb() {
    if (this._aabbDirty) {
      let initialized = false;
      for (let i = 0; i < this._meshInfo.length; i++) {
        if (!this._meshInfo[i].meshInstance) continue;
        if (!initialized) {
          this._aabb.copy(this._meshInfo[i].meshInstance.aabb);
          initialized = true;
        } else {
          this._aabb.add(this._meshInfo[i].meshInstance.aabb);
        }
      }
      this._aabbDirty = false;
    }
    return this._aabb;
  }
  set outlineColor(value) {
    const r = value instanceof Color ? value.r : value[0];
    const g = value instanceof Color ? value.g : value[1];
    const b = value instanceof Color ? value.b : value[2];
    const a = value instanceof Color ? value.a : value[3];
    if (this._outlineColor === value) {
      console.warn('Setting element.outlineColor to itself will have no effect');
    }
    if (this._outlineColor.r === r && this._outlineColor.g === g && this._outlineColor.b === b && this._outlineColor.a === a) {
      return;
    }
    this._outlineColor.r = r;
    this._outlineColor.g = g;
    this._outlineColor.b = b;
    this._outlineColor.a = a;
    if (!this._model) {
      return;
    }
    if (this._symbolOutlineParams) {
      if (this._font) {
        this._updateText();
      }
    } else {
      this._outlineColorUniform[0] = this._outlineColor.r;
      this._outlineColorUniform[1] = this._outlineColor.g;
      this._outlineColorUniform[2] = this._outlineColor.b;
      this._outlineColorUniform[3] = this._outlineColor.a;
      for (let i = 0, len = this._model.meshInstances.length; i < len; i++) {
        const mi = this._model.meshInstances[i];
        mi.setParameter('outline_color', this._outlineColorUniform);
      }
    }
    if (this._element) {
      this._element.fire('set:outline', this._color);
    }
  }
  get outlineColor() {
    return this._outlineColor;
  }
  set outlineThickness(value) {
    const _prev = this._outlineThickness;
    this._outlineThickness = value;
    if (_prev !== value && this._font) {
      if (!this._model) {
        return;
      }
      if (this._symbolOutlineParams) {
        if (this._font) {
          this._updateText();
        }
      } else {
        for (let i = 0, len = this._model.meshInstances.length; i < len; i++) {
          const mi = this._model.meshInstances[i];
          mi.setParameter('outline_thickness', this._outlineThicknessScale * this._outlineThickness);
        }
      }
    }
  }
  get outlineThickness() {
    return this._outlineThickness;
  }
  set shadowColor(value) {
    const r = value instanceof Color ? value.r : value[0];
    const g = value instanceof Color ? value.g : value[1];
    const b = value instanceof Color ? value.b : value[2];
    const a = value instanceof Color ? value.a : value[3];
    if (this._shadowColor === value) {
      Debug.warn('Setting element.shadowColor to itself will have no effect');
    }
    if (this._shadowColor.r === r && this._shadowColor.g === g && this._shadowColor.b === b && this._shadowColor.a === a) {
      return;
    }
    this._shadowColor.r = r;
    this._shadowColor.g = g;
    this._shadowColor.b = b;
    this._shadowColor.a = a;
    if (!this._model) {
      return;
    }
    if (this._symbolShadowParams) {
      if (this._font) {
        this._updateText();
      }
    } else {
      this._shadowColorUniform[0] = this._shadowColor.r;
      this._shadowColorUniform[1] = this._shadowColor.g;
      this._shadowColorUniform[2] = this._shadowColor.b;
      this._shadowColorUniform[3] = this._shadowColor.a;
      for (let i = 0, len = this._model.meshInstances.length; i < len; i++) {
        const mi = this._model.meshInstances[i];
        mi.setParameter('shadow_color', this._shadowColorUniform);
      }
    }
  }
  get shadowColor() {
    return this._shadowColor;
  }
  set shadowOffset(value) {
    const x = value instanceof Vec2 ? value.x : value[0],
      y = value instanceof Vec2 ? value.y : value[1];
    if (this._shadowOffset.x === x && this._shadowOffset.y === y) {
      return;
    }
    this._shadowOffset.set(x, y);
    if (this._font && this._model) {
      if (this._symbolShadowParams) {
        this._updateText();
      } else {
        for (let i = 0, len = this._model.meshInstances.length; i < len; i++) {
          const ratio = -this._font.data.info.maps[i].width / this._font.data.info.maps[i].height;
          this._shadowOffsetUniform[0] = this._shadowOffsetScale * this._shadowOffset.x;
          this._shadowOffsetUniform[1] = ratio * this._shadowOffsetScale * this._shadowOffset.y;
          const mi = this._model.meshInstances[i];
          mi.setParameter('shadow_offset', this._shadowOffsetUniform);
        }
      }
    }
  }
  get shadowOffset() {
    return this._shadowOffset;
  }
  set minFontSize(value) {
    if (this._minFontSize === value) return;
    this._minFontSize = value;
    if (this.font && this._shouldAutoFit()) {
      this._updateText();
    }
  }
  get minFontSize() {
    return this._minFontSize;
  }
  set maxFontSize(value) {
    if (this._maxFontSize === value) return;
    this._maxFontSize = value;
    if (this.font && this._shouldAutoFit()) {
      this._updateText();
    }
  }
  get maxFontSize() {
    return this._maxFontSize;
  }
  set autoFitWidth(value) {
    if (this._autoFitWidth === value) return;
    this._autoFitWidth = value;
    this._fontSize = this._shouldAutoFit() ? this._maxFontSize : this._originalFontSize;
    if (this.font) {
      this._updateText();
    }
  }
  get autoFitWidth() {
    return this._autoFitWidth;
  }
  set autoFitHeight(value) {
    if (this._autoFitHeight === value) return;
    this._autoFitHeight = value;
    this._fontSize = this._shouldAutoFit() ? this._maxFontSize : this._originalFontSize;
    if (this.font) {
      this._updateText();
    }
  }
  get autoFitHeight() {
    return this._autoFitHeight;
  }
  set maxLines(value) {
    if (this._maxLines === value) return;
    if (value === null && this._maxLines === -1) return;
    this._maxLines = value === null ? -1 : value;
    if (this.font && this._wrapLines) {
      this._updateText();
    }
  }
  get maxLines() {
    return this._maxLines;
  }
  set enableMarkup(value) {
    value = !!value;
    if (this._enableMarkup === value) return;
    this._enableMarkup = value;
    if (this.font) {
      this._updateText();
    }
    const screenSpace = this._element._isScreenSpace();
    this._updateMaterial(screenSpace);
  }
  get enableMarkup() {
    return this._enableMarkup;
  }
  get symbols() {
    return this._symbols;
  }
  get symbolColors() {
    if (this._symbolColors === null) {
      return null;
    }
    return this._symbolColors.map(function (c) {
      return this._colorPalette.slice(c * 3, c * 3 + 3);
    }, this);
  }

  get symbolOutlineParams() {
    if (this._symbolOutlineParams === null) {
      return null;
    }
    return this._symbolOutlineParams.map(function (paramId) {
      return this._outlinePalette.slice(paramId * 5, paramId * 5 + 5);
    }, this);
  }

  get symbolShadowParams() {
    if (this._symbolShadowParams === null) {
      return null;
    }
    return this._symbolShadowParams.map(function (paramId) {
      return this._shadowPalette.slice(paramId * 6, paramId * 6 + 6);
    }, this);
  }
  get rtl() {
    return this._rtl;
  }
  set rangeStart(rangeStart) {
    rangeStart = Math.max(0, Math.min(rangeStart, this._symbols.length));
    if (rangeStart !== this._rangeStart) {
      this._rangeStart = rangeStart;
      this._updateRenderRange();
    }
  }
  get rangeStart() {
    return this._rangeStart;
  }
  set rangeEnd(rangeEnd) {
    rangeEnd = Math.max(this._rangeStart, Math.min(rangeEnd, this._symbols.length));
    if (rangeEnd !== this._rangeEnd) {
      this._rangeEnd = rangeEnd;
      this._updateRenderRange();
    }
  }
  get rangeEnd() {
    return this._rangeEnd;
  }
}

export { TextElement };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dC1lbGVtZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC90ZXh0LWVsZW1lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHN0cmluZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvc3RyaW5nLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnO1xuXG5pbXBvcnQgeyBTRU1BTlRJQ19QT1NJVElPTiwgU0VNQU5USUNfVEVYQ09PUkQwLCBTRU1BTlRJQ19DT0xPUiwgU0VNQU5USUNfQVRUUjgsIFNFTUFOVElDX0FUVFI5LCBUWVBFX0ZMT0FUMzIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVmVydGV4SXRlcmF0b3IgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy92ZXJ0ZXgtaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgR3JhcGhOb2RlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvZ3JhcGgtbm9kZS5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9kZWwuanMnO1xuaW1wb3J0IHsgTWVzaCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2guanMnO1xuXG5pbXBvcnQgeyBMb2NhbGl6ZWRBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LWxvY2FsaXplZC5qcyc7XG5cbmltcG9ydCB7IEZPTlRfQklUTUFQLCBGT05UX01TREYgfSBmcm9tICcuLi8uLi9mb250L2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IE1hcmt1cCB9IGZyb20gJy4vbWFya3VwLmpzJztcblxuY2xhc3MgTWVzaEluZm8ge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICAvLyBudW1iZXIgb2Ygc3ltYm9sc1xuICAgICAgICB0aGlzLmNvdW50ID0gMDtcbiAgICAgICAgLy8gbnVtYmVyIG9mIHF1YWRzIGNyZWF0ZWRcbiAgICAgICAgdGhpcy5xdWFkID0gMDtcbiAgICAgICAgLy8gbnVtYmVyIG9mIHF1YWRzIG9uIHNwZWNpZmljIGxpbmVcbiAgICAgICAgdGhpcy5saW5lcyA9IHt9O1xuICAgICAgICAvLyBmbG9hdCBhcnJheSBmb3IgcG9zaXRpb25zXG4gICAgICAgIHRoaXMucG9zaXRpb25zID0gW107XG4gICAgICAgIC8vIGZsb2F0IGFycmF5IGZvciBub3JtYWxzXG4gICAgICAgIHRoaXMubm9ybWFscyA9IFtdO1xuICAgICAgICAvLyBmbG9hdCBhcnJheSBmb3IgVVZzXG4gICAgICAgIHRoaXMudXZzID0gW107XG4gICAgICAgIC8vIGZsb2F0IGFycmF5IGZvciB2ZXJ0ZXggY29sb3JzXG4gICAgICAgIHRoaXMuY29sb3JzID0gW107XG4gICAgICAgIC8vIGZsb2F0IGFycmF5IGZvciBpbmRpY2VzXG4gICAgICAgIHRoaXMuaW5kaWNlcyA9IFtdO1xuICAgICAgICAvLyBmbG9hdCBhcnJheSBmb3Igb3V0bGluZVxuICAgICAgICB0aGlzLm91dGxpbmVzID0gW107XG4gICAgICAgIC8vIGZsb2F0IGFycmF5IGZvciBzaGFkb3dzXG4gICAgICAgIHRoaXMuc2hhZG93cyA9IFtdO1xuICAgICAgICAvLyBwYy5NZXNoSW5zdGFuY2UgY3JlYXRlZCBmcm9tIHRoaXMgTWVzaEluZm9cbiAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IHRleHQgbWVzaCBvYmplY3QgZnJvbSB0aGUgc3VwcGxpZWQgdmVydGV4IGluZm9ybWF0aW9uIGFuZCB0b3BvbG9neS5cbiAqXG4gKiBAcGFyYW0ge29iamVjdH0gZGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGUgbWVzaC5cbiAqIEBwYXJhbSB7TWVzaEluZm99IFttZXNoSW5mb10gLSBBbiBvYmplY3QgdGhhdCBzcGVjaWZpZXMgb3B0aW9uYWwgaW5wdXRzIGZvciB0aGUgZnVuY3Rpb24gYXMgZm9sbG93czpcbiAqIEByZXR1cm5zIHtNZXNofSBBIG5ldyBNZXNoIGNvbnN0cnVjdGVkIGZyb20gdGhlIHN1cHBsaWVkIHZlcnRleCBhbmQgdHJpYW5nbGUgZGF0YS5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gY3JlYXRlVGV4dE1lc2goZGV2aWNlLCBtZXNoSW5mbykge1xuICAgIGNvbnN0IG1lc2ggPSBuZXcgTWVzaChkZXZpY2UpO1xuXG4gICAgbWVzaC5zZXRQb3NpdGlvbnMobWVzaEluZm8ucG9zaXRpb25zKTtcbiAgICBtZXNoLnNldE5vcm1hbHMobWVzaEluZm8ubm9ybWFscyk7XG4gICAgbWVzaC5zZXRDb2xvcnMzMihtZXNoSW5mby5jb2xvcnMpO1xuICAgIG1lc2guc2V0VXZzKDAsIG1lc2hJbmZvLnV2cyk7XG4gICAgbWVzaC5zZXRJbmRpY2VzKG1lc2hJbmZvLmluZGljZXMpO1xuICAgIG1lc2guc2V0VmVydGV4U3RyZWFtKFNFTUFOVElDX0FUVFI4LCBtZXNoSW5mby5vdXRsaW5lcywgMywgdW5kZWZpbmVkLCBUWVBFX0ZMT0FUMzIsIGZhbHNlKTtcbiAgICBtZXNoLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19BVFRSOSwgbWVzaEluZm8uc2hhZG93cywgMywgdW5kZWZpbmVkLCBUWVBFX0ZMT0FUMzIsIGZhbHNlKTtcblxuICAgIG1lc2gudXBkYXRlKCk7XG4gICAgcmV0dXJuIG1lc2g7XG59XG5cbmNvbnN0IExJTkVfQlJFQUtfQ0hBUiA9IC9eW1xcclxcbl0kLztcbmNvbnN0IFdISVRFU1BBQ0VfQ0hBUiA9IC9eWyBcXHRdJC87XG5jb25zdCBXT1JEX0JPVU5EQVJZX0NIQVIgPSAvXlsgXFx0XFwtXXxbXFx1MjAwYl0kLzsgLy8gTkIgXFx1MjAwYiBpcyB6ZXJvIHdpZHRoIHNwYWNlXG5jb25zdCBBTFBIQU5VTUVSSUNfQ0hBUiA9IC9eW2EtejAtOV0kL2k7XG5cbi8vIDExMDDigJQxMUZGIEhhbmd1bCBKYW1vXG4vLyAzMDAw4oCUMzAzRiBDSksgU3ltYm9scyBhbmQgUHVuY3R1YXRpb24gXFxcbi8vIDMxMzDigJQzMThGIEhhbmd1bCBDb21wYXRpYmlsaXR5IEphbW8gICAgLS0gZ3JvdXBlZFxuLy8gNEUwMOKAlDlGRkYgQ0pLIFVuaWZpZWQgSWRlb2dyYXBocyAgICAgIC9cbi8vIEE5NjDigJRBOTdGIEhhbmd1bCBKYW1vIEV4dGVuZGVkLUFcbi8vIEFDMDDigJREN0FGIEhhbmd1bCBTeWxsYWJsZXNcbi8vIEQ3QjDigJREN0ZGIEhhbmd1bCBKYW1vIEV4dGVuZGVkLUJcbmNvbnN0IENKS19DSEFSID0gL15bXFx1MTEwMC1cXHUxMWZmXXxbXFx1MzAwMC1cXHU5ZmZmXXxbXFx1YTk2MC1cXHVhOTdmXXxbXFx1YWMwMC1cXHVkN2ZmXSQvO1xuY29uc3QgTk9fTElORV9CUkVBS19DSktfQ0hBUiA9IC9eW+OAleOAieOAi+OAjeOAj+OAkeOAmeOAl+OAn+ODveODvuODvOOCoeOCo+OCpeOCp+OCqeODg+ODo+ODpeODp+ODruODteODtuOBgeOBg+OBheOBh+OBieOBo+OCg+OCheOCh+OCjuOCleOCluOHsOOHseOHsuOHs+OHtOOHteOHtuOHt+OHuOOHueOHuuOHu+OHvOOHveOHvuOHv+OAheOAu10kLztcblxuLy8gdW5pY29kZSBiaWRpIGNvbnRyb2wgY2hhcmFjdGVycyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9Vbmljb2RlX2NvbnRyb2xfY2hhcmFjdGVyc1xuY29uc3QgQ09OVFJPTF9DSEFSUyA9IFtcbiAgICAnXFx1MjAwQicsIC8vIHplcm8gd2lkdGggc3BhY2VcbiAgICAnXFx1MDYxQycsXG4gICAgJ1xcdTIwMEUnLFxuICAgICdcXHUyMDBGJyxcbiAgICAnXFx1MjAyQScsXG4gICAgJ1xcdTIwMkInLFxuICAgICdcXHUyMDJDJyxcbiAgICAnXFx1MjAyRCcsXG4gICAgJ1xcdTIwMkUnLFxuICAgICdcXHUyMDY2JyxcbiAgICAnXFx1MjA2NycsXG4gICAgJ1xcdTIwNjgnLFxuICAgICdcXHUyMDY5J1xuXTtcblxuLy8gZ2x5cGggZGF0YSB0byB1c2UgZm9yIG1pc3NpbmcgY29udHJvbCBjaGFyYWN0ZXJzXG5jb25zdCBDT05UUk9MX0dMWVBIX0RBVEEgPSB7XG4gICAgd2lkdGg6IDAsXG4gICAgaGVpZ2h0OiAwLFxuICAgIHhhZHZhbmNlOiAwLFxuICAgIHhvZmZzZXQ6IDAsXG4gICAgeW9mZnNldDogMFxufTtcblxuY29uc3QgY29sb3JUbXAgPSBuZXcgQ29sb3IoKTtcbmNvbnN0IHZlYzJUbXAgPSBuZXcgVmVjMigpO1xuXG5jbGFzcyBUZXh0RWxlbWVudCB7XG4gICAgY29uc3RydWN0b3IoZWxlbWVudCkge1xuICAgICAgICB0aGlzLl9lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgICAgdGhpcy5fc3lzdGVtID0gZWxlbWVudC5zeXN0ZW07XG4gICAgICAgIHRoaXMuX2VudGl0eSA9IGVsZW1lbnQuZW50aXR5O1xuXG4gICAgICAgIC8vIHB1YmxpY1xuICAgICAgICB0aGlzLl90ZXh0ID0gJyc7ICAgICAgICAgICAgLy8gdGhlIG9yaWdpbmFsIHVzZXItZGVmaW5lZCB0ZXh0XG4gICAgICAgIHRoaXMuX3N5bWJvbHMgPSBbXTsgICAgICAgICAvLyBhcnJheSBvZiB2aXNpYmxlIHN5bWJvbHMgd2l0aCB1bmljb2RlIHByb2Nlc3NpbmcgYW5kIG1hcmt1cCByZW1vdmVkXG4gICAgICAgIHRoaXMuX2NvbG9yUGFsZXR0ZSA9IFtdOyAgICAvLyBwZXItc3ltYm9sIGNvbG9yIHBhbGV0dGVcbiAgICAgICAgdGhpcy5fb3V0bGluZVBhbGV0dGUgPSBbXTsgLy8gcGVyLXN5bWJvbCBvdXRsaW5lIGNvbG9yL3RoaWNrbmVzcyBwYWxldHRlXG4gICAgICAgIHRoaXMuX3NoYWRvd1BhbGV0dGUgPSBbXTsgLy8gcGVyLXN5bWJvbCBzaGFkb3cgY29sb3Ivb2Zmc2V0IHBhbGV0dGVcbiAgICAgICAgdGhpcy5fc3ltYm9sQ29sb3JzID0gbnVsbDsgIC8vIHBlci1zeW1ib2wgY29sb3IgaW5kZXhlcy4gb25seSBzZXQgZm9yIHRleHQgd2l0aCBtYXJrdXAuXG4gICAgICAgIHRoaXMuX3N5bWJvbE91dGxpbmVQYXJhbXMgPSBudWxsOyAgLy8gcGVyLXN5bWJvbCBvdXRsaW5lIGNvbG9yL3RoaWNrbmVzcyBpbmRleGVzLiBvbmx5IHNldCBmb3IgdGV4dCB3aXRoIG1hcmt1cC5cbiAgICAgICAgdGhpcy5fc3ltYm9sU2hhZG93UGFyYW1zID0gbnVsbDsgIC8vIHBlci1zeW1ib2wgc2hhZG93IGNvbG9yL29mZnNldCBpbmRleGVzLiBvbmx5IHNldCBmb3IgdGV4dCB3aXRoIG1hcmt1cC5cbiAgICAgICAgdGhpcy5faTE4bktleSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fZm9udEFzc2V0ID0gbmV3IExvY2FsaXplZEFzc2V0KHRoaXMuX3N5c3RlbS5hcHApO1xuICAgICAgICB0aGlzLl9mb250QXNzZXQuZGlzYWJsZUxvY2FsaXphdGlvbiA9IHRydWU7XG4gICAgICAgIHRoaXMuX2ZvbnRBc3NldC5vbignbG9hZCcsIHRoaXMuX29uRm9udExvYWQsIHRoaXMpO1xuICAgICAgICB0aGlzLl9mb250QXNzZXQub24oJ2NoYW5nZScsIHRoaXMuX29uRm9udENoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2ZvbnRBc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25Gb250UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICB0aGlzLl9mb250ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9jb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgzKTtcblxuICAgICAgICB0aGlzLl9zcGFjaW5nID0gMTtcbiAgICAgICAgdGhpcy5fZm9udFNpemUgPSAzMjtcbiAgICAgICAgdGhpcy5fZm9udE1pblkgPSAwO1xuICAgICAgICB0aGlzLl9mb250TWF4WSA9IDA7XG4gICAgICAgIC8vIHRoZSBmb250IHNpemUgdGhhdCBpcyBzZXQgZGlyZWN0bHkgYnkgdGhlIGZvbnRTaXplIHNldHRlclxuICAgICAgICB0aGlzLl9vcmlnaW5hbEZvbnRTaXplID0gMzI7XG4gICAgICAgIHRoaXMuX21heEZvbnRTaXplID0gMzI7XG4gICAgICAgIHRoaXMuX21pbkZvbnRTaXplID0gODtcbiAgICAgICAgdGhpcy5fYXV0b0ZpdFdpZHRoID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2F1dG9GaXRIZWlnaHQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fbWF4TGluZXMgPSAtMTtcbiAgICAgICAgdGhpcy5fbGluZUhlaWdodCA9IDMyO1xuICAgICAgICB0aGlzLl9zY2FsZWRMaW5lSGVpZ2h0ID0gMzI7XG4gICAgICAgIHRoaXMuX3dyYXBMaW5lcyA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IDA7XG5cbiAgICAgICAgdGhpcy5fYWxpZ25tZW50ID0gbmV3IFZlYzIoMC41LCAwLjUpO1xuXG4gICAgICAgIHRoaXMuX2F1dG9XaWR0aCA9IHRydWU7XG4gICAgICAgIHRoaXMuX2F1dG9IZWlnaHQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMud2lkdGggPSAwO1xuICAgICAgICB0aGlzLmhlaWdodCA9IDA7XG5cbiAgICAgICAgLy8gcHJpdmF0ZVxuICAgICAgICB0aGlzLl9ub2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuICAgICAgICB0aGlzLl9tb2RlbCA9IG5ldyBNb2RlbCgpO1xuICAgICAgICB0aGlzLl9tb2RlbC5ncmFwaCA9IHRoaXMuX25vZGU7XG4gICAgICAgIHRoaXMuX2VudGl0eS5hZGRDaGlsZCh0aGlzLl9ub2RlKTtcblxuICAgICAgICB0aGlzLl9tZXNoSW5mbyA9IFtdO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fYWFiYkRpcnR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fYWFiYiA9IG5ldyBCb3VuZGluZ0JveCgpO1xuXG4gICAgICAgIHRoaXMuX25vUmVzaXplID0gZmFsc2U7IC8vIGZsYWcgdXNlZCB0byBkaXNhYmxlIHJlc2l6aW5nIGV2ZW50c1xuXG4gICAgICAgIHRoaXMuX2N1cnJlbnRNYXRlcmlhbFR5cGUgPSBudWxsOyAvLyBzYXZlIHRoZSBtYXRlcmlhbCB0eXBlIChzY3JlZW5zcGFjZSBvciBub3QpIHRvIHByZXZlbnQgb3ZlcndyaXRpbmdcbiAgICAgICAgdGhpcy5fbWFza2VkTWF0ZXJpYWxTcmMgPSBudWxsOyAvLyBzYXZlZCBtYXRlcmlhbCB0aGF0IHdhcyBhc3NpZ25lZCBiZWZvcmUgZWxlbWVudCB3YXMgbWFza2VkXG5cbiAgICAgICAgdGhpcy5fcnRsUmVvcmRlciA9IGZhbHNlO1xuICAgICAgICB0aGlzLl91bmljb2RlQ29udmVydGVyID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3J0bCA9IGZhbHNlOyAgICAgICAgICAgICAgLy8gdHJ1ZSB3aGVuIHRoZSBjdXJyZW50IHRleHQgaXMgUlRMXG5cbiAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yID0gbmV3IENvbG9yKDAsIDAsIDAsIDEpO1xuICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3JVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5fb3V0bGluZVRoaWNrbmVzc1NjYWxlID0gMC4yOyAvLyAwLjIgY29lZmZpY2llbnQgdG8gbWFwIGVkaXRvciByYW5nZSBvZiAwIC0gMSB0byBzaGFkZXIgdmFsdWVcbiAgICAgICAgdGhpcy5fb3V0bGluZVRoaWNrbmVzcyA9IDAuMDtcblxuICAgICAgICB0aGlzLl9zaGFkb3dDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwLCAxKTtcbiAgICAgICAgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0U2NhbGUgPSAwLjAwNTsgLy8gbWFwcyB0aGUgZWRpdG9yIHNjYWxlIHZhbHVlIHRvIHNoYWRlciBzY2FsZVxuICAgICAgICB0aGlzLl9zaGFkb3dPZmZzZXQgPSBuZXcgVmVjMigwLCAwKTtcbiAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG5cbiAgICAgICAgdGhpcy5fZW5hYmxlTWFya3VwID0gZmFsc2U7XG5cbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBiYXNlZCBvbiBzY3JlZW5cbiAgICAgICAgdGhpcy5fb25TY3JlZW5DaGFuZ2UodGhpcy5fZWxlbWVudC5zY3JlZW4pO1xuXG4gICAgICAgIC8vIHN0YXJ0IGxpc3RlbmluZyBmb3IgZWxlbWVudCBldmVudHNcbiAgICAgICAgZWxlbWVudC5vbigncmVzaXplJywgdGhpcy5fb25QYXJlbnRSZXNpemUsIHRoaXMpO1xuICAgICAgICBlbGVtZW50Lm9uKCdzZXQ6c2NyZWVuJywgdGhpcy5fb25TY3JlZW5DaGFuZ2UsIHRoaXMpO1xuICAgICAgICBlbGVtZW50Lm9uKCdzY3JlZW46c2V0OnNjcmVlbnNwYWNlJywgdGhpcy5fb25TY3JlZW5TcGFjZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGVsZW1lbnQub24oJ3NldDpkcmF3b3JkZXInLCB0aGlzLl9vbkRyYXdPcmRlckNoYW5nZSwgdGhpcyk7XG4gICAgICAgIGVsZW1lbnQub24oJ3NldDpwaXZvdCcsIHRoaXMuX29uUGl2b3RDaGFuZ2UsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuaTE4bi5vbignc2V0OmxvY2FsZScsIHRoaXMuX29uTG9jYWxlU2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5pMThuLm9uKCdkYXRhOmFkZCcsIHRoaXMuX29uTG9jYWxpemF0aW9uRGF0YSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuaTE4bi5vbignZGF0YTpyZW1vdmUnLCB0aGlzLl9vbkxvY2FsaXphdGlvbkRhdGEsIHRoaXMpO1xuXG4gICAgICAgIC8vIHN1YnN0cmluZyByZW5kZXIgcmFuZ2VcbiAgICAgICAgdGhpcy5fcmFuZ2VTdGFydCA9IDA7XG4gICAgICAgIHRoaXMuX3JhbmdlRW5kID0gMDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbChudWxsKTsgLy8gY2xlYXIgbWF0ZXJpYWwgZnJvbSBtZXNoIGluc3RhbmNlc1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5yZW1vdmVNb2RlbEZyb21MYXllcnModGhpcy5fbW9kZWwpO1xuICAgICAgICAgICAgdGhpcy5fbW9kZWwuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5fbW9kZWwgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZm9udEFzc2V0LmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5mb250ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZigncmVzaXplJywgdGhpcy5fb25QYXJlbnRSZXNpemUsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2V0OnNjcmVlbicsIHRoaXMuX29uU2NyZWVuQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NjcmVlbjpzZXQ6c2NyZWVuc3BhY2UnLCB0aGlzLl9vblNjcmVlblNwYWNlQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NldDpkcmF3b3JkZXInLCB0aGlzLl9vbkRyYXdPcmRlckNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzZXQ6cGl2b3QnLCB0aGlzLl9vblBpdm90Q2hhbmdlLCB0aGlzKTtcblxuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmkxOG4ub2ZmKCdzZXQ6bG9jYWxlJywgdGhpcy5fb25Mb2NhbGVTZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmkxOG4ub2ZmKCdkYXRhOmFkZCcsIHRoaXMuX29uTG9jYWxpemF0aW9uRGF0YSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuaTE4bi5vZmYoJ2RhdGE6cmVtb3ZlJywgdGhpcy5fb25Mb2NhbGl6YXRpb25EYXRhLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25QYXJlbnRSZXNpemUod2lkdGgsIGhlaWdodCkge1xuICAgICAgICBpZiAodGhpcy5fbm9SZXNpemUpIHJldHVybjtcbiAgICAgICAgaWYgKHRoaXMuX2ZvbnQpIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICB9XG5cbiAgICBfb25TY3JlZW5DaGFuZ2Uoc2NyZWVuKSB7XG4gICAgICAgIGlmIChzY3JlZW4pIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlbi5zY3JlZW4uc2NyZWVuU3BhY2UpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoZmFsc2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2NyZWVuU3BhY2VDaGFuZ2UodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwodmFsdWUpO1xuICAgIH1cblxuICAgIF9vbkRyYXdPcmRlckNoYW5nZShvcmRlcikge1xuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSBvcmRlcjtcblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlc1tpXS5kcmF3T3JkZXIgPSBvcmRlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblBpdm90Q2hhbmdlKHBpdm90KSB7XG4gICAgICAgIGlmICh0aGlzLl9mb250KVxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgIH1cblxuICAgIF9vbkxvY2FsZVNldChsb2NhbGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9pMThuS2V5KSByZXR1cm47XG5cbiAgICAgICAgLy8gaWYgdGhlIGxvY2FsaXplZCBmb250IGlzIGRpZmZlcmVudFxuICAgICAgICAvLyB0aGVuIHRoZSBjdXJyZW50IGZvbnQgYW5kIHRoZSBsb2NhbGl6ZWQgZm9udFxuICAgICAgICAvLyBpcyBub3QgeWV0IGxvYWRlZCB0aGVuIHJlc2V0IHRoZSBjdXJyZW50IGZvbnQgYW5kIHdhaXRcbiAgICAgICAgLy8gdW50aWwgdGhlIGxvY2FsaXplZCBmb250IGlzIGxvYWRlZCB0byBzZWUgdGhlIHVwZGF0ZWQgdGV4dFxuICAgICAgICBpZiAodGhpcy5mb250QXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuZm9udEFzc2V0KTtcbiAgICAgICAgICAgIGlmICghYXNzZXQgfHwgIWFzc2V0LnJlc291cmNlIHx8IGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl9mb250KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mb250ID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3Jlc2V0TG9jYWxpemVkVGV4dCgpO1xuICAgIH1cblxuICAgIF9vbkxvY2FsaXphdGlvbkRhdGEobG9jYWxlLCBtZXNzYWdlcykge1xuICAgICAgICBpZiAodGhpcy5faTE4bktleSAmJiBtZXNzYWdlc1t0aGlzLl9pMThuS2V5XSkge1xuICAgICAgICAgICAgdGhpcy5fcmVzZXRMb2NhbGl6ZWRUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVzZXRMb2NhbGl6ZWRUZXh0KCkge1xuICAgICAgICB0aGlzLl9zZXRUZXh0KHRoaXMuX3N5c3RlbS5hcHAuaTE4bi5nZXRUZXh0KHRoaXMuX2kxOG5LZXkpKTtcbiAgICB9XG5cbiAgICBfc2V0VGV4dCh0ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLnVuaWNvZGVDb252ZXJ0ZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHVuaWNvZGVDb252ZXJ0ZXJGdW5jID0gdGhpcy5fc3lzdGVtLmdldFVuaWNvZGVDb252ZXJ0ZXIoKTtcbiAgICAgICAgICAgIGlmICh1bmljb2RlQ29udmVydGVyRnVuYykge1xuICAgICAgICAgICAgICAgIHRleHQgPSB1bmljb2RlQ29udmVydGVyRnVuYyh0ZXh0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdFbGVtZW50IGNyZWF0ZWQgd2l0aCB1bmljb2RlQ29udmVydGVyIG9wdGlvbiBidXQgbm8gdW5pY29kZUNvbnZlcnRlciBmdW5jdGlvbiByZWdpc3RlcmVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdGV4dCAhPT0gdGV4dCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KHRleHQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fdGV4dCA9IHRleHQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlVGV4dCh0ZXh0KSB7XG4gICAgICAgIGxldCB0YWdzO1xuXG4gICAgICAgIGlmICh0ZXh0ID09PSB1bmRlZmluZWQpIHRleHQgPSB0aGlzLl90ZXh0O1xuXG4gICAgICAgIC8vIGdldCB0aGUgbGlzdCBvZiBzeW1ib2xzXG4gICAgICAgIC8vIE5PVEU6IHdlIG11c3Qgbm9ybWFsaXplIHRleHQgaGVyZSBpbiBvcmRlciB0byBiZSBjb25zaXN0ZW50IHdpdGggdGhlIG51bWJlciBvZlxuICAgICAgICAvLyBzeW1ib2xzIHJldHVybmVkIGZyb20gdGhlIGJpZGkgYWxnb3JpdGhtLiBJZiB3ZSBkb24ndCwgdGhlbiBpbiBzb21lIGNhc2VzIGJpZGlcbiAgICAgICAgLy8gcmV0dXJucyBhIGRpZmZlcmVudCBudW1iZXIgb2YgUlRMIGNvZGVzIHRvIHdoYXQgd2UgZXhwZWN0LlxuICAgICAgICAvLyBOT1RFOiBJRSBkb2Vzbid0IHN1cHBvcnQgc3RyaW5nLm5vcm1hbGl6ZSgpLCBzbyB3ZSBtdXN0IGNoZWNrIGZvciBpdHMgZXhpc3RlbmNlXG4gICAgICAgIC8vIGJlZm9yZSBpbnZva2luZy5cbiAgICAgICAgdGhpcy5fc3ltYm9scyA9IHN0cmluZy5nZXRTeW1ib2xzKHRleHQubm9ybWFsaXplID8gdGV4dC5ub3JtYWxpemUoJ05GQycpIDogdGV4dCk7XG5cbiAgICAgICAgLy8gaGFuZGxlIG51bGwgc3RyaW5nXG4gICAgICAgIGlmICh0aGlzLl9zeW1ib2xzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fc3ltYm9scyA9IFsnICddO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZXh0cmFjdCBtYXJrdXBcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZU1hcmt1cCkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IE1hcmt1cC5ldmFsdWF0ZSh0aGlzLl9zeW1ib2xzKTtcbiAgICAgICAgICAgIHRoaXMuX3N5bWJvbHMgPSByZXN1bHRzLnN5bWJvbHM7XG4gICAgICAgICAgICAvLyBOT1RFOiBpZiByZXN1bHRzLnRhZ3MgaXMgbnVsbCwgd2UgYXNzaWduIFtdIHRvIGluY3JlYXNlXG4gICAgICAgICAgICAvLyBwcm9iYWJpbGl0eSBvZiBiYXRjaGluZy4gU28sIGlmIGEgdXNlciB3YW50IHRvIHVzZSBhcyBsZXNzXG4gICAgICAgICAgICAvLyBXZWJHTCBidWZmZXJzIG1lbW9yeSBhcyBwb3NzaWJsZSB0aGV5IGNhbiBqdXN0IGRpc2FibGUgbWFya3Vwcy5cbiAgICAgICAgICAgIHRhZ3MgPSByZXN1bHRzLnRhZ3MgfHwgW107XG4gICAgICAgIH1cblxuICAgICAgICAvLyBoYW5kbGUgTFRSIHZzIFJUTCBvcmRlcmluZ1xuICAgICAgICBpZiAodGhpcy5fcnRsUmVvcmRlcikge1xuICAgICAgICAgICAgY29uc3QgcnRsUmVvcmRlckZ1bmMgPSB0aGlzLl9zeXN0ZW0uYXBwLnN5c3RlbXMuZWxlbWVudC5nZXRSdGxSZW9yZGVyKCk7XG4gICAgICAgICAgICBpZiAocnRsUmVvcmRlckZ1bmMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHRzID0gcnRsUmVvcmRlckZ1bmModGhpcy5fc3ltYm9scyk7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9ydGwgPSByZXN1bHRzLnJ0bDtcblxuICAgICAgICAgICAgICAgIC8vIHJlb3JkZXIgc3ltYm9scyBhY2NvcmRpbmcgdG8gdW5pY29kZSByZW9yZGVyIG1hcHBpbmdcbiAgICAgICAgICAgICAgICB0aGlzLl9zeW1ib2xzID0gcmVzdWx0cy5tYXBwaW5nLm1hcChmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc3ltYm9sc1t2XTtcbiAgICAgICAgICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICAgICAgICAgIC8vIHJlb3JkZXIgdGFncyBpZiB0aGV5IGV4aXN0LCBhY2NvcmRpbmcgdG8gdW5pY29kZSByZW9yZGVyIG1hcHBpbmdcbiAgICAgICAgICAgICAgICBpZiAodGFncykge1xuICAgICAgICAgICAgICAgICAgICB0YWdzID0gcmVzdWx0cy5tYXBwaW5nLm1hcChmdW5jdGlvbiAodikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhZ3Nbdl07XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdFbGVtZW50IGNyZWF0ZWQgd2l0aCBydGxSZW9yZGVyIG9wdGlvbiBidXQgbm8gcnRsUmVvcmRlciBmdW5jdGlvbiByZWdpc3RlcmVkJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9ydGwgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGdldENvbG9yVGhpY2tuZXNzSGFzaCA9IChjb2xvciwgdGhpY2tuZXNzKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYCR7Y29sb3IudG9TdHJpbmcodHJ1ZSkudG9Mb3dlckNhc2UoKX06JHtcbiAgICAgICAgICAgICAgICB0aGlja25lc3MudG9GaXhlZCgyKVxuICAgICAgICAgICAgfWA7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgZ2V0Q29sb3JPZmZzZXRIYXNoID0gKGNvbG9yLCBvZmZzZXQpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBgJHtjb2xvci50b1N0cmluZyh0cnVlKS50b0xvd2VyQ2FzZSgpfToke1xuICAgICAgICAgICAgICAgIG9mZnNldC54LnRvRml4ZWQoMilcbiAgICAgICAgICAgIH06JHtcbiAgICAgICAgICAgICAgICBvZmZzZXQueS50b0ZpeGVkKDIpXG4gICAgICAgICAgICB9YDtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyByZXNvbHZlIGNvbG9yLCBvdXRsaW5lLCBhbmQgc2hhZG93IHRhZ3NcbiAgICAgICAgaWYgKHRhZ3MpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhbGV0dGVNYXAgPSB7IH07XG4gICAgICAgICAgICBjb25zdCBvdXRsaW5lUGFsZXR0ZU1hcCA9IHsgfTtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRvd1BhbGV0dGVNYXAgPSB7IH07XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIGZhbGxiYWNrIGNvbG9yIGluIHRoZSBwYWxldHRlXG4gICAgICAgICAgICB0aGlzLl9jb2xvclBhbGV0dGUgPSBbXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9jb2xvci5yICogMjU1KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX2NvbG9yLmcgKiAyNTUpLFxuICAgICAgICAgICAgICAgIE1hdGgucm91bmQodGhpcy5fY29sb3IuYiAqIDI1NSlcbiAgICAgICAgICAgIF07XG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lUGFsZXR0ZSA9IFtcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX291dGxpbmVDb2xvci5yICogMjU1KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX291dGxpbmVDb2xvci5nICogMjU1KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX291dGxpbmVDb2xvci5iICogMjU1KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX291dGxpbmVDb2xvci5hICogMjU1KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX291dGxpbmVUaGlja25lc3MgKiAyNTUpXG4gICAgICAgICAgICBdO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93UGFsZXR0ZSA9IFtcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX3NoYWRvd0NvbG9yLnIgKiAyNTUpLFxuICAgICAgICAgICAgICAgIE1hdGgucm91bmQodGhpcy5fc2hhZG93Q29sb3IuZyAqIDI1NSksXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9zaGFkb3dDb2xvci5iICogMjU1KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX3NoYWRvd0NvbG9yLmEgKiAyNTUpLFxuICAgICAgICAgICAgICAgIE1hdGgucm91bmQodGhpcy5fc2hhZG93T2Zmc2V0LnggKiAxMjcpLFxuICAgICAgICAgICAgICAgIE1hdGgucm91bmQodGhpcy5fc2hhZG93T2Zmc2V0LnkgKiAxMjcpXG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICB0aGlzLl9zeW1ib2xDb2xvcnMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuX3N5bWJvbE91dGxpbmVQYXJhbXMgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuX3N5bWJvbFNoYWRvd1BhcmFtcyA9IFtdO1xuXG4gICAgICAgICAgICBwYWxldHRlTWFwW3RoaXMuX2NvbG9yLnRvU3RyaW5nKGZhbHNlKS50b0xvd2VyQ2FzZSgpXSA9IDA7XG4gICAgICAgICAgICBvdXRsaW5lUGFsZXR0ZU1hcFtcbiAgICAgICAgICAgICAgICBnZXRDb2xvclRoaWNrbmVzc0hhc2godGhpcy5fb3V0bGluZUNvbG9yLCB0aGlzLl9vdXRsaW5lVGhpY2tuZXNzKVxuICAgICAgICAgICAgXSA9IDA7XG4gICAgICAgICAgICBzaGFkb3dQYWxldHRlTWFwW1xuICAgICAgICAgICAgICAgIGdldENvbG9yT2Zmc2V0SGFzaCh0aGlzLl9zaGFkb3dDb2xvciwgdGhpcy5fc2hhZG93T2Zmc2V0KVxuICAgICAgICAgICAgXSA9IDA7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9zeW1ib2xzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFnID0gdGFnc1tpXTtcbiAgICAgICAgICAgICAgICBsZXQgY29sb3IgPSAwO1xuXG4gICAgICAgICAgICAgICAgLy8gZ2V0IG1hcmt1cCBjb2xvcmluZ1xuICAgICAgICAgICAgICAgIGlmICh0YWcgJiYgdGFnLmNvbG9yICYmIHRhZy5jb2xvci52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjID0gdGFnLmNvbG9yLnZhbHVlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlc29sdmUgY29sb3IgZGljdGlvbmFyeSBuYW1lc1xuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPOiBpbXBsZW1lbnQgdGhlIGRpY3Rpb25hcnkgb2YgY29sb3JzXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIChjb2xvckRpY3QuaGFzT3duUHJvcGVydHkoYykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgYyA9IGRpY3RbY107XG4gICAgICAgICAgICAgICAgICAgIC8vIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBjb252ZXJ0IGhleCBjb2xvclxuICAgICAgICAgICAgICAgICAgICBpZiAoYy5sZW5ndGggPT09IDcgJiYgY1swXSA9PT0gJyMnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoZXggPSBjLnN1YnN0cmluZygxKS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFsZXR0ZU1hcC5oYXNPd25Qcm9wZXJ0eShoZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY29sb3IgaXMgYWxyZWFkeSBpbiB0aGUgcGFsZXR0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gcGFsZXR0ZU1hcFtoZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoL14oWzAtOWEtZl17Mn0pezN9JC8udGVzdChoZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5ldyBjb2xvclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9IHRoaXMuX2NvbG9yUGFsZXR0ZS5sZW5ndGggLyAzO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYWxldHRlTWFwW2hleF0gPSBjb2xvcjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29sb3JQYWxldHRlLnB1c2gocGFyc2VJbnQoaGV4LnN1YnN0cmluZygwLCAyKSwgMTYpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29sb3JQYWxldHRlLnB1c2gocGFyc2VJbnQoaGV4LnN1YnN0cmluZygyLCA0KSwgMTYpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fY29sb3JQYWxldHRlLnB1c2gocGFyc2VJbnQoaGV4LnN1YnN0cmluZyg0LCA2KSwgMTYpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5fc3ltYm9sQ29sb3JzLnB1c2goY29sb3IpO1xuXG4gICAgICAgICAgICAgICAgbGV0IG91dGxpbmUgPSAwO1xuXG4gICAgICAgICAgICAgICAgLy8gZ2V0IG1hcmt1cCBvdXRsaW5lXG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICB0YWcgJiZcbiAgICAgICAgICAgICAgICAgICAgdGFnLm91dGxpbmUgJiZcbiAgICAgICAgICAgICAgICAgICAgKHRhZy5vdXRsaW5lLmF0dHJpYnV0ZXMuY29sb3IgfHwgdGFnLm91dGxpbmUuYXR0cmlidXRlcy50aGlja25lc3MpXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBjb2xvciA9IHRhZy5vdXRsaW5lLmF0dHJpYnV0ZXMuY29sb3IgP1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JUbXAuZnJvbVN0cmluZyh0YWcub3V0bGluZS5hdHRyaWJ1dGVzLmNvbG9yKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3I7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IHRoaWNrbmVzcyA9IE51bWJlcih0YWcub3V0bGluZS5hdHRyaWJ1dGVzLnRoaWNrbmVzcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgTnVtYmVyLmlzTmFOKGNvbG9yLnIpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBOdW1iZXIuaXNOYU4oY29sb3IuZykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIE51bWJlci5pc05hTihjb2xvci5iKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgTnVtYmVyLmlzTmFOKGNvbG9yLmEpXG4gICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSB0aGlzLl9vdXRsaW5lQ29sb3I7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoTnVtYmVyLmlzTmFOKHRoaWNrbmVzcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaWNrbmVzcyA9IHRoaXMuX291dGxpbmVUaGlja25lc3M7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBvdXRsaW5lSGFzaCA9IGdldENvbG9yVGhpY2tuZXNzSGFzaChjb2xvciwgdGhpY2tuZXNzKTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAob3V0bGluZVBhbGV0dGVNYXAuaGFzT3duUHJvcGVydHkob3V0bGluZUhhc2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBvdXRsaW5lIHBhcmFtZXRlcnMgaXMgYWxyZWFkeSBpbiB0aGUgcGFsZXR0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgb3V0bGluZSA9IG91dGxpbmVQYWxldHRlTWFwW291dGxpbmVIYXNoXTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG5ldyBvdXRsaW5lIHBhcmFtZXRlciBpbmRleCwgNSB+IChyLCBnLCBiLCBhLCB0aGlja25lc3MpXG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRsaW5lID0gdGhpcy5fb3V0bGluZVBhbGV0dGUubGVuZ3RoIC8gNTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dGxpbmVQYWxldHRlTWFwW291dGxpbmVIYXNoXSA9IG91dGxpbmU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX291dGxpbmVQYWxldHRlLnB1c2goXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZChjb2xvci5yICogMjU1KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKGNvbG9yLmcgKiAyNTUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQoY29sb3IuYiAqIDI1NSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZChjb2xvci5hICogMjU1KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaWNrbmVzcyAqIDI1NSlcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9zeW1ib2xPdXRsaW5lUGFyYW1zLnB1c2gob3V0bGluZSk7XG5cbiAgICAgICAgICAgICAgICBsZXQgc2hhZG93ID0gMDtcblxuICAgICAgICAgICAgICAgIC8vIGdldCBtYXJrdXAgc2hhZG93XG4gICAgICAgICAgICAgICAgaWYgKHRhZyAmJiB0YWcuc2hhZG93ICYmIChcbiAgICAgICAgICAgICAgICAgICAgdGFnLnNoYWRvdy5hdHRyaWJ1dGVzLmNvbG9yIHx8XG4gICAgICAgICAgICAgICAgICAgIHRhZy5zaGFkb3cuYXR0cmlidXRlcy5vZmZzZXQgfHxcbiAgICAgICAgICAgICAgICAgICAgdGFnLnNoYWRvdy5hdHRyaWJ1dGVzLm9mZnNldFggfHxcbiAgICAgICAgICAgICAgICAgICAgdGFnLnNoYWRvdy5hdHRyaWJ1dGVzLm9mZnNldFlcbiAgICAgICAgICAgICAgICApKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBjb2xvciA9IHRhZy5zaGFkb3cuYXR0cmlidXRlcy5jb2xvciA/XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvclRtcC5mcm9tU3RyaW5nKHRhZy5zaGFkb3cuYXR0cmlidXRlcy5jb2xvcikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93Q29sb3I7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2ZmID0gTnVtYmVyKHRhZy5zaGFkb3cuYXR0cmlidXRlcy5vZmZzZXQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvZmZYID0gTnVtYmVyKHRhZy5zaGFkb3cuYXR0cmlidXRlcy5vZmZzZXRYKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2ZmWSA9IE51bWJlcih0YWcuc2hhZG93LmF0dHJpYnV0ZXMub2Zmc2V0WSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgTnVtYmVyLmlzTmFOKGNvbG9yLnIpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBOdW1iZXIuaXNOYU4oY29sb3IuZykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIE51bWJlci5pc05hTihjb2xvci5iKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgTnVtYmVyLmlzTmFOKGNvbG9yLmEpXG4gICAgICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSB0aGlzLl9zaGFkb3dDb2xvcjtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9mZnNldCA9IHZlYzJUbXAuc2V0KFxuICAgICAgICAgICAgICAgICAgICAgICAgIU51bWJlci5pc05hTihvZmZYKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2ZmWCA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIU51bWJlci5pc05hTihvZmYpID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2ZmIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0LngsXG4gICAgICAgICAgICAgICAgICAgICAgICAhTnVtYmVyLmlzTmFOKG9mZlkpID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmZZIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAhTnVtYmVyLmlzTmFOKG9mZikgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZmYgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dPZmZzZXQueVxuICAgICAgICAgICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoYWRvd0hhc2ggPSBnZXRDb2xvck9mZnNldEhhc2goY29sb3IsIG9mZnNldCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKHNoYWRvd1BhbGV0dGVNYXAuaGFzT3duUHJvcGVydHkoc2hhZG93SGFzaCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHNoYWRvdyBwYXJhbWV0ZXJzIGlzIGFscmVhZHkgaW4gdGhlIHBhbGV0dGVcbiAgICAgICAgICAgICAgICAgICAgICAgIHNoYWRvdyA9IHNoYWRvd1BhbGV0dGVNYXBbc2hhZG93SGFzaF07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBuZXcgc2hhZG93IHBhcmFtZXRlciBpbmRleCwgNiB+IChyLCBnLCBiLCBhLCBvZmZzZXQueCwgb2Zmc2V0LnkpXG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3cgPSB0aGlzLl9zaGFkb3dQYWxldHRlLmxlbmd0aCAvIDY7XG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dQYWxldHRlTWFwW3NoYWRvd0hhc2hdID0gc2hhZG93O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dQYWxldHRlLnB1c2goXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZChjb2xvci5yICogMjU1KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKGNvbG9yLmcgKiAyNTUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQoY29sb3IuYiAqIDI1NSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZChjb2xvci5hICogMjU1KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKG9mZnNldC54ICogMTI3KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKG9mZnNldC55ICogMTI3KVxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX3N5bWJvbFNoYWRvd1BhcmFtcy5wdXNoKHNoYWRvdyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyB0YWdzLCB0aGVyZWZvcmUgbm8gcGVyLXN5bWJvbCBjb2xvcnNcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yUGFsZXR0ZSA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fc3ltYm9sQ29sb3JzID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3N5bWJvbE91dGxpbmVQYXJhbXMgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fc3ltYm9sU2hhZG93UGFyYW1zID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsRW1pc3NpdmUoKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWxPdXRsaW5lKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsU2hhZG93KCk7XG5cbiAgICAgICAgY29uc3QgY2hhcmFjdGVyc1BlclRleHR1cmUgPSB0aGlzLl9jYWxjdWxhdGVDaGFyc1BlclRleHR1cmUoKTtcblxuICAgICAgICBsZXQgcmVtb3ZlZE1vZGVsID0gZmFsc2U7XG5cbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHNjcmVlblNwYWNlID0gZWxlbWVudC5faXNTY3JlZW5TcGFjZSgpO1xuICAgICAgICBjb25zdCBzY3JlZW5DdWxsZWQgPSBlbGVtZW50Ll9pc1NjcmVlbkN1bGxlZCgpO1xuICAgICAgICBjb25zdCB2aXNpYmxlRm4gPSBmdW5jdGlvbiAoY2FtZXJhKSB7XG4gICAgICAgICAgICByZXR1cm4gZWxlbWVudC5pc1Zpc2libGVGb3JDYW1lcmEoY2FtZXJhKTtcbiAgICAgICAgfTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbWVzaEluZm8ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGwgPSBjaGFyYWN0ZXJzUGVyVGV4dHVyZVtpXSB8fCAwO1xuICAgICAgICAgICAgY29uc3QgbWVzaEluZm8gPSB0aGlzLl9tZXNoSW5mb1tpXTtcblxuICAgICAgICAgICAgaWYgKG1lc2hJbmZvLmNvdW50ICE9PSBsKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdmVkTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVNb2RlbEZyb21MYXllcnModGhpcy5fbW9kZWwpO1xuICAgICAgICAgICAgICAgICAgICByZW1vdmVkTW9kZWwgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvdW50ID0gbDtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnMubGVuZ3RoID0gbWVzaEluZm8ubm9ybWFscy5sZW5ndGggPSBsICogMyAqIDQ7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uaW5kaWNlcy5sZW5ndGggPSBsICogMyAqIDI7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8udXZzLmxlbmd0aCA9IGwgKiAyICogNDtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnMubGVuZ3RoID0gbCAqIDQgKiA0O1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLm91dGxpbmVzLmxlbmd0aCA9IGwgKiA0ICogMztcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzLmxlbmd0aCA9IGwgKiA0ICogMztcblxuICAgICAgICAgICAgICAgIC8vIGRlc3Ryb3kgb2xkIG1lc2hcbiAgICAgICAgICAgICAgICBpZiAobWVzaEluZm8ubWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZU1lc2hJbnN0YW5jZShtZXNoSW5mby5tZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGlmIHRoZXJlIGFyZSBubyBsZXR0ZXJzIGZvciB0aGlzIG1lc2ggY29udGludWVcbiAgICAgICAgICAgICAgICBpZiAobCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5tZXNoSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgdXAgaW5kaWNlcyBhbmQgbm9ybWFscyB3aG9zZSB2YWx1ZXMgZG9uJ3QgY2hhbmdlIHdoZW4gd2UgY2FsbCBfdXBkYXRlTWVzaGVzXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgdiA9IDA7IHYgPCBsOyB2KyspIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gY3JlYXRlIGluZGV4IGFuZCBub3JtYWwgYXJyYXlzIHNpbmNlIHRoZXkgZG9uJ3QgY2hhbmdlXG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBsZW5ndGggZG9lc24ndCBjaGFuZ2VcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8uaW5kaWNlc1t2ICogMyAqIDIgKyAwXSA9IHYgKiA0O1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5pbmRpY2VzW3YgKiAzICogMiArIDFdID0gdiAqIDQgKyAxO1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5pbmRpY2VzW3YgKiAzICogMiArIDJdID0gdiAqIDQgKyAzO1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5pbmRpY2VzW3YgKiAzICogMiArIDNdID0gdiAqIDQgKyAyO1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5pbmRpY2VzW3YgKiAzICogMiArIDRdID0gdiAqIDQgKyAzO1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5pbmRpY2VzW3YgKiAzICogMiArIDVdID0gdiAqIDQgKyAxO1xuXG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLm5vcm1hbHNbdiAqIDQgKiAzICsgMF0gPSAwO1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5ub3JtYWxzW3YgKiA0ICogMyArIDFdID0gMDtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8ubm9ybWFsc1t2ICogNCAqIDMgKyAyXSA9IC0xO1xuXG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLm5vcm1hbHNbdiAqIDQgKiAzICsgM10gPSAwO1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5ub3JtYWxzW3YgKiA0ICogMyArIDRdID0gMDtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8ubm9ybWFsc1t2ICogNCAqIDMgKyA1XSA9IC0xO1xuXG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLm5vcm1hbHNbdiAqIDQgKiAzICsgNl0gPSAwO1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5ub3JtYWxzW3YgKiA0ICogMyArIDddID0gMDtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8ubm9ybWFsc1t2ICogNCAqIDMgKyA4XSA9IC0xO1xuXG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLm5vcm1hbHNbdiAqIDQgKiAzICsgOV0gPSAwO1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5ub3JtYWxzW3YgKiA0ICogMyArIDEwXSA9IDA7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLm5vcm1hbHNbdiAqIDQgKiAzICsgMTFdID0gLTE7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IGNyZWF0ZVRleHRNZXNoKHRoaXMuX3N5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2UsIG1lc2hJbmZvKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gbmV3IE1lc2hJbnN0YW5jZShtZXNoLCB0aGlzLl9tYXRlcmlhbCwgdGhpcy5fbm9kZSk7XG4gICAgICAgICAgICAgICAgbWkubmFtZSA9ICdUZXh0IEVsZW1lbnQ6ICcgKyB0aGlzLl9lbnRpdHkubmFtZTtcbiAgICAgICAgICAgICAgICBtaS5jYXN0U2hhZG93ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgbWkucmVjZWl2ZVNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIG1pLmN1bGwgPSAhc2NyZWVuU3BhY2U7XG4gICAgICAgICAgICAgICAgbWkuc2NyZWVuU3BhY2UgPSBzY3JlZW5TcGFjZTtcbiAgICAgICAgICAgICAgICBtaS5kcmF3T3JkZXIgPSB0aGlzLl9kcmF3T3JkZXI7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2NyZWVuQ3VsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pLmN1bGwgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBtaS5pc1Zpc2libGVGdW5jID0gdmlzaWJsZUZuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMuX3NldFRleHR1cmVQYXJhbXMobWksIHRoaXMuX2ZvbnQudGV4dHVyZXNbaV0pO1xuXG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9vcGFjaXR5JywgdGhpcy5fY29sb3IuYSk7XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdmb250X3NkZkludGVuc2l0eScsIHRoaXMuX2ZvbnQuaW50ZW5zaXR5KTtcbiAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ2ZvbnRfcHhyYW5nZScsIHRoaXMuX2dldFB4UmFuZ2UodGhpcy5fZm9udCkpO1xuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignZm9udF90ZXh0dXJlV2lkdGgnLCB0aGlzLl9mb250LmRhdGEuaW5mby5tYXBzW2ldLndpZHRoKTtcblxuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignb3V0bGluZV9jb2xvcicsIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignb3V0bGluZV90aGlja25lc3MnLCB0aGlzLl9vdXRsaW5lVGhpY2tuZXNzU2NhbGUgKiB0aGlzLl9vdXRsaW5lVGhpY2tuZXNzKTtcblxuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignc2hhZG93X2NvbG9yJywgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fc3ltYm9sU2hhZG93UGFyYW1zKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd09mZnNldFVuaWZvcm1bMF0gPSAwO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dPZmZzZXRVbmlmb3JtWzFdID0gMDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByYXRpbyA9IC10aGlzLl9mb250LmRhdGEuaW5mby5tYXBzW2ldLndpZHRoIC8gdGhpcy5fZm9udC5kYXRhLmluZm8ubWFwc1tpXS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd09mZnNldFVuaWZvcm1bMF0gPSB0aGlzLl9zaGFkb3dPZmZzZXRTY2FsZSAqIHRoaXMuX3NoYWRvd09mZnNldC54O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dPZmZzZXRVbmlmb3JtWzFdID0gcmF0aW8gKiB0aGlzLl9zaGFkb3dPZmZzZXRTY2FsZSAqIHRoaXMuX3NoYWRvd09mZnNldC55O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ3NoYWRvd19vZmZzZXQnLCB0aGlzLl9zaGFkb3dPZmZzZXRVbmlmb3JtKTtcblxuICAgICAgICAgICAgICAgIG1lc2hJbmZvLm1lc2hJbnN0YW5jZSA9IG1pO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcy5wdXNoKG1pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFmdGVyIGNyZWF0aW5nIG5ldyBtZXNoZXNcbiAgICAgICAgLy8gcmUtYXBwbHkgbWFza2luZyBzdGVuY2lsIHBhcmFtc1xuICAgICAgICBpZiAodGhpcy5fZWxlbWVudC5tYXNrZWRCeSkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5fc2V0TWFza2VkQnkodGhpcy5fZWxlbWVudC5tYXNrZWRCeSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVtb3ZlZE1vZGVsICYmIHRoaXMuX2VsZW1lbnQuZW5hYmxlZCAmJiB0aGlzLl9lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5hZGRNb2RlbFRvTGF5ZXJzKHRoaXMuX21vZGVsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3VwZGF0ZU1lc2hlcygpO1xuXG4gICAgICAgIC8vIHVwZGF0ZSByZW5kZXIgcmFuZ2VcbiAgICAgICAgdGhpcy5fcmFuZ2VTdGFydCA9IDA7XG4gICAgICAgIHRoaXMuX3JhbmdlRW5kID0gdGhpcy5fc3ltYm9scy5sZW5ndGg7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVJlbmRlclJhbmdlKCk7XG4gICAgfVxuXG4gICAgX3JlbW92ZU1lc2hJbnN0YW5jZShtZXNoSW5zdGFuY2UpIHtcblxuICAgICAgICBtZXNoSW5zdGFuY2UuZGVzdHJveSgpO1xuXG4gICAgICAgIGNvbnN0IGlkeCA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMuaW5kZXhPZihtZXNoSW5zdGFuY2UpO1xuICAgICAgICBpZiAoaWR4ICE9PSAtMSlcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgfVxuXG4gICAgX3NldE1hdGVyaWFsKG1hdGVyaWFsKSB7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgbWkubWF0ZXJpYWwgPSBtYXRlcmlhbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVNYXRlcmlhbChzY3JlZW5TcGFjZSkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5fZWxlbWVudDtcbiAgICAgICAgY29uc3Qgc2NyZWVuQ3VsbGVkID0gZWxlbWVudC5faXNTY3JlZW5DdWxsZWQoKTtcbiAgICAgICAgY29uc3QgdmlzaWJsZUZuID0gZnVuY3Rpb24gKGNhbWVyYSkge1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuaXNWaXNpYmxlRm9yQ2FtZXJhKGNhbWVyYSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgbXNkZiA9IHRoaXMuX2ZvbnQgJiYgdGhpcy5fZm9udC50eXBlID09PSBGT05UX01TREY7XG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gdGhpcy5fc3lzdGVtLmdldFRleHRFbGVtZW50TWF0ZXJpYWwoc2NyZWVuU3BhY2UsIG1zZGYsIHRoaXMuX2VuYWJsZU1hcmt1cCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgICAgICBtaS5jdWxsID0gIXNjcmVlblNwYWNlO1xuICAgICAgICAgICAgICAgIG1pLm1hdGVyaWFsID0gdGhpcy5fbWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgbWkuc2NyZWVuU3BhY2UgPSBzY3JlZW5TcGFjZTtcblxuICAgICAgICAgICAgICAgIGlmIChzY3JlZW5DdWxsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbWkuY3VsbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIG1pLmlzVmlzaWJsZUZ1bmMgPSB2aXNpYmxlRm47XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWkuaXNWaXNpYmxlRnVuYyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlTWF0ZXJpYWxFbWlzc2l2ZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N5bWJvbENvbG9ycykge1xuICAgICAgICAgICAgLy8gd2hlbiBwZXItdmVydGV4IGNvbG9yaW5nIGlzIHByZXNlbnQsIGRpc2FibGUgbWF0ZXJpYWwgZW1pc3NpdmUgY29sb3JcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IDE7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSAxO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9jb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVNYXRlcmlhbE91dGxpbmUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zeW1ib2xPdXRsaW5lUGFyYW1zKSB7XG4gICAgICAgICAgICAvLyB3aGVuIHBlci12ZXJ0ZXggb3V0bGluZSBpcyBwcmVzZW50LCBkaXNhYmxlIG1hdGVyaWFsIG91dGxpbmUgdW5pZm9ybXNcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bMF0gPSAwO1xuICAgICAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yVW5pZm9ybVsxXSA9IDA7XG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3JVbmlmb3JtWzJdID0gMDtcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bM10gPSAxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yVW5pZm9ybVswXSA9IHRoaXMuX291dGxpbmVDb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yVW5pZm9ybVsxXSA9IHRoaXMuX291dGxpbmVDb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX291dGxpbmVDb2xvci5iO1xuICAgICAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yVW5pZm9ybVszXSA9IHRoaXMuX291dGxpbmVDb2xvci5hO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1hdGVyaWFsU2hhZG93KCkge1xuICAgICAgICBpZiAodGhpcy5fc3ltYm9sT3V0bGluZVBhcmFtcykge1xuICAgICAgICAgICAgLy8gd2hlbiBwZXItdmVydGV4IHNoYWRvdyBpcyBwcmVzZW50LCBkaXNhYmxlIG1hdGVyaWFsIHNoYWRvdyB1bmlmb3Jtc1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtWzBdID0gMDtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybVsxXSA9IDA7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvclVuaWZvcm1bMl0gPSAwO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtWzNdID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX3NoYWRvd0NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9zaGFkb3dDb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtWzJdID0gdGhpcy5fc2hhZG93Q29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybVszXSA9IHRoaXMuX3NoYWRvd0NvbG9yLmE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjaGFyIGlzIHNwYWNlLCB0YWIsIG9yIGRhc2hcbiAgICBfaXNXb3JkQm91bmRhcnkoY2hhcikge1xuICAgICAgICByZXR1cm4gV09SRF9CT1VOREFSWV9DSEFSLnRlc3QoY2hhcik7XG4gICAgfVxuXG4gICAgX2lzVmFsaWROZXh0Q2hhcihuZXh0Y2hhcikge1xuICAgICAgICByZXR1cm4gKG5leHRjaGFyICE9PSBudWxsKSAmJiAhTk9fTElORV9CUkVBS19DSktfQ0hBUi50ZXN0KG5leHRjaGFyKTtcbiAgICB9XG5cbiAgICAvLyBjaGFyIGlzIGEgQ0pLIGNoYXJhY3RlciBhbmQgbmV4dCBjaGFyYWN0ZXIgaXMgYSBDSksgYm91bmRhcnlcbiAgICBfaXNOZXh0Q0pLQm91bmRhcnkoY2hhciwgbmV4dGNoYXIpIHtcbiAgICAgICAgcmV0dXJuIENKS19DSEFSLnRlc3QoY2hhcikgJiYgKFdPUkRfQk9VTkRBUllfQ0hBUi50ZXN0KG5leHRjaGFyKSB8fCBBTFBIQU5VTUVSSUNfQ0hBUi50ZXN0KG5leHRjaGFyKSk7XG4gICAgfVxuXG4gICAgLy8gbmV4dCBjaGFyYWN0ZXIgaXMgYSBDSksgY2hhcmFjdGVyIHRoYXQgY2FuIGJlIGEgd2hvbGUgd29yZFxuICAgIF9pc05leHRDSktXaG9sZVdvcmQobmV4dGNoYXIpIHtcbiAgICAgICAgcmV0dXJuIENKS19DSEFSLnRlc3QobmV4dGNoYXIpO1xuICAgIH1cblxuICAgIF91cGRhdGVNZXNoZXMoKSB7XG4gICAgICAgIGNvbnN0IGpzb24gPSB0aGlzLl9mb250LmRhdGE7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIGNvbnN0IG1pbkZvbnQgPSBNYXRoLm1pbih0aGlzLl9taW5Gb250U2l6ZSwgdGhpcy5fbWF4Rm9udFNpemUpO1xuICAgICAgICBjb25zdCBtYXhGb250ID0gdGhpcy5fbWF4Rm9udFNpemU7XG5cbiAgICAgICAgY29uc3QgYXV0b0ZpdCA9IHRoaXMuX3Nob3VsZEF1dG9GaXQoKTtcblxuICAgICAgICBpZiAoYXV0b0ZpdCkge1xuICAgICAgICAgICAgdGhpcy5fZm9udFNpemUgPSB0aGlzLl9tYXhGb250U2l6ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IE1BR0lDID0gMzI7XG4gICAgICAgIGNvbnN0IGwgPSB0aGlzLl9zeW1ib2xzLmxlbmd0aDtcblxuICAgICAgICBsZXQgX3ggPSAwOyAvLyBjdXJzb3JzXG4gICAgICAgIGxldCBfeSA9IDA7XG4gICAgICAgIGxldCBfeiA9IDA7XG4gICAgICAgIGxldCBfeE1pbnVzVHJhaWxpbmdXaGl0ZXNwYWNlID0gMDtcbiAgICAgICAgbGV0IGxpbmVzID0gMTtcbiAgICAgICAgbGV0IHdvcmRTdGFydFggPSAwO1xuICAgICAgICBsZXQgd29yZFN0YXJ0SW5kZXggPSAwO1xuICAgICAgICBsZXQgbGluZVN0YXJ0SW5kZXggPSAwO1xuICAgICAgICBsZXQgbnVtV29yZHNUaGlzTGluZSA9IDA7XG4gICAgICAgIGxldCBudW1DaGFyc1RoaXNMaW5lID0gMDtcbiAgICAgICAgbGV0IG51bUJyZWFrc1RoaXNMaW5lID0gMDtcblxuICAgICAgICBjb25zdCBzcGxpdEhvcml6b250YWxBbmNob3JzID0gTWF0aC5hYnModGhpcy5fZWxlbWVudC5hbmNob3IueCAtIHRoaXMuX2VsZW1lbnQuYW5jaG9yLnopID49IDAuMDAwMTtcblxuICAgICAgICBsZXQgbWF4TGluZVdpZHRoID0gdGhpcy5fZWxlbWVudC5jYWxjdWxhdGVkV2lkdGg7XG4gICAgICAgIGlmICgodGhpcy5hdXRvV2lkdGggJiYgIXNwbGl0SG9yaXpvbnRhbEFuY2hvcnMpIHx8ICF0aGlzLl93cmFwTGluZXMpIHtcbiAgICAgICAgICAgIG1heExpbmVXaWR0aCA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBmb250TWluWSA9IDA7XG4gICAgICAgIGxldCBmb250TWF4WSA9IDA7XG5cbiAgICAgICAgbGV0IGNoYXIsIGRhdGEsIHF1YWQsIG5leHRjaGFyO1xuXG4gICAgICAgIGZ1bmN0aW9uIGJyZWFrTGluZShzeW1ib2xzLCBsaW5lQnJlYWtJbmRleCwgbGluZUJyZWFrWCkge1xuICAgICAgICAgICAgc2VsZi5fbGluZVdpZHRocy5wdXNoKE1hdGguYWJzKGxpbmVCcmVha1gpKTtcbiAgICAgICAgICAgIC8vIGluIHJ0bCBtb2RlIGxpbmVTdGFydEluZGV4IHdpbGwgdXN1YWxseSBiZSBsYXJnZXIgdGhhbiBsaW5lQnJlYWtJbmRleCBhbmQgd2Ugd2lsbFxuICAgICAgICAgICAgLy8gbmVlZCB0byBhZGp1c3QgdGhlIHN0YXJ0IC8gZW5kIGluZGljZXMgd2hlbiBjYWxsaW5nIHN5bWJvbHMuc2xpY2UoKVxuICAgICAgICAgICAgY29uc3Qgc2xpY2VTdGFydCA9IGxpbmVTdGFydEluZGV4ID4gbGluZUJyZWFrSW5kZXggPyBsaW5lQnJlYWtJbmRleCArIDEgOiBsaW5lU3RhcnRJbmRleDtcbiAgICAgICAgICAgIGNvbnN0IHNsaWNlRW5kID0gbGluZVN0YXJ0SW5kZXggPiBsaW5lQnJlYWtJbmRleCA/IGxpbmVTdGFydEluZGV4ICsgMSA6IGxpbmVCcmVha0luZGV4O1xuICAgICAgICAgICAgY29uc3QgY2hhcnMgPSBzeW1ib2xzLnNsaWNlKHNsaWNlU3RhcnQsIHNsaWNlRW5kKTtcblxuICAgICAgICAgICAgLy8gUmVtb3ZlIGxpbmUgYnJlYWtzIGZyb20gbGluZS5cbiAgICAgICAgICAgIC8vIExpbmUgYnJlYWtzIHdvdWxkIG9ubHkgYmUgdGhlcmUgZm9yIHRoZSBmaW5hbCBsaW5lXG4gICAgICAgICAgICAvLyB3aGVuIHdlIHJlYWNoIHRoZSBtYXhMaW5lcyBsaW1pdC5cbiAgICAgICAgICAgIC8vIFRPRE86IFdlIGNvdWxkIHBvc3NpYmx5IG5vdCBkbyB0aGlzIGFuZCBqdXN0IGxldCBsaW5lcyBoYXZlXG4gICAgICAgICAgICAvLyBuZXcgbGluZXMgaW4gdGhlbS4gQXBhcnQgZnJvbSBiZWluZyBhIGJpdCB3ZWlyZCBpdCBzaG91bGQgbm90IGFmZmVjdFxuICAgICAgICAgICAgLy8gdGhlIHJlbmRlcmVkIHRleHQuXG4gICAgICAgICAgICBpZiAobnVtQnJlYWtzVGhpc0xpbmUpIHtcbiAgICAgICAgICAgICAgICBsZXQgaSA9IGNoYXJzLmxlbmd0aDtcbiAgICAgICAgICAgICAgICB3aGlsZSAoaS0tICYmIG51bUJyZWFrc1RoaXNMaW5lID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoTElORV9CUkVBS19DSEFSLnRlc3QoY2hhcnNbaV0pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaGFycy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBudW1CcmVha3NUaGlzTGluZS0tO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZWxmLl9saW5lQ29udGVudHMucHVzaChjaGFycy5qb2luKCcnKSk7XG5cbiAgICAgICAgICAgIF94ID0gMDtcbiAgICAgICAgICAgIF95IC09IHNlbGYuX3NjYWxlZExpbmVIZWlnaHQ7XG4gICAgICAgICAgICBsaW5lcysrO1xuICAgICAgICAgICAgbnVtV29yZHNUaGlzTGluZSA9IDA7XG4gICAgICAgICAgICBudW1DaGFyc1RoaXNMaW5lID0gMDtcbiAgICAgICAgICAgIG51bUJyZWFrc1RoaXNMaW5lID0gMDtcbiAgICAgICAgICAgIHdvcmRTdGFydFggPSAwO1xuICAgICAgICAgICAgbGluZVN0YXJ0SW5kZXggPSBsaW5lQnJlYWtJbmRleDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCByZXRyeVVwZGF0ZU1lc2hlcyA9IHRydWU7XG4gICAgICAgIHdoaWxlIChyZXRyeVVwZGF0ZU1lc2hlcykge1xuICAgICAgICAgICAgcmV0cnlVcGRhdGVNZXNoZXMgPSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gaWYgYXV0by1maXR0aW5nIHRoZW4gc2NhbGUgdGhlIGxpbmUgaGVpZ2h0XG4gICAgICAgICAgICAvLyBhY2NvcmRpbmcgdG8gdGhlIGN1cnJlbnQgZm9udFNpemUgdmFsdWUgcmVsYXRpdmUgdG8gdGhlIG1heCBmb250IHNpemVcbiAgICAgICAgICAgIGlmIChhdXRvRml0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2NhbGVkTGluZUhlaWdodCA9IHRoaXMuX2xpbmVIZWlnaHQgKiB0aGlzLl9mb250U2l6ZSAvICh0aGlzLl9tYXhGb250U2l6ZSB8fCAwLjAwMDEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zY2FsZWRMaW5lSGVpZ2h0ID0gdGhpcy5fbGluZUhlaWdodDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy53aWR0aCA9IDA7XG4gICAgICAgICAgICB0aGlzLmhlaWdodCA9IDA7XG4gICAgICAgICAgICB0aGlzLl9saW5lV2lkdGhzID0gW107XG4gICAgICAgICAgICB0aGlzLl9saW5lQ29udGVudHMgPSBbXTtcblxuICAgICAgICAgICAgX3ggPSAwO1xuICAgICAgICAgICAgX3kgPSAwO1xuICAgICAgICAgICAgX3ogPSAwO1xuICAgICAgICAgICAgX3hNaW51c1RyYWlsaW5nV2hpdGVzcGFjZSA9IDA7XG5cbiAgICAgICAgICAgIGxpbmVzID0gMTtcbiAgICAgICAgICAgIHdvcmRTdGFydFggPSAwO1xuICAgICAgICAgICAgd29yZFN0YXJ0SW5kZXggPSAwO1xuICAgICAgICAgICAgbGluZVN0YXJ0SW5kZXggPSAwO1xuICAgICAgICAgICAgbnVtV29yZHNUaGlzTGluZSA9IDA7XG4gICAgICAgICAgICBudW1DaGFyc1RoaXNMaW5lID0gMDtcbiAgICAgICAgICAgIG51bUJyZWFrc1RoaXNMaW5lID0gMDtcblxuICAgICAgICAgICAgY29uc3Qgc2NhbGUgPSB0aGlzLl9mb250U2l6ZSAvIE1BR0lDO1xuXG4gICAgICAgICAgICAvLyBzY2FsZSBtYXggZm9udCBleHRlbnRzXG4gICAgICAgICAgICBmb250TWluWSA9IHRoaXMuX2ZvbnRNaW5ZICogc2NhbGU7XG4gICAgICAgICAgICBmb250TWF4WSA9IHRoaXMuX2ZvbnRNYXhZICogc2NhbGU7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWVzaEluZm8ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5xdWFkID0gMDtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5saW5lcyA9IHt9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBwZXItdmVydGV4IGNvbG9yXG4gICAgICAgICAgICBsZXQgY29sb3JfciA9IDI1NTtcbiAgICAgICAgICAgIGxldCBjb2xvcl9nID0gMjU1O1xuICAgICAgICAgICAgbGV0IGNvbG9yX2IgPSAyNTU7XG5cbiAgICAgICAgICAgIC8vIHBlci12ZXJ0ZXggb3V0bGluZSBwYXJhbWV0ZXJzXG4gICAgICAgICAgICBsZXQgb3V0bGluZV9jb2xvcl9yZyA9IDI1NSArIDI1NSAqIDI1NjtcbiAgICAgICAgICAgIGxldCBvdXRsaW5lX2NvbG9yX2JhID0gMjU1ICsgMjU1ICogMjU2O1xuICAgICAgICAgICAgbGV0IG91dGxpbmVfdGhpY2tuZXNzID0gMDtcblxuICAgICAgICAgICAgLy8gcGVyLXZlcnRleCBzaGFkb3cgcGFyYW1ldGVyc1xuICAgICAgICAgICAgbGV0IHNoYWRvd19jb2xvcl9yZyA9IDI1NSArIDI1NSAqIDI1NjtcbiAgICAgICAgICAgIGxldCBzaGFkb3dfY29sb3JfYmEgPSAyNTUgKyAyNTUgKiAyNTY7XG4gICAgICAgICAgICBsZXQgc2hhZG93X29mZnNldF94eSA9IDEyNyArIDEyNyAqIDI1NjtcblxuICAgICAgICAgICAgLy8gSW4gbGVmdC10by1yaWdodCBtb2RlIHdlIGxvb3AgdGhyb3VnaCB0aGUgc3ltYm9scyBmcm9tIHN0YXJ0IHRvIGVuZC5cbiAgICAgICAgICAgIC8vIEluIHJpZ2h0LXRvLWxlZnQgbW9kZSB3ZSBsb29wIHRocm91Z2ggdGhlIHN5bWJvbHMgZnJvbSBlbmQgdG8gdGhlIGJlZ2lubmluZ1xuICAgICAgICAgICAgLy8gaW4gb3JkZXIgdG8gd3JhcCBsaW5lcyBpbiB0aGUgY29ycmVjdCBvcmRlclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjaGFyID0gdGhpcy5fc3ltYm9sc1tpXTtcbiAgICAgICAgICAgICAgICBuZXh0Y2hhciA9ICgoaSArIDEpID49IGwpID8gbnVsbCA6IHRoaXMuX3N5bWJvbHNbaSArIDFdO1xuXG4gICAgICAgICAgICAgICAgLy8gaGFuZGxlIGxpbmUgYnJlYWtcbiAgICAgICAgICAgICAgICBjb25zdCBpc0xpbmVCcmVhayA9IExJTkVfQlJFQUtfQ0hBUi50ZXN0KGNoYXIpO1xuICAgICAgICAgICAgICAgIGlmIChpc0xpbmVCcmVhaykge1xuICAgICAgICAgICAgICAgICAgICBudW1CcmVha3NUaGlzTGluZSsrO1xuICAgICAgICAgICAgICAgICAgICAvLyBJZiB3ZSBhcmUgbm90IGxpbmUgd3JhcHBpbmcgdGhlbiB3ZSBzaG91bGQgYmUgaWdub3JpbmcgbWF4bGluZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLl93cmFwTGluZXMgfHwgdGhpcy5fbWF4TGluZXMgPCAwIHx8IGxpbmVzIDwgdGhpcy5fbWF4TGluZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrTGluZSh0aGlzLl9zeW1ib2xzLCBpLCBfeE1pbnVzVHJhaWxpbmdXaGl0ZXNwYWNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHdvcmRTdGFydEluZGV4ID0gaSArIDE7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lU3RhcnRJbmRleCA9IGkgKyAxO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGxldCB4ID0gMDtcbiAgICAgICAgICAgICAgICBsZXQgeSA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IGFkdmFuY2UgPSAwO1xuICAgICAgICAgICAgICAgIGxldCBxdWFkc2l6ZSA9IDE7XG4gICAgICAgICAgICAgICAgbGV0IGRhdGFTY2FsZSwgc2l6ZTtcblxuICAgICAgICAgICAgICAgIGRhdGEgPSBqc29uLmNoYXJzW2NoYXJdO1xuXG4gICAgICAgICAgICAgICAgLy8gaGFuZGxlIG1pc3NpbmcgZ2x5cGhcbiAgICAgICAgICAgICAgICBpZiAoIWRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKENPTlRST0xfQ0hBUlMuaW5kZXhPZihjaGFyKSAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGhhbmRsZSB1bmljb2RlIGNvbnRyb2wgY2hhcmFjdGVyc1xuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IENPTlRST0xfR0xZUEhfREFUQTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZSB1c2Ugc3BhY2UgY2hhcmFjdGVyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoanNvbi5jaGFyc1snICddKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YSA9IGpzb24uY2hhcnNbJyAnXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVucmVhY2hhYmxlLWxvb3BcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBqc29uLmNoYXJzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEgPSBqc29uLmNoYXJzW2tleV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFqc29uLm1pc3NpbmdDaGFycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGpzb24ubWlzc2luZ0NoYXJzID0gbmV3IFNldCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWpzb24ubWlzc2luZ0NoYXJzLmhhcyhjaGFyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgQ2hhcmFjdGVyICcke2NoYXJ9JyBpcyBtaXNzaW5nIGZyb20gdGhlIGZvbnQgJHtqc29uLmluZm8uZmFjZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBqc29uLm1pc3NpbmdDaGFycy5hZGQoY2hhcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAjZW5kaWZcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBrZXJuaW5nID0gMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG51bUNoYXJzVGhpc0xpbmUgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXJuVGFibGUgPSB0aGlzLl9mb250LmRhdGEua2VybmluZztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXJuVGFibGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXJuTGVmdCA9IGtlcm5UYWJsZVtzdHJpbmcuZ2V0Q29kZVBvaW50KHRoaXMuX3N5bWJvbHNbaSAtIDFdKSB8fCAwXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoa2VybkxlZnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2VybmluZyA9IGtlcm5MZWZ0W3N0cmluZy5nZXRDb2RlUG9pbnQodGhpcy5fc3ltYm9sc1tpXSkgfHwgMF0gfHwgMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZGF0YVNjYWxlID0gZGF0YS5zY2FsZSB8fCAxO1xuICAgICAgICAgICAgICAgICAgICBzaXplID0gKGRhdGEud2lkdGggKyBkYXRhLmhlaWdodCkgLyAyO1xuICAgICAgICAgICAgICAgICAgICBxdWFkc2l6ZSA9IHNjYWxlICogc2l6ZSAvIGRhdGFTY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgYWR2YW5jZSA9IChkYXRhLnhhZHZhbmNlICsga2VybmluZykgKiBzY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgeCA9IChkYXRhLnhvZmZzZXQgLSBrZXJuaW5nKSAqIHNjYWxlO1xuICAgICAgICAgICAgICAgICAgICB5ID0gZGF0YS55b2Zmc2V0ICogc2NhbGU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgQ291bGRuJ3Qgc3Vic3RpdHV0ZSBtaXNzaW5nIGNoYXJhY3RlcjogJyR7Y2hhcn0nYCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaXNXaGl0ZXNwYWNlID0gV0hJVEVTUEFDRV9DSEFSLnRlc3QoY2hhcik7XG5cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbmZvSWQgPSAoZGF0YSAmJiBkYXRhLm1hcCkgfHwgMDtcbiAgICAgICAgICAgICAgICBjb25zdCByYXRpbyA9IC10aGlzLl9mb250LmRhdGEuaW5mby5tYXBzW21lc2hJbmZvSWRdLndpZHRoIC9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9udC5kYXRhLmluZm8ubWFwc1ttZXNoSW5mb0lkXS5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluZm8gPSB0aGlzLl9tZXNoSW5mb1ttZXNoSW5mb0lkXTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGNhbmRpZGF0ZUxpbmVXaWR0aCA9IF94ICsgdGhpcy5fc3BhY2luZyAqIGFkdmFuY2U7XG5cbiAgICAgICAgICAgICAgICAvLyBJZiB3ZSd2ZSBleGNlZWRlZCB0aGUgbWF4aW11bSBsaW5lIHdpZHRoLCBtb3ZlIGV2ZXJ5dGhpbmcgZnJvbSB0aGUgYmVnaW5uaW5nIG9mXG4gICAgICAgICAgICAgICAgLy8gdGhlIGN1cnJlbnQgd29yZCBvbndhcmRzIGRvd24gb250byBhIG5ldyBsaW5lLlxuICAgICAgICAgICAgICAgIGlmIChjYW5kaWRhdGVMaW5lV2lkdGggPiBtYXhMaW5lV2lkdGggJiYgbnVtQ2hhcnNUaGlzTGluZSA+IDAgJiYgIWlzV2hpdGVzcGFjZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fbWF4TGluZXMgPCAwIHx8IGxpbmVzIDwgdGhpcy5fbWF4TGluZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhhbmRsZSB0aGUgY2FzZSB3aGVyZSBhIGxpbmUgY29udGFpbmluZyBvbmx5IGEgc2luZ2xlIGxvbmcgd29yZCBuZWVkcyB0byBiZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYnJva2VuIG9udG8gbXVsdGlwbGUgbGluZXMuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobnVtV29yZHNUaGlzTGluZSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdvcmRTdGFydEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVha0xpbmUodGhpcy5fc3ltYm9scywgaSwgX3hNaW51c1RyYWlsaW5nV2hpdGVzcGFjZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1vdmUgYmFjayB0byB0aGUgYmVnaW5uaW5nIG9mIHRoZSBjdXJyZW50IHdvcmQuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFja3RyYWNrID0gTWF0aC5tYXgoaSAtIHdvcmRTdGFydEluZGV4LCAwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fbWVzaEluZm8ubGVuZ3RoIDw9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8ubGluZXNbbGluZXMgLSAxXSAtPSBiYWNrdHJhY2s7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLnF1YWQgLT0gYmFja3RyYWNrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIHNob3VsZCBvbmx5IGJhY2t0cmFjayB0aGUgcXVhZHMgdGhhdCB3ZXJlIGluIHRoZSB3b3JkIGZyb20gdGhpcyBzYW1lIHRleHR1cmVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2Ugd2lsbCBoYXZlIHRvIHVwZGF0ZSBOIG51bWJlciBvZiBtZXNoIGluZm9zIGFzIGEgcmVzdWx0IChhbGwgdGV4dHVyZXMgdXNlZCBpbiB0aGUgd29yZCBpbiBxdWVzdGlvbilcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFja3RyYWNrU3RhcnQgPSB3b3JkU3RhcnRJbmRleDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFja3RyYWNrRW5kID0gaTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IGJhY2t0cmFja1N0YXJ0OyBqIDwgYmFja3RyYWNrRW5kOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhY2tDaGFyID0gdGhpcy5fc3ltYm9sc1tqXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhY2tDaGFyRGF0YSA9IGpzb24uY2hhcnNbYmFja0NoYXJdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFja01lc2hJbmZvID0gdGhpcy5fbWVzaEluZm9bKGJhY2tDaGFyRGF0YSAmJiBiYWNrQ2hhckRhdGEubWFwKSB8fCAwXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tNZXNoSW5mby5saW5lc1tsaW5lcyAtIDFdIC09IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrTWVzaEluZm8ucXVhZCAtPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaSAtPSBiYWNrdHJhY2sgKyAxO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWtMaW5lKHRoaXMuX3N5bWJvbHMsIHdvcmRTdGFydEluZGV4LCB3b3JkU3RhcnRYKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHF1YWQgPSBtZXNoSW5mby5xdWFkO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmxpbmVzW2xpbmVzIC0gMV0gPSBxdWFkO1xuXG4gICAgICAgICAgICAgICAgbGV0IGxlZnQgPSBfeCAtIHg7XG4gICAgICAgICAgICAgICAgbGV0IHJpZ2h0ID0gbGVmdCArIHF1YWRzaXplO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvdHRvbSA9IF95IC0geTtcbiAgICAgICAgICAgICAgICBjb25zdCB0b3AgPSBib3R0b20gKyBxdWFkc2l6ZTtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9ydGwpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcnRsIHRleHQgd2lsbCBiZSBmbGlwcGVkIHZlcnRpY2FsbHkgYmVmb3JlIHJlbmRlcmluZyBhbmQgaGVyZSB3ZVxuICAgICAgICAgICAgICAgICAgICAvLyBhY2NvdW50IGZvciB0aGUgbWlzLWFsaWdubWVudCB0aGF0IHdvdWxkIGJlIGludHJvZHVjZWQuIHNoaWZ0IGlzIGNhbGN1bGF0ZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gYXMgdGhlIGRpZmZlcmVuY2UgYmV0d2VlbiB0aGUgZ2x5cGgncyBsZWZ0IGFuZCByaWdodCBvZmZzZXQuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNoaWZ0ID0gcXVhZHNpemUgLSB4IC0gdGhpcy5fc3BhY2luZyAqIGFkdmFuY2UgLSB4O1xuICAgICAgICAgICAgICAgICAgICBsZWZ0IC09IHNoaWZ0O1xuICAgICAgICAgICAgICAgICAgICByaWdodCAtPSBzaGlmdDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgMF0gPSBsZWZ0O1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyAxXSA9IGJvdHRvbTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgMl0gPSBfejtcblxuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyAzXSA9IHJpZ2h0O1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyA0XSA9IGJvdHRvbTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgNV0gPSBfejtcblxuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyA2XSA9IHJpZ2h0O1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyA3XSA9IHRvcDtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgOF0gPSBfejtcblxuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyA5XSAgPSBsZWZ0O1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyAxMF0gPSB0b3A7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDExXSA9IF96O1xuXG4gICAgICAgICAgICAgICAgdGhpcy53aWR0aCA9IE1hdGgubWF4KHRoaXMud2lkdGgsIGNhbmRpZGF0ZUxpbmVXaWR0aCk7XG5cbiAgICAgICAgICAgICAgICAvLyBzY2FsZSBmb250IHNpemUgaWYgYXV0b0ZpdFdpZHRoIGlzIHRydWUgYW5kIHRoZSB3aWR0aCBpcyBsYXJnZXIgdGhhbiB0aGUgY2FsY3VsYXRlZCB3aWR0aFxuICAgICAgICAgICAgICAgIGxldCBmb250U2l6ZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fc2hvdWxkQXV0b0ZpdFdpZHRoKCkgJiYgdGhpcy53aWR0aCA+IHRoaXMuX2VsZW1lbnQuY2FsY3VsYXRlZFdpZHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvbnRTaXplID0gTWF0aC5mbG9vcih0aGlzLl9lbGVtZW50LmZvbnRTaXplICogdGhpcy5fZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggLyAodGhpcy53aWR0aCB8fCAwLjAwMDEpKTtcbiAgICAgICAgICAgICAgICAgICAgZm9udFNpemUgPSBtYXRoLmNsYW1wKGZvbnRTaXplLCBtaW5Gb250LCBtYXhGb250KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZvbnRTaXplICE9PSB0aGlzLl9lbGVtZW50LmZvbnRTaXplKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9mb250U2l6ZSA9IGZvbnRTaXplO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0cnlVcGRhdGVNZXNoZXMgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmhlaWdodCA9IE1hdGgubWF4KHRoaXMuaGVpZ2h0LCBmb250TWF4WSAtIChfeSArIGZvbnRNaW5ZKSk7XG5cbiAgICAgICAgICAgICAgICAvLyBzY2FsZSBmb250IHNpemUgaWYgYXV0b0ZpdEhlaWdodCBpcyB0cnVlIGFuZCB0aGUgaGVpZ2h0IGlzIGxhcmdlciB0aGFuIHRoZSBjYWxjdWxhdGVkIGhlaWdodFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zaG91bGRBdXRvRml0SGVpZ2h0KCkgJiYgdGhpcy5oZWlnaHQgPiB0aGlzLl9lbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdHJ5IDEgcGl4ZWwgc21hbGxlciBmb3IgZm9udFNpemUgYW5kIGl0ZXJhdGVcbiAgICAgICAgICAgICAgICAgICAgZm9udFNpemUgPSBtYXRoLmNsYW1wKHRoaXMuX2ZvbnRTaXplIC0gMSwgbWluRm9udCwgbWF4Rm9udCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmb250U2l6ZSAhPT0gdGhpcy5fZWxlbWVudC5mb250U2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9udFNpemUgPSBmb250U2l6ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHJ5VXBkYXRlTWVzaGVzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gYWR2YW5jZSBjdXJzb3IgKGZvciBSVEwgd2UgbW92ZSBsZWZ0KVxuICAgICAgICAgICAgICAgIF94ICs9IHRoaXMuX3NwYWNpbmcgKiBhZHZhbmNlO1xuXG4gICAgICAgICAgICAgICAgLy8gRm9yIHByb3BlciBhbGlnbm1lbnQgaGFuZGxpbmcgd2hlbiBhIGxpbmUgd3JhcHMgX29uXyBhIHdoaXRlc3BhY2UgY2hhcmFjdGVyLFxuICAgICAgICAgICAgICAgIC8vIHdlIG5lZWQgdG8ga2VlcCB0cmFjayBvZiB0aGUgd2lkdGggb2YgdGhlIGxpbmUgd2l0aG91dCBhbnkgdHJhaWxpbmcgd2hpdGVzcGFjZVxuICAgICAgICAgICAgICAgIC8vIGNoYXJhY3RlcnMuIFRoaXMgYXBwbGllcyB0byBib3RoIHNpbmdsZSB3aGl0ZXNwYWNlcyBhbmQgYWxzbyBtdWx0aXBsZSBzZXF1ZW50aWFsXG4gICAgICAgICAgICAgICAgLy8gd2hpdGVzcGFjZXMuXG4gICAgICAgICAgICAgICAgaWYgKCFpc1doaXRlc3BhY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgX3hNaW51c1RyYWlsaW5nV2hpdGVzcGFjZSA9IF94O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pc1dvcmRCb3VuZGFyeShjaGFyKSB8fCAodGhpcy5faXNWYWxpZE5leHRDaGFyKG5leHRjaGFyKSAmJiAodGhpcy5faXNOZXh0Q0pLQm91bmRhcnkoY2hhciwgbmV4dGNoYXIpIHx8IHRoaXMuX2lzTmV4dENKS1dob2xlV29yZChuZXh0Y2hhcikpKSkge1xuICAgICAgICAgICAgICAgICAgICBudW1Xb3Jkc1RoaXNMaW5lKys7XG4gICAgICAgICAgICAgICAgICAgIHdvcmRTdGFydFggPSBfeE1pbnVzVHJhaWxpbmdXaGl0ZXNwYWNlO1xuICAgICAgICAgICAgICAgICAgICB3b3JkU3RhcnRJbmRleCA9IGkgKyAxO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG51bUNoYXJzVGhpc0xpbmUrKztcblxuICAgICAgICAgICAgICAgIGNvbnN0IHV2ID0gdGhpcy5fZ2V0VXYoY2hhcik7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby51dnNbcXVhZCAqIDQgKiAyICsgMF0gPSB1dlswXTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby51dnNbcXVhZCAqIDQgKiAyICsgMV0gPSAxLjAgLSB1dlsxXTtcblxuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnV2c1txdWFkICogNCAqIDIgKyAyXSA9IHV2WzJdO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnV2c1txdWFkICogNCAqIDIgKyAzXSA9IDEuMCAtIHV2WzFdO1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8udXZzW3F1YWQgKiA0ICogMiArIDRdID0gdXZbMl07XG4gICAgICAgICAgICAgICAgbWVzaEluZm8udXZzW3F1YWQgKiA0ICogMiArIDVdID0gMS4wIC0gdXZbM107XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby51dnNbcXVhZCAqIDQgKiAyICsgNl0gPSB1dlswXTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby51dnNbcXVhZCAqIDQgKiAyICsgN10gPSAxLjAgLSB1dlszXTtcblxuICAgICAgICAgICAgICAgIC8vIHNldCBwZXItdmVydGV4IGNvbG9yXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3N5bWJvbENvbG9ycykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xvcklkeCA9IHRoaXMuX3N5bWJvbENvbG9yc1tpXSAqIDM7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yX3IgPSB0aGlzLl9jb2xvclBhbGV0dGVbY29sb3JJZHhdO1xuICAgICAgICAgICAgICAgICAgICBjb2xvcl9nID0gdGhpcy5fY29sb3JQYWxldHRlW2NvbG9ySWR4ICsgMV07XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yX2IgPSB0aGlzLl9jb2xvclBhbGV0dGVbY29sb3JJZHggKyAyXTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgMF0gPSBjb2xvcl9yO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyAxXSA9IGNvbG9yX2c7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzW3F1YWQgKiA0ICogNCArIDJdID0gY29sb3JfYjtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgM10gPSAyNTU7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgNF0gPSBjb2xvcl9yO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyA1XSA9IGNvbG9yX2c7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzW3F1YWQgKiA0ICogNCArIDZdID0gY29sb3JfYjtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgN10gPSAyNTU7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgOF0gPSBjb2xvcl9yO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyA5XSA9IGNvbG9yX2c7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzW3F1YWQgKiA0ICogNCArIDEwXSA9IGNvbG9yX2I7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzW3F1YWQgKiA0ICogNCArIDExXSA9IDI1NTtcblxuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyAxMl0gPSBjb2xvcl9yO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyAxM10gPSBjb2xvcl9nO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyAxNF0gPSBjb2xvcl9iO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyAxNV0gPSAyNTU7XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgcGVyLXZlcnRleCBvdXRsaW5lIHBhcmFtZXRlcnNcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fc3ltYm9sT3V0bGluZVBhcmFtcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvdXRsaW5lSWR4ID0gdGhpcy5fc3ltYm9sT3V0bGluZVBhcmFtc1tpXSAqIDU7XG4gICAgICAgICAgICAgICAgICAgIG91dGxpbmVfY29sb3JfcmcgPSB0aGlzLl9vdXRsaW5lUGFsZXR0ZVtvdXRsaW5lSWR4XSArXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdXRsaW5lUGFsZXR0ZVtvdXRsaW5lSWR4ICsgMV0gKiAyNTY7XG4gICAgICAgICAgICAgICAgICAgIG91dGxpbmVfY29sb3JfYmEgPSB0aGlzLl9vdXRsaW5lUGFsZXR0ZVtvdXRsaW5lSWR4ICsgMl0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3V0bGluZVBhbGV0dGVbb3V0bGluZUlkeCArIDNdICogMjU2O1xuICAgICAgICAgICAgICAgICAgICBvdXRsaW5lX3RoaWNrbmVzcyA9IHRoaXMuX291dGxpbmVQYWxldHRlW291dGxpbmVJZHggKyA0XTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5vdXRsaW5lc1txdWFkICogNCAqIDMgKyAwXSA9IG91dGxpbmVfY29sb3Jfcmc7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ub3V0bGluZXNbcXVhZCAqIDQgKiAzICsgMV0gPSBvdXRsaW5lX2NvbG9yX2JhO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLm91dGxpbmVzW3F1YWQgKiA0ICogMyArIDJdID0gb3V0bGluZV90aGlja25lc3M7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5vdXRsaW5lc1txdWFkICogNCAqIDMgKyAzXSA9IG91dGxpbmVfY29sb3Jfcmc7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ub3V0bGluZXNbcXVhZCAqIDQgKiAzICsgNF0gPSBvdXRsaW5lX2NvbG9yX2JhO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLm91dGxpbmVzW3F1YWQgKiA0ICogMyArIDVdID0gb3V0bGluZV90aGlja25lc3M7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5vdXRsaW5lc1txdWFkICogNCAqIDMgKyA2XSA9IG91dGxpbmVfY29sb3Jfcmc7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ub3V0bGluZXNbcXVhZCAqIDQgKiAzICsgN10gPSBvdXRsaW5lX2NvbG9yX2JhO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLm91dGxpbmVzW3F1YWQgKiA0ICogMyArIDhdID0gb3V0bGluZV90aGlja25lc3M7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5vdXRsaW5lc1txdWFkICogNCAqIDMgKyA5XSA9IG91dGxpbmVfY29sb3Jfcmc7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ub3V0bGluZXNbcXVhZCAqIDQgKiAzICsgMTBdID0gb3V0bGluZV9jb2xvcl9iYTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5vdXRsaW5lc1txdWFkICogNCAqIDMgKyAxMV0gPSBvdXRsaW5lX3RoaWNrbmVzcztcblxuICAgICAgICAgICAgICAgIC8vIHNldCBwZXItdmVydGV4IHNoYWRvdyBwYXJhbWV0ZXJzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3N5bWJvbFNoYWRvd1BhcmFtcykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dJZHggPSB0aGlzLl9zeW1ib2xTaGFkb3dQYXJhbXNbaV0gKiA2O1xuICAgICAgICAgICAgICAgICAgICBzaGFkb3dfY29sb3JfcmcgPSB0aGlzLl9zaGFkb3dQYWxldHRlW3NoYWRvd0lkeF0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UGFsZXR0ZVtzaGFkb3dJZHggKyAxXSAqIDI1NjtcbiAgICAgICAgICAgICAgICAgICAgc2hhZG93X2NvbG9yX2JhID0gdGhpcy5fc2hhZG93UGFsZXR0ZVtzaGFkb3dJZHggKyAyXSArXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dQYWxldHRlW3NoYWRvd0lkeCArIDNdICogMjU2O1xuICAgICAgICAgICAgICAgICAgICBzaGFkb3dfb2Zmc2V0X3h5ID0gKHRoaXMuX3NoYWRvd1BhbGV0dGVbc2hhZG93SWR4ICsgNF0gKyAxMjcpICtcbiAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQocmF0aW8gKiB0aGlzLl9zaGFkb3dQYWxldHRlW3NoYWRvd0lkeCArIDVdICsgMTI3KSAqIDI1NjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzW3F1YWQgKiA0ICogMyArIDBdID0gc2hhZG93X2NvbG9yX3JnO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnNoYWRvd3NbcXVhZCAqIDQgKiAzICsgMV0gPSBzaGFkb3dfY29sb3JfYmE7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uc2hhZG93c1txdWFkICogNCAqIDMgKyAyXSA9IHNoYWRvd19vZmZzZXRfeHk7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzW3F1YWQgKiA0ICogMyArIDNdID0gc2hhZG93X2NvbG9yX3JnO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnNoYWRvd3NbcXVhZCAqIDQgKiAzICsgNF0gPSBzaGFkb3dfY29sb3JfYmE7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uc2hhZG93c1txdWFkICogNCAqIDMgKyA1XSA9IHNoYWRvd19vZmZzZXRfeHk7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzW3F1YWQgKiA0ICogMyArIDZdID0gc2hhZG93X2NvbG9yX3JnO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnNoYWRvd3NbcXVhZCAqIDQgKiAzICsgN10gPSBzaGFkb3dfY29sb3JfYmE7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uc2hhZG93c1txdWFkICogNCAqIDMgKyA4XSA9IHNoYWRvd19vZmZzZXRfeHk7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzW3F1YWQgKiA0ICogMyArIDldID0gc2hhZG93X2NvbG9yX3JnO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnNoYWRvd3NbcXVhZCAqIDQgKiAzICsgMTBdID0gc2hhZG93X2NvbG9yX2JhO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnNoYWRvd3NbcXVhZCAqIDQgKiAzICsgMTFdID0gc2hhZG93X29mZnNldF94eTtcblxuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnF1YWQrKztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHJldHJ5VXBkYXRlTWVzaGVzKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFzIHdlIG9ubHkgYnJlYWsgbGluZXMgd2hlbiB0aGUgdGV4dCBiZWNvbWVzIHRvbyB3aWRlIGZvciB0aGUgY29udGFpbmVyLFxuICAgICAgICAgICAgLy8gdGhlcmUgd2lsbCBhbG1vc3QgYWx3YXlzIGJlIHNvbWUgbGVmdG92ZXIgdGV4dCBvbiB0aGUgZmluYWwgbGluZSB3aGljaCBoYXNcbiAgICAgICAgICAgIC8vIG5vdCB5ZXQgYmVlbiBwdXNoZWQgdG8gX2xpbmVDb250ZW50cy5cbiAgICAgICAgICAgIGlmIChsaW5lU3RhcnRJbmRleCA8IGwpIHtcbiAgICAgICAgICAgICAgICBicmVha0xpbmUodGhpcy5fc3ltYm9scywgbCwgX3gpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yY2UgYXV0b1dpZHRoIC8gYXV0b0hlaWdodCBjaGFuZ2UgdG8gdXBkYXRlIHdpZHRoL2hlaWdodCBvZiBlbGVtZW50XG4gICAgICAgIHRoaXMuX25vUmVzaXplID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5hdXRvV2lkdGggPSB0aGlzLl9hdXRvV2lkdGg7XG4gICAgICAgIHRoaXMuYXV0b0hlaWdodCA9IHRoaXMuX2F1dG9IZWlnaHQ7XG4gICAgICAgIHRoaXMuX25vUmVzaXplID0gZmFsc2U7XG5cbiAgICAgICAgLy8gb2Zmc2V0IGZvciBwaXZvdCBhbmQgYWxpZ25tZW50XG4gICAgICAgIGNvbnN0IGhwID0gdGhpcy5fZWxlbWVudC5waXZvdC54O1xuICAgICAgICBjb25zdCB2cCA9IHRoaXMuX2VsZW1lbnQucGl2b3QueTtcbiAgICAgICAgY29uc3QgaGEgPSB0aGlzLl9hbGlnbm1lbnQueDtcbiAgICAgICAgY29uc3QgdmEgPSB0aGlzLl9hbGlnbm1lbnQueTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21lc2hJbmZvLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbWVzaEluZm9baV0uY291bnQgPT09IDApIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgcHJldlF1YWQgPSAwO1xuICAgICAgICAgICAgZm9yIChjb25zdCBsaW5lIGluIHRoaXMuX21lc2hJbmZvW2ldLmxpbmVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLl9tZXNoSW5mb1tpXS5saW5lc1tsaW5lXTtcbiAgICAgICAgICAgICAgICBjb25zdCBsdyA9IHRoaXMuX2xpbmVXaWR0aHNbcGFyc2VJbnQobGluZSwgMTApXTtcbiAgICAgICAgICAgICAgICBjb25zdCBob2Zmc2V0ID0gLWhwICogdGhpcy5fZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggKyBoYSAqICh0aGlzLl9lbGVtZW50LmNhbGN1bGF0ZWRXaWR0aCAtIGx3KSAqICh0aGlzLl9ydGwgPyAtMSA6IDEpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHZvZmZzZXQgPSAoMSAtIHZwKSAqIHRoaXMuX2VsZW1lbnQuY2FsY3VsYXRlZEhlaWdodCAtIGZvbnRNYXhZIC0gKDEgLSB2YSkgKiAodGhpcy5fZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0IC0gdGhpcy5oZWlnaHQpO1xuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgcXVhZCA9IHByZXZRdWFkOyBxdWFkIDw9IGluZGV4OyBxdWFkKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW3F1YWQgKiA0ICogM10gKz0gaG9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDNdICs9IGhvZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyA2XSArPSBob2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgOV0gKz0gaG9mZnNldDtcblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgMV0gKz0gdm9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDRdICs9IHZvZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyA3XSArPSB2b2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgMTBdICs9IHZvZmZzZXQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZmxpcCBydGwgY2hhcmFjdGVyc1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9ydGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgcXVhZCA9IHByZXZRdWFkOyBxdWFkIDw9IGluZGV4OyBxdWFkKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlkeCA9IHF1YWQgKiA0ICogMztcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmxpcCB0aGUgZW50aXJlIGxpbmUgaG9yaXpvbnRhbGx5XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB2ZXJ0ID0gMDsgdmVydCA8IDQ7ICsrdmVydCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1tpZHggKyB2ZXJ0ICogM10gPVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbGVtZW50LmNhbGN1bGF0ZWRXaWR0aCAtIHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1tpZHggKyB2ZXJ0ICogM10gKyBob2Zmc2V0ICogMjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZmxpcCB0aGUgY2hhcmFjdGVyIGhvcml6b250YWxseVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdG1wMCA9IHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1tpZHggKyAzXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRtcDEgPSB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbaWR4ICsgNl07XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbaWR4ICsgM10gPSB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbaWR4ICsgMF07XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbaWR4ICsgNl0gPSB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbaWR4ICsgOV07XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbaWR4ICsgMF0gPSB0bXAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW2lkeCArIDldID0gdG1wMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHByZXZRdWFkID0gaW5kZXggKyAxO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB1cGRhdGUgdmVydGV4IGJ1ZmZlclxuICAgICAgICAgICAgY29uc3QgbnVtVmVydGljZXMgPSB0aGlzLl9tZXNoSW5mb1tpXS5jb3VudCAqIDQ7IC8vIG51bWJlciBvZiB2ZXJ0cyB3ZSBhbGxvY2F0ZWRcbiAgICAgICAgICAgIGNvbnN0IHZlcnRNYXggPSB0aGlzLl9tZXNoSW5mb1tpXS5xdWFkICogNDsgIC8vIG51bWJlciBvZiB2ZXJ0cyB3ZSBuZWVkICh1c3VhbGx5IGNvdW50IG1pbnVzIGxpbmUgYnJlYWsgY2hhcmFjdGVycylcbiAgICAgICAgICAgIGNvbnN0IGl0ID0gbmV3IFZlcnRleEl0ZXJhdG9yKHRoaXMuX21lc2hJbmZvW2ldLm1lc2hJbnN0YW5jZS5tZXNoLnZlcnRleEJ1ZmZlcik7XG4gICAgICAgICAgICBmb3IgKGxldCB2ID0gMDsgdiA8IG51bVZlcnRpY2VzOyB2KyspIHtcbiAgICAgICAgICAgICAgICBpZiAodiA+PSB2ZXJ0TWF4KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNsZWFyIHVudXNlZCB2ZXJ0aWNlc1xuICAgICAgICAgICAgICAgICAgICBpdC5lbGVtZW50W1NFTUFOVElDX1BPU0lUSU9OXS5zZXQoMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIGl0LmVsZW1lbnRbU0VNQU5USUNfVEVYQ09PUkQwXS5zZXQoMCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIGl0LmVsZW1lbnRbU0VNQU5USUNfQ09MT1JdLnNldCgwLCAwLCAwLCAwKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gb3V0bGluZVxuICAgICAgICAgICAgICAgICAgICBpdC5lbGVtZW50W1NFTUFOVElDX0FUVFI4XS5zZXQoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIHNoYWRvd1xuICAgICAgICAgICAgICAgICAgICBpdC5lbGVtZW50W1NFTUFOVElDX0FUVFI5XS5zZXQoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaXQuZWxlbWVudFtTRU1BTlRJQ19QT1NJVElPTl0uc2V0KHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1t2ICogMyArIDBdLCB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbdiAqIDMgKyAxXSwgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW3YgKiAzICsgMl0pO1xuICAgICAgICAgICAgICAgICAgICBpdC5lbGVtZW50W1NFTUFOVElDX1RFWENPT1JEMF0uc2V0KHRoaXMuX21lc2hJbmZvW2ldLnV2c1t2ICogMiArIDBdLCB0aGlzLl9tZXNoSW5mb1tpXS51dnNbdiAqIDIgKyAxXSk7XG4gICAgICAgICAgICAgICAgICAgIGl0LmVsZW1lbnRbU0VNQU5USUNfQ09MT1JdLnNldCh0aGlzLl9tZXNoSW5mb1tpXS5jb2xvcnNbdiAqIDQgKyAwXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLmNvbG9yc1t2ICogNCArIDFdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0uY29sb3JzW3YgKiA0ICsgMl0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5jb2xvcnNbdiAqIDQgKyAzXSk7XG4gICAgICAgICAgICAgICAgICAgIGl0LmVsZW1lbnRbU0VNQU5USUNfQVRUUjhdLnNldCh0aGlzLl9tZXNoSW5mb1tpXS5vdXRsaW5lc1t2ICogMyArIDBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ub3V0bGluZXNbdiAqIDMgKyAxXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLm91dGxpbmVzW3YgKiAzICsgMl0pO1xuICAgICAgICAgICAgICAgICAgICBpdC5lbGVtZW50W1NFTUFOVElDX0FUVFI5XS5zZXQodGhpcy5fbWVzaEluZm9baV0uc2hhZG93c1t2ICogMyArIDBdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0uc2hhZG93c1t2ICogMyArIDFdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0uc2hhZG93c1t2ICogMyArIDJdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaXQubmV4dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaXQuZW5kKCk7XG5cbiAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLm1lc2hJbnN0YW5jZS5tZXNoLmFhYmIuY29tcHV0ZSh0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnMpO1xuXG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGUgbWVzaEluc3RhbmNlIGFhYmJcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLm1lc2hJbnN0YW5jZS5fYWFiYlZlciA9IC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmxhZyB0ZXh0IGVsZW1lbnQgYWFiYiB0byBiZSB1cGRhdGVkXG4gICAgICAgIHRoaXMuX2FhYmJEaXJ0eSA9IHRydWU7XG4gICAgfVxuXG4gICAgX29uRm9udFJlbmRlcigpIHtcbiAgICAgICAgLy8gaWYgdGhlIGZvbnQgaGFzIGJlZW4gY2hhbmdlZCAoZS5nLiBjYW52YXNmb250IHJlLXJlbmRlcilcbiAgICAgICAgLy8gcmUtYXBwbHlpbmcgdGhlIHNhbWUgZm9udCB1cGRhdGVzIGNoYXJhY3RlciBtYXAgYW5kIGVuc3VyZXNcbiAgICAgICAgLy8gZXZlcnl0aGluZyBpcyB1cCB0byBkYXRlLlxuICAgICAgICB0aGlzLmZvbnQgPSB0aGlzLl9mb250O1xuICAgIH1cblxuICAgIF9vbkZvbnRMb2FkKGFzc2V0KSB7XG4gICAgICAgIGlmICh0aGlzLmZvbnQgIT09IGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLmZvbnQgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkZvbnRDaGFuZ2UoYXNzZXQsIG5hbWUsIF9uZXcsIF9vbGQpIHtcbiAgICAgICAgaWYgKG5hbWUgPT09ICdkYXRhJykge1xuICAgICAgICAgICAgdGhpcy5fZm9udC5kYXRhID0gX25ldztcblxuICAgICAgICAgICAgY29uc3QgbWFwcyA9IHRoaXMuX2ZvbnQuZGF0YS5pbmZvLm1hcHMubGVuZ3RoO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXBzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX21lc2hJbmZvW2ldKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluZm9baV0ubWVzaEluc3RhbmNlO1xuICAgICAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ2ZvbnRfc2RmSW50ZW5zaXR5JywgdGhpcy5fZm9udC5pbnRlbnNpdHkpO1xuICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ2ZvbnRfcHhyYW5nZScsIHRoaXMuX2dldFB4UmFuZ2UodGhpcy5fZm9udCkpO1xuICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ2ZvbnRfdGV4dHVyZVdpZHRoJywgdGhpcy5fZm9udC5kYXRhLmluZm8ubWFwc1tpXS53aWR0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uRm9udFJlbW92ZShhc3NldCkge1xuXG4gICAgfVxuXG4gICAgX3NldFRleHR1cmVQYXJhbXMobWksIHRleHR1cmUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9mb250LnR5cGUgPT09IEZPTlRfTVNERikge1xuICAgICAgICAgICAgICAgIG1pLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcpO1xuICAgICAgICAgICAgICAgIG1pLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJyk7XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX21zZGZNYXAnLCB0ZXh0dXJlKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5fZm9udC50eXBlID09PSBGT05UX0JJVE1BUCkge1xuICAgICAgICAgICAgICAgIG1pLmRlbGV0ZVBhcmFtZXRlcigndGV4dHVyZV9tc2RmTWFwJyk7XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VtaXNzaXZlTWFwJywgdGV4dHVyZSk7XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX29wYWNpdHlNYXAnLCB0ZXh0dXJlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9nZXRQeFJhbmdlKGZvbnQpIHtcbiAgICAgICAgLy8gY2FsY3VsYXRlIHB4cmFuZ2UgZnJvbSByYW5nZSBhbmQgc2NhbGUgcHJvcGVydGllcyBvbiBhIGNoYXJhY3RlclxuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXModGhpcy5fZm9udC5kYXRhLmNoYXJzKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjaGFyID0gdGhpcy5fZm9udC5kYXRhLmNoYXJzW2tleXNbaV1dO1xuICAgICAgICAgICAgaWYgKGNoYXIucmFuZ2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKGNoYXIuc2NhbGUgfHwgMSkgKiBjaGFyLnJhbmdlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiAyOyAvLyBkZWZhdWx0XG4gICAgfVxuXG4gICAgX2dldFV2KGNoYXIpIHtcbiAgICAgICAgY29uc3QgZGF0YSA9IHRoaXMuX2ZvbnQuZGF0YTtcblxuICAgICAgICBpZiAoIWRhdGEuY2hhcnNbY2hhcl0pIHtcbiAgICAgICAgICAgIC8vIG1pc3NpbmcgY2hhciAtIHJldHVybiBcInNwYWNlXCIgaWYgd2UgaGF2ZSBpdFxuICAgICAgICAgICAgY29uc3Qgc3BhY2UgPSAnICc7XG4gICAgICAgICAgICBpZiAoZGF0YS5jaGFyc1tzcGFjZV0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0VXYoc3BhY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UgLSBtaXNzaW5nIGNoYXJcbiAgICAgICAgICAgIHJldHVybiBbMCwgMCwgMCwgMF07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYXAgPSBkYXRhLmNoYXJzW2NoYXJdLm1hcDtcbiAgICAgICAgY29uc3Qgd2lkdGggPSBkYXRhLmluZm8ubWFwc1ttYXBdLndpZHRoO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBkYXRhLmluZm8ubWFwc1ttYXBdLmhlaWdodDtcblxuICAgICAgICBjb25zdCB4ID0gZGF0YS5jaGFyc1tjaGFyXS54O1xuICAgICAgICBjb25zdCB5ID0gIGRhdGEuY2hhcnNbY2hhcl0ueTtcblxuICAgICAgICBjb25zdCB4MSA9IHg7XG4gICAgICAgIGNvbnN0IHkxID0geTtcbiAgICAgICAgY29uc3QgeDIgPSAoeCArIGRhdGEuY2hhcnNbY2hhcl0ud2lkdGgpO1xuICAgICAgICBjb25zdCB5MiA9ICh5IC0gZGF0YS5jaGFyc1tjaGFyXS5oZWlnaHQpO1xuICAgICAgICBjb25zdCBlZGdlID0gMSAtIChkYXRhLmNoYXJzW2NoYXJdLmhlaWdodCAvIGhlaWdodCk7XG4gICAgICAgIHJldHVybiBbXG4gICAgICAgICAgICB4MSAvIHdpZHRoLFxuICAgICAgICAgICAgZWRnZSAtICh5MSAvIGhlaWdodCksIC8vIGJvdHRvbSBsZWZ0XG5cbiAgICAgICAgICAgICh4MiAvIHdpZHRoKSxcbiAgICAgICAgICAgIGVkZ2UgLSAoeTIgLyBoZWlnaHQpICAvLyB0b3AgcmlnaHRcbiAgICAgICAgXTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fZm9udEFzc2V0LmF1dG9Mb2FkID0gdHJ1ZTtcblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuYWRkTW9kZWxUb0xheWVycyh0aGlzLl9tb2RlbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuX2ZvbnRBc3NldC5hdXRvTG9hZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5yZW1vdmVNb2RlbEZyb21MYXllcnModGhpcy5fbW9kZWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldFN0ZW5jaWwoc3RlbmNpbFBhcmFtcykge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zdGVuY2lsRnJvbnQgPSBzdGVuY2lsUGFyYW1zO1xuICAgICAgICAgICAgICAgIGluc3RhbmNlc1tpXS5zdGVuY2lsQmFjayA9IHN0ZW5jaWxQYXJhbXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2hvdWxkQXV0b0ZpdFdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b0ZpdFdpZHRoICYmICF0aGlzLl9hdXRvV2lkdGg7XG4gICAgfVxuXG4gICAgX3Nob3VsZEF1dG9GaXRIZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdXRvRml0SGVpZ2h0ICYmICF0aGlzLl9hdXRvSGVpZ2h0O1xuICAgIH1cblxuICAgIF9zaG91bGRBdXRvRml0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b0ZpdFdpZHRoICYmICF0aGlzLl9hdXRvV2lkdGggfHxcbiAgICAgICAgICAgICAgIHRoaXMuX2F1dG9GaXRIZWlnaHQgJiYgIXRoaXMuX2F1dG9IZWlnaHQ7XG4gICAgfVxuXG4gICAgLy8gY2FsY3VsYXRlIHRoZSBudW1iZXIgb2YgY2hhcmFjdGVycyBwZXIgdGV4dHVyZSB1cCB0bywgYnV0IG5vdCBpbmNsdWRpbmdcbiAgICAvLyB0aGUgc3BlY2lmaWVkIHN5bWJvbEluZGV4XG4gICAgX2NhbGN1bGF0ZUNoYXJzUGVyVGV4dHVyZShzeW1ib2xJbmRleCkge1xuICAgICAgICBjb25zdCBjaGFyYWN0ZXJzUGVyVGV4dHVyZSA9IHt9O1xuXG4gICAgICAgIGlmIChzeW1ib2xJbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBzeW1ib2xJbmRleCA9IHRoaXMuX3N5bWJvbHMubGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHN5bWJvbEluZGV4OyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNoYXIgPSB0aGlzLl9zeW1ib2xzW2ldO1xuICAgICAgICAgICAgbGV0IGluZm8gPSB0aGlzLl9mb250LmRhdGEuY2hhcnNbY2hhcl07XG4gICAgICAgICAgICBpZiAoIWluZm8pIHtcbiAgICAgICAgICAgICAgICAvLyBpZiBjaGFyIGlzIG1pc3NpbmcgdXNlICdzcGFjZScgb3IgZmlyc3QgY2hhciBpbiBtYXBcbiAgICAgICAgICAgICAgICBpbmZvID0gdGhpcy5fZm9udC5kYXRhLmNoYXJzWycgJ107XG4gICAgICAgICAgICAgICAgaWYgKCFpbmZvKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIG90aGVyd2lzZSBpZiBzcGFjZSBpcyBhbHNvIG5vdCBwcmVzZW50IHVzZSB0aGUgZmlyc3QgY2hhcmFjdGVyIGluIHRoZVxuICAgICAgICAgICAgICAgICAgICAvLyBzZXRcbiAgICAgICAgICAgICAgICAgICAgaW5mbyA9IHRoaXMuX2ZvbnQuZGF0YS5jaGFyc1tPYmplY3Qua2V5cyh0aGlzLl9mb250LmRhdGEuY2hhcnMpWzBdXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1hcCA9IGluZm8ubWFwO1xuICAgICAgICAgICAgaWYgKCFjaGFyYWN0ZXJzUGVyVGV4dHVyZVttYXBdKSB7XG4gICAgICAgICAgICAgICAgY2hhcmFjdGVyc1BlclRleHR1cmVbbWFwXSA9IDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNoYXJhY3RlcnNQZXJUZXh0dXJlW21hcF0rKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hhcmFjdGVyc1BlclRleHR1cmU7XG4gICAgfVxuXG4gICAgX3VwZGF0ZVJlbmRlclJhbmdlKCkge1xuICAgICAgICBjb25zdCBzdGFydENoYXJzID0gdGhpcy5fcmFuZ2VTdGFydCA9PT0gMCA/IDAgOiB0aGlzLl9jYWxjdWxhdGVDaGFyc1BlclRleHR1cmUodGhpcy5fcmFuZ2VTdGFydCk7XG4gICAgICAgIGNvbnN0IGVuZENoYXJzID0gdGhpcy5fcmFuZ2VFbmQgPT09IDAgPyAwIDogdGhpcy5fY2FsY3VsYXRlQ2hhcnNQZXJUZXh0dXJlKHRoaXMuX3JhbmdlRW5kKTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbWVzaEluZm8ubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXJ0ID0gc3RhcnRDaGFyc1tpXSB8fCAwO1xuICAgICAgICAgICAgY29uc3QgZW5kID0gZW5kQ2hhcnNbaV0gfHwgMDtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlID0gdGhpcy5fbWVzaEluZm9baV0ubWVzaEluc3RhbmNlO1xuICAgICAgICAgICAgaWYgKGluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IGluc3RhbmNlLm1lc2g7XG4gICAgICAgICAgICAgICAgaWYgKG1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaC5wcmltaXRpdmVbMF0uYmFzZSA9IHN0YXJ0ICogMyAqIDI7XG4gICAgICAgICAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmNvdW50ID0gKGVuZCAtIHN0YXJ0KSAqIDMgKiAyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldCB0ZXh0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2kxOG5LZXkgPSBudWxsO1xuICAgICAgICBjb25zdCBzdHIgPSB2YWx1ZSAhPSBudWxsICYmIHZhbHVlLnRvU3RyaW5nKCkgfHwgJyc7XG4gICAgICAgIHRoaXMuX3NldFRleHQoc3RyKTtcbiAgICB9XG5cbiAgICBnZXQgdGV4dCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RleHQ7XG4gICAgfVxuXG4gICAgc2V0IGtleSh2YWx1ZSkge1xuICAgICAgICBjb25zdCBzdHIgPSB2YWx1ZSAhPT0gbnVsbCA/IHZhbHVlLnRvU3RyaW5nKCkgOiBudWxsO1xuICAgICAgICBpZiAodGhpcy5faTE4bktleSA9PT0gc3RyKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9pMThuS2V5ID0gc3RyO1xuICAgICAgICBpZiAoc3RyKSB7XG4gICAgICAgICAgICB0aGlzLl9mb250QXNzZXQuZGlzYWJsZUxvY2FsaXphdGlvbiA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5fcmVzZXRMb2NhbGl6ZWRUZXh0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9mb250QXNzZXQuZGlzYWJsZUxvY2FsaXphdGlvbiA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQga2V5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faTE4bktleTtcbiAgICB9XG5cbiAgICBzZXQgY29sb3IodmFsdWUpIHtcbiAgICAgICAgY29uc3QgciA9IHZhbHVlLnI7XG4gICAgICAgIGNvbnN0IGcgPSB2YWx1ZS5nO1xuICAgICAgICBjb25zdCBiID0gdmFsdWUuYjtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh0aGlzLl9jb2xvciA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignU2V0dGluZyBlbGVtZW50LmNvbG9yIHRvIGl0c2VsZiB3aWxsIGhhdmUgbm8gZWZmZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKHRoaXMuX2NvbG9yLnIgPT09IHIgJiZcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmcgPT09IGcgJiZcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmIgPT09IGIpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NvbG9yLnIgPSByO1xuICAgICAgICB0aGlzLl9jb2xvci5nID0gZztcbiAgICAgICAgdGhpcy5fY29sb3IuYiA9IGI7XG5cbiAgICAgICAgaWYgKCF0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3N5bWJvbENvbG9ycykge1xuICAgICAgICAgICAgLy8gY29sb3IgaXMgYmFrZWQgaW50byB2ZXJ0aWNlcywgdXBkYXRlIHRleHRcbiAgICAgICAgICAgIGlmICh0aGlzLl9mb250KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzBdID0gdGhpcy5fY29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsxXSA9IHRoaXMuX2NvbG9yLmc7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9jb2xvci5iO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2VtaXNzaXZlJywgdGhpcy5fY29sb3JVbmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9lbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmZpcmUoJ3NldDpjb2xvcicsIHRoaXMuX2NvbG9yKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjb2xvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yO1xuICAgIH1cblxuICAgIHNldCBvcGFjaXR5KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb2xvci5hICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fY29sb3IuYSA9IHZhbHVlO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5maXJlKCdzZXQ6b3BhY2l0eScsIHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvcGFjaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3IuYTtcbiAgICB9XG5cbiAgICBzZXQgbGluZUhlaWdodCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBfcHJldiA9IHRoaXMuX2xpbmVIZWlnaHQ7XG4gICAgICAgIHRoaXMuX2xpbmVIZWlnaHQgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fc2NhbGVkTGluZUhlaWdodCA9IHZhbHVlO1xuICAgICAgICBpZiAoX3ByZXYgIT09IHZhbHVlICYmIHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaW5lSGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGluZUhlaWdodDtcbiAgICB9XG5cbiAgICBzZXQgd3JhcExpbmVzKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IF9wcmV2ID0gdGhpcy5fd3JhcExpbmVzO1xuICAgICAgICB0aGlzLl93cmFwTGluZXMgPSB2YWx1ZTtcbiAgICAgICAgaWYgKF9wcmV2ICE9PSB2YWx1ZSAmJiB0aGlzLl9mb250KSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgd3JhcExpbmVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fd3JhcExpbmVzO1xuICAgIH1cblxuICAgIGdldCBsaW5lcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVDb250ZW50cztcbiAgICB9XG5cbiAgICBzZXQgc3BhY2luZyh2YWx1ZSkge1xuICAgICAgICBjb25zdCBfcHJldiA9IHRoaXMuX3NwYWNpbmc7XG4gICAgICAgIHRoaXMuX3NwYWNpbmcgPSB2YWx1ZTtcbiAgICAgICAgaWYgKF9wcmV2ICE9PSB2YWx1ZSAmJiB0aGlzLl9mb250KSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc3BhY2luZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwYWNpbmc7XG4gICAgfVxuXG4gICAgc2V0IGZvbnRTaXplKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IF9wcmV2ID0gdGhpcy5fZm9udFNpemU7XG4gICAgICAgIHRoaXMuX2ZvbnRTaXplID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX29yaWdpbmFsRm9udFNpemUgPSB2YWx1ZTtcbiAgICAgICAgaWYgKF9wcmV2ICE9PSB2YWx1ZSAmJiB0aGlzLl9mb250KSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZm9udFNpemUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mb250U2l6ZTtcbiAgICB9XG5cbiAgICBzZXQgZm9udEFzc2V0KHZhbHVlKSB7XG4gICAgICAgIC8vIHNldHRpbmcgdGhlIGZvbnRBc3NldCBzZXRzIHRoZSBkZWZhdWx0IGFzc2V0cyB3aGljaCBpbiB0dXJuXG4gICAgICAgIC8vIHdpbGwgc2V0IHRoZSBsb2NhbGl6ZWQgYXNzZXQgdG8gYmUgYWN0dWFsbHkgdXNlZFxuICAgICAgICB0aGlzLl9mb250QXNzZXQuZGVmYXVsdEFzc2V0ID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGZvbnRBc3NldCgpIHtcbiAgICAgICAgLy8gZ2V0dGluZyBmb250QXNzZXQgcmV0dXJucyB0aGUgY3VycmVudGx5IHVzZWQgbG9jYWxpemVkIGFzc2V0XG4gICAgICAgIHJldHVybiB0aGlzLl9mb250QXNzZXQubG9jYWxpemVkQXNzZXQ7XG4gICAgfVxuXG4gICAgc2V0IGZvbnQodmFsdWUpIHtcbiAgICAgICAgbGV0IHByZXZpb3VzRm9udFR5cGU7XG5cbiAgICAgICAgaWYgKHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgIHByZXZpb3VzRm9udFR5cGUgPSB0aGlzLl9mb250LnR5cGU7XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSByZW5kZXIgZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgICAgIGlmICh0aGlzLl9mb250Lm9mZikgdGhpcy5fZm9udC5vZmYoJ3JlbmRlcicsIHRoaXMuX29uRm9udFJlbmRlciwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9mb250ID0gdmFsdWU7XG5cbiAgICAgICAgdGhpcy5fZm9udE1pblkgPSAwO1xuICAgICAgICB0aGlzLl9mb250TWF4WSA9IDA7XG5cbiAgICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIC8vIGNhbGN1bGF0ZSBtaW4gLyBtYXggZm9udCBleHRlbnRzIGZyb20gYWxsIGF2YWlsYWJsZSBjaGFyc1xuICAgICAgICBjb25zdCBqc29uID0gdGhpcy5fZm9udC5kYXRhO1xuICAgICAgICBmb3IgKGNvbnN0IGNoYXJJZCBpbiBqc29uLmNoYXJzKSB7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0ganNvbi5jaGFyc1tjaGFySWRdO1xuICAgICAgICAgICAgaWYgKGRhdGEuYm91bmRzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZm9udE1pblkgPSBNYXRoLm1pbih0aGlzLl9mb250TWluWSwgZGF0YS5ib3VuZHNbMV0pO1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZvbnRNYXhZID0gTWF0aC5tYXgodGhpcy5fZm9udE1heFksIGRhdGEuYm91bmRzWzNdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGF0dGFjaCByZW5kZXIgZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgaWYgKHRoaXMuX2ZvbnQub24pIHRoaXMuX2ZvbnQub24oJ3JlbmRlcicsIHRoaXMuX29uRm9udFJlbmRlciwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2ZvbnRBc3NldC5sb2NhbGl6ZWRBc3NldCkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSB0aGlzLl9zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5fZm9udEFzc2V0LmxvY2FsaXplZEFzc2V0KTtcbiAgICAgICAgICAgIC8vIGlmIHdlJ3JlIHNldHRpbmcgYSBmb250IGRpcmVjdGx5IHdoaWNoIGRvZXNuJ3QgbWF0Y2ggdGhlIGFzc2V0XG4gICAgICAgICAgICAvLyB0aGVuIGNsZWFyIHRoZSBhc3NldFxuICAgICAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl9mb250KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZm9udEFzc2V0LmRlZmF1bHRBc3NldCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBmb250IHR5cGUgaGFzIGNoYW5nZWQgd2UgbWF5IG5lZWQgdG8gZ2V0IGNoYW5nZSBtYXRlcmlhbFxuICAgICAgICBpZiAodmFsdWUudHlwZSAhPT0gcHJldmlvdXNGb250VHlwZSkge1xuICAgICAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbChzY3JlZW5TcGFjZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYWtlIHN1cmUgd2UgaGF2ZSBhcyBtYW55IG1lc2hJbmZvIGVudHJpZXNcbiAgICAgICAgLy8gYXMgdGhlIG51bWJlciBvZiBmb250IHRleHR1cmVzXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9mb250LnRleHR1cmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX21lc2hJbmZvW2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0gPSBuZXcgTWVzaEluZm8oKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8ga2VlcCBleGlzdGluZyBlbnRyeSBidXQgc2V0IGNvcnJlY3QgcGFyYW1ldGVycyB0byBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5mb1tpXS5tZXNoSW5zdGFuY2U7XG4gICAgICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignZm9udF9zZGZJbnRlbnNpdHknLCB0aGlzLl9mb250LmludGVuc2l0eSk7XG4gICAgICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignZm9udF9weHJhbmdlJywgdGhpcy5fZ2V0UHhSYW5nZSh0aGlzLl9mb250KSk7XG4gICAgICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignZm9udF90ZXh0dXJlV2lkdGgnLCB0aGlzLl9mb250LmRhdGEuaW5mby5tYXBzW2ldLndpZHRoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0VGV4dHVyZVBhcmFtcyhtaSwgdGhpcy5fZm9udC50ZXh0dXJlc1tpXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVzdHJveSBhbnkgZXhjZXNzIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgIGxldCByZW1vdmVkTW9kZWwgPSBmYWxzZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuX2ZvbnQudGV4dHVyZXMubGVuZ3RoOyBpIDwgdGhpcy5fbWVzaEluZm8ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5mb1tpXS5tZXNoSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlbW92ZWRNb2RlbCkge1xuICAgICAgICAgICAgICAgICAgICAvLyByZW1vdmUgbW9kZWwgZnJvbSBzY2VuZSBzbyB0aGF0IGV4Y2VzcyBtZXNoIGluc3RhbmNlcyBhcmUgcmVtb3ZlZFxuICAgICAgICAgICAgICAgICAgICAvLyBmcm9tIHRoZSBzY2VuZSBhcyB3ZWxsXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKHRoaXMuX21vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZE1vZGVsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVtb3ZlTWVzaEluc3RhbmNlKHRoaXMuX21lc2hJbmZvW2ldLm1lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluZm8ubGVuZ3RoID4gdGhpcy5fZm9udC50ZXh0dXJlcy5sZW5ndGgpXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5mby5sZW5ndGggPSB0aGlzLl9mb250LnRleHR1cmVzLmxlbmd0aDtcblxuICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgfVxuXG4gICAgZ2V0IGZvbnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mb250O1xuICAgIH1cblxuICAgIHNldCBhbGlnbm1lbnQodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVmVjMikge1xuICAgICAgICAgICAgdGhpcy5fYWxpZ25tZW50LnNldCh2YWx1ZS54LCB2YWx1ZS55KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2FsaWdubWVudC5zZXQodmFsdWVbMF0sIHZhbHVlWzFdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9mb250KVxuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgIH1cblxuICAgIGdldCBhbGlnbm1lbnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hbGlnbm1lbnQ7XG4gICAgfVxuXG4gICAgc2V0IGF1dG9XaWR0aCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLl9hdXRvV2lkdGg7XG4gICAgICAgIHRoaXMuX2F1dG9XaWR0aCA9IHZhbHVlO1xuXG4gICAgICAgIC8vIGNoYW5nZSB3aWR0aCBvZiBlbGVtZW50IHRvIG1hdGNoIHRleHQgd2lkdGggYnV0IG9ubHkgaWYgdGhlIGVsZW1lbnRcbiAgICAgICAgLy8gZG9lcyBub3QgaGF2ZSBzcGxpdCBob3Jpem9udGFsIGFuY2hvcnNcbiAgICAgICAgaWYgKHZhbHVlICYmIE1hdGguYWJzKHRoaXMuX2VsZW1lbnQuYW5jaG9yLnggLSB0aGlzLl9lbGVtZW50LmFuY2hvci56KSA8IDAuMDAwMSkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC53aWR0aCA9IHRoaXMud2lkdGg7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXN0b3JlIGZvbnRTaXplIGlmIGF1dG9XaWR0aCBjaGFuZ2VkXG4gICAgICAgIGlmIChvbGQgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdGb250U2l6ZSA9IHRoaXMuX3Nob3VsZEF1dG9GaXQoKSA/IHRoaXMuX21heEZvbnRTaXplIDogdGhpcy5fb3JpZ2luYWxGb250U2l6ZTtcbiAgICAgICAgICAgIGlmIChuZXdGb250U2l6ZSAhPT0gdGhpcy5fZm9udFNpemUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9mb250U2l6ZSA9IG5ld0ZvbnRTaXplO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9mb250KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXV0b1dpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b1dpZHRoO1xuICAgIH1cblxuICAgIHNldCBhdXRvSGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IG9sZCA9IHRoaXMuX2F1dG9IZWlnaHQ7XG4gICAgICAgIHRoaXMuX2F1dG9IZWlnaHQgPSB2YWx1ZTtcblxuICAgICAgICAvLyBjaGFuZ2UgaGVpZ2h0IG9mIGVsZW1lbnQgdG8gbWF0Y2ggdGV4dCBoZWlnaHQgYnV0IG9ubHkgaWYgdGhlIGVsZW1lbnRcbiAgICAgICAgLy8gZG9lcyBub3QgaGF2ZSBzcGxpdCB2ZXJ0aWNhbCBhbmNob3JzXG4gICAgICAgIGlmICh2YWx1ZSAmJiBNYXRoLmFicyh0aGlzLl9lbGVtZW50LmFuY2hvci55IC0gdGhpcy5fZWxlbWVudC5hbmNob3IudykgPCAwLjAwMDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuaGVpZ2h0ID0gdGhpcy5oZWlnaHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyByZXN0b3JlIGZvbnRTaXplIGlmIGF1dG9IZWlnaHQgY2hhbmdlZFxuICAgICAgICBpZiAob2xkICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgbmV3Rm9udFNpemUgPSB0aGlzLl9zaG91bGRBdXRvRml0KCkgPyB0aGlzLl9tYXhGb250U2l6ZSA6IHRoaXMuX29yaWdpbmFsRm9udFNpemU7XG4gICAgICAgICAgICBpZiAobmV3Rm9udFNpemUgIT09IHRoaXMuX2ZvbnRTaXplKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZm9udFNpemUgPSBuZXdGb250U2l6ZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZm9udCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9IZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdXRvSGVpZ2h0O1xuICAgIH1cblxuICAgIHNldCBydGxSZW9yZGVyKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9ydGxSZW9yZGVyICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcnRsUmVvcmRlciA9IHZhbHVlO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcnRsUmVvcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3J0bFJlb3JkZXI7XG4gICAgfVxuXG4gICAgc2V0IHVuaWNvZGVDb252ZXJ0ZXIodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3VuaWNvZGVDb252ZXJ0ZXIgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl91bmljb2RlQ29udmVydGVyID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9zZXRUZXh0KHRoaXMuX3RleHQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHVuaWNvZGVDb252ZXJ0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91bmljb2RlQ29udmVydGVyO1xuICAgIH1cblxuICAgIC8vIHByaXZhdGVcbiAgICBnZXQgYWFiYigpIHtcbiAgICAgICAgaWYgKHRoaXMuX2FhYmJEaXJ0eSkge1xuICAgICAgICAgICAgbGV0IGluaXRpYWxpemVkID0gZmFsc2U7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21lc2hJbmZvLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5mb1tpXS5tZXNoSW5zdGFuY2UpIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgaWYgKCFpbml0aWFsaXplZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hYWJiLmNvcHkodGhpcy5fbWVzaEluZm9baV0ubWVzaEluc3RhbmNlLmFhYmIpO1xuICAgICAgICAgICAgICAgICAgICBpbml0aWFsaXplZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWFiYi5hZGQodGhpcy5fbWVzaEluZm9baV0ubWVzaEluc3RhbmNlLmFhYmIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fYWFiYkRpcnR5ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2FhYmI7XG4gICAgfVxuXG4gICAgc2V0IG91dGxpbmVDb2xvcih2YWx1ZSkge1xuICAgICAgICBjb25zdCByID0gKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpID8gdmFsdWUuciA6IHZhbHVlWzBdO1xuICAgICAgICBjb25zdCBnID0gKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpID8gdmFsdWUuZyA6IHZhbHVlWzFdO1xuICAgICAgICBjb25zdCBiID0gKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpID8gdmFsdWUuYiA6IHZhbHVlWzJdO1xuICAgICAgICBjb25zdCBhID0gKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpID8gdmFsdWUuYSA6IHZhbHVlWzNdO1xuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRoaXMuX291dGxpbmVDb2xvciA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignU2V0dGluZyBlbGVtZW50Lm91dGxpbmVDb2xvciB0byBpdHNlbGYgd2lsbCBoYXZlIG5vIGVmZmVjdCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmICh0aGlzLl9vdXRsaW5lQ29sb3IuciA9PT0gciAmJlxuICAgICAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yLmcgPT09IGcgJiZcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvci5iID09PSBiICYmXG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3IuYSA9PT0gYSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yLnIgPSByO1xuICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3IuZyA9IGc7XG4gICAgICAgIHRoaXMuX291dGxpbmVDb2xvci5iID0gYjtcbiAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yLmEgPSBhO1xuXG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zeW1ib2xPdXRsaW5lUGFyYW1zKSB7XG4gICAgICAgICAgICAvLyBvdXRsaW5lIHBhcmFtZXRlcnMgYXJlIGJha2VkIGludG8gdmVydGljZXMsIHVwZGF0ZSB0ZXh0XG4gICAgICAgICAgICBpZiAodGhpcy5fZm9udCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9vdXRsaW5lQ29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9vdXRsaW5lQ29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9vdXRsaW5lQ29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bM10gPSB0aGlzLl9vdXRsaW5lQ29sb3IuYTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdvdXRsaW5lX2NvbG9yJywgdGhpcy5fb3V0bGluZUNvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5maXJlKCdzZXQ6b3V0bGluZScsIHRoaXMuX2NvbG9yKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvdXRsaW5lQ29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vdXRsaW5lQ29sb3I7XG4gICAgfVxuXG4gICAgc2V0IG91dGxpbmVUaGlja25lc3ModmFsdWUpIHtcbiAgICAgICAgY29uc3QgX3ByZXYgPSB0aGlzLl9vdXRsaW5lVGhpY2tuZXNzO1xuICAgICAgICB0aGlzLl9vdXRsaW5lVGhpY2tuZXNzID0gdmFsdWU7XG4gICAgICAgIGlmIChfcHJldiAhPT0gdmFsdWUgJiYgdGhpcy5fZm9udCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuX3N5bWJvbE91dGxpbmVQYXJhbXMpIHtcbiAgICAgICAgICAgICAgICAvLyBvdXRsaW5lIHBhcmFtZXRlcnMgYXJlIGJha2VkIGludG8gdmVydGljZXMsIHVwZGF0ZSB0ZXh0XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ291dGxpbmVfdGhpY2tuZXNzJywgdGhpcy5fb3V0bGluZVRoaWNrbmVzc1NjYWxlICogdGhpcy5fb3V0bGluZVRoaWNrbmVzcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG91dGxpbmVUaGlja25lc3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vdXRsaW5lVGhpY2tuZXNzO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dDb2xvcih2YWx1ZSkge1xuICAgICAgICBjb25zdCByID0gKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpID8gdmFsdWUuciA6IHZhbHVlWzBdO1xuICAgICAgICBjb25zdCBnID0gKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpID8gdmFsdWUuZyA6IHZhbHVlWzFdO1xuICAgICAgICBjb25zdCBiID0gKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpID8gdmFsdWUuYiA6IHZhbHVlWzJdO1xuICAgICAgICBjb25zdCBhID0gKHZhbHVlIGluc3RhbmNlb2YgQ29sb3IpID8gdmFsdWUuYSA6IHZhbHVlWzNdO1xuXG4gICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgaWYgKHRoaXMuX3NoYWRvd0NvbG9yID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgRGVidWcud2FybignU2V0dGluZyBlbGVtZW50LnNoYWRvd0NvbG9yIHRvIGl0c2VsZiB3aWxsIGhhdmUgbm8gZWZmZWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gI2VuZGlmXG5cbiAgICAgICAgaWYgKHRoaXMuX3NoYWRvd0NvbG9yLnIgPT09IHIgJiZcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yLmcgPT09IGcgJiZcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yLmIgPT09IGIgJiZcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yLmEgPT09IGEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yLnIgPSByO1xuICAgICAgICB0aGlzLl9zaGFkb3dDb2xvci5nID0gZztcbiAgICAgICAgdGhpcy5fc2hhZG93Q29sb3IuYiA9IGI7XG4gICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yLmEgPSBhO1xuXG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zeW1ib2xTaGFkb3dQYXJhbXMpIHtcbiAgICAgICAgICAgIC8vIHNoYWRvdyBwYXJhbWV0ZXJzIGFyZSBiYWtlZCBpbnRvIHZlcnRpY2VzLCB1cGRhdGUgdGV4dFxuICAgICAgICAgICAgaWYgKHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9zaGFkb3dDb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtWzFdID0gdGhpcy5fc2hhZG93Q29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX3NoYWRvd0NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvclVuaWZvcm1bM10gPSB0aGlzLl9zaGFkb3dDb2xvci5hO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ3NoYWRvd19jb2xvcicsIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2hhZG93Q29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkb3dDb2xvcjtcbiAgICB9XG5cbiAgICBzZXQgc2hhZG93T2Zmc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHggPSAodmFsdWUgaW5zdGFuY2VvZiBWZWMyKSA/IHZhbHVlLnggOiB2YWx1ZVswXSxcbiAgICAgICAgICAgIHkgPSAodmFsdWUgaW5zdGFuY2VvZiBWZWMyKSA/IHZhbHVlLnkgOiB2YWx1ZVsxXTtcbiAgICAgICAgaWYgKHRoaXMuX3NoYWRvd09mZnNldC54ID09PSB4ICYmIHRoaXMuX3NoYWRvd09mZnNldC55ID09PSB5KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0LnNldCh4LCB5KTtcblxuICAgICAgICBpZiAodGhpcy5fZm9udCAmJiB0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3N5bWJvbFNoYWRvd1BhcmFtcykge1xuICAgICAgICAgICAgICAgIC8vIHNoYWRvdyBwYXJhbWV0ZXJzIGFyZSBiYWtlZCBpbnRvIHZlcnRpY2VzLCB1cGRhdGUgdGV4dFxuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmF0aW8gPSAtdGhpcy5fZm9udC5kYXRhLmluZm8ubWFwc1tpXS53aWR0aCAvIHRoaXMuX2ZvbnQuZGF0YS5pbmZvLm1hcHNbaV0uaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dPZmZzZXRVbmlmb3JtWzBdID0gdGhpcy5fc2hhZG93T2Zmc2V0U2NhbGUgKiB0aGlzLl9zaGFkb3dPZmZzZXQueDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0VW5pZm9ybVsxXSA9IHJhdGlvICogdGhpcy5fc2hhZG93T2Zmc2V0U2NhbGUgKiB0aGlzLl9zaGFkb3dPZmZzZXQueTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ3NoYWRvd19vZmZzZXQnLCB0aGlzLl9zaGFkb3dPZmZzZXRVbmlmb3JtKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2hhZG93T2Zmc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2hhZG93T2Zmc2V0O1xuICAgIH1cblxuICAgIHNldCBtaW5Gb250U2l6ZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWluRm9udFNpemUgPT09IHZhbHVlKSByZXR1cm47XG4gICAgICAgIHRoaXMuX21pbkZvbnRTaXplID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuZm9udCAmJiB0aGlzLl9zaG91bGRBdXRvRml0KCkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtaW5Gb250U2l6ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21pbkZvbnRTaXplO1xuICAgIH1cblxuICAgIHNldCBtYXhGb250U2l6ZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWF4Rm9udFNpemUgPT09IHZhbHVlKSByZXR1cm47XG4gICAgICAgIHRoaXMuX21heEZvbnRTaXplID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuZm9udCAmJiB0aGlzLl9zaG91bGRBdXRvRml0KCkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXhGb250U2l6ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21heEZvbnRTaXplO1xuICAgIH1cblxuICAgIHNldCBhdXRvRml0V2lkdGgodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F1dG9GaXRXaWR0aCA9PT0gdmFsdWUpIHJldHVybjtcbiAgICAgICAgdGhpcy5fYXV0b0ZpdFdpZHRoID0gdmFsdWU7XG5cbiAgICAgICAgdGhpcy5fZm9udFNpemUgPSB0aGlzLl9zaG91bGRBdXRvRml0KCkgPyB0aGlzLl9tYXhGb250U2l6ZSA6IHRoaXMuX29yaWdpbmFsRm9udFNpemU7XG4gICAgICAgIGlmICh0aGlzLmZvbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhdXRvRml0V2lkdGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdXRvRml0V2lkdGg7XG4gICAgfVxuXG4gICAgc2V0IGF1dG9GaXRIZWlnaHQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F1dG9GaXRIZWlnaHQgPT09IHZhbHVlKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2F1dG9GaXRIZWlnaHQgPSB2YWx1ZTtcblxuICAgICAgICB0aGlzLl9mb250U2l6ZSA9IHRoaXMuX3Nob3VsZEF1dG9GaXQoKSA/IHRoaXMuX21heEZvbnRTaXplIDogdGhpcy5fb3JpZ2luYWxGb250U2l6ZTtcbiAgICAgICAgaWYgKHRoaXMuZm9udCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9GaXRIZWlnaHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hdXRvRml0SGVpZ2h0O1xuICAgIH1cblxuICAgIHNldCBtYXhMaW5lcyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWF4TGluZXMgPT09IHZhbHVlKSByZXR1cm47XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCAmJiB0aGlzLl9tYXhMaW5lcyA9PT0gLTEpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9tYXhMaW5lcyA9ICh2YWx1ZSA9PT0gbnVsbCA/IC0xIDogdmFsdWUpO1xuXG4gICAgICAgIGlmICh0aGlzLmZvbnQgJiYgdGhpcy5fd3JhcExpbmVzKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF4TGluZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXhMaW5lcztcbiAgICB9XG5cbiAgICBzZXQgZW5hYmxlTWFya3VwKHZhbHVlKSB7XG4gICAgICAgIHZhbHVlID0gISF2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZU1hcmt1cCA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9lbmFibGVNYXJrdXAgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5mb250KSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IHRoaXMuX2VsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoc2NyZWVuU3BhY2UpO1xuICAgIH1cblxuICAgIGdldCBlbmFibGVNYXJrdXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVNYXJrdXA7XG4gICAgfVxuXG4gICAgZ2V0IHN5bWJvbHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zeW1ib2xzO1xuICAgIH1cblxuICAgIGdldCBzeW1ib2xDb2xvcnMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zeW1ib2xDb2xvcnMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9zeW1ib2xDb2xvcnMubWFwKGZ1bmN0aW9uIChjKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fY29sb3JQYWxldHRlLnNsaWNlKGMgKiAzLCBjICogMyArIDMpO1xuICAgICAgICB9LCB0aGlzKTtcbiAgICB9XG5cbiAgICAvLyBOT1RFOiBpdCBpcyB1c2VkIG9ubHkgZm9yIHRlc3RzXG4gICAgZ2V0IHN5bWJvbE91dGxpbmVQYXJhbXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zeW1ib2xPdXRsaW5lUGFyYW1zID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc3ltYm9sT3V0bGluZVBhcmFtcy5tYXAoZnVuY3Rpb24gKHBhcmFtSWQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9vdXRsaW5lUGFsZXR0ZS5zbGljZShwYXJhbUlkICogNSwgcGFyYW1JZCAqIDUgKyA1KTtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLy8gTk9URTogaXQgaXMgdXNlZCBvbmx5IGZvciB0ZXN0c1xuICAgIGdldCBzeW1ib2xTaGFkb3dQYXJhbXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zeW1ib2xTaGFkb3dQYXJhbXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9zeW1ib2xTaGFkb3dQYXJhbXMubWFwKGZ1bmN0aW9uIChwYXJhbUlkKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2hhZG93UGFsZXR0ZS5zbGljZShwYXJhbUlkICogNiwgcGFyYW1JZCAqIDYgKyA2KTtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgZ2V0IHJ0bCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3J0bDtcbiAgICB9XG5cbiAgICBzZXQgcmFuZ2VTdGFydChyYW5nZVN0YXJ0KSB7XG4gICAgICAgIHJhbmdlU3RhcnQgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihyYW5nZVN0YXJ0LCB0aGlzLl9zeW1ib2xzLmxlbmd0aCkpO1xuXG4gICAgICAgIGlmIChyYW5nZVN0YXJ0ICE9PSB0aGlzLl9yYW5nZVN0YXJ0KSB7XG4gICAgICAgICAgICB0aGlzLl9yYW5nZVN0YXJ0ID0gcmFuZ2VTdGFydDtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVJlbmRlclJhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmFuZ2VTdGFydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JhbmdlU3RhcnQ7XG4gICAgfVxuXG4gICAgc2V0IHJhbmdlRW5kKHJhbmdlRW5kKSB7XG4gICAgICAgIHJhbmdlRW5kID0gTWF0aC5tYXgodGhpcy5fcmFuZ2VTdGFydCwgTWF0aC5taW4ocmFuZ2VFbmQsIHRoaXMuX3N5bWJvbHMubGVuZ3RoKSk7XG5cbiAgICAgICAgaWYgKHJhbmdlRW5kICE9PSB0aGlzLl9yYW5nZUVuZCkge1xuICAgICAgICAgICAgdGhpcy5fcmFuZ2VFbmQgPSByYW5nZUVuZDtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVJlbmRlclJhbmdlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmFuZ2VFbmQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yYW5nZUVuZDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFRleHRFbGVtZW50IH07XG4iXSwibmFtZXMiOlsiTWVzaEluZm8iLCJjb25zdHJ1Y3RvciIsImNvdW50IiwicXVhZCIsImxpbmVzIiwicG9zaXRpb25zIiwibm9ybWFscyIsInV2cyIsImNvbG9ycyIsImluZGljZXMiLCJvdXRsaW5lcyIsInNoYWRvd3MiLCJtZXNoSW5zdGFuY2UiLCJjcmVhdGVUZXh0TWVzaCIsImRldmljZSIsIm1lc2hJbmZvIiwibWVzaCIsIk1lc2giLCJzZXRQb3NpdGlvbnMiLCJzZXROb3JtYWxzIiwic2V0Q29sb3JzMzIiLCJzZXRVdnMiLCJzZXRJbmRpY2VzIiwic2V0VmVydGV4U3RyZWFtIiwiU0VNQU5USUNfQVRUUjgiLCJ1bmRlZmluZWQiLCJUWVBFX0ZMT0FUMzIiLCJTRU1BTlRJQ19BVFRSOSIsInVwZGF0ZSIsIkxJTkVfQlJFQUtfQ0hBUiIsIldISVRFU1BBQ0VfQ0hBUiIsIldPUkRfQk9VTkRBUllfQ0hBUiIsIkFMUEhBTlVNRVJJQ19DSEFSIiwiQ0pLX0NIQVIiLCJOT19MSU5FX0JSRUFLX0NKS19DSEFSIiwiQ09OVFJPTF9DSEFSUyIsIkNPTlRST0xfR0xZUEhfREFUQSIsIndpZHRoIiwiaGVpZ2h0IiwieGFkdmFuY2UiLCJ4b2Zmc2V0IiwieW9mZnNldCIsImNvbG9yVG1wIiwiQ29sb3IiLCJ2ZWMyVG1wIiwiVmVjMiIsIlRleHRFbGVtZW50IiwiZWxlbWVudCIsIl9lbGVtZW50IiwiX3N5c3RlbSIsInN5c3RlbSIsIl9lbnRpdHkiLCJlbnRpdHkiLCJfdGV4dCIsIl9zeW1ib2xzIiwiX2NvbG9yUGFsZXR0ZSIsIl9vdXRsaW5lUGFsZXR0ZSIsIl9zaGFkb3dQYWxldHRlIiwiX3N5bWJvbENvbG9ycyIsIl9zeW1ib2xPdXRsaW5lUGFyYW1zIiwiX3N5bWJvbFNoYWRvd1BhcmFtcyIsIl9pMThuS2V5IiwiX2ZvbnRBc3NldCIsIkxvY2FsaXplZEFzc2V0IiwiYXBwIiwiZGlzYWJsZUxvY2FsaXphdGlvbiIsIm9uIiwiX29uRm9udExvYWQiLCJfb25Gb250Q2hhbmdlIiwiX29uRm9udFJlbW92ZSIsIl9mb250IiwiX2NvbG9yIiwiX2NvbG9yVW5pZm9ybSIsIkZsb2F0MzJBcnJheSIsIl9zcGFjaW5nIiwiX2ZvbnRTaXplIiwiX2ZvbnRNaW5ZIiwiX2ZvbnRNYXhZIiwiX29yaWdpbmFsRm9udFNpemUiLCJfbWF4Rm9udFNpemUiLCJfbWluRm9udFNpemUiLCJfYXV0b0ZpdFdpZHRoIiwiX2F1dG9GaXRIZWlnaHQiLCJfbWF4TGluZXMiLCJfbGluZUhlaWdodCIsIl9zY2FsZWRMaW5lSGVpZ2h0IiwiX3dyYXBMaW5lcyIsIl9kcmF3T3JkZXIiLCJfYWxpZ25tZW50IiwiX2F1dG9XaWR0aCIsIl9hdXRvSGVpZ2h0IiwiX25vZGUiLCJHcmFwaE5vZGUiLCJfbW9kZWwiLCJNb2RlbCIsImdyYXBoIiwiYWRkQ2hpbGQiLCJfbWVzaEluZm8iLCJfbWF0ZXJpYWwiLCJfYWFiYkRpcnR5IiwiX2FhYmIiLCJCb3VuZGluZ0JveCIsIl9ub1Jlc2l6ZSIsIl9jdXJyZW50TWF0ZXJpYWxUeXBlIiwiX21hc2tlZE1hdGVyaWFsU3JjIiwiX3J0bFJlb3JkZXIiLCJfdW5pY29kZUNvbnZlcnRlciIsIl9ydGwiLCJfb3V0bGluZUNvbG9yIiwiX291dGxpbmVDb2xvclVuaWZvcm0iLCJfb3V0bGluZVRoaWNrbmVzc1NjYWxlIiwiX291dGxpbmVUaGlja25lc3MiLCJfc2hhZG93Q29sb3IiLCJfc2hhZG93Q29sb3JVbmlmb3JtIiwiX3NoYWRvd09mZnNldFNjYWxlIiwiX3NoYWRvd09mZnNldCIsIl9zaGFkb3dPZmZzZXRVbmlmb3JtIiwiX2VuYWJsZU1hcmt1cCIsIl9vblNjcmVlbkNoYW5nZSIsInNjcmVlbiIsIl9vblBhcmVudFJlc2l6ZSIsIl9vblNjcmVlblNwYWNlQ2hhbmdlIiwiX29uRHJhd09yZGVyQ2hhbmdlIiwiX29uUGl2b3RDaGFuZ2UiLCJpMThuIiwiX29uTG9jYWxlU2V0IiwiX29uTG9jYWxpemF0aW9uRGF0YSIsIl9yYW5nZVN0YXJ0IiwiX3JhbmdlRW5kIiwiZGVzdHJveSIsIl9zZXRNYXRlcmlhbCIsInJlbW92ZU1vZGVsRnJvbUxheWVycyIsImZvbnQiLCJvZmYiLCJfdXBkYXRlVGV4dCIsIl91cGRhdGVNYXRlcmlhbCIsInNjcmVlblNwYWNlIiwidmFsdWUiLCJvcmRlciIsImkiLCJsZW4iLCJtZXNoSW5zdGFuY2VzIiwibGVuZ3RoIiwiZHJhd09yZGVyIiwicGl2b3QiLCJsb2NhbGUiLCJmb250QXNzZXQiLCJhc3NldCIsImFzc2V0cyIsImdldCIsInJlc291cmNlIiwiX3Jlc2V0TG9jYWxpemVkVGV4dCIsIm1lc3NhZ2VzIiwiX3NldFRleHQiLCJnZXRUZXh0IiwidGV4dCIsInVuaWNvZGVDb252ZXJ0ZXIiLCJ1bmljb2RlQ29udmVydGVyRnVuYyIsImdldFVuaWNvZGVDb252ZXJ0ZXIiLCJjb25zb2xlIiwid2FybiIsInRhZ3MiLCJzdHJpbmciLCJnZXRTeW1ib2xzIiwibm9ybWFsaXplIiwicmVzdWx0cyIsIk1hcmt1cCIsImV2YWx1YXRlIiwic3ltYm9scyIsInJ0bFJlb3JkZXJGdW5jIiwic3lzdGVtcyIsImdldFJ0bFJlb3JkZXIiLCJydGwiLCJtYXBwaW5nIiwibWFwIiwidiIsImdldENvbG9yVGhpY2tuZXNzSGFzaCIsImNvbG9yIiwidGhpY2tuZXNzIiwidG9TdHJpbmciLCJ0b0xvd2VyQ2FzZSIsInRvRml4ZWQiLCJnZXRDb2xvck9mZnNldEhhc2giLCJvZmZzZXQiLCJ4IiwieSIsInBhbGV0dGVNYXAiLCJvdXRsaW5lUGFsZXR0ZU1hcCIsInNoYWRvd1BhbGV0dGVNYXAiLCJNYXRoIiwicm91bmQiLCJyIiwiZyIsImIiLCJhIiwidGFnIiwiYyIsImhleCIsInN1YnN0cmluZyIsImhhc093blByb3BlcnR5IiwidGVzdCIsInB1c2giLCJwYXJzZUludCIsIm91dGxpbmUiLCJhdHRyaWJ1dGVzIiwiZnJvbVN0cmluZyIsIk51bWJlciIsImlzTmFOIiwib3V0bGluZUhhc2giLCJzaGFkb3ciLCJvZmZzZXRYIiwib2Zmc2V0WSIsIm9mZlgiLCJvZmZZIiwic2V0Iiwic2hhZG93SGFzaCIsIl91cGRhdGVNYXRlcmlhbEVtaXNzaXZlIiwiX3VwZGF0ZU1hdGVyaWFsT3V0bGluZSIsIl91cGRhdGVNYXRlcmlhbFNoYWRvdyIsImNoYXJhY3RlcnNQZXJUZXh0dXJlIiwiX2NhbGN1bGF0ZUNoYXJzUGVyVGV4dHVyZSIsInJlbW92ZWRNb2RlbCIsIl9pc1NjcmVlblNwYWNlIiwic2NyZWVuQ3VsbGVkIiwiX2lzU2NyZWVuQ3VsbGVkIiwidmlzaWJsZUZuIiwiY2FtZXJhIiwiaXNWaXNpYmxlRm9yQ2FtZXJhIiwibCIsIl9yZW1vdmVNZXNoSW5zdGFuY2UiLCJncmFwaGljc0RldmljZSIsIm1pIiwiTWVzaEluc3RhbmNlIiwibmFtZSIsImNhc3RTaGFkb3ciLCJyZWNlaXZlU2hhZG93IiwiY3VsbCIsImlzVmlzaWJsZUZ1bmMiLCJfc2V0VGV4dHVyZVBhcmFtcyIsInRleHR1cmVzIiwic2V0UGFyYW1ldGVyIiwiaW50ZW5zaXR5IiwiX2dldFB4UmFuZ2UiLCJkYXRhIiwiaW5mbyIsIm1hcHMiLCJyYXRpbyIsIm1hc2tlZEJ5IiwiX3NldE1hc2tlZEJ5IiwiZW5hYmxlZCIsImFkZE1vZGVsVG9MYXllcnMiLCJfdXBkYXRlTWVzaGVzIiwiX3VwZGF0ZVJlbmRlclJhbmdlIiwiaWR4IiwiaW5kZXhPZiIsInNwbGljZSIsIm1hdGVyaWFsIiwibXNkZiIsInR5cGUiLCJGT05UX01TREYiLCJnZXRUZXh0RWxlbWVudE1hdGVyaWFsIiwiX2lzV29yZEJvdW5kYXJ5IiwiY2hhciIsIl9pc1ZhbGlkTmV4dENoYXIiLCJuZXh0Y2hhciIsIl9pc05leHRDSktCb3VuZGFyeSIsIl9pc05leHRDSktXaG9sZVdvcmQiLCJqc29uIiwic2VsZiIsIm1pbkZvbnQiLCJtaW4iLCJtYXhGb250IiwiYXV0b0ZpdCIsIl9zaG91bGRBdXRvRml0IiwiTUFHSUMiLCJfeCIsIl95IiwiX3oiLCJfeE1pbnVzVHJhaWxpbmdXaGl0ZXNwYWNlIiwid29yZFN0YXJ0WCIsIndvcmRTdGFydEluZGV4IiwibGluZVN0YXJ0SW5kZXgiLCJudW1Xb3Jkc1RoaXNMaW5lIiwibnVtQ2hhcnNUaGlzTGluZSIsIm51bUJyZWFrc1RoaXNMaW5lIiwic3BsaXRIb3Jpem9udGFsQW5jaG9ycyIsImFicyIsImFuY2hvciIsInoiLCJtYXhMaW5lV2lkdGgiLCJjYWxjdWxhdGVkV2lkdGgiLCJhdXRvV2lkdGgiLCJQT1NJVElWRV9JTkZJTklUWSIsImZvbnRNaW5ZIiwiZm9udE1heFkiLCJicmVha0xpbmUiLCJsaW5lQnJlYWtJbmRleCIsImxpbmVCcmVha1giLCJfbGluZVdpZHRocyIsInNsaWNlU3RhcnQiLCJzbGljZUVuZCIsImNoYXJzIiwic2xpY2UiLCJfbGluZUNvbnRlbnRzIiwiam9pbiIsInJldHJ5VXBkYXRlTWVzaGVzIiwic2NhbGUiLCJjb2xvcl9yIiwiY29sb3JfZyIsImNvbG9yX2IiLCJvdXRsaW5lX2NvbG9yX3JnIiwib3V0bGluZV9jb2xvcl9iYSIsIm91dGxpbmVfdGhpY2tuZXNzIiwic2hhZG93X2NvbG9yX3JnIiwic2hhZG93X2NvbG9yX2JhIiwic2hhZG93X29mZnNldF94eSIsImlzTGluZUJyZWFrIiwiYWR2YW5jZSIsInF1YWRzaXplIiwiZGF0YVNjYWxlIiwic2l6ZSIsImtleSIsIm1pc3NpbmdDaGFycyIsIlNldCIsImhhcyIsImZhY2UiLCJhZGQiLCJrZXJuaW5nIiwia2VyblRhYmxlIiwia2VybkxlZnQiLCJnZXRDb2RlUG9pbnQiLCJlcnJvciIsImlzV2hpdGVzcGFjZSIsIm1lc2hJbmZvSWQiLCJjYW5kaWRhdGVMaW5lV2lkdGgiLCJiYWNrdHJhY2siLCJtYXgiLCJiYWNrdHJhY2tTdGFydCIsImJhY2t0cmFja0VuZCIsImoiLCJiYWNrQ2hhciIsImJhY2tDaGFyRGF0YSIsImJhY2tNZXNoSW5mbyIsImxlZnQiLCJyaWdodCIsImJvdHRvbSIsInRvcCIsInNoaWZ0IiwiZm9udFNpemUiLCJfc2hvdWxkQXV0b0ZpdFdpZHRoIiwiZmxvb3IiLCJtYXRoIiwiY2xhbXAiLCJfc2hvdWxkQXV0b0ZpdEhlaWdodCIsImNhbGN1bGF0ZWRIZWlnaHQiLCJ1diIsIl9nZXRVdiIsImNvbG9ySWR4Iiwib3V0bGluZUlkeCIsInNoYWRvd0lkeCIsImF1dG9IZWlnaHQiLCJocCIsInZwIiwiaGEiLCJ2YSIsInByZXZRdWFkIiwibGluZSIsImluZGV4IiwibHciLCJob2Zmc2V0Iiwidm9mZnNldCIsInZlcnQiLCJ0bXAwIiwidG1wMSIsIm51bVZlcnRpY2VzIiwidmVydE1heCIsIml0IiwiVmVydGV4SXRlcmF0b3IiLCJ2ZXJ0ZXhCdWZmZXIiLCJTRU1BTlRJQ19QT1NJVElPTiIsIlNFTUFOVElDX1RFWENPT1JEMCIsIlNFTUFOVElDX0NPTE9SIiwibmV4dCIsImVuZCIsImFhYmIiLCJjb21wdXRlIiwiX2FhYmJWZXIiLCJfb25Gb250UmVuZGVyIiwiX25ldyIsIl9vbGQiLCJ0ZXh0dXJlIiwiZGVsZXRlUGFyYW1ldGVyIiwiRk9OVF9CSVRNQVAiLCJrZXlzIiwiT2JqZWN0IiwicmFuZ2UiLCJzcGFjZSIsIngxIiwieTEiLCJ4MiIsInkyIiwiZWRnZSIsIm9uRW5hYmxlIiwiYXV0b0xvYWQiLCJvbkRpc2FibGUiLCJfc2V0U3RlbmNpbCIsInN0ZW5jaWxQYXJhbXMiLCJpbnN0YW5jZXMiLCJzdGVuY2lsRnJvbnQiLCJzdGVuY2lsQmFjayIsInN5bWJvbEluZGV4Iiwic3RhcnRDaGFycyIsImVuZENoYXJzIiwic3RhcnQiLCJpbnN0YW5jZSIsInByaW1pdGl2ZSIsImJhc2UiLCJzdHIiLCJmaXJlIiwib3BhY2l0eSIsImxpbmVIZWlnaHQiLCJfcHJldiIsIndyYXBMaW5lcyIsInNwYWNpbmciLCJkZWZhdWx0QXNzZXQiLCJsb2NhbGl6ZWRBc3NldCIsInByZXZpb3VzRm9udFR5cGUiLCJjaGFySWQiLCJib3VuZHMiLCJhbGlnbm1lbnQiLCJvbGQiLCJuZXdGb250U2l6ZSIsInciLCJydGxSZW9yZGVyIiwiaW5pdGlhbGl6ZWQiLCJjb3B5Iiwib3V0bGluZUNvbG9yIiwib3V0bGluZVRoaWNrbmVzcyIsInNoYWRvd0NvbG9yIiwiRGVidWciLCJzaGFkb3dPZmZzZXQiLCJtaW5Gb250U2l6ZSIsIm1heEZvbnRTaXplIiwiYXV0b0ZpdFdpZHRoIiwiYXV0b0ZpdEhlaWdodCIsIm1heExpbmVzIiwiZW5hYmxlTWFya3VwIiwic3ltYm9sQ29sb3JzIiwic3ltYm9sT3V0bGluZVBhcmFtcyIsInBhcmFtSWQiLCJzeW1ib2xTaGFkb3dQYXJhbXMiLCJyYW5nZVN0YXJ0IiwicmFuZ2VFbmQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXNCQSxNQUFNQSxRQUFRLENBQUM7QUFDWEMsRUFBQUEsV0FBVyxHQUFHO0lBRVYsSUFBSSxDQUFDQyxLQUFLLEdBQUcsQ0FBQyxDQUFBO0lBRWQsSUFBSSxDQUFDQyxJQUFJLEdBQUcsQ0FBQyxDQUFBO0FBRWIsSUFBQSxJQUFJLENBQUNDLEtBQUssR0FBRyxFQUFFLENBQUE7SUFFZixJQUFJLENBQUNDLFNBQVMsR0FBRyxFQUFFLENBQUE7SUFFbkIsSUFBSSxDQUFDQyxPQUFPLEdBQUcsRUFBRSxDQUFBO0lBRWpCLElBQUksQ0FBQ0MsR0FBRyxHQUFHLEVBQUUsQ0FBQTtJQUViLElBQUksQ0FBQ0MsTUFBTSxHQUFHLEVBQUUsQ0FBQTtJQUVoQixJQUFJLENBQUNDLE9BQU8sR0FBRyxFQUFFLENBQUE7SUFFakIsSUFBSSxDQUFDQyxRQUFRLEdBQUcsRUFBRSxDQUFBO0lBRWxCLElBQUksQ0FBQ0MsT0FBTyxHQUFHLEVBQUUsQ0FBQTtJQUVqQixJQUFJLENBQUNDLFlBQVksR0FBRyxJQUFJLENBQUE7QUFDNUIsR0FBQTtBQUNKLENBQUE7O0FBVUEsU0FBU0MsY0FBYyxDQUFDQyxNQUFNLEVBQUVDLFFBQVEsRUFBRTtBQUN0QyxFQUFBLE1BQU1DLElBQUksR0FBRyxJQUFJQyxJQUFJLENBQUNILE1BQU0sQ0FBQyxDQUFBO0FBRTdCRSxFQUFBQSxJQUFJLENBQUNFLFlBQVksQ0FBQ0gsUUFBUSxDQUFDVixTQUFTLENBQUMsQ0FBQTtBQUNyQ1csRUFBQUEsSUFBSSxDQUFDRyxVQUFVLENBQUNKLFFBQVEsQ0FBQ1QsT0FBTyxDQUFDLENBQUE7QUFDakNVLEVBQUFBLElBQUksQ0FBQ0ksV0FBVyxDQUFDTCxRQUFRLENBQUNQLE1BQU0sQ0FB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QUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdpVCxPQUFPLENBQUE7QUFDM0NyUyxRQUFBQSxRQUFRLENBQUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdrVCxPQUFPLENBQUE7QUFDM0N0UyxRQUFBQSxRQUFRLENBQUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFBO0FBRXZDWSxRQUFBQSxRQUFRLENBQUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdnVCxPQUFPLENBQUE7QUFDM0NwUyxRQUFBQSxRQUFRLENBQUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdpVCxPQUFPLENBQUE7QUFDM0NyUyxRQUFBQSxRQUFRLENBQUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdrVCxPQUFPLENBQUE7QUFDM0N0UyxRQUFBQSxRQUFRLENBQUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFBO0FBRXZDWSxRQUFBQSxRQUFRLENBQUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdnVCxPQUFPLENBQUE7QUFDM0NwUyxRQUFBQSxRQUFRLENBQUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUdpVCxPQUFPLENBQUE7QUFDM0NyUyxRQUFBQSxRQUFRLENBQUNQLE1BQU0sQ0FBQ0wsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUdrVCxPQUFPLENB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LENBQUMsQ0FBQyxDQUFDdEksU0FBUyxDQUFDRixLQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJOFcsT0FBTyxDQUFBO0FBQ3BELFVBQUEsSUFBSSxDQUFDaFIsU0FBUyxDQUFDMEMsQ0FBQyxDQUFDLENBQUN0SSxTQUFTLENBQUNGLEtBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJOFcsT0FBTyxDQUFBO0FBQ3hELFVBQUEsSUFBSSxDQUFDaFIsU0FBUyxDQUFDMEMsQ0FBQyxDQUFDLENBQUN0SSxTQUFTLENBQUNGLEtBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJOFcsT0FBTyxDQUFBO0FBQ3hELFVBQUEsSUFBSSxDQUFDaFIsU0FBUyxDQUFDMEMsQ0FBQyxDQUFDLENBQUN0SSxTQUFTLENBQUNGLEtBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJOFcsT0FBTyxDQUFBO0FBRXhELFVBQUEsSUFBSSxDQUFDaFIsU0FBUyxDQUFDMEMsQ0FBQyxDQUFDLENBQUN0SSxTQUFTLENBQUNGLEtBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJK1csT0FBTyxDQUFBO0FBQ3hELFVBQUEsSUFBSSxDQUFDalIsU0FBUyxDQUFDMEMsQ0FBQyxDQUFDLENBQUN0SSxTQUFTLENBQUNGLEtBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJK1csT0FBTyxDQUFBO0FBQ3hELFVBQUEsSUFBSSxDQUFDalIsU0FBUyxDQUFDMEMsQ0FBQyxDQUFDLENBQUN0SSxTQUFTLENBQUNGLEtBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJK1csT0FBTyxDQUFBO0FBQ3hELFVBQUEsSUFBSSxDQUFDalIsU0FBUyxDQUFDMEMsQ0FBQyxDQUFDLENBQUN0SSxTQUFTLENBQUNGLEtBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJ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
