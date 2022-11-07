/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { bindGroupNames, uniformTypeToName, UNIFORMTYPE_FLOAT, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC4, UNIFORMTYPE_INT, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BOOL, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4 } from './constants.js';

const uniformTypeToNumElements = [];
uniformTypeToNumElements[UNIFORMTYPE_FLOAT] = 1;
uniformTypeToNumElements[UNIFORMTYPE_VEC2] = 2;
uniformTypeToNumElements[UNIFORMTYPE_VEC3] = 3;
uniformTypeToNumElements[UNIFORMTYPE_VEC4] = 4;
uniformTypeToNumElements[UNIFORMTYPE_INT] = 1;
uniformTypeToNumElements[UNIFORMTYPE_IVEC2] = 2;
uniformTypeToNumElements[UNIFORMTYPE_IVEC3] = 3;
uniformTypeToNumElements[UNIFORMTYPE_IVEC4] = 4;
uniformTypeToNumElements[UNIFORMTYPE_BOOL] = 1;
uniformTypeToNumElements[UNIFORMTYPE_BVEC2] = 2;
uniformTypeToNumElements[UNIFORMTYPE_BVEC3] = 3;
uniformTypeToNumElements[UNIFORMTYPE_BVEC4] = 4;
uniformTypeToNumElements[UNIFORMTYPE_MAT2] = 8;
uniformTypeToNumElements[UNIFORMTYPE_MAT3] = 12;
uniformTypeToNumElements[UNIFORMTYPE_MAT4] = 16;

class UniformFormat {

  constructor(name, type, count = 1) {
    this.name = void 0;
    this.type = void 0;
    this.byteSize = void 0;
    this.offset = void 0;
    this.scopeId = void 0;
    this.count = void 0;
    this.name = name;
    this.type = type;
    this.count = count;
    Debug.assert(count === 1, `Uniform arrays are not currently supported - uniform ${name}`);
    const elementSize = uniformTypeToNumElements[type];
    Debug.assert(elementSize, `Unhandled uniform format ${type} used for ${name}`);
    this.byteSize = count * elementSize * 4;
    Debug.assert(this.byteSize, `Unknown byte size for uniform format ${type} used for ${name}`);
  }

  calculateOffset(offset) {
    const alignment = this.byteSize <= 8 ? this.byteSize : 16;

    offset = math.roundUp(offset, alignment);
    this.offset = offset / 4;
  }
}

class UniformBufferFormat {

  constructor(graphicsDevice, uniforms) {
    this.byteSize = 0;
    this.map = new Map();
    this.scope = graphicsDevice.scope;

    this.uniforms = uniforms;

    let offset = 0;
    for (let i = 0; i < uniforms.length; i++) {
      const uniform = uniforms[i];
      uniform.calculateOffset(offset);
      offset = uniform.offset * 4 + uniform.byteSize;
      uniform.scopeId = this.scope.resolve(uniform.name);
      this.map.set(uniform.name, uniform);
    }

    this.byteSize = math.roundUp(offset, 16);
  }

  get(name) {
    return this.map.get(name);
  }
  getShaderDeclaration(bindGroup, bindIndex) {
    const name = bindGroupNames[bindGroup];
    let code = `layout(set = ${bindGroup}, binding = ${bindIndex}, std140) uniform ub_${name} {\n`;
    this.uniforms.forEach(uniform => {
      const typeString = uniformTypeToName[uniform.type];
      Debug.assert(typeString.length > 0, `Uniform type ${uniform.type} is not handled.`);
      code += `    ${typeString} ${uniform.name};\n`;
    });
    return code + '};\n';
  }
}

export { UniformBufferFormat, UniformFormat };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5pZm9ybS1idWZmZXItZm9ybWF0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHtcbiAgICB1bmlmb3JtVHlwZVRvTmFtZSwgYmluZEdyb3VwTmFtZXMsXG4gICAgVU5JRk9STVRZUEVfQk9PTCwgVU5JRk9STVRZUEVfSU5ULCBVTklGT1JNVFlQRV9GTE9BVCwgVU5JRk9STVRZUEVfVkVDMiwgVU5JRk9STVRZUEVfVkVDMyxcbiAgICBVTklGT1JNVFlQRV9WRUM0LCBVTklGT1JNVFlQRV9JVkVDMiwgVU5JRk9STVRZUEVfSVZFQzMsIFVOSUZPUk1UWVBFX0lWRUM0LCBVTklGT1JNVFlQRV9CVkVDMixcbiAgICBVTklGT1JNVFlQRV9CVkVDMywgVU5JRk9STVRZUEVfQlZFQzQsIFVOSUZPUk1UWVBFX01BVDQsIFVOSUZPUk1UWVBFX01BVDIsIFVOSUZPUk1UWVBFX01BVDNcbn0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9zY29wZS1pZC5qcycpLlNjb3BlSWR9IFNjb3BlSWQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL3VuaWZvcm0tYnVmZmVyLmpzJykuVW5pZm9ybUJ1ZmZlcn0gVW5pZm9ybUJ1ZmZlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IEdyYXBoaWNzRGV2aWNlICovXG5cbi8vIG1hcCBvZiBVTklGT1JNVFlQRV8qKiogdG8gbnVtYmVyIG9mIDMyYml0IGVsZW1lbnRzXG5jb25zdCB1bmlmb3JtVHlwZVRvTnVtRWxlbWVudHMgPSBbXTtcbnVuaWZvcm1UeXBlVG9OdW1FbGVtZW50c1tVTklGT1JNVFlQRV9GTE9BVF0gPSAxO1xudW5pZm9ybVR5cGVUb051bUVsZW1lbnRzW1VOSUZPUk1UWVBFX1ZFQzJdID0gMjtcbnVuaWZvcm1UeXBlVG9OdW1FbGVtZW50c1tVTklGT1JNVFlQRV9WRUMzXSA9IDM7XG51bmlmb3JtVHlwZVRvTnVtRWxlbWVudHNbVU5JRk9STVRZUEVfVkVDNF0gPSA0O1xudW5pZm9ybVR5cGVUb051bUVsZW1lbnRzW1VOSUZPUk1UWVBFX0lOVF0gPSAxO1xudW5pZm9ybVR5cGVUb051bUVsZW1lbnRzW1VOSUZPUk1UWVBFX0lWRUMyXSA9IDI7XG51bmlmb3JtVHlwZVRvTnVtRWxlbWVudHNbVU5JRk9STVRZUEVfSVZFQzNdID0gMztcbnVuaWZvcm1UeXBlVG9OdW1FbGVtZW50c1tVTklGT1JNVFlQRV9JVkVDNF0gPSA0O1xudW5pZm9ybVR5cGVUb051bUVsZW1lbnRzW1VOSUZPUk1UWVBFX0JPT0xdID0gMTtcbnVuaWZvcm1UeXBlVG9OdW1FbGVtZW50c1tVTklGT1JNVFlQRV9CVkVDMl0gPSAyO1xudW5pZm9ybVR5cGVUb051bUVsZW1lbnRzW1VOSUZPUk1UWVBFX0JWRUMzXSA9IDM7XG51bmlmb3JtVHlwZVRvTnVtRWxlbWVudHNbVU5JRk9STVRZUEVfQlZFQzRdID0gNDtcbnVuaWZvcm1UeXBlVG9OdW1FbGVtZW50c1tVTklGT1JNVFlQRV9NQVQyXSA9IDg7ICAgIC8vIDIgeCB2ZWM0XG51bmlmb3JtVHlwZVRvTnVtRWxlbWVudHNbVU5JRk9STVRZUEVfTUFUM10gPSAxMjsgICAvLyAzIHggdmVjNFxudW5pZm9ybVR5cGVUb051bUVsZW1lbnRzW1VOSUZPUk1UWVBFX01BVDRdID0gMTY7ICAgLy8gNCB4IHZlYzRcblxuLy8gSGFuZGxlIGFkZGl0aW9uYSB0eXBlczpcbi8vICAgICAgVU5JRk9STVRZUEVfRkxPQVRBUlJBWSA9IDE3O1xuLy8gICAgICBVTklGT1JNVFlQRV9WRUMyQVJSQVkgPSAyMTtcbi8vICAgICAgVU5JRk9STVRZUEVfVkVDM0FSUkFZID0gMjI7XG4vLyAgICAgIFVOSUZPUk1UWVBFX1ZFQzRBUlJBWSA9IDIzO1xuXG4vKipcbiAqIEEgY2xhc3Mgc3RvcmluZyBkZXNjcmlwdGlvbiBvZiBhbiBpbmRpdmlkdWFsIHVuaWZvcm0sIHN0b3JlZCBpbnNpZGUgYSB1bmlmb3JtIGJ1ZmZlci5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFVuaWZvcm1Gb3JtYXQge1xuICAgIC8qKiBAdHlwZSB7c3RyaW5nfSAqL1xuICAgIG5hbWU7XG5cbiAgICAvLyBVTklGT1JNVFlQRV8qKipcbiAgICAvKiogQHR5cGUge251bWJlcn0gKi9cbiAgICB0eXBlO1xuXG4gICAgLyoqIEB0eXBlIHtudW1iZXJ9ICovXG4gICAgYnl0ZVNpemU7XG5cbiAgICAvKipcbiAgICAgKiBJbmRleCBvZiB0aGUgdW5pZm9ybSBpbiBhbiBhcnJheSBvZiAzMmJpdCB2YWx1ZXMgKEZsb2F0MzJBcnJheSBhbmQgc2ltaWxhcilcbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgb2Zmc2V0O1xuXG4gICAgLyoqIEB0eXBlIHtTY29wZUlkfSAqL1xuICAgIHNjb3BlSWQ7XG5cbiAgICAvKipcbiAgICAgKiBDb3VudCBvZiBlbGVtZW50cyBmb3IgYXJyYXlzLCBvdGhlcndpc2UgMS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgY291bnQ7XG5cbiAgICBjb25zdHJ1Y3RvcihuYW1lLCB0eXBlLCBjb3VudCA9IDEpIHtcbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy50eXBlID0gdHlwZTtcblxuICAgICAgICB0aGlzLmNvdW50ID0gY291bnQ7XG4gICAgICAgIERlYnVnLmFzc2VydChjb3VudCA9PT0gMSwgYFVuaWZvcm0gYXJyYXlzIGFyZSBub3QgY3VycmVudGx5IHN1cHBvcnRlZCAtIHVuaWZvcm0gJHtuYW1lfWApO1xuXG4gICAgICAgIGNvbnN0IGVsZW1lbnRTaXplID0gdW5pZm9ybVR5cGVUb051bUVsZW1lbnRzW3R5cGVdO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZWxlbWVudFNpemUsIGBVbmhhbmRsZWQgdW5pZm9ybSBmb3JtYXQgJHt0eXBlfSB1c2VkIGZvciAke25hbWV9YCk7XG5cbiAgICAgICAgdGhpcy5ieXRlU2l6ZSA9IGNvdW50ICogZWxlbWVudFNpemUgKiA0O1xuICAgICAgICBEZWJ1Zy5hc3NlcnQodGhpcy5ieXRlU2l6ZSwgYFVua25vd24gYnl0ZSBzaXplIGZvciB1bmlmb3JtIGZvcm1hdCAke3R5cGV9IHVzZWQgZm9yICR7bmFtZX1gKTtcbiAgICB9XG5cbiAgICAvLyBzdGQxNDAgcnVsZXM6IGh0dHBzOi8vcmVnaXN0cnkua2hyb25vcy5vcmcvT3BlbkdML3NwZWNzL2dsL2dsc3BlYzQ1LmNvcmUucGRmI3BhZ2U9MTU5XG4gICAgLy8gVE9ETzogdGhpcyBzdXBwb3J0IGxpbWl0ZWQgc3Vic2V0IG9mIGZ1bmN0aW9uYWxpdHksIGFycmF5cyBhbmQgc3RydWN0cyBhcmUgbm90IHN1cHBvcnRlZC5cbiAgICBjYWxjdWxhdGVPZmZzZXQob2Zmc2V0KSB7XG5cbiAgICAgICAgLy8gTm90ZTogdmVjMyBoYXMgdGhlIHNhbWUgYWxpZ25tZW50IGFzIHZlYzRcbiAgICAgICAgY29uc3QgYWxpZ25tZW50ID0gdGhpcy5ieXRlU2l6ZSA8PSA4ID8gdGhpcy5ieXRlU2l6ZSA6IDE2O1xuXG4gICAgICAgIC8vIGFsaWduIHRoZSBzdGFydCBvZmZzZXRcbiAgICAgICAgb2Zmc2V0ID0gbWF0aC5yb3VuZFVwKG9mZnNldCwgYWxpZ25tZW50KTtcbiAgICAgICAgdGhpcy5vZmZzZXQgPSBvZmZzZXQgLyA0O1xuICAgIH1cbn1cblxuLyoqXG4gKiBBIGRlc2NyaXB0b3IgdGhhdCBkZWZpbmVzIHRoZSBsYXlvdXQgb2Ygb2YgZGF0YSBpbnNpZGUgdGhlIHtAbGluayBVbmlmb3JtQnVmZmVyfS5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFVuaWZvcm1CdWZmZXJGb3JtYXQge1xuICAgIC8qKiBAdHlwZSB7bnVtYmVyfSAqL1xuICAgIGJ5dGVTaXplID0gMDtcblxuICAgIC8qKiBAdHlwZSB7TWFwPHN0cmluZyxVbmlmb3JtRm9ybWF0Pn0gKi9cbiAgICBtYXAgPSBuZXcgTWFwKCk7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgVW5pZm9ybUJ1ZmZlckZvcm1hdCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7R3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge1VuaWZvcm1Gb3JtYXRbXX0gdW5pZm9ybXMgLSBBbiBhcnJheSBvZiB1bmlmb3JtcyB0byBiZSBzdG9yZWQgaW4gdGhlIGJ1ZmZlclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlLCB1bmlmb3Jtcykge1xuICAgICAgICB0aGlzLnNjb3BlID0gZ3JhcGhpY3NEZXZpY2Uuc2NvcGU7XG5cbiAgICAgICAgLyoqIEB0eXBlIHtVbmlmb3JtRm9ybWF0W119ICovXG4gICAgICAgIHRoaXMudW5pZm9ybXMgPSB1bmlmb3JtcztcblxuICAgICAgICAvLyBUT0RPOiBvcHRpbWl6ZSB1bmlmb3JtcyBvcmRlcmluZ1xuXG4gICAgICAgIGxldCBvZmZzZXQgPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVuaWZvcm1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtID0gdW5pZm9ybXNbaV07XG4gICAgICAgICAgICB1bmlmb3JtLmNhbGN1bGF0ZU9mZnNldChvZmZzZXQpO1xuICAgICAgICAgICAgb2Zmc2V0ID0gdW5pZm9ybS5vZmZzZXQgKiA0ICsgdW5pZm9ybS5ieXRlU2l6ZTtcblxuICAgICAgICAgICAgdW5pZm9ybS5zY29wZUlkID0gdGhpcy5zY29wZS5yZXNvbHZlKHVuaWZvcm0ubmFtZSk7XG5cbiAgICAgICAgICAgIHRoaXMubWFwLnNldCh1bmlmb3JtLm5hbWUsIHVuaWZvcm0pO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gcm91bmQgdXAgYnVmZmVyIHNpemVcbiAgICAgICAgdGhpcy5ieXRlU2l6ZSA9IG1hdGgucm91bmRVcChvZmZzZXQsIDE2KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGZvcm1hdCBvZiBhIHVuaWZvcm0gd2l0aCBzcGVjaWZpZWQgbmFtZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHVuaWZvcm0uXG4gICAgICogQHJldHVybnMge1VuaWZvcm1Gb3JtYXR9IC0gVGhlIGZvcm1hdCBvZiB0aGUgdW5pZm9ybS5cbiAgICAgKi9cbiAgICBnZXQobmFtZSkge1xuICAgICAgICByZXR1cm4gdGhpcy5tYXAuZ2V0KG5hbWUpO1xuICAgIH1cblxuICAgIGdldFNoYWRlckRlY2xhcmF0aW9uKGJpbmRHcm91cCwgYmluZEluZGV4KSB7XG5cbiAgICAgICAgY29uc3QgbmFtZSA9IGJpbmRHcm91cE5hbWVzW2JpbmRHcm91cF07XG4gICAgICAgIGxldCBjb2RlID0gYGxheW91dChzZXQgPSAke2JpbmRHcm91cH0sIGJpbmRpbmcgPSAke2JpbmRJbmRleH0sIHN0ZDE0MCkgdW5pZm9ybSB1Yl8ke25hbWV9IHtcXG5gO1xuXG4gICAgICAgIHRoaXMudW5pZm9ybXMuZm9yRWFjaCgodW5pZm9ybSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHlwZVN0cmluZyA9IHVuaWZvcm1UeXBlVG9OYW1lW3VuaWZvcm0udHlwZV07XG4gICAgICAgICAgICBEZWJ1Zy5hc3NlcnQodHlwZVN0cmluZy5sZW5ndGggPiAwLCBgVW5pZm9ybSB0eXBlICR7dW5pZm9ybS50eXBlfSBpcyBub3QgaGFuZGxlZC5gKTtcbiAgICAgICAgICAgIGNvZGUgKz0gYCAgICAke3R5cGVTdHJpbmd9ICR7dW5pZm9ybS5uYW1lfTtcXG5gO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gY29kZSArICd9O1xcbic7XG4gICAgfVxufVxuXG5leHBvcnQgeyBVbmlmb3JtRm9ybWF0LCBVbmlmb3JtQnVmZmVyRm9ybWF0IH07XG4iXSwibmFtZXMiOlsidW5pZm9ybVR5cGVUb051bUVsZW1lbnRzIiwiVU5JRk9STVRZUEVfRkxPQVQiLCJVTklGT1JNVFlQRV9WRUMyIiwiVU5JRk9STVRZUEVfVkVDMyIsIlVOSUZPUk1UWVBFX1ZFQzQiLCJVTklGT1JNVFlQRV9JTlQiLCJVTklGT1JNVFlQRV9JVkVDMiIsIlVOSUZPUk1UWVBFX0lWRUMzIiwiVU5JRk9STVRZUEVfSVZFQzQiLCJVTklGT1JNVFlQRV9CT09MIiwiVU5JRk9STVRZUEVfQlZFQzIiLCJVTklGT1JNVFlQRV9CVkVDMyIsIlVOSUZPUk1UWVBFX0JWRUM0IiwiVU5JRk9STVRZUEVfTUFUMiIsIlVOSUZPUk1UWVBFX01BVDMiLCJVTklGT1JNVFlQRV9NQVQ0IiwiVW5pZm9ybUZvcm1hdCIsImNvbnN0cnVjdG9yIiwibmFtZSIsInR5cGUiLCJjb3VudCIsImJ5dGVTaXplIiwib2Zmc2V0Iiwic2NvcGVJZCIsIkRlYnVnIiwiYXNzZXJ0IiwiZWxlbWVudFNpemUiLCJjYWxjdWxhdGVPZmZzZXQiLCJhbGlnbm1lbnQiLCJtYXRoIiwicm91bmRVcCIsIlVuaWZvcm1CdWZmZXJGb3JtYXQiLCJncmFwaGljc0RldmljZSIsInVuaWZvcm1zIiwibWFwIiwiTWFwIiwic2NvcGUiLCJpIiwibGVuZ3RoIiwidW5pZm9ybSIsInJlc29sdmUiLCJzZXQiLCJnZXQiLCJnZXRTaGFkZXJEZWNsYXJhdGlvbiIsImJpbmRHcm91cCIsImJpbmRJbmRleCIsImJpbmRHcm91cE5hbWVzIiwiY29kZSIsImZvckVhY2giLCJ0eXBlU3RyaW5nIiwidW5pZm9ybVR5cGVUb05hbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQWNBLE1BQU1BLHdCQUF3QixHQUFHLEVBQUUsQ0FBQTtBQUNuQ0Esd0JBQXdC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