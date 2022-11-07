/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../core/tracing.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Vec3 } from '../core/math/vec3.js';
import { Quat } from '../core/math/quat.js';
import { math } from '../core/math/math.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { BAKE_COLORDIR, FOG_NONE, GAMMA_SRGB, LAYERID_IMMEDIATE } from './constants.js';
import { Sky } from './sky.js';
import { LightingParams } from './lighting/lighting-params.js';
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
    this.root = null;
    this.sky = null;
    this.physicalUnits = false;
    this.device = graphicsDevice || GraphicsDeviceAccess.get();
    this._gravity = new Vec3(0, -9.8, 0);

    this._layers = null;
    this._fog = FOG_NONE;
    this._gammaCorrection = GAMMA_SRGB;
    this._toneMapping = 0;

    this._skyboxCubeMap = null;

    this._prefilteredCubemaps = [null, null, null, null, null, null];

    this._envAtlas = null;

    this._internalEnvAtlas = null;
    this._skyboxIntensity = 1;
    this._skyboxLuminance = 0;
    this._skyboxMip = 0;
    this._skyboxRotation = new Quat();
    this._skyboxRotationMat3 = new Mat3();
    this._skyboxRotationMat4 = new Mat4();

    this._ambientBakeNumSamples = 1;
    this._ambientBakeSpherePart = 0.4;
    this._lightmapFilterRange = 10;
    this._lightmapFilterSmoothness = 0.2;

    this._clusteredLightingEnabled = true;
    this._lightingParams = new LightingParams(this.device.supportsAreaLights, this.device.maxTextureSize, () => {
      this._layers._dirtyLights = true;
    });
    this._stats = {
      meshInstances: 0,
      lights: 0,
      dynamicLights: 0,
      bakedLights: 0,
      lastStaticPrepareFullTime: 0,
      lastStaticPrepareSearchTime: 0,
      lastStaticPrepareWriteTime: 0,
      lastStaticPrepareTriAabbTime: 0,
      lastStaticPrepareCombineTime: 0,
      updateShadersTime: 0
    };

    this.updateShaders = true;
    this._shaderVersion = 0;
    this._statsUpdated = false;

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
    if (!this._clusteredLightingEnabled && value) {
      console.error('Turning on disabled clustered lighting is not currently supported');
      return;
    }
    this._clusteredLightingEnabled = value;
  }
  get clusteredLightingEnabled() {
    return this._clusteredLightingEnabled;
  }

  set drawCalls(value) {}
  get drawCalls() {
    let drawCalls = this.layers._meshInstances;
    if (!drawCalls.length) {
      this.layers._update(this.device, this.clusteredLightingEnabled);
      drawCalls = this.layers._meshInstances;
    }
    return drawCalls;
  }

  set envAtlas(value) {
    if (value !== this._envAtlas) {
      this._envAtlas = value;
      this.updateShaders = true;
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
    const cubemaps = this._prefilteredCubemaps;
    value = value || [];
    let changed = false;
    let complete = true;
    for (let i = 0; i < 6; ++i) {
      const v = value[i] || null;
      if (cubemaps[i] !== v) {
        cubemaps[i] = v;
        changed = true;
      }
      complete = complete && !!cubemaps[i];
    }
    if (changed) {
      this._resetSky();
      if (complete) {
        this._internalEnvAtlas = EnvLighting.generatePrefilteredAtlas(cubemaps, {
          target: this._internalEnvAtlas
        });
        if (!this._envAtlas) {
          this.envAtlas = this._internalEnvAtlas;
        }
      } else if (this._internalEnvAtlas) {
        if (this._envAtlas === this._internalEnvAtlas) {
          this.envAtlas = null;
        }
        this._internalEnvAtlas.destroy();
        this._internalEnvAtlas = null;
      }
    }
  }
  get prefilteredCubemaps() {
    return this._prefilteredCubemaps;
  }

  set skybox(value) {
    if (value !== this._skyboxCubeMap) {
      this._skyboxCubeMap = value;
      this._resetSky();
    }
  }
  get skybox() {
    return this._skyboxCubeMap;
  }

  set skyboxIntensity(value) {
    if (value !== this._skyboxIntensity) {
      this._skyboxIntensity = value;
      this._resetSky();
    }
  }
  get skyboxIntensity() {
    return this._skyboxIntensity;
  }

  set skyboxLuminance(value) {
    if (value !== this._skyboxLuminance) {
      this._skyboxLuminance = value;
      this._resetSky();
    }
  }
  get skyboxLuminance() {
    return this._skyboxLuminance;
  }

  set skyboxMip(value) {
    if (value !== this._skyboxMip) {
      this._skyboxMip = value;
      this._resetSky();
    }
  }
  get skyboxMip() {
    return this._skyboxMip;
  }

  set skyboxRotation(value) {
    if (!this._skyboxRotation.equals(value)) {
      this._skyboxRotation.copy(value);
      if (value.equals(Quat.IDENTITY)) {
        this._skyboxRotationMat3.setIdentity();
      } else {
        this._skyboxRotationMat4.setTRS(Vec3.ZERO, value, Vec3.ONE);
        this._skyboxRotationMat4.invertTo3x3(this._skyboxRotationMat3);
      }
      this._resetSky();
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
    this._resetSky();
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
    this._skyboxIntensity = render.skyboxIntensity === undefined ? 1 : render.skyboxIntensity;
    this._skyboxLuminance = render.skyboxLuminance === undefined ? 20000 : render.skyboxLuminance;
    this._skyboxMip = render.skyboxMip === undefined ? 0 : render.skyboxMip;
    if (render.skyboxRotation) {
      this._skyboxRotation.setFromEulerAngles(render.skyboxRotation[0], render.skyboxRotation[1], render.skyboxRotation[2]);
    }
    this.clusteredLightingEnabled = render.clusteredLightingEnabled;
    this.lighting.applySettings(render);

    ['lightmapFilterEnabled', 'lightmapFilterRange', 'lightmapFilterSmoothness', 'ambientBake', 'ambientBakeNumSamples', 'ambientBakeSpherePart', 'ambientBakeOcclusionBrightness', 'ambientBakeOcclusionContrast'].forEach(setting => {
      if (render.hasOwnProperty(setting)) {
        this[setting] = render[setting];
      }
    });
    this._resetSky();
  }

  _getSkyboxTex() {
    const cubemaps = this._prefilteredCubemaps;
    if (this._skyboxMip) {
      const skyboxMapping = [0, 1, 3, 4, 5, 6];

      return cubemaps[skyboxMapping[this._skyboxMip]] || this._envAtlas || cubemaps[0] || this._skyboxCubeMap;
    }
    return this._skyboxCubeMap || cubemaps[0] || this._envAtlas;
  }
  _updateSky(device) {
    if (!this.sky) {
      const texture = this._getSkyboxTex();
      if (texture) {
        this.sky = new Sky(device, this, texture);
        this.fire('set:skybox', texture);
      }
    }
  }
  _resetSky() {
    var _this$sky;
    (_this$sky = this.sky) == null ? void 0 : _this$sky.destroy();
    this.sky = null;
    this.updateShaders = true;
  }

  setSkybox(cubemaps) {
    if (!cubemaps) {
      this.skybox = null;
      this.prefilteredCubemaps = [null, null, null, null, null, null];
    } else {
      this.skybox = cubemaps[0] || null;
      this.prefilteredCubemaps = cubemaps.slice(1);
    }
  }
}

export { Scene };
