/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { LAYERID_WORLD } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { getShapePrimitive } from '../../../scene/procedural.js';
import { Asset } from '../../asset/asset.js';
import { Component } from '../component.js';

class ModelComponent extends Component {

  constructor(system, entity) {
    super(system, entity);
    this._type = 'asset';
    this._asset = null;
    this._model = null;
    this._mapping = {};
    this._castShadows = true;
    this._receiveShadows = true;
    this._materialAsset = null;
    this._material = void 0;
    this._castShadowsLightmap = true;
    this._lightmapped = false;
    this._lightmapSizeMultiplier = 1;
    this._isStatic = false;
    this._layers = [LAYERID_WORLD];
    this._batchGroupId = -1;
    this._customAabb = null;
    this._area = null;
    this._materialEvents = null;
    this._clonedModel = false;
    this._batchGroup = null;
    this._material = system.defaultMaterial;

    entity.on('remove', this.onRemoveChild, this);
    entity.on('removehierarchy', this.onRemoveChild, this);
    entity.on('insert', this.onInsertChild, this);
    entity.on('inserthierarchy', this.onInsertChild, this);
  }

  set meshInstances(value) {
    if (!this._model) return;
    this._model.meshInstances = value;
  }
  get meshInstances() {
    if (!this._model) return null;
    return this._model.meshInstances;
  }

  set customAabb(value) {
    this._customAabb = value;

    if (this._model) {
      const mi = this._model.meshInstances;
      if (mi) {
        for (let i = 0; i < mi.length; i++) {
          mi[i].setCustomAabb(this._customAabb);
        }
      }
    }
  }
  get customAabb() {
    return this._customAabb;
  }

  set type(value) {
    if (this._type === value) return;
    this._area = null;
    this._type = value;
    if (value === 'asset') {
      if (this._asset !== null) {
        this._bindModelAsset(this._asset);
      } else {
        this.model = null;
      }
    } else {
      const primData = getShapePrimitive(this.system.app.graphicsDevice, value);
      this._area = primData.area;
      const mesh = primData.mesh;
      const node = new GraphNode();
      const model = new Model();
      model.graph = node;
      model.meshInstances = [new MeshInstance(mesh, this._material, node)];
      this.model = model;
      this._asset = null;
    }
  }
  get type() {
    return this._type;
  }

  set asset(value) {
    const assets = this.system.app.assets;
    let _id = value;
    if (value instanceof Asset) {
      _id = value.id;
    }
    if (this._asset !== _id) {
      if (this._asset) {
        assets.off('add:' + this._asset, this._onModelAssetAdded, this);
        const _prev = assets.get(this._asset);
        if (_prev) {
          this._unbindModelAsset(_prev);
        }
      }
      this._asset = _id;
      if (this._asset) {
        const asset = assets.get(this._asset);
        if (!asset) {
          this.model = null;
          assets.on('add:' + this._asset, this._onModelAssetAdded, this);
        } else {
          this._bindModelAsset(asset);
        }
      } else {
        this.model = null;
      }
    }
  }
  get asset() {
    return this._asset;
  }

  set model(value) {
    if (this._model === value) return;

    if (value && value._immutable) {
      Debug.error('Invalid attempt to assign a model to multiple ModelComponents');
      return;
    }
    if (this._model) {
      this._model._immutable = false;
      this.removeModelFromLayers();
      this.entity.removeChild(this._model.getGraph());
      delete this._model._entity;
      if (this._clonedModel) {
        this._model.destroy();
        this._clonedModel = false;
      }
    }
    this._model = value;
    if (this._model) {
      this._model._immutable = true;
      const meshInstances = this._model.meshInstances;
      for (let i = 0; i < meshInstances.length; i++) {
        meshInstances[i].castShadow = this._castShadows;
        meshInstances[i].receiveShadow = this._receiveShadows;
        meshInstances[i].isStatic = this._isStatic;
        meshInstances[i].setCustomAabb(this._customAabb);
      }
      this.lightmapped = this._lightmapped;

      this.entity.addChild(this._model.graph);
      if (this.enabled && this.entity.enabled) {
        this.addModelToLayers();
      }

      this._model._entity = this.entity;

      if (this.entity.animation) this.entity.animation.setModel(this._model);

      if (this.entity.anim) {
        this.entity.anim.rebind();
      }
      if (this.type === 'asset') {
        this.mapping = this._mapping;
      } else {
        this._unsetMaterialEvents();
      }
    }
  }
  get model() {
    return this._model;
  }

  set lightmapped(value) {
    if (value !== this._lightmapped) {
      this._lightmapped = value;
      if (this._model) {
        const mi = this._model.meshInstances;
        for (let i = 0; i < mi.length; i++) {
          mi[i].setLightmapped(value);
        }
      }
    }
  }
  get lightmapped() {
    return this._lightmapped;
  }

  set castShadows(value) {
    if (this._castShadows === value) return;
    const model = this._model;
    if (model) {
      const layers = this.layers;
      const scene = this.system.app.scene;
      if (this._castShadows && !value) {
        for (let i = 0; i < layers.length; i++) {
          const layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
          if (!layer) continue;
          layer.removeShadowCasters(model.meshInstances);
        }
      }
      const meshInstances = model.meshInstances;
      for (let i = 0; i < meshInstances.length; i++) {
        meshInstances[i].castShadow = value;
      }
      if (!this._castShadows && value) {
        for (let i = 0; i < layers.length; i++) {
          const layer = scene.layers.getLayerById(layers[i]);
          if (!layer) continue;
          layer.addShadowCasters(model.meshInstances);
        }
      }
    }
    this._castShadows = value;
  }
  get castShadows() {
    return this._castShadows;
  }

  set receiveShadows(value) {
    if (this._receiveShadows === value) return;
    this._receiveShadows = value;
    if (this._model) {
      const meshInstances = this._model.meshInstances;
      for (let i = 0, len = meshInstances.length; i < len; i++) {
        meshInstances[i].receiveShadow = value;
      }
    }
  }
  get receiveShadows() {
    return this._receiveShadows;
  }

  set castShadowsLightmap(value) {
    this._castShadowsLightmap = value;
  }
  get castShadowsLightmap() {
    return this._castShadowsLightmap;
  }

  set lightmapSizeMultiplier(value) {
    this._lightmapSizeMultiplier = value;
  }
  get lightmapSizeMultiplier() {
    return this._lightmapSizeMultiplier;
  }

  set isStatic(value) {
    if (this._isStatic === value) return;
    this._isStatic = value;
    if (this._model) {
      const rcv = this._model.meshInstances;
      for (let i = 0; i < rcv.length; i++) {
        const m = rcv[i];
        m.isStatic = value;
      }
    }
  }
  get isStatic() {
    return this._isStatic;
  }

  set layers(value) {
    const layers = this.system.app.scene.layers;
    if (this.meshInstances) {
      for (let i = 0; i < this._layers.length; i++) {
        const layer = layers.getLayerById(this._layers[i]);
        if (!layer) continue;
        layer.removeMeshInstances(this.meshInstances);
      }
    }

    this._layers.length = 0;
    for (let i = 0; i < value.length; i++) {
      this._layers[i] = value[i];
    }

    if (!this.enabled || !this.entity.enabled || !this.meshInstances) return;

    for (let i = 0; i < this._layers.length; i++) {
      const layer = layers.getLayerById(this._layers[i]);
      if (!layer) continue;
      layer.addMeshInstances(this.meshInstances);
    }
  }
  get layers() {
    return this._layers;
  }

  set batchGroupId(value) {
    if (this._batchGroupId === value) return;
    if (this.entity.enabled && this._batchGroupId >= 0) {
      var _this$system$app$batc;
      (_this$system$app$batc = this.system.app.batcher) == null ? void 0 : _this$system$app$batc.remove(BatchGroup.MODEL, this.batchGroupId, this.entity);
    }
    if (this.entity.enabled && value >= 0) {
      var _this$system$app$batc2;
      (_this$system$app$batc2 = this.system.app.batcher) == null ? void 0 : _this$system$app$batc2.insert(BatchGroup.MODEL, value, this.entity);
    }
    if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
      this.addModelToLayers();
    }
    this._batchGroupId = value;
  }
  get batchGroupId() {
    return this._batchGroupId;
  }

  set materialAsset(value) {
    let _id = value;
    if (value instanceof Asset) {
      _id = value.id;
    }
    const assets = this.system.app.assets;
    if (_id !== this._materialAsset) {
      if (this._materialAsset) {
        assets.off('add:' + this._materialAsset, this._onMaterialAssetAdd, this);
        const _prev = assets.get(this._materialAsset);
        if (_prev) {
          this._unbindMaterialAsset(_prev);
        }
      }
      this._materialAsset = _id;
      if (this._materialAsset) {
        const asset = assets.get(this._materialAsset);
        if (!asset) {
          this._setMaterial(this.system.defaultMaterial);
          assets.on('add:' + this._materialAsset, this._onMaterialAssetAdd, this);
        } else {
          this._bindMaterialAsset(asset);
        }
      } else {
        this._setMaterial(this.system.defaultMaterial);
      }
    }
  }
  get materialAsset() {
    return this._materialAsset;
  }

  set material(value) {
    if (this._material === value) return;
    this.materialAsset = null;
    this._setMaterial(value);
  }
  get material() {
    return this._material;
  }

  set mapping(value) {
    if (this._type !== 'asset') return;

    this._unsetMaterialEvents();

    if (!value) value = {};
    this._mapping = value;
    if (!this._model) return;
    const meshInstances = this._model.meshInstances;
    const modelAsset = this.asset ? this.system.app.assets.get(this.asset) : null;
    const assetMapping = modelAsset ? modelAsset.data.mapping : null;
    let asset = null;
    for (let i = 0, len = meshInstances.length; i < len; i++) {
      if (value[i] !== undefined) {
        if (value[i]) {
          asset = this.system.app.assets.get(value[i]);
          this._loadAndSetMeshInstanceMaterial(asset, meshInstances[i], i);
        } else {
          meshInstances[i].material = this.system.defaultMaterial;
        }
      } else if (assetMapping) {
        if (assetMapping[i] && (assetMapping[i].material || assetMapping[i].path)) {
          if (assetMapping[i].material !== undefined) {
            asset = this.system.app.assets.get(assetMapping[i].material);
          } else if (assetMapping[i].path !== undefined) {
            const url = this._getMaterialAssetUrl(assetMapping[i].path);
            if (url) {
              asset = this.system.app.assets.getByUrl(url);
            }
          }
          this._loadAndSetMeshInstanceMaterial(asset, meshInstances[i], i);
        } else {
          meshInstances[i].material = this.system.defaultMaterial;
        }
      }
    }
  }
  get mapping() {
    return this._mapping;
  }
  addModelToLayers() {
    const layers = this.system.app.scene.layers;
    for (let i = 0; i < this._layers.length; i++) {
      const layer = layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.addMeshInstances(this.meshInstances);
      }
    }
  }
  removeModelFromLayers() {
    const layers = this.system.app.scene.layers;
    for (let i = 0; i < this._layers.length; i++) {
      const layer = layers.getLayerById(this._layers[i]);
      if (!layer) continue;
      layer.removeMeshInstances(this.meshInstances);
    }
  }
  onRemoveChild() {
    if (this._model) this.removeModelFromLayers();
  }
  onInsertChild() {
    if (this._model && this.enabled && this.entity.enabled) this.addModelToLayers();
  }
  onRemove() {
    this.asset = null;
    this.model = null;
    this.materialAsset = null;
    this._unsetMaterialEvents();
    this.entity.off('remove', this.onRemoveChild, this);
    this.entity.off('insert', this.onInsertChild, this);
  }

  onLayersChanged(oldComp, newComp) {
    this.addModelToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }

  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addMeshInstances(this.meshInstances);
  }

  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeMeshInstances(this.meshInstances);
  }

  _setMaterialEvent(index, event, id, handler) {
    const evt = event + ':' + id;
    this.system.app.assets.on(evt, handler, this);
    if (!this._materialEvents) this._materialEvents = [];
    if (!this._materialEvents[index]) this._materialEvents[index] = {};
    this._materialEvents[index][evt] = {
      id: id,
      handler: handler
    };
  }

  _unsetMaterialEvents() {
    const assets = this.system.app.assets;
    const events = this._materialEvents;
    if (!events) return;
    for (let i = 0, len = events.length; i < len; i++) {
      if (!events[i]) continue;
      const evt = events[i];
      for (const key in evt) {
        assets.off(key, evt[key].handler, this);
      }
    }
    this._materialEvents = null;
  }

  _getAssetByIdOrPath(idOrPath) {
    let asset = null;
    const isPath = isNaN(parseInt(idOrPath, 10));

    if (!isPath) {
      asset = this.system.app.assets.get(idOrPath);
    } else if (this.asset) {
      const url = this._getMaterialAssetUrl(idOrPath);
      if (url) asset = this.system.app.assets.getByUrl(url);
    }
    return asset;
  }

  _getMaterialAssetUrl(path) {
    if (!this.asset) return null;
    const modelAsset = this.system.app.assets.get(this.asset);
    return modelAsset ? modelAsset.getAbsoluteUrl(path) : null;
  }

  _loadAndSetMeshInstanceMaterial(materialAsset, meshInstance, index) {
    const assets = this.system.app.assets;
    if (!materialAsset) return;
    if (materialAsset.resource) {
      meshInstance.material = materialAsset.resource;
      this._setMaterialEvent(index, 'remove', materialAsset.id, function () {
        meshInstance.material = this.system.defaultMaterial;
      });
    } else {
      this._setMaterialEvent(index, 'load', materialAsset.id, function (asset) {
        meshInstance.material = asset.resource;
        this._setMaterialEvent(index, 'remove', materialAsset.id, function () {
          meshInstance.material = this.system.defaultMaterial;
        });
      });
      if (this.enabled && this.entity.enabled) assets.load(materialAsset);
    }
  }
  onEnable() {
    const app = this.system.app;
    const scene = app.scene;
    scene.on('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.on('add', this.onLayerAdded, this);
      scene.layers.on('remove', this.onLayerRemoved, this);
    }
    const isAsset = this._type === 'asset';
    let asset;
    if (this._model) {
      this.addModelToLayers();
    } else if (isAsset && this._asset) {
      asset = app.assets.get(this._asset);
      if (asset && asset.resource !== this._model) {
        this._bindModelAsset(asset);
      }
    }
    if (this._materialAsset) {
      asset = app.assets.get(this._materialAsset);
      if (asset && asset.resource !== this._material) {
        this._bindMaterialAsset(asset);
      }
    }
    if (isAsset) {
      if (this._mapping) {
        for (const index in this._mapping) {
          if (this._mapping[index]) {
            asset = this._getAssetByIdOrPath(this._mapping[index]);
            if (asset && !asset.resource) {
              app.assets.load(asset);
            }
          }
        }
      }
    }
    if (this._batchGroupId >= 0) {
      var _app$batcher;
      (_app$batcher = app.batcher) == null ? void 0 : _app$batcher.insert(BatchGroup.MODEL, this.batchGroupId, this.entity);
    }
  }
  onDisable() {
    const app = this.system.app;
    const scene = app.scene;
    scene.off('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.off('add', this.onLayerAdded, this);
      scene.layers.off('remove', this.onLayerRemoved, this);
    }
    if (this._batchGroupId >= 0) {
      var _app$batcher2;
      (_app$batcher2 = app.batcher) == null ? void 0 : _app$batcher2.remove(BatchGroup.MODEL, this.batchGroupId, this.entity);
    }
    if (this._model) {
      this.removeModelFromLayers();
    }
  }

  hide() {
    if (this._model) {
      const instances = this._model.meshInstances;
      for (let i = 0, l = instances.length; i < l; i++) {
        instances[i].visible = false;
      }
    }
  }

  show() {
    if (this._model) {
      const instances = this._model.meshInstances;
      for (let i = 0, l = instances.length; i < l; i++) {
        instances[i].visible = true;
      }
    }
  }

  _bindMaterialAsset(asset) {
    asset.on('load', this._onMaterialAssetLoad, this);
    asset.on('unload', this._onMaterialAssetUnload, this);
    asset.on('remove', this._onMaterialAssetRemove, this);
    asset.on('change', this._onMaterialAssetChange, this);
    if (asset.resource) {
      this._onMaterialAssetLoad(asset);
    } else {
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }

  _unbindMaterialAsset(asset) {
    asset.off('load', this._onMaterialAssetLoad, this);
    asset.off('unload', this._onMaterialAssetUnload, this);
    asset.off('remove', this._onMaterialAssetRemove, this);
    asset.off('change', this._onMaterialAssetChange, this);
  }

  _onMaterialAssetAdd(asset) {
    this.system.app.assets.off('add:' + asset.id, this._onMaterialAssetAdd, this);
    if (this._materialAsset === asset.id) {
      this._bindMaterialAsset(asset);
    }
  }

  _onMaterialAssetLoad(asset) {
    this._setMaterial(asset.resource);
  }

  _onMaterialAssetUnload(asset) {
    this._setMaterial(this.system.defaultMaterial);
  }

  _onMaterialAssetRemove(asset) {
    this._onMaterialAssetUnload(asset);
  }

  _onMaterialAssetChange(asset) {}

  _bindModelAsset(asset) {
    this._unbindModelAsset(asset);
    asset.on('load', this._onModelAssetLoad, this);
    asset.on('unload', this._onModelAssetUnload, this);
    asset.on('change', this._onModelAssetChange, this);
    asset.on('remove', this._onModelAssetRemove, this);
    if (asset.resource) {
      this._onModelAssetLoad(asset);
    } else {
      if (!this.enabled || !this.entity.enabled) return;
      this.system.app.assets.load(asset);
    }
  }

  _unbindModelAsset(asset) {
    asset.off('load', this._onModelAssetLoad, this);
    asset.off('unload', this._onModelAssetUnload, this);
    asset.off('change', this._onModelAssetChange, this);
    asset.off('remove', this._onModelAssetRemove, this);
  }

  _onModelAssetAdded(asset) {
    this.system.app.assets.off('add:' + asset.id, this._onModelAssetAdded, this);
    if (asset.id === this._asset) {
      this._bindModelAsset(asset);
    }
  }

  _onModelAssetLoad(asset) {
    this.model = asset.resource.clone();
    this._clonedModel = true;
  }

  _onModelAssetUnload(asset) {
    this.model = null;
  }

  _onModelAssetChange(asset, attr, _new, _old) {
    if (attr === 'data') {
      this.mapping = this._mapping;
    }
  }

  _onModelAssetRemove(asset) {
    this.model = null;
  }

  _setMaterial(material) {
    if (this._material === material) return;
    this._material = material;
    const model = this._model;
    if (model && this._type !== 'asset') {
      const meshInstances = model.meshInstances;
      for (let i = 0, len = meshInstances.length; i < len; i++) {
        meshInstances[i].material = material;
      }
    }
  }
}

export { ModelComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvbW9kZWwvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5pbXBvcnQge1xuICAgIExBWUVSSURfV09STERcbn0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IEJhdGNoR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9iYXRjaGluZy9iYXRjaC1ncm91cC5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9tb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXRTaGFwZVByaW1pdGl2ZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL3Byb2NlZHVyYWwuanMnO1xuXG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuLyoqXG4gKiBFbmFibGVzIGFuIEVudGl0eSB0byByZW5kZXIgYSBtb2RlbCBvciBhIHByaW1pdGl2ZSBzaGFwZS4gVGhpcyBDb21wb25lbnQgYXR0YWNoZXMgYWRkaXRpb25hbFxuICogbW9kZWwgZ2VvbWV0cnkgaW4gdG8gdGhlIHNjZW5lIGdyYXBoIGJlbG93IHRoZSBFbnRpdHkuXG4gKlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBNb2RlbENvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF90eXBlID0gJ2Fzc2V0JztcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBc3NldHxudW1iZXJ8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hc3NldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TW9kZWx8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tb2RlbCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgbnVtYmVyPn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXBwaW5nID0ge307XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jYXN0U2hhZG93cyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yZWNlaXZlU2hhZG93cyA9IHRydWU7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnKS5NYXRlcmlhbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRlcmlhbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nhc3RTaGFkb3dzTGlnaHRtYXAgPSB0cnVlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGlnaHRtYXBwZWQgPSBmYWxzZTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IDE7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pc1N0YXRpYyA9IGZhbHNlO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2JhdGNoR3JvdXBJZCA9IC0xO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnKS5Cb3VuZGluZ0JveHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2N1c3RvbUFhYmIgPSBudWxsO1xuXG4gICAgX2FyZWEgPSBudWxsO1xuXG4gICAgX21hdGVyaWFsRXZlbnRzID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Nsb25lZE1vZGVsID0gZmFsc2U7XG5cbiAgICAvLyAjaWYgX0RFQlVHXG4gICAgX2JhdGNoR3JvdXAgPSBudWxsO1xuICAgIC8vICNlbmRpZlxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IE1vZGVsQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuTW9kZWxDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcblxuICAgICAgICAvLyBoYW5kbGUgZXZlbnRzIHdoZW4gdGhlIGVudGl0eSBpcyBkaXJlY3RseSAob3IgaW5kaXJlY3RseSBhcyBhIGNoaWxkIG9mIHN1Yi1oaWVyYXJjaHkpIGFkZGVkIG9yIHJlbW92ZWQgZnJvbSB0aGUgcGFyZW50XG4gICAgICAgIGVudGl0eS5vbigncmVtb3ZlJywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdyZW1vdmVoaWVyYXJjaHknLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ2luc2VydCcsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbignaW5zZXJ0aGllcmFyY2h5JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBtZXNoSW5zdGFuY2VzIGNvbnRhaW5lZCBpbiB0aGUgY29tcG9uZW50J3MgbW9kZWwuIElmIG1vZGVsIGlzIG5vdCBzZXQgb3IgbG9hZGVkXG4gICAgICogZm9yIGNvbXBvbmVudCBpdCB3aWxsIHJldHVybiBudWxsLlxuICAgICAqXG4gICAgICogQHR5cGUge01lc2hJbnN0YW5jZVtdfG51bGx9XG4gICAgICovXG4gICAgc2V0IG1lc2hJbnN0YW5jZXModmFsdWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9tb2RlbClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IG1lc2hJbnN0YW5jZXMoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcblxuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBzZXQsIHRoZSBvYmplY3Qgc3BhY2UgYm91bmRpbmcgYm94IGlzIHVzZWQgYXMgYSBib3VuZGluZyBib3ggZm9yIHZpc2liaWxpdHkgY3VsbGluZyBvZlxuICAgICAqIGF0dGFjaGVkIG1lc2ggaW5zdGFuY2VzLiBUaGlzIGlzIGFuIG9wdGltaXphdGlvbiwgYWxsb3dpbmcgb3ZlcnNpemVkIGJvdW5kaW5nIGJveCB0byBiZVxuICAgICAqIHNwZWNpZmllZCBmb3Igc2tpbm5lZCBjaGFyYWN0ZXJzIGluIG9yZGVyIHRvIGF2b2lkIHBlciBmcmFtZSBib3VuZGluZyBib3ggY29tcHV0YXRpb25zIGJhc2VkXG4gICAgICogb24gYm9uZSBwb3NpdGlvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcycpLkJvdW5kaW5nQm94fG51bGx9XG4gICAgICovXG4gICAgc2V0IGN1c3RvbUFhYmIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IHZhbHVlO1xuXG4gICAgICAgIC8vIHNldCBpdCBvbiBtZXNoSW5zdGFuY2VzXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5zZXRDdXN0b21BYWJiKHRoaXMuX2N1c3RvbUFhYmIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjdXN0b21BYWJiKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VzdG9tQWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiB0aGUgbW9kZWwuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0gXCJhc3NldFwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgbW9kZWwgYXNzZXRcbiAgICAgKiAtIFwiYm94XCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBib3ggKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwiY2Fwc3VsZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY2Fwc3VsZSAocmFkaXVzIDAuNSwgaGVpZ2h0IDIpXG4gICAgICogLSBcImNvbmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGNvbmUgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJjeWxpbmRlclwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY3lsaW5kZXIgKHJhZGl1cyAwLjUsIGhlaWdodCAxKVxuICAgICAqIC0gXCJwbGFuZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgcGxhbmUgKDEgdW5pdCBpbiBlYWNoIGRpbWVuc2lvbilcbiAgICAgKiAtIFwic3BoZXJlXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBzcGhlcmUgKHJhZGl1cyAwLjUpXG4gICAgICogLSBcInRvcnVzXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSB0b3J1cyAodHViZVJhZGl1czogMC4yLCByaW5nUmFkaXVzOiAwLjMpXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgICAqL1xuICAgIHNldCB0eXBlKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl90eXBlID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX2FyZWEgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuX3R5cGUgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodmFsdWUgPT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hc3NldCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KHRoaXMuX2Fzc2V0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIC8vIGdldCAvIGNyZWF0ZSBtZXNoIG9mIHR5cGVcbiAgICAgICAgICAgIGNvbnN0IHByaW1EYXRhID0gZ2V0U2hhcGVQcmltaXRpdmUodGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLCB2YWx1ZSk7XG4gICAgICAgICAgICB0aGlzLl9hcmVhID0gcHJpbURhdGEuYXJlYTtcbiAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBwcmltRGF0YS5tZXNoO1xuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gbmV3IEdyYXBoTm9kZSgpO1xuICAgICAgICAgICAgY29uc3QgbW9kZWwgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgICAgIG1vZGVsLmdyYXBoID0gbm9kZTtcblxuICAgICAgICAgICAgbW9kZWwubWVzaEluc3RhbmNlcyA9IFtuZXcgTWVzaEluc3RhbmNlKG1lc2gsIHRoaXMuX21hdGVyaWFsLCBub2RlKV07XG5cbiAgICAgICAgICAgIHRoaXMubW9kZWwgPSBtb2RlbDtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCB0eXBlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fdHlwZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgYXNzZXQgZm9yIHRoZSBtb2RlbCAob25seSBhcHBsaWVzIHRvIG1vZGVscyBvZiB0eXBlICdhc3NldCcpIGNhbiBhbHNvIGJlIGFuIGFzc2V0IGlkLlxuICAgICAqXG4gICAgICogQHR5cGUge0Fzc2V0fG51bWJlcnxudWxsfVxuICAgICAqL1xuICAgIHNldCBhc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBsZXQgX2lkID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgQXNzZXQpIHtcbiAgICAgICAgICAgIF9pZCA9IHZhbHVlLmlkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0ICE9PSBfaWQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9hc3NldCkge1xuICAgICAgICAgICAgICAgIC8vIHJlbW92ZSBwcmV2aW91cyBhc3NldFxuICAgICAgICAgICAgICAgIGFzc2V0cy5vZmYoJ2FkZDonICsgdGhpcy5fYXNzZXQsIHRoaXMuX29uTW9kZWxBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zdCBfcHJldiA9IGFzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmIChfcHJldikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl91bmJpbmRNb2RlbEFzc2V0KF9wcmV2KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0ID0gX2lkO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fYXNzZXQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldCA9IGFzc2V0cy5nZXQodGhpcy5fYXNzZXQpO1xuICAgICAgICAgICAgICAgIGlmICghYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9hc3NldCwgdGhpcy5fb25Nb2RlbEFzc2V0QWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNb2RlbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1vZGVsIHRoYXQgaXMgYWRkZWQgdG8gdGhlIHNjZW5lIGdyYXBoLiBJdCBjYW4gYmUgbm90IHNldCBvciBsb2FkZWQsIHNvIHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TW9kZWx9XG4gICAgICovXG4gICAgc2V0IG1vZGVsKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCA9PT0gdmFsdWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgLy8gcmV0dXJuIGlmIHRoZSBtb2RlbCBoYXMgYmVlbiBmbGFnZ2VkIGFzIGltbXV0YWJsZVxuICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUuX2ltbXV0YWJsZSkge1xuICAgICAgICAgICAgRGVidWcuZXJyb3IoJ0ludmFsaWQgYXR0ZW1wdCB0byBhc3NpZ24gYSBtb2RlbCB0byBtdWx0aXBsZSBNb2RlbENvbXBvbmVudHMnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgdGhpcy5fbW9kZWwuX2ltbXV0YWJsZSA9IGZhbHNlO1xuXG4gICAgICAgICAgICB0aGlzLnJlbW92ZU1vZGVsRnJvbUxheWVycygpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkucmVtb3ZlQ2hpbGQodGhpcy5fbW9kZWwuZ2V0R3JhcGgoKSk7XG4gICAgICAgICAgICBkZWxldGUgdGhpcy5fbW9kZWwuX2VudGl0eTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2Nsb25lZE1vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbW9kZWwuZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2Nsb25lZE1vZGVsID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9tb2RlbCA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgLy8gZmxhZyB0aGUgbW9kZWwgYXMgYmVpbmcgYXNzaWduZWQgdG8gYSBjb21wb25lbnRcbiAgICAgICAgICAgIHRoaXMuX21vZGVsLl9pbW11dGFibGUgPSB0cnVlO1xuXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5jYXN0U2hhZG93ID0gdGhpcy5fY2FzdFNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5yZWNlaXZlU2hhZG93ID0gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5pc1N0YXRpYyA9IHRoaXMuX2lzU3RhdGljO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5saWdodG1hcHBlZCA9IHRoaXMuX2xpZ2h0bWFwcGVkOyAvLyB1cGRhdGUgbWVzaEluc3RhbmNlc1xuXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5hZGRDaGlsZCh0aGlzLl9tb2RlbC5ncmFwaCk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTdG9yZSB0aGUgZW50aXR5IHRoYXQgb3ducyB0aGlzIG1vZGVsXG4gICAgICAgICAgICB0aGlzLl9tb2RlbC5fZW50aXR5ID0gdGhpcy5lbnRpdHk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBhbnkgYW5pbWF0aW9uIGNvbXBvbmVudFxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmFuaW1hdGlvbilcbiAgICAgICAgICAgICAgICB0aGlzLmVudGl0eS5hbmltYXRpb24uc2V0TW9kZWwodGhpcy5fbW9kZWwpO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgYW55IGFuaW0gY29tcG9uZW50XG4gICAgICAgICAgICBpZiAodGhpcy5lbnRpdHkuYW5pbSkge1xuICAgICAgICAgICAgICAgIHRoaXMuZW50aXR5LmFuaW0ucmViaW5kKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyB0cmlnZ2VyIGV2ZW50IGhhbmRsZXIgdG8gbG9hZCBtYXBwaW5nXG4gICAgICAgICAgICAvLyBmb3IgbmV3IG1vZGVsXG4gICAgICAgICAgICBpZiAodGhpcy50eXBlID09PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXBwaW5nID0gdGhpcy5fbWFwcGluZztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1vZGVsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbW9kZWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBtb2RlbCB3aWxsIGJlIGxpZ2h0bWFwcGVkIGFmdGVyIHVzaW5nIGxpZ2h0bWFwcGVyLmJha2UoKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcHBlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2xpZ2h0bWFwcGVkKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0bWFwcGVkID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLnNldExpZ2h0bWFwcGVkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBwZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcHBlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGlzIG1vZGVsIHdpbGwgY2FzdCBzaGFkb3dzIGZvciBsaWdodHMgdGhhdCBoYXZlIHNoYWRvdyBjYXN0aW5nIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3ModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWw7XG5cbiAgICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLmxheWVycztcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lO1xuICAgICAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzICYmICF2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlU2hhZG93Q2FzdGVycyhtb2RlbC5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBtb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5jYXN0U2hhZG93ID0gdmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5fY2FzdFNoYWRvd3MgJiYgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFsYXllcikgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLmFkZFNoYWRvd0Nhc3RlcnMobW9kZWwubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3MgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2FzdFNoYWRvd3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBzaGFkb3dzIHdpbGwgYmUgY2FzdCBvbiB0aGlzIG1vZGVsLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHJlY2VpdmVTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWNlaXZlU2hhZG93cyA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9yZWNlaXZlU2hhZG93cyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ucmVjZWl2ZVNoYWRvdyA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlY2VpdmVTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhpcyBtb2RlbCB3aWxsIGNhc3Qgc2hhZG93cyB3aGVuIHJlbmRlcmluZyBsaWdodG1hcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3NMaWdodG1hcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzTGlnaHRtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBsaWdodG1hcFNpemVNdWx0aXBsaWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIG1vZGVsIGFzIG5vbi1tb3ZhYmxlIChvcHRpbWl6YXRpb24pLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGlzU3RhdGljKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pc1N0YXRpYyA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICB0aGlzLl9pc1N0YXRpYyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tb2RlbCkge1xuICAgICAgICAgICAgY29uc3QgcmN2ID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmN2Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbSA9IHJjdltpXTtcbiAgICAgICAgICAgICAgICBtLmlzU3RhdGljID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaXNTdGF0aWMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc1N0YXRpYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoaXMgbW9kZWwgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCwgcG9wLFxuICAgICAqIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnModmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcblxuICAgICAgICBpZiAodGhpcy5tZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgYWxsIG1lc2ggaW5zdGFuY2VzIGZyb20gb2xkIGxheWVyc1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgdGhlIGxheWVyIGxpc3RcbiAgICAgICAgdGhpcy5fbGF5ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXSA9IHZhbHVlW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZG9uJ3QgYWRkIGludG8gbGF5ZXJzIHVudGlsIHdlJ3JlIGVuYWJsZWRcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQgfHwgIXRoaXMubWVzaEluc3RhbmNlcykgcmV0dXJuO1xuXG4gICAgICAgIC8vIGFkZCBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gbmV3IGxheWVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIG1vZGVsIHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA9PT0gdmFsdWUpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLk1PREVMLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHZhbHVlID49IDApIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5NT0RFTCwgdmFsdWUsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZSA8IDAgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIC8vIHJlLWFkZCBtb2RlbCB0byBzY2VuZSwgaW4gY2FzZSBpdCB3YXMgcmVtb3ZlZCBieSBiYXRjaGluZ1xuICAgICAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgYmF0Y2hHcm91cElkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXRlcmlhbCB7QGxpbmsgQXNzZXR9IHRoYXQgd2lsbCBiZSB1c2VkIHRvIHJlbmRlciB0aGUgbW9kZWwgKG5vdCB1c2VkIG9uIG1vZGVscyBvZiB0eXBlXG4gICAgICogJ2Fzc2V0JykuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfG51bGx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsQXNzZXQodmFsdWUpIHtcbiAgICAgICAgbGV0IF9pZCA9IHZhbHVlO1xuICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBBc3NldCkge1xuICAgICAgICAgICAgX2lkID0gdmFsdWUuaWQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuXG4gICAgICAgIGlmIChfaWQgIT09IHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbEFzc2V0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnN0IF9wcmV2ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoX3ByZXYpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdW5iaW5kTWF0ZXJpYWxBc3NldChfcHJldik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEFzc2V0ID0gX2lkO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0ID0gYXNzZXRzLmdldCh0aGlzLl9tYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0cy5vbignYWRkOicgKyB0aGlzLl9tYXRlcmlhbEFzc2V0LCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsKHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWxBc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsQXNzZXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIHtAbGluayBNYXRlcmlhbH0gdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIHRoZSBtb2RlbCAobm90IHVzZWQgb24gbW9kZWxzIG9mXG4gICAgICogdHlwZSAnYXNzZXQnKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqL1xuICAgIHNldCBtYXRlcmlhbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgPT09IHZhbHVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMubWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWwodmFsdWUpO1xuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEEgZGljdGlvbmFyeSB0aGF0IGhvbGRzIG1hdGVyaWFsIG92ZXJyaWRlcyBmb3IgZWFjaCBtZXNoIGluc3RhbmNlLiBPbmx5IGFwcGxpZXMgdG8gbW9kZWxcbiAgICAgKiBjb21wb25lbnRzIG9mIHR5cGUgJ2Fzc2V0Jy4gVGhlIG1hcHBpbmcgY29udGFpbnMgcGFpcnMgb2YgbWVzaCBpbnN0YW5jZSBpbmRleCAtIG1hdGVyaWFsXG4gICAgICogYXNzZXQgaWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0PHN0cmluZywgbnVtYmVyPn1cbiAgICAgKi9cbiAgICBzZXQgbWFwcGluZyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fdHlwZSAhPT0gJ2Fzc2V0JylcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAvLyB1bnN1YnNjcmliZSBmcm9tIG9sZCBldmVudHNcbiAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuXG4gICAgICAgIC8vIGNhbid0IGhhdmUgYSBudWxsIG1hcHBpbmdcbiAgICAgICAgaWYgKCF2YWx1ZSlcbiAgICAgICAgICAgIHZhbHVlID0ge307XG5cbiAgICAgICAgdGhpcy5fbWFwcGluZyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpIHJldHVybjtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fbW9kZWwubWVzaEluc3RhbmNlcztcbiAgICAgICAgY29uc3QgbW9kZWxBc3NldCA9IHRoaXMuYXNzZXQgPyB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldCh0aGlzLmFzc2V0KSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGFzc2V0TWFwcGluZyA9IG1vZGVsQXNzZXQgPyBtb2RlbEFzc2V0LmRhdGEubWFwcGluZyA6IG51bGw7XG4gICAgICAgIGxldCBhc3NldCA9IG51bGw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZVtpXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodmFsdWVbaV0pO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkQW5kU2V0TWVzaEluc3RhbmNlTWF0ZXJpYWwoYXNzZXQsIG1lc2hJbnN0YW5jZXNbaV0sIGkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChhc3NldE1hcHBpbmcpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRNYXBwaW5nW2ldICYmIChhc3NldE1hcHBpbmdbaV0ubWF0ZXJpYWwgfHwgYXNzZXRNYXBwaW5nW2ldLnBhdGgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldE1hcHBpbmdbaV0ubWF0ZXJpYWwgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmdldChhc3NldE1hcHBpbmdbaV0ubWF0ZXJpYWwpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFzc2V0TWFwcGluZ1tpXS5wYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHVybCA9IHRoaXMuX2dldE1hdGVyaWFsQXNzZXRVcmwoYXNzZXRNYXBwaW5nW2ldLnBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHVybCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXRCeVVybCh1cmwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2xvYWRBbmRTZXRNZXNoSW5zdGFuY2VNYXRlcmlhbChhc3NldCwgbWVzaEluc3RhbmNlc1tpXSwgaSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWFwcGluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hcHBpbmc7XG4gICAgfVxuXG4gICAgYWRkTW9kZWxUb0xheWVycygpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLm1lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAoIWxheWVyKSBjb250aW51ZTtcbiAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmVtb3ZlQ2hpbGQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tb2RlbClcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgb25JbnNlcnRDaGlsZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVsICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKVxuICAgICAgICAgICAgdGhpcy5hZGRNb2RlbFRvTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuYXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLm1vZGVsID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYXRlcmlhbEFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5fdW5zZXRNYXRlcmlhbEV2ZW50cygpO1xuXG4gICAgICAgIHRoaXMuZW50aXR5Lm9mZigncmVtb3ZlJywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdpbnNlcnQnLCB0aGlzLm9uSW5zZXJ0Q2hpbGQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9jb21wb3NpdGlvbi9sYXllci1jb21wb3NpdGlvbi5qcycpLkxheWVyQ29tcG9zaXRpb259IG9sZENvbXAgLSBUaGVcbiAgICAgKiBvbGQgbGF5ZXIgY29tcG9zaXRpb24uXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL2NvbXBvc2l0aW9uL2xheWVyLWNvbXBvc2l0aW9uLmpzJykuTGF5ZXJDb21wb3NpdGlvbn0gbmV3Q29tcCAtIFRoZVxuICAgICAqIG5ldyBsYXllciBjb21wb3NpdGlvbi5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJzQ2hhbmdlZChvbGRDb21wLCBuZXdDb21wKSB7XG4gICAgICAgIHRoaXMuYWRkTW9kZWxUb0xheWVycygpO1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtMYXllcn0gbGF5ZXIgLSBUaGUgbGF5ZXIgdGhhdCB3YXMgYWRkZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBvbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMubWVzaEluc3RhbmNlcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtMYXllcn0gbGF5ZXIgLSBUaGUgbGF5ZXIgdGhhdCB3YXMgcmVtb3ZlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLm1lc2hJbnN0YW5jZXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIFRoZSBpbmRleCBvZiB0aGUgbWVzaCBpbnN0YW5jZS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnQgLSBUaGUgZXZlbnQgbmFtZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBUaGUgYXNzZXQgaWQuXG4gICAgICogQHBhcmFtIHsqfSBoYW5kbGVyIC0gVGhlIGhhbmRsZXIgZnVuY3Rpb24gdG8gYmUgYm91bmQgdG8gdGhlIHNwZWNpZmllZCBldmVudC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRNYXRlcmlhbEV2ZW50KGluZGV4LCBldmVudCwgaWQsIGhhbmRsZXIpIHtcbiAgICAgICAgY29uc3QgZXZ0ID0gZXZlbnQgKyAnOicgKyBpZDtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5vbihldnQsIGhhbmRsZXIsIHRoaXMpO1xuXG4gICAgICAgIGlmICghdGhpcy5fbWF0ZXJpYWxFdmVudHMpXG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbEV2ZW50cyA9IFtdO1xuXG4gICAgICAgIGlmICghdGhpcy5fbWF0ZXJpYWxFdmVudHNbaW5kZXhdKVxuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxFdmVudHNbaW5kZXhdID0geyB9O1xuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsRXZlbnRzW2luZGV4XVtldnRdID0ge1xuICAgICAgICAgICAgaWQ6IGlkLFxuICAgICAgICAgICAgaGFuZGxlcjogaGFuZGxlclxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF91bnNldE1hdGVyaWFsRXZlbnRzKCkge1xuICAgICAgICBjb25zdCBhc3NldHMgPSB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzO1xuICAgICAgICBjb25zdCBldmVudHMgPSB0aGlzLl9tYXRlcmlhbEV2ZW50cztcbiAgICAgICAgaWYgKCFldmVudHMpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGV2ZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgaWYgKCFldmVudHNbaV0pIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgZXZ0ID0gZXZlbnRzW2ldO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gZXZ0KSB7XG4gICAgICAgICAgICAgICAgYXNzZXRzLm9mZihrZXksIGV2dFtrZXldLmhhbmRsZXIsIHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWxFdmVudHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBpZE9yUGF0aCAtIFRoZSBhc3NldCBpZCBvciBwYXRoLlxuICAgICAqIEByZXR1cm5zIHtBc3NldHxudWxsfSBUaGUgYXNzZXQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0QXNzZXRCeUlkT3JQYXRoKGlkT3JQYXRoKSB7XG4gICAgICAgIGxldCBhc3NldCA9IG51bGw7XG4gICAgICAgIGNvbnN0IGlzUGF0aCA9IGlzTmFOKHBhcnNlSW50KGlkT3JQYXRoLCAxMCkpO1xuXG4gICAgICAgIC8vIGdldCBhc3NldCBieSBpZCBvciB1cmxcbiAgICAgICAgaWYgKCFpc1BhdGgpIHtcbiAgICAgICAgICAgIGFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQoaWRPclBhdGgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuYXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IHRoaXMuX2dldE1hdGVyaWFsQXNzZXRVcmwoaWRPclBhdGgpO1xuICAgICAgICAgICAgaWYgKHVybClcbiAgICAgICAgICAgICAgICBhc3NldCA9IHRoaXMuc3lzdGVtLmFwcC5hc3NldHMuZ2V0QnlVcmwodXJsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhc3NldDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aCAtIFRoZSBwYXRoIG9mIHRoZSBtb2RlbCBhc3NldC5cbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9IFRoZSBtb2RlbCBhc3NldCBVUkwgb3IgbnVsbCBpZiB0aGUgYXNzZXQgaXMgbm90IGluIHRoZSByZWdpc3RyeS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9nZXRNYXRlcmlhbEFzc2V0VXJsKHBhdGgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmFzc2V0KSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCBtb2RlbEFzc2V0ID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5nZXQodGhpcy5hc3NldCk7XG5cbiAgICAgICAgcmV0dXJuIG1vZGVsQXNzZXQgPyBtb2RlbEFzc2V0LmdldEFic29sdXRlVXJsKHBhdGgpIDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBtYXRlcmlhbEFzc2V0IC1UaGUgbWF0ZXJpYWwgYXNzZXQgdG8gbG9hZC5cbiAgICAgKiBAcGFyYW0ge01lc2hJbnN0YW5jZX0gbWVzaEluc3RhbmNlIC0gVGhlIG1lc2ggaW5zdGFuY2UgdG8gYXNzaWduIHRoZSBtYXRlcmlhbCB0by5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaW5kZXggLSBUaGUgaW5kZXggb2YgdGhlIG1lc2ggaW5zdGFuY2UuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbG9hZEFuZFNldE1lc2hJbnN0YW5jZU1hdGVyaWFsKG1hdGVyaWFsQXNzZXQsIG1lc2hJbnN0YW5jZSwgaW5kZXgpIHtcbiAgICAgICAgY29uc3QgYXNzZXRzID0gdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cztcblxuICAgICAgICBpZiAoIW1hdGVyaWFsQXNzZXQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKG1hdGVyaWFsQXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IG1hdGVyaWFsQXNzZXQucmVzb3VyY2U7XG5cbiAgICAgICAgICAgIHRoaXMuX3NldE1hdGVyaWFsRXZlbnQoaW5kZXgsICdyZW1vdmUnLCBtYXRlcmlhbEFzc2V0LmlkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbEV2ZW50KGluZGV4LCAnbG9hZCcsIG1hdGVyaWFsQXNzZXQuaWQsIGZ1bmN0aW9uIChhc3NldCkge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCA9IGFzc2V0LnJlc291cmNlO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fc2V0TWF0ZXJpYWxFdmVudChpbmRleCwgJ3JlbW92ZScsIG1hdGVyaWFsQXNzZXQuaWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZClcbiAgICAgICAgICAgICAgICBhc3NldHMubG9hZChtYXRlcmlhbEFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gYXBwLnNjZW5lO1xuXG4gICAgICAgIHNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAoc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc0Fzc2V0ID0gKHRoaXMuX3R5cGUgPT09ICdhc3NldCcpO1xuXG4gICAgICAgIGxldCBhc3NldDtcbiAgICAgICAgaWYgKHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICB0aGlzLmFkZE1vZGVsVG9MYXllcnMoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0Fzc2V0ICYmIHRoaXMuX2Fzc2V0KSB7XG4gICAgICAgICAgICAvLyBiaW5kIGFuZCBsb2FkIG1vZGVsIGFzc2V0IGlmIG5lY2Vzc2FyeVxuICAgICAgICAgICAgYXNzZXQgPSBhcHAuYXNzZXRzLmdldCh0aGlzLl9hc3NldCk7XG4gICAgICAgICAgICBpZiAoYXNzZXQgJiYgYXNzZXQucmVzb3VyY2UgIT09IHRoaXMuX21vZGVsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fYmluZE1vZGVsQXNzZXQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsQXNzZXQpIHtcbiAgICAgICAgICAgIC8vIGJpbmQgYW5kIGxvYWQgbWF0ZXJpYWwgYXNzZXQgaWYgbmVjZXNzYXJ5XG4gICAgICAgICAgICBhc3NldCA9IGFwcC5hc3NldHMuZ2V0KHRoaXMuX21hdGVyaWFsQXNzZXQpO1xuICAgICAgICAgICAgaWYgKGFzc2V0ICYmIGFzc2V0LnJlc291cmNlICE9PSB0aGlzLl9tYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0Fzc2V0KSB7XG4gICAgICAgICAgICAvLyBiaW5kIG1hcHBlZCBhc3NldHNcbiAgICAgICAgICAgIC8vIFRPRE86IHJlcGxhY2VcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpbmRleCBpbiB0aGlzLl9tYXBwaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tYXBwaW5nW2luZGV4XSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXQgPSB0aGlzLl9nZXRBc3NldEJ5SWRPclBhdGgodGhpcy5fbWFwcGluZ1tpbmRleF0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0ICYmICFhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIGFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5NT0RFTCwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuTU9ERUwsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlTW9kZWxGcm9tTGF5ZXJzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wIHJlbmRlcmluZyBtb2RlbCB3aXRob3V0IHJlbW92aW5nIGl0IGZyb20gdGhlIHNjZW5lIGhpZXJhcmNoeS4gVGhpcyBtZXRob2Qgc2V0cyB0aGVcbiAgICAgKiB7QGxpbmsgTWVzaEluc3RhbmNlI3Zpc2libGV9IHByb3BlcnR5IG9mIGV2ZXJ5IE1lc2hJbnN0YW5jZSBpbiB0aGUgbW9kZWwgdG8gZmFsc2UgTm90ZSwgdGhpc1xuICAgICAqIGRvZXMgbm90IHJlbW92ZSB0aGUgbW9kZWwgb3IgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGUgc2NlbmUgaGllcmFyY2h5IG9yIGRyYXcgY2FsbCBsaXN0LiBTb1xuICAgICAqIHRoZSBtb2RlbCBjb21wb25lbnQgc3RpbGwgaW5jdXJzIHNvbWUgQ1BVIG92ZXJoZWFkLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB0aGlzLnRpbWVyID0gMDtcbiAgICAgKiB0aGlzLnZpc2libGUgPSB0cnVlO1xuICAgICAqIC8vIC4uLlxuICAgICAqIC8vIGJsaW5rIG1vZGVsIGV2ZXJ5IDAuMSBzZWNvbmRzXG4gICAgICogdGhpcy50aW1lciArPSBkdDtcbiAgICAgKiBpZiAodGhpcy50aW1lciA+IDAuMSkge1xuICAgICAqICAgICBpZiAoIXRoaXMudmlzaWJsZSkge1xuICAgICAqICAgICAgICAgdGhpcy5lbnRpdHkubW9kZWwuc2hvdygpO1xuICAgICAqICAgICAgICAgdGhpcy52aXNpYmxlID0gdHJ1ZTtcbiAgICAgKiAgICAgfSBlbHNlIHtcbiAgICAgKiAgICAgICAgIHRoaXMuZW50aXR5Lm1vZGVsLmhpZGUoKTtcbiAgICAgKiAgICAgICAgIHRoaXMudmlzaWJsZSA9IGZhbHNlO1xuICAgICAqICAgICB9XG4gICAgICogICAgIHRoaXMudGltZXIgPSAwO1xuICAgICAqIH1cbiAgICAgKi9cbiAgICBoaWRlKCkge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0udmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHJlbmRlcmluZyBvZiB0aGUgbW9kZWwgaWYgaGlkZGVuIHVzaW5nIHtAbGluayBNb2RlbENvbXBvbmVudCNoaWRlfS4gVGhpcyBtZXRob2Qgc2V0c1xuICAgICAqIGFsbCB0aGUge0BsaW5rIE1lc2hJbnN0YW5jZSN2aXNpYmxlfSBwcm9wZXJ0eSBvbiBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gdHJ1ZS5cbiAgICAgKi9cbiAgICBzaG93KCkge1xuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RhbmNlcyA9IHRoaXMuX21vZGVsLm1lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGluc3RhbmNlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZXNbaV0udmlzaWJsZSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCB0byBiaW5kIGV2ZW50cyB0by5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vbignbG9hZCcsIHRoaXMuX29uTWF0ZXJpYWxBc3NldExvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigndW5sb2FkJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0VW5sb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRDaGFuZ2UsIHRoaXMpO1xuXG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbEFzc2V0TG9hZChhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb24ndCB0cmlnZ2VyIGFuIGFzc2V0IGxvYWQgdW5sZXNzIHRoZSBjb21wb25lbnQgaXMgZW5hYmxlZFxuICAgICAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQpIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCB0byB1bmJpbmQgZXZlbnRzIGZyb20uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdW5iaW5kTWF0ZXJpYWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCd1bmxvYWQnLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ3JlbW92ZScsIHRoaXMuX29uTWF0ZXJpYWxBc3NldFJlbW92ZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZignY2hhbmdlJywgdGhpcy5fb25NYXRlcmlhbEFzc2V0Q2hhbmdlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBhZGQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYXRlcmlhbEFzc2V0QWRkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMub2ZmKCdhZGQ6JyArIGFzc2V0LmlkLCB0aGlzLl9vbk1hdGVyaWFsQXNzZXRBZGQsIHRoaXMpO1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxBc3NldCA9PT0gYXNzZXQuaWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2JpbmRNYXRlcmlhbEFzc2V0KGFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IGxvYWQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYXRlcmlhbEFzc2V0TG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbChhc3NldC5yZXNvdXJjZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbWF0ZXJpYWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgdW5sb2FkIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTWF0ZXJpYWxBc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLl9zZXRNYXRlcmlhbCh0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1hdGVyaWFsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IHJlbW92ZSBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1hdGVyaWFsQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fb25NYXRlcmlhbEFzc2V0VW5sb2FkKGFzc2V0KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtYXRlcmlhbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBjaGFuZ2UgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25NYXRlcmlhbEFzc2V0Q2hhbmdlKGFzc2V0KSB7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgdG8gYmluZCBldmVudHMgdG8uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYmluZE1vZGVsQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5fdW5iaW5kTW9kZWxBc3NldChhc3NldCk7XG5cbiAgICAgICAgYXNzZXQub24oJ2xvYWQnLCB0aGlzLl9vbk1vZGVsQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub24oJ3VubG9hZCcsIHRoaXMuX29uTW9kZWxBc3NldFVubG9hZCwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9uKCdjaGFuZ2UnLCB0aGlzLl9vbk1vZGVsQXNzZXRDaGFuZ2UsIHRoaXMpO1xuICAgICAgICBhc3NldC5vbigncmVtb3ZlJywgdGhpcy5fb25Nb2RlbEFzc2V0UmVtb3ZlLCB0aGlzKTtcblxuICAgICAgICBpZiAoYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uTW9kZWxBc3NldExvYWQoYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gZG9uJ3QgdHJpZ2dlciBhbiBhc3NldCBsb2FkIHVubGVzcyB0aGUgY29tcG9uZW50IGlzIGVuYWJsZWRcbiAgICAgICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkKSByZXR1cm47XG5cbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZChhc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCB0byB1bmJpbmQgZXZlbnRzIGZyb20uXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdW5iaW5kTW9kZWxBc3NldChhc3NldCkge1xuICAgICAgICBhc3NldC5vZmYoJ2xvYWQnLCB0aGlzLl9vbk1vZGVsQXNzZXRMb2FkLCB0aGlzKTtcbiAgICAgICAgYXNzZXQub2ZmKCd1bmxvYWQnLCB0aGlzLl9vbk1vZGVsQXNzZXRVbmxvYWQsIHRoaXMpO1xuICAgICAgICBhc3NldC5vZmYoJ2NoYW5nZScsIHRoaXMuX29uTW9kZWxBc3NldENoYW5nZSwgdGhpcyk7XG4gICAgICAgIGFzc2V0Lm9mZigncmVtb3ZlJywgdGhpcy5fb25Nb2RlbEFzc2V0UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBhZGQgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25Nb2RlbEFzc2V0QWRkZWQoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5vZmYoJ2FkZDonICsgYXNzZXQuaWQsIHRoaXMuX29uTW9kZWxBc3NldEFkZGVkLCB0aGlzKTtcbiAgICAgICAgaWYgKGFzc2V0LmlkID09PSB0aGlzLl9hc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fYmluZE1vZGVsQXNzZXQoYXNzZXQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgbG9hZCBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1vZGVsQXNzZXRMb2FkKGFzc2V0KSB7XG4gICAgICAgIHRoaXMubW9kZWwgPSBhc3NldC5yZXNvdXJjZS5jbG9uZSgpO1xuICAgICAgICB0aGlzLl9jbG9uZWRNb2RlbCA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtBc3NldH0gYXNzZXQgLSBUaGUgbW9kZWwgYXNzZXQgb24gd2hpY2ggYW4gYXNzZXQgdW5sb2FkIGV2ZW50IGhhcyBiZWVuIGZpcmVkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uTW9kZWxBc3NldFVubG9hZChhc3NldCkge1xuICAgICAgICB0aGlzLm1vZGVsID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fSBhc3NldCAtIFRoZSBtb2RlbCBhc3NldCBvbiB3aGljaCBhbiBhc3NldCBjaGFuZ2UgZXZlbnQgaGFzIGJlZW4gZmlyZWQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGF0dHIgLSBUaGUgYXR0cmlidXRlIHRoYXQgd2FzIGNoYW5nZWQuXG4gICAgICogQHBhcmFtIHsqfSBfbmV3IC0gVGhlIG5ldyB2YWx1ZSBvZiB0aGUgYXR0cmlidXRlLlxuICAgICAqIEBwYXJhbSB7Kn0gX29sZCAtIFRoZSBvbGQgdmFsdWUgb2YgdGhlIGF0dHJpYnV0ZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1vZGVsQXNzZXRDaGFuZ2UoYXNzZXQsIGF0dHIsIF9uZXcsIF9vbGQpIHtcbiAgICAgICAgaWYgKGF0dHIgPT09ICdkYXRhJykge1xuICAgICAgICAgICAgdGhpcy5tYXBwaW5nID0gdGhpcy5fbWFwcGluZztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7QXNzZXR9IGFzc2V0IC0gVGhlIG1vZGVsIGFzc2V0IG9uIHdoaWNoIGFuIGFzc2V0IHJlbW92ZSBldmVudCBoYXMgYmVlbiBmaXJlZC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbk1vZGVsQXNzZXRSZW1vdmUoYXNzZXQpIHtcbiAgICAgICAgdGhpcy5tb2RlbCA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfSBtYXRlcmlhbCAtIFRoZSBtYXRlcmlhbCB0b1xuICAgICAqIGJlIHNldC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9zZXRNYXRlcmlhbChtYXRlcmlhbCkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgPT09IG1hdGVyaWFsKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gbWF0ZXJpYWw7XG5cbiAgICAgICAgY29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbDtcbiAgICAgICAgaWYgKG1vZGVsICYmIHRoaXMuX3R5cGUgIT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBtb2RlbC5tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IG1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCB7IE1vZGVsQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiTW9kZWxDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl90eXBlIiwiX2Fzc2V0IiwiX21vZGVsIiwiX21hcHBpbmciLCJfY2FzdFNoYWRvd3MiLCJfcmVjZWl2ZVNoYWRvd3MiLCJfbWF0ZXJpYWxBc3NldCIsIl9tYXRlcmlhbCIsIl9jYXN0U2hhZG93c0xpZ2h0bWFwIiwiX2xpZ2h0bWFwcGVkIiwiX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJfaXNTdGF0aWMiLCJfbGF5ZXJzIiwiTEFZRVJJRF9XT1JMRCIsIl9iYXRjaEdyb3VwSWQiLCJfY3VzdG9tQWFiYiIsIl9hcmVhIiwiX21hdGVyaWFsRXZlbnRzIiwiX2Nsb25lZE1vZGVsIiwiX2JhdGNoR3JvdXAiLCJkZWZhdWx0TWF0ZXJpYWwiLCJvbiIsIm9uUmVtb3ZlQ2hpbGQiLCJvbkluc2VydENoaWxkIiwibWVzaEluc3RhbmNlcyIsInZhbHVlIiwiY3VzdG9tQWFiYiIsIm1pIiwiaSIsImxlbmd0aCIsInNldEN1c3RvbUFhYmIiLCJ0eXBlIiwiX2JpbmRNb2RlbEFzc2V0IiwibW9kZWwiLCJwcmltRGF0YSIsImdldFNoYXBlUHJpbWl0aXZlIiwiYXBwIiwiZ3JhcGhpY3NEZXZpY2UiLCJhcmVhIiwibWVzaCIsIm5vZGUiLCJHcmFwaE5vZGUiLCJNb2RlbCIsImdyYXBoIiwiTWVzaEluc3RhbmNlIiwiYXNzZXQiLCJhc3NldHMiLCJfaWQiLCJBc3NldCIsImlkIiwib2ZmIiwiX29uTW9kZWxBc3NldEFkZGVkIiwiX3ByZXYiLCJnZXQiLCJfdW5iaW5kTW9kZWxBc3NldCIsIl9pbW11dGFibGUiLCJEZWJ1ZyIsImVycm9yIiwicmVtb3ZlTW9kZWxGcm9tTGF5ZXJzIiwicmVtb3ZlQ2hpbGQiLCJnZXRHcmFwaCIsIl9lbnRpdHkiLCJkZXN0cm95IiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJpc1N0YXRpYyIsImxpZ2h0bWFwcGVkIiwiYWRkQ2hpbGQiLCJlbmFibGVkIiwiYWRkTW9kZWxUb0xheWVycyIsImFuaW1hdGlvbiIsInNldE1vZGVsIiwiYW5pbSIsInJlYmluZCIsIm1hcHBpbmciLCJfdW5zZXRNYXRlcmlhbEV2ZW50cyIsInNldExpZ2h0bWFwcGVkIiwiY2FzdFNoYWRvd3MiLCJsYXllcnMiLCJzY2VuZSIsImxheWVyIiwiZ2V0TGF5ZXJCeUlkIiwicmVtb3ZlU2hhZG93Q2FzdGVycyIsImFkZFNoYWRvd0Nhc3RlcnMiLCJyZWNlaXZlU2hhZG93cyIsImxlbiIsImNhc3RTaGFkb3dzTGlnaHRtYXAiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwicmN2IiwibSIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJhZGRNZXNoSW5zdGFuY2VzIiwiYmF0Y2hHcm91cElkIiwiYmF0Y2hlciIsInJlbW92ZSIsIkJhdGNoR3JvdXAiLCJNT0RFTCIsImluc2VydCIsIm1hdGVyaWFsQXNzZXQiLCJfb25NYXRlcmlhbEFzc2V0QWRkIiwiX3VuYmluZE1hdGVyaWFsQXNzZXQiLCJfc2V0TWF0ZXJpYWwiLCJfYmluZE1hdGVyaWFsQXNzZXQiLCJtYXRlcmlhbCIsIm1vZGVsQXNzZXQiLCJhc3NldE1hcHBpbmciLCJkYXRhIiwidW5kZWZpbmVkIiwiX2xvYWRBbmRTZXRNZXNoSW5zdGFuY2VNYXRlcmlhbCIsInBhdGgiLCJ1cmwiLCJfZ2V0TWF0ZXJpYWxBc3NldFVybCIsImdldEJ5VXJsIiwib25SZW1vdmUiLCJvbkxheWVyc0NoYW5nZWQiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpbmRleE9mIiwiX3NldE1hdGVyaWFsRXZlbnQiLCJldmVudCIsImhhbmRsZXIiLCJldnQiLCJldmVudHMiLCJrZXkiLCJfZ2V0QXNzZXRCeUlkT3JQYXRoIiwiaWRPclBhdGgiLCJpc1BhdGgiLCJpc05hTiIsInBhcnNlSW50IiwiZ2V0QWJzb2x1dGVVcmwiLCJtZXNoSW5zdGFuY2UiLCJyZXNvdXJjZSIsImxvYWQiLCJvbkVuYWJsZSIsImlzQXNzZXQiLCJvbkRpc2FibGUiLCJoaWRlIiwiaW5zdGFuY2VzIiwibCIsInZpc2libGUiLCJzaG93IiwiX29uTWF0ZXJpYWxBc3NldExvYWQiLCJfb25NYXRlcmlhbEFzc2V0VW5sb2FkIiwiX29uTWF0ZXJpYWxBc3NldFJlbW92ZSIsIl9vbk1hdGVyaWFsQXNzZXRDaGFuZ2UiLCJfb25Nb2RlbEFzc2V0TG9hZCIsIl9vbk1vZGVsQXNzZXRVbmxvYWQiLCJfb25Nb2RlbEFzc2V0Q2hhbmdlIiwiX29uTW9kZWxBc3NldFJlbW92ZSIsImNsb25lIiwiYXR0ciIsIl9uZXciLCJfb2xkIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFvQkEsTUFBTUEsY0FBYyxTQUFTQyxTQUFTLENBQUM7O0FBaUhuQ0MsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJQUFDLElBN0cxQkMsQ0FBQUEsS0FBSyxHQUFHLE9BQU8sQ0FBQTtJQUFBLElBTWZDLENBQUFBLE1BQU0sR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1iQyxDQUFBQSxNQUFNLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFNYkMsQ0FBQUEsUUFBUSxHQUFHLEVBQUUsQ0FBQTtJQUFBLElBTWJDLENBQUFBLFlBQVksR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1uQkMsQ0FBQUEsZUFBZSxHQUFHLElBQUksQ0FBQTtJQUFBLElBTXRCQyxDQUFBQSxjQUFjLEdBQUcsSUFBSSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBTXJCQyxTQUFTLEdBQUEsS0FBQSxDQUFBLENBQUE7SUFBQSxJQU1UQyxDQUFBQSxvQkFBb0IsR0FBRyxJQUFJLENBQUE7SUFBQSxJQU0zQkMsQ0FBQUEsWUFBWSxHQUFHLEtBQUssQ0FBQTtJQUFBLElBTXBCQyxDQUFBQSx1QkFBdUIsR0FBRyxDQUFDLENBQUE7SUFBQSxJQU0zQkMsQ0FBQUEsU0FBUyxHQUFHLEtBQUssQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU1qQkMsT0FBTyxHQUFHLENBQUNDLGFBQWEsQ0FBQyxDQUFBO0lBQUEsSUFNekJDLENBQUFBLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQTtJQUFBLElBTWxCQyxDQUFBQSxXQUFXLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFFbEJDLENBQUFBLEtBQUssR0FBRyxJQUFJLENBQUE7SUFBQSxJQUVaQyxDQUFBQSxlQUFlLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFNdEJDLENBQUFBLFlBQVksR0FBRyxLQUFLLENBQUE7SUFBQSxJQUdwQkMsQ0FBQUEsV0FBVyxHQUFHLElBQUksQ0FBQTtBQWNkLElBQUEsSUFBSSxDQUFDWixTQUFTLEdBQUdULE1BQU0sQ0FBQ3NCLGVBQWUsQ0FBQTs7SUFHdkNyQixNQUFNLENBQUNzQixFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ0MsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFBO0lBQzdDdkIsTUFBTSxDQUFDc0IsRUFBRSxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQ0MsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFBO0lBQ3REdkIsTUFBTSxDQUFDc0IsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNFLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUM3Q3hCLE1BQU0sQ0FBQ3NCLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUNFLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMxRCxHQUFBOztFQVFBLElBQUlDLGFBQWEsQ0FBQ0MsS0FBSyxFQUFFO0FBQ3JCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3ZCLE1BQU0sRUFDWixPQUFBO0FBRUosSUFBQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ3NCLGFBQWEsR0FBR0MsS0FBSyxDQUFBO0FBQ3JDLEdBQUE7QUFFQSxFQUFBLElBQUlELGFBQWEsR0FBRztBQUNoQixJQUFBLElBQUksQ0FBQyxJQUFJLENBQUN0QixNQUFNLEVBQ1osT0FBTyxJQUFJLENBQUE7QUFFZixJQUFBLE9BQU8sSUFBSSxDQUFDQSxNQUFNLENBQUNzQixhQUFhLENBQUE7QUFDcEMsR0FBQTs7RUFVQSxJQUFJRSxVQUFVLENBQUNELEtBQUssRUFBRTtJQUNsQixJQUFJLENBQUNWLFdBQVcsR0FBR1UsS0FBSyxDQUFBOztJQUd4QixJQUFJLElBQUksQ0FBQ3ZCLE1BQU0sRUFBRTtBQUNiLE1BQUEsTUFBTXlCLEVBQUUsR0FBRyxJQUFJLENBQUN6QixNQUFNLENBQUNzQixhQUFhLENBQUE7QUFDcEMsTUFBQSxJQUFJRyxFQUFFLEVBQUU7QUFDSixRQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxFQUFFLENBQUNFLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7VUFDaENELEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNFLGFBQWEsQ0FBQyxJQUFJLENBQUNmLFdBQVcsQ0FBQyxDQUFBO0FBQ3pDLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUlXLFVBQVUsR0FBRztJQUNiLE9BQU8sSUFBSSxDQUFDWCxXQUFXLENBQUE7QUFDM0IsR0FBQTs7RUFnQkEsSUFBSWdCLElBQUksQ0FBQ04sS0FBSyxFQUFFO0FBQ1osSUFBQSxJQUFJLElBQUksQ0FBQ3pCLEtBQUssS0FBS3lCLEtBQUssRUFBRSxPQUFBO0lBRTFCLElBQUksQ0FBQ1QsS0FBSyxHQUFHLElBQUksQ0FBQTtJQUVqQixJQUFJLENBQUNoQixLQUFLLEdBQUd5QixLQUFLLENBQUE7SUFFbEIsSUFBSUEsS0FBSyxLQUFLLE9BQU8sRUFBRTtBQUNuQixNQUFBLElBQUksSUFBSSxDQUFDeEIsTUFBTSxLQUFLLElBQUksRUFBRTtBQUN0QixRQUFBLElBQUksQ0FBQytCLGVBQWUsQ0FBQyxJQUFJLENBQUMvQixNQUFNLENBQUMsQ0FBQTtBQUNyQyxPQUFDLE1BQU07UUFDSCxJQUFJLENBQUNnQyxLQUFLLEdBQUcsSUFBSSxDQUFBO0FBQ3JCLE9BQUE7QUFDSixLQUFDLE1BQU07QUFHSCxNQUFBLE1BQU1DLFFBQVEsR0FBR0MsaUJBQWlCLENBQUMsSUFBSSxDQUFDckMsTUFBTSxDQUFDc0MsR0FBRyxDQUFDQyxjQUFjLEVBQUVaLEtBQUssQ0FBQyxDQUFBO0FBQ3pFLE1BQUEsSUFBSSxDQUFDVCxLQUFLLEdBQUdrQixRQUFRLENBQUNJLElBQUksQ0FBQTtBQUMxQixNQUFBLE1BQU1DLElBQUksR0FBR0wsUUFBUSxDQUFDSyxJQUFJLENBQUE7QUFFMUIsTUFBQSxNQUFNQyxJQUFJLEdBQUcsSUFBSUMsU0FBUyxFQUFFLENBQUE7QUFDNUIsTUFBQSxNQUFNUixLQUFLLEdBQUcsSUFBSVMsS0FBSyxFQUFFLENBQUE7TUFDekJULEtBQUssQ0FBQ1UsS0FBSyxHQUFHSCxJQUFJLENBQUE7QUFFbEJQLE1BQUFBLEtBQUssQ0FBQ1QsYUFBYSxHQUFHLENBQUMsSUFBSW9CLFlBQVksQ0FBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQ2hDLFNBQVMsRUFBRWlDLElBQUksQ0FBQyxDQUFDLENBQUE7TUFFcEUsSUFBSSxDQUFDUCxLQUFLLEdBQUdBLEtBQUssQ0FBQTtNQUNsQixJQUFJLENBQUNoQyxNQUFNLEdBQUcsSUFBSSxDQUFBO0FBQ3RCLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJOEIsSUFBSSxHQUFHO0lBQ1AsT0FBTyxJQUFJLENBQUMvQixLQUFLLENBQUE7QUFDckIsR0FBQTs7RUFPQSxJQUFJNkMsS0FBSyxDQUFDcEIsS0FBSyxFQUFFO0lBQ2IsTUFBTXFCLE1BQU0sR0FBRyxJQUFJLENBQUNoRCxNQUFNLENBQUNzQyxHQUFHLENBQUNVLE1BQU0sQ0FBQTtJQUNyQyxJQUFJQyxHQUFHLEdBQUd0QixLQUFLLENBQUE7SUFFZixJQUFJQSxLQUFLLFlBQVl1QixLQUFLLEVBQUU7TUFDeEJELEdBQUcsR0FBR3RCLEtBQUssQ0FBQ3dCLEVBQUUsQ0FBQTtBQUNsQixLQUFBO0FBRUEsSUFBQSxJQUFJLElBQUksQ0FBQ2hELE1BQU0sS0FBSzhDLEdBQUcsRUFBRTtNQUNyQixJQUFJLElBQUksQ0FBQzlDLE1BQU0sRUFBRTtBQUViNkMsUUFBQUEsTUFBTSxDQUFDSSxHQUFHLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQ2pELE1BQU0sRUFBRSxJQUFJLENBQUNrRCxrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtRQUMvRCxNQUFNQyxLQUFLLEdBQUdOLE1BQU0sQ0FBQ08sR0FBRyxDQUFDLElBQUksQ0FBQ3BELE1BQU0sQ0FBQyxDQUFBO0FBQ3JDLFFBQUEsSUFBSW1ELEtBQUssRUFBRTtBQUNQLFVBQUEsSUFBSSxDQUFDRSxpQkFBaUIsQ0FBQ0YsS0FBSyxDQUFDLENBQUE7QUFDakMsU0FBQTtBQUNKLE9BQUE7TUFFQSxJQUFJLENBQUNuRCxNQUFNLEdBQUc4QyxHQUFHLENBQUE7TUFFakIsSUFBSSxJQUFJLENBQUM5QyxNQUFNLEVBQUU7UUFDYixNQUFNNEMsS0FBSyxHQUFHQyxNQUFNLENBQUNPLEdBQUcsQ0FBQyxJQUFJLENBQUNwRCxNQUFNLENBQUMsQ0FBQTtRQUNyQyxJQUFJLENBQUM0QyxLQUFLLEVBQUU7VUFDUixJQUFJLENBQUNaLEtBQUssR0FBRyxJQUFJLENBQUE7QUFDakJhLFVBQUFBLE1BQU0sQ0FBQ3pCLEVBQUUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDcEIsTUFBTSxFQUFFLElBQUksQ0FBQ2tELGtCQUFrQixFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ2xFLFNBQUMsTUFBTTtBQUNILFVBQUEsSUFBSSxDQUFDbkIsZUFBZSxDQUFDYSxLQUFLLENBQUMsQ0FBQTtBQUMvQixTQUFBO0FBQ0osT0FBQyxNQUFNO1FBQ0gsSUFBSSxDQUFDWixLQUFLLEdBQUcsSUFBSSxDQUFBO0FBQ3JCLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsSUFBSVksS0FBSyxHQUFHO0lBQ1IsT0FBTyxJQUFJLENBQUM1QyxNQUFNLENBQUE7QUFDdEIsR0FBQTs7RUFPQSxJQUFJZ0MsS0FBSyxDQUFDUixLQUFLLEVBQUU7QUFDYixJQUFBLElBQUksSUFBSSxDQUFDdkIsTUFBTSxLQUFLdUIsS0FBSyxFQUNyQixPQUFBOztBQUdKLElBQUEsSUFBSUEsS0FBSyxJQUFJQSxLQUFLLENBQUM4QixVQUFVLEVBQUU7QUFDM0JDLE1BQUFBLEtBQUssQ0FBQ0MsS0FBSyxDQUFDLCtEQUErRCxDQUFDLENBQUE7QUFDNUUsTUFBQSxPQUFBO0FBQ0osS0FBQTtJQUVBLElBQUksSUFBSSxDQUFDdkQsTUFBTSxFQUFFO0FBQ2IsTUFBQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ3FELFVBQVUsR0FBRyxLQUFLLENBQUE7TUFFOUIsSUFBSSxDQUFDRyxxQkFBcUIsRUFBRSxDQUFBO01BQzVCLElBQUksQ0FBQzNELE1BQU0sQ0FBQzRELFdBQVcsQ0FBQyxJQUFJLENBQUN6RCxNQUFNLENBQUMwRCxRQUFRLEVBQUUsQ0FBQyxDQUFBO0FBQy9DLE1BQUEsT0FBTyxJQUFJLENBQUMxRCxNQUFNLENBQUMyRCxPQUFPLENBQUE7TUFFMUIsSUFBSSxJQUFJLENBQUMzQyxZQUFZLEVBQUU7QUFDbkIsUUFBQSxJQUFJLENBQUNoQixNQUFNLENBQUM0RCxPQUFPLEVBQUUsQ0FBQTtRQUNyQixJQUFJLENBQUM1QyxZQUFZLEdBQUcsS0FBSyxDQUFBO0FBQzdCLE9BQUE7QUFDSixLQUFBO0lBRUEsSUFBSSxDQUFDaEIsTUFBTSxHQUFHdUIsS0FBSyxDQUFBO0lBRW5CLElBQUksSUFBSSxDQUFDdkIsTUFBTSxFQUFFO0FBRWIsTUFBQSxJQUFJLENBQUNBLE1BQU0sQ0FBQ3FELFVBQVUsR0FBRyxJQUFJLENBQUE7QUFFN0IsTUFBQSxNQUFNL0IsYUFBYSxHQUFHLElBQUksQ0FBQ3RCLE1BQU0sQ0FBQ3NCLGFBQWEsQ0FBQTtBQUUvQyxNQUFBLEtBQUssSUFBSUksQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSixhQUFhLENBQUNLLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7UUFDM0NKLGFBQWEsQ0FBQ0ksQ0FBQyxDQUFDLENBQUNtQyxVQUFVLEdBQUcsSUFBSSxDQUFDM0QsWUFBWSxDQUFBO1FBQy9Db0IsYUFBYSxDQUFDSSxDQUFDLENBQUMsQ0FBQ29DLGFBQWEsR0FBRyxJQUFJLENBQUMzRCxlQUFlLENBQUE7UUFDckRtQixhQUFhLENBQUNJLENBQUMsQ0FBQyxDQUFDcUMsUUFBUSxHQUFHLElBQUksQ0FBQ3RELFNBQVMsQ0FBQTtRQUMxQ2EsYUFBYSxDQUFDSSxDQUFDLENBQUMsQ0FBQ0UsYUFBYSxDQUFDLElBQUksQ0FBQ2YsV0FBVyxDQUFDLENBQUE7QUFDcEQsT0FBQTtBQUVBLE1BQUEsSUFBSSxDQUFDbUQsV0FBVyxHQUFHLElBQUksQ0FBQ3pELFlBQVksQ0FBQTs7TUFFcEMsSUFBSSxDQUFDVixNQUFNLENBQUNvRSxRQUFRLENBQUMsSUFBSSxDQUFDakUsTUFBTSxDQUFDeUMsS0FBSyxDQUFDLENBQUE7TUFFdkMsSUFBSSxJQUFJLENBQUN5QixPQUFPLElBQUksSUFBSSxDQUFDckUsTUFBTSxDQUFDcUUsT0FBTyxFQUFFO1FBQ3JDLElBQUksQ0FBQ0MsZ0JBQWdCLEVBQUUsQ0FBQTtBQUMzQixPQUFBOztBQUdBLE1BQUEsSUFBSSxDQUFDbkUsTUFBTSxDQUFDMkQsT0FBTyxHQUFHLElBQUksQ0FBQzlELE1BQU0sQ0FBQTs7QUFHakMsTUFBQSxJQUFJLElBQUksQ0FBQ0EsTUFBTSxDQUFDdUUsU0FBUyxFQUNyQixJQUFJLENBQUN2RSxNQUFNLENBQUN1RSxTQUFTLENBQUNDLFFBQVEsQ0FBQyxJQUFJLENBQUNyRSxNQUFNLENBQUMsQ0FBQTs7QUFHL0MsTUFBQSxJQUFJLElBQUksQ0FBQ0gsTUFBTSxDQUFDeUUsSUFBSSxFQUFFO0FBQ2xCLFFBQUEsSUFBSSxDQUFDekUsTUFBTSxDQUFDeUUsSUFBSSxDQUFDQyxNQUFNLEVBQUUsQ0FBQTtBQUM3QixPQUFBO0FBR0EsTUFBQSxJQUFJLElBQUksQ0FBQzFDLElBQUksS0FBSyxPQUFPLEVBQUU7QUFDdkIsUUFBQSxJQUFJLENBQUMyQyxPQUFPLEdBQUcsSUFBSSxDQUFDdkUsUUFBUSxDQUFBO0FBQ2hDLE9BQUMsTUFBTTtRQUNILElBQUksQ0FBQ3dFLG9CQUFvQixFQUFFLENBQUE7QUFDL0IsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJMUMsS0FBSyxHQUFHO0lBQ1IsT0FBTyxJQUFJLENBQUMvQixNQUFNLENBQUE7QUFDdEIsR0FBQTs7RUFPQSxJQUFJZ0UsV0FBVyxDQUFDekMsS0FBSyxFQUFFO0FBQ25CLElBQUEsSUFBSUEsS0FBSyxLQUFLLElBQUksQ0FBQ2hCLFlBQVksRUFBRTtNQUU3QixJQUFJLENBQUNBLFlBQVksR0FBR2dCLEtBQUssQ0FBQTtNQUV6QixJQUFJLElBQUksQ0FBQ3ZCLE1BQU0sRUFBRTtBQUNiLFFBQUEsTUFBTXlCLEVBQUUsR0FBRyxJQUFJLENBQUN6QixNQUFNLENBQUNzQixhQUFhLENBQUE7QUFDcEMsUUFBQSxLQUFLLElBQUlJLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0QsRUFBRSxDQUFDRSxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ2hDRCxVQUFBQSxFQUFFLENBQUNDLENBQUMsQ0FBQyxDQUFDZ0QsY0FBYyxDQUFDbkQsS0FBSyxDQUFDLENBQUE7QUFDL0IsU0FBQTtBQUNKLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsSUFBSXlDLFdBQVcsR0FBRztJQUNkLE9BQU8sSUFBSSxDQUFDekQsWUFBWSxDQUFBO0FBQzVCLEdBQUE7O0VBT0EsSUFBSW9FLFdBQVcsQ0FBQ3BELEtBQUssRUFBRTtBQUNuQixJQUFBLElBQUksSUFBSSxDQUFDckIsWUFBWSxLQUFLcUIsS0FBSyxFQUFFLE9BQUE7QUFFakMsSUFBQSxNQUFNUSxLQUFLLEdBQUcsSUFBSSxDQUFDL0IsTUFBTSxDQUFBO0FBRXpCLElBQUEsSUFBSStCLEtBQUssRUFBRTtBQUNQLE1BQUEsTUFBTTZDLE1BQU0sR0FBRyxJQUFJLENBQUNBLE1BQU0sQ0FBQTtNQUMxQixNQUFNQyxLQUFLLEdBQUcsSUFBSSxDQUFDakYsTUFBTSxDQUFDc0MsR0FBRyxDQUFDMkMsS0FBSyxDQUFBO0FBQ25DLE1BQUEsSUFBSSxJQUFJLENBQUMzRSxZQUFZLElBQUksQ0FBQ3FCLEtBQUssRUFBRTtBQUM3QixRQUFBLEtBQUssSUFBSUcsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHa0QsTUFBTSxDQUFDakQsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtVQUNwQyxNQUFNb0QsS0FBSyxHQUFHLElBQUksQ0FBQ2xGLE1BQU0sQ0FBQ3NDLEdBQUcsQ0FBQzJDLEtBQUssQ0FBQ0QsTUFBTSxDQUFDRyxZQUFZLENBQUMsSUFBSSxDQUFDSCxNQUFNLENBQUNsRCxDQUFDLENBQUMsQ0FBQyxDQUFBO1VBQ3ZFLElBQUksQ0FBQ29ELEtBQUssRUFBRSxTQUFBO0FBQ1pBLFVBQUFBLEtBQUssQ0FBQ0UsbUJBQW1CLENBQUNqRCxLQUFLLENBQUNULGFBQWEsQ0FBQyxDQUFBO0FBQ2xELFNBQUE7QUFDSixPQUFBO0FBRUEsTUFBQSxNQUFNQSxhQUFhLEdBQUdTLEtBQUssQ0FBQ1QsYUFBYSxDQUFBO0FBQ3pDLE1BQUEsS0FBSyxJQUFJSSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdKLGFBQWEsQ0FBQ0ssTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUMzQ0osUUFBQUEsYUFBYSxDQUFDSSxDQUFDLENBQUMsQ0FBQ21DLFVBQVUsR0FBR3RDLEtBQUssQ0FBQTtBQUN2QyxPQUFBO0FBRUEsTUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDckIsWUFBWSxJQUFJcUIsS0FBSyxFQUFFO0FBQzdCLFFBQUEsS0FBSyxJQUFJRyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdrRCxNQUFNLENBQUNqRCxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ3BDLFVBQUEsTUFBTW9ELEtBQUssR0FBR0QsS0FBSyxDQUFDRCxNQUFNLENBQUNHLFlBQVksQ0FBQ0gsTUFBTSxDQUFDbEQsQ0FBQyxDQUFDLENBQUMsQ0FBQTtVQUNsRCxJQUFJLENBQUNvRCxLQUFLLEVBQUUsU0FBQTtBQUNaQSxVQUFBQSxLQUFLLENBQUNHLGdCQUFnQixDQUFDbEQsS0FBSyxDQUFDVCxhQUFhLENBQUMsQ0FBQTtBQUMvQyxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLENBQUNwQixZQUFZLEdBQUdxQixLQUFLLENBQUE7QUFDN0IsR0FBQTtBQUVBLEVBQUEsSUFBSW9ELFdBQVcsR0FBRztJQUNkLE9BQU8sSUFBSSxDQUFDekUsWUFBWSxDQUFBO0FBQzVCLEdBQUE7O0VBT0EsSUFBSWdGLGNBQWMsQ0FBQzNELEtBQUssRUFBRTtBQUN0QixJQUFBLElBQUksSUFBSSxDQUFDcEIsZUFBZSxLQUFLb0IsS0FBSyxFQUFFLE9BQUE7SUFFcEMsSUFBSSxDQUFDcEIsZUFBZSxHQUFHb0IsS0FBSyxDQUFBO0lBRTVCLElBQUksSUFBSSxDQUFDdkIsTUFBTSxFQUFFO0FBQ2IsTUFBQSxNQUFNc0IsYUFBYSxHQUFHLElBQUksQ0FBQ3RCLE1BQU0sQ0FBQ3NCLGFBQWEsQ0FBQTtBQUMvQyxNQUFBLEtBQUssSUFBSUksQ0FBQyxHQUFHLENBQUMsRUFBRXlELEdBQUcsR0FBRzdELGFBQWEsQ0FBQ0ssTUFBTSxFQUFFRCxDQUFDLEdBQUd5RCxHQUFHLEVBQUV6RCxDQUFDLEVBQUUsRUFBRTtBQUN0REosUUFBQUEsYUFBYSxDQUFDSSxDQUFDLENBQUMsQ0FBQ29DLGFBQWEsR0FBR3ZDLEtBQUssQ0FBQTtBQUMxQyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUkyRCxjQUFjLEdBQUc7SUFDakIsT0FBTyxJQUFJLENBQUMvRSxlQUFlLENBQUE7QUFDL0IsR0FBQTs7RUFPQSxJQUFJaUYsbUJBQW1CLENBQUM3RCxLQUFLLEVBQUU7SUFDM0IsSUFBSSxDQUFDakIsb0JBQW9CLEdBQUdpQixLQUFLLENBQUE7QUFDckMsR0FBQTtBQUVBLEVBQUEsSUFBSTZELG1CQUFtQixHQUFHO0lBQ3RCLE9BQU8sSUFBSSxDQUFDOUUsb0JBQW9CLENBQUE7QUFDcEMsR0FBQTs7RUFPQSxJQUFJK0Usc0JBQXNCLENBQUM5RCxLQUFLLEVBQUU7SUFDOUIsSUFBSSxDQUFDZix1QkFBdUIsR0FBR2UsS0FBSyxDQUFBO0FBQ3hDLEdBQUE7QUFFQSxFQUFBLElBQUk4RCxzQkFBc0IsR0FBRztJQUN6QixPQUFPLElBQUksQ0FBQzdFLHVCQUF1QixDQUFBO0FBQ3ZDLEdBQUE7O0VBT0EsSUFBSXVELFFBQVEsQ0FBQ3hDLEtBQUssRUFBRTtBQUNoQixJQUFBLElBQUksSUFBSSxDQUFDZCxTQUFTLEtBQUtjLEtBQUssRUFBRSxPQUFBO0lBRTlCLElBQUksQ0FBQ2QsU0FBUyxHQUFHYyxLQUFLLENBQUE7SUFFdEIsSUFBSSxJQUFJLENBQUN2QixNQUFNLEVBQUU7QUFDYixNQUFBLE1BQU1zRixHQUFHLEdBQUcsSUFBSSxDQUFDdEYsTUFBTSxDQUFDc0IsYUFBYSxDQUFBO0FBQ3JDLE1BQUEsS0FBSyxJQUFJSSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUc0RCxHQUFHLENBQUMzRCxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ2pDLFFBQUEsTUFBTTZELENBQUMsR0FBR0QsR0FBRyxDQUFDNUQsQ0FBQyxDQUFDLENBQUE7UUFDaEI2RCxDQUFDLENBQUN4QixRQUFRLEdBQUd4QyxLQUFLLENBQUE7QUFDdEIsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJd0MsUUFBUSxHQUFHO0lBQ1gsT0FBTyxJQUFJLENBQUN0RCxTQUFTLENBQUE7QUFDekIsR0FBQTs7RUFRQSxJQUFJbUUsTUFBTSxDQUFDckQsS0FBSyxFQUFFO0lBQ2QsTUFBTXFELE1BQU0sR0FBRyxJQUFJLENBQUNoRixNQUFNLENBQUNzQyxHQUFHLENBQUMyQyxLQUFLLENBQUNELE1BQU0sQ0FBQTtJQUUzQyxJQUFJLElBQUksQ0FBQ3RELGFBQWEsRUFBRTtBQUVwQixNQUFBLEtBQUssSUFBSUksQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ2hCLE9BQU8sQ0FBQ2lCLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDMUMsUUFBQSxNQUFNb0QsS0FBSyxHQUFHRixNQUFNLENBQUNHLFlBQVksQ0FBQyxJQUFJLENBQUNyRSxPQUFPLENBQUNnQixDQUFDLENBQUMsQ0FBQyxDQUFBO1FBQ2xELElBQUksQ0FBQ29ELEtBQUssRUFBRSxTQUFBO0FBQ1pBLFFBQUFBLEtBQUssQ0FBQ1UsbUJBQW1CLENBQUMsSUFBSSxDQUFDbEUsYUFBYSxDQUFDLENBQUE7QUFDakQsT0FBQTtBQUNKLEtBQUE7O0FBR0EsSUFBQSxJQUFJLENBQUNaLE9BQU8sQ0FBQ2lCLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDdkIsSUFBQSxLQUFLLElBQUlELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0gsS0FBSyxDQUFDSSxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO01BQ25DLElBQUksQ0FBQ2hCLE9BQU8sQ0FBQ2dCLENBQUMsQ0FBQyxHQUFHSCxLQUFLLENBQUNHLENBQUMsQ0FBQyxDQUFBO0FBQzlCLEtBQUE7O0FBR0EsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDd0MsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDckUsTUFBTSxDQUFDcUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDNUMsYUFBYSxFQUFFLE9BQUE7O0FBR2xFLElBQUEsS0FBSyxJQUFJSSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDaEIsT0FBTyxDQUFDaUIsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUMxQyxNQUFBLE1BQU1vRCxLQUFLLEdBQUdGLE1BQU0sQ0FBQ0csWUFBWSxDQUFDLElBQUksQ0FBQ3JFLE9BQU8sQ0FBQ2dCLENBQUMsQ0FBQyxDQUFDLENBQUE7TUFDbEQsSUFBSSxDQUFDb0QsS0FBSyxFQUFFLFNBQUE7QUFDWkEsTUFBQUEsS0FBSyxDQUFDVyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUNuRSxhQUFhLENBQUMsQ0FBQTtBQUM5QyxLQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsSUFBSXNELE1BQU0sR0FBRztJQUNULE9BQU8sSUFBSSxDQUFDbEUsT0FBTyxDQUFBO0FBQ3ZCLEdBQUE7O0VBT0EsSUFBSWdGLFlBQVksQ0FBQ25FLEtBQUssRUFBRTtBQUNwQixJQUFBLElBQUksSUFBSSxDQUFDWCxhQUFhLEtBQUtXLEtBQUssRUFBRSxPQUFBO0lBRWxDLElBQUksSUFBSSxDQUFDMUIsTUFBTSxDQUFDcUUsT0FBTyxJQUFJLElBQUksQ0FBQ3RELGFBQWEsSUFBSSxDQUFDLEVBQUU7QUFBQSxNQUFBLElBQUEscUJBQUEsQ0FBQTtNQUNoRCxDQUFJLHFCQUFBLEdBQUEsSUFBQSxDQUFDaEIsTUFBTSxDQUFDc0MsR0FBRyxDQUFDeUQsT0FBTyxLQUFBLElBQUEsR0FBQSxLQUFBLENBQUEsR0FBdkIsc0JBQXlCQyxNQUFNLENBQUNDLFVBQVUsQ0FBQ0MsS0FBSyxFQUFFLElBQUksQ0FBQ0osWUFBWSxFQUFFLElBQUksQ0FBQzdGLE1BQU0sQ0FBQyxDQUFBO0FBQ3JGLEtBQUE7SUFDQSxJQUFJLElBQUksQ0FBQ0EsTUFBTSxDQUFDcUUsT0FBTyxJQUFJM0MsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUFBLE1BQUEsSUFBQSxzQkFBQSxDQUFBO0FBQ25DLE1BQUEsQ0FBQSxzQkFBQSxHQUFBLElBQUksQ0FBQzNCLE1BQU0sQ0FBQ3NDLEdBQUcsQ0FBQ3lELE9BQU8scUJBQXZCLHNCQUF5QkksQ0FBQUEsTUFBTSxDQUFDRixVQUFVLENBQUNDLEtBQUssRUFBRXZFLEtBQUssRUFBRSxJQUFJLENBQUMxQixNQUFNLENBQUMsQ0FBQTtBQUN6RSxLQUFBO0FBRUEsSUFBQSxJQUFJMEIsS0FBSyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUNYLGFBQWEsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDc0QsT0FBTyxJQUFJLElBQUksQ0FBQ3JFLE1BQU0sQ0FBQ3FFLE9BQU8sRUFBRTtNQUU3RSxJQUFJLENBQUNDLGdCQUFnQixFQUFFLENBQUE7QUFDM0IsS0FBQTtJQUVBLElBQUksQ0FBQ3ZELGFBQWEsR0FBR1csS0FBSyxDQUFBO0FBQzlCLEdBQUE7QUFFQSxFQUFBLElBQUltRSxZQUFZLEdBQUc7SUFDZixPQUFPLElBQUksQ0FBQzlFLGFBQWEsQ0FBQTtBQUM3QixHQUFBOztFQVFBLElBQUlvRixhQUFhLENBQUN6RSxLQUFLLEVBQUU7SUFDckIsSUFBSXNCLEdBQUcsR0FBR3RCLEtBQUssQ0FBQTtJQUNmLElBQUlBLEtBQUssWUFBWXVCLEtBQUssRUFBRTtNQUN4QkQsR0FBRyxHQUFHdEIsS0FBSyxDQUFDd0IsRUFBRSxDQUFBO0FBQ2xCLEtBQUE7SUFFQSxNQUFNSCxNQUFNLEdBQUcsSUFBSSxDQUFDaEQsTUFBTSxDQUFDc0MsR0FBRyxDQUFDVSxNQUFNLENBQUE7QUFFckMsSUFBQSxJQUFJQyxHQUFHLEtBQUssSUFBSSxDQUFDekMsY0FBYyxFQUFFO01BQzdCLElBQUksSUFBSSxDQUFDQSxjQUFjLEVBQUU7QUFDckJ3QyxRQUFBQSxNQUFNLENBQUNJLEdBQUcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDNUMsY0FBYyxFQUFFLElBQUksQ0FBQzZGLG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFBO1FBQ3hFLE1BQU0vQyxLQUFLLEdBQUdOLE1BQU0sQ0FBQ08sR0FBRyxDQUFDLElBQUksQ0FBQy9DLGNBQWMsQ0FBQyxDQUFBO0FBQzdDLFFBQUEsSUFBSThDLEtBQUssRUFBRTtBQUNQLFVBQUEsSUFBSSxDQUFDZ0Qsb0JBQW9CLENBQUNoRCxLQUFLLENBQUMsQ0FBQTtBQUNwQyxTQUFBO0FBQ0osT0FBQTtNQUVBLElBQUksQ0FBQzlDLGNBQWMsR0FBR3lDLEdBQUcsQ0FBQTtNQUV6QixJQUFJLElBQUksQ0FBQ3pDLGNBQWMsRUFBRTtRQUNyQixNQUFNdUMsS0FBSyxHQUFHQyxNQUFNLENBQUNPLEdBQUcsQ0FBQyxJQUFJLENBQUMvQyxjQUFjLENBQUMsQ0FBQTtRQUM3QyxJQUFJLENBQUN1QyxLQUFLLEVBQUU7VUFDUixJQUFJLENBQUN3RCxZQUFZLENBQUMsSUFBSSxDQUFDdkcsTUFBTSxDQUFDc0IsZUFBZSxDQUFDLENBQUE7QUFDOUMwQixVQUFBQSxNQUFNLENBQUN6QixFQUFFLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQ2YsY0FBYyxFQUFFLElBQUksQ0FBQzZGLG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFBO0FBQzNFLFNBQUMsTUFBTTtBQUNILFVBQUEsSUFBSSxDQUFDRyxrQkFBa0IsQ0FBQ3pELEtBQUssQ0FBQyxDQUFBO0FBQ2xDLFNBQUE7QUFDSixPQUFDLE1BQU07UUFDSCxJQUFJLENBQUN3RCxZQUFZLENBQUMsSUFBSSxDQUFDdkcsTUFBTSxDQUFDc0IsZUFBZSxDQUFDLENBQUE7QUFDbEQsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJOEUsYUFBYSxHQUFHO0lBQ2hCLE9BQU8sSUFBSSxDQUFDNUYsY0FBYyxDQUFBO0FBQzlCLEdBQUE7O0VBUUEsSUFBSWlHLFFBQVEsQ0FBQzlFLEtBQUssRUFBRTtBQUNoQixJQUFBLElBQUksSUFBSSxDQUFDbEIsU0FBUyxLQUFLa0IsS0FBSyxFQUN4QixPQUFBO0lBRUosSUFBSSxDQUFDeUUsYUFBYSxHQUFHLElBQUksQ0FBQTtBQUV6QixJQUFBLElBQUksQ0FBQ0csWUFBWSxDQUFDNUUsS0FBSyxDQUFDLENBQUE7QUFDNUIsR0FBQTtBQUVBLEVBQUEsSUFBSThFLFFBQVEsR0FBRztJQUNYLE9BQU8sSUFBSSxDQUFDaEcsU0FBUyxDQUFBO0FBQ3pCLEdBQUE7O0VBU0EsSUFBSW1FLE9BQU8sQ0FBQ2pELEtBQUssRUFBRTtBQUNmLElBQUEsSUFBSSxJQUFJLENBQUN6QixLQUFLLEtBQUssT0FBTyxFQUN0QixPQUFBOztJQUdKLElBQUksQ0FBQzJFLG9CQUFvQixFQUFFLENBQUE7O0FBRzNCLElBQUEsSUFBSSxDQUFDbEQsS0FBSyxFQUNOQSxLQUFLLEdBQUcsRUFBRSxDQUFBO0lBRWQsSUFBSSxDQUFDdEIsUUFBUSxHQUFHc0IsS0FBSyxDQUFBO0FBRXJCLElBQUEsSUFBSSxDQUFDLElBQUksQ0FBQ3ZCLE1BQU0sRUFBRSxPQUFBO0FBRWxCLElBQUEsTUFBTXNCLGFBQWEsR0FBRyxJQUFJLENBQUN0QixNQUFNLENBQUNzQixhQUFhLENBQUE7SUFDL0MsTUFBTWdGLFVBQVUsR0FBRyxJQUFJLENBQUMzRCxLQUFLLEdBQUcsSUFBSSxDQUFDL0MsTUFBTSxDQUFDc0MsR0FBRyxDQUFDVSxNQUFNLENBQUNPLEdBQUcsQ0FBQyxJQUFJLENBQUNSLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQTtJQUM3RSxNQUFNNEQsWUFBWSxHQUFHRCxVQUFVLEdBQUdBLFVBQVUsQ0FBQ0UsSUFBSSxDQUFDaEMsT0FBTyxHQUFHLElBQUksQ0FBQTtJQUNoRSxJQUFJN0IsS0FBSyxHQUFHLElBQUksQ0FBQTtBQUVoQixJQUFBLEtBQUssSUFBSWpCLENBQUMsR0FBRyxDQUFDLEVBQUV5RCxHQUFHLEdBQUc3RCxhQUFhLENBQUNLLE1BQU0sRUFBRUQsQ0FBQyxHQUFHeUQsR0FBRyxFQUFFekQsQ0FBQyxFQUFFLEVBQUU7QUFDdEQsTUFBQSxJQUFJSCxLQUFLLENBQUNHLENBQUMsQ0FBQyxLQUFLK0UsU0FBUyxFQUFFO0FBQ3hCLFFBQUEsSUFBSWxGLEtBQUssQ0FBQ0csQ0FBQyxDQUFDLEVBQUU7QUFDVmlCLFVBQUFBLEtBQUssR0FBRyxJQUFJLENBQUMvQyxNQUFNLENBQUNzQyxHQUFHLENBQUNVLE1BQU0sQ0FBQ08sR0FBRyxDQUFDNUIsS0FBSyxDQUFDRyxDQUFDLENBQUMsQ0FBQyxDQUFBO1VBQzVDLElBQUksQ0FBQ2dGLCtCQUErQixDQUFDL0QsS0FBSyxFQUFFckIsYUFBYSxDQUFDSSxDQUFDLENBQUMsRUFBRUEsQ0FBQyxDQUFDLENBQUE7QUFDcEUsU0FBQyxNQUFNO1VBQ0hKLGFBQWEsQ0FBQ0ksQ0FBQyxDQUFDLENBQUMyRSxRQUFRLEdBQUcsSUFBSSxDQUFDekcsTUFBTSxDQUFDc0IsZUFBZSxDQUFBO0FBQzNELFNBQUE7T0FDSCxNQUFNLElBQUlxRixZQUFZLEVBQUU7QUFDckIsUUFBQSxJQUFJQSxZQUFZLENBQUM3RSxDQUFDLENBQUMsS0FBSzZFLFlBQVksQ0FBQzdFLENBQUMsQ0FBQyxDQUFDMkUsUUFBUSxJQUFJRSxZQUFZLENBQUM3RSxDQUFDLENBQUMsQ0FBQ2lGLElBQUksQ0FBQyxFQUFFO1VBQ3ZFLElBQUlKLFlBQVksQ0FBQzdFLENBQUMsQ0FBQyxDQUFDMkUsUUFBUSxLQUFLSSxTQUFTLEVBQUU7QUFDeEM5RCxZQUFBQSxLQUFLLEdBQUcsSUFBSSxDQUFDL0MsTUFBTSxDQUFDc0MsR0FBRyxDQUFDVSxNQUFNLENBQUNPLEdBQUcsQ0FBQ29ELFlBQVksQ0FBQzdFLENBQUMsQ0FBQyxDQUFDMkUsUUFBUSxDQUFDLENBQUE7V0FDL0QsTUFBTSxJQUFJRSxZQUFZLENBQUM3RSxDQUFDLENBQUMsQ0FBQ2lGLElBQUksS0FBS0YsU0FBUyxFQUFFO0FBQzNDLFlBQUEsTUFBTUcsR0FBRyxHQUFHLElBQUksQ0FBQ0Msb0JBQW9CLENBQUNOLFlBQVksQ0FBQzdFLENBQUMsQ0FBQyxDQUFDaUYsSUFBSSxDQUFDLENBQUE7QUFDM0QsWUFBQSxJQUFJQyxHQUFHLEVBQUU7QUFDTGpFLGNBQUFBLEtBQUssR0FBRyxJQUFJLENBQUMvQyxNQUFNLENBQUNzQyxHQUFHLENBQUNVLE1BQU0sQ0FBQ2tFLFFBQVEsQ0FBQ0YsR0FBRyxDQUFDLENBQUE7QUFDaEQsYUFBQTtBQUNKLFdBQUE7VUFDQSxJQUFJLENBQUNGLCtCQUErQixDQUFDL0QsS0FBSyxFQUFFckIsYUFBYSxDQUFDSSxDQUFDLENBQUMsRUFBRUEsQ0FBQyxDQUFDLENBQUE7QUFDcEUsU0FBQyxNQUFNO1VBQ0hKLGFBQWEsQ0FBQ0ksQ0FBQyxDQUFDLENBQUMyRSxRQUFRLEdBQUcsSUFBSSxDQUFDekcsTUFBTSxDQUFDc0IsZUFBZSxDQUFBO0FBQzNELFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUlzRCxPQUFPLEdBQUc7SUFDVixPQUFPLElBQUksQ0FBQ3ZFLFFBQVEsQ0FBQTtBQUN4QixHQUFBO0FBRUFrRSxFQUFBQSxnQkFBZ0IsR0FBRztJQUNmLE1BQU1TLE1BQU0sR0FBRyxJQUFJLENBQUNoRixNQUFNLENBQUNzQyxHQUFHLENBQUMyQyxLQUFLLENBQUNELE1BQU0sQ0FBQTtBQUMzQyxJQUFBLEtBQUssSUFBSWxELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUNoQixPQUFPLENBQUNpQixNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQzFDLE1BQUEsTUFBTW9ELEtBQUssR0FBR0YsTUFBTSxDQUFDRyxZQUFZLENBQUMsSUFBSSxDQUFDckUsT0FBTyxDQUFDZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNsRCxNQUFBLElBQUlvRCxLQUFLLEVBQUU7QUFDUEEsUUFBQUEsS0FBSyxDQUFDVyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUNuRSxhQUFhLENBQUMsQ0FBQTtBQUM5QyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQWtDLEVBQUFBLHFCQUFxQixHQUFHO0lBQ3BCLE1BQU1vQixNQUFNLEdBQUcsSUFBSSxDQUFDaEYsTUFBTSxDQUFDc0MsR0FBRyxDQUFDMkMsS0FBSyxDQUFDRCxNQUFNLENBQUE7QUFDM0MsSUFBQSxLQUFLLElBQUlsRCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDaEIsT0FBTyxDQUFDaUIsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUMxQyxNQUFBLE1BQU1vRCxLQUFLLEdBQUdGLE1BQU0sQ0FBQ0csWUFBWSxDQUFDLElBQUksQ0FBQ3JFLE9BQU8sQ0FBQ2dCLENBQUMsQ0FBQyxDQUFDLENBQUE7TUFDbEQsSUFBSSxDQUFDb0QsS0FBSyxFQUFFLFNBQUE7QUFDWkEsTUFBQUEsS0FBSyxDQUFDVSxtQkFBbUIsQ0FBQyxJQUFJLENBQUNsRSxhQUFhLENBQUMsQ0FBQTtBQUNqRCxLQUFBO0FBQ0osR0FBQTtBQUVBRixFQUFBQSxhQUFhLEdBQUc7QUFDWixJQUFBLElBQUksSUFBSSxDQUFDcEIsTUFBTSxFQUNYLElBQUksQ0FBQ3dELHFCQUFxQixFQUFFLENBQUE7QUFDcEMsR0FBQTtBQUVBbkMsRUFBQUEsYUFBYSxHQUFHO0FBQ1osSUFBQSxJQUFJLElBQUksQ0FBQ3JCLE1BQU0sSUFBSSxJQUFJLENBQUNrRSxPQUFPLElBQUksSUFBSSxDQUFDckUsTUFBTSxDQUFDcUUsT0FBTyxFQUNsRCxJQUFJLENBQUNDLGdCQUFnQixFQUFFLENBQUE7QUFDL0IsR0FBQTtBQUVBNEMsRUFBQUEsUUFBUSxHQUFHO0lBQ1AsSUFBSSxDQUFDcEUsS0FBSyxHQUFHLElBQUksQ0FBQTtJQUNqQixJQUFJLENBQUNaLEtBQUssR0FBRyxJQUFJLENBQUE7SUFDakIsSUFBSSxDQUFDaUUsYUFBYSxHQUFHLElBQUksQ0FBQTtJQUN6QixJQUFJLENBQUN2QixvQkFBb0IsRUFBRSxDQUFBO0FBRTNCLElBQUEsSUFBSSxDQUFDNUUsTUFBTSxDQUFDbUQsR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM1QixhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbkQsSUFBQSxJQUFJLENBQUN2QixNQUFNLENBQUNtRCxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQzNCLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN2RCxHQUFBOztBQVNBMkYsRUFBQUEsZUFBZSxDQUFDQyxPQUFPLEVBQUVDLE9BQU8sRUFBRTtJQUM5QixJQUFJLENBQUMvQyxnQkFBZ0IsRUFBRSxDQUFBO0lBQ3ZCOEMsT0FBTyxDQUFDakUsR0FBRyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUNtRSxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDM0NGLE9BQU8sQ0FBQ2pFLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDb0UsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFBO0lBQ2hERixPQUFPLENBQUMvRixFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQ2dHLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUMxQ0QsT0FBTyxDQUFDL0YsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNpRyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbkQsR0FBQTs7RUFNQUQsWUFBWSxDQUFDckMsS0FBSyxFQUFFO0lBQ2hCLE1BQU11QyxLQUFLLEdBQUcsSUFBSSxDQUFDekMsTUFBTSxDQUFDMEMsT0FBTyxDQUFDeEMsS0FBSyxDQUFDL0IsRUFBRSxDQUFDLENBQUE7SUFDM0MsSUFBSXNFLEtBQUssR0FBRyxDQUFDLEVBQUUsT0FBQTtBQUNmdkMsSUFBQUEsS0FBSyxDQUFDVyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUNuRSxhQUFhLENBQUMsQ0FBQTtBQUM5QyxHQUFBOztFQU1BOEYsY0FBYyxDQUFDdEMsS0FBSyxFQUFFO0lBQ2xCLE1BQU11QyxLQUFLLEdBQUcsSUFBSSxDQUFDekMsTUFBTSxDQUFDMEMsT0FBTyxDQUFDeEMsS0FBSyxDQUFDL0IsRUFBRSxDQUFDLENBQUE7SUFDM0MsSUFBSXNFLEtBQUssR0FBRyxDQUFDLEVBQUUsT0FBQTtBQUNmdkMsSUFBQUEsS0FBSyxDQUFDVSxtQkFBbUIsQ0FBQyxJQUFJLENBQUNsRSxhQUFhLENBQUMsQ0FBQTtBQUNqRCxHQUFBOztFQVNBaUcsaUJBQWlCLENBQUNGLEtBQUssRUFBRUcsS0FBSyxFQUFFekUsRUFBRSxFQUFFMEUsT0FBTyxFQUFFO0FBQ3pDLElBQUEsTUFBTUMsR0FBRyxHQUFHRixLQUFLLEdBQUcsR0FBRyxHQUFHekUsRUFBRSxDQUFBO0FBQzVCLElBQUEsSUFBSSxDQUFDbkQsTUFBTSxDQUFDc0MsR0FBRyxDQUFDVSxNQUFNLENBQUN6QixFQUFFLENBQUN1RyxHQUFHLEVBQUVELE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUU3QyxJQUFJLENBQUMsSUFBSSxDQUFDMUcsZUFBZSxFQUNyQixJQUFJLENBQUNBLGVBQWUsR0FBRyxFQUFFLENBQUE7QUFFN0IsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDQSxlQUFlLENBQUNzRyxLQUFLLENBQUMsRUFDNUIsSUFBSSxDQUFDdEcsZUFBZSxDQUFDc0csS0FBSyxDQUFDLEdBQUcsRUFBRyxDQUFBO0lBRXJDLElBQUksQ0FBQ3RHLGVBQWUsQ0FBQ3NHLEtBQUssQ0FBQyxDQUFDSyxHQUFHLENBQUMsR0FBRztBQUMvQjNFLE1BQUFBLEVBQUUsRUFBRUEsRUFBRTtBQUNOMEUsTUFBQUEsT0FBTyxFQUFFQSxPQUFBQTtLQUNaLENBQUE7QUFDTCxHQUFBOztBQUdBaEQsRUFBQUEsb0JBQW9CLEdBQUc7SUFDbkIsTUFBTTdCLE1BQU0sR0FBRyxJQUFJLENBQUNoRCxNQUFNLENBQUNzQyxHQUFHLENBQUNVLE1BQU0sQ0FBQTtBQUNyQyxJQUFBLE1BQU0rRSxNQUFNLEdBQUcsSUFBSSxDQUFDNUcsZUFBZSxDQUFBO0lBQ25DLElBQUksQ0FBQzRHLE1BQU0sRUFDUCxPQUFBO0FBRUosSUFBQSxLQUFLLElBQUlqRyxDQUFDLEdBQUcsQ0FBQyxFQUFFeUQsR0FBRyxHQUFHd0MsTUFBTSxDQUFDaEcsTUFBTSxFQUFFRCxDQUFDLEdBQUd5RCxHQUFHLEVBQUV6RCxDQUFDLEVBQUUsRUFBRTtBQUMvQyxNQUFBLElBQUksQ0FBQ2lHLE1BQU0sQ0FBQ2pHLENBQUMsQ0FBQyxFQUFFLFNBQUE7QUFDaEIsTUFBQSxNQUFNZ0csR0FBRyxHQUFHQyxNQUFNLENBQUNqRyxDQUFDLENBQUMsQ0FBQTtBQUNyQixNQUFBLEtBQUssTUFBTWtHLEdBQUcsSUFBSUYsR0FBRyxFQUFFO0FBQ25COUUsUUFBQUEsTUFBTSxDQUFDSSxHQUFHLENBQUM0RSxHQUFHLEVBQUVGLEdBQUcsQ0FBQ0UsR0FBRyxDQUFDLENBQUNILE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMzQyxPQUFBO0FBQ0osS0FBQTtJQUVBLElBQUksQ0FBQzFHLGVBQWUsR0FBRyxJQUFJLENBQUE7QUFDL0IsR0FBQTs7RUFPQThHLG1CQUFtQixDQUFDQyxRQUFRLEVBQUU7SUFDMUIsSUFBSW5GLEtBQUssR0FBRyxJQUFJLENBQUE7SUFDaEIsTUFBTW9GLE1BQU0sR0FBR0MsS0FBSyxDQUFDQyxRQUFRLENBQUNILFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFBOztJQUc1QyxJQUFJLENBQUNDLE1BQU0sRUFBRTtBQUNUcEYsTUFBQUEsS0FBSyxHQUFHLElBQUksQ0FBQy9DLE1BQU0sQ0FBQ3NDLEdBQUcsQ0FBQ1UsTUFBTSxDQUFDTyxHQUFHLENBQUMyRSxRQUFRLENBQUMsQ0FBQTtBQUNoRCxLQUFDLE1BQU0sSUFBSSxJQUFJLENBQUNuRixLQUFLLEVBQUU7QUFDbkIsTUFBQSxNQUFNaUUsR0FBRyxHQUFHLElBQUksQ0FBQ0Msb0JBQW9CLENBQUNpQixRQUFRLENBQUMsQ0FBQTtBQUMvQyxNQUFBLElBQUlsQixHQUFHLEVBQ0hqRSxLQUFLLEdBQUcsSUFBSSxDQUFDL0MsTUFBTSxDQUFDc0MsR0FBRyxDQUFDVSxNQUFNLENBQUNrRSxRQUFRLENBQUNGLEdBQUcsQ0FBQyxDQUFBO0FBQ3BELEtBQUE7QUFFQSxJQUFBLE9BQU9qRSxLQUFLLENBQUE7QUFDaEIsR0FBQTs7RUFPQWtFLG9CQUFvQixDQUFDRixJQUFJLEVBQUU7QUFDdkIsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDaEUsS0FBSyxFQUFFLE9BQU8sSUFBSSxDQUFBO0FBRTVCLElBQUEsTUFBTTJELFVBQVUsR0FBRyxJQUFJLENBQUMxRyxNQUFNLENBQUNzQyxHQUFHLENBQUNVLE1BQU0sQ0FBQ08sR0FBRyxDQUFDLElBQUksQ0FBQ1IsS0FBSyxDQUFDLENBQUE7SUFFekQsT0FBTzJELFVBQVUsR0FBR0EsVUFBVSxDQUFDNEIsY0FBYyxDQUFDdkIsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFBO0FBQzlELEdBQUE7O0FBUUFELEVBQUFBLCtCQUErQixDQUFDVixhQUFhLEVBQUVtQyxZQUFZLEVBQUVkLEtBQUssRUFBRTtJQUNoRSxNQUFNekUsTUFBTSxHQUFHLElBQUksQ0FBQ2hELE1BQU0sQ0FBQ3NDLEdBQUcsQ0FBQ1UsTUFBTSxDQUFBO0lBRXJDLElBQUksQ0FBQ29ELGFBQWEsRUFDZCxPQUFBO0lBRUosSUFBSUEsYUFBYSxDQUFDb0MsUUFBUSxFQUFFO0FBQ3hCRCxNQUFBQSxZQUFZLENBQUM5QixRQUFRLEdBQUdMLGFBQWEsQ0FBQ29DLFFBQVEsQ0FBQTtNQUU5QyxJQUFJLENBQUNiLGlCQUFpQixDQUFDRixLQUFLLEVBQUUsUUFBUSxFQUFFckIsYUFBYSxDQUFDakQsRUFBRSxFQUFFLFlBQVk7QUFDbEVvRixRQUFBQSxZQUFZLENBQUM5QixRQUFRLEdBQUcsSUFBSSxDQUFDekcsTUFBTSxDQUFDc0IsZUFBZSxDQUFBO0FBQ3ZELE9BQUMsQ0FBQyxDQUFBO0FBQ04sS0FBQyxNQUFNO0FBQ0gsTUFBQSxJQUFJLENBQUNxRyxpQkFBaUIsQ0FBQ0YsS0FBSyxFQUFFLE1BQU0sRUFBRXJCLGFBQWEsQ0FBQ2pELEVBQUUsRUFBRSxVQUFVSixLQUFLLEVBQUU7QUFDckV3RixRQUFBQSxZQUFZLENBQUM5QixRQUFRLEdBQUcxRCxLQUFLLENBQUN5RixRQUFRLENBQUE7UUFFdEMsSUFBSSxDQUFDYixpQkFBaUIsQ0FBQ0YsS0FBSyxFQUFFLFFBQVEsRUFBRXJCLGFBQWEsQ0FBQ2pELEVBQUUsRUFBRSxZQUFZO0FBQ2xFb0YsVUFBQUEsWUFBWSxDQUFDOUIsUUFBUSxHQUFHLElBQUksQ0FBQ3pHLE1BQU0sQ0FBQ3NCLGVBQWUsQ0FBQTtBQUN2RCxTQUFDLENBQUMsQ0FBQTtBQUNOLE9BQUMsQ0FBQyxDQUFBO0FBRUYsTUFBQSxJQUFJLElBQUksQ0FBQ2dELE9BQU8sSUFBSSxJQUFJLENBQUNyRSxNQUFNLENBQUNxRSxPQUFPLEVBQ25DdEIsTUFBTSxDQUFDeUYsSUFBSSxDQUFDckMsYUFBYSxDQUFDLENBQUE7QUFDbEMsS0FBQTtBQUNKLEdBQUE7QUFFQXNDLEVBQUFBLFFBQVEsR0FBRztBQUNQLElBQUEsTUFBTXBHLEdBQUcsR0FBRyxJQUFJLENBQUN0QyxNQUFNLENBQUNzQyxHQUFHLENBQUE7QUFDM0IsSUFBQSxNQUFNMkMsS0FBSyxHQUFHM0MsR0FBRyxDQUFDMkMsS0FBSyxDQUFBO0lBRXZCQSxLQUFLLENBQUMxRCxFQUFFLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQzZGLGVBQWUsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUNsRCxJQUFJbkMsS0FBSyxDQUFDRCxNQUFNLEVBQUU7QUFDZEMsTUFBQUEsS0FBSyxDQUFDRCxNQUFNLENBQUN6RCxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQ2dHLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMvQ3RDLE1BQUFBLEtBQUssQ0FBQ0QsTUFBTSxDQUFDekQsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNpRyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDeEQsS0FBQTtBQUVBLElBQUEsTUFBTW1CLE9BQU8sR0FBSSxJQUFJLENBQUN6SSxLQUFLLEtBQUssT0FBUSxDQUFBO0FBRXhDLElBQUEsSUFBSTZDLEtBQUssQ0FBQTtJQUNULElBQUksSUFBSSxDQUFDM0MsTUFBTSxFQUFFO01BQ2IsSUFBSSxDQUFDbUUsZ0JBQWdCLEVBQUUsQ0FBQTtBQUMzQixLQUFDLE1BQU0sSUFBSW9FLE9BQU8sSUFBSSxJQUFJLENBQUN4SSxNQUFNLEVBQUU7TUFFL0I0QyxLQUFLLEdBQUdULEdBQUcsQ0FBQ1UsTUFBTSxDQUFDTyxHQUFHLENBQUMsSUFBSSxDQUFDcEQsTUFBTSxDQUFDLENBQUE7TUFDbkMsSUFBSTRDLEtBQUssSUFBSUEsS0FBSyxDQUFDeUYsUUFBUSxLQUFLLElBQUksQ0FBQ3BJLE1BQU0sRUFBRTtBQUN6QyxRQUFBLElBQUksQ0FBQzhCLGVBQWUsQ0FBQ2EsS0FBSyxDQUFDLENBQUE7QUFDL0IsT0FBQTtBQUNKLEtBQUE7SUFFQSxJQUFJLElBQUksQ0FBQ3ZDLGNBQWMsRUFBRTtNQUVyQnVDLEtBQUssR0FBR1QsR0FBRyxDQUFDVSxNQUFNLENBQUNPLEdBQUcsQ0FBQyxJQUFJLENBQUMvQyxjQUFjLENBQUMsQ0FBQTtNQUMzQyxJQUFJdUMsS0FBSyxJQUFJQSxLQUFLLENBQUN5RixRQUFRLEtBQUssSUFBSSxDQUFDL0gsU0FBUyxFQUFFO0FBQzVDLFFBQUEsSUFBSSxDQUFDK0Ysa0JBQWtCLENBQUN6RCxLQUFLLENBQUMsQ0FBQTtBQUNsQyxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsSUFBSTRGLE9BQU8sRUFBRTtNQUdULElBQUksSUFBSSxDQUFDdEksUUFBUSxFQUFFO0FBQ2YsUUFBQSxLQUFLLE1BQU1vSCxLQUFLLElBQUksSUFBSSxDQUFDcEgsUUFBUSxFQUFFO0FBQy9CLFVBQUEsSUFBSSxJQUFJLENBQUNBLFFBQVEsQ0FBQ29ILEtBQUssQ0FBQyxFQUFFO1lBQ3RCMUUsS0FBSyxHQUFHLElBQUksQ0FBQ2tGLG1CQUFtQixDQUFDLElBQUksQ0FBQzVILFFBQVEsQ0FBQ29ILEtBQUssQ0FBQyxDQUFDLENBQUE7QUFDdEQsWUFBQSxJQUFJMUUsS0FBSyxJQUFJLENBQUNBLEtBQUssQ0FBQ3lGLFFBQVEsRUFBRTtBQUMxQmxHLGNBQUFBLEdBQUcsQ0FBQ1UsTUFBTSxDQUFDeUYsSUFBSSxDQUFDMUYsS0FBSyxDQUFDLENBQUE7QUFDMUIsYUFBQTtBQUNKLFdBQUE7QUFDSixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFFQSxJQUFBLElBQUksSUFBSSxDQUFDL0IsYUFBYSxJQUFJLENBQUMsRUFBRTtBQUFBLE1BQUEsSUFBQSxZQUFBLENBQUE7QUFDekIsTUFBQSxDQUFBLFlBQUEsR0FBQXNCLEdBQUcsQ0FBQ3lELE9BQU8scUJBQVgsWUFBYUksQ0FBQUEsTUFBTSxDQUFDRixVQUFVLENBQUNDLEtBQUssRUFBRSxJQUFJLENBQUNKLFlBQVksRUFBRSxJQUFJLENBQUM3RixNQUFNLENBQUMsQ0FBQTtBQUN6RSxLQUFBO0FBQ0osR0FBQTtBQUVBMkksRUFBQUEsU0FBUyxHQUFHO0FBQ1IsSUFBQSxNQUFNdEcsR0FBRyxHQUFHLElBQUksQ0FBQ3RDLE1BQU0sQ0FBQ3NDLEdBQUcsQ0FBQTtBQUMzQixJQUFBLE1BQU0yQyxLQUFLLEdBQUczQyxHQUFHLENBQUMyQyxLQUFLLENBQUE7SUFFdkJBLEtBQUssQ0FBQzdCLEdBQUcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDZ0UsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFBO0lBQ25ELElBQUluQyxLQUFLLENBQUNELE1BQU0sRUFBRTtBQUNkQyxNQUFBQSxLQUFLLENBQUNELE1BQU0sQ0FBQzVCLEdBQUcsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDbUUsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ2hEdEMsTUFBQUEsS0FBSyxDQUFDRCxNQUFNLENBQUM1QixHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ29FLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUN6RCxLQUFBO0FBRUEsSUFBQSxJQUFJLElBQUksQ0FBQ3hHLGFBQWEsSUFBSSxDQUFDLEVBQUU7QUFBQSxNQUFBLElBQUEsYUFBQSxDQUFBO0FBQ3pCLE1BQUEsQ0FBQSxhQUFBLEdBQUFzQixHQUFHLENBQUN5RCxPQUFPLHFCQUFYLGFBQWFDLENBQUFBLE1BQU0sQ0FBQ0MsVUFBVSxDQUFDQyxLQUFLLEVBQUUsSUFBSSxDQUFDSixZQUFZLEVBQUUsSUFBSSxDQUFDN0YsTUFBTSxDQUFDLENBQUE7QUFDekUsS0FBQTtJQUVBLElBQUksSUFBSSxDQUFDRyxNQUFNLEVBQUU7TUFDYixJQUFJLENBQUN3RCxxQkFBcUIsRUFBRSxDQUFBO0FBQ2hDLEtBQUE7QUFDSixHQUFBOztBQXlCQWlGLEVBQUFBLElBQUksR0FBRztJQUNILElBQUksSUFBSSxDQUFDekksTUFBTSxFQUFFO0FBQ2IsTUFBQSxNQUFNMEksU0FBUyxHQUFHLElBQUksQ0FBQzFJLE1BQU0sQ0FBQ3NCLGFBQWEsQ0FBQTtBQUMzQyxNQUFBLEtBQUssSUFBSUksQ0FBQyxHQUFHLENBQUMsRUFBRWlILENBQUMsR0FBR0QsU0FBUyxDQUFDL0csTUFBTSxFQUFFRCxDQUFDLEdBQUdpSCxDQUFDLEVBQUVqSCxDQUFDLEVBQUUsRUFBRTtBQUM5Q2dILFFBQUFBLFNBQVMsQ0FBQ2hILENBQUMsQ0FBQyxDQUFDa0gsT0FBTyxHQUFHLEtBQUssQ0FBQTtBQUNoQyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBTUFDLEVBQUFBLElBQUksR0FBRztJQUNILElBQUksSUFBSSxDQUFDN0ksTUFBTSxFQUFFO0FBQ2IsTUFBQSxNQUFNMEksU0FBUyxHQUFHLElBQUksQ0FBQzFJLE1BQU0sQ0FBQ3NCLGFBQWEsQ0FBQTtBQUMzQyxNQUFBLEtBQUssSUFBSUksQ0FBQyxHQUFHLENBQUMsRUFBRWlILENBQUMsR0FBR0QsU0FBUyxDQUFDL0csTUFBTSxFQUFFRCxDQUFDLEdBQUdpSCxDQUFDLEVBQUVqSCxDQUFDLEVBQUUsRUFBRTtBQUM5Q2dILFFBQUFBLFNBQVMsQ0FBQ2hILENBQUMsQ0FBQyxDQUFDa0gsT0FBTyxHQUFHLElBQUksQ0FBQTtBQUMvQixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0VBTUF4QyxrQkFBa0IsQ0FBQ3pELEtBQUssRUFBRTtJQUN0QkEsS0FBSyxDQUFDeEIsRUFBRSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMySCxvQkFBb0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUNqRG5HLEtBQUssQ0FBQ3hCLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDNEgsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDckRwRyxLQUFLLENBQUN4QixFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQzZILHNCQUFzQixFQUFFLElBQUksQ0FBQyxDQUFBO0lBQ3JEckcsS0FBSyxDQUFDeEIsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM4SCxzQkFBc0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUVyRCxJQUFJdEcsS0FBSyxDQUFDeUYsUUFBUSxFQUFFO0FBQ2hCLE1BQUEsSUFBSSxDQUFDVSxvQkFBb0IsQ0FBQ25HLEtBQUssQ0FBQyxDQUFBO0FBQ3BDLEtBQUMsTUFBTTtNQUVILElBQUksQ0FBQyxJQUFJLENBQUN1QixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUNyRSxNQUFNLENBQUNxRSxPQUFPLEVBQUUsT0FBQTtNQUMzQyxJQUFJLENBQUN0RSxNQUFNLENBQUNzQyxHQUFHLENBQUNVLE1BQU0sQ0FBQ3lGLElBQUksQ0FBQzFGLEtBQUssQ0FBQyxDQUFBO0FBQ3RDLEtBQUE7QUFDSixHQUFBOztFQU1BdUQsb0JBQW9CLENBQUN2RCxLQUFLLEVBQUU7SUFDeEJBLEtBQUssQ0FBQ0ssR0FBRyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUM4RixvQkFBb0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUNsRG5HLEtBQUssQ0FBQ0ssR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMrRixzQkFBc0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUN0RHBHLEtBQUssQ0FBQ0ssR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNnRyxzQkFBc0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUN0RHJHLEtBQUssQ0FBQ0ssR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNpRyxzQkFBc0IsRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMxRCxHQUFBOztFQU1BaEQsbUJBQW1CLENBQUN0RCxLQUFLLEVBQUU7SUFDdkIsSUFBSSxDQUFDL0MsTUFBTSxDQUFDc0MsR0FBRyxDQUFDVSxNQUFNLENBQUNJLEdBQUcsQ0FBQyxNQUFNLEdBQUdMLEtBQUssQ0FBQ0ksRUFBRSxFQUFFLElBQUksQ0FBQ2tELG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFBO0FBQzdFLElBQUEsSUFBSSxJQUFJLENBQUM3RixjQUFjLEtBQUt1QyxLQUFLLENBQUNJLEVBQUUsRUFBRTtBQUNsQyxNQUFBLElBQUksQ0FBQ3FELGtCQUFrQixDQUFDekQsS0FBSyxDQUFDLENBQUE7QUFDbEMsS0FBQTtBQUNKLEdBQUE7O0VBTUFtRyxvQkFBb0IsQ0FBQ25HLEtBQUssRUFBRTtBQUN4QixJQUFBLElBQUksQ0FBQ3dELFlBQVksQ0FBQ3hELEtBQUssQ0FBQ3lGLFFBQVEsQ0FBQyxDQUFBO0FBQ3JDLEdBQUE7O0VBTUFXLHNCQUFzQixDQUFDcEcsS0FBSyxFQUFFO0lBQzFCLElBQUksQ0FBQ3dELFlBQVksQ0FBQyxJQUFJLENBQUN2RyxNQUFNLENBQUNzQixlQUFlLENBQUMsQ0FBQTtBQUNsRCxHQUFBOztFQU1BOEgsc0JBQXNCLENBQUNyRyxLQUFLLEVBQUU7QUFDMUIsSUFBQSxJQUFJLENBQUNvRyxzQkFBc0IsQ0FBQ3BHLEtBQUssQ0FBQyxDQUFBO0FBQ3RDLEdBQUE7O0VBTUFzRyxzQkFBc0IsQ0FBQ3RHLEtBQUssRUFBRSxFQUM5Qjs7RUFNQWIsZUFBZSxDQUFDYSxLQUFLLEVBQUU7QUFDbkIsSUFBQSxJQUFJLENBQUNTLGlCQUFpQixDQUFDVCxLQUFLLENBQUMsQ0FBQTtJQUU3QkEsS0FBSyxDQUFDeEIsRUFBRSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMrSCxpQkFBaUIsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUM5Q3ZHLEtBQUssQ0FBQ3hCLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDZ0ksbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDbER4RyxLQUFLLENBQUN4QixFQUFFLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ2lJLG1CQUFtQixFQUFFLElBQUksQ0FBQyxDQUFBO0lBQ2xEekcsS0FBSyxDQUFDeEIsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNrSSxtQkFBbUIsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUVsRCxJQUFJMUcsS0FBSyxDQUFDeUYsUUFBUSxFQUFFO0FBQ2hCLE1BQUEsSUFBSSxDQUFDYyxpQkFBaUIsQ0FBQ3ZHLEtBQUssQ0FBQyxDQUFBO0FBQ2pDLEtBQUMsTUFBTTtNQUVILElBQUksQ0FBQyxJQUFJLENBQUN1QixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUNyRSxNQUFNLENBQUNxRSxPQUFPLEVBQUUsT0FBQTtNQUUzQyxJQUFJLENBQUN0RSxNQUFNLENBQUNzQyxHQUFHLENBQUNVLE1BQU0sQ0FBQ3lGLElBQUksQ0FBQzFGLEtBQUssQ0FBQyxDQUFBO0FBQ3RDLEtBQUE7QUFDSixHQUFBOztFQU1BUyxpQkFBaUIsQ0FBQ1QsS0FBSyxFQUFFO0lBQ3JCQSxLQUFLLENBQUNLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDa0csaUJBQWlCLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDL0N2RyxLQUFLLENBQUNLLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDbUcsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDbkR4RyxLQUFLLENBQUNLLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDb0csbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDbkR6RyxLQUFLLENBQUNLLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDcUcsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDdkQsR0FBQTs7RUFNQXBHLGtCQUFrQixDQUFDTixLQUFLLEVBQUU7SUFDdEIsSUFBSSxDQUFDL0MsTUFBTSxDQUFDc0MsR0FBRyxDQUFDVSxNQUFNLENBQUNJLEdBQUcsQ0FBQyxNQUFNLEdBQUdMLEtBQUssQ0FBQ0ksRUFBRSxFQUFFLElBQUksQ0FBQ0Usa0JBQWtCLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDNUUsSUFBQSxJQUFJTixLQUFLLENBQUNJLEVBQUUsS0FBSyxJQUFJLENBQUNoRCxNQUFNLEVBQUU7QUFDMUIsTUFBQSxJQUFJLENBQUMrQixlQUFlLENBQUNhLEtBQUssQ0FBQyxDQUFBO0FBQy9CLEtBQUE7QUFDSixHQUFBOztFQU1BdUcsaUJBQWlCLENBQUN2RyxLQUFLLEVBQUU7SUFDckIsSUFBSSxDQUFDWixLQUFLLEdBQUdZLEtBQUssQ0FBQ3lGLFFBQVEsQ0FBQ2tCLEtBQUssRUFBRSxDQUFBO0lBQ25DLElBQUksQ0FBQ3RJLFlBQVksR0FBRyxJQUFJLENBQUE7QUFDNUIsR0FBQTs7RUFNQW1JLG1CQUFtQixDQUFDeEcsS0FBSyxFQUFFO0lBQ3ZCLElBQUksQ0FBQ1osS0FBSyxHQUFHLElBQUksQ0FBQTtBQUNyQixHQUFBOztFQVNBcUgsbUJBQW1CLENBQUN6RyxLQUFLLEVBQUU0RyxJQUFJLEVBQUVDLElBQUksRUFBRUMsSUFBSSxFQUFFO0lBQ3pDLElBQUlGLElBQUksS0FBSyxNQUFNLEVBQUU7QUFDakIsTUFBQSxJQUFJLENBQUMvRSxPQUFPLEdBQUcsSUFBSSxDQUFDdkUsUUFBUSxDQUFBO0FBQ2hDLEtBQUE7QUFDSixHQUFBOztFQU1Bb0osbUJBQW1CLENBQUMxRyxLQUFLLEVBQUU7SUFDdkIsSUFBSSxDQUFDWixLQUFLLEdBQUcsSUFBSSxDQUFBO0FBQ3JCLEdBQUE7O0VBT0FvRSxZQUFZLENBQUNFLFFBQVEsRUFBRTtBQUNuQixJQUFBLElBQUksSUFBSSxDQUFDaEcsU0FBUyxLQUFLZ0csUUFBUSxFQUMzQixPQUFBO0lBRUosSUFBSSxDQUFDaEcsU0FBUyxHQUFHZ0csUUFBUSxDQUFBO0FBRXpCLElBQUEsTUFBTXRFLEtBQUssR0FBRyxJQUFJLENBQUMvQixNQUFNLENBQUE7QUFDekIsSUFBQSxJQUFJK0IsS0FBSyxJQUFJLElBQUksQ0FBQ2pDLEtBQUssS0FBSyxPQUFPLEVBQUU7QUFDakMsTUFBQSxNQUFNd0IsYUFBYSxHQUFHUyxLQUFLLENBQUNULGFBQWEsQ0FBQTtBQUN6QyxNQUFBLEtBQUssSUFBSUksQ0FBQyxHQUFHLENBQUMsRUFBRXlELEdBQUcsR0FBRzdELGFBQWEsQ0FBQ0ssTUFBTSxFQUFFRCxDQUFDLEdBQUd5RCxHQUFHLEVBQUV6RCxDQUFDLEVBQUUsRUFBRTtBQUN0REosUUFBQUEsYUFBYSxDQUFDSSxDQUFDLENBQUMsQ0FBQzJFLFFBQVEsR0FBR0EsUUFBUSxDQUFBO0FBQ3hDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUNKOzs7OyJ9
