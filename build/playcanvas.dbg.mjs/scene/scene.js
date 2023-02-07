/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Vec3 } from '../core/math/vec3.js';
import { Quat } from '../core/math/quat.js';
import { math } from '../core/math/math.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_RGBA8 } from '../platform/graphics/constants.js';
import { BAKE_COLORDIR, FOG_NONE, GAMMA_SRGB, LAYERID_IMMEDIATE } from './constants.js';
import { Sky } from './sky.js';
import { LightingParams } from './lighting/lighting-params.js';
import { Immediate } from './immediate/immediate.js';
import { EnvLighting } from './graphics/env-lighting.js';

/**
 * A scene is graphical representation of an environment. It manages the scene hierarchy, all
 * graphical objects, lights, and scene-wide properties.
 *
 * @augments EventHandler
 */
class Scene extends EventHandler {
  /**
   * If enabled, the ambient lighting will be baked into lightmaps. This will be either the
   * {@link Scene#skybox} if set up, otherwise {@link Scene#ambientLight}. Defaults to false.
   *
   * @type {boolean}
   */

  /**
   * If {@link Scene#ambientBake} is true, this specifies the brightness of ambient occlusion.
   * Typical range is -1 to 1. Defaults to 0, representing no change to brightness.
   *
   * @type {number}
   */

  /**
   * If {@link Scene#ambientBake} is true, this specifies the contrast of ambient occlusion.
   * Typical range is -1 to 1. Defaults to 0, representing no change to contrast.
   *
   * @type {number}
   */

  /**
   * The color of the scene's ambient light. Defaults to black (0, 0, 0).
   *
   * @type {Color}
   */

  /**
   * The luminosity of the scene's ambient light in lux (lm/m^2). Used if physicalUnits is true. Defaults to 0.
   *
   * @type {number}
   */

  /**
   * The exposure value tweaks the overall brightness of the scene. Ignored if physicalUnits is true. Defaults to 1.
   *
   * @type {number}
   */

  /**
   * The color of the fog (if enabled). Defaults to black (0, 0, 0).
   *
   * @type {Color}
   */

  /**
   * The density of the fog (if enabled). This property is only valid if the fog property is set
   * to {@link FOG_EXP} or {@link FOG_EXP2}. Defaults to 0.
   *
   * @type {number}
   */

  /**
   * The distance from the viewpoint where linear fog reaches its maximum. This property is only
   * valid if the fog property is set to {@link FOG_LINEAR}. Defaults to 1000.
   *
   * @type {number}
   */

  /**
   * The distance from the viewpoint where linear fog begins. This property is only valid if the
   * fog property is set to {@link FOG_LINEAR}. Defaults to 1.
   *
   * @type {number}
   */

  /**
   * The lightmap resolution multiplier. Defaults to 1.
   *
   * @type {number}
   */

  /**
   * The maximum lightmap resolution. Defaults to 2048.
   *
   * @type {number}
   */

  /**
   * The lightmap baking mode. Can be:
   *
   * - {@link BAKE_COLOR}: single color lightmap
   * - {@link BAKE_COLORDIR}: single color lightmap + dominant light direction (used for bump or
   * specular). Only lights with bakeDir=true will be used for generating the dominant light
   * direction.
   *
   * Defaults to {@link BAKE_COLORDIR}.
   *
   * @type {number}
   */

  /**
   * Enables bilateral filter on runtime baked color lightmaps, which removes the noise and
   * banding while preserving the edges. Defaults to false. Note that the filtering takes place
   * in the image space of the lightmap, and it does not filter across lightmap UV space seams,
   * often making the seams more visible. It's important to balance the strength of the filter
   * with number of samples used for lightmap baking to limit the visible artifacts.
   *
   * @type {boolean}
   */

  /**
   * Enables HDR lightmaps. This can result in smoother lightmaps especially when many samples
   * are used. Defaults to false.
   *
   * @type {boolean}
   */

  /**
   * The root entity of the scene, which is usually the only child to the {@link Application}
   * root entity.
   *
   * @type {import('../framework/entity.js').Entity}
   */

  /**
   * The sky of the scene.
   *
   * @type {Sky}
   * @ignore
   */

  /**
   * Use physically based units for cameras and lights. When used, the exposure value is ignored.
   *
   * @type {boolean}
   */

  /**
   * Create a new Scene instance.
   *
   * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
   * The graphics device used to manage this scene.
   * @hideconstructor
   */
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
    this.sky = null;
    this.physicalUnits = false;
    Debug.assertDeprecated(graphicsDevice, "Scene constructor takes a GraphicsDevice as a parameter, and it was not provided.");
    this.device = graphicsDevice || GraphicsDeviceAccess.get();
    this._gravity = new Vec3(0, -9.8, 0);

    /**
     * @type {import('./composition/layer-composition.js').LayerComposition}
     * @private
     */
    this._layers = null;
    this._fog = FOG_NONE;
    this._gammaCorrection = GAMMA_SRGB;
    this._toneMapping = 0;

    /**
     * The skybox cubemap as set by user (gets used when skyboxMip === 0)
     *
     * @type {import('../platform/graphics/texture.js').Texture}
     * @private
     */
    this._skyboxCubeMap = null;

    /**
     * Array of 6 prefiltered lighting data cubemaps.
     *
     * @type {import('../platform/graphics/texture.js').Texture[]}
     * @private
     */
    this._prefilteredCubemaps = [null, null, null, null, null, null];

    /**
     * Environment lighting atlas
     *
     * @type {import('../platform/graphics/texture.js').Texture}
     * @private
     */
    this._envAtlas = null;

    // internally generated envAtlas owned by the scene
    this._internalEnvAtlas = null;
    this._skyboxIntensity = 1;
    this._skyboxLuminance = 0;
    this._skyboxMip = 0;
    this._skyboxRotation = new Quat();
    this._skyboxRotationMat3 = new Mat3();
    this._skyboxRotationMat4 = new Mat4();

    // ambient light lightmapping properties
    this._ambientBakeNumSamples = 1;
    this._ambientBakeSpherePart = 0.4;
    this._lightmapFilterRange = 10;
    this._lightmapFilterSmoothness = 0.2;

    // clustered lighting
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
      updateShadersTime: 0 // deprecated
    };

    /**
     * This flag indicates changes were made to the scene which may require recompilation of
     * shaders that reference global settings.
     *
     * @type {boolean}
     * @ignore
     */
    this.updateShaders = true;
    this._shaderVersion = 0;
    this._statsUpdated = false;

    // immediate rendering
    this.immediate = new Immediate(this.device);
  }

  /**
   * Fired when the skybox is set.
   *
   * @event Scene#set:skybox
   * @param {import('../platform/graphics/texture.js').Texture} usedTex - Previously used cubemap
   * texture. New is in the {@link Scene#skybox}.
   */

  /**
   * Fired when the layer composition is set. Use this event to add callbacks or advanced
   * properties to your layers.
   *
   * @event Scene#set:layers
   * @param {import('./composition/layer-composition.js').LayerComposition} oldComp - Previously
   * used {@link LayerComposition}.
   * @param {import('./composition/layer-composition.js').LayerComposition} newComp - Newly set
   * {@link LayerComposition}.
   * @example
   * this.app.scene.on('set:layers', function (oldComp, newComp) {
   *     var list = newComp.layerList;
   *     var layer;
   *     for (var i = 0; i < list.length; i++) {
   *         layer = list[i];
   *         switch (layer.name) {
   *             case 'MyLayer':
   *                 layer.onEnable = myOnEnableFunction;
   *                 layer.onDisable = myOnDisableFunction;
   *                 break;
   *             case 'MyOtherLayer':
   *                 layer.shaderPass = myShaderPass;
   *                 break;
   *         }
   *     }
   * });
   */

  /**
   * Returns the default layer used by the immediate drawing functions.
   *
   * @type {import('./layer.js').Layer}
   * @private
   */
  get defaultDrawLayer() {
    return this.layers.getLayerById(LAYERID_IMMEDIATE);
  }

  /**
   * If {@link Scene#ambientBake} is true, this specifies the number of samples used to bake the
   * ambient light into the lightmap. Defaults to 1. Maximum value is 255.
   *
   * @type {number}
   */
  set ambientBakeNumSamples(value) {
    this._ambientBakeNumSamples = math.clamp(Math.floor(value), 1, 255);
  }
  get ambientBakeNumSamples() {
    return this._ambientBakeNumSamples;
  }

  /**
   * If {@link Scene#ambientBake} is true, this specifies a part of the sphere which represents
   * the source of ambient light. The valid range is 0..1, representing a part of the sphere from
   * top to the bottom. A value of 0.5 represents the upper hemisphere. A value of 1 represents a
   * full sphere. Defaults to 0.4, which is a smaller upper hemisphere as this requires fewer
   * samples to bake.
   *
   * @type {number}
   */
  set ambientBakeSpherePart(value) {
    this._ambientBakeSpherePart = math.clamp(value, 0.001, 1);
  }
  get ambientBakeSpherePart() {
    return this._ambientBakeSpherePart;
  }

  /**
   * True if the clustered lighting is enabled. Set to false before the first frame is rendered
   * to use non-clustered lighting. Defaults to true.
   *
   * @type {boolean}
   */
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

  /**
   * List of all active composition mesh instances. Only for backwards compatibility.
   * TODO: BatchManager is using it - perhaps that could be refactored
   *
   * @type {MeshInstance[]}
   * @private
   */
  set drawCalls(value) {}
  get drawCalls() {
    let drawCalls = this.layers._meshInstances;
    if (!drawCalls.length) {
      this.layers._update(this.device, this.clusteredLightingEnabled);
      drawCalls = this.layers._meshInstances;
    }
    return drawCalls;
  }

  /**
   * The environment lighting atlas.
   *
   * @type {import('../platform/graphics/texture.js').Texture}
   */
  set envAtlas(value) {
    if (value !== this._envAtlas) {
      this._envAtlas = value;

      // make sure required options are set up on the texture
      if (value) {
        value.addressU = ADDRESS_REPEAT;
        value.addressV = ADDRESS_CLAMP_TO_EDGE;
        value.minFilter = FILTER_LINEAR;
        value.magFilter = FILTER_LINEAR;
        value.mipmaps = false;
      }
      this.updateShaders = true;
    }
  }
  get envAtlas() {
    return this._envAtlas;
  }

  /**
   * The type of fog used by the scene. Can be:
   *
   * - {@link FOG_NONE}
   * - {@link FOG_LINEAR}
   * - {@link FOG_EXP}
   * - {@link FOG_EXP2}
   *
   * Defaults to {@link FOG_NONE}.
   *
   * @type {string}
   */
  set fog(type) {
    if (type !== this._fog) {
      this._fog = type;
      this.updateShaders = true;
    }
  }
  get fog() {
    return this._fog;
  }

  /**
   * The gamma correction to apply when rendering the scene. Can be:
   *
   * - {@link GAMMA_NONE}
   * - {@link GAMMA_SRGB}
   *
   * Defaults to {@link GAMMA_SRGB}.
   *
   * @type {number}
   */
  set gammaCorrection(value) {
    if (value !== this._gammaCorrection) {
      this._gammaCorrection = value;
      this.updateShaders = true;
    }
  }
  get gammaCorrection() {
    return this._gammaCorrection;
  }

  /**
   * A {@link LayerComposition} that defines rendering order of this scene.
   *
   * @type {import('./composition/layer-composition.js').LayerComposition}
   */
  set layers(layers) {
    const prev = this._layers;
    this._layers = layers;
    this.fire('set:layers', prev, layers);
  }
  get layers() {
    return this._layers;
  }

  /**
   * A {@link LightingParams} that defines lighting parameters.
   *
   * @type {LightingParams}
   */
  get lighting() {
    return this._lightingParams;
  }

  /**
   * A range parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled}
   * is enabled. Larger value applies more widespread blur. This needs to be a positive non-zero
   * value. Defaults to 10.
   *
   * @type {number}
   */
  set lightmapFilterRange(value) {
    this._lightmapFilterRange = Math.max(value, 0.001);
  }
  get lightmapFilterRange() {
    return this._lightmapFilterRange;
  }

  /**
   * A spatial parameter of the bilateral filter. It's used when {@link Scene#lightmapFilterEnabled}
   * is enabled. Larger value blurs less similar colors. This needs to be a positive non-zero
   * value. Defaults to 0.2.
   *
   * @type {number}
   */
  set lightmapFilterSmoothness(value) {
    this._lightmapFilterSmoothness = Math.max(value, 0.001);
  }
  get lightmapFilterSmoothness() {
    return this._lightmapFilterSmoothness;
  }

  /**
   * Set of 6 prefiltered cubemaps.
   *
   * @type {import('../platform/graphics/texture.js').Texture[]}
   */
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
        // update env atlas
        this._internalEnvAtlas = EnvLighting.generatePrefilteredAtlas(cubemaps, {
          target: this._internalEnvAtlas
        });
        if (!this._envAtlas) {
          // user hasn't set an envAtlas already, set it to the internal one
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

  /**
   * The base cubemap texture used as the scene's skybox, if mip level is 0. Defaults to null.
   *
   * @type {import('../platform/graphics/texture.js').Texture}
   */
  set skybox(value) {
    if (value !== this._skyboxCubeMap) {
      this._skyboxCubeMap = value;
      this._resetSky();
    }
  }
  get skybox() {
    return this._skyboxCubeMap;
  }

  /**
   * Multiplier for skybox intensity. Defaults to 1. Unused if physical units are used.
   *
   * @type {number}
   */
  set skyboxIntensity(value) {
    if (value !== this._skyboxIntensity) {
      this._skyboxIntensity = value;
      this._resetSky();
    }
  }
  get skyboxIntensity() {
    return this._skyboxIntensity;
  }

  /**
   * Luminance (in lm/m^2) of skybox. Defaults to 0. Only used if physical units are used.
   *
   * @type {number}
   */
  set skyboxLuminance(value) {
    if (value !== this._skyboxLuminance) {
      this._skyboxLuminance = value;
      this._resetSky();
    }
  }
  get skyboxLuminance() {
    return this._skyboxLuminance;
  }

  /**
   * The mip level of the skybox to be displayed. Only valid for prefiltered cubemap skyboxes.
   * Defaults to 0 (base level).
   *
   * @type {number}
   */
  set skyboxMip(value) {
    if (value !== this._skyboxMip) {
      this._skyboxMip = value;
      this._resetSky();
    }
  }
  get skyboxMip() {
    return this._skyboxMip;
  }

  /**
   * The rotation of the skybox to be displayed. Defaults to {@link Quat.IDENTITY}.
   *
   * @type {Quat}
   */
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

  /**
   * The tonemapping transform to apply when writing fragments to the frame buffer. Can be:
   *
   * - {@link TONEMAP_LINEAR}
   * - {@link TONEMAP_FILMIC}
   * - {@link TONEMAP_HEJL}
   * - {@link TONEMAP_ACES}
   *
   * Defaults to {@link TONEMAP_LINEAR}.
   *
   * @type {number}
   */
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

    // settings
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
      this.skyboxRotation = new Quat().setFromEulerAngles(render.skyboxRotation[0], render.skyboxRotation[1], render.skyboxRotation[2]);
    }
    this.clusteredLightingEnabled = render.clusteredLightingEnabled;
    this.lighting.applySettings(render);

    // bake settings
    ['lightmapFilterEnabled', 'lightmapFilterRange', 'lightmapFilterSmoothness', 'ambientBake', 'ambientBakeNumSamples', 'ambientBakeSpherePart', 'ambientBakeOcclusionBrightness', 'ambientBakeOcclusionContrast'].forEach(setting => {
      if (render.hasOwnProperty(setting)) {
        this[setting] = render[setting];
      }
    });
    this._resetSky();
  }

  // get the actual texture to use for skybox rendering
  _getSkyboxTex() {
    const cubemaps = this._prefilteredCubemaps;
    if (this._skyboxMip) {
      // skybox selection for some reason has always skipped the 32x32 prefiltered mipmap, presumably a bug.
      // we can't simply fix this and map 3 to the correct level, since doing so has the potential
      // to change the look of existing scenes dramatically.
      // NOTE: the table skips the 32x32 mipmap
      const skyboxMapping = [0, 1, /* 2 */3, 4, 5, 6];

      // select blurry texture for use on the skybox
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

  /**
   * Sets the cubemap for the scene skybox.
   *
   * @param {import('../platform/graphics/texture.js').Texture[]} [cubemaps] - An array of
   * cubemaps corresponding to the skybox at different mip levels. If undefined, scene will
   * remove skybox. Cubemap array should be of size 7, with the first element (index 0)
   * corresponding to the base cubemap (mip level 0) with original resolution. Each remaining
   * element (index 1-6) corresponds to a fixed prefiltered resolution (128x128, 64x64, 32x32,
   * 16x16, 8x8, 4x4).
   */
  setSkybox(cubemaps) {
    if (!cubemaps) {
      this.skybox = null;
      this.prefilteredCubemaps = [null, null, null, null, null, null];
    } else {
      this.skybox = cubemaps[0] || null;
      this.prefilteredCubemaps = cubemaps.slice(1);
    }
  }

  /**
   * Get the lightmap pixel format.
   *
   * @type {number} The pixel format.
   */
  get lightmapPixelFormat() {
    return this.lightmapHDR && this.device.getHdrFormat(false, true, false, true) || PIXELFORMAT_RGBA8;
  }
}

export { Scene };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9zY2VuZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IE1hdDMgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0My5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdDQuanMnO1xuXG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgUElYRUxGT1JNQVRfUkdCQTgsIEFERFJFU1NfUkVQRUFULCBBRERSRVNTX0NMQU1QX1RPX0VER0UsIEZJTFRFUl9MSU5FQVIgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBCQUtFX0NPTE9SRElSLCBGT0dfTk9ORSwgR0FNTUFfU1JHQiwgTEFZRVJJRF9JTU1FRElBVEUgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTa3kgfSBmcm9tICcuL3NreS5qcyc7XG5pbXBvcnQgeyBMaWdodGluZ1BhcmFtcyB9IGZyb20gJy4vbGlnaHRpbmcvbGlnaHRpbmctcGFyYW1zLmpzJztcbmltcG9ydCB7IEltbWVkaWF0ZSB9IGZyb20gJy4vaW1tZWRpYXRlL2ltbWVkaWF0ZS5qcyc7XG5pbXBvcnQgeyBFbnZMaWdodGluZyB9IGZyb20gJy4vZ3JhcGhpY3MvZW52LWxpZ2h0aW5nLmpzJztcblxuLyoqXG4gKiBBIHNjZW5lIGlzIGdyYXBoaWNhbCByZXByZXNlbnRhdGlvbiBvZiBhbiBlbnZpcm9ubWVudC4gSXQgbWFuYWdlcyB0aGUgc2NlbmUgaGllcmFyY2h5LCBhbGxcbiAqIGdyYXBoaWNhbCBvYmplY3RzLCBsaWdodHMsIGFuZCBzY2VuZS13aWRlIHByb3BlcnRpZXMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBTY2VuZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogSWYgZW5hYmxlZCwgdGhlIGFtYmllbnQgbGlnaHRpbmcgd2lsbCBiZSBiYWtlZCBpbnRvIGxpZ2h0bWFwcy4gVGhpcyB3aWxsIGJlIGVpdGhlciB0aGVcbiAgICAgKiB7QGxpbmsgU2NlbmUjc2t5Ym94fSBpZiBzZXQgdXAsIG90aGVyd2lzZSB7QGxpbmsgU2NlbmUjYW1iaWVudExpZ2h0fS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBhbWJpZW50QmFrZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSWYge0BsaW5rIFNjZW5lI2FtYmllbnRCYWtlfSBpcyB0cnVlLCB0aGlzIHNwZWNpZmllcyB0aGUgYnJpZ2h0bmVzcyBvZiBhbWJpZW50IG9jY2x1c2lvbi5cbiAgICAgKiBUeXBpY2FsIHJhbmdlIGlzIC0xIHRvIDEuIERlZmF1bHRzIHRvIDAsIHJlcHJlc2VudGluZyBubyBjaGFuZ2UgdG8gYnJpZ2h0bmVzcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzID0gMDtcblxuICAgICAvKipcbiAgICAgICogSWYge0BsaW5rIFNjZW5lI2FtYmllbnRCYWtlfSBpcyB0cnVlLCB0aGlzIHNwZWNpZmllcyB0aGUgY29udHJhc3Qgb2YgYW1iaWVudCBvY2NsdXNpb24uXG4gICAgICAqIFR5cGljYWwgcmFuZ2UgaXMgLTEgdG8gMS4gRGVmYXVsdHMgdG8gMCwgcmVwcmVzZW50aW5nIG5vIGNoYW5nZSB0byBjb250cmFzdC5cbiAgICAgICpcbiAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICovXG4gICAgYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sb3Igb2YgdGhlIHNjZW5lJ3MgYW1iaWVudCBsaWdodC4gRGVmYXVsdHMgdG8gYmxhY2sgKDAsIDAsIDApLlxuICAgICAqXG4gICAgICogQHR5cGUge0NvbG9yfVxuICAgICAqL1xuICAgIGFtYmllbnRMaWdodCA9IG5ldyBDb2xvcigwLCAwLCAwKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBsdW1pbm9zaXR5IG9mIHRoZSBzY2VuZSdzIGFtYmllbnQgbGlnaHQgaW4gbHV4IChsbS9tXjIpLiBVc2VkIGlmIHBoeXNpY2FsVW5pdHMgaXMgdHJ1ZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgYW1iaWVudEx1bWluYW5jZSA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZXhwb3N1cmUgdmFsdWUgdHdlYWtzIHRoZSBvdmVyYWxsIGJyaWdodG5lc3Mgb2YgdGhlIHNjZW5lLiBJZ25vcmVkIGlmIHBoeXNpY2FsVW5pdHMgaXMgdHJ1ZS4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZXhwb3N1cmUgPSAxO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIG9mIHRoZSBmb2cgKGlmIGVuYWJsZWQpLiBEZWZhdWx0cyB0byBibGFjayAoMCwgMCwgMCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Q29sb3J9XG4gICAgICovXG4gICAgZm9nQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGVuc2l0eSBvZiB0aGUgZm9nIChpZiBlbmFibGVkKS4gVGhpcyBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0XG4gICAgICogdG8ge0BsaW5rIEZPR19FWFB9IG9yIHtAbGluayBGT0dfRVhQMn0uIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGZvZ0RlbnNpdHkgPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCB3aGVyZSBsaW5lYXIgZm9nIHJlYWNoZXMgaXRzIG1heGltdW0uIFRoaXMgcHJvcGVydHkgaXMgb25seVxuICAgICAqIHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfTElORUFSfS4gRGVmYXVsdHMgdG8gMTAwMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZm9nRW5kID0gMTAwMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgd2hlcmUgbGluZWFyIGZvZyBiZWdpbnMuIFRoaXMgcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGVcbiAgICAgKiBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfTElORUFSfS4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZm9nU3RhcnQgPSAxO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGxpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBsaWdodG1hcCByZXNvbHV0aW9uLiBEZWZhdWx0cyB0byAyMDQ4LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBsaWdodG1hcE1heFJlc29sdXRpb24gPSAyMDQ4O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGxpZ2h0bWFwIGJha2luZyBtb2RlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUkRJUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcCArIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbiAodXNlZCBmb3IgYnVtcCBvclxuICAgICAqIHNwZWN1bGFyKS4gT25seSBsaWdodHMgd2l0aCBiYWtlRGlyPXRydWUgd2lsbCBiZSB1c2VkIGZvciBnZW5lcmF0aW5nIHRoZSBkb21pbmFudCBsaWdodFxuICAgICAqIGRpcmVjdGlvbi5cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBCQUtFX0NPTE9SRElSfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgbGlnaHRtYXBNb2RlID0gQkFLRV9DT0xPUkRJUjtcblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgYmlsYXRlcmFsIGZpbHRlciBvbiBydW50aW1lIGJha2VkIGNvbG9yIGxpZ2h0bWFwcywgd2hpY2ggcmVtb3ZlcyB0aGUgbm9pc2UgYW5kXG4gICAgICogYmFuZGluZyB3aGlsZSBwcmVzZXJ2aW5nIHRoZSBlZGdlcy4gRGVmYXVsdHMgdG8gZmFsc2UuIE5vdGUgdGhhdCB0aGUgZmlsdGVyaW5nIHRha2VzIHBsYWNlXG4gICAgICogaW4gdGhlIGltYWdlIHNwYWNlIG9mIHRoZSBsaWdodG1hcCwgYW5kIGl0IGRvZXMgbm90IGZpbHRlciBhY3Jvc3MgbGlnaHRtYXAgVVYgc3BhY2Ugc2VhbXMsXG4gICAgICogb2Z0ZW4gbWFraW5nIHRoZSBzZWFtcyBtb3JlIHZpc2libGUuIEl0J3MgaW1wb3J0YW50IHRvIGJhbGFuY2UgdGhlIHN0cmVuZ3RoIG9mIHRoZSBmaWx0ZXJcbiAgICAgKiB3aXRoIG51bWJlciBvZiBzYW1wbGVzIHVzZWQgZm9yIGxpZ2h0bWFwIGJha2luZyB0byBsaW1pdCB0aGUgdmlzaWJsZSBhcnRpZmFjdHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBsaWdodG1hcEZpbHRlckVuYWJsZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgSERSIGxpZ2h0bWFwcy4gVGhpcyBjYW4gcmVzdWx0IGluIHNtb290aGVyIGxpZ2h0bWFwcyBlc3BlY2lhbGx5IHdoZW4gbWFueSBzYW1wbGVzXG4gICAgICogYXJlIHVzZWQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgbGlnaHRtYXBIRFIgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByb290IGVudGl0eSBvZiB0aGUgc2NlbmUsIHdoaWNoIGlzIHVzdWFsbHkgdGhlIG9ubHkgY2hpbGQgdG8gdGhlIHtAbGluayBBcHBsaWNhdGlvbn1cbiAgICAgKiByb290IGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICovXG4gICAgcm9vdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc2t5IG9mIHRoZSBzY2VuZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTa3l9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNreSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBVc2UgcGh5c2ljYWxseSBiYXNlZCB1bml0cyBmb3IgY2FtZXJhcyBhbmQgbGlnaHRzLiBXaGVuIHVzZWQsIHRoZSBleHBvc3VyZSB2YWx1ZSBpcyBpZ25vcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgcGh5c2ljYWxVbml0cyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjZW5lIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtXG4gICAgICogVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGlzIHNjZW5lLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIERlYnVnLmFzc2VydERlcHJlY2F0ZWQoZ3JhcGhpY3NEZXZpY2UsIFwiU2NlbmUgY29uc3RydWN0b3IgdGFrZXMgYSBHcmFwaGljc0RldmljZSBhcyBhIHBhcmFtZXRlciwgYW5kIGl0IHdhcyBub3QgcHJvdmlkZWQuXCIpO1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlIHx8IEdyYXBoaWNzRGV2aWNlQWNjZXNzLmdldCgpO1xuXG4gICAgICAgIHRoaXMuX2dyYXZpdHkgPSBuZXcgVmVjMygwLCAtOS44LCAwKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2ZvZyA9IEZPR19OT05FO1xuXG4gICAgICAgIHRoaXMuX2dhbW1hQ29ycmVjdGlvbiA9IEdBTU1BX1NSR0I7XG4gICAgICAgIHRoaXMuX3RvbmVNYXBwaW5nID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNreWJveCBjdWJlbWFwIGFzIHNldCBieSB1c2VyIChnZXRzIHVzZWQgd2hlbiBza3lib3hNaXAgPT09IDApXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2t5Ym94Q3ViZU1hcCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IG9mIDYgcHJlZmlsdGVyZWQgbGlnaHRpbmcgZGF0YSBjdWJlbWFwcy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmVbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHMgPSBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEVudmlyb25tZW50IGxpZ2h0aW5nIGF0bGFzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZW52QXRsYXMgPSBudWxsO1xuXG4gICAgICAgIC8vIGludGVybmFsbHkgZ2VuZXJhdGVkIGVudkF0bGFzIG93bmVkIGJ5IHRoZSBzY2VuZVxuICAgICAgICB0aGlzLl9pbnRlcm5hbEVudkF0bGFzID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9za3lib3hJbnRlbnNpdHkgPSAxO1xuICAgICAgICB0aGlzLl9za3lib3hMdW1pbmFuY2UgPSAwO1xuICAgICAgICB0aGlzLl9za3lib3hNaXAgPSAwO1xuXG4gICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uID0gbmV3IFF1YXQoKTtcbiAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb25NYXQzID0gbmV3IE1hdDMoKTtcbiAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb25NYXQ0ID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvLyBhbWJpZW50IGxpZ2h0IGxpZ2h0bWFwcGluZyBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuX2FtYmllbnRCYWtlTnVtU2FtcGxlcyA9IDE7XG4gICAgICAgIHRoaXMuX2FtYmllbnRCYWtlU3BoZXJlUGFydCA9IDAuNDtcblxuICAgICAgICB0aGlzLl9saWdodG1hcEZpbHRlclJhbmdlID0gMTA7XG4gICAgICAgIHRoaXMuX2xpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyA9IDAuMjtcblxuICAgICAgICAvLyBjbHVzdGVyZWQgbGlnaHRpbmdcbiAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbGlnaHRpbmdQYXJhbXMgPSBuZXcgTGlnaHRpbmdQYXJhbXModGhpcy5kZXZpY2Uuc3VwcG9ydHNBcmVhTGlnaHRzLCB0aGlzLmRldmljZS5tYXhUZXh0dXJlU2l6ZSwgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fbGF5ZXJzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX3N0YXRzID0ge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlczogMCxcbiAgICAgICAgICAgIGxpZ2h0czogMCxcbiAgICAgICAgICAgIGR5bmFtaWNMaWdodHM6IDAsXG4gICAgICAgICAgICBiYWtlZExpZ2h0czogMCxcbiAgICAgICAgICAgIGxhc3RTdGF0aWNQcmVwYXJlRnVsbFRpbWU6IDAsXG4gICAgICAgICAgICBsYXN0U3RhdGljUHJlcGFyZVNlYXJjaFRpbWU6IDAsXG4gICAgICAgICAgICBsYXN0U3RhdGljUHJlcGFyZVdyaXRlVGltZTogMCxcbiAgICAgICAgICAgIGxhc3RTdGF0aWNQcmVwYXJlVHJpQWFiYlRpbWU6IDAsXG4gICAgICAgICAgICBsYXN0U3RhdGljUHJlcGFyZUNvbWJpbmVUaW1lOiAwLFxuICAgICAgICAgICAgdXBkYXRlU2hhZGVyc1RpbWU6IDAgLy8gZGVwcmVjYXRlZFxuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGlzIGZsYWcgaW5kaWNhdGVzIGNoYW5nZXMgd2VyZSBtYWRlIHRvIHRoZSBzY2VuZSB3aGljaCBtYXkgcmVxdWlyZSByZWNvbXBpbGF0aW9uIG9mXG4gICAgICAgICAqIHNoYWRlcnMgdGhhdCByZWZlcmVuY2UgZ2xvYmFsIHNldHRpbmdzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl9zaGFkZXJWZXJzaW9uID0gMDtcbiAgICAgICAgdGhpcy5fc3RhdHNVcGRhdGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gaW1tZWRpYXRlIHJlbmRlcmluZ1xuICAgICAgICB0aGlzLmltbWVkaWF0ZSA9IG5ldyBJbW1lZGlhdGUodGhpcy5kZXZpY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIHNreWJveCBpcyBzZXQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NlbmUjc2V0OnNreWJveFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gdXNlZFRleCAtIFByZXZpb3VzbHkgdXNlZCBjdWJlbWFwXG4gICAgICogdGV4dHVyZS4gTmV3IGlzIGluIHRoZSB7QGxpbmsgU2NlbmUjc2t5Ym94fS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGxheWVyIGNvbXBvc2l0aW9uIGlzIHNldC4gVXNlIHRoaXMgZXZlbnQgdG8gYWRkIGNhbGxiYWNrcyBvciBhZHZhbmNlZFxuICAgICAqIHByb3BlcnRpZXMgdG8geW91ciBsYXllcnMuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NlbmUjc2V0OmxheWVyc1xuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gb2xkQ29tcCAtIFByZXZpb3VzbHlcbiAgICAgKiB1c2VkIHtAbGluayBMYXllckNvbXBvc2l0aW9ufS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IG5ld0NvbXAgLSBOZXdseSBzZXRcbiAgICAgKiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB0aGlzLmFwcC5zY2VuZS5vbignc2V0OmxheWVycycsIGZ1bmN0aW9uIChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICogICAgIHZhciBsaXN0ID0gbmV3Q29tcC5sYXllckxpc3Q7XG4gICAgICogICAgIHZhciBsYXllcjtcbiAgICAgKiAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICogICAgICAgICBsYXllciA9IGxpc3RbaV07XG4gICAgICogICAgICAgICBzd2l0Y2ggKGxheWVyLm5hbWUpIHtcbiAgICAgKiAgICAgICAgICAgICBjYXNlICdNeUxheWVyJzpcbiAgICAgKiAgICAgICAgICAgICAgICAgbGF5ZXIub25FbmFibGUgPSBteU9uRW5hYmxlRnVuY3Rpb247XG4gICAgICogICAgICAgICAgICAgICAgIGxheWVyLm9uRGlzYWJsZSA9IG15T25EaXNhYmxlRnVuY3Rpb247XG4gICAgICogICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgICAgIGNhc2UgJ015T3RoZXJMYXllcic6XG4gICAgICogICAgICAgICAgICAgICAgIGxheWVyLnNoYWRlclBhc3MgPSBteVNoYWRlclBhc3M7XG4gICAgICogICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgfVxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBkZWZhdWx0IGxheWVyIHVzZWQgYnkgdGhlIGltbWVkaWF0ZSBkcmF3aW5nIGZ1bmN0aW9ucy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbGF5ZXIuanMnKS5MYXllcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGdldCBkZWZhdWx0RHJhd0xheWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB7QGxpbmsgU2NlbmUjYW1iaWVudEJha2V9IGlzIHRydWUsIHRoaXMgc3BlY2lmaWVzIHRoZSBudW1iZXIgb2Ygc2FtcGxlcyB1c2VkIHRvIGJha2UgdGhlXG4gICAgICogYW1iaWVudCBsaWdodCBpbnRvIHRoZSBsaWdodG1hcC4gRGVmYXVsdHMgdG8gMS4gTWF4aW11bSB2YWx1ZSBpcyAyNTUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhbWJpZW50QmFrZU51bVNhbXBsZXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYW1iaWVudEJha2VOdW1TYW1wbGVzID0gbWF0aC5jbGFtcChNYXRoLmZsb29yKHZhbHVlKSwgMSwgMjU1KTtcbiAgICB9XG5cbiAgICBnZXQgYW1iaWVudEJha2VOdW1TYW1wbGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW1iaWVudEJha2VOdW1TYW1wbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHtAbGluayBTY2VuZSNhbWJpZW50QmFrZX0gaXMgdHJ1ZSwgdGhpcyBzcGVjaWZpZXMgYSBwYXJ0IG9mIHRoZSBzcGhlcmUgd2hpY2ggcmVwcmVzZW50c1xuICAgICAqIHRoZSBzb3VyY2Ugb2YgYW1iaWVudCBsaWdodC4gVGhlIHZhbGlkIHJhbmdlIGlzIDAuLjEsIHJlcHJlc2VudGluZyBhIHBhcnQgb2YgdGhlIHNwaGVyZSBmcm9tXG4gICAgICogdG9wIHRvIHRoZSBib3R0b20uIEEgdmFsdWUgb2YgMC41IHJlcHJlc2VudHMgdGhlIHVwcGVyIGhlbWlzcGhlcmUuIEEgdmFsdWUgb2YgMSByZXByZXNlbnRzIGFcbiAgICAgKiBmdWxsIHNwaGVyZS4gRGVmYXVsdHMgdG8gMC40LCB3aGljaCBpcyBhIHNtYWxsZXIgdXBwZXIgaGVtaXNwaGVyZSBhcyB0aGlzIHJlcXVpcmVzIGZld2VyXG4gICAgICogc2FtcGxlcyB0byBiYWtlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYW1iaWVudEJha2VTcGhlcmVQYXJ0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FtYmllbnRCYWtlU3BoZXJlUGFydCA9IG1hdGguY2xhbXAodmFsdWUsIDAuMDAxLCAxKTtcbiAgICB9XG5cbiAgICBnZXQgYW1iaWVudEJha2VTcGhlcmVQYXJ0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW1iaWVudEJha2VTcGhlcmVQYXJ0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBlbmFibGVkLiBTZXQgdG8gZmFsc2UgYmVmb3JlIHRoZSBmaXJzdCBmcmFtZSBpcyByZW5kZXJlZFxuICAgICAqIHRvIHVzZSBub24tY2x1c3RlcmVkIGxpZ2h0aW5nLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCh2YWx1ZSkge1xuXG4gICAgICAgIGlmICghdGhpcy5fY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdUdXJuaW5nIG9uIGRpc2FibGVkIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBub3QgY3VycmVudGx5IHN1cHBvcnRlZCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaXN0IG9mIGFsbCBhY3RpdmUgY29tcG9zaXRpb24gbWVzaCBpbnN0YW5jZXMuIE9ubHkgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICAgICAqIFRPRE86IEJhdGNoTWFuYWdlciBpcyB1c2luZyBpdCAtIHBlcmhhcHMgdGhhdCBjb3VsZCBiZSByZWZhY3RvcmVkXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWVzaEluc3RhbmNlW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzZXQgZHJhd0NhbGxzKHZhbHVlKSB7XG4gICAgfVxuXG4gICAgZ2V0IGRyYXdDYWxscygpIHtcbiAgICAgICAgbGV0IGRyYXdDYWxscyA9IHRoaXMubGF5ZXJzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICBpZiAoIWRyYXdDYWxscy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMubGF5ZXJzLl91cGRhdGUodGhpcy5kZXZpY2UsIHRoaXMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKTtcbiAgICAgICAgICAgIGRyYXdDYWxscyA9IHRoaXMubGF5ZXJzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkcmF3Q2FsbHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGVudmlyb25tZW50IGxpZ2h0aW5nIGF0bGFzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9XG4gICAgICovXG4gICAgc2V0IGVudkF0bGFzKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fZW52QXRsYXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2VudkF0bGFzID0gdmFsdWU7XG5cbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSByZXF1aXJlZCBvcHRpb25zIGFyZSBzZXQgdXAgb24gdGhlIHRleHR1cmVcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHZhbHVlLmFkZHJlc3NVID0gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgICAgICAgICAgdmFsdWUuYWRkcmVzc1YgPSBBRERSRVNTX0NMQU1QX1RPX0VER0U7XG4gICAgICAgICAgICAgICAgdmFsdWUubWluRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICB2YWx1ZS5tYWdGaWx0ZXIgPSBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgICAgIHZhbHVlLm1pcG1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBlbnZBdGxhcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VudkF0bGFzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIGZvZyB1c2VkIGJ5IHRoZSBzY2VuZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRk9HX05PTkV9XG4gICAgICogLSB7QGxpbmsgRk9HX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGT0dfRVhQfVxuICAgICAqIC0ge0BsaW5rIEZPR19FWFAyfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEZPR19OT05FfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IGZvZyh0eXBlKSB7XG4gICAgICAgIGlmICh0eXBlICE9PSB0aGlzLl9mb2cpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZvZyA9IHR5cGU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZvZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZvZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZ2FtbWEgY29ycmVjdGlvbiB0byBhcHBseSB3aGVuIHJlbmRlcmluZyB0aGUgc2NlbmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEdBTU1BX05PTkV9XG4gICAgICogLSB7QGxpbmsgR0FNTUFfU1JHQn1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBHQU1NQV9TUkdCfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGdhbW1hQ29ycmVjdGlvbih2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2dhbW1hQ29ycmVjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fZ2FtbWFDb3JyZWN0aW9uID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGdhbW1hQ29ycmVjdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dhbW1hQ29ycmVjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHtAbGluayBMYXllckNvbXBvc2l0aW9ufSB0aGF0IGRlZmluZXMgcmVuZGVyaW5nIG9yZGVyIG9mIHRoaXMgc2NlbmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn1cbiAgICAgKi9cbiAgICBzZXQgbGF5ZXJzKGxheWVycykge1xuICAgICAgICBjb25zdCBwcmV2ID0gdGhpcy5fbGF5ZXJzO1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBsYXllcnM7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OmxheWVycycsIHByZXYsIGxheWVycyk7XG4gICAgfVxuXG4gICAgZ2V0IGxheWVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVycztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHtAbGluayBMaWdodGluZ1BhcmFtc30gdGhhdCBkZWZpbmVzIGxpZ2h0aW5nIHBhcmFtZXRlcnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TGlnaHRpbmdQYXJhbXN9XG4gICAgICovXG4gICAgZ2V0IGxpZ2h0aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRpbmdQYXJhbXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByYW5nZSBwYXJhbWV0ZXIgb2YgdGhlIGJpbGF0ZXJhbCBmaWx0ZXIuIEl0J3MgdXNlZCB3aGVuIHtAbGluayBTY2VuZSNsaWdodG1hcEZpbHRlckVuYWJsZWR9XG4gICAgICogaXMgZW5hYmxlZC4gTGFyZ2VyIHZhbHVlIGFwcGxpZXMgbW9yZSB3aWRlc3ByZWFkIGJsdXIuIFRoaXMgbmVlZHMgdG8gYmUgYSBwb3NpdGl2ZSBub24temVyb1xuICAgICAqIHZhbHVlLiBEZWZhdWx0cyB0byAxMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpZ2h0bWFwRmlsdGVyUmFuZ2UodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBGaWx0ZXJSYW5nZSA9IE1hdGgubWF4KHZhbHVlLCAwLjAwMSk7XG4gICAgfVxuXG4gICAgZ2V0IGxpZ2h0bWFwRmlsdGVyUmFuZ2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcEZpbHRlclJhbmdlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgc3BhdGlhbCBwYXJhbWV0ZXIgb2YgdGhlIGJpbGF0ZXJhbCBmaWx0ZXIuIEl0J3MgdXNlZCB3aGVuIHtAbGluayBTY2VuZSNsaWdodG1hcEZpbHRlckVuYWJsZWR9XG4gICAgICogaXMgZW5hYmxlZC4gTGFyZ2VyIHZhbHVlIGJsdXJzIGxlc3Mgc2ltaWxhciBjb2xvcnMuIFRoaXMgbmVlZHMgdG8gYmUgYSBwb3NpdGl2ZSBub24temVyb1xuICAgICAqIHZhbHVlLiBEZWZhdWx0cyB0byAwLjIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcEZpbHRlclNtb290aG5lc3ModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzID0gTWF0aC5tYXgodmFsdWUsIDAuMDAxKTtcbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBvZiA2IHByZWZpbHRlcmVkIGN1YmVtYXBzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmVbXX1cbiAgICAgKi9cbiAgICBzZXQgcHJlZmlsdGVyZWRDdWJlbWFwcyh2YWx1ZSkge1xuICAgICAgICBjb25zdCBjdWJlbWFwcyA9IHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHM7XG5cbiAgICAgICAgdmFsdWUgPSB2YWx1ZSB8fCBbXTtcblxuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICBsZXQgY29tcGxldGUgPSB0cnVlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgdiA9IHZhbHVlW2ldIHx8IG51bGw7XG4gICAgICAgICAgICBpZiAoY3ViZW1hcHNbaV0gIT09IHYpIHtcbiAgICAgICAgICAgICAgICBjdWJlbWFwc1tpXSA9IHY7XG4gICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb21wbGV0ZSA9IGNvbXBsZXRlICYmICghIWN1YmVtYXBzW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuXG4gICAgICAgICAgICBpZiAoY29tcGxldGUpIHtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZW52IGF0bGFzXG4gICAgICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcyA9IEVudkxpZ2h0aW5nLmdlbmVyYXRlUHJlZmlsdGVyZWRBdGxhcyhjdWJlbWFwcywge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHRoaXMuX2ludGVybmFsRW52QXRsYXNcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fZW52QXRsYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNlciBoYXNuJ3Qgc2V0IGFuIGVudkF0bGFzIGFscmVhZHksIHNldCBpdCB0byB0aGUgaW50ZXJuYWwgb25lXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW52QXRsYXMgPSB0aGlzLl9pbnRlcm5hbEVudkF0bGFzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5faW50ZXJuYWxFbnZBdGxhcykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9lbnZBdGxhcyA9PT0gdGhpcy5faW50ZXJuYWxFbnZBdGxhcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudkF0bGFzID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcyA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcHJlZmlsdGVyZWRDdWJlbWFwcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGJhc2UgY3ViZW1hcCB0ZXh0dXJlIHVzZWQgYXMgdGhlIHNjZW5lJ3Mgc2t5Ym94LCBpZiBtaXAgbGV2ZWwgaXMgMC4gRGVmYXVsdHMgdG8gbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfVxuICAgICAqL1xuICAgIHNldCBza3lib3godmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9za3lib3hDdWJlTWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9za3lib3hDdWJlTWFwID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNreWJveCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NreWJveEN1YmVNYXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllciBmb3Igc2t5Ym94IGludGVuc2l0eS4gRGVmYXVsdHMgdG8gMS4gVW51c2VkIGlmIHBoeXNpY2FsIHVuaXRzIGFyZSB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc2t5Ym94SW50ZW5zaXR5KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fc2t5Ym94SW50ZW5zaXR5KSB7XG4gICAgICAgICAgICB0aGlzLl9za3lib3hJbnRlbnNpdHkgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0U2t5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2t5Ym94SW50ZW5zaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2t5Ym94SW50ZW5zaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEx1bWluYW5jZSAoaW4gbG0vbV4yKSBvZiBza3lib3guIERlZmF1bHRzIHRvIDAuIE9ubHkgdXNlZCBpZiBwaHlzaWNhbCB1bml0cyBhcmUgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNreWJveEx1bWluYW5jZSh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX3NreWJveEx1bWluYW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94THVtaW5hbmNlID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNreWJveEx1bWluYW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NreWJveEx1bWluYW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWlwIGxldmVsIG9mIHRoZSBza3lib3ggdG8gYmUgZGlzcGxheWVkLiBPbmx5IHZhbGlkIGZvciBwcmVmaWx0ZXJlZCBjdWJlbWFwIHNreWJveGVzLlxuICAgICAqIERlZmF1bHRzIHRvIDAgKGJhc2UgbGV2ZWwpLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc2t5Ym94TWlwKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fc2t5Ym94TWlwKSB7XG4gICAgICAgICAgICB0aGlzLl9za3lib3hNaXAgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0U2t5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2t5Ym94TWlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2t5Ym94TWlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSByb3RhdGlvbiBvZiB0aGUgc2t5Ym94IHRvIGJlIGRpc3BsYXllZC4gRGVmYXVsdHMgdG8ge0BsaW5rIFF1YXQuSURFTlRJVFl9LlxuICAgICAqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICovXG4gICAgc2V0IHNreWJveFJvdGF0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2t5Ym94Um90YXRpb24uZXF1YWxzKHZhbHVlKSkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb24uY29weSh2YWx1ZSk7XG4gICAgICAgICAgICBpZiAodmFsdWUuZXF1YWxzKFF1YXQuSURFTlRJVFkpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb25NYXQzLnNldElkZW50aXR5KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uTWF0NC5zZXRUUlMoVmVjMy5aRVJPLCB2YWx1ZSwgVmVjMy5PTkUpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uTWF0NC5pbnZlcnRUbzN4Myh0aGlzLl9za3lib3hSb3RhdGlvbk1hdDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fcmVzZXRTa3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBza3lib3hSb3RhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NreWJveFJvdGF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0b25lbWFwcGluZyB0cmFuc2Zvcm0gdG8gYXBwbHkgd2hlbiB3cml0aW5nIGZyYWdtZW50cyB0byB0aGUgZnJhbWUgYnVmZmVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0ZJTE1JQ31cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0hFSkx9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9BQ0VTfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFRPTkVNQVBfTElORUFSfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHRvbmVNYXBwaW5nKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fdG9uZU1hcHBpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX3RvbmVNYXBwaW5nID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHRvbmVNYXBwaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdG9uZU1hcHBpbmc7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fcmVzZXRTa3koKTtcbiAgICAgICAgdGhpcy5yb290ID0gbnVsbDtcbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG5cbiAgICBkcmF3TGluZShzdGFydCwgZW5kLCBjb2xvciA9IENvbG9yLldISVRFLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICBjb25zdCBiYXRjaCA9IHRoaXMuaW1tZWRpYXRlLmdldEJhdGNoKGxheWVyLCBkZXB0aFRlc3QpO1xuICAgICAgICBiYXRjaC5hZGRMaW5lcyhbc3RhcnQsIGVuZF0sIFtjb2xvciwgY29sb3JdKTtcbiAgICB9XG5cbiAgICBkcmF3TGluZXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoID0gdGhpcy5pbW1lZGlhdGUuZ2V0QmF0Y2gobGF5ZXIsIGRlcHRoVGVzdCk7XG4gICAgICAgIGJhdGNoLmFkZExpbmVzKHBvc2l0aW9ucywgY29sb3JzKTtcbiAgICB9XG5cbiAgICBkcmF3TGluZUFycmF5cyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYmF0Y2ggPSB0aGlzLmltbWVkaWF0ZS5nZXRCYXRjaChsYXllciwgZGVwdGhUZXN0KTtcbiAgICAgICAgYmF0Y2guYWRkTGluZXNBcnJheXMocG9zaXRpb25zLCBjb2xvcnMpO1xuICAgIH1cblxuICAgIGFwcGx5U2V0dGluZ3Moc2V0dGluZ3MpIHtcbiAgICAgICAgY29uc3QgcGh5c2ljcyA9IHNldHRpbmdzLnBoeXNpY3M7XG4gICAgICAgIGNvbnN0IHJlbmRlciA9IHNldHRpbmdzLnJlbmRlcjtcblxuICAgICAgICAvLyBzZXR0aW5nc1xuICAgICAgICB0aGlzLl9ncmF2aXR5LnNldChwaHlzaWNzLmdyYXZpdHlbMF0sIHBoeXNpY3MuZ3Jhdml0eVsxXSwgcGh5c2ljcy5ncmF2aXR5WzJdKTtcbiAgICAgICAgdGhpcy5hbWJpZW50TGlnaHQuc2V0KHJlbmRlci5nbG9iYWxfYW1iaWVudFswXSwgcmVuZGVyLmdsb2JhbF9hbWJpZW50WzFdLCByZW5kZXIuZ2xvYmFsX2FtYmllbnRbMl0pO1xuICAgICAgICB0aGlzLmFtYmllbnRMdW1pbmFuY2UgPSByZW5kZXIuYW1iaWVudEx1bWluYW5jZTtcbiAgICAgICAgdGhpcy5fZm9nID0gcmVuZGVyLmZvZztcbiAgICAgICAgdGhpcy5mb2dDb2xvci5zZXQocmVuZGVyLmZvZ19jb2xvclswXSwgcmVuZGVyLmZvZ19jb2xvclsxXSwgcmVuZGVyLmZvZ19jb2xvclsyXSk7XG4gICAgICAgIHRoaXMuZm9nU3RhcnQgPSByZW5kZXIuZm9nX3N0YXJ0O1xuICAgICAgICB0aGlzLmZvZ0VuZCA9IHJlbmRlci5mb2dfZW5kO1xuICAgICAgICB0aGlzLmZvZ0RlbnNpdHkgPSByZW5kZXIuZm9nX2RlbnNpdHk7XG4gICAgICAgIHRoaXMuX2dhbW1hQ29ycmVjdGlvbiA9IHJlbmRlci5nYW1tYV9jb3JyZWN0aW9uO1xuICAgICAgICB0aGlzLl90b25lTWFwcGluZyA9IHJlbmRlci50b25lbWFwcGluZztcbiAgICAgICAgdGhpcy5saWdodG1hcFNpemVNdWx0aXBsaWVyID0gcmVuZGVyLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXI7XG4gICAgICAgIHRoaXMubGlnaHRtYXBNYXhSZXNvbHV0aW9uID0gcmVuZGVyLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbjtcbiAgICAgICAgdGhpcy5saWdodG1hcE1vZGUgPSByZW5kZXIubGlnaHRtYXBNb2RlO1xuICAgICAgICB0aGlzLmV4cG9zdXJlID0gcmVuZGVyLmV4cG9zdXJlO1xuICAgICAgICB0aGlzLl9za3lib3hJbnRlbnNpdHkgPSByZW5kZXIuc2t5Ym94SW50ZW5zaXR5ID09PSB1bmRlZmluZWQgPyAxIDogcmVuZGVyLnNreWJveEludGVuc2l0eTtcbiAgICAgICAgdGhpcy5fc2t5Ym94THVtaW5hbmNlID0gcmVuZGVyLnNreWJveEx1bWluYW5jZSA9PT0gdW5kZWZpbmVkID8gMjAwMDAgOiByZW5kZXIuc2t5Ym94THVtaW5hbmNlO1xuICAgICAgICB0aGlzLl9za3lib3hNaXAgPSByZW5kZXIuc2t5Ym94TWlwID09PSB1bmRlZmluZWQgPyAwIDogcmVuZGVyLnNreWJveE1pcDtcblxuICAgICAgICBpZiAocmVuZGVyLnNreWJveFJvdGF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLnNreWJveFJvdGF0aW9uID0gKG5ldyBRdWF0KCkpLnNldEZyb21FdWxlckFuZ2xlcyhyZW5kZXIuc2t5Ym94Um90YXRpb25bMF0sIHJlbmRlci5za3lib3hSb3RhdGlvblsxXSwgcmVuZGVyLnNreWJveFJvdGF0aW9uWzJdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gcmVuZGVyLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgdGhpcy5saWdodGluZy5hcHBseVNldHRpbmdzKHJlbmRlcik7XG5cbiAgICAgICAgLy8gYmFrZSBzZXR0aW5nc1xuICAgICAgICBbXG4gICAgICAgICAgICAnbGlnaHRtYXBGaWx0ZXJFbmFibGVkJyxcbiAgICAgICAgICAgICdsaWdodG1hcEZpbHRlclJhbmdlJyxcbiAgICAgICAgICAgICdsaWdodG1hcEZpbHRlclNtb290aG5lc3MnLFxuICAgICAgICAgICAgJ2FtYmllbnRCYWtlJyxcbiAgICAgICAgICAgICdhbWJpZW50QmFrZU51bVNhbXBsZXMnLFxuICAgICAgICAgICAgJ2FtYmllbnRCYWtlU3BoZXJlUGFydCcsXG4gICAgICAgICAgICAnYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzJyxcbiAgICAgICAgICAgICdhbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0J1xuICAgICAgICBdLmZvckVhY2goKHNldHRpbmcpID0+IHtcbiAgICAgICAgICAgIGlmIChyZW5kZXIuaGFzT3duUHJvcGVydHkoc2V0dGluZykpIHtcbiAgICAgICAgICAgICAgICB0aGlzW3NldHRpbmddID0gcmVuZGVyW3NldHRpbmddO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuICAgIH1cblxuICAgIC8vIGdldCB0aGUgYWN0dWFsIHRleHR1cmUgdG8gdXNlIGZvciBza3lib3ggcmVuZGVyaW5nXG4gICAgX2dldFNreWJveFRleCgpIHtcbiAgICAgICAgY29uc3QgY3ViZW1hcHMgPSB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzO1xuXG4gICAgICAgIGlmICh0aGlzLl9za3lib3hNaXApIHtcbiAgICAgICAgICAgIC8vIHNreWJveCBzZWxlY3Rpb24gZm9yIHNvbWUgcmVhc29uIGhhcyBhbHdheXMgc2tpcHBlZCB0aGUgMzJ4MzIgcHJlZmlsdGVyZWQgbWlwbWFwLCBwcmVzdW1hYmx5IGEgYnVnLlxuICAgICAgICAgICAgLy8gd2UgY2FuJ3Qgc2ltcGx5IGZpeCB0aGlzIGFuZCBtYXAgMyB0byB0aGUgY29ycmVjdCBsZXZlbCwgc2luY2UgZG9pbmcgc28gaGFzIHRoZSBwb3RlbnRpYWxcbiAgICAgICAgICAgIC8vIHRvIGNoYW5nZSB0aGUgbG9vayBvZiBleGlzdGluZyBzY2VuZXMgZHJhbWF0aWNhbGx5LlxuICAgICAgICAgICAgLy8gTk9URTogdGhlIHRhYmxlIHNraXBzIHRoZSAzMngzMiBtaXBtYXBcbiAgICAgICAgICAgIGNvbnN0IHNreWJveE1hcHBpbmcgPSBbMCwgMSwgLyogMiAqLyAzLCA0LCA1LCA2XTtcblxuICAgICAgICAgICAgLy8gc2VsZWN0IGJsdXJyeSB0ZXh0dXJlIGZvciB1c2Ugb24gdGhlIHNreWJveFxuICAgICAgICAgICAgcmV0dXJuIGN1YmVtYXBzW3NreWJveE1hcHBpbmdbdGhpcy5fc2t5Ym94TWlwXV0gfHwgdGhpcy5fZW52QXRsYXMgfHwgY3ViZW1hcHNbMF0gfHwgdGhpcy5fc2t5Ym94Q3ViZU1hcDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9za3lib3hDdWJlTWFwIHx8IGN1YmVtYXBzWzBdIHx8IHRoaXMuX2VudkF0bGFzO1xuICAgIH1cblxuICAgIF91cGRhdGVTa3koZGV2aWNlKSB7XG4gICAgICAgIGlmICghdGhpcy5za3kpIHtcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLl9nZXRTa3lib3hUZXgoKTtcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5za3kgPSBuZXcgU2t5KGRldmljZSwgdGhpcywgdGV4dHVyZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdzZXQ6c2t5Ym94JywgdGV4dHVyZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVzZXRTa3koKSB7XG4gICAgICAgIHRoaXMuc2t5Py5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2t5ID0gbnVsbDtcbiAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBjdWJlbWFwIGZvciB0aGUgc2NlbmUgc2t5Ym94LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlW119IFtjdWJlbWFwc10gLSBBbiBhcnJheSBvZlxuICAgICAqIGN1YmVtYXBzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNreWJveCBhdCBkaWZmZXJlbnQgbWlwIGxldmVscy4gSWYgdW5kZWZpbmVkLCBzY2VuZSB3aWxsXG4gICAgICogcmVtb3ZlIHNreWJveC4gQ3ViZW1hcCBhcnJheSBzaG91bGQgYmUgb2Ygc2l6ZSA3LCB3aXRoIHRoZSBmaXJzdCBlbGVtZW50IChpbmRleCAwKVxuICAgICAqIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGJhc2UgY3ViZW1hcCAobWlwIGxldmVsIDApIHdpdGggb3JpZ2luYWwgcmVzb2x1dGlvbi4gRWFjaCByZW1haW5pbmdcbiAgICAgKiBlbGVtZW50IChpbmRleCAxLTYpIGNvcnJlc3BvbmRzIHRvIGEgZml4ZWQgcHJlZmlsdGVyZWQgcmVzb2x1dGlvbiAoMTI4eDEyOCwgNjR4NjQsIDMyeDMyLFxuICAgICAqIDE2eDE2LCA4eDgsIDR4NCkuXG4gICAgICovXG4gICAgc2V0U2t5Ym94KGN1YmVtYXBzKSB7XG4gICAgICAgIGlmICghY3ViZW1hcHMpIHtcbiAgICAgICAgICAgIHRoaXMuc2t5Ym94ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMucHJlZmlsdGVyZWRDdWJlbWFwcyA9IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2t5Ym94ID0gY3ViZW1hcHNbMF0gfHwgbnVsbDtcbiAgICAgICAgICAgIHRoaXMucHJlZmlsdGVyZWRDdWJlbWFwcyA9IGN1YmVtYXBzLnNsaWNlKDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBsaWdodG1hcCBwaXhlbCBmb3JtYXQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfSBUaGUgcGl4ZWwgZm9ybWF0LlxuICAgICAqL1xuICAgIGdldCBsaWdodG1hcFBpeGVsRm9ybWF0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5saWdodG1hcEhEUiAmJiB0aGlzLmRldmljZS5nZXRIZHJGb3JtYXQoZmFsc2UsIHRydWUsIGZhbHNlLCB0cnVlKSB8fCBQSVhFTEZPUk1BVF9SR0JBODtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNjZW5lIH07XG4iXSwibmFtZXMiOlsiU2NlbmUiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwiYW1iaWVudEJha2UiLCJhbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MiLCJhbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0IiwiYW1iaWVudExpZ2h0IiwiQ29sb3IiLCJhbWJpZW50THVtaW5hbmNlIiwiZXhwb3N1cmUiLCJmb2dDb2xvciIsImZvZ0RlbnNpdHkiLCJmb2dFbmQiLCJmb2dTdGFydCIsImxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJsaWdodG1hcE1heFJlc29sdXRpb24iLCJsaWdodG1hcE1vZGUiLCJCQUtFX0NPTE9SRElSIiwibGlnaHRtYXBGaWx0ZXJFbmFibGVkIiwibGlnaHRtYXBIRFIiLCJyb290Iiwic2t5IiwicGh5c2ljYWxVbml0cyIsIkRlYnVnIiwiYXNzZXJ0RGVwcmVjYXRlZCIsImRldmljZSIsIkdyYXBoaWNzRGV2aWNlQWNjZXNzIiwiZ2V0IiwiX2dyYXZpdHkiLCJWZWMzIiwiX2xheWVycyIsIl9mb2ciLCJGT0dfTk9ORSIsIl9nYW1tYUNvcnJlY3Rpb24iLCJHQU1NQV9TUkdCIiwiX3RvbmVNYXBwaW5nIiwiX3NreWJveEN1YmVNYXAiLCJfcHJlZmlsdGVyZWRDdWJlbWFwcyIsIl9lbnZBdGxhcyIsIl9pbnRlcm5hbEVudkF0bGFzIiwiX3NreWJveEludGVuc2l0eSIsIl9za3lib3hMdW1pbmFuY2UiLCJfc2t5Ym94TWlwIiwiX3NreWJveFJvdGF0aW9uIiwiUXVhdCIsIl9za3lib3hSb3RhdGlvbk1hdDMiLCJNYXQzIiwiX3NreWJveFJvdGF0aW9uTWF0NCIsIk1hdDQiLCJfYW1iaWVudEJha2VOdW1TYW1wbGVzIiwiX2FtYmllbnRCYWtlU3BoZXJlUGFydCIsIl9saWdodG1hcEZpbHRlclJhbmdlIiwiX2xpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyIsIl9jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJfbGlnaHRpbmdQYXJhbXMiLCJMaWdodGluZ1BhcmFtcyIsInN1cHBvcnRzQXJlYUxpZ2h0cyIsIm1heFRleHR1cmVTaXplIiwiX2RpcnR5TGlnaHRzIiwiX3N0YXRzIiwibWVzaEluc3RhbmNlcyIsImxpZ2h0cyIsImR5bmFtaWNMaWdodHMiLCJiYWtlZExpZ2h0cyIsImxhc3RTdGF0aWNQcmVwYXJlRnVsbFRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZVNlYXJjaFRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZVdyaXRlVGltZSIsImxhc3RTdGF0aWNQcmVwYXJlVHJpQWFiYlRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZUNvbWJpbmVUaW1lIiwidXBkYXRlU2hhZGVyc1RpbWUiLCJ1cGRhdGVTaGFkZXJzIiwiX3NoYWRlclZlcnNpb24iLCJfc3RhdHNVcGRhdGVkIiwiaW1tZWRpYXRlIiwiSW1tZWRpYXRlIiwiZGVmYXVsdERyYXdMYXllciIsImxheWVycyIsImdldExheWVyQnlJZCIsIkxBWUVSSURfSU1NRURJQVRFIiwiYW1iaWVudEJha2VOdW1TYW1wbGVzIiwidmFsdWUiLCJtYXRoIiwiY2xhbXAiLCJNYXRoIiwiZmxvb3IiLCJhbWJpZW50QmFrZVNwaGVyZVBhcnQiLCJjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQiLCJjb25zb2xlIiwiZXJyb3IiLCJkcmF3Q2FsbHMiLCJfbWVzaEluc3RhbmNlcyIsImxlbmd0aCIsIl91cGRhdGUiLCJlbnZBdGxhcyIsImFkZHJlc3NVIiwiQUREUkVTU19SRVBFQVQiLCJhZGRyZXNzViIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIm1pbkZpbHRlciIsIkZJTFRFUl9MSU5FQVIiLCJtYWdGaWx0ZXIiLCJtaXBtYXBzIiwiZm9nIiwidHlwZSIsImdhbW1hQ29ycmVjdGlvbiIsInByZXYiLCJmaXJlIiwibGlnaHRpbmciLCJsaWdodG1hcEZpbHRlclJhbmdlIiwibWF4IiwibGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzIiwicHJlZmlsdGVyZWRDdWJlbWFwcyIsImN1YmVtYXBzIiwiY2hhbmdlZCIsImNvbXBsZXRlIiwiaSIsInYiLCJfcmVzZXRTa3kiLCJFbnZMaWdodGluZyIsImdlbmVyYXRlUHJlZmlsdGVyZWRBdGxhcyIsInRhcmdldCIsImRlc3Ryb3kiLCJza3lib3giLCJza3lib3hJbnRlbnNpdHkiLCJza3lib3hMdW1pbmFuY2UiLCJza3lib3hNaXAiLCJza3lib3hSb3RhdGlvbiIsImVxdWFscyIsImNvcHkiLCJJREVOVElUWSIsInNldElkZW50aXR5Iiwic2V0VFJTIiwiWkVSTyIsIk9ORSIsImludmVydFRvM3gzIiwidG9uZU1hcHBpbmciLCJvZmYiLCJkcmF3TGluZSIsInN0YXJ0IiwiZW5kIiwiY29sb3IiLCJXSElURSIsImRlcHRoVGVzdCIsImxheWVyIiwiYmF0Y2giLCJnZXRCYXRjaCIsImFkZExpbmVzIiwiZHJhd0xpbmVzIiwicG9zaXRpb25zIiwiY29sb3JzIiwiZHJhd0xpbmVBcnJheXMiLCJhZGRMaW5lc0FycmF5cyIsImFwcGx5U2V0dGluZ3MiLCJzZXR0aW5ncyIsInBoeXNpY3MiLCJyZW5kZXIiLCJzZXQiLCJncmF2aXR5IiwiZ2xvYmFsX2FtYmllbnQiLCJmb2dfY29sb3IiLCJmb2dfc3RhcnQiLCJmb2dfZW5kIiwiZm9nX2RlbnNpdHkiLCJnYW1tYV9jb3JyZWN0aW9uIiwidG9uZW1hcHBpbmciLCJ1bmRlZmluZWQiLCJzZXRGcm9tRXVsZXJBbmdsZXMiLCJmb3JFYWNoIiwic2V0dGluZyIsImhhc093blByb3BlcnR5IiwiX2dldFNreWJveFRleCIsInNreWJveE1hcHBpbmciLCJfdXBkYXRlU2t5IiwidGV4dHVyZSIsIlNreSIsInNldFNreWJveCIsInNsaWNlIiwibGlnaHRtYXBQaXhlbEZvcm1hdCIsImdldEhkckZvcm1hdCIsIlBJWEVMRk9STUFUX1JHQkE4Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsS0FBSyxTQUFTQyxZQUFZLENBQUM7QUFDN0I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FB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
