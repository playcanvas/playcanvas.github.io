import '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Mat4 } from '../../core/math/mat4.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME } from '../constants.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { ShadowMap } from './shadow-map.js';

const visibleSceneAabb = new BoundingBox();
const center = new Vec3();
const shadowCamView = new Mat4();
const aabbPoints = [new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3()];
const _depthRange = {
	min: 0,
	max: 0
};
function getDepthRange(cameraViewMatrix, aabbMin, aabbMax) {
	aabbPoints[0].x = aabbPoints[1].x = aabbPoints[2].x = aabbPoints[3].x = aabbMin.x;
	aabbPoints[1].y = aabbPoints[3].y = aabbPoints[7].y = aabbPoints[5].y = aabbMin.y;
	aabbPoints[2].z = aabbPoints[3].z = aabbPoints[6].z = aabbPoints[7].z = aabbMin.z;
	aabbPoints[4].x = aabbPoints[5].x = aabbPoints[6].x = aabbPoints[7].x = aabbMax.x;
	aabbPoints[0].y = aabbPoints[2].y = aabbPoints[4].y = aabbPoints[6].y = aabbMax.y;
	aabbPoints[0].z = aabbPoints[1].z = aabbPoints[4].z = aabbPoints[5].z = aabbMax.z;
	let minz = 9999999999;
	let maxz = -9999999999;
	for (let i = 0; i < 8; ++i) {
		cameraViewMatrix.transformPoint(aabbPoints[i], aabbPoints[i]);
		const z = aabbPoints[i].z;
		if (z < minz) minz = z;
		if (z > maxz) maxz = z;
	}
	_depthRange.min = minz;
	_depthRange.max = maxz;
	return _depthRange;
}
class ShadowRendererDirectional {
	constructor(renderer, shadowRenderer) {
		this.renderer = void 0;
		this.shadowRenderer = void 0;
		this.device = void 0;
		this.renderer = renderer;
		this.shadowRenderer = shadowRenderer;
		this.device = renderer.device;
	}
	cull(light, drawCalls, camera) {
		light.visibleThisFrame = true;
		if (!light._shadowMap) {
			light._shadowMap = ShadowMap.create(this.device, light);
		}
		const nearDist = camera._nearClip;
		this.generateSplitDistances(light, nearDist, Math.min(camera._farClip, light.shadowDistance));
		const shadowUpdateOverrides = light.shadowUpdateOverrides;
		for (let cascade = 0; cascade < light.numCascades; cascade++) {
			if ((shadowUpdateOverrides == null ? void 0 : shadowUpdateOverrides[cascade]) === SHADOWUPDATE_NONE) {
				break;
			}
			const lightRenderData = light.getRenderData(camera, cascade);
			const shadowCam = lightRenderData.shadowCamera;
			shadowCam.renderTarget = light._shadowMap.renderTargets[0];
			lightRenderData.shadowViewport.copy(light.cascades[cascade]);
			lightRenderData.shadowScissor.copy(light.cascades[cascade]);
			const shadowCamNode = shadowCam._node;
			const lightNode = light._node;
			shadowCamNode.setPosition(lightNode.getPosition());
			shadowCamNode.setRotation(lightNode.getRotation());
			shadowCamNode.rotateLocal(-90, 0, 0);
			const frustumNearDist = cascade === 0 ? nearDist : light._shadowCascadeDistances[cascade - 1];
			const frustumFarDist = light._shadowCascadeDistances[cascade];
			const frustumPoints = camera.getFrustumCorners(frustumNearDist, frustumFarDist);
			center.set(0, 0, 0);
			const cameraWorldMat = camera.node.getWorldTransform();
			for (let i = 0; i < 8; i++) {
				cameraWorldMat.transformPoint(frustumPoints[i], frustumPoints[i]);
				center.add(frustumPoints[i]);
			}
			center.mulScalar(1 / 8);
			let radius = 0;
			for (let i = 0; i < 8; i++) {
				const dist = frustumPoints[i].sub(center).length();
				if (dist > radius) radius = dist;
			}
			const right = shadowCamNode.right;
			const up = shadowCamNode.up;
			const lightDir = shadowCamNode.forward;
			const sizeRatio = 0.25 * light._shadowResolution / radius;
			const x = Math.ceil(center.dot(up) * sizeRatio) / sizeRatio;
			const y = Math.ceil(center.dot(right) * sizeRatio) / sizeRatio;
			const scaledUp = up.mulScalar(x);
			const scaledRight = right.mulScalar(y);
			const dot = center.dot(lightDir);
			const scaledDir = lightDir.mulScalar(dot);
			center.add2(scaledUp, scaledRight).add(scaledDir);
			shadowCamNode.setPosition(center);
			shadowCamNode.translateLocal(0, 0, 1000000);
			shadowCam.nearClip = 0.01;
			shadowCam.farClip = 2000000;
			shadowCam.orthoHeight = radius;
			this.renderer.updateCameraFrustum(shadowCam);
			this.shadowRenderer.cullShadowCasters(drawCalls, lightRenderData.visibleCasters, shadowCam);
			let emptyAabb = true;
			const visibleCasters = lightRenderData.visibleCasters;
			for (let i = 0; i < visibleCasters.length; i++) {
				const meshInstance = visibleCasters[i];
				if (emptyAabb) {
					emptyAabb = false;
					visibleSceneAabb.copy(meshInstance.aabb);
				} else {
					visibleSceneAabb.add(meshInstance.aabb);
				}
			}
			shadowCamView.copy(shadowCamNode.getWorldTransform()).invert();
			const depthRange = getDepthRange(shadowCamView, visibleSceneAabb.getMin(), visibleSceneAabb.getMax());
			shadowCamNode.translateLocal(0, 0, depthRange.max + 0.1);
			shadowCam.farClip = depthRange.max - depthRange.min + 0.2;
		}
	}
	generateSplitDistances(light, nearDist, farDist) {
		light._shadowCascadeDistances.fill(farDist);
		for (let i = 1; i < light.numCascades; i++) {
			const fraction = i / light.numCascades;
			const linearDist = nearDist + (farDist - nearDist) * fraction;
			const logDist = nearDist * (farDist / nearDist) ** fraction;
			const dist = math.lerp(linearDist, logDist, light.cascadeDistribution);
			light._shadowCascadeDistances[i - 1] = dist;
		}
	}
	addLightRenderPasses(frameGraph, light, camera) {
		const faceCount = light.numShadowFaces;
		const shadowUpdateOverrides = light.shadowUpdateOverrides;
		let allCascadesRendering = true;
		let shadowCamera;
		for (let face = 0; face < faceCount; face++) {
			if ((shadowUpdateOverrides == null ? void 0 : shadowUpdateOverrides[face]) === SHADOWUPDATE_NONE) allCascadesRendering = false;
			shadowCamera = this.shadowRenderer.prepareFace(light, camera, face);
		}
		const renderPass = new RenderPass(this.device, () => {
			for (let face = 0; face < faceCount; face++) {
				if ((shadowUpdateOverrides == null ? void 0 : shadowUpdateOverrides[face]) !== SHADOWUPDATE_NONE) {
					this.shadowRenderer.renderFace(light, camera, face, !allCascadesRendering);
				}
				if ((shadowUpdateOverrides == null ? void 0 : shadowUpdateOverrides[face]) === SHADOWUPDATE_THISFRAME) {
					shadowUpdateOverrides[face] = SHADOWUPDATE_NONE;
				}
			}
		});
		renderPass.after = () => {
			this.shadowRenderer.renderVsm(light, camera);
		};
		this.shadowRenderer.setupRenderPass(renderPass, shadowCamera, allCascadesRendering);
		frameGraph.addRenderPass(renderPass);
	}
	buildFrameGraph(frameGraph, renderAction, camera) {
		const lights = renderAction.directionalLights;
		for (let i = 0; i < lights.length; i++) {
			const light = lights[i];
			if (this.shadowRenderer.needsShadowRendering(light)) {
				this.addLightRenderPasses(frameGraph, light, camera.camera);
			}
		}
	}
}

export { ShadowRendererDirectional };
