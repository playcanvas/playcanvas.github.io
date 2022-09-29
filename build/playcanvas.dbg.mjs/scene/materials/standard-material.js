/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { Color } from '../../math/color.js';
import { Vec2 } from '../../math/vec2.js';
import { Quat } from '../../math/quat.js';
import { math } from '../../math/math.js';
import { _matTex2D, standard } from '../../graphics/program-lib/programs/standard.js';
import { EnvLighting } from '../../graphics/env-lighting.js';
import { CUBEPROJ_BOX, SPECULAR_PHONG, SHADER_DEPTH, SHADER_PICK, DETAILMODE_MUL, SPECOCC_AO, SPECULAR_BLINN, FRESNEL_SCHLICK, CUBEPROJ_NONE } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { Material } from './material.js';
import { StandardMaterialOptionsBuilder } from './standard-material-options-builder.js';
import { ShaderProcessorOptions } from '../../graphics/shader-processor-options.js';
import { standardMaterialTextureParameters, standardMaterialCubemapParameters } from './standard-material-parameters.js';

const _props = {};
const _uniforms = {};

let _params = new Set();

class StandardMaterial extends Material {
  constructor() {
    super();
    this._dirtyShader = true;
    this._assetReferences = {};
    this._activeParams = new Set();
    this._activeLightingParams = new Set();
    this.shaderOptBuilder = new StandardMaterialOptionsBuilder();
    this.reset();
  }

  reset() {
    Object.keys(_props).forEach(name => {
      this[`_${name}`] = _props[name].value();
    });
    this._chunks = {};
    this._uniformCache = {};
  }

  set shader(shader) {
    Debug.warn('StandardMaterial#shader property is not implemented, and should not be used.');
  }

  get shader() {
    Debug.warn('StandardMaterial#shader property is not implemented, and should not be used.');
    return null;
  }

  set chunks(value) {
    this._dirtyShader = true;
    this._chunks = value;
  }

  get chunks() {
    this._dirtyShader = true;
    return this._chunks;
  }

  copy(source) {
    super.copy(source);
    Object.keys(_props).forEach(k => {
      this[k] = source[k];
    });

    for (const p in source._chunks) {
      if (source._chunks.hasOwnProperty(p)) this._chunks[p] = source._chunks[p];
    }

    return this;
  }

  _setParameter(name, value) {
    _params.add(name);

    this.setParameter(name, value);
  }

  _setParameters(parameters) {
    parameters.forEach(v => {
      this._setParameter(v.name, v.value);
    });
  }

  _processParameters(paramsName) {
    const prevParams = this[paramsName];
    prevParams.forEach(param => {
      if (!_params.has(param)) {
        delete this.parameters[param];
      }
    });
    this[paramsName] = _params;
    _params = prevParams;

    _params.clear();
  }

  _updateMap(p) {
    const mname = p + 'Map';
    const map = this[mname];

    if (map) {
      this._setParameter('texture_' + mname, map);

      const tname = mname + 'Transform';
      const uniform = this.getUniform(tname);

      if (uniform) {
        this._setParameters(uniform);
      }
    }
  }

  _allocUniform(name, allocFunc) {
    let uniform = this._uniformCache[name];

    if (!uniform) {
      uniform = allocFunc();
      this._uniformCache[name] = uniform;
    }

    return uniform;
  }

  getUniform(name, device, scene) {
    return _uniforms[name](this, device, scene);
  }

  updateUniforms(device, scene) {
    const getUniform = name => {
      return this.getUniform(name, device, scene);
    };

    this._setParameter('material_ambient', getUniform('ambient'));

    if (!this.diffuseMap || this.diffuseTint) {
      this._setParameter('material_diffuse', getUniform('diffuse'));
    }

    if (!this.useMetalness) {
      if (!this.specularMap || this.specularTint) {
        this._setParameter('material_specular', getUniform('specular'));
      }
    } else {
      if (!this.metalnessMap || this.metalness < 1) {
        this._setParameter('material_metalness', this.metalness);
      }

      if (!this.specularMap || this.specularTint) {
        this._setParameter('material_specular', getUniform('specular'));
      }

      if (!this.specularityFactorMap || this.specularityFactorTint) {
        this._setParameter('material_specularityFactor', this.specularityFactor);
      }

      if (!this.sheenMap || this.sheenTint) {
        this._setParameter('material_sheen', getUniform('sheen'));
      }

      if (!this.sheenGlossinessMap || this.sheenGlossinessTint) {
        this._setParameter('material_sheenGlossiness', this.sheenGlossiness);
      }

      if (this.refractionIndex > 0.0) {
        const oneOverRefractionIndex = 1.0 / this.refractionIndex;
        const f0 = (oneOverRefractionIndex - 1) / (oneOverRefractionIndex + 1);

        this._setParameter('material_f0', f0 * f0);
      } else {
        this._setParameter('material_f0', 1.0);
      }
    }

    if (this.enableGGXSpecular) {
      this._setParameter('material_anisotropy', this.anisotropy);
    }

    if (this.clearCoat > 0) {
      this._setParameter('material_clearCoat', this.clearCoat);

      this._setParameter('material_clearCoatGlossiness', this.clearCoatGlossiness);

      this._setParameter('material_clearCoatBumpiness', this.clearCoatBumpiness);
    }

    this._setParameter('material_shininess', getUniform('shininess'));

    if (!this.emissiveMap || this.emissiveTint) {
      this._setParameter('material_emissive', getUniform('emissive'));
    }

    if (this.emissiveIntensity !== 1) {
      this._setParameter('material_emissiveIntensity', this.emissiveIntensity);
    }

    if (this.refraction > 0) {
      this._setParameter('material_refraction', this.refraction);

      this._setParameter('material_refractionIndex', this.refractionIndex);
    }

    if (this.useDynamicRefraction) {
      this._setParameter('material_thickness', this.thickness);

      this._setParameter('material_attenuation', getUniform('attenuation'));

      this._setParameter('material_invAttenuationDistance', this.attenuationDistance === 0 ? 0 : 1.0 / this.attenuationDistance);
    }

    if (this.useIridescence) {
      this._setParameter('material_iridescence', this.iridescence);

      this._setParameter('material_iridescenceRefractionIndex', this.iridescenceRefractionIndex);

      this._setParameter('material_iridescenceThicknessMin', this.iridescenceThicknessMin);

      this._setParameter('material_iridescenceThicknessMax', this.iridescenceThicknessMax);
    }

    this._setParameter('material_opacity', this.opacity);

    if (this.opacityFadesSpecular === false) {
      this._setParameter('material_alphaFade', this.alphaFade);
    }

    if (this.occludeSpecular) {
      this._setParameter('material_occludeSpecularIntensity', this.occludeSpecularIntensity);
    }

    if (this.cubeMapProjection === CUBEPROJ_BOX) {
      this._setParameter(getUniform('cubeMapProjectionBox'));
    }

    for (const p in _matTex2D) {
      this._updateMap(p);
    }

    if (this.ambientSH) {
      this._setParameter('ambientSH[0]', this.ambientSH);
    }

    if (this.normalMap) {
      this._setParameter('material_bumpiness', this.bumpiness);
    }

    if (this.normalMap && this.normalDetailMap) {
      this._setParameter('material_normalDetailMapBumpiness', this.normalDetailMapBumpiness);
    }

    if (this.heightMap) {
      this._setParameter('material_heightMapFactor', getUniform('heightMapFactor'));
    }

    const isPhong = this.shadingModel === SPECULAR_PHONG;

    if (this.envAtlas && this.cubeMap && !isPhong) {
      this._setParameter('texture_envAtlas', this.envAtlas);

      this._setParameter('texture_cubeMap', this.cubeMap);
    } else if (this.envAtlas && !isPhong) {
      this._setParameter('texture_envAtlas', this.envAtlas);
    } else if (this.cubeMap) {
      this._setParameter('texture_cubeMap', this.cubeMap);
    } else if (this.sphereMap) {
      this._setParameter('texture_sphereMap', this.sphereMap);
    }

    this._setParameter('material_reflectivity', this.reflectivity);

    this._processParameters('_activeParams');

    if (this._dirtyShader) {
      this.clearVariants();
    }
  }

  updateEnvUniforms(device, scene) {
    const isPhong = this.shadingModel === SPECULAR_PHONG;
    const hasLocalEnvOverride = this.envAtlas && !isPhong || this.cubeMap || this.sphereMap;

    if (!hasLocalEnvOverride && this.useSkybox) {
      if (scene.envAtlas && scene.skybox && !isPhong) {
        this._setParameter('texture_envAtlas', scene.envAtlas);

        this._setParameter('texture_cubeMap', scene.skybox);
      } else if (scene.envAtlas && !isPhong) {
        this._setParameter('texture_envAtlas', scene.envAtlas);
      } else if (scene.skybox) {
        this._setParameter('texture_cubeMap', scene.skybox);
      }

      if (!scene.skyboxRotation.equals(Quat.IDENTITY) && scene._skyboxRotationMat3) {
        this._setParameter('cubeMapRotationMatrix', scene._skyboxRotationMat3.data);
      }
    }

    this._processParameters('_activeLightingParams');
  }

  getShaderVariant(device, scene, objDefs, staticLightList, pass, sortedLights, viewUniformFormat, viewBindGroupFormat) {
    this.updateEnvUniforms(device, scene);
    const minimalOptions = pass === SHADER_DEPTH || pass === SHADER_PICK || ShaderPass.isShadow(pass);
    let options = minimalOptions ? standard.optionsContextMin : standard.optionsContext;
    if (minimalOptions) this.shaderOptBuilder.updateMinRef(options, scene, this, objDefs, staticLightList, pass, sortedLights);else this.shaderOptBuilder.updateRef(options, scene, this, objDefs, staticLightList, pass, sortedLights);

    if (this.onUpdateShader) {
      options = this.onUpdateShader(options);
    }

    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat);
    const library = device.getProgramLibrary();
    library.register('standard', standard);
    const shader = library.getProgram('standard', options, processingOptions);
    this._dirtyShader = false;
    return shader;
  }

  destroy() {
    for (const asset in this._assetReferences) {
      this._assetReferences[asset]._unbind();
    }

    this._assetReferences = null;
    super.destroy();
  }

}

StandardMaterial.TEXTURE_PARAMETERS = standardMaterialTextureParameters;
StandardMaterial.CUBEMAP_PARAMETERS = standardMaterialCubemapParameters;

const defineUniform = (name, getUniformFunc) => {
  _uniforms[name] = getUniformFunc;
};

const definePropInternal = (name, constructorFunc, setterFunc, getterFunc) => {
  Object.defineProperty(StandardMaterial.prototype, name, {
    get: getterFunc || function () {
      return this[`_${name}`];
    },
    set: setterFunc
  });
  _props[name] = {
    value: constructorFunc
  };
};

const defineValueProp = prop => {
  const internalName = `_${prop.name}`;

  const dirtyShaderFunc = prop.dirtyShaderFunc || (() => true);

  const setterFunc = function setterFunc(value) {
    const oldValue = this[internalName];

    if (oldValue !== value) {
      this._dirtyShader = this._dirtyShader || dirtyShaderFunc(oldValue, value);
      this[internalName] = value;
    }
  };

  definePropInternal(prop.name, () => prop.defaultValue, setterFunc, prop.getterFunc);
};

const defineAggProp = prop => {
  const internalName = `_${prop.name}`;

  const dirtyShaderFunc = prop.dirtyShaderFunc || (() => true);

  const setterFunc = function setterFunc(value) {
    const oldValue = this[internalName];

    if (!oldValue.equals(value)) {
      this._dirtyShader = this._dirtyShader || dirtyShaderFunc(oldValue, value);
      this[internalName] = oldValue.copy(value);
    }
  };

  definePropInternal(prop.name, () => prop.defaultValue.clone(), setterFunc, prop.getterFunc);
};

const defineProp = prop => {
  return prop.defaultValue && prop.defaultValue.clone ? defineAggProp(prop) : defineValueProp(prop);
};

function _defineTex2D(name, uv, channels, defChannel, vertexColor, detailMode) {
  _matTex2D[name] = channels;
  defineProp({
    name: `${name}Map`,
    defaultValue: null,
    dirtyShaderFunc: (oldValue, newValue) => {
      return !!oldValue !== !!newValue || oldValue && (oldValue.type !== newValue.type || oldValue.fixCubemapSeams !== newValue.fixCubemapSeams || oldValue.format !== newValue.format);
    }
  });
  defineProp({
    name: `${name}MapTiling`,
    defaultValue: new Vec2(1, 1)
  });
  defineProp({
    name: `${name}MapOffset`,
    defaultValue: new Vec2(0, 0)
  });
  defineProp({
    name: `${name}MapRotation`,
    defaultValue: 0
  });
  defineProp({
    name: `${name}MapUv`,
    defaultValue: uv
  });

  if (channels > 0) {
    defineProp({
      name: `${name}MapChannel`,
      defaultValue: defChannel ? defChannel : channels > 1 ? 'rgb' : 'g'
    });
  }

  if (vertexColor) {
    defineProp({
      name: `${name}VertexColor`,
      defaultValue: false
    });

    if (channels > 0) {
      defineProp({
        name: `${name}VertexColorChannel`,
        defaultValue: defChannel ? defChannel : channels > 1 ? 'rgb' : 'g'
      });
    }
  }

  if (detailMode) {
    defineProp({
      name: `${name}Mode`,
      defaultValue: DETAILMODE_MUL
    });
  }

  const mapTiling = `${name}MapTiling`;
  const mapOffset = `${name}MapOffset`;
  const mapRotation = `${name}MapRotation`;
  const mapTransform = `${name}MapTransform`;
  defineUniform(mapTransform, (material, device, scene) => {
    const tiling = material[mapTiling];
    const offset = material[mapOffset];
    const rotation = material[mapRotation];

    if (tiling.x === 1 && tiling.y === 1 && offset.x === 0 && offset.y === 0 && rotation === 0) {
      return null;
    }

    const uniform = material._allocUniform(mapTransform, () => {
      return [{
        name: `texture_${mapTransform}0`,
        value: new Float32Array(3)
      }, {
        name: `texture_${mapTransform}1`,
        value: new Float32Array(3)
      }];
    });

    const cr = Math.cos(rotation * math.DEG_TO_RAD);
    const sr = Math.sin(rotation * math.DEG_TO_RAD);
    const uniform0 = uniform[0].value;
    uniform0[0] = cr * tiling.x;
    uniform0[1] = -sr * tiling.y;
    uniform0[2] = offset.x;
    const uniform1 = uniform[1].value;
    uniform1[0] = sr * tiling.x;
    uniform1[1] = cr * tiling.y;
    uniform1[2] = 1.0 - tiling.y - offset.y;
    return uniform;
  });
}

function _defineColor(name, defaultValue) {
  defineProp({
    name: name,
    defaultValue: defaultValue,
    getterFunc: function () {
      this._dirtyShader = true;
      return this[`_${name}`];
    }
  });
  defineUniform(name, (material, device, scene) => {
    const uniform = material._allocUniform(name, () => new Float32Array(3));

    const color = material[name];
    const gamma = material.useGammaTonemap && scene.gammaCorrection;

    if (gamma) {
      uniform[0] = Math.pow(color.r, 2.2);
      uniform[1] = Math.pow(color.g, 2.2);
      uniform[2] = Math.pow(color.b, 2.2);
    } else {
      uniform[0] = color.r;
      uniform[1] = color.g;
      uniform[2] = color.b;
    }

    return uniform;
  });
}

function _defineFloat(name, defaultValue, getUniformFunc) {
  defineProp({
    name: name,
    defaultValue: defaultValue,
    dirtyShaderFunc: (oldValue, newValue) => {
      return (oldValue === 0 || oldValue === 1) !== (newValue === 0 || newValue === 1);
    }
  });
  defineUniform(name, getUniformFunc);
}

function _defineObject(name, getUniformFunc) {
  defineProp({
    name: name,
    defaultValue: null,
    dirtyShaderFunc: (oldValue, newValue) => {
      return !!oldValue === !!newValue;
    }
  });
  defineUniform(name, getUniformFunc);
}

function _defineFlag(name, defaultValue) {
  defineProp({
    name: name,
    defaultValue: defaultValue
  });
}

function _defineMaterialProps() {
  _defineColor('ambient', new Color(0.7, 0.7, 0.7));

  _defineColor('diffuse', new Color(1, 1, 1));

  _defineColor('specular', new Color(0, 0, 0));

  _defineColor('emissive', new Color(0, 0, 0));

  _defineColor('sheen', new Color(1, 1, 1));

  _defineColor('attenuation', new Color(1, 1, 1));

  _defineFloat('emissiveIntensity', 1);

  _defineFloat('specularityFactor', 1);

  _defineFloat('sheenGlossiness', 0);

  _defineFloat('shininess', 25, (material, device, scene) => {
    return material.shadingModel === SPECULAR_PHONG ? Math.pow(2, material.shininess * 0.01 * 11) : material.shininess * 0.01;
  });

  _defineFloat('heightMapFactor', 1, (material, device, scene) => {
    return material.heightMapFactor * 0.025;
  });

  _defineFloat('opacity', 1);

  _defineFloat('alphaFade', 1);

  _defineFloat('alphaTest', 0);

  _defineFloat('bumpiness', 1);

  _defineFloat('normalDetailMapBumpiness', 1);

  _defineFloat('reflectivity', 1);

  _defineFloat('occludeSpecularIntensity', 1);

  _defineFloat('refraction', 0);

  _defineFloat('refractionIndex', 1.0 / 1.5);

  _defineFloat('thickness', 0);

  _defineFloat('attenuationDistance', 0);

  _defineFloat('metalness', 1);

  _defineFloat('anisotropy', 0);

  _defineFloat('clearCoat', 0);

  _defineFloat('clearCoatGlossiness', 1);

  _defineFloat('clearCoatBumpiness', 1);

  _defineFloat('aoUvSet', 0, null);

  _defineFloat('iridescence', 0);

  _defineFloat('iridescenceRefractionIndex', 1.0 / 1.5);

  _defineFloat('iridescenceThicknessMin', 0);

  _defineFloat('iridescenceThicknessMax', 0);

  _defineObject('ambientSH');

  _defineObject('cubeMapProjectionBox', (material, device, scene) => {
    const uniform = material._allocUniform('cubeMapProjectionBox', () => {
      return [{
        name: 'envBoxMin',
        value: new Float32Array(3)
      }, {
        name: 'envBoxMax',
        value: new Float32Array(3)
      }];
    });

    const bboxMin = material.cubeMapProjectionBox.getMin();
    const minUniform = uniform[0].value;
    minUniform[0] = bboxMin.x;
    minUniform[1] = bboxMin.y;
    minUniform[2] = bboxMin.z;
    const bboxMax = material.cubeMapProjectionBox.getMax();
    const maxUniform = uniform[1].value;
    maxUniform[0] = bboxMax.x;
    maxUniform[1] = bboxMax.y;
    maxUniform[2] = bboxMax.z;
    return uniform;
  });

  _defineFlag('ambientTint', false);

  _defineFlag('diffuseTint', false);

  _defineFlag('specularTint', false);

  _defineFlag('specularityFactorTint', false);

  _defineFlag('emissiveTint', false);

  _defineFlag('fastTbn', false);

  _defineFlag('useMetalness', false);

  _defineFlag('useMetalnessSpecularColor', false);

  _defineFlag('useSheen', false);

  _defineFlag('enableGGXSpecular', false);

  _defineFlag('occludeDirect', false);

  _defineFlag('normalizeNormalMap', true);

  _defineFlag('conserveEnergy', true);

  _defineFlag('opacityFadesSpecular', true);

  _defineFlag('occludeSpecular', SPECOCC_AO);

  _defineFlag('shadingModel', SPECULAR_BLINN);

  _defineFlag('fresnelModel', FRESNEL_SCHLICK);

  _defineFlag('useDynamicRefraction', false);

  _defineFlag('cubeMapProjection', CUBEPROJ_NONE);

  _defineFlag('customFragmentShader', null);

  _defineFlag('forceFragmentPrecision', null);

  _defineFlag('useFog', true);

  _defineFlag('useLighting', true);

  _defineFlag('useGammaTonemap', true);

  _defineFlag('useSkybox', true);

  _defineFlag('forceUv1', false);

  _defineFlag('pixelSnap', false);

  _defineFlag('twoSidedLighting', false);

  _defineFlag('nineSlicedMode', undefined);

  _defineFlag('msdfTextAttribute', false);

  _defineFlag('useIridescence', false);

  _defineTex2D('diffuse', 0, 3, '', true);

  _defineTex2D('specular', 0, 3, '', true);

  _defineTex2D('emissive', 0, 3, '', true);

  _defineTex2D('thickness', 0, 1, '', true);

  _defineTex2D('specularityFactor', 0, 1, '', true);

  _defineTex2D('normal', 0, -1, '', false);

  _defineTex2D('metalness', 0, 1, '', true);

  _defineTex2D('gloss', 0, 1, '', true);

  _defineTex2D('opacity', 0, 1, 'a', true);

  _defineTex2D('refraction', 0, 1, '', true);

  _defineTex2D('height', 0, 1, '', false);

  _defineTex2D('ao', 0, 1, '', true);

  _defineTex2D('light', 1, 3, '', true);

  _defineTex2D('msdf', 0, 3, '', false);

  _defineTex2D('diffuseDetail', 0, 3, '', false, true);

  _defineTex2D('normalDetail', 0, -1, '', false);

  _defineTex2D('clearCoat', 0, 1, '', true);

  _defineTex2D('clearCoatGloss', 0, 1, '', true);

  _defineTex2D('clearCoatNormal', 0, -1, '', false);

  _defineTex2D('sheen', 0, 3, '', true);

  _defineTex2D('sheenGloss', 0, 1, '', true);

  _defineTex2D('iridescence', 0, 1, '', true);

  _defineTex2D('iridescenceThickness', 0, 1, '', true);

  _defineObject('cubeMap');

  _defineObject('sphereMap');

  _defineObject('envAtlas');

  const getterFunc = function getterFunc() {
    return this._prefilteredCubemaps;
  };

  const setterFunc = function setterFunc(value) {
    const cubemaps = this._prefilteredCubemaps;
    value = value || [];
    let changed = false;
    let complete = true;

    for (let i = 0; i < 6; ++i) {
      const v = value[i] || null;

      if (cubemaps[i] !== v) {
        cubemaps[i] = v;
        changed = true;
      }

      complete = complete && !!cubemaps[i];
    }

    if (changed) {
      if (complete) {
        this.envAtlas = EnvLighting.generatePrefilteredAtlas(cubemaps, {
          target: this.envAtlas
        });
      } else {
        if (this.envAtlas) {
          this.envAtlas.destroy();
          this.envAtlas = null;
        }
      }

      this._dirtyShader = true;
    }
  };

  const empty = [null, null, null, null, null, null];
  definePropInternal('prefilteredCubemaps', () => empty.slice(), setterFunc, getterFunc);
}

_defineMaterialProps();

export { StandardMaterial };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQtbWF0ZXJpYWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9tYXRlcmlhbHMvc3RhbmRhcmQtbWF0ZXJpYWwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi9tYXRoL2NvbG9yLmpzJztcbmltcG9ydCB7IFZlYzIgfSBmcm9tICcuLi8uLi9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgUXVhdCB9IGZyb20gJy4uLy4uL21hdGgvcXVhdC5qcyc7XG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vbWF0aC9tYXRoLmpzJztcblxuaW1wb3J0IHsgX21hdFRleDJELCBzdGFuZGFyZCB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3Byb2dyYW0tbGliL3Byb2dyYW1zL3N0YW5kYXJkLmpzJztcbmltcG9ydCB7IEVudkxpZ2h0aW5nIH0gZnJvbSAnLi4vLi4vZ3JhcGhpY3MvZW52LWxpZ2h0aW5nLmpzJztcblxuaW1wb3J0IHtcbiAgICBDVUJFUFJPSl9CT1gsIENVQkVQUk9KX05PTkUsXG4gICAgREVUQUlMTU9ERV9NVUwsXG4gICAgRlJFU05FTF9TQ0hMSUNLLFxuICAgIFNIQURFUl9ERVBUSCwgU0hBREVSX1BJQ0ssXG4gICAgU1BFQ09DQ19BTyxcbiAgICBTUEVDVUxBUl9CTElOTiwgU1BFQ1VMQVJfUEhPTkdcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tICcuLi9zaGFkZXItcGFzcy5qcyc7XG5pbXBvcnQgeyBNYXRlcmlhbCB9IGZyb20gJy4vbWF0ZXJpYWwuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyIH0gZnJvbSAnLi9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLWJ1aWxkZXIuanMnO1xuaW1wb3J0IHsgU2hhZGVyUHJvY2Vzc29yT3B0aW9ucyB9IGZyb20gJy4uLy4uL2dyYXBoaWNzL3NoYWRlci1wcm9jZXNzb3Itb3B0aW9ucy5qcyc7XG5cbmltcG9ydCB7IHN0YW5kYXJkTWF0ZXJpYWxDdWJlbWFwUGFyYW1ldGVycywgc3RhbmRhcmRNYXRlcmlhbFRleHR1cmVQYXJhbWV0ZXJzIH0gZnJvbSAnLi9zdGFuZGFyZC1tYXRlcmlhbC1wYXJhbWV0ZXJzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2dyYXBoaWNzL3RleHR1cmUuanMnKS5UZXh0dXJlfSBUZXh0dXJlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vc2hhcGUvYm91bmRpbmctYm94LmpzJykuQm91bmRpbmdCb3h9IEJvdW5kaW5nQm94ICovXG5cbi8vIHByb3BlcnRpZXMgdGhhdCBnZXQgY3JlYXRlZCBvbiBhIHN0YW5kYXJkIG1hdGVyaWFsXG5jb25zdCBfcHJvcHMgPSB7fTtcblxuLy8gc3BlY2lhbCB1bmlmb3JtIGZ1bmN0aW9ucyBvbiBhIHN0YW5kYXJkIG1hdGVyaWFsXG5jb25zdCBfdW5pZm9ybXMgPSB7fTtcblxuLy8gdGVtcG9yYXJ5IHNldCBvZiBwYXJhbXNcbmxldCBfcGFyYW1zID0gbmV3IFNldCgpO1xuXG4vKipcbiAqIENhbGxiYWNrIHVzZWQgYnkge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb25VcGRhdGVTaGFkZXJ9LlxuICpcbiAqIEBjYWxsYmFjayBVcGRhdGVTaGFkZXJDYWxsYmFja1xuICogQHBhcmFtIHsqfSBvcHRpb25zIC0gQW4gb2JqZWN0IHdpdGggc2hhZGVyIGdlbmVyYXRvciBzZXR0aW5ncyAoYmFzZWQgb24gY3VycmVudCBtYXRlcmlhbCBhbmRcbiAqIHNjZW5lIHByb3BlcnRpZXMpLCB0aGF0IHlvdSBjYW4gY2hhbmdlIGFuZCB0aGVuIHJldHVybi4gUHJvcGVydGllcyBvZiB0aGUgb2JqZWN0IHBhc3NlZCBpbnRvXG4gKiB0aGlzIGZ1bmN0aW9uIGFyZSBkb2N1bWVudGVkIGluIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29uVXBkYXRlU2hhZGVyfS5cbiAqIEByZXR1cm5zIHsqfSBSZXR1cm5lZCBzZXR0aW5ncyB3aWxsIGJlIHVzZWQgYnkgdGhlIHNoYWRlci5cbiAqL1xuXG4vKipcbiAqIEEgU3RhbmRhcmQgbWF0ZXJpYWwgaXMgdGhlIG1haW4sIGdlbmVyYWwgcHVycG9zZSBtYXRlcmlhbCB0aGF0IGlzIG1vc3Qgb2Z0ZW4gdXNlZCBmb3IgcmVuZGVyaW5nLlxuICogSXQgY2FuIGFwcHJveGltYXRlIGEgd2lkZSB2YXJpZXR5IG9mIHN1cmZhY2UgdHlwZXMgYW5kIGNhbiBzaW11bGF0ZSBkeW5hbWljIHJlZmxlY3RlZCBsaWdodC5cbiAqIE1vc3QgbWFwcyBjYW4gdXNlIDMgdHlwZXMgb2YgaW5wdXQgdmFsdWVzIGluIGFueSBjb21iaW5hdGlvbjogY29uc3RhbnQgKGNvbG9yIG9yIG51bWJlciksIG1lc2hcbiAqIHZlcnRleCBjb2xvcnMgYW5kIGEgdGV4dHVyZS4gQWxsIGVuYWJsZWQgaW5wdXRzIGFyZSBtdWx0aXBsaWVkIHRvZ2V0aGVyLlxuICpcbiAqIEBwcm9wZXJ0eSB7Q29sb3J9IGFtYmllbnQgVGhlIGFtYmllbnQgY29sb3Igb2YgdGhlIG1hdGVyaWFsLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtDb2xvcn0gZGlmZnVzZSBUaGUgZGlmZnVzZSBjb2xvciBvZiB0aGUgbWF0ZXJpYWwuIFRoaXMgY29sb3IgdmFsdWUgaXMgMy1jb21wb25lbnRcbiAqIChSR0IpLCB3aGVyZSBlYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuIERlZmluZXMgYmFzaWMgc3VyZmFjZSBjb2xvciAoYWthIGFsYmVkbykuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGRpZmZ1c2VUaW50IE11bHRpcGx5IG1haW4gKHByaW1hcnkpIGRpZmZ1c2UgbWFwIGFuZC9vciBkaWZmdXNlIHZlcnRleCBjb2xvclxuICogYnkgdGhlIGNvbnN0YW50IGRpZmZ1c2UgdmFsdWUuXG4gKiBAcHJvcGVydHkge1RleHR1cmV8bnVsbH0gZGlmZnVzZU1hcCBUaGUgbWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzXG4gKiBudWxsKS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBkaWZmdXNlTWFwVXYgTWFpbiAocHJpbWFyeSkgZGlmZnVzZSBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gZGlmZnVzZU1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBtYWluIChwcmltYXJ5KSBkaWZmdXNlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gZGlmZnVzZU1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBtYWluIChwcmltYXJ5KSBkaWZmdXNlIG1hcC4gRWFjaFxuICogY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBkaWZmdXNlTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgbWFpblxuICogKHByaW1hcnkpIGRpZmZ1c2UgbWFwLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGRpZmZ1c2VNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBtYWluIChwcmltYXJ5KSBkaWZmdXNlIG1hcCB0byB1c2UuXG4gKiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBkaWZmdXNlVmVydGV4Q29sb3IgVXNlIG1lc2ggdmVydGV4IGNvbG9ycyBmb3IgZGlmZnVzZS4gSWYgZGlmZnVzZU1hcCBvciBhcmVcbiAqIGRpZmZ1c2VUaW50IGFyZSBzZXQsIHRoZXknbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGRpZmZ1c2VWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3IgZGlmZnVzZS4gQ2FuIGJlXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge1RleHR1cmV8bnVsbH0gZGlmZnVzZURldGFpbE1hcCBUaGUgZGV0YWlsIChzZWNvbmRhcnkpIGRpZmZ1c2UgbWFwIG9mIHRoZSBtYXRlcmlhbFxuICogKGRlZmF1bHQgaXMgbnVsbCkuIFdpbGwgb25seSBiZSB1c2VkIGlmIG1haW4gKHByaW1hcnkpIGRpZmZ1c2UgbWFwIGlzIG5vbi1udWxsLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGRpZmZ1c2VEZXRhaWxNYXBVdiBEZXRhaWwgKHNlY29uZGFyeSkgZGlmZnVzZSBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gZGlmZnVzZURldGFpbE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBkZXRhaWwgKHNlY29uZGFyeSkgZGlmZnVzZVxuICogbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBkaWZmdXNlRGV0YWlsTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGRldGFpbCAoc2Vjb25kYXJ5KSBkaWZmdXNlXG4gKiBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBkaWZmdXNlRGV0YWlsTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgbWFpblxuICogKHNlY29uZGFyeSkgZGlmZnVzZSBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZGlmZnVzZURldGFpbE1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIGRldGFpbCAoc2Vjb25kYXJ5KSBkaWZmdXNlIG1hcFxuICogdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGRpZmZ1c2VEZXRhaWxNb2RlIERldGVybWluZXMgaG93IHRoZSBtYWluIChwcmltYXJ5KSBhbmQgZGV0YWlsIChzZWNvbmRhcnkpXG4gKiBkaWZmdXNlIG1hcHMgYXJlIGJsZW5kZWQgdG9nZXRoZXIuIENhbiBiZTpcbiAqXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX01VTH06IE11bHRpcGx5IHRvZ2V0aGVyIHRoZSBwcmltYXJ5IGFuZCBzZWNvbmRhcnkgY29sb3JzLlxuICogLSB7QGxpbmsgREVUQUlMTU9ERV9BRER9OiBBZGQgdG9nZXRoZXIgdGhlIHByaW1hcnkgYW5kIHNlY29uZGFyeSBjb2xvcnMuXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX1NDUkVFTn06IFNvZnRlciB2ZXJzaW9uIG9mIHtAbGluayBERVRBSUxNT0RFX0FERH0uXG4gKiAtIHtAbGluayBERVRBSUxNT0RFX09WRVJMQVl9OiBNdWx0aXBsaWVzIG9yIHNjcmVlbnMgdGhlIGNvbG9ycywgZGVwZW5kaW5nIG9uIHRoZSBwcmltYXJ5IGNvbG9yLlxuICogLSB7QGxpbmsgREVUQUlMTU9ERV9NSU59OiBTZWxlY3Qgd2hpY2hldmVyIG9mIHRoZSBwcmltYXJ5IGFuZCBzZWNvbmRhcnkgY29sb3JzIGlzIGRhcmtlcixcbiAqIGNvbXBvbmVudC13aXNlLlxuICogLSB7QGxpbmsgREVUQUlMTU9ERV9NQVh9OiBTZWxlY3Qgd2hpY2hldmVyIG9mIHRoZSBwcmltYXJ5IGFuZCBzZWNvbmRhcnkgY29sb3JzIGlzIGxpZ2h0ZXIsXG4gKiBjb21wb25lbnQtd2lzZS5cbiAqXG4gKiBEZWZhdWx0cyB0byB7QGxpbmsgREVUQUlMTU9ERV9NVUx9LlxuICogQHByb3BlcnR5IHtDb2xvcn0gc3BlY3VsYXIgVGhlIHNwZWN1bGFyIGNvbG9yIG9mIHRoZSBtYXRlcmlhbC4gVGhpcyBjb2xvciB2YWx1ZSBpcyAzLWNvbXBvbmVudFxuICogKFJHQiksIHdoZXJlIGVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS4gRGVmaW5lcyBzdXJmYWNlIHJlZmxlY3Rpb24vc3BlY3VsYXIgY29sb3IuXG4gKiBBZmZlY3RzIHNwZWN1bGFyIGludGVuc2l0eSBhbmQgdGludC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc3BlY3VsYXJUaW50IE11bHRpcGx5IHNwZWN1bGFyIG1hcCBhbmQvb3Igc3BlY3VsYXIgdmVydGV4IGNvbG9yIGJ5IHRoZVxuICogY29uc3RhbnQgc3BlY3VsYXIgdmFsdWUuXG4gKiBAcHJvcGVydHkge1RleHR1cmV8bnVsbH0gc3BlY3VsYXJNYXAgVGhlIHNwZWN1bGFyIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJNYXBVdiBTcGVjdWxhciBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc3BlY3VsYXJNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgc3BlY3VsYXIgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzcGVjdWxhck1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBzcGVjdWxhciBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBzcGVjdWxhciBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc3BlY3VsYXJNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBzcGVjdWxhciBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLFxuICogXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc3BlY3VsYXJWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBzcGVjdWxhci4gSWYgc3BlY3VsYXJNYXAgb3JcbiAqIGFyZSBzcGVjdWxhclRpbnQgYXJlIHNldCwgdGhleSdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc3BlY3VsYXJWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3Igc3BlY3VsYXIuIENhbiBiZVxuICogQHByb3BlcnR5IHtib29sZWFufSBzcGVjdWxhcml0eUZhY3RvclRpbnQgTXVsdGlwbHkgc3BlY3VsYXJpdHkgZmFjdG9yIG1hcCBhbmQvb3Igc3BlY3VsYXIgdmVydGV4IGNvbG9yIGJ5IHRoZVxuICogY29uc3RhbnQgc3BlY3VsYXIgdmFsdWUuXG4gKiBcInJcIiwgXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJpdHlGYWN0b3IgVGhlIGZhY3RvciBvZiBzcGVjdWxhciBpbnRlbnNpdHksIHVzZWQgdG8gd2VpZ2h0IHRoZSBmcmVzbmVsIGFuZCBzcGVjdWxhcml0eS4gRGVmYXVsdCBpcyAxLjAuXG4gKiBAcHJvcGVydHkge1RleHR1cmV8bnVsbH0gc3BlY3VsYXJpdHlGYWN0b3JNYXAgVGhlIGZhY3RvciBvZiBzcGVjdWxhcml0eSBhcyBhIHRleHR1cmUgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJpdHlGYWN0b3JNYXBVdiBTcGVjdWxhcml0eSBmYWN0b3IgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IHNwZWN1bGFyaXR5RmFjdG9yTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIHNwZWN1bGFyaXR5IGZhY3RvciBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IHNwZWN1bGFyaXR5RmFjdG9yTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIHNwZWN1bGFyaXR5IGZhY3RvciBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3BlY3VsYXJpdHlGYWN0b3JNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBzcGVjdWxhcml0eSBmYWN0b3IgbWFwLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHNwZWN1bGFyaXR5RmFjdG9yTWFwQ2hhbm5lbCBUaGUgY2hhbm5lbCB1c2VkIGJ5IHRoZSBzcGVjdWxhcml0eSBmYWN0b3IgdGV4dHVyZSB0byBzYW1wbGUgZnJvbSAoZGVmYXVsdCBpcyAnYScpLlxuICogQHByb3BlcnR5IHtib29sZWFufSBzcGVjdWxhcml0eUZhY3RvclZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIHNwZWN1bGFyaXR5IGZhY3Rvci4gSWYgc3BlY3VsYXJpdHlGYWN0b3JNYXAgb3JcbiAqIGFyZSBzcGVjdWxhcml0eUZhY3RvclRpbnQgYXJlIHNldCwgdGhleSdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gc3BlY3VsYXJpdHlGYWN0b3JWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3Igc3BlY3VsYXJpdHkgZmFjdG9yLiBDYW4gYmVcbiAqIFwiclwiLCBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZW5hYmxlR0dYU3BlY3VsYXIgRW5hYmxlcyBHR1ggc3BlY3VsYXIuIEFsc28gZW5hYmxlc1xuICoge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjYW5pc290cm9weX0gIHBhcmFtZXRlciB0byBzZXQgbWF0ZXJpYWwgYW5pc290cm9weS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmlzb3Ryb3B5IERlZmluZXMgYW1vdW50IG9mIGFuaXNvdHJvcHkuIFJlcXVpcmVzXG4gKiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNlbmFibGVHR1hTcGVjdWxhcn0gaXMgc2V0IHRvIHRydWUuXG4gKlxuICogLSBXaGVuIGFuaXNvdHJvcHkgPT0gMCwgc3BlY3VsYXIgaXMgaXNvdHJvcGljLlxuICogLSBXaGVuIGFuaXNvdHJvcHkgPCAwLCBhbmlzb3Ryb3B5IGRpcmVjdGlvbiBhbGlnbnMgd2l0aCB0aGUgdGFuZ2VudCwgYW5kIHNwZWN1bGFyIGFuaXNvdHJvcHlcbiAqIGluY3JlYXNlcyBhcyB0aGUgYW5pc290cm9weSB2YWx1ZSBkZWNyZWFzZXMgdG8gbWluaW11bSBvZiAtMS5cbiAqIC0gV2hlbiBhbmlzb3Ryb3B5ID4gMCwgYW5pc290cm9weSBkaXJlY3Rpb24gYWxpZ25zIHdpdGggdGhlIGJpLW5vcm1hbCwgYW5kIHNwZWN1bGFyIGFuaXNvdHJvcHlcbiAqIGluY3JlYXNlcyBhcyBhbmlzb3Ryb3B5IHZhbHVlIGluY3JlYXNlcyB0byBtYXhpbXVtIG9mIDEuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdCBEZWZpbmVzIGludGVuc2l0eSBvZiBjbGVhciBjb2F0IGxheWVyIGZyb20gMCB0byAxLiBDbGVhciBjb2F0IGxheWVyXG4gKiBpcyBkaXNhYmxlZCB3aGVuIGNsZWFyQ29hdCA9PSAwLiBEZWZhdWx0IHZhbHVlIGlzIDAgKGRpc2FibGVkKS5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZXxudWxsfSBjbGVhckNvYXRNYXAgTW9ub2Nocm9tZSBjbGVhciBjb2F0IGludGVuc2l0eSBtYXAgKGRlZmF1bHQgaXMgbnVsbCkuIElmXG4gKiBzcGVjaWZpZWQsIHdpbGwgYmUgbXVsdGlwbGllZCBieSBub3JtYWxpemVkICdjbGVhckNvYXQnIHZhbHVlIGFuZC9vciB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdE1hcFV2IENsZWFyIGNvYXQgaW50ZW5zaXR5IG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXRNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgY2xlYXIgY29hdCBpbnRlbnNpdHkgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXRNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgY2xlYXIgY29hdCBpbnRlbnNpdHkgbWFwLiBFYWNoXG4gKiBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdE1hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIGNsZWFyIGNvYXRcbiAqIGludGVuc2l0eSBtYXAuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gY2xlYXJDb2F0TWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBjbGVhciBjb2F0IGludGVuc2l0eSBtYXAgdG8gdXNlLiBDYW5cbiAqIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGNsZWFyQ29hdFZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGNsZWFyIGNvYXQgaW50ZW5zaXR5LiBJZlxuICogY2xlYXJDb2F0TWFwIGlzIHNldCwgaXQnbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGNsZWFyQ29hdFZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbCB0byB1c2UgZm9yIGNsZWFyIGNvYXRcbiAqIGludGVuc2l0eS4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0R2xvc3NpbmVzcyBEZWZpbmVzIHRoZSBjbGVhciBjb2F0IGdsb3NzaW5lc3Mgb2YgdGhlIGNsZWFyIGNvYXQgbGF5ZXJcbiAqIGZyb20gMCAocm91Z2gpIHRvIDEgKG1pcnJvcikuXG4gKiBAcHJvcGVydHkge1RleHR1cmV8bnVsbH0gY2xlYXJDb2F0R2xvc3NNYXAgTW9ub2Nocm9tZSBjbGVhciBjb2F0IGdsb3NzaW5lc3MgbWFwIChkZWZhdWx0IGlzXG4gKiBudWxsKS4gSWYgc3BlY2lmaWVkLCB3aWxsIGJlIG11bHRpcGxpZWQgYnkgbm9ybWFsaXplZCAnY2xlYXJDb2F0R2xvc3NpbmVzcycgdmFsdWUgYW5kL29yIHZlcnRleFxuICogY29sb3JzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdEdsb3NzTWFwVXYgQ2xlYXIgY29hdCBnbG9zcyBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gY2xlYXJDb2F0R2xvc3NNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgY2xlYXIgY29hdCBnbG9zcyBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGNsZWFyQ29hdEdsb3NzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGNsZWFyIGNvYXQgZ2xvc3MgbWFwLlxuICogRWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdEdsb3NzTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgY2xlYXJcbiAqIGNvYXQgZ2xvc3MgbWFwLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGNsZWFyQ29hdEdsb3NzTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBjbGVhciBjb2F0IGdsb3NzIG1hcCB0byB1c2UuXG4gKiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gY2xlYXJDb2F0R2xvc3NWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBjbGVhciBjb2F0IGdsb3NzaW5lc3MuXG4gKiBJZiBjbGVhckNvYXRHbG9zc01hcCBpcyBzZXQsIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBjbGVhckNvYXRHbG9zc1ZlcnRleENvbG9yQ2hhbm5lbCBWZXJ0ZXggY29sb3IgY2hhbm5lbCB0byB1c2UgZm9yIGNsZWFyIGNvYXRcbiAqIGdsb3NzaW5lc3MuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtUZXh0dXJlfG51bGx9IGNsZWFyQ29hdE5vcm1hbE1hcCBUaGUgY2xlYXIgY29hdCBub3JtYWwgbWFwIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdFxuICogaXMgbnVsbCkuIFRoZSB0ZXh0dXJlIG11c3QgY29udGFpbnMgbm9ybWFsaXplZCwgdGFuZ2VudCBzcGFjZSBub3JtYWxzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGNsZWFyQ29hdE5vcm1hbE1hcFV2IENsZWFyIGNvYXQgbm9ybWFsIG1hcCBVViBjaGFubmVsLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXROb3JtYWxNYXBUaWxpbmcgQ29udHJvbHMgdGhlIDJEIHRpbGluZyBvZiB0aGUgbWFpbiBjbGVhciBjb2F0IG5vcm1hbFxuICogbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBjbGVhckNvYXROb3JtYWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiBjbGVhciBjb2F0IG5vcm1hbFxuICogbWFwLiBFYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0Tm9ybWFsTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgbWFpblxuICogY2xlYXIgY29hdCBtYXAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gY2xlYXJDb2F0QnVtcGluZXNzIFRoZSBidW1waW5lc3Mgb2YgdGhlIGNsZWFyIGNvYXQgbGF5ZXIuIFRoaXMgdmFsdWUgc2NhbGVzXG4gKiB0aGUgYXNzaWduZWQgbWFpbiBjbGVhciBjb2F0IG5vcm1hbCBtYXAuIEl0IHNob3VsZCBiZSBub3JtYWxseSBiZXR3ZWVuIDAgKG5vIGJ1bXAgbWFwcGluZykgYW5kIDFcbiAqIChmdWxsIGJ1bXAgbWFwcGluZyksIGJ1dCBjYW4gYmUgc2V0IHRvIGUuZy4gMiB0byBnaXZlIGV2ZW4gbW9yZSBwcm9ub3VuY2VkIGJ1bXAgZWZmZWN0LlxuICogQHByb3BlcnR5IHtib29sZWFufSB1c2VNZXRhbG5lc3MgVXNlIG1ldGFsbmVzcyBwcm9wZXJ0aWVzIGluc3RlYWQgb2Ygc3BlY3VsYXIuIFdoZW4gZW5hYmxlZCxcbiAqIGRpZmZ1c2UgY29sb3JzIGFsc28gYWZmZWN0IHNwZWN1bGFyIGluc3RlYWQgb2YgdGhlIGRlZGljYXRlZCBzcGVjdWxhciBtYXAuIFRoaXMgY2FuIGJlIHVzZWQgYXNcbiAqIGFsdGVybmF0aXZlIHRvIHNwZWN1bGFyIGNvbG9yIHRvIHNhdmUgc3BhY2UuIFdpdGggbWV0YWxlc3MgPT0gMCwgdGhlIHBpeGVsIGlzIGFzc3VtZWQgdG8gYmVcbiAqIGRpZWxlY3RyaWMsIGFuZCBkaWZmdXNlIGNvbG9yIGlzIHVzZWQgYXMgbm9ybWFsLiBXaXRoIG1ldGFsZXNzID09IDEsIHRoZSBwaXhlbCBpcyBmdWxseVxuICogbWV0YWxsaWMsIGFuZCBkaWZmdXNlIGNvbG9yIGlzIHVzZWQgYXMgc3BlY3VsYXIgY29sb3IgaW5zdGVhZC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvciBXaGVuIG1ldGFsbmVzcyBpcyBlbmFibGVkLCB1c2UgdGhlIHNwZWN1bGFyIG1hcCB0byBhcHBseSBjb2xvciB0aW50IHRvIHNwZWN1bGFyIHJlZmxlY3Rpb25zXG4gKiBhdCBkaXJlY3QgYW5nbGVzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG1ldGFsbmVzcyBEZWZpbmVzIGhvdyBtdWNoIHRoZSBzdXJmYWNlIGlzIG1ldGFsbGljLiBGcm9tIDAgKGRpZWxlY3RyaWMpIHRvIDFcbiAqIChtZXRhbCkuXG4gKiBAcHJvcGVydHkge1RleHR1cmV8bnVsbH0gbWV0YWxuZXNzTWFwIE1vbm9jaHJvbWUgbWV0YWxuZXNzIG1hcCAoZGVmYXVsdCBpcyBudWxsKS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtZXRhbG5lc3NNYXBVdiBNZXRhbG5lc3MgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG1ldGFsbmVzc01hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBtZXRhbG5lc3MgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBtZXRhbG5lc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWV0YWxuZXNzIG1hcC4gRWFjaCBjb21wb25lbnRcbiAqIGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBtZXRhbG5lc3NNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtZXRhbG5lc3NcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtZXRhbG5lc3NNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIG1ldGFsbmVzcyBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG1ldGFsbmVzc1ZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIG1ldGFsbmVzcy4gSWYgbWV0YWxuZXNzTWFwXG4gKiBpcyBzZXQsIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBtZXRhbG5lc3NWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWwgdG8gdXNlIGZvciBtZXRhbG5lc3MuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaGluaW5lc3MgRGVmaW5lcyBnbG9zc2luZXNzIG9mIHRoZSBtYXRlcmlhbCBmcm9tIDAgKHJvdWdoKSB0byAxMDAgKHNoaW55XG4gKiBtaXJyb3IpLiBBIGhpZ2hlciBzaGluaW5lc3MgdmFsdWUgcmVzdWx0cyBpbiBhIG1vcmUgZm9jdXNlZCBzcGVjdWxhciBoaWdobGlnaHQuIEdsb3NzaW5lc3MgbWFwL1xuICogdmVydGV4IGNvbG9ycyBhcmUgYWx3YXlzIG11bHRpcGxpZWQgYnkgdGhpcyB2YWx1ZSAobm9ybWFsaXplZCB0byAwIC0gMSByYW5nZSksIG9yIGl0IGlzIHVzZWRcbiAqIGRpcmVjdGx5IGFzIGNvbnN0YW50IG91dHB1dC5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZXxudWxsfSBnbG9zc01hcCBHbG9zc2luZXNzIG1hcCAoZGVmYXVsdCBpcyBudWxsKS4gSWYgc3BlY2lmaWVkLCB3aWxsIGJlXG4gKiBtdWx0aXBsaWVkIGJ5IG5vcm1hbGl6ZWQgJ3NoaW5pbmVzcycgdmFsdWUgYW5kL29yIHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZ2xvc3NNYXBVdiBHbG9zcyBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBnbG9zc01hcENoYW5uZWwgQ29sb3IgY2hhbm5lbCBvZiB0aGUgZ2xvc3MgbWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCJcbiAqIG9yIFwiYVwiLlxuICogQHByb3BlcnR5IHtWZWMyfSBnbG9zc01hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBnbG9zcyBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGdsb3NzTWFwT2Zmc2V0IENvbnRyb2xzIHRoZSAyRCBvZmZzZXQgb2YgdGhlIGdsb3NzIG1hcC4gRWFjaCBjb21wb25lbnQgaXNcbiAqIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBnbG9zc01hcFJvdGF0aW9uIENvbnRyb2xzIHRoZSAyRCByb3RhdGlvbiAoaW4gZGVncmVlcykgb2YgdGhlIGdsb3NzIG1hcC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gZ2xvc3NWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBnbG9zc2luZXNzLiBJZiBnbG9zc01hcCBpcyBzZXQsXG4gKiBpdCdsbCBiZSBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gZ2xvc3NWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWwgdG8gdXNlIGZvciBnbG9zc2luZXNzLiBDYW4gYmVcbiAqIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gcmVmcmFjdGlvbiBEZWZpbmVzIHRoZSB2aXNpYmlsaXR5IG9mIHJlZnJhY3Rpb24uIE1hdGVyaWFsIGNhbiByZWZyYWN0IHRoZVxuICogc2FtZSBjdWJlIG1hcCBhcyB1c2VkIGZvciByZWZsZWN0aW9ucy5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZXxudWxsfSByZWZyYWN0aW9uTWFwIFRoZSBtYXAgb2YgdGhlIHJlZnJhY3Rpb24gdmlzaWJpbGl0eS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uTWFwVXYgUmVmcmFjdGlvbiBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gcmVmcmFjdGlvbk1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSByZWZyYWN0aW9uIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gcmVmcmFjdGlvbk1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSByZWZyYWN0aW9uIG1hcC4gRWFjaCBjb21wb25lbnQgaXNcbiAqIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZW1pc3NpdmVcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSByZWZyYWN0aW9uTWFwQ2hhbm5lbCBDb2xvciBjaGFubmVscyBvZiB0aGUgcmVmcmFjdGlvbiBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsXG4gKiBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZyYWN0aW9uSW5kZXggRGVmaW5lcyB0aGUgaW5kZXggb2YgcmVmcmFjdGlvbiwgaS5lLiBUaGUgYW1vdW50IG9mXG4gKiBkaXN0b3J0aW9uLiBUaGUgdmFsdWUgaXMgY2FsY3VsYXRlZCBhcyAob3V0ZXJJb3IgLyBzdXJmYWNlSW9yKSwgd2hlcmUgaW5wdXRzIGFyZSBtZWFzdXJlZFxuICogaW5kaWNlcyBvZiByZWZyYWN0aW9uLCB0aGUgb25lIGFyb3VuZCB0aGUgb2JqZWN0IGFuZCB0aGUgb25lIG9mIGl0cyBvd24gc3VyZmFjZS4gSW4gbW9zdFxuICogc2l0dWF0aW9ucyBvdXRlciBtZWRpdW0gaXMgYWlyLCBzbyBvdXRlcklvciB3aWxsIGJlIGFwcHJveGltYXRlbHkgMS4gVGhlbiB5b3Ugb25seSBuZWVkIHRvIGRvXG4gKiAoMS4wIC8gc3VyZmFjZUlvcikuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHVzZUR5bmFtaWNSZWZyYWN0aW9uIEVuYWJsZXMgaGlnaGVyIHF1YWxpdHkgcmVmcmFjdGlvbnMgdXNpbmcgdGhlIGdyYWIgcGFzc1xuICogaW5zdGVhZCBvZiBwcmUtY29tcHV0ZWQgY3ViZSBtYXBzIGZvciByZWZyYWN0aW9ucy5cbiAqIEBwcm9wZXJ0eSB7Q29sb3J9IGVtaXNzaXZlIFRoZSBlbWlzc2l2ZSBjb2xvciBvZiB0aGUgbWF0ZXJpYWwuIFRoaXMgY29sb3IgdmFsdWUgaXMgMy1jb21wb25lbnRcbiAqIChSR0IpLCB3aGVyZSBlYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGVtaXNzaXZlVGludCBNdWx0aXBseSBlbWlzc2l2ZSBtYXAgYW5kL29yIGVtaXNzaXZlIHZlcnRleCBjb2xvciBieSB0aGVcbiAqIGNvbnN0YW50IGVtaXNzaXZlIHZhbHVlLlxuICogQHByb3BlcnR5IHtUZXh0dXJlfG51bGx9IGVtaXNzaXZlTWFwIFRoZSBlbWlzc2l2ZSBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBDYW4gYmVcbiAqIEhEUi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWlzc2l2ZUludGVuc2l0eSBFbWlzc2l2ZSBjb2xvciBtdWx0aXBsaWVyLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGVtaXNzaXZlTWFwVXYgRW1pc3NpdmUgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGVtaXNzaXZlTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIGVtaXNzaXZlIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gZW1pc3NpdmVNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgZW1pc3NpdmUgbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGVtaXNzaXZlTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgZW1pc3NpdmVcbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBlbWlzc2l2ZU1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIGVtaXNzaXZlIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBlbWlzc2l2ZVZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIGVtaXNzaW9uLiBJZiBlbWlzc2l2ZU1hcCBvclxuICogZW1pc3NpdmVUaW50IGFyZSBzZXQsIHRoZXknbGwgYmUgbXVsdGlwbGllZCBieSB2ZXJ0ZXggY29sb3JzLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IGVtaXNzaXZlVmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVscyB0byB1c2UgZm9yIGVtaXNzaW9uLiBDYW4gYmVcbiAqIFwiclwiLCBcImdcIiwgXCJiXCIsIFwiYVwiLCBcInJnYlwiIG9yIGFueSBzd2l6emxlZCBjb21iaW5hdGlvbi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlU2hlZW4gVG9nZ2xlIHNoZWVuIHNwZWN1bGFyIGVmZmVjdCBvbi9vZmYuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBzaGVlbiBUaGUgc3BlY3VsYXIgY29sb3Igb2YgdGhlIHNoZWVuIChmYWJyaWMpIG1pY3JvZmliZXIgc3RydWN0dXJlLiBUaGlzIGNvbG9yIHZhbHVlIGlzIDMtY29tcG9uZW50XG4gKiAoUkdCKSwgd2hlcmUgZWFjaCBjb21wb25lbnQgaXMgYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtib29sZWFufSBzaGVlblRpbnQgTXVsdGlwbHkgc2hlZW4gbWFwIGFuZC9vciBzaGVlbiB2ZXJ0ZXggY29sb3IgYnkgdGhlIGNvbnN0YW50IHNoZWVuIHZhbHVlLlxuICogQHByb3BlcnR5IHtUZXh0dXJlfG51bGx9IHNoZWVuTWFwIFRoZSBzaGVlbiBtaWNyb3N0cnVjdHVyZSBjb2xvciBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuTWFwVXYgU2hlZW4gbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IHNoZWVuTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIHNoZWVuIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc2hlZW5NYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgc2hlZW4gbWFwLiBFYWNoIGNvbXBvbmVudCBpc1xuICogYmV0d2VlbiAwIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgc2hlZW5cbiAqIG1hcC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBzaGVlbk1hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIHNoZWVuIG1hcCB0byB1c2UuIENhbiBiZSBcInJcIixcbiAqIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoZWVuR2xvc3NpbmVzcyBUaGUgZ2xvc3NpbmVzcyBvZiB0aGUgc2hlZW4gKGZhYnJpYykgbWljcm9maWJlciBzdHJ1Y3R1cmUuIFRoaXMgY29sb3IgdmFsdWUgaXMgMy1jb21wb25lbnRcbiAqIChSR0IpLCB3aGVyZSBlYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHNoZWVuR2xvc3NpbmVzc1RpbnQgTXVsdGlwbHkgc2hlZW4gZ2xvc3NpbmVzcyBtYXAgYW5kL29yIHNoZWVuIGdsb3NzaW5lc3MgdmVydGV4IHZhbHVlIGJ5IHRoZSBzY2FsYXIgc2hlZW4gZ2xvc3NpbmVzcyB2YWx1ZS5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZXxudWxsfSBzaGVlbkdsb3NzaW5lc3NNYXAgVGhlIHNoZWVuIGdsb3NzaW5lc3MgbWljcm9zdHJ1Y3R1cmUgY29sb3IgbWFwIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdCBpcyBudWxsKS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzaGVlbkdsb3NzaW5lc3NNYXBVdiBTaGVlbiBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gc2hlZW5HbG9zc2luZXNzTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBzaGVlbkdsb3NzaW5lc3NNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgc2hlZW4gZ2xvc3NpbmVzcyBtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2hlZW5HbG9zc2luZXNzTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgc2hlZW4gZ2xvc3NpbmVzc1xuICogbWFwLlxuICogQHByb3BlcnR5IHtzdHJpbmd9IHNoZWVuR2xvc3NpbmVzc01hcENoYW5uZWwgQ29sb3IgY2hhbm5lbHMgb2YgdGhlIHNoZWVuIGdsb3NzaW5lc3MgbWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLFxuICogXCJnXCIsIFwiYlwiLCBcImFcIiwgXCJyZ2JcIiBvciBhbnkgc3dpenpsZWQgY29tYmluYXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gb3BhY2l0eSBUaGUgb3BhY2l0eSBvZiB0aGUgbWF0ZXJpYWwuIFRoaXMgdmFsdWUgY2FuIGJlIGJldHdlZW4gMCBhbmQgMSwgd2hlcmVcbiAqIDAgaXMgZnVsbHkgdHJhbnNwYXJlbnQgYW5kIDEgaXMgZnVsbHkgb3BhcXVlLiBJZiB5b3Ugd2FudCB0aGUgbWF0ZXJpYWwgdG8gYmUgc2VtaS10cmFuc3BhcmVudFxuICogeW91IGFsc28gbmVlZCB0byBzZXQgdGhlIHtAbGluayBNYXRlcmlhbCNibGVuZFR5cGV9IHRvIHtAbGluayBCTEVORF9OT1JNQUx9LFxuICoge0BsaW5rIEJMRU5EX0FERElUSVZFfSBvciBhbnkgb3RoZXIgbW9kZS4gQWxzbyBub3RlIHRoYXQgZm9yIG1vc3Qgc2VtaS10cmFuc3BhcmVudCBvYmplY3RzIHlvdVxuICogd2FudCB7QGxpbmsgTWF0ZXJpYWwjZGVwdGhXcml0ZX0gdG8gYmUgZmFsc2UsIG90aGVyd2lzZSB0aGV5IGNhbiBmdWxseSBvY2NsdWRlIG9iamVjdHMgYmVoaW5kXG4gKiB0aGVtLlxuICogQHByb3BlcnR5IHtUZXh0dXJlfG51bGx9IG9wYWNpdHlNYXAgVGhlIG9wYWNpdHkgbWFwIG9mIHRoZSBtYXRlcmlhbCAoZGVmYXVsdCBpcyBudWxsKS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBvcGFjaXR5TWFwVXYgT3BhY2l0eSBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBvcGFjaXR5TWFwQ2hhbm5lbCBDb2xvciBjaGFubmVsIG9mIHRoZSBvcGFjaXR5IG1hcCB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsXG4gKiBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gb3BhY2l0eU1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBvcGFjaXR5IG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gb3BhY2l0eU1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBvcGFjaXR5IG1hcC4gRWFjaCBjb21wb25lbnQgaXNcbiAqIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBvcGFjaXR5TWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgb3BhY2l0eSBtYXAuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG9wYWNpdHlWZXJ0ZXhDb2xvciBVc2UgbWVzaCB2ZXJ0ZXggY29sb3JzIGZvciBvcGFjaXR5LiBJZiBvcGFjaXR5TWFwIGlzIHNldCxcbiAqIGl0J2xsIGJlIG11bHRpcGxpZWQgYnkgdmVydGV4IGNvbG9ycy5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBvcGFjaXR5VmVydGV4Q29sb3JDaGFubmVsIFZlcnRleCBjb2xvciBjaGFubmVscyB0byB1c2UgZm9yIG9wYWNpdHkuIENhbiBiZVxuICogXCJyXCIsIFwiZ1wiLCBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gb3BhY2l0eUZhZGVzU3BlY3VsYXIgdXNlZCB0byBzcGVjaWZ5IHdoZXRoZXIgc3BlY3VsYXIgYW5kIHJlZmxlY3Rpb25zIGFyZVxuICogZmFkZWQgb3V0IHVzaW5nIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29wYWNpdHl9LiBEZWZhdWx0IGlzIHRydWUuIFdoZW4gc2V0IHRvIGZhbHNlIHVzZVxuICoge0BsaW5rIE1hdGVyaWFsI2FscGhhRmFkZX0gdG8gZmFkZSBvdXQgbWF0ZXJpYWxzLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFscGhhRmFkZSB1c2VkIHRvIGZhZGUgb3V0IG1hdGVyaWFscyB3aGVuXG4gKiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNvcGFjaXR5RmFkZXNTcGVjdWxhcn0gaXMgc2V0IHRvIGZhbHNlLlxuICogQHByb3BlcnR5IHtUZXh0dXJlfG51bGx9IG5vcm1hbE1hcCBUaGUgbWFpbiAocHJpbWFyeSkgbm9ybWFsIG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXNcbiAqIG51bGwpLiBUaGUgdGV4dHVyZSBtdXN0IGNvbnRhaW5zIG5vcm1hbGl6ZWQsIHRhbmdlbnQgc3BhY2Ugbm9ybWFscy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxNYXBVdiBNYWluIChwcmltYXJ5KSBub3JtYWwgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG5vcm1hbE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBtYWluIChwcmltYXJ5KSBub3JtYWwgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBub3JtYWxNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbWFpbiAocHJpbWFyeSkgbm9ybWFsIG1hcC4gRWFjaFxuICogY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBtYWluIChwcmltYXJ5KVxuICogbm9ybWFsIG1hcC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBidW1waW5lc3MgVGhlIGJ1bXBpbmVzcyBvZiB0aGUgbWF0ZXJpYWwuIFRoaXMgdmFsdWUgc2NhbGVzIHRoZSBhc3NpZ25lZCBtYWluXG4gKiAocHJpbWFyeSkgbm9ybWFsIG1hcC4gSXQgc2hvdWxkIGJlIG5vcm1hbGx5IGJldHdlZW4gMCAobm8gYnVtcCBtYXBwaW5nKSBhbmQgMSAoZnVsbCBidW1wXG4gKiBtYXBwaW5nKSwgYnV0IGNhbiBiZSBzZXQgdG8gZS5nLiAyIHRvIGdpdmUgZXZlbiBtb3JlIHByb25vdW5jZWQgYnVtcCBlZmZlY3QuXG4gKiBAcHJvcGVydHkge1RleHR1cmV8bnVsbH0gbm9ybWFsRGV0YWlsTWFwIFRoZSBkZXRhaWwgKHNlY29uZGFyeSkgbm9ybWFsIG1hcCBvZiB0aGUgbWF0ZXJpYWxcbiAqIChkZWZhdWx0IGlzIG51bGwpLiBXaWxsIG9ubHkgYmUgdXNlZCBpZiBtYWluIChwcmltYXJ5KSBub3JtYWwgbWFwIGlzIG5vbi1udWxsLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG5vcm1hbERldGFpbE1hcFV2IERldGFpbCAoc2Vjb25kYXJ5KSBub3JtYWwgbWFwIFVWIGNoYW5uZWwuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG5vcm1hbERldGFpbE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBkZXRhaWwgKHNlY29uZGFyeSkgbm9ybWFsXG4gKiBtYXAuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IG5vcm1hbERldGFpbE1hcE9mZnNldCBDb250cm9scyB0aGUgMkQgb2Zmc2V0IG9mIHRoZSBkZXRhaWwgKHNlY29uZGFyeSkgbm9ybWFsXG4gKiBtYXAuIEVhY2ggY29tcG9uZW50IGlzIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBub3JtYWxEZXRhaWxNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBkZXRhaWxcbiAqIChzZWNvbmRhcnkpIG5vcm1hbCBtYXAuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbm9ybWFsRGV0YWlsTWFwQnVtcGluZXNzIFRoZSBidW1waW5lc3Mgb2YgdGhlIG1hdGVyaWFsLiBUaGlzIHZhbHVlIHNjYWxlcyB0aGVcbiAqIGFzc2lnbmVkIGRldGFpbCAoc2Vjb25kYXJ5KSBub3JtYWwgbWFwLiBJdCBzaG91bGQgYmUgbm9ybWFsbHkgYmV0d2VlbiAwIChubyBidW1wIG1hcHBpbmcpIGFuZCAxXG4gKiAoZnVsbCBidW1wIG1hcHBpbmcpLCBidXQgY2FuIGJlIHNldCB0byBlLmcuIDIgdG8gZ2l2ZSBldmVuIG1vcmUgcHJvbm91bmNlZCBidW1wIGVmZmVjdC5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZXxudWxsfSBoZWlnaHRNYXAgVGhlIGhlaWdodCBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzIG51bGwpLiBVc2VkIGZvciBhXG4gKiB2aWV3LWRlcGVuZGVudCBwYXJhbGxheCBlZmZlY3QuIFRoZSB0ZXh0dXJlIG11c3QgcmVwcmVzZW50IHRoZSBoZWlnaHQgb2YgdGhlIHN1cmZhY2Ugd2hlcmVcbiAqIGRhcmtlciBwaXhlbHMgYXJlIGxvd2VyIGFuZCBsaWdodGVyIHBpeGVscyBhcmUgaGlnaGVyLiBJdCBpcyByZWNvbW1lbmRlZCB0byB1c2UgaXQgdG9nZXRoZXIgd2l0aFxuICogYSBub3JtYWwgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGhlaWdodE1hcFV2IEhlaWdodCBtYXAgVVYgY2hhbm5lbC5cbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBoZWlnaHRNYXBDaGFubmVsIENvbG9yIGNoYW5uZWwgb2YgdGhlIGhlaWdodCBtYXAgdG8gdXNlLiBDYW4gYmUgXCJyXCIsIFwiZ1wiLCBcImJcIlxuICogb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGhlaWdodE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBoZWlnaHQgbWFwLlxuICogQHByb3BlcnR5IHtWZWMyfSBoZWlnaHRNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgaGVpZ2h0IG1hcC4gRWFjaCBjb21wb25lbnQgaXNcbiAqIGJldHdlZW4gMCBhbmQgMS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBoZWlnaHRNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBoZWlnaHQgbWFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGhlaWdodE1hcEZhY3RvciBIZWlnaHQgbWFwIG11bHRpcGxpZXIuIEFmZmVjdHMgdGhlIHN0cmVuZ3RoIG9mIHRoZSBwYXJhbGxheFxuICogZWZmZWN0LlxuICogQHByb3BlcnR5IHtUZXh0dXJlfG51bGx9IGVudkF0bGFzIFRoZSBwcmVmaWx0ZXJlZCBlbnZpcm9ubWVudCBsaWdodGluZyBhdGxhcyAoZGVmYXVsdCBpcyBudWxsKS5cbiAqIFRoaXMgc2V0dGluZyBvdmVycmlkZXMgY3ViZU1hcCBhbmQgc3BoZXJlTWFwIGFuZCB3aWxsIHJlcGxhY2UgdGhlIHNjZW5lIGxpZ2h0aW5nIGVudmlyb25tZW50LlxuICogQHByb3BlcnR5IHtUZXh0dXJlfG51bGx9IGN1YmVNYXAgVGhlIGN1YmljIGVudmlyb25tZW50IG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuXG4gKiBUaGlzIHNldHRpbmcgb3ZlcnJpZGVzIHNwaGVyZU1hcCBhbmQgd2lsbCByZXBsYWNlIHRoZSBzY2VuZSBsaWdodGluZyBlbnZpcm9ubWVudC5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZXxudWxsfSBzcGhlcmVNYXAgVGhlIHNwaGVyaWNhbCBlbnZpcm9ubWVudCBtYXAgb2YgdGhlIG1hdGVyaWFsIChkZWZhdWx0IGlzXG4gKiBudWxsKS4gVGhpcyB3aWxsIHJlcGxhY2UgdGhlIHNjZW5lIGxpZ2h0aW5nIGVudmlyb25tZW50LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGN1YmVNYXBQcm9qZWN0aW9uIFRoZSB0eXBlIG9mIHByb2plY3Rpb24gYXBwbGllZCB0byB0aGUgY3ViZU1hcCBwcm9wZXJ0eTpcbiAqIC0ge0BsaW5rIENVQkVQUk9KX05PTkV9OiBUaGUgY3ViZSBtYXAgaXMgdHJlYXRlZCBhcyBpZiBpdCBpcyBpbmZpbml0ZWx5IGZhciBhd2F5LlxuICogLSB7QGxpbmsgQ1VCRVBST0pfQk9YfTogQm94LXByb2plY3Rpb24gYmFzZWQgb24gYSB3b3JsZCBzcGFjZSBheGlzLWFsaWduZWQgYm91bmRpbmcgYm94LlxuICogRGVmYXVsdHMgdG8ge0BsaW5rIENVQkVQUk9KX05PTkV9LlxuICogQHByb3BlcnR5IHtCb3VuZGluZ0JveH0gY3ViZU1hcFByb2plY3Rpb25Cb3ggVGhlIHdvcmxkIHNwYWNlIGF4aXMtYWxpZ25lZCBib3VuZGluZyBib3ggZGVmaW5pbmdcbiAqIHRoZSBib3gtcHJvamVjdGlvbiB1c2VkIGZvciB0aGUgY3ViZU1hcCBwcm9wZXJ0eS4gT25seSB1c2VkIHdoZW4gY3ViZU1hcFByb2plY3Rpb24gaXMgc2V0IHRvXG4gKiB7QGxpbmsgQ1VCRVBST0pfQk9YfS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByZWZsZWN0aXZpdHkgRW52aXJvbm1lbnQgbWFwIGludGVuc2l0eS5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZXxudWxsfSBsaWdodE1hcCBBIGN1c3RvbSBsaWdodG1hcCBvZiB0aGUgbWF0ZXJpYWwgKGRlZmF1bHQgaXMgbnVsbCkuIExpZ2h0bWFwc1xuICogYXJlIHRleHR1cmVzIHRoYXQgY29udGFpbiBwcmUtcmVuZGVyZWQgbGlnaHRpbmcuIENhbiBiZSBIRFIuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbGlnaHRNYXBVdiBMaWdodG1hcCBVViBjaGFubmVsXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbGlnaHRNYXBDaGFubmVsIENvbG9yIGNoYW5uZWxzIG9mIHRoZSBsaWdodG1hcCB0byB1c2UuIENhbiBiZSBcInJcIiwgXCJnXCIsIFwiYlwiLFxuICogXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtWZWMyfSBsaWdodE1hcFRpbGluZyBDb250cm9scyB0aGUgMkQgdGlsaW5nIG9mIHRoZSBsaWdodG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gbGlnaHRNYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgbGlnaHRtYXAuIEVhY2ggY29tcG9uZW50IGlzXG4gKiBiZXR3ZWVuIDAgYW5kIDEuXG4gKiBAcHJvcGVydHkge251bWJlcn0gbGlnaHRNYXBSb3RhdGlvbiBDb250cm9scyB0aGUgMkQgcm90YXRpb24gKGluIGRlZ3JlZXMpIG9mIHRoZSBsaWdodG1hcC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbGlnaHRWZXJ0ZXhDb2xvciBVc2UgYmFrZWQgdmVydGV4IGxpZ2h0aW5nLiBJZiBsaWdodE1hcCBpcyBzZXQsIGl0J2xsIGJlXG4gKiBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gbGlnaHRWZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3IgYmFrZWQgbGlnaHRpbmcuIENhblxuICogYmUgXCJyXCIsIFwiZ1wiLCBcImJcIiwgXCJhXCIsIFwicmdiXCIgb3IgYW55IHN3aXp6bGVkIGNvbWJpbmF0aW9uLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhbWJpZW50VGludCBFbmFibGVzIHNjZW5lIGFtYmllbnQgbXVsdGlwbGljYXRpb24gYnkgbWF0ZXJpYWwgYW1iaWVudCBjb2xvci5cbiAqIEBwcm9wZXJ0eSB7VGV4dHVyZXxudWxsfSBhb01hcCBCYWtlZCBhbWJpZW50IG9jY2x1c2lvbiAoQU8pIG1hcCAoZGVmYXVsdCBpcyBudWxsKS4gTW9kdWxhdGVzXG4gKiBhbWJpZW50IGNvbG9yLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFvTWFwVXYgQU8gbWFwIFVWIGNoYW5uZWxcbiAqIEBwcm9wZXJ0eSB7c3RyaW5nfSBhb01hcENoYW5uZWwgQ29sb3IgY2hhbm5lbCBvZiB0aGUgQU8gbWFwIHRvIHVzZS4gQ2FuIGJlIFwiclwiLCBcImdcIiwgXCJiXCIgb3IgXCJhXCIuXG4gKiBAcHJvcGVydHkge1ZlYzJ9IGFvTWFwVGlsaW5nIENvbnRyb2xzIHRoZSAyRCB0aWxpbmcgb2YgdGhlIEFPIG1hcC5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gYW9NYXBPZmZzZXQgQ29udHJvbHMgdGhlIDJEIG9mZnNldCBvZiB0aGUgQU8gbWFwLiBFYWNoIGNvbXBvbmVudCBpcyBiZXR3ZWVuIDBcbiAqIGFuZCAxLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFvTWFwUm90YXRpb24gQ29udHJvbHMgdGhlIDJEIHJvdGF0aW9uIChpbiBkZWdyZWVzKSBvZiB0aGUgQU8gbWFwLlxuICogQHByb3BlcnR5IHtib29sZWFufSBhb1ZlcnRleENvbG9yIFVzZSBtZXNoIHZlcnRleCBjb2xvcnMgZm9yIEFPLiBJZiBhb01hcCBpcyBzZXQsIGl0J2xsIGJlXG4gKiBtdWx0aXBsaWVkIGJ5IHZlcnRleCBjb2xvcnMuXG4gKiBAcHJvcGVydHkge3N0cmluZ30gYW9WZXJ0ZXhDb2xvckNoYW5uZWwgVmVydGV4IGNvbG9yIGNoYW5uZWxzIHRvIHVzZSBmb3IgQU8uIENhbiBiZSBcInJcIiwgXCJnXCIsXG4gKiBcImJcIiBvciBcImFcIi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBvY2NsdWRlU3BlY3VsYXIgVXNlcyBhbWJpZW50IG9jY2x1c2lvbiB0byBkYXJrZW4gc3BlY3VsYXIvcmVmbGVjdGlvbi4gSXQncyBhXG4gKiBoYWNrLCBiZWNhdXNlIHJlYWwgc3BlY3VsYXIgb2NjbHVzaW9uIGlzIHZpZXctZGVwZW5kZW50LiBIb3dldmVyLCBpdCBjYW4gYmUgYmV0dGVyIHRoYW4gbm90aGluZy5cbiAqXG4gKiAtIHtAbGluayBTUEVDT0NDX05PTkV9OiBObyBzcGVjdWxhciBvY2NsdXNpb25cbiAqIC0ge0BsaW5rIFNQRUNPQ0NfQU99OiBVc2UgQU8gZGlyZWN0bHkgdG8gb2NjbHVkZSBzcGVjdWxhci5cbiAqIC0ge0BsaW5rIFNQRUNPQ0NfR0xPU1NERVBFTkRFTlR9OiBNb2RpZnkgQU8gYmFzZWQgb24gbWF0ZXJpYWwgZ2xvc3NpbmVzcy92aWV3IGFuZ2xlIHRvIG9jY2x1ZGVcbiAqIHNwZWN1bGFyLlxuICpcbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBvY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkgQ29udHJvbHMgdmlzaWJpbGl0eSBvZiBzcGVjdWxhciBvY2NsdXNpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IG9jY2x1ZGVEaXJlY3QgVGVsbHMgaWYgQU8gc2hvdWxkIGRhcmtlbiBkaXJlY3Rpb25hbCBsaWdodGluZy4gRGVmYXVsdHMgdG9cbiAqIGZhbHNlLlxuICogQHByb3BlcnR5IHtib29sZWFufSBjb25zZXJ2ZUVuZXJneSBEZWZpbmVzIGhvdyBkaWZmdXNlIGFuZCBzcGVjdWxhciBjb21wb25lbnRzIGFyZSBjb21iaW5lZCB3aGVuXG4gKiBGcmVzbmVsIGlzIG9uLiBJdCBpcyByZWNvbW1lbmRlZCB0aGF0IHlvdSBsZWF2ZSB0aGlzIG9wdGlvbiBlbmFibGVkLCBhbHRob3VnaCB5b3UgbWF5IHdhbnQgdG9cbiAqIGRpc2FibGUgaXQgaW4gY2FzZSB3aGVuIGFsbCByZWZsZWN0aW9uIGNvbWVzIG9ubHkgZnJvbSBhIGZldyBsaWdodCBzb3VyY2VzLCBhbmQgeW91IGRvbid0IHVzZSBhblxuICogZW52aXJvbm1lbnQgbWFwLCB0aGVyZWZvcmUgaGF2aW5nIG1vc3RseSBibGFjayByZWZsZWN0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNoYWRpbmdNb2RlbCBEZWZpbmVzIHRoZSBzaGFkaW5nIG1vZGVsLlxuICogLSB7QGxpbmsgU1BFQ1VMQVJfUEhPTkd9OiBQaG9uZyB3aXRob3V0IGVuZXJneSBjb25zZXJ2YXRpb24uIFlvdSBzaG91bGQgb25seSB1c2UgaXQgYXMgYVxuICogYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgd2l0aCBvbGRlciBwcm9qZWN0cy5cbiAqIC0ge0BsaW5rIFNQRUNVTEFSX0JMSU5OfTogRW5lcmd5LWNvbnNlcnZpbmcgQmxpbm4tUGhvbmcuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZnJlc25lbE1vZGVsIERlZmluZXMgdGhlIGZvcm11bGEgdXNlZCBmb3IgRnJlc25lbCBlZmZlY3QuXG4gKiBBcyBhIHNpZGUtZWZmZWN0LCBlbmFibGluZyBhbnkgRnJlc25lbCBtb2RlbCBjaGFuZ2VzIHRoZSB3YXkgZGlmZnVzZSBhbmQgcmVmbGVjdGlvbiBjb21wb25lbnRzXG4gKiBhcmUgY29tYmluZWQuIFdoZW4gRnJlc25lbCBpcyBvZmYsIGxlZ2FjeSBub24gZW5lcmd5LWNvbnNlcnZpbmcgY29tYmluaW5nIGlzIHVzZWQuIFdoZW4gaXQgaXNcbiAqIG9uLCBjb21iaW5pbmcgYmVoYXZpb3IgaXMgZGVmaW5lZCBieSBjb25zZXJ2ZUVuZXJneSBwYXJhbWV0ZXIuXG4gKlxuICogLSB7QGxpbmsgRlJFU05FTF9OT05FfTogTm8gRnJlc25lbC5cbiAqIC0ge0BsaW5rIEZSRVNORUxfU0NITElDS306IFNjaGxpY2sncyBhcHByb3hpbWF0aW9uIG9mIEZyZXNuZWwgKHJlY29tbWVuZGVkKS4gUGFyYW1ldGVyaXplZCBieVxuICogc3BlY3VsYXIgY29sb3IuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSB1c2VGb2cgQXBwbHkgZm9nZ2luZyAoYXMgY29uZmlndXJlZCBpbiBzY2VuZSBzZXR0aW5ncylcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTGlnaHRpbmcgQXBwbHkgbGlnaHRpbmdcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlU2t5Ym94IEFwcGx5IHNjZW5lIHNreWJveCBhcyBwcmVmaWx0ZXJlZCBlbnZpcm9ubWVudCBtYXBcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlR2FtbWFUb25lbWFwIEFwcGx5IGdhbW1hIGNvcnJlY3Rpb24gYW5kIHRvbmVtYXBwaW5nIChhcyBjb25maWd1cmVkIGluXG4gKiBzY2VuZSBzZXR0aW5ncykuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IHBpeGVsU25hcCBBbGlnbiB2ZXJ0aWNlcyB0byBwaXhlbCBjb29yZGluYXRlcyB3aGVuIHJlbmRlcmluZy4gVXNlZnVsIGZvclxuICogcGl4ZWwgcGVyZmVjdCAyRCBncmFwaGljcy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdHdvU2lkZWRMaWdodGluZyBDYWxjdWxhdGUgcHJvcGVyIG5vcm1hbHMgKGFuZCB0aGVyZWZvcmUgbGlnaHRpbmcpIG9uXG4gKiBiYWNrZmFjZXMuXG4gKiBAcHJvcGVydHkge1VwZGF0ZVNoYWRlckNhbGxiYWNrfSBvblVwZGF0ZVNoYWRlciBBIGN1c3RvbSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIGFmdGVyIGFsbFxuICogc2hhZGVyIGdlbmVyYXRvciBwcm9wZXJ0aWVzIGFyZSBjb2xsZWN0ZWQgYW5kIGJlZm9yZSBzaGFkZXIgY29kZSBpcyBnZW5lcmF0ZWQuIFRoaXMgZnVuY3Rpb25cbiAqIHdpbGwgcmVjZWl2ZSBhbiBvYmplY3Qgd2l0aCBzaGFkZXIgZ2VuZXJhdG9yIHNldHRpbmdzIChiYXNlZCBvbiBjdXJyZW50IG1hdGVyaWFsIGFuZCBzY2VuZVxuICogcHJvcGVydGllcyksIHRoYXQgeW91IGNhbiBjaGFuZ2UgYW5kIHRoZW4gcmV0dXJuLiBSZXR1cm5lZCB2YWx1ZSB3aWxsIGJlIHVzZWQgaW5zdGVhZC4gVGhpcyBpc1xuICogbW9zdGx5IHVzZWZ1bCB3aGVuIHJlbmRlcmluZyB0aGUgc2FtZSBzZXQgb2Ygb2JqZWN0cywgYnV0IHdpdGggZGlmZmVyZW50IHNoYWRlciB2YXJpYXRpb25zIGJhc2VkXG4gKiBvbiB0aGUgc2FtZSBtYXRlcmlhbC4gRm9yIGV4YW1wbGUsIHlvdSBtYXkgd2lzaCB0byByZW5kZXIgYSBkZXB0aCBvciBub3JtYWwgcGFzcyB1c2luZyB0ZXh0dXJlc1xuICogYXNzaWduZWQgdG8gdGhlIG1hdGVyaWFsLCBhIHJlZmxlY3Rpb24gcGFzcyB3aXRoIHNpbXBsZXIgc2hhZGVycyBhbmQgc28gb24uIFByb3BlcnRpZXMgb2YgdGhlXG4gKiBvYmplY3QgcGFzc2VkIGludG8gdGhpcyBmdW5jdGlvbiBhcmU6XG4gKlxuICogLSBwYXNzOiB2YWx1ZSBvZiB7QGxpbmsgTGF5ZXIjc2hhZGVyUGFzc30gb2YgdGhlIExheWVyIGJlaW5nIHJlbmRlcmVkLlxuICogLSBjaHVua3M6IE9iamVjdCBjb250YWluaW5nIGN1c3RvbSBzaGFkZXIgY2h1bmtzIHRoYXQgd2lsbCByZXBsYWNlIGRlZmF1bHQgb25lcy5cbiAqIC0gY3VzdG9tRnJhZ21lbnRTaGFkZXI6IENvbXBsZXRlbHkgcmVwbGFjZSBmcmFnbWVudCBzaGFkZXIgd2l0aCB0aGlzIGNvZGUuXG4gKiAtIGZvcmNlVXYxOiBpZiBVVjEgKHNlY29uZCBzZXQgb2YgdGV4dHVyZSBjb29yZGluYXRlcykgaXMgcmVxdWlyZWQgaW4gdGhlIHNoYWRlci4gV2lsbCBiZVxuICogZGVjbGFyZWQgYXMgXCJ2VXYxXCIgYW5kIHBhc3NlZCB0byB0aGUgZnJhZ21lbnQgc2hhZGVyLlxuICogLSBmb2c6IHRoZSB0eXBlIG9mIGZvZyBiZWluZyBhcHBsaWVkIGluIHRoZSBzaGFkZXIuIFNlZSB7QGxpbmsgU2NlbmUjZm9nfSBmb3IgdGhlIGxpc3Qgb2ZcbiAqIHBvc3NpYmxlIHZhbHVlcy5cbiAqIC0gZ2FtbWE6IHRoZSB0eXBlIG9mIGdhbW1hIGNvcnJlY3Rpb24gYmVpbmcgYXBwbGllZCBpbiB0aGUgc2hhZGVyLiBTZWVcbiAqIHtAbGluayBTY2VuZSNnYW1tYUNvcnJlY3Rpb259IGZvciB0aGUgbGlzdCBvZiBwb3NzaWJsZSB2YWx1ZXMuXG4gKiAtIHRvbmVNYXA6IHRoZSB0eXBlIG9mIHRvbmUgbWFwcGluZyBiZWluZyBhcHBsaWVkIGluIHRoZSBzaGFkZXIuIFNlZSB7QGxpbmsgU2NlbmUjdG9uZU1hcHBpbmd9XG4gKiBmb3IgdGhlIGxpc3Qgb2YgcG9zc2libGUgdmFsdWVzLlxuICogLSBhbWJpZW50VGludDogdGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2FtYmllbnRUaW50fS5cbiAqIC0gY29uc2VydmVFbmVyZ3k6IHRoZSB2YWx1ZSBvZiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNjb25zZXJ2ZUVuZXJneX0uXG4gKiAtIG9jY2x1ZGVTcGVjdWxhcjogdGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29jY2x1ZGVTcGVjdWxhcn0uXG4gKiAtIG9jY2x1ZGVEaXJlY3Q6IHRoZSB2YWx1ZSBvZiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNvY2NsdWRlRGlyZWN0fS5cbiAqIC0gc2hhZGluZ01vZGVsOiB0aGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjc2hhZGluZ01vZGVsfS5cbiAqIC0gZnJlc25lbE1vZGVsOiB0aGUgdmFsdWUgb2Yge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjZnJlc25lbE1vZGVsfS5cbiAqIC0gY3ViZU1hcFByb2plY3Rpb246IHRoZSB2YWx1ZSBvZiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNjdWJlTWFwUHJvamVjdGlvbn0uXG4gKiAtIHVzZU1ldGFsbmVzczogdGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI3VzZU1ldGFsbmVzc30uXG4gKiAtIGJsZW5kVHlwZTogdGhlIHZhbHVlIG9mIHtAbGluayBNYXRlcmlhbCNibGVuZFR5cGV9LlxuICogLSB0d29TaWRlZExpZ2h0aW5nOiB0aGUgdmFsdWUgb2Yge0BsaW5rIE1hdGVyaWFsI3R3b1NpZGVkTGlnaHRpbmd9LlxuICogLSBkaWZmdXNlVGludDogZGVmaW5lcyBpZiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNkaWZmdXNlfSBjb25zdGFudCBzaG91bGQgYWZmZWN0IGRpZmZ1c2UgY29sb3IuXG4gKiAtIHNwZWN1bGFyVGludDogZGVmaW5lcyBpZiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNzcGVjdWxhcn0gY29uc3RhbnQgc2hvdWxkIGFmZmVjdCBzcGVjdWxhclxuICogY29sb3IuXG4gKiAtIG1ldGFsbmVzc1RpbnQ6IGRlZmluZXMgaWYge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjbWV0YWxuZXNzfSBjb25zdGFudCBzaG91bGQgYWZmZWN0IG1ldGFsbmVzc1xuICogdmFsdWUuXG4gKiAtIGdsb3NzVGludDogZGVmaW5lcyBpZiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNzaGluaW5lc3N9IGNvbnN0YW50IHNob3VsZCBhZmZlY3QgZ2xvc3NpbmVzc1xuICogdmFsdWUuXG4gKiAtIGVtaXNzaXZlVGludDogZGVmaW5lcyBpZiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNlbWlzc2l2ZX0gY29uc3RhbnQgc2hvdWxkIGFmZmVjdCBlbWlzc2lvblxuICogdmFsdWUuXG4gKiAtIG9wYWNpdHlUaW50OiBkZWZpbmVzIGlmIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI29wYWNpdHl9IGNvbnN0YW50IHNob3VsZCBhZmZlY3Qgb3BhY2l0eSB2YWx1ZS5cbiAqIC0gb2NjbHVkZVNwZWN1bGFyRmxvYXQ6IGRlZmluZXMgaWYge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5fSBjb25zdGFudFxuICogc2hvdWxkIGFmZmVjdCBzcGVjdWxhciBvY2NsdXNpb24uXG4gKiAtIGFscGhhVGVzdDogZW5hYmxlIGFscGhhIHRlc3RpbmcuIFNlZSB7QGxpbmsgTWF0ZXJpYWwjYWxwaGFUZXN0fS5cbiAqIC0gYWxwaGFUb0NvdmVyYWdlOiBlbmFibGUgYWxwaGEgdG8gY292ZXJhZ2UuIFNlZSB7QGxpbmsgTWF0ZXJpYWwjYWxwaGFUb0NvdmVyYWdlfS5cbiAqIC0gb3BhY2l0eUZhZGVzU3BlY3VsYXI6IGVuYWJsZSBzcGVjdWxhciBmYWRlLiBTZWUge0BsaW5rIE1hdGVyaWFsI29wYWNpdHlGYWRlc1NwZWN1bGFyfS5cbiAqIC0gYWxwaGFGYWRlOiBmYWRlIHZhbHVlLiBTZWUge0BsaW5rIE1hdGVyaWFsI2FscGhhRmFkZX0uXG4gKiAtIHNwaGVyZU1hcDogaWYge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjc3BoZXJlTWFwfSBpcyB1c2VkLlxuICogLSBjdWJlTWFwOiBpZiB7QGxpbmsgU3RhbmRhcmRNYXRlcmlhbCNjdWJlTWFwfSBpcyB1c2VkLlxuICogLSBhbWJpZW50U0g6IGlmIGFtYmllbnQgc3BoZXJpY2FsIGhhcm1vbmljcyBhcmUgdXNlZC4gQW1iaWVudCBTSCByZXBsYWNlIHByZWZpbHRlcmVkIGN1YmVtYXBcbiAqIGFtYmllbnQgb24gY2VydGFpbiBwbGF0Zm9ybSAobW9zdGx5IEFuZHJvaWQpIGZvciBwZXJmb3JtYW5jZSByZWFzb25zLlxuICogLSB1c2VTcGVjdWxhcjogaWYgYW55IHNwZWN1bGFyIG9yIHJlZmxlY3Rpb25zIGFyZSBuZWVkZWQgYXQgYWxsLlxuICogLSBmaXhTZWFtczogaWYgY3ViZW1hcHMgcmVxdWlyZSBzZWFtIGZpeGluZyAoc2VlIHtAbGluayBUZXh0dXJlI29wdGlvbnMuZml4Q3ViZW1hcFNlYW1zfSkuXG4gKiAtIGVtaXNzaXZlRW5jb2Rpbmc6IGhvdyBlbWlzc2l2ZU1hcCBpcyBlbmNvZGVkLiBUaGlzIHZhbHVlIGlzIGJhc2VkIG9uIFRleHR1cmUjZW5jb2RpbmcuXG4gKiAtIGxpZ2h0TWFwRW5jb2Rpbmc6IGhvdyBsaWdodE1hcCBpcyBlbmNvZGVkLiBUaGlzIHZhbHVlIGlzIGJhc2VkIG9uIG9uIFRleHR1cmUjZW5jb2RpbmcuXG4gKiAtIHBhY2tlZE5vcm1hbDogaWYgbm9ybWFsIG1hcCBjb250YWlucyBYIGluIFJHQiwgWSBpbiBBbHBoYSwgYW5kIFogbXVzdCBiZSByZWNvbnN0cnVjdGVkLlxuICogLSBmb3JjZUZyYWdtZW50UHJlY2lzaW9uOiBPdmVycmlkZSBmcmFnbWVudCBzaGFkZXIgbnVtZXJpYyBwcmVjaXNpb24uIENhbiBiZSBcImxvd3BcIiwgXCJtZWRpdW1wXCIsXG4gKiBcImhpZ2hwXCIgb3IgbnVsbCB0byB1c2UgZGVmYXVsdC5cbiAqIC0gZmFzdFRibjogVXNlIHNsaWdodGx5IGNoZWFwZXIgbm9ybWFsIG1hcHBpbmcgY29kZSAoc2tpcCB0YW5nZW50IHNwYWNlIG5vcm1hbGl6YXRpb24pLiBDYW4gbG9va1xuICogYnVnZ3kgc29tZXRpbWVzLlxuICogLSByZWZyYWN0aW9uOiBpZiByZWZyYWN0aW9uIGlzIHVzZWQuXG4gKiAtIHNreWJveEludGVuc2l0eTogaWYgcmVmbGVjdGVkIHNreWJveCBpbnRlbnNpdHkgc2hvdWxkIGJlIG1vZHVsYXRlZC5cbiAqIC0gdXNlQ3ViZU1hcFJvdGF0aW9uOiBpZiBjdWJlIG1hcCByb3RhdGlvbiBpcyBlbmFibGVkLlxuICogLSB1c2VJbnN0YW5jaW5nOiBpZiBoYXJkd2FyZSBpbnN0YW5jaW5nIGNvbXBhdGlibGUgc2hhZGVyIHNob3VsZCBiZSBnZW5lcmF0ZWQuIFRyYW5zZm9ybSBpcyByZWFkXG4gKiBmcm9tIHBlci1pbnN0YW5jZSB7QGxpbmsgVmVydGV4QnVmZmVyfSBpbnN0ZWFkIG9mIHNoYWRlcidzIHVuaWZvcm1zLlxuICogLSB1c2VNb3JwaFBvc2l0aW9uOiBpZiBtb3JwaGluZyBjb2RlIHNob3VsZCBiZSBnZW5lcmF0ZWQgdG8gbW9ycGggcG9zaXRpb25zLlxuICogLSB1c2VNb3JwaE5vcm1hbDogaWYgbW9ycGhpbmcgY29kZSBzaG91bGQgYmUgZ2VuZXJhdGVkIHRvIG1vcnBoIG5vcm1hbHMuXG4gKiAtIHJlZmxlY3Rpb25Tb3VyY2U6IG9uZSBvZiBcImVudkF0bGFzSFFcIiwgXCJlbnZBdGxhc1wiLCBcImN1YmVNYXBcIiwgXCJzcGhlcmVNYXBcIlxuICogLSByZWZsZWN0aW9uRW5jb2Rpbmc6IG9uZSBvZiBudWxsLCBcInJnYm1cIiwgXCJyZ2JlXCIsIFwibGluZWFyXCIsIFwic3JnYlwiXG4gKiAtIGFtYmllbnRTb3VyY2U6IG9uZSBvZiBcImFtYmllbnRTSFwiLCBcImVudkF0bGFzXCIsIFwiY29uc3RhbnRcIlxuICogLSBhbWJpZW50RW5jb2Rpbmc6IG9uZSBvZiBudWxsLCBcInJnYm1cIiwgXCJyZ2JlXCIsIFwibGluZWFyXCIsIFwic3JnYlwiXG4gKiBAYXVnbWVudHMgTWF0ZXJpYWxcbiAqL1xuY2xhc3MgU3RhbmRhcmRNYXRlcmlhbCBleHRlbmRzIE1hdGVyaWFsIHtcbiAgICBzdGF0aWMgVEVYVFVSRV9QQVJBTUVURVJTID0gc3RhbmRhcmRNYXRlcmlhbFRleHR1cmVQYXJhbWV0ZXJzO1xuXG4gICAgc3RhdGljIENVQkVNQVBfUEFSQU1FVEVSUyA9IHN0YW5kYXJkTWF0ZXJpYWxDdWJlbWFwUGFyYW1ldGVycztcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTdGFuZGFyZE1hdGVyaWFsIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBuZXcgU3RhbmRhcmQgbWF0ZXJpYWxcbiAgICAgKiB2YXIgbWF0ZXJpYWwgPSBuZXcgcGMuU3RhbmRhcmRNYXRlcmlhbCgpO1xuICAgICAqXG4gICAgICogLy8gVXBkYXRlIHRoZSBtYXRlcmlhbCdzIGRpZmZ1c2UgYW5kIHNwZWN1bGFyIHByb3BlcnRpZXNcbiAgICAgKiBtYXRlcmlhbC5kaWZmdXNlLnNldCgxLCAwLCAwKTtcbiAgICAgKiBtYXRlcmlhbC5zcGVjdWxhci5zZXQoMSwgMSwgMSk7XG4gICAgICpcbiAgICAgKiAvLyBOb3RpZnkgdGhlIG1hdGVyaWFsIHRoYXQgaXQgaGFzIGJlZW4gbW9kaWZpZWRcbiAgICAgKiBtYXRlcmlhbC51cGRhdGUoKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG5ldyBTdGFuZGFyZCBtYXRlcmlhbFxuICAgICAqIHZhciBtYXRlcmlhbCA9IG5ldyBwYy5TdGFuZGFyZE1hdGVyaWFsKCk7XG4gICAgICpcbiAgICAgKiAvLyBBc3NpZ24gYSB0ZXh0dXJlIHRvIHRoZSBkaWZmdXNlIHNsb3RcbiAgICAgKiBtYXRlcmlhbC5kaWZmdXNlTWFwID0gdGV4dHVyZTtcbiAgICAgKlxuICAgICAqIC8vIFVzZSB0aGUgYWxwaGEgY2hhbm5lbCBvZiB0aGUgdGV4dHVyZSBmb3IgYWxwaGEgdGVzdGluZyB3aXRoIGEgcmVmZXJlbmNlIHZhbHVlIG9mIDAuNVxuICAgICAqIG1hdGVyaWFsLm9wYWNpdHlNYXAgPSB0ZXh0dXJlO1xuICAgICAqIG1hdGVyaWFsLmFscGhhVGVzdCA9IDAuNTtcbiAgICAgKlxuICAgICAqIC8vIE5vdGlmeSB0aGUgbWF0ZXJpYWwgdGhhdCBpdCBoYXMgYmVlbiBtb2RpZmllZFxuICAgICAqIG1hdGVyaWFsLnVwZGF0ZSgpO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMuX2RpcnR5U2hhZGVyID0gdHJ1ZTtcblxuICAgICAgICAvLyBzdG9yYWdlIGZvciB0ZXh0dXJlIGFuZCBjdWJlbWFwIGFzc2V0IHJlZmVyZW5jZXNcbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2VzID0ge307XG5cbiAgICAgICAgdGhpcy5fYWN0aXZlUGFyYW1zID0gbmV3IFNldCgpO1xuICAgICAgICB0aGlzLl9hY3RpdmVMaWdodGluZ1BhcmFtcyA9IG5ldyBTZXQoKTtcblxuICAgICAgICB0aGlzLnNoYWRlck9wdEJ1aWxkZXIgPSBuZXcgU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnNCdWlsZGVyKCk7XG5cbiAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgIH1cblxuICAgIHJlc2V0KCkge1xuICAgICAgICAvLyBzZXQgZGVmYXVsdCB2YWx1ZXNcbiAgICAgICAgT2JqZWN0LmtleXMoX3Byb3BzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgICAgICB0aGlzW2BfJHtuYW1lfWBdID0gX3Byb3BzW25hbWVdLnZhbHVlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2NodW5rcyA9IHsgfTtcbiAgICAgICAgdGhpcy5fdW5pZm9ybUNhY2hlID0geyB9O1xuICAgIH1cblxuICAgIHNldCBzaGFkZXIoc2hhZGVyKSB7XG4gICAgICAgIERlYnVnLndhcm4oJ1N0YW5kYXJkTWF0ZXJpYWwjc2hhZGVyIHByb3BlcnR5IGlzIG5vdCBpbXBsZW1lbnRlZCwgYW5kIHNob3VsZCBub3QgYmUgdXNlZC4nKTtcbiAgICB9XG5cbiAgICBnZXQgc2hhZGVyKCkge1xuICAgICAgICBEZWJ1Zy53YXJuKCdTdGFuZGFyZE1hdGVyaWFsI3NoYWRlciBwcm9wZXJ0eSBpcyBub3QgaW1wbGVtZW50ZWQsIGFuZCBzaG91bGQgbm90IGJlIHVzZWQuJyk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE9iamVjdCBjb250YWluaW5nIGN1c3RvbSBzaGFkZXIgY2h1bmtzIHRoYXQgd2lsbCByZXBsYWNlIGRlZmF1bHQgb25lcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3Q8c3RyaW5nLCBzdHJpbmc+fVxuICAgICAqL1xuICAgIHNldCBjaHVua3ModmFsdWUpIHtcbiAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSB0cnVlO1xuICAgICAgICB0aGlzLl9jaHVua3MgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2h1bmtzKCkge1xuICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRydWU7XG4gICAgICAgIHJldHVybiB0aGlzLl9jaHVua3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29weSBhIGBTdGFuZGFyZE1hdGVyaWFsYC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RhbmRhcmRNYXRlcmlhbH0gc291cmNlIC0gVGhlIG1hdGVyaWFsIHRvIGNvcHkgZnJvbS5cbiAgICAgKiBAcmV0dXJucyB7U3RhbmRhcmRNYXRlcmlhbH0gVGhlIGRlc3RpbmF0aW9uIG1hdGVyaWFsLlxuICAgICAqL1xuICAgIGNvcHkoc291cmNlKSB7XG4gICAgICAgIHN1cGVyLmNvcHkoc291cmNlKTtcblxuICAgICAgICAvLyBzZXQgcHJvcGVydGllc1xuICAgICAgICBPYmplY3Qua2V5cyhfcHJvcHMpLmZvckVhY2goKGspID0+IHtcbiAgICAgICAgICAgIHRoaXNba10gPSBzb3VyY2Vba107XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGNsb25lIGNodW5rc1xuICAgICAgICBmb3IgKGNvbnN0IHAgaW4gc291cmNlLl9jaHVua3MpIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UuX2NodW5rcy5oYXNPd25Qcm9wZXJ0eShwKSlcbiAgICAgICAgICAgICAgICB0aGlzLl9jaHVua3NbcF0gPSBzb3VyY2UuX2NodW5rc1twXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIF9zZXRQYXJhbWV0ZXIobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgX3BhcmFtcy5hZGQobmFtZSk7XG4gICAgICAgIHRoaXMuc2V0UGFyYW1ldGVyKG5hbWUsIHZhbHVlKTtcbiAgICB9XG5cbiAgICBfc2V0UGFyYW1ldGVycyhwYXJhbWV0ZXJzKSB7XG4gICAgICAgIHBhcmFtZXRlcnMuZm9yRWFjaCgodikgPT4ge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKHYubmFtZSwgdi52YWx1ZSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIF9wcm9jZXNzUGFyYW1ldGVycyhwYXJhbXNOYW1lKSB7XG4gICAgICAgIGNvbnN0IHByZXZQYXJhbXMgPSB0aGlzW3BhcmFtc05hbWVdO1xuICAgICAgICBwcmV2UGFyYW1zLmZvckVhY2goKHBhcmFtKSA9PiB7XG4gICAgICAgICAgICBpZiAoIV9wYXJhbXMuaGFzKHBhcmFtKSkge1xuICAgICAgICAgICAgICAgIGRlbGV0ZSB0aGlzLnBhcmFtZXRlcnNbcGFyYW1dO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzW3BhcmFtc05hbWVdID0gX3BhcmFtcztcbiAgICAgICAgX3BhcmFtcyA9IHByZXZQYXJhbXM7XG4gICAgICAgIF9wYXJhbXMuY2xlYXIoKTtcbiAgICB9XG5cbiAgICBfdXBkYXRlTWFwKHApIHtcbiAgICAgICAgY29uc3QgbW5hbWUgPSBwICsgJ01hcCc7XG4gICAgICAgIGNvbnN0IG1hcCA9IHRoaXNbbW5hbWVdO1xuICAgICAgICBpZiAobWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfJyArIG1uYW1lLCBtYXApO1xuXG4gICAgICAgICAgICBjb25zdCB0bmFtZSA9IG1uYW1lICsgJ1RyYW5zZm9ybSc7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtID0gdGhpcy5nZXRVbmlmb3JtKHRuYW1lKTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVycyh1bmlmb3JtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGFsbG9jYXRlIGEgdW5pZm9ybSBpZiBpdCBkb2Vzbid0IGFscmVhZHkgZXhpc3QgaW4gdGhlIHVuaWZvcm0gY2FjaGVcbiAgICBfYWxsb2NVbmlmb3JtKG5hbWUsIGFsbG9jRnVuYykge1xuICAgICAgICBsZXQgdW5pZm9ybSA9IHRoaXMuX3VuaWZvcm1DYWNoZVtuYW1lXTtcbiAgICAgICAgaWYgKCF1bmlmb3JtKSB7XG4gICAgICAgICAgICB1bmlmb3JtID0gYWxsb2NGdW5jKCk7XG4gICAgICAgICAgICB0aGlzLl91bmlmb3JtQ2FjaGVbbmFtZV0gPSB1bmlmb3JtO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmlmb3JtO1xuICAgIH1cblxuICAgIGdldFVuaWZvcm0obmFtZSwgZGV2aWNlLCBzY2VuZSkge1xuICAgICAgICByZXR1cm4gX3VuaWZvcm1zW25hbWVdKHRoaXMsIGRldmljZSwgc2NlbmUpO1xuICAgIH1cblxuICAgIHVwZGF0ZVVuaWZvcm1zKGRldmljZSwgc2NlbmUpIHtcbiAgICAgICAgY29uc3QgZ2V0VW5pZm9ybSA9IChuYW1lKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRVbmlmb3JtKG5hbWUsIGRldmljZSwgc2NlbmUpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfYW1iaWVudCcsIGdldFVuaWZvcm0oJ2FtYmllbnQnKSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmRpZmZ1c2VNYXAgfHwgdGhpcy5kaWZmdXNlVGludCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9kaWZmdXNlJywgZ2V0VW5pZm9ybSgnZGlmZnVzZScpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGhpcy51c2VNZXRhbG5lc3MpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5zcGVjdWxhck1hcCB8fCB0aGlzLnNwZWN1bGFyVGludCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfc3BlY3VsYXInLCBnZXRVbmlmb3JtKCdzcGVjdWxhcicpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5tZXRhbG5lc3NNYXAgfHwgdGhpcy5tZXRhbG5lc3MgPCAxKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9tZXRhbG5lc3MnLCB0aGlzLm1ldGFsbmVzcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BlY3VsYXJNYXAgfHwgdGhpcy5zcGVjdWxhclRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NwZWN1bGFyJywgZ2V0VW5pZm9ybSgnc3BlY3VsYXInKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc3BlY3VsYXJpdHlGYWN0b3JNYXAgfHwgdGhpcy5zcGVjdWxhcml0eUZhY3RvclRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NwZWN1bGFyaXR5RmFjdG9yJywgdGhpcy5zcGVjdWxhcml0eUZhY3Rvcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc2hlZW5NYXAgfHwgdGhpcy5zaGVlblRpbnQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3NoZWVuJywgZ2V0VW5pZm9ybSgnc2hlZW4nKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIXRoaXMuc2hlZW5HbG9zc2luZXNzTWFwIHx8IHRoaXMuc2hlZW5HbG9zc2luZXNzVGludCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfc2hlZW5HbG9zc2luZXNzJywgdGhpcy5zaGVlbkdsb3NzaW5lc3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5yZWZyYWN0aW9uSW5kZXggPiAwLjApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBvbmVPdmVyUmVmcmFjdGlvbkluZGV4ID0gMS4wIC8gdGhpcy5yZWZyYWN0aW9uSW5kZXg7XG4gICAgICAgICAgICAgICAgY29uc3QgZjAgPSAob25lT3ZlclJlZnJhY3Rpb25JbmRleCAtIDEpIC8gKG9uZU92ZXJSZWZyYWN0aW9uSW5kZXggKyAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2YwJywgZjAgKiBmMCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfZjAnLCAxLjApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbmFibGVHR1hTcGVjdWxhcikge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9hbmlzb3Ryb3B5JywgdGhpcy5hbmlzb3Ryb3B5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNsZWFyQ29hdCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfY2xlYXJDb2F0JywgdGhpcy5jbGVhckNvYXQpO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9jbGVhckNvYXRHbG9zc2luZXNzJywgdGhpcy5jbGVhckNvYXRHbG9zc2luZXNzKTtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfY2xlYXJDb2F0QnVtcGluZXNzJywgdGhpcy5jbGVhckNvYXRCdW1waW5lc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9zaGluaW5lc3MnLCBnZXRVbmlmb3JtKCdzaGluaW5lc3MnKSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLmVtaXNzaXZlTWFwIHx8IHRoaXMuZW1pc3NpdmVUaW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2VtaXNzaXZlJywgZ2V0VW5pZm9ybSgnZW1pc3NpdmUnKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZW1pc3NpdmVJbnRlbnNpdHkgIT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfZW1pc3NpdmVJbnRlbnNpdHknLCB0aGlzLmVtaXNzaXZlSW50ZW5zaXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJlZnJhY3Rpb24gPiAwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX3JlZnJhY3Rpb24nLCB0aGlzLnJlZnJhY3Rpb24pO1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9yZWZyYWN0aW9uSW5kZXgnLCB0aGlzLnJlZnJhY3Rpb25JbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy51c2VEeW5hbWljUmVmcmFjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF90aGlja25lc3MnLCB0aGlzLnRoaWNrbmVzcyk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2F0dGVudWF0aW9uJywgZ2V0VW5pZm9ybSgnYXR0ZW51YXRpb24nKSk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2ludkF0dGVudWF0aW9uRGlzdGFuY2UnLCB0aGlzLmF0dGVudWF0aW9uRGlzdGFuY2UgPT09IDAgPyAwIDogMS4wIC8gdGhpcy5hdHRlbnVhdGlvbkRpc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnVzZUlyaWRlc2NlbmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2lyaWRlc2NlbmNlJywgdGhpcy5pcmlkZXNjZW5jZSk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2lyaWRlc2NlbmNlUmVmcmFjdGlvbkluZGV4JywgdGhpcy5pcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCk7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2lyaWRlc2NlbmNlVGhpY2tuZXNzTWluJywgdGhpcy5pcmlkZXNjZW5jZVRoaWNrbmVzc01pbik7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2lyaWRlc2NlbmNlVGhpY2tuZXNzTWF4JywgdGhpcy5pcmlkZXNjZW5jZVRoaWNrbmVzc01heCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX29wYWNpdHknLCB0aGlzLm9wYWNpdHkpO1xuXG4gICAgICAgIGlmICh0aGlzLm9wYWNpdHlGYWRlc1NwZWN1bGFyID09PSBmYWxzZSkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9hbHBoYUZhZGUnLCB0aGlzLmFscGhhRmFkZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vY2NsdWRlU3BlY3VsYXIpIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfb2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5JywgdGhpcy5vY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuY3ViZU1hcFByb2plY3Rpb24gPT09IENVQkVQUk9KX0JPWCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKGdldFVuaWZvcm0oJ2N1YmVNYXBQcm9qZWN0aW9uQm94JykpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBwIGluIF9tYXRUZXgyRCkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlTWFwKHApO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuYW1iaWVudFNIKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ2FtYmllbnRTSFswXScsIHRoaXMuYW1iaWVudFNIKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLm5vcm1hbE1hcCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCdtYXRlcmlhbF9idW1waW5lc3MnLCB0aGlzLmJ1bXBpbmVzcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5ub3JtYWxNYXAgJiYgdGhpcy5ub3JtYWxEZXRhaWxNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfbm9ybWFsRGV0YWlsTWFwQnVtcGluZXNzJywgdGhpcy5ub3JtYWxEZXRhaWxNYXBCdW1waW5lc3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuaGVpZ2h0TWFwKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ21hdGVyaWFsX2hlaWdodE1hcEZhY3RvcicsIGdldFVuaWZvcm0oJ2hlaWdodE1hcEZhY3RvcicpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGlzUGhvbmcgPSB0aGlzLnNoYWRpbmdNb2RlbCA9PT0gU1BFQ1VMQVJfUEhPTkc7XG5cbiAgICAgICAgLy8gc2V0IG92ZXJyaWRkZW4gZW52aXJvbm1lbnQgdGV4dHVyZXNcbiAgICAgICAgaWYgKHRoaXMuZW52QXRsYXMgJiYgdGhpcy5jdWJlTWFwICYmICFpc1Bob25nKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW52QXRsYXMnLCB0aGlzLmVudkF0bGFzKTtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9jdWJlTWFwJywgdGhpcy5jdWJlTWFwKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmVudkF0bGFzICYmICFpc1Bob25nKSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW52QXRsYXMnLCB0aGlzLmVudkF0bGFzKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmN1YmVNYXApIHtcbiAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9jdWJlTWFwJywgdGhpcy5jdWJlTWFwKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnNwaGVyZU1hcCkge1xuICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX3NwaGVyZU1hcCcsIHRoaXMuc3BoZXJlTWFwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignbWF0ZXJpYWxfcmVmbGVjdGl2aXR5JywgdGhpcy5yZWZsZWN0aXZpdHkpO1xuXG4gICAgICAgIC8vIHJlbW92ZSB1bnVzZWQgcGFyYW1zXG4gICAgICAgIHRoaXMuX3Byb2Nlc3NQYXJhbWV0ZXJzKCdfYWN0aXZlUGFyYW1zJyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2RpcnR5U2hhZGVyKSB7XG4gICAgICAgICAgICB0aGlzLmNsZWFyVmFyaWFudHMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZUVudlVuaWZvcm1zKGRldmljZSwgc2NlbmUpIHtcbiAgICAgICAgY29uc3QgaXNQaG9uZyA9IHRoaXMuc2hhZGluZ01vZGVsID09PSBTUEVDVUxBUl9QSE9ORztcbiAgICAgICAgY29uc3QgaGFzTG9jYWxFbnZPdmVycmlkZSA9ICh0aGlzLmVudkF0bGFzICYmICFpc1Bob25nKSB8fCB0aGlzLmN1YmVNYXAgfHwgdGhpcy5zcGhlcmVNYXA7XG5cbiAgICAgICAgaWYgKCFoYXNMb2NhbEVudk92ZXJyaWRlICYmIHRoaXMudXNlU2t5Ym94KSB7XG4gICAgICAgICAgICBpZiAoc2NlbmUuZW52QXRsYXMgJiYgc2NlbmUuc2t5Ym94ICYmICFpc1Bob25nKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0UGFyYW1ldGVyKCd0ZXh0dXJlX2VudkF0bGFzJywgc2NlbmUuZW52QXRsYXMpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9jdWJlTWFwJywgc2NlbmUuc2t5Ym94KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2NlbmUuZW52QXRsYXMgJiYgIWlzUGhvbmcpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRQYXJhbWV0ZXIoJ3RleHR1cmVfZW52QXRsYXMnLCBzY2VuZS5lbnZBdGxhcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHNjZW5lLnNreWJveCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcigndGV4dHVyZV9jdWJlTWFwJywgc2NlbmUuc2t5Ym94KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFzY2VuZS5za3lib3hSb3RhdGlvbi5lcXVhbHMoUXVhdC5JREVOVElUWSkgJiYgc2NlbmUuX3NreWJveFJvdGF0aW9uTWF0Mykge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldFBhcmFtZXRlcignY3ViZU1hcFJvdGF0aW9uTWF0cml4Jywgc2NlbmUuX3NreWJveFJvdGF0aW9uTWF0My5kYXRhKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3Byb2Nlc3NQYXJhbWV0ZXJzKCdfYWN0aXZlTGlnaHRpbmdQYXJhbXMnKTtcbiAgICB9XG5cbiAgICBnZXRTaGFkZXJWYXJpYW50KGRldmljZSwgc2NlbmUsIG9iakRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzLCB2aWV3VW5pZm9ybUZvcm1hdCwgdmlld0JpbmRHcm91cEZvcm1hdCkge1xuXG4gICAgICAgIC8vIHVwZGF0ZSBwcmVmaWx0ZXJlZCBsaWdodGluZyBkYXRhXG4gICAgICAgIHRoaXMudXBkYXRlRW52VW5pZm9ybXMoZGV2aWNlLCBzY2VuZSk7XG5cbiAgICAgICAgLy8gTWluaW1hbCBvcHRpb25zIGZvciBEZXB0aCBhbmQgU2hhZG93IHBhc3Nlc1xuICAgICAgICBjb25zdCBtaW5pbWFsT3B0aW9ucyA9IHBhc3MgPT09IFNIQURFUl9ERVBUSCB8fCBwYXNzID09PSBTSEFERVJfUElDSyB8fCBTaGFkZXJQYXNzLmlzU2hhZG93KHBhc3MpO1xuICAgICAgICBsZXQgb3B0aW9ucyA9IG1pbmltYWxPcHRpb25zID8gc3RhbmRhcmQub3B0aW9uc0NvbnRleHRNaW4gOiBzdGFuZGFyZC5vcHRpb25zQ29udGV4dDtcblxuICAgICAgICBpZiAobWluaW1hbE9wdGlvbnMpXG4gICAgICAgICAgICB0aGlzLnNoYWRlck9wdEJ1aWxkZXIudXBkYXRlTWluUmVmKG9wdGlvbnMsIHNjZW5lLCB0aGlzLCBvYmpEZWZzLCBzdGF0aWNMaWdodExpc3QsIHBhc3MsIHNvcnRlZExpZ2h0cyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuc2hhZGVyT3B0QnVpbGRlci51cGRhdGVSZWYob3B0aW9ucywgc2NlbmUsIHRoaXMsIG9iakRlZnMsIHN0YXRpY0xpZ2h0TGlzdCwgcGFzcywgc29ydGVkTGlnaHRzKTtcblxuICAgICAgICAvLyBleGVjdXRlIHVzZXIgY2FsbGJhY2sgdG8gbW9kaWZ5IHRoZSBvcHRpb25zXG4gICAgICAgIGlmICh0aGlzLm9uVXBkYXRlU2hhZGVyKSB7XG4gICAgICAgICAgICBvcHRpb25zID0gdGhpcy5vblVwZGF0ZVNoYWRlcihvcHRpb25zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByb2Nlc3NpbmdPcHRpb25zID0gbmV3IFNoYWRlclByb2Nlc3Nvck9wdGlvbnModmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpO1xuXG4gICAgICAgIGNvbnN0IGxpYnJhcnkgPSBkZXZpY2UuZ2V0UHJvZ3JhbUxpYnJhcnkoKTtcbiAgICAgICAgbGlicmFyeS5yZWdpc3Rlcignc3RhbmRhcmQnLCBzdGFuZGFyZCk7XG4gICAgICAgIGNvbnN0IHNoYWRlciA9IGxpYnJhcnkuZ2V0UHJvZ3JhbSgnc3RhbmRhcmQnLCBvcHRpb25zLCBwcm9jZXNzaW5nT3B0aW9ucyk7XG5cbiAgICAgICAgdGhpcy5fZGlydHlTaGFkZXIgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHNoYWRlcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIHRoaXMgbWF0ZXJpYWwgZnJvbSB0aGUgc2NlbmUgYW5kIHBvc3NpYmx5IGZyZWVzIHVwIG1lbW9yeSBmcm9tIGl0cyBzaGFkZXJzIChpZiB0aGVyZVxuICAgICAqIGFyZSBubyBvdGhlciBtYXRlcmlhbHMgdXNpbmcgaXQpLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIC8vIHVuYmluZCAodGV4dHVyZSkgYXNzZXQgcmVmZXJlbmNlc1xuICAgICAgICBmb3IgKGNvbnN0IGFzc2V0IGluIHRoaXMuX2Fzc2V0UmVmZXJlbmNlcykge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2VzW2Fzc2V0XS5fdW5iaW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2VzID0gbnVsbDtcblxuICAgICAgICBzdXBlci5kZXN0cm95KCk7XG4gICAgfVxufVxuXG4vLyBkZWZpbmUgYSB1bmlmb3JtIGdldCBmdW5jdGlvblxuY29uc3QgZGVmaW5lVW5pZm9ybSA9IChuYW1lLCBnZXRVbmlmb3JtRnVuYykgPT4ge1xuICAgIF91bmlmb3Jtc1tuYW1lXSA9IGdldFVuaWZvcm1GdW5jO1xufTtcblxuY29uc3QgZGVmaW5lUHJvcEludGVybmFsID0gKG5hbWUsIGNvbnN0cnVjdG9yRnVuYywgc2V0dGVyRnVuYywgZ2V0dGVyRnVuYykgPT4ge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShTdGFuZGFyZE1hdGVyaWFsLnByb3RvdHlwZSwgbmFtZSwge1xuICAgICAgICBnZXQ6IGdldHRlckZ1bmMgfHwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXNbYF8ke25hbWV9YF07XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogc2V0dGVyRnVuY1xuICAgIH0pO1xuXG4gICAgX3Byb3BzW25hbWVdID0ge1xuICAgICAgICB2YWx1ZTogY29uc3RydWN0b3JGdW5jXG4gICAgfTtcbn07XG5cbi8vIGRlZmluZSBhIHNpbXBsZSB2YWx1ZSBwcm9wZXJ0eSAoZmxvYXQsIHN0cmluZyBldGMpXG5jb25zdCBkZWZpbmVWYWx1ZVByb3AgPSAocHJvcCkgPT4ge1xuICAgIGNvbnN0IGludGVybmFsTmFtZSA9IGBfJHtwcm9wLm5hbWV9YDtcbiAgICBjb25zdCBkaXJ0eVNoYWRlckZ1bmMgPSBwcm9wLmRpcnR5U2hhZGVyRnVuYyB8fCAoKCkgPT4gdHJ1ZSk7XG5cbiAgICBjb25zdCBzZXR0ZXJGdW5jID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpc1tpbnRlcm5hbE5hbWVdO1xuICAgICAgICBpZiAob2xkVmFsdWUgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRoaXMuX2RpcnR5U2hhZGVyIHx8IGRpcnR5U2hhZGVyRnVuYyhvbGRWYWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgdGhpc1tpbnRlcm5hbE5hbWVdID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZGVmaW5lUHJvcEludGVybmFsKHByb3AubmFtZSwgKCkgPT4gcHJvcC5kZWZhdWx0VmFsdWUsIHNldHRlckZ1bmMsIHByb3AuZ2V0dGVyRnVuYyk7XG59O1xuXG4vLyBkZWZpbmUgYW4gYWdncmVnYXRlIHByb3BlcnR5IChjb2xvciwgdmVjMyBldGMpXG5jb25zdCBkZWZpbmVBZ2dQcm9wID0gKHByb3ApID0+IHtcbiAgICBjb25zdCBpbnRlcm5hbE5hbWUgPSBgXyR7cHJvcC5uYW1lfWA7XG4gICAgY29uc3QgZGlydHlTaGFkZXJGdW5jID0gcHJvcC5kaXJ0eVNoYWRlckZ1bmMgfHwgKCgpID0+IHRydWUpO1xuXG4gICAgY29uc3Qgc2V0dGVyRnVuYyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBjb25zdCBvbGRWYWx1ZSA9IHRoaXNbaW50ZXJuYWxOYW1lXTtcbiAgICAgICAgaWYgKCFvbGRWYWx1ZS5lcXVhbHModmFsdWUpKSB7XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRoaXMuX2RpcnR5U2hhZGVyIHx8IGRpcnR5U2hhZGVyRnVuYyhvbGRWYWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgdGhpc1tpbnRlcm5hbE5hbWVdID0gb2xkVmFsdWUuY29weSh2YWx1ZSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZGVmaW5lUHJvcEludGVybmFsKHByb3AubmFtZSwgKCkgPT4gcHJvcC5kZWZhdWx0VmFsdWUuY2xvbmUoKSwgc2V0dGVyRnVuYywgcHJvcC5nZXR0ZXJGdW5jKTtcbn07XG5cbi8vIGRlZmluZSBlaXRoZXIgYSB2YWx1ZSBvciBhZ2dyZWdhdGUgcHJvcGVydHlcbmNvbnN0IGRlZmluZVByb3AgPSAocHJvcCkgPT4ge1xuICAgIHJldHVybiBwcm9wLmRlZmF1bHRWYWx1ZSAmJiBwcm9wLmRlZmF1bHRWYWx1ZS5jbG9uZSA/IGRlZmluZUFnZ1Byb3AocHJvcCkgOiBkZWZpbmVWYWx1ZVByb3AocHJvcCk7XG59O1xuXG5mdW5jdGlvbiBfZGVmaW5lVGV4MkQobmFtZSwgdXYsIGNoYW5uZWxzLCBkZWZDaGFubmVsLCB2ZXJ0ZXhDb2xvciwgZGV0YWlsTW9kZSkge1xuICAgIC8vIHN0b3JlIHRleHR1cmUgbmFtZVxuICAgIF9tYXRUZXgyRFtuYW1lXSA9IGNoYW5uZWxzO1xuXG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IGAke25hbWV9TWFwYCxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBudWxsLFxuICAgICAgICBkaXJ0eVNoYWRlckZ1bmM6IChvbGRWYWx1ZSwgbmV3VmFsdWUpID0+IHtcbiAgICAgICAgICAgIHJldHVybiAhIW9sZFZhbHVlICE9PSAhIW5ld1ZhbHVlIHx8XG4gICAgICAgICAgICAgICAgb2xkVmFsdWUgJiYgKG9sZFZhbHVlLnR5cGUgIT09IG5ld1ZhbHVlLnR5cGUgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWUuZml4Q3ViZW1hcFNlYW1zICE9PSBuZXdWYWx1ZS5maXhDdWJlbWFwU2VhbXMgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2xkVmFsdWUuZm9ybWF0ICE9PSBuZXdWYWx1ZS5mb3JtYXQpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBUaWxpbmdgLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IG5ldyBWZWMyKDEsIDEpXG4gICAgfSk7XG5cbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBPZmZzZXRgLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IG5ldyBWZWMyKDAsIDApXG4gICAgfSk7XG5cbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBSb3RhdGlvbmAsXG4gICAgICAgIGRlZmF1bHRWYWx1ZTogMFxuICAgIH0pO1xuXG4gICAgZGVmaW5lUHJvcCh7XG4gICAgICAgIG5hbWU6IGAke25hbWV9TWFwVXZgLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IHV2XG4gICAgfSk7XG5cbiAgICBpZiAoY2hhbm5lbHMgPiAwKSB7XG4gICAgICAgIGRlZmluZVByb3Aoe1xuICAgICAgICAgICAgbmFtZTogYCR7bmFtZX1NYXBDaGFubmVsYCxcbiAgICAgICAgICAgIGRlZmF1bHRWYWx1ZTogZGVmQ2hhbm5lbCA/IGRlZkNoYW5uZWwgOiAoY2hhbm5lbHMgPiAxID8gJ3JnYicgOiAnZycpXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmICh2ZXJ0ZXhDb2xvcikge1xuICAgICAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgICAgIG5hbWU6IGAke25hbWV9VmVydGV4Q29sb3JgLFxuICAgICAgICAgICAgZGVmYXVsdFZhbHVlOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoY2hhbm5lbHMgPiAwKSB7XG4gICAgICAgICAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBgJHtuYW1lfVZlcnRleENvbG9yQ2hhbm5lbGAsXG4gICAgICAgICAgICAgICAgZGVmYXVsdFZhbHVlOiBkZWZDaGFubmVsID8gZGVmQ2hhbm5lbCA6IChjaGFubmVscyA+IDEgPyAncmdiJyA6ICdnJylcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGRldGFpbE1vZGUpIHtcbiAgICAgICAgZGVmaW5lUHJvcCh7XG4gICAgICAgICAgICBuYW1lOiBgJHtuYW1lfU1vZGVgLFxuICAgICAgICAgICAgZGVmYXVsdFZhbHVlOiBERVRBSUxNT0RFX01VTFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBjb25zdHJ1Y3QgdGhlIHRyYW5zZm9ybSB1bmlmb3JtXG4gICAgY29uc3QgbWFwVGlsaW5nID0gYCR7bmFtZX1NYXBUaWxpbmdgO1xuICAgIGNvbnN0IG1hcE9mZnNldCA9IGAke25hbWV9TWFwT2Zmc2V0YDtcbiAgICBjb25zdCBtYXBSb3RhdGlvbiA9IGAke25hbWV9TWFwUm90YXRpb25gO1xuICAgIGNvbnN0IG1hcFRyYW5zZm9ybSA9IGAke25hbWV9TWFwVHJhbnNmb3JtYDtcbiAgICBkZWZpbmVVbmlmb3JtKG1hcFRyYW5zZm9ybSwgKG1hdGVyaWFsLCBkZXZpY2UsIHNjZW5lKSA9PiB7XG4gICAgICAgIGNvbnN0IHRpbGluZyA9IG1hdGVyaWFsW21hcFRpbGluZ107XG4gICAgICAgIGNvbnN0IG9mZnNldCA9IG1hdGVyaWFsW21hcE9mZnNldF07XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gbWF0ZXJpYWxbbWFwUm90YXRpb25dO1xuXG4gICAgICAgIGlmICh0aWxpbmcueCA9PT0gMSAmJiB0aWxpbmcueSA9PT0gMSAmJlxuICAgICAgICAgICAgb2Zmc2V0LnggPT09IDAgJiYgb2Zmc2V0LnkgPT09IDAgJiZcbiAgICAgICAgICAgIHJvdGF0aW9uID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHVuaWZvcm0gPSBtYXRlcmlhbC5fYWxsb2NVbmlmb3JtKG1hcFRyYW5zZm9ybSwgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFt7XG4gICAgICAgICAgICAgICAgbmFtZTogYHRleHR1cmVfJHttYXBUcmFuc2Zvcm19MGAsXG4gICAgICAgICAgICAgICAgdmFsdWU6IG5ldyBGbG9hdDMyQXJyYXkoMylcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICBuYW1lOiBgdGV4dHVyZV8ke21hcFRyYW5zZm9ybX0xYCxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbmV3IEZsb2F0MzJBcnJheSgzKVxuICAgICAgICAgICAgfV07XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNyID0gTWF0aC5jb3Mocm90YXRpb24gKiBtYXRoLkRFR19UT19SQUQpO1xuICAgICAgICBjb25zdCBzciA9IE1hdGguc2luKHJvdGF0aW9uICogbWF0aC5ERUdfVE9fUkFEKTtcblxuICAgICAgICBjb25zdCB1bmlmb3JtMCA9IHVuaWZvcm1bMF0udmFsdWU7XG4gICAgICAgIHVuaWZvcm0wWzBdID0gY3IgKiB0aWxpbmcueDtcbiAgICAgICAgdW5pZm9ybTBbMV0gPSAtc3IgKiB0aWxpbmcueTtcbiAgICAgICAgdW5pZm9ybTBbMl0gPSBvZmZzZXQueDtcblxuICAgICAgICBjb25zdCB1bmlmb3JtMSA9IHVuaWZvcm1bMV0udmFsdWU7XG4gICAgICAgIHVuaWZvcm0xWzBdID0gc3IgKiB0aWxpbmcueDtcbiAgICAgICAgdW5pZm9ybTFbMV0gPSBjciAqIHRpbGluZy55O1xuICAgICAgICB1bmlmb3JtMVsyXSA9IDEuMCAtIHRpbGluZy55IC0gb2Zmc2V0Lnk7XG5cbiAgICAgICAgcmV0dXJuIHVuaWZvcm07XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIF9kZWZpbmVDb2xvcihuYW1lLCBkZWZhdWx0VmFsdWUpIHtcbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBkZWZhdWx0VmFsdWUsXG4gICAgICAgIGdldHRlckZ1bmM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIC8vIEhBQ0s6IHNpbmNlIHdlIGNhbid0IGRldGVjdCB3aGV0aGVyIGEgdXNlciBpcyBnb2luZyB0byBzZXQgYSBjb2xvciBwcm9wZXJ0eVxuICAgICAgICAgICAgLy8gYWZ0ZXIgY2FsbGluZyB0aGlzIGdldHRlciAoaS5lIGRvaW5nIG1hdGVyaWFsLmFtYmllbnQuciA9IDAuNSkgd2UgbXVzdCBhc3N1bWVcbiAgICAgICAgICAgIC8vIHRoZSB3b3JzdCBhbmQgZmxhZyB0aGUgc2hhZGVyIGFzIGRpcnR5LlxuICAgICAgICAgICAgLy8gVGhpcyBtZWFucyBjdXJyZW50bHkgYW5pbWF0aW5nIGEgbWF0ZXJpYWwgY29sb3VyIGlzIGhvcnJpYmx5IHNsb3cuXG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gdGhpc1tgXyR7bmFtZX1gXTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgZGVmaW5lVW5pZm9ybShuYW1lLCAobWF0ZXJpYWwsIGRldmljZSwgc2NlbmUpID0+IHtcbiAgICAgICAgY29uc3QgdW5pZm9ybSA9IG1hdGVyaWFsLl9hbGxvY1VuaWZvcm0obmFtZSwgKCkgPT4gbmV3IEZsb2F0MzJBcnJheSgzKSk7XG4gICAgICAgIGNvbnN0IGNvbG9yID0gbWF0ZXJpYWxbbmFtZV07XG4gICAgICAgIGNvbnN0IGdhbW1hID0gbWF0ZXJpYWwudXNlR2FtbWFUb25lbWFwICYmIHNjZW5lLmdhbW1hQ29ycmVjdGlvbjtcblxuICAgICAgICBpZiAoZ2FtbWEpIHtcbiAgICAgICAgICAgIHVuaWZvcm1bMF0gPSBNYXRoLnBvdyhjb2xvci5yLCAyLjIpO1xuICAgICAgICAgICAgdW5pZm9ybVsxXSA9IE1hdGgucG93KGNvbG9yLmcsIDIuMik7XG4gICAgICAgICAgICB1bmlmb3JtWzJdID0gTWF0aC5wb3coY29sb3IuYiwgMi4yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuaWZvcm1bMF0gPSBjb2xvci5yO1xuICAgICAgICAgICAgdW5pZm9ybVsxXSA9IGNvbG9yLmc7XG4gICAgICAgICAgICB1bmlmb3JtWzJdID0gY29sb3IuYjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB1bmlmb3JtO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBfZGVmaW5lRmxvYXQobmFtZSwgZGVmYXVsdFZhbHVlLCBnZXRVbmlmb3JtRnVuYykge1xuICAgIGRlZmluZVByb3Aoe1xuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IGRlZmF1bHRWYWx1ZSxcbiAgICAgICAgZGlydHlTaGFkZXJGdW5jOiAob2xkVmFsdWUsIG5ld1ZhbHVlKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGlzIGlzIG5vdCBhbHdheXMgb3B0aW1hbCBhbmQgd2lsbCBzb21ldGltZXMgdHJpZ2dlciByZWR1bmRhbnQgc2hhZGVyXG4gICAgICAgICAgICAvLyByZWNvbXBpbGF0aW9uLiBIb3dldmVyLCBubyBudW1iZXIgcHJvcGVydHkgb24gYSBzdGFuZGFyZCBtYXRlcmlhbFxuICAgICAgICAgICAgLy8gdHJpZ2dlcnMgYSBzaGFkZXIgcmVjb21waWxlIGlmIHRoZSBwcmV2aW91cyBhbmQgY3VycmVudCB2YWx1ZXMgYm90aFxuICAgICAgICAgICAgLy8gaGF2ZSBhIGZyYWN0aW9uYWwgcGFydC5cbiAgICAgICAgICAgIHJldHVybiAob2xkVmFsdWUgPT09IDAgfHwgb2xkVmFsdWUgPT09IDEpICE9PSAobmV3VmFsdWUgPT09IDAgfHwgbmV3VmFsdWUgPT09IDEpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWZpbmVVbmlmb3JtKG5hbWUsIGdldFVuaWZvcm1GdW5jKTtcbn1cblxuZnVuY3Rpb24gX2RlZmluZU9iamVjdChuYW1lLCBnZXRVbmlmb3JtRnVuYykge1xuICAgIGRlZmluZVByb3Aoe1xuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBkZWZhdWx0VmFsdWU6IG51bGwsXG4gICAgICAgIGRpcnR5U2hhZGVyRnVuYzogKG9sZFZhbHVlLCBuZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuICEhb2xkVmFsdWUgPT09ICEhbmV3VmFsdWU7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlZmluZVVuaWZvcm0obmFtZSwgZ2V0VW5pZm9ybUZ1bmMpO1xufVxuXG5mdW5jdGlvbiBfZGVmaW5lRmxhZyhuYW1lLCBkZWZhdWx0VmFsdWUpIHtcbiAgICBkZWZpbmVQcm9wKHtcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgZGVmYXVsdFZhbHVlOiBkZWZhdWx0VmFsdWVcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gX2RlZmluZU1hdGVyaWFsUHJvcHMoKSB7XG4gICAgX2RlZmluZUNvbG9yKCdhbWJpZW50JywgbmV3IENvbG9yKDAuNywgMC43LCAwLjcpKTtcbiAgICBfZGVmaW5lQ29sb3IoJ2RpZmZ1c2UnLCBuZXcgQ29sb3IoMSwgMSwgMSkpO1xuICAgIF9kZWZpbmVDb2xvcignc3BlY3VsYXInLCBuZXcgQ29sb3IoMCwgMCwgMCkpO1xuICAgIF9kZWZpbmVDb2xvcignZW1pc3NpdmUnLCBuZXcgQ29sb3IoMCwgMCwgMCkpO1xuICAgIF9kZWZpbmVDb2xvcignc2hlZW4nLCBuZXcgQ29sb3IoMSwgMSwgMSkpO1xuICAgIF9kZWZpbmVDb2xvcignYXR0ZW51YXRpb24nLCBuZXcgQ29sb3IoMSwgMSwgMSkpO1xuICAgIF9kZWZpbmVGbG9hdCgnZW1pc3NpdmVJbnRlbnNpdHknLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ3NwZWN1bGFyaXR5RmFjdG9yJywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdzaGVlbkdsb3NzaW5lc3MnLCAwKTtcblxuICAgIF9kZWZpbmVGbG9hdCgnc2hpbmluZXNzJywgMjUsIChtYXRlcmlhbCwgZGV2aWNlLCBzY2VuZSkgPT4ge1xuICAgICAgICAvLyBTaGluaW5lc3MgaXMgMC0xMDAgdmFsdWUgd2hpY2ggaXMgYWN0dWFsbHkgYSAwLTEgZ2xvc3NpbmVzcyB2YWx1ZS5cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFsLnNoYWRpbmdNb2RlbCA9PT0gU1BFQ1VMQVJfUEhPTkcgP1xuICAgICAgICAgICAgLy8gbGVnYWN5OiBleHBhbmQgYmFjayB0byBzcGVjdWxhciBwb3dlclxuICAgICAgICAgICAgTWF0aC5wb3coMiwgbWF0ZXJpYWwuc2hpbmluZXNzICogMC4wMSAqIDExKSA6XG4gICAgICAgICAgICBtYXRlcmlhbC5zaGluaW5lc3MgKiAwLjAxO1xuICAgIH0pO1xuICAgIF9kZWZpbmVGbG9hdCgnaGVpZ2h0TWFwRmFjdG9yJywgMSwgKG1hdGVyaWFsLCBkZXZpY2UsIHNjZW5lKSA9PiB7XG4gICAgICAgIHJldHVybiBtYXRlcmlhbC5oZWlnaHRNYXBGYWN0b3IgKiAwLjAyNTtcbiAgICB9KTtcbiAgICBfZGVmaW5lRmxvYXQoJ29wYWNpdHknLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2FscGhhRmFkZScsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnYWxwaGFUZXN0JywgMCk7ICAgICAgIC8vIE5PVEU6IG92ZXJ3cml0ZXMgTWF0ZXJpYWwuYWxwaGFUZXN0XG4gICAgX2RlZmluZUZsb2F0KCdidW1waW5lc3MnLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ25vcm1hbERldGFpbE1hcEJ1bXBpbmVzcycsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgncmVmbGVjdGl2aXR5JywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdvY2NsdWRlU3BlY3VsYXJJbnRlbnNpdHknLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ3JlZnJhY3Rpb24nLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ3JlZnJhY3Rpb25JbmRleCcsIDEuMCAvIDEuNSk7IC8vIGFwcHJveC4gKGFpciBpb3IgLyBnbGFzcyBpb3IpXG4gICAgX2RlZmluZUZsb2F0KCd0aGlja25lc3MnLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2F0dGVudWF0aW9uRGlzdGFuY2UnLCAwKTtcbiAgICBfZGVmaW5lRmxvYXQoJ21ldGFsbmVzcycsIDEpO1xuICAgIF9kZWZpbmVGbG9hdCgnYW5pc290cm9weScsIDApO1xuICAgIF9kZWZpbmVGbG9hdCgnY2xlYXJDb2F0JywgMCk7XG4gICAgX2RlZmluZUZsb2F0KCdjbGVhckNvYXRHbG9zc2luZXNzJywgMSk7XG4gICAgX2RlZmluZUZsb2F0KCdjbGVhckNvYXRCdW1waW5lc3MnLCAxKTtcbiAgICBfZGVmaW5lRmxvYXQoJ2FvVXZTZXQnLCAwLCBudWxsKTsgLy8gbGVnYWN5XG5cbiAgICBfZGVmaW5lRmxvYXQoJ2lyaWRlc2NlbmNlJywgMCk7XG4gICAgX2RlZmluZUZsb2F0KCdpcmlkZXNjZW5jZVJlZnJhY3Rpb25JbmRleCcsIDEuMCAvIDEuNSk7XG4gICAgX2RlZmluZUZsb2F0KCdpcmlkZXNjZW5jZVRoaWNrbmVzc01pbicsIDApO1xuICAgIF9kZWZpbmVGbG9hdCgnaXJpZGVzY2VuY2VUaGlja25lc3NNYXgnLCAwKTtcblxuICAgIF9kZWZpbmVPYmplY3QoJ2FtYmllbnRTSCcpO1xuXG4gICAgX2RlZmluZU9iamVjdCgnY3ViZU1hcFByb2plY3Rpb25Cb3gnLCAobWF0ZXJpYWwsIGRldmljZSwgc2NlbmUpID0+IHtcbiAgICAgICAgY29uc3QgdW5pZm9ybSA9IG1hdGVyaWFsLl9hbGxvY1VuaWZvcm0oJ2N1YmVNYXBQcm9qZWN0aW9uQm94JywgKCkgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIFt7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2VudkJveE1pbicsXG4gICAgICAgICAgICAgICAgdmFsdWU6IG5ldyBGbG9hdDMyQXJyYXkoMylcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZW52Qm94TWF4JyxcbiAgICAgICAgICAgICAgICB2YWx1ZTogbmV3IEZsb2F0MzJBcnJheSgzKVxuICAgICAgICAgICAgfV07XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGJib3hNaW4gPSBtYXRlcmlhbC5jdWJlTWFwUHJvamVjdGlvbkJveC5nZXRNaW4oKTtcbiAgICAgICAgY29uc3QgbWluVW5pZm9ybSA9IHVuaWZvcm1bMF0udmFsdWU7XG4gICAgICAgIG1pblVuaWZvcm1bMF0gPSBiYm94TWluLng7XG4gICAgICAgIG1pblVuaWZvcm1bMV0gPSBiYm94TWluLnk7XG4gICAgICAgIG1pblVuaWZvcm1bMl0gPSBiYm94TWluLno7XG5cbiAgICAgICAgY29uc3QgYmJveE1heCA9IG1hdGVyaWFsLmN1YmVNYXBQcm9qZWN0aW9uQm94LmdldE1heCgpO1xuICAgICAgICBjb25zdCBtYXhVbmlmb3JtID0gdW5pZm9ybVsxXS52YWx1ZTtcbiAgICAgICAgbWF4VW5pZm9ybVswXSA9IGJib3hNYXgueDtcbiAgICAgICAgbWF4VW5pZm9ybVsxXSA9IGJib3hNYXgueTtcbiAgICAgICAgbWF4VW5pZm9ybVsyXSA9IGJib3hNYXguejtcblxuICAgICAgICByZXR1cm4gdW5pZm9ybTtcbiAgICB9KTtcblxuICAgIF9kZWZpbmVGbGFnKCdhbWJpZW50VGludCcsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnZGlmZnVzZVRpbnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3NwZWN1bGFyVGludCcsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnc3BlY3VsYXJpdHlGYWN0b3JUaW50JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdlbWlzc2l2ZVRpbnQnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2Zhc3RUYm4nLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZU1ldGFsbmVzcycsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlTWV0YWxuZXNzU3BlY3VsYXJDb2xvcicsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygndXNlU2hlZW4nLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2VuYWJsZUdHWFNwZWN1bGFyJywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdvY2NsdWRlRGlyZWN0JywgZmFsc2UpO1xuICAgIF9kZWZpbmVGbGFnKCdub3JtYWxpemVOb3JtYWxNYXAnLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygnY29uc2VydmVFbmVyZ3knLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygnb3BhY2l0eUZhZGVzU3BlY3VsYXInLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygnb2NjbHVkZVNwZWN1bGFyJywgU1BFQ09DQ19BTyk7XG4gICAgX2RlZmluZUZsYWcoJ3NoYWRpbmdNb2RlbCcsIFNQRUNVTEFSX0JMSU5OKTtcbiAgICBfZGVmaW5lRmxhZygnZnJlc25lbE1vZGVsJywgRlJFU05FTF9TQ0hMSUNLKTsgLy8gTk9URTogdGhpcyBoYXMgYmVlbiBtYWRlIHRvIG1hdGNoIHRoZSBkZWZhdWx0IHNoYWRpbmcgbW9kZWwgKHRvIGZpeCBhIGJ1ZylcbiAgICBfZGVmaW5lRmxhZygndXNlRHluYW1pY1JlZnJhY3Rpb24nLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ2N1YmVNYXBQcm9qZWN0aW9uJywgQ1VCRVBST0pfTk9ORSk7XG4gICAgX2RlZmluZUZsYWcoJ2N1c3RvbUZyYWdtZW50U2hhZGVyJywgbnVsbCk7XG4gICAgX2RlZmluZUZsYWcoJ2ZvcmNlRnJhZ21lbnRQcmVjaXNpb24nLCBudWxsKTtcbiAgICBfZGVmaW5lRmxhZygndXNlRm9nJywgdHJ1ZSk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZUxpZ2h0aW5nJywgdHJ1ZSk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZUdhbW1hVG9uZW1hcCcsIHRydWUpO1xuICAgIF9kZWZpbmVGbGFnKCd1c2VTa3lib3gnLCB0cnVlKTtcbiAgICBfZGVmaW5lRmxhZygnZm9yY2VVdjEnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3BpeGVsU25hcCcsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygndHdvU2lkZWRMaWdodGluZycsIGZhbHNlKTtcbiAgICBfZGVmaW5lRmxhZygnbmluZVNsaWNlZE1vZGUnLCB1bmRlZmluZWQpOyAvLyBOT1RFOiB0aGlzIHVzZWQgdG8gYmUgU1BSSVRFX1JFTkRFUk1PREVfU0xJQ0VEIGJ1dCB3YXMgdW5kZWZpbmVkIHByZS1Sb2xsdXBcbiAgICBfZGVmaW5lRmxhZygnbXNkZlRleHRBdHRyaWJ1dGUnLCBmYWxzZSk7XG4gICAgX2RlZmluZUZsYWcoJ3VzZUlyaWRlc2NlbmNlJywgZmFsc2UpO1xuXG4gICAgX2RlZmluZVRleDJEKCdkaWZmdXNlJywgMCwgMywgJycsIHRydWUpO1xuICAgIF9kZWZpbmVUZXgyRCgnc3BlY3VsYXInLCAwLCAzLCAnJywgdHJ1ZSk7XG4gICAgX2RlZmluZVRleDJEKCdlbWlzc2l2ZScsIDAsIDMsICcnLCB0cnVlKTtcbiAgICBfZGVmaW5lVGV4MkQoJ3RoaWNrbmVzcycsIDAsIDEsICcnLCB0cnVlKTtcbiAgICBfZGVmaW5lVGV4MkQoJ3NwZWN1bGFyaXR5RmFjdG9yJywgMCwgMSwgJycsIHRydWUpO1xuICAgIF9kZWZpbmVUZXgyRCgnbm9ybWFsJywgMCwgLTEsICcnLCBmYWxzZSk7XG4gICAgX2RlZmluZVRleDJEKCdtZXRhbG5lc3MnLCAwLCAxLCAnJywgdHJ1ZSk7XG4gICAgX2RlZmluZVRleDJEKCdnbG9zcycsIDAsIDEsICcnLCB0cnVlKTtcbiAgICBfZGVmaW5lVGV4MkQoJ29wYWNpdHknLCAwLCAxLCAnYScsIHRydWUpO1xuICAgIF9kZWZpbmVUZXgyRCgncmVmcmFjdGlvbicsIDAsIDEsICcnLCB0cnVlKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2hlaWdodCcsIDAsIDEsICcnLCBmYWxzZSk7XG4gICAgX2RlZmluZVRleDJEKCdhbycsIDAsIDEsICcnLCB0cnVlKTtcbiAgICBfZGVmaW5lVGV4MkQoJ2xpZ2h0JywgMSwgMywgJycsIHRydWUpO1xuICAgIF9kZWZpbmVUZXgyRCgnbXNkZicsIDAsIDMsICcnLCBmYWxzZSk7XG4gICAgX2RlZmluZVRleDJEKCdkaWZmdXNlRGV0YWlsJywgMCwgMywgJycsIGZhbHNlLCB0cnVlKTtcbiAgICBfZGVmaW5lVGV4MkQoJ25vcm1hbERldGFpbCcsIDAsIC0xLCAnJywgZmFsc2UpO1xuICAgIF9kZWZpbmVUZXgyRCgnY2xlYXJDb2F0JywgMCwgMSwgJycsIHRydWUpO1xuICAgIF9kZWZpbmVUZXgyRCgnY2xlYXJDb2F0R2xvc3MnLCAwLCAxLCAnJywgdHJ1ZSk7XG4gICAgX2RlZmluZVRleDJEKCdjbGVhckNvYXROb3JtYWwnLCAwLCAtMSwgJycsIGZhbHNlKTtcbiAgICBfZGVmaW5lVGV4MkQoJ3NoZWVuJywgMCwgMywgJycsIHRydWUpO1xuICAgIF9kZWZpbmVUZXgyRCgnc2hlZW5HbG9zcycsIDAsIDEsICcnLCB0cnVlKTtcblxuICAgIF9kZWZpbmVUZXgyRCgnaXJpZGVzY2VuY2UnLCAwLCAxLCAnJywgdHJ1ZSk7XG4gICAgX2RlZmluZVRleDJEKCdpcmlkZXNjZW5jZVRoaWNrbmVzcycsIDAsIDEsICcnLCB0cnVlKTtcblxuICAgIF9kZWZpbmVPYmplY3QoJ2N1YmVNYXAnKTtcbiAgICBfZGVmaW5lT2JqZWN0KCdzcGhlcmVNYXAnKTtcbiAgICBfZGVmaW5lT2JqZWN0KCdlbnZBdGxhcycpO1xuXG4gICAgLy8gcHJlZmlsdGVyZWQgY3ViZW1hcCBnZXR0ZXJcbiAgICBjb25zdCBnZXR0ZXJGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcztcbiAgICB9O1xuXG4gICAgLy8gcHJlZmlsdGVyZWQgY3ViZW1hcCBzZXR0ZXJcbiAgICBjb25zdCBzZXR0ZXJGdW5jID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGN1YmVtYXBzID0gdGhpcy5fcHJlZmlsdGVyZWRDdWJlbWFwcztcblxuICAgICAgICB2YWx1ZSA9IHZhbHVlIHx8IFtdO1xuXG4gICAgICAgIGxldCBjaGFuZ2VkID0gZmFsc2U7XG4gICAgICAgIGxldCBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCB2ID0gdmFsdWVbaV0gfHwgbnVsbDtcbiAgICAgICAgICAgIGlmIChjdWJlbWFwc1tpXSAhPT0gdikge1xuICAgICAgICAgICAgICAgIGN1YmVtYXBzW2ldID0gdjtcbiAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbXBsZXRlID0gY29tcGxldGUgJiYgKCEhY3ViZW1hcHNbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoYW5nZWQpIHtcbiAgICAgICAgICAgIGlmIChjb21wbGV0ZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW52QXRsYXMgPSBFbnZMaWdodGluZy5nZW5lcmF0ZVByZWZpbHRlcmVkQXRsYXMoY3ViZW1hcHMsIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLmVudkF0bGFzXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVudkF0bGFzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW52QXRsYXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVudkF0bGFzID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9kaXJ0eVNoYWRlciA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29uc3QgZW1wdHkgPSBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF07XG5cbiAgICBkZWZpbmVQcm9wSW50ZXJuYWwoJ3ByZWZpbHRlcmVkQ3ViZW1hcHMnLCAoKSA9PiBlbXB0eS5zbGljZSgpLCBzZXR0ZXJGdW5jLCBnZXR0ZXJGdW5jKTtcbn1cblxuX2RlZmluZU1hdGVyaWFsUHJvcHMoKTtcblxuZXhwb3J0IHsgU3RhbmRhcmRNYXRlcmlhbCB9O1xuIl0sIm5hbWVzIjpbIl9wcm9wcyIsIl91bmlmb3JtcyIsIl9wYXJhbXMiLCJTZXQiLCJTdGFuZGFyZE1hdGVyaWFsIiwiTWF0ZXJpYWwiLCJjb25zdHJ1Y3RvciIsIl9kaXJ0eVNoYWRlciIsIl9hc3NldFJlZmVyZW5jZXMiLCJfYWN0aXZlUGFyYW1zIiwiX2FjdGl2ZUxpZ2h0aW5nUGFyYW1zIiwic2hhZGVyT3B0QnVpbGRlciIsIlN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zQnVpbGRlciIsInJlc2V0IiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJuYW1lIiwidmFsdWUiLCJfY2h1bmtzIiwiX3VuaWZvcm1DYWNoZSIsInNoYWRlciIsIkRlYnVnIiwid2FybiIsImNodW5rcyIsImNvcHkiLCJzb3VyY2UiLCJrIiwicCIsImhhc093blByb3BlcnR5IiwiX3NldFBhcmFtZXRlciIsImFkZCIsInNldFBhcmFtZXRlciIsIl9zZXRQYXJhbWV0ZXJzIiwicGFyYW1ldGVycyIsInYiLCJfcHJvY2Vzc1BhcmFtZXRlcnMiLCJwYXJhbXNOYW1lIiwicHJldlBhcmFtcyIsInBhcmFtIiwiaGFzIiwiY2xlYXIiLCJfdXBkYXRlTWFwIiwibW5hbWUiLCJtYXAiLCJ0bmFtZSIsInVuaWZvcm0iLCJnZXRVbmlmb3JtIiwiX2FsbG9jVW5pZm9ybSIsImFsbG9jRnVuYyIsImRldmljZSIsInNjZW5lIiwidXBkYXRlVW5pZm9ybXMiLCJkaWZmdXNlTWFwIiwiZGlmZnVzZVRpbnQiLCJ1c2VNZXRhbG5lc3MiLCJzcGVjdWxhck1hcCIsInNwZWN1bGFyVGludCIsIm1ldGFsbmVzc01hcCIsIm1ldGFsbmVzcyIsInNwZWN1bGFyaXR5RmFjdG9yTWFwIiwic3BlY3VsYXJpdHlGYWN0b3JUaW50Iiwic3BlY3VsYXJpdHlGYWN0b3IiLCJzaGVlbk1hcCIsInNoZWVuVGludCIsInNoZWVuR2xvc3NpbmVzc01hcCIsInNoZWVuR2xvc3NpbmVzc1RpbnQiLCJzaGVlbkdsb3NzaW5lc3MiLCJyZWZyYWN0aW9uSW5kZXgiLCJvbmVPdmVyUmVmcmFjdGlvbkluZGV4IiwiZjAiLCJlbmFibGVHR1hTcGVjdWxhciIsImFuaXNvdHJvcHkiLCJjbGVhckNvYXQiLCJjbGVhckNvYXRHbG9zc2luZXNzIiwiY2xlYXJDb2F0QnVtcGluZXNzIiwiZW1pc3NpdmVNYXAiLCJlbWlzc2l2ZVRpbnQiLCJlbWlzc2l2ZUludGVuc2l0eSIsInJlZnJhY3Rpb24iLCJ1c2VEeW5hbWljUmVmcmFjdGlvbiIsInRoaWNrbmVzcyIsImF0dGVudWF0aW9uRGlzdGFuY2UiLCJ1c2VJcmlkZXNjZW5jZSIsImlyaWRlc2NlbmNlIiwiaXJpZGVzY2VuY2VSZWZyYWN0aW9uSW5kZXgiLCJpcmlkZXNjZW5jZVRoaWNrbmVzc01pbiIsImlyaWRlc2NlbmNlVGhpY2tuZXNzTWF4Iiwib3BhY2l0eSIsIm9wYWNpdHlGYWRlc1NwZWN1bGFyIiwiYWxwaGFGYWRlIiwib2NjbHVkZVNwZWN1bGFyIiwib2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5IiwiY3ViZU1hcFByb2plY3Rpb24iLCJDVUJFUFJPSl9CT1giLCJfbWF0VGV4MkQiLCJhbWJpZW50U0giLCJub3JtYWxNYXAiLCJidW1waW5lc3MiLCJub3JtYWxEZXRhaWxNYXAiLCJub3JtYWxEZXRhaWxNYXBCdW1waW5lc3MiLCJoZWlnaHRNYXAiLCJpc1Bob25nIiwic2hhZGluZ01vZGVsIiwiU1BFQ1VMQVJfUEhPTkciLCJlbnZBdGxhcyIsImN1YmVNYXAiLCJzcGhlcmVNYXAiLCJyZWZsZWN0aXZpdHkiLCJjbGVhclZhcmlhbnRzIiwidXBkYXRlRW52VW5pZm9ybXMiLCJoYXNMb2NhbEVudk92ZXJyaWRlIiwidXNlU2t5Ym94Iiwic2t5Ym94Iiwic2t5Ym94Um90YXRpb24iLCJlcXVhbHMiLCJRdWF0IiwiSURFTlRJVFkiLCJfc2t5Ym94Um90YXRpb25NYXQzIiwiZGF0YSIsImdldFNoYWRlclZhcmlhbnQiLCJvYmpEZWZzIiwic3RhdGljTGlnaHRMaXN0IiwicGFzcyIsInNvcnRlZExpZ2h0cyIsInZpZXdVbmlmb3JtRm9ybWF0Iiwidmlld0JpbmRHcm91cEZvcm1hdCIsIm1pbmltYWxPcHRpb25zIiwiU0hBREVSX0RFUFRIIiwiU0hBREVSX1BJQ0siLCJTaGFkZXJQYXNzIiwiaXNTaGFkb3ciLCJvcHRpb25zIiwic3RhbmRhcmQiLCJvcHRpb25zQ29udGV4dE1pbiIsIm9wdGlvbnNDb250ZXh0IiwidXBkYXRlTWluUmVmIiwidXBkYXRlUmVmIiwib25VcGRhdGVTaGFkZXIiLCJwcm9jZXNzaW5nT3B0aW9ucyIsIlNoYWRlclByb2Nlc3Nvck9wdGlvbnMiLCJsaWJyYXJ5IiwiZ2V0UHJvZ3JhbUxpYnJhcnkiLCJyZWdpc3RlciIsImdldFByb2dyYW0iLCJkZXN0cm95IiwiYXNzZXQiLCJfdW5iaW5kIiwiVEVYVFVSRV9QQVJBTUVURVJTIiwic3RhbmRhcmRNYXRlcmlhbFRleHR1cmVQYXJhbWV0ZXJzIiwiQ1VCRU1BUF9QQVJBTUVURVJTIiwic3RhbmRhcmRNYXRlcmlhbEN1YmVtYXBQYXJhbWV0ZXJzIiwiZGVmaW5lVW5pZm9ybSIsImdldFVuaWZvcm1GdW5jIiwiZGVmaW5lUHJvcEludGVybmFsIiwiY29uc3RydWN0b3JGdW5jIiwic2V0dGVyRnVuYyIsImdldHRlckZ1bmMiLCJkZWZpbmVQcm9wZXJ0eSIsInByb3RvdHlwZSIsImdldCIsInNldCIsImRlZmluZVZhbHVlUHJvcCIsInByb3AiLCJpbnRlcm5hbE5hbWUiLCJkaXJ0eVNoYWRlckZ1bmMiLCJvbGRWYWx1ZSIsImRlZmF1bHRWYWx1ZSIsImRlZmluZUFnZ1Byb3AiLCJjbG9uZSIsImRlZmluZVByb3AiLCJfZGVmaW5lVGV4MkQiLCJ1diIsImNoYW5uZWxzIiwiZGVmQ2hhbm5lbCIsInZlcnRleENvbG9yIiwiZGV0YWlsTW9kZSIsIm5ld1ZhbHVlIiwidHlwZSIsImZpeEN1YmVtYXBTZWFtcyIsImZvcm1hdCIsIlZlYzIiLCJERVRBSUxNT0RFX01VTCIsIm1hcFRpbGluZyIsIm1hcE9mZnNldCIsIm1hcFJvdGF0aW9uIiwibWFwVHJhbnNmb3JtIiwibWF0ZXJpYWwiLCJ0aWxpbmciLCJvZmZzZXQiLCJyb3RhdGlvbiIsIngiLCJ5IiwiRmxvYXQzMkFycmF5IiwiY3IiLCJNYXRoIiwiY29zIiwibWF0aCIsIkRFR19UT19SQUQiLCJzciIsInNpbiIsInVuaWZvcm0wIiwidW5pZm9ybTEiLCJfZGVmaW5lQ29sb3IiLCJjb2xvciIsImdhbW1hIiwidXNlR2FtbWFUb25lbWFwIiwiZ2FtbWFDb3JyZWN0aW9uIiwicG93IiwiciIsImciLCJiIiwiX2RlZmluZUZsb2F0IiwiX2RlZmluZU9iamVjdCIsIl9kZWZpbmVGbGFnIiwiX2RlZmluZU1hdGVyaWFsUHJvcHMiLCJDb2xvciIsInNoaW5pbmVzcyIsImhlaWdodE1hcEZhY3RvciIsImJib3hNaW4iLCJjdWJlTWFwUHJvamVjdGlvbkJveCIsImdldE1pbiIsIm1pblVuaWZvcm0iLCJ6IiwiYmJveE1heCIsImdldE1heCIsIm1heFVuaWZvcm0iLCJTUEVDT0NDX0FPIiwiU1BFQ1VMQVJfQkxJTk4iLCJGUkVTTkVMX1NDSExJQ0siLCJDVUJFUFJPSl9OT05FIiwidW5kZWZpbmVkIiwiX3ByZWZpbHRlcmVkQ3ViZW1hcHMiLCJjdWJlbWFwcyIsImNoYW5nZWQiLCJjb21wbGV0ZSIsImkiLCJFbnZMaWdodGluZyIsImdlbmVyYXRlUHJlZmlsdGVyZWRBdGxhcyIsInRhcmdldCIsImVtcHR5Iiwic2xpY2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE2QkEsTUFBTUEsTUFBTSxHQUFHLEVBQWYsQ0FBQTtBQUdBLE1BQU1DLFNBQVMsR0FBRyxFQUFsQixDQUFBOztBQUdBLElBQUlDLE9BQU8sR0FBRyxJQUFJQyxHQUFKLEVBQWQsQ0FBQTs7QUEwY0EsTUFBTUMsZ0JBQU4sU0FBK0JDLFFBQS9CLENBQXdDO0FBZ0NwQ0MsRUFBQUEsV0FBVyxHQUFHO0FBQ1YsSUFBQSxLQUFBLEVBQUEsQ0FBQTtJQUVBLElBQUtDLENBQUFBLFlBQUwsR0FBb0IsSUFBcEIsQ0FBQTtJQUdBLElBQUtDLENBQUFBLGdCQUFMLEdBQXdCLEVBQXhCLENBQUE7QUFFQSxJQUFBLElBQUEsQ0FBS0MsYUFBTCxHQUFxQixJQUFJTixHQUFKLEVBQXJCLENBQUE7QUFDQSxJQUFBLElBQUEsQ0FBS08scUJBQUwsR0FBNkIsSUFBSVAsR0FBSixFQUE3QixDQUFBO0FBRUEsSUFBQSxJQUFBLENBQUtRLGdCQUFMLEdBQXdCLElBQUlDLDhCQUFKLEVBQXhCLENBQUE7QUFFQSxJQUFBLElBQUEsQ0FBS0MsS0FBTCxFQUFBLENBQUE7QUFDSCxHQUFBOztBQUVEQSxFQUFBQSxLQUFLLEdBQUc7SUFFSkMsTUFBTSxDQUFDQyxJQUFQLENBQVlmLE1BQVosRUFBb0JnQixPQUFwQixDQUE2QkMsSUFBRCxJQUFVO01BQ2xDLElBQU0sQ0FBQSxDQUFBLENBQUEsRUFBR0EsSUFBSyxDQUFBLENBQWQsQ0FBbUJqQixHQUFBQSxNQUFNLENBQUNpQixJQUFELENBQU4sQ0FBYUMsS0FBYixFQUFuQixDQUFBO0tBREosQ0FBQSxDQUFBO0lBUUEsSUFBS0MsQ0FBQUEsT0FBTCxHQUFlLEVBQWYsQ0FBQTtJQUNBLElBQUtDLENBQUFBLGFBQUwsR0FBcUIsRUFBckIsQ0FBQTtBQUNILEdBQUE7O0VBRVMsSUFBTkMsTUFBTSxDQUFDQSxNQUFELEVBQVM7SUFDZkMsS0FBSyxDQUFDQyxJQUFOLENBQVcsOEVBQVgsQ0FBQSxDQUFBO0FBQ0gsR0FBQTs7QUFFUyxFQUFBLElBQU5GLE1BQU0sR0FBRztJQUNUQyxLQUFLLENBQUNDLElBQU4sQ0FBVyw4RUFBWCxDQUFBLENBQUE7QUFDQSxJQUFBLE9BQU8sSUFBUCxDQUFBO0FBQ0gsR0FBQTs7RUFPUyxJQUFOQyxNQUFNLENBQUNOLEtBQUQsRUFBUTtJQUNkLElBQUtYLENBQUFBLFlBQUwsR0FBb0IsSUFBcEIsQ0FBQTtJQUNBLElBQUtZLENBQUFBLE9BQUwsR0FBZUQsS0FBZixDQUFBO0FBQ0gsR0FBQTs7QUFFUyxFQUFBLElBQU5NLE1BQU0sR0FBRztJQUNULElBQUtqQixDQUFBQSxZQUFMLEdBQW9CLElBQXBCLENBQUE7QUFDQSxJQUFBLE9BQU8sS0FBS1ksT0FBWixDQUFBO0FBQ0gsR0FBQTs7RUFRRE0sSUFBSSxDQUFDQyxNQUFELEVBQVM7SUFDVCxLQUFNRCxDQUFBQSxJQUFOLENBQVdDLE1BQVgsQ0FBQSxDQUFBO0lBR0FaLE1BQU0sQ0FBQ0MsSUFBUCxDQUFZZixNQUFaLEVBQW9CZ0IsT0FBcEIsQ0FBNkJXLENBQUQsSUFBTztBQUMvQixNQUFBLElBQUEsQ0FBS0EsQ0FBTCxDQUFBLEdBQVVELE1BQU0sQ0FBQ0MsQ0FBRCxDQUFoQixDQUFBO0tBREosQ0FBQSxDQUFBOztBQUtBLElBQUEsS0FBSyxNQUFNQyxDQUFYLElBQWdCRixNQUFNLENBQUNQLE9BQXZCLEVBQWdDO0FBQzVCLE1BQUEsSUFBSU8sTUFBTSxDQUFDUCxPQUFQLENBQWVVLGNBQWYsQ0FBOEJELENBQTlCLENBQUosRUFDSSxLQUFLVCxPQUFMLENBQWFTLENBQWIsQ0FBa0JGLEdBQUFBLE1BQU0sQ0FBQ1AsT0FBUCxDQUFlUyxDQUFmLENBQWxCLENBQUE7QUFDUCxLQUFBOztBQUVELElBQUEsT0FBTyxJQUFQLENBQUE7QUFDSCxHQUFBOztBQUVERSxFQUFBQSxhQUFhLENBQUNiLElBQUQsRUFBT0MsS0FBUCxFQUFjO0lBQ3ZCaEIsT0FBTyxDQUFDNkIsR0FBUixDQUFZZCxJQUFaLENBQUEsQ0FBQTs7QUFDQSxJQUFBLElBQUEsQ0FBS2UsWUFBTCxDQUFrQmYsSUFBbEIsRUFBd0JDLEtBQXhCLENBQUEsQ0FBQTtBQUNILEdBQUE7O0VBRURlLGNBQWMsQ0FBQ0MsVUFBRCxFQUFhO0FBQ3ZCQSxJQUFBQSxVQUFVLENBQUNsQixPQUFYLENBQW9CbUIsQ0FBRCxJQUFPO01BQ3RCLElBQUtMLENBQUFBLGFBQUwsQ0FBbUJLLENBQUMsQ0FBQ2xCLElBQXJCLEVBQTJCa0IsQ0FBQyxDQUFDakIsS0FBN0IsQ0FBQSxDQUFBO0tBREosQ0FBQSxDQUFBO0FBR0gsR0FBQTs7RUFFRGtCLGtCQUFrQixDQUFDQyxVQUFELEVBQWE7QUFDM0IsSUFBQSxNQUFNQyxVQUFVLEdBQUcsSUFBS0QsQ0FBQUEsVUFBTCxDQUFuQixDQUFBO0FBQ0FDLElBQUFBLFVBQVUsQ0FBQ3RCLE9BQVgsQ0FBb0J1QixLQUFELElBQVc7QUFDMUIsTUFBQSxJQUFJLENBQUNyQyxPQUFPLENBQUNzQyxHQUFSLENBQVlELEtBQVosQ0FBTCxFQUF5QjtBQUNyQixRQUFBLE9BQU8sSUFBS0wsQ0FBQUEsVUFBTCxDQUFnQkssS0FBaEIsQ0FBUCxDQUFBO0FBQ0gsT0FBQTtLQUhMLENBQUEsQ0FBQTtJQU1BLElBQUtGLENBQUFBLFVBQUwsSUFBbUJuQyxPQUFuQixDQUFBO0FBQ0FBLElBQUFBLE9BQU8sR0FBR29DLFVBQVYsQ0FBQTs7QUFDQXBDLElBQUFBLE9BQU8sQ0FBQ3VDLEtBQVIsRUFBQSxDQUFBO0FBQ0gsR0FBQTs7RUFFREMsVUFBVSxDQUFDZCxDQUFELEVBQUk7QUFDVixJQUFBLE1BQU1lLEtBQUssR0FBR2YsQ0FBQyxHQUFHLEtBQWxCLENBQUE7QUFDQSxJQUFBLE1BQU1nQixHQUFHLEdBQUcsSUFBS0QsQ0FBQUEsS0FBTCxDQUFaLENBQUE7O0FBQ0EsSUFBQSxJQUFJQyxHQUFKLEVBQVM7QUFDTCxNQUFBLElBQUEsQ0FBS2QsYUFBTCxDQUFtQixVQUFhYSxHQUFBQSxLQUFoQyxFQUF1Q0MsR0FBdkMsQ0FBQSxDQUFBOztBQUVBLE1BQUEsTUFBTUMsS0FBSyxHQUFHRixLQUFLLEdBQUcsV0FBdEIsQ0FBQTtBQUNBLE1BQUEsTUFBTUcsT0FBTyxHQUFHLElBQUEsQ0FBS0MsVUFBTCxDQUFnQkYsS0FBaEIsQ0FBaEIsQ0FBQTs7QUFDQSxNQUFBLElBQUlDLE9BQUosRUFBYTtRQUNULElBQUtiLENBQUFBLGNBQUwsQ0FBb0JhLE9BQXBCLENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTs7QUFHREUsRUFBQUEsYUFBYSxDQUFDL0IsSUFBRCxFQUFPZ0MsU0FBUCxFQUFrQjtBQUMzQixJQUFBLElBQUlILE9BQU8sR0FBRyxJQUFBLENBQUsxQixhQUFMLENBQW1CSCxJQUFuQixDQUFkLENBQUE7O0lBQ0EsSUFBSSxDQUFDNkIsT0FBTCxFQUFjO01BQ1ZBLE9BQU8sR0FBR0csU0FBUyxFQUFuQixDQUFBO0FBQ0EsTUFBQSxJQUFBLENBQUs3QixhQUFMLENBQW1CSCxJQUFuQixDQUFBLEdBQTJCNkIsT0FBM0IsQ0FBQTtBQUNILEtBQUE7O0FBQ0QsSUFBQSxPQUFPQSxPQUFQLENBQUE7QUFDSCxHQUFBOztBQUVEQyxFQUFBQSxVQUFVLENBQUM5QixJQUFELEVBQU9pQyxNQUFQLEVBQWVDLEtBQWYsRUFBc0I7SUFDNUIsT0FBT2xELFNBQVMsQ0FBQ2dCLElBQUQsQ0FBVCxDQUFnQixJQUFoQixFQUFzQmlDLE1BQXRCLEVBQThCQyxLQUE5QixDQUFQLENBQUE7QUFDSCxHQUFBOztBQUVEQyxFQUFBQSxjQUFjLENBQUNGLE1BQUQsRUFBU0MsS0FBVCxFQUFnQjtJQUMxQixNQUFNSixVQUFVLEdBQUk5QixJQUFELElBQVU7TUFDekIsT0FBTyxJQUFBLENBQUs4QixVQUFMLENBQWdCOUIsSUFBaEIsRUFBc0JpQyxNQUF0QixFQUE4QkMsS0FBOUIsQ0FBUCxDQUFBO0tBREosQ0FBQTs7QUFJQSxJQUFBLElBQUEsQ0FBS3JCLGFBQUwsQ0FBbUIsa0JBQW5CLEVBQXVDaUIsVUFBVSxDQUFDLFNBQUQsQ0FBakQsQ0FBQSxDQUFBOztBQUVBLElBQUEsSUFBSSxDQUFDLElBQUtNLENBQUFBLFVBQU4sSUFBb0IsSUFBQSxDQUFLQyxXQUE3QixFQUEwQztBQUN0QyxNQUFBLElBQUEsQ0FBS3hCLGFBQUwsQ0FBbUIsa0JBQW5CLEVBQXVDaUIsVUFBVSxDQUFDLFNBQUQsQ0FBakQsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFJLENBQUMsSUFBS1EsQ0FBQUEsWUFBVixFQUF3QjtBQUNwQixNQUFBLElBQUksQ0FBQyxJQUFLQyxDQUFBQSxXQUFOLElBQXFCLElBQUEsQ0FBS0MsWUFBOUIsRUFBNEM7QUFDeEMsUUFBQSxJQUFBLENBQUszQixhQUFMLENBQW1CLG1CQUFuQixFQUF3Q2lCLFVBQVUsQ0FBQyxVQUFELENBQWxELENBQUEsQ0FBQTtBQUNILE9BQUE7QUFDSixLQUpELE1BSU87TUFDSCxJQUFJLENBQUMsS0FBS1csWUFBTixJQUFzQixLQUFLQyxTQUFMLEdBQWlCLENBQTNDLEVBQThDO0FBQzFDLFFBQUEsSUFBQSxDQUFLN0IsYUFBTCxDQUFtQixvQkFBbkIsRUFBeUMsS0FBSzZCLFNBQTlDLENBQUEsQ0FBQTtBQUNILE9BQUE7O0FBQ0QsTUFBQSxJQUFJLENBQUMsSUFBS0gsQ0FBQUEsV0FBTixJQUFxQixJQUFBLENBQUtDLFlBQTlCLEVBQTRDO0FBQ3hDLFFBQUEsSUFBQSxDQUFLM0IsYUFBTCxDQUFtQixtQkFBbkIsRUFBd0NpQixVQUFVLENBQUMsVUFBRCxDQUFsRCxDQUFBLENBQUE7QUFDSCxPQUFBOztBQUNELE1BQUEsSUFBSSxDQUFDLElBQUthLENBQUFBLG9CQUFOLElBQThCLElBQUEsQ0FBS0MscUJBQXZDLEVBQThEO0FBQzFELFFBQUEsSUFBQSxDQUFLL0IsYUFBTCxDQUFtQiw0QkFBbkIsRUFBaUQsS0FBS2dDLGlCQUF0RCxDQUFBLENBQUE7QUFDSCxPQUFBOztBQUNELE1BQUEsSUFBSSxDQUFDLElBQUtDLENBQUFBLFFBQU4sSUFBa0IsSUFBQSxDQUFLQyxTQUEzQixFQUFzQztBQUNsQyxRQUFBLElBQUEsQ0FBS2xDLGFBQUwsQ0FBbUIsZ0JBQW5CLEVBQXFDaUIsVUFBVSxDQUFDLE9BQUQsQ0FBL0MsQ0FBQSxDQUFBO0FBQ0gsT0FBQTs7QUFDRCxNQUFBLElBQUksQ0FBQyxJQUFLa0IsQ0FBQUEsa0JBQU4sSUFBNEIsSUFBQSxDQUFLQyxtQkFBckMsRUFBMEQ7QUFDdEQsUUFBQSxJQUFBLENBQUtwQyxhQUFMLENBQW1CLDBCQUFuQixFQUErQyxLQUFLcUMsZUFBcEQsQ0FBQSxDQUFBO0FBQ0gsT0FBQTs7QUFFRCxNQUFBLElBQUksSUFBS0MsQ0FBQUEsZUFBTCxHQUF1QixHQUEzQixFQUFnQztBQUM1QixRQUFBLE1BQU1DLHNCQUFzQixHQUFHLEdBQU0sR0FBQSxJQUFBLENBQUtELGVBQTFDLENBQUE7UUFDQSxNQUFNRSxFQUFFLEdBQUcsQ0FBQ0Qsc0JBQXNCLEdBQUcsQ0FBMUIsS0FBZ0NBLHNCQUFzQixHQUFHLENBQXpELENBQVgsQ0FBQTs7QUFDQSxRQUFBLElBQUEsQ0FBS3ZDLGFBQUwsQ0FBbUIsYUFBbkIsRUFBa0N3QyxFQUFFLEdBQUdBLEVBQXZDLENBQUEsQ0FBQTtBQUNILE9BSkQsTUFJTztBQUNILFFBQUEsSUFBQSxDQUFLeEMsYUFBTCxDQUFtQixhQUFuQixFQUFrQyxHQUFsQyxDQUFBLENBQUE7QUFDSCxPQUFBO0FBRUosS0FBQTs7SUFFRCxJQUFJLElBQUEsQ0FBS3lDLGlCQUFULEVBQTRCO0FBQ3hCLE1BQUEsSUFBQSxDQUFLekMsYUFBTCxDQUFtQixxQkFBbkIsRUFBMEMsS0FBSzBDLFVBQS9DLENBQUEsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxJQUFJLElBQUtDLENBQUFBLFNBQUwsR0FBaUIsQ0FBckIsRUFBd0I7QUFDcEIsTUFBQSxJQUFBLENBQUszQyxhQUFMLENBQW1CLG9CQUFuQixFQUF5QyxLQUFLMkMsU0FBOUMsQ0FBQSxDQUFBOztBQUNBLE1BQUEsSUFBQSxDQUFLM0MsYUFBTCxDQUFtQiw4QkFBbkIsRUFBbUQsS0FBSzRDLG1CQUF4RCxDQUFBLENBQUE7O0FBQ0EsTUFBQSxJQUFBLENBQUs1QyxhQUFMLENBQW1CLDZCQUFuQixFQUFrRCxLQUFLNkMsa0JBQXZELENBQUEsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxJQUFBLENBQUs3QyxhQUFMLENBQW1CLG9CQUFuQixFQUF5Q2lCLFVBQVUsQ0FBQyxXQUFELENBQW5ELENBQUEsQ0FBQTs7QUFFQSxJQUFBLElBQUksQ0FBQyxJQUFLNkIsQ0FBQUEsV0FBTixJQUFxQixJQUFBLENBQUtDLFlBQTlCLEVBQTRDO0FBQ3hDLE1BQUEsSUFBQSxDQUFLL0MsYUFBTCxDQUFtQixtQkFBbkIsRUFBd0NpQixVQUFVLENBQUMsVUFBRCxDQUFsRCxDQUFBLENBQUE7QUFDSCxLQUFBOztBQUNELElBQUEsSUFBSSxJQUFLK0IsQ0FBQUEsaUJBQUwsS0FBMkIsQ0FBL0IsRUFBa0M7QUFDOUIsTUFBQSxJQUFBLENBQUtoRCxhQUFMLENBQW1CLDRCQUFuQixFQUFpRCxLQUFLZ0QsaUJBQXRELENBQUEsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxJQUFJLElBQUtDLENBQUFBLFVBQUwsR0FBa0IsQ0FBdEIsRUFBeUI7QUFDckIsTUFBQSxJQUFBLENBQUtqRCxhQUFMLENBQW1CLHFCQUFuQixFQUEwQyxLQUFLaUQsVUFBL0MsQ0FBQSxDQUFBOztBQUNBLE1BQUEsSUFBQSxDQUFLakQsYUFBTCxDQUFtQiwwQkFBbkIsRUFBK0MsS0FBS3NDLGVBQXBELENBQUEsQ0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBSSxJQUFBLENBQUtZLG9CQUFULEVBQStCO0FBQzNCLE1BQUEsSUFBQSxDQUFLbEQsYUFBTCxDQUFtQixvQkFBbkIsRUFBeUMsS0FBS21ELFNBQTlDLENBQUEsQ0FBQTs7QUFDQSxNQUFBLElBQUEsQ0FBS25ELGFBQUwsQ0FBbUIsc0JBQW5CLEVBQTJDaUIsVUFBVSxDQUFDLGFBQUQsQ0FBckQsQ0FBQSxDQUFBOztBQUNBLE1BQUEsSUFBQSxDQUFLakIsYUFBTCxDQUFtQixpQ0FBbkIsRUFBc0QsSUFBS29ELENBQUFBLG1CQUFMLEtBQTZCLENBQTdCLEdBQWlDLENBQWpDLEdBQXFDLEdBQUEsR0FBTSxLQUFLQSxtQkFBdEcsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFJLElBQUEsQ0FBS0MsY0FBVCxFQUF5QjtBQUNyQixNQUFBLElBQUEsQ0FBS3JELGFBQUwsQ0FBbUIsc0JBQW5CLEVBQTJDLEtBQUtzRCxXQUFoRCxDQUFBLENBQUE7O0FBQ0EsTUFBQSxJQUFBLENBQUt0RCxhQUFMLENBQW1CLHFDQUFuQixFQUEwRCxLQUFLdUQsMEJBQS9ELENBQUEsQ0FBQTs7QUFDQSxNQUFBLElBQUEsQ0FBS3ZELGFBQUwsQ0FBbUIsa0NBQW5CLEVBQXVELEtBQUt3RCx1QkFBNUQsQ0FBQSxDQUFBOztBQUNBLE1BQUEsSUFBQSxDQUFLeEQsYUFBTCxDQUFtQixrQ0FBbkIsRUFBdUQsS0FBS3lELHVCQUE1RCxDQUFBLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsSUFBQSxDQUFLekQsYUFBTCxDQUFtQixrQkFBbkIsRUFBdUMsS0FBSzBELE9BQTVDLENBQUEsQ0FBQTs7QUFFQSxJQUFBLElBQUksSUFBS0MsQ0FBQUEsb0JBQUwsS0FBOEIsS0FBbEMsRUFBeUM7QUFDckMsTUFBQSxJQUFBLENBQUszRCxhQUFMLENBQW1CLG9CQUFuQixFQUF5QyxLQUFLNEQsU0FBOUMsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7SUFFRCxJQUFJLElBQUEsQ0FBS0MsZUFBVCxFQUEwQjtBQUN0QixNQUFBLElBQUEsQ0FBSzdELGFBQUwsQ0FBbUIsbUNBQW5CLEVBQXdELEtBQUs4RCx3QkFBN0QsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLElBQUksSUFBS0MsQ0FBQUEsaUJBQUwsS0FBMkJDLFlBQS9CLEVBQTZDO0FBQ3pDLE1BQUEsSUFBQSxDQUFLaEUsYUFBTCxDQUFtQmlCLFVBQVUsQ0FBQyxzQkFBRCxDQUE3QixDQUFBLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsS0FBSyxNQUFNbkIsQ0FBWCxJQUFnQm1FLFNBQWhCLEVBQTJCO01BQ3ZCLElBQUtyRCxDQUFBQSxVQUFMLENBQWdCZCxDQUFoQixDQUFBLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUksSUFBQSxDQUFLb0UsU0FBVCxFQUFvQjtBQUNoQixNQUFBLElBQUEsQ0FBS2xFLGFBQUwsQ0FBbUIsY0FBbkIsRUFBbUMsS0FBS2tFLFNBQXhDLENBQUEsQ0FBQTtBQUNILEtBQUE7O0lBRUQsSUFBSSxJQUFBLENBQUtDLFNBQVQsRUFBb0I7QUFDaEIsTUFBQSxJQUFBLENBQUtuRSxhQUFMLENBQW1CLG9CQUFuQixFQUF5QyxLQUFLb0UsU0FBOUMsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLElBQUksSUFBS0QsQ0FBQUEsU0FBTCxJQUFrQixJQUFBLENBQUtFLGVBQTNCLEVBQTRDO0FBQ3hDLE1BQUEsSUFBQSxDQUFLckUsYUFBTCxDQUFtQixtQ0FBbkIsRUFBd0QsS0FBS3NFLHdCQUE3RCxDQUFBLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUksSUFBQSxDQUFLQyxTQUFULEVBQW9CO0FBQ2hCLE1BQUEsSUFBQSxDQUFLdkUsYUFBTCxDQUFtQiwwQkFBbkIsRUFBK0NpQixVQUFVLENBQUMsaUJBQUQsQ0FBekQsQ0FBQSxDQUFBO0FBQ0gsS0FBQTs7QUFFRCxJQUFBLE1BQU11RCxPQUFPLEdBQUcsSUFBS0MsQ0FBQUEsWUFBTCxLQUFzQkMsY0FBdEMsQ0FBQTs7SUFHQSxJQUFJLElBQUEsQ0FBS0MsUUFBTCxJQUFpQixJQUFBLENBQUtDLE9BQXRCLElBQWlDLENBQUNKLE9BQXRDLEVBQStDO0FBQzNDLE1BQUEsSUFBQSxDQUFLeEUsYUFBTCxDQUFtQixrQkFBbkIsRUFBdUMsS0FBSzJFLFFBQTVDLENBQUEsQ0FBQTs7QUFDQSxNQUFBLElBQUEsQ0FBSzNFLGFBQUwsQ0FBbUIsaUJBQW5CLEVBQXNDLEtBQUs0RSxPQUEzQyxDQUFBLENBQUE7QUFDSCxLQUhELE1BR08sSUFBSSxJQUFBLENBQUtELFFBQUwsSUFBaUIsQ0FBQ0gsT0FBdEIsRUFBK0I7QUFDbEMsTUFBQSxJQUFBLENBQUt4RSxhQUFMLENBQW1CLGtCQUFuQixFQUF1QyxLQUFLMkUsUUFBNUMsQ0FBQSxDQUFBO0FBQ0gsS0FGTSxNQUVBLElBQUksSUFBS0MsQ0FBQUEsT0FBVCxFQUFrQjtBQUNyQixNQUFBLElBQUEsQ0FBSzVFLGFBQUwsQ0FBbUIsaUJBQW5CLEVBQXNDLEtBQUs0RSxPQUEzQyxDQUFBLENBQUE7QUFDSCxLQUZNLE1BRUEsSUFBSSxJQUFLQyxDQUFBQSxTQUFULEVBQW9CO0FBQ3ZCLE1BQUEsSUFBQSxDQUFLN0UsYUFBTCxDQUFtQixtQkFBbkIsRUFBd0MsS0FBSzZFLFNBQTdDLENBQUEsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxJQUFBLENBQUs3RSxhQUFMLENBQW1CLHVCQUFuQixFQUE0QyxLQUFLOEUsWUFBakQsQ0FBQSxDQUFBOztJQUdBLElBQUt4RSxDQUFBQSxrQkFBTCxDQUF3QixlQUF4QixDQUFBLENBQUE7O0lBRUEsSUFBSSxJQUFBLENBQUs3QixZQUFULEVBQXVCO0FBQ25CLE1BQUEsSUFBQSxDQUFLc0csYUFBTCxFQUFBLENBQUE7QUFDSCxLQUFBO0FBQ0osR0FBQTs7QUFFREMsRUFBQUEsaUJBQWlCLENBQUM1RCxNQUFELEVBQVNDLEtBQVQsRUFBZ0I7QUFDN0IsSUFBQSxNQUFNbUQsT0FBTyxHQUFHLElBQUtDLENBQUFBLFlBQUwsS0FBc0JDLGNBQXRDLENBQUE7QUFDQSxJQUFBLE1BQU1PLG1CQUFtQixHQUFJLElBQUtOLENBQUFBLFFBQUwsSUFBaUIsQ0FBQ0gsT0FBbkIsSUFBK0IsSUFBS0ksQ0FBQUEsT0FBcEMsSUFBK0MsSUFBQSxDQUFLQyxTQUFoRixDQUFBOztBQUVBLElBQUEsSUFBSSxDQUFDSSxtQkFBRCxJQUF3QixJQUFBLENBQUtDLFNBQWpDLEVBQTRDO01BQ3hDLElBQUk3RCxLQUFLLENBQUNzRCxRQUFOLElBQWtCdEQsS0FBSyxDQUFDOEQsTUFBeEIsSUFBa0MsQ0FBQ1gsT0FBdkMsRUFBZ0Q7QUFDNUMsUUFBQSxJQUFBLENBQUt4RSxhQUFMLENBQW1CLGtCQUFuQixFQUF1Q3FCLEtBQUssQ0FBQ3NELFFBQTdDLENBQUEsQ0FBQTs7QUFDQSxRQUFBLElBQUEsQ0FBSzNFLGFBQUwsQ0FBbUIsaUJBQW5CLEVBQXNDcUIsS0FBSyxDQUFDOEQsTUFBNUMsQ0FBQSxDQUFBO09BRkosTUFHTyxJQUFJOUQsS0FBSyxDQUFDc0QsUUFBTixJQUFrQixDQUFDSCxPQUF2QixFQUFnQztBQUNuQyxRQUFBLElBQUEsQ0FBS3hFLGFBQUwsQ0FBbUIsa0JBQW5CLEVBQXVDcUIsS0FBSyxDQUFDc0QsUUFBN0MsQ0FBQSxDQUFBO0FBQ0gsT0FGTSxNQUVBLElBQUl0RCxLQUFLLENBQUM4RCxNQUFWLEVBQWtCO0FBQ3JCLFFBQUEsSUFBQSxDQUFLbkYsYUFBTCxDQUFtQixpQkFBbkIsRUFBc0NxQixLQUFLLENBQUM4RCxNQUE1QyxDQUFBLENBQUE7QUFDSCxPQUFBOztBQUVELE1BQUEsSUFBSSxDQUFDOUQsS0FBSyxDQUFDK0QsY0FBTixDQUFxQkMsTUFBckIsQ0FBNEJDLElBQUksQ0FBQ0MsUUFBakMsQ0FBRCxJQUErQ2xFLEtBQUssQ0FBQ21FLG1CQUF6RCxFQUE4RTtRQUMxRSxJQUFLeEYsQ0FBQUEsYUFBTCxDQUFtQix1QkFBbkIsRUFBNENxQixLQUFLLENBQUNtRSxtQkFBTixDQUEwQkMsSUFBdEUsQ0FBQSxDQUFBO0FBQ0gsT0FBQTtBQUNKLEtBQUE7O0lBRUQsSUFBS25GLENBQUFBLGtCQUFMLENBQXdCLHVCQUF4QixDQUFBLENBQUE7QUFDSCxHQUFBOztBQUVEb0YsRUFBQUEsZ0JBQWdCLENBQUN0RSxNQUFELEVBQVNDLEtBQVQsRUFBZ0JzRSxPQUFoQixFQUF5QkMsZUFBekIsRUFBMENDLElBQTFDLEVBQWdEQyxZQUFoRCxFQUE4REMsaUJBQTlELEVBQWlGQyxtQkFBakYsRUFBc0c7QUFHbEgsSUFBQSxJQUFBLENBQUtoQixpQkFBTCxDQUF1QjVELE1BQXZCLEVBQStCQyxLQUEvQixDQUFBLENBQUE7QUFHQSxJQUFBLE1BQU00RSxjQUFjLEdBQUdKLElBQUksS0FBS0ssWUFBVCxJQUF5QkwsSUFBSSxLQUFLTSxXQUFsQyxJQUFpREMsVUFBVSxDQUFDQyxRQUFYLENBQW9CUixJQUFwQixDQUF4RSxDQUFBO0lBQ0EsSUFBSVMsT0FBTyxHQUFHTCxjQUFjLEdBQUdNLFFBQVEsQ0FBQ0MsaUJBQVosR0FBZ0NELFFBQVEsQ0FBQ0UsY0FBckUsQ0FBQTtBQUVBLElBQUEsSUFBSVIsY0FBSixFQUNJLElBQUEsQ0FBS3BILGdCQUFMLENBQXNCNkgsWUFBdEIsQ0FBbUNKLE9BQW5DLEVBQTRDakYsS0FBNUMsRUFBbUQsSUFBbkQsRUFBeURzRSxPQUF6RCxFQUFrRUMsZUFBbEUsRUFBbUZDLElBQW5GLEVBQXlGQyxZQUF6RixDQUFBLENBREosS0FHSSxJQUFLakgsQ0FBQUEsZ0JBQUwsQ0FBc0I4SCxTQUF0QixDQUFnQ0wsT0FBaEMsRUFBeUNqRixLQUF6QyxFQUFnRCxJQUFoRCxFQUFzRHNFLE9BQXRELEVBQStEQyxlQUEvRCxFQUFnRkMsSUFBaEYsRUFBc0ZDLFlBQXRGLENBQUEsQ0FBQTs7SUFHSixJQUFJLElBQUEsQ0FBS2MsY0FBVCxFQUF5QjtBQUNyQk4sTUFBQUEsT0FBTyxHQUFHLElBQUEsQ0FBS00sY0FBTCxDQUFvQk4sT0FBcEIsQ0FBVixDQUFBO0FBQ0gsS0FBQTs7SUFFRCxNQUFNTyxpQkFBaUIsR0FBRyxJQUFJQyxzQkFBSixDQUEyQmYsaUJBQTNCLEVBQThDQyxtQkFBOUMsQ0FBMUIsQ0FBQTtBQUVBLElBQUEsTUFBTWUsT0FBTyxHQUFHM0YsTUFBTSxDQUFDNEYsaUJBQVAsRUFBaEIsQ0FBQTtBQUNBRCxJQUFBQSxPQUFPLENBQUNFLFFBQVIsQ0FBaUIsVUFBakIsRUFBNkJWLFFBQTdCLENBQUEsQ0FBQTtJQUNBLE1BQU1oSCxNQUFNLEdBQUd3SCxPQUFPLENBQUNHLFVBQVIsQ0FBbUIsVUFBbkIsRUFBK0JaLE9BQS9CLEVBQXdDTyxpQkFBeEMsQ0FBZixDQUFBO0lBRUEsSUFBS3BJLENBQUFBLFlBQUwsR0FBb0IsS0FBcEIsQ0FBQTtBQUNBLElBQUEsT0FBT2MsTUFBUCxDQUFBO0FBQ0gsR0FBQTs7QUFNRDRILEVBQUFBLE9BQU8sR0FBRztBQUVOLElBQUEsS0FBSyxNQUFNQyxLQUFYLElBQW9CLElBQUEsQ0FBSzFJLGdCQUF6QixFQUEyQztBQUN2QyxNQUFBLElBQUEsQ0FBS0EsZ0JBQUwsQ0FBc0IwSSxLQUF0QixDQUFBLENBQTZCQyxPQUE3QixFQUFBLENBQUE7QUFDSCxLQUFBOztJQUNELElBQUszSSxDQUFBQSxnQkFBTCxHQUF3QixJQUF4QixDQUFBO0FBRUEsSUFBQSxLQUFBLENBQU15SSxPQUFOLEVBQUEsQ0FBQTtBQUNILEdBQUE7O0FBeldtQyxDQUFBOztBQUFsQzdJLGlCQUNLZ0oscUJBQXFCQztBQUQxQmpKLGlCQUdLa0oscUJBQXFCQzs7QUEwV2hDLE1BQU1DLGFBQWEsR0FBRyxDQUFDdkksSUFBRCxFQUFPd0ksY0FBUCxLQUEwQjtBQUM1Q3hKLEVBQUFBLFNBQVMsQ0FBQ2dCLElBQUQsQ0FBVCxHQUFrQndJLGNBQWxCLENBQUE7QUFDSCxDQUZELENBQUE7O0FBSUEsTUFBTUMsa0JBQWtCLEdBQUcsQ0FBQ3pJLElBQUQsRUFBTzBJLGVBQVAsRUFBd0JDLFVBQXhCLEVBQW9DQyxVQUFwQyxLQUFtRDtFQUMxRS9JLE1BQU0sQ0FBQ2dKLGNBQVAsQ0FBc0IxSixnQkFBZ0IsQ0FBQzJKLFNBQXZDLEVBQWtEOUksSUFBbEQsRUFBd0Q7SUFDcEQrSSxHQUFHLEVBQUVILFVBQVUsSUFBSSxZQUFZO0FBQzNCLE1BQUEsT0FBTyxJQUFNLENBQUEsQ0FBQSxDQUFBLEVBQUc1SSxJQUFLLENBQUEsQ0FBZCxDQUFQLENBQUE7S0FGZ0Q7QUFJcERnSixJQUFBQSxHQUFHLEVBQUVMLFVBQUFBO0dBSlQsQ0FBQSxDQUFBO0VBT0E1SixNQUFNLENBQUNpQixJQUFELENBQU4sR0FBZTtBQUNYQyxJQUFBQSxLQUFLLEVBQUV5SSxlQUFBQTtHQURYLENBQUE7QUFHSCxDQVhELENBQUE7O0FBY0EsTUFBTU8sZUFBZSxHQUFJQyxJQUFELElBQVU7QUFDOUIsRUFBQSxNQUFNQyxZQUFZLEdBQUksQ0FBQSxDQUFBLEVBQUdELElBQUksQ0FBQ2xKLElBQUssQ0FBbkMsQ0FBQSxDQUFBOztFQUNBLE1BQU1vSixlQUFlLEdBQUdGLElBQUksQ0FBQ0UsZUFBTCxLQUF5QixNQUFNLElBQS9CLENBQXhCLENBQUE7O0FBRUEsRUFBQSxNQUFNVCxVQUFVLEdBQUcsU0FBYkEsVUFBYSxDQUFVMUksS0FBVixFQUFpQjtBQUNoQyxJQUFBLE1BQU1vSixRQUFRLEdBQUcsSUFBS0YsQ0FBQUEsWUFBTCxDQUFqQixDQUFBOztJQUNBLElBQUlFLFFBQVEsS0FBS3BKLEtBQWpCLEVBQXdCO01BQ3BCLElBQUtYLENBQUFBLFlBQUwsR0FBb0IsSUFBQSxDQUFLQSxZQUFMLElBQXFCOEosZUFBZSxDQUFDQyxRQUFELEVBQVdwSixLQUFYLENBQXhELENBQUE7TUFDQSxJQUFLa0osQ0FBQUEsWUFBTCxJQUFxQmxKLEtBQXJCLENBQUE7QUFDSCxLQUFBO0dBTEwsQ0FBQTs7QUFRQXdJLEVBQUFBLGtCQUFrQixDQUFDUyxJQUFJLENBQUNsSixJQUFOLEVBQVksTUFBTWtKLElBQUksQ0FBQ0ksWUFBdkIsRUFBcUNYLFVBQXJDLEVBQWlETyxJQUFJLENBQUNOLFVBQXRELENBQWxCLENBQUE7QUFDSCxDQWJELENBQUE7O0FBZ0JBLE1BQU1XLGFBQWEsR0FBSUwsSUFBRCxJQUFVO0FBQzVCLEVBQUEsTUFBTUMsWUFBWSxHQUFJLENBQUEsQ0FBQSxFQUFHRCxJQUFJLENBQUNsSixJQUFLLENBQW5DLENBQUEsQ0FBQTs7RUFDQSxNQUFNb0osZUFBZSxHQUFHRixJQUFJLENBQUNFLGVBQUwsS0FBeUIsTUFBTSxJQUEvQixDQUF4QixDQUFBOztBQUVBLEVBQUEsTUFBTVQsVUFBVSxHQUFHLFNBQWJBLFVBQWEsQ0FBVTFJLEtBQVYsRUFBaUI7QUFDaEMsSUFBQSxNQUFNb0osUUFBUSxHQUFHLElBQUtGLENBQUFBLFlBQUwsQ0FBakIsQ0FBQTs7QUFDQSxJQUFBLElBQUksQ0FBQ0UsUUFBUSxDQUFDbkQsTUFBVCxDQUFnQmpHLEtBQWhCLENBQUwsRUFBNkI7TUFDekIsSUFBS1gsQ0FBQUEsWUFBTCxHQUFvQixJQUFBLENBQUtBLFlBQUwsSUFBcUI4SixlQUFlLENBQUNDLFFBQUQsRUFBV3BKLEtBQVgsQ0FBeEQsQ0FBQTtBQUNBLE1BQUEsSUFBQSxDQUFLa0osWUFBTCxDQUFxQkUsR0FBQUEsUUFBUSxDQUFDN0ksSUFBVCxDQUFjUCxLQUFkLENBQXJCLENBQUE7QUFDSCxLQUFBO0dBTEwsQ0FBQTs7QUFRQXdJLEVBQUFBLGtCQUFrQixDQUFDUyxJQUFJLENBQUNsSixJQUFOLEVBQVksTUFBTWtKLElBQUksQ0FBQ0ksWUFBTCxDQUFrQkUsS0FBbEIsRUFBbEIsRUFBNkNiLFVBQTdDLEVBQXlETyxJQUFJLENBQUNOLFVBQTlELENBQWxCLENBQUE7QUFDSCxDQWJELENBQUE7O0FBZ0JBLE1BQU1hLFVBQVUsR0FBSVAsSUFBRCxJQUFVO0FBQ3pCLEVBQUEsT0FBT0EsSUFBSSxDQUFDSSxZQUFMLElBQXFCSixJQUFJLENBQUNJLFlBQUwsQ0FBa0JFLEtBQXZDLEdBQStDRCxhQUFhLENBQUNMLElBQUQsQ0FBNUQsR0FBcUVELGVBQWUsQ0FBQ0MsSUFBRCxDQUEzRixDQUFBO0FBQ0gsQ0FGRCxDQUFBOztBQUlBLFNBQVNRLFlBQVQsQ0FBc0IxSixJQUF0QixFQUE0QjJKLEVBQTVCLEVBQWdDQyxRQUFoQyxFQUEwQ0MsVUFBMUMsRUFBc0RDLFdBQXRELEVBQW1FQyxVQUFuRSxFQUErRTtBQUUzRWpGLEVBQUFBLFNBQVMsQ0FBQzlFLElBQUQsQ0FBVCxHQUFrQjRKLFFBQWxCLENBQUE7QUFFQUgsRUFBQUEsVUFBVSxDQUFDO0lBQ1B6SixJQUFJLEVBQUcsQ0FBRUEsRUFBQUEsSUFBSyxDQURQLEdBQUEsQ0FBQTtBQUVQc0osSUFBQUEsWUFBWSxFQUFFLElBRlA7QUFHUEYsSUFBQUEsZUFBZSxFQUFFLENBQUNDLFFBQUQsRUFBV1csUUFBWCxLQUF3QjtBQUNyQyxNQUFBLE9BQU8sQ0FBQyxDQUFDWCxRQUFGLEtBQWUsQ0FBQyxDQUFDVyxRQUFqQixJQUNIWCxRQUFRLEtBQUtBLFFBQVEsQ0FBQ1ksSUFBVCxLQUFrQkQsUUFBUSxDQUFDQyxJQUEzQixJQUNBWixRQUFRLENBQUNhLGVBQVQsS0FBNkJGLFFBQVEsQ0FBQ0UsZUFEdEMsSUFFQWIsUUFBUSxDQUFDYyxNQUFULEtBQW9CSCxRQUFRLENBQUNHLE1BRmxDLENBRFosQ0FBQTtBQUlILEtBQUE7QUFSTSxHQUFELENBQVYsQ0FBQTtBQVdBVixFQUFBQSxVQUFVLENBQUM7SUFDUHpKLElBQUksRUFBRyxDQUFFQSxFQUFBQSxJQUFLLENBRFAsU0FBQSxDQUFBO0FBRVBzSixJQUFBQSxZQUFZLEVBQUUsSUFBSWMsSUFBSixDQUFTLENBQVQsRUFBWSxDQUFaLENBQUE7QUFGUCxHQUFELENBQVYsQ0FBQTtBQUtBWCxFQUFBQSxVQUFVLENBQUM7SUFDUHpKLElBQUksRUFBRyxDQUFFQSxFQUFBQSxJQUFLLENBRFAsU0FBQSxDQUFBO0FBRVBzSixJQUFBQSxZQUFZLEVBQUUsSUFBSWMsSUFBSixDQUFTLENBQVQsRUFBWSxDQUFaLENBQUE7QUFGUCxHQUFELENBQVYsQ0FBQTtBQUtBWCxFQUFBQSxVQUFVLENBQUM7SUFDUHpKLElBQUksRUFBRyxDQUFFQSxFQUFBQSxJQUFLLENBRFAsV0FBQSxDQUFBO0FBRVBzSixJQUFBQSxZQUFZLEVBQUUsQ0FBQTtBQUZQLEdBQUQsQ0FBVixDQUFBO0FBS0FHLEVBQUFBLFVBQVUsQ0FBQztJQUNQekosSUFBSSxFQUFHLENBQUVBLEVBQUFBLElBQUssQ0FEUCxLQUFBLENBQUE7QUFFUHNKLElBQUFBLFlBQVksRUFBRUssRUFBQUE7QUFGUCxHQUFELENBQVYsQ0FBQTs7RUFLQSxJQUFJQyxRQUFRLEdBQUcsQ0FBZixFQUFrQjtBQUNkSCxJQUFBQSxVQUFVLENBQUM7TUFDUHpKLElBQUksRUFBRyxDQUFFQSxFQUFBQSxJQUFLLENBRFAsVUFBQSxDQUFBO01BRVBzSixZQUFZLEVBQUVPLFVBQVUsR0FBR0EsVUFBSCxHQUFpQkQsUUFBUSxHQUFHLENBQVgsR0FBZSxLQUFmLEdBQXVCLEdBQUE7QUFGekQsS0FBRCxDQUFWLENBQUE7QUFJSCxHQUFBOztBQUVELEVBQUEsSUFBSUUsV0FBSixFQUFpQjtBQUNiTCxJQUFBQSxVQUFVLENBQUM7TUFDUHpKLElBQUksRUFBRyxDQUFFQSxFQUFBQSxJQUFLLENBRFAsV0FBQSxDQUFBO0FBRVBzSixNQUFBQSxZQUFZLEVBQUUsS0FBQTtBQUZQLEtBQUQsQ0FBVixDQUFBOztJQUtBLElBQUlNLFFBQVEsR0FBRyxDQUFmLEVBQWtCO0FBQ2RILE1BQUFBLFVBQVUsQ0FBQztRQUNQekosSUFBSSxFQUFHLENBQUVBLEVBQUFBLElBQUssQ0FEUCxrQkFBQSxDQUFBO1FBRVBzSixZQUFZLEVBQUVPLFVBQVUsR0FBR0EsVUFBSCxHQUFpQkQsUUFBUSxHQUFHLENBQVgsR0FBZSxLQUFmLEdBQXVCLEdBQUE7QUFGekQsT0FBRCxDQUFWLENBQUE7QUFJSCxLQUFBO0FBQ0osR0FBQTs7QUFFRCxFQUFBLElBQUlHLFVBQUosRUFBZ0I7QUFDWk4sSUFBQUEsVUFBVSxDQUFDO01BQ1B6SixJQUFJLEVBQUcsQ0FBRUEsRUFBQUEsSUFBSyxDQURQLElBQUEsQ0FBQTtBQUVQc0osTUFBQUEsWUFBWSxFQUFFZSxjQUFBQTtBQUZQLEtBQUQsQ0FBVixDQUFBO0FBSUgsR0FBQTs7QUFHRCxFQUFBLE1BQU1DLFNBQVMsR0FBSSxDQUFFdEssRUFBQUEsSUFBSyxDQUExQixTQUFBLENBQUEsQ0FBQTtBQUNBLEVBQUEsTUFBTXVLLFNBQVMsR0FBSSxDQUFFdkssRUFBQUEsSUFBSyxDQUExQixTQUFBLENBQUEsQ0FBQTtBQUNBLEVBQUEsTUFBTXdLLFdBQVcsR0FBSSxDQUFFeEssRUFBQUEsSUFBSyxDQUE1QixXQUFBLENBQUEsQ0FBQTtBQUNBLEVBQUEsTUFBTXlLLFlBQVksR0FBSSxDQUFFekssRUFBQUEsSUFBSyxDQUE3QixZQUFBLENBQUEsQ0FBQTtFQUNBdUksYUFBYSxDQUFDa0MsWUFBRCxFQUFlLENBQUNDLFFBQUQsRUFBV3pJLE1BQVgsRUFBbUJDLEtBQW5CLEtBQTZCO0FBQ3JELElBQUEsTUFBTXlJLE1BQU0sR0FBR0QsUUFBUSxDQUFDSixTQUFELENBQXZCLENBQUE7QUFDQSxJQUFBLE1BQU1NLE1BQU0sR0FBR0YsUUFBUSxDQUFDSCxTQUFELENBQXZCLENBQUE7QUFDQSxJQUFBLE1BQU1NLFFBQVEsR0FBR0gsUUFBUSxDQUFDRixXQUFELENBQXpCLENBQUE7O0lBRUEsSUFBSUcsTUFBTSxDQUFDRyxDQUFQLEtBQWEsQ0FBYixJQUFrQkgsTUFBTSxDQUFDSSxDQUFQLEtBQWEsQ0FBL0IsSUFDQUgsTUFBTSxDQUFDRSxDQUFQLEtBQWEsQ0FEYixJQUNrQkYsTUFBTSxDQUFDRyxDQUFQLEtBQWEsQ0FEL0IsSUFFQUYsUUFBUSxLQUFLLENBRmpCLEVBRW9CO0FBQ2hCLE1BQUEsT0FBTyxJQUFQLENBQUE7QUFDSCxLQUFBOztJQUVELE1BQU1oSixPQUFPLEdBQUc2SSxRQUFRLENBQUMzSSxhQUFULENBQXVCMEksWUFBdkIsRUFBcUMsTUFBTTtBQUN2RCxNQUFBLE9BQU8sQ0FBQztRQUNKekssSUFBSSxFQUFHLENBQVV5SyxRQUFBQSxFQUFBQSxZQUFhLENBRDFCLENBQUEsQ0FBQTtBQUVKeEssUUFBQUEsS0FBSyxFQUFFLElBQUkrSyxZQUFKLENBQWlCLENBQWpCLENBQUE7QUFGSCxPQUFELEVBR0o7UUFDQ2hMLElBQUksRUFBRyxDQUFVeUssUUFBQUEsRUFBQUEsWUFBYSxDQUQvQixDQUFBLENBQUE7QUFFQ3hLLFFBQUFBLEtBQUssRUFBRSxJQUFJK0ssWUFBSixDQUFpQixDQUFqQixDQUFBO0FBRlIsT0FISSxDQUFQLENBQUE7QUFPSCxLQVJlLENBQWhCLENBQUE7O0lBVUEsTUFBTUMsRUFBRSxHQUFHQyxJQUFJLENBQUNDLEdBQUwsQ0FBU04sUUFBUSxHQUFHTyxJQUFJLENBQUNDLFVBQXpCLENBQVgsQ0FBQTtJQUNBLE1BQU1DLEVBQUUsR0FBR0osSUFBSSxDQUFDSyxHQUFMLENBQVNWLFFBQVEsR0FBR08sSUFBSSxDQUFDQyxVQUF6QixDQUFYLENBQUE7QUFFQSxJQUFBLE1BQU1HLFFBQVEsR0FBRzNKLE9BQU8sQ0FBQyxDQUFELENBQVAsQ0FBVzVCLEtBQTVCLENBQUE7SUFDQXVMLFFBQVEsQ0FBQyxDQUFELENBQVIsR0FBY1AsRUFBRSxHQUFHTixNQUFNLENBQUNHLENBQTFCLENBQUE7SUFDQVUsUUFBUSxDQUFDLENBQUQsQ0FBUixHQUFjLENBQUNGLEVBQUQsR0FBTVgsTUFBTSxDQUFDSSxDQUEzQixDQUFBO0FBQ0FTLElBQUFBLFFBQVEsQ0FBQyxDQUFELENBQVIsR0FBY1osTUFBTSxDQUFDRSxDQUFyQixDQUFBO0FBRUEsSUFBQSxNQUFNVyxRQUFRLEdBQUc1SixPQUFPLENBQUMsQ0FBRCxDQUFQLENBQVc1QixLQUE1QixDQUFBO0lBQ0F3TCxRQUFRLENBQUMsQ0FBRCxDQUFSLEdBQWNILEVBQUUsR0FBR1gsTUFBTSxDQUFDRyxDQUExQixDQUFBO0lBQ0FXLFFBQVEsQ0FBQyxDQUFELENBQVIsR0FBY1IsRUFBRSxHQUFHTixNQUFNLENBQUNJLENBQTFCLENBQUE7SUFDQVUsUUFBUSxDQUFDLENBQUQsQ0FBUixHQUFjLEdBQUEsR0FBTWQsTUFBTSxDQUFDSSxDQUFiLEdBQWlCSCxNQUFNLENBQUNHLENBQXRDLENBQUE7QUFFQSxJQUFBLE9BQU9sSixPQUFQLENBQUE7QUFDSCxHQW5DWSxDQUFiLENBQUE7QUFvQ0gsQ0FBQTs7QUFFRCxTQUFTNkosWUFBVCxDQUFzQjFMLElBQXRCLEVBQTRCc0osWUFBNUIsRUFBMEM7QUFDdENHLEVBQUFBLFVBQVUsQ0FBQztBQUNQekosSUFBQUEsSUFBSSxFQUFFQSxJQURDO0FBRVBzSixJQUFBQSxZQUFZLEVBQUVBLFlBRlA7QUFHUFYsSUFBQUEsVUFBVSxFQUFFLFlBQVk7TUFLcEIsSUFBS3RKLENBQUFBLFlBQUwsR0FBb0IsSUFBcEIsQ0FBQTtBQUNBLE1BQUEsT0FBTyxJQUFNLENBQUEsQ0FBQSxDQUFBLEVBQUdVLElBQUssQ0FBQSxDQUFkLENBQVAsQ0FBQTtBQUNILEtBQUE7QUFWTSxHQUFELENBQVYsQ0FBQTtFQWFBdUksYUFBYSxDQUFDdkksSUFBRCxFQUFPLENBQUMwSyxRQUFELEVBQVd6SSxNQUFYLEVBQW1CQyxLQUFuQixLQUE2QjtBQUM3QyxJQUFBLE1BQU1MLE9BQU8sR0FBRzZJLFFBQVEsQ0FBQzNJLGFBQVQsQ0FBdUIvQixJQUF2QixFQUE2QixNQUFNLElBQUlnTCxZQUFKLENBQWlCLENBQWpCLENBQW5DLENBQWhCLENBQUE7O0FBQ0EsSUFBQSxNQUFNVyxLQUFLLEdBQUdqQixRQUFRLENBQUMxSyxJQUFELENBQXRCLENBQUE7SUFDQSxNQUFNNEwsS0FBSyxHQUFHbEIsUUFBUSxDQUFDbUIsZUFBVCxJQUE0QjNKLEtBQUssQ0FBQzRKLGVBQWhELENBQUE7O0FBRUEsSUFBQSxJQUFJRixLQUFKLEVBQVc7QUFDUC9KLE1BQUFBLE9BQU8sQ0FBQyxDQUFELENBQVAsR0FBYXFKLElBQUksQ0FBQ2EsR0FBTCxDQUFTSixLQUFLLENBQUNLLENBQWYsRUFBa0IsR0FBbEIsQ0FBYixDQUFBO0FBQ0FuSyxNQUFBQSxPQUFPLENBQUMsQ0FBRCxDQUFQLEdBQWFxSixJQUFJLENBQUNhLEdBQUwsQ0FBU0osS0FBSyxDQUFDTSxDQUFmLEVBQWtCLEdBQWxCLENBQWIsQ0FBQTtBQUNBcEssTUFBQUEsT0FBTyxDQUFDLENBQUQsQ0FBUCxHQUFhcUosSUFBSSxDQUFDYSxHQUFMLENBQVNKLEtBQUssQ0FBQ08sQ0FBZixFQUFrQixHQUFsQixDQUFiLENBQUE7QUFDSCxLQUpELE1BSU87QUFDSHJLLE1BQUFBLE9BQU8sQ0FBQyxDQUFELENBQVAsR0FBYThKLEtBQUssQ0FBQ0ssQ0FBbkIsQ0FBQTtBQUNBbkssTUFBQUEsT0FBTyxDQUFDLENBQUQsQ0FBUCxHQUFhOEosS0FBSyxDQUFDTSxDQUFuQixDQUFBO0FBQ0FwSyxNQUFBQSxPQUFPLENBQUMsQ0FBRCxDQUFQLEdBQWE4SixLQUFLLENBQUNPLENBQW5CLENBQUE7QUFDSCxLQUFBOztBQUVELElBQUEsT0FBT3JLLE9BQVAsQ0FBQTtBQUNILEdBaEJZLENBQWIsQ0FBQTtBQWlCSCxDQUFBOztBQUVELFNBQVNzSyxZQUFULENBQXNCbk0sSUFBdEIsRUFBNEJzSixZQUE1QixFQUEwQ2QsY0FBMUMsRUFBMEQ7QUFDdERpQixFQUFBQSxVQUFVLENBQUM7QUFDUHpKLElBQUFBLElBQUksRUFBRUEsSUFEQztBQUVQc0osSUFBQUEsWUFBWSxFQUFFQSxZQUZQO0FBR1BGLElBQUFBLGVBQWUsRUFBRSxDQUFDQyxRQUFELEVBQVdXLFFBQVgsS0FBd0I7QUFLckMsTUFBQSxPQUFPLENBQUNYLFFBQVEsS0FBSyxDQUFiLElBQWtCQSxRQUFRLEtBQUssQ0FBaEMsT0FBd0NXLFFBQVEsS0FBSyxDQUFiLElBQWtCQSxRQUFRLEtBQUssQ0FBdkUsQ0FBUCxDQUFBO0FBQ0gsS0FBQTtBQVRNLEdBQUQsQ0FBVixDQUFBO0FBWUF6QixFQUFBQSxhQUFhLENBQUN2SSxJQUFELEVBQU93SSxjQUFQLENBQWIsQ0FBQTtBQUNILENBQUE7O0FBRUQsU0FBUzRELGFBQVQsQ0FBdUJwTSxJQUF2QixFQUE2QndJLGNBQTdCLEVBQTZDO0FBQ3pDaUIsRUFBQUEsVUFBVSxDQUFDO0FBQ1B6SixJQUFBQSxJQUFJLEVBQUVBLElBREM7QUFFUHNKLElBQUFBLFlBQVksRUFBRSxJQUZQO0FBR1BGLElBQUFBLGVBQWUsRUFBRSxDQUFDQyxRQUFELEVBQVdXLFFBQVgsS0FBd0I7QUFDckMsTUFBQSxPQUFPLENBQUMsQ0FBQ1gsUUFBRixLQUFlLENBQUMsQ0FBQ1csUUFBeEIsQ0FBQTtBQUNILEtBQUE7QUFMTSxHQUFELENBQVYsQ0FBQTtBQVFBekIsRUFBQUEsYUFBYSxDQUFDdkksSUFBRCxFQUFPd0ksY0FBUCxDQUFiLENBQUE7QUFDSCxDQUFBOztBQUVELFNBQVM2RCxXQUFULENBQXFCck0sSUFBckIsRUFBMkJzSixZQUEzQixFQUF5QztBQUNyQ0csRUFBQUEsVUFBVSxDQUFDO0FBQ1B6SixJQUFBQSxJQUFJLEVBQUVBLElBREM7QUFFUHNKLElBQUFBLFlBQVksRUFBRUEsWUFBQUE7QUFGUCxHQUFELENBQVYsQ0FBQTtBQUlILENBQUE7O0FBRUQsU0FBU2dELG9CQUFULEdBQWdDO0FBQzVCWixFQUFBQSxZQUFZLENBQUMsU0FBRCxFQUFZLElBQUlhLEtBQUosQ0FBVSxHQUFWLEVBQWUsR0FBZixFQUFvQixHQUFwQixDQUFaLENBQVosQ0FBQTs7QUFDQWIsRUFBQUEsWUFBWSxDQUFDLFNBQUQsRUFBWSxJQUFJYSxLQUFKLENBQVUsQ0FBVixFQUFhLENBQWIsRUFBZ0IsQ0FBaEIsQ0FBWixDQUFaLENBQUE7O0FBQ0FiLEVBQUFBLFlBQVksQ0FBQyxVQUFELEVBQWEsSUFBSWEsS0FBSixDQUFVLENBQVYsRUFBYSxDQUFiLEVBQWdCLENBQWhCLENBQWIsQ0FBWixDQUFBOztBQUNBYixFQUFBQSxZQUFZLENBQUMsVUFBRCxFQUFhLElBQUlhLEtBQUosQ0FBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixDQUFoQixDQUFiLENBQVosQ0FBQTs7QUFDQWIsRUFBQUEsWUFBWSxDQUFDLE9BQUQsRUFBVSxJQUFJYSxLQUFKLENBQVUsQ0FBVixFQUFhLENBQWIsRUFBZ0IsQ0FBaEIsQ0FBVixDQUFaLENBQUE7O0FBQ0FiLEVBQUFBLFlBQVksQ0FBQyxhQUFELEVBQWdCLElBQUlhLEtBQUosQ0FBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixDQUFoQixDQUFoQixDQUFaLENBQUE7O0FBQ0FKLEVBQUFBLFlBQVksQ0FBQyxtQkFBRCxFQUFzQixDQUF0QixDQUFaLENBQUE7O0FBQ0FBLEVBQUFBLFlBQVksQ0FBQyxtQkFBRCxFQUFzQixDQUF0QixDQUFaLENBQUE7O0FBQ0FBLEVBQUFBLFlBQVksQ0FBQyxpQkFBRCxFQUFvQixDQUFwQixDQUFaLENBQUE7O0VBRUFBLFlBQVksQ0FBQyxXQUFELEVBQWMsRUFBZCxFQUFrQixDQUFDekIsUUFBRCxFQUFXekksTUFBWCxFQUFtQkMsS0FBbkIsS0FBNkI7SUFFdkQsT0FBT3dJLFFBQVEsQ0FBQ3BGLFlBQVQsS0FBMEJDLGNBQTFCLEdBRUgyRixJQUFJLENBQUNhLEdBQUwsQ0FBUyxDQUFULEVBQVlyQixRQUFRLENBQUM4QixTQUFULEdBQXFCLElBQXJCLEdBQTRCLEVBQXhDLENBRkcsR0FHSDlCLFFBQVEsQ0FBQzhCLFNBQVQsR0FBcUIsSUFIekIsQ0FBQTtBQUlILEdBTlcsQ0FBWixDQUFBOztFQU9BTCxZQUFZLENBQUMsaUJBQUQsRUFBb0IsQ0FBcEIsRUFBdUIsQ0FBQ3pCLFFBQUQsRUFBV3pJLE1BQVgsRUFBbUJDLEtBQW5CLEtBQTZCO0FBQzVELElBQUEsT0FBT3dJLFFBQVEsQ0FBQytCLGVBQVQsR0FBMkIsS0FBbEMsQ0FBQTtBQUNILEdBRlcsQ0FBWixDQUFBOztBQUdBTixFQUFBQSxZQUFZLENBQUMsU0FBRCxFQUFZLENBQVosQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsV0FBRCxFQUFjLENBQWQsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsV0FBRCxFQUFjLENBQWQsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsV0FBRCxFQUFjLENBQWQsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsMEJBQUQsRUFBNkIsQ0FBN0IsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsY0FBRCxFQUFpQixDQUFqQixDQUFaLENBQUE7O0FBQ0FBLEVBQUFBLFlBQVksQ0FBQywwQkFBRCxFQUE2QixDQUE3QixDQUFaLENBQUE7O0FBQ0FBLEVBQUFBLFlBQVksQ0FBQyxZQUFELEVBQWUsQ0FBZixDQUFaLENBQUE7O0FBQ0FBLEVBQUFBLFlBQVksQ0FBQyxpQkFBRCxFQUFvQixHQUFBLEdBQU0sR0FBMUIsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsV0FBRCxFQUFjLENBQWQsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMscUJBQUQsRUFBd0IsQ0FBeEIsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsV0FBRCxFQUFjLENBQWQsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsWUFBRCxFQUFlLENBQWYsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsV0FBRCxFQUFjLENBQWQsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMscUJBQUQsRUFBd0IsQ0FBeEIsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsb0JBQUQsRUFBdUIsQ0FBdkIsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsU0FBRCxFQUFZLENBQVosRUFBZSxJQUFmLENBQVosQ0FBQTs7QUFFQUEsRUFBQUEsWUFBWSxDQUFDLGFBQUQsRUFBZ0IsQ0FBaEIsQ0FBWixDQUFBOztBQUNBQSxFQUFBQSxZQUFZLENBQUMsNEJBQUQsRUFBK0IsR0FBQSxHQUFNLEdBQXJDLENBQVosQ0FBQTs7QUFDQUEsRUFBQUEsWUFBWSxDQUFDLHlCQUFELEVBQTRCLENBQTVCLENBQVosQ0FBQTs7QUFDQUEsRUFBQUEsWUFBWSxDQUFDLHlCQUFELEVBQTRCLENBQTVCLENBQVosQ0FBQTs7RUFFQUMsYUFBYSxDQUFDLFdBQUQsQ0FBYixDQUFBOztFQUVBQSxhQUFhLENBQUMsc0JBQUQsRUFBeUIsQ0FBQzFCLFFBQUQsRUFBV3pJLE1BQVgsRUFBbUJDLEtBQW5CLEtBQTZCO0lBQy9ELE1BQU1MLE9BQU8sR0FBRzZJLFFBQVEsQ0FBQzNJLGFBQVQsQ0FBdUIsc0JBQXZCLEVBQStDLE1BQU07QUFDakUsTUFBQSxPQUFPLENBQUM7QUFDSi9CLFFBQUFBLElBQUksRUFBRSxXQURGO0FBRUpDLFFBQUFBLEtBQUssRUFBRSxJQUFJK0ssWUFBSixDQUFpQixDQUFqQixDQUFBO0FBRkgsT0FBRCxFQUdKO0FBQ0NoTCxRQUFBQSxJQUFJLEVBQUUsV0FEUDtBQUVDQyxRQUFBQSxLQUFLLEVBQUUsSUFBSStLLFlBQUosQ0FBaUIsQ0FBakIsQ0FBQTtBQUZSLE9BSEksQ0FBUCxDQUFBO0FBT0gsS0FSZSxDQUFoQixDQUFBOztBQVVBLElBQUEsTUFBTTBCLE9BQU8sR0FBR2hDLFFBQVEsQ0FBQ2lDLG9CQUFULENBQThCQyxNQUE5QixFQUFoQixDQUFBO0FBQ0EsSUFBQSxNQUFNQyxVQUFVLEdBQUdoTCxPQUFPLENBQUMsQ0FBRCxDQUFQLENBQVc1QixLQUE5QixDQUFBO0FBQ0E0TSxJQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLEdBQWdCSCxPQUFPLENBQUM1QixDQUF4QixDQUFBO0FBQ0ErQixJQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLEdBQWdCSCxPQUFPLENBQUMzQixDQUF4QixDQUFBO0FBQ0E4QixJQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLEdBQWdCSCxPQUFPLENBQUNJLENBQXhCLENBQUE7QUFFQSxJQUFBLE1BQU1DLE9BQU8sR0FBR3JDLFFBQVEsQ0FBQ2lDLG9CQUFULENBQThCSyxNQUE5QixFQUFoQixDQUFBO0FBQ0EsSUFBQSxNQUFNQyxVQUFVLEdBQUdwTCxPQUFPLENBQUMsQ0FBRCxDQUFQLENBQVc1QixLQUE5QixDQUFBO0FBQ0FnTixJQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLEdBQWdCRixPQUFPLENBQUNqQyxDQUF4QixDQUFBO0FBQ0FtQyxJQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLEdBQWdCRixPQUFPLENBQUNoQyxDQUF4QixDQUFBO0FBQ0FrQyxJQUFBQSxVQUFVLENBQUMsQ0FBRCxDQUFWLEdBQWdCRixPQUFPLENBQUNELENBQXhCLENBQUE7QUFFQSxJQUFBLE9BQU9qTCxPQUFQLENBQUE7QUFDSCxHQXhCWSxDQUFiLENBQUE7O0FBMEJBd0ssRUFBQUEsV0FBVyxDQUFDLGFBQUQsRUFBZ0IsS0FBaEIsQ0FBWCxDQUFBOztBQUNBQSxFQUFBQSxXQUFXLENBQUMsYUFBRCxFQUFnQixLQUFoQixDQUFYLENBQUE7O0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQyxjQUFELEVBQWlCLEtBQWpCLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLHVCQUFELEVBQTBCLEtBQTFCLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLGNBQUQsRUFBaUIsS0FBakIsQ0FBWCxDQUFBOztBQUNBQSxFQUFBQSxXQUFXLENBQUMsU0FBRCxFQUFZLEtBQVosQ0FBWCxDQUFBOztBQUNBQSxFQUFBQSxXQUFXLENBQUMsY0FBRCxFQUFpQixLQUFqQixDQUFYLENBQUE7O0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQywyQkFBRCxFQUE4QixLQUE5QixDQUFYLENBQUE7O0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQyxVQUFELEVBQWEsS0FBYixDQUFYLENBQUE7O0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQyxtQkFBRCxFQUFzQixLQUF0QixDQUFYLENBQUE7O0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQyxlQUFELEVBQWtCLEtBQWxCLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLG9CQUFELEVBQXVCLElBQXZCLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLGdCQUFELEVBQW1CLElBQW5CLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLHNCQUFELEVBQXlCLElBQXpCLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLGlCQUFELEVBQW9CYSxVQUFwQixDQUFYLENBQUE7O0FBQ0FiLEVBQUFBLFdBQVcsQ0FBQyxjQUFELEVBQWlCYyxjQUFqQixDQUFYLENBQUE7O0FBQ0FkLEVBQUFBLFdBQVcsQ0FBQyxjQUFELEVBQWlCZSxlQUFqQixDQUFYLENBQUE7O0FBQ0FmLEVBQUFBLFdBQVcsQ0FBQyxzQkFBRCxFQUF5QixLQUF6QixDQUFYLENBQUE7O0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQyxtQkFBRCxFQUFzQmdCLGFBQXRCLENBQVgsQ0FBQTs7QUFDQWhCLEVBQUFBLFdBQVcsQ0FBQyxzQkFBRCxFQUF5QixJQUF6QixDQUFYLENBQUE7O0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQyx3QkFBRCxFQUEyQixJQUEzQixDQUFYLENBQUE7O0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQyxRQUFELEVBQVcsSUFBWCxDQUFYLENBQUE7O0FBQ0FBLEVBQUFBLFdBQVcsQ0FBQyxhQUFELEVBQWdCLElBQWhCLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLGlCQUFELEVBQW9CLElBQXBCLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLFdBQUQsRUFBYyxJQUFkLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLFVBQUQsRUFBYSxLQUFiLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLFdBQUQsRUFBYyxLQUFkLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLGtCQUFELEVBQXFCLEtBQXJCLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLGdCQUFELEVBQW1CaUIsU0FBbkIsQ0FBWCxDQUFBOztBQUNBakIsRUFBQUEsV0FBVyxDQUFDLG1CQUFELEVBQXNCLEtBQXRCLENBQVgsQ0FBQTs7QUFDQUEsRUFBQUEsV0FBVyxDQUFDLGdCQUFELEVBQW1CLEtBQW5CLENBQVgsQ0FBQTs7RUFFQTNDLFlBQVksQ0FBQyxTQUFELEVBQVksQ0FBWixFQUFlLENBQWYsRUFBa0IsRUFBbEIsRUFBc0IsSUFBdEIsQ0FBWixDQUFBOztFQUNBQSxZQUFZLENBQUMsVUFBRCxFQUFhLENBQWIsRUFBZ0IsQ0FBaEIsRUFBbUIsRUFBbkIsRUFBdUIsSUFBdkIsQ0FBWixDQUFBOztFQUNBQSxZQUFZLENBQUMsVUFBRCxFQUFhLENBQWIsRUFBZ0IsQ0FBaEIsRUFBbUIsRUFBbkIsRUFBdUIsSUFBdkIsQ0FBWixDQUFBOztFQUNBQSxZQUFZLENBQUMsV0FBRCxFQUFjLENBQWQsRUFBaUIsQ0FBakIsRUFBb0IsRUFBcEIsRUFBd0IsSUFBeEIsQ0FBWixDQUFBOztFQUNBQSxZQUFZLENBQUMsbUJBQUQsRUFBc0IsQ0FBdEIsRUFBeUIsQ0FBekIsRUFBNEIsRUFBNUIsRUFBZ0MsSUFBaEMsQ0FBWixDQUFBOztFQUNBQSxZQUFZLENBQUMsUUFBRCxFQUFXLENBQVgsRUFBYyxDQUFDLENBQWYsRUFBa0IsRUFBbEIsRUFBc0IsS0FBdEIsQ0FBWixDQUFBOztFQUNBQSxZQUFZLENBQUMsV0FBRCxFQUFjLENBQWQsRUFBaUIsQ0FBakIsRUFBb0IsRUFBcEIsRUFBd0IsSUFBeEIsQ0FBWixDQUFBOztFQUNBQSxZQUFZLENBQUMsT0FBRCxFQUFVLENBQVYsRUFBYSxDQUFiLEVBQWdCLEVBQWhCLEVBQW9CLElBQXBCLENBQVosQ0FBQTs7RUFDQUEsWUFBWSxDQUFDLFNBQUQsRUFBWSxDQUFaLEVBQWUsQ0FBZixFQUFrQixHQUFsQixFQUF1QixJQUF2QixDQUFaLENBQUE7O0VBQ0FBLFlBQVksQ0FBQyxZQUFELEVBQWUsQ0FBZixFQUFrQixDQUFsQixFQUFxQixFQUFyQixFQUF5QixJQUF6QixDQUFaLENBQUE7O0VBQ0FBLFlBQVksQ0FBQyxRQUFELEVBQVcsQ0FBWCxFQUFjLENBQWQsRUFBaUIsRUFBakIsRUFBcUIsS0FBckIsQ0FBWixDQUFBOztFQUNBQSxZQUFZLENBQUMsSUFBRCxFQUFPLENBQVAsRUFBVSxDQUFWLEVBQWEsRUFBYixFQUFpQixJQUFqQixDQUFaLENBQUE7O0VBQ0FBLFlBQVksQ0FBQyxPQUFELEVBQVUsQ0FBVixFQUFhLENBQWIsRUFBZ0IsRUFBaEIsRUFBb0IsSUFBcEIsQ0FBWixDQUFBOztFQUNBQSxZQUFZLENBQUMsTUFBRCxFQUFTLENBQVQsRUFBWSxDQUFaLEVBQWUsRUFBZixFQUFtQixLQUFuQixDQUFaLENBQUE7O0FBQ0FBLEVBQUFBLFlBQVksQ0FBQyxlQUFELEVBQWtCLENBQWxCLEVBQXFCLENBQXJCLEVBQXdCLEVBQXhCLEVBQTRCLEtBQTVCLEVBQW1DLElBQW5DLENBQVosQ0FBQTs7RUFDQUEsWUFBWSxDQUFDLGNBQUQsRUFBaUIsQ0FBakIsRUFBb0IsQ0FBQyxDQUFyQixFQUF3QixFQUF4QixFQUE0QixLQUE1QixDQUFaLENBQUE7O0VBQ0FBLFlBQVksQ0FBQyxXQUFELEVBQWMsQ0FBZCxFQUFpQixDQUFqQixFQUFvQixFQUFwQixFQUF3QixJQUF4QixDQUFaLENBQUE7O0VBQ0FBLFlBQVksQ0FBQyxnQkFBRCxFQUFtQixDQUFuQixFQUFzQixDQUF0QixFQUF5QixFQUF6QixFQUE2QixJQUE3QixDQUFaLENBQUE7O0VBQ0FBLFlBQVksQ0FBQyxpQkFBRCxFQUFvQixDQUFwQixFQUF1QixDQUFDLENBQXhCLEVBQTJCLEVBQTNCLEVBQStCLEtBQS9CLENBQVosQ0FBQTs7RUFDQUEsWUFBWSxDQUFDLE9BQUQsRUFBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixFQUFoQixFQUFvQixJQUFwQixDQUFaLENBQUE7O0VBQ0FBLFlBQVksQ0FBQyxZQUFELEVBQWUsQ0FBZixFQUFrQixDQUFsQixFQUFxQixFQUFyQixFQUF5QixJQUF6QixDQUFaLENBQUE7O0VBRUFBLFlBQVksQ0FBQyxhQUFELEVBQWdCLENBQWhCLEVBQW1CLENBQW5CLEVBQXNCLEVBQXRCLEVBQTBCLElBQTFCLENBQVosQ0FBQTs7RUFDQUEsWUFBWSxDQUFDLHNCQUFELEVBQXlCLENBQXpCLEVBQTRCLENBQTVCLEVBQStCLEVBQS9CLEVBQW1DLElBQW5DLENBQVosQ0FBQTs7RUFFQTBDLGFBQWEsQ0FBQyxTQUFELENBQWIsQ0FBQTs7RUFDQUEsYUFBYSxDQUFDLFdBQUQsQ0FBYixDQUFBOztFQUNBQSxhQUFhLENBQUMsVUFBRCxDQUFiLENBQUE7O0FBR0EsRUFBQSxNQUFNeEQsVUFBVSxHQUFHLFNBQWJBLFVBQWEsR0FBWTtBQUMzQixJQUFBLE9BQU8sS0FBSzJFLG9CQUFaLENBQUE7R0FESixDQUFBOztBQUtBLEVBQUEsTUFBTTVFLFVBQVUsR0FBRyxTQUFiQSxVQUFhLENBQVUxSSxLQUFWLEVBQWlCO0lBQ2hDLE1BQU11TixRQUFRLEdBQUcsSUFBQSxDQUFLRCxvQkFBdEIsQ0FBQTtJQUVBdE4sS0FBSyxHQUFHQSxLQUFLLElBQUksRUFBakIsQ0FBQTtJQUVBLElBQUl3TixPQUFPLEdBQUcsS0FBZCxDQUFBO0lBQ0EsSUFBSUMsUUFBUSxHQUFHLElBQWYsQ0FBQTs7SUFDQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUcsQ0FBcEIsRUFBdUIsRUFBRUEsQ0FBekIsRUFBNEI7QUFDeEIsTUFBQSxNQUFNek0sQ0FBQyxHQUFHakIsS0FBSyxDQUFDME4sQ0FBRCxDQUFMLElBQVksSUFBdEIsQ0FBQTs7QUFDQSxNQUFBLElBQUlILFFBQVEsQ0FBQ0csQ0FBRCxDQUFSLEtBQWdCek0sQ0FBcEIsRUFBdUI7QUFDbkJzTSxRQUFBQSxRQUFRLENBQUNHLENBQUQsQ0FBUixHQUFjek0sQ0FBZCxDQUFBO0FBQ0F1TSxRQUFBQSxPQUFPLEdBQUcsSUFBVixDQUFBO0FBQ0gsT0FBQTs7TUFDREMsUUFBUSxHQUFHQSxRQUFRLElBQUssQ0FBQyxDQUFDRixRQUFRLENBQUNHLENBQUQsQ0FBbEMsQ0FBQTtBQUNILEtBQUE7O0FBRUQsSUFBQSxJQUFJRixPQUFKLEVBQWE7QUFDVCxNQUFBLElBQUlDLFFBQUosRUFBYztBQUNWLFFBQUEsSUFBQSxDQUFLbEksUUFBTCxHQUFnQm9JLFdBQVcsQ0FBQ0Msd0JBQVosQ0FBcUNMLFFBQXJDLEVBQStDO0FBQzNETSxVQUFBQSxNQUFNLEVBQUUsSUFBS3RJLENBQUFBLFFBQUFBO0FBRDhDLFNBQS9DLENBQWhCLENBQUE7QUFHSCxPQUpELE1BSU87UUFDSCxJQUFJLElBQUEsQ0FBS0EsUUFBVCxFQUFtQjtVQUNmLElBQUtBLENBQUFBLFFBQUwsQ0FBY3dDLE9BQWQsRUFBQSxDQUFBO1VBQ0EsSUFBS3hDLENBQUFBLFFBQUwsR0FBZ0IsSUFBaEIsQ0FBQTtBQUNILFNBQUE7QUFDSixPQUFBOztNQUNELElBQUtsRyxDQUFBQSxZQUFMLEdBQW9CLElBQXBCLENBQUE7QUFDSCxLQUFBO0dBNUJMLENBQUE7O0FBK0JBLEVBQUEsTUFBTXlPLEtBQUssR0FBRyxDQUFDLElBQUQsRUFBTyxJQUFQLEVBQWEsSUFBYixFQUFtQixJQUFuQixFQUF5QixJQUF6QixFQUErQixJQUEvQixDQUFkLENBQUE7QUFFQXRGLEVBQUFBLGtCQUFrQixDQUFDLHFCQUFELEVBQXdCLE1BQU1zRixLQUFLLENBQUNDLEtBQU4sRUFBOUIsRUFBNkNyRixVQUE3QyxFQUF5REMsVUFBekQsQ0FBbEIsQ0FBQTtBQUNILENBQUE7O0FBRUQwRCxvQkFBb0IsRUFBQTs7OzsifQ==
