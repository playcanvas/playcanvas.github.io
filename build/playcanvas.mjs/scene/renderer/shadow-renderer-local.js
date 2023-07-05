import '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { ShadowMap } from './shadow-map.js';
import { LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

class ShadowRendererLocal {
	constructor(renderer, shadowRenderer) {
		this.shadowLights = [];
		this.renderer = void 0;
		this.shadowRenderer = void 0;
		this.device = void 0;
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
	prepareLights(shadowLights, lights) {
		let shadowCamera;
		for (let i = 0; i < lights.length; i++) {
			const light = lights[i];
			if (this.shadowRenderer.needsShadowRendering(light) && light.atlasViewportAllocated) {
				shadowLights.push(light);
				for (let face = 0; face < light.numShadowFaces; face++) {
					shadowCamera = this.shadowRenderer.prepareFace(light, null, face);
				}
			}
		}
		return shadowCamera;
	}
	prepareClusteredRenderPass(renderPass, lightsSpot, lightsOmni) {
		const shadowLights = this.shadowLights;
		const shadowCamSpot = this.prepareLights(shadowLights, lightsSpot);
		const shadowCamOmni = this.prepareLights(shadowLights, lightsOmni);
		const shadowCamera = shadowCamSpot != null ? shadowCamSpot : shadowCamOmni;
		const count = shadowLights.length;
		if (count) {
			this.shadowRenderer.setupRenderPass(renderPass, shadowCamera, false);
			renderPass.execute = () => {
				for (let i = 0; i < count; i++) {
					const light = shadowLights[i];
					for (let face = 0; face < light.numShadowFaces; face++) {
						this.shadowRenderer.renderFace(light, null, face, true);
					}
				}
				shadowLights.length = 0;
			};
		}
	}
	setupNonClusteredFaceRenderPass(frameGraph, light, face, applyVsm) {
		const shadowCamera = this.shadowRenderer.prepareFace(light, null, face);
		const renderPass = new RenderPass(this.device, () => {
			this.shadowRenderer.renderFace(light, null, face, false);
		});
		this.shadowRenderer.setupRenderPass(renderPass, shadowCamera, true);
		if (applyVsm) {
			renderPass.after = () => {
				this.shadowRenderer.renderVsm(light, shadowCamera);
			};
		}
		frameGraph.addRenderPass(renderPass);
	}
	buildNonClusteredRenderPasses(frameGraph, lightsSpot, lightsOmni) {
		for (let i = 0; i < lightsSpot.length; i++) {
			const light = lightsSpot[i];
			if (this.shadowRenderer.needsShadowRendering(light)) {
				this.setupNonClusteredFaceRenderPass(frameGraph, light, 0, true);
			}
		}
		for (let i = 0; i < lightsOmni.length; i++) {
			const light = lightsOmni[i];
			if (this.shadowRenderer.needsShadowRendering(light)) {
				const faceCount = light.numShadowFaces;
				for (let face = 0; face < faceCount; face++) {
					this.setupNonClusteredFaceRenderPass(frameGraph, light, face, false);
				}
			}
		}
	}
}

export { ShadowRendererLocal };
