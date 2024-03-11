/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 2a805ddb9
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { RenderPass, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F, Texture, FILTER_NEAREST, ADDRESS_CLAMP_TO_EDGE, RenderTarget, LAYERID_DEPTH, SHADER_PREPASS_VELOCITY } from 'playcanvas';

const tempMeshInstances = [];
const DEPTH_UNIFORM_NAME = 'uSceneDepthMap';
const VELOCITY_UNIFORM_NAME = 'uSceneVelocityMap';
class RenderPassPrepass extends RenderPass {
  constructor(device, scene, renderer, camera, depthBuffer, options) {
    super(device);
    this.viewBindGroups = [];
    this.velocityTexture = void 0;
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.setupRenderTarget(depthBuffer, options);
  }
  destroy() {
    var _this$renderTarget, _this$velocityTexture;
    super.destroy();
    (_this$renderTarget = this.renderTarget) == null || _this$renderTarget.destroy();
    this.renderTarget = null;
    (_this$velocityTexture = this.velocityTexture) == null || _this$velocityTexture.destroy();
    this.velocityTexture = null;
    this.viewBindGroups.forEach(bg => {
      bg.defaultUniformBuffer.destroy();
      bg.destroy();
    });
    this.viewBindGroups.length = 0;
  }
  setupRenderTarget(depthBuffer, options) {
    const {
      device
    } = this;
    const velocityFormat = device.getRenderableHdrFormat([PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F]);
    this.velocityTexture = new Texture(device, {
      name: 'VelocityTexture',
      width: 4,
      height: 4,
      format: velocityFormat,
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_CLAMP_TO_EDGE,
      addressV: ADDRESS_CLAMP_TO_EDGE
    });
    const renderTarget = new RenderTarget({
      name: 'PrepassRT',
      depthBuffer: depthBuffer
    });
    this.init(renderTarget, options);
    this.depthStencilOps.storeDepth = true;
  }
  after() {
    this.device.scope.resolve(DEPTH_UNIFORM_NAME).setValue(this.renderTarget.depthBuffer);
    this.device.scope.resolve(VELOCITY_UNIFORM_NAME).setValue(this.velocityTexture);
  }
  execute() {
    const {
      renderer,
      scene,
      renderTarget
    } = this;
    const camera = this.camera.camera;
    const layers = scene.layers.layerList;
    const subLayerEnabled = scene.layers.subLayerEnabled;
    const isTransparent = scene.layers.subLayerList;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (layer.enabled && subLayerEnabled[i]) {
        if (layer.camerasSet.has(camera)) {
          if (layer.id === LAYERID_DEPTH) break;
          const culledInstances = layer.getCulledInstances(camera);
          const meshInstances = isTransparent[i] ? culledInstances.transparent : culledInstances.opaque;
          for (let j = 0; j < meshInstances.length; j++) {
            var _meshInstance$materia;
            const meshInstance = meshInstances[j];
            if ((_meshInstance$materia = meshInstance.material) != null && _meshInstance$materia.depthWrite) {
              tempMeshInstances.push(meshInstance);
            }
          }
          renderer.renderForwardLayer(camera, renderTarget, null, undefined, SHADER_PREPASS_VELOCITY, this.viewBindGroups, {
            meshInstances: tempMeshInstances
          });
          tempMeshInstances.length = 0;
        }
      }
    }
  }
  frameUpdate() {
    super.frameUpdate();
    const {
      camera
    } = this;
    this.setClearDepth(camera.clearDepthBuffer ? 1 : undefined);
  }
}

export { RenderPassPrepass };
