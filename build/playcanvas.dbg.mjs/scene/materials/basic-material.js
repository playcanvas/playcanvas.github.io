/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { SHADERDEF_SKIN, SHADERDEF_SCREENSPACE, SHADERDEF_INSTANCING, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_TEXTURE_BASED } from '../constants.js';
import { basic } from '../shader-lib/programs/basic.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { Material } from './material.js';

class BasicMaterial extends Material {
  constructor() {
    super();

    this.color = new Color(1, 1, 1, 1);
    this.colorUniform = new Float32Array(4);

    this.colorMap = null;
    this.vertexColors = false;
  }

  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.colorMap = source.colorMap;
    this.vertexColors = source.vertexColors;
    return this;
  }
  updateUniforms(device, scene) {
    this.clearParameters();
    this.colorUniform[0] = this.color.r;
    this.colorUniform[1] = this.color.g;
    this.colorUniform[2] = this.color.b;
    this.colorUniform[3] = this.color.a;
    this.setParameter('uColor', this.colorUniform);
    if (this.colorMap) {
      this.setParameter('texture_diffuseMap', this.colorMap);
    }
  }
  getShaderVariant(device, scene, objDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {
    if (this.updateShader) {
      Debug.deprecated('pc.BasicMaterial.updateShader is deprecated');
      this.updateShader(device, scene, objDefs, staticLightList, pass, sortedLights);
      return this.shader;
    }
    const options = {
      skin: objDefs && (objDefs & SHADERDEF_SKIN) !== 0,
      screenSpace: objDefs && (objDefs & SHADERDEF_SCREENSPACE) !== 0,
      useInstancing: objDefs && (objDefs & SHADERDEF_INSTANCING) !== 0,
      useMorphPosition: objDefs && (objDefs & SHADERDEF_MORPH_POSITION) !== 0,
      useMorphNormal: objDefs && (objDefs & SHADERDEF_MORPH_NORMAL) !== 0,
      useMorphTextureBased: objDefs && (objDefs & SHADERDEF_MORPH_TEXTURE_BASED) !== 0,
      alphaTest: this.alphaTest > 0,
      vertexColors: this.vertexColors,
      diffuseMap: !!this.colorMap,
      pass: pass
    };
    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);
    const library = getProgramLibrary(device);
    library.register('basic', basic);
    return library.getProgram('basic', options, processingOptions);
  }
}

export { BasicMaterial };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzaWMtbWF0ZXJpYWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9tYXRlcmlhbHMvYmFzaWMtbWF0ZXJpYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7XG4gICAgU0hBREVSREVGX0lOU1RBTkNJTkcsIFNIQURFUkRFRl9NT1JQSF9OT1JNQUwsIFNIQURFUkRFRl9NT1JQSF9QT1NJVElPTiwgU0hBREVSREVGX01PUlBIX1RFWFRVUkVfQkFTRUQsXG4gICAgU0hBREVSREVGX1NDUkVFTlNQQUNFLCBTSEFERVJERUZfU0tJTlxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBiYXNpYyB9IGZyb20gJy4uLy4uL3NjZW5lL3NoYWRlci1saWIvcHJvZ3JhbXMvYmFzaWMuanMnO1xuaW1wb3J0IHsgU2hhZGVyUHJvY2Vzc29yT3B0aW9ucyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci1wcm9jZXNzb3Itb3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBnZXRQcm9ncmFtTGlicmFyeSB9IGZyb20gJy4uL3NoYWRlci1saWIvZ2V0LXByb2dyYW0tbGlicmFyeS5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWwuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcycpLlRleHR1cmV9IFRleHR1cmUgKi9cblxuLyoqXG4gKiBBIEJhc2ljTWF0ZXJpYWwgaXMgZm9yIHJlbmRlcmluZyB1bmxpdCBnZW9tZXRyeSwgZWl0aGVyIHVzaW5nIGEgY29uc3RhbnQgY29sb3Igb3IgYSBjb2xvciBtYXBcbiAqIG1vZHVsYXRlZCB3aXRoIGEgY29sb3IuXG4gKlxuICogQGF1Z21lbnRzIE1hdGVyaWFsXG4gKi9cbmNsYXNzIEJhc2ljTWF0ZXJpYWwgZXh0ZW5kcyBNYXRlcmlhbCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEJhc2ljTWF0ZXJpYWwgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG5ldyBCYXNpYyBtYXRlcmlhbFxuICAgICAqIHZhciBtYXRlcmlhbCA9IG5ldyBwYy5CYXNpY01hdGVyaWFsKCk7XG4gICAgICpcbiAgICAgKiAvLyBTZXQgdGhlIG1hdGVyaWFsIHRvIGhhdmUgYSB0ZXh0dXJlIG1hcCB0aGF0IGlzIG11bHRpcGxpZWQgYnkgYSByZWQgY29sb3JcbiAgICAgKiBtYXRlcmlhbC5jb2xvci5zZXQoMSwgMCwgMCk7XG4gICAgICogbWF0ZXJpYWwuY29sb3JNYXAgPSBkaWZmdXNlTWFwO1xuICAgICAqXG4gICAgICogLy8gTm90aWZ5IHRoZSBtYXRlcmlhbCB0aGF0IGl0IGhhcyBiZWVuIG1vZGlmaWVkXG4gICAgICogbWF0ZXJpYWwudXBkYXRlKCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBmbGF0IGNvbG9yIG9mIHRoZSBtYXRlcmlhbCAoUkdCQSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgMCB0byAxKS5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0NvbG9yfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5jb2xvciA9IG5ldyBDb2xvcigxLCAxLCAxLCAxKTtcbiAgICAgICAgdGhpcy5jb2xvclVuaWZvcm0gPSBuZXcgRmxvYXQzMkFycmF5KDQpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgY29sb3IgbWFwIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdCBpcyBudWxsKS4gSWYgc3BlY2lmaWVkLCB0aGUgY29sb3IgbWFwIGlzXG4gICAgICAgICAqIG1vZHVsYXRlZCBieSB0aGUgY29sb3IgcHJvcGVydHkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUZXh0dXJlfG51bGx9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNvbG9yTWFwID0gbnVsbDtcbiAgICAgICAgdGhpcy52ZXJ0ZXhDb2xvcnMgPSBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3B5IGEgYEJhc2ljTWF0ZXJpYWxgLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtCYXNpY01hdGVyaWFsfSBzb3VyY2UgLSBUaGUgbWF0ZXJpYWwgdG8gY29weSBmcm9tLlxuICAgICAqIEByZXR1cm5zIHtCYXNpY01hdGVyaWFsfSBUaGUgZGVzdGluYXRpb24gbWF0ZXJpYWwuXG4gICAgICovXG4gICAgY29weShzb3VyY2UpIHtcbiAgICAgICAgc3VwZXIuY29weShzb3VyY2UpO1xuXG4gICAgICAgIHRoaXMuY29sb3IuY29weShzb3VyY2UuY29sb3IpO1xuICAgICAgICB0aGlzLmNvbG9yTWFwID0gc291cmNlLmNvbG9yTWFwO1xuICAgICAgICB0aGlzLnZlcnRleENvbG9ycyA9IHNvdXJjZS52ZXJ0ZXhDb2xvcnM7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgdXBkYXRlVW5pZm9ybXMoZGV2aWNlLCBzY2VuZSkge1xuICAgICAgICB0aGlzLmNsZWFyUGFyYW1ldGVycygpO1xuXG4gICAgICAgIHRoaXMuY29sb3JVbmlmb3JtWzBdID0gdGhpcy5jb2xvci5yO1xuICAgICAgICB0aGlzLmNvbG9yVW5pZm9ybVsxXSA9IHRoaXMuY29sb3IuZztcbiAgICAgICAgdGhpcy5jb2xvclVuaWZvcm1bMl0gPSB0aGlzLmNvbG9yLmI7XG4gICAgICAgIHRoaXMuY29sb3JVbmlmb3JtWzNdID0gdGhpcy5jb2xvci5hO1xuICAgICAgICB0aGlzLnNldFBhcmFtZXRlcigndUNvbG9yJywgdGhpcy5jb2xvclVuaWZvcm0pO1xuICAgICAgICBpZiAodGhpcy5jb2xvck1hcCkge1xuICAgICAgICAgICAgdGhpcy5zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZGlmZnVzZU1hcCcsIHRoaXMuY29sb3JNYXApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0U2hhZGVyVmFyaWFudChkZXZpY2UsIHNjZW5lLCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cywgdmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpIHtcblxuICAgICAgICAvLyBOb3RlOiB0aGlzIGlzIGRlcHJlY2F0ZWQgZnVuY3Rpb24gRWRpdG9yIGFuZCBwb3NzaWJseSBvdGhlciBwcm9qZWN0cyB1c2U6IHRoZXkgZGVmaW5lXG4gICAgICAgIC8vIHVwZGF0ZVNoYWRlciBjYWxsYmFjayBvbiB0aGVpciBCYXNpY01hdGVyaWFsLCBzbyB3ZSBoYW5kbGUgaXQgaGVyZS5cbiAgICAgICAgaWYgKHRoaXMudXBkYXRlU2hhZGVyKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5CYXNpY01hdGVyaWFsLnVwZGF0ZVNoYWRlciBpcyBkZXByZWNhdGVkJyk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVNoYWRlcihkZXZpY2UsIHNjZW5lLCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zaGFkZXI7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgc2tpbjogb2JqRGVmcyAmJiAob2JqRGVmcyAmIFNIQURFUkRFRl9TS0lOKSAhPT0gMCxcbiAgICAgICAgICAgIHNjcmVlblNwYWNlOiBvYmpEZWZzICYmIChvYmpEZWZzICYgU0hBREVSREVGX1NDUkVFTlNQQUNFKSAhPT0gMCxcbiAgICAgICAgICAgIHVzZUluc3RhbmNpbmc6IG9iakRlZnMgJiYgKG9iakRlZnMgJiBTSEFERVJERUZfSU5TVEFOQ0lORykgIT09IDAsXG4gICAgICAgICAgICB1c2VNb3JwaFBvc2l0aW9uOiBvYmpEZWZzICYmIChvYmpEZWZzICYgU0hBREVSREVGX01PUlBIX1BPU0lUSU9OKSAhPT0gMCxcbiAgICAgICAgICAgIHVzZU1vcnBoTm9ybWFsOiBvYmpEZWZzICYmIChvYmpEZWZzICYgU0hBREVSREVGX01PUlBIX05PUk1BTCkgIT09IDAsXG4gICAgICAgICAgICB1c2VNb3JwaFRleHR1cmVCYXNlZDogb2JqRGVmcyAmJiAob2JqRGVmcyAmIFNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEKSAhPT0gMCxcblxuICAgICAgICAgICAgYWxwaGFUZXN0OiB0aGlzLmFscGhhVGVzdCA+IDAsXG4gICAgICAgICAgICB2ZXJ0ZXhDb2xvcnM6IHRoaXMudmVydGV4Q29sb3JzLFxuICAgICAgICAgICAgZGlmZnVzZU1hcDogISF0aGlzLmNvbG9yTWFwLFxuICAgICAgICAgICAgcGFzczogcGFzc1xuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHByb2Nlc3NpbmdPcHRpb25zID0gbmV3IFNoYWRlclByb2Nlc3Nvck9wdGlvbnModmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuXG4gICAgICAgIGNvbnN0IGxpYnJhcnkgPSBnZXRQcm9ncmFtTGlicmFyeShkZXZpY2UpO1xuICAgICAgICBsaWJyYXJ5LnJlZ2lzdGVyKCdiYXNpYycsIGJhc2ljKTtcblxuICAgICAgICByZXR1cm4gbGlicmFyeS5nZXRQcm9ncmFtKCdiYXNpYycsIG9wdGlvbnMsIHByb2Nlc3NpbmdPcHRpb25zKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IEJhc2ljTWF0ZXJpYWwgfTtcbiJdLCJuYW1lcyI6WyJCYXNpY01hdGVyaWFsIiwiTWF0ZXJpYWwiLCJjb25zdHJ1Y3RvciIsImNvbG9yIiwiQ29sb3IiLCJjb2xvclVuaWZvcm0iLCJGbG9hdDMyQXJyYXkiLCJjb2xvck1hcCIsInZlcnRleENvbG9ycyIsImNvcHkiLCJzb3VyY2UiLCJ1cGRhdGVVbmlmb3JtcyIsImRldmljZSIsInNjZW5lIiwiY2xlYXJQYXJhbWV0ZXJzIiwiciIsImciLCJiIiwiYSIsInNldFBhcmFtZXRlciIsImdldFNoYWRlclZhcmlhbnQiLCJvYmpEZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsInVwZGF0ZVNoYWRlciIsIkRlYnVnIiwiZGVwcmVjYXRlZCIsInNoYWRlciIsIm9wdGlvbnMiLCJza2luIiwiU0hBREVSREVGX1NLSU4iLCJzY3JlZW5TcGFjZSIsIlNIQURFUkRFRl9TQ1JFRU5TUEFDRSIsInVzZUluc3RhbmNpbmciLCJTSEFERVJERUZfSU5TVEFOQ0lORyIsInVzZU1vcnBoUG9zaXRpb24iLCJTSEFERVJERUZfTU9SUEhfUE9TSVRJT04iLCJ1c2VNb3JwaE5vcm1hbCIsIlNIQURFUkRFRl9NT1JQSF9OT1JNQUwiLCJ1c2VNb3JwaFRleHR1cmVCYXNlZCIsIlNIQURFUkRFRl9NT1JQSF9URVhUVVJFX0JBU0VEIiwiYWxwaGFUZXN0IiwiZGlmZnVzZU1hcCIsInByb2Nlc3NpbmdPcHRpb25zIiwiU2hhZGVyUHJvY2Vzc29yT3B0aW9ucyIsImxpYnJhcnkiLCJnZXRQcm9ncmFtTGlicmFyeSIsInJlZ2lzdGVyIiwiYmFzaWMiLCJnZXRQcm9ncmFtIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBb0JBLE1BQU1BLGFBQWEsU0FBU0MsUUFBUSxDQUFDO0FBZWpDQyxFQUFBQSxXQUFXLEdBQUc7QUFDVixJQUFBLEtBQUssRUFBRSxDQUFBOztBQU9QLElBQUEsSUFBSSxDQUFDQyxLQUFLLEdBQUcsSUFBSUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ2xDLElBQUEsSUFBSSxDQUFDQyxZQUFZLEdBQUcsSUFBSUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFBOztJQVF2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