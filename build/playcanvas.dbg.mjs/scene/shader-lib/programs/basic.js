/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { SEMANTIC_POSITION, SEMANTIC_BLENDWEIGHT, SEMANTIC_BLENDINDICES, SEMANTIC_COLOR, SEMANTIC_TEXCOORD0 } from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { shaderChunks } from '../chunks/chunks.js';
import { SHADER_DEPTH, SHADER_PICK } from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';
import { skinCode, begin, end, fogCode } from './common.js';

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
    // GENERATE ATTRIBUTES
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
    const shaderPassDefine = ShaderPass.getPassShaderDefine(options.pass);

    // GENERATE VERTEX SHADER
    let vshader = shaderPassDefine;

    // VERTEX SHADER DECLARATIONS
    vshader += shaderChunks.transformDeclVS;
    if (options.skin) {
      vshader += skinCode(device);
      vshader += shaderChunks.transformSkinnedVS;
    } else {
      vshader += shaderChunks.transformVS;
    }
    if (options.vertexColors) {
      vshader += 'attribute vec4 vertex_color;\n';
      vshader += 'varying vec4 vColor;\n';
    }
    if (options.diffuseMap) {
      vshader += 'attribute vec2 vertex_texCoord0;\n';
      vshader += 'varying vec2 vUv0;\n';
    }
    if (options.pass === SHADER_DEPTH) {
      vshader += 'varying float vDepth;\n';
      vshader += '#ifndef VIEWMATRIX\n';
      vshader += '#define VIEWMATRIX\n';
      vshader += 'uniform mat4 matrix_view;\n';
      vshader += '#endif\n';
      vshader += '#ifndef CAMERAPLANES\n';
      vshader += '#define CAMERAPLANES\n';
      vshader += 'uniform vec4 camera_params;\n\n';
      vshader += '#endif\n';
    }

    // VERTEX SHADER BODY
    vshader += begin();
    vshader += "   gl_Position = getPosition();\n";
    if (options.pass === SHADER_DEPTH) {
      vshader += "    vDepth = -(matrix_view * vec4(getWorldPosition(),1.0)).z * camera_params.x;\n";
    }
    if (options.vertexColors) {
      vshader += '    vColor = vertex_color;\n';
    }
    if (options.diffuseMap) {
      vshader += '    vUv0 = vertex_texCoord0;\n';
    }
    vshader += end();

    // GENERATE FRAGMENT SHADER
    let fshader = shaderPassDefine;

    // FRAGMENT SHADER DECLARATIONS
    if (options.vertexColors) {
      fshader += 'varying vec4 vColor;\n';
    } else {
      fshader += 'uniform vec4 uColor;\n';
    }
    if (options.diffuseMap) {
      fshader += 'varying vec2 vUv0;\n';
      fshader += 'uniform sampler2D texture_diffuseMap;\n';
    }
    if (options.fog) {
      fshader += fogCode(options.fog);
    }
    if (options.alphaTest) {
      fshader += shaderChunks.alphaTestPS;
    }
    if (options.pass === SHADER_DEPTH) {
      // ##### SCREEN DEPTH PASS #####
      fshader += 'varying float vDepth;\n';
      fshader += shaderChunks.packDepthPS;
    }

    // FRAGMENT SHADER BODY
    fshader += begin();

    // Read the map texels that the shader needs
    if (options.vertexColors) {
      fshader += '    gl_FragColor = vColor;\n';
    } else {
      fshader += '    gl_FragColor = uColor;\n';
    }
    if (options.diffuseMap) {
      fshader += '    gl_FragColor *= texture2D(texture_diffuseMap, vUv0);\n';
    }
    if (options.alphaTest) {
      fshader += "   alphaTest(gl_FragColor.a);\n";
    }
    if (options.pass !== SHADER_PICK) {
      if (options.pass === SHADER_DEPTH) {
        // ##### SCREEN DEPTH PASS #####
        fshader += "    gl_FragColor = packFloat(vDepth);\n";
      } else {
        // ##### FORWARD PASS #####
        if (options.fog) {
          fshader += "   glFragColor.rgb = addFog(gl_FragColor.rgb);\n";
        }
      }
    }
    fshader += end();
    return ShaderUtils.createDefinition(device, {
      name: 'BasicShader',
      attributes: attributes,
      vertexCode: vshader,
      fragmentCode: fshader
    });
  }
};

export { basic };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzaWMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3Byb2dyYW1zL2Jhc2ljLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gICAgU0VNQU5USUNfQkxFTkRJTkRJQ0VTLCBTRU1BTlRJQ19CTEVORFdFSUdIVCwgU0VNQU5USUNfQ09MT1IsIFNFTUFOVElDX1BPU0lUSU9OLCBTRU1BTlRJQ19URVhDT09SRDBcbn0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNoYWRlclV0aWxzIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXV0aWxzLmpzJztcbmltcG9ydCB7IHNoYWRlckNodW5rcyB9IGZyb20gJy4uL2NodW5rcy9jaHVua3MuanMnO1xuXG5pbXBvcnQge1xuICAgIFNIQURFUl9ERVBUSCwgU0hBREVSX1BJQ0tcbn0gZnJvbSAnLi4vLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IFNoYWRlclBhc3MgfSBmcm9tICcuLi8uLi9zaGFkZXItcGFzcy5qcyc7XG5cbmltcG9ydCB7IGJlZ2luLCBlbmQsIGZvZ0NvZGUsIHNraW5Db2RlIH0gZnJvbSAnLi9jb21tb24uanMnO1xuXG5jb25zdCBiYXNpYyA9IHtcbiAgICBnZW5lcmF0ZUtleTogZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgbGV0IGtleSA9ICdiYXNpYyc7XG4gICAgICAgIGlmIChvcHRpb25zLmZvZykgICAgICAgICAgICAgICAgICAgIGtleSArPSAnX2ZvZyc7XG4gICAgICAgIGlmIChvcHRpb25zLmFscGhhVGVzdCkgICAgICAgICAgICAgIGtleSArPSAnX2F0c3QnO1xuICAgICAgICBpZiAob3B0aW9ucy52ZXJ0ZXhDb2xvcnMpICAgICAgICAgICBrZXkgKz0gJ192Y29sJztcbiAgICAgICAgaWYgKG9wdGlvbnMuZGlmZnVzZU1hcCkgICAgICAgICAgICAga2V5ICs9ICdfZGlmZic7XG4gICAgICAgIGlmIChvcHRpb25zLnNraW4pICAgICAgICAgICAgICAgICAgIGtleSArPSAnX3NraW4nO1xuXG4gICAgICAgIGlmIChvcHRpb25zLnNjcmVlblNwYWNlKSAgICAgICAgICAgIGtleSArPSAnX3NzJztcbiAgICAgICAgaWYgKG9wdGlvbnMudXNlSW5zdGFuY2luZykgICAgICAgICAga2V5ICs9ICdfaW5zdCc7XG4gICAgICAgIGlmIChvcHRpb25zLnVzZU1vcnBoUG9zaXRpb24pICAgICAgIGtleSArPSAnX21vcnBocCc7XG4gICAgICAgIGlmIChvcHRpb25zLnVzZU1vcnBoTm9ybWFsKSAgICAgICAgIGtleSArPSAnX21vcnBobic7XG4gICAgICAgIGlmIChvcHRpb25zLnVzZU1vcnBoVGV4dHVyZUJhc2VkKSAgIGtleSArPSAnX21vcnBodCc7XG5cbiAgICAgICAga2V5ICs9ICdfJyArIG9wdGlvbnMucGFzcztcbiAgICAgICAgcmV0dXJuIGtleTtcbiAgICB9LFxuXG4gICAgY3JlYXRlU2hhZGVyRGVmaW5pdGlvbjogZnVuY3Rpb24gKGRldmljZSwgb3B0aW9ucykge1xuICAgICAgICAvLyBHRU5FUkFURSBBVFRSSUJVVEVTXG4gICAgICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSB7XG4gICAgICAgICAgICB2ZXJ0ZXhfcG9zaXRpb246IFNFTUFOVElDX1BPU0lUSU9OXG4gICAgICAgIH07XG4gICAgICAgIGlmIChvcHRpb25zLnNraW4pIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXMudmVydGV4X2JvbmVXZWlnaHRzID0gU0VNQU5USUNfQkxFTkRXRUlHSFQ7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzLnZlcnRleF9ib25lSW5kaWNlcyA9IFNFTUFOVElDX0JMRU5ESU5ESUNFUztcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy52ZXJ0ZXhDb2xvcnMpIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZXMudmVydGV4X2NvbG9yID0gU0VNQU5USUNfQ09MT1I7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZGlmZnVzZU1hcCkge1xuICAgICAgICAgICAgYXR0cmlidXRlcy52ZXJ0ZXhfdGV4Q29vcmQwID0gU0VNQU5USUNfVEVYQ09PUkQwO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2hhZGVyUGFzc0RlZmluZSA9IFNoYWRlclBhc3MuZ2V0UGFzc1NoYWRlckRlZmluZShvcHRpb25zLnBhc3MpO1xuXG4gICAgICAgIC8vIEdFTkVSQVRFIFZFUlRFWCBTSEFERVJcbiAgICAgICAgbGV0IHZzaGFkZXIgPSBzaGFkZXJQYXNzRGVmaW5lO1xuXG4gICAgICAgIC8vIFZFUlRFWCBTSEFERVIgREVDTEFSQVRJT05TXG4gICAgICAgIHZzaGFkZXIgKz0gc2hhZGVyQ2h1bmtzLnRyYW5zZm9ybURlY2xWUztcblxuICAgICAgICBpZiAob3B0aW9ucy5za2luKSB7XG4gICAgICAgICAgICB2c2hhZGVyICs9IHNraW5Db2RlKGRldmljZSk7XG4gICAgICAgICAgICB2c2hhZGVyICs9IHNoYWRlckNodW5rcy50cmFuc2Zvcm1Ta2lubmVkVlM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2c2hhZGVyICs9IHNoYWRlckNodW5rcy50cmFuc2Zvcm1WUztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnZlcnRleENvbG9ycykge1xuICAgICAgICAgICAgdnNoYWRlciArPSAnYXR0cmlidXRlIHZlYzQgdmVydGV4X2NvbG9yO1xcbic7XG4gICAgICAgICAgICB2c2hhZGVyICs9ICd2YXJ5aW5nIHZlYzQgdkNvbG9yO1xcbic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZGlmZnVzZU1hcCkge1xuICAgICAgICAgICAgdnNoYWRlciArPSAnYXR0cmlidXRlIHZlYzIgdmVydGV4X3RleENvb3JkMDtcXG4nO1xuICAgICAgICAgICAgdnNoYWRlciArPSAndmFyeWluZyB2ZWMyIHZVdjA7XFxuJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnBhc3MgPT09IFNIQURFUl9ERVBUSCkge1xuICAgICAgICAgICAgdnNoYWRlciArPSAndmFyeWluZyBmbG9hdCB2RGVwdGg7XFxuJztcbiAgICAgICAgICAgIHZzaGFkZXIgKz0gJyNpZm5kZWYgVklFV01BVFJJWFxcbic7XG4gICAgICAgICAgICB2c2hhZGVyICs9ICcjZGVmaW5lIFZJRVdNQVRSSVhcXG4nO1xuICAgICAgICAgICAgdnNoYWRlciArPSAndW5pZm9ybSBtYXQ0IG1hdHJpeF92aWV3O1xcbic7XG4gICAgICAgICAgICB2c2hhZGVyICs9ICcjZW5kaWZcXG4nO1xuICAgICAgICAgICAgdnNoYWRlciArPSAnI2lmbmRlZiBDQU1FUkFQTEFORVNcXG4nO1xuICAgICAgICAgICAgdnNoYWRlciArPSAnI2RlZmluZSBDQU1FUkFQTEFORVNcXG4nO1xuICAgICAgICAgICAgdnNoYWRlciArPSAndW5pZm9ybSB2ZWM0IGNhbWVyYV9wYXJhbXM7XFxuXFxuJztcbiAgICAgICAgICAgIHZzaGFkZXIgKz0gJyNlbmRpZlxcbic7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBWRVJURVggU0hBREVSIEJPRFlcbiAgICAgICAgdnNoYWRlciArPSBiZWdpbigpO1xuXG4gICAgICAgIHZzaGFkZXIgKz0gXCIgICBnbF9Qb3NpdGlvbiA9IGdldFBvc2l0aW9uKCk7XFxuXCI7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucGFzcyA9PT0gU0hBREVSX0RFUFRIKSB7XG4gICAgICAgICAgICB2c2hhZGVyICs9IFwiICAgIHZEZXB0aCA9IC0obWF0cml4X3ZpZXcgKiB2ZWM0KGdldFdvcmxkUG9zaXRpb24oKSwxLjApKS56ICogY2FtZXJhX3BhcmFtcy54O1xcblwiO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudmVydGV4Q29sb3JzKSB7XG4gICAgICAgICAgICB2c2hhZGVyICs9ICcgICAgdkNvbG9yID0gdmVydGV4X2NvbG9yO1xcbic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZGlmZnVzZU1hcCkge1xuICAgICAgICAgICAgdnNoYWRlciArPSAnICAgIHZVdjAgPSB2ZXJ0ZXhfdGV4Q29vcmQwO1xcbic7XG4gICAgICAgIH1cblxuICAgICAgICB2c2hhZGVyICs9IGVuZCgpO1xuXG4gICAgICAgIC8vIEdFTkVSQVRFIEZSQUdNRU5UIFNIQURFUlxuICAgICAgICBsZXQgZnNoYWRlciA9IHNoYWRlclBhc3NEZWZpbmU7XG5cbiAgICAgICAgLy8gRlJBR01FTlQgU0hBREVSIERFQ0xBUkFUSU9OU1xuICAgICAgICBpZiAob3B0aW9ucy52ZXJ0ZXhDb2xvcnMpIHtcbiAgICAgICAgICAgIGZzaGFkZXIgKz0gJ3ZhcnlpbmcgdmVjNCB2Q29sb3I7XFxuJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZzaGFkZXIgKz0gJ3VuaWZvcm0gdmVjNCB1Q29sb3I7XFxuJztcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy5kaWZmdXNlTWFwKSB7XG4gICAgICAgICAgICBmc2hhZGVyICs9ICd2YXJ5aW5nIHZlYzIgdlV2MDtcXG4nO1xuICAgICAgICAgICAgZnNoYWRlciArPSAndW5pZm9ybSBzYW1wbGVyMkQgdGV4dHVyZV9kaWZmdXNlTWFwO1xcbic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZm9nKSB7XG4gICAgICAgICAgICBmc2hhZGVyICs9IGZvZ0NvZGUob3B0aW9ucy5mb2cpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLmFscGhhVGVzdCkge1xuICAgICAgICAgICAgZnNoYWRlciArPSBzaGFkZXJDaHVua3MuYWxwaGFUZXN0UFM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5wYXNzID09PSBTSEFERVJfREVQVEgpIHtcbiAgICAgICAgICAgIC8vICMjIyMjIFNDUkVFTiBERVBUSCBQQVNTICMjIyMjXG4gICAgICAgICAgICBmc2hhZGVyICs9ICd2YXJ5aW5nIGZsb2F0IHZEZXB0aDtcXG4nO1xuICAgICAgICAgICAgZnNoYWRlciArPSBzaGFkZXJDaHVua3MucGFja0RlcHRoUFM7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGUkFHTUVOVCBTSEFERVIgQk9EWVxuICAgICAgICBmc2hhZGVyICs9IGJlZ2luKCk7XG5cbiAgICAgICAgLy8gUmVhZCB0aGUgbWFwIHRleGVscyB0aGF0IHRoZSBzaGFkZXIgbmVlZHNcbiAgICAgICAgaWYgKG9wdGlvbnMudmVydGV4Q29sb3JzKSB7XG4gICAgICAgICAgICBmc2hhZGVyICs9ICcgICAgZ2xfRnJhZ0NvbG9yID0gdkNvbG9yO1xcbic7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmc2hhZGVyICs9ICcgICAgZ2xfRnJhZ0NvbG9yID0gdUNvbG9yO1xcbic7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuZGlmZnVzZU1hcCkge1xuICAgICAgICAgICAgZnNoYWRlciArPSAnICAgIGdsX0ZyYWdDb2xvciAqPSB0ZXh0dXJlMkQodGV4dHVyZV9kaWZmdXNlTWFwLCB2VXYwKTtcXG4nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuYWxwaGFUZXN0KSB7XG4gICAgICAgICAgICBmc2hhZGVyICs9IFwiICAgYWxwaGFUZXN0KGdsX0ZyYWdDb2xvci5hKTtcXG5cIjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLnBhc3MgIT09IFNIQURFUl9QSUNLKSB7XG4gICAgICAgICAgICBpZiAob3B0aW9ucy5wYXNzID09PSBTSEFERVJfREVQVEgpIHtcbiAgICAgICAgICAgICAgICAvLyAjIyMjIyBTQ1JFRU4gREVQVEggUEFTUyAjIyMjI1xuICAgICAgICAgICAgICAgIGZzaGFkZXIgKz0gXCIgICAgZ2xfRnJhZ0NvbG9yID0gcGFja0Zsb2F0KHZEZXB0aCk7XFxuXCI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vICMjIyMjIEZPUldBUkQgUEFTUyAjIyMjI1xuICAgICAgICAgICAgICAgIGlmIChvcHRpb25zLmZvZykge1xuICAgICAgICAgICAgICAgICAgICBmc2hhZGVyICs9IFwiICAgZ2xGcmFnQ29sb3IucmdiID0gYWRkRm9nKGdsX0ZyYWdDb2xvci5yZ2IpO1xcblwiO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZzaGFkZXIgKz0gZW5kKCk7XG5cbiAgICAgICAgcmV0dXJuIFNoYWRlclV0aWxzLmNyZWF0ZURlZmluaXRpb24oZGV2aWNlLCB7XG4gICAgICAgICAgICBuYW1lOiAnQmFzaWNTaGFkZXInLFxuICAgICAgICAgICAgYXR0cmlidXRlczogYXR0cmlidXRlcyxcbiAgICAgICAgICAgIHZlcnRleENvZGU6IHZzaGFkZXIsXG4gICAgICAgICAgICBmcmFnbWVudENvZGU6IGZzaGFkZXJcbiAgICAgICAgfSk7XG4gICAgfVxufTtcblxuZXhwb3J0IHsgYmFzaWMgfTtcbiJdLCJuYW1lcyI6WyJiYXNpYyIsImdlbmVyYXRlS2V5Iiwib3B0aW9ucyIsImtleSIsImZvZyIsImFscGhhVGVzdCIsInZlcnRleENvbG9ycyIsImRpZmZ1c2VNYXAiLCJza2luIiwic2NyZWVuU3BhY2UiLCJ1c2VJbnN0YW5jaW5nIiwidXNlTW9ycGhQb3NpdGlvbiIsInVzZU1vcnBoTm9ybWFsIiwidXNlTW9ycGhUZXh0dXJlQmFzZWQiLCJwYXNzIiwiY3JlYXRlU2hhZGVyRGVmaW5pdGlvbiIsImRldmljZSIsImF0dHJpYnV0ZXMiLCJ2ZXJ0ZXhfcG9zaXRpb24iLCJTRU1BTlRJQ19QT1NJVElPTiIsInZlcnRleF9ib25lV2VpZ2h0cyIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwidmVydGV4X2JvbmVJbmRpY2VzIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwidmVydGV4X2NvbG9yIiwiU0VNQU5USUNfQ09MT1IiLCJ2ZXJ0ZXhfdGV4Q29vcmQwIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwic2hhZGVyUGFzc0RlZmluZSIsIlNoYWRlclBhc3MiLCJnZXRQYXNzU2hhZGVyRGVmaW5lIiwidnNoYWRlciIsInNoYWRlckNodW5rcyIsInRyYW5zZm9ybURlY2xWUyIsInNraW5Db2RlIiwidHJhbnNmb3JtU2tpbm5lZFZTIiwidHJhbnNmb3JtVlMiLCJTSEFERVJfREVQVEgiLCJiZWdpbiIsImVuZCIsImZzaGFkZXIiLCJmb2dDb2RlIiwiYWxwaGFUZXN0UFMiLCJwYWNrRGVwdGhQUyIsIlNIQURFUl9QSUNLIiwiU2hhZGVyVXRpbHMiLCJjcmVhdGVEZWZpbml0aW9uIiwibmFtZSIsInZlcnRleENvZGUiLCJmcmFnbWVudENvZGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQWFBLE1BQU1BLEtBQUssR0FBRztFQUNWQyxXQUFXLEVBQUUsVUFBVUMsT0FBTyxFQUFFO0lBQzVCLElBQUlDLEdBQUcsR0FBRyxPQUFPLENBQUE7QUFDakIsSUFBQSxJQUFJRCxPQUFPLENBQUNFLEdBQUcsRUFBcUJELEdBQUcsSUFBSSxNQUFNLENBQUE7QUFDakQsSUFBQSxJQUFJRCxPQUFPLENBQUNHLFNBQVMsRUFBZUYsR0FBRyxJQUFJLE9BQU8sQ0FBQTtBQUNsRCxJQUFBLElBQUlELE9BQU8sQ0FBQ0ksWUFBWSxFQUFZSCxHQUFHLElBQUksT0FBTyxDQUFBO0FBQ2xELElBQUEsSUFBSUQsT0FBTyxDQUFDSyxVQUFVLEVBQWNKLEdBQUcsSUFBSSxPQUFPLENBQUE7QUFDbEQsSUFBQSxJQUFJRCxPQUFPLENBQUNNLElBQUksRUFBb0JMLEdBQUcsSUFBSSxPQUFPLENBQUE7QUFFbEQsSUFBQSxJQUFJRCxPQUFPLENBQUNPLFdBQVcsRUFBYU4sR0FBRyxJQUFJLEtBQUssQ0FBQTtBQUNoRCxJQUFBLElBQUlELE9BQU8sQ0FBQ1EsYUFBYSxFQUFXUCxHQUFHLElBQUksT0FBTyxDQUFBO0FBQ2xELElBQUEsSUFBSUQsT0FBTyxDQUFDUyxnQkFBZ0IsRUFBUVIsR0FBRyxJQUFJLFNBQVMsQ0FBQTtBQUNw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
