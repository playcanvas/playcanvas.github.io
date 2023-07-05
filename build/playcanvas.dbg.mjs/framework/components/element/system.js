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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3lzdGVtLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvZWxlbWVudC9zeXN0ZW0uanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7XG4gICAgUElYRUxGT1JNQVRfUkdCQThcbn0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcblxuaW1wb3J0IHsgQkxFTkRfUFJFTVVMVElQTElFRCwgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VELCBTUFJJVEVfUkVOREVSTU9ERV9USUxFRCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1hdGVyaWFsIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL3N0YW5kYXJkLW1hdGVyaWFsLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IENvbXBvbmVudFN5c3RlbSB9IGZyb20gJy4uL3N5c3RlbS5qcyc7XG5cbmltcG9ydCB7IEVMRU1FTlRUWVBFX0lNQUdFLCBFTEVNRU5UVFlQRV9URVhUIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRWxlbWVudENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50LmpzJztcbmltcG9ydCB7IEVsZW1lbnRDb21wb25lbnREYXRhIH0gZnJvbSAnLi9kYXRhLmpzJztcblxuY29uc3QgX3NjaGVtYSA9IFsnZW5hYmxlZCddO1xuXG4vKipcbiAqIE1hbmFnZXMgY3JlYXRpb24gb2Yge0BsaW5rIEVsZW1lbnRDb21wb25lbnR9cy5cbiAqXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50U3lzdGVtXG4gKi9cbmNsYXNzIEVsZW1lbnRDb21wb25lbnRTeXN0ZW0gZXh0ZW5kcyBDb21wb25lbnRTeXN0ZW0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBFbGVtZW50Q29tcG9uZW50U3lzdGVtIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIGFwcGxpY2F0aW9uLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgc3VwZXIoYXBwKTtcblxuICAgICAgICB0aGlzLmlkID0gJ2VsZW1lbnQnO1xuXG4gICAgICAgIHRoaXMuQ29tcG9uZW50VHlwZSA9IEVsZW1lbnRDb21wb25lbnQ7XG4gICAgICAgIHRoaXMuRGF0YVR5cGUgPSBFbGVtZW50Q29tcG9uZW50RGF0YTtcblxuICAgICAgICB0aGlzLnNjaGVtYSA9IF9zY2hlbWE7XG4gICAgICAgIHRoaXMuX3VuaWNvZGVDb252ZXJ0ZXIgPSBudWxsO1xuICAgICAgICB0aGlzLl9ydGxSZW9yZGVyID0gbnVsbDtcblxuICAgICAgICAvLyBkZWZhdWx0IHRleHR1cmUgLSBtYWtlIHdoaXRlIHNvIHdlIGNhbiB0aW50IGl0IHdpdGggZW1pc3NpdmUgY29sb3JcbiAgICAgICAgdGhpcy5fZGVmYXVsdFRleHR1cmUgPSBuZXcgVGV4dHVyZShhcHAuZ3JhcGhpY3NEZXZpY2UsIHtcbiAgICAgICAgICAgIHdpZHRoOiAxLFxuICAgICAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICAgICAgZm9ybWF0OiBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICAgICAgICAgIG5hbWU6ICdlbGVtZW50LXN5c3RlbSdcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHBpeGVscyA9IHRoaXMuX2RlZmF1bHRUZXh0dXJlLmxvY2soKTtcbiAgICAgICAgY29uc3QgcGl4ZWxEYXRhID0gbmV3IFVpbnQ4QXJyYXkoNCk7XG4gICAgICAgIHBpeGVsRGF0YVswXSA9IDI1NS4wO1xuICAgICAgICBwaXhlbERhdGFbMV0gPSAyNTUuMDtcbiAgICAgICAgcGl4ZWxEYXRhWzJdID0gMjU1LjA7XG4gICAgICAgIHBpeGVsRGF0YVszXSA9IDI1NS4wO1xuICAgICAgICBwaXhlbHMuc2V0KHBpeGVsRGF0YSk7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRUZXh0dXJlLnVubG9jaygpO1xuXG4gICAgICAgIC8vIGltYWdlIGVsZW1lbnQgbWF0ZXJpYWxzIGNyZWF0ZWQgb24gZGVtYW5kIGJ5IGdldEltYWdlRWxlbWVudE1hdGVyaWFsKClcbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwgPSBudWxsO1xuICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsID0gbnVsbDtcbiAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCA9IG51bGw7XG5cbiAgICAgICAgLy8gdGV4dCBlbGVtZW50IG1hdGVyaWFscyBjcmVhdGVkIG9uIGRlbWFuZCBieSBnZXRUZXh0RWxlbWVudE1hdGVyaWFsKClcbiAgICAgICAgdGhpcy5fZGVmYXVsdFRleHRNYXRlcmlhbHMgPSB7fTtcblxuICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscyA9IFtdO1xuXG4gICAgICAgIHRoaXMub24oJ2JlZm9yZXJlbW92ZScsIHRoaXMub25SZW1vdmVDb21wb25lbnQsIHRoaXMpO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHN1cGVyLmRlc3Ryb3koKTtcblxuICAgICAgICB0aGlzLl9kZWZhdWx0VGV4dHVyZS5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEoY29tcG9uZW50LCBkYXRhLCBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGNvbXBvbmVudC5fYmVpbmdJbml0aWFsaXplZCA9IHRydWU7XG5cbiAgICAgICAgaWYgKGRhdGEuYW5jaG9yICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmFuY2hvciBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuYW5jaG9yLmNvcHkoZGF0YS5hbmNob3IpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuYW5jaG9yLnNldChkYXRhLmFuY2hvclswXSwgZGF0YS5hbmNob3JbMV0sIGRhdGEuYW5jaG9yWzJdLCBkYXRhLmFuY2hvclszXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5waXZvdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoZGF0YS5waXZvdCBpbnN0YW5jZW9mIFZlYzIpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQucGl2b3QuY29weShkYXRhLnBpdm90KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnBpdm90LnNldChkYXRhLnBpdm90WzBdLCBkYXRhLnBpdm90WzFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNwbGl0SG9yQW5jaG9ycyA9IE1hdGguYWJzKGNvbXBvbmVudC5hbmNob3IueCAtIGNvbXBvbmVudC5hbmNob3IueikgPiAwLjAwMTtcbiAgICAgICAgY29uc3Qgc3BsaXRWZXJBbmNob3JzID0gTWF0aC5hYnMoY29tcG9uZW50LmFuY2hvci55IC0gY29tcG9uZW50LmFuY2hvci53KSA+IDAuMDAxO1xuICAgICAgICBsZXQgX21hcmdpbkNoYW5nZSA9IGZhbHNlO1xuICAgICAgICBsZXQgY29sb3I7XG5cbiAgICAgICAgaWYgKGRhdGEubWFyZ2luICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLm1hcmdpbiBpbnN0YW5jZW9mIFZlYzQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQubWFyZ2luLmNvcHkoZGF0YS5tYXJnaW4pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuX21hcmdpbi5zZXQoZGF0YS5tYXJnaW5bMF0sIGRhdGEubWFyZ2luWzFdLCBkYXRhLm1hcmdpblsyXSwgZGF0YS5tYXJnaW5bM10pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkYXRhLmxlZnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50Ll9tYXJnaW4ueCA9IGRhdGEubGVmdDtcbiAgICAgICAgICAgIF9tYXJnaW5DaGFuZ2UgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhLmJvdHRvbSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX21hcmdpbi55ID0gZGF0YS5ib3R0b207XG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS5yaWdodCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX21hcmdpbi56ID0gZGF0YS5yaWdodDtcbiAgICAgICAgICAgIF9tYXJnaW5DaGFuZ2UgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkYXRhLnRvcCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX21hcmdpbi53ID0gZGF0YS50b3A7XG4gICAgICAgICAgICBfbWFyZ2luQ2hhbmdlID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoX21hcmdpbkNoYW5nZSkge1xuICAgICAgICAgICAgLy8gZm9yY2UgdXBkYXRlXG4gICAgICAgICAgICBjb21wb25lbnQubWFyZ2luID0gY29tcG9uZW50Ll9tYXJnaW47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc2hvdWxkRm9yY2VTZXRBbmNob3IgPSBmYWxzZTtcblxuICAgICAgICBpZiAoZGF0YS53aWR0aCAhPT0gdW5kZWZpbmVkICYmICFzcGxpdEhvckFuY2hvcnMpIHtcbiAgICAgICAgICAgIC8vIGZvcmNlIHVwZGF0ZVxuICAgICAgICAgICAgY29tcG9uZW50LndpZHRoID0gZGF0YS53aWR0aDtcbiAgICAgICAgfSBlbHNlIGlmIChzcGxpdEhvckFuY2hvcnMpIHtcbiAgICAgICAgICAgIHNob3VsZEZvcmNlU2V0QW5jaG9yID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZGF0YS5oZWlnaHQgIT09IHVuZGVmaW5lZCAmJiAhc3BsaXRWZXJBbmNob3JzKSB7XG4gICAgICAgICAgICAvLyBmb3JjZSB1cGRhdGVcbiAgICAgICAgICAgIGNvbXBvbmVudC5oZWlnaHQgPSBkYXRhLmhlaWdodDtcbiAgICAgICAgfSBlbHNlIGlmIChzcGxpdFZlckFuY2hvcnMpIHtcbiAgICAgICAgICAgIHNob3VsZEZvcmNlU2V0QW5jaG9yID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzaG91bGRGb3JjZVNldEFuY2hvcikge1xuICAgICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgbm8tc2VsZi1hc3NpZ24gKi9cbiAgICAgICAgICAgIC8vIGZvcmNlIHVwZGF0ZVxuICAgICAgICAgICAgY29tcG9uZW50LmFuY2hvciA9IGNvbXBvbmVudC5hbmNob3I7XG4gICAgICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLXNlbGYtYXNzaWduICovXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS5lbmFibGVkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5lbmFibGVkID0gZGF0YS5lbmFibGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRhdGEudXNlSW5wdXQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50LnVzZUlucHV0ID0gZGF0YS51c2VJbnB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkYXRhLmZpdE1vZGUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50LmZpdE1vZGUgPSBkYXRhLmZpdE1vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBjb21wb25lbnQuYmF0Y2hHcm91cElkID0gZGF0YS5iYXRjaEdyb3VwSWQgPT09IHVuZGVmaW5lZCB8fCBkYXRhLmJhdGNoR3JvdXBJZCA9PT0gbnVsbCA/IC0xIDogZGF0YS5iYXRjaEdyb3VwSWQ7XG5cbiAgICAgICAgaWYgKGRhdGEubGF5ZXJzICYmIEFycmF5LmlzQXJyYXkoZGF0YS5sYXllcnMpKSB7XG4gICAgICAgICAgICBjb21wb25lbnQubGF5ZXJzID0gZGF0YS5sYXllcnMuc2xpY2UoMCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGF0YS50eXBlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC50eXBlID0gZGF0YS50eXBlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNvbXBvbmVudC50eXBlID09PSBFTEVNRU5UVFlQRV9JTUFHRSkge1xuICAgICAgICAgICAgaWYgKGRhdGEucmVjdCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnJlY3QgPSBkYXRhLnJlY3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YS5jb2xvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29sb3IgPSBkYXRhLmNvbG9yO1xuICAgICAgICAgICAgICAgIGlmICghKGNvbG9yIGluc3RhbmNlb2YgQ29sb3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yID0gbmV3IENvbG9yKGRhdGEuY29sb3JbMF0sIGRhdGEuY29sb3JbMV0sIGRhdGEuY29sb3JbMl0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb21wb25lbnQuY29sb3IgPSBjb2xvcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGRhdGEub3BhY2l0eSAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQub3BhY2l0eSA9IGRhdGEub3BhY2l0eTtcbiAgICAgICAgICAgIGlmIChkYXRhLnRleHR1cmVBc3NldCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQudGV4dHVyZUFzc2V0ID0gZGF0YS50ZXh0dXJlQXNzZXQ7XG4gICAgICAgICAgICBpZiAoZGF0YS50ZXh0dXJlKSBjb21wb25lbnQudGV4dHVyZSA9IGRhdGEudGV4dHVyZTtcbiAgICAgICAgICAgIGlmIChkYXRhLnNwcml0ZUFzc2V0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zcHJpdGVBc3NldCA9IGRhdGEuc3ByaXRlQXNzZXQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5zcHJpdGUpIGNvbXBvbmVudC5zcHJpdGUgPSBkYXRhLnNwcml0ZTtcbiAgICAgICAgICAgIGlmIChkYXRhLnNwcml0ZUZyYW1lICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zcHJpdGVGcmFtZSA9IGRhdGEuc3ByaXRlRnJhbWU7XG4gICAgICAgICAgICBpZiAoZGF0YS5waXhlbHNQZXJVbml0ICE9PSB1bmRlZmluZWQgJiYgZGF0YS5waXhlbHNQZXJVbml0ICE9PSBudWxsKSBjb21wb25lbnQucGl4ZWxzUGVyVW5pdCA9IGRhdGEucGl4ZWxzUGVyVW5pdDtcbiAgICAgICAgICAgIGlmIChkYXRhLm1hdGVyaWFsQXNzZXQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1hdGVyaWFsQXNzZXQgPSBkYXRhLm1hdGVyaWFsQXNzZXQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5tYXRlcmlhbCkgY29tcG9uZW50Lm1hdGVyaWFsID0gZGF0YS5tYXRlcmlhbDtcblxuICAgICAgICAgICAgaWYgKGRhdGEubWFzayAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Lm1hc2sgPSBkYXRhLm1hc2s7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoY29tcG9uZW50LnR5cGUgPT09IEVMRU1FTlRUWVBFX1RFWFQpIHtcbiAgICAgICAgICAgIGlmIChkYXRhLmF1dG9XaWR0aCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuYXV0b1dpZHRoID0gZGF0YS5hdXRvV2lkdGg7XG4gICAgICAgICAgICBpZiAoZGF0YS5hdXRvSGVpZ2h0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5hdXRvSGVpZ2h0ID0gZGF0YS5hdXRvSGVpZ2h0O1xuICAgICAgICAgICAgaWYgKGRhdGEucnRsUmVvcmRlciAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQucnRsUmVvcmRlciA9IGRhdGEucnRsUmVvcmRlcjtcbiAgICAgICAgICAgIGlmIChkYXRhLnVuaWNvZGVDb252ZXJ0ZXIgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnVuaWNvZGVDb252ZXJ0ZXIgPSBkYXRhLnVuaWNvZGVDb252ZXJ0ZXI7XG4gICAgICAgICAgICBpZiAoZGF0YS50ZXh0ICE9PSBudWxsICYmIGRhdGEudGV4dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50LnRleHQgPSBkYXRhLnRleHQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRhdGEua2V5ICE9PSBudWxsICYmIGRhdGEua2V5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQua2V5ID0gZGF0YS5rZXk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YS5jb2xvciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY29sb3IgPSBkYXRhLmNvbG9yO1xuICAgICAgICAgICAgICAgIGlmICghKGNvbG9yIGluc3RhbmNlb2YgQ29sb3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9yID0gbmV3IENvbG9yKGNvbG9yWzBdLCBjb2xvclsxXSwgY29sb3JbMl0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb21wb25lbnQuY29sb3IgPSBjb2xvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChkYXRhLm9wYWNpdHkgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5vcGFjaXR5ID0gZGF0YS5vcGFjaXR5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEuc3BhY2luZyAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuc3BhY2luZyA9IGRhdGEuc3BhY2luZztcbiAgICAgICAgICAgIGlmIChkYXRhLmZvbnRTaXplICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuZm9udFNpemUgPSBkYXRhLmZvbnRTaXplO1xuICAgICAgICAgICAgICAgIGlmICghZGF0YS5saW5lSGVpZ2h0KSBjb21wb25lbnQubGluZUhlaWdodCA9IGRhdGEuZm9udFNpemU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YS5saW5lSGVpZ2h0ICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5saW5lSGVpZ2h0ID0gZGF0YS5saW5lSGVpZ2h0O1xuICAgICAgICAgICAgaWYgKGRhdGEubWF4TGluZXMgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1heExpbmVzID0gZGF0YS5tYXhMaW5lcztcbiAgICAgICAgICAgIGlmIChkYXRhLndyYXBMaW5lcyAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQud3JhcExpbmVzID0gZGF0YS53cmFwTGluZXM7XG4gICAgICAgICAgICBpZiAoZGF0YS5taW5Gb250U2l6ZSAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQubWluRm9udFNpemUgPSBkYXRhLm1pbkZvbnRTaXplO1xuICAgICAgICAgICAgaWYgKGRhdGEubWF4Rm9udFNpemUgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm1heEZvbnRTaXplID0gZGF0YS5tYXhGb250U2l6ZTtcbiAgICAgICAgICAgIGlmIChkYXRhLmF1dG9GaXRXaWR0aCkgY29tcG9uZW50LmF1dG9GaXRXaWR0aCA9IGRhdGEuYXV0b0ZpdFdpZHRoO1xuICAgICAgICAgICAgaWYgKGRhdGEuYXV0b0ZpdEhlaWdodCkgY29tcG9uZW50LmF1dG9GaXRIZWlnaHQgPSBkYXRhLmF1dG9GaXRIZWlnaHQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5mb250QXNzZXQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LmZvbnRBc3NldCA9IGRhdGEuZm9udEFzc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEuZm9udCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuZm9udCA9IGRhdGEuZm9udDtcbiAgICAgICAgICAgIGlmIChkYXRhLmFsaWdubWVudCAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQuYWxpZ25tZW50ID0gZGF0YS5hbGlnbm1lbnQ7XG4gICAgICAgICAgICBpZiAoZGF0YS5vdXRsaW5lQ29sb3IgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50Lm91dGxpbmVDb2xvciA9IGRhdGEub3V0bGluZUNvbG9yO1xuICAgICAgICAgICAgaWYgKGRhdGEub3V0bGluZVRoaWNrbmVzcyAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnQub3V0bGluZVRoaWNrbmVzcyA9IGRhdGEub3V0bGluZVRoaWNrbmVzcztcbiAgICAgICAgICAgIGlmIChkYXRhLnNoYWRvd0NvbG9yICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5zaGFkb3dDb2xvciA9IGRhdGEuc2hhZG93Q29sb3I7XG4gICAgICAgICAgICBpZiAoZGF0YS5zaGFkb3dPZmZzZXQgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50LnNoYWRvd09mZnNldCA9IGRhdGEuc2hhZG93T2Zmc2V0O1xuICAgICAgICAgICAgaWYgKGRhdGEuZW5hYmxlTWFya3VwICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudC5lbmFibGVNYXJrdXAgPSBkYXRhLmVuYWJsZU1hcmt1cDtcbiAgICAgICAgfVxuICAgICAgICAvLyBPVEhFUldJU0U6IGdyb3VwXG5cbiAgICAgICAgLy8gZmluZCBzY3JlZW5cbiAgICAgICAgLy8gZG8gdGhpcyBoZXJlIG5vdCBpbiBjb25zdHJ1Y3RvciBzbyB0aGF0IGNvbXBvbmVudCBpcyBhZGRlZCB0byB0aGUgZW50aXR5XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGNvbXBvbmVudC5fcGFyc2VVcFRvU2NyZWVuKCk7XG4gICAgICAgIGlmIChyZXN1bHQuc2NyZWVuKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX3VwZGF0ZVNjcmVlbihyZXN1bHQuc2NyZWVuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHN1cGVyLmluaXRpYWxpemVDb21wb25lbnREYXRhKGNvbXBvbmVudCwgZGF0YSwgcHJvcGVydGllcyk7XG5cbiAgICAgICAgY29tcG9uZW50Ll9iZWluZ0luaXRpYWxpemVkID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGNvbXBvbmVudC50eXBlID09PSBFTEVNRU5UVFlQRV9JTUFHRSAmJiBjb21wb25lbnQuX2ltYWdlLl9tZXNoRGlydHkpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5faW1hZ2UuX3VwZGF0ZU1lc2goY29tcG9uZW50Ll9pbWFnZS5tZXNoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmVtb3ZlQ29tcG9uZW50KGVudGl0eSwgY29tcG9uZW50KSB7XG4gICAgICAgIGNvbXBvbmVudC5vblJlbW92ZSgpO1xuICAgIH1cblxuICAgIGNsb25lQ29tcG9uZW50KGVudGl0eSwgY2xvbmUpIHtcbiAgICAgICAgY29uc3Qgc291cmNlID0gZW50aXR5LmVsZW1lbnQ7XG5cbiAgICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IHNvdXJjZS5lbmFibGVkLFxuICAgICAgICAgICAgd2lkdGg6IHNvdXJjZS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogc291cmNlLmhlaWdodCxcbiAgICAgICAgICAgIGFuY2hvcjogc291cmNlLmFuY2hvci5jbG9uZSgpLFxuICAgICAgICAgICAgcGl2b3Q6IHNvdXJjZS5waXZvdC5jbG9uZSgpLFxuICAgICAgICAgICAgbWFyZ2luOiBzb3VyY2UubWFyZ2luLmNsb25lKCksXG4gICAgICAgICAgICBhbGlnbm1lbnQ6IHNvdXJjZS5hbGlnbm1lbnQgJiYgc291cmNlLmFsaWdubWVudC5jbG9uZSgpIHx8IHNvdXJjZS5hbGlnbm1lbnQsXG4gICAgICAgICAgICBhdXRvV2lkdGg6IHNvdXJjZS5hdXRvV2lkdGgsXG4gICAgICAgICAgICBhdXRvSGVpZ2h0OiBzb3VyY2UuYXV0b0hlaWdodCxcbiAgICAgICAgICAgIHR5cGU6IHNvdXJjZS50eXBlLFxuICAgICAgICAgICAgcmVjdDogc291cmNlLnJlY3QgJiYgc291cmNlLnJlY3QuY2xvbmUoKSB8fCBzb3VyY2UucmVjdCxcbiAgICAgICAgICAgIHJ0bFJlb3JkZXI6IHNvdXJjZS5ydGxSZW9yZGVyLFxuICAgICAgICAgICAgdW5pY29kZUNvbnZlcnRlcjogc291cmNlLnVuaWNvZGVDb252ZXJ0ZXIsXG4gICAgICAgICAgICBtYXRlcmlhbEFzc2V0OiBzb3VyY2UubWF0ZXJpYWxBc3NldCxcbiAgICAgICAgICAgIG1hdGVyaWFsOiBzb3VyY2UubWF0ZXJpYWwsXG4gICAgICAgICAgICBjb2xvcjogc291cmNlLmNvbG9yICYmIHNvdXJjZS5jb2xvci5jbG9uZSgpIHx8IHNvdXJjZS5jb2xvcixcbiAgICAgICAgICAgIG9wYWNpdHk6IHNvdXJjZS5vcGFjaXR5LFxuICAgICAgICAgICAgdGV4dHVyZUFzc2V0OiBzb3VyY2UudGV4dHVyZUFzc2V0LFxuICAgICAgICAgICAgdGV4dHVyZTogc291cmNlLnRleHR1cmUsXG4gICAgICAgICAgICBzcHJpdGVBc3NldDogc291cmNlLnNwcml0ZUFzc2V0LFxuICAgICAgICAgICAgc3ByaXRlOiBzb3VyY2Uuc3ByaXRlLFxuICAgICAgICAgICAgc3ByaXRlRnJhbWU6IHNvdXJjZS5zcHJpdGVGcmFtZSxcbiAgICAgICAgICAgIHBpeGVsc1BlclVuaXQ6IHNvdXJjZS5waXhlbHNQZXJVbml0LFxuICAgICAgICAgICAgc3BhY2luZzogc291cmNlLnNwYWNpbmcsXG4gICAgICAgICAgICBsaW5lSGVpZ2h0OiBzb3VyY2UubGluZUhlaWdodCxcbiAgICAgICAgICAgIHdyYXBMaW5lczogc291cmNlLndyYXBMaW5lcyxcbiAgICAgICAgICAgIGxheWVyczogc291cmNlLmxheWVycyxcbiAgICAgICAgICAgIGZvbnRTaXplOiBzb3VyY2UuZm9udFNpemUsXG4gICAgICAgICAgICBtaW5Gb250U2l6ZTogc291cmNlLm1pbkZvbnRTaXplLFxuICAgICAgICAgICAgbWF4Rm9udFNpemU6IHNvdXJjZS5tYXhGb250U2l6ZSxcbiAgICAgICAgICAgIGF1dG9GaXRXaWR0aDogc291cmNlLmF1dG9GaXRXaWR0aCxcbiAgICAgICAgICAgIGF1dG9GaXRIZWlnaHQ6IHNvdXJjZS5hdXRvRml0SGVpZ2h0LFxuICAgICAgICAgICAgbWF4TGluZXM6IHNvdXJjZS5tYXhMaW5lcyxcbiAgICAgICAgICAgIGZvbnRBc3NldDogc291cmNlLmZvbnRBc3NldCxcbiAgICAgICAgICAgIGZvbnQ6IHNvdXJjZS5mb250LFxuICAgICAgICAgICAgdXNlSW5wdXQ6IHNvdXJjZS51c2VJbnB1dCxcbiAgICAgICAgICAgIGZpdE1vZGU6IHNvdXJjZS5maXRNb2RlLFxuICAgICAgICAgICAgYmF0Y2hHcm91cElkOiBzb3VyY2UuYmF0Y2hHcm91cElkLFxuICAgICAgICAgICAgbWFzazogc291cmNlLm1hc2ssXG4gICAgICAgICAgICBvdXRsaW5lQ29sb3I6IHNvdXJjZS5vdXRsaW5lQ29sb3IgJiYgc291cmNlLm91dGxpbmVDb2xvci5jbG9uZSgpIHx8IHNvdXJjZS5vdXRsaW5lQ29sb3IsXG4gICAgICAgICAgICBvdXRsaW5lVGhpY2tuZXNzOiBzb3VyY2Uub3V0bGluZVRoaWNrbmVzcyxcbiAgICAgICAgICAgIHNoYWRvd0NvbG9yOiBzb3VyY2Uuc2hhZG93Q29sb3IgJiYgc291cmNlLnNoYWRvd0NvbG9yLmNsb25lKCkgfHwgc291cmNlLnNoYWRvd0NvbG9yLFxuICAgICAgICAgICAgc2hhZG93T2Zmc2V0OiBzb3VyY2Uuc2hhZG93T2Zmc2V0ICYmIHNvdXJjZS5zaGFkb3dPZmZzZXQuY2xvbmUoKSB8fCBzb3VyY2Uuc2hhZG93T2Zmc2V0LFxuICAgICAgICAgICAgZW5hYmxlTWFya3VwOiBzb3VyY2UuZW5hYmxlTWFya3VwXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHNvdXJjZS5rZXkgIT09IHVuZGVmaW5lZCAmJiBzb3VyY2Uua2V5ICE9PSBudWxsKSB7XG4gICAgICAgICAgICBkYXRhLmtleSA9IHNvdXJjZS5rZXk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkYXRhLnRleHQgPSBzb3VyY2UudGV4dDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudChjbG9uZSwgZGF0YSk7XG4gICAgfVxuXG4gICAgZ2V0VGV4dEVsZW1lbnRNYXRlcmlhbChzY3JlZW5TcGFjZSwgbXNkZiwgdGV4dEF0dGlidXRlcykge1xuICAgICAgICBjb25zdCBoYXNoID0gKHNjcmVlblNwYWNlICYmICgxIDw8IDApKSB8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIChtc2RmICYmICgxIDw8IDEpKSB8XG4gICAgICAgICAgICAgICAgICh0ZXh0QXR0aWJ1dGVzICYmICgxIDw8IDIpKTtcblxuICAgICAgICBsZXQgbWF0ZXJpYWwgPSB0aGlzLl9kZWZhdWx0VGV4dE1hdGVyaWFsc1toYXNoXTtcblxuICAgICAgICBpZiAobWF0ZXJpYWwpIHtcbiAgICAgICAgICAgIHJldHVybiBtYXRlcmlhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBuYW1lID0gXCJUZXh0TWF0ZXJpYWxcIjtcblxuICAgICAgICBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG5cbiAgICAgICAgaWYgKG1zZGYpIHtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1zZGZNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm1zZGZUZXh0QXR0cmlidXRlID0gdGV4dEF0dGlidXRlcztcbiAgICAgICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldCgxLCAxLCAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5hbWUgPSBcIkJpdG1hcFwiICsgbmFtZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldCgwLjUsIDAuNSwgMC41KTsgLy8gc2V0IHRvIG5vbi0oMSwxLDEpIHNvIHRoYXQgdGludCBpcyBhY3R1YWxseSBhcHBsaWVkXG4gICAgICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZU1hcCA9IHRoaXMuX2RlZmF1bHRUZXh0dXJlO1xuICAgICAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgICAgIG1hdGVyaWFsLm9wYWNpdHlNYXBDaGFubmVsID0gJ2EnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNjcmVlblNwYWNlKSB7XG4gICAgICAgICAgICBuYW1lID0gJ1NjcmVlblNwYWNlJyArIG5hbWU7XG4gICAgICAgICAgICBtYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBtYXRlcmlhbCBuYW1lIGNhbiBiZTpcbiAgICAgICAgLy8gIGRlZmF1bHRUZXh0TWF0ZXJpYWxcbiAgICAgICAgLy8gIGRlZmF1bHRCaXRtYXBUZXh0TWF0ZXJpYWxcbiAgICAgICAgLy8gIGRlZmF1bHRTY3JlZW5TcGFjZVRleHRNYXRlcmlhbFxuICAgICAgICAvLyAgZGVmYXVsdFNjcmVlblNwYWNlQml0bWFwVGV4dE1hdGVyaWFsXG4gICAgICAgIG1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdCcgKyBuYW1lO1xuICAgICAgICBtYXRlcmlhbC51c2VMaWdodGluZyA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC51c2VHYW1tYVRvbmVtYXAgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlRm9nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLnVzZVNreWJveCA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC5kaWZmdXNlLnNldCgwLCAwLCAwKTsgLy8gYmxhY2sgZGlmZnVzZSBjb2xvciB0byBwcmV2ZW50IGFtYmllbnQgbGlnaHQgYmVpbmcgaW5jbHVkZWRcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eSA9IDAuNTtcbiAgICAgICAgbWF0ZXJpYWwuYmxlbmRUeXBlID0gQkxFTkRfUFJFTVVMVElQTElFRDtcbiAgICAgICAgbWF0ZXJpYWwuZGVwdGhXcml0ZSA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC5lbWlzc2l2ZVZlcnRleENvbG9yID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgdGhpcy5fZGVmYXVsdFRleHRNYXRlcmlhbHNbaGFzaF0gPSBtYXRlcmlhbDtcblxuICAgICAgICByZXR1cm4gbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBTdGFuZGFyZE1hdGVyaWFsKCk7XG5cbiAgICAgICAgbWF0ZXJpYWwuZGlmZnVzZS5zZXQoMCwgMCwgMCk7IC8vIGJsYWNrIGRpZmZ1c2UgY29sb3IgdG8gcHJldmVudCBhbWJpZW50IGxpZ2h0IGJlaW5nIGluY2x1ZGVkXG4gICAgICAgIG1hdGVyaWFsLmVtaXNzaXZlLnNldCgwLjUsIDAuNSwgMC41KTsgLy8gdXNlIG5vbi13aGl0ZSB0byBjb21waWxlIHNoYWRlciBjb3JyZWN0bHlcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVNYXAgPSB0aGlzLl9kZWZhdWx0VGV4dHVyZTtcbiAgICAgICAgbWF0ZXJpYWwuZW1pc3NpdmVUaW50ID0gdHJ1ZTtcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eU1hcCA9IHRoaXMuX2RlZmF1bHRUZXh0dXJlO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5TWFwQ2hhbm5lbCA9ICdhJztcbiAgICAgICAgbWF0ZXJpYWwub3BhY2l0eVRpbnQgPSB0cnVlO1xuICAgICAgICBtYXRlcmlhbC5vcGFjaXR5ID0gMDsgLy8gdXNlIG5vbi0xIG9wYWNpdHkgdG8gY29tcGlsZSBzaGFkZXIgY29ycmVjdGx5XG4gICAgICAgIG1hdGVyaWFsLnVzZUxpZ2h0aW5nID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLnVzZUdhbW1hVG9uZW1hcCA9IGZhbHNlO1xuICAgICAgICBtYXRlcmlhbC51c2VGb2cgPSBmYWxzZTtcbiAgICAgICAgbWF0ZXJpYWwudXNlU2t5Ym94ID0gZmFsc2U7XG4gICAgICAgIG1hdGVyaWFsLmJsZW5kVHlwZSA9IEJMRU5EX1BSRU1VTFRJUExJRUQ7XG4gICAgICAgIG1hdGVyaWFsLmRlcHRoV3JpdGUgPSBmYWxzZTtcblxuICAgICAgICByZXR1cm4gbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgZ2V0SW1hZ2VFbGVtZW50TWF0ZXJpYWwoc2NyZWVuU3BhY2UsIG1hc2ssIG5pbmVTbGljZWQsIG5pbmVTbGljZVRpbGVkKSB7XG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWVsc2UtcmV0dXJuICovXG4gICAgICAgIGlmIChzY3JlZW5TcGFjZSkge1xuICAgICAgICAgICAgaWYgKG1hc2spIHtcbiAgICAgICAgICAgICAgICBpZiAobmluZVNsaWNlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5ncmVlbldyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlTbGljZWRNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5U2xpY2VkTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChuaW5lU2xpY2VUaWxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwgPSB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwuY2xvbmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLm5pbmVTbGljZWRNb2RlID0gU1BSSVRFX1JFTkRFUk1PREVfVElMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5hbHBoYVRlc3QgPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5yZWRXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5ncmVlbldyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLmJsdWVXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2s5VGlsZWRNYXRlcmlhbC5hbHBoYVdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFzazlUaWxlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbC5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwucmVkV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrTWF0ZXJpYWwuYWxwaGFXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWFza01hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChuaW5lU2xpY2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlTbGljZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVNsaWNlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobmluZVNsaWNlVGlsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlOVRpbGVkTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsLmRlcHRoVGVzdCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5VGlsZWRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsLm5hbWUgPSAnZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRTY3JlZW5TcGFjZUltYWdlTWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWxzLnB1c2godGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChtYXNrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG5pbmVTbGljZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC5hbHBoYVRlc3QgPSAxO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwuZ3JlZW5Xcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLmJsdWVXcml0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWFza01hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hc2tNYXRlcmlhbC51cGRhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXRlcmlhbHMucHVzaCh0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChuaW5lU2xpY2VUaWxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1RJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5ncmVlbldyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlUaWxlZE1hc2tNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWFza01hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwnO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWwuYWxwaGFUZXN0ID0gMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLnJlZFdyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC5ncmVlbldyaXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbC5ibHVlV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLmFscGhhV3JpdGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlTWFza01hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2VNYXNrTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAobmluZVNsaWNlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCA9IHRoaXMuX2NyZWF0ZUJhc2VJbWFnZU1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZTlTbGljZWRNYXRlcmlhbC5uaW5lU2xpY2VkTW9kZSA9IFNQUklURV9SRU5ERVJNT0RFX1NMSUNFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlOVNsaWNlZE1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5kZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChuaW5lU2xpY2VUaWxlZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwgPSB0aGlzLl9jcmVhdGVCYXNlSW1hZ2VNYXRlcmlhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbC5uYW1lID0gJ2RlZmF1bHRJbWFnZTlUaWxlZE1hdGVyaWFsJztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwubmluZVNsaWNlZE1vZGUgPSBTUFJJVEVfUkVOREVSTU9ERV9USUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWwudXBkYXRlKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWxzLnB1c2godGhpcy5kZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVmYXVsdEltYWdlOVRpbGVkTWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsID0gdGhpcy5fY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWwubmFtZSA9ICdkZWZhdWx0SW1hZ2VNYXRlcmlhbCc7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsLnVwZGF0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFscy5wdXNoKHRoaXMuZGVmYXVsdEltYWdlTWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmRlZmF1bHRJbWFnZU1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWVsc2UtcmV0dXJuICovXG4gICAgfVxuXG4gICAgcmVnaXN0ZXJVbmljb2RlQ29udmVydGVyKGZ1bmMpIHtcbiAgICAgICAgdGhpcy5fdW5pY29kZUNvbnZlcnRlciA9IGZ1bmM7XG4gICAgfVxuXG4gICAgcmVnaXN0ZXJSdGxSZW9yZGVyKGZ1bmMpIHtcbiAgICAgICAgdGhpcy5fcnRsUmVvcmRlciA9IGZ1bmM7XG4gICAgfVxuXG4gICAgZ2V0VW5pY29kZUNvbnZlcnRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VuaWNvZGVDb252ZXJ0ZXI7XG4gICAgfVxuXG4gICAgZ2V0UnRsUmVvcmRlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3J0bFJlb3JkZXI7XG4gICAgfVxufVxuXG5Db21wb25lbnQuX2J1aWxkQWNjZXNzb3JzKEVsZW1lbnRDb21wb25lbnQucHJvdG90eXBlLCBfc2NoZW1hKTtcblxuZXhwb3J0IHsgRWxlbWVudENvbXBvbmVudFN5c3RlbSB9O1xuIl0sIm5hbWVzIjpbIl9zY2hlbWEiLCJFbGVtZW50Q29tcG9uZW50U3lzdGVtIiwiQ29tcG9uZW50U3lzdGVtIiwiY29uc3RydWN0b3IiLCJhcHAiLCJpZCIsIkNvbXBvbmVudFR5cGUiLCJFbGVtZW50Q29tcG9uZW50IiwiRGF0YVR5cGUiLCJFbGVtZW50Q29tcG9uZW50RGF0YSIsInNjaGVtYSIsIl91bmljb2RlQ29udmVydGVyIiwiX3J0bFJlb3JkZXIiLCJfZGVmYXVsdFRleHR1cmUiLCJUZXh0dXJlIiwiZ3JhcGhpY3NEZXZpY2UiLCJ3aWR0aCIsImhlaWdodCIsImZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4IiwibmFtZSIsInBpeGVscyIsImxvY2siLCJwaXhlbERhdGEiLCJVaW50OEFycmF5Iiwic2V0IiwidW5sb2NrIiwiZGVmYXVsdEltYWdlTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2U5U2xpY2VkTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2U5VGlsZWRNYXRlcmlhbCIsImRlZmF1bHRJbWFnZU1hc2tNYXRlcmlhbCIsImRlZmF1bHRJbWFnZTlTbGljZWRNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0SW1hZ2U5VGlsZWRNYXNrTWF0ZXJpYWwiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2U5U2xpY2VkTWF0ZXJpYWwiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZTlUaWxlZE1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVNsaWNlZE1hdGVyaWFsIiwiZGVmYXVsdFNjcmVlblNwYWNlSW1hZ2VNYXNrOVRpbGVkTWF0ZXJpYWwiLCJkZWZhdWx0U2NyZWVuU3BhY2VJbWFnZU1hc2tNYXRlcmlhbCIsIl9kZWZhdWx0VGV4dE1hdGVyaWFscyIsImRlZmF1bHRJbWFnZU1hdGVyaWFscyIsIm9uIiwib25SZW1vdmVDb21wb25lbnQiLCJkZXN0cm95IiwiaW5pdGlhbGl6ZUNvbXBvbmVudERhdGEiLCJjb21wb25lbnQiLCJkYXRhIiwicHJvcGVydGllcyIsIl9iZWluZ0luaXRpYWxpemVkIiwiYW5jaG9yIiwidW5kZWZpbmVkIiwiVmVjNCIsImNvcHkiLCJwaXZvdCIsIlZlYzIiLCJzcGxpdEhvckFuY2hvcnMiLCJNYXRoIiwiYWJzIiwieCIsInoiLCJzcGxpdFZlckFuY2hvcnMiLCJ5IiwidyIsIl9tYXJnaW5DaGFuZ2UiLCJjb2xvciIsIm1hcmdpbiIsIl9tYXJnaW4iLCJsZWZ0IiwiYm90dG9tIiwicmlnaHQiLCJ0b3AiLCJzaG91bGRGb3JjZVNldEFuY2hvciIsImVuYWJsZWQiLCJ1c2VJbnB1dCIsImZpdE1vZGUiLCJiYXRjaEdyb3VwSWQiLCJsYXllcnMiLCJBcnJheSIsImlzQXJyYXkiLCJzbGljZSIsInR5cGUiLCJFTEVNRU5UVFlQRV9JTUFHRSIsInJlY3QiLCJDb2xvciIsIm9wYWNpdHkiLCJ0ZXh0dXJlQXNzZXQiLCJ0ZXh0dXJlIiwic3ByaXRlQXNzZXQiLCJzcHJpdGUiLCJzcHJpdGVGcmFtZSIsInBpeGVsc1BlclVuaXQiLCJtYXRlcmlhbEFzc2V0IiwibWF0ZXJpYWwiLCJtYXNrIiwiRUxFTUVOVFRZUEVfVEVYVCIsImF1dG9XaWR0aCIsImF1dG9IZWlnaHQiLCJydGxSZW9yZGVyIiwidW5pY29kZUNvbnZlcnRlciIsInRleHQiLCJrZXkiLCJzcGFjaW5nIiwiZm9udFNpemUiLCJsaW5lSGVpZ2h0IiwibWF4TGluZXMiLCJ3cmFwTGluZXMiLCJtaW5Gb250U2l6ZSIsIm1heEZvbnRTaXplIiwiYXV0b0ZpdFdpZHRoIiwiYXV0b0ZpdEhlaWdodCIsImZvbnRBc3NldCIsImZvbnQiLCJhbGlnbm1lbnQiLCJvdXRsaW5lQ29sb3IiLCJvdXRsaW5lVGhpY2tuZXNzIiwic2hhZG93Q29sb3IiLCJzaGFkb3dPZmZzZXQiLCJlbmFibGVNYXJrdXAiLCJyZXN1bHQiLCJfcGFyc2VVcFRvU2NyZWVuIiwic2NyZWVuIiwiX3VwZGF0ZVNjcmVlbiIsIl9pbWFnZSIsIl9tZXNoRGlydHkiLCJfdXBkYXRlTWVzaCIsIm1lc2giLCJlbnRpdHkiLCJvblJlbW92ZSIsImNsb25lQ29tcG9uZW50IiwiY2xvbmUiLCJzb3VyY2UiLCJlbGVtZW50IiwiYWRkQ29tcG9uZW50IiwiZ2V0VGV4dEVsZW1lbnRNYXRlcmlhbCIsInNjcmVlblNwYWNlIiwibXNkZiIsInRleHRBdHRpYnV0ZXMiLCJoYXNoIiwiU3RhbmRhcmRNYXRlcmlhbCIsIm1zZGZNYXAiLCJtc2RmVGV4dEF0dHJpYnV0ZSIsImVtaXNzaXZlIiwiZW1pc3NpdmVNYXAiLCJlbWlzc2l2ZVRpbnQiLCJvcGFjaXR5TWFwIiwib3BhY2l0eU1hcENoYW5uZWwiLCJkZXB0aFRlc3QiLCJ1c2VMaWdodGluZyIsInVzZUdhbW1hVG9uZW1hcCIsInVzZUZvZyIsInVzZVNreWJveCIsImRpZmZ1c2UiLCJibGVuZFR5cGUiLCJCTEVORF9QUkVNVUxUSVBMSUVEIiwiZGVwdGhXcml0ZSIsImVtaXNzaXZlVmVydGV4Q29sb3IiLCJ1cGRhdGUiLCJfY3JlYXRlQmFzZUltYWdlTWF0ZXJpYWwiLCJvcGFjaXR5VGludCIsImdldEltYWdlRWxlbWVudE1hdGVyaWFsIiwibmluZVNsaWNlZCIsIm5pbmVTbGljZVRpbGVkIiwibmluZVNsaWNlZE1vZGUiLCJTUFJJVEVfUkVOREVSTU9ERV9TTElDRUQiLCJhbHBoYVRlc3QiLCJyZWRXcml0ZSIsImdyZWVuV3JpdGUiLCJibHVlV3JpdGUiLCJhbHBoYVdyaXRlIiwicHVzaCIsIlNQUklURV9SRU5ERVJNT0RFX1RJTEVEIiwicmVnaXN0ZXJVbmljb2RlQ29udmVydGVyIiwiZnVuYyIsInJlZ2lzdGVyUnRsUmVvcmRlciIsImdldFVuaWNvZGVDb252ZXJ0ZXIiLCJnZXRSdGxSZW9yZGVyIiwiQ29tcG9uZW50IiwiX2J1aWxkQWNjZXNzb3JzIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBbUJBLE1BQU1BLE9BQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFBOztBQUUzQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsc0JBQXNCLFNBQVNDLGVBQWUsQ0FBQztBQUNqRDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBV0EsQ0FBQ0MsR0FBRyxFQUFFO0lBQ2IsS0FBSyxDQUFDQSxHQUFHLENBQUMsQ0FBQTtJQUVWLElBQUksQ0FBQ0MsRUFBRSxHQUFHLFNBQVMsQ0FBQTtJQUVuQixJQUFJLENBQUNDLGFBQWEsR0FBR0MsZ0JBQWdCLENBQUE7SUFDckMsSUFBSSxDQUFDQyxRQUFRLEdBQUdDLG9CQUFvQixDQUFBO0lBRXBDLElBQUksQ0FBQ0MsTUFBTSxHQUFHVixPQUFPLENBQUE7SUFDckIsSUFBSSxDQUFDVyxpQkFBaUIsR0FBRyxJQUFJLENBQUE7SUFDN0IsSUFBSSxDQUFDQyxXQUFXLEdBQUcsSUFBSSxDQUFBOztBQUV2QjtJQUNBLElBQUksQ0FBQ0MsZUFBZSxHQUFHLElBQUlDLE9BQU8sQ0FBQ1YsR0FBRyxDQUFDVyxjQUFjLEVBQUU7QUFDbkRDLE1BQUFBLEtBQUssRUFBRSxDQUFDO0FBQ1JDLE1BQUFBLE1BQU0sRUFBRSxDQUFDO0FBQ1RDLE1BQUFBLE1BQU0sRUFBRUMsaUJBQWlCO0FBQ3pCQyxNQUFBQSxJQUFJLEVBQUUsZ0JBQUE7QUFDVixLQUFDLENBQUMsQ0FBQTtJQUNGLE1BQU1DLE1BQU0sR0FBRyxJQUFJLENBQUNSLGVBQWUsQ0FBQ1MsSUFBSSxFQUFFLENBQUE7QUFDMUMsSUFBQSxNQUFNQyxTQUFTLEdBQUcsSUFBSUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ25DRCxJQUFBQSxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFBO0FBQ3BCQSxJQUFBQSxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFBO0FBQ3BCQSxJQUFBQSxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFBO0FBQ3BCQSxJQUFBQSxTQUFTLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFBO0FBQ3BCRixJQUFBQSxNQUFNLENBQUNJLEdBQUcsQ0FBQ0YsU0FBUyxDQUFDLENBQUE7QUFDckIsSUFBQSxJQUFJLENBQUNWLGVBQWUsQ0FBQ2EsTUFBTSxFQUFFLENBQUE7O0FBRTdCO0lBQ0EsSUFBSSxDQUFDQyxvQkFBb0IsR0FBRyxJQUFJLENBQUE7SUFDaEMsSUFBSSxDQUFDQywyQkFBMkIsR0FBRyxJQUFJLENBQUE7SUFDdkMsSUFBSSxDQUFDQywwQkFBMEIsR0FBRyxJQUFJLENBQUE7SUFDdEMsSUFBSSxDQUFDQyx3QkFBd0IsR0FBRyxJQUFJLENBQUE7SUFDcEMsSUFBSSxDQUFDQywrQkFBK0IsR0FBRyxJQUFJLENBQUE7SUFDM0MsSUFBSSxDQUFDQyw4QkFBOEIsR0FBRyxJQUFJLENBQUE7SUFDMUMsSUFBSSxDQUFDQywrQkFBK0IsR0FBRyxJQUFJLENBQUE7SUFDM0MsSUFBSSxDQUFDQyxzQ0FBc0MsR0FBRyxJQUFJLENBQUE7SUFDbEQsSUFBSSxDQUFDQyxxQ0FBcUMsR0FBRyxJQUFJLENBQUE7SUFDakQsSUFBSSxDQUFDQywwQ0FBMEMsR0FBRyxJQUFJLENBQUE7SUFDdEQsSUFBSSxDQUFDQyx5Q0FBeUMsR0FBRyxJQUFJLENBQUE7SUFDckQsSUFBSSxDQUFDQyxtQ0FBbUMsR0FBRyxJQUFJLENBQUE7O0FBRS9DO0FBQ0EsSUFBQSxJQUFJLENBQUNDLHFCQUFxQixHQUFHLEVBQUUsQ0FBQTtJQUUvQixJQUFJLENBQUNDLHFCQUFxQixHQUFHLEVBQUUsQ0FBQTtJQUUvQixJQUFJLENBQUNDLEVBQUUsQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDQyxpQkFBaUIsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN6RCxHQUFBO0FBRUFDLEVBQUFBLE9BQU9BLEdBQUc7SUFDTixLQUFLLENBQUNBLE9BQU8sRUFBRSxDQUFBO0FBRWYsSUFBQSxJQUFJLENBQUM5QixlQUFlLENBQUM4QixPQUFPLEVBQUUsQ0FBQTtBQUNsQyxHQUFBO0FBRUFDLEVBQUFBLHVCQUF1QkEsQ0FBQ0MsU0FBUyxFQUFFQyxJQUFJLEVBQUVDLFVBQVUsRUFBRTtJQUNqREYsU0FBUyxDQUFDRyxpQkFBaUIsR0FBRyxJQUFJLENBQUE7QUFFbEMsSUFBQSxJQUFJRixJQUFJLENBQUNHLE1BQU0sS0FBS0MsU0FBUyxFQUFFO0FBQzNCLE1BQUEsSUFBSUosSUFBSSxDQUFDRyxNQUFNLFlBQVlFLElBQUksRUFBRTtRQUM3Qk4sU0FBUyxDQUFDSSxNQUFNLENBQUNHLElBQUksQ0FBQ04sSUFBSSxDQUFDRyxNQUFNLENBQUMsQ0FBQTtBQUN0QyxPQUFDLE1BQU07QUFDSEosUUFBQUEsU0FBUyxDQUFDSSxNQUFNLENBQUN4QixHQUFHLENBQUNxQixJQUFJLENBQUNHLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRUgsSUFBSSxDQUFDRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUVILElBQUksQ0FBQ0csTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFSCxJQUFJLENBQUNHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ3hGLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxJQUFJSCxJQUFJLENBQUNPLEtBQUssS0FBS0gsU0FBUyxFQUFFO0FBQzFCLE1BQUEsSUFBSUosSUFBSSxDQUFDTyxLQUFLLFlBQVlDLElBQUksRUFBRTtRQUM1QlQsU0FBUyxDQUFDUSxLQUFLLENBQUNELElBQUksQ0FBQ04sSUFBSSxDQUFDTyxLQUFLLENBQUMsQ0FBQTtBQUNwQyxPQUFDLE1BQU07QUFDSFIsUUFBQUEsU0FBUyxDQUFDUSxLQUFLLENBQUM1QixHQUFHLENBQUNxQixJQUFJLENBQUNPLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRVAsSUFBSSxDQUFDTyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNyRCxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsTUFBTUUsZUFBZSxHQUFHQyxJQUFJLENBQUNDLEdBQUcsQ0FBQ1osU0FBUyxDQUFDSSxNQUFNLENBQUNTLENBQUMsR0FBR2IsU0FBUyxDQUFDSSxNQUFNLENBQUNVLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQTtBQUNqRixJQUFBLE1BQU1DLGVBQWUsR0FBR0osSUFBSSxDQUFDQyxHQUFHLENBQUNaLFNBQVMsQ0FBQ0ksTUFBTSxDQUFDWSxDQUFDLEdBQUdoQixTQUFTLENBQUNJLE1BQU0sQ0FBQ2EsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFBO0lBQ2pGLElBQUlDLGFBQWEsR0FBRyxLQUFLLENBQUE7QUFDekIsSUFBQSxJQUFJQyxLQUFLLENBQUE7QUFFVCxJQUFBLElBQUlsQixJQUFJLENBQUNtQixNQUFNLEtBQUtmLFNBQVMsRUFBRTtBQUMzQixNQUFBLElBQUlKLElBQUksQ0FBQ21CLE1BQU0sWUFBWWQsSUFBSSxFQUFFO1FBQzdCTixTQUFTLENBQUNvQixNQUFNLENBQUNiLElBQUksQ0FBQ04sSUFBSSxDQUFDbUIsTUFBTSxDQUFDLENBQUE7QUFDdEMsT0FBQyxNQUFNO0FBQ0hwQixRQUFBQSxTQUFTLENBQUNxQixPQUFPLENBQUN6QyxHQUFHLENBQUNxQixJQUFJLENBQUNtQixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUVuQixJQUFJLENBQUNtQixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUVuQixJQUFJLENBQUNtQixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUVuQixJQUFJLENBQUNtQixNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUN6RixPQUFBO0FBRUFGLE1BQUFBLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDeEIsS0FBQTtBQUVBLElBQUEsSUFBSWpCLElBQUksQ0FBQ3FCLElBQUksS0FBS2pCLFNBQVMsRUFBRTtBQUN6QkwsTUFBQUEsU0FBUyxDQUFDcUIsT0FBTyxDQUFDUixDQUFDLEdBQUdaLElBQUksQ0FBQ3FCLElBQUksQ0FBQTtBQUMvQkosTUFBQUEsYUFBYSxHQUFHLElBQUksQ0FBQTtBQUN4QixLQUFBO0FBQ0EsSUFBQSxJQUFJakIsSUFBSSxDQUFDc0IsTUFBTSxLQUFLbEIsU0FBUyxFQUFFO0FBQzNCTCxNQUFBQSxTQUFTLENBQUNxQixPQUFPLENBQUNMLENBQUMsR0FBR2YsSUFBSSxDQUFDc0IsTUFBTSxDQUFBO0FBQ2pDTCxNQUFBQSxhQUFhLEdBQUcsSUFBSSxDQUFBO0FBQ3hCLEtBQUE7QUFDQSxJQUFBLElBQUlqQixJQUFJLENBQUN1QixLQUFLLEtBQUtuQixTQUFTLEVBQUU7QUFDMUJMLE1BQUFBLFNBQVMsQ0FBQ3FCLE9BQU8sQ0FBQ1AsQ0FBQyxHQUFHYixJQUFJLENBQUN1QixLQUFLLENBQUE7QUFDaENOLE1BQUFBLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDeEIsS0FBQTtBQUNBLElBQUEsSUFBSWpCLElBQUksQ0FBQ3dCLEdBQUcsS0FBS3BCLFNBQVMsRUFBRTtBQUN4QkwsTUFBQUEsU0FBUyxDQUFDcUIsT0FBTyxDQUFDSixDQUFDLEdBQUdoQixJQUFJLENBQUN3QixHQUFHLENBQUE7QUFDOUJQLE1BQUFBLGFBQWEsR0FBRyxJQUFJLENBQUE7QUFDeEIsS0FBQTtBQUNBLElBQUEsSUFBSUEsYUFBYSxFQUFFO0FBQ2Y7QUFDQWxCLE1BQUFBLFNBQVMsQ0FBQ29CLE1BQU0sR0FBR3BCLFNBQVMsQ0FBQ3FCLE9BQU8sQ0FBQTtBQUN4QyxLQUFBO0lBRUEsSUFBSUssb0JBQW9CLEdBQUcsS0FBSyxDQUFBO0lBRWhDLElBQUl6QixJQUFJLENBQUM5QixLQUFLLEtBQUtrQyxTQUFTLElBQUksQ0FBQ0ssZUFBZSxFQUFFO0FBQzlDO0FBQ0FWLE1BQUFBLFNBQVMsQ0FBQzdCLEtBQUssR0FBRzhCLElBQUksQ0FBQzlCLEtBQUssQ0FBQTtLQUMvQixNQUFNLElBQUl1QyxlQUFlLEVBQUU7QUFDeEJnQixNQUFBQSxvQkFBb0IsR0FBRyxJQUFJLENBQUE7QUFDL0IsS0FBQTtJQUNBLElBQUl6QixJQUFJLENBQUM3QixNQUFNLEtBQUtpQyxTQUFTLElBQUksQ0FBQ1UsZUFBZSxFQUFFO0FBQy9DO0FBQ0FmLE1BQUFBLFNBQVMsQ0FBQzVCLE1BQU0sR0FBRzZCLElBQUksQ0FBQzdCLE1BQU0sQ0FBQTtLQUNqQyxNQUFNLElBQUkyQyxlQUFlLEVBQUU7QUFDeEJXLE1BQUFBLG9CQUFvQixHQUFHLElBQUksQ0FBQTtBQUMvQixLQUFBO0FBRUEsSUFBQSxJQUFJQSxvQkFBb0IsRUFBRTtBQUN0QjtBQUNBO0FBQ0ExQixNQUFBQSxTQUFTLENBQUNJLE1BQU0sR0FBR0osU0FBUyxDQUFDSSxNQUFNLENBQUE7QUFDbkM7QUFDSixLQUFBOztBQUVBLElBQUEsSUFBSUgsSUFBSSxDQUFDMEIsT0FBTyxLQUFLdEIsU0FBUyxFQUFFO0FBQzVCTCxNQUFBQSxTQUFTLENBQUMyQixPQUFPLEdBQUcxQixJQUFJLENBQUMwQixPQUFPLENBQUE7QUFDcEMsS0FBQTtBQUVBLElBQUEsSUFBSTFCLElBQUksQ0FBQzJCLFFBQVEsS0FBS3ZCLFNBQVMsRUFBRTtBQUM3QkwsTUFBQUEsU0FBUyxDQUFDNEIsUUFBUSxHQUFHM0IsSUFBSSxDQUFDMkIsUUFBUSxDQUFBO0FBQ3RDLEtBQUE7QUFFQSxJQUFBLElBQUkzQixJQUFJLENBQUM0QixPQUFPLEtBQUt4QixTQUFTLEVBQUU7QUFDNUJMLE1BQUFBLFNBQVMsQ0FBQzZCLE9BQU8sR0FBRzVCLElBQUksQ0FBQzRCLE9BQU8sQ0FBQTtBQUNwQyxLQUFBO0lBRUE3QixTQUFTLENBQUM4QixZQUFZLEdBQUc3QixJQUFJLENBQUM2QixZQUFZLEtBQUt6QixTQUFTLElBQUlKLElBQUksQ0FBQzZCLFlBQVksS0FBSyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUc3QixJQUFJLENBQUM2QixZQUFZLENBQUE7QUFFL0csSUFBQSxJQUFJN0IsSUFBSSxDQUFDOEIsTUFBTSxJQUFJQyxLQUFLLENBQUNDLE9BQU8sQ0FBQ2hDLElBQUksQ0FBQzhCLE1BQU0sQ0FBQyxFQUFFO01BQzNDL0IsU0FBUyxDQUFDK0IsTUFBTSxHQUFHOUIsSUFBSSxDQUFDOEIsTUFBTSxDQUFDRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDM0MsS0FBQTtBQUVBLElBQUEsSUFBSWpDLElBQUksQ0FBQ2tDLElBQUksS0FBSzlCLFNBQVMsRUFBRTtBQUN6QkwsTUFBQUEsU0FBUyxDQUFDbUMsSUFBSSxHQUFHbEMsSUFBSSxDQUFDa0MsSUFBSSxDQUFBO0FBQzlCLEtBQUE7QUFFQSxJQUFBLElBQUluQyxTQUFTLENBQUNtQyxJQUFJLEtBQUtDLGlCQUFpQixFQUFFO0FBQ3RDLE1BQUEsSUFBSW5DLElBQUksQ0FBQ29DLElBQUksS0FBS2hDLFNBQVMsRUFBRTtBQUN6QkwsUUFBQUEsU0FBUyxDQUFDcUMsSUFBSSxHQUFHcEMsSUFBSSxDQUFDb0MsSUFBSSxDQUFBO0FBQzlCLE9BQUE7QUFDQSxNQUFBLElBQUlwQyxJQUFJLENBQUNrQixLQUFLLEtBQUtkLFNBQVMsRUFBRTtRQUMxQmMsS0FBSyxHQUFHbEIsSUFBSSxDQUFDa0IsS0FBSyxDQUFBO0FBQ2xCLFFBQUEsSUFBSSxFQUFFQSxLQUFLLFlBQVltQixLQUFLLENBQUMsRUFBRTtVQUMzQm5CLEtBQUssR0FBRyxJQUFJbUIsS0FBSyxDQUFDckMsSUFBSSxDQUFDa0IsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFbEIsSUFBSSxDQUFDa0IsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFbEIsSUFBSSxDQUFDa0IsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbEUsU0FBQTtRQUNBbkIsU0FBUyxDQUFDbUIsS0FBSyxHQUFHQSxLQUFLLENBQUE7QUFDM0IsT0FBQTtBQUVBLE1BQUEsSUFBSWxCLElBQUksQ0FBQ3NDLE9BQU8sS0FBS2xDLFNBQVMsRUFBRUwsU0FBUyxDQUFDdUMsT0FBTyxHQUFHdEMsSUFBSSxDQUFDc0MsT0FBTyxDQUFBO0FBQ2hFLE1BQUEsSUFBSXRDLElBQUksQ0FBQ3VDLFlBQVksS0FBS25DLFNBQVMsRUFBRUwsU0FBUyxDQUFDd0MsWUFBWSxHQUFHdkMsSUFBSSxDQUFDdUMsWUFBWSxDQUFBO01BQy9FLElBQUl2QyxJQUFJLENBQUN3QyxPQUFPLEVBQUV6QyxTQUFTLENBQUN5QyxPQUFPLEdBQUd4QyxJQUFJLENBQUN3QyxPQUFPLENBQUE7QUFDbEQsTUFBQSxJQUFJeEMsSUFBSSxDQUFDeUMsV0FBVyxLQUFLckMsU0FBUyxFQUFFTCxTQUFTLENBQUMwQyxXQUFXLEdBQUd6QyxJQUFJLENBQUN5QyxXQUFXLENBQUE7TUFDNUUsSUFBSXpDLElBQUksQ0FBQzBDLE1BQU0sRUFBRTNDLFNBQVMsQ0FBQzJDLE1BQU0sR0FBRzFDLElBQUksQ0FBQzBDLE1BQU0sQ0FBQTtBQUMvQyxNQUFBLElBQUkxQyxJQUFJLENBQUMyQyxXQUFXLEtBQUt2QyxTQUFTLEVBQUVMLFNBQVMsQ0FBQzRDLFdBQVcsR0FBRzNDLElBQUksQ0FBQzJDLFdBQVcsQ0FBQTtBQUM1RSxNQUFBLElBQUkzQyxJQUFJLENBQUM0QyxhQUFhLEtBQUt4QyxTQUFTLElBQUlKLElBQUksQ0FBQzRDLGFBQWEsS0FBSyxJQUFJLEVBQUU3QyxTQUFTLENBQUM2QyxhQUFhLEdBQUc1QyxJQUFJLENBQUM0QyxhQUFhLENBQUE7QUFDakgsTUFBQSxJQUFJNUMsSUFBSSxDQUFDNkMsYUFBYSxLQUFLekMsU0FBUyxFQUFFTCxTQUFTLENBQUM4QyxhQUFhLEdBQUc3QyxJQUFJLENBQUM2QyxhQUFhLENBQUE7TUFDbEYsSUFBSTdDLElBQUksQ0FBQzhDLFFBQVEsRUFBRS9DLFNBQVMsQ0FBQytDLFFBQVEsR0FBRzlDLElBQUksQ0FBQzhDLFFBQVEsQ0FBQTtBQUVyRCxNQUFBLElBQUk5QyxJQUFJLENBQUMrQyxJQUFJLEtBQUszQyxTQUFTLEVBQUU7QUFDekJMLFFBQUFBLFNBQVMsQ0FBQ2dELElBQUksR0FBRy9DLElBQUksQ0FBQytDLElBQUksQ0FBQTtBQUM5QixPQUFBO0FBQ0osS0FBQyxNQUFNLElBQUloRCxTQUFTLENBQUNtQyxJQUFJLEtBQUtjLGdCQUFnQixFQUFFO0FBQzVDLE1BQUEsSUFBSWhELElBQUksQ0FBQ2lELFNBQVMsS0FBSzdDLFNBQVMsRUFBRUwsU0FBUyxDQUFDa0QsU0FBUyxHQUFHakQsSUFBSSxDQUFDaUQsU0FBUyxDQUFBO0FBQ3RFLE1BQUEsSUFBSWpELElBQUksQ0FBQ2tELFVBQVUsS0FBSzlDLFNBQVMsRUFBRUwsU0FBUyxDQUFDbUQsVUFBVSxHQUFHbEQsSUFBSSxDQUFDa0QsVUFBVSxDQUFBO0FBQ3pFLE1BQUEsSUFBSWxELElBQUksQ0FBQ21ELFVBQVUsS0FBSy9DLFNBQVMsRUFBRUwsU0FBUyxDQUFDb0QsVUFBVSxHQUFHbkQsSUFBSSxDQUFDbUQsVUFBVSxDQUFBO0FBQ3pFLE1BQUEsSUFBSW5ELElBQUksQ0FBQ29ELGdCQUFnQixLQUFLaEQsU0FBUyxFQUFFTCxTQUFTLENBQUNxRCxnQkFBZ0IsR0FBR3BELElBQUksQ0FBQ29ELGdCQUFnQixDQUFBO01BQzNGLElBQUlwRCxJQUFJLENBQUNxRCxJQUFJLEtBQUssSUFBSSxJQUFJckQsSUFBSSxDQUFDcUQsSUFBSSxLQUFLakQsU0FBUyxFQUFFO0FBQy9DTCxRQUFBQSxTQUFTLENBQUNzRCxJQUFJLEdBQUdyRCxJQUFJLENBQUNxRCxJQUFJLENBQUE7QUFDOUIsT0FBQyxNQUFNLElBQUlyRCxJQUFJLENBQUNzRCxHQUFHLEtBQUssSUFBSSxJQUFJdEQsSUFBSSxDQUFDc0QsR0FBRyxLQUFLbEQsU0FBUyxFQUFFO0FBQ3BETCxRQUFBQSxTQUFTLENBQUN1RCxHQUFHLEdBQUd0RCxJQUFJLENBQUNzRCxHQUFHLENBQUE7QUFDNUIsT0FBQTtBQUNBLE1BQUEsSUFBSXRELElBQUksQ0FBQ2tCLEtBQUssS0FBS2QsU0FBUyxFQUFFO1FBQzFCYyxLQUFLLEdBQUdsQixJQUFJLENBQUNrQixLQUFLLENBQUE7QUFDbEIsUUFBQSxJQUFJLEVBQUVBLEtBQUssWUFBWW1CLEtBQUssQ0FBQyxFQUFFO0FBQzNCbkIsVUFBQUEsS0FBSyxHQUFHLElBQUltQixLQUFLLENBQUNuQixLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUVBLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRUEsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDbkQsU0FBQTtRQUNBbkIsU0FBUyxDQUFDbUIsS0FBSyxHQUFHQSxLQUFLLENBQUE7QUFDM0IsT0FBQTtBQUNBLE1BQUEsSUFBSWxCLElBQUksQ0FBQ3NDLE9BQU8sS0FBS2xDLFNBQVMsRUFBRTtBQUM1QkwsUUFBQUEsU0FBUyxDQUFDdUMsT0FBTyxHQUFHdEMsSUFBSSxDQUFDc0MsT0FBTyxDQUFBO0FBQ3BDLE9BQUE7QUFDQSxNQUFBLElBQUl0QyxJQUFJLENBQUN1RCxPQUFPLEtBQUtuRCxTQUFTLEVBQUVMLFNBQVMsQ0FBQ3dELE9BQU8sR0FBR3ZELElBQUksQ0FBQ3VELE9BQU8sQ0FBQTtBQUNoRSxNQUFBLElBQUl2RCxJQUFJLENBQUN3RCxRQUFRLEtBQUtwRCxTQUFTLEVBQUU7QUFDN0JMLFFBQUFBLFNBQVMsQ0FBQ3lELFFBQVEsR0FBR3hELElBQUksQ0FBQ3dELFFBQVEsQ0FBQTtRQUNsQyxJQUFJLENBQUN4RCxJQUFJLENBQUN5RCxVQUFVLEVBQUUxRCxTQUFTLENBQUMwRCxVQUFVLEdBQUd6RCxJQUFJLENBQUN3RCxRQUFRLENBQUE7QUFDOUQsT0FBQTtBQUNBLE1BQUEsSUFBSXhELElBQUksQ0FBQ3lELFVBQVUsS0FBS3JELFNBQVMsRUFBRUwsU0FBUyxDQUFDMEQsVUFBVSxHQUFHekQsSUFBSSxDQUFDeUQsVUFBVSxDQUFBO0FBQ3pFLE1BQUEsSUFBSXpELElBQUksQ0FBQzBELFFBQVEsS0FBS3RELFNBQVMsRUFBRUwsU0FBUyxDQUFDMkQsUUFBUSxHQUFHMUQsSUFBSSxDQUFDMEQsUUFBUSxDQUFBO0FBQ25FLE1BQUEsSUFBSTFELElBQUksQ0FBQzJELFNBQVMsS0FBS3ZELFNBQVMsRUFBRUwsU0FBUyxDQUFDNEQsU0FBUyxHQUFHM0QsSUFBSSxDQUFDMkQsU0FBUyxDQUFBO0FBQ3RFLE1BQUEsSUFBSTNELElBQUksQ0FBQzRELFdBQVcsS0FBS3hELFNBQVMsRUFBRUwsU0FBUyxDQUFDNkQsV0FBVyxHQUFHNUQsSUFBSSxDQUFDNEQsV0FBVyxDQUFBO0FBQzVFLE1BQUEsSUFBSTVELElBQUksQ0FBQzZELFdBQVcsS0FBS3pELFNBQVMsRUFBRUwsU0FBUyxDQUFDOEQsV0FBVyxHQUFHN0QsSUFBSSxDQUFDNkQsV0FBVyxDQUFBO01BQzVFLElBQUk3RCxJQUFJLENBQUM4RCxZQUFZLEVBQUUvRCxTQUFTLENBQUMrRCxZQUFZLEdBQUc5RCxJQUFJLENBQUM4RCxZQUFZLENBQUE7TUFDakUsSUFBSTlELElBQUksQ0FBQytELGFBQWEsRUFBRWhFLFNBQVMsQ0FBQ2dFLGFBQWEsR0FBRy9ELElBQUksQ0FBQytELGFBQWEsQ0FBQTtBQUNwRSxNQUFBLElBQUkvRCxJQUFJLENBQUNnRSxTQUFTLEtBQUs1RCxTQUFTLEVBQUVMLFNBQVMsQ0FBQ2lFLFNBQVMsR0FBR2hFLElBQUksQ0FBQ2dFLFNBQVMsQ0FBQTtBQUN0RSxNQUFBLElBQUloRSxJQUFJLENBQUNpRSxJQUFJLEtBQUs3RCxTQUFTLEVBQUVMLFNBQVMsQ0FBQ2tFLElBQUksR0FBR2pFLElBQUksQ0FBQ2lFLElBQUksQ0FBQTtBQUN2RCxNQUFBLElBQUlqRSxJQUFJLENBQUNrRSxTQUFTLEtBQUs5RCxTQUFTLEVBQUVMLFNBQVMsQ0FBQ21FLFNBQVMsR0FBR2xFLElBQUksQ0FBQ2tFLFNBQVMsQ0FBQTtBQUN0RSxNQUFBLElBQUlsRSxJQUFJLENBQUNtRSxZQUFZLEtBQUsvRCxTQUFTLEVBQUVMLFNBQVMsQ0FBQ29FLFlBQVksR0FBR25FLElBQUksQ0FBQ21FLFlBQVksQ0FBQTtBQUMvRSxNQUFBLElBQUluRSxJQUFJLENBQUNvRSxnQkFBZ0IsS0FBS2hFLFNBQVMsRUFBRUwsU0FBUyxDQUFDcUUsZ0JBQWdCLEdBQUdwRSxJQUFJLENBQUNvRSxnQkFBZ0IsQ0FBQTtBQUMzRixNQUFBLElBQUlwRSxJQUFJLENBQUNxRSxXQUFXLEtBQUtqRSxTQUFTLEVBQUVMLFNBQVMsQ0FBQ3NFLFdBQVcsR0FBR3JFLElBQUksQ0FBQ3FFLFdBQVcsQ0FBQTtBQUM1RSxNQUFBLElBQUlyRSxJQUFJLENBQUNzRSxZQUFZLEtBQUtsRSxTQUFTLEVBQUVMLFNBQVMsQ0FBQ3VFLFlBQVksR0FBR3RFLElBQUksQ0FBQ3NFLFlBQVksQ0FBQTtBQUMvRSxNQUFBLElBQUl0RSxJQUFJLENBQUN1RSxZQUFZLEtBQUtuRSxTQUFTLEVBQUVMLFNBQVMsQ0FBQ3dFLFlBQVksR0FBR3ZFLElBQUksQ0FBQ3VFLFlBQVksQ0FBQTtBQUNuRixLQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLElBQUEsTUFBTUMsTUFBTSxHQUFHekUsU0FBUyxDQUFDMEUsZ0JBQWdCLEVBQUUsQ0FBQTtJQUMzQyxJQUFJRCxNQUFNLENBQUNFLE1BQU0sRUFBRTtBQUNmM0UsTUFBQUEsU0FBUyxDQUFDNEUsYUFBYSxDQUFDSCxNQUFNLENBQUNFLE1BQU0sQ0FBQyxDQUFBO0FBQzFDLEtBQUE7SUFFQSxLQUFLLENBQUM1RSx1QkFBdUIsQ0FBQ0MsU0FBUyxFQUFFQyxJQUFJLEVBQUVDLFVBQVUsQ0FBQyxDQUFBO0lBRTFERixTQUFTLENBQUNHLGlCQUFpQixHQUFHLEtBQUssQ0FBQTtJQUVuQyxJQUFJSCxTQUFTLENBQUNtQyxJQUFJLEtBQUtDLGlCQUFpQixJQUFJcEMsU0FBUyxDQUFDNkUsTUFBTSxDQUFDQyxVQUFVLEVBQUU7TUFDckU5RSxTQUFTLENBQUM2RSxNQUFNLENBQUNFLFdBQVcsQ0FBQy9FLFNBQVMsQ0FBQzZFLE1BQU0sQ0FBQ0csSUFBSSxDQUFDLENBQUE7QUFDdkQsS0FBQTtBQUNKLEdBQUE7QUFFQW5GLEVBQUFBLGlCQUFpQkEsQ0FBQ29GLE1BQU0sRUFBRWpGLFNBQVMsRUFBRTtJQUNqQ0EsU0FBUyxDQUFDa0YsUUFBUSxFQUFFLENBQUE7QUFDeEIsR0FBQTtBQUVBQyxFQUFBQSxjQUFjQSxDQUFDRixNQUFNLEVBQUVHLEtBQUssRUFBRTtBQUMxQixJQUFBLE1BQU1DLE1BQU0sR0FBR0osTUFBTSxDQUFDSyxPQUFPLENBQUE7QUFFN0IsSUFBQSxNQUFNckYsSUFBSSxHQUFHO01BQ1QwQixPQUFPLEVBQUUwRCxNQUFNLENBQUMxRCxPQUFPO01BQ3ZCeEQsS0FBSyxFQUFFa0gsTUFBTSxDQUFDbEgsS0FBSztNQUNuQkMsTUFBTSxFQUFFaUgsTUFBTSxDQUFDakgsTUFBTTtBQUNyQmdDLE1BQUFBLE1BQU0sRUFBRWlGLE1BQU0sQ0FBQ2pGLE1BQU0sQ0FBQ2dGLEtBQUssRUFBRTtBQUM3QjVFLE1BQUFBLEtBQUssRUFBRTZFLE1BQU0sQ0FBQzdFLEtBQUssQ0FBQzRFLEtBQUssRUFBRTtBQUMzQmhFLE1BQUFBLE1BQU0sRUFBRWlFLE1BQU0sQ0FBQ2pFLE1BQU0sQ0FBQ2dFLEtBQUssRUFBRTtBQUM3QmpCLE1BQUFBLFNBQVMsRUFBRWtCLE1BQU0sQ0FBQ2xCLFNBQVMsSUFBSWtCLE1BQU0sQ0FBQ2xCLFNBQVMsQ0FBQ2lCLEtBQUssRUFBRSxJQUFJQyxNQUFNLENBQUNsQixTQUFTO01BQzNFakIsU0FBUyxFQUFFbUMsTUFBTSxDQUFDbkMsU0FBUztNQUMzQkMsVUFBVSxFQUFFa0MsTUFBTSxDQUFDbEMsVUFBVTtNQUM3QmhCLElBQUksRUFBRWtELE1BQU0sQ0FBQ2xELElBQUk7QUFDakJFLE1BQUFBLElBQUksRUFBRWdELE1BQU0sQ0FBQ2hELElBQUksSUFBSWdELE1BQU0sQ0FBQ2hELElBQUksQ0FBQytDLEtBQUssRUFBRSxJQUFJQyxNQUFNLENBQUNoRCxJQUFJO01BQ3ZEZSxVQUFVLEVBQUVpQyxNQUFNLENBQUNqQyxVQUFVO01BQzdCQyxnQkFBZ0IsRUFBRWdDLE1BQU0sQ0FBQ2hDLGdCQUFnQjtNQUN6Q1AsYUFBYSxFQUFFdUMsTUFBTSxDQUFDdkMsYUFBYTtNQUNuQ0MsUUFBUSxFQUFFc0MsTUFBTSxDQUFDdEMsUUFBUTtBQUN6QjVCLE1BQUFBLEtBQUssRUFBRWtFLE1BQU0sQ0FBQ2xFLEtBQUssSUFBSWtFLE1BQU0sQ0FBQ2xFLEtBQUssQ0FBQ2lFLEtBQUssRUFBRSxJQUFJQyxNQUFNLENBQUNsRSxLQUFLO01BQzNEb0IsT0FBTyxFQUFFOEMsTUFBTSxDQUFDOUMsT0FBTztNQUN2QkMsWUFBWSxFQUFFNkMsTUFBTSxDQUFDN0MsWUFBWTtNQUNqQ0MsT0FBTyxFQUFFNEMsTUFBTSxDQUFDNUMsT0FBTztNQUN2QkMsV0FBVyxFQUFFMkMsTUFBTSxDQUFDM0MsV0FBVztNQUMvQkMsTUFBTSxFQUFFMEMsTUFBTSxDQUFDMUMsTUFBTTtNQUNyQkMsV0FBVyxFQUFFeUMsTUFBTSxDQUFDekMsV0FBVztNQUMvQkMsYUFBYSxFQUFFd0MsTUFBTSxDQUFDeEMsYUFBYTtNQUNuQ1csT0FBTyxFQUFFNkIsTUFBTSxDQUFDN0IsT0FBTztNQUN2QkUsVUFBVSxFQUFFMkIsTUFBTSxDQUFDM0IsVUFBVTtNQUM3QkUsU0FBUyxFQUFFeUIsTUFBTSxDQUFDekIsU0FBUztNQUMzQjdCLE1BQU0sRUFBRXNELE1BQU0sQ0FBQ3RELE1BQU07TUFDckIwQixRQUFRLEVBQUU0QixNQUFNLENBQUM1QixRQUFRO01BQ3pCSSxXQUFXLEVBQUV3QixNQUFNLENBQUN4QixXQUFXO01BQy9CQyxXQUFXLEVBQUV1QixNQUFNLENBQUN2QixXQUFXO01BQy9CQyxZQUFZLEVBQUVzQixNQUFNLENBQUN0QixZQUFZO01BQ2pDQyxhQUFhLEVBQUVxQixNQUFNLENBQUNyQixhQUFhO01BQ25DTCxRQUFRLEVBQUUwQixNQUFNLENBQUMxQixRQUFRO01BQ3pCTSxTQUFTLEVBQUVvQixNQUFNLENBQUNwQixTQUFTO01BQzNCQyxJQUFJLEVBQUVtQixNQUFNLENBQUNuQixJQUFJO01BQ2pCdEMsUUFBUSxFQUFFeUQsTUFBTSxDQUFDekQsUUFBUTtNQUN6QkMsT0FBTyxFQUFFd0QsTUFBTSxDQUFDeEQsT0FBTztNQUN2QkMsWUFBWSxFQUFFdUQsTUFBTSxDQUFDdkQsWUFBWTtNQUNqQ2tCLElBQUksRUFBRXFDLE1BQU0sQ0FBQ3JDLElBQUk7QUFDakJvQixNQUFBQSxZQUFZLEVBQUVpQixNQUFNLENBQUNqQixZQUFZLElBQUlpQixNQUFNLENBQUNqQixZQUFZLENBQUNnQixLQUFLLEVBQUUsSUFBSUMsTUFBTSxDQUFDakIsWUFBWTtNQUN2RkMsZ0JBQWdCLEVBQUVnQixNQUFNLENBQUNoQixnQkFBZ0I7QUFDekNDLE1BQUFBLFdBQVcsRUFBRWUsTUFBTSxDQUFDZixXQUFXLElBQUllLE1BQU0sQ0FBQ2YsV0FBVyxDQUFDYyxLQUFLLEVBQUUsSUFBSUMsTUFBTSxDQUFDZixXQUFXO0FBQ25GQyxNQUFBQSxZQUFZLEVBQUVjLE1BQU0sQ0FBQ2QsWUFBWSxJQUFJYyxNQUFNLENBQUNkLFlBQVksQ0FBQ2EsS0FBSyxFQUFFLElBQUlDLE1BQU0sQ0FBQ2QsWUFBWTtNQUN2RkMsWUFBWSxFQUFFYSxNQUFNLENBQUNiLFlBQUFBO0tBQ3hCLENBQUE7SUFFRCxJQUFJYSxNQUFNLENBQUM5QixHQUFHLEtBQUtsRCxTQUFTLElBQUlnRixNQUFNLENBQUM5QixHQUFHLEtBQUssSUFBSSxFQUFFO0FBQ2pEdEQsTUFBQUEsSUFBSSxDQUFDc0QsR0FBRyxHQUFHOEIsTUFBTSxDQUFDOUIsR0FBRyxDQUFBO0FBQ3pCLEtBQUMsTUFBTTtBQUNIdEQsTUFBQUEsSUFBSSxDQUFDcUQsSUFBSSxHQUFHK0IsTUFBTSxDQUFDL0IsSUFBSSxDQUFBO0FBQzNCLEtBQUE7QUFFQSxJQUFBLE9BQU8sSUFBSSxDQUFDaUMsWUFBWSxDQUFDSCxLQUFLLEVBQUVuRixJQUFJLENBQUMsQ0FBQTtBQUN6QyxHQUFBO0FBRUF1RixFQUFBQSxzQkFBc0JBLENBQUNDLFdBQVcsRUFBRUMsSUFBSSxFQUFFQyxhQUFhLEVBQUU7SUFDckQsTUFBTUMsSUFBSSxHQUFHLENBQUNILFdBQVcsSUFBSyxDQUFDLElBQUksQ0FBRSxLQUNsQkMsSUFBSSxJQUFLLENBQUMsSUFBSSxDQUFFLENBQUMsSUFDMUJDLGFBQWEsSUFBSyxDQUFDLElBQUksQ0FBRSxDQUFDLENBQUE7QUFFcEMsSUFBQSxJQUFJNUMsUUFBUSxHQUFHLElBQUksQ0FBQ3JELHFCQUFxQixDQUFDa0csSUFBSSxDQUFDLENBQUE7QUFFL0MsSUFBQSxJQUFJN0MsUUFBUSxFQUFFO0FBQ1YsTUFBQSxPQUFPQSxRQUFRLENBQUE7QUFDbkIsS0FBQTtJQUVBLElBQUl4RSxJQUFJLEdBQUcsY0FBYyxDQUFBO0FBRXpCd0UsSUFBQUEsUUFBUSxHQUFHLElBQUk4QyxnQkFBZ0IsRUFBRSxDQUFBO0FBRWpDLElBQUEsSUFBSUgsSUFBSSxFQUFFO0FBQ04zQyxNQUFBQSxRQUFRLENBQUMrQyxPQUFPLEdBQUcsSUFBSSxDQUFDOUgsZUFBZSxDQUFBO01BQ3ZDK0UsUUFBUSxDQUFDZ0QsaUJBQWlCLEdBQUdKLGFBQWEsQ0FBQTtNQUMxQzVDLFFBQVEsQ0FBQ2lELFFBQVEsQ0FBQ3BILEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ2xDLEtBQUMsTUFBTTtNQUNITCxJQUFJLEdBQUcsUUFBUSxHQUFHQSxJQUFJLENBQUE7QUFDdEJ3RSxNQUFBQSxRQUFRLENBQUNpRCxRQUFRLENBQUNwSCxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNyQ21FLE1BQUFBLFFBQVEsQ0FBQ2tELFdBQVcsR0FBRyxJQUFJLENBQUNqSSxlQUFlLENBQUE7TUFDM0MrRSxRQUFRLENBQUNtRCxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBQzVCbkQsTUFBQUEsUUFBUSxDQUFDb0QsVUFBVSxHQUFHLElBQUksQ0FBQ25JLGVBQWUsQ0FBQTtNQUMxQytFLFFBQVEsQ0FBQ3FELGlCQUFpQixHQUFHLEdBQUcsQ0FBQTtBQUNwQyxLQUFBO0FBRUEsSUFBQSxJQUFJWCxXQUFXLEVBQUU7TUFDYmxILElBQUksR0FBRyxhQUFhLEdBQUdBLElBQUksQ0FBQTtNQUMzQndFLFFBQVEsQ0FBQ3NELFNBQVMsR0FBRyxLQUFLLENBQUE7QUFDOUIsS0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0F0RCxJQUFBQSxRQUFRLENBQUN4RSxJQUFJLEdBQUcsU0FBUyxHQUFHQSxJQUFJLENBQUE7SUFDaEN3RSxRQUFRLENBQUN1RCxXQUFXLEdBQUcsS0FBSyxDQUFBO0lBQzVCdkQsUUFBUSxDQUFDd0QsZUFBZSxHQUFHLEtBQUssQ0FBQTtJQUNoQ3hELFFBQVEsQ0FBQ3lELE1BQU0sR0FBRyxLQUFLLENBQUE7SUFDdkJ6RCxRQUFRLENBQUMwRCxTQUFTLEdBQUcsS0FBSyxDQUFBO0FBQzFCMUQsSUFBQUEsUUFBUSxDQUFDMkQsT0FBTyxDQUFDOUgsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDOUJtRSxRQUFRLENBQUNSLE9BQU8sR0FBRyxHQUFHLENBQUE7SUFDdEJRLFFBQVEsQ0FBQzRELFNBQVMsR0FBR0MsbUJBQW1CLENBQUE7SUFDeEM3RCxRQUFRLENBQUM4RCxVQUFVLEdBQUcsS0FBSyxDQUFBO0lBQzNCOUQsUUFBUSxDQUFDK0QsbUJBQW1CLEdBQUcsSUFBSSxDQUFBO0lBQ25DL0QsUUFBUSxDQUFDZ0UsTUFBTSxFQUFFLENBQUE7QUFFakIsSUFBQSxJQUFJLENBQUNySCxxQkFBcUIsQ0FBQ2tHLElBQUksQ0FBQyxHQUFHN0MsUUFBUSxDQUFBO0FBRTNDLElBQUEsT0FBT0EsUUFBUSxDQUFBO0FBQ25CLEdBQUE7QUFFQWlFLEVBQUFBLHdCQUF3QkEsR0FBRztBQUN2QixJQUFBLE1BQU1qRSxRQUFRLEdBQUcsSUFBSThDLGdCQUFnQixFQUFFLENBQUE7QUFFdkM5QyxJQUFBQSxRQUFRLENBQUMyRCxPQUFPLENBQUM5SCxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUM5Qm1FLElBQUFBLFFBQVEsQ0FBQ2lELFFBQVEsQ0FBQ3BILEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3JDbUUsSUFBQUEsUUFBUSxDQUFDa0QsV0FBVyxHQUFHLElBQUksQ0FBQ2pJLGVBQWUsQ0FBQTtJQUMzQytFLFFBQVEsQ0FBQ21ELFlBQVksR0FBRyxJQUFJLENBQUE7QUFDNUJuRCxJQUFBQSxRQUFRLENBQUNvRCxVQUFVLEdBQUcsSUFBSSxDQUFDbkksZUFBZSxDQUFBO0lBQzFDK0UsUUFBUSxDQUFDcUQsaUJBQWlCLEdBQUcsR0FBRyxDQUFBO0lBQ2hDckQsUUFBUSxDQUFDa0UsV0FBVyxHQUFHLElBQUksQ0FBQTtBQUMzQmxFLElBQUFBLFFBQVEsQ0FBQ1IsT0FBTyxHQUFHLENBQUMsQ0FBQztJQUNyQlEsUUFBUSxDQUFDdUQsV0FBVyxHQUFHLEtBQUssQ0FBQTtJQUM1QnZELFFBQVEsQ0FBQ3dELGVBQWUsR0FBRyxLQUFLLENBQUE7SUFDaEN4RCxRQUFRLENBQUN5RCxNQUFNLEdBQUcsS0FBSyxDQUFBO0lBQ3ZCekQsUUFBUSxDQUFDMEQsU0FBUyxHQUFHLEtBQUssQ0FBQTtJQUMxQjFELFFBQVEsQ0FBQzRELFNBQVMsR0FBR0MsbUJBQW1CLENBQUE7SUFDeEM3RCxRQUFRLENBQUM4RCxVQUFVLEdBQUcsS0FBSyxDQUFBO0FBRTNCLElBQUEsT0FBTzlELFFBQVEsQ0FBQTtBQUNuQixHQUFBO0VBRUFtRSx1QkFBdUJBLENBQUN6QixXQUFXLEVBQUV6QyxJQUFJLEVBQUVtRSxVQUFVLEVBQUVDLGNBQWMsRUFBRTtBQUNuRTtBQUNBLElBQUEsSUFBSTNCLFdBQVcsRUFBRTtBQUNiLE1BQUEsSUFBSXpDLElBQUksRUFBRTtBQUNOLFFBQUEsSUFBSW1FLFVBQVUsRUFBRTtBQUNaLFVBQUEsSUFBSSxDQUFDLElBQUksQ0FBQzVILDBDQUEwQyxFQUFFO0FBQ2xELFlBQUEsSUFBSSxDQUFDQSwwQ0FBMEMsR0FBRyxJQUFJLENBQUN5SCx3QkFBd0IsRUFBRSxDQUFBO0FBQ2pGLFlBQUEsSUFBSSxDQUFDekgsMENBQTBDLENBQUNoQixJQUFJLEdBQUcsNENBQTRDLENBQUE7QUFDbkcsWUFBQSxJQUFJLENBQUNnQiwwQ0FBMEMsQ0FBQzhILGNBQWMsR0FBR0Msd0JBQXdCLENBQUE7QUFDekYsWUFBQSxJQUFJLENBQUMvSCwwQ0FBMEMsQ0FBQzhHLFNBQVMsR0FBRyxLQUFLLENBQUE7QUFDakUsWUFBQSxJQUFJLENBQUM5RywwQ0FBMEMsQ0FBQ2dJLFNBQVMsR0FBRyxDQUFDLENBQUE7QUFDN0QsWUFBQSxJQUFJLENBQUNoSSwwQ0FBMEMsQ0FBQ2lJLFFBQVEsR0FBRyxLQUFLLENBQUE7QUFDaEUsWUFBQSxJQUFJLENBQUNqSSwwQ0FBMEMsQ0FBQ2tJLFVBQVUsR0FBRyxLQUFLLENBQUE7QUFDbEUsWUFBQSxJQUFJLENBQUNsSSwwQ0FBMEMsQ0FBQ21JLFNBQVMsR0FBRyxLQUFLLENBQUE7QUFDakUsWUFBQSxJQUFJLENBQUNuSSwwQ0FBMEMsQ0FBQ29JLFVBQVUsR0FBRyxLQUFLLENBQUE7QUFDbEUsWUFBQSxJQUFJLENBQUNwSSwwQ0FBMEMsQ0FBQ3dILE1BQU0sRUFBRSxDQUFBO1lBRXhELElBQUksQ0FBQ3BILHFCQUFxQixDQUFDaUksSUFBSSxDQUFDLElBQUksQ0FBQ3JJLDBDQUEwQyxDQUFDLENBQUE7QUFDcEYsV0FBQTtVQUNBLE9BQU8sSUFBSSxDQUFDQSwwQ0FBMEMsQ0FBQTtTQUN6RCxNQUFNLElBQUk2SCxjQUFjLEVBQUU7QUFDdkIsVUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDNUgseUNBQXlDLEVBQUU7WUFDakQsSUFBSSxDQUFDQSx5Q0FBeUMsR0FBRyxJQUFJLENBQUNGLHFDQUFxQyxDQUFDOEYsS0FBSyxFQUFFLENBQUE7QUFDbkcsWUFBQSxJQUFJLENBQUM1Rix5Q0FBeUMsQ0FBQ2pCLElBQUksR0FBRywyQ0FBMkMsQ0FBQTtBQUNqRyxZQUFBLElBQUksQ0FBQ2lCLHlDQUF5QyxDQUFDNkgsY0FBYyxHQUFHUSx1QkFBdUIsQ0FBQTtBQUN2RixZQUFBLElBQUksQ0FBQ3JJLHlDQUF5QyxDQUFDNkcsU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUNoRSxZQUFBLElBQUksQ0FBQzdHLHlDQUF5QyxDQUFDK0gsU0FBUyxHQUFHLENBQUMsQ0FBQTtBQUM1RCxZQUFBLElBQUksQ0FBQy9ILHlDQUF5QyxDQUFDZ0ksUUFBUSxHQUFHLEtBQUssQ0FBQTtBQUMvRCxZQUFBLElBQUksQ0FBQ2hJLHlDQUF5QyxDQUFDaUksVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUNqRSxZQUFBLElBQUksQ0FBQ2pJLHlDQUF5QyxDQUFDa0ksU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUNoRSxZQUFBLElBQUksQ0FBQ2xJLHlDQUF5QyxDQUFDbUksVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUNqRSxZQUFBLElBQUksQ0FBQ25JLHlDQUF5QyxDQUFDdUgsTUFBTSxFQUFFLENBQUE7WUFFdkQsSUFBSSxDQUFDcEgscUJBQXFCLENBQUNpSSxJQUFJLENBQUMsSUFBSSxDQUFDcEkseUNBQXlDLENBQUMsQ0FBQTtBQUNuRixXQUFBO1VBQ0EsT0FBTyxJQUFJLENBQUNBLHlDQUF5QyxDQUFBO0FBQ3pELFNBQUMsTUFBTTtBQUNILFVBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ0MsbUNBQW1DLEVBQUU7QUFDM0MsWUFBQSxJQUFJLENBQUNBLG1DQUFtQyxHQUFHLElBQUksQ0FBQ3VILHdCQUF3QixFQUFFLENBQUE7QUFDMUUsWUFBQSxJQUFJLENBQUN2SCxtQ0FBbUMsQ0FBQ2xCLElBQUksR0FBRyxxQ0FBcUMsQ0FBQTtBQUNyRixZQUFBLElBQUksQ0FBQ2tCLG1DQUFtQyxDQUFDNEcsU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUMxRCxZQUFBLElBQUksQ0FBQzVHLG1DQUFtQyxDQUFDOEgsU0FBUyxHQUFHLENBQUMsQ0FBQTtBQUN0RCxZQUFBLElBQUksQ0FBQzlILG1DQUFtQyxDQUFDK0gsUUFBUSxHQUFHLEtBQUssQ0FBQTtBQUN6RCxZQUFBLElBQUksQ0FBQy9ILG1DQUFtQyxDQUFDZ0ksVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUMzRCxZQUFBLElBQUksQ0FBQ2hJLG1DQUFtQyxDQUFDaUksU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUMxRCxZQUFBLElBQUksQ0FBQ2pJLG1DQUFtQyxDQUFDa0ksVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUMzRCxZQUFBLElBQUksQ0FBQ2xJLG1DQUFtQyxDQUFDc0gsTUFBTSxFQUFFLENBQUE7WUFFakQsSUFBSSxDQUFDcEgscUJBQXFCLENBQUNpSSxJQUFJLENBQUMsSUFBSSxDQUFDbkksbUNBQW1DLENBQUMsQ0FBQTtBQUM3RSxXQUFBO1VBQ0EsT0FBTyxJQUFJLENBQUNBLG1DQUFtQyxDQUFBO0FBQ25ELFNBQUE7QUFDSixPQUFDLE1BQU07QUFDSCxRQUFBLElBQUkwSCxVQUFVLEVBQUU7QUFDWixVQUFBLElBQUksQ0FBQyxJQUFJLENBQUM5SCxzQ0FBc0MsRUFBRTtBQUM5QyxZQUFBLElBQUksQ0FBQ0Esc0NBQXNDLEdBQUcsSUFBSSxDQUFDMkgsd0JBQXdCLEVBQUUsQ0FBQTtBQUM3RSxZQUFBLElBQUksQ0FBQzNILHNDQUFzQyxDQUFDZCxJQUFJLEdBQUcsd0NBQXdDLENBQUE7QUFDM0YsWUFBQSxJQUFJLENBQUNjLHNDQUFzQyxDQUFDZ0ksY0FBYyxHQUFHQyx3QkFBd0IsQ0FBQTtBQUNyRixZQUFBLElBQUksQ0FBQ2pJLHNDQUFzQyxDQUFDZ0gsU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUM3RCxZQUFBLElBQUksQ0FBQ2hILHNDQUFzQyxDQUFDMEgsTUFBTSxFQUFFLENBQUE7WUFFcEQsSUFBSSxDQUFDcEgscUJBQXFCLENBQUNpSSxJQUFJLENBQUMsSUFBSSxDQUFDdkksc0NBQXNDLENBQUMsQ0FBQTtBQUNoRixXQUFBO1VBQ0EsT0FBTyxJQUFJLENBQUNBLHNDQUFzQyxDQUFBO1NBQ3JELE1BQU0sSUFBSStILGNBQWMsRUFBRTtBQUN2QixVQUFBLElBQUksQ0FBQyxJQUFJLENBQUM5SCxxQ0FBcUMsRUFBRTtBQUM3QyxZQUFBLElBQUksQ0FBQ0EscUNBQXFDLEdBQUcsSUFBSSxDQUFDMEgsd0JBQXdCLEVBQUUsQ0FBQTtBQUM1RSxZQUFBLElBQUksQ0FBQzFILHFDQUFxQyxDQUFDZixJQUFJLEdBQUcsdUNBQXVDLENBQUE7QUFDekYsWUFBQSxJQUFJLENBQUNlLHFDQUFxQyxDQUFDK0gsY0FBYyxHQUFHUSx1QkFBdUIsQ0FBQTtBQUNuRixZQUFBLElBQUksQ0FBQ3ZJLHFDQUFxQyxDQUFDK0csU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUM1RCxZQUFBLElBQUksQ0FBQy9HLHFDQUFxQyxDQUFDeUgsTUFBTSxFQUFFLENBQUE7WUFFbkQsSUFBSSxDQUFDcEgscUJBQXFCLENBQUNpSSxJQUFJLENBQUMsSUFBSSxDQUFDdEkscUNBQXFDLENBQUMsQ0FBQTtBQUMvRSxXQUFBO1VBRUEsT0FBTyxJQUFJLENBQUNBLHFDQUFxQyxDQUFBO0FBQ3JELFNBQUMsTUFBTTtBQUNILFVBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ0YsK0JBQStCLEVBQUU7QUFDdkMsWUFBQSxJQUFJLENBQUNBLCtCQUErQixHQUFHLElBQUksQ0FBQzRILHdCQUF3QixFQUFFLENBQUE7QUFDdEUsWUFBQSxJQUFJLENBQUM1SCwrQkFBK0IsQ0FBQ2IsSUFBSSxHQUFHLGlDQUFpQyxDQUFBO0FBQzdFLFlBQUEsSUFBSSxDQUFDYSwrQkFBK0IsQ0FBQ2lILFNBQVMsR0FBRyxLQUFLLENBQUE7QUFDdEQsWUFBQSxJQUFJLENBQUNqSCwrQkFBK0IsQ0FBQzJILE1BQU0sRUFBRSxDQUFBO1lBRTdDLElBQUksQ0FBQ3BILHFCQUFxQixDQUFDaUksSUFBSSxDQUFDLElBQUksQ0FBQ3hJLCtCQUErQixDQUFDLENBQUE7QUFDekUsV0FBQTtVQUNBLE9BQU8sSUFBSSxDQUFDQSwrQkFBK0IsQ0FBQTtBQUMvQyxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUMsTUFBTTtBQUNILE1BQUEsSUFBSTRELElBQUksRUFBRTtBQUNOLFFBQUEsSUFBSW1FLFVBQVUsRUFBRTtBQUNaLFVBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ2pJLCtCQUErQixFQUFFO0FBQ3ZDLFlBQUEsSUFBSSxDQUFDQSwrQkFBK0IsR0FBRyxJQUFJLENBQUM4SCx3QkFBd0IsRUFBRSxDQUFBO0FBQ3RFLFlBQUEsSUFBSSxDQUFDOUgsK0JBQStCLENBQUNYLElBQUksR0FBRyxpQ0FBaUMsQ0FBQTtBQUM3RSxZQUFBLElBQUksQ0FBQ1csK0JBQStCLENBQUNtSSxjQUFjLEdBQUdDLHdCQUF3QixDQUFBO0FBQzlFLFlBQUEsSUFBSSxDQUFDcEksK0JBQStCLENBQUNxSSxTQUFTLEdBQUcsQ0FBQyxDQUFBO0FBQ2xELFlBQUEsSUFBSSxDQUFDckksK0JBQStCLENBQUNzSSxRQUFRLEdBQUcsS0FBSyxDQUFBO0FBQ3JELFlBQUEsSUFBSSxDQUFDdEksK0JBQStCLENBQUN1SSxVQUFVLEdBQUcsS0FBSyxDQUFBO0FBQ3ZELFlBQUEsSUFBSSxDQUFDdkksK0JBQStCLENBQUN3SSxTQUFTLEdBQUcsS0FBSyxDQUFBO0FBQ3RELFlBQUEsSUFBSSxDQUFDeEksK0JBQStCLENBQUN5SSxVQUFVLEdBQUcsS0FBSyxDQUFBO0FBQ3ZELFlBQUEsSUFBSSxDQUFDekksK0JBQStCLENBQUM2SCxNQUFNLEVBQUUsQ0FBQTtZQUU3QyxJQUFJLENBQUNwSCxxQkFBcUIsQ0FBQ2lJLElBQUksQ0FBQyxJQUFJLENBQUMxSSwrQkFBK0IsQ0FBQyxDQUFBO0FBQ3pFLFdBQUE7VUFDQSxPQUFPLElBQUksQ0FBQ0EsK0JBQStCLENBQUE7U0FDOUMsTUFBTSxJQUFJa0ksY0FBYyxFQUFFO0FBQ3ZCLFVBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ2pJLDhCQUE4QixFQUFFO0FBQ3RDLFlBQUEsSUFBSSxDQUFDQSw4QkFBOEIsR0FBRyxJQUFJLENBQUM2SCx3QkFBd0IsRUFBRSxDQUFBO0FBQ3JFLFlBQUEsSUFBSSxDQUFDN0gsOEJBQThCLENBQUNaLElBQUksR0FBRyxnQ0FBZ0MsQ0FBQTtBQUMzRSxZQUFBLElBQUksQ0FBQ1ksOEJBQThCLENBQUNrSSxjQUFjLEdBQUdRLHVCQUF1QixDQUFBO0FBQzVFLFlBQUEsSUFBSSxDQUFDMUksOEJBQThCLENBQUNvSSxTQUFTLEdBQUcsQ0FBQyxDQUFBO0FBQ2pELFlBQUEsSUFBSSxDQUFDcEksOEJBQThCLENBQUNxSSxRQUFRLEdBQUcsS0FBSyxDQUFBO0FBQ3BELFlBQUEsSUFBSSxDQUFDckksOEJBQThCLENBQUNzSSxVQUFVLEdBQUcsS0FBSyxDQUFBO0FBQ3RELFlBQUEsSUFBSSxDQUFDdEksOEJBQThCLENBQUN1SSxTQUFTLEdBQUcsS0FBSyxDQUFBO0FBQ3JELFlBQUEsSUFBSSxDQUFDdkksOEJBQThCLENBQUN3SSxVQUFVLEdBQUcsS0FBSyxDQUFBO0FBQ3RELFlBQUEsSUFBSSxDQUFDeEksOEJBQThCLENBQUM0SCxNQUFNLEVBQUUsQ0FBQTtZQUU1QyxJQUFJLENBQUNwSCxxQkFBcUIsQ0FBQ2lJLElBQUksQ0FBQyxJQUFJLENBQUN6SSw4QkFBOEIsQ0FBQyxDQUFBO0FBQ3hFLFdBQUE7VUFDQSxPQUFPLElBQUksQ0FBQ0EsOEJBQThCLENBQUE7QUFDOUMsU0FBQyxNQUFNO0FBQ0gsVUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDRix3QkFBd0IsRUFBRTtBQUNoQyxZQUFBLElBQUksQ0FBQ0Esd0JBQXdCLEdBQUcsSUFBSSxDQUFDK0gsd0JBQXdCLEVBQUUsQ0FBQTtBQUMvRCxZQUFBLElBQUksQ0FBQy9ILHdCQUF3QixDQUFDVixJQUFJLEdBQUcsMEJBQTBCLENBQUE7QUFDL0QsWUFBQSxJQUFJLENBQUNVLHdCQUF3QixDQUFDc0ksU0FBUyxHQUFHLENBQUMsQ0FBQTtBQUMzQyxZQUFBLElBQUksQ0FBQ3RJLHdCQUF3QixDQUFDdUksUUFBUSxHQUFHLEtBQUssQ0FBQTtBQUM5QyxZQUFBLElBQUksQ0FBQ3ZJLHdCQUF3QixDQUFDd0ksVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUNoRCxZQUFBLElBQUksQ0FBQ3hJLHdCQUF3QixDQUFDeUksU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUMvQyxZQUFBLElBQUksQ0FBQ3pJLHdCQUF3QixDQUFDMEksVUFBVSxHQUFHLEtBQUssQ0FBQTtBQUNoRCxZQUFBLElBQUksQ0FBQzFJLHdCQUF3QixDQUFDOEgsTUFBTSxFQUFFLENBQUE7WUFFdEMsSUFBSSxDQUFDcEgscUJBQXFCLENBQUNpSSxJQUFJLENBQUMsSUFBSSxDQUFDM0ksd0JBQXdCLENBQUMsQ0FBQTtBQUNsRSxXQUFBO1VBQ0EsT0FBTyxJQUFJLENBQUNBLHdCQUF3QixDQUFBO0FBQ3hDLFNBQUE7QUFDSixPQUFDLE1BQU07QUFDSCxRQUFBLElBQUlrSSxVQUFVLEVBQUU7QUFDWixVQUFBLElBQUksQ0FBQyxJQUFJLENBQUNwSSwyQkFBMkIsRUFBRTtBQUNuQyxZQUFBLElBQUksQ0FBQ0EsMkJBQTJCLEdBQUcsSUFBSSxDQUFDaUksd0JBQXdCLEVBQUUsQ0FBQTtBQUNsRSxZQUFBLElBQUksQ0FBQ2pJLDJCQUEyQixDQUFDUixJQUFJLEdBQUcsNkJBQTZCLENBQUE7QUFDckUsWUFBQSxJQUFJLENBQUNRLDJCQUEyQixDQUFDc0ksY0FBYyxHQUFHQyx3QkFBd0IsQ0FBQTtBQUMxRSxZQUFBLElBQUksQ0FBQ3ZJLDJCQUEyQixDQUFDZ0ksTUFBTSxFQUFFLENBQUE7WUFFekMsSUFBSSxDQUFDcEgscUJBQXFCLENBQUNpSSxJQUFJLENBQUMsSUFBSSxDQUFDN0ksMkJBQTJCLENBQUMsQ0FBQTtBQUNyRSxXQUFBO1VBQ0EsT0FBTyxJQUFJLENBQUNBLDJCQUEyQixDQUFBO1NBQzFDLE1BQU0sSUFBSXFJLGNBQWMsRUFBRTtBQUN2QixVQUFBLElBQUksQ0FBQyxJQUFJLENBQUNwSSwwQkFBMEIsRUFBRTtBQUNsQyxZQUFBLElBQUksQ0FBQ0EsMEJBQTBCLEdBQUcsSUFBSSxDQUFDZ0ksd0JBQXdCLEVBQUUsQ0FBQTtBQUNqRSxZQUFBLElBQUksQ0FBQ2hJLDBCQUEwQixDQUFDVCxJQUFJLEdBQUcsNEJBQTRCLENBQUE7QUFDbkUsWUFBQSxJQUFJLENBQUNTLDBCQUEwQixDQUFDcUksY0FBYyxHQUFHUSx1QkFBdUIsQ0FBQTtBQUN4RSxZQUFBLElBQUksQ0FBQzdJLDBCQUEwQixDQUFDK0gsTUFBTSxFQUFFLENBQUE7WUFFeEMsSUFBSSxDQUFDcEgscUJBQXFCLENBQUNpSSxJQUFJLENBQUMsSUFBSSxDQUFDNUksMEJBQTBCLENBQUMsQ0FBQTtBQUNwRSxXQUFBO1VBQ0EsT0FBTyxJQUFJLENBQUNBLDBCQUEwQixDQUFBO0FBQzFDLFNBQUMsTUFBTTtBQUNILFVBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ0Ysb0JBQW9CLEVBQUU7QUFDNUIsWUFBQSxJQUFJLENBQUNBLG9CQUFvQixHQUFHLElBQUksQ0FBQ2tJLHdCQUF3QixFQUFFLENBQUE7QUFDM0QsWUFBQSxJQUFJLENBQUNsSSxvQkFBb0IsQ0FBQ1AsSUFBSSxHQUFHLHNCQUFzQixDQUFBO0FBQ3ZELFlBQUEsSUFBSSxDQUFDTyxvQkFBb0IsQ0FBQ2lJLE1BQU0sRUFBRSxDQUFBO1lBRWxDLElBQUksQ0FBQ3BILHFCQUFxQixDQUFDaUksSUFBSSxDQUFDLElBQUksQ0FBQzlJLG9CQUFvQixDQUFDLENBQUE7QUFDOUQsV0FBQTtVQUNBLE9BQU8sSUFBSSxDQUFDQSxvQkFBb0IsQ0FBQTtBQUNwQyxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDQTtBQUNKLEdBQUE7O0VBRUFnSix3QkFBd0JBLENBQUNDLElBQUksRUFBRTtJQUMzQixJQUFJLENBQUNqSyxpQkFBaUIsR0FBR2lLLElBQUksQ0FBQTtBQUNqQyxHQUFBO0VBRUFDLGtCQUFrQkEsQ0FBQ0QsSUFBSSxFQUFFO0lBQ3JCLElBQUksQ0FBQ2hLLFdBQVcsR0FBR2dLLElBQUksQ0FBQTtBQUMzQixHQUFBO0FBRUFFLEVBQUFBLG1CQUFtQkEsR0FBRztJQUNsQixPQUFPLElBQUksQ0FBQ25LLGlCQUFpQixDQUFBO0FBQ2pDLEdBQUE7QUFFQW9LLEVBQUFBLGFBQWFBLEdBQUc7SUFDWixPQUFPLElBQUksQ0FBQ25LLFdBQVcsQ0FBQTtBQUMzQixHQUFBO0FBQ0osQ0FBQTtBQUVBb0ssU0FBUyxDQUFDQyxlQUFlLENBQUMxSyxnQkFBZ0IsQ0FBQzJLLFNBQVMsRUFBRWxMLE9BQU8sQ0FBQzs7OzsifQ==
