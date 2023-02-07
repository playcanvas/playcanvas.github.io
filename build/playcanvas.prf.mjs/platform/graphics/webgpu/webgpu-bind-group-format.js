/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import '../../../core/tracing.js';
import { SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH } from '../constants.js';
import { WebgpuUtils } from './webgpu-utils.js';

const samplerTypes = {};
samplerTypes[SAMPLETYPE_FLOAT] = 'filtering';
samplerTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'non-filtering';
samplerTypes[SAMPLETYPE_DEPTH] = 'comparison';
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
					hasDynamicOffset: false
				}
			});
		});
		bindGroupFormat.textureFormats.forEach(textureFormat => {
			const visibility = WebgpuUtils.shaderStage(textureFormat.visibility);
			const sampleType = textureFormat.sampleType;
			const viewDimension = textureFormat.textureDimension;
			const multisampled = false;
			key += `#${index}T:${visibility}-${sampleType}-${viewDimension}-${multisampled}`;
			entries.push({
				binding: index++,
				visibility: visibility,
				texture: {
					sampleType: sampleType,
					viewDimension: viewDimension,
					multisampled: multisampled
				}
			});
			const type = samplerTypes[sampleType];
			key += `#${index}S:${visibility}-${type}`;
			entries.push({
				binding: index++,
				visibility: visibility,
				sampler: {
					type: type
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
