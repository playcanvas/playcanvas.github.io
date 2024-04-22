import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderAction } from '../composition/render-action.js';

class RenderPassForward extends RenderPass {
  constructor(device, layerComposition, scene, renderer) {
    super(device);
    this.layerComposition = void 0;
    this.scene = void 0;
    this.renderer = void 0;
    this.renderActions = [];
    this.noDepthClear = false;
    this.layerComposition = layerComposition;
    this.scene = scene;
    this.renderer = renderer;
  }
  addRenderAction(renderAction) {
    this.renderActions.push(renderAction);
  }
  addLayer(cameraComponent, layer, transparent, autoClears = true) {
    const ra = new RenderAction();
    ra.renderTarget = this.renderTarget;
    ra.camera = cameraComponent;
    ra.layer = layer;
    ra.transparent = transparent;
    if (autoClears) {
      const firstRa = this.renderActions.length === 0;
      ra.setupClears(firstRa ? cameraComponent : undefined, layer);
    }
    this.addRenderAction(ra);
  }
  addLayers(composition, cameraComponent, startIndex, firstLayerClears, lastLayerId, lastLayerIsTransparent = true) {
    const {
      layerList,
      subLayerEnabled,
      subLayerList
    } = composition;
    let clearRenderTarget = firstLayerClears;
    let index = startIndex;
    while (index < layerList.length) {
      const layer = layerList[index];
      const isTransparent = subLayerList[index];
      const enabled = layer.enabled && subLayerEnabled[index];
      const renderedbyCamera = cameraComponent.camera.layersSet.has(layer.id);
      if (enabled && renderedbyCamera) {
        this.addLayer(cameraComponent, layer, isTransparent, clearRenderTarget);
        clearRenderTarget = false;
      }
      index++;
      if (layer.id === lastLayerId && isTransparent === lastLayerIsTransparent) {
        break;
      }
    }
    return index;
  }
  updateDirectionalShadows() {
    const {
      renderer,
      renderActions
    } = this;
    for (let i = 0; i < renderActions.length; i++) {
      const renderAction = renderActions[i];
      const cameraComp = renderAction.camera;
      const camera = cameraComp.camera;
      const shadowDirLights = this.renderer.cameraDirShadowLights.get(camera);
      if (shadowDirLights) {
        for (let l = 0; l < shadowDirLights.length; l++) {
          const light = shadowDirLights[l];
          if (renderer.dirLightShadows.get(light) !== camera) {
            renderer.dirLightShadows.set(light, camera);
            const shadowPass = renderer._shadowRendererDirectional.getLightRenderPass(light, camera);
            if (shadowPass) {
              this.beforePasses.push(shadowPass);
            }
          }
        }
      }
    }
  }
  updateClears() {
    const renderAction = this.renderActions[0];
    if (renderAction) {
      const cameraComponent = renderAction.camera;
      const camera = cameraComponent.camera;
      const fullSizeClearRect = camera.fullSizeClearRect;
      this.setClearColor(fullSizeClearRect && renderAction.clearColor ? camera.clearColor : undefined);
      this.setClearDepth(fullSizeClearRect && renderAction.clearDepth && !this.noDepthClear ? camera.clearDepth : undefined);
      this.setClearStencil(fullSizeClearRect && renderAction.clearStencil ? camera.clearStencil : undefined);
    }
  }
  frameUpdate() {
    super.frameUpdate();
    this.updateDirectionalShadows();
    this.updateClears();
  }
  before() {
    const {
      renderActions
    } = this;
    if (renderActions.length) {
      const ra = renderActions[0];
      if (ra.camera.onPreRender && ra.firstCameraUse) {
        ra.camera.onPreRender();
      }
    }
  }
  execute() {
    const {
      layerComposition,
      renderActions
    } = this;
    for (let i = 0; i < renderActions.length; i++) {
      const ra = renderActions[i];
      if (layerComposition.isEnabled(ra.layer, ra.transparent)) {
        this.renderRenderAction(ra, i === 0);
      }
    }
  }
  after() {
    const {
      renderActions
    } = this;
    if (renderActions.length) {
      const ra = renderActions[renderActions.length - 1];
      if (ra.camera.onPostRender && ra.lastCameraUse) {
        ra.camera.onPostRender();
      }
    }
    this.beforePasses.length = 0;
  }
  renderRenderAction(renderAction, firstRenderAction) {
    const {
      renderer,
      layerComposition
    } = this;
    const device = renderer.device;
    const {
      layer,
      transparent,
      camera
    } = renderAction;
    const cameraPass = layerComposition.camerasMap.get(camera);
    if (!transparent && layer.onPreRenderOpaque) {
      layer.onPreRenderOpaque(cameraPass);
    } else if (transparent && layer.onPreRenderTransparent) {
      layer.onPreRenderTransparent(cameraPass);
    }
    if (!(layer._preRenderCalledForCameras & 1 << cameraPass)) {
      if (layer.onPreRender) {
        layer.onPreRender(cameraPass);
      }
      layer._preRenderCalledForCameras |= 1 << cameraPass;
    }
    if (camera) {
      var _camera$camera$shader, _camera$camera$shader2;
      const options = {
        lightClusters: renderAction.lightClusters
      };
      const shaderPass = (_camera$camera$shader = (_camera$camera$shader2 = camera.camera.shaderPassInfo) == null ? void 0 : _camera$camera$shader2.index) != null ? _camera$camera$shader : layer.shaderPass;
      if (!firstRenderAction || !camera.camera.fullSizeClearRect) {
        options.clearColor = renderAction.clearColor;
        options.clearDepth = renderAction.clearDepth;
        options.clearStencil = renderAction.clearStencil;
      }
      renderer.renderForwardLayer(camera.camera, renderAction.renderTarget, layer, transparent, shaderPass, renderAction.viewBindGroups, options);
      device.setBlendState(BlendState.NOBLEND);
      device.setStencilState(null, null);
      device.setAlphaToCoverage(false);
    }
    if (!transparent && layer.onPostRenderOpaque) {
      layer.onPostRenderOpaque(cameraPass);
    } else if (transparent && layer.onPostRenderTransparent) {
      layer.onPostRenderTransparent(cameraPass);
    }
    if (layer.onPostRender && !(layer._postRenderCalledForCameras & 1 << cameraPass)) {
      layer._postRenderCounter &= ~(transparent ? 2 : 1);
      if (layer._postRenderCounter === 0) {
        layer.onPostRender(cameraPass);
        layer._postRenderCalledForCameras |= 1 << cameraPass;
        layer._postRenderCounter = layer._postRenderCounterMax;
      }
    }
  }
}

export { RenderPassForward };
