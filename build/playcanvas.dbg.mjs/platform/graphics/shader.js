/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
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
   * @param {Object<string, string>} definition.attributes - Object detailing the mapping of
   * vertex shader attribute names to semantics SEMANTIC_*. This enables the engine to match
   * vertex buffer data as inputs to the shader.
   * @param {string} definition.vshader - Vertex shader source (GLSL code).
   * @param {string} [definition.fshader] - Fragment shader source (GLSL code). Optional when
   * useTransformFeedback is specified.
   * @param {boolean} [definition.useTransformFeedback] - Specifies that this shader outputs
   * post-VS data to a buffer.
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRSQUNFSURfU0hBREVSX0FMTE9DIH0gZnJvbSAnLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFByZXByb2Nlc3NvciB9IGZyb20gJy4uLy4uL2NvcmUvcHJlcHJvY2Vzc29yLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuL2RlYnVnLWdyYXBoaWNzLmpzJztcblxubGV0IGlkID0gMDtcblxuLyoqXG4gKiBBIHNoYWRlciBpcyBhIHByb2dyYW0gdGhhdCBpcyByZXNwb25zaWJsZSBmb3IgcmVuZGVyaW5nIGdyYXBoaWNhbCBwcmltaXRpdmVzIG9uIGEgZGV2aWNlJ3NcbiAqIGdyYXBoaWNzIHByb2Nlc3Nvci4gVGhlIHNoYWRlciBpcyBnZW5lcmF0ZWQgZnJvbSBhIHNoYWRlciBkZWZpbml0aW9uLiBUaGlzIHNoYWRlciBkZWZpbml0aW9uXG4gKiBzcGVjaWZpZXMgdGhlIGNvZGUgZm9yIHByb2Nlc3NpbmcgdmVydGljZXMgYW5kIGZyYWdtZW50cyBwcm9jZXNzZWQgYnkgdGhlIEdQVS4gVGhlIGxhbmd1YWdlIG9mXG4gKiB0aGUgY29kZSBpcyBHTFNMIChvciBtb3JlIHNwZWNpZmljYWxseSBFU1NMLCB0aGUgT3BlbkdMIEVTIFNoYWRpbmcgTGFuZ3VhZ2UpLiBUaGUgc2hhZGVyXG4gKiBkZWZpbml0aW9uIGFsc28gZGVzY3JpYmVzIGhvdyB0aGUgUGxheUNhbnZhcyBlbmdpbmUgc2hvdWxkIG1hcCB2ZXJ0ZXggYnVmZmVyIGVsZW1lbnRzIG9udG8gdGhlXG4gKiBhdHRyaWJ1dGVzIHNwZWNpZmllZCBpbiB0aGUgdmVydGV4IHNoYWRlciBjb2RlLlxuICovXG5jbGFzcyBTaGFkZXIge1xuICAgIC8qKlxuICAgICAqIEZvcm1hdCBvZiB0aGUgdW5pZm9ybSBidWZmZXIgZm9yIG1lc2ggYmluZCBncm91cC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJykuVW5pZm9ybUJ1ZmZlckZvcm1hdH1cbiAgICAgKi9cbiAgICBtZXNoVW5pZm9ybUJ1ZmZlckZvcm1hdDtcblxuICAgIC8qKlxuICAgICAqIEZvcm1hdCBvZiB0aGUgYmluZCBncm91cCBmb3IgdGhlIG1lc2ggYmluZCBncm91cC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vYmluZC1ncm91cC1mb3JtYXQuanMnKS5CaW5kR3JvdXBGb3JtYXR9XG4gICAgICovXG4gICAgbWVzaEJpbmRHcm91cEZvcm1hdDtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgU2hhZGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQ29uc2lkZXIge0BsaW5rIGNyZWF0ZVNoYWRlckZyb21Db2RlfSBhcyBhIHNpbXBsZXIgYW5kIG1vcmUgcG93ZXJmdWwgd2F5IHRvIGNyZWF0ZVxuICAgICAqIGEgc2hhZGVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAqIHVzZWQgdG8gbWFuYWdlIHRoaXMgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkZWZpbml0aW9uIC0gVGhlIHNoYWRlciBkZWZpbml0aW9uIGZyb20gd2hpY2ggdG8gYnVpbGQgdGhlIHNoYWRlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2RlZmluaXRpb24ubmFtZV0gLSBUaGUgbmFtZSBvZiB0aGUgc2hhZGVyLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0PHN0cmluZywgc3RyaW5nPn0gZGVmaW5pdGlvbi5hdHRyaWJ1dGVzIC0gT2JqZWN0IGRldGFpbGluZyB0aGUgbWFwcGluZyBvZlxuICAgICAqIHZlcnRleCBzaGFkZXIgYXR0cmlidXRlIG5hbWVzIHRvIHNlbWFudGljcyBTRU1BTlRJQ18qLiBUaGlzIGVuYWJsZXMgdGhlIGVuZ2luZSB0byBtYXRjaFxuICAgICAqIHZlcnRleCBidWZmZXIgZGF0YSBhcyBpbnB1dHMgdG8gdGhlIHNoYWRlci5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZGVmaW5pdGlvbi52c2hhZGVyIC0gVmVydGV4IHNoYWRlciBzb3VyY2UgKEdMU0wgY29kZSkuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtkZWZpbml0aW9uLmZzaGFkZXJdIC0gRnJhZ21lbnQgc2hhZGVyIHNvdXJjZSAoR0xTTCBjb2RlKS4gT3B0aW9uYWwgd2hlblxuICAgICAqIHVzZVRyYW5zZm9ybUZlZWRiYWNrIGlzIHNwZWNpZmllZC5cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtkZWZpbml0aW9uLnVzZVRyYW5zZm9ybUZlZWRiYWNrXSAtIFNwZWNpZmllcyB0aGF0IHRoaXMgc2hhZGVyIG91dHB1dHNcbiAgICAgKiBwb3N0LVZTIGRhdGEgdG8gYSBidWZmZXIuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiAvLyBDcmVhdGUgYSBzaGFkZXIgdGhhdCByZW5kZXJzIHByaW1pdGl2ZXMgd2l0aCBhIHNvbGlkIHJlZCBjb2xvclxuICAgICAqIHZhciBzaGFkZXJEZWZpbml0aW9uID0ge1xuICAgICAqICAgICBhdHRyaWJ1dGVzOiB7XG4gICAgICogICAgICAgICBhUG9zaXRpb246IHBjLlNFTUFOVElDX1BPU0lUSU9OXG4gICAgICogICAgIH0sXG4gICAgICogICAgIHZzaGFkZXI6IFtcbiAgICAgKiAgICAgICAgIFwiYXR0cmlidXRlIHZlYzMgYVBvc2l0aW9uO1wiLFxuICAgICAqICAgICAgICAgXCJcIixcbiAgICAgKiAgICAgICAgIFwidm9pZCBtYWluKHZvaWQpXCIsXG4gICAgICogICAgICAgICBcIntcIixcbiAgICAgKiAgICAgICAgIFwiICAgIGdsX1Bvc2l0aW9uID0gdmVjNChhUG9zaXRpb24sIDEuMCk7XCIsXG4gICAgICogICAgICAgICBcIn1cIlxuICAgICAqICAgICBdLmpvaW4oXCJcXG5cIiksXG4gICAgICogICAgIGZzaGFkZXI6IFtcbiAgICAgKiAgICAgICAgIFwicHJlY2lzaW9uIFwiICsgZ3JhcGhpY3NEZXZpY2UucHJlY2lzaW9uICsgXCIgZmxvYXQ7XCIsXG4gICAgICogICAgICAgICBcIlwiLFxuICAgICAqICAgICAgICAgXCJ2b2lkIG1haW4odm9pZClcIixcbiAgICAgKiAgICAgICAgIFwie1wiLFxuICAgICAqICAgICAgICAgXCIgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNCgxLjAsIDAuMCwgMC4wLCAxLjApO1wiLFxuICAgICAqICAgICAgICAgXCJ9XCJcbiAgICAgKiAgICAgXS5qb2luKFwiXFxuXCIpXG4gICAgICogfTtcbiAgICAgKlxuICAgICAqIHZhciBzaGFkZXIgPSBuZXcgcGMuU2hhZGVyKGdyYXBoaWNzRGV2aWNlLCBzaGFkZXJEZWZpbml0aW9uKTtcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSwgZGVmaW5pdGlvbikge1xuICAgICAgICB0aGlzLmlkID0gaWQrKztcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcbiAgICAgICAgdGhpcy5kZWZpbml0aW9uID0gZGVmaW5pdGlvbjtcbiAgICAgICAgdGhpcy5uYW1lID0gZGVmaW5pdGlvbi5uYW1lIHx8ICdVbnRpdGxlZCc7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KGRlZmluaXRpb24udnNoYWRlciwgJ05vIHZlcnRleCBzaGFkZXIgaGFzIGJlZW4gc3BlY2lmaWVkIHdoZW4gY3JlYXRpbmcgYSBzaGFkZXIuJyk7XG4gICAgICAgIERlYnVnLmFzc2VydChkZWZpbml0aW9uLmZzaGFkZXIsICdObyBmcmFnbWVudCBzaGFkZXIgaGFzIGJlZW4gc3BlY2lmaWVkIHdoZW4gY3JlYXRpbmcgYSBzaGFkZXIuJyk7XG5cbiAgICAgICAgLy8gcHJlLXByb2Nlc3Mgc2hhZGVyIHNvdXJjZXNcbiAgICAgICAgZGVmaW5pdGlvbi52c2hhZGVyID0gUHJlcHJvY2Vzc29yLnJ1bihkZWZpbml0aW9uLnZzaGFkZXIpO1xuICAgICAgICBkZWZpbml0aW9uLmZzaGFkZXIgPSBQcmVwcm9jZXNzb3IucnVuKGRlZmluaXRpb24uZnNoYWRlcik7XG5cbiAgICAgICAgdGhpcy5pbml0KCk7XG5cbiAgICAgICAgdGhpcy5pbXBsID0gZ3JhcGhpY3NEZXZpY2UuY3JlYXRlU2hhZGVySW1wbCh0aGlzKTtcblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1NIQURFUl9BTExPQywgYEFsbG9jOiAke3RoaXMubGFiZWx9LCBzdGFjazogJHtEZWJ1Z0dyYXBoaWNzLnRvU3RyaW5nKCl9YCwge1xuICAgICAgICAgICAgaW5zdGFuY2U6IHRoaXNcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSBhIHNoYWRlciBiYWNrIHRvIGl0cyBkZWZhdWx0IHN0YXRlLlxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBpbml0KCkge1xuICAgICAgICB0aGlzLnJlYWR5ID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZmFpbGVkID0gZmFsc2U7XG4gICAgfVxuXG4gICAgZ2V0IGxhYmVsKCkge1xuICAgICAgICByZXR1cm4gYFNoYWRlciBJZCAke3RoaXMuaWR9ICR7dGhpcy5uYW1lfWA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRnJlZXMgcmVzb3VyY2VzIGFzc29jaWF0ZWQgd2l0aCB0aGlzIHNoYWRlci5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX1NIQURFUl9BTExPQywgYERlQWxsb2M6IElkICR7dGhpcy5pZH0gJHt0aGlzLm5hbWV9YCk7XG4gICAgICAgIHRoaXMuZGV2aWNlLm9uRGVzdHJveVNoYWRlcih0aGlzKTtcbiAgICAgICAgdGhpcy5pbXBsLmRlc3Ryb3kodGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2FsbGVkIHdoZW4gdGhlIFdlYkdMIGNvbnRleHQgd2FzIGxvc3QuIEl0IHJlbGVhc2VzIGFsbCBjb250ZXh0IHJlbGF0ZWQgcmVzb3VyY2VzLlxuICAgICAqXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGxvc2VDb250ZXh0KCkge1xuICAgICAgICB0aGlzLmluaXQoKTtcbiAgICAgICAgdGhpcy5pbXBsLmxvc2VDb250ZXh0KCk7XG4gICAgfVxuXG4gICAgcmVzdG9yZUNvbnRleHQoKSB7XG4gICAgICAgIHRoaXMuaW1wbC5yZXN0b3JlQ29udGV4dCh0aGlzLmRldmljZSwgdGhpcyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTaGFkZXIgfTtcbiJdLCJuYW1lcyI6WyJpZCIsIlNoYWRlciIsImNvbnN0cnVjdG9yIiwiZ3JhcGhpY3NEZXZpY2UiLCJkZWZpbml0aW9uIiwibWVzaFVuaWZvcm1CdWZmZXJGb3JtYXQiLCJtZXNoQmluZEdyb3VwRm9ybWF0IiwiZGV2aWNlIiwibmFtZSIsIkRlYnVnIiwiYXNzZXJ0IiwidnNoYWRlciIsImZzaGFkZXIiLCJQcmVwcm9jZXNzb3IiLCJydW4iLCJpbml0IiwiaW1wbCIsImNyZWF0ZVNoYWRlckltcGwiLCJ0cmFjZSIsIlRSQUNFSURfU0hBREVSX0FMTE9DIiwibGFiZWwiLCJEZWJ1Z0dyYXBoaWNzIiwidG9TdHJpbmciLCJpbnN0YW5jZSIsInJlYWR5IiwiZmFpbGVkIiwiZGVzdHJveSIsIm9uRGVzdHJveVNoYWRlciIsImxvc2VDb250ZXh0IiwicmVzdG9yZUNvbnRleHQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFLQSxJQUFJQSxFQUFFLEdBQUcsQ0FBQyxDQUFBOztBQUVWO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxNQUFNLENBQUM7QUFDVDtBQUNKO0FB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
