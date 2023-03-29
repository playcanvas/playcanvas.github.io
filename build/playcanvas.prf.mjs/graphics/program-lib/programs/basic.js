/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, SEMANTIC_COLOR, SEMANTIC_TEXCOORD0, SEMANTIC_POSITION } from '../../constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { SHADER_DEPTH, SHADER_PICK } from '../../../scene/constants.js';
import { vertexIntro, skinCode, begin, end, fragmentIntro, fogCode } from './common.js';

const basic = {
  generateKey: function (options) {
    let key = 'basic';
    if (options.fog) key += '_fog';
    if (options.alphaTest) key += '_atst';
    if (options.vertexColors) key += '_vcol';
    if (options.diffuseMap) key += '_diff';
    if (options.skin) key += '_skin';
    if (options.screenSpace) key += '_ss';
    if (options.useInstancing) key += '_inst';
    if (options.useMorphPosition) key += '_morphp';
    if (options.useMorphNormal) key += '_morphn';
    if (options.useMorphTextureBased) key += '_morpht';
    key += '_' + options.pass;
    return key;
  },
  createShaderDefinition: function (device, options) {
    const attributes = {
      vertex_position: SEMANTIC_POSITION
    };

    if (options.skin) {
      attributes.vertex_boneWeights = SEMANTIC_BLENDWEIGHT;
      attributes.vertex_boneIndices = SEMANTIC_BLENDINDICES;
    }

    if (options.vertexColors) {
      attributes.vertex_color = SEMANTIC_COLOR;
    }

    if (options.diffuseMap) {
      attributes.vertex_texCoord0 = SEMANTIC_TEXCOORD0;
    }

    let code = vertexIntro(device, 'BasicShader', options.pass);
    code += shaderChunks.transformDeclVS;

    if (options.skin) {
      code += skinCode(device);
      code += shaderChunks.transformSkinnedVS;
    } else {
      code += shaderChunks.transformVS;
    }

    if (options.vertexColors) {
      code += 'attribute vec4 vertex_color;\n';
      code += 'varying vec4 vColor;\n';
    }

    if (options.diffuseMap) {
      code += 'attribute vec2 vertex_texCoord0;\n';
      code += 'varying vec2 vUv0;\n';
    }

    if (options.pass === SHADER_DEPTH) {
      code += 'varying float vDepth;\n';
      code += '#ifndef VIEWMATRIX\n';
      code += '#define VIEWMATRIX\n';
      code += 'uniform mat4 matrix_view;\n';
      code += '#endif\n';
      code += '#ifndef CAMERAPLANES\n';
      code += '#define CAMERAPLANES\n';
      code += 'uniform vec4 camera_params;\n\n';
      code += '#endif\n';
    }

    code += begin();
    code += "   gl_Position = getPosition();\n";

    if (options.pass === SHADER_DEPTH) {
      code += "    vDepth = -(matrix_view * vec4(getWorldPosition(),1.0)).z * camera_params.x;\n";
    }

    if (options.vertexColors) {
      code += '    vColor = vertex_color;\n';
    }

    if (options.diffuseMap) {
      code += '    vUv0 = vertex_texCoord0;\n';
    }

    code += end();
    const vshader = code;
    code = fragmentIntro(device, 'BasicMaterial', options.pass);

    if (options.vertexColors) {
      code += 'varying vec4 vColor;\n';
    } else {
      code += 'uniform vec4 uColor;\n';
    }

    if (options.diffuseMap) {
      code += 'varying vec2 vUv0;\n';
      code += 'uniform sampler2D texture_diffuseMap;\n';
    }

    if (options.fog) {
      code += fogCode(options.fog);
    }

    if (options.alphaTest) {
      code += shaderChunks.alphaTestPS;
    }

    if (options.pass === SHADER_DEPTH) {
      code += 'varying float vDepth;\n';
      code += shaderChunks.packDepthPS;
    }

    code += begin();

    if (options.vertexColors) {
      code += '    gl_FragColor = vColor;\n';
    } else {
      code += '    gl_FragColor = uColor;\n';
    }

    if (options.diffuseMap) {
      code += '    gl_FragColor *= texture2D(texture_diffuseMap, vUv0);\n';
    }

    if (options.alphaTest) {
      code += "   alphaTest(gl_FragColor.a);\n";
    }

    if (options.pass !== SHADER_PICK) {
      if (options.pass === SHADER_DEPTH) {
        code += "    gl_FragColor = packFloat(vDepth);\n";
      } else {
        if (options.fog) {
          code += "   glFragColor.rgb = addFog(gl_FragColor.rgb);\n";
        }
      }
    }

    code += end();
    const fshader = code;
    return {
      attributes: attributes,
      vshader: vshader,
      fshader: fshader
    };
  }
};

export { basic };
