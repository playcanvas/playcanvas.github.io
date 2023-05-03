import { DebugHelper, Debug } from '../../../core/debug.js';
import { BindGroupFormat, BindBufferFormat } from '../bind-group-format.js';
import { UniformBufferFormat, UniformFormat } from '../uniform-buffer-format.js';
import { BlendState } from '../blend-state.js';
import { SHADERLANGUAGE_WGSL, UNIFORMTYPE_VEC4, UNIFORMTYPE_FLOAT, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CULLFACE_NONE, BINDGROUP_MESH, PRIMITIVE_TRISTRIP } from '../constants.js';
import { Shader } from '../shader.js';
import { BindGroup } from '../bind-group.js';
import { UniformBuffer } from '../uniform-buffer.js';
import { DebugGraphics } from '../debug-graphics.js';
import { DepthState } from '../depth-state.js';

const primitive = {
  type: PRIMITIVE_TRISTRIP,
  base: 0,
  count: 4,
  indexed: false
};

/**
 * A WebGPU helper class implementing a viewport clear operation. When rendering to a texture,
 * the whole surface can be cleared using loadOp, but if only a viewport needs to be cleared, or if
 * it needs to be cleared later during the rendering, this need to be archieved by rendering a quad.
 * This class renders a full-screen quad, and expects the viewport / scissor to be set up to clip
 * it to only required area.
 *
 * @ignore
 */
class WebgpuClearRenderer {
  constructor(device) {
    // shader that can write out color and depth values
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

    // uniforms
    this.uniformBuffer = new UniformBuffer(device, new UniformBufferFormat(device, [new UniformFormat('color', UNIFORMTYPE_VEC4), new UniformFormat('depth', UNIFORMTYPE_FLOAT)]));

    // format of the bind group
    const bindGroupFormat = new BindGroupFormat(device, [new BindBufferFormat(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT)]);

    // bind group
    this.bindGroup = new BindGroup(device, bindGroupFormat, this.uniformBuffer);
    DebugHelper.setName(this.bindGroup, `ClearRenderer-BindGroup_${this.bindGroup.id}`);

    // uniform data
    this.colorData = new Float32Array(4);
    this.colorId = device.scope.resolve('color');
    this.depthId = device.scope.resolve('depth');
  }
  clear(device, renderTarget, options, defaultOptions) {
    var _options$flags;
    options = options || defaultOptions;
    const flags = (_options$flags = options.flags) != null ? _options$flags : defaultOptions.flags;
    if (flags !== 0) {
      DebugGraphics.pushGpuMarker(device, 'CLEAR-RENDERER');

      // setup clear color
      if (flags & CLEARFLAG_COLOR && renderTarget.colorBuffer) {
        var _options$color;
        const color = (_options$color = options.color) != null ? _options$color : defaultOptions.color;
        this.colorData.set(color);
        device.setBlendState(BlendState.DEFAULT);
      } else {
        device.setBlendState(BlendState.NOWRITE);
      }
      this.colorId.setValue(this.colorData);

      // setup depth clear
      if (flags & CLEARFLAG_DEPTH && renderTarget.depth) {
        var _options$depth;
        const depth = (_options$depth = options.depth) != null ? _options$depth : defaultOptions.depth;
        this.depthId.setValue(depth);
        device.setDepthState(DepthState.WRITEDEPTH);
      } else {
        this.depthId.setValue(1);
        device.setDepthState(DepthState.NODEPTH);
      }

      // setup stencil clear
      if (flags & CLEARFLAG_STENCIL && renderTarget.stencil) {
        Debug.warnOnce("ClearRenderer does not support stencil clear at the moment");
      }
      device.setCullMode(CULLFACE_NONE);

      // render 4 verticies without vertex buffer
      device.setShader(this.shader);
      const bindGroup = this.bindGroup;
      if (bindGroup.defaultUniformBuffer) {
        bindGroup.defaultUniformBuffer.update();
      }
      bindGroup.update();
      device.setBindGroup(BINDGROUP_MESH, bindGroup);
      device.draw(primitive);
      DebugGraphics.popGpuMarker(device);
    }
  }
}

export { WebgpuClearRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LWNsZWFyLXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvd2ViZ3B1L3dlYmdwdS1jbGVhci1yZW5kZXJlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZywgRGVidWdIZWxwZXIgfSBmcm9tIFwiLi4vLi4vLi4vY29yZS9kZWJ1Zy5qc1wiO1xuaW1wb3J0IHsgQmluZEJ1ZmZlckZvcm1hdCwgQmluZEdyb3VwRm9ybWF0IH0gZnJvbSBcIi4uL2JpbmQtZ3JvdXAtZm9ybWF0LmpzXCI7XG5pbXBvcnQgeyBVbmlmb3JtQnVmZmVyRm9ybWF0LCBVbmlmb3JtRm9ybWF0IH0gZnJvbSBcIi4uL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qc1wiO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gXCIuLi9ibGVuZC1zdGF0ZS5qc1wiO1xuaW1wb3J0IHtcbiAgICBDVUxMRkFDRV9OT05FLFxuICAgIFBSSU1JVElWRV9UUklTVFJJUCwgU0hBREVSTEFOR1VBR0VfV0dTTCwgU0hBREVSU1RBR0VfRlJBR01FTlQsIFNIQURFUlNUQUdFX1ZFUlRFWCxcbiAgICBVTklGT1JNVFlQRV9GTE9BVCwgVU5JRk9STVRZUEVfVkVDNCwgVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUsIEJJTkRHUk9VUF9NRVNILCBDTEVBUkZMQUdfQ09MT1IsIENMRUFSRkxBR19ERVBUSCwgQ0xFQVJGTEFHX1NURU5DSUxcbn0gZnJvbSBcIi4uL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHsgU2hhZGVyIH0gZnJvbSBcIi4uL3NoYWRlci5qc1wiO1xuaW1wb3J0IHsgQmluZEdyb3VwIH0gZnJvbSBcIi4uL2JpbmQtZ3JvdXAuanNcIjtcbmltcG9ydCB7IFVuaWZvcm1CdWZmZXIgfSBmcm9tIFwiLi4vdW5pZm9ybS1idWZmZXIuanNcIjtcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tIFwiLi4vZGVidWctZ3JhcGhpY3MuanNcIjtcbmltcG9ydCB7IERlcHRoU3RhdGUgfSBmcm9tIFwiLi4vZGVwdGgtc3RhdGUuanNcIjtcblxuY29uc3QgcHJpbWl0aXZlID0ge1xuICAgIHR5cGU6IFBSSU1JVElWRV9UUklTVFJJUCxcbiAgICBiYXNlOiAwLFxuICAgIGNvdW50OiA0LFxuICAgIGluZGV4ZWQ6IGZhbHNlXG59O1xuXG4vKipcbiAqIEEgV2ViR1BVIGhlbHBlciBjbGFzcyBpbXBsZW1lbnRpbmcgYSB2aWV3cG9ydCBjbGVhciBvcGVyYXRpb24uIFdoZW4gcmVuZGVyaW5nIHRvIGEgdGV4dHVyZSxcbiAqIHRoZSB3aG9sZSBzdXJmYWNlIGNhbiBiZSBjbGVhcmVkIHVzaW5nIGxvYWRPcCwgYnV0IGlmIG9ubHkgYSB2aWV3cG9ydCBuZWVkcyB0byBiZSBjbGVhcmVkLCBvciBpZlxuICogaXQgbmVlZHMgdG8gYmUgY2xlYXJlZCBsYXRlciBkdXJpbmcgdGhlIHJlbmRlcmluZywgdGhpcyBuZWVkIHRvIGJlIGFyY2hpZXZlZCBieSByZW5kZXJpbmcgYSBxdWFkLlxuICogVGhpcyBjbGFzcyByZW5kZXJzIGEgZnVsbC1zY3JlZW4gcXVhZCwgYW5kIGV4cGVjdHMgdGhlIHZpZXdwb3J0IC8gc2Npc3NvciB0byBiZSBzZXQgdXAgdG8gY2xpcFxuICogaXQgdG8gb25seSByZXF1aXJlZCBhcmVhLlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgV2ViZ3B1Q2xlYXJSZW5kZXJlciB7XG4gICAgY29uc3RydWN0b3IoZGV2aWNlKSB7XG5cbiAgICAgICAgLy8gc2hhZGVyIHRoYXQgY2FuIHdyaXRlIG91dCBjb2xvciBhbmQgZGVwdGggdmFsdWVzXG4gICAgICAgIGNvbnN0IGNvZGUgPSBgXG5cbiAgICAgICAgICAgIHN0cnVjdCB1Yl9tZXNoIHtcbiAgICAgICAgICAgICAgICBjb2xvciA6IHZlYzRmLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmMzJcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgQGdyb3VwKDApIEBiaW5kaW5nKDApIHZhcjx1bmlmb3JtPiB1Yk1lc2ggOiB1Yl9tZXNoO1xuXG4gICAgICAgICAgICB2YXI8cHJpdmF0ZT4gcG9zIDogYXJyYXk8dmVjMmYsIDQ+ID0gYXJyYXk8dmVjMmYsIDQ+KFxuICAgICAgICAgICAgICAgIHZlYzIoLTEuMCwgMS4wKSwgdmVjMigxLjAsIDEuMCksXG4gICAgICAgICAgICAgICAgdmVjMigtMS4wLCAtMS4wKSwgdmVjMigxLjAsIC0xLjApXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBzdHJ1Y3QgVmVydGV4T3V0cHV0IHtcbiAgICAgICAgICAgICAgICBAYnVpbHRpbihwb3NpdGlvbikgcG9zaXRpb24gOiB2ZWM0ZlxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBAdmVydGV4XG4gICAgICAgICAgICBmbiB2ZXJ0ZXhNYWluKEBidWlsdGluKHZlcnRleF9pbmRleCkgdmVydGV4SW5kZXggOiB1MzIpIC0+IFZlcnRleE91dHB1dCB7XG4gICAgICAgICAgICAgICAgdmFyIG91dHB1dCA6IFZlcnRleE91dHB1dDtcbiAgICAgICAgICAgICAgICBvdXRwdXQucG9zaXRpb24gPSB2ZWM0KHBvc1t2ZXJ0ZXhJbmRleF0sIHViTWVzaC5kZXB0aCwgMS4wKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBAZnJhZ21lbnRcbiAgICAgICAgICAgIGZuIGZyYWdtZW50TWFpbigpIC0+IEBsb2NhdGlvbigwKSB2ZWM0ZiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHViTWVzaC5jb2xvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgYDtcblxuICAgICAgICB0aGlzLnNoYWRlciA9IG5ldyBTaGFkZXIoZGV2aWNlLCB7XG4gICAgICAgICAgICBuYW1lOiAnV2ViR1BVQ2xlYXJSZW5kZXJlclNoYWRlcicsXG4gICAgICAgICAgICBzaGFkZXJMYW5ndWFnZTogU0hBREVSTEFOR1VBR0VfV0dTTCxcbiAgICAgICAgICAgIHZzaGFkZXI6IGNvZGUsXG4gICAgICAgICAgICBmc2hhZGVyOiBjb2RlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHVuaWZvcm1zXG4gICAgICAgIHRoaXMudW5pZm9ybUJ1ZmZlciA9IG5ldyBVbmlmb3JtQnVmZmVyKGRldmljZSwgbmV3IFVuaWZvcm1CdWZmZXJGb3JtYXQoZGV2aWNlLCBbXG4gICAgICAgICAgICBuZXcgVW5pZm9ybUZvcm1hdCgnY29sb3InLCBVTklGT1JNVFlQRV9WRUM0KSxcbiAgICAgICAgICAgIG5ldyBVbmlmb3JtRm9ybWF0KCdkZXB0aCcsIFVOSUZPUk1UWVBFX0ZMT0FUKVxuICAgICAgICBdKSk7XG5cbiAgICAgICAgLy8gZm9ybWF0IG9mIHRoZSBiaW5kIGdyb3VwXG4gICAgICAgIGNvbnN0IGJpbmRHcm91cEZvcm1hdCA9IG5ldyBCaW5kR3JvdXBGb3JtYXQoZGV2aWNlLCBbXG4gICAgICAgICAgICBuZXcgQmluZEJ1ZmZlckZvcm1hdChVTklGT1JNX0JVRkZFUl9ERUZBVUxUX1NMT1RfTkFNRSwgU0hBREVSU1RBR0VfVkVSVEVYIHwgU0hBREVSU1RBR0VfRlJBR01FTlQpXG4gICAgICAgIF0pO1xuXG4gICAgICAgIC8vIGJpbmQgZ3JvdXBcbiAgICAgICAgdGhpcy5iaW5kR3JvdXAgPSBuZXcgQmluZEdyb3VwKGRldmljZSwgYmluZEdyb3VwRm9ybWF0LCB0aGlzLnVuaWZvcm1CdWZmZXIpO1xuICAgICAgICBEZWJ1Z0hlbHBlci5zZXROYW1lKHRoaXMuYmluZEdyb3VwLCBgQ2xlYXJSZW5kZXJlci1CaW5kR3JvdXBfJHt0aGlzLmJpbmRHcm91cC5pZH1gKTtcblxuICAgICAgICAvLyB1bmlmb3JtIGRhdGFcbiAgICAgICAgdGhpcy5jb2xvckRhdGEgPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuICAgICAgICB0aGlzLmNvbG9ySWQgPSBkZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY29sb3InKTtcbiAgICAgICAgdGhpcy5kZXB0aElkID0gZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2RlcHRoJyk7XG4gICAgfVxuXG4gICAgY2xlYXIoZGV2aWNlLCByZW5kZXJUYXJnZXQsIG9wdGlvbnMsIGRlZmF1bHRPcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IGRlZmF1bHRPcHRpb25zO1xuXG4gICAgICAgIGNvbnN0IGZsYWdzID0gb3B0aW9ucy5mbGFncyA/PyBkZWZhdWx0T3B0aW9ucy5mbGFncztcbiAgICAgICAgaWYgKGZsYWdzICE9PSAwKSB7XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdDTEVBUi1SRU5ERVJFUicpO1xuXG4gICAgICAgICAgICAvLyBzZXR1cCBjbGVhciBjb2xvclxuICAgICAgICAgICAgaWYgKChmbGFncyAmIENMRUFSRkxBR19DT0xPUikgJiYgcmVuZGVyVGFyZ2V0LmNvbG9yQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29sb3IgPSBvcHRpb25zLmNvbG9yID8/IGRlZmF1bHRPcHRpb25zLmNvbG9yO1xuICAgICAgICAgICAgICAgIHRoaXMuY29sb3JEYXRhLnNldChjb2xvcik7XG5cbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShCbGVuZFN0YXRlLkRFRkFVTFQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0QmxlbmRTdGF0ZShCbGVuZFN0YXRlLk5PV1JJVEUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5jb2xvcklkLnNldFZhbHVlKHRoaXMuY29sb3JEYXRhKTtcblxuICAgICAgICAgICAgLy8gc2V0dXAgZGVwdGggY2xlYXJcbiAgICAgICAgICAgIGlmICgoZmxhZ3MgJiBDTEVBUkZMQUdfREVQVEgpICYmIHJlbmRlclRhcmdldC5kZXB0aCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlcHRoID0gb3B0aW9ucy5kZXB0aCA/PyBkZWZhdWx0T3B0aW9ucy5kZXB0aDtcbiAgICAgICAgICAgICAgICB0aGlzLmRlcHRoSWQuc2V0VmFsdWUoZGVwdGgpO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFN0YXRlKERlcHRoU3RhdGUuV1JJVEVERVBUSCk7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kZXB0aElkLnNldFZhbHVlKDEpO1xuICAgICAgICAgICAgICAgIGRldmljZS5zZXREZXB0aFN0YXRlKERlcHRoU3RhdGUuTk9ERVBUSCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNldHVwIHN0ZW5jaWwgY2xlYXJcbiAgICAgICAgICAgIGlmICgoZmxhZ3MgJiBDTEVBUkZMQUdfU1RFTkNJTCkgJiYgcmVuZGVyVGFyZ2V0LnN0ZW5jaWwpIHtcbiAgICAgICAgICAgICAgICBEZWJ1Zy53YXJuT25jZShcIkNsZWFyUmVuZGVyZXIgZG9lcyBub3Qgc3VwcG9ydCBzdGVuY2lsIGNsZWFyIGF0IHRoZSBtb21lbnRcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRldmljZS5zZXRDdWxsTW9kZShDVUxMRkFDRV9OT05FKTtcblxuICAgICAgICAgICAgLy8gcmVuZGVyIDQgdmVydGljaWVzIHdpdGhvdXQgdmVydGV4IGJ1ZmZlclxuICAgICAgICAgICAgZGV2aWNlLnNldFNoYWRlcih0aGlzLnNoYWRlcik7XG5cbiAgICAgICAgICAgIGNvbnN0IGJpbmRHcm91cCA9IHRoaXMuYmluZEdyb3VwO1xuICAgICAgICAgICAgaWYgKGJpbmRHcm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIGJpbmRHcm91cC5kZWZhdWx0VW5pZm9ybUJ1ZmZlci51cGRhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJpbmRHcm91cC51cGRhdGUoKTtcbiAgICAgICAgICAgIGRldmljZS5zZXRCaW5kR3JvdXAoQklOREdST1VQX01FU0gsIGJpbmRHcm91cCk7XG5cbiAgICAgICAgICAgIGRldmljZS5kcmF3KHByaW1pdGl2ZSk7XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IFdlYmdwdUNsZWFyUmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJwcmltaXRpdmUiLCJ0eXBlIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiYmFzZSIsImNvdW50IiwiaW5kZXhlZCIsIldlYmdwdUNsZWFyUmVuZGVyZXIiLCJjb25zdHJ1Y3RvciIsImRldmljZSIsImNvZGUiLCJzaGFkZXIiLCJTaGFkZXIiLCJuYW1lIiwic2hhZGVyTGFuZ3VhZ2UiLCJTSEFERVJMQU5HVUFHRV9XR1NMIiwidnNoYWRlciIsImZzaGFkZXIiLCJ1bmlmb3JtQnVmZmVyIiwiVW5pZm9ybUJ1ZmZlciIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJVbmlmb3JtRm9ybWF0IiwiVU5JRk9STVRZUEVfVkVDNCIsIlVOSUZPUk1UWVBFX0ZMT0FUIiwiYmluZEdyb3VwRm9ybWF0IiwiQmluZEdyb3VwRm9ybWF0IiwiQmluZEJ1ZmZlckZvcm1hdCIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJiaW5kR3JvdXAiLCJCaW5kR3JvdXAiLCJEZWJ1Z0hlbHBlciIsInNldE5hbWUiLCJpZCIsImNvbG9yRGF0YSIsIkZsb2F0MzJBcnJheSIsImNvbG9ySWQiLCJzY29wZSIsInJlc29sdmUiLCJkZXB0aElkIiwiY2xlYXIiLCJyZW5kZXJUYXJnZXQiLCJvcHRpb25zIiwiZGVmYXVsdE9wdGlvbnMiLCJfb3B0aW9ucyRmbGFncyIsImZsYWdzIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJDTEVBUkZMQUdfQ09MT1IiLCJjb2xvckJ1ZmZlciIsIl9vcHRpb25zJGNvbG9yIiwiY29sb3IiLCJzZXQiLCJzZXRCbGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsIkRFRkFVTFQiLCJOT1dSSVRFIiwic2V0VmFsdWUiLCJDTEVBUkZMQUdfREVQVEgiLCJkZXB0aCIsIl9vcHRpb25zJGRlcHRoIiwic2V0RGVwdGhTdGF0ZSIsIkRlcHRoU3RhdGUiLCJXUklURURFUFRIIiwiTk9ERVBUSCIsIkNMRUFSRkxBR19TVEVOQ0lMIiwic3RlbmNpbCIsIkRlYnVnIiwid2Fybk9uY2UiLCJzZXRDdWxsTW9kZSIsIkNVTExGQUNFX05PTkUiLCJzZXRTaGFkZXIiLCJkZWZhdWx0VW5pZm9ybUJ1ZmZlciIsInVwZGF0ZSIsInNldEJpbmRHcm91cCIsIkJJTkRHUk9VUF9NRVNIIiwiZHJhdyIsInBvcEdwdU1hcmtlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFlQSxNQUFNQSxTQUFTLEdBQUc7QUFDZEMsRUFBQUEsSUFBSSxFQUFFQyxrQkFBa0I7QUFDeEJDLEVBQUFBLElBQUksRUFBRSxDQUFDO0FBQ1BDLEVBQUFBLEtBQUssRUFBRSxDQUFDO0FBQ1JDLEVBQUFBLE9BQU8sRUFBRSxLQUFBO0FBQ2IsQ0FBQyxDQUFBOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLG1CQUFtQixDQUFDO0VBQ3RCQyxXQUFXQSxDQUFDQyxNQUFNLEVBQUU7QUFFaEI7QUFDQSxJQUFBLE1BQU1DLElBQUksR0FBSSxDQUFBO0FBQ3RCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsUUFBUyxDQUFBLENBQUE7QUFFRCxJQUFBLElBQUksQ0FBQ0MsTUFBTSxHQUFHLElBQUlDLE1BQU0sQ0FBQ0gsTUFBTSxFQUFFO0FBQzdCSSxNQUFBQSxJQUFJLEVBQUUsMkJBQTJCO0FB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
