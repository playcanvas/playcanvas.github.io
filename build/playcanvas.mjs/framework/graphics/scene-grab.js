import { PIXELFORMAT_RGBA8, PIXELFORMAT_RGB8, FILTER_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR, ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_DEPTHSTENCIL } from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { LAYERID_DEPTH, SHADER_DEPTH, LAYERID_WORLD } from '../../scene/constants.js';
import { Layer } from '../../scene/layer.js';

const _depthUniformNames = ['uSceneDepthMap', 'uDepthMap'];
const _colorUniformNames = ['uSceneColorMap', 'texture_grabPass'];

class SceneGrab {
  constructor(application) {
    this.application = application;

    this.device = application.graphicsDevice;

    this.layer = null;

    this.colorFormat = this.device.defaultFramebufferAlpha ? PIXELFORMAT_RGBA8 : PIXELFORMAT_RGB8;

    if (this.device.webgl2) {
      this.initWebGl2();
    } else {
      this.initWebGl1();
    }
  }
  setupUniform(device, depth, buffer) {
    const names = depth ? _depthUniformNames : _colorUniformNames;
    names.forEach(name => device.scope.resolve(name).setValue(buffer));
  }
  allocateTexture(device, source, name, format, isDepth, mipmaps) {
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
  resizeCondition(target, source, device) {
    const width = (source == null ? void 0 : source.width) || device.width;
    const height = (source == null ? void 0 : source.height) || device.height;
    return !target || width !== target.width || height !== target.height;
  }
  allocateRenderTarget(renderTarget, sourceRenderTarget, device, format, isDepth, mipmaps, isDepthUniforms) {
    const names = isDepthUniforms ? _depthUniformNames : _colorUniformNames;

    const buffer = this.allocateTexture(device, sourceRenderTarget, names[0], format, isDepth, mipmaps);
    if (renderTarget) {
      renderTarget.destroyFrameBuffers();

      if (isDepth) {
        renderTarget._depthBuffer = buffer;
      } else {
        renderTarget._colorBuffer = buffer;
      }
    } else {
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
  initWebGl2() {
    const app = this.application;
    const self = this;

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

        const device = app.graphicsDevice;

        const camera = this.cameras[cameraPass];
        if (camera.renderSceneColorMap) {
          var _camera$renderTarget;
          if (self.resizeCondition(this.colorRenderTarget, (_camera$renderTarget = camera.renderTarget) == null ? void 0 : _camera$renderTarget.colorBuffer, device)) {
            self.releaseRenderTarget(this.colorRenderTarget);
            this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, this.colorFormat, false, true, false);
          }

          device.copyRenderTarget(device.renderTarget, this.colorRenderTarget, true, false);

          device.activeTexture(device.maxCombinedTextures - 1);
          const colorBuffer = this.colorRenderTarget.colorBuffer;
          device.bindTexture(colorBuffer);
          device.gl.generateMipmap(colorBuffer.impl._glTarget);

          self.setupUniform(device, false, colorBuffer);
        }
        if (camera.renderSceneDepthMap) {
          var _camera$renderTarget2;
          if (self.resizeCondition(this.depthRenderTarget, (_camera$renderTarget2 = camera.renderTarget) == null ? void 0 : _camera$renderTarget2.depthBuffer, device)) {
            self.releaseRenderTarget(this.depthRenderTarget);
            this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, PIXELFORMAT_DEPTHSTENCIL, true, false, true);
          }

          device.copyRenderTarget(device.renderTarget, this.depthRenderTarget, false, true);

          self.setupUniform(device, true, this.depthRenderTarget.depthBuffer);
        }
      },
      onPostRenderOpaque: function (cameraPass) {}
    });
  }
  initWebGl1() {
    const app = this.application;
    const self = this;

    this.layer = new Layer({
      enabled: false,
      name: "Depth",
      id: LAYERID_DEPTH,
      shaderPass: SHADER_DEPTH,
      onEnable: function () {
        this.depthRenderTarget = new RenderTarget({
          name: 'depthRenderTarget-webgl1',
          depth: true,
          stencil: app.graphicsDevice.supportsStencil,
          autoResolve: false,
          graphicsDevice: app.graphicsDevice
        });

        this.renderTarget = this.depthRenderTarget;
      },
      onDisable: function () {
        this.depthRenderTarget.destroyTextureBuffers();
        this.renderTarget = null;
        self.releaseRenderTarget(this.colorRenderTarget);
        this.colorRenderTarget = null;
      },
      onPostCull: function (cameraPass) {
        const device = app.graphicsDevice;

        const camera = this.cameras[cameraPass];
        if (camera.renderSceneDepthMap) {
          var _camera$renderTarget3;
          if (self.resizeCondition(this.depthRenderTarget, (_camera$renderTarget3 = camera.renderTarget) == null ? void 0 : _camera$renderTarget3.depthBuffer, device)) {
            this.depthRenderTarget.destroyTextureBuffers();
            this.depthRenderTarget = self.allocateRenderTarget(this.depthRenderTarget, camera.renderTarget, device, PIXELFORMAT_RGBA8, false, false, true);
          }

          const visibleObjects = this.instances.visibleOpaque[cameraPass];
          const visibleList = visibleObjects.list;
          const layerComposition = app.scene.layers;
          const subLayerEnabled = layerComposition.subLayerEnabled;
          const isTransparent = layerComposition.subLayerList;

          const rt = app.scene.layers.getLayerById(LAYERID_WORLD).renderTarget;
          const cam = this.cameras[cameraPass];
          let visibleLength = 0;
          const layers = layerComposition.layerList;
          for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer === this) break;
            if (layer.renderTarget !== rt || !layer.enabled || !subLayerEnabled[i]) continue;
            const layerCamId = layer.cameras.indexOf(cam);
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
        const device = app.graphicsDevice;

        const camera = this.cameras[cameraPass];
        if (camera.renderSceneColorMap) {
          var _camera$renderTarget4;
          if (self.resizeCondition(this.colorRenderTarget, (_camera$renderTarget4 = camera.renderTarget) == null ? void 0 : _camera$renderTarget4.colorBuffer, device)) {
            self.releaseRenderTarget(this.colorRenderTarget);
            this.colorRenderTarget = self.allocateRenderTarget(this.colorRenderTarget, camera.renderTarget, device, this.colorFormat, false, false, false);
          }

          const colorBuffer = this.colorRenderTarget._colorBuffer;
          if (!colorBuffer.impl._glTexture) {
            colorBuffer.impl.initialize(device, colorBuffer);
          }

          device.bindTexture(colorBuffer);
          const gl = device.gl;
          gl.copyTexImage2D(gl.TEXTURE_2D, 0, colorBuffer.impl._glFormat, 0, 0, colorBuffer.width, colorBuffer.height, 0);

          colorBuffer._needsUpload = false;
          colorBuffer._needsMipmapsUpload = false;

          self.setupUniform(device, false, colorBuffer);
        }
        if (camera.renderSceneDepthMap) {
          self.setupUniform(device, true, this.depthRenderTarget.colorBuffer);
        }
      },
      onDrawCall: function () {
        app.graphicsDevice.setColorWrite(true, true, true, true);
      },
      onPostRenderOpaque: function (cameraPass) {
        const camera = this.cameras[cameraPass];
        if (camera.renderSceneDepthMap) {
          const visibleObjects = this.instances.visibleOpaque[cameraPass];
          visibleObjects.length = 0;
        }
      }
    });
  }

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
