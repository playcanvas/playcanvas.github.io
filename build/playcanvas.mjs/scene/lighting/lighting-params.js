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
		this.shadowsEnabled = render.lightingShadowsEnabled;
		this.cookiesEnabled = render.lightingCookiesEnabled;
		this.areaLightsEnabled = render.lightingAreaLightsEnabled;
		this.shadowAtlasResolution = render.lightingShadowAtlasResolution;
		this.cookieAtlasResolution = render.lightingCookieAtlasResolution;
		this.maxLightsPerCell = render.lightingMaxLightsPerCell;
		this.shadowType = render.lightingShadowType;
		this.cell = new Vec3(render.lightingCells);
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
