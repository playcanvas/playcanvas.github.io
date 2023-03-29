/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { TRACEID_BINDGROUP_ALLOC } from '../../core/constants.js';
import { UNIFORM_BUFFER_DEFAULT_SLOT_NAME } from './constants.js';
import { DebugGraphics } from './debug-graphics.js';

let id = 0;

/**
 * A bind group represents an collection of {@link UniformBuffer} and {@link Texture} instance,
 * which can be bind on a GPU for rendering.
 *
 * @ignore
 */
class BindGroup {
  /**
   * Create a new Bind Group.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice - The graphics device
   * used to manage this uniform buffer.
   * @param {import('./bind-group-format.js').BindGroupFormat} format - Format of the bind group.
   * @param {import('./uniform-buffer.js').UniformBuffer} [defaultUniformBuffer] - The default
   * uniform buffer. Typically a bind group only has a single uniform buffer, and this allows
   * easier access.
   */
  constructor(graphicsDevice, format, defaultUniformBuffer) {
    this.id = id++;
    this.device = graphicsDevice;
    this.format = format;
    this.dirty = true;
    this.impl = graphicsDevice.createBindGroupImpl(this);
    this.textures = [];
    this.uniformBuffers = [];

    /** @type {import('./uniform-buffer.js').UniformBuffer} */
    this.defaultUniformBuffer = defaultUniformBuffer;
    if (defaultUniformBuffer) {
      this.setUniformBuffer(UNIFORM_BUFFER_DEFAULT_SLOT_NAME, defaultUniformBuffer);
    }
    Debug.trace(TRACEID_BINDGROUP_ALLOC, `Alloc: Id ${this.id}`, this, format);
  }

  /**
   * Frees resources associated with this bind group.
   */
  destroy() {
    this.impl.destroy();
    this.impl = null;
    this.format = null;
    this.defaultUniformBuffer = null;
  }

  /**
   * Assign a uniform buffer to a slot.
   *
   * @param {string} name - The name of the uniform buffer slot
   * @param {import('./uniform-buffer.js').UniformBuffer} uniformBuffer - The Uniform buffer to
   * assign to the slot.
   */
  setUniformBuffer(name, uniformBuffer) {
    const index = this.format.bufferFormatsMap.get(name);
    Debug.assert(index !== undefined, `Setting a uniform [${name}] on a bind group with id ${this.id} which does not contain in, while rendering [${DebugGraphics.toString()}]`, this);
    if (this.uniformBuffers[index] !== uniformBuffer) {
      this.uniformBuffers[index] = uniformBuffer;
      this.dirty = true;
    }
  }

  /**
   * Assign a texture to a named slot.
   *
   * @param {string} name - The name of the texture slot.
   * @param {import('./texture.js').Texture} texture - Texture to assign to the slot.
   */
  setTexture(name, texture) {
    const index = this.format.textureFormatsMap.get(name);
    Debug.assert(index !== undefined, `Setting a texture [${name}] on a bind group with id: ${this.id} which does not contain in, while rendering [${DebugGraphics.toString()}]`, this);
    if (this.textures[index] !== texture) {
      this.textures[index] = texture;
      this.dirty = true;
    }
  }

  /**
   * Applies any changes made to the bind group's properties.
   */
  update() {
    const textureFormats = this.format.textureFormats;
    for (let i = 0; i < textureFormats.length; i++) {
      const textureFormat = textureFormats[i];
      const value = textureFormat.scopeId.value;
      Debug.assert(value, `Value was not set when assigning texture slot [${textureFormat.name}] to a bind group, while rendering [${DebugGraphics.toString()}]`, this);
      this.setTexture(textureFormat.name, value);
    }
    if (this.dirty) {
      this.dirty = false;
      this.impl.update(this);
    }
  }
}

export { BindGroup };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluZC1ncm91cC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3BsYXRmb3JtL2dyYXBoaWNzL2JpbmQtZ3JvdXAuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcbmltcG9ydCB7IFRSQUNFSURfQklOREdST1VQX0FMTE9DIH0gZnJvbSAnLi4vLi4vY29yZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0dyYXBoaWNzIH0gZnJvbSAnLi9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5cbmxldCBpZCA9IDA7XG5cbi8qKlxuICogQSBiaW5kIGdyb3VwIHJlcHJlc2VudHMgYW4gY29sbGVjdGlvbiBvZiB7QGxpbmsgVW5pZm9ybUJ1ZmZlcn0gYW5kIHtAbGluayBUZXh0dXJlfSBpbnN0YW5jZSxcbiAqIHdoaWNoIGNhbiBiZSBiaW5kIG9uIGEgR1BVIGZvciByZW5kZXJpbmcuXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBCaW5kR3JvdXAge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBCaW5kIEdyb3VwLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC0gVGhlIGdyYXBoaWNzIGRldmljZVxuICAgICAqIHVzZWQgdG8gbWFuYWdlIHRoaXMgdW5pZm9ybSBidWZmZXIuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vYmluZC1ncm91cC1mb3JtYXQuanMnKS5CaW5kR3JvdXBGb3JtYXR9IGZvcm1hdCAtIEZvcm1hdCBvZiB0aGUgYmluZCBncm91cC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi91bmlmb3JtLWJ1ZmZlci5qcycpLlVuaWZvcm1CdWZmZXJ9IFtkZWZhdWx0VW5pZm9ybUJ1ZmZlcl0gLSBUaGUgZGVmYXVsdFxuICAgICAqIHVuaWZvcm0gYnVmZmVyLiBUeXBpY2FsbHkgYSBiaW5kIGdyb3VwIG9ubHkgaGFzIGEgc2luZ2xlIHVuaWZvcm0gYnVmZmVyLCBhbmQgdGhpcyBhbGxvd3NcbiAgICAgKiBlYXNpZXIgYWNjZXNzLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGdyYXBoaWNzRGV2aWNlLCBmb3JtYXQsIGRlZmF1bHRVbmlmb3JtQnVmZmVyKSB7XG4gICAgICAgIHRoaXMuaWQgPSBpZCsrO1xuICAgICAgICB0aGlzLmRldmljZSA9IGdyYXBoaWNzRGV2aWNlO1xuICAgICAgICB0aGlzLmZvcm1hdCA9IGZvcm1hdDtcbiAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgICAgIHRoaXMuaW1wbCA9IGdyYXBoaWNzRGV2aWNlLmNyZWF0ZUJpbmRHcm91cEltcGwodGhpcyk7XG5cbiAgICAgICAgdGhpcy50ZXh0dXJlcyA9IFtdO1xuICAgICAgICB0aGlzLnVuaWZvcm1CdWZmZXJzID0gW107XG5cbiAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4vdW5pZm9ybS1idWZmZXIuanMnKS5Vbmlmb3JtQnVmZmVyfSAqL1xuICAgICAgICB0aGlzLmRlZmF1bHRVbmlmb3JtQnVmZmVyID0gZGVmYXVsdFVuaWZvcm1CdWZmZXI7XG4gICAgICAgIGlmIChkZWZhdWx0VW5pZm9ybUJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5zZXRVbmlmb3JtQnVmZmVyKFVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FLCBkZWZhdWx0VW5pZm9ybUJ1ZmZlcik7XG4gICAgICAgIH1cblxuICAgICAgICBEZWJ1Zy50cmFjZShUUkFDRUlEX0JJTkRHUk9VUF9BTExPQywgYEFsbG9jOiBJZCAke3RoaXMuaWR9YCwgdGhpcywgZm9ybWF0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlcyByZXNvdXJjZXMgYXNzb2NpYXRlZCB3aXRoIHRoaXMgYmluZCBncm91cC5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmltcGwuZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmltcGwgPSBudWxsO1xuICAgICAgICB0aGlzLmZvcm1hdCA9IG51bGw7XG4gICAgICAgIHRoaXMuZGVmYXVsdFVuaWZvcm1CdWZmZXIgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBhIHVuaWZvcm0gYnVmZmVyIHRvIGEgc2xvdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHVuaWZvcm0gYnVmZmVyIHNsb3RcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi91bmlmb3JtLWJ1ZmZlci5qcycpLlVuaWZvcm1CdWZmZXJ9IHVuaWZvcm1CdWZmZXIgLSBUaGUgVW5pZm9ybSBidWZmZXIgdG9cbiAgICAgKiBhc3NpZ24gdG8gdGhlIHNsb3QuXG4gICAgICovXG4gICAgc2V0VW5pZm9ybUJ1ZmZlcihuYW1lLCB1bmlmb3JtQnVmZmVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5mb3JtYXQuYnVmZmVyRm9ybWF0c01hcC5nZXQobmFtZSk7XG4gICAgICAgIERlYnVnLmFzc2VydChpbmRleCAhPT0gdW5kZWZpbmVkLCBgU2V0dGluZyBhIHVuaWZvcm0gWyR7bmFtZX1dIG9uIGEgYmluZCBncm91cCB3aXRoIGlkICR7dGhpcy5pZH0gd2hpY2ggZG9lcyBub3QgY29udGFpbiBpbiwgd2hpbGUgcmVuZGVyaW5nIFske0RlYnVnR3JhcGhpY3MudG9TdHJpbmcoKX1dYCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnVuaWZvcm1CdWZmZXJzW2luZGV4XSAhPT0gdW5pZm9ybUJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy51bmlmb3JtQnVmZmVyc1tpbmRleF0gPSB1bmlmb3JtQnVmZmVyO1xuICAgICAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NpZ24gYSB0ZXh0dXJlIHRvIGEgbmFtZWQgc2xvdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIHRleHR1cmUgc2xvdC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi90ZXh0dXJlLmpzJykuVGV4dHVyZX0gdGV4dHVyZSAtIFRleHR1cmUgdG8gYXNzaWduIHRvIHRoZSBzbG90LlxuICAgICAqL1xuICAgIHNldFRleHR1cmUobmFtZSwgdGV4dHVyZSkge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMuZm9ybWF0LnRleHR1cmVGb3JtYXRzTWFwLmdldChuYW1lKTtcbiAgICAgICAgRGVidWcuYXNzZXJ0KGluZGV4ICE9PSB1bmRlZmluZWQsIGBTZXR0aW5nIGEgdGV4dHVyZSBbJHtuYW1lfV0gb24gYSBiaW5kIGdyb3VwIHdpdGggaWQ6ICR7dGhpcy5pZH0gd2hpY2ggZG9lcyBub3QgY29udGFpbiBpbiwgd2hpbGUgcmVuZGVyaW5nIFske0RlYnVnR3JhcGhpY3MudG9TdHJpbmcoKX1dYCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnRleHR1cmVzW2luZGV4XSAhPT0gdGV4dHVyZSkge1xuICAgICAgICAgICAgdGhpcy50ZXh0dXJlc1tpbmRleF0gPSB0ZXh0dXJlO1xuICAgICAgICAgICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBsaWVzIGFueSBjaGFuZ2VzIG1hZGUgdG8gdGhlIGJpbmQgZ3JvdXAncyBwcm9wZXJ0aWVzLlxuICAgICAqL1xuICAgIHVwZGF0ZSgpIHtcblxuICAgICAgICBjb25zdCB0ZXh0dXJlRm9ybWF0cyA9IHRoaXMuZm9ybWF0LnRleHR1cmVGb3JtYXRzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleHR1cmVGb3JtYXRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXh0dXJlRm9ybWF0ID0gdGV4dHVyZUZvcm1hdHNbaV07XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHRleHR1cmVGb3JtYXQuc2NvcGVJZC52YWx1ZTtcbiAgICAgICAgICAgIERlYnVnLmFzc2VydCh2YWx1ZSwgYFZhbHVlIHdhcyBub3Qgc2V0IHdoZW4gYXNzaWduaW5nIHRleHR1cmUgc2xvdCBbJHt0ZXh0dXJlRm9ybWF0Lm5hbWV9XSB0byBhIGJpbmQgZ3JvdXAsIHdoaWxlIHJlbmRlcmluZyBbJHtEZWJ1Z0dyYXBoaWNzLnRvU3RyaW5nKCl9XWAsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5zZXRUZXh0dXJlKHRleHR1cmVGb3JtYXQubmFtZSwgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZGlydHkpIHtcbiAgICAgICAgICAgIHRoaXMuZGlydHkgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuaW1wbC51cGRhdGUodGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IEJpbmRHcm91cCB9O1xuIl0sIm5hbWVzIjpbImlkIiwiQmluZEdyb3VwIiwiY29uc3RydWN0b3IiLCJncmFwaGljc0RldmljZSIsImZvcm1hdCIsImRlZmF1bHRVbmlmb3JtQnVmZmVyIiwiZGV2aWNlIiwiZGlydHkiLCJpbXBsIiwiY3JlYXRlQmluZEdyb3VwSW1wbCIsInRleHR1cmVzIiwidW5pZm9ybUJ1ZmZlcnMiLCJzZXRVbmlmb3JtQnVmZmVyIiwiVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUiLCJEZWJ1ZyIsInRyYWNlIiwiVFJBQ0VJRF9CSU5ER1JPVVBfQUxMT0MiLCJkZXN0cm95IiwibmFtZSIsInVuaWZvcm1CdWZmZXIiLCJpbmRleCIsImJ1ZmZlckZvcm1hdHNNYXAiLCJnZXQiLCJhc3NlcnQiLCJ1bmRlZmluZWQiLCJEZWJ1Z0dyYXBoaWNzIiwidG9TdHJpbmciLCJzZXRUZXh0dXJlIiwidGV4dHVyZSIsInRleHR1cmVGb3JtYXRzTWFwIiwidXBkYXRlIiwidGV4dHVyZUZvcm1hdHMiLCJpIiwibGVuZ3RoIiwidGV4dHVyZUZvcm1hdCIsInZhbHVlIiwic2NvcGVJZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUtBLElBQUlBLEVBQUUsR0FBRyxDQUFDLENBQUE7O0FBRVY7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUMsU0FBUyxDQUFDO0FBQ1o7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBVyxDQUFDQyxjQUFjLEVBQUVDLE1BQU0sRUFBRUMsb0JBQW9CLEVBQUU7QUFDdEQsSUFBQSxJQUFJLENBQUNMLEVBQUUsR0FBR0EsRUFBRSxFQUFFLENBQUE7SUFDZCxJQUFJLENBQUNNLE1BQU0sR0FBR0gsY0FBYyxDQUFBO0lBQzVCLElBQUksQ0FBQ0MsTUFBTSxHQUFHQSxNQUFNLENBQUE7SUFDcEIsSUFBSSxDQUFDRyxLQUFLLEdBQUcsSUFBSSxDQUFBO0lBQ2pCLElBQUksQ0FBQ0MsSUFBSSxHQUFHTCxjQUFjLENBQUNNLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFBO0lBRXBELElBQUksQ0FBQ0MsUUFBUSxHQUFHLEVBQUUsQ0FBQTtJQUNsQixJQUFJLENBQUNDLGNBQWMsR0FBRyxFQUFFLENBQUE7O0FBRXhCO0lBQ0EsSUFBSSxDQUFDTixvQkFBb0IsR0FBR0Esb0JBQW9CLENBQUE7QUFDaEQsSUFBQSxJQUFJQSxvQkFBb0IsRUFBRTtBQUN0QixNQUFBLElBQUksQ0FBQ08sZ0JBQWdCLENBQUNDLGdDQUFnQyxFQUFFUixvQkFBb0IsQ0FBQyxDQUFBO0FBQ2pGLEtBQUE7QUFFQVMsSUFBQUEsS0FBSyxDQUFDQyxLQUFLLENBQUNDLHVCQUF1QixFQUFHLENBQVksVUFBQSxFQUFBLElBQUksQ0FBQ2hCLEVBQUcsQ0FBQyxDQUFBLEVBQUUsSUFBSSxFQUFFSSxNQUFNLENBQUMsQ0FBQTtBQUM5RSxHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNJ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
