/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec3 } from '../../../core/math/vec3.js';
import { EMITTERSHAPE_BOX, PARTICLEMODE_GPU, PARTICLEORIENTATION_SCREEN, BLEND_NORMAL, LAYERID_WORLD } from '../../../scene/constants.js';

class ParticleSystemComponentData {
	constructor() {
		this.numParticles = 1;
		this.rate = 1;
		this.rate2 = null;
		this.startAngle = 0;
		this.startAngle2 = null;
		this.lifetime = 50;
		this.emitterExtents = new Vec3();
		this.emitterExtentsInner = new Vec3();
		this.emitterRadius = 0;
		this.emitterRadiusInner = 0;
		this.emitterShape = EMITTERSHAPE_BOX;
		this.initialVelocity = 0;
		this.wrapBounds = new Vec3();
		this.localSpace = false;
		this.screenSpace = false;
		this.colorMap = null;
		this.colorMapAsset = null;
		this.normalMap = null;
		this.normalMapAsset = null;
		this.loop = true;
		this.preWarm = false;
		this.sort = 0;
		this.mode = PARTICLEMODE_GPU;
		this.scene = null;
		this.lighting = false;
		this.halfLambert = false;
		this.intensity = 1;
		this.stretch = 0.0;
		this.alignToMotion = false;
		this.depthSoftening = 0;
		this.meshAsset = null;
		this.mesh = null;
		this.depthWrite = false;
		this.noFog = false;
		this.orientation = PARTICLEORIENTATION_SCREEN;
		this.particleNormal = new Vec3(0, 1, 0);
		this.animTilesX = 1;
		this.animTilesY = 1;
		this.animStartFrame = 0;
		this.animNumFrames = 1;
		this.animNumAnimations = 1;
		this.animIndex = 0;
		this.randomizeAnimIndex = false;
		this.animSpeed = 1;
		this.animLoop = true;
		this.scaleGraph = null;
		this.scaleGraph2 = null;
		this.colorGraph = null;
		this.colorGraph2 = null;
		this.alphaGraph = null;
		this.alphaGraph2 = null;
		this.localVelocityGraph = null;
		this.localVelocityGraph2 = null;
		this.velocityGraph = null;
		this.velocityGraph2 = null;
		this.rotationSpeedGraph = null;
		this.rotationSpeedGraph2 = null;
		this.radialSpeedGraph = null;
		this.radialSpeedGraph2 = null;
		this.blendType = BLEND_NORMAL;
		this.enabled = true;
		this.paused = false;
		this.autoPlay = true;
		this.layers = [LAYERID_WORLD];
	}
}

export { ParticleSystemComponentData };
