/**
 * @license
 * PlayCanvas Engine v1.57.1 revision 256dd83c2 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../core/debug.js';
import { BUFFER_GPUDYNAMIC, PRIMITIVE_POINTS } from './constants.js';
import { createShaderFromCode } from './program-lib/utils.js';
import { VertexBuffer } from './vertex-buffer.js';
import { DebugGraphics } from './debug-graphics.js';

class TransformFeedback {
  constructor(inputBuffer, usage = BUFFER_GPUDYNAMIC) {
    this.device = inputBuffer.device;
    const gl = this.device.gl;
    Debug.assert(inputBuffer.format.interleaved || inputBuffer.format.elements.length <= 1, "Vertex buffer used by TransformFeedback needs to be interleaved.");
    this._inputBuffer = inputBuffer;

    if (usage === BUFFER_GPUDYNAMIC && inputBuffer.usage !== usage) {
      gl.bindBuffer(gl.ARRAY_BUFFER, inputBuffer.impl.bufferId);
      gl.bufferData(gl.ARRAY_BUFFER, inputBuffer.storage, gl.DYNAMIC_COPY);
    }

    this._outputBuffer = new VertexBuffer(inputBuffer.device, inputBuffer.format, inputBuffer.numVertices, usage, inputBuffer.storage);
  }

  static createShader(graphicsDevice, vsCode, name) {
    return createShaderFromCode(graphicsDevice, vsCode, null, name, true);
  }

  destroy() {
    this._outputBuffer.destroy();
  }

  process(shader, swap = true) {
    const device = this.device;
    DebugGraphics.pushGpuMarker(device, "TransformFeedback");
    const oldRt = device.getRenderTarget();
    device.setRenderTarget(null);
    device.updateBegin();
    device.setVertexBuffer(this._inputBuffer, 0);
    device.setRaster(false);
    device.setTransformFeedbackBuffer(this._outputBuffer);
    device.setShader(shader);
    device.draw({
      type: PRIMITIVE_POINTS,
      base: 0,
      count: this._inputBuffer.numVertices,
      indexed: false
    });
    device.setTransformFeedbackBuffer(null);
    device.setRaster(true);
    device.updateEnd();
    device.setRenderTarget(oldRt);
    DebugGraphics.popGpuMarker(device);

    if (swap) {
      let tmp = this._inputBuffer.impl.bufferId;
      this._inputBuffer.impl.bufferId = this._outputBuffer.impl.bufferId;
      this._outputBuffer.impl.bufferId = tmp;
      tmp = this._inputBuffer.impl.vao;
      this._inputBuffer.impl.vao = this._outputBuffer.impl.vao;
      this._outputBuffer.impl.vao = tmp;
    }
  }

  get inputBuffer() {
    return this._inputBuffer;
  }

  get outputBuffer() {
    return this._outputBuffer;
  }

}

export { TransformFeedback };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNmb3JtLWZlZWRiYWNrLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvZ3JhcGhpY3MvdHJhbnNmb3JtLWZlZWRiYWNrLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBCVUZGRVJfR1BVRFlOQU1JQywgUFJJTUlUSVZFX1BPSU5UUyB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNoYWRlckZyb21Db2RlIH0gZnJvbSAnLi9wcm9ncmFtLWxpYi91dGlscy5qcyc7XG5pbXBvcnQgeyBWZXJ0ZXhCdWZmZXIgfSBmcm9tICcuL3ZlcnRleC1idWZmZXIuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4vZGVidWctZ3JhcGhpY3MuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gR3JhcGhpY3NEZXZpY2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL3NoYWRlci5qcycpLlNoYWRlcn0gU2hhZGVyICovXG5cbi8qKlxuICogVGhpcyBvYmplY3QgYWxsb3dzIHlvdSB0byBjb25maWd1cmUgYW5kIHVzZSB0aGUgdHJhbnNmb3JtIGZlZWRiYWNrIGZlYXR1cmUgKFdlYkdMMiBvbmx5KS4gSG93IHRvXG4gKiB1c2U6XG4gKlxuICogMS4gRmlyc3QsIGNoZWNrIHRoYXQgeW91J3JlIG9uIFdlYkdMMiwgYnkgbG9va2luZyBhdCB0aGUgYGFwcC5ncmFwaGljc0RldmljZS53ZWJnbDJgYCB2YWx1ZS5cbiAqIDIuIERlZmluZSB0aGUgb3V0cHV0cyBpbiB5b3VyIHZlcnRleCBzaGFkZXIuIFRoZSBzeW50YXggaXMgYG91dCB2ZWMzIG91dF92ZXJ0ZXhfcG9zaXRpb25gLFxuICogbm90ZSB0aGF0IHRoZXJlIG11c3QgYmUgb3V0XyBpbiB0aGUgbmFtZS4gWW91IGNhbiB0aGVuIHNpbXBseSBhc3NpZ24gdmFsdWVzIHRvIHRoZXNlIG91dHB1dHMgaW5cbiAqIFZTLiBUaGUgb3JkZXIgYW5kIHNpemUgb2Ygc2hhZGVyIG91dHB1dHMgbXVzdCBtYXRjaCB0aGUgb3V0cHV0IGJ1ZmZlciBsYXlvdXQuXG4gKiAzLiBDcmVhdGUgdGhlIHNoYWRlciB1c2luZyBgVHJhbnNmb3JtRmVlZGJhY2suY3JlYXRlU2hhZGVyKGRldmljZSwgdnNDb2RlLCB5b3VyU2hhZGVyTmFtZSlgLlxuICogNC4gQ3JlYXRlL2FjcXVpcmUgdGhlIGlucHV0IHZlcnRleCBidWZmZXIuIENhbiBiZSBhbnkgVmVydGV4QnVmZmVyLCBlaXRoZXIgbWFudWFsbHkgY3JlYXRlZCwgb3JcbiAqIGZyb20gYSBNZXNoLlxuICogNS4gQ3JlYXRlIHRoZSBUcmFuc2Zvcm1GZWVkYmFjayBvYmplY3Q6IGB2YXIgdGYgPSBuZXcgVHJhbnNmb3JtRmVlZGJhY2soaW5wdXRCdWZmZXIpYC4gVGhpc1xuICogb2JqZWN0IHdpbGwgaW50ZXJuYWxseSBjcmVhdGUgYW4gb3V0cHV0IGJ1ZmZlci5cbiAqIDYuIFJ1biB0aGUgc2hhZGVyOiBgdGYucHJvY2VzcyhzaGFkZXIpYC4gU2hhZGVyIHdpbGwgdGFrZSB0aGUgaW5wdXQgYnVmZmVyLCBwcm9jZXNzIGl0IGFuZCB3cml0ZVxuICogdG8gdGhlIG91dHB1dCBidWZmZXIsIHRoZW4gdGhlIGlucHV0L291dHB1dCBidWZmZXJzIHdpbGwgYmUgYXV0b21hdGljYWxseSBzd2FwcGVkLCBzbyB5b3UnbGxcbiAqIGltbWVkaWF0ZWx5IHNlZSB0aGUgcmVzdWx0LlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vICoqKiBzaGFkZXIgYXNzZXQgKioqXG4gKiBhdHRyaWJ1dGUgdmVjMyB2ZXJ0ZXhfcG9zaXRpb247XG4gKiBhdHRyaWJ1dGUgdmVjMyB2ZXJ0ZXhfbm9ybWFsO1xuICogYXR0cmlidXRlIHZlYzIgdmVydGV4X3RleENvb3JkMDtcbiAqIG91dCB2ZWMzIG91dF92ZXJ0ZXhfcG9zaXRpb247XG4gKiBvdXQgdmVjMyBvdXRfdmVydGV4X25vcm1hbDtcbiAqIG91dCB2ZWMyIG91dF92ZXJ0ZXhfdGV4Q29vcmQwO1xuICogdm9pZCBtYWluKHZvaWQpIHtcbiAqICAgICAvLyByZWFkIHBvc2l0aW9uIGFuZCBub3JtYWwsIHdyaXRlIG5ldyBwb3NpdGlvbiAocHVzaCBhd2F5KVxuICogICAgIG91dF92ZXJ0ZXhfcG9zaXRpb24gPSB2ZXJ0ZXhfcG9zaXRpb24gKyB2ZXJ0ZXhfbm9ybWFsICogMC4wMTtcbiAqICAgICAvLyBwYXNzIG90aGVyIGF0dHJpYnV0ZXMgdW5jaGFuZ2VkXG4gKiAgICAgb3V0X3ZlcnRleF9ub3JtYWwgPSB2ZXJ0ZXhfbm9ybWFsO1xuICogICAgIG91dF92ZXJ0ZXhfdGV4Q29vcmQwID0gdmVydGV4X3RleENvb3JkMDtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIC8vICoqKiBzY3JpcHQgYXNzZXQgKioqXG4gKiB2YXIgVHJhbnNmb3JtRXhhbXBsZSA9IHBjLmNyZWF0ZVNjcmlwdCgndHJhbnNmb3JtRXhhbXBsZScpO1xuICpcbiAqIC8vIGF0dHJpYnV0ZSB0aGF0IHJlZmVyZW5jZXMgc2hhZGVyIGFzc2V0IGFuZCBtYXRlcmlhbFxuICogVHJhbnNmb3JtRXhhbXBsZS5hdHRyaWJ1dGVzLmFkZCgnc2hhZGVyQ29kZScsIHsgdHlwZTogJ2Fzc2V0JywgYXNzZXRUeXBlOiAnc2hhZGVyJyB9KTtcbiAqIFRyYW5zZm9ybUV4YW1wbGUuYXR0cmlidXRlcy5hZGQoJ21hdGVyaWFsJywgeyB0eXBlOiAnYXNzZXQnLCBhc3NldFR5cGU6ICdtYXRlcmlhbCcgfSk7XG4gKlxuICogVHJhbnNmb3JtRXhhbXBsZS5wcm90b3R5cGUuaW5pdGlhbGl6ZSA9IGZ1bmN0aW9uKCkge1xuICogICAgIHZhciBkZXZpY2UgPSB0aGlzLmFwcC5ncmFwaGljc0RldmljZTtcbiAqICAgICB2YXIgbWVzaCA9IHBjLmNyZWF0ZVRvcnVzKGRldmljZSwgeyB0dWJlUmFkaXVzOiAwLjAxLCByaW5nUmFkaXVzOiAzIH0pO1xuICogICAgIHZhciBtZXNoSW5zdGFuY2UgPSBuZXcgcGMuTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMubWF0ZXJpYWwucmVzb3VyY2UpO1xuICogICAgIHZhciBlbnRpdHkgPSBuZXcgcGMuRW50aXR5KCk7XG4gKiAgICAgZW50aXR5LmFkZENvbXBvbmVudCgncmVuZGVyJywge1xuICogICAgICAgICB0eXBlOiAnYXNzZXQnLFxuICogICAgICAgICBtZXNoSW5zdGFuY2VzOiBbbWVzaEluc3RhbmNlXVxuICogICAgIH0pO1xuICogICAgIGFwcC5yb290LmFkZENoaWxkKGVudGl0eSk7XG4gKlxuICogICAgIC8vIGlmIHdlYmdsMiBpcyBub3Qgc3VwcG9ydGVkLCB0cmFuc2Zvcm0tZmVlZGJhY2sgaXMgbm90IGF2YWlsYWJsZVxuICogICAgIGlmICghZGV2aWNlLndlYmdsMikgcmV0dXJuO1xuICogICAgIHZhciBpbnB1dEJ1ZmZlciA9IG1lc2gudmVydGV4QnVmZmVyO1xuICogICAgIHRoaXMudGYgPSBuZXcgcGMuVHJhbnNmb3JtRmVlZGJhY2soaW5wdXRCdWZmZXIpO1xuICogICAgIHRoaXMuc2hhZGVyID0gcGMuVHJhbnNmb3JtRmVlZGJhY2suY3JlYXRlU2hhZGVyKGRldmljZSwgdGhpcy5zaGFkZXJDb2RlLnJlc291cmNlLCBcInRmTW92ZVVwXCIpO1xuICogfTtcbiAqXG4gKiBUcmFuc2Zvcm1FeGFtcGxlLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihkdCkge1xuICogICAgIGlmICghdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2Uud2ViZ2wyKSByZXR1cm47XG4gKiAgICAgdGhpcy50Zi5wcm9jZXNzKHRoaXMuc2hhZGVyKTtcbiAqIH07XG4gKiBgYGBcbiAqL1xuY2xhc3MgVHJhbnNmb3JtRmVlZGJhY2sge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBUcmFuc2Zvcm1GZWVkYmFjayBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7VmVydGV4QnVmZmVyfSBpbnB1dEJ1ZmZlciAtIFRoZSBpbnB1dCB2ZXJ0ZXggYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbdXNhZ2VdIC0gVGhlIG9wdGlvbmFsIHVzYWdlIHR5cGUgb2YgdGhlIG91dHB1dCB2ZXJ0ZXggYnVmZmVyLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBCVUZGRVJfU1RBVElDfVxuICAgICAqIC0ge0BsaW5rIEJVRkZFUl9EWU5BTUlDfVxuICAgICAqIC0ge0BsaW5rIEJVRkZFUl9TVFJFQU19XG4gICAgICogLSB7QGxpbmsgQlVGRkVSX0dQVURZTkFNSUN9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgQlVGRkVSX0dQVURZTkFNSUN9ICh3aGljaCBpcyByZWNvbW1lbmRlZCBmb3IgY29udGludW91cyB1cGRhdGUpLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGlucHV0QnVmZmVyLCB1c2FnZSA9IEJVRkZFUl9HUFVEWU5BTUlDKSB7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gaW5wdXRCdWZmZXIuZGV2aWNlO1xuICAgICAgICBjb25zdCBnbCA9IHRoaXMuZGV2aWNlLmdsO1xuXG4gICAgICAgIERlYnVnLmFzc2VydChpbnB1dEJ1ZmZlci5mb3JtYXQuaW50ZXJsZWF2ZWQgfHwgaW5wdXRCdWZmZXIuZm9ybWF0LmVsZW1lbnRzLmxlbmd0aCA8PSAxLFxuICAgICAgICAgICAgICAgICAgICAgXCJWZXJ0ZXggYnVmZmVyIHVzZWQgYnkgVHJhbnNmb3JtRmVlZGJhY2sgbmVlZHMgdG8gYmUgaW50ZXJsZWF2ZWQuXCIpO1xuXG4gICAgICAgIHRoaXMuX2lucHV0QnVmZmVyID0gaW5wdXRCdWZmZXI7XG4gICAgICAgIGlmICh1c2FnZSA9PT0gQlVGRkVSX0dQVURZTkFNSUMgJiYgaW5wdXRCdWZmZXIudXNhZ2UgIT09IHVzYWdlKSB7XG4gICAgICAgICAgICAvLyBoYXZlIHRvIHJlY3JlYXRlIGlucHV0IGJ1ZmZlciB3aXRoIG90aGVyIHVzYWdlXG4gICAgICAgICAgICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgaW5wdXRCdWZmZXIuaW1wbC5idWZmZXJJZCk7XG4gICAgICAgICAgICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgaW5wdXRCdWZmZXIuc3RvcmFnZSwgZ2wuRFlOQU1JQ19DT1BZKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX291dHB1dEJ1ZmZlciA9IG5ldyBWZXJ0ZXhCdWZmZXIoaW5wdXRCdWZmZXIuZGV2aWNlLCBpbnB1dEJ1ZmZlci5mb3JtYXQsIGlucHV0QnVmZmVyLm51bVZlcnRpY2VzLCB1c2FnZSwgaW5wdXRCdWZmZXIuc3RvcmFnZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHRyYW5zZm9ybSBmZWVkYmFjayByZWFkeSB2ZXJ0ZXggc2hhZGVyIGZyb20gY29kZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZSB1c2VkIGJ5IHRoZSByZW5kZXJlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdnNDb2RlIC0gVmVydGV4IHNoYWRlciBjb2RlLiBTaG91bGQgY29udGFpbiBvdXRwdXQgdmFyaWFibGVzIHN0YXJ0aW5nIHdpdGggXCJvdXRfXCIuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBVbmlxdWUgbmFtZSBmb3IgY2FjaGluZyB0aGUgc2hhZGVyLlxuICAgICAqIEByZXR1cm5zIHtTaGFkZXJ9IEEgc2hhZGVyIHRvIHVzZSBpbiB0aGUgcHJvY2VzcygpIGZ1bmN0aW9uLlxuICAgICAqL1xuICAgIHN0YXRpYyBjcmVhdGVTaGFkZXIoZ3JhcGhpY3NEZXZpY2UsIHZzQ29kZSwgbmFtZSkge1xuICAgICAgICByZXR1cm4gY3JlYXRlU2hhZGVyRnJvbUNvZGUoZ3JhcGhpY3NEZXZpY2UsIHZzQ29kZSwgbnVsbCwgbmFtZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVzdHJveXMgdGhlIHRyYW5zZm9ybSBmZWVkYmFjayBoZWxwZXIgb2JqZWN0LlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuX291dHB1dEJ1ZmZlci5kZXN0cm95KCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUnVucyB0aGUgc3BlY2lmaWVkIHNoYWRlciBvbiB0aGUgaW5wdXQgYnVmZmVyLCB3cml0ZXMgcmVzdWx0cyBpbnRvIHRoZSBuZXcgYnVmZmVyLCB0aGVuXG4gICAgICogb3B0aW9uYWxseSBzd2FwcyBpbnB1dC9vdXRwdXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1NoYWRlcn0gc2hhZGVyIC0gQSB2ZXJ0ZXggc2hhZGVyIHRvIHJ1bi4gU2hvdWxkIGJlIGNyZWF0ZWQgd2l0aFxuICAgICAqIHtAbGluayBUcmFuc2Zvcm1GZWVkYmFjay5jcmVhdGVTaGFkZXJ9LlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3N3YXBdIC0gU3dhcCBpbnB1dC9vdXRwdXQgYnVmZmVyIGRhdGEuIFVzZWZ1bCBmb3IgY29udGludW91cyBidWZmZXJcbiAgICAgKiBwcm9jZXNzaW5nLiBEZWZhdWx0IGlzIHRydWUuXG4gICAgICovXG4gICAgcHJvY2VzcyhzaGFkZXIsIHN3YXAgPSB0cnVlKSB7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuXG4gICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsIFwiVHJhbnNmb3JtRmVlZGJhY2tcIik7XG5cbiAgICAgICAgY29uc3Qgb2xkUnQgPSBkZXZpY2UuZ2V0UmVuZGVyVGFyZ2V0KCk7XG4gICAgICAgIGRldmljZS5zZXRSZW5kZXJUYXJnZXQobnVsbCk7XG4gICAgICAgIGRldmljZS51cGRhdGVCZWdpbigpO1xuICAgICAgICBkZXZpY2Uuc2V0VmVydGV4QnVmZmVyKHRoaXMuX2lucHV0QnVmZmVyLCAwKTtcbiAgICAgICAgZGV2aWNlLnNldFJhc3RlcihmYWxzZSk7XG4gICAgICAgIGRldmljZS5zZXRUcmFuc2Zvcm1GZWVkYmFja0J1ZmZlcih0aGlzLl9vdXRwdXRCdWZmZXIpO1xuICAgICAgICBkZXZpY2Uuc2V0U2hhZGVyKHNoYWRlcik7XG4gICAgICAgIGRldmljZS5kcmF3KHtcbiAgICAgICAgICAgIHR5cGU6IFBSSU1JVElWRV9QT0lOVFMsXG4gICAgICAgICAgICBiYXNlOiAwLFxuICAgICAgICAgICAgY291bnQ6IHRoaXMuX2lucHV0QnVmZmVyLm51bVZlcnRpY2VzLFxuICAgICAgICAgICAgaW5kZXhlZDogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICAgIGRldmljZS5zZXRUcmFuc2Zvcm1GZWVkYmFja0J1ZmZlcihudWxsKTtcbiAgICAgICAgZGV2aWNlLnNldFJhc3Rlcih0cnVlKTtcbiAgICAgICAgZGV2aWNlLnVwZGF0ZUVuZCgpO1xuICAgICAgICBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KG9sZFJ0KTtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnBvcEdwdU1hcmtlcihkZXZpY2UpO1xuXG4gICAgICAgIC8vIHN3YXAgYnVmZmVyc1xuICAgICAgICBpZiAoc3dhcCkge1xuICAgICAgICAgICAgbGV0IHRtcCA9IHRoaXMuX2lucHV0QnVmZmVyLmltcGwuYnVmZmVySWQ7XG4gICAgICAgICAgICB0aGlzLl9pbnB1dEJ1ZmZlci5pbXBsLmJ1ZmZlcklkID0gdGhpcy5fb3V0cHV0QnVmZmVyLmltcGwuYnVmZmVySWQ7XG4gICAgICAgICAgICB0aGlzLl9vdXRwdXRCdWZmZXIuaW1wbC5idWZmZXJJZCA9IHRtcDtcblxuICAgICAgICAgICAgLy8gc3dhcCBWQU9cbiAgICAgICAgICAgIHRtcCA9IHRoaXMuX2lucHV0QnVmZmVyLmltcGwudmFvO1xuICAgICAgICAgICAgdGhpcy5faW5wdXRCdWZmZXIuaW1wbC52YW8gPSB0aGlzLl9vdXRwdXRCdWZmZXIuaW1wbC52YW87XG4gICAgICAgICAgICB0aGlzLl9vdXRwdXRCdWZmZXIuaW1wbC52YW8gPSB0bXA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgY3VycmVudCBpbnB1dCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVydGV4QnVmZmVyfVxuICAgICAqL1xuICAgIGdldCBpbnB1dEJ1ZmZlcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lucHV0QnVmZmVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjdXJyZW50IG91dHB1dCBidWZmZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7VmVydGV4QnVmZmVyfVxuICAgICAqL1xuICAgIGdldCBvdXRwdXRCdWZmZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vdXRwdXRCdWZmZXI7XG4gICAgfVxufVxuXG5leHBvcnQgeyBUcmFuc2Zvcm1GZWVkYmFjayB9O1xuIl0sIm5hbWVzIjpbIlRyYW5zZm9ybUZlZWRiYWNrIiwiY29uc3RydWN0b3IiLCJpbnB1dEJ1ZmZlciIsInVzYWdlIiwiQlVGRkVSX0dQVURZTkFNSUMiLCJkZXZpY2UiLCJnbCIsIkRlYnVnIiwiYXNzZXJ0IiwiZm9ybWF0IiwiaW50ZXJsZWF2ZWQiLCJlbGVtZW50cyIsImxlbmd0aCIsIl9pbnB1dEJ1ZmZlciIsImJpbmRCdWZmZXIiLCJBUlJBWV9CVUZGRVIiLCJpbXBsIiwiYnVmZmVySWQiLCJidWZmZXJEYXRhIiwic3RvcmFnZSIsIkRZTkFNSUNfQ09QWSIsIl9vdXRwdXRCdWZmZXIiLCJWZXJ0ZXhCdWZmZXIiLCJudW1WZXJ0aWNlcyIsImNyZWF0ZVNoYWRlciIsImdyYXBoaWNzRGV2aWNlIiwidnNDb2RlIiwibmFtZSIsImNyZWF0ZVNoYWRlckZyb21Db2RlIiwiZGVzdHJveSIsInByb2Nlc3MiLCJzaGFkZXIiLCJzd2FwIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJvbGRSdCIsImdldFJlbmRlclRhcmdldCIsInNldFJlbmRlclRhcmdldCIsInVwZGF0ZUJlZ2luIiwic2V0VmVydGV4QnVmZmVyIiwic2V0UmFzdGVyIiwic2V0VHJhbnNmb3JtRmVlZGJhY2tCdWZmZXIiLCJzZXRTaGFkZXIiLCJkcmF3IiwidHlwZSIsIlBSSU1JVElWRV9QT0lOVFMiLCJiYXNlIiwiY291bnQiLCJpbmRleGVkIiwidXBkYXRlRW5kIiwicG9wR3B1TWFya2VyIiwidG1wIiwidmFvIiwib3V0cHV0QnVmZmVyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQTJFQSxNQUFNQSxpQkFBTixDQUF3QjtBQWNwQkMsRUFBQUEsV0FBVyxDQUFDQyxXQUFELEVBQWNDLEtBQUssR0FBR0MsaUJBQXRCLEVBQXlDO0FBQ2hELElBQUEsSUFBQSxDQUFLQyxNQUFMLEdBQWNILFdBQVcsQ0FBQ0csTUFBMUIsQ0FBQTtBQUNBLElBQUEsTUFBTUMsRUFBRSxHQUFHLElBQUtELENBQUFBLE1BQUwsQ0FBWUMsRUFBdkIsQ0FBQTtBQUVBQyxJQUFBQSxLQUFLLENBQUNDLE1BQU4sQ0FBYU4sV0FBVyxDQUFDTyxNQUFaLENBQW1CQyxXQUFuQixJQUFrQ1IsV0FBVyxDQUFDTyxNQUFaLENBQW1CRSxRQUFuQixDQUE0QkMsTUFBNUIsSUFBc0MsQ0FBckYsRUFDYSxrRUFEYixDQUFBLENBQUE7SUFHQSxJQUFLQyxDQUFBQSxZQUFMLEdBQW9CWCxXQUFwQixDQUFBOztJQUNBLElBQUlDLEtBQUssS0FBS0MsaUJBQVYsSUFBK0JGLFdBQVcsQ0FBQ0MsS0FBWixLQUFzQkEsS0FBekQsRUFBZ0U7TUFFNURHLEVBQUUsQ0FBQ1EsVUFBSCxDQUFjUixFQUFFLENBQUNTLFlBQWpCLEVBQStCYixXQUFXLENBQUNjLElBQVosQ0FBaUJDLFFBQWhELENBQUEsQ0FBQTtBQUNBWCxNQUFBQSxFQUFFLENBQUNZLFVBQUgsQ0FBY1osRUFBRSxDQUFDUyxZQUFqQixFQUErQmIsV0FBVyxDQUFDaUIsT0FBM0MsRUFBb0RiLEVBQUUsQ0FBQ2MsWUFBdkQsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFL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
