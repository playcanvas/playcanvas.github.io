import { math } from '../core/math/math.js';
import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { LIGHTTYPE_DIRECTIONAL, MASK_AFFECT_DYNAMIC, LIGHTFALLOFF_LINEAR, SHADOW_PCF3, BLUR_GAUSSIAN, LIGHTSHAPE_PUNCTUAL, SHADOWUPDATE_REALTIME, LIGHTTYPE_OMNI, SHADOW_PCSS, SHADOW_PCF5, SHADOW_VSM32, SHADOW_VSM16, SHADOW_VSM8, SHADOW_PCF1, MASK_BAKE, SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME, LIGHTTYPE_SPOT } from './constants.js';
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

    // depth range compensation for PCSS with directional lights
    this.depthRangeCompensation = 0;

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
    this._affectSpecularity = true;
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
    this._shadowCameraParams = [];

    // Shadow mapping properties
    this.shadowDistance = 40;
    this._shadowResolution = 1024;
    this.shadowBias = -0.0005;
    this.shadowIntensity = 1.0;
    this._normalOffsetBias = 0.0;
    this.shadowUpdateMode = SHADOWUPDATE_REALTIME;
    this.shadowUpdateOverrides = null;
    this._penumbraSize = 1.0;
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
    if (this._type === LIGHTTYPE_OMNI && value !== SHADOW_PCF3 && value !== SHADOW_PCSS) value = SHADOW_PCF3; // VSM or HW PCF for omni lights is not supported yet

    const supportsDepthShadow = device.supportsDepthShadow;
    if (value === SHADOW_PCF5 && !supportsDepthShadow) {
      value = SHADOW_PCF3; // fallback from HW PCF to old PCF
    }

    if (value === SHADOW_VSM32 && !device.textureFloatRenderable)
      // fallback from vsm32 to vsm16
      value = SHADOW_VSM16;
    if (value === SHADOW_VSM16 && !device.textureHalfFloatRenderable)
      // fallback from vsm16 to vsm8
      value = SHADOW_VSM8;
    this._isVsm = value >= SHADOW_VSM8 && value <= SHADOW_VSM32;
    this._isPcf = value === SHADOW_PCF1 || value === SHADOW_PCF3 || value === SHADOW_PCF5;
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
  set penumbraSize(value) {
    this._penumbraSize = value;
  }
  get penumbraSize() {
    return this._penumbraSize;
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
  set affectSpecularity(value) {
    if (this._type === LIGHTTYPE_DIRECTIONAL) {
      this._affectSpecularity = value;
      this.updateKey();
    }
  }
  get affectSpecularity() {
    return this._affectSpecularity;
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
    clone.affectSpecularity = this._affectSpecularity;
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
    clone.penumbraSize = this.penumbraSize;
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
    //  7 : disable specular
    let key = this._type << 29 | (this._castShadows ? 1 : 0) << 28 | this._shadowType << 25 | this._falloffMode << 23 | (this._normalOffsetBias !== 0.0 ? 1 : 0) << 22 | (this._cookie ? 1 : 0) << 21 | (this._cookieFalloff ? 1 : 0) << 20 | chanId[this._cookieChannel.charAt(0)] << 18 | (this._cookieTransform ? 1 : 0) << 12 | this._shape << 10 | this.numCascades - 1 << 8 | (this.affectSpecularity ? 1 : 0) << 7;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9saWdodC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi9jb3JlL21hdGgvY29sb3IuanMnO1xuaW1wb3J0IHsgTWF0NCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXQ0LmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vY29yZS9tYXRoL3ZlYzMuanMnO1xuaW1wb3J0IHsgVmVjNCB9IGZyb20gJy4uL2NvcmUvbWF0aC92ZWM0LmpzJztcblxuaW1wb3J0IHtcbiAgICBCTFVSX0dBVVNTSUFOLFxuICAgIExJR0hUVFlQRV9ESVJFQ1RJT05BTCwgTElHSFRUWVBFX09NTkksIExJR0hUVFlQRV9TUE9ULFxuICAgIE1BU0tfQkFLRSwgTUFTS19BRkZFQ1RfRFlOQU1JQyxcbiAgICBTSEFET1dfUENGMSwgU0hBRE9XX1BDRjMsIFNIQURPV19QQ0Y1LCBTSEFET1dfVlNNOCwgU0hBRE9XX1ZTTTE2LCBTSEFET1dfVlNNMzIsIFNIQURPV19QQ1NTLFxuICAgIFNIQURPV1VQREFURV9OT05FLCBTSEFET1dVUERBVEVfUkVBTFRJTUUsIFNIQURPV1VQREFURV9USElTRlJBTUUsXG4gICAgTElHSFRTSEFQRV9QVU5DVFVBTCwgTElHSFRGQUxMT0ZGX0xJTkVBUlxufSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTaGFkb3dSZW5kZXJlciB9IGZyb20gJy4vcmVuZGVyZXIvc2hhZG93LXJlbmRlcmVyLmpzJztcblxuY29uc3QgdG1wVmVjID0gbmV3IFZlYzMoKTtcbmNvbnN0IHRtcEJpYXNlcyA9IHtcbiAgICBiaWFzOiAwLFxuICAgIG5vcm1hbEJpYXM6IDBcbn07XG5cbmNvbnN0IGNoYW5JZCA9IHsgcjogMCwgZzogMSwgYjogMiwgYTogMyB9O1xuXG5jb25zdCBsaWdodFR5cGVzID0ge1xuICAgICdkaXJlY3Rpb25hbCc6IExJR0hUVFlQRV9ESVJFQ1RJT05BTCxcbiAgICAnb21uaSc6IExJR0hUVFlQRV9PTU5JLFxuICAgICdwb2ludCc6IExJR0hUVFlQRV9PTU5JLFxuICAgICdzcG90JzogTElHSFRUWVBFX1NQT1Rcbn07XG5cbi8vIHZpZXdwb3J0IGluIHNoYWRvd3MgbWFwIGZvciBjYXNjYWRlcyBmb3IgZGlyZWN0aW9uYWwgbGlnaHRcbmNvbnN0IGRpcmVjdGlvbmFsQ2FzY2FkZXMgPSBbXG4gICAgW25ldyBWZWM0KDAsIDAsIDEsIDEpXSxcbiAgICBbbmV3IFZlYzQoMCwgMCwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLCAwLjUsIDAuNSwgMC41KV0sXG4gICAgW25ldyBWZWM0KDAsIDAsIDAuNSwgMC41KSwgbmV3IFZlYzQoMCwgMC41LCAwLjUsIDAuNSksIG5ldyBWZWM0KDAuNSwgMCwgMC41LCAwLjUpXSxcbiAgICBbbmV3IFZlYzQoMCwgMCwgMC41LCAwLjUpLCBuZXcgVmVjNCgwLCAwLjUsIDAuNSwgMC41KSwgbmV3IFZlYzQoMC41LCAwLCAwLjUsIDAuNSksIG5ldyBWZWM0KDAuNSwgMC41LCAwLjUsIDAuNSldXG5dO1xuXG5sZXQgaWQgPSAwO1xuXG4vLyBDbGFzcyBzdG9yaW5nIHNoYWRvdyByZW5kZXJpbmcgcmVsYXRlZCBwcml2YXRlIGluZm9ybWF0aW9uXG5jbGFzcyBMaWdodFJlbmRlckRhdGEge1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgY2FtZXJhLCBmYWNlLCBsaWdodCkge1xuXG4gICAgICAgIC8vIGxpZ2h0IHRoaXMgZGF0YSBiZWxvbmdzIHRvXG4gICAgICAgIHRoaXMubGlnaHQgPSBsaWdodDtcblxuICAgICAgICAvLyBjYW1lcmEgdGhpcyBhcHBsaWVzIHRvLiBPbmx5IHVzZWQgYnkgZGlyZWN0aW9uYWwgbGlnaHQsIGFzIGRpcmVjdGlvbmFsIHNoYWRvdyBtYXBcbiAgICAgICAgLy8gaXMgY3VsbGVkIGFuZCByZW5kZXJlZCBmb3IgZWFjaCBjYW1lcmEuIExvY2FsIGxpZ2h0cycgc2hhZG93IGlzIGN1bGxlZCBhbmQgcmVuZGVyZWQgb25lIHRpbWVcbiAgICAgICAgLy8gYW5kIHNoYXJlZCBiZXR3ZWVuIGNhbWVyYXMgKGV2ZW4gdGhvdWdoIGl0J3Mgbm90IHN0cmljdGx5IGNvcnJlY3QgYW5kIHdlIGNhbiBnZXQgc2hhZG93c1xuICAgICAgICAvLyBmcm9tIGEgbWVzaCB0aGF0IGlzIG5vdCB2aXNpYmxlIGJ5IHRoZSBjYW1lcmEpXG4gICAgICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xuXG4gICAgICAgIC8vIGNhbWVyYSB1c2VkIHRvIGN1bGwgLyByZW5kZXIgdGhlIHNoYWRvdyBtYXBcbiAgICAgICAgdGhpcy5zaGFkb3dDYW1lcmEgPSBTaGFkb3dSZW5kZXJlci5jcmVhdGVTaGFkb3dDYW1lcmEoZGV2aWNlLCBsaWdodC5fc2hhZG93VHlwZSwgbGlnaHQuX3R5cGUsIGZhY2UpO1xuXG4gICAgICAgIC8vIHNoYWRvdyB2aWV3LXByb2plY3Rpb24gbWF0cml4XG4gICAgICAgIHRoaXMuc2hhZG93TWF0cml4ID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvLyB2aWV3cG9ydCBmb3IgdGhlIHNoYWRvdyByZW5kZXJpbmcgdG8gdGhlIHRleHR1cmUgKHgsIHksIHdpZHRoLCBoZWlnaHQpXG4gICAgICAgIHRoaXMuc2hhZG93Vmlld3BvcnQgPSBuZXcgVmVjNCgwLCAwLCAxLCAxKTtcblxuICAgICAgICAvLyBzY2lzc29yIHJlY3RhbmdsZSBmb3IgdGhlIHNoYWRvdyByZW5kZXJpbmcgdG8gdGhlIHRleHR1cmUgKHgsIHksIHdpZHRoLCBoZWlnaHQpXG4gICAgICAgIHRoaXMuc2hhZG93U2Npc3NvciA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuXG4gICAgICAgIC8vIGRlcHRoIHJhbmdlIGNvbXBlbnNhdGlvbiBmb3IgUENTUyB3aXRoIGRpcmVjdGlvbmFsIGxpZ2h0c1xuICAgICAgICB0aGlzLmRlcHRoUmFuZ2VDb21wZW5zYXRpb24gPSAwO1xuXG4gICAgICAgIC8vIGZhY2UgaW5kZXgsIHZhbHVlIGlzIGJhc2VkIG9uIGxpZ2h0IHR5cGU6XG4gICAgICAgIC8vIC0gc3BvdDogYWx3YXlzIDBcbiAgICAgICAgLy8gLSBvbW5pOiBjdWJlbWFwIGZhY2UsIDAuLjVcbiAgICAgICAgLy8gLSBkaXJlY3Rpb25hbDogMCBmb3Igc2ltcGxlIHNoYWRvd3MsIGNhc2NhZGUgaW5kZXggZm9yIGNhc2NhZGVkIHNoYWRvdyBtYXBcbiAgICAgICAgdGhpcy5mYWNlID0gZmFjZTtcblxuICAgICAgICAvLyB2aXNpYmxlIHNoYWRvdyBjYXN0ZXJzXG4gICAgICAgIHRoaXMudmlzaWJsZUNhc3RlcnMgPSBbXTtcblxuICAgICAgICAvLyBhbiBhcnJheSBvZiB2aWV3IGJpbmQgZ3JvdXBzLCBzaW5nbGUgZW50cnkgaXMgdXNlZCBmb3Igc2hhZG93c1xuICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmluZC1ncm91cC5qcycpLkJpbmRHcm91cFtdfSAqL1xuICAgICAgICB0aGlzLnZpZXdCaW5kR3JvdXBzID0gW107XG4gICAgfVxuXG4gICAgLy8gcmVsZWFzZXMgR1BVIHJlc291cmNlc1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMudmlld0JpbmRHcm91cHMuZm9yRWFjaCgoYmcpID0+IHtcbiAgICAgICAgICAgIGJnLmRlZmF1bHRVbmlmb3JtQnVmZmVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIGJnLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMudmlld0JpbmRHcm91cHMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIHNoYWRvdyBidWZmZXIgY3VycmVudGx5IGF0dGFjaGVkIHRvIHRoZSBzaGFkb3cgY2FtZXJhXG4gICAgZ2V0IHNoYWRvd0J1ZmZlcigpIHtcbiAgICAgICAgY29uc3QgcnQgPSB0aGlzLnNoYWRvd0NhbWVyYS5yZW5kZXJUYXJnZXQ7XG4gICAgICAgIGlmIChydCkge1xuICAgICAgICAgICAgY29uc3QgbGlnaHQgPSB0aGlzLmxpZ2h0O1xuICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBydC5jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIGxpZ2h0Ll9pc1BjZiAmJiBsaWdodC5kZXZpY2Uuc3VwcG9ydHNEZXB0aFNoYWRvdyA/IHJ0LmRlcHRoQnVmZmVyIDogcnQuY29sb3JCdWZmZXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogQSBsaWdodC5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIExpZ2h0IHtcbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuICAgICAgICB0aGlzLmlkID0gaWQrKztcblxuICAgICAgICAvLyBMaWdodCBwcm9wZXJ0aWVzIChkZWZhdWx0cylcbiAgICAgICAgdGhpcy5fdHlwZSA9IExJR0hUVFlQRV9ESVJFQ1RJT05BTDtcbiAgICAgICAgdGhpcy5fY29sb3IgPSBuZXcgQ29sb3IoMC44LCAwLjgsIDAuOCk7XG4gICAgICAgIHRoaXMuX2ludGVuc2l0eSA9IDE7XG4gICAgICAgIHRoaXMuX2FmZmVjdFNwZWN1bGFyaXR5ID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbHVtaW5hbmNlID0gMDtcbiAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3MgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLm1hc2sgPSBNQVNLX0FGRkVDVF9EWU5BTUlDO1xuICAgICAgICB0aGlzLmlzU3RhdGljID0gZmFsc2U7XG4gICAgICAgIHRoaXMua2V5ID0gMDtcbiAgICAgICAgdGhpcy5iYWtlRGlyID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5iYWtlTnVtU2FtcGxlcyA9IDE7XG4gICAgICAgIHRoaXMuYmFrZUFyZWEgPSAwO1xuXG4gICAgICAgIC8vIE9tbmkgYW5kIHNwb3QgcHJvcGVydGllc1xuICAgICAgICB0aGlzLmF0dGVudWF0aW9uU3RhcnQgPSAxMDtcbiAgICAgICAgdGhpcy5hdHRlbnVhdGlvbkVuZCA9IDEwO1xuICAgICAgICB0aGlzLl9mYWxsb2ZmTW9kZSA9IExJR0hURkFMTE9GRl9MSU5FQVI7XG4gICAgICAgIHRoaXMuX3NoYWRvd1R5cGUgPSBTSEFET1dfUENGMztcbiAgICAgICAgdGhpcy5fdnNtQmx1clNpemUgPSAxMTtcbiAgICAgICAgdGhpcy52c21CbHVyTW9kZSA9IEJMVVJfR0FVU1NJQU47XG4gICAgICAgIHRoaXMudnNtQmlhcyA9IDAuMDEgKiAwLjI1O1xuICAgICAgICB0aGlzLl9jb29raWUgPSBudWxsOyAvLyBsaWdodCBjb29raWUgdGV4dHVyZSAoMkQgZm9yIHNwb3QsIGN1YmVtYXAgZm9yIG9tbmkpXG4gICAgICAgIHRoaXMuY29va2llSW50ZW5zaXR5ID0gMTtcbiAgICAgICAgdGhpcy5fY29va2llRmFsbG9mZiA9IHRydWU7XG4gICAgICAgIHRoaXMuX2Nvb2tpZUNoYW5uZWwgPSAncmdiJztcbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtID0gbnVsbDsgLy8gMmQgcm90YXRpb24vc2NhbGUgbWF0cml4IChzcG90IG9ubHkpXG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXQgPSBudWxsOyAvLyAyZCBwb3NpdGlvbiBvZmZzZXQgKHNwb3Qgb25seSlcbiAgICAgICAgdGhpcy5fY29va2llT2Zmc2V0VW5pZm9ybSA9IG5ldyBGbG9hdDMyQXJyYXkoMik7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVNldCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXRTZXQgPSBmYWxzZTtcblxuICAgICAgICAvLyBTcG90IHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5faW5uZXJDb25lQW5nbGUgPSA0MDtcbiAgICAgICAgdGhpcy5fb3V0ZXJDb25lQW5nbGUgPSA0NTtcblxuICAgICAgICAvLyBEaXJlY3Rpb25hbCBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuY2FzY2FkZXMgPSBudWxsOyAgICAgICAgICAgICAgIC8vIGFuIGFycmF5IG9mIFZlYzQgdmlld3BvcnRzIHBlciBjYXNjYWRlXG4gICAgICAgIHRoaXMuX3NoYWRvd01hdHJpeFBhbGV0dGUgPSBudWxsOyAgIC8vIGEgZmxvYXQgYXJyYXksIDE2IGZsb2F0cyBwZXIgY2FzY2FkZVxuICAgICAgICB0aGlzLl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzID0gbnVsbDtcbiAgICAgICAgdGhpcy5udW1DYXNjYWRlcyA9IDE7XG4gICAgICAgIHRoaXMuY2FzY2FkZURpc3RyaWJ1dGlvbiA9IDAuNTtcblxuICAgICAgICAvLyBMaWdodCBzb3VyY2Ugc2hhcGUgcHJvcGVydGllc1xuICAgICAgICB0aGlzLl9zaGFwZSA9IExJR0hUU0hBUEVfUFVOQ1RVQUw7XG5cbiAgICAgICAgLy8gQ2FjaGUgb2YgbGlnaHQgcHJvcGVydHkgZGF0YSBpbiBhIGZvcm1hdCBtb3JlIGZyaWVuZGx5IGZvciBzaGFkZXIgdW5pZm9ybXNcbiAgICAgICAgdGhpcy5fZmluYWxDb2xvciA9IG5ldyBGbG9hdDMyQXJyYXkoWzAuOCwgMC44LCAwLjhdKTtcbiAgICAgICAgY29uc3QgYyA9IE1hdGgucG93KHRoaXMuX2ZpbmFsQ29sb3JbMF0sIDIuMik7XG4gICAgICAgIHRoaXMuX2xpbmVhckZpbmFsQ29sb3IgPSBuZXcgRmxvYXQzMkFycmF5KFtjLCBjLCBjXSk7XG5cbiAgICAgICAgdGhpcy5fcG9zaXRpb24gPSBuZXcgVmVjMygwLCAwLCAwKTtcbiAgICAgICAgdGhpcy5fZGlyZWN0aW9uID0gbmV3IFZlYzMoMCwgMCwgMCk7XG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3ModGhpcy5faW5uZXJDb25lQW5nbGUgKiBNYXRoLlBJIC8gMTgwKTtcbiAgICAgICAgdGhpcy5fdXBkYXRlT3V0ZXJBbmdsZSh0aGlzLl9vdXRlckNvbmVBbmdsZSk7XG5cbiAgICAgICAgdGhpcy5fdXNlUGh5c2ljYWxVbml0cyA9IHVuZGVmaW5lZDtcblxuICAgICAgICAvLyBTaGFkb3cgbWFwcGluZyByZXNvdXJjZXNcbiAgICAgICAgdGhpcy5fc2hhZG93TWFwID0gbnVsbDtcbiAgICAgICAgdGhpcy5fc2hhZG93UmVuZGVyUGFyYW1zID0gW107XG4gICAgICAgIHRoaXMuX3NoYWRvd0NhbWVyYVBhcmFtcyA9IFtdO1xuXG4gICAgICAgIC8vIFNoYWRvdyBtYXBwaW5nIHByb3BlcnRpZXNcbiAgICAgICAgdGhpcy5zaGFkb3dEaXN0YW5jZSA9IDQwO1xuICAgICAgICB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uID0gMTAyNDtcbiAgICAgICAgdGhpcy5zaGFkb3dCaWFzID0gLTAuMDAwNTtcbiAgICAgICAgdGhpcy5zaGFkb3dJbnRlbnNpdHkgPSAxLjA7XG4gICAgICAgIHRoaXMuX25vcm1hbE9mZnNldEJpYXMgPSAwLjA7XG4gICAgICAgIHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9SRUFMVElNRTtcbiAgICAgICAgdGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMgPSBudWxsO1xuICAgICAgICB0aGlzLl9wZW51bWJyYVNpemUgPSAxLjA7XG4gICAgICAgIHRoaXMuX2lzVnNtID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2lzUGNmID0gdHJ1ZTtcblxuICAgICAgICAvLyBjb29raWUgbWF0cml4ICh1c2VkIGluIGNhc2UgdGhlIHNoYWRvdyBtYXBwaW5nIGlzIGRpc2FibGVkIGFuZCBzbyB0aGUgc2hhZG93IG1hdHJpeCBjYW5ub3QgYmUgdXNlZClcbiAgICAgICAgdGhpcy5fY29va2llTWF0cml4ID0gbnVsbDtcblxuICAgICAgICAvLyB2aWV3cG9ydCBvZiB0aGUgY29va2llIHRleHR1cmUgLyBzaGFkb3cgaW4gdGhlIGF0bGFzXG4gICAgICAgIHRoaXMuX2F0bGFzVmlld3BvcnQgPSBudWxsO1xuICAgICAgICB0aGlzLmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQgPSBmYWxzZTsgICAgLy8gaWYgdHJ1ZSwgYXRsYXMgc2xvdCBpcyBhbGxvY2F0ZWQgZm9yIHRoZSBjdXJyZW50IGZyYW1lXG4gICAgICAgIHRoaXMuYXRsYXNWZXJzaW9uID0gMDsgICAgICAvLyB2ZXJzaW9uIG9mIHRoZSBhdGxhcyBmb3IgdGhlIGFsbG9jYXRlZCBzbG90LCBhbGxvd3MgaW52YWxpZGF0aW9uIHdoZW4gYXRsYXMgcmVjcmVhdGVzIHNsb3RzXG4gICAgICAgIHRoaXMuYXRsYXNTbG90SW5kZXggPSAwOyAgICAvLyBhbGxvY2F0ZWQgc2xvdCBpbmRleCwgdXNlZCBmb3IgbW9yZSBwZXJzaXN0ZW50IHNsb3QgYWxsb2NhdGlvblxuICAgICAgICB0aGlzLmF0bGFzU2xvdFVwZGF0ZWQgPSBmYWxzZTsgIC8vIHRydWUgaWYgdGhlIGF0bGFzIHNsb3Qgd2FzIHJlYXNzaWduZWQgdGhpcyBmcmFtZSAoYW5kIGNvbnRlbnQgbmVlZHMgdG8gYmUgdXBkYXRlZClcblxuICAgICAgICB0aGlzLl9zY2VuZSA9IG51bGw7XG4gICAgICAgIHRoaXMuX25vZGUgPSBudWxsO1xuXG4gICAgICAgIC8vIHByaXZhdGUgcmVuZGVyaW5nIGRhdGFcbiAgICAgICAgdGhpcy5fcmVuZGVyRGF0YSA9IFtdO1xuXG4gICAgICAgIC8vIHRydWUgaWYgdGhlIGxpZ2h0IGlzIHZpc2libGUgYnkgYW55IGNhbWVyYSB3aXRoaW4gYSBmcmFtZVxuICAgICAgICB0aGlzLnZpc2libGVUaGlzRnJhbWUgPSBmYWxzZTtcblxuICAgICAgICAvLyBtYXhpbXVtIHNpemUgb2YgdGhlIGxpZ2h0IGJvdW5kaW5nIHNwaGVyZSBvbiB0aGUgc2NyZWVuIGJ5IGFueSBjYW1lcmEgd2l0aGluIGEgZnJhbWVcbiAgICAgICAgLy8gKHVzZWQgdG8gZXN0aW1hdGUgc2hhZG93IHJlc29sdXRpb24pLCByYW5nZSBbMC4uMV1cbiAgICAgICAgdGhpcy5tYXhTY3JlZW5TaXplID0gMDtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG5cbiAgICAgICAgdGhpcy5yZWxlYXNlUmVuZGVyRGF0YSgpO1xuICAgICAgICB0aGlzLl9yZW5kZXJEYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICByZWxlYXNlUmVuZGVyRGF0YSgpIHtcblxuICAgICAgICBpZiAodGhpcy5fcmVuZGVyRGF0YSkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9yZW5kZXJEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVuZGVyRGF0YVtpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckRhdGEubGVuZ3RoID0gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldCBudW1DYXNjYWRlcyh2YWx1ZSkge1xuICAgICAgICBpZiAoIXRoaXMuY2FzY2FkZXMgfHwgdGhpcy5udW1DYXNjYWRlcyAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuY2FzY2FkZXMgPSBkaXJlY3Rpb25hbENhc2NhZGVzW3ZhbHVlIC0gMV07XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dNYXRyaXhQYWxldHRlID0gbmV3IEZsb2F0MzJBcnJheSg0ICogMTYpOyAgIC8vIGFsd2F5cyA0XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzID0gbmV3IEZsb2F0MzJBcnJheSg0KTsgICAgIC8vIGFsd2F5cyA0XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG51bUNhc2NhZGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYXNjYWRlcy5sZW5ndGg7XG4gICAgfVxuXG4gICAgc2V0IHNoYWRvd01hcChzaGFkb3dNYXApIHtcbiAgICAgICAgaWYgKHRoaXMuX3NoYWRvd01hcCAhPT0gc2hhZG93TWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dNYXAgPSBzaGFkb3dNYXA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2hhZG93TWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2hhZG93TWFwO1xuICAgIH1cblxuICAgIC8vIHJldHVybnMgbnVtYmVyIG9mIHJlbmRlciB0YXJnZXRzIHRvIHJlbmRlciB0aGUgc2hhZG93IG1hcFxuICAgIGdldCBudW1TaGFkb3dGYWNlcygpIHtcbiAgICAgICAgY29uc3QgdHlwZSA9IHRoaXMuX3R5cGU7XG4gICAgICAgIGlmICh0eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm51bUNhc2NhZGVzO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICByZXR1cm4gNjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIHNldCB0eXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcblxuICAgICAgICBjb25zdCBzdHlwZSA9IHRoaXMuX3NoYWRvd1R5cGU7XG4gICAgICAgIHRoaXMuX3NoYWRvd1R5cGUgPSBudWxsO1xuICAgICAgICB0aGlzLnNoYWRvd1VwZGF0ZU92ZXJyaWRlcyA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZG93VHlwZSA9IHN0eXBlOyAvLyByZWZyZXNoIHNoYWRvdyB0eXBlOyBzd2l0Y2hpbmcgZnJvbSBkaXJlY3Qvc3BvdCB0byBvbW5pIGFuZCBiYWNrIG1heSBjaGFuZ2UgaXRcbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgc2V0IHNoYXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFwZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fc2hhcGUgPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5fZGVzdHJveVNoYWRvd01hcCgpO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuXG4gICAgICAgIGNvbnN0IHN0eXBlID0gdGhpcy5fc2hhZG93VHlwZTtcbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IG51bGw7XG4gICAgICAgIHRoaXMuc2hhZG93VHlwZSA9IHN0eXBlOyAvLyByZWZyZXNoIHNoYWRvdyB0eXBlOyBzd2l0Y2hpbmcgc2hhcGUgYW5kIGJhY2sgbWF5IGNoYW5nZSBpdFxuICAgIH1cblxuICAgIGdldCBzaGFwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYXBlO1xuICAgIH1cblxuICAgIHNldCB1c2VQaHlzaWNhbFVuaXRzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl91c2VQaHlzaWNhbFVuaXRzICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fdXNlUGh5c2ljYWxVbml0cyA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlRmluYWxDb2xvcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHVzZVBoeXNpY2FsVW5pdHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl91c2VQaHlzaWNhbFVuaXRzO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dUeXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dUeXBlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkgJiYgdmFsdWUgIT09IFNIQURPV19QQ0YzICYmIHZhbHVlICE9PSBTSEFET1dfUENTUylcbiAgICAgICAgICAgIHZhbHVlID0gU0hBRE9XX1BDRjM7IC8vIFZTTSBvciBIVyBQQ0YgZm9yIG9tbmkgbGlnaHRzIGlzIG5vdCBzdXBwb3J0ZWQgeWV0XG5cbiAgICAgICAgY29uc3Qgc3VwcG9ydHNEZXB0aFNoYWRvdyA9IGRldmljZS5zdXBwb3J0c0RlcHRoU2hhZG93O1xuICAgICAgICBpZiAodmFsdWUgPT09IFNIQURPV19QQ0Y1ICYmICFzdXBwb3J0c0RlcHRoU2hhZG93KSB7XG4gICAgICAgICAgICB2YWx1ZSA9IFNIQURPV19QQ0YzOyAvLyBmYWxsYmFjayBmcm9tIEhXIFBDRiB0byBvbGQgUENGXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWUgPT09IFNIQURPV19WU00zMiAmJiAhZGV2aWNlLnRleHR1cmVGbG9hdFJlbmRlcmFibGUpIC8vIGZhbGxiYWNrIGZyb20gdnNtMzIgdG8gdnNtMTZcbiAgICAgICAgICAgIHZhbHVlID0gU0hBRE9XX1ZTTTE2O1xuXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gU0hBRE9XX1ZTTTE2ICYmICFkZXZpY2UudGV4dHVyZUhhbGZGbG9hdFJlbmRlcmFibGUpIC8vIGZhbGxiYWNrIGZyb20gdnNtMTYgdG8gdnNtOFxuICAgICAgICAgICAgdmFsdWUgPSBTSEFET1dfVlNNODtcblxuICAgICAgICB0aGlzLl9pc1ZzbSA9IHZhbHVlID49IFNIQURPV19WU004ICYmIHZhbHVlIDw9IFNIQURPV19WU00zMjtcbiAgICAgICAgdGhpcy5faXNQY2YgPSB2YWx1ZSA9PT0gU0hBRE9XX1BDRjEgfHwgdmFsdWUgPT09IFNIQURPV19QQ0YzIHx8IHZhbHVlID09PSBTSEFET1dfUENGNTtcblxuICAgICAgICB0aGlzLl9zaGFkb3dUeXBlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lTaGFkb3dNYXAoKTtcbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgc2hhZG93VHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd1R5cGU7XG4gICAgfVxuXG4gICAgc2V0IGVuYWJsZWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VuYWJsZWQgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9lbmFibGVkID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLmxheWVyc0RpcnR5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VuYWJsZWQ7XG4gICAgfVxuXG4gICAgc2V0IGNhc3RTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jYXN0U2hhZG93cyAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nhc3RTaGFkb3dzID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgICAgICB0aGlzLmxheWVyc0RpcnR5KCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FzdFNoYWRvd3MgJiYgdGhpcy5tYXNrICE9PSBNQVNLX0JBS0UgJiYgdGhpcy5tYXNrICE9PSAwO1xuICAgIH1cblxuICAgIHNldCBzaGFkb3dSZXNvbHV0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dSZXNvbHV0aW9uICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBNYXRoLm1pbih2YWx1ZSwgdGhpcy5kZXZpY2UubWF4Q3ViZU1hcFNpemUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IE1hdGgubWluKHZhbHVlLCB0aGlzLmRldmljZS5tYXhUZXh0dXJlU2l6ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9kZXN0cm95U2hhZG93TWFwKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2hhZG93UmVzb2x1dGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd1Jlc29sdXRpb247XG4gICAgfVxuXG4gICAgc2V0IHZzbUJsdXJTaXplKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl92c21CbHVyU2l6ZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHZhbHVlICUgMiA9PT0gMCkgdmFsdWUrKzsgLy8gZG9uJ3QgYWxsb3cgZXZlbiBzaXplXG4gICAgICAgIHRoaXMuX3ZzbUJsdXJTaXplID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IHZzbUJsdXJTaXplKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdnNtQmx1clNpemU7XG4gICAgfVxuXG4gICAgc2V0IG5vcm1hbE9mZnNldEJpYXModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX25vcm1hbE9mZnNldEJpYXMgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmICgoIXRoaXMuX25vcm1hbE9mZnNldEJpYXMgJiYgdmFsdWUpIHx8ICh0aGlzLl9ub3JtYWxPZmZzZXRCaWFzICYmICF2YWx1ZSkpIHtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBub3JtYWxPZmZzZXRCaWFzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICB9XG5cbiAgICBzZXQgZmFsbG9mZk1vZGUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ZhbGxvZmZNb2RlID09PSB2YWx1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9mYWxsb2ZmTW9kZSA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBmYWxsb2ZmTW9kZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZhbGxvZmZNb2RlO1xuICAgIH1cblxuICAgIHNldCBpbm5lckNvbmVBbmdsZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5faW5uZXJDb25lQW5nbGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2lubmVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3ModmFsdWUgKiBNYXRoLlBJIC8gMTgwKTtcbiAgICAgICAgaWYgKHRoaXMuX3VzZVBoeXNpY2FsVW5pdHMpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpbm5lckNvbmVBbmdsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lubmVyQ29uZUFuZ2xlO1xuICAgIH1cblxuICAgIHNldCBvdXRlckNvbmVBbmdsZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fb3V0ZXJDb25lQW5nbGUgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX3VwZGF0ZU91dGVyQW5nbGUodmFsdWUpO1xuXG4gICAgICAgIGlmICh0aGlzLl91c2VQaHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgb3V0ZXJDb25lQW5nbGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vdXRlckNvbmVBbmdsZTtcbiAgICB9XG5cbiAgICBzZXQgcGVudW1icmFTaXplKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX3BlbnVtYnJhU2l6ZSA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBwZW51bWJyYVNpemUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wZW51bWJyYVNpemU7XG4gICAgfVxuXG4gICAgX3VwZGF0ZU91dGVyQW5nbGUoYW5nbGUpIHtcbiAgICAgICAgY29uc3QgcmFkQW5nbGUgPSBhbmdsZSAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgIHRoaXMuX291dGVyQ29uZUFuZ2xlQ29zID0gTWF0aC5jb3MocmFkQW5nbGUpO1xuICAgICAgICB0aGlzLl9vdXRlckNvbmVBbmdsZVNpbiA9IE1hdGguc2luKHJhZEFuZ2xlKTtcbiAgICB9XG5cbiAgICBzZXQgaW50ZW5zaXR5KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbnRlbnNpdHkgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9pbnRlbnNpdHkgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpbnRlbnNpdHkoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnRlbnNpdHk7XG4gICAgfVxuXG4gICAgc2V0IGFmZmVjdFNwZWN1bGFyaXR5KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSBMSUdIVFRZUEVfRElSRUNUSU9OQUwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FmZmVjdFNwZWN1bGFyaXR5ID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFmZmVjdFNwZWN1bGFyaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYWZmZWN0U3BlY3VsYXJpdHk7XG4gICAgfVxuXG4gICAgc2V0IGx1bWluYW5jZSh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbHVtaW5hbmNlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbHVtaW5hbmNlID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVGaW5hbENvbG9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbHVtaW5hbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbHVtaW5hbmNlO1xuICAgIH1cblxuICAgIGdldCBjb29raWVNYXRyaXgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fY29va2llTWF0cml4KSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVNYXRyaXggPSBuZXcgTWF0NCgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVNYXRyaXg7XG4gICAgfVxuXG4gICAgZ2V0IGF0bGFzVmlld3BvcnQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXRsYXNWaWV3cG9ydCkge1xuICAgICAgICAgICAgdGhpcy5fYXRsYXNWaWV3cG9ydCA9IG5ldyBWZWM0KDAsIDAsIDEsIDEpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLl9hdGxhc1ZpZXdwb3J0O1xuICAgIH1cblxuICAgIHNldCBjb29raWUodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZTtcbiAgICB9XG5cbiAgICBzZXQgY29va2llRmFsbG9mZih2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llRmFsbG9mZiA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llRmFsbG9mZiA9IHZhbHVlO1xuICAgICAgICB0aGlzLnVwZGF0ZUtleSgpO1xuICAgIH1cblxuICAgIGdldCBjb29raWVGYWxsb2ZmKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llRmFsbG9mZjtcbiAgICB9XG5cbiAgICBzZXQgY29va2llQ2hhbm5lbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llQ2hhbm5lbCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNociA9IHZhbHVlLmNoYXJBdCh2YWx1ZS5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgIGNvbnN0IGFkZExlbiA9IDMgLSB2YWx1ZS5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFkZExlbjsgaSsrKVxuICAgICAgICAgICAgICAgIHZhbHVlICs9IGNocjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb29raWVDaGFubmVsID0gdmFsdWU7XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZUNoYW5uZWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVDaGFubmVsO1xuICAgIH1cblxuICAgIHNldCBjb29raWVUcmFuc2Zvcm0odmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nvb2tpZVRyYW5zZm9ybSA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtID0gdmFsdWU7XG4gICAgICAgIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybVNldCA9ICEhdmFsdWU7XG4gICAgICAgIGlmICh2YWx1ZSAmJiAhdGhpcy5fY29va2llT2Zmc2V0KSB7XG4gICAgICAgICAgICB0aGlzLmNvb2tpZU9mZnNldCA9IG5ldyBWZWMyKCk7IC8vIHVzaW5nIHRyYW5zZm9ybSBmb3JjZXMgdXNpbmcgb2Zmc2V0IGNvZGVcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldFNldCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudXBkYXRlS2V5KCk7XG4gICAgfVxuXG4gICAgZ2V0IGNvb2tpZVRyYW5zZm9ybSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nvb2tpZVRyYW5zZm9ybTtcbiAgICB9XG5cbiAgICBzZXQgY29va2llT2Zmc2V0KHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb29raWVPZmZzZXQgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IHhmb3JtTmV3ID0gISEodGhpcy5fY29va2llVHJhbnNmb3JtU2V0IHx8IHZhbHVlKTtcbiAgICAgICAgaWYgKHhmb3JtTmV3ICYmICF2YWx1ZSAmJiB0aGlzLl9jb29raWVPZmZzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nvb2tpZU9mZnNldC5zZXQoMCwgMCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVPZmZzZXQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9jb29raWVPZmZzZXRTZXQgPSAhIXZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgJiYgIXRoaXMuX2Nvb2tpZVRyYW5zZm9ybSkge1xuICAgICAgICAgICAgdGhpcy5jb29raWVUcmFuc2Zvcm0gPSBuZXcgVmVjNCgxLCAxLCAwLCAwKTsgLy8gdXNpbmcgb2Zmc2V0IGZvcmNlcyB1c2luZyBtYXRyaXggY29kZVxuICAgICAgICAgICAgdGhpcy5fY29va2llVHJhbnNmb3JtU2V0ID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy51cGRhdGVLZXkoKTtcbiAgICB9XG5cbiAgICBnZXQgY29va2llT2Zmc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29va2llT2Zmc2V0O1xuICAgIH1cblxuICAgIC8vIHByZXBhcmVzIGxpZ2h0IGZvciB0aGUgZnJhbWUgcmVuZGVyaW5nXG4gICAgYmVnaW5GcmFtZSgpIHtcbiAgICAgICAgdGhpcy52aXNpYmxlVGhpc0ZyYW1lID0gdGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX0RJUkVDVElPTkFMICYmIHRoaXMuX2VuYWJsZWQ7XG4gICAgICAgIHRoaXMubWF4U2NyZWVuU2l6ZSA9IDA7XG4gICAgICAgIHRoaXMuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmF0bGFzU2xvdFVwZGF0ZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBkZXN0cm95cyBzaGFkb3cgbWFwIHJlbGF0ZWQgcmVzb3VyY2VzLCBjYWxsZWQgd2hlbiBzaGFkb3cgcHJvcGVydGllcyBjaGFuZ2UgYW5kIHJlc291cmNlc1xuICAgIC8vIG5lZWQgdG8gYmUgcmVjcmVhdGVkXG4gICAgX2Rlc3Ryb3lTaGFkb3dNYXAoKSB7XG5cbiAgICAgICAgdGhpcy5yZWxlYXNlUmVuZGVyRGF0YSgpO1xuXG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dNYXApIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fc2hhZG93TWFwLmNhY2hlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NoYWRvd01hcC5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9zaGFkb3dNYXAgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9PT0gU0hBRE9XVVBEQVRFX05PTkUpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93VXBkYXRlTW9kZSA9IFNIQURPV1VQREFURV9USElTRlJBTUU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXNbaV0gPT09IFNIQURPV1VQREFURV9OT05FKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2hhZG93VXBkYXRlT3ZlcnJpZGVzW2ldID0gU0hBRE9XVVBEQVRFX1RISVNGUkFNRTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIExpZ2h0UmVuZGVyRGF0YSB3aXRoIG1hdGNoaW5nIGNhbWVyYSBhbmQgZmFjZVxuICAgIGdldFJlbmRlckRhdGEoY2FtZXJhLCBmYWNlKSB7XG5cbiAgICAgICAgLy8gcmV0dXJucyBleGlzdGluZ1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX3JlbmRlckRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnQgPSB0aGlzLl9yZW5kZXJEYXRhW2ldO1xuICAgICAgICAgICAgaWYgKGN1cnJlbnQuY2FtZXJhID09PSBjYW1lcmEgJiYgY3VycmVudC5mYWNlID09PSBmYWNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1cnJlbnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgbmV3IG9uZVxuICAgICAgICBjb25zdCByZCA9IG5ldyBMaWdodFJlbmRlckRhdGEodGhpcy5kZXZpY2UsIGNhbWVyYSwgZmFjZSwgdGhpcyk7XG4gICAgICAgIHRoaXMuX3JlbmRlckRhdGEucHVzaChyZCk7XG4gICAgICAgIHJldHVybiByZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEdXBsaWNhdGVzIGEgbGlnaHQgbm9kZSBidXQgZG9lcyBub3QgJ2RlZXAgY29weScgdGhlIGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtMaWdodH0gQSBjbG9uZWQgTGlnaHQuXG4gICAgICovXG4gICAgY2xvbmUoKSB7XG4gICAgICAgIGNvbnN0IGNsb25lID0gbmV3IExpZ2h0KHRoaXMuZGV2aWNlKTtcblxuICAgICAgICAvLyBDbG9uZSBMaWdodCBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLnR5cGUgPSB0aGlzLl90eXBlO1xuICAgICAgICBjbG9uZS5zZXRDb2xvcih0aGlzLl9jb2xvcik7XG4gICAgICAgIGNsb25lLmludGVuc2l0eSA9IHRoaXMuX2ludGVuc2l0eTtcbiAgICAgICAgY2xvbmUuYWZmZWN0U3BlY3VsYXJpdHkgPSB0aGlzLl9hZmZlY3RTcGVjdWxhcml0eTtcbiAgICAgICAgY2xvbmUubHVtaW5hbmNlID0gdGhpcy5fbHVtaW5hbmNlO1xuICAgICAgICBjbG9uZS5jYXN0U2hhZG93cyA9IHRoaXMuY2FzdFNoYWRvd3M7XG4gICAgICAgIGNsb25lLl9lbmFibGVkID0gdGhpcy5fZW5hYmxlZDtcblxuICAgICAgICAvLyBPbW5pIGFuZCBzcG90IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuYXR0ZW51YXRpb25TdGFydCA9IHRoaXMuYXR0ZW51YXRpb25TdGFydDtcbiAgICAgICAgY2xvbmUuYXR0ZW51YXRpb25FbmQgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICBjbG9uZS5mYWxsb2ZmTW9kZSA9IHRoaXMuX2ZhbGxvZmZNb2RlO1xuICAgICAgICBjbG9uZS5zaGFkb3dUeXBlID0gdGhpcy5fc2hhZG93VHlwZTtcbiAgICAgICAgY2xvbmUudnNtQmx1clNpemUgPSB0aGlzLl92c21CbHVyU2l6ZTtcbiAgICAgICAgY2xvbmUudnNtQmx1ck1vZGUgPSB0aGlzLnZzbUJsdXJNb2RlO1xuICAgICAgICBjbG9uZS52c21CaWFzID0gdGhpcy52c21CaWFzO1xuICAgICAgICBjbG9uZS5wZW51bWJyYVNpemUgPSB0aGlzLnBlbnVtYnJhU2l6ZTtcbiAgICAgICAgY2xvbmUuc2hhZG93VXBkYXRlTW9kZSA9IHRoaXMuc2hhZG93VXBkYXRlTW9kZTtcbiAgICAgICAgY2xvbmUubWFzayA9IHRoaXMubWFzaztcblxuICAgICAgICBpZiAodGhpcy5zaGFkb3dVcGRhdGVPdmVycmlkZXMpIHtcbiAgICAgICAgICAgIGNsb25lLnNoYWRvd1VwZGF0ZU92ZXJyaWRlcyA9IHRoaXMuc2hhZG93VXBkYXRlT3ZlcnJpZGVzLnNsaWNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTcG90IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuaW5uZXJDb25lQW5nbGUgPSB0aGlzLl9pbm5lckNvbmVBbmdsZTtcbiAgICAgICAgY2xvbmUub3V0ZXJDb25lQW5nbGUgPSB0aGlzLl9vdXRlckNvbmVBbmdsZTtcblxuICAgICAgICAvLyBEaXJlY3Rpb25hbCBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLm51bUNhc2NhZGVzID0gdGhpcy5udW1DYXNjYWRlcztcbiAgICAgICAgY2xvbmUuY2FzY2FkZURpc3RyaWJ1dGlvbiA9IHRoaXMuY2FzY2FkZURpc3RyaWJ1dGlvbjtcblxuICAgICAgICAvLyBzaGFwZSBwcm9wZXJ0aWVzXG4gICAgICAgIGNsb25lLnNoYXBlID0gdGhpcy5fc2hhcGU7XG5cbiAgICAgICAgLy8gU2hhZG93IHByb3BlcnRpZXNcbiAgICAgICAgY2xvbmUuc2hhZG93QmlhcyA9IHRoaXMuc2hhZG93QmlhcztcbiAgICAgICAgY2xvbmUubm9ybWFsT2Zmc2V0QmlhcyA9IHRoaXMuX25vcm1hbE9mZnNldEJpYXM7XG4gICAgICAgIGNsb25lLnNoYWRvd1Jlc29sdXRpb24gPSB0aGlzLl9zaGFkb3dSZXNvbHV0aW9uO1xuICAgICAgICBjbG9uZS5zaGFkb3dEaXN0YW5jZSA9IHRoaXMuc2hhZG93RGlzdGFuY2U7XG4gICAgICAgIGNsb25lLnNoYWRvd0ludGVuc2l0eSA9IHRoaXMuc2hhZG93SW50ZW5zaXR5O1xuXG4gICAgICAgIC8vIENvb2tpZXMgcHJvcGVydGllc1xuICAgICAgICAvLyBjbG9uZS5jb29raWUgPSB0aGlzLl9jb29raWU7XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZUludGVuc2l0eSA9IHRoaXMuY29va2llSW50ZW5zaXR5O1xuICAgICAgICAvLyBjbG9uZS5jb29raWVGYWxsb2ZmID0gdGhpcy5fY29va2llRmFsbG9mZjtcbiAgICAgICAgLy8gY2xvbmUuY29va2llQ2hhbm5lbCA9IHRoaXMuX2Nvb2tpZUNoYW5uZWw7XG4gICAgICAgIC8vIGNsb25lLmNvb2tpZVRyYW5zZm9ybSA9IHRoaXMuX2Nvb2tpZVRyYW5zZm9ybTtcbiAgICAgICAgLy8gY2xvbmUuY29va2llT2Zmc2V0ID0gdGhpcy5fY29va2llT2Zmc2V0O1xuXG4gICAgICAgIHJldHVybiBjbG9uZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgY29udmVyc2lvbiBmYWN0b3IgZm9yIGx1bWluYW5jZSAtPiBsaWdodCBzcGVjaWZpYyBsaWdodCB1bml0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHR5cGUgLSBUaGUgdHlwZSBvZiBsaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW291dGVyQW5nbGVdIC0gVGhlIG91dGVyIGFuZ2xlIG9mIGEgc3BvdCBsaWdodC5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2lubmVyQW5nbGVdIC0gVGhlIGlubmVyIGFuZ2xlIG9mIGEgc3BvdCBsaWdodC5cbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBUaGUgc2NhbGluZyBmYWN0b3IgdG8gbXVsdGlwbHkgd2l0aCB0aGUgbHVtaW5hbmNlIHZhbHVlLlxuICAgICAqL1xuICAgIHN0YXRpYyBnZXRMaWdodFVuaXRDb252ZXJzaW9uKHR5cGUsIG91dGVyQW5nbGUgPSBNYXRoLlBJIC8gNCwgaW5uZXJBbmdsZSA9IDApIHtcbiAgICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgICAgICBjYXNlIExJR0hUVFlQRV9TUE9UOiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmFsbG9mZkVuZCA9IE1hdGguY29zKG91dGVyQW5nbGUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZhbGxvZmZTdGFydCA9IE1hdGguY29zKGlubmVyQW5nbGUpO1xuXG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21tcC9wYnJ0LXY0L2Jsb2IvZmFhYzM0ZDFhMGViZDI0OTI4ODI4ZmU5ZmE2NWI2NWY3ZWZjNTkzNy9zcmMvcGJydC9saWdodHMuY3BwI0wxNDYzXG4gICAgICAgICAgICAgICAgcmV0dXJuICgyICogTWF0aC5QSSAqICgoMSAtIGZhbGxvZmZTdGFydCkgKyAoZmFsbG9mZlN0YXJ0IC0gZmFsbG9mZkVuZCkgLyAyLjApKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhc2UgTElHSFRUWVBFX09NTkk6XG4gICAgICAgICAgICAgICAgLy8gaHR0cHM6Ly9nb29nbGUuZ2l0aHViLmlvL2ZpbGFtZW50L0ZpbGFtZW50Lm1kLmh0bWwjbGlnaHRpbmcvZGlyZWN0bGlnaHRpbmcvcHVuY3R1YWxsaWdodHMvcG9pbnRsaWdodHNcbiAgICAgICAgICAgICAgICByZXR1cm4gKDQgKiBNYXRoLlBJKTtcbiAgICAgICAgICAgIGNhc2UgTElHSFRUWVBFX0RJUkVDVElPTkFMOlxuICAgICAgICAgICAgICAgIC8vIGh0dHBzOi8vZ29vZ2xlLmdpdGh1Yi5pby9maWxhbWVudC9GaWxhbWVudC5tZC5odG1sI2xpZ2h0aW5nL2RpcmVjdGxpZ2h0aW5nL2RpcmVjdGlvbmFsbGlnaHRzXG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZXR1cm5zIHRoZSBiaWFzICgueCkgYW5kIG5vcm1hbEJpYXMgKC55KSB2YWx1ZSBmb3IgbGlnaHRzIGFzIHBhc3NlZCB0byBzaGFkZXJzIGJ5IHVuaWZvcm1zXG4gICAgLy8gTm90ZTogdGhpcyBuZWVkcyB0byBiZSByZXZpc2l0ZWQgYW5kIHNpbXBsaWZpZWRcbiAgICAvLyBOb3RlOiB2c21CaWFzIGlzIG5vdCB1c2VkIGF0IGFsbCBmb3Igb21uaSBsaWdodCwgZXZlbiB0aG91Z2ggaXQgaXMgZWRpdGFibGUgaW4gdGhlIEVkaXRvclxuICAgIF9nZXRVbmlmb3JtQmlhc1ZhbHVlcyhsaWdodFJlbmRlckRhdGEpIHtcblxuICAgICAgICBjb25zdCBmYXJDbGlwID0gbGlnaHRSZW5kZXJEYXRhLnNoYWRvd0NhbWVyYS5fZmFyQ2xpcDtcblxuICAgICAgICBzd2l0Y2ggKHRoaXMuX3R5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgTElHSFRUWVBFX09NTkk6XG4gICAgICAgICAgICAgICAgdG1wQmlhc2VzLmJpYXMgPSB0aGlzLnNoYWRvd0JpYXM7XG4gICAgICAgICAgICAgICAgdG1wQmlhc2VzLm5vcm1hbEJpYXMgPSB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBMSUdIVFRZUEVfU1BPVDpcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faXNWc20pIHtcbiAgICAgICAgICAgICAgICAgICAgdG1wQmlhc2VzLmJpYXMgPSAtMC4wMDAwMSAqIDIwO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5iaWFzID0gdGhpcy5zaGFkb3dCaWFzICogMjA7IC8vIGFwcHJveCByZW1hcCBmcm9tIG9sZCBiaWFzIHZhbHVlc1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZGV2aWNlLndlYmdsMiAmJiB0aGlzLmRldmljZS5leHRTdGFuZGFyZERlcml2YXRpdmVzKSB0bXBCaWFzZXMuYmlhcyAqPSAtMTAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0bXBCaWFzZXMubm9ybWFsQmlhcyA9IHRoaXMuX2lzVnNtID8gdGhpcy52c21CaWFzIC8gKHRoaXMuYXR0ZW51YXRpb25FbmQgLyA3LjApIDogdGhpcy5fbm9ybWFsT2Zmc2V0QmlhcztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgTElHSFRUWVBFX0RJUkVDVElPTkFMOlxuICAgICAgICAgICAgICAgIC8vIG1ha2UgYmlhcyBkZXBlbmRlbnQgb24gZmFyIHBsYW5lIGJlY2F1c2UgaXQncyBub3QgY29uc3RhbnQgZm9yIGRpcmVjdCBsaWdodFxuICAgICAgICAgICAgICAgIC8vIGNsaXAgZGlzdGFuY2UgdXNlZCBpcyBiYXNlZCBvbiB0aGUgbmVhcmVzdCBzaGFkb3cgY2FzY2FkZVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9pc1ZzbSkge1xuICAgICAgICAgICAgICAgICAgICB0bXBCaWFzZXMuYmlhcyA9IC0wLjAwMDAxICogMjA7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdG1wQmlhc2VzLmJpYXMgPSAodGhpcy5zaGFkb3dCaWFzIC8gZmFyQ2xpcCkgKiAxMDA7XG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZXZpY2Uud2ViZ2wyICYmIHRoaXMuZGV2aWNlLmV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMpIHRtcEJpYXNlcy5iaWFzICo9IC0xMDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRtcEJpYXNlcy5ub3JtYWxCaWFzID0gdGhpcy5faXNWc20gPyB0aGlzLnZzbUJpYXMgLyAoZmFyQ2xpcCAvIDcuMCkgOiB0aGlzLl9ub3JtYWxPZmZzZXRCaWFzO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRtcEJpYXNlcztcbiAgICB9XG5cbiAgICBnZXRDb2xvcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbG9yO1xuICAgIH1cblxuICAgIGdldEJvdW5kaW5nU3BoZXJlKHNwaGVyZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX1NQT1QpIHtcblxuICAgICAgICAgICAgLy8gYmFzZWQgb24gaHR0cHM6Ly9iYXJ0d3JvbnNraS5jb20vMjAxNy8wNC8xMy9jdWxsLXRoYXQtY29uZS9cbiAgICAgICAgICAgIGNvbnN0IHNpemUgPSB0aGlzLmF0dGVudWF0aW9uRW5kO1xuICAgICAgICAgICAgY29uc3QgYW5nbGUgPSB0aGlzLl9vdXRlckNvbmVBbmdsZTtcbiAgICAgICAgICAgIGNvbnN0IGNvc0FuZ2xlID0gdGhpcy5fb3V0ZXJDb25lQW5nbGVDb3M7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gdGhpcy5fbm9kZTtcbiAgICAgICAgICAgIHRtcFZlYy5jb3B5KG5vZGUudXApO1xuXG4gICAgICAgICAgICBpZiAoYW5nbGUgPiA0NSkge1xuICAgICAgICAgICAgICAgIHNwaGVyZS5yYWRpdXMgPSBzaXplICogdGhpcy5fb3V0ZXJDb25lQW5nbGVTaW47XG4gICAgICAgICAgICAgICAgdG1wVmVjLm11bFNjYWxhcigtc2l6ZSAqIGNvc0FuZ2xlKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3BoZXJlLnJhZGl1cyA9IHNpemUgLyAoMiAqIGNvc0FuZ2xlKTtcbiAgICAgICAgICAgICAgICB0bXBWZWMubXVsU2NhbGFyKC1zcGhlcmUucmFkaXVzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3BoZXJlLmNlbnRlci5hZGQyKG5vZGUuZ2V0UG9zaXRpb24oKSwgdG1wVmVjKTtcblxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG4gICAgICAgICAgICBzcGhlcmUuY2VudGVyID0gdGhpcy5fbm9kZS5nZXRQb3NpdGlvbigpO1xuICAgICAgICAgICAgc3BoZXJlLnJhZGl1cyA9IHRoaXMuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXRCb3VuZGluZ0JveChib3gpIHtcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICBjb25zdCByYW5nZSA9IHRoaXMuYXR0ZW51YXRpb25FbmQ7XG4gICAgICAgICAgICBjb25zdCBhbmdsZSA9IHRoaXMuX291dGVyQ29uZUFuZ2xlO1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuX25vZGU7XG5cbiAgICAgICAgICAgIGNvbnN0IHNjbCA9IE1hdGguYWJzKE1hdGguc2luKGFuZ2xlICogbWF0aC5ERUdfVE9fUkFEKSAqIHJhbmdlKTtcblxuICAgICAgICAgICAgYm94LmNlbnRlci5zZXQoMCwgLXJhbmdlICogMC41LCAwKTtcbiAgICAgICAgICAgIGJveC5oYWxmRXh0ZW50cy5zZXQoc2NsLCByYW5nZSAqIDAuNSwgc2NsKTtcblxuICAgICAgICAgICAgYm94LnNldEZyb21UcmFuc2Zvcm1lZEFhYmIoYm94LCBub2RlLmdldFdvcmxkVHJhbnNmb3JtKCksIHRydWUpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5fdHlwZSA9PT0gTElHSFRUWVBFX09NTkkpIHtcbiAgICAgICAgICAgIGJveC5jZW50ZXIuY29weSh0aGlzLl9ub2RlLmdldFBvc2l0aW9uKCkpO1xuICAgICAgICAgICAgYm94LmhhbGZFeHRlbnRzLnNldCh0aGlzLmF0dGVudWF0aW9uRW5kLCB0aGlzLmF0dGVudWF0aW9uRW5kLCB0aGlzLmF0dGVudWF0aW9uRW5kKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVGaW5hbENvbG9yKCkge1xuICAgICAgICBjb25zdCBjb2xvciA9IHRoaXMuX2NvbG9yO1xuICAgICAgICBjb25zdCByID0gY29sb3IucjtcbiAgICAgICAgY29uc3QgZyA9IGNvbG9yLmc7XG4gICAgICAgIGNvbnN0IGIgPSBjb2xvci5iO1xuXG4gICAgICAgIGxldCBpID0gdGhpcy5faW50ZW5zaXR5O1xuXG4gICAgICAgIC8vIFRvIGNhbGN1bGF0ZSB0aGUgbHV4LCB3aGljaCBpcyBsbS9tXjIsIHdlIG5lZWQgdG8gY29udmVydCBmcm9tIGx1bWlub3VzIHBvd2VyXG4gICAgICAgIGlmICh0aGlzLl91c2VQaHlzaWNhbFVuaXRzKSB7XG4gICAgICAgICAgICBpID0gdGhpcy5fbHVtaW5hbmNlIC8gTGlnaHQuZ2V0TGlnaHRVbml0Q29udmVyc2lvbih0aGlzLl90eXBlLCB0aGlzLl9vdXRlckNvbmVBbmdsZSAqIG1hdGguREVHX1RPX1JBRCwgdGhpcy5faW5uZXJDb25lQW5nbGUgKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZmluYWxDb2xvciA9IHRoaXMuX2ZpbmFsQ29sb3I7XG4gICAgICAgIGNvbnN0IGxpbmVhckZpbmFsQ29sb3IgPSB0aGlzLl9saW5lYXJGaW5hbENvbG9yO1xuXG4gICAgICAgIGZpbmFsQ29sb3JbMF0gPSByICogaTtcbiAgICAgICAgZmluYWxDb2xvclsxXSA9IGcgKiBpO1xuICAgICAgICBmaW5hbENvbG9yWzJdID0gYiAqIGk7XG4gICAgICAgIGlmIChpID49IDEpIHtcbiAgICAgICAgICAgIGxpbmVhckZpbmFsQ29sb3JbMF0gPSBNYXRoLnBvdyhyLCAyLjIpICogaTtcbiAgICAgICAgICAgIGxpbmVhckZpbmFsQ29sb3JbMV0gPSBNYXRoLnBvdyhnLCAyLjIpICogaTtcbiAgICAgICAgICAgIGxpbmVhckZpbmFsQ29sb3JbMl0gPSBNYXRoLnBvdyhiLCAyLjIpICogaTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxpbmVhckZpbmFsQ29sb3JbMF0gPSBNYXRoLnBvdyhmaW5hbENvbG9yWzBdLCAyLjIpO1xuICAgICAgICAgICAgbGluZWFyRmluYWxDb2xvclsxXSA9IE1hdGgucG93KGZpbmFsQ29sb3JbMV0sIDIuMik7XG4gICAgICAgICAgICBsaW5lYXJGaW5hbENvbG9yWzJdID0gTWF0aC5wb3coZmluYWxDb2xvclsyXSwgMi4yKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNldENvbG9yKCkge1xuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgdGhpcy5fY29sb3Iuc2V0KGFyZ3VtZW50c1swXS5yLCBhcmd1bWVudHNbMF0uZywgYXJndW1lbnRzWzBdLmIpO1xuICAgICAgICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbG9yLnNldChhcmd1bWVudHNbMF0sIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3VwZGF0ZUZpbmFsQ29sb3IoKTtcbiAgICB9XG5cbiAgICBsYXllcnNEaXJ0eSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3NjZW5lPy5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuX3NjZW5lLmxheWVycy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlS2V5KCkge1xuICAgICAgICAvLyBLZXkgZGVmaW5pdGlvbjpcbiAgICAgICAgLy8gQml0XG4gICAgICAgIC8vIDMxICAgICAgOiBzaWduIGJpdCAobGVhdmUpXG4gICAgICAgIC8vIDI5IC0gMzAgOiB0eXBlXG4gICAgICAgIC8vIDI4ICAgICAgOiBjYXN0IHNoYWRvd3NcbiAgICAgICAgLy8gMjUgLSAyNyA6IHNoYWRvdyB0eXBlXG4gICAgICAgIC8vIDIzIC0gMjQgOiBmYWxsb2ZmIG1vZGVcbiAgICAgICAgLy8gMjIgICAgICA6IG5vcm1hbCBvZmZzZXQgYmlhc1xuICAgICAgICAvLyAyMSAgICAgIDogY29va2llXG4gICAgICAgIC8vIDIwICAgICAgOiBjb29raWUgZmFsbG9mZlxuICAgICAgICAvLyAxOCAtIDE5IDogY29va2llIGNoYW5uZWwgUlxuICAgICAgICAvLyAxNiAtIDE3IDogY29va2llIGNoYW5uZWwgR1xuICAgICAgICAvLyAxNCAtIDE1IDogY29va2llIGNoYW5uZWwgQlxuICAgICAgICAvLyAxMiAgICAgIDogY29va2llIHRyYW5zZm9ybVxuICAgICAgICAvLyAxMCAtIDExIDogbGlnaHQgc291cmNlIHNoYXBlXG4gICAgICAgIC8vICA4IC0gIDkgOiBsaWdodCBudW0gY2FzY2FkZXNcbiAgICAgICAgLy8gIDcgOiBkaXNhYmxlIHNwZWN1bGFyXG4gICAgICAgIGxldCBrZXkgPVxuICAgICAgICAgICAgICAgKHRoaXMuX3R5cGUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDI5KSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX2Nhc3RTaGFkb3dzID8gMSA6IDApICAgICAgICAgICAgICAgPDwgMjgpIHxcbiAgICAgICAgICAgICAgICh0aGlzLl9zaGFkb3dUeXBlICAgICAgICAgICAgICAgICAgICAgICAgICA8PCAyNSkgfFxuICAgICAgICAgICAgICAgKHRoaXMuX2ZhbGxvZmZNb2RlICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDIzKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMuX25vcm1hbE9mZnNldEJpYXMgIT09IDAuMCA/IDEgOiAwKSAgPDwgMjIpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY29va2llID8gMSA6IDApICAgICAgICAgICAgICAgICAgICA8PCAyMSkgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9jb29raWVGYWxsb2ZmID8gMSA6IDApICAgICAgICAgICAgIDw8IDIwKSB8XG4gICAgICAgICAgICAgICAoY2hhbklkW3RoaXMuX2Nvb2tpZUNoYW5uZWwuY2hhckF0KDApXSAgICAgPDwgMTgpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5fY29va2llVHJhbnNmb3JtID8gMSA6IDApICAgICAgICAgICA8PCAxMikgfFxuICAgICAgICAgICAgICAgKCh0aGlzLl9zaGFwZSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw8IDEwKSB8XG4gICAgICAgICAgICAgICAoKHRoaXMubnVtQ2FzY2FkZXMgLSAxKSAgICAgICAgICAgICAgICAgICAgPDwgIDgpIHxcbiAgICAgICAgICAgICAgICgodGhpcy5hZmZlY3RTcGVjdWxhcml0eSA/IDEgOiAwKSAgICAgICAgICAgPDwgIDcpO1xuXG4gICAgICAgIGlmICh0aGlzLl9jb29raWVDaGFubmVsLmxlbmd0aCA9PT0gMykge1xuICAgICAgICAgICAga2V5IHw9IChjaGFuSWRbdGhpcy5fY29va2llQ2hhbm5lbC5jaGFyQXQoMSldIDw8IDE2KTtcbiAgICAgICAgICAgIGtleSB8PSAoY2hhbklkW3RoaXMuX2Nvb2tpZUNoYW5uZWwuY2hhckF0KDIpXSA8PCAxNCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoa2V5ICE9PSB0aGlzLmtleSAmJiB0aGlzLl9zY2VuZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gVE9ETzogbW9zdCBvZiB0aGUgY2hhbmdlcyB0byB0aGUga2V5IHNob3VsZCBub3QgaW52YWxpZGF0ZSB0aGUgY29tcG9zaXRpb24sXG4gICAgICAgICAgICAvLyBwcm9iYWJseSBvbmx5IF90eXBlIGFuZCBfY2FzdFNoYWRvd3NcbiAgICAgICAgICAgIHRoaXMubGF5ZXJzRGlydHkoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHQsIGxpZ2h0VHlwZXMgfTtcbiJdLCJuYW1lcyI6WyJ0bXBWZWMiLCJWZWMzIiwidG1wQmlhc2VzIiwiYmlhcyIsIm5vcm1hbEJpYXMiLCJjaGFuSWQiLCJyIiwiZyIsImIiLCJhIiwibGlnaHRUeXBlcyIsIkxJR0hUVFlQRV9ESVJFQ1RJT05BTCIsIkxJR0hUVFlQRV9PTU5JIiwiTElHSFRUWVBFX1NQT1QiLCJkaXJlY3Rpb25hbENhc2NhZGVzIiwiVmVjNCIsImlkIiwiTGlnaHRSZW5kZXJEYXRhIiwiY29uc3RydWN0b3IiLCJkZXZpY2UiLCJjYW1lcmEiLCJmYWNlIiwibGlnaHQiLCJzaGFkb3dDYW1lcmEiLCJTaGFkb3dSZW5kZXJlciIsImNyZWF0ZVNoYWRvd0NhbWVyYSIsIl9zaGFkb3dUeXBlIiwiX3R5cGUiLCJzaGFkb3dNYXRyaXgiLCJNYXQ0Iiwic2hhZG93Vmlld3BvcnQiLCJzaGFkb3dTY2lzc29yIiwiZGVwdGhSYW5nZUNvbXBlbnNhdGlvbiIsInZpc2libGVDYXN0ZXJzIiwidmlld0JpbmRHcm91cHMiLCJkZXN0cm95IiwiZm9yRWFjaCIsImJnIiwiZGVmYXVsdFVuaWZvcm1CdWZmZXIiLCJsZW5ndGgiLCJzaGFkb3dCdWZmZXIiLCJydCIsInJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiX2lzUGNmIiwic3VwcG9ydHNEZXB0aFNoYWRvdyIsImRlcHRoQnVmZmVyIiwiTGlnaHQiLCJncmFwaGljc0RldmljZSIsIl9jb2xvciIsIkNvbG9yIiwiX2ludGVuc2l0eSIsIl9hZmZlY3RTcGVjdWxhcml0eSIsIl9sdW1pbmFuY2UiLCJfY2FzdFNoYWRvd3MiLCJfZW5hYmxlZCIsIm1hc2siLCJNQVNLX0FGRkVDVF9EWU5BTUlDIiwiaXNTdGF0aWMiLCJrZXkiLCJiYWtlRGlyIiwiYmFrZU51bVNhbXBsZXMiLCJiYWtlQXJlYSIsImF0dGVudWF0aW9uU3RhcnQiLCJhdHRlbnVhdGlvbkVuZCIsIl9mYWxsb2ZmTW9kZSIsIkxJR0hURkFMTE9GRl9MSU5FQVIiLCJTSEFET1dfUENGMyIsIl92c21CbHVyU2l6ZSIsInZzbUJsdXJNb2RlIiwiQkxVUl9HQVVTU0lBTiIsInZzbUJpYXMiLCJfY29va2llIiwiY29va2llSW50ZW5zaXR5IiwiX2Nvb2tpZUZhbGxvZmYiLCJfY29va2llQ2hhbm5lbCIsIl9jb29raWVUcmFuc2Zvcm0iLCJfY29va2llVHJhbnNmb3JtVW5pZm9ybSIsIkZsb2F0MzJBcnJheSIsIl9jb29raWVPZmZzZXQiLCJfY29va2llT2Zmc2V0VW5pZm9ybSIsIl9jb29raWVUcmFuc2Zvcm1TZXQiLCJfY29va2llT2Zmc2V0U2V0IiwiX2lubmVyQ29uZUFuZ2xlIiwiX291dGVyQ29uZUFuZ2xlIiwiY2FzY2FkZXMiLCJfc2hhZG93TWF0cml4UGFsZXR0ZSIsIl9zaGFkb3dDYXNjYWRlRGlzdGFuY2VzIiwibnVtQ2FzY2FkZXMiLCJjYXNjYWRlRGlzdHJpYnV0aW9uIiwiX3NoYXBlIiwiTElHSFRTSEFQRV9QVU5DVFVBTCIsIl9maW5hbENvbG9yIiwiYyIsIk1hdGgiLCJwb3ciLCJfbGluZWFyRmluYWxDb2xvciIsIl9wb3NpdGlvbiIsIl9kaXJlY3Rpb24iLCJfaW5uZXJDb25lQW5nbGVDb3MiLCJjb3MiLCJQSSIsIl91cGRhdGVPdXRlckFuZ2xlIiwiX3VzZVBoeXNpY2FsVW5pdHMiLCJ1bmRlZmluZWQiLCJfc2hhZG93TWFwIiwiX3NoYWRvd1JlbmRlclBhcmFtcyIsIl9zaGFkb3dDYW1lcmFQYXJhbXMiLCJzaGFkb3dEaXN0YW5jZSIsIl9zaGFkb3dSZXNvbHV0aW9uIiwic2hhZG93QmlhcyIsInNoYWRvd0ludGVuc2l0eSIsIl9ub3JtYWxPZmZzZXRCaWFzIiwic2hhZG93VXBkYXRlTW9kZSIsIlNIQURPV1VQREFURV9SRUFMVElNRSIsInNoYWRvd1VwZGF0ZU92ZXJyaWRlcyIsIl9wZW51bWJyYVNpemUiLCJfaXNWc20iLCJfY29va2llTWF0cml4IiwiX2F0bGFzVmlld3BvcnQiLCJhdGxhc1ZpZXdwb3J0QWxsb2NhdGVkIiwiYXRsYXNWZXJzaW9uIiwiYXRsYXNTbG90SW5kZXgiLCJhdGxhc1Nsb3RVcGRhdGVkIiwiX3NjZW5lIiwiX25vZGUiLCJfcmVuZGVyRGF0YSIsInZpc2libGVUaGlzRnJhbWUiLCJtYXhTY3JlZW5TaXplIiwiX2Rlc3Ryb3lTaGFkb3dNYXAiLCJyZWxlYXNlUmVuZGVyRGF0YSIsImkiLCJ2YWx1ZSIsInVwZGF0ZUtleSIsInNoYWRvd01hcCIsIm51bVNoYWRvd0ZhY2VzIiwidHlwZSIsInN0eXBlIiwic2hhZG93VHlwZSIsInNoYXBlIiwidXNlUGh5c2ljYWxVbml0cyIsIl91cGRhdGVGaW5hbENvbG9yIiwiU0hBRE9XX1BDU1MiLCJTSEFET1dfUENGNSIsIlNIQURPV19WU00zMiIsInRleHR1cmVGbG9hdFJlbmRlcmFibGUiLCJTSEFET1dfVlNNMTYiLCJ0ZXh0dXJlSGFsZkZsb2F0UmVuZGVyYWJsZSIsIlNIQURPV19WU004IiwiU0hBRE9XX1BDRjEiLCJlbmFibGVkIiwibGF5ZXJzRGlydHkiLCJjYXN0U2hhZG93cyIsIk1BU0tfQkFLRSIsInNoYWRvd1Jlc29sdXRpb24iLCJtaW4iLCJtYXhDdWJlTWFwU2l6ZSIsIm1heFRleHR1cmVTaXplIiwidnNtQmx1clNpemUiLCJub3JtYWxPZmZzZXRCaWFzIiwiZmFsbG9mZk1vZGUiLCJpbm5lckNvbmVBbmdsZSIsIm91dGVyQ29uZUFuZ2xlIiwicGVudW1icmFTaXplIiwiYW5nbGUiLCJyYWRBbmdsZSIsIl9vdXRlckNvbmVBbmdsZUNvcyIsIl9vdXRlckNvbmVBbmdsZVNpbiIsInNpbiIsImludGVuc2l0eSIsImFmZmVjdFNwZWN1bGFyaXR5IiwibHVtaW5hbmNlIiwiY29va2llTWF0cml4IiwiYXRsYXNWaWV3cG9ydCIsImNvb2tpZSIsImNvb2tpZUZhbGxvZmYiLCJjb29raWVDaGFubmVsIiwiY2hyIiwiY2hhckF0IiwiYWRkTGVuIiwiY29va2llVHJhbnNmb3JtIiwiY29va2llT2Zmc2V0IiwiVmVjMiIsInhmb3JtTmV3Iiwic2V0IiwiYmVnaW5GcmFtZSIsImNhY2hlZCIsIlNIQURPV1VQREFURV9OT05FIiwiU0hBRE9XVVBEQVRFX1RISVNGUkFNRSIsImdldFJlbmRlckRhdGEiLCJjdXJyZW50IiwicmQiLCJwdXNoIiwiY2xvbmUiLCJzZXRDb2xvciIsInNsaWNlIiwiZ2V0TGlnaHRVbml0Q29udmVyc2lvbiIsIm91dGVyQW5nbGUiLCJpbm5lckFuZ2xlIiwiZmFsbG9mZkVuZCIsImZhbGxvZmZTdGFydCIsIl9nZXRVbmlmb3JtQmlhc1ZhbHVlcyIsImxpZ2h0UmVuZGVyRGF0YSIsImZhckNsaXAiLCJfZmFyQ2xpcCIsIndlYmdsMiIsImV4dFN0YW5kYXJkRGVyaXZhdGl2ZXMiLCJnZXRDb2xvciIsImdldEJvdW5kaW5nU3BoZXJlIiwic3BoZXJlIiwic2l6ZSIsImNvc0FuZ2xlIiwibm9kZSIsImNvcHkiLCJ1cCIsInJhZGl1cyIsIm11bFNjYWxhciIsImNlbnRlciIsImFkZDIiLCJnZXRQb3NpdGlvbiIsImdldEJvdW5kaW5nQm94IiwiYm94IiwicmFuZ2UiLCJzY2wiLCJhYnMiLCJtYXRoIiwiREVHX1RPX1JBRCIsImhhbGZFeHRlbnRzIiwic2V0RnJvbVRyYW5zZm9ybWVkQWFiYiIsImdldFdvcmxkVHJhbnNmb3JtIiwiY29sb3IiLCJmaW5hbENvbG9yIiwibGluZWFyRmluYWxDb2xvciIsImFyZ3VtZW50cyIsIl90aGlzJF9zY2VuZSIsImxheWVycyIsIl9kaXJ0eUxpZ2h0cyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBaUJBLE1BQU1BLE1BQU0sR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUN6QixNQUFNQyxTQUFTLEdBQUc7QUFDZEMsRUFBQUEsSUFBSSxFQUFFLENBQUM7QUFDUEMsRUFBQUEsVUFBVSxFQUFFLENBQUE7QUFDaEIsQ0FBQyxDQUFBO0FBRUQsTUFBTUMsTUFBTSxHQUFHO0FBQUVDLEVBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLEVBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLEVBQUFBLENBQUMsRUFBRSxDQUFDO0FBQUVDLEVBQUFBLENBQUMsRUFBRSxDQUFBO0FBQUUsQ0FBQyxDQUFBO0FBRXpDLE1BQU1DLFVBQVUsR0FBRztBQUNmLEVBQUEsYUFBYSxFQUFFQyxxQkFBcUI7QUFDcEMsRUFBQSxNQUFNLEVBQUVDLGNBQWM7QUFDdEIsRUFBQSxPQUFPLEVBQUVBLGNBQWM7QUFDdkIsRUFBQSxNQUFNLEVBQUVDLGNBQUFBO0FBQ1osRUFBQzs7QUFFRDtBQUNBLE1BQU1DLG1CQUFtQixHQUFHLENBQ3hCLENBQUMsSUFBSUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUs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
