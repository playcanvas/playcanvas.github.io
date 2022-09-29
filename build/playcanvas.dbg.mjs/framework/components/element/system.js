/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Color } from '../../../math/color.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec4 } from '../../../math/vec4.js';
import { PIXELFORMAT_R8_G8_B8_A8 } from '../../../graphics/constants.js';
import { Texture } from '../../../graphics/texture.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi8uLi9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgUElYRUxGT1JNQVRfUjhfRzhfQjhfQThcbn0gZnJvbSAnLi4vLi4vLi4vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi8uLi9ncmFwaGljcy90ZXh0dXJlLmpzJztcblxuaW1wb3J0IHsgQkxFTkRfUFJFTVVMVElQTElFRCwgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IEVMRU1FTlRUWVBFX0lNQUdFLCBFTEVNRU5UVFlQRV9URVhUIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRWxlbWVudENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IEVsZW1lbnRDb21wb25lbnREYXRhIH0gZnJvbSAnLi9kYXRhLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gQXBwQmFzZSAqL1xuXG5jb25zdCBfc2NoZW1hID0gWydlbmFibGVkJ107XG5cbi8qKlxuICogTWFuYWdlcyBjcmVhdGlvbiBvZiB7QGxpbmsgRWxlbWVudENvbXBvbmVudH1zLlxuICpcbiAqIEBhdWdtZW50cyBDb21wb25lbnRTeXN0ZW1cbiAqL1xuY2xhc3MgRWxlbWVudENvbXBvbmVudFN5c3RlbSBleHRlbmRzIENvbXBvbmVudFN5c3RlbSB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEVsZW1lbnRDb21wb25lbnRTeXN0ZW0gaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKiBAaGlkZWNvbnN0cnVjdG9yXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwKSB7XG4gICAgICAgIHN1cGVyKGFwcCk7XG5cbiAgICAgICAgdGhpcy5pZCA9ICdlbGVtZW50JztcblxuICAgICAgICB0aGlzLkNvbXBvbmVudFR5cGUgPSBFbGVtZW50Q29tcG9uZW50O1xuICAgICAgICB0aGlzLkRhdGFUeXBlID0gRWxlbWVudENvbXBvbmVudERhdGE7XG5cbiAgICAgICAgdGhpcy5zY2hlbWEgPSBfc2NoZW1hO1xuICAgICAgICB0aGlzLl91bmljb2RlQ29udmVydGVyID0gbnVsbDtcbiAgICAgICAgdGhpcy5fcnRsUmVvcmRlciA9IG51bGw7XG5cbiAgICAgICAgLy8gZGVmYXVsdCB0ZXh0dXJlIC0gbWFrZSB3aGl0ZSBzbyB3ZSBjYW4gdGludCBpdCB3aXRoIGVtaXNzaXZlIGNvbG9yXG4gICAgICAgIHRoaXMuX2RlZmF1bHRUZXh0dXJlID0gbmV3IFRleHR1cmUoYXBwLmdyYXBoaWNzRGV2aWNlLCB7XG4gICAgICAgICAgICB3aWR0aDogMSxcbiAgICAgICAgICAgIGhlaWdodDogMSxcbiAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsXG4gICAgICAgICAgICBuYW1lOiAnZWxlbWVudC1zeXN0ZW0nXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBwaXhlbHMgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZS5sb2NrKCk7XG4gICAgICAgIGNvbnN0IHBpeGVsRGF0YSA9IG5ldyBVaW50OEFycmF5KDQpO1xuICAgICAgICBwaXhlbERhdGFbMF0gPSAyNTUuMDtcbiAgICAgICAgcGl4ZWxEYXRhWzFdID0gMjU1LjA7XG4gICAgICAgIHBpeGVsRGF0YVsyXSA9IDI1NS4wO1xuICAgICAgICBwaXhlbERhdGFbM10gPSAyNTUuMDtcbiAgICAgICAgcGl4ZWxzLnNldChwaXhlbERhdGEpO1xuICAgICAgICB0aGlzLl9kZWZhdWx0VGV4dHVyZS51bmxvY2soKTtcblxuICAgICAgICAvLyBpbWFnZSBlbGVtZW50IG1hdGVyaWFscyBjcmVhdGVkIG9uIGRlbWFuZCBieSBnZXRJbWFnZUVsZW1lbnRNYXRlcmlhbCgpXG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwgPSBudWxsO1xuXG4gICAgICAgIC8vIHRleHQgZWxlbWVudCBtYXRlcmlhbHMgY3JlYXRlZCBvbiBkZW1hbmQgYnkgZ2V0VGV4dEVsZW1lbnRNYXRlcmlhbCgpXG4gICAgICAgIHRoaXMuX2RlZmF1bHRUZXh0TWF0ZXJpYWxzID0ge307XG5cbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMgPSBbXTtcblxuICAgICAgICB0aGlzLm9uKCdiZWZvcmVyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlQ29tcG9uZW50LCB0aGlzKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG5cbiAgICAgICAgdGhpcy5fZGVmYXVsdFRleHR1cmUuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIGluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcykge1xuICAgICAgICBjb21wb25lbnQuX2JlaW5nSW5pdGlhbGl6ZWQgPSB0cnVlO1xuXG4gICAgICAgIGlmIChkYXRhLmFuY2hvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5hbmNob3IgaW5zdGFuY2VvZiBWZWM0KSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmFuY2hvci5jb3B5KGRhdGEuYW5jaG9yKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmFuY2hvci5zZXQoZGF0YS5hbmNob3JbMF0sIGRhdGEuYW5jaG9yWzFdLCBkYXRhLmFuY2hvclsyXSwgZGF0YS5hbmNob3JbM10pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEucGl2b3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgaWYgKGRhdGEucGl2b3QgaW5zdGFuY2VvZiBWZWMyKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnBpdm90LmNvcHkoZGF0YS5waXZvdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5waXZvdC5zZXQoZGF0YS5waXZvdFswXSwgZGF0YS5waXZvdFsxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcGxpdEhvckFuY2hvcnMgPSBNYXRoLmFicyhjb21wb25lbnQuYW5jaG9yLnggLSBjb21wb25lbnQuYW5jaG9yLnopID4gMC4wMDE7XG4gICAgICAgIGNvbnN0IHNwbGl0VmVyQW5jaG9ycyA9IE1hdGguYWJzKGNvbXBvbmVudC5hbmNob3IueSAtIGNvbXBvbmVudC5hbmNob3IudykgPiAwLjAwMTtcbiAgICAgICAgbGV0IF9tYXJnaW5DaGFuZ2UgPSBmYWxzZTtcbiAgICAgICAgbGV0IGNvbG9yO1xuXG4gICAgICAgIGlmIChkYXRhLm1hcmdpbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5tYXJnaW4gaW5zdGFuY2VvZiBWZWM0KSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Lm1hcmdpbi5jb3B5KGRhdGEubWFyZ2luKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4uc2V0KGRhdGEubWFyZ2luWzBdLCBkYXRhLm1hcmdpblsxXSwgZGF0YS5tYXJnaW5bMl0sIGRhdGEubWFyZ2luWzNdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgX21hcmdpbkNoYW5nZSA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5sZWZ0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5fbWFyZ2luLnggPSBkYXRhLmxlZnQ7XG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS5ib3R0b20gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4ueSA9IGRhdGEuYm90dG9tO1xuICAgICAgICAgICAgX21hcmdpbkNoYW5nZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEucmlnaHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4ueiA9IGRhdGEucmlnaHQ7XG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS50b3AgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4udyA9IGRhdGEudG9wO1xuICAgICAgICAgICAgX21hcmdpbkNoYW5nZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKF9tYXJnaW5DaGFuZ2UpIHtcbiAgICAgICAgICAgIC8vIGZvcmNlIHVwZGF0ZVxuICAgICAgICAgICAgY29tcG9uZW50Lm1hcmdpbiA9IGNvbXBvbmVudC5fbWFyZ2luO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHNob3VsZEZvcmNlU2V0QW5jaG9yID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGRhdGEud2lkdGggIT09IHVuZGVmaW5lZCAmJiAhc3BsaXRIb3JBbmNob3JzKSB7XG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIGNvbXBvbmVudC53aWR0aCA9IGRhdGEud2lkdGg7XG4gICAgICAgIH0gZWxzZSBpZiAoc3BsaXRIb3JBbmNob3JzKSB7XG4gICAgICAgICAgICBzaG91bGRGb3JjZVNldEFuY2hvciA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRhdGEuaGVpZ2h0ICE9PSB1bmRlZmluZWQgJiYgIXNwbGl0VmVyQW5jaG9ycykge1xuICAgICAgICAgICAgLy8gZm9yY2UgdXBkYXRlXG4gICAgICAgICAgICBjb21wb25lbnQuaGVpZ2h0ID0gZGF0YS5oZWlnaHQ7XG4gICAgICAgIH0gZWxzZSBpZiAoc3BsaXRWZXJBbmNob3JzKSB7XG4gICAgICAgICAgICBzaG91bGRGb3JjZVNldEFuY2hvciA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2hvdWxkRm9yY2VTZXRBbmNob3IpIHtcbiAgICAgICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIGNvbXBvbmVudC5hbmNob3IgPSBjb21wb25lbnQuYW5jaG9yO1xuICAgICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1zZWxmLWFzc2lnbiAqL1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEuZW5hYmxlZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuZW5hYmxlZCA9IGRhdGEuZW5hYmxlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkYXRhLnVzZUlucHV0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC51c2VJbnB1dCA9IGRhdGEudXNlSW5wdXQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5maXRNb2RlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5maXRNb2RlID0gZGF0YS5maXRNb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50LmJhdGNoR3JvdXBJZCA9IGRhdGEuYmF0Y2hHcm91cElkID09PSB1bmRlZmluZWQgfHwgZGF0YS5iYXRjaEdyb3VwSWQgPT09IG51bGwgPyAtMSA6IGRhdGEuYmF0Y2hHcm91cElkO1xuXG4gICAgICAgIGlmIChkYXRhLmxheWVycyAmJiBBcnJheS5pc0FycmF5KGRhdGEubGF5ZXJzKSkge1xuICAgICAgICAgICAgY29tcG9uZW50LmxheWVycyA9IGRhdGEubGF5ZXJzLnNsaWNlKDApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEudHlwZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQudHlwZSA9IGRhdGEudHlwZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjb21wb25lbnQudHlwZSA9PT0gRUxFTUVOVFRZUEVfSU1BR0UpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLnJlY3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5yZWN0ID0gZGF0YS5yZWN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEuY29sb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbG9yID0gZGF0YS5jb2xvcjtcbiAgICAgICAgICAgICAgICBpZiAoIShjb2xvciBpbnN0YW5jZW9mIENvbG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb2xvciA9IG5ldyBDb2xvcihkYXRhLmNvbG9yWzBdLCBkYXRhLmNvbG9yWzFdLCBkYXRhLmNvbG9yWzJdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmNvbG9yID0gY29sb3I7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkYXRhLm9wYWNpdHkgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm9wYWNpdHkgPSBkYXRhLm9wYWNpdHk7XG4gICAgICAgICAgICBpZiAoZGF0YS50ZXh0dXJlQXNzZXQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnRleHR1cmVBc3NldCA9IGRhdGEudGV4dHVyZUFzc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEudGV4dHVyZSkgY29tcG9uZW50LnRleHR1cmUgPSBkYXRhLnRleHR1cmU7XG4gICAgICAgICAgICBpZiAoZGF0YS5zcHJpdGVBc3NldCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuc3ByaXRlQXNzZXQgPSBkYXRhLnNwcml0ZUFzc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEuc3ByaXRlKSBjb21wb25lbnQuc3ByaXRlID0gZGF0YS5zcHJpdGU7XG4gICAgICAgICAgICBpZiAoZGF0YS5zcHJpdGVGcmFtZSAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuc3ByaXRlRnJhbWUgPSBkYXRhLnNwcml0ZUZyYW1lO1xuICAgICAgICAgICAgaWYgKGRhdGEucGl4ZWxzUGVyVW5pdCAhPT0gdW5kZWZpbmVkICYmIGRhdGEucGl4ZWxzUGVyVW5pdCAhPT0gbnVsbCkgY29tcG9uZW50LnBpeGVsc1BlclVuaXQgPSBkYXRhLnBpeGVsc1BlclVuaXQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5tYXRlcmlhbEFzc2V0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5tYXRlcmlhbEFzc2V0ID0gZGF0YS5tYXRlcmlhbEFzc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEubWF0ZXJpYWwpIGNvbXBvbmVudC5tYXRlcmlhbCA9IGRhdGEubWF0ZXJpYWw7XG5cbiAgICAgICAgICAgIGlmIChkYXRhLm1hc2sgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5tYXNrID0gZGF0YS5tYXNrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNvbXBvbmVudC50eXBlID09PSBFTEVNRU5UVFlQRV9URVhUKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5hdXRvV2lkdGggIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmF1dG9XaWR0aCA9IGRhdGEuYXV0b1dpZHRoO1xuICAgICAgICAgICAgaWYgKGRhdGEuYXV0b0hlaWdodCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuYXV0b0hlaWdodCA9IGRhdGEuYXV0b0hlaWdodDtcbiAgICAgICAgICAgIGlmIChkYXRhLnJ0bFJlb3JkZXIgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnJ0bFJlb3JkZXIgPSBkYXRhLnJ0bFJlb3JkZXI7XG4gICAgICAgICAgICBpZiAoZGF0YS51bmljb2RlQ29udmVydGVyICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC51bmljb2RlQ29udmVydGVyID0gZGF0YS51bmljb2RlQ29udmVydGVyO1xuICAgICAgICAgICAgaWYgKGRhdGEudGV4dCAhPT0gbnVsbCAmJiBkYXRhLnRleHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC50ZXh0ID0gZGF0YS50ZXh0O1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkYXRhLmtleSAhPT0gbnVsbCAmJiBkYXRhLmtleSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmtleSA9IGRhdGEua2V5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEuY29sb3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbG9yID0gZGF0YS5jb2xvcjtcbiAgICAgICAgICAgICAgICBpZiAoIShjb2xvciBpbnN0YW5jZW9mIENvbG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb2xvciA9IG5ldyBDb2xvcihjb2xvclswXSwgY29sb3JbMV0sIGNvbG9yWzJdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmNvbG9yID0gY29sb3I7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YS5vcGFjaXR5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQub3BhY2l0eSA9IGRhdGEub3BhY2l0eTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkYXRhLnNwYWNpbmcgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnNwYWNpbmcgPSBkYXRhLnNwYWNpbmc7XG4gICAgICAgICAgICBpZiAoZGF0YS5mb250U2l6ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LmZvbnRTaXplID0gZGF0YS5mb250U2l6ZTtcbiAgICAgICAgICAgICAgICBpZiAoIWRhdGEubGluZUhlaWdodCkgY29tcG9uZW50LmxpbmVIZWlnaHQgPSBkYXRhLmZvbnRTaXplO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEubGluZUhlaWdodCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQubGluZUhlaWdodCA9IGRhdGEubGluZUhlaWdodDtcbiAgICAgICAgICAgIGlmIChkYXRhLm1heExpbmVzICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5tYXhMaW5lcyA9IGRhdGEubWF4TGluZXM7XG4gICAgICAgICAgICBpZiAoZGF0YS53cmFwTGluZXMgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LndyYXBMaW5lcyA9IGRhdGEud3JhcExpbmVzO1xuICAgICAgICAgICAgaWYgKGRhdGEubWluRm9udFNpemUgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1pbkZvbnRTaXplID0gZGF0YS5taW5Gb250U2l6ZTtcbiAgICAgICAgICAgIGlmIChkYXRhLm1heEZvbnRTaXplICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5tYXhGb250U2l6ZSA9IGRhdGEubWF4Rm9udFNpemU7XG4gICAgICAgICAgICBpZiAoZGF0YS5hdXRvRml0V2lkdGgpIGNvbXBvbmVudC5hdXRvRml0V2lkdGggPSBkYXRhLmF1dG9GaXRXaWR0aDtcbiAgICAgICAgICAgIGlmIChkYXRhLmF1dG9GaXRIZWlnaHQpIGNvbXBvbmVudC5hdXRvRml0SGVpZ2h0ID0gZGF0YS5hdXRvRml0SGVpZ2h0O1xuICAgICAgICAgICAgaWYgKGRhdGEuZm9udEFzc2V0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5mb250QXNzZXQgPSBkYXRhLmZvbnRBc3NldDtcbiAgICAgICAgICAgIGlmIChkYXRhLmZvbnQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmZvbnQgPSBkYXRhLmZvbnQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5hbGlnbm1lbnQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmFsaWdubWVudCA9IGRhdGEuYWxpZ25tZW50O1xuICAgICAgICAgICAgaWYgKGRhdGEub3V0bGluZUNvbG9yICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5vdXRsaW5lQ29sb3IgPSBkYXRhLm91dGxpbmVDb2xvcjtcbiAgICAgICAgICAgIGlmIChkYXRhLm91dGxpbmVUaGlja25lc3MgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm91dGxpbmVUaGlja25lc3MgPSBkYXRhLm91dGxpbmVUaGlja25lc3M7XG4gICAgICAgICAgICBpZiAoZGF0YS5zaGFkb3dDb2xvciAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuc2hhZG93Q29sb3IgPSBkYXRhLnNoYWRvd0NvbG9yO1xuICAgICAgICAgICAgaWYgKGRhdGEuc2hhZG93T2Zmc2V0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zaGFkb3dPZmZzZXQgPSBkYXRhLnNoYWRvd09mZnNldDtcbiAgICAgICAgICAgIGlmIChkYXRhLmVuYWJsZU1hcmt1cCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuZW5hYmxlTWFya3VwID0gZGF0YS5lbmFibGVNYXJrdXA7XG4gICAgICAgIH1cbiAgICAgICAgLy8gT1RIRVJXSVNFOiBncm91cFxuXG4gICAgICAgIC8vIGZpbmQgc2NyZWVuXG4gICAgICAgIC8vIGRvIHRoaXMgaGVyZSBub3QgaW4gY29uc3RydWN0b3Igc28gdGhhdCBjb21wb25lbnQgaXMgYWRkZWQgdG8gdGhlIGVudGl0eVxuICAgICAgICBjb25zdCByZXN1bHQgPSBjb21wb25lbnQuX3BhcnNlVXBUb1NjcmVlbigpO1xuICAgICAgICBpZiAocmVzdWx0LnNjcmVlbikge1xuICAgICAgICAgICAgY29tcG9uZW50Ll91cGRhdGVTY3JlZW4ocmVzdWx0LnNjcmVlbik7XG4gICAgICAgIH1cblxuICAgICAgICBzdXBlci5pbml0aWFsaXplQ29tcG9uZW50RGF0YShjb21wb25lbnQsIGRhdGEsIHByb3BlcnRpZXMpO1xuXG4gICAgICAgIGNvbXBvbmVudC5fYmVpbmdJbml0aWFsaXplZCA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChjb21wb25lbnQudHlwZSA9PT0gRUxFTUVOVFRZUEVfSU1BR0UgJiYgY29tcG9uZW50Ll9pbWFnZS5fbWVzaERpcnR5KSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX2ltYWdlLl91cGRhdGVNZXNoKGNvbXBvbmVudC5faW1hZ2UubWVzaCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblJlbW92ZUNvbXBvbmVudChlbnRpdHksIGNvbXBvbmVudCkge1xuICAgICAgICBjb21wb25lbnQub25SZW1vdmUoKTtcbiAgICB9XG5cbiAgICBjbG9uZUNvbXBvbmVudChlbnRpdHksIGNsb25lKSB7XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IGVudGl0eS5lbGVtZW50O1xuXG4gICAgICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICAgICAgICBlbmFibGVkOiBzb3VyY2UuZW5hYmxlZCxcbiAgICAgICAgICAgIHdpZHRoOiBzb3VyY2Uud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHNvdXJjZS5oZWlnaHQsXG4gICAgICAgICAgICBhbmNob3I6IHNvdXJjZS5hbmNob3IuY2xvbmUoKSxcbiAgICAgICAgICAgIHBpdm90OiBzb3VyY2UucGl2b3QuY2xvbmUoKSxcbiAgICAgICAgICAgIG1hcmdpbjogc291cmNlLm1hcmdpbi5jbG9uZSgpLFxuICAgICAgICAgICAgYWxpZ25tZW50OiBzb3VyY2UuYWxpZ25tZW50ICYmIHNvdXJjZS5hbGlnbm1lbnQuY2xvbmUoKSB8fCBzb3VyY2UuYWxpZ25tZW50LFxuICAgICAgICAgICAgYXV0b1dpZHRoOiBzb3VyY2UuYXV0b1dpZHRoLFxuICAgICAgICAgICAgYXV0b0hlaWdodDogc291cmNlLmF1dG9IZWlnaHQsXG4gICAgICAgICAgICB0eXBlOiBzb3VyY2UudHlwZSxcbiAgICAgICAgICAgIHJlY3Q6IHNvdXJjZS5yZWN0ICYmIHNvdXJjZS5yZWN0LmNsb25lKCkgfHwgc291cmNlLnJlY3QsXG4gICAgICAgICAgICBydGxSZW9yZGVyOiBzb3VyY2UucnRsUmVvcmRlcixcbiAgICAgICAgICAgIHVuaWNvZGVDb252ZXJ0ZXI6IHNvdXJjZS51bmljb2RlQ29udmVydGVyLFxuICAgICAgICAgICAgbWF0ZXJpYWxBc3NldDogc291cmNlLm1hdGVyaWFsQXNzZXQsXG4gICAgICAgICAgICBtYXRlcmlhbDogc291cmNlLm1hdGVyaWFsLFxuICAgICAgICAgICAgY29sb3I6IHNvdXJjZS5jb2xvciAmJiBzb3VyY2UuY29sb3IuY2xvbmUoKSB8fCBzb3VyY2UuY29sb3IsXG4gICAgICAgICAgICBvcGFjaXR5OiBzb3VyY2Uub3BhY2l0eSxcbiAgICAgICAgICAgIHRleHR1cmVBc3NldDogc291cmNlLnRleHR1cmVBc3NldCxcbiAgICAgICAgICAgIHRleHR1cmU6IHNvdXJjZS50ZXh0dXJlLFxuICAgICAgICAgICAgc3ByaXRlQXNzZXQ6IHNvdXJjZS5zcHJpdGVBc3NldCxcbiAgICAgICAgICAgIHNwcml0ZTogc291cmNlLnNwcml0ZSxcbiAgICAgICAgICAgIHNwcml0ZUZyYW1lOiBzb3VyY2Uuc3ByaXRlRnJhbWUsXG4gICAgICAgICAgICBwaXhlbHNQZXJVbml0OiBzb3VyY2UucGl4ZWxzUGVyVW5pdCxcbiAgICAgICAgICAgIHNwYWNpbmc6IHNvdXJjZS5zcGFjaW5nLFxuICAgICAgICAgICAgbGluZUhlaWdodDogc291cmNlLmxpbmVIZWlnaHQsXG4gICAgICAgICAgICB3cmFwTGluZXM6IHNvdXJjZS53cmFwTGluZXMsXG4gICAgICAgICAgICBsYXllcnM6IHNvdXJjZS5sYXllcnMsXG4gICAgICAgICAgICBmb250U2l6ZTogc291cmNlLmZvbnRTaXplLFxuICAgICAgICAgICAgbWluRm9udFNpemU6IHNvdXJjZS5taW5Gb250U2l6ZSxcbiAgICAgICAgICAgIG1heEZvbnRTaXplOiBzb3VyY2UubWF4Rm9udFNpemUsXG4gICAgICAgICAgICBhdXRvRml0V2lkdGg6IHNvdXJjZS5hdXRvRml0V2lkdGgsXG4gICAgICAgICAgICBhdXRvRml0SGVpZ2h0OiBzb3VyY2UuYXV0b0ZpdEhlaWdodCxcbiAgICAgICAgICAgIG1heExpbmVzOiBzb3VyY2UubWF4TGluZXMsXG4gICAgICAgICAgICBmb250QXNzZXQ6IHNvdXJjZS5mb250QXNzZXQsXG4gICAgICAgICAgICBmb250OiBzb3VyY2UuZm9udCxcbiAgICAgICAgICAgIHVzZUlucHV0OiBzb3VyY2UudXNlSW5wdXQsXG4gICAgICAgICAgICBmaXRNb2RlOiBzb3VyY2UuZml0TW9kZSxcbiAgICAgICAgICAgIGJhdGNoR3JvdXBJZDogc291cmNlLmJhdGNoR3JvdXBJZCxcbiAgICAgICAgICAgIG1hc2s6IHNvdXJjZS5tYXNrLFxuICAgICAgICAgICAgb3V0bGluZUNvbG9yOiBzb3VyY2Uub3V0bGluZUNvbG9yICYmIHNvdXJjZS5vdXRsaW5lQ29sb3IuY2xvbmUoKSB8fCBzb3VyY2Uub3V0bGluZUNvbG9yLFxuICAgICAgICAgICAgb3V0bGluZVRoaWNrbmVzczogc291cmNlLm91dGxpbmVUaGlja25lc3MsXG4gICAgICAgICAgICBzaGFkb3dDb2xvcjogc291cmNlLnNoYWRvd0NvbG9yICYmIHNvdXJjZS5zaGFkb3dDb2xvci5jbG9uZSgpIHx8IHNvdXJjZS5zaGFkb3dDb2xvcixcbiAgICAgICAgICAgIHNoYWRvd09mZnNldDogc291cmNlLnNoYWRvd09mZnNldCAmJiBzb3VyY2Uuc2hhZG93T2Zmc2V0LmNsb25lKCkgfHwgc291cmNlLnNoYWRvd09mZnNldCxcbiAgICAgICAgICAgIGVuYWJsZU1hcmt1cDogc291cmNlLmVuYWJsZU1hcmt1cFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChzb3VyY2Uua2V5ICE9PSB1bmRlZmluZWQgJiYgc291cmNlLmtleSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgZGF0YS5rZXkgPSBzb3VyY2Uua2V5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGF0YS50ZXh0ID0gc291cmNlLnRleHQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5hZGRDb21wb25lbnQoY2xvbmUsIGRhdGEpO1xuICAgIH1cblxuICAgIGdldFRleHRFbGVtZW50TWF0ZXJpYWwoc2NyZWVuU3BhY2UsIG1zZGYsIHRleHRBdHRpYnV0ZXMpIHtcbiAgICAgICAgY29uc3QgaGFzaCA9IChzY3JlZW5TcGFjZSAmJiAoMSA8PCAwKSkgfFxuICAgICAgICAgICAgICAgICAgICAgICAgICAobXNkZiAmJiAoMSA8PCAxKSkgfFxuICAgICAgICAgICAgICAgICAodGV4dEF0dGlidXRlcyAmJiAoMSA8PCAyKSk7XG5cbiAgICAgICAgbGV0IG1hdGVyaWFsID0gdGhpcy5fZGVmYXVsdFRleHRNYXRlcmlhbHNbaGFzaF07XG5cbiAgICAgICAgaWYgKG1hdGVyaWFsKSB7XG4gICAgICAgICAgICByZXR1cm4gbWF0ZXJpYWw7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbmFtZSA9IFwiVGV4dE1hdGVyaWFsXCI7XG5cbiAgICAgICAgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuXG4gICAgICAgIGlmIChtc2RmKSB7XG4gICAgICAgICAgICBtYXRlcmlhbC5tc2RmTWFwID0gdGhpcy5fZGVmYXVsdFRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5tc2RmVGV4dEF0dHJpYnV0ZSA9IHRleHRBdHRpYnV0ZXM7XG4gICAgICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoMSwgMSwgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuYW1lID0gXCJCaXRtYXBcIiArIG5hbWU7XG4gICAgICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoMC41LCAwLjUsIDAuNSk7IC8vIHNldCB0byBub24tKDEsMSwxKSBzbyB0aGF0IHRpbnQgaXMgYWN0dWFsbHkgYXBwbGllZFxuICAgICAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IHRydWU7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwID0gdGhpcy5fZGVmYXVsdFRleHR1cmU7XG4gICAgICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgbmFtZSA9ICdTY3JlZW5TcGFjZScgKyBuYW1lO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgbWF0ZXJpYWwgbmFtZSBjYW4gYmU6XG4gICAgICAgIC8vICBkZWZhdWx0VGV4dE1hdGVyaWFsXG4gICAgICAgIC8vICBkZWZhdWx0Qml0bWFwVGV4dE1hdGVyaWFsXG4gICAgICAgIC8vICBkZWZhdWx0U2NyZWVuU3BhY2VUZXh0TWF0ZXJpYWxcbiAgICAgICAgLy8gIGRlZmF1bHRTY3JlZW5TcGFjZUJpdG1hcFRleHRNYXRlcmlhbFxuICAgICAgICBtYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHQnICsgbmFtZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlTGlnaHRpbmcgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlR2FtbWFUb25lbWFwID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLnVzZUZvZyA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC51c2VTa3lib3ggPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMCwgMCwgMCk7IC8vIGJsYWNrIGRpZmZ1c2UgY29sb3IgdG8gcHJldmVudCBhbWJpZW50IGxpZ2h0IGJlaW5nIGluY2x1ZGVkXG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHkgPSAwLjU7XG4gICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX1BSRU1VTFRJUExJRUQ7XG4gICAgICAgIG1hdGVyaWFsLmRlcHRoV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVWZXJ0ZXhDb2xvciA9IHRydWU7XG4gICAgICAgIG1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgIHRoaXMuX2RlZmF1bHRUZXh0TWF0ZXJpYWxzW2hhc2hdID0gbWF0ZXJpYWw7XG5cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH1cblxuICAgIF9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpIHtcbiAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbCgpO1xuXG4gICAgICAgIG1hdGVyaWFsLmRpZmZ1c2Uuc2V0KDAsIDAsIDApOyAvLyBibGFjayBkaWZmdXNlIGNvbG9yIHRvIHByZXZlbnQgYW1iaWVudCBsaWdodCBiZWluZyBpbmNsdWRlZFxuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZS5zZXQoMC41LCAwLjUsIDAuNSk7IC8vIHVzZSBub24td2hpdGUgdG8gY29tcGlsZSBzaGFkZXIgY29ycmVjdGx5XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlTWFwID0gdGhpcy5fZGVmYXVsdFRleHR1cmU7XG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlVGludCA9IHRydWU7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcENoYW5uZWwgPSAnYSc7XG4gICAgICAgIG1hdGVyaWFsLm9wYWNpdHlUaW50ID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IDA7IC8vIHVzZSBub24tMSBvcGFjaXR5IHRvIGNvbXBpbGUgc2hhZGVyIGNvcnJlY3RseVxuICAgICAgICBtYXRlcmlhbC51c2VMaWdodGluZyA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC51c2VHYW1tYVRvbmVtYXAgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlRm9nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLnVzZVNreWJveCA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC5ibGVuZFR5cGUgPSBCTEVORF9QUkVNVUxUSVBMSUVEO1xuICAgICAgICBtYXRlcmlhbC5kZXB0aFdyaXRlID0gZmFsc2U7XG5cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsO1xuICAgIH1cblxuICAgIGdldEltYWdlRWxlbWVudE1hdGVyaWFsKHNjcmVlblNwYWNlLCBtYXNrLCBuaW5lU2xpY2VkLCBuaW5lU2xpY2VUaWxlZCkge1xuICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1lbHNlLXJldHVybiAqL1xuICAgICAgICBpZiAoc2NyZWVuU3BhY2UpIHtcbiAgICAgICAgICAgIGlmIChtYXNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5pbmVTbGljZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLmFscGhhVGVzdCA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwuYmx1ZVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmluZVNsaWNlVGlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsID0gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsLmNsb25lKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwucmVkV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwuYWxwaGFXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLmFscGhhVGVzdCA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLmdyZWVuV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuYmx1ZVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWxzLnB1c2godGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobmluZVNsaWNlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG5pbmVTbGljZVRpbGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsID0gdGhpcy5fY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAobWFzaykge1xuICAgICAgICAgICAgICAgIGlmIChuaW5lU2xpY2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLmdyZWVuV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWxzLnB1c2godGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmluZVNsaWNlVGlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsLmFscGhhVGVzdCA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwuYmx1ZVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsID0gdGhpcy5fY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdEltYWdlTWFza01hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLmFscGhhVGVzdCA9IDE7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwuYmx1ZVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKG5pbmVTbGljZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmluZVNsaWNlVGlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsID0gdGhpcy5fY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsLm5pbmVTbGljZWRNb2RlID0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdEltYWdlTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1lbHNlLXJldHVybiAqL1xuICAgIH1cblxuICAgIHJlZ2lzdGVyVW5pY29kZUNvbnZlcnRlcihmdW5jKSB7XG4gICAgICAgIHRoaXMuX3VuaWNvZGVDb252ZXJ0ZXIgPSBmdW5jO1xuICAgIH1cblxuICAgIHJlZ2lzdGVyUnRsUmVvcmRlcihmdW5jKSB7XG4gICAgICAgIHRoaXMuX3J0bFJlb3JkZXIgPSBmdW5jO1xuICAgIH1cblxuICAgIGdldFVuaWNvZGVDb252ZXJ0ZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91bmljb2RlQ29udmVydGVyO1xuICAgIH1cblxuICAgIGdldFJ0bFJlb3JkZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9ydGxSZW9yZGVyO1xuICAgIH1cbn1cblxuQ29tcG9uZW50Ll9idWlsZEFjY2Vzc29ycyhFbGVtZW50Q29tcG9uZW50LnByb3RvdHlwZSwgX3NjaGVtYSk7XG5cbmV4cG9ydCB7IEVsZW1lbnRDb21wb25lbnRTeXN0ZW0gfTtcbiJdLCJuYW1lcyI6WyJfc2NoZW1hIiwiRWxlbWVudENvbXBvbmVudFN5c3RlbSIsIkNvbXBvbmVudFN5c3RlbSIsImNvbnN0cnVjdG9yIiwiYXBwIiwiaWQiLCJDb21wb25lbnRUeXBlIiwiRWxlbWVudENvbXBvbmVudCIsIkRhdGFUeXBlIiwiRWxlbWVudENvbXBvbmVudERhdGEiLCJzY2hlbWEiLCJfdW5pY29kZUNvbnZlcnRlciIsIl9ydGxSZW9yZGVyIiwiX2RlZmF1bHRUZXh0dXJlIiwiVGV4dHVyZSIsImdyYXBoaWNzRGV2aWNlIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCIsIm5hbWUiLCJwaXhlbHMiLCJsb2NrIiwicGl4ZWxEYXRhIiwiVWludDhBcnJheSIsInNldCIsInVubG9jayIsImRlZmF1bHRJbWFnZU1hdGVyaWFsIiwiZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsIiwiZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsIiwiZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCIsImRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwiLCJfZGVmYXVsdFRleHRNYXRlcmlhbHMiLCJkZWZhdWx0SW1hZ2VNYXRlcmlhbHMiLCJvbiIsIm9uUmVtb3ZlQ29tcG9uZW50IiwiZGVzdHJveSIsImluaXRpYWxpemVDb21wb25lbnREYXRhIiwiY29tcG9uZW50IiwiZGF0YSIsInByb3BlcnRpZXMiLCJfYmVpbmdJbml0aWFsaXplZCIsImFuY2hvciIsInVuZGVmaW5lZCIsIlZlYzQiLCJjb3B5IiwicGl2b3QiLCJWZWMyIiwic3BsaXRIb3JBbmNob3JzIiwiTWF0aCIsImFicyIsIngiLCJ6Iiwic3BsaXRWZXJBbmNob3JzIiwieSIsInciLCJfbWFyZ2luQ2hhbmdlIiwiY29sb3IiLCJtYXJnaW4iLCJfbWFyZ2luIiwibGVmdCIsImJvdHRvbSIsInJpZ2h0IiwidG9wIiwic2hvdWxkRm9yY2VTZXRBbmNob3IiLCJlbmFibGVkIiwidXNlSW5wdXQiLCJmaXRNb2RlIiwiYmF0Y2hHcm91cElkIiwibGF5ZXJzIiwiQXJyYXkiLCJpc0FycmF5Iiwic2xpY2UiLCJ0eXBlIiwiRUxFTUVOVFRZUEVfSU1BR0UiLCJyZWN0IiwiQ29sb3IiLCJvcGFjaXR5IiwidGV4dHVyZUFzc2V0IiwidGV4dHVyZSIsInNwcml0ZUFzc2V0Iiwic3ByaXRlIiwic3ByaXRlRnJhbWUiLCJwaXhlbHNQZXJVbml0IiwibWF0ZXJpYWxBc3NldCIsIm1hdGVyaWFsIiwibWFzayIsIkVMRU1FTlRUWVBFX1RFWFQiLCJhdXRvV2lkdGgiLCJhdXRvSGVpZ2h0IiwicnRsUmVvcmRlciIsInVuaWNvZGVDb252ZXJ0ZXIiLCJ0ZXh0Iiwia2V5Iiwic3BhY2luZyIsImZvbnRTaXplIiwibGluZUhlaWdodCIsIm1heExpbmVzIiwid3JhcExpbmVzIiwibWluRm9udFNpemUiLCJtYXhGb250U2l6ZSIsImF1dG9GaXRXaWR0aCIsImF1dG9GaXRIZWlnaHQiLCJmb250QXNzZXQiLCJmb250IiwiYWxpZ25tZW50Iiwib3V0bGluZUNvbG9yIiwib3V0bGluZVRoaWNrbmVzcyIsInNoYWRvd0NvbG9yIiwic2hhZG93T2Zmc2V0IiwiZW5hYmxlTWFya3VwIiwicmVzdWx0IiwiX3BhcnNlVXBUb1NjcmVlbiIsInNjcmVlbiIsIl91cGRhdGVTY3JlZW4iLCJfaW1hZ2UiLCJfbWVzaERpcnR5IiwiX3VwZGF0ZU1lc2giLCJtZXNoIiwiZW50aXR5Iiwib25SZW1vdmUiLCJjbG9uZUNvbXBvbmVudCIsImNsb25lIiwic291cmNlIiwiZWxlbWVudCIsImFkZENvbXBvbmVudCIsImdldFRleHRFbGVtZW50TWF0ZXJpYWwiLCJzY3JlZW5TcGFjZSIsIm1zZGYiLCJ0ZXh0QXR0aWJ1dGVzIiwiaGFzaCIsIlN0YW5kYXJkTWF0ZXJpYWwiLCJtc2RmTWFwIiwibXNkZlRleHRBdHRyaWJ1dGUiLCJlbWlzc2l2ZSIsImVtaXNzaXZlTWFwIiwiZW1pc3NpdmVUaW50Iiwib3BhY2l0eU1hcCIsIm9wYWNpdHlNYXBDaGFubmVsIiwiZGVwdGhUZXN0IiwidXNlTGlnaHRpbmciLCJ1c2VHYW1tYVRvbmVtYXAiLCJ1c2VGb2ciLCJ1c2VTa3lib3giLCJkaWZmdXNlIiwiYmxlbmRUeXBlIiwiQkxFTkRfUFJFTVVMVElQTElFRCIsImRlcHRoV3JpdGUiLCJlbWlzc2l2ZVZlcnRleENvbG9yIiwidXBkYXRlIiwiX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsIiwib3BhY2l0eVRpbnQiLCJnZXRJbWFnZUVsZW1lbnRNYXRlcmlhbCIsIm5pbmVTbGljZWQiLCJuaW5lU2xpY2VUaWxlZCIsIm5pbmVTbGljZWRNb2RlIiwiU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIiwiYWxwaGFUZXN0IiwicmVkV3JpdGUiLCJncmVlbldyaXRlIiwiYmx1ZVdyaXRlIiwiYWxwaGFXcml0ZSIsInB1c2giLCJTUFJJVEVfUkVOREVSTU9ERV9USUxFRCIsInJlZ2lzdGVyVW5pY29kZUNvbnZlcnRlciIsImZ1bmMiLCJyZWdpc3RlclJ0bFJlb3JkZXIiLCJnZXRVbmljb2RlQ29udmVydGVyIiwiZ2V0UnRsUmVvcmRlciIsIkNvbXBvbmVudCIsIl9idWlsZEFjY2Vzc29ycyIsInByb3RvdHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7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
