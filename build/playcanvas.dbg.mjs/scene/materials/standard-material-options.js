import { LitOptions } from './lit-options.js';

/**
 * The standard material options define a set of options used to control the shader frontend shader
 * generation, such as textures, tints and multipliers.
 */
class StandardMaterialOptions {
  constructor() {
    /** @private */
    this._pass = 0;
    /** @private */
    this._isForwardPass = false;
    this.chunks = [];
    /**
     * If UV1 (second set of texture coordinates) is required in the shader. Will be declared as
     * "vUv1" and passed to the fragment shader.
     *
     * @type {boolean}
     */
    this.forceUv1 = false;
    /**
     * The value of {@link StandardMaterial#ambientTint}.
     *
     * @type {boolean}
     */
    this.ambientTint = false;
    /**
     * Defines if {@link StandardMaterial#diffuse} constant should affect diffuse color.
     *
     * @type {boolean}
     */
    this.diffuseTint = false;
    /**
     * Defines if {@link StandardMaterial#specular} constant should affect specular color.
     *
     * @type {boolean}
     */
    this.specularTint = false;
    /**
     * Defines if {@link StandardMaterial#metalness} constant should affect metalness value.
     *
     * @type {boolean}
     */
    this.metalnessTint = false;
    /**
     * Defines if {@link StandardMaterial#gloss} constant should affect glossiness value.
     *
     * @type {boolean}
     */
    this.glossTint = false;
    /**
     * Defines if {@link StandardMaterial#emissive} constant should affect emissive color.
     *
     * @type {boolean}
     */
    this.emissiveTint = false;
    /**
     * Defines if {@link StandardMaterial#opacity} constant should affect opacity value.
     *
     * @type {boolean}
     */
    this.opacityTint = false;
    this.emissiveEncoding = 'linear';
    this.lightMapEncoding = 'linear';
    /**
     * If normal map contains X in RGB, Y in Alpha, and Z must be reconstructed.
     *
     * @type {boolean}
     */
    this.packedNormal = false;
    /**
     * Invert the gloss channel.
     *
     * @type {boolean}
     */
    this.glossInvert = false;
    /**
     * Invert the sheen gloss channel.
     *
     * @type {boolean}
     */
    this.sheenGlossInvert = false;
    /**
     * Invert the clearcoat gloss channel.
     *
     * @type {boolean}
     */
    this.clearCoatGlossInvert = false;
    this.litOptions = new LitOptions();
  }
  /**
   * Value of {@link Layer#shaderPass} of the Layer being rendered. Must be set to the same in
   * {@link LitOptions#pass}.
   *
   * @type {number}
   */
  set pass(p) {
    this._pass = p;
    this.litOptions._pass = p;
  }
  get pass() {
    return this._pass;
  }
  set isForwardPass(value) {
    this._isForwardPass = value;
    this.litOptions._isForwardPass = value;
  }
  get isForwardPass() {
    return this._isForwardPass;
  }
}

export { StandardMaterialOptions };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhbmRhcmQtbWF0ZXJpYWwtb3B0aW9ucy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL21hdGVyaWFscy9zdGFuZGFyZC1tYXRlcmlhbC1vcHRpb25zLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IExpdE9wdGlvbnMgfSBmcm9tIFwiLi9saXQtb3B0aW9ucy5qc1wiO1xuXG4vKipcbiAqIFRoZSBzdGFuZGFyZCBtYXRlcmlhbCBvcHRpb25zIGRlZmluZSBhIHNldCBvZiBvcHRpb25zIHVzZWQgdG8gY29udHJvbCB0aGUgc2hhZGVyIGZyb250ZW5kIHNoYWRlclxuICogZ2VuZXJhdGlvbiwgc3VjaCBhcyB0ZXh0dXJlcywgdGludHMgYW5kIG11bHRpcGxpZXJzLlxuICovXG5jbGFzcyBTdGFuZGFyZE1hdGVyaWFsT3B0aW9ucyB7XG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3Bhc3MgPSAwO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2lzRm9yd2FyZFBhc3MgPSBmYWxzZTtcblxuICAgIGNodW5rcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogSWYgVVYxIChzZWNvbmQgc2V0IG9mIHRleHR1cmUgY29vcmRpbmF0ZXMpIGlzIHJlcXVpcmVkIGluIHRoZSBzaGFkZXIuIFdpbGwgYmUgZGVjbGFyZWQgYXNcbiAgICAgKiBcInZVdjFcIiBhbmQgcGFzc2VkIHRvIHRoZSBmcmFnbWVudCBzaGFkZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBmb3JjZVV2MSA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogVGhlIHZhbHVlIG9mIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2FtYmllbnRUaW50fS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGFtYmllbnRUaW50ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIGlmIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2RpZmZ1c2V9IGNvbnN0YW50IHNob3VsZCBhZmZlY3QgZGlmZnVzZSBjb2xvci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIGRpZmZ1c2VUaW50ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIGlmIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI3NwZWN1bGFyfSBjb25zdGFudCBzaG91bGQgYWZmZWN0IHNwZWN1bGFyIGNvbG9yLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc3BlY3VsYXJUaW50ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIGlmIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI21ldGFsbmVzc30gY29uc3RhbnQgc2hvdWxkIGFmZmVjdCBtZXRhbG5lc3MgdmFsdWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBtZXRhbG5lc3NUaW50ID0gZmFsc2U7XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIGlmIHtAbGluayBTdGFuZGFyZE1hdGVyaWFsI2dsb3NzfSBjb25zdGFudCBzaG91bGQgYWZmZWN0IGdsb3NzaW5lc3MgdmFsdWUuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBnbG9zc1RpbnQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgaWYge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjZW1pc3NpdmV9IGNvbnN0YW50IHNob3VsZCBhZmZlY3QgZW1pc3NpdmUgY29sb3IuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBlbWlzc2l2ZVRpbnQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgaWYge0BsaW5rIFN0YW5kYXJkTWF0ZXJpYWwjb3BhY2l0eX0gY29uc3RhbnQgc2hvdWxkIGFmZmVjdCBvcGFjaXR5IHZhbHVlLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgb3BhY2l0eVRpbnQgPSBmYWxzZTtcblxuICAgIGVtaXNzaXZlRW5jb2RpbmcgPSAnbGluZWFyJztcblxuICAgIGxpZ2h0TWFwRW5jb2RpbmcgPSAnbGluZWFyJztcblxuICAgIC8qKlxuICAgICAqIElmIG5vcm1hbCBtYXAgY29udGFpbnMgWCBpbiBSR0IsIFkgaW4gQWxwaGEsIGFuZCBaIG11c3QgYmUgcmVjb25zdHJ1Y3RlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHBhY2tlZE5vcm1hbCA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogSW52ZXJ0IHRoZSBnbG9zcyBjaGFubmVsLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgZ2xvc3NJbnZlcnQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEludmVydCB0aGUgc2hlZW4gZ2xvc3MgY2hhbm5lbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNoZWVuR2xvc3NJbnZlcnQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEludmVydCB0aGUgY2xlYXJjb2F0IGdsb3NzIGNoYW5uZWwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBjbGVhckNvYXRHbG9zc0ludmVydCA9IGZhbHNlO1xuXG4gICAgbGl0T3B0aW9ucyA9IG5ldyBMaXRPcHRpb25zKCk7XG5cbiAgICAvKipcbiAgICAgKiBWYWx1ZSBvZiB7QGxpbmsgTGF5ZXIjc2hhZGVyUGFzc30gb2YgdGhlIExheWVyIGJlaW5nIHJlbmRlcmVkLiBNdXN0IGJlIHNldCB0byB0aGUgc2FtZSBpblxuICAgICAqIHtAbGluayBMaXRPcHRpb25zI3Bhc3N9LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcGFzcyhwKSB7XG4gICAgICAgIHRoaXMuX3Bhc3MgPSBwO1xuICAgICAgICB0aGlzLmxpdE9wdGlvbnMuX3Bhc3MgPSBwO1xuICAgIH1cblxuICAgIGdldCBwYXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcGFzcztcbiAgICB9XG5cbiAgICBzZXQgaXNGb3J3YXJkUGFzcyh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9pc0ZvcndhcmRQYXNzID0gdmFsdWU7XG4gICAgICAgIHRoaXMubGl0T3B0aW9ucy5faXNGb3J3YXJkUGFzcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBpc0ZvcndhcmRQYXNzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNGb3J3YXJkUGFzcztcbiAgICB9XG59XG5cbmV4cG9ydCB7IFN0YW5kYXJkTWF0ZXJpYWxPcHRpb25zIH07XG4iXSwibmFtZXMiOlsiU3RhbmRhcmRNYXRlcmlhbE9wdGlvbnMiLCJjb25zdHJ1Y3RvciIsIl9wYXNzIiwiX2lzRm9yd2FyZFBhc3MiLCJjaHVua3MiLCJmb3JjZVV2MSIsImFtYmllbnRUaW50IiwiZGlmZnVzZVRpbnQiLCJzcGVjdWxhclRpbnQiLCJtZXRhbG5lc3NUaW50IiwiZ2xvc3NUaW50IiwiZW1pc3NpdmVUaW50Iiwib3BhY2l0eVRpbnQiLCJlbWlzc2l2ZUVuY29kaW5nIiwibGlnaHRNYXBFbmNvZGluZyIsInBhY2tlZE5vcm1hbCIsImdsb3NzSW52ZXJ0Iiwic2hlZW5HbG9zc0ludmVydCIsImNsZWFyQ29hdEdsb3NzSW52ZXJ0IiwibGl0T3B0aW9ucyIsIkxpdE9wdGlvbnMiLCJwYXNzIiwicCIsImlzRm9yd2FyZFBhc3MiLCJ2YWx1ZSJdLCJtYXBwaW5ncyI6Ijs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLHVCQUF1QixDQUFDO0VBQUFDLFdBQUEsR0FBQTtBQUMxQjtJQUFBLElBQ0FDLENBQUFBLEtBQUssR0FBRyxDQUFDLENBQUE7QUFFVDtJQUFBLElBQ0FDLENBQUFBLGNBQWMsR0FBRyxLQUFLLENBQUE7SUFBQSxJQUV0QkMsQ0FBQUEsTUFBTSxHQUFHLEVBQUUsQ0FBQTtBQUVYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUxJLElBTUFDLENBQUFBLFFBQVEsR0FBRyxLQUFLLENBQUE7QUFFaEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFdBQVcsR0FBRyxLQUFLLENBQUE7QUFFbkI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFdBQVcsR0FBRyxLQUFLLENBQUE7QUFFbkI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFlBQVksR0FBRyxLQUFLLENBQUE7QUFFcEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLGFBQWEsR0FBRyxLQUFLLENBQUE7QUFFckI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFNBQVMsR0FBRyxLQUFLLENBQUE7QUFFakI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFlBQVksR0FBRyxLQUFLLENBQUE7QUFFcEI7QUFDSjtBQUNBO0FBQ0E7QUFDQTtJQUpJLElBS0FDLENBQUFBLFdBQVcsR0FBRyxLQUFLLENBQUE7SUFBQSxJQUVuQkMsQ0FBQUEsZ0JBQWdCLEdBQUcsUUFBUSxDQUFBO0lBQUEsSUFFM0JDLENBQUFBLGdCQUFnQixHQUFHLFFBQVEsQ0FBQTtBQUUzQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsWUFBWSxHQUFHLEtBQUssQ0FBQTtBQUVwQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsV0FBVyxHQUFHLEtBQUssQ0FBQTtBQUVuQjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0lBSkksSUFLQUMsQ0FBQUEsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBRXhCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7SUFKSSxJQUtBQyxDQUFBQSxvQkFBb0IsR0FBRyxLQUFLLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FFNUJDLFVBQVUsR0FBRyxJQUFJQyxVQUFVLEVBQUUsQ0FBQTtBQUFBLEdBQUE7QUFFN0I7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0ksSUFBSUMsSUFBSUEsQ0FBQ0MsQ0FBQyxFQUFFO0lBQ1IsSUFBSSxDQUFDcEIsS0FBSyxHQUFHb0IsQ0FBQyxDQUFBO0FBQ2QsSUFBQSxJQUFJLENBQUNILFVBQVUsQ0FBQ2pCLEtBQUssR0FBR29CLENBQUMsQ0FBQTtBQUM3QixHQUFBO0VBRUEsSUFBSUQsSUFBSUEsR0FBRztJQUNQLE9BQU8sSUFBSSxDQUFDbkIsS0FBSyxDQUFBO0FBQ3JCLEdBQUE7RUFFQSxJQUFJcUIsYUFBYUEsQ0FBQ0MsS0FBSyxFQUFFO0lBQ3JCLElBQUksQ0FBQ3JCLGNBQWMsR0FBR3FCLEtBQUssQ0FBQTtBQUMzQixJQUFBLElBQUksQ0FBQ0wsVUFBVSxDQUFDaEIsY0FBYyxHQUFHcUIsS0FBSyxDQUFBO0FBQzFDLEdBQUE7RUFFQSxJQUFJRCxhQUFhQSxHQUFHO0lBQ2hCLE9BQU8sSUFBSSxDQUFDcEIsY0FBYyxDQUFBO0FBQzlCLEdBQUE7QUFDSjs7OzsifQ==
