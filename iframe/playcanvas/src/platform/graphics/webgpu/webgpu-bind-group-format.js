import { StringIds } from '../../../core/string-ids.js';
import { SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, SAMPLETYPE_INT, SAMPLETYPE_UINT } from '../constants.js';
import { WebgpuUtils } from './webgpu-utils.js';
import { gpuTextureFormats } from './constants.js';

const samplerTypes = [];
samplerTypes[SAMPLETYPE_FLOAT] = 'filtering';
samplerTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'non-filtering';
samplerTypes[SAMPLETYPE_DEPTH] = 'comparison';
samplerTypes[SAMPLETYPE_INT] = 'comparison';
samplerTypes[SAMPLETYPE_UINT] = 'comparison';
const sampleTypes = [];
sampleTypes[SAMPLETYPE_FLOAT] = 'float';
sampleTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'unfilterable-float';
sampleTypes[SAMPLETYPE_DEPTH] = 'depth';
sampleTypes[SAMPLETYPE_INT] = 'sint';
sampleTypes[SAMPLETYPE_UINT] = 'uint';
const stringIds = new StringIds();
class WebgpuBindGroupFormat {
  constructor(bindGroupFormat) {
    const device = bindGroupFormat.device;
    const {
      key,
      descr
    } = this.createDescriptor(bindGroupFormat);
    this.key = stringIds.get(key);
    this.bindGroupLayout = device.wgpu.createBindGroupLayout(descr);
  }
  destroy() {
    this.bindGroupLayout = null;
  }
  loseContext() {}
  createDescriptor(bindGroupFormat) {
    const entries = [];
    let key = '';
    bindGroupFormat.uniformBufferFormats.forEach(bufferFormat => {
      const visibility = WebgpuUtils.shaderStage(bufferFormat.visibility);
      key += `#${bufferFormat.slot}U:${visibility}`;
      entries.push({
        binding: bufferFormat.slot,
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
      key += `#${textureFormat.slot}T:${visibility}-${gpuSampleType}-${viewDimension}-${multisampled}`;
      entries.push({
        binding: textureFormat.slot,
        visibility: visibility,
        texture: {
          sampleType: gpuSampleType,
          viewDimension: viewDimension,
          multisampled: multisampled
        }
      });
      if (textureFormat.hasSampler) {
        const gpuSamplerType = samplerTypes[sampleType];
        key += `#${textureFormat.slot + 1}S:${visibility}-${gpuSamplerType}`;
        entries.push({
          binding: textureFormat.slot + 1,
          visibility: visibility,
          sampler: {
            type: gpuSamplerType
          }
        });
      }
    });
    bindGroupFormat.storageTextureFormats.forEach(textureFormat => {
      const {
        format,
        textureDimension
      } = textureFormat;
      const {
        read,
        write
      } = textureFormat;
      key += `#${textureFormat.slot}ST:${format}-${textureDimension}-${read ? 'r1' : 'r0'}-${write ? 'w1' : 'w0'}`;
      entries.push({
        binding: textureFormat.slot,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: {
          access: read ? write ? 'read-write' : 'read-only' : 'write-only',
          format: gpuTextureFormats[format],
          viewDimension: textureDimension
        }
      });
    });
    bindGroupFormat.storageBufferFormats.forEach(bufferFormat => {
      const readOnly = bufferFormat.readOnly;
      const visibility = WebgpuUtils.shaderStage(bufferFormat.visibility);
      key += `#${bufferFormat.slot}SB:${visibility}-${readOnly ? 'ro' : 'rw'}`;
      entries.push({
        binding: bufferFormat.slot,
        visibility: visibility,
        buffer: {
          type: readOnly ? 'read-only-storage' : 'storage'
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
