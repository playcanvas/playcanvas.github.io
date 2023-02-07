/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { math } from '../../core/math/math.js';
import { ShadowMap } from './shadow-map.js';
import { LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';

class ShadowRendererLocal {
	constructor(renderer, shadowRenderer) {
		this.renderer = renderer;
		this.shadowRenderer = shadowRenderer;
		this.device = renderer.device;
	}
	cull(light, drawCalls) {
		const isClustered = this.renderer.scene.clusteredLightingEnabled;
		light.visibleThisFrame = true;
		if (!isClustered) {
			if (!light._shadowMap) {
				light._shadowMap = ShadowMap.create(this.device, light);
			}
		}
		const type = light._type;
		const faceCount = type === LIGHTTYPE_SPOT ? 1 : 6;
		for (let face = 0; face < faceCount; face++) {
			const lightRenderData = light.getRenderData(null, face);
			const shadowCam = lightRenderData.shadowCamera;
			shadowCam.nearClip = light.attenuationEnd / 1000;
			shadowCam.farClip = light.attenuationEnd;
			const shadowCamNode = shadowCam._node;
			const lightNode = light._node;
			shadowCamNode.setPosition(lightNode.getPosition());
			if (type === LIGHTTYPE_SPOT) {
				shadowCam.fov = light._outerConeAngle * 2;
				shadowCamNode.setRotation(lightNode.getRotation());
				shadowCamNode.rotateLocal(-90, 0, 0);
			} else if (type === LIGHTTYPE_OMNI) {
				if (isClustered) {
					const tileSize = this.shadowRenderer.lightTextureAtlas.shadowAtlasResolution * light.atlasViewport.z / 3;
					const texelSize = 2 / tileSize;
					const filterSize = texelSize * this.shadowRenderer.lightTextureAtlas.shadowEdgePixels;
					shadowCam.fov = Math.atan(1 + filterSize) * math.RAD_TO_DEG * 2;
				} else {
					shadowCam.fov = 90;
				}
			}
			this.renderer.updateCameraFrustum(shadowCam);
			this.shadowRenderer.cullShadowCasters(drawCalls, lightRenderData.visibleCasters, shadowCam);
		}
	}
}

export { ShadowRendererLocal };
