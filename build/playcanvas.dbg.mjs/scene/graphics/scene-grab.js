/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { DEVICETYPE_WEBGPU, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_RGBA8 } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
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
    if (this.device.webgl2 || this.device.deviceType === DEVICETYPE_WEBGPU) {
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
    if (device.webgl2 || device.deviceType === DEVICETYPE_WEBGPU) {
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
          if (device.deviceType === DEVICETYPE_WEBGPU) {
            device.copyRenderTarget(camera.renderTarget, this.colorRenderTarget, true, false);
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
        device.setColorWrite(true, true, true, true);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtZ3JhYi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2dyYXBoaWNzL3NjZW5lLWdyYWIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHtcbiAgICBERVZJQ0VUWVBFX1dFQkdQVSxcbiAgICBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgRklMVEVSX05FQVJFU1QsIEZJTFRFUl9MSU5FQVIsIEZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUixcbiAgICBQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwsIFBJWEVMRk9STUFUX1JHQkE4XG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5cbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcblxuaW1wb3J0IHtcbiAgICBMQVlFUklEX0RFUFRILCBMQVlFUklEX1dPUkxELFxuICAgIFNIQURFUl9ERVBUSFxufSBmcm9tICcuLi9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4uL2xheWVyLmpzJztcblxuLy8gdW5pZm9ybSBuYW1lcyAoZmlyc3QgaXMgY3VycmVudCBuYW1lLCBzZWNvbmQgb25lIGlzIGRlcHJlY2F0ZWQgbmFtZSBmb3IgY29tcGF0aWJpbGl0eSlcbmNvbnN0IF9kZXB0aFVuaWZvcm1OYW1lcyA9IFsndVNjZW5lRGVwdGhNYXAnLCAndURlcHRoTWFwJ107XG5jb25zdCBfY29sb3JVbmlmb3JtTmFtZXMgPSBbJ3VTY2VuZUNvbG9yTWFwJywgJ3RleHR1cmVfZ3JhYlBhc3MnXTtcblxuLyoqXG4gKiBJbnRlcm5hbCBjbGFzcyBhYnN0cmFjdGluZyB0aGUgYWNjZXNzIHRvIHRoZSBkZXB0aCBhbmQgY29sb3IgdGV4dHVyZSBvZiB0aGUgc2NlbmUuXG4gKiBjb2xvciBmcmFtZSBidWZmZXIgaXMgY29waWVkIHRvIGEgdGV4dHVyZVxuICogRm9yIHdlYmdsIDIgZGV2aWNlcywgdGhlIGRlcHRoIGJ1ZmZlciBpcyBjb3BpZWQgdG8gYSB0ZXh0dXJlXG4gKiBmb3Igd2ViZ2wgMSBkZXZpY2VzLCB0aGUgc2NlbmUncyBkZXB0aCBpcyByZW5kZXJlZCB0byBhIHNlcGFyYXRlIFJHQkEgdGV4dHVyZVxuICpcbiAqIFRPRE86IGltcGxlbWVudCBtaXBtYXBwZWQgY29sb3IgYnVmZmVyIHN1cHBvcnQgZm9yIFdlYkdMIDEgYXMgd2VsbCwgd2hpY2ggcmVxdWlyZXNcbiAqIHRoZSB0ZXh0dXJlIHRvIGJlIGEgcG93ZXIgb2YgdHdvLCBieSBmaXJzdCBkb3duc2NhbGluZyB0aGUgY2FwdHVyZWQgZnJhbWVidWZmZXJcbiAqIHRleHR1cmUgdG8gc21hbGxlciBwb3dlciBvZiAyIHRleHR1cmUsIGFuZCB0aGVuIGdlbmVyYXRlIG1pcG1hcHMgYW5kIHVzZSBpdCBmb3IgcmVuZGVyaW5nXG4gKiBUT0RPOiBvciBldmVuIGJldHRlciwgaW1wbGVtZW50IGJsdXIgZmlsdGVyIHRvIGhhdmUgc21vb3RoZXIgbG93ZXIgbGV2ZWxzXG4gKlxuICogQGlnbm9yZVxuICovXG5jbGFzcyBTY2VuZUdyYWIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhbiBpbnN0YW5jZSBvZiBTY2VuZUdyYWIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZS5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vc2NlbmUuanMnKS5TY2VuZX0gc2NlbmUgLSBUaGUgc2NlbmUuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBzY2VuZSkge1xuXG4gICAgICAgIERlYnVnLmFzc2VydChzY2VuZSk7XG4gICAgICAgIHRoaXMuc2NlbmUgPSBzY2VuZTtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoZGV2aWNlKTtcbiAgICAgICAgdGhpcy5kZXZpY2UgPSBkZXZpY2U7XG5cbiAgICAgICAgLy8gY3JlYXRlIGRlcHRoIGxheWVyXG4gICAgICAgIHRoaXMubGF5ZXIgPSBudWxsO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIGRlcHRoIGxheWVyLCB3aGljaCBpcyBhIGRlZmF1bHQgZGVwdGggbGF5ZXIsIGJ1dCBhbHNvIGEgdGVtcGxhdGUgdXNlZFxuICAgICAgICAvLyB0byBwYXRjaCBhcHBsaWNhdGlvbiBjcmVhdGVkIGRlcHRoIGxheWVycyB0byBiZWhhdmUgYXMgb25lXG4gICAgICAgIGlmICh0aGlzLmRldmljZS53ZWJnbDIgfHwgdGhpcy5kZXZpY2UuZGV2aWNlVHlwZSA9PT0gREVWSUNFVFlQRV9XRUJHUFUpIHtcbiAgICAgICAgICAgIHRoaXMuaW5pdE1haW5QYXRoKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmluaXRGYWxsYmFja1BhdGgoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgY2FtZXJhIHJlbmRlcmluZyBzY2VuZSBncmFiIHRleHR1cmVzIHJlcXVpcmVzIGEgcmVuZGVyIHBhc3MgdG8gZG8gaXQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvZ3JhcGhpY3MtZGV2aWNlLmpzJykuR3JhcGhpY3NEZXZpY2V9IGRldmljZSAtIFRoZVxuICAgICAqIGdyYXBoaWNzIGRldmljZSB1c2VkIGZvciByZW5kZXJpbmcuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIFRoZSBjYW1lcmEgdGhhdFxuICAgICAqIG5lZWRzIHNjZW5lIGdyYWIgdGV4dHVyZXMuXG4gICAgICovXG4gICAgc3RhdGljIHJlcXVpcmVzUmVuZGVyUGFzcyhkZXZpY2UsIGNhbWVyYSkge1xuXG4gICAgICAgIC8vIGp1c3QgY29weSBvdXQgdGhlIHRleHR1cmVzLCBubyByZW5kZXIgcGFzcyBuZWVkZWRcbiAgICAgICAgaWYgKGRldmljZS53ZWJnbDIgfHwgZGV2aWNlLmRldmljZVR5cGUgPT09IERFVklDRVRZUEVfV0VCR1BVKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBvbiBXZWJHTDEgZGV2aWNlLCBvbmx5IGRlcHRoIHJlbmRlcmluZyBuZWVkcyByZW5kZXIgcGFzc1xuICAgICAgICByZXR1cm4gY2FtZXJhLnJlbmRlclNjZW5lRGVwdGhNYXA7XG4gICAgfVxuXG4gICAgc2V0dXBVbmlmb3JtKGRldmljZSwgZGVwdGgsIGJ1ZmZlcikge1xuXG4gICAgICAgIC8vIGFzc2lnbiBpdCB0byBzY29wZXMgdG8gZXhwb3NlIGl0IHRvIHNoYWRlcnNcbiAgICAgICAgY29uc3QgbmFtZXMgPSBkZXB0aCA/IF9kZXB0aFVuaWZvcm1OYW1lcyA6IF9jb2xvclVuaWZvcm1OYW1lcztcbiAgICAgICAgbmFtZXMuZm9yRWFjaChuYW1lID0+IGRldmljZS5zY29wZS5yZXNvbHZlKG5hbWUpLnNldFZhbHVlKGJ1ZmZlcikpO1xuICAgIH1cblxuICAgIGFsbG9jYXRlVGV4dHVyZShkZXZpY2UsIHNvdXJjZSwgbmFtZSwgZm9ybWF0LCBpc0RlcHRoLCBtaXBtYXBzKSB7XG5cbiAgICAgICAgLy8gYWxsb2NhdGUgdGV4dHVyZSB0aGF0IHdpbGwgc3RvcmUgdGhlIGRlcHRoXG4gICAgICAgIHJldHVybiBuZXcgVGV4dHVyZShkZXZpY2UsIHtcbiAgICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgICBmb3JtYXQsXG4gICAgICAgICAgICB3aWR0aDogc291cmNlID8gc291cmNlLmNvbG9yQnVmZmVyLndpZHRoIDogZGV2aWNlLndpZHRoLFxuICAgICAgICAgICAgaGVpZ2h0OiBzb3VyY2UgPyBzb3VyY2UuY29sb3JCdWZmZXIuaGVpZ2h0IDogZGV2aWNlLmhlaWdodCxcbiAgICAgICAgICAgIG1pcG1hcHMsXG4gICAgICAgICAgICBtaW5GaWx0ZXI6IGlzRGVwdGggPyBGSUxURVJfTkVBUkVTVCA6IChtaXBtYXBzID8gRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSIDogRklMVEVSX0xJTkVBUiksXG4gICAgICAgICAgICBtYWdGaWx0ZXI6IGlzRGVwdGggPyBGSUxURVJfTkVBUkVTVCA6IEZJTFRFUl9MSU5FQVIsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyB0ZXh0dXJlIGZvcm1hdCBvZiB0aGUgc291cmNlIHRleHR1cmUgdGhlIGdyYWIgcGFzcyBuZWVkcyB0byBjb3B5XG4gICAgZ2V0U291cmNlQ29sb3JGb3JtYXQodGV4dHVyZSkge1xuICAgICAgICAvLyBiYXNlZCBvbiB0aGUgUlQgdGhlIGNhbWVyYSByZW5kZXJzIHRvLCBvdGhlcndpc2UgZnJhbWVidWZmZXJcbiAgICAgICAgcmV0dXJuIHRleHR1cmU/LmZvcm1hdCA/PyB0aGlzLmRldmljZS5mcmFtZWJ1ZmZlckZvcm1hdDtcbiAgICB9XG5cbiAgICBzaG91bGRSZWFsbG9jYXRlKHRhcmdldFJULCBzb3VyY2VUZXh0dXJlLCB0ZXN0Rm9ybWF0KSB7XG5cbiAgICAgICAgLy8gbmVlZCB0byByZWFsbG9jYXRlIGlmIGZvcm1hdCBkb2VzIG5vdCBtYXRjaFxuICAgICAgICBpZiAodGVzdEZvcm1hdCkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0Rm9ybWF0ID0gdGFyZ2V0UlQ/LmNvbG9yQnVmZmVyLmZvcm1hdDtcbiAgICAgICAgICAgIGNvbnN0IHNvdXJjZUZvcm1hdCA9IHRoaXMuZ2V0U291cmNlQ29sb3JGb3JtYXQoc291cmNlVGV4dHVyZSk7XG4gICAgICAgICAgICBpZiAodGFyZ2V0Rm9ybWF0ICE9PSBzb3VyY2VGb3JtYXQpXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBuZWVkIHRvIHJlYWxsb2NhdGUgaWYgZGltZW5zaW9ucyBkb24ndCBtYXRjaFxuICAgICAgICBjb25zdCB3aWR0aCA9IHNvdXJjZVRleHR1cmU/LndpZHRoIHx8IHRoaXMuZGV2aWNlLndpZHRoO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBzb3VyY2VUZXh0dXJlPy5oZWlnaHQgfHwgdGhpcy5kZXZpY2UuaGVpZ2h0O1xuICAgICAgICByZXR1cm4gIXRhcmdldFJUIHx8IHdpZHRoICE9PSB0YXJnZXRSVC53aWR0aCB8fCBoZWlnaHQgIT09IHRhcmdldFJULmhlaWdodDtcbiAgICB9XG5cbiAgICBhbGxvY2F0ZVJlbmRlclRhcmdldChyZW5kZXJUYXJnZXQsIHNvdXJjZVJlbmRlclRhcmdldCwgZGV2aWNlLCBmb3JtYXQsIGlzRGVwdGgsIG1pcG1hcHMsIGlzRGVwdGhVbmlmb3Jtcykge1xuXG4gICAgICAgIC8vIHRleHR1cmUgLyB1bmlmb3JtIG5hbWVzOiBuZXcgb25lIChmaXJzdCksIGFzIHdlbGwgYXMgb2xkIG9uZSAgKHNlY29uZCkgZm9yIGNvbXBhdGliaWxpdHlcbiAgICAgICAgY29uc3QgbmFtZXMgPSBpc0RlcHRoVW5pZm9ybXMgPyBfZGVwdGhVbmlmb3JtTmFtZXMgOiBfY29sb3JVbmlmb3JtTmFtZXM7XG5cbiAgICAgICAgLy8gYWxsb2NhdGUgdGV4dHVyZSBidWZmZXJcbiAgICAgICAgY29uc3QgYnVmZmVyID0gdGhpcy5hbGxvY2F0ZVRleHR1cmUoZGV2aWNlLCBzb3VyY2VSZW5kZXJUYXJnZXQsIG5hbWVzWzBdLCBmb3JtYXQsIGlzRGVwdGgsIG1pcG1hcHMpO1xuXG4gICAgICAgIGlmIChyZW5kZXJUYXJnZXQpIHtcblxuICAgICAgICAgICAgLy8gaWYgcmVhbGxvY2F0aW5nIFJUIHNpemUsIHJlbGVhc2UgcHJldmlvdXMgZnJhbWVidWZmZXJcbiAgICAgICAgICAgIHJlbmRlclRhcmdldC5kZXN0cm95RnJhbWVCdWZmZXJzKCk7XG5cbiAgICAgICAgICAgIC8vIGFzc2lnbiBuZXcgdGV4dHVyZVxuICAgICAgICAgICAgaWYgKGlzRGVwdGgpIHtcbiAgICAgICAgICAgICAgICByZW5kZXJUYXJnZXQuX2RlcHRoQnVmZmVyID0gYnVmZmVyO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZW5kZXJUYXJnZXQuX2NvbG9yQnVmZmVyID0gYnVmZmVyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBjcmVhdGUgbmV3IHJlbmRlciB0YXJnZXQgd2l0aCB0aGUgdGV4dHVyZVxuICAgICAgICAgICAgcmVuZGVyVGFyZ2V0ID0gbmV3IFJlbmRlclRhcmdldCh7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3JlbmRlclRhcmdldFNjZW5lR3JhYicsXG4gICAgICAgICAgICAgICAgY29sb3JCdWZmZXI6IGlzRGVwdGggPyBudWxsIDogYnVmZmVyLFxuICAgICAgICAgICAgICAgIGRlcHRoQnVmZmVyOiBpc0RlcHRoID8gYnVmZmVyIDogbnVsbCxcbiAgICAgICAgICAgICAgICBkZXB0aDogIWlzRGVwdGgsXG4gICAgICAgICAgICAgICAgc3RlbmNpbDogZGV2aWNlLnN1cHBvcnRzU3RlbmNpbCxcbiAgICAgICAgICAgICAgICBhdXRvUmVzb2x2ZTogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlbmRlclRhcmdldDtcbiAgICB9XG5cbiAgICByZWxlYXNlUmVuZGVyVGFyZ2V0KHJ0KSB7XG5cbiAgICAgICAgaWYgKHJ0KSB7XG4gICAgICAgICAgICBydC5kZXN0cm95VGV4dHVyZUJ1ZmZlcnMoKTtcbiAgICAgICAgICAgIHJ0LmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIG1haW4gcGF0aCB3aGVyZSBib3RoIGNvbG9yIGFuZCBkZXB0aCBpcyBjb3BpZWQgZnJvbSBleGlzdGluZyBzdXJmYWNlXG4gICAgaW5pdE1haW5QYXRoKCkge1xuXG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgICAvLyBXZWJHTCAyIGRlcHRoIGxheWVyIGp1c3QgY29waWVzIGV4aXN0aW5nIGNvbG9yIG9yIGRlcHRoXG4gICAgICAgIHRoaXMubGF5ZXIgPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgICAgICBuYW1lOiBcIkRlcHRoXCIsXG4gICAgICAgICAgICBpZDogTEFZRVJJRF9ERVBUSCxcblxuICAgICAgICAgICAgb25EaXNhYmxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2VsZi5yZWxlYXNlUmVuZGVyVGFyZ2V0KHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgc2VsZi5yZWxlYXNlUmVuZGVyVGFyZ2V0KHRoaXMuY29sb3JSZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgICAgIHRoaXMuY29sb3JSZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25QcmVSZW5kZXJPcGFxdWU6IGZ1bmN0aW9uIChjYW1lcmFQYXNzKSB7IC8vIHJlc2l6ZSBkZXB0aCBtYXAgaWYgbmVlZGVkXG5cbiAgICAgICAgICAgICAgICAvKiogQHR5cGUge2ltcG9ydCgnLi4vLi4vZnJhbWV3b3JrL2NvbXBvbmVudHMvY2FtZXJhL2NvbXBvbmVudC5qcycpLkNhbWVyYUNvbXBvbmVudH0gKi9cbiAgICAgICAgICAgICAgICBjb25zdCBjYW1lcmEgPSB0aGlzLmNhbWVyYXNbY2FtZXJhUGFzc107XG5cbiAgICAgICAgICAgICAgICBpZiAoY2FtZXJhLnJlbmRlclNjZW5lQ29sb3JNYXApIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBhbGxvY2F0ZSAvIHJlc2l6ZSBleGlzdGluZyBSVCBhcyBuZWVkZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuc2hvdWxkUmVhbGxvY2F0ZSh0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0LCBjYW1lcmEucmVuZGVyVGFyZ2V0Py5jb2xvckJ1ZmZlciwgdHJ1ZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucmVsZWFzZVJlbmRlclRhcmdldCh0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IHNlbGYuZ2V0U291cmNlQ29sb3JGb3JtYXQoY2FtZXJhLnJlbmRlclRhcmdldD8uY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb2xvclJlbmRlclRhcmdldCA9IHNlbGYuYWxsb2NhdGVSZW5kZXJUYXJnZXQodGhpcy5jb2xvclJlbmRlclRhcmdldCwgY2FtZXJhLnJlbmRlclRhcmdldCwgZGV2aWNlLCBmb3JtYXQsIGZhbHNlLCB0cnVlLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBjb3B5IGNvbG9yIGZyb20gdGhlIGN1cnJlbnQgcmVuZGVyIHRhcmdldFxuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnR1JBQi1DT0xPUicpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gdGhpcy5jb2xvclJlbmRlclRhcmdldC5jb2xvckJ1ZmZlcjtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoZGV2aWNlLmRldmljZVR5cGUgPT09IERFVklDRVRZUEVfV0VCR1BVKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5jb3B5UmVuZGVyVGFyZ2V0KGNhbWVyYS5yZW5kZXJUYXJnZXQsIHRoaXMuY29sb3JSZW5kZXJUYXJnZXQsIHRydWUsIGZhbHNlKTtcblxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2UuY29weVJlbmRlclRhcmdldChkZXZpY2UucmVuZGVyVGFyZ2V0LCB0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0LCB0cnVlLCBmYWxzZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGdlbmVyYXRlIG1pcG1hcHNcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldmljZS5hY3RpdmVUZXh0dXJlKGRldmljZS5tYXhDb21iaW5lZFRleHR1cmVzIC0gMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkZXZpY2UuYmluZFRleHR1cmUoY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlLmdsLmdlbmVyYXRlTWlwbWFwKGNvbG9yQnVmZmVyLmltcGwuX2dsVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXNzaWduIHVuaWZyb21cbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXR1cFVuaWZvcm0oZGV2aWNlLCBmYWxzZSwgY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlYWxsb2NhdGUgUlQgaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZWxmLnNob3VsZFJlYWxsb2NhdGUodGhpcy5kZXB0aFJlbmRlclRhcmdldCwgY2FtZXJhLnJlbmRlclRhcmdldD8uZGVwdGhCdWZmZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxmLnJlbGVhc2VSZW5kZXJUYXJnZXQodGhpcy5kZXB0aFJlbmRlclRhcmdldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0ID0gc2VsZi5hbGxvY2F0ZVJlbmRlclRhcmdldCh0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0LCBjYW1lcmEucmVuZGVyVGFyZ2V0LCBkZXZpY2UsIFBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCwgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29weSBkZXB0aFxuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnR1JBQi1ERVBUSCcpO1xuICAgICAgICAgICAgICAgICAgICBkZXZpY2UuY29weVJlbmRlclRhcmdldChkZXZpY2UucmVuZGVyVGFyZ2V0LCB0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0LCBmYWxzZSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXNzaWduIHVuaWZyb21cbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXR1cFVuaWZvcm0oZGV2aWNlLCB0cnVlLCB0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0LmRlcHRoQnVmZmVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvblBvc3RSZW5kZXJPcGFxdWU6IGZ1bmN0aW9uIChjYW1lcmFQYXNzKSB7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIGZhbGxiYWNrIHBhdGgsIHdoZXJlIGNvcHkgaXMgbm90IHBvc3NpYmxlIGFuZCB0aGUgc2NlbmUgZ2V0cyByZS1yZW5kZXJlZFxuICAgIGluaXRGYWxsYmFja1BhdGgoKSB7XG5cbiAgICAgICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgICAgIGNvbnN0IGRldmljZSA9IHRoaXMuZGV2aWNlO1xuICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc2NlbmU7XG5cbiAgICAgICAgLy8gV2ViR0wgMSBkZXB0aCBsYXllciByZW5kZXJzIHRoZSBzYW1lIG9iamVjdHMgYXMgaW4gV29ybGQsIGJ1dCB3aXRoIFJHQkEtZW5jb2RlZCBkZXB0aCBzaGFkZXIgdG8gZ2V0IGRlcHRoXG4gICAgICAgIHRoaXMubGF5ZXIgPSBuZXcgTGF5ZXIoe1xuICAgICAgICAgICAgZW5hYmxlZDogZmFsc2UsXG4gICAgICAgICAgICBuYW1lOiBcIkRlcHRoXCIsXG4gICAgICAgICAgICBpZDogTEFZRVJJRF9ERVBUSCxcbiAgICAgICAgICAgIHNoYWRlclBhc3M6IFNIQURFUl9ERVBUSCxcblxuICAgICAgICAgICAgb25FbmFibGU6IGZ1bmN0aW9uICgpIHtcblxuICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBSVCB3aXRob3V0IHRleHR1cmVzLCB0aG9zZSB3aWxsIGJlIGNyZWF0ZWQgYXMgbmVlZGVkIGxhdGVyXG4gICAgICAgICAgICAgICAgdGhpcy5kZXB0aFJlbmRlclRhcmdldCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnZGVwdGhSZW5kZXJUYXJnZXQtd2ViZ2wxJyxcbiAgICAgICAgICAgICAgICAgICAgZGVwdGg6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHN0ZW5jaWw6IGRldmljZS5zdXBwb3J0c1N0ZW5jaWwsXG4gICAgICAgICAgICAgICAgICAgIGF1dG9SZXNvbHZlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZ3JhcGhpY3NEZXZpY2U6IGRldmljZVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gYXNzaWduIGl0IHNvIHRoZSByZW5kZXIgYWN0aW9ucyBrbm93cyB0byByZW5kZXIgdG8gaXRcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBhdm9pZCB0aGlzIGFzIHRoaXMgQVBJIGlzIGRlcHJlY2F0ZWRcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclRhcmdldCA9IHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICB9LFxuXG4gICAgICAgICAgICBvbkRpc2FibGU6IGZ1bmN0aW9uICgpIHtcblxuICAgICAgICAgICAgICAgIC8vIG9ubHkgcmVsZWFzZSBkZXB0aCB0ZXh0dXJlLCBidXQgbm90IHRoZSByZW5kZXIgdGFyZ2V0IGl0c2VsZlxuICAgICAgICAgICAgICAgIHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQuZGVzdHJveVRleHR1cmVCdWZmZXJzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgc2VsZi5yZWxlYXNlUmVuZGVyVGFyZ2V0KHRoaXMuY29sb3JSZW5kZXJUYXJnZXQpO1xuICAgICAgICAgICAgICAgIHRoaXMuY29sb3JSZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAgb25Qb3N0Q3VsbDogZnVuY3Rpb24gKGNhbWVyYVBhc3MpIHtcblxuICAgICAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSAqL1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHRoaXMuY2FtZXJhc1tjYW1lcmFQYXNzXTtcblxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlYWxsb2NhdGUgUlQgaWYgbmVlZGVkXG4gICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5kZXB0aFJlbmRlclRhcmdldC5kZXB0aEJ1ZmZlciB8fCBzZWxmLnNob3VsZFJlYWxsb2NhdGUodGhpcy5kZXB0aFJlbmRlclRhcmdldCwgY2FtZXJhLnJlbmRlclRhcmdldD8uZGVwdGhCdWZmZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRlcHRoUmVuZGVyVGFyZ2V0LmRlc3Ryb3lUZXh0dXJlQnVmZmVycygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZXB0aFJlbmRlclRhcmdldCA9IHNlbGYuYWxsb2NhdGVSZW5kZXJUYXJnZXQodGhpcy5kZXB0aFJlbmRlclRhcmdldCwgY2FtZXJhLnJlbmRlclRhcmdldCwgZGV2aWNlLCBQSVhFTEZPUk1BVF9SR0JBOCwgZmFsc2UsIGZhbHNlLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIENvbGxlY3QgYWxsIHJlbmRlcmVkIG1lc2ggaW5zdGFuY2VzIHdpdGggdGhlIHNhbWUgcmVuZGVyIHRhcmdldCBhcyBXb3JsZCBoYXMsIGRlcHRoV3JpdGUgPT0gdHJ1ZSBhbmQgcHJpb3IgdG8gdGhpcyBsYXllciB0byByZXBsaWNhdGUgYmxpdEZyYW1lYnVmZmVyIG9uIFdlYkdMMlxuICAgICAgICAgICAgICAgICAgICBjb25zdCB2aXNpYmxlT2JqZWN0cyA9IHRoaXMuaW5zdGFuY2VzLnZpc2libGVPcGFxdWVbY2FtZXJhUGFzc107XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZpc2libGVMaXN0ID0gdmlzaWJsZU9iamVjdHMubGlzdDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXJDb21wb3NpdGlvbiA9IHNjZW5lLmxheWVycztcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViTGF5ZXJFbmFibGVkID0gbGF5ZXJDb21wb3NpdGlvbi5zdWJMYXllckVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzVHJhbnNwYXJlbnQgPSBsYXllckNvbXBvc2l0aW9uLnN1YkxheWVyTGlzdDtcblxuICAgICAgICAgICAgICAgICAgICAvLyBjYW4ndCB1c2Ugc2VsZi5kZWZhdWx0TGF5ZXJXb3JsZC5yZW5kZXJUYXJnZXQgYmVjYXVzZSBwcm9qZWN0cyB0aGF0IHVzZSB0aGUgZWRpdG9yIG92ZXJyaWRlIGRlZmF1bHQgbGF5ZXJzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJ0ID0gbGF5ZXJDb21wb3NpdGlvbi5nZXRMYXllckJ5SWQoTEFZRVJJRF9XT1JMRCkucmVuZGVyVGFyZ2V0O1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCB2aXNpYmxlTGVuZ3RoID0gMDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gbGF5ZXJDb21wb3NpdGlvbi5sYXllckxpc3Q7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXllciA9PT0gdGhpcykgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIucmVuZGVyVGFyZ2V0ICE9PSBydCB8fCAhbGF5ZXIuZW5hYmxlZCB8fCAhc3ViTGF5ZXJFbmFibGVkW2ldKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXJDYW1JZCA9IGxheWVyLmNhbWVyYXMuaW5kZXhPZihjYW1lcmEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyQ2FtSWQgPCAwKSBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdHJhbnNwYXJlbnQgPSBpc1RyYW5zcGFyZW50W2ldO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGxheWVyVmlzaWJsZUxpc3QgPSB0cmFuc3BhcmVudCA/IGxheWVyLmluc3RhbmNlcy52aXNpYmxlVHJhbnNwYXJlbnRbbGF5ZXJDYW1JZF0gOiBsYXllci5pbnN0YW5jZXMudmlzaWJsZU9wYXF1ZVtsYXllckNhbUlkXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyVmlzaWJsZUxpc3RMZW5ndGggPSBsYXllclZpc2libGVMaXN0Lmxlbmd0aDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyVmlzaWJsZUxpc3QgPSBsYXllclZpc2libGVMaXN0Lmxpc3Q7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGF5ZXJWaXNpYmxlTGlzdExlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZHJhd0NhbGwgPSBsYXllclZpc2libGVMaXN0W2pdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkcmF3Q2FsbC5tYXRlcmlhbCAmJiBkcmF3Q2FsbC5tYXRlcmlhbC5kZXB0aFdyaXRlICYmICFkcmF3Q2FsbC5fbm9EZXB0aERyYXdHbDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZUxpc3RbdmlzaWJsZUxlbmd0aF0gPSBkcmF3Q2FsbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmlzaWJsZUxlbmd0aCsrO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlT2JqZWN0cy5sZW5ndGggPSB2aXNpYmxlTGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uUHJlUmVuZGVyT3BhcXVlOiBmdW5jdGlvbiAoY2FtZXJhUGFzcykge1xuXG4gICAgICAgICAgICAgICAgLyoqIEB0eXBlIHtpbXBvcnQoJy4uLy4uL2ZyYW1ld29yay9jb21wb25lbnRzL2NhbWVyYS9jb21wb25lbnQuanMnKS5DYW1lcmFDb21wb25lbnR9ICovXG4gICAgICAgICAgICAgICAgY29uc3QgY2FtZXJhID0gdGhpcy5jYW1lcmFzW2NhbWVyYVBhc3NdO1xuXG4gICAgICAgICAgICAgICAgaWYgKGNhbWVyYS5yZW5kZXJTY2VuZUNvbG9yTWFwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gcmVhbGxvY2F0ZSBSVCBpZiBuZWVkZWRcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlbGYuc2hvdWxkUmVhbGxvY2F0ZSh0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0LCBjYW1lcmEucmVuZGVyVGFyZ2V0Py5jb2xvckJ1ZmZlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYucmVsZWFzZVJlbmRlclRhcmdldCh0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZvcm1hdCA9IHNlbGYuZ2V0U291cmNlQ29sb3JGb3JtYXQoY2FtZXJhLnJlbmRlclRhcmdldD8uY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jb2xvclJlbmRlclRhcmdldCA9IHNlbGYuYWxsb2NhdGVSZW5kZXJUYXJnZXQodGhpcy5jb2xvclJlbmRlclRhcmdldCwgY2FtZXJhLnJlbmRlclRhcmdldCwgZGV2aWNlLCBmb3JtYXQsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gY29weSBvdXQgdGhlIGNvbG9yIGJ1ZmZlclxuICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnR1JBQi1DT0xPUicpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGluaXRpYWxpemUgdGhlIHRleHR1cmVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSB0aGlzLmNvbG9yUmVuZGVyVGFyZ2V0Ll9jb2xvckJ1ZmZlcjtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjb2xvckJ1ZmZlci5pbXBsLl9nbFRleHR1cmUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyLmltcGwuaW5pdGlhbGl6ZShkZXZpY2UsIGNvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvcHkgZnJhbWVidWZmZXIgdG8gaXRcbiAgICAgICAgICAgICAgICAgICAgZGV2aWNlLmJpbmRUZXh0dXJlKGNvbG9yQnVmZmVyKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZ2wgPSBkZXZpY2UuZ2w7XG4gICAgICAgICAgICAgICAgICAgIGdsLmNvcHlUZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGNvbG9yQnVmZmVyLmltcGwuX2dsRm9ybWF0LCAwLCAwLCBjb2xvckJ1ZmZlci53aWR0aCwgY29sb3JCdWZmZXIuaGVpZ2h0LCAwKTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBzdG9wIHRoZSBkZXZpY2UgZnJvbSB1cGRhdGluZyB0aGlzIHRleHR1cmUgZnVydGhlclxuICAgICAgICAgICAgICAgICAgICBjb2xvckJ1ZmZlci5fbmVlZHNVcGxvYWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgY29sb3JCdWZmZXIuX25lZWRzTWlwbWFwc1VwbG9hZCA9IGZhbHNlO1xuXG4gICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKGRldmljZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gYXNzaWduIHVuaWZyb21cbiAgICAgICAgICAgICAgICAgICAgc2VsZi5zZXR1cFVuaWZvcm0oZGV2aWNlLCBmYWxzZSwgY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBhc3NpZ24gdW5pZnJvbVxuICAgICAgICAgICAgICAgICAgICBzZWxmLnNldHVwVW5pZm9ybShkZXZpY2UsIHRydWUsIHRoaXMuZGVwdGhSZW5kZXJUYXJnZXQuY29sb3JCdWZmZXIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uRHJhd0NhbGw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBkZXZpY2Uuc2V0Q29sb3JXcml0ZSh0cnVlLCB0cnVlLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIH0sXG5cbiAgICAgICAgICAgIG9uUG9zdFJlbmRlck9wYXF1ZTogZnVuY3Rpb24gKGNhbWVyYVBhc3MpIHtcblxuICAgICAgICAgICAgICAgIC8qKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSAqL1xuICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYSA9IHRoaXMuY2FtZXJhc1tjYW1lcmFQYXNzXTtcblxuICAgICAgICAgICAgICAgIGlmIChjYW1lcmEucmVuZGVyU2NlbmVEZXB0aE1hcCkge1xuICAgICAgICAgICAgICAgICAgICAvLyBqdXN0IGNsZWFyIHRoZSBsaXN0IG9mIHZpc2libGUgb2JqZWN0cyB0byBhdm9pZCBrZWVwaW5nIHJlZmVyZW5jZXNcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmlzaWJsZU9iamVjdHMgPSB0aGlzLmluc3RhbmNlcy52aXNpYmxlT3BhcXVlW2NhbWVyYVBhc3NdO1xuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlT2JqZWN0cy5sZW5ndGggPSAwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gZnVuY3Rpb24gd2hpY2ggcGF0Y2hlcyBhIGxheWVyIHRvIHVzZSBkZXB0aCBsYXllciBzZXQgdXAgaW4gdGhpcyBjbGFzc1xuICAgIHBhdGNoKGxheWVyKSB7XG5cbiAgICAgICAgbGF5ZXIub25FbmFibGUgPSB0aGlzLmxheWVyLm9uRW5hYmxlO1xuICAgICAgICBsYXllci5vbkRpc2FibGUgPSB0aGlzLmxheWVyLm9uRGlzYWJsZTtcbiAgICAgICAgbGF5ZXIub25QcmVSZW5kZXJPcGFxdWUgPSB0aGlzLmxheWVyLm9uUHJlUmVuZGVyT3BhcXVlO1xuICAgICAgICBsYXllci5vblBvc3RSZW5kZXJPcGFxdWUgPSB0aGlzLmxheWVyLm9uUG9zdFJlbmRlck9wYXF1ZTtcbiAgICAgICAgbGF5ZXIuc2hhZGVyUGFzcyA9IHRoaXMubGF5ZXIuc2hhZGVyUGFzcztcbiAgICAgICAgbGF5ZXIub25Qb3N0Q3VsbCA9IHRoaXMubGF5ZXIub25Qb3N0Q3VsbDtcbiAgICAgICAgbGF5ZXIub25EcmF3Q2FsbCA9IHRoaXMubGF5ZXIub25EcmF3Q2FsbDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFNjZW5lR3JhYiB9O1xuIl0sIm5hbWVzIjpbIl9kZXB0aFVuaWZvcm1OYW1lcyIsIl9jb2xvclVuaWZvcm1OYW1lcyIsIlNjZW5lR3JhYiIsImNvbnN0cnVjdG9yIiwiZGV2aWNlIiwic2NlbmUiLCJEZWJ1ZyIsImFzc2VydCIsImxheWVyIiwid2ViZ2wyIiwiZGV2aWNlVHlwZSIsIkRFVklDRVRZUEVfV0VCR1BVIiwiaW5pdE1haW5QYXRoIiwiaW5pdEZhbGxiYWNrUGF0aCIsInJlcXVpcmVzUmVuZGVyUGFzcyIsImNhbWVyYSIsInJlbmRlclNjZW5lRGVwdGhNYXAiLCJzZXR1cFVuaWZvcm0iLCJkZXB0aCIsImJ1ZmZlciIsIm5hbWVzIiwiZm9yRWFjaCIsIm5hbWUiLCJzY29wZSIsInJlc29sdmUiLCJzZXRWYWx1ZSIsImFsbG9jYXRlVGV4dHVyZSIsInNvdXJjZSIsImZvcm1hdCIsImlzRGVwdGgiLCJtaXBtYXBzIiwiVGV4dHVyZSIsIndpZHRoIiwiY29sb3JCdWZmZXIiLCJoZWlnaHQiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsIkZJTFRFUl9MSU5FQVIiLCJtYWdGaWx0ZXIiLCJhZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsImFkZHJlc3NWIiwiZ2V0U291cmNlQ29sb3JGb3JtYXQiLCJ0ZXh0dXJlIiwiZnJhbWVidWZmZXJGb3JtYXQiLCJzaG91bGRSZWFsbG9jYXRlIiwidGFyZ2V0UlQiLCJzb3VyY2VUZXh0dXJlIiwidGVzdEZvcm1hdCIsInRhcmdldEZvcm1hdCIsInNvdXJjZUZvcm1hdCIsImFsbG9jYXRlUmVuZGVyVGFyZ2V0IiwicmVuZGVyVGFyZ2V0Iiwic291cmNlUmVuZGVyVGFyZ2V0IiwiaXNEZXB0aFVuaWZvcm1zIiwiZGVzdHJveUZyYW1lQnVmZmVycyIsIl9kZXB0aEJ1ZmZlciIsIl9jb2xvckJ1ZmZlciIsIlJlbmRlclRhcmdldCIsImRlcHRoQnVmZmVyIiwic3RlbmNpbCIsInN1cHBvcnRzU3RlbmNpbCIsImF1dG9SZXNvbHZlIiwicmVsZWFzZVJlbmRlclRhcmdldCIsInJ0IiwiZGVzdHJveVRleHR1cmVCdWZmZXJzIiwiZGVzdHJveSIsInNlbGYiLCJMYXllciIsImVuYWJsZWQiLCJpZCIsIkxBWUVSSURfREVQVEgiLCJvbkRpc2FibGUiLCJkZXB0aFJlbmRlclRhcmdldCIsImNvbG9yUmVuZGVyVGFyZ2V0Iiwib25QcmVSZW5kZXJPcGFxdWUiLCJjYW1lcmFQYXNzIiwiY2FtZXJhcyIsInJlbmRlclNjZW5lQ29sb3JNYXAiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsImNvcHlSZW5kZXJUYXJnZXQiLCJhY3RpdmVUZXh0dXJlIiwibWF4Q29tYmluZWRUZXh0dXJlcyIsImJpbmRUZXh0dXJlIiwiZ2wiLCJnZW5lcmF0ZU1pcG1hcCIsImltcGwiLCJfZ2xUYXJnZXQiLCJwb3BHcHVNYXJrZXIiLCJQSVhFTEZPUk1BVF9ERVBUSFNURU5DSUwiLCJvblBvc3RSZW5kZXJPcGFxdWUiLCJzaGFkZXJQYXNzIiwiU0hBREVSX0RFUFRIIiwib25FbmFibGUiLCJncmFwaGljc0RldmljZSIsIm9uUG9zdEN1bGwiLCJQSVhFTEZPUk1BVF9SR0JBOCIsInZpc2libGVPYmplY3RzIiwiaW5zdGFuY2VzIiwidmlzaWJsZU9wYXF1ZSIsInZpc2libGVMaXN0IiwibGlzdCIsImxheWVyQ29tcG9zaXRpb24iLCJsYXllcnMiLCJzdWJMYXllckVuYWJsZWQiLCJpc1RyYW5zcGFyZW50Iiwic3ViTGF5ZXJMaXN0IiwiZ2V0TGF5ZXJCeUlkIiwiTEFZRVJJRF9XT1JMRCIsInZpc2libGVMZW5ndGgiLCJsYXllckxpc3QiLCJpIiwibGVuZ3RoIiwibGF5ZXJDYW1JZCIsImluZGV4T2YiLCJ0cmFuc3BhcmVudCIsImxheWVyVmlzaWJsZUxpc3QiLCJ2aXNpYmxlVHJhbnNwYXJlbnQiLCJsYXllclZpc2libGVMaXN0TGVuZ3RoIiwiaiIsImRyYXdDYWxsIiwibWF0ZXJpYWwiLCJkZXB0aFdyaXRlIiwiX25vRGVwdGhEcmF3R2wxIiwiX2dsVGV4dHVyZSIsImluaXRpYWxpemUiLCJjb3B5VGV4SW1hZ2UyRCIsIlRFWFRVUkVfMkQiLCJfZ2xGb3JtYXQiLCJfbmVlZHNVcGxvYWQiLCJfbmVlZHNNaXBtYXBzVXBsb2FkIiwib25EcmF3Q2FsbCIsInNldENvbG9yV3JpdGUiLCJwYXRjaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztBQW9CQTtBQUNBLE1BQU1BLGtCQUFrQixHQUFHLENBQUMsZ0JBQWdCLEVBQUUsV0FBVyxDQUFDLENBQUE7QUFDMUQsTUFBTUMsa0JBQWtCLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRSxrQkFB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
