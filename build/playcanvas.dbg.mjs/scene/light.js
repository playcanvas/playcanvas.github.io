/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { math } from '../core/math/math.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { LIGHTTYPE_DIRECTIONAL, MASK_AFFECT_DYNAMIC, LIGHTFALLOFF_LINEAR, SHADOW_PCF3, BLUR_GAUSSIAN, LIGHTSHAPE_PUNCTUAL, SHADOWUPDATE_REALTIME, LIGHTTYPE_OMNI, SHADOW_PCF5, SHADOW_VSM32, SHADOW_VSM16, SHADOW_VSM8, MASK_BAKE, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, LIGHTTYPE_SPOT } from './constants.js';
import { ShadowRenderer } from './renderer/shadow-renderer.js';

const tmpVec = new Vec3();
const tmpBiases = {
  bias: 0,
  normalBias: 0
};
const chanId = {
  r: 0,
  g: 1,
  b: 2,
  a: 3
};
const lightTypes = {
  'directional': LIGHTTYPE_DIRECTIONAL,
  'omni': LIGHTTYPE_OMNI,
  'point': LIGHTTYPE_OMNI,
  'spot': LIGHTTYPE_SPOT
};

const directionalCascades = [[new Vec4(0, 0, 1, 1)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5), new Vec4(0.5, 0.5, 0.5, 0.5)]];
let id = 0;

class LightRenderData {
  constructor(device, camera, face, light) {
    this.light = light;

    this.camera = camera;

    this.shadowCamera = ShadowRenderer.createShadowCamera(device, light._shadowType, light._type, face);

    this.shadowMatrix = new Mat4();

    this.shadowViewport = new Vec4(0, 0, 1, 1);

    this.shadowScissor = new Vec4(0, 0, 1, 1);

    this.face = face;

    this.visibleCasters = [];
  }

  get shadowBuffer() {
    const rt = this.shadowCamera.renderTarget;
    if (rt) {
      const light = this.light;
      if (light._type === LIGHTTYPE_OMNI) {
        return rt.colorBuffer;
      }
      return light._isPcf && light.device.webgl2 ? rt.depthBuffer : rt.colorBuffer;
    }
    return null;
  }
}

class Light {
  constructor(graphicsDevice) {
    this.device = graphicsDevice;
    this.id = id++;

    this._type = LIGHTTYPE_DIRECTIONAL;
    this._color = new Color(0.8, 0.8, 0.8);
    this._intensity = 1;
    this._luminance = 0;
    this._castShadows = false;
    this._enabled = false;
    this.mask = MASK_AFFECT_DYNAMIC;
    this.isStatic = false;
    this.key = 0;
    this.bakeDir = true;
    this.bakeNumSamples = 1;
    this.bakeArea = 0;

    this.attenuationStart = 10;
    this.attenuationEnd = 10;
    this._falloffMode = LIGHTFALLOFF_LINEAR;
    this._shadowType = SHADOW_PCF3;
    this._vsmBlurSize = 11;
    this.vsmBlurMode = BLUR_GAUSSIAN;
    this.vsmBias = 0.01 * 0.25;
    this._cookie = null;
    this.cookieIntensity = 1;
    this._cookieFalloff = true;
    this._cookieChannel = 'rgb';
    this._cookieTransform = null;
    this._cookieTransformUniform = new Float32Array(4);
    this._cookieOffset = null;
    this._cookieOffsetUniform = new Float32Array(2);
    this._cookieTransformSet = false;
    this._cookieOffsetSet = false;

    this._innerConeAngle = 40;
    this._outerConeAngle = 45;

    this.cascades = null;
    this._shadowMatrixPalette = null;
    this._shadowCascadeDistances = null;
    this.numCascades = 1;
    this.cascadeDistribution = 0.5;

    this._shape = LIGHTSHAPE_PUNCTUAL;

    this._finalColor = new Float32Array([0.8, 0.8, 0.8]);
    const c = Math.pow(this._finalColor[0], 2.2);
    this._linearFinalColor = new Float32Array([c, c, c]);
    this._position = new Vec3(0, 0, 0);
    this._direction = new Vec3(0, 0, 0);
    this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
    this._updateOuterAngle(this._outerConeAngle);
    this._usePhysicalUnits = undefined;

    this._shadowMap = null;
    this._shadowRenderParams = [];

    this.shadowDistance = 40;
    this._shadowResolution = 1024;
    this.shadowBias = -0.0005;
    this.shadowIntensity = 1.0;
    this._normalOffsetBias = 0.0;
    this.shadowUpdateMode = SHADOWUPDATE_REALTIME;
    this._isVsm = false;
    this._isPcf = true;

    this._cookieMatrix = null;

    this._atlasViewport = null;
    this.atlasViewportAllocated = false;
    this.atlasVersion = 0;
    this.atlasSlotIndex = 0;
    this.atlasSlotUpdated = false;

    this._scene = null;
    this._node = null;

    this._renderData = [];

    this.visibleThisFrame = false;

    this.maxScreenSize = 0;
  }
  destroy() {
    this._destroyShadowMap();
    this._renderData = null;
  }
  set numCascades(value) {
    if (!this.cascades || this.numCascades !== value) {
      this.cascades = directionalCascades[value - 1];
      this._shadowMatrixPalette = new Float32Array(4 * 16);
      this._shadowCascadeDistances = new Float32Array(4);
      this._destroyShadowMap();
      this.updateKey();
    }
  }
  get numCascades() {
    return this.cascades.length;
  }
  set shadowMap(shadowMap) {
    if (this._shadowMap !== shadowMap) {
      this._destroyShadowMap();
      this._shadowMap = shadowMap;
    }
  }
  get shadowMap() {
    return this._shadowMap;
  }

  get numShadowFaces() {
    const type = this._type;
    if (type === LIGHTTYPE_DIRECTIONAL) {
      return this.numCascades;
    } else if (type === LIGHTTYPE_OMNI) {
      return 6;
    }
    return 1;
  }
  set type(value) {
    if (this._type === value) return;
    this._type = value;
    this._destroyShadowMap();
    this.updateKey();
    const stype = this._shadowType;
    this._shadowType = null;
    this.shadowType = stype;
  }

  get type() {
    return this._type;
  }
  set shape(value) {
    if (this._shape === value) return;
    this._shape = value;
    this._destroyShadowMap();
    this.updateKey();
    const stype = this._shadowType;
    this._shadowType = null;
    this.shadowType = stype;
  }

  get shape() {
    return this._shape;
  }
  set usePhysicalUnits(value) {
    if (this._usePhysicalUnits !== value) {
      this._usePhysicalUnits = value;
      this._updateFinalColor();
    }
  }
  get usePhysicalUnits() {
    return this._usePhysicalUnits;
  }
  set shadowType(value) {
    if (this._shadowType === value) return;
    const device = this.device;
    if (this._type === LIGHTTYPE_OMNI) value = SHADOW_PCF3;

    if (value === SHADOW_PCF5 && !device.webgl2) {
      value = SHADOW_PCF3;
    }

    if (value === SHADOW_VSM32 && !device.textureFloatRenderable)
      value = SHADOW_VSM16;
    if (value === SHADOW_VSM16 && !device.textureHalfFloatRenderable)
      value = SHADOW_VSM8;
    this._isVsm = value >= SHADOW_VSM8 && value <= SHADOW_VSM32;
    this._isPcf = value === SHADOW_PCF5 || value === SHADOW_PCF3;
    this._shadowType = value;
    this._destroyShadowMap();
    this.updateKey();
  }
  get shadowType() {
    return this._shadowType;
  }
  set enabled(value) {
    if (this._enabled !== value) {
      this._enabled = value;
      this.layersDirty();
    }
  }
  get enabled() {
    return this._enabled;
  }
  set castShadows(value) {
    if (this._castShadows !== value) {
      this._castShadows = value;
      this._destroyShadowMap();
      this.layersDirty();
      this.updateKey();
    }
  }
  get castShadows() {
    return this._castShadows && this.mask !== MASK_BAKE && this.mask !== 0;
  }
  set shadowResolution(value) {
    if (this._shadowResolution !== value) {
      if (this._type === LIGHTTYPE_OMNI) {
        value = Math.min(value, this.device.maxCubeMapSize);
      } else {
        value = Math.min(value, this.device.maxTextureSize);
      }
      this._shadowResolution = value;
      this._destroyShadowMap();
    }
  }
  get shadowResolution() {
    return this._shadowResolution;
  }
  set vsmBlurSize(value) {
    if (this._vsmBlurSize === value) return;
    if (value % 2 === 0) value++;
    this._vsmBlurSize = value;
  }
  get vsmBlurSize() {
    return this._vsmBlurSize;
  }
  set normalOffsetBias(value) {
    if (this._normalOffsetBias === value) return;
    if (!this._normalOffsetBias && value || this._normalOffsetBias && !value) {
      this.updateKey();
    }
    this._normalOffsetBias = value;
  }
  get normalOffsetBias() {
    return this._normalOffsetBias;
  }
  set falloffMode(value) {
    if (this._falloffMode === value) return;
    this._falloffMode = value;
    this.updateKey();
  }
  get falloffMode() {
    return this._falloffMode;
  }
  set innerConeAngle(value) {
    if (this._innerConeAngle === value) return;
    this._innerConeAngle = value;
    this._innerConeAngleCos = Math.cos(value * Math.PI / 180);
    if (this._usePhysicalUnits) {
      this._updateFinalColor();
    }
  }
  get innerConeAngle() {
    return this._innerConeAngle;
  }
  set outerConeAngle(value) {
    if (this._outerConeAngle === value) return;
    this._outerConeAngle = value;
    this._updateOuterAngle(value);
    if (this._usePhysicalUnits) {
      this._updateFinalColor();
    }
  }
  get outerConeAngle() {
    return this._outerConeAngle;
  }
  _updateOuterAngle(angle) {
    const radAngle = angle * Math.PI / 180;
    this._outerConeAngleCos = Math.cos(radAngle);
    this._outerConeAngleSin = Math.sin(radAngle);
  }
  set intensity(value) {
    if (this._intensity !== value) {
      this._intensity = value;
      this._updateFinalColor();
    }
  }
  get intensity() {
    return this._intensity;
  }
  set luminance(value) {
    if (this._luminance !== value) {
      this._luminance = value;
      this._updateFinalColor();
    }
  }
  get luminance() {
    return this._luminance;
  }
  get cookieMatrix() {
    if (!this._cookieMatrix) {
      this._cookieMatrix = new Mat4();
    }
    return this._cookieMatrix;
  }
  get atlasViewport() {
    if (!this._atlasViewport) {
      this._atlasViewport = new Vec4(0, 0, 1, 1);
    }
    return this._atlasViewport;
  }
  set cookie(value) {
    if (this._cookie === value) return;
    this._cookie = value;
    this.updateKey();
  }
  get cookie() {
    return this._cookie;
  }
  set cookieFalloff(value) {
    if (this._cookieFalloff === value) return;
    this._cookieFalloff = value;
    this.updateKey();
  }
  get cookieFalloff() {
    return this._cookieFalloff;
  }
  set cookieChannel(value) {
    if (this._cookieChannel === value) return;
    if (value.length < 3) {
      const chr = value.charAt(value.length - 1);
      const addLen = 3 - value.length;
      for (let i = 0; i < addLen; i++) value += chr;
    }
    this._cookieChannel = value;
    this.updateKey();
  }
  get cookieChannel() {
    return this._cookieChannel;
  }
  set cookieTransform(value) {
    if (this._cookieTransform === value) return;
    this._cookieTransform = value;
    this._cookieTransformSet = !!value;
    if (value && !this._cookieOffset) {
      this.cookieOffset = new Vec2();
      this._cookieOffsetSet = false;
    }
    this.updateKey();
  }
  get cookieTransform() {
    return this._cookieTransform;
  }
  set cookieOffset(value) {
    if (this._cookieOffset === value) return;
    const xformNew = !!(this._cookieTransformSet || value);
    if (xformNew && !value && this._cookieOffset) {
      this._cookieOffset.set(0, 0);
    } else {
      this._cookieOffset = value;
    }
    this._cookieOffsetSet = !!value;
    if (value && !this._cookieTransform) {
      this.cookieTransform = new Vec4(1, 1, 0, 0);
      this._cookieTransformSet = false;
    }
    this.updateKey();
  }
  get cookieOffset() {
    return this._cookieOffset;
  }

  beginFrame() {
    this.visibleThisFrame = this._type === LIGHTTYPE_DIRECTIONAL && this._enabled;
    this.maxScreenSize = 0;
    this.atlasViewportAllocated = false;
    this.atlasSlotUpdated = false;
  }

  _destroyShadowMap() {
    if (this._renderData) {
      this._renderData.length = 0;
    }
    if (this._shadowMap) {
      if (!this._shadowMap.cached) {
        this._shadowMap.destroy();
      }
      this._shadowMap = null;
    }
    if (this.shadowUpdateMode === SHADOWUPDATE_NONE) {
      this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
    }
  }

  getRenderData(camera, face) {
    for (let i = 0; i < this._renderData.length; i++) {
      const current = this._renderData[i];
      if (current.camera === camera && current.face === face) {
        return current;
      }
    }

    const rd = new LightRenderData(this.device, camera, face, this);
    this._renderData.push(rd);
    return rd;
  }

  clone() {
    const clone = new Light(this.device);

    clone.type = this._type;
    clone.setColor(this._color);
    clone.intensity = this._intensity;
    clone.luminance = this._luminance;
    clone.castShadows = this.castShadows;
    clone._enabled = this._enabled;

    clone.attenuationStart = this.attenuationStart;
    clone.attenuationEnd = this.attenuationEnd;
    clone.falloffMode = this._falloffMode;
    clone.shadowType = this._shadowType;
    clone.vsmBlurSize = this._vsmBlurSize;
    clone.vsmBlurMode = this.vsmBlurMode;
    clone.vsmBias = this.vsmBias;
    clone.shadowUpdateMode = this.shadowUpdateMode;
    clone.mask = this.mask;

    clone.innerConeAngle = this._innerConeAngle;
    clone.outerConeAngle = this._outerConeAngle;

    clone.numCascades = this.numCascades;
    clone.cascadeDistribution = this.cascadeDistribution;

    clone.shape = this._shape;

    clone.shadowBias = this.shadowBias;
    clone.normalOffsetBias = this._normalOffsetBias;
    clone.shadowResolution = this._shadowResolution;
    clone.shadowDistance = this.shadowDistance;
    clone.shadowIntensity = this.shadowIntensity;

    return clone;
  }

  static getLightUnitConversion(type, outerAngle = Math.PI / 4, innerAngle = 0) {
    switch (type) {
      case LIGHTTYPE_SPOT:
        {
          const falloffEnd = Math.cos(outerAngle);
          const falloffStart = Math.cos(innerAngle);

          return 2 * Math.PI * (1 - falloffStart + (falloffStart - falloffEnd) / 2.0);
        }
      case LIGHTTYPE_OMNI:
        return 4 * Math.PI;
      case LIGHTTYPE_DIRECTIONAL:
        return 1;
    }
  }

  _getUniformBiasValues(lightRenderData) {
    const farClip = lightRenderData.shadowCamera._farClip;
    switch (this._type) {
      case LIGHTTYPE_OMNI:
        tmpBiases.bias = this.shadowBias;
        tmpBiases.normalBias = this._normalOffsetBias;
        break;
      case LIGHTTYPE_SPOT:
        if (this._isVsm) {
          tmpBiases.bias = -0.00001 * 20;
        } else {
          tmpBiases.bias = this.shadowBias * 20;
          if (!this.device.webgl2 && this.device.extStandardDerivatives) tmpBiases.bias *= -100;
        }
        tmpBiases.normalBias = this._isVsm ? this.vsmBias / (this.attenuationEnd / 7.0) : this._normalOffsetBias;
        break;
      case LIGHTTYPE_DIRECTIONAL:
        if (this._isVsm) {
          tmpBiases.bias = -0.00001 * 20;
        } else {
          tmpBiases.bias = this.shadowBias / farClip * 100;
          if (!this.device.webgl2 && this.device.extStandardDerivatives) tmpBiases.bias *= -100;
        }
        tmpBiases.normalBias = this._isVsm ? this.vsmBias / (farClip / 7.0) : this._normalOffsetBias;
        break;
    }
    return tmpBiases;
  }
  getColor() {
    return this._color;
  }
  getBoundingSphere(sphere) {
    if (this._type === LIGHTTYPE_SPOT) {
      const size = this.attenuationEnd;
      const angle = this._outerConeAngle;
      const cosAngle = this._outerConeAngleCos;
      const node = this._node;
      tmpVec.copy(node.up);
      if (angle > 45) {
        sphere.radius = size * this._outerConeAngleSin;
        tmpVec.mulScalar(-size * cosAngle);
      } else {
        sphere.radius = size / (2 * cosAngle);
        tmpVec.mulScalar(-sphere.radius);
      }
      sphere.center.add2(node.getPosition(), tmpVec);
    } else if (this._type === LIGHTTYPE_OMNI) {
      sphere.center = this._node.getPosition();
      sphere.radius = this.attenuationEnd;
    }
  }
  getBoundingBox(box) {
    if (this._type === LIGHTTYPE_SPOT) {
      const range = this.attenuationEnd;
      const angle = this._outerConeAngle;
      const node = this._node;
      const scl = Math.abs(Math.sin(angle * math.DEG_TO_RAD) * range);
      box.center.set(0, -range * 0.5, 0);
      box.halfExtents.set(scl, range * 0.5, scl);
      box.setFromTransformedAabb(box, node.getWorldTransform(), true);
    } else if (this._type === LIGHTTYPE_OMNI) {
      box.center.copy(this._node.getPosition());
      box.halfExtents.set(this.attenuationEnd, this.attenuationEnd, this.attenuationEnd);
    }
  }
  _updateFinalColor() {
    const color = this._color;
    const r = color.r;
    const g = color.g;
    const b = color.b;
    let i = this._intensity;

    if (this._usePhysicalUnits) {
      i = this._luminance / Light.getLightUnitConversion(this._type, this._outerConeAngle * math.DEG_TO_RAD, this._innerConeAngle * math.DEG_TO_RAD);
    }
    const finalColor = this._finalColor;
    const linearFinalColor = this._linearFinalColor;
    finalColor[0] = r * i;
    finalColor[1] = g * i;
    finalColor[2] = b * i;
    if (i >= 1) {
      linearFinalColor[0] = Math.pow(r, 2.2) * i;
      linearFinalColor[1] = Math.pow(g, 2.2) * i;
      linearFinalColor[2] = Math.pow(b, 2.2) * i;
    } else {
      linearFinalColor[0] = Math.pow(finalColor[0], 2.2);
      linearFinalColor[1] = Math.pow(finalColor[1], 2.2);
      linearFinalColor[2] = Math.pow(finalColor[2], 2.2);
    }
  }
  setColor() {
    if (arguments.length === 1) {
      this._color.set(arguments[0].r, arguments[0].g, arguments[0].b);
    } else if (arguments.length === 3) {
      this._color.set(arguments[0], arguments[1], arguments[2]);
    }
    this._updateFinalColor();
  }
  updateShadow() {
    if (this.shadowUpdateMode !== SHADOWUPDATE_REALTIME) {
      this.shadowUpdateMode = SHADOWUPDATE_THISFRAME;
    }
  }
  layersDirty() {
    var _this$_scene;
    if ((_this$_scene = this._scene) != null && _this$_scene.layers) {
      this._scene.layers._dirtyLights = true;
    }
  }
  updateKey() {
    let key = this._type << 29 | (this._castShadows ? 1 : 0) << 28 | this._shadowType << 25 | this._falloffMode << 23 | (this._normalOffsetBias !== 0.0 ? 1 : 0) << 22 | (this._cookie ? 1 : 0) << 21 | (this._cookieFalloff ? 1 : 0) << 20 | chanId[this._cookieChannel.charAt(0)] << 18 | (this._cookieTransform ? 1 : 0) << 12 | this._shape << 10 | this.numCascades - 1 << 8;
    if (this._cookieChannel.length === 3) {
      key |= chanId[this._cookieChannel.charAt(1)] << 16;
      key |= chanId[this._cookieChannel.charAt(2)] << 14;
    }
    if (key !== this.key && this._scene !== null) {
      this.layersDirty();
    }
    this.key = key;
  }
}

export { Light, lightTypes };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9saWdodC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHtcbiAgICBCTFVSX0dBVVNTSUFOLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIE1BU0tfQkFLRSwgTUFTS19BRkZFQ1RfRFlOQU1JQyxcbiAgICBTSEFET1dfUENGMywgU0hBRE9XX1BDRjUsIFNIQURPV19WU004LCBTSEFET1dfVlNNMTYsIFNIQURPV19WU00zMixcbiAgICBTSEFET1dVUERBVEVfTk9ORSwgU0hBRE9XVVBEQVRFX1JFQUxUSU1FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FLFxuICAgIExJR0hUU0hBUEVfUFVOQ1RVQUwsIExJR0hURkFMTE9GRl9MSU5FQVJcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZG93UmVuZGVyZXIgfSBmcm9tICcuL3JlbmRlcmVyL3NoYWRvdy1yZW5kZXJlci5qcyc7XG5cbmNvbnN0IHRtcFZlYyA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBCaWFzZXMgPSB7XG4gICAgYmlhczogMCxcbiAgICBub3JtYWxCaWFzOiAwXG59O1xuXG5jb25zdCBjaGFuSWQgPSB7IHI6IDAsIGc6IDEsIGI6IDIsIGE6IDMgfTtcblxuY29uc3QgbGlnaHRUeXBlcyA9IHtcbiAgICAnZGlyZWN0aW9uYWwnOiBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgJ29tbmknOiBMSUdIVFRZUEVfT01OSSxcbiAgICAncG9pbnQnOiBMSUdIVFRZUEVfT01OSSxcbiAgICAnc3BvdCc6IExJR0hUVFlQRV9TUE9UXG59O1xuXG4vLyB2aWV3cG9ydCBpbiBzaGFkb3dzIG1hcCBmb3IgY2FzY2FkZXMgZm9yIGRpcmVjdGlvbmFsIGxpZ2h0XG5jb25zdCBkaXJlY3Rpb25hbENhc2NhZGVzID0gW1xuICAgIFtuZXcgVmVjNCgwLCAwLCAxLCAxKV0sXG4gICAgW25ldyBWZWM0KDAsIDAsIDAuNSwgMC41KSwgbmV3IFZlYzQoMCwgMC41LCAwLjUsIDAuNSldLFxuICAgIFtuZXcgVmVjNCgwLCAwLCAwLjUsIDAuNSksIG5ldyBWZWM0KDAsIDAuNSwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLjUsIDAsIDAuNSwgMC41KV0sXG4gICAgW25ldyBWZWM0KDAsIDAsIDAuNSwgMC41KSwgbmV3IFZlYzQoMCwgMC41LCAwLjUsIDAuNSksIG5ldyBWZWM0KDAuNSwgMCwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLjUsIDAuNSwgMC41LCAwLjUpXVxuXTtcblxubGV0IGlkID0gMDtcblxuLy8gQ2xhc3Mgc3RvcmluZyBzaGFkb3cgcmVuZGVyaW5nIHJlbGF0ZWQgcHJpdmF0ZSBpbmZvcm1hdGlvblxuY2xhc3MgTGlnaHRSZW5kZXJEYXRhIHtcbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIGNhbWVyYSwgZmFjZSwgbGlnaHQpIHtcblxuICAgICAgICAvLyBsaWdodCB0aGlzIGRhdGEgYmVsb25ncyB0b1xuICAgICAgICB0aGlzLmxpZ2h0ID0gbGlnaHQ7XG5cbiAgICAgICAgLy8gY2FtZXJhIHRoaXMgYXBwbGllcyB0by4gT25seSB1c2VkIGJ5IGRpcmVjdGlvbmFsIGxpZ2h0LCBhcyBkaXJlY3Rpb25hbCBzaGFkb3cgbWFwXG4gICAgICAgIC8vIGlzIGN1bGxlZCBhbmQgcmVuZGVyZWQgZm9yIGVhY2ggY2FtZXJhLiBMb2NhbCBsaWdodHMnIHNoYWRvdyBpcyBjdWxsZWQgYW5kIHJlbmRlcmVkIG9uZSB0aW1lXG4gICAgICAgIC8vIGFuZCBzaGFyZWQgYmV0d2VlbiBjYW1lcmFzIChldmVuIHRob3VnaCBpdCdzIG5vdCBzdHJpY3RseSBjb3JyZWN0IGFuZCB3ZSBjYW4gZ2V0IHNoYWRvd3NcbiAgICAgICAgLy8gZnJvbSBhIG1lc2ggdGhhdCBpcyBub3QgdmlzaWJsZSBieSB0aGUgY2FtZXJhKVxuICAgICAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcblxuICAgICAgICAvLyBjYW1lcmEgdXNlZCB0byBjdWxsIC8gcmVuZGVyIHRoZSBzaGFkb3cgbWFwXG4gICAgICAgIHRoaXMuc2hhZG93Q2FtZXJhID0gU2hhZG93UmVuZGVyZXIuY3JlYXRlU2hhZG93Q2FtZXJhKGRldmljZSwgbGlnaHQuX3NoYWRvd1R5cGUsIGxpZ2h0Ll90eXBlLCBmYWNlKTtcblxuICAgICAgICAvLyBzaGFkb3cgdmlldy1wcm9qZWN0aW9uIG1hdHJpeFxuICAgICAgICB0aGlzLnNoYWRvd01hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgLy8gdmlld3BvcnQgZm9yIHRoZSBzaGFkb3cgcmVuZGVyaW5nIHRvIHRoZSB0ZXh0dXJlICh4LCB5LCB3aWR0aCwgaGVpZ2h0KVxuICAgICAgICB0aGlzLnNoYWRvd1ZpZXdwb3J0ID0gbmV3IFZlYzQoMCwgMCwgMSwgMSk7XG5cbiAgICAgICAgLy8gc2Npc3NvciByZWN0YW5nbGUgZm9yIHRoZSBzaGFkb3cgcmVuZGVyaW5nIHRvIHRoZSB0ZXh0dXJlICh4LCB5LCB3aWR0aCwgaGVpZ2h0KVxuICAgICAgICB0aGlzLnNoYWRvd1NjaXNzb3IgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTtcblxuICAgICAgICAvLyBmYWNlIGluZGV4LCB2YWx1ZSBpcyBiYXNlZCBvbiBsaWdodCB0eXBlOlxuICAgICAgICAvLyAtIHNwb3Q6IGFsd2F5cyAwXG4gICAgICAgIC8vIC0gb21uaTogY3ViZW1hcCBmYWNlLCAwLi41XG4gICAgICAgIC8vIC0gZGlyZWN0aW9uYWw6IDAgZm9yIHNpbXBsZSBzaGFkb3dzLCBjYXNjYWRlIGluZGV4IGZvciBjYXNjYWRlZCBzaGFkb3cgbWFwXG4gICAgICAgIHRoaXMuZmFjZSA9IGZhY2U7XG5cbiAgICAgICAgLy8gdmlzaWJsZSBzaGFkb3cgY2FzdGVyc1xuICAgICAgICB0aGlzLnZpc2libGVDYXN0ZXJzID0gW107XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyBzaGFkb3cgYnVmZmVyIGN1cnJlbnRseSBhdHRhY2hlZCB0byB0aGUgc2hhZG93IGNhbWVyYVxuICAgIGdldCBzaGFkb3dCdWZmZXIoKSB7XG4gICAgICAgIGNvbnN0IHJ0ID0gdGhpcy5zaGFkb3dDYW1lcmEucmVuZGVyVGFyZ2V0O1xuICAgICAgICBpZiAocnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gdGhpcy5saWdodDtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcnQuY29sb3JCdWZmZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBsaWdodC5faXNQY2YgJiYgbGlnaHQuZGV2aWNlLndlYmdsMiA/IHJ0LmRlcHRoQnVmZmVyIDogcnQuY29sb3JCdWZmZXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogQSBsaWdodC5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIExpZ2h0IHtcbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuICAgICAgICB0aGlzLmlkID0gaWQrKztcblxuICAgICAgICAvLyBMaWdodCBwcm9wZXJ0aWVzIChkZWZhdWx0cylcbiAgICAgICAgdGhpcy5fdHlwZSA9IExJR0hUVFlQRV9ESVJFQ1RJT05BTDtcbiAgICAgICAgdGhpcy5fY29sb3IgPSBuZXcgQ29sb3IoMC44LCAwLjgsIDAuOCk7XG4gICAgICAgIHRoaXMuX2ludGVuc2l0eSA9IDE7XG4gICAgICAgIHRoaXMuX2x1bWluYW5jZSA9IDA7XG4gICAgICAgIHRoaXMuX2Nhc3RTaGFkb3dzID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2VuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5tYXNrID0gTUFTS19BRkZFQ1RfRFlOQU1JQztcbiAgICAgICAgdGhpcy5pc1N0YXRpYyA9IGZhbHNlO1xuICAgICAgICB0aGlzLmtleSA9IDA7XG4gICAgICAgIHRoaXMuYmFrZURpciA9IHRydWU7XG4gICAgICAgIHRoaXMuYmFrZU51bVNhbXBsZXMgPSAxO1xuICAgICAgICB0aGlzLmJha2VBcmVhID0gMDtcblxuICAgICAgICAvLyBPbW5pIGFuZCBzcG90IHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5hdHRlbnVhdGlvblN0YXJ0ID0gMTA7XG4gICAgICAgIHRoaXMuYXR0ZW51YXRpb25FbmQgPSAxMDtcbiAgICAgICAgdGhpcy5fZmFsbG9mZk1vZGUgPSBMSUdIVEZBTExPRkZfTElORUFSO1xuICAgICAgICB0aGlzLl9zaGFkb3dUeXBlID0gU0hBRE9XX1BDRjM7XG4gICAgICAgIHRoaXMuX3ZzbUJsdXJTaXplID0gMTE7XG4gICAgICAgIHRoaXMudnNtQmx1ck1vZGUgPSBCTFVSX0dBVVNTSUFOO1xuICAgICAgICB0aGlzLnZzbUJpYXMgPSAwLjAxICogMC4yNTtcbiAgICAgICAgdGhpcy5fY29va2llID0gbnVsbDsgLy8gbGlnaHQgY29va2llIHRleHR1cmUgKDJEIGZvciBzcG90LCBjdWJlbWFwIGZvciBvbW5pKVxuICAgICAgICB0aGlzLmNvb2tpZUludGVuc2l0eSA9IDE7XG4gICAgICAgIHRoaXMuX2Nvb2tpZUZhbGxvZmYgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jb29raWVDaGFubmVsID0gJ3JnYic7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybSA9IG51bGw7IC8vIDJkIHJvdGF0aW9uL3NjYWxlIG1hdHJpeCAoc3BvdCBvbmx5KVxuICAgICAgICB0aGlzLl9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5fY29va2llT2Zmc2V0ID0gbnVsbDsgLy8gMmQgcG9zaXRpb24gb2Zmc2V0IChzcG90IG9ubHkpXG4gICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldFVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuICAgICAgICB0aGlzLl9jb29raWVUcmFuc2Zvcm1TZXQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fY29va2llT2Zmc2V0U2V0ID0gZmFsc2U7XG5cbiAgICAgICAgLy8gU3BvdCBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlID0gNDA7XG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlID0gNDU7XG5cbiAgICAgICAgLy8gRGlyZWN0aW9uYWwgcHJvcGVydGllc1xuICAgICAgICB0aGlzLmNhc2NhZGVzID0gbnVsbDsgICAgICAgICAgICAgICAvLyBhbiBhcnJheSBvZiBWZWM0IHZpZXdwb3J0cyBwZXIgY2FzY2FkZVxuICAgICAgICB0aGlzLl9zaGFkb3dNYXRyaXhQYWxldHRlID0gbnVsbDsgICAvLyBhIGZsb2F0IGFycmF5LCAxNiBmbG9hdHMgcGVyIGNhc2NhZGVcbiAgICAgICAgdGhpcy5fc2hhZG93Q2FzY2FkZURpc3RhbmNlcyA9IG51bGw7XG4gICAgICAgIHRoaXMubnVtQ2FzY2FkZXMgPSAxO1xuICAgICAgICB0aGlzLmNhc2NhZGVEaXN0cmlidXRpb24gPSAwLjU7XG5cbiAgICAgICAgLy8gTGlnaHQgc291cmNlIHNoYXBlIHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5fc2hhcGUgPSBMSUdIVFNIQVBFX1BVTkNUVUFMO1xuXG4gICAgICAgIC8vIENhY2hlIG9mIGxpZ2h0IHByb3BlcnR5IGRhdGEgaW4gYSBmb3JtYXQgbW9yZSBmcmllbmRseSBmb3Igc2hhZGVyIHVuaWZvcm1zXG4gICAgICAgIHRoaXMuX2ZpbmFsQ29sb3IgPSBuZXcgRmxvYXQzMkFycmF5KFswLjgsIDAuOCwgMC44XSk7XG4gICAgICAgIGNvbnN0IGMgPSBNYXRoLnBvdyh0aGlzLl9maW5hbENvbG9yWzBdLCAyLjIpO1xuICAgICAgICB0aGlzLl9saW5lYXJGaW5hbENvbG9yID0gbmV3IEZsb2F0MzJBcnJheShbYywgYywgY10pO1xuXG4gICAgICAgIHRoaXMuX3Bvc2l0aW9uID0gbmV3IFZlYzMoMCwgMCwgMCk7XG4gICAgICAgIHRoaXMuX2RpcmVjdGlvbiA9IG5ldyBWZWMzKDAsIDAsIDApO1xuICAgICAgICB0aGlzLl9pbm5lckNvbmVBbmdsZUNvcyA9IE1hdGguY29zKHRoaXMuX2lubmVyQ29uZUFuZ2xlICogTWF0aC5QSSAvIDE4MCk7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU91dGVyQW5nbGUodGhpcy5fb3V0ZXJDb25lQW5nbGUpO1xuXG4gICAgICAgIHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgLy8gU2hhZG93IG1hcHBpbmcgcmVzb3VyY2VzXG4gICAgICAgIHRoaXMuX3NoYWRvd01hcCA9IG51bGw7XG4gICAgICAgIHRoaXMuX3NoYWRvd1JlbmRlclBhcmFtcyA9IFtdO1xuXG4gICAgICAgIC8vIFNoYWRvdyBtYXBwaW5nIHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5zaGFkb3dEaXN0YW5jZSA9IDQwO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uID0gMTAyNDtcbiAgICAgICAgdGhpcy5zaGFkb3dCaWFzID0gLTAuMDAwNTtcbiAgICAgICAgdGhpcy5zaGFkb3dJbnRlbnNpdHkgPSAxLjA7XG4gICAgICAgIHRoaXMuX25vcm1hbE9mZnNldEJpYXMgPSAwLjA7XG4gICAgICAgIHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9SRUFMVElNRTtcbiAgICAgICAgdGhpcy5faXNWc20gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNQY2YgPSB0cnVlO1xuXG4gICAgICAgIC8vIGNvb2tpZSBtYXRyaXggKHVzZWQgaW4gY2FzZSB0aGUgc2hhZG93IG1hcHBpbmcgaXMgZGlzYWJsZWQgYW5kIHNvIHRoZSBzaGFkb3cgbWF0cml4IGNhbm5vdCBiZSB1c2VkKVxuICAgICAgICB0aGlzLl9jb29raWVNYXRyaXggPSBudWxsO1xuXG4gICAgICAgIC8vIHZpZXdwb3J0IG9mIHRoZSBjb29raWUgdGV4dHVyZSAvIHNoYWRvdyBpbiB0aGUgYXRsYXNcbiAgICAgICAgdGhpcy5fYXRsYXNWaWV3cG9ydCA9IG51bGw7XG4gICAgICAgIHRoaXMuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCA9IGZhbHNlOyAgICAvLyBpZiB0cnVlLCBhdGxhcyBzbG90IGlzIGFsbG9jYXRlZCBmb3IgdGhlIGN1cnJlbnQgZnJhbWVcbiAgICAgICAgdGhpcy5hdGxhc1ZlcnNpb24gPSAwOyAgICAgIC8vIHZlcnNpb24gb2YgdGhlIGF0bGFzIGZvciB0aGUgYWxsb2NhdGVkIHNsb3QsIGFsbG93cyBpbnZhbGlkYXRpb24gd2hlbiBhdGxhcyByZWNyZWF0ZXMgc2xvdHNcbiAgICAgICAgdGhpcy5hdGxhc1Nsb3RJbmRleCA9IDA7ICAgIC8vIGFsbG9jYXRlZCBzbG90IGluZGV4LCB1c2VkIGZvciBtb3JlIHBlcnNpc3RlbnQgc2xvdCBhbGxvY2F0aW9uXG4gICAgICAgIHRoaXMuYXRsYXNTbG90VXBkYXRlZCA9IGZhbHNlOyAgLy8gdHJ1ZSBpZiB0aGUgYXRsYXMgc2xvdCB3YXMgcmVhc3NpZ25lZCB0aGlzIGZyYW1lIChhbmQgY29udGVudCBuZWVkcyB0byBiZSB1cGRhdGVkKVxuXG4gICAgICAgIHRoaXMuX3NjZW5lID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbm9kZSA9IG51bGw7XG5cbiAgICAgICAgLy8gcHJpdmF0ZSByZW5kZXJpbmcgZGF0YVxuICAgICAgICB0aGlzLl9yZW5kZXJEYXRhID0gW107XG5cbiAgICAgICAgLy8gdHJ1ZSBpZiB0aGUgbGlnaHQgaXMgdmlzaWJsZSBieSBhbnkgY2FtZXJhIHdpdGhpbiBhIGZyYW1lXG4gICAgICAgIHRoaXMudmlzaWJsZVRoaXNGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIG1heGltdW0gc2l6ZSBvZiB0aGUgbGlnaHQgYm91bmRpbmcgc3BoZXJlIG9uIHRoZSBzY3JlZW4gYnkgYW55IGNhbWVyYSB3aXRoaW4gYSBmcmFtZVxuICAgICAgICAvLyAodXNlZCB0byBlc3RpbWF0ZSBzaGFkb3cgcmVzb2x1dGlvbiksIHJhbmdlIFswLi4xXVxuICAgICAgICB0aGlzLm1heFNjcmVlblNpemUgPSAwO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyRGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgc2V0IG51bUNhc2NhZGVzKHZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5jYXNjYWRlcyB8fCB0aGlzLm51bUNhc2NhZGVzICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5jYXNjYWRlcyA9IGRpcmVjdGlvbmFsQ2FzY2FkZXNbdmFsdWUgLSAxXTtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hdHJpeFBhbGV0dGUgPSBuZXcgRmxvYXQzMkFycmF5KDQgKiAxNik7ICAgLy8gYWx3YXlzIDRcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMgPSBuZXcgRmxvYXQzMkFycmF5KDQpOyAgICAgLy8gYWx3YXlzIDRcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbnVtQ2FzY2FkZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhc2NhZGVzLmxlbmd0aDtcbiAgICB9XG5cbiAgICBzZXQgc2hhZG93TWFwKHNoYWRvd01hcCkge1xuICAgICAgICBpZiAodGhpcy5fc2hhZG93TWFwICE9PSBzaGFkb3dNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hcCA9IHNoYWRvd01hcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzaGFkb3dNYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkb3dNYXA7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyBudW1iZXIgb2YgcmVuZGVyIHRhcmdldHMgdG8gcmVuZGVyIHRoZSBzaGFkb3cgbWFwXG4gICAgZ2V0IG51bVNoYWRvd0ZhY2VzKCkge1xuICAgICAgICBjb25zdCB0eXBlID0gdGhpcy5fdHlwZTtcbiAgICAgICAgaWYgKHR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubnVtQ2FzY2FkZXM7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgIHJldHVybiA2O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuXG4gICAgICAgIGNvbnN0IHN0eXBlID0gdGhpcy5fc2hhZG93VHlwZTtcbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZG93VHlwZSA9IHN0eXBlOyAvLyByZWZyZXNoIHNoYWRvdyB0eXBlOyBzd2l0Y2hpbmcgZnJvbSBkaXJlY3Qvc3BvdCB0byBvbW5pIGFuZCBiYWNrIG1heSBjaGFuZ2UgaXRcbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgc2V0IHNoYXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFwZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fc2hhcGUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuXG4gICAgICAgIGNvbnN0IHN0eXBlID0gdGhpcy5fc2hhZG93VHlwZTtcbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZG93VHlwZSA9IHN0eXBlOyAvLyByZWZyZXNoIHNoYWRvdyB0eXBlOyBzd2l0Y2hpbmcgc2hhcGUgYW5kIGJhY2sgbWF5IGNoYW5nZSBpdFxuICAgIH1cblxuICAgIGdldCBzaGFwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYXBlO1xuICAgIH1cblxuICAgIHNldCB1c2VQaHlzaWNhbFVuaXRzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl91c2VQaHlzaWNhbFVuaXRzICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fdXNlUGh5c2ljYWxVbml0cyA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlRmluYWxDb2xvcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHVzZVBoeXNpY2FsVW5pdHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91c2VQaHlzaWNhbFVuaXRzO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dUeXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dUeXBlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpXG4gICAgICAgICAgICB2YWx1ZSA9IFNIQURPV19QQ0YzOyAvLyBWU00gb3IgSFcgUENGIGZvciBvbW5pIGxpZ2h0cyBpcyBub3Qgc3VwcG9ydGVkIHlldFxuXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gU0hBRE9XX1BDRjUgJiYgIWRldmljZS53ZWJnbDIpIHtcbiAgICAgICAgICAgIHZhbHVlID0gU0hBRE9XX1BDRjM7IC8vIGZhbGxiYWNrIGZyb20gSFcgUENGIHRvIG9sZCBQQ0ZcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gU0hBRE9XX1ZTTTMyICYmICFkZXZpY2UudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSkgLy8gZmFsbGJhY2sgZnJvbSB2c20zMiB0byB2c20xNlxuICAgICAgICAgICAgdmFsdWUgPSBTSEFET1dfVlNNMTY7XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSBTSEFET1dfVlNNMTYgJiYgIWRldmljZS50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSkgLy8gZmFsbGJhY2sgZnJvbSB2c20xNiB0byB2c204XG4gICAgICAgICAgICB2YWx1ZSA9IFNIQURPV19WU004O1xuXG4gICAgICAgIHRoaXMuX2lzVnNtID0gdmFsdWUgPj0gU0hBRE9XX1ZTTTggJiYgdmFsdWUgPD0gU0hBRE9XX1ZTTTMyO1xuICAgICAgICB0aGlzLl9pc1BjZiA9IHZhbHVlID09PSBTSEFET1dfUENGNSB8fCB2YWx1ZSA9PT0gU0hBRE9XX1BDRjM7XG5cbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd1R5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkb3dUeXBlO1xuICAgIH1cblxuICAgIHNldCBlbmFibGVkKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5sYXllcnNEaXJ0eSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGVuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkO1xuICAgIH1cblxuICAgIHNldCBjYXN0U2hhZG93cyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY2FzdFNoYWRvd3MgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9jYXN0U2hhZG93cyA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICAgICAgdGhpcy5sYXllcnNEaXJ0eSgpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjYXN0U2hhZG93cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nhc3RTaGFkb3dzICYmIHRoaXMubWFzayAhPT0gTUFTS19CQUtFICYmIHRoaXMubWFzayAhPT0gMDtcbiAgICB9XG5cbiAgICBzZXQgc2hhZG93UmVzb2x1dGlvbih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fc2hhZG93UmVzb2x1dGlvbiAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gTWF0aC5taW4odmFsdWUsIHRoaXMuZGV2aWNlLm1heEN1YmVNYXBTaXplKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBNYXRoLm1pbih2YWx1ZSwgdGhpcy5kZXZpY2UubWF4VGV4dHVyZVNpemUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVzb2x1dGlvbiA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd1Jlc29sdXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uO1xuICAgIH1cblxuICAgIHNldCB2c21CbHVyU2l6ZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdnNtQmx1clNpemUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh2YWx1ZSAlIDIgPT09IDApIHZhbHVlKys7IC8vIGRvbid0IGFsbG93IGV2ZW4gc2l6ZVxuICAgICAgICB0aGlzLl92c21CbHVyU2l6ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCB2c21CbHVyU2l6ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZzbUJsdXJTaXplO1xuICAgIH1cblxuICAgIHNldCBub3JtYWxPZmZzZXRCaWFzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9ub3JtYWxPZmZzZXRCaWFzID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAoKCF0aGlzLl9ub3JtYWxPZmZzZXRCaWFzICYmIHZhbHVlKSB8fCAodGhpcy5fbm9ybWFsT2Zmc2V0QmlhcyAmJiAhdmFsdWUpKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX25vcm1hbE9mZnNldEJpYXMgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgbm9ybWFsT2Zmc2V0QmlhcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX25vcm1hbE9mZnNldEJpYXM7XG4gICAgfVxuXG4gICAgc2V0IGZhbGxvZmZNb2RlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mYWxsb2ZmTW9kZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZmFsbG9mZk1vZGUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgZmFsbG9mZk1vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mYWxsb2ZmTW9kZTtcbiAgICB9XG5cbiAgICBzZXQgaW5uZXJDb25lQW5nbGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2lubmVyQ29uZUFuZ2xlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9pbm5lckNvbmVBbmdsZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9pbm5lckNvbmVBbmdsZUNvcyA9IE1hdGguY29zKHZhbHVlICogTWF0aC5QSSAvIDE4MCk7XG4gICAgICAgIGlmICh0aGlzLl91c2VQaHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaW5uZXJDb25lQW5nbGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbm5lckNvbmVBbmdsZTtcbiAgICB9XG5cbiAgICBzZXQgb3V0ZXJDb25lQW5nbGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX291dGVyQ29uZUFuZ2xlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9vdXRlckNvbmVBbmdsZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVPdXRlckFuZ2xlKHZhbHVlKTtcblxuICAgICAgICBpZiAodGhpcy5fdXNlUGh5c2ljYWxVbml0cykge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlRmluYWxDb2xvcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG91dGVyQ29uZUFuZ2xlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3V0ZXJDb25lQW5nbGU7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU91dGVyQW5nbGUoYW5nbGUpIHtcbiAgICAgICAgY29uc3QgcmFkQW5nbGUgPSBhbmdsZSAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3MocmFkQW5nbGUpO1xuICAgICAgICB0aGlzLl9vdXRlckNvbmVBbmdsZVNpbiA9IE1hdGguc2luKHJhZEFuZ2xlKTtcbiAgICB9XG5cbiAgICBzZXQgaW50ZW5zaXR5KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbnRlbnNpdHkgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9pbnRlbnNpdHkgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpbnRlbnNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnRlbnNpdHk7XG4gICAgfVxuXG4gICAgc2V0IGx1bWluYW5jZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbHVtaW5hbmNlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbHVtaW5hbmNlID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbHVtaW5hbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbHVtaW5hbmNlO1xuICAgIH1cblxuICAgIGdldCBjb29raWVNYXRyaXgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29va2llTWF0cml4KSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVNYXRyaXg7XG4gICAgfVxuXG4gICAgZ2V0IGF0bGFzVmlld3BvcnQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXRsYXNWaWV3cG9ydCkge1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNWaWV3cG9ydCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hdGxhc1ZpZXdwb3J0O1xuICAgIH1cblxuICAgIHNldCBjb29raWUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZTtcbiAgICB9XG5cbiAgICBzZXQgY29va2llRmFsbG9mZih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llRmFsbG9mZiA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llRmFsbG9mZiA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBjb29raWVGYWxsb2ZmKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llRmFsbG9mZjtcbiAgICB9XG5cbiAgICBzZXQgY29va2llQ2hhbm5lbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llQ2hhbm5lbCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNociA9IHZhbHVlLmNoYXJBdCh2YWx1ZS5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgIGNvbnN0IGFkZExlbiA9IDMgLSB2YWx1ZS5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFkZExlbjsgaSsrKVxuICAgICAgICAgICAgICAgIHZhbHVlICs9IGNocjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb29raWVDaGFubmVsID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZUNoYW5uZWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVDaGFubmVsO1xuICAgIH1cblxuICAgIHNldCBjb29raWVUcmFuc2Zvcm0odmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZVRyYW5zZm9ybSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVNldCA9ICEhdmFsdWU7XG4gICAgICAgIGlmICh2YWx1ZSAmJiAhdGhpcy5fY29va2llT2Zmc2V0KSB7XG4gICAgICAgICAgICB0aGlzLmNvb2tpZU9mZnNldCA9IG5ldyBWZWMyKCk7IC8vIHVzaW5nIHRyYW5zZm9ybSBmb3JjZXMgdXNpbmcgb2Zmc2V0IGNvZGVcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldFNldCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBzZXQgY29va2llT2Zmc2V0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVPZmZzZXQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHhmb3JtTmV3ID0gISEodGhpcy5fY29va2llVHJhbnNmb3JtU2V0IHx8IHZhbHVlKTtcbiAgICAgICAgaWYgKHhmb3JtTmV3ICYmICF2YWx1ZSAmJiB0aGlzLl9jb29raWVPZmZzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldC5zZXQoMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVPZmZzZXQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXRTZXQgPSAhIXZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgJiYgIXRoaXMuX2Nvb2tpZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgdGhpcy5jb29raWVUcmFuc2Zvcm0gPSBuZXcgVmVjNCgxLCAxLCAwLCAwKTsgLy8gdXNpbmcgb2Zmc2V0IGZvcmNlcyB1c2luZyBtYXRyaXggY29kZVxuICAgICAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtU2V0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llT2Zmc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llT2Zmc2V0O1xuICAgIH1cblxuICAgIC8vIHByZXBhcmVzIGxpZ2h0IGZvciB0aGUgZnJhbWUgcmVuZGVyaW5nXG4gICAgYmVnaW5GcmFtZSgpIHtcbiAgICAgICAgdGhpcy52aXNpYmxlVGhpc0ZyYW1lID0gdGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMICYmIHRoaXMuX2VuYWJsZWQ7XG4gICAgICAgIHRoaXMubWF4U2NyZWVuU2l6ZSA9IDA7XG4gICAgICAgIHRoaXMuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmF0bGFzU2xvdFVwZGF0ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBkZXN0cm95cyBzaGFkb3cgbWFwIHJlbGF0ZWQgcmVzb3VyY2VzLCBjYWxsZWQgd2hlbiBzaGFkb3cgcHJvcGVydGllcyBjaGFuZ2UgYW5kIHJlc291cmNlc1xuICAgIC8vIG5lZWQgdG8gYmUgcmVjcmVhdGVkXG4gICAgX2Rlc3Ryb3lTaGFkb3dNYXAoKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlckRhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckRhdGEubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dNYXApIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc2hhZG93TWFwLmNhY2hlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hcC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dNYXAgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIExpZ2h0UmVuZGVyRGF0YSB3aXRoIG1hdGNoaW5nIGNhbWVyYSBhbmQgZmFjZVxuICAgIGdldFJlbmRlckRhdGEoY2FtZXJhLCBmYWNlKSB7XG5cbiAgICAgICAgLy8gcmV0dXJucyBleGlzdGluZ1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3JlbmRlckRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9yZW5kZXJEYXRhW2ldO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnQuY2FtZXJhID09PSBjYW1lcmEgJiYgY3VycmVudC5mYWNlID09PSBmYWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgbmV3IG9uZVxuICAgICAgICBjb25zdCByZCA9IG5ldyBMaWdodFJlbmRlckRhdGEodGhpcy5kZXZpY2UsIGNhbWVyYSwgZmFjZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3JlbmRlckRhdGEucHVzaChyZCk7XG4gICAgICAgIHJldHVybiByZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEdXBsaWNhdGVzIGEgbGlnaHQgbm9kZSBidXQgZG9lcyBub3QgJ2RlZXAgY29weScgdGhlIGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtMaWdodH0gQSBjbG9uZWQgTGlnaHQuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IExpZ2h0KHRoaXMuZGV2aWNlKTtcblxuICAgICAgICAvLyBDbG9uZSBMaWdodCBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLnR5cGUgPSB0aGlzLl90eXBlO1xuICAgICAgICBjbG9uZS5zZXRDb2xvcih0aGlzLl9jb2xvcik7XG4gICAgICAgIGNsb25lLmludGVuc2l0eSA9IHRoaXMuX2ludGVuc2l0eTtcbiAgICAgICAgY2xvbmUubHVtaW5hbmNlID0gdGhpcy5fbHVtaW5hbmNlO1xuICAgICAgICBjbG9uZS5jYXN0U2hhZG93cyA9IHRoaXMuY2FzdFNoYWRvd3M7XG4gICAgICAgIGNsb25lLl9lbmFibGVkID0gdGhpcy5fZW5hYmxlZDtcblxuICAgICAgICAvLyBPbW5pIGFuZCBzcG90IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuYXR0ZW51YXRpb25TdGFydCA9IHRoaXMuYXR0ZW51YXRpb25TdGFydDtcbiAgICAgICAgY2xvbmUuYXR0ZW51YXRpb25FbmQgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICBjbG9uZS5mYWxsb2ZmTW9kZSA9IHRoaXMuX2ZhbGxvZmZNb2RlO1xuICAgICAgICBjbG9uZS5zaGFkb3dUeXBlID0gdGhpcy5fc2hhZG93VHlwZTtcbiAgICAgICAgY2xvbmUudnNtQmx1clNpemUgPSB0aGlzLl92c21CbHVyU2l6ZTtcbiAgICAgICAgY2xvbmUudnNtQmx1ck1vZGUgPSB0aGlzLnZzbUJsdXJNb2RlO1xuICAgICAgICBjbG9uZS52c21CaWFzID0gdGhpcy52c21CaWFzO1xuICAgICAgICBjbG9uZS5zaGFkb3dVcGRhdGVNb2RlID0gdGhpcy5zaGFkb3dVcGRhdGVNb2RlO1xuICAgICAgICBjbG9uZS5tYXNrID0gdGhpcy5tYXNrO1xuXG4gICAgICAgIC8vIFNwb3QgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5pbm5lckNvbmVBbmdsZSA9IHRoaXMuX2lubmVyQ29uZUFuZ2xlO1xuICAgICAgICBjbG9uZS5vdXRlckNvbmVBbmdsZSA9IHRoaXMuX291dGVyQ29uZUFuZ2xlO1xuXG4gICAgICAgIC8vIERpcmVjdGlvbmFsIHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUubnVtQ2FzY2FkZXMgPSB0aGlzLm51bUNhc2NhZGVzO1xuICAgICAgICBjbG9uZS5jYXNjYWRlRGlzdHJpYnV0aW9uID0gdGhpcy5jYXNjYWRlRGlzdHJpYnV0aW9uO1xuXG4gICAgICAgIC8vIHNoYXBlIHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuc2hhcGUgPSB0aGlzLl9zaGFwZTtcblxuICAgICAgICAvLyBTaGFkb3cgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5zaGFkb3dCaWFzID0gdGhpcy5zaGFkb3dCaWFzO1xuICAgICAgICBjbG9uZS5ub3JtYWxPZmZzZXRCaWFzID0gdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICAgICAgY2xvbmUuc2hhZG93UmVzb2x1dGlvbiA9IHRoaXMuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgIGNsb25lLnNoYWRvd0Rpc3RhbmNlID0gdGhpcy5zaGFkb3dEaXN0YW5jZTtcbiAgICAgICAgY2xvbmUuc2hhZG93SW50ZW5zaXR5ID0gdGhpcy5zaGFkb3dJbnRlbnNpdHk7XG5cbiAgICAgICAgLy8gQ29va2llcyBwcm9wZXJ0aWVzXG4gICAgICAgIC8vIGNsb25lLmNvb2tpZSA9IHRoaXMuX2Nvb2tpZTtcbiAgICAgICAgLy8gY2xvbmUuY29va2llSW50ZW5zaXR5ID0gdGhpcy5jb29raWVJbnRlbnNpdHk7XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZUZhbGxvZmYgPSB0aGlzLl9jb29raWVGYWxsb2ZmO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVDaGFubmVsID0gdGhpcy5fY29va2llQ2hhbm5lbDtcbiAgICAgICAgLy8gY2xvbmUuY29va2llVHJhbnNmb3JtID0gdGhpcy5fY29va2llVHJhbnNmb3JtO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVPZmZzZXQgPSB0aGlzLl9jb29raWVPZmZzZXQ7XG5cbiAgICAgICAgcmV0dXJuIGNsb25lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBjb252ZXJzaW9uIGZhY3RvciBmb3IgbHVtaW5hbmNlIC0+IGxpZ2h0IHNwZWNpZmljIGxpZ2h0IHVuaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdHlwZSAtIFRoZSB0eXBlIG9mIGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3V0ZXJBbmdsZV0gLSBUaGUgb3V0ZXIgYW5nbGUgb2YgYSBzcG90IGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaW5uZXJBbmdsZV0gLSBUaGUgaW5uZXIgYW5nbGUgb2YgYSBzcG90IGxpZ2h0LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBzY2FsaW5nIGZhY3RvciB0byBtdWx0aXBseSB3aXRoIHRoZSBsdW1pbmFuY2UgdmFsdWUuXG4gICAgICovXG4gICAgc3RhdGljIGdldExpZ2h0VW5pdENvbnZlcnNpb24odHlwZSwgb3V0ZXJBbmdsZSA9IE1hdGguUEkgLyA0LCBpbm5lckFuZ2xlID0gMCkge1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgTElHSFRUWVBFX1NQT1Q6IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWxsb2ZmRW5kID0gTWF0aC5jb3Mob3V0ZXJBbmdsZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgZmFsbG9mZlN0YXJ0ID0gTWF0aC5jb3MoaW5uZXJBbmdsZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbW1wL3BicnQtdjQvYmxvYi9mYWFjMzRkMWEwZWJkMjQ5Mjg4MjhmZTlmYTY1YjY1ZjdlZmM1OTM3L3NyYy9wYnJ0L2xpZ2h0cy5jcHAjTDE0NjNcbiAgICAgICAgICAgICAgICByZXR1cm4gKDIgKiBNYXRoLlBJICogKCgxIC0gZmFsbG9mZlN0YXJ0KSArIChmYWxsb2ZmU3RhcnQgLSBmYWxsb2ZmRW5kKSAvIDIuMCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfT01OSTpcbiAgICAgICAgICAgICAgICAvLyBodHRwczovL2dvb2dsZS5naXRodWIuaW8vZmlsYW1lbnQvRmlsYW1lbnQubWQuaHRtbCNsaWdodGluZy9kaXJlY3RsaWdodGluZy9wdW5jdHVhbGxpZ2h0cy9wb2ludGxpZ2h0c1xuICAgICAgICAgICAgICAgIHJldHVybiAoNCAqIE1hdGguUEkpO1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfRElSRUNUSU9OQUw6XG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9nb29nbGUuZ2l0aHViLmlvL2ZpbGFtZW50L0ZpbGFtZW50Lm1kLmh0bWwjbGlnaHRpbmcvZGlyZWN0bGlnaHRpbmcvZGlyZWN0aW9uYWxsaWdodHNcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJldHVybnMgdGhlIGJpYXMgKC54KSBhbmQgbm9ybWFsQmlhcyAoLnkpIHZhbHVlIGZvciBsaWdodHMgYXMgcGFzc2VkIHRvIHNoYWRlcnMgYnkgdW5pZm9ybXNcbiAgICAvLyBOb3RlOiB0aGlzIG5lZWRzIHRvIGJlIHJldmlzaXRlZCBhbmQgc2ltcGxpZmllZFxuICAgIC8vIE5vdGU6IHZzbUJpYXMgaXMgbm90IHVzZWQgYXQgYWxsIGZvciBvbW5pIGxpZ2h0LCBldmVuIHRob3VnaCBpdCBpcyBlZGl0YWJsZSBpbiB0aGUgRWRpdG9yXG4gICAgX2dldFVuaWZvcm1CaWFzVmFsdWVzKGxpZ2h0UmVuZGVyRGF0YSkge1xuXG4gICAgICAgIGNvbnN0IGZhckNsaXAgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhLl9mYXJDbGlwO1xuXG4gICAgICAgIHN3aXRjaCAodGhpcy5fdHlwZSkge1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfT01OSTpcbiAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9IHRoaXMuc2hhZG93QmlhcztcbiAgICAgICAgICAgICAgICB0bXBCaWFzZXMubm9ybWFsQmlhcyA9IHRoaXMuX25vcm1hbE9mZnNldEJpYXM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9TUE9UOlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pc1ZzbSkge1xuICAgICAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9IC0wLjAwMDAxICogMjA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdG1wQmlhc2VzLmJpYXMgPSB0aGlzLnNoYWRvd0JpYXMgKiAyMDsgLy8gYXBwcm94IHJlbWFwIGZyb20gb2xkIGJpYXMgdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZXZpY2Uud2ViZ2wyICYmIHRoaXMuZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHRtcEJpYXNlcy5iaWFzICo9IC0xMDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5ub3JtYWxCaWFzID0gdGhpcy5faXNWc20gPyB0aGlzLnZzbUJpYXMgLyAodGhpcy5hdHRlbnVhdGlvbkVuZCAvIDcuMCkgOiB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfRElSRUNUSU9OQUw6XG4gICAgICAgICAgICAgICAgLy8gbWFrZSBiaWFzIGRlcGVuZGVudCBvbiBmYXIgcGxhbmUgYmVjYXVzZSBpdCdzIG5vdCBjb25zdGFudCBmb3IgZGlyZWN0IGxpZ2h0XG4gICAgICAgICAgICAgICAgLy8gY2xpcCBkaXN0YW5jZSB1c2VkIGlzIGJhc2VkIG9uIHRoZSBuZWFyZXN0IHNoYWRvdyBjYXNjYWRlXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzVnNtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gLTAuMDAwMDEgKiAyMDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9ICh0aGlzLnNoYWRvd0JpYXMgLyBmYXJDbGlwKSAqIDEwMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRldmljZS53ZWJnbDIgJiYgdGhpcy5kZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykgdG1wQmlhc2VzLmJpYXMgKj0gLTEwMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdG1wQmlhc2VzLm5vcm1hbEJpYXMgPSB0aGlzLl9pc1ZzbSA/IHRoaXMudnNtQmlhcyAvIChmYXJDbGlwIC8gNy4wKSA6IHRoaXMuX25vcm1hbE9mZnNldEJpYXM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdG1wQmlhc2VzO1xuICAgIH1cblxuICAgIGdldENvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgZ2V0Qm91bmRpbmdTcGhlcmUoc3BoZXJlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuXG4gICAgICAgICAgICAvLyBiYXNlZCBvbiBodHRwczovL2JhcnR3cm9uc2tpLmNvbS8yMDE3LzA0LzEzL2N1bGwtdGhhdC1jb25lL1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IHRoaXMuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICBjb25zdCBhbmdsZSA9IHRoaXMuX291dGVyQ29uZUFuZ2xlO1xuICAgICAgICAgICAgY29uc3QgY29zQW5nbGUgPSB0aGlzLl9vdXRlckNvbmVBbmdsZUNvcztcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLl9ub2RlO1xuICAgICAgICAgICAgdG1wVmVjLmNvcHkobm9kZS51cCk7XG5cbiAgICAgICAgICAgIGlmIChhbmdsZSA+IDQ1KSB7XG4gICAgICAgICAgICAgICAgc3BoZXJlLnJhZGl1cyA9IHNpemUgKiB0aGlzLl9vdXRlckNvbmVBbmdsZVNpbjtcbiAgICAgICAgICAgICAgICB0bXBWZWMubXVsU2NhbGFyKC1zaXplICogY29zQW5nbGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzcGhlcmUucmFkaXVzID0gc2l6ZSAvICgyICogY29zQW5nbGUpO1xuICAgICAgICAgICAgICAgIHRtcFZlYy5tdWxTY2FsYXIoLXNwaGVyZS5yYWRpdXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzcGhlcmUuY2VudGVyLmFkZDIobm9kZS5nZXRQb3NpdGlvbigpLCB0bXBWZWMpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgIHNwaGVyZS5jZW50ZXIgPSB0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICBzcGhlcmUucmFkaXVzID0gdGhpcy5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldEJvdW5kaW5nQm94KGJveCkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgIGNvbnN0IHJhbmdlID0gdGhpcy5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgICAgIGNvbnN0IGFuZ2xlID0gdGhpcy5fb3V0ZXJDb25lQW5nbGU7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gdGhpcy5fbm9kZTtcblxuICAgICAgICAgICAgY29uc3Qgc2NsID0gTWF0aC5hYnMoTWF0aC5zaW4oYW5nbGUgKiBtYXRoLkRFR19UT19SQUQpICogcmFuZ2UpO1xuXG4gICAgICAgICAgICBib3guY2VudGVyLnNldCgwLCAtcmFuZ2UgKiAwLjUsIDApO1xuICAgICAgICAgICAgYm94LmhhbGZFeHRlbnRzLnNldChzY2wsIHJhbmdlICogMC41LCBzY2wpO1xuXG4gICAgICAgICAgICBib3guc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihib3gsIG5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSwgdHJ1ZSk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgYm94LmNlbnRlci5jb3B5KHRoaXMuX25vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICBib3guaGFsZkV4dGVudHMuc2V0KHRoaXMuYXR0ZW51YXRpb25FbmQsIHRoaXMuYXR0ZW51YXRpb25FbmQsIHRoaXMuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZUZpbmFsQ29sb3IoKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gdGhpcy5fY29sb3I7XG4gICAgICAgIGNvbnN0IHIgPSBjb2xvci5yO1xuICAgICAgICBjb25zdCBnID0gY29sb3IuZztcbiAgICAgICAgY29uc3QgYiA9IGNvbG9yLmI7XG5cbiAgICAgICAgbGV0IGkgPSB0aGlzLl9pbnRlbnNpdHk7XG5cbiAgICAgICAgLy8gVG8gY2FsY3VsYXRlIHRoZSBsdXgsIHdoaWNoIGlzIGxtL21eMiwgd2UgbmVlZCB0byBjb252ZXJ0IGZyb20gbHVtaW5vdXMgcG93ZXJcbiAgICAgICAgaWYgKHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIGkgPSB0aGlzLl9sdW1pbmFuY2UgLyBMaWdodC5nZXRMaWdodFVuaXRDb252ZXJzaW9uKHRoaXMuX3R5cGUsIHRoaXMuX291dGVyQ29uZUFuZ2xlICogbWF0aC5ERUdfVE9fUkFELCB0aGlzLl9pbm5lckNvbmVBbmdsZSAqIG1hdGguREVHX1RPX1JBRCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmaW5hbENvbG9yID0gdGhpcy5fZmluYWxDb2xvcjtcbiAgICAgICAgY29uc3QgbGluZWFyRmluYWxDb2xvciA9IHRoaXMuX2xpbmVhckZpbmFsQ29sb3I7XG5cbiAgICAgICAgZmluYWxDb2xvclswXSA9IHIgKiBpO1xuICAgICAgICBmaW5hbENvbG9yWzFdID0gZyAqIGk7XG4gICAgICAgIGZpbmFsQ29sb3JbMl0gPSBiICogaTtcbiAgICAgICAgaWYgKGkgPj0gMSkge1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclswXSA9IE1hdGgucG93KHIsIDIuMikgKiBpO1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclsxXSA9IE1hdGgucG93KGcsIDIuMikgKiBpO1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclsyXSA9IE1hdGgucG93KGIsIDIuMikgKiBpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclswXSA9IE1hdGgucG93KGZpbmFsQ29sb3JbMF0sIDIuMik7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzFdID0gTWF0aC5wb3coZmluYWxDb2xvclsxXSwgMi4yKTtcbiAgICAgICAgICAgIGxpbmVhckZpbmFsQ29sb3JbMl0gPSBNYXRoLnBvdyhmaW5hbENvbG9yWzJdLCAyLjIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0Q29sb3IoKSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5zZXQoYXJndW1lbnRzWzBdLnIsIGFyZ3VtZW50c1swXS5nLCBhcmd1bWVudHNbMF0uYik7XG4gICAgICAgIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAgdGhpcy5fY29sb3Iuc2V0KGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlRmluYWxDb2xvcigpO1xuICAgIH1cblxuICAgIHVwZGF0ZVNoYWRvdygpIHtcbiAgICAgICAgaWYgKHRoaXMuc2hhZG93VXBkYXRlTW9kZSAhPT0gU0hBRE9XVVBEQVRFX1JFQUxUSU1FKSB7XG4gICAgICAgICAgICB0aGlzLnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfVEhJU0ZSQU1FO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGF5ZXJzRGlydHkoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zY2VuZT8ubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLl9zY2VuZS5sYXllcnMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUtleSgpIHtcbiAgICAgICAgLy8gS2V5IGRlZmluaXRpb246XG4gICAgICAgIC8vIEJpdFxuICAgICAgICAvLyAzMSAgICAgIDogc2lnbiBiaXQgKGxlYXZlKVxuICAgICAgICAvLyAyOSAtIDMwIDogdHlwZVxuICAgICAgICAvLyAyOCAgICAgIDogY2FzdCBzaGFkb3dzXG4gICAgICAgIC8vIDI1IC0gMjcgOiBzaGFkb3cgdHlwZVxuICAgICAgICAvLyAyMyAtIDI0IDogZmFsbG9mZiBtb2RlXG4gICAgICAgIC8vIDIyICAgICAgOiBub3JtYWwgb2Zmc2V0IGJpYXNcbiAgICAgICAgLy8gMjEgICAgICA6IGNvb2tpZVxuICAgICAgICAvLyAyMCAgICAgIDogY29va2llIGZhbGxvZmZcbiAgICAgICAgLy8gMTggLSAxOSA6IGNvb2tpZSBjaGFubmVsIFJcbiAgICAgICAgLy8gMTYgLSAxNyA6IGNvb2tpZSBjaGFubmVsIEdcbiAgICAgICAgLy8gMTQgLSAxNSA6IGNvb2tpZSBjaGFubmVsIEJcbiAgICAgICAgLy8gMTIgICAgICA6IGNvb2tpZSB0cmFuc2Zvcm1cbiAgICAgICAgLy8gMTAgLSAxMSA6IGxpZ2h0IHNvdXJjZSBzaGFwZVxuICAgICAgICAvLyAgOCAtICA5IDogbGlnaHQgbnVtIGNhc2NhZGVzXG4gICAgICAgIGxldCBrZXkgPVxuICAgICAgICAgICAgICAgKHRoaXMuX3R5cGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDI5KSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX2Nhc3RTaGFkb3dzID8gMSA6IDApICAgICAgICAgICAgICAgPDwgMjgpIHxcbiAgICAgICAgICAgICAgICh0aGlzLl9zaGFkb3dUeXBlICAgICAgICAgICAgICAgICAgICAgICAgICA8PCAyNSkgfFxuICAgICAgICAgICAgICAgKHRoaXMuX2ZhbGxvZmZNb2RlICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDIzKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX25vcm1hbE9mZnNldEJpYXMgIT09IDAuMCA/IDEgOiAwKSAgPDwgMjIpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY29va2llID8gMSA6IDApICAgICAgICAgICAgICAgICAgICA8PCAyMSkgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9jb29raWVGYWxsb2ZmID8gMSA6IDApICAgICAgICAgICAgIDw8IDIwKSB8XG4gICAgICAgICAgICAgICAoY2hhbklkW3RoaXMuX2Nvb2tpZUNoYW5uZWwuY2hhckF0KDApXSAgICAgPDwgMTgpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY29va2llVHJhbnNmb3JtID8gMSA6IDApICAgICAgICAgICA8PCAxMikgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9zaGFwZSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDEwKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMubnVtQ2FzY2FkZXMgLSAxKSAgICAgICAgICAgICAgICAgICAgPDwgIDgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9jb29raWVDaGFubmVsLmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAga2V5IHw9IChjaGFuSWRbdGhpcy5fY29va2llQ2hhbm5lbC5jaGFyQXQoMSldIDw8IDE2KTtcbiAgICAgICAgICAgIGtleSB8PSAoY2hhbklkW3RoaXMuX2Nvb2tpZUNoYW5uZWwuY2hhckF0KDIpXSA8PCAxNCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5ICE9PSB0aGlzLmtleSAmJiB0aGlzLl9zY2VuZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gVE9ETzogbW9zdCBvZiB0aGUgY2hhbmdlcyB0byB0aGUga2V5IHNob3VsZCBub3QgaW52YWxpZGF0ZSB0aGUgY29tcG9zaXRpb24sXG4gICAgICAgICAgICAvLyBwcm9iYWJseSBvbmx5IF90eXBlIGFuZCBfY2FzdFNoYWRvd3NcbiAgICAgICAgICAgIHRoaXMubGF5ZXJzRGlydHkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHQsIGxpZ2h0VHlwZXMgfTtcbiJdLCJuYW1lcyI6WyJ0bXBWZWMiLCJWZWMzIiwidG1wQmlhc2VzIiwiYmlhcyIsIm5vcm1hbEJpYXMiLCJjaGFuSWQiLCJyIiwiZyIsImIiLCJhIiwibGlnaHRUeXBlcyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIkxJR0hUVFlQRV9PTU5JIiwiTElHSFRUWVBFX1NQT1QiLCJkaXJlY3Rpb25hbENhc2NhZGVzIiwiVmVjNCIsImlkIiwiTGlnaHRSZW5kZXJEYXRhIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJjYW1lcmEiLCJmYWNlIiwibGlnaHQiLCJzaGFkb3dDYW1lcmEiLCJTaGFkb3dSZW5kZXJlciIsImNyZWF0ZVNoYWRvd0NhbWVyYSIsIl9zaGFkb3dUeXBlIiwiX3R5cGUiLCJzaGFkb3dNYXRyaXgiLCJNYXQ0Iiwic2hhZG93Vmlld3BvcnQiLCJzaGFkb3dTY2lzc29yIiwidmlzaWJsZUNhc3RlcnMiLCJzaGFkb3dCdWZmZXIiLCJydCIsInJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiX2lzUGNmIiwid2ViZ2wyIiwiZGVwdGhCdWZmZXIiLCJMaWdodCIsImdyYXBoaWNzRGV2aWNlIiwiX2NvbG9yIiwiQ29sb3IiLCJfaW50ZW5zaXR5IiwiX2x1bWluYW5jZSIsIl9jYXN0U2hhZG93cyIsIl9lbmFibGVkIiwibWFzayIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJpc1N0YXRpYyIsImtleSIsImJha2VEaXIiLCJiYWtlTnVtU2FtcGxlcyIsImJha2VBcmVhIiwiYXR0ZW51YXRpb25TdGFydCIsImF0dGVudWF0aW9uRW5kIiwiX2ZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0xJTkVBUiIsIlNIQURPV19QQ0YzIiwiX3ZzbUJsdXJTaXplIiwidnNtQmx1ck1vZGUiLCJCTFVSX0dBVVNTSUFOIiwidnNtQmlhcyIsIl9jb29raWUiLCJjb29raWVJbnRlbnNpdHkiLCJfY29va2llRmFsbG9mZiIsIl9jb29raWVDaGFubmVsIiwiX2Nvb2tpZVRyYW5zZm9ybSIsIl9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtIiwiRmxvYXQzMkFycmF5IiwiX2Nvb2tpZU9mZnNldCIsIl9jb29raWVPZmZzZXRVbmlmb3JtIiwiX2Nvb2tpZVRyYW5zZm9ybVNldCIsIl9jb29raWVPZmZzZXRTZXQiLCJfaW5uZXJDb25lQW5nbGUiLCJfb3V0ZXJDb25lQW5nbGUiLCJjYXNjYWRlcyIsIl9zaGFkb3dNYXRyaXhQYWxldHRlIiwiX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMiLCJudW1DYXNjYWRlcyIsImNhc2NhZGVEaXN0cmlidXRpb24iLCJfc2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiX2ZpbmFsQ29sb3IiLCJjIiwiTWF0aCIsInBvdyIsIl9saW5lYXJGaW5hbENvbG9yIiwiX3Bvc2l0aW9uIiwiX2RpcmVjdGlvbiIsIl9pbm5lckNvbmVBbmdsZUNvcyIsImNvcyIsIlBJIiwiX3VwZGF0ZU91dGVyQW5nbGUiLCJfdXNlUGh5c2ljYWxVbml0cyIsInVuZGVmaW5lZCIsIl9zaGFkb3dNYXAiLCJfc2hhZG93UmVuZGVyUGFyYW1zIiwic2hhZG93RGlzdGFuY2UiLCJfc2hhZG93UmVzb2x1dGlvbiIsInNoYWRvd0JpYXMiLCJzaGFkb3dJbnRlbnNpdHkiLCJfbm9ybWFsT2Zmc2V0QmlhcyIsInNoYWRvd1VwZGF0ZU1vZGUiLCJTSEFET1dVUERBVEVfUkVBTFRJTUUiLCJfaXNWc20iLCJfY29va2llTWF0cml4IiwiX2F0bGFzVmlld3BvcnQiLCJhdGxhc1ZpZXdwb3J0QWxsb2NhdGVkIiwiYXRsYXNWZXJzaW9uIiwiYXRsYXNTbG90SW5kZXgiLCJhdGxhc1Nsb3RVcGRhdGVkIiwiX3NjZW5lIiwiX25vZGUiLCJfcmVuZGVyRGF0YSIsInZpc2libGVUaGlzRnJhbWUiLCJtYXhTY3JlZW5TaXplIiwiZGVzdHJveSIsIl9kZXN0cm95U2hhZG93TWFwIiwidmFsdWUiLCJ1cGRhdGVLZXkiLCJsZW5ndGgiLCJzaGFkb3dNYXAiLCJudW1TaGFkb3dGYWNlcyIsInR5cGUiLCJzdHlwZSIsInNoYWRvd1R5cGUiLCJzaGFwZSIsInVzZVBoeXNpY2FsVW5pdHMiLCJfdXBkYXRlRmluYWxDb2xvciIsIlNIQURPV19QQ0Y1IiwiU0hBRE9XX1ZTTTMyIiwidGV4dHVyZUZsb2F0UmVuZGVyYWJsZSIsIlNIQURPV19WU00xNiIsInRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlIiwiU0hBRE9XX1ZTTTgiLCJlbmFibGVkIiwibGF5ZXJzRGlydHkiLCJjYXN0U2hhZG93cyIsIk1BU0tfQkFLRSIsInNoYWRvd1Jlc29sdXRpb24iLCJtaW4iLCJtYXhDdWJlTWFwU2l6ZSIsIm1heFRleHR1cmVTaXplIiwidnNtQmx1clNpemUiLCJub3JtYWxPZmZzZXRCaWFzIiwiZmFsbG9mZk1vZGUiLCJpbm5lckNvbmVBbmdsZSIsIm91dGVyQ29uZUFuZ2xlIiwiYW5nbGUiLCJyYWRBbmdsZSIsIl9vdXRlckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZVNpbiIsInNpbiIsImludGVuc2l0eSIsImx1bWluYW5jZSIsImNvb2tpZU1hdHJpeCIsImF0bGFzVmlld3BvcnQiLCJjb29raWUiLCJjb29raWVGYWxsb2ZmIiwiY29va2llQ2hhbm5lbCIsImNociIsImNoYXJBdCIsImFkZExlbiIsImkiLCJjb29raWVUcmFuc2Zvcm0iLCJjb29raWVPZmZzZXQiLCJWZWMyIiwieGZvcm1OZXciLCJzZXQiLCJiZWdpbkZyYW1lIiwiY2FjaGVkIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwiZ2V0UmVuZGVyRGF0YSIsImN1cnJlbnQiLCJyZCIsInB1c2giLCJjbG9uZSIsInNldENvbG9yIiwiZ2V0TGlnaHRVbml0Q29udmVyc2lvbiIsIm91dGVyQW5nbGUiLCJpbm5lckFuZ2xlIiwiZmFsbG9mZkVuZCIsImZhbGxvZmZTdGFydCIsIl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyIsImxpZ2h0UmVuZGVyRGF0YSIsImZhckNsaXAiLCJfZmFyQ2xpcCIsImV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMiLCJnZXRDb2xvciIsImdldEJvdW5kaW5nU3BoZXJlIiwic3BoZXJlIiwic2l6ZSIsImNvc0FuZ2xlIiwibm9kZSIsImNvcHkiLCJ1cCIsInJhZGl1cyIsIm11bFNjYWxhciIsImNlbnRlciIsImFkZDIiLCJnZXRQb3NpdGlvbiIsImdldEJvdW5kaW5nQm94IiwiYm94IiwicmFuZ2UiLCJzY2wiLCJhYnMiLCJtYXRoIiwiREVHX1RPX1JBRCIsImhhbGZFeHRlbnRzIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsImdldFdvcmxkVHJhbnNmb3JtIiwiY29sb3IiLCJmaW5hbENvbG9yIiwibGluZWFyRmluYWxDb2xvciIsImFyZ3VtZW50cyIsInVwZGF0ZVNoYWRvdyIsImxheWVycyIsIl9kaXJ0eUxpZ2h0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFpQkEsTUFBTUEsTUFBTSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3pCLE1BQU1DLFNBQVMsR0FBRztBQUNkQyxFQUFBQSxJQUFJLEVBQUUsQ0FBQztBQUNQQyxFQUFBQSxVQUFVLEVBQUUsQ0FBQTtBQUNoQixDQUFDLENBQUE7QUFFRCxNQUFNQyxNQUFN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
