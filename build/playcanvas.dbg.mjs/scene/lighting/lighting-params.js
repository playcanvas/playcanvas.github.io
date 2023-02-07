/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../../core/math/vec3.js';
import { math } from '../../core/math/math.js';
import { SHADOW_PCF3 } from '../constants.js';

/**
 * Lighting parameters, allow configuration of the global lighting parameters.
 * For details see [Clustered Lighting](https://developer.playcanvas.com/en/user-manual/graphics/lighting/clustered-lighting/)
 *
 * @property {number} debugLayer Layer ID of a layer to contain the debug rendering
 * of clustered lighting. Defaults to undefined, which disables the debug rendering.
 * Debug rendering is only included in the debug version of the engine.
 *
 * @property {Array<number>|null} atlasSplit Atlas textures split description, which applies
 * to both the shadow and cookie texture atlas. Defaults to null, which enables to automatic
 * split mode. For details see [Configuring Atlas Split](https://developer.playcanvas.com/en/user-manual/graphics/lighting/clustered-lighting/#configuring-atlas)
 *
 * @hideconstructor
 */
class LightingParams {
  constructor(supportsAreaLights, maxTextureSize, dirtyLightsFnc) {
    this._maxTextureSize = maxTextureSize;
    this._supportsAreaLights = supportsAreaLights;
    this._dirtyLightsFnc = dirtyLightsFnc;
    this._areaLightsEnabled = false;
    this._cells = new Vec3(10, 3, 10);
    this._maxLightsPerCell = 255;
    this._shadowsEnabled = true;
    this._shadowType = SHADOW_PCF3;
    this._shadowAtlasResolution = 2048;
    this._cookiesEnabled = false;
    this._cookieAtlasResolution = 2048;

    // atlas split strategy
    // null: per frame split atlas into equally sized squares for each shadowmap needed
    // array: first number specifies top subdivision of the atlas, following numbers split next level (2 levels only)
    this.atlasSplit = null;

    // Layer ID of a layer for which the debug clustering is rendered
    this.debugLayer = undefined;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHRpbmctcGFyYW1zLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvbGlnaHRpbmcvbGlnaHRpbmctcGFyYW1zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFZlYzMgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjMy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgU0hBRE9XX1BDRjMgfSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG4vKipcbiAqIExpZ2h0aW5nIHBhcmFtZXRlcnMsIGFsbG93IGNvbmZpZ3VyYXRpb24gb2YgdGhlIGdsb2JhbCBsaWdodGluZyBwYXJhbWV0ZXJzLlxuICogRm9yIGRldGFpbHMgc2VlIFtDbHVzdGVyZWQgTGlnaHRpbmddKGh0dHBzOi8vZGV2ZWxvcGVyLnBsYXljYW52YXMuY29tL2VuL3VzZXItbWFudWFsL2dyYXBoaWNzL2xpZ2h0aW5nL2NsdXN0ZXJlZC1saWdodGluZy8pXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGRlYnVnTGF5ZXIgTGF5ZXIgSUQgb2YgYSBsYXllciB0byBjb250YWluIHRoZSBkZWJ1ZyByZW5kZXJpbmdcbiAqIG9mIGNsdXN0ZXJlZCBsaWdodGluZy4gRGVmYXVsdHMgdG8gdW5kZWZpbmVkLCB3aGljaCBkaXNhYmxlcyB0aGUgZGVidWcgcmVuZGVyaW5nLlxuICogRGVidWcgcmVuZGVyaW5nIGlzIG9ubHkgaW5jbHVkZWQgaW4gdGhlIGRlYnVnIHZlcnNpb24gb2YgdGhlIGVuZ2luZS5cbiAqXG4gKiBAcHJvcGVydHkge0FycmF5PG51bWJlcj58bnVsbH0gYXRsYXNTcGxpdCBBdGxhcyB0ZXh0dXJlcyBzcGxpdCBkZXNjcmlwdGlvbiwgd2hpY2ggYXBwbGllc1xuICogdG8gYm90aCB0aGUgc2hhZG93IGFuZCBjb29raWUgdGV4dHVyZSBhdGxhcy4gRGVmYXVsdHMgdG8gbnVsbCwgd2hpY2ggZW5hYmxlcyB0byBhdXRvbWF0aWNcbiAqIHNwbGl0IG1vZGUuIEZvciBkZXRhaWxzIHNlZSBbQ29uZmlndXJpbmcgQXRsYXMgU3BsaXRdKGh0dHBzOi8vZGV2ZWxvcGVyLnBsYXljYW52YXMuY29tL2VuL3VzZXItbWFudWFsL2dyYXBoaWNzL2xpZ2h0aW5nL2NsdXN0ZXJlZC1saWdodGluZy8jY29uZmlndXJpbmctYXRsYXMpXG4gKlxuICogQGhpZGVjb25zdHJ1Y3RvclxuICovXG5jbGFzcyBMaWdodGluZ1BhcmFtcyB7XG4gICAgY29uc3RydWN0b3Ioc3VwcG9ydHNBcmVhTGlnaHRzLCBtYXhUZXh0dXJlU2l6ZSwgZGlydHlMaWdodHNGbmMpIHtcbiAgICAgICAgdGhpcy5fbWF4VGV4dHVyZVNpemUgPSBtYXhUZXh0dXJlU2l6ZTtcbiAgICAgICAgdGhpcy5fc3VwcG9ydHNBcmVhTGlnaHRzID0gc3VwcG9ydHNBcmVhTGlnaHRzO1xuICAgICAgICB0aGlzLl9kaXJ0eUxpZ2h0c0ZuYyA9IGRpcnR5TGlnaHRzRm5jO1xuXG4gICAgICAgIHRoaXMuX2FyZWFMaWdodHNFbmFibGVkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fY2VsbHMgPSBuZXcgVmVjMygxMCwgMywgMTApO1xuICAgICAgICB0aGlzLl9tYXhMaWdodHNQZXJDZWxsID0gMjU1O1xuXG4gICAgICAgIHRoaXMuX3NoYWRvd3NFbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IFNIQURPV19QQ0YzO1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1Jlc29sdXRpb24gPSAyMDQ4O1xuXG4gICAgICAgIHRoaXMuX2Nvb2tpZXNFbmFibGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2Nvb2tpZUF0bGFzUmVzb2x1dGlvbiA9IDIwNDg7XG5cbiAgICAgICAgLy8gYXRsYXMgc3BsaXQgc3RyYXRlZ3lcbiAgICAgICAgLy8gbnVsbDogcGVyIGZyYW1lIHNwbGl0IGF0bGFzIGludG8gZXF1YWxseSBzaXplZCBzcXVhcmVzIGZvciBlYWNoIHNoYWRvd21hcCBuZWVkZWRcbiAgICAgICAgLy8gYXJyYXk6IGZpcnN0IG51bWJlciBzcGVjaWZpZXMgdG9wIHN1YmRpdmlzaW9uIG9mIHRoZSBhdGxhcywgZm9sbG93aW5nIG51bWJlcnMgc3BsaXQgbmV4dCBsZXZlbCAoMiBsZXZlbHMgb25seSlcbiAgICAgICAgdGhpcy5hdGxhc1NwbGl0ID0gbnVsbDtcblxuICAgICAgICAvLyBMYXllciBJRCBvZiBhIGxheWVyIGZvciB3aGljaCB0aGUgZGVidWcgY2x1c3RlcmluZyBpcyByZW5kZXJlZFxuICAgICAgICB0aGlzLmRlYnVnTGF5ZXIgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgYXBwbHlTZXR0aW5ncyhyZW5kZXIpIHtcbiAgICAgICAgdGhpcy5zaGFkb3dzRW5hYmxlZCA9IHJlbmRlci5saWdodGluZ1NoYWRvd3NFbmFibGVkO1xuICAgICAgICB0aGlzLmNvb2tpZXNFbmFibGVkID0gcmVuZGVyLmxpZ2h0aW5nQ29va2llc0VuYWJsZWQ7XG4gICAgICAgIHRoaXMuYXJlYUxpZ2h0c0VuYWJsZWQgPSByZW5kZXIubGlnaHRpbmdBcmVhTGlnaHRzRW5hYmxlZDtcbiAgICAgICAgdGhpcy5zaGFkb3dBdGxhc1Jlc29sdXRpb24gPSByZW5kZXIubGlnaHRpbmdTaGFkb3dBdGxhc1Jlc29sdXRpb247XG4gICAgICAgIHRoaXMuY29va2llQXRsYXNSZXNvbHV0aW9uID0gcmVuZGVyLmxpZ2h0aW5nQ29va2llQXRsYXNSZXNvbHV0aW9uO1xuICAgICAgICB0aGlzLm1heExpZ2h0c1BlckNlbGwgPSByZW5kZXIubGlnaHRpbmdNYXhMaWdodHNQZXJDZWxsO1xuICAgICAgICB0aGlzLnNoYWRvd1R5cGUgPSByZW5kZXIubGlnaHRpbmdTaGFkb3dUeXBlO1xuICAgICAgICB0aGlzLmNlbGwgPSBuZXcgVmVjMyhyZW5kZXIubGlnaHRpbmdDZWxscyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTnVtYmVyIG9mIGNlbGxzIGFsb25nIGVhY2ggd29ybGQtc3BhY2UgYXhpcyB0aGUgc3BhY2UgY29udGFpbmluZyBsaWdodHNcbiAgICAgKiBpcyBzdWJkaXZpZGVkIGludG8uIERlZmF1bHRzIHRvIFZlYygxMCwgMywgMTApLlxuICAgICAqXG4gICAgICogQHR5cGUge1ZlYzN9XG4gICAgICovXG4gICAgc2V0IGNlbGxzKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2NlbGxzLmNvcHkodmFsdWUpO1xuICAgIH1cblxuICAgIGdldCBjZWxscygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NlbGxzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1heGltdW0gbnVtYmVyIG9mIGxpZ2h0cyBhIGNlbGwgY2FuIHN0b3JlLiBEZWZhdWx0cyB0byAyNTUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBtYXhMaWdodHNQZXJDZWxsKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX21heExpZ2h0c1BlckNlbGwgPSBtYXRoLmNsYW1wKHZhbHVlLCAxLCAyNTUpO1xuICAgIH1cblxuICAgIGdldCBtYXhMaWdodHNQZXJDZWxsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF4TGlnaHRzUGVyQ2VsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHV0aW9uIG9mIHRoZSBhdGxhcyB0ZXh0dXJlIHN0b3JpbmcgYWxsIG5vbi1kaXJlY3Rpb25hbCBjb29raWUgdGV4dHVyZXMuXG4gICAgICogRGVmYXVsdHMgdG8gMjA0OC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGNvb2tpZUF0bGFzUmVzb2x1dGlvbih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jb29raWVBdGxhc1Jlc29sdXRpb24gPSBtYXRoLmNsYW1wKHZhbHVlLCAzMiwgdGhpcy5fbWF4VGV4dHVyZVNpemUpO1xuICAgIH1cblxuICAgIGdldCBjb29raWVBdGxhc1Jlc29sdXRpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVBdGxhc1Jlc29sdXRpb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x1dGlvbiBvZiB0aGUgYXRsYXMgdGV4dHVyZSBzdG9yaW5nIGFsbCBub24tZGlyZWN0aW9uYWwgc2hhZG93IHRleHR1cmVzLlxuICAgICAqIERlZmF1bHRzIHRvIDIwNDguXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzaGFkb3dBdGxhc1Jlc29sdXRpb24odmFsdWUpIHtcbiAgICAgICAgdGhpcy5fc2hhZG93QXRsYXNSZXNvbHV0aW9uID0gbWF0aC5jbGFtcCh2YWx1ZSwgMzIsIHRoaXMuX21heFRleHR1cmVTaXplKTtcbiAgICB9XG5cbiAgICBnZXQgc2hhZG93QXRsYXNSZXNvbHV0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fc2hhZG93QXRsYXNSZXNvbHV0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHNoYWRvdyBmaWx0ZXJpbmcgdXNlZCBieSBhbGwgc2hhZG93cy4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgU0hBRE9XX1BDRjF9OiBQQ0YgMXgxIHNhbXBsaW5nLlxuICAgICAqIC0ge0BsaW5rIFNIQURPV19QQ0YzfTogUENGIDN4MyBzYW1wbGluZy5cbiAgICAgKiAtIHtAbGluayBTSEFET1dfUENGNX06IFBDRiA1eDUgc2FtcGxpbmcuIEZhbGxzIGJhY2sgdG8ge0BsaW5rIFNIQURPV19QQ0YzfSBvbiBXZWJHTCAxLjAuXG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgU0hBRE9XX1BDRjN9XG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBzaGFkb3dUeXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dUeXBlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fc2hhZG93VHlwZSA9IHZhbHVlO1xuXG4gICAgICAgICAgICAvLyBsaXQgc2hhZGVycyBuZWVkIHRvIGJlIHJlYnVpbHRcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzRm5jKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgc2hhZG93VHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd1R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgc2V0IHRvIHRydWUsIHRoZSBjbHVzdGVyZWQgbGlnaHRpbmcgd2lsbCBzdXBwb3J0IGNvb2tpZSB0ZXh0dXJlcy5cbiAgICAgKiBEZWZhdWx0cyB0byBmYWxzZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjb29raWVzRW5hYmxlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY29va2llc0VuYWJsZWQgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9jb29raWVzRW5hYmxlZCA9IHZhbHVlO1xuXG4gICAgICAgICAgICAvLyBsaXQgc2hhZGVycyBuZWVkIHRvIGJlIHJlYnVpbHRcbiAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzRm5jKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY29va2llc0VuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jb29raWVzRW5hYmxlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgYXJlYSBsaWdodHMuXG4gICAgICogRGVmYXVsdHMgdG8gZmFsc2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgYXJlYUxpZ2h0c0VuYWJsZWQodmFsdWUpIHtcblxuICAgICAgICAvLyBpZ25vcmUgaWYgbm90IHN1cHBvcnRlZFxuICAgICAgICBpZiAodGhpcy5fc3VwcG9ydHNBcmVhTGlnaHRzKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fYXJlYUxpZ2h0c0VuYWJsZWQgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXJlYUxpZ2h0c0VuYWJsZWQgPSB2YWx1ZTtcblxuICAgICAgICAgICAgICAgIC8vIGxpdCBzaGFkZXJzIG5lZWQgdG8gYmUgcmVidWlsdFxuICAgICAgICAgICAgICAgIHRoaXMuX2RpcnR5TGlnaHRzRm5jKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXJlYUxpZ2h0c0VuYWJsZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hcmVhTGlnaHRzRW5hYmxlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNsdXN0ZXJlZCBsaWdodGluZyB3aWxsIHN1cHBvcnQgc2hhZG93cy5cbiAgICAgKiBEZWZhdWx0cyB0byB0cnVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHNoYWRvd3NFbmFibGVkKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9zaGFkb3dzRW5hYmxlZCAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3NoYWRvd3NFbmFibGVkID0gdmFsdWU7XG5cbiAgICAgICAgICAgIC8vIGxpdCBzaGFkZXJzIG5lZWQgdG8gYmUgcmVidWlsdFxuICAgICAgICAgICAgdGhpcy5fZGlydHlMaWdodHNGbmMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBzaGFkb3dzRW5hYmxlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NoYWRvd3NFbmFibGVkO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHRpbmdQYXJhbXMgfTtcbiJdLCJuYW1lcyI6WyJMaWdodGluZ1BhcmFtcyIsImNvbnN0cnVjdG9yIiwic3VwcG9ydHNBcmVhTGlnaHRzIiwibWF4VGV4dHVyZVNpemUiLCJkaXJ0eUxpZ2h0c0ZuYyIsIl9tYXhUZXh0dXJlU2l6ZSIsIl9zdXBwb3J0c0FyZWFMaWdodHMiLCJfZGlydHlMaWdodHNGbmMiLCJfYXJlYUxpZ2h0c0VuYWJsZWQiLCJfY2VsbHMiLCJWZWMzIiwiX21heExpZ2h0c1BlckNlbGwiLCJfc2hhZG93c0VuYWJsZWQiLCJfc2hhZG93VHlwZSIsIlNIQURPV19QQ0YzIiwiX3NoYWRvd0F0bGFzUmVzb2x1dGlvbiIsIl9jb29raWVzRW5hYmxlZCIsIl9jb29raWVBdGxhc1Jlc29sdXRpb24iLCJhdGxhc1NwbGl0IiwiZGVidWdMYXllciIsInVuZGVmaW5lZCIsImFwcGx5U2V0dGluZ3MiLCJyZW5kZXIiLCJzaGFkb3dzRW5hYmxlZCIsImxpZ2h0aW5nU2hhZG93c0VuYWJsZWQiLCJjb29raWVzRW5hYmxlZCIsImxpZ2h0aW5nQ29va2llc0VuYWJsZWQiLCJhcmVhTGlnaHRzRW5hYmxlZCIsImxpZ2h0aW5nQXJlYUxpZ2h0c0VuYWJsZWQiLCJzaGFkb3dBdGxhc1Jlc29sdXRpb24iLCJsaWdodGluZ1NoYWRvd0F0bGFzUmVzb2x1dGlvbiIsImNvb2tpZUF0bGFzUmVzb2x1dGlvbiIsImxpZ2h0aW5nQ29va2llQXRsYXNSZXNvbHV0aW9uIiwibWF4TGlnaHRzUGVyQ2VsbCIsImxpZ2h0aW5nTWF4TGlnaHRzUGVyQ2VsbCIsInNoYWRvd1R5cGUiLCJsaWdodGluZ1NoYWRvd1R5cGUiLCJjZWxsIiwibGlnaHRpbmdDZWxscyIsImNlbGxzIiwidmFsdWUiLCJjb3B5IiwibWF0aCIsImNsYW1wIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsY0FBYyxDQUFDO0FBQ2pCQyxFQUFBQSxXQUFXLENBQUNDLGtCQUFrQixFQUFFQyxjQUFjLEVBQUVDLGNBQWMsRUFBRTtJQUM1RCxJQUFJLENBQUNDLGVBQWUsR0FBR0YsY0FBYyxDQUFBO0lBQ3JDLElB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
