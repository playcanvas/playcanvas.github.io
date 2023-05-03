import { Debug } from '../../core/debug.js';
import { FILTER_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { LAYERID_DEPTH, SHADER_DEPTH, LAYERID_WORLD } from '../constants.js';
import { Layer } from '../layer.js';

// uniform names (first is current name, second one is deprecated name for compatibility)
const _depthUniformNames = ['uSceneDepthMap', 'uDepthMap'];
const _colorUniformNames = ['uSceneColorMap', 'texture_grabPass'];

/**
 * Internal class abstracting the access to the depth and color texture of the scene.
 * color frame buffer is copied to a texture
 * For webgl 2 devices, the depth buffer is copied to a texture
 * for webgl 1 devices, the scene's depth is rendered to a separate RGBA texture
 *
 * TODO: implement mipmapped color buffer support for WebGL 1 as well, which requires
 * the texture to be a power of two, by first downscaling the captured framebuffer
 * texture to smaller power of 2 texture, and then generate mipmaps and use it for rendering
 * TODO: or even better, implement blur filter to have smoother lower levels
 *
 * @ignore
 */
class SceneGrab {
  /**
   * Create an instance of SceneGrab.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
   * graphics device.
   * @param {import('../scene.js').Scene} scene - The scene.
   */
  constructor(device, scene) {
    Debug.assert(scene);
    this.scene = scene;
    Debug.assert(device);
    this.device = device;

    // create depth layer
    this.layer = null;

    // create a depth layer, which is a default depth layer, but also a template used
    // to patch application created depth layers to behave as one
    if (this.device.webgl2 || this.device.isWebGPU) {
      this.initMainPath();
    } else {
      this.initFallbackPath();
    }
  }

  /**
   * Returns true if the camera rendering scene grab textures requires a render pass to do it.
   *
   * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
   * graphics device used for rendering.
   * @param {import('../../framework/components/camera/component.js').CameraComponent} camera - The camera that
   * needs scene grab textures.
   */
  static requiresRenderPass(device, camera) {
    // just copy out the textures, no render pass needed
    if (device.webgl2 || device.isWebGPU) {
      return false;
    }

    // on WebGL1 device, only depth rendering needs render pass
    return camera.renderSceneDepthMap;
  }
  setupUniform(device, depth, buffer) {
    // assign it to scopes to expose it to shaders
    const names = depth ? _depthUniformNames : _colorUniformNames;
    names.forEach(name => device.scope.resolve(name).setValue(buffer));
  }
  allocateTexture(device, source, name, format, isDepth, mipmaps) {
    // allocate texture that will store the depth
    return new Texture(device, {
      name,
      format,
      width: source ? source.colorBuffer.width : device.width,
      height: source ? source.colorBuffer.height : device.height,
      mipmaps,
      minFilter: isDepth ? FILTER_NEAREST : mipmaps ? FILTER_LINEAR_MIPMAP_LINEAR : FILTER_LINEAR,
      magFilter: isDepth ? FILTER_NEAREST : FILTER_LINEAR,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
  }

  // texture format of the source texture the grab pass needs to copy
  getSourceColorFormat(texture) {
    var _texture$format;
    // based on the RT the camera renders to, otherwise framebuffer
    return (_texture$format = texture == null ? void 0 : texture.format) != null ? _texture$format : this.device.framebufferFormat;
  }
  shouldReallocate(targetRT, sourceTexture, testFormat) {
    // need to reallocate if format does not match
    if (testFormat) {
      const targetFormat = targetRT == null ? void 0 : targetRT.colorBuffer.format;
      const sourceFormat = this.getSourceColorFormat(sourceTexture);
      if (targetFormat !== sourceFormat) return true;
    }

    // need to reallocate if dimensions don't match
    const width = (sourceTexture == null ? void 0 : sourceTexture.width) || this.device.width;
    const height = (sourceTexture == null ? void 0 : sourceTexture.height) || this.device.height;
    return !targetRT || width !== targetRT.width || height !== targetRT.height;
  }
  allocateRenderTarget(renderTarget, sourceRenderTarget, device, format, isDepth, mipmaps, isDepthUniforms) {
    // texture / uniform names: new one (first), as well as old one  (second) for compatibility
    const names = isDepthUniforms ? _depthUniformNames : _colorUniformNames;

    // allocate texture buffer
    const buffer = this.allocateTexture(device, sourceRenderTarget, names[0], format, isDepth, mipmaps);
    if (renderTarget) {
      // if reallocating RT size, release previous framebuffer
      renderTarget.destroyFrameBuffers();

      // assign new texture
      if (isDepth) {
        renderTarget._depthBuffer = buffer;
      } else {
        renderTarget._colorBuffer = buffer;
      }
    } else {
      // create new render target with the texture
      renderTarget = new RenderTarget({
        name: 'renderTargetSceneGrab',
        colorBuffer: isDepth ? null : buffer,
        depthBuffer: isDepth ? buffer : null,
        depth: !isDepth,
        stencil: device.supportsStencil,
        autoResolve: false
      });
    }
    return renderTarget;
  }
  releaseRenderTarget(rt) {
    if (rt) {
      rt.destroyTextureBuffers();
      rt.destroy();
    }
  }

  // main path where both color and depth is copied from existing surface
  initMainPath() {
    const device = this.device;
    const self = this;

    // WebGL 2 depth layer just copies existing color or depth
    this.layer = new Layer({
      enabled: false,
      name: "Depth",
      id: LAYERID_DEPTH,
      onDisable: function () {
        self.releaseRenderTarget(this.depthRenderTarget);
        this.depthRenderTarget = null;
        self.releaseRenderTarget(this.colorRenderTarget);
        this.colorRenderTarget = null;
      },
      onPreRenderOpaque: function (cameraPass) {
        // resize depth map if needed

        /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
        const camera = this.cameras[cameraPass];
        if (camera.renderSceneColorMap) {
          var _camera$renderTarget;
          // allocate / resize existing RT as needed
          if (self.shouldReallocate(this.colorRenderTarget, (_camera$renderTarget = camera.renderTarget) == null ? void 0 : _camera$renderTarget.colorBuffer, true)) {
            var _camera$renderTarget2;
            self.releaseRenderTarget(this.colorRenderTarget);
            const format = self.getSourceColorFormat((_camera$renderTarget2 = camera.renderTarget) == null ? void 0 : _camera$renderTarget2.colorBuffer);
            this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, format, false, true, false);
          }

          // copy color from the current render target
          DebugGraphics.pushGpuMarker(device, 'GRAB-COLOR');
          const colorBuffer = this.colorRenderTarget.colorBuffer;
          if (device.isWebGPU) {
            device.copyRenderTarget(camera.renderTarget, this.colorRenderTarget, true, false);

            // generate mipmaps
            device.mipmapRenderer.generate(this.colorRenderTarget.colorBuffer.impl);
          } else {
            device.copyRenderTarget(device.renderTarget, this.colorRenderTarget, true, false);

            // generate mipmaps
            device.activeTexture(device.maxCombinedTextures - 1);
            device.bindTexture(colorBuffer);
            device.gl.generateMipmap(colorBuffer.impl._glTarget);
          }
          DebugGraphics.popGpuMarker(device);

          // assign unifrom
          self.setupUniform(device, false, colorBuffer);
        }
        if (camera.renderSceneDepthMap) {
          var _camera$renderTarget3;
          // reallocate RT if needed
          if (self.shouldReallocate(this.depthRenderTarget, (_camera$renderTarget3 = camera.renderTarget) == null ? void 0 : _camera$renderTarget3.depthBuffer)) {
            self.releaseRenderTarget(this.depthRenderTarget);
            this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, PIXELFORMAT_DEPTHSTENCIL, true, false, true);
          }

          // copy depth
          DebugGraphics.pushGpuMarker(device, 'GRAB-DEPTH');
          device.copyRenderTarget(device.renderTarget, this.depthRenderTarget, false, true);
          DebugGraphics.popGpuMarker(device);

          // assign unifrom
          self.setupUniform(device, true, this.depthRenderTarget.depthBuffer);
        }
      },
      onPostRenderOpaque: function (cameraPass) {}
    });
  }

  // fallback path, where copy is not possible and the scene gets re-rendered
  initFallbackPath() {
    const self = this;
    const device = this.device;
    const scene = this.scene;

    // WebGL 1 depth layer renders the same objects as in World, but with RGBA-encoded depth shader to get depth
    this.layer = new Layer({
      enabled: false,
      name: "Depth",
      id: LAYERID_DEPTH,
      shaderPass: SHADER_DEPTH,
      onEnable: function () {
        // create RT without textures, those will be created as needed later
        this.depthRenderTarget = new RenderTarget({
          name: 'depthRenderTarget-webgl1',
          depth: true,
          stencil: device.supportsStencil,
          autoResolve: false,
          graphicsDevice: device
        });

        // assign it so the render actions knows to render to it
        // TODO: avoid this as this API is deprecated
        this.renderTarget = this.depthRenderTarget;
      },
      onDisable: function () {
        // only release depth texture, but not the render target itself
        this.depthRenderTarget.destroyTextureBuffers();
        this.renderTarget = null;
        self.releaseRenderTarget(this.colorRenderTarget);
        this.colorRenderTarget = null;
      },
      onPostCull: function (cameraPass) {
        /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
        const camera = this.cameras[cameraPass];
        if (camera.renderSceneDepthMap) {
          var _camera$renderTarget4;
          // reallocate RT if needed
          if (!this.depthRenderTarget.depthBuffer || self.shouldReallocate(this.depthRenderTarget, (_camera$renderTarget4 = camera.renderTarget) == null ? void 0 : _camera$renderTarget4.depthBuffer)) {
            this.depthRenderTarget.destroyTextureBuffers();
            this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, PIXELFORMAT_RGBA8, false, false, true);
          }

          // Collect all rendered mesh instances with the same render target as World has, depthWrite == true and prior to this layer to replicate blitFramebuffer on WebGL2
          const visibleObjects = this.instances.visibleOpaque[cameraPass];
          const visibleList = visibleObjects.list;
          const layerComposition = scene.layers;
          const subLayerEnabled = layerComposition.subLayerEnabled;
          const isTransparent = layerComposition.subLayerList;

          // can't use self.defaultLayerWorld.renderTarget because projects that use the editor override default layers
          const rt = layerComposition.getLayerById(LAYERID_WORLD).renderTarget;
          let visibleLength = 0;
          const layers = layerComposition.layerList;
          for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer === this) break;
            if (layer.renderTarget !== rt || !layer.enabled || !subLayerEnabled[i]) continue;
            const layerCamId = layer.cameras.indexOf(camera);
            if (layerCamId < 0) continue;
            const transparent = isTransparent[i];
            let layerVisibleList = transparent ? layer.instances.visibleTransparent[layerCamId] : layer.instances.visibleOpaque[layerCamId];
            const layerVisibleListLength = layerVisibleList.length;
            layerVisibleList = layerVisibleList.list;
            for (let j = 0; j < layerVisibleListLength; j++) {
              const drawCall = layerVisibleList[j];
              if (drawCall.material && drawCall.material.depthWrite && !drawCall._noDepthDrawGl1) {
                visibleList[visibleLength] = drawCall;
                visibleLength++;
              }
            }
          }
          visibleObjects.length = visibleLength;
        }
      },
      onPreRenderOpaque: function (cameraPass) {
        /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
        const camera = this.cameras[cameraPass];
        if (camera.renderSceneColorMap) {
          var _camera$renderTarget5;
          // reallocate RT if needed
          if (self.shouldReallocate(this.colorRenderTarget, (_camera$renderTarget5 = camera.renderTarget) == null ? void 0 : _camera$renderTarget5.colorBuffer)) {
            var _camera$renderTarget6;
            self.releaseRenderTarget(this.colorRenderTarget);
            const format = self.getSourceColorFormat((_camera$renderTarget6 = camera.renderTarget) == null ? void 0 : _camera$renderTarget6.colorBuffer);
            this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, format, false, false, false);
          }

          // copy out the color buffer
          DebugGraphics.pushGpuMarker(device, 'GRAB-COLOR');

          // initialize the texture
          const colorBuffer = this.colorRenderTarget._colorBuffer;
          if (!colorBuffer.impl._glTexture) {
            colorBuffer.impl.initialize(device, colorBuffer);
          }

          // copy framebuffer to it
          device.bindTexture(colorBuffer);
          const gl = device.gl;
          gl.copyTexImage2D(gl.TEXTURE_2D, 0, colorBuffer.impl._glFormat, 0, 0, colorBuffer.width, colorBuffer.height, 0);

          // stop the device from updating this texture further
          colorBuffer._needsUpload = false;
          colorBuffer._needsMipmapsUpload = false;
          DebugGraphics.popGpuMarker(device);

          // assign unifrom
          self.setupUniform(device, false, colorBuffer);
        }
        if (camera.renderSceneDepthMap) {
          // assign unifrom
          self.setupUniform(device, true, this.depthRenderTarget.colorBuffer);
        }
      },
      onDrawCall: function () {
        // writing depth to color render target, force no blending and writing to all channels
        device.setBlendState(BlendState.DEFAULT);
      },
      onPostRenderOpaque: function (cameraPass) {
        /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
        const camera = this.cameras[cameraPass];
        if (camera.renderSceneDepthMap) {
          // just clear the list of visible objects to avoid keeping references
          const visibleObjects = this.instances.visibleOpaque[cameraPass];
          visibleObjects.length = 0;
        }
      }
    });
  }

  // function which patches a layer to use depth layer set up in this class
  patch(layer) {
    layer.onEnable = this.layer.onEnable;
    layer.onDisable = this.layer.onDisable;
    layer.onPreRenderOpaque = this.layer.onPreRenderOpaque;
    layer.onPostRenderOpaque = this.layer.onPostRenderOpaque;
    layer.shaderPass = this.layer.shaderPass;
    layer.onPostCull = this.layer.onPostCull;
    layer.onDrawCall = this.layer.onDrawCall;
  }
}

export { SceneGrab };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtZ3JhYi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoaWNzL3NjZW5lLWdyYWIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgRklMVEVSX05FQVJFU1QsIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwsIFBJWEVMRk9STUFUX1JHQkE4XG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgQmxlbmRTdGF0ZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2JsZW5kLXN0YXRlLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5cbmltcG9ydCB7XG4gICAgTEFZRVJJRF9ERVBUSCwgTEFZRVJJRF9XT1JMRCxcbiAgICBTSEFERVJfREVQVEhcbn0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcblxuaW1wb3J0IHsgTGF5ZXIgfSBmcm9tICcuLi9sYXllci5qcyc7XG5cbi8vIHVuaWZvcm0gbmFtZXMgKGZpcnN0IGlzIGN1cnJlbnQgbmFtZSwgc2Vjb25kIG9uZSBpcyBkZXByZWNhdGVkIG5hbWUgZm9yIGNvbXBhdGliaWxpdHkpXG5jb25zdCBfZGVwdGhVbmlmb3JtTmFtZXMgPSBbJ3VTY2VuZURlcHRoTWFwJywgJ3VEZXB0aE1hcCddO1xuY29uc3QgX2NvbG9yVW5pZm9ybU5hbWVzID0gWyd1U2NlbmVDb2xvck1hcCcsICd0ZXh0dXJlX2dyYWJQYXNzJ107XG5cbi8qKlxuICogSW50ZXJuYWwgY2xhc3MgYWJzdHJhY3RpbmcgdGhlIGFjY2VzcyB0byB0aGUgZGVwdGggYW5kIGNvbG9yIHRleHR1cmUgb2YgdGhlIHNjZW5lLlxuICogY29sb3IgZnJhbWUgYnVmZmVyIGlzIGNvcGllZCB0byBhIHRleHR1cmVcbiAqIEZvciB3ZWJnbCAyIGRldmljZXMsIHRoZSBkZXB0aCBidWZmZXIgaXMgY29waWVkIHRvIGEgdGV4dHVyZVxuICogZm9yIHdlYmdsIDEgZGV2aWNlcywgdGhlIHNjZW5lJ3MgZGVwdGggaXMgcmVuZGVyZWQgdG8gYSBzZXBhcmF0ZSBSR0JBIHRleHR1cmVcbiAqXG4gKiBUT0RPOiBpbXBsZW1lbnQgbWlwbWFwcGVkIGNvbG9yIGJ1ZmZlciBzdXBwb3J0IGZvciBXZWJHTCAxIGFzIHdlbGwsIHdoaWNoIHJlcXVpcmVzXG4gKiB0aGUgdGV4dHVyZSB0byBiZSBhIHBvd2VyIG9mIHR3bywgYnkgZmlyc3QgZG93bnNjYWxpbmcgdGhlIGNhcHR1cmVkIGZyYW1lYnVmZmVyXG4gKiB0ZXh0dXJlIHRvIHNtYWxsZXIgcG93ZXIgb2YgMiB0ZXh0dXJlLCBhbmQgdGhlbiBnZW5lcmF0ZSBtaXBtYXBzIGFuZCB1c2UgaXQgZm9yIHJlbmRlcmluZ1xuICogVE9ETzogb3IgZXZlbiBiZXR0ZXIsIGltcGxlbWVudCBibHVyIGZpbHRlciB0byBoYXZlIHNtb290aGVyIGxvd2VyIGxldmVsc1xuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgU2NlbmVHcmFiIHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYW4gaW5zdGFuY2Ugb2YgU2NlbmVHcmFiLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL3NjZW5lLmpzJykuU2NlbmV9IHNjZW5lIC0gVGhlIHNjZW5lLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSwgc2NlbmUpIHtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoc2NlbmUpO1xuICAgICAgICB0aGlzLnNjZW5lID0gc2NlbmU7XG5cbiAgICAgICAgRGVidWcuYXNzZXJ0KGRldmljZSk7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBkZXB0aCBsYXllclxuICAgICAgICB0aGlzLmxheWVyID0gbnVsbDtcblxuICAgICAgICAvLyBjcmVhdGUgYSBkZXB0aCBsYXllciwgd2hpY2ggaXMgYSBkZWZhdWx0IGRlcHRoIGxheWVyLCBidXQgYWxzbyBhIHRlbXBsYXRlIHVzZWRcbiAgICAgICAgLy8gdG8gcGF0Y2ggYXBwbGljYXRpb24gY3JlYXRlZCBkZXB0aCBsYXllcnMgdG8gYmVoYXZlIGFzIG9uZVxuICAgICAgICBpZiAodGhpcy5kZXZpY2Uud2ViZ2wyIHx8IHRoaXMuZGV2aWNlLmlzV2ViR1BVKSB7XG4gICAgICAgICAgICB0aGlzLmluaXRNYWluUGF0aCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5pbml0RmFsbGJhY2tQYXRoKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGNhbWVyYSByZW5kZXJpbmcgc2NlbmUgZ3JhYiB0ZXh0dXJlcyByZXF1aXJlcyBhIHJlbmRlciBwYXNzIHRvIGRvIGl0LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcycpLkdyYXBoaWNzRGV2aWNlfSBkZXZpY2UgLSBUaGVcbiAgICAgKiBncmFwaGljcyBkZXZpY2UgdXNlZCBmb3IgcmVuZGVyaW5nLlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBjYW1lcmEgLSBUaGUgY2FtZXJhIHRoYXRcbiAgICAgKiBuZWVkcyBzY2VuZSBncmFiIHRleHR1cmVzLlxuICAgICAqL1xuICAgIHN0YXRpYyByZXF1aXJlc1JlbmRlclBhc3MoZGV2aWNlLCBjYW1lcmEpIHtcblxuICAgICAgICAvLyBqdXN0IGNvcHkgb3V0IHRoZSB0ZXh0dXJlcywgbm8gcmVuZGVyIHBhc3MgbmVlZGVkXG4gICAgICAgIGlmIChkZXZpY2Uud2ViZ2wyIHx8IGRldmljZS5pc1dlYkdQVSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gb24gV2ViR0wxIGRldmljZSwgb25seSBkZXB0aCByZW5kZXJpbmcgbmVlZHMgcmVuZGVyIHBhc3NcbiAgICAgICAgcmV0dXJuIGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwO1xuICAgIH1cblxuICAgIHNldHVwVW5pZm9ybShkZXZpY2UsIGRlcHRoLCBidWZmZXIpIHtcblxuICAgICAgICAvLyBhc3NpZ24gaXQgdG8gc2NvcGVzIHRvIGV4cG9zZSBpdCB0byBzaGFkZXJzXG4gICAgICAgIGNvbnN0IG5hbWVzID0gZGVwdGggPyBfZGVwdGhVbmlmb3JtTmFtZXMgOiBfY29sb3JVbmlmb3JtTmFtZXM7XG4gICAgICAgIG5hbWVzLmZvckVhY2gobmFtZSA9PiBkZXZpY2Uuc2NvcGUucmVzb2x2ZShuYW1lKS5zZXRWYWx1ZShidWZmZXIpKTtcbiAgICB9XG5cbiAgICBhbGxvY2F0ZVRleHR1cmUoZGV2aWNlLCBzb3VyY2UsIG5hbWUsIGZvcm1hdCwgaXNEZXB0aCwgbWlwbWFwcykge1xuXG4gICAgICAgIC8vIGFsbG9jYXRlIHRleHR1cmUgdGhhdCB3aWxsIHN0b3JlIHRoZSBkZXB0aFxuICAgICAgICByZXR1cm4gbmV3IFRleHR1cmUoZGV2aWNlLCB7XG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgZm9ybWF0LFxuICAgICAgICAgICAgd2lkdGg6IHNvdXJjZSA/IHNvdXJjZS5jb2xvckJ1ZmZlci53aWR0aCA6IGRldmljZS53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogc291cmNlID8gc291cmNlLmNvbG9yQnVmZmVyLmhlaWdodCA6IGRldmljZS5oZWlnaHQsXG4gICAgICAgICAgICBtaXBtYXBzLFxuICAgICAgICAgICAgbWluRmlsdGVyOiBpc0RlcHRoID8gRklMVEVSX05FQVJFU1QgOiAobWlwbWFwcyA/IEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiA6IEZJTFRFUl9MSU5FQVIpLFxuICAgICAgICAgICAgbWFnRmlsdGVyOiBpc0RlcHRoID8gRklMVEVSX05FQVJFU1QgOiBGSUxURVJfTElORUFSLFxuICAgICAgICAgICAgYWRkcmVzc1U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIGFkZHJlc3NWOiBBRERSRVNTX0NMQU1QX1RPX0VER0VcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gdGV4dHVyZSBmb3JtYXQgb2YgdGhlIHNvdXJjZSB0ZXh0dXJlIHRoZSBncmFiIHBhc3MgbmVlZHMgdG8gY29weVxuICAgIGdldFNvdXJjZUNvbG9yRm9ybWF0KHRleHR1cmUpIHtcbiAgICAgICAgLy8gYmFzZWQgb24gdGhlIFJUIHRoZSBjYW1lcmEgcmVuZGVycyB0bywgb3RoZXJ3aXNlIGZyYW1lYnVmZmVyXG4gICAgICAgIHJldHVybiB0ZXh0dXJlPy5mb3JtYXQgPz8gdGhpcy5kZXZpY2UuZnJhbWVidWZmZXJGb3JtYXQ7XG4gICAgfVxuXG4gICAgc2hvdWxkUmVhbGxvY2F0ZSh0YXJnZXRSVCwgc291cmNlVGV4dHVyZSwgdGVzdEZvcm1hdCkge1xuXG4gICAgICAgIC8vIG5lZWQgdG8gcmVhbGxvY2F0ZSBpZiBmb3JtYXQgZG9lcyBub3QgbWF0Y2hcbiAgICAgICAgaWYgKHRlc3RGb3JtYXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldEZvcm1hdCA9IHRhcmdldFJUPy5jb2xvckJ1ZmZlci5mb3JtYXQ7XG4gICAgICAgICAgICBjb25zdCBzb3VyY2VGb3JtYXQgPSB0aGlzLmdldFNvdXJjZUNvbG9yRm9ybWF0KHNvdXJjZVRleHR1cmUpO1xuICAgICAgICAgICAgaWYgKHRhcmdldEZvcm1hdCAhPT0gc291cmNlRm9ybWF0KVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbmVlZCB0byByZWFsbG9jYXRlIGlmIGRpbWVuc2lvbnMgZG9uJ3QgbWF0Y2hcbiAgICAgICAgY29uc3Qgd2lkdGggPSBzb3VyY2VUZXh0dXJlPy53aWR0aCB8fCB0aGlzLmRldmljZS53aWR0aDtcbiAgICAgICAgY29uc3QgaGVpZ2h0ID0gc291cmNlVGV4dHVyZT8uaGVpZ2h0IHx8IHRoaXMuZGV2aWNlLmhlaWdodDtcbiAgICAgICAgcmV0dXJuICF0YXJnZXRSVCB8fCB3aWR0aCAhPT0gdGFyZ2V0UlQud2lkdGggfHwgaGVpZ2h0ICE9PSB0YXJnZXRSVC5oZWlnaHQ7XG4gICAgfVxuXG4gICAgYWxsb2NhdGVSZW5kZXJUYXJnZXQocmVuZGVyVGFyZ2V0LCBzb3VyY2VSZW5kZXJUYXJnZXQsIGRldmljZSwgZm9ybWF0LCBpc0RlcHRoLCBtaXBtYXBzLCBpc0RlcHRoVW5pZm9ybXMpIHtcblxuICAgICAgICAvLyB0ZXh0dXJlIC8gdW5pZm9ybSBuYW1lczogbmV3IG9uZSAoZmlyc3QpLCBhcyB3ZWxsIGFzIG9sZCBvbmUgIChzZWNvbmQpIGZvciBjb21wYXRpYmlsaXR5XG4gICAgICAgIGNvbnN0IG5hbWVzID0gaXNEZXB0aFVuaWZvcm1zID8gX2RlcHRoVW5pZm9ybU5hbWVzIDogX2NvbG9yVW5pZm9ybU5hbWVzO1xuXG4gICAgICAgIC8vIGFsbG9jYXRlIHRleHR1cmUgYnVmZmVyXG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IHRoaXMuYWxsb2NhdGVUZXh0dXJlKGRldmljZSwgc291cmNlUmVuZGVyVGFyZ2V0LCBuYW1lc1swXSwgZm9ybWF0LCBpc0RlcHRoLCBtaXBtYXBzKTtcblxuICAgICAgICBpZiAocmVuZGVyVGFyZ2V0KSB7XG5cbiAgICAgICAgICAgIC8vIGlmIHJlYWxsb2NhdGluZyBSVCBzaXplLCByZWxlYXNlIHByZXZpb3VzIGZyYW1lYnVmZmVyXG4gICAgICAgICAgICByZW5kZXJUYXJnZXQuZGVzdHJveUZyYW1lQnVmZmVycygpO1xuXG4gICAgICAgICAgICAvLyBhc3NpZ24gbmV3IHRleHR1cmVcbiAgICAgICAgICAgIGlmIChpc0RlcHRoKSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyVGFyZ2V0Ll9kZXB0aEJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVuZGVyVGFyZ2V0Ll9jb2xvckJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgLy8gY3JlYXRlIG5ldyByZW5kZXIgdGFyZ2V0IHdpdGggdGhlIHRleHR1cmVcbiAgICAgICAgICAgIHJlbmRlclRhcmdldCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIG5hbWU6ICdyZW5kZXJUYXJnZXRTY2VuZUdyYWInLFxuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiBpc0RlcHRoID8gbnVsbCA6IGJ1ZmZlcixcbiAgICAgICAgICAgICAgICBkZXB0aEJ1ZmZlcjogaXNEZXB0aCA/IGJ1ZmZlciA6IG51bGwsXG4gICAgICAgICAgICAgICAgZGVwdGg6ICFpc0RlcHRoLFxuICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGRldmljZS5zdXBwb3J0c1N0ZW5jaWwsXG4gICAgICAgICAgICAgICAgYXV0b1Jlc29sdmU6IGZhbHNlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZW5kZXJUYXJnZXQ7XG4gICAgfVxuXG4gICAgcmVsZWFzZVJlbmRlclRhcmdldChydCkge1xuXG4gICAgICAgIGlmIChydCkge1xuICAgICAgICAgICAgcnQuZGVzdHJveVRleHR1cmVCdWZmZXJzKCk7XG4gICAgICAgICAgICBydC5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBtYWluIHBhdGggd2hlcmUgYm90aCBjb2xvciBhbmQgZGVwdGggaXMgY29waWVkIGZyb20gZXhpc3Rpbmcgc3VyZmFjZVxuICAgIGluaXRNYWluUGF0aCgpIHtcblxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgLy8gV2ViR0wgMiBkZXB0aCBsYXllciBqdXN0IGNvcGllcyBleGlzdGluZyBjb2xvciBvciBkZXB0aFxuICAgICAgICB0aGlzLmxheWVyID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIGVuYWJsZWQ6IGZhbHNlLFxuICAgICAgICAgICAgbmFtZTogXCJEZXB0aFwiLFxuICAgICAgICAgICAgaWQ6IExBWUVSSURfREVQVEgsXG5cbiAgICAgICAgICAgIG9uRGlzYWJsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNlbGYucmVsZWFzZVJlbmRlclRhcmdldCh0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0ID0gbnVsbDtcblxuICAgICAgICAgICAgICAgIHNlbGYucmVsZWFzZVJlbmRlclRhcmdldCh0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICB0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uUHJlUmVuZGVyT3BhcXVlOiBmdW5jdGlvbiAoY2FtZXJhUGFzcykgeyAvLyByZXNpemUgZGVwdGggbWFwIGlmIG5lZWRlZFxuXG4gICAgICAgICAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9ICovXG4gICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gdGhpcy5jYW1lcmFzW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYWxsb2NhdGUgLyByZXNpemUgZXhpc3RpbmcgUlQgYXMgbmVlZGVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLnNob3VsZFJlYWxsb2NhdGUodGhpcy5jb2xvclJlbmRlclRhcmdldCwgY2FtZXJhLnJlbmRlclRhcmdldD8uY29sb3JCdWZmZXIsIHRydWUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbGVhc2VSZW5kZXJUYXJnZXQodGhpcy5jb2xvclJlbmRlclRhcmdldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtYXQgPSBzZWxmLmdldFNvdXJjZUNvbG9yRm9ybWF0KGNhbWVyYS5yZW5kZXJUYXJnZXQ/LmNvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY29sb3JSZW5kZXJUYXJnZXQgPSBzZWxmLmFsbG9jYXRlUmVuZGVyVGFyZ2V0KHRoaXMuY29sb3JSZW5kZXJUYXJnZXQsIGNhbWVyYS5yZW5kZXJUYXJnZXQsIGRldmljZSwgZm9ybWF0LCBmYWxzZSwgdHJ1ZSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29weSBjb2xvciBmcm9tIHRoZSBjdXJyZW50IHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wdXNoR3B1TWFya2VyKGRldmljZSwgJ0dSQUItQ09MT1InKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xvckJ1ZmZlciA9IHRoaXMuY29sb3JSZW5kZXJUYXJnZXQuY29sb3JCdWZmZXI7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGRldmljZS5pc1dlYkdQVSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2UuY29weVJlbmRlclRhcmdldChjYW1lcmEucmVuZGVyVGFyZ2V0LCB0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0LCB0cnVlLCBmYWxzZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGdlbmVyYXRlIG1pcG1hcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5taXBtYXBSZW5kZXJlci5nZW5lcmF0ZSh0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0LmNvbG9yQnVmZmVyLmltcGwpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5jb3B5UmVuZGVyVGFyZ2V0KGRldmljZS5yZW5kZXJUYXJnZXQsIHRoaXMuY29sb3JSZW5kZXJUYXJnZXQsIHRydWUsIGZhbHNlKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZ2VuZXJhdGUgbWlwbWFwc1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLmFjdGl2ZVRleHR1cmUoZGV2aWNlLm1heENvbWJpbmVkVGV4dHVyZXMgLSAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5iaW5kVGV4dHVyZShjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2UuZ2wuZ2VuZXJhdGVNaXBtYXAoY29sb3JCdWZmZXIuaW1wbC5fZ2xUYXJnZXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ24gdW5pZnJvbVxuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldHVwVW5pZm9ybShkZXZpY2UsIGZhbHNlLCBjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVhbGxvY2F0ZSBSVCBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuc2hvdWxkUmVhbGxvY2F0ZSh0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0LCBjYW1lcmEucmVuZGVyVGFyZ2V0Py5kZXB0aEJ1ZmZlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucmVsZWFzZVJlbmRlclRhcmdldCh0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQgPSBzZWxmLmFsbG9jYXRlUmVuZGVyVGFyZ2V0KHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQsIGNhbWVyYS5yZW5kZXJUYXJnZXQsIGRldmljZSwgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBjb3B5IGRlcHRoXG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdHUkFCLURFUFRIJyk7XG4gICAgICAgICAgICAgICAgICAgIGRldmljZS5jb3B5UmVuZGVyVGFyZ2V0KGRldmljZS5yZW5kZXJUYXJnZXQsIHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQsIGZhbHNlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ24gdW5pZnJvbVxuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldHVwVW5pZm9ybShkZXZpY2UsIHRydWUsIHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQuZGVwdGhCdWZmZXIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uUG9zdFJlbmRlck9wYXF1ZTogZnVuY3Rpb24gKGNhbWVyYVBhc3MpIHtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gZmFsbGJhY2sgcGF0aCwgd2hlcmUgY29weSBpcyBub3QgcG9zc2libGUgYW5kIHRoZSBzY2VuZSBnZXRzIHJlLXJlbmRlcmVkXG4gICAgaW5pdEZhbGxiYWNrUGF0aCgpIHtcblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcblxuICAgICAgICAvLyBXZWJHTCAxIGRlcHRoIGxheWVyIHJlbmRlcnMgdGhlIHNhbWUgb2JqZWN0cyBhcyBpbiBXb3JsZCwgYnV0IHdpdGggUkdCQS1lbmNvZGVkIGRlcHRoIHNoYWRlciB0byBnZXQgZGVwdGhcbiAgICAgICAgdGhpcy5sYXllciA9IG5ldyBMYXllcih7XG4gICAgICAgICAgICBlbmFibGVkOiBmYWxzZSxcbiAgICAgICAgICAgIG5hbWU6IFwiRGVwdGhcIixcbiAgICAgICAgICAgIGlkOiBMQVlFUklEX0RFUFRILFxuICAgICAgICAgICAgc2hhZGVyUGFzczogU0hBREVSX0RFUFRILFxuXG4gICAgICAgICAgICBvbkVuYWJsZTogZnVuY3Rpb24gKCkge1xuXG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIFJUIHdpdGhvdXQgdGV4dHVyZXMsIHRob3NlIHdpbGwgYmUgY3JlYXRlZCBhcyBuZWVkZWQgbGF0ZXJcbiAgICAgICAgICAgICAgICB0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0ID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdkZXB0aFJlbmRlclRhcmdldC13ZWJnbDEnLFxuICAgICAgICAgICAgICAgICAgICBkZXB0aDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgc3RlbmNpbDogZGV2aWNlLnN1cHBvcnRzU3RlbmNpbCxcbiAgICAgICAgICAgICAgICAgICAgYXV0b1Jlc29sdmU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBncmFwaGljc0RldmljZTogZGV2aWNlXG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBhc3NpZ24gaXQgc28gdGhlIHJlbmRlciBhY3Rpb25zIGtub3dzIHRvIHJlbmRlciB0byBpdFxuICAgICAgICAgICAgICAgIC8vIFRPRE86IGF2b2lkIHRoaXMgYXMgdGhpcyBBUEkgaXMgZGVwcmVjYXRlZFxuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyVGFyZ2V0ID0gdGhpcy5kZXB0aFJlbmRlclRhcmdldDtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uRGlzYWJsZTogZnVuY3Rpb24gKCkge1xuXG4gICAgICAgICAgICAgICAgLy8gb25seSByZWxlYXNlIGRlcHRoIHRleHR1cmUsIGJ1dCBub3QgdGhlIHJlbmRlciB0YXJnZXQgaXRzZWxmXG4gICAgICAgICAgICAgICAgdGhpcy5kZXB0aFJlbmRlclRhcmdldC5kZXN0cm95VGV4dHVyZUJ1ZmZlcnMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICBzZWxmLnJlbGVhc2VSZW5kZXJUYXJnZXQodGhpcy5jb2xvclJlbmRlclRhcmdldCk7XG4gICAgICAgICAgICAgICAgdGhpcy5jb2xvclJlbmRlclRhcmdldCA9IG51bGw7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvblBvc3RDdWxsOiBmdW5jdGlvbiAoY2FtZXJhUGFzcykge1xuXG4gICAgICAgICAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9ICovXG4gICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gdGhpcy5jYW1lcmFzW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVhbGxvY2F0ZSBSVCBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKCF0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0LmRlcHRoQnVmZmVyIHx8IHNlbGYuc2hvdWxkUmVhbGxvY2F0ZSh0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0LCBjYW1lcmEucmVuZGVyVGFyZ2V0Py5kZXB0aEJ1ZmZlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQuZGVzdHJveVRleHR1cmVCdWZmZXJzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0ID0gc2VsZi5hbGxvY2F0ZVJlbmRlclRhcmdldCh0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0LCBjYW1lcmEucmVuZGVyVGFyZ2V0LCBkZXZpY2UsIFBJWEVMRk9STUFUX1JHQkE4LCBmYWxzZSwgZmFsc2UsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ29sbGVjdCBhbGwgcmVuZGVyZWQgbWVzaCBpbnN0YW5jZXMgd2l0aCB0aGUgc2FtZSByZW5kZXIgdGFyZ2V0IGFzIFdvcmxkIGhhcywgZGVwdGhXcml0ZSA9PSB0cnVlIGFuZCBwcmlvciB0byB0aGlzIGxheWVyIHRvIHJlcGxpY2F0ZSBibGl0RnJhbWVidWZmZXIgb24gV2ViR0wyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZpc2libGVPYmplY3RzID0gdGhpcy5pbnN0YW5jZXMudmlzaWJsZU9wYXF1ZVtjYW1lcmFQYXNzXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmlzaWJsZUxpc3QgPSB2aXNpYmxlT2JqZWN0cy5saXN0O1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllckNvbXBvc2l0aW9uID0gc2NlbmUubGF5ZXJzO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJMYXllckVuYWJsZWQgPSBsYXllckNvbXBvc2l0aW9uLnN1YkxheWVyRW5hYmxlZDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNUcmFuc3BhcmVudCA9IGxheWVyQ29tcG9zaXRpb24uc3ViTGF5ZXJMaXN0O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbid0IHVzZSBzZWxmLmRlZmF1bHRMYXllcldvcmxkLnJlbmRlclRhcmdldCBiZWNhdXNlIHByb2plY3RzIHRoYXQgdXNlIHRoZSBlZGl0b3Igb3ZlcnJpZGUgZGVmYXVsdCBsYXllcnNcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcnQgPSBsYXllckNvbXBvc2l0aW9uLmdldExheWVyQnlJZChMQVlFUklEX1dPUkxEKS5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IHZpc2libGVMZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllcnMgPSBsYXllckNvbXBvc2l0aW9uLmxheWVyTGlzdDtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzW2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyID09PSB0aGlzKSBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXllci5yZW5kZXJUYXJnZXQgIT09IHJ0IHx8ICFsYXllci5lbmFibGVkIHx8ICFzdWJMYXllckVuYWJsZWRbaV0pIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllckNhbUlkID0gbGF5ZXIuY2FtZXJhcy5pbmRleE9mKGNhbWVyYSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXJDYW1JZCA8IDApIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0cmFuc3BhcmVudCA9IGlzVHJhbnNwYXJlbnRbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgbGF5ZXJWaXNpYmxlTGlzdCA9IHRyYW5zcGFyZW50ID8gbGF5ZXIuaW5zdGFuY2VzLnZpc2libGVUcmFuc3BhcmVudFtsYXllckNhbUlkXSA6IGxheWVyLmluc3RhbmNlcy52aXNpYmxlT3BhcXVlW2xheWVyQ2FtSWRdO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXJWaXNpYmxlTGlzdExlbmd0aCA9IGxheWVyVmlzaWJsZUxpc3QubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXJWaXNpYmxlTGlzdCA9IGxheWVyVmlzaWJsZUxpc3QubGlzdDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBsYXllclZpc2libGVMaXN0TGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkcmF3Q2FsbCA9IGxheWVyVmlzaWJsZUxpc3Rbal07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRyYXdDYWxsLm1hdGVyaWFsICYmIGRyYXdDYWxsLm1hdGVyaWFsLmRlcHRoV3JpdGUgJiYgIWRyYXdDYWxsLl9ub0RlcHRoRHJhd0dsMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlTGlzdFt2aXNpYmxlTGVuZ3RoXSA9IGRyYXdDYWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlTGVuZ3RoKys7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHZpc2libGVPYmplY3RzLmxlbmd0aCA9IHZpc2libGVMZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25QcmVSZW5kZXJPcGFxdWU6IGZ1bmN0aW9uIChjYW1lcmFQYXNzKSB7XG5cbiAgICAgICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gKi9cbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSB0aGlzLmNhbWVyYXNbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLnJlbmRlclNjZW5lQ29sb3JNYXApIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyByZWFsbG9jYXRlIFJUIGlmIG5lZWRlZFxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VsZi5zaG91bGRSZWFsbG9jYXRlKHRoaXMuY29sb3JSZW5kZXJUYXJnZXQsIGNhbWVyYS5yZW5kZXJUYXJnZXQ/LmNvbG9yQnVmZmVyKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5yZWxlYXNlUmVuZGVyVGFyZ2V0KHRoaXMuY29sb3JSZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0ID0gc2VsZi5nZXRTb3VyY2VDb2xvckZvcm1hdChjYW1lcmEucmVuZGVyVGFyZ2V0Py5jb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0ID0gc2VsZi5hbGxvY2F0ZVJlbmRlclRhcmdldCh0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0LCBjYW1lcmEucmVuZGVyVGFyZ2V0LCBkZXZpY2UsIGZvcm1hdCwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBjb3B5IG91dCB0aGUgY29sb3IgYnVmZmVyXG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucHVzaEdwdU1hcmtlcihkZXZpY2UsICdHUkFCLUNPTE9SJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSB0aGUgdGV4dHVyZVxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb2xvckJ1ZmZlciA9IHRoaXMuY29sb3JSZW5kZXJUYXJnZXQuX2NvbG9yQnVmZmVyO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbG9yQnVmZmVyLmltcGwuX2dsVGV4dHVyZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3JCdWZmZXIuaW1wbC5pbml0aWFsaXplKGRldmljZSwgY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29weSBmcmFtZWJ1ZmZlciB0byBpdFxuICAgICAgICAgICAgICAgICAgICBkZXZpY2UuYmluZFRleHR1cmUoY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBnbCA9IGRldmljZS5nbDtcbiAgICAgICAgICAgICAgICAgICAgZ2wuY29weVRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgY29sb3JCdWZmZXIuaW1wbC5fZ2xGb3JtYXQsIDAsIDAsIGNvbG9yQnVmZmVyLndpZHRoLCBjb2xvckJ1ZmZlci5oZWlnaHQsIDApO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHN0b3AgdGhlIGRldmljZSBmcm9tIHVwZGF0aW5nIHRoaXMgdGV4dHVyZSBmdXJ0aGVyXG4gICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyLl9uZWVkc1VwbG9hZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlci5fbmVlZHNNaXBtYXBzVXBsb2FkID0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ24gdW5pZnJvbVxuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldHVwVW5pZm9ybShkZXZpY2UsIGZhbHNlLCBjb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5yZW5kZXJTY2VuZURlcHRoTWFwKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGFzc2lnbiB1bmlmcm9tXG4gICAgICAgICAgICAgICAgICAgIHNlbGYuc2V0dXBVbmlmb3JtKGRldmljZSwgdHJ1ZSwgdGhpcy5kZXB0aFJlbmRlclRhcmdldC5jb2xvckJ1ZmZlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25EcmF3Q2FsbDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIC8vIHdyaXRpbmcgZGVwdGggdG8gY29sb3IgcmVuZGVyIHRhcmdldCwgZm9yY2Ugbm8gYmxlbmRpbmcgYW5kIHdyaXRpbmcgdG8gYWxsIGNoYW5uZWxzXG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kU3RhdGUoQmxlbmRTdGF0ZS5ERUZBVUxUKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uUG9zdFJlbmRlck9wYXF1ZTogZnVuY3Rpb24gKGNhbWVyYVBhc3MpIHtcblxuICAgICAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSAqL1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHRoaXMuY2FtZXJhc1tjYW1lcmFQYXNzXTtcblxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBqdXN0IGNsZWFyIHRoZSBsaXN0IG9mIHZpc2libGUgb2JqZWN0cyB0byBhdm9pZCBrZWVwaW5nIHJlZmVyZW5jZXNcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmlzaWJsZU9iamVjdHMgPSB0aGlzLmluc3RhbmNlcy52aXNpYmxlT3BhcXVlW2NhbWVyYVBhc3NdO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlT2JqZWN0cy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gZnVuY3Rpb24gd2hpY2ggcGF0Y2hlcyBhIGxheWVyIHRvIHVzZSBkZXB0aCBsYXllciBzZXQgdXAgaW4gdGhpcyBjbGFzc1xuICAgIHBhdGNoKGxheWVyKSB7XG5cbiAgICAgICAgbGF5ZXIub25FbmFibGUgPSB0aGlzLmxheWVyLm9uRW5hYmxlO1xuICAgICAgICBsYXllci5vbkRpc2FibGUgPSB0aGlzLmxheWVyLm9uRGlzYWJsZTtcbiAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJPcGFxdWUgPSB0aGlzLmxheWVyLm9uUHJlUmVuZGVyT3BhcXVlO1xuICAgICAgICBsYXllci5vblBvc3RSZW5kZXJPcGFxdWUgPSB0aGlzLmxheWVyLm9uUG9zdFJlbmRlck9wYXF1ZTtcbiAgICAgICAgbGF5ZXIuc2hhZGVyUGFzcyA9IHRoaXMubGF5ZXIuc2hhZGVyUGFzcztcbiAgICAgICAgbGF5ZXIub25Qb3N0Q3VsbCA9IHRoaXMubGF5ZXIub25Qb3N0Q3VsbDtcbiAgICAgICAgbGF5ZXIub25EcmF3Q2FsbCA9IHRoaXMubGF5ZXIub25EcmF3Q2FsbDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNjZW5lR3JhYiB9O1xuIl0sIm5hbWVzIjpbIl9kZXB0aFVuaWZvcm1OYW1lcyIsIl9jb2xvclVuaWZvcm1OYW1lcyIsIlNjZW5lR3JhYiIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwic2NlbmUiLCJEZWJ1ZyIsImFzc2VydCIsImxheWVyIiwid2ViZ2wyIiwiaXNXZWJHUFUiLCJpbml0TWFpblBhdGgiLCJpbml0RmFsbGJhY2tQYXRoIiwicmVxdWlyZXNSZW5kZXJQYXNzIiwiY2FtZXJhIiwicmVuZGVyU2NlbmVEZXB0aE1hcCIsInNldHVwVW5pZm9ybSIsImRlcHRoIiwiYnVmZmVyIiwibmFtZXMiLCJmb3JFYWNoIiwibmFtZSIsInNjb3BlIiwicmVzb2x2ZSIsInNldFZhbHVlIiwiYWxsb2NhdGVUZXh0dXJlIiwic291cmNlIiwiZm9ybWF0IiwiaXNEZXB0aCIsIm1pcG1hcHMiLCJUZXh0dXJlIiwid2lkdGgiLCJjb2xvckJ1ZmZlciIsImhlaWdodCIsIm1pbkZpbHRlciIsIkZJTFRFUl9ORUFSRVNUIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUiIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiYWRkcmVzc1YiLCJnZXRTb3VyY2VDb2xvckZvcm1hdCIsInRleHR1cmUiLCJfdGV4dHVyZSRmb3JtYXQiLCJmcmFtZWJ1ZmZlckZvcm1hdCIsInNob3VsZFJlYWxsb2NhdGUiLCJ0YXJnZXRSVCIsInNvdXJjZVRleHR1cmUiLCJ0ZXN0Rm9ybWF0IiwidGFyZ2V0Rm9ybWF0Iiwic291cmNlRm9ybWF0IiwiYWxsb2NhdGVSZW5kZXJUYXJnZXQiLCJyZW5kZXJUYXJnZXQiLCJzb3VyY2VSZW5kZXJUYXJnZXQiLCJpc0RlcHRoVW5pZm9ybXMiLCJkZXN0cm95RnJhbWVCdWZmZXJzIiwiX2RlcHRoQnVmZmVyIiwiX2NvbG9yQnVmZmVyIiwiUmVuZGVyVGFyZ2V0IiwiZGVwdGhCdWZmZXIiLCJzdGVuY2lsIiwic3VwcG9ydHNTdGVuY2lsIiwiYXV0b1Jlc29sdmUiLCJyZWxlYXNlUmVuZGVyVGFyZ2V0IiwicnQiLCJkZXN0cm95VGV4dHVyZUJ1ZmZlcnMiLCJkZXN0cm95Iiwic2VsZiIsIkxheWVyIiwiZW5hYmxlZCIsImlkIiwiTEFZRVJJRF9ERVBUSCIsIm9uRGlzYWJsZSIsImRlcHRoUmVuZGVyVGFyZ2V0IiwiY29sb3JSZW5kZXJUYXJnZXQiLCJvblByZVJlbmRlck9wYXF1ZSIsImNhbWVyYVBhc3MiLCJjYW1lcmFzIiwicmVuZGVyU2NlbmVDb2xvck1hcCIsIl9jYW1lcmEkcmVuZGVyVGFyZ2V0IiwiX2NhbWVyYSRyZW5kZXJUYXJnZXQyIiwiRGVidWdHcmFwaGljcyIsInB1c2hHcHVNYXJrZXIiLCJjb3B5UmVuZGVyVGFyZ2V0IiwibWlwbWFwUmVuZGVyZXIiLCJnZW5lcmF0ZSIsImltcGwiLCJhY3RpdmVUZXh0dXJlIiwibWF4Q29tYmluZWRUZXh0dXJlcyIsImJpbmRUZXh0dXJlIiwiZ2wiLCJnZW5lcmF0ZU1pcG1hcCIsIl9nbFRhcmdldCIsInBvcEdwdU1hcmtlciIsIl9jYW1lcmEkcmVuZGVyVGFyZ2V0MyIsIlBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCIsIm9uUG9zdFJlbmRlck9wYXF1ZSIsInNoYWRlclBhc3MiLCJTSEFERVJfREVQVEgiLCJvbkVuYWJsZSIsImdyYXBoaWNzRGV2aWNlIiwib25Qb3N0Q3VsbCIsIl9jYW1lcmEkcmVuZGVyVGFyZ2V0NCIsIlBJWEVMRk9STUFUX1JHQkE4IiwidmlzaWJsZU9iamVjdHMiLCJpbnN0YW5jZXMiLCJ2aXNpYmxlT3BhcXVlIiwidmlzaWJsZUxpc3QiLCJsaXN0IiwibGF5ZXJDb21wb3NpdGlvbiIsImxheWVycyIsInN1YkxheWVyRW5hYmxlZCIsImlzVHJhbnNwYXJlbnQiLCJzdWJMYXllckxpc3QiLCJnZXRMYXllckJ5SWQiLCJMQVlFUklEX1dPUkxEIiwidmlzaWJsZUxlbmd0aCIsImxheWVyTGlzdCIsImkiLCJsZW5ndGgiLCJsYXllckNhbUlkIiwiaW5kZXhPZiIsInRyYW5zcGFyZW50IiwibGF5ZXJWaXNpYmxlTGlzdCIsInZpc2libGVUcmFuc3BhcmVudCIsImxheWVyVmlzaWJsZUxpc3RMZW5ndGgiLCJqIiwiZHJhd0NhbGwiLCJtYXRlcmlhbCIsImRlcHRoV3JpdGUiLCJfbm9EZXB0aERyYXdHbDEiLCJfY2FtZXJhJHJlbmRlclRhcmdldDUiLCJfY2FtZXJhJHJlbmRlclRhcmdldDYiLCJfZ2xUZXh0dXJlIiwiaW5pdGlhbGl6ZSIsImNvcHlUZXhJbWFnZTJEIiwiVEVYVFVSRV8yRCIsIl9nbEZvcm1hdCIsIl9uZWVkc1VwbG9hZCIsIl9uZWVkc01pcG1hcHNVcGxvYWQiLCJvbkRyYXdDYWxsIiwic2V0QmxlbmRTdGF0ZSIsIkJsZW5kU3RhdGUiLCJERUZBVUxUIiwicGF0Y2giXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQW9CQTtBQUNBLE1BQU1BLGtCQUFrQixHQUFHLENBQUMsZ0JBQWdCLEVBQUUsV0FBVyxDQUFDLENBQUE7QUFDMUQsTUFBTUMsa0JBQWtCLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxrQkFBa0IsQ0FBQyxDQUFBOztBQUVqRTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLFNBQVMsQ0FBQztBQUNaO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0lDLEVBQUFBLFdBQVdBLENBQUNDLE1BQU0sRUFBRUMsS0FBSyxFQUFFO0FBRXZCQyxJQUFBQSxLQUFLLENBQUNDLE1BQU0sQ0FBQ0YsS0FBSyxDQUFDLENBQUE7SUFDbkIsSUFBSSxDQUFDQSxLQUFLLEdBQUdBLEtBQUssQ0FBQTtBQUVsQkMsSUFBQUEsS0FBSyxDQUFDQyxNQUFNLENBQUNILE1BQU0sQ0FBQyxDQUFBO0lBQ3BCLElBQUksQ0FBQ0EsTUFBTSxHQUFHQSxNQUFNLENBQUE7O0FBRXBCO0lBQ0EsSUFBSSxDQUFDSSxLQUFLLEdBQUcsSUFBSSxDQUFBOztBQUVqQjtBQUNBO0lBQ0EsSUFBSSxJQUFJLENBQUNKLE1BQU0sQ0FBQ0ssTUFBTSxJQUFJLElBQUksQ0FBQ0wsTUFBTSxDQUFDTSxRQUFRLEVBQUU7TUFDNUMsSUFB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
