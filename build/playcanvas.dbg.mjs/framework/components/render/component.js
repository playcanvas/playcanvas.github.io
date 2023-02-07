/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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

/**
 * Enables an Entity to render a {@link Mesh} or a primitive shape. This component attaches
 * {@link MeshInstance} geometry to the Entity.
 *
 * @property {import('../../entity.js').Entity} rootBone A reference to the entity to be used as
 * the root bone for any skinned meshes that are rendered by this component.
 * @augments Component
 */
class RenderComponent extends Component {
  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */

  /** @private */
  // assign to the default world layer

  /** @private */

  /**
   * @type {MeshInstance[]}
   * @private
   */

  /**
   * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
   * @private
   */

  /**
   * Used by lightmapper.
   *
   * @type {{x: number, y: number, z: number, uv: number}|null}
   * @ignore
   */

  /**
   * @type {AssetReference}
   * @private
   */

  /**
   * @type {AssetReference[]}
   * @private
   */

  /**
   * Material used to render meshes other than asset type. It gets priority when set to
   * something else than defaultMaterial, otherwise materialASsets[0] is used.
   *
   * @type {import('../../../scene/materials/material.js').Material}
   * @private
   */

  /**
   * @type {EntityReference}
   * @private
   */

  /**
   * Create a new RenderComponent.
   *
   * @param {import('./system.js').RenderComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
  constructor(system, entity) {
    super(system, entity);

    // the entity that represents the root bone if this render component has skinned meshes
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

    // render asset reference
    this._assetReference = new AssetReference('asset', this, system.app.assets, {
      add: this._onRenderAssetAdded,
      load: this._onRenderAssetLoad,
      remove: this._onRenderAssetRemove,
      unload: this._onRenderAssetUnload
    }, this);
    this._material = system.defaultMaterial;

    // handle events when the entity is directly (or indirectly as a child of sub-hierarchy)
    // added or removed from the parent
    entity.on('remove', this.onRemoveChild, this);
    entity.on('removehierarchy', this.onRemoveChild, this);
    entity.on('insert', this.onInsertChild, this);
    entity.on('inserthierarchy', this.onInsertChild, this);
  }

  /**
   * Set rendering of all {@link MeshInstance}s to the specified render style. Can be:
   *
   * - {@link RENDERSTYLE_SOLID}
   * - {@link RENDERSTYLE_WIREFRAME}
   * - {@link RENDERSTYLE_POINTS}
   *
   * Defaults to {@link RENDERSTYLE_SOLID}.
   *
   * @type {number}
   */
  set renderStyle(renderStyle) {
    if (this._renderStyle !== renderStyle) {
      this._renderStyle = renderStyle;
      MeshInstance._prepareRenderStyleForArray(this._meshInstances, renderStyle);
    }
  }
  get renderStyle() {
    return this._renderStyle;
  }

  /**
   * If set, the object space bounding box is used as a bounding box for visibility culling of
   * attached mesh instances. This is an optimization, allowing oversized bounding box to be
   * specified for skinned characters in order to avoid per frame bounding box computations based
   * on bone positions.
   *
   * @type {import('../../../core/shape/bounding-box.js').BoundingBox}
   */
  set customAabb(value) {
    this._customAabb = value;

    // set it on meshInstances
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

  /**
   * The type of the render. Can be one of the following:
   *
   * - "asset": The component will render a render asset
   * - "box": The component will render a box (1 unit in each dimension)
   * - "capsule": The component will render a capsule (radius 0.5, height 2)
   * - "cone": The component will render a cone (radius 0.5, height 1)
   * - "cylinder": The component will render a cylinder (radius 0.5, height 1)
   * - "plane": The component will render a plane (1 unit in each dimension)
   * - "sphere": The component will render a sphere (radius 0.5)
   * - "torus": The component will render a torus (tubeRadius: 0.2, ringRadius: 0.3)
   *
   * @type {string}
   */
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

  /**
   * An array of meshInstances contained in the component. If meshes are not set or loaded for
   * component it will return null.
   *
   * @type {MeshInstance[]}
   */
  set meshInstances(value) {
    this.destroyMeshInstances();
    this._meshInstances = value;
    if (this._meshInstances) {
      const mi = this._meshInstances;
      for (let i = 0; i < mi.length; i++) {
        // if mesh instance was created without a node, assign it here
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

  /**
   * If true, the meshes will be lightmapped after using lightmapper.bake().
   *
   * @type {boolean}
   */
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

  /**
   * If true, attached meshes will cast shadows for lights that have shadow casting enabled.
   *
   * @type {boolean}
   */
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

  /**
   * If true, shadows will be cast on attached meshes.
   *
   * @type {boolean}
   */
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

  /**
   * If true, the meshes will cast shadows when rendering lightmaps.
   *
   * @type {boolean}
   */
  set castShadowsLightmap(value) {
    this._castShadowsLightmap = value;
  }
  get castShadowsLightmap() {
    return this._castShadowsLightmap;
  }

  /**
   * Lightmap resolution multiplier.
   *
   * @type {number}
   */
  set lightmapSizeMultiplier(value) {
    this._lightmapSizeMultiplier = value;
  }
  get lightmapSizeMultiplier() {
    return this._lightmapSizeMultiplier;
  }

  /**
   * Mark meshes as non-movable (optimization).
   *
   * @type {boolean}
   */
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

  /**
   * An array of layer IDs ({@link Layer#id}) to which the meshes should belong. Don't push, pop,
   * splice or modify this array, if you want to change it - set a new one instead.
   *
   * @type {number[]}
   */
  set layers(value) {
    const layers = this.system.app.scene.layers;
    let layer;
    if (this._meshInstances) {
      // remove all mesh instances from old layers
      for (let i = 0; i < this._layers.length; i++) {
        layer = layers.getLayerById(this._layers[i]);
        if (layer) {
          layer.removeMeshInstances(this._meshInstances);
        }
      }
    }

    // set the layer list
    this._layers.length = 0;
    for (let i = 0; i < value.length; i++) {
      this._layers[i] = value[i];
    }

    // don't add into layers until we're enabled
    if (!this.enabled || !this.entity.enabled || !this._meshInstances) return;

    // add all mesh instances to new layers
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

  /**
   * Assign meshes to a specific batch group (see {@link BatchGroup}). Default is -1 (no group).
   *
   * @type {number}
   */
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
        // re-add render to scene, in case it was removed by batching
        this.addToLayers();
      }
      this._batchGroupId = value;
    }
  }
  get batchGroupId() {
    return this._batchGroupId;
  }

  /**
   * The material {@link Material} that will be used to render the meshes (not used on renders of
   * type 'asset').
   *
   * @type {import('../../../scene/materials/material.js').Material}
   */
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

  /**
   * The material assets that will be used to render the meshes. Each material corresponds to the
   * respective mesh instance.
   *
   * @type {Asset[]|number[]}
   */
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

  /**
   * The render asset for the render component (only applies to type 'asset') - can also be an
   * asset id.
   *
   * @type {Asset|number}
   */
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

  /**
   * Assign asset id to the component, without updating the component with the new asset.
   * This can be used to assign the asset id to already fully created component.
   *
   * @param {Asset|number} asset - The render asset or asset id to assign.
   * @ignore
   */
  assignAsset(asset) {
    const id = asset instanceof Asset ? asset.id : asset;
    this._assetReference.id = id;
  }

  /**
   * @param {import('../../entity.js').Entity} entity - The entity set as the root bone.
   * @private
   */
  _onSetRootBone(entity) {
    if (entity) {
      this._onRootBoneChanged();
    }
  }

  /** @private */
  _onRootBoneChanged() {
    // remove existing skin instances and create new ones, connected to new root bone
    this._clearSkinInstances();
    if (this.enabled && this.entity.enabled) {
      this._cloneSkinInstances();
    }
  }

  /** @private */
  destroyMeshInstances() {
    const meshInstances = this._meshInstances;
    if (meshInstances) {
      this.removeFromLayers();

      // destroy mesh instances separately to allow them to be removed from the cache
      this._clearSkinInstances();
      for (let i = 0; i < meshInstances.length; i++) {
        meshInstances[i].destroy();
      }
      this._meshInstances.length = 0;
    }
  }

  /** @private */
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

  /** @private */
  onRemoveChild() {
    this.removeFromLayers();
  }

  /** @private */
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

    // load materials
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

  /**
   * Stop rendering {@link MeshInstance}s without removing them from the scene hierarchy. This
   * method sets the {@link MeshInstance#visible} property of every MeshInstance to false. Note,
   * this does not remove the mesh instances from the scene hierarchy or draw call list. So the
   * render component still incurs some CPU overhead.
   */
  hide() {
    if (this._meshInstances) {
      for (let i = 0; i < this._meshInstances.length; i++) {
        this._meshInstances[i].visible = false;
      }
    }
  }

  /**
   * Enable rendering of the component's {@link MeshInstance}s if hidden using
   * {@link RenderComponent#hide}. This method sets the {@link MeshInstance#visible} property on
   * all mesh instances to true.
   */
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
    // remove existing instances
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

      // remove it from the cache
      SkinInstanceCache.removeCachedSkinInstance(meshInstance.skinInstance);
      meshInstance.skinInstance = null;
    }
  }
  _cloneSkinInstances() {
    if (this._meshInstances.length && this._rootBone.entity instanceof GraphNode) {
      for (let i = 0; i < this._meshInstances.length; i++) {
        const meshInstance = this._meshInstances[i];
        const mesh = meshInstance.mesh;

        // if skinned but does not have instance created yet
        if (mesh.skin && !meshInstance.skinInstance) {
          meshInstance.skinInstance = SkinInstanceCache.createCachedSkinInstance(mesh.skin, this._rootBone.entity, this.entity);
        }
      }
    }
  }
  _cloneMeshes(meshes) {
    if (meshes && meshes.length) {
      // cloned mesh instances
      const meshInstances = [];
      for (let i = 0; i < meshes.length; i++) {
        // mesh instance
        const mesh = meshes[i];
        const material = this._materialReferences[i] && this._materialReferences[i].asset && this._materialReferences[i].asset.resource;
        const meshInst = new MeshInstance(mesh, material || this.system.defaultMaterial, this.entity);
        meshInstances.push(meshInst);

        // morph instance
        if (mesh.morph) {
          meshInst.morphInstance = new MorphInstance(mesh.morph);
        }
      }
      this.meshInstances = meshInstances;

      // try to create skin instances if rootBone has been set, otherwise this executes when rootBone is set later
      this._cloneSkinInstances();
    }
  }
  _onRenderAssetUnload() {
    // when unloading asset, only remove asset mesh instances (type could have been already changed to 'box' or similar)
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
    // first material for primitives can be accessed using material property, so set it up
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmVuZGVyL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBMQVlFUklEX1dPUkxELCBSRU5ERVJTVFlMRV9TT0xJRCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBCYXRjaEdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvYmF0Y2hpbmcvYmF0Y2gtZ3JvdXAuanMnO1xuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBNb3JwaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvbW9ycGgtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgZ2V0U2hhcGVQcmltaXRpdmUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9wcm9jZWR1cmFsLmpzJztcbmltcG9ydCB7IEdyYXBoTm9kZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2dyYXBoLW5vZGUuanMnO1xuaW1wb3J0IHsgU2tpbkluc3RhbmNlQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9za2luLWluc3RhbmNlLWNhY2hlLmpzJztcblxuaW1wb3J0IHsgQXNzZXQgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC5qcyc7XG5pbXBvcnQgeyBBc3NldFJlZmVyZW5jZSB9IGZyb20gJy4uLy4uL2Fzc2V0L2Fzc2V0LXJlZmVyZW5jZS5qcyc7XG5cbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5cbmltcG9ydCB7IEVudGl0eVJlZmVyZW5jZSB9IGZyb20gJy4uLy4uL3V0aWxzL2VudGl0eS1yZWZlcmVuY2UuanMnO1xuXG4vKipcbiAqIEVuYWJsZXMgYW4gRW50aXR5IHRvIHJlbmRlciBhIHtAbGluayBNZXNofSBvciBhIHByaW1pdGl2ZSBzaGFwZS4gVGhpcyBjb21wb25lbnQgYXR0YWNoZXNcbiAqIHtAbGluayBNZXNoSW5zdGFuY2V9IGdlb21ldHJ5IHRvIHRoZSBFbnRpdHkuXG4gKlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gcm9vdEJvbmUgQSByZWZlcmVuY2UgdG8gdGhlIGVudGl0eSB0byBiZSB1c2VkIGFzXG4gKiB0aGUgcm9vdCBib25lIGZvciBhbnkgc2tpbm5lZCBtZXNoZXMgdGhhdCBhcmUgcmVuZGVyZWQgYnkgdGhpcyBjb21wb25lbnQuXG4gKiBAYXVnbWVudHMgQ29tcG9uZW50XG4gKi9cbmNsYXNzIFJlbmRlckNvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3R5cGUgPSAnYXNzZXQnO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2Nhc3RTaGFkb3dzID0gdHJ1ZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9yZWNlaXZlU2hhZG93cyA9IHRydWU7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfY2FzdFNoYWRvd3NMaWdodG1hcCA9IHRydWU7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbGlnaHRtYXBwZWQgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9saWdodG1hcFNpemVNdWx0aXBsaWVyID0gMTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9pc1N0YXRpYyA9IGZhbHNlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2JhdGNoR3JvdXBJZCA9IC0xO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2xheWVycyA9IFtMQVlFUklEX1dPUkxEXTsgLy8gYXNzaWduIHRvIHRoZSBkZWZhdWx0IHdvcmxkIGxheWVyXG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfcmVuZGVyU3R5bGUgPSBSRU5ERVJTVFlMRV9TT0xJRDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtNZXNoSW5zdGFuY2VbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tZXNoSW5zdGFuY2VzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL3NoYXBlL2JvdW5kaW5nLWJveC5qcycpLkJvdW5kaW5nQm94fG51bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfY3VzdG9tQWFiYiA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBVc2VkIGJ5IGxpZ2h0bWFwcGVyLlxuICAgICAqXG4gICAgICogQHR5cGUge3t4OiBudW1iZXIsIHk6IG51bWJlciwgejogbnVtYmVyLCB1djogbnVtYmVyfXxudWxsfVxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBfYXJlYSA9IG51bGw7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXNzZXRSZWZlcmVuY2V9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYXNzZXRSZWZlcmVuY2UgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtBc3NldFJlZmVyZW5jZVtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hdGVyaWFsUmVmZXJlbmNlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogTWF0ZXJpYWwgdXNlZCB0byByZW5kZXIgbWVzaGVzIG90aGVyIHRoYW4gYXNzZXQgdHlwZS4gSXQgZ2V0cyBwcmlvcml0eSB3aGVuIHNldCB0b1xuICAgICAqIHNvbWV0aGluZyBlbHNlIHRoYW4gZGVmYXVsdE1hdGVyaWFsLCBvdGhlcndpc2UgbWF0ZXJpYWxBU3NldHNbMF0gaXMgdXNlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL3NjZW5lL21hdGVyaWFscy9tYXRlcmlhbC5qcycpLk1hdGVyaWFsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX21hdGVyaWFsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0VudGl0eVJlZmVyZW5jZX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9yb290Qm9uZTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBSZW5kZXJDb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5SZW5kZXJDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIC8vIHRoZSBlbnRpdHkgdGhhdCByZXByZXNlbnRzIHRoZSByb290IGJvbmUgaWYgdGhpcyByZW5kZXIgY29tcG9uZW50IGhhcyBza2lubmVkIG1lc2hlc1xuICAgICAgICB0aGlzLl9yb290Qm9uZSA9IG5ldyBFbnRpdHlSZWZlcmVuY2UodGhpcywgJ3Jvb3RCb25lJyk7XG4gICAgICAgIHRoaXMuX3Jvb3RCb25lLm9uKCdzZXQ6ZW50aXR5JywgdGhpcy5fb25TZXRSb290Qm9uZSwgdGhpcyk7XG5cbiAgICAgICAgLy8gcmVuZGVyIGFzc2V0IHJlZmVyZW5jZVxuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZSA9IG5ldyBBc3NldFJlZmVyZW5jZShcbiAgICAgICAgICAgICdhc3NldCcsXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgc3lzdGVtLmFwcC5hc3NldHMsIHtcbiAgICAgICAgICAgICAgICBhZGQ6IHRoaXMuX29uUmVuZGVyQXNzZXRBZGRlZCxcbiAgICAgICAgICAgICAgICBsb2FkOiB0aGlzLl9vblJlbmRlckFzc2V0TG9hZCxcbiAgICAgICAgICAgICAgICByZW1vdmU6IHRoaXMuX29uUmVuZGVyQXNzZXRSZW1vdmUsXG4gICAgICAgICAgICAgICAgdW5sb2FkOiB0aGlzLl9vblJlbmRlckFzc2V0VW5sb2FkXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGhpc1xuICAgICAgICApO1xuXG4gICAgICAgIHRoaXMuX21hdGVyaWFsID0gc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcblxuICAgICAgICAvLyBoYW5kbGUgZXZlbnRzIHdoZW4gdGhlIGVudGl0eSBpcyBkaXJlY3RseSAob3IgaW5kaXJlY3RseSBhcyBhIGNoaWxkIG9mIHN1Yi1oaWVyYXJjaHkpXG4gICAgICAgIC8vIGFkZGVkIG9yIHJlbW92ZWQgZnJvbSB0aGUgcGFyZW50XG4gICAgICAgIGVudGl0eS5vbigncmVtb3ZlJywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdyZW1vdmVoaWVyYXJjaHknLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ2luc2VydCcsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbignaW5zZXJ0aGllcmFyY2h5JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgcmVuZGVyaW5nIG9mIGFsbCB7QGxpbmsgTWVzaEluc3RhbmNlfXMgdG8gdGhlIHNwZWNpZmllZCByZW5kZXIgc3R5bGUuIENhbiBiZTpcbiAgICAgKlxuICAgICAqIC0ge0BsaW5rIFJFTkRFUlNUWUxFX1NPTElEfVxuICAgICAqIC0ge0BsaW5rIFJFTkRFUlNUWUxFX1dJUkVGUkFNRX1cbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9QT0lOVFN9XG4gICAgICpcbiAgICAgKiBEZWZhdWx0cyB0byB7QGxpbmsgUkVOREVSU1RZTEVfU09MSUR9LlxuICAgICAqXG4gICAgICogQHR5cGUge251bWJlcn1cbiAgICAgKi9cbiAgICBzZXQgcmVuZGVyU3R5bGUocmVuZGVyU3R5bGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX3JlbmRlclN0eWxlICE9PSByZW5kZXJTdHlsZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVuZGVyU3R5bGUgPSByZW5kZXJTdHlsZTtcbiAgICAgICAgICAgIE1lc2hJbnN0YW5jZS5fcHJlcGFyZVJlbmRlclN0eWxlRm9yQXJyYXkodGhpcy5fbWVzaEluc3RhbmNlcywgcmVuZGVyU3R5bGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlbmRlclN0eWxlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVuZGVyU3R5bGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgc2V0LCB0aGUgb2JqZWN0IHNwYWNlIGJvdW5kaW5nIGJveCBpcyB1c2VkIGFzIGEgYm91bmRpbmcgYm94IGZvciB2aXNpYmlsaXR5IGN1bGxpbmcgb2ZcbiAgICAgKiBhdHRhY2hlZCBtZXNoIGluc3RhbmNlcy4gVGhpcyBpcyBhbiBvcHRpbWl6YXRpb24sIGFsbG93aW5nIG92ZXJzaXplZCBib3VuZGluZyBib3ggdG8gYmVcbiAgICAgKiBzcGVjaWZpZWQgZm9yIHNraW5uZWQgY2hhcmFjdGVycyBpbiBvcmRlciB0byBhdm9pZCBwZXIgZnJhbWUgYm91bmRpbmcgYm94IGNvbXB1dGF0aW9ucyBiYXNlZFxuICAgICAqIG9uIGJvbmUgcG9zaXRpb25zLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnKS5Cb3VuZGluZ0JveH1cbiAgICAgKi9cbiAgICBzZXQgY3VzdG9tQWFiYih2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jdXN0b21BYWJiID0gdmFsdWU7XG5cbiAgICAgICAgLy8gc2V0IGl0IG9uIG1lc2hJbnN0YW5jZXNcbiAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBtaVtpXS5zZXRDdXN0b21BYWJiKHRoaXMuX2N1c3RvbUFhYmIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGN1c3RvbUFhYmIoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jdXN0b21BYWJiO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSB0eXBlIG9mIHRoZSByZW5kZXIuIENhbiBiZSBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgICAgKlxuICAgICAqIC0gXCJhc3NldFwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgcmVuZGVyIGFzc2V0XG4gICAgICogLSBcImJveFwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgYm94ICgxIHVuaXQgaW4gZWFjaCBkaW1lbnNpb24pXG4gICAgICogLSBcImNhcHN1bGVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGNhcHN1bGUgKHJhZGl1cyAwLjUsIGhlaWdodCAyKVxuICAgICAqIC0gXCJjb25lXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBjb25lIChyYWRpdXMgMC41LCBoZWlnaHQgMSlcbiAgICAgKiAtIFwiY3lsaW5kZXJcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGN5bGluZGVyIChyYWRpdXMgMC41LCBoZWlnaHQgMSlcbiAgICAgKiAtIFwicGxhbmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIHBsYW5lICgxIHVuaXQgaW4gZWFjaCBkaW1lbnNpb24pXG4gICAgICogLSBcInNwaGVyZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgc3BoZXJlIChyYWRpdXMgMC41KVxuICAgICAqIC0gXCJ0b3J1c1wiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgdG9ydXMgKHR1YmVSYWRpdXM6IDAuMiwgcmluZ1JhZGl1czogMC4zKVxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBzZXQgdHlwZSh2YWx1ZSkge1xuXG4gICAgICAgIGlmICh0aGlzLl90eXBlICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fYXJlYSA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLl90eXBlID0gdmFsdWU7XG5cbiAgICAgICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcblxuICAgICAgICAgICAgaWYgKHZhbHVlICE9PSAnYXNzZXQnKSB7XG4gICAgICAgICAgICAgICAgbGV0IG1hdGVyaWFsID0gdGhpcy5fbWF0ZXJpYWw7XG4gICAgICAgICAgICAgICAgaWYgKCFtYXRlcmlhbCB8fCBtYXRlcmlhbCA9PT0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsID0gdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzWzBdICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1swXS5hc3NldCAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbMF0uYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcHJpbURhdGEgPSBnZXRTaGFwZVByaW1pdGl2ZSh0aGlzLnN5c3RlbS5hcHAuZ3JhcGhpY3NEZXZpY2UsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9hcmVhID0gcHJpbURhdGEuYXJlYTtcbiAgICAgICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZXMgPSBbbmV3IE1lc2hJbnN0YW5jZShwcmltRGF0YS5tZXNoLCBtYXRlcmlhbCB8fCB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwsIHRoaXMuZW50aXR5KV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgdHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3R5cGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbWVzaEluc3RhbmNlcyBjb250YWluZWQgaW4gdGhlIGNvbXBvbmVudC4gSWYgbWVzaGVzIGFyZSBub3Qgc2V0IG9yIGxvYWRlZCBmb3JcbiAgICAgKiBjb21wb25lbnQgaXQgd2lsbCByZXR1cm4gbnVsbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNZXNoSW5zdGFuY2VbXX1cbiAgICAgKi9cbiAgICBzZXQgbWVzaEluc3RhbmNlcyh2YWx1ZSkge1xuXG4gICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcblxuICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzID0gdmFsdWU7XG5cbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMpIHtcblxuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgbWVzaCBpbnN0YW5jZSB3YXMgY3JlYXRlZCB3aXRob3V0IGEgbm9kZSwgYXNzaWduIGl0IGhlcmVcbiAgICAgICAgICAgICAgICBpZiAoIW1pW2ldLm5vZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0ubm9kZSA9IHRoaXMuZW50aXR5O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIG1pW2ldLmNhc3RTaGFkb3cgPSB0aGlzLl9jYXN0U2hhZG93cztcbiAgICAgICAgICAgICAgICBtaVtpXS5yZWNlaXZlU2hhZG93ID0gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgICAgICAgICAgICAgbWlbaV0uaXNTdGF0aWMgPSB0aGlzLl9pc1N0YXRpYztcbiAgICAgICAgICAgICAgICBtaVtpXS5yZW5kZXJTdHlsZSA9IHRoaXMuX3JlbmRlclN0eWxlO1xuICAgICAgICAgICAgICAgIG1pW2ldLnNldExpZ2h0bWFwcGVkKHRoaXMuX2xpZ2h0bWFwcGVkKTtcbiAgICAgICAgICAgICAgICBtaVtpXS5zZXRDdXN0b21BYWJiKHRoaXMuX2N1c3RvbUFhYmIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvTGF5ZXJzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWVzaEluc3RhbmNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlIG1lc2hlcyB3aWxsIGJlIGxpZ2h0bWFwcGVkIGFmdGVyIHVzaW5nIGxpZ2h0bWFwcGVyLmJha2UoKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcHBlZCh2YWx1ZSkge1xuICAgICAgICBpZiAodmFsdWUgIT09IHRoaXMuX2xpZ2h0bWFwcGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9saWdodG1hcHBlZCA9IHZhbHVlO1xuXG4gICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLnNldExpZ2h0bWFwcGVkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBwZWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9saWdodG1hcHBlZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCBhdHRhY2hlZCBtZXNoZXMgd2lsbCBjYXN0IHNoYWRvd3MgZm9yIGxpZ2h0cyB0aGF0IGhhdmUgc2hhZG93IGNhc3RpbmcgZW5hYmxlZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBjYXN0U2hhZG93cyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fY2FzdFNoYWRvd3MgIT09IHZhbHVlKSB7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluc3RhbmNlcztcblxuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5sYXllcnM7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmU7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2Nhc3RTaGFkb3dzICYmICF2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBzY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMubGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZVNoYWRvd0Nhc3RlcnMobWkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5jYXN0U2hhZG93ID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLl9jYXN0U2hhZG93cyAmJiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBzY2VuZS5sYXllcnMuZ2V0TGF5ZXJCeUlkKGxheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXllci5hZGRTaGFkb3dDYXN0ZXJzKG1pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3MgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjYXN0U2hhZG93cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nhc3RTaGFkb3dzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHNoYWRvd3Mgd2lsbCBiZSBjYXN0IG9uIGF0dGFjaGVkIG1lc2hlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCByZWNlaXZlU2hhZG93cyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fcmVjZWl2ZVNoYWRvd3MgIT09IHZhbHVlKSB7XG5cbiAgICAgICAgICAgIHRoaXMuX3JlY2VpdmVTaGFkb3dzID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0ucmVjZWl2ZVNoYWRvdyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZWNlaXZlU2hhZG93cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlY2VpdmVTaGFkb3dzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIHRoZSBtZXNoZXMgd2lsbCBjYXN0IHNoYWRvd3Mgd2hlbiByZW5kZXJpbmcgbGlnaHRtYXBzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNhc3RTaGFkb3dzTGlnaHRtYXAodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY2FzdFNoYWRvd3NMaWdodG1hcCA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBjYXN0U2hhZG93c0xpZ2h0bWFwKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FzdFNoYWRvd3NMaWdodG1hcDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMaWdodG1hcCByZXNvbHV0aW9uIG11bHRpcGxpZXIuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBsaWdodG1hcFNpemVNdWx0aXBsaWVyKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIgPSB2YWx1ZTtcbiAgICB9XG5cbiAgICBnZXQgbGlnaHRtYXBTaXplTXVsdGlwbGllcigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXI7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTWFyayBtZXNoZXMgYXMgbm9uLW1vdmFibGUgKG9wdGltaXphdGlvbikuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgaXNTdGF0aWModmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2lzU3RhdGljICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5faXNTdGF0aWMgPSB2YWx1ZTtcblxuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5pc1N0YXRpYyA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBpc1N0YXRpYygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lzU3RhdGljO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIGxheWVyIElEcyAoe0BsaW5rIExheWVyI2lkfSkgdG8gd2hpY2ggdGhlIG1lc2hlcyBzaG91bGQgYmVsb25nLiBEb24ndCBwdXNoLCBwb3AsXG4gICAgICogc3BsaWNlIG9yIG1vZGlmeSB0aGlzIGFycmF5LCBpZiB5b3Ugd2FudCB0byBjaGFuZ2UgaXQgLSBzZXQgYSBuZXcgb25lIGluc3RlYWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IGxheWVycyh2YWx1ZSkge1xuICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICBsZXQgbGF5ZXI7XG5cbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIC8vIHJlbW92ZSBhbGwgbWVzaCBpbnN0YW5jZXMgZnJvbSBvbGQgbGF5ZXJzXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICBsYXllci5yZW1vdmVNZXNoSW5zdGFuY2VzKHRoaXMuX21lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNldCB0aGUgbGF5ZXIgbGlzdFxuICAgICAgICB0aGlzLl9sYXllcnMubGVuZ3RoID0gMDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fbGF5ZXJzW2ldID0gdmFsdWVbaV07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkb24ndCBhZGQgaW50byBsYXllcnMgdW50aWwgd2UncmUgZW5hYmxlZFxuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZCB8fCAhdGhpcy5lbnRpdHkuZW5hYmxlZCB8fCAhdGhpcy5fbWVzaEluc3RhbmNlcykgcmV0dXJuO1xuXG4gICAgICAgIC8vIGFkZCBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gbmV3IGxheWVyc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2xheWVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMuX21lc2hJbnN0YW5jZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGxheWVycygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xheWVycztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NpZ24gbWVzaGVzIHRvIGEgc3BlY2lmaWMgYmF0Y2ggZ3JvdXAgKHNlZSB7QGxpbmsgQmF0Y2hHcm91cH0pLiBEZWZhdWx0IGlzIC0xIChubyBncm91cCkuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBiYXRjaEdyb3VwSWQodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCAhPT0gdmFsdWUpIHtcblxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuUkVOREVSLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVuYWJsZWQgJiYgdmFsdWUgPj0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5pbnNlcnQoQmF0Y2hHcm91cC5SRU5ERVIsIHZhbHVlLCB0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSA8IDAgJiYgdGhpcy5fYmF0Y2hHcm91cElkID49IDAgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAvLyByZS1hZGQgcmVuZGVyIHRvIHNjZW5lLCBpbiBjYXNlIGl0IHdhcyByZW1vdmVkIGJ5IGJhdGNoaW5nXG4gICAgICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9iYXRjaEdyb3VwSWQgPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBiYXRjaEdyb3VwSWQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9iYXRjaEdyb3VwSWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIHtAbGluayBNYXRlcmlhbH0gdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIHRoZSBtZXNoZXMgKG5vdCB1c2VkIG9uIHJlbmRlcnMgb2ZcbiAgICAgKiB0eXBlICdhc3NldCcpLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vc2NlbmUvbWF0ZXJpYWxzL21hdGVyaWFsLmpzJykuTWF0ZXJpYWx9XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbCAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzICYmIHRoaXMuX3R5cGUgIT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBtYXRlcmlhbCBhc3NldHMgdGhhdCB3aWxsIGJlIHVzZWQgdG8gcmVuZGVyIHRoZSBtZXNoZXMuIEVhY2ggbWF0ZXJpYWwgY29ycmVzcG9uZHMgdG8gdGhlXG4gICAgICogcmVzcGVjdGl2ZSBtZXNoIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHR5cGUge0Fzc2V0W118bnVtYmVyW119XG4gICAgICovXG4gICAgc2V0IG1hdGVyaWFsQXNzZXRzKHZhbHVlID0gW10pIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5sZW5ndGggPiB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSB2YWx1ZS5sZW5ndGg7IGkgPCB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgPSBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLmxlbmd0aCA9IHZhbHVlLmxlbmd0aDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIG5ldyBBc3NldFJlZmVyZW5jZShcbiAgICAgICAgICAgICAgICAgICAgICAgIGksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZDogdGhpcy5fb25NYXRlcmlhbEFkZGVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvYWQ6IHRoaXMuX29uTWF0ZXJpYWxMb2FkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbW92ZTogdGhpcy5fb25NYXRlcmlhbFJlbW92ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmxvYWQ6IHRoaXMuX29uTWF0ZXJpYWxVbmxvYWRcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodmFsdWVbaV0pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpZCA9IHZhbHVlW2ldIGluc3RhbmNlb2YgQXNzZXQgPyB2YWx1ZVtpXS5pZCA6IHZhbHVlW2ldO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgIT09IGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCA9IGlkO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbEFkZGVkKGksIHRoaXMsIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5hc3NldCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgPSBudWxsO1xuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpXS5tYXRlcmlhbCA9IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbWF0ZXJpYWxBc3NldHMoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubWFwKGZ1bmN0aW9uIChyZWYpIHtcbiAgICAgICAgICAgIHJldHVybiByZWYuaWQ7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSByZW5kZXIgYXNzZXQgZm9yIHRoZSByZW5kZXIgY29tcG9uZW50IChvbmx5IGFwcGxpZXMgdG8gdHlwZSAnYXNzZXQnKSAtIGNhbiBhbHNvIGJlIGFuXG4gICAgICogYXNzZXQgaWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXNzZXR8bnVtYmVyfVxuICAgICAqL1xuICAgIHNldCBhc3NldCh2YWx1ZSkge1xuICAgICAgICBjb25zdCBpZCA9IHZhbHVlIGluc3RhbmNlb2YgQXNzZXQgPyB2YWx1ZS5pZCA6IHZhbHVlO1xuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQgPT09IGlkKSByZXR1cm47XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0ICYmIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vblJlbmRlckFzc2V0UmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZS5pZCA9IGlkO1xuXG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldEFkZGVkKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgYXNzZXQoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9hc3NldFJlZmVyZW5jZS5pZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBc3NpZ24gYXNzZXQgaWQgdG8gdGhlIGNvbXBvbmVudCwgd2l0aG91dCB1cGRhdGluZyB0aGUgY29tcG9uZW50IHdpdGggdGhlIG5ldyBhc3NldC5cbiAgICAgKiBUaGlzIGNhbiBiZSB1c2VkIHRvIGFzc2lnbiB0aGUgYXNzZXQgaWQgdG8gYWxyZWFkeSBmdWxseSBjcmVhdGVkIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QXNzZXR8bnVtYmVyfSBhc3NldCAtIFRoZSByZW5kZXIgYXNzZXQgb3IgYXNzZXQgaWQgdG8gYXNzaWduLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICBhc3NpZ25Bc3NldChhc3NldCkge1xuICAgICAgICBjb25zdCBpZCA9IGFzc2V0IGluc3RhbmNlb2YgQXNzZXQgPyBhc3NldC5pZCA6IGFzc2V0O1xuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZS5pZCA9IGlkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgc2V0IGFzIHRoZSByb290IGJvbmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfb25TZXRSb290Qm9uZShlbnRpdHkpIHtcbiAgICAgICAgaWYgKGVudGl0eSkge1xuICAgICAgICAgICAgdGhpcy5fb25Sb290Qm9uZUNoYW5nZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblJvb3RCb25lQ2hhbmdlZCgpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIHNraW4gaW5zdGFuY2VzIGFuZCBjcmVhdGUgbmV3IG9uZXMsIGNvbm5lY3RlZCB0byBuZXcgcm9vdCBib25lXG4gICAgICAgIHRoaXMuX2NsZWFyU2tpbkluc3RhbmNlcygpO1xuICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2Nsb25lU2tpbkluc3RhbmNlcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgZGVzdHJveU1lc2hJbnN0YW5jZXMoKSB7XG5cbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgIGlmIChtZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbW92ZUZyb21MYXllcnMoKTtcblxuICAgICAgICAgICAgLy8gZGVzdHJveSBtZXNoIGluc3RhbmNlcyBzZXBhcmF0ZWx5IHRvIGFsbG93IHRoZW0gdG8gYmUgcmVtb3ZlZCBmcm9tIHRoZSBjYWNoZVxuICAgICAgICAgICAgdGhpcy5fY2xlYXJTa2luSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXNbaV0uZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgYWRkVG9MYXllcnMoKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVGcm9tTGF5ZXJzKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcyAmJiB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgb25SZW1vdmVDaGlsZCgpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgb25JbnNlcnRDaGlsZCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9MYXllcnMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLmRlc3Ryb3lNZXNoSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgdGhpcy5hc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxBc3NldCA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UuaWQgPSBudWxsO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uaWQgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5lbnRpdHkub2ZmKCdyZW1vdmUnLCB0aGlzLm9uUmVtb3ZlQ2hpbGQsIHRoaXMpO1xuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ2luc2VydCcsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25MYXllcnNDaGFuZ2VkKG9sZENvbXAsIG5ld0NvbXApIHtcbiAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICBvbGRDb21wLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBvbGRDb21wLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIG5ld0NvbXAub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgb25MYXllckFkZGVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyUmVtb3ZlZChsYXllcikge1xuICAgICAgICBjb25zdCBpbmRleCA9IHRoaXMubGF5ZXJzLmluZGV4T2YobGF5ZXIuaWQpO1xuICAgICAgICBpZiAoaW5kZXggPCAwKSByZXR1cm47XG4gICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIGNvbnN0IGFwcCA9IHRoaXMuc3lzdGVtLmFwcDtcbiAgICAgICAgY29uc3Qgc2NlbmUgPSBhcHAuc2NlbmU7XG5cbiAgICAgICAgdGhpcy5fcm9vdEJvbmUub25QYXJlbnRDb21wb25lbnRFbmFibGUoKTtcblxuICAgICAgICB0aGlzLl9jbG9uZVNraW5JbnN0YW5jZXMoKTtcblxuICAgICAgICBzY2VuZS5vbignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9uKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub24oJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaXNBc3NldCA9ICh0aGlzLl90eXBlID09PSAnYXNzZXQnKTtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMgJiYgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuYWRkVG9MYXllcnMoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0Fzc2V0ICYmIHRoaXMuYXNzZXQpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRBZGRlZCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbG9hZCBtYXRlcmlhbHNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQodGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLlJFTkRFUiwgdGhpcy5iYXRjaEdyb3VwSWQsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRGlzYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICBzY2VuZS5vZmYoJ3NldDpsYXllcnMnLCB0aGlzLm9uTGF5ZXJzQ2hhbmdlZCwgdGhpcyk7XG4gICAgICAgIGlmIChzY2VuZS5sYXllcnMpIHtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vZmYoJ3JlbW92ZScsIHRoaXMub25MYXllclJlbW92ZWQsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8ucmVtb3ZlKEJhdGNoR3JvdXAuUkVOREVSLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yZW1vdmVGcm9tTGF5ZXJzKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU3RvcCByZW5kZXJpbmcge0BsaW5rIE1lc2hJbnN0YW5jZX1zIHdpdGhvdXQgcmVtb3ZpbmcgdGhlbSBmcm9tIHRoZSBzY2VuZSBoaWVyYXJjaHkuIFRoaXNcbiAgICAgKiBtZXRob2Qgc2V0cyB0aGUge0BsaW5rIE1lc2hJbnN0YW5jZSN2aXNpYmxlfSBwcm9wZXJ0eSBvZiBldmVyeSBNZXNoSW5zdGFuY2UgdG8gZmFsc2UuIE5vdGUsXG4gICAgICogdGhpcyBkb2VzIG5vdCByZW1vdmUgdGhlIG1lc2ggaW5zdGFuY2VzIGZyb20gdGhlIHNjZW5lIGhpZXJhcmNoeSBvciBkcmF3IGNhbGwgbGlzdC4gU28gdGhlXG4gICAgICogcmVuZGVyIGNvbXBvbmVudCBzdGlsbCBpbmN1cnMgc29tZSBDUFUgb3ZlcmhlYWQuXG4gICAgICovXG4gICAgaGlkZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaV0udmlzaWJsZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5hYmxlIHJlbmRlcmluZyBvZiB0aGUgY29tcG9uZW50J3Mge0BsaW5rIE1lc2hJbnN0YW5jZX1zIGlmIGhpZGRlbiB1c2luZ1xuICAgICAqIHtAbGluayBSZW5kZXJDb21wb25lbnQjaGlkZX0uIFRoaXMgbWV0aG9kIHNldHMgdGhlIHtAbGluayBNZXNoSW5zdGFuY2UjdmlzaWJsZX0gcHJvcGVydHkgb25cbiAgICAgKiBhbGwgbWVzaCBpbnN0YW5jZXMgdG8gdHJ1ZS5cbiAgICAgKi9cbiAgICBzaG93KCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpXS52aXNpYmxlID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0QWRkZWQoKSB7XG4gICAgICAgIGlmICghdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRMb2FkKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZCh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldExvYWQoKSB7XG5cbiAgICAgICAgLy8gcmVtb3ZlIGV4aXN0aW5nIGluc3RhbmNlc1xuICAgICAgICB0aGlzLmRlc3Ryb3lNZXNoSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0KSB7XG4gICAgICAgICAgICBjb25zdCByZW5kZXIgPSB0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZTtcbiAgICAgICAgICAgIHJlbmRlci5vZmYoJ3NldDptZXNoZXMnLCB0aGlzLl9vblNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgICAgICByZW5kZXIub24oJ3NldDptZXNoZXMnLCB0aGlzLl9vblNldE1lc2hlcywgdGhpcyk7XG4gICAgICAgICAgICBpZiAocmVuZGVyLm1lc2hlcykge1xuICAgICAgICAgICAgICAgIHRoaXMuX29uU2V0TWVzaGVzKHJlbmRlci5tZXNoZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2V0TWVzaGVzKG1lc2hlcykge1xuICAgICAgICB0aGlzLl9jbG9uZU1lc2hlcyhtZXNoZXMpO1xuICAgIH1cblxuICAgIF9jbGVhclNraW5JbnN0YW5jZXMoKSB7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2UgPSB0aGlzLl9tZXNoSW5zdGFuY2VzW2ldO1xuXG4gICAgICAgICAgICAvLyByZW1vdmUgaXQgZnJvbSB0aGUgY2FjaGVcbiAgICAgICAgICAgIFNraW5JbnN0YW5jZUNhY2hlLnJlbW92ZUNhY2hlZFNraW5JbnN0YW5jZShtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlKTtcbiAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Nsb25lU2tpbkluc3RhbmNlcygpIHtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGggJiYgdGhpcy5fcm9vdEJvbmUuZW50aXR5IGluc3RhbmNlb2YgR3JhcGhOb2RlKSB7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHRoaXMuX21lc2hJbnN0YW5jZXNbaV07XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hJbnN0YW5jZS5tZXNoO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgc2tpbm5lZCBidXQgZG9lcyBub3QgaGF2ZSBpbnN0YW5jZSBjcmVhdGVkIHlldFxuICAgICAgICAgICAgICAgIGlmIChtZXNoLnNraW4gJiYgIW1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA9IFNraW5JbnN0YW5jZUNhY2hlLmNyZWF0ZUNhY2hlZFNraW5JbnN0YW5jZShtZXNoLnNraW4sIHRoaXMuX3Jvb3RCb25lLmVudGl0eSwgdGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9jbG9uZU1lc2hlcyhtZXNoZXMpIHtcblxuICAgICAgICBpZiAobWVzaGVzICYmIG1lc2hlcy5sZW5ndGgpIHtcblxuICAgICAgICAgICAgLy8gY2xvbmVkIG1lc2ggaW5zdGFuY2VzXG4gICAgICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gW107XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWVzaGVzLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBtZXNoIGluc3RhbmNlXG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hlc1tpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXSAmJiB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQgJiYgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0ID0gbmV3IE1lc2hJbnN0YW5jZShtZXNoLCBtYXRlcmlhbCB8fCB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2VzLnB1c2gobWVzaEluc3QpO1xuXG4gICAgICAgICAgICAgICAgLy8gbW9ycGggaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBpZiAobWVzaC5tb3JwaCkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdC5tb3JwaEluc3RhbmNlID0gbmV3IE1vcnBoSW5zdGFuY2UobWVzaC5tb3JwaCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZXMgPSBtZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICAvLyB0cnkgdG8gY3JlYXRlIHNraW4gaW5zdGFuY2VzIGlmIHJvb3RCb25lIGhhcyBiZWVuIHNldCwgb3RoZXJ3aXNlIHRoaXMgZXhlY3V0ZXMgd2hlbiByb290Qm9uZSBpcyBzZXQgbGF0ZXJcbiAgICAgICAgICAgIHRoaXMuX2Nsb25lU2tpbkluc3RhbmNlcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRVbmxvYWQoKSB7XG5cbiAgICAgICAgLy8gd2hlbiB1bmxvYWRpbmcgYXNzZXQsIG9ubHkgcmVtb3ZlIGFzc2V0IG1lc2ggaW5zdGFuY2VzICh0eXBlIGNvdWxkIGhhdmUgYmVlbiBhbHJlYWR5IGNoYW5nZWQgdG8gJ2JveCcgb3Igc2ltaWxhcilcbiAgICAgICAgaWYgKHRoaXMuX3R5cGUgPT09ICdhc3NldCcpIHtcbiAgICAgICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0UmVtb3ZlKCkge1xuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQgJiYgdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0LnJlc291cmNlLm9mZignc2V0Om1lc2hlcycsIHRoaXMuX29uU2V0TWVzaGVzLCB0aGlzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRVbmxvYWQoKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbEFkZGVkKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmIChhc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25NYXRlcmlhbExvYWQoaW5kZXgsIGNvbXBvbmVudCwgYXNzZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKGFzc2V0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVNYWluTWF0ZXJpYWwoaW5kZXgsIG1hdGVyaWFsKSB7XG4gICAgICAgIC8vIGZpcnN0IG1hdGVyaWFsIGZvciBwcmltaXRpdmVzIGNhbiBiZSBhY2Nlc3NlZCB1c2luZyBtYXRlcmlhbCBwcm9wZXJ0eSwgc28gc2V0IGl0IHVwXG4gICAgICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTWF0ZXJpYWxMb2FkKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzW2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0ubWF0ZXJpYWwgPSBhc3NldC5yZXNvdXJjZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl91cGRhdGVNYWluTWF0ZXJpYWwoaW5kZXgsIGFzc2V0LnJlc291cmNlKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFJlbW92ZShpbmRleCwgY29tcG9uZW50LCBhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0pIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaW5kZXhdLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbFVubG9hZChpbmRleCwgY29tcG9uZW50LCBhc3NldCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0pIHtcbiAgICAgICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXNbaW5kZXhdLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsKTtcbiAgICB9XG5cbiAgICByZXNvbHZlRHVwbGljYXRlZEVudGl0eVJlZmVyZW5jZVByb3BlcnRpZXMob2xkUmVuZGVyLCBkdXBsaWNhdGVkSWRzTWFwKSB7XG4gICAgICAgIGlmIChvbGRSZW5kZXIucm9vdEJvbmUgJiYgZHVwbGljYXRlZElkc01hcFtvbGRSZW5kZXIucm9vdEJvbmVdKSB7XG4gICAgICAgICAgICB0aGlzLnJvb3RCb25lID0gZHVwbGljYXRlZElkc01hcFtvbGRSZW5kZXIucm9vdEJvbmVdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NsZWFyU2tpbkluc3RhbmNlcygpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgUmVuZGVyQ29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiUmVuZGVyQ29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfdHlwZSIsIl9jYXN0U2hhZG93cyIsIl9yZWNlaXZlU2hhZG93cyIsIl9jYXN0U2hhZG93c0xpZ2h0bWFwIiwiX2xpZ2h0bWFwcGVkIiwiX2xpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJfaXNTdGF0aWMiLCJfYmF0Y2hHcm91cElkIiwiX2xheWVycyIsIkxBWUVSSURfV09STEQiLCJfcmVuZGVyU3R5bGUiLCJSRU5ERVJTVFlMRV9TT0xJRCIsIl9tZXNoSW5zdGFuY2VzIiwiX2N1c3RvbUFhYmIiLCJfYXJlYSIsIl9hc3NldFJlZmVyZW5jZSIsIl9tYXRlcmlhbFJlZmVyZW5jZXMiLCJfbWF0ZXJpYWwiLCJfcm9vdEJvbmUiLCJFbnRpdHlSZWZlcmVuY2UiLCJvbiIsIl9vblNldFJvb3RCb25lIiwiQXNzZXRSZWZlcmVuY2UiLCJhcHAiLCJhc3NldHMiLCJhZGQiLCJfb25SZW5kZXJBc3NldEFkZGVkIiwibG9hZCIsIl9vblJlbmRlckFzc2V0TG9hZCIsInJlbW92ZSIsIl9vblJlbmRlckFzc2V0UmVtb3ZlIiwidW5sb2FkIiwiX29uUmVuZGVyQXNzZXRVbmxvYWQiLCJkZWZhdWx0TWF0ZXJpYWwiLCJvblJlbW92ZUNoaWxkIiwib25JbnNlcnRDaGlsZCIsInJlbmRlclN0eWxlIiwiTWVzaEluc3RhbmNlIiwiX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5IiwiY3VzdG9tQWFiYiIsInZhbHVlIiwibWkiLCJpIiwibGVuZ3RoIiwic2V0Q3VzdG9tQWFiYiIsInR5cGUiLCJkZXN0cm95TWVzaEluc3RhbmNlcyIsIm1hdGVyaWFsIiwiYXNzZXQiLCJyZXNvdXJjZSIsInByaW1EYXRhIiwiZ2V0U2hhcGVQcmltaXRpdmUiLCJncmFwaGljc0RldmljZSIsImFyZWEiLCJtZXNoSW5zdGFuY2VzIiwibWVzaCIsIm5vZGUiLCJjYXN0U2hhZG93IiwicmVjZWl2ZVNoYWRvdyIsImlzU3RhdGljIiwic2V0TGlnaHRtYXBwZWQiLCJlbmFibGVkIiwiYWRkVG9MYXllcnMiLCJsaWdodG1hcHBlZCIsImNhc3RTaGFkb3dzIiwibGF5ZXJzIiwic2NlbmUiLCJsYXllciIsImdldExheWVyQnlJZCIsInJlbW92ZVNoYWRvd0Nhc3RlcnMiLCJhZGRTaGFkb3dDYXN0ZXJzIiwicmVjZWl2ZVNoYWRvd3MiLCJjYXN0U2hhZG93c0xpZ2h0bWFwIiwibGlnaHRtYXBTaXplTXVsdGlwbGllciIsInJlbW92ZU1lc2hJbnN0YW5jZXMiLCJhZGRNZXNoSW5zdGFuY2VzIiwiYmF0Y2hHcm91cElkIiwiYmF0Y2hlciIsIkJhdGNoR3JvdXAiLCJSRU5ERVIiLCJpbnNlcnQiLCJtYXRlcmlhbEFzc2V0cyIsImlkIiwicHVzaCIsIl9vbk1hdGVyaWFsQWRkZWQiLCJfb25NYXRlcmlhbExvYWQiLCJfb25NYXRlcmlhbFJlbW92ZSIsIl9vbk1hdGVyaWFsVW5sb2FkIiwiQXNzZXQiLCJtYXAiLCJyZWYiLCJhc3NpZ25Bc3NldCIsIl9vblJvb3RCb25lQ2hhbmdlZCIsIl9jbGVhclNraW5JbnN0YW5jZXMiLCJfY2xvbmVTa2luSW5zdGFuY2VzIiwicmVtb3ZlRnJvbUxheWVycyIsImRlc3Ryb3kiLCJvblJlbW92ZSIsIm1hdGVyaWFsQXNzZXQiLCJvZmYiLCJvbkxheWVyc0NoYW5nZWQiLCJvbGRDb21wIiwibmV3Q29tcCIsIm9uTGF5ZXJBZGRlZCIsIm9uTGF5ZXJSZW1vdmVkIiwiaW5kZXgiLCJpbmRleE9mIiwib25FbmFibGUiLCJvblBhcmVudENvbXBvbmVudEVuYWJsZSIsImlzQXNzZXQiLCJvbkRpc2FibGUiLCJoaWRlIiwidmlzaWJsZSIsInNob3ciLCJyZW5kZXIiLCJfb25TZXRNZXNoZXMiLCJtZXNoZXMiLCJfY2xvbmVNZXNoZXMiLCJtZXNoSW5zdGFuY2UiLCJTa2luSW5zdGFuY2VDYWNoZSIsInJlbW92ZUNhY2hlZFNraW5JbnN0YW5jZSIsInNraW5JbnN0YW5jZSIsIkdyYXBoTm9kZSIsInNraW4iLCJjcmVhdGVDYWNoZWRTa2luSW5zdGFuY2UiLCJtZXNoSW5zdCIsIm1vcnBoIiwibW9ycGhJbnN0YW5jZSIsIk1vcnBoSW5zdGFuY2UiLCJjb21wb25lbnQiLCJfdXBkYXRlTWFpbk1hdGVyaWFsIiwicmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzIiwib2xkUmVuZGVyIiwiZHVwbGljYXRlZElkc01hcCIsInJvb3RCb25lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7OztBQWVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxlQUFlLFNBQVNDLFNBQVMsQ0FBQztBQUNwQzs7QUFHQTs7QUFHQTs7QUFHQTs7QUFHQTs7QUFHQTs7QUFHQTs7QUFHQTs7QUFHQTtBQUMyQjs7QUFFM0I7O0FBR0E7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBVyxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTs7QUFFckI7SUFBQSxJQXZGSkMsQ0FBQUEsS0FBSyxHQUFHLE9BQU8sQ0FBQTtJQUFBLElBR2ZDLENBQUFBLFlBQVksR0FBRyxJQUFJLENBQUE7SUFBQSxJQUduQkMsQ0FBQUEsZUFBZSxHQUFHLElBQUksQ0FBQTtJQUFBLElBR3RCQyxDQUFBQSxvQkFBb0IsR0FBRyxJQUFJLENBQUE7SUFBQSxJQUczQkMsQ0FBQUEsWUFBWSxHQUFHLEtBQUssQ0FBQTtJQUFBLElBR3BCQyxDQUFBQSx1QkFB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
