/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { LAYERID_WORLD, RENDERSTYLE_SOLID } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { MorphInstance } from '../../../scene/morph-instance.js';
import { getShapePrimitive } from '../../../scene/procedural.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { SkinInstanceCache } from '../../../scene/skin-instance-cache.js';
import { Asset } from '../../../asset/asset.js';
import { AssetReference } from '../../../asset/asset-reference.js';
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmVuZGVyL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX1dPUkxELCBSRU5ERVJTVFlMRV9TT0xJRCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBNb3JwaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9ycGgtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgZ2V0U2hhcGVQcmltaXRpdmUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9wcm9jZWR1cmFsLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgU2tpbkluc3RhbmNlQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9za2luLWluc3RhbmNlLWNhY2hlLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi8uLi9hc3NldC9hc3NldC5qcyc7XG5pbXBvcnQgeyBBc3NldFJlZmVyZW5jZSB9IGZyb20gJy4uLy4uLy4uL2Fzc2V0L2Fzc2V0LXJlZmVyZW5jZS5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eVJlZmVyZW5jZSB9IGZyb20gJy4uLy4uL3V0aWxzL2VudGl0eS1yZWZlcmVuY2UuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9IE1hdGVyaWFsICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vc2hhcGUvYm91bmRpbmctYm94LmpzJykuQm91bmRpbmdCb3h9IEJvdW5kaW5nQm94ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlJlbmRlckNvbXBvbmVudFN5c3RlbX0gUmVuZGVyQ29tcG9uZW50U3lzdGVtICovXG5cbi8qKlxuICogRW5hYmxlcyBhbiBFbnRpdHkgdG8gcmVuZGVyIGEge0BsaW5rIE1lc2h9IG9yIGEgcHJpbWl0aXZlIHNoYXBlLiBUaGlzIGNvbXBvbmVudCBhdHRhY2hlc1xuICoge0BsaW5rIE1lc2hJbnN0YW5jZX0gZ2VvbWV0cnkgdG8gdGhlIEVudGl0eS5cbiAqXG4gKiBAcHJvcGVydHkge0VudGl0eX0gcm9vdEJvbmUgQSByZWZlcmVuY2UgdG8gdGhlIGVudGl0eSB0byBiZSB1c2VkIGFzIHRoZSByb290IGJvbmUgZm9yIGFueVxuICogc2tpbm5lZCBtZXNoZXMgdGhhdCBhcmUgcmVuZGVyZWQgYnkgdGhpcyBjb21wb25lbnQuXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIFJlbmRlckNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3R5cGUgPSAnYXNzZXQnO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2Nhc3RTaGFkb3dzID0gdHJ1ZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9yZWNlaXZlU2hhZG93cyA9IHRydWU7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfY2FzdFNoYWRvd3NMaWdodG1hcCA9IHRydWU7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbGlnaHRtYXBwZWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saWdodG1hcFNpemVNdWx0aXBsaWVyID0gMTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9pc1N0YXRpYyA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2JhdGNoR3JvdXBJZCA9IC0xO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfcmVuZGVyU3R5bGUgPSBSRU5ERVJTVFlMRV9TT0xJRDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNZXNoSW5zdGFuY2VbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tZXNoSW5zdGFuY2VzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h8bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9jdXN0b21BYWJiID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIFVzZWQgYnkgbGlnaHRtYXBwZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7e3g6IG51bWJlciwgeTogbnVtYmVyLCB6OiBudW1iZXIsIHV2OiBudW1iZXJ9fG51bGx9XG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIF9hcmVhID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBc3NldFJlZmVyZW5jZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hc3NldFJlZmVyZW5jZSA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Fzc2V0UmVmZXJlbmNlW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWF0ZXJpYWxSZWZlcmVuY2VzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBNYXRlcmlhbCB1c2VkIHRvIHJlbmRlciBtZXNoZXMgb3RoZXIgdGhhbiBhc3NldCB0eXBlLiBJdCBnZXRzIHByaW9yaXR5IHdoZW4gc2V0IHRvXG4gICAgICogc29tZXRoaW5nIGVsc2UgdGhhbiBkZWZhdWx0TWF0ZXJpYWwsIG90aGVyd2lzZSBtYXRlcmlhbEFTc2V0c1swXSBpcyB1c2VkLlxuICAgICAqXG4gICAgICogQHR5cGUge01hdGVyaWFsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hdGVyaWFsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0VudGl0eVJlZmVyZW5jZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yb290Qm9uZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBSZW5kZXJDb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1JlbmRlckNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0IGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgLy8gdGhlIGVudGl0eSB0aGF0IHJlcHJlc2VudHMgdGhlIHJvb3QgYm9uZSBpZiB0aGlzIHJlbmRlciBjb21wb25lbnQgaGFzIHNraW5uZWQgbWVzaGVzXG4gICAgICAgIHRoaXMuX3Jvb3RCb25lID0gbmV3IEVudGl0eVJlZmVyZW5jZSh0aGlzLCAncm9vdEJvbmUnKTtcbiAgICAgICAgdGhpcy5fcm9vdEJvbmUub24oJ3NldDplbnRpdHknLCB0aGlzLl9vblNldFJvb3RCb25lLCB0aGlzKTtcblxuICAgICAgICAvLyByZW5kZXIgYXNzZXQgcmVmZXJlbmNlXG4gICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlID0gbmV3IEFzc2V0UmVmZXJlbmNlKFxuICAgICAgICAgICAgJ2Fzc2V0JyxcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBzeXN0ZW0uYXBwLmFzc2V0cywge1xuICAgICAgICAgICAgICAgIGFkZDogdGhpcy5fb25SZW5kZXJBc3NldEFkZGVkLFxuICAgICAgICAgICAgICAgIGxvYWQ6IHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkLFxuICAgICAgICAgICAgICAgIHJlbW92ZTogdGhpcy5fb25SZW5kZXJBc3NldFJlbW92ZSxcbiAgICAgICAgICAgICAgICB1bmxvYWQ6IHRoaXMuX29uUmVuZGVyQXNzZXRVbmxvYWRcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0aGlzXG4gICAgICAgICk7XG5cbiAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSBzeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuXG4gICAgICAgIC8vIGhhbmRsZSBldmVudHMgd2hlbiB0aGUgZW50aXR5IGlzIGRpcmVjdGx5IChvciBpbmRpcmVjdGx5IGFzIGEgY2hpbGQgb2Ygc3ViLWhpZXJhcmNoeSlcbiAgICAgICAgLy8gYWRkZWQgb3IgcmVtb3ZlZCBmcm9tIHRoZSBwYXJlbnRcbiAgICAgICAgZW50aXR5Lm9uKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ3JlbW92ZWhpZXJhcmNoeScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbignaW5zZXJ0JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdpbnNlcnRoaWVyYXJjaHknLCB0aGlzLm9uSW5zZXJ0Q2hpbGQsIHRoaXMpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCByZW5kZXJpbmcgb2YgYWxsIHtAbGluayBNZXNoSW5zdGFuY2V9cyB0byB0aGUgc3BlY2lmaWVkIHJlbmRlciBzdHlsZS4gQ2FuIGJlOlxuICAgICAqXG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfU09MSUR9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfV0lSRUZSQU1FfVxuICAgICAqIC0ge0BsaW5rIFJFTkRFUlNUWUxFX1BPSU5UU31cbiAgICAgKlxuICAgICAqIERlZmF1bHRzIHRvIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH0uXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCByZW5kZXJTdHlsZShyZW5kZXJTdHlsZSkge1xuICAgICAgICBpZiAodGhpcy5fcmVuZGVyU3R5bGUgIT09IHJlbmRlclN0eWxlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJTdHlsZSA9IHJlbmRlclN0eWxlO1xuICAgICAgICAgICAgTWVzaEluc3RhbmNlLl9wcmVwYXJlUmVuZGVyU3R5bGVGb3JBcnJheSh0aGlzLl9tZXNoSW5zdGFuY2VzLCByZW5kZXJTdHlsZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVuZGVyU3R5bGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZW5kZXJTdHlsZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiBzZXQsIHRoZSBvYmplY3Qgc3BhY2UgYm91bmRpbmcgYm94IGlzIHVzZWQgYXMgYSBib3VuZGluZyBib3ggZm9yIHZpc2liaWxpdHkgY3VsbGluZyBvZlxuICAgICAqIGF0dGFjaGVkIG1lc2ggaW5zdGFuY2VzLiBUaGlzIGlzIGFuIG9wdGltaXphdGlvbiwgYWxsb3dpbmcgb3ZlcnNpemVkIGJvdW5kaW5nIGJveCB0byBiZVxuICAgICAqIHNwZWNpZmllZCBmb3Igc2tpbm5lZCBjaGFyYWN0ZXJzIGluIG9yZGVyIHRvIGF2b2lkIHBlciBmcmFtZSBib3VuZGluZyBib3ggY29tcHV0YXRpb25zIGJhc2VkXG4gICAgICogb24gYm9uZSBwb3NpdGlvbnMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Qm91bmRpbmdCb3h9XG4gICAgICovXG4gICAgc2V0IGN1c3RvbUFhYmIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IHZhbHVlO1xuXG4gICAgICAgIC8vIHNldCBpdCBvbiBtZXNoSW5zdGFuY2VzXG4gICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWlbaV0uc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjdXN0b21BYWJiKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VzdG9tQWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiB0aGUgcmVuZGVyLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIFwiYXNzZXRcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIHJlbmRlciBhc3NldFxuICAgICAqIC0gXCJib3hcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGJveCAoMSB1bml0IGluIGVhY2ggZGltZW5zaW9uKVxuICAgICAqIC0gXCJjYXBzdWxlXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBjYXBzdWxlIChyYWRpdXMgMC41LCBoZWlnaHQgMilcbiAgICAgKiAtIFwiY29uZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY29uZSAocmFkaXVzIDAuNSwgaGVpZ2h0IDEpXG4gICAgICogLSBcImN5bGluZGVyXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBjeWxpbmRlciAocmFkaXVzIDAuNSwgaGVpZ2h0IDEpXG4gICAgICogLSBcInBsYW5lXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBwbGFuZSAoMSB1bml0IGluIGVhY2ggZGltZW5zaW9uKVxuICAgICAqIC0gXCJzcGhlcmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIHNwaGVyZSAocmFkaXVzIDAuNSlcbiAgICAgKiAtIFwidG9ydXNcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIHRvcnVzICh0dWJlUmFkaXVzOiAwLjIsIHJpbmdSYWRpdXM6IDAuMylcbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcblxuICAgICAgICBpZiAodGhpcy5fdHlwZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2FyZWEgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IHZhbHVlO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lNZXNoSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgICAgIGxldCBtYXRlcmlhbCA9IHRoaXMuX21hdGVyaWFsO1xuICAgICAgICAgICAgICAgIGlmICghbWF0ZXJpYWwgfHwgbWF0ZXJpYWwgPT09IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1swXSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbMF0uYXNzZXQgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzWzBdLmFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHByaW1EYXRhID0gZ2V0U2hhcGVQcmltaXRpdmUodGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXJlYSA9IHByaW1EYXRhLmFyZWE7XG4gICAgICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2VzID0gW25ldyBNZXNoSW5zdGFuY2UocHJpbURhdGEubWVzaCwgbWF0ZXJpYWwgfHwgdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsLCB0aGlzLmVudGl0eSldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIG1lc2hJbnN0YW5jZXMgY29udGFpbmVkIGluIHRoZSBjb21wb25lbnQuIElmIG1lc2hlcyBhcmUgbm90IHNldCBvciBsb2FkZWQgZm9yXG4gICAgICogY29tcG9uZW50IGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWVzaEluc3RhbmNlW119XG4gICAgICovXG4gICAgc2V0IG1lc2hJbnN0YW5jZXModmFsdWUpIHtcblxuICAgICAgICB0aGlzLmRlc3Ryb3lNZXNoSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlcyA9IHZhbHVlO1xuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIC8vIGlmIG1lc2ggaW5zdGFuY2Ugd2FzIGNyZWF0ZWQgd2l0aG91dCBhIG5vZGUsIGFzc2lnbiBpdCBoZXJlXG4gICAgICAgICAgICAgICAgaWYgKCFtaVtpXS5ub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLm5vZGUgPSB0aGlzLmVudGl0eTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBtaVtpXS5jYXN0U2hhZG93ID0gdGhpcy5fY2FzdFNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWlbaV0ucmVjZWl2ZVNoYWRvdyA9IHRoaXMuX3JlY2VpdmVTaGFkb3dzO1xuICAgICAgICAgICAgICAgIG1pW2ldLmlzU3RhdGljID0gdGhpcy5faXNTdGF0aWM7XG4gICAgICAgICAgICAgICAgbWlbaV0ucmVuZGVyU3R5bGUgPSB0aGlzLl9yZW5kZXJTdHlsZTtcbiAgICAgICAgICAgICAgICBtaVtpXS5zZXRMaWdodG1hcHBlZCh0aGlzLl9saWdodG1hcHBlZCk7XG4gICAgICAgICAgICAgICAgbWlbaV0uc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1lc2hJbnN0YW5jZXMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBtZXNoZXMgd2lsbCBiZSBsaWdodG1hcHBlZCBhZnRlciB1c2luZyBsaWdodG1hcHBlci5iYWtlKCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgbGlnaHRtYXBwZWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSB0aGlzLl9saWdodG1hcHBlZCkge1xuICAgICAgICAgICAgdGhpcy5fbGlnaHRtYXBwZWQgPSB2YWx1ZTtcblxuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5zZXRMaWdodG1hcHBlZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxpZ2h0bWFwcGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBwZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgYXR0YWNoZWQgbWVzaGVzIHdpbGwgY2FzdCBzaGFkb3dzIGZvciBsaWdodHMgdGhhdCBoYXZlIHNoYWRvdyBjYXN0aW5nIGVuYWJsZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3ModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzICE9PSB2YWx1ZSkge1xuXG4gICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMubGF5ZXJzO1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jYXN0U2hhZG93cyAmJiAhdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLmxheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVTaGFkb3dDYXN0ZXJzKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0uY2FzdFNoYWRvdyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5fY2FzdFNoYWRvd3MgJiYgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gc2NlbmUubGF5ZXJzLmdldExheWVyQnlJZChsYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIuYWRkU2hhZG93Q2FzdGVycyhtaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2Nhc3RTaGFkb3dzID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgY2FzdFNoYWRvd3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBzaGFkb3dzIHdpbGwgYmUgY2FzdCBvbiBhdHRhY2hlZCBtZXNoZXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgcmVjZWl2ZVNoYWRvd3ModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlY2VpdmVTaGFkb3dzICE9PSB2YWx1ZSkge1xuXG4gICAgICAgICAgICB0aGlzLl9yZWNlaXZlU2hhZG93cyA9IHZhbHVlO1xuXG4gICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLnJlY2VpdmVTaGFkb3cgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgcmVjZWl2ZVNoYWRvd3MoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yZWNlaXZlU2hhZG93cztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgbWVzaGVzIHdpbGwgY2FzdCBzaGFkb3dzIHdoZW4gcmVuZGVyaW5nIGxpZ2h0bWFwcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjYXN0U2hhZG93c0xpZ2h0bWFwKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2Nhc3RTaGFkb3dzTGlnaHRtYXAgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgY2FzdFNoYWRvd3NMaWdodG1hcCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nhc3RTaGFkb3dzTGlnaHRtYXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlnaHRtYXAgcmVzb2x1dGlvbiBtdWx0aXBsaWVyLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgbGlnaHRtYXBTaXplTXVsdGlwbGllcih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9saWdodG1hcFNpemVNdWx0aXBsaWVyID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcFNpemVNdWx0aXBsaWVyO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIE1hcmsgbWVzaGVzIGFzIG5vbi1tb3ZhYmxlIChvcHRpbWl6YXRpb24pLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGlzU3RhdGljKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pc1N0YXRpYyAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2lzU3RhdGljID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0uaXNTdGF0aWMgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgaXNTdGF0aWMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pc1N0YXRpYztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBsYXllciBJRHMgKHtAbGluayBMYXllciNpZH0pIHRvIHdoaWNoIHRoZSBtZXNoZXMgc2hvdWxkIGJlbG9uZy4gRG9uJ3QgcHVzaCwgcG9wLFxuICAgICAqIHNwbGljZSBvciBtb2RpZnkgdGhpcyBhcnJheSwgaWYgeW91IHdhbnQgdG8gY2hhbmdlIGl0IC0gc2V0IGEgbmV3IG9uZSBpbnN0ZWFkLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcltdfVxuICAgICAqL1xuICAgIHNldCBsYXllcnModmFsdWUpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgbGV0IGxheWVyO1xuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICAvLyByZW1vdmUgYWxsIG1lc2ggaW5zdGFuY2VzIGZyb20gb2xkIGxheWVyc1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzZXQgdGhlIGxheWVyIGxpc3RcbiAgICAgICAgdGhpcy5fbGF5ZXJzLmxlbmd0aCA9IDA7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2xheWVyc1tpXSA9IHZhbHVlW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZG9uJ3QgYWRkIGludG8gbGF5ZXJzIHVudGlsIHdlJ3JlIGVuYWJsZWRcbiAgICAgICAgaWYgKCF0aGlzLmVuYWJsZWQgfHwgIXRoaXMuZW50aXR5LmVuYWJsZWQgfHwgIXRoaXMuX21lc2hJbnN0YW5jZXMpIHJldHVybjtcblxuICAgICAgICAvLyBhZGQgYWxsIG1lc2ggaW5zdGFuY2VzIHRvIG5ldyBsYXllcnNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsYXllcnMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9sYXllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXNzaWduIG1lc2hlcyB0byBhIHNwZWNpZmljIGJhdGNoIGdyb3VwIChzZWUge0BsaW5rIEJhdGNoR3JvdXB9KS4gRGVmYXVsdCBpcyAtMSAobm8gZ3JvdXApLlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgYmF0Y2hHcm91cElkKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgIT09IHZhbHVlKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/LnJlbW92ZShCYXRjaEdyb3VwLlJFTkRFUiwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLmVudGl0eS5lbmFibGVkICYmIHZhbHVlID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuUkVOREVSLCB2YWx1ZSwgdGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWUgPCAwICYmIHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgLy8gcmUtYWRkIHJlbmRlciB0byBzY2VuZSwgaW4gY2FzZSBpdCB3YXMgcmVtb3ZlZCBieSBiYXRjaGluZ1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9MYXllcnMoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fYmF0Y2hHcm91cElkID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYmF0Y2hHcm91cElkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fYmF0Y2hHcm91cElkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXRlcmlhbCB7QGxpbmsgTWF0ZXJpYWx9IHRoYXQgd2lsbCBiZSB1c2VkIHRvIHJlbmRlciB0aGUgbWVzaGVzIChub3QgdXNlZCBvbiByZW5kZXJzIG9mXG4gICAgICogdHlwZSAnYXNzZXQnKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNYXRlcmlhbH1cbiAgICAgKi9cbiAgICBzZXQgbWF0ZXJpYWwodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSB2YWx1ZTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMgJiYgdGhpcy5fdHlwZSAhPT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIGFzc2V0cyB0aGF0IHdpbGwgYmUgdXNlZCB0byByZW5kZXIgdGhlIG1lc2hlcy4gRWFjaCBtYXRlcmlhbCBjb3JyZXNwb25kcyB0byB0aGVcbiAgICAgKiByZXNwZWN0aXZlIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXNzZXRbXXxudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgbWF0ZXJpYWxBc3NldHModmFsdWUgPSBbXSkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLmxlbmd0aCA+IHZhbHVlLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHZhbHVlLmxlbmd0aDsgaSA8IHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMucHVzaChcbiAgICAgICAgICAgICAgICAgICAgbmV3IEFzc2V0UmVmZXJlbmNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgaSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkOiB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZDogdGhpcy5fb25NYXRlcmlhbExvYWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlOiB0aGlzLl9vbk1hdGVyaWFsUmVtb3ZlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVubG9hZDogdGhpcy5fb25NYXRlcmlhbFVubG9hZFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZVtpXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gdmFsdWVbaV0gaW5zdGFuY2VvZiBBc3NldCA/IHZhbHVlW2ldLmlkIDogdmFsdWVbaV07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCAhPT0gaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmlkID0gaWQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5hc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbk1hdGVyaWFsQWRkZWQoaSwgdGhpcywgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlc1tpXSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbEFzc2V0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5tYXAoZnVuY3Rpb24gKHJlZikge1xuICAgICAgICAgICAgcmV0dXJuIHJlZi5pZDtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbmRlciBhc3NldCBmb3IgdGhlIHJlbmRlciBjb21wb25lbnQgKG9ubHkgYXBwbGllcyB0byB0eXBlICdhc3NldCcpIC0gY2FuIGFsc28gYmUgYW5cbiAgICAgKiBhc3NldCBpZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBc3NldHxudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGlkID0gdmFsdWUgaW5zdGFuY2VvZiBBc3NldCA/IHZhbHVlLmlkIDogdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5pZCA9PT0gaWQpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQgJiYgdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRSZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmlkID0gaWQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9vblJlbmRlckFzc2V0QWRkZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmlkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBhc3NldCBpZCB0byB0aGUgY29tcG9uZW50LCB3aXRob3V0IHVwZGF0aW5nIHRoZSBjb21wb25lbnQgd2l0aCB0aGUgbmV3IGFzc2V0LlxuICAgICAqIFRoaXMgY2FuIGJlIHVzZWQgdG8gYXNzaWduIHRoZSBhc3NldCBpZCB0byBhbHJlYWR5IGZ1bGx5IGNyZWF0ZWQgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBc3NldHxudW1iZXJ9IGFzc2V0IC0gVGhlIHJlbmRlciBhc3NldCBvciBhc3NldCBpZCB0byBhc3NpZ24uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFzc2lnbkFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGNvbnN0IGlkID0gYXNzZXQgaW5zdGFuY2VvZiBBc3NldCA/IGFzc2V0LmlkIDogYXNzZXQ7XG4gICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmlkID0gaWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgc2V0IGFzIHRoZSByb290IGJvbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TZXRSb290Qm9uZShlbnRpdHkpIHtcbiAgICAgICAgaWYgKGVudGl0eSkge1xuICAgICAgICAgICAgdGhpcy5fb25Sb290Qm9uZUNoYW5nZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblJvb3RCb25lQ2hhbmdlZCgpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIHNraW4gaW5zdGFuY2VzIGFuZCBjcmVhdGUgbmV3IG9uZXMsIGNvbm5lY3RlZCB0byBuZXcgcm9vdCBib25lXG4gICAgICAgIHRoaXMuX2NsZWFyU2tpbkluc3RhbmNlcygpO1xuICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nsb25lU2tpbkluc3RhbmNlcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgZGVzdHJveU1lc2hJbnN0YW5jZXMoKSB7XG5cbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZyb21MYXllcnMoKTtcblxuICAgICAgICAgICAgLy8gZGVzdHJveSBtZXNoIGluc3RhbmNlcyBzZXBhcmF0ZWx5IHRvIGFsbG93IHRoZW0gdG8gYmUgcmVtb3ZlZCBmcm9tIHRoZSBjYWNoZVxuICAgICAgICAgICAgdGhpcy5fY2xlYXJTa2luSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgYWRkVG9MYXllcnMoKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVGcm9tTGF5ZXJzKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcyAmJiB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgb25SZW1vdmVDaGlsZCgpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgb25JbnNlcnRDaGlsZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9MYXllcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLmRlc3Ryb3lNZXNoSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgdGhpcy5hc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQgPSBudWxsO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ2luc2VydCcsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgdGhpcy5fcm9vdEJvbmUub25QYXJlbnRDb21wb25lbnRFbmFibGUoKTtcblxuICAgICAgICB0aGlzLl9jbG9uZVNraW5JbnN0YW5jZXMoKTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNBc3NldCA9ICh0aGlzLl90eXBlID09PSAnYXNzZXQnKTtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMgJiYgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9MYXllcnMoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0Fzc2V0ICYmIHRoaXMuYXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRBZGRlZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9hZCBtYXRlcmlhbHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQodGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLlJFTkRFUiwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuUkVOREVSLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcCByZW5kZXJpbmcge0BsaW5rIE1lc2hJbnN0YW5jZX1zIHdpdGhvdXQgcmVtb3ZpbmcgdGhlbSBmcm9tIHRoZSBzY2VuZSBoaWVyYXJjaHkuIFRoaXNcbiAgICAgKiBtZXRob2Qgc2V0cyB0aGUge0BsaW5rIE1lc2hJbnN0YW5jZSN2aXNpYmxlfSBwcm9wZXJ0eSBvZiBldmVyeSBNZXNoSW5zdGFuY2UgdG8gZmFsc2UuIE5vdGUsXG4gICAgICogdGhpcyBkb2VzIG5vdCByZW1vdmUgdGhlIG1lc2ggaW5zdGFuY2VzIGZyb20gdGhlIHNjZW5lIGhpZXJhcmNoeSBvciBkcmF3IGNhbGwgbGlzdC4gU28gdGhlXG4gICAgICogcmVuZGVyIGNvbXBvbmVudCBzdGlsbCBpbmN1cnMgc29tZSBDUFUgb3ZlcmhlYWQuXG4gICAgICovXG4gICAgaGlkZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaV0udmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHJlbmRlcmluZyBvZiB0aGUgY29tcG9uZW50J3Mge0BsaW5rIE1lc2hJbnN0YW5jZX1zIGlmIGhpZGRlbiB1c2luZ1xuICAgICAqIHtAbGluayBSZW5kZXJDb21wb25lbnQjaGlkZX0uIFRoaXMgbWV0aG9kIHNldHMgdGhlIHtAbGluayBNZXNoSW5zdGFuY2UjdmlzaWJsZX0gcHJvcGVydHkgb25cbiAgICAgKiBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gdHJ1ZS5cbiAgICAgKi9cbiAgICBzaG93KCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpXS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0QWRkZWQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZCh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldExvYWQoKSB7XG5cbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIGluc3RhbmNlc1xuICAgICAgICB0aGlzLmRlc3Ryb3lNZXNoSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXIgPSB0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIHJlbmRlci5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgICAgICByZW5kZXIub24oJ3NldDptZXNoZXMnLCB0aGlzLl9vblNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgICAgICBpZiAocmVuZGVyLm1lc2hlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuX29uU2V0TWVzaGVzKHJlbmRlci5tZXNoZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2V0TWVzaGVzKG1lc2hlcykge1xuICAgICAgICB0aGlzLl9jbG9uZU1lc2hlcyhtZXNoZXMpO1xuICAgIH1cblxuICAgIF9jbGVhclNraW5JbnN0YW5jZXMoKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSB0aGlzLl9tZXNoSW5zdGFuY2VzW2ldO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgaXQgZnJvbSB0aGUgY2FjaGVcbiAgICAgICAgICAgIFNraW5JbnN0YW5jZUNhY2hlLnJlbW92ZUNhY2hlZFNraW5JbnN0YW5jZShtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlKTtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Nsb25lU2tpbkluc3RhbmNlcygpIHtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGggJiYgdGhpcy5fcm9vdEJvbmUuZW50aXR5IGluc3RhbmNlb2YgR3JhcGhOb2RlKSB7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHRoaXMuX21lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgc2tpbm5lZCBidXQgZG9lcyBub3QgaGF2ZSBpbnN0YW5jZSBjcmVhdGVkIHlldFxuICAgICAgICAgICAgICAgIGlmIChtZXNoLnNraW4gJiYgIW1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA9IFNraW5JbnN0YW5jZUNhY2hlLmNyZWF0ZUNhY2hlZFNraW5JbnN0YW5jZShtZXNoLnNraW4sIHRoaXMuX3Jvb3RCb25lLmVudGl0eSwgdGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jbG9uZU1lc2hlcyhtZXNoZXMpIHtcblxuICAgICAgICBpZiAobWVzaGVzICYmIG1lc2hlcy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgLy8gY2xvbmVkIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gW107XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hlc1tpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXSAmJiB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQgJiYgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0ID0gbmV3IE1lc2hJbnN0YW5jZShtZXNoLCBtYXRlcmlhbCB8fCB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzLnB1c2gobWVzaEluc3QpO1xuXG4gICAgICAgICAgICAgICAgLy8gbW9ycGggaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBpZiAobWVzaC5tb3JwaCkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdC5tb3JwaEluc3RhbmNlID0gbmV3IE1vcnBoSW5zdGFuY2UobWVzaC5tb3JwaCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZXMgPSBtZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICAvLyB0cnkgdG8gY3JlYXRlIHNraW4gaW5zdGFuY2VzIGlmIHJvb3RCb25lIGhhcyBiZWVuIHNldCwgb3RoZXJ3aXNlIHRoaXMgZXhlY3V0ZXMgd2hlbiByb290Qm9uZSBpcyBzZXQgbGF0ZXJcbiAgICAgICAgICAgIHRoaXMuX2Nsb25lU2tpbkluc3RhbmNlcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRVbmxvYWQoKSB7XG5cbiAgICAgICAgLy8gd2hlbiB1bmxvYWRpbmcgYXNzZXQsIG9ubHkgcmVtb3ZlIGFzc2V0IG1lc2ggaW5zdGFuY2VzICh0eXBlIGNvdWxkIGhhdmUgYmVlbiBhbHJlYWR5IGNoYW5nZWQgdG8gJ2JveCcgb3Igc2ltaWxhcilcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0UmVtb3ZlKCkge1xuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQgJiYgdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0LnJlc291cmNlLm9mZignc2V0Om1lc2hlcycsIHRoaXMuX29uU2V0TWVzaGVzLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRVbmxvYWQoKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbEFkZGVkKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbExvYWQoaW5kZXgsIGNvbXBvbmVudCwgYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVNYWluTWF0ZXJpYWwoaW5kZXgsIG1hdGVyaWFsKSB7XG4gICAgICAgIC8vIGZpcnN0IG1hdGVyaWFsIGZvciBwcmltaXRpdmVzIGNhbiBiZSBhY2Nlc3NlZCB1c2luZyBtYXRlcmlhbCBwcm9wZXJ0eSwgc28gc2V0IGl0IHVwXG4gICAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTWF0ZXJpYWxMb2FkKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzW2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0ubWF0ZXJpYWwgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl91cGRhdGVNYWluTWF0ZXJpYWwoaW5kZXgsIGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFJlbW92ZShpbmRleCwgY29tcG9uZW50LCBhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0pIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaW5kZXhdLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFVubG9hZChpbmRleCwgY29tcG9uZW50LCBhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0pIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaW5kZXhdLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMob2xkUmVuZGVyLCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIGlmIChvbGRSZW5kZXIucm9vdEJvbmUgJiYgZHVwbGljYXRlZElkc01hcFtvbGRSZW5kZXIucm9vdEJvbmVdKSB7XG4gICAgICAgICAgICB0aGlzLnJvb3RCb25lID0gZHVwbGljYXRlZElkc01hcFtvbGRSZW5kZXIucm9vdEJvbmVdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NsZWFyU2tpbkluc3RhbmNlcygpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVuZGVyQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiUmVuZGVyQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfdHlwZSIsIl9jYXN0U2hhZG93cyIsIl9yZWNlaXZlU2hhZG93cyIsIl9jYXN0U2hhZG93c0xpZ2h0bWFwIiwiX2xpZ2h0bWFwcGVkIiwiX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJfaXNTdGF0aWMiLCJfYmF0Y2hHcm91cElkIiwiX2xheWVycyIsIkxBWUVSSURfV09STEQiLCJfcmVuZGVyU3R5bGUiLCJSRU5ERVJTVFlMRV9TT0xJRCIsIl9tZXNoSW5zdGFuY2VzIiwiX2N1c3RvbUFhYmIiLCJfYXJlYSIsIl9hc3NldFJlZmVyZW5jZSIsIl9tYXRlcmlhbFJlZmVyZW5jZXMiLCJfbWF0ZXJpYWwiLCJfcm9vdEJvbmUiLCJFbnRpdHlSZWZlcmVuY2UiLCJvbiIsIl9vblNldFJvb3RCb25lIiwiQXNzZXRSZWZlcmVuY2UiLCJhcHAiLCJhc3NldHMiLCJhZGQiLCJfb25SZW5kZXJBc3NldEFkZGVkIiwibG9hZCIsIl9vblJlbmRlckFzc2V0TG9hZCIsInJlbW92ZSIsIl9vblJlbmRlckFzc2V0UmVtb3ZlIiwidW5sb2FkIiwiX29uUmVuZGVyQXNzZXRVbmxvYWQiLCJkZWZhdWx0TWF0ZXJpYWwiLCJvblJlbW92ZUNoaWxkIiwib25JbnNlcnRDaGlsZCIsInJlbmRlclN0eWxlIiwiTWVzaEluc3RhbmNlIiwiX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5IiwiY3VzdG9tQWFiYiIsInZhbHVlIiwibWkiLCJpIiwibGVuZ3RoIiwic2V0Q3VzdG9tQWFiYiIsInR5cGUiLCJkZXN0cm95TWVzaEluc3RhbmNlcyIsIm1hdGVyaWFsIiwiYXNzZXQiLCJyZXNvdXJjZSIsInByaW1EYXRhIiwiZ2V0U2hhcGVQcmltaXRpdmUiLCJncmFwaGljc0RldmljZSIsImFyZWEiLCJtZXNoSW5zdGFuY2VzIiwibWVzaCIsIm5vZGUiLCJjYXN0U2hhZG93IiwicmVjZWl2ZVNoYWRvdyIsImlzU3RhdGljIiwic2V0TGlnaHRtYXBwZWQiLCJlbmFibGVkIiwiYWRkVG9MYXllcnMiLCJsaWdodG1hcHBlZCIsImNhc3RTaGFkb3dzIiwibGF5ZXJzIiwic2NlbmUiLCJsYXllciIsImdldExheWVyQnlJZCIsInJlbW92ZVNoYWRvd0Nhc3RlcnMiLCJhZGRTaGFkb3dDYXN0ZXJzIiwicmVjZWl2ZVNoYWRvd3MiLCJjYXN0U2hhZG93c0xpZ2h0bWFwIiwibGlnaHRtYXBTaXplTXVsdGlwbGllciIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJhZGRNZXNoSW5zdGFuY2VzIiwiYmF0Y2hHcm91cElkIiwiYmF0Y2hlciIsIkJhdGNoR3JvdXAiLCJSRU5ERVIiLCJpbnNlcnQiLCJtYXRlcmlhbEFzc2V0cyIsImlkIiwicHVzaCIsIl9vbk1hdGVyaWFsQWRkZWQiLCJfb25NYXRlcmlhbExvYWQiLCJfb25NYXRlcmlhbFJlbW92ZSIsIl9vbk1hdGVyaWFsVW5sb2FkIiwiQXNzZXQiLCJtYXAiLCJyZWYiLCJhc3NpZ25Bc3NldCIsIl9vblJvb3RCb25lQ2hhbmdlZCIsIl9jbGVhclNraW5JbnN0YW5jZXMiLCJfY2xvbmVTa2luSW5zdGFuY2VzIiwicmVtb3ZlRnJvbUxheWVycyIsImRlc3Ryb3kiLCJvblJlbW92ZSIsIm1hdGVyaWFsQXNzZXQiLCJvZmYiLCJvbkxheWVyc0NoYW5nZWQiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpbmRleE9mIiwib25FbmFibGUiLCJvblBhcmVudENvbXBvbmVudEVuYWJsZSIsImlzQXNzZXQiLCJvbkRpc2FibGUiLCJoaWRlIiwidmlzaWJsZSIsInNob3ciLCJyZW5kZXIiLCJfb25TZXRNZXNoZXMiLCJtZXNoZXMiLCJfY2xvbmVNZXNoZXMiLCJtZXNoSW5zdGFuY2UiLCJTa2luSW5zdGFuY2VDYWNoZSIsInJlbW92ZUNhY2hlZFNraW5JbnN0YW5jZSIsInNraW5JbnN0YW5jZSIsIkdyYXBoTm9kZSIsInNraW4iLCJjcmVhdGVDYWNoZWRTa2luSW5zdGFuY2UiLCJtZXNoSW5zdCIsIm1vcnBoIiwibW9ycGhJbnN0YW5jZSIsIk1vcnBoSW5zdGFuY2UiLCJjb21wb25lbnQiLCJfdXBkYXRlTWFpbk1hdGVyaWFsIiwicmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzIiwib2xkUmVuZGVyIiwiZHVwbGljYXRlZElkc01hcCIsInJvb3RCb25lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQTRCQSxNQUFNQSxlQUFOLFNBQThCQyxTQUE5QixDQUF3QztBQW9GcENDLEVBQUFBLFdBQVcsQ0FBQ0MsTUFBRCxFQUFTQyxNQUFULEVBQWlCO0lBQ3hCLEtBQU1ELENBQUFBLE1BQU4sRUFBY0MsTUFBZCxDQUFBLENBQUE7SUFEd0IsSUFsRjVCQyxDQUFBQSxLQWtGNEIsR0FsRnBCLE9Ba0ZvQixDQUFBO0lBQUEsSUEvRTVCQyxDQUFBQSxZQStFNEIsR0EvRWIsSUErRWEsQ0FBQTtJQUFBLElBNUU1QkMsQ0FBQUEsZUE0RTRCLEdBNUVWLElBNEVVLENBQUE7SUFBQSxJQXpFNUJDLENBQUFBLG9CQXlFNEIsR0F6RUwsSUF5RUssQ0FBQTtJQUFBLElBdEU1QkMsQ0FBQUEsWUFzRTRCLEdBdEViLEtBc0VhLENBQUE7SUFBQSxJQW5FNUJDLENBQUFBLHVCQW1FNEIsR0FuRUYsQ0FtRUUsQ0FBQTtJQUFBLElBaEU1QkMsQ0FBQUEsU0FnRTRCLEdBaEVoQixLQWdFZ0IsQ0FBQTtJQUFBLElBN0Q1QkMsQ0FBQUEsYUE2RDRCLEdBN0RaLENBQUMsQ0E2RFcsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQTFENUJDLE9BMEQ0QixHQTFEbEIsQ0FBQ0MsYUFBRCxDQTBEa0IsQ0FBQTtJQUFBLElBdkQ1QkMsQ0FBQUEsWUF1RDRCLEdBdkRiQyxpQkF1RGEsQ0FBQTtJQUFBLElBakQ1QkMsQ0FBQUEsY0FpRDRCLEdBakRYLEVBaURXLENBQUE7SUFBQSxJQTNDNUJDLENB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
