/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { math } from '../math/math.js';
import { Color } from '../math/color.js';
import { Mat4 } from '../math/mat4.js';
import { Vec2 } from '../math/vec2.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';
import { LIGHTTYPE_DIRECTIONAL, MASK_AFFECT_DYNAMIC, LIGHTFALLOFF_LINEAR, SHADOW_PCF3, BLUR_GAUSSIAN, LIGHTSHAPE_PUNCTUAL, SHADOWUPDATE_REALTIME, LIGHTTYPE_OMNI, SHADOW_PCF5, SHADOW_VSM32, SHADOW_VSM16, SHADOW_VSM8, MASK_BAKE, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, LIGHTTYPE_SPOT } from './constants.js';
import { ShadowRenderer } from './renderer/shadow-renderer.js';

const spotCenter = new Vec3();
const spotEndPoint = new Vec3();
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
    this._outerConeAngleCos = Math.cos(this._outerConeAngle * Math.PI / 180);
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

    if (value === SHADOW_VSM32 && !device.textureFloatRenderable) value = SHADOW_VSM16;
    if (value === SHADOW_VSM16 && !device.textureHalfFloatRenderable) value = SHADOW_VSM8;
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
    this._outerConeAngleCos = Math.cos(value * Math.PI / 180);

    if (this._usePhysicalUnits) {
      this._updateFinalColor();
    }
  }

  get outerConeAngle() {
    return this._outerConeAngle;
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
      const range = this.attenuationEnd;
      const angle = this._outerConeAngle;
      const f = Math.cos(angle * math.DEG_TO_RAD);
      const node = this._node;
      spotCenter.copy(node.up);
      spotCenter.mulScalar(-range * 0.5 * f);
      spotCenter.add(node.getPosition());
      sphere.center = spotCenter;
      spotEndPoint.copy(node.up);
      spotEndPoint.mulScalar(-range);
      tmpVec.copy(node.right);
      tmpVec.mulScalar(Math.sin(angle * math.DEG_TO_RAD) * range);
      spotEndPoint.add(tmpVec);
      sphere.radius = spotEndPoint.length() * 0.5;
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
      switch (this._type) {
        case LIGHTTYPE_SPOT:
          {
            const falloffEnd = Math.cos(this._outerConeAngle * Math.PI / 180.0);
            const falloffStart = Math.cos(this._innerConeAngle * Math.PI / 180.0);
            i = this._luminance / (2 * Math.PI * (1 - falloffStart + (falloffStart - falloffEnd) / 2.0));
            break;
          }

        case LIGHTTYPE_OMNI:
          i = this._luminance / (4 * Math.PI);
          break;

        case LIGHTTYPE_DIRECTIONAL:
          i = this._luminance;
          break;
      }
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

export { Light };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9saWdodC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vbWF0aC9jb2xvci5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHtcbiAgICBCTFVSX0dBVVNTSUFOLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIE1BU0tfQkFLRSwgTUFTS19BRkZFQ1RfRFlOQU1JQyxcbiAgICBTSEFET1dfUENGMywgU0hBRE9XX1BDRjUsIFNIQURPV19WU004LCBTSEFET1dfVlNNMTYsIFNIQURPV19WU00zMixcbiAgICBTSEFET1dVUERBVEVfTk9ORSwgU0hBRE9XVVBEQVRFX1JFQUxUSU1FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FLFxuICAgIExJR0hUU0hBUEVfUFVOQ1RVQUwsIExJR0hURkFMTE9GRl9MSU5FQVJcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZG93UmVuZGVyZXIgfSBmcm9tICcuL3JlbmRlcmVyL3NoYWRvdy1yZW5kZXJlci5qcyc7XG5cbmNvbnN0IHNwb3RDZW50ZXIgPSBuZXcgVmVjMygpO1xuY29uc3Qgc3BvdEVuZFBvaW50ID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRtcFZlYyA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBCaWFzZXMgPSB7XG4gICAgYmlhczogMCxcbiAgICBub3JtYWxCaWFzOiAwXG59O1xuXG5jb25zdCBjaGFuSWQgPSB7IHI6IDAsIGc6IDEsIGI6IDIsIGE6IDMgfTtcblxuLy8gdmlld3BvcnQgaW4gc2hhZG93cyBtYXAgZm9yIGNhc2NhZGVzIGZvciBkaXJlY3Rpb25hbCBsaWdodFxuY29uc3QgZGlyZWN0aW9uYWxDYXNjYWRlcyA9IFtcbiAgICBbbmV3IFZlYzQoMCwgMCwgMSwgMSldLFxuICAgIFtuZXcgVmVjNCgwLCAwLCAwLjUsIDAuNSksIG5ldyBWZWM0KDAsIDAuNSwgMC41LCAwLjUpXSxcbiAgICBbbmV3IFZlYzQoMCwgMCwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLCAwLjUsIDAuNSwgMC41KSwgbmV3IFZlYzQoMC41LCAwLCAwLjUsIDAuNSldLFxuICAgIFtuZXcgVmVjNCgwLCAwLCAwLjUsIDAuNSksIG5ldyBWZWM0KDAsIDAuNSwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLjUsIDAsIDAuNSwgMC41KSwgbmV3IFZlYzQoMC41LCAwLjUsIDAuNSwgMC41KV1cbl07XG5cbmxldCBpZCA9IDA7XG5cbi8vIENsYXNzIHN0b3Jpbmcgc2hhZG93IHJlbmRlcmluZyByZWxhdGVkIHByaXZhdGUgaW5mb3JtYXRpb25cbmNsYXNzIExpZ2h0UmVuZGVyRGF0YSB7XG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBjYW1lcmEsIGZhY2UsIGxpZ2h0KSB7XG5cbiAgICAgICAgLy8gbGlnaHQgdGhpcyBkYXRhIGJlbG9uZ3MgdG9cbiAgICAgICAgdGhpcy5saWdodCA9IGxpZ2h0O1xuXG4gICAgICAgIC8vIGNhbWVyYSB0aGlzIGFwcGxpZXMgdG8uIE9ubHkgdXNlZCBieSBkaXJlY3Rpb25hbCBsaWdodCwgYXMgZGlyZWN0aW9uYWwgc2hhZG93IG1hcFxuICAgICAgICAvLyBpcyBjdWxsZWQgYW5kIHJlbmRlcmVkIGZvciBlYWNoIGNhbWVyYS4gTG9jYWwgbGlnaHRzJyBzaGFkb3cgaXMgY3VsbGVkIGFuZCByZW5kZXJlZCBvbmUgdGltZVxuICAgICAgICAvLyBhbmQgc2hhcmVkIGJldHdlZW4gY2FtZXJhcyAoZXZlbiB0aG91Z2ggaXQncyBub3Qgc3RyaWN0bHkgY29ycmVjdCBhbmQgd2UgY2FuIGdldCBzaGFkb3dzXG4gICAgICAgIC8vIGZyb20gYSBtZXNoIHRoYXQgaXMgbm90IHZpc2libGUgYnkgdGhlIGNhbWVyYSlcbiAgICAgICAgdGhpcy5jYW1lcmEgPSBjYW1lcmE7XG5cbiAgICAgICAgLy8gY2FtZXJhIHVzZWQgdG8gY3VsbCAvIHJlbmRlciB0aGUgc2hhZG93IG1hcFxuICAgICAgICB0aGlzLnNoYWRvd0NhbWVyYSA9IFNoYWRvd1JlbmRlcmVyLmNyZWF0ZVNoYWRvd0NhbWVyYShkZXZpY2UsIGxpZ2h0Ll9zaGFkb3dUeXBlLCBsaWdodC5fdHlwZSwgZmFjZSk7XG5cbiAgICAgICAgLy8gc2hhZG93IHZpZXctcHJvamVjdGlvbiBtYXRyaXhcbiAgICAgICAgdGhpcy5zaGFkb3dNYXRyaXggPSBuZXcgTWF0NCgpO1xuXG4gICAgICAgIC8vIHZpZXdwb3J0IGZvciB0aGUgc2hhZG93IHJlbmRlcmluZyB0byB0aGUgdGV4dHVyZSAoeCwgeSwgd2lkdGgsIGhlaWdodClcbiAgICAgICAgdGhpcy5zaGFkb3dWaWV3cG9ydCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuXG4gICAgICAgIC8vIHNjaXNzb3IgcmVjdGFuZ2xlIGZvciB0aGUgc2hhZG93IHJlbmRlcmluZyB0byB0aGUgdGV4dHVyZSAoeCwgeSwgd2lkdGgsIGhlaWdodClcbiAgICAgICAgdGhpcy5zaGFkb3dTY2lzc29yID0gbmV3IFZlYzQoMCwgMCwgMSwgMSk7XG5cbiAgICAgICAgLy8gZmFjZSBpbmRleCwgdmFsdWUgaXMgYmFzZWQgb24gbGlnaHQgdHlwZTpcbiAgICAgICAgLy8gLSBzcG90OiBhbHdheXMgMFxuICAgICAgICAvLyAtIG9tbmk6IGN1YmVtYXAgZmFjZSwgMC4uNVxuICAgICAgICAvLyAtIGRpcmVjdGlvbmFsOiAwIGZvciBzaW1wbGUgc2hhZG93cywgY2FzY2FkZSBpbmRleCBmb3IgY2FzY2FkZWQgc2hhZG93IG1hcFxuICAgICAgICB0aGlzLmZhY2UgPSBmYWNlO1xuXG4gICAgICAgIC8vIHZpc2libGUgc2hhZG93IGNhc3RlcnNcbiAgICAgICAgdGhpcy52aXNpYmxlQ2FzdGVycyA9IFtdO1xuICAgIH1cblxuICAgIC8vIHJldHVybnMgc2hhZG93IGJ1ZmZlciBjdXJyZW50bHkgYXR0YWNoZWQgdG8gdGhlIHNoYWRvdyBjYW1lcmFcbiAgICBnZXQgc2hhZG93QnVmZmVyKCkge1xuICAgICAgICBjb25zdCBydCA9IHRoaXMuc2hhZG93Q2FtZXJhLnJlbmRlclRhcmdldDtcbiAgICAgICAgaWYgKHJ0KSB7XG4gICAgICAgICAgICBjb25zdCBsaWdodCA9IHRoaXMubGlnaHQ7XG4gICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJ0LmNvbG9yQnVmZmVyO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbGlnaHQuX2lzUGNmICYmIGxpZ2h0LmRldmljZS53ZWJnbDIgPyBydC5kZXB0aEJ1ZmZlciA6IHJ0LmNvbG9yQnVmZmVyO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEEgbGlnaHQuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBMaWdodCB7XG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgdGhpcy5pZCA9IGlkKys7XG5cbiAgICAgICAgLy8gTGlnaHQgcHJvcGVydGllcyAoZGVmYXVsdHMpXG4gICAgICAgIHRoaXMuX3R5cGUgPSBMSUdIVFRZUEVfRElSRUNUSU9OQUw7XG4gICAgICAgIHRoaXMuX2NvbG9yID0gbmV3IENvbG9yKDAuOCwgMC44LCAwLjgpO1xuICAgICAgICB0aGlzLl9pbnRlbnNpdHkgPSAxO1xuICAgICAgICB0aGlzLl9sdW1pbmFuY2UgPSAwO1xuICAgICAgICB0aGlzLl9jYXN0U2hhZG93cyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMubWFzayA9IE1BU0tfQUZGRUNUX0RZTkFNSUM7XG4gICAgICAgIHRoaXMuaXNTdGF0aWMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5rZXkgPSAwO1xuICAgICAgICB0aGlzLmJha2VEaXIgPSB0cnVlO1xuICAgICAgICB0aGlzLmJha2VOdW1TYW1wbGVzID0gMTtcbiAgICAgICAgdGhpcy5iYWtlQXJlYSA9IDA7XG5cbiAgICAgICAgLy8gT21uaSBhbmQgc3BvdCBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuYXR0ZW51YXRpb25TdGFydCA9IDEwO1xuICAgICAgICB0aGlzLmF0dGVudWF0aW9uRW5kID0gMTA7XG4gICAgICAgIHRoaXMuX2ZhbGxvZmZNb2RlID0gTElHSFRGQUxMT0ZGX0xJTkVBUjtcbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IFNIQURPV19QQ0YzO1xuICAgICAgICB0aGlzLl92c21CbHVyU2l6ZSA9IDExO1xuICAgICAgICB0aGlzLnZzbUJsdXJNb2RlID0gQkxVUl9HQVVTU0lBTjtcbiAgICAgICAgdGhpcy52c21CaWFzID0gMC4wMSAqIDAuMjU7XG4gICAgICAgIHRoaXMuX2Nvb2tpZSA9IG51bGw7IC8vIGxpZ2h0IGNvb2tpZSB0ZXh0dXJlICgyRCBmb3Igc3BvdCwgY3ViZW1hcCBmb3Igb21uaSlcbiAgICAgICAgdGhpcy5jb29raWVJbnRlbnNpdHkgPSAxO1xuICAgICAgICB0aGlzLl9jb29raWVGYWxsb2ZmID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY29va2llQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICB0aGlzLl9jb29raWVUcmFuc2Zvcm0gPSBudWxsOyAvLyAyZCByb3RhdGlvbi9zY2FsZSBtYXRyaXggKHNwb3Qgb25seSlcbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldCA9IG51bGw7IC8vIDJkIHBvc2l0aW9uIG9mZnNldCAoc3BvdCBvbmx5KVxuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXRVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtU2V0ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldFNldCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIFNwb3QgcHJvcGVydGllc1xuICAgICAgICB0aGlzLl9pbm5lckNvbmVBbmdsZSA9IDQwO1xuICAgICAgICB0aGlzLl9vdXRlckNvbmVBbmdsZSA9IDQ1O1xuXG4gICAgICAgIC8vIERpcmVjdGlvbmFsIHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5jYXNjYWRlcyA9IG51bGw7ICAgICAgICAgICAgICAgLy8gYW4gYXJyYXkgb2YgVmVjNCB2aWV3cG9ydHMgcGVyIGNhc2NhZGVcbiAgICAgICAgdGhpcy5fc2hhZG93TWF0cml4UGFsZXR0ZSA9IG51bGw7ICAgLy8gYSBmbG9hdCBhcnJheSwgMTYgZmxvYXRzIHBlciBjYXNjYWRlXG4gICAgICAgIHRoaXMuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMgPSBudWxsO1xuICAgICAgICB0aGlzLm51bUNhc2NhZGVzID0gMTtcbiAgICAgICAgdGhpcy5jYXNjYWRlRGlzdHJpYnV0aW9uID0gMC41O1xuXG4gICAgICAgIC8vIExpZ2h0IHNvdXJjZSBzaGFwZSBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuX3NoYXBlID0gTElHSFRTSEFQRV9QVU5DVFVBTDtcblxuICAgICAgICAvLyBDYWNoZSBvZiBsaWdodCBwcm9wZXJ0eSBkYXRhIGluIGEgZm9ybWF0IG1vcmUgZnJpZW5kbHkgZm9yIHNoYWRlciB1bmlmb3Jtc1xuICAgICAgICB0aGlzLl9maW5hbENvbG9yID0gbmV3IEZsb2F0MzJBcnJheShbMC44LCAwLjgsIDAuOF0pO1xuICAgICAgICBjb25zdCBjID0gTWF0aC5wb3codGhpcy5fZmluYWxDb2xvclswXSwgMi4yKTtcbiAgICAgICAgdGhpcy5fbGluZWFyRmluYWxDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoW2MsIGMsIGNdKTtcblxuICAgICAgICB0aGlzLl9wb3NpdGlvbiA9IG5ldyBWZWMzKDAsIDAsIDApO1xuICAgICAgICB0aGlzLl9kaXJlY3Rpb24gPSBuZXcgVmVjMygwLCAwLCAwKTtcbiAgICAgICAgdGhpcy5faW5uZXJDb25lQW5nbGVDb3MgPSBNYXRoLmNvcyh0aGlzLl9pbm5lckNvbmVBbmdsZSAqIE1hdGguUEkgLyAxODApO1xuICAgICAgICB0aGlzLl9vdXRlckNvbmVBbmdsZUNvcyA9IE1hdGguY29zKHRoaXMuX291dGVyQ29uZUFuZ2xlICogTWF0aC5QSSAvIDE4MCk7XG5cbiAgICAgICAgdGhpcy5fdXNlUGh5c2ljYWxVbml0cyA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBTaGFkb3cgbWFwcGluZyByZXNvdXJjZXNcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyUGFyYW1zID0gW107XG5cbiAgICAgICAgLy8gU2hhZG93IG1hcHBpbmcgcHJvcGVydGllc1xuICAgICAgICB0aGlzLnNoYWRvd0Rpc3RhbmNlID0gNDA7XG4gICAgICAgIHRoaXMuX3NoYWRvd1Jlc29sdXRpb24gPSAxMDI0O1xuICAgICAgICB0aGlzLnNoYWRvd0JpYXMgPSAtMC4wMDA1O1xuICAgICAgICB0aGlzLnNoYWRvd0ludGVuc2l0eSA9IDEuMDtcbiAgICAgICAgdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcyA9IDAuMDtcbiAgICAgICAgdGhpcy5zaGFkb3dVcGRhdGVNb2RlID0gU0hBRE9XVVBEQVRFX1JFQUxUSU1FO1xuICAgICAgICB0aGlzLl9pc1ZzbSA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1BjZiA9IHRydWU7XG5cbiAgICAgICAgLy8gY29va2llIG1hdHJpeCAodXNlZCBpbiBjYXNlIHRoZSBzaGFkb3cgbWFwcGluZyBpcyBkaXNhYmxlZCBhbmQgc28gdGhlIHNoYWRvdyBtYXRyaXggY2Fubm90IGJlIHVzZWQpXG4gICAgICAgIHRoaXMuX2Nvb2tpZU1hdHJpeCA9IG51bGw7XG5cbiAgICAgICAgLy8gdmlld3BvcnQgb2YgdGhlIGNvb2tpZSB0ZXh0dXJlIC8gc2hhZG93IGluIHRoZSBhdGxhc1xuICAgICAgICB0aGlzLl9hdGxhc1ZpZXdwb3J0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5hdGxhc1ZpZXdwb3J0QWxsb2NhdGVkID0gZmFsc2U7ICAgIC8vIGlmIHRydWUsIGF0bGFzIHNsb3QgaXMgYWxsb2NhdGVkIGZvciB0aGUgY3VycmVudCBmcmFtZVxuICAgICAgICB0aGlzLmF0bGFzVmVyc2lvbiA9IDA7ICAgICAgLy8gdmVyc2lvbiBvZiB0aGUgYXRsYXMgZm9yIHRoZSBhbGxvY2F0ZWQgc2xvdCwgYWxsb3dzIGludmFsaWRhdGlvbiB3aGVuIGF0bGFzIHJlY3JlYXRlcyBzbG90c1xuICAgICAgICB0aGlzLmF0bGFzU2xvdEluZGV4ID0gMDsgICAgLy8gYWxsb2NhdGVkIHNsb3QgaW5kZXgsIHVzZWQgZm9yIG1vcmUgcGVyc2lzdGVudCBzbG90IGFsbG9jYXRpb25cbiAgICAgICAgdGhpcy5hdGxhc1Nsb3RVcGRhdGVkID0gZmFsc2U7ICAvLyB0cnVlIGlmIHRoZSBhdGxhcyBzbG90IHdhcyByZWFzc2lnbmVkIHRoaXMgZnJhbWUgKGFuZCBjb250ZW50IG5lZWRzIHRvIGJlIHVwZGF0ZWQpXG5cbiAgICAgICAgdGhpcy5fc2NlbmUgPSBudWxsO1xuICAgICAgICB0aGlzLl9ub2RlID0gbnVsbDtcblxuICAgICAgICAvLyBwcml2YXRlIHJlbmRlcmluZyBkYXRhXG4gICAgICAgIHRoaXMuX3JlbmRlckRhdGEgPSBbXTtcblxuICAgICAgICAvLyB0cnVlIGlmIHRoZSBsaWdodCBpcyB2aXNpYmxlIGJ5IGFueSBjYW1lcmEgd2l0aGluIGEgZnJhbWVcbiAgICAgICAgdGhpcy52aXNpYmxlVGhpc0ZyYW1lID0gZmFsc2U7XG5cbiAgICAgICAgLy8gbWF4aW11bSBzaXplIG9mIHRoZSBsaWdodCBib3VuZGluZyBzcGhlcmUgb24gdGhlIHNjcmVlbiBieSBhbnkgY2FtZXJhIHdpdGhpbiBhIGZyYW1lXG4gICAgICAgIC8vICh1c2VkIHRvIGVzdGltYXRlIHNoYWRvdyByZXNvbHV0aW9uKSwgcmFuZ2UgWzAuLjFdXG4gICAgICAgIHRoaXMubWF4U2NyZWVuU2l6ZSA9IDA7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICB0aGlzLl9yZW5kZXJEYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICBzZXQgbnVtQ2FzY2FkZXModmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLmNhc2NhZGVzIHx8IHRoaXMubnVtQ2FzY2FkZXMgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLmNhc2NhZGVzID0gZGlyZWN0aW9uYWxDYXNjYWRlc1t2YWx1ZSAtIDFdO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93TWF0cml4UGFsZXR0ZSA9IG5ldyBGbG9hdDMyQXJyYXkoNCAqIDE2KTsgICAvLyBhbHdheXMgNFxuICAgICAgICAgICAgdGhpcy5fc2hhZG93Q2FzY2FkZURpc3RhbmNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7ICAgICAvLyBhbHdheXMgNFxuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBudW1DYXNjYWRlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2FzY2FkZXMubGVuZ3RoO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dNYXAoc2hhZG93TWFwKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dNYXAgIT09IHNoYWRvd01hcCkge1xuICAgICAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93TWFwID0gc2hhZG93TWFwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRvd01hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd01hcDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIG51bWJlciBvZiByZW5kZXIgdGFyZ2V0cyB0byByZW5kZXIgdGhlIHNoYWRvdyBtYXBcbiAgICBnZXQgbnVtU2hhZG93RmFjZXMoKSB7XG4gICAgICAgIGNvbnN0IHR5cGUgPSB0aGlzLl90eXBlO1xuICAgICAgICBpZiAodHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5udW1DYXNjYWRlcztcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgcmV0dXJuIDY7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gMTtcbiAgICB9XG5cbiAgICBzZXQgdHlwZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fdHlwZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgY29uc3Qgc3R5cGUgPSB0aGlzLl9zaGFkb3dUeXBlO1xuICAgICAgICB0aGlzLl9zaGFkb3dUeXBlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zaGFkb3dUeXBlID0gc3R5cGU7IC8vIHJlZnJlc2ggc2hhZG93IHR5cGU7IHN3aXRjaGluZyBmcm9tIGRpcmVjdC9zcG90IHRvIG9tbmkgYW5kIGJhY2sgbWF5IGNoYW5nZSBpdFxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICBzZXQgc2hhcGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3NoYXBlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9zaGFwZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgY29uc3Qgc3R5cGUgPSB0aGlzLl9zaGFkb3dUeXBlO1xuICAgICAgICB0aGlzLl9zaGFkb3dUeXBlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zaGFkb3dUeXBlID0gc3R5cGU7IC8vIHJlZnJlc2ggc2hhZG93IHR5cGU7IHN3aXRjaGluZyBzaGFwZSBhbmQgYmFjayBtYXkgY2hhbmdlIGl0XG4gICAgfVxuXG4gICAgZ2V0IHNoYXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2hhcGU7XG4gICAgfVxuXG4gICAgc2V0IHVzZVBoeXNpY2FsVW5pdHModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl91c2VQaHlzaWNhbFVuaXRzID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdXNlUGh5c2ljYWxVbml0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VzZVBoeXNpY2FsVW5pdHM7XG4gICAgfVxuXG4gICAgc2V0IHNoYWRvd1R5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3NoYWRvd1R5cGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSlcbiAgICAgICAgICAgIHZhbHVlID0gU0hBRE9XX1BDRjM7IC8vIFZTTSBvciBIVyBQQ0YgZm9yIG9tbmkgbGlnaHRzIGlzIG5vdCBzdXBwb3J0ZWQgeWV0XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSBTSEFET1dfUENGNSAmJiAhZGV2aWNlLndlYmdsMikge1xuICAgICAgICAgICAgdmFsdWUgPSBTSEFET1dfUENGMzsgLy8gZmFsbGJhY2sgZnJvbSBIVyBQQ0YgdG8gb2xkIFBDRlxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSBTSEFET1dfVlNNMzIgJiYgIWRldmljZS50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlKSAvLyBmYWxsYmFjayBmcm9tIHZzbTMyIHRvIHZzbTE2XG4gICAgICAgICAgICB2YWx1ZSA9IFNIQURPV19WU00xNjtcblxuICAgICAgICBpZiAodmFsdWUgPT09IFNIQURPV19WU00xNiAmJiAhZGV2aWNlLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlKSAvLyBmYWxsYmFjayBmcm9tIHZzbTE2IHRvIHZzbThcbiAgICAgICAgICAgIHZhbHVlID0gU0hBRE9XX1ZTTTg7XG5cbiAgICAgICAgdGhpcy5faXNWc20gPSB2YWx1ZSA+PSBTSEFET1dfVlNNOCAmJiB2YWx1ZSA8PSBTSEFET1dfVlNNMzI7XG4gICAgICAgIHRoaXMuX2lzUGNmID0gdmFsdWUgPT09IFNIQURPV19QQ0Y1IHx8IHZhbHVlID09PSBTSEFET1dfUENGMztcblxuICAgICAgICB0aGlzLl9zaGFkb3dUeXBlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgc2hhZG93VHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd1R5cGU7XG4gICAgfVxuXG4gICAgc2V0IGVuYWJsZWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZWQgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLmxheWVyc0RpcnR5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG4gICAgfVxuXG4gICAgc2V0IGNhc3RTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jYXN0U2hhZG93cyAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nhc3RTaGFkb3dzID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgICAgICB0aGlzLmxheWVyc0RpcnR5KCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FzdFNoYWRvd3MgJiYgdGhpcy5tYXNrICE9PSBNQVNLX0JBS0UgJiYgdGhpcy5tYXNrICE9PSAwO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dSZXNvbHV0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dSZXNvbHV0aW9uICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBNYXRoLm1pbih2YWx1ZSwgdGhpcy5kZXZpY2UubWF4Q3ViZU1hcFNpemUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IE1hdGgubWluKHZhbHVlLCB0aGlzLmRldmljZS5tYXhUZXh0dXJlU2l6ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2hhZG93UmVzb2x1dGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgfVxuXG4gICAgc2V0IHZzbUJsdXJTaXplKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl92c21CbHVyU2l6ZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHZhbHVlICUgMiA9PT0gMCkgdmFsdWUrKzsgLy8gZG9uJ3QgYWxsb3cgZXZlbiBzaXplXG4gICAgICAgIHRoaXMuX3ZzbUJsdXJTaXplID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHZzbUJsdXJTaXplKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdnNtQmx1clNpemU7XG4gICAgfVxuXG4gICAgc2V0IG5vcm1hbE9mZnNldEJpYXModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX25vcm1hbE9mZnNldEJpYXMgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICgoIXRoaXMuX25vcm1hbE9mZnNldEJpYXMgJiYgdmFsdWUpIHx8ICh0aGlzLl9ub3JtYWxPZmZzZXRCaWFzICYmICF2YWx1ZSkpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBub3JtYWxPZmZzZXRCaWFzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICB9XG5cbiAgICBzZXQgZmFsbG9mZk1vZGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZhbGxvZmZNb2RlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mYWxsb2ZmTW9kZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBmYWxsb2ZmTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZhbGxvZmZNb2RlO1xuICAgIH1cblxuICAgIHNldCBpbm5lckNvbmVBbmdsZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5faW5uZXJDb25lQW5nbGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3ModmFsdWUgKiBNYXRoLlBJIC8gMTgwKTtcbiAgICAgICAgaWYgKHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpbm5lckNvbmVBbmdsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lubmVyQ29uZUFuZ2xlO1xuICAgIH1cblxuICAgIHNldCBvdXRlckNvbmVBbmdsZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fb3V0ZXJDb25lQW5nbGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3ModmFsdWUgKiBNYXRoLlBJIC8gMTgwKTtcbiAgICAgICAgaWYgKHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBvdXRlckNvbmVBbmdsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX291dGVyQ29uZUFuZ2xlO1xuICAgIH1cblxuICAgIHNldCBpbnRlbnNpdHkodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ludGVuc2l0eSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2ludGVuc2l0eSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlRmluYWxDb2xvcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGludGVuc2l0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ludGVuc2l0eTtcbiAgICB9XG5cbiAgICBzZXQgbHVtaW5hbmNlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9sdW1pbmFuY2UgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9sdW1pbmFuY2UgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsdW1pbmFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sdW1pbmFuY2U7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZU1hdHJpeCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb29raWVNYXRyaXgpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZU1hdHJpeDtcbiAgICB9XG5cbiAgICBnZXQgYXRsYXNWaWV3cG9ydCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hdGxhc1ZpZXdwb3J0KSB7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1ZpZXdwb3J0ID0gbmV3IFZlYzQoMCwgMCwgMSwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2F0bGFzVmlld3BvcnQ7XG4gICAgfVxuXG4gICAgc2V0IGNvb2tpZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jb29raWUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llO1xuICAgIH1cblxuICAgIHNldCBjb29raWVGYWxsb2ZmKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVGYWxsb2ZmID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jb29raWVGYWxsb2ZmID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZUZhbGxvZmYoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVGYWxsb2ZmO1xuICAgIH1cblxuICAgIHNldCBjb29raWVDaGFubmVsKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVDaGFubmVsID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodmFsdWUubGVuZ3RoIDwgMykge1xuICAgICAgICAgICAgY29uc3QgY2hyID0gdmFsdWUuY2hhckF0KHZhbHVlLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgY29uc3QgYWRkTGVuID0gMyAtIHZhbHVlLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWRkTGVuOyBpKyspXG4gICAgICAgICAgICAgICAgdmFsdWUgKz0gY2hyO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2Nvb2tpZUNoYW5uZWwgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llQ2hhbm5lbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZUNoYW5uZWw7XG4gICAgfVxuXG4gICAgc2V0IGNvb2tpZVRyYW5zZm9ybSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llVHJhbnNmb3JtID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jb29raWVUcmFuc2Zvcm0gPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtU2V0ID0gISF2YWx1ZTtcbiAgICAgICAgaWYgKHZhbHVlICYmICF0aGlzLl9jb29raWVPZmZzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuY29va2llT2Zmc2V0ID0gbmV3IFZlYzIoKTsgLy8gdXNpbmcgdHJhbnNmb3JtIGZvcmNlcyB1c2luZyBvZmZzZXQgY29kZVxuICAgICAgICAgICAgdGhpcy5fY29va2llT2Zmc2V0U2V0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llVHJhbnNmb3JtKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIHNldCBjb29raWVPZmZzZXQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZU9mZnNldCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgY29uc3QgeGZvcm1OZXcgPSAhISh0aGlzLl9jb29raWVUcmFuc2Zvcm1TZXQgfHwgdmFsdWUpO1xuICAgICAgICBpZiAoeGZvcm1OZXcgJiYgIXZhbHVlICYmIHRoaXMuX2Nvb2tpZU9mZnNldCkge1xuICAgICAgICAgICAgdGhpcy5fY29va2llT2Zmc2V0LnNldCgwLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldFNldCA9ICEhdmFsdWU7XG4gICAgICAgIGlmICh2YWx1ZSAmJiAhdGhpcy5fY29va2llVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICB0aGlzLmNvb2tpZVRyYW5zZm9ybSA9IG5ldyBWZWM0KDEsIDEsIDAsIDApOyAvLyB1c2luZyBvZmZzZXQgZm9yY2VzIHVzaW5nIG1hdHJpeCBjb2RlXG4gICAgICAgICAgICB0aGlzLl9jb29raWVUcmFuc2Zvcm1TZXQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBjb29raWVPZmZzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVPZmZzZXQ7XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZXMgbGlnaHQgZm9yIHRoZSBmcmFtZSByZW5kZXJpbmdcbiAgICBiZWdpbkZyYW1lKCkge1xuICAgICAgICB0aGlzLnZpc2libGVUaGlzRnJhbWUgPSB0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgJiYgdGhpcy5fZW5hYmxlZDtcbiAgICAgICAgdGhpcy5tYXhTY3JlZW5TaXplID0gMDtcbiAgICAgICAgdGhpcy5hdGxhc1ZpZXdwb3J0QWxsb2NhdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYXRsYXNTbG90VXBkYXRlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIGRlc3Ryb3lzIHNoYWRvdyBtYXAgcmVsYXRlZCByZXNvdXJjZXMsIGNhbGxlZCB3aGVuIHNoYWRvdyBwcm9wZXJ0aWVzIGNoYW5nZSBhbmQgcmVzb3VyY2VzXG4gICAgLy8gbmVlZCB0byBiZSByZWNyZWF0ZWRcbiAgICBfZGVzdHJveVNoYWRvd01hcCgpIHtcblxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyRGF0YSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyRGF0YS5sZW5ndGggPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3NoYWRvd01hcCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9zaGFkb3dNYXAuY2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93TWFwLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hcCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVNb2RlID09PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dVcGRhdGVNb2RlID0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJldHVybnMgTGlnaHRSZW5kZXJEYXRhIHdpdGggbWF0Y2hpbmcgY2FtZXJhIGFuZCBmYWNlXG4gICAgZ2V0UmVuZGVyRGF0YShjYW1lcmEsIGZhY2UpIHtcblxuICAgICAgICAvLyByZXR1cm5zIGV4aXN0aW5nXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fcmVuZGVyRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IHRoaXMuX3JlbmRlckRhdGFbaV07XG4gICAgICAgICAgICBpZiAoY3VycmVudC5jYW1lcmEgPT09IGNhbWVyYSAmJiBjdXJyZW50LmZhY2UgPT09IGZhY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VycmVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBuZXcgb25lXG4gICAgICAgIGNvbnN0IHJkID0gbmV3IExpZ2h0UmVuZGVyRGF0YSh0aGlzLmRldmljZSwgY2FtZXJhLCBmYWNlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyRGF0YS5wdXNoKHJkKTtcbiAgICAgICAgcmV0dXJuIHJkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIER1cGxpY2F0ZXMgYSBsaWdodCBub2RlIGJ1dCBkb2VzIG5vdCAnZGVlcCBjb3B5JyB0aGUgaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge0xpZ2h0fSBBIGNsb25lZCBMaWdodC5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgY29uc3QgY2xvbmUgPSBuZXcgTGlnaHQodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIC8vIENsb25lIExpZ2h0IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUudHlwZSA9IHRoaXMuX3R5cGU7XG4gICAgICAgIGNsb25lLnNldENvbG9yKHRoaXMuX2NvbG9yKTtcbiAgICAgICAgY2xvbmUuaW50ZW5zaXR5ID0gdGhpcy5faW50ZW5zaXR5O1xuICAgICAgICBjbG9uZS5sdW1pbmFuY2UgPSB0aGlzLl9sdW1pbmFuY2U7XG4gICAgICAgIGNsb25lLmNhc3RTaGFkb3dzID0gdGhpcy5jYXN0U2hhZG93cztcbiAgICAgICAgY2xvbmUuX2VuYWJsZWQgPSB0aGlzLl9lbmFibGVkO1xuXG4gICAgICAgIC8vIE9tbmkgYW5kIHNwb3QgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5hdHRlbnVhdGlvblN0YXJ0ID0gdGhpcy5hdHRlbnVhdGlvblN0YXJ0O1xuICAgICAgICBjbG9uZS5hdHRlbnVhdGlvbkVuZCA9IHRoaXMuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgIGNsb25lLmZhbGxvZmZNb2RlID0gdGhpcy5fZmFsbG9mZk1vZGU7XG4gICAgICAgIGNsb25lLnNoYWRvd1R5cGUgPSB0aGlzLl9zaGFkb3dUeXBlO1xuICAgICAgICBjbG9uZS52c21CbHVyU2l6ZSA9IHRoaXMuX3ZzbUJsdXJTaXplO1xuICAgICAgICBjbG9uZS52c21CbHVyTW9kZSA9IHRoaXMudnNtQmx1ck1vZGU7XG4gICAgICAgIGNsb25lLnZzbUJpYXMgPSB0aGlzLnZzbUJpYXM7XG4gICAgICAgIGNsb25lLnNoYWRvd1VwZGF0ZU1vZGUgPSB0aGlzLnNoYWRvd1VwZGF0ZU1vZGU7XG4gICAgICAgIGNsb25lLm1hc2sgPSB0aGlzLm1hc2s7XG5cbiAgICAgICAgLy8gU3BvdCBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLmlubmVyQ29uZUFuZ2xlID0gdGhpcy5faW5uZXJDb25lQW5nbGU7XG4gICAgICAgIGNsb25lLm91dGVyQ29uZUFuZ2xlID0gdGhpcy5fb3V0ZXJDb25lQW5nbGU7XG5cbiAgICAgICAgLy8gRGlyZWN0aW9uYWwgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5udW1DYXNjYWRlcyA9IHRoaXMubnVtQ2FzY2FkZXM7XG4gICAgICAgIGNsb25lLmNhc2NhZGVEaXN0cmlidXRpb24gPSB0aGlzLmNhc2NhZGVEaXN0cmlidXRpb247XG5cbiAgICAgICAgLy8gc2hhcGUgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5zaGFwZSA9IHRoaXMuX3NoYXBlO1xuXG4gICAgICAgIC8vIFNoYWRvdyBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLnNoYWRvd0JpYXMgPSB0aGlzLnNoYWRvd0JpYXM7XG4gICAgICAgIGNsb25lLm5vcm1hbE9mZnNldEJpYXMgPSB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzO1xuICAgICAgICBjbG9uZS5zaGFkb3dSZXNvbHV0aW9uID0gdGhpcy5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgY2xvbmUuc2hhZG93RGlzdGFuY2UgPSB0aGlzLnNoYWRvd0Rpc3RhbmNlO1xuICAgICAgICBjbG9uZS5zaGFkb3dJbnRlbnNpdHkgPSB0aGlzLnNoYWRvd0ludGVuc2l0eTtcblxuICAgICAgICAvLyBDb29raWVzIHByb3BlcnRpZXNcbiAgICAgICAgLy8gY2xvbmUuY29va2llID0gdGhpcy5fY29va2llO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVJbnRlbnNpdHkgPSB0aGlzLmNvb2tpZUludGVuc2l0eTtcbiAgICAgICAgLy8gY2xvbmUuY29va2llRmFsbG9mZiA9IHRoaXMuX2Nvb2tpZUZhbGxvZmY7XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZUNoYW5uZWwgPSB0aGlzLl9jb29raWVDaGFubmVsO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVUcmFuc2Zvcm0gPSB0aGlzLl9jb29raWVUcmFuc2Zvcm07XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZU9mZnNldCA9IHRoaXMuX2Nvb2tpZU9mZnNldDtcblxuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyB0aGUgYmlhcyAoLngpIGFuZCBub3JtYWxCaWFzICgueSkgdmFsdWUgZm9yIGxpZ2h0cyBhcyBwYXNzZWQgdG8gc2hhZGVycyBieSB1bmlmb3Jtc1xuICAgIC8vIE5vdGU6IHRoaXMgbmVlZHMgdG8gYmUgcmV2aXNpdGVkIGFuZCBzaW1wbGlmaWVkXG4gICAgLy8gTm90ZTogdnNtQmlhcyBpcyBub3QgdXNlZCBhdCBhbGwgZm9yIG9tbmkgbGlnaHQsIGV2ZW4gdGhvdWdoIGl0IGlzIGVkaXRhYmxlIGluIHRoZSBFZGl0b3JcbiAgICBfZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKSB7XG5cbiAgICAgICAgY29uc3QgZmFyQ2xpcCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEuX2ZhckNsaXA7XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9PTU5JOlxuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gdGhpcy5zaGFkb3dCaWFzO1xuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5ub3JtYWxCaWFzID0gdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgTElHSFRUWVBFX1NQT1Q6XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzVnNtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gLTAuMDAwMDEgKiAyMDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9IHRoaXMuc2hhZG93QmlhcyAqIDIwOyAvLyBhcHByb3ggcmVtYXAgZnJvbSBvbGQgYmlhcyB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRldmljZS53ZWJnbDIgJiYgdGhpcy5kZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykgdG1wQmlhc2VzLmJpYXMgKj0gLTEwMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdG1wQmlhc2VzLm5vcm1hbEJpYXMgPSB0aGlzLl9pc1ZzbSA/IHRoaXMudnNtQmlhcyAvICh0aGlzLmF0dGVudWF0aW9uRW5kIC8gNy4wKSA6IHRoaXMuX25vcm1hbE9mZnNldEJpYXM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9ESVJFQ1RJT05BTDpcbiAgICAgICAgICAgICAgICAvLyBtYWtlIGJpYXMgZGVwZW5kZW50IG9uIGZhciBwbGFuZSBiZWNhdXNlIGl0J3Mgbm90IGNvbnN0YW50IGZvciBkaXJlY3QgbGlnaHRcbiAgICAgICAgICAgICAgICAvLyBjbGlwIGRpc3RhbmNlIHVzZWQgaXMgYmFzZWQgb24gdGhlIG5lYXJlc3Qgc2hhZG93IGNhc2NhZGVcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNWc20pIHtcbiAgICAgICAgICAgICAgICAgICAgdG1wQmlhc2VzLmJpYXMgPSAtMC4wMDAwMSAqIDIwO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gKHRoaXMuc2hhZG93QmlhcyAvIGZhckNsaXApICogMTAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGV2aWNlLndlYmdsMiAmJiB0aGlzLmRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB0bXBCaWFzZXMuYmlhcyAqPSAtMTAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0bXBCaWFzZXMubm9ybWFsQmlhcyA9IHRoaXMuX2lzVnNtID8gdGhpcy52c21CaWFzIC8gKGZhckNsaXAgLyA3LjApIDogdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0bXBCaWFzZXM7XG4gICAgfVxuXG4gICAgZ2V0Q29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG5cbiAgICBnZXRCb3VuZGluZ1NwaGVyZShzcGhlcmUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICBjb25zdCByYW5nZSA9IHRoaXMuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICBjb25zdCBhbmdsZSA9IHRoaXMuX291dGVyQ29uZUFuZ2xlO1xuICAgICAgICAgICAgY29uc3QgZiA9IE1hdGguY29zKGFuZ2xlICogbWF0aC5ERUdfVE9fUkFEKTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLl9ub2RlO1xuXG4gICAgICAgICAgICBzcG90Q2VudGVyLmNvcHkobm9kZS51cCk7XG4gICAgICAgICAgICBzcG90Q2VudGVyLm11bFNjYWxhcigtcmFuZ2UgKiAwLjUgKiBmKTtcbiAgICAgICAgICAgIHNwb3RDZW50ZXIuYWRkKG5vZGUuZ2V0UG9zaXRpb24oKSk7XG4gICAgICAgICAgICBzcGhlcmUuY2VudGVyID0gc3BvdENlbnRlcjtcblxuICAgICAgICAgICAgc3BvdEVuZFBvaW50LmNvcHkobm9kZS51cCk7XG4gICAgICAgICAgICBzcG90RW5kUG9pbnQubXVsU2NhbGFyKC1yYW5nZSk7XG5cbiAgICAgICAgICAgIHRtcFZlYy5jb3B5KG5vZGUucmlnaHQpO1xuICAgICAgICAgICAgdG1wVmVjLm11bFNjYWxhcihNYXRoLnNpbihhbmdsZSAqIG1hdGguREVHX1RPX1JBRCkgKiByYW5nZSk7XG4gICAgICAgICAgICBzcG90RW5kUG9pbnQuYWRkKHRtcFZlYyk7XG5cbiAgICAgICAgICAgIHNwaGVyZS5yYWRpdXMgPSBzcG90RW5kUG9pbnQubGVuZ3RoKCkgKiAwLjU7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgc3BoZXJlLmNlbnRlciA9IHRoaXMuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIHNwaGVyZS5yYWRpdXMgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0Qm91bmRpbmdCb3goYm94KSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgY29uc3QgcmFuZ2UgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgY29uc3QgYW5nbGUgPSB0aGlzLl9vdXRlckNvbmVBbmdsZTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLl9ub2RlO1xuXG4gICAgICAgICAgICBjb25zdCBzY2wgPSBNYXRoLmFicyhNYXRoLnNpbihhbmdsZSAqIG1hdGguREVHX1RPX1JBRCkgKiByYW5nZSk7XG5cbiAgICAgICAgICAgIGJveC5jZW50ZXIuc2V0KDAsIC1yYW5nZSAqIDAuNSwgMCk7XG4gICAgICAgICAgICBib3guaGFsZkV4dGVudHMuc2V0KHNjbCwgcmFuZ2UgKiAwLjUsIHNjbCk7XG5cbiAgICAgICAgICAgIGJveC5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGJveCwgbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpLCB0cnVlKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICBib3guY2VudGVyLmNvcHkodGhpcy5fbm9kZS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIGJveC5oYWxmRXh0ZW50cy5zZXQodGhpcy5hdHRlbnVhdGlvbkVuZCwgdGhpcy5hdHRlbnVhdGlvbkVuZCwgdGhpcy5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlRmluYWxDb2xvcigpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSB0aGlzLl9jb2xvcjtcbiAgICAgICAgY29uc3QgciA9IGNvbG9yLnI7XG4gICAgICAgIGNvbnN0IGcgPSBjb2xvci5nO1xuICAgICAgICBjb25zdCBiID0gY29sb3IuYjtcblxuICAgICAgICBsZXQgaSA9IHRoaXMuX2ludGVuc2l0eTtcblxuICAgICAgICAvLyBUbyBjYWxjdWxhdGUgdGhlIGx1eCwgd2hpY2ggaXMgbG0vbV4yLCB3ZSBuZWVkIHRvIGNvbnZlcnQgZnJvbSBsdW1pbm91cyBwb3dlclxuICAgICAgICBpZiAodGhpcy5fdXNlUGh5c2ljYWxVbml0cykge1xuICAgICAgICAgICAgc3dpdGNoICh0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfU1BPVDoge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWxsb2ZmRW5kID0gTWF0aC5jb3ModGhpcy5fb3V0ZXJDb25lQW5nbGUgKiBNYXRoLlBJIC8gMTgwLjApO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmYWxsb2ZmU3RhcnQgPSBNYXRoLmNvcyh0aGlzLl9pbm5lckNvbmVBbmdsZSAqIE1hdGguUEkgLyAxODAuMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21tcC9wYnJ0LXY0L2Jsb2IvZmFhYzM0ZDFhMGViZDI0OTI4ODI4ZmU5ZmE2NWI2NWY3ZWZjNTkzNy9zcmMvcGJydC9saWdodHMuY3BwI0wxNDYzXG4gICAgICAgICAgICAgICAgICAgIGkgPSB0aGlzLl9sdW1pbmFuY2UgLyAoMiAqIE1hdGguUEkgKiAoKDEgLSBmYWxsb2ZmU3RhcnQpICsgKGZhbGxvZmZTdGFydCAtIGZhbGxvZmZFbmQpIC8gMi4wKSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9PTU5JOlxuICAgICAgICAgICAgICAgICAgICAvLyBodHRwczovL2dvb2dsZS5naXRodWIuaW8vZmlsYW1lbnQvRmlsYW1lbnQubWQuaHRtbCNsaWdodGluZy9kaXJlY3RsaWdodGluZy9wdW5jdHVhbGxpZ2h0cy9wb2ludGxpZ2h0c1xuICAgICAgICAgICAgICAgICAgICBpID0gdGhpcy5fbHVtaW5hbmNlIC8gKDQgKiBNYXRoLlBJKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfRElSRUNUSU9OQUw6XG4gICAgICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ29vZ2xlLmdpdGh1Yi5pby9maWxhbWVudC9GaWxhbWVudC5tZC5odG1sI2xpZ2h0aW5nL2RpcmVjdGxpZ2h0aW5nL2RpcmVjdGlvbmFsbGlnaHRzXG4gICAgICAgICAgICAgICAgICAgIC8vIERpcmVjdGlvbmFsIGxpZ2h0IGx1bWluYW5jZSBpcyBhbHJlYWR5IGluIGx1eFxuICAgICAgICAgICAgICAgICAgICBpID0gdGhpcy5fbHVtaW5hbmNlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpbmFsQ29sb3IgPSB0aGlzLl9maW5hbENvbG9yO1xuICAgICAgICBjb25zdCBsaW5lYXJGaW5hbENvbG9yID0gdGhpcy5fbGluZWFyRmluYWxDb2xvcjtcblxuICAgICAgICBmaW5hbENvbG9yWzBdID0gciAqIGk7XG4gICAgICAgIGZpbmFsQ29sb3JbMV0gPSBnICogaTtcbiAgICAgICAgZmluYWxDb2xvclsyXSA9IGIgKiBpO1xuICAgICAgICBpZiAoaSA+PSAxKSB7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzBdID0gTWF0aC5wb3cociwgMi4yKSAqIGk7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzFdID0gTWF0aC5wb3coZywgMi4yKSAqIGk7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzJdID0gTWF0aC5wb3coYiwgMi4yKSAqIGk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzBdID0gTWF0aC5wb3coZmluYWxDb2xvclswXSwgMi4yKTtcbiAgICAgICAgICAgIGxpbmVhckZpbmFsQ29sb3JbMV0gPSBNYXRoLnBvdyhmaW5hbENvbG9yWzFdLCAyLjIpO1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclsyXSA9IE1hdGgucG93KGZpbmFsQ29sb3JbMl0sIDIuMik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDb2xvcigpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLnNldChhcmd1bWVudHNbMF0uciwgYXJndW1lbnRzWzBdLmcsIGFyZ3VtZW50c1swXS5iKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5zZXQoYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgfVxuXG4gICAgdXBkYXRlU2hhZG93KCkge1xuICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVNb2RlICE9PSBTSEFET1dVUERBVEVfUkVBTFRJTUUpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsYXllcnNEaXJ0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3NjZW5lPy5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NjZW5lLmxheWVycy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlS2V5KCkge1xuICAgICAgICAvLyBLZXkgZGVmaW5pdGlvbjpcbiAgICAgICAgLy8gQml0XG4gICAgICAgIC8vIDMxICAgICAgOiBzaWduIGJpdCAobGVhdmUpXG4gICAgICAgIC8vIDI5IC0gMzAgOiB0eXBlXG4gICAgICAgIC8vIDI4ICAgICAgOiBjYXN0IHNoYWRvd3NcbiAgICAgICAgLy8gMjUgLSAyNyA6IHNoYWRvdyB0eXBlXG4gICAgICAgIC8vIDIzIC0gMjQgOiBmYWxsb2ZmIG1vZGVcbiAgICAgICAgLy8gMjIgICAgICA6IG5vcm1hbCBvZmZzZXQgYmlhc1xuICAgICAgICAvLyAyMSAgICAgIDogY29va2llXG4gICAgICAgIC8vIDIwICAgICAgOiBjb29raWUgZmFsbG9mZlxuICAgICAgICAvLyAxOCAtIDE5IDogY29va2llIGNoYW5uZWwgUlxuICAgICAgICAvLyAxNiAtIDE3IDogY29va2llIGNoYW5uZWwgR1xuICAgICAgICAvLyAxNCAtIDE1IDogY29va2llIGNoYW5uZWwgQlxuICAgICAgICAvLyAxMiAgICAgIDogY29va2llIHRyYW5zZm9ybVxuICAgICAgICAvLyAxMCAtIDExIDogbGlnaHQgc291cmNlIHNoYXBlXG4gICAgICAgIC8vICA4IC0gIDkgOiBsaWdodCBudW0gY2FzY2FkZXNcbiAgICAgICAgbGV0IGtleSA9XG4gICAgICAgICAgICAgICAodGhpcy5fdHlwZSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPDwgMjkpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY2FzdFNoYWRvd3MgPyAxIDogMCkgICAgICAgICAgICAgICA8PCAyOCkgfFxuICAgICAgICAgICAgICAgKHRoaXMuX3NoYWRvd1R5cGUgICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDI1KSB8XG4gICAgICAgICAgICAgICAodGhpcy5fZmFsbG9mZk1vZGUgICAgICAgICAgICAgICAgICAgICAgICAgPDwgMjMpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fbm9ybWFsT2Zmc2V0QmlhcyAhPT0gMC4wID8gMSA6IDApICA8PCAyMikgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9jb29raWUgPyAxIDogMCkgICAgICAgICAgICAgICAgICAgIDw8IDIxKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX2Nvb2tpZUZhbGxvZmYgPyAxIDogMCkgICAgICAgICAgICAgPDwgMjApIHxcbiAgICAgICAgICAgICAgIChjaGFuSWRbdGhpcy5fY29va2llQ2hhbm5lbC5jaGFyQXQoMCldICAgICA8PCAxOCkgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9jb29raWVUcmFuc2Zvcm0gPyAxIDogMCkgICAgICAgICAgIDw8IDEyKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX3NoYXBlKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPDwgMTApIHxcbiAgICAgICAgICAgICAgICgodGhpcy5udW1DYXNjYWRlcyAtIDEpICAgICAgICAgICAgICAgICAgICA8PCAgOCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZUNoYW5uZWwubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICBrZXkgfD0gKGNoYW5JZFt0aGlzLl9jb29raWVDaGFubmVsLmNoYXJBdCgxKV0gPDwgMTYpO1xuICAgICAgICAgICAga2V5IHw9IChjaGFuSWRbdGhpcy5fY29va2llQ2hhbm5lbC5jaGFyQXQoMildIDw8IDE0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChrZXkgIT09IHRoaXMua2V5ICYmIHRoaXMuX3NjZW5lICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBtb3N0IG9mIHRoZSBjaGFuZ2VzIHRvIHRoZSBrZXkgc2hvdWxkIG5vdCBpbnZhbGlkYXRlIHRoZSBjb21wb3NpdGlvbixcbiAgICAgICAgICAgIC8vIHByb2JhYmx5IG9ubHkgX3R5cGUgYW5kIF9jYXN0U2hhZG93c1xuICAgICAgICAgICAgdGhpcy5sYXllcnNEaXJ0eSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5rZXkgPSBrZXk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBMaWdodCB9O1xuIl0sIm5hbWVzIjpbInNwb3RDZW50ZXIiLCJWZWMzIiwic3BvdEVuZFBvaW50IiwidG1wVmVjIiwidG1wQmlhc2VzIiwiYmlhcyIsIm5vcm1hbEJpYXMiLCJjaGFuSWQiLCJyIiwiZyIsImIiLCJhIiwiZGlyZWN0aW9uYWxDYXNjYWRlcyIsIlZlYzQiLCJpZCIsIkxpZ2h0UmVuZGVyRGF0YSIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwiY2FtZXJhIiwiZmFjZSIsImxpZ2h0Iiwic2hhZG93Q2FtZXJhIiwiU2hhZG93UmVuZGVyZXIiLCJjcmVhdGVTaGFkb3dDYW1lcmEiLCJfc2hhZG93VHlwZSIsIl90eXBlIiwic2hhZG93TWF0cml4IiwiTWF0NCIsInNoYWRvd1ZpZXdwb3J0Iiwic2hhZG93U2Npc3NvciIsInZpc2libGVDYXN0ZXJzIiwic2hhZG93QnVmZmVyIiwicnQiLCJyZW5kZXJUYXJnZXQiLCJMSUdIVFRZUEVfT01OSSIsImNvbG9yQnVmZmVyIiwiX2lzUGNmIiwid2ViZ2wyIiwiZGVwdGhCdWZmZXIiLCJMaWdodCIsImdyYXBoaWNzRGV2aWNlIiwiTElHSFRUWVBFX0RJUkVDVElPTkFMIiwiX2NvbG9yIiwiQ29sb3IiLCJfaW50ZW5zaXR5IiwiX2x1bWluYW5jZSIsIl9jYXN0U2hhZG93cyIsIl9lbmFibGVkIiwibWFzayIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJpc1N0YXRpYyIsImtleSIsImJha2VEaXIiLCJiYWtlTnVtU2FtcGxlcyIsImJha2VBcmVhIiwiYXR0ZW51YXRpb25TdGFydCIsImF0dGVudWF0aW9uRW5kIiwiX2ZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0xJTkVBUiIsIlNIQURPV19QQ0YzIiwiX3ZzbUJsdXJTaXplIiwidnNtQmx1ck1vZGUiLCJCTFVSX0dBVVNTSUFOIiwidnNtQmlhcyIsIl9jb29raWUiLCJjb29raWVJbnRlbnNpdHkiLCJfY29va2llRmFsbG9mZiIsIl9jb29raWVDaGFubmVsIiwiX2Nvb2tpZVRyYW5zZm9ybSIsIl9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtIiwiRmxvYXQzMkFycmF5IiwiX2Nvb2tpZU9mZnNldCIsIl9jb29raWVPZmZzZXRVbmlmb3JtIiwiX2Nvb2tpZVRyYW5zZm9ybVNldCIsIl9jb29raWVPZmZzZXRTZXQiLCJfaW5uZXJDb25lQW5nbGUiLCJfb3V0ZXJDb25lQW5nbGUiLCJjYXNjYWRlcyIsIl9zaGFkb3dNYXRyaXhQYWxldHRlIiwiX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMiLCJudW1DYXNjYWRlcyIsImNhc2NhZGVEaXN0cmlidXRpb24iLCJfc2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiX2ZpbmFsQ29sb3IiLCJjIiwiTWF0aCIsInBvdyIsIl9saW5lYXJGaW5hbENvbG9yIiwiX3Bvc2l0aW9uIiwiX2RpcmVjdGlvbiIsIl9pbm5lckNvbmVBbmdsZUNvcyIsImNvcyIsIlBJIiwiX291dGVyQ29uZUFuZ2xlQ29zIiwiX3VzZVBoeXNpY2FsVW5pdHMiLCJ1bmRlZmluZWQiLCJfc2hhZG93TWFwIiwiX3NoYWRvd1JlbmRlclBhcmFtcyIsInNoYWRvd0Rpc3RhbmNlIiwiX3NoYWRvd1Jlc29sdXRpb24iLCJzaGFkb3dCaWFzIiwic2hhZG93SW50ZW5zaXR5IiwiX25vcm1hbE9mZnNldEJpYXMiLCJzaGFkb3dVcGRhdGVNb2RlIiwiU0hBRE9XVVBEQVRFX1JFQUxUSU1FIiwiX2lzVnNtIiwiX2Nvb2tpZU1hdHJpeCIsIl9hdGxhc1ZpZXdwb3J0IiwiYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCIsImF0bGFzVmVyc2lvbiIsImF0bGFzU2xvdEluZGV4IiwiYXRsYXNTbG90VXBkYXRlZCIsIl9zY2VuZSIsIl9ub2RlIiwiX3JlbmRlckRhdGEiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwibWF4U2NyZWVuU2l6ZSIsImRlc3Ryb3kiLCJfZGVzdHJveVNoYWRvd01hcCIsInZhbHVlIiwidXBkYXRlS2V5IiwibGVuZ3RoIiwic2hhZG93TWFwIiwibnVtU2hhZG93RmFjZXMiLCJ0eXBlIiwic3R5cGUiLCJzaGFkb3dUeXBlIiwic2hhcGUiLCJ1c2VQaHlzaWNhbFVuaXRzIiwiX3VwZGF0ZUZpbmFsQ29sb3IiLCJTSEFET1dfUENGNSIsIlNIQURPV19WU00zMiIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJTSEFET1dfVlNNMTYiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsIlNIQURPV19WU004IiwiZW5hYmxlZCIsImxheWVyc0RpcnR5IiwiY2FzdFNoYWRvd3MiLCJNQVNLX0JBS0UiLCJzaGFkb3dSZXNvbHV0aW9uIiwibWluIiwibWF4Q3ViZU1hcFNpemUiLCJtYXhUZXh0dXJlU2l6ZSIsInZzbUJsdXJTaXplIiwibm9ybWFsT2Zmc2V0QmlhcyIsImZhbGxvZmZNb2RlIiwiaW5uZXJDb25lQW5nbGUiLCJvdXRlckNvbmVBbmdsZSIsImludGVuc2l0eSIsImx1bWluYW5jZSIsImNvb2tpZU1hdHJpeCIsImF0bGFzVmlld3BvcnQiLCJjb29raWUiLCJjb29raWVGYWxsb2ZmIiwiY29va2llQ2hhbm5lbCIsImNociIsImNoYXJBdCIsImFkZExlbiIsImkiLCJjb29raWVUcmFuc2Zvcm0iLCJjb29raWVPZmZzZXQiLCJWZWMyIiwieGZvcm1OZXciLCJzZXQiLCJiZWdpbkZyYW1lIiwiY2FjaGVkIiwiU0hBRE9XVVBEQVRFX05PTkUiLCJTSEFET1dVUERBVEVfVEhJU0ZSQU1FIiwiZ2V0UmVuZGVyRGF0YSIsImN1cnJlbnQiLCJyZCIsInB1c2giLCJjbG9uZSIsInNldENvbG9yIiwiX2dldFVuaWZvcm1CaWFzVmFsdWVzIiwibGlnaHRSZW5kZXJEYXRhIiwiZmFyQ2xpcCIsIl9mYXJDbGlwIiwiTElHSFRUWVBFX1NQT1QiLCJleHRTdGFuZGFyZERlcml2YXRpdmVzIiwiZ2V0Q29sb3IiLCJnZXRCb3VuZGluZ1NwaGVyZSIsInNwaGVyZSIsInJhbmdlIiwiYW5nbGUiLCJmIiwibWF0aCIsIkRFR19UT19SQUQiLCJub2RlIiwiY29weSIsInVwIiwibXVsU2NhbGFyIiwiYWRkIiwiZ2V0UG9zaXRpb24iLCJjZW50ZXIiLCJyaWdodCIsInNpbiIsInJhZGl1cyIsImdldEJvdW5kaW5nQm94IiwiYm94Iiwic2NsIiwiYWJzIiwiaGFsZkV4dGVudHMiLCJzZXRGcm9tVHJhbnNmb3JtZWRBYWJiIiwiZ2V0V29ybGRUcmFuc2Zvcm0iLCJjb2xvciIsImZhbGxvZmZFbmQiLCJmYWxsb2ZmU3RhcnQiLCJmaW5hbENvbG9yIiwibGluZWFyRmluYWxDb2xvciIs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
