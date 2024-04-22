import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';

class WebgpuResolver {
  constructor(device) {
    this.device = void 0;
    this.pipelineCache = new Map();
    this.device = device;
    const code = `
 
            var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
                vec2(-1.0, 1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, -1.0)
            );

            struct VertexOutput {
                @builtin(position) position : vec4f,
            };

            @vertex
            fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
              var output : VertexOutput;
              output.position = vec4f(pos[vertexIndex], 0, 1);
              return output;
            }

            @group(0) @binding(0) var img : texture_depth_multisampled_2d;

            @fragment
            fn fragmentMain(@builtin(position) fragColor: vec4f) -> @location(0) vec4f {
                // load th depth value from sample index 0
                var depth = textureLoad(img, vec2i(fragColor.xy), 0u);
                return vec4<f32>(depth, 0.0, 0.0, 0.0);
            }
        `;
    this.shader = new Shader(device, {
      name: 'WebGPUResolverDepthShader',
      shaderLanguage: SHADERLANGUAGE_WGSL,
      vshader: code,
      fshader: code
    });
  }
  destroy() {
    this.shader.destroy();
    this.shader = null;
    this.pipelineCache = null;
  }
  getPipeline(format) {
    let pipeline = this.pipelineCache.get(format);
    if (!pipeline) {
      pipeline = this.createPipeline(format);
      this.pipelineCache.set(format, pipeline);
    }
    return pipeline;
  }
  createPipeline(format) {
    const webgpuShader = this.shader.impl;
    const pipeline = this.device.wgpu.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: webgpuShader.getVertexShaderModule(),
        entryPoint: webgpuShader.vertexEntryPoint
      },
      fragment: {
        module: webgpuShader.getFragmentShaderModule(),
        entryPoint: webgpuShader.fragmentEntryPoint,
        targets: [{
          format: format
        }]
      },
      primitive: {
        topology: 'triangle-strip'
      }
    });
    return pipeline;
  }
  resolveDepth(commandEncoder, sourceTexture, destinationTexture) {
    const device = this.device;
    const wgpu = device.wgpu;
    const pipeline = this.getPipeline(destinationTexture.format);
    const numFaces = sourceTexture.depthOrArrayLayers;
    for (let face = 0; face < numFaces; face++) {
      const srcView = sourceTexture.createView({
        dimension: '2d',
        aspect: 'depth-only',
        baseMipLevel: 0,
        mipLevelCount: 1,
        baseArrayLayer: face
      });
      const dstView = destinationTexture.createView({
        dimension: '2d',
        baseMipLevel: 0,
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
          resource: srcView
        }]
      });
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(4);
      passEncoder.end();
    }
    device.pipeline = null;
  }
}

export { WebgpuResolver };
