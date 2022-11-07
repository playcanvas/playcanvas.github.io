/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_WORLD, RENDERSTYLE_SOLID } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { MorphInstance } from '../../../scene/morph-instance.js';
import { getShapePrimitive } from '../../../scene/procedural.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { SkinInstanceCache } from '../../../scene/skin-instance-cache.js';
import { Asset } from '../../asset/asset.js';
import { AssetReference } from '../../asset/asset-reference.js';
import { Component } from '../component.js';
import { EntityReference } from '../../utils/entity-reference.js';

class RenderComponent extends Component {

  constructor(system, entity) {
    super(system, entity);

    this._type = 'asset';
    this._castShadows = true;
    this._receiveShadows = true;
    this._castShadowsLightmap = true;
    this._lightmapped = false;
    this._lightmapSizeMultiplier = 1;
    this._isStatic = false;
    this._batchGroupId = -1;
    this._layers = [LAYERID_WORLD];
    this._renderStyle = RENDERSTYLE_SOLID;
    this._meshInstances = [];
    this._customAabb = null;
    this._area = null;
    this._assetReference = [];
    this._materialReferences = [];
    this._material = void 0;
    this._rootBone = void 0;
    this._rootBone = new EntityReference(this, 'rootBone');
    this._rootBone.on('set:entity', this._onSetRootBone, this);

    this._assetReference = new AssetReference('asset', this, system.app.assets, {
      add: this._onRenderAssetAdded,
      load: this._onRenderAssetLoad,
      remove: this._onRenderAssetRemove,
      unload: this._onRenderAssetUnload
    }, this);
    this._material = system.defaultMaterial;

    entity.on('remove', this.onRemoveChild, this);
    entity.on('removehierarchy', this.onRemoveChild, this);
    entity.on('insert', this.onInsertChild, this);
    entity.on('inserthierarchy', this.onInsertChild, this);
  }

  set renderStyle(renderStyle) {
    if (this._renderStyle !== renderStyle) {
      this._renderStyle = renderStyle;
      MeshInstance._prepareRenderStyleForArray(this._meshInstances, renderStyle);
    }
  }
  get renderStyle() {
    return this._renderStyle;
  }

  set customAabb(value) {
    this._customAabb = value;

    const mi = this._meshInstances;
    if (mi) {
      for (let i = 0; i < mi.length; i++) {
        mi[i].setCustomAabb(this._customAabb);
      }
    }
  }
  get customAabb() {
    return this._customAabb;
  }

  set type(value) {
    if (this._type !== value) {
      this._area = null;
      this._type = value;
      this.destroyMeshInstances();
      if (value !== 'asset') {
        let material = this._material;
        if (!material || material === this.system.defaultMaterial) {
          material = this._materialReferences[0] && this._materialReferences[0].asset && this._materialReferences[0].asset.resource;
        }
        const primData = getShapePrimitive(this.system.app.graphicsDevice, value);
        this._area = primData.area;
        this.meshInstances = [new MeshInstance(primData.mesh, material || this.system.defaultMaterial, this.entity)];
      }
    }
  }
  get type() {
    return this._type;
  }

  set meshInstances(value) {
    this.destroyMeshInstances();
    this._meshInstances = value;
    if (this._meshInstances) {
      const mi = this._meshInstances;
      for (let i = 0; i < mi.length; i++) {
        if (!mi[i].node) {
          mi[i].node = this.entity;
        }
        mi[i].castShadow = this._castShadows;
        mi[i].receiveShadow = this._receiveShadows;
        mi[i].isStatic = this._isStatic;
        mi[i].renderStyle = this._renderStyle;
        mi[i].setLightmapped(this._lightmapped);
        mi[i].setCustomAabb(this._customAabb);
      }
      if (this.enabled && this.entity.enabled) {
        this.addToLayers();
      }
    }
  }
  get meshInstances() {
    return this._meshInstances;
  }

  set lightmapped(value) {
    if (value !== this._lightmapped) {
      this._lightmapped = value;
      const mi = this._meshInstances;
      if (mi) {
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
    if (this._castShadows !== value) {
      const mi = this._meshInstances;
      if (mi) {
        const layers = this.layers;
        const scene = this.system.app.scene;
        if (this._castShadows && !value) {
          for (let i = 0; i < layers.length; i++) {
            const layer = scene.layers.getLayerById(this.layers[i]);
            if (layer) {
              layer.removeShadowCasters(mi);
            }
          }
        }
        for (let i = 0; i < mi.length; i++) {
          mi[i].castShadow = value;
        }
        if (!this._castShadows && value) {
          for (let i = 0; i < layers.length; i++) {
            const layer = scene.layers.getLayerById(layers[i]);
            if (layer) {
              layer.addShadowCasters(mi);
            }
          }
        }
      }
      this._castShadows = value;
    }
  }
  get castShadows() {
    return this._castShadows;
  }

  set receiveShadows(value) {
    if (this._receiveShadows !== value) {
      this._receiveShadows = value;
      const mi = this._meshInstances;
      if (mi) {
        for (let i = 0; i < mi.length; i++) {
          mi[i].receiveShadow = value;
        }
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
    if (this._isStatic !== value) {
      this._isStatic = value;
      const mi = this._meshInstances;
      if (mi) {
        for (let i = 0; i < mi.length; i++) {
          mi[i].isStatic = value;
        }
      }
    }
  }
  get isStatic() {
    return this._isStatic;
  }

  set layers(value) {
    const layers = this.system.app.scene.layers;
    let layer;
    if (this._meshInstances) {
      for (let i = 0; i < this._layers.length; i++) {
        layer = layers.getLayerById(this._layers[i]);
        if (layer) {
          layer.removeMeshInstances(this._meshInstances);
        }
      }
    }

    this._layers.length = 0;
    for (let i = 0; i < value.length; i++) {
      this._layers[i] = value[i];
    }

    if (!this.enabled || !this.entity.enabled || !this._meshInstances) return;

    for (let i = 0; i < this._layers.length; i++) {
      layer = layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.addMeshInstances(this._meshInstances);
      }
    }
  }
  get layers() {
    return this._layers;
  }

  set batchGroupId(value) {
    if (this._batchGroupId !== value) {
      if (this.entity.enabled && this._batchGroupId >= 0) {
        var _this$system$app$batc;
        (_this$system$app$batc = this.system.app.batcher) == null ? void 0 : _this$system$app$batc.remove(BatchGroup.RENDER, this.batchGroupId, this.entity);
      }
      if (this.entity.enabled && value >= 0) {
        var _this$system$app$batc2;
        (_this$system$app$batc2 = this.system.app.batcher) == null ? void 0 : _this$system$app$batc2.insert(BatchGroup.RENDER, value, this.entity);
      }
      if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
        this.addToLayers();
      }
      this._batchGroupId = value;
    }
  }
  get batchGroupId() {
    return this._batchGroupId;
  }

  set material(value) {
    if (this._material !== value) {
      this._material = value;
      if (this._meshInstances && this._type !== 'asset') {
        for (let i = 0; i < this._meshInstances.length; i++) {
          this._meshInstances[i].material = value;
        }
      }
    }
  }
  get material() {
    return this._material;
  }

  set materialAssets(value = []) {
    if (this._materialReferences.length > value.length) {
      for (let i = value.length; i < this._materialReferences.length; i++) {
        this._materialReferences[i].id = null;
      }
      this._materialReferences.length = value.length;
    }
    for (let i = 0; i < value.length; i++) {
      if (!this._materialReferences[i]) {
        this._materialReferences.push(new AssetReference(i, this, this.system.app.assets, {
          add: this._onMaterialAdded,
          load: this._onMaterialLoad,
          remove: this._onMaterialRemove,
          unload: this._onMaterialUnload
        }, this));
      }
      if (value[i]) {
        const id = value[i] instanceof Asset ? value[i].id : value[i];
        if (this._materialReferences[i].id !== id) {
          this._materialReferences[i].id = id;
        }
        if (this._materialReferences[i].asset) {
          this._onMaterialAdded(i, this, this._materialReferences[i].asset);
        }
      } else {
        this._materialReferences[i].id = null;
        if (this._meshInstances[i]) {
          this._meshInstances[i].material = this.system.defaultMaterial;
        }
      }
    }
  }
  get materialAssets() {
    return this._materialReferences.map(function (ref) {
      return ref.id;
    });
  }

  set asset(value) {
    const id = value instanceof Asset ? value.id : value;
    if (this._assetReference.id === id) return;
    if (this._assetReference.asset && this._assetReference.asset.resource) {
      this._onRenderAssetRemove();
    }
    this._assetReference.id = id;
    if (this._assetReference.asset) {
      this._onRenderAssetAdded();
    }
  }
  get asset() {
    return this._assetReference.id;
  }

  assignAsset(asset) {
    const id = asset instanceof Asset ? asset.id : asset;
    this._assetReference.id = id;
  }

  _onSetRootBone(entity) {
    if (entity) {
      this._onRootBoneChanged();
    }
  }

  _onRootBoneChanged() {
    this._clearSkinInstances();
    if (this.enabled && this.entity.enabled) {
      this._cloneSkinInstances();
    }
  }

  destroyMeshInstances() {
    const meshInstances = this._meshInstances;
    if (meshInstances) {
      this.removeFromLayers();

      this._clearSkinInstances();
      for (let i = 0; i < meshInstances.length; i++) {
        meshInstances[i].destroy();
      }
      this._meshInstances.length = 0;
    }
  }

  addToLayers() {
    const layers = this.system.app.scene.layers;
    for (let i = 0; i < this._layers.length; i++) {
      const layer = layers.getLayerById(this._layers[i]);
      if (layer) {
        layer.addMeshInstances(this._meshInstances);
      }
    }
  }
  removeFromLayers() {
    if (this._meshInstances && this._meshInstances.length) {
      const layers = this.system.app.scene.layers;
      for (let i = 0; i < this._layers.length; i++) {
        const layer = layers.getLayerById(this._layers[i]);
        if (layer) {
          layer.removeMeshInstances(this._meshInstances);
        }
      }
    }
  }

  onRemoveChild() {
    this.removeFromLayers();
  }

  onInsertChild() {
    if (this._meshInstances && this.enabled && this.entity.enabled) {
      this.addToLayers();
    }
  }
  onRemove() {
    this.destroyMeshInstances();
    this.asset = null;
    this.materialAsset = null;
    this._assetReference.id = null;
    for (let i = 0; i < this._materialReferences.length; i++) {
      this._materialReferences[i].id = null;
    }
    this.entity.off('remove', this.onRemoveChild, this);
    this.entity.off('insert', this.onInsertChild, this);
  }
  onLayersChanged(oldComp, newComp) {
    this.addToLayers();
    oldComp.off('add', this.onLayerAdded, this);
    oldComp.off('remove', this.onLayerRemoved, this);
    newComp.on('add', this.onLayerAdded, this);
    newComp.on('remove', this.onLayerRemoved, this);
  }
  onLayerAdded(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.addMeshInstances(this._meshInstances);
  }
  onLayerRemoved(layer) {
    const index = this.layers.indexOf(layer.id);
    if (index < 0) return;
    layer.removeMeshInstances(this._meshInstances);
  }
  onEnable() {
    const app = this.system.app;
    const scene = app.scene;
    this._rootBone.onParentComponentEnable();
    this._cloneSkinInstances();
    scene.on('set:layers', this.onLayersChanged, this);
    if (scene.layers) {
      scene.layers.on('add', this.onLayerAdded, this);
      scene.layers.on('remove', this.onLayerRemoved, this);
    }
    const isAsset = this._type === 'asset';
    if (this._meshInstances && this._meshInstances.length) {
      this.addToLayers();
    } else if (isAsset && this.asset) {
      this._onRenderAssetAdded();
    }

    for (let i = 0; i < this._materialReferences.length; i++) {
      if (this._materialReferences[i].asset) {
        this.system.app.assets.load(this._materialReferences[i].asset);
      }
    }
    if (this._batchGroupId >= 0) {
      var _app$batcher;
      (_app$batcher = app.batcher) == null ? void 0 : _app$batcher.insert(BatchGroup.RENDER, this.batchGroupId, this.entity);
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
      (_app$batcher2 = app.batcher) == null ? void 0 : _app$batcher2.remove(BatchGroup.RENDER, this.batchGroupId, this.entity);
    }
    this.removeFromLayers();
  }

  hide() {
    if (this._meshInstances) {
      for (let i = 0; i < this._meshInstances.length; i++) {
        this._meshInstances[i].visible = false;
      }
    }
  }

  show() {
    if (this._meshInstances) {
      for (let i = 0; i < this._meshInstances.length; i++) {
        this._meshInstances[i].visible = true;
      }
    }
  }
  _onRenderAssetAdded() {
    if (!this._assetReference.asset) return;
    if (this._assetReference.asset.resource) {
      this._onRenderAssetLoad();
    } else if (this.enabled && this.entity.enabled) {
      this.system.app.assets.load(this._assetReference.asset);
    }
  }
  _onRenderAssetLoad() {
    this.destroyMeshInstances();
    if (this._assetReference.asset) {
      const render = this._assetReference.asset.resource;
      render.off('set:meshes', this._onSetMeshes, this);
      render.on('set:meshes', this._onSetMeshes, this);
      if (render.meshes) {
        this._onSetMeshes(render.meshes);
      }
    }
  }
  _onSetMeshes(meshes) {
    this._cloneMeshes(meshes);
  }
  _clearSkinInstances() {
    for (let i = 0; i < this._meshInstances.length; i++) {
      const meshInstance = this._meshInstances[i];

      SkinInstanceCache.removeCachedSkinInstance(meshInstance.skinInstance);
      meshInstance.skinInstance = null;
    }
  }
  _cloneSkinInstances() {
    if (this._meshInstances.length && this._rootBone.entity instanceof GraphNode) {
      for (let i = 0; i < this._meshInstances.length; i++) {
        const meshInstance = this._meshInstances[i];
        const mesh = meshInstance.mesh;

        if (mesh.skin && !meshInstance.skinInstance) {
          meshInstance.skinInstance = SkinInstanceCache.createCachedSkinInstance(mesh.skin, this._rootBone.entity, this.entity);
        }
      }
    }
  }
  _cloneMeshes(meshes) {
    if (meshes && meshes.length) {
      const meshInstances = [];
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i];
        const material = this._materialReferences[i] && this._materialReferences[i].asset && this._materialReferences[i].asset.resource;
        const meshInst = new MeshInstance(mesh, material || this.system.defaultMaterial, this.entity);
        meshInstances.push(meshInst);

        if (mesh.morph) {
          meshInst.morphInstance = new MorphInstance(mesh.morph);
        }
      }
      this.meshInstances = meshInstances;

      this._cloneSkinInstances();
    }
  }
  _onRenderAssetUnload() {
    if (this._type === 'asset') {
      this.destroyMeshInstances();
    }
  }
  _onRenderAssetRemove() {
    if (this._assetReference.asset && this._assetReference.asset.resource) {
      this._assetReference.asset.resource.off('set:meshes', this._onSetMeshes, this);
    }
    this._onRenderAssetUnload();
  }
  _onMaterialAdded(index, component, asset) {
    if (asset.resource) {
      this._onMaterialLoad(index, component, asset);
    } else {
      if (this.enabled && this.entity.enabled) {
        this.system.app.assets.load(asset);
      }
    }
  }
  _updateMainMaterial(index, material) {
    if (index === 0) {
      this.material = material;
    }
  }
  _onMaterialLoad(index, component, asset) {
    if (this._meshInstances[index]) {
      this._meshInstances[index].material = asset.resource;
    }
    this._updateMainMaterial(index, asset.resource);
  }
  _onMaterialRemove(index, component, asset) {
    if (this._meshInstances[index]) {
      this._meshInstances[index].material = this.system.defaultMaterial;
    }
    this._updateMainMaterial(index, this.system.defaultMaterial);
  }
  _onMaterialUnload(index, component, asset) {
    if (this._meshInstances[index]) {
      this._meshInstances[index].material = this.system.defaultMaterial;
    }
    this._updateMainMaterial(index, this.system.defaultMaterial);
  }
  resolveDuplicatedEntityReferenceProperties(oldRender, duplicatedIdsMap) {
    if (oldRender.rootBone && duplicatedIdsMap[oldRender.rootBone]) {
      this.rootBone = duplicatedIdsMap[oldRender.rootBone];
    }
    this._clearSkinInstances();
  }
}

export { RenderComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmVuZGVyL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX1dPUkxELCBSRU5ERVJTVFlMRV9TT0xJRCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBNb3JwaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9ycGgtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgZ2V0U2hhcGVQcmltaXRpdmUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9wcm9jZWR1cmFsLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgU2tpbkluc3RhbmNlQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9za2luLWluc3RhbmNlLWNhY2hlLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5pbXBvcnQgeyBBc3NldFJlZmVyZW5jZSB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LXJlZmVyZW5jZS5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eVJlZmVyZW5jZSB9IGZyb20gJy4uLy4uL3V0aWxzL2VudGl0eS1yZWZlcmVuY2UuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9IE1hdGVyaWFsICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnKS5Cb3VuZGluZ0JveH0gQm91bmRpbmdCb3ggKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IEVudGl0eSAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuUmVuZGVyQ29tcG9uZW50U3lzdGVtfSBSZW5kZXJDb21wb25lbnRTeXN0ZW0gKi9cblxuLyoqXG4gKiBFbmFibGVzIGFuIEVudGl0eSB0byByZW5kZXIgYSB7QGxpbmsgTWVzaH0gb3IgYSBwcmltaXRpdmUgc2hhcGUuIFRoaXMgY29tcG9uZW50IGF0dGFjaGVzXG4gKiB7QGxpbmsgTWVzaEluc3RhbmNlfSBnZW9tZXRyeSB0byB0aGUgRW50aXR5LlxuICpcbiAqIEBwcm9wZXJ0eSB7RW50aXR5fSByb290Qm9uZSBBIHJlZmVyZW5jZSB0byB0aGUgZW50aXR5IHRvIGJlIHVzZWQgYXMgdGhlIHJvb3QgYm9uZSBmb3IgYW55XG4gKiBza2lubmVkIG1lc2hlcyB0aGF0IGFyZSByZW5kZXJlZCBieSB0aGlzIGNvbXBvbmVudC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgUmVuZGVyQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfdHlwZSA9ICdhc3NldCc7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfY2FzdFNoYWRvd3MgPSB0cnVlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3JlY2VpdmVTaGFkb3dzID0gdHJ1ZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9jYXN0U2hhZG93c0xpZ2h0bWFwID0gdHJ1ZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saWdodG1hcHBlZCA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSAxO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2lzU3RhdGljID0gZmFsc2U7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfYmF0Y2hHcm91cElkID0gLTE7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbGF5ZXJzID0gW0xBWUVSSURfV09STERdOyAvLyBhc3NpZ24gdG8gdGhlIGRlZmF1bHQgd29ybGQgbGF5ZXJcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9yZW5kZXJTdHlsZSA9IFJFTkRFUlNUWUxFX1NPTElEO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge01lc2hJbnN0YW5jZVtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21lc2hJbnN0YW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtCb3VuZGluZ0JveHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2N1c3RvbUFhYmIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVXNlZCBieSBsaWdodG1hcHBlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHt7eDogbnVtYmVyLCB5OiBudW1iZXIsIHo6IG51bWJlciwgdXY6IG51bWJlcn18bnVsbH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2FyZWEgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Fzc2V0UmVmZXJlbmNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Fzc2V0UmVmZXJlbmNlID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXNzZXRSZWZlcmVuY2VbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRlcmlhbFJlZmVyZW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIE1hdGVyaWFsIHVzZWQgdG8gcmVuZGVyIG1lc2hlcyBvdGhlciB0aGFuIGFzc2V0IHR5cGUuIEl0IGdldHMgcHJpb3JpdHkgd2hlbiBzZXQgdG9cbiAgICAgKiBzb21ldGhpbmcgZWxzZSB0aGFuIGRlZmF1bHRNYXRlcmlhbCwgb3RoZXJ3aXNlIG1hdGVyaWFsQVNzZXRzWzBdIGlzIHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWF0ZXJpYWx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7RW50aXR5UmVmZXJlbmNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3Jvb3RCb25lO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFJlbmRlckNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7UmVuZGVyQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXQgY3JlYXRlZCB0aGlzIENvbXBvbmVudC5cbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICAvLyB0aGUgZW50aXR5IHRoYXQgcmVwcmVzZW50cyB0aGUgcm9vdCBib25lIGlmIHRoaXMgcmVuZGVyIGNvbXBvbmVudCBoYXMgc2tpbm5lZCBtZXNoZXNcbiAgICAgICAgdGhpcy5fcm9vdEJvbmUgPSBuZXcgRW50aXR5UmVmZXJlbmNlKHRoaXMsICdyb290Qm9uZScpO1xuICAgICAgICB0aGlzLl9yb290Qm9uZS5vbignc2V0OmVudGl0eScsIHRoaXMuX29uU2V0Um9vdEJvbmUsIHRoaXMpO1xuXG4gICAgICAgIC8vIHJlbmRlciBhc3NldCByZWZlcmVuY2VcbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UgPSBuZXcgQXNzZXRSZWZlcmVuY2UoXG4gICAgICAgICAgICAnYXNzZXQnLFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIHN5c3RlbS5hcHAuYXNzZXRzLCB7XG4gICAgICAgICAgICAgICAgYWRkOiB0aGlzLl9vblJlbmRlckFzc2V0QWRkZWQsXG4gICAgICAgICAgICAgICAgbG9hZDogdGhpcy5fb25SZW5kZXJBc3NldExvYWQsXG4gICAgICAgICAgICAgICAgcmVtb3ZlOiB0aGlzLl9vblJlbmRlckFzc2V0UmVtb3ZlLFxuICAgICAgICAgICAgICAgIHVubG9hZDogdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRoaXNcbiAgICAgICAgKTtcblxuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG5cbiAgICAgICAgLy8gaGFuZGxlIGV2ZW50cyB3aGVuIHRoZSBlbnRpdHkgaXMgZGlyZWN0bHkgKG9yIGluZGlyZWN0bHkgYXMgYSBjaGlsZCBvZiBzdWItaGllcmFyY2h5KVxuICAgICAgICAvLyBhZGRlZCBvciByZW1vdmVkIGZyb20gdGhlIHBhcmVudFxuICAgICAgICBlbnRpdHkub24oJ3JlbW92ZScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbigncmVtb3ZlaGllcmFyY2h5JywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdpbnNlcnQnLCB0aGlzLm9uSW5zZXJ0Q2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ2luc2VydGhpZXJhcmNoeScsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHJlbmRlcmluZyBvZiBhbGwge0BsaW5rIE1lc2hJbnN0YW5jZX1zIHRvIHRoZSBzcGVjaWZpZWQgcmVuZGVyIHN0eWxlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH1cbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9XSVJFRlJBTUV9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfUE9JTlRTfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFJFTkRFUlNUWUxFX1NPTElEfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlbmRlclN0eWxlKHJlbmRlclN0eWxlKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJTdHlsZSAhPT0gcmVuZGVyU3R5bGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG4gICAgICAgICAgICBNZXNoSW5zdGFuY2UuX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5KHRoaXMuX21lc2hJbnN0YW5jZXMsIHJlbmRlclN0eWxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZW5kZXJTdHlsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclN0eWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHNldCwgdGhlIG9iamVjdCBzcGFjZSBib3VuZGluZyBib3ggaXMgdXNlZCBhcyBhIGJvdW5kaW5nIGJveCBmb3IgdmlzaWJpbGl0eSBjdWxsaW5nIG9mXG4gICAgICogYXR0YWNoZWQgbWVzaCBpbnN0YW5jZXMuIFRoaXMgaXMgYW4gb3B0aW1pemF0aW9uLCBhbGxvd2luZyBvdmVyc2l6ZWQgYm91bmRpbmcgYm94IHRvIGJlXG4gICAgICogc3BlY2lmaWVkIGZvciBza2lubmVkIGNoYXJhY3RlcnMgaW4gb3JkZXIgdG8gYXZvaWQgcGVyIGZyYW1lIGJvdW5kaW5nIGJveCBjb21wdXRhdGlvbnMgYmFzZWRcbiAgICAgKiBvbiBib25lIHBvc2l0aW9ucy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtCb3VuZGluZ0JveH1cbiAgICAgKi9cbiAgICBzZXQgY3VzdG9tQWFiYih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gdmFsdWU7XG5cbiAgICAgICAgLy8gc2V0IGl0IG9uIG1lc2hJbnN0YW5jZXNcbiAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBtaVtpXS5zZXRDdXN0b21BYWJiKHRoaXMuX2N1c3RvbUFhYmIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGN1c3RvbUFhYmIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdXN0b21BYWJiO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHRoZSByZW5kZXIuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0gXCJhc3NldFwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgcmVuZGVyIGFzc2V0XG4gICAgICogLSBcImJveFwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgYm94ICgxIHVuaXQgaW4gZWFjaCBkaW1lbnNpb24pXG4gICAgICogLSBcImNhcHN1bGVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGNhcHN1bGUgKHJhZGl1cyAwLjUsIGhlaWdodCAyKVxuICAgICAqIC0gXCJjb25lXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBjb25lIChyYWRpdXMgMC41LCBoZWlnaHQgMSlcbiAgICAgKiAtIFwiY3lsaW5kZXJcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGN5bGluZGVyIChyYWRpdXMgMC41LCBoZWlnaHQgMSlcbiAgICAgKiAtIFwicGxhbmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIHBsYW5lICgxIHVuaXQgaW4gZWFjaCBkaW1lbnNpb24pXG4gICAgICogLSBcInNwaGVyZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgc3BoZXJlIChyYWRpdXMgMC41KVxuICAgICAqIC0gXCJ0b3J1c1wiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgdG9ydXMgKHR1YmVSYWRpdXM6IDAuMiwgcmluZ1JhZGl1czogMC4zKVxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzZXQgdHlwZSh2YWx1ZSkge1xuXG4gICAgICAgIGlmICh0aGlzLl90eXBlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fYXJlYSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG5cbiAgICAgICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcblxuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICAgICAgbGV0IG1hdGVyaWFsID0gdGhpcy5fbWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgaWYgKCFtYXRlcmlhbCB8fCBtYXRlcmlhbCA9PT0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsID0gdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzWzBdICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1swXS5hc3NldCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbMF0uYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcHJpbURhdGEgPSBnZXRTaGFwZVByaW1pdGl2ZSh0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2UsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hcmVhID0gcHJpbURhdGEuYXJlYTtcbiAgICAgICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZXMgPSBbbmV3IE1lc2hJbnN0YW5jZShwcmltRGF0YS5tZXNoLCBtYXRlcmlhbCB8fCB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwsIHRoaXMuZW50aXR5KV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbWVzaEluc3RhbmNlcyBjb250YWluZWQgaW4gdGhlIGNvbXBvbmVudC4gSWYgbWVzaGVzIGFyZSBub3Qgc2V0IG9yIGxvYWRlZCBmb3JcbiAgICAgKiBjb21wb25lbnQgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNZXNoSW5zdGFuY2VbXX1cbiAgICAgKi9cbiAgICBzZXQgbWVzaEluc3RhbmNlcyh2YWx1ZSkge1xuXG4gICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcblxuICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMpIHtcblxuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgbWVzaCBpbnN0YW5jZSB3YXMgY3JlYXRlZCB3aXRob3V0IGEgbm9kZSwgYXNzaWduIGl0IGhlcmVcbiAgICAgICAgICAgICAgICBpZiAoIW1pW2ldLm5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0ubm9kZSA9IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1pW2ldLmNhc3RTaGFkb3cgPSB0aGlzLl9jYXN0U2hhZG93cztcbiAgICAgICAgICAgICAgICBtaVtpXS5yZWNlaXZlU2hhZG93ID0gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWlbaV0uaXNTdGF0aWMgPSB0aGlzLl9pc1N0YXRpYztcbiAgICAgICAgICAgICAgICBtaVtpXS5yZW5kZXJTdHlsZSA9IHRoaXMuX3JlbmRlclN0eWxlO1xuICAgICAgICAgICAgICAgIG1pW2ldLnNldExpZ2h0bWFwcGVkKHRoaXMuX2xpZ2h0bWFwcGVkKTtcbiAgICAgICAgICAgICAgICBtaVtpXS5zZXRDdXN0b21BYWJiKHRoaXMuX2N1c3RvbUFhYmIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvTGF5ZXJzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWVzaEluc3RhbmNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlIG1lc2hlcyB3aWxsIGJlIGxpZ2h0bWFwcGVkIGFmdGVyIHVzaW5nIGxpZ2h0bWFwcGVyLmJha2UoKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcHBlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2xpZ2h0bWFwcGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodG1hcHBlZCA9IHZhbHVlO1xuXG4gICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLnNldExpZ2h0bWFwcGVkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBwZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcHBlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBhdHRhY2hlZCBtZXNoZXMgd2lsbCBjYXN0IHNoYWRvd3MgZm9yIGxpZ2h0cyB0aGF0IGhhdmUgc2hhZG93IGNhc3RpbmcgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjYXN0U2hhZG93cyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY2FzdFNoYWRvd3MgIT09IHZhbHVlKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5sYXllcnM7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmU7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzICYmICF2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBzY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZVNoYWRvd0Nhc3RlcnMobWkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5jYXN0U2hhZG93ID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9jYXN0U2hhZG93cyAmJiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBzY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKGxheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5hZGRTaGFkb3dDYXN0ZXJzKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3MgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjYXN0U2hhZG93cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nhc3RTaGFkb3dzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHNoYWRvd3Mgd2lsbCBiZSBjYXN0IG9uIGF0dGFjaGVkIG1lc2hlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCByZWNlaXZlU2hhZG93cyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fcmVjZWl2ZVNoYWRvd3MgIT09IHZhbHVlKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX3JlY2VpdmVTaGFkb3dzID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0ucmVjZWl2ZVNoYWRvdyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZWNlaXZlU2hhZG93cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlY2VpdmVTaGFkb3dzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBtZXNoZXMgd2lsbCBjYXN0IHNoYWRvd3Mgd2hlbiByZW5kZXJpbmcgbGlnaHRtYXBzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNhc3RTaGFkb3dzTGlnaHRtYXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3NMaWdodG1hcCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjYXN0U2hhZG93c0xpZ2h0bWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FzdFNoYWRvd3NMaWdodG1hcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaWdodG1hcCByZXNvbHV0aW9uIG11bHRpcGxpZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcFNpemVNdWx0aXBsaWVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBTaXplTXVsdGlwbGllcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFyayBtZXNoZXMgYXMgbm9uLW1vdmFibGUgKG9wdGltaXphdGlvbikuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgaXNTdGF0aWModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2lzU3RhdGljICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5faXNTdGF0aWMgPSB2YWx1ZTtcblxuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5pc1N0YXRpYyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpc1N0YXRpYygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lzU3RhdGljO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhlIG1lc2hlcyBzaG91bGQgYmVsb25nLiBEb24ndCBwdXNoLCBwb3AsXG4gICAgICogc3BsaWNlIG9yIG1vZGlmeSB0aGlzIGFycmF5LCBpZiB5b3Ugd2FudCB0byBjaGFuZ2UgaXQgLSBzZXQgYSBuZXcgb25lIGluc3RlYWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IGxheWVycyh2YWx1ZSkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBsZXQgbGF5ZXI7XG5cbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSBhbGwgbWVzaCBpbnN0YW5jZXMgZnJvbSBvbGQgbGF5ZXJzXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMuX21lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCB0aGUgbGF5ZXIgbGlzdFxuICAgICAgICB0aGlzLl9sYXllcnMubGVuZ3RoID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fbGF5ZXJzW2ldID0gdmFsdWVbaV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkb24ndCBhZGQgaW50byBsYXllcnMgdW50aWwgd2UncmUgZW5hYmxlZFxuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCB8fCAhdGhpcy5fbWVzaEluc3RhbmNlcykgcmV0dXJuO1xuXG4gICAgICAgIC8vIGFkZCBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gbmV3IGxheWVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMuX21lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxheWVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVycztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NpZ24gbWVzaGVzIHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCAhPT0gdmFsdWUpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuUkVOREVSLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdmFsdWUgPj0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5SRU5ERVIsIHZhbHVlLCB0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSA8IDAgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAvLyByZS1hZGQgcmVuZGVyIHRvIHNjZW5lLCBpbiBjYXNlIGl0IHdhcyByZW1vdmVkIGJ5IGJhdGNoaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBiYXRjaEdyb3VwSWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iYXRjaEdyb3VwSWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIHtAbGluayBNYXRlcmlhbH0gdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIHRoZSBtZXNoZXMgKG5vdCB1c2VkIG9uIHJlbmRlcnMgb2ZcbiAgICAgKiB0eXBlICdhc3NldCcpLlxuICAgICAqXG4gICAgICogQHR5cGUge01hdGVyaWFsfVxuICAgICAqL1xuICAgIHNldCBtYXRlcmlhbCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWwgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHZhbHVlO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcyAmJiB0aGlzLl90eXBlICE9PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWwgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF0ZXJpYWwgYXNzZXRzIHRoYXQgd2lsbCBiZSB1c2VkIHRvIHJlbmRlciB0aGUgbWVzaGVzLiBFYWNoIG1hdGVyaWFsIGNvcnJlc3BvbmRzIHRvIHRoZVxuICAgICAqIHJlc3BlY3RpdmUgbWVzaCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBc3NldFtdfG51bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBtYXRlcmlhbEFzc2V0cyh2YWx1ZSA9IFtdKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoID4gdmFsdWUubGVuZ3RoKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdmFsdWUubGVuZ3RoOyBpIDwgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmlkID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5sZW5ndGggPSB2YWx1ZS5sZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICBuZXcgQXNzZXRSZWZlcmVuY2UoXG4gICAgICAgICAgICAgICAgICAgICAgICBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhZGQ6IHRoaXMuX29uTWF0ZXJpYWxBZGRlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2FkOiB0aGlzLl9vbk1hdGVyaWFsTG9hZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZW1vdmU6IHRoaXMuX29uTWF0ZXJpYWxSZW1vdmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5sb2FkOiB0aGlzLl9vbk1hdGVyaWFsVW5sb2FkXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpc1xuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZhbHVlW2ldKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSB2YWx1ZVtpXSBpbnN0YW5jZW9mIEFzc2V0ID8gdmFsdWVbaV0uaWQgOiB2YWx1ZVtpXTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmlkICE9PSBpZCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgPSBpZDtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX29uTWF0ZXJpYWxBZGRlZChpLCB0aGlzLCB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmlkID0gbnVsbDtcblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaV0ubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsQXNzZXRzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLm1hcChmdW5jdGlvbiAocmVmKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVmLmlkO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgcmVuZGVyIGFzc2V0IGZvciB0aGUgcmVuZGVyIGNvbXBvbmVudCAob25seSBhcHBsaWVzIHRvIHR5cGUgJ2Fzc2V0JykgLSBjYW4gYWxzbyBiZSBhblxuICAgICAqIGFzc2V0IGlkLlxuICAgICAqXG4gICAgICogQHR5cGUge0Fzc2V0fG51bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYXNzZXQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgaWQgPSB2YWx1ZSBpbnN0YW5jZW9mIEFzc2V0ID8gdmFsdWUuaWQgOiB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmlkID09PSBpZCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCAmJiB0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldFJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQgPSBpZDtcblxuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRBZGRlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGFzc2V0KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIGFzc2V0IGlkIHRvIHRoZSBjb21wb25lbnQsIHdpdGhvdXQgdXBkYXRpbmcgdGhlIGNvbXBvbmVudCB3aXRoIHRoZSBuZXcgYXNzZXQuXG4gICAgICogVGhpcyBjYW4gYmUgdXNlZCB0byBhc3NpZ24gdGhlIGFzc2V0IGlkIHRvIGFscmVhZHkgZnVsbHkgY3JlYXRlZCBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Fzc2V0fG51bWJlcn0gYXNzZXQgLSBUaGUgcmVuZGVyIGFzc2V0IG9yIGFzc2V0IGlkIHRvIGFzc2lnbi5cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXNzaWduQXNzZXQoYXNzZXQpIHtcbiAgICAgICAgY29uc3QgaWQgPSBhc3NldCBpbnN0YW5jZW9mIEFzc2V0ID8gYXNzZXQuaWQgOiBhc3NldDtcbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQgPSBpZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge0VudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eSBzZXQgYXMgdGhlIHJvb3QgYm9uZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vblNldFJvb3RCb25lKGVudGl0eSkge1xuICAgICAgICBpZiAoZW50aXR5KSB7XG4gICAgICAgICAgICB0aGlzLl9vblJvb3RCb25lQ2hhbmdlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uUm9vdEJvbmVDaGFuZ2VkKCkge1xuICAgICAgICAvLyByZW1vdmUgZXhpc3Rpbmcgc2tpbiBpbnN0YW5jZXMgYW5kIGNyZWF0ZSBuZXcgb25lcywgY29ubmVjdGVkIHRvIG5ldyByb290IGJvbmVcbiAgICAgICAgdGhpcy5fY2xlYXJTa2luSW5zdGFuY2VzKCk7XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fY2xvbmVTa2luSW5zdGFuY2VzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBkZXN0cm95TWVzaEluc3RhbmNlcygpIHtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlRnJvbUxheWVycygpO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IG1lc2ggaW5zdGFuY2VzIHNlcGFyYXRlbHkgdG8gYWxsb3cgdGhlbSB0byBiZSByZW1vdmVkIGZyb20gdGhlIGNhY2hlXG4gICAgICAgICAgICB0aGlzLl9jbGVhclNraW5JbnN0YW5jZXMoKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aCA9IDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBhZGRUb0xheWVycygpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUZyb21MYXllcnMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzICYmIHRoaXMuX21lc2hJbnN0YW5jZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBvblJlbW92ZUNoaWxkKCkge1xuICAgICAgICB0aGlzLnJlbW92ZUZyb21MYXllcnMoKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBvbkluc2VydENoaWxkKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcyAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcblxuICAgICAgICB0aGlzLmFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYXRlcmlhbEFzc2V0ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZS5pZCA9IG51bGw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ3JlbW92ZScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuZW50aXR5Lm9mZignaW5zZXJ0JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICB0aGlzLmFkZFRvTGF5ZXJzKCk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMuX21lc2hJbnN0YW5jZXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICB0aGlzLl9yb290Qm9uZS5vblBhcmVudENvbXBvbmVudEVuYWJsZSgpO1xuXG4gICAgICAgIHRoaXMuX2Nsb25lU2tpbkluc3RhbmNlcygpO1xuXG4gICAgICAgIHNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAoc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc0Fzc2V0ID0gKHRoaXMuX3R5cGUgPT09ICdhc3NldCcpO1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcyAmJiB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzQXNzZXQgJiYgdGhpcy5hc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldEFkZGVkKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb2FkIG1hdGVyaWFsc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5hc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZCh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuUkVOREVSLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gYXBwLnNjZW5lO1xuXG4gICAgICAgIHNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIGFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5SRU5ERVIsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlbW92ZUZyb21MYXllcnMoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wIHJlbmRlcmluZyB7QGxpbmsgTWVzaEluc3RhbmNlfXMgd2l0aG91dCByZW1vdmluZyB0aGVtIGZyb20gdGhlIHNjZW5lIGhpZXJhcmNoeS4gVGhpc1xuICAgICAqIG1ldGhvZCBzZXRzIHRoZSB7QGxpbmsgTWVzaEluc3RhbmNlI3Zpc2libGV9IHByb3BlcnR5IG9mIGV2ZXJ5IE1lc2hJbnN0YW5jZSB0byBmYWxzZS4gTm90ZSxcbiAgICAgKiB0aGlzIGRvZXMgbm90IHJlbW92ZSB0aGUgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGUgc2NlbmUgaGllcmFyY2h5IG9yIGRyYXcgY2FsbCBsaXN0LiBTbyB0aGVcbiAgICAgKiByZW5kZXIgY29tcG9uZW50IHN0aWxsIGluY3VycyBzb21lIENQVSBvdmVyaGVhZC5cbiAgICAgKi9cbiAgICBoaWRlKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpXS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgcmVuZGVyaW5nIG9mIHRoZSBjb21wb25lbnQncyB7QGxpbmsgTWVzaEluc3RhbmNlfXMgaWYgaGlkZGVuIHVzaW5nXG4gICAgICoge0BsaW5rIFJlbmRlckNvbXBvbmVudCNoaWRlfS4gVGhpcyBtZXRob2Qgc2V0cyB0aGUge0BsaW5rIE1lc2hJbnN0YW5jZSN2aXNpYmxlfSBwcm9wZXJ0eSBvblxuICAgICAqIGFsbCBtZXNoIGluc3RhbmNlcyB0byB0cnVlLlxuICAgICAqL1xuICAgIHNob3coKSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzW2ldLnZpc2libGUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRBZGRlZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldExvYWQoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0TG9hZCgpIHtcblxuICAgICAgICAvLyByZW1vdmUgZXhpc3RpbmcgaW5zdGFuY2VzXG4gICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcblxuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlciA9IHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgcmVuZGVyLm9mZignc2V0Om1lc2hlcycsIHRoaXMuX29uU2V0TWVzaGVzLCB0aGlzKTtcbiAgICAgICAgICAgIHJlbmRlci5vbignc2V0Om1lc2hlcycsIHRoaXMuX29uU2V0TWVzaGVzLCB0aGlzKTtcbiAgICAgICAgICAgIGlmIChyZW5kZXIubWVzaGVzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb25TZXRNZXNoZXMocmVuZGVyLm1lc2hlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25TZXRNZXNoZXMobWVzaGVzKSB7XG4gICAgICAgIHRoaXMuX2Nsb25lTWVzaGVzKG1lc2hlcyk7XG4gICAgfVxuXG4gICAgX2NsZWFyU2tpbkluc3RhbmNlcygpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHRoaXMuX21lc2hJbnN0YW5jZXNbaV07XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBpdCBmcm9tIHRoZSBjYWNoZVxuICAgICAgICAgICAgU2tpbkluc3RhbmNlQ2FjaGUucmVtb3ZlQ2FjaGVkU2tpbkluc3RhbmNlKG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY2xvbmVTa2luSW5zdGFuY2VzKCkge1xuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aCAmJiB0aGlzLl9yb290Qm9uZS5lbnRpdHkgaW5zdGFuY2VvZiBHcmFwaE5vZGUpIHtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gdGhpcy5fbWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gbWVzaEluc3RhbmNlLm1lc2g7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBza2lubmVkIGJ1dCBkb2VzIG5vdCBoYXZlIGluc3RhbmNlIGNyZWF0ZWQgeWV0XG4gICAgICAgICAgICAgICAgaWYgKG1lc2guc2tpbiAmJiAhbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlID0gU2tpbkluc3RhbmNlQ2FjaGUuY3JlYXRlQ2FjaGVkU2tpbkluc3RhbmNlKG1lc2guc2tpbiwgdGhpcy5fcm9vdEJvbmUuZW50aXR5LCB0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Nsb25lTWVzaGVzKG1lc2hlcykge1xuXG4gICAgICAgIGlmIChtZXNoZXMgJiYgbWVzaGVzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICAvLyBjbG9uZWQgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBbXTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIC8vIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gbWVzaGVzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldICYmIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5hc3NldCAmJiB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3QgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIG1hdGVyaWFsIHx8IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMucHVzaChtZXNoSW5zdCk7XG5cbiAgICAgICAgICAgICAgICAvLyBtb3JwaCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGlmIChtZXNoLm1vcnBoKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0Lm1vcnBoSW5zdGFuY2UgPSBuZXcgTW9ycGhJbnN0YW5jZShtZXNoLm1vcnBoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlcyA9IG1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIC8vIHRyeSB0byBjcmVhdGUgc2tpbiBpbnN0YW5jZXMgaWYgcm9vdEJvbmUgaGFzIGJlZW4gc2V0LCBvdGhlcndpc2UgdGhpcyBleGVjdXRlcyB3aGVuIHJvb3RCb25lIGlzIHNldCBsYXRlclxuICAgICAgICAgICAgdGhpcy5fY2xvbmVTa2luSW5zdGFuY2VzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldFVubG9hZCgpIHtcblxuICAgICAgICAvLyB3aGVuIHVubG9hZGluZyBhc3NldCwgb25seSByZW1vdmUgYXNzZXQgbWVzaCBpbnN0YW5jZXMgKHR5cGUgY291bGQgaGF2ZSBiZWVuIGFscmVhZHkgY2hhbmdlZCB0byAnYm94JyBvciBzaW1pbGFyKVxuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95TWVzaEluc3RhbmNlcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRSZW1vdmUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCAmJiB0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2Uub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TZXRNZXNoZXMsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCgpO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsQWRkZWQoaW5kZXgsIGNvbXBvbmVudCwgYXNzZXQpIHtcbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1hdGVyaWFsTG9hZChpbmRleCwgY29tcG9uZW50LCBhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgbWF0ZXJpYWwpIHtcbiAgICAgICAgLy8gZmlyc3QgbWF0ZXJpYWwgZm9yIHByaW1pdGl2ZXMgY2FuIGJlIGFjY2Vzc2VkIHVzaW5nIG1hdGVyaWFsIHByb3BlcnR5LCBzbyBzZXQgaXQgdXBcbiAgICAgICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbExvYWQoaW5kZXgsIGNvbXBvbmVudCwgYXNzZXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXNbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzW2luZGV4XS5tYXRlcmlhbCA9IGFzc2V0LnJlc291cmNlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgYXNzZXQucmVzb3VyY2UpO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsUmVtb3ZlKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzW2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0ubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdXBkYXRlTWFpbk1hdGVyaWFsKGluZGV4LCB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwpO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsVW5sb2FkKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzW2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0ubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdXBkYXRlTWFpbk1hdGVyaWFsKGluZGV4LCB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwpO1xuICAgIH1cblxuICAgIHJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyhvbGRSZW5kZXIsIGR1cGxpY2F0ZWRJZHNNYXApIHtcbiAgICAgICAgaWYgKG9sZFJlbmRlci5yb290Qm9uZSAmJiBkdXBsaWNhdGVkSWRzTWFwW29sZFJlbmRlci5yb290Qm9uZV0pIHtcbiAgICAgICAgICAgIHRoaXMucm9vdEJvbmUgPSBkdXBsaWNhdGVkSWRzTWFwW29sZFJlbmRlci5yb290Qm9uZV07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY2xlYXJTa2luSW5zdGFuY2VzKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBSZW5kZXJDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJSZW5kZXJDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl90eXBlIiwiX2Nhc3RTaGFkb3dzIiwiX3JlY2VpdmVTaGFkb3dzIiwiX2Nhc3RTaGFkb3dzTGlnaHRtYXAiLCJfbGlnaHRtYXBwZWQiLCJfbGlnaHRtYXBTaXplTXVsdGlwbGllciIsIl9pc1N0YXRpYyIsIl9iYXRjaEdyb3VwSWQiLCJfbGF5ZXJzIiwiTEFZRVJJRF9XT1JMRCIsIl9yZW5kZXJTdHlsZSIsIlJFTkRFUlNUWUxFX1NPTElEIiwiX21lc2hJbnN0YW5jZXMiLCJfY3VzdG9tQWFiYiIsIl9hcmVhIiwiX2Fzc2V0UmVmZXJlbmNlIiwiX21hdGVyaWFsUmVmZXJlbmNlcyIsIl9tYXRlcmlhbCIsIl9yb290Qm9uZSIsIkVudGl0eVJlZmVyZW5jZSIsIm9uIiwiX29uU2V0Um9vdEJvbmUiLCJBc3NldFJlZmVyZW5jZSIsImFwcCIsImFzc2V0cyIsImFkZCIsIl9vblJlbmRlckFzc2V0QWRkZWQiLCJsb2FkIiwiX29uUmVuZGVyQXNzZXRMb2FkIiwicmVtb3ZlIiwiX29uUmVuZGVyQXNzZXRSZW1vdmUiLCJ1bmxvYWQiLCJfb25SZW5kZXJBc3NldFVubG9hZCIsImRlZmF1bHRNYXRlcmlhbCIsIm9uUmVtb3ZlQ2hpbGQiLCJvbkluc2VydENoaWxkIiwicmVuZGVyU3R5bGUiLCJNZXNoSW5zdGFuY2UiLCJfcHJlcGFyZVJlbmRlclN0eWxlRm9yQXJyYXkiLCJjdXN0b21BYWJiIiwidmFsdWUiLCJtaSIsImkiLCJsZW5ndGgiLCJzZXRDdXN0b21BYWJiIiwidHlwZSIsImRlc3Ryb3lNZXNoSW5zdGFuY2VzIiwibWF0ZXJpYWwiLCJhc3NldCIsInJlc291cmNlIiwicHJpbURhdGEiLCJnZXRTaGFwZVByaW1pdGl2ZSIsImdyYXBoaWNzRGV2aWNlIiwiYXJlYSIsIm1lc2hJbnN0YW5jZXMiLCJtZXNoIiwibm9kZSIsImNhc3RTaGFkb3ciLCJyZWNlaXZlU2hhZG93IiwiaXNTdGF0aWMiLCJzZXRMaWdodG1hcHBlZCIsImVuYWJsZWQiLCJhZGRUb0xheWVycyIsImxpZ2h0bWFwcGVkIiwiY2FzdFNoYWRvd3MiLCJsYXllcnMiLCJzY2VuZSIsImxheWVyIiwiZ2V0TGF5ZXJCeUlkIiwicmVtb3ZlU2hhZG93Q2FzdGVycyIsImFkZFNoYWRvd0Nhc3RlcnMiLCJyZWNlaXZlU2hhZG93cyIsImNhc3RTaGFkb3dzTGlnaHRtYXAiLCJsaWdodG1hcFNpemVNdWx0aXBsaWVyIiwicmVtb3ZlTWVzaEluc3RhbmNlcyIsImFkZE1lc2hJbnN0YW5jZXMiLCJiYXRjaEdyb3VwSWQiLCJiYXRjaGVyIiwiQmF0Y2hHcm91cCIsIlJFTkRFUiIsImluc2VydCIsIm1hdGVyaWFsQXNzZXRzIiwiaWQiLCJwdXNoIiwiX29uTWF0ZXJpYWxBZGRlZCIsIl9vbk1hdGVyaWFsTG9hZCIsIl9vbk1hdGVyaWFsUmVtb3ZlIiwiX29uTWF0ZXJpYWxVbmxvYWQiLCJBc3NldCIsIm1hcCIsInJlZiIsImFzc2lnbkFzc2V0IiwiX29uUm9vdEJvbmVDaGFuZ2VkIiwiX2NsZWFyU2tpbkluc3RhbmNlcyIsIl9jbG9uZVNraW5JbnN0YW5jZXMiLCJyZW1vdmVGcm9tTGF5ZXJzIiwiZGVzdHJveSIsIm9uUmVtb3ZlIiwibWF0ZXJpYWxBc3NldCIsIm9mZiIsIm9uTGF5ZXJzQ2hhbmdlZCIsIm9sZENvbXAiLCJuZXdDb21wIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJpbmRleCIsImluZGV4T2YiLCJvbkVuYWJsZSIsIm9uUGFyZW50Q29tcG9uZW50RW5hYmxlIiwiaXNBc3NldCIsIm9uRGlzYWJsZSIsImhpZGUiLCJ2aXNpYmxlIiwic2hvdyIsInJlbmRlciIsIl9vblNldE1lc2hlcyIsIm1lc2hlcyIsIl9jbG9uZU1lc2hlcyIsIm1lc2hJbnN0YW5jZSIsIlNraW5JbnN0YW5jZUNhY2hlIiwicmVtb3ZlQ2FjaGVkU2tpbkluc3RhbmNlIiwic2tpbkluc3RhbmNlIiwiR3JhcGhOb2RlIiwic2tpbiIsImNyZWF0ZUNhY2hlZFNraW5JbnN0YW5jZSIsIm1lc2hJbnN0IiwibW9ycGgiLCJtb3JwaEluc3RhbmNlIiwiTW9ycGhJbnN0YW5jZSIsImNvbXBvbmVudCIsIl91cGRhdGVNYWluTWF0ZXJpYWwiLCJyZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMiLCJvbGRSZW5kZXIiLCJkdXBsaWNhdGVkSWRzTWFwIiwicm9vdEJvbmUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNEJBLE1BQU1BLGVBQWUsU0FBU0MsU0FBUyxDQUFDOztBQW9GcENDLEVBQUFBLFdBQVcsQ0FBQ0MsTUFBTSxFQUFFQyxNQUFNLEVBQUU7QUFDeEIsSUFBQSxLQUFLLENBQUNELE1BQU0sRUFBRUMsTUFBTSxDQUFDLENBQUE7O0lBQUMsSUFuRjFCQyxDQUFBQSxLQUFLLEdBQUcsT0FBTyxDQUFBO0lBQUEsSUFHZkMsQ0FBQUEsWUFBWSxHQUFHLElBQUksQ0FBQTtJQUFBLElBR25CQyxDQUFBQSxlQUFlLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFHdEJDLENBQUFBLG9CQUFvQixHQUFHLElBQUksQ0FBQTtJQUFBLElBRzNCQyxDQUFBQSxZQUFZLEdBQUcsS0FBSyxDQUFBO0lBQUEsSUFHcEJDLENBQUFBLHVCQUF1QixHQUFHLENBQUMsQ0FBQTtJQUFBLElBRzNCQyxDQUFBQSxTQUFTLEdBQUcsS0FBSyxDQUFBO0lBQUEsSUFHakJDLENBQUFBLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQUdsQkMsT0FBTyxHQUFHLENBQUNDLGFBQWEsQ0FBQyxDQUFBO0lBQUEsSUFHekJDLENBQUFBLFlBQVksR0FBR0MsaUJBQWlCLENBQUE7SUFBQSxJQU1oQ0MsQ0FBQUEsY0FBYyxHQUFHLEVBQUUsQ0FBQTtJQUFBLElBTW5CQyxDQUFBQSxXQUFXLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFRbEJDLENBQUFBLEtBQUssR0FBRyxJQUFJLENBQUE7SUFBQSxJQU1aQyxDQUFBQSxlQUFlLEdBQUcsRUFBRSxDQUFBO0lBQUEsSUFNcEJDLENBQUFBLG1CQUFtQixHQUFHLEVBQUUsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQVN4QkMsU0FBUyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0FBQUEsSUFBQSxJQUFBLENBTVRDLFNBQVMsR0FBQSxLQUFBLENBQUEsQ0FBQTtJQVlMLElBQUksQ0FBQ0EsU0FBUyxHQUFHLElBQUlDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsVUFBVSxDQUFDLENBQUE7QUFDdEQsSUFBQSxJQUFJLENBQUNELFNBQVMsQ0FBQ0UsRUFBRSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUNDLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQTs7QUFHMUQsSUFBQSxJQUFJLENBQUNOLGVBQWUsR0FBRyxJQUFJTyxjQUFjLENBQ3JDLE9BQU8sRUFDUCxJQUFJLEVBQ0p4QixNQUFNLENBQUN5QixHQUFHLENBQUNDLE1BQU0sRUFBRTtNQUNmQyxHQUFHLEVBQUUsSUFBSSxDQUFDQyxtQkFBbUI7TUFDN0JDLElBQUksRUFBRSxJQUFJLENBQUNDLGtCQUFrQjtNQUM3QkMsTUFBTSxFQUFFLElBQUksQ0FBQ0Msb0JBQW9CO01BQ2pDQyxNQUFNLEVBQUUsSUFBSSxDQUFDQyxvQkFBQUE7S0FDaEIsRUFDRCxJQUFJLENBQ1AsQ0FBQTtBQUVELElBQUEsSUFBSSxDQUFDZixTQUFTLEdBQUduQixNQUFNLENBQUNtQyxlQUFlLENBQUE7O0lBSXZDbEMsTUFBTSxDQUFDcUIsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNjLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUM3Q25DLE1BQU0sQ0FBQ3FCLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxJQUFJLENBQUNjLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUN0RG5DLE1BQU0sQ0FBQ3FCLEVBQUUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDZSxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7SUFDN0NwQyxNQUFNLENBQUNxQixFQUFFLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDZSxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDMUQsR0FBQTs7RUFhQSxJQUFJQyxXQUFXLENBQUNBLFdBQVcsRUFBRTtBQUN6QixJQUFBLElBQUksSUFBSSxDQUFDMUIsWUFBWSxLQUFLMEIsV0FBVyxFQUFFO01BQ25DLElBQUksQ0FBQzFCLFlBQVksR0FBRzBCLFdBQVcsQ0FBQTtNQUMvQkMsWUFBWSxDQUFDQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMxQixjQUFjLEVBQUV3QixXQUFXLENBQUMsQ0FBQTtBQUM5RSxLQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsSUFBSUEsV0FBVyxHQUFHO0lBQ2QsT0FBTyxJQUFJLENBQUMxQixZQUFZLENBQUE7QUFDNUIsR0FBQTs7RUFVQSxJQUFJNkIsVUFBVSxDQUFDQyxLQUFLLEVBQUU7SUFDbEIsSUFBSSxDQUFDM0IsV0FBVyxHQUFHMkIsS0FBSyxDQUFBOztBQUd4QixJQUFBLE1BQU1DLEVBQUUsR0FBRyxJQUFJLENBQUM3QixjQUFjLENBQUE7QUFDOUIsSUFBQSxJQUFJNkIsRUFBRSxFQUFFO0FBQ0osTUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0QsRUFBRSxDQUFDRSxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO1FBQ2hDRCxFQUFFLENBQUNDLENBQUMsQ0FBQyxDQUFDRSxhQUFhLENBQUMsSUFBSSxDQUFDL0IsV0FBVyxDQUFDLENBQUE7QUFDekMsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJMEIsVUFBVSxHQUFHO0lBQ2IsT0FBTyxJQUFJLENBQUMxQixXQUFXLENBQUE7QUFDM0IsR0FBQTs7RUFnQkEsSUFBSWdDLElBQUksQ0FBQ0wsS0FBSyxFQUFFO0FBRVosSUFBQSxJQUFJLElBQUksQ0FBQ3hDLEtBQUssS0FBS3dDLEtBQUssRUFBRTtNQUN0QixJQUFJLENBQUMxQixLQUFLLEdBQUcsSUFBSSxDQUFBO01BQ2pCLElBQUksQ0FBQ2QsS0FBSyxHQUFHd0MsS0FBSyxDQUFBO01BRWxCLElBQUksQ0FBQ00sb0JBQW9CLEVBQUUsQ0FBQTtNQUUzQixJQUFJTixLQUFLLEtBQUssT0FBTyxFQUFFO0FBQ25CLFFBQUEsSUFBSU8sUUFBUSxHQUFHLElBQUksQ0FBQzlCLFNBQVMsQ0FBQTtRQUM3QixJQUFJLENBQUM4QixRQUFRLElBQUlBLFFBQVEsS0FBSyxJQUFJLENBQUNqRCxNQUFNLENBQUNtQyxlQUFlLEVBQUU7VUFDdkRjLFFBQVEsR0FBRyxJQUFJLENBQUMvQixtQkFBbUIsQ0FBQyxDQUFDLENBQUMsSUFDMUIsSUFBSSxDQUFDQSxtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQ2dDLEtBQUssSUFDakMsSUFBSSxDQUFDaEMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUNnQyxLQUFLLENBQUNDLFFBQVEsQ0FBQTtBQUMxRCxTQUFBO0FBRUEsUUFBQSxNQUFNQyxRQUFRLEdBQUdDLGlCQUFpQixDQUFDLElBQUksQ0FBQ3JELE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQzZCLGNBQWMsRUFBRVosS0FBSyxDQUFDLENBQUE7QUFDekUsUUFBQSxJQUFJLENBQUMxQixLQUFLLEdBQUdvQyxRQUFRLENBQUNHLElBQUksQ0FBQTtRQUMxQixJQUFJLENBQUNDLGFBQWEsR0FBRyxDQUFDLElBQUlqQixZQUFZLENBQUNhLFFBQVEsQ0FBQ0ssSUFBSSxFQUFFUixRQUFRLElBQUksSUFBSSxDQUFDakQsTUFBTSxDQUFDbUMsZUFBZSxFQUFFLElBQUksQ0FBQ2xDLE1BQU0sQ0FBQyxDQUFDLENBQUE7QUFDaEgsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJOEMsSUFBSSxHQUFHO0lBQ1AsT0FBTyxJQUFJLENBQUM3QyxLQUFLLENBQUE7QUFDckIsR0FBQTs7RUFRQSxJQUFJc0QsYUFBYSxDQUFDZCxLQUFLLEVBQUU7SUFFckIsSUFBSSxDQUFDTSxvQkFBb0IsRUFBRSxDQUFBO0lBRTNCLElBQUksQ0FBQ2xDLGNBQWMsR0FBRzRCLEtBQUssQ0FBQTtJQUUzQixJQUFJLElBQUksQ0FBQzVCLGNBQWMsRUFBRTtBQUVyQixNQUFBLE1BQU02QixFQUFFLEdBQUcsSUFBSSxDQUFDN0IsY0FBYyxDQUFBO0FBQzlCLE1BQUEsS0FBSyxJQUFJOEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxFQUFFLENBQUNFLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFHaEMsUUFBQSxJQUFJLENBQUNELEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNjLElBQUksRUFBRTtVQUNiZixFQUFFLENBQUNDLENBQUMsQ0FBQyxDQUFDYyxJQUFJLEdBQUcsSUFBSSxDQUFDekQsTUFBTSxDQUFBO0FBQzVCLFNBQUE7UUFFQTBDLEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNlLFVBQVUsR0FBRyxJQUFJLENBQUN4RCxZQUFZLENBQUE7UUFDcEN3QyxFQUFFLENBQUNDLENBQUMsQ0FBQyxDQUFDZ0IsYUFBYSxHQUFHLElBQUksQ0FBQ3hELGVBQWUsQ0FBQTtRQUMxQ3VDLEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNpQixRQUFRLEdBQUcsSUFBSSxDQUFDckQsU0FBUyxDQUFBO1FBQy9CbUMsRUFBRSxDQUFDQyxDQUFDLENBQUMsQ0FBQ04sV0FBVyxHQUFHLElBQUksQ0FBQzFCLFlBQVksQ0FBQTtRQUNyQytCLEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNrQixjQUFjLENBQUMsSUFBSSxDQUFDeEQsWUFBWSxDQUFDLENBQUE7UUFDdkNxQyxFQUFFLENBQUNDLENBQUMsQ0FBQyxDQUFDRSxhQUFhLENBQUMsSUFBSSxDQUFDL0IsV0FBVyxDQUFDLENBQUE7QUFDekMsT0FBQTtNQUVBLElBQUksSUFBSSxDQUFDZ0QsT0FBTyxJQUFJLElBQUksQ0FBQzlELE1BQU0sQ0FBQzhELE9BQU8sRUFBRTtRQUNyQyxJQUFJLENBQUNDLFdBQVcsRUFBRSxDQUFBO0FBQ3RCLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsSUFBSVIsYUFBYSxHQUFHO0lBQ2hCLE9BQU8sSUFBSSxDQUFDMUMsY0FBYyxDQUFBO0FBQzlCLEdBQUE7O0VBT0EsSUFBSW1ELFdBQVcsQ0FBQ3ZCLEtBQUssRUFBRTtBQUNuQixJQUFBLElBQUlBLEtBQUssS0FBSyxJQUFJLENBQUNwQyxZQUFZLEVBQUU7TUFDN0IsSUFBSSxDQUFDQSxZQUFZLEdBQUdvQyxLQUFLLENBQUE7QUFFekIsTUFBQSxNQUFNQyxFQUFFLEdBQUcsSUFBSSxDQUFDN0IsY0FBYyxDQUFBO0FBQzlCLE1BQUEsSUFBSTZCLEVBQUUsRUFBRTtBQUNKLFFBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELEVBQUUsQ0FBQ0UsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNoQ0QsVUFBQUEsRUFBRSxDQUFDQyxDQUFDLENBQUMsQ0FBQ2tCLGNBQWMsQ0FBQ3BCLEtBQUssQ0FBQyxDQUFBO0FBQy9CLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUl1QixXQUFXLEdBQUc7SUFDZCxPQUFPLElBQUksQ0FBQzNELFlBQVksQ0FBQTtBQUM1QixHQUFBOztFQU9BLElBQUk0RCxXQUFXLENBQUN4QixLQUFLLEVBQUU7QUFDbkIsSUFBQSxJQUFJLElBQUksQ0FBQ3ZDLFlBQVksS0FBS3VDLEtBQUssRUFBRTtBQUU3QixNQUFBLE1BQU1DLEVBQUUsR0FBRyxJQUFJLENBQUM3QixjQUFjLENBQUE7QUFFOUIsTUFBQSxJQUFJNkIsRUFBRSxFQUFFO0FBQ0osUUFBQSxNQUFNd0IsTUFBTSxHQUFHLElBQUksQ0FBQ0EsTUFBTSxDQUFBO1FBQzFCLE1BQU1DLEtBQUssR0FBRyxJQUFJLENBQUNwRSxNQUFNLENBQUN5QixHQUFHLENBQUMyQyxLQUFLLENBQUE7QUFDbkMsUUFBQSxJQUFJLElBQUksQ0FBQ2pFLFlBQVksSUFBSSxDQUFDdUMsS0FBSyxFQUFFO0FBQzdCLFVBQUEsS0FBSyxJQUFJRSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd1QixNQUFNLENBQUN0QixNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ3BDLFlBQUEsTUFBTXlCLEtBQUssR0FBR0QsS0FBSyxDQUFDRCxNQUFNLENBQUNHLFlBQVksQ0FBQyxJQUFJLENBQUNILE1BQU0sQ0FBQ3ZCLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDdkQsWUFBQSxJQUFJeUIsS0FBSyxFQUFFO0FBQ1BBLGNBQUFBLEtBQUssQ0FBQ0UsbUJBQW1CLENBQUM1QixFQUFFLENBQUMsQ0FBQTtBQUNqQyxhQUFBO0FBQ0osV0FBQTtBQUNKLFNBQUE7QUFFQSxRQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHRCxFQUFFLENBQUNFLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDaENELFVBQUFBLEVBQUUsQ0FBQ0MsQ0FBQyxDQUFDLENBQUNlLFVBQVUsR0FBR2pCLEtBQUssQ0FBQTtBQUM1QixTQUFBO0FBRUEsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDdkMsWUFBWSxJQUFJdUMsS0FBSyxFQUFFO0FBQzdCLFVBQUEsS0FBSyxJQUFJRSxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUd1QixNQUFNLENBQUN0QixNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ3BDLFlBQUEsTUFBTXlCLEtBQUssR0FBR0QsS0FBSyxDQUFDRCxNQUFNLENBQUNHLFlBQVksQ0FBQ0gsTUFBTSxDQUFDdkIsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUNsRCxZQUFBLElBQUl5QixLQUFLLEVBQUU7QUFDUEEsY0FBQUEsS0FBSyxDQUFDRyxnQkFBZ0IsQ0FBQzdCLEVBQUUsQ0FBQyxDQUFBO0FBQzlCLGFBQUE7QUFDSixXQUFBO0FBQ0osU0FBQTtBQUNKLE9BQUE7TUFFQSxJQUFJLENBQUN4QyxZQUFZLEdBQUd1QyxLQUFLLENBQUE7QUFDN0IsS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUl3QixXQUFXLEdBQUc7SUFDZCxPQUFPLElBQUksQ0FBQy9ELFlBQVksQ0FBQTtBQUM1QixHQUFBOztFQU9BLElBQUlzRSxjQUFjLENBQUMvQixLQUFLLEVBQUU7QUFDdEIsSUFBQSxJQUFJLElBQUksQ0FBQ3RDLGVBQWUsS0FBS3NDLEtBQUssRUFBRTtNQUVoQyxJQUFJLENBQUN0QyxlQUFlLEdBQUdzQyxLQUFLLENBQUE7QUFFNUIsTUFBQSxNQUFNQyxFQUFFLEdBQUcsSUFBSSxDQUFDN0IsY0FBYyxDQUFBO0FBQzlCLE1BQUEsSUFBSTZCLEVBQUUsRUFBRTtBQUNKLFFBQUEsS0FBSyxJQUFJQyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdELEVBQUUsQ0FBQ0UsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNoQ0QsVUFBQUEsRUFBRSxDQUFDQyxDQUFDLENBQUMsQ0FBQ2dCLGFBQWEsR0FBR2xCLEtBQUssQ0FBQTtBQUMvQixTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJK0IsY0FBYyxHQUFHO0lBQ2pCLE9BQU8sSUFBSSxDQUFDckUsZUFBZSxDQUFBO0FBQy9CLEdBQUE7O0VBT0EsSUFBSXNFLG1CQUFtQixDQUFDaEMsS0FBSyxFQUFFO0lBQzNCLElBQUksQ0FBQ3JDLG9CQUFvQixHQUFHcUMsS0FBSyxDQUFBO0FBQ3JDLEdBQUE7QUFFQSxFQUFBLElBQUlnQyxtQkFBbUIsR0FBRztJQUN0QixPQUFPLElBQUksQ0FBQ3JFLG9CQUFvQixDQUFBO0FBQ3BDLEdBQUE7O0VBT0EsSUFBSXNFLHNCQUFzQixDQUFDakMsS0FBSyxFQUFFO0lBQzlCLElBQUksQ0FBQ25DLHVCQUF1QixHQUFHbUMsS0FBSyxDQUFBO0FBQ3hDLEdBQUE7QUFFQSxFQUFBLElBQUlpQyxzQkFBc0IsR0FBRztJQUN6QixPQUFPLElBQUksQ0FBQ3BFLHVCQUF1QixDQUFBO0FBQ3ZDLEdBQUE7O0VBT0EsSUFBSXNELFFBQVEsQ0FBQ25CLEtBQUssRUFBRTtBQUNoQixJQUFBLElBQUksSUFBSSxDQUFDbEMsU0FBUyxLQUFLa0MsS0FBSyxFQUFFO01BQzFCLElBQUksQ0FBQ2xDLFNBQVMsR0FBR2tDLEtBQUssQ0FBQTtBQUV0QixNQUFBLE1BQU1DLEVBQUUsR0FBRyxJQUFJLENBQUM3QixjQUFjLENBQUE7QUFDOUIsTUFBQSxJQUFJNkIsRUFBRSxFQUFFO0FBQ0osUUFBQSxLQUFLLElBQUlDLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0QsRUFBRSxDQUFDRSxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ2hDRCxVQUFBQSxFQUFFLENBQUNDLENBQUMsQ0FBQyxDQUFDaUIsUUFBUSxHQUFHbkIsS0FBSyxDQUFBO0FBQzFCLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUltQixRQUFRLEdBQUc7SUFDWCxPQUFPLElBQUksQ0FBQ3JELFNBQVMsQ0FBQTtBQUN6QixHQUFBOztFQVFBLElBQUkyRCxNQUFNLENBQUN6QixLQUFLLEVBQUU7SUFDZCxNQUFNeUIsTUFBTSxHQUFHLElBQUksQ0FBQ25FLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQzJDLEtBQUssQ0FBQ0QsTUFBTSxDQUFBO0FBQzNDLElBQUEsSUFBSUUsS0FBSyxDQUFBO0lBRVQsSUFBSSxJQUFJLENBQUN2RCxjQUFjLEVBQUU7QUFFckIsTUFBQSxLQUFLLElBQUk4QixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDbEMsT0FBTyxDQUFDbUMsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtRQUMxQ3lCLEtBQUssR0FBR0YsTUFBTSxDQUFDRyxZQUFZLENBQUMsSUFBSSxDQUFDNUQsT0FBTyxDQUFDa0MsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUM1QyxRQUFBLElBQUl5QixLQUFLLEVBQUU7QUFDUEEsVUFBQUEsS0FBSyxDQUFDTyxtQkFBbUIsQ0FBQyxJQUFJLENBQUM5RCxjQUFjLENBQUMsQ0FBQTtBQUNsRCxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7O0FBR0EsSUFBQSxJQUFJLENBQUNKLE9BQU8sQ0FBQ21DLE1BQU0sR0FBRyxDQUFDLENBQUE7QUFDdkIsSUFBQSxLQUFLLElBQUlELENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBR0YsS0FBSyxDQUFDRyxNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO01BQ25DLElBQUksQ0FBQ2xDLE9BQU8sQ0FBQ2tDLENBQUMsQ0FBQyxHQUFHRixLQUFLLENBQUNFLENBQUMsQ0FBQyxDQUFBO0FBQzlCLEtBQUE7O0FBR0EsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDbUIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDOUQsTUFBTSxDQUFDOEQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDakQsY0FBYyxFQUFFLE9BQUE7O0FBR25FLElBQUEsS0FBSyxJQUFJOEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ2xDLE9BQU8sQ0FBQ21DLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7TUFDMUN5QixLQUFLLEdBQUdGLE1BQU0sQ0FBQ0csWUFBWSxDQUFDLElBQUksQ0FBQzVELE9BQU8sQ0FBQ2tDLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFDNUMsTUFBQSxJQUFJeUIsS0FBSyxFQUFFO0FBQ1BBLFFBQUFBLEtBQUssQ0FBQ1EsZ0JBQWdCLENBQUMsSUFBSSxDQUFDL0QsY0FBYyxDQUFDLENBQUE7QUFDL0MsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJcUQsTUFBTSxHQUFHO0lBQ1QsT0FBTyxJQUFJLENBQUN6RCxPQUFPLENBQUE7QUFDdkIsR0FBQTs7RUFPQSxJQUFJb0UsWUFBWSxDQUFDcEMsS0FBSyxFQUFFO0FBQ3BCLElBQUEsSUFBSSxJQUFJLENBQUNqQyxhQUFhLEtBQUtpQyxLQUFLLEVBQUU7TUFFOUIsSUFBSSxJQUFJLENBQUN6QyxNQUFNLENBQUM4RCxPQUFPLElBQUksSUFBSSxDQUFDdEQsYUFBYSxJQUFJLENBQUMsRUFBRTtBQUFBLFFBQUEsSUFBQSxxQkFBQSxDQUFBO1FBQ2hELENBQUkscUJBQUEsR0FBQSxJQUFBLENBQUNULE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ3NELE9BQU8sS0FBQSxJQUFBLEdBQUEsS0FBQSxDQUFBLEdBQXZCLHNCQUF5QmhELE1BQU0sQ0FBQ2lELFVBQVUsQ0FBQ0MsTUFBTSxFQUFFLElBQUksQ0FBQ0gsWUFBWSxFQUFFLElBQUksQ0FBQzdFLE1BQU0sQ0FBQyxDQUFBO0FBQ3RGLE9BQUE7TUFDQSxJQUFJLElBQUksQ0FBQ0EsTUFBTSxDQUFDOEQsT0FBTyxJQUFJckIsS0FBSyxJQUFJLENBQUMsRUFBRTtBQUFBLFFBQUEsSUFBQSxzQkFBQSxDQUFBO0FBQ25DLFFBQUEsQ0FBQSxzQkFBQSxHQUFBLElBQUksQ0FBQzFDLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ3NELE9BQU8scUJBQXZCLHNCQUF5QkcsQ0FBQUEsTUFBTSxDQUFDRixVQUFVLENBQUNDLE1BQU0sRUFBRXZDLEtBQUssRUFBRSxJQUFJLENBQUN6QyxNQUFNLENBQUMsQ0FBQTtBQUMxRSxPQUFBO0FBRUEsTUFBQSxJQUFJeUMsS0FBSyxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUNqQyxhQUFhLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQ3NELE9BQU8sSUFBSSxJQUFJLENBQUM5RCxNQUFNLENBQUM4RCxPQUFPLEVBQUU7UUFFN0UsSUFBSSxDQUFDQyxXQUFXLEVBQUUsQ0FBQTtBQUN0QixPQUFBO01BRUEsSUFBSSxDQUFDdkQsYUFBYSxHQUFHaUMsS0FBSyxDQUFBO0FBQzlCLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJb0MsWUFBWSxHQUFHO0lBQ2YsT0FBTyxJQUFJLENBQUNyRSxhQUFhLENBQUE7QUFDN0IsR0FBQTs7RUFRQSxJQUFJd0MsUUFBUSxDQUFDUCxLQUFLLEVBQUU7QUFDaEIsSUFBQSxJQUFJLElBQUksQ0FBQ3ZCLFNBQVMsS0FBS3VCLEtBQUssRUFBRTtNQUMxQixJQUFJLENBQUN2QixTQUFTLEdBQUd1QixLQUFLLENBQUE7TUFFdEIsSUFBSSxJQUFJLENBQUM1QixjQUFjLElBQUksSUFBSSxDQUFDWixLQUFLLEtBQUssT0FBTyxFQUFFO0FBQy9DLFFBQUEsS0FBSyxJQUFJMEMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQzlCLGNBQWMsQ0FBQytCLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7VUFDakQsSUFBSSxDQUFDOUIsY0FBYyxDQUFDOEIsQ0FBQyxDQUFDLENBQUNLLFFBQVEsR0FBR1AsS0FBSyxDQUFBO0FBQzNDLFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7QUFFQSxFQUFBLElBQUlPLFFBQVEsR0FBRztJQUNYLE9BQU8sSUFBSSxDQUFDOUIsU0FBUyxDQUFBO0FBQ3pCLEdBQUE7O0FBUUEsRUFBQSxJQUFJZ0UsY0FBYyxDQUFDekMsS0FBSyxHQUFHLEVBQUUsRUFBRTtJQUMzQixJQUFJLElBQUksQ0FBQ3hCLG1CQUFtQixDQUFDMkIsTUFBTSxHQUFHSCxLQUFLLENBQUNHLE1BQU0sRUFBRTtBQUNoRCxNQUFBLEtBQUssSUFBSUQsQ0FBQyxHQUFHRixLQUFLLENBQUNHLE1BQU0sRUFBRUQsQ0FBQyxHQUFHLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMkIsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtRQUNqRSxJQUFJLENBQUMxQixtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxDQUFDd0MsRUFBRSxHQUFHLElBQUksQ0FBQTtBQUN6QyxPQUFBO0FBQ0EsTUFBQSxJQUFJLENBQUNsRSxtQkFBbUIsQ0FBQzJCLE1BQU0sR0FBR0gsS0FBSyxDQUFDRyxNQUFNLENBQUE7QUFDbEQsS0FBQTtBQUVBLElBQUEsS0FBSyxJQUFJRCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdGLEtBQUssQ0FBQ0csTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUNuQyxNQUFBLElBQUksQ0FBQyxJQUFJLENBQUMxQixtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxFQUFFO0FBQzlCLFFBQUEsSUFBSSxDQUFDMUIsbUJBQW1CLENBQUNtRSxJQUFJLENBQ3pCLElBQUk3RCxjQUFjLENBQ2RvQixDQUFDLEVBQ0QsSUFBSSxFQUNKLElBQUksQ0FBQzVDLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ0MsTUFBTSxFQUFFO1VBQ3BCQyxHQUFHLEVBQUUsSUFBSSxDQUFDMkQsZ0JBQWdCO1VBQzFCekQsSUFBSSxFQUFFLElBQUksQ0FBQzBELGVBQWU7VUFDMUJ4RCxNQUFNLEVBQUUsSUFBSSxDQUFDeUQsaUJBQWlCO1VBQzlCdkQsTUFBTSxFQUFFLElBQUksQ0FBQ3dELGlCQUFBQTtTQUNoQixFQUNELElBQUksQ0FDUCxDQUNKLENBQUE7QUFDTCxPQUFBO0FBRUEsTUFBQSxJQUFJL0MsS0FBSyxDQUFDRSxDQUFDLENBQUMsRUFBRTtBQUNWLFFBQUEsTUFBTXdDLEVBQUUsR0FBRzFDLEtBQUssQ0FBQ0UsQ0FBQyxDQUFDLFlBQVk4QyxLQUFLLEdBQUdoRCxLQUFLLENBQUNFLENBQUMsQ0FBQyxDQUFDd0MsRUFBRSxHQUFHMUMsS0FBSyxDQUFDRSxDQUFDLENBQUMsQ0FBQTtRQUM3RCxJQUFJLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUN3QyxFQUFFLEtBQUtBLEVBQUUsRUFBRTtVQUN2QyxJQUFJLENBQUNsRSxtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxDQUFDd0MsRUFBRSxHQUFHQSxFQUFFLENBQUE7QUFDdkMsU0FBQTtRQUVBLElBQUksSUFBSSxDQUFDbEUsbUJBQW1CLENBQUMwQixDQUFDLENBQUMsQ0FBQ00sS0FBSyxFQUFFO0FBQ25DLFVBQUEsSUFBSSxDQUFDb0MsZ0JBQWdCLENBQUMxQyxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUNNLEtBQUssQ0FBQyxDQUFBO0FBQ3JFLFNBQUE7QUFDSixPQUFDLE1BQU07UUFDSCxJQUFJLENBQUNoQyxtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxDQUFDd0MsRUFBRSxHQUFHLElBQUksQ0FBQTtBQUVyQyxRQUFBLElBQUksSUFBSSxDQUFDdEUsY0FBYyxDQUFDOEIsQ0FBQyxDQUFDLEVBQUU7QUFDeEIsVUFBQSxJQUFJLENBQUM5QixjQUFjLENBQUM4QixDQUFDLENBQUMsQ0FBQ0ssUUFBUSxHQUFHLElBQUksQ0FBQ2pELE1BQU0sQ0FBQ21DLGVBQWUsQ0FBQTtBQUNqRSxTQUFBO0FBQ0osT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0FBRUEsRUFBQSxJQUFJZ0QsY0FBYyxHQUFHO0lBQ2pCLE9BQU8sSUFBSSxDQUFDakUsbUJBQW1CLENBQUN5RSxHQUFHLENBQUMsVUFBVUMsR0FBRyxFQUFFO01BQy9DLE9BQU9BLEdBQUcsQ0FBQ1IsRUFBRSxDQUFBO0FBQ2pCLEtBQUMsQ0FBQyxDQUFBO0FBQ04sR0FBQTs7RUFRQSxJQUFJbEMsS0FBSyxDQUFDUixLQUFLLEVBQUU7SUFDYixNQUFNMEMsRUFBRSxHQUFHMUMsS0FBSyxZQUFZZ0QsS0FBSyxHQUFHaEQsS0FBSyxDQUFDMEMsRUFBRSxHQUFHMUMsS0FBSyxDQUFBO0FBQ3BELElBQUEsSUFBSSxJQUFJLENBQUN6QixlQUFlLENBQUNtRSxFQUFFLEtBQUtBLEVBQUUsRUFBRSxPQUFBO0FBRXBDLElBQUEsSUFBSSxJQUFJLENBQUNuRSxlQUFlLENBQUNpQyxLQUFLLElBQUksSUFBSSxDQUFDakMsZUFBZSxDQUFDaUMsS0FBSyxDQUFDQyxRQUFRLEVBQUU7TUFDbkUsSUFBSSxDQUFDbkIsb0JBQW9CLEVBQUUsQ0FBQTtBQUMvQixLQUFBO0FBRUEsSUFBQSxJQUFJLENBQUNmLGVBQWUsQ0FBQ21FLEVBQUUsR0FBR0EsRUFBRSxDQUFBO0FBRTVCLElBQUEsSUFBSSxJQUFJLENBQUNuRSxlQUFlLENBQUNpQyxLQUFLLEVBQUU7TUFDNUIsSUFBSSxDQUFDdEIsbUJBQW1CLEVBQUUsQ0FBQTtBQUM5QixLQUFBO0FBQ0osR0FBQTtBQUVBLEVBQUEsSUFBSXNCLEtBQUssR0FBRztBQUNSLElBQUEsT0FBTyxJQUFJLENBQUNqQyxlQUFlLENBQUNtRSxFQUFFLENBQUE7QUFDbEMsR0FBQTs7RUFTQVMsV0FBVyxDQUFDM0MsS0FBSyxFQUFFO0lBQ2YsTUFBTWtDLEVBQUUsR0FBR2xDLEtBQUssWUFBWXdDLEtBQUssR0FBR3hDLEtBQUssQ0FBQ2tDLEVBQUUsR0FBR2xDLEtBQUssQ0FBQTtBQUNwRCxJQUFBLElBQUksQ0FBQ2pDLGVBQWUsQ0FBQ21FLEVBQUUsR0FBR0EsRUFBRSxDQUFBO0FBQ2hDLEdBQUE7O0VBTUE3RCxjQUFjLENBQUN0QixNQUFNLEVBQUU7QUFDbkIsSUFBQSxJQUFJQSxNQUFNLEVBQUU7TUFDUixJQUFJLENBQUM2RixrQkFBa0IsRUFBRSxDQUFBO0FBQzdCLEtBQUE7QUFDSixHQUFBOztBQUdBQSxFQUFBQSxrQkFBa0IsR0FBRztJQUVqQixJQUFJLENBQUNDLG1CQUFtQixFQUFFLENBQUE7SUFDMUIsSUFBSSxJQUFJLENBQUNoQyxPQUFPLElBQUksSUFBSSxDQUFDOUQsTUFBTSxDQUFDOEQsT0FBTyxFQUFFO01BQ3JDLElBQUksQ0FBQ2lDLG1CQUFtQixFQUFFLENBQUE7QUFDOUIsS0FBQTtBQUNKLEdBQUE7O0FBR0FoRCxFQUFBQSxvQkFBb0IsR0FBRztBQUVuQixJQUFBLE1BQU1RLGFBQWEsR0FBRyxJQUFJLENBQUMxQyxjQUFjLENBQUE7QUFDekMsSUFBQSxJQUFJMEMsYUFBYSxFQUFFO01BQ2YsSUFBSSxDQUFDeUMsZ0JBQWdCLEVBQUUsQ0FBQTs7TUFHdkIsSUFBSSxDQUFDRixtQkFBbUIsRUFBRSxDQUFBO0FBRTFCLE1BQUEsS0FBSyxJQUFJbkQsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHWSxhQUFhLENBQUNYLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDM0NZLFFBQUFBLGFBQWEsQ0FBQ1osQ0FBQyxDQUFDLENBQUNzRCxPQUFPLEVBQUUsQ0FBQTtBQUM5QixPQUFBO0FBQ0EsTUFBQSxJQUFJLENBQUNwRixjQUFjLENBQUMrQixNQUFNLEdBQUcsQ0FBQyxDQUFBO0FBQ2xDLEtBQUE7QUFDSixHQUFBOztBQUdBbUIsRUFBQUEsV0FBVyxHQUFHO0lBQ1YsTUFBTUcsTUFBTSxHQUFHLElBQUksQ0FBQ25FLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQzJDLEtBQUssQ0FBQ0QsTUFBTSxDQUFBO0FBQzNDLElBQUEsS0FBSyxJQUFJdkIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ2xDLE9BQU8sQ0FBQ21DLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDMUMsTUFBQSxNQUFNeUIsS0FBSyxHQUFHRixNQUFNLENBQUNHLFlBQVksQ0FBQyxJQUFJLENBQUM1RCxPQUFPLENBQUNrQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xELE1BQUEsSUFBSXlCLEtBQUssRUFBRTtBQUNQQSxRQUFBQSxLQUFLLENBQUNRLGdCQUFnQixDQUFDLElBQUksQ0FBQy9ELGNBQWMsQ0FBQyxDQUFBO0FBQy9DLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBbUYsRUFBQUEsZ0JBQWdCLEdBQUc7SUFDZixJQUFJLElBQUksQ0FBQ25GLGNBQWMsSUFBSSxJQUFJLENBQUNBLGNBQWMsQ0FBQytCLE1BQU0sRUFBRTtNQUNuRCxNQUFNc0IsTUFBTSxHQUFHLElBQUksQ0FBQ25FLE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQzJDLEtBQUssQ0FBQ0QsTUFBTSxDQUFBO0FBQzNDLE1BQUEsS0FBSyxJQUFJdkIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQ2xDLE9BQU8sQ0FBQ21DLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDMUMsUUFBQSxNQUFNeUIsS0FBSyxHQUFHRixNQUFNLENBQUNHLFlBQVksQ0FBQyxJQUFJLENBQUM1RCxPQUFPLENBQUNrQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0FBQ2xELFFBQUEsSUFBSXlCLEtBQUssRUFBRTtBQUNQQSxVQUFBQSxLQUFLLENBQUNPLG1CQUFtQixDQUFDLElBQUksQ0FBQzlELGNBQWMsQ0FBQyxDQUFBO0FBQ2xELFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBR0FzQixFQUFBQSxhQUFhLEdBQUc7SUFDWixJQUFJLENBQUM2RCxnQkFBZ0IsRUFBRSxDQUFBO0FBQzNCLEdBQUE7O0FBR0E1RCxFQUFBQSxhQUFhLEdBQUc7QUFDWixJQUFBLElBQUksSUFBSSxDQUFDdkIsY0FBYyxJQUFJLElBQUksQ0FBQ2lELE9BQU8sSUFBSSxJQUFJLENBQUM5RCxNQUFNLENBQUM4RCxPQUFPLEVBQUU7TUFDNUQsSUFBSSxDQUFDQyxXQUFXLEVBQUUsQ0FBQTtBQUN0QixLQUFBO0FBQ0osR0FBQTtBQUVBbUMsRUFBQUEsUUFBUSxHQUFHO0lBQ1AsSUFBSSxDQUFDbkQsb0JBQW9CLEVBQUUsQ0FBQTtJQUUzQixJQUFJLENBQUNFLEtBQUssR0FBRyxJQUFJLENBQUE7SUFDakIsSUFBSSxDQUFDa0QsYUFBYSxHQUFHLElBQUksQ0FBQTtBQUV6QixJQUFBLElBQUksQ0FBQ25GLGVBQWUsQ0FBQ21FLEVBQUUsR0FBRyxJQUFJLENBQUE7QUFFOUIsSUFBQSxLQUFLLElBQUl4QyxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUcsSUFBSSxDQUFDMUIsbUJBQW1CLENBQUMyQixNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO01BQ3RELElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUN3QyxFQUFFLEdBQUcsSUFBSSxDQUFBO0FBQ3pDLEtBQUE7QUFFQSxJQUFBLElBQUksQ0FBQ25GLE1BQU0sQ0FBQ29HLEdBQUcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDakUsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ25ELElBQUEsSUFBSSxDQUFDbkMsTUFBTSxDQUFDb0csR0FBRyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNoRSxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDdkQsR0FBQTtBQUVBaUUsRUFBQUEsZUFBZSxDQUFDQyxPQUFPLEVBQUVDLE9BQU8sRUFBRTtJQUM5QixJQUFJLENBQUN4QyxXQUFXLEVBQUUsQ0FBQTtJQUNsQnVDLE9BQU8sQ0FBQ0YsR0FBRyxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUNJLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUMzQ0YsT0FBTyxDQUFDRixHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ0ssY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFBO0lBQ2hERixPQUFPLENBQUNsRixFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQ21GLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUMxQ0QsT0FBTyxDQUFDbEYsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNvRixjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbkQsR0FBQTtFQUVBRCxZQUFZLENBQUNwQyxLQUFLLEVBQUU7SUFDaEIsTUFBTXNDLEtBQUssR0FBRyxJQUFJLENBQUN4QyxNQUFNLENBQUN5QyxPQUFPLENBQUN2QyxLQUFLLENBQUNlLEVBQUUsQ0FBQyxDQUFBO0lBQzNDLElBQUl1QixLQUFLLEdBQUcsQ0FBQyxFQUFFLE9BQUE7QUFDZnRDLElBQUFBLEtBQUssQ0FBQ1EsZ0JBQWdCLENBQUMsSUFBSSxDQUFDL0QsY0FBYyxDQUFDLENBQUE7QUFDL0MsR0FBQTtFQUVBNEYsY0FBYyxDQUFDckMsS0FBSyxFQUFFO0lBQ2xCLE1BQU1zQyxLQUFLLEdBQUcsSUFBSSxDQUFDeEMsTUFBTSxDQUFDeUMsT0FBTyxDQUFDdkMsS0FBSyxDQUFDZSxFQUFFLENBQUMsQ0FBQTtJQUMzQyxJQUFJdUIsS0FBSyxHQUFHLENBQUMsRUFBRSxPQUFBO0FBQ2Z0QyxJQUFBQSxLQUFLLENBQUNPLG1CQUFtQixDQUFDLElBQUksQ0FBQzlELGNBQWMsQ0FBQyxDQUFBO0FBQ2xELEdBQUE7QUFFQStGLEVBQUFBLFFBQVEsR0FBRztBQUNQLElBQUEsTUFBTXBGLEdBQUcsR0FBRyxJQUFJLENBQUN6QixNQUFNLENBQUN5QixHQUFHLENBQUE7QUFDM0IsSUFBQSxNQUFNMkMsS0FBSyxHQUFHM0MsR0FBRyxDQUFDMkMsS0FBSyxDQUFBO0FBRXZCLElBQUEsSUFBSSxDQUFDaEQsU0FBUyxDQUFDMEYsdUJBQXVCLEVBQUUsQ0FBQTtJQUV4QyxJQUFJLENBQUNkLG1CQUFtQixFQUFFLENBQUE7SUFFMUI1QixLQUFLLENBQUM5QyxFQUFFLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQ2dGLGVBQWUsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUNsRCxJQUFJbEMsS0FBSyxDQUFDRCxNQUFNLEVBQUU7QUFDZEMsTUFBQUEsS0FBSyxDQUFDRCxNQUFNLENBQUM3QyxFQUFFLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQ21GLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQTtBQUMvQ3JDLE1BQUFBLEtBQUssQ0FBQ0QsTUFBTSxDQUFDN0MsRUFBRSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUNvRixjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDeEQsS0FBQTtBQUVBLElBQUEsTUFBTUssT0FBTyxHQUFJLElBQUksQ0FBQzdHLEtBQUssS0FBSyxPQUFRLENBQUE7SUFDeEMsSUFBSSxJQUFJLENBQUNZLGNBQWMsSUFBSSxJQUFJLENBQUNBLGNBQWMsQ0FBQytCLE1BQU0sRUFBRTtNQUNuRCxJQUFJLENBQUNtQixXQUFXLEVBQUUsQ0FBQTtBQUN0QixLQUFDLE1BQU0sSUFBSStDLE9BQU8sSUFBSSxJQUFJLENBQUM3RCxLQUFLLEVBQUU7TUFDOUIsSUFBSSxDQUFDdEIsbUJBQW1CLEVBQUUsQ0FBQTtBQUM5QixLQUFBOztBQUdBLElBQUEsS0FBSyxJQUFJZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMkIsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtNQUN0RCxJQUFJLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUNNLEtBQUssRUFBRTtBQUNuQyxRQUFBLElBQUksQ0FBQ2xELE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ0MsTUFBTSxDQUFDRyxJQUFJLENBQUMsSUFBSSxDQUFDWCxtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxDQUFDTSxLQUFLLENBQUMsQ0FBQTtBQUNsRSxPQUFBO0FBQ0osS0FBQTtBQUVBLElBQUEsSUFBSSxJQUFJLENBQUN6QyxhQUFhLElBQUksQ0FBQyxFQUFFO0FBQUEsTUFBQSxJQUFBLFlBQUEsQ0FBQTtBQUN6QixNQUFBLENBQUEsWUFBQSxHQUFBZ0IsR0FBRyxDQUFDc0QsT0FBTyxxQkFBWCxZQUFhRyxDQUFBQSxNQUFNLENBQUNGLFVBQVUsQ0FBQ0MsTUFBTSxFQUFFLElBQUksQ0FBQ0gsWUFBWSxFQUFFLElBQUksQ0FBQzdFLE1BQU0sQ0FBQyxDQUFBO0FBQzFFLEtBQUE7QUFDSixHQUFBO0FBRUErRyxFQUFBQSxTQUFTLEdBQUc7QUFDUixJQUFBLE1BQU12RixHQUFHLEdBQUcsSUFBSSxDQUFDekIsTUFBTSxDQUFDeUIsR0FBRyxDQUFBO0FBQzNCLElBQUEsTUFBTTJDLEtBQUssR0FBRzNDLEdBQUcsQ0FBQzJDLEtBQUssQ0FBQTtJQUV2QkEsS0FBSyxDQUFDaUMsR0FBRyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUNDLGVBQWUsRUFBRSxJQUFJLENBQUMsQ0FBQTtJQUNuRCxJQUFJbEMsS0FBSyxDQUFDRCxNQUFNLEVBQUU7QUFDZEMsTUFBQUEsS0FBSyxDQUFDRCxNQUFNLENBQUNrQyxHQUFHLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQ0ksWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ2hEckMsTUFBQUEsS0FBSyxDQUFDRCxNQUFNLENBQUNrQyxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQ0ssY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3pELEtBQUE7QUFFQSxJQUFBLElBQUksSUFBSSxDQUFDakcsYUFBYSxJQUFJLENBQUMsRUFBRTtBQUFBLE1BQUEsSUFBQSxhQUFBLENBQUE7QUFDekIsTUFBQSxDQUFBLGFBQUEsR0FBQWdCLEdBQUcsQ0FBQ3NELE9BQU8scUJBQVgsYUFBYWhELENBQUFBLE1BQU0sQ0FBQ2lELFVBQVUsQ0FBQ0MsTUFBTSxFQUFFLElBQUksQ0FBQ0gsWUFBWSxFQUFFLElBQUksQ0FBQzdFLE1BQU0sQ0FBQyxDQUFBO0FBQzFFLEtBQUE7SUFFQSxJQUFJLENBQUNnRyxnQkFBZ0IsRUFBRSxDQUFBO0FBQzNCLEdBQUE7O0FBUUFnQixFQUFBQSxJQUFJLEdBQUc7SUFDSCxJQUFJLElBQUksQ0FBQ25HLGNBQWMsRUFBRTtBQUNyQixNQUFBLEtBQUssSUFBSThCLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUM5QixjQUFjLENBQUMrQixNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO1FBQ2pELElBQUksQ0FBQzlCLGNBQWMsQ0FBQzhCLENBQUMsQ0FBQyxDQUFDc0UsT0FBTyxHQUFHLEtBQUssQ0FBQTtBQUMxQyxPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7O0FBT0FDLEVBQUFBLElBQUksR0FBRztJQUNILElBQUksSUFBSSxDQUFDckcsY0FBYyxFQUFFO0FBQ3JCLE1BQUEsS0FBSyxJQUFJOEIsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQzlCLGNBQWMsQ0FBQytCLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7UUFDakQsSUFBSSxDQUFDOUIsY0FBYyxDQUFDOEIsQ0FBQyxDQUFDLENBQUNzRSxPQUFPLEdBQUcsSUFBSSxDQUFBO0FBQ3pDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBdEYsRUFBQUEsbUJBQW1CLEdBQUc7QUFDbEIsSUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDWCxlQUFlLENBQUNpQyxLQUFLLEVBQUUsT0FBQTtBQUVqQyxJQUFBLElBQUksSUFBSSxDQUFDakMsZUFBZSxDQUFDaUMsS0FBSyxDQUFDQyxRQUFRLEVBQUU7TUFDckMsSUFBSSxDQUFDckIsa0JBQWtCLEVBQUUsQ0FBQTtLQUM1QixNQUFNLElBQUksSUFBSSxDQUFDaUMsT0FBTyxJQUFJLElBQUksQ0FBQzlELE1BQU0sQ0FBQzhELE9BQU8sRUFBRTtBQUM1QyxNQUFBLElBQUksQ0FBQy9ELE1BQU0sQ0FBQ3lCLEdBQUcsQ0FBQ0MsTUFBTSxDQUFDRyxJQUFJLENBQUMsSUFBSSxDQUFDWixlQUFlLENBQUNpQyxLQUFLLENBQUMsQ0FBQTtBQUMzRCxLQUFBO0FBQ0osR0FBQTtBQUVBcEIsRUFBQUEsa0JBQWtCLEdBQUc7SUFHakIsSUFBSSxDQUFDa0Isb0JBQW9CLEVBQUUsQ0FBQTtBQUUzQixJQUFBLElBQUksSUFBSSxDQUFDL0IsZUFBZSxDQUFDaUMsS0FBSyxFQUFFO01BQzVCLE1BQU1rRSxNQUFNLEdBQUcsSUFBSSxDQUFDbkcsZUFBZSxDQUFDaUMsS0FBSyxDQUFDQyxRQUFRLENBQUE7TUFDbERpRSxNQUFNLENBQUNmLEdBQUcsQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDZ0IsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFBO01BQ2pERCxNQUFNLENBQUM5RixFQUFFLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQytGLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQTtNQUNoRCxJQUFJRCxNQUFNLENBQUNFLE1BQU0sRUFBRTtBQUNmLFFBQUEsSUFBSSxDQUFDRCxZQUFZLENBQUNELE1BQU0sQ0FBQ0UsTUFBTSxDQUFDLENBQUE7QUFDcEMsT0FBQTtBQUNKLEtBQUE7QUFDSixHQUFBO0VBRUFELFlBQVksQ0FBQ0MsTUFBTSxFQUFFO0FBQ2pCLElBQUEsSUFBSSxDQUFDQyxZQUFZLENBQUNELE1BQU0sQ0FBQyxDQUFBO0FBQzdCLEdBQUE7QUFFQXZCLEVBQUFBLG1CQUFtQixHQUFHO0FBRWxCLElBQUEsS0FBSyxJQUFJbkQsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHLElBQUksQ0FBQzlCLGNBQWMsQ0FBQytCLE1BQU0sRUFBRUQsQ0FBQyxFQUFFLEVBQUU7QUFDakQsTUFBQSxNQUFNNEUsWUFBWSxHQUFHLElBQUksQ0FBQzFHLGNBQWMsQ0FBQzhCLENBQUMsQ0FBQyxDQUFBOztBQUczQzZFLE1BQUFBLGlCQUFpQixDQUFDQyx3QkFBd0IsQ0FBQ0YsWUFBWSxDQUFDRyxZQUFZLENBQUMsQ0FBQTtNQUNyRUgsWUFBWSxDQUFDRyxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBQ3BDLEtBQUE7QUFDSixHQUFBO0FBRUEzQixFQUFBQSxtQkFBbUIsR0FBRztBQUVsQixJQUFBLElBQUksSUFBSSxDQUFDbEYsY0FBYyxDQUFDK0IsTUFBTSxJQUFJLElBQUksQ0FBQ3pCLFNBQVMsQ0FBQ25CLE1BQU0sWUFBWTJILFNBQVMsRUFBRTtBQUUxRSxNQUFBLEtBQUssSUFBSWhGLENBQUMsR0FBRyxDQUFDLEVBQUVBLENBQUMsR0FBRyxJQUFJLENBQUM5QixjQUFjLENBQUMrQixNQUFNLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQ2pELFFBQUEsTUFBTTRFLFlBQVksR0FBRyxJQUFJLENBQUMxRyxjQUFjLENBQUM4QixDQUFDLENBQUMsQ0FBQTtBQUMzQyxRQUFBLE1BQU1hLElBQUksR0FBRytELFlBQVksQ0FBQy9ELElBQUksQ0FBQTs7UUFHOUIsSUFBSUEsSUFBSSxDQUFDb0UsSUFBSSxJQUFJLENBQUNMLFlBQVksQ0FBQ0csWUFBWSxFQUFFO1VBQ3pDSCxZQUFZLENBQUNHLFlBQVksR0FBR0YsaUJBQWlCLENBQUNLLHdCQUF3QixDQUFDckUsSUFBSSxDQUFDb0UsSUFBSSxFQUFFLElBQUksQ0FBQ3pHLFNBQVMsQ0FBQ25CLE1BQU0sRUFBRSxJQUFJLENBQUNBLE1BQU0sQ0FBQyxDQUFBO0FBQ3pILFNBQUE7QUFDSixPQUFBO0FBQ0osS0FBQTtBQUNKLEdBQUE7RUFFQXNILFlBQVksQ0FBQ0QsTUFBTSxFQUFFO0FBRWpCLElBQUEsSUFBSUEsTUFBTSxJQUFJQSxNQUFNLENBQUN6RSxNQUFNLEVBQUU7TUFHekIsTUFBTVcsYUFBYSxHQUFHLEVBQUUsQ0FBQTtBQUV4QixNQUFBLEtBQUssSUFBSVosQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHMEUsTUFBTSxDQUFDekUsTUFBTSxFQUFFRCxDQUFDLEVBQUUsRUFBRTtBQUdwQyxRQUFBLE1BQU1hLElBQUksR0FBRzZELE1BQU0sQ0FBQzFFLENBQUMsQ0FBQyxDQUFBO1FBQ3RCLE1BQU1LLFFBQVEsR0FBRyxJQUFJLENBQUMvQixtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxJQUFJLElBQUksQ0FBQzFCLG1CQUFtQixDQUFDMEIsQ0FBQyxDQUFDLENBQUNNLEtBQUssSUFBSSxJQUFJLENBQUNoQyxtQkFBbUIsQ0FBQzBCLENBQUMsQ0FBQyxDQUFDTSxLQUFLLENBQUNDLFFBQVEsQ0FBQTtBQUMvSCxRQUFBLE1BQU00RSxRQUFRLEdBQUcsSUFBSXhGLFlBQVksQ0FBQ2tCLElBQUksRUFBRVIsUUFBUSxJQUFJLElBQUksQ0FBQ2pELE1BQU0sQ0FBQ21DLGVBQWUsRUFBRSxJQUFJLENBQUNsQyxNQUFNLENBQUMsQ0FBQTtBQUM3RnVELFFBQUFBLGFBQWEsQ0FBQzZCLElBQUksQ0FBQzBDLFFBQVEsQ0FBQyxDQUFBOztRQUc1QixJQUFJdEUsSUFBSSxDQUFDdUUsS0FBSyxFQUFFO1VBQ1pELFFBQVEsQ0FBQ0UsYUFBYSxHQUFHLElBQUlDLGFBQWEsQ0FBQ3pFLElBQUksQ0FBQ3VFLEtBQUssQ0FBQyxDQUFBO0FBQzFELFNBQUE7QUFDSixPQUFBO01BRUEsSUFBSSxDQUFDeEUsYUFBYSxHQUFHQSxhQUFhLENBQUE7O01BR2xDLElBQUksQ0FBQ3dDLG1CQUFtQixFQUFFLENBQUE7QUFDOUIsS0FBQTtBQUNKLEdBQUE7QUFFQTlELEVBQUFBLG9CQUFvQixHQUFHO0FBR25CLElBQUEsSUFBSSxJQUFJLENBQUNoQyxLQUFLLEtBQUssT0FBTyxFQUFFO01BQ3hCLElBQUksQ0FBQzhDLG9CQUFvQixFQUFFLENBQUE7QUFDL0IsS0FBQTtBQUNKLEdBQUE7QUFFQWhCLEVBQUFBLG9CQUFvQixHQUFHO0FBQ25CLElBQUEsSUFBSSxJQUFJLENBQUNmLGVBQWUsQ0FBQ2lDLEtBQUssSUFBSSxJQUFJLENBQUNqQyxlQUFlLENBQUNpQyxLQUFLLENBQUNDLFFBQVEsRUFBRTtBQUNuRSxNQUFBLElBQUksQ0FBQ2xDLGVBQWUsQ0FBQ2lDLEtBQUssQ0FBQ0MsUUFBUSxDQUFDa0QsR0FBRyxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUNnQixZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDbEYsS0FBQTtJQUVBLElBQUksQ0FBQ25GLG9CQUFvQixFQUFFLENBQUE7QUFDL0IsR0FBQTtBQUVBb0QsRUFBQUEsZ0JBQWdCLENBQUNxQixLQUFLLEVBQUV3QixTQUFTLEVBQUVqRixLQUFLLEVBQUU7SUFDdEMsSUFBSUEsS0FBSyxDQUFDQyxRQUFRLEVBQUU7TUFDaEIsSUFBSSxDQUFDb0MsZUFBZSxDQUFDb0IsS0FBSyxFQUFFd0IsU0FBUyxFQUFFakYsS0FBSyxDQUFDLENBQUE7QUFDakQsS0FBQyxNQUFNO01BQ0gsSUFBSSxJQUFJLENBQUNhLE9BQU8sSUFBSSxJQUFJLENBQUM5RCxNQUFNLENBQUM4RCxPQUFPLEVBQUU7UUFDckMsSUFBSSxDQUFDL0QsTUFBTSxDQUFDeUIsR0FBRyxDQUFDQyxNQUFNLENBQUNHLElBQUksQ0FBQ3FCLEtBQUssQ0FBQyxDQUFBO0FBQ3RDLE9BQUE7QUFDSixLQUFBO0FBQ0osR0FBQTtBQUVBa0YsRUFBQUEsbUJBQW1CLENBQUN6QixLQUFLLEVBQUUxRCxRQUFRLEVBQUU7SUFFakMsSUFBSTBELEtBQUssS0FBSyxDQUFDLEVBQUU7TUFDYixJQUFJLENBQUMxRCxRQUFRLEdBQUdBLFFBQVEsQ0FBQTtBQUM1QixLQUFBO0FBQ0osR0FBQTtBQUVBc0MsRUFBQUEsZUFBZSxDQUFDb0IsS0FBSyxFQUFFd0IsU0FBUyxFQUFFakYsS0FBSyxFQUFFO0FBQ3JDLElBQUEsSUFBSSxJQUFJLENBQUNwQyxjQUFjLENBQUM2RixLQUFLLENBQUMsRUFBRTtNQUM1QixJQUFJLENBQUM3RixjQUFjLENBQUM2RixLQUFLLENBQUMsQ0FBQzFELFFBQVEsR0FBR0MsS0FBSyxDQUFDQyxRQUFRLENBQUE7QUFDeEQsS0FBQTtJQUNBLElBQUksQ0FBQ2lGLG1CQUFtQixDQUFDekIsS0FBSyxFQUFFekQsS0FBSyxDQUFDQyxRQUFRLENBQUMsQ0FBQTtBQUNuRCxHQUFBO0FBRUFxQyxFQUFBQSxpQkFBaUIsQ0FBQ21CLEtBQUssRUFBRXdCLFNBQVMsRUFBRWpGLEtBQUssRUFBRTtBQUN2QyxJQUFBLElBQUksSUFBSSxDQUFDcEMsY0FBYyxDQUFDNkYsS0FBSyxDQUFDLEVBQUU7QUFDNUIsTUFBQSxJQUFJLENBQUM3RixjQUFjLENBQUM2RixLQUFLLENBQUMsQ0FBQzFELFFBQVEsR0FBRyxJQUFJLENBQUNqRCxNQUFNLENBQUNtQyxlQUFlLENBQUE7QUFDckUsS0FBQTtJQUNBLElBQUksQ0FBQ2lHLG1CQUFtQixDQUFDekIsS0FBSyxFQUFFLElBQUksQ0FBQzNHLE1BQU0sQ0FBQ21DLGVBQWUsQ0FBQyxDQUFBO0FBQ2hFLEdBQUE7QUFFQXNELEVBQUFBLGlCQUFpQixDQUFDa0IsS0FBSyxFQUFFd0IsU0FBUyxFQUFFakYsS0FBSyxFQUFFO0FBQ3ZDLElBQUEsSUFBSSxJQUFJLENBQUNwQyxjQUFjLENBQUM2RixLQUFLLENBQUMsRUFBRTtBQUM1QixNQUFBLElBQUksQ0FBQzdGLGNBQWMsQ0FBQzZGLEtBQUssQ0FBQyxDQUFDMUQsUUFBUSxHQUFHLElBQUksQ0FBQ2pELE1BQU0sQ0FBQ21DLGVBQWUsQ0FBQTtBQUNyRSxLQUFBO0lBQ0EsSUFBSSxDQUFDaUcsbUJBQW1CLENBQUN6QixLQUFLLEVBQUUsSUFBSSxDQUFDM0csTUFBTSxDQUFDbUMsZUFBZSxDQUFDLENBQUE7QUFDaEUsR0FBQTtBQUVBa0csRUFBQUEsMENBQTBDLENBQUNDLFNBQVMsRUFBRUMsZ0JBQWdCLEVBQUU7SUFDcEUsSUFBSUQsU0FBUyxDQUFDRSxRQUFRLElBQUlELGdCQUFnQixDQUFDRCxTQUFTLENBQUNFLFFBQVEsQ0FBQyxFQUFFO01BQzVELElBQUksQ0FBQ0EsUUFBUSxHQUFHRCxnQkFBZ0IsQ0FBQ0QsU0FBUyxDQUFDRSxRQUFRLENBQUMsQ0FBQTtBQUN4RCxLQUFBO0lBQ0EsSUFBSSxDQUFDekMsbUJBQW1CLEVBQUUsQ0FBQTtBQUM5QixHQUFBO0FBQ0o7Ozs7In0=
