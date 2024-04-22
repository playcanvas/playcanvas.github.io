import { BindGroupFormat, BindUniformBufferFormat } from '../bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../uniform-buffer-format.js';
import { BlendState } from '../blend-state.js';
import { SHADERLANGUAGE_WGSL, UNIFORMTYPE_VEC4, UNIFORMTYPE_FLOAT, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_NONE, BINDGROUP_MESH, PRIMITIVE_TRISTRIP } from '../constants.js';
import { Shader } from '../shader.js';
import { BindGroup } from '../bind-group.js';
import { UniformBuffer } from '../uniform-buffer.js';
import { DepthState } from '../depth-state.js';

const primitive = {
  type: PRIMITIVE_TRISTRIP,
  base: 0,
  count: 4,
  indexed: false
};
class WebgpuClearRenderer {
  constructor(device) {
    const code = `

            struct ub_mesh {
                color : vec4f,
                depth: f32
            }

            @group(0) @binding(0) var<uniform> ubMesh : ub_mesh;

            var<private> pos : array<vec2f, 4> = array<vec2f, 4>(
                vec2(-1.0, 1.0), vec2(1.0, 1.0),
                vec2(-1.0, -1.0), vec2(1.0, -1.0)
            );

            struct VertexOutput {
                @builtin(position) position : vec4f
            }

            @vertex
            fn vertexMain(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
                var output : VertexOutput;
                output.position = vec4(pos[vertexIndex], ubMesh.depth, 1.0);
                return output;
            }

            @fragment
            fn fragmentMain() -> @location(0) vec4f {
                return ubMesh.color;
            }
        `;
    this.shader = new Shader(device, {
      name: 'WebGPUClearRendererShader',
      shaderLanguage: SHADERLANGUAGE_WGSL,
      vshader: code,
      fshader: code
    });
    this.uniformBuffer = new UniformBuffer(device, new UniformBufferFormat(device, [new UniformFormat('color', UNIFORMTYPE_VEC4), new UniformFormat('depth', UNIFORMTYPE_FLOAT)]), false);
    const bindGroupFormat = new BindGroupFormat(device, [new BindUniformBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)]);
    this.bindGroup = new BindGroup(device, bindGroupFormat, this.uniformBuffer);
    this.colorData = new Float32Array(4);
    this.colorId = device.scope.resolve('color');
    this.depthId = device.scope.resolve('depth');
  }
  destroy() {
    this.shader.destroy();
    this.shader = null;
    this.uniformBuffer.destroy();
    this.uniformBuffer = null;
    this.bindGroup.destroy();
    this.bindGroup = null;
  }
  clear(device, renderTarget, options, defaultOptions) {
    var _options$flags;
    options = options || defaultOptions;
    const flags = (_options$flags = options.flags) != null ? _options$flags : defaultOptions.flags;
    if (flags !== 0) {
      if (flags & CLEARFLAG_COLOR && (renderTarget.colorBuffer || renderTarget.impl.assignedColorTexture)) {
        var _options$color;
        const color = (_options$color = options.color) != null ? _options$color : defaultOptions.color;
        this.colorData.set(color);
        device.setBlendState(BlendState.NOBLEND);
      } else {
        device.setBlendState(BlendState.NOWRITE);
      }
      this.colorId.setValue(this.colorData);
      if (flags & CLEARFLAG_DEPTH && renderTarget.depth) {
        var _options$depth;
        const depth = (_options$depth = options.depth) != null ? _options$depth : defaultOptions.depth;
        this.depthId.setValue(depth);
        device.setDepthState(DepthState.WRITEDEPTH);
      } else {
        this.depthId.setValue(1);
        device.setDepthState(DepthState.NODEPTH);
      }
      if (flags & CLEARFLAG_STENCIL && renderTarget.stencil) ;
      device.setCullMode(CULLFACE_NONE);
      device.setShader(this.shader);
      const bindGroup = this.bindGroup;
      bindGroup.defaultUniformBuffer.update();
      bindGroup.update();
      device.setBindGroup(BINDGROUP_MESH, bindGroup);
      device.draw(primitive);
    }
  }
}

export { WebgpuClearRenderer };
