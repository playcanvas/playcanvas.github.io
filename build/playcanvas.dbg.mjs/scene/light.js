/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { math } from '../core/math/math.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { DEVICETYPE_WEBGPU } from '../platform/graphics/constants.js';
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
    this.shadowUpdateOverrides = null;
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
    this.shadowUpdateOverrides = null;
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

    const supportsPCF5 = device.webgl2 || device.deviceType === DEVICETYPE_WEBGPU;
    if (value === SHADOW_PCF5 && !supportsPCF5) {
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
    if (this.shadowUpdateOverrides) {
      for (let i = 0; i < this.shadowUpdateOverrides.length; i++) {
        if (this.shadowUpdateOverrides[i] === SHADOWUPDATE_NONE) {
          this.shadowUpdateOverrides[i] = SHADOWUPDATE_THISFRAME;
        }
      }
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
    if (this.shadowUpdateOverrides) {
      clone.shadowUpdateOverrides = this.shadowUpdateOverrides.slice();
    }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9saWdodC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHsgREVWSUNFVFlQRV9XRUJHUFUgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQge1xuICAgIEJMVVJfR0FVU1NJQU4sXG4gICAgTElHSFRUWVBFX0RJUkVDVElPTkFMLCBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsXG4gICAgTUFTS19CQUtFLCBNQVNLX0FGRkVDVF9EWU5BTUlDLFxuICAgIFNIQURPV19QQ0YzLCBTSEFET1dfUENGNSwgU0hBRE9XX1ZTTTgsIFNIQURPV19WU00xNiwgU0hBRE9XX1ZTTTMyLFxuICAgIFNIQURPV1VQREFURV9OT05FLCBTSEFET1dVUERBVEVfUkVBTFRJTUUsIFNIQURPV1VQREFURV9USElTRlJBTUUsXG4gICAgTElHSFRTSEFQRV9QVU5DVFVBTCwgTElHSFRGQUxMT0ZGX0xJTkVBUlxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTaGFkb3dSZW5kZXJlciB9IGZyb20gJy4vcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzJztcblxuY29uc3QgdG1wVmVjID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRtcEJpYXNlcyA9IHtcbiAgICBiaWFzOiAwLFxuICAgIG5vcm1hbEJpYXM6IDBcbn07XG5cbmNvbnN0IGNoYW5JZCA9IHsgcjogMCwgZzogMSwgYjogMiwgYTogMyB9O1xuXG5jb25zdCBsaWdodFR5cGVzID0ge1xuICAgICdkaXJlY3Rpb25hbCc6IExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICAnb21uaSc6IExJR0hUVFlQRV9PTU5JLFxuICAgICdwb2ludCc6IExJR0hUVFlQRV9PTU5JLFxuICAgICdzcG90JzogTElHSFRUWVBFX1NQT1Rcbn07XG5cbi8vIHZpZXdwb3J0IGluIHNoYWRvd3MgbWFwIGZvciBjYXNjYWRlcyBmb3IgZGlyZWN0aW9uYWwgbGlnaHRcbmNvbnN0IGRpcmVjdGlvbmFsQ2FzY2FkZXMgPSBbXG4gICAgW25ldyBWZWM0KDAsIDAsIDEsIDEpXSxcbiAgICBbbmV3IFZlYzQoMCwgMCwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLCAwLjUsIDAuNSwgMC41KV0sXG4gICAgW25ldyBWZWM0KDAsIDAsIDAuNSwgMC41KSwgbmV3IFZlYzQoMCwgMC41LCAwLjUsIDAuNSksIG5ldyBWZWM0KDAuNSwgMCwgMC41LCAwLjUpXSxcbiAgICBbbmV3IFZlYzQoMCwgMCwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLCAwLjUsIDAuNSwgMC41KSwgbmV3IFZlYzQoMC41LCAwLCAwLjUsIDAuNSksIG5ldyBWZWM0KDAuNSwgMC41LCAwLjUsIDAuNSldXG5dO1xuXG5sZXQgaWQgPSAwO1xuXG4vLyBDbGFzcyBzdG9yaW5nIHNoYWRvdyByZW5kZXJpbmcgcmVsYXRlZCBwcml2YXRlIGluZm9ybWF0aW9uXG5jbGFzcyBMaWdodFJlbmRlckRhdGEge1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgY2FtZXJhLCBmYWNlLCBsaWdodCkge1xuXG4gICAgICAgIC8vIGxpZ2h0IHRoaXMgZGF0YSBiZWxvbmdzIHRvXG4gICAgICAgIHRoaXMubGlnaHQgPSBsaWdodDtcblxuICAgICAgICAvLyBjYW1lcmEgdGhpcyBhcHBsaWVzIHRvLiBPbmx5IHVzZWQgYnkgZGlyZWN0aW9uYWwgbGlnaHQsIGFzIGRpcmVjdGlvbmFsIHNoYWRvdyBtYXBcbiAgICAgICAgLy8gaXMgY3VsbGVkIGFuZCByZW5kZXJlZCBmb3IgZWFjaCBjYW1lcmEuIExvY2FsIGxpZ2h0cycgc2hhZG93IGlzIGN1bGxlZCBhbmQgcmVuZGVyZWQgb25lIHRpbWVcbiAgICAgICAgLy8gYW5kIHNoYXJlZCBiZXR3ZWVuIGNhbWVyYXMgKGV2ZW4gdGhvdWdoIGl0J3Mgbm90IHN0cmljdGx5IGNvcnJlY3QgYW5kIHdlIGNhbiBnZXQgc2hhZG93c1xuICAgICAgICAvLyBmcm9tIGEgbWVzaCB0aGF0IGlzIG5vdCB2aXNpYmxlIGJ5IHRoZSBjYW1lcmEpXG4gICAgICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xuXG4gICAgICAgIC8vIGNhbWVyYSB1c2VkIHRvIGN1bGwgLyByZW5kZXIgdGhlIHNoYWRvdyBtYXBcbiAgICAgICAgdGhpcy5zaGFkb3dDYW1lcmEgPSBTaGFkb3dSZW5kZXJlci5jcmVhdGVTaGFkb3dDYW1lcmEoZGV2aWNlLCBsaWdodC5fc2hhZG93VHlwZSwgbGlnaHQuX3R5cGUsIGZhY2UpO1xuXG4gICAgICAgIC8vIHNoYWRvdyB2aWV3LXByb2plY3Rpb24gbWF0cml4XG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4ID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvLyB2aWV3cG9ydCBmb3IgdGhlIHNoYWRvdyByZW5kZXJpbmcgdG8gdGhlIHRleHR1cmUgKHgsIHksIHdpZHRoLCBoZWlnaHQpXG4gICAgICAgIHRoaXMuc2hhZG93Vmlld3BvcnQgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTtcblxuICAgICAgICAvLyBzY2lzc29yIHJlY3RhbmdsZSBmb3IgdGhlIHNoYWRvdyByZW5kZXJpbmcgdG8gdGhlIHRleHR1cmUgKHgsIHksIHdpZHRoLCBoZWlnaHQpXG4gICAgICAgIHRoaXMuc2hhZG93U2Npc3NvciA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuXG4gICAgICAgIC8vIGZhY2UgaW5kZXgsIHZhbHVlIGlzIGJhc2VkIG9uIGxpZ2h0IHR5cGU6XG4gICAgICAgIC8vIC0gc3BvdDogYWx3YXlzIDBcbiAgICAgICAgLy8gLSBvbW5pOiBjdWJlbWFwIGZhY2UsIDAuLjVcbiAgICAgICAgLy8gLSBkaXJlY3Rpb25hbDogMCBmb3Igc2ltcGxlIHNoYWRvd3MsIGNhc2NhZGUgaW5kZXggZm9yIGNhc2NhZGVkIHNoYWRvdyBtYXBcbiAgICAgICAgdGhpcy5mYWNlID0gZmFjZTtcblxuICAgICAgICAvLyB2aXNpYmxlIHNoYWRvdyBjYXN0ZXJzXG4gICAgICAgIHRoaXMudmlzaWJsZUNhc3RlcnMgPSBbXTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIHNoYWRvdyBidWZmZXIgY3VycmVudGx5IGF0dGFjaGVkIHRvIHRoZSBzaGFkb3cgY2FtZXJhXG4gICAgZ2V0IHNoYWRvd0J1ZmZlcigpIHtcbiAgICAgICAgY29uc3QgcnQgPSB0aGlzLnNoYWRvd0NhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGlmIChydCkge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSB0aGlzLmxpZ2h0O1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBydC5jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGxpZ2h0Ll9pc1BjZiAmJiBsaWdodC5kZXZpY2Uud2ViZ2wyID8gcnQuZGVwdGhCdWZmZXIgOiBydC5jb2xvckJ1ZmZlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuLyoqXG4gKiBBIGxpZ2h0LlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgTGlnaHQge1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIHRoaXMuaWQgPSBpZCsrO1xuXG4gICAgICAgIC8vIExpZ2h0IHByb3BlcnRpZXMgKGRlZmF1bHRzKVxuICAgICAgICB0aGlzLl90eXBlID0gTElHSFRUWVBFX0RJUkVDVElPTkFMO1xuICAgICAgICB0aGlzLl9jb2xvciA9IG5ldyBDb2xvcigwLjgsIDAuOCwgMC44KTtcbiAgICAgICAgdGhpcy5faW50ZW5zaXR5ID0gMTtcbiAgICAgICAgdGhpcy5fbHVtaW5hbmNlID0gMDtcbiAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3MgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLm1hc2sgPSBNQVNLX0FGRkVDVF9EWU5BTUlDO1xuICAgICAgICB0aGlzLmlzU3RhdGljID0gZmFsc2U7XG4gICAgICAgIHRoaXMua2V5ID0gMDtcbiAgICAgICAgdGhpcy5iYWtlRGlyID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5iYWtlTnVtU2FtcGxlcyA9IDE7XG4gICAgICAgIHRoaXMuYmFrZUFyZWEgPSAwO1xuXG4gICAgICAgIC8vIE9tbmkgYW5kIHNwb3QgcHJvcGVydGllc1xuICAgICAgICB0aGlzLmF0dGVudWF0aW9uU3RhcnQgPSAxMDtcbiAgICAgICAgdGhpcy5hdHRlbnVhdGlvbkVuZCA9IDEwO1xuICAgICAgICB0aGlzLl9mYWxsb2ZmTW9kZSA9IExJR0hURkFMTE9GRl9MSU5FQVI7XG4gICAgICAgIHRoaXMuX3NoYWRvd1R5cGUgPSBTSEFET1dfUENGMztcbiAgICAgICAgdGhpcy5fdnNtQmx1clNpemUgPSAxMTtcbiAgICAgICAgdGhpcy52c21CbHVyTW9kZSA9IEJMVVJfR0FVU1NJQU47XG4gICAgICAgIHRoaXMudnNtQmlhcyA9IDAuMDEgKiAwLjI1O1xuICAgICAgICB0aGlzLl9jb29raWUgPSBudWxsOyAvLyBsaWdodCBjb29raWUgdGV4dHVyZSAoMkQgZm9yIHNwb3QsIGN1YmVtYXAgZm9yIG9tbmkpXG4gICAgICAgIHRoaXMuY29va2llSW50ZW5zaXR5ID0gMTtcbiAgICAgICAgdGhpcy5fY29va2llRmFsbG9mZiA9IHRydWU7XG4gICAgICAgIHRoaXMuX2Nvb2tpZUNoYW5uZWwgPSAncmdiJztcbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtID0gbnVsbDsgLy8gMmQgcm90YXRpb24vc2NhbGUgbWF0cml4IChzcG90IG9ubHkpXG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXQgPSBudWxsOyAvLyAyZCBwb3NpdGlvbiBvZmZzZXQgKHNwb3Qgb25seSlcbiAgICAgICAgdGhpcy5fY29va2llT2Zmc2V0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVNldCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXRTZXQgPSBmYWxzZTtcblxuICAgICAgICAvLyBTcG90IHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5faW5uZXJDb25lQW5nbGUgPSA0MDtcbiAgICAgICAgdGhpcy5fb3V0ZXJDb25lQW5nbGUgPSA0NTtcblxuICAgICAgICAvLyBEaXJlY3Rpb25hbCBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuY2FzY2FkZXMgPSBudWxsOyAgICAgICAgICAgICAgIC8vIGFuIGFycmF5IG9mIFZlYzQgdmlld3BvcnRzIHBlciBjYXNjYWRlXG4gICAgICAgIHRoaXMuX3NoYWRvd01hdHJpeFBhbGV0dGUgPSBudWxsOyAgIC8vIGEgZmxvYXQgYXJyYXksIDE2IGZsb2F0cyBwZXIgY2FzY2FkZVxuICAgICAgICB0aGlzLl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzID0gbnVsbDtcbiAgICAgICAgdGhpcy5udW1DYXNjYWRlcyA9IDE7XG4gICAgICAgIHRoaXMuY2FzY2FkZURpc3RyaWJ1dGlvbiA9IDAuNTtcblxuICAgICAgICAvLyBMaWdodCBzb3VyY2Ugc2hhcGUgcHJvcGVydGllc1xuICAgICAgICB0aGlzLl9zaGFwZSA9IExJR0hUU0hBUEVfUFVOQ1RVQUw7XG5cbiAgICAgICAgLy8gQ2FjaGUgb2YgbGlnaHQgcHJvcGVydHkgZGF0YSBpbiBhIGZvcm1hdCBtb3JlIGZyaWVuZGx5IGZvciBzaGFkZXIgdW5pZm9ybXNcbiAgICAgICAgdGhpcy5fZmluYWxDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoWzAuOCwgMC44LCAwLjhdKTtcbiAgICAgICAgY29uc3QgYyA9IE1hdGgucG93KHRoaXMuX2ZpbmFsQ29sb3JbMF0sIDIuMik7XG4gICAgICAgIHRoaXMuX2xpbmVhckZpbmFsQ29sb3IgPSBuZXcgRmxvYXQzMkFycmF5KFtjLCBjLCBjXSk7XG5cbiAgICAgICAgdGhpcy5fcG9zaXRpb24gPSBuZXcgVmVjMygwLCAwLCAwKTtcbiAgICAgICAgdGhpcy5fZGlyZWN0aW9uID0gbmV3IFZlYzMoMCwgMCwgMCk7XG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3ModGhpcy5faW5uZXJDb25lQW5nbGUgKiBNYXRoLlBJIC8gMTgwKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlT3V0ZXJBbmdsZSh0aGlzLl9vdXRlckNvbmVBbmdsZSk7XG5cbiAgICAgICAgdGhpcy5fdXNlUGh5c2ljYWxVbml0cyA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBTaGFkb3cgbWFwcGluZyByZXNvdXJjZXNcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyUGFyYW1zID0gW107XG5cbiAgICAgICAgLy8gU2hhZG93IG1hcHBpbmcgcHJvcGVydGllc1xuICAgICAgICB0aGlzLnNoYWRvd0Rpc3RhbmNlID0gNDA7XG4gICAgICAgIHRoaXMuX3NoYWRvd1Jlc29sdXRpb24gPSAxMDI0O1xuICAgICAgICB0aGlzLnNoYWRvd0JpYXMgPSAtMC4wMDA1O1xuICAgICAgICB0aGlzLnNoYWRvd0ludGVuc2l0eSA9IDEuMDtcbiAgICAgICAgdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcyA9IDAuMDtcbiAgICAgICAgdGhpcy5zaGFkb3dVcGRhdGVNb2RlID0gU0hBRE9XVVBEQVRFX1JFQUxUSU1FO1xuICAgICAgICB0aGlzLnNoYWRvd1VwZGF0ZU92ZXJyaWRlcyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2lzVnNtID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2lzUGNmID0gdHJ1ZTtcblxuICAgICAgICAvLyBjb29raWUgbWF0cml4ICh1c2VkIGluIGNhc2UgdGhlIHNoYWRvdyBtYXBwaW5nIGlzIGRpc2FibGVkIGFuZCBzbyB0aGUgc2hhZG93IG1hdHJpeCBjYW5ub3QgYmUgdXNlZClcbiAgICAgICAgdGhpcy5fY29va2llTWF0cml4ID0gbnVsbDtcblxuICAgICAgICAvLyB2aWV3cG9ydCBvZiB0aGUgY29va2llIHRleHR1cmUgLyBzaGFkb3cgaW4gdGhlIGF0bGFzXG4gICAgICAgIHRoaXMuX2F0bGFzVmlld3BvcnQgPSBudWxsO1xuICAgICAgICB0aGlzLmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQgPSBmYWxzZTsgICAgLy8gaWYgdHJ1ZSwgYXRsYXMgc2xvdCBpcyBhbGxvY2F0ZWQgZm9yIHRoZSBjdXJyZW50IGZyYW1lXG4gICAgICAgIHRoaXMuYXRsYXNWZXJzaW9uID0gMDsgICAgICAvLyB2ZXJzaW9uIG9mIHRoZSBhdGxhcyBmb3IgdGhlIGFsbG9jYXRlZCBzbG90LCBhbGxvd3MgaW52YWxpZGF0aW9uIHdoZW4gYXRsYXMgcmVjcmVhdGVzIHNsb3RzXG4gICAgICAgIHRoaXMuYXRsYXNTbG90SW5kZXggPSAwOyAgICAvLyBhbGxvY2F0ZWQgc2xvdCBpbmRleCwgdXNlZCBmb3IgbW9yZSBwZXJzaXN0ZW50IHNsb3QgYWxsb2NhdGlvblxuICAgICAgICB0aGlzLmF0bGFzU2xvdFVwZGF0ZWQgPSBmYWxzZTsgIC8vIHRydWUgaWYgdGhlIGF0bGFzIHNsb3Qgd2FzIHJlYXNzaWduZWQgdGhpcyBmcmFtZSAoYW5kIGNvbnRlbnQgbmVlZHMgdG8gYmUgdXBkYXRlZClcblxuICAgICAgICB0aGlzLl9zY2VuZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX25vZGUgPSBudWxsO1xuXG4gICAgICAgIC8vIHByaXZhdGUgcmVuZGVyaW5nIGRhdGFcbiAgICAgICAgdGhpcy5fcmVuZGVyRGF0YSA9IFtdO1xuXG4gICAgICAgIC8vIHRydWUgaWYgdGhlIGxpZ2h0IGlzIHZpc2libGUgYnkgYW55IGNhbWVyYSB3aXRoaW4gYSBmcmFtZVxuICAgICAgICB0aGlzLnZpc2libGVUaGlzRnJhbWUgPSBmYWxzZTtcblxuICAgICAgICAvLyBtYXhpbXVtIHNpemUgb2YgdGhlIGxpZ2h0IGJvdW5kaW5nIHNwaGVyZSBvbiB0aGUgc2NyZWVuIGJ5IGFueSBjYW1lcmEgd2l0aGluIGEgZnJhbWVcbiAgICAgICAgLy8gKHVzZWQgdG8gZXN0aW1hdGUgc2hhZG93IHJlc29sdXRpb24pLCByYW5nZSBbMC4uMV1cbiAgICAgICAgdGhpcy5tYXhTY3JlZW5TaXplID0gMDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIHRoaXMuX3JlbmRlckRhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIHNldCBudW1DYXNjYWRlcyh2YWx1ZSkge1xuICAgICAgICBpZiAoIXRoaXMuY2FzY2FkZXMgfHwgdGhpcy5udW1DYXNjYWRlcyAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuY2FzY2FkZXMgPSBkaXJlY3Rpb25hbENhc2NhZGVzW3ZhbHVlIC0gMV07XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dNYXRyaXhQYWxldHRlID0gbmV3IEZsb2F0MzJBcnJheSg0ICogMTYpOyAgIC8vIGFsd2F5cyA0XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzID0gbmV3IEZsb2F0MzJBcnJheSg0KTsgICAgIC8vIGFsd2F5cyA0XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG51bUNhc2NhZGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYXNjYWRlcy5sZW5ndGg7XG4gICAgfVxuXG4gICAgc2V0IHNoYWRvd01hcChzaGFkb3dNYXApIHtcbiAgICAgICAgaWYgKHRoaXMuX3NoYWRvd01hcCAhPT0gc2hhZG93TWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dNYXAgPSBzaGFkb3dNYXA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2hhZG93TWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2hhZG93TWFwO1xuICAgIH1cblxuICAgIC8vIHJldHVybnMgbnVtYmVyIG9mIHJlbmRlciB0YXJnZXRzIHRvIHJlbmRlciB0aGUgc2hhZG93IG1hcFxuICAgIGdldCBudW1TaGFkb3dGYWNlcygpIHtcbiAgICAgICAgY29uc3QgdHlwZSA9IHRoaXMuX3R5cGU7XG4gICAgICAgIGlmICh0eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm51bUNhc2NhZGVzO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICByZXR1cm4gNjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHNldCB0eXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcblxuICAgICAgICBjb25zdCBzdHlwZSA9IHRoaXMuX3NoYWRvd1R5cGU7XG4gICAgICAgIHRoaXMuX3NoYWRvd1R5cGUgPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRvd1VwZGF0ZU92ZXJyaWRlcyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZG93VHlwZSA9IHN0eXBlOyAvLyByZWZyZXNoIHNoYWRvdyB0eXBlOyBzd2l0Y2hpbmcgZnJvbSBkaXJlY3Qvc3BvdCB0byBvbW5pIGFuZCBiYWNrIG1heSBjaGFuZ2UgaXRcbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgc2V0IHNoYXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFwZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fc2hhcGUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuXG4gICAgICAgIGNvbnN0IHN0eXBlID0gdGhpcy5fc2hhZG93VHlwZTtcbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZG93VHlwZSA9IHN0eXBlOyAvLyByZWZyZXNoIHNoYWRvdyB0eXBlOyBzd2l0Y2hpbmcgc2hhcGUgYW5kIGJhY2sgbWF5IGNoYW5nZSBpdFxuICAgIH1cblxuICAgIGdldCBzaGFwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYXBlO1xuICAgIH1cblxuICAgIHNldCB1c2VQaHlzaWNhbFVuaXRzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl91c2VQaHlzaWNhbFVuaXRzICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fdXNlUGh5c2ljYWxVbml0cyA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlRmluYWxDb2xvcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHVzZVBoeXNpY2FsVW5pdHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91c2VQaHlzaWNhbFVuaXRzO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dUeXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dUeXBlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpXG4gICAgICAgICAgICB2YWx1ZSA9IFNIQURPV19QQ0YzOyAvLyBWU00gb3IgSFcgUENGIGZvciBvbW5pIGxpZ2h0cyBpcyBub3Qgc3VwcG9ydGVkIHlldFxuXG4gICAgICAgIGNvbnN0IHN1cHBvcnRzUENGNSA9IGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmRldmljZVR5cGUgPT09IERFVklDRVRZUEVfV0VCR1BVO1xuICAgICAgICBpZiAodmFsdWUgPT09IFNIQURPV19QQ0Y1ICYmICFzdXBwb3J0c1BDRjUpIHtcbiAgICAgICAgICAgIHZhbHVlID0gU0hBRE9XX1BDRjM7IC8vIGZhbGxiYWNrIGZyb20gSFcgUENGIHRvIG9sZCBQQ0ZcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gU0hBRE9XX1ZTTTMyICYmICFkZXZpY2UudGV4dHVyZUZsb2F0UmVuZGVyYWJsZSkgLy8gZmFsbGJhY2sgZnJvbSB2c20zMiB0byB2c20xNlxuICAgICAgICAgICAgdmFsdWUgPSBTSEFET1dfVlNNMTY7XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSBTSEFET1dfVlNNMTYgJiYgIWRldmljZS50ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSkgLy8gZmFsbGJhY2sgZnJvbSB2c20xNiB0byB2c204XG4gICAgICAgICAgICB2YWx1ZSA9IFNIQURPV19WU004O1xuXG4gICAgICAgIHRoaXMuX2lzVnNtID0gdmFsdWUgPj0gU0hBRE9XX1ZTTTggJiYgdmFsdWUgPD0gU0hBRE9XX1ZTTTMyO1xuICAgICAgICB0aGlzLl9pc1BjZiA9IHZhbHVlID09PSBTSEFET1dfUENGNSB8fCB2YWx1ZSA9PT0gU0hBRE9XX1BDRjM7XG5cbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd1R5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkb3dUeXBlO1xuICAgIH1cblxuICAgIHNldCBlbmFibGVkKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbmFibGVkICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fZW5hYmxlZCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5sYXllcnNEaXJ0eSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGVuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbmFibGVkO1xuICAgIH1cblxuICAgIHNldCBjYXN0U2hhZG93cyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY2FzdFNoYWRvd3MgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9jYXN0U2hhZG93cyA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICAgICAgdGhpcy5sYXllcnNEaXJ0eSgpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjYXN0U2hhZG93cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nhc3RTaGFkb3dzICYmIHRoaXMubWFzayAhPT0gTUFTS19CQUtFICYmIHRoaXMubWFzayAhPT0gMDtcbiAgICB9XG5cbiAgICBzZXQgc2hhZG93UmVzb2x1dGlvbih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fc2hhZG93UmVzb2x1dGlvbiAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gTWF0aC5taW4odmFsdWUsIHRoaXMuZGV2aWNlLm1heEN1YmVNYXBTaXplKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBNYXRoLm1pbih2YWx1ZSwgdGhpcy5kZXZpY2UubWF4VGV4dHVyZVNpemUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fc2hhZG93UmVzb2x1dGlvbiA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd1Jlc29sdXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uO1xuICAgIH1cblxuICAgIHNldCB2c21CbHVyU2l6ZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdnNtQmx1clNpemUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICh2YWx1ZSAlIDIgPT09IDApIHZhbHVlKys7IC8vIGRvbid0IGFsbG93IGV2ZW4gc2l6ZVxuICAgICAgICB0aGlzLl92c21CbHVyU2l6ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCB2c21CbHVyU2l6ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ZzbUJsdXJTaXplO1xuICAgIH1cblxuICAgIHNldCBub3JtYWxPZmZzZXRCaWFzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9ub3JtYWxPZmZzZXRCaWFzID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAoKCF0aGlzLl9ub3JtYWxPZmZzZXRCaWFzICYmIHZhbHVlKSB8fCAodGhpcy5fbm9ybWFsT2Zmc2V0QmlhcyAmJiAhdmFsdWUpKSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX25vcm1hbE9mZnNldEJpYXMgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgbm9ybWFsT2Zmc2V0QmlhcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX25vcm1hbE9mZnNldEJpYXM7XG4gICAgfVxuXG4gICAgc2V0IGZhbGxvZmZNb2RlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9mYWxsb2ZmTW9kZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fZmFsbG9mZk1vZGUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgZmFsbG9mZk1vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mYWxsb2ZmTW9kZTtcbiAgICB9XG5cbiAgICBzZXQgaW5uZXJDb25lQW5nbGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2lubmVyQ29uZUFuZ2xlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9pbm5lckNvbmVBbmdsZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9pbm5lckNvbmVBbmdsZUNvcyA9IE1hdGguY29zKHZhbHVlICogTWF0aC5QSSAvIDE4MCk7XG4gICAgICAgIGlmICh0aGlzLl91c2VQaHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaW5uZXJDb25lQW5nbGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbm5lckNvbmVBbmdsZTtcbiAgICB9XG5cbiAgICBzZXQgb3V0ZXJDb25lQW5nbGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX291dGVyQ29uZUFuZ2xlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9vdXRlckNvbmVBbmdsZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl91cGRhdGVPdXRlckFuZ2xlKHZhbHVlKTtcblxuICAgICAgICBpZiAodGhpcy5fdXNlUGh5c2ljYWxVbml0cykge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlRmluYWxDb2xvcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG91dGVyQ29uZUFuZ2xlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb3V0ZXJDb25lQW5nbGU7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU91dGVyQW5nbGUoYW5nbGUpIHtcbiAgICAgICAgY29uc3QgcmFkQW5nbGUgPSBhbmdsZSAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3MocmFkQW5nbGUpO1xuICAgICAgICB0aGlzLl9vdXRlckNvbmVBbmdsZVNpbiA9IE1hdGguc2luKHJhZEFuZ2xlKTtcbiAgICB9XG5cbiAgICBzZXQgaW50ZW5zaXR5KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbnRlbnNpdHkgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9pbnRlbnNpdHkgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpbnRlbnNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnRlbnNpdHk7XG4gICAgfVxuXG4gICAgc2V0IGx1bWluYW5jZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbHVtaW5hbmNlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbHVtaW5hbmNlID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbHVtaW5hbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbHVtaW5hbmNlO1xuICAgIH1cblxuICAgIGdldCBjb29raWVNYXRyaXgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29va2llTWF0cml4KSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVNYXRyaXg7XG4gICAgfVxuXG4gICAgZ2V0IGF0bGFzVmlld3BvcnQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXRsYXNWaWV3cG9ydCkge1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNWaWV3cG9ydCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hdGxhc1ZpZXdwb3J0O1xuICAgIH1cblxuICAgIHNldCBjb29raWUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZTtcbiAgICB9XG5cbiAgICBzZXQgY29va2llRmFsbG9mZih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llRmFsbG9mZiA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llRmFsbG9mZiA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBjb29raWVGYWxsb2ZmKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llRmFsbG9mZjtcbiAgICB9XG5cbiAgICBzZXQgY29va2llQ2hhbm5lbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llQ2hhbm5lbCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNociA9IHZhbHVlLmNoYXJBdCh2YWx1ZS5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgIGNvbnN0IGFkZExlbiA9IDMgLSB2YWx1ZS5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFkZExlbjsgaSsrKVxuICAgICAgICAgICAgICAgIHZhbHVlICs9IGNocjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb29raWVDaGFubmVsID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZUNoYW5uZWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVDaGFubmVsO1xuICAgIH1cblxuICAgIHNldCBjb29raWVUcmFuc2Zvcm0odmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZVRyYW5zZm9ybSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVNldCA9ICEhdmFsdWU7XG4gICAgICAgIGlmICh2YWx1ZSAmJiAhdGhpcy5fY29va2llT2Zmc2V0KSB7XG4gICAgICAgICAgICB0aGlzLmNvb2tpZU9mZnNldCA9IG5ldyBWZWMyKCk7IC8vIHVzaW5nIHRyYW5zZm9ybSBmb3JjZXMgdXNpbmcgb2Zmc2V0IGNvZGVcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldFNldCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBzZXQgY29va2llT2Zmc2V0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVPZmZzZXQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHhmb3JtTmV3ID0gISEodGhpcy5fY29va2llVHJhbnNmb3JtU2V0IHx8IHZhbHVlKTtcbiAgICAgICAgaWYgKHhmb3JtTmV3ICYmICF2YWx1ZSAmJiB0aGlzLl9jb29raWVPZmZzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldC5zZXQoMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVPZmZzZXQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXRTZXQgPSAhIXZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgJiYgIXRoaXMuX2Nvb2tpZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgdGhpcy5jb29raWVUcmFuc2Zvcm0gPSBuZXcgVmVjNCgxLCAxLCAwLCAwKTsgLy8gdXNpbmcgb2Zmc2V0IGZvcmNlcyB1c2luZyBtYXRyaXggY29kZVxuICAgICAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtU2V0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llT2Zmc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llT2Zmc2V0O1xuICAgIH1cblxuICAgIC8vIHByZXBhcmVzIGxpZ2h0IGZvciB0aGUgZnJhbWUgcmVuZGVyaW5nXG4gICAgYmVnaW5GcmFtZSgpIHtcbiAgICAgICAgdGhpcy52aXNpYmxlVGhpc0ZyYW1lID0gdGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMICYmIHRoaXMuX2VuYWJsZWQ7XG4gICAgICAgIHRoaXMubWF4U2NyZWVuU2l6ZSA9IDA7XG4gICAgICAgIHRoaXMuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmF0bGFzU2xvdFVwZGF0ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBkZXN0cm95cyBzaGFkb3cgbWFwIHJlbGF0ZWQgcmVzb3VyY2VzLCBjYWxsZWQgd2hlbiBzaGFkb3cgcHJvcGVydGllcyBjaGFuZ2UgYW5kIHJlc291cmNlc1xuICAgIC8vIG5lZWQgdG8gYmUgcmVjcmVhdGVkXG4gICAgX2Rlc3Ryb3lTaGFkb3dNYXAoKSB7XG5cbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlckRhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckRhdGEubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dNYXApIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc2hhZG93TWFwLmNhY2hlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hcC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dNYXAgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXNbaV0gPT09IFNIQURPV1VQREFURV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93VXBkYXRlT3ZlcnJpZGVzW2ldID0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIExpZ2h0UmVuZGVyRGF0YSB3aXRoIG1hdGNoaW5nIGNhbWVyYSBhbmQgZmFjZVxuICAgIGdldFJlbmRlckRhdGEoY2FtZXJhLCBmYWNlKSB7XG5cbiAgICAgICAgLy8gcmV0dXJucyBleGlzdGluZ1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3JlbmRlckRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9yZW5kZXJEYXRhW2ldO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnQuY2FtZXJhID09PSBjYW1lcmEgJiYgY3VycmVudC5mYWNlID09PSBmYWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgbmV3IG9uZVxuICAgICAgICBjb25zdCByZCA9IG5ldyBMaWdodFJlbmRlckRhdGEodGhpcy5kZXZpY2UsIGNhbWVyYSwgZmFjZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3JlbmRlckRhdGEucHVzaChyZCk7XG4gICAgICAgIHJldHVybiByZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEdXBsaWNhdGVzIGEgbGlnaHQgbm9kZSBidXQgZG9lcyBub3QgJ2RlZXAgY29weScgdGhlIGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtMaWdodH0gQSBjbG9uZWQgTGlnaHQuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IExpZ2h0KHRoaXMuZGV2aWNlKTtcblxuICAgICAgICAvLyBDbG9uZSBMaWdodCBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLnR5cGUgPSB0aGlzLl90eXBlO1xuICAgICAgICBjbG9uZS5zZXRDb2xvcih0aGlzLl9jb2xvcik7XG4gICAgICAgIGNsb25lLmludGVuc2l0eSA9IHRoaXMuX2ludGVuc2l0eTtcbiAgICAgICAgY2xvbmUubHVtaW5hbmNlID0gdGhpcy5fbHVtaW5hbmNlO1xuICAgICAgICBjbG9uZS5jYXN0U2hhZG93cyA9IHRoaXMuY2FzdFNoYWRvd3M7XG4gICAgICAgIGNsb25lLl9lbmFibGVkID0gdGhpcy5fZW5hYmxlZDtcblxuICAgICAgICAvLyBPbW5pIGFuZCBzcG90IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuYXR0ZW51YXRpb25TdGFydCA9IHRoaXMuYXR0ZW51YXRpb25TdGFydDtcbiAgICAgICAgY2xvbmUuYXR0ZW51YXRpb25FbmQgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICBjbG9uZS5mYWxsb2ZmTW9kZSA9IHRoaXMuX2ZhbGxvZmZNb2RlO1xuICAgICAgICBjbG9uZS5zaGFkb3dUeXBlID0gdGhpcy5fc2hhZG93VHlwZTtcbiAgICAgICAgY2xvbmUudnNtQmx1clNpemUgPSB0aGlzLl92c21CbHVyU2l6ZTtcbiAgICAgICAgY2xvbmUudnNtQmx1ck1vZGUgPSB0aGlzLnZzbUJsdXJNb2RlO1xuICAgICAgICBjbG9uZS52c21CaWFzID0gdGhpcy52c21CaWFzO1xuICAgICAgICBjbG9uZS5zaGFkb3dVcGRhdGVNb2RlID0gdGhpcy5zaGFkb3dVcGRhdGVNb2RlO1xuICAgICAgICBjbG9uZS5tYXNrID0gdGhpcy5tYXNrO1xuXG4gICAgICAgIGlmICh0aGlzLnNoYWRvd1VwZGF0ZU92ZXJyaWRlcykge1xuICAgICAgICAgICAgY2xvbmUuc2hhZG93VXBkYXRlT3ZlcnJpZGVzID0gdGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMuc2xpY2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNwb3QgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5pbm5lckNvbmVBbmdsZSA9IHRoaXMuX2lubmVyQ29uZUFuZ2xlO1xuICAgICAgICBjbG9uZS5vdXRlckNvbmVBbmdsZSA9IHRoaXMuX291dGVyQ29uZUFuZ2xlO1xuXG4gICAgICAgIC8vIERpcmVjdGlvbmFsIHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUubnVtQ2FzY2FkZXMgPSB0aGlzLm51bUNhc2NhZGVzO1xuICAgICAgICBjbG9uZS5jYXNjYWRlRGlzdHJpYnV0aW9uID0gdGhpcy5jYXNjYWRlRGlzdHJpYnV0aW9uO1xuXG4gICAgICAgIC8vIHNoYXBlIHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuc2hhcGUgPSB0aGlzLl9zaGFwZTtcblxuICAgICAgICAvLyBTaGFkb3cgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5zaGFkb3dCaWFzID0gdGhpcy5zaGFkb3dCaWFzO1xuICAgICAgICBjbG9uZS5ub3JtYWxPZmZzZXRCaWFzID0gdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICAgICAgY2xvbmUuc2hhZG93UmVzb2x1dGlvbiA9IHRoaXMuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgICAgIGNsb25lLnNoYWRvd0Rpc3RhbmNlID0gdGhpcy5zaGFkb3dEaXN0YW5jZTtcbiAgICAgICAgY2xvbmUuc2hhZG93SW50ZW5zaXR5ID0gdGhpcy5zaGFkb3dJbnRlbnNpdHk7XG5cbiAgICAgICAgLy8gQ29va2llcyBwcm9wZXJ0aWVzXG4gICAgICAgIC8vIGNsb25lLmNvb2tpZSA9IHRoaXMuX2Nvb2tpZTtcbiAgICAgICAgLy8gY2xvbmUuY29va2llSW50ZW5zaXR5ID0gdGhpcy5jb29raWVJbnRlbnNpdHk7XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZUZhbGxvZmYgPSB0aGlzLl9jb29raWVGYWxsb2ZmO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVDaGFubmVsID0gdGhpcy5fY29va2llQ2hhbm5lbDtcbiAgICAgICAgLy8gY2xvbmUuY29va2llVHJhbnNmb3JtID0gdGhpcy5fY29va2llVHJhbnNmb3JtO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVPZmZzZXQgPSB0aGlzLl9jb29raWVPZmZzZXQ7XG5cbiAgICAgICAgcmV0dXJuIGNsb25lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBjb252ZXJzaW9uIGZhY3RvciBmb3IgbHVtaW5hbmNlIC0+IGxpZ2h0IHNwZWNpZmljIGxpZ2h0IHVuaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gdHlwZSAtIFRoZSB0eXBlIG9mIGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3V0ZXJBbmdsZV0gLSBUaGUgb3V0ZXIgYW5nbGUgb2YgYSBzcG90IGxpZ2h0LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbaW5uZXJBbmdsZV0gLSBUaGUgaW5uZXIgYW5nbGUgb2YgYSBzcG90IGxpZ2h0LlxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFRoZSBzY2FsaW5nIGZhY3RvciB0byBtdWx0aXBseSB3aXRoIHRoZSBsdW1pbmFuY2UgdmFsdWUuXG4gICAgICovXG4gICAgc3RhdGljIGdldExpZ2h0VW5pdENvbnZlcnNpb24odHlwZSwgb3V0ZXJBbmdsZSA9IE1hdGguUEkgLyA0LCBpbm5lckFuZ2xlID0gMCkge1xuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgTElHSFRUWVBFX1NQT1Q6IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWxsb2ZmRW5kID0gTWF0aC5jb3Mob3V0ZXJBbmdsZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgZmFsbG9mZlN0YXJ0ID0gTWF0aC5jb3MoaW5uZXJBbmdsZSk7XG5cbiAgICAgICAgICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbW1wL3BicnQtdjQvYmxvYi9mYWFjMzRkMWEwZWJkMjQ5Mjg4MjhmZTlmYTY1YjY1ZjdlZmM1OTM3L3NyYy9wYnJ0L2xpZ2h0cy5jcHAjTDE0NjNcbiAgICAgICAgICAgICAgICByZXR1cm4gKDIgKiBNYXRoLlBJICogKCgxIC0gZmFsbG9mZlN0YXJ0KSArIChmYWxsb2ZmU3RhcnQgLSBmYWxsb2ZmRW5kKSAvIDIuMCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfT01OSTpcbiAgICAgICAgICAgICAgICAvLyBodHRwczovL2dvb2dsZS5naXRodWIuaW8vZmlsYW1lbnQvRmlsYW1lbnQubWQuaHRtbCNsaWdodGluZy9kaXJlY3RsaWdodGluZy9wdW5jdHVhbGxpZ2h0cy9wb2ludGxpZ2h0c1xuICAgICAgICAgICAgICAgIHJldHVybiAoNCAqIE1hdGguUEkpO1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfRElSRUNUSU9OQUw6XG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9nb29nbGUuZ2l0aHViLmlvL2ZpbGFtZW50L0ZpbGFtZW50Lm1kLmh0bWwjbGlnaHRpbmcvZGlyZWN0bGlnaHRpbmcvZGlyZWN0aW9uYWxsaWdodHNcbiAgICAgICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJldHVybnMgdGhlIGJpYXMgKC54KSBhbmQgbm9ybWFsQmlhcyAoLnkpIHZhbHVlIGZvciBsaWdodHMgYXMgcGFzc2VkIHRvIHNoYWRlcnMgYnkgdW5pZm9ybXNcbiAgICAvLyBOb3RlOiB0aGlzIG5lZWRzIHRvIGJlIHJldmlzaXRlZCBhbmQgc2ltcGxpZmllZFxuICAgIC8vIE5vdGU6IHZzbUJpYXMgaXMgbm90IHVzZWQgYXQgYWxsIGZvciBvbW5pIGxpZ2h0LCBldmVuIHRob3VnaCBpdCBpcyBlZGl0YWJsZSBpbiB0aGUgRWRpdG9yXG4gICAgX2dldFVuaWZvcm1CaWFzVmFsdWVzKGxpZ2h0UmVuZGVyRGF0YSkge1xuXG4gICAgICAgIGNvbnN0IGZhckNsaXAgPSBsaWdodFJlbmRlckRhdGEuc2hhZG93Q2FtZXJhLl9mYXJDbGlwO1xuXG4gICAgICAgIHN3aXRjaCAodGhpcy5fdHlwZSkge1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfT01OSTpcbiAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9IHRoaXMuc2hhZG93QmlhcztcbiAgICAgICAgICAgICAgICB0bXBCaWFzZXMubm9ybWFsQmlhcyA9IHRoaXMuX25vcm1hbE9mZnNldEJpYXM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9TUE9UOlxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pc1ZzbSkge1xuICAgICAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9IC0wLjAwMDAxICogMjA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdG1wQmlhc2VzLmJpYXMgPSB0aGlzLnNoYWRvd0JpYXMgKiAyMDsgLy8gYXBwcm94IHJlbWFwIGZyb20gb2xkIGJpYXMgdmFsdWVzXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZXZpY2Uud2ViZ2wyICYmIHRoaXMuZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHRtcEJpYXNlcy5iaWFzICo9IC0xMDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5ub3JtYWxCaWFzID0gdGhpcy5faXNWc20gPyB0aGlzLnZzbUJpYXMgLyAodGhpcy5hdHRlbnVhdGlvbkVuZCAvIDcuMCkgOiB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfRElSRUNUSU9OQUw6XG4gICAgICAgICAgICAgICAgLy8gbWFrZSBiaWFzIGRlcGVuZGVudCBvbiBmYXIgcGxhbmUgYmVjYXVzZSBpdCdzIG5vdCBjb25zdGFudCBmb3IgZGlyZWN0IGxpZ2h0XG4gICAgICAgICAgICAgICAgLy8gY2xpcCBkaXN0YW5jZSB1c2VkIGlzIGJhc2VkIG9uIHRoZSBuZWFyZXN0IHNoYWRvdyBjYXNjYWRlXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzVnNtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gLTAuMDAwMDEgKiAyMDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9ICh0aGlzLnNoYWRvd0JpYXMgLyBmYXJDbGlwKSAqIDEwMDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRldmljZS53ZWJnbDIgJiYgdGhpcy5kZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykgdG1wQmlhc2VzLmJpYXMgKj0gLTEwMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdG1wQmlhc2VzLm5vcm1hbEJpYXMgPSB0aGlzLl9pc1ZzbSA/IHRoaXMudnNtQmlhcyAvIChmYXJDbGlwIC8gNy4wKSA6IHRoaXMuX25vcm1hbE9mZnNldEJpYXM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdG1wQmlhc2VzO1xuICAgIH1cblxuICAgIGdldENvbG9yKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29sb3I7XG4gICAgfVxuXG4gICAgZ2V0Qm91bmRpbmdTcGhlcmUoc3BoZXJlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuXG4gICAgICAgICAgICAvLyBiYXNlZCBvbiBodHRwczovL2JhcnR3cm9uc2tpLmNvbS8yMDE3LzA0LzEzL2N1bGwtdGhhdC1jb25lL1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IHRoaXMuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICBjb25zdCBhbmdsZSA9IHRoaXMuX291dGVyQ29uZUFuZ2xlO1xuICAgICAgICAgICAgY29uc3QgY29zQW5nbGUgPSB0aGlzLl9vdXRlckNvbmVBbmdsZUNvcztcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLl9ub2RlO1xuICAgICAgICAgICAgdG1wVmVjLmNvcHkobm9kZS51cCk7XG5cbiAgICAgICAgICAgIGlmIChhbmdsZSA+IDQ1KSB7XG4gICAgICAgICAgICAgICAgc3BoZXJlLnJhZGl1cyA9IHNpemUgKiB0aGlzLl9vdXRlckNvbmVBbmdsZVNpbjtcbiAgICAgICAgICAgICAgICB0bXBWZWMubXVsU2NhbGFyKC1zaXplICogY29zQW5nbGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzcGhlcmUucmFkaXVzID0gc2l6ZSAvICgyICogY29zQW5nbGUpO1xuICAgICAgICAgICAgICAgIHRtcFZlYy5tdWxTY2FsYXIoLXNwaGVyZS5yYWRpdXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzcGhlcmUuY2VudGVyLmFkZDIobm9kZS5nZXRQb3NpdGlvbigpLCB0bXBWZWMpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgIHNwaGVyZS5jZW50ZXIgPSB0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICBzcGhlcmUucmFkaXVzID0gdGhpcy5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldEJvdW5kaW5nQm94KGJveCkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcbiAgICAgICAgICAgIGNvbnN0IHJhbmdlID0gdGhpcy5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgICAgIGNvbnN0IGFuZ2xlID0gdGhpcy5fb3V0ZXJDb25lQW5nbGU7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gdGhpcy5fbm9kZTtcblxuICAgICAgICAgICAgY29uc3Qgc2NsID0gTWF0aC5hYnMoTWF0aC5zaW4oYW5nbGUgKiBtYXRoLkRFR19UT19SQUQpICogcmFuZ2UpO1xuXG4gICAgICAgICAgICBib3guY2VudGVyLnNldCgwLCAtcmFuZ2UgKiAwLjUsIDApO1xuICAgICAgICAgICAgYm94LmhhbGZFeHRlbnRzLnNldChzY2wsIHJhbmdlICogMC41LCBzY2wpO1xuXG4gICAgICAgICAgICBib3guc2V0RnJvbVRyYW5zZm9ybWVkQWFiYihib3gsIG5vZGUuZ2V0V29ybGRUcmFuc2Zvcm0oKSwgdHJ1ZSk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgYm94LmNlbnRlci5jb3B5KHRoaXMuX25vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICBib3guaGFsZkV4dGVudHMuc2V0KHRoaXMuYXR0ZW51YXRpb25FbmQsIHRoaXMuYXR0ZW51YXRpb25FbmQsIHRoaXMuYXR0ZW51YXRpb25FbmQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZUZpbmFsQ29sb3IoKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gdGhpcy5fY29sb3I7XG4gICAgICAgIGNvbnN0IHIgPSBjb2xvci5yO1xuICAgICAgICBjb25zdCBnID0gY29sb3IuZztcbiAgICAgICAgY29uc3QgYiA9IGNvbG9yLmI7XG5cbiAgICAgICAgbGV0IGkgPSB0aGlzLl9pbnRlbnNpdHk7XG5cbiAgICAgICAgLy8gVG8gY2FsY3VsYXRlIHRoZSBsdXgsIHdoaWNoIGlzIGxtL21eMiwgd2UgbmVlZCB0byBjb252ZXJ0IGZyb20gbHVtaW5vdXMgcG93ZXJcbiAgICAgICAgaWYgKHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIGkgPSB0aGlzLl9sdW1pbmFuY2UgLyBMaWdodC5nZXRMaWdodFVuaXRDb252ZXJzaW9uKHRoaXMuX3R5cGUsIHRoaXMuX291dGVyQ29uZUFuZ2xlICogbWF0aC5ERUdfVE9fUkFELCB0aGlzLl9pbm5lckNvbmVBbmdsZSAqIG1hdGguREVHX1RPX1JBRCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmaW5hbENvbG9yID0gdGhpcy5fZmluYWxDb2xvcjtcbiAgICAgICAgY29uc3QgbGluZWFyRmluYWxDb2xvciA9IHRoaXMuX2xpbmVhckZpbmFsQ29sb3I7XG5cbiAgICAgICAgZmluYWxDb2xvclswXSA9IHIgKiBpO1xuICAgICAgICBmaW5hbENvbG9yWzFdID0gZyAqIGk7XG4gICAgICAgIGZpbmFsQ29sb3JbMl0gPSBiICogaTtcbiAgICAgICAgaWYgKGkgPj0gMSkge1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclswXSA9IE1hdGgucG93KHIsIDIuMikgKiBpO1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclsxXSA9IE1hdGgucG93KGcsIDIuMikgKiBpO1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclsyXSA9IE1hdGgucG93KGIsIDIuMikgKiBpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclswXSA9IE1hdGgucG93KGZpbmFsQ29sb3JbMF0sIDIuMik7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzFdID0gTWF0aC5wb3coZmluYWxDb2xvclsxXSwgMi4yKTtcbiAgICAgICAgICAgIGxpbmVhckZpbmFsQ29sb3JbMl0gPSBNYXRoLnBvdyhmaW5hbENvbG9yWzJdLCAyLjIpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0Q29sb3IoKSB7XG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5zZXQoYXJndW1lbnRzWzBdLnIsIGFyZ3VtZW50c1swXS5nLCBhcmd1bWVudHNbMF0uYik7XG4gICAgICAgIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAgdGhpcy5fY29sb3Iuc2V0KGFyZ3VtZW50c1swXSwgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlRmluYWxDb2xvcigpO1xuICAgIH1cblxuICAgIGxheWVyc0RpcnR5KCkge1xuICAgICAgICBpZiAodGhpcy5fc2NlbmU/LmxheWVycykge1xuICAgICAgICAgICAgdGhpcy5fc2NlbmUubGF5ZXJzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB1cGRhdGVLZXkoKSB7XG4gICAgICAgIC8vIEtleSBkZWZpbml0aW9uOlxuICAgICAgICAvLyBCaXRcbiAgICAgICAgLy8gMzEgICAgICA6IHNpZ24gYml0IChsZWF2ZSlcbiAgICAgICAgLy8gMjkgLSAzMCA6IHR5cGVcbiAgICAgICAgLy8gMjggICAgICA6IGNhc3Qgc2hhZG93c1xuICAgICAgICAvLyAyNSAtIDI3IDogc2hhZG93IHR5cGVcbiAgICAgICAgLy8gMjMgLSAyNCA6IGZhbGxvZmYgbW9kZVxuICAgICAgICAvLyAyMiAgICAgIDogbm9ybWFsIG9mZnNldCBiaWFzXG4gICAgICAgIC8vIDIxICAgICAgOiBjb29raWVcbiAgICAgICAgLy8gMjAgICAgICA6IGNvb2tpZSBmYWxsb2ZmXG4gICAgICAgIC8vIDE4IC0gMTkgOiBjb29raWUgY2hhbm5lbCBSXG4gICAgICAgIC8vIDE2IC0gMTcgOiBjb29raWUgY2hhbm5lbCBHXG4gICAgICAgIC8vIDE0IC0gMTUgOiBjb29raWUgY2hhbm5lbCBCXG4gICAgICAgIC8vIDEyICAgICAgOiBjb29raWUgdHJhbnNmb3JtXG4gICAgICAgIC8vIDEwIC0gMTEgOiBsaWdodCBzb3VyY2Ugc2hhcGVcbiAgICAgICAgLy8gIDggLSAgOSA6IGxpZ2h0IG51bSBjYXNjYWRlc1xuICAgICAgICBsZXQga2V5ID1cbiAgICAgICAgICAgICAgICh0aGlzLl90eXBlICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8PCAyOSkgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9jYXN0U2hhZG93cyA/IDEgOiAwKSAgICAgICAgICAgICAgIDw8IDI4KSB8XG4gICAgICAgICAgICAgICAodGhpcy5fc2hhZG93VHlwZSAgICAgICAgICAgICAgICAgICAgICAgICAgPDwgMjUpIHxcbiAgICAgICAgICAgICAgICh0aGlzLl9mYWxsb2ZmTW9kZSAgICAgICAgICAgICAgICAgICAgICAgICA8PCAyMykgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9ub3JtYWxPZmZzZXRCaWFzICE9PSAwLjAgPyAxIDogMCkgIDw8IDIyKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX2Nvb2tpZSA/IDEgOiAwKSAgICAgICAgICAgICAgICAgICAgPDwgMjEpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY29va2llRmFsbG9mZiA/IDEgOiAwKSAgICAgICAgICAgICA8PCAyMCkgfFxuICAgICAgICAgICAgICAgKGNoYW5JZFt0aGlzLl9jb29raWVDaGFubmVsLmNoYXJBdCgwKV0gICAgIDw8IDE4KSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX2Nvb2tpZVRyYW5zZm9ybSA/IDEgOiAwKSAgICAgICAgICAgPDwgMTIpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fc2hhcGUpICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8PCAxMCkgfFxuICAgICAgICAgICAgICAgKCh0aGlzLm51bUNhc2NhZGVzIC0gMSkgICAgICAgICAgICAgICAgICAgIDw8ICA4KTtcblxuICAgICAgICBpZiAodGhpcy5fY29va2llQ2hhbm5lbC5sZW5ndGggPT09IDMpIHtcbiAgICAgICAgICAgIGtleSB8PSAoY2hhbklkW3RoaXMuX2Nvb2tpZUNoYW5uZWwuY2hhckF0KDEpXSA8PCAxNik7XG4gICAgICAgICAgICBrZXkgfD0gKGNoYW5JZFt0aGlzLl9jb29raWVDaGFubmVsLmNoYXJBdCgyKV0gPDwgMTQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGtleSAhPT0gdGhpcy5rZXkgJiYgdGhpcy5fc2NlbmUgIT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IG1vc3Qgb2YgdGhlIGNoYW5nZXMgdG8gdGhlIGtleSBzaG91bGQgbm90IGludmFsaWRhdGUgdGhlIGNvbXBvc2l0aW9uLFxuICAgICAgICAgICAgLy8gcHJvYmFibHkgb25seSBfdHlwZSBhbmQgX2Nhc3RTaGFkb3dzXG4gICAgICAgICAgICB0aGlzLmxheWVyc0RpcnR5KCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmtleSA9IGtleTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IExpZ2h0LCBsaWdodFR5cGVzIH07XG4iXSwibmFtZXMiOlsidG1wVmVjIiwiVmVjMyIsInRtcEJpYXNlcyIsImJpYXMiLCJub3JtYWxCaWFzIiwiY2hhbklkIiwiciIsImciLCJiIiwiYSIsImxpZ2h0VHlwZXMiLCJMSUdIVFRZUEVfRElSRUNUSU9OQUwiLCJMSUdIVFRZUEVfT01OSSIsIkxJR0hUVFlQRV9TUE9UIiwiZGlyZWN0aW9uYWxDYXNjYWRlcyIsIlZlYzQiLCJpZCIsIkxpZ2h0UmVuZGVyRGF0YSIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwiY2FtZXJhIiwiZmFjZSIsImxpZ2h0Iiwic2hhZG93Q2FtZXJhIiwiU2hhZG93UmVuZGVyZXIiLCJjcmVhdGVTaGFkb3dDYW1lcmEiLCJfc2hhZG93VHlwZSIsIl90eXBlIiwic2hhZG93TWF0cml4IiwiTWF0NCIsInNoYWRvd1ZpZXdwb3J0Iiwic2hhZG93U2Npc3NvciIsInZpc2libGVDYXN0ZXJzIiwic2hhZG93QnVmZmVyIiwicnQiLCJyZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsIl9pc1BjZiIsIndlYmdsMiIsImRlcHRoQnVmZmVyIiwiTGlnaHQiLCJncmFwaGljc0RldmljZSIsIl9jb2xvciIsIkNvbG9yIiwiX2ludGVuc2l0eSIsIl9sdW1pbmFuY2UiLCJfY2FzdFNoYWRvd3MiLCJfZW5hYmxlZCIsIm1hc2siLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiaXNTdGF0aWMiLCJrZXkiLCJiYWtlRGlyIiwiYmFrZU51bVNhbXBsZXMiLCJiYWtlQXJlYSIsImF0dGVudWF0aW9uU3RhcnQiLCJhdHRlbnVhdGlvbkVuZCIsIl9mYWxsb2ZmTW9kZSIsIkxJR0hURkFMTE9GRl9MSU5FQVIiLCJTSEFET1dfUENGMyIsIl92c21CbHVyU2l6ZSIsInZzbUJsdXJNb2RlIiwiQkxVUl9HQVVTU0lBTiIsInZzbUJpYXMiLCJfY29va2llIiwiY29va2llSW50ZW5zaXR5IiwiX2Nvb2tpZUZhbGxvZmYiLCJfY29va2llQ2hhbm5lbCIsIl9jb29raWVUcmFuc2Zvcm0iLCJfY29va2llVHJhbnNmb3JtVW5pZm9ybSIsIkZsb2F0MzJBcnJheSIsIl9jb29raWVPZmZzZXQiLCJfY29va2llT2Zmc2V0VW5pZm9ybSIsIl9jb29raWVUcmFuc2Zvcm1TZXQiLCJfY29va2llT2Zmc2V0U2V0IiwiX2lubmVyQ29uZUFuZ2xlIiwiX291dGVyQ29uZUFuZ2xlIiwiY2FzY2FkZXMiLCJfc2hhZG93TWF0cml4UGFsZXR0ZSIsIl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzIiwibnVtQ2FzY2FkZXMiLCJjYXNjYWRlRGlzdHJpYnV0aW9uIiwiX3NoYXBlIiwiTElHSFRTSEFQRV9QVU5DVFVBTCIsIl9maW5hbENvbG9yIiwiYyIsIk1hdGgiLCJwb3ciLCJfbGluZWFyRmluYWxDb2xvciIsIl9wb3NpdGlvbiIsIl9kaXJlY3Rpb24iLCJfaW5uZXJDb25lQW5nbGVDb3MiLCJjb3MiLCJQSSIsIl91cGRhdGVPdXRlckFuZ2xlIiwiX3VzZVBoeXNpY2FsVW5pdHMiLCJ1bmRlZmluZWQiLCJfc2hhZG93TWFwIiwiX3NoYWRvd1JlbmRlclBhcmFtcyIsInNoYWRvd0Rpc3RhbmNlIiwiX3NoYWRvd1Jlc29sdXRpb24iLCJzaGFkb3dCaWFzIiwic2hhZG93SW50ZW5zaXR5IiwiX25vcm1hbE9mZnNldEJpYXMiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX1JFQUxUSU1FIiwic2hhZG93VXBkYXRlT3ZlcnJpZGVzIiwiX2lzVnNtIiwiX2Nvb2tpZU1hdHJpeCIsIl9hdGxhc1ZpZXdwb3J0IiwiYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCIsImF0bGFzVmVyc2lvbiIsImF0bGFzU2xvdEluZGV4IiwiYXRsYXNTbG90VXBkYXRlZCIsIl9zY2VuZSIsIl9ub2RlIiwiX3JlbmRlckRhdGEiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwibWF4U2NyZWVuU2l6ZSIsImRlc3Ryb3kiLCJfZGVzdHJveVNoYWRvd01hcCIsInZhbHVlIiwidXBkYXRlS2V5IiwibGVuZ3RoIiwic2hhZG93TWFwIiwibnVtU2hhZG93RmFjZXMiLCJ0eXBlIiwic3R5cGUiLCJzaGFkb3dUeXBlIiwic2hhcGUiLCJ1c2VQaHlzaWNhbFVuaXRzIiwiX3VwZGF0ZUZpbmFsQ29sb3IiLCJzdXBwb3J0c1BDRjUiLCJkZXZpY2VUeXBlIiwiREVWSUNFVFlQRV9XRUJHUFUiLCJTSEFET1dfUENGNSIsIlNIQURPV19WU00zMiIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJTSEFET1dfVlNNMTYiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsIlNIQURPV19WU004IiwiZW5hYmxlZCIsImxheWVyc0RpcnR5IiwiY2FzdFNoYWRvd3MiLCJNQVNLX0JBS0UiLCJzaGFkb3dSZXNvbHV0aW9uIiwibWluIiwibWF4Q3ViZU1hcFNpemUiLCJtYXhUZXh0dXJlU2l6ZSIsInZzbUJsdXJTaXplIiwibm9ybWFsT2Zmc2V0QmlhcyIsImZhbGxvZmZNb2RlIiwiaW5uZXJDb25lQW5nbGUiLCJvdXRlckNvbmVBbmdsZSIsImFuZ2xlIiwicmFkQW5nbGUiLCJfb3V0ZXJDb25lQW5nbGVDb3MiLCJfb3V0ZXJDb25lQW5nbGVTaW4iLCJzaW4iLCJpbnRlbnNpdHkiLCJsdW1pbmFuY2UiLCJjb29raWVNYXRyaXgiLCJhdGxhc1ZpZXdwb3J0IiwiY29va2llIiwiY29va2llRmFsbG9mZiIsImNvb2tpZUNoYW5uZWwiLCJjaHIiLCJjaGFyQXQiLCJhZGRMZW4iLCJpIiwiY29va2llVHJhbnNmb3JtIiwiY29va2llT2Zmc2V0IiwiVmVjMiIsInhmb3JtTmV3Iiwic2V0IiwiYmVnaW5GcmFtZSIsImNhY2hlZCIsIlNIQURPV1VQREFURV9OT05FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsImdldFJlbmRlckRhdGEiLCJjdXJyZW50IiwicmQiLCJwdXNoIiwiY2xvbmUiLCJzZXRDb2xvciIsInNsaWNlIiwiZ2V0TGlnaHRVbml0Q29udmVyc2lvbiIsIm91dGVyQW5nbGUiLCJpbm5lckFuZ2xlIiwiZmFsbG9mZkVuZCIsImZhbGxvZmZTdGFydCIsIl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyIsImxpZ2h0UmVuZGVyRGF0YSIsImZhckNsaXAiLCJfZmFyQ2xpcCIsImV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMiLCJnZXRDb2xvciIsImdldEJvdW5kaW5nU3BoZXJlIiwic3BoZXJlIiwic2l6ZSIsImNvc0FuZ2xlIiwibm9kZSIsImNvcHkiLCJ1cCIsInJhZGl1cyIsIm11bFNjYWxhciIsImNlbnRlciIsImFkZDIiLCJnZXRQb3NpdGlvbiIsImdldEJvdW5kaW5nQm94IiwiYm94IiwicmFuZ2UiLCJzY2wiLCJhYnMiLCJtYXRoIiwiREVHX1RPX1JBRCIsImhhbGZFeHRlbnRzIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsImdldFdvcmxkVHJhbnNmb3JtIiwiY29sb3IiLCJmaW5hbENvbG9yIiwibGluZWFyRmluYWxDb2xvciIsImFyZ3VtZW50cyIsImxheWVycyIsIl9kaXJ0eUxpZ2h0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLE1BQU1BLE1BQU0sR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN6QixNQUFNQyxTQUFTLEdBQUc7QUFDZEMsRUFBQUEsSUFBSSxFQUFFLENBQUM7QUFDUEMsRUFBQUEsVUFBVSxFQUFFLENBQUE7QUFDaEIsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsTUFBTSxHQUFHO0FBQUVDLEVBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLEVBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLEVBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLEVBQUFBLENBQUMsRUFBRSxDQUFBO0FBQUUsQ0FBQyxDQUFBO0FBRXpDLE1BQU1DLFVBQVUsR0FBRztBQUNmLEVBQUEsYUFBYSxFQUFFQyxxQkFBcUI7QUFDcEMsRUFBQSxNQUFNLEVBQUVDLGNBQWM7QUFDdEIsRUFBQSxPQUFPLEVBQUVBLGNBQWM7QUFDdkIsRUFBQSxNQUFNLEVBQUVDLGNBQUFBO0FBQ1osRUFBQzs7QUFHRCxNQUFNQyxtQkFBbUIsR0FBRyxDQUN4QixDQUFDLElBQUlDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUN0QixDQUFDLElBQUlBLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJQSxJQUFJLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsRUFDdEQsQ0FBQyxJQUFJQSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSUEsSUFBSSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUlBLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUNsRixDQUFDLElBQUlBLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxJQUFJQSxJQUFJLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSUEsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUlBLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUNuSCxDQUFBO0FBRUQsSUFBSUMsRUFBRSxHQUFHLENBQUMsQ0FBQTs7QUFHVixNQUFNQyxlQUFlLENBQUM7RUFDbEJDLFdBQVcsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUVDLElBQUksRUFBRUMsS0FBSyxFQUFFO0lBR3JDLElBQUksQ0FBQ0EsS0FBSyxHQUFHQSxLQUFLLENBQUE7O0lBTWxCLElBQUksQ0FBQ0YsTUFBTSxHQUFHQSxNQUFNLENBQUE7O0FBR3BCLElBQUEsSUFBSSxDQUFDRyxZQUFZLEdBQUdDLGNBQWMsQ0FBQ0Msa0JB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
