import { LIGHTTYPE_DIRECTIONAL } from '../constants.js';

class RenderAction {
	constructor() {
		this.layerIndex = 0;
		this.cameraIndex = 0;
		this.camera = null;
		this.renderTarget = null;
		this.lightClusters = null;
		this.clearColor = false;
		this.clearDepth = false;
		this.clearStencil = false;
		this.triggerPostprocess = false;
		this.firstCameraUse = false;
		this.lastCameraUse = false;
		this.directionalLightsSet = new Set();
		this.directionalLights = [];
		this.directionalLightsIndices = [];
		this.viewBindGroups = [];
	}
	destroy() {
		this.viewBindGroups.forEach(bg => {
			bg.defaultUniformBuffer.destroy();
			bg.destroy();
		});
		this.viewBindGroups.length = 0;
	}
	get hasDirectionalShadowLights() {
		return this.directionalLights.length > 0;
	}
	reset() {
		this.lightClusters = null;
		this.directionalLightsSet.clear();
		this.directionalLights.length = 0;
		this.directionalLightsIndices.length = 0;
	}
	isLayerEnabled(layerComposition) {
		const layer = layerComposition.layerList[this.layerIndex];
		return layer.enabled && layerComposition.subLayerEnabled[this.layerIndex];
	}
	collectDirectionalLights(cameraLayers, dirLights, allLights) {
		this.directionalLightsSet.clear();
		this.directionalLights.length = 0;
		this.directionalLightsIndices.length = 0;
		for (let i = 0; i < dirLights.length; i++) {
			const light = dirLights[i];
			if (light.castShadows) {
				for (let l = 0; l < cameraLayers.length; l++) {
					if (cameraLayers[l]._splitLights[LIGHTTYPE_DIRECTIONAL].indexOf(light) >= 0) {
						if (!this.directionalLightsSet.has(light)) {
							this.directionalLightsSet.add(light);
							this.directionalLights.push(light);
							const lightIndex = allLights.indexOf(light);
							this.directionalLightsIndices.push(lightIndex);
						}
					}
				}
			}
		}
	}
}

export { RenderAction };
