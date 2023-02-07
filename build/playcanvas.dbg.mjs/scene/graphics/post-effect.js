/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Vec4 } from '../../core/math/vec4.js';
import { drawQuadWithShader } from './quad-render-utils.js';

const _viewport = new Vec4();

/**
 * Base class for all post effects. Post effects take a a render target as input apply effects to
 * it and then render the result to an output render target or the screen if no output is
 * specified.
 */
class PostEffect {
  /**
   * Create a new PostEffect instance.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} graphicsDevice -
   * The graphics device of the application.
   */
  constructor(graphicsDevice) {
    /**
     * The graphics device of the application.
     *
     * @type {import('../../platform/graphics/graphics-device.js').GraphicsDevice}
     */
    this.device = graphicsDevice;

    /**
     * The property that should to be set to `true` (by the custom post effect) if a depth map
     * is necessary (default is false).
     *
     * @type {boolean}
     */
    this.needsDepthBuffer = false;
  }

  /**
   * A simple vertx shader used to render a quad, which requires 'vec2 aPosition' in the vertex
   * buffer, and generates uv coordinates vUv0 for use in the fragment shader.
   */

  /**
   * Render the post effect using the specified inputTarget to the specified outputTarget.
   *
   * @param {import('../../platform/graphics/render-target.js').RenderTarget} inputTarget - The
   * input render target.
   * @param {import('../../platform/graphics/render-target.js').RenderTarget} outputTarget - The
   * output render target. If null then this will be the screen.
   * @param {import('../../core/math/vec4.js').Vec4} [rect] - The rect of the current camera. If
   * not specified, it will default to [0, 0, 1, 1].
   */
  render(inputTarget, outputTarget, rect) {}

  /**
   * Draw a screen-space rectangle in a render target, using a specified shader.
   *
   * @param {import('../../platform/graphics/render-target.js').RenderTarget} target - The output
   * render target.
   * @param {import('../../platform/graphics/shader.js').Shader} shader - The shader to be used for
   * drawing the rectangle.
   * @param {import('../../core/math/vec4.js').Vec4} [rect] - The normalized screen-space position
   * (rect.x, rect.y) and size (rect.z, rect.w) of the rectangle. Default is [0, 0, 1, 1].
   */
  drawQuad(target, shader, rect) {
    let viewport;
    if (rect) {
      // convert rect in normalized space to viewport in pixel space
      const w = target ? target.width : this.device.width;
      const h = target ? target.height : this.device.height;
      viewport = _viewport.set(rect.x * w, rect.y * h, rect.z * w, rect.w * h);
    }
    drawQuadWithShader(this.device, target, shader, viewport);
  }
}
PostEffect.quadVertexShader = `
        attribute vec2 aPosition;
        varying vec2 vUv0;
        void main(void)
        {
            gl_Position = vec4(aPosition, 0.0, 1.0);
            vUv0 = getImageEffectUV((aPosition.xy + 1.0) * 0.5);
        }
    `;

export { PostEffect };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdC1lZmZlY3QuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9ncmFwaGljcy9wb3N0LWVmZmVjdC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBWZWM0IH0gZnJvbSAnLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnO1xuaW1wb3J0IHsgZHJhd1F1YWRXaXRoU2hhZGVyIH0gZnJvbSAnLi9xdWFkLXJlbmRlci11dGlscy5qcyc7XG5cbmNvbnN0IF92aWV3cG9ydCA9IG5ldyBWZWM0KCk7XG5cbi8qKlxuICogQmFzZSBjbGFzcyBmb3IgYWxsIHBvc3QgZWZmZWN0cy4gUG9zdCBlZmZlY3RzIHRha2UgYSBhIHJlbmRlciB0YXJnZXQgYXMgaW5wdXQgYXBwbHkgZWZmZWN0cyB0b1xuICogaXQgYW5kIHRoZW4gcmVuZGVyIHRoZSByZXN1bHQgdG8gYW4gb3V0cHV0IHJlbmRlciB0YXJnZXQgb3IgdGhlIHNjcmVlbiBpZiBubyBvdXRwdXQgaXNcbiAqIHNwZWNpZmllZC5cbiAqL1xuY2xhc3MgUG9zdEVmZmVjdCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFBvc3RFZmZlY3QgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGdyYXBoaWNzRGV2aWNlIC1cbiAgICAgKiBUaGUgZ3JhcGhpY3MgZGV2aWNlIG9mIHRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihncmFwaGljc0RldmljZSkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGdyYXBoaWNzIGRldmljZSBvZiB0aGUgYXBwbGljYXRpb24uXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5kZXZpY2UgPSBncmFwaGljc0RldmljZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHByb3BlcnR5IHRoYXQgc2hvdWxkIHRvIGJlIHNldCB0byBgdHJ1ZWAgKGJ5IHRoZSBjdXN0b20gcG9zdCBlZmZlY3QpIGlmIGEgZGVwdGggbWFwXG4gICAgICAgICAqIGlzIG5lY2Vzc2FyeSAoZGVmYXVsdCBpcyBmYWxzZSkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uZWVkc0RlcHRoQnVmZmVyID0gZmFsc2U7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQSBzaW1wbGUgdmVydHggc2hhZGVyIHVzZWQgdG8gcmVuZGVyIGEgcXVhZCwgd2hpY2ggcmVxdWlyZXMgJ3ZlYzIgYVBvc2l0aW9uJyBpbiB0aGUgdmVydGV4XG4gICAgICogYnVmZmVyLCBhbmQgZ2VuZXJhdGVzIHV2IGNvb3JkaW5hdGVzIHZVdjAgZm9yIHVzZSBpbiB0aGUgZnJhZ21lbnQgc2hhZGVyLlxuICAgICAqL1xuICAgIHN0YXRpYyBxdWFkVmVydGV4U2hhZGVyID0gYFxuICAgICAgICBhdHRyaWJ1dGUgdmVjMiBhUG9zaXRpb247XG4gICAgICAgIHZhcnlpbmcgdmVjMiB2VXYwO1xuICAgICAgICB2b2lkIG1haW4odm9pZClcbiAgICAgICAge1xuICAgICAgICAgICAgZ2xfUG9zaXRpb24gPSB2ZWM0KGFQb3NpdGlvbiwgMC4wLCAxLjApO1xuICAgICAgICAgICAgdlV2MCA9IGdldEltYWdlRWZmZWN0VVYoKGFQb3NpdGlvbi54eSArIDEuMCkgKiAwLjUpO1xuICAgICAgICB9XG4gICAgYDtcblxuICAgIC8qKlxuICAgICAqIFJlbmRlciB0aGUgcG9zdCBlZmZlY3QgdXNpbmcgdGhlIHNwZWNpZmllZCBpbnB1dFRhcmdldCB0byB0aGUgc3BlY2lmaWVkIG91dHB1dFRhcmdldC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fSBpbnB1dFRhcmdldCAtIFRoZVxuICAgICAqIGlucHV0IHJlbmRlciB0YXJnZXQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnKS5SZW5kZXJUYXJnZXR9IG91dHB1dFRhcmdldCAtIFRoZVxuICAgICAqIG91dHB1dCByZW5kZXIgdGFyZ2V0LiBJZiBudWxsIHRoZW4gdGhpcyB3aWxsIGJlIHRoZSBzY3JlZW4uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2NvcmUvbWF0aC92ZWM0LmpzJykuVmVjNH0gW3JlY3RdIC0gVGhlIHJlY3Qgb2YgdGhlIGN1cnJlbnQgY2FtZXJhLiBJZlxuICAgICAqIG5vdCBzcGVjaWZpZWQsIGl0IHdpbGwgZGVmYXVsdCB0byBbMCwgMCwgMSwgMV0uXG4gICAgICovXG4gICAgcmVuZGVyKGlucHV0VGFyZ2V0LCBvdXRwdXRUYXJnZXQsIHJlY3QpIHtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcmF3IGEgc2NyZWVuLXNwYWNlIHJlY3RhbmdsZSBpbiBhIHJlbmRlciB0YXJnZXQsIHVzaW5nIGEgc3BlY2lmaWVkIHNoYWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJykuUmVuZGVyVGFyZ2V0fSB0YXJnZXQgLSBUaGUgb3V0cHV0XG4gICAgICogcmVuZGVyIHRhcmdldC5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3Mvc2hhZGVyLmpzJykuU2hhZGVyfSBzaGFkZXIgLSBUaGUgc2hhZGVyIHRvIGJlIHVzZWQgZm9yXG4gICAgICogZHJhd2luZyB0aGUgcmVjdGFuZ2xlLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcycpLlZlYzR9IFtyZWN0XSAtIFRoZSBub3JtYWxpemVkIHNjcmVlbi1zcGFjZSBwb3NpdGlvblxuICAgICAqIChyZWN0LngsIHJlY3QueSkgYW5kIHNpemUgKHJlY3QueiwgcmVjdC53KSBvZiB0aGUgcmVjdGFuZ2xlLiBEZWZhdWx0IGlzIFswLCAwLCAxLCAxXS5cbiAgICAgKi9cbiAgICBkcmF3UXVhZCh0YXJnZXQsIHNoYWRlciwgcmVjdCkge1xuICAgICAgICBsZXQgdmlld3BvcnQ7XG4gICAgICAgIGlmIChyZWN0KSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IHJlY3QgaW4gbm9ybWFsaXplZCBzcGFjZSB0byB2aWV3cG9ydCBpbiBwaXhlbCBzcGFjZVxuICAgICAgICAgICAgY29uc3QgdyA9IHRhcmdldCA/IHRhcmdldC53aWR0aCA6IHRoaXMuZGV2aWNlLndpZHRoO1xuICAgICAgICAgICAgY29uc3QgaCA9IHRhcmdldCA/IHRhcmdldC5oZWlnaHQgOiB0aGlzLmRldmljZS5oZWlnaHQ7XG4gICAgICAgICAgICB2aWV3cG9ydCA9IF92aWV3cG9ydC5zZXQocmVjdC54ICogdywgcmVjdC55ICogaCwgcmVjdC56ICogdywgcmVjdC53ICogaCk7XG4gICAgICAgIH1cblxuICAgICAgICBkcmF3UXVhZFdpdGhTaGFkZXIodGhpcy5kZXZpY2UsIHRhcmdldCwgc2hhZGVyLCB2aWV3cG9ydCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBQb3N0RWZmZWN0IH07XG4iXSwibmFtZXMiOlsiX3ZpZXdwb3J0IiwiVmVjNCIsIlBvc3RFZmZlY3QiLCJjb25zdHJ1Y3RvciIsImdyYXBoaWNzRGV2aWNlIiwiZGV2aWNlIiwibmVlZHNEZXB0aEJ1ZmZlciIsInJlbmRlciIsImlucHV0VGFyZ2V0Iiwib3V0cHV0VGFyZ2V0IiwicmVjdCIsImRyYXdRdWFkIiwidGFyZ2V0Iiwic2hhZGVyIiwidmlld3BvcnQiLCJ3Iiwid2lkdGgiLCJoIiwiaGVpZ2h0Iiwic2V0IiwieCIsInkiLCJ6IiwiZHJhd1F1YWRXaXRoU2hhZGVyIiwicXVhZFZlcnRleFNoYWRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFHQSxNQUFNQSxTQUFTLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQyxVQUFVLENBQUM7QUFDYjtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDSUMsV0FBVyxDQUFDQyxjQUFjLEVBQUU7QUFDeEI7QUFDUjtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0MsTUFBTSxHQUFHRCxjQUFjLENBQUE7O0FBRTVCO0FBQ1I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNRLElBQUksQ0FBQ0UsZ0JBQWdCLEdBQUcsS0FBSyxDQUFBO0FBQ2pDLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7O0FBV0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsTUFBTSxDQUFDQyxXQUFXLEVBQUVDLFlBQVksRUFBRUMsSUFBSSxFQUFFLEVBQ3hDOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFFBQVEsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUVILElBQUksRUFBRTtBQUMzQixJQUFBLElBQUlJLFFBQVEsQ0FBQTtBQUNaLElBQUEsSUFBSUosSUFBSSxFQUFFO0FBQ047QUFDQSxNQUFBLE1BQU1LLENBQUMsR0FBR0gsTUFBTSxHQUFHQSxNQUFNLENBQUNJLEtBQUssR0FBRyxJQUFJLENBQUNYLE1BQU0sQ0FBQ1csS0FBSyxDQUFBO0FBQ25ELE1BQUEsTUFBTUMsQ0FBQyxHQUFHTCxNQUFNLEdBQUdBLE1BQU0sQ0FBQ00sTUFBTSxHQUFHLElBQUksQ0FBQ2IsTUFBTSxDQUFDYSxNQUFNLENBQUE7QUFDckRKLE1BQUFBLFFBQVEsR0FBR2QsU0FBUyxDQUFDbUIsR0FBRyxDQUFDVCxJQUFJLENBQUNVLENBQUMsR0FBR0wsQ0FBQyxFQUFFTCxJQUFJLENBQUNXLENBQUMsR0FBR0osQ0FBQyxFQUFFUCxJQUFJLENBQUNZLENBQUMsR0FBR1AsQ0FBQyxFQUFFTCxJQUFJLENBQUNLLENBQUMsR0FBR0UsQ0FBQyxDQUFDLENBQUE7QUFDNUUsS0FBQTtJQUVBTSxrQkFBa0IsQ0FBQyxJQUFJLENBQUNsQixNQUFNLEVBQUVPLE1BQU0sRUFBRUMsTUFBTSxFQUFFQyxRQUFRLENBQUMsQ0FBQTtBQUM3RCxHQUFBO0FBQ0osQ0FBQTtBQXhFTVosVUFBVSxDQTRCTHNCLGdCQUFnQixHQUFJLENBQUE7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFLLENBQUE7Ozs7In0=
