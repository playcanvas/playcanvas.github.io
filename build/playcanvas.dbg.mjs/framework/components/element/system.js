/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { PIXELFORMAT_RGBA8 } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { BLEND_PREMULTIPLIED, SPRITE_RENDERMODE_SLICED, SPRITE_RENDERMODE_TILED } from '../../../scene/constants.js';
import { StandardMaterial } from '../../../scene/materials/standard-material.js';
import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';
import { ELEMENTTYPE_IMAGE, ELEMENTTYPE_TEXT } from './constants.js';
import { ElementComponent } from './component.js';
import { ElementComponentData } from './data.js';

const _schema = ['enabled'];

/**
 * Manages creation of {@link ElementComponent}s.
 *
 * @augments ComponentSystem
 */
class ElementComponentSystem extends ComponentSystem {
  /**
   * Create a new ElementComponentSystem instance.
   *
   * @param {import('../../app-base.js').AppBase} app - The application.
   * @hideconstructor
   */
  constructor(app) {
    super(app);
    this.id = 'element';
    this.ComponentType = ElementComponent;
    this.DataType = ElementComponentData;
    this.schema = _schema;
    this._unicodeConverter = null;
    this._rtlReorder = null;

    // default texture - make white so we can tint it with emissive color
    this._defaultTexture = new Texture(app.graphicsDevice, {
      width: 1,
      height: 1,
      format: PIXELFORMAT_RGBA8,
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

    // image element materials created on demand by getImageElementMaterial()
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

    // text element materials created on demand by getTextElementMaterial()
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
      // force update
      component.margin = component._margin;
    }
    let shouldForceSetAnchor = false;
    if (data.width !== undefined && !splitHorAnchors) {
      // force update
      component.width = data.width;
    } else if (splitHorAnchors) {
      shouldForceSetAnchor = true;
    }
    if (data.height !== undefined && !splitVerAnchors) {
      // force update
      component.height = data.height;
    } else if (splitVerAnchors) {
      shouldForceSetAnchor = true;
    }
    if (shouldForceSetAnchor) {
      /* eslint-disable no-self-assign */
      // force update
      component.anchor = component.anchor;
      /* eslint-enable no-self-assign */
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
    // OTHERWISE: group

    // find screen
    // do this here not in constructor so that component is added to the entity
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
      material.emissive.set(0.5, 0.5, 0.5); // set to non-(1,1,1) so that tint is actually applied
      material.emissiveMap = this._defaultTexture;
      material.emissiveTint = true;
      material.opacityMap = this._defaultTexture;
      material.opacityMapChannel = 'a';
    }
    if (screenSpace) {
      name = 'ScreenSpace' + name;
      material.depthTest = false;
    }

    // The material name can be:
    //  defaultTextMaterial
    //  defaultBitmapTextMaterial
    //  defaultScreenSpaceTextMaterial
    //  defaultScreenSpaceBitmapTextMaterial
    material.name = 'default' + name;
    material.useLighting = false;
    material.useGammaTonemap = false;
    material.useFog = false;
    material.useSkybox = false;
    material.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
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
    material.diffuse.set(0, 0, 0); // black diffuse color to prevent ambient light being included
    material.emissive.set(0.5, 0.5, 0.5); // use non-white to compile shader correctly
    material.emissiveMap = this._defaultTexture;
    material.emissiveTint = true;
    material.opacityMap = this._defaultTexture;
    material.opacityMapChannel = 'a';
    material.opacityTint = true;
    material.opacity = 0; // use non-1 opacity to compile shader correctly
    material.useLighting = false;
    material.useGammaTonemap = false;
    material.useFog = false;
    material.useSkybox = false;
    material.blendType = BLEND_PREMULTIPLIED;
    material.depthWrite = false;
    return material;
  }
  getImageElementMaterial(screenSpace, mask, nineSliced, nineSliceTiled) {
    /* eslint-disable no-else-return */
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
    /* eslint-enable no-else-return */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgUElYRUxGT1JNQVRfUkdCQThcbn0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcblxuaW1wb3J0IHsgQkxFTkRfUFJFTVVMVElQTElFRCwgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IEVMRU1FTlRUWVBFX0lNQUdFLCBFTEVNRU5UVFlQRV9URVhUIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRWxlbWVudENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IEVsZW1lbnRDb21wb25lbnREYXRhIH0gZnJvbSAnLi9kYXRhLmpzJztcblxuY29uc3QgX3NjaGVtYSA9IFsnZW5hYmxlZCddO1xuXG4vKipcbiAqIE1hbmFnZXMgY3JlYXRpb24gb2Yge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50U3lzdGVtXG4gKi9cbmNsYXNzIEVsZW1lbnRDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBFbGVtZW50Q29tcG9uZW50U3lzdGVtIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIGFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLmlkID0gJ2VsZW1lbnQnO1xuXG4gICAgICAgIHRoaXMuQ29tcG9uZW50VHlwZSA9IEVsZW1lbnRDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBFbGVtZW50Q29tcG9uZW50RGF0YTtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG4gICAgICAgIHRoaXMuX3VuaWNvZGVDb252ZXJ0ZXIgPSBudWxsO1xuICAgICAgICB0aGlzLl9ydGxSZW9yZGVyID0gbnVsbDtcblxuICAgICAgICAvLyBkZWZhdWx0IHRleHR1cmUgLSBtYWtlIHdoaXRlIHNvIHdlIGNhbiB0aW50IGl0IHdpdGggZW1pc3NpdmUgY29sb3JcbiAgICAgICAgdGhpcy5fZGVmYXVsdFRleHR1cmUgPSBuZXcgVGV4dHVyZShhcHAuZ3JhcGhpY3NEZXZpY2UsIHtcbiAgICAgICAgICAgIHdpZHRoOiAxLFxuICAgICAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICAgICAgICAgIG5hbWU6ICdlbGVtZW50LXN5c3RlbSdcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHBpeGVscyA9IHRoaXMuX2RlZmF1bHRUZXh0dXJlLmxvY2soKTtcbiAgICAgICAgY29uc3QgcGl4ZWxEYXRhID0gbmV3IFVpbnQ4QXJyYXkoNCk7XG4gICAgICAgIHBpeGVsRGF0YVswXSA9IDI1NS4wO1xuICAgICAgICBwaXhlbERhdGFbMV0gPSAyNTUuMDtcbiAgICAgICAgcGl4ZWxEYXRhWzJdID0gMjU1LjA7XG4gICAgICAgIHBpeGVsRGF0YVszXSA9IDI1NS4wO1xuICAgICAgICBwaXhlbHMuc2V0KHBpeGVsRGF0YSk7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRUZXh0dXJlLnVubG9jaygpO1xuXG4gICAgICAgIC8vIGltYWdlIGVsZW1lbnQgbWF0ZXJpYWxzIGNyZWF0ZWQgb24gZGVtYW5kIGJ5IGdldEltYWdlRWxlbWVudE1hdGVyaWFsKClcbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgLy8gdGV4dCBlbGVtZW50IG1hdGVyaWFscyBjcmVhdGVkIG9uIGRlbWFuZCBieSBnZXRUZXh0RWxlbWVudE1hdGVyaWFsKClcbiAgICAgICAgdGhpcy5fZGVmYXVsdFRleHRNYXRlcmlhbHMgPSB7fTtcblxuICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscyA9IFtdO1xuXG4gICAgICAgIHRoaXMub24oJ2JlZm9yZXJlbW92ZScsIHRoaXMub25SZW1vdmVDb21wb25lbnQsIHRoaXMpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcblxuICAgICAgICB0aGlzLl9kZWZhdWx0VGV4dHVyZS5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGNvbXBvbmVudC5fYmVpbmdJbml0aWFsaXplZCA9IHRydWU7XG5cbiAgICAgICAgaWYgKGRhdGEuYW5jaG9yICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmFuY2hvciBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuYW5jaG9yLmNvcHkoZGF0YS5hbmNob3IpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuYW5jaG9yLnNldChkYXRhLmFuY2hvclswXSwgZGF0YS5hbmNob3JbMV0sIGRhdGEuYW5jaG9yWzJdLCBkYXRhLmFuY2hvclszXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5waXZvdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5waXZvdCBpbnN0YW5jZW9mIFZlYzIpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQucGl2b3QuY29weShkYXRhLnBpdm90KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnBpdm90LnNldChkYXRhLnBpdm90WzBdLCBkYXRhLnBpdm90WzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNwbGl0SG9yQW5jaG9ycyA9IE1hdGguYWJzKGNvbXBvbmVudC5hbmNob3IueCAtIGNvbXBvbmVudC5hbmNob3IueikgPiAwLjAwMTtcbiAgICAgICAgY29uc3Qgc3BsaXRWZXJBbmNob3JzID0gTWF0aC5hYnMoY29tcG9uZW50LmFuY2hvci55IC0gY29tcG9uZW50LmFuY2hvci53KSA+IDAuMDAxO1xuICAgICAgICBsZXQgX21hcmdpbkNoYW5nZSA9IGZhbHNlO1xuICAgICAgICBsZXQgY29sb3I7XG5cbiAgICAgICAgaWYgKGRhdGEubWFyZ2luICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLm1hcmdpbiBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQubWFyZ2luLmNvcHkoZGF0YS5tYXJnaW4pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuX21hcmdpbi5zZXQoZGF0YS5tYXJnaW5bMF0sIGRhdGEubWFyZ2luWzFdLCBkYXRhLm1hcmdpblsyXSwgZGF0YS5tYXJnaW5bM10pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkYXRhLmxlZnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4ueCA9IGRhdGEubGVmdDtcbiAgICAgICAgICAgIF9tYXJnaW5DaGFuZ2UgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhLmJvdHRvbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX21hcmdpbi55ID0gZGF0YS5ib3R0b207XG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS5yaWdodCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX21hcmdpbi56ID0gZGF0YS5yaWdodDtcbiAgICAgICAgICAgIF9tYXJnaW5DaGFuZ2UgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhLnRvcCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX21hcmdpbi53ID0gZGF0YS50b3A7XG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoX21hcmdpbkNoYW5nZSkge1xuICAgICAgICAgICAgLy8gZm9yY2UgdXBkYXRlXG4gICAgICAgICAgICBjb21wb25lbnQubWFyZ2luID0gY29tcG9uZW50Ll9tYXJnaW47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc2hvdWxkRm9yY2VTZXRBbmNob3IgPSBmYWxzZTtcblxuICAgICAgICBpZiAoZGF0YS53aWR0aCAhPT0gdW5kZWZpbmVkICYmICFzcGxpdEhvckFuY2hvcnMpIHtcbiAgICAgICAgICAgIC8vIGZvcmNlIHVwZGF0ZVxuICAgICAgICAgICAgY29tcG9uZW50LndpZHRoID0gZGF0YS53aWR0aDtcbiAgICAgICAgfSBlbHNlIGlmIChzcGxpdEhvckFuY2hvcnMpIHtcbiAgICAgICAgICAgIHNob3VsZEZvcmNlU2V0QW5jaG9yID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS5oZWlnaHQgIT09IHVuZGVmaW5lZCAmJiAhc3BsaXRWZXJBbmNob3JzKSB7XG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIGNvbXBvbmVudC5oZWlnaHQgPSBkYXRhLmhlaWdodDtcbiAgICAgICAgfSBlbHNlIGlmIChzcGxpdFZlckFuY2hvcnMpIHtcbiAgICAgICAgICAgIHNob3VsZEZvcmNlU2V0QW5jaG9yID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaG91bGRGb3JjZVNldEFuY2hvcikge1xuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tc2VsZi1hc3NpZ24gKi9cbiAgICAgICAgICAgIC8vIGZvcmNlIHVwZGF0ZVxuICAgICAgICAgICAgY29tcG9uZW50LmFuY2hvciA9IGNvbXBvbmVudC5hbmNob3I7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5lbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5lbmFibGVkID0gZGF0YS5lbmFibGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEudXNlSW5wdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50LnVzZUlucHV0ID0gZGF0YS51c2VJbnB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkYXRhLmZpdE1vZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50LmZpdE1vZGUgPSBkYXRhLmZpdE1vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBjb21wb25lbnQuYmF0Y2hHcm91cElkID0gZGF0YS5iYXRjaEdyb3VwSWQgPT09IHVuZGVmaW5lZCB8fCBkYXRhLmJhdGNoR3JvdXBJZCA9PT0gbnVsbCA/IC0xIDogZGF0YS5iYXRjaEdyb3VwSWQ7XG5cbiAgICAgICAgaWYgKGRhdGEubGF5ZXJzICYmIEFycmF5LmlzQXJyYXkoZGF0YS5sYXllcnMpKSB7XG4gICAgICAgICAgICBjb21wb25lbnQubGF5ZXJzID0gZGF0YS5sYXllcnMuc2xpY2UoMCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS50eXBlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC50eXBlID0gZGF0YS50eXBlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbXBvbmVudC50eXBlID09PSBFTEVNRU5UVFlQRV9JTUFHRSkge1xuICAgICAgICAgICAgaWYgKGRhdGEucmVjdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnJlY3QgPSBkYXRhLnJlY3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YS5jb2xvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29sb3IgPSBkYXRhLmNvbG9yO1xuICAgICAgICAgICAgICAgIGlmICghKGNvbG9yIGluc3RhbmNlb2YgQ29sb3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yID0gbmV3IENvbG9yKGRhdGEuY29sb3JbMF0sIGRhdGEuY29sb3JbMV0sIGRhdGEuY29sb3JbMl0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb21wb25lbnQuY29sb3IgPSBjb2xvcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRhdGEub3BhY2l0eSAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQub3BhY2l0eSA9IGRhdGEub3BhY2l0eTtcbiAgICAgICAgICAgIGlmIChkYXRhLnRleHR1cmVBc3NldCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQudGV4dHVyZUFzc2V0ID0gZGF0YS50ZXh0dXJlQXNzZXQ7XG4gICAgICAgICAgICBpZiAoZGF0YS50ZXh0dXJlKSBjb21wb25lbnQudGV4dHVyZSA9IGRhdGEudGV4dHVyZTtcbiAgICAgICAgICAgIGlmIChkYXRhLnNwcml0ZUFzc2V0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zcHJpdGVBc3NldCA9IGRhdGEuc3ByaXRlQXNzZXQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5zcHJpdGUpIGNvbXBvbmVudC5zcHJpdGUgPSBkYXRhLnNwcml0ZTtcbiAgICAgICAgICAgIGlmIChkYXRhLnNwcml0ZUZyYW1lICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zcHJpdGVGcmFtZSA9IGRhdGEuc3ByaXRlRnJhbWU7XG4gICAgICAgICAgICBpZiAoZGF0YS5waXhlbHNQZXJVbml0ICE9PSB1bmRlZmluZWQgJiYgZGF0YS5waXhlbHNQZXJVbml0ICE9PSBudWxsKSBjb21wb25lbnQucGl4ZWxzUGVyVW5pdCA9IGRhdGEucGl4ZWxzUGVyVW5pdDtcbiAgICAgICAgICAgIGlmIChkYXRhLm1hdGVyaWFsQXNzZXQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1hdGVyaWFsQXNzZXQgPSBkYXRhLm1hdGVyaWFsQXNzZXQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5tYXRlcmlhbCkgY29tcG9uZW50Lm1hdGVyaWFsID0gZGF0YS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgaWYgKGRhdGEubWFzayAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Lm1hc2sgPSBkYXRhLm1hc2s7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoY29tcG9uZW50LnR5cGUgPT09IEVMRU1FTlRUWVBFX1RFWFQpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmF1dG9XaWR0aCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuYXV0b1dpZHRoID0gZGF0YS5hdXRvV2lkdGg7XG4gICAgICAgICAgICBpZiAoZGF0YS5hdXRvSGVpZ2h0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5hdXRvSGVpZ2h0ID0gZGF0YS5hdXRvSGVpZ2h0O1xuICAgICAgICAgICAgaWYgKGRhdGEucnRsUmVvcmRlciAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQucnRsUmVvcmRlciA9IGRhdGEucnRsUmVvcmRlcjtcbiAgICAgICAgICAgIGlmIChkYXRhLnVuaWNvZGVDb252ZXJ0ZXIgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnVuaWNvZGVDb252ZXJ0ZXIgPSBkYXRhLnVuaWNvZGVDb252ZXJ0ZXI7XG4gICAgICAgICAgICBpZiAoZGF0YS50ZXh0ICE9PSBudWxsICYmIGRhdGEudGV4dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnRleHQgPSBkYXRhLnRleHQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEua2V5ICE9PSBudWxsICYmIGRhdGEua2V5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQua2V5ID0gZGF0YS5rZXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YS5jb2xvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29sb3IgPSBkYXRhLmNvbG9yO1xuICAgICAgICAgICAgICAgIGlmICghKGNvbG9yIGluc3RhbmNlb2YgQ29sb3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yID0gbmV3IENvbG9yKGNvbG9yWzBdLCBjb2xvclsxXSwgY29sb3JbMl0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb21wb25lbnQuY29sb3IgPSBjb2xvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkYXRhLm9wYWNpdHkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5vcGFjaXR5ID0gZGF0YS5vcGFjaXR5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEuc3BhY2luZyAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuc3BhY2luZyA9IGRhdGEuc3BhY2luZztcbiAgICAgICAgICAgIGlmIChkYXRhLmZvbnRTaXplICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuZm9udFNpemUgPSBkYXRhLmZvbnRTaXplO1xuICAgICAgICAgICAgICAgIGlmICghZGF0YS5saW5lSGVpZ2h0KSBjb21wb25lbnQubGluZUhlaWdodCA9IGRhdGEuZm9udFNpemU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YS5saW5lSGVpZ2h0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5saW5lSGVpZ2h0ID0gZGF0YS5saW5lSGVpZ2h0O1xuICAgICAgICAgICAgaWYgKGRhdGEubWF4TGluZXMgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1heExpbmVzID0gZGF0YS5tYXhMaW5lcztcbiAgICAgICAgICAgIGlmIChkYXRhLndyYXBMaW5lcyAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQud3JhcExpbmVzID0gZGF0YS53cmFwTGluZXM7XG4gICAgICAgICAgICBpZiAoZGF0YS5taW5Gb250U2l6ZSAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQubWluRm9udFNpemUgPSBkYXRhLm1pbkZvbnRTaXplO1xuICAgICAgICAgICAgaWYgKGRhdGEubWF4Rm9udFNpemUgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1heEZvbnRTaXplID0gZGF0YS5tYXhGb250U2l6ZTtcbiAgICAgICAgICAgIGlmIChkYXRhLmF1dG9GaXRXaWR0aCkgY29tcG9uZW50LmF1dG9GaXRXaWR0aCA9IGRhdGEuYXV0b0ZpdFdpZHRoO1xuICAgICAgICAgICAgaWYgKGRhdGEuYXV0b0ZpdEhlaWdodCkgY29tcG9uZW50LmF1dG9GaXRIZWlnaHQgPSBkYXRhLmF1dG9GaXRIZWlnaHQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5mb250QXNzZXQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmZvbnRBc3NldCA9IGRhdGEuZm9udEFzc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEuZm9udCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuZm9udCA9IGRhdGEuZm9udDtcbiAgICAgICAgICAgIGlmIChkYXRhLmFsaWdubWVudCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuYWxpZ25tZW50ID0gZGF0YS5hbGlnbm1lbnQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5vdXRsaW5lQ29sb3IgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm91dGxpbmVDb2xvciA9IGRhdGEub3V0bGluZUNvbG9yO1xuICAgICAgICAgICAgaWYgKGRhdGEub3V0bGluZVRoaWNrbmVzcyAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQub3V0bGluZVRoaWNrbmVzcyA9IGRhdGEub3V0bGluZVRoaWNrbmVzcztcbiAgICAgICAgICAgIGlmIChkYXRhLnNoYWRvd0NvbG9yICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zaGFkb3dDb2xvciA9IGRhdGEuc2hhZG93Q29sb3I7XG4gICAgICAgICAgICBpZiAoZGF0YS5zaGFkb3dPZmZzZXQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnNoYWRvd09mZnNldCA9IGRhdGEuc2hhZG93T2Zmc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEuZW5hYmxlTWFya3VwICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5lbmFibGVNYXJrdXAgPSBkYXRhLmVuYWJsZU1hcmt1cDtcbiAgICAgICAgfVxuICAgICAgICAvLyBPVEhFUldJU0U6IGdyb3VwXG5cbiAgICAgICAgLy8gZmluZCBzY3JlZW5cbiAgICAgICAgLy8gZG8gdGhpcyBoZXJlIG5vdCBpbiBjb25zdHJ1Y3RvciBzbyB0aGF0IGNvbXBvbmVudCBpcyBhZGRlZCB0byB0aGUgZW50aXR5XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbXBvbmVudC5fcGFyc2VVcFRvU2NyZWVuKCk7XG4gICAgICAgIGlmIChyZXN1bHQuc2NyZWVuKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX3VwZGF0ZVNjcmVlbihyZXN1bHQuc2NyZWVuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcyk7XG5cbiAgICAgICAgY29tcG9uZW50Ll9iZWluZ0luaXRpYWxpemVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGNvbXBvbmVudC50eXBlID09PSBFTEVNRU5UVFlQRV9JTUFHRSAmJiBjb21wb25lbnQuX2ltYWdlLl9tZXNoRGlydHkpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5faW1hZ2UuX3VwZGF0ZU1lc2goY29tcG9uZW50Ll9pbWFnZS5tZXNoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgICAgIGNvbXBvbmVudC5vblJlbW92ZSgpO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgY29uc3Qgc291cmNlID0gZW50aXR5LmVsZW1lbnQ7XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHNvdXJjZS5lbmFibGVkLFxuICAgICAgICAgICAgd2lkdGg6IHNvdXJjZS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogc291cmNlLmhlaWdodCxcbiAgICAgICAgICAgIGFuY2hvcjogc291cmNlLmFuY2hvci5jbG9uZSgpLFxuICAgICAgICAgICAgcGl2b3Q6IHNvdXJjZS5waXZvdC5jbG9uZSgpLFxuICAgICAgICAgICAgbWFyZ2luOiBzb3VyY2UubWFyZ2luLmNsb25lKCksXG4gICAgICAgICAgICBhbGlnbm1lbnQ6IHNvdXJjZS5hbGlnbm1lbnQgJiYgc291cmNlLmFsaWdubWVudC5jbG9uZSgpIHx8IHNvdXJjZS5hbGlnbm1lbnQsXG4gICAgICAgICAgICBhdXRvV2lkdGg6IHNvdXJjZS5hdXRvV2lkdGgsXG4gICAgICAgICAgICBhdXRvSGVpZ2h0OiBzb3VyY2UuYXV0b0hlaWdodCxcbiAgICAgICAgICAgIHR5cGU6IHNvdXJjZS50eXBlLFxuICAgICAgICAgICAgcmVjdDogc291cmNlLnJlY3QgJiYgc291cmNlLnJlY3QuY2xvbmUoKSB8fCBzb3VyY2UucmVjdCxcbiAgICAgICAgICAgIHJ0bFJlb3JkZXI6IHNvdXJjZS5ydGxSZW9yZGVyLFxuICAgICAgICAgICAgdW5pY29kZUNvbnZlcnRlcjogc291cmNlLnVuaWNvZGVDb252ZXJ0ZXIsXG4gICAgICAgICAgICBtYXRlcmlhbEFzc2V0OiBzb3VyY2UubWF0ZXJpYWxBc3NldCxcbiAgICAgICAgICAgIG1hdGVyaWFsOiBzb3VyY2UubWF0ZXJpYWwsXG4gICAgICAgICAgICBjb2xvcjogc291cmNlLmNvbG9yICYmIHNvdXJjZS5jb2xvci5jbG9uZSgpIHx8IHNvdXJjZS5jb2xvcixcbiAgICAgICAgICAgIG9wYWNpdHk6IHNvdXJjZS5vcGFjaXR5LFxuICAgICAgICAgICAgdGV4dHVyZUFzc2V0OiBzb3VyY2UudGV4dHVyZUFzc2V0LFxuICAgICAgICAgICAgdGV4dHVyZTogc291cmNlLnRleHR1cmUsXG4gICAgICAgICAgICBzcHJpdGVBc3NldDogc291cmNlLnNwcml0ZUFzc2V0LFxuICAgICAgICAgICAgc3ByaXRlOiBzb3VyY2Uuc3ByaXRlLFxuICAgICAgICAgICAgc3ByaXRlRnJhbWU6IHNvdXJjZS5zcHJpdGVGcmFtZSxcbiAgICAgICAgICAgIHBpeGVsc1BlclVuaXQ6IHNvdXJjZS5waXhlbHNQZXJVbml0LFxuICAgICAgICAgICAgc3BhY2luZzogc291cmNlLnNwYWNpbmcsXG4gICAgICAgICAgICBsaW5lSGVpZ2h0OiBzb3VyY2UubGluZUhlaWdodCxcbiAgICAgICAgICAgIHdyYXBMaW5lczogc291cmNlLndyYXBMaW5lcyxcbiAgICAgICAgICAgIGxheWVyczogc291cmNlLmxheWVycyxcbiAgICAgICAgICAgIGZvbnRTaXplOiBzb3VyY2UuZm9udFNpemUsXG4gICAgICAgICAgICBtaW5Gb250U2l6ZTogc291cmNlLm1pbkZvbnRTaXplLFxuICAgICAgICAgICAgbWF4Rm9udFNpemU6IHNvdXJjZS5tYXhGb250U2l6ZSxcbiAgICAgICAgICAgIGF1dG9GaXRXaWR0aDogc291cmNlLmF1dG9GaXRXaWR0aCxcbiAgICAgICAgICAgIGF1dG9GaXRIZWlnaHQ6IHNvdXJjZS5hdXRvRml0SGVpZ2h0LFxuICAgICAgICAgICAgbWF4TGluZXM6IHNvdXJjZS5tYXhMaW5lcyxcbiAgICAgICAgICAgIGZvbnRBc3NldDogc291cmNlLmZvbnRBc3NldCxcbiAgICAgICAgICAgIGZvbnQ6IHNvdXJjZS5mb250LFxuICAgICAgICAgICAgdXNlSW5wdXQ6IHNvdXJjZS51c2VJbnB1dCxcbiAgICAgICAgICAgIGZpdE1vZGU6IHNvdXJjZS5maXRNb2RlLFxuICAgICAgICAgICAgYmF0Y2hHcm91cElkOiBzb3VyY2UuYmF0Y2hHcm91cElkLFxuICAgICAgICAgICAgbWFzazogc291cmNlLm1hc2ssXG4gICAgICAgICAgICBvdXRsaW5lQ29sb3I6IHNvdXJjZS5vdXRsaW5lQ29sb3IgJiYgc291cmNlLm91dGxpbmVDb2xvci5jbG9uZSgpIHx8IHNvdXJjZS5vdXRsaW5lQ29sb3IsXG4gICAgICAgICAgICBvdXRsaW5lVGhpY2tuZXNzOiBzb3VyY2Uub3V0bGluZVRoaWNrbmVzcyxcbiAgICAgICAgICAgIHNoYWRvd0NvbG9yOiBzb3VyY2Uuc2hhZG93Q29sb3IgJiYgc291cmNlLnNoYWRvd0NvbG9yLmNsb25lKCkgfHwgc291cmNlLnNoYWRvd0NvbG9yLFxuICAgICAgICAgICAgc2hhZG93T2Zmc2V0OiBzb3VyY2Uuc2hhZG93T2Zmc2V0ICYmIHNvdXJjZS5zaGFkb3dPZmZzZXQuY2xvbmUoKSB8fCBzb3VyY2Uuc2hhZG93T2Zmc2V0LFxuICAgICAgICAgICAgZW5hYmxlTWFya3VwOiBzb3VyY2UuZW5hYmxlTWFya3VwXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHNvdXJjZS5rZXkgIT09IHVuZGVmaW5lZCAmJiBzb3VyY2Uua2V5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBkYXRhLmtleSA9IHNvdXJjZS5rZXk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkYXRhLnRleHQgPSBzb3VyY2UudGV4dDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgZ2V0VGV4dEVsZW1lbnRNYXRlcmlhbChzY3JlZW5TcGFjZSwgbXNkZiwgdGV4dEF0dGlidXRlcykge1xuICAgICAgICBjb25zdCBoYXNoID0gKHNjcmVlblNwYWNlICYmICgxIDw8IDApKSB8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIChtc2RmICYmICgxIDw8IDEpKSB8XG4gICAgICAgICAgICAgICAgICh0ZXh0QXR0aWJ1dGVzICYmICgxIDw8IDIpKTtcblxuICAgICAgICBsZXQgbWF0ZXJpYWwgPSB0aGlzLl9kZWZhdWx0VGV4dE1hdGVyaWFsc1toYXNoXTtcblxuICAgICAgICBpZiAobWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBuYW1lID0gXCJUZXh0TWF0ZXJpYWxcIjtcblxuICAgICAgICBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG5cbiAgICAgICAgaWYgKG1zZGYpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1zZGZNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1zZGZUZXh0QXR0cmlidXRlID0gdGV4dEF0dGlidXRlcztcbiAgICAgICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldCgxLCAxLCAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5hbWUgPSBcIkJpdG1hcFwiICsgbmFtZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldCgwLjUsIDAuNSwgMC41KTsgLy8gc2V0IHRvIG5vbi0oMSwxLDEpIHNvIHRoYXQgdGludCBpcyBhY3R1YWxseSBhcHBsaWVkXG4gICAgICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcCA9IHRoaXMuX2RlZmF1bHRUZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNjcmVlblNwYWNlKSB7XG4gICAgICAgICAgICBuYW1lID0gJ1NjcmVlblNwYWNlJyArIG5hbWU7XG4gICAgICAgICAgICBtYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBtYXRlcmlhbCBuYW1lIGNhbiBiZTpcbiAgICAgICAgLy8gIGRlZmF1bHRUZXh0TWF0ZXJpYWxcbiAgICAgICAgLy8gIGRlZmF1bHRCaXRtYXBUZXh0TWF0ZXJpYWxcbiAgICAgICAgLy8gIGRlZmF1bHRTY3JlZW5TcGFjZVRleHRNYXRlcmlhbFxuICAgICAgICAvLyAgZGVmYXVsdFNjcmVlblNwYWNlQml0bWFwVGV4dE1hdGVyaWFsXG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdCcgKyBuYW1lO1xuICAgICAgICBtYXRlcmlhbC51c2VMaWdodGluZyA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC51c2VHYW1tYVRvbmVtYXAgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlRm9nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLnVzZVNreWJveCA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgwLCAwLCAwKTsgLy8gYmxhY2sgZGlmZnVzZSBjb2xvciB0byBwcmV2ZW50IGFtYmllbnQgbGlnaHQgYmVpbmcgaW5jbHVkZWRcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IDAuNTtcbiAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfUFJFTVVMVElQTElFRDtcbiAgICAgICAgbWF0ZXJpYWwuZGVwdGhXcml0ZSA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVZlcnRleENvbG9yID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgdGhpcy5fZGVmYXVsdFRleHRNYXRlcmlhbHNbaGFzaF0gPSBtYXRlcmlhbDtcblxuICAgICAgICByZXR1cm4gbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG5cbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMCwgMCwgMCk7IC8vIGJsYWNrIGRpZmZ1c2UgY29sb3IgdG8gcHJldmVudCBhbWJpZW50IGxpZ2h0IGJlaW5nIGluY2x1ZGVkXG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldCgwLjUsIDAuNSwgMC41KTsgLy8gdXNlIG5vbi13aGl0ZSB0byBjb21waWxlIHNoYWRlciBjb3JyZWN0bHlcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcCA9IHRoaXMuX2RlZmF1bHRUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eVRpbnQgPSB0cnVlO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gMDsgLy8gdXNlIG5vbi0xIG9wYWNpdHkgdG8gY29tcGlsZSBzaGFkZXIgY29ycmVjdGx5XG4gICAgICAgIG1hdGVyaWFsLnVzZUxpZ2h0aW5nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLnVzZUdhbW1hVG9uZW1hcCA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC51c2VGb2cgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlU2t5Ym94ID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX1BSRU1VTFRJUExJRUQ7XG4gICAgICAgIG1hdGVyaWFsLmRlcHRoV3JpdGUgPSBmYWxzZTtcblxuICAgICAgICByZXR1cm4gbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgZ2V0SW1hZ2VFbGVtZW50TWF0ZXJpYWwoc2NyZWVuU3BhY2UsIG1hc2ssIG5pbmVTbGljZWQsIG5pbmVTbGljZVRpbGVkKSB7XG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWVsc2UtcmV0dXJuICovXG4gICAgICAgIGlmIChzY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgaWYgKG1hc2spIHtcbiAgICAgICAgICAgICAgICBpZiAobmluZVNsaWNlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5ncmVlbldyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChuaW5lU2xpY2VUaWxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwgPSB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwuY2xvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLm5pbmVTbGljZWRNb2RlID0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5hbHBoYVRlc3QgPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5ncmVlbldyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLmJsdWVXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwucmVkV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuYWxwaGFXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChuaW5lU2xpY2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmluZVNsaWNlVGlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWxzLnB1c2godGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtYXNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5pbmVTbGljZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5hbHBoYVRlc3QgPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLmJsdWVXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChuaW5lU2xpY2VUaWxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5ncmVlbldyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC5ncmVlbldyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobmluZVNsaWNlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChuaW5lU2xpY2VUaWxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWxzLnB1c2godGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsID0gdGhpcy5fY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2VNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWVsc2UtcmV0dXJuICovXG4gICAgfVxuXG4gICAgcmVnaXN0ZXJVbmljb2RlQ29udmVydGVyKGZ1bmMpIHtcbiAgICAgICAgdGhpcy5fdW5pY29kZUNvbnZlcnRlciA9IGZ1bmM7XG4gICAgfVxuXG4gICAgcmVnaXN0ZXJSdGxSZW9yZGVyKGZ1bmMpIHtcbiAgICAgICAgdGhpcy5fcnRsUmVvcmRlciA9IGZ1bmM7XG4gICAgfVxuXG4gICAgZ2V0VW5pY29kZUNvbnZlcnRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VuaWNvZGVDb252ZXJ0ZXI7XG4gICAgfVxuXG4gICAgZ2V0UnRsUmVvcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3J0bFJlb3JkZXI7XG4gICAgfVxufVxuXG5Db21wb25lbnQuX2J1aWxkQWNjZXNzb3JzKEVsZW1lbnRDb21wb25lbnQucHJvdG90eXBlLCBfc2NoZW1hKTtcblxuZXhwb3J0IHsgRWxlbWVudENvbXBvbmVudFN5c3RlbSB9O1xuIl0sIm5hbWVzIjpbIl9zY2hlbWEiLCJFbGVtZW50Q29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiY29uc3RydWN0b3IiLCJhcHAiLCJpZCIsIkNvbXBvbmVudFR5cGUiLCJFbGVtZW50Q29tcG9uZW50IiwiRGF0YVR5cGUiLCJFbGVtZW50Q29tcG9uZW50RGF0YSIsInNjaGVtYSIsIl91bmljb2RlQ29udmVydGVyIiwiX3J0bFJlb3JkZXIiLCJfZGVmYXVsdFRleHR1cmUiLCJUZXh0dXJlIiwiZ3JhcGhpY3NEZXZpY2UiLCJ3aWR0aCIsImhlaWdodCIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwibmFtZSIsInBpeGVscyIsImxvY2siLCJwaXhlbERhdGEiLCJVaW50OEFycmF5Iiwic2V0IiwidW5sb2NrIiwiZGVmYXVsdEltYWdlTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbCIsImRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCIsImRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCIsIl9kZWZhdWx0VGV4dE1hdGVyaWFscyIsImRlZmF1bHRJbWFnZU1hdGVyaWFscyIsIm9uIiwib25SZW1vdmVDb21wb25lbnQiLCJkZXN0cm95IiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJjb21wb25lbnQiLCJkYXRhIiwicHJvcGVydGllcyIsIl9iZWluZ0luaXRpYWxpemVkIiwiYW5jaG9yIiwidW5kZWZpbmVkIiwiVmVjNCIsImNvcHkiLCJwaXZvdCIsIlZlYzIiLCJzcGxpdEhvckFuY2hvcnMiLCJNYXRoIiwiYWJzIiwieCIsInoiLCJzcGxpdFZlckFuY2hvcnMiLCJ5IiwidyIsIl9tYXJnaW5DaGFuZ2UiLCJjb2xvciIsIm1hcmdpbiIsIl9tYXJnaW4iLCJsZWZ0IiwiYm90dG9tIiwicmlnaHQiLCJ0b3AiLCJzaG91bGRGb3JjZVNldEFuY2hvciIsImVuYWJsZWQiLCJ1c2VJbnB1dCIsImZpdE1vZGUiLCJiYXRjaEdyb3VwSWQiLCJsYXllcnMiLCJBcnJheSIsImlzQXJyYXkiLCJzbGljZSIsInR5cGUiLCJFTEVNRU5UVFlQRV9JTUFHRSIsInJlY3QiLCJDb2xvciIsIm9wYWNpdHkiLCJ0ZXh0dXJlQXNzZXQiLCJ0ZXh0dXJlIiwic3ByaXRlQXNzZXQiLCJzcHJpdGUiLCJzcHJpdGVGcmFtZSIsInBpeGVsc1BlclVuaXQiLCJtYXRlcmlhbEFzc2V0IiwibWF0ZXJpYWwiLCJtYXNrIiwiRUxFTUVOVFRZUEVfVEVYVCIsImF1dG9XaWR0aCIsImF1dG9IZWlnaHQiLCJydGxSZW9yZGVyIiwidW5pY29kZUNvbnZlcnRlciIsInRleHQiLCJrZXkiLCJzcGFjaW5nIiwiZm9udFNpemUiLCJsaW5lSGVpZ2h0IiwibWF4TGluZXMiLCJ3cmFwTGluZXMiLCJtaW5Gb250U2l6ZSIsIm1heEZvbnRTaXplIiwiYXV0b0ZpdFdpZHRoIiwiYXV0b0ZpdEhlaWdodCIsImZvbnRBc3NldCIsImZvbnQiLCJhbGlnbm1lbnQiLCJvdXRsaW5lQ29sb3IiLCJvdXRsaW5lVGhpY2tuZXNzIiwic2hhZG93Q29sb3IiLCJzaGFkb3dPZmZzZXQiLCJlbmFibGVNYXJrdXAiLCJyZXN1bHQiLCJfcGFyc2VVcFRvU2NyZWVuIiwic2NyZWVuIiwiX3VwZGF0ZVNjcmVlbiIsIl9pbWFnZSIsIl9tZXNoRGlydHkiLCJfdXBkYXRlTWVzaCIsIm1lc2giLCJlbnRpdHkiLCJvblJlbW92ZSIsImNsb25lQ29tcG9uZW50IiwiY2xvbmUiLCJzb3VyY2UiLCJlbGVtZW50IiwiYWRkQ29tcG9uZW50IiwiZ2V0VGV4dEVsZW1lbnRNYXRlcmlhbCIsInNjcmVlblNwYWNlIiwibXNkZiIsInRleHRBdHRpYnV0ZXMiLCJoYXNoIiwiU3RhbmRhcmRNYXRlcmlhbCIsIm1zZGZNYXAiLCJtc2RmVGV4dEF0dHJpYnV0ZSIsImVtaXNzaXZlIiwiZW1pc3NpdmVNYXAiLCJlbWlzc2l2ZVRpbnQiLCJvcGFjaXR5TWFwIiwib3BhY2l0eU1hcENoYW5uZWwiLCJkZXB0aFRlc3QiLCJ1c2VMaWdodGluZyIsInVzZUdhbW1hVG9uZW1hcCIsInVzZUZvZyIsInVzZVNreWJveCIsImRpZmZ1c2UiLCJibGVuZFR5cGUiLCJCTEVORF9QUkVNVUxUSVBMSUVEIiwiZGVwdGhXcml0ZSIsImVtaXNzaXZlVmVydGV4Q29sb3IiLCJ1cGRhdGUiLCJfY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwiLCJvcGFjaXR5VGludCIsImdldEltYWdlRWxlbWVudE1hdGVyaWFsIiwibmluZVNsaWNlZCIsIm5pbmVTbGljZVRpbGVkIiwibmluZVNsaWNlZE1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQiLCJhbHBoYVRlc3QiLCJyZWRXcml0ZSIsImdyZWVuV3JpdGUiLCJibHVlV3JpdGUiLCJhbHBoYVdyaXRlIiwicHVzaCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwicmVnaXN0ZXJVbmljb2RlQ29udmVydGVyIiwiZnVuYyIsInJlZ2lzdGVyUnRsUmVvcmRlciIsImdldFVuaWNvZGVDb252ZXJ0ZXIiLCJnZXRSdGxSZW9yZGVyIiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFtQkEsTUFBTUEsT0FB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
