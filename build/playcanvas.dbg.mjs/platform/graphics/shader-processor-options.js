/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { BINDGROUP_VIEW } from './constants.js';

/**
 * Options to drive shader processing to add support for bind groups and uniform buffers.
 *
 * @ignore
 */
class ShaderProcessorOptions {
  /** @type {import('./uniform-buffer-format.js').UniformBufferFormat[]} */

  /** @type {import('./bind-group-format.js').BindGroupFormat[]} */

  /**
   * Constructs shader processing options, used to process the shader for uniform buffer support.
   *
   * @param {import('./uniform-buffer-format.js').UniformBufferFormat} [viewUniformFormat] - Format
   * of the uniform buffer.
   * @param {import('./bind-group-format.js').BindGroupFormat} [viewBindGroupFormat] - Format of
   * the bind group.
   */
  constructor(viewUniformFormat, viewBindGroupFormat) {
    this.uniformFormats = [];
    this.bindGroupFormats = [];
    // construct a sparse array
    this.uniformFormats[BINDGROUP_VIEW] = viewUniformFormat;
    this.bindGroupFormats[BINDGROUP_VIEW] = viewBindGroupFormat;
  }

  /**
   * Get the bind group index for the uniform name.
   *
   * @param {string} name - The name of the uniform.
   * @returns {boolean} - Returns true if the uniform exists, false otherwise.
   */
  hasUniform(name) {
    for (let i = 0; i < this.uniformFormats.length; i++) {
      const uniformFormat = this.uniformFormats[i];
      if (uniformFormat != null && uniformFormat.get(name)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the bind group texture slot for the texture uniform name.
   *
   * @param {string} name - The name of the texture uniform.
   * @returns {boolean} - Returns true if the texture uniform exists, false otherwise.
   */
  hasTexture(name) {
    for (let i = 0; i < this.bindGroupFormats.length; i++) {
      const groupFormat = this.bindGroupFormats[i];
      if (groupFormat != null && groupFormat.getTexture(name)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate unique key represending the processing options.
   *
   * @returns {string} - Returns the key.
   */
  generateKey() {
    // TODO: Optimize. Uniform and BindGroup formats should have their keys evaluated in their
    // constructors, and here we should simply concatenate those.
    return JSON.stringify(this);
  }
}

export { ShaderProcessorOptions };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZGVyLXByb2Nlc3Nvci1vcHRpb25zLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLXByb2Nlc3Nvci1vcHRpb25zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJJTkRHUk9VUF9WSUVXIH0gZnJvbSBcIi4vY29uc3RhbnRzLmpzXCI7XG5cbi8qKlxuICogT3B0aW9ucyB0byBkcml2ZSBzaGFkZXIgcHJvY2Vzc2luZyB0byBhZGQgc3VwcG9ydCBmb3IgYmluZCBncm91cHMgYW5kIHVuaWZvcm0gYnVmZmVycy5cbiAqXG4gKiBAaWdub3JlXG4gKi9cbmNsYXNzIFNoYWRlclByb2Nlc3Nvck9wdGlvbnMge1xuICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuL3VuaWZvcm0tYnVmZmVyLWZvcm1hdC5qcycpLlVuaWZvcm1CdWZmZXJGb3JtYXRbXX0gKi9cbiAgICB1bmlmb3JtRm9ybWF0cyA9IFtdO1xuXG4gICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vYmluZC1ncm91cC1mb3JtYXQuanMnKS5CaW5kR3JvdXBGb3JtYXRbXX0gKi9cbiAgICBiaW5kR3JvdXBGb3JtYXRzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3RzIHNoYWRlciBwcm9jZXNzaW5nIG9wdGlvbnMsIHVzZWQgdG8gcHJvY2VzcyB0aGUgc2hhZGVyIGZvciB1bmlmb3JtIGJ1ZmZlciBzdXBwb3J0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vdW5pZm9ybS1idWZmZXItZm9ybWF0LmpzJykuVW5pZm9ybUJ1ZmZlckZvcm1hdH0gW3ZpZXdVbmlmb3JtRm9ybWF0XSAtIEZvcm1hdFxuICAgICAqIG9mIHRoZSB1bmlmb3JtIGJ1ZmZlci5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9iaW5kLWdyb3VwLWZvcm1hdC5qcycpLkJpbmRHcm91cEZvcm1hdH0gW3ZpZXdCaW5kR3JvdXBGb3JtYXRdIC0gRm9ybWF0IG9mXG4gICAgICogdGhlIGJpbmQgZ3JvdXAuXG4gICAgICovXG4gICAgY29uc3RydWN0b3Iodmlld1VuaWZvcm1Gb3JtYXQsIHZpZXdCaW5kR3JvdXBGb3JtYXQpIHtcblxuICAgICAgICAvLyBjb25zdHJ1Y3QgYSBzcGFyc2UgYXJyYXlcbiAgICAgICAgdGhpcy51bmlmb3JtRm9ybWF0c1tCSU5ER1JPVVBfVklFV10gPSB2aWV3VW5pZm9ybUZvcm1hdDtcbiAgICAgICAgdGhpcy5iaW5kR3JvdXBGb3JtYXRzW0JJTkRHUk9VUF9WSUVXXSA9IHZpZXdCaW5kR3JvdXBGb3JtYXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBiaW5kIGdyb3VwIGluZGV4IGZvciB0aGUgdW5pZm9ybSBuYW1lLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgdW5pZm9ybS5cbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gLSBSZXR1cm5zIHRydWUgaWYgdGhlIHVuaWZvcm0gZXhpc3RzLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgaGFzVW5pZm9ybShuYW1lKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnVuaWZvcm1Gb3JtYXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB1bmlmb3JtRm9ybWF0ID0gdGhpcy51bmlmb3JtRm9ybWF0c1tpXTtcbiAgICAgICAgICAgIGlmICh1bmlmb3JtRm9ybWF0Py5nZXQobmFtZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXQgdGhlIGJpbmQgZ3JvdXAgdGV4dHVyZSBzbG90IGZvciB0aGUgdGV4dHVyZSB1bmlmb3JtIG5hbWUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSB0ZXh0dXJlIHVuaWZvcm0uXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IC0gUmV0dXJucyB0cnVlIGlmIHRoZSB0ZXh0dXJlIHVuaWZvcm0gZXhpc3RzLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgaGFzVGV4dHVyZShuYW1lKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmJpbmRHcm91cEZvcm1hdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGdyb3VwRm9ybWF0ID0gdGhpcy5iaW5kR3JvdXBGb3JtYXRzW2ldO1xuICAgICAgICAgICAgaWYgKGdyb3VwRm9ybWF0Py5nZXRUZXh0dXJlKG5hbWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogR2VuZXJhdGUgdW5pcXVlIGtleSByZXByZXNlbmRpbmcgdGhlIHByb2Nlc3Npbmcgb3B0aW9ucy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IC0gUmV0dXJucyB0aGUga2V5LlxuICAgICAqL1xuICAgIGdlbmVyYXRlS2V5KCkge1xuICAgICAgICAvLyBUT0RPOiBPcHRpbWl6ZS4gVW5pZm9ybSBhbmQgQmluZEdyb3VwIGZvcm1hdHMgc2hvdWxkIGhhdmUgdGhlaXIga2V5cyBldmFsdWF0ZWQgaW4gdGhlaXJcbiAgICAgICAgLy8gY29uc3RydWN0b3JzLCBhbmQgaGVyZSB3ZSBzaG91bGQgc2ltcGx5IGNvbmNhdGVuYXRlIHRob3NlLlxuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcyk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTaGFkZXJQcm9jZXNzb3JPcHRpb25zIH07XG4iXSwibmFtZXMiOlsiU2hhZGVyUHJvY2Vzc29yT3B0aW9ucyIsImNvbnN0cnVjdG9yIiwidmlld1VuaWZvcm1Gb3JtYXQiLCJ2aWV3QmluZEdyb3VwRm9ybWF0IiwidW5pZm9ybUZvcm1hdHMiLCJiaW5kR3JvdXBGb3JtYXRzIiwiQklOREdST1VQX1ZJRVciLCJoYXNVbmlmb3JtIiwibmFtZSIsImkiLCJsZW5ndGgiLCJ1bmlmb3JtRm9ybWF0IiwiZ2V0IiwiaGFzVGV4dHVyZSIsImdyb3VwRm9ybWF0IiwiZ2V0VGV4dHVyZSIsImdlbmVyYXRlS2V5IiwiSlNPTiIsInN0cmluZ2lmeSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxzQkFBc0IsQ0FBQztBQUN6Qjs7QUFHQTs7QUFHQTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVcsQ0FBQ0MsaUJBQWlCLEVBQUVDLG1CQUFtQixFQUFFO0lBQUEsSUFicERDLENBQUFBLGNBQWMsR0FBRyxFQUFFLENBQUE7SUFBQSxJQUduQkMsQ0FBQUEsZ0JBQWdCLEdBQUcsRUFBRSxDQUFBO0FBWWpCO0FBQ0EsSUFBQSxJQUFJLENBQUNELGNBQWMsQ0FBQ0UsY0FBYyxDQUFDLEdBQUdKLGlCQUFpQixDQUFBO0FBQ3ZELElBQUEsSUFBSSxDQUFDRyxnQkFBZ0IsQ0FBQ0MsY0FBYyxDQUFDLEdBQUdILG1CQUFtQixDQUFBO0FBQy9ELEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lJLFVBQVUsQ0FBQ0MsSUFBSSxFQUFFO0FBRWIsSUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNMLGNBQWMsQ0FBQ00sTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNqRCxNQUFBLE1BQU1FLGFBQWEsR0FBRyxJQUFJLENBQUNQLGNBQWMsQ0FBQ0ssQ0FBQyxDQUFDLENBQUE7TUFDNUMsSUFBSUUsYUFBYSxZQUFiQSxhQUFhLENBQUVDLEdBQUcsQ0FBQ0osSUFBSSxDQUFDLEVBQUU7QUFDMUIsUUFBQSxPQUFPLElBQUksQ0FBQTtBQUNmLE9BQUE7QUFDSixLQUFBO0FBRUEsSUFBQSxPQUFPLEtBQUssQ0FBQTtBQUNoQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJSyxVQUFVLENBQUNMLElBQUksRUFBRTtBQUViLElBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDSixnQkFBZ0IsQ0FBQ0ssTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNuRCxNQUFBLE1BQU1LLFdBQVcsR0FBRyxJQUFJLENBQUNULGdCQUFnQixDQUFDSSxDQUFDLENBQUMsQ0FBQTtNQUM1QyxJQUFJSyxXQUFXLFlBQVhBLFdBQVcsQ0FBRUMsVUFBVSxDQUFDUCxJQUFJLENBQUMsRUFBRTtBQUMvQixRQUFBLE9BQU8sSUFBSSxDQUFBO0FBQ2YsT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLE9BQU8sS0FBSyxDQUFBO0FBQ2hCLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNJUSxFQUFBQSxXQUFXLEdBQUc7QUFDVjtBQUNBO0FBQ0EsSUFBQSxPQUFPQyxJQUFJLENBQUNDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtBQUMvQixHQUFBO0FBQ0o7Ozs7In0=
