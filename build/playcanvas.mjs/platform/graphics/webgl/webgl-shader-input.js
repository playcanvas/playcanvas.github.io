import { UNIFORMTYPE_VEC4, UNIFORMTYPE_VEC4ARRAY, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY } from '../constants.js';
import { Version } from '../version.js';

class WebglShaderInput {
	constructor(graphicsDevice, name, type, locationId) {
		this.locationId = locationId;
		this.scopeId = graphicsDevice.scope.resolve(name);
		this.version = new Version();
		if (name.substring(name.length - 3) === "[0]") {
			switch (type) {
				case UNIFORMTYPE_FLOAT:
					type = UNIFORMTYPE_FLOATARRAY;
					break;
				case UNIFORMTYPE_VEC2:
					type = UNIFORMTYPE_VEC2ARRAY;
					break;
				case UNIFORMTYPE_VEC3:
					type = UNIFORMTYPE_VEC3ARRAY;
					break;
				case UNIFORMTYPE_VEC4:
					type = UNIFORMTYPE_VEC4ARRAY;
					break;
			}
		}
		this.dataType = type;
		this.value = [null, null, null, null];
		this.array = [];
	}
}

export { WebglShaderInput };
