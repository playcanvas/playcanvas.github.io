import { Vec4 } from '../../core/math/vec4.js';
import { Mat4 } from '../../core/math/mat4.js';
import { PIXELFORMAT_RGBA8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE } from '../../platform/graphics/constants.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { drawQuadWithShader } from '../graphics/quad-render-utils.js';
import { Texture } from '../../platform/graphics/texture.js';
import { LIGHTTYPE_OMNI } from '../constants.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { LightCamera } from './light-camera.js';
import { BlendState } from '../../platform/graphics/blend-state.js';

const textureBlitVertexShader = `
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
    }`;
const textureBlitFragmentShader = `
    varying vec2 uv0;
    uniform sampler2D blitTexture;
    void main(void) {
        gl_FragColor = texture2D(blitTexture, uv0);
    }`;

// shader runs for each face, with inViewProj matrix representing a face camera
const textureCubeBlitFragmentShader = `
    varying vec2 uv0;
    uniform samplerCube blitTexture;
    uniform mat4 invViewProj;
    void main(void) {
        vec4 projPos = vec4(uv0 * 2.0 - 1.0, 0.5, 1.0);
        vec4 worldPos = invViewProj * projPos;
        gl_FragColor = textureCube(blitTexture, worldPos.xyz);
    }`;
const _viewport = new Vec4();

// helper class used by clustered lighting system to render cookies into the texture atlas, similarly to shadow renderer
class CookieRenderer {
  constructor(device, lightTextureAtlas) {
    this.device = device;
    this.lightTextureAtlas = lightTextureAtlas;
    this.blitShader2d = null;
    this.blitShaderCube = null;
    this.blitTextureId = null;
    this.invViewProjId = null;
  }
  destroy() {}
  getShader(shader, fragment) {
    if (!this[shader]) this[shader] = createShaderFromCode(this.device, textureBlitVertexShader, fragment, `cookie_renderer_${shader}`);
    if (!this.blitTextureId) this.blitTextureId = this.device.scope.resolve('blitTexture');
    if (!this.invViewProjId) this.invViewProjId = this.device.scope.resolve('invViewProj');
    return this[shader];
  }
  get shader2d() {
    return this.getShader('blitShader2d', textureBlitFragmentShader);
  }
  get shaderCube() {
    return this.getShader('blitShaderCube', textureCubeBlitFragmentShader);
  }
  static createTexture(device, resolution) {
    const texture = new Texture(device, {
      name: 'CookieAtlas',
      width: resolution,
      height: resolution,
      format: PIXELFORMAT_RGBA8,
      cubemap: false,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    return texture;
  }

  // for rendering of cookies, store inverse view projection matrices for 6 faces, allowing cubemap faces to be copied into the atlas

  initInvViewProjMatrices() {
    if (!CookieRenderer._invViewProjMatrices) {
      CookieRenderer._invViewProjMatrices = [];
      for (let face = 0; face < 6; face++) {
        const camera = LightCamera.create(null, LIGHTTYPE_OMNI, face);
        const projMat = camera.projectionMatrix;
        const viewMat = camera.node.getLocalTransform().clone().invert();
        CookieRenderer._invViewProjMatrices[face] = new Mat4().mul2(projMat, viewMat).invert();
      }
    }
  }
  render(light, renderTarget) {
    if (light.enabled && light.cookie && light.visibleThisFrame) {
      DebugGraphics.pushGpuMarker(this.device, `COOKIE ${light._node.name}`);
      const faceCount = light.numShadowFaces;
      const shader = faceCount > 1 ? this.shaderCube : this.shader2d;
      const device = this.device;
      if (faceCount > 1) {
        this.initInvViewProjMatrices();
      }

      // source texture
      this.blitTextureId.setValue(light.cookie);

      // render state
      device.setBlendState(BlendState.DEFAULT);

      // render it to a viewport of the target
      for (let face = 0; face < faceCount; face++) {
        _viewport.copy(light.atlasViewport);
        if (faceCount > 1) {
          // for cubemap, render to one of the 3x3 sub-areas
          const smallSize = _viewport.z / 3;
          const offset = this.lightTextureAtlas.cubeSlotsOffsets[face];
          _viewport.x += smallSize * offset.x;
          _viewport.y += smallSize * offset.y;
          _viewport.z = smallSize;
          _viewport.w = smallSize;

          // cubemap face projection uniform
          this.invViewProjId.setValue(CookieRenderer._invViewProjMatrices[face].data);
        }
        _viewport.mulScalar(renderTarget.colorBuffer.width);
        drawQuadWithShader(device, renderTarget, shader, _viewport);
      }
      DebugGraphics.popGpuMarker(this.device);
    }
  }
}
CookieRenderer._invViewProjMatrices = null;

export { CookieRenderer };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29va2llLXJlbmRlcmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyZXIvY29va2llLXJlbmRlcmVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5pbXBvcnQgeyBNYXQ0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdDQuanMnO1xuXG5pbXBvcnQgeyBBRERSRVNTX0NMQU1QX1RPX0VER0UsIEZJTFRFUl9ORUFSRVNULCBQSVhFTEZPUk1BVF9SR0JBOCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZGVidWctZ3JhcGhpY3MuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi4vZ3JhcGhpY3MvcXVhZC1yZW5kZXItdXRpbHMuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBMSUdIVFRZUEVfT01OSSB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaGFkZXJGcm9tQ29kZSB9IGZyb20gJy4uL3NoYWRlci1saWIvdXRpbHMuanMnO1xuaW1wb3J0IHsgTGlnaHRDYW1lcmEgfSBmcm9tICcuL2xpZ2h0LWNhbWVyYS5qcyc7XG5pbXBvcnQgeyBCbGVuZFN0YXRlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvYmxlbmQtc3RhdGUuanMnO1xuXG5jb25zdCB0ZXh0dXJlQmxpdFZlcnRleFNoYWRlciA9IGBcbiAgICBhdHRyaWJ1dGUgdmVjMiB2ZXJ0ZXhfcG9zaXRpb247XG4gICAgdmFyeWluZyB2ZWMyIHV2MDtcbiAgICB2b2lkIG1haW4odm9pZCkge1xuICAgICAgICBnbF9Qb3NpdGlvbiA9IHZlYzQodmVydGV4X3Bvc2l0aW9uLCAwLjUsIDEuMCk7XG4gICAgICAgIHV2MCA9IHZlcnRleF9wb3NpdGlvbi54eSAqIDAuNSArIDAuNTtcbiAgICB9YDtcblxuY29uc3QgdGV4dHVyZUJsaXRGcmFnbWVudFNoYWRlciA9IGBcbiAgICB2YXJ5aW5nIHZlYzIgdXYwO1xuICAgIHVuaWZvcm0gc2FtcGxlcjJEIGJsaXRUZXh0dXJlO1xuICAgIHZvaWQgbWFpbih2b2lkKSB7XG4gICAgICAgIGdsX0ZyYWdDb2xvciA9IHRleHR1cmUyRChibGl0VGV4dHVyZSwgdXYwKTtcbiAgICB9YDtcblxuLy8gc2hhZGVyIHJ1bnMgZm9yIGVhY2ggZmFjZSwgd2l0aCBpblZpZXdQcm9qIG1hdHJpeCByZXByZXNlbnRpbmcgYSBmYWNlIGNhbWVyYVxuY29uc3QgdGV4dHVyZUN1YmVCbGl0RnJhZ21lbnRTaGFkZXIgPSBgXG4gICAgdmFyeWluZyB2ZWMyIHV2MDtcbiAgICB1bmlmb3JtIHNhbXBsZXJDdWJlIGJsaXRUZXh0dXJlO1xuICAgIHVuaWZvcm0gbWF0NCBpbnZWaWV3UHJvajtcbiAgICB2b2lkIG1haW4odm9pZCkge1xuICAgICAgICB2ZWM0IHByb2pQb3MgPSB2ZWM0KHV2MCAqIDIuMCAtIDEuMCwgMC41LCAxLjApO1xuICAgICAgICB2ZWM0IHdvcmxkUG9zID0gaW52Vmlld1Byb2ogKiBwcm9qUG9zO1xuICAgICAgICBnbF9GcmFnQ29sb3IgPSB0ZXh0dXJlQ3ViZShibGl0VGV4dHVyZSwgd29ybGRQb3MueHl6KTtcbiAgICB9YDtcblxuY29uc3QgX3ZpZXdwb3J0ID0gbmV3IFZlYzQoKTtcblxuLy8gaGVscGVyIGNsYXNzIHVzZWQgYnkgY2x1c3RlcmVkIGxpZ2h0aW5nIHN5c3RlbSB0byByZW5kZXIgY29va2llcyBpbnRvIHRoZSB0ZXh0dXJlIGF0bGFzLCBzaW1pbGFybHkgdG8gc2hhZG93IHJlbmRlcmVyXG5jbGFzcyBDb29raWVSZW5kZXJlciB7XG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBsaWdodFRleHR1cmVBdGxhcykge1xuICAgICAgICB0aGlzLmRldmljZSA9IGRldmljZTtcbiAgICAgICAgdGhpcy5saWdodFRleHR1cmVBdGxhcyA9IGxpZ2h0VGV4dHVyZUF0bGFzO1xuXG4gICAgICAgIHRoaXMuYmxpdFNoYWRlcjJkID0gbnVsbDtcbiAgICAgICAgdGhpcy5ibGl0U2hhZGVyQ3ViZSA9IG51bGw7XG4gICAgICAgIHRoaXMuYmxpdFRleHR1cmVJZCA9IG51bGw7XG4gICAgICAgIHRoaXMuaW52Vmlld1Byb2pJZCA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICB9XG5cbiAgICBnZXRTaGFkZXIoc2hhZGVyLCBmcmFnbWVudCkge1xuXG4gICAgICAgIGlmICghdGhpc1tzaGFkZXJdKVxuICAgICAgICAgICAgdGhpc1tzaGFkZXJdID0gY3JlYXRlU2hhZGVyRnJvbUNvZGUodGhpcy5kZXZpY2UsIHRleHR1cmVCbGl0VmVydGV4U2hhZGVyLCBmcmFnbWVudCwgYGNvb2tpZV9yZW5kZXJlcl8ke3NoYWRlcn1gKTtcblxuICAgICAgICBpZiAoIXRoaXMuYmxpdFRleHR1cmVJZClcbiAgICAgICAgICAgIHRoaXMuYmxpdFRleHR1cmVJZCA9IHRoaXMuZGV2aWNlLnNjb3BlLnJlc29sdmUoJ2JsaXRUZXh0dXJlJyk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmludlZpZXdQcm9qSWQpXG4gICAgICAgICAgICB0aGlzLmludlZpZXdQcm9qSWQgPSB0aGlzLmRldmljZS5zY29wZS5yZXNvbHZlKCdpbnZWaWV3UHJvaicpO1xuXG4gICAgICAgIHJldHVybiB0aGlzW3NoYWRlcl07XG4gICAgfVxuXG4gICAgZ2V0IHNoYWRlcjJkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRTaGFkZXIoJ2JsaXRTaGFkZXIyZCcsIHRleHR1cmVCbGl0RnJhZ21lbnRTaGFkZXIpO1xuICAgIH1cblxuICAgIGdldCBzaGFkZXJDdWJlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRTaGFkZXIoJ2JsaXRTaGFkZXJDdWJlJywgdGV4dHVyZUN1YmVCbGl0RnJhZ21lbnRTaGFkZXIpO1xuICAgIH1cblxuICAgIHN0YXRpYyBjcmVhdGVUZXh0dXJlKGRldmljZSwgcmVzb2x1dGlvbikge1xuXG4gICAgICAgIGNvbnN0IHRleHR1cmUgPSBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWU6ICdDb29raWVBdGxhcycsXG4gICAgICAgICAgICB3aWR0aDogcmVzb2x1dGlvbixcbiAgICAgICAgICAgIGhlaWdodDogcmVzb2x1dGlvbixcbiAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUkdCQTgsXG4gICAgICAgICAgICBjdWJlbWFwOiBmYWxzZSxcbiAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdGV4dHVyZTtcbiAgICB9XG5cbiAgICAvLyBmb3IgcmVuZGVyaW5nIG9mIGNvb2tpZXMsIHN0b3JlIGludmVyc2UgdmlldyBwcm9qZWN0aW9uIG1hdHJpY2VzIGZvciA2IGZhY2VzLCBhbGxvd2luZyBjdWJlbWFwIGZhY2VzIHRvIGJlIGNvcGllZCBpbnRvIHRoZSBhdGxhc1xuICAgIHN0YXRpYyBfaW52Vmlld1Byb2pNYXRyaWNlcyA9IG51bGw7XG5cbiAgICBpbml0SW52Vmlld1Byb2pNYXRyaWNlcygpIHtcbiAgICAgICAgaWYgKCFDb29raWVSZW5kZXJlci5faW52Vmlld1Byb2pNYXRyaWNlcykge1xuICAgICAgICAgICAgQ29va2llUmVuZGVyZXIuX2ludlZpZXdQcm9qTWF0cmljZXMgPSBbXTtcblxuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCA2OyBmYWNlKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSBMaWdodENhbWVyYS5jcmVhdGUobnVsbCwgTElHSFRUWVBFX09NTkksIGZhY2UpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb2pNYXQgPSBjYW1lcmEucHJvamVjdGlvbk1hdHJpeDtcbiAgICAgICAgICAgICAgICBjb25zdCB2aWV3TWF0ID0gY2FtZXJhLm5vZGUuZ2V0TG9jYWxUcmFuc2Zvcm0oKS5jbG9uZSgpLmludmVydCgpO1xuICAgICAgICAgICAgICAgIENvb2tpZVJlbmRlcmVyLl9pbnZWaWV3UHJvak1hdHJpY2VzW2ZhY2VdID0gbmV3IE1hdDQoKS5tdWwyKHByb2pNYXQsIHZpZXdNYXQpLmludmVydCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKGxpZ2h0LCByZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICBpZiAobGlnaHQuZW5hYmxlZCAmJiBsaWdodC5jb29raWUgJiYgbGlnaHQudmlzaWJsZVRoaXNGcmFtZSkge1xuXG4gICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5kZXZpY2UsIGBDT09LSUUgJHtsaWdodC5fbm9kZS5uYW1lfWApO1xuXG4gICAgICAgICAgICBjb25zdCBmYWNlQ291bnQgPSBsaWdodC5udW1TaGFkb3dGYWNlcztcbiAgICAgICAgICAgIGNvbnN0IHNoYWRlciA9IGZhY2VDb3VudCA+IDEgPyB0aGlzLnNoYWRlckN1YmUgOiB0aGlzLnNoYWRlcjJkO1xuICAgICAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG5cbiAgICAgICAgICAgIGlmIChmYWNlQ291bnQgPiAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbml0SW52Vmlld1Byb2pNYXRyaWNlcygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzb3VyY2UgdGV4dHVyZVxuICAgICAgICAgICAgdGhpcy5ibGl0VGV4dHVyZUlkLnNldFZhbHVlKGxpZ2h0LmNvb2tpZSk7XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBzdGF0ZVxuICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5ERUZBVUxUKTtcblxuICAgICAgICAgICAgLy8gcmVuZGVyIGl0IHRvIGEgdmlld3BvcnQgb2YgdGhlIHRhcmdldFxuICAgICAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCBmYWNlQ291bnQ7IGZhY2UrKykge1xuXG4gICAgICAgICAgICAgICAgX3ZpZXdwb3J0LmNvcHkobGlnaHQuYXRsYXNWaWV3cG9ydCk7XG5cbiAgICAgICAgICAgICAgICBpZiAoZmFjZUNvdW50ID4gMSkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGZvciBjdWJlbWFwLCByZW5kZXIgdG8gb25lIG9mIHRoZSAzeDMgc3ViLWFyZWFzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNtYWxsU2l6ZSA9IF92aWV3cG9ydC56IC8gMztcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdGhpcy5saWdodFRleHR1cmVBdGxhcy5jdWJlU2xvdHNPZmZzZXRzW2ZhY2VdO1xuICAgICAgICAgICAgICAgICAgICBfdmlld3BvcnQueCArPSBzbWFsbFNpemUgKiBvZmZzZXQueDtcbiAgICAgICAgICAgICAgICAgICAgX3ZpZXdwb3J0LnkgKz0gc21hbGxTaXplICogb2Zmc2V0Lnk7XG4gICAgICAgICAgICAgICAgICAgIF92aWV3cG9ydC56ID0gc21hbGxTaXplO1xuICAgICAgICAgICAgICAgICAgICBfdmlld3BvcnQudyA9IHNtYWxsU2l6ZTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjdWJlbWFwIGZhY2UgcHJvamVjdGlvbiB1bmlmb3JtXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaW52Vmlld1Byb2pJZC5zZXRWYWx1ZShDb29raWVSZW5kZXJlci5faW52Vmlld1Byb2pNYXRyaWNlc1tmYWNlXS5kYXRhKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBfdmlld3BvcnQubXVsU2NhbGFyKHJlbmRlclRhcmdldC5jb2xvckJ1ZmZlci53aWR0aCk7XG4gICAgICAgICAgICAgICAgZHJhd1F1YWRXaXRoU2hhZGVyKGRldmljZSwgcmVuZGVyVGFyZ2V0LCBzaGFkZXIsIF92aWV3cG9ydCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuZGV2aWNlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0IHsgQ29va2llUmVuZGVyZXIgfTtcbiJdLCJuYW1lcyI6WyJ0ZXh0dXJlQmxpdFZlcnRleFNoYWRlciIsInRleHR1cmVCbGl0RnJhZ21lbnRTaGFkZXIiLCJ0ZXh0dXJlQ3ViZUJsaXRGcmFnbWVudFNoYWRlciIsIl92aWV3cG9ydCIsIlZlYzQiLCJDb29raWVSZW5kZXJlciIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwibGlnaHRUZXh0dXJlQXRsYXMiLCJibGl0U2hhZGVyMmQiLCJibGl0U2hhZGVyQ3ViZSIsImJsaXRUZXh0dXJlSWQiLCJpbnZWaWV3UHJvaklkIiwiZGVzdHJveSIsImdldFNoYWRlciIsInNoYWRlciIsImZyYWdtZW50IiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJzY29wZSIsInJlc29sdmUiLCJzaGFkZXIyZCIsInNoYWRlckN1YmUiLCJjcmVhdGVUZXh0dXJlIiwicmVzb2x1dGlvbiIsInRleHR1cmUiLCJUZXh0dXJlIiwibmFtZSIsIndpZHRoIiwiaGVpZ2h0IiwiZm9ybWF0IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJjdWJlbWFwIiwibWlwbWFwcyIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwibWFnRmlsdGVyIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsImluaXRJbnZWaWV3UHJvak1hdHJpY2VzIiwiX2ludlZpZXdQcm9qTWF0cmljZXMiLCJmYWNlIiwiY2FtZXJhIiwiTGlnaHRDYW1lcmEiLCJjcmVhdGUiLCJMSUdIVFRZUEVfT01OSSIsInByb2pNYXQiLCJwcm9qZWN0aW9uTWF0cml4Iiwidmlld01hdCIsIm5vZGUiLCJnZXRMb2NhbFRyYW5zZm9ybSIsImNsb25lIiwiaW52ZXJ0IiwiTWF0NCIsIm11bDIiLCJyZW5kZXIiLCJsaWdodCIsInJlbmRlclRhcmdldCIsImVuYWJsZWQiLCJjb29raWUiLCJ2aXNpYmxlVGhpc0ZyYW1lIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJfbm9kZSIsImZhY2VDb3VudCIsIm51bVNoYWRvd0ZhY2VzIiwic2V0VmFsdWUiLCJzZXRCbGVuZFN0YXRlIiwiQmxlbmRTdGF0ZSIsIkRFRkFVTFQiLCJjb3B5IiwiYXRsYXNWaWV3cG9ydCIsInNtYWxsU2l6ZSIsInoiLCJvZmZzZXQiLCJjdWJlU2xvdHNPZmZzZXRzIiwieCIsInkiLCJ3IiwiZGF0YSIsIm11bFNjYWxhciIsImNvbG9yQnVmZmVyIiwiZHJhd1F1YWRXaXRoU2hhZGVyIiwicG9wR3B1TWFya2VyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQWFBLE1BQU1BLHVCQUF1QixHQUFJLENBQUE7QUFDakM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQU0sQ0FBQSxDQUFBO0FBRU4sTUFBTUMseUJBQXlCLEdBQUksQ0FBQTtBQUNuQztBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQU0sQ0FBQSxDQUFBOztBQUVOO0FBQ0EsTUFBTUMsNkJBQTZCLEdBQUksQ0FBQTtBQUN2QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQU0sQ0FBQSxDQUFBO0FBRU4sTUFBTUMsU0FBUyxHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBOztBQUU1QjtBQUNBLE1BQU1DLGNBQWMsQ0FBQztBQUNqQkMsRUFBQUEsV0FB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
