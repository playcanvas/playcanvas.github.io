/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { TRACEID_SHADER_ALLOC } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { Preprocessor } from '../../core/preprocessor.js';
import { DebugGraphics } from './debug-graphics.js';

let id = 0;

/**
 * A shader is a program that is responsible for rendering graphical primitives on a device's
 * graphics processor. The shader is generated from a shader definition. This shader definition
 * specifies the code for processing vertices and fragments processed by the GPU. The language of
 * the code is GLSL (or more specifically ESSL, the OpenGL ES Shading Language). The shader
 * definition also describes how the PlayCanvas engine should map vertex buffer elements onto the
 * attributes specified in the vertex shader code.
 */
class Shader {
  /**
   * Format of the uniform buffer for mesh bind group.
   *
   * @type {import('./uniform-buffer-format.js').UniformBufferFormat}
   */

  /**
   * Format of the bind group for the mesh bind group.
   *
   * @type {import('./bind-group-format.js').BindGroupFormat}
   */

  /**
   * Creates a new Shader instance.
   *
   * Consider {@link createShaderFromCode} as a simpler and more powerful way to create
   * a shader.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
   * used to manage this shader.
   * @param {object} definition - The shader definition from which to build the shader.
   * @param {string} [definition.name] - The name of the shader.
   * @param {Object<string, string>} [definition.attributes] - Object detailing the mapping of
   * vertex shader attribute names to semantics SEMANTIC_*. This enables the engine to match
   * vertex buffer data as inputs to the shader. When not specified, rendering without
   * verex buffer is assumed.
   * @param {string} definition.vshader - Vertex shader source (GLSL code).
   * @param {string} [definition.fshader] - Fragment shader source (GLSL code). Optional when
   * useTransformFeedback is specified.
   * @param {boolean} [definition.useTransformFeedback] - Specifies that this shader outputs
   * post-VS data to a buffer.
   * @param {string} [definition.shaderLanguage] - Specifies the shader language of vertex and
   * fragment shaders. Defaults to {@link SHADERLANGUAGE_GLSL}.
   * @example
   * // Create a shader that renders primitives with a solid red color
   * var shaderDefinition = {
   *     attributes: {
   *         aPosition: pc.SEMANTIC_POSITION
   *     },
   *     vshader: [
   *         "attribute vec3 aPosition;",
   *         "",
   *         "void main(void)",
   *         "{",
   *         "    gl_Position = vec4(aPosition, 1.0);",
   *         "}"
   *     ].join("\n"),
   *     fshader: [
   *         "precision " + graphicsDevice.precision + " float;",
   *         "",
   *         "void main(void)",
   *         "{",
   *         "    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);",
   *         "}"
   *     ].join("\n")
   * };
   *
   * var shader = new pc.Shader(graphicsDevice, shaderDefinition);
   */
  constructor(graphicsDevice, definition) {
    this.meshUniformBufferFormat = void 0;
    this.meshBindGroupFormat = void 0;
    this.id = id++;
    this.device = graphicsDevice;
    this.definition = definition;
    this.name = definition.name || 'Untitled';
    Debug.assert(definition.vshader, 'No vertex shader has been specified when creating a shader.');
    Debug.assert(definition.fshader, 'No fragment shader has been specified when creating a shader.');

    // pre-process shader sources
    definition.vshader = Preprocessor.run(definition.vshader);
    definition.fshader = Preprocessor.run(definition.fshader);
    this.init();
    this.impl = graphicsDevice.createShaderImpl(this);
    Debug.trace(TRACEID_SHADER_ALLOC, `Alloc: ${this.label}, stack: ${DebugGraphics.toString()}`, {
      instance: this
    });
  }

  /**
   * Initialize a shader back to its default state.
   *
   * @private
   */
  init() {
    this.ready = false;
    this.failed = false;
  }
  get label() {
    return `Shader Id ${this.id} ${this.name}`;
  }

  /**
   * Frees resources associated with this shader.
   */
  destroy() {
    Debug.trace(TRACEID_SHADER_ALLOC, `DeAlloc: Id ${this.id} ${this.name}`);
    this.device.onDestroyShader(this);
    this.impl.destroy(this);
  }

  /**
   * Called when the WebGL context was lost. It releases all context related resources.
   *
   * @ignore
   */
  loseContext() {
    this.init();
    this.impl.loseContext();
  }
  restoreContext() {
    this.impl.restoreContext(this.device, this);
  }
}

export { Shader };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRSQUNFSURfU0hBREVSX0FMTE9DIH0gZnJvbSAnLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFByZXByb2Nlc3NvciB9IGZyb20gJy4uLy4uL2NvcmUvcHJlcHJvY2Vzc29yLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuL2RlYnVnLWdyYXBoaWNzLmpzJztcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIHNoYWRlciBpcyBhIHByb2dyYW0gdGhhdCBpcyByZXNwb25zaWJsZSBmb3IgcmVuZGVyaW5nIGdyYXBoaWNhbCBwcmltaXRpdmVzIG9uIGEgZGV2aWNlJ3NcbiAqIGdyYXBoaWNzIHByb2Nlc3Nvci4gVGhlIHNoYWRlciBpcyBnZW5lcmF0ZWQgZnJvbSBhIHNoYWRlciBkZWZpbml0aW9uLiBUaGlzIHNoYWRlciBkZWZpbml0aW9uXG4gKiBzcGVjaWZpZXMgdGhlIGNvZGUgZm9yIHByb2Nlc3NpbmcgdmVydGljZXMgYW5kIGZyYWdtZW50cyBwcm9jZXNzZWQgYnkgdGhlIEdQVS4gVGhlIGxhbmd1YWdlIG9mXG4gKiB0aGUgY29kZSBpcyBHTFNMIChvciBtb3JlIHNwZWNpZmljYWxseSBFU1NMLCB0aGUgT3BlbkdMIEVTIFNoYWRpbmcgTGFuZ3VhZ2UpLiBUaGUgc2hhZGVyXG4gKiBkZWZpbml0aW9uIGFsc28gZGVzY3JpYmVzIGhvdyB0aGUgUGxheUNhbnZhcyBlbmdpbmUgc2hvdWxkIG1hcCB2ZXJ0ZXggYnVmZmVyIGVsZW1lbnRzIG9udG8gdGhlXG4gKiBhdHRyaWJ1dGVzIHNwZWNpZmllZCBpbiB0aGUgdmVydGV4IHNoYWRlciBjb2RlLlxuICovXG5jbGFzcyBTaGFkZXIge1xuICAgIC8qKlxuICAgICAqIEZvcm1hdCBvZiB0aGUgdW5pZm9ybSBidWZmZXIgZm9yIG1lc2ggYmluZCBncm91cC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJykuVW5pZm9ybUJ1ZmZlckZvcm1hdH1cbiAgICAgKi9cbiAgICBtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDtcblxuICAgIC8qKlxuICAgICAqIEZvcm1hdCBvZiB0aGUgYmluZCBncm91cCBmb3IgdGhlIG1lc2ggYmluZCBncm91cC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYmluZC1ncm91cC1mb3JtYXQuanMnKS5CaW5kR3JvdXBGb3JtYXR9XG4gICAgICovXG4gICAgbWVzaEJpbmRHcm91cEZvcm1hdDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgU2hhZGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQ29uc2lkZXIge0BsaW5rIGNyZWF0ZVNoYWRlckZyb21Db2RlfSBhcyBhIHNpbXBsZXIgYW5kIG1vcmUgcG93ZXJmdWwgd2F5IHRvIGNyZWF0ZVxuICAgICAqIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAqIHVzZWQgdG8gbWFuYWdlIHRoaXMgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkZWZpbml0aW9uIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uIGZyb20gd2hpY2ggdG8gYnVpbGQgdGhlIHNoYWRlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2RlZmluaXRpb24ubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn0gW2RlZmluaXRpb24uYXR0cmlidXRlc10gLSBPYmplY3QgZGV0YWlsaW5nIHRoZSBtYXBwaW5nIG9mXG4gICAgICogdmVydGV4IHNoYWRlciBhdHRyaWJ1dGUgbmFtZXMgdG8gc2VtYW50aWNzIFNFTUFOVElDXyouIFRoaXMgZW5hYmxlcyB0aGUgZW5naW5lIHRvIG1hdGNoXG4gICAgICogdmVydGV4IGJ1ZmZlciBkYXRhIGFzIGlucHV0cyB0byB0aGUgc2hhZGVyLiBXaGVuIG5vdCBzcGVjaWZpZWQsIHJlbmRlcmluZyB3aXRob3V0XG4gICAgICogdmVyZXggYnVmZmVyIGlzIGFzc3VtZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGRlZmluaXRpb24udnNoYWRlciAtIFZlcnRleCBzaGFkZXIgc291cmNlIChHTFNMIGNvZGUpLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGVmaW5pdGlvbi5mc2hhZGVyXSAtIEZyYWdtZW50IHNoYWRlciBzb3VyY2UgKEdMU0wgY29kZSkuIE9wdGlvbmFsIHdoZW5cbiAgICAgKiB1c2VUcmFuc2Zvcm1GZWVkYmFjayBpcyBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVmaW5pdGlvbi51c2VUcmFuc2Zvcm1GZWVkYmFja10gLSBTcGVjaWZpZXMgdGhhdCB0aGlzIHNoYWRlciBvdXRwdXRzXG4gICAgICogcG9zdC1WUyBkYXRhIHRvIGEgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGVmaW5pdGlvbi5zaGFkZXJMYW5ndWFnZV0gLSBTcGVjaWZpZXMgdGhlIHNoYWRlciBsYW5ndWFnZSBvZiB2ZXJ0ZXggYW5kXG4gICAgICogZnJhZ21lbnQgc2hhZGVycy4gRGVmYXVsdHMgdG8ge0BsaW5rIFNIQURFUkxBTkdVQUdFX0dMU0x9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgc2hhZGVyIHRoYXQgcmVuZGVycyBwcmltaXRpdmVzIHdpdGggYSBzb2xpZCByZWQgY29sb3JcbiAgICAgKiB2YXIgc2hhZGVyRGVmaW5pdGlvbiA9IHtcbiAgICAgKiAgICAgYXR0cmlidXRlczoge1xuICAgICAqICAgICAgICAgYVBvc2l0aW9uOiBwYy5TRU1BTlRJQ19QT1NJVElPTlxuICAgICAqICAgICB9LFxuICAgICAqICAgICB2c2hhZGVyOiBbXG4gICAgICogICAgICAgICBcImF0dHJpYnV0ZSB2ZWMzIGFQb3NpdGlvbjtcIixcbiAgICAgKiAgICAgICAgIFwiXCIsXG4gICAgICogICAgICAgICBcInZvaWQgbWFpbih2b2lkKVwiLFxuICAgICAqICAgICAgICAgXCJ7XCIsXG4gICAgICogICAgICAgICBcIiAgICBnbF9Qb3NpdGlvbiA9IHZlYzQoYVBvc2l0aW9uLCAxLjApO1wiLFxuICAgICAqICAgICAgICAgXCJ9XCJcbiAgICAgKiAgICAgXS5qb2luKFwiXFxuXCIpLFxuICAgICAqICAgICBmc2hhZGVyOiBbXG4gICAgICogICAgICAgICBcInByZWNpc2lvbiBcIiArIGdyYXBoaWNzRGV2aWNlLnByZWNpc2lvbiArIFwiIGZsb2F0O1wiLFxuICAgICAqICAgICAgICAgXCJcIixcbiAgICAgKiAgICAgICAgIFwidm9pZCBtYWluKHZvaWQpXCIsXG4gICAgICogICAgICAgICBcIntcIixcbiAgICAgKiAgICAgICAgIFwiICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMS4wLCAwLjAsIDAuMCwgMS4wKTtcIixcbiAgICAgKiAgICAgICAgIFwifVwiXG4gICAgICogICAgIF0uam9pbihcIlxcblwiKVxuICAgICAqIH07XG4gICAgICpcbiAgICAgKiB2YXIgc2hhZGVyID0gbmV3IHBjLlNoYWRlcihncmFwaGljc0RldmljZSwgc2hhZGVyRGVmaW5pdGlvbik7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZ3JhcGhpY3NEZXZpY2UsIGRlZmluaXRpb24pIHtcbiAgICAgICAgdGhpcy5pZCA9IGlkKys7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIHRoaXMuZGVmaW5pdGlvbiA9IGRlZmluaXRpb247XG4gICAgICAgIHRoaXMubmFtZSA9IGRlZmluaXRpb24ubmFtZSB8fCAnVW50aXRsZWQnO1xuXG4gICAgICAgIERlYnVnLmFzc2VydChkZWZpbml0aW9uLnZzaGFkZXIsICdObyB2ZXJ0ZXggc2hhZGVyIGhhcyBiZWVuIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIGEgc2hhZGVyLicpO1xuICAgICAgICBEZWJ1Zy5hc3NlcnQoZGVmaW5pdGlvbi5mc2hhZGVyLCAnTm8gZnJhZ21lbnQgc2hhZGVyIGhhcyBiZWVuIHNwZWNpZmllZCB3aGVuIGNyZWF0aW5nIGEgc2hhZGVyLicpO1xuXG4gICAgICAgIC8vIHByZS1wcm9jZXNzIHNoYWRlciBzb3VyY2VzXG4gICAgICAgIGRlZmluaXRpb24udnNoYWRlciA9IFByZXByb2Nlc3Nvci5ydW4oZGVmaW5pdGlvbi52c2hhZGVyKTtcbiAgICAgICAgZGVmaW5pdGlvbi5mc2hhZGVyID0gUHJlcHJvY2Vzc29yLnJ1bihkZWZpbml0aW9uLmZzaGFkZXIpO1xuXG4gICAgICAgIHRoaXMuaW5pdCgpO1xuXG4gICAgICAgIHRoaXMuaW1wbCA9IGdyYXBoaWNzRGV2aWNlLmNyZWF0ZVNoYWRlckltcGwodGhpcyk7XG5cbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9TSEFERVJfQUxMT0MsIGBBbGxvYzogJHt0aGlzLmxhYmVsfSwgc3RhY2s6ICR7RGVidWdHcmFwaGljcy50b1N0cmluZygpfWAsIHtcbiAgICAgICAgICAgIGluc3RhbmNlOiB0aGlzXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgYSBzaGFkZXIgYmFjayB0byBpdHMgZGVmYXVsdCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgaW5pdCgpIHtcbiAgICAgICAgdGhpcy5yZWFkeSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmZhaWxlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIGdldCBsYWJlbCgpIHtcbiAgICAgICAgcmV0dXJuIGBTaGFkZXIgSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX1gO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZyZWVzIHJlc291cmNlcyBhc3NvY2lhdGVkIHdpdGggdGhpcyBzaGFkZXIuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgRGVidWcudHJhY2UoVFJBQ0VJRF9TSEFERVJfQUxMT0MsIGBEZUFsbG9jOiBJZCAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfWApO1xuICAgICAgICB0aGlzLmRldmljZS5vbkRlc3Ryb3lTaGFkZXIodGhpcyk7XG4gICAgICAgIHRoaXMuaW1wbC5kZXN0cm95KHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENhbGxlZCB3aGVuIHRoZSBXZWJHTCBjb250ZXh0IHdhcyBsb3N0LiBJdCByZWxlYXNlcyBhbGwgY29udGV4dCByZWxhdGVkIHJlc291cmNlcy5cbiAgICAgKlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBsb3NlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbml0KCk7XG4gICAgICAgIHRoaXMuaW1wbC5sb3NlQ29udGV4dCgpO1xuICAgIH1cblxuICAgIHJlc3RvcmVDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmltcGwucmVzdG9yZUNvbnRleHQodGhpcy5kZXZpY2UsIHRoaXMpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgU2hhZGVyIH07XG4iXSwibmFtZXMiOlsiaWQiLCJTaGFkZXIiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwiZGVmaW5pdGlvbiIsIm1lc2hVbmlmb3JtQnVmZmVyRm9ybWF0IiwibWVzaEJpbmRHcm91cEZvcm1hdCIsImRldmljZSIsIm5hbWUiLCJEZWJ1ZyIsImFzc2VydCIsInZzaGFkZXIiLCJmc2hhZGVyIiwiUHJlcHJvY2Vzc29yIiwicnVuIiwiaW5pdCIsImltcGwiLCJjcmVhdGVTaGFkZXJJbXBsIiwidHJhY2UiLCJUUkFDRUlEX1NIQURFUl9BTExPQyIsImxhYmVsIiwiRGVidWdHcmFwaGljcyIsInRvU3RyaW5nIiwiaW5zdGFuY2UiLCJyZWFkeSIsImZhaWxlZCIsImRlc3Ryb3kiLCJvbkRlc3Ryb3lTaGFkZXIiLCJsb3NlQ29udGV4dCIsInJlc3RvcmVDb250ZXh0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBS0EsSUFBSUEsRUFBRSxHQUFHLENBQUMsQ0FBQTs7QUFFVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsTUFBTSxDQUFDO0FBQ1Q7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBVyxDQUFDQyxjQUFjLEVBQUVDLFVBQVUsRUFBRTtBQUFBLElBQUEsSUFBQSxDQXhEeENDLHVCQUF1QixHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBT3ZCQyxtQkFBbUIsR0FBQSxLQUFBLENBQUEsQ0FBQTtBQWtEZixJQUFBLElBQUksQ0FBQ04sRUFBRSxHQUFHQSxFQUFFLEVBQUUsQ0FBQTtJQUNkLElBQUksQ0FBQ08sTUFBTSxHQUFHSixjQUFjLENBQUE7SUFDNUIsSUFBSSxDQUFDQyxVQUFVLEdBQUdBLFVBQVUsQ0FBQTtBQUM1QixJQUFBLElBQUksQ0FBQ0ksSUFBSSxHQUFHSixVQUFVLENBQUNJLElBQUksSUFBSSxVQUFVLENBQUE7SUFFekNDLEtBQUssQ0FBQ0MsTUFBTSxDQUFDTixVQUFVLENBQUNPLE9BQU8sRUFBRSw2REFBNkQsQ0FBQyxDQUFBO0lBQy9GRixLQUFLLENBQUNDLE1BQU0sQ0FBQ04sVUFBVSxDQUFDUSxPQUFPLEVBQUUsK0RBQStELENBQUMsQ0FBQTs7QUFFakc7SUFDQVIsVUFBVSxDQUFDTyxPQUFPLEdBQUdFLFlBQVksQ0FBQ0MsR0FBRyxDQUFDVixVQUFVLENBQUNPLE9BQU8sQ0FBQyxDQUFBO0lBQ3pEUCxVQUFVLENBQUNRLE9BQU8sR0FBR0MsWUFBWSxDQUFDQyxHQUFHLENBQUNWLFVBQVUsQ0FBQ1EsT0FBTyxDQUFDLENBQUE7SUFFekQsSUFBSSxDQUFDRyxJQUFJLEVBQUUsQ0FBQTtJQUVYLElBQUksQ0FBQ0MsSUFBSSxHQUFHYixjQUFjLENBQUNjLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFBO0FBRWpEUixJQUFBQSxLQUFLLENBQUNTLEtBQUssQ0FBQ0Msb0JBQW9CLEVBQUcsQ0FBUyxPQUFBLEVBQUEsSUFBSSxDQUFDQyxLQUFNLFlBQVdDLGFBQWEsQ0FBQ0MsUUFBUSxFQUFHLEVBQUMsRUFBRTtBQUMxRkMsTUFBQUEsUUFBUSxFQUFFLElBQUE7QUFDZCxLQUFDLENBQUMsQ0FBQTtBQUNOLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJUixFQUFBQSxJQUFJLEdBQUc7SUFDSCxJQUFJLENBQUNTLEtBQUssR0FBRyxLQUFLLENBQUE7SUFDbEIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsS0FBSyxDQUFBO0FBQ3ZCLEdBQUE7QUFFQSxFQUFBLElBQUlMLEtBQUssR0FBRztJQUNSLE9BQVEsQ0FBQSxVQUFBLEVBQVksSUFBSSxDQUFDcEIsRUFBRyxJQUFHLElBQUksQ0FBQ1EsSUFBSyxDQUFDLENBQUEsQ0FBQTtBQUM5QyxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNJa0IsRUFBQUEsT0FBTyxHQUFHO0FBQ05qQixJQUFBQSxLQUFLLENBQUNTLEtBQUssQ0FBQ0Msb0JBQW9CLEVBQUcsQ0FBYyxZQUFBLEVBQUEsSUFBSSxDQUFDbkIsRUFBRyxDQUFHLENBQUEsRUFBQSxJQUFJLENBQUNRLElBQUssRUFBQyxDQUFDLENBQUE7QUFDeEUsSUFBQSxJQUFJLENBQUNELE1BQU0sQ0FBQ29CLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUNqQyxJQUFBLElBQUksQ0FBQ1gsSUFBSSxDQUFDVSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7QUFDM0IsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0lFLEVBQUFBLFdBQVcsR0FBRztJQUNWLElBQUksQ0FBQ2IsSUFBSSxFQUFFLENBQUE7QUFDWCxJQUFBLElBQUksQ0FBQ0MsSUFBSSxDQUFDWSxXQUFXLEVBQUUsQ0FBQTtBQUMzQixHQUFBO0FBRUFDLEVBQUFBLGNBQWMsR0FBRztJQUNiLElBQUksQ0FBQ2IsSUFBSSxDQUFDYSxjQUFjLENBQUMsSUFBSSxDQUFDdEIsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQy9DLEdBQUE7QUFDSjs7OzsifQ==
