import { Shader } from '../../platform/graphics/shader.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from './chunks/chunks.js';
import { getProgramLibrary } from './get-program-library.js';
import { Debug } from '../../core/debug.js';

/**
 * Create a shader from named shader chunks.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device.
 * @param {string} vsName - The vertex shader chunk name.
 * @param {string} fsName - The fragment shader chunk name.
 * @param {boolean} [useTransformFeedback] - Whether to use transform feedback. Defaults to false.
 * @returns {Shader} The newly created shader.
 */
function createShader(device, vsName, fsName, useTransformFeedback = false) {
  return new Shader(device, ShaderUtils.createDefinition(device, {
    name: `${vsName}_${fsName}`,
    vertexCode: shaderChunks[vsName],
    fragmentCode: shaderChunks[fsName],
    useTransformFeedback: useTransformFeedback
  }));
}

/**
 * Create a shader from the supplied source code. Note that this function adds additional shader
 * blocks to both vertex and fragment shaders, which allow the shader to use more features and
 * compile on both WebGL and WebGPU. Specifically, these blocks are added, and should not be
 * part of provided vsCode and fsCode: shader version, shader precision, commonly used extensions.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device.
 * @param {string} vsCode - The vertex shader code.
 * @param {string} fsCode - The fragment shader code.
 * @param {string} uniqueName - Unique name for the shader. If a shader with this name already
 * exists, it will be returned instead of a new shader instance.
 * @param {Object<string, string>} [attributes] - Object detailing the mapping of vertex shader
 * attribute names to semantics SEMANTIC_*. This enables the engine to match vertex buffer data as
 * inputs to the shader. Defaults to undefined, which generates the default attributes.
 * @param {boolean} [useTransformFeedback] - Whether to use transform feedback. Defaults to false.
 * @returns {Shader} The newly created shader.
 */
function createShaderFromCode(device, vsCode, fsCode, uniqueName, attributes, useTransformFeedback = false) {
  // the function signature has changed, fail if called incorrectly
  Debug.assert(typeof attributes !== 'boolean');
  const programLibrary = getProgramLibrary(device);
  let shader = programLibrary.getCachedShader(uniqueName);
  if (!shader) {
    shader = new Shader(device, ShaderUtils.createDefinition(device, {
      name: uniqueName,
      vertexCode: vsCode,
      fragmentCode: fsCode,
      attributes: attributes,
      useTransformFeedback: useTransformFeedback
    }));
    programLibrary.setCachedShader(uniqueName, shader);
  }
  return shader;
}

/**
 * Process shader using shader processing options, utilizing cache of the ProgramLibrary
 *
 * @param {Shader} shader - The shader to be processed.
 * @param {import('../../platform/graphics/shader-processor-options.js').ShaderProcessorOptions} processingOptions -
 * The shader processing options.
 * @returns {Shader} The processed shader.
 * @ignore
 */
function processShader(shader, processingOptions) {
  var _shaderDefinition$nam;
  Debug.assert(shader);
  const shaderDefinition = shader.definition;

  // 'shader' generator for a material - simply return existing shader definition. Use generator and getProgram
  // to allow for shader processing to be cached
  const name = (_shaderDefinition$nam = shaderDefinition.name) != null ? _shaderDefinition$nam : 'shader';
  const key = `${name}-id-${shader.id}`;
  const materialGenerator = {
    generateKey: function (options) {
      // unique name based of the shader id
      return key;
    },
    createShaderDefinition: function (device, options) {
      return shaderDefinition;
    }
  };

  // temporarily register the program generator
  const libraryModuleName = 'shader';
  const library = getProgramLibrary(shader.device);
  Debug.assert(!library.isRegistered(libraryModuleName));
  library.register(libraryModuleName, materialGenerator);

  // generate shader variant - its the same shader, but with different processing options
  const variant = library.getProgram(libraryModuleName, {}, processingOptions);

  // unregister it again
  library.unregister(libraryModuleName);
  return variant;
}
shaderChunks.createShader = createShader;
shaderChunks.createShaderFromCode = createShaderFromCode;

export { createShader, createShaderFromCode, processShader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL3V0aWxzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNoYWRlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci5qcyc7XG5pbXBvcnQgeyBTaGFkZXJVdGlscyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3NoYWRlci11dGlscy5qcyc7XG5pbXBvcnQgeyBzaGFkZXJDaHVua3MgfSBmcm9tICcuL2NodW5rcy9jaHVua3MuanMnO1xuaW1wb3J0IHsgZ2V0UHJvZ3JhbUxpYnJhcnkgfSBmcm9tICcuL2dldC1wcm9ncmFtLWxpYnJhcnkuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuLyoqXG4gKiBDcmVhdGUgYSBzaGFkZXIgZnJvbSBuYW1lZCBzaGFkZXIgY2h1bmtzLlxuICpcbiAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9ncmFwaGljcy1kZXZpY2UuanMnKS5HcmFwaGljc0RldmljZX0gZGV2aWNlIC0gVGhlXG4gKiBncmFwaGljcyBkZXZpY2UuXG4gKiBAcGFyYW0ge3N0cmluZ30gdnNOYW1lIC0gVGhlIHZlcnRleCBzaGFkZXIgY2h1bmsgbmFtZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBmc05hbWUgLSBUaGUgZnJhZ21lbnQgc2hhZGVyIGNodW5rIG5hbWUuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFt1c2VUcmFuc2Zvcm1GZWVkYmFja10gLSBXaGV0aGVyIHRvIHVzZSB0cmFuc2Zvcm0gZmVlZGJhY2suIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQHJldHVybnMge1NoYWRlcn0gVGhlIG5ld2x5IGNyZWF0ZWQgc2hhZGVyLlxuICovXG5mdW5jdGlvbiBjcmVhdGVTaGFkZXIoZGV2aWNlLCB2c05hbWUsIGZzTmFtZSwgdXNlVHJhbnNmb3JtRmVlZGJhY2sgPSBmYWxzZSkge1xuICAgIHJldHVybiBuZXcgU2hhZGVyKGRldmljZSwgU2hhZGVyVXRpbHMuY3JlYXRlRGVmaW5pdGlvbihkZXZpY2UsIHtcbiAgICAgICAgbmFtZTogYCR7dnNOYW1lfV8ke2ZzTmFtZX1gLFxuICAgICAgICB2ZXJ0ZXhDb2RlOiBzaGFkZXJDaHVua3NbdnNOYW1lXSxcbiAgICAgICAgZnJhZ21lbnRDb2RlOiBzaGFkZXJDaHVua3NbZnNOYW1lXSxcbiAgICAgICAgdXNlVHJhbnNmb3JtRmVlZGJhY2s6IHVzZVRyYW5zZm9ybUZlZWRiYWNrXG4gICAgfSkpO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHNoYWRlciBmcm9tIHRoZSBzdXBwbGllZCBzb3VyY2UgY29kZS4gTm90ZSB0aGF0IHRoaXMgZnVuY3Rpb24gYWRkcyBhZGRpdGlvbmFsIHNoYWRlclxuICogYmxvY2tzIHRvIGJvdGggdmVydGV4IGFuZCBmcmFnbWVudCBzaGFkZXJzLCB3aGljaCBhbGxvdyB0aGUgc2hhZGVyIHRvIHVzZSBtb3JlIGZlYXR1cmVzIGFuZFxuICogY29tcGlsZSBvbiBib3RoIFdlYkdMIGFuZCBXZWJHUFUuIFNwZWNpZmljYWxseSwgdGhlc2UgYmxvY2tzIGFyZSBhZGRlZCwgYW5kIHNob3VsZCBub3QgYmVcbiAqIHBhcnQgb2YgcHJvdmlkZWQgdnNDb2RlIGFuZCBmc0NvZGU6IHNoYWRlciB2ZXJzaW9uLCBzaGFkZXIgcHJlY2lzaW9uLCBjb21tb25seSB1c2VkIGV4dGVuc2lvbnMuXG4gKlxuICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAqIGdyYXBoaWNzIGRldmljZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSB2c0NvZGUgLSBUaGUgdmVydGV4IHNoYWRlciBjb2RlLlxuICogQHBhcmFtIHtzdHJpbmd9IGZzQ29kZSAtIFRoZSBmcmFnbWVudCBzaGFkZXIgY29kZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSB1bmlxdWVOYW1lIC0gVW5pcXVlIG5hbWUgZm9yIHRoZSBzaGFkZXIuIElmIGEgc2hhZGVyIHdpdGggdGhpcyBuYW1lIGFscmVhZHlcbiAqIGV4aXN0cywgaXQgd2lsbCBiZSByZXR1cm5lZCBpbnN0ZWFkIG9mIGEgbmV3IHNoYWRlciBpbnN0YW5jZS5cbiAqIEBwYXJhbSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn0gW2F0dHJpYnV0ZXNdIC0gT2JqZWN0IGRldGFpbGluZyB0aGUgbWFwcGluZyBvZiB2ZXJ0ZXggc2hhZGVyXG4gKiBhdHRyaWJ1dGUgbmFtZXMgdG8gc2VtYW50aWNzIFNFTUFOVElDXyouIFRoaXMgZW5hYmxlcyB0aGUgZW5naW5lIHRvIG1hdGNoIHZlcnRleCBidWZmZXIgZGF0YSBhc1xuICogaW5wdXRzIHRvIHRoZSBzaGFkZXIuIERlZmF1bHRzIHRvIHVuZGVmaW5lZCwgd2hpY2ggZ2VuZXJhdGVzIHRoZSBkZWZhdWx0IGF0dHJpYnV0ZXMuXG4gKiBAcGFyYW0ge2Jvb2xlYW59IFt1c2VUcmFuc2Zvcm1GZWVkYmFja10gLSBXaGV0aGVyIHRvIHVzZSB0cmFuc2Zvcm0gZmVlZGJhY2suIERlZmF1bHRzIHRvIGZhbHNlLlxuICogQHJldHVybnMge1NoYWRlcn0gVGhlIG5ld2x5IGNyZWF0ZWQgc2hhZGVyLlxuICovXG5mdW5jdGlvbiBjcmVhdGVTaGFkZXJGcm9tQ29kZShkZXZpY2UsIHZzQ29kZSwgZnNDb2RlLCB1bmlxdWVOYW1lLCBhdHRyaWJ1dGVzLCB1c2VUcmFuc2Zvcm1GZWVkYmFjayA9IGZhbHNlKSB7XG5cbiAgICAvLyB0aGUgZnVuY3Rpb24gc2lnbmF0dXJlIGhhcyBjaGFuZ2VkLCBmYWlsIGlmIGNhbGxlZCBpbmNvcnJlY3RseVxuICAgIERlYnVnLmFzc2VydCh0eXBlb2YgYXR0cmlidXRlcyAhPT0gJ2Jvb2xlYW4nKTtcblxuICAgIGNvbnN0IHByb2dyYW1MaWJyYXJ5ID0gZ2V0UHJvZ3JhbUxpYnJhcnkoZGV2aWNlKTtcbiAgICBsZXQgc2hhZGVyID0gcHJvZ3JhbUxpYnJhcnkuZ2V0Q2FjaGVkU2hhZGVyKHVuaXF1ZU5hbWUpO1xuICAgIGlmICghc2hhZGVyKSB7XG4gICAgICAgIHNoYWRlciA9IG5ldyBTaGFkZXIoZGV2aWNlLCBTaGFkZXJVdGlscy5jcmVhdGVEZWZpbml0aW9uKGRldmljZSwge1xuICAgICAgICAgICAgbmFtZTogdW5pcXVlTmFtZSxcbiAgICAgICAgICAgIHZlcnRleENvZGU6IHZzQ29kZSxcbiAgICAgICAgICAgIGZyYWdtZW50Q29kZTogZnNDb2RlLFxuICAgICAgICAgICAgYXR0cmlidXRlczogYXR0cmlidXRlcyxcbiAgICAgICAgICAgIHVzZVRyYW5zZm9ybUZlZWRiYWNrOiB1c2VUcmFuc2Zvcm1GZWVkYmFja1xuICAgICAgICB9KSk7XG4gICAgICAgIHByb2dyYW1MaWJyYXJ5LnNldENhY2hlZFNoYWRlcih1bmlxdWVOYW1lLCBzaGFkZXIpO1xuICAgIH1cbiAgICByZXR1cm4gc2hhZGVyO1xufVxuXG4vKipcbiAqIFByb2Nlc3Mgc2hhZGVyIHVzaW5nIHNoYWRlciBwcm9jZXNzaW5nIG9wdGlvbnMsIHV0aWxpemluZyBjYWNoZSBvZiB0aGUgUHJvZ3JhbUxpYnJhcnlcbiAqXG4gKiBAcGFyYW0ge1NoYWRlcn0gc2hhZGVyIC0gVGhlIHNoYWRlciB0byBiZSBwcm9jZXNzZWQuXG4gKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXByb2Nlc3Nvci1vcHRpb25zLmpzJykuU2hhZGVyUHJvY2Vzc29yT3B0aW9uc30gcHJvY2Vzc2luZ09wdGlvbnMgLVxuICogVGhlIHNoYWRlciBwcm9jZXNzaW5nIG9wdGlvbnMuXG4gKiBAcmV0dXJucyB7U2hhZGVyfSBUaGUgcHJvY2Vzc2VkIHNoYWRlci5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gcHJvY2Vzc1NoYWRlcihzaGFkZXIsIHByb2Nlc3NpbmdPcHRpb25zKSB7XG5cbiAgICBEZWJ1Zy5hc3NlcnQoc2hhZGVyKTtcbiAgICBjb25zdCBzaGFkZXJEZWZpbml0aW9uID0gc2hhZGVyLmRlZmluaXRpb247XG5cbiAgICAvLyAnc2hhZGVyJyBnZW5lcmF0b3IgZm9yIGEgbWF0ZXJpYWwgLSBzaW1wbHkgcmV0dXJuIGV4aXN0aW5nIHNoYWRlciBkZWZpbml0aW9uLiBVc2UgZ2VuZXJhdG9yIGFuZCBnZXRQcm9ncmFtXG4gICAgLy8gdG8gYWxsb3cgZm9yIHNoYWRlciBwcm9jZXNzaW5nIHRvIGJlIGNhY2hlZFxuICAgIGNvbnN0IG5hbWUgPSBzaGFkZXJEZWZpbml0aW9uLm5hbWUgPz8gJ3NoYWRlcic7XG4gICAgY29uc3Qga2V5ID0gYCR7bmFtZX0taWQtJHtzaGFkZXIuaWR9YDtcbiAgICBjb25zdCBtYXRlcmlhbEdlbmVyYXRvciA9IHtcbiAgICAgICAgZ2VuZXJhdGVLZXk6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICAvLyB1bmlxdWUgbmFtZSBiYXNlZCBvZiB0aGUgc2hhZGVyIGlkXG4gICAgICAgICAgICByZXR1cm4ga2V5O1xuICAgICAgICB9LFxuXG4gICAgICAgIGNyZWF0ZVNoYWRlckRlZmluaXRpb246IGZ1bmN0aW9uIChkZXZpY2UsIG9wdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybiBzaGFkZXJEZWZpbml0aW9uO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8vIHRlbXBvcmFyaWx5IHJlZ2lzdGVyIHRoZSBwcm9ncmFtIGdlbmVyYXRvclxuICAgIGNvbnN0IGxpYnJhcnlNb2R1bGVOYW1lID0gJ3NoYWRlcic7XG4gICAgY29uc3QgbGlicmFyeSA9IGdldFByb2dyYW1MaWJyYXJ5KHNoYWRlci5kZXZpY2UpO1xuICAgIERlYnVnLmFzc2VydCghbGlicmFyeS5pc1JlZ2lzdGVyZWQobGlicmFyeU1vZHVsZU5hbWUpKTtcbiAgICBsaWJyYXJ5LnJlZ2lzdGVyKGxpYnJhcnlNb2R1bGVOYW1lLCBtYXRlcmlhbEdlbmVyYXRvcik7XG5cbiAgICAvLyBnZW5lcmF0ZSBzaGFkZXIgdmFyaWFudCAtIGl0cyB0aGUgc2FtZSBzaGFkZXIsIGJ1dCB3aXRoIGRpZmZlcmVudCBwcm9jZXNzaW5nIG9wdGlvbnNcbiAgICBjb25zdCB2YXJpYW50ID0gbGlicmFyeS5nZXRQcm9ncmFtKGxpYnJhcnlNb2R1bGVOYW1lLCB7fSwgcHJvY2Vzc2luZ09wdGlvbnMpO1xuXG4gICAgLy8gdW5yZWdpc3RlciBpdCBhZ2FpblxuICAgIGxpYnJhcnkudW5yZWdpc3RlcihsaWJyYXJ5TW9kdWxlTmFtZSk7XG5cbiAgICByZXR1cm4gdmFyaWFudDtcbn1cblxuXG5zaGFkZXJDaHVua3MuY3JlYXRlU2hhZGVyID0gY3JlYXRlU2hhZGVyO1xuc2hhZGVyQ2h1bmtzLmNyZWF0ZVNoYWRlckZyb21Db2RlID0gY3JlYXRlU2hhZGVyRnJvbUNvZGU7XG5cbmV4cG9ydCB7IGNyZWF0ZVNoYWRlciwgY3JlYXRlU2hhZGVyRnJvbUNvZGUsIHByb2Nlc3NTaGFkZXIgfTtcbiJdLCJuYW1lcyI6WyJjcmVhdGVTaGFkZXIiLCJkZXZpY2UiLCJ2c05hbWUiLCJmc05hbWUiLCJ1c2VUcmFuc2Zvcm1GZWVkYmFjayIsIlNoYWRlciIsIlNoYWRlclV0aWxzIiwiY3JlYXRlRGVmaW5pdGlvbiIsIm5hbWUiLCJ2ZXJ0ZXhDb2RlIiwic2hhZGVyQ2h1bmtzIiwiZnJhZ21lbnRDb2RlIiwiY3JlYXRlU2hhZGVyRnJvbUNvZGUiLCJ2c0NvZGUiLCJmc0NvZGUiLCJ1bmlxdWVOYW1lIiwiYXR0cmlidXRlcyIsIkRlYnVnIiwiYXNzZXJ0IiwicHJvZ3JhbUxpYnJhcnkiLCJnZXRQcm9ncmFtTGlicmFyeSIsInNoYWRlciIsImdldENhY2hlZFNoYWRlciIsInNldENhY2hlZFNoYWRlciIsInByb2Nlc3NTaGFkZXIiLCJwcm9jZXNzaW5nT3B0aW9ucyIsIl9zaGFkZXJEZWZpbml0aW9uJG5hbSIsInNoYWRlckRlZmluaXRpb24iLCJkZWZpbml0aW9uIiwia2V5IiwiaWQiLCJtYXRlcmlhbEdlbmVyYXRvciIsImdlbmVyYXRlS2V5Iiwib3B0aW9ucyIsImNyZWF0ZVNoYWRlckRlZmluaXRpb24iLCJsaWJyYXJ5TW9kdWxlTmFtZSIsImxpYnJhcnkiLCJpc1JlZ2lzdGVyZWQiLCJyZWdpc3RlciIsInZhcmlhbnQiLCJnZXRQcm9ncmFtIiwidW5yZWdpc3RlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTQSxZQUFZQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxvQkFBb0IsR0FBRyxLQUFLLEVBQUU7RUFDeEUsT0FBTyxJQUFJQyxNQUFNLENBQUNKLE1BQU0sRUFBRUssV0FBVyxDQUFDQyxnQkFBZ0IsQ0FBQ04sTUFBTSxFQUFFO0FBQzNETyxJQUFBQSxJQUFJLEVBQUcsQ0FBQSxFQUFFTixNQUFPLENBQUEsQ0FBQSxFQUFHQyxNQUFPLENBQUMsQ0FBQTtBQUMzQk0sSUFBQUEsVUFBVSxFQUFFQyxZQUFZLENBQUNSLE1BQU0sQ0FBQztBQUNoQ1MsSUFBQUEsWUFBWSxFQUFFRCxZQUFZLENBQUNQLE1BQU0sQ0FBQztBQUNsQ0MsSUFBQUEsb0JBQW9CLEVBQUVBLG9CQUFBQTtBQUMxQixHQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ1AsQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTUSxvQkFBb0JBLENBQUNYLE1BQU0sRUFBRVksTUFBTSxFQUFFQyxNQUFNLEVBQUVDLFVBQVUsRUFBRUMsVUFBVSxFQUFFWixvQkFBb0IsR0FBRyxLQUFLLEVBQUU7QUFFeEc7QUFDQWEsRUFBQUEsS0FBSyxDQUFDQyxNQUFNLENBQUMsT0FBT0YsVUFBVSxLQUFLLFNBQVMsQ0FBQyxDQUFBO0FBRTdDLEVBQUEsTUFBTUcsY0FBYyxHQUFHQyxpQkFBaUIsQ0FBQ25CLE1BQU0sQ0FBQyxDQUFBO0FB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
