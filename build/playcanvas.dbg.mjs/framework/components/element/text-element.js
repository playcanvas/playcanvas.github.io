/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { string } from '../../../core/string.js';
import { math } from '../../../math/math.js';
import { Color } from '../../../math/color.js';
import { Vec2 } from '../../../math/vec2.js';
import { BoundingBox } from '../../../shape/bounding-box.js';
import { SEMANTIC_POSITION, SEMANTIC_TEXCOORD0, SEMANTIC_COLOR, SEMANTIC_ATTR8, SEMANTIC_ATTR9, TYPE_FLOAT32 } from '../../../graphics/constants.js';
import { VertexIterator } from '../../../graphics/vertex-iterator.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { Mesh } from '../../../scene/mesh.js';
import { LocalizedAsset } from '../../../asset/asset-localized.js';
import { FONT_MSDF, FONT_BITMAP } from '../../../font/constants.js';
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
const CONTROL_CHARS = ['\u200B', '\u061C', '\u200E', '\u200F', '\u202A', '\u202B', '\u202C', '\u202D', '\u202E', '\u2066', '\u2067', '\u2068', '\u2069'];
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
    return [x1 / width, edge - y1 / height, x2 / width, edge - y2 / height];
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGV4dC1lbGVtZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC90ZXh0LWVsZW1lbnQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IHN0cmluZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvc3RyaW5nLmpzJztcblxuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uLy4uLy4uL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjMi5qcyc7XG5cbmltcG9ydCB7IEJvdW5kaW5nQm94IH0gZnJvbSAnLi4vLi4vLi4vc2hhcGUvYm91bmRpbmctYm94LmpzJztcblxuaW1wb3J0IHsgU0VNQU5USUNfUE9TSVRJT04sIFNFTUFOVElDX1RFWENPT1JEMCwgU0VNQU5USUNfQ09MT1IsIFNFTUFOVElDX0FUVFI4LCBTRU1BTlRJQ19BVFRSOSwgVFlQRV9GTE9BVDMyIH0gZnJvbSAnLi4vLi4vLi4vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFZlcnRleEl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vZ3JhcGhpY3MvdmVydGV4LWl0ZXJhdG9yLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21vZGVsLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLmpzJztcblxuaW1wb3J0IHsgTG9jYWxpemVkQXNzZXQgfSBmcm9tICcuLi8uLi8uLi9hc3NldC9hc3NldC1sb2NhbGl6ZWQuanMnO1xuXG5pbXBvcnQgeyBGT05UX0JJVE1BUCwgRk9OVF9NU0RGIH0gZnJvbSAnLi4vLi4vLi4vZm9udC9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBNYXJrdXAgfSBmcm9tICcuL21hcmt1cC5qcyc7XG5cbmNsYXNzIE1lc2hJbmZvIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgLy8gbnVtYmVyIG9mIHN5bWJvbHNcbiAgICAgICAgdGhpcy5jb3VudCA9IDA7XG4gICAgICAgIC8vIG51bWJlciBvZiBxdWFkcyBjcmVhdGVkXG4gICAgICAgIHRoaXMucXVhZCA9IDA7XG4gICAgICAgIC8vIG51bWJlciBvZiBxdWFkcyBvbiBzcGVjaWZpYyBsaW5lXG4gICAgICAgIHRoaXMubGluZXMgPSB7fTtcbiAgICAgICAgLy8gZmxvYXQgYXJyYXkgZm9yIHBvc2l0aW9uc1xuICAgICAgICB0aGlzLnBvc2l0aW9ucyA9IFtdO1xuICAgICAgICAvLyBmbG9hdCBhcnJheSBmb3Igbm9ybWFsc1xuICAgICAgICB0aGlzLm5vcm1hbHMgPSBbXTtcbiAgICAgICAgLy8gZmxvYXQgYXJyYXkgZm9yIFVWc1xuICAgICAgICB0aGlzLnV2cyA9IFtdO1xuICAgICAgICAvLyBmbG9hdCBhcnJheSBmb3IgdmVydGV4IGNvbG9yc1xuICAgICAgICB0aGlzLmNvbG9ycyA9IFtdO1xuICAgICAgICAvLyBmbG9hdCBhcnJheSBmb3IgaW5kaWNlc1xuICAgICAgICB0aGlzLmluZGljZXMgPSBbXTtcbiAgICAgICAgLy8gZmxvYXQgYXJyYXkgZm9yIG91dGxpbmVcbiAgICAgICAgdGhpcy5vdXRsaW5lcyA9IFtdO1xuICAgICAgICAvLyBmbG9hdCBhcnJheSBmb3Igc2hhZG93c1xuICAgICAgICB0aGlzLnNoYWRvd3MgPSBbXTtcbiAgICAgICAgLy8gcGMuTWVzaEluc3RhbmNlIGNyZWF0ZWQgZnJvbSB0aGlzIE1lc2hJbmZvXG4gICAgICAgIHRoaXMubWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyB0ZXh0IG1lc2ggb2JqZWN0IGZyb20gdGhlIHN1cHBsaWVkIHZlcnRleCBpbmZvcm1hdGlvbiBhbmQgdG9wb2xvZ3kuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IGRldmljZSAtIFRoZSBncmFwaGljcyBkZXZpY2UgdXNlZCB0byBtYW5hZ2UgdGhlIG1lc2guXG4gKiBAcGFyYW0ge01lc2hJbmZvfSBbbWVzaEluZm9dIC0gQW4gb2JqZWN0IHRoYXQgc3BlY2lmaWVzIG9wdGlvbmFsIGlucHV0cyBmb3IgdGhlIGZ1bmN0aW9uIGFzIGZvbGxvd3M6XG4gKiBAcmV0dXJucyB7TWVzaH0gQSBuZXcgTWVzaCBjb25zdHJ1Y3RlZCBmcm9tIHRoZSBzdXBwbGllZCB2ZXJ0ZXggYW5kIHRyaWFuZ2xlIGRhdGEuXG4gKiBAaWdub3JlXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVRleHRNZXNoKGRldmljZSwgbWVzaEluZm8pIHtcbiAgICBjb25zdCBtZXNoID0gbmV3IE1lc2goZGV2aWNlKTtcblxuICAgIG1lc2guc2V0UG9zaXRpb25zKG1lc2hJbmZvLnBvc2l0aW9ucyk7XG4gICAgbWVzaC5zZXROb3JtYWxzKG1lc2hJbmZvLm5vcm1hbHMpO1xuICAgIG1lc2guc2V0Q29sb3JzMzIobWVzaEluZm8uY29sb3JzKTtcbiAgICBtZXNoLnNldFV2cygwLCBtZXNoSW5mby51dnMpO1xuICAgIG1lc2guc2V0SW5kaWNlcyhtZXNoSW5mby5pbmRpY2VzKTtcbiAgICBtZXNoLnNldFZlcnRleFN0cmVhbShTRU1BTlRJQ19BVFRSOCwgbWVzaEluZm8ub3V0bGluZXMsIDMsIHVuZGVmaW5lZCwgVFlQRV9GTE9BVDMyLCBmYWxzZSk7XG4gICAgbWVzaC5zZXRWZXJ0ZXhTdHJlYW0oU0VNQU5USUNfQVRUUjksIG1lc2hJbmZvLnNoYWRvd3MsIDMsIHVuZGVmaW5lZCwgVFlQRV9GTE9BVDMyLCBmYWxzZSk7XG5cbiAgICBtZXNoLnVwZGF0ZSgpO1xuICAgIHJldHVybiBtZXNoO1xufVxuXG5jb25zdCBMSU5FX0JSRUFLX0NIQVIgPSAvXltcXHJcXG5dJC87XG5jb25zdCBXSElURVNQQUNFX0NIQVIgPSAvXlsgXFx0XSQvO1xuY29uc3QgV09SRF9CT1VOREFSWV9DSEFSID0gL15bIFxcdFxcLV18W1xcdTIwMGJdJC87IC8vIE5CIFxcdTIwMGIgaXMgemVybyB3aWR0aCBzcGFjZVxuY29uc3QgQUxQSEFOVU1FUklDX0NIQVIgPSAvXlthLXowLTldJC9pO1xuXG4vLyAxMTAw4oCUMTFGRiBIYW5ndWwgSmFtb1xuLy8gMzAwMOKAlDMwM0YgQ0pLIFN5bWJvbHMgYW5kIFB1bmN0dWF0aW9uIFxcXG4vLyAzMTMw4oCUMzE4RiBIYW5ndWwgQ29tcGF0aWJpbGl0eSBKYW1vICAgIC0tIGdyb3VwZWRcbi8vIDRFMDDigJQ5RkZGIENKSyBVbmlmaWVkIElkZW9ncmFwaHMgICAgICAvXG4vLyBBOTYw4oCUQTk3RiBIYW5ndWwgSmFtbyBFeHRlbmRlZC1BXG4vLyBBQzAw4oCURDdBRiBIYW5ndWwgU3lsbGFibGVzXG4vLyBEN0Iw4oCURDdGRiBIYW5ndWwgSmFtbyBFeHRlbmRlZC1CXG5jb25zdCBDSktfQ0hBUiA9IC9eW1xcdTExMDAtXFx1MTFmZl18W1xcdTMwMDAtXFx1OWZmZl18W1xcdWE5NjAtXFx1YTk3Zl18W1xcdWFjMDAtXFx1ZDdmZl0kLztcbmNvbnN0IE5PX0xJTkVfQlJFQUtfQ0pLX0NIQVIgPSAvXlvjgJXjgInjgIvjgI3jgI/jgJHjgJnjgJfjgJ/jg73jg77jg7zjgqHjgqPjgqXjgqfjgqnjg4Pjg6Pjg6Xjg6fjg67jg7Xjg7bjgYHjgYPjgYXjgYfjgYnjgaPjgoPjgoXjgofjgo7jgpXjgpbjh7Djh7Hjh7Ljh7Pjh7Tjh7Xjh7bjh7fjh7jjh7njh7rjh7vjh7zjh73jh77jh7/jgIXjgLtdJC87XG5cbi8vIHVuaWNvZGUgYmlkaSBjb250cm9sIGNoYXJhY3RlcnMgaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvVW5pY29kZV9jb250cm9sX2NoYXJhY3RlcnNcbmNvbnN0IENPTlRST0xfQ0hBUlMgPSBbXG4gICAgJ1xcdTIwMEInLCAvLyB6ZXJvIHdpZHRoIHNwYWNlXG4gICAgJ1xcdTA2MUMnLFxuICAgICdcXHUyMDBFJyxcbiAgICAnXFx1MjAwRicsXG4gICAgJ1xcdTIwMkEnLFxuICAgICdcXHUyMDJCJyxcbiAgICAnXFx1MjAyQycsXG4gICAgJ1xcdTIwMkQnLFxuICAgICdcXHUyMDJFJyxcbiAgICAnXFx1MjA2NicsXG4gICAgJ1xcdTIwNjcnLFxuICAgICdcXHUyMDY4JyxcbiAgICAnXFx1MjA2OSdcbl07XG5cbi8vIGdseXBoIGRhdGEgdG8gdXNlIGZvciBtaXNzaW5nIGNvbnRyb2wgY2hhcmFjdGVyc1xuY29uc3QgQ09OVFJPTF9HTFlQSF9EQVRBID0ge1xuICAgIHdpZHRoOiAwLFxuICAgIGhlaWdodDogMCxcbiAgICB4YWR2YW5jZTogMCxcbiAgICB4b2Zmc2V0OiAwLFxuICAgIHlvZmZzZXQ6IDBcbn07XG5cbmNvbnN0IGNvbG9yVG1wID0gbmV3IENvbG9yKCk7XG5jb25zdCB2ZWMyVG1wID0gbmV3IFZlYzIoKTtcblxuY2xhc3MgVGV4dEVsZW1lbnQge1xuICAgIGNvbnN0cnVjdG9yKGVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5fZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgICAgIHRoaXMuX3N5c3RlbSA9IGVsZW1lbnQuc3lzdGVtO1xuICAgICAgICB0aGlzLl9lbnRpdHkgPSBlbGVtZW50LmVudGl0eTtcblxuICAgICAgICAvLyBwdWJsaWNcbiAgICAgICAgdGhpcy5fdGV4dCA9ICcnOyAgICAgICAgICAgIC8vIHRoZSBvcmlnaW5hbCB1c2VyLWRlZmluZWQgdGV4dFxuICAgICAgICB0aGlzLl9zeW1ib2xzID0gW107ICAgICAgICAgLy8gYXJyYXkgb2YgdmlzaWJsZSBzeW1ib2xzIHdpdGggdW5pY29kZSBwcm9jZXNzaW5nIGFuZCBtYXJrdXAgcmVtb3ZlZFxuICAgICAgICB0aGlzLl9jb2xvclBhbGV0dGUgPSBbXTsgICAgLy8gcGVyLXN5bWJvbCBjb2xvciBwYWxldHRlXG4gICAgICAgIHRoaXMuX291dGxpbmVQYWxldHRlID0gW107IC8vIHBlci1zeW1ib2wgb3V0bGluZSBjb2xvci90aGlja25lc3MgcGFsZXR0ZVxuICAgICAgICB0aGlzLl9zaGFkb3dQYWxldHRlID0gW107IC8vIHBlci1zeW1ib2wgc2hhZG93IGNvbG9yL29mZnNldCBwYWxldHRlXG4gICAgICAgIHRoaXMuX3N5bWJvbENvbG9ycyA9IG51bGw7ICAvLyBwZXItc3ltYm9sIGNvbG9yIGluZGV4ZXMuIG9ubHkgc2V0IGZvciB0ZXh0IHdpdGggbWFya3VwLlxuICAgICAgICB0aGlzLl9zeW1ib2xPdXRsaW5lUGFyYW1zID0gbnVsbDsgIC8vIHBlci1zeW1ib2wgb3V0bGluZSBjb2xvci90aGlja25lc3MgaW5kZXhlcy4gb25seSBzZXQgZm9yIHRleHQgd2l0aCBtYXJrdXAuXG4gICAgICAgIHRoaXMuX3N5bWJvbFNoYWRvd1BhcmFtcyA9IG51bGw7ICAvLyBwZXItc3ltYm9sIHNoYWRvdyBjb2xvci9vZmZzZXQgaW5kZXhlcy4gb25seSBzZXQgZm9yIHRleHQgd2l0aCBtYXJrdXAuXG4gICAgICAgIHRoaXMuX2kxOG5LZXkgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2ZvbnRBc3NldCA9IG5ldyBMb2NhbGl6ZWRBc3NldCh0aGlzLl9zeXN0ZW0uYXBwKTtcbiAgICAgICAgdGhpcy5fZm9udEFzc2V0LmRpc2FibGVMb2NhbGl6YXRpb24gPSB0cnVlO1xuICAgICAgICB0aGlzLl9mb250QXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbkZvbnRMb2FkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZm9udEFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbkZvbnRDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9mb250QXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uRm9udFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5fZm9udCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fY29sb3IgPSBuZXcgQ29sb3IoMSwgMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMyk7XG5cbiAgICAgICAgdGhpcy5fc3BhY2luZyA9IDE7XG4gICAgICAgIHRoaXMuX2ZvbnRTaXplID0gMzI7XG4gICAgICAgIHRoaXMuX2ZvbnRNaW5ZID0gMDtcbiAgICAgICAgdGhpcy5fZm9udE1heFkgPSAwO1xuICAgICAgICAvLyB0aGUgZm9udCBzaXplIHRoYXQgaXMgc2V0IGRpcmVjdGx5IGJ5IHRoZSBmb250U2l6ZSBzZXR0ZXJcbiAgICAgICAgdGhpcy5fb3JpZ2luYWxGb250U2l6ZSA9IDMyO1xuICAgICAgICB0aGlzLl9tYXhGb250U2l6ZSA9IDMyO1xuICAgICAgICB0aGlzLl9taW5Gb250U2l6ZSA9IDg7XG4gICAgICAgIHRoaXMuX2F1dG9GaXRXaWR0aCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hdXRvRml0SGVpZ2h0ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX21heExpbmVzID0gLTE7XG4gICAgICAgIHRoaXMuX2xpbmVIZWlnaHQgPSAzMjtcbiAgICAgICAgdGhpcy5fc2NhbGVkTGluZUhlaWdodCA9IDMyO1xuICAgICAgICB0aGlzLl93cmFwTGluZXMgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl9kcmF3T3JkZXIgPSAwO1xuXG4gICAgICAgIHRoaXMuX2FsaWdubWVudCA9IG5ldyBWZWMyKDAuNSwgMC41KTtcblxuICAgICAgICB0aGlzLl9hdXRvV2lkdGggPSB0cnVlO1xuICAgICAgICB0aGlzLl9hdXRvSGVpZ2h0ID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLndpZHRoID0gMDtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSAwO1xuXG4gICAgICAgIC8vIHByaXZhdGVcbiAgICAgICAgdGhpcy5fbm9kZSA9IG5ldyBHcmFwaE5vZGUoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgdGhpcy5fbW9kZWwuZ3JhcGggPSB0aGlzLl9ub2RlO1xuICAgICAgICB0aGlzLl9lbnRpdHkuYWRkQ2hpbGQodGhpcy5fbm9kZSk7XG5cbiAgICAgICAgdGhpcy5fbWVzaEluZm8gPSBbXTtcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2FhYmJEaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuX2FhYmIgPSBuZXcgQm91bmRpbmdCb3goKTtcblxuICAgICAgICB0aGlzLl9ub1Jlc2l6ZSA9IGZhbHNlOyAvLyBmbGFnIHVzZWQgdG8gZGlzYWJsZSByZXNpemluZyBldmVudHNcblxuICAgICAgICB0aGlzLl9jdXJyZW50TWF0ZXJpYWxUeXBlID0gbnVsbDsgLy8gc2F2ZSB0aGUgbWF0ZXJpYWwgdHlwZSAoc2NyZWVuc3BhY2Ugb3Igbm90KSB0byBwcmV2ZW50IG92ZXJ3cml0aW5nXG4gICAgICAgIHRoaXMuX21hc2tlZE1hdGVyaWFsU3JjID0gbnVsbDsgLy8gc2F2ZWQgbWF0ZXJpYWwgdGhhdCB3YXMgYXNzaWduZWQgYmVmb3JlIGVsZW1lbnQgd2FzIG1hc2tlZFxuXG4gICAgICAgIHRoaXMuX3J0bFJlb3JkZXIgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdW5pY29kZUNvbnZlcnRlciA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9ydGwgPSBmYWxzZTsgICAgICAgICAgICAgIC8vIHRydWUgd2hlbiB0aGUgY3VycmVudCB0ZXh0IGlzIFJUTFxuXG4gICAgICAgIHRoaXMuX291dGxpbmVDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwLCAxKTtcbiAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuX291dGxpbmVUaGlja25lc3NTY2FsZSA9IDAuMjsgLy8gMC4yIGNvZWZmaWNpZW50IHRvIG1hcCBlZGl0b3IgcmFuZ2Ugb2YgMCAtIDEgdG8gc2hhZGVyIHZhbHVlXG4gICAgICAgIHRoaXMuX291dGxpbmVUaGlja25lc3MgPSAwLjA7XG5cbiAgICAgICAgdGhpcy5fc2hhZG93Q29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCwgMSk7XG4gICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuX3NoYWRvd09mZnNldFNjYWxlID0gMC4wMDU7IC8vIG1hcHMgdGhlIGVkaXRvciBzY2FsZSB2YWx1ZSB0byBzaGFkZXIgc2NhbGVcbiAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0ID0gbmV3IFZlYzIoMCwgMCk7XG4gICAgICAgIHRoaXMuX3NoYWRvd09mZnNldFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuXG4gICAgICAgIHRoaXMuX2VuYWJsZU1hcmt1cCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGluaXRpYWxpemUgYmFzZWQgb24gc2NyZWVuXG4gICAgICAgIHRoaXMuX29uU2NyZWVuQ2hhbmdlKHRoaXMuX2VsZW1lbnQuc2NyZWVuKTtcblxuICAgICAgICAvLyBzdGFydCBsaXN0ZW5pbmcgZm9yIGVsZW1lbnQgZXZlbnRzXG4gICAgICAgIGVsZW1lbnQub24oJ3Jlc2l6ZScsIHRoaXMuX29uUGFyZW50UmVzaXplLCB0aGlzKTtcbiAgICAgICAgZWxlbWVudC5vbignc2V0OnNjcmVlbicsIHRoaXMuX29uU2NyZWVuQ2hhbmdlLCB0aGlzKTtcbiAgICAgICAgZWxlbWVudC5vbignc2NyZWVuOnNldDpzY3JlZW5zcGFjZScsIHRoaXMuX29uU2NyZWVuU3BhY2VDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBlbGVtZW50Lm9uKCdzZXQ6ZHJhd29yZGVyJywgdGhpcy5fb25EcmF3T3JkZXJDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBlbGVtZW50Lm9uKCdzZXQ6cGl2b3QnLCB0aGlzLl9vblBpdm90Q2hhbmdlLCB0aGlzKTtcblxuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmkxOG4ub24oJ3NldDpsb2NhbGUnLCB0aGlzLl9vbkxvY2FsZVNldCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3N5c3RlbS5hcHAuaTE4bi5vbignZGF0YTphZGQnLCB0aGlzLl9vbkxvY2FsaXphdGlvbkRhdGEsIHRoaXMpO1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmkxOG4ub24oJ2RhdGE6cmVtb3ZlJywgdGhpcy5fb25Mb2NhbGl6YXRpb25EYXRhLCB0aGlzKTtcblxuICAgICAgICAvLyBzdWJzdHJpbmcgcmVuZGVyIHJhbmdlXG4gICAgICAgIHRoaXMuX3JhbmdlU3RhcnQgPSAwO1xuICAgICAgICB0aGlzLl9yYW5nZUVuZCA9IDA7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWwobnVsbCk7IC8vIGNsZWFyIG1hdGVyaWFsIGZyb20gbWVzaCBpbnN0YW5jZXNcblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKHRoaXMuX21vZGVsKTtcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX21vZGVsID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2ZvbnRBc3NldC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuZm9udCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3Jlc2l6ZScsIHRoaXMuX29uUGFyZW50UmVzaXplLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fZWxlbWVudC5vZmYoJ3NldDpzY3JlZW4nLCB0aGlzLl9vblNjcmVlbkNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzY3JlZW46c2V0OnNjcmVlbnNwYWNlJywgdGhpcy5fb25TY3JlZW5TcGFjZUNoYW5nZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2VsZW1lbnQub2ZmKCdzZXQ6ZHJhd29yZGVyJywgdGhpcy5fb25EcmF3T3JkZXJDaGFuZ2UsIHRoaXMpO1xuICAgICAgICB0aGlzLl9lbGVtZW50Lm9mZignc2V0OnBpdm90JywgdGhpcy5fb25QaXZvdENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5pMThuLm9mZignc2V0OmxvY2FsZScsIHRoaXMuX29uTG9jYWxlU2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5fc3lzdGVtLmFwcC5pMThuLm9mZignZGF0YTphZGQnLCB0aGlzLl9vbkxvY2FsaXphdGlvbkRhdGEsIHRoaXMpO1xuICAgICAgICB0aGlzLl9zeXN0ZW0uYXBwLmkxOG4ub2ZmKCdkYXRhOnJlbW92ZScsIHRoaXMuX29uTG9jYWxpemF0aW9uRGF0YSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uUGFyZW50UmVzaXplKHdpZHRoLCBoZWlnaHQpIHtcbiAgICAgICAgaWYgKHRoaXMuX25vUmVzaXplKSByZXR1cm47XG4gICAgICAgIGlmICh0aGlzLl9mb250KSB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgfVxuXG4gICAgX29uU2NyZWVuQ2hhbmdlKHNjcmVlbikge1xuICAgICAgICBpZiAoc2NyZWVuKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbChzY3JlZW4uc2NyZWVuLnNjcmVlblNwYWNlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKGZhbHNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNjcmVlblNwYWNlQ2hhbmdlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHZhbHVlKTtcbiAgICB9XG5cbiAgICBfb25EcmF3T3JkZXJDaGFuZ2Uob3JkZXIpIHtcbiAgICAgICAgdGhpcy5fZHJhd09yZGVyID0gb3JkZXI7XG5cbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXNbaV0uZHJhd09yZGVyID0gb3JkZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25QaXZvdENoYW5nZShwaXZvdCkge1xuICAgICAgICBpZiAodGhpcy5fZm9udClcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICB9XG5cbiAgICBfb25Mb2NhbGVTZXQobG9jYWxlKSB7XG4gICAgICAgIGlmICghdGhpcy5faTE4bktleSkgcmV0dXJuO1xuXG4gICAgICAgIC8vIGlmIHRoZSBsb2NhbGl6ZWQgZm9udCBpcyBkaWZmZXJlbnRcbiAgICAgICAgLy8gdGhlbiB0aGUgY3VycmVudCBmb250IGFuZCB0aGUgbG9jYWxpemVkIGZvbnRcbiAgICAgICAgLy8gaXMgbm90IHlldCBsb2FkZWQgdGhlbiByZXNldCB0aGUgY3VycmVudCBmb250IGFuZCB3YWl0XG4gICAgICAgIC8vIHVudGlsIHRoZSBsb2NhbGl6ZWQgZm9udCBpcyBsb2FkZWQgdG8gc2VlIHRoZSB1cGRhdGVkIHRleHRcbiAgICAgICAgaWYgKHRoaXMuZm9udEFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IHRoaXMuX3N5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLmZvbnRBc3NldCk7XG4gICAgICAgICAgICBpZiAoIWFzc2V0IHx8ICFhc3NldC5yZXNvdXJjZSB8fCBhc3NldC5yZXNvdXJjZSAhPT0gdGhpcy5fZm9udCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZm9udCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9yZXNldExvY2FsaXplZFRleHQoKTtcbiAgICB9XG5cbiAgICBfb25Mb2NhbGl6YXRpb25EYXRhKGxvY2FsZSwgbWVzc2FnZXMpIHtcbiAgICAgICAgaWYgKHRoaXMuX2kxOG5LZXkgJiYgbWVzc2FnZXNbdGhpcy5faTE4bktleV0pIHtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0TG9jYWxpemVkVGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3Jlc2V0TG9jYWxpemVkVGV4dCgpIHtcbiAgICAgICAgdGhpcy5fc2V0VGV4dCh0aGlzLl9zeXN0ZW0uYXBwLmkxOG4uZ2V0VGV4dCh0aGlzLl9pMThuS2V5KSk7XG4gICAgfVxuXG4gICAgX3NldFRleHQodGV4dCkge1xuICAgICAgICBpZiAodGhpcy51bmljb2RlQ29udmVydGVyKSB7XG4gICAgICAgICAgICBjb25zdCB1bmljb2RlQ29udmVydGVyRnVuYyA9IHRoaXMuX3N5c3RlbS5nZXRVbmljb2RlQ29udmVydGVyKCk7XG4gICAgICAgICAgICBpZiAodW5pY29kZUNvbnZlcnRlckZ1bmMpIHtcbiAgICAgICAgICAgICAgICB0ZXh0ID0gdW5pY29kZUNvbnZlcnRlckZ1bmModGV4dCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRWxlbWVudCBjcmVhdGVkIHdpdGggdW5pY29kZUNvbnZlcnRlciBvcHRpb24gYnV0IG5vIHVuaWNvZGVDb252ZXJ0ZXIgZnVuY3Rpb24gcmVnaXN0ZXJlZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3RleHQgIT09IHRleHQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9mb250KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCh0ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3RleHQgPSB0ZXh0O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZVRleHQodGV4dCkge1xuICAgICAgICBsZXQgdGFncztcblxuICAgICAgICBpZiAodGV4dCA9PT0gdW5kZWZpbmVkKSB0ZXh0ID0gdGhpcy5fdGV4dDtcblxuICAgICAgICAvLyBnZXQgdGhlIGxpc3Qgb2Ygc3ltYm9sc1xuICAgICAgICAvLyBOT1RFOiB3ZSBtdXN0IG5vcm1hbGl6ZSB0ZXh0IGhlcmUgaW4gb3JkZXIgdG8gYmUgY29uc2lzdGVudCB3aXRoIHRoZSBudW1iZXIgb2ZcbiAgICAgICAgLy8gc3ltYm9scyByZXR1cm5lZCBmcm9tIHRoZSBiaWRpIGFsZ29yaXRobS4gSWYgd2UgZG9uJ3QsIHRoZW4gaW4gc29tZSBjYXNlcyBiaWRpXG4gICAgICAgIC8vIHJldHVybnMgYSBkaWZmZXJlbnQgbnVtYmVyIG9mIFJUTCBjb2RlcyB0byB3aGF0IHdlIGV4cGVjdC5cbiAgICAgICAgLy8gTk9URTogSUUgZG9lc24ndCBzdXBwb3J0IHN0cmluZy5ub3JtYWxpemUoKSwgc28gd2UgbXVzdCBjaGVjayBmb3IgaXRzIGV4aXN0ZW5jZVxuICAgICAgICAvLyBiZWZvcmUgaW52b2tpbmcuXG4gICAgICAgIHRoaXMuX3N5bWJvbHMgPSBzdHJpbmcuZ2V0U3ltYm9scyh0ZXh0Lm5vcm1hbGl6ZSA/IHRleHQubm9ybWFsaXplKCdORkMnKSA6IHRleHQpO1xuXG4gICAgICAgIC8vIGhhbmRsZSBudWxsIHN0cmluZ1xuICAgICAgICBpZiAodGhpcy5fc3ltYm9scy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3N5bWJvbHMgPSBbJyAnXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGV4dHJhY3QgbWFya3VwXG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVNYXJrdXApIHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBNYXJrdXAuZXZhbHVhdGUodGhpcy5fc3ltYm9scyk7XG4gICAgICAgICAgICB0aGlzLl9zeW1ib2xzID0gcmVzdWx0cy5zeW1ib2xzO1xuICAgICAgICAgICAgLy8gTk9URTogaWYgcmVzdWx0cy50YWdzIGlzIG51bGwsIHdlIGFzc2lnbiBbXSB0byBpbmNyZWFzZVxuICAgICAgICAgICAgLy8gcHJvYmFiaWxpdHkgb2YgYmF0Y2hpbmcuIFNvLCBpZiBhIHVzZXIgd2FudCB0byB1c2UgYXMgbGVzc1xuICAgICAgICAgICAgLy8gV2ViR0wgYnVmZmVycyBtZW1vcnkgYXMgcG9zc2libGUgdGhleSBjYW4ganVzdCBkaXNhYmxlIG1hcmt1cHMuXG4gICAgICAgICAgICB0YWdzID0gcmVzdWx0cy50YWdzIHx8IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaGFuZGxlIExUUiB2cyBSVEwgb3JkZXJpbmdcbiAgICAgICAgaWYgKHRoaXMuX3J0bFJlb3JkZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHJ0bFJlb3JkZXJGdW5jID0gdGhpcy5fc3lzdGVtLmFwcC5zeXN0ZW1zLmVsZW1lbnQuZ2V0UnRsUmVvcmRlcigpO1xuICAgICAgICAgICAgaWYgKHJ0bFJlb3JkZXJGdW5jKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IHJ0bFJlb3JkZXJGdW5jKHRoaXMuX3N5bWJvbHMpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fcnRsID0gcmVzdWx0cy5ydGw7XG5cbiAgICAgICAgICAgICAgICAvLyByZW9yZGVyIHN5bWJvbHMgYWNjb3JkaW5nIHRvIHVuaWNvZGUgcmVvcmRlciBtYXBwaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5fc3ltYm9scyA9IHJlc3VsdHMubWFwcGluZy5tYXAoZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3N5bWJvbHNbdl07XG4gICAgICAgICAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgICAgICAgICAvLyByZW9yZGVyIHRhZ3MgaWYgdGhleSBleGlzdCwgYWNjb3JkaW5nIHRvIHVuaWNvZGUgcmVvcmRlciBtYXBwaW5nXG4gICAgICAgICAgICAgICAgaWYgKHRhZ3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFncyA9IHJlc3VsdHMubWFwcGluZy5tYXAoZnVuY3Rpb24gKHYpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0YWdzW3ZdO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRWxlbWVudCBjcmVhdGVkIHdpdGggcnRsUmVvcmRlciBvcHRpb24gYnV0IG5vIHJ0bFJlb3JkZXIgZnVuY3Rpb24gcmVnaXN0ZXJlZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fcnRsID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBnZXRDb2xvclRoaWNrbmVzc0hhc2ggPSAoY29sb3IsIHRoaWNrbmVzcykgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIGAke2NvbG9yLnRvU3RyaW5nKHRydWUpLnRvTG93ZXJDYXNlKCl9OiR7XG4gICAgICAgICAgICAgICAgdGhpY2tuZXNzLnRvRml4ZWQoMilcbiAgICAgICAgICAgIH1gO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGdldENvbG9yT2Zmc2V0SGFzaCA9IChjb2xvciwgb2Zmc2V0KSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYCR7Y29sb3IudG9TdHJpbmcodHJ1ZSkudG9Mb3dlckNhc2UoKX06JHtcbiAgICAgICAgICAgICAgICBvZmZzZXQueC50b0ZpeGVkKDIpXG4gICAgICAgICAgICB9OiR7XG4gICAgICAgICAgICAgICAgb2Zmc2V0LnkudG9GaXhlZCgyKVxuICAgICAgICAgICAgfWA7XG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gcmVzb2x2ZSBjb2xvciwgb3V0bGluZSwgYW5kIHNoYWRvdyB0YWdzXG4gICAgICAgIGlmICh0YWdzKSB7XG4gICAgICAgICAgICBjb25zdCBwYWxldHRlTWFwID0geyB9O1xuICAgICAgICAgICAgY29uc3Qgb3V0bGluZVBhbGV0dGVNYXAgPSB7IH07XG4gICAgICAgICAgICBjb25zdCBzaGFkb3dQYWxldHRlTWFwID0geyB9O1xuXG4gICAgICAgICAgICAvLyBzdG9yZSBmYWxsYmFjayBjb2xvciBpbiB0aGUgcGFsZXR0ZVxuICAgICAgICAgICAgdGhpcy5fY29sb3JQYWxldHRlID0gW1xuICAgICAgICAgICAgICAgIE1hdGgucm91bmQodGhpcy5fY29sb3IuciAqIDI1NSksXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9jb2xvci5nICogMjU1KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX2NvbG9yLmIgKiAyNTUpXG4gICAgICAgICAgICBdO1xuICAgICAgICAgICAgdGhpcy5fb3V0bGluZVBhbGV0dGUgPSBbXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9vdXRsaW5lQ29sb3IuciAqIDI1NSksXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9vdXRsaW5lQ29sb3IuZyAqIDI1NSksXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9vdXRsaW5lQ29sb3IuYiAqIDI1NSksXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9vdXRsaW5lQ29sb3IuYSAqIDI1NSksXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9vdXRsaW5lVGhpY2tuZXNzICogMjU1KVxuICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd1BhbGV0dGUgPSBbXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9zaGFkb3dDb2xvci5yICogMjU1KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX3NoYWRvd0NvbG9yLmcgKiAyNTUpLFxuICAgICAgICAgICAgICAgIE1hdGgucm91bmQodGhpcy5fc2hhZG93Q29sb3IuYiAqIDI1NSksXG4gICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlzLl9zaGFkb3dDb2xvci5hICogMjU1KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX3NoYWRvd09mZnNldC54ICogMTI3KSxcbiAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHRoaXMuX3NoYWRvd09mZnNldC55ICogMTI3KVxuICAgICAgICAgICAgXTtcblxuICAgICAgICAgICAgdGhpcy5fc3ltYm9sQ29sb3JzID0gW107XG4gICAgICAgICAgICB0aGlzLl9zeW1ib2xPdXRsaW5lUGFyYW1zID0gW107XG4gICAgICAgICAgICB0aGlzLl9zeW1ib2xTaGFkb3dQYXJhbXMgPSBbXTtcblxuICAgICAgICAgICAgcGFsZXR0ZU1hcFt0aGlzLl9jb2xvci50b1N0cmluZyhmYWxzZSkudG9Mb3dlckNhc2UoKV0gPSAwO1xuICAgICAgICAgICAgb3V0bGluZVBhbGV0dGVNYXBbXG4gICAgICAgICAgICAgICAgZ2V0Q29sb3JUaGlja25lc3NIYXNoKHRoaXMuX291dGxpbmVDb2xvciwgdGhpcy5fb3V0bGluZVRoaWNrbmVzcylcbiAgICAgICAgICAgIF0gPSAwO1xuICAgICAgICAgICAgc2hhZG93UGFsZXR0ZU1hcFtcbiAgICAgICAgICAgICAgICBnZXRDb2xvck9mZnNldEhhc2godGhpcy5fc2hhZG93Q29sb3IsIHRoaXMuX3NoYWRvd09mZnNldClcbiAgICAgICAgICAgIF0gPSAwO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fc3ltYm9scy5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhZyA9IHRhZ3NbaV07XG4gICAgICAgICAgICAgICAgbGV0IGNvbG9yID0gMDtcblxuICAgICAgICAgICAgICAgIC8vIGdldCBtYXJrdXAgY29sb3JpbmdcbiAgICAgICAgICAgICAgICBpZiAodGFnICYmIHRhZy5jb2xvciAmJiB0YWcuY29sb3IudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYyA9IHRhZy5jb2xvci52YWx1ZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZXNvbHZlIGNvbG9yIGRpY3Rpb25hcnkgbmFtZXNcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETzogaW1wbGVtZW50IHRoZSBkaWN0aW9uYXJ5IG9mIGNvbG9yc1xuICAgICAgICAgICAgICAgICAgICAvLyBpZiAoY29sb3JEaWN0Lmhhc093blByb3BlcnR5KGMpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vICAgIGMgPSBkaWN0W2NdO1xuICAgICAgICAgICAgICAgICAgICAvLyB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29udmVydCBoZXggY29sb3JcbiAgICAgICAgICAgICAgICAgICAgaWYgKGMubGVuZ3RoID09PSA3ICYmIGNbMF0gPT09ICcjJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaGV4ID0gYy5zdWJzdHJpbmcoMSkudG9Mb3dlckNhc2UoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhbGV0dGVNYXAuaGFzT3duUHJvcGVydHkoaGV4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbG9yIGlzIGFscmVhZHkgaW4gdGhlIHBhbGV0dGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciA9IHBhbGV0dGVNYXBbaGV4XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKC9eKFswLTlhLWZdezJ9KXszfSQvLnRlc3QoaGV4KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBuZXcgY29sb3JcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3IgPSB0aGlzLl9jb2xvclBhbGV0dGUubGVuZ3RoIC8gMztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFsZXR0ZU1hcFtoZXhdID0gY29sb3I7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yUGFsZXR0ZS5wdXNoKHBhcnNlSW50KGhleC5zdWJzdHJpbmcoMCwgMiksIDE2KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yUGFsZXR0ZS5wdXNoKHBhcnNlSW50KGhleC5zdWJzdHJpbmcoMiwgNCksIDE2KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2NvbG9yUGFsZXR0ZS5wdXNoKHBhcnNlSW50KGhleC5zdWJzdHJpbmcoNCwgNiksIDE2KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX3N5bWJvbENvbG9ycy5wdXNoKGNvbG9yKTtcblxuICAgICAgICAgICAgICAgIGxldCBvdXRsaW5lID0gMDtcblxuICAgICAgICAgICAgICAgIC8vIGdldCBtYXJrdXAgb3V0bGluZVxuICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgdGFnICYmXG4gICAgICAgICAgICAgICAgICAgIHRhZy5vdXRsaW5lICYmXG4gICAgICAgICAgICAgICAgICAgICh0YWcub3V0bGluZS5hdHRyaWJ1dGVzLmNvbG9yIHx8IHRhZy5vdXRsaW5lLmF0dHJpYnV0ZXMudGhpY2tuZXNzKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgY29sb3IgPSB0YWcub3V0bGluZS5hdHRyaWJ1dGVzLmNvbG9yID9cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yVG1wLmZyb21TdHJpbmcodGFnLm91dGxpbmUuYXR0cmlidXRlcy5jb2xvcikgOlxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yO1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCB0aGlja25lc3MgPSBOdW1iZXIodGFnLm91dGxpbmUuYXR0cmlidXRlcy50aGlja25lc3MpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIE51bWJlci5pc05hTihjb2xvci5yKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgTnVtYmVyLmlzTmFOKGNvbG9yLmcpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBOdW1iZXIuaXNOYU4oY29sb3IuYikgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIE51bWJlci5pc05hTihjb2xvci5hKVxuICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gdGhpcy5fb3V0bGluZUNvbG9yO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKE51bWJlci5pc05hTih0aGlja25lc3MpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlja25lc3MgPSB0aGlzLl9vdXRsaW5lVGhpY2tuZXNzO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3V0bGluZUhhc2ggPSBnZXRDb2xvclRoaWNrbmVzc0hhc2goY29sb3IsIHRoaWNrbmVzcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG91dGxpbmVQYWxldHRlTWFwLmhhc093blByb3BlcnR5KG91dGxpbmVIYXNoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gb3V0bGluZSBwYXJhbWV0ZXJzIGlzIGFscmVhZHkgaW4gdGhlIHBhbGV0dGVcbiAgICAgICAgICAgICAgICAgICAgICAgIG91dGxpbmUgPSBvdXRsaW5lUGFsZXR0ZU1hcFtvdXRsaW5lSGFzaF07XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBuZXcgb3V0bGluZSBwYXJhbWV0ZXIgaW5kZXgsIDUgfiAociwgZywgYiwgYSwgdGhpY2tuZXNzKVxuICAgICAgICAgICAgICAgICAgICAgICAgb3V0bGluZSA9IHRoaXMuX291dGxpbmVQYWxldHRlLmxlbmd0aCAvIDU7XG4gICAgICAgICAgICAgICAgICAgICAgICBvdXRsaW5lUGFsZXR0ZU1hcFtvdXRsaW5lSGFzaF0gPSBvdXRsaW5lO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9vdXRsaW5lUGFsZXR0ZS5wdXNoKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQoY29sb3IuciAqIDI1NSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZChjb2xvci5nICogMjU1KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKGNvbG9yLmIgKiAyNTUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQoY29sb3IuYSAqIDI1NSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZCh0aGlja25lc3MgKiAyNTUpXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5fc3ltYm9sT3V0bGluZVBhcmFtcy5wdXNoKG91dGxpbmUpO1xuXG4gICAgICAgICAgICAgICAgbGV0IHNoYWRvdyA9IDA7XG5cbiAgICAgICAgICAgICAgICAvLyBnZXQgbWFya3VwIHNoYWRvd1xuICAgICAgICAgICAgICAgIGlmICh0YWcgJiYgdGFnLnNoYWRvdyAmJiAoXG4gICAgICAgICAgICAgICAgICAgIHRhZy5zaGFkb3cuYXR0cmlidXRlcy5jb2xvciB8fFxuICAgICAgICAgICAgICAgICAgICB0YWcuc2hhZG93LmF0dHJpYnV0ZXMub2Zmc2V0IHx8XG4gICAgICAgICAgICAgICAgICAgIHRhZy5zaGFkb3cuYXR0cmlidXRlcy5vZmZzZXRYIHx8XG4gICAgICAgICAgICAgICAgICAgIHRhZy5zaGFkb3cuYXR0cmlidXRlcy5vZmZzZXRZXG4gICAgICAgICAgICAgICAgKSkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgY29sb3IgPSB0YWcuc2hhZG93LmF0dHJpYnV0ZXMuY29sb3IgP1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JUbXAuZnJvbVN0cmluZyh0YWcuc2hhZG93LmF0dHJpYnV0ZXMuY29sb3IpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9mZiA9IE51bWJlcih0YWcuc2hhZG93LmF0dHJpYnV0ZXMub2Zmc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2ZmWCA9IE51bWJlcih0YWcuc2hhZG93LmF0dHJpYnV0ZXMub2Zmc2V0WCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9mZlkgPSBOdW1iZXIodGFnLnNoYWRvdy5hdHRyaWJ1dGVzLm9mZnNldFkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgIE51bWJlci5pc05hTihjb2xvci5yKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgTnVtYmVyLmlzTmFOKGNvbG9yLmcpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICBOdW1iZXIuaXNOYU4oY29sb3IuYikgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgIE51bWJlci5pc05hTihjb2xvci5hKVxuICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yID0gdGhpcy5fc2hhZG93Q29sb3I7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBvZmZzZXQgPSB2ZWMyVG1wLnNldChcbiAgICAgICAgICAgICAgICAgICAgICAgICFOdW1iZXIuaXNOYU4ob2ZmWCkgP1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mZlggOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICFOdW1iZXIuaXNOYU4ob2ZmKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mZiA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd09mZnNldC54LFxuICAgICAgICAgICAgICAgICAgICAgICAgIU51bWJlci5pc05hTihvZmZZKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb2ZmWSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIU51bWJlci5pc05hTihvZmYpID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2ZmIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0LnlcbiAgICAgICAgICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGFkb3dIYXNoID0gZ2V0Q29sb3JPZmZzZXRIYXNoKGNvbG9yLCBvZmZzZXQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChzaGFkb3dQYWxldHRlTWFwLmhhc093blByb3BlcnR5KHNoYWRvd0hhc2gpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzaGFkb3cgcGFyYW1ldGVycyBpcyBhbHJlYWR5IGluIHRoZSBwYWxldHRlXG4gICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3cgPSBzaGFkb3dQYWxldHRlTWFwW3NoYWRvd0hhc2hdO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbmV3IHNoYWRvdyBwYXJhbWV0ZXIgaW5kZXgsIDYgfiAociwgZywgYiwgYSwgb2Zmc2V0LngsIG9mZnNldC55KVxuICAgICAgICAgICAgICAgICAgICAgICAgc2hhZG93ID0gdGhpcy5fc2hhZG93UGFsZXR0ZS5sZW5ndGggLyA2O1xuICAgICAgICAgICAgICAgICAgICAgICAgc2hhZG93UGFsZXR0ZU1hcFtzaGFkb3dIYXNoXSA9IHNoYWRvdztcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UGFsZXR0ZS5wdXNoKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQoY29sb3IuciAqIDI1NSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZChjb2xvci5nICogMjU1KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKGNvbG9yLmIgKiAyNTUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1hdGgucm91bmQoY29sb3IuYSAqIDI1NSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZChvZmZzZXQueCAqIDEyNyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0aC5yb3VuZChvZmZzZXQueSAqIDEyNylcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9zeW1ib2xTaGFkb3dQYXJhbXMucHVzaChzaGFkb3cpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gbm8gdGFncywgdGhlcmVmb3JlIG5vIHBlci1zeW1ib2wgY29sb3JzXG4gICAgICAgICAgICB0aGlzLl9jb2xvclBhbGV0dGUgPSBbXTtcbiAgICAgICAgICAgIHRoaXMuX3N5bWJvbENvbG9ycyA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl9zeW1ib2xPdXRsaW5lUGFyYW1zID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuX3N5bWJvbFNoYWRvd1BhcmFtcyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbEVtaXNzaXZlKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsT3V0bGluZSgpO1xuICAgICAgICB0aGlzLl91cGRhdGVNYXRlcmlhbFNoYWRvdygpO1xuXG4gICAgICAgIGNvbnN0IGNoYXJhY3RlcnNQZXJUZXh0dXJlID0gdGhpcy5fY2FsY3VsYXRlQ2hhcnNQZXJUZXh0dXJlKCk7XG5cbiAgICAgICAgbGV0IHJlbW92ZWRNb2RlbCA9IGZhbHNlO1xuXG4gICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0aGlzLl9lbGVtZW50O1xuICAgICAgICBjb25zdCBzY3JlZW5TcGFjZSA9IGVsZW1lbnQuX2lzU2NyZWVuU3BhY2UoKTtcbiAgICAgICAgY29uc3Qgc2NyZWVuQ3VsbGVkID0gZWxlbWVudC5faXNTY3JlZW5DdWxsZWQoKTtcbiAgICAgICAgY29uc3QgdmlzaWJsZUZuID0gZnVuY3Rpb24gKGNhbWVyYSkge1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuaXNWaXNpYmxlRm9yQ2FtZXJhKGNhbWVyYSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21lc2hJbmZvLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsID0gY2hhcmFjdGVyc1BlclRleHR1cmVbaV0gfHwgMDtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbmZvID0gdGhpcy5fbWVzaEluZm9baV07XG5cbiAgICAgICAgICAgIGlmIChtZXNoSW5mby5jb3VudCAhPT0gbCkge1xuICAgICAgICAgICAgICAgIGlmICghcmVtb3ZlZE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKHRoaXMuX21vZGVsKTtcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlZE1vZGVsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb3VudCA9IGw7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ucG9zaXRpb25zLmxlbmd0aCA9IG1lc2hJbmZvLm5vcm1hbHMubGVuZ3RoID0gbCAqIDMgKiA0O1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmluZGljZXMubGVuZ3RoID0gbCAqIDMgKiAyO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnV2cy5sZW5ndGggPSBsICogMiAqIDQ7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzLmxlbmd0aCA9IGwgKiA0ICogNDtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5vdXRsaW5lcy5sZW5ndGggPSBsICogNCAqIDM7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uc2hhZG93cy5sZW5ndGggPSBsICogNCAqIDM7XG5cbiAgICAgICAgICAgICAgICAvLyBkZXN0cm95IG9sZCBtZXNoXG4gICAgICAgICAgICAgICAgaWYgKG1lc2hJbmZvLm1lc2hJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9yZW1vdmVNZXNoSW5zdGFuY2UobWVzaEluZm8ubWVzaEluc3RhbmNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGVyZSBhcmUgbm8gbGV0dGVycyBmb3IgdGhpcyBtZXNoIGNvbnRpbnVlXG4gICAgICAgICAgICAgICAgaWYgKGwgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8ubWVzaEluc3RhbmNlID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHVwIGluZGljZXMgYW5kIG5vcm1hbHMgd2hvc2UgdmFsdWVzIGRvbid0IGNoYW5nZSB3aGVuIHdlIGNhbGwgX3VwZGF0ZU1lc2hlc1xuICAgICAgICAgICAgICAgIGZvciAobGV0IHYgPSAwOyB2IDwgbDsgdisrKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBpbmRleCBhbmQgbm9ybWFsIGFycmF5cyBzaW5jZSB0aGV5IGRvbid0IGNoYW5nZVxuICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgbGVuZ3RoIGRvZXNuJ3QgY2hhbmdlXG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLmluZGljZXNbdiAqIDMgKiAyICsgMF0gPSB2ICogNDtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8uaW5kaWNlc1t2ICogMyAqIDIgKyAxXSA9IHYgKiA0ICsgMTtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8uaW5kaWNlc1t2ICogMyAqIDIgKyAyXSA9IHYgKiA0ICsgMztcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8uaW5kaWNlc1t2ICogMyAqIDIgKyAzXSA9IHYgKiA0ICsgMjtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8uaW5kaWNlc1t2ICogMyAqIDIgKyA0XSA9IHYgKiA0ICsgMztcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8uaW5kaWNlc1t2ICogMyAqIDIgKyA1XSA9IHYgKiA0ICsgMTtcblxuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5ub3JtYWxzW3YgKiA0ICogMyArIDBdID0gMDtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8ubm9ybWFsc1t2ICogNCAqIDMgKyAxXSA9IDA7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLm5vcm1hbHNbdiAqIDQgKiAzICsgMl0gPSAtMTtcblxuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5ub3JtYWxzW3YgKiA0ICogMyArIDNdID0gMDtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8ubm9ybWFsc1t2ICogNCAqIDMgKyA0XSA9IDA7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLm5vcm1hbHNbdiAqIDQgKiAzICsgNV0gPSAtMTtcblxuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5ub3JtYWxzW3YgKiA0ICogMyArIDZdID0gMDtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8ubm9ybWFsc1t2ICogNCAqIDMgKyA3XSA9IDA7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLm5vcm1hbHNbdiAqIDQgKiAzICsgOF0gPSAtMTtcblxuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5ub3JtYWxzW3YgKiA0ICogMyArIDldID0gMDtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluZm8ubm9ybWFsc1t2ICogNCAqIDMgKyAxMF0gPSAwO1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5ub3JtYWxzW3YgKiA0ICogMyArIDExXSA9IC0xO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBjcmVhdGVUZXh0TWVzaCh0aGlzLl9zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLCBtZXNoSW5mbyk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaCwgdGhpcy5fbWF0ZXJpYWwsIHRoaXMuX25vZGUpO1xuICAgICAgICAgICAgICAgIG1pLm5hbWUgPSAnVGV4dCBFbGVtZW50OiAnICsgdGhpcy5fZW50aXR5Lm5hbWU7XG4gICAgICAgICAgICAgICAgbWkuY2FzdFNoYWRvdyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIG1pLnJlY2VpdmVTaGFkb3cgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBtaS5jdWxsID0gIXNjcmVlblNwYWNlO1xuICAgICAgICAgICAgICAgIG1pLnNjcmVlblNwYWNlID0gc2NyZWVuU3BhY2U7XG4gICAgICAgICAgICAgICAgbWkuZHJhd09yZGVyID0gdGhpcy5fZHJhd09yZGVyO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNjcmVlbkN1bGxlZCkge1xuICAgICAgICAgICAgICAgICAgICBtaS5jdWxsID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgbWkuaXNWaXNpYmxlRnVuYyA9IHZpc2libGVGbjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRUZXh0dXJlUGFyYW1zKG1pLCB0aGlzLl9mb250LnRleHR1cmVzW2ldKTtcblxuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmUnLCB0aGlzLl9jb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignbWF0ZXJpYWxfb3BhY2l0eScsIHRoaXMuX2NvbG9yLmEpO1xuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignZm9udF9zZGZJbnRlbnNpdHknLCB0aGlzLl9mb250LmludGVuc2l0eSk7XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdmb250X3B4cmFuZ2UnLCB0aGlzLl9nZXRQeFJhbmdlKHRoaXMuX2ZvbnQpKTtcbiAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ2ZvbnRfdGV4dHVyZVdpZHRoJywgdGhpcy5fZm9udC5kYXRhLmluZm8ubWFwc1tpXS53aWR0aCk7XG5cbiAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ291dGxpbmVfY29sb3InLCB0aGlzLl9vdXRsaW5lQ29sb3JVbmlmb3JtKTtcbiAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ291dGxpbmVfdGhpY2tuZXNzJywgdGhpcy5fb3V0bGluZVRoaWNrbmVzc1NjYWxlICogdGhpcy5fb3V0bGluZVRoaWNrbmVzcyk7XG5cbiAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ3NoYWRvd19jb2xvcicsIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3N5bWJvbFNoYWRvd1BhcmFtcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dPZmZzZXRVbmlmb3JtWzBdID0gMDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0VW5pZm9ybVsxXSA9IDA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmF0aW8gPSAtdGhpcy5fZm9udC5kYXRhLmluZm8ubWFwc1tpXS53aWR0aCAvIHRoaXMuX2ZvbnQuZGF0YS5pbmZvLm1hcHNbaV0uaGVpZ2h0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zaGFkb3dPZmZzZXRVbmlmb3JtWzBdID0gdGhpcy5fc2hhZG93T2Zmc2V0U2NhbGUgKiB0aGlzLl9zaGFkb3dPZmZzZXQueDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0VW5pZm9ybVsxXSA9IHJhdGlvICogdGhpcy5fc2hhZG93T2Zmc2V0U2NhbGUgKiB0aGlzLl9zaGFkb3dPZmZzZXQueTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdzaGFkb3dfb2Zmc2V0JywgdGhpcy5fc2hhZG93T2Zmc2V0VW5pZm9ybSk7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5tZXNoSW5zdGFuY2UgPSBtaTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMucHVzaChtaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhZnRlciBjcmVhdGluZyBuZXcgbWVzaGVzXG4gICAgICAgIC8vIHJlLWFwcGx5IG1hc2tpbmcgc3RlbmNpbCBwYXJhbXNcbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQubWFza2VkQnkpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuX3NldE1hc2tlZEJ5KHRoaXMuX2VsZW1lbnQubWFza2VkQnkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlbW92ZWRNb2RlbCAmJiB0aGlzLl9lbGVtZW50LmVuYWJsZWQgJiYgdGhpcy5fZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuYWRkTW9kZWxUb0xheWVycyh0aGlzLl9tb2RlbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91cGRhdGVNZXNoZXMoKTtcblxuICAgICAgICAvLyB1cGRhdGUgcmVuZGVyIHJhbmdlXG4gICAgICAgIHRoaXMuX3JhbmdlU3RhcnQgPSAwO1xuICAgICAgICB0aGlzLl9yYW5nZUVuZCA9IHRoaXMuX3N5bWJvbHMubGVuZ3RoO1xuICAgICAgICB0aGlzLl91cGRhdGVSZW5kZXJSYW5nZSgpO1xuICAgIH1cblxuICAgIF9yZW1vdmVNZXNoSW5zdGFuY2UobWVzaEluc3RhbmNlKSB7XG5cbiAgICAgICAgbWVzaEluc3RhbmNlLmRlc3Ryb3koKTtcblxuICAgICAgICBjb25zdCBpZHggPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzLmluZGV4T2YobWVzaEluc3RhbmNlKTtcbiAgICAgICAgaWYgKGlkeCAhPT0gLTEpXG4gICAgICAgICAgICB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzLnNwbGljZShpZHgsIDEpO1xuICAgIH1cblxuICAgIF9zZXRNYXRlcmlhbChtYXRlcmlhbCkge1xuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgICAgIG1pLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlTWF0ZXJpYWwoc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2VsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHNjcmVlbkN1bGxlZCA9IGVsZW1lbnQuX2lzU2NyZWVuQ3VsbGVkKCk7XG4gICAgICAgIGNvbnN0IHZpc2libGVGbiA9IGZ1bmN0aW9uIChjYW1lcmEpIHtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50LmlzVmlzaWJsZUZvckNhbWVyYShjYW1lcmEpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IG1zZGYgPSB0aGlzLl9mb250ICYmIHRoaXMuX2ZvbnQudHlwZSA9PT0gRk9OVF9NU0RGO1xuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHRoaXMuX3N5c3RlbS5nZXRUZXh0RWxlbWVudE1hdGVyaWFsKHNjcmVlblNwYWNlLCBtc2RmLCB0aGlzLl9lbmFibGVNYXJrdXApO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgbWkuY3VsbCA9ICFzY3JlZW5TcGFjZTtcbiAgICAgICAgICAgICAgICBtaS5tYXRlcmlhbCA9IHRoaXMuX21hdGVyaWFsO1xuICAgICAgICAgICAgICAgIG1pLnNjcmVlblNwYWNlID0gc2NyZWVuU3BhY2U7XG5cbiAgICAgICAgICAgICAgICBpZiAoc2NyZWVuQ3VsbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pLmN1bGwgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICBtaS5pc1Zpc2libGVGdW5jID0gdmlzaWJsZUZuO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1pLmlzVmlzaWJsZUZ1bmMgPSBudWxsO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1hdGVyaWFsRW1pc3NpdmUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zeW1ib2xDb2xvcnMpIHtcbiAgICAgICAgICAgIC8vIHdoZW4gcGVyLXZlcnRleCBjb2xvcmluZyBpcyBwcmVzZW50LCBkaXNhYmxlIG1hdGVyaWFsIGVtaXNzaXZlIGNvbG9yXG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSAxO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gMTtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9jb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzFdID0gdGhpcy5fY29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX2NvbG9yLmI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlTWF0ZXJpYWxPdXRsaW5lKCkge1xuICAgICAgICBpZiAodGhpcy5fc3ltYm9sT3V0bGluZVBhcmFtcykge1xuICAgICAgICAgICAgLy8gd2hlbiBwZXItdmVydGV4IG91dGxpbmUgaXMgcHJlc2VudCwgZGlzYWJsZSBtYXRlcmlhbCBvdXRsaW5lIHVuaWZvcm1zXG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3JVbmlmb3JtWzBdID0gMDtcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bMV0gPSAwO1xuICAgICAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yVW5pZm9ybVsyXSA9IDA7XG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3JVbmlmb3JtWzNdID0gMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9vdXRsaW5lQ29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9vdXRsaW5lQ29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9vdXRsaW5lQ29sb3IuYjtcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm1bM10gPSB0aGlzLl9vdXRsaW5lQ29sb3IuYTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVNYXRlcmlhbFNoYWRvdygpIHtcbiAgICAgICAgaWYgKHRoaXMuX3N5bWJvbE91dGxpbmVQYXJhbXMpIHtcbiAgICAgICAgICAgIC8vIHdoZW4gcGVyLXZlcnRleCBzaGFkb3cgaXMgcHJlc2VudCwgZGlzYWJsZSBtYXRlcmlhbCBzaGFkb3cgdW5pZm9ybXNcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybVswXSA9IDA7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvclVuaWZvcm1bMV0gPSAwO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtWzJdID0gMDtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybVszXSA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvclVuaWZvcm1bMF0gPSB0aGlzLl9zaGFkb3dDb2xvci5yO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtWzFdID0gdGhpcy5fc2hhZG93Q29sb3IuZztcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybVsyXSA9IHRoaXMuX3NoYWRvd0NvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvclVuaWZvcm1bM10gPSB0aGlzLl9zaGFkb3dDb2xvci5hO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gY2hhciBpcyBzcGFjZSwgdGFiLCBvciBkYXNoXG4gICAgX2lzV29yZEJvdW5kYXJ5KGNoYXIpIHtcbiAgICAgICAgcmV0dXJuIFdPUkRfQk9VTkRBUllfQ0hBUi50ZXN0KGNoYXIpO1xuICAgIH1cblxuICAgIF9pc1ZhbGlkTmV4dENoYXIobmV4dGNoYXIpIHtcbiAgICAgICAgcmV0dXJuIChuZXh0Y2hhciAhPT0gbnVsbCkgJiYgIU5PX0xJTkVfQlJFQUtfQ0pLX0NIQVIudGVzdChuZXh0Y2hhcik7XG4gICAgfVxuXG4gICAgLy8gY2hhciBpcyBhIENKSyBjaGFyYWN0ZXIgYW5kIG5leHQgY2hhcmFjdGVyIGlzIGEgQ0pLIGJvdW5kYXJ5XG4gICAgX2lzTmV4dENKS0JvdW5kYXJ5KGNoYXIsIG5leHRjaGFyKSB7XG4gICAgICAgIHJldHVybiBDSktfQ0hBUi50ZXN0KGNoYXIpICYmIChXT1JEX0JPVU5EQVJZX0NIQVIudGVzdChuZXh0Y2hhcikgfHwgQUxQSEFOVU1FUklDX0NIQVIudGVzdChuZXh0Y2hhcikpO1xuICAgIH1cblxuICAgIC8vIG5leHQgY2hhcmFjdGVyIGlzIGEgQ0pLIGNoYXJhY3RlciB0aGF0IGNhbiBiZSBhIHdob2xlIHdvcmRcbiAgICBfaXNOZXh0Q0pLV2hvbGVXb3JkKG5leHRjaGFyKSB7XG4gICAgICAgIHJldHVybiBDSktfQ0hBUi50ZXN0KG5leHRjaGFyKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlTWVzaGVzKCkge1xuICAgICAgICBjb25zdCBqc29uID0gdGhpcy5fZm9udC5kYXRhO1xuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICBjb25zdCBtaW5Gb250ID0gTWF0aC5taW4odGhpcy5fbWluRm9udFNpemUsIHRoaXMuX21heEZvbnRTaXplKTtcbiAgICAgICAgY29uc3QgbWF4Rm9udCA9IHRoaXMuX21heEZvbnRTaXplO1xuXG4gICAgICAgIGNvbnN0IGF1dG9GaXQgPSB0aGlzLl9zaG91bGRBdXRvRml0KCk7XG5cbiAgICAgICAgaWYgKGF1dG9GaXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZvbnRTaXplID0gdGhpcy5fbWF4Rm9udFNpemU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBNQUdJQyA9IDMyO1xuICAgICAgICBjb25zdCBsID0gdGhpcy5fc3ltYm9scy5sZW5ndGg7XG5cbiAgICAgICAgbGV0IF94ID0gMDsgLy8gY3Vyc29yc1xuICAgICAgICBsZXQgX3kgPSAwO1xuICAgICAgICBsZXQgX3ogPSAwO1xuICAgICAgICBsZXQgX3hNaW51c1RyYWlsaW5nV2hpdGVzcGFjZSA9IDA7XG4gICAgICAgIGxldCBsaW5lcyA9IDE7XG4gICAgICAgIGxldCB3b3JkU3RhcnRYID0gMDtcbiAgICAgICAgbGV0IHdvcmRTdGFydEluZGV4ID0gMDtcbiAgICAgICAgbGV0IGxpbmVTdGFydEluZGV4ID0gMDtcbiAgICAgICAgbGV0IG51bVdvcmRzVGhpc0xpbmUgPSAwO1xuICAgICAgICBsZXQgbnVtQ2hhcnNUaGlzTGluZSA9IDA7XG4gICAgICAgIGxldCBudW1CcmVha3NUaGlzTGluZSA9IDA7XG5cbiAgICAgICAgY29uc3Qgc3BsaXRIb3Jpem9udGFsQW5jaG9ycyA9IE1hdGguYWJzKHRoaXMuX2VsZW1lbnQuYW5jaG9yLnggLSB0aGlzLl9lbGVtZW50LmFuY2hvci56KSA+PSAwLjAwMDE7XG5cbiAgICAgICAgbGV0IG1heExpbmVXaWR0aCA9IHRoaXMuX2VsZW1lbnQuY2FsY3VsYXRlZFdpZHRoO1xuICAgICAgICBpZiAoKHRoaXMuYXV0b1dpZHRoICYmICFzcGxpdEhvcml6b250YWxBbmNob3JzKSB8fCAhdGhpcy5fd3JhcExpbmVzKSB7XG4gICAgICAgICAgICBtYXhMaW5lV2lkdGggPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZm9udE1pblkgPSAwO1xuICAgICAgICBsZXQgZm9udE1heFkgPSAwO1xuXG4gICAgICAgIGxldCBjaGFyLCBkYXRhLCBxdWFkLCBuZXh0Y2hhcjtcblxuICAgICAgICBmdW5jdGlvbiBicmVha0xpbmUoc3ltYm9scywgbGluZUJyZWFrSW5kZXgsIGxpbmVCcmVha1gpIHtcbiAgICAgICAgICAgIHNlbGYuX2xpbmVXaWR0aHMucHVzaChNYXRoLmFicyhsaW5lQnJlYWtYKSk7XG4gICAgICAgICAgICAvLyBpbiBydGwgbW9kZSBsaW5lU3RhcnRJbmRleCB3aWxsIHVzdWFsbHkgYmUgbGFyZ2VyIHRoYW4gbGluZUJyZWFrSW5kZXggYW5kIHdlIHdpbGxcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gYWRqdXN0IHRoZSBzdGFydCAvIGVuZCBpbmRpY2VzIHdoZW4gY2FsbGluZyBzeW1ib2xzLnNsaWNlKClcbiAgICAgICAgICAgIGNvbnN0IHNsaWNlU3RhcnQgPSBsaW5lU3RhcnRJbmRleCA+IGxpbmVCcmVha0luZGV4ID8gbGluZUJyZWFrSW5kZXggKyAxIDogbGluZVN0YXJ0SW5kZXg7XG4gICAgICAgICAgICBjb25zdCBzbGljZUVuZCA9IGxpbmVTdGFydEluZGV4ID4gbGluZUJyZWFrSW5kZXggPyBsaW5lU3RhcnRJbmRleCArIDEgOiBsaW5lQnJlYWtJbmRleDtcbiAgICAgICAgICAgIGNvbnN0IGNoYXJzID0gc3ltYm9scy5zbGljZShzbGljZVN0YXJ0LCBzbGljZUVuZCk7XG5cbiAgICAgICAgICAgIC8vIFJlbW92ZSBsaW5lIGJyZWFrcyBmcm9tIGxpbmUuXG4gICAgICAgICAgICAvLyBMaW5lIGJyZWFrcyB3b3VsZCBvbmx5IGJlIHRoZXJlIGZvciB0aGUgZmluYWwgbGluZVxuICAgICAgICAgICAgLy8gd2hlbiB3ZSByZWFjaCB0aGUgbWF4TGluZXMgbGltaXQuXG4gICAgICAgICAgICAvLyBUT0RPOiBXZSBjb3VsZCBwb3NzaWJseSBub3QgZG8gdGhpcyBhbmQganVzdCBsZXQgbGluZXMgaGF2ZVxuICAgICAgICAgICAgLy8gbmV3IGxpbmVzIGluIHRoZW0uIEFwYXJ0IGZyb20gYmVpbmcgYSBiaXQgd2VpcmQgaXQgc2hvdWxkIG5vdCBhZmZlY3RcbiAgICAgICAgICAgIC8vIHRoZSByZW5kZXJlZCB0ZXh0LlxuICAgICAgICAgICAgaWYgKG51bUJyZWFrc1RoaXNMaW5lKSB7XG4gICAgICAgICAgICAgICAgbGV0IGkgPSBjaGFycy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGktLSAmJiBudW1CcmVha3NUaGlzTGluZSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKExJTkVfQlJFQUtfQ0hBUi50ZXN0KGNoYXJzW2ldKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2hhcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbnVtQnJlYWtzVGhpc0xpbmUtLTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2VsZi5fbGluZUNvbnRlbnRzLnB1c2goY2hhcnMuam9pbignJykpO1xuXG4gICAgICAgICAgICBfeCA9IDA7XG4gICAgICAgICAgICBfeSAtPSBzZWxmLl9zY2FsZWRMaW5lSGVpZ2h0O1xuICAgICAgICAgICAgbGluZXMrKztcbiAgICAgICAgICAgIG51bVdvcmRzVGhpc0xpbmUgPSAwO1xuICAgICAgICAgICAgbnVtQ2hhcnNUaGlzTGluZSA9IDA7XG4gICAgICAgICAgICBudW1CcmVha3NUaGlzTGluZSA9IDA7XG4gICAgICAgICAgICB3b3JkU3RhcnRYID0gMDtcbiAgICAgICAgICAgIGxpbmVTdGFydEluZGV4ID0gbGluZUJyZWFrSW5kZXg7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcmV0cnlVcGRhdGVNZXNoZXMgPSB0cnVlO1xuICAgICAgICB3aGlsZSAocmV0cnlVcGRhdGVNZXNoZXMpIHtcbiAgICAgICAgICAgIHJldHJ5VXBkYXRlTWVzaGVzID0gZmFsc2U7XG5cbiAgICAgICAgICAgIC8vIGlmIGF1dG8tZml0dGluZyB0aGVuIHNjYWxlIHRoZSBsaW5lIGhlaWdodFxuICAgICAgICAgICAgLy8gYWNjb3JkaW5nIHRvIHRoZSBjdXJyZW50IGZvbnRTaXplIHZhbHVlIHJlbGF0aXZlIHRvIHRoZSBtYXggZm9udCBzaXplXG4gICAgICAgICAgICBpZiAoYXV0b0ZpdCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NjYWxlZExpbmVIZWlnaHQgPSB0aGlzLl9saW5lSGVpZ2h0ICogdGhpcy5fZm9udFNpemUgLyAodGhpcy5fbWF4Rm9udFNpemUgfHwgMC4wMDAxKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2NhbGVkTGluZUhlaWdodCA9IHRoaXMuX2xpbmVIZWlnaHQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMud2lkdGggPSAwO1xuICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSAwO1xuICAgICAgICAgICAgdGhpcy5fbGluZVdpZHRocyA9IFtdO1xuICAgICAgICAgICAgdGhpcy5fbGluZUNvbnRlbnRzID0gW107XG5cbiAgICAgICAgICAgIF94ID0gMDtcbiAgICAgICAgICAgIF95ID0gMDtcbiAgICAgICAgICAgIF96ID0gMDtcbiAgICAgICAgICAgIF94TWludXNUcmFpbGluZ1doaXRlc3BhY2UgPSAwO1xuXG4gICAgICAgICAgICBsaW5lcyA9IDE7XG4gICAgICAgICAgICB3b3JkU3RhcnRYID0gMDtcbiAgICAgICAgICAgIHdvcmRTdGFydEluZGV4ID0gMDtcbiAgICAgICAgICAgIGxpbmVTdGFydEluZGV4ID0gMDtcbiAgICAgICAgICAgIG51bVdvcmRzVGhpc0xpbmUgPSAwO1xuICAgICAgICAgICAgbnVtQ2hhcnNUaGlzTGluZSA9IDA7XG4gICAgICAgICAgICBudW1CcmVha3NUaGlzTGluZSA9IDA7XG5cbiAgICAgICAgICAgIGNvbnN0IHNjYWxlID0gdGhpcy5fZm9udFNpemUgLyBNQUdJQztcblxuICAgICAgICAgICAgLy8gc2NhbGUgbWF4IGZvbnQgZXh0ZW50c1xuICAgICAgICAgICAgZm9udE1pblkgPSB0aGlzLl9mb250TWluWSAqIHNjYWxlO1xuICAgICAgICAgICAgZm9udE1heFkgPSB0aGlzLl9mb250TWF4WSAqIHNjYWxlO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21lc2hJbmZvLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucXVhZCA9IDA7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ubGluZXMgPSB7fTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcGVyLXZlcnRleCBjb2xvclxuICAgICAgICAgICAgbGV0IGNvbG9yX3IgPSAyNTU7XG4gICAgICAgICAgICBsZXQgY29sb3JfZyA9IDI1NTtcbiAgICAgICAgICAgIGxldCBjb2xvcl9iID0gMjU1O1xuXG4gICAgICAgICAgICAvLyBwZXItdmVydGV4IG91dGxpbmUgcGFyYW1ldGVyc1xuICAgICAgICAgICAgbGV0IG91dGxpbmVfY29sb3JfcmcgPSAyNTUgKyAyNTUgKiAyNTY7XG4gICAgICAgICAgICBsZXQgb3V0bGluZV9jb2xvcl9iYSA9IDI1NSArIDI1NSAqIDI1NjtcbiAgICAgICAgICAgIGxldCBvdXRsaW5lX3RoaWNrbmVzcyA9IDA7XG5cbiAgICAgICAgICAgIC8vIHBlci12ZXJ0ZXggc2hhZG93IHBhcmFtZXRlcnNcbiAgICAgICAgICAgIGxldCBzaGFkb3dfY29sb3JfcmcgPSAyNTUgKyAyNTUgKiAyNTY7XG4gICAgICAgICAgICBsZXQgc2hhZG93X2NvbG9yX2JhID0gMjU1ICsgMjU1ICogMjU2O1xuICAgICAgICAgICAgbGV0IHNoYWRvd19vZmZzZXRfeHkgPSAxMjcgKyAxMjcgKiAyNTY7XG5cbiAgICAgICAgICAgIC8vIEluIGxlZnQtdG8tcmlnaHQgbW9kZSB3ZSBsb29wIHRocm91Z2ggdGhlIHN5bWJvbHMgZnJvbSBzdGFydCB0byBlbmQuXG4gICAgICAgICAgICAvLyBJbiByaWdodC10by1sZWZ0IG1vZGUgd2UgbG9vcCB0aHJvdWdoIHRoZSBzeW1ib2xzIGZyb20gZW5kIHRvIHRoZSBiZWdpbm5pbmdcbiAgICAgICAgICAgIC8vIGluIG9yZGVyIHRvIHdyYXAgbGluZXMgaW4gdGhlIGNvcnJlY3Qgb3JkZXJcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY2hhciA9IHRoaXMuX3N5bWJvbHNbaV07XG4gICAgICAgICAgICAgICAgbmV4dGNoYXIgPSAoKGkgKyAxKSA+PSBsKSA/IG51bGwgOiB0aGlzLl9zeW1ib2xzW2kgKyAxXTtcblxuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBsaW5lIGJyZWFrXG4gICAgICAgICAgICAgICAgY29uc3QgaXNMaW5lQnJlYWsgPSBMSU5FX0JSRUFLX0NIQVIudGVzdChjaGFyKTtcbiAgICAgICAgICAgICAgICBpZiAoaXNMaW5lQnJlYWspIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtQnJlYWtzVGhpc0xpbmUrKztcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgd2UgYXJlIG5vdCBsaW5lIHdyYXBwaW5nIHRoZW4gd2Ugc2hvdWxkIGJlIGlnbm9yaW5nIG1heGxpbmVzXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5fd3JhcExpbmVzIHx8IHRoaXMuX21heExpbmVzIDwgMCB8fCBsaW5lcyA8IHRoaXMuX21heExpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVha0xpbmUodGhpcy5fc3ltYm9scywgaSwgX3hNaW51c1RyYWlsaW5nV2hpdGVzcGFjZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB3b3JkU3RhcnRJbmRleCA9IGkgKyAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGluZVN0YXJ0SW5kZXggPSBpICsgMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBsZXQgeCA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IHkgPSAwO1xuICAgICAgICAgICAgICAgIGxldCBhZHZhbmNlID0gMDtcbiAgICAgICAgICAgICAgICBsZXQgcXVhZHNpemUgPSAxO1xuICAgICAgICAgICAgICAgIGxldCBkYXRhU2NhbGUsIHNpemU7XG5cbiAgICAgICAgICAgICAgICBkYXRhID0ganNvbi5jaGFyc1tjaGFyXTtcblxuICAgICAgICAgICAgICAgIC8vIGhhbmRsZSBtaXNzaW5nIGdseXBoXG4gICAgICAgICAgICAgICAgaWYgKCFkYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChDT05UUk9MX0NIQVJTLmluZGV4T2YoY2hhcikgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBoYW5kbGUgdW5pY29kZSBjb250cm9sIGNoYXJhY3RlcnNcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEgPSBDT05UUk9MX0dMWVBIX0RBVEE7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBvdGhlcndpc2UgdXNlIHNwYWNlIGNoYXJhY3RlclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGpzb24uY2hhcnNbJyAnXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEgPSBqc29uLmNoYXJzWycgJ107XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnJlYWNoYWJsZS1sb29wXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4ganNvbi5jaGFycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhID0ganNvbi5jaGFyc1trZXldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vICNpZiBfREVCVUdcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghanNvbi5taXNzaW5nQ2hhcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBqc29uLm1pc3NpbmdDaGFycyA9IG5ldyBTZXQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFqc29uLm1pc3NpbmdDaGFycy5oYXMoY2hhcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYENoYXJhY3RlciAnJHtjaGFyfScgaXMgbWlzc2luZyBmcm9tIHRoZSBmb250ICR7anNvbi5pbmZvLmZhY2V9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAganNvbi5taXNzaW5nQ2hhcnMuYWRkKGNoYXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gI2VuZGlmXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICBsZXQga2VybmluZyA9IDA7XG4gICAgICAgICAgICAgICAgICAgIGlmIChudW1DaGFyc1RoaXNMaW5lID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2VyblRhYmxlID0gdGhpcy5fZm9udC5kYXRhLmtlcm5pbmc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoa2VyblRhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2VybkxlZnQgPSBrZXJuVGFibGVbc3RyaW5nLmdldENvZGVQb2ludCh0aGlzLl9zeW1ib2xzW2kgLSAxXSkgfHwgMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGtlcm5MZWZ0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtlcm5pbmcgPSBrZXJuTGVmdFtzdHJpbmcuZ2V0Q29kZVBvaW50KHRoaXMuX3N5bWJvbHNbaV0pIHx8IDBdIHx8IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGRhdGFTY2FsZSA9IGRhdGEuc2NhbGUgfHwgMTtcbiAgICAgICAgICAgICAgICAgICAgc2l6ZSA9IChkYXRhLndpZHRoICsgZGF0YS5oZWlnaHQpIC8gMjtcbiAgICAgICAgICAgICAgICAgICAgcXVhZHNpemUgPSBzY2FsZSAqIHNpemUgLyBkYXRhU2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIGFkdmFuY2UgPSAoZGF0YS54YWR2YW5jZSArIGtlcm5pbmcpICogc2NhbGU7XG4gICAgICAgICAgICAgICAgICAgIHggPSAoZGF0YS54b2Zmc2V0IC0ga2VybmluZykgKiBzY2FsZTtcbiAgICAgICAgICAgICAgICAgICAgeSA9IGRhdGEueW9mZnNldCAqIHNjYWxlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYENvdWxkbid0IHN1YnN0aXR1dGUgbWlzc2luZyBjaGFyYWN0ZXI6ICcke2NoYXJ9J2ApO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGlzV2hpdGVzcGFjZSA9IFdISVRFU1BBQ0VfQ0hBUi50ZXN0KGNoYXIpO1xuXG5cbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoSW5mb0lkID0gKGRhdGEgJiYgZGF0YS5tYXApIHx8IDA7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF0aW8gPSAtdGhpcy5fZm9udC5kYXRhLmluZm8ubWFwc1ttZXNoSW5mb0lkXS53aWR0aCAvXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZvbnQuZGF0YS5pbmZvLm1hcHNbbWVzaEluZm9JZF0uaGVpZ2h0O1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbmZvID0gdGhpcy5fbWVzaEluZm9bbWVzaEluZm9JZF07XG5cbiAgICAgICAgICAgICAgICBjb25zdCBjYW5kaWRhdGVMaW5lV2lkdGggPSBfeCArIHRoaXMuX3NwYWNpbmcgKiBhZHZhbmNlO1xuXG4gICAgICAgICAgICAgICAgLy8gSWYgd2UndmUgZXhjZWVkZWQgdGhlIG1heGltdW0gbGluZSB3aWR0aCwgbW92ZSBldmVyeXRoaW5nIGZyb20gdGhlIGJlZ2lubmluZyBvZlxuICAgICAgICAgICAgICAgIC8vIHRoZSBjdXJyZW50IHdvcmQgb253YXJkcyBkb3duIG9udG8gYSBuZXcgbGluZS5cbiAgICAgICAgICAgICAgICBpZiAoY2FuZGlkYXRlTGluZVdpZHRoID4gbWF4TGluZVdpZHRoICYmIG51bUNoYXJzVGhpc0xpbmUgPiAwICYmICFpc1doaXRlc3BhY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX21heExpbmVzIDwgMCB8fCBsaW5lcyA8IHRoaXMuX21heExpbmVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBIYW5kbGUgdGhlIGNhc2Ugd2hlcmUgYSBsaW5lIGNvbnRhaW5pbmcgb25seSBhIHNpbmdsZSBsb25nIHdvcmQgbmVlZHMgdG8gYmVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJyb2tlbiBvbnRvIG11bHRpcGxlIGxpbmVzLlxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG51bVdvcmRzVGhpc0xpbmUgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3b3JkU3RhcnRJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWtMaW5lKHRoaXMuX3N5bWJvbHMsIGksIF94TWludXNUcmFpbGluZ1doaXRlc3BhY2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBNb3ZlIGJhY2sgdG8gdGhlIGJlZ2lubmluZyBvZiB0aGUgY3VycmVudCB3b3JkLlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhY2t0cmFjayA9IE1hdGgubWF4KGkgLSB3b3JkU3RhcnRJbmRleCwgMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbmZvLmxlbmd0aCA8PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc2hJbmZvLmxpbmVzW2xpbmVzIC0gMV0gLT0gYmFja3RyYWNrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNoSW5mby5xdWFkIC09IGJhY2t0cmFjaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBXZSBzaG91bGQgb25seSBiYWNrdHJhY2sgdGhlIHF1YWRzIHRoYXQgd2VyZSBpbiB0aGUgd29yZCBmcm9tIHRoaXMgc2FtZSB0ZXh0dXJlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFdlIHdpbGwgaGF2ZSB0byB1cGRhdGUgTiBudW1iZXIgb2YgbWVzaCBpbmZvcyBhcyBhIHJlc3VsdCAoYWxsIHRleHR1cmVzIHVzZWQgaW4gdGhlIHdvcmQgaW4gcXVlc3Rpb24pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhY2t0cmFja1N0YXJ0ID0gd29yZFN0YXJ0SW5kZXg7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhY2t0cmFja0VuZCA9IGk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSBiYWNrdHJhY2tTdGFydDsgaiA8IGJhY2t0cmFja0VuZDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiYWNrQ2hhciA9IHRoaXMuX3N5bWJvbHNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiYWNrQ2hhckRhdGEgPSBqc29uLmNoYXJzW2JhY2tDaGFyXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhY2tNZXNoSW5mbyA9IHRoaXMuX21lc2hJbmZvWyhiYWNrQ2hhckRhdGEgJiYgYmFja0NoYXJEYXRhLm1hcCkgfHwgMF07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrTWVzaEluZm8ubGluZXNbbGluZXMgLSAxXSAtPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmFja01lc2hJbmZvLnF1YWQgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGkgLT0gYmFja3RyYWNrICsgMTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrTGluZSh0aGlzLl9zeW1ib2xzLCB3b3JkU3RhcnRJbmRleCwgd29yZFN0YXJ0WCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBxdWFkID0gbWVzaEluZm8ucXVhZDtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5saW5lc1tsaW5lcyAtIDFdID0gcXVhZDtcblxuICAgICAgICAgICAgICAgIGxldCBsZWZ0ID0gX3ggLSB4O1xuICAgICAgICAgICAgICAgIGxldCByaWdodCA9IGxlZnQgKyBxdWFkc2l6ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBib3R0b20gPSBfeSAtIHk7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9wID0gYm90dG9tICsgcXVhZHNpemU7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fcnRsKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHJ0bCB0ZXh0IHdpbGwgYmUgZmxpcHBlZCB2ZXJ0aWNhbGx5IGJlZm9yZSByZW5kZXJpbmcgYW5kIGhlcmUgd2VcbiAgICAgICAgICAgICAgICAgICAgLy8gYWNjb3VudCBmb3IgdGhlIG1pcy1hbGlnbm1lbnQgdGhhdCB3b3VsZCBiZSBpbnRyb2R1Y2VkLiBzaGlmdCBpcyBjYWxjdWxhdGVkXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzIHRoZSBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIGdseXBoJ3MgbGVmdCBhbmQgcmlnaHQgb2Zmc2V0LlxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaGlmdCA9IHF1YWRzaXplIC0geCAtIHRoaXMuX3NwYWNpbmcgKiBhZHZhbmNlIC0geDtcbiAgICAgICAgICAgICAgICAgICAgbGVmdCAtPSBzaGlmdDtcbiAgICAgICAgICAgICAgICAgICAgcmlnaHQgLT0gc2hpZnQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDBdID0gbGVmdDtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgMV0gPSBib3R0b207XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDJdID0gX3o7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgM10gPSByaWdodDtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgNF0gPSBib3R0b207XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDVdID0gX3o7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgNl0gPSByaWdodDtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgN10gPSB0b3A7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDhdID0gX3o7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgOV0gID0gbGVmdDtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgMTBdID0gdG9wO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyAxMV0gPSBfejtcblxuICAgICAgICAgICAgICAgIHRoaXMud2lkdGggPSBNYXRoLm1heCh0aGlzLndpZHRoLCBjYW5kaWRhdGVMaW5lV2lkdGgpO1xuXG4gICAgICAgICAgICAgICAgLy8gc2NhbGUgZm9udCBzaXplIGlmIGF1dG9GaXRXaWR0aCBpcyB0cnVlIGFuZCB0aGUgd2lkdGggaXMgbGFyZ2VyIHRoYW4gdGhlIGNhbGN1bGF0ZWQgd2lkdGhcbiAgICAgICAgICAgICAgICBsZXQgZm9udFNpemU7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3Nob3VsZEF1dG9GaXRXaWR0aCgpICYmIHRoaXMud2lkdGggPiB0aGlzLl9lbGVtZW50LmNhbGN1bGF0ZWRXaWR0aCkge1xuICAgICAgICAgICAgICAgICAgICBmb250U2l6ZSA9IE1hdGguZmxvb3IodGhpcy5fZWxlbWVudC5mb250U2l6ZSAqIHRoaXMuX2VsZW1lbnQuY2FsY3VsYXRlZFdpZHRoIC8gKHRoaXMud2lkdGggfHwgMC4wMDAxKSk7XG4gICAgICAgICAgICAgICAgICAgIGZvbnRTaXplID0gbWF0aC5jbGFtcChmb250U2l6ZSwgbWluRm9udCwgbWF4Rm9udCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmb250U2l6ZSAhPT0gdGhpcy5fZWxlbWVudC5mb250U2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZm9udFNpemUgPSBmb250U2l6ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHJ5VXBkYXRlTWVzaGVzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5oZWlnaHQgPSBNYXRoLm1heCh0aGlzLmhlaWdodCwgZm9udE1heFkgLSAoX3kgKyBmb250TWluWSkpO1xuXG4gICAgICAgICAgICAgICAgLy8gc2NhbGUgZm9udCBzaXplIGlmIGF1dG9GaXRIZWlnaHQgaXMgdHJ1ZSBhbmQgdGhlIGhlaWdodCBpcyBsYXJnZXIgdGhhbiB0aGUgY2FsY3VsYXRlZCBoZWlnaHRcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fc2hvdWxkQXV0b0ZpdEhlaWdodCgpICYmIHRoaXMuaGVpZ2h0ID4gdGhpcy5fZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHRyeSAxIHBpeGVsIHNtYWxsZXIgZm9yIGZvbnRTaXplIGFuZCBpdGVyYXRlXG4gICAgICAgICAgICAgICAgICAgIGZvbnRTaXplID0gbWF0aC5jbGFtcCh0aGlzLl9mb250U2l6ZSAtIDEsIG1pbkZvbnQsIG1heEZvbnQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoZm9udFNpemUgIT09IHRoaXMuX2VsZW1lbnQuZm9udFNpemUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2ZvbnRTaXplID0gZm9udFNpemU7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXRyeVVwZGF0ZU1lc2hlcyA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGFkdmFuY2UgY3Vyc29yIChmb3IgUlRMIHdlIG1vdmUgbGVmdClcbiAgICAgICAgICAgICAgICBfeCArPSB0aGlzLl9zcGFjaW5nICogYWR2YW5jZTtcblxuICAgICAgICAgICAgICAgIC8vIEZvciBwcm9wZXIgYWxpZ25tZW50IGhhbmRsaW5nIHdoZW4gYSBsaW5lIHdyYXBzIF9vbl8gYSB3aGl0ZXNwYWNlIGNoYXJhY3RlcixcbiAgICAgICAgICAgICAgICAvLyB3ZSBuZWVkIHRvIGtlZXAgdHJhY2sgb2YgdGhlIHdpZHRoIG9mIHRoZSBsaW5lIHdpdGhvdXQgYW55IHRyYWlsaW5nIHdoaXRlc3BhY2VcbiAgICAgICAgICAgICAgICAvLyBjaGFyYWN0ZXJzLiBUaGlzIGFwcGxpZXMgdG8gYm90aCBzaW5nbGUgd2hpdGVzcGFjZXMgYW5kIGFsc28gbXVsdGlwbGUgc2VxdWVudGlhbFxuICAgICAgICAgICAgICAgIC8vIHdoaXRlc3BhY2VzLlxuICAgICAgICAgICAgICAgIGlmICghaXNXaGl0ZXNwYWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIF94TWludXNUcmFpbGluZ1doaXRlc3BhY2UgPSBfeDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNXb3JkQm91bmRhcnkoY2hhcikgfHwgKHRoaXMuX2lzVmFsaWROZXh0Q2hhcihuZXh0Y2hhcikgJiYgKHRoaXMuX2lzTmV4dENKS0JvdW5kYXJ5KGNoYXIsIG5leHRjaGFyKSB8fCB0aGlzLl9pc05leHRDSktXaG9sZVdvcmQobmV4dGNoYXIpKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtV29yZHNUaGlzTGluZSsrO1xuICAgICAgICAgICAgICAgICAgICB3b3JkU3RhcnRYID0gX3hNaW51c1RyYWlsaW5nV2hpdGVzcGFjZTtcbiAgICAgICAgICAgICAgICAgICAgd29yZFN0YXJ0SW5kZXggPSBpICsgMTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBudW1DaGFyc1RoaXNMaW5lKys7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB1diA9IHRoaXMuX2dldFV2KGNoYXIpO1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8udXZzW3F1YWQgKiA0ICogMiArIDBdID0gdXZbMF07XG4gICAgICAgICAgICAgICAgbWVzaEluZm8udXZzW3F1YWQgKiA0ICogMiArIDFdID0gMS4wIC0gdXZbMV07XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby51dnNbcXVhZCAqIDQgKiAyICsgMl0gPSB1dlsyXTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby51dnNbcXVhZCAqIDQgKiAyICsgM10gPSAxLjAgLSB1dlsxXTtcblxuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnV2c1txdWFkICogNCAqIDIgKyA0XSA9IHV2WzJdO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnV2c1txdWFkICogNCAqIDIgKyA1XSA9IDEuMCAtIHV2WzNdO1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8udXZzW3F1YWQgKiA0ICogMiArIDZdID0gdXZbMF07XG4gICAgICAgICAgICAgICAgbWVzaEluZm8udXZzW3F1YWQgKiA0ICogMiArIDddID0gMS4wIC0gdXZbM107XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgcGVyLXZlcnRleCBjb2xvclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zeW1ib2xDb2xvcnMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sb3JJZHggPSB0aGlzLl9zeW1ib2xDb2xvcnNbaV0gKiAzO1xuICAgICAgICAgICAgICAgICAgICBjb2xvcl9yID0gdGhpcy5fY29sb3JQYWxldHRlW2NvbG9ySWR4XTtcbiAgICAgICAgICAgICAgICAgICAgY29sb3JfZyA9IHRoaXMuX2NvbG9yUGFsZXR0ZVtjb2xvcklkeCArIDFdO1xuICAgICAgICAgICAgICAgICAgICBjb2xvcl9iID0gdGhpcy5fY29sb3JQYWxldHRlW2NvbG9ySWR4ICsgMl07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzW3F1YWQgKiA0ICogNCArIDBdID0gY29sb3JfcjtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgMV0gPSBjb2xvcl9nO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyAyXSA9IGNvbG9yX2I7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzW3F1YWQgKiA0ICogNCArIDNdID0gMjU1O1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzW3F1YWQgKiA0ICogNCArIDRdID0gY29sb3JfcjtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgNV0gPSBjb2xvcl9nO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyA2XSA9IGNvbG9yX2I7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzW3F1YWQgKiA0ICogNCArIDddID0gMjU1O1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8uY29sb3JzW3F1YWQgKiA0ICogNCArIDhdID0gY29sb3JfcjtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgOV0gPSBjb2xvcl9nO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyAxMF0gPSBjb2xvcl9iO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLmNvbG9yc1txdWFkICogNCAqIDQgKyAxMV0gPSAyNTU7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgMTJdID0gY29sb3JfcjtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgMTNdID0gY29sb3JfZztcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgMTRdID0gY29sb3JfYjtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5jb2xvcnNbcXVhZCAqIDQgKiA0ICsgMTVdID0gMjU1O1xuXG4gICAgICAgICAgICAgICAgLy8gc2V0IHBlci12ZXJ0ZXggb3V0bGluZSBwYXJhbWV0ZXJzXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX3N5bWJvbE91dGxpbmVQYXJhbXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb3V0bGluZUlkeCA9IHRoaXMuX3N5bWJvbE91dGxpbmVQYXJhbXNbaV0gKiA1O1xuICAgICAgICAgICAgICAgICAgICBvdXRsaW5lX2NvbG9yX3JnID0gdGhpcy5fb3V0bGluZVBhbGV0dGVbb3V0bGluZUlkeF0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fb3V0bGluZVBhbGV0dGVbb3V0bGluZUlkeCArIDFdICogMjU2O1xuICAgICAgICAgICAgICAgICAgICBvdXRsaW5lX2NvbG9yX2JhID0gdGhpcy5fb3V0bGluZVBhbGV0dGVbb3V0bGluZUlkeCArIDJdICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX291dGxpbmVQYWxldHRlW291dGxpbmVJZHggKyAzXSAqIDI1NjtcbiAgICAgICAgICAgICAgICAgICAgb3V0bGluZV90aGlja25lc3MgPSB0aGlzLl9vdXRsaW5lUGFsZXR0ZVtvdXRsaW5lSWR4ICsgNF07XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8ub3V0bGluZXNbcXVhZCAqIDQgKiAzICsgMF0gPSBvdXRsaW5lX2NvbG9yX3JnO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLm91dGxpbmVzW3F1YWQgKiA0ICogMyArIDFdID0gb3V0bGluZV9jb2xvcl9iYTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5vdXRsaW5lc1txdWFkICogNCAqIDMgKyAyXSA9IG91dGxpbmVfdGhpY2tuZXNzO1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8ub3V0bGluZXNbcXVhZCAqIDQgKiAzICsgM10gPSBvdXRsaW5lX2NvbG9yX3JnO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLm91dGxpbmVzW3F1YWQgKiA0ICogMyArIDRdID0gb3V0bGluZV9jb2xvcl9iYTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5vdXRsaW5lc1txdWFkICogNCAqIDMgKyA1XSA9IG91dGxpbmVfdGhpY2tuZXNzO1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8ub3V0bGluZXNbcXVhZCAqIDQgKiAzICsgNl0gPSBvdXRsaW5lX2NvbG9yX3JnO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLm91dGxpbmVzW3F1YWQgKiA0ICogMyArIDddID0gb3V0bGluZV9jb2xvcl9iYTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5vdXRsaW5lc1txdWFkICogNCAqIDMgKyA4XSA9IG91dGxpbmVfdGhpY2tuZXNzO1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8ub3V0bGluZXNbcXVhZCAqIDQgKiAzICsgOV0gPSBvdXRsaW5lX2NvbG9yX3JnO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLm91dGxpbmVzW3F1YWQgKiA0ICogMyArIDEwXSA9IG91dGxpbmVfY29sb3JfYmE7XG4gICAgICAgICAgICAgICAgbWVzaEluZm8ub3V0bGluZXNbcXVhZCAqIDQgKiAzICsgMTFdID0gb3V0bGluZV90aGlja25lc3M7XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgcGVyLXZlcnRleCBzaGFkb3cgcGFyYW1ldGVyc1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9zeW1ib2xTaGFkb3dQYXJhbXMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2hhZG93SWR4ID0gdGhpcy5fc3ltYm9sU2hhZG93UGFyYW1zW2ldICogNjtcbiAgICAgICAgICAgICAgICAgICAgc2hhZG93X2NvbG9yX3JnID0gdGhpcy5fc2hhZG93UGFsZXR0ZVtzaGFkb3dJZHhdICtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd1BhbGV0dGVbc2hhZG93SWR4ICsgMV0gKiAyNTY7XG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd19jb2xvcl9iYSA9IHRoaXMuX3NoYWRvd1BhbGV0dGVbc2hhZG93SWR4ICsgMl0gK1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93UGFsZXR0ZVtzaGFkb3dJZHggKyAzXSAqIDI1NjtcbiAgICAgICAgICAgICAgICAgICAgc2hhZG93X29mZnNldF94eSA9ICh0aGlzLl9zaGFkb3dQYWxldHRlW3NoYWRvd0lkeCArIDRdICsgMTI3KSArXG4gICAgICAgICAgICAgICAgICAgICAgICBNYXRoLnJvdW5kKHJhdGlvICogdGhpcy5fc2hhZG93UGFsZXR0ZVtzaGFkb3dJZHggKyA1XSArIDEyNykgKiAyNTY7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8uc2hhZG93c1txdWFkICogNCAqIDMgKyAwXSA9IHNoYWRvd19jb2xvcl9yZztcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzW3F1YWQgKiA0ICogMyArIDFdID0gc2hhZG93X2NvbG9yX2JhO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnNoYWRvd3NbcXVhZCAqIDQgKiAzICsgMl0gPSBzaGFkb3dfb2Zmc2V0X3h5O1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8uc2hhZG93c1txdWFkICogNCAqIDMgKyAzXSA9IHNoYWRvd19jb2xvcl9yZztcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzW3F1YWQgKiA0ICogMyArIDRdID0gc2hhZG93X2NvbG9yX2JhO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnNoYWRvd3NbcXVhZCAqIDQgKiAzICsgNV0gPSBzaGFkb3dfb2Zmc2V0X3h5O1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8uc2hhZG93c1txdWFkICogNCAqIDMgKyA2XSA9IHNoYWRvd19jb2xvcl9yZztcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzW3F1YWQgKiA0ICogMyArIDddID0gc2hhZG93X2NvbG9yX2JhO1xuICAgICAgICAgICAgICAgIG1lc2hJbmZvLnNoYWRvd3NbcXVhZCAqIDQgKiAzICsgOF0gPSBzaGFkb3dfb2Zmc2V0X3h5O1xuXG4gICAgICAgICAgICAgICAgbWVzaEluZm8uc2hhZG93c1txdWFkICogNCAqIDMgKyA5XSA9IHNoYWRvd19jb2xvcl9yZztcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzW3F1YWQgKiA0ICogMyArIDEwXSA9IHNoYWRvd19jb2xvcl9iYTtcbiAgICAgICAgICAgICAgICBtZXNoSW5mby5zaGFkb3dzW3F1YWQgKiA0ICogMyArIDExXSA9IHNoYWRvd19vZmZzZXRfeHk7XG5cbiAgICAgICAgICAgICAgICBtZXNoSW5mby5xdWFkKys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyZXRyeVVwZGF0ZU1lc2hlcykge1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBcyB3ZSBvbmx5IGJyZWFrIGxpbmVzIHdoZW4gdGhlIHRleHQgYmVjb21lcyB0b28gd2lkZSBmb3IgdGhlIGNvbnRhaW5lcixcbiAgICAgICAgICAgIC8vIHRoZXJlIHdpbGwgYWxtb3N0IGFsd2F5cyBiZSBzb21lIGxlZnRvdmVyIHRleHQgb24gdGhlIGZpbmFsIGxpbmUgd2hpY2ggaGFzXG4gICAgICAgICAgICAvLyBub3QgeWV0IGJlZW4gcHVzaGVkIHRvIF9saW5lQ29udGVudHMuXG4gICAgICAgICAgICBpZiAobGluZVN0YXJ0SW5kZXggPCBsKSB7XG4gICAgICAgICAgICAgICAgYnJlYWtMaW5lKHRoaXMuX3N5bWJvbHMsIGwsIF94KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZvcmNlIGF1dG9XaWR0aCAvIGF1dG9IZWlnaHQgY2hhbmdlIHRvIHVwZGF0ZSB3aWR0aC9oZWlnaHQgb2YgZWxlbWVudFxuICAgICAgICB0aGlzLl9ub1Jlc2l6ZSA9IHRydWU7XG4gICAgICAgIHRoaXMuYXV0b1dpZHRoID0gdGhpcy5fYXV0b1dpZHRoO1xuICAgICAgICB0aGlzLmF1dG9IZWlnaHQgPSB0aGlzLl9hdXRvSGVpZ2h0O1xuICAgICAgICB0aGlzLl9ub1Jlc2l6ZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIG9mZnNldCBmb3IgcGl2b3QgYW5kIGFsaWdubWVudFxuICAgICAgICBjb25zdCBocCA9IHRoaXMuX2VsZW1lbnQucGl2b3QueDtcbiAgICAgICAgY29uc3QgdnAgPSB0aGlzLl9lbGVtZW50LnBpdm90Lnk7XG4gICAgICAgIGNvbnN0IGhhID0gdGhpcy5fYWxpZ25tZW50Lng7XG4gICAgICAgIGNvbnN0IHZhID0gdGhpcy5fYWxpZ25tZW50Lnk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5mby5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbmZvW2ldLmNvdW50ID09PSAwKSBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHByZXZRdWFkID0gMDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBpbiB0aGlzLl9tZXNoSW5mb1tpXS5saW5lcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fbWVzaEluZm9baV0ubGluZXNbbGluZV07XG4gICAgICAgICAgICAgICAgY29uc3QgbHcgPSB0aGlzLl9saW5lV2lkdGhzW3BhcnNlSW50KGxpbmUsIDEwKV07XG4gICAgICAgICAgICAgICAgY29uc3QgaG9mZnNldCA9IC1ocCAqIHRoaXMuX2VsZW1lbnQuY2FsY3VsYXRlZFdpZHRoICsgaGEgKiAodGhpcy5fZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggLSBsdykgKiAodGhpcy5fcnRsID8gLTEgOiAxKTtcbiAgICAgICAgICAgICAgICBjb25zdCB2b2Zmc2V0ID0gKDEgLSB2cCkgKiB0aGlzLl9lbGVtZW50LmNhbGN1bGF0ZWRIZWlnaHQgLSBmb250TWF4WSAtICgxIC0gdmEpICogKHRoaXMuX2VsZW1lbnQuY2FsY3VsYXRlZEhlaWdodCAtIHRoaXMuaGVpZ2h0KTtcblxuICAgICAgICAgICAgICAgIGZvciAobGV0IHF1YWQgPSBwcmV2UXVhZDsgcXVhZCA8PSBpbmRleDsgcXVhZCsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1txdWFkICogNCAqIDNdICs9IGhvZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyAzXSArPSBob2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgNl0gKz0gaG9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDldICs9IGhvZmZzZXQ7XG5cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDFdICs9IHZvZmZzZXQ7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1txdWFkICogNCAqIDMgKyA0XSArPSB2b2Zmc2V0O1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbcXVhZCAqIDQgKiAzICsgN10gKz0gdm9mZnNldDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW3F1YWQgKiA0ICogMyArIDEwXSArPSB2b2Zmc2V0O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIGZsaXAgcnRsIGNoYXJhY3RlcnNcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fcnRsKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHF1YWQgPSBwcmV2UXVhZDsgcXVhZCA8PSBpbmRleDsgcXVhZCsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpZHggPSBxdWFkICogNCAqIDM7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZsaXAgdGhlIGVudGlyZSBsaW5lIGhvcml6b250YWxseVxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgdmVydCA9IDA7IHZlcnQgPCA0OyArK3ZlcnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbaWR4ICsgdmVydCAqIDNdID1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5jYWxjdWxhdGVkV2lkdGggLSB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbaWR4ICsgdmVydCAqIDNdICsgaG9mZnNldCAqIDI7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGZsaXAgdGhlIGNoYXJhY3RlciBob3Jpem9udGFsbHlcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRtcDAgPSB0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbaWR4ICsgM107XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0bXAxID0gdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW2lkeCArIDZdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW2lkeCArIDNdID0gdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW2lkeCArIDBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW2lkeCArIDZdID0gdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW2lkeCArIDldO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW2lkeCArIDBdID0gdG1wMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1tpZHggKyA5XSA9IHRtcDE7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBwcmV2UXVhZCA9IGluZGV4ICsgMTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gdXBkYXRlIHZlcnRleCBidWZmZXJcbiAgICAgICAgICAgIGNvbnN0IG51bVZlcnRpY2VzID0gdGhpcy5fbWVzaEluZm9baV0uY291bnQgKiA0OyAvLyBudW1iZXIgb2YgdmVydHMgd2UgYWxsb2NhdGVkXG4gICAgICAgICAgICBjb25zdCB2ZXJ0TWF4ID0gdGhpcy5fbWVzaEluZm9baV0ucXVhZCAqIDQ7ICAvLyBudW1iZXIgb2YgdmVydHMgd2UgbmVlZCAodXN1YWxseSBjb3VudCBtaW51cyBsaW5lIGJyZWFrIGNoYXJhY3RlcnMpXG4gICAgICAgICAgICBjb25zdCBpdCA9IG5ldyBWZXJ0ZXhJdGVyYXRvcih0aGlzLl9tZXNoSW5mb1tpXS5tZXNoSW5zdGFuY2UubWVzaC52ZXJ0ZXhCdWZmZXIpO1xuICAgICAgICAgICAgZm9yIChsZXQgdiA9IDA7IHYgPCBudW1WZXJ0aWNlczsgdisrKSB7XG4gICAgICAgICAgICAgICAgaWYgKHYgPj0gdmVydE1heCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBjbGVhciB1bnVzZWQgdmVydGljZXNcbiAgICAgICAgICAgICAgICAgICAgaXQuZWxlbWVudFtTRU1BTlRJQ19QT1NJVElPTl0uc2V0KDAsIDAsIDApO1xuICAgICAgICAgICAgICAgICAgICBpdC5lbGVtZW50W1NFTUFOVElDX1RFWENPT1JEMF0uc2V0KDAsIDApO1xuICAgICAgICAgICAgICAgICAgICBpdC5lbGVtZW50W1NFTUFOVElDX0NPTE9SXS5zZXQoMCwgMCwgMCwgMCk7XG4gICAgICAgICAgICAgICAgICAgIC8vIG91dGxpbmVcbiAgICAgICAgICAgICAgICAgICAgaXQuZWxlbWVudFtTRU1BTlRJQ19BVFRSOF0uc2V0KDAsIDAsIDAsIDApO1xuICAgICAgICAgICAgICAgICAgICAvLyBzaGFkb3dcbiAgICAgICAgICAgICAgICAgICAgaXQuZWxlbWVudFtTRU1BTlRJQ19BVFRSOV0uc2V0KDAsIDAsIDAsIDApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGl0LmVsZW1lbnRbU0VNQU5USUNfUE9TSVRJT05dLnNldCh0aGlzLl9tZXNoSW5mb1tpXS5wb3NpdGlvbnNbdiAqIDMgKyAwXSwgdGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zW3YgKiAzICsgMV0sIHRoaXMuX21lc2hJbmZvW2ldLnBvc2l0aW9uc1t2ICogMyArIDJdKTtcbiAgICAgICAgICAgICAgICAgICAgaXQuZWxlbWVudFtTRU1BTlRJQ19URVhDT09SRDBdLnNldCh0aGlzLl9tZXNoSW5mb1tpXS51dnNbdiAqIDIgKyAwXSwgdGhpcy5fbWVzaEluZm9baV0udXZzW3YgKiAyICsgMV0pO1xuICAgICAgICAgICAgICAgICAgICBpdC5lbGVtZW50W1NFTUFOVElDX0NPTE9SXS5zZXQodGhpcy5fbWVzaEluZm9baV0uY29sb3JzW3YgKiA0ICsgMF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5jb2xvcnNbdiAqIDQgKyAxXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLmNvbG9yc1t2ICogNCArIDJdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluZm9baV0uY29sb3JzW3YgKiA0ICsgM10pO1xuICAgICAgICAgICAgICAgICAgICBpdC5lbGVtZW50W1NFTUFOVElDX0FUVFI4XS5zZXQodGhpcy5fbWVzaEluZm9baV0ub3V0bGluZXNbdiAqIDMgKyAwXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLm91dGxpbmVzW3YgKiAzICsgMV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5vdXRsaW5lc1t2ICogMyArIDJdKTtcbiAgICAgICAgICAgICAgICAgICAgaXQuZWxlbWVudFtTRU1BTlRJQ19BVFRSOV0uc2V0KHRoaXMuX21lc2hJbmZvW2ldLnNoYWRvd3NbdiAqIDMgKyAwXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLnNoYWRvd3NbdiAqIDMgKyAxXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldLnNoYWRvd3NbdiAqIDMgKyAyXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGl0Lm5leHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGl0LmVuZCgpO1xuXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5tZXNoSW5zdGFuY2UubWVzaC5hYWJiLmNvbXB1dGUodGhpcy5fbWVzaEluZm9baV0ucG9zaXRpb25zKTtcblxuICAgICAgICAgICAgLy8gZm9yY2UgdXBkYXRlIG1lc2hJbnN0YW5jZSBhYWJiXG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5mb1tpXS5tZXNoSW5zdGFuY2UuX2FhYmJWZXIgPSAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGZsYWcgdGV4dCBlbGVtZW50IGFhYmIgdG8gYmUgdXBkYXRlZFxuICAgICAgICB0aGlzLl9hYWJiRGlydHkgPSB0cnVlO1xuICAgIH1cblxuICAgIF9vbkZvbnRSZW5kZXIoKSB7XG4gICAgICAgIC8vIGlmIHRoZSBmb250IGhhcyBiZWVuIGNoYW5nZWQgKGUuZy4gY2FudmFzZm9udCByZS1yZW5kZXIpXG4gICAgICAgIC8vIHJlLWFwcGx5aW5nIHRoZSBzYW1lIGZvbnQgdXBkYXRlcyBjaGFyYWN0ZXIgbWFwIGFuZCBlbnN1cmVzXG4gICAgICAgIC8vIGV2ZXJ5dGhpbmcgaXMgdXAgdG8gZGF0ZS5cbiAgICAgICAgdGhpcy5mb250ID0gdGhpcy5fZm9udDtcbiAgICB9XG5cbiAgICBfb25Gb250TG9hZChhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5mb250ICE9PSBhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5mb250ID0gYXNzZXQucmVzb3VyY2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25Gb250Q2hhbmdlKGFzc2V0LCBuYW1lLCBfbmV3LCBfb2xkKSB7XG4gICAgICAgIGlmIChuYW1lID09PSAnZGF0YScpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZvbnQuZGF0YSA9IF9uZXc7XG5cbiAgICAgICAgICAgIGNvbnN0IG1hcHMgPSB0aGlzLl9mb250LmRhdGEuaW5mby5tYXBzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWFwczsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5mb1tpXSkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbmZvW2ldLm1lc2hJbnN0YW5jZTtcbiAgICAgICAgICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdmb250X3NkZkludGVuc2l0eScsIHRoaXMuX2ZvbnQuaW50ZW5zaXR5KTtcbiAgICAgICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdmb250X3B4cmFuZ2UnLCB0aGlzLl9nZXRQeFJhbmdlKHRoaXMuX2ZvbnQpKTtcbiAgICAgICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdmb250X3RleHR1cmVXaWR0aCcsIHRoaXMuX2ZvbnQuZGF0YS5pbmZvLm1hcHNbaV0ud2lkdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkZvbnRSZW1vdmUoYXNzZXQpIHtcblxuICAgIH1cblxuICAgIF9zZXRUZXh0dXJlUGFyYW1zKG1pLCB0ZXh0dXJlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mb250KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fZm9udC50eXBlID09PSBGT05UX01TREYpIHtcbiAgICAgICAgICAgICAgICBtaS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfZW1pc3NpdmVNYXAnKTtcbiAgICAgICAgICAgICAgICBtaS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfb3BhY2l0eU1hcCcpO1xuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcigndGV4dHVyZV9tc2RmTWFwJywgdGV4dHVyZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2ZvbnQudHlwZSA9PT0gRk9OVF9CSVRNQVApIHtcbiAgICAgICAgICAgICAgICBtaS5kZWxldGVQYXJhbWV0ZXIoJ3RleHR1cmVfbXNkZk1hcCcpO1xuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcigndGV4dHVyZV9lbWlzc2l2ZU1hcCcsIHRleHR1cmUpO1xuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcigndGV4dHVyZV9vcGFjaXR5TWFwJywgdGV4dHVyZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZ2V0UHhSYW5nZShmb250KSB7XG4gICAgICAgIC8vIGNhbGN1bGF0ZSBweHJhbmdlIGZyb20gcmFuZ2UgYW5kIHNjYWxlIHByb3BlcnRpZXMgb24gYSBjaGFyYWN0ZXJcbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuX2ZvbnQuZGF0YS5jaGFycyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY2hhciA9IHRoaXMuX2ZvbnQuZGF0YS5jaGFyc1trZXlzW2ldXTtcbiAgICAgICAgICAgIGlmIChjaGFyLnJhbmdlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIChjaGFyLnNjYWxlIHx8IDEpICogY2hhci5yYW5nZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMjsgLy8gZGVmYXVsdFxuICAgIH1cblxuICAgIF9nZXRVdihjaGFyKSB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSB0aGlzLl9mb250LmRhdGE7XG5cbiAgICAgICAgaWYgKCFkYXRhLmNoYXJzW2NoYXJdKSB7XG4gICAgICAgICAgICAvLyBtaXNzaW5nIGNoYXIgLSByZXR1cm4gXCJzcGFjZVwiIGlmIHdlIGhhdmUgaXRcbiAgICAgICAgICAgIGNvbnN0IHNwYWNlID0gJyAnO1xuICAgICAgICAgICAgaWYgKGRhdGEuY2hhcnNbc3BhY2VdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldFV2KHNwYWNlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlIC0gbWlzc2luZyBjaGFyXG4gICAgICAgICAgICByZXR1cm4gWzAsIDAsIDAsIDBdO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbWFwID0gZGF0YS5jaGFyc1tjaGFyXS5tYXA7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gZGF0YS5pbmZvLm1hcHNbbWFwXS53aWR0aDtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gZGF0YS5pbmZvLm1hcHNbbWFwXS5oZWlnaHQ7XG5cbiAgICAgICAgY29uc3QgeCA9IGRhdGEuY2hhcnNbY2hhcl0ueDtcbiAgICAgICAgY29uc3QgeSA9ICBkYXRhLmNoYXJzW2NoYXJdLnk7XG5cbiAgICAgICAgY29uc3QgeDEgPSB4O1xuICAgICAgICBjb25zdCB5MSA9IHk7XG4gICAgICAgIGNvbnN0IHgyID0gKHggKyBkYXRhLmNoYXJzW2NoYXJdLndpZHRoKTtcbiAgICAgICAgY29uc3QgeTIgPSAoeSAtIGRhdGEuY2hhcnNbY2hhcl0uaGVpZ2h0KTtcbiAgICAgICAgY29uc3QgZWRnZSA9IDEgLSAoZGF0YS5jaGFyc1tjaGFyXS5oZWlnaHQgLyBoZWlnaHQpO1xuICAgICAgICByZXR1cm4gW1xuICAgICAgICAgICAgeDEgLyB3aWR0aCxcbiAgICAgICAgICAgIGVkZ2UgLSAoeTEgLyBoZWlnaHQpLCAvLyBib3R0b20gbGVmdFxuXG4gICAgICAgICAgICAoeDIgLyB3aWR0aCksXG4gICAgICAgICAgICBlZGdlIC0gKHkyIC8gaGVpZ2h0KSAgLy8gdG9wIHJpZ2h0XG4gICAgICAgIF07XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIHRoaXMuX2ZvbnRBc3NldC5hdXRvTG9hZCA9IHRydWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmFkZE1vZGVsVG9MYXllcnModGhpcy5fbW9kZWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLl9mb250QXNzZXQuYXV0b0xvYWQgPSBmYWxzZTtcblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKHRoaXMuX21vZGVsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zZXRTdGVuY2lsKHN0ZW5jaWxQYXJhbXMpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZXMgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uc3RlbmNpbEZyb250ID0gc3RlbmNpbFBhcmFtcztcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0uc3RlbmNpbEJhY2sgPSBzdGVuY2lsUGFyYW1zO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3Nob3VsZEF1dG9GaXRXaWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F1dG9GaXRXaWR0aCAmJiAhdGhpcy5fYXV0b1dpZHRoO1xuICAgIH1cblxuICAgIF9zaG91bGRBdXRvRml0SGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b0ZpdEhlaWdodCAmJiAhdGhpcy5fYXV0b0hlaWdodDtcbiAgICB9XG5cbiAgICBfc2hvdWxkQXV0b0ZpdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F1dG9GaXRXaWR0aCAmJiAhdGhpcy5fYXV0b1dpZHRoIHx8XG4gICAgICAgICAgICAgICB0aGlzLl9hdXRvRml0SGVpZ2h0ICYmICF0aGlzLl9hdXRvSGVpZ2h0O1xuICAgIH1cblxuICAgIC8vIGNhbGN1bGF0ZSB0aGUgbnVtYmVyIG9mIGNoYXJhY3RlcnMgcGVyIHRleHR1cmUgdXAgdG8sIGJ1dCBub3QgaW5jbHVkaW5nXG4gICAgLy8gdGhlIHNwZWNpZmllZCBzeW1ib2xJbmRleFxuICAgIF9jYWxjdWxhdGVDaGFyc1BlclRleHR1cmUoc3ltYm9sSW5kZXgpIHtcbiAgICAgICAgY29uc3QgY2hhcmFjdGVyc1BlclRleHR1cmUgPSB7fTtcblxuICAgICAgICBpZiAoc3ltYm9sSW5kZXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgc3ltYm9sSW5kZXggPSB0aGlzLl9zeW1ib2xzLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzeW1ib2xJbmRleDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjaGFyID0gdGhpcy5fc3ltYm9sc1tpXTtcbiAgICAgICAgICAgIGxldCBpbmZvID0gdGhpcy5fZm9udC5kYXRhLmNoYXJzW2NoYXJdO1xuICAgICAgICAgICAgaWYgKCFpbmZvKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgY2hhciBpcyBtaXNzaW5nIHVzZSAnc3BhY2UnIG9yIGZpcnN0IGNoYXIgaW4gbWFwXG4gICAgICAgICAgICAgICAgaW5mbyA9IHRoaXMuX2ZvbnQuZGF0YS5jaGFyc1snICddO1xuICAgICAgICAgICAgICAgIGlmICghaW5mbykge1xuICAgICAgICAgICAgICAgICAgICAvLyBvdGhlcndpc2UgaWYgc3BhY2UgaXMgYWxzbyBub3QgcHJlc2VudCB1c2UgdGhlIGZpcnN0IGNoYXJhY3RlciBpbiB0aGVcbiAgICAgICAgICAgICAgICAgICAgLy8gc2V0XG4gICAgICAgICAgICAgICAgICAgIGluZm8gPSB0aGlzLl9mb250LmRhdGEuY2hhcnNbT2JqZWN0LmtleXModGhpcy5fZm9udC5kYXRhLmNoYXJzKVswXV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtYXAgPSBpbmZvLm1hcDtcbiAgICAgICAgICAgIGlmICghY2hhcmFjdGVyc1BlclRleHR1cmVbbWFwXSkge1xuICAgICAgICAgICAgICAgIGNoYXJhY3RlcnNQZXJUZXh0dXJlW21hcF0gPSAxO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjaGFyYWN0ZXJzUGVyVGV4dHVyZVttYXBdKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYXJhY3RlcnNQZXJUZXh0dXJlO1xuICAgIH1cblxuICAgIF91cGRhdGVSZW5kZXJSYW5nZSgpIHtcbiAgICAgICAgY29uc3Qgc3RhcnRDaGFycyA9IHRoaXMuX3JhbmdlU3RhcnQgPT09IDAgPyAwIDogdGhpcy5fY2FsY3VsYXRlQ2hhcnNQZXJUZXh0dXJlKHRoaXMuX3JhbmdlU3RhcnQpO1xuICAgICAgICBjb25zdCBlbmRDaGFycyA9IHRoaXMuX3JhbmdlRW5kID09PSAwID8gMCA6IHRoaXMuX2NhbGN1bGF0ZUNoYXJzUGVyVGV4dHVyZSh0aGlzLl9yYW5nZUVuZCk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21lc2hJbmZvLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzdGFydCA9IHN0YXJ0Q2hhcnNbaV0gfHwgMDtcbiAgICAgICAgICAgIGNvbnN0IGVuZCA9IGVuZENoYXJzW2ldIHx8IDA7XG4gICAgICAgICAgICBjb25zdCBpbnN0YW5jZSA9IHRoaXMuX21lc2hJbmZvW2ldLm1lc2hJbnN0YW5jZTtcbiAgICAgICAgICAgIGlmIChpbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBpbnN0YW5jZS5tZXNoO1xuICAgICAgICAgICAgICAgIGlmIChtZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2gucHJpbWl0aXZlWzBdLmJhc2UgPSBzdGFydCAqIDMgKiAyO1xuICAgICAgICAgICAgICAgICAgICBtZXNoLnByaW1pdGl2ZVswXS5jb3VudCA9IChlbmQgLSBzdGFydCkgKiAzICogMjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXQgdGV4dCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9pMThuS2V5ID0gbnVsbDtcbiAgICAgICAgY29uc3Qgc3RyID0gdmFsdWUgIT0gbnVsbCAmJiB2YWx1ZS50b1N0cmluZygpIHx8ICcnO1xuICAgICAgICB0aGlzLl9zZXRUZXh0KHN0cik7XG4gICAgfVxuXG4gICAgZ2V0IHRleHQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90ZXh0O1xuICAgIH1cblxuICAgIHNldCBrZXkodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgc3RyID0gdmFsdWUgIT09IG51bGwgPyB2YWx1ZS50b1N0cmluZygpIDogbnVsbDtcbiAgICAgICAgaWYgKHRoaXMuX2kxOG5LZXkgPT09IHN0cikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5faTE4bktleSA9IHN0cjtcbiAgICAgICAgaWYgKHN0cikge1xuICAgICAgICAgICAgdGhpcy5fZm9udEFzc2V0LmRpc2FibGVMb2NhbGl6YXRpb24gPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0TG9jYWxpemVkVGV4dCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fZm9udEFzc2V0LmRpc2FibGVMb2NhbGl6YXRpb24gPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGtleSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2kxOG5LZXk7XG4gICAgfVxuXG4gICAgc2V0IGNvbG9yKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHIgPSB2YWx1ZS5yO1xuICAgICAgICBjb25zdCBnID0gdmFsdWUuZztcbiAgICAgICAgY29uc3QgYiA9IHZhbHVlLmI7XG5cbiAgICAgICAgLy8gI2lmIF9ERUJVR1xuICAgICAgICBpZiAodGhpcy5fY29sb3IgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1NldHRpbmcgZWxlbWVudC5jb2xvciB0byBpdHNlbGYgd2lsbCBoYXZlIG5vIGVmZmVjdCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmICh0aGlzLl9jb2xvci5yID09PSByICYmXG4gICAgICAgICAgICB0aGlzLl9jb2xvci5nID09PSBnICYmXG4gICAgICAgICAgICB0aGlzLl9jb2xvci5iID09PSBiKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9jb2xvci5yID0gcjtcbiAgICAgICAgdGhpcy5fY29sb3IuZyA9IGc7XG4gICAgICAgIHRoaXMuX2NvbG9yLmIgPSBiO1xuXG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zeW1ib2xDb2xvcnMpIHtcbiAgICAgICAgICAgIC8vIGNvbG9yIGlzIGJha2VkIGludG8gdmVydGljZXMsIHVwZGF0ZSB0ZXh0XG4gICAgICAgICAgICBpZiAodGhpcy5fZm9udCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yVW5pZm9ybVswXSA9IHRoaXMuX2NvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9jb2xvclVuaWZvcm1bMV0gPSB0aGlzLl9jb2xvci5nO1xuICAgICAgICAgICAgdGhpcy5fY29sb3JVbmlmb3JtWzJdID0gdGhpcy5fY29sb3IuYjtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9lbWlzc2l2ZScsIHRoaXMuX2NvbG9yVW5pZm9ybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5fZWxlbWVudC5maXJlKCdzZXQ6Y29sb3InLCB0aGlzLl9jb2xvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG5cbiAgICBzZXQgb3BhY2l0eSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29sb3IuYSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLmEgPSB2YWx1ZTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0Om9wYWNpdHknLCB2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb3BhY2l0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yLmE7XG4gICAgfVxuXG4gICAgc2V0IGxpbmVIZWlnaHQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgX3ByZXYgPSB0aGlzLl9saW5lSGVpZ2h0O1xuICAgICAgICB0aGlzLl9saW5lSGVpZ2h0ID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3NjYWxlZExpbmVIZWlnaHQgPSB2YWx1ZTtcbiAgICAgICAgaWYgKF9wcmV2ICE9PSB2YWx1ZSAmJiB0aGlzLl9mb250KSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGluZUhlaWdodCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpbmVIZWlnaHQ7XG4gICAgfVxuXG4gICAgc2V0IHdyYXBMaW5lcyh2YWx1ZSkge1xuICAgICAgICBjb25zdCBfcHJldiA9IHRoaXMuX3dyYXBMaW5lcztcbiAgICAgICAgdGhpcy5fd3JhcExpbmVzID0gdmFsdWU7XG4gICAgICAgIGlmIChfcHJldiAhPT0gdmFsdWUgJiYgdGhpcy5fZm9udCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHdyYXBMaW5lcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3dyYXBMaW5lcztcbiAgICB9XG5cbiAgICBnZXQgbGluZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saW5lQ29udGVudHM7XG4gICAgfVxuXG4gICAgc2V0IHNwYWNpbmcodmFsdWUpIHtcbiAgICAgICAgY29uc3QgX3ByZXYgPSB0aGlzLl9zcGFjaW5nO1xuICAgICAgICB0aGlzLl9zcGFjaW5nID0gdmFsdWU7XG4gICAgICAgIGlmIChfcHJldiAhPT0gdmFsdWUgJiYgdGhpcy5fZm9udCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNwYWNpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zcGFjaW5nO1xuICAgIH1cblxuICAgIHNldCBmb250U2l6ZSh2YWx1ZSkge1xuICAgICAgICBjb25zdCBfcHJldiA9IHRoaXMuX2ZvbnRTaXplO1xuICAgICAgICB0aGlzLl9mb250U2l6ZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9vcmlnaW5hbEZvbnRTaXplID0gdmFsdWU7XG4gICAgICAgIGlmIChfcHJldiAhPT0gdmFsdWUgJiYgdGhpcy5fZm9udCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZvbnRTaXplKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZm9udFNpemU7XG4gICAgfVxuXG4gICAgc2V0IGZvbnRBc3NldCh2YWx1ZSkge1xuICAgICAgICAvLyBzZXR0aW5nIHRoZSBmb250QXNzZXQgc2V0cyB0aGUgZGVmYXVsdCBhc3NldHMgd2hpY2ggaW4gdHVyblxuICAgICAgICAvLyB3aWxsIHNldCB0aGUgbG9jYWxpemVkIGFzc2V0IHRvIGJlIGFjdHVhbGx5IHVzZWRcbiAgICAgICAgdGhpcy5fZm9udEFzc2V0LmRlZmF1bHRBc3NldCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBmb250QXNzZXQoKSB7XG4gICAgICAgIC8vIGdldHRpbmcgZm9udEFzc2V0IHJldHVybnMgdGhlIGN1cnJlbnRseSB1c2VkIGxvY2FsaXplZCBhc3NldFxuICAgICAgICByZXR1cm4gdGhpcy5fZm9udEFzc2V0LmxvY2FsaXplZEFzc2V0O1xuICAgIH1cblxuICAgIHNldCBmb250KHZhbHVlKSB7XG4gICAgICAgIGxldCBwcmV2aW91c0ZvbnRUeXBlO1xuXG4gICAgICAgIGlmICh0aGlzLl9mb250KSB7XG4gICAgICAgICAgICBwcmV2aW91c0ZvbnRUeXBlID0gdGhpcy5fZm9udC50eXBlO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgcmVuZGVyIGV2ZW50IGxpc3RlbmVyXG4gICAgICAgICAgICBpZiAodGhpcy5fZm9udC5vZmYpIHRoaXMuX2ZvbnQub2ZmKCdyZW5kZXInLCB0aGlzLl9vbkZvbnRSZW5kZXIsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZm9udCA9IHZhbHVlO1xuXG4gICAgICAgIHRoaXMuX2ZvbnRNaW5ZID0gMDtcbiAgICAgICAgdGhpcy5fZm9udE1heFkgPSAwO1xuXG4gICAgICAgIGlmICghdmFsdWUpIHJldHVybjtcblxuICAgICAgICAvLyBjYWxjdWxhdGUgbWluIC8gbWF4IGZvbnQgZXh0ZW50cyBmcm9tIGFsbCBhdmFpbGFibGUgY2hhcnNcbiAgICAgICAgY29uc3QganNvbiA9IHRoaXMuX2ZvbnQuZGF0YTtcbiAgICAgICAgZm9yIChjb25zdCBjaGFySWQgaW4ganNvbi5jaGFycykge1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGpzb24uY2hhcnNbY2hhcklkXTtcbiAgICAgICAgICAgIGlmIChkYXRhLmJvdW5kcykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZvbnRNaW5ZID0gTWF0aC5taW4odGhpcy5fZm9udE1pblksIGRhdGEuYm91bmRzWzFdKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9mb250TWF4WSA9IE1hdGgubWF4KHRoaXMuX2ZvbnRNYXhZLCBkYXRhLmJvdW5kc1szXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBhdHRhY2ggcmVuZGVyIGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIGlmICh0aGlzLl9mb250Lm9uKSB0aGlzLl9mb250Lm9uKCdyZW5kZXInLCB0aGlzLl9vbkZvbnRSZW5kZXIsIHRoaXMpO1xuXG4gICAgICAgIGlmICh0aGlzLl9mb250QXNzZXQubG9jYWxpemVkQXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gdGhpcy5fc3lzdGVtLmFwcC5hc3NldHMuZ2V0KHRoaXMuX2ZvbnRBc3NldC5sb2NhbGl6ZWRBc3NldCk7XG4gICAgICAgICAgICAvLyBpZiB3ZSdyZSBzZXR0aW5nIGEgZm9udCBkaXJlY3RseSB3aGljaCBkb2Vzbid0IG1hdGNoIHRoZSBhc3NldFxuICAgICAgICAgICAgLy8gdGhlbiBjbGVhciB0aGUgYXNzZXRcbiAgICAgICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSAhPT0gdGhpcy5fZm9udCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZvbnRBc3NldC5kZWZhdWx0QXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgZm9udCB0eXBlIGhhcyBjaGFuZ2VkIHdlIG1heSBuZWVkIHRvIGdldCBjaGFuZ2UgbWF0ZXJpYWxcbiAgICAgICAgaWYgKHZhbHVlLnR5cGUgIT09IHByZXZpb3VzRm9udFR5cGUpIHtcbiAgICAgICAgICAgIGNvbnN0IHNjcmVlblNwYWNlID0gdGhpcy5fZWxlbWVudC5faXNTY3JlZW5TcGFjZSgpO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWF0ZXJpYWwoc2NyZWVuU3BhY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbWFrZSBzdXJlIHdlIGhhdmUgYXMgbWFueSBtZXNoSW5mbyBlbnRyaWVzXG4gICAgICAgIC8vIGFzIHRoZSBudW1iZXIgb2YgZm9udCB0ZXh0dXJlc1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5fZm9udC50ZXh0dXJlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9tZXNoSW5mb1tpXSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbmZvW2ldID0gbmV3IE1lc2hJbmZvKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIGtlZXAgZXhpc3RpbmcgZW50cnkgYnV0IHNldCBjb3JyZWN0IHBhcmFtZXRlcnMgdG8gbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluZm9baV0ubWVzaEluc3RhbmNlO1xuICAgICAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ2ZvbnRfc2RmSW50ZW5zaXR5JywgdGhpcy5fZm9udC5pbnRlbnNpdHkpO1xuICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ2ZvbnRfcHhyYW5nZScsIHRoaXMuX2dldFB4UmFuZ2UodGhpcy5fZm9udCkpO1xuICAgICAgICAgICAgICAgICAgICBtaS5zZXRQYXJhbWV0ZXIoJ2ZvbnRfdGV4dHVyZVdpZHRoJywgdGhpcy5fZm9udC5kYXRhLmluZm8ubWFwc1tpXS53aWR0aCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldFRleHR1cmVQYXJhbXMobWksIHRoaXMuX2ZvbnQudGV4dHVyZXNbaV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRlc3Ryb3kgYW55IGV4Y2VzcyBtZXNoIGluc3RhbmNlc1xuICAgICAgICBsZXQgcmVtb3ZlZE1vZGVsID0gZmFsc2U7XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLl9mb250LnRleHR1cmVzLmxlbmd0aDsgaSA8IHRoaXMuX21lc2hJbmZvLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fbWVzaEluZm9baV0ubWVzaEluc3RhbmNlKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdmVkTW9kZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVtb3ZlIG1vZGVsIGZyb20gc2NlbmUgc28gdGhhdCBleGNlc3MgbWVzaCBpbnN0YW5jZXMgYXJlIHJlbW92ZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gZnJvbSB0aGUgc2NlbmUgYXMgd2VsbFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9lbGVtZW50LnJlbW92ZU1vZGVsRnJvbUxheWVycyh0aGlzLl9tb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZWRNb2RlbCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX3JlbW92ZU1lc2hJbnN0YW5jZSh0aGlzLl9tZXNoSW5mb1tpXS5tZXNoSW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbmZvLmxlbmd0aCA+IHRoaXMuX2ZvbnQudGV4dHVyZXMubGVuZ3RoKVxuICAgICAgICAgICAgdGhpcy5fbWVzaEluZm8ubGVuZ3RoID0gdGhpcy5fZm9udC50ZXh0dXJlcy5sZW5ndGg7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgIH1cblxuICAgIGdldCBmb250KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZm9udDtcbiAgICB9XG5cbiAgICBzZXQgYWxpZ25tZW50KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZlYzIpIHtcbiAgICAgICAgICAgIHRoaXMuX2FsaWdubWVudC5zZXQodmFsdWUueCwgdmFsdWUueSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9hbGlnbm1lbnQuc2V0KHZhbHVlWzBdLCB2YWx1ZVsxXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fZm9udClcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICB9XG5cbiAgICBnZXQgYWxpZ25tZW50KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWxpZ25tZW50O1xuICAgIH1cblxuICAgIHNldCBhdXRvV2lkdGgodmFsdWUpIHtcbiAgICAgICAgY29uc3Qgb2xkID0gdGhpcy5fYXV0b1dpZHRoO1xuICAgICAgICB0aGlzLl9hdXRvV2lkdGggPSB2YWx1ZTtcblxuICAgICAgICAvLyBjaGFuZ2Ugd2lkdGggb2YgZWxlbWVudCB0byBtYXRjaCB0ZXh0IHdpZHRoIGJ1dCBvbmx5IGlmIHRoZSBlbGVtZW50XG4gICAgICAgIC8vIGRvZXMgbm90IGhhdmUgc3BsaXQgaG9yaXpvbnRhbCBhbmNob3JzXG4gICAgICAgIGlmICh2YWx1ZSAmJiBNYXRoLmFicyh0aGlzLl9lbGVtZW50LmFuY2hvci54IC0gdGhpcy5fZWxlbWVudC5hbmNob3IueikgPCAwLjAwMDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQud2lkdGggPSB0aGlzLndpZHRoO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVzdG9yZSBmb250U2l6ZSBpZiBhdXRvV2lkdGggY2hhbmdlZFxuICAgICAgICBpZiAob2xkICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgbmV3Rm9udFNpemUgPSB0aGlzLl9zaG91bGRBdXRvRml0KCkgPyB0aGlzLl9tYXhGb250U2l6ZSA6IHRoaXMuX29yaWdpbmFsRm9udFNpemU7XG4gICAgICAgICAgICBpZiAobmV3Rm9udFNpemUgIT09IHRoaXMuX2ZvbnRTaXplKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZm9udFNpemUgPSBuZXdGb250U2l6ZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fZm9udCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGF1dG9XaWR0aCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2F1dG9XaWR0aDtcbiAgICB9XG5cbiAgICBzZXQgYXV0b0hlaWdodCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBvbGQgPSB0aGlzLl9hdXRvSGVpZ2h0O1xuICAgICAgICB0aGlzLl9hdXRvSGVpZ2h0ID0gdmFsdWU7XG5cbiAgICAgICAgLy8gY2hhbmdlIGhlaWdodCBvZiBlbGVtZW50IHRvIG1hdGNoIHRleHQgaGVpZ2h0IGJ1dCBvbmx5IGlmIHRoZSBlbGVtZW50XG4gICAgICAgIC8vIGRvZXMgbm90IGhhdmUgc3BsaXQgdmVydGljYWwgYW5jaG9yc1xuICAgICAgICBpZiAodmFsdWUgJiYgTWF0aC5hYnModGhpcy5fZWxlbWVudC5hbmNob3IueSAtIHRoaXMuX2VsZW1lbnQuYW5jaG9yLncpIDwgMC4wMDAxKSB7XG4gICAgICAgICAgICB0aGlzLl9lbGVtZW50LmhlaWdodCA9IHRoaXMuaGVpZ2h0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmVzdG9yZSBmb250U2l6ZSBpZiBhdXRvSGVpZ2h0IGNoYW5nZWRcbiAgICAgICAgaWYgKG9sZCAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld0ZvbnRTaXplID0gdGhpcy5fc2hvdWxkQXV0b0ZpdCgpID8gdGhpcy5fbWF4Rm9udFNpemUgOiB0aGlzLl9vcmlnaW5hbEZvbnRTaXplO1xuICAgICAgICAgICAgaWYgKG5ld0ZvbnRTaXplICE9PSB0aGlzLl9mb250U2l6ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZvbnRTaXplID0gbmV3Rm9udFNpemU7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhdXRvSGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b0hlaWdodDtcbiAgICB9XG5cbiAgICBzZXQgcnRsUmVvcmRlcih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fcnRsUmVvcmRlciAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3J0bFJlb3JkZXIgPSB2YWx1ZTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9mb250KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJ0bFJlb3JkZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ydGxSZW9yZGVyO1xuICAgIH1cblxuICAgIHNldCB1bmljb2RlQ29udmVydGVyKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl91bmljb2RlQ29udmVydGVyICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fdW5pY29kZUNvbnZlcnRlciA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fc2V0VGV4dCh0aGlzLl90ZXh0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB1bmljb2RlQ29udmVydGVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdW5pY29kZUNvbnZlcnRlcjtcbiAgICB9XG5cbiAgICAvLyBwcml2YXRlXG4gICAgZ2V0IGFhYmIoKSB7XG4gICAgICAgIGlmICh0aGlzLl9hYWJiRGlydHkpIHtcbiAgICAgICAgICAgIGxldCBpbml0aWFsaXplZCA9IGZhbHNlO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5mby5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fbWVzaEluZm9baV0ubWVzaEluc3RhbmNlKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgIGlmICghaW5pdGlhbGl6ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYWFiYi5jb3B5KHRoaXMuX21lc2hJbmZvW2ldLm1lc2hJbnN0YW5jZS5hYWJiKTtcbiAgICAgICAgICAgICAgICAgICAgaW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FhYmIuYWRkKHRoaXMuX21lc2hJbmZvW2ldLm1lc2hJbnN0YW5jZS5hYWJiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2FhYmJEaXJ0eSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hYWJiO1xuICAgIH1cblxuICAgIHNldCBvdXRsaW5lQ29sb3IodmFsdWUpIHtcbiAgICAgICAgY29uc3QgciA9ICh2YWx1ZSBpbnN0YW5jZW9mIENvbG9yKSA/IHZhbHVlLnIgOiB2YWx1ZVswXTtcbiAgICAgICAgY29uc3QgZyA9ICh2YWx1ZSBpbnN0YW5jZW9mIENvbG9yKSA/IHZhbHVlLmcgOiB2YWx1ZVsxXTtcbiAgICAgICAgY29uc3QgYiA9ICh2YWx1ZSBpbnN0YW5jZW9mIENvbG9yKSA/IHZhbHVlLmIgOiB2YWx1ZVsyXTtcbiAgICAgICAgY29uc3QgYSA9ICh2YWx1ZSBpbnN0YW5jZW9mIENvbG9yKSA/IHZhbHVlLmEgOiB2YWx1ZVszXTtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh0aGlzLl9vdXRsaW5lQ29sb3IgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ1NldHRpbmcgZWxlbWVudC5vdXRsaW5lQ29sb3IgdG8gaXRzZWxmIHdpbGwgaGF2ZSBubyBlZmZlY3QnKTtcbiAgICAgICAgfVxuICAgICAgICAvLyAjZW5kaWZcblxuICAgICAgICBpZiAodGhpcy5fb3V0bGluZUNvbG9yLnIgPT09IHIgJiZcbiAgICAgICAgICAgIHRoaXMuX291dGxpbmVDb2xvci5nID09PSBnICYmXG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3IuYiA9PT0gYiAmJlxuICAgICAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yLmEgPT09IGEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX291dGxpbmVDb2xvci5yID0gcjtcbiAgICAgICAgdGhpcy5fb3V0bGluZUNvbG9yLmcgPSBnO1xuICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3IuYiA9IGI7XG4gICAgICAgIHRoaXMuX291dGxpbmVDb2xvci5hID0gYTtcblxuICAgICAgICBpZiAoIXRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ltYm9sT3V0bGluZVBhcmFtcykge1xuICAgICAgICAgICAgLy8gb3V0bGluZSBwYXJhbWV0ZXJzIGFyZSBiYWtlZCBpbnRvIHZlcnRpY2VzLCB1cGRhdGUgdGV4dFxuICAgICAgICAgICAgaWYgKHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3JVbmlmb3JtWzBdID0gdGhpcy5fb3V0bGluZUNvbG9yLnI7XG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3JVbmlmb3JtWzFdID0gdGhpcy5fb3V0bGluZUNvbG9yLmc7XG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3JVbmlmb3JtWzJdID0gdGhpcy5fb3V0bGluZUNvbG9yLmI7XG4gICAgICAgICAgICB0aGlzLl9vdXRsaW5lQ29sb3JVbmlmb3JtWzNdID0gdGhpcy5fb3V0bGluZUNvbG9yLmE7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgICAgIG1pLnNldFBhcmFtZXRlcignb3V0bGluZV9jb2xvcicsIHRoaXMuX291dGxpbmVDb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2VsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX2VsZW1lbnQuZmlyZSgnc2V0Om91dGxpbmUnLCB0aGlzLl9jb2xvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb3V0bGluZUNvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3V0bGluZUNvbG9yO1xuICAgIH1cblxuICAgIHNldCBvdXRsaW5lVGhpY2tuZXNzKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IF9wcmV2ID0gdGhpcy5fb3V0bGluZVRoaWNrbmVzcztcbiAgICAgICAgdGhpcy5fb3V0bGluZVRoaWNrbmVzcyA9IHZhbHVlO1xuICAgICAgICBpZiAoX3ByZXYgIT09IHZhbHVlICYmIHRoaXMuX2ZvbnQpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9zeW1ib2xPdXRsaW5lUGFyYW1zKSB7XG4gICAgICAgICAgICAgICAgLy8gb3V0bGluZSBwYXJhbWV0ZXJzIGFyZSBiYWtlZCBpbnRvIHZlcnRpY2VzLCB1cGRhdGUgdGV4dFxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9mb250KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdvdXRsaW5lX3RoaWNrbmVzcycsIHRoaXMuX291dGxpbmVUaGlja25lc3NTY2FsZSAqIHRoaXMuX291dGxpbmVUaGlja25lc3MpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvdXRsaW5lVGhpY2tuZXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3V0bGluZVRoaWNrbmVzcztcbiAgICB9XG5cbiAgICBzZXQgc2hhZG93Q29sb3IodmFsdWUpIHtcbiAgICAgICAgY29uc3QgciA9ICh2YWx1ZSBpbnN0YW5jZW9mIENvbG9yKSA/IHZhbHVlLnIgOiB2YWx1ZVswXTtcbiAgICAgICAgY29uc3QgZyA9ICh2YWx1ZSBpbnN0YW5jZW9mIENvbG9yKSA/IHZhbHVlLmcgOiB2YWx1ZVsxXTtcbiAgICAgICAgY29uc3QgYiA9ICh2YWx1ZSBpbnN0YW5jZW9mIENvbG9yKSA/IHZhbHVlLmIgOiB2YWx1ZVsyXTtcbiAgICAgICAgY29uc3QgYSA9ICh2YWx1ZSBpbnN0YW5jZW9mIENvbG9yKSA/IHZhbHVlLmEgOiB2YWx1ZVszXTtcblxuICAgICAgICAvLyAjaWYgX0RFQlVHXG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dDb2xvciA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oJ1NldHRpbmcgZWxlbWVudC5zaGFkb3dDb2xvciB0byBpdHNlbGYgd2lsbCBoYXZlIG5vIGVmZmVjdCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vICNlbmRpZlxuXG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dDb2xvci5yID09PSByICYmXG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvci5nID09PSBnICYmXG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvci5iID09PSBiICYmXG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvci5hID09PSBhKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zaGFkb3dDb2xvci5yID0gcjtcbiAgICAgICAgdGhpcy5fc2hhZG93Q29sb3IuZyA9IGc7XG4gICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yLmIgPSBiO1xuICAgICAgICB0aGlzLl9zaGFkb3dDb2xvci5hID0gYTtcblxuICAgICAgICBpZiAoIXRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fc3ltYm9sU2hhZG93UGFyYW1zKSB7XG4gICAgICAgICAgICAvLyBzaGFkb3cgcGFyYW1ldGVycyBhcmUgYmFrZWQgaW50byB2ZXJ0aWNlcywgdXBkYXRlIHRleHRcbiAgICAgICAgICAgIGlmICh0aGlzLl9mb250KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtWzBdID0gdGhpcy5fc2hhZG93Q29sb3IucjtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0NvbG9yVW5pZm9ybVsxXSA9IHRoaXMuX3NoYWRvd0NvbG9yLmc7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDb2xvclVuaWZvcm1bMl0gPSB0aGlzLl9zaGFkb3dDb2xvci5iO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q29sb3JVbmlmb3JtWzNdID0gdGhpcy5fc2hhZG93Q29sb3IuYTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdzaGFkb3dfY29sb3InLCB0aGlzLl9zaGFkb3dDb2xvclVuaWZvcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd0NvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2hhZG93Q29sb3I7XG4gICAgfVxuXG4gICAgc2V0IHNoYWRvd09mZnNldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCB4ID0gKHZhbHVlIGluc3RhbmNlb2YgVmVjMikgPyB2YWx1ZS54IDogdmFsdWVbMF0sXG4gICAgICAgICAgICB5ID0gKHZhbHVlIGluc3RhbmNlb2YgVmVjMikgPyB2YWx1ZS55IDogdmFsdWVbMV07XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dPZmZzZXQueCA9PT0geCAmJiB0aGlzLl9zaGFkb3dPZmZzZXQueSA9PT0geSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3NoYWRvd09mZnNldC5zZXQoeCwgeSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2ZvbnQgJiYgdGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9zeW1ib2xTaGFkb3dQYXJhbXMpIHtcbiAgICAgICAgICAgICAgICAvLyBzaGFkb3cgcGFyYW1ldGVycyBhcmUgYmFrZWQgaW50byB2ZXJ0aWNlcywgdXBkYXRlIHRleHRcbiAgICAgICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJhdGlvID0gLXRoaXMuX2ZvbnQuZGF0YS5pbmZvLm1hcHNbaV0ud2lkdGggLyB0aGlzLl9mb250LmRhdGEuaW5mby5tYXBzW2ldLmhlaWdodDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93T2Zmc2V0VW5pZm9ybVswXSA9IHRoaXMuX3NoYWRvd09mZnNldFNjYWxlICogdGhpcy5fc2hhZG93T2Zmc2V0Lng7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd09mZnNldFVuaWZvcm1bMV0gPSByYXRpbyAqIHRoaXMuX3NoYWRvd09mZnNldFNjYWxlICogdGhpcy5fc2hhZG93T2Zmc2V0Lnk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgbWkuc2V0UGFyYW1ldGVyKCdzaGFkb3dfb2Zmc2V0JywgdGhpcy5fc2hhZG93T2Zmc2V0VW5pZm9ybSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd09mZnNldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd09mZnNldDtcbiAgICB9XG5cbiAgICBzZXQgbWluRm9udFNpemUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21pbkZvbnRTaXplID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9taW5Gb250U2l6ZSA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLmZvbnQgJiYgdGhpcy5fc2hvdWxkQXV0b0ZpdCgpKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWluRm9udFNpemUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9taW5Gb250U2l6ZTtcbiAgICB9XG5cbiAgICBzZXQgbWF4Rm9udFNpemUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21heEZvbnRTaXplID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9tYXhGb250U2l6ZSA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLmZvbnQgJiYgdGhpcy5fc2hvdWxkQXV0b0ZpdCgpKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF4Rm9udFNpemUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXhGb250U2l6ZTtcbiAgICB9XG5cbiAgICBzZXQgYXV0b0ZpdFdpZHRoKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9hdXRvRml0V2lkdGggPT09IHZhbHVlKSByZXR1cm47XG4gICAgICAgIHRoaXMuX2F1dG9GaXRXaWR0aCA9IHZhbHVlO1xuXG4gICAgICAgIHRoaXMuX2ZvbnRTaXplID0gdGhpcy5fc2hvdWxkQXV0b0ZpdCgpID8gdGhpcy5fbWF4Rm9udFNpemUgOiB0aGlzLl9vcmlnaW5hbEZvbnRTaXplO1xuICAgICAgICBpZiAodGhpcy5mb250KSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUZXh0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXV0b0ZpdFdpZHRoKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b0ZpdFdpZHRoO1xuICAgIH1cblxuICAgIHNldCBhdXRvRml0SGVpZ2h0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9hdXRvRml0SGVpZ2h0ID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgICAgICB0aGlzLl9hdXRvRml0SGVpZ2h0ID0gdmFsdWU7XG5cbiAgICAgICAgdGhpcy5fZm9udFNpemUgPSB0aGlzLl9zaG91bGRBdXRvRml0KCkgPyB0aGlzLl9tYXhGb250U2l6ZSA6IHRoaXMuX29yaWdpbmFsRm9udFNpemU7XG4gICAgICAgIGlmICh0aGlzLmZvbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRleHQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhdXRvRml0SGVpZ2h0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXV0b0ZpdEhlaWdodDtcbiAgICB9XG5cbiAgICBzZXQgbWF4TGluZXModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21heExpbmVzID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgICAgICBpZiAodmFsdWUgPT09IG51bGwgJiYgdGhpcy5fbWF4TGluZXMgPT09IC0xKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fbWF4TGluZXMgPSAodmFsdWUgPT09IG51bGwgPyAtMSA6IHZhbHVlKTtcblxuICAgICAgICBpZiAodGhpcy5mb250ICYmIHRoaXMuX3dyYXBMaW5lcykge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1heExpbmVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF4TGluZXM7XG4gICAgfVxuXG4gICAgc2V0IGVuYWJsZU1hcmt1cCh2YWx1ZSkge1xuICAgICAgICB2YWx1ZSA9ICEhdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVNYXJrdXAgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZW5hYmxlTWFya3VwID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuZm9udCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVGV4dCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NyZWVuU3BhY2UgPSB0aGlzLl9lbGVtZW50Ll9pc1NjcmVlblNwYWNlKCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1hdGVyaWFsKHNjcmVlblNwYWNlKTtcbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlTWFya3VwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZW5hYmxlTWFya3VwO1xuICAgIH1cblxuICAgIGdldCBzeW1ib2xzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc3ltYm9scztcbiAgICB9XG5cbiAgICBnZXQgc3ltYm9sQ29sb3JzKCkge1xuICAgICAgICBpZiAodGhpcy5fc3ltYm9sQ29sb3JzID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc3ltYm9sQ29sb3JzLm1hcChmdW5jdGlvbiAoYykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yUGFsZXR0ZS5zbGljZShjICogMywgYyAqIDMgKyAzKTtcbiAgICAgICAgfSwgdGhpcyk7XG4gICAgfVxuXG4gICAgLy8gTk9URTogaXQgaXMgdXNlZCBvbmx5IGZvciB0ZXN0c1xuICAgIGdldCBzeW1ib2xPdXRsaW5lUGFyYW1zKCkge1xuICAgICAgICBpZiAodGhpcy5fc3ltYm9sT3V0bGluZVBhcmFtcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX3N5bWJvbE91dGxpbmVQYXJhbXMubWFwKGZ1bmN0aW9uIChwYXJhbUlkKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fb3V0bGluZVBhbGV0dGUuc2xpY2UocGFyYW1JZCAqIDUsIHBhcmFtSWQgKiA1ICsgNSk7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIC8vIE5PVEU6IGl0IGlzIHVzZWQgb25seSBmb3IgdGVzdHNcbiAgICBnZXQgc3ltYm9sU2hhZG93UGFyYW1zKCkge1xuICAgICAgICBpZiAodGhpcy5fc3ltYm9sU2hhZG93UGFyYW1zID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5fc3ltYm9sU2hhZG93UGFyYW1zLm1hcChmdW5jdGlvbiAocGFyYW1JZCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd1BhbGV0dGUuc2xpY2UocGFyYW1JZCAqIDYsIHBhcmFtSWQgKiA2ICsgNik7XG4gICAgICAgIH0sIHRoaXMpO1xuICAgIH1cblxuICAgIGdldCBydGwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ydGw7XG4gICAgfVxuXG4gICAgc2V0IHJhbmdlU3RhcnQocmFuZ2VTdGFydCkge1xuICAgICAgICByYW5nZVN0YXJ0ID0gTWF0aC5tYXgoMCwgTWF0aC5taW4ocmFuZ2VTdGFydCwgdGhpcy5fc3ltYm9scy5sZW5ndGgpKTtcblxuICAgICAgICBpZiAocmFuZ2VTdGFydCAhPT0gdGhpcy5fcmFuZ2VTdGFydCkge1xuICAgICAgICAgICAgdGhpcy5fcmFuZ2VTdGFydCA9IHJhbmdlU3RhcnQ7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVSZW5kZXJSYW5nZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJhbmdlU3RhcnQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yYW5nZVN0YXJ0O1xuICAgIH1cblxuICAgIHNldCByYW5nZUVuZChyYW5nZUVuZCkge1xuICAgICAgICByYW5nZUVuZCA9IE1hdGgubWF4KHRoaXMuX3JhbmdlU3RhcnQsIE1hdGgubWluKHJhbmdlRW5kLCB0aGlzLl9zeW1ib2xzLmxlbmd0aCkpO1xuXG4gICAgICAgIGlmIChyYW5nZUVuZCAhPT0gdGhpcy5fcmFuZ2VFbmQpIHtcbiAgICAgICAgICAgIHRoaXMuX3JhbmdlRW5kID0gcmFuZ2VFbmQ7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVSZW5kZXJSYW5nZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJhbmdlRW5kKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmFuZ2VFbmQ7XG4gICAgfVxufVxuXG5leHBvcnQgeyBUZXh0RWxlbWVudCB9O1xuIl0sIm5hbWVzIjpbIk1lc2hJbmZvIiwiY29uc3RydWN0b3IiLCJjb3VudCIsInF1YWQiLCJsaW5lcyIsInBvc2l0aW9ucyIsIm5vcm1hbHMiLCJ1dnMiLCJjb2xvcnMiLCJpbmRpY2VzIiwib3V0bGluZXMiLCJzaGFkb3dzIiwibWVzaEluc3RhbmNlIiwiY3JlYXRlVGV4dE1lc2giLCJkZXZpY2UiLCJtZXNoSW5mbyIsIm1lc2giLCJNZXNoIiwic2V0UG9zaXRpb25zIiwic2V0Tm9ybWFscyIsInNldENvbG9yczMyIiwic2V0VXZzIiwic2V0SW5kaWNlcyIsInNldFZlcnRleFN0cmVhbSIsIlNFTUFOVElDX0FUVFI4IiwidW5kZWZpbmVkIiwiVFlQRV9GTE9BVDMyIiwiU0VNQU5USUNfQVRUUjkiLCJ1cGRhdGUiLCJMSU5FX0JSRUFLX0NIQVIiLCJXSElURVNQQUNFX0NIQVIiLCJXT1JEX0JPVU5EQVJZX0NIQVIiLCJBTFBIQU5VTUVSSUNfQ0hBUiIsIkNKS19DSEFSIiwiTk9fTElORV9CUkVBS19DSktfQ0hBUiIsIkNPTlRST0xfQ0hBUlMiLCJDT05UUk9MX0dMWVBIX0RBVEEiLCJ3aWR0aCIsImhlaWdodCIsInhhZHZhbmNlIiwieG9mZnNldCIsInlvZmZzZXQiLCJjb2xvclRtcCIsIkNvbG9yIiwidmVjMlRtcCIsIlZlYzIiLCJUZXh0RWxlbWVudCIsImVsZW1lbnQiLCJfZWxlbWVudCIsIl9zeXN0ZW0iLCJzeXN0ZW0iLCJfZW50aXR5IiwiZW50aXR5IiwiX3RleHQiLCJfc3ltYm9scyIsIl9jb2xvclBhbGV0dGUiLCJfb3V0bGluZVBhbGV0dGUiLCJfc2hhZG93UGFsZXR0ZSIsIl9zeW1ib2xDb2xvcnMiLCJfc3ltYm9sT3V0bGluZVBhcmFtcyIsIl9zeW1ib2xTaGFkb3dQYXJhbXMiLCJfaTE4bktleSIsIl9mb250QXNzZXQiLCJMb2NhbGl6ZWRBc3NldCIsImFwcCIsImRpc2FibGVMb2NhbGl6YXRpb24iLCJvbiIsIl9vbkZvbnRMb2FkIiwiX29uRm9udENoYW5nZSIsIl9vbkZvbnRSZW1vdmUiLCJfZm9udCIsIl9jb2xvciIsIl9jb2xvclVuaWZvcm0iLCJGbG9hdDMyQXJyYXkiLCJfc3BhY2luZyIsIl9mb250U2l6ZSIsIl9mb250TWluWSIsIl9mb250TWF4WSIsIl9vcmlnaW5hbEZvbnRTaXplIiwiX21heEZvbnRTaXplIiwiX21pbkZvbnRTaXplIiwiX2F1dG9GaXRXaWR0aCIsIl9hdXRvRml0SGVpZ2h0IiwiX21heExpbmVzIiwiX2xpbmVIZWlnaHQiLCJfc2NhbGVkTGluZUhlaWdodCIsIl93cmFwTGluZXMiLCJfZHJhd09yZGVyIiwiX2FsaWdubWVudCIsIl9hdXRvV2lkdGgiLCJfYXV0b0hlaWdodCIsIl9ub2RlIiwiR3JhcGhOb2RlIiwiX21vZGVsIiwiTW9kZWwiLCJncmFwaCIsImFkZENoaWxkIiwiX21lc2hJbmZvIiwiX21hdGVyaWFsIiwiX2FhYmJEaXJ0eSIsIl9hYWJiIiwiQm91bmRpbmdCb3giLCJfbm9SZXNpemUiLCJfY3VycmVudE1hdGVyaWFsVHlwZSIsIl9tYXNrZWRNYXRlcmlhbFNyYyIsIl9ydGxSZW9yZGVyIiwiX3VuaWNvZGVDb252ZXJ0ZXIiLCJfcnRsIiwiX291dGxpbmVDb2xvciIsIl9vdXRsaW5lQ29sb3JVbmlmb3JtIiwiX291dGxpbmVUaGlja25lc3NTY2FsZSIsIl9vdXRsaW5lVGhpY2tuZXNzIiwiX3NoYWRvd0NvbG9yIiwiX3NoYWRvd0NvbG9yVW5pZm9ybSIsIl9zaGFkb3dPZmZzZXRTY2FsZSIsIl9zaGFkb3dPZmZzZXQiLCJfc2hhZG93T2Zmc2V0VW5pZm9ybSIsIl9lbmFibGVNYXJrdXAiLCJfb25TY3JlZW5DaGFuZ2UiLCJzY3JlZW4iLCJfb25QYXJlbnRSZXNpemUiLCJfb25TY3JlZW5TcGFjZUNoYW5nZSIsIl9vbkRyYXdPcmRlckNoYW5nZSIsIl9vblBpdm90Q2hhbmdlIiwiaTE4biIsIl9vbkxvY2FsZVNldCIsIl9vbkxvY2FsaXphdGlvbkRhdGEiLCJfcmFuZ2VTdGFydCIsIl9yYW5nZUVuZCIsImRlc3Ryb3kiLCJfc2V0TWF0ZXJpYWwiLCJyZW1vdmVNb2RlbEZyb21MYXllcnMiLCJmb250Iiwib2ZmIiwiX3VwZGF0ZVRleHQiLCJfdXBkYXRlTWF0ZXJpYWwiLCJzY3JlZW5TcGFjZSIsInZhbHVlIiwib3JkZXIiLCJpIiwibGVuIiwibWVzaEluc3RhbmNlcyIsImxlbmd0aCIsImRyYXdPcmRlciIsInBpdm90IiwibG9jYWxlIiwiZm9udEFzc2V0IiwiYXNzZXQiLCJhc3NldHMiLCJnZXQiLCJyZXNvdXJjZSIsIl9yZXNldExvY2FsaXplZFRleHQiLCJtZXNzYWdlcyIsIl9zZXRUZXh0IiwiZ2V0VGV4dCIsInRleHQiLCJ1bmljb2RlQ29udmVydGVyIiwidW5pY29kZUNvbnZlcnRlckZ1bmMiLCJnZXRVbmljb2RlQ29udmVydGVyIiwiY29uc29sZSIsIndhcm4iLCJ0YWdzIiwic3RyaW5nIiwiZ2V0U3ltYm9scyIsIm5vcm1hbGl6ZSIsInJlc3VsdHMiLCJNYXJrdXAiLCJldmFsdWF0ZSIsInN5bWJvbHMiLCJydGxSZW9yZGVyRnVuYyIsInN5c3RlbXMiLCJnZXRSdGxSZW9yZGVyIiwicnRsIiwibWFwcGluZyIsIm1hcCIsInYiLCJnZXRDb2xvclRoaWNrbmVzc0hhc2giLCJjb2xvciIsInRoaWNrbmVzcyIsInRvU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJ0b0ZpeGVkIiwiZ2V0Q29sb3JPZmZzZXRIYXNoIiwib2Zmc2V0IiwieCIsInkiLCJwYWxldHRlTWFwIiwib3V0bGluZVBhbGV0dGVNYXAiLCJzaGFkb3dQYWxldHRlTWFwIiwiTWF0aCIsInJvdW5kIiwiciIsImciLCJiIiwiYSIsInRhZyIsImMiLCJoZXgiLCJzdWJzdHJpbmciLCJoYXNPd25Qcm9wZXJ0eSIsInRlc3QiLCJwdXNoIiwicGFyc2VJbnQiLCJvdXRsaW5lIiwiYXR0cmlidXRlcyIsImZyb21TdHJpbmciLCJOdW1iZXIiLCJpc05hTiIsIm91dGxpbmVIYXNoIiwic2hhZG93Iiwib2Zmc2V0WCIsIm9mZnNldFkiLCJvZmZYIiwib2ZmWSIsInNldCIsInNoYWRvd0hhc2giLCJfdXBkYXRlTWF0ZXJpYWxFbWlzc2l2ZSIsIl91cGRhdGVNYXRlcmlhbE91dGxpbmUiLCJfdXBkYXRlTWF0ZXJpYWxTaGFkb3ciLCJjaGFyYWN0ZXJzUGVyVGV4dHVyZSIsIl9jYWxjdWxhdGVDaGFyc1BlclRleHR1cmUiLCJyZW1vdmVkTW9kZWwiLCJfaXNTY3JlZW5TcGFjZSIsInNjcmVlbkN1bGxlZCIsIl9pc1NjcmVlbkN1bGxlZCIsInZpc2libGVGbiIsImNhbWVyYSIsImlzVmlzaWJsZUZvckNhbWVyYSIsImwiLCJfcmVtb3ZlTWVzaEluc3RhbmNlIiwiZ3JhcGhpY3NEZXZpY2UiLCJtaSIsIk1lc2hJbnN0YW5jZSIsIm5hbWUiLCJjYXN0U2hhZG93IiwicmVjZWl2ZVNoYWRvdyIsImN1bGwiLCJpc1Zpc2libGVGdW5jIiwiX3NldFRleHR1cmVQYXJhbXMiLCJ0ZXh0dXJlcyIsInNldFBhcmFtZXRlciIsImludGVuc2l0eSIsIl9nZXRQeFJhbmdlIiwiZGF0YSIsImluZm8iLCJtYXBzIiwicmF0aW8iLCJtYXNrZWRCeSIsIl9zZXRNYXNrZWRCeSIsImVuYWJsZWQiLCJhZGRNb2RlbFRvTGF5ZXJzIiwiX3VwZGF0ZU1lc2hlcyIsIl91cGRhdGVSZW5kZXJSYW5nZSIsImlkeCIsImluZGV4T2YiLCJzcGxpY2UiLCJtYXRlcmlhbCIsIm1zZGYiLCJ0eXBlIiwiRk9OVF9NU0RGIiwiZ2V0VGV4dEVsZW1lbnRNYXRlcmlhbCIsIl9pc1dvcmRCb3VuZGFyeSIsImNoYXIiLCJfaXNWYWxpZE5leHRDaGFyIiwibmV4dGNoYXIiLCJfaXNOZXh0Q0pLQm91bmRhcnkiLCJfaXNOZXh0Q0pLV2hvbGVXb3JkIiwianNvbiIsInNlbGYiLCJtaW5Gb250IiwibWluIiwibWF4Rm9udCIsImF1dG9GaXQiLCJfc2hvdWxkQXV0b0ZpdCIsIk1BR0lDIiwiX3giLCJfeSIsIl96IiwiX3hNaW51c1RyYWlsaW5nV2hpdGVzcGFjZSIsIndvcmRTdGFydFgiLCJ3b3JkU3RhcnRJbmRleCIsImxpbmVTdGFydEluZGV4IiwibnVtV29yZHNUaGlzTGluZSIsIm51bUNoYXJzVGhpc0xpbmUiLCJudW1CcmVha3NUaGlzTGluZSIsInNwbGl0SG9yaXpvbnRhbEFuY2hvcnMiLCJhYnMiLCJhbmNob3IiLCJ6IiwibWF4TGluZVdpZHRoIiwiY2FsY3VsYXRlZFdpZHRoIiwiYXV0b1dpZHRoIiwiUE9TSVRJVkVfSU5GSU5JVFkiLCJmb250TWluWSIsImZvbnRNYXhZIiwiYnJlYWtMaW5lIiwibGluZUJyZWFrSW5kZXgiLCJsaW5lQnJlYWtYIiwiX2xpbmVXaWR0aHMiLCJzbGljZVN0YXJ0Iiwic2xpY2VFbmQiLCJjaGFycyIsInNsaWNlIiwiX2xpbmVDb250ZW50cyIsImpvaW4iLCJyZXRyeVVwZGF0ZU1lc2hlcyIsInNjYWxlIiwiY29sb3JfciIsImNvbG9yX2ciLCJjb2xvcl9iIiwib3V0bGluZV9jb2xvcl9yZyIsIm91dGxpbmVfY29sb3JfYmEiLCJvdXRsaW5lX3RoaWNrbmVzcyIsInNoYWRvd19jb2xvcl9yZyIsInNoYWRvd19jb2xvcl9iYSIsInNoYWRvd19vZmZzZXRfeHkiLCJpc0xpbmVCcmVhayIsImFkdmFuY2UiLCJxdWFkc2l6ZSIsImRhdGFTY2FsZSIsInNpemUiLCJrZXkiLCJtaXNzaW5nQ2hhcnMiLCJTZXQiLCJoYXMiLCJmYWNlIiwiYWRkIiwia2VybmluZyIsImtlcm5UYWJsZSIsImtlcm5MZWZ0IiwiZ2V0Q29kZVBvaW50IiwiZXJyb3IiLCJpc1doaXRlc3BhY2UiLCJtZXNoSW5mb0lkIiwiY2FuZGlkYXRlTGluZVdpZHRoIiwiYmFja3RyYWNrIiwibWF4IiwiYmFja3RyYWNrU3RhcnQiLCJiYWNrdHJhY2tFbmQiLCJqIiwiYmFja0NoYXIiLCJiYWNrQ2hhckRhdGEiLCJiYWNrTWVzaEluZm8iLCJsZWZ0IiwicmlnaHQiLCJib3R0b20iLCJ0b3AiLCJzaGlmdCIsImZvbnRTaXplIiwiX3Nob3VsZEF1dG9GaXRXaWR0aCIsImZsb29yIiwibWF0aCIsImNsYW1wIiwiX3Nob3VsZEF1dG9GaXRIZWlnaHQiLCJjYWxjdWxhdGVkSGVpZ2h0IiwidXYiLCJfZ2V0VXYiLCJjb2xvcklkeCIsIm91dGxpbmVJZHgiLCJzaGFkb3dJZHgiLCJhdXRvSGVpZ2h0IiwiaHAiLCJ2cCIsImhhIiwidmEiLCJwcmV2UXVhZCIsImxpbmUiLCJpbmRleCIsImx3IiwiaG9mZnNldCIsInZvZmZzZXQiLCJ2ZXJ0IiwidG1wMCIsInRtcDEiLCJudW1WZXJ0aWNlcyIsInZlcnRNYXgiLCJpdCIsIlZlcnRleEl0ZXJhdG9yIiwidmVydGV4QnVmZmVyIiwiU0VNQU5USUNfUE9TSVRJT04iLCJTRU1BTlRJQ19URVhDT09SRDAiLCJTRU1BTlRJQ19DT0xPUiIsIm5leHQiLCJlbmQiLCJhYWJiIiwiY29tcHV0ZSIsIl9hYWJiVmVyIiwiX29uRm9udFJlbmRlciIsIl9uZXciLCJfb2xkIiwidGV4dHVyZSIsImRlbGV0ZVBhcmFtZXRlciIsIkZPTlRfQklUTUFQIiwia2V5cyIsIk9iamVjdCIsInJhbmdlIiwic3BhY2UiLCJ4MSIsInkxIiwieDIiLCJ5MiIsImVkZ2UiLCJvbkVuYWJsZSIsImF1dG9Mb2FkIiwib25EaXNhYmxlIiwiX3NldFN0ZW5jaWwiLCJzdGVuY2lsUGFyYW1zIiwiaW5zdGFuY2VzIiwic3RlbmNpbEZyb250Iiwic3RlbmNpbEJhY2siLCJzeW1ib2xJbmRleCIsInN0YXJ0Q2hhcnMiLCJlbmRDaGFycyIsInN0YXJ0IiwiaW5zdGFuY2UiLCJwcmltaXRpdmUiLCJiYXNlIiwic3RyIiwiZmlyZSIsIm9wYWNpdHkiLCJsaW5lSGVpZ2h0IiwiX3ByZXYiLCJ3cmFwTGluZXMiLCJzcGFjaW5nIiwiZGVmYXVsdEFzc2V0IiwibG9jYWxpemVkQXNzZXQiLCJwcmV2aW91c0ZvbnRUeXBlIiwiY2hhcklkIiwiYm91bmRzIiwiYWxpZ25tZW50Iiwib2xkIiwibmV3Rm9udFNpemUiLCJ3IiwicnRsUmVvcmRlciIsImluaXRpYWxpemVkIiwiY29weSIsIm91dGxpbmVDb2xvciIsIm91dGxpbmVUaGlja25lc3MiLCJzaGFkb3dDb2xvciIsIkRlYnVnIiwic2hhZG93T2Zmc2V0IiwibWluRm9udFNpemUiLCJtYXhGb250U2l6ZSIsImF1dG9GaXRXaWR0aCIsImF1dG9GaXRIZWlnaHQiLCJtYXhMaW5lcyIsImVuYWJsZU1hcmt1cCIsInN5bWJvbENvbG9ycyIsInN5bWJvbE91dGxpbmVQYXJhbXMiLCJwYXJhbUlkIiwic3ltYm9sU2hhZG93UGFyYW1zIiwicmFuZ2VTdGFydCIsInJhbmdlRW5kIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFzQkEsTUFBTUEsUUFBTixDQUFlO0FBQ1hDLEVBQUFBLFdBQVcsR0FBRztJQUVWLElBQUtDLENBQUFBLEtBQUwsR0FBYSxDQUFiLENBQUE7SUFFQSxJQUFLQyxDQUFBQSxJQUFMLEdBQVksQ0FBWixDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsS0FBTCxHQUFhLEVBQWIsQ0FBQTtJQUVBLElBQUtDLENBQUFBLFNBQUwsR0FBaUIsRUFBakIsQ0FBQTtJQUVBLElBQUtDLENBQUFBLE9BQUwsR0FBZSxFQUFmLENBQUE7SUFFQSxJQUFLQyxDQUFBQSxHQUFMLEdBQVcsRUFBWCxDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsTUFBTCxHQUFjLEVBQWQsQ0FBQTtJQUVBLElBQUtDLENBQUFBLE9BQUwsR0FBZSxFQUFmLENBQUE7SUFFQSxJQUFLQyxDQUFBQSxRQUFMLEdBQWdCLEVBQWhCLENBQUE7SUFFQSxJQUFLQyxDQUFBQSxPQUFMLEdBQWUsRUFBZixDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsWUFBTCxHQUFvQixJQUFwQixDQUFBO0FBQ0gsR0FBQTs7QUF4QlUsQ0FBQTs7QUFtQ2YsU0FBU0MsY0FBVCxDQUF3QkMsTUFBeEIsRUFBZ0NDLFFBQWhDLEVBQTBDO0FBQ3RDLEVBQUEsTUFBTUMsSUFBSSxHQUFHLElBQUlDLElBQUosQ0FBU0gsTUFBVCxDQUFiLENBQUE7QUFFQUUsRUFBQUEsSUFBSSxDQUFDRSxZQUFMLENBQWtCSCxRQUFRLENBQUNWLFNBQTNCLENBQUEsQ0FBQTtBQUNBVyxFQUFBQSxJQUFJLENBQUNHLFVBQUwsQ0FBZ0JKLFFBQVEsQ0FBQ1QsT0FBekIsQ0FBQSxDQUFBO0FBQ0FVLEVBQUFBLElBQUksQ0FBQ0ksV0FBTCxDQUFpQkwsUUFBUSxDQUFDUCxNQUExQixDQUFBLENBQUE7QUFDQVEsRUFB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LElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0NnVCxPQUFwQyxDQUFBO1FBQ0FwUyxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0NpVCxPQUFwQyxDQUFBO1FBQ0FyUyxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0NrVCxPQUFwQyxDQUFBO1FBQ0F0UyxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0MsR0FBcEMsQ0FBQTtRQUVBWSxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0NnVCxPQUFwQyxDQUFBO1FBQ0FwUyxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0NpVCxPQUFwQyxDQUFBO1FBQ0FyUyxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0NrVCxPQUFwQyxDQUFBO1FBQ0F0UyxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0MsR0FBcEMsQ0FBQTtRQUVBWSxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0NnVCxPQUFwQyxDQUFBO1FBQ0FwUyxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUksR0FBRyxDQUFQLEdBQVcsQ0FBWCxHQUFlLENBQS9CLENBQUEsR0FBb0NpVCxPQUFwQyxDQUFBO1FBQ0FyUyxRQUFRLENBQUNQLE1BQVQsQ0FBZ0JMLElBQUks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
