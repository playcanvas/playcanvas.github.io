import '../../../core/debug.js';
import { SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH } from '../constants.js';
import { WebgpuUtils } from './webgpu-utils.js';

const samplerTypes = [];
samplerTypes[SAMPLETYPE_FLOAT] = 'filtering';
samplerTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'non-filtering';
samplerTypes[SAMPLETYPE_DEPTH] = 'comparison';
const sampleTypes = [];
sampleTypes[SAMPLETYPE_FLOAT] = 'float';
sampleTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'unfilterable-float';
sampleTypes[SAMPLETYPE_DEPTH] = 'depth';
class WebgpuBindGroupFormat {
	constructor(bindGroupFormat) {
		const device = bindGroupFormat.device;
		const {
			key,
			descr
		} = this.createDescriptor(bindGroupFormat);
		this.key = key;
		this.bindGroupLayout = device.wgpu.createBindGroupLayout(descr);
	}
	destroy() {
		this.bindGroupLayout = null;
	}
	loseContext() {}
	getTextureSlot(bindGroupFormat, index) {
		return bindGroupFormat.bufferFormats.length + index * 2;
	}
	createDescriptor(bindGroupFormat) {
		const entries = [];
		let key = '';
		let index = 0;
		bindGroupFormat.bufferFormats.forEach(bufferFormat => {
			const visibility = WebgpuUtils.shaderStage(bufferFormat.visibility);
			key += `#${index}U:${visibility}`;
			entries.push({
				binding: index++,
				visibility: visibility,
				buffer: {
					type: 'uniform',
					hasDynamicOffset: true
				}
			});
		});
		bindGroupFormat.textureFormats.forEach(textureFormat => {
			const visibility = WebgpuUtils.shaderStage(textureFormat.visibility);
			const sampleType = textureFormat.sampleType;
			const viewDimension = textureFormat.textureDimension;
			const multisampled = false;
			const gpuSampleType = sampleTypes[sampleType];
			key += `#${index}T:${visibility}-${gpuSampleType}-${viewDimension}-${multisampled}`;
			entries.push({
				binding: index++,
				visibility: visibility,
				texture: {
					sampleType: gpuSampleType,
					viewDimension: viewDimension,
					multisampled: multisampled
				}
			});
			const gpuSamplerType = samplerTypes[sampleType];
			key += `#${index}S:${visibility}-${gpuSamplerType}`;
			entries.push({
				binding: index++,
				visibility: visibility,
				sampler: {
					type: gpuSamplerType
				}
			});
		});
		const descr = {
			entries: entries
		};
		return {
			key,
			descr
		};
	}
}

export { WebgpuBindGroupFormat };
