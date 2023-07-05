import { Vec3 } from '../../core/math/vec3.js';
import { math } from '../../core/math/math.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PIXELFORMAT_L8 } from '../../platform/graphics/constants.js';
import { MASK_AFFECT_DYNAMIC, MASK_AFFECT_LIGHTMAPPED, LIGHTTYPE_SPOT, LIGHTTYPE_DIRECTIONAL } from '../constants.js';
import { LightsBuffer } from './lights-buffer.js';
import '../../core/debug.js';

const tempVec3 = new Vec3();
const tempMin3 = new Vec3();
const tempMax3 = new Vec3();
const tempBox = new BoundingBox();
const epsilon = 0.000001;
class ClusterLight {
	constructor() {
		this.light = null;
		this.min = new Vec3();
		this.max = new Vec3();
	}
}
class WorldClusters {
	constructor(device) {
		this.clusterTexture = void 0;
		this.device = device;
		this.name = 'Untitled';
		this.reportCount = 0;
		this.boundsMin = new Vec3();
		this.boundsMax = new Vec3();
		this.boundsDelta = new Vec3();
		this._cells = new Vec3(1, 1, 1);
		this._cellsLimit = new Vec3();
		this.cells = this._cells;
		this.maxCellLightCount = 4;
		this._maxAttenuation = 0;
		this._maxColorValue = 0;
		this._usedLights = [];
		this._usedLights.push(new ClusterLight());
		this.lightsBuffer = new LightsBuffer(device);
		this.registerUniforms(device);
	}
	set maxCellLightCount(count) {
		if (count !== this._maxCellLightCount) {
			this._maxCellLightCount = count;
			this._cellsDirty = true;
		}
	}
	get maxCellLightCount() {
		return this._maxCellLightCount;
	}
	set cells(value) {
		tempVec3.copy(value).floor();
		if (!this._cells.equals(tempVec3)) {
			this._cells.copy(tempVec3);
			this._cellsLimit.copy(tempVec3).sub(Vec3.ONE);
			this._cellsDirty = true;
		}
	}
	get cells() {
		return this._cells;
	}
	destroy() {
		this.lightsBuffer.destroy();
		this.releaseClusterTexture();
	}
	releaseClusterTexture() {
		if (this.clusterTexture) {
			this.clusterTexture.destroy();
			this.clusterTexture = null;
		}
	}
	registerUniforms(device) {
		this._clusterSkipId = device.scope.resolve('clusterSkip');
		this._clusterMaxCellsId = device.scope.resolve('clusterMaxCells');
		this._clusterWorldTextureId = device.scope.resolve('clusterWorldTexture');
		this._clusterTextureSizeId = device.scope.resolve('clusterTextureSize');
		this._clusterTextureSizeData = new Float32Array(3);
		this._clusterBoundsMinId = device.scope.resolve('clusterBoundsMin');
		this._clusterBoundsMinData = new Float32Array(3);
		this._clusterBoundsDeltaId = device.scope.resolve('clusterBoundsDelta');
		this._clusterBoundsDeltaData = new Float32Array(3);
		this._clusterCellsCountByBoundsSizeId = device.scope.resolve('clusterCellsCountByBoundsSize');
		this._clusterCellsCountByBoundsSizeData = new Float32Array(3);
		this._clusterCellsDotId = device.scope.resolve('clusterCellsDot');
		this._clusterCellsDotData = new Float32Array(3);
		this._clusterCellsMaxId = device.scope.resolve('clusterCellsMax');
		this._clusterCellsMaxData = new Float32Array(3);
		this._clusterCompressionLimit0Id = device.scope.resolve('clusterCompressionLimit0');
		this._clusterCompressionLimit0Data = new Float32Array(2);
	}
	updateParams(lightingParams) {
		if (lightingParams) {
			this.cells = lightingParams.cells;
			this.maxCellLightCount = lightingParams.maxLightsPerCell;
			this.lightsBuffer.cookiesEnabled = lightingParams.cookiesEnabled;
			this.lightsBuffer.shadowsEnabled = lightingParams.shadowsEnabled;
			this.lightsBuffer.areaLightsEnabled = lightingParams.areaLightsEnabled;
		}
	}
	updateCells() {
		if (this._cellsDirty) {
			this._cellsDirty = false;
			const cx = this._cells.x;
			const cy = this._cells.y;
			const cz = this._cells.z;
			const numCells = cx * cy * cz;
			const totalPixels = this.maxCellLightCount * numCells;
			let width = Math.ceil(Math.sqrt(totalPixels));
			width = math.roundUp(width, this.maxCellLightCount);
			const height = Math.ceil(totalPixels / width);
			this._clusterCellsMaxData[0] = cx;
			this._clusterCellsMaxData[1] = cy;
			this._clusterCellsMaxData[2] = cz;
			this._clusterCellsDotData[0] = this.maxCellLightCount;
			this._clusterCellsDotData[1] = cx * cz * this.maxCellLightCount;
			this._clusterCellsDotData[2] = cx * this.maxCellLightCount;
			this.clusters = new Uint8ClampedArray(totalPixels);
			this.counts = new Int32Array(numCells);
			this._clusterTextureSizeData[0] = width;
			this._clusterTextureSizeData[1] = 1.0 / width;
			this._clusterTextureSizeData[2] = 1.0 / height;
			this.releaseClusterTexture();
			this.clusterTexture = LightsBuffer.createTexture(this.device, width, height, PIXELFORMAT_L8, 'ClusterTexture');
		}
	}
	uploadTextures() {
		this.clusterTexture.lock().set(this.clusters);
		this.clusterTexture.unlock();
		this.lightsBuffer.uploadTextures();
	}
	updateUniforms() {
		this._clusterSkipId.setValue(this._usedLights.length > 1 ? 0 : 1);
		this.lightsBuffer.updateUniforms();
		this._clusterWorldTextureId.setValue(this.clusterTexture);
		this._clusterMaxCellsId.setValue(this.maxCellLightCount);
		const boundsDelta = this.boundsDelta;
		this._clusterCellsCountByBoundsSizeData[0] = this._cells.x / boundsDelta.x;
		this._clusterCellsCountByBoundsSizeData[1] = this._cells.y / boundsDelta.y;
		this._clusterCellsCountByBoundsSizeData[2] = this._cells.z / boundsDelta.z;
		this._clusterCellsCountByBoundsSizeId.setValue(this._clusterCellsCountByBoundsSizeData);
		this._clusterBoundsMinData[0] = this.boundsMin.x;
		this._clusterBoundsMinData[1] = this.boundsMin.y;
		this._clusterBoundsMinData[2] = this.boundsMin.z;
		this._clusterBoundsDeltaData[0] = boundsDelta.x;
		this._clusterBoundsDeltaData[1] = boundsDelta.y;
		this._clusterBoundsDeltaData[2] = boundsDelta.z;
		this._clusterCompressionLimit0Data[0] = this._maxAttenuation;
		this._clusterCompressionLimit0Data[1] = this._maxColorValue;
		this._clusterTextureSizeId.setValue(this._clusterTextureSizeData);
		this._clusterBoundsMinId.setValue(this._clusterBoundsMinData);
		this._clusterBoundsDeltaId.setValue(this._clusterBoundsDeltaData);
		this._clusterCellsDotId.setValue(this._clusterCellsDotData);
		this._clusterCellsMaxId.setValue(this._clusterCellsMaxData);
		this._clusterCompressionLimit0Id.setValue(this._clusterCompressionLimit0Data);
	}
	evalLightCellMinMax(clusteredLight, min, max) {
		min.copy(clusteredLight.min);
		min.sub(this.boundsMin);
		min.div(this.boundsDelta);
		min.mul2(min, this.cells);
		min.floor();
		max.copy(clusteredLight.max);
		max.sub(this.boundsMin);
		max.div(this.boundsDelta);
		max.mul2(max, this.cells);
		max.ceil();
		min.max(Vec3.ZERO);
		max.min(this._cellsLimit);
	}
	collectLights(lights) {
		const maxLights = this.lightsBuffer.maxLights;
		const usedLights = this._usedLights;
		let lightIndex = 1;
		lights.forEach(light => {
			const runtimeLight = !!(light.mask & (MASK_AFFECT_DYNAMIC | MASK_AFFECT_LIGHTMAPPED));
			const zeroAngleSpotlight = light.type === LIGHTTYPE_SPOT && light._outerConeAngle === 0;
			if (light.enabled && light.type !== LIGHTTYPE_DIRECTIONAL && light.visibleThisFrame && light.intensity > 0 && runtimeLight && !zeroAngleSpotlight) {
				if (lightIndex < maxLights) {
					let clusteredLight;
					if (lightIndex < usedLights.length) {
						clusteredLight = usedLights[lightIndex];
					} else {
						clusteredLight = new ClusterLight();
						usedLights.push(clusteredLight);
					}
					clusteredLight.light = light;
					light.getBoundingBox(tempBox);
					clusteredLight.min.copy(tempBox.getMin());
					clusteredLight.max.copy(tempBox.getMax());
					lightIndex++;
				}
			}
		});
		usedLights.length = lightIndex;
	}
	evaluateBounds() {
		const usedLights = this._usedLights;
		const min = this.boundsMin;
		const max = this.boundsMax;
		if (usedLights.length > 1) {
			min.copy(usedLights[1].min);
			max.copy(usedLights[1].max);
			for (let i = 2; i < usedLights.length; i++) {
				min.min(usedLights[i].min);
				max.max(usedLights[i].max);
			}
		} else {
			min.set(0, 0, 0);
			max.set(1, 1, 1);
		}
		this.boundsDelta.sub2(max, min);
		this.lightsBuffer.setBounds(min, this.boundsDelta);
	}
	evaluateCompressionLimits(gammaCorrection) {
		let maxAttenuation = 0;
		let maxColorValue = 0;
		const usedLights = this._usedLights;
		for (let i = 1; i < usedLights.length; i++) {
			const light = usedLights[i].light;
			maxAttenuation = Math.max(light.attenuationEnd, maxAttenuation);
			const color = gammaCorrection ? light._linearFinalColor : light._finalColor;
			maxColorValue = Math.max(color[0], maxColorValue);
			maxColorValue = Math.max(color[1], maxColorValue);
			maxColorValue = Math.max(color[2], maxColorValue);
		}
		this._maxAttenuation = maxAttenuation + epsilon;
		this._maxColorValue = maxColorValue + epsilon;
		this.lightsBuffer.setCompressionRanges(this._maxAttenuation, this._maxColorValue);
	}
	updateClusters(gammaCorrection) {
		this.counts.fill(0);
		this.clusters.fill(0);
		const divX = this._cells.x;
		const divZ = this._cells.z;
		const counts = this.counts;
		const limit = this._maxCellLightCount;
		const clusters = this.clusters;
		const pixelsPerCellCount = this.maxCellLightCount;
		const usedLights = this._usedLights;
		for (let i = 1; i < usedLights.length; i++) {
			const clusteredLight = usedLights[i];
			const light = clusteredLight.light;
			this.lightsBuffer.addLightData(light, i, gammaCorrection);
			this.evalLightCellMinMax(clusteredLight, tempMin3, tempMax3);
			const xStart = tempMin3.x;
			const xEnd = tempMax3.x;
			const yStart = tempMin3.y;
			const yEnd = tempMax3.y;
			const zStart = tempMin3.z;
			const zEnd = tempMax3.z;
			for (let x = xStart; x <= xEnd; x++) {
				for (let z = zStart; z <= zEnd; z++) {
					for (let y = yStart; y <= yEnd; y++) {
						const clusterIndex = x + divX * (z + y * divZ);
						const count = counts[clusterIndex];
						if (count < limit) {
							clusters[pixelsPerCellCount * clusterIndex + count] = i;
							counts[clusterIndex] = count + 1;
						}
					}
				}
			}
		}
	}
	update(lights, gammaCorrection, lightingParams) {
		this.updateParams(lightingParams);
		this.updateCells();
		this.collectLights(lights);
		this.evaluateBounds();
		this.evaluateCompressionLimits(gammaCorrection);
		this.updateClusters(gammaCorrection);
		this.uploadTextures();
	}
	activate() {
		this.updateUniforms();
	}
}

export { WorldClusters };
