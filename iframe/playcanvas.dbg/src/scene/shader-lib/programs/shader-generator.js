import { GAMMA_SRGB, GAMMA_SRGBFAST, GAMMA_SRGBHDR, TONEMAP_NEUTRAL, TONEMAP_ACES2, TONEMAP_ACES, TONEMAP_HEJL, TONEMAP_LINEAR, TONEMAP_FILMIC } from '../../constants.js';
import { shaderChunks } from '../chunks/chunks.js';

class ShaderGenerator {
  static begin() {
    return 'void main(void)\n{\n';
  }
  static end() {
    return '}\n';
  }
  static skinCode(device, chunks = shaderChunks) {
    if (device.supportsBoneTextures) {
      return chunks.skinTexVS;
    }
    return "#define BONE_LIMIT " + device.getBoneLimit() + "\n" + chunks.skinConstVS;
  }
  static fogCode(value, chunks = shaderChunks) {
    if (value === 'linear') {
      return chunks.fogLinearPS ? chunks.fogLinearPS : shaderChunks.fogLinearPS;
    } else if (value === 'exp') {
      return chunks.fogExpPS ? chunks.fogExpPS : shaderChunks.fogExpPS;
    } else if (value === 'exp2') {
      return chunks.fogExp2PS ? chunks.fogExp2PS : shaderChunks.fogExp2PS;
    }
    return chunks.fogNonePS ? chunks.fogNonePS : shaderChunks.fogNonePS;
  }
  static gammaCode(value, chunks = shaderChunks) {
    if (value === GAMMA_SRGB || value === GAMMA_SRGBFAST) {
      return chunks.gamma2_2PS ? chunks.gamma2_2PS : shaderChunks.gamma2_2PS;
    } else if (value === GAMMA_SRGBHDR) {
      return "#define HDR\n" + (chunks.gamma2_2PS ? chunks.gamma2_2PS : shaderChunks.gamma2_2PS);
    }
    return chunks.gamma1_0PS ? chunks.gamma1_0PS : shaderChunks.gamma1_0PS;
  }
  static tonemapCode(value, chunks = shaderChunks) {
    var _chunks$tonemappingFi, _chunks$tonemappingLi, _chunks$tonemappingHe, _chunks$tonemappingAc, _chunks$tonemappingAc2, _chunks$tonemappingNe, _chunks$tonemapingNon;
    switch (value) {
      case TONEMAP_FILMIC:
        return (_chunks$tonemappingFi = chunks.tonemappingFilmicPS) != null ? _chunks$tonemappingFi : shaderChunks.tonemappingFilmicPS;
      case TONEMAP_LINEAR:
        return (_chunks$tonemappingLi = chunks.tonemappingLinearPS) != null ? _chunks$tonemappingLi : shaderChunks.tonemappingLinearPS;
      case TONEMAP_HEJL:
        return (_chunks$tonemappingHe = chunks.tonemappingHejlPS) != null ? _chunks$tonemappingHe : shaderChunks.tonemappingHejlPS;
      case TONEMAP_ACES:
        return (_chunks$tonemappingAc = chunks.tonemappingAcesPS) != null ? _chunks$tonemappingAc : shaderChunks.tonemappingAcesPS;
      case TONEMAP_ACES2:
        return (_chunks$tonemappingAc2 = chunks.tonemappingAces2PS) != null ? _chunks$tonemappingAc2 : shaderChunks.tonemappingAces2PS;
      case TONEMAP_NEUTRAL:
        return (_chunks$tonemappingNe = chunks.tonemappingNeutralPS) != null ? _chunks$tonemappingNe : shaderChunks.tonemappingNeutralPS;
    }
    return (_chunks$tonemapingNon = chunks.tonemapingNonePS) != null ? _chunks$tonemapingNon : shaderChunks.tonemappingNonePS;
  }
}

export { ShaderGenerator };
