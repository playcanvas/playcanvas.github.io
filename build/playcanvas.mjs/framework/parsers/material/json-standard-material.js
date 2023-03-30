import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { Color } from '../../../core/math/color.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { BoundingBox } from '../../../core/shape/bounding-box.js';
import { SPECULAR_BLINN, SPECULAR_PHONG } from '../../../scene/constants.js';
import { StandardMaterial } from '../../../scene/materials/standard-material.js';
import { StandardMaterialValidator } from '../../../scene/materials/standard-material-validator.js';
import { standardMaterialParameterTypes } from '../../../scene/materials/standard-material-parameters.js';

class JsonStandardMaterialParser {
	constructor() {
		this._validator = null;
	}
	parse(input) {
		const migrated = this.migrate(input);
		const validated = this._validate(migrated);
		const material = new StandardMaterial();
		this.initialize(material, validated);
		return material;
	}
	initialize(material, data) {
		if (!data.validated) {
			data = this._validate(data);
		}
		if (data.chunks) {
			material.chunks = _extends({}, data.chunks);
		}
		for (const key in data) {
			const type = standardMaterialParameterTypes[key];
			const value = data[key];
			if (type === 'vec2') {
				material[key] = new Vec2(value[0], value[1]);
			} else if (type === 'rgb') {
				material[key] = new Color(value[0], value[1], value[2]);
			} else if (type === 'texture') {
				if (value instanceof Texture) {
					material[key] = value;
				} else if (!(material[key] instanceof Texture && typeof value === 'number' && value > 0)) {
					material[key] = null;
				}
			} else if (type === 'cubemap') {
				if (value instanceof Texture) {
					material[key] = value;
				} else if (!(material[key] instanceof Texture && typeof value === 'number' && value > 0)) {
					material[key] = null;
				}
				if (key === 'cubeMap' && !value) {
					material.prefilteredCubemaps = null;
				}
			} else if (type === 'boundingbox') {
				const center = new Vec3(value.center[0], value.center[1], value.center[2]);
				const halfExtents = new Vec3(value.halfExtents[0], value.halfExtents[1], value.halfExtents[2]);
				material[key] = new BoundingBox(center, halfExtents);
			} else {
				material[key] = data[key];
			}
		}
		material.update();
	}
	migrate(data) {
		if (data.shadingModel === undefined) {
			if (data.shader === 'blinn') {
				data.shadingModel = SPECULAR_BLINN;
			} else {
				data.shadingModel = SPECULAR_PHONG;
			}
		}
		if (data.shader) delete data.shader;
		if (data.mapping_format) {
			data.mappingFormat = data.mapping_format;
			delete data.mapping_format;
		}
		let i;
		const RENAMED_PROPERTIES = [['bumpMapFactor', 'bumpiness'], ['aoUvSet', 'aoMapUv'], ['aoMapVertexColor', 'aoVertexColor'], ['diffuseMapVertexColor', 'diffuseVertexColor'], ['emissiveMapVertexColor', 'emissiveVertexColor'], ['specularMapVertexColor', 'specularVertexColor'], ['metalnessMapVertexColor', 'metalnessVertexColor'], ['opacityMapVertexColor', 'opacityVertexColor'], ['glossMapVertexColor', 'glossVertexColor'], ['lightMapVertexColor', 'lightVertexColor'], ['diffuseMapTint', 'diffuseTint'], ['specularMapTint', 'specularTint'], ['emissiveMapTint', 'emissiveTint'], ['metalnessMapTint', 'metalnessTint'], ['clearCoatGlossiness', 'clearCoatGloss']];
		for (i = 0; i < RENAMED_PROPERTIES.length; i++) {
			const _old = RENAMED_PROPERTIES[i][0];
			const _new = RENAMED_PROPERTIES[i][1];
			if (data[_old] !== undefined) {
				if (data[_new] === undefined) {
					data[_new] = data[_old];
				}
				delete data[_old];
			}
		}
		const DEPRECATED_PROPERTIES = ['fresnelFactor', 'shadowSampleType'];
		for (i = 0; i < DEPRECATED_PROPERTIES.length; i++) {
			const name = DEPRECATED_PROPERTIES[i];
			if (data.hasOwnProperty(name)) {
				delete data[name];
			}
		}
		return data;
	}
	_validate(data) {
		if (!data.validated) {
			if (!this._validator) {
				this._validator = new StandardMaterialValidator();
			}
			this._validator.validate(data);
		}
		return data;
	}
}

export { JsonStandardMaterialParser };
