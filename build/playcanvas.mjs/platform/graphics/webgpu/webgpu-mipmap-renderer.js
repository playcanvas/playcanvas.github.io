import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import '../../../core/debug.js';

class WebgpuMipmapRenderer {
	constructor(device) {
		this.device = void 0;
		this.device = device;
		const wgpu = device.wgpu;
		const code = `
 
						var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
								vec2(-1.0, 1.0), vec2(1.0, 1.0),
								vec2(-1.0, -1.0), vec2(1.0, -1.0)
						);

						struct VertexOutput {
								@builtin(position) position : vec4f,
								@location(0) texCoord : vec2f
						};

						@vertex
						fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
							var output : VertexOutput;
							output.texCoord = pos[vertexIndex] * vec2f(0.5, -0.5) + vec2f(0.5);
							output.position = vec4f(pos[vertexIndex], 0, 1);
							return output;
						}

						@group(0) @binding(0) var imgSampler : sampler;
						@group(0) @binding(1) var img : texture_2d<f32>;

						@fragment
						fn fragmentMain(@location(0) texCoord : vec2f) -> @location(0) vec4f {
							return textureSample(img, imgSampler, texCoord);
						}
				`;
		this.shader = new Shader(device, {
			name: 'WebGPUMipmapRendererShader',
			shaderLanguage: SHADERLANGUAGE_WGSL,
			vshader: code,
			fshader: code
		});
		this.minSampler = wgpu.createSampler({
			minFilter: 'linear'
		});
	}
	generate(webgpuTexture) {
		var _device$commandEncode;
		const textureDescr = webgpuTexture.descr;
		if (textureDescr.mipLevelCount <= 1) {
			return;
		}
		if (webgpuTexture.texture.volume) {
			return;
		}
		const device = this.device;
		const wgpu = device.wgpu;
		const webgpuShader = this.shader.impl;
		const pipeline = wgpu.createRenderPipeline({
			layout: 'auto',
			vertex: {
				module: webgpuShader.getVertexShaderModule(),
				entryPoint: webgpuShader.vertexEntryPoint
			},
			fragment: {
				module: webgpuShader.getFragmentShaderModule(),
				entryPoint: webgpuShader.fragmentEntryPoint,
				targets: [{
					format: textureDescr.format
				}]
			},
			primitive: {
				topology: 'triangle-strip'
			}
		});
		const numFaces = webgpuTexture.texture.cubemap ? 6 : 1;
		const srcViews = [];
		for (let face = 0; face < numFaces; face++) {
			srcViews.push(webgpuTexture.createView({
				dimension: '2d',
				baseMipLevel: 0,
				mipLevelCount: 1,
				baseArrayLayer: face
			}));
		}
		const commandEncoder = (_device$commandEncode = device.commandEncoder) != null ? _device$commandEncode : wgpu.createCommandEncoder();
		for (let i = 1; i < textureDescr.mipLevelCount; i++) {
			for (let face = 0; face < numFaces; face++) {
				const dstView = webgpuTexture.createView({
					dimension: '2d',
					baseMipLevel: i,
					mipLevelCount: 1,
					baseArrayLayer: face
				});
				const passEncoder = commandEncoder.beginRenderPass({
					colorAttachments: [{
						view: dstView,
						loadOp: 'clear',
						storeOp: 'store'
					}]
				});
				const bindGroup = wgpu.createBindGroup({
					layout: pipeline.getBindGroupLayout(0),
					entries: [{
						binding: 0,
						resource: this.minSampler
					}, {
						binding: 1,
						resource: srcViews[face]
					}]
				});
				passEncoder.setPipeline(pipeline);
				passEncoder.setBindGroup(0, bindGroup);
				passEncoder.draw(4);
				passEncoder.end();
				srcViews[face] = dstView;
			}
		}
		if (!device.commandEncoder) {
			const cb = commandEncoder.finish();
			device.addCommandBuffer(cb);
		}
		device.pipeline = null;
	}
}

export { WebgpuMipmapRenderer };
