import { UNIFORMTYPE_BVEC4, UNIFORMTYPE_BVEC4ARRAY, UNIFORMTYPE_UVEC4, UNIFORMTYPE_UVEC4ARRAY, UNIFORMTYPE_IVEC4, UNIFORMTYPE_IVEC4ARRAY, UNIFORMTYPE_VEC4, UNIFORMTYPE_VEC4ARRAY, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC3ARRAY, UNIFORMTYPE_UVEC3, UNIFORMTYPE_UVEC3ARRAY, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC3ARRAY, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC2ARRAY, UNIFORMTYPE_UVEC2, UNIFORMTYPE_UVEC2ARRAY, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC2ARRAY, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_BOOL, UNIFORMTYPE_BOOLARRAY, UNIFORMTYPE_UINT, UNIFORMTYPE_UINTARRAY, UNIFORMTYPE_INT, UNIFORMTYPE_INTARRAY, UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY } from '../constants.js';
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
        case UNIFORMTYPE_INT:
          type = UNIFORMTYPE_INTARRAY;
          break;
        case UNIFORMTYPE_UINT:
          type = UNIFORMTYPE_UINTARRAY;
          break;
        case UNIFORMTYPE_BOOL:
          type = UNIFORMTYPE_BOOLARRAY;
          break;
        case UNIFORMTYPE_VEC2:
          type = UNIFORMTYPE_VEC2ARRAY;
          break;
        case UNIFORMTYPE_IVEC2:
          type = UNIFORMTYPE_IVEC2ARRAY;
          break;
        case UNIFORMTYPE_UVEC2:
          type = UNIFORMTYPE_UVEC2ARRAY;
          break;
        case UNIFORMTYPE_BVEC2:
          type = UNIFORMTYPE_BVEC2ARRAY;
          break;
        case UNIFORMTYPE_VEC3:
          type = UNIFORMTYPE_VEC3ARRAY;
          break;
        case UNIFORMTYPE_IVEC3:
          type = UNIFORMTYPE_IVEC3ARRAY;
          break;
        case UNIFORMTYPE_UVEC3:
          type = UNIFORMTYPE_UVEC3ARRAY;
          break;
        case UNIFORMTYPE_BVEC3:
          type = UNIFORMTYPE_BVEC3ARRAY;
          break;
        case UNIFORMTYPE_VEC4:
          type = UNIFORMTYPE_VEC4ARRAY;
          break;
        case UNIFORMTYPE_IVEC4:
          type = UNIFORMTYPE_IVEC4ARRAY;
          break;
        case UNIFORMTYPE_UVEC4:
          type = UNIFORMTYPE_UVEC4ARRAY;
          break;
        case UNIFORMTYPE_BVEC4:
          type = UNIFORMTYPE_BVEC4ARRAY;
          break;
      }
    }
    this.dataType = type;
    this.value = [null, null, null, null];
    this.array = [];
  }
}

export { WebglShaderInput };
