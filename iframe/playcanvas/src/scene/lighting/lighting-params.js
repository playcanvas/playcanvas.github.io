import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { SHADOW_PCF3 } from '../constants.js';

class LightingParams {
  constructor(supportsAreaLights, maxTextureSize, dirtyLightsFnc) {
    this._areaLightsEnabled = false;
    this._cells = new Vec3(10, 3, 10);
    this._maxLightsPerCell = 255;
    this._shadowsEnabled = true;
    this._shadowType = SHADOW_PCF3;
    this._shadowAtlasResolution = 2048;
    this._cookiesEnabled = false;
    this._cookieAtlasResolution = 2048;
    this.debugLayer = void 0;
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
  set cells(value) {
    this._cells.copy(value);
  }
  get cells() {
    return this._cells;
  }
  set maxLightsPerCell(value) {
    this._maxLightsPerCell = math.clamp(value, 1, 255);
  }
  get maxLightsPerCell() {
    return this._maxLightsPerCell;
  }
  set cookieAtlasResolution(value) {
    this._cookieAtlasResolution = math.clamp(value, 32, this._maxTextureSize);
  }
  get cookieAtlasResolution() {
    return this._cookieAtlasResolution;
  }
  set shadowAtlasResolution(value) {
    this._shadowAtlasResolution = math.clamp(value, 32, this._maxTextureSize);
  }
  get shadowAtlasResolution() {
    return this._shadowAtlasResolution;
  }
  set shadowType(value) {
    if (this._shadowType !== value) {
      this._shadowType = value;
      this._dirtyLightsFnc();
    }
  }
  get shadowType() {
    return this._shadowType;
  }
  set cookiesEnabled(value) {
    if (this._cookiesEnabled !== value) {
      this._cookiesEnabled = value;
      this._dirtyLightsFnc();
    }
  }
  get cookiesEnabled() {
    return this._cookiesEnabled;
  }
  set areaLightsEnabled(value) {
    if (this._supportsAreaLights) {
      if (this._areaLightsEnabled !== value) {
        this._areaLightsEnabled = value;
        this._dirtyLightsFnc();
      }
    }
  }
  get areaLightsEnabled() {
    return this._areaLightsEnabled;
  }
  set shadowsEnabled(value) {
    if (this._shadowsEnabled !== value) {
      this._shadowsEnabled = value;
      this._dirtyLightsFnc();
    }
  }
  get shadowsEnabled() {
    return this._shadowsEnabled;
  }
}

export { LightingParams };
