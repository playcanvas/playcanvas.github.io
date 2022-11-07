/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_DEPTH } from '../../../scene/constants.js';
import { Mesh } from '../../../scene/mesh.js';
import { ParticleEmitter } from '../../../scene/particle-system/particle-emitter.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

const SIMPLE_PROPERTIES = ['emitterExtents', 'emitterRadius', 'emitterExtentsInner', 'emitterRadiusInner', 'loop', 'initialVelocity', 'animSpeed', 'normalMap', 'particleNormal'];

const COMPLEX_PROPERTIES = ['numParticles', 'lifetime', 'rate', 'rate2', 'startAngle', 'startAngle2', 'lighting', 'halfLambert', 'intensity', 'wrap', 'wrapBounds', 'depthWrite', 'noFog', 'sort', 'stretch', 'alignToMotion', 'preWarm', 'emitterShape', 'animTilesX', 'animTilesY', 'animStartFrame', 'animNumFrames', 'animNumAnimations', 'animIndex', 'randomizeAnimIndex', 'animLoop', 'colorMap', 'localSpace', 'screenSpace', 'orientation'];
const GRAPH_PROPERTIES = ['scaleGraph', 'scaleGraph2', 'colorGraph', 'colorGraph2', 'alphaGraph', 'alphaGraph2', 'velocityGraph', 'velocityGraph2', 'localVelocityGraph', 'localVelocityGraph2', 'rotationSpeedGraph', 'rotationSpeedGraph2', 'radialSpeedGraph', 'radialSpeedGraph2'];
const ASSET_PROPERTIES = ['colorMapAsset', 'normalMapAsset', 'meshAsset', 'renderAsset'];
let depthLayer;

class ParticleSystemComponent extends Component {

  constructor(system, entity) {
    super(system, entity);
    this._requestedDepth = false;
    this._drawOrder = 0;
    this.on('set_colorMapAsset', this.onSetColorMapAsset, this);
    this.on('set_normalMapAsset', this.onSetNormalMapAsset, this);
    this.on('set_meshAsset', this.onSetMeshAsset, this);
    this.on('set_mesh', this.onSetMesh, this);
    this.on('set_renderAsset', this.onSetRenderAsset, this);
    this.on('set_loop', this.onSetLoop, this);
    this.on('set_blendType', this.onSetBlendType, this);
    this.on('set_depthSoftening', this.onSetDepthSoftening, this);
    this.on('set_layers', this.onSetLayers, this);
    SIMPLE_PROPERTIES.forEach(prop => {
      this.on(`set_${prop}`, this.onSetSimpleProperty, this);
    });
    COMPLEX_PROPERTIES.forEach(prop => {
      this.on(`set_${prop}`, this.onSetComplexProperty, this);
    });
    GRAPH_PROPERTIES.forEach(prop => {
      this.on(`set_${prop}`, this.onSetGraphProperty, this);
    });
  }
  set drawOrder(drawOrder) {
    this._drawOrder = drawOrder;
    if (this.emitter) {
      this.emitter.drawOrder = drawOrder;
    }
  }
  get drawOrder() {
    return this._drawOrder;
  }
  addMeshInstanceToLayers() {
    if (!this.emitter) return;
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (!layer) continue;
      layer.addMeshInstances([this.emitter.meshInstance]);
      this.emitter._layer = layer;
    }
  }
  removeMeshInstanceFromLayers() {
    if (!this.emitter) return;
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
      if (!layer) continue;
      layer.removeMeshInstances([this.emitter.meshInstance]);
    }
  }
  onSetLayers(name, oldValue, newValue) {
    if (!this.emitter) return;
    for (let i = 0; i < oldValue.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(oldValue[i]);
      if (!layer) continue;
      layer.removeMeshInstances([this.emitter.meshInstance]);
    }
    if (!this.enabled || !this.entity.enabled) return;
    for (let i = 0; i < newValue.length; i++) {
      const layer = this.system.app.scene.layers.getLayerById(newValue[i]);
      if (!layer) continue;
      layer.addMeshInstances([this.emitter.meshInstance]);
    }
  }
  onLayersChanged(oldComp, newComp) {
    this.addMeshInstanceToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }
  onLayerAdded(layer) {
    if (!this.emitter) return;
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addMeshInstances([this.emitter.meshInstance]);
  }
  onLayerRemoved(layer) {
    if (!this.emitter) return;
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeMeshInstances([this.emitter.meshInstance]);
  }
  _bindColorMapAsset(asset) {
    asset.on('load', this._onColorMapAssetLoad, this);
    asset.on('unload', this._onColorMapAssetUnload, this);
    asset.on('remove', this._onColorMapAssetRemove, this);
    asset.on('change', this._onColorMapAssetChange, this);
    if (asset.resource) {
      this._onColorMapAssetLoad(asset);
    } else {
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }
  _unbindColorMapAsset(asset) {
    asset.off('load', this._onColorMapAssetLoad, this);
    asset.off('unload', this._onColorMapAssetUnload, this);
    asset.off('remove', this._onColorMapAssetRemove, this);
    asset.off('change', this._onColorMapAssetChange, this);
  }
  _onColorMapAssetLoad(asset) {
    this.colorMap = asset.resource;
  }
  _onColorMapAssetUnload(asset) {
    this.colorMap = null;
  }
  _onColorMapAssetRemove(asset) {
    this._onColorMapAssetUnload(asset);
  }
  _onColorMapAssetChange(asset) {}
  onSetColorMapAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      const asset = assets.get(oldValue);
      if (asset) {
        this._unbindColorMapAsset(asset);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.colorMapAsset = newValue.id;
        newValue = newValue.id;
      }
      const asset = assets.get(newValue);
      if (asset) {
        this._bindColorMapAsset(asset);
      } else {
        assets.once('add:' + newValue, asset => {
          this._bindColorMapAsset(asset);
        });
      }
    } else {
      this.colorMap = null;
    }
  }
  _bindNormalMapAsset(asset) {
    asset.on('load', this._onNormalMapAssetLoad, this);
    asset.on('unload', this._onNormalMapAssetUnload, this);
    asset.on('remove', this._onNormalMapAssetRemove, this);
    asset.on('change', this._onNormalMapAssetChange, this);
    if (asset.resource) {
      this._onNormalMapAssetLoad(asset);
    } else {
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }
  _unbindNormalMapAsset(asset) {
    asset.off('load', this._onNormalMapAssetLoad, this);
    asset.off('unload', this._onNormalMapAssetUnload, this);
    asset.off('remove', this._onNormalMapAssetRemove, this);
    asset.off('change', this._onNormalMapAssetChange, this);
  }
  _onNormalMapAssetLoad(asset) {
    this.normalMap = asset.resource;
  }
  _onNormalMapAssetUnload(asset) {
    this.normalMap = null;
  }
  _onNormalMapAssetRemove(asset) {
    this._onNormalMapAssetUnload(asset);
  }
  _onNormalMapAssetChange(asset) {}
  onSetNormalMapAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      const asset = assets.get(oldValue);
      if (asset) {
        this._unbindNormalMapAsset(asset);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.normalMapAsset = newValue.id;
        newValue = newValue.id;
      }
      const asset = assets.get(newValue);
      if (asset) {
        this._bindNormalMapAsset(asset);
      } else {
        assets.once('add:' + newValue, asset => {
          this._bindNormalMapAsset(asset);
        });
      }
    } else {
      this.normalMap = null;
    }
  }
  _bindMeshAsset(asset) {
    asset.on('load', this._onMeshAssetLoad, this);
    asset.on('unload', this._onMeshAssetUnload, this);
    asset.on('remove', this._onMeshAssetRemove, this);
    asset.on('change', this._onMeshAssetChange, this);
    if (asset.resource) {
      this._onMeshAssetLoad(asset);
    } else {
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }
  _unbindMeshAsset(asset) {
    asset.off('load', this._onMeshAssetLoad, this);
    asset.off('unload', this._onMeshAssetUnload, this);
    asset.off('remove', this._onMeshAssetRemove, this);
    asset.off('change', this._onMeshAssetChange, this);
  }
  _onMeshAssetLoad(asset) {
    this._onMeshChanged(asset.resource);
  }
  _onMeshAssetUnload(asset) {
    this.mesh = null;
  }
  _onMeshAssetRemove(asset) {
    this._onMeshAssetUnload(asset);
  }
  _onMeshAssetChange(asset) {}
  onSetMeshAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      const asset = assets.get(oldValue);
      if (asset) {
        this._unbindMeshAsset(asset);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.meshAsset = newValue.id;
        newValue = newValue.id;
      }
      const asset = assets.get(newValue);
      if (asset) {
        this._bindMeshAsset(asset);
      }
    } else {
      this._onMeshChanged(null);
    }
  }
  onSetMesh(name, oldValue, newValue) {
    if (!newValue || newValue instanceof Asset || typeof newValue === 'number') {
      this.meshAsset = newValue;
    } else {
      this._onMeshChanged(newValue);
    }
  }
  _onMeshChanged(mesh) {
    if (mesh && !(mesh instanceof Mesh)) {
      if (mesh.meshInstances[0]) {
        mesh = mesh.meshInstances[0].mesh;
      } else {
        mesh = null;
      }
    }
    this.data.mesh = mesh;
    if (this.emitter) {
      this.emitter.mesh = mesh;
      this.emitter.resetMaterial();
      this.rebuild();
    }
  }
  onSetRenderAsset(name, oldValue, newValue) {
    const assets = this.system.app.assets;
    if (oldValue) {
      const asset = assets.get(oldValue);
      if (asset) {
        this._unbindRenderAsset(asset);
      }
    }
    if (newValue) {
      if (newValue instanceof Asset) {
        this.data.renderAsset = newValue.id;
        newValue = newValue.id;
      }
      const asset = assets.get(newValue);
      if (asset) {
        this._bindRenderAsset(asset);
      }
    } else {
      this._onRenderChanged(null);
    }
  }
  _bindRenderAsset(asset) {
    asset.on('load', this._onRenderAssetLoad, this);
    asset.on('unload', this._onRenderAssetUnload, this);
    asset.on('remove', this._onRenderAssetRemove, this);
    if (asset.resource) {
      this._onRenderAssetLoad(asset);
    } else {
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }
  _unbindRenderAsset(asset) {
    asset.off('load', this._onRenderAssetLoad, this);
    asset.off('unload', this._onRenderAssetUnload, this);
    asset.off('remove', this._onRenderAssetRemove, this);
    if (asset.resource) {
      asset.resource.off('set:meshes', this._onRenderSetMeshes, this);
    }
  }
  _onRenderAssetLoad(asset) {
    this._onRenderChanged(asset.resource);
  }
  _onRenderAssetUnload(asset) {
    this._onRenderChanged(null);
  }
  _onRenderAssetRemove(asset) {
    this._onRenderAssetUnload(asset);
  }
  _onRenderChanged(render) {
    if (!render) {
      this._onMeshChanged(null);
      return;
    }
    render.off('set:meshes', this._onRenderSetMeshes, this);
    render.on('set:meshes', this._onRenderSetMeshes, this);
    if (render.meshes) {
      this._onRenderSetMeshes(render.meshes);
    }
  }
  _onRenderSetMeshes(meshes) {
    this._onMeshChanged(meshes && meshes[0]);
  }
  onSetLoop(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.resetTime();
    }
  }
  onSetBlendType(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.material.blendType = newValue;
      this.emitter.resetMaterial();
      this.rebuild();
    }
  }
  _requestDepth() {
    if (this._requestedDepth) return;
    if (!depthLayer) depthLayer = this.system.app.scene.layers.getLayerById(LAYERID_DEPTH);
    if (depthLayer) {
      depthLayer.incrementCounter();
      this._requestedDepth = true;
    }
  }
  _releaseDepth() {
    if (!this._requestedDepth) return;
    if (depthLayer) {
      depthLayer.decrementCounter();
      this._requestedDepth = false;
    }
  }
  onSetDepthSoftening(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (newValue) {
        if (this.enabled && this.entity.enabled) this._requestDepth();
        if (this.emitter) this.emitter[name] = newValue;
      } else {
        if (this.enabled && this.entity.enabled) this._releaseDepth();
        if (this.emitter) this.emitter[name] = newValue;
      }
      if (this.emitter) {
        this.reset();
        this.emitter.resetMaterial();
        this.rebuild();
      }
    }
  }
  onSetSimpleProperty(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.resetMaterial();
    }
  }
  onSetComplexProperty(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.resetMaterial();
      this.rebuild();
      this.reset();
    }
  }
  onSetGraphProperty(name, oldValue, newValue) {
    if (this.emitter) {
      this.emitter[name] = newValue;
      this.emitter.rebuildGraphs();
      this.emitter.resetMaterial();
    }
  }
  onEnable() {
    const data = this.data;

    for (let i = 0, len = ASSET_PROPERTIES.length; i < len; i++) {
      let asset = data[ASSET_PROPERTIES[i]];
      if (asset) {
        if (!(asset instanceof Asset)) {
          const id = parseInt(asset, 10);
          if (id >= 0) {
            asset = this.system.app.assets.get(asset);
          } else {
            continue;
          }
        }
        if (asset && !asset.resource) {
          this.system.app.assets.load(asset);
        }
      }
    }
    if (!this.emitter) {
      let mesh = data.mesh;

      if (!(mesh instanceof Mesh)) mesh = null;
      this.emitter = new ParticleEmitter(this.system.app.graphicsDevice, {
        numParticles: data.numParticles,
        emitterExtents: data.emitterExtents,
        emitterExtentsInner: data.emitterExtentsInner,
        emitterRadius: data.emitterRadius,
        emitterRadiusInner: data.emitterRadiusInner,
        emitterShape: data.emitterShape,
        initialVelocity: data.initialVelocity,
        wrap: data.wrap,
        localSpace: data.localSpace,
        screenSpace: data.screenSpace,
        wrapBounds: data.wrapBounds,
        lifetime: data.lifetime,
        rate: data.rate,
        rate2: data.rate2,
        orientation: data.orientation,
        particleNormal: data.particleNormal,
        animTilesX: data.animTilesX,
        animTilesY: data.animTilesY,
        animStartFrame: data.animStartFrame,
        animNumFrames: data.animNumFrames,
        animNumAnimations: data.animNumAnimations,
        animIndex: data.animIndex,
        randomizeAnimIndex: data.randomizeAnimIndex,
        animSpeed: data.animSpeed,
        animLoop: data.animLoop,
        startAngle: data.startAngle,
        startAngle2: data.startAngle2,
        scaleGraph: data.scaleGraph,
        scaleGraph2: data.scaleGraph2,
        colorGraph: data.colorGraph,
        colorGraph2: data.colorGraph2,
        alphaGraph: data.alphaGraph,
        alphaGraph2: data.alphaGraph2,
        localVelocityGraph: data.localVelocityGraph,
        localVelocityGraph2: data.localVelocityGraph2,
        velocityGraph: data.velocityGraph,
        velocityGraph2: data.velocityGraph2,
        rotationSpeedGraph: data.rotationSpeedGraph,
        rotationSpeedGraph2: data.rotationSpeedGraph2,
        radialSpeedGraph: data.radialSpeedGraph,
        radialSpeedGraph2: data.radialSpeedGraph2,
        colorMap: data.colorMap,
        normalMap: data.normalMap,
        loop: data.loop,
        preWarm: data.preWarm,
        sort: data.sort,
        stretch: data.stretch,
        alignToMotion: data.alignToMotion,
        lighting: data.lighting,
        halfLambert: data.halfLambert,
        intensity: data.intensity,
        depthSoftening: data.depthSoftening,
        scene: this.system.app.scene,
        mesh: mesh,
        depthWrite: data.depthWrite,
        noFog: data.noFog,
        node: this.entity,
        blendType: data.blendType
      });
      this.emitter.meshInstance.node = this.entity;
      this.emitter.drawOrder = this.drawOrder;
      if (!data.autoPlay) {
        this.pause();
        this.emitter.meshInstance.visible = false;
      }
    }
    if (this.emitter.colorMap) {
      this.addMeshInstanceToLayers();
    }
    this.system.app.scene.on('set:layers', this.onLayersChanged, this);
    if (this.system.app.scene.layers) {
      this.system.app.scene.layers.on('add', this.onLayerAdded, this);
      this.system.app.scene.layers.on('remove', this.onLayerRemoved, this);
    }
    if (this.enabled && this.entity.enabled && data.depthSoftening) {
      this._requestDepth();
    }
  }
  onDisable() {
    this.system.app.scene.off('set:layers', this.onLayersChanged, this);
    if (this.system.app.scene.layers) {
      this.system.app.scene.layers.off('add', this.onLayerAdded, this);
      this.system.app.scene.layers.off('remove', this.onLayerRemoved, this);
    }
    if (this.emitter) {
      this.removeMeshInstanceFromLayers();
      if (this.data.depthSoftening) this._releaseDepth();

      this.emitter.camera = null;
    }
  }
  onBeforeRemove() {
    if (this.enabled) {
      this.enabled = false;
    }
    if (this.emitter) {
      this.emitter.destroy();
      this.emitter = null;
    }

    for (let i = 0; i < ASSET_PROPERTIES.length; i++) {
      const prop = ASSET_PROPERTIES[i];
      if (this.data[prop]) {
        this[prop] = null;
      }
    }
    this.off();
  }

  reset() {
    if (this.emitter) {
      this.emitter.reset();
    }
  }

  stop() {
    if (this.emitter) {
      this.emitter.loop = false;
      this.emitter.resetTime();
      this.emitter.addTime(0, true);
    }
  }

  pause() {
    this.data.paused = true;
  }

  unpause() {
    this.data.paused = false;
  }

  play() {
    this.data.paused = false;
    if (this.emitter) {
      this.emitter.meshInstance.visible = true;
      this.emitter.loop = this.data.loop;
      this.emitter.resetTime();
    }
  }

  isPlaying() {
    if (this.data.paused) {
      return false;
    }
    if (this.emitter && this.emitter.loop) {
      return true;
    }

    return Date.now() <= this.emitter.endTime;
  }

  rebuild() {
    const enabled = this.enabled;
    this.enabled = false;
    if (this.emitter) {
      this.emitter.rebuild();
      this.emitter.meshInstance.node = this.entity;
    }
    this.enabled = enabled;
  }
}

export { ParticleSystemComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcGFydGljbGUtc3lzdGVtL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX0RFUFRIIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUuanMnKS5DdXJ2ZX0gQ3VydmUgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvY3VydmUtc2V0LmpzJykuQ3VydmVTZXR9IEN1cnZlU2V0ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzMuanMnKS5WZWMzfSBWZWMzICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlBhcnRpY2xlU3lzdGVtQ29tcG9uZW50U3lzdGVtfSBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudFN5c3RlbSAqL1xuXG4vLyBwcm9wZXJ0aWVzIHRoYXQgZG8gbm90IG5lZWQgcmVidWlsZGluZyB0aGUgcGFydGljbGUgc3lzdGVtXG5jb25zdCBTSU1QTEVfUFJPUEVSVElFUyA9IFtcbiAgICAnZW1pdHRlckV4dGVudHMnLFxuICAgICdlbWl0dGVyUmFkaXVzJyxcbiAgICAnZW1pdHRlckV4dGVudHNJbm5lcicsXG4gICAgJ2VtaXR0ZXJSYWRpdXNJbm5lcicsXG4gICAgJ2xvb3AnLFxuICAgICdpbml0aWFsVmVsb2NpdHknLFxuICAgICdhbmltU3BlZWQnLFxuICAgICdub3JtYWxNYXAnLFxuICAgICdwYXJ0aWNsZU5vcm1hbCdcbl07XG5cbi8vIHByb3BlcnRpZXMgdGhhdCBuZWVkIHJlYnVpbGRpbmcgdGhlIHBhcnRpY2xlIHN5c3RlbVxuY29uc3QgQ09NUExFWF9QUk9QRVJUSUVTID0gW1xuICAgICdudW1QYXJ0aWNsZXMnLFxuICAgICdsaWZldGltZScsXG4gICAgJ3JhdGUnLFxuICAgICdyYXRlMicsXG4gICAgJ3N0YXJ0QW5nbGUnLFxuICAgICdzdGFydEFuZ2xlMicsXG4gICAgJ2xpZ2h0aW5nJyxcbiAgICAnaGFsZkxhbWJlcnQnLFxuICAgICdpbnRlbnNpdHknLFxuICAgICd3cmFwJyxcbiAgICAnd3JhcEJvdW5kcycsXG4gICAgJ2RlcHRoV3JpdGUnLFxuICAgICdub0ZvZycsXG4gICAgJ3NvcnQnLFxuICAgICdzdHJldGNoJyxcbiAgICAnYWxpZ25Ub01vdGlvbicsXG4gICAgJ3ByZVdhcm0nLFxuICAgICdlbWl0dGVyU2hhcGUnLFxuICAgICdhbmltVGlsZXNYJyxcbiAgICAnYW5pbVRpbGVzWScsXG4gICAgJ2FuaW1TdGFydEZyYW1lJyxcbiAgICAnYW5pbU51bUZyYW1lcycsXG4gICAgJ2FuaW1OdW1BbmltYXRpb25zJyxcbiAgICAnYW5pbUluZGV4JyxcbiAgICAncmFuZG9taXplQW5pbUluZGV4JyxcbiAgICAnYW5pbUxvb3AnLFxuICAgICdjb2xvck1hcCcsXG4gICAgJ2xvY2FsU3BhY2UnLFxuICAgICdzY3JlZW5TcGFjZScsXG4gICAgJ29yaWVudGF0aW9uJ1xuXTtcblxuY29uc3QgR1JBUEhfUFJPUEVSVElFUyA9IFtcbiAgICAnc2NhbGVHcmFwaCcsXG4gICAgJ3NjYWxlR3JhcGgyJyxcblxuICAgICdjb2xvckdyYXBoJyxcbiAgICAnY29sb3JHcmFwaDInLFxuXG4gICAgJ2FscGhhR3JhcGgnLFxuICAgICdhbHBoYUdyYXBoMicsXG5cbiAgICAndmVsb2NpdHlHcmFwaCcsXG4gICAgJ3ZlbG9jaXR5R3JhcGgyJyxcblxuICAgICdsb2NhbFZlbG9jaXR5R3JhcGgnLFxuICAgICdsb2NhbFZlbG9jaXR5R3JhcGgyJyxcblxuICAgICdyb3RhdGlvblNwZWVkR3JhcGgnLFxuICAgICdyb3RhdGlvblNwZWVkR3JhcGgyJyxcblxuICAgICdyYWRpYWxTcGVlZEdyYXBoJyxcbiAgICAncmFkaWFsU3BlZWRHcmFwaDInXG5dO1xuXG5jb25zdCBBU1NFVF9QUk9QRVJUSUVTID0gW1xuICAgICdjb2xvck1hcEFzc2V0JyxcbiAgICAnbm9ybWFsTWFwQXNzZXQnLFxuICAgICdtZXNoQXNzZXQnLFxuICAgICdyZW5kZXJBc3NldCdcbl07XG5cbmxldCBkZXB0aExheWVyO1xuXG4vKipcbiAqIFVzZWQgdG8gc2ltdWxhdGUgcGFydGljbGVzIGFuZCBwcm9kdWNlIHJlbmRlcmFibGUgcGFydGljbGUgbWVzaCBvbiBlaXRoZXIgQ1BVIG9yIEdQVS4gR1BVXG4gKiBzaW11bGF0aW9uIGlzIGdlbmVyYWxseSBtdWNoIGZhc3RlciB0aGFuIGl0cyBDUFUgY291bnRlcnBhcnQsIGJlY2F1c2UgaXQgYXZvaWRzIHNsb3cgQ1BVLUdQVVxuICogc3luY2hyb25pemF0aW9uIGFuZCB0YWtlcyBhZHZhbnRhZ2Ugb2YgbWFueSBHUFUgY29yZXMuIEhvd2V2ZXIsIGl0IHJlcXVpcmVzIGNsaWVudCB0byBzdXBwb3J0XG4gKiByZWFzb25hYmxlIHVuaWZvcm0gY291bnQsIHJlYWRpbmcgZnJvbSBtdWx0aXBsZSB0ZXh0dXJlcyBpbiB2ZXJ0ZXggc2hhZGVyIGFuZCBPRVNfdGV4dHVyZV9mbG9hdFxuICogZXh0ZW5zaW9uLCBpbmNsdWRpbmcgcmVuZGVyaW5nIGludG8gZmxvYXQgdGV4dHVyZXMuIE1vc3QgbW9iaWxlIGRldmljZXMgZmFpbCB0byBzYXRpc2Z5IHRoZXNlXG4gKiByZXF1aXJlbWVudHMsIHNvIGl0J3Mgbm90IHJlY29tbWVuZGVkIHRvIHNpbXVsYXRlIHRob3VzYW5kcyBvZiBwYXJ0aWNsZXMgb24gdGhlbS4gR1BVIHZlcnNpb25cbiAqIGFsc28gY2FuJ3Qgc29ydCBwYXJ0aWNsZXMsIHNvIGVuYWJsaW5nIHNvcnRpbmcgZm9yY2VzIENQVSBtb2RlIHRvby4gUGFydGljbGUgcm90YXRpb24gaXNcbiAqIHNwZWNpZmllZCBieSBhIHNpbmdsZSBhbmdsZSBwYXJhbWV0ZXI6IGRlZmF1bHQgYmlsbGJvYXJkIHBhcnRpY2xlcyByb3RhdGUgYXJvdW5kIGNhbWVyYSBmYWNpbmdcbiAqIGF4aXMsIHdoaWxlIG1lc2ggcGFydGljbGVzIHJvdGF0ZSBhcm91bmQgMiBkaWZmZXJlbnQgdmlldy1pbmRlcGVuZGVudCBheGVzLiBNb3N0IG9mIHRoZVxuICogc2ltdWxhdGlvbiBwYXJhbWV0ZXJzIGFyZSBzcGVjaWZpZWQgd2l0aCB7QGxpbmsgQ3VydmV9IG9yIHtAbGluayBDdXJ2ZVNldH0uIEN1cnZlcyBhcmVcbiAqIGludGVycG9sYXRlZCBiYXNlZCBvbiBlYWNoIHBhcnRpY2xlJ3MgbGlmZXRpbWUsIHRoZXJlZm9yZSBwYXJhbWV0ZXJzIGFyZSBhYmxlIHRvIGNoYW5nZSBvdmVyXG4gKiB0aW1lLiBNb3N0IG9mIHRoZSBjdXJ2ZSBwYXJhbWV0ZXJzIGNhbiBhbHNvIGJlIHNwZWNpZmllZCBieSAyIG1pbmltdW0vbWF4aW11bSBjdXJ2ZXMsIHRoaXMgd2F5XG4gKiBlYWNoIHBhcnRpY2xlIHdpbGwgcGljayBhIHJhbmRvbSB2YWx1ZSBpbi1iZXR3ZWVuLlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYXV0b1BsYXkgQ29udHJvbHMgd2hldGhlciB0aGUgcGFydGljbGUgc3lzdGVtIHBsYXlzIGF1dG9tYXRpY2FsbHkgb25cbiAqIGNyZWF0aW9uLiBJZiBzZXQgdG8gZmFsc2UsIGl0IGlzIG5lY2Vzc2FyeSB0byBjYWxsIHtAbGluayBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudCNwbGF5fSBmb3IgdGhlXG4gKiBwYXJ0aWNsZSBzeXN0ZW0gdG8gcGxheS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbG9vcCBFbmFibGVzIG9yIGRpc2FibGVzIHJlc3Bhd25pbmcgb2YgcGFydGljbGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBwcmVXYXJtIElmIGVuYWJsZWQsIHRoZSBwYXJ0aWNsZSBzeXN0ZW0gd2lsbCBiZSBpbml0aWFsaXplZCBhcyB0aG91Z2ggaXQgaGFkXG4gKiBhbHJlYWR5IGNvbXBsZXRlZCBhIGZ1bGwgY3ljbGUuIFRoaXMgb25seSB3b3JrcyB3aXRoIGxvb3BpbmcgcGFydGljbGUgc3lzdGVtcy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbGlnaHRpbmcgSWYgZW5hYmxlZCwgcGFydGljbGVzIHdpbGwgYmUgbGl0IGJ5IGFtYmllbnQgYW5kIGRpcmVjdGlvbmFsXG4gKiBsaWdodHMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGhhbGZMYW1iZXJ0IEVuYWJsaW5nIEhhbGYgTGFtYmVydCBsaWdodGluZyBhdm9pZHMgcGFydGljbGVzIGxvb2tpbmcgdG9vIGZsYXRcbiAqIGluIHNoYWRvd2VkIGFyZWFzLiBJdCBpcyBhIGNvbXBsZXRlbHkgbm9uLXBoeXNpY2FsIGxpZ2h0aW5nIG1vZGVsIGJ1dCBjYW4gZ2l2ZSBtb3JlIHBsZWFzaW5nXG4gKiB2aXN1YWwgcmVzdWx0cy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYWxpZ25Ub01vdGlvbiBPcmllbnQgcGFydGljbGVzIGluIHRoZWlyIGRpcmVjdGlvbiBvZiBtb3Rpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGRlcHRoV3JpdGUgSWYgZW5hYmxlZCwgdGhlIHBhcnRpY2xlcyB3aWxsIHdyaXRlIHRvIHRoZSBkZXB0aCBidWZmZXIuIElmXG4gKiBkaXNhYmxlZCwgdGhlIGRlcHRoIGJ1ZmZlciBpcyBsZWZ0IHVuY2hhbmdlZCBhbmQgcGFydGljbGVzIHdpbGwgYmUgZ3VhcmFudGVlZCB0byBvdmVyd3JpdGUgb25lXG4gKiBhbm90aGVyIGluIHRoZSBvcmRlciBpbiB3aGljaCB0aGV5IGFyZSByZW5kZXJlZC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbm9Gb2cgRGlzYWJsZSBmb2dnaW5nLlxuICogQHByb3BlcnR5IHtib29sZWFufSBsb2NhbFNwYWNlIEJpbmRzIHBhcnRpY2xlcyB0byBlbWl0dGVyIHRyYW5zZm9ybWF0aW9uIHJhdGhlciB0aGVuIHdvcmxkXG4gKiBzcGFjZS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2NyZWVuU3BhY2UgUmVuZGVycyBwYXJ0aWNsZXMgaW4gMkQgc2NyZWVuIHNwYWNlLiBUaGlzIG5lZWRzIHRvIGJlIHNldCB3aGVuXG4gKiBwYXJ0aWNsZSBzeXN0ZW0gaXMgcGFydCBvZiBoaWVyYXJjaHkgd2l0aCB7QGxpbmsgU2NyZWVuQ29tcG9uZW50fSBhcyBpdHMgYW5jZXN0b3IsIGFuZCBhbGxvd3NcbiAqIHBhcnRpY2xlIHN5c3RlbSB0byBpbnRlZ3JhdGUgd2l0aCB0aGUgcmVuZGVyaW5nIG9mIHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuIE5vdGUgdGhhdCBhblxuICogZW50aXR5IHdpdGggUGFydGljbGVTeXN0ZW0gY29tcG9uZW50IGNhbm5vdCBiZSBwYXJlbnRlZCBkaXJlY3RseSB0byB7QGxpbmsgU2NyZWVuQ29tcG9uZW50fSwgYnV0XG4gKiBoYXMgdG8gYmUgYSBjaGlsZCBvZiBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fSwgZm9yIGV4YW1wbGUge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBudW1QYXJ0aWNsZXMgTWF4aW11bSBudW1iZXIgb2Ygc2ltdWxhdGVkIHBhcnRpY2xlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByYXRlIE1pbmltYWwgaW50ZXJ2YWwgaW4gc2Vjb25kcyBiZXR3ZWVuIHBhcnRpY2xlIGJpcnRocy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByYXRlMiBNYXhpbWFsIGludGVydmFsIGluIHNlY29uZHMgYmV0d2VlbiBwYXJ0aWNsZSBiaXJ0aHMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3RhcnRBbmdsZSBNaW5pbWFsIGluaXRpYWwgRXVsZXIgYW5nbGUgb2YgYSBwYXJ0aWNsZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzdGFydEFuZ2xlMiBNYXhpbWFsIGluaXRpYWwgRXVsZXIgYW5nbGUgb2YgYSBwYXJ0aWNsZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaWZldGltZSBUaGUgbGVuZ3RoIG9mIHRpbWUgaW4gc2Vjb25kcyBiZXR3ZWVuIGEgcGFydGljbGUncyBiaXJ0aCBhbmQgaXRzXG4gKiBkZWF0aC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzdHJldGNoIEEgdmFsdWUgaW4gd29ybGQgdW5pdHMgdGhhdCBjb250cm9scyB0aGUgYW1vdW50IGJ5IHdoaWNoIHBhcnRpY2xlc1xuICogYXJlIHN0cmV0Y2hlZCBiYXNlZCBvbiB0aGVpciB2ZWxvY2l0eS4gUGFydGljbGVzIGFyZSBzdHJldGNoZWQgZnJvbSB0aGVpciBjZW50ZXIgdG93YXJkcyB0aGVpclxuICogcHJldmlvdXMgcG9zaXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gaW50ZW5zaXR5IENvbG9yIG11bHRpcGxpZXIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGFuaW1Mb29wIENvbnRyb2xzIHdoZXRoZXIgdGhlIHNwcml0ZSBzaGVldCBhbmltYXRpb24gcGxheXMgb25jZSBvciBsb29wc1xuICogY29udGludW91c2x5LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1UaWxlc1ggTnVtYmVyIG9mIGhvcml6b250YWwgdGlsZXMgaW4gdGhlIHNwcml0ZSBzaGVldC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmltVGlsZXNZIE51bWJlciBvZiB2ZXJ0aWNhbCB0aWxlcyBpbiB0aGUgc3ByaXRlIHNoZWV0LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1OdW1BbmltYXRpb25zIE51bWJlciBvZiBzcHJpdGUgc2hlZXQgYW5pbWF0aW9ucyBjb250YWluZWQgd2l0aGluIHRoZVxuICogY3VycmVudCBzcHJpdGUgc2hlZXQuIFRoZSBudW1iZXIgb2YgYW5pbWF0aW9ucyBtdWx0aXBsaWVkIGJ5IG51bWJlciBvZiBmcmFtZXMgc2hvdWxkIGJlIGEgdmFsdWVcbiAqIGxlc3MgdGhhbiBhbmltVGlsZXNYIG11bHRpcGxpZWQgYnkgYW5pbVRpbGVzWS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmltTnVtRnJhbWVzIE51bWJlciBvZiBzcHJpdGUgc2hlZXQgZnJhbWVzIGluIHRoZSBjdXJyZW50IHNwcml0ZSBzaGVldFxuICogYW5pbWF0aW9uLiBUaGUgbnVtYmVyIG9mIGFuaW1hdGlvbnMgbXVsdGlwbGllZCBieSBudW1iZXIgb2YgZnJhbWVzIHNob3VsZCBiZSBhIHZhbHVlIGxlc3MgdGhhblxuICogYW5pbVRpbGVzWCBtdWx0aXBsaWVkIGJ5IGFuaW1UaWxlc1kuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbVN0YXJ0RnJhbWUgVGhlIHNwcml0ZSBzaGVldCBmcmFtZSB0aGF0IHRoZSBhbmltYXRpb24gc2hvdWxkIGJlZ2luIHBsYXlpbmdcbiAqIGZyb20uIEluZGV4ZWQgZnJvbSB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgYW5pbWF0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1JbmRleCBXaGVuIGFuaW1OdW1BbmltYXRpb25zIGlzIGdyZWF0ZXIgdGhhbiAxLCB0aGUgc3ByaXRlIHNoZWV0XG4gKiBhbmltYXRpb24gaW5kZXggZGV0ZXJtaW5lcyB3aGljaCBhbmltYXRpb24gdGhlIHBhcnRpY2xlIHN5c3RlbSBzaG91bGQgcGxheS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByYW5kb21pemVBbmltSW5kZXggRWFjaCBwYXJ0aWNsZSBlbWl0dGVkIGJ5IHRoZSBzeXN0ZW0gd2lsbCBwbGF5IGEgcmFuZG9tXG4gKiBhbmltYXRpb24gZnJvbSB0aGUgc3ByaXRlIHNoZWV0LCB1cCB0byBhbmltTnVtQW5pbWF0aW9ucy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmltU3BlZWQgU3ByaXRlIHNoZWV0IGFuaW1hdGlvbiBzcGVlZC4gMSA9IHBhcnRpY2xlIGxpZmV0aW1lLCAyID0gdHdpY2VcbiAqIGR1cmluZyBsaWZldGltZSBldGMuLi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBkZXB0aFNvZnRlbmluZyBDb250cm9scyBmYWRpbmcgb2YgcGFydGljbGVzIG5lYXIgdGhlaXIgaW50ZXJzZWN0aW9ucyB3aXRoXG4gKiBzY2VuZSBnZW9tZXRyeS4gVGhpcyBlZmZlY3QsIHdoZW4gaXQncyBub24temVybywgcmVxdWlyZXMgc2NlbmUgZGVwdGggbWFwIHRvIGJlIHJlbmRlcmVkLlxuICogTXVsdGlwbGUgZGVwdGgtZGVwZW5kZW50IGVmZmVjdHMgY2FuIHNoYXJlIHRoZSBzYW1lIG1hcCwgYnV0IGlmIHlvdSBvbmx5IHVzZSBpdCBmb3IgcGFydGljbGVzLFxuICogYmVhciBpbiBtaW5kIHRoYXQgaXQgY2FuIGRvdWJsZSBlbmdpbmUgZHJhdyBjYWxscy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbml0aWFsVmVsb2NpdHkgRGVmaW5lcyBtYWduaXR1ZGUgb2YgdGhlIGluaXRpYWwgZW1pdHRlciB2ZWxvY2l0eS4gRGlyZWN0aW9uXG4gKiBpcyBnaXZlbiBieSBlbWl0dGVyIHNoYXBlLlxuICogQHByb3BlcnR5IHtWZWMzfSBlbWl0dGVyRXh0ZW50cyAoT25seSBmb3IgRU1JVFRFUlNIQVBFX0JPWCkgVGhlIGV4dGVudHMgb2YgYSBsb2NhbCBzcGFjZVxuICogYm91bmRpbmcgYm94IHdpdGhpbiB3aGljaCBwYXJ0aWNsZXMgYXJlIHNwYXduZWQgYXQgcmFuZG9tIHBvc2l0aW9ucy5cbiAqIEBwcm9wZXJ0eSB7VmVjM30gZW1pdHRlckV4dGVudHNJbm5lciAoT25seSBmb3IgRU1JVFRFUlNIQVBFX0JPWCkgVGhlIGV4Y2VwdGlvbiBvZiBleHRlbnRzIG9mIGFcbiAqIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCB3aXRoaW4gd2hpY2ggcGFydGljbGVzIGFyZSBub3Qgc3Bhd25lZC4gQWxpZ25lZCB0byB0aGUgY2VudGVyIG9mXG4gKiBFbWl0dGVyRXh0ZW50cy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWl0dGVyUmFkaXVzIChPbmx5IGZvciBFTUlUVEVSU0hBUEVfU1BIRVJFKSBUaGUgcmFkaXVzIHdpdGhpbiB3aGljaFxuICogcGFydGljbGVzIGFyZSBzcGF3bmVkIGF0IHJhbmRvbSBwb3NpdGlvbnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pdHRlclJhZGl1c0lubmVyIChPbmx5IGZvciBFTUlUVEVSU0hBUEVfU1BIRVJFKSBUaGUgaW5uZXIgcmFkaXVzIHdpdGhpblxuICogd2hpY2ggcGFydGljbGVzIGFyZSBub3Qgc3Bhd25lZC5cbiAqIEBwcm9wZXJ0eSB7VmVjM30gd3JhcEJvdW5kcyBUaGUgaGFsZiBleHRlbnRzIG9mIGEgd29ybGQgc3BhY2UgYm94IHZvbHVtZSBjZW50ZXJlZCBvbiB0aGUgb3duZXJcbiAqIGVudGl0eSdzIHBvc2l0aW9uLiBJZiBhIHBhcnRpY2xlIGNyb3NzZXMgdGhlIGJvdW5kYXJ5IG9mIG9uZSBzaWRlIG9mIHRoZSB2b2x1bWUsIGl0IHRlbGVwb3J0cyB0b1xuICogdGhlIG9wcG9zaXRlIHNpZGUuXG4gKiBAcHJvcGVydHkge0Fzc2V0fSBjb2xvck1hcEFzc2V0IFRoZSB7QGxpbmsgQXNzZXR9IHVzZWQgdG8gc2V0IHRoZSBjb2xvck1hcC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IG5vcm1hbE1hcEFzc2V0IFRoZSB7QGxpbmsgQXNzZXR9IHVzZWQgdG8gc2V0IHRoZSBub3JtYWxNYXAuXG4gKiBAcHJvcGVydHkge0Fzc2V0fSBtZXNoQXNzZXQgVGhlIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIG1lc2guXG4gKiBAcHJvcGVydHkge0Fzc2V0fSByZW5kZXJBc3NldCBUaGUgUmVuZGVyIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIG1lc2guXG4gKiBAcHJvcGVydHkge1RleHR1cmV9IGNvbG9yTWFwIFRoZSBjb2xvciBtYXAgdGV4dHVyZSB0byBhcHBseSB0byBhbGwgcGFydGljbGVzIGluIHRoZSBzeXN0ZW0uIElmXG4gKiBubyB0ZXh0dXJlIGlzIGFzc2lnbmVkLCBhIGRlZmF1bHQgc3BvdCB0ZXh0dXJlIGlzIHVzZWQuXG4gKiBAcHJvcGVydHkge1RleHR1cmV9IG5vcm1hbE1hcCBUaGUgbm9ybWFsIG1hcCB0ZXh0dXJlIHRvIGFwcGx5IHRvIGFsbCBwYXJ0aWNsZXMgaW4gdGhlIHN5c3RlbS4gSWZcbiAqIG5vIHRleHR1cmUgaXMgYXNzaWduZWQsIGFuIGFwcHJveGltYXRlIHNwaGVyaWNhbCBub3JtYWwgaXMgY2FsY3VsYXRlZCBmb3IgZWFjaCB2ZXJ0ZXguXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pdHRlclNoYXBlIFNoYXBlIG9mIHRoZSBlbWl0dGVyLiBEZWZpbmVzIHRoZSBib3VuZHMgaW5zaWRlIHdoaWNoIHBhcnRpY2xlc1xuICogYXJlIHNwYXduZWQuIEFsc28gYWZmZWN0cyB0aGUgZGlyZWN0aW9uIG9mIGluaXRpYWwgdmVsb2NpdHkuXG4gKlxuICogLSB7QGxpbmsgRU1JVFRFUlNIQVBFX0JPWH06IEJveCBzaGFwZSBwYXJhbWV0ZXJpemVkIGJ5IGVtaXR0ZXJFeHRlbnRzLiBJbml0aWFsIHZlbG9jaXR5IGlzXG4gKiBkaXJlY3RlZCB0b3dhcmRzIGxvY2FsIFogYXhpcy5cbiAqIC0ge0BsaW5rIEVNSVRURVJTSEFQRV9TUEhFUkV9OiBTcGhlcmUgc2hhcGUgcGFyYW1ldGVyaXplZCBieSBlbWl0dGVyUmFkaXVzLiBJbml0aWFsIHZlbG9jaXR5IGlzXG4gKiBkaXJlY3RlZCBvdXR3YXJkcyBmcm9tIHRoZSBjZW50ZXIuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNvcnQgU29ydGluZyBtb2RlLiBGb3JjZXMgQ1BVIHNpbXVsYXRpb24sIHNvIGJlIGNhcmVmdWwuXG4gKlxuICogLSB7QGxpbmsgUEFSVElDTEVTT1JUX05PTkV9OiBObyBzb3J0aW5nLCBwYXJ0aWNsZXMgYXJlIGRyYXduIGluIGFyYml0cmFyeSBvcmRlci4gQ2FuIGJlXG4gKiBzaW11bGF0ZWQgb24gR1BVLlxuICogLSB7QGxpbmsgUEFSVElDTEVTT1JUX0RJU1RBTkNFfTogU29ydGluZyBiYXNlZCBvbiBkaXN0YW5jZSB0byB0aGUgY2FtZXJhLiBDUFUgb25seS5cbiAqIC0ge0BsaW5rIFBBUlRJQ0xFU09SVF9ORVdFUl9GSVJTVH06IE5ld2VyIHBhcnRpY2xlcyBhcmUgZHJhd24gZmlyc3QuIENQVSBvbmx5LlxuICogLSB7QGxpbmsgUEFSVElDTEVTT1JUX09MREVSX0ZJUlNUfTogT2xkZXIgcGFydGljbGVzIGFyZSBkcmF3biBmaXJzdC4gQ1BVIG9ubHkuXG4gKlxuICogQHByb3BlcnR5IHtNZXNofSBtZXNoIFRyaWFuZ3VsYXIgbWVzaCB0byBiZSB1c2VkIGFzIGEgcGFydGljbGUuIE9ubHkgZmlyc3QgdmVydGV4L2luZGV4IGJ1ZmZlclxuICogaXMgdXNlZC4gVmVydGV4IGJ1ZmZlciBtdXN0IGNvbnRhaW4gbG9jYWwgcG9zaXRpb24gYXQgZmlyc3QgMyBmbG9hdHMgb2YgZWFjaCB2ZXJ0ZXguXG4gKiBAcHJvcGVydHkge251bWJlcn0gYmxlbmQgQ29udHJvbHMgaG93IHBhcnRpY2xlcyBhcmUgYmxlbmRlZCB3aGVuIGJlaW5nIHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnRseVxuICogYWN0aXZlIHJlbmRlciB0YXJnZXQuIENhbiBiZTpcbiAqXG4gKiAtIHtAbGluayBCTEVORF9TVUJUUkFDVElWRX06IFN1YnRyYWN0IHRoZSBjb2xvciBvZiB0aGUgc291cmNlIGZyYWdtZW50IGZyb20gdGhlIGRlc3RpbmF0aW9uXG4gKiBmcmFnbWVudCBhbmQgd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICogLSB7QGxpbmsgQkxFTkRfQURESVRJVkV9OiBBZGQgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgdG8gdGhlIGRlc3RpbmF0aW9uIGZyYWdtZW50IGFuZFxuICogd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICogLSB7QGxpbmsgQkxFTkRfTk9STUFMfTogRW5hYmxlIHNpbXBsZSB0cmFuc2x1Y2VuY3kgZm9yIG1hdGVyaWFscyBzdWNoIGFzIGdsYXNzLiBUaGlzIGlzXG4gKiBlcXVpdmFsZW50IHRvIGVuYWJsaW5nIGEgc291cmNlIGJsZW5kIG1vZGUgb2Yge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEF9IGFuZCBhIGRlc3RpbmF0aW9uXG4gKiBibGVuZCBtb2RlIG9mIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX0uXG4gKiAtIHtAbGluayBCTEVORF9OT05FfTogRGlzYWJsZSBibGVuZGluZy5cbiAqIC0ge0BsaW5rIEJMRU5EX1BSRU1VTFRJUExJRUR9OiBTaW1pbGFyIHRvIHtAbGluayBCTEVORF9OT1JNQUx9IGV4cGVjdCB0aGUgc291cmNlIGZyYWdtZW50IGlzXG4gKiBhc3N1bWVkIHRvIGhhdmUgYWxyZWFkeSBiZWVuIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYSB2YWx1ZS5cbiAqIC0ge0BsaW5rIEJMRU5EX01VTFRJUExJQ0FUSVZFfTogTXVsdGlwbHkgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgYnkgdGhlIGNvbG9yIG9mIHRoZVxuICogZGVzdGluYXRpb24gZnJhZ21lbnQgYW5kIHdyaXRlIHRoZSByZXN1bHQgdG8gdGhlIGZyYW1lIGJ1ZmZlci5cbiAqIC0ge0BsaW5rIEJMRU5EX0FERElUSVZFQUxQSEF9OiBTYW1lIGFzIHtAbGluayBCTEVORF9BRERJVElWRX0gZXhjZXB0IHRoZSBzb3VyY2UgUkdCIGlzXG4gKiBtdWx0aXBsaWVkIGJ5IHRoZSBzb3VyY2UgYWxwaGEuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9yaWVudGF0aW9uIFNvcnRpbmcgbW9kZS4gRm9yY2VzIENQVSBzaW11bGF0aW9uLCBzbyBiZSBjYXJlZnVsLlxuICpcbiAqIC0ge0BsaW5rIFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOfTogUGFydGljbGVzIGFyZSBmYWNpbmcgY2FtZXJhLlxuICogLSB7QGxpbmsgUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRH06IFVzZXIgZGVmaW5lcyB3b3JsZCBzcGFjZSBub3JtYWwgKHBhcnRpY2xlTm9ybWFsKSB0byBzZXRcbiAqIHBsYW5lcyBvcmllbnRhdGlvbi5cbiAqIC0ge0BsaW5rIFBBUlRJQ0xFT1JJRU5UQVRJT05fRU1JVFRFUn06IFNpbWlsYXIgdG8gcHJldmlvdXMsIGJ1dCB0aGUgbm9ybWFsIGlzIGFmZmVjdGVkIGJ5XG4gKiBlbWl0dGVyIChlbnRpdHkpIHRyYW5zZm9ybWF0aW9uLlxuICpcbiAqIEBwcm9wZXJ0eSB7VmVjM30gcGFydGljbGVOb3JtYWwgKE9ubHkgZm9yIFBBUlRJQ0xFT1JJRU5UQVRJT05fV09STEQgYW5kXG4gKiBQQVJUSUNMRU9SSUVOVEFUSU9OX0VNSVRURVIpIFRoZSBleGNlcHRpb24gb2YgZXh0ZW50cyBvZiBhIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCB3aXRoaW4gd2hpY2hcbiAqIHBhcnRpY2xlcyBhcmUgbm90IHNwYXduZWQuIEFsaWduZWQgdG8gdGhlIGNlbnRlciBvZiBFbWl0dGVyRXh0ZW50cy5cbiAqIEBwcm9wZXJ0eSB7Q3VydmVTZXR9IGxvY2FsVmVsb2NpdHlHcmFwaCBWZWxvY2l0eSByZWxhdGl2ZSB0byBlbWl0dGVyIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge0N1cnZlU2V0fSBsb2NhbFZlbG9jaXR5R3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW5cbiAqIGxvY2FsVmVsb2NpdHlHcmFwaCBhbmQgbG9jYWxWZWxvY2l0eUdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7Q3VydmVTZXR9IHZlbG9jaXR5R3JhcGggV29ybGQtc3BhY2UgdmVsb2NpdHkgb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7Q3VydmVTZXR9IHZlbG9jaXR5R3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW5cbiAqIHZlbG9jaXR5R3JhcGggYW5kIHZlbG9jaXR5R3JhcGgyLlxuICogQHByb3BlcnR5IHtDdXJ2ZVNldH0gY29sb3JHcmFwaCBDb2xvciBvdmVyIGxpZmV0aW1lLlxuICogQHByb3BlcnR5IHtDdXJ2ZX0gcm90YXRpb25TcGVlZEdyYXBoIFJvdGF0aW9uIHNwZWVkIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge0N1cnZlfSByb3RhdGlvblNwZWVkR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW5cbiAqIHJvdGF0aW9uU3BlZWRHcmFwaCBhbmQgcm90YXRpb25TcGVlZEdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7Q3VydmV9IHJhZGlhbFNwZWVkR3JhcGggUmFkaWFsIHNwZWVkIG92ZXIgbGlmZXRpbWUsIHZlbG9jaXR5IHZlY3RvciBwb2ludHMgZnJvbVxuICogZW1pdHRlciBvcmlnaW4gdG8gcGFydGljbGUgcG9zLlxuICogQHByb3BlcnR5IHtDdXJ2ZX0gcmFkaWFsU3BlZWRHcmFwaDIgSWYgbm90IG51bGwsIHBhcnRpY2xlcyBwaWNrIHJhbmRvbSB2YWx1ZXMgYmV0d2VlblxuICogcmFkaWFsU3BlZWRHcmFwaCBhbmQgcmFkaWFsU3BlZWRHcmFwaDIuXG4gKiBAcHJvcGVydHkge0N1cnZlfSBzY2FsZUdyYXBoIFNjYWxlIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge0N1cnZlfSBzY2FsZUdyYXBoMiBJZiBub3QgbnVsbCwgcGFydGljbGVzIHBpY2sgcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIHNjYWxlR3JhcGggYW5kXG4gKiBzY2FsZUdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7Q3VydmV9IGFscGhhR3JhcGggQWxwaGEgb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7Q3VydmV9IGFscGhhR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW4gYWxwaGFHcmFwaCBhbmRcbiAqIGFscGhhR3JhcGgyLlxuICogQHByb3BlcnR5IHtudW1iZXJbXX0gbGF5ZXJzIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhpcyBwYXJ0aWNsZVxuICogc3lzdGVtIHNob3VsZCBiZWxvbmcuIERvbid0IHB1c2gvcG9wL3NwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0XG4gKiBhIG5ldyBvbmUgaW5zdGVhZC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgUGFydGljbGVTeXN0ZW1Db21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9yZXF1ZXN0ZWREZXB0aCA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RyYXdPcmRlciA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUGFydGljbGVTeXN0ZW1Db21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1BhcnRpY2xlU3lzdGVtQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXQgY3JlYXRlZCB0aGlzXG4gICAgICogQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLm9uKCdzZXRfY29sb3JNYXBBc3NldCcsIHRoaXMub25TZXRDb2xvck1hcEFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X25vcm1hbE1hcEFzc2V0JywgdGhpcy5vblNldE5vcm1hbE1hcEFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X21lc2hBc3NldCcsIHRoaXMub25TZXRNZXNoQXNzZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbWVzaCcsIHRoaXMub25TZXRNZXNoLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X3JlbmRlckFzc2V0JywgdGhpcy5vblNldFJlbmRlckFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2xvb3AnLCB0aGlzLm9uU2V0TG9vcCwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9ibGVuZFR5cGUnLCB0aGlzLm9uU2V0QmxlbmRUeXBlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2RlcHRoU29mdGVuaW5nJywgdGhpcy5vblNldERlcHRoU29mdGVuaW5nLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2xheWVycycsIHRoaXMub25TZXRMYXllcnMsIHRoaXMpO1xuXG4gICAgICAgIFNJTVBMRV9QUk9QRVJUSUVTLmZvckVhY2goKHByb3ApID0+IHtcbiAgICAgICAgICAgIHRoaXMub24oYHNldF8ke3Byb3B9YCwgdGhpcy5vblNldFNpbXBsZVByb3BlcnR5LCB0aGlzKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQ09NUExFWF9QUk9QRVJUSUVTLmZvckVhY2goKHByb3ApID0+IHtcbiAgICAgICAgICAgIHRoaXMub24oYHNldF8ke3Byb3B9YCwgdGhpcy5vblNldENvbXBsZXhQcm9wZXJ0eSwgdGhpcyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEdSQVBIX1BST1BFUlRJRVMuZm9yRWFjaCgocHJvcCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbihgc2V0XyR7cHJvcH1gLCB0aGlzLm9uU2V0R3JhcGhQcm9wZXJ0eSwgdGhpcyk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldCBkcmF3T3JkZXIoZHJhd09yZGVyKSB7XG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IGRyYXdPcmRlcjtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRyYXdPcmRlciA9IGRyYXdPcmRlcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBkcmF3T3JkZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgYWRkTWVzaEluc3RhbmNlVG9MYXllcnMoKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKFt0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlXSk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVNZXNoSW5zdGFuY2VGcm9tTGF5ZXJzKCkge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhbdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRMYXllcnMobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQob2xkVmFsdWVbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZXdWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChuZXdWYWx1ZVtpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkTWVzaEluc3RhbmNlVG9MYXllcnMoKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICBfYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3VubG9hZCcsIHRoaXMuX29uQ29sb3JNYXBBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Db2xvck1hcEFzc2V0Q2hhbmdlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uQ29sb3JNYXBBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Db2xvck1hcEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25Db2xvck1hcEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uQ29sb3JNYXBBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5jb2xvck1hcCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbkNvbG9yTWFwQXNzZXRVbmxvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5jb2xvck1hcCA9IG51bGw7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbkNvbG9yTWFwQXNzZXRVbmxvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIF9vbkNvbG9yTWFwQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICBvblNldENvbG9yTWFwQXNzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGlmIChvbGRWYWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG9sZFZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5jb2xvck1hcEFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRDb2xvck1hcEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2FkZDonICsgbmV3VmFsdWUsIChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kQ29sb3JNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yTWFwID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLm5vcm1hbE1hcCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubm9ybWFsTWFwID0gbnVsbDtcbiAgICB9XG5cbiAgICBfb25Ob3JtYWxNYXBBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25Ob3JtYWxNYXBBc3NldENoYW5nZShhc3NldCkge1xuICAgIH1cblxuICAgIG9uU2V0Tm9ybWFsTWFwQXNzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG5cbiAgICAgICAgaWYgKG9sZFZhbHVlKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQob2xkVmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5ub3JtYWxNYXBBc3NldCA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChuZXdWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub25jZSgnYWRkOicgKyBuZXdWYWx1ZSwgKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmROb3JtYWxNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbE1hcCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZE1lc2hBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk1lc2hBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbk1lc2hBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1lc2hBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1lc2hBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZE1lc2hBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1lc2hBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1lc2hBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NZXNoQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vbk1lc2hBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25NZXNoQ2hhbmdlZChhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgX29uTWVzaEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubWVzaCA9IG51bGw7XG4gICAgfVxuXG4gICAgX29uTWVzaEFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uTWVzaEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25NZXNoQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICBvblNldE1lc2hBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRNZXNoQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5tZXNoQXNzZXQgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgICAgICBuZXdWYWx1ZSA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQobmV3VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1lc2hBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1lc2hDaGFuZ2VkKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRNZXNoKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICAvLyBoYWNrIHRoaXMgZm9yIG5vd1xuICAgICAgICAvLyBpZiB0aGUgdmFsdWUgYmVpbmcgc2V0IGlzIG51bGwsIGFuIGFzc2V0IG9yIGFuIGFzc2V0IGlkLCB0aGVuIGFzc3VtZSB3ZSBhcmVcbiAgICAgICAgLy8gc2V0dGluZyB0aGUgbWVzaCBhc3NldCwgd2hpY2ggd2lsbCBpbiB0dXJuIHVwZGF0ZSB0aGUgbWVzaFxuICAgICAgICBpZiAoIW5ld1ZhbHVlIHx8IG5ld1ZhbHVlIGluc3RhbmNlb2YgQXNzZXQgfHwgdHlwZW9mIG5ld1ZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy5tZXNoQXNzZXQgPSBuZXdWYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobmV3VmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTWVzaENoYW5nZWQobWVzaCkge1xuICAgICAgICBpZiAobWVzaCAmJiAhKG1lc2ggaW5zdGFuY2VvZiBNZXNoKSkge1xuICAgICAgICAgICAgLy8gaWYgbWVzaCBpcyBhIHBjLk1vZGVsLCB1c2UgdGhlIGZpcnN0IG1lc2hJbnN0YW5jZVxuICAgICAgICAgICAgaWYgKG1lc2gubWVzaEluc3RhbmNlc1swXSkge1xuICAgICAgICAgICAgICAgIG1lc2ggPSBtZXNoLm1lc2hJbnN0YW5jZXNbMF0ubWVzaDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVzaCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRhdGEubWVzaCA9IG1lc2g7XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2ggPSBtZXNoO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICAgICAgICAgIHRoaXMucmVidWlsZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRSZW5kZXJBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRSZW5kZXJBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLnJlbmRlckFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRSZW5kZXJBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vblJlbmRlckNoYW5nZWQobnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZFJlbmRlckFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblJlbmRlckFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGRvbid0IHRyaWdnZXIgYW4gYXNzZXQgbG9hZCB1bmxlc3MgdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRSZW5kZXJBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vblJlbmRlckFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25SZW5kZXJBc3NldFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBhc3NldC5yZXNvdXJjZS5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblJlbmRlclNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25SZW5kZXJDaGFuZ2VkKGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9vblJlbmRlckNoYW5nZWQobnVsbCk7XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZChhc3NldCk7XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQ2hhbmdlZChyZW5kZXIpIHtcbiAgICAgICAgaWYgKCFyZW5kZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobnVsbCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZW5kZXIub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25SZW5kZXJTZXRNZXNoZXMsIHRoaXMpO1xuICAgICAgICByZW5kZXIub24oJ3NldDptZXNoZXMnLCB0aGlzLl9vblJlbmRlclNldE1lc2hlcywgdGhpcyk7XG5cbiAgICAgICAgaWYgKHJlbmRlci5tZXNoZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyU2V0TWVzaGVzKHJlbmRlci5tZXNoZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyU2V0TWVzaGVzKG1lc2hlcykge1xuICAgICAgICB0aGlzLl9vbk1lc2hDaGFuZ2VkKG1lc2hlcyAmJiBtZXNoZXNbMF0pO1xuICAgIH1cblxuICAgIG9uU2V0TG9vcChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRUaW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldEJsZW5kVHlwZShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubWF0ZXJpYWwuYmxlbmRUeXBlID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRNYXRlcmlhbCgpO1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVxdWVzdERlcHRoKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVxdWVzdGVkRGVwdGgpIHJldHVybjtcbiAgICAgICAgaWYgKCFkZXB0aExheWVyKSBkZXB0aExheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9ERVBUSCk7XG4gICAgICAgIGlmIChkZXB0aExheWVyKSB7XG4gICAgICAgICAgICBkZXB0aExheWVyLmluY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgIHRoaXMuX3JlcXVlc3RlZERlcHRoID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZWxlYXNlRGVwdGgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcmVxdWVzdGVkRGVwdGgpIHJldHVybjtcbiAgICAgICAgaWYgKGRlcHRoTGF5ZXIpIHtcbiAgICAgICAgICAgIGRlcHRoTGF5ZXIuZGVjcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgdGhpcy5fcmVxdWVzdGVkRGVwdGggPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU2V0RGVwdGhTb2Z0ZW5pbmcobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmIChvbGRWYWx1ZSAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkgdGhpcy5fcmVxdWVzdERlcHRoKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkgdGhpcy5fcmVsZWFzZURlcHRoKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldFNpbXBsZVByb3BlcnR5KG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldENvbXBsZXhQcm9wZXJ0eShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRNYXRlcmlhbCgpO1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldEdyYXBoUHJvcGVydHkobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlcltuYW1lXSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlYnVpbGRHcmFwaHMoKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgLy8gZ2V0IGRhdGEgc3RvcmUgb25jZVxuICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIC8vIGxvYWQgYW55IGFzc2V0cyB0aGF0IGhhdmVuJ3QgYmVlbiBsb2FkZWQgeWV0XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBBU1NFVF9QUk9QRVJUSUVTLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYXNzZXQgPSBkYXRhW0FTU0VUX1BST1BFUlRJRVNbaV1dO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgaWYgKCEoYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaWQgPSBwYXJzZUludChhc3NldCwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWQgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhc3NldCAmJiAhYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgbGV0IG1lc2ggPSBkYXRhLm1lc2g7XG5cbiAgICAgICAgICAgIC8vIG1lc2ggbWlnaHQgYmUgYW4gYXNzZXQgaWQgb2YgYW4gYXNzZXRcbiAgICAgICAgICAgIC8vIHRoYXQgaGFzbid0IGJlZW4gbG9hZGVkIHlldFxuICAgICAgICAgICAgaWYgKCEobWVzaCBpbnN0YW5jZW9mIE1lc2gpKVxuICAgICAgICAgICAgICAgIG1lc2ggPSBudWxsO1xuXG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIgPSBuZXcgUGFydGljbGVFbWl0dGVyKHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZSwge1xuICAgICAgICAgICAgICAgIG51bVBhcnRpY2xlczogZGF0YS5udW1QYXJ0aWNsZXMsXG4gICAgICAgICAgICAgICAgZW1pdHRlckV4dGVudHM6IGRhdGEuZW1pdHRlckV4dGVudHMsXG4gICAgICAgICAgICAgICAgZW1pdHRlckV4dGVudHNJbm5lcjogZGF0YS5lbWl0dGVyRXh0ZW50c0lubmVyLFxuICAgICAgICAgICAgICAgIGVtaXR0ZXJSYWRpdXM6IGRhdGEuZW1pdHRlclJhZGl1cyxcbiAgICAgICAgICAgICAgICBlbWl0dGVyUmFkaXVzSW5uZXI6IGRhdGEuZW1pdHRlclJhZGl1c0lubmVyLFxuICAgICAgICAgICAgICAgIGVtaXR0ZXJTaGFwZTogZGF0YS5lbWl0dGVyU2hhcGUsXG4gICAgICAgICAgICAgICAgaW5pdGlhbFZlbG9jaXR5OiBkYXRhLmluaXRpYWxWZWxvY2l0eSxcbiAgICAgICAgICAgICAgICB3cmFwOiBkYXRhLndyYXAsXG4gICAgICAgICAgICAgICAgbG9jYWxTcGFjZTogZGF0YS5sb2NhbFNwYWNlLFxuICAgICAgICAgICAgICAgIHNjcmVlblNwYWNlOiBkYXRhLnNjcmVlblNwYWNlLFxuICAgICAgICAgICAgICAgIHdyYXBCb3VuZHM6IGRhdGEud3JhcEJvdW5kcyxcbiAgICAgICAgICAgICAgICBsaWZldGltZTogZGF0YS5saWZldGltZSxcbiAgICAgICAgICAgICAgICByYXRlOiBkYXRhLnJhdGUsXG4gICAgICAgICAgICAgICAgcmF0ZTI6IGRhdGEucmF0ZTIsXG5cbiAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogZGF0YS5vcmllbnRhdGlvbixcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZU5vcm1hbDogZGF0YS5wYXJ0aWNsZU5vcm1hbCxcblxuICAgICAgICAgICAgICAgIGFuaW1UaWxlc1g6IGRhdGEuYW5pbVRpbGVzWCxcbiAgICAgICAgICAgICAgICBhbmltVGlsZXNZOiBkYXRhLmFuaW1UaWxlc1ksXG4gICAgICAgICAgICAgICAgYW5pbVN0YXJ0RnJhbWU6IGRhdGEuYW5pbVN0YXJ0RnJhbWUsXG4gICAgICAgICAgICAgICAgYW5pbU51bUZyYW1lczogZGF0YS5hbmltTnVtRnJhbWVzLFxuICAgICAgICAgICAgICAgIGFuaW1OdW1BbmltYXRpb25zOiBkYXRhLmFuaW1OdW1BbmltYXRpb25zLFxuICAgICAgICAgICAgICAgIGFuaW1JbmRleDogZGF0YS5hbmltSW5kZXgsXG4gICAgICAgICAgICAgICAgcmFuZG9taXplQW5pbUluZGV4OiBkYXRhLnJhbmRvbWl6ZUFuaW1JbmRleCxcbiAgICAgICAgICAgICAgICBhbmltU3BlZWQ6IGRhdGEuYW5pbVNwZWVkLFxuICAgICAgICAgICAgICAgIGFuaW1Mb29wOiBkYXRhLmFuaW1Mb29wLFxuXG4gICAgICAgICAgICAgICAgc3RhcnRBbmdsZTogZGF0YS5zdGFydEFuZ2xlLFxuICAgICAgICAgICAgICAgIHN0YXJ0QW5nbGUyOiBkYXRhLnN0YXJ0QW5nbGUyLFxuXG4gICAgICAgICAgICAgICAgc2NhbGVHcmFwaDogZGF0YS5zY2FsZUdyYXBoLFxuICAgICAgICAgICAgICAgIHNjYWxlR3JhcGgyOiBkYXRhLnNjYWxlR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgY29sb3JHcmFwaDogZGF0YS5jb2xvckdyYXBoLFxuICAgICAgICAgICAgICAgIGNvbG9yR3JhcGgyOiBkYXRhLmNvbG9yR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgYWxwaGFHcmFwaDogZGF0YS5hbHBoYUdyYXBoLFxuICAgICAgICAgICAgICAgIGFscGhhR3JhcGgyOiBkYXRhLmFscGhhR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgbG9jYWxWZWxvY2l0eUdyYXBoOiBkYXRhLmxvY2FsVmVsb2NpdHlHcmFwaCxcbiAgICAgICAgICAgICAgICBsb2NhbFZlbG9jaXR5R3JhcGgyOiBkYXRhLmxvY2FsVmVsb2NpdHlHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICB2ZWxvY2l0eUdyYXBoOiBkYXRhLnZlbG9jaXR5R3JhcGgsXG4gICAgICAgICAgICAgICAgdmVsb2NpdHlHcmFwaDI6IGRhdGEudmVsb2NpdHlHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICByb3RhdGlvblNwZWVkR3JhcGg6IGRhdGEucm90YXRpb25TcGVlZEdyYXBoLFxuICAgICAgICAgICAgICAgIHJvdGF0aW9uU3BlZWRHcmFwaDI6IGRhdGEucm90YXRpb25TcGVlZEdyYXBoMixcblxuICAgICAgICAgICAgICAgIHJhZGlhbFNwZWVkR3JhcGg6IGRhdGEucmFkaWFsU3BlZWRHcmFwaCxcbiAgICAgICAgICAgICAgICByYWRpYWxTcGVlZEdyYXBoMjogZGF0YS5yYWRpYWxTcGVlZEdyYXBoMixcblxuICAgICAgICAgICAgICAgIGNvbG9yTWFwOiBkYXRhLmNvbG9yTWFwLFxuICAgICAgICAgICAgICAgIG5vcm1hbE1hcDogZGF0YS5ub3JtYWxNYXAsXG4gICAgICAgICAgICAgICAgbG9vcDogZGF0YS5sb29wLFxuICAgICAgICAgICAgICAgIHByZVdhcm06IGRhdGEucHJlV2FybSxcbiAgICAgICAgICAgICAgICBzb3J0OiBkYXRhLnNvcnQsXG4gICAgICAgICAgICAgICAgc3RyZXRjaDogZGF0YS5zdHJldGNoLFxuICAgICAgICAgICAgICAgIGFsaWduVG9Nb3Rpb246IGRhdGEuYWxpZ25Ub01vdGlvbixcbiAgICAgICAgICAgICAgICBsaWdodGluZzogZGF0YS5saWdodGluZyxcbiAgICAgICAgICAgICAgICBoYWxmTGFtYmVydDogZGF0YS5oYWxmTGFtYmVydCxcbiAgICAgICAgICAgICAgICBpbnRlbnNpdHk6IGRhdGEuaW50ZW5zaXR5LFxuICAgICAgICAgICAgICAgIGRlcHRoU29mdGVuaW5nOiBkYXRhLmRlcHRoU29mdGVuaW5nLFxuICAgICAgICAgICAgICAgIHNjZW5lOiB0aGlzLnN5c3RlbS5hcHAuc2NlbmUsXG4gICAgICAgICAgICAgICAgbWVzaDogbWVzaCxcbiAgICAgICAgICAgICAgICBkZXB0aFdyaXRlOiBkYXRhLmRlcHRoV3JpdGUsXG4gICAgICAgICAgICAgICAgbm9Gb2c6IGRhdGEubm9Gb2csXG4gICAgICAgICAgICAgICAgbm9kZTogdGhpcy5lbnRpdHksXG4gICAgICAgICAgICAgICAgYmxlbmRUeXBlOiBkYXRhLmJsZW5kVHlwZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2Uubm9kZSA9IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRyYXdPcmRlciA9IHRoaXMuZHJhd09yZGVyO1xuXG4gICAgICAgICAgICBpZiAoIWRhdGEuYXV0b1BsYXkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyLmNvbG9yTWFwKSB7XG4gICAgICAgICAgICB0aGlzLmFkZE1lc2hJbnN0YW5jZVRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUub24oJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCAmJiBkYXRhLmRlcHRoU29mdGVuaW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXF1ZXN0RGVwdGgoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1lc2hJbnN0YW5jZUZyb21MYXllcnMoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuZGVwdGhTb2Z0ZW5pbmcpIHRoaXMuX3JlbGVhc2VEZXB0aCgpO1xuXG4gICAgICAgICAgICAvLyBjbGVhciBjYW1lcmEgYXMgaXQgaXNuJ3QgdXBkYXRlZCB3aGlsZSBkaXNhYmxlZCBhbmQgd2UgZG9uJ3Qgd2FudCB0byBob2xkXG4gICAgICAgICAgICAvLyBvbnRvIG9sZCByZWZlcmVuY2VcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5jYW1lcmEgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoKSB7XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbGVhciBhbGwgYXNzZXQgcHJvcGVydGllcyB0byByZW1vdmUgYW55IGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IEFTU0VUX1BST1BFUlRJRVMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3AgPSBBU1NFVF9QUk9QRVJUSUVTW2ldO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhW3Byb3BdKSB7XG4gICAgICAgICAgICAgICAgdGhpc1twcm9wXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0cyBwYXJ0aWNsZSBzdGF0ZSwgZG9lc24ndCBhZmZlY3QgcGxheWluZy5cbiAgICAgKi9cbiAgICByZXNldCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXNhYmxlcyB0aGUgZW1pc3Npb24gb2YgbmV3IHBhcnRpY2xlcywgbGV0cyBleGlzdGluZyB0byBmaW5pc2ggdGhlaXIgc2ltdWxhdGlvbi5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubG9vcCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0VGltZSgpO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmFkZFRpbWUoMCwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlemVzIHRoZSBzaW11bGF0aW9uLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICB0aGlzLmRhdGEucGF1c2VkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmZyZWV6ZXMgdGhlIHNpbXVsYXRpb24uXG4gICAgICovXG4gICAgdW5wYXVzZSgpIHtcbiAgICAgICAgdGhpcy5kYXRhLnBhdXNlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMvdW5mcmVlemVzIHRoZSBzaW11bGF0aW9uLlxuICAgICAqL1xuICAgIHBsYXkoKSB7XG4gICAgICAgIHRoaXMuZGF0YS5wYXVzZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5sb29wID0gdGhpcy5kYXRhLmxvb3A7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRUaW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgc2ltdWxhdGlvbiBpcyBpbiBwcm9ncmVzcy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBwYXJ0aWNsZSBzeXN0ZW0gaXMgY3VycmVudGx5IHBsYXlpbmcgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBpc1BsYXlpbmcoKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEucGF1c2VkKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlciAmJiB0aGlzLmVtaXR0ZXIubG9vcCkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwb3NzaWJsZSBidWcgaGVyZSB3aGF0IGhhcHBlbnMgaWYgdGhlIG5vbiBsb29waW5nIGVtaXR0ZXJcbiAgICAgICAgLy8gd2FzIHBhdXNlZCBpbiB0aGUgbWVhbnRpbWU/XG4gICAgICAgIHJldHVybiBEYXRlLm5vdygpIDw9IHRoaXMuZW1pdHRlci5lbmRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlYnVpbGRzIGFsbCBkYXRhIHVzZWQgYnkgdGhpcyBwYXJ0aWNsZSBzeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHJlYnVpbGQoKSB7XG4gICAgICAgIGNvbnN0IGVuYWJsZWQgPSB0aGlzLmVuYWJsZWQ7XG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVidWlsZCgpOyAvLyB3b3JzdCBjYXNlOiByZXF1aXJlZCB0byByZWJ1aWxkIGJ1ZmZlcnMvc2hhZGVyc1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS5ub2RlID0gdGhpcy5lbnRpdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbmFibGVkID0gZW5hYmxlZDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiU0lNUExFX1BST1BFUlRJRVMiLCJDT01QTEVYX1BST1BFUlRJRVMiLCJHUkFQSF9QUk9QRVJUSUVTIiwiQVNTRVRfUFJPUEVSVElFUyIsImRlcHRoTGF5ZXIiLCJQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3JlcXVlc3RlZERlcHRoIiwiX2RyYXdPcmRlciIsIm9uIiwib25TZXRDb2xvck1hcEFzc2V0Iiwib25TZXROb3JtYWxNYXBBc3NldCIsIm9uU2V0TWVzaEFzc2V0Iiwib25TZXRNZXNoIiwib25TZXRSZW5kZXJBc3NldCIsIm9uU2V0TG9vcCIsIm9uU2V0QmxlbmRUeXBlIiwib25TZXREZXB0aFNvZnRlbmluZyIsIm9uU2V0TGF5ZXJzIiwiZm9yRWFjaCIsInByb3AiLCJvblNldFNpbXBsZVByb3BlcnR5Iiwib25TZXRDb21wbGV4UHJvcGVydHkiLCJvblNldEdyYXBoUHJvcGVydHkiLCJkcmF3T3JkZXIiLCJlbWl0dGVyIiwiYWRkTWVzaEluc3RhbmNlVG9MYXllcnMiLCJpIiwibGF5ZXJzIiwibGVuZ3RoIiwibGF5ZXIiLCJhcHAiLCJzY2VuZSIsImdldExheWVyQnlJZCIsImFkZE1lc2hJbnN0YW5jZXMiLCJtZXNoSW5zdGFuY2UiLCJfbGF5ZXIiLCJyZW1vdmVNZXNoSW5zdGFuY2VGcm9tTGF5ZXJzIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIm5hbWUiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwiZW5hYmxlZCIsIm9uTGF5ZXJzQ2hhbmdlZCIsIm9sZENvbXAiLCJuZXdDb21wIiwib2ZmIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJpbmRleCIsImluZGV4T2YiLCJpZCIsIl9iaW5kQ29sb3JNYXBBc3NldCIsImFzc2V0IiwiX29uQ29sb3JNYXBBc3NldExvYWQiLCJfb25Db2xvck1hcEFzc2V0VW5sb2FkIiwiX29uQ29sb3JNYXBBc3NldFJlbW92ZSIsIl9vbkNvbG9yTWFwQXNzZXRDaGFuZ2UiLCJyZXNvdXJjZSIsImFzc2V0cyIsImxvYWQiLCJfdW5iaW5kQ29sb3JNYXBBc3NldCIsImNvbG9yTWFwIiwiZ2V0IiwiQXNzZXQiLCJkYXRhIiwiY29sb3JNYXBBc3NldCIsIm9uY2UiLCJfYmluZE5vcm1hbE1hcEFzc2V0IiwiX29uTm9ybWFsTWFwQXNzZXRMb2FkIiwiX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQiLCJfb25Ob3JtYWxNYXBBc3NldFJlbW92ZSIsIl9vbk5vcm1hbE1hcEFzc2V0Q2hhbmdlIiwiX3VuYmluZE5vcm1hbE1hcEFzc2V0Iiwibm9ybWFsTWFwIiwibm9ybWFsTWFwQXNzZXQiLCJfYmluZE1lc2hBc3NldCIsIl9vbk1lc2hBc3NldExvYWQiLCJfb25NZXNoQXNzZXRVbmxvYWQiLCJfb25NZXNoQXNzZXRSZW1vdmUiLCJfb25NZXNoQXNzZXRDaGFuZ2UiLCJfdW5iaW5kTWVzaEFzc2V0IiwiX29uTWVzaENoYW5nZWQiLCJtZXNoIiwibWVzaEFzc2V0IiwiTWVzaCIsIm1lc2hJbnN0YW5jZXMiLCJyZXNldE1hdGVyaWFsIiwicmVidWlsZCIsIl91bmJpbmRSZW5kZXJBc3NldCIsInJlbmRlckFzc2V0IiwiX2JpbmRSZW5kZXJBc3NldCIsIl9vblJlbmRlckNoYW5nZWQiLCJfb25SZW5kZXJBc3NldExvYWQiLCJfb25SZW5kZXJBc3NldFVubG9hZCIsIl9vblJlbmRlckFzc2V0UmVtb3ZlIiwiX29uUmVuZGVyU2V0TWVzaGVzIiwicmVuZGVyIiwibWVzaGVzIiwicmVzZXRUaW1lIiwibWF0ZXJpYWwiLCJibGVuZFR5cGUiLCJfcmVxdWVzdERlcHRoIiwiTEFZRVJJRF9ERVBUSCIsImluY3JlbWVudENvdW50ZXIiLCJfcmVsZWFzZURlcHRoIiwiZGVjcmVtZW50Q291bnRlciIsInJlc2V0IiwicmVidWlsZEdyYXBocyIsIm9uRW5hYmxlIiwibGVuIiwicGFyc2VJbnQiLCJQYXJ0aWNsZUVtaXR0ZXIiLCJncmFwaGljc0RldmljZSIsIm51bVBhcnRpY2xlcyIsImVtaXR0ZXJFeHRlbnRzIiwiZW1pdHRlckV4dGVudHNJbm5lciIsImVtaXR0ZXJSYWRpdXMiLCJlbWl0dGVyUmFkaXVzSW5uZXIiLCJlbWl0dGVyU2hhcGUiLCJpbml0aWFsVmVsb2NpdHkiLCJ3cmFwIiwibG9jYWxTcGFjZSIsInNjcmVlblNwYWNlIiwid3JhcEJvdW5kcyIsImxpZmV0aW1lIiwicmF0ZSIsInJhdGUyIiwib3JpZW50YXRpb24iLCJwYXJ0aWNsZU5vcm1hbCIsImFuaW1UaWxlc1giLCJhbmltVGlsZXNZIiwiYW5pbVN0YXJ0RnJhbWUiLCJhbmltTnVtRnJhbWVzIiwiYW5pbU51bUFuaW1hdGlvbnMiLCJhbmltSW5kZXgiLCJyYW5kb21pemVBbmltSW5kZXgiLCJhbmltU3BlZWQiLCJhbmltTG9vcCIsInN0YXJ0QW5nbGUiLCJzdGFydEFuZ2xlMiIsInNjYWxlR3JhcGgiLCJzY2FsZUdyYXBoMiIsImNvbG9yR3JhcGgiLCJjb2xvckdyYXBoMiIsImFscGhhR3JhcGgiLCJhbHBoYUdyYXBoMiIsImxvY2FsVmVsb2NpdHlHcmFwaCIsImxvY2FsVmVsb2NpdHlHcmFwaDIiLCJ2ZWxvY2l0eUdyYXBoIiwidmVsb2NpdHlHcmFwaDIiLCJyb3RhdGlvblNwZWVkR3JhcGgiLCJyb3RhdGlvblNwZWVkR3JhcGgyIiwicmFkaWFsU3BlZWRHcmFwaCIsInJhZGlhbFNwZWVkR3JhcGgyIiwibG9vcCIsInByZVdhcm0iLCJzb3J0Iiwic3RyZXRjaCIsImFsaWduVG9Nb3Rpb24iLCJsaWdodGluZyIsImhhbGZMYW1iZXJ0IiwiaW50ZW5zaXR5IiwiZGVwdGhTb2Z0ZW5pbmciLCJkZXB0aFdyaXRlIiwibm9Gb2ciLCJub2RlIiwiYXV0b1BsYXkiLCJwYXVzZSIsInZpc2libGUiLCJvbkRpc2FibGUiLCJjYW1lcmEiLCJvbkJlZm9yZVJlbW92ZSIsImRlc3Ryb3kiLCJzdG9wIiwiYWRkVGltZSIsInBhdXNlZCIsInVucGF1c2UiLCJwbGF5IiwiaXNQbGF5aW5nIiwiRGF0ZSIsIm5vdyIsImVuZFRpbWUiXSwibWFwcGluZ3MiOiI7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
