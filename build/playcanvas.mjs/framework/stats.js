import { getApplication } from './globals.js';

class ApplicationStats {
	constructor(device) {
		this.frame = {
			fps: 0,
			ms: 0,
			dt: 0,
			updateStart: 0,
			updateTime: 0,
			renderStart: 0,
			renderTime: 0,
			physicsStart: 0,
			physicsTime: 0,
			cullTime: 0,
			sortTime: 0,
			skinTime: 0,
			morphTime: 0,
			instancingTime: 0,
			triangles: 0,
			otherPrimitives: 0,
			shaders: 0,
			materials: 0,
			cameras: 0,
			shadowMapUpdates: 0,
			shadowMapTime: 0,
			depthMapTime: 0,
			forwardTime: 0,
			lightClustersTime: 0,
			lightClusters: 0,
			_timeToCountFrames: 0,
			_fpsAccum: 0
		};
		this.drawCalls = {
			forward: 0,
			depth: 0,
			shadow: 0,
			immediate: 0,
			misc: 0,
			total: 0,
			skinned: 0,
			instanced: 0,
			removedByInstancing: 0
		};
		this.misc = {
			renderTargetCreationTime: 0
		};
		this.particles = {
			updatesPerFrame: 0,
			_updatesPerFrame: 0,
			frameTime: 0,
			_frameTime: 0
		};
		this.shaders = device._shaderStats;
		this.vram = device._vram;
		Object.defineProperty(this.vram, 'totalUsed', {
			get: function () {
				return this.tex + this.vb + this.ib;
			}
		});
		Object.defineProperty(this.vram, 'geom', {
			get: function () {
				return this.vb + this.ib;
			}
		});
	}
	get scene() {
		return getApplication().scene._stats;
	}
	get lightmapper() {
		var _getApplication$light;
		return (_getApplication$light = getApplication().lightmapper) == null ? void 0 : _getApplication$light.stats;
	}
	get batcher() {
		const batcher = getApplication()._batcher;
		return batcher ? batcher._stats : null;
	}
}

export { ApplicationStats };
