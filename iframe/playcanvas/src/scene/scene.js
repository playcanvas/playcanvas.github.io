import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Vec3 } from '../core/math/vec3.js';
import { Quat } from '../core/math/quat.js';
import { math } from '../core/math/math.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_RGBA8 } from '../platform/graphics/constants.js';
import { BAKE_COLORDIR, FOG_NONE, GAMMA_SRGB, LAYERID_IMMEDIATE } from './constants.js';
import { LightingParams } from './lighting/lighting-params.js';
import { Sky } from './skybox/sky.js';
import { Immediate } from './immediate/immediate.js';
import { EnvLighting } from './graphics/env-lighting.js';

class Scene extends EventHandler {
  constructor(graphicsDevice) {
    super();
    this.ambientBake = false;
    this.ambientBakeOcclusionBrightness = 0;
    this.ambientBakeOcclusionContrast = 0;
    this.ambientLight = new Color(0, 0, 0);
    this.ambientLuminance = 0;
    this.exposure = 1;
    this.fogColor = new Color(0, 0, 0);
    this.fogDensity = 0;
    this.fogEnd = 1000;
    this.fogStart = 1;
    this.lightmapSizeMultiplier = 1;
    this.lightmapMaxResolution = 2048;
    this.lightmapMode = BAKE_COLORDIR;
    this.lightmapFilterEnabled = false;
    this.lightmapHDR = false;
    this.root = null;
    this.physicalUnits = false;
    this._envAtlas = null;
    this._skyboxCubeMap = null;
    this.device = graphicsDevice;
    this._gravity = new Vec3(0, -9.8, 0);
    this._layers = null;
    this._fog = FOG_NONE;
    this._gammaCorrection = GAMMA_SRGB;
    this._toneMapping = 0;
    this._prefilteredCubemaps = [];
    this._internalEnvAtlas = null;
    this._skyboxIntensity = 1;
    this._skyboxLuminance = 0;
    this._skyboxMip = 0;
    this._skyboxRotationShaderInclude = false;
    this._skyboxRotation = new Quat();
    this._skyboxRotationMat3 = new Mat3();
    this._skyboxRotationMat4 = new Mat4();
    this._ambientBakeNumSamples = 1;
    this._ambientBakeSpherePart = 0.4;
    this._lightmapFilterRange = 10;
    this._lightmapFilterSmoothness = 0.2;
    this._clusteredLightingEnabled = true;
    this._lightingParams = new LightingParams(this.device.supportsAreaLights, this.device.maxTextureSize, () => {
      this.updateShaders = true;
    });
    this._sky = new Sky(this);
    this._stats = {
      meshInstances: 0,
      lights: 0,
      dynamicLights: 0,
      bakedLights: 0,
      updateShadersTime: 0
    };
    this.updateShaders = true;
    this._shaderVersion = 0;
    this.immediate = new Immediate(this.device);
  }
  get defaultDrawLayer() {
    return this.layers.getLayerById(LAYERID_IMMEDIATE);
  }
  set ambientBakeNumSamples(value) {
    this._ambientBakeNumSamples = math.clamp(Math.floor(value), 1, 255);
  }
  get ambientBakeNumSamples() {
    return this._ambientBakeNumSamples;
  }
  set ambientBakeSpherePart(value) {
    this._ambientBakeSpherePart = math.clamp(value, 0.001, 1);
  }
  get ambientBakeSpherePart() {
    return this._ambientBakeSpherePart;
  }
  set clusteredLightingEnabled(value) {
    if (this.device.isWebGPU && !value) {
      return;
    }
    if (!this._clusteredLightingEnabled && value) {
      console.error('Turning on disabled clustered lighting is not currently supported');
      return;
    }
    this._clusteredLightingEnabled = value;
  }
  get clusteredLightingEnabled() {
    return this._clusteredLightingEnabled;
  }
  set envAtlas(value) {
    if (value !== this._envAtlas) {
      this._envAtlas = value;
      if (value) {
        value.addressU = ADDRESS_CLAMP_TO_EDGE;
        value.addressV = ADDRESS_CLAMP_TO_EDGE;
        value.minFilter = FILTER_LINEAR;
        value.magFilter = FILTER_LINEAR;
        value.mipmaps = false;
      }
      this._prefilteredCubemaps = [];
      if (this._internalEnvAtlas) {
        this._internalEnvAtlas.destroy();
        this._internalEnvAtlas = null;
      }
      this._resetSkyMesh();
    }
  }
  get envAtlas() {
    return this._envAtlas;
  }
  set fog(type) {
    if (type !== this._fog) {
      this._fog = type;
      this.updateShaders = true;
    }
  }
  get fog() {
    return this._fog;
  }
  set gammaCorrection(value) {
    if (value !== this._gammaCorrection) {
      this._gammaCorrection = value;
      this.updateShaders = true;
    }
  }
  get gammaCorrection() {
    return this._gammaCorrection;
  }
  set layers(layers) {
    const prev = this._layers;
    this._layers = layers;
    this.fire('set:layers', prev, layers);
  }
  get layers() {
    return this._layers;
  }
  get sky() {
    return this._sky;
  }
  get lighting() {
    return this._lightingParams;
  }
  set lightmapFilterRange(value) {
    this._lightmapFilterRange = Math.max(value, 0.001);
  }
  get lightmapFilterRange() {
    return this._lightmapFilterRange;
  }
  set lightmapFilterSmoothness(value) {
    this._lightmapFilterSmoothness = Math.max(value, 0.001);
  }
  get lightmapFilterSmoothness() {
    return this._lightmapFilterSmoothness;
  }
  set prefilteredCubemaps(value) {
    value = value || [];
    const cubemaps = this._prefilteredCubemaps;
    const changed = cubemaps.length !== value.length || cubemaps.some((c, i) => c !== value[i]);
    if (changed) {
      const complete = value.length === 6 && value.every(c => !!c);
      if (complete) {
        this._internalEnvAtlas = EnvLighting.generatePrefilteredAtlas(value, {
          target: this._internalEnvAtlas
        });
        this._envAtlas = this._internalEnvAtlas;
      } else {
        if (this._internalEnvAtlas) {
          this._internalEnvAtlas.destroy();
          this._internalEnvAtlas = null;
        }
        this._envAtlas = null;
      }
      this._prefilteredCubemaps = value.slice();
      this._resetSkyMesh();
    }
  }
  get prefilteredCubemaps() {
    return this._prefilteredCubemaps;
  }
  set skybox(value) {
    if (value !== this._skyboxCubeMap) {
      this._skyboxCubeMap = value;
      this._resetSkyMesh();
    }
  }
  get skybox() {
    return this._skyboxCubeMap;
  }
  set skyboxIntensity(value) {
    if (value !== this._skyboxIntensity) {
      this._skyboxIntensity = value;
      this._resetSkyMesh();
    }
  }
  get skyboxIntensity() {
    return this._skyboxIntensity;
  }
  set skyboxLuminance(value) {
    if (value !== this._skyboxLuminance) {
      this._skyboxLuminance = value;
      this._resetSkyMesh();
    }
  }
  get skyboxLuminance() {
    return this._skyboxLuminance;
  }
  set skyboxMip(value) {
    if (value !== this._skyboxMip) {
      this._skyboxMip = value;
      this._resetSkyMesh();
    }
  }
  get skyboxMip() {
    return this._skyboxMip;
  }
  set skyboxRotation(value) {
    if (!this._skyboxRotation.equals(value)) {
      const isIdentity = value.equals(Quat.IDENTITY);
      this._skyboxRotation.copy(value);
      if (isIdentity) {
        this._skyboxRotationMat3.setIdentity();
      } else {
        this._skyboxRotationMat4.setTRS(Vec3.ZERO, value, Vec3.ONE);
        this._skyboxRotationMat3.invertMat4(this._skyboxRotationMat4);
      }
      if (!this._skyboxRotationShaderInclude && !isIdentity) {
        this._skyboxRotationShaderInclude = true;
        this._resetSkyMesh();
      }
    }
  }
  get skyboxRotation() {
    return this._skyboxRotation;
  }
  set toneMapping(value) {
    if (value !== this._toneMapping) {
      this._toneMapping = value;
      this.updateShaders = true;
    }
  }
  get toneMapping() {
    return this._toneMapping;
  }
  destroy() {
    this._resetSkyMesh();
    this.root = null;
    this.off();
  }
  drawLine(start, end, color = Color.WHITE, depthTest = true, layer = this.defaultDrawLayer) {
    const batch = this.immediate.getBatch(layer, depthTest);
    batch.addLines([start, end], [color, color]);
  }
  drawLines(positions, colors, depthTest = true, layer = this.defaultDrawLayer) {
    const batch = this.immediate.getBatch(layer, depthTest);
    batch.addLines(positions, colors);
  }
  drawLineArrays(positions, colors, depthTest = true, layer = this.defaultDrawLayer) {
    const batch = this.immediate.getBatch(layer, depthTest);
    batch.addLinesArrays(positions, colors);
  }
  applySettings(settings) {
    var _render$skyboxIntensi, _render$skyboxLuminan, _render$skyboxMip, _render$clusteredLigh;
    const physics = settings.physics;
    const render = settings.render;
    this._gravity.set(physics.gravity[0], physics.gravity[1], physics.gravity[2]);
    this.ambientLight.set(render.global_ambient[0], render.global_ambient[1], render.global_ambient[2]);
    this.ambientLuminance = render.ambientLuminance;
    this._fog = render.fog;
    this.fogColor.set(render.fog_color[0], render.fog_color[1], render.fog_color[2]);
    this.fogStart = render.fog_start;
    this.fogEnd = render.fog_end;
    this.fogDensity = render.fog_density;
    this._gammaCorrection = render.gamma_correction;
    this._toneMapping = render.tonemapping;
    this.lightmapSizeMultiplier = render.lightmapSizeMultiplier;
    this.lightmapMaxResolution = render.lightmapMaxResolution;
    this.lightmapMode = render.lightmapMode;
    this.exposure = render.exposure;
    this._skyboxIntensity = (_render$skyboxIntensi = render.skyboxIntensity) != null ? _render$skyboxIntensi : 1;
    this._skyboxLuminance = (_render$skyboxLuminan = render.skyboxLuminance) != null ? _render$skyboxLuminan : 20000;
    this._skyboxMip = (_render$skyboxMip = render.skyboxMip) != null ? _render$skyboxMip : 0;
    if (render.skyboxRotation) {
      this.skyboxRotation = new Quat().setFromEulerAngles(render.skyboxRotation[0], render.skyboxRotation[1], render.skyboxRotation[2]);
    }
    this.sky.applySettings(render);
    this.clusteredLightingEnabled = (_render$clusteredLigh = render.clusteredLightingEnabled) != null ? _render$clusteredLigh : false;
    this.lighting.applySettings(render);
    ['lightmapFilterEnabled', 'lightmapFilterRange', 'lightmapFilterSmoothness', 'ambientBake', 'ambientBakeNumSamples', 'ambientBakeSpherePart', 'ambientBakeOcclusionBrightness', 'ambientBakeOcclusionContrast'].forEach(setting => {
      if (render.hasOwnProperty(setting)) {
        this[setting] = render[setting];
      }
    });
    this._resetSkyMesh();
  }
  _getSkyboxTex() {
    const cubemaps = this._prefilteredCubemaps;
    if (this._skyboxMip) {
      const skyboxMapping = [0, 1, 3, 4, 5, 6];
      return cubemaps[skyboxMapping[this._skyboxMip]] || this._envAtlas || cubemaps[0] || this._skyboxCubeMap;
    }
    return this._skyboxCubeMap || cubemaps[0] || this._envAtlas;
  }
  _updateSkyMesh() {
    if (!this.sky.skyMesh) {
      this.sky.updateSkyMesh();
    }
    this.sky.update();
  }
  _resetSkyMesh() {
    this.sky.resetSkyMesh();
    this.updateShaders = true;
  }
  setSkybox(cubemaps) {
    if (!cubemaps) {
      this.skybox = null;
      this.envAtlas = null;
    } else {
      this.skybox = cubemaps[0] || null;
      if (cubemaps[1] && !cubemaps[1].cubemap) {
        this.envAtlas = cubemaps[1];
      } else {
        this.prefilteredCubemaps = cubemaps.slice(1);
      }
    }
  }
  get lightmapPixelFormat() {
    return this.lightmapHDR && this.device.getRenderableHdrFormat() || PIXELFORMAT_RGBA8;
  }
}
Scene.EVENT_SETLAYERS = 'set:layers';
Scene.EVENT_SETSKYBOX = 'set:skybox';

export { Scene };
