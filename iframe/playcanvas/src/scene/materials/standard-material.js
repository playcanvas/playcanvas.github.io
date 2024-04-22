import { Color } from '../../core/math/color.js';
import { math } from '../../core/math/math.js';
import { Vec2 } from '../../core/math/vec2.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { CUBEPROJ_BOX, SPECULAR_PHONG, SHADER_DEPTH, SHADER_PICK, SHADER_PREPASS_VELOCITY, SPECOCC_AO, SPECULAR_BLINN, FRESNEL_SCHLICK, CUBEPROJ_NONE, DITHER_NONE, DETAILMODE_MUL } from '../constants.js';
import { ShaderPass } from '../shader-pass.js';
import { EnvLighting } from '../graphics/env-lighting.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { _matTex2D, standard } from '../shader-lib/programs/standard.js';
import { Material } from './material.js';
import { StandardMaterialOptionsBuilder } from './standard-material-options-builder.js';
import { standardMaterialTextureParameters, standardMaterialCubemapParameters } from './standard-material-parameters.js';

const _props = {};
const _uniforms = {};
let _params = new Set();
class StandardMaterial extends Material {
  constructor() {
    super();
    this.userAttributes = new Map();
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
  set shader(shader) {}
  get shader() {
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
  setAttribute(name, semantic) {
    this.userAttributes.set(semantic, name);
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
    if (this.useMetalness) {
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
      if (!this.sheenGlossMap || this.sheenGlossTint) {
        this._setParameter('material_sheenGloss', this.sheenGloss);
      }
      this._setParameter('material_refractionIndex', this.refractionIndex);
    } else {
      if (!this.specularMap || this.specularTint) {
        this._setParameter('material_specular', getUniform('specular'));
      }
    }
    if (this.enableGGXSpecular) {
      this._setParameter('material_anisotropy', this.anisotropy);
    }
    if (this.clearCoat > 0) {
      this._setParameter('material_clearCoat', this.clearCoat);
      this._setParameter('material_clearCoatGloss', this.clearCoatGloss);
      this._setParameter('material_clearCoatBumpiness', this.clearCoatBumpiness);
    }
    this._setParameter('material_gloss', getUniform('gloss'));
    if (!this.emissiveMap || this.emissiveTint) {
      this._setParameter('material_emissive', getUniform('emissive'));
    }
    if (this.emissiveIntensity !== 1) {
      this._setParameter('material_emissiveIntensity', this.emissiveIntensity);
    }
    if (this.refraction > 0) {
      this._setParameter('material_refraction', this.refraction);
    }
    if (this.dispersion > 0) {
      this._setParameter('material_dispersion', this.dispersion);
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
    }
    this._processParameters('_activeLightingParams');
  }
  getShaderVariant(device, scene, objDefs, unused, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {
    this.updateEnvUniforms(device, scene);
    const shaderPassInfo = ShaderPass.get(device).getByIndex(pass);
    const minimalOptions = pass === SHADER_DEPTH || pass === SHADER_PICK || pass === SHADER_PREPASS_VELOCITY || shaderPassInfo.isShadow;
    let options = minimalOptions ? standard.optionsContextMin : standard.optionsContext;
    if (minimalOptions) this.shaderOptBuilder.updateMinRef(options, scene, this, objDefs, pass, sortedLights);else this.shaderOptBuilder.updateRef(options, scene, this, objDefs, pass, sortedLights);
    if (this.onUpdateShader) {
      options = this.onUpdateShader(options);
    }
    const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);
    const library = getProgramLibrary(device);
    library.register('standard', standard);
    const shader = library.getProgram('standard', options, processingOptions, this.userId);
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
function _defineTex2D(name, channel = "rgb", vertexColor = true, uv = 0) {
  _matTex2D[name] = channel.length || -1;
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
  if (channel) {
    defineProp({
      name: `${name}MapChannel`,
      defaultValue: channel
    });
    if (vertexColor) {
      defineProp({
        name: `${name}VertexColor`,
        defaultValue: false
      });
      defineProp({
        name: `${name}VertexColorChannel`,
        defaultValue: channel
      });
    }
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
  _defineFloat('sheenGloss', 0.0);
  _defineFloat('gloss', 0.25, (material, device, scene) => {
    return material.shadingModel === SPECULAR_PHONG ? Math.pow(2, material.gloss * 11) : material.gloss;
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
  _defineFloat('dispersion', 0);
  _defineFloat('thickness', 0);
  _defineFloat('attenuationDistance', 0);
  _defineFloat('metalness', 1);
  _defineFloat('anisotropy', 0);
  _defineFloat('clearCoat', 0);
  _defineFloat('clearCoatGloss', 1);
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
  _defineFlag('glossInvert', false);
  _defineFlag('sheenGlossInvert', false);
  _defineFlag('clearCoatGlossInvert', false);
  _defineFlag('opacityDither', DITHER_NONE);
  _defineFlag('opacityShadowDither', DITHER_NONE);
  _defineTex2D('diffuse');
  _defineTex2D('specular');
  _defineTex2D('emissive');
  _defineTex2D('thickness', 'g');
  _defineTex2D('specularityFactor', 'g');
  _defineTex2D('normal', '');
  _defineTex2D('metalness', 'g');
  _defineTex2D('gloss', 'g');
  _defineTex2D('opacity', 'a');
  _defineTex2D('refraction', 'g');
  _defineTex2D('height', 'g', false);
  _defineTex2D('ao', 'g');
  _defineTex2D('light', 'rgb', true, 1);
  _defineTex2D('msdf', '');
  _defineTex2D('diffuseDetail', 'rgb', false);
  _defineTex2D('normalDetail', '');
  _defineTex2D('aoDetail', 'g', false);
  _defineTex2D('clearCoat', 'g');
  _defineTex2D('clearCoatGloss', 'g');
  _defineTex2D('clearCoatNormal', '');
  _defineTex2D('sheen', 'rgb');
  _defineTex2D('sheenGloss', 'g');
  _defineTex2D('iridescence', 'g');
  _defineTex2D('iridescenceThickness', 'g');
  _defineFlag('diffuseDetailMode', DETAILMODE_MUL);
  _defineFlag('aoDetailMode', DETAILMODE_MUL);
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
