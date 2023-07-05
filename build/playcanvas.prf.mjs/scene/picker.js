/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision 1331860ee (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Color } from '../core/math/color.js';
import { PIXELFORMAT_R8_G8_B8_A8, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, CLEARFLAG_DEPTH } from '../platform/graphics/constants.js';
import { GraphicsDevice } from '../platform/graphics/graphics-device.js';
import { RenderTarget } from '../platform/graphics/render-target.js';
import { Texture } from '../platform/graphics/texture.js';
import { SHADER_PICK, SORTMODE_NONE } from './constants.js';
import { Camera } from './camera.js';
import { Command } from './mesh-instance.js';
import { Layer } from './layer.js';
import { LayerComposition } from './composition/layer-composition.js';
import { getApplication } from '../framework/globals.js';
import { Entity } from '../framework/entity.js';
import '../core/tracing.js';

const tempSet = new Set();
const clearDepthOptions = {
  depth: 1.0,
  flags: CLEARFLAG_DEPTH
};

class Picker {
  constructor(app, width, height) {
    if (app instanceof GraphicsDevice) {
      app = getApplication();
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
    device.setRenderTarget(this.renderTarget);
    device.updateBegin();
    const pixels = new Uint8Array(4 * width * height);
    device.readPixels(x, y, width, height, pixels);
    device.updateEnd();
    device.setRenderTarget(origRenderTarget);
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
