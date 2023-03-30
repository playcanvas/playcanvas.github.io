/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
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
    var _render$skyboxIntensi, _render$skyboxLuminan, _render$skyboxMip;
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
    this._skyboxIntensity = (_render$skyboxIntensi = render.skyboxIntensity) != null ? _render$skyboxIntensi : 1;
    this._skyboxLuminance = (_render$skyboxLuminan = render.skyboxLuminance) != null ? _render$skyboxLuminan : 20000;
    this._skyboxMip = (_render$skyboxMip = render.skyboxMip) != null ? _render$skyboxMip : 0;
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
   * The lightmap pixel format.
   *
   * @type {number}
   */
  get lightmapPixelFormat() {
    return this.lightmapHDR && this.device.getHdrFormat(false, true, false, true) || PIXELFORMAT_RGBA8;
  }
}

export { Scene };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9zY2VuZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IE1hdDMgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0My5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdDQuanMnO1xuXG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgUElYRUxGT1JNQVRfUkdCQTgsIEFERFJFU1NfUkVQRUFULCBBRERSRVNTX0NMQU1QX1RPX0VER0UsIEZJTFRFUl9MSU5FQVIgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBCQUtFX0NPTE9SRElSLCBGT0dfTk9ORSwgR0FNTUFfU1JHQiwgTEFZRVJJRF9JTU1FRElBVEUgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBTa3kgfSBmcm9tICcuL3NreS5qcyc7XG5pbXBvcnQgeyBMaWdodGluZ1BhcmFtcyB9IGZyb20gJy4vbGlnaHRpbmcvbGlnaHRpbmctcGFyYW1zLmpzJztcbmltcG9ydCB7IEltbWVkaWF0ZSB9IGZyb20gJy4vaW1tZWRpYXRlL2ltbWVkaWF0ZS5qcyc7XG5pbXBvcnQgeyBFbnZMaWdodGluZyB9IGZyb20gJy4vZ3JhcGhpY3MvZW52LWxpZ2h0aW5nLmpzJztcblxuLyoqXG4gKiBBIHNjZW5lIGlzIGdyYXBoaWNhbCByZXByZXNlbnRhdGlvbiBvZiBhbiBlbnZpcm9ubWVudC4gSXQgbWFuYWdlcyB0aGUgc2NlbmUgaGllcmFyY2h5LCBhbGxcbiAqIGdyYXBoaWNhbCBvYmplY3RzLCBsaWdodHMsIGFuZCBzY2VuZS13aWRlIHByb3BlcnRpZXMuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICovXG5jbGFzcyBTY2VuZSBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogSWYgZW5hYmxlZCwgdGhlIGFtYmllbnQgbGlnaHRpbmcgd2lsbCBiZSBiYWtlZCBpbnRvIGxpZ2h0bWFwcy4gVGhpcyB3aWxsIGJlIGVpdGhlciB0aGVcbiAgICAgKiB7QGxpbmsgU2NlbmUjc2t5Ym94fSBpZiBzZXQgdXAsIG90aGVyd2lzZSB7QGxpbmsgU2NlbmUjYW1iaWVudExpZ2h0fS4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBhbWJpZW50QmFrZSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSWYge0BsaW5rIFNjZW5lI2FtYmllbnRCYWtlfSBpcyB0cnVlLCB0aGlzIHNwZWNpZmllcyB0aGUgYnJpZ2h0bmVzcyBvZiBhbWJpZW50IG9jY2x1c2lvbi5cbiAgICAgKiBUeXBpY2FsIHJhbmdlIGlzIC0xIHRvIDEuIERlZmF1bHRzIHRvIDAsIHJlcHJlc2VudGluZyBubyBjaGFuZ2UgdG8gYnJpZ2h0bmVzcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzID0gMDtcblxuICAgICAvKipcbiAgICAgICogSWYge0BsaW5rIFNjZW5lI2FtYmllbnRCYWtlfSBpcyB0cnVlLCB0aGlzIHNwZWNpZmllcyB0aGUgY29udHJhc3Qgb2YgYW1iaWVudCBvY2NsdXNpb24uXG4gICAgICAqIFR5cGljYWwgcmFuZ2UgaXMgLTEgdG8gMS4gRGVmYXVsdHMgdG8gMCwgcmVwcmVzZW50aW5nIG5vIGNoYW5nZSB0byBjb250cmFzdC5cbiAgICAgICpcbiAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICovXG4gICAgYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdCA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sb3Igb2YgdGhlIHNjZW5lJ3MgYW1iaWVudCBsaWdodC4gRGVmYXVsdHMgdG8gYmxhY2sgKDAsIDAsIDApLlxuICAgICAqXG4gICAgICogQHR5cGUge0NvbG9yfVxuICAgICAqL1xuICAgIGFtYmllbnRMaWdodCA9IG5ldyBDb2xvcigwLCAwLCAwKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBsdW1pbm9zaXR5IG9mIHRoZSBzY2VuZSdzIGFtYmllbnQgbGlnaHQgaW4gbHV4IChsbS9tXjIpLiBVc2VkIGlmIHBoeXNpY2FsVW5pdHMgaXMgdHJ1ZS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgYW1iaWVudEx1bWluYW5jZSA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZXhwb3N1cmUgdmFsdWUgdHdlYWtzIHRoZSBvdmVyYWxsIGJyaWdodG5lc3Mgb2YgdGhlIHNjZW5lLiBJZ25vcmVkIGlmIHBoeXNpY2FsVW5pdHMgaXMgdHJ1ZS4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZXhwb3N1cmUgPSAxO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbG9yIG9mIHRoZSBmb2cgKGlmIGVuYWJsZWQpLiBEZWZhdWx0cyB0byBibGFjayAoMCwgMCwgMCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Q29sb3J9XG4gICAgICovXG4gICAgZm9nQ29sb3IgPSBuZXcgQ29sb3IoMCwgMCwgMCk7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGVuc2l0eSBvZiB0aGUgZm9nIChpZiBlbmFibGVkKS4gVGhpcyBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0XG4gICAgICogdG8ge0BsaW5rIEZPR19FWFB9IG9yIHtAbGluayBGT0dfRVhQMn0uIERlZmF1bHRzIHRvIDAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGZvZ0RlbnNpdHkgPSAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCB3aGVyZSBsaW5lYXIgZm9nIHJlYWNoZXMgaXRzIG1heGltdW0uIFRoaXMgcHJvcGVydHkgaXMgb25seVxuICAgICAqIHZhbGlkIGlmIHRoZSBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfTElORUFSfS4gRGVmYXVsdHMgdG8gMTAwMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZm9nRW5kID0gMTAwMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBkaXN0YW5jZSBmcm9tIHRoZSB2aWV3cG9pbnQgd2hlcmUgbGluZWFyIGZvZyBiZWdpbnMuIFRoaXMgcHJvcGVydHkgaXMgb25seSB2YWxpZCBpZiB0aGVcbiAgICAgKiBmb2cgcHJvcGVydHkgaXMgc2V0IHRvIHtAbGluayBGT0dfTElORUFSfS4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZm9nU3RhcnQgPSAxO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGxpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci4gRGVmYXVsdHMgdG8gMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF4aW11bSBsaWdodG1hcCByZXNvbHV0aW9uLiBEZWZhdWx0cyB0byAyMDQ4LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBsaWdodG1hcE1heFJlc29sdXRpb24gPSAyMDQ4O1xuXG4gICAgLyoqXG4gICAgICogVGhlIGxpZ2h0bWFwIGJha2luZyBtb2RlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwXG4gICAgICogLSB7QGxpbmsgQkFLRV9DT0xPUkRJUn06IHNpbmdsZSBjb2xvciBsaWdodG1hcCArIGRvbWluYW50IGxpZ2h0IGRpcmVjdGlvbiAodXNlZCBmb3IgYnVtcCBvclxuICAgICAqIHNwZWN1bGFyKS4gT25seSBsaWdodHMgd2l0aCBiYWtlRGlyPXRydWUgd2lsbCBiZSB1c2VkIGZvciBnZW5lcmF0aW5nIHRoZSBkb21pbmFudCBsaWdodFxuICAgICAqIGRpcmVjdGlvbi5cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBCQUtFX0NPTE9SRElSfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgbGlnaHRtYXBNb2RlID0gQkFLRV9DT0xPUkRJUjtcblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgYmlsYXRlcmFsIGZpbHRlciBvbiBydW50aW1lIGJha2VkIGNvbG9yIGxpZ2h0bWFwcywgd2hpY2ggcmVtb3ZlcyB0aGUgbm9pc2UgYW5kXG4gICAgICogYmFuZGluZyB3aGlsZSBwcmVzZXJ2aW5nIHRoZSBlZGdlcy4gRGVmYXVsdHMgdG8gZmFsc2UuIE5vdGUgdGhhdCB0aGUgZmlsdGVyaW5nIHRha2VzIHBsYWNlXG4gICAgICogaW4gdGhlIGltYWdlIHNwYWNlIG9mIHRoZSBsaWdodG1hcCwgYW5kIGl0IGRvZXMgbm90IGZpbHRlciBhY3Jvc3MgbGlnaHRtYXAgVVYgc3BhY2Ugc2VhbXMsXG4gICAgICogb2Z0ZW4gbWFraW5nIHRoZSBzZWFtcyBtb3JlIHZpc2libGUuIEl0J3MgaW1wb3J0YW50IHRvIGJhbGFuY2UgdGhlIHN0cmVuZ3RoIG9mIHRoZSBmaWx0ZXJcbiAgICAgKiB3aXRoIG51bWJlciBvZiBzYW1wbGVzIHVzZWQgZm9yIGxpZ2h0bWFwIGJha2luZyB0byBsaW1pdCB0aGUgdmlzaWJsZSBhcnRpZmFjdHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBsaWdodG1hcEZpbHRlckVuYWJsZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgSERSIGxpZ2h0bWFwcy4gVGhpcyBjYW4gcmVzdWx0IGluIHNtb290aGVyIGxpZ2h0bWFwcyBlc3BlY2lhbGx5IHdoZW4gbWFueSBzYW1wbGVzXG4gICAgICogYXJlIHVzZWQuIERlZmF1bHRzIHRvIGZhbHNlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgbGlnaHRtYXBIRFIgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIFRoZSByb290IGVudGl0eSBvZiB0aGUgc2NlbmUsIHdoaWNoIGlzIHVzdWFsbHkgdGhlIG9ubHkgY2hpbGQgdG8gdGhlIHtAbGluayBBcHBsaWNhdGlvbn1cbiAgICAgKiByb290IGVudGl0eS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9lbnRpdHkuanMnKS5FbnRpdHl9XG4gICAgICovXG4gICAgcm9vdCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgc2t5IG9mIHRoZSBzY2VuZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTa3l9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIHNreSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBVc2UgcGh5c2ljYWxseSBiYXNlZCB1bml0cyBmb3IgY2FtZXJhcyBhbmQgbGlnaHRzLiBXaGVuIHVzZWQsIHRoZSBleHBvc3VyZSB2YWx1ZSBpcyBpZ25vcmVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgcGh5c2ljYWxVbml0cyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjZW5lIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBncmFwaGljc0RldmljZSAtXG4gICAgICogVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIHRvIG1hbmFnZSB0aGlzIHNjZW5lLlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIERlYnVnLmFzc2VydERlcHJlY2F0ZWQoZ3JhcGhpY3NEZXZpY2UsIFwiU2NlbmUgY29uc3RydWN0b3IgdGFrZXMgYSBHcmFwaGljc0RldmljZSBhcyBhIHBhcmFtZXRlciwgYW5kIGl0IHdhcyBub3QgcHJvdmlkZWQuXCIpO1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlIHx8IEdyYXBoaWNzRGV2aWNlQWNjZXNzLmdldCgpO1xuXG4gICAgICAgIHRoaXMuX2dyYXZpdHkgPSBuZXcgVmVjMygwLCAtOS44LCAwKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX2ZvZyA9IEZPR19OT05FO1xuXG4gICAgICAgIHRoaXMuX2dhbW1hQ29ycmVjdGlvbiA9IEdBTU1BX1NSR0I7XG4gICAgICAgIHRoaXMuX3RvbmVNYXBwaW5nID0gMDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHNreWJveCBjdWJlbWFwIGFzIHNldCBieSB1c2VyIChnZXRzIHVzZWQgd2hlbiBza3lib3hNaXAgPT09IDApXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fc2t5Ym94Q3ViZU1hcCA9IG51bGw7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IG9mIDYgcHJlZmlsdGVyZWQgbGlnaHRpbmcgZGF0YSBjdWJlbWFwcy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmVbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHMgPSBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEVudmlyb25tZW50IGxpZ2h0aW5nIGF0bGFzXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZW52QXRsYXMgPSBudWxsO1xuXG4gICAgICAgIC8vIGludGVybmFsbHkgZ2VuZXJhdGVkIGVudkF0bGFzIG93bmVkIGJ5IHRoZSBzY2VuZVxuICAgICAgICB0aGlzLl9pbnRlcm5hbEVudkF0bGFzID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9za3lib3hJbnRlbnNpdHkgPSAxO1xuICAgICAgICB0aGlzLl9za3lib3hMdW1pbmFuY2UgPSAwO1xuICAgICAgICB0aGlzLl9za3lib3hNaXAgPSAwO1xuXG4gICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uID0gbmV3IFF1YXQoKTtcbiAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb25NYXQzID0gbmV3IE1hdDMoKTtcbiAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb25NYXQ0ID0gbmV3IE1hdDQoKTtcblxuICAgICAgICAvLyBhbWJpZW50IGxpZ2h0IGxpZ2h0bWFwcGluZyBwcm9wZXJ0aWVzXG4gICAgICAgIHRoaXMuX2FtYmllbnRCYWtlTnVtU2FtcGxlcyA9IDE7XG4gICAgICAgIHRoaXMuX2FtYmllbnRCYWtlU3BoZXJlUGFydCA9IDAuNDtcblxuICAgICAgICB0aGlzLl9saWdodG1hcEZpbHRlclJhbmdlID0gMTA7XG4gICAgICAgIHRoaXMuX2xpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyA9IDAuMjtcblxuICAgICAgICAvLyBjbHVzdGVyZWQgbGlnaHRpbmdcbiAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fbGlnaHRpbmdQYXJhbXMgPSBuZXcgTGlnaHRpbmdQYXJhbXModGhpcy5kZXZpY2Uuc3VwcG9ydHNBcmVhTGlnaHRzLCB0aGlzLmRldmljZS5tYXhUZXh0dXJlU2l6ZSwgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fbGF5ZXJzLl9kaXJ0eUxpZ2h0cyA9IHRydWU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX3N0YXRzID0ge1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlczogMCxcbiAgICAgICAgICAgIGxpZ2h0czogMCxcbiAgICAgICAgICAgIGR5bmFtaWNMaWdodHM6IDAsXG4gICAgICAgICAgICBiYWtlZExpZ2h0czogMCxcbiAgICAgICAgICAgIGxhc3RTdGF0aWNQcmVwYXJlRnVsbFRpbWU6IDAsXG4gICAgICAgICAgICBsYXN0U3RhdGljUHJlcGFyZVNlYXJjaFRpbWU6IDAsXG4gICAgICAgICAgICBsYXN0U3RhdGljUHJlcGFyZVdyaXRlVGltZTogMCxcbiAgICAgICAgICAgIGxhc3RTdGF0aWNQcmVwYXJlVHJpQWFiYlRpbWU6IDAsXG4gICAgICAgICAgICBsYXN0U3RhdGljUHJlcGFyZUNvbWJpbmVUaW1lOiAwLFxuICAgICAgICAgICAgdXBkYXRlU2hhZGVyc1RpbWU6IDAgLy8gZGVwcmVjYXRlZFxuICAgICAgICB9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGlzIGZsYWcgaW5kaWNhdGVzIGNoYW5nZXMgd2VyZSBtYWRlIHRvIHRoZSBzY2VuZSB3aGljaCBtYXkgcmVxdWlyZSByZWNvbXBpbGF0aW9uIG9mXG4gICAgICAgICAqIHNoYWRlcnMgdGhhdCByZWZlcmVuY2UgZ2xvYmFsIHNldHRpbmdzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgICAgICogQGlnbm9yZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl9zaGFkZXJWZXJzaW9uID0gMDtcbiAgICAgICAgdGhpcy5fc3RhdHNVcGRhdGVkID0gZmFsc2U7XG5cbiAgICAgICAgLy8gaW1tZWRpYXRlIHJlbmRlcmluZ1xuICAgICAgICB0aGlzLmltbWVkaWF0ZSA9IG5ldyBJbW1lZGlhdGUodGhpcy5kZXZpY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIHNreWJveCBpcyBzZXQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NlbmUjc2V0OnNreWJveFxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX0gdXNlZFRleCAtIFByZXZpb3VzbHkgdXNlZCBjdWJlbWFwXG4gICAgICogdGV4dHVyZS4gTmV3IGlzIGluIHRoZSB7QGxpbmsgU2NlbmUjc2t5Ym94fS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4gdGhlIGxheWVyIGNvbXBvc2l0aW9uIGlzIHNldC4gVXNlIHRoaXMgZXZlbnQgdG8gYWRkIGNhbGxiYWNrcyBvciBhZHZhbmNlZFxuICAgICAqIHByb3BlcnRpZXMgdG8geW91ciBsYXllcnMuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgU2NlbmUjc2V0OmxheWVyc1xuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gb2xkQ29tcCAtIFByZXZpb3VzbHlcbiAgICAgKiB1c2VkIHtAbGluayBMYXllckNvbXBvc2l0aW9ufS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IG5ld0NvbXAgLSBOZXdseSBzZXRcbiAgICAgKiB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0uXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB0aGlzLmFwcC5zY2VuZS5vbignc2V0OmxheWVycycsIGZ1bmN0aW9uIChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICogICAgIHZhciBsaXN0ID0gbmV3Q29tcC5sYXllckxpc3Q7XG4gICAgICogICAgIHZhciBsYXllcjtcbiAgICAgKiAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICogICAgICAgICBsYXllciA9IGxpc3RbaV07XG4gICAgICogICAgICAgICBzd2l0Y2ggKGxheWVyLm5hbWUpIHtcbiAgICAgKiAgICAgICAgICAgICBjYXNlICdNeUxheWVyJzpcbiAgICAgKiAgICAgICAgICAgICAgICAgbGF5ZXIub25FbmFibGUgPSBteU9uRW5hYmxlRnVuY3Rpb247XG4gICAgICogICAgICAgICAgICAgICAgIGxheWVyLm9uRGlzYWJsZSA9IG15T25EaXNhYmxlRnVuY3Rpb247XG4gICAgICogICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgICAgIGNhc2UgJ015T3RoZXJMYXllcic6XG4gICAgICogICAgICAgICAgICAgICAgIGxheWVyLnNoYWRlclBhc3MgPSBteVNoYWRlclBhc3M7XG4gICAgICogICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAqICAgICAgICAgfVxuICAgICAqICAgICB9XG4gICAgICogfSk7XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBkZWZhdWx0IGxheWVyIHVzZWQgYnkgdGhlIGltbWVkaWF0ZSBkcmF3aW5nIGZ1bmN0aW9ucy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbGF5ZXIuanMnKS5MYXllcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGdldCBkZWZhdWx0RHJhd0xheWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5sYXllcnMuZ2V0TGF5ZXJCeUlkKExBWUVSSURfSU1NRURJQVRFKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB7QGxpbmsgU2NlbmUjYW1iaWVudEJha2V9IGlzIHRydWUsIHRoaXMgc3BlY2lmaWVzIHRoZSBudW1iZXIgb2Ygc2FtcGxlcyB1c2VkIHRvIGJha2UgdGhlXG4gICAgICogYW1iaWVudCBsaWdodCBpbnRvIHRoZSBsaWdodG1hcC4gRGVmYXVsdHMgdG8gMS4gTWF4aW11bSB2YWx1ZSBpcyAyNTUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhbWJpZW50QmFrZU51bVNhbXBsZXModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fYW1iaWVudEJha2VOdW1TYW1wbGVzID0gbWF0aC5jbGFtcChNYXRoLmZsb29yKHZhbHVlKSwgMSwgMjU1KTtcbiAgICB9XG5cbiAgICBnZXQgYW1iaWVudEJha2VOdW1TYW1wbGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW1iaWVudEJha2VOdW1TYW1wbGVzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHtAbGluayBTY2VuZSNhbWJpZW50QmFrZX0gaXMgdHJ1ZSwgdGhpcyBzcGVjaWZpZXMgYSBwYXJ0IG9mIHRoZSBzcGhlcmUgd2hpY2ggcmVwcmVzZW50c1xuICAgICAqIHRoZSBzb3VyY2Ugb2YgYW1iaWVudCBsaWdodC4gVGhlIHZhbGlkIHJhbmdlIGlzIDAuLjEsIHJlcHJlc2VudGluZyBhIHBhcnQgb2YgdGhlIHNwaGVyZSBmcm9tXG4gICAgICogdG9wIHRvIHRoZSBib3R0b20uIEEgdmFsdWUgb2YgMC41IHJlcHJlc2VudHMgdGhlIHVwcGVyIGhlbWlzcGhlcmUuIEEgdmFsdWUgb2YgMSByZXByZXNlbnRzIGFcbiAgICAgKiBmdWxsIHNwaGVyZS4gRGVmYXVsdHMgdG8gMC40LCB3aGljaCBpcyBhIHNtYWxsZXIgdXBwZXIgaGVtaXNwaGVyZSBhcyB0aGlzIHJlcXVpcmVzIGZld2VyXG4gICAgICogc2FtcGxlcyB0byBiYWtlLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYW1iaWVudEJha2VTcGhlcmVQYXJ0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FtYmllbnRCYWtlU3BoZXJlUGFydCA9IG1hdGguY2xhbXAodmFsdWUsIDAuMDAxLCAxKTtcbiAgICB9XG5cbiAgICBnZXQgYW1iaWVudEJha2VTcGhlcmVQYXJ0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYW1iaWVudEJha2VTcGhlcmVQYXJ0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRydWUgaWYgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBlbmFibGVkLiBTZXQgdG8gZmFsc2UgYmVmb3JlIHRoZSBmaXJzdCBmcmFtZSBpcyByZW5kZXJlZFxuICAgICAqIHRvIHVzZSBub24tY2x1c3RlcmVkIGxpZ2h0aW5nLiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCh2YWx1ZSkge1xuXG4gICAgICAgIGlmICghdGhpcy5fY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkICYmIHZhbHVlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdUdXJuaW5nIG9uIGRpc2FibGVkIGNsdXN0ZXJlZCBsaWdodGluZyBpcyBub3QgY3VycmVudGx5IHN1cHBvcnRlZCcpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaXN0IG9mIGFsbCBhY3RpdmUgY29tcG9zaXRpb24gbWVzaCBpbnN0YW5jZXMuIE9ubHkgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICAgICAqIFRPRE86IEJhdGNoTWFuYWdlciBpcyB1c2luZyBpdCAtIHBlcmhhcHMgdGhhdCBjb3VsZCBiZSByZWZhY3RvcmVkXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWVzaEluc3RhbmNlW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzZXQgZHJhd0NhbGxzKHZhbHVlKSB7XG4gICAgfVxuXG4gICAgZ2V0IGRyYXdDYWxscygpIHtcbiAgICAgICAgbGV0IGRyYXdDYWxscyA9IHRoaXMubGF5ZXJzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICBpZiAoIWRyYXdDYWxscy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMubGF5ZXJzLl91cGRhdGUodGhpcy5kZXZpY2UsIHRoaXMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKTtcbiAgICAgICAgICAgIGRyYXdDYWxscyA9IHRoaXMubGF5ZXJzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkcmF3Q2FsbHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGVudmlyb25tZW50IGxpZ2h0aW5nIGF0bGFzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9XG4gICAgICovXG4gICAgc2V0IGVudkF0bGFzKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fZW52QXRsYXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2VudkF0bGFzID0gdmFsdWU7XG5cbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSByZXF1aXJlZCBvcHRpb25zIGFyZSBzZXQgdXAgb24gdGhlIHRleHR1cmVcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHZhbHVlLmFkZHJlc3NVID0gQUREUkVTU19SRVBFQVQ7XG4gICAgICAgICAgICAgICAgdmFsdWUuYWRkcmVzc1YgPSBBRERSRVNTX0NMQU1QX1RPX0VER0U7XG4gICAgICAgICAgICAgICAgdmFsdWUubWluRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICB2YWx1ZS5tYWdGaWx0ZXIgPSBGSUxURVJfTElORUFSO1xuICAgICAgICAgICAgICAgIHZhbHVlLm1pcG1hcHMgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBlbnZBdGxhcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2VudkF0bGFzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIGZvZyB1c2VkIGJ5IHRoZSBzY2VuZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgRk9HX05PTkV9XG4gICAgICogLSB7QGxpbmsgRk9HX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBGT0dfRVhQfVxuICAgICAqIC0ge0BsaW5rIEZPR19FWFAyfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEZPR19OT05FfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IGZvZyh0eXBlKSB7XG4gICAgICAgIGlmICh0eXBlICE9PSB0aGlzLl9mb2cpIHtcbiAgICAgICAgICAgIHRoaXMuX2ZvZyA9IHR5cGU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGZvZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2ZvZztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZ2FtbWEgY29ycmVjdGlvbiB0byBhcHBseSB3aGVuIHJlbmRlcmluZyB0aGUgc2NlbmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEdBTU1BX05PTkV9XG4gICAgICogLSB7QGxpbmsgR0FNTUFfU1JHQn1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBHQU1NQV9TUkdCfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGdhbW1hQ29ycmVjdGlvbih2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2dhbW1hQ29ycmVjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fZ2FtbWFDb3JyZWN0aW9uID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGdhbW1hQ29ycmVjdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dhbW1hQ29ycmVjdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHtAbGluayBMYXllckNvbXBvc2l0aW9ufSB0aGF0IGRlZmluZXMgcmVuZGVyaW5nIG9yZGVyIG9mIHRoaXMgc2NlbmUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn1cbiAgICAgKi9cbiAgICBzZXQgbGF5ZXJzKGxheWVycykge1xuICAgICAgICBjb25zdCBwcmV2ID0gdGhpcy5fbGF5ZXJzO1xuICAgICAgICB0aGlzLl9sYXllcnMgPSBsYXllcnM7XG4gICAgICAgIHRoaXMuZmlyZSgnc2V0OmxheWVycycsIHByZXYsIGxheWVycyk7XG4gICAgfVxuXG4gICAgZ2V0IGxheWVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVycztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHtAbGluayBMaWdodGluZ1BhcmFtc30gdGhhdCBkZWZpbmVzIGxpZ2h0aW5nIHBhcmFtZXRlcnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TGlnaHRpbmdQYXJhbXN9XG4gICAgICovXG4gICAgZ2V0IGxpZ2h0aW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRpbmdQYXJhbXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSByYW5nZSBwYXJhbWV0ZXIgb2YgdGhlIGJpbGF0ZXJhbCBmaWx0ZXIuIEl0J3MgdXNlZCB3aGVuIHtAbGluayBTY2VuZSNsaWdodG1hcEZpbHRlckVuYWJsZWR9XG4gICAgICogaXMgZW5hYmxlZC4gTGFyZ2VyIHZhbHVlIGFwcGxpZXMgbW9yZSB3aWRlc3ByZWFkIGJsdXIuIFRoaXMgbmVlZHMgdG8gYmUgYSBwb3NpdGl2ZSBub24temVyb1xuICAgICAqIHZhbHVlLiBEZWZhdWx0cyB0byAxMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpZ2h0bWFwRmlsdGVyUmFuZ2UodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBGaWx0ZXJSYW5nZSA9IE1hdGgubWF4KHZhbHVlLCAwLjAwMSk7XG4gICAgfVxuXG4gICAgZ2V0IGxpZ2h0bWFwRmlsdGVyUmFuZ2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcEZpbHRlclJhbmdlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgc3BhdGlhbCBwYXJhbWV0ZXIgb2YgdGhlIGJpbGF0ZXJhbCBmaWx0ZXIuIEl0J3MgdXNlZCB3aGVuIHtAbGluayBTY2VuZSNsaWdodG1hcEZpbHRlckVuYWJsZWR9XG4gICAgICogaXMgZW5hYmxlZC4gTGFyZ2VyIHZhbHVlIGJsdXJzIGxlc3Mgc2ltaWxhciBjb2xvcnMuIFRoaXMgbmVlZHMgdG8gYmUgYSBwb3NpdGl2ZSBub24temVyb1xuICAgICAqIHZhbHVlLiBEZWZhdWx0cyB0byAwLjIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcEZpbHRlclNtb290aG5lc3ModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzID0gTWF0aC5tYXgodmFsdWUsIDAuMDAxKTtcbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBvZiA2IHByZWZpbHRlcmVkIGN1YmVtYXBzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmVbXX1cbiAgICAgKi9cbiAgICBzZXQgcHJlZmlsdGVyZWRDdWJlbWFwcyh2YWx1ZSkge1xuICAgICAgICBjb25zdCBjdWJlbWFwcyA9IHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHM7XG5cbiAgICAgICAgdmFsdWUgPSB2YWx1ZSB8fCBbXTtcblxuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuICAgICAgICBsZXQgY29tcGxldGUgPSB0cnVlO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgdiA9IHZhbHVlW2ldIHx8IG51bGw7XG4gICAgICAgICAgICBpZiAoY3ViZW1hcHNbaV0gIT09IHYpIHtcbiAgICAgICAgICAgICAgICBjdWJlbWFwc1tpXSA9IHY7XG4gICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb21wbGV0ZSA9IGNvbXBsZXRlICYmICghIWN1YmVtYXBzW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuXG4gICAgICAgICAgICBpZiAoY29tcGxldGUpIHtcbiAgICAgICAgICAgICAgICAvLyB1cGRhdGUgZW52IGF0bGFzXG4gICAgICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcyA9IEVudkxpZ2h0aW5nLmdlbmVyYXRlUHJlZmlsdGVyZWRBdGxhcyhjdWJlbWFwcywge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IHRoaXMuX2ludGVybmFsRW52QXRsYXNcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fZW52QXRsYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gdXNlciBoYXNuJ3Qgc2V0IGFuIGVudkF0bGFzIGFscmVhZHksIHNldCBpdCB0byB0aGUgaW50ZXJuYWwgb25lXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW52QXRsYXMgPSB0aGlzLl9pbnRlcm5hbEVudkF0bGFzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5faW50ZXJuYWxFbnZBdGxhcykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9lbnZBdGxhcyA9PT0gdGhpcy5faW50ZXJuYWxFbnZBdGxhcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudkF0bGFzID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcyA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcHJlZmlsdGVyZWRDdWJlbWFwcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGJhc2UgY3ViZW1hcCB0ZXh0dXJlIHVzZWQgYXMgdGhlIHNjZW5lJ3Mgc2t5Ym94LCBpZiBtaXAgbGV2ZWwgaXMgMC4gRGVmYXVsdHMgdG8gbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfVxuICAgICAqL1xuICAgIHNldCBza3lib3godmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9za3lib3hDdWJlTWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9za3lib3hDdWJlTWFwID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNreWJveCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NreWJveEN1YmVNYXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTXVsdGlwbGllciBmb3Igc2t5Ym94IGludGVuc2l0eS4gRGVmYXVsdHMgdG8gMS4gVW51c2VkIGlmIHBoeXNpY2FsIHVuaXRzIGFyZSB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc2t5Ym94SW50ZW5zaXR5KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fc2t5Ym94SW50ZW5zaXR5KSB7XG4gICAgICAgICAgICB0aGlzLl9za3lib3hJbnRlbnNpdHkgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0U2t5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2t5Ym94SW50ZW5zaXR5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2t5Ym94SW50ZW5zaXR5O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEx1bWluYW5jZSAoaW4gbG0vbV4yKSBvZiBza3lib3guIERlZmF1bHRzIHRvIDAuIE9ubHkgdXNlZCBpZiBwaHlzaWNhbCB1bml0cyBhcmUgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNreWJveEx1bWluYW5jZSh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX3NreWJveEx1bWluYW5jZSkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94THVtaW5hbmNlID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNreWJveEx1bWluYW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NreWJveEx1bWluYW5jZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWlwIGxldmVsIG9mIHRoZSBza3lib3ggdG8gYmUgZGlzcGxheWVkLiBPbmx5IHZhbGlkIGZvciBwcmVmaWx0ZXJlZCBjdWJlbWFwIHNreWJveGVzLlxuICAgICAqIERlZmF1bHRzIHRvIDAgKGJhc2UgbGV2ZWwpLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgc2t5Ym94TWlwKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fc2t5Ym94TWlwKSB7XG4gICAgICAgICAgICB0aGlzLl9za3lib3hNaXAgPSB2YWx1ZTtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0U2t5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2t5Ym94TWlwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2t5Ym94TWlwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSByb3RhdGlvbiBvZiB0aGUgc2t5Ym94IHRvIGJlIGRpc3BsYXllZC4gRGVmYXVsdHMgdG8ge0BsaW5rIFF1YXQuSURFTlRJVFl9LlxuICAgICAqXG4gICAgICogQHR5cGUge1F1YXR9XG4gICAgICovXG4gICAgc2V0IHNreWJveFJvdGF0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2t5Ym94Um90YXRpb24uZXF1YWxzKHZhbHVlKSkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb24uY29weSh2YWx1ZSk7XG4gICAgICAgICAgICBpZiAodmFsdWUuZXF1YWxzKFF1YXQuSURFTlRJVFkpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2t5Ym94Um90YXRpb25NYXQzLnNldElkZW50aXR5KCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uTWF0NC5zZXRUUlMoVmVjMy5aRVJPLCB2YWx1ZSwgVmVjMy5PTkUpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uTWF0NC5pbnZlcnRUbzN4Myh0aGlzLl9za3lib3hSb3RhdGlvbk1hdDMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fcmVzZXRTa3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBza3lib3hSb3RhdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NreWJveFJvdGF0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0b25lbWFwcGluZyB0cmFuc2Zvcm0gdG8gYXBwbHkgd2hlbiB3cml0aW5nIGZyYWdtZW50cyB0byB0aGUgZnJhbWUgYnVmZmVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0xJTkVBUn1cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0ZJTE1JQ31cbiAgICAgKiAtIHtAbGluayBUT05FTUFQX0hFSkx9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9BQ0VTfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFRPTkVNQVBfTElORUFSfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHRvbmVNYXBwaW5nKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fdG9uZU1hcHBpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuX3RvbmVNYXBwaW5nID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcnMgPSB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHRvbmVNYXBwaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdG9uZU1hcHBpbmc7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5fcmVzZXRTa3koKTtcbiAgICAgICAgdGhpcy5yb290ID0gbnVsbDtcbiAgICAgICAgdGhpcy5vZmYoKTtcbiAgICB9XG5cbiAgICBkcmF3TGluZShzdGFydCwgZW5kLCBjb2xvciA9IENvbG9yLldISVRFLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICBjb25zdCBiYXRjaCA9IHRoaXMuaW1tZWRpYXRlLmdldEJhdGNoKGxheWVyLCBkZXB0aFRlc3QpO1xuICAgICAgICBiYXRjaC5hZGRMaW5lcyhbc3RhcnQsIGVuZF0sIFtjb2xvciwgY29sb3JdKTtcbiAgICB9XG5cbiAgICBkcmF3TGluZXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoID0gdGhpcy5pbW1lZGlhdGUuZ2V0QmF0Y2gobGF5ZXIsIGRlcHRoVGVzdCk7XG4gICAgICAgIGJhdGNoLmFkZExpbmVzKHBvc2l0aW9ucywgY29sb3JzKTtcbiAgICB9XG5cbiAgICBkcmF3TGluZUFycmF5cyhwb3NpdGlvbnMsIGNvbG9ycywgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYmF0Y2ggPSB0aGlzLmltbWVkaWF0ZS5nZXRCYXRjaChsYXllciwgZGVwdGhUZXN0KTtcbiAgICAgICAgYmF0Y2guYWRkTGluZXNBcnJheXMocG9zaXRpb25zLCBjb2xvcnMpO1xuICAgIH1cblxuICAgIGFwcGx5U2V0dGluZ3Moc2V0dGluZ3MpIHtcbiAgICAgICAgY29uc3QgcGh5c2ljcyA9IHNldHRpbmdzLnBoeXNpY3M7XG4gICAgICAgIGNvbnN0IHJlbmRlciA9IHNldHRpbmdzLnJlbmRlcjtcblxuICAgICAgICAvLyBzZXR0aW5nc1xuICAgICAgICB0aGlzLl9ncmF2aXR5LnNldChwaHlzaWNzLmdyYXZpdHlbMF0sIHBoeXNpY3MuZ3Jhdml0eVsxXSwgcGh5c2ljcy5ncmF2aXR5WzJdKTtcbiAgICAgICAgdGhpcy5hbWJpZW50TGlnaHQuc2V0KHJlbmRlci5nbG9iYWxfYW1iaWVudFswXSwgcmVuZGVyLmdsb2JhbF9hbWJpZW50WzFdLCByZW5kZXIuZ2xvYmFsX2FtYmllbnRbMl0pO1xuICAgICAgICB0aGlzLmFtYmllbnRMdW1pbmFuY2UgPSByZW5kZXIuYW1iaWVudEx1bWluYW5jZTtcbiAgICAgICAgdGhpcy5fZm9nID0gcmVuZGVyLmZvZztcbiAgICAgICAgdGhpcy5mb2dDb2xvci5zZXQocmVuZGVyLmZvZ19jb2xvclswXSwgcmVuZGVyLmZvZ19jb2xvclsxXSwgcmVuZGVyLmZvZ19jb2xvclsyXSk7XG4gICAgICAgIHRoaXMuZm9nU3RhcnQgPSByZW5kZXIuZm9nX3N0YXJ0O1xuICAgICAgICB0aGlzLmZvZ0VuZCA9IHJlbmRlci5mb2dfZW5kO1xuICAgICAgICB0aGlzLmZvZ0RlbnNpdHkgPSByZW5kZXIuZm9nX2RlbnNpdHk7XG4gICAgICAgIHRoaXMuX2dhbW1hQ29ycmVjdGlvbiA9IHJlbmRlci5nYW1tYV9jb3JyZWN0aW9uO1xuICAgICAgICB0aGlzLl90b25lTWFwcGluZyA9IHJlbmRlci50b25lbWFwcGluZztcbiAgICAgICAgdGhpcy5saWdodG1hcFNpemVNdWx0aXBsaWVyID0gcmVuZGVyLmxpZ2h0bWFwU2l6ZU11bHRpcGxpZXI7XG4gICAgICAgIHRoaXMubGlnaHRtYXBNYXhSZXNvbHV0aW9uID0gcmVuZGVyLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbjtcbiAgICAgICAgdGhpcy5saWdodG1hcE1vZGUgPSByZW5kZXIubGlnaHRtYXBNb2RlO1xuICAgICAgICB0aGlzLmV4cG9zdXJlID0gcmVuZGVyLmV4cG9zdXJlO1xuICAgICAgICB0aGlzLl9za3lib3hJbnRlbnNpdHkgPSByZW5kZXIuc2t5Ym94SW50ZW5zaXR5ID8/IDE7XG4gICAgICAgIHRoaXMuX3NreWJveEx1bWluYW5jZSA9IHJlbmRlci5za3lib3hMdW1pbmFuY2UgPz8gMjAwMDA7XG4gICAgICAgIHRoaXMuX3NreWJveE1pcCA9IHJlbmRlci5za3lib3hNaXAgPz8gMDtcblxuICAgICAgICBpZiAocmVuZGVyLnNreWJveFJvdGF0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLnNreWJveFJvdGF0aW9uID0gKG5ldyBRdWF0KCkpLnNldEZyb21FdWxlckFuZ2xlcyhyZW5kZXIuc2t5Ym94Um90YXRpb25bMF0sIHJlbmRlci5za3lib3hSb3RhdGlvblsxXSwgcmVuZGVyLnNreWJveFJvdGF0aW9uWzJdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkID0gcmVuZGVyLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZDtcbiAgICAgICAgdGhpcy5saWdodGluZy5hcHBseVNldHRpbmdzKHJlbmRlcik7XG5cbiAgICAgICAgLy8gYmFrZSBzZXR0aW5nc1xuICAgICAgICBbXG4gICAgICAgICAgICAnbGlnaHRtYXBGaWx0ZXJFbmFibGVkJyxcbiAgICAgICAgICAgICdsaWdodG1hcEZpbHRlclJhbmdlJyxcbiAgICAgICAgICAgICdsaWdodG1hcEZpbHRlclNtb290aG5lc3MnLFxuICAgICAgICAgICAgJ2FtYmllbnRCYWtlJyxcbiAgICAgICAgICAgICdhbWJpZW50QmFrZU51bVNhbXBsZXMnLFxuICAgICAgICAgICAgJ2FtYmllbnRCYWtlU3BoZXJlUGFydCcsXG4gICAgICAgICAgICAnYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzJyxcbiAgICAgICAgICAgICdhbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0J1xuICAgICAgICBdLmZvckVhY2goKHNldHRpbmcpID0+IHtcbiAgICAgICAgICAgIGlmIChyZW5kZXIuaGFzT3duUHJvcGVydHkoc2V0dGluZykpIHtcbiAgICAgICAgICAgICAgICB0aGlzW3NldHRpbmddID0gcmVuZGVyW3NldHRpbmddO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuICAgIH1cblxuICAgIC8vIGdldCB0aGUgYWN0dWFsIHRleHR1cmUgdG8gdXNlIGZvciBza3lib3ggcmVuZGVyaW5nXG4gICAgX2dldFNreWJveFRleCgpIHtcbiAgICAgICAgY29uc3QgY3ViZW1hcHMgPSB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzO1xuXG4gICAgICAgIGlmICh0aGlzLl9za3lib3hNaXApIHtcbiAgICAgICAgICAgIC8vIHNreWJveCBzZWxlY3Rpb24gZm9yIHNvbWUgcmVhc29uIGhhcyBhbHdheXMgc2tpcHBlZCB0aGUgMzJ4MzIgcHJlZmlsdGVyZWQgbWlwbWFwLCBwcmVzdW1hYmx5IGEgYnVnLlxuICAgICAgICAgICAgLy8gd2UgY2FuJ3Qgc2ltcGx5IGZpeCB0aGlzIGFuZCBtYXAgMyB0byB0aGUgY29ycmVjdCBsZXZlbCwgc2luY2UgZG9pbmcgc28gaGFzIHRoZSBwb3RlbnRpYWxcbiAgICAgICAgICAgIC8vIHRvIGNoYW5nZSB0aGUgbG9vayBvZiBleGlzdGluZyBzY2VuZXMgZHJhbWF0aWNhbGx5LlxuICAgICAgICAgICAgLy8gTk9URTogdGhlIHRhYmxlIHNraXBzIHRoZSAzMngzMiBtaXBtYXBcbiAgICAgICAgICAgIGNvbnN0IHNreWJveE1hcHBpbmcgPSBbMCwgMSwgLyogMiAqLyAzLCA0LCA1LCA2XTtcblxuICAgICAgICAgICAgLy8gc2VsZWN0IGJsdXJyeSB0ZXh0dXJlIGZvciB1c2Ugb24gdGhlIHNreWJveFxuICAgICAgICAgICAgcmV0dXJuIGN1YmVtYXBzW3NreWJveE1hcHBpbmdbdGhpcy5fc2t5Ym94TWlwXV0gfHwgdGhpcy5fZW52QXRsYXMgfHwgY3ViZW1hcHNbMF0gfHwgdGhpcy5fc2t5Ym94Q3ViZU1hcDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLl9za3lib3hDdWJlTWFwIHx8IGN1YmVtYXBzWzBdIHx8IHRoaXMuX2VudkF0bGFzO1xuICAgIH1cblxuICAgIF91cGRhdGVTa3koZGV2aWNlKSB7XG4gICAgICAgIGlmICghdGhpcy5za3kpIHtcbiAgICAgICAgICAgIGNvbnN0IHRleHR1cmUgPSB0aGlzLl9nZXRTa3lib3hUZXgoKTtcbiAgICAgICAgICAgIGlmICh0ZXh0dXJlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5za3kgPSBuZXcgU2t5KGRldmljZSwgdGhpcywgdGV4dHVyZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5maXJlKCdzZXQ6c2t5Ym94JywgdGV4dHVyZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVzZXRTa3koKSB7XG4gICAgICAgIHRoaXMuc2t5Py5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuc2t5ID0gbnVsbDtcbiAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBjdWJlbWFwIGZvciB0aGUgc2NlbmUgc2t5Ym94LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlW119IFtjdWJlbWFwc10gLSBBbiBhcnJheSBvZlxuICAgICAqIGN1YmVtYXBzIGNvcnJlc3BvbmRpbmcgdG8gdGhlIHNreWJveCBhdCBkaWZmZXJlbnQgbWlwIGxldmVscy4gSWYgdW5kZWZpbmVkLCBzY2VuZSB3aWxsXG4gICAgICogcmVtb3ZlIHNreWJveC4gQ3ViZW1hcCBhcnJheSBzaG91bGQgYmUgb2Ygc2l6ZSA3LCB3aXRoIHRoZSBmaXJzdCBlbGVtZW50IChpbmRleCAwKVxuICAgICAqIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGJhc2UgY3ViZW1hcCAobWlwIGxldmVsIDApIHdpdGggb3JpZ2luYWwgcmVzb2x1dGlvbi4gRWFjaCByZW1haW5pbmdcbiAgICAgKiBlbGVtZW50IChpbmRleCAxLTYpIGNvcnJlc3BvbmRzIHRvIGEgZml4ZWQgcHJlZmlsdGVyZWQgcmVzb2x1dGlvbiAoMTI4eDEyOCwgNjR4NjQsIDMyeDMyLFxuICAgICAqIDE2eDE2LCA4eDgsIDR4NCkuXG4gICAgICovXG4gICAgc2V0U2t5Ym94KGN1YmVtYXBzKSB7XG4gICAgICAgIGlmICghY3ViZW1hcHMpIHtcbiAgICAgICAgICAgIHRoaXMuc2t5Ym94ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMucHJlZmlsdGVyZWRDdWJlbWFwcyA9IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2t5Ym94ID0gY3ViZW1hcHNbMF0gfHwgbnVsbDtcbiAgICAgICAgICAgIHRoaXMucHJlZmlsdGVyZWRDdWJlbWFwcyA9IGN1YmVtYXBzLnNsaWNlKDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGxpZ2h0bWFwIHBpeGVsIGZvcm1hdC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGxpZ2h0bWFwUGl4ZWxGb3JtYXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxpZ2h0bWFwSERSICYmIHRoaXMuZGV2aWNlLmdldEhkckZvcm1hdChmYWxzZSwgdHJ1ZSwgZmFsc2UsIHRydWUpIHx8IFBJWEVMRk9STUFUX1JHQkE4O1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2NlbmUgfTtcbiJdLCJuYW1lcyI6WyJTY2VuZSIsIkV2ZW50SGFuZGxlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJhbWJpZW50QmFrZSIsImFtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcyIsImFtYmllbnRCYWtlT2NjbHVzaW9uQ29udHJhc3QiLCJhbWJpZW50TGlnaHQiLCJDb2xvciIsImFtYmllbnRMdW1pbmFuY2UiLCJleHBvc3VyZSIsImZvZ0NvbG9yIiwiZm9nRGVuc2l0eSIsImZvZ0VuZCIsImZvZ1N0YXJ0IiwibGlnaHRtYXBTaXplTXVsdGlwbGllciIsImxpZ2h0bWFwTWF4UmVzb2x1dGlvbiIsImxpZ2h0bWFwTW9kZSIsIkJBS0VfQ09MT1JESVIiLCJsaWdodG1hcEZpbHRlckVuYWJsZWQiLCJsaWdodG1hcEhEUiIsInJvb3QiLCJza3kiLCJwaHlzaWNhbFVuaXRzIiwiRGVidWciLCJhc3NlcnREZXByZWNhdGVkIiwiZGV2aWNlIiwiR3JhcGhpY3NEZXZpY2VBY2Nlc3MiLCJnZXQiLCJfZ3Jhdml0eSIsIlZlYzMiLCJfbGF5ZXJzIiwiX2ZvZyIsIkZPR19OT05FIiwiX2dhbW1hQ29ycmVjdGlvbiIsIkdBTU1BX1NSR0IiLCJfdG9uZU1hcHBpbmciLCJfc2t5Ym94Q3ViZU1hcCIsIl9wcmVmaWx0ZXJlZEN1YmVtYXBzIiwiX2VudkF0bGFzIiwiX2ludGVybmFsRW52QXRsYXMiLCJfc2t5Ym94SW50ZW5zaXR5IiwiX3NreWJveEx1bWluYW5jZSIsIl9za3lib3hNaXAiLCJfc2t5Ym94Um90YXRpb24iLCJRdWF0IiwiX3NreWJveFJvdGF0aW9uTWF0MyIsIk1hdDMiLCJfc2t5Ym94Um90YXRpb25NYXQ0IiwiTWF0NCIsIl9hbWJpZW50QmFrZU51bVNhbXBsZXMiLCJfYW1iaWVudEJha2VTcGhlcmVQYXJ0IiwiX2xpZ2h0bWFwRmlsdGVyUmFuZ2UiLCJfbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzIiwiX2NsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsIl9saWdodGluZ1BhcmFtcyIsIkxpZ2h0aW5nUGFyYW1zIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwibWF4VGV4dHVyZVNpemUiLCJfZGlydHlMaWdodHMiLCJfc3RhdHMiLCJtZXNoSW5zdGFuY2VzIiwibGlnaHRzIiwiZHluYW1pY0xpZ2h0cyIsImJha2VkTGlnaHRzIiwibGFzdFN0YXRpY1ByZXBhcmVGdWxsVGltZSIsImxhc3RTdGF0aWNQcmVwYXJlU2VhcmNoVGltZSIsImxhc3RTdGF0aWNQcmVwYXJlV3JpdGVUaW1lIiwibGFzdFN0YXRpY1ByZXBhcmVUcmlBYWJiVGltZSIsImxhc3RTdGF0aWNQcmVwYXJlQ29tYmluZVRpbWUiLCJ1cGRhdGVTaGFkZXJzVGltZSIsInVwZGF0ZVNoYWRlcnMiLCJfc2hhZGVyVmVyc2lvbiIsIl9zdGF0c1VwZGF0ZWQiLCJpbW1lZGlhdGUiLCJJbW1lZGlhdGUiLCJkZWZhdWx0RHJhd0xheWVyIiwibGF5ZXJzIiwiZ2V0TGF5ZXJCeUlkIiwiTEFZRVJJRF9JTU1FRElBVEUiLCJhbWJpZW50QmFrZU51bVNhbXBsZXMiLCJ2YWx1ZSIsIm1hdGgiLCJjbGFtcCIsIk1hdGgiLCJmbG9vciIsImFtYmllbnRCYWtlU3BoZXJlUGFydCIsImNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCIsImNvbnNvbGUiLCJlcnJvciIsImRyYXdDYWxscyIsIl9tZXNoSW5zdGFuY2VzIiwibGVuZ3RoIiwiX3VwZGF0ZSIsImVudkF0bGFzIiwiYWRkcmVzc1UiLCJBRERSRVNTX1JFUEVBVCIsImFkZHJlc3NWIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwibWluRmlsdGVyIiwiRklMVEVSX0xJTkVBUiIsIm1hZ0ZpbHRlciIsIm1pcG1hcHMiLCJmb2ciLCJ0eXBlIiwiZ2FtbWFDb3JyZWN0aW9uIiwicHJldiIsImZpcmUiLCJsaWdodGluZyIsImxpZ2h0bWFwRmlsdGVyUmFuZ2UiLCJtYXgiLCJsaWdodG1hcEZpbHRlclNtb290aG5lc3MiLCJwcmVmaWx0ZXJlZEN1YmVtYXBzIiwiY3ViZW1hcHMiLCJjaGFuZ2VkIiwiY29tcGxldGUiLCJpIiwidiIsIl9yZXNldFNreSIsIkVudkxpZ2h0aW5nIiwiZ2VuZXJhdGVQcmVmaWx0ZXJlZEF0bGFzIiwidGFyZ2V0IiwiZGVzdHJveSIsInNreWJveCIsInNreWJveEludGVuc2l0eSIsInNreWJveEx1bWluYW5jZSIsInNreWJveE1pcCIsInNreWJveFJvdGF0aW9uIiwiZXF1YWxzIiwiY29weSIsIklERU5USVRZIiwic2V0SWRlbnRpdHkiLCJzZXRUUlMiLCJaRVJPIiwiT05FIiwiaW52ZXJ0VG8zeDMiLCJ0b25lTWFwcGluZyIsIm9mZiIsImRyYXdMaW5lIiwic3RhcnQiLCJlbmQiLCJjb2xvciIsIldISVRFIiwiZGVwdGhUZXN0IiwibGF5ZXIiLCJiYXRjaCIsImdldEJhdGNoIiwiYWRkTGluZXMiLCJkcmF3TGluZXMiLCJwb3NpdGlvbnMiLCJjb2xvcnMiLCJkcmF3TGluZUFycmF5cyIsImFkZExpbmVzQXJyYXlzIiwiYXBwbHlTZXR0aW5ncyIsInNldHRpbmdzIiwiX3JlbmRlciRza3lib3hJbnRlbnNpIiwiX3JlbmRlciRza3lib3hMdW1pbmFuIiwiX3JlbmRlciRza3lib3hNaXAiLCJwaHlzaWNzIiwicmVuZGVyIiwic2V0IiwiZ3Jhdml0eSIsImdsb2JhbF9hbWJpZW50IiwiZm9nX2NvbG9yIiwiZm9nX3N0YXJ0IiwiZm9nX2VuZCIsImZvZ19kZW5zaXR5IiwiZ2FtbWFfY29ycmVjdGlvbiIsInRvbmVtYXBwaW5nIiwic2V0RnJvbUV1bGVyQW5nbGVzIiwiZm9yRWFjaCIsInNldHRpbmciLCJoYXNPd25Qcm9wZXJ0eSIsIl9nZXRTa3lib3hUZXgiLCJza3lib3hNYXBwaW5nIiwiX3VwZGF0ZVNreSIsInRleHR1cmUiLCJTa3kiLCJfdGhpcyRza3kiLCJzZXRTa3lib3giLCJzbGljZSIsImxpZ2h0bWFwUGl4ZWxGb3JtYXQiLCJnZXRIZHJGb3JtYXQiLCJQSVhFTEZPUk1BVF9SR0JBOCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBa0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLEtBQUssU0FBU0MsWUFBWSxDQUFDO0FBQzdCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0s7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxjQUFjLEVBQUU7QUFDeEIs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
