/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { PIXELFORMAT_R8_G8_B8_A8 } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { BLEND_PREMULTIPLIED, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED } from '../../../scene/constants.js';
import { StandardMaterial } from '../../../scene/materials/standard-material.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ELEMENTTYPE_IMAGE, ELEMENTTYPE_TEXT } from './constants.js';
import { ElementComponent } from './component.js';
import { ElementComponentData } from './data.js';

const _schema = ['enabled'];

class ElementComponentSystem extends ComponentSystem {
  constructor(app) {
    super(app);
    this.id = 'element';
    this.ComponentType = ElementComponent;
    this.DataType = ElementComponentData;
    this.schema = _schema;
    this._unicodeConverter = null;
    this._rtlReorder = null;

    this._defaultTexture = new Texture(app.graphicsDevice, {
      width: 1,
      height: 1,
      format: PIXELFORMAT_R8_G8_B8_A8,
      name: 'element-system'
    });
    const pixels = this._defaultTexture.lock();
    const pixelData = new Uint8Array(4);
    pixelData[0] = 255.0;
    pixelData[1] = 255.0;
    pixelData[2] = 255.0;
    pixelData[3] = 255.0;
    pixels.set(pixelData);
    this._defaultTexture.unlock();

    this.defaultImageMaterial = null;
    this.defaultImage9SlicedMaterial = null;
    this.defaultImage9TiledMaterial = null;
    this.defaultImageMaskMaterial = null;
    this.defaultImage9SlicedMaskMaterial = null;
    this.defaultImage9TiledMaskMaterial = null;
    this.defaultScreenSpaceImageMaterial = null;
    this.defaultScreenSpaceImage9SlicedMaterial = null;
    this.defaultScreenSpaceImage9TiledMaterial = null;
    this.defaultScreenSpaceImageMask9SlicedMaterial = null;
    this.defaultScreenSpaceImageMask9TiledMaterial = null;
    this.defaultScreenSpaceImageMaskMaterial = null;

    this._defaultTextMaterials = {};
    this.defaultImageMaterials = [];
    this.on('beforeremove', this.onRemoveComponent, this);
  }
  destroy() {
    super.destroy();
    this._defaultTexture.destroy();
  }
  initializeComponentData(component, data, properties) {
    component._beingInitialized = true;
    if (data.anchor !== undefined) {
      if (data.anchor instanceof Vec4) {
        component.anchor.copy(data.anchor);
      } else {
        component.anchor.set(data.anchor[0], data.anchor[1], data.anchor[2], data.anchor[3]);
      }
    }
    if (data.pivot !== undefined) {
      if (data.pivot instanceof Vec2) {
        component.pivot.copy(data.pivot);
      } else {
        component.pivot.set(data.pivot[0], data.pivot[1]);
      }
    }
    const splitHorAnchors = Math.abs(component.anchor.x - component.anchor.z) > 0.001;
    const splitVerAnchors = Math.abs(component.anchor.y - component.anchor.w) > 0.001;
    let _marginChange = false;
    let color;
    if (data.margin !== undefined) {
      if (data.margin instanceof Vec4) {
        component.margin.copy(data.margin);
      } else {
        component._margin.set(data.margin[0], data.margin[1], data.margin[2], data.margin[3]);
      }
      _marginChange = true;
    }
    if (data.left !== undefined) {
      component._margin.x = data.left;
      _marginChange = true;
    }
    if (data.bottom !== undefined) {
      component._margin.y = data.bottom;
      _marginChange = true;
    }
    if (data.right !== undefined) {
      component._margin.z = data.right;
      _marginChange = true;
    }
    if (data.top !== undefined) {
      component._margin.w = data.top;
      _marginChange = true;
    }
    if (_marginChange) {
      component.margin = component._margin;
    }
    let shouldForceSetAnchor = false;
    if (data.width !== undefined && !splitHorAnchors) {
      component.width = data.width;
    } else if (splitHorAnchors) {
      shouldForceSetAnchor = true;
    }
    if (data.height !== undefined && !splitVerAnchors) {
      component.height = data.height;
    } else if (splitVerAnchors) {
      shouldForceSetAnchor = true;
    }
    if (shouldForceSetAnchor) {
      component.anchor = component.anchor;
    }

    if (data.enabled !== undefined) {
      component.enabled = data.enabled;
    }
    if (data.useInput !== undefined) {
      component.useInput = data.useInput;
    }
    if (data.fitMode !== undefined) {
      component.fitMode = data.fitMode;
    }
    component.batchGroupId = data.batchGroupId === undefined || data.batchGroupId === null ? -1 : data.batchGroupId;
    if (data.layers && Array.isArray(data.layers)) {
      component.layers = data.layers.slice(0);
    }
    if (data.type !== undefined) {
      component.type = data.type;
    }
    if (component.type === ELEMENTTYPE_IMAGE) {
      if (data.rect !== undefined) {
        component.rect = data.rect;
      }
      if (data.color !== undefined) {
        color = data.color;
        if (!(color instanceof Color)) {
          color = new Color(data.color[0], data.color[1], data.color[2]);
        }
        component.color = color;
      }
      if (data.opacity !== undefined) component.opacity = data.opacity;
      if (data.textureAsset !== undefined) component.textureAsset = data.textureAsset;
      if (data.texture) component.texture = data.texture;
      if (data.spriteAsset !== undefined) component.spriteAsset = data.spriteAsset;
      if (data.sprite) component.sprite = data.sprite;
      if (data.spriteFrame !== undefined) component.spriteFrame = data.spriteFrame;
      if (data.pixelsPerUnit !== undefined && data.pixelsPerUnit !== null) component.pixelsPerUnit = data.pixelsPerUnit;
      if (data.materialAsset !== undefined) component.materialAsset = data.materialAsset;
      if (data.material) component.material = data.material;
      if (data.mask !== undefined) {
        component.mask = data.mask;
      }
    } else if (component.type === ELEMENTTYPE_TEXT) {
      if (data.autoWidth !== undefined) component.autoWidth = data.autoWidth;
      if (data.autoHeight !== undefined) component.autoHeight = data.autoHeight;
      if (data.rtlReorder !== undefined) component.rtlReorder = data.rtlReorder;
      if (data.unicodeConverter !== undefined) component.unicodeConverter = data.unicodeConverter;
      if (data.text !== null && data.text !== undefined) {
        component.text = data.text;
      } else if (data.key !== null && data.key !== undefined) {
        component.key = data.key;
      }
      if (data.color !== undefined) {
        color = data.color;
        if (!(color instanceof Color)) {
          color = new Color(color[0], color[1], color[2]);
        }
        component.color = color;
      }
      if (data.opacity !== undefined) {
        component.opacity = data.opacity;
      }
      if (data.spacing !== undefined) component.spacing = data.spacing;
      if (data.fontSize !== undefined) {
        component.fontSize = data.fontSize;
        if (!data.lineHeight) component.lineHeight = data.fontSize;
      }
      if (data.lineHeight !== undefined) component.lineHeight = data.lineHeight;
      if (data.maxLines !== undefined) component.maxLines = data.maxLines;
      if (data.wrapLines !== undefined) component.wrapLines = data.wrapLines;
      if (data.minFontSize !== undefined) component.minFontSize = data.minFontSize;
      if (data.maxFontSize !== undefined) component.maxFontSize = data.maxFontSize;
      if (data.autoFitWidth) component.autoFitWidth = data.autoFitWidth;
      if (data.autoFitHeight) component.autoFitHeight = data.autoFitHeight;
      if (data.fontAsset !== undefined) component.fontAsset = data.fontAsset;
      if (data.font !== undefined) component.font = data.font;
      if (data.alignment !== undefined) component.alignment = data.alignment;
      if (data.outlineColor !== undefined) component.outlineColor = data.outlineColor;
      if (data.outlineThickness !== undefined) component.outlineThickness = data.outlineThickness;
      if (data.shadowColor !== undefined) component.shadowColor = data.shadowColor;
      if (data.shadowOffset !== undefined) component.shadowOffset = data.shadowOffset;
      if (data.enableMarkup !== undefined) component.enableMarkup = data.enableMarkup;
    }

    const result = component._parseUpToScreen();
    if (result.screen) {
      component._updateScreen(result.screen);
    }
    super.initializeComponentData(component, data, properties);
    component._beingInitialized = false;
    if (component.type === ELEMENTTYPE_IMAGE && component._image._meshDirty) {
      component._image._updateMesh(component._image.mesh);
    }
  }
  onRemoveComponent(entity, component) {
    component.onRemove();
  }
  cloneComponent(entity, clone) {
    const source = entity.element;
    const data = {
      enabled: source.enabled,
      width: source.width,
      height: source.height,
      anchor: source.anchor.clone(),
      pivot: source.pivot.clone(),
      margin: source.margin.clone(),
      alignment: source.alignment && source.alignment.clone() || source.alignment,
      autoWidth: source.autoWidth,
      autoHeight: source.autoHeight,
      type: source.type,
      rect: source.rect && source.rect.clone() || source.rect,
      rtlReorder: source.rtlReorder,
      unicodeConverter: source.unicodeConverter,
      materialAsset: source.materialAsset,
      material: source.material,
      color: source.color && source.color.clone() || source.color,
      opacity: source.opacity,
      textureAsset: source.textureAsset,
      texture: source.texture,
      spriteAsset: source.spriteAsset,
      sprite: source.sprite,
      spriteFrame: source.spriteFrame,
      pixelsPerUnit: source.pixelsPerUnit,
      spacing: source.spacing,
      lineHeight: source.lineHeight,
      wrapLines: source.wrapLines,
      layers: source.layers,
      fontSize: source.fontSize,
      minFontSize: source.minFontSize,
      maxFontSize: source.maxFontSize,
      autoFitWidth: source.autoFitWidth,
      autoFitHeight: source.autoFitHeight,
      maxLines: source.maxLines,
      fontAsset: source.fontAsset,
      font: source.font,
      useInput: source.useInput,
      fitMode: source.fitMode,
      batchGroupId: source.batchGroupId,
      mask: source.mask,
      outlineColor: source.outlineColor && source.outlineColor.clone() || source.outlineColor,
      outlineThickness: source.outlineThickness,
      shadowColor: source.shadowColor && source.shadowColor.clone() || source.shadowColor,
      shadowOffset: source.shadowOffset && source.shadowOffset.clone() || source.shadowOffset,
      enableMarkup: source.enableMarkup
    };
    if (source.key !== undefined && source.key !== null) {
      data.key = source.key;
    } else {
      data.text = source.text;
    }
    return this.addComponent(clone, data);
  }
  getTextElementMaterial(screenSpace, msdf, textAttibutes) {
    const hash = (screenSpace && 1 << 0) | (msdf && 1 << 1) | (textAttibutes && 1 << 2);
    let material = this._defaultTextMaterials[hash];
    if (material) {
      return material;
    }
    let name = "TextMaterial";
    material = new StandardMaterial();
    if (msdf) {
      material.msdfMap = this._defaultTexture;
      material.msdfTextAttribute = textAttibutes;
      material.emissive.set(1, 1, 1);
    } else {
      name = "Bitmap" + name;
      material.emissive.set(0.5, 0.5, 0.5);
      material.emissiveMap = this._defaultTexture;
      material.emissiveTint = true;
      material.opacityMap = this._defaultTexture;
      material.opacityMapChannel = 'a';
    }
    if (screenSpace) {
      name = 'ScreenSpace' + name;
      material.depthTest = false;
    }

    material.name = 'default' + name;
    material.useLighting = false;
    material.useGammaTonemap = false;
    material.useFog = false;
    material.useSkybox = false;
    material.diffuse.set(0, 0, 0);
    material.opacity = 0.5;
    material.blendType = BLEND_PREMULTIPLIED;
    material.depthWrite = false;
    material.emissiveVertexColor = true;
    material.update();
    this._defaultTextMaterials[hash] = material;
    return material;
  }
  _createBaseImageMaterial() {
    const material = new StandardMaterial();
    material.diffuse.set(0, 0, 0);
    material.emissive.set(0.5, 0.5, 0.5);
    material.emissiveMap = this._defaultTexture;
    material.emissiveTint = true;
    material.opacityMap = this._defaultTexture;
    material.opacityMapChannel = 'a';
    material.opacityTint = true;
    material.opacity = 0;
    material.useLighting = false;
    material.useGammaTonemap = false;
    material.useFog = false;
    material.useSkybox = false;
    material.blendType = BLEND_PREMULTIPLIED;
    material.depthWrite = false;
    return material;
  }
  getImageElementMaterial(screenSpace, mask, nineSliced, nineSliceTiled) {
    if (screenSpace) {
      if (mask) {
        if (nineSliced) {
          if (!this.defaultScreenSpaceImageMask9SlicedMaterial) {
            this.defaultScreenSpaceImageMask9SlicedMaterial = this._createBaseImageMaterial();
            this.defaultScreenSpaceImageMask9SlicedMaterial.name = 'defaultScreenSpaceImageMask9SlicedMaterial';
            this.defaultScreenSpaceImageMask9SlicedMaterial.nineSlicedMode = SPRITE_RENDERMODE_SLICED;
            this.defaultScreenSpaceImageMask9SlicedMaterial.depthTest = false;
            this.defaultScreenSpaceImageMask9SlicedMaterial.alphaTest = 1;
            this.defaultScreenSpaceImageMask9SlicedMaterial.redWrite = false;
            this.defaultScreenSpaceImageMask9SlicedMaterial.greenWrite = false;
            this.defaultScreenSpaceImageMask9SlicedMaterial.blueWrite = false;
            this.defaultScreenSpaceImageMask9SlicedMaterial.alphaWrite = false;
            this.defaultScreenSpaceImageMask9SlicedMaterial.update();
            this.defaultImageMaterials.push(this.defaultScreenSpaceImageMask9SlicedMaterial);
          }
          return this.defaultScreenSpaceImageMask9SlicedMaterial;
        } else if (nineSliceTiled) {
          if (!this.defaultScreenSpaceImageMask9TiledMaterial) {
            this.defaultScreenSpaceImageMask9TiledMaterial = this.defaultScreenSpaceImage9TiledMaterial.clone();
            this.defaultScreenSpaceImageMask9TiledMaterial.name = 'defaultScreenSpaceImageMask9TiledMaterial';
            this.defaultScreenSpaceImageMask9TiledMaterial.nineSlicedMode = SPRITE_RENDERMODE_TILED;
            this.defaultScreenSpaceImageMask9TiledMaterial.depthTest = false;
            this.defaultScreenSpaceImageMask9TiledMaterial.alphaTest = 1;
            this.defaultScreenSpaceImageMask9TiledMaterial.redWrite = false;
            this.defaultScreenSpaceImageMask9TiledMaterial.greenWrite = false;
            this.defaultScreenSpaceImageMask9TiledMaterial.blueWrite = false;
            this.defaultScreenSpaceImageMask9TiledMaterial.alphaWrite = false;
            this.defaultScreenSpaceImageMask9TiledMaterial.update();
            this.defaultImageMaterials.push(this.defaultScreenSpaceImageMask9TiledMaterial);
          }
          return this.defaultScreenSpaceImageMask9TiledMaterial;
        } else {
          if (!this.defaultScreenSpaceImageMaskMaterial) {
            this.defaultScreenSpaceImageMaskMaterial = this._createBaseImageMaterial();
            this.defaultScreenSpaceImageMaskMaterial.name = 'defaultScreenSpaceImageMaskMaterial';
            this.defaultScreenSpaceImageMaskMaterial.depthTest = false;
            this.defaultScreenSpaceImageMaskMaterial.alphaTest = 1;
            this.defaultScreenSpaceImageMaskMaterial.redWrite = false;
            this.defaultScreenSpaceImageMaskMaterial.greenWrite = false;
            this.defaultScreenSpaceImageMaskMaterial.blueWrite = false;
            this.defaultScreenSpaceImageMaskMaterial.alphaWrite = false;
            this.defaultScreenSpaceImageMaskMaterial.update();
            this.defaultImageMaterials.push(this.defaultScreenSpaceImageMaskMaterial);
          }
          return this.defaultScreenSpaceImageMaskMaterial;
        }
      } else {
        if (nineSliced) {
          if (!this.defaultScreenSpaceImage9SlicedMaterial) {
            this.defaultScreenSpaceImage9SlicedMaterial = this._createBaseImageMaterial();
            this.defaultScreenSpaceImage9SlicedMaterial.name = 'defaultScreenSpaceImage9SlicedMaterial';
            this.defaultScreenSpaceImage9SlicedMaterial.nineSlicedMode = SPRITE_RENDERMODE_SLICED;
            this.defaultScreenSpaceImage9SlicedMaterial.depthTest = false;
            this.defaultScreenSpaceImage9SlicedMaterial.update();
            this.defaultImageMaterials.push(this.defaultScreenSpaceImage9SlicedMaterial);
          }
          return this.defaultScreenSpaceImage9SlicedMaterial;
        } else if (nineSliceTiled) {
          if (!this.defaultScreenSpaceImage9TiledMaterial) {
            this.defaultScreenSpaceImage9TiledMaterial = this._createBaseImageMaterial();
            this.defaultScreenSpaceImage9TiledMaterial.name = 'defaultScreenSpaceImage9TiledMaterial';
            this.defaultScreenSpaceImage9TiledMaterial.nineSlicedMode = SPRITE_RENDERMODE_TILED;
            this.defaultScreenSpaceImage9TiledMaterial.depthTest = false;
            this.defaultScreenSpaceImage9TiledMaterial.update();
            this.defaultImageMaterials.push(this.defaultScreenSpaceImage9TiledMaterial);
          }
          return this.defaultScreenSpaceImage9TiledMaterial;
        } else {
          if (!this.defaultScreenSpaceImageMaterial) {
            this.defaultScreenSpaceImageMaterial = this._createBaseImageMaterial();
            this.defaultScreenSpaceImageMaterial.name = 'defaultScreenSpaceImageMaterial';
            this.defaultScreenSpaceImageMaterial.depthTest = false;
            this.defaultScreenSpaceImageMaterial.update();
            this.defaultImageMaterials.push(this.defaultScreenSpaceImageMaterial);
          }
          return this.defaultScreenSpaceImageMaterial;
        }
      }
    } else {
      if (mask) {
        if (nineSliced) {
          if (!this.defaultImage9SlicedMaskMaterial) {
            this.defaultImage9SlicedMaskMaterial = this._createBaseImageMaterial();
            this.defaultImage9SlicedMaskMaterial.name = 'defaultImage9SlicedMaskMaterial';
            this.defaultImage9SlicedMaskMaterial.nineSlicedMode = SPRITE_RENDERMODE_SLICED;
            this.defaultImage9SlicedMaskMaterial.alphaTest = 1;
            this.defaultImage9SlicedMaskMaterial.redWrite = false;
            this.defaultImage9SlicedMaskMaterial.greenWrite = false;
            this.defaultImage9SlicedMaskMaterial.blueWrite = false;
            this.defaultImage9SlicedMaskMaterial.alphaWrite = false;
            this.defaultImage9SlicedMaskMaterial.update();
            this.defaultImageMaterials.push(this.defaultImage9SlicedMaskMaterial);
          }
          return this.defaultImage9SlicedMaskMaterial;
        } else if (nineSliceTiled) {
          if (!this.defaultImage9TiledMaskMaterial) {
            this.defaultImage9TiledMaskMaterial = this._createBaseImageMaterial();
            this.defaultImage9TiledMaskMaterial.name = 'defaultImage9TiledMaskMaterial';
            this.defaultImage9TiledMaskMaterial.nineSlicedMode = SPRITE_RENDERMODE_TILED;
            this.defaultImage9TiledMaskMaterial.alphaTest = 1;
            this.defaultImage9TiledMaskMaterial.redWrite = false;
            this.defaultImage9TiledMaskMaterial.greenWrite = false;
            this.defaultImage9TiledMaskMaterial.blueWrite = false;
            this.defaultImage9TiledMaskMaterial.alphaWrite = false;
            this.defaultImage9TiledMaskMaterial.update();
            this.defaultImageMaterials.push(this.defaultImage9TiledMaskMaterial);
          }
          return this.defaultImage9TiledMaskMaterial;
        } else {
          if (!this.defaultImageMaskMaterial) {
            this.defaultImageMaskMaterial = this._createBaseImageMaterial();
            this.defaultImageMaskMaterial.name = 'defaultImageMaskMaterial';
            this.defaultImageMaskMaterial.alphaTest = 1;
            this.defaultImageMaskMaterial.redWrite = false;
            this.defaultImageMaskMaterial.greenWrite = false;
            this.defaultImageMaskMaterial.blueWrite = false;
            this.defaultImageMaskMaterial.alphaWrite = false;
            this.defaultImageMaskMaterial.update();
            this.defaultImageMaterials.push(this.defaultImageMaskMaterial);
          }
          return this.defaultImageMaskMaterial;
        }
      } else {
        if (nineSliced) {
          if (!this.defaultImage9SlicedMaterial) {
            this.defaultImage9SlicedMaterial = this._createBaseImageMaterial();
            this.defaultImage9SlicedMaterial.name = 'defaultImage9SlicedMaterial';
            this.defaultImage9SlicedMaterial.nineSlicedMode = SPRITE_RENDERMODE_SLICED;
            this.defaultImage9SlicedMaterial.update();
            this.defaultImageMaterials.push(this.defaultImage9SlicedMaterial);
          }
          return this.defaultImage9SlicedMaterial;
        } else if (nineSliceTiled) {
          if (!this.defaultImage9TiledMaterial) {
            this.defaultImage9TiledMaterial = this._createBaseImageMaterial();
            this.defaultImage9TiledMaterial.name = 'defaultImage9TiledMaterial';
            this.defaultImage9TiledMaterial.nineSlicedMode = SPRITE_RENDERMODE_TILED;
            this.defaultImage9TiledMaterial.update();
            this.defaultImageMaterials.push(this.defaultImage9TiledMaterial);
          }
          return this.defaultImage9TiledMaterial;
        } else {
          if (!this.defaultImageMaterial) {
            this.defaultImageMaterial = this._createBaseImageMaterial();
            this.defaultImageMaterial.name = 'defaultImageMaterial';
            this.defaultImageMaterial.update();
            this.defaultImageMaterials.push(this.defaultImageMaterial);
          }
          return this.defaultImageMaterial;
        }
      }
    }
  }

  registerUnicodeConverter(func) {
    this._unicodeConverter = func;
  }
  registerRtlReorder(func) {
    this._rtlReorder = func;
  }
  getUnicodeConverter() {
    return this._unicodeConverter;
  }
  getRtlReorder() {
    return this._rtlReorder;
  }
}
Component._buildAccessors(ElementComponent.prototype, _schema);

export { ElementComponentSystem };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgUElYRUxGT1JNQVRfUjhfRzhfQjhfQThcbn0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcblxuaW1wb3J0IHsgQkxFTkRfUFJFTVVMVElQTElFRCwgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IEVMRU1FTlRUWVBFX0lNQUdFLCBFTEVNRU5UVFlQRV9URVhUIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRWxlbWVudENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IEVsZW1lbnRDb21wb25lbnREYXRhIH0gZnJvbSAnLi9kYXRhLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gQXBwQmFzZSAqL1xuXG5jb25zdCBfc2NoZW1hID0gWydlbmFibGVkJ107XG5cbi8qKlxuICogTWFuYWdlcyBjcmVhdGlvbiBvZiB7QGxpbmsgRWxlbWVudENvbXBvbmVudH1zLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRTeXN0ZW1cbiAqL1xuY2xhc3MgRWxlbWVudENvbXBvbmVudFN5c3RlbSBleHRlbmRzIENvbXBvbmVudFN5c3RlbSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEVsZW1lbnRDb21wb25lbnRTeXN0ZW0gaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdlbGVtZW50JztcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBFbGVtZW50Q29tcG9uZW50O1xuICAgICAgICB0aGlzLkRhdGFUeXBlID0gRWxlbWVudENvbXBvbmVudERhdGE7XG5cbiAgICAgICAgdGhpcy5zY2hlbWEgPSBfc2NoZW1hO1xuICAgICAgICB0aGlzLl91bmljb2RlQ29udmVydGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fcnRsUmVvcmRlciA9IG51bGw7XG5cbiAgICAgICAgLy8gZGVmYXVsdCB0ZXh0dXJlIC0gbWFrZSB3aGl0ZSBzbyB3ZSBjYW4gdGludCBpdCB3aXRoIGVtaXNzaXZlIGNvbG9yXG4gICAgICAgIHRoaXMuX2RlZmF1bHRUZXh0dXJlID0gbmV3IFRleHR1cmUoYXBwLmdyYXBoaWNzRGV2aWNlLCB7XG4gICAgICAgICAgICB3aWR0aDogMSxcbiAgICAgICAgICAgIGhlaWdodDogMSxcbiAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsXG4gICAgICAgICAgICBuYW1lOiAnZWxlbWVudC1zeXN0ZW0nXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBwaXhlbHMgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZS5sb2NrKCk7XG4gICAgICAgIGNvbnN0IHBpeGVsRGF0YSA9IG5ldyBVaW50OEFycmF5KDQpO1xuICAgICAgICBwaXhlbERhdGFbMF0gPSAyNTUuMDtcbiAgICAgICAgcGl4ZWxEYXRhWzFdID0gMjU1LjA7XG4gICAgICAgIHBpeGVsRGF0YVsyXSA9IDI1NS4wO1xuICAgICAgICBwaXhlbERhdGFbM10gPSAyNTUuMDtcbiAgICAgICAgcGl4ZWxzLnNldChwaXhlbERhdGEpO1xuICAgICAgICB0aGlzLl9kZWZhdWx0VGV4dHVyZS51bmxvY2soKTtcblxuICAgICAgICAvLyBpbWFnZSBlbGVtZW50IG1hdGVyaWFscyBjcmVhdGVkIG9uIGRlbWFuZCBieSBnZXRJbWFnZUVsZW1lbnRNYXRlcmlhbCgpXG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgIC8vIHRleHQgZWxlbWVudCBtYXRlcmlhbHMgY3JlYXRlZCBvbiBkZW1hbmQgYnkgZ2V0VGV4dEVsZW1lbnRNYXRlcmlhbCgpXG4gICAgICAgIHRoaXMuX2RlZmF1bHRUZXh0TWF0ZXJpYWxzID0ge307XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMgPSBbXTtcblxuICAgICAgICB0aGlzLm9uKCdiZWZvcmVyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlQ29tcG9uZW50LCB0aGlzKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5fZGVmYXVsdFRleHR1cmUuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcykge1xuICAgICAgICBjb21wb25lbnQuX2JlaW5nSW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgICAgIGlmIChkYXRhLmFuY2hvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5hbmNob3IgaW5zdGFuY2VvZiBWZWM0KSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmFuY2hvci5jb3B5KGRhdGEuYW5jaG9yKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmFuY2hvci5zZXQoZGF0YS5hbmNob3JbMF0sIGRhdGEuYW5jaG9yWzFdLCBkYXRhLmFuY2hvclsyXSwgZGF0YS5hbmNob3JbM10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEucGl2b3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGRhdGEucGl2b3QgaW5zdGFuY2VvZiBWZWMyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnBpdm90LmNvcHkoZGF0YS5waXZvdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5waXZvdC5zZXQoZGF0YS5waXZvdFswXSwgZGF0YS5waXZvdFsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcGxpdEhvckFuY2hvcnMgPSBNYXRoLmFicyhjb21wb25lbnQuYW5jaG9yLnggLSBjb21wb25lbnQuYW5jaG9yLnopID4gMC4wMDE7XG4gICAgICAgIGNvbnN0IHNwbGl0VmVyQW5jaG9ycyA9IE1hdGguYWJzKGNvbXBvbmVudC5hbmNob3IueSAtIGNvbXBvbmVudC5hbmNob3IudykgPiAwLjAwMTtcbiAgICAgICAgbGV0IF9tYXJnaW5DaGFuZ2UgPSBmYWxzZTtcbiAgICAgICAgbGV0IGNvbG9yO1xuXG4gICAgICAgIGlmIChkYXRhLm1hcmdpbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5tYXJnaW4gaW5zdGFuY2VvZiBWZWM0KSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Lm1hcmdpbi5jb3B5KGRhdGEubWFyZ2luKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4uc2V0KGRhdGEubWFyZ2luWzBdLCBkYXRhLm1hcmdpblsxXSwgZGF0YS5tYXJnaW5bMl0sIGRhdGEubWFyZ2luWzNdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX21hcmdpbkNoYW5nZSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5sZWZ0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5fbWFyZ2luLnggPSBkYXRhLmxlZnQ7XG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS5ib3R0b20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4ueSA9IGRhdGEuYm90dG9tO1xuICAgICAgICAgICAgX21hcmdpbkNoYW5nZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEucmlnaHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4ueiA9IGRhdGEucmlnaHQ7XG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS50b3AgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4udyA9IGRhdGEudG9wO1xuICAgICAgICAgICAgX21hcmdpbkNoYW5nZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKF9tYXJnaW5DaGFuZ2UpIHtcbiAgICAgICAgICAgIC8vIGZvcmNlIHVwZGF0ZVxuICAgICAgICAgICAgY29tcG9uZW50Lm1hcmdpbiA9IGNvbXBvbmVudC5fbWFyZ2luO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHNob3VsZEZvcmNlU2V0QW5jaG9yID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGRhdGEud2lkdGggIT09IHVuZGVmaW5lZCAmJiAhc3BsaXRIb3JBbmNob3JzKSB7XG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIGNvbXBvbmVudC53aWR0aCA9IGRhdGEud2lkdGg7XG4gICAgICAgIH0gZWxzZSBpZiAoc3BsaXRIb3JBbmNob3JzKSB7XG4gICAgICAgICAgICBzaG91bGRGb3JjZVNldEFuY2hvciA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEuaGVpZ2h0ICE9PSB1bmRlZmluZWQgJiYgIXNwbGl0VmVyQW5jaG9ycykge1xuICAgICAgICAgICAgLy8gZm9yY2UgdXBkYXRlXG4gICAgICAgICAgICBjb21wb25lbnQuaGVpZ2h0ID0gZGF0YS5oZWlnaHQ7XG4gICAgICAgIH0gZWxzZSBpZiAoc3BsaXRWZXJBbmNob3JzKSB7XG4gICAgICAgICAgICBzaG91bGRGb3JjZVNldEFuY2hvciA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2hvdWxkRm9yY2VTZXRBbmNob3IpIHtcbiAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIGNvbXBvbmVudC5hbmNob3IgPSBjb21wb25lbnQuYW5jaG9yO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEuZW5hYmxlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuZW5hYmxlZCA9IGRhdGEuZW5hYmxlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkYXRhLnVzZUlucHV0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC51c2VJbnB1dCA9IGRhdGEudXNlSW5wdXQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5maXRNb2RlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5maXRNb2RlID0gZGF0YS5maXRNb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50LmJhdGNoR3JvdXBJZCA9IGRhdGEuYmF0Y2hHcm91cElkID09PSB1bmRlZmluZWQgfHwgZGF0YS5iYXRjaEdyb3VwSWQgPT09IG51bGwgPyAtMSA6IGRhdGEuYmF0Y2hHcm91cElkO1xuXG4gICAgICAgIGlmIChkYXRhLmxheWVycyAmJiBBcnJheS5pc0FycmF5KGRhdGEubGF5ZXJzKSkge1xuICAgICAgICAgICAgY29tcG9uZW50LmxheWVycyA9IGRhdGEubGF5ZXJzLnNsaWNlKDApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEudHlwZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQudHlwZSA9IGRhdGEudHlwZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb21wb25lbnQudHlwZSA9PT0gRUxFTUVOVFRZUEVfSU1BR0UpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLnJlY3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5yZWN0ID0gZGF0YS5yZWN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEuY29sb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbG9yID0gZGF0YS5jb2xvcjtcbiAgICAgICAgICAgICAgICBpZiAoIShjb2xvciBpbnN0YW5jZW9mIENvbG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb2xvciA9IG5ldyBDb2xvcihkYXRhLmNvbG9yWzBdLCBkYXRhLmNvbG9yWzFdLCBkYXRhLmNvbG9yWzJdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmNvbG9yID0gY29sb3I7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkYXRhLm9wYWNpdHkgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm9wYWNpdHkgPSBkYXRhLm9wYWNpdHk7XG4gICAgICAgICAgICBpZiAoZGF0YS50ZXh0dXJlQXNzZXQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnRleHR1cmVBc3NldCA9IGRhdGEudGV4dHVyZUFzc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEudGV4dHVyZSkgY29tcG9uZW50LnRleHR1cmUgPSBkYXRhLnRleHR1cmU7XG4gICAgICAgICAgICBpZiAoZGF0YS5zcHJpdGVBc3NldCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuc3ByaXRlQXNzZXQgPSBkYXRhLnNwcml0ZUFzc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEuc3ByaXRlKSBjb21wb25lbnQuc3ByaXRlID0gZGF0YS5zcHJpdGU7XG4gICAgICAgICAgICBpZiAoZGF0YS5zcHJpdGVGcmFtZSAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuc3ByaXRlRnJhbWUgPSBkYXRhLnNwcml0ZUZyYW1lO1xuICAgICAgICAgICAgaWYgKGRhdGEucGl4ZWxzUGVyVW5pdCAhPT0gdW5kZWZpbmVkICYmIGRhdGEucGl4ZWxzUGVyVW5pdCAhPT0gbnVsbCkgY29tcG9uZW50LnBpeGVsc1BlclVuaXQgPSBkYXRhLnBpeGVsc1BlclVuaXQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5tYXRlcmlhbEFzc2V0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5tYXRlcmlhbEFzc2V0ID0gZGF0YS5tYXRlcmlhbEFzc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEubWF0ZXJpYWwpIGNvbXBvbmVudC5tYXRlcmlhbCA9IGRhdGEubWF0ZXJpYWw7XG5cbiAgICAgICAgICAgIGlmIChkYXRhLm1hc2sgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5tYXNrID0gZGF0YS5tYXNrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNvbXBvbmVudC50eXBlID09PSBFTEVNRU5UVFlQRV9URVhUKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5hdXRvV2lkdGggIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmF1dG9XaWR0aCA9IGRhdGEuYXV0b1dpZHRoO1xuICAgICAgICAgICAgaWYgKGRhdGEuYXV0b0hlaWdodCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuYXV0b0hlaWdodCA9IGRhdGEuYXV0b0hlaWdodDtcbiAgICAgICAgICAgIGlmIChkYXRhLnJ0bFJlb3JkZXIgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnJ0bFJlb3JkZXIgPSBkYXRhLnJ0bFJlb3JkZXI7XG4gICAgICAgICAgICBpZiAoZGF0YS51bmljb2RlQ29udmVydGVyICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC51bmljb2RlQ29udmVydGVyID0gZGF0YS51bmljb2RlQ29udmVydGVyO1xuICAgICAgICAgICAgaWYgKGRhdGEudGV4dCAhPT0gbnVsbCAmJiBkYXRhLnRleHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC50ZXh0ID0gZGF0YS50ZXh0O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLmtleSAhPT0gbnVsbCAmJiBkYXRhLmtleSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmtleSA9IGRhdGEua2V5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEuY29sb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbG9yID0gZGF0YS5jb2xvcjtcbiAgICAgICAgICAgICAgICBpZiAoIShjb2xvciBpbnN0YW5jZW9mIENvbG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb2xvciA9IG5ldyBDb2xvcihjb2xvclswXSwgY29sb3JbMV0sIGNvbG9yWzJdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmNvbG9yID0gY29sb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YS5vcGFjaXR5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQub3BhY2l0eSA9IGRhdGEub3BhY2l0eTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkYXRhLnNwYWNpbmcgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnNwYWNpbmcgPSBkYXRhLnNwYWNpbmc7XG4gICAgICAgICAgICBpZiAoZGF0YS5mb250U2l6ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmZvbnRTaXplID0gZGF0YS5mb250U2l6ZTtcbiAgICAgICAgICAgICAgICBpZiAoIWRhdGEubGluZUhlaWdodCkgY29tcG9uZW50LmxpbmVIZWlnaHQgPSBkYXRhLmZvbnRTaXplO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEubGluZUhlaWdodCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQubGluZUhlaWdodCA9IGRhdGEubGluZUhlaWdodDtcbiAgICAgICAgICAgIGlmIChkYXRhLm1heExpbmVzICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5tYXhMaW5lcyA9IGRhdGEubWF4TGluZXM7XG4gICAgICAgICAgICBpZiAoZGF0YS53cmFwTGluZXMgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LndyYXBMaW5lcyA9IGRhdGEud3JhcExpbmVzO1xuICAgICAgICAgICAgaWYgKGRhdGEubWluRm9udFNpemUgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1pbkZvbnRTaXplID0gZGF0YS5taW5Gb250U2l6ZTtcbiAgICAgICAgICAgIGlmIChkYXRhLm1heEZvbnRTaXplICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5tYXhGb250U2l6ZSA9IGRhdGEubWF4Rm9udFNpemU7XG4gICAgICAgICAgICBpZiAoZGF0YS5hdXRvRml0V2lkdGgpIGNvbXBvbmVudC5hdXRvRml0V2lkdGggPSBkYXRhLmF1dG9GaXRXaWR0aDtcbiAgICAgICAgICAgIGlmIChkYXRhLmF1dG9GaXRIZWlnaHQpIGNvbXBvbmVudC5hdXRvRml0SGVpZ2h0ID0gZGF0YS5hdXRvRml0SGVpZ2h0O1xuICAgICAgICAgICAgaWYgKGRhdGEuZm9udEFzc2V0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5mb250QXNzZXQgPSBkYXRhLmZvbnRBc3NldDtcbiAgICAgICAgICAgIGlmIChkYXRhLmZvbnQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmZvbnQgPSBkYXRhLmZvbnQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5hbGlnbm1lbnQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmFsaWdubWVudCA9IGRhdGEuYWxpZ25tZW50O1xuICAgICAgICAgICAgaWYgKGRhdGEub3V0bGluZUNvbG9yICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5vdXRsaW5lQ29sb3IgPSBkYXRhLm91dGxpbmVDb2xvcjtcbiAgICAgICAgICAgIGlmIChkYXRhLm91dGxpbmVUaGlja25lc3MgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm91dGxpbmVUaGlja25lc3MgPSBkYXRhLm91dGxpbmVUaGlja25lc3M7XG4gICAgICAgICAgICBpZiAoZGF0YS5zaGFkb3dDb2xvciAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuc2hhZG93Q29sb3IgPSBkYXRhLnNoYWRvd0NvbG9yO1xuICAgICAgICAgICAgaWYgKGRhdGEuc2hhZG93T2Zmc2V0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zaGFkb3dPZmZzZXQgPSBkYXRhLnNoYWRvd09mZnNldDtcbiAgICAgICAgICAgIGlmIChkYXRhLmVuYWJsZU1hcmt1cCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuZW5hYmxlTWFya3VwID0gZGF0YS5lbmFibGVNYXJrdXA7XG4gICAgICAgIH1cbiAgICAgICAgLy8gT1RIRVJXSVNFOiBncm91cFxuXG4gICAgICAgIC8vIGZpbmQgc2NyZWVuXG4gICAgICAgIC8vIGRvIHRoaXMgaGVyZSBub3QgaW4gY29uc3RydWN0b3Igc28gdGhhdCBjb21wb25lbnQgaXMgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgICAgICBjb25zdCByZXN1bHQgPSBjb21wb25lbnQuX3BhcnNlVXBUb1NjcmVlbigpO1xuICAgICAgICBpZiAocmVzdWx0LnNjcmVlbikge1xuICAgICAgICAgICAgY29tcG9uZW50Ll91cGRhdGVTY3JlZW4ocmVzdWx0LnNjcmVlbik7XG4gICAgICAgIH1cblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpO1xuXG4gICAgICAgIGNvbXBvbmVudC5fYmVpbmdJbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChjb21wb25lbnQudHlwZSA9PT0gRUxFTUVOVFRZUEVfSU1BR0UgJiYgY29tcG9uZW50Ll9pbWFnZS5fbWVzaERpcnR5KSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX2ltYWdlLl91cGRhdGVNZXNoKGNvbXBvbmVudC5faW1hZ2UubWVzaCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblJlbW92ZUNvbXBvbmVudChlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBjb21wb25lbnQub25SZW1vdmUoKTtcbiAgICB9XG5cbiAgICBjbG9uZUNvbXBvbmVudChlbnRpdHksIGNsb25lKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGVudGl0eS5lbGVtZW50O1xuXG4gICAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgICAgICBlbmFibGVkOiBzb3VyY2UuZW5hYmxlZCxcbiAgICAgICAgICAgIHdpZHRoOiBzb3VyY2Uud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHNvdXJjZS5oZWlnaHQsXG4gICAgICAgICAgICBhbmNob3I6IHNvdXJjZS5hbmNob3IuY2xvbmUoKSxcbiAgICAgICAgICAgIHBpdm90OiBzb3VyY2UucGl2b3QuY2xvbmUoKSxcbiAgICAgICAgICAgIG1hcmdpbjogc291cmNlLm1hcmdpbi5jbG9uZSgpLFxuICAgICAgICAgICAgYWxpZ25tZW50OiBzb3VyY2UuYWxpZ25tZW50ICYmIHNvdXJjZS5hbGlnbm1lbnQuY2xvbmUoKSB8fCBzb3VyY2UuYWxpZ25tZW50LFxuICAgICAgICAgICAgYXV0b1dpZHRoOiBzb3VyY2UuYXV0b1dpZHRoLFxuICAgICAgICAgICAgYXV0b0hlaWdodDogc291cmNlLmF1dG9IZWlnaHQsXG4gICAgICAgICAgICB0eXBlOiBzb3VyY2UudHlwZSxcbiAgICAgICAgICAgIHJlY3Q6IHNvdXJjZS5yZWN0ICYmIHNvdXJjZS5yZWN0LmNsb25lKCkgfHwgc291cmNlLnJlY3QsXG4gICAgICAgICAgICBydGxSZW9yZGVyOiBzb3VyY2UucnRsUmVvcmRlcixcbiAgICAgICAgICAgIHVuaWNvZGVDb252ZXJ0ZXI6IHNvdXJjZS51bmljb2RlQ29udmVydGVyLFxuICAgICAgICAgICAgbWF0ZXJpYWxBc3NldDogc291cmNlLm1hdGVyaWFsQXNzZXQsXG4gICAgICAgICAgICBtYXRlcmlhbDogc291cmNlLm1hdGVyaWFsLFxuICAgICAgICAgICAgY29sb3I6IHNvdXJjZS5jb2xvciAmJiBzb3VyY2UuY29sb3IuY2xvbmUoKSB8fCBzb3VyY2UuY29sb3IsXG4gICAgICAgICAgICBvcGFjaXR5OiBzb3VyY2Uub3BhY2l0eSxcbiAgICAgICAgICAgIHRleHR1cmVBc3NldDogc291cmNlLnRleHR1cmVBc3NldCxcbiAgICAgICAgICAgIHRleHR1cmU6IHNvdXJjZS50ZXh0dXJlLFxuICAgICAgICAgICAgc3ByaXRlQXNzZXQ6IHNvdXJjZS5zcHJpdGVBc3NldCxcbiAgICAgICAgICAgIHNwcml0ZTogc291cmNlLnNwcml0ZSxcbiAgICAgICAgICAgIHNwcml0ZUZyYW1lOiBzb3VyY2Uuc3ByaXRlRnJhbWUsXG4gICAgICAgICAgICBwaXhlbHNQZXJVbml0OiBzb3VyY2UucGl4ZWxzUGVyVW5pdCxcbiAgICAgICAgICAgIHNwYWNpbmc6IHNvdXJjZS5zcGFjaW5nLFxuICAgICAgICAgICAgbGluZUhlaWdodDogc291cmNlLmxpbmVIZWlnaHQsXG4gICAgICAgICAgICB3cmFwTGluZXM6IHNvdXJjZS53cmFwTGluZXMsXG4gICAgICAgICAgICBsYXllcnM6IHNvdXJjZS5sYXllcnMsXG4gICAgICAgICAgICBmb250U2l6ZTogc291cmNlLmZvbnRTaXplLFxuICAgICAgICAgICAgbWluRm9udFNpemU6IHNvdXJjZS5taW5Gb250U2l6ZSxcbiAgICAgICAgICAgIG1heEZvbnRTaXplOiBzb3VyY2UubWF4Rm9udFNpemUsXG4gICAgICAgICAgICBhdXRvRml0V2lkdGg6IHNvdXJjZS5hdXRvRml0V2lkdGgsXG4gICAgICAgICAgICBhdXRvRml0SGVpZ2h0OiBzb3VyY2UuYXV0b0ZpdEhlaWdodCxcbiAgICAgICAgICAgIG1heExpbmVzOiBzb3VyY2UubWF4TGluZXMsXG4gICAgICAgICAgICBmb250QXNzZXQ6IHNvdXJjZS5mb250QXNzZXQsXG4gICAgICAgICAgICBmb250OiBzb3VyY2UuZm9udCxcbiAgICAgICAgICAgIHVzZUlucHV0OiBzb3VyY2UudXNlSW5wdXQsXG4gICAgICAgICAgICBmaXRNb2RlOiBzb3VyY2UuZml0TW9kZSxcbiAgICAgICAgICAgIGJhdGNoR3JvdXBJZDogc291cmNlLmJhdGNoR3JvdXBJZCxcbiAgICAgICAgICAgIG1hc2s6IHNvdXJjZS5tYXNrLFxuICAgICAgICAgICAgb3V0bGluZUNvbG9yOiBzb3VyY2Uub3V0bGluZUNvbG9yICYmIHNvdXJjZS5vdXRsaW5lQ29sb3IuY2xvbmUoKSB8fCBzb3VyY2Uub3V0bGluZUNvbG9yLFxuICAgICAgICAgICAgb3V0bGluZVRoaWNrbmVzczogc291cmNlLm91dGxpbmVUaGlja25lc3MsXG4gICAgICAgICAgICBzaGFkb3dDb2xvcjogc291cmNlLnNoYWRvd0NvbG9yICYmIHNvdXJjZS5zaGFkb3dDb2xvci5jbG9uZSgpIHx8IHNvdXJjZS5zaGFkb3dDb2xvcixcbiAgICAgICAgICAgIHNoYWRvd09mZnNldDogc291cmNlLnNoYWRvd09mZnNldCAmJiBzb3VyY2Uuc2hhZG93T2Zmc2V0LmNsb25lKCkgfHwgc291cmNlLnNoYWRvd09mZnNldCxcbiAgICAgICAgICAgIGVuYWJsZU1hcmt1cDogc291cmNlLmVuYWJsZU1hcmt1cFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChzb3VyY2Uua2V5ICE9PSB1bmRlZmluZWQgJiYgc291cmNlLmtleSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZGF0YS5rZXkgPSBzb3VyY2Uua2V5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGF0YS50ZXh0ID0gc291cmNlLnRleHQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5hZGRDb21wb25lbnQoY2xvbmUsIGRhdGEpO1xuICAgIH1cblxuICAgIGdldFRleHRFbGVtZW50TWF0ZXJpYWwoc2NyZWVuU3BhY2UsIG1zZGYsIHRleHRBdHRpYnV0ZXMpIHtcbiAgICAgICAgY29uc3QgaGFzaCA9IChzY3JlZW5TcGFjZSAmJiAoMSA8PCAwKSkgfFxuICAgICAgICAgICAgICAgICAgICAgICAgICAobXNkZiAmJiAoMSA8PCAxKSkgfFxuICAgICAgICAgICAgICAgICAodGV4dEF0dGlidXRlcyAmJiAoMSA8PCAyKSk7XG5cbiAgICAgICAgbGV0IG1hdGVyaWFsID0gdGhpcy5fZGVmYXVsdFRleHRNYXRlcmlhbHNbaGFzaF07XG5cbiAgICAgICAgaWYgKG1hdGVyaWFsKSB7XG4gICAgICAgICAgICByZXR1cm4gbWF0ZXJpYWw7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbmFtZSA9IFwiVGV4dE1hdGVyaWFsXCI7XG5cbiAgICAgICAgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuXG4gICAgICAgIGlmIChtc2RmKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5tc2RmTWFwID0gdGhpcy5fZGVmYXVsdFRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5tc2RmVGV4dEF0dHJpYnV0ZSA9IHRleHRBdHRpYnV0ZXM7XG4gICAgICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuYW1lID0gXCJCaXRtYXBcIiArIG5hbWU7XG4gICAgICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoMC41LCAwLjUsIDAuNSk7IC8vIHNldCB0byBub24tKDEsMSwxKSBzbyB0aGF0IHRpbnQgaXMgYWN0dWFsbHkgYXBwbGllZFxuICAgICAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IHRydWU7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwID0gdGhpcy5fZGVmYXVsdFRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgbmFtZSA9ICdTY3JlZW5TcGFjZScgKyBuYW1lO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgbWF0ZXJpYWwgbmFtZSBjYW4gYmU6XG4gICAgICAgIC8vICBkZWZhdWx0VGV4dE1hdGVyaWFsXG4gICAgICAgIC8vICBkZWZhdWx0Qml0bWFwVGV4dE1hdGVyaWFsXG4gICAgICAgIC8vICBkZWZhdWx0U2NyZWVuU3BhY2VUZXh0TWF0ZXJpYWxcbiAgICAgICAgLy8gIGRlZmF1bHRTY3JlZW5TcGFjZUJpdG1hcFRleHRNYXRlcmlhbFxuICAgICAgICBtYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHQnICsgbmFtZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlTGlnaHRpbmcgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlR2FtbWFUb25lbWFwID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLnVzZUZvZyA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC51c2VTa3lib3ggPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMCwgMCwgMCk7IC8vIGJsYWNrIGRpZmZ1c2UgY29sb3IgdG8gcHJldmVudCBhbWJpZW50IGxpZ2h0IGJlaW5nIGluY2x1ZGVkXG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAwLjU7XG4gICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX1BSRU1VTFRJUExJRUQ7XG4gICAgICAgIG1hdGVyaWFsLmRlcHRoV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVWZXJ0ZXhDb2xvciA9IHRydWU7XG4gICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgIHRoaXMuX2RlZmF1bHRUZXh0TWF0ZXJpYWxzW2hhc2hdID0gbWF0ZXJpYWw7XG5cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH1cblxuICAgIF9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDAsIDAsIDApOyAvLyBibGFjayBkaWZmdXNlIGNvbG9yIHRvIHByZXZlbnQgYW1iaWVudCBsaWdodCBiZWluZyBpbmNsdWRlZFxuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoMC41LCAwLjUsIDAuNSk7IC8vIHVzZSBub24td2hpdGUgdG8gY29tcGlsZSBzaGFkZXIgY29ycmVjdGx5XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwID0gdGhpcy5fZGVmYXVsdFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IHRydWU7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWwgPSAnYSc7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlUaW50ID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IDA7IC8vIHVzZSBub24tMSBvcGFjaXR5IHRvIGNvbXBpbGUgc2hhZGVyIGNvcnJlY3RseVxuICAgICAgICBtYXRlcmlhbC51c2VMaWdodGluZyA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC51c2VHYW1tYVRvbmVtYXAgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlRm9nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLnVzZVNreWJveCA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9QUkVNVUxUSVBMSUVEO1xuICAgICAgICBtYXRlcmlhbC5kZXB0aFdyaXRlID0gZmFsc2U7XG5cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH1cblxuICAgIGdldEltYWdlRWxlbWVudE1hdGVyaWFsKHNjcmVlblNwYWNlLCBtYXNrLCBuaW5lU2xpY2VkLCBuaW5lU2xpY2VUaWxlZCkge1xuICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1lbHNlLXJldHVybiAqL1xuICAgICAgICBpZiAoc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgIGlmIChtYXNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5pbmVTbGljZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLmFscGhhVGVzdCA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwuYmx1ZVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmluZVNsaWNlVGlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsID0gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsLmNsb25lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwucmVkV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwuYWxwaGFXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLmFscGhhVGVzdCA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLmdyZWVuV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuYmx1ZVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWxzLnB1c2godGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobmluZVNsaWNlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG5pbmVTbGljZVRpbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsID0gdGhpcy5fY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgICAgIGlmIChuaW5lU2xpY2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLmdyZWVuV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWxzLnB1c2godGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmluZVNsaWNlVGlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsLmFscGhhVGVzdCA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwuYmx1ZVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsID0gdGhpcy5fY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdEltYWdlTWFza01hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLmFscGhhVGVzdCA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwuYmx1ZVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG5pbmVTbGljZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmluZVNsaWNlVGlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsID0gdGhpcy5fY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsLm5pbmVTbGljZWRNb2RlID0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdEltYWdlTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1lbHNlLXJldHVybiAqL1xuICAgIH1cblxuICAgIHJlZ2lzdGVyVW5pY29kZUNvbnZlcnRlcihmdW5jKSB7XG4gICAgICAgIHRoaXMuX3VuaWNvZGVDb252ZXJ0ZXIgPSBmdW5jO1xuICAgIH1cblxuICAgIHJlZ2lzdGVyUnRsUmVvcmRlcihmdW5jKSB7XG4gICAgICAgIHRoaXMuX3J0bFJlb3JkZXIgPSBmdW5jO1xuICAgIH1cblxuICAgIGdldFVuaWNvZGVDb252ZXJ0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91bmljb2RlQ29udmVydGVyO1xuICAgIH1cblxuICAgIGdldFJ0bFJlb3JkZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ydGxSZW9yZGVyO1xuICAgIH1cbn1cblxuQ29tcG9uZW50Ll9idWlsZEFjY2Vzc29ycyhFbGVtZW50Q29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IEVsZW1lbnRDb21wb25lbnRTeXN0ZW0gfTtcbiJdLCJuYW1lcyI6WyJfc2NoZW1hIiwiRWxlbWVudENvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFN5c3RlbSIsImNvbnN0cnVjdG9yIiwiYXBwIiwiaWQiLCJDb21wb25lbnRUeXBlIiwiRWxlbWVudENvbXBvbmVudCIsIkRhdGFUeXBlIiwiRWxlbWVudENvbXBvbmVudERhdGEiLCJzY2hlbWEiLCJfdW5pY29kZUNvbnZlcnRlciIsIl9ydGxSZW9yZGVyIiwiX2RlZmF1bHRUZXh0dXJlIiwiVGV4dHVyZSIsImdyYXBoaWNzRGV2aWNlIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCIsIm5hbWUiLCJwaXhlbHMiLCJsb2NrIiwicGl4ZWxEYXRhIiwiVWludDhBcnJheSIsInNldCIsInVubG9jayIsImRlZmF1bHRJbWFnZU1hdGVyaWFsIiwiZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsIiwiZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsIiwiZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwiLCJfZGVmYXVsdFRleHRNYXRlcmlhbHMiLCJkZWZhdWx0SW1hZ2VNYXRlcmlhbHMiLCJvbiIsIm9uUmVtb3ZlQ29tcG9uZW50IiwiZGVzdHJveSIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiY29tcG9uZW50IiwiZGF0YSIsInByb3BlcnRpZXMiLCJfYmVpbmdJbml0aWFsaXplZCIsImFuY2hvciIsInVuZGVmaW5lZCIsIlZlYzQiLCJjb3B5IiwicGl2b3QiLCJWZWMyIiwic3BsaXRIb3JBbmNob3JzIiwiTWF0aCIsImFicyIsIngiLCJ6Iiwic3BsaXRWZXJBbmNob3JzIiwieSIsInciLCJfbWFyZ2luQ2hhbmdlIiwiY29sb3IiLCJtYXJnaW4iLCJfbWFyZ2luIiwibGVmdCIsImJvdHRvbSIsInJpZ2h0IiwidG9wIiwic2hvdWxkRm9yY2VTZXRBbmNob3IiLCJlbmFibGVkIiwidXNlSW5wdXQiLCJmaXRNb2RlIiwiYmF0Y2hHcm91cElkIiwibGF5ZXJzIiwiQXJyYXkiLCJpc0FycmF5Iiwic2xpY2UiLCJ0eXBlIiwiRUxFTUVOVFRZUEVfSU1BR0UiLCJyZWN0IiwiQ29sb3IiLCJvcGFjaXR5IiwidGV4dHVyZUFzc2V0IiwidGV4dHVyZSIsInNwcml0ZUFzc2V0Iiwic3ByaXRlIiwic3ByaXRlRnJhbWUiLCJwaXhlbHNQZXJVbml0IiwibWF0ZXJpYWxBc3NldCIsIm1hdGVyaWFsIiwibWFzayIsIkVMRU1FTlRUWVBFX1RFWFQiLCJhdXRvV2lkdGgiLCJhdXRvSGVpZ2h0IiwicnRsUmVvcmRlciIsInVuaWNvZGVDb252ZXJ0ZXIiLCJ0ZXh0Iiwia2V5Iiwic3BhY2luZyIsImZvbnRTaXplIiwibGluZUhlaWdodCIsIm1heExpbmVzIiwid3JhcExpbmVzIiwibWluRm9udFNpemUiLCJtYXhGb250U2l6ZSIsImF1dG9GaXRXaWR0aCIsImF1dG9GaXRIZWlnaHQiLCJmb250QXNzZXQiLCJmb250IiwiYWxpZ25tZW50Iiwib3V0bGluZUNvbG9yIiwib3V0bGluZVRoaWNrbmVzcyIsInNoYWRvd0NvbG9yIiwic2hhZG93T2Zmc2V0IiwiZW5hYmxlTWFya3VwIiwicmVzdWx0IiwiX3BhcnNlVXBUb1NjcmVlbiIsInNjcmVlbiIsIl91cGRhdGVTY3JlZW4iLCJfaW1hZ2UiLCJfbWVzaERpcnR5IiwiX3VwZGF0ZU1lc2giLCJtZXNoIiwiZW50aXR5Iiwib25SZW1vdmUiLCJjbG9uZUNvbXBvbmVudCIsImNsb25lIiwic291cmNlIiwiZWxlbWVudCIsImFkZENvbXBvbmVudCIsImdldFRleHRFbGVtZW50TWF0ZXJpYWwiLCJzY3JlZW5TcGFjZSIsIm1zZGYiLCJ0ZXh0QXR0aWJ1dGVzIiwiaGFzaCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJtc2RmTWFwIiwibXNkZlRleHRBdHRyaWJ1dGUiLCJlbWlzc2l2ZSIsImVtaXNzaXZlTWFwIiwiZW1pc3NpdmVUaW50Iiwib3BhY2l0eU1hcCIsIm9wYWNpdHlNYXBDaGFubmVsIiwiZGVwdGhUZXN0IiwidXNlTGlnaHRpbmciLCJ1c2VHYW1tYVRvbmVtYXAiLCJ1c2VGb2ciLCJ1c2VTa3lib3giLCJkaWZmdXNlIiwiYmxlbmRUeXBlIiwiQkxFTkRfUFJFTVVMVElQTElFRCIsImRlcHRoV3JpdGUiLCJlbWlzc2l2ZVZlcnRleENvbG9yIiwidXBkYXRlIiwiX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsIiwib3BhY2l0eVRpbnQiLCJnZXRJbWFnZUVsZW1lbnRNYXRlcmlhbCIsIm5pbmVTbGljZWQiLCJuaW5lU2xpY2VUaWxlZCIsIm5pbmVTbGljZWRNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiYWxwaGFUZXN0IiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsInB1c2giLCJTUFJJVEVfUkVOREVSTU9ERV9USUxFRCIsInJlZ2lzdGVyVW5pY29kZUNvbnZlcnRlciIsImZ1bmMiLCJyZWdpc3RlclJ0bFJlb3JkZXIiLCJnZXRVbmljb2RlQ29udmVydGVyIiwiZ2V0UnRsUmVvcmRlciIsIkNvbXBvbmVudCIsIl9idWlsZEFjY2Vzc29ycyIsInBy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
