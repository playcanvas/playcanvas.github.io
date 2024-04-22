import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { SHADOW_PCF3 } from '../constants.js';

/**
 * Lighting parameters, allow configuration of the global lighting parameters. For details see
 * [Clustered Lighting](https://developer.playcanvas.com/user-manual/graphics/lighting/clustered-lighting/).
 *
 * @category Graphics
 */
class LightingParams {
  /**
   * Creates a new LightingParams object.
   *
   * @ignore
   */
  constructor(supportsAreaLights, maxTextureSize, dirtyLightsFnc) {
    /** @private */
    this._areaLightsEnabled = false;
    /** @private */
    this._cells = new Vec3(10, 3, 10);
    /** @private */
    this._maxLightsPerCell = 255;
    /** @private */
    this._shadowsEnabled = true;
    /** @private */
    this._shadowType = SHADOW_PCF3;
    /** @private */
    this._shadowAtlasResolution = 2048;
    /** @private */
    this._cookiesEnabled = false;
    /** @private */
    this._cookieAtlasResolution = 2048;
    /**
     * Layer ID of a layer to contain the debug rendering of clustered lighting. Defaults to
     * undefined, which disables the debug rendering. Debug rendering is only included in the debug
     * version of the engine.
     *
     * @type {number}
     */
    this.debugLayer = void 0;
    /**
     * Atlas textures split description, which applies to both the shadow and cookie texture atlas.
     * Defaults to null, which enables to automatic split mode. For details see [Configuring Atlas
     * Split](https://developer.playcanvas.com/user-manual/graphics/lighting/clustered-lighting/#configuring-atlas).
     *
     * @type {number[]|null}
     */
    this.atlasSplit = null;
    this._supportsAreaLights = supportsAreaLights;
    this._maxTextureSize = maxTextureSize;
    this._dirtyLightsFnc = dirtyLightsFnc;
  }
  applySettings(render) {
    var _render$lightingShado, _render$lightingCooki, _render$lightingAreaL, _render$lightingShado2, _render$lightingCooki2, _render$lightingMaxLi, _render$lightingShado3;
    this.shadowsEnabled = (_render$lightingShado = render.lightingShadowsEnabled) != null ? _render$lightingShado : this.shadowsEnabled;
    this.cookiesEnabled = (_render$lightingCooki = render.lightingCookiesEnabled) != null ? _render$lightingCooki : this.cookiesEnabled;
    this.areaLightsEnabled = (_render$lightingAreaL = render.lightingAreaLightsEnabled) != null ? _render$lightingAreaL : this.areaLightsEnabled;
    this.shadowAtlasResolution = (_render$lightingShado2 = render.lightingShadowAtlasResolution) != null ? _render$lightingShado2 : this.shadowAtlasResolution;
    this.cookieAtlasResolution = (_render$lightingCooki2 = render.lightingCookieAtlasResolution) != null ? _render$lightingCooki2 : this.cookieAtlasResolution;
    this.maxLightsPerCell = (_render$lightingMaxLi = render.lightingMaxLightsPerCell) != null ? _render$lightingMaxLi : this.maxLightsPerCell;
    this.shadowType = (_render$lightingShado3 = render.lightingShadowType) != null ? _render$lightingShado3 : this.shadowType;
    if (render.lightingCells) this.cell = new Vec3(render.lightingCells);
  }

  /**
   * Number of cells along each world-space axis the space containing lights
   * is subdivided into. Defaults to Vec(10, 3, 10).
   *
   * @type {Vec3}
   */
  set cells(value) {
    this._cells.copy(value);
  }
  get cells() {
    return this._cells;
  }

  /**
   * Maximum number of lights a cell can store. Defaults to 255.
   *
   * @type {number}
   */
  set maxLightsPerCell(value) {
    this._maxLightsPerCell = math.clamp(value, 1, 255);
  }
  get maxLightsPerCell() {
    return this._maxLightsPerCell;
  }

  /**
   * Resolution of the atlas texture storing all non-directional cookie textures.
   * Defaults to 2048.
   *
   * @type {number}
   */
  set cookieAtlasResolution(value) {
    this._cookieAtlasResolution = math.clamp(value, 32, this._maxTextureSize);
  }
  get cookieAtlasResolution() {
    return this._cookieAtlasResolution;
  }

  /**
   * Resolution of the atlas texture storing all non-directional shadow textures.
   * Defaults to 2048.
   *
   * @type {number}
   */
  set shadowAtlasResolution(value) {
    this._shadowAtlasResolution = math.clamp(value, 32, this._maxTextureSize);
  }
  get shadowAtlasResolution() {
    return this._shadowAtlasResolution;
  }

  /**
   * The type of shadow filtering used by all shadows. Can be:
   *
   * - {@link SHADOW_PCF1}: PCF 1x1 sampling.
   * - {@link SHADOW_PCF3}: PCF 3x3 sampling.
   * - {@link SHADOW_PCF5}: PCF 5x5 sampling. Falls back to {@link SHADOW_PCF3} on WebGL 1.0.
   *
   * Defaults to {@link SHADOW_PCF3}
   *
   * @type {number}
   */
  set shadowType(value) {
    if (this._shadowType !== value) {
      this._shadowType = value;

      // lit shaders need to be rebuilt
      this._dirtyLightsFnc();
    }
  }
  get shadowType() {
    return this._shadowType;
  }

  /**
   * If set to true, the clustered lighting will support cookie textures.
   * Defaults to false.
   *
   * @type {boolean}
   */
  set cookiesEnabled(value) {
    if (this._cookiesEnabled !== value) {
      this._cookiesEnabled = value;

      // lit shaders need to be rebuilt
      this._dirtyLightsFnc();
    }
  }
  get cookiesEnabled() {
    return this._cookiesEnabled;
  }

  /**
   * If set to true, the clustered lighting will support area lights.
   * Defaults to false.
   *
   * @type {boolean}
   */
  set areaLightsEnabled(value) {
    // ignore if not supported
    if (this._supportsAreaLights) {
      if (this._areaLightsEnabled !== value) {
        this._areaLightsEnabled = value;

        // lit shaders need to be rebuilt
        this._dirtyLightsFnc();
      }
    }
  }
  get areaLightsEnabled() {
    return this._areaLightsEnabled;
  }

  /**
   * If set to true, the clustered lighting will support shadows.
   * Defaults to true.
   *
   * @type {boolean}
   */
  set shadowsEnabled(value) {
    if (this._shadowsEnabled !== value) {
      this._shadowsEnabled = value;

      // lit shaders need to be rebuilt
      this._dirtyLightsFnc();
    }
  }
  get shadowsEnabled() {
    return this._shadowsEnabled;
  }
}

export { LightingParams };
