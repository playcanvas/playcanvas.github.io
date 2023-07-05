import { Debug } from '../core/debug.js';
import { EventHandler } from '../core/event-handler.js';
import { Color } from '../core/math/color.js';
import { Vec3 } from '../core/math/vec3.js';
import { Quat } from '../core/math/quat.js';
import { math } from '../core/math/math.js';
import { Mat3 } from '../core/math/mat3.js';
import { Mat4 } from '../core/math/mat4.js';
import { GraphicsDeviceAccess } from '../platform/graphics/graphics-device-access.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, PIXELFORMAT_RGBA8 } from '../platform/graphics/constants.js';
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
   * Create a new Scene instance.
   *
   * @param {import('../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
   * The graphics device used to manage this scene.
   * @hideconstructor
   */
  constructor(graphicsDevice) {
    super();
    /**
     * If enabled, the ambient lighting will be baked into lightmaps. This will be either the
     * {@link Scene#skybox} if set up, otherwise {@link Scene#ambientLight}. Defaults to false.
     *
     * @type {boolean}
     */
    this.ambientBake = false;
    /**
     * If {@link Scene#ambientBake} is true, this specifies the brightness of ambient occlusion.
     * Typical range is -1 to 1. Defaults to 0, representing no change to brightness.
     *
     * @type {number}
     */
    this.ambientBakeOcclusionBrightness = 0;
    /**
     * If {@link Scene#ambientBake} is true, this specifies the contrast of ambient occlusion.
     * Typical range is -1 to 1. Defaults to 0, representing no change to contrast.
     *
     * @type {number}
     */
    this.ambientBakeOcclusionContrast = 0;
    /**
     * The color of the scene's ambient light. Defaults to black (0, 0, 0).
     *
     * @type {Color}
     */
    this.ambientLight = new Color(0, 0, 0);
    /**
     * The luminosity of the scene's ambient light in lux (lm/m^2). Used if physicalUnits is true. Defaults to 0.
     *
     * @type {number}
     */
    this.ambientLuminance = 0;
    /**
     * The exposure value tweaks the overall brightness of the scene. Ignored if physicalUnits is true. Defaults to 1.
     *
     * @type {number}
     */
    this.exposure = 1;
    /**
     * The color of the fog (if enabled). Defaults to black (0, 0, 0).
     *
     * @type {Color}
     */
    this.fogColor = new Color(0, 0, 0);
    /**
     * The density of the fog (if enabled). This property is only valid if the fog property is set
     * to {@link FOG_EXP} or {@link FOG_EXP2}. Defaults to 0.
     *
     * @type {number}
     */
    this.fogDensity = 0;
    /**
     * The distance from the viewpoint where linear fog reaches its maximum. This property is only
     * valid if the fog property is set to {@link FOG_LINEAR}. Defaults to 1000.
     *
     * @type {number}
     */
    this.fogEnd = 1000;
    /**
     * The distance from the viewpoint where linear fog begins. This property is only valid if the
     * fog property is set to {@link FOG_LINEAR}. Defaults to 1.
     *
     * @type {number}
     */
    this.fogStart = 1;
    /**
     * The lightmap resolution multiplier. Defaults to 1.
     *
     * @type {number}
     */
    this.lightmapSizeMultiplier = 1;
    /**
     * The maximum lightmap resolution. Defaults to 2048.
     *
     * @type {number}
     */
    this.lightmapMaxResolution = 2048;
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
    this.lightmapMode = BAKE_COLORDIR;
    /**
     * Enables bilateral filter on runtime baked color lightmaps, which removes the noise and
     * banding while preserving the edges. Defaults to false. Note that the filtering takes place
     * in the image space of the lightmap, and it does not filter across lightmap UV space seams,
     * often making the seams more visible. It's important to balance the strength of the filter
     * with number of samples used for lightmap baking to limit the visible artifacts.
     *
     * @type {boolean}
     */
    this.lightmapFilterEnabled = false;
    /**
     * Enables HDR lightmaps. This can result in smoother lightmaps especially when many samples
     * are used. Defaults to false.
     *
     * @type {boolean}
     */
    this.lightmapHDR = false;
    /**
     * The root entity of the scene, which is usually the only child to the {@link Application}
     * root entity.
     *
     * @type {import('../framework/entity.js').Entity}
     */
    this.root = null;
    /**
     * The sky of the scene.
     *
     * @type {Sky}
     * @ignore
     */
    this.sky = null;
    /**
     * Use physically based units for cameras and lights. When used, the exposure value is ignored.
     *
     * @type {boolean}
     */
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
    this._prefilteredCubemaps = [];

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
   *     const list = newComp.layerList;
   *     for (let i = 0; i < list.length; i++) {
   *         const layer = list[i];
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
   * @type {import('./mesh-instance.js').MeshInstance[]}
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
      this._resetSky();
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
    value = value || [];
    const cubemaps = this._prefilteredCubemaps;
    const changed = cubemaps.length !== value.length || cubemaps.some((c, i) => c !== value[i]);
    if (changed) {
      const complete = value.length === 6 && value.every(c => !!c);
      if (complete) {
        // update env atlas
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
      this._resetSky();
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
      this.envAtlas = null;
    } else {
      this.skybox = cubemaps[0] || null;
      if (cubemaps[1] && !cubemaps[1].cubemap) {
        // prefiltered data is an env atlas
        this.envAtlas = cubemaps[1];
      } else {
        // prefiltered data is a set of cubemaps
        this.prefilteredCubemaps = cubemaps.slice(1);
      }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9zY2VuZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBRdWF0IH0gZnJvbSAnLi4vY29yZS9tYXRoL3F1YXQuanMnO1xuaW1wb3J0IHsgbWF0aCB9IGZyb20gJy4uL2NvcmUvbWF0aC9tYXRoLmpzJztcbmltcG9ydCB7IE1hdDMgfSBmcm9tICcuLi9jb3JlL21hdGgvbWF0My5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vY29yZS9tYXRoL21hdDQuanMnO1xuXG5pbXBvcnQgeyBHcmFwaGljc0RldmljZUFjY2VzcyB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS1hY2Nlc3MuanMnO1xuaW1wb3J0IHsgUElYRUxGT1JNQVRfUkdCQTgsIEFERFJFU1NfQ0xBTVBfVE9fRURHRSwgRklMVEVSX0xJTkVBUiB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IEJBS0VfQ09MT1JESVIsIEZPR19OT05FLCBHQU1NQV9TUkdCLCBMQVlFUklEX0lNTUVESUFURSB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNreSB9IGZyb20gJy4vc2t5LmpzJztcbmltcG9ydCB7IExpZ2h0aW5nUGFyYW1zIH0gZnJvbSAnLi9saWdodGluZy9saWdodGluZy1wYXJhbXMuanMnO1xuaW1wb3J0IHsgSW1tZWRpYXRlIH0gZnJvbSAnLi9pbW1lZGlhdGUvaW1tZWRpYXRlLmpzJztcbmltcG9ydCB7IEVudkxpZ2h0aW5nIH0gZnJvbSAnLi9ncmFwaGljcy9lbnYtbGlnaHRpbmcuanMnO1xuXG4vKipcbiAqIEEgc2NlbmUgaXMgZ3JhcGhpY2FsIHJlcHJlc2VudGF0aW9uIG9mIGFuIGVudmlyb25tZW50LiBJdCBtYW5hZ2VzIHRoZSBzY2VuZSBoaWVyYXJjaHksIGFsbFxuICogZ3JhcGhpY2FsIG9iamVjdHMsIGxpZ2h0cywgYW5kIHNjZW5lLXdpZGUgcHJvcGVydGllcy5cbiAqXG4gKiBAYXVnbWVudHMgRXZlbnRIYW5kbGVyXG4gKi9cbmNsYXNzIFNjZW5lIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBJZiBlbmFibGVkLCB0aGUgYW1iaWVudCBsaWdodGluZyB3aWxsIGJlIGJha2VkIGludG8gbGlnaHRtYXBzLiBUaGlzIHdpbGwgYmUgZWl0aGVyIHRoZVxuICAgICAqIHtAbGluayBTY2VuZSNza3lib3h9IGlmIHNldCB1cCwgb3RoZXJ3aXNlIHtAbGluayBTY2VuZSNhbWJpZW50TGlnaHR9LiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGFtYmllbnRCYWtlID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBJZiB7QGxpbmsgU2NlbmUjYW1iaWVudEJha2V9IGlzIHRydWUsIHRoaXMgc3BlY2lmaWVzIHRoZSBicmlnaHRuZXNzIG9mIGFtYmllbnQgb2NjbHVzaW9uLlxuICAgICAqIFR5cGljYWwgcmFuZ2UgaXMgLTEgdG8gMS4gRGVmYXVsdHMgdG8gMCwgcmVwcmVzZW50aW5nIG5vIGNoYW5nZSB0byBicmlnaHRuZXNzLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBhbWJpZW50QmFrZU9jY2x1c2lvbkJyaWdodG5lc3MgPSAwO1xuXG4gICAgIC8qKlxuICAgICAgKiBJZiB7QGxpbmsgU2NlbmUjYW1iaWVudEJha2V9IGlzIHRydWUsIHRoaXMgc3BlY2lmaWVzIHRoZSBjb250cmFzdCBvZiBhbWJpZW50IG9jY2x1c2lvbi5cbiAgICAgICogVHlwaWNhbCByYW5nZSBpcyAtMSB0byAxLiBEZWZhdWx0cyB0byAwLCByZXByZXNlbnRpbmcgbm8gY2hhbmdlIHRvIGNvbnRyYXN0LlxuICAgICAgKlxuICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgKi9cbiAgICBhbWJpZW50QmFrZU9jY2x1c2lvbkNvbnRyYXN0ID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBjb2xvciBvZiB0aGUgc2NlbmUncyBhbWJpZW50IGxpZ2h0LiBEZWZhdWx0cyB0byBibGFjayAoMCwgMCwgMCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Q29sb3J9XG4gICAgICovXG4gICAgYW1iaWVudExpZ2h0ID0gbmV3IENvbG9yKDAsIDAsIDApO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGx1bWlub3NpdHkgb2YgdGhlIHNjZW5lJ3MgYW1iaWVudCBsaWdodCBpbiBsdXggKGxtL21eMikuIFVzZWQgaWYgcGh5c2ljYWxVbml0cyBpcyB0cnVlLiBEZWZhdWx0cyB0byAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBhbWJpZW50THVtaW5hbmNlID0gMDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBleHBvc3VyZSB2YWx1ZSB0d2Vha3MgdGhlIG92ZXJhbGwgYnJpZ2h0bmVzcyBvZiB0aGUgc2NlbmUuIElnbm9yZWQgaWYgcGh5c2ljYWxVbml0cyBpcyB0cnVlLiBEZWZhdWx0cyB0byAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBleHBvc3VyZSA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY29sb3Igb2YgdGhlIGZvZyAoaWYgZW5hYmxlZCkuIERlZmF1bHRzIHRvIGJsYWNrICgwLCAwLCAwKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtDb2xvcn1cbiAgICAgKi9cbiAgICBmb2dDb2xvciA9IG5ldyBDb2xvcigwLCAwLCAwKTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBkZW5zaXR5IG9mIHRoZSBmb2cgKGlmIGVuYWJsZWQpLiBUaGlzIHByb3BlcnR5IGlzIG9ubHkgdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXRcbiAgICAgKiB0byB7QGxpbmsgRk9HX0VYUH0gb3Ige0BsaW5rIEZPR19FWFAyfS4gRGVmYXVsdHMgdG8gMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZm9nRGVuc2l0eSA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgZGlzdGFuY2UgZnJvbSB0aGUgdmlld3BvaW50IHdoZXJlIGxpbmVhciBmb2cgcmVhY2hlcyBpdHMgbWF4aW11bS4gVGhpcyBwcm9wZXJ0eSBpcyBvbmx5XG4gICAgICogdmFsaWQgaWYgdGhlIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19MSU5FQVJ9LiBEZWZhdWx0cyB0byAxMDAwLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBmb2dFbmQgPSAxMDAwO1xuXG4gICAgLyoqXG4gICAgICogVGhlIGRpc3RhbmNlIGZyb20gdGhlIHZpZXdwb2ludCB3aGVyZSBsaW5lYXIgZm9nIGJlZ2lucy4gVGhpcyBwcm9wZXJ0eSBpcyBvbmx5IHZhbGlkIGlmIHRoZVxuICAgICAqIGZvZyBwcm9wZXJ0eSBpcyBzZXQgdG8ge0BsaW5rIEZPR19MSU5FQVJ9LiBEZWZhdWx0cyB0byAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBmb2dTdGFydCA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbGlnaHRtYXAgcmVzb2x1dGlvbiBtdWx0aXBsaWVyLiBEZWZhdWx0cyB0byAxLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBsaWdodG1hcFNpemVNdWx0aXBsaWVyID0gMTtcblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXhpbXVtIGxpZ2h0bWFwIHJlc29sdXRpb24uIERlZmF1bHRzIHRvIDIwNDguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIGxpZ2h0bWFwTWF4UmVzb2x1dGlvbiA9IDIwNDg7XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbGlnaHRtYXAgYmFraW5nIG1vZGUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEJBS0VfQ09MT1J9OiBzaW5nbGUgY29sb3IgbGlnaHRtYXBcbiAgICAgKiAtIHtAbGluayBCQUtFX0NPTE9SRElSfTogc2luZ2xlIGNvbG9yIGxpZ2h0bWFwICsgZG9taW5hbnQgbGlnaHQgZGlyZWN0aW9uICh1c2VkIGZvciBidW1wIG9yXG4gICAgICogc3BlY3VsYXIpLiBPbmx5IGxpZ2h0cyB3aXRoIGJha2VEaXI9dHJ1ZSB3aWxsIGJlIHVzZWQgZm9yIGdlbmVyYXRpbmcgdGhlIGRvbWluYW50IGxpZ2h0XG4gICAgICogZGlyZWN0aW9uLlxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIEJBS0VfQ09MT1JESVJ9LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBsaWdodG1hcE1vZGUgPSBCQUtFX0NPTE9SRElSO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBiaWxhdGVyYWwgZmlsdGVyIG9uIHJ1bnRpbWUgYmFrZWQgY29sb3IgbGlnaHRtYXBzLCB3aGljaCByZW1vdmVzIHRoZSBub2lzZSBhbmRcbiAgICAgKiBiYW5kaW5nIHdoaWxlIHByZXNlcnZpbmcgdGhlIGVkZ2VzLiBEZWZhdWx0cyB0byBmYWxzZS4gTm90ZSB0aGF0IHRoZSBmaWx0ZXJpbmcgdGFrZXMgcGxhY2VcbiAgICAgKiBpbiB0aGUgaW1hZ2Ugc3BhY2Ugb2YgdGhlIGxpZ2h0bWFwLCBhbmQgaXQgZG9lcyBub3QgZmlsdGVyIGFjcm9zcyBsaWdodG1hcCBVViBzcGFjZSBzZWFtcyxcbiAgICAgKiBvZnRlbiBtYWtpbmcgdGhlIHNlYW1zIG1vcmUgdmlzaWJsZS4gSXQncyBpbXBvcnRhbnQgdG8gYmFsYW5jZSB0aGUgc3RyZW5ndGggb2YgdGhlIGZpbHRlclxuICAgICAqIHdpdGggbnVtYmVyIG9mIHNhbXBsZXMgdXNlZCBmb3IgbGlnaHRtYXAgYmFraW5nIHRvIGxpbWl0IHRoZSB2aXNpYmxlIGFydGlmYWN0cy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGxpZ2h0bWFwRmlsdGVyRW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogRW5hYmxlcyBIRFIgbGlnaHRtYXBzLiBUaGlzIGNhbiByZXN1bHQgaW4gc21vb3RoZXIgbGlnaHRtYXBzIGVzcGVjaWFsbHkgd2hlbiBtYW55IHNhbXBsZXNcbiAgICAgKiBhcmUgdXNlZC4gRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBsaWdodG1hcEhEUiA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHJvb3QgZW50aXR5IG9mIHRoZSBzY2VuZSwgd2hpY2ggaXMgdXN1YWxseSB0aGUgb25seSBjaGlsZCB0byB0aGUge0BsaW5rIEFwcGxpY2F0aW9ufVxuICAgICAqIHJvb3QgZW50aXR5LlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vZnJhbWV3b3JrL2VudGl0eS5qcycpLkVudGl0eX1cbiAgICAgKi9cbiAgICByb290ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFRoZSBza3kgb2YgdGhlIHNjZW5lLlxuICAgICAqXG4gICAgICogQHR5cGUge1NreX1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgc2t5ID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFVzZSBwaHlzaWNhbGx5IGJhc2VkIHVuaXRzIGZvciBjYW1lcmFzIGFuZCBsaWdodHMuIFdoZW4gdXNlZCwgdGhlIGV4cG9zdXJlIHZhbHVlIGlzIGlnbm9yZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBwaHlzaWNhbFVuaXRzID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU2NlbmUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC1cbiAgICAgKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIHVzZWQgdG8gbWFuYWdlIHRoaXMgc2NlbmUuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0RGVwcmVjYXRlZChncmFwaGljc0RldmljZSwgXCJTY2VuZSBjb25zdHJ1Y3RvciB0YWtlcyBhIEdyYXBoaWNzRGV2aWNlIGFzIGEgcGFyYW1ldGVyLCBhbmQgaXQgd2FzIG5vdCBwcm92aWRlZC5cIik7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2UgfHwgR3JhcGhpY3NEZXZpY2VBY2Nlc3MuZ2V0KCk7XG5cbiAgICAgICAgdGhpcy5fZ3Jhdml0eSA9IG5ldyBWZWMzKDAsIC05LjgsIDApO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2xheWVycyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fZm9nID0gRk9HX05PTkU7XG5cbiAgICAgICAgdGhpcy5fZ2FtbWFDb3JyZWN0aW9uID0gR0FNTUFfU1JHQjtcbiAgICAgICAgdGhpcy5fdG9uZU1hcHBpbmcgPSAwO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgc2t5Ym94IGN1YmVtYXAgYXMgc2V0IGJ5IHVzZXIgKGdldHMgdXNlZCB3aGVuIHNreWJveE1pcCA9PT0gMClcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9za3lib3hDdWJlTWFwID0gbnVsbDtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgb2YgNiBwcmVmaWx0ZXJlZCBsaWdodGluZyBkYXRhIGN1YmVtYXBzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZVtdfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcyA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBFbnZpcm9ubWVudCBsaWdodGluZyBhdGxhc1xuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VudkF0bGFzID0gbnVsbDtcblxuICAgICAgICAvLyBpbnRlcm5hbGx5IGdlbmVyYXRlZCBlbnZBdGxhcyBvd25lZCBieSB0aGUgc2NlbmVcbiAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcyA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc2t5Ym94SW50ZW5zaXR5ID0gMTtcbiAgICAgICAgdGhpcy5fc2t5Ym94THVtaW5hbmNlID0gMDtcbiAgICAgICAgdGhpcy5fc2t5Ym94TWlwID0gMDtcblxuICAgICAgICB0aGlzLl9za3lib3hSb3RhdGlvbiA9IG5ldyBRdWF0KCk7XG4gICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uTWF0MyA9IG5ldyBNYXQzKCk7XG4gICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uTWF0NCA9IG5ldyBNYXQ0KCk7XG5cbiAgICAgICAgLy8gYW1iaWVudCBsaWdodCBsaWdodG1hcHBpbmcgcHJvcGVydGllc1xuICAgICAgICB0aGlzLl9hbWJpZW50QmFrZU51bVNhbXBsZXMgPSAxO1xuICAgICAgICB0aGlzLl9hbWJpZW50QmFrZVNwaGVyZVBhcnQgPSAwLjQ7XG5cbiAgICAgICAgdGhpcy5fbGlnaHRtYXBGaWx0ZXJSYW5nZSA9IDEwO1xuICAgICAgICB0aGlzLl9saWdodG1hcEZpbHRlclNtb290aG5lc3MgPSAwLjI7XG5cbiAgICAgICAgLy8gY2x1c3RlcmVkIGxpZ2h0aW5nXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuX2xpZ2h0aW5nUGFyYW1zID0gbmV3IExpZ2h0aW5nUGFyYW1zKHRoaXMuZGV2aWNlLnN1cHBvcnRzQXJlYUxpZ2h0cywgdGhpcy5kZXZpY2UubWF4VGV4dHVyZVNpemUsICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuX2xheWVycy5fZGlydHlMaWdodHMgPSB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl9zdGF0cyA9IHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZXM6IDAsXG4gICAgICAgICAgICBsaWdodHM6IDAsXG4gICAgICAgICAgICBkeW5hbWljTGlnaHRzOiAwLFxuICAgICAgICAgICAgYmFrZWRMaWdodHM6IDAsXG4gICAgICAgICAgICBsYXN0U3RhdGljUHJlcGFyZUZ1bGxUaW1lOiAwLFxuICAgICAgICAgICAgbGFzdFN0YXRpY1ByZXBhcmVTZWFyY2hUaW1lOiAwLFxuICAgICAgICAgICAgbGFzdFN0YXRpY1ByZXBhcmVXcml0ZVRpbWU6IDAsXG4gICAgICAgICAgICBsYXN0U3RhdGljUHJlcGFyZVRyaUFhYmJUaW1lOiAwLFxuICAgICAgICAgICAgbGFzdFN0YXRpY1ByZXBhcmVDb21iaW5lVGltZTogMCxcbiAgICAgICAgICAgIHVwZGF0ZVNoYWRlcnNUaW1lOiAwIC8vIGRlcHJlY2F0ZWRcbiAgICAgICAgfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhpcyBmbGFnIGluZGljYXRlcyBjaGFuZ2VzIHdlcmUgbWFkZSB0byB0aGUgc2NlbmUgd2hpY2ggbWF5IHJlcXVpcmUgcmVjb21waWxhdGlvbiBvZlxuICAgICAgICAgKiBzaGFkZXJzIHRoYXQgcmVmZXJlbmNlIGdsb2JhbCBzZXR0aW5ncy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMudXBkYXRlU2hhZGVycyA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fc2hhZGVyVmVyc2lvbiA9IDA7XG4gICAgICAgIHRoaXMuX3N0YXRzVXBkYXRlZCA9IGZhbHNlO1xuXG4gICAgICAgIC8vIGltbWVkaWF0ZSByZW5kZXJpbmdcbiAgICAgICAgdGhpcy5pbW1lZGlhdGUgPSBuZXcgSW1tZWRpYXRlKHRoaXMuZGV2aWNlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBza3lib3ggaXMgc2V0LlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjZW5lI3NldDpza3lib3hcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9IHVzZWRUZXggLSBQcmV2aW91c2x5IHVzZWQgY3ViZW1hcFxuICAgICAqIHRleHR1cmUuIE5ldyBpcyBpbiB0aGUge0BsaW5rIFNjZW5lI3NreWJveH0uXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHRoZSBsYXllciBjb21wb3NpdGlvbiBpcyBzZXQuIFVzZSB0aGlzIGV2ZW50IHRvIGFkZCBjYWxsYmFja3Mgb3IgYWR2YW5jZWRcbiAgICAgKiBwcm9wZXJ0aWVzIHRvIHlvdXIgbGF5ZXJzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjZW5lI3NldDpsYXllcnNcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IG9sZENvbXAgLSBQcmV2aW91c2x5XG4gICAgICogdXNlZCB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnKS5MYXllckNvbXBvc2l0aW9ufSBuZXdDb21wIC0gTmV3bHkgc2V0XG4gICAgICoge0BsaW5rIExheWVyQ29tcG9zaXRpb259LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogdGhpcy5hcHAuc2NlbmUub24oJ3NldDpsYXllcnMnLCBmdW5jdGlvbiAob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAqICAgICBjb25zdCBsaXN0ID0gbmV3Q29tcC5sYXllckxpc3Q7XG4gICAgICogICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAqICAgICAgICAgY29uc3QgbGF5ZXIgPSBsaXN0W2ldO1xuICAgICAqICAgICAgICAgc3dpdGNoIChsYXllci5uYW1lKSB7XG4gICAgICogICAgICAgICAgICAgY2FzZSAnTXlMYXllcic6XG4gICAgICogICAgICAgICAgICAgICAgIGxheWVyLm9uRW5hYmxlID0gbXlPbkVuYWJsZUZ1bmN0aW9uO1xuICAgICAqICAgICAgICAgICAgICAgICBsYXllci5vbkRpc2FibGUgPSBteU9uRGlzYWJsZUZ1bmN0aW9uO1xuICAgICAqICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgICAgICBjYXNlICdNeU90aGVyTGF5ZXInOlxuICAgICAqICAgICAgICAgICAgICAgICBsYXllci5zaGFkZXJQYXNzID0gbXlTaGFkZXJQYXNzO1xuICAgICAqICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgZGVmYXVsdCBsYXllciB1c2VkIGJ5IHRoZSBpbW1lZGlhdGUgZHJhd2luZyBmdW5jdGlvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuL2xheWVyLmpzJykuTGF5ZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBnZXQgZGVmYXVsdERyYXdMYXllcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGF5ZXJzLmdldExheWVyQnlJZChMQVlFUklEX0lNTUVESUFURSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYge0BsaW5rIFNjZW5lI2FtYmllbnRCYWtlfSBpcyB0cnVlLCB0aGlzIHNwZWNpZmllcyB0aGUgbnVtYmVyIG9mIHNhbXBsZXMgdXNlZCB0byBiYWtlIHRoZVxuICAgICAqIGFtYmllbnQgbGlnaHQgaW50byB0aGUgbGlnaHRtYXAuIERlZmF1bHRzIHRvIDEuIE1heGltdW0gdmFsdWUgaXMgMjU1LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYW1iaWVudEJha2VOdW1TYW1wbGVzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2FtYmllbnRCYWtlTnVtU2FtcGxlcyA9IG1hdGguY2xhbXAoTWF0aC5mbG9vcih2YWx1ZSksIDEsIDI1NSk7XG4gICAgfVxuXG4gICAgZ2V0IGFtYmllbnRCYWtlTnVtU2FtcGxlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FtYmllbnRCYWtlTnVtU2FtcGxlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB7QGxpbmsgU2NlbmUjYW1iaWVudEJha2V9IGlzIHRydWUsIHRoaXMgc3BlY2lmaWVzIGEgcGFydCBvZiB0aGUgc3BoZXJlIHdoaWNoIHJlcHJlc2VudHNcbiAgICAgKiB0aGUgc291cmNlIG9mIGFtYmllbnQgbGlnaHQuIFRoZSB2YWxpZCByYW5nZSBpcyAwLi4xLCByZXByZXNlbnRpbmcgYSBwYXJ0IG9mIHRoZSBzcGhlcmUgZnJvbVxuICAgICAqIHRvcCB0byB0aGUgYm90dG9tLiBBIHZhbHVlIG9mIDAuNSByZXByZXNlbnRzIHRoZSB1cHBlciBoZW1pc3BoZXJlLiBBIHZhbHVlIG9mIDEgcmVwcmVzZW50cyBhXG4gICAgICogZnVsbCBzcGhlcmUuIERlZmF1bHRzIHRvIDAuNCwgd2hpY2ggaXMgYSBzbWFsbGVyIHVwcGVyIGhlbWlzcGhlcmUgYXMgdGhpcyByZXF1aXJlcyBmZXdlclxuICAgICAqIHNhbXBsZXMgdG8gYmFrZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFtYmllbnRCYWtlU3BoZXJlUGFydCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9hbWJpZW50QmFrZVNwaGVyZVBhcnQgPSBtYXRoLmNsYW1wKHZhbHVlLCAwLjAwMSwgMSk7XG4gICAgfVxuXG4gICAgZ2V0IGFtYmllbnRCYWtlU3BoZXJlUGFydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2FtYmllbnRCYWtlU3BoZXJlUGFydDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcnVlIGlmIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgZW5hYmxlZC4gU2V0IHRvIGZhbHNlIGJlZm9yZSB0aGUgZmlyc3QgZnJhbWUgaXMgcmVuZGVyZWRcbiAgICAgKiB0byB1c2Ugbm9uLWNsdXN0ZXJlZCBsaWdodGluZy4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQodmFsdWUpIHtcblxuICAgICAgICBpZiAoIXRoaXMuX2NsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCAmJiB2YWx1ZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignVHVybmluZyBvbiBkaXNhYmxlZCBjbHVzdGVyZWQgbGlnaHRpbmcgaXMgbm90IGN1cnJlbnRseSBzdXBwb3J0ZWQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBhbGwgYWN0aXZlIGNvbXBvc2l0aW9uIG1lc2ggaW5zdGFuY2VzLiBPbmx5IGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eS5cbiAgICAgKiBUT0RPOiBCYXRjaE1hbmFnZXIgaXMgdXNpbmcgaXQgLSBwZXJoYXBzIHRoYXQgY291bGQgYmUgcmVmYWN0b3JlZFxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9tZXNoLWluc3RhbmNlLmpzJykuTWVzaEluc3RhbmNlW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBzZXQgZHJhd0NhbGxzKHZhbHVlKSB7XG4gICAgfVxuXG4gICAgZ2V0IGRyYXdDYWxscygpIHtcbiAgICAgICAgbGV0IGRyYXdDYWxscyA9IHRoaXMubGF5ZXJzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICBpZiAoIWRyYXdDYWxscy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMubGF5ZXJzLl91cGRhdGUodGhpcy5kZXZpY2UsIHRoaXMuY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkKTtcbiAgICAgICAgICAgIGRyYXdDYWxscyA9IHRoaXMubGF5ZXJzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBkcmF3Q2FsbHM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGVudmlyb25tZW50IGxpZ2h0aW5nIGF0bGFzLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9XG4gICAgICovXG4gICAgc2V0IGVudkF0bGFzKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fZW52QXRsYXMpIHtcbiAgICAgICAgICAgIHRoaXMuX2VudkF0bGFzID0gdmFsdWU7XG5cbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSByZXF1aXJlZCBvcHRpb25zIGFyZSBzZXQgdXAgb24gdGhlIHRleHR1cmVcbiAgICAgICAgICAgIGlmICh2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHZhbHVlLmFkZHJlc3NVID0gQUREUkVTU19DTEFNUF9UT19FREdFO1xuICAgICAgICAgICAgICAgIHZhbHVlLmFkZHJlc3NWID0gQUREUkVTU19DTEFNUF9UT19FREdFO1xuICAgICAgICAgICAgICAgIHZhbHVlLm1pbkZpbHRlciA9IEZJTFRFUl9MSU5FQVI7XG4gICAgICAgICAgICAgICAgdmFsdWUubWFnRmlsdGVyID0gRklMVEVSX0xJTkVBUjtcbiAgICAgICAgICAgICAgICB2YWx1ZS5taXBtYXBzID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3ByZWZpbHRlcmVkQ3ViZW1hcHMgPSBbXTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9pbnRlcm5hbEVudkF0bGFzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcyA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0U2t5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgZW52QXRsYXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9lbnZBdGxhcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiBmb2cgdXNlZCBieSB0aGUgc2NlbmUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIEZPR19OT05FfVxuICAgICAqIC0ge0BsaW5rIEZPR19MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgRk9HX0VYUH1cbiAgICAgKiAtIHtAbGluayBGT0dfRVhQMn1cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBGT0dfTk9ORX0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCBmb2codHlwZSkge1xuICAgICAgICBpZiAodHlwZSAhPT0gdGhpcy5fZm9nKSB7XG4gICAgICAgICAgICB0aGlzLl9mb2cgPSB0eXBlO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBmb2coKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9mb2c7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGdhbW1hIGNvcnJlY3Rpb24gdG8gYXBwbHkgd2hlbiByZW5kZXJpbmcgdGhlIHNjZW5lLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBHQU1NQV9OT05FfVxuICAgICAqIC0ge0BsaW5rIEdBTU1BX1NSR0J9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgR0FNTUFfU1JHQn0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBnYW1tYUNvcnJlY3Rpb24odmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9nYW1tYUNvcnJlY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX2dhbW1hQ29ycmVjdGlvbiA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBnYW1tYUNvcnJlY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nYW1tYUNvcnJlY3Rpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSB7QGxpbmsgTGF5ZXJDb21wb3NpdGlvbn0gdGhhdCBkZWZpbmVzIHJlbmRlcmluZyBvcmRlciBvZiB0aGlzIHNjZW5lLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259XG4gICAgICovXG4gICAgc2V0IGxheWVycyhsYXllcnMpIHtcbiAgICAgICAgY29uc3QgcHJldiA9IHRoaXMuX2xheWVycztcbiAgICAgICAgdGhpcy5fbGF5ZXJzID0gbGF5ZXJzO1xuICAgICAgICB0aGlzLmZpcmUoJ3NldDpsYXllcnMnLCBwcmV2LCBsYXllcnMpO1xuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSB7QGxpbmsgTGlnaHRpbmdQYXJhbXN9IHRoYXQgZGVmaW5lcyBsaWdodGluZyBwYXJhbWV0ZXJzLlxuICAgICAqXG4gICAgICogQHR5cGUge0xpZ2h0aW5nUGFyYW1zfVxuICAgICAqL1xuICAgIGdldCBsaWdodGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpZ2h0aW5nUGFyYW1zO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgcmFuZ2UgcGFyYW1ldGVyIG9mIHRoZSBiaWxhdGVyYWwgZmlsdGVyLiBJdCdzIHVzZWQgd2hlbiB7QGxpbmsgU2NlbmUjbGlnaHRtYXBGaWx0ZXJFbmFibGVkfVxuICAgICAqIGlzIGVuYWJsZWQuIExhcmdlciB2YWx1ZSBhcHBsaWVzIG1vcmUgd2lkZXNwcmVhZCBibHVyLiBUaGlzIG5lZWRzIHRvIGJlIGEgcG9zaXRpdmUgbm9uLXplcm9cbiAgICAgKiB2YWx1ZS4gRGVmYXVsdHMgdG8gMTAuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcEZpbHRlclJhbmdlKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xpZ2h0bWFwRmlsdGVyUmFuZ2UgPSBNYXRoLm1heCh2YWx1ZSwgMC4wMDEpO1xuICAgIH1cblxuICAgIGdldCBsaWdodG1hcEZpbHRlclJhbmdlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBGaWx0ZXJSYW5nZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBIHNwYXRpYWwgcGFyYW1ldGVyIG9mIHRoZSBiaWxhdGVyYWwgZmlsdGVyLiBJdCdzIHVzZWQgd2hlbiB7QGxpbmsgU2NlbmUjbGlnaHRtYXBGaWx0ZXJFbmFibGVkfVxuICAgICAqIGlzIGVuYWJsZWQuIExhcmdlciB2YWx1ZSBibHVycyBsZXNzIHNpbWlsYXIgY29sb3JzLiBUaGlzIG5lZWRzIHRvIGJlIGEgcG9zaXRpdmUgbm9uLXplcm9cbiAgICAgKiB2YWx1ZS4gRGVmYXVsdHMgdG8gMC4yLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xpZ2h0bWFwRmlsdGVyU21vb3RobmVzcyA9IE1hdGgubWF4KHZhbHVlLCAwLjAwMSk7XG4gICAgfVxuXG4gICAgZ2V0IGxpZ2h0bWFwRmlsdGVyU21vb3RobmVzcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpZ2h0bWFwRmlsdGVyU21vb3RobmVzcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgb2YgNiBwcmVmaWx0ZXJlZCBjdWJlbWFwcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlW119XG4gICAgICovXG4gICAgc2V0IHByZWZpbHRlcmVkQ3ViZW1hcHModmFsdWUpIHtcbiAgICAgICAgdmFsdWUgPSB2YWx1ZSB8fCBbXTtcbiAgICAgICAgY29uc3QgY3ViZW1hcHMgPSB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzO1xuICAgICAgICBjb25zdCBjaGFuZ2VkID0gY3ViZW1hcHMubGVuZ3RoICE9PSB2YWx1ZS5sZW5ndGggfHwgY3ViZW1hcHMuc29tZSgoYywgaSkgPT4gYyAhPT0gdmFsdWVbaV0pO1xuXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wbGV0ZSA9IHZhbHVlLmxlbmd0aCA9PT0gNiAmJiB2YWx1ZS5ldmVyeShjID0+ICEhYyk7XG5cbiAgICAgICAgICAgIGlmIChjb21wbGV0ZSkge1xuICAgICAgICAgICAgICAgIC8vIHVwZGF0ZSBlbnYgYXRsYXNcbiAgICAgICAgICAgICAgICB0aGlzLl9pbnRlcm5hbEVudkF0bGFzID0gRW52TGlnaHRpbmcuZ2VuZXJhdGVQcmVmaWx0ZXJlZEF0bGFzKHZhbHVlLCB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldDogdGhpcy5faW50ZXJuYWxFbnZBdGxhc1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fZW52QXRsYXMgPSB0aGlzLl9pbnRlcm5hbEVudkF0bGFzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faW50ZXJuYWxFbnZBdGxhcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9pbnRlcm5hbEVudkF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5faW50ZXJuYWxFbnZBdGxhcyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuX2VudkF0bGFzID0gbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcyA9IHZhbHVlLnNsaWNlKCk7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHByZWZpbHRlcmVkQ3ViZW1hcHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9wcmVmaWx0ZXJlZEN1YmVtYXBzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBiYXNlIGN1YmVtYXAgdGV4dHVyZSB1c2VkIGFzIHRoZSBzY2VuZSdzIHNreWJveCwgaWYgbWlwIGxldmVsIGlzIDAuIERlZmF1bHRzIHRvIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZX1cbiAgICAgKi9cbiAgICBzZXQgc2t5Ym94KHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fc2t5Ym94Q3ViZU1hcCkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94Q3ViZU1hcCA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcmVzZXRTa3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBza3lib3goKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9za3lib3hDdWJlTWFwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE11bHRpcGxpZXIgZm9yIHNreWJveCBpbnRlbnNpdHkuIERlZmF1bHRzIHRvIDEuIFVudXNlZCBpZiBwaHlzaWNhbCB1bml0cyBhcmUgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNreWJveEludGVuc2l0eSh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX3NreWJveEludGVuc2l0eSkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94SW50ZW5zaXR5ID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNreWJveEludGVuc2l0eSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NreWJveEludGVuc2l0eTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMdW1pbmFuY2UgKGluIGxtL21eMikgb2Ygc2t5Ym94LiBEZWZhdWx0cyB0byAwLiBPbmx5IHVzZWQgaWYgcGh5c2ljYWwgdW5pdHMgYXJlIHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBza3lib3hMdW1pbmFuY2UodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9za3lib3hMdW1pbmFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX3NreWJveEx1bWluYW5jZSA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy5fcmVzZXRTa3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBza3lib3hMdW1pbmFuY2UoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9za3lib3hMdW1pbmFuY2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1pcCBsZXZlbCBvZiB0aGUgc2t5Ym94IHRvIGJlIGRpc3BsYXllZC4gT25seSB2YWxpZCBmb3IgcHJlZmlsdGVyZWQgY3ViZW1hcCBza3lib3hlcy5cbiAgICAgKiBEZWZhdWx0cyB0byAwIChiYXNlIGxldmVsKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHNreWJveE1pcCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX3NreWJveE1pcCkge1xuICAgICAgICAgICAgdGhpcy5fc2t5Ym94TWlwID0gdmFsdWU7XG4gICAgICAgICAgICB0aGlzLl9yZXNldFNreSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHNreWJveE1pcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NreWJveE1pcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcm90YXRpb24gb2YgdGhlIHNreWJveCB0byBiZSBkaXNwbGF5ZWQuIERlZmF1bHRzIHRvIHtAbGluayBRdWF0LklERU5USVRZfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtRdWF0fVxuICAgICAqL1xuICAgIHNldCBza3lib3hSb3RhdGlvbih2YWx1ZSkge1xuICAgICAgICBpZiAoIXRoaXMuX3NreWJveFJvdGF0aW9uLmVxdWFscyh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uLmNvcHkodmFsdWUpO1xuICAgICAgICAgICAgaWYgKHZhbHVlLmVxdWFscyhRdWF0LklERU5USVRZKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NreWJveFJvdGF0aW9uTWF0My5zZXRJZGVudGl0eSgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hSb3RhdGlvbk1hdDQuc2V0VFJTKFZlYzMuWkVSTywgdmFsdWUsIFZlYzMuT05FKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9za3lib3hSb3RhdGlvbk1hdDQuaW52ZXJ0VG8zeDModGhpcy5fc2t5Ym94Um90YXRpb25NYXQzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0U2t5KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2t5Ym94Um90YXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9za3lib3hSb3RhdGlvbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdG9uZW1hcHBpbmcgdHJhbnNmb3JtIHRvIGFwcGx5IHdoZW4gd3JpdGluZyBmcmFnbWVudHMgdG8gdGhlIGZyYW1lIGJ1ZmZlci4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9MSU5FQVJ9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9GSUxNSUN9XG4gICAgICogLSB7QGxpbmsgVE9ORU1BUF9IRUpMfVxuICAgICAqIC0ge0BsaW5rIFRPTkVNQVBfQUNFU31cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBUT05FTUFQX0xJTkVBUn0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCB0b25lTWFwcGluZyh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX3RvbmVNYXBwaW5nKSB7XG4gICAgICAgICAgICB0aGlzLl90b25lTWFwcGluZyA9IHZhbHVlO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTaGFkZXJzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0b25lTWFwcGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3RvbmVNYXBwaW5nO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX3Jlc2V0U2t5KCk7XG4gICAgICAgIHRoaXMucm9vdCA9IG51bGw7XG4gICAgICAgIHRoaXMub2ZmKCk7XG4gICAgfVxuXG4gICAgZHJhd0xpbmUoc3RhcnQsIGVuZCwgY29sb3IgPSBDb2xvci5XSElURSwgZGVwdGhUZXN0ID0gdHJ1ZSwgbGF5ZXIgPSB0aGlzLmRlZmF1bHREcmF3TGF5ZXIpIHtcbiAgICAgICAgY29uc3QgYmF0Y2ggPSB0aGlzLmltbWVkaWF0ZS5nZXRCYXRjaChsYXllciwgZGVwdGhUZXN0KTtcbiAgICAgICAgYmF0Y2guYWRkTGluZXMoW3N0YXJ0LCBlbmRdLCBbY29sb3IsIGNvbG9yXSk7XG4gICAgfVxuXG4gICAgZHJhd0xpbmVzKHBvc2l0aW9ucywgY29sb3JzLCBkZXB0aFRlc3QgPSB0cnVlLCBsYXllciA9IHRoaXMuZGVmYXVsdERyYXdMYXllcikge1xuICAgICAgICBjb25zdCBiYXRjaCA9IHRoaXMuaW1tZWRpYXRlLmdldEJhdGNoKGxheWVyLCBkZXB0aFRlc3QpO1xuICAgICAgICBiYXRjaC5hZGRMaW5lcyhwb3NpdGlvbnMsIGNvbG9ycyk7XG4gICAgfVxuXG4gICAgZHJhd0xpbmVBcnJheXMocG9zaXRpb25zLCBjb2xvcnMsIGRlcHRoVGVzdCA9IHRydWUsIGxheWVyID0gdGhpcy5kZWZhdWx0RHJhd0xheWVyKSB7XG4gICAgICAgIGNvbnN0IGJhdGNoID0gdGhpcy5pbW1lZGlhdGUuZ2V0QmF0Y2gobGF5ZXIsIGRlcHRoVGVzdCk7XG4gICAgICAgIGJhdGNoLmFkZExpbmVzQXJyYXlzKHBvc2l0aW9ucywgY29sb3JzKTtcbiAgICB9XG5cbiAgICBhcHBseVNldHRpbmdzKHNldHRpbmdzKSB7XG4gICAgICAgIGNvbnN0IHBoeXNpY3MgPSBzZXR0aW5ncy5waHlzaWNzO1xuICAgICAgICBjb25zdCByZW5kZXIgPSBzZXR0aW5ncy5yZW5kZXI7XG5cbiAgICAgICAgLy8gc2V0dGluZ3NcbiAgICAgICAgdGhpcy5fZ3Jhdml0eS5zZXQocGh5c2ljcy5ncmF2aXR5WzBdLCBwaHlzaWNzLmdyYXZpdHlbMV0sIHBoeXNpY3MuZ3Jhdml0eVsyXSk7XG4gICAgICAgIHRoaXMuYW1iaWVudExpZ2h0LnNldChyZW5kZXIuZ2xvYmFsX2FtYmllbnRbMF0sIHJlbmRlci5nbG9iYWxfYW1iaWVudFsxXSwgcmVuZGVyLmdsb2JhbF9hbWJpZW50WzJdKTtcbiAgICAgICAgdGhpcy5hbWJpZW50THVtaW5hbmNlID0gcmVuZGVyLmFtYmllbnRMdW1pbmFuY2U7XG4gICAgICAgIHRoaXMuX2ZvZyA9IHJlbmRlci5mb2c7XG4gICAgICAgIHRoaXMuZm9nQ29sb3Iuc2V0KHJlbmRlci5mb2dfY29sb3JbMF0sIHJlbmRlci5mb2dfY29sb3JbMV0sIHJlbmRlci5mb2dfY29sb3JbMl0pO1xuICAgICAgICB0aGlzLmZvZ1N0YXJ0ID0gcmVuZGVyLmZvZ19zdGFydDtcbiAgICAgICAgdGhpcy5mb2dFbmQgPSByZW5kZXIuZm9nX2VuZDtcbiAgICAgICAgdGhpcy5mb2dEZW5zaXR5ID0gcmVuZGVyLmZvZ19kZW5zaXR5O1xuICAgICAgICB0aGlzLl9nYW1tYUNvcnJlY3Rpb24gPSByZW5kZXIuZ2FtbWFfY29ycmVjdGlvbjtcbiAgICAgICAgdGhpcy5fdG9uZU1hcHBpbmcgPSByZW5kZXIudG9uZW1hcHBpbmc7XG4gICAgICAgIHRoaXMubGlnaHRtYXBTaXplTXVsdGlwbGllciA9IHJlbmRlci5saWdodG1hcFNpemVNdWx0aXBsaWVyO1xuICAgICAgICB0aGlzLmxpZ2h0bWFwTWF4UmVzb2x1dGlvbiA9IHJlbmRlci5saWdodG1hcE1heFJlc29sdXRpb247XG4gICAgICAgIHRoaXMubGlnaHRtYXBNb2RlID0gcmVuZGVyLmxpZ2h0bWFwTW9kZTtcbiAgICAgICAgdGhpcy5leHBvc3VyZSA9IHJlbmRlci5leHBvc3VyZTtcbiAgICAgICAgdGhpcy5fc2t5Ym94SW50ZW5zaXR5ID0gcmVuZGVyLnNreWJveEludGVuc2l0eSA/PyAxO1xuICAgICAgICB0aGlzLl9za3lib3hMdW1pbmFuY2UgPSByZW5kZXIuc2t5Ym94THVtaW5hbmNlID8/IDIwMDAwO1xuICAgICAgICB0aGlzLl9za3lib3hNaXAgPSByZW5kZXIuc2t5Ym94TWlwID8/IDA7XG5cbiAgICAgICAgaWYgKHJlbmRlci5za3lib3hSb3RhdGlvbikge1xuICAgICAgICAgICAgdGhpcy5za3lib3hSb3RhdGlvbiA9IChuZXcgUXVhdCgpKS5zZXRGcm9tRXVsZXJBbmdsZXMocmVuZGVyLnNreWJveFJvdGF0aW9uWzBdLCByZW5kZXIuc2t5Ym94Um90YXRpb25bMV0sIHJlbmRlci5za3lib3hSb3RhdGlvblsyXSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNsdXN0ZXJlZExpZ2h0aW5nRW5hYmxlZCA9IHJlbmRlci5jbHVzdGVyZWRMaWdodGluZ0VuYWJsZWQ7XG4gICAgICAgIHRoaXMubGlnaHRpbmcuYXBwbHlTZXR0aW5ncyhyZW5kZXIpO1xuXG4gICAgICAgIC8vIGJha2Ugc2V0dGluZ3NcbiAgICAgICAgW1xuICAgICAgICAgICAgJ2xpZ2h0bWFwRmlsdGVyRW5hYmxlZCcsXG4gICAgICAgICAgICAnbGlnaHRtYXBGaWx0ZXJSYW5nZScsXG4gICAgICAgICAgICAnbGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzJyxcbiAgICAgICAgICAgICdhbWJpZW50QmFrZScsXG4gICAgICAgICAgICAnYW1iaWVudEJha2VOdW1TYW1wbGVzJyxcbiAgICAgICAgICAgICdhbWJpZW50QmFrZVNwaGVyZVBhcnQnLFxuICAgICAgICAgICAgJ2FtYmllbnRCYWtlT2NjbHVzaW9uQnJpZ2h0bmVzcycsXG4gICAgICAgICAgICAnYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdCdcbiAgICAgICAgXS5mb3JFYWNoKChzZXR0aW5nKSA9PiB7XG4gICAgICAgICAgICBpZiAocmVuZGVyLmhhc093blByb3BlcnR5KHNldHRpbmcpKSB7XG4gICAgICAgICAgICAgICAgdGhpc1tzZXR0aW5nXSA9IHJlbmRlcltzZXR0aW5nXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5fcmVzZXRTa3koKTtcbiAgICB9XG5cbiAgICAvLyBnZXQgdGhlIGFjdHVhbCB0ZXh0dXJlIHRvIHVzZSBmb3Igc2t5Ym94IHJlbmRlcmluZ1xuICAgIF9nZXRTa3lib3hUZXgoKSB7XG4gICAgICAgIGNvbnN0IGN1YmVtYXBzID0gdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcztcblxuICAgICAgICBpZiAodGhpcy5fc2t5Ym94TWlwKSB7XG4gICAgICAgICAgICAvLyBza3lib3ggc2VsZWN0aW9uIGZvciBzb21lIHJlYXNvbiBoYXMgYWx3YXlzIHNraXBwZWQgdGhlIDMyeDMyIHByZWZpbHRlcmVkIG1pcG1hcCwgcHJlc3VtYWJseSBhIGJ1Zy5cbiAgICAgICAgICAgIC8vIHdlIGNhbid0IHNpbXBseSBmaXggdGhpcyBhbmQgbWFwIDMgdG8gdGhlIGNvcnJlY3QgbGV2ZWwsIHNpbmNlIGRvaW5nIHNvIGhhcyB0aGUgcG90ZW50aWFsXG4gICAgICAgICAgICAvLyB0byBjaGFuZ2UgdGhlIGxvb2sgb2YgZXhpc3Rpbmcgc2NlbmVzIGRyYW1hdGljYWxseS5cbiAgICAgICAgICAgIC8vIE5PVEU6IHRoZSB0YWJsZSBza2lwcyB0aGUgMzJ4MzIgbWlwbWFwXG4gICAgICAgICAgICBjb25zdCBza3lib3hNYXBwaW5nID0gWzAsIDEsIC8qIDIgKi8gMywgNCwgNSwgNl07XG5cbiAgICAgICAgICAgIC8vIHNlbGVjdCBibHVycnkgdGV4dHVyZSBmb3IgdXNlIG9uIHRoZSBza3lib3hcbiAgICAgICAgICAgIHJldHVybiBjdWJlbWFwc1tza3lib3hNYXBwaW5nW3RoaXMuX3NreWJveE1pcF1dIHx8IHRoaXMuX2VudkF0bGFzIHx8IGN1YmVtYXBzWzBdIHx8IHRoaXMuX3NreWJveEN1YmVNYXA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fc2t5Ym94Q3ViZU1hcCB8fCBjdWJlbWFwc1swXSB8fCB0aGlzLl9lbnZBdGxhcztcbiAgICB9XG5cbiAgICBfdXBkYXRlU2t5KGRldmljZSkge1xuICAgICAgICBpZiAoIXRoaXMuc2t5KSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlID0gdGhpcy5fZ2V0U2t5Ym94VGV4KCk7XG4gICAgICAgICAgICBpZiAodGV4dHVyZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2t5ID0gbmV3IFNreShkZXZpY2UsIHRoaXMsIHRleHR1cmUpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlyZSgnc2V0OnNreWJveCcsIHRleHR1cmUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3Jlc2V0U2t5KCkge1xuICAgICAgICB0aGlzLnNreT8uZGVzdHJveSgpO1xuICAgICAgICB0aGlzLnNreSA9IG51bGw7XG4gICAgICAgIHRoaXMudXBkYXRlU2hhZGVycyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0cyB0aGUgY3ViZW1hcCBmb3IgdGhlIHNjZW5lIHNreWJveC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJykuVGV4dHVyZVtdfSBbY3ViZW1hcHNdIC0gQW4gYXJyYXkgb2ZcbiAgICAgKiBjdWJlbWFwcyBjb3JyZXNwb25kaW5nIHRvIHRoZSBza3lib3ggYXQgZGlmZmVyZW50IG1pcCBsZXZlbHMuIElmIHVuZGVmaW5lZCwgc2NlbmUgd2lsbFxuICAgICAqIHJlbW92ZSBza3lib3guIEN1YmVtYXAgYXJyYXkgc2hvdWxkIGJlIG9mIHNpemUgNywgd2l0aCB0aGUgZmlyc3QgZWxlbWVudCAoaW5kZXggMClcbiAgICAgKiBjb3JyZXNwb25kaW5nIHRvIHRoZSBiYXNlIGN1YmVtYXAgKG1pcCBsZXZlbCAwKSB3aXRoIG9yaWdpbmFsIHJlc29sdXRpb24uIEVhY2ggcmVtYWluaW5nXG4gICAgICogZWxlbWVudCAoaW5kZXggMS02KSBjb3JyZXNwb25kcyB0byBhIGZpeGVkIHByZWZpbHRlcmVkIHJlc29sdXRpb24gKDEyOHgxMjgsIDY0eDY0LCAzMngzMixcbiAgICAgKiAxNngxNiwgOHg4LCA0eDQpLlxuICAgICAqL1xuICAgIHNldFNreWJveChjdWJlbWFwcykge1xuICAgICAgICBpZiAoIWN1YmVtYXBzKSB7XG4gICAgICAgICAgICB0aGlzLnNreWJveCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLmVudkF0bGFzID0gbnVsbDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuc2t5Ym94ID0gY3ViZW1hcHNbMF0gfHwgbnVsbDtcbiAgICAgICAgICAgIGlmIChjdWJlbWFwc1sxXSAmJiAhY3ViZW1hcHNbMV0uY3ViZW1hcCkge1xuICAgICAgICAgICAgICAgIC8vIHByZWZpbHRlcmVkIGRhdGEgaXMgYW4gZW52IGF0bGFzXG4gICAgICAgICAgICAgICAgdGhpcy5lbnZBdGxhcyA9IGN1YmVtYXBzWzFdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBwcmVmaWx0ZXJlZCBkYXRhIGlzIGEgc2V0IG9mIGN1YmVtYXBzXG4gICAgICAgICAgICAgICAgdGhpcy5wcmVmaWx0ZXJlZEN1YmVtYXBzID0gY3ViZW1hcHMuc2xpY2UoMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbGlnaHRtYXAgcGl4ZWwgZm9ybWF0LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBnZXQgbGlnaHRtYXBQaXhlbEZvcm1hdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGlnaHRtYXBIRFIgJiYgdGhpcy5kZXZpY2UuZ2V0SGRyRm9ybWF0KGZhbHNlLCB0cnVlLCBmYWxzZSwgdHJ1ZSkgfHwgUElYRUxGT1JNQVRfUkdCQTg7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTY2VuZSB9O1xuIl0sIm5hbWVzIjpbIlNjZW5lIiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImFtYmllbnRCYWtlIiwiYW1iaWVudEJha2VPY2NsdXNpb25CcmlnaHRuZXNzIiwiYW1iaWVudEJha2VPY2NsdXNpb25Db250cmFzdCIsImFtYmllbnRMaWdodCIsIkNvbG9yIiwiYW1iaWVudEx1bWluYW5jZSIsImV4cG9zdXJlIiwiZm9nQ29sb3IiLCJmb2dEZW5zaXR5IiwiZm9nRW5kIiwiZm9nU3RhcnQiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwibGlnaHRtYXBNYXhSZXNvbHV0aW9uIiwibGlnaHRtYXBNb2RlIiwiQkFLRV9DT0xPUkRJUiIsImxpZ2h0bWFwRmlsdGVyRW5hYmxlZCIsImxpZ2h0bWFwSERSIiwicm9vdCIsInNreSIsInBoeXNpY2FsVW5pdHMiLCJEZWJ1ZyIsImFzc2VydERlcHJlY2F0ZWQiLCJkZXZpY2UiLCJHcmFwaGljc0RldmljZUFjY2VzcyIsImdldCIsIl9ncmF2aXR5IiwiVmVjMyIsIl9sYXllcnMiLCJfZm9nIiwiRk9HX05PTkUiLCJfZ2FtbWFDb3JyZWN0aW9uIiwiR0FNTUFfU1JHQiIsIl90b25lTWFwcGluZyIsIl9za3lib3hDdWJlTWFwIiwiX3ByZWZpbHRlcmVkQ3ViZW1hcHMiLCJfZW52QXRsYXMiLCJfaW50ZXJuYWxFbnZBdGxhcyIsIl9za3lib3hJbnRlbnNpdHkiLCJfc2t5Ym94THVtaW5hbmNlIiwiX3NreWJveE1pcCIsIl9za3lib3hSb3RhdGlvbiIsIlF1YXQiLCJfc2t5Ym94Um90YXRpb25NYXQzIiwiTWF0MyIsIl9za3lib3hSb3RhdGlvbk1hdDQiLCJNYXQ0IiwiX2FtYmllbnRCYWtlTnVtU2FtcGxlcyIsIl9hbWJpZW50QmFrZVNwaGVyZVBhcnQiLCJfbGlnaHRtYXBGaWx0ZXJSYW5nZSIsIl9saWdodG1hcEZpbHRlclNtb290aG5lc3MiLCJfY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwiX2xpZ2h0aW5nUGFyYW1zIiwiTGlnaHRpbmdQYXJhbXMiLCJzdXBwb3J0c0FyZWFMaWdodHMiLCJtYXhUZXh0dXJlU2l6ZSIsIl9kaXJ0eUxpZ2h0cyIsIl9zdGF0cyIsIm1lc2hJbnN0YW5jZXMiLCJsaWdodHMiLCJkeW5hbWljTGlnaHRzIiwiYmFrZWRMaWdodHMiLCJsYXN0U3RhdGljUHJlcGFyZUZ1bGxUaW1lIiwibGFzdFN0YXRpY1ByZXBhcmVTZWFyY2hUaW1lIiwibGFzdFN0YXRpY1ByZXBhcmVXcml0ZVRpbWUiLCJsYXN0U3RhdGljUHJlcGFyZVRyaUFhYmJUaW1lIiwibGFzdFN0YXRpY1ByZXBhcmVDb21iaW5lVGltZSIsInVwZGF0ZVNoYWRlcnNUaW1lIiwidXBkYXRlU2hhZGVycyIsIl9zaGFkZXJWZXJzaW9uIiwiX3N0YXRzVXBkYXRlZCIsImltbWVkaWF0ZSIsIkltbWVkaWF0ZSIsImRlZmF1bHREcmF3TGF5ZXIiLCJsYXllcnMiLCJnZXRMYXllckJ5SWQiLCJMQVlFUklEX0lNTUVESUFURSIsImFtYmllbnRCYWtlTnVtU2FtcGxlcyIsInZhbHVlIiwibWF0aCIsImNsYW1wIiwiTWF0aCIsImZsb29yIiwiYW1iaWVudEJha2VTcGhlcmVQYXJ0IiwiY2x1c3RlcmVkTGlnaHRpbmdFbmFibGVkIiwiY29uc29sZSIsImVycm9yIiwiZHJhd0NhbGxzIiwiX21lc2hJbnN0YW5jZXMiLCJsZW5ndGgiLCJfdXBkYXRlIiwiZW52QXRsYXMiLCJhZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsImFkZHJlc3NWIiwibWluRmlsdGVyIiwiRklMVEVSX0xJTkVBUiIsIm1hZ0ZpbHRlciIsIm1pcG1hcHMiLCJkZXN0cm95IiwiX3Jlc2V0U2t5IiwiZm9nIiwidHlwZSIsImdhbW1hQ29ycmVjdGlvbiIsInByZXYiLCJmaXJlIiwibGlnaHRpbmciLCJsaWdodG1hcEZpbHRlclJhbmdlIiwibWF4IiwibGlnaHRtYXBGaWx0ZXJTbW9vdGhuZXNzIiwicHJlZmlsdGVyZWRDdWJlbWFwcyIsImN1YmVtYXBzIiwiY2hhbmdlZCIsInNvbWUiLCJjIiwiaSIsImNvbXBsZXRlIiwiZXZlcnkiLCJFbnZMaWdodGluZyIsImdlbmVyYXRlUHJlZmlsdGVyZWRBdGxhcyIsInRhcmdldCIsInNsaWNlIiwic2t5Ym94Iiwic2t5Ym94SW50ZW5zaXR5Iiwic2t5Ym94THVtaW5hbmNlIiwic2t5Ym94TWlwIiwic2t5Ym94Um90YXRpb24iLCJlcXVhbHMiLCJjb3B5IiwiSURFTlRJVFkiLCJzZXRJZGVudGl0eSIsInNldFRSUyIsIlpFUk8iLCJPTkUiLCJpbnZlcnRUbzN4MyIsInRvbmVNYXBwaW5nIiwib2ZmIiwiZHJhd0xpbmUiLCJzdGFydCIsImVuZCIsImNvbG9yIiwiV0hJVEUiLCJkZXB0aFRlc3QiLCJsYXllciIsImJhdGNoIiwiZ2V0QmF0Y2giLCJhZGRMaW5lcyIsImRyYXdMaW5lcyIsInBvc2l0aW9ucyIsImNvbG9ycyIsImRyYXdMaW5lQXJyYXlzIiwiYWRkTGluZXNBcnJheXMiLCJhcHBseVNldHRpbmdzIiwic2V0dGluZ3MiLCJfcmVuZGVyJHNreWJveEludGVuc2kiLCJfcmVuZGVyJHNreWJveEx1bWluYW4iLCJfcmVuZGVyJHNreWJveE1pcCIsInBoeXNpY3MiLCJyZW5kZXIiLCJzZXQiLCJncmF2aXR5IiwiZ2xvYmFsX2FtYmllbnQiLCJmb2dfY29sb3IiLCJmb2dfc3RhcnQiLCJmb2dfZW5kIiwiZm9nX2RlbnNpdHkiLCJnYW1tYV9jb3JyZWN0aW9uIiwidG9uZW1hcHBpbmciLCJzZXRGcm9tRXVsZXJBbmdsZXMiLCJmb3JFYWNoIiwic2V0dGluZyIsImhhc093blByb3BlcnR5IiwiX2dldFNreWJveFRleCIsInNreWJveE1hcHBpbmciLCJfdXBkYXRlU2t5IiwidGV4dHVyZSIsIlNreSIsIl90aGlzJHNreSIsInNldFNreWJveCIsImN1YmVtYXAiLCJsaWdodG1hcFBpeGVsRm9ybWF0IiwiZ2V0SGRyRm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTgiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7QUFrQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsS0FBSyxTQUFTQyxZQUFZLENBQUM7QUFtSjdCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVdBLENBQUNDLGNBQWMsRUFBRTtBQUN4QixJQUFBLEtBQUssRUFBRSxDQUFBO0FBMUpYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUxJLElBTUFDLENBQUFBLFdBQVcsR0FBRyxLQUFLLENBQUE7QUFFbkI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBTEksSUFNQUMsQ0FBQUEsOEJBQThCLEdBQUcsQ0FBQyxDQUFBO0FBRWpDO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUxLLElBTURDLENBQUFBLDRCQUE0QixHQUFHLENBQUMsQ0FBQTtBQUVoQztBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsWUFBWSxHQUFHLElBQUlDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBRWpDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxnQkFBZ0IsR0FBRyxDQUFDLENBQUE7QUFFcEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFFBQVEsR0FBRyxDQUFDLENBQUE7QUFFWjtBQUNKO0FBQ0E7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
