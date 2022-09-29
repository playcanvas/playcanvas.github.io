/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_DEPTH } from '../../../scene/constants.js';
import { Mesh } from '../../../scene/mesh.js';
import { ParticleEmitter } from '../../../scene/particle-system/particle-emitter.js';
import { Asset } from '../../../asset/asset.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcGFydGljbGUtc3lzdGVtL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX0RFUFRIIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IE1lc2ggfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tZXNoLmpzJztcbmltcG9ydCB7IFBhcnRpY2xlRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3BhcnRpY2xlLXN5c3RlbS9wYXJ0aWNsZS1lbWl0dGVyLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi8uLi9hc3NldC9hc3NldC5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9tYXRoL2N1cnZlLmpzJykuQ3VydmV9IEN1cnZlICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vbWF0aC9jdXJ2ZS1zZXQuanMnKS5DdXJ2ZVNldH0gQ3VydmVTZXQgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi8uLi9tYXRoL3ZlYzMuanMnKS5WZWMzfSBWZWMzICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlBhcnRpY2xlU3lzdGVtQ29tcG9uZW50U3lzdGVtfSBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudFN5c3RlbSAqL1xuXG4vLyBwcm9wZXJ0aWVzIHRoYXQgZG8gbm90IG5lZWQgcmVidWlsZGluZyB0aGUgcGFydGljbGUgc3lzdGVtXG5jb25zdCBTSU1QTEVfUFJPUEVSVElFUyA9IFtcbiAgICAnZW1pdHRlckV4dGVudHMnLFxuICAgICdlbWl0dGVyUmFkaXVzJyxcbiAgICAnZW1pdHRlckV4dGVudHNJbm5lcicsXG4gICAgJ2VtaXR0ZXJSYWRpdXNJbm5lcicsXG4gICAgJ2xvb3AnLFxuICAgICdpbml0aWFsVmVsb2NpdHknLFxuICAgICdhbmltU3BlZWQnLFxuICAgICdub3JtYWxNYXAnLFxuICAgICdwYXJ0aWNsZU5vcm1hbCdcbl07XG5cbi8vIHByb3BlcnRpZXMgdGhhdCBuZWVkIHJlYnVpbGRpbmcgdGhlIHBhcnRpY2xlIHN5c3RlbVxuY29uc3QgQ09NUExFWF9QUk9QRVJUSUVTID0gW1xuICAgICdudW1QYXJ0aWNsZXMnLFxuICAgICdsaWZldGltZScsXG4gICAgJ3JhdGUnLFxuICAgICdyYXRlMicsXG4gICAgJ3N0YXJ0QW5nbGUnLFxuICAgICdzdGFydEFuZ2xlMicsXG4gICAgJ2xpZ2h0aW5nJyxcbiAgICAnaGFsZkxhbWJlcnQnLFxuICAgICdpbnRlbnNpdHknLFxuICAgICd3cmFwJyxcbiAgICAnd3JhcEJvdW5kcycsXG4gICAgJ2RlcHRoV3JpdGUnLFxuICAgICdub0ZvZycsXG4gICAgJ3NvcnQnLFxuICAgICdzdHJldGNoJyxcbiAgICAnYWxpZ25Ub01vdGlvbicsXG4gICAgJ3ByZVdhcm0nLFxuICAgICdlbWl0dGVyU2hhcGUnLFxuICAgICdhbmltVGlsZXNYJyxcbiAgICAnYW5pbVRpbGVzWScsXG4gICAgJ2FuaW1TdGFydEZyYW1lJyxcbiAgICAnYW5pbU51bUZyYW1lcycsXG4gICAgJ2FuaW1OdW1BbmltYXRpb25zJyxcbiAgICAnYW5pbUluZGV4JyxcbiAgICAncmFuZG9taXplQW5pbUluZGV4JyxcbiAgICAnYW5pbUxvb3AnLFxuICAgICdjb2xvck1hcCcsXG4gICAgJ2xvY2FsU3BhY2UnLFxuICAgICdzY3JlZW5TcGFjZScsXG4gICAgJ29yaWVudGF0aW9uJ1xuXTtcblxuY29uc3QgR1JBUEhfUFJPUEVSVElFUyA9IFtcbiAgICAnc2NhbGVHcmFwaCcsXG4gICAgJ3NjYWxlR3JhcGgyJyxcblxuICAgICdjb2xvckdyYXBoJyxcbiAgICAnY29sb3JHcmFwaDInLFxuXG4gICAgJ2FscGhhR3JhcGgnLFxuICAgICdhbHBoYUdyYXBoMicsXG5cbiAgICAndmVsb2NpdHlHcmFwaCcsXG4gICAgJ3ZlbG9jaXR5R3JhcGgyJyxcblxuICAgICdsb2NhbFZlbG9jaXR5R3JhcGgnLFxuICAgICdsb2NhbFZlbG9jaXR5R3JhcGgyJyxcblxuICAgICdyb3RhdGlvblNwZWVkR3JhcGgnLFxuICAgICdyb3RhdGlvblNwZWVkR3JhcGgyJyxcblxuICAgICdyYWRpYWxTcGVlZEdyYXBoJyxcbiAgICAncmFkaWFsU3BlZWRHcmFwaDInXG5dO1xuXG5jb25zdCBBU1NFVF9QUk9QRVJUSUVTID0gW1xuICAgICdjb2xvck1hcEFzc2V0JyxcbiAgICAnbm9ybWFsTWFwQXNzZXQnLFxuICAgICdtZXNoQXNzZXQnLFxuICAgICdyZW5kZXJBc3NldCdcbl07XG5cbmxldCBkZXB0aExheWVyO1xuXG4vKipcbiAqIFVzZWQgdG8gc2ltdWxhdGUgcGFydGljbGVzIGFuZCBwcm9kdWNlIHJlbmRlcmFibGUgcGFydGljbGUgbWVzaCBvbiBlaXRoZXIgQ1BVIG9yIEdQVS4gR1BVXG4gKiBzaW11bGF0aW9uIGlzIGdlbmVyYWxseSBtdWNoIGZhc3RlciB0aGFuIGl0cyBDUFUgY291bnRlcnBhcnQsIGJlY2F1c2UgaXQgYXZvaWRzIHNsb3cgQ1BVLUdQVVxuICogc3luY2hyb25pemF0aW9uIGFuZCB0YWtlcyBhZHZhbnRhZ2Ugb2YgbWFueSBHUFUgY29yZXMuIEhvd2V2ZXIsIGl0IHJlcXVpcmVzIGNsaWVudCB0byBzdXBwb3J0XG4gKiByZWFzb25hYmxlIHVuaWZvcm0gY291bnQsIHJlYWRpbmcgZnJvbSBtdWx0aXBsZSB0ZXh0dXJlcyBpbiB2ZXJ0ZXggc2hhZGVyIGFuZCBPRVNfdGV4dHVyZV9mbG9hdFxuICogZXh0ZW5zaW9uLCBpbmNsdWRpbmcgcmVuZGVyaW5nIGludG8gZmxvYXQgdGV4dHVyZXMuIE1vc3QgbW9iaWxlIGRldmljZXMgZmFpbCB0byBzYXRpc2Z5IHRoZXNlXG4gKiByZXF1aXJlbWVudHMsIHNvIGl0J3Mgbm90IHJlY29tbWVuZGVkIHRvIHNpbXVsYXRlIHRob3VzYW5kcyBvZiBwYXJ0aWNsZXMgb24gdGhlbS4gR1BVIHZlcnNpb25cbiAqIGFsc28gY2FuJ3Qgc29ydCBwYXJ0aWNsZXMsIHNvIGVuYWJsaW5nIHNvcnRpbmcgZm9yY2VzIENQVSBtb2RlIHRvby4gUGFydGljbGUgcm90YXRpb24gaXNcbiAqIHNwZWNpZmllZCBieSBhIHNpbmdsZSBhbmdsZSBwYXJhbWV0ZXI6IGRlZmF1bHQgYmlsbGJvYXJkIHBhcnRpY2xlcyByb3RhdGUgYXJvdW5kIGNhbWVyYSBmYWNpbmdcbiAqIGF4aXMsIHdoaWxlIG1lc2ggcGFydGljbGVzIHJvdGF0ZSBhcm91bmQgMiBkaWZmZXJlbnQgdmlldy1pbmRlcGVuZGVudCBheGVzLiBNb3N0IG9mIHRoZVxuICogc2ltdWxhdGlvbiBwYXJhbWV0ZXJzIGFyZSBzcGVjaWZpZWQgd2l0aCB7QGxpbmsgQ3VydmV9IG9yIHtAbGluayBDdXJ2ZVNldH0uIEN1cnZlcyBhcmVcbiAqIGludGVycG9sYXRlZCBiYXNlZCBvbiBlYWNoIHBhcnRpY2xlJ3MgbGlmZXRpbWUsIHRoZXJlZm9yZSBwYXJhbWV0ZXJzIGFyZSBhYmxlIHRvIGNoYW5nZSBvdmVyXG4gKiB0aW1lLiBNb3N0IG9mIHRoZSBjdXJ2ZSBwYXJhbWV0ZXJzIGNhbiBhbHNvIGJlIHNwZWNpZmllZCBieSAyIG1pbmltdW0vbWF4aW11bSBjdXJ2ZXMsIHRoaXMgd2F5XG4gKiBlYWNoIHBhcnRpY2xlIHdpbGwgcGljayBhIHJhbmRvbSB2YWx1ZSBpbi1iZXR3ZWVuLlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYXV0b1BsYXkgQ29udHJvbHMgd2hldGhlciB0aGUgcGFydGljbGUgc3lzdGVtIHBsYXlzIGF1dG9tYXRpY2FsbHkgb25cbiAqIGNyZWF0aW9uLiBJZiBzZXQgdG8gZmFsc2UsIGl0IGlzIG5lY2Vzc2FyeSB0byBjYWxsIHtAbGluayBQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudCNwbGF5fSBmb3IgdGhlXG4gKiBwYXJ0aWNsZSBzeXN0ZW0gdG8gcGxheS4gRGVmYXVsdHMgdG8gdHJ1ZS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbG9vcCBFbmFibGVzIG9yIGRpc2FibGVzIHJlc3Bhd25pbmcgb2YgcGFydGljbGVzLlxuICogQHByb3BlcnR5IHtib29sZWFufSBwcmVXYXJtIElmIGVuYWJsZWQsIHRoZSBwYXJ0aWNsZSBzeXN0ZW0gd2lsbCBiZSBpbml0aWFsaXplZCBhcyB0aG91Z2ggaXQgaGFkXG4gKiBhbHJlYWR5IGNvbXBsZXRlZCBhIGZ1bGwgY3ljbGUuIFRoaXMgb25seSB3b3JrcyB3aXRoIGxvb3BpbmcgcGFydGljbGUgc3lzdGVtcy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbGlnaHRpbmcgSWYgZW5hYmxlZCwgcGFydGljbGVzIHdpbGwgYmUgbGl0IGJ5IGFtYmllbnQgYW5kIGRpcmVjdGlvbmFsXG4gKiBsaWdodHMuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGhhbGZMYW1iZXJ0IEVuYWJsaW5nIEhhbGYgTGFtYmVydCBsaWdodGluZyBhdm9pZHMgcGFydGljbGVzIGxvb2tpbmcgdG9vIGZsYXRcbiAqIGluIHNoYWRvd2VkIGFyZWFzLiBJdCBpcyBhIGNvbXBsZXRlbHkgbm9uLXBoeXNpY2FsIGxpZ2h0aW5nIG1vZGVsIGJ1dCBjYW4gZ2l2ZSBtb3JlIHBsZWFzaW5nXG4gKiB2aXN1YWwgcmVzdWx0cy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gYWxpZ25Ub01vdGlvbiBPcmllbnQgcGFydGljbGVzIGluIHRoZWlyIGRpcmVjdGlvbiBvZiBtb3Rpb24uXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGRlcHRoV3JpdGUgSWYgZW5hYmxlZCwgdGhlIHBhcnRpY2xlcyB3aWxsIHdyaXRlIHRvIHRoZSBkZXB0aCBidWZmZXIuIElmXG4gKiBkaXNhYmxlZCwgdGhlIGRlcHRoIGJ1ZmZlciBpcyBsZWZ0IHVuY2hhbmdlZCBhbmQgcGFydGljbGVzIHdpbGwgYmUgZ3VhcmFudGVlZCB0byBvdmVyd3JpdGUgb25lXG4gKiBhbm90aGVyIGluIHRoZSBvcmRlciBpbiB3aGljaCB0aGV5IGFyZSByZW5kZXJlZC5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gbm9Gb2cgRGlzYWJsZSBmb2dnaW5nLlxuICogQHByb3BlcnR5IHtib29sZWFufSBsb2NhbFNwYWNlIEJpbmRzIHBhcnRpY2xlcyB0byBlbWl0dGVyIHRyYW5zZm9ybWF0aW9uIHJhdGhlciB0aGVuIHdvcmxkXG4gKiBzcGFjZS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gc2NyZWVuU3BhY2UgUmVuZGVycyBwYXJ0aWNsZXMgaW4gMkQgc2NyZWVuIHNwYWNlLiBUaGlzIG5lZWRzIHRvIGJlIHNldCB3aGVuXG4gKiBwYXJ0aWNsZSBzeXN0ZW0gaXMgcGFydCBvZiBoaWVyYXJjaHkgd2l0aCB7QGxpbmsgU2NyZWVuQ29tcG9uZW50fSBhcyBpdHMgYW5jZXN0b3IsIGFuZCBhbGxvd3NcbiAqIHBhcnRpY2xlIHN5c3RlbSB0byBpbnRlZ3JhdGUgd2l0aCB0aGUgcmVuZGVyaW5nIG9mIHtAbGluayBFbGVtZW50Q29tcG9uZW50fXMuIE5vdGUgdGhhdCBhblxuICogZW50aXR5IHdpdGggUGFydGljbGVTeXN0ZW0gY29tcG9uZW50IGNhbm5vdCBiZSBwYXJlbnRlZCBkaXJlY3RseSB0byB7QGxpbmsgU2NyZWVuQ29tcG9uZW50fSwgYnV0XG4gKiBoYXMgdG8gYmUgYSBjaGlsZCBvZiBhIHtAbGluayBFbGVtZW50Q29tcG9uZW50fSwgZm9yIGV4YW1wbGUge0BsaW5rIExheW91dEdyb3VwQ29tcG9uZW50fS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBudW1QYXJ0aWNsZXMgTWF4aW11bSBudW1iZXIgb2Ygc2ltdWxhdGVkIHBhcnRpY2xlcy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByYXRlIE1pbmltYWwgaW50ZXJ2YWwgaW4gc2Vjb25kcyBiZXR3ZWVuIHBhcnRpY2xlIGJpcnRocy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByYXRlMiBNYXhpbWFsIGludGVydmFsIGluIHNlY29uZHMgYmV0d2VlbiBwYXJ0aWNsZSBiaXJ0aHMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc3RhcnRBbmdsZSBNaW5pbWFsIGluaXRpYWwgRXVsZXIgYW5nbGUgb2YgYSBwYXJ0aWNsZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzdGFydEFuZ2xlMiBNYXhpbWFsIGluaXRpYWwgRXVsZXIgYW5nbGUgb2YgYSBwYXJ0aWNsZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaWZldGltZSBUaGUgbGVuZ3RoIG9mIHRpbWUgaW4gc2Vjb25kcyBiZXR3ZWVuIGEgcGFydGljbGUncyBiaXJ0aCBhbmQgaXRzXG4gKiBkZWF0aC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBzdHJldGNoIEEgdmFsdWUgaW4gd29ybGQgdW5pdHMgdGhhdCBjb250cm9scyB0aGUgYW1vdW50IGJ5IHdoaWNoIHBhcnRpY2xlc1xuICogYXJlIHN0cmV0Y2hlZCBiYXNlZCBvbiB0aGVpciB2ZWxvY2l0eS4gUGFydGljbGVzIGFyZSBzdHJldGNoZWQgZnJvbSB0aGVpciBjZW50ZXIgdG93YXJkcyB0aGVpclxuICogcHJldmlvdXMgcG9zaXRpb24uXG4gKiBAcHJvcGVydHkge251bWJlcn0gaW50ZW5zaXR5IENvbG9yIG11bHRpcGxpZXIuXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGFuaW1Mb29wIENvbnRyb2xzIHdoZXRoZXIgdGhlIHNwcml0ZSBzaGVldCBhbmltYXRpb24gcGxheXMgb25jZSBvciBsb29wc1xuICogY29udGludW91c2x5LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1UaWxlc1ggTnVtYmVyIG9mIGhvcml6b250YWwgdGlsZXMgaW4gdGhlIHNwcml0ZSBzaGVldC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmltVGlsZXNZIE51bWJlciBvZiB2ZXJ0aWNhbCB0aWxlcyBpbiB0aGUgc3ByaXRlIHNoZWV0LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1OdW1BbmltYXRpb25zIE51bWJlciBvZiBzcHJpdGUgc2hlZXQgYW5pbWF0aW9ucyBjb250YWluZWQgd2l0aGluIHRoZVxuICogY3VycmVudCBzcHJpdGUgc2hlZXQuIFRoZSBudW1iZXIgb2YgYW5pbWF0aW9ucyBtdWx0aXBsaWVkIGJ5IG51bWJlciBvZiBmcmFtZXMgc2hvdWxkIGJlIGEgdmFsdWVcbiAqIGxlc3MgdGhhbiBhbmltVGlsZXNYIG11bHRpcGxpZWQgYnkgYW5pbVRpbGVzWS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmltTnVtRnJhbWVzIE51bWJlciBvZiBzcHJpdGUgc2hlZXQgZnJhbWVzIGluIHRoZSBjdXJyZW50IHNwcml0ZSBzaGVldFxuICogYW5pbWF0aW9uLiBUaGUgbnVtYmVyIG9mIGFuaW1hdGlvbnMgbXVsdGlwbGllZCBieSBudW1iZXIgb2YgZnJhbWVzIHNob3VsZCBiZSBhIHZhbHVlIGxlc3MgdGhhblxuICogYW5pbVRpbGVzWCBtdWx0aXBsaWVkIGJ5IGFuaW1UaWxlc1kuXG4gKiBAcHJvcGVydHkge251bWJlcn0gYW5pbVN0YXJ0RnJhbWUgVGhlIHNwcml0ZSBzaGVldCBmcmFtZSB0aGF0IHRoZSBhbmltYXRpb24gc2hvdWxkIGJlZ2luIHBsYXlpbmdcbiAqIGZyb20uIEluZGV4ZWQgZnJvbSB0aGUgc3RhcnQgb2YgdGhlIGN1cnJlbnQgYW5pbWF0aW9uLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGFuaW1JbmRleCBXaGVuIGFuaW1OdW1BbmltYXRpb25zIGlzIGdyZWF0ZXIgdGhhbiAxLCB0aGUgc3ByaXRlIHNoZWV0XG4gKiBhbmltYXRpb24gaW5kZXggZGV0ZXJtaW5lcyB3aGljaCBhbmltYXRpb24gdGhlIHBhcnRpY2xlIHN5c3RlbSBzaG91bGQgcGxheS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSByYW5kb21pemVBbmltSW5kZXggRWFjaCBwYXJ0aWNsZSBlbWl0dGVkIGJ5IHRoZSBzeXN0ZW0gd2lsbCBwbGF5IGEgcmFuZG9tXG4gKiBhbmltYXRpb24gZnJvbSB0aGUgc3ByaXRlIHNoZWV0LCB1cCB0byBhbmltTnVtQW5pbWF0aW9ucy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBhbmltU3BlZWQgU3ByaXRlIHNoZWV0IGFuaW1hdGlvbiBzcGVlZC4gMSA9IHBhcnRpY2xlIGxpZmV0aW1lLCAyID0gdHdpY2VcbiAqIGR1cmluZyBsaWZldGltZSBldGMuLi5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBkZXB0aFNvZnRlbmluZyBDb250cm9scyBmYWRpbmcgb2YgcGFydGljbGVzIG5lYXIgdGhlaXIgaW50ZXJzZWN0aW9ucyB3aXRoXG4gKiBzY2VuZSBnZW9tZXRyeS4gVGhpcyBlZmZlY3QsIHdoZW4gaXQncyBub24temVybywgcmVxdWlyZXMgc2NlbmUgZGVwdGggbWFwIHRvIGJlIHJlbmRlcmVkLlxuICogTXVsdGlwbGUgZGVwdGgtZGVwZW5kZW50IGVmZmVjdHMgY2FuIHNoYXJlIHRoZSBzYW1lIG1hcCwgYnV0IGlmIHlvdSBvbmx5IHVzZSBpdCBmb3IgcGFydGljbGVzLFxuICogYmVhciBpbiBtaW5kIHRoYXQgaXQgY2FuIGRvdWJsZSBlbmdpbmUgZHJhdyBjYWxscy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbml0aWFsVmVsb2NpdHkgRGVmaW5lcyBtYWduaXR1ZGUgb2YgdGhlIGluaXRpYWwgZW1pdHRlciB2ZWxvY2l0eS4gRGlyZWN0aW9uXG4gKiBpcyBnaXZlbiBieSBlbWl0dGVyIHNoYXBlLlxuICogQHByb3BlcnR5IHtWZWMzfSBlbWl0dGVyRXh0ZW50cyAoT25seSBmb3IgRU1JVFRFUlNIQVBFX0JPWCkgVGhlIGV4dGVudHMgb2YgYSBsb2NhbCBzcGFjZVxuICogYm91bmRpbmcgYm94IHdpdGhpbiB3aGljaCBwYXJ0aWNsZXMgYXJlIHNwYXduZWQgYXQgcmFuZG9tIHBvc2l0aW9ucy5cbiAqIEBwcm9wZXJ0eSB7VmVjM30gZW1pdHRlckV4dGVudHNJbm5lciAoT25seSBmb3IgRU1JVFRFUlNIQVBFX0JPWCkgVGhlIGV4Y2VwdGlvbiBvZiBleHRlbnRzIG9mIGFcbiAqIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCB3aXRoaW4gd2hpY2ggcGFydGljbGVzIGFyZSBub3Qgc3Bhd25lZC4gQWxpZ25lZCB0byB0aGUgY2VudGVyIG9mXG4gKiBFbWl0dGVyRXh0ZW50cy5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBlbWl0dGVyUmFkaXVzIChPbmx5IGZvciBFTUlUVEVSU0hBUEVfU1BIRVJFKSBUaGUgcmFkaXVzIHdpdGhpbiB3aGljaFxuICogcGFydGljbGVzIGFyZSBzcGF3bmVkIGF0IHJhbmRvbSBwb3NpdGlvbnMuXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pdHRlclJhZGl1c0lubmVyIChPbmx5IGZvciBFTUlUVEVSU0hBUEVfU1BIRVJFKSBUaGUgaW5uZXIgcmFkaXVzIHdpdGhpblxuICogd2hpY2ggcGFydGljbGVzIGFyZSBub3Qgc3Bhd25lZC5cbiAqIEBwcm9wZXJ0eSB7VmVjM30gd3JhcEJvdW5kcyBUaGUgaGFsZiBleHRlbnRzIG9mIGEgd29ybGQgc3BhY2UgYm94IHZvbHVtZSBjZW50ZXJlZCBvbiB0aGUgb3duZXJcbiAqIGVudGl0eSdzIHBvc2l0aW9uLiBJZiBhIHBhcnRpY2xlIGNyb3NzZXMgdGhlIGJvdW5kYXJ5IG9mIG9uZSBzaWRlIG9mIHRoZSB2b2x1bWUsIGl0IHRlbGVwb3J0cyB0b1xuICogdGhlIG9wcG9zaXRlIHNpZGUuXG4gKiBAcHJvcGVydHkge0Fzc2V0fSBjb2xvck1hcEFzc2V0IFRoZSB7QGxpbmsgQXNzZXR9IHVzZWQgdG8gc2V0IHRoZSBjb2xvck1hcC5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IG5vcm1hbE1hcEFzc2V0IFRoZSB7QGxpbmsgQXNzZXR9IHVzZWQgdG8gc2V0IHRoZSBub3JtYWxNYXAuXG4gKiBAcHJvcGVydHkge0Fzc2V0fSBtZXNoQXNzZXQgVGhlIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIG1lc2guXG4gKiBAcHJvcGVydHkge0Fzc2V0fSByZW5kZXJBc3NldCBUaGUgUmVuZGVyIHtAbGluayBBc3NldH0gdXNlZCB0byBzZXQgdGhlIG1lc2guXG4gKiBAcHJvcGVydHkge1RleHR1cmV9IGNvbG9yTWFwIFRoZSBjb2xvciBtYXAgdGV4dHVyZSB0byBhcHBseSB0byBhbGwgcGFydGljbGVzIGluIHRoZSBzeXN0ZW0uIElmXG4gKiBubyB0ZXh0dXJlIGlzIGFzc2lnbmVkLCBhIGRlZmF1bHQgc3BvdCB0ZXh0dXJlIGlzIHVzZWQuXG4gKiBAcHJvcGVydHkge1RleHR1cmV9IG5vcm1hbE1hcCBUaGUgbm9ybWFsIG1hcCB0ZXh0dXJlIHRvIGFwcGx5IHRvIGFsbCBwYXJ0aWNsZXMgaW4gdGhlIHN5c3RlbS4gSWZcbiAqIG5vIHRleHR1cmUgaXMgYXNzaWduZWQsIGFuIGFwcHJveGltYXRlIHNwaGVyaWNhbCBub3JtYWwgaXMgY2FsY3VsYXRlZCBmb3IgZWFjaCB2ZXJ0ZXguXG4gKiBAcHJvcGVydHkge251bWJlcn0gZW1pdHRlclNoYXBlIFNoYXBlIG9mIHRoZSBlbWl0dGVyLiBEZWZpbmVzIHRoZSBib3VuZHMgaW5zaWRlIHdoaWNoIHBhcnRpY2xlc1xuICogYXJlIHNwYXduZWQuIEFsc28gYWZmZWN0cyB0aGUgZGlyZWN0aW9uIG9mIGluaXRpYWwgdmVsb2NpdHkuXG4gKlxuICogLSB7QGxpbmsgRU1JVFRFUlNIQVBFX0JPWH06IEJveCBzaGFwZSBwYXJhbWV0ZXJpemVkIGJ5IGVtaXR0ZXJFeHRlbnRzLiBJbml0aWFsIHZlbG9jaXR5IGlzXG4gKiBkaXJlY3RlZCB0b3dhcmRzIGxvY2FsIFogYXhpcy5cbiAqIC0ge0BsaW5rIEVNSVRURVJTSEFQRV9TUEhFUkV9OiBTcGhlcmUgc2hhcGUgcGFyYW1ldGVyaXplZCBieSBlbWl0dGVyUmFkaXVzLiBJbml0aWFsIHZlbG9jaXR5IGlzXG4gKiBkaXJlY3RlZCBvdXR3YXJkcyBmcm9tIHRoZSBjZW50ZXIuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNvcnQgU29ydGluZyBtb2RlLiBGb3JjZXMgQ1BVIHNpbXVsYXRpb24sIHNvIGJlIGNhcmVmdWwuXG4gKlxuICogLSB7QGxpbmsgUEFSVElDTEVTT1JUX05PTkV9OiBObyBzb3J0aW5nLCBwYXJ0aWNsZXMgYXJlIGRyYXduIGluIGFyYml0cmFyeSBvcmRlci4gQ2FuIGJlXG4gKiBzaW11bGF0ZWQgb24gR1BVLlxuICogLSB7QGxpbmsgUEFSVElDTEVTT1JUX0RJU1RBTkNFfTogU29ydGluZyBiYXNlZCBvbiBkaXN0YW5jZSB0byB0aGUgY2FtZXJhLiBDUFUgb25seS5cbiAqIC0ge0BsaW5rIFBBUlRJQ0xFU09SVF9ORVdFUl9GSVJTVH06IE5ld2VyIHBhcnRpY2xlcyBhcmUgZHJhd24gZmlyc3QuIENQVSBvbmx5LlxuICogLSB7QGxpbmsgUEFSVElDTEVTT1JUX09MREVSX0ZJUlNUfTogT2xkZXIgcGFydGljbGVzIGFyZSBkcmF3biBmaXJzdC4gQ1BVIG9ubHkuXG4gKlxuICogQHByb3BlcnR5IHtNZXNofSBtZXNoIFRyaWFuZ3VsYXIgbWVzaCB0byBiZSB1c2VkIGFzIGEgcGFydGljbGUuIE9ubHkgZmlyc3QgdmVydGV4L2luZGV4IGJ1ZmZlclxuICogaXMgdXNlZC4gVmVydGV4IGJ1ZmZlciBtdXN0IGNvbnRhaW4gbG9jYWwgcG9zaXRpb24gYXQgZmlyc3QgMyBmbG9hdHMgb2YgZWFjaCB2ZXJ0ZXguXG4gKiBAcHJvcGVydHkge251bWJlcn0gYmxlbmQgQ29udHJvbHMgaG93IHBhcnRpY2xlcyBhcmUgYmxlbmRlZCB3aGVuIGJlaW5nIHdyaXR0ZW4gdG8gdGhlIGN1cnJlbnRseVxuICogYWN0aXZlIHJlbmRlciB0YXJnZXQuIENhbiBiZTpcbiAqXG4gKiAtIHtAbGluayBCTEVORF9TVUJUUkFDVElWRX06IFN1YnRyYWN0IHRoZSBjb2xvciBvZiB0aGUgc291cmNlIGZyYWdtZW50IGZyb20gdGhlIGRlc3RpbmF0aW9uXG4gKiBmcmFnbWVudCBhbmQgd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICogLSB7QGxpbmsgQkxFTkRfQURESVRJVkV9OiBBZGQgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgdG8gdGhlIGRlc3RpbmF0aW9uIGZyYWdtZW50IGFuZFxuICogd3JpdGUgdGhlIHJlc3VsdCB0byB0aGUgZnJhbWUgYnVmZmVyLlxuICogLSB7QGxpbmsgQkxFTkRfTk9STUFMfTogRW5hYmxlIHNpbXBsZSB0cmFuc2x1Y2VuY3kgZm9yIG1hdGVyaWFscyBzdWNoIGFzIGdsYXNzLiBUaGlzIGlzXG4gKiBlcXVpdmFsZW50IHRvIGVuYWJsaW5nIGEgc291cmNlIGJsZW5kIG1vZGUgb2Yge0BsaW5rIEJMRU5ETU9ERV9TUkNfQUxQSEF9IGFuZCBhIGRlc3RpbmF0aW9uXG4gKiBibGVuZCBtb2RlIG9mIHtAbGluayBCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQX0uXG4gKiAtIHtAbGluayBCTEVORF9OT05FfTogRGlzYWJsZSBibGVuZGluZy5cbiAqIC0ge0BsaW5rIEJMRU5EX1BSRU1VTFRJUExJRUR9OiBTaW1pbGFyIHRvIHtAbGluayBCTEVORF9OT1JNQUx9IGV4cGVjdCB0aGUgc291cmNlIGZyYWdtZW50IGlzXG4gKiBhc3N1bWVkIHRvIGhhdmUgYWxyZWFkeSBiZWVuIG11bHRpcGxpZWQgYnkgdGhlIHNvdXJjZSBhbHBoYSB2YWx1ZS5cbiAqIC0ge0BsaW5rIEJMRU5EX01VTFRJUExJQ0FUSVZFfTogTXVsdGlwbHkgdGhlIGNvbG9yIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQgYnkgdGhlIGNvbG9yIG9mIHRoZVxuICogZGVzdGluYXRpb24gZnJhZ21lbnQgYW5kIHdyaXRlIHRoZSByZXN1bHQgdG8gdGhlIGZyYW1lIGJ1ZmZlci5cbiAqIC0ge0BsaW5rIEJMRU5EX0FERElUSVZFQUxQSEF9OiBTYW1lIGFzIHtAbGluayBCTEVORF9BRERJVElWRX0gZXhjZXB0IHRoZSBzb3VyY2UgUkdCIGlzXG4gKiBtdWx0aXBsaWVkIGJ5IHRoZSBzb3VyY2UgYWxwaGEuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IG9yaWVudGF0aW9uIFNvcnRpbmcgbW9kZS4gRm9yY2VzIENQVSBzaW11bGF0aW9uLCBzbyBiZSBjYXJlZnVsLlxuICpcbiAqIC0ge0BsaW5rIFBBUlRJQ0xFT1JJRU5UQVRJT05fU0NSRUVOfTogUGFydGljbGVzIGFyZSBmYWNpbmcgY2FtZXJhLlxuICogLSB7QGxpbmsgUEFSVElDTEVPUklFTlRBVElPTl9XT1JMRH06IFVzZXIgZGVmaW5lcyB3b3JsZCBzcGFjZSBub3JtYWwgKHBhcnRpY2xlTm9ybWFsKSB0byBzZXRcbiAqIHBsYW5lcyBvcmllbnRhdGlvbi5cbiAqIC0ge0BsaW5rIFBBUlRJQ0xFT1JJRU5UQVRJT05fRU1JVFRFUn06IFNpbWlsYXIgdG8gcHJldmlvdXMsIGJ1dCB0aGUgbm9ybWFsIGlzIGFmZmVjdGVkIGJ5XG4gKiBlbWl0dGVyIChlbnRpdHkpIHRyYW5zZm9ybWF0aW9uLlxuICpcbiAqIEBwcm9wZXJ0eSB7VmVjM30gcGFydGljbGVOb3JtYWwgKE9ubHkgZm9yIFBBUlRJQ0xFT1JJRU5UQVRJT05fV09STEQgYW5kXG4gKiBQQVJUSUNMRU9SSUVOVEFUSU9OX0VNSVRURVIpIFRoZSBleGNlcHRpb24gb2YgZXh0ZW50cyBvZiBhIGxvY2FsIHNwYWNlIGJvdW5kaW5nIGJveCB3aXRoaW4gd2hpY2hcbiAqIHBhcnRpY2xlcyBhcmUgbm90IHNwYXduZWQuIEFsaWduZWQgdG8gdGhlIGNlbnRlciBvZiBFbWl0dGVyRXh0ZW50cy5cbiAqIEBwcm9wZXJ0eSB7Q3VydmVTZXR9IGxvY2FsVmVsb2NpdHlHcmFwaCBWZWxvY2l0eSByZWxhdGl2ZSB0byBlbWl0dGVyIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge0N1cnZlU2V0fSBsb2NhbFZlbG9jaXR5R3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW5cbiAqIGxvY2FsVmVsb2NpdHlHcmFwaCBhbmQgbG9jYWxWZWxvY2l0eUdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7Q3VydmVTZXR9IHZlbG9jaXR5R3JhcGggV29ybGQtc3BhY2UgdmVsb2NpdHkgb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7Q3VydmVTZXR9IHZlbG9jaXR5R3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW5cbiAqIHZlbG9jaXR5R3JhcGggYW5kIHZlbG9jaXR5R3JhcGgyLlxuICogQHByb3BlcnR5IHtDdXJ2ZVNldH0gY29sb3JHcmFwaCBDb2xvciBvdmVyIGxpZmV0aW1lLlxuICogQHByb3BlcnR5IHtDdXJ2ZX0gcm90YXRpb25TcGVlZEdyYXBoIFJvdGF0aW9uIHNwZWVkIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge0N1cnZlfSByb3RhdGlvblNwZWVkR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW5cbiAqIHJvdGF0aW9uU3BlZWRHcmFwaCBhbmQgcm90YXRpb25TcGVlZEdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7Q3VydmV9IHJhZGlhbFNwZWVkR3JhcGggUmFkaWFsIHNwZWVkIG92ZXIgbGlmZXRpbWUsIHZlbG9jaXR5IHZlY3RvciBwb2ludHMgZnJvbVxuICogZW1pdHRlciBvcmlnaW4gdG8gcGFydGljbGUgcG9zLlxuICogQHByb3BlcnR5IHtDdXJ2ZX0gcmFkaWFsU3BlZWRHcmFwaDIgSWYgbm90IG51bGwsIHBhcnRpY2xlcyBwaWNrIHJhbmRvbSB2YWx1ZXMgYmV0d2VlblxuICogcmFkaWFsU3BlZWRHcmFwaCBhbmQgcmFkaWFsU3BlZWRHcmFwaDIuXG4gKiBAcHJvcGVydHkge0N1cnZlfSBzY2FsZUdyYXBoIFNjYWxlIG92ZXIgbGlmZXRpbWUuXG4gKiBAcHJvcGVydHkge0N1cnZlfSBzY2FsZUdyYXBoMiBJZiBub3QgbnVsbCwgcGFydGljbGVzIHBpY2sgcmFuZG9tIHZhbHVlcyBiZXR3ZWVuIHNjYWxlR3JhcGggYW5kXG4gKiBzY2FsZUdyYXBoMi5cbiAqIEBwcm9wZXJ0eSB7Q3VydmV9IGFscGhhR3JhcGggQWxwaGEgb3ZlciBsaWZldGltZS5cbiAqIEBwcm9wZXJ0eSB7Q3VydmV9IGFscGhhR3JhcGgyIElmIG5vdCBudWxsLCBwYXJ0aWNsZXMgcGljayByYW5kb20gdmFsdWVzIGJldHdlZW4gYWxwaGFHcmFwaCBhbmRcbiAqIGFscGhhR3JhcGgyLlxuICogQHByb3BlcnR5IHtudW1iZXJbXX0gbGF5ZXJzIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhpcyBwYXJ0aWNsZVxuICogc3lzdGVtIHNob3VsZCBiZWxvbmcuIERvbid0IHB1c2gvcG9wL3NwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0XG4gKiBhIG5ldyBvbmUgaW5zdGVhZC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgUGFydGljbGVTeXN0ZW1Db21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9yZXF1ZXN0ZWREZXB0aCA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2RyYXdPcmRlciA9IDA7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUGFydGljbGVTeXN0ZW1Db21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1BhcnRpY2xlU3lzdGVtQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXQgY3JlYXRlZCB0aGlzXG4gICAgICogQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLm9uKCdzZXRfY29sb3JNYXBBc3NldCcsIHRoaXMub25TZXRDb2xvck1hcEFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X25vcm1hbE1hcEFzc2V0JywgdGhpcy5vblNldE5vcm1hbE1hcEFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X21lc2hBc3NldCcsIHRoaXMub25TZXRNZXNoQXNzZXQsIHRoaXMpO1xuICAgICAgICB0aGlzLm9uKCdzZXRfbWVzaCcsIHRoaXMub25TZXRNZXNoLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X3JlbmRlckFzc2V0JywgdGhpcy5vblNldFJlbmRlckFzc2V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2xvb3AnLCB0aGlzLm9uU2V0TG9vcCwgdGhpcyk7XG4gICAgICAgIHRoaXMub24oJ3NldF9ibGVuZFR5cGUnLCB0aGlzLm9uU2V0QmxlbmRUeXBlLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2RlcHRoU29mdGVuaW5nJywgdGhpcy5vblNldERlcHRoU29mdGVuaW5nLCB0aGlzKTtcbiAgICAgICAgdGhpcy5vbignc2V0X2xheWVycycsIHRoaXMub25TZXRMYXllcnMsIHRoaXMpO1xuXG4gICAgICAgIFNJTVBMRV9QUk9QRVJUSUVTLmZvckVhY2goKHByb3ApID0+IHtcbiAgICAgICAgICAgIHRoaXMub24oYHNldF8ke3Byb3B9YCwgdGhpcy5vblNldFNpbXBsZVByb3BlcnR5LCB0aGlzKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgQ09NUExFWF9QUk9QRVJUSUVTLmZvckVhY2goKHByb3ApID0+IHtcbiAgICAgICAgICAgIHRoaXMub24oYHNldF8ke3Byb3B9YCwgdGhpcy5vblNldENvbXBsZXhQcm9wZXJ0eSwgdGhpcyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIEdSQVBIX1BST1BFUlRJRVMuZm9yRWFjaCgocHJvcCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbihgc2V0XyR7cHJvcH1gLCB0aGlzLm9uU2V0R3JhcGhQcm9wZXJ0eSwgdGhpcyk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHNldCBkcmF3T3JkZXIoZHJhd09yZGVyKSB7XG4gICAgICAgIHRoaXMuX2RyYXdPcmRlciA9IGRyYXdPcmRlcjtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRyYXdPcmRlciA9IGRyYXdPcmRlcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBkcmF3T3JkZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kcmF3T3JkZXI7XG4gICAgfVxuXG4gICAgYWRkTWVzaEluc3RhbmNlVG9MYXllcnMoKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKFt0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlXSk7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuX2xheWVyID0gbGF5ZXI7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVNZXNoSW5zdGFuY2VGcm9tTGF5ZXJzKCkge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyhbdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZV0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRMYXllcnMobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICghdGhpcy5lbWl0dGVyKSByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb2xkVmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQob2xkVmFsdWVbaV0pO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKFt0aGlzLmVtaXR0ZXIubWVzaEluc3RhbmNlXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZXdWYWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChuZXdWYWx1ZVtpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkTWVzaEluc3RhbmNlVG9MYXllcnMoKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgb2xkQ29tcC5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJBZGRlZChsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikgcmV0dXJuO1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXMoW3RoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2VdKTtcbiAgICB9XG5cbiAgICBfYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3VubG9hZCcsIHRoaXMuX29uQ29sb3JNYXBBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Db2xvck1hcEFzc2V0Q2hhbmdlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uQ29sb3JNYXBBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Db2xvck1hcEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25Db2xvck1hcEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbkNvbG9yTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uQ29sb3JNYXBBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5jb2xvck1hcCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbkNvbG9yTWFwQXNzZXRVbmxvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5jb2xvck1hcCA9IG51bGw7XG4gICAgfVxuXG4gICAgX29uQ29sb3JNYXBBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbkNvbG9yTWFwQXNzZXRVbmxvYWQoYXNzZXQpO1xuICAgIH1cblxuICAgIF9vbkNvbG9yTWFwQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICBvblNldENvbG9yTWFwQXNzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG4gICAgICAgIGlmIChvbGRWYWx1ZSkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG9sZFZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3VuYmluZENvbG9yTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5jb2xvck1hcEFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRDb2xvck1hcEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9uY2UoJ2FkZDonICsgbmV3VmFsdWUsIChhc3NldCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9iaW5kQ29sb3JNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmNvbG9yTWFwID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbignY2hhbmdlJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdW5iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgYXNzZXQub2ZmKCdsb2FkJywgdGhpcy5fb25Ob3JtYWxNYXBBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRSZW1vdmUsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uTm9ybWFsTWFwQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLm5vcm1hbE1hcCA9IGFzc2V0LnJlc291cmNlO1xuICAgIH1cblxuICAgIF9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubm9ybWFsTWFwID0gbnVsbDtcbiAgICB9XG5cbiAgICBfb25Ob3JtYWxNYXBBc3NldFJlbW92ZShhc3NldCkge1xuICAgICAgICB0aGlzLl9vbk5vcm1hbE1hcEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25Ob3JtYWxNYXBBc3NldENoYW5nZShhc3NldCkge1xuICAgIH1cblxuICAgIG9uU2V0Tm9ybWFsTWFwQXNzZXQobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHM7XG5cbiAgICAgICAgaWYgKG9sZFZhbHVlKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQob2xkVmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5ub3JtYWxNYXBBc3NldCA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChuZXdWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9iaW5kTm9ybWFsTWFwQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhc3NldHMub25jZSgnYWRkOicgKyBuZXdWYWx1ZSwgKGFzc2V0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmROb3JtYWxNYXBBc3NldChhc3NldCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLm5vcm1hbE1hcCA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZE1lc2hBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCd1bmxvYWQnLCB0aGlzLl9vbk1lc2hBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vbk1lc2hBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1lc2hBc3NldENoYW5nZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1lc2hBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VuYmluZE1lc2hBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1lc2hBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3VubG9hZCcsIHRoaXMuX29uTWVzaEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCdyZW1vdmUnLCB0aGlzLl9vbk1lc2hBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NZXNoQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vbk1lc2hBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25NZXNoQ2hhbmdlZChhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgX29uTWVzaEFzc2V0VW5sb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubWVzaCA9IG51bGw7XG4gICAgfVxuXG4gICAgX29uTWVzaEFzc2V0UmVtb3ZlKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuX29uTWVzaEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICBfb25NZXNoQXNzZXRDaGFuZ2UoYXNzZXQpIHtcbiAgICB9XG5cbiAgICBvblNldE1lc2hBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRNZXNoQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICBpZiAobmV3VmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5tZXNoQXNzZXQgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgICAgICBuZXdWYWx1ZSA9IG5ld1ZhbHVlLmlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQobmV3VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1lc2hBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1lc2hDaGFuZ2VkKG51bGwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRNZXNoKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICAvLyBoYWNrIHRoaXMgZm9yIG5vd1xuICAgICAgICAvLyBpZiB0aGUgdmFsdWUgYmVpbmcgc2V0IGlzIG51bGwsIGFuIGFzc2V0IG9yIGFuIGFzc2V0IGlkLCB0aGVuIGFzc3VtZSB3ZSBhcmVcbiAgICAgICAgLy8gc2V0dGluZyB0aGUgbWVzaCBhc3NldCwgd2hpY2ggd2lsbCBpbiB0dXJuIHVwZGF0ZSB0aGUgbWVzaFxuICAgICAgICBpZiAoIW5ld1ZhbHVlIHx8IG5ld1ZhbHVlIGluc3RhbmNlb2YgQXNzZXQgfHwgdHlwZW9mIG5ld1ZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgdGhpcy5tZXNoQXNzZXQgPSBuZXdWYWx1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobmV3VmFsdWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTWVzaENoYW5nZWQobWVzaCkge1xuICAgICAgICBpZiAobWVzaCAmJiAhKG1lc2ggaW5zdGFuY2VvZiBNZXNoKSkge1xuICAgICAgICAgICAgLy8gaWYgbWVzaCBpcyBhIHBjLk1vZGVsLCB1c2UgdGhlIGZpcnN0IG1lc2hJbnN0YW5jZVxuICAgICAgICAgICAgaWYgKG1lc2gubWVzaEluc3RhbmNlc1swXSkge1xuICAgICAgICAgICAgICAgIG1lc2ggPSBtZXNoLm1lc2hJbnN0YW5jZXNbMF0ubWVzaDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbWVzaCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRhdGEubWVzaCA9IG1lc2g7XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2ggPSBtZXNoO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0TWF0ZXJpYWwoKTtcbiAgICAgICAgICAgIHRoaXMucmVidWlsZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25TZXRSZW5kZXJBc3NldChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAob2xkVmFsdWUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldChvbGRWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRSZW5kZXJBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSBpbnN0YW5jZW9mIEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLnJlbmRlckFzc2V0ID0gbmV3VmFsdWUuaWQ7XG4gICAgICAgICAgICAgICAgbmV3VmFsdWUgPSBuZXdWYWx1ZS5pZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXNzZXQgPSBhc3NldHMuZ2V0KG5ld1ZhbHVlKTtcbiAgICAgICAgICAgIGlmIChhc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRSZW5kZXJBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9vblJlbmRlckNoYW5nZWQobnVsbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYmluZFJlbmRlckFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGFzc2V0Lm9uKCdsb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdyZW1vdmUnLCB0aGlzLl9vblJlbmRlckFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkKGFzc2V0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIGRvbid0IHRyaWdnZXIgYW4gYXNzZXQgbG9hZCB1bmxlc3MgdGhlIGNvbXBvbmVudCBpcyBlbmFibGVkXG4gICAgICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCkgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91bmJpbmRSZW5kZXJBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vblJlbmRlckFzc2V0TG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigndW5sb2FkJywgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25SZW5kZXJBc3NldFJlbW92ZSwgdGhpcyk7XG5cbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICBhc3NldC5yZXNvdXJjZS5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblJlbmRlclNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldExvYWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25SZW5kZXJDaGFuZ2VkKGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9vblJlbmRlckNoYW5nZWQobnVsbCk7XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZChhc3NldCk7XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQ2hhbmdlZChyZW5kZXIpIHtcbiAgICAgICAgaWYgKCFyZW5kZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX29uTWVzaENoYW5nZWQobnVsbCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICByZW5kZXIub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25SZW5kZXJTZXRNZXNoZXMsIHRoaXMpO1xuICAgICAgICByZW5kZXIub24oJ3NldDptZXNoZXMnLCB0aGlzLl9vblJlbmRlclNldE1lc2hlcywgdGhpcyk7XG5cbiAgICAgICAgaWYgKHJlbmRlci5tZXNoZXMpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyU2V0TWVzaGVzKHJlbmRlci5tZXNoZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyU2V0TWVzaGVzKG1lc2hlcykge1xuICAgICAgICB0aGlzLl9vbk1lc2hDaGFuZ2VkKG1lc2hlcyAmJiBtZXNoZXNbMF0pO1xuICAgIH1cblxuICAgIG9uU2V0TG9vcChuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRUaW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldEJsZW5kVHlwZShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubWF0ZXJpYWwuYmxlbmRUeXBlID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRNYXRlcmlhbCgpO1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVxdWVzdERlcHRoKCkge1xuICAgICAgICBpZiAodGhpcy5fcmVxdWVzdGVkRGVwdGgpIHJldHVybjtcbiAgICAgICAgaWYgKCFkZXB0aExheWVyKSBkZXB0aExheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQoTEFZRVJJRF9ERVBUSCk7XG4gICAgICAgIGlmIChkZXB0aExheWVyKSB7XG4gICAgICAgICAgICBkZXB0aExheWVyLmluY3JlbWVudENvdW50ZXIoKTtcbiAgICAgICAgICAgIHRoaXMuX3JlcXVlc3RlZERlcHRoID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZWxlYXNlRGVwdGgoKSB7XG4gICAgICAgIGlmICghdGhpcy5fcmVxdWVzdGVkRGVwdGgpIHJldHVybjtcbiAgICAgICAgaWYgKGRlcHRoTGF5ZXIpIHtcbiAgICAgICAgICAgIGRlcHRoTGF5ZXIuZGVjcmVtZW50Q291bnRlcigpO1xuICAgICAgICAgICAgdGhpcy5fcmVxdWVzdGVkRGVwdGggPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uU2V0RGVwdGhTb2Z0ZW5pbmcobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmIChvbGRWYWx1ZSAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIGlmIChuZXdWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkgdGhpcy5fcmVxdWVzdERlcHRoKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkgdGhpcy5fcmVsZWFzZURlcHRoKCk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldFNpbXBsZVByb3BlcnR5KG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXJbbmFtZV0gPSBuZXdWYWx1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldENvbXBsZXhQcm9wZXJ0eShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyW25hbWVdID0gbmV3VmFsdWU7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRNYXRlcmlhbCgpO1xuICAgICAgICAgICAgdGhpcy5yZWJ1aWxkKCk7XG4gICAgICAgICAgICB0aGlzLnJlc2V0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvblNldEdyYXBoUHJvcGVydHkobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLmVtaXR0ZXIpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlcltuYW1lXSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlYnVpbGRHcmFwaHMoKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5yZXNldE1hdGVyaWFsKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgLy8gZ2V0IGRhdGEgc3RvcmUgb25jZVxuICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5kYXRhO1xuXG4gICAgICAgIC8vIGxvYWQgYW55IGFzc2V0cyB0aGF0IGhhdmVuJ3QgYmVlbiBsb2FkZWQgeWV0XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBBU1NFVF9QUk9QRVJUSUVTLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICBsZXQgYXNzZXQgPSBkYXRhW0FTU0VUX1BST1BFUlRJRVNbaV1dO1xuICAgICAgICAgICAgaWYgKGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgaWYgKCEoYXNzZXQgaW5zdGFuY2VvZiBBc3NldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaWQgPSBwYXJzZUludChhc3NldCwgMTApO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaWQgPj0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChhc3NldCAmJiAhYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgbGV0IG1lc2ggPSBkYXRhLm1lc2g7XG5cbiAgICAgICAgICAgIC8vIG1lc2ggbWlnaHQgYmUgYW4gYXNzZXQgaWQgb2YgYW4gYXNzZXRcbiAgICAgICAgICAgIC8vIHRoYXQgaGFzbid0IGJlZW4gbG9hZGVkIHlldFxuICAgICAgICAgICAgaWYgKCEobWVzaCBpbnN0YW5jZW9mIE1lc2gpKVxuICAgICAgICAgICAgICAgIG1lc2ggPSBudWxsO1xuXG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIgPSBuZXcgUGFydGljbGVFbWl0dGVyKHRoaXMuc3lzdGVtLmFwcC5ncmFwaGljc0RldmljZSwge1xuICAgICAgICAgICAgICAgIG51bVBhcnRpY2xlczogZGF0YS5udW1QYXJ0aWNsZXMsXG4gICAgICAgICAgICAgICAgZW1pdHRlckV4dGVudHM6IGRhdGEuZW1pdHRlckV4dGVudHMsXG4gICAgICAgICAgICAgICAgZW1pdHRlckV4dGVudHNJbm5lcjogZGF0YS5lbWl0dGVyRXh0ZW50c0lubmVyLFxuICAgICAgICAgICAgICAgIGVtaXR0ZXJSYWRpdXM6IGRhdGEuZW1pdHRlclJhZGl1cyxcbiAgICAgICAgICAgICAgICBlbWl0dGVyUmFkaXVzSW5uZXI6IGRhdGEuZW1pdHRlclJhZGl1c0lubmVyLFxuICAgICAgICAgICAgICAgIGVtaXR0ZXJTaGFwZTogZGF0YS5lbWl0dGVyU2hhcGUsXG4gICAgICAgICAgICAgICAgaW5pdGlhbFZlbG9jaXR5OiBkYXRhLmluaXRpYWxWZWxvY2l0eSxcbiAgICAgICAgICAgICAgICB3cmFwOiBkYXRhLndyYXAsXG4gICAgICAgICAgICAgICAgbG9jYWxTcGFjZTogZGF0YS5sb2NhbFNwYWNlLFxuICAgICAgICAgICAgICAgIHNjcmVlblNwYWNlOiBkYXRhLnNjcmVlblNwYWNlLFxuICAgICAgICAgICAgICAgIHdyYXBCb3VuZHM6IGRhdGEud3JhcEJvdW5kcyxcbiAgICAgICAgICAgICAgICBsaWZldGltZTogZGF0YS5saWZldGltZSxcbiAgICAgICAgICAgICAgICByYXRlOiBkYXRhLnJhdGUsXG4gICAgICAgICAgICAgICAgcmF0ZTI6IGRhdGEucmF0ZTIsXG5cbiAgICAgICAgICAgICAgICBvcmllbnRhdGlvbjogZGF0YS5vcmllbnRhdGlvbixcbiAgICAgICAgICAgICAgICBwYXJ0aWNsZU5vcm1hbDogZGF0YS5wYXJ0aWNsZU5vcm1hbCxcblxuICAgICAgICAgICAgICAgIGFuaW1UaWxlc1g6IGRhdGEuYW5pbVRpbGVzWCxcbiAgICAgICAgICAgICAgICBhbmltVGlsZXNZOiBkYXRhLmFuaW1UaWxlc1ksXG4gICAgICAgICAgICAgICAgYW5pbVN0YXJ0RnJhbWU6IGRhdGEuYW5pbVN0YXJ0RnJhbWUsXG4gICAgICAgICAgICAgICAgYW5pbU51bUZyYW1lczogZGF0YS5hbmltTnVtRnJhbWVzLFxuICAgICAgICAgICAgICAgIGFuaW1OdW1BbmltYXRpb25zOiBkYXRhLmFuaW1OdW1BbmltYXRpb25zLFxuICAgICAgICAgICAgICAgIGFuaW1JbmRleDogZGF0YS5hbmltSW5kZXgsXG4gICAgICAgICAgICAgICAgcmFuZG9taXplQW5pbUluZGV4OiBkYXRhLnJhbmRvbWl6ZUFuaW1JbmRleCxcbiAgICAgICAgICAgICAgICBhbmltU3BlZWQ6IGRhdGEuYW5pbVNwZWVkLFxuICAgICAgICAgICAgICAgIGFuaW1Mb29wOiBkYXRhLmFuaW1Mb29wLFxuXG4gICAgICAgICAgICAgICAgc3RhcnRBbmdsZTogZGF0YS5zdGFydEFuZ2xlLFxuICAgICAgICAgICAgICAgIHN0YXJ0QW5nbGUyOiBkYXRhLnN0YXJ0QW5nbGUyLFxuXG4gICAgICAgICAgICAgICAgc2NhbGVHcmFwaDogZGF0YS5zY2FsZUdyYXBoLFxuICAgICAgICAgICAgICAgIHNjYWxlR3JhcGgyOiBkYXRhLnNjYWxlR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgY29sb3JHcmFwaDogZGF0YS5jb2xvckdyYXBoLFxuICAgICAgICAgICAgICAgIGNvbG9yR3JhcGgyOiBkYXRhLmNvbG9yR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgYWxwaGFHcmFwaDogZGF0YS5hbHBoYUdyYXBoLFxuICAgICAgICAgICAgICAgIGFscGhhR3JhcGgyOiBkYXRhLmFscGhhR3JhcGgyLFxuXG4gICAgICAgICAgICAgICAgbG9jYWxWZWxvY2l0eUdyYXBoOiBkYXRhLmxvY2FsVmVsb2NpdHlHcmFwaCxcbiAgICAgICAgICAgICAgICBsb2NhbFZlbG9jaXR5R3JhcGgyOiBkYXRhLmxvY2FsVmVsb2NpdHlHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICB2ZWxvY2l0eUdyYXBoOiBkYXRhLnZlbG9jaXR5R3JhcGgsXG4gICAgICAgICAgICAgICAgdmVsb2NpdHlHcmFwaDI6IGRhdGEudmVsb2NpdHlHcmFwaDIsXG5cbiAgICAgICAgICAgICAgICByb3RhdGlvblNwZWVkR3JhcGg6IGRhdGEucm90YXRpb25TcGVlZEdyYXBoLFxuICAgICAgICAgICAgICAgIHJvdGF0aW9uU3BlZWRHcmFwaDI6IGRhdGEucm90YXRpb25TcGVlZEdyYXBoMixcblxuICAgICAgICAgICAgICAgIHJhZGlhbFNwZWVkR3JhcGg6IGRhdGEucmFkaWFsU3BlZWRHcmFwaCxcbiAgICAgICAgICAgICAgICByYWRpYWxTcGVlZEdyYXBoMjogZGF0YS5yYWRpYWxTcGVlZEdyYXBoMixcblxuICAgICAgICAgICAgICAgIGNvbG9yTWFwOiBkYXRhLmNvbG9yTWFwLFxuICAgICAgICAgICAgICAgIG5vcm1hbE1hcDogZGF0YS5ub3JtYWxNYXAsXG4gICAgICAgICAgICAgICAgbG9vcDogZGF0YS5sb29wLFxuICAgICAgICAgICAgICAgIHByZVdhcm06IGRhdGEucHJlV2FybSxcbiAgICAgICAgICAgICAgICBzb3J0OiBkYXRhLnNvcnQsXG4gICAgICAgICAgICAgICAgc3RyZXRjaDogZGF0YS5zdHJldGNoLFxuICAgICAgICAgICAgICAgIGFsaWduVG9Nb3Rpb246IGRhdGEuYWxpZ25Ub01vdGlvbixcbiAgICAgICAgICAgICAgICBsaWdodGluZzogZGF0YS5saWdodGluZyxcbiAgICAgICAgICAgICAgICBoYWxmTGFtYmVydDogZGF0YS5oYWxmTGFtYmVydCxcbiAgICAgICAgICAgICAgICBpbnRlbnNpdHk6IGRhdGEuaW50ZW5zaXR5LFxuICAgICAgICAgICAgICAgIGRlcHRoU29mdGVuaW5nOiBkYXRhLmRlcHRoU29mdGVuaW5nLFxuICAgICAgICAgICAgICAgIHNjZW5lOiB0aGlzLnN5c3RlbS5hcHAuc2NlbmUsXG4gICAgICAgICAgICAgICAgbWVzaDogbWVzaCxcbiAgICAgICAgICAgICAgICBkZXB0aFdyaXRlOiBkYXRhLmRlcHRoV3JpdGUsXG4gICAgICAgICAgICAgICAgbm9Gb2c6IGRhdGEubm9Gb2csXG4gICAgICAgICAgICAgICAgbm9kZTogdGhpcy5lbnRpdHksXG4gICAgICAgICAgICAgICAgYmxlbmRUeXBlOiBkYXRhLmJsZW5kVHlwZVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5tZXNoSW5zdGFuY2Uubm9kZSA9IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRyYXdPcmRlciA9IHRoaXMuZHJhd09yZGVyO1xuXG4gICAgICAgICAgICBpZiAoIWRhdGEuYXV0b1BsYXkpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnBhdXNlKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyLmNvbG9yTWFwKSB7XG4gICAgICAgICAgICB0aGlzLmFkZE1lc2hJbnN0YW5jZVRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUub24oJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCAmJiBkYXRhLmRlcHRoU29mdGVuaW5nKSB7XG4gICAgICAgICAgICB0aGlzLl9yZXF1ZXN0RGVwdGgoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnMub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1lc2hJbnN0YW5jZUZyb21MYXllcnMoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGEuZGVwdGhTb2Z0ZW5pbmcpIHRoaXMuX3JlbGVhc2VEZXB0aCgpO1xuXG4gICAgICAgICAgICAvLyBjbGVhciBjYW1lcmEgYXMgaXQgaXNuJ3QgdXBkYXRlZCB3aGlsZSBkaXNhYmxlZCBhbmQgd2UgZG9uJ3Qgd2FudCB0byBob2xkXG4gICAgICAgICAgICAvLyBvbnRvIG9sZCByZWZlcmVuY2VcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5jYW1lcmEgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25CZWZvcmVSZW1vdmUoKSB7XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjbGVhciBhbGwgYXNzZXQgcHJvcGVydGllcyB0byByZW1vdmUgYW55IGV2ZW50IGxpc3RlbmVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IEFTU0VUX1BST1BFUlRJRVMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3AgPSBBU1NFVF9QUk9QRVJUSUVTW2ldO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhW3Byb3BdKSB7XG4gICAgICAgICAgICAgICAgdGhpc1twcm9wXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm9mZigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0cyBwYXJ0aWNsZSBzdGF0ZSwgZG9lc24ndCBhZmZlY3QgcGxheWluZy5cbiAgICAgKi9cbiAgICByZXNldCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEaXNhYmxlcyB0aGUgZW1pc3Npb24gb2YgbmV3IHBhcnRpY2xlcywgbGV0cyBleGlzdGluZyB0byBmaW5pc2ggdGhlaXIgc2ltdWxhdGlvbi5cbiAgICAgKi9cbiAgICBzdG9wKCkge1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIubG9vcCA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLnJlc2V0VGltZSgpO1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmFkZFRpbWUoMCwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGcmVlemVzIHRoZSBzaW11bGF0aW9uLlxuICAgICAqL1xuICAgIHBhdXNlKCkge1xuICAgICAgICB0aGlzLmRhdGEucGF1c2VkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBVbmZyZWV6ZXMgdGhlIHNpbXVsYXRpb24uXG4gICAgICovXG4gICAgdW5wYXVzZSgpIHtcbiAgICAgICAgdGhpcy5kYXRhLnBhdXNlZCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMvdW5mcmVlemVzIHRoZSBzaW11bGF0aW9uLlxuICAgICAqL1xuICAgIHBsYXkoKSB7XG4gICAgICAgIHRoaXMuZGF0YS5wYXVzZWQgPSBmYWxzZTtcbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlcikge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5sb29wID0gdGhpcy5kYXRhLmxvb3A7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVzZXRUaW1lKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDaGVja3MgaWYgc2ltdWxhdGlvbiBpcyBpbiBwcm9ncmVzcy5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSBwYXJ0aWNsZSBzeXN0ZW0gaXMgY3VycmVudGx5IHBsYXlpbmcgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBpc1BsYXlpbmcoKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEucGF1c2VkKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZW1pdHRlciAmJiB0aGlzLmVtaXR0ZXIubG9vcCkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBwb3NzaWJsZSBidWcgaGVyZSB3aGF0IGhhcHBlbnMgaWYgdGhlIG5vbiBsb29waW5nIGVtaXR0ZXJcbiAgICAgICAgLy8gd2FzIHBhdXNlZCBpbiB0aGUgbWVhbnRpbWU/XG4gICAgICAgIHJldHVybiBEYXRlLm5vdygpIDw9IHRoaXMuZW1pdHRlci5lbmRUaW1lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlYnVpbGRzIGFsbCBkYXRhIHVzZWQgYnkgdGhpcyBwYXJ0aWNsZSBzeXN0ZW0uXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHJlYnVpbGQoKSB7XG4gICAgICAgIGNvbnN0IGVuYWJsZWQgPSB0aGlzLmVuYWJsZWQ7XG4gICAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICBpZiAodGhpcy5lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIucmVidWlsZCgpOyAvLyB3b3JzdCBjYXNlOiByZXF1aXJlZCB0byByZWJ1aWxkIGJ1ZmZlcnMvc2hhZGVyc1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLm1lc2hJbnN0YW5jZS5ub2RlID0gdGhpcy5lbnRpdHk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5lbmFibGVkID0gZW5hYmxlZDtcbiAgICB9XG59XG5cbmV4cG9ydCB7IFBhcnRpY2xlU3lzdGVtQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiU0lNUExFX1BST1BFUlRJRVMiLCJDT01QTEVYX1BST1BFUlRJRVMiLCJHUkFQSF9QUk9QRVJUSUVTIiwiQVNTRVRfUFJPUEVSVElFUyIsImRlcHRoTGF5ZXIiLCJQYXJ0aWNsZVN5c3RlbUNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3JlcXVlc3RlZERlcHRoIiwiX2RyYXdPcmRlciIsIm9uIiwib25TZXRDb2xvck1hcEFzc2V0Iiwib25TZXROb3JtYWxNYXBBc3NldCIsIm9uU2V0TWVzaEFzc2V0Iiwib25TZXRNZXNoIiwib25TZXRSZW5kZXJBc3NldCIsIm9uU2V0TG9vcCIsIm9uU2V0QmxlbmRUeXBlIiwib25TZXREZXB0aFNvZnRlbmluZyIsIm9uU2V0TGF5ZXJzIiwiZm9yRWFjaCIsInByb3AiLCJvblNldFNpbXBsZVByb3BlcnR5Iiwib25TZXRDb21wbGV4UHJvcGVydHkiLCJvblNldEdyYXBoUHJvcGVydHkiLCJkcmF3T3JkZXIiLCJlbWl0dGVyIiwiYWRkTWVzaEluc3RhbmNlVG9MYXllcnMiLCJpIiwibGF5ZXJzIiwibGVuZ3RoIiwibGF5ZXIiLCJhcHAiLCJzY2VuZSIsImdldExheWVyQnlJZCIsImFkZE1lc2hJbnN0YW5jZXMiLCJtZXNoSW5zdGFuY2UiLCJfbGF5ZXIiLCJyZW1vdmVNZXNoSW5zdGFuY2VGcm9tTGF5ZXJzIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsIm5hbWUiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwiZW5hYmxlZCIsIm9uTGF5ZXJzQ2hhbmdlZCIsIm9sZENvbXAiLCJuZXdDb21wIiwib2ZmIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJpbmRleCIsImluZGV4T2YiLCJpZCIsIl9iaW5kQ29sb3JNYXBBc3NldCIsImFzc2V0IiwiX29uQ29sb3JNYXBBc3NldExvYWQiLCJfb25Db2xvck1hcEFzc2V0VW5sb2FkIiwiX29uQ29sb3JNYXBBc3NldFJlbW92ZSIsIl9vbkNvbG9yTWFwQXNzZXRDaGFuZ2UiLCJyZXNvdXJjZSIsImFzc2V0cyIsImxvYWQiLCJfdW5iaW5kQ29sb3JNYXBBc3NldCIsImNvbG9yTWFwIiwiZ2V0IiwiQXNzZXQiLCJkYXRhIiwiY29sb3JNYXBBc3NldCIsIm9uY2UiLCJfYmluZE5vcm1hbE1hcEFzc2V0IiwiX29uTm9ybWFsTWFwQXNzZXRMb2FkIiwiX29uTm9ybWFsTWFwQXNzZXRVbmxvYWQiLCJfb25Ob3JtYWxNYXBBc3NldFJlbW92ZSIsIl9vbk5vcm1hbE1hcEFzc2V0Q2hhbmdlIiwiX3VuYmluZE5vcm1hbE1hcEFzc2V0Iiwibm9ybWFsTWFwIiwibm9ybWFsTWFwQXNzZXQiLCJfYmluZE1lc2hBc3NldCIsIl9vbk1lc2hBc3NldExvYWQiLCJfb25NZXNoQXNzZXRVbmxvYWQiLCJfb25NZXNoQXNzZXRSZW1vdmUiLCJfb25NZXNoQXNzZXRDaGFuZ2UiLCJfdW5iaW5kTWVzaEFzc2V0IiwiX29uTWVzaENoYW5nZWQiLCJtZXNoIiwibWVzaEFzc2V0IiwiTWVzaCIsIm1lc2hJbnN0YW5jZXMiLCJyZXNldE1hdGVyaWFsIiwicmVidWlsZCIsIl91bmJpbmRSZW5kZXJBc3NldCIsInJlbmRlckFzc2V0IiwiX2JpbmRSZW5kZXJBc3NldCIsIl9vblJlbmRlckNoYW5nZWQiLCJfb25SZW5kZXJBc3NldExvYWQiLCJfb25SZW5kZXJBc3NldFVubG9hZCIsIl9vblJlbmRlckFzc2V0UmVtb3ZlIiwiX29uUmVuZGVyU2V0TWVzaGVzIiwicmVuZGVyIiwibWVzaGVzIiwicmVzZXRUaW1lIiwibWF0ZXJpYWwiLCJibGVuZFR5cGUiLCJfcmVxdWVzdERlcHRoIiwiTEFZRVJJRF9ERVBUSCIsImluY3JlbWVudENvdW50ZXIiLCJfcmVsZWFzZURlcHRoIiwiZGVjcmVtZW50Q291bnRlciIsInJlc2V0IiwicmVidWlsZEdyYXBocyIsIm9uRW5hYmxlIiwibGVuIiwicGFyc2VJbnQiLCJQYXJ0aWNsZUVtaXR0ZXIiLCJncmFwaGljc0RldmljZSIsIm51bVBhcnRpY2xlcyIsImVtaXR0ZXJFeHRlbnRzIiwiZW1pdHRlckV4dGVudHNJbm5lciIsImVtaXR0ZXJSYWRpdXMiLCJlbWl0dGVyUmFkaXVzSW5uZXIiLCJlbWl0dGVyU2hhcGUiLCJpbml0aWFsVmVsb2NpdHkiLCJ3cmFwIiwibG9jYWxTcGFjZSIsInNjcmVlblNwYWNlIiwid3JhcEJvdW5kcyIsImxpZmV0aW1lIiwicmF0ZSIsInJhdGUyIiwib3JpZW50YXRpb24iLCJwYXJ0aWNsZU5vcm1hbCIsImFuaW1UaWxlc1giLCJhbmltVGlsZXNZIiwiYW5pbVN0YXJ0RnJhbWUiLCJhbmltTnVtRnJhbWVzIiwiYW5pbU51bUFuaW1hdGlvbnMiLCJhbmltSW5kZXgiLCJyYW5kb21pemVBbmltSW5kZXgiLCJhbmltU3BlZWQiLCJhbmltTG9vcCIsInN0YXJ0QW5nbGUiLCJzdGFydEFuZ2xlMiIsInNjYWxlR3JhcGgiLCJzY2FsZUdyYXBoMiIsImNvbG9yR3JhcGgiLCJjb2xvckdyYXBoMiIsImFscGhhR3JhcGgiLCJhbHBoYUdyYXBoMiIsImxvY2FsVmVsb2NpdHlHcmFwaCIsImxvY2FsVmVsb2NpdHlHcmFwaDIiLCJ2ZWxvY2l0eUdyYXBoIiwidmVsb2NpdHlHcmFwaDIiLCJyb3RhdGlvblNwZWVkR3JhcGgiLCJyb3RhdGlvblNwZWVkR3JhcGgyIiwicmFkaWFsU3BlZWRHcmFwaCIsInJhZGlhbFNwZWVkR3JhcGgyIiwibG9vcCIsInByZVdhcm0iLCJzb3J0Iiwic3RyZXRjaCIsImFsaWduVG9Nb3Rpb24iLCJsaWdodGluZyIsImhhbGZMYW1iZXJ0IiwiaW50ZW5zaXR5IiwiZGVwdGhTb2Z0ZW5pbmciLCJkZXB0aFdyaXRlIiwibm9Gb2ciLCJub2RlIiwiYXV0b1BsYXkiLCJwYXVzZSIsInZpc2libGUiLCJvbkRpc2FibGUiLCJjYW1lcmEiLCJvbkJlZm9yZVJlbW92ZSIsImRlc3Ryb3kiLCJzdG9wIiwiYWRkVGltZSIsInBhdXNlZCIsInVucGF1c2UiLCJwbGF5IiwiaXNQbGF5aW5nIiwiRGF0ZSIsIm5vdyIsImVuZFRpbWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FB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
