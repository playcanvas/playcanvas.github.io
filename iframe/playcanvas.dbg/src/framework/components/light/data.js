import { LIGHTSHAPE_PUNCTUAL, LIGHTFALLOFF_LINEAR, SHADOW_PCF3, BLUR_GAUSSIAN, SHADOWUPDATE_REALTIME, LAYERID_WORLD } from '../../../scene/constants.js';
import { Color } from '../../../core/math/color.js';

class LightComponentData {
  constructor() {
    this.enabled = true;
    /** @type {import('../../../scene/light.js').Light} */
    this.light = void 0;
    this.type = 'directional';
    this.color = new Color(1, 1, 1);
    this.intensity = 1;
    this.luminance = 0;
    this.shape = LIGHTSHAPE_PUNCTUAL;
    this.affectSpecularity = true;
    this.castShadows = false;
    this.shadowDistance = 40;
    this.shadowIntensity = 1;
    this.shadowResolution = 1024;
    this.shadowBias = 0.05;
    this.numCascades = 1;
    this.bakeNumSamples = 1;
    this.bakeArea = 0;
    this.cascadeDistribution = 0.5;
    this.normalOffsetBias = 0;
    this.range = 10;
    this.innerConeAngle = 40;
    this.outerConeAngle = 45;
    this.falloffMode = LIGHTFALLOFF_LINEAR;
    this.shadowType = SHADOW_PCF3;
    this.vsmBlurSize = 11;
    this.vsmBlurMode = BLUR_GAUSSIAN;
    this.vsmBias = 0.01 * 0.25;
    this.cookieAsset = null;
    this.cookie = null;
    this.cookieIntensity = 1;
    this.cookieFalloff = true;
    this.cookieChannel = 'rgb';
    this.cookieAngle = 0;
    this.cookieScale = null;
    this.cookieOffset = null;
    this.shadowUpdateMode = SHADOWUPDATE_REALTIME;
    this.mask = 1;
    this.affectDynamic = true;
    this.affectLightmapped = false;
    this.bake = false;
    this.bakeDir = true;
    this.isStatic = false;
    this.layers = [LAYERID_WORLD];
    this.penumbraSize = 1;
  }
}
const properties = Object.keys(new LightComponentData());

export { LightComponentData, properties };
