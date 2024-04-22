import { math } from '../../core/math/math.js';
import { UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT4ARRAY, UNIFORMTYPE_BVEC4, UNIFORMTYPE_BVEC4ARRAY, UNIFORMTYPE_UVEC4, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_IVEC4, UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_VEC4, UNIFORMTYPE_VEC4ARRAY, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC3ARRAY, UNIFORMTYPE_UVEC3, UNIFORMTYPE_UVEC3ARRAY, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_UVEC2, UNIFORMTYPE_UVEC2ARRAY, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC2ARRAY, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_BOOL, UNIFORMTYPE_BOOLARRAY, UNIFORMTYPE_UINT, UNIFORMTYPE_UINTARRAY, UNIFORMTYPE_INT, UNIFORMTYPE_INTARRAY, UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY, bindGroupNames, uniformTypeToName, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3 } from './constants.js';

const uniformTypeToNumComponents = [];
uniformTypeToNumComponents[UNIFORMTYPE_FLOAT] = 1;
uniformTypeToNumComponents[UNIFORMTYPE_VEC2] = 2;
uniformTypeToNumComponents[UNIFORMTYPE_VEC3] = 3;
uniformTypeToNumComponents[UNIFORMTYPE_VEC4] = 4;
uniformTypeToNumComponents[UNIFORMTYPE_INT] = 1;
uniformTypeToNumComponents[UNIFORMTYPE_IVEC2] = 2;
uniformTypeToNumComponents[UNIFORMTYPE_IVEC3] = 3;
uniformTypeToNumComponents[UNIFORMTYPE_IVEC4] = 4;
uniformTypeToNumComponents[UNIFORMTYPE_BOOL] = 1;
uniformTypeToNumComponents[UNIFORMTYPE_BVEC2] = 2;
uniformTypeToNumComponents[UNIFORMTYPE_BVEC3] = 3;
uniformTypeToNumComponents[UNIFORMTYPE_BVEC4] = 4;
uniformTypeToNumComponents[UNIFORMTYPE_MAT2] = 8;
uniformTypeToNumComponents[UNIFORMTYPE_MAT3] = 12;
uniformTypeToNumComponents[UNIFORMTYPE_MAT4] = 16;
uniformTypeToNumComponents[UNIFORMTYPE_UINT] = 1;
uniformTypeToNumComponents[UNIFORMTYPE_UVEC2] = 2;
uniformTypeToNumComponents[UNIFORMTYPE_UVEC3] = 3;
uniformTypeToNumComponents[UNIFORMTYPE_UVEC4] = 4;
class UniformFormat {
  get isArrayType() {
    return this.count > 0;
  }
  constructor(name, type, count = 0) {
    this.name = void 0;
    this.type = void 0;
    this.byteSize = void 0;
    this.offset = void 0;
    this.scopeId = void 0;
    this.count = void 0;
    this.numComponents = void 0;
    this.shortName = name;
    this.name = count ? `${name}[0]` : name;
    this.type = type;
    this.numComponents = uniformTypeToNumComponents[type];
    this.updateType = type;
    if (count > 0) {
      switch (type) {
        case UNIFORMTYPE_FLOAT:
          this.updateType = UNIFORMTYPE_FLOATARRAY;
          break;
        case UNIFORMTYPE_INT:
          this.updateType = UNIFORMTYPE_INTARRAY;
          break;
        case UNIFORMTYPE_UINT:
          this.updateType = UNIFORMTYPE_UINTARRAY;
          break;
        case UNIFORMTYPE_BOOL:
          this.updateType = UNIFORMTYPE_BOOLARRAY;
          break;
        case UNIFORMTYPE_VEC2:
          this.updateType = UNIFORMTYPE_VEC2ARRAY;
          break;
        case UNIFORMTYPE_IVEC2:
          this.updateType = UNIFORMTYPE_IVEC2ARRAY;
          break;
        case UNIFORMTYPE_UVEC2:
          this.updateType = UNIFORMTYPE_UVEC2ARRAY;
          break;
        case UNIFORMTYPE_BVEC2:
          this.updateType = UNIFORMTYPE_BVEC2ARRAY;
          break;
        case UNIFORMTYPE_VEC3:
          this.updateType = UNIFORMTYPE_VEC3ARRAY;
          break;
        case UNIFORMTYPE_IVEC3:
          this.updateType = UNIFORMTYPE_IVEC3ARRAY;
          break;
        case UNIFORMTYPE_UVEC3:
          this.updateType = UNIFORMTYPE_UVEC3ARRAY;
          break;
        case UNIFORMTYPE_BVEC3:
          this.updateType = UNIFORMTYPE_BVEC3ARRAY;
          break;
        case UNIFORMTYPE_VEC4:
          this.updateType = UNIFORMTYPE_VEC4ARRAY;
          break;
        case UNIFORMTYPE_IVEC4:
          this.updateType = UNIFORMTYPE_IVEC4ARRAY;
          break;
        case UNIFORMTYPE_UVEC4:
          this.updateType = UNIFORMTYPE_UVEC4ARRAY;
          break;
        case UNIFORMTYPE_BVEC4:
          this.updateType = UNIFORMTYPE_BVEC4ARRAY;
          break;
        case UNIFORMTYPE_MAT4:
          this.updateType = UNIFORMTYPE_MAT4ARRAY;
          break;
      }
    }
    this.count = count;
    let componentSize = this.numComponents;
    if (count) {
      componentSize = math.roundUp(componentSize, 4);
    }
    this.byteSize = componentSize * 4;
    if (count) this.byteSize *= count;
  }
  calculateOffset(offset) {
    let alignment = this.byteSize <= 8 ? this.byteSize : 16;
    if (this.count) alignment = 16;
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
      code += `    ${typeString} ${uniform.shortName}${uniform.count ? `[${uniform.count}]` : ''};\n`;
    });
    return code + '};\n';
  }
}

export { UniformBufferFormat, UniformFormat };
