import '../core/tracing.js';
import { math } from '../math/math.js';
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
    const elementSize = uniformTypeToNumElements[type];
    this.byteSize = count * elementSize * 4;
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
      code += `    ${typeString} ${uniform.name};\n`;
    });
    return code + '};\n';
  }

}

export { UniformBufferFormat, UniformFormat };
