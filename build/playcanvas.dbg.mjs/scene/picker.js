/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision 1331860ee (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Color } from '../core/math/color.js';
import { PIXELFORMAT_R8_G8_B8_A8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, CLEARFLAG_DEPTH } from '../platform/graphics/constants.js';
import { GraphicsDevice } from '../platform/graphics/graphics-device.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { Texture } from '../platform/graphics/texture.js';
import { DebugGraphics } from '../platform/graphics/debug-graphics.js';
import { SHADER_PICK, SORTMODE_NONE } from './constants.js';
import { Camera } from './camera.js';
import { Command } from './mesh-instance.js';
import { Layer } from './layer.js';
import { LayerComposition } from './composition/layer-composition.js';
import { getApplication } from '../framework/globals.js';
import { Entity } from '../framework/entity.js';
import { Debug } from '../core/debug.js';

const tempSet = new Set();
const clearDepthOptions = {
  depth: 1.0,
  flags: CLEARFLAG_DEPTH
};

class Picker {
  constructor(app, width, height) {
    if (app instanceof GraphicsDevice) {
      app = getApplication();
      Debug.deprecated('pc.Picker now takes pc.AppBase as first argument. Passing pc.GraphicsDevice is deprecated.');
    }

    this.app = app;
    this.device = app.graphicsDevice;
    this.pickColor = new Float32Array(4);
    this.pickColor[3] = 1;
    this.mapping = [];
    this.cameraEntity = null;
    this.layer = null;
    this.layerComp = null;
    this.initLayerComposition();
    this._renderTarget = null;
    const device = this.device;
    this.clearDepthCommand = new Command(0, 0, function () {
      device.clear(clearDepthOptions);
    });
    this.width = 0;
    this.height = 0;
    this.resize(width, height);
  }

  getSelection(x, y, width, height) {
    const device = this.device;

    if (typeof x === 'object') {
      Debug.deprecated('Picker.getSelection:param \'rect\' is deprecated, use \'x, y, width, height\' instead.');
      const rect = x;
      x = rect.x;
      y = rect.y;
      width = rect.width;
      height = rect.height;
    } else {
      y = this.renderTarget.height - (y + (height || 1));
    }

    x = Math.floor(x);
    y = Math.floor(y);
    width = Math.floor(Math.max(width || 1, 1));
    height = Math.floor(Math.max(height || 1, 1));
    const origRenderTarget = device.renderTarget;
    DebugGraphics.pushGpuMarker(device, 'PICKER');
    device.setRenderTarget(this.renderTarget);
    device.updateBegin();
    const pixels = new Uint8Array(4 * width * height);
    device.readPixels(x, y, width, height, pixels);
    device.updateEnd();
    device.setRenderTarget(origRenderTarget);
    DebugGraphics.popGpuMarker(device);
    const mapping = this.mapping;

    for (let i = 0; i < width * height; i++) {
      const r = pixels[4 * i + 0];
      const g = pixels[4 * i + 1];
      const b = pixels[4 * i + 2];
      const index = r << 16 | g << 8 | b;

      if (index !== 0xffffff) {
        tempSet.add(mapping[index]);
      }
    }

    const selection = [];
    tempSet.forEach(meshInstance => selection.push(meshInstance));
    tempSet.clear();
    return selection;
  }

  allocateRenderTarget() {
    const colorBuffer = new Texture(this.device, {
      format: PIXELFORMAT_R8_G8_B8_A8,
      width: this.width,
      height: this.height,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE,
      name: 'pick'
    });
    this.renderTarget = new RenderTarget({
      colorBuffer: colorBuffer,
      depth: true
    });
  }

  releaseRenderTarget() {
    this.cameraEntity.camera.renderTarget = null;

    if (this._renderTarget) {
      this._renderTarget.destroyTextureBuffers();

      this._renderTarget.destroy();

      this._renderTarget = null;
    }
  }

  initLayerComposition() {
    const device = this.device;
    const self = this;
    const pickColorId = device.scope.resolve('uColor');
    this.cameraEntity = new Entity();
    this.cameraEntity.addComponent('camera');
    this.layer = new Layer({
      name: 'Picker',
      shaderPass: SHADER_PICK,
      opaqueSortMode: SORTMODE_NONE,
      onDrawCall: function (meshInstance, index) {
        self.pickColor[0] = (index >> 16 & 0xff) / 255;
        self.pickColor[1] = (index >> 8 & 0xff) / 255;
        self.pickColor[2] = (index & 0xff) / 255;
        pickColorId.setValue(self.pickColor);
        device.setBlending(false);
        self.mapping[index] = meshInstance;
      }
    });
    this.layer.addCamera(this.cameraEntity.camera);
    this.layerComp = new LayerComposition('picker');
    this.layerComp.pushOpaque(this.layer);
  }

  prepare(camera, scene, layers) {
    if (camera instanceof Camera) {
      Debug.deprecated('pc.Picker#prepare now takes pc.CameraComponent as first argument. Passing pc.Camera is deprecated.');
      camera = camera.node.camera;
    }

    if (layers instanceof Layer) {
      layers = [layers];
    }

    this.layer.clearMeshInstances();
    const destMeshInstances = this.layer.opaqueMeshInstances;
    const srcLayers = scene.layers.layerList;
    const subLayerEnabled = scene.layers.subLayerEnabled;
    const isTransparent = scene.layers.subLayerList;

    for (let i = 0; i < srcLayers.length; i++) {
      const srcLayer = srcLayers[i];

      if (layers && layers.indexOf(srcLayer) < 0) {
        continue;
      }

      if (srcLayer.enabled && subLayerEnabled[i]) {
        const layerCamId = srcLayer.cameras.indexOf(camera);

        if (layerCamId >= 0) {
          if (srcLayer._clearDepthBuffer) {
            destMeshInstances.push(this.clearDepthCommand);
          }

          const meshInstances = isTransparent[i] ? srcLayer.instances.transparentMeshInstances : srcLayer.instances.opaqueMeshInstances;

          for (let j = 0; j < meshInstances.length; j++) {
            const meshInstance = meshInstances[j];

            if (meshInstance.pick) {
              destMeshInstances.push(meshInstance);
            }
          }
        }
      }
    }

    if (!this.renderTarget || this.width !== this.renderTarget.width || this.height !== this.renderTarget.height) {
      this.releaseRenderTarget();
      this.allocateRenderTarget();
    }

    this.updateCamera(camera);
    this.mapping.length = 0;
    this.app.renderComposition(this.layerComp);
  }

  updateCamera(srcCamera) {
    this.cameraEntity.copy(srcCamera.entity);
    this.cameraEntity.name = 'PickerCamera';
    const destCamera = this.cameraEntity.camera;
    destCamera.copy(srcCamera);
    destCamera.clearColorBuffer = true;
    destCamera.clearDepthBuffer = true;
    destCamera.clearStencilBuffer = true;
    destCamera.clearColor = Color.WHITE;
    destCamera.renderTarget = this.renderTarget;
    this.layer.clearCameras();
    this.layer.addCamera(destCamera);
    destCamera.layers = [this.layer.id];
  }

  resize(width, height) {
    this.width = Math.floor(width);
    this.height = Math.floor(height);
  }

}

export { Picker };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlja2VyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc2NlbmUvcGlja2VyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vY29yZS9tYXRoL2NvbG9yLmpzJztcblxuaW1wb3J0IHsgQUREUkVTU19DTEFNUF9UT19FREdFLCBDTEVBUkZMQUdfREVQVEgsIEZJTFRFUl9ORUFSRVNULCBQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBHcmFwaGljc0RldmljZSB9IGZyb20gJy4uL3BsYXRmb3JtL2dyYXBoaWNzL2dyYXBoaWNzLWRldmljZS5qcyc7XG5pbXBvcnQgeyBSZW5kZXJUYXJnZXQgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9yZW5kZXItdGFyZ2V0LmpzJztcbmltcG9ydCB7IFRleHR1cmUgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy90ZXh0dXJlLmpzJztcbmltcG9ydCB7IERlYnVnR3JhcGhpY3MgfSBmcm9tICcuLi9wbGF0Zm9ybS9ncmFwaGljcy9kZWJ1Zy1ncmFwaGljcy5qcyc7XG5cbmltcG9ydCB7IFNIQURFUl9QSUNLLCBTT1JUTU9ERV9OT05FIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2FtZXJhIH0gZnJvbSAnLi9jYW1lcmEuanMnO1xuaW1wb3J0IHsgQ29tbWFuZCB9IGZyb20gJy4vbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBMYXllciB9IGZyb20gJy4vbGF5ZXIuanMnO1xuaW1wb3J0IHsgTGF5ZXJDb21wb3NpdGlvbiB9IGZyb20gJy4vY29tcG9zaXRpb24vbGF5ZXItY29tcG9zaXRpb24uanMnO1xuXG5pbXBvcnQgeyBnZXRBcHBsaWNhdGlvbiB9IGZyb20gJy4uL2ZyYW1ld29yay9nbG9iYWxzLmpzJztcbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uL2ZyYW1ld29yay9lbnRpdHkuanMnO1xuaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi9jb3JlL2RlYnVnLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uL2ZyYW1ld29yay9hcHAtYmFzZS5qcycpLkFwcEJhc2V9IEFwcEJhc2UgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi9mcmFtZXdvcmsvY29tcG9uZW50cy9jYW1lcmEvY29tcG9uZW50LmpzJykuQ2FtZXJhQ29tcG9uZW50fSBDYW1lcmFDb21wb25lbnQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL21lc2gtaW5zdGFuY2UuanMnKS5NZXNoSW5zdGFuY2V9IE1lc2hJbnN0YW5jZSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc2NlbmUuanMnKS5TY2VuZX0gU2NlbmUgKi9cblxuY29uc3QgdGVtcFNldCA9IG5ldyBTZXQoKTtcblxuY29uc3QgY2xlYXJEZXB0aE9wdGlvbnMgPSB7XG4gICAgZGVwdGg6IDEuMCxcbiAgICBmbGFnczogQ0xFQVJGTEFHX0RFUFRIXG59O1xuXG4vKipcbiAqIFBpY2tlciBvYmplY3QgdXNlZCB0byBzZWxlY3QgbWVzaCBpbnN0YW5jZXMgZnJvbSBzY3JlZW4gY29vcmRpbmF0ZXMuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHdpZHRoIFdpZHRoIG9mIHRoZSBwaWNrIGJ1ZmZlciBpbiBwaXhlbHMgKHJlYWQtb25seSkuXG4gKiBAcHJvcGVydHkge251bWJlcn0gaGVpZ2h0IEhlaWdodCBvZiB0aGUgcGljayBidWZmZXIgaW4gcGl4ZWxzIChyZWFkLW9ubHkpLlxuICogQHByb3BlcnR5IHtSZW5kZXJUYXJnZXR9IHJlbmRlclRhcmdldCBUaGUgcmVuZGVyIHRhcmdldCB1c2VkIGJ5IHRoZSBwaWNrZXIgaW50ZXJuYWxseVxuICogKHJlYWQtb25seSkuXG4gKi9cbmNsYXNzIFBpY2tlciB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFBpY2tlciBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXBwQmFzZX0gYXBwIC0gVGhlIGFwcGxpY2F0aW9uIG1hbmFnaW5nIHRoaXMgcGlja2VyIGluc3RhbmNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3aWR0aCAtIFRoZSB3aWR0aCBvZiB0aGUgcGljayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBoZWlnaHQgLSBUaGUgaGVpZ2h0IG9mIHRoZSBwaWNrIGJ1ZmZlciBpbiBwaXhlbHMuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoYXBwLCB3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIGlmIChhcHAgaW5zdGFuY2VvZiBHcmFwaGljc0RldmljZSkge1xuICAgICAgICAgICAgYXBwID0gZ2V0QXBwbGljYXRpb24oKTtcbiAgICAgICAgICAgIERlYnVnLmRlcHJlY2F0ZWQoJ3BjLlBpY2tlciBub3cgdGFrZXMgcGMuQXBwQmFzZSBhcyBmaXJzdCBhcmd1bWVudC4gUGFzc2luZyBwYy5HcmFwaGljc0RldmljZSBpcyBkZXByZWNhdGVkLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgICAgIHRoaXMuZGV2aWNlID0gYXBwLmdyYXBoaWNzRGV2aWNlO1xuXG4gICAgICAgIC8vIHVuaWZvcm0gZm9yIHRoZSBtZXNoIGluZGV4IGVuY29kZWQgaW50byByZ2JhXG4gICAgICAgIHRoaXMucGlja0NvbG9yID0gbmV3IEZsb2F0MzJBcnJheSg0KTtcbiAgICAgICAgdGhpcy5waWNrQ29sb3JbM10gPSAxO1xuXG4gICAgICAgIC8vIG1hcHBpbmcgdGFibGUgZnJvbSBpZHMgdG8gbWVzaEluc3RhbmNlc1xuICAgICAgICB0aGlzLm1hcHBpbmcgPSBbXTtcblxuICAgICAgICAvLyBjcmVhdGUgbGF5ZXIgY29tcG9zaXRpb24gd2l0aCB0aGUgbGF5ZXIgYW5kIGNhbWVyYVxuICAgICAgICB0aGlzLmNhbWVyYUVudGl0eSA9IG51bGw7XG4gICAgICAgIHRoaXMubGF5ZXIgPSBudWxsO1xuICAgICAgICB0aGlzLmxheWVyQ29tcCA9IG51bGw7XG4gICAgICAgIHRoaXMuaW5pdExheWVyQ29tcG9zaXRpb24oKTtcblxuICAgICAgICAvLyBpbnRlcm5hbCByZW5kZXIgdGFyZ2V0XG4gICAgICAgIHRoaXMuX3JlbmRlclRhcmdldCA9IG51bGw7XG5cbiAgICAgICAgLy8gY2xlYXIgY29tbWFuZCB1c2VyIHRvIHNpbXVsYXRlIGxheWVyIGNsZWFyaW5nLCByZXF1aXJlZCBkdWUgdG8gc3RvcmluZyBtZXNoZXMgZnJvbSBtdWx0aXBsZSBsYXllcnMgb24gYSBzaW5nZSBsYXllclxuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcbiAgICAgICAgdGhpcy5jbGVhckRlcHRoQ29tbWFuZCA9IG5ldyBDb21tYW5kKDAsIDAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGRldmljZS5jbGVhcihjbGVhckRlcHRoT3B0aW9ucyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMud2lkdGggPSAwO1xuICAgICAgICB0aGlzLmhlaWdodCA9IDA7XG4gICAgICAgIHRoaXMucmVzaXplKHdpZHRoLCBoZWlnaHQpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgbGlzdCBvZiBtZXNoIGluc3RhbmNlcyBzZWxlY3RlZCBieSB0aGUgc3BlY2lmaWVkIHJlY3RhbmdsZSBpbiB0aGUgcHJldmlvdXNseVxuICAgICAqIHByZXBhcmVkIHBpY2sgYnVmZmVyLlRoZSByZWN0YW5nbGUgdXNpbmcgdG9wLWxlZnQgY29vcmRpbmF0ZSBzeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0geCAtIFRoZSBsZWZ0IGVkZ2Ugb2YgdGhlIHJlY3RhbmdsZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0geSAtIFRoZSB0b3AgZWRnZSBvZiB0aGUgcmVjdGFuZ2xlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbd2lkdGhdIC0gVGhlIHdpZHRoIG9mIHRoZSByZWN0YW5nbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtoZWlnaHRdIC0gVGhlIGhlaWdodCBvZiB0aGUgcmVjdGFuZ2xlLlxuICAgICAqIEByZXR1cm5zIHtNZXNoSW5zdGFuY2VbXX0gQW4gYXJyYXkgb2YgbWVzaCBpbnN0YW5jZXMgdGhhdCBhcmUgaW4gdGhlIHNlbGVjdGlvbi5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCB0aGUgc2VsZWN0aW9uIGF0IHRoZSBwb2ludCAoMTAsMjApXG4gICAgICogdmFyIHNlbGVjdGlvbiA9IHBpY2tlci5nZXRTZWxlY3Rpb24oMTAsIDIwKTtcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIEdldCBhbGwgbW9kZWxzIGluIHJlY3RhbmdsZSB3aXRoIGNvcm5lcnMgYXQgKDEwLDIwKSBhbmQgKDIwLDQwKVxuICAgICAqIHZhciBzZWxlY3Rpb24gPSBwaWNrZXIuZ2V0U2VsZWN0aW9uKDEwLCAyMCwgMTAsIDIwKTtcbiAgICAgKi9cbiAgICBnZXRTZWxlY3Rpb24oeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuICAgICAgICBjb25zdCBkZXZpY2UgPSB0aGlzLmRldmljZTtcblxuICAgICAgICBpZiAodHlwZW9mIHggPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdQaWNrZXIuZ2V0U2VsZWN0aW9uOnBhcmFtIFxcJ3JlY3RcXCcgaXMgZGVwcmVjYXRlZCwgdXNlIFxcJ3gsIHksIHdpZHRoLCBoZWlnaHRcXCcgaW5zdGVhZC4nKTtcblxuICAgICAgICAgICAgY29uc3QgcmVjdCA9IHg7XG4gICAgICAgICAgICB4ID0gcmVjdC54O1xuICAgICAgICAgICAgeSA9IHJlY3QueTtcbiAgICAgICAgICAgIHdpZHRoID0gcmVjdC53aWR0aDtcbiAgICAgICAgICAgIGhlaWdodCA9IHJlY3QuaGVpZ2h0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgeSA9IHRoaXMucmVuZGVyVGFyZ2V0LmhlaWdodCAtICh5ICsgKGhlaWdodCB8fCAxKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYWtlIHN1cmUgd2UgaGF2ZSBuaWNlIG51bWJlcnMgdG8gd29yayB3aXRoXG4gICAgICAgIHggPSBNYXRoLmZsb29yKHgpO1xuICAgICAgICB5ID0gTWF0aC5mbG9vcih5KTtcbiAgICAgICAgd2lkdGggPSBNYXRoLmZsb29yKE1hdGgubWF4KHdpZHRoIHx8IDEsIDEpKTtcbiAgICAgICAgaGVpZ2h0ID0gTWF0aC5mbG9vcihNYXRoLm1heChoZWlnaHQgfHwgMSwgMSkpO1xuXG4gICAgICAgIC8vIGJhY2t1cCBhY3RpdmUgcmVuZGVyIHRhcmdldFxuICAgICAgICBjb25zdCBvcmlnUmVuZGVyVGFyZ2V0ID0gZGV2aWNlLnJlbmRlclRhcmdldDtcblxuICAgICAgICBEZWJ1Z0dyYXBoaWNzLnB1c2hHcHVNYXJrZXIoZGV2aWNlLCAnUElDS0VSJyk7XG5cbiAgICAgICAgLy8gUmVhZHkgdGhlIGRldmljZSBmb3IgcmVuZGVyaW5nIHRvIHRoZSBwaWNrIGJ1ZmZlclxuICAgICAgICBkZXZpY2Uuc2V0UmVuZGVyVGFyZ2V0KHRoaXMucmVuZGVyVGFyZ2V0KTtcbiAgICAgICAgZGV2aWNlLnVwZGF0ZUJlZ2luKCk7XG5cbiAgICAgICAgY29uc3QgcGl4ZWxzID0gbmV3IFVpbnQ4QXJyYXkoNCAqIHdpZHRoICogaGVpZ2h0KTtcbiAgICAgICAgZGV2aWNlLnJlYWRQaXhlbHMoeCwgeSwgd2lkdGgsIGhlaWdodCwgcGl4ZWxzKTtcblxuICAgICAgICBkZXZpY2UudXBkYXRlRW5kKCk7XG5cbiAgICAgICAgLy8gUmVzdG9yZSByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGRldmljZS5zZXRSZW5kZXJUYXJnZXQob3JpZ1JlbmRlclRhcmdldCk7XG5cbiAgICAgICAgRGVidWdHcmFwaGljcy5wb3BHcHVNYXJrZXIoZGV2aWNlKTtcblxuICAgICAgICBjb25zdCBtYXBwaW5nID0gdGhpcy5tYXBwaW5nO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHdpZHRoICogaGVpZ2h0OyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHIgPSBwaXhlbHNbNCAqIGkgKyAwXTtcbiAgICAgICAgICAgIGNvbnN0IGcgPSBwaXhlbHNbNCAqIGkgKyAxXTtcbiAgICAgICAgICAgIGNvbnN0IGIgPSBwaXhlbHNbNCAqIGkgKyAyXTtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gciA8PCAxNiB8IGcgPDwgOCB8IGI7XG5cbiAgICAgICAgICAgIC8vIFdoaXRlIGlzICdubyBzZWxlY3Rpb24nXG4gICAgICAgICAgICBpZiAoaW5kZXggIT09IDB4ZmZmZmZmKSB7XG4gICAgICAgICAgICAgICAgdGVtcFNldC5hZGQobWFwcGluZ1tpbmRleF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gcmV0dXJuIHRoZSBjb250ZW50IG9mIHRoZSBzZXQgYXMgYW4gYXJyYXlcbiAgICAgICAgY29uc3Qgc2VsZWN0aW9uID0gW107XG4gICAgICAgIHRlbXBTZXQuZm9yRWFjaChtZXNoSW5zdGFuY2UgPT4gc2VsZWN0aW9uLnB1c2gobWVzaEluc3RhbmNlKSk7XG4gICAgICAgIHRlbXBTZXQuY2xlYXIoKTtcblxuICAgICAgICByZXR1cm4gc2VsZWN0aW9uO1xuICAgIH1cblxuICAgIGFsbG9jYXRlUmVuZGVyVGFyZ2V0KCkge1xuXG4gICAgICAgIGNvbnN0IGNvbG9yQnVmZmVyID0gbmV3IFRleHR1cmUodGhpcy5kZXZpY2UsIHtcbiAgICAgICAgICAgIGZvcm1hdDogUElYRUxGT1JNQVRfUjhfRzhfQjhfQTgsXG4gICAgICAgICAgICB3aWR0aDogdGhpcy53aWR0aCxcbiAgICAgICAgICAgIGhlaWdodDogdGhpcy5oZWlnaHQsXG4gICAgICAgICAgICBtaXBtYXBzOiBmYWxzZSxcbiAgICAgICAgICAgIG1pbkZpbHRlcjogRklMVEVSX05FQVJFU1QsXG4gICAgICAgICAgICBtYWdGaWx0ZXI6IEZJTFRFUl9ORUFSRVNULFxuICAgICAgICAgICAgYWRkcmVzc1U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgIGFkZHJlc3NWOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICBuYW1lOiAncGljaydcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5yZW5kZXJUYXJnZXQgPSBuZXcgUmVuZGVyVGFyZ2V0KHtcbiAgICAgICAgICAgIGNvbG9yQnVmZmVyOiBjb2xvckJ1ZmZlcixcbiAgICAgICAgICAgIGRlcHRoOiB0cnVlXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJlbGVhc2VSZW5kZXJUYXJnZXQoKSB7XG5cbiAgICAgICAgLy8gdW5zZXQgaXQgZnJvbSB0aGUgY2FtZXJhXG4gICAgICAgIHRoaXMuY2FtZXJhRW50aXR5LmNhbWVyYS5yZW5kZXJUYXJnZXQgPSBudWxsO1xuXG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJUYXJnZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlclRhcmdldC5kZXN0cm95VGV4dHVyZUJ1ZmZlcnMoKTtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlclRhcmdldC5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaW5pdExheWVyQ29tcG9zaXRpb24oKSB7XG5cbiAgICAgICAgY29uc3QgZGV2aWNlID0gdGhpcy5kZXZpY2U7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICBjb25zdCBwaWNrQ29sb3JJZCA9IGRldmljZS5zY29wZS5yZXNvbHZlKCd1Q29sb3InKTtcblxuICAgICAgICAvLyBjYW1lcmFcbiAgICAgICAgdGhpcy5jYW1lcmFFbnRpdHkgPSBuZXcgRW50aXR5KCk7XG4gICAgICAgIHRoaXMuY2FtZXJhRW50aXR5LmFkZENvbXBvbmVudCgnY2FtZXJhJyk7XG5cbiAgICAgICAgLy8gbGF5ZXIgYWxsIG1lc2hlcyByZW5kZXJlZCBmb3IgcGlja2luZyBhdCBhZGRlZCB0b1xuICAgICAgICB0aGlzLmxheWVyID0gbmV3IExheWVyKHtcbiAgICAgICAgICAgIG5hbWU6ICdQaWNrZXInLFxuICAgICAgICAgICAgc2hhZGVyUGFzczogU0hBREVSX1BJQ0ssXG4gICAgICAgICAgICBvcGFxdWVTb3J0TW9kZTogU09SVE1PREVfTk9ORSxcblxuICAgICAgICAgICAgLy8gZXhlY3V0ZXMganVzdCBiZWZvcmUgdGhlIG1lc2ggaXMgcmVuZGVyZWQuIEFuZCBpbmRleCBlbmNvZGVkIGluIHJnYiBpcyBhc3NpZ25lZCB0byBpdFxuICAgICAgICAgICAgb25EcmF3Q2FsbDogZnVuY3Rpb24gKG1lc2hJbnN0YW5jZSwgaW5kZXgpIHtcbiAgICAgICAgICAgICAgICBzZWxmLnBpY2tDb2xvclswXSA9ICgoaW5kZXggPj4gMTYpICYgMHhmZikgLyAyNTU7XG4gICAgICAgICAgICAgICAgc2VsZi5waWNrQ29sb3JbMV0gPSAoKGluZGV4ID4+IDgpICYgMHhmZikgLyAyNTU7XG4gICAgICAgICAgICAgICAgc2VsZi5waWNrQ29sb3JbMl0gPSAoaW5kZXggJiAweGZmKSAvIDI1NTtcbiAgICAgICAgICAgICAgICBwaWNrQ29sb3JJZC5zZXRWYWx1ZShzZWxmLnBpY2tDb2xvcik7XG4gICAgICAgICAgICAgICAgZGV2aWNlLnNldEJsZW5kaW5nKGZhbHNlKTtcblxuICAgICAgICAgICAgICAgIC8vIGtlZXAgdGhlIGluZGV4IC0+IG1lc2hJbnN0YW5jZSBpbmRleCBtYXBwaW5nXG4gICAgICAgICAgICAgICAgc2VsZi5tYXBwaW5nW2luZGV4XSA9IG1lc2hJbnN0YW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMubGF5ZXIuYWRkQ2FtZXJhKHRoaXMuY2FtZXJhRW50aXR5LmNhbWVyYSk7XG5cbiAgICAgICAgLy8gY29tcG9zaXRpb25cbiAgICAgICAgdGhpcy5sYXllckNvbXAgPSBuZXcgTGF5ZXJDb21wb3NpdGlvbigncGlja2VyJyk7XG4gICAgICAgIHRoaXMubGF5ZXJDb21wLnB1c2hPcGFxdWUodGhpcy5sYXllcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJpbWVzIHRoZSBwaWNrIGJ1ZmZlciB3aXRoIGEgcmVuZGVyaW5nIG9mIHRoZSBzcGVjaWZpZWQgbW9kZWxzIGZyb20gdGhlIHBvaW50IG9mIHZpZXcgb2ZcbiAgICAgKiB0aGUgc3VwcGxpZWQgY2FtZXJhLiBPbmNlIHRoZSBwaWNrIGJ1ZmZlciBoYXMgYmVlbiBwcmVwYXJlZCwge0BsaW5rIFBpY2tlciNnZXRTZWxlY3Rpb259IGNhblxuICAgICAqIGJlIGNhbGxlZCBtdWx0aXBsZSB0aW1lcyBvbiB0aGUgc2FtZSBwaWNrZXIgb2JqZWN0LiBUaGVyZWZvcmUsIGlmIHRoZSBtb2RlbHMgb3IgY2FtZXJhIGRvXG4gICAgICogbm90IGNoYW5nZSBpbiBhbnkgd2F5LCB7QGxpbmsgUGlja2VyI3ByZXBhcmV9IGRvZXMgbm90IG5lZWQgdG8gYmUgY2FsbGVkIGFnYWluLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtDYW1lcmFDb21wb25lbnR9IGNhbWVyYSAtIFRoZSBjYW1lcmEgY29tcG9uZW50IHVzZWQgdG8gcmVuZGVyIHRoZSBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge1NjZW5lfSBzY2VuZSAtIFRoZSBzY2VuZSBjb250YWluaW5nIHRoZSBwaWNrYWJsZSBtZXNoIGluc3RhbmNlcy5cbiAgICAgKiBAcGFyYW0ge0xheWVyW119IFtsYXllcnNdIC0gTGF5ZXJzIGZyb20gd2hpY2ggb2JqZWN0cyB3aWxsIGJlIHBpY2tlZC4gSWYgbm90IHN1cHBsaWVkLCBhbGwgbGF5ZXJzIG9mIHRoZSBzcGVjaWZpZWQgY2FtZXJhIHdpbGwgYmUgdXNlZC5cbiAgICAgKi9cbiAgICBwcmVwYXJlKGNhbWVyYSwgc2NlbmUsIGxheWVycykge1xuXG4gICAgICAgIC8vIGhhbmRsZSBkZXByZWNhdGVkIGFyZ3VtZW50c1xuICAgICAgICBpZiAoY2FtZXJhIGluc3RhbmNlb2YgQ2FtZXJhKSB7XG4gICAgICAgICAgICBEZWJ1Zy5kZXByZWNhdGVkKCdwYy5QaWNrZXIjcHJlcGFyZSBub3cgdGFrZXMgcGMuQ2FtZXJhQ29tcG9uZW50IGFzIGZpcnN0IGFyZ3VtZW50LiBQYXNzaW5nIHBjLkNhbWVyYSBpcyBkZXByZWNhdGVkLicpO1xuXG4gICAgICAgICAgICAvLyBHZXQgdGhlIGNhbWVyYSBjb21wb25lbnRcbiAgICAgICAgICAgIGNhbWVyYSA9IGNhbWVyYS5ub2RlLmNhbWVyYTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYXllcnMgaW5zdGFuY2VvZiBMYXllcikge1xuICAgICAgICAgICAgbGF5ZXJzID0gW2xheWVyc107XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwb3B1bGF0ZSB0aGUgbGF5ZXIgd2l0aCBtZXNoZXMgYW5kIGRlcHRoIGNsZWFyIGNvbW1hbmRzXG4gICAgICAgIHRoaXMubGF5ZXIuY2xlYXJNZXNoSW5zdGFuY2VzKCk7XG4gICAgICAgIGNvbnN0IGRlc3RNZXNoSW5zdGFuY2VzID0gdGhpcy5sYXllci5vcGFxdWVNZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgIC8vIHNvdXJjZSBtZXNoIGluc3RhbmNlc1xuICAgICAgICBjb25zdCBzcmNMYXllcnMgPSBzY2VuZS5sYXllcnMubGF5ZXJMaXN0O1xuICAgICAgICBjb25zdCBzdWJMYXllckVuYWJsZWQgPSBzY2VuZS5sYXllcnMuc3ViTGF5ZXJFbmFibGVkO1xuICAgICAgICBjb25zdCBpc1RyYW5zcGFyZW50ID0gc2NlbmUubGF5ZXJzLnN1YkxheWVyTGlzdDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNyY0xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc3JjTGF5ZXIgPSBzcmNMYXllcnNbaV07XG5cbiAgICAgICAgICAgIC8vIHNraXAgdGhlIGxheWVyIGlmIGl0IGRvZXMgbm90IG1hdGNoIHRoZSBwcm92aWRlZCBvbmVzXG4gICAgICAgICAgICBpZiAobGF5ZXJzICYmIGxheWVycy5pbmRleE9mKHNyY0xheWVyKSA8IDApIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNyY0xheWVyLmVuYWJsZWQgJiYgc3ViTGF5ZXJFbmFibGVkW2ldKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGUgbGF5ZXIgaXMgcmVuZGVyZWQgYnkgdGhlIGNhbWVyYVxuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyQ2FtSWQgPSBzcmNMYXllci5jYW1lcmFzLmluZGV4T2YoY2FtZXJhKTtcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXJDYW1JZCA+PSAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gaWYgdGhlIGxheWVyIGNsZWFycyB0aGUgZGVwdGgsIGFkZCBjb21tYW5kIHRvIGNsZWFyIGl0XG4gICAgICAgICAgICAgICAgICAgIGlmIChzcmNMYXllci5fY2xlYXJEZXB0aEJ1ZmZlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVzdE1lc2hJbnN0YW5jZXMucHVzaCh0aGlzLmNsZWFyRGVwdGhDb21tYW5kKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvcHkgYWxsIHBpY2thYmxlIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBpc1RyYW5zcGFyZW50W2ldID8gc3JjTGF5ZXIuaW5zdGFuY2VzLnRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyA6IHNyY0xheWVyLmluc3RhbmNlcy5vcGFxdWVNZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG1lc2hJbnN0YW5jZXNbal07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWVzaEluc3RhbmNlLnBpY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXN0TWVzaEluc3RhbmNlcy5wdXNoKG1lc2hJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBtYWtlIHRoZSByZW5kZXIgdGFyZ2V0IHRoZSByaWdodCBzaXplXG4gICAgICAgIGlmICghdGhpcy5yZW5kZXJUYXJnZXQgfHwgKHRoaXMud2lkdGggIT09IHRoaXMucmVuZGVyVGFyZ2V0LndpZHRoIHx8IHRoaXMuaGVpZ2h0ICE9PSB0aGlzLnJlbmRlclRhcmdldC5oZWlnaHQpKSB7XG4gICAgICAgICAgICB0aGlzLnJlbGVhc2VSZW5kZXJUYXJnZXQoKTtcbiAgICAgICAgICAgIHRoaXMuYWxsb2NhdGVSZW5kZXJUYXJnZXQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHByZXBhcmUgdGhlIHJlbmRlcmluZyBjYW1lcmFcbiAgICAgICAgdGhpcy51cGRhdGVDYW1lcmEoY2FtZXJhKTtcblxuICAgICAgICAvLyBjbGVhciByZWdpc3RlcmVkIG1lc2hlcyBtYXBwaW5nXG4gICAgICAgIHRoaXMubWFwcGluZy5sZW5ndGggPSAwO1xuXG4gICAgICAgIC8vIHJlbmRlclxuICAgICAgICB0aGlzLmFwcC5yZW5kZXJDb21wb3NpdGlvbih0aGlzLmxheWVyQ29tcCk7XG4gICAgfVxuXG4gICAgdXBkYXRlQ2FtZXJhKHNyY0NhbWVyYSkge1xuXG4gICAgICAgIC8vIGNvcHkgdHJhbnNmb3JtXG4gICAgICAgIHRoaXMuY2FtZXJhRW50aXR5LmNvcHkoc3JjQ2FtZXJhLmVudGl0eSk7XG4gICAgICAgIHRoaXMuY2FtZXJhRW50aXR5Lm5hbWUgPSAnUGlja2VyQ2FtZXJhJztcblxuICAgICAgICAvLyBjb3B5IGNhbWVyYSBjb21wb25lbnQgcHJvcGVydGllcyAtIHdoaWNoIG92ZXJ3cml0ZXMgZmV3IHByb3BlcnRpZXMgd2UgY2hhbmdlIHRvIHdoYXQgaXMgbmVlZGVkIGxhdGVyXG4gICAgICAgIGNvbnN0IGRlc3RDYW1lcmEgPSB0aGlzLmNhbWVyYUVudGl0eS5jYW1lcmE7XG4gICAgICAgIGRlc3RDYW1lcmEuY29weShzcmNDYW1lcmEpO1xuXG4gICAgICAgIC8vIHNldCB1cCBjbGVhcnNcbiAgICAgICAgZGVzdENhbWVyYS5jbGVhckNvbG9yQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgZGVzdENhbWVyYS5jbGVhckRlcHRoQnVmZmVyID0gdHJ1ZTtcbiAgICAgICAgZGVzdENhbWVyYS5jbGVhclN0ZW5jaWxCdWZmZXIgPSB0cnVlO1xuICAgICAgICBkZXN0Q2FtZXJhLmNsZWFyQ29sb3IgPSBDb2xvci5XSElURTtcblxuICAgICAgICAvLyByZW5kZXIgdGFyZ2V0XG4gICAgICAgIGRlc3RDYW1lcmEucmVuZGVyVGFyZ2V0ID0gdGhpcy5yZW5kZXJUYXJnZXQ7XG5cbiAgICAgICAgLy8gbGF5ZXJzXG4gICAgICAgIHRoaXMubGF5ZXIuY2xlYXJDYW1lcmFzKCk7XG4gICAgICAgIHRoaXMubGF5ZXIuYWRkQ2FtZXJhKGRlc3RDYW1lcmEpO1xuICAgICAgICBkZXN0Q2FtZXJhLmxheWVycyA9IFt0aGlzLmxheWVyLmlkXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBwaWNrIGJ1ZmZlci4gVGhlIHBpY2sgYnVmZmVyIHJlc29sdXRpb24gZG9lcyBub3QgbmVlZCB0byBtYXRjaFxuICAgICAqIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBjb3JyZXNwb25kaW5nIGZyYW1lIGJ1ZmZlciB1c2UgZm9yIGdlbmVyYWwgcmVuZGVyaW5nIG9mIHRoZSAzRCBzY2VuZS5cbiAgICAgKiBIb3dldmVyLCB0aGUgbG93ZXIgdGhlIHJlc29sdXRpb24gb2YgdGhlIHBpY2sgYnVmZmVyLCB0aGUgbGVzcyBhY2N1cmF0ZSB0aGUgc2VsZWN0aW9uXG4gICAgICogcmVzdWx0cyByZXR1cm5lZCBieSB7QGxpbmsgUGlja2VyI2dldFNlbGVjdGlvbn0uIE9uIHRoZSBvdGhlciBoYW5kLCBzbWFsbGVyIHBpY2sgYnVmZmVyc1xuICAgICAqIHdpbGwgeWllbGQgZ3JlYXRlciBwZXJmb3JtYW5jZSwgc28gdGhlcmUgaXMgYSB0cmFkZSBvZmYuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2lkdGggLSBUaGUgd2lkdGggb2YgdGhlIHBpY2sgYnVmZmVyIGluIHBpeGVscy5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaGVpZ2h0IC0gVGhlIGhlaWdodCBvZiB0aGUgcGljayBidWZmZXIgaW4gcGl4ZWxzLlxuICAgICAqL1xuICAgIHJlc2l6ZSh3aWR0aCwgaGVpZ2h0KSB7XG4gICAgICAgIHRoaXMud2lkdGggPSBNYXRoLmZsb29yKHdpZHRoKTtcbiAgICAgICAgdGhpcy5oZWlnaHQgPSBNYXRoLmZsb29yKGhlaWdodCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBQaWNrZXIgfTtcbiJdLCJuYW1lcyI6WyJ0ZW1wU2V0IiwiU2V0IiwiY2xlYXJEZXB0aE9wdGlvbnMiLCJkZXB0aCIsImZsYWdzIiwiQ0xFQVJGTEFHX0RFUFRIIiwiUGlja2VyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJ3aWR0aCIsImhlaWdodCIsIkdyYXBoaWNzRGV2aWNlIiwiZ2V0QXBwbGljYXRpb24iLCJEZWJ1ZyIsImRlcHJlY2F0ZWQiLCJkZXZpY2UiLCJncmFwaGljc0RldmljZSIsInBpY2tDb2xvciIsIkZsb2F0MzJBcnJheSIsIm1hcHBpbmciLCJjYW1lcmFFbnRpdHkiLCJsYXllciIsImxheWVyQ29tcCIsImluaXRMYXllckNvbXBvc2l0aW9uIiwiX3JlbmRlclRhcmdldCIsImNsZWFyRGVwdGhDb21tYW5kIiwiQ29tbWFuZCIsImNsZWFyIiwicmVzaXplIiwiZ2V0U2VsZWN0aW9uIiwieCIsInkiLCJyZWN0IiwicmVuZGVyVGFyZ2V0IiwiTWF0aCIsImZsb29yIiwibWF4Iiwib3JpZ1JlbmRlclRhcmdldCIsIkRlYnVnR3JhcGhpY3MiLCJwdXNoR3B1TWFya2VyIiwic2V0UmVuZGVyVGFyZ2V0IiwidXBkYXRlQmVnaW4iLCJwaXhlbHMiLCJVaW50OEFycmF5IiwicmVhZFBpeGVscyIsInVwZGF0ZUVuZCIsInBvcEdwdU1hcmtlciIsImkiLCJyIiwiZyIsImIiLCJpbmRleCIsImFkZCIsInNlbGVjdGlvbiIsImZvckVhY2giLCJtZXNoSW5zdGFuY2UiLCJwdXNoIiwiYWxsb2NhdGVSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsIlRleHR1cmUiLCJmb3JtYXQiLCJQSVhFTEZPUk1BVF9SOF9HOF9COF9BOCIsIm1pcG1hcHMiLCJtaW5GaWx0ZXIiLCJGSUxURVJfTkVBUkVTVCIsIm1hZ0ZpbHRlciIsImFkZHJlc3NVIiwiQUREUkVTU19DTEFNUF9UT19FREdFIiwiYWRkcmVzc1YiLCJuYW1lIiwiUmVuZGVyVGFyZ2V0IiwicmVsZWFzZVJlbmRlclRhcmdldCIsImNhbWVyYSIsImRlc3Ryb3lUZXh0dXJlQnVmZmVycyIsImRlc3Ryb3kiLCJzZWxmIiwicGlja0NvbG9ySWQiLCJzY29wZSIsInJlc29sdmUiLCJFbnRpdHkiLCJhZGRDb21wb25lbnQiLCJMYXllciIsInNoYWRlclBhc3MiLCJTSEFERVJfUElDSyIsIm9wYXF1ZVNvcnRNb2RlIiwiU09SVE1PREVfTk9ORSIsIm9uRHJhd0NhbGwiLCJzZXRWYWx1ZSIsInNldEJsZW5kaW5nIiwiYWRkQ2FtZXJhIiwiTGF5ZXJDb21wb3NpdGlvbiIsInB1c2hPcGFxdWUiLCJwcmVwYXJlIiwic2NlbmUiLCJsYXllcnMiLCJDYW1lcmEiLCJub2RlIiwiY2xlYXJNZXNoSW5zdGFuY2VzIiwiZGVzdE1lc2hJbnN0YW5jZXMiLCJvcGFxdWVNZXNoSW5zdGFuY2VzIiwic3JjTGF5ZXJzIiwibGF5ZXJMaXN0Iiwic3ViTGF5ZXJFbmFibGVkIiwiaXNUcmFuc3BhcmVudCIsInN1YkxheWVyTGlzdCIsImxlbmd0aCIsInNyY0xheWVyIiwiaW5kZXhPZiIsImVuYWJsZWQiLCJsYXllckNhbUlkIiwiY2FtZXJhcyIsIl9jbGVhckRlcHRoQnVmZmVyIiwibWVzaEluc3RhbmNlcyIsImluc3RhbmNlcyIsInRyYW5zcGFyZW50TWVzaEluc3RhbmNlcyIsImoiLCJwaWNrIiwidXBkYXRlQ2FtZXJhIiwicmVuZGVyQ29tcG9zaXRpb24iLCJzcmNDYW1lcmEiLCJjb3B5IiwiZW50aXR5IiwiZGVzdENhbWVyYSIsImNsZWFyQ29sb3JCdWZmZXIiLCJjbGVhckRlcHRoQnVmZmVyIiwiY2xlYXJTdGVuY2lsQnVmZmVyIiwiY2xlYXJDb2xvciIsIkNvbG9yIiwiV0hJVEUiLCJjbGVhckNhbWVyYXMiLCJpZCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF1QkEsTUFBTUEsT0FBTyxHQUFHLElBQUlDLEdBQUosRUFBaEIsQ0FBQTtBQUVBLE1BQU1DLGlCQUFpQixHQUFHO0FBQ3RCQyxFQUFBQSxLQUFLLEVBQUUsR0FEZTtBQUV0QkMsRUFBQUEsS0FBSyxFQUFFQyxlQUFBQTtBQUZlLENBQTFCLENBQUE7O0FBYUEsTUFBTUMsTUFBTixDQUFhO0FBUVRDLEVBQUFBLFdBQVcsQ0FBQ0MsR0FBRCxFQUFNQyxLQUFOLEVBQWFDLE1BQWIsRUFBcUI7SUFDNUIsSUFBSUYsR0FBRyxZQUFZRyxjQUFuQixFQUFtQztNQUMvQkgsR0FBRyxHQUFHSSxjQUFjLEVBQXBCLENBQUE7TUFDQUMsS0FBSyxDQUFDQyxVQUFOLENBQWlCLDRGQUFqQixDQUFBLENBQUE7QUFDSCxLQUFBOztJQUVELElBQUtOLENBQUFBLEdBQUwsR0FBV0EsR0FBWCxDQUFBO0FBQ0EsSUFBQSxJQUFBLENBQUtPLE1BQUwsR0FBY1AsR0FBRyxDQUFDUSxjQUFsQixDQUFBO0FBR0EsSUFBQSxJQUFBLENBQUtDLFNBQUwsR0FBaUIsSUFBSUMsWUFBSixDQUFpQixDQUFqQixDQUFqQixDQUFBO0FBQ0EsSUFBQSxJQUFBLENB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