import '../../core/debug.js';
import { math } from '../../core/math/math.js';
import { UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT4ARRAY, UNIFORMTYPE_VEC4, UNIFORMTYPE_VEC4ARRAY, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY, bindGroupNames, uniformTypeToName, UNIFORMTYPE_INT, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_BOOL, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3 } from './constants.js';

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
	constructor(name, type, count = 0) {
		this.name = void 0;
		this.type = void 0;
		this.byteSize = void 0;
		this.offset = void 0;
		this.scopeId = void 0;
		this.count = void 0;
		this.shortName = name;
		this.name = count ? `${name}[0]` : name;
		this.type = type;
		this.updateType = type;
		if (count) {
			switch (type) {
				case UNIFORMTYPE_FLOAT:
					this.updateType = UNIFORMTYPE_FLOATARRAY;
					break;
				case UNIFORMTYPE_VEC2:
					this.updateType = UNIFORMTYPE_VEC2ARRAY;
					break;
				case UNIFORMTYPE_VEC3:
					this.updateType = UNIFORMTYPE_VEC3ARRAY;
					break;
				case UNIFORMTYPE_VEC4:
					this.updateType = UNIFORMTYPE_VEC4ARRAY;
					break;
				case UNIFORMTYPE_MAT4:
					this.updateType = UNIFORMTYPE_MAT4ARRAY;
					break;
			}
		}
		this.count = count;
		let elementSize = uniformTypeToNumElements[type];
		if (count) elementSize = math.roundUp(elementSize, 4);
		this.byteSize = elementSize * 4;
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
