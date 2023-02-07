/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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

// viewport in shadows map for cascades for directional light
const directionalCascades = [[new Vec4(0, 0, 1, 1)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5)], [new Vec4(0, 0, 0.5, 0.5), new Vec4(0, 0.5, 0.5, 0.5), new Vec4(0.5, 0, 0.5, 0.5), new Vec4(0.5, 0.5, 0.5, 0.5)]];
let id = 0;

// Class storing shadow rendering related private information
class LightRenderData {
  constructor(device, camera, face, light) {
    // light this data belongs to
    this.light = light;

    // camera this applies to. Only used by directional light, as directional shadow map
    // is culled and rendered for each camera. Local lights' shadow is culled and rendered one time
    // and shared between cameras (even though it's not strictly correct and we can get shadows
    // from a mesh that is not visible by the camera)
    this.camera = camera;

    // camera used to cull / render the shadow map
    this.shadowCamera = ShadowRenderer.createShadowCamera(device, light._shadowType, light._type, face);

    // shadow view-projection matrix
    this.shadowMatrix = new Mat4();

    // viewport for the shadow rendering to the texture (x, y, width, height)
    this.shadowViewport = new Vec4(0, 0, 1, 1);

    // scissor rectangle for the shadow rendering to the texture (x, y, width, height)
    this.shadowScissor = new Vec4(0, 0, 1, 1);

    // face index, value is based on light type:
    // - spot: always 0
    // - omni: cubemap face, 0..5
    // - directional: 0 for simple shadows, cascade index for cascaded shadow map
    this.face = face;

    // visible shadow casters
    this.visibleCasters = [];

    // an array of view bind groups, single entry is used for shadows
    /** @type {import('../platform/graphics/bind-group.js').BindGroup[]} */
    this.viewBindGroups = [];
  }

  // releases GPU resources
  destroy() {
    this.viewBindGroups.forEach(bg => {
      bg.defaultUniformBuffer.destroy();
      bg.destroy();
    });
    this.viewBindGroups.length = 0;
  }

  // returns shadow buffer currently attached to the shadow camera
  get shadowBuffer() {
    const rt = this.shadowCamera.renderTarget;
    if (rt) {
      const light = this.light;
      if (light._type === LIGHTTYPE_OMNI) {
        return rt.colorBuffer;
      }
      return light._isPcf && light.device.supportsDepthShadow ? rt.depthBuffer : rt.colorBuffer;
    }
    return null;
  }
}

/**
 * A light.
 *
 * @ignore
 */
class Light {
  constructor(graphicsDevice) {
    this.device = graphicsDevice;
    this.id = id++;

    // Light properties (defaults)
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

    // Omni and spot properties
    this.attenuationStart = 10;
    this.attenuationEnd = 10;
    this._falloffMode = LIGHTFALLOFF_LINEAR;
    this._shadowType = SHADOW_PCF3;
    this._vsmBlurSize = 11;
    this.vsmBlurMode = BLUR_GAUSSIAN;
    this.vsmBias = 0.01 * 0.25;
    this._cookie = null; // light cookie texture (2D for spot, cubemap for omni)
    this.cookieIntensity = 1;
    this._cookieFalloff = true;
    this._cookieChannel = 'rgb';
    this._cookieTransform = null; // 2d rotation/scale matrix (spot only)
    this._cookieTransformUniform = new Float32Array(4);
    this._cookieOffset = null; // 2d position offset (spot only)
    this._cookieOffsetUniform = new Float32Array(2);
    this._cookieTransformSet = false;
    this._cookieOffsetSet = false;

    // Spot properties
    this._innerConeAngle = 40;
    this._outerConeAngle = 45;

    // Directional properties
    this.cascades = null; // an array of Vec4 viewports per cascade
    this._shadowMatrixPalette = null; // a float array, 16 floats per cascade
    this._shadowCascadeDistances = null;
    this.numCascades = 1;
    this.cascadeDistribution = 0.5;

    // Light source shape properties
    this._shape = LIGHTSHAPE_PUNCTUAL;

    // Cache of light property data in a format more friendly for shader uniforms
    this._finalColor = new Float32Array([0.8, 0.8, 0.8]);
    const c = Math.pow(this._finalColor[0], 2.2);
    this._linearFinalColor = new Float32Array([c, c, c]);
    this._position = new Vec3(0, 0, 0);
    this._direction = new Vec3(0, 0, 0);
    this._innerConeAngleCos = Math.cos(this._innerConeAngle * Math.PI / 180);
    this._updateOuterAngle(this._outerConeAngle);
    this._usePhysicalUnits = undefined;

    // Shadow mapping resources
    this._shadowMap = null;
    this._shadowRenderParams = [];

    // Shadow mapping properties
    this.shadowDistance = 40;
    this._shadowResolution = 1024;
    this.shadowBias = -0.0005;
    this.shadowIntensity = 1.0;
    this._normalOffsetBias = 0.0;
    this.shadowUpdateMode = SHADOWUPDATE_REALTIME;
    this.shadowUpdateOverrides = null;
    this._isVsm = false;
    this._isPcf = true;

    // cookie matrix (used in case the shadow mapping is disabled and so the shadow matrix cannot be used)
    this._cookieMatrix = null;

    // viewport of the cookie texture / shadow in the atlas
    this._atlasViewport = null;
    this.atlasViewportAllocated = false; // if true, atlas slot is allocated for the current frame
    this.atlasVersion = 0; // version of the atlas for the allocated slot, allows invalidation when atlas recreates slots
    this.atlasSlotIndex = 0; // allocated slot index, used for more persistent slot allocation
    this.atlasSlotUpdated = false; // true if the atlas slot was reassigned this frame (and content needs to be updated)

    this._scene = null;
    this._node = null;

    // private rendering data
    this._renderData = [];

    // true if the light is visible by any camera within a frame
    this.visibleThisFrame = false;

    // maximum size of the light bounding sphere on the screen by any camera within a frame
    // (used to estimate shadow resolution), range [0..1]
    this.maxScreenSize = 0;
  }
  destroy() {
    this._destroyShadowMap();
    this.releaseRenderData();
    this._renderData = null;
  }
  releaseRenderData() {
    if (this._renderData) {
      for (let i = 0; i < this._renderData.length; i++) {
        this._renderData[i].destroy();
      }
      this._renderData.length = 0;
    }
  }
  set numCascades(value) {
    if (!this.cascades || this.numCascades !== value) {
      this.cascades = directionalCascades[value - 1];
      this._shadowMatrixPalette = new Float32Array(4 * 16); // always 4
      this._shadowCascadeDistances = new Float32Array(4); // always 4
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

  // returns number of render targets to render the shadow map
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
    this.shadowType = stype; // refresh shadow type; switching from direct/spot to omni and back may change it
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
    this.shadowType = stype; // refresh shadow type; switching shape and back may change it
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
    if (this._type === LIGHTTYPE_OMNI) value = SHADOW_PCF3; // VSM or HW PCF for omni lights is not supported yet

    const supportsPCF5 = device.supportsDepthShadow;
    if (value === SHADOW_PCF5 && !supportsPCF5) {
      value = SHADOW_PCF3; // fallback from HW PCF to old PCF
    }

    if (value === SHADOW_VSM32 && !device.textureFloatRenderable)
      // fallback from vsm32 to vsm16
      value = SHADOW_VSM16;
    if (value === SHADOW_VSM16 && !device.textureHalfFloatRenderable)
      // fallback from vsm16 to vsm8
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
    if (value % 2 === 0) value++; // don't allow even size
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
      this.cookieOffset = new Vec2(); // using transform forces using offset code
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
      this.cookieTransform = new Vec4(1, 1, 0, 0); // using offset forces using matrix code
      this._cookieTransformSet = false;
    }
    this.updateKey();
  }
  get cookieOffset() {
    return this._cookieOffset;
  }

  // prepares light for the frame rendering
  beginFrame() {
    this.visibleThisFrame = this._type === LIGHTTYPE_DIRECTIONAL && this._enabled;
    this.maxScreenSize = 0;
    this.atlasViewportAllocated = false;
    this.atlasSlotUpdated = false;
  }

  // destroys shadow map related resources, called when shadow properties change and resources
  // need to be recreated
  _destroyShadowMap() {
    this.releaseRenderData();
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

  // returns LightRenderData with matching camera and face
  getRenderData(camera, face) {
    // returns existing
    for (let i = 0; i < this._renderData.length; i++) {
      const current = this._renderData[i];
      if (current.camera === camera && current.face === face) {
        return current;
      }
    }

    // create new one
    const rd = new LightRenderData(this.device, camera, face, this);
    this._renderData.push(rd);
    return rd;
  }

  /**
   * Duplicates a light node but does not 'deep copy' the hierarchy.
   *
   * @returns {Light} A cloned Light.
   */
  clone() {
    const clone = new Light(this.device);

    // Clone Light properties
    clone.type = this._type;
    clone.setColor(this._color);
    clone.intensity = this._intensity;
    clone.luminance = this._luminance;
    clone.castShadows = this.castShadows;
    clone._enabled = this._enabled;

    // Omni and spot properties
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

    // Spot properties
    clone.innerConeAngle = this._innerConeAngle;
    clone.outerConeAngle = this._outerConeAngle;

    // Directional properties
    clone.numCascades = this.numCascades;
    clone.cascadeDistribution = this.cascadeDistribution;

    // shape properties
    clone.shape = this._shape;

    // Shadow properties
    clone.shadowBias = this.shadowBias;
    clone.normalOffsetBias = this._normalOffsetBias;
    clone.shadowResolution = this._shadowResolution;
    clone.shadowDistance = this.shadowDistance;
    clone.shadowIntensity = this.shadowIntensity;

    // Cookies properties
    // clone.cookie = this._cookie;
    // clone.cookieIntensity = this.cookieIntensity;
    // clone.cookieFalloff = this._cookieFalloff;
    // clone.cookieChannel = this._cookieChannel;
    // clone.cookieTransform = this._cookieTransform;
    // clone.cookieOffset = this._cookieOffset;

    return clone;
  }

  /**
   * Get conversion factor for luminance -> light specific light unit.
   *
   * @param {number} type - The type of light.
   * @param {number} [outerAngle] - The outer angle of a spot light.
   * @param {number} [innerAngle] - The inner angle of a spot light.
   * @returns {number} The scaling factor to multiply with the luminance value.
   */
  static getLightUnitConversion(type, outerAngle = Math.PI / 4, innerAngle = 0) {
    switch (type) {
      case LIGHTTYPE_SPOT:
        {
          const falloffEnd = Math.cos(outerAngle);
          const falloffStart = Math.cos(innerAngle);

          // https://github.com/mmp/pbrt-v4/blob/faac34d1a0ebd24928828fe9fa65b65f7efc5937/src/pbrt/lights.cpp#L1463
          return 2 * Math.PI * (1 - falloffStart + (falloffStart - falloffEnd) / 2.0);
        }
      case LIGHTTYPE_OMNI:
        // https://google.github.io/filament/Filament.md.html#lighting/directlighting/punctuallights/pointlights
        return 4 * Math.PI;
      case LIGHTTYPE_DIRECTIONAL:
        // https://google.github.io/filament/Filament.md.html#lighting/directlighting/directionallights
        return 1;
    }
  }

  // returns the bias (.x) and normalBias (.y) value for lights as passed to shaders by uniforms
  // Note: this needs to be revisited and simplified
  // Note: vsmBias is not used at all for omni light, even though it is editable in the Editor
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
          tmpBiases.bias = this.shadowBias * 20; // approx remap from old bias values
          if (!this.device.webgl2 && this.device.extStandardDerivatives) tmpBiases.bias *= -100;
        }
        tmpBiases.normalBias = this._isVsm ? this.vsmBias / (this.attenuationEnd / 7.0) : this._normalOffsetBias;
        break;
      case LIGHTTYPE_DIRECTIONAL:
        // make bias dependent on far plane because it's not constant for direct light
        // clip distance used is based on the nearest shadow cascade
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
      // based on https://bartwronski.com/2017/04/13/cull-that-cone/
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

    // To calculate the lux, which is lm/m^2, we need to convert from luminous power
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
    // Key definition:
    // Bit
    // 31      : sign bit (leave)
    // 29 - 30 : type
    // 28      : cast shadows
    // 25 - 27 : shadow type
    // 23 - 24 : falloff mode
    // 22      : normal offset bias
    // 21      : cookie
    // 20      : cookie falloff
    // 18 - 19 : cookie channel R
    // 16 - 17 : cookie channel G
    // 14 - 15 : cookie channel B
    // 12      : cookie transform
    // 10 - 11 : light source shape
    //  8 -  9 : light num cascades
    let key = this._type << 29 | (this._castShadows ? 1 : 0) << 28 | this._shadowType << 25 | this._falloffMode << 23 | (this._normalOffsetBias !== 0.0 ? 1 : 0) << 22 | (this._cookie ? 1 : 0) << 21 | (this._cookieFalloff ? 1 : 0) << 20 | chanId[this._cookieChannel.charAt(0)] << 18 | (this._cookieTransform ? 1 : 0) << 12 | this._shape << 10 | this.numCascades - 1 << 8;
    if (this._cookieChannel.length === 3) {
      key |= chanId[this._cookieChannel.charAt(1)] << 16;
      key |= chanId[this._cookieChannel.charAt(2)] << 14;
    }
    if (key !== this.key && this._scene !== null) {
      // TODO: most of the changes to the key should not invalidate the composition,
      // probably only _type and _castShadows
      this.layersDirty();
    }
    this.key = key;
  }
}

export { Light, lightTypes };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9saWdodC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHtcbiAgICBCTFVSX0dBVVNTSUFOLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIE1BU0tfQkFLRSwgTUFTS19BRkZFQ1RfRFlOQU1JQyxcbiAgICBTSEFET1dfUENGMywgU0hBRE9XX1BDRjUsIFNIQURPV19WU004LCBTSEFET1dfVlNNMTYsIFNIQURPV19WU00zMixcbiAgICBTSEFET1dVUERBVEVfTk9ORSwgU0hBRE9XVVBEQVRFX1JFQUxUSU1FLCBTSEFET1dVUERBVEVfVEhJU0ZSQU1FLFxuICAgIExJR0hUU0hBUEVfUFVOQ1RVQUwsIExJR0hURkFMTE9GRl9MSU5FQVJcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgU2hhZG93UmVuZGVyZXIgfSBmcm9tICcuL3JlbmRlcmVyL3NoYWRvdy1yZW5kZXJlci5qcyc7XG5cbmNvbnN0IHRtcFZlYyA9IG5ldyBWZWMzKCk7XG5jb25zdCB0bXBCaWFzZXMgPSB7XG4gICAgYmlhczogMCxcbiAgICBub3JtYWxCaWFzOiAwXG59O1xuXG5jb25zdCBjaGFuSWQgPSB7IHI6IDAsIGc6IDEsIGI6IDIsIGE6IDMgfTtcblxuY29uc3QgbGlnaHRUeXBlcyA9IHtcbiAgICAnZGlyZWN0aW9uYWwnOiBMSUdIVFRZUEVfRElSRUNUSU9OQUwsXG4gICAgJ29tbmknOiBMSUdIVFRZUEVfT01OSSxcbiAgICAncG9pbnQnOiBMSUdIVFRZUEVfT01OSSxcbiAgICAnc3BvdCc6IExJR0hUVFlQRV9TUE9UXG59O1xuXG4vLyB2aWV3cG9ydCBpbiBzaGFkb3dzIG1hcCBmb3IgY2FzY2FkZXMgZm9yIGRpcmVjdGlvbmFsIGxpZ2h0XG5jb25zdCBkaXJlY3Rpb25hbENhc2NhZGVzID0gW1xuICAgIFtuZXcgVmVjNCgwLCAwLCAxLCAxKV0sXG4gICAgW25ldyBWZWM0KDAsIDAsIDAuNSwgMC41KSwgbmV3IFZlYzQoMCwgMC41LCAwLjUsIDAuNSldLFxuICAgIFtuZXcgVmVjNCgwLCAwLCAwLjUsIDAuNSksIG5ldyBWZWM0KDAsIDAuNSwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLjUsIDAsIDAuNSwgMC41KV0sXG4gICAgW25ldyBWZWM0KDAsIDAsIDAuNSwgMC41KSwgbmV3IFZlYzQoMCwgMC41LCAwLjUsIDAuNSksIG5ldyBWZWM0KDAuNSwgMCwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLjUsIDAuNSwgMC41LCAwLjUpXVxuXTtcblxubGV0IGlkID0gMDtcblxuLy8gQ2xhc3Mgc3RvcmluZyBzaGFkb3cgcmVuZGVyaW5nIHJlbGF0ZWQgcHJpdmF0ZSBpbmZvcm1hdGlvblxuY2xhc3MgTGlnaHRSZW5kZXJEYXRhIHtcbiAgICBjb25zdHJ1Y3RvcihkZXZpY2UsIGNhbWVyYSwgZmFjZSwgbGlnaHQpIHtcblxuICAgICAgICAvLyBsaWdodCB0aGlzIGRhdGEgYmVsb25ncyB0b1xuICAgICAgICB0aGlzLmxpZ2h0ID0gbGlnaHQ7XG5cbiAgICAgICAgLy8gY2FtZXJhIHRoaXMgYXBwbGllcyB0by4gT25seSB1c2VkIGJ5IGRpcmVjdGlvbmFsIGxpZ2h0LCBhcyBkaXJlY3Rpb25hbCBzaGFkb3cgbWFwXG4gICAgICAgIC8vIGlzIGN1bGxlZCBhbmQgcmVuZGVyZWQgZm9yIGVhY2ggY2FtZXJhLiBMb2NhbCBsaWdodHMnIHNoYWRvdyBpcyBjdWxsZWQgYW5kIHJlbmRlcmVkIG9uZSB0aW1lXG4gICAgICAgIC8vIGFuZCBzaGFyZWQgYmV0d2VlbiBjYW1lcmFzIChldmVuIHRob3VnaCBpdCdzIG5vdCBzdHJpY3RseSBjb3JyZWN0IGFuZCB3ZSBjYW4gZ2V0IHNoYWRvd3NcbiAgICAgICAgLy8gZnJvbSBhIG1lc2ggdGhhdCBpcyBub3QgdmlzaWJsZSBieSB0aGUgY2FtZXJhKVxuICAgICAgICB0aGlzLmNhbWVyYSA9IGNhbWVyYTtcblxuICAgICAgICAvLyBjYW1lcmEgdXNlZCB0byBjdWxsIC8gcmVuZGVyIHRoZSBzaGFkb3cgbWFwXG4gICAgICAgIHRoaXMuc2hhZG93Q2FtZXJhID0gU2hhZG93UmVuZGVyZXIuY3JlYXRlU2hhZG93Q2FtZXJhKGRldmljZSwgbGlnaHQuX3NoYWRvd1R5cGUsIGxpZ2h0Ll90eXBlLCBmYWNlKTtcblxuICAgICAgICAvLyBzaGFkb3cgdmlldy1wcm9qZWN0aW9uIG1hdHJpeFxuICAgICAgICB0aGlzLnNoYWRvd01hdHJpeCA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgLy8gdmlld3BvcnQgZm9yIHRoZSBzaGFkb3cgcmVuZGVyaW5nIHRvIHRoZSB0ZXh0dXJlICh4LCB5LCB3aWR0aCwgaGVpZ2h0KVxuICAgICAgICB0aGlzLnNoYWRvd1ZpZXdwb3J0ID0gbmV3IFZlYzQoMCwgMCwgMSwgMSk7XG5cbiAgICAgICAgLy8gc2Npc3NvciByZWN0YW5nbGUgZm9yIHRoZSBzaGFkb3cgcmVuZGVyaW5nIHRvIHRoZSB0ZXh0dXJlICh4LCB5LCB3aWR0aCwgaGVpZ2h0KVxuICAgICAgICB0aGlzLnNoYWRvd1NjaXNzb3IgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTtcblxuICAgICAgICAvLyBmYWNlIGluZGV4LCB2YWx1ZSBpcyBiYXNlZCBvbiBsaWdodCB0eXBlOlxuICAgICAgICAvLyAtIHNwb3Q6IGFsd2F5cyAwXG4gICAgICAgIC8vIC0gb21uaTogY3ViZW1hcCBmYWNlLCAwLi41XG4gICAgICAgIC8vIC0gZGlyZWN0aW9uYWw6IDAgZm9yIHNpbXBsZSBzaGFkb3dzLCBjYXNjYWRlIGluZGV4IGZvciBjYXNjYWRlZCBzaGFkb3cgbWFwXG4gICAgICAgIHRoaXMuZmFjZSA9IGZhY2U7XG5cbiAgICAgICAgLy8gdmlzaWJsZSBzaGFkb3cgY2FzdGVyc1xuICAgICAgICB0aGlzLnZpc2libGVDYXN0ZXJzID0gW107XG5cbiAgICAgICAgLy8gYW4gYXJyYXkgb2YgdmlldyBiaW5kIGdyb3Vwcywgc2luZ2xlIGVudHJ5IGlzIHVzZWQgZm9yIHNoYWRvd3NcbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMnKS5CaW5kR3JvdXBbXX0gKi9cbiAgICAgICAgdGhpcy52aWV3QmluZEdyb3VwcyA9IFtdO1xuICAgIH1cblxuICAgIC8vIHJlbGVhc2VzIEdQVSByZXNvdXJjZXNcbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBzLmZvckVhY2goKGJnKSA9PiB7XG4gICAgICAgICAgICBiZy5kZWZhdWx0VW5pZm9ybUJ1ZmZlci5kZXN0cm95KCk7XG4gICAgICAgICAgICBiZy5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBzLmxlbmd0aCA9IDA7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyBzaGFkb3cgYnVmZmVyIGN1cnJlbnRseSBhdHRhY2hlZCB0byB0aGUgc2hhZG93IGNhbWVyYVxuICAgIGdldCBzaGFkb3dCdWZmZXIoKSB7XG4gICAgICAgIGNvbnN0IHJ0ID0gdGhpcy5zaGFkb3dDYW1lcmEucmVuZGVyVGFyZ2V0O1xuICAgICAgICBpZiAocnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gdGhpcy5saWdodDtcbiAgICAgICAgICAgIGlmIChsaWdodC5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcnQuY29sb3JCdWZmZXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBsaWdodC5faXNQY2YgJiYgbGlnaHQuZGV2aWNlLnN1cHBvcnRzRGVwdGhTaGFkb3cgPyBydC5kZXB0aEJ1ZmZlciA6IHJ0LmNvbG9yQnVmZmVyO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIEEgbGlnaHQuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBMaWdodCB7XG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UpIHtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgdGhpcy5pZCA9IGlkKys7XG5cbiAgICAgICAgLy8gTGlnaHQgcHJvcGVydGllcyAoZGVmYXVsdHMpXG4gICAgICAgIHRoaXMuX3R5cGUgPSBMSUdIVFRZUEVfRElSRUNUSU9OQUw7XG4gICAgICAgIHRoaXMuX2NvbG9yID0gbmV3IENvbG9yKDAuOCwgMC44LCAwLjgpO1xuICAgICAgICB0aGlzLl9pbnRlbnNpdHkgPSAxO1xuICAgICAgICB0aGlzLl9sdW1pbmFuY2UgPSAwO1xuICAgICAgICB0aGlzLl9jYXN0U2hhZG93cyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9lbmFibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMubWFzayA9IE1BU0tfQUZGRUNUX0RZTkFNSUM7XG4gICAgICAgIHRoaXMuaXNTdGF0aWMgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5rZXkgPSAwO1xuICAgICAgICB0aGlzLmJha2VEaXIgPSB0cnVlO1xuICAgICAgICB0aGlzLmJha2VOdW1TYW1wbGVzID0gMTtcbiAgICAgICAgdGhpcy5iYWtlQXJlYSA9IDA7XG5cbiAgICAgICAgLy8gT21uaSBhbmQgc3BvdCBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuYXR0ZW51YXRpb25TdGFydCA9IDEwO1xuICAgICAgICB0aGlzLmF0dGVudWF0aW9uRW5kID0gMTA7XG4gICAgICAgIHRoaXMuX2ZhbGxvZmZNb2RlID0gTElHSFRGQUxMT0ZGX0xJTkVBUjtcbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IFNIQURPV19QQ0YzO1xuICAgICAgICB0aGlzLl92c21CbHVyU2l6ZSA9IDExO1xuICAgICAgICB0aGlzLnZzbUJsdXJNb2RlID0gQkxVUl9HQVVTU0lBTjtcbiAgICAgICAgdGhpcy52c21CaWFzID0gMC4wMSAqIDAuMjU7XG4gICAgICAgIHRoaXMuX2Nvb2tpZSA9IG51bGw7IC8vIGxpZ2h0IGNvb2tpZSB0ZXh0dXJlICgyRCBmb3Igc3BvdCwgY3ViZW1hcCBmb3Igb21uaSlcbiAgICAgICAgdGhpcy5jb29raWVJbnRlbnNpdHkgPSAxO1xuICAgICAgICB0aGlzLl9jb29raWVGYWxsb2ZmID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fY29va2llQ2hhbm5lbCA9ICdyZ2InO1xuICAgICAgICB0aGlzLl9jb29raWVUcmFuc2Zvcm0gPSBudWxsOyAvLyAyZCByb3RhdGlvbi9zY2FsZSBtYXRyaXggKHNwb3Qgb25seSlcbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtVW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoNCk7XG4gICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldCA9IG51bGw7IC8vIDJkIHBvc2l0aW9uIG9mZnNldCAoc3BvdCBvbmx5KVxuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXRVbmlmb3JtID0gbmV3IEZsb2F0MzJBcnJheSgyKTtcbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtU2V0ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldFNldCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIFNwb3QgcHJvcGVydGllc1xuICAgICAgICB0aGlzLl9pbm5lckNvbmVBbmdsZSA9IDQwO1xuICAgICAgICB0aGlzLl9vdXRlckNvbmVBbmdsZSA9IDQ1O1xuXG4gICAgICAgIC8vIERpcmVjdGlvbmFsIHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5jYXNjYWRlcyA9IG51bGw7ICAgICAgICAgICAgICAgLy8gYW4gYXJyYXkgb2YgVmVjNCB2aWV3cG9ydHMgcGVyIGNhc2NhZGVcbiAgICAgICAgdGhpcy5fc2hhZG93TWF0cml4UGFsZXR0ZSA9IG51bGw7ICAgLy8gYSBmbG9hdCBhcnJheSwgMTYgZmxvYXRzIHBlciBjYXNjYWRlXG4gICAgICAgIHRoaXMuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMgPSBudWxsO1xuICAgICAgICB0aGlzLm51bUNhc2NhZGVzID0gMTtcbiAgICAgICAgdGhpcy5jYXNjYWRlRGlzdHJpYnV0aW9uID0gMC41O1xuXG4gICAgICAgIC8vIExpZ2h0IHNvdXJjZSBzaGFwZSBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuX3NoYXBlID0gTElHSFRTSEFQRV9QVU5DVFVBTDtcblxuICAgICAgICAvLyBDYWNoZSBvZiBsaWdodCBwcm9wZXJ0eSBkYXRhIGluIGEgZm9ybWF0IG1vcmUgZnJpZW5kbHkgZm9yIHNoYWRlciB1bmlmb3Jtc1xuICAgICAgICB0aGlzLl9maW5hbENvbG9yID0gbmV3IEZsb2F0MzJBcnJheShbMC44LCAwLjgsIDAuOF0pO1xuICAgICAgICBjb25zdCBjID0gTWF0aC5wb3codGhpcy5fZmluYWxDb2xvclswXSwgMi4yKTtcbiAgICAgICAgdGhpcy5fbGluZWFyRmluYWxDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoW2MsIGMsIGNdKTtcblxuICAgICAgICB0aGlzLl9wb3NpdGlvbiA9IG5ldyBWZWMzKDAsIDAsIDApO1xuICAgICAgICB0aGlzLl9kaXJlY3Rpb24gPSBuZXcgVmVjMygwLCAwLCAwKTtcbiAgICAgICAgdGhpcy5faW5uZXJDb25lQW5nbGVDb3MgPSBNYXRoLmNvcyh0aGlzLl9pbm5lckNvbmVBbmdsZSAqIE1hdGguUEkgLyAxODApO1xuICAgICAgICB0aGlzLl91cGRhdGVPdXRlckFuZ2xlKHRoaXMuX291dGVyQ29uZUFuZ2xlKTtcblxuICAgICAgICB0aGlzLl91c2VQaHlzaWNhbFVuaXRzID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIC8vIFNoYWRvdyBtYXBwaW5nIHJlc291cmNlc1xuICAgICAgICB0aGlzLl9zaGFkb3dNYXAgPSBudWxsO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZW5kZXJQYXJhbXMgPSBbXTtcblxuICAgICAgICAvLyBTaGFkb3cgbWFwcGluZyBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuc2hhZG93RGlzdGFuY2UgPSA0MDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVzb2x1dGlvbiA9IDEwMjQ7XG4gICAgICAgIHRoaXMuc2hhZG93QmlhcyA9IC0wLjAwMDU7XG4gICAgICAgIHRoaXMuc2hhZG93SW50ZW5zaXR5ID0gMS4wO1xuICAgICAgICB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzID0gMC4wO1xuICAgICAgICB0aGlzLnNoYWRvd1VwZGF0ZU1vZGUgPSBTSEFET1dVUERBVEVfUkVBTFRJTUU7XG4gICAgICAgIHRoaXMuc2hhZG93VXBkYXRlT3ZlcnJpZGVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5faXNWc20gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNQY2YgPSB0cnVlO1xuXG4gICAgICAgIC8vIGNvb2tpZSBtYXRyaXggKHVzZWQgaW4gY2FzZSB0aGUgc2hhZG93IG1hcHBpbmcgaXMgZGlzYWJsZWQgYW5kIHNvIHRoZSBzaGFkb3cgbWF0cml4IGNhbm5vdCBiZSB1c2VkKVxuICAgICAgICB0aGlzLl9jb29raWVNYXRyaXggPSBudWxsO1xuXG4gICAgICAgIC8vIHZpZXdwb3J0IG9mIHRoZSBjb29raWUgdGV4dHVyZSAvIHNoYWRvdyBpbiB0aGUgYXRsYXNcbiAgICAgICAgdGhpcy5fYXRsYXNWaWV3cG9ydCA9IG51bGw7XG4gICAgICAgIHRoaXMuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCA9IGZhbHNlOyAgICAvLyBpZiB0cnVlLCBhdGxhcyBzbG90IGlzIGFsbG9jYXRlZCBmb3IgdGhlIGN1cnJlbnQgZnJhbWVcbiAgICAgICAgdGhpcy5hdGxhc1ZlcnNpb24gPSAwOyAgICAgIC8vIHZlcnNpb24gb2YgdGhlIGF0bGFzIGZvciB0aGUgYWxsb2NhdGVkIHNsb3QsIGFsbG93cyBpbnZhbGlkYXRpb24gd2hlbiBhdGxhcyByZWNyZWF0ZXMgc2xvdHNcbiAgICAgICAgdGhpcy5hdGxhc1Nsb3RJbmRleCA9IDA7ICAgIC8vIGFsbG9jYXRlZCBzbG90IGluZGV4LCB1c2VkIGZvciBtb3JlIHBlcnNpc3RlbnQgc2xvdCBhbGxvY2F0aW9uXG4gICAgICAgIHRoaXMuYXRsYXNTbG90VXBkYXRlZCA9IGZhbHNlOyAgLy8gdHJ1ZSBpZiB0aGUgYXRsYXMgc2xvdCB3YXMgcmVhc3NpZ25lZCB0aGlzIGZyYW1lIChhbmQgY29udGVudCBuZWVkcyB0byBiZSB1cGRhdGVkKVxuXG4gICAgICAgIHRoaXMuX3NjZW5lID0gbnVsbDtcbiAgICAgICAgdGhpcy5fbm9kZSA9IG51bGw7XG5cbiAgICAgICAgLy8gcHJpdmF0ZSByZW5kZXJpbmcgZGF0YVxuICAgICAgICB0aGlzLl9yZW5kZXJEYXRhID0gW107XG5cbiAgICAgICAgLy8gdHJ1ZSBpZiB0aGUgbGlnaHQgaXMgdmlzaWJsZSBieSBhbnkgY2FtZXJhIHdpdGhpbiBhIGZyYW1lXG4gICAgICAgIHRoaXMudmlzaWJsZVRoaXNGcmFtZSA9IGZhbHNlO1xuXG4gICAgICAgIC8vIG1heGltdW0gc2l6ZSBvZiB0aGUgbGlnaHQgYm91bmRpbmcgc3BoZXJlIG9uIHRoZSBzY3JlZW4gYnkgYW55IGNhbWVyYSB3aXRoaW4gYSBmcmFtZVxuICAgICAgICAvLyAodXNlZCB0byBlc3RpbWF0ZSBzaGFkb3cgcmVzb2x1dGlvbiksIHJhbmdlIFswLi4xXVxuICAgICAgICB0aGlzLm1heFNjcmVlblNpemUgPSAwO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcblxuICAgICAgICB0aGlzLnJlbGVhc2VSZW5kZXJEYXRhKCk7XG4gICAgICAgIHRoaXMuX3JlbmRlckRhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIHJlbGVhc2VSZW5kZXJEYXRhKCkge1xuXG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJEYXRhKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3JlbmRlckRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJEYXRhW2ldLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fcmVuZGVyRGF0YS5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgc2V0IG51bUNhc2NhZGVzKHZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5jYXNjYWRlcyB8fCB0aGlzLm51bUNhc2NhZGVzICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5jYXNjYWRlcyA9IGRpcmVjdGlvbmFsQ2FzY2FkZXNbdmFsdWUgLSAxXTtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hdHJpeFBhbGV0dGUgPSBuZXcgRmxvYXQzMkFycmF5KDQgKiAxNik7ICAgLy8gYWx3YXlzIDRcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMgPSBuZXcgRmxvYXQzMkFycmF5KDQpOyAgICAgLy8gYWx3YXlzIDRcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbnVtQ2FzY2FkZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmNhc2NhZGVzLmxlbmd0aDtcbiAgICB9XG5cbiAgICBzZXQgc2hhZG93TWFwKHNoYWRvd01hcCkge1xuICAgICAgICBpZiAodGhpcy5fc2hhZG93TWFwICE9PSBzaGFkb3dNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hcCA9IHNoYWRvd01hcDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzaGFkb3dNYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zaGFkb3dNYXA7XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyBudW1iZXIgb2YgcmVuZGVyIHRhcmdldHMgdG8gcmVuZGVyIHRoZSBzaGFkb3cgbWFwXG4gICAgZ2V0IG51bVNoYWRvd0ZhY2VzKCkge1xuICAgICAgICBjb25zdCB0eXBlID0gdGhpcy5fdHlwZTtcbiAgICAgICAgaWYgKHR5cGUgPT09IExJR0hUVFlQRV9ESVJFQ1RJT05BTCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubnVtQ2FzY2FkZXM7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgIHJldHVybiA2O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuXG4gICAgICAgIGNvbnN0IHN0eXBlID0gdGhpcy5fc2hhZG93VHlwZTtcbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZG93VXBkYXRlT3ZlcnJpZGVzID0gbnVsbDtcbiAgICAgICAgdGhpcy5zaGFkb3dUeXBlID0gc3R5cGU7IC8vIHJlZnJlc2ggc2hhZG93IHR5cGU7IHN3aXRjaGluZyBmcm9tIGRpcmVjdC9zcG90IHRvIG9tbmkgYW5kIGJhY2sgbWF5IGNoYW5nZSBpdFxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICBzZXQgc2hhcGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3NoYXBlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9zaGFwZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG5cbiAgICAgICAgY29uc3Qgc3R5cGUgPSB0aGlzLl9zaGFkb3dUeXBlO1xuICAgICAgICB0aGlzLl9zaGFkb3dUeXBlID0gbnVsbDtcbiAgICAgICAgdGhpcy5zaGFkb3dUeXBlID0gc3R5cGU7IC8vIHJlZnJlc2ggc2hhZG93IHR5cGU7IHN3aXRjaGluZyBzaGFwZSBhbmQgYmFjayBtYXkgY2hhbmdlIGl0XG4gICAgfVxuXG4gICAgZ2V0IHNoYXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2hhcGU7XG4gICAgfVxuXG4gICAgc2V0IHVzZVBoeXNpY2FsVW5pdHModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl91c2VQaHlzaWNhbFVuaXRzID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdXNlUGh5c2ljYWxVbml0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VzZVBoeXNpY2FsVW5pdHM7XG4gICAgfVxuXG4gICAgc2V0IHNoYWRvd1R5cGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3NoYWRvd1R5cGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSlcbiAgICAgICAgICAgIHZhbHVlID0gU0hBRE9XX1BDRjM7IC8vIFZTTSBvciBIVyBQQ0YgZm9yIG9tbmkgbGlnaHRzIGlzIG5vdCBzdXBwb3J0ZWQgeWV0XG5cbiAgICAgICAgY29uc3Qgc3VwcG9ydHNQQ0Y1ID0gZGV2aWNlLnN1cHBvcnRzRGVwdGhTaGFkb3c7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gU0hBRE9XX1BDRjUgJiYgIXN1cHBvcnRzUENGNSkge1xuICAgICAgICAgICAgdmFsdWUgPSBTSEFET1dfUENGMzsgLy8gZmFsbGJhY2sgZnJvbSBIVyBQQ0YgdG8gb2xkIFBDRlxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlID09PSBTSEFET1dfVlNNMzIgJiYgIWRldmljZS50ZXh0dXJlRmxvYXRSZW5kZXJhYmxlKSAvLyBmYWxsYmFjayBmcm9tIHZzbTMyIHRvIHZzbTE2XG4gICAgICAgICAgICB2YWx1ZSA9IFNIQURPV19WU00xNjtcblxuICAgICAgICBpZiAodmFsdWUgPT09IFNIQURPV19WU00xNiAmJiAhZGV2aWNlLnRleHR1cmVIYWxmRmxvYXRSZW5kZXJhYmxlKSAvLyBmYWxsYmFjayBmcm9tIHZzbTE2IHRvIHZzbThcbiAgICAgICAgICAgIHZhbHVlID0gU0hBRE9XX1ZTTTg7XG5cbiAgICAgICAgdGhpcy5faXNWc20gPSB2YWx1ZSA+PSBTSEFET1dfVlNNOCAmJiB2YWx1ZSA8PSBTSEFET1dfVlNNMzI7XG4gICAgICAgIHRoaXMuX2lzUGNmID0gdmFsdWUgPT09IFNIQURPV19QQ0Y1IHx8IHZhbHVlID09PSBTSEFET1dfUENGMztcblxuICAgICAgICB0aGlzLl9zaGFkb3dUeXBlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgc2hhZG93VHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd1R5cGU7XG4gICAgfVxuXG4gICAgc2V0IGVuYWJsZWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZWQgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLmxheWVyc0RpcnR5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG4gICAgfVxuXG4gICAgc2V0IGNhc3RTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jYXN0U2hhZG93cyAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nhc3RTaGFkb3dzID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgICAgICB0aGlzLmxheWVyc0RpcnR5KCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FzdFNoYWRvd3MgJiYgdGhpcy5tYXNrICE9PSBNQVNLX0JBS0UgJiYgdGhpcy5tYXNrICE9PSAwO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dSZXNvbHV0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dSZXNvbHV0aW9uICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBNYXRoLm1pbih2YWx1ZSwgdGhpcy5kZXZpY2UubWF4Q3ViZU1hcFNpemUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IE1hdGgubWluKHZhbHVlLCB0aGlzLmRldmljZS5tYXhUZXh0dXJlU2l6ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2hhZG93UmVzb2x1dGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgfVxuXG4gICAgc2V0IHZzbUJsdXJTaXplKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl92c21CbHVyU2l6ZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHZhbHVlICUgMiA9PT0gMCkgdmFsdWUrKzsgLy8gZG9uJ3QgYWxsb3cgZXZlbiBzaXplXG4gICAgICAgIHRoaXMuX3ZzbUJsdXJTaXplID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHZzbUJsdXJTaXplKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdnNtQmx1clNpemU7XG4gICAgfVxuXG4gICAgc2V0IG5vcm1hbE9mZnNldEJpYXModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX25vcm1hbE9mZnNldEJpYXMgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICgoIXRoaXMuX25vcm1hbE9mZnNldEJpYXMgJiYgdmFsdWUpIHx8ICh0aGlzLl9ub3JtYWxPZmZzZXRCaWFzICYmICF2YWx1ZSkpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBub3JtYWxPZmZzZXRCaWFzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICB9XG5cbiAgICBzZXQgZmFsbG9mZk1vZGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZhbGxvZmZNb2RlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mYWxsb2ZmTW9kZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBmYWxsb2ZmTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZhbGxvZmZNb2RlO1xuICAgIH1cblxuICAgIHNldCBpbm5lckNvbmVBbmdsZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5faW5uZXJDb25lQW5nbGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3ModmFsdWUgKiBNYXRoLlBJIC8gMTgwKTtcbiAgICAgICAgaWYgKHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpbm5lckNvbmVBbmdsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lubmVyQ29uZUFuZ2xlO1xuICAgIH1cblxuICAgIHNldCBvdXRlckNvbmVBbmdsZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fb3V0ZXJDb25lQW5nbGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU91dGVyQW5nbGUodmFsdWUpO1xuXG4gICAgICAgIGlmICh0aGlzLl91c2VQaHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb3V0ZXJDb25lQW5nbGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vdXRlckNvbmVBbmdsZTtcbiAgICB9XG5cbiAgICBfdXBkYXRlT3V0ZXJBbmdsZShhbmdsZSkge1xuICAgICAgICBjb25zdCByYWRBbmdsZSA9IGFuZ2xlICogTWF0aC5QSSAvIDE4MDtcbiAgICAgICAgdGhpcy5fb3V0ZXJDb25lQW5nbGVDb3MgPSBNYXRoLmNvcyhyYWRBbmdsZSk7XG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlU2luID0gTWF0aC5zaW4ocmFkQW5nbGUpO1xuICAgIH1cblxuICAgIHNldCBpbnRlbnNpdHkodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ludGVuc2l0eSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2ludGVuc2l0eSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlRmluYWxDb2xvcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGludGVuc2l0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ludGVuc2l0eTtcbiAgICB9XG5cbiAgICBzZXQgbHVtaW5hbmNlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9sdW1pbmFuY2UgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9sdW1pbmFuY2UgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsdW1pbmFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sdW1pbmFuY2U7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZU1hdHJpeCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9jb29raWVNYXRyaXgpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU1hdHJpeCA9IG5ldyBNYXQ0KCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZU1hdHJpeDtcbiAgICB9XG5cbiAgICBnZXQgYXRsYXNWaWV3cG9ydCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hdGxhc1ZpZXdwb3J0KSB7XG4gICAgICAgICAgICB0aGlzLl9hdGxhc1ZpZXdwb3J0ID0gbmV3IFZlYzQoMCwgMCwgMSwgMSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX2F0bGFzVmlld3BvcnQ7XG4gICAgfVxuXG4gICAgc2V0IGNvb2tpZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jb29raWUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llO1xuICAgIH1cblxuICAgIHNldCBjb29raWVGYWxsb2ZmKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVGYWxsb2ZmID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jb29raWVGYWxsb2ZmID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZUZhbGxvZmYoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVGYWxsb2ZmO1xuICAgIH1cblxuICAgIHNldCBjb29raWVDaGFubmVsKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVDaGFubmVsID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAodmFsdWUubGVuZ3RoIDwgMykge1xuICAgICAgICAgICAgY29uc3QgY2hyID0gdmFsdWUuY2hhckF0KHZhbHVlLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgY29uc3QgYWRkTGVuID0gMyAtIHZhbHVlLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWRkTGVuOyBpKyspXG4gICAgICAgICAgICAgICAgdmFsdWUgKz0gY2hyO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2Nvb2tpZUNoYW5uZWwgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llQ2hhbm5lbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZUNoYW5uZWw7XG4gICAgfVxuXG4gICAgc2V0IGNvb2tpZVRyYW5zZm9ybSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llVHJhbnNmb3JtID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9jb29raWVUcmFuc2Zvcm0gPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtU2V0ID0gISF2YWx1ZTtcbiAgICAgICAgaWYgKHZhbHVlICYmICF0aGlzLl9jb29raWVPZmZzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuY29va2llT2Zmc2V0ID0gbmV3IFZlYzIoKTsgLy8gdXNpbmcgdHJhbnNmb3JtIGZvcmNlcyB1c2luZyBvZmZzZXQgY29kZVxuICAgICAgICAgICAgdGhpcy5fY29va2llT2Zmc2V0U2V0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llVHJhbnNmb3JtKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llVHJhbnNmb3JtO1xuICAgIH1cblxuICAgIHNldCBjb29raWVPZmZzZXQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZU9mZnNldCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgY29uc3QgeGZvcm1OZXcgPSAhISh0aGlzLl9jb29raWVUcmFuc2Zvcm1TZXQgfHwgdmFsdWUpO1xuICAgICAgICBpZiAoeGZvcm1OZXcgJiYgIXZhbHVlICYmIHRoaXMuX2Nvb2tpZU9mZnNldCkge1xuICAgICAgICAgICAgdGhpcy5fY29va2llT2Zmc2V0LnNldCgwLCAwKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldFNldCA9ICEhdmFsdWU7XG4gICAgICAgIGlmICh2YWx1ZSAmJiAhdGhpcy5fY29va2llVHJhbnNmb3JtKSB7XG4gICAgICAgICAgICB0aGlzLmNvb2tpZVRyYW5zZm9ybSA9IG5ldyBWZWM0KDEsIDEsIDAsIDApOyAvLyB1c2luZyBvZmZzZXQgZm9yY2VzIHVzaW5nIG1hdHJpeCBjb2RlXG4gICAgICAgICAgICB0aGlzLl9jb29raWVUcmFuc2Zvcm1TZXQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBjb29raWVPZmZzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVPZmZzZXQ7XG4gICAgfVxuXG4gICAgLy8gcHJlcGFyZXMgbGlnaHQgZm9yIHRoZSBmcmFtZSByZW5kZXJpbmdcbiAgICBiZWdpbkZyYW1lKCkge1xuICAgICAgICB0aGlzLnZpc2libGVUaGlzRnJhbWUgPSB0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwgJiYgdGhpcy5fZW5hYmxlZDtcbiAgICAgICAgdGhpcy5tYXhTY3JlZW5TaXplID0gMDtcbiAgICAgICAgdGhpcy5hdGxhc1ZpZXdwb3J0QWxsb2NhdGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYXRsYXNTbG90VXBkYXRlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIGRlc3Ryb3lzIHNoYWRvdyBtYXAgcmVsYXRlZCByZXNvdXJjZXMsIGNhbGxlZCB3aGVuIHNoYWRvdyBwcm9wZXJ0aWVzIGNoYW5nZSBhbmQgcmVzb3VyY2VzXG4gICAgLy8gbmVlZCB0byBiZSByZWNyZWF0ZWRcbiAgICBfZGVzdHJveVNoYWRvd01hcCgpIHtcblxuICAgICAgICB0aGlzLnJlbGVhc2VSZW5kZXJEYXRhKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX3NoYWRvd01hcCkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9zaGFkb3dNYXAuY2FjaGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2hhZG93TWFwLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hcCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVNb2RlID09PSBTSEFET1dVUERBVEVfTk9ORSkge1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dVcGRhdGVNb2RlID0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnNoYWRvd1VwZGF0ZU92ZXJyaWRlcykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNoYWRvd1VwZGF0ZU92ZXJyaWRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnNoYWRvd1VwZGF0ZU92ZXJyaWRlc1tpXSA9PT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXNbaV0gPSBTSEFET1dVUERBVEVfVEhJU0ZSQU1FO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHJldHVybnMgTGlnaHRSZW5kZXJEYXRhIHdpdGggbWF0Y2hpbmcgY2FtZXJhIGFuZCBmYWNlXG4gICAgZ2V0UmVuZGVyRGF0YShjYW1lcmEsIGZhY2UpIHtcblxuICAgICAgICAvLyByZXR1cm5zIGV4aXN0aW5nXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fcmVuZGVyRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IHRoaXMuX3JlbmRlckRhdGFbaV07XG4gICAgICAgICAgICBpZiAoY3VycmVudC5jYW1lcmEgPT09IGNhbWVyYSAmJiBjdXJyZW50LmZhY2UgPT09IGZhY2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY3VycmVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNyZWF0ZSBuZXcgb25lXG4gICAgICAgIGNvbnN0IHJkID0gbmV3IExpZ2h0UmVuZGVyRGF0YSh0aGlzLmRldmljZSwgY2FtZXJhLCBmYWNlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5fcmVuZGVyRGF0YS5wdXNoKHJkKTtcbiAgICAgICAgcmV0dXJuIHJkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIER1cGxpY2F0ZXMgYSBsaWdodCBub2RlIGJ1dCBkb2VzIG5vdCAnZGVlcCBjb3B5JyB0aGUgaGllcmFyY2h5LlxuICAgICAqXG4gICAgICogQHJldHVybnMge0xpZ2h0fSBBIGNsb25lZCBMaWdodC5cbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgY29uc3QgY2xvbmUgPSBuZXcgTGlnaHQodGhpcy5kZXZpY2UpO1xuXG4gICAgICAgIC8vIENsb25lIExpZ2h0IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUudHlwZSA9IHRoaXMuX3R5cGU7XG4gICAgICAgIGNsb25lLnNldENvbG9yKHRoaXMuX2NvbG9yKTtcbiAgICAgICAgY2xvbmUuaW50ZW5zaXR5ID0gdGhpcy5faW50ZW5zaXR5O1xuICAgICAgICBjbG9uZS5sdW1pbmFuY2UgPSB0aGlzLl9sdW1pbmFuY2U7XG4gICAgICAgIGNsb25lLmNhc3RTaGFkb3dzID0gdGhpcy5jYXN0U2hhZG93cztcbiAgICAgICAgY2xvbmUuX2VuYWJsZWQgPSB0aGlzLl9lbmFibGVkO1xuXG4gICAgICAgIC8vIE9tbmkgYW5kIHNwb3QgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5hdHRlbnVhdGlvblN0YXJ0ID0gdGhpcy5hdHRlbnVhdGlvblN0YXJ0O1xuICAgICAgICBjbG9uZS5hdHRlbnVhdGlvbkVuZCA9IHRoaXMuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgIGNsb25lLmZhbGxvZmZNb2RlID0gdGhpcy5fZmFsbG9mZk1vZGU7XG4gICAgICAgIGNsb25lLnNoYWRvd1R5cGUgPSB0aGlzLl9zaGFkb3dUeXBlO1xuICAgICAgICBjbG9uZS52c21CbHVyU2l6ZSA9IHRoaXMuX3ZzbUJsdXJTaXplO1xuICAgICAgICBjbG9uZS52c21CbHVyTW9kZSA9IHRoaXMudnNtQmx1ck1vZGU7XG4gICAgICAgIGNsb25lLnZzbUJpYXMgPSB0aGlzLnZzbUJpYXM7XG4gICAgICAgIGNsb25lLnNoYWRvd1VwZGF0ZU1vZGUgPSB0aGlzLnNoYWRvd1VwZGF0ZU1vZGU7XG4gICAgICAgIGNsb25lLm1hc2sgPSB0aGlzLm1hc2s7XG5cbiAgICAgICAgaWYgKHRoaXMuc2hhZG93VXBkYXRlT3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICBjbG9uZS5zaGFkb3dVcGRhdGVPdmVycmlkZXMgPSB0aGlzLnNoYWRvd1VwZGF0ZU92ZXJyaWRlcy5zbGljZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3BvdCBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLmlubmVyQ29uZUFuZ2xlID0gdGhpcy5faW5uZXJDb25lQW5nbGU7XG4gICAgICAgIGNsb25lLm91dGVyQ29uZUFuZ2xlID0gdGhpcy5fb3V0ZXJDb25lQW5nbGU7XG5cbiAgICAgICAgLy8gRGlyZWN0aW9uYWwgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5udW1DYXNjYWRlcyA9IHRoaXMubnVtQ2FzY2FkZXM7XG4gICAgICAgIGNsb25lLmNhc2NhZGVEaXN0cmlidXRpb24gPSB0aGlzLmNhc2NhZGVEaXN0cmlidXRpb247XG5cbiAgICAgICAgLy8gc2hhcGUgcHJvcGVydGllc1xuICAgICAgICBjbG9uZS5zaGFwZSA9IHRoaXMuX3NoYXBlO1xuXG4gICAgICAgIC8vIFNoYWRvdyBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLnNoYWRvd0JpYXMgPSB0aGlzLnNoYWRvd0JpYXM7XG4gICAgICAgIGNsb25lLm5vcm1hbE9mZnNldEJpYXMgPSB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzO1xuICAgICAgICBjbG9uZS5zaGFkb3dSZXNvbHV0aW9uID0gdGhpcy5fc2hhZG93UmVzb2x1dGlvbjtcbiAgICAgICAgY2xvbmUuc2hhZG93RGlzdGFuY2UgPSB0aGlzLnNoYWRvd0Rpc3RhbmNlO1xuICAgICAgICBjbG9uZS5zaGFkb3dJbnRlbnNpdHkgPSB0aGlzLnNoYWRvd0ludGVuc2l0eTtcblxuICAgICAgICAvLyBDb29raWVzIHByb3BlcnRpZXNcbiAgICAgICAgLy8gY2xvbmUuY29va2llID0gdGhpcy5fY29va2llO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVJbnRlbnNpdHkgPSB0aGlzLmNvb2tpZUludGVuc2l0eTtcbiAgICAgICAgLy8gY2xvbmUuY29va2llRmFsbG9mZiA9IHRoaXMuX2Nvb2tpZUZhbGxvZmY7XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZUNoYW5uZWwgPSB0aGlzLl9jb29raWVDaGFubmVsO1xuICAgICAgICAvLyBjbG9uZS5jb29raWVUcmFuc2Zvcm0gPSB0aGlzLl9jb29raWVUcmFuc2Zvcm07XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZU9mZnNldCA9IHRoaXMuX2Nvb2tpZU9mZnNldDtcblxuICAgICAgICByZXR1cm4gY2xvbmU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IGNvbnZlcnNpb24gZmFjdG9yIGZvciBsdW1pbmFuY2UgLT4gbGlnaHQgc3BlY2lmaWMgbGlnaHQgdW5pdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB0eXBlIC0gVGhlIHR5cGUgb2YgbGlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtvdXRlckFuZ2xlXSAtIFRoZSBvdXRlciBhbmdsZSBvZiBhIHNwb3QgbGlnaHQuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtpbm5lckFuZ2xlXSAtIFRoZSBpbm5lciBhbmdsZSBvZiBhIHNwb3QgbGlnaHQuXG4gICAgICogQHJldHVybnMge251bWJlcn0gVGhlIHNjYWxpbmcgZmFjdG9yIHRvIG11bHRpcGx5IHdpdGggdGhlIGx1bWluYW5jZSB2YWx1ZS5cbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0TGlnaHRVbml0Q29udmVyc2lvbih0eXBlLCBvdXRlckFuZ2xlID0gTWF0aC5QSSAvIDQsIGlubmVyQW5nbGUgPSAwKSB7XG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfU1BPVDoge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZhbGxvZmZFbmQgPSBNYXRoLmNvcyhvdXRlckFuZ2xlKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmYWxsb2ZmU3RhcnQgPSBNYXRoLmNvcyhpbm5lckFuZ2xlKTtcblxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tbXAvcGJydC12NC9ibG9iL2ZhYWMzNGQxYTBlYmQyNDkyODgyOGZlOWZhNjViNjVmN2VmYzU5Mzcvc3JjL3BicnQvbGlnaHRzLmNwcCNMMTQ2M1xuICAgICAgICAgICAgICAgIHJldHVybiAoMiAqIE1hdGguUEkgKiAoKDEgLSBmYWxsb2ZmU3RhcnQpICsgKGZhbGxvZmZTdGFydCAtIGZhbGxvZmZFbmQpIC8gMi4wKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9PTU5JOlxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ29vZ2xlLmdpdGh1Yi5pby9maWxhbWVudC9GaWxhbWVudC5tZC5odG1sI2xpZ2h0aW5nL2RpcmVjdGxpZ2h0aW5nL3B1bmN0dWFsbGlnaHRzL3BvaW50bGlnaHRzXG4gICAgICAgICAgICAgICAgcmV0dXJuICg0ICogTWF0aC5QSSk7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9ESVJFQ1RJT05BTDpcbiAgICAgICAgICAgICAgICAvLyBodHRwczovL2dvb2dsZS5naXRodWIuaW8vZmlsYW1lbnQvRmlsYW1lbnQubWQuaHRtbCNsaWdodGluZy9kaXJlY3RsaWdodGluZy9kaXJlY3Rpb25hbGxpZ2h0c1xuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmV0dXJucyB0aGUgYmlhcyAoLngpIGFuZCBub3JtYWxCaWFzICgueSkgdmFsdWUgZm9yIGxpZ2h0cyBhcyBwYXNzZWQgdG8gc2hhZGVycyBieSB1bmlmb3Jtc1xuICAgIC8vIE5vdGU6IHRoaXMgbmVlZHMgdG8gYmUgcmV2aXNpdGVkIGFuZCBzaW1wbGlmaWVkXG4gICAgLy8gTm90ZTogdnNtQmlhcyBpcyBub3QgdXNlZCBhdCBhbGwgZm9yIG9tbmkgbGlnaHQsIGV2ZW4gdGhvdWdoIGl0IGlzIGVkaXRhYmxlIGluIHRoZSBFZGl0b3JcbiAgICBfZ2V0VW5pZm9ybUJpYXNWYWx1ZXMobGlnaHRSZW5kZXJEYXRhKSB7XG5cbiAgICAgICAgY29uc3QgZmFyQ2xpcCA9IGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dDYW1lcmEuX2ZhckNsaXA7XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLl90eXBlKSB7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9PTU5JOlxuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gdGhpcy5zaGFkb3dCaWFzO1xuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5ub3JtYWxCaWFzID0gdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgTElHSFRUWVBFX1NQT1Q6XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2lzVnNtKSB7XG4gICAgICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gLTAuMDAwMDEgKiAyMDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9IHRoaXMuc2hhZG93QmlhcyAqIDIwOyAvLyBhcHByb3ggcmVtYXAgZnJvbSBvbGQgYmlhcyB2YWx1ZXNcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRldmljZS53ZWJnbDIgJiYgdGhpcy5kZXZpY2UuZXh0U3RhbmRhcmREZXJpdmF0aXZlcykgdG1wQmlhc2VzLmJpYXMgKj0gLTEwMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdG1wQmlhc2VzLm5vcm1hbEJpYXMgPSB0aGlzLl9pc1ZzbSA/IHRoaXMudnNtQmlhcyAvICh0aGlzLmF0dGVudWF0aW9uRW5kIC8gNy4wKSA6IHRoaXMuX25vcm1hbE9mZnNldEJpYXM7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9ESVJFQ1RJT05BTDpcbiAgICAgICAgICAgICAgICAvLyBtYWtlIGJpYXMgZGVwZW5kZW50IG9uIGZhciBwbGFuZSBiZWNhdXNlIGl0J3Mgbm90IGNvbnN0YW50IGZvciBkaXJlY3QgbGlnaHRcbiAgICAgICAgICAgICAgICAvLyBjbGlwIGRpc3RhbmNlIHVzZWQgaXMgYmFzZWQgb24gdGhlIG5lYXJlc3Qgc2hhZG93IGNhc2NhZGVcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNWc20pIHtcbiAgICAgICAgICAgICAgICAgICAgdG1wQmlhc2VzLmJpYXMgPSAtMC4wMDAwMSAqIDIwO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gKHRoaXMuc2hhZG93QmlhcyAvIGZhckNsaXApICogMTAwO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGV2aWNlLndlYmdsMiAmJiB0aGlzLmRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB0bXBCaWFzZXMuYmlhcyAqPSAtMTAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0bXBCaWFzZXMubm9ybWFsQmlhcyA9IHRoaXMuX2lzVnNtID8gdGhpcy52c21CaWFzIC8gKGZhckNsaXAgLyA3LjApIDogdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0bXBCaWFzZXM7XG4gICAgfVxuXG4gICAgZ2V0Q29sb3IoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb2xvcjtcbiAgICB9XG5cbiAgICBnZXRCb3VuZGluZ1NwaGVyZShzcGhlcmUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG5cbiAgICAgICAgICAgIC8vIGJhc2VkIG9uIGh0dHBzOi8vYmFydHdyb25za2kuY29tLzIwMTcvMDQvMTMvY3VsbC10aGF0LWNvbmUvXG4gICAgICAgICAgICBjb25zdCBzaXplID0gdGhpcy5hdHRlbnVhdGlvbkVuZDtcbiAgICAgICAgICAgIGNvbnN0IGFuZ2xlID0gdGhpcy5fb3V0ZXJDb25lQW5nbGU7XG4gICAgICAgICAgICBjb25zdCBjb3NBbmdsZSA9IHRoaXMuX291dGVyQ29uZUFuZ2xlQ29zO1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuX25vZGU7XG4gICAgICAgICAgICB0bXBWZWMuY29weShub2RlLnVwKTtcblxuICAgICAgICAgICAgaWYgKGFuZ2xlID4gNDUpIHtcbiAgICAgICAgICAgICAgICBzcGhlcmUucmFkaXVzID0gc2l6ZSAqIHRoaXMuX291dGVyQ29uZUFuZ2xlU2luO1xuICAgICAgICAgICAgICAgIHRtcFZlYy5tdWxTY2FsYXIoLXNpemUgKiBjb3NBbmdsZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNwaGVyZS5yYWRpdXMgPSBzaXplIC8gKDIgKiBjb3NBbmdsZSk7XG4gICAgICAgICAgICAgICAgdG1wVmVjLm11bFNjYWxhcigtc3BoZXJlLnJhZGl1cyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNwaGVyZS5jZW50ZXIuYWRkMihub2RlLmdldFBvc2l0aW9uKCksIHRtcFZlYyk7XG5cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgc3BoZXJlLmNlbnRlciA9IHRoaXMuX25vZGUuZ2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgIHNwaGVyZS5yYWRpdXMgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0Qm91bmRpbmdCb3goYm94KSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgY29uc3QgcmFuZ2UgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgY29uc3QgYW5nbGUgPSB0aGlzLl9vdXRlckNvbmVBbmdsZTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLl9ub2RlO1xuXG4gICAgICAgICAgICBjb25zdCBzY2wgPSBNYXRoLmFicyhNYXRoLnNpbihhbmdsZSAqIG1hdGguREVHX1RPX1JBRCkgKiByYW5nZSk7XG5cbiAgICAgICAgICAgIGJveC5jZW50ZXIuc2V0KDAsIC1yYW5nZSAqIDAuNSwgMCk7XG4gICAgICAgICAgICBib3guaGFsZkV4dGVudHMuc2V0KHNjbCwgcmFuZ2UgKiAwLjUsIHNjbCk7XG5cbiAgICAgICAgICAgIGJveC5zZXRGcm9tVHJhbnNmb3JtZWRBYWJiKGJveCwgbm9kZS5nZXRXb3JsZFRyYW5zZm9ybSgpLCB0cnVlKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICBib3guY2VudGVyLmNvcHkodGhpcy5fbm9kZS5nZXRQb3NpdGlvbigpKTtcbiAgICAgICAgICAgIGJveC5oYWxmRXh0ZW50cy5zZXQodGhpcy5hdHRlbnVhdGlvbkVuZCwgdGhpcy5hdHRlbnVhdGlvbkVuZCwgdGhpcy5hdHRlbnVhdGlvbkVuZCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlRmluYWxDb2xvcigpIHtcbiAgICAgICAgY29uc3QgY29sb3IgPSB0aGlzLl9jb2xvcjtcbiAgICAgICAgY29uc3QgciA9IGNvbG9yLnI7XG4gICAgICAgIGNvbnN0IGcgPSBjb2xvci5nO1xuICAgICAgICBjb25zdCBiID0gY29sb3IuYjtcblxuICAgICAgICBsZXQgaSA9IHRoaXMuX2ludGVuc2l0eTtcblxuICAgICAgICAvLyBUbyBjYWxjdWxhdGUgdGhlIGx1eCwgd2hpY2ggaXMgbG0vbV4yLCB3ZSBuZWVkIHRvIGNvbnZlcnQgZnJvbSBsdW1pbm91cyBwb3dlclxuICAgICAgICBpZiAodGhpcy5fdXNlUGh5c2ljYWxVbml0cykge1xuICAgICAgICAgICAgaSA9IHRoaXMuX2x1bWluYW5jZSAvIExpZ2h0LmdldExpZ2h0VW5pdENvbnZlcnNpb24odGhpcy5fdHlwZSwgdGhpcy5fb3V0ZXJDb25lQW5nbGUgKiBtYXRoLkRFR19UT19SQUQsIHRoaXMuX2lubmVyQ29uZUFuZ2xlICogbWF0aC5ERUdfVE9fUkFEKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpbmFsQ29sb3IgPSB0aGlzLl9maW5hbENvbG9yO1xuICAgICAgICBjb25zdCBsaW5lYXJGaW5hbENvbG9yID0gdGhpcy5fbGluZWFyRmluYWxDb2xvcjtcblxuICAgICAgICBmaW5hbENvbG9yWzBdID0gciAqIGk7XG4gICAgICAgIGZpbmFsQ29sb3JbMV0gPSBnICogaTtcbiAgICAgICAgZmluYWxDb2xvclsyXSA9IGIgKiBpO1xuICAgICAgICBpZiAoaSA+PSAxKSB7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzBdID0gTWF0aC5wb3cociwgMi4yKSAqIGk7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzFdID0gTWF0aC5wb3coZywgMi4yKSAqIGk7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzJdID0gTWF0aC5wb3coYiwgMi4yKSAqIGk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzBdID0gTWF0aC5wb3coZmluYWxDb2xvclswXSwgMi4yKTtcbiAgICAgICAgICAgIGxpbmVhckZpbmFsQ29sb3JbMV0gPSBNYXRoLnBvdyhmaW5hbENvbG9yWzFdLCAyLjIpO1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclsyXSA9IE1hdGgucG93KGZpbmFsQ29sb3JbMl0sIDIuMik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRDb2xvcigpIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLnNldChhcmd1bWVudHNbMF0uciwgYXJndW1lbnRzWzBdLmcsIGFyZ3VtZW50c1swXS5iKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICB0aGlzLl9jb2xvci5zZXQoYXJndW1lbnRzWzBdLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgfVxuXG4gICAgbGF5ZXJzRGlydHkoKSB7XG4gICAgICAgIGlmICh0aGlzLl9zY2VuZT8ubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLl9zY2VuZS5sYXllcnMuX2RpcnR5TGlnaHRzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUtleSgpIHtcbiAgICAgICAgLy8gS2V5IGRlZmluaXRpb246XG4gICAgICAgIC8vIEJpdFxuICAgICAgICAvLyAzMSAgICAgIDogc2lnbiBiaXQgKGxlYXZlKVxuICAgICAgICAvLyAyOSAtIDMwIDogdHlwZVxuICAgICAgICAvLyAyOCAgICAgIDogY2FzdCBzaGFkb3dzXG4gICAgICAgIC8vIDI1IC0gMjcgOiBzaGFkb3cgdHlwZVxuICAgICAgICAvLyAyMyAtIDI0IDogZmFsbG9mZiBtb2RlXG4gICAgICAgIC8vIDIyICAgICAgOiBub3JtYWwgb2Zmc2V0IGJpYXNcbiAgICAgICAgLy8gMjEgICAgICA6IGNvb2tpZVxuICAgICAgICAvLyAyMCAgICAgIDogY29va2llIGZhbGxvZmZcbiAgICAgICAgLy8gMTggLSAxOSA6IGNvb2tpZSBjaGFubmVsIFJcbiAgICAgICAgLy8gMTYgLSAxNyA6IGNvb2tpZSBjaGFubmVsIEdcbiAgICAgICAgLy8gMTQgLSAxNSA6IGNvb2tpZSBjaGFubmVsIEJcbiAgICAgICAgLy8gMTIgICAgICA6IGNvb2tpZSB0cmFuc2Zvcm1cbiAgICAgICAgLy8gMTAgLSAxMSA6IGxpZ2h0IHNvdXJjZSBzaGFwZVxuICAgICAgICAvLyAgOCAtICA5IDogbGlnaHQgbnVtIGNhc2NhZGVzXG4gICAgICAgIGxldCBrZXkgPVxuICAgICAgICAgICAgICAgKHRoaXMuX3R5cGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDI5KSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX2Nhc3RTaGFkb3dzID8gMSA6IDApICAgICAgICAgICAgICAgPDwgMjgpIHxcbiAgICAgICAgICAgICAgICh0aGlzLl9zaGFkb3dUeXBlICAgICAgICAgICAgICAgICAgICAgICAgICA8PCAyNSkgfFxuICAgICAgICAgICAgICAgKHRoaXMuX2ZhbGxvZmZNb2RlICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDIzKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX25vcm1hbE9mZnNldEJpYXMgIT09IDAuMCA/IDEgOiAwKSAgPDwgMjIpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY29va2llID8gMSA6IDApICAgICAgICAgICAgICAgICAgICA8PCAyMSkgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9jb29raWVGYWxsb2ZmID8gMSA6IDApICAgICAgICAgICAgIDw8IDIwKSB8XG4gICAgICAgICAgICAgICAoY2hhbklkW3RoaXMuX2Nvb2tpZUNoYW5uZWwuY2hhckF0KDApXSAgICAgPDwgMTgpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY29va2llVHJhbnNmb3JtID8gMSA6IDApICAgICAgICAgICA8PCAxMikgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9zaGFwZSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDEwKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMubnVtQ2FzY2FkZXMgLSAxKSAgICAgICAgICAgICAgICAgICAgPDwgIDgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9jb29raWVDaGFubmVsLmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAga2V5IHw9IChjaGFuSWRbdGhpcy5fY29va2llQ2hhbm5lbC5jaGFyQXQoMSldIDw8IDE2KTtcbiAgICAgICAgICAgIGtleSB8PSAoY2hhbklkW3RoaXMuX2Nvb2tpZUNoYW5uZWwuY2hhckF0KDIpXSA8PCAxNCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5ICE9PSB0aGlzLmtleSAmJiB0aGlzLl9zY2VuZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gVE9ETzogbW9zdCBvZiB0aGUgY2hhbmdlcyB0byB0aGUga2V5IHNob3VsZCBub3QgaW52YWxpZGF0ZSB0aGUgY29tcG9zaXRpb24sXG4gICAgICAgICAgICAvLyBwcm9iYWJseSBvbmx5IF90eXBlIGFuZCBfY2FzdFNoYWRvd3NcbiAgICAgICAgICAgIHRoaXMubGF5ZXJzRGlydHkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHQsIGxpZ2h0VHlwZXMgfTtcbiJdLCJuYW1lcyI6WyJ0bXBWZWMiLCJWZWMzIiwidG1wQmlhc2VzIiwiYmlhcyIsIm5vcm1hbEJpYXMiLCJjaGFuSWQiLCJyIiwiZyIsImIiLCJhIiwibGlnaHRUeXBlcyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIkxJR0hUVFlQRV9PTU5JIiwiTElHSFRUWVBFX1NQT1QiLCJkaXJlY3Rpb25hbENhc2NhZGVzIiwiVmVjNCIsImlkIiwiTGlnaHRSZW5kZXJEYXRhIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJjYW1lcmEiLCJmYWNlIiwibGlnaHQiLCJzaGFkb3dDYW1lcmEiLCJTaGFkb3dSZW5kZXJlciIsImNyZWF0ZVNoYWRvd0NhbWVyYSIsIl9zaGFkb3dUeXBlIiwiX3R5cGUiLCJzaGFkb3dNYXRyaXgiLCJNYXQ0Iiwic2hhZG93Vmlld3BvcnQiLCJzaGFkb3dTY2lzc29yIiwidmlzaWJsZUNhc3RlcnMiLCJ2aWV3QmluZEdyb3VwcyIsImRlc3Ryb3kiLCJmb3JFYWNoIiwiYmciLCJkZWZhdWx0VW5pZm9ybUJ1ZmZlciIsImxlbmd0aCIsInNoYWRvd0J1ZmZlciIsInJ0IiwicmVuZGVyVGFyZ2V0IiwiY29sb3JCdWZmZXIiLCJfaXNQY2YiLCJzdXBwb3J0c0RlcHRoU2hhZG93IiwiZGVwdGhCdWZmZXIiLCJMaWdodCIsImdyYXBoaWNzRGV2aWNlIiwiX2NvbG9yIiwiQ29sb3IiLCJfaW50ZW5zaXR5IiwiX2x1bWluYW5jZSIsIl9jYXN0U2hhZG93cyIsIl9lbmFibGVkIiwibWFzayIsIk1BU0tfQUZGRUNUX0RZTkFNSUMiLCJpc1N0YXRpYyIsImtleSIsImJha2VEaXIiLCJiYWtlTnVtU2FtcGxlcyIsImJha2VBcmVhIiwiYXR0ZW51YXRpb25TdGFydCIsImF0dGVudWF0aW9uRW5kIiwiX2ZhbGxvZmZNb2RlIiwiTElHSFRGQUxMT0ZGX0xJTkVBUiIsIlNIQURPV19QQ0YzIiwiX3ZzbUJsdXJTaXplIiwidnNtQmx1ck1vZGUiLCJCTFVSX0dBVVNTSUFOIiwidnNtQmlhcyIsIl9jb29raWUiLCJjb29raWVJbnRlbnNpdHkiLCJfY29va2llRmFsbG9mZiIsIl9jb29raWVDaGFubmVsIiwiX2Nvb2tpZVRyYW5zZm9ybSIsIl9jb29raWVUcmFuc2Zvcm1Vbmlmb3JtIiwiRmxvYXQzMkFycmF5IiwiX2Nvb2tpZU9mZnNldCIsIl9jb29raWVPZmZzZXRVbmlmb3JtIiwiX2Nvb2tpZVRyYW5zZm9ybVNldCIsIl9jb29raWVPZmZzZXRTZXQiLCJfaW5uZXJDb25lQW5nbGUiLCJfb3V0ZXJDb25lQW5nbGUiLCJjYXNjYWRlcyIsIl9zaGFkb3dNYXRyaXhQYWxldHRlIiwiX3NoYWRvd0Nhc2NhZGVEaXN0YW5jZXMiLCJudW1DYXNjYWRlcyIsImNhc2NhZGVEaXN0cmlidXRpb24iLCJfc2hhcGUiLCJMSUdIVFNIQVBFX1BVTkNUVUFMIiwiX2ZpbmFsQ29sb3IiLCJjIiwiTWF0aCIsInBvdyIsIl9saW5lYXJGaW5hbENvbG9yIiwiX3Bvc2l0aW9uIiwiX2RpcmVjdGlvbiIsIl9pbm5lckNvbmVBbmdsZUNvcyIsImNvcyIsIlBJIiwiX3VwZGF0ZU91dGVyQW5nbGUiLCJfdXNlUGh5c2ljYWxVbml0cyIsInVuZGVmaW5lZCIsIl9zaGFkb3dNYXAiLCJfc2hhZG93UmVuZGVyUGFyYW1zIiwic2hhZG93RGlzdGFuY2UiLCJfc2hhZG93UmVzb2x1dGlvbiIsInNoYWRvd0JpYXMiLCJzaGFkb3dJbnRlbnNpdHkiLCJfbm9ybWFsT2Zmc2V0QmlhcyIsInNoYWRvd1VwZGF0ZU1vZGUiLCJTSEFET1dVUERBVEVfUkVBTFRJTUUiLCJzaGFkb3dVcGRhdGVPdmVycmlkZXMiLCJfaXNWc20iLCJfY29va2llTWF0cml4IiwiX2F0bGFzVmlld3BvcnQiLCJhdGxhc1ZpZXdwb3J0QWxsb2NhdGVkIiwiYXRsYXNWZXJzaW9uIiwiYXRsYXNTbG90SW5kZXgiLCJhdGxhc1Nsb3RVcGRhdGVkIiwiX3NjZW5lIiwiX25vZGUiLCJfcmVuZGVyRGF0YSIsInZpc2libGVUaGlzRnJhbWUiLCJtYXhTY3JlZW5TaXplIiwiX2Rlc3Ryb3lTaGFkb3dNYXAiLCJyZWxlYXNlUmVuZGVyRGF0YSIsImkiLCJ2YWx1ZSIsInVwZGF0ZUtleSIsInNoYWRvd01hcCIsIm51bVNoYWRvd0ZhY2VzIiwidHlwZSIsInN0eXBlIiwic2hhZG93VHlwZSIsInNoYXBlIiwidXNlUGh5c2ljYWxVbml0cyIsIl91cGRhdGVGaW5hbENvbG9yIiwic3VwcG9ydHNQQ0Y1IiwiU0hBRE9XX1BDRjUiLCJTSEFET1dfVlNNMzIiLCJ0ZXh0dXJlRmxvYXRSZW5kZXJhYmxlIiwiU0hBRE9XX1ZTTTE2IiwidGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUiLCJTSEFET1dfVlNNOCIsImVuYWJsZWQiLCJsYXllcnNEaXJ0eSIsImNhc3RTaGFkb3dzIiwiTUFTS19CQUtFIiwic2hhZG93UmVzb2x1dGlvbiIsIm1pbiIsIm1heEN1YmVNYXBTaXplIiwibWF4VGV4dHVyZVNpemUiLCJ2c21CbHVyU2l6ZSIsIm5vcm1hbE9mZnNldEJpYXMiLCJmYWxsb2ZmTW9kZSIsImlubmVyQ29uZUFuZ2xlIiwib3V0ZXJDb25lQW5nbGUiLCJhbmdsZSIsInJhZEFuZ2xlIiwiX291dGVyQ29uZUFuZ2xlQ29zIiwiX291dGVyQ29uZUFuZ2xlU2luIiwic2luIiwiaW50ZW5zaXR5IiwibHVtaW5hbmNlIiwiY29va2llTWF0cml4IiwiYXRsYXNWaWV3cG9ydCIsImNvb2tpZSIsImNvb2tpZUZhbGxvZmYiLCJjb29raWVDaGFubmVsIiwiY2hyIiwiY2hhckF0IiwiYWRkTGVuIiwiY29va2llVHJhbnNmb3JtIiwiY29va2llT2Zmc2V0IiwiVmVjMiIsInhmb3JtTmV3Iiwic2V0IiwiYmVnaW5GcmFtZSIsImNhY2hlZCIsIlNIQURPV1VQREFURV9OT05FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsImdldFJlbmRlckRhdGEiLCJjdXJyZW50IiwicmQiLCJwdXNoIiwiY2xvbmUiLCJzZXRDb2xvciIsInNsaWNlIiwiZ2V0TGlnaHRVbml0Q29udmVyc2lvbiIsIm91dGVyQW5nbGUiLCJpbm5lckFuZ2xlIiwiZmFsbG9mZkVuZCIsImZhbGxvZmZTdGFydCIsIl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyIsImxpZ2h0UmVuZGVyRGF0YSIsImZhckNsaXAiLCJfZmFyQ2xpcCIsIndlYmdsMiIsImV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMiLCJnZXRDb2xvciIsImdldEJvdW5kaW5nU3BoZXJlIiwic3BoZXJlIiwic2l6ZSIsImNvc0FuZ2xlIiwibm9kZSIsImNvcHkiLCJ1cCIsInJhZGl1cyIsIm11bFNjYWxhciIsImNlbnRlciIsImFkZDIiLCJnZXRQb3NpdGlvbiIsImdldEJvdW5kaW5nQm94IiwiYm94IiwicmFuZ2UiLCJzY2wiLCJhYnMiLCJtYXRoIiwiREVHX1RPX1JBRCIsImhhbGZFeHRlbnRzIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsImdldFdvcmxkVHJhbnNmb3JtIiwiY29sb3IiLCJmaW5hbENvbG9yIiwibGluZWFyRmluYWxDb2xvciIsImFyZ3VtZW50cyIsImxheWVycyIsIl9kaXJ0eUxpZ2h0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFpQkEsTUFBTUEsTUFBTSxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBO0FBQ3pCLE1BQU1DLFNBQVMsR0FBRztBQUNkQyxFQUFBQSxJQUFJLEVBQUUsQ0FBQztBQUNQQyxFQUFBQSxVQUFVLEVBQUUsQ0FBQTtBQUNoQixDQUFDLENBQUE7QUFFRCxNQUFNQyxNQUFNLEdBQUc7QUFBRUMsRUFBQUEsQ0FBQyxFQUFFLENBQUM7QUFBRUMsRUFBQUEsQ0FBQyxFQUFFLENBQUM7QUFBRUMsRUFBQUEsQ0FBQyxFQUFFLENBQUM7QUFBRUMsRUFBQUEsQ0FBQyxFQUFFLENBQUE7QUFBRSxDQUFDLENBQUE7QUFFekMsTUFBTUMsVUFBVSxHQUFHO0FBQ2YsRUFBQSxhQUFhLEVBQUVDLHFCQUFxQjtBQUNwQyxFQUFBLE1BQU0sRUFBRUMsY0FBYztBQUN0QixFQUFBLE9BQU8sRUFBRUEsY0FBYztBQUN2QixFQUFBLE1BQU0sRUFBRUMsY0FBQUE7QUFDWixFQUFDOztBQUVEO0FBQ0EsTUFBTUMsbUJBQW1CLEdBQUcsQ0FDeEIsQ0FBQyxJQUFJQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFDdEIsQ0FBQyxJQUFJQSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSUEsSUFBSSxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLEVBQ3RELENBQUMsSUFBSUEsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFF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
