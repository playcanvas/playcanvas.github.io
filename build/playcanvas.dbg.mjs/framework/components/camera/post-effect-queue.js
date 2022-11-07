/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_R8_G8_B8_A8 } from '../../../platform/graphics/constants.js';
import { DebugGraphics } from '../../../platform/graphics/debug-graphics.js';
import { RenderTarget } from '../../../platform/graphics/render-target.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { LAYERID_DEPTH } from '../../../scene/constants.js';

class PostEffect {
  constructor(effect, inputTarget) {
    this.effect = effect;
    this.inputTarget = inputTarget;
    this.outputTarget = null;
    this.name = effect.constructor.name;
  }
}

class PostEffectQueue {
  constructor(app, camera) {
    this.app = app;
    this.camera = camera;

    this.destinationRenderTarget = null;

    this.effects = [];

    this.enabled = false;

    this.depthTarget = null;
    camera.on('set:rect', this.onCameraRectChanged, this);
  }

  _allocateColorBuffer(format, name) {
    const rect = this.camera.rect;
    const width = Math.floor(rect.z * this.app.graphicsDevice.width);
    const height = Math.floor(rect.w * this.app.graphicsDevice.height);
    const colorBuffer = new Texture(this.app.graphicsDevice, {
      name: name,
      format: format,
      width: width,
      height: height,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    return colorBuffer;
  }

  _createOffscreenTarget(useDepth, hdr) {
    const device = this.app.graphicsDevice;
    const format = hdr ? device.getHdrFormat() : PIXELFORMAT_R8_G8_B8_A8;
    const name = this.camera.entity.name + '-posteffect-' + this.effects.length;
    const colorBuffer = this._allocateColorBuffer(format, name);
    return new RenderTarget({
      colorBuffer: colorBuffer,
      depth: useDepth,
      stencil: useDepth && this.app.graphicsDevice.supportsStencil,
      samples: useDepth ? device.samples : 1
    });
  }
  _resizeOffscreenTarget(rt) {
    const format = rt.colorBuffer.format;
    const name = rt.colorBuffer.name;
    rt.destroyFrameBuffers();
    rt.destroyTextureBuffers();
    rt._colorBuffer = this._allocateColorBuffer(format, name);
  }
  _destroyOffscreenTarget(rt) {
    rt.destroyTextureBuffers();
    rt.destroy();
  }

  addEffect(effect) {
    const effects = this.effects;
    const isFirstEffect = effects.length === 0;
    const inputTarget = this._createOffscreenTarget(isFirstEffect, effect.hdr);
    const newEntry = new PostEffect(effect, inputTarget);
    effects.push(newEntry);
    this._sourceTarget = newEntry.inputTarget;

    if (effects.length > 1) {
      effects[effects.length - 2].outputTarget = newEntry.inputTarget;
    }

    this._newPostEffect = effect;
    if (effect.needsDepthBuffer) {
      this._requestDepthMap();
    }
    this.enable();
    this._newPostEffect = undefined;
  }

  removeEffect(effect) {
    let index = -1;
    for (let i = 0, len = this.effects.length; i < len; i++) {
      if (this.effects[i].effect === effect) {
        index = i;
        break;
      }
    }
    if (index >= 0) {
      if (index > 0) {
        this.effects[index - 1].outputTarget = index + 1 < this.effects.length ? this.effects[index + 1].inputTarget : null;
      } else {
        if (this.effects.length > 1) {
          if (!this.effects[1].inputTarget._depth) {
            this._destroyOffscreenTarget(this.effects[1].inputTarget);
            this.effects[1].inputTarget = this._createOffscreenTarget(true, this.effects[1].hdr);
            this._sourceTarget = this.effects[1].inputTarget;
          }
          this.camera.renderTarget = this.effects[1].inputTarget;
        }
      }

      this._destroyOffscreenTarget(this.effects[index].inputTarget);
      this.effects.splice(index, 1);
    }
    if (this.enabled) {
      if (effect.needsDepthBuffer) {
        this._releaseDepthMap();
      }
    }
    if (this.effects.length === 0) {
      this.disable();
    }
  }
  _requestDepthMaps() {
    for (let i = 0, len = this.effects.length; i < len; i++) {
      const effect = this.effects[i].effect;
      if (this._newPostEffect === effect) continue;
      if (effect.needsDepthBuffer) {
        this._requestDepthMap();
      }
    }
  }
  _releaseDepthMaps() {
    for (let i = 0, len = this.effects.length; i < len; i++) {
      const effect = this.effects[i].effect;
      if (effect.needsDepthBuffer) {
        this._releaseDepthMap();
      }
    }
  }
  _requestDepthMap() {
    const depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
    if (depthLayer) {
      depthLayer.incrementCounter();
      this.camera.requestSceneDepthMap(true);
    }
  }
  _releaseDepthMap() {
    const depthLayer = this.app.scene.layers.getLayerById(LAYERID_DEPTH);
    if (depthLayer) {
      depthLayer.decrementCounter();
      this.camera.requestSceneDepthMap(false);
    }
  }

  destroy() {
    for (let i = 0, len = this.effects.length; i < len; i++) {
      this.effects[i].inputTarget.destroy();
    }
    this.effects.length = 0;
    this.disable();
  }

  enable() {
    if (!this.enabled && this.effects.length) {
      this.enabled = true;
      this._requestDepthMaps();
      this.app.graphicsDevice.on('resizecanvas', this._onCanvasResized, this);

      this.destinationRenderTarget = this.camera.renderTarget;

      this.camera.renderTarget = this.effects[0].inputTarget;

      this.camera.onPostprocessing = () => {
        if (this.enabled) {
          let rect = null;
          const len = this.effects.length;
          if (len) {
            for (let i = 0; i < len; i++) {
              const fx = this.effects[i];
              let destTarget = fx.outputTarget;

              if (i === len - 1) {
                rect = this.camera.rect;

                if (this.destinationRenderTarget) {
                  destTarget = this.destinationRenderTarget;
                }
              }
              DebugGraphics.pushGpuMarker(this.app.graphicsDevice, fx.name);
              fx.effect.render(fx.inputTarget, destTarget, rect);
              DebugGraphics.popGpuMarker(this.app.graphicsDevice);
            }
          }
        }
      };
    }
  }

  disable() {
    if (this.enabled) {
      this.enabled = false;
      this.app.graphicsDevice.off('resizecanvas', this._onCanvasResized, this);
      this._releaseDepthMaps();
      this._destroyOffscreenTarget(this._sourceTarget);
      this.camera.renderTarget = null;
      this.camera.onPostprocessing = null;
    }
  }

  _onCanvasResized(width, height) {
    const rect = this.camera.rect;
    const device = this.app.graphicsDevice;
    this.camera.camera.aspectRatio = device.width * rect.z / (device.height * rect.w);
    this.resizeRenderTargets();
  }
  resizeRenderTargets() {
    const rect = this.camera.rect;
    const desiredWidth = Math.floor(rect.z * this.app.graphicsDevice.width);
    const desiredHeight = Math.floor(rect.w * this.app.graphicsDevice.height);
    const effects = this.effects;
    for (let i = 0, len = effects.length; i < len; i++) {
      const fx = effects[i];
      if (fx.inputTarget.width !== desiredWidth || fx.inputTarget.height !== desiredHeight) {
        this._resizeOffscreenTarget(fx.inputTarget);
      }
    }
  }
  onCameraRectChanged(name, oldValue, newValue) {
    if (this.enabled) {
      this.resizeRenderTargets();
    }
  }
}

export { PostEffectQueue };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdC1lZmZlY3QtcXVldWUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvcG9zdC1lZmZlY3QtcXVldWUuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQUREUkVTU19DTEFNUF9UT19FREdFLCBGSUxURVJfTkVBUkVTVCwgUElYRUxGT1JNQVRfUjhfRzhfQjhfQTggfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ncmFwaGljcy9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgRGVidWdHcmFwaGljcyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2RlYnVnLWdyYXBoaWNzLmpzJztcbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuaW1wb3J0IHsgVGV4dHVyZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3RleHR1cmUuanMnO1xuXG5pbXBvcnQgeyBMQVlFUklEX0RFUFRIIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gQXBwQmFzZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBDYW1lcmFDb21wb25lbnQgKi9cblxuY2xhc3MgUG9zdEVmZmVjdCB7XG4gICAgY29uc3RydWN0b3IoZWZmZWN0LCBpbnB1dFRhcmdldCkge1xuICAgICAgICB0aGlzLmVmZmVjdCA9IGVmZmVjdDtcbiAgICAgICAgdGhpcy5pbnB1dFRhcmdldCA9IGlucHV0VGFyZ2V0O1xuICAgICAgICB0aGlzLm91dHB1dFRhcmdldCA9IG51bGw7XG4gICAgICAgIHRoaXMubmFtZSA9IGVmZmVjdC5jb25zdHJ1Y3Rvci5uYW1lO1xuICAgIH1cbn1cblxuLyoqXG4gKiBVc2VkIHRvIG1hbmFnZSBtdWx0aXBsZSBwb3N0IGVmZmVjdHMgZm9yIGEgY2FtZXJhLlxuICovXG5jbGFzcyBQb3N0RWZmZWN0UXVldWUge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBQb3N0RWZmZWN0UXVldWUgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FwcEJhc2V9IGFwcCAtIFRoZSBhcHBsaWNhdGlvbi5cbiAgICAgKiBAcGFyYW0ge0NhbWVyYUNvbXBvbmVudH0gY2FtZXJhIC0gVGhlIGNhbWVyYSBjb21wb25lbnQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwLCBjYW1lcmEpIHtcbiAgICAgICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgICAgIHRoaXMuY2FtZXJhID0gY2FtZXJhO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBSZW5kZXIgdGFyZ2V0IHdoZXJlIHRoZSBwb3N0cHJvY2Vzc2VkIGltYWdlIG5lZWRzIHRvIGJlIHJlbmRlcmVkIHRvLiBEZWZhdWx0cyB0byBudWxsXG4gICAgICAgICAqIHdoaWNoIGlzIG1haW4gZnJhbWVidWZmZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtSZW5kZXJUYXJnZXR9XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZGVzdGluYXRpb25SZW5kZXJUYXJnZXQgPSBudWxsO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBbGwgb2YgdGhlIHBvc3QgZWZmZWN0cyBpbiB0aGUgcXVldWUuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtQb3N0RWZmZWN0W119XG4gICAgICAgICAqIEBpZ25vcmVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZWZmZWN0cyA9IFtdO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBJZiB0aGUgcXVldWUgaXMgZW5hYmxlZCBpdCB3aWxsIHJlbmRlciBhbGwgb2YgaXRzIGVmZmVjdHMsIG90aGVyd2lzZSBpdCB3aWxsIG5vdCByZW5kZXJcbiAgICAgICAgICogYW55dGhpbmcuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAgICAgKiBAaWdub3JlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblxuICAgICAgICAvLyBsZWdhY3lcbiAgICAgICAgdGhpcy5kZXB0aFRhcmdldCA9IG51bGw7XG5cbiAgICAgICAgY2FtZXJhLm9uKCdzZXQ6cmVjdCcsIHRoaXMub25DYW1lcmFSZWN0Q2hhbmdlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWxsb2NhdGUgYSBjb2xvciBidWZmZXIgdGV4dHVyZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmb3JtYXQgLSBUaGUgZm9ybWF0IG9mIHRoZSBjb2xvciBidWZmZXIuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgY29sb3IgYnVmZmVyLlxuICAgICAqIEByZXR1cm5zIHtUZXh0dXJlfSBUaGUgY29sb3IgYnVmZmVyIHRleHR1cmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWxsb2NhdGVDb2xvckJ1ZmZlcihmb3JtYXQsIG5hbWUpIHtcbiAgICAgICAgY29uc3QgcmVjdCA9IHRoaXMuY2FtZXJhLnJlY3Q7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gTWF0aC5mbG9vcihyZWN0LnogKiB0aGlzLmFwcC5ncmFwaGljc0RldmljZS53aWR0aCk7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IE1hdGguZmxvb3IocmVjdC53ICogdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2UuaGVpZ2h0KTtcblxuICAgICAgICBjb25zdCBjb2xvckJ1ZmZlciA9IG5ldyBUZXh0dXJlKHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLCB7XG4gICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgZm9ybWF0OiBmb3JtYXQsXG4gICAgICAgICAgICB3aWR0aDogd2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICAgICAgICAgIG1pcG1hcHM6IGZhbHNlLFxuICAgICAgICAgICAgbWluRmlsdGVyOiBGSUxURVJfTkVBUkVTVCxcbiAgICAgICAgICAgIG1hZ0ZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICBhZGRyZXNzVTogQUREUkVTU19DTEFNUF9UT19FREdFLFxuICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gY29sb3JCdWZmZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHJlbmRlciB0YXJnZXQgd2l0aCB0aGUgZGltZW5zaW9ucyBvZiB0aGUgY2FudmFzLCB3aXRoIGFuIG9wdGlvbmFsIGRlcHRoIGJ1ZmZlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gdXNlRGVwdGggLSBTZXQgdG8gdHJ1ZSB0byBjcmVhdGUgYSByZW5kZXIgdGFyZ2V0IHdpdGggYSBkZXB0aCBidWZmZXIuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBoZHIgLSBVc2UgSERSIHJlbmRlciB0YXJnZXQgZm9ybWF0LlxuICAgICAqIEByZXR1cm5zIHtSZW5kZXJUYXJnZXR9IFRoZSByZW5kZXIgdGFyZ2V0LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2NyZWF0ZU9mZnNjcmVlblRhcmdldCh1c2VEZXB0aCwgaGRyKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2U7XG4gICAgICAgIGNvbnN0IGZvcm1hdCA9IGhkciA/IGRldmljZS5nZXRIZHJGb3JtYXQoKSA6IFBJWEVMRk9STUFUX1I4X0c4X0I4X0E4O1xuICAgICAgICBjb25zdCBuYW1lID0gdGhpcy5jYW1lcmEuZW50aXR5Lm5hbWUgKyAnLXBvc3RlZmZlY3QtJyArIHRoaXMuZWZmZWN0cy5sZW5ndGg7XG5cbiAgICAgICAgY29uc3QgY29sb3JCdWZmZXIgPSB0aGlzLl9hbGxvY2F0ZUNvbG9yQnVmZmVyKGZvcm1hdCwgbmFtZSk7XG5cbiAgICAgICAgcmV0dXJuIG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgY29sb3JCdWZmZXI6IGNvbG9yQnVmZmVyLFxuICAgICAgICAgICAgZGVwdGg6IHVzZURlcHRoLFxuICAgICAgICAgICAgc3RlbmNpbDogdXNlRGVwdGggJiYgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2Uuc3VwcG9ydHNTdGVuY2lsLFxuICAgICAgICAgICAgc2FtcGxlczogdXNlRGVwdGggPyBkZXZpY2Uuc2FtcGxlcyA6IDFcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgX3Jlc2l6ZU9mZnNjcmVlblRhcmdldChydCkge1xuICAgICAgICBjb25zdCBmb3JtYXQgPSBydC5jb2xvckJ1ZmZlci5mb3JtYXQ7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBydC5jb2xvckJ1ZmZlci5uYW1lO1xuXG4gICAgICAgIHJ0LmRlc3Ryb3lGcmFtZUJ1ZmZlcnMoKTtcbiAgICAgICAgcnQuZGVzdHJveVRleHR1cmVCdWZmZXJzKCk7XG4gICAgICAgIHJ0Ll9jb2xvckJ1ZmZlciA9IHRoaXMuX2FsbG9jYXRlQ29sb3JCdWZmZXIoZm9ybWF0LCBuYW1lKTtcbiAgICB9XG5cbiAgICBfZGVzdHJveU9mZnNjcmVlblRhcmdldChydCkge1xuICAgICAgICBydC5kZXN0cm95VGV4dHVyZUJ1ZmZlcnMoKTtcbiAgICAgICAgcnQuZGVzdHJveSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBwb3N0IGVmZmVjdCB0byB0aGUgcXVldWUuIElmIHRoZSBxdWV1ZSBpcyBkaXNhYmxlZCBhZGRpbmcgYSBwb3N0IGVmZmVjdCB3aWxsXG4gICAgICogYXV0b21hdGljYWxseSBlbmFibGUgdGhlIHF1ZXVlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtQb3N0RWZmZWN0fSBlZmZlY3QgLSBUaGUgcG9zdCBlZmZlY3QgdG8gYWRkIHRvIHRoZSBxdWV1ZS5cbiAgICAgKi9cbiAgICBhZGRFZmZlY3QoZWZmZWN0KSB7XG4gICAgICAgIC8vIGZpcnN0IHJlbmRlcmluZyBvZiB0aGUgc2NlbmUgcmVxdWlyZXMgZGVwdGggYnVmZmVyXG4gICAgICAgIGNvbnN0IGVmZmVjdHMgPSB0aGlzLmVmZmVjdHM7XG4gICAgICAgIGNvbnN0IGlzRmlyc3RFZmZlY3QgPSBlZmZlY3RzLmxlbmd0aCA9PT0gMDtcblxuICAgICAgICBjb25zdCBpbnB1dFRhcmdldCA9IHRoaXMuX2NyZWF0ZU9mZnNjcmVlblRhcmdldChpc0ZpcnN0RWZmZWN0LCBlZmZlY3QuaGRyKTtcbiAgICAgICAgY29uc3QgbmV3RW50cnkgPSBuZXcgUG9zdEVmZmVjdChlZmZlY3QsIGlucHV0VGFyZ2V0KTtcbiAgICAgICAgZWZmZWN0cy5wdXNoKG5ld0VudHJ5KTtcblxuICAgICAgICB0aGlzLl9zb3VyY2VUYXJnZXQgPSBuZXdFbnRyeS5pbnB1dFRhcmdldDtcblxuICAgICAgICAvLyBjb25uZWN0IHRoZSBlZmZlY3Qgd2l0aCB0aGUgcHJldmlvdXMgZWZmZWN0IGlmIG9uZSBleGlzdHNcbiAgICAgICAgaWYgKGVmZmVjdHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgZWZmZWN0c1tlZmZlY3RzLmxlbmd0aCAtIDJdLm91dHB1dFRhcmdldCA9IG5ld0VudHJ5LmlucHV0VGFyZ2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVxdWVzdCBkZXB0aG1hcCBpZiBuZWVkZWRcbiAgICAgICAgdGhpcy5fbmV3UG9zdEVmZmVjdCA9IGVmZmVjdDtcbiAgICAgICAgaWYgKGVmZmVjdC5uZWVkc0RlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXF1ZXN0RGVwdGhNYXAoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZW5hYmxlKCk7XG4gICAgICAgIHRoaXMuX25ld1Bvc3RFZmZlY3QgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBhIHBvc3QgZWZmZWN0IGZyb20gdGhlIHF1ZXVlLiBJZiB0aGUgcXVldWUgYmVjb21lcyBlbXB0eSBpdCB3aWxsIGJlIGRpc2FibGVkXG4gICAgICogYXV0b21hdGljYWxseS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UG9zdEVmZmVjdH0gZWZmZWN0IC0gVGhlIHBvc3QgZWZmZWN0IHRvIHJlbW92ZS5cbiAgICAgKi9cbiAgICByZW1vdmVFZmZlY3QoZWZmZWN0KSB7XG5cbiAgICAgICAgLy8gZmluZCBpbmRleCBvZiBlZmZlY3RcbiAgICAgICAgbGV0IGluZGV4ID0gLTE7XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSB0aGlzLmVmZmVjdHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVmZmVjdHNbaV0uZWZmZWN0ID09PSBlZmZlY3QpIHtcbiAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgICAgICAgaWYgKGluZGV4ID4gMCkgIHtcbiAgICAgICAgICAgICAgICAvLyBjb25uZWN0IHRoZSBwcmV2aW91cyBlZmZlY3Qgd2l0aCB0aGUgZWZmZWN0IGFmdGVyIHRoZSBvbmUgd2UncmUgYWJvdXQgdG8gcmVtb3ZlXG4gICAgICAgICAgICAgICAgdGhpcy5lZmZlY3RzW2luZGV4IC0gMV0ub3V0cHV0VGFyZ2V0ID0gKGluZGV4ICsgMSkgPCB0aGlzLmVmZmVjdHMubGVuZ3RoID9cbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lZmZlY3RzW2luZGV4ICsgMV0uaW5wdXRUYXJnZXQgOlxuICAgICAgICAgICAgICAgICAgICBudWxsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5lZmZlY3RzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgd2UgcmVtb3ZlZCB0aGUgZmlyc3QgZWZmZWN0IHRoZW4gbWFrZSBzdXJlIHRoYXRcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhlIGlucHV0IHJlbmRlciB0YXJnZXQgb2YgdGhlIGVmZmVjdCB0aGF0IHdpbGwgbm93IGJlY29tZSB0aGUgZmlyc3Qgb25lXG4gICAgICAgICAgICAgICAgICAgIC8vIGhhcyBhIGRlcHRoIGJ1ZmZlclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXRoaXMuZWZmZWN0c1sxXS5pbnB1dFRhcmdldC5fZGVwdGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lPZmZzY3JlZW5UYXJnZXQodGhpcy5lZmZlY3RzWzFdLmlucHV0VGFyZ2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZWZmZWN0c1sxXS5pbnB1dFRhcmdldCA9IHRoaXMuX2NyZWF0ZU9mZnNjcmVlblRhcmdldCh0cnVlLCB0aGlzLmVmZmVjdHNbMV0uaGRyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3NvdXJjZVRhcmdldCA9IHRoaXMuZWZmZWN0c1sxXS5pbnB1dFRhcmdldDtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2FtZXJhLnJlbmRlclRhcmdldCA9IHRoaXMuZWZmZWN0c1sxXS5pbnB1dFRhcmdldDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlbGVhc2UgbWVtb3J5IGZvciByZW1vdmVkIGVmZmVjdFxuICAgICAgICAgICAgdGhpcy5fZGVzdHJveU9mZnNjcmVlblRhcmdldCh0aGlzLmVmZmVjdHNbaW5kZXhdLmlucHV0VGFyZ2V0KTtcblxuICAgICAgICAgICAgdGhpcy5lZmZlY3RzLnNwbGljZShpbmRleCwgMSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICAgICAgICBpZiAoZWZmZWN0Lm5lZWRzRGVwdGhCdWZmZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZWxlYXNlRGVwdGhNYXAoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVmZmVjdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLmRpc2FibGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZXF1ZXN0RGVwdGhNYXBzKCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gdGhpcy5lZmZlY3RzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBlZmZlY3QgPSB0aGlzLmVmZmVjdHNbaV0uZWZmZWN0O1xuICAgICAgICAgICAgaWYgKHRoaXMuX25ld1Bvc3RFZmZlY3QgPT09IGVmZmVjdClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgaWYgKGVmZmVjdC5uZWVkc0RlcHRoQnVmZmVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVxdWVzdERlcHRoTWFwKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVsZWFzZURlcHRoTWFwcygpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuZWZmZWN0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZWZmZWN0ID0gdGhpcy5lZmZlY3RzW2ldLmVmZmVjdDtcbiAgICAgICAgICAgIGlmIChlZmZlY3QubmVlZHNEZXB0aEJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbGVhc2VEZXB0aE1hcCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlcXVlc3REZXB0aE1hcCgpIHtcbiAgICAgICAgY29uc3QgZGVwdGhMYXllciA9IHRoaXMuYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9ERVBUSCk7XG4gICAgICAgIGlmIChkZXB0aExheWVyKSB7XG4gICAgICAgICAgICBkZXB0aExheWVyLmluY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLnJlcXVlc3RTY2VuZURlcHRoTWFwKHRydWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlbGVhc2VEZXB0aE1hcCgpIHtcbiAgICAgICAgY29uc3QgZGVwdGhMYXllciA9IHRoaXMuYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9ERVBUSCk7XG4gICAgICAgIGlmIChkZXB0aExheWVyKSB7XG4gICAgICAgICAgICBkZXB0aExheWVyLmRlY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLnJlcXVlc3RTY2VuZURlcHRoTWFwKGZhbHNlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIHRoZSBlZmZlY3RzIGZyb20gdGhlIHF1ZXVlIGFuZCBkaXNhYmxlcyBpdC5cbiAgICAgKi9cbiAgICBkZXN0cm95KCkge1xuICAgICAgICAvLyByZWxlYXNlIG1lbW9yeSBmb3IgYWxsIGVmZmVjdHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuZWZmZWN0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgdGhpcy5lZmZlY3RzW2ldLmlucHV0VGFyZ2V0LmRlc3Ryb3koKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZWZmZWN0cy5sZW5ndGggPSAwO1xuXG4gICAgICAgIHRoaXMuZGlzYWJsZSgpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgdGhlIHF1ZXVlIGFuZCBhbGwgb2YgaXRzIGVmZmVjdHMuIElmIHRoZXJlIGFyZSBubyBlZmZlY3RzIHRoZW4gdGhlIHF1ZXVlIHdpbGwgbm90IGJlXG4gICAgICogZW5hYmxlZC5cbiAgICAgKi9cbiAgICBlbmFibGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5lbmFibGVkICYmIHRoaXMuZWZmZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIHRoaXMuX3JlcXVlc3REZXB0aE1hcHMoKTtcblxuICAgICAgICAgICAgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2Uub24oJ3Jlc2l6ZWNhbnZhcycsIHRoaXMuX29uQ2FudmFzUmVzaXplZCwgdGhpcyk7XG5cbiAgICAgICAgICAgIC8vIG9yaWdpbmFsIGNhbWVyYSdzIHJlbmRlciB0YXJnZXQgaXMgd2hlcmUgdGhlIGZpbmFsIG91dHB1dCBuZWVkcyB0byBnb1xuICAgICAgICAgICAgdGhpcy5kZXN0aW5hdGlvblJlbmRlclRhcmdldCA9IHRoaXMuY2FtZXJhLnJlbmRlclRhcmdldDtcblxuICAgICAgICAgICAgLy8gY2FtZXJhIHJlbmRlcnMgdG8gdGhlIGZpcnN0IGVmZmVjdCdzIHJlbmRlciB0YXJnZXRcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLnJlbmRlclRhcmdldCA9IHRoaXMuZWZmZWN0c1swXS5pbnB1dFRhcmdldDtcblxuICAgICAgICAgICAgLy8gY2FsbGJhY2sgd2hlbiBwb3N0cHJvY2Vzc2luZyB0YWtlcyBwbGFjZVxuICAgICAgICAgICAgdGhpcy5jYW1lcmEub25Qb3N0cHJvY2Vzc2luZyA9ICgpID0+IHtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlY3QgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsZW4gPSB0aGlzLmVmZmVjdHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGVuKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmeCA9IHRoaXMuZWZmZWN0c1tpXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBkZXN0VGFyZ2V0ID0gZngub3V0cHV0VGFyZ2V0O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gbGFzdCBlZmZlY3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaSA9PT0gbGVuIC0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWN0ID0gdGhpcy5jYW1lcmEucmVjdDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBjYW1lcmEgb3JpZ2luYWxseSByZW5kZXJlZCB0byBhIHJlbmRlciB0YXJnZXQsIHJlbmRlciBsYXN0IGVmZmVjdCB0byBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5kZXN0aW5hdGlvblJlbmRlclRhcmdldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzdFRhcmdldCA9IHRoaXMuZGVzdGluYXRpb25SZW5kZXJUYXJnZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIodGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2UsIGZ4Lm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZ4LmVmZmVjdC5yZW5kZXIoZnguaW5wdXRUYXJnZXQsIGRlc3RUYXJnZXQsIHJlY3QpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlYnVnR3JhcGhpY3MucG9wR3B1TWFya2VyKHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXNhYmxlcyB0aGUgcXVldWUgYW5kIGFsbCBvZiBpdHMgZWZmZWN0cy5cbiAgICAgKi9cbiAgICBkaXNhYmxlKCkge1xuICAgICAgICBpZiAodGhpcy5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblxuICAgICAgICAgICAgdGhpcy5hcHAuZ3JhcGhpY3NEZXZpY2Uub2ZmKCdyZXNpemVjYW52YXMnLCB0aGlzLl9vbkNhbnZhc1Jlc2l6ZWQsIHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLl9yZWxlYXNlRGVwdGhNYXBzKCk7XG5cbiAgICAgICAgICAgIHRoaXMuX2Rlc3Ryb3lPZmZzY3JlZW5UYXJnZXQodGhpcy5fc291cmNlVGFyZ2V0KTtcblxuICAgICAgICAgICAgdGhpcy5jYW1lcmEucmVuZGVyVGFyZ2V0ID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuY2FtZXJhLm9uUG9zdHByb2Nlc3NpbmcgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSGFuZGxlciBjYWxsZWQgd2hlbiB0aGUgYXBwbGljYXRpb24ncyBjYW52YXMgZWxlbWVudCBpcyByZXNpemVkLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdpZHRoIC0gVGhlIG5ldyB3aWR0aCBvZiB0aGUgY2FudmFzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgbmV3IGhlaWdodCBvZiB0aGUgY2FudmFzLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uQ2FudmFzUmVzaXplZCh3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIGNvbnN0IHJlY3QgPSB0aGlzLmNhbWVyYS5yZWN0O1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmFwcC5ncmFwaGljc0RldmljZTtcbiAgICAgICAgdGhpcy5jYW1lcmEuY2FtZXJhLmFzcGVjdFJhdGlvID0gKGRldmljZS53aWR0aCAqIHJlY3QueikgLyAoZGV2aWNlLmhlaWdodCAqIHJlY3Qudyk7XG5cbiAgICAgICAgdGhpcy5yZXNpemVSZW5kZXJUYXJnZXRzKCk7XG4gICAgfVxuXG4gICAgcmVzaXplUmVuZGVyVGFyZ2V0cygpIHtcblxuICAgICAgICBjb25zdCByZWN0ID0gdGhpcy5jYW1lcmEucmVjdDtcbiAgICAgICAgY29uc3QgZGVzaXJlZFdpZHRoID0gTWF0aC5mbG9vcihyZWN0LnogKiB0aGlzLmFwcC5ncmFwaGljc0RldmljZS53aWR0aCk7XG4gICAgICAgIGNvbnN0IGRlc2lyZWRIZWlnaHQgPSBNYXRoLmZsb29yKHJlY3QudyAqIHRoaXMuYXBwLmdyYXBoaWNzRGV2aWNlLmhlaWdodCk7XG5cbiAgICAgICAgY29uc3QgZWZmZWN0cyA9IHRoaXMuZWZmZWN0cztcblxuICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZWZmZWN0cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZnggPSBlZmZlY3RzW2ldO1xuICAgICAgICAgICAgaWYgKGZ4LmlucHV0VGFyZ2V0LndpZHRoICE9PSBkZXNpcmVkV2lkdGggfHxcbiAgICAgICAgICAgICAgICBmeC5pbnB1dFRhcmdldC5oZWlnaHQgIT09IGRlc2lyZWRIZWlnaHQpICB7XG4gICAgICAgICAgICAgICAgdGhpcy5fcmVzaXplT2Zmc2NyZWVuVGFyZ2V0KGZ4LmlucHV0VGFyZ2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uQ2FtZXJhUmVjdENoYW5nZWQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVzaXplUmVuZGVyVGFyZ2V0cygpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBQb3N0RWZmZWN0UXVldWUgfTtcbiJdLCJuYW1lcyI6WyJQb3N0RWZmZWN0IiwiY29uc3RydWN0b3IiLCJlZmZlY3QiLCJpbnB1dFRhcmdldCIsIm91dHB1dFRhcmdldCIsIm5hbWUiLCJQb3N0RWZmZWN0UXVldWUiLCJhcHAiLCJjYW1lcmEiLCJkZXN0aW5hdGlvblJlbmRlclRhcmdldCIsImVmZmVjdHMiLCJlbmFibGVkIiwiZGVwdGhUYXJnZXQiLCJvbiIsIm9uQ2FtZXJhUmVjdENoYW5nZWQiLCJfYWxsb2NhdGVDb2xvckJ1ZmZlciIsImZvcm1hdCIsInJlY3QiLCJ3aWR0aCIsIk1hdGgiLCJmbG9vciIsInoiLCJncmFwaGljc0RldmljZSIsImhlaWdodCIsInciLCJjb2xvckJ1ZmZlciIsIlRleHR1cmUiLCJtaXBtYXBzIiwibWluRmlsdGVyIiwiRklMVEVSX05FQVJFU1QiLCJtYWdGaWx0ZXIiLCJhZGRyZXNzVSIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsImFkZHJlc3NWIiwiX2NyZWF0ZU9mZnNjcmVlblRhcmdldCIsInVzZURlcHRoIiwiaGRyIiwiZGV2aWNlIiwiZ2V0SGRyRm9ybWF0IiwiUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgiLCJlbnRpdHkiLCJsZW5ndGgiLCJSZW5kZXJUYXJnZXQiLCJkZXB0aCIsInN0ZW5jaWwiLCJzdXBwb3J0c1N0ZW5jaWwiLCJzYW1wbGVzIiwiX3Jlc2l6ZU9mZnNjcmVlblRhcmdldCIsInJ0IiwiZGVzdHJveUZyYW1lQnVmZmVycyIsImRlc3Ryb3lUZXh0dXJlQnVmZmVycyIsIl9jb2xvckJ1ZmZlciIsIl9kZXN0cm95T2Zmc2NyZWVuVGFyZ2V0IiwiZGVzdHJveSIsImFkZEVmZmVjdCIsImlzRmlyc3RFZmZlY3QiLCJuZXdFbnRyeSIsInB1c2giLCJfc291cmNlVGFyZ2V0IiwiX25ld1Bvc3RFZmZlY3QiLCJuZWVkc0RlcHRoQnVmZmVyIiwiX3JlcXVlc3REZXB0aE1hcCIsImVuYWJsZSIsInVuZGVmaW5lZCIsInJlbW92ZUVmZmVjdCIsImluZGV4IiwiaSIsImxlbiIsIl9kZXB0aCIsInJlbmRlclRhcmdldCIsInNwbGljZSIsIl9yZWxlYXNlRGVwdGhNYXAiLCJkaXNhYmxlIiwiX3JlcXVlc3REZXB0aE1hcHMiLCJfcmVsZWFzZURlcHRoTWFwcyIsImRlcHRoTGF5ZXIiLCJzY2VuZSIsImxheWVycyIsImdldExheWVyQnlJZCIsIkxBWUVSSURfREVQVEgiLCJpbmNyZW1lbnRDb3VudGVyIiwicmVxdWVzdFNjZW5lRGVwdGhNYXAiLCJkZWNyZW1lbnRDb3VudGVyIiwiX29uQ2FudmFzUmVzaXplZCIsIm9uUG9zdHByb2Nlc3NpbmciLCJmeCIsImRlc3RUYXJnZXQiLCJEZWJ1Z0dyYXBoaWNzIiwicHVzaEdwdU1hcmtlciIsInJlbmRlciIsInBvcEdwdU1hcmtlciIsIm9mZiIsImFzcGVjdFJhdGlvIiwicmVzaXplUmVuZGVyVGFyZ2V0cyIsImRlc2lyZWRXaWR0aCIsImRlc2lyZWRIZWlnaHQiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQVVBLE1BQU1BLFVBQVUsQ0FBQztBQUNiQyxFQUFBQSxXQUFXLENBQUNDLE1BQU0sRUFBRUMsV0FBVyxFQUFFO0lBQzdCLElBQUksQ0FBQ0QsTUFBTSxHQUFHQSxNQUFNLENBQUE7SUFDcEIsSUFBSSxDQUFDQyxXQUFXLEdBQUdBLFdBQVcsQ0FBQTtJQUM5QixJQUFJLENBQUNDLFlBQVksR0FBRyxJQUFJLENBQUE7QUFDeEIsSUFBQSxJQUFJLENBQUNDLElBQUksR0FBR0gsTUFBTSxDQUFDRCxXQUFXLENBQUNJLElBQUksQ0FBQTtBQUN2QyxHQUFBO0FBQ0osQ0FBQTs7QUFLQSxNQUFNQyxlQUFlLENBQUM7QUFPbEJMLEVBQUFBLFdBQVcsQ0FBQ00sR0FBRyxFQUFFQyxNQUFNLEVBQUU7SUFDckIsSUFBSSxDQUFDRCxHQUFHLEdBQUdBLEdBQUcsQ0FBQTtJQUNkLElBQUksQ0FBQ0MsTUFBTSxHQUFHQSxNQUFNLENBQUE7O0lBU3BCLElBQUksQ0FBQ0MsdUJBQXVCLEdBQUcsSUFBSSxDQUFB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