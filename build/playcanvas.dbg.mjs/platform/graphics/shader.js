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
   * const shaderDefinition = {
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
   * const shader = new pc.Shader(graphicsDevice, shaderDefinition);
   */
  constructor(graphicsDevice, definition) {
    /**
     * Format of the uniform buffer for mesh bind group.
     *
     * @type {import('./uniform-buffer-format.js').UniformBufferFormat}
     */
    this.meshUniformBufferFormat = void 0;
    /**
     * Format of the bind group for the mesh bind group.
     *
     * @type {import('./bind-group-format.js').BindGroupFormat}
     */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRSQUNFSURfU0hBREVSX0FMTE9DIH0gZnJvbSAnLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFByZXByb2Nlc3NvciB9IGZyb20gJy4uLy4uL2NvcmUvcHJlcHJvY2Vzc29yLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuL2RlYnVnLWdyYXBoaWNzLmpzJztcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIHNoYWRlciBpcyBhIHByb2dyYW0gdGhhdCBpcyByZXNwb25zaWJsZSBmb3IgcmVuZGVyaW5nIGdyYXBoaWNhbCBwcmltaXRpdmVzIG9uIGEgZGV2aWNlJ3NcbiAqIGdyYXBoaWNzIHByb2Nlc3Nvci4gVGhlIHNoYWRlciBpcyBnZW5lcmF0ZWQgZnJvbSBhIHNoYWRlciBkZWZpbml0aW9uLiBUaGlzIHNoYWRlciBkZWZpbml0aW9uXG4gKiBzcGVjaWZpZXMgdGhlIGNvZGUgZm9yIHByb2Nlc3NpbmcgdmVydGljZXMgYW5kIGZyYWdtZW50cyBwcm9jZXNzZWQgYnkgdGhlIEdQVS4gVGhlIGxhbmd1YWdlIG9mXG4gKiB0aGUgY29kZSBpcyBHTFNMIChvciBtb3JlIHNwZWNpZmljYWxseSBFU1NMLCB0aGUgT3BlbkdMIEVTIFNoYWRpbmcgTGFuZ3VhZ2UpLiBUaGUgc2hhZGVyXG4gKiBkZWZpbml0aW9uIGFsc28gZGVzY3JpYmVzIGhvdyB0aGUgUGxheUNhbnZhcyBlbmdpbmUgc2hvdWxkIG1hcCB2ZXJ0ZXggYnVmZmVyIGVsZW1lbnRzIG9udG8gdGhlXG4gKiBhdHRyaWJ1dGVzIHNwZWNpZmllZCBpbiB0aGUgdmVydGV4IHNoYWRlciBjb2RlLlxuICovXG5jbGFzcyBTaGFkZXIge1xuICAgIC8qKlxuICAgICAqIEZvcm1hdCBvZiB0aGUgdW5pZm9ybSBidWZmZXIgZm9yIG1lc2ggYmluZCBncm91cC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJykuVW5pZm9ybUJ1ZmZlckZvcm1hdH1cbiAgICAgKi9cbiAgICBtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDtcblxuICAgIC8qKlxuICAgICAqIEZvcm1hdCBvZiB0aGUgYmluZCBncm91cCBmb3IgdGhlIG1lc2ggYmluZCBncm91cC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYmluZC1ncm91cC1mb3JtYXQuanMnKS5CaW5kR3JvdXBGb3JtYXR9XG4gICAgICovXG4gICAgbWVzaEJpbmRHcm91cEZvcm1hdDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgU2hhZGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQ29uc2lkZXIge0BsaW5rIGNyZWF0ZVNoYWRlckZyb21Db2RlfSBhcyBhIHNpbXBsZXIgYW5kIG1vcmUgcG93ZXJmdWwgd2F5IHRvIGNyZWF0ZVxuICAgICAqIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAqIHVzZWQgdG8gbWFuYWdlIHRoaXMgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkZWZpbml0aW9uIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uIGZyb20gd2hpY2ggdG8gYnVpbGQgdGhlIHNoYWRlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2RlZmluaXRpb24ubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn0gW2RlZmluaXRpb24uYXR0cmlidXRlc10gLSBPYmplY3QgZGV0YWlsaW5nIHRoZSBtYXBwaW5nIG9mXG4gICAgICogdmVydGV4IHNoYWRlciBhdHRyaWJ1dGUgbmFtZXMgdG8gc2VtYW50aWNzIFNFTUFOVElDXyouIFRoaXMgZW5hYmxlcyB0aGUgZW5naW5lIHRvIG1hdGNoXG4gICAgICogdmVydGV4IGJ1ZmZlciBkYXRhIGFzIGlucHV0cyB0byB0aGUgc2hhZGVyLiBXaGVuIG5vdCBzcGVjaWZpZWQsIHJlbmRlcmluZyB3aXRob3V0XG4gICAgICogdmVyZXggYnVmZmVyIGlzIGFzc3VtZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGRlZmluaXRpb24udnNoYWRlciAtIFZlcnRleCBzaGFkZXIgc291cmNlIChHTFNMIGNvZGUpLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGVmaW5pdGlvbi5mc2hhZGVyXSAtIEZyYWdtZW50IHNoYWRlciBzb3VyY2UgKEdMU0wgY29kZSkuIE9wdGlvbmFsIHdoZW5cbiAgICAgKiB1c2VUcmFuc2Zvcm1GZWVkYmFjayBpcyBzcGVjaWZpZWQuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbZGVmaW5pdGlvbi51c2VUcmFuc2Zvcm1GZWVkYmFja10gLSBTcGVjaWZpZXMgdGhhdCB0aGlzIHNoYWRlciBvdXRwdXRzXG4gICAgICogcG9zdC1WUyBkYXRhIHRvIGEgYnVmZmVyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbZGVmaW5pdGlvbi5zaGFkZXJMYW5ndWFnZV0gLSBTcGVjaWZpZXMgdGhlIHNoYWRlciBsYW5ndWFnZSBvZiB2ZXJ0ZXggYW5kXG4gICAgICogZnJhZ21lbnQgc2hhZGVycy4gRGVmYXVsdHMgdG8ge0BsaW5rIFNIQURFUkxBTkdVQUdFX0dMU0x9LlxuICAgICAqIEBleGFtcGxlXG4gICAgICogLy8gQ3JlYXRlIGEgc2hhZGVyIHRoYXQgcmVuZGVycyBwcmltaXRpdmVzIHdpdGggYSBzb2xpZCByZWQgY29sb3JcbiAgICAgKiBjb25zdCBzaGFkZXJEZWZpbml0aW9uID0ge1xuICAgICAqICAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICogICAgICAgICBhUG9zaXRpb246IHBjLlNFTUFOVElDX1BPU0lUSU9OXG4gICAgICogICAgIH0sXG4gICAgICogICAgIHZzaGFkZXI6IFtcbiAgICAgKiAgICAgICAgIFwiYXR0cmlidXRlIHZlYzMgYVBvc2l0aW9uO1wiLFxuICAgICAqICAgICAgICAgXCJcIixcbiAgICAgKiAgICAgICAgIFwidm9pZCBtYWluKHZvaWQpXCIsXG4gICAgICogICAgICAgICBcIntcIixcbiAgICAgKiAgICAgICAgIFwiICAgIGdsX1Bvc2l0aW9uID0gdmVjNChhUG9zaXRpb24sIDEuMCk7XCIsXG4gICAgICogICAgICAgICBcIn1cIlxuICAgICAqICAgICBdLmpvaW4oXCJcXG5cIiksXG4gICAgICogICAgIGZzaGFkZXI6IFtcbiAgICAgKiAgICAgICAgIFwicHJlY2lzaW9uIFwiICsgZ3JhcGhpY3NEZXZpY2UucHJlY2lzaW9uICsgXCIgZmxvYXQ7XCIsXG4gICAgICogICAgICAgICBcIlwiLFxuICAgICAqICAgICAgICAgXCJ2b2lkIG1haW4odm9pZClcIixcbiAgICAgKiAgICAgICAgIFwie1wiLFxuICAgICAqICAgICAgICAgXCIgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgxLjAsIDAuMCwgMC4wLCAxLjApO1wiLFxuICAgICAqICAgICAgICAgXCJ9XCJcbiAgICAgKiAgICAgXS5qb2luKFwiXFxuXCIpXG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIGNvbnN0IHNoYWRlciA9IG5ldyBwYy5TaGFkZXIoZ3JhcGhpY3NEZXZpY2UsIHNoYWRlckRlZmluaXRpb24pO1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlLCBkZWZpbml0aW9uKSB7XG4gICAgICAgIHRoaXMuaWQgPSBpZCsrO1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuICAgICAgICB0aGlzLmRlZmluaXRpb24gPSBkZWZpbml0aW9uO1xuICAgICAgICB0aGlzLm5hbWUgPSBkZWZpbml0aW9uLm5hbWUgfHwgJ1VudGl0bGVkJztcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoZGVmaW5pdGlvbi52c2hhZGVyLCAnTm8gdmVydGV4IHNoYWRlciBoYXMgYmVlbiBzcGVjaWZpZWQgd2hlbiBjcmVhdGluZyBhIHNoYWRlci4nKTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGRlZmluaXRpb24uZnNoYWRlciwgJ05vIGZyYWdtZW50IHNoYWRlciBoYXMgYmVlbiBzcGVjaWZpZWQgd2hlbiBjcmVhdGluZyBhIHNoYWRlci4nKTtcblxuICAgICAgICAvLyBwcmUtcHJvY2VzcyBzaGFkZXIgc291cmNlc1xuICAgICAgICBkZWZpbml0aW9uLnZzaGFkZXIgPSBQcmVwcm9jZXNzb3IucnVuKGRlZmluaXRpb24udnNoYWRlcik7XG4gICAgICAgIGRlZmluaXRpb24uZnNoYWRlciA9IFByZXByb2Nlc3Nvci5ydW4oZGVmaW5pdGlvbi5mc2hhZGVyKTtcblxuICAgICAgICB0aGlzLmluaXQoKTtcblxuICAgICAgICB0aGlzLmltcGwgPSBncmFwaGljc0RldmljZS5jcmVhdGVTaGFkZXJJbXBsKHRoaXMpO1xuXG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfU0hBREVSX0FMTE9DLCBgQWxsb2M6ICR7dGhpcy5sYWJlbH0sIHN0YWNrOiAke0RlYnVnR3JhcGhpY3MudG9TdHJpbmcoKX1gLCB7XG4gICAgICAgICAgICBpbnN0YW5jZTogdGhpc1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIGEgc2hhZGVyIGJhY2sgdG8gaXRzIGRlZmF1bHQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIGluaXQoKSB7XG4gICAgICAgIHRoaXMucmVhZHkgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5mYWlsZWQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBnZXQgbGFiZWwoKSB7XG4gICAgICAgIHJldHVybiBgU2hhZGVyIElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9YDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgc2hhZGVyLlxuICAgICAqL1xuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIERlYnVnLnRyYWNlKFRSQUNFSURfU0hBREVSX0FMTE9DLCBgRGVBbGxvYzogSWQgJHt0aGlzLmlkfSAke3RoaXMubmFtZX1gKTtcbiAgICAgICAgdGhpcy5kZXZpY2Uub25EZXN0cm95U2hhZGVyKHRoaXMpO1xuICAgICAgICB0aGlzLmltcGwuZGVzdHJveSh0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUgV2ViR0wgY29udGV4dCB3YXMgbG9zdC4gSXQgcmVsZWFzZXMgYWxsIGNvbnRleHQgcmVsYXRlZCByZXNvdXJjZXMuXG4gICAgICpcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgbG9zZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW5pdCgpO1xuICAgICAgICB0aGlzLmltcGwubG9zZUNvbnRleHQoKTtcbiAgICB9XG5cbiAgICByZXN0b3JlQ29udGV4dCgpIHtcbiAgICAgICAgdGhpcy5pbXBsLnJlc3RvcmVDb250ZXh0KHRoaXMuZGV2aWNlLCB0aGlzKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNoYWRlciB9O1xuIl0sIm5hbWVzIjpbImlkIiwiU2hhZGVyIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImRlZmluaXRpb24iLCJtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdCIsIm1lc2hCaW5kR3JvdXBGb3JtYXQiLCJkZXZpY2UiLCJuYW1lIiwiRGVidWciLCJhc3NlcnQiLCJ2c2hhZGVyIiwiZnNoYWRlciIsIlByZXByb2Nlc3NvciIsInJ1biIsImluaXQiLCJpbXBsIiwiY3JlYXRlU2hhZGVySW1wbCIsInRyYWNlIiwiVFJBQ0VJRF9TSEFERVJfQUxMT0MiLCJsYWJlbCIsIkRlYnVnR3JhcGhpY3MiLCJ0b1N0cmluZyIsImluc3RhbmNlIiwicmVhZHkiLCJmYWlsZWQiLCJkZXN0cm95Iiwib25EZXN0cm95U2hhZGVyIiwibG9zZUNvbnRleHQiLCJyZXN0b3JlQ29udGV4dCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFLQSxJQUFJQSxFQUFFLEdBQUcsQ0FBQyxDQUFBOztBQUVWO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxNQUFNLENBQUM7QUFlVDtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLGNBQWMsRUFBRUMsVUFBVSxFQUFFO0FBN0R4QztBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBSkksSUFBQSxJQUFBLENBS0FDLHVCQUF1QixHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBRXZCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFKSSxJQUFBLElBQUEsQ0FLQUMsbUJBQW1CLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFrRGYsSUFBQSxJQUFJLENBQUNOLEVBQUUsR0FBR0EsRUFBRSxFQUFFLENBQUE7SUFDZCxJQUFJLENBQUNPLE1BQU0sR0FBR0osY0FBYyxDQUFBO0lBQzVCLElBQUksQ0FBQ0MsVUFBVSxHQUFHQSxVQUFVLENBQUE7QUFDNUIsSUFBQSxJQUFJLENBQUNJLElBQUksR0FBR0osVUFBVSxDQUFDSSxJQUFJLElBQUksVUFBVSxDQUFBO0lBRXpDQyxLQUFLLENBQUNDLE1BQU0sQ0FBQ04sVUFBVSxDQUFDTyxPQUFPLEVBQUUsNkRBQTZELENBQUMsQ0FBQTtJQUMvRkYsS0FBSyxDQUFDQyxNQUFNLENBQUNOLFVBQVUsQ0FBQ1EsT0FBTyxFQUFFLCtEQUErRCxDQUFDLENBQUE7O0FBRWpHO0lBQ0FSLFVBQVUsQ0FBQ08sT0FBTyxHQUFHRSxZQUFZLENBQUNDLEdBQUcsQ0FBQ1YsVUFBVSxDQUFDTyxPQUFPLENBQUMsQ0FBQTtJQUN6RFAsVUFBVSxDQUFDUSxPQUFPLEdBQUdDLFlBQVksQ0FBQ0MsR0FBRyxDQUFDVixVQUFVLENBQUNRLE9BQU8sQ0FBQyxDQUFBO0lBRXpELElBQUksQ0FBQ0csSUFBSSxFQUFFLENBQUE7SUFFWCxJQUFJLENBQUNDLElBQUksR0FBR2IsY0FBYyxDQUFDYyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUVqRFIsSUFBQUEsS0FBSyxDQUFDUyxLQUFLLENBQUNDLG9CQUFvQixFQUFHLFVBQVMsSUFBSSxDQUFDQyxLQUFNLENBQUEsU0FBQSxFQUFXQyxhQUFhLENBQUNDLFFBQVEsRUFBRyxFQUFDLEVBQUU7QUFDMUZDLE1BQUFBLFFBQVEsRUFBRSxJQUFBO0FBQ2QsS0FBQyxDQUFDLENBQUE7QUFDTixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSVIsRUFBQUEsSUFBSUEsR0FBRztJQUNILElBQUksQ0FBQ1MsS0FBSyxHQUFHLEtBQUssQ0FBQTtJQUNsQixJQUFJLENBQUNDLE1BQU0sR0FBRyxLQUFLLENBQUE7QUFDdkIsR0FBQTtFQUVBLElBQUlMLEtBQUtBLEdBQUc7SUFDUixPQUFRLENBQUEsVUFBQSxFQUFZLElBQUksQ0FBQ3BCLEVBQUcsSUFBRyxJQUFJLENBQUNRLElBQUssQ0FBQyxDQUFBLENBQUE7QUFDOUMsR0FBQTs7QUFFQTtBQUNKO0FBQ0E7QUFDSWtCLEVBQUFBLE9BQU9BLEdBQUc7QUFDTmpCLElBQUFBLEtBQUssQ0FBQ1MsS0FBSyxDQUFDQyxvQkFBb0IsRUFBRyxDQUFjLFlBQUEsRUFBQSxJQUFJLENBQUNuQixFQUFHLENBQUcsQ0FBQSxFQUFBLElBQUksQ0FBQ1EsSUFBSyxFQUFDLENBQUMsQ0FBQTtBQUN4RSxJQUFBLElBQUksQ0FBQ0QsTUFBTSxDQUFDb0IsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQ2pDLElBQUEsSUFBSSxDQUFDWCxJQUFJLENBQUNVLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUMzQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSUUsRUFBQUEsV0FBV0EsR0FBRztJQUNWLElBQUksQ0FBQ2IsSUFBSSxFQUFFLENBQUE7QUFDWCxJQUFBLElBQUksQ0FBQ0MsSUFBSSxDQUFDWSxXQUFXLEVBQUUsQ0FBQTtBQUMzQixHQUFBO0FBRUFDLEVBQUFBLGNBQWNBLEdBQUc7SUFDYixJQUFJLENBQUNiLElBQUksQ0FBQ2EsY0FBYyxDQUFDLElBQUksQ0FBQ3RCLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMvQyxHQUFBO0FBQ0o7Ozs7In0=
