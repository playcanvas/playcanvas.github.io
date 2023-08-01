import { Shader } from '../shader.js';
import { SHADERLANGUAGE_WGSL } from '../constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { DebugGraphics } from '../debug-graphics.js';

/**
 * A WebGPU helper class implementing texture mipmap generation.
 *
 * @ignore
 */
class WebgpuMipmapRenderer {
  constructor(device) {
    /** @type {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} */
    this.device = void 0;
    this.device = device;
    const wgpu = device.wgpu;

    // Shader that renders a fullscreen textured quad
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

    // using minified rendering, so that's the only filter mode we need to set.
    this.minSampler = wgpu.createSampler({
      minFilter: 'linear'
    });
  }

  /**
   * Generates mipmaps for the specified WebGPU texture.
   *
   * @param {import('./webgpu-texture.js').WebgpuTexture} webgpuTexture - The texture to generate mipmaps for.
   */
  generate(webgpuTexture) {
    var _device$commandEncode;
    // ignore texture with no mipmaps
    const textureDescr = webgpuTexture.descr;
    if (textureDescr.mipLevelCount <= 1) {
      return;
    }

    // not all types are currently supported
    if (webgpuTexture.texture.volume) {
      Debug.warnOnce('WebGPU mipmap generation is not supported volume texture.', webgpuTexture.texture);
      return;
    }
    const device = this.device;
    const wgpu = device.wgpu;

    /** @type {import('./webgpu-shader.js').WebgpuShader} */
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
          format: textureDescr.format // use the same format as the texture
        }]
      },

      primitive: {
        topology: 'triangle-strip'
      }
    });
    DebugHelper.setLabel(pipeline, 'RenderPipeline-MipmapRenderer');
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

    // loop through each mip level and render the previous level's contents into it.
    const commandEncoder = (_device$commandEncode = device.commandEncoder) != null ? _device$commandEncode : wgpu.createCommandEncoder();
    DebugHelper.setLabel(commandEncoder, 'MipmapRendererEncoder');
    DebugGraphics.pushGpuMarker(device, 'MIPMAP-RENDERER');
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
        DebugHelper.setLabel(passEncoder, `MipmapRenderer-PassEncoder_${i}`);
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

        // next iteration
        srcViews[face] = dstView;
      }
    }
    DebugGraphics.popGpuMarker(device);

    // submit the encoded commands if we created the encoder
    if (!device.commandEncoder) {
      const cb = commandEncoder.finish();
      DebugHelper.setLabel(cb, 'MipmapRenderer-CommandBuffer');
      device.addCommandBuffer(cb);
    }

    // clear invalidated state
    device.pipeline = null;
  }
}

export { WebgpuMipmapRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LW1pcG1hcC1yZW5kZXJlci5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL3dlYmdwdS93ZWJncHUtbWlwbWFwLXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNoYWRlciB9IGZyb20gXCIuLi9zaGFkZXIuanNcIjtcbmltcG9ydCB7IFNIQURFUkxBTkdVQUdFX1dHU0wgfSBmcm9tIFwiLi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS9kZWJ1Zy5qc1wiO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gXCIuLi9kZWJ1Zy1ncmFwaGljcy5qc1wiO1xuXG4vKipcbiAqIEEgV2ViR1BVIGhlbHBlciBjbGFzcyBpbXBsZW1lbnRpbmcgdGV4dHVyZSBtaXBtYXAgZ2VuZXJhdGlvbi5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFdlYmdwdU1pcG1hcFJlbmRlcmVyIHtcbiAgICAvKiogQHR5cGUge2ltcG9ydCgnLi93ZWJncHUtZ3JhcGhpY3MtZGV2aWNlLmpzJykuV2ViZ3B1R3JhcGhpY3NEZXZpY2V9ICovXG4gICAgZGV2aWNlO1xuXG4gICAgY29uc3RydWN0b3IoZGV2aWNlKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICBjb25zdCB3Z3B1ID0gZGV2aWNlLndncHU7XG5cbiAgICAgICAgLy8gU2hhZGVyIHRoYXQgcmVuZGVycyBhIGZ1bGxzY3JlZW4gdGV4dHVyZWQgcXVhZFxuICAgICAgICBjb25zdCBjb2RlID0gYFxuIFxuICAgICAgICAgICAgdmFyPHByaXZhdGU+IHBvcyA6IGFycmF5PHZlYzJmLCA0PiA9IGFycmF5PHZlYzJmLCA0PihcbiAgICAgICAgICAgICAgICB2ZWMyKC0xLjAsIDEuMCksIHZlYzIoMS4wLCAxLjApLFxuICAgICAgICAgICAgICAgIHZlYzIoLTEuMCwgLTEuMCksIHZlYzIoMS4wLCAtMS4wKVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgc3RydWN0IFZlcnRleE91dHB1dCB7XG4gICAgICAgICAgICAgICAgQGJ1aWx0aW4ocG9zaXRpb24pIHBvc2l0aW9uIDogdmVjNGYsXG4gICAgICAgICAgICAgICAgQGxvY2F0aW9uKDApIHRleENvb3JkIDogdmVjMmZcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIEB2ZXJ0ZXhcbiAgICAgICAgICAgIGZuIHZlcnRleE1haW4oQGJ1aWx0aW4odmVydGV4X2luZGV4KSB2ZXJ0ZXhJbmRleCA6IHUzMikgLT4gVmVydGV4T3V0cHV0IHtcbiAgICAgICAgICAgICAgdmFyIG91dHB1dCA6IFZlcnRleE91dHB1dDtcbiAgICAgICAgICAgICAgb3V0cHV0LnRleENvb3JkID0gcG9zW3ZlcnRleEluZGV4XSAqIHZlYzJmKDAuNSwgLTAuNSkgKyB2ZWMyZigwLjUpO1xuICAgICAgICAgICAgICBvdXRwdXQucG9zaXRpb24gPSB2ZWM0Zihwb3NbdmVydGV4SW5kZXhdLCAwLCAxKTtcbiAgICAgICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgQGdyb3VwKDApIEBiaW5kaW5nKDApIHZhciBpbWdTYW1wbGVyIDogc2FtcGxlcjtcbiAgICAgICAgICAgIEBncm91cCgwKSBAYmluZGluZygxKSB2YXIgaW1nIDogdGV4dHVyZV8yZDxmMzI+O1xuXG4gICAgICAgICAgICBAZnJhZ21lbnRcbiAgICAgICAgICAgIGZuIGZyYWdtZW50TWFpbihAbG9jYXRpb24oMCkgdGV4Q29vcmQgOiB2ZWMyZikgLT4gQGxvY2F0aW9uKDApIHZlYzRmIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHRleHR1cmVTYW1wbGUoaW1nLCBpbWdTYW1wbGVyLCB0ZXhDb29yZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIGA7XG5cbiAgICAgICAgdGhpcy5zaGFkZXIgPSBuZXcgU2hhZGVyKGRldmljZSwge1xuICAgICAgICAgICAgbmFtZTogJ1dlYkdQVU1pcG1hcFJlbmRlcmVyU2hhZGVyJyxcbiAgICAgICAgICAgIHNoYWRlckxhbmd1YWdlOiBTSEFERVJMQU5HVUFHRV9XR1NMLFxuICAgICAgICAgICAgdnNoYWRlcjogY29kZSxcbiAgICAgICAgICAgIGZzaGFkZXI6IGNvZGVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gdXNpbmcgbWluaWZpZWQgcmVuZGVyaW5nLCBzbyB0aGF0J3MgdGhlIG9ubHkgZmlsdGVyIG1vZGUgd2UgbmVlZCB0byBzZXQuXG4gICAgICAgIHRoaXMubWluU2FtcGxlciA9IHdncHUuY3JlYXRlU2FtcGxlcih7IG1pbkZpbHRlcjogJ2xpbmVhcicgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGVzIG1pcG1hcHMgZm9yIHRoZSBzcGVjaWZpZWQgV2ViR1BVIHRleHR1cmUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi93ZWJncHUtdGV4dHVyZS5qcycpLldlYmdwdVRleHR1cmV9IHdlYmdwdVRleHR1cmUgLSBUaGUgdGV4dHVyZSB0byBnZW5lcmF0ZSBtaXBtYXBzIGZvci5cbiAgICAgKi9cbiAgICBnZW5lcmF0ZSh3ZWJncHVUZXh0dXJlKSB7XG5cbiAgICAgICAgLy8gaWdub3JlIHRleHR1cmUgd2l0aCBubyBtaXBtYXBzXG4gICAgICAgIGNvbnN0IHRleHR1cmVEZXNjciA9IHdlYmdwdVRleHR1cmUuZGVzY3I7XG4gICAgICAgIGlmICh0ZXh0dXJlRGVzY3IubWlwTGV2ZWxDb3VudCA8PSAxKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBub3QgYWxsIHR5cGVzIGFyZSBjdXJyZW50bHkgc3VwcG9ydGVkXG4gICAgICAgIGlmICh3ZWJncHVUZXh0dXJlLnRleHR1cmUudm9sdW1lKSB7XG4gICAgICAgICAgICBEZWJ1Zy53YXJuT25jZSgnV2ViR1BVIG1pcG1hcCBnZW5lcmF0aW9uIGlzIG5vdCBzdXBwb3J0ZWQgdm9sdW1lIHRleHR1cmUuJywgd2ViZ3B1VGV4dHVyZS50ZXh0dXJlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCB3Z3B1ID0gZGV2aWNlLndncHU7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vd2ViZ3B1LXNoYWRlci5qcycpLldlYmdwdVNoYWRlcn0gKi9cbiAgICAgICAgY29uc3Qgd2ViZ3B1U2hhZGVyID0gdGhpcy5zaGFkZXIuaW1wbDtcblxuICAgICAgICBjb25zdCBwaXBlbGluZSA9IHdncHUuY3JlYXRlUmVuZGVyUGlwZWxpbmUoe1xuICAgICAgICAgICAgbGF5b3V0OiAnYXV0bycsXG4gICAgICAgICAgICB2ZXJ0ZXg6IHtcbiAgICAgICAgICAgICAgICBtb2R1bGU6IHdlYmdwdVNoYWRlci5nZXRWZXJ0ZXhTaGFkZXJNb2R1bGUoKSxcbiAgICAgICAgICAgICAgICBlbnRyeVBvaW50OiB3ZWJncHVTaGFkZXIudmVydGV4RW50cnlQb2ludFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZyYWdtZW50OiB7XG4gICAgICAgICAgICAgICAgbW9kdWxlOiB3ZWJncHVTaGFkZXIuZ2V0RnJhZ21lbnRTaGFkZXJNb2R1bGUoKSxcbiAgICAgICAgICAgICAgICBlbnRyeVBvaW50OiB3ZWJncHVTaGFkZXIuZnJhZ21lbnRFbnRyeVBvaW50LFxuICAgICAgICAgICAgICAgIHRhcmdldHM6IFt7XG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdDogdGV4dHVyZURlc2NyLmZvcm1hdCAvLyB1c2UgdGhlIHNhbWUgZm9ybWF0IGFzIHRoZSB0ZXh0dXJlXG4gICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcmltaXRpdmU6IHtcbiAgICAgICAgICAgICAgICB0b3BvbG9neTogJ3RyaWFuZ2xlLXN0cmlwJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwocGlwZWxpbmUsICdSZW5kZXJQaXBlbGluZS1NaXBtYXBSZW5kZXJlcicpO1xuXG4gICAgICAgIGNvbnN0IG51bUZhY2VzID0gd2ViZ3B1VGV4dHVyZS50ZXh0dXJlLmN1YmVtYXAgPyA2IDogMTtcblxuICAgICAgICBjb25zdCBzcmNWaWV3cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBmYWNlID0gMDsgZmFjZSA8IG51bUZhY2VzOyBmYWNlKyspIHtcbiAgICAgICAgICAgIHNyY1ZpZXdzLnB1c2god2ViZ3B1VGV4dHVyZS5jcmVhdGVWaWV3KHtcbiAgICAgICAgICAgICAgICBkaW1lbnNpb246ICcyZCcsXG4gICAgICAgICAgICAgICAgYmFzZU1pcExldmVsOiAwLFxuICAgICAgICAgICAgICAgIG1pcExldmVsQ291bnQ6IDEsXG4gICAgICAgICAgICAgICAgYmFzZUFycmF5TGF5ZXI6IGZhY2VcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGxvb3AgdGhyb3VnaCBlYWNoIG1pcCBsZXZlbCBhbmQgcmVuZGVyIHRoZSBwcmV2aW91cyBsZXZlbCdzIGNvbnRlbnRzIGludG8gaXQuXG4gICAgICAgIGNvbnN0IGNvbW1hbmRFbmNvZGVyID0gZGV2aWNlLmNvbW1hbmRFbmNvZGVyID8/IHdncHUuY3JlYXRlQ29tbWFuZEVuY29kZXIoKTtcbiAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwoY29tbWFuZEVuY29kZXIsICdNaXBtYXBSZW5kZXJlckVuY29kZXInKTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnTUlQTUFQLVJFTkRFUkVSJyk7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCB0ZXh0dXJlRGVzY3IubWlwTGV2ZWxDb3VudDsgaSsrKSB7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgbnVtRmFjZXM7IGZhY2UrKykge1xuXG4gICAgICAgICAgICAgICAgY29uc3QgZHN0VmlldyA9IHdlYmdwdVRleHR1cmUuY3JlYXRlVmlldyh7XG4gICAgICAgICAgICAgICAgICAgIGRpbWVuc2lvbjogJzJkJyxcbiAgICAgICAgICAgICAgICAgICAgYmFzZU1pcExldmVsOiBpLFxuICAgICAgICAgICAgICAgICAgICBtaXBMZXZlbENvdW50OiAxLFxuICAgICAgICAgICAgICAgICAgICBiYXNlQXJyYXlMYXllcjogZmFjZVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcGFzc0VuY29kZXIgPSBjb21tYW5kRW5jb2Rlci5iZWdpblJlbmRlclBhc3Moe1xuICAgICAgICAgICAgICAgICAgICBjb2xvckF0dGFjaG1lbnRzOiBbe1xuICAgICAgICAgICAgICAgICAgICAgICAgdmlldzogZHN0VmlldyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvYWRPcDogJ2NsZWFyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0b3JlT3A6ICdzdG9yZSdcbiAgICAgICAgICAgICAgICAgICAgfV1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBEZWJ1Z0hlbHBlci5zZXRMYWJlbChwYXNzRW5jb2RlciwgYE1pcG1hcFJlbmRlcmVyLVBhc3NFbmNvZGVyXyR7aX1gKTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJpbmRHcm91cCA9IHdncHUuY3JlYXRlQmluZEdyb3VwKHtcbiAgICAgICAgICAgICAgICAgICAgbGF5b3V0OiBwaXBlbGluZS5nZXRCaW5kR3JvdXBMYXlvdXQoMCksXG4gICAgICAgICAgICAgICAgICAgIGVudHJpZXM6IFt7XG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5kaW5nOiAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2U6IHRoaXMubWluU2FtcGxlclxuICAgICAgICAgICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBiaW5kaW5nOiAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2U6IHNyY1ZpZXdzW2ZhY2VdXG4gICAgICAgICAgICAgICAgICAgIH1dXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5zZXRQaXBlbGluZShwaXBlbGluZSk7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuc2V0QmluZEdyb3VwKDAsIGJpbmRHcm91cCk7XG4gICAgICAgICAgICAgICAgcGFzc0VuY29kZXIuZHJhdyg0KTtcbiAgICAgICAgICAgICAgICBwYXNzRW5jb2Rlci5lbmQoKTtcblxuICAgICAgICAgICAgICAgIC8vIG5leHQgaXRlcmF0aW9uXG4gICAgICAgICAgICAgICAgc3JjVmlld3NbZmFjZV0gPSBkc3RWaWV3O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgICAgICAvLyBzdWJtaXQgdGhlIGVuY29kZWQgY29tbWFuZHMgaWYgd2UgY3JlYXRlZCB0aGUgZW5jb2RlclxuICAgICAgICBpZiAoIWRldmljZS5jb21tYW5kRW5jb2Rlcikge1xuXG4gICAgICAgICAgICBjb25zdCBjYiA9IGNvbW1hbmRFbmNvZGVyLmZpbmlzaCgpO1xuICAgICAgICAgICAgRGVidWdIZWxwZXIuc2V0TGFiZWwoY2IsICdNaXBtYXBSZW5kZXJlci1Db21tYW5kQnVmZmVyJyk7XG4gICAgICAgICAgICBkZXZpY2UuYWRkQ29tbWFuZEJ1ZmZlcihjYik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbGVhciBpbnZhbGlkYXRlZCBzdGF0ZVxuICAgICAgICBkZXZpY2UucGlwZWxpbmUgPSBudWxsO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgV2ViZ3B1TWlwbWFwUmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJXZWJncHVNaXBtYXBSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwid2dwdSIsImNvZGUiLCJzaGFkZXIiLCJTaGFkZXIiLCJuYW1lIiwic2hhZGVyTGFuZ3VhZ2UiLCJTSEFERVJMQU5HVUFHRV9XR1NMIiwidnNoYWRlciIsImZzaGFkZXIiLCJtaW5TYW1wbGVyIiwiY3JlYXRlU2FtcGxlciIsIm1pbkZpbHRlciIsImdlbmVyYXRlIiwid2ViZ3B1VGV4dHVyZSIsIl9kZXZpY2UkY29tbWFuZEVuY29kZSIsInRleHR1cmVEZXNjciIsImRlc2NyIiwibWlwTGV2ZWxDb3VudCIsInRleHR1cmUiLCJ2b2x1bWUiLCJEZWJ1ZyIsIndhcm5PbmNlIiwid2ViZ3B1U2hhZGVyIiwiaW1wbCIsInBpcGVsaW5lIiwiY3JlYXRlUmVuZGVyUGlwZWxpbmUiLCJsYXlvdXQiLCJ2ZXJ0ZXgiLCJtb2R1bGUiLCJnZXRWZXJ0ZXhTaGFkZXJNb2R1bGUiLCJlbnRyeVBvaW50IiwidmVydGV4RW50cnlQb2ludCIsImZyYWdtZW50IiwiZ2V0RnJhZ21lbnRTaGFkZXJNb2R1bGUiLCJmcmFnbWVudEVudHJ5UG9pbnQiLCJ0YXJnZXRzIiwiZm9ybWF0IiwicHJpbWl0aXZlIiwidG9wb2xvZ3kiLCJEZWJ1Z0hlbHBlciIsInNldExhYmVsIiwibnVtRmFjZXMiLCJjdWJlbWFwIiwic3JjVmlld3MiLCJmYWNlIiwicHVzaCIsImNyZWF0ZVZpZXciLCJkaW1lbnNpb24iLCJiYXNlTWlwTGV2ZWwiLCJiYXNlQXJyYXlMYXllciIsImNvbW1hbmRFbmNvZGVyIiwiY3JlYXRlQ29tbWFuZEVuY29kZXIiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsImkiLCJkc3RWaWV3IiwicGFzc0VuY29kZXIiLCJiZWdpblJlbmRlclBhc3MiLCJjb2xvckF0dGFjaG1lbnRzIiwidmlldyIsImxvYWRPcCIsInN0b3JlT3AiLCJiaW5kR3JvdXAiLCJjcmVhdGVCaW5kR3JvdXAiLCJnZXRCaW5kR3JvdXBMYXlvdXQiLCJlbnRyaWVzIiwiYmluZGluZyIsInJlc291cmNlIiwic2V0UGlwZWxpbmUiLCJzZXRCaW5kR3JvdXAiLCJkcmF3IiwiZW5kIiwicG9wR3B1TWFya2VyIiwiY2IiLCJmaW5pc2giLCJhZGRDb21tYW5kQnVmZmVyIl0sIm1hcHBpbmdzIjoiOzs7OztBQUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxvQkFBb0IsQ0FBQztFQUl2QkMsV0FBV0EsQ0FBQ0MsTUFBTSxFQUFFO0FBSHBCO0FBQUEsSUFBQSxJQUFBLENBQ0FBLE1BQU0sR0FBQSxLQUFBLENBQUEsQ0FBQTtJQUdGLElBQUksQ0FBQ0EsTUFBTSxHQUFHQSxNQUFNLENBQUE7QUFDcEIsSUFBQSxNQUFNQyxJQUFJLEdBQUdELE1BQU0sQ0FBQ0MsSUFBSSxDQUFBOztBQUV4QjtBQUNBLElBQUEsTUFBTUMsSUFBSSxHQUFJLENBQUE7QUFDdEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFFBQVMsQ0FBQSxDQUFBO0FBRUQsSUFBQSxJQUFJLENBQUNDLE1BQU0sR0FBRyxJQUFJQyxNQUFNLENBQUNKLE1BQU0sRUFBRTtBQUM3QkssTUFBQUEsSUFBSSxFQUFFLDRCQUE0QjtBQUNsQ0MsTUFBQUEsY0FBYyxFQUFFQyxtQkFBbUI7QUFDbkNDLE1BQUFBLE9BQU8sRUFBRU4sSUFBSTtBQUNiTyxNQUFBQSxPQUFPLEVBQUVQLElBQUFBO0FBQ2IsS0FBQyxDQUFDLENBQUE7O0FBRUY7QUFDQSxJQUFBLElBQUksQ0FBQ1EsVUFBVSxHQUFHVCxJQUFJLENBQUNVLGFBQWEsQ0FBQztBQUFFQyxNQUFBQSxTQUFTLEVBQUUsUUFBQTtBQUFTLEtBQUMsQ0FBQyxDQUFBO0FBQ2pFLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxRQUFRQSxDQUFDQyxhQUFh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