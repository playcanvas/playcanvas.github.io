import { Debug } from '../../../core/debug.js';
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
    /** @private */
    this._type = 'asset';
    /** @private */
    this._castShadows = true;
    /** @private */
    this._receiveShadows = true;
    /** @private */
    this._castShadowsLightmap = true;
    /** @private */
    this._lightmapped = false;
    /** @private */
    this._lightmapSizeMultiplier = 1;
    /** @private */
    this._isStatic = false;
    /** @private */
    this._batchGroupId = -1;
    /** @private */
    this._layers = [LAYERID_WORLD];
    // assign to the default world layer
    /** @private */
    this._renderStyle = RENDERSTYLE_SOLID;
    /**
     * @type {MeshInstance[]}
     * @private
     */
    this._meshInstances = [];
    /**
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     * @private
     */
    this._customAabb = null;
    /**
     * Used by lightmapper.
     *
     * @type {{x: number, y: number, z: number, uv: number}|null}
     * @ignore
     */
    this._area = null;
    /**
     * @type {AssetReference}
     * @private
     */
    this._assetReference = [];
    /**
     * @type {AssetReference[]}
     * @private
     */
    this._materialReferences = [];
    /**
     * Material used to render meshes other than asset type. It gets priority when set to
     * something else than defaultMaterial, otherwise materialASsets[0] is used.
     *
     * @type {import('../../../scene/materials/material.js').Material}
     * @private
     */
    this._material = void 0;
    /**
     * @type {EntityReference}
     * @private
     */
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
    Debug.assert(Array.isArray(value), `MeshInstances set to a Render component must be an array.`);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmVuZGVyL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBEZWJ1ZyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvZGVidWcuanMnO1xuaW1wb3J0IHsgTEFZRVJJRF9XT1JMRCwgUkVOREVSU1RZTEVfU09MSUQgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQmF0Y2hHcm91cCB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL2JhdGNoaW5nL2JhdGNoLWdyb3VwLmpzJztcbmltcG9ydCB7IE1lc2hJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9ycGhJbnN0YW5jZSB9IGZyb20gJy4uLy4uLy4uL3NjZW5lL21vcnBoLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IGdldFNoYXBlUHJpbWl0aXZlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvcHJvY2VkdXJhbC5qcyc7XG5pbXBvcnQgeyBHcmFwaE5vZGUgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9ncmFwaC1ub2RlLmpzJztcbmltcG9ydCB7IFNraW5JbnN0YW5jZUNhY2hlIH0gZnJvbSAnLi4vLi4vLi4vc2NlbmUvc2tpbi1pbnN0YW5jZS1jYWNoZS5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vLi4vYXNzZXQvYXNzZXQuanMnO1xuaW1wb3J0IHsgQXNzZXRSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi9hc3NldC9hc3NldC1yZWZlcmVuY2UuanMnO1xuXG5pbXBvcnQgeyBDb21wb25lbnQgfSBmcm9tICcuLi9jb21wb25lbnQuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHlSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi91dGlscy9lbnRpdHktcmVmZXJlbmNlLmpzJztcblxuLyoqXG4gKiBFbmFibGVzIGFuIEVudGl0eSB0byByZW5kZXIgYSB7QGxpbmsgTWVzaH0gb3IgYSBwcmltaXRpdmUgc2hhcGUuIFRoaXMgY29tcG9uZW50IGF0dGFjaGVzXG4gKiB7QGxpbmsgTWVzaEluc3RhbmNlfSBnZW9tZXRyeSB0byB0aGUgRW50aXR5LlxuICpcbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IHJvb3RCb25lIEEgcmVmZXJlbmNlIHRvIHRoZSBlbnRpdHkgdG8gYmUgdXNlZCBhc1xuICogdGhlIHJvb3QgYm9uZSBmb3IgYW55IHNraW5uZWQgbWVzaGVzIHRoYXQgYXJlIHJlbmRlcmVkIGJ5IHRoaXMgY29tcG9uZW50LlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBSZW5kZXJDb21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF90eXBlID0gJ2Fzc2V0JztcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9jYXN0U2hhZG93cyA9IHRydWU7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfcmVjZWl2ZVNoYWRvd3MgPSB0cnVlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2Nhc3RTaGFkb3dzTGlnaHRtYXAgPSB0cnVlO1xuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX2xpZ2h0bWFwcGVkID0gZmFsc2U7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IDE7XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBfaXNTdGF0aWMgPSBmYWxzZTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9iYXRjaEdyb3VwSWQgPSAtMTtcblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9sYXllcnMgPSBbTEFZRVJJRF9XT1JMRF07IC8vIGFzc2lnbiB0byB0aGUgZGVmYXVsdCB3b3JsZCBsYXllclxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX3JlbmRlclN0eWxlID0gUkVOREVSU1RZTEVfU09MSUQ7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7TWVzaEluc3RhbmNlW119XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfbWVzaEluc3RhbmNlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9zaGFwZS9ib3VuZGluZy1ib3guanMnKS5Cb3VuZGluZ0JveHxudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2N1c3RvbUFhYmIgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogVXNlZCBieSBsaWdodG1hcHBlci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHt7eDogbnVtYmVyLCB5OiBudW1iZXIsIHo6IG51bWJlciwgdXY6IG51bWJlcn18bnVsbH1cbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgX2FyZWEgPSBudWxsO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Fzc2V0UmVmZXJlbmNlfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2Fzc2V0UmVmZXJlbmNlID0gW107XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7QXNzZXRSZWZlcmVuY2VbXX1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRlcmlhbFJlZmVyZW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIE1hdGVyaWFsIHVzZWQgdG8gcmVuZGVyIG1lc2hlcyBvdGhlciB0aGFuIGFzc2V0IHR5cGUuIEl0IGdldHMgcHJpb3JpdHkgd2hlbiBzZXQgdG9cbiAgICAgKiBzb21ldGhpbmcgZWxzZSB0aGFuIGRlZmF1bHRNYXRlcmlhbCwgb3RoZXJ3aXNlIG1hdGVyaWFsQVNzZXRzWzBdIGlzIHVzZWQuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnKS5NYXRlcmlhbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9tYXRlcmlhbDtcblxuICAgIC8qKlxuICAgICAqIEB0eXBlIHtFbnRpdHlSZWZlcmVuY2V9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcm9vdEJvbmU7XG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgUmVuZGVyQ29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuUmVuZGVyQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICAvLyB0aGUgZW50aXR5IHRoYXQgcmVwcmVzZW50cyB0aGUgcm9vdCBib25lIGlmIHRoaXMgcmVuZGVyIGNvbXBvbmVudCBoYXMgc2tpbm5lZCBtZXNoZXNcbiAgICAgICAgdGhpcy5fcm9vdEJvbmUgPSBuZXcgRW50aXR5UmVmZXJlbmNlKHRoaXMsICdyb290Qm9uZScpO1xuICAgICAgICB0aGlzLl9yb290Qm9uZS5vbignc2V0OmVudGl0eScsIHRoaXMuX29uU2V0Um9vdEJvbmUsIHRoaXMpO1xuXG4gICAgICAgIC8vIHJlbmRlciBhc3NldCByZWZlcmVuY2VcbiAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UgPSBuZXcgQXNzZXRSZWZlcmVuY2UoXG4gICAgICAgICAgICAnYXNzZXQnLFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIHN5c3RlbS5hcHAuYXNzZXRzLCB7XG4gICAgICAgICAgICAgICAgYWRkOiB0aGlzLl9vblJlbmRlckFzc2V0QWRkZWQsXG4gICAgICAgICAgICAgICAgbG9hZDogdGhpcy5fb25SZW5kZXJBc3NldExvYWQsXG4gICAgICAgICAgICAgICAgcmVtb3ZlOiB0aGlzLl9vblJlbmRlckFzc2V0UmVtb3ZlLFxuICAgICAgICAgICAgICAgIHVubG9hZDogdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRoaXNcbiAgICAgICAgKTtcblxuICAgICAgICB0aGlzLl9tYXRlcmlhbCA9IHN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG5cbiAgICAgICAgLy8gaGFuZGxlIGV2ZW50cyB3aGVuIHRoZSBlbnRpdHkgaXMgZGlyZWN0bHkgKG9yIGluZGlyZWN0bHkgYXMgYSBjaGlsZCBvZiBzdWItaGllcmFyY2h5KVxuICAgICAgICAvLyBhZGRlZCBvciByZW1vdmVkIGZyb20gdGhlIHBhcmVudFxuICAgICAgICBlbnRpdHkub24oJ3JlbW92ZScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIGVudGl0eS5vbigncmVtb3ZlaGllcmFyY2h5JywgdGhpcy5vblJlbW92ZUNoaWxkLCB0aGlzKTtcbiAgICAgICAgZW50aXR5Lm9uKCdpbnNlcnQnLCB0aGlzLm9uSW5zZXJ0Q2hpbGQsIHRoaXMpO1xuICAgICAgICBlbnRpdHkub24oJ2luc2VydGhpZXJhcmNoeScsIHRoaXMub25JbnNlcnRDaGlsZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHJlbmRlcmluZyBvZiBhbGwge0BsaW5rIE1lc2hJbnN0YW5jZX1zIHRvIHRoZSBzcGVjaWZpZWQgcmVuZGVyIHN0eWxlLiBDYW4gYmU6XG4gICAgICpcbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9TT0xJRH1cbiAgICAgKiAtIHtAbGluayBSRU5ERVJTVFlMRV9XSVJFRlJBTUV9XG4gICAgICogLSB7QGxpbmsgUkVOREVSU1RZTEVfUE9JTlRTfVxuICAgICAqXG4gICAgICogRGVmYXVsdHMgdG8ge0BsaW5rIFJFTkRFUlNUWUxFX1NPTElEfS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IHJlbmRlclN0eWxlKHJlbmRlclN0eWxlKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZW5kZXJTdHlsZSAhPT0gcmVuZGVyU3R5bGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlclN0eWxlID0gcmVuZGVyU3R5bGU7XG4gICAgICAgICAgICBNZXNoSW5zdGFuY2UuX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5KHRoaXMuX21lc2hJbnN0YW5jZXMsIHJlbmRlclN0eWxlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCByZW5kZXJTdHlsZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3JlbmRlclN0eWxlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHNldCwgdGhlIG9iamVjdCBzcGFjZSBib3VuZGluZyBib3ggaXMgdXNlZCBhcyBhIGJvdW5kaW5nIGJveCBmb3IgdmlzaWJpbGl0eSBjdWxsaW5nIG9mXG4gICAgICogYXR0YWNoZWQgbWVzaCBpbnN0YW5jZXMuIFRoaXMgaXMgYW4gb3B0aW1pemF0aW9uLCBhbGxvd2luZyBvdmVyc2l6ZWQgYm91bmRpbmcgYm94IHRvIGJlXG4gICAgICogc3BlY2lmaWVkIGZvciBza2lubmVkIGNoYXJhY3RlcnMgaW4gb3JkZXIgdG8gYXZvaWQgcGVyIGZyYW1lIGJvdW5kaW5nIGJveCBjb21wdXRhdGlvbnMgYmFzZWRcbiAgICAgKiBvbiBib25lIHBvc2l0aW9ucy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4uLy4uLy4uL2NvcmUvc2hhcGUvYm91bmRpbmctYm94LmpzJykuQm91bmRpbmdCb3h9XG4gICAgICovXG4gICAgc2V0IGN1c3RvbUFhYmIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fY3VzdG9tQWFiYiA9IHZhbHVlO1xuXG4gICAgICAgIC8vIHNldCBpdCBvbiBtZXNoSW5zdGFuY2VzXG4gICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWlbaV0uc2V0Q3VzdG9tQWFiYih0aGlzLl9jdXN0b21BYWJiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBjdXN0b21BYWJiKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY3VzdG9tQWFiYjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdHlwZSBvZiB0aGUgcmVuZGVyLiBDYW4gYmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gICAgICpcbiAgICAgKiAtIFwiYXNzZXRcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIHJlbmRlciBhc3NldFxuICAgICAqIC0gXCJib3hcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIGJveCAoMSB1bml0IGluIGVhY2ggZGltZW5zaW9uKVxuICAgICAqIC0gXCJjYXBzdWxlXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBjYXBzdWxlIChyYWRpdXMgMC41LCBoZWlnaHQgMilcbiAgICAgKiAtIFwiY29uZVwiOiBUaGUgY29tcG9uZW50IHdpbGwgcmVuZGVyIGEgY29uZSAocmFkaXVzIDAuNSwgaGVpZ2h0IDEpXG4gICAgICogLSBcImN5bGluZGVyXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBjeWxpbmRlciAocmFkaXVzIDAuNSwgaGVpZ2h0IDEpXG4gICAgICogLSBcInBsYW5lXCI6IFRoZSBjb21wb25lbnQgd2lsbCByZW5kZXIgYSBwbGFuZSAoMSB1bml0IGluIGVhY2ggZGltZW5zaW9uKVxuICAgICAqIC0gXCJzcGhlcmVcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIHNwaGVyZSAocmFkaXVzIDAuNSlcbiAgICAgKiAtIFwidG9ydXNcIjogVGhlIGNvbXBvbmVudCB3aWxsIHJlbmRlciBhIHRvcnVzICh0dWJlUmFkaXVzOiAwLjIsIHJpbmdSYWRpdXM6IDAuMylcbiAgICAgKlxuICAgICAqIEB0eXBlIHtzdHJpbmd9XG4gICAgICovXG4gICAgc2V0IHR5cGUodmFsdWUpIHtcblxuICAgICAgICBpZiAodGhpcy5fdHlwZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX2FyZWEgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy5fdHlwZSA9IHZhbHVlO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lNZXNoSW5zdGFuY2VzKCk7XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZSAhPT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgICAgIGxldCBtYXRlcmlhbCA9IHRoaXMuX21hdGVyaWFsO1xuICAgICAgICAgICAgICAgIGlmICghbWF0ZXJpYWwgfHwgbWF0ZXJpYWwgPT09IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCkge1xuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbCA9IHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1swXSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbMF0uYXNzZXQgJiZcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzWzBdLmFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHByaW1EYXRhID0gZ2V0U2hhcGVQcmltaXRpdmUodGhpcy5zeXN0ZW0uYXBwLmdyYXBoaWNzRGV2aWNlLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXJlYSA9IHByaW1EYXRhLmFyZWE7XG4gICAgICAgICAgICAgICAgdGhpcy5tZXNoSW5zdGFuY2VzID0gW25ldyBNZXNoSW5zdGFuY2UocHJpbURhdGEubWVzaCwgbWF0ZXJpYWwgfHwgdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsLCB0aGlzLmVudGl0eSldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHR5cGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl90eXBlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIG1lc2hJbnN0YW5jZXMgY29udGFpbmVkIGluIHRoZSBjb21wb25lbnQuIElmIG1lc2hlcyBhcmUgbm90IHNldCBvciBsb2FkZWQgZm9yXG4gICAgICogY29tcG9uZW50IGl0IHdpbGwgcmV0dXJuIG51bGwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWVzaEluc3RhbmNlW119XG4gICAgICovXG4gICAgc2V0IG1lc2hJbnN0YW5jZXModmFsdWUpIHtcblxuICAgICAgICBEZWJ1Zy5hc3NlcnQoQXJyYXkuaXNBcnJheSh2YWx1ZSksIGBNZXNoSW5zdGFuY2VzIHNldCB0byBhIFJlbmRlciBjb21wb25lbnQgbXVzdCBiZSBhbiBhcnJheS5gKTtcbiAgICAgICAgdGhpcy5kZXN0cm95TWVzaEluc3RhbmNlcygpO1xuXG4gICAgICAgIHRoaXMuX21lc2hJbnN0YW5jZXMgPSB2YWx1ZTtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcykge1xuXG4gICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBtZXNoIGluc3RhbmNlIHdhcyBjcmVhdGVkIHdpdGhvdXQgYSBub2RlLCBhc3NpZ24gaXQgaGVyZVxuICAgICAgICAgICAgICAgIGlmICghbWlbaV0ubm9kZSkge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5ub2RlID0gdGhpcy5lbnRpdHk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbWlbaV0uY2FzdFNoYWRvdyA9IHRoaXMuX2Nhc3RTaGFkb3dzO1xuICAgICAgICAgICAgICAgIG1pW2ldLnJlY2VpdmVTaGFkb3cgPSB0aGlzLl9yZWNlaXZlU2hhZG93cztcbiAgICAgICAgICAgICAgICBtaVtpXS5pc1N0YXRpYyA9IHRoaXMuX2lzU3RhdGljO1xuICAgICAgICAgICAgICAgIG1pW2ldLnJlbmRlclN0eWxlID0gdGhpcy5fcmVuZGVyU3R5bGU7XG4gICAgICAgICAgICAgICAgbWlbaV0uc2V0TGlnaHRtYXBwZWQodGhpcy5fbGlnaHRtYXBwZWQpO1xuICAgICAgICAgICAgICAgIG1pW2ldLnNldEN1c3RvbUFhYmIodGhpcy5fY3VzdG9tQWFiYik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIHRoaXMuYWRkVG9MYXllcnMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtZXNoSW5zdGFuY2VzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJZiB0cnVlLCB0aGUgbWVzaGVzIHdpbGwgYmUgbGlnaHRtYXBwZWQgYWZ0ZXIgdXNpbmcgbGlnaHRtYXBwZXIuYmFrZSgpLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGxpZ2h0bWFwcGVkKHZhbHVlKSB7XG4gICAgICAgIGlmICh2YWx1ZSAhPT0gdGhpcy5fbGlnaHRtYXBwZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2xpZ2h0bWFwcGVkID0gdmFsdWU7XG5cbiAgICAgICAgICAgIGNvbnN0IG1pID0gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICAgICAgICAgIGlmIChtaSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbWkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgbWlbaV0uc2V0TGlnaHRtYXBwZWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBsaWdodG1hcHBlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2xpZ2h0bWFwcGVkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIElmIHRydWUsIGF0dGFjaGVkIG1lc2hlcyB3aWxsIGNhc3Qgc2hhZG93cyBmb3IgbGlnaHRzIHRoYXQgaGF2ZSBzaGFkb3cgY2FzdGluZyBlbmFibGVkLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IGNhc3RTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9jYXN0U2hhZG93cyAhPT0gdmFsdWUpIHtcblxuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuXG4gICAgICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLmxheWVycztcbiAgICAgICAgICAgICAgICBjb25zdCBzY2VuZSA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fY2FzdFNoYWRvd3MgJiYgIXZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQodGhpcy5sYXllcnNbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlU2hhZG93Q2FzdGVycyhtaSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLmNhc3RTaGFkb3cgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoIXRoaXMuX2Nhc3RTaGFkb3dzICYmIHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IHNjZW5lLmxheWVycy5nZXRMYXllckJ5SWQobGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxheWVyLmFkZFNoYWRvd0Nhc3RlcnMobWkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9jYXN0U2hhZG93cyA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fY2FzdFNoYWRvd3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgc2hhZG93cyB3aWxsIGJlIGNhc3Qgb24gYXR0YWNoZWQgbWVzaGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICovXG4gICAgc2V0IHJlY2VpdmVTaGFkb3dzKHZhbHVlKSB7XG4gICAgICAgIGlmICh0aGlzLl9yZWNlaXZlU2hhZG93cyAhPT0gdmFsdWUpIHtcblxuICAgICAgICAgICAgdGhpcy5fcmVjZWl2ZVNoYWRvd3MgPSB2YWx1ZTtcblxuICAgICAgICAgICAgY29uc3QgbWkgPSB0aGlzLl9tZXNoSW5zdGFuY2VzO1xuICAgICAgICAgICAgaWYgKG1pKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtaS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBtaVtpXS5yZWNlaXZlU2hhZG93ID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IHJlY2VpdmVTaGFkb3dzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcmVjZWl2ZVNoYWRvd3M7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSWYgdHJ1ZSwgdGhlIG1lc2hlcyB3aWxsIGNhc3Qgc2hhZG93cyB3aGVuIHJlbmRlcmluZyBsaWdodG1hcHMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBzZXQgY2FzdFNoYWRvd3NMaWdodG1hcCh2YWx1ZSkge1xuICAgICAgICB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwID0gdmFsdWU7XG4gICAgfVxuXG4gICAgZ2V0IGNhc3RTaGFkb3dzTGlnaHRtYXAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9jYXN0U2hhZG93c0xpZ2h0bWFwO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIExpZ2h0bWFwIHJlc29sdXRpb24gbXVsdGlwbGllci5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllciA9IHZhbHVlO1xuICAgIH1cblxuICAgIGdldCBsaWdodG1hcFNpemVNdWx0aXBsaWVyKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGlnaHRtYXBTaXplTXVsdGlwbGllcjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBNYXJrIG1lc2hlcyBhcyBub24tbW92YWJsZSAob3B0aW1pemF0aW9uKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtib29sZWFufVxuICAgICAqL1xuICAgIHNldCBpc1N0YXRpYyh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5faXNTdGF0aWMgIT09IHZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9pc1N0YXRpYyA9IHZhbHVlO1xuXG4gICAgICAgICAgICBjb25zdCBtaSA9IHRoaXMuX21lc2hJbnN0YW5jZXM7XG4gICAgICAgICAgICBpZiAobWkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG1pLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIG1pW2ldLmlzU3RhdGljID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGlzU3RhdGljKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNTdGF0aWM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgbGF5ZXIgSURzICh7QGxpbmsgTGF5ZXIjaWR9KSB0byB3aGljaCB0aGUgbWVzaGVzIHNob3VsZCBiZWxvbmcuIERvbid0IHB1c2gsIHBvcCxcbiAgICAgKiBzcGxpY2Ugb3IgbW9kaWZ5IHRoaXMgYXJyYXksIGlmIHlvdSB3YW50IHRvIGNoYW5nZSBpdCAtIHNldCBhIG5ldyBvbmUgaW5zdGVhZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgbGF5ZXJzKHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGxheWVycyA9IHRoaXMuc3lzdGVtLmFwcC5zY2VuZS5sYXllcnM7XG4gICAgICAgIGxldCBsYXllcjtcblxuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGFsbCBtZXNoIGluc3RhbmNlcyBmcm9tIG9sZCBsYXllcnNcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIgPSBsYXllcnMuZ2V0TGF5ZXJCeUlkKHRoaXMuX2xheWVyc1tpXSk7XG4gICAgICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyLnJlbW92ZU1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2V0IHRoZSBsYXllciBsaXN0XG4gICAgICAgIHRoaXMuX2xheWVycy5sZW5ndGggPSAwO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLl9sYXllcnNbaV0gPSB2YWx1ZVtpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGRvbid0IGFkZCBpbnRvIGxheWVycyB1bnRpbCB3ZSdyZSBlbmFibGVkXG4gICAgICAgIGlmICghdGhpcy5lbmFibGVkIHx8ICF0aGlzLmVudGl0eS5lbmFibGVkIHx8ICF0aGlzLl9tZXNoSW5zdGFuY2VzKSByZXR1cm47XG5cbiAgICAgICAgLy8gYWRkIGFsbCBtZXNoIGluc3RhbmNlcyB0byBuZXcgbGF5ZXJzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgIGlmIChsYXllcikge1xuICAgICAgICAgICAgICAgIGxheWVyLmFkZE1lc2hJbnN0YW5jZXModGhpcy5fbWVzaEluc3RhbmNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZXQgbGF5ZXJzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbGF5ZXJzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBtZXNoZXMgdG8gYSBzcGVjaWZpYyBiYXRjaCBncm91cCAoc2VlIHtAbGluayBCYXRjaEdyb3VwfSkuIERlZmF1bHQgaXMgLTEgKG5vIGdyb3VwKS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGJhdGNoR3JvdXBJZCh2YWx1ZSkge1xuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkICE9PSB2YWx1ZSkge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5SRU5ERVIsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5lbnRpdHkuZW5hYmxlZCAmJiB2YWx1ZSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmJhdGNoZXI/Lmluc2VydChCYXRjaEdyb3VwLlJFTkRFUiwgdmFsdWUsIHRoaXMuZW50aXR5KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHZhbHVlIDwgMCAmJiB0aGlzLl9iYXRjaEdyb3VwSWQgPj0gMCAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIC8vIHJlLWFkZCByZW5kZXIgdG8gc2NlbmUsIGluIGNhc2UgaXQgd2FzIHJlbW92ZWQgYnkgYmF0Y2hpbmdcbiAgICAgICAgICAgICAgICB0aGlzLmFkZFRvTGF5ZXJzKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuX2JhdGNoR3JvdXBJZCA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IGJhdGNoR3JvdXBJZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2JhdGNoR3JvdXBJZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgbWF0ZXJpYWwge0BsaW5rIE1hdGVyaWFsfSB0aGF0IHdpbGwgYmUgdXNlZCB0byByZW5kZXIgdGhlIG1lc2hlcyAobm90IHVzZWQgb24gcmVuZGVycyBvZlxuICAgICAqIHR5cGUgJ2Fzc2V0JykuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7aW1wb3J0KCcuLi8uLi8uLi9zY2VuZS9tYXRlcmlhbHMvbWF0ZXJpYWwuanMnKS5NYXRlcmlhbH1cbiAgICAgKi9cbiAgICBzZXQgbWF0ZXJpYWwodmFsdWUpIHtcbiAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsICE9PSB2YWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWwgPSB2YWx1ZTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXMgJiYgdGhpcy5fdHlwZSAhPT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5fbWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2V0IG1hdGVyaWFsKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWF0ZXJpYWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIG1hdGVyaWFsIGFzc2V0cyB0aGF0IHdpbGwgYmUgdXNlZCB0byByZW5kZXIgdGhlIG1lc2hlcy4gRWFjaCBtYXRlcmlhbCBjb3JyZXNwb25kcyB0byB0aGVcbiAgICAgKiByZXNwZWN0aXZlIG1lc2ggaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7QXNzZXRbXXxudW1iZXJbXX1cbiAgICAgKi9cbiAgICBzZXQgbWF0ZXJpYWxBc3NldHModmFsdWUgPSBbXSkge1xuICAgICAgICBpZiAodGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzLmxlbmd0aCA+IHZhbHVlLmxlbmd0aCkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHZhbHVlLmxlbmd0aDsgaSA8IHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMucHVzaChcbiAgICAgICAgICAgICAgICAgICAgbmV3IEFzc2V0UmVmZXJlbmNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgaSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkOiB0aGlzLl9vbk1hdGVyaWFsQWRkZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZDogdGhpcy5fb25NYXRlcmlhbExvYWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVtb3ZlOiB0aGlzLl9vbk1hdGVyaWFsUmVtb3ZlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVubG9hZDogdGhpcy5fb25NYXRlcmlhbFVubG9hZFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXNcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh2YWx1ZVtpXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGlkID0gdmFsdWVbaV0gaW5zdGFuY2VvZiBBc3NldCA/IHZhbHVlW2ldLmlkIDogdmFsdWVbaV07XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCAhPT0gaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmlkID0gaWQ7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5hc3NldCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9vbk1hdGVyaWFsQWRkZWQoaSwgdGhpcywgdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldLmFzc2V0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCA9IG51bGw7XG5cbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlc1tpXSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzW2ldLm1hdGVyaWFsID0gdGhpcy5zeXN0ZW0uZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBtYXRlcmlhbEFzc2V0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5tYXAoZnVuY3Rpb24gKHJlZikge1xuICAgICAgICAgICAgcmV0dXJuIHJlZi5pZDtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHJlbmRlciBhc3NldCBmb3IgdGhlIHJlbmRlciBjb21wb25lbnQgKG9ubHkgYXBwbGllcyB0byB0eXBlICdhc3NldCcpIC0gY2FuIGFsc28gYmUgYW5cbiAgICAgKiBhc3NldCBpZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtBc3NldHxudW1iZXJ9XG4gICAgICovXG4gICAgc2V0IGFzc2V0KHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGlkID0gdmFsdWUgaW5zdGFuY2VvZiBBc3NldCA/IHZhbHVlLmlkIDogdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5pZCA9PT0gaWQpIHJldHVybjtcblxuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQgJiYgdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX29uUmVuZGVyQXNzZXRSZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmlkID0gaWQ7XG5cbiAgICAgICAgaWYgKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0KSB7XG4gICAgICAgICAgICB0aGlzLl9vblJlbmRlckFzc2V0QWRkZWQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGdldCBhc3NldCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmlkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFzc2lnbiBhc3NldCBpZCB0byB0aGUgY29tcG9uZW50LCB3aXRob3V0IHVwZGF0aW5nIHRoZSBjb21wb25lbnQgd2l0aCB0aGUgbmV3IGFzc2V0LlxuICAgICAqIFRoaXMgY2FuIGJlIHVzZWQgdG8gYXNzaWduIHRoZSBhc3NldCBpZCB0byBhbHJlYWR5IGZ1bGx5IGNyZWF0ZWQgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtBc3NldHxudW1iZXJ9IGFzc2V0IC0gVGhlIHJlbmRlciBhc3NldCBvciBhc3NldCBpZCB0byBhc3NpZ24uXG4gICAgICogQGlnbm9yZVxuICAgICAqL1xuICAgIGFzc2lnbkFzc2V0KGFzc2V0KSB7XG4gICAgICAgIGNvbnN0IGlkID0gYXNzZXQgaW5zdGFuY2VvZiBBc3NldCA/IGFzc2V0LmlkIDogYXNzZXQ7XG4gICAgICAgIHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmlkID0gaWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIGVudGl0eSBzZXQgYXMgdGhlIHJvb3QgYm9uZS5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vblNldFJvb3RCb25lKGVudGl0eSkge1xuICAgICAgICBpZiAoZW50aXR5KSB7XG4gICAgICAgICAgICB0aGlzLl9vblJvb3RCb25lQ2hhbmdlZCgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIEBwcml2YXRlICovXG4gICAgX29uUm9vdEJvbmVDaGFuZ2VkKCkge1xuICAgICAgICAvLyByZW1vdmUgZXhpc3Rpbmcgc2tpbiBpbnN0YW5jZXMgYW5kIGNyZWF0ZSBuZXcgb25lcywgY29ubmVjdGVkIHRvIG5ldyByb290IGJvbmVcbiAgICAgICAgdGhpcy5fY2xlYXJTa2luSW5zdGFuY2VzKCk7XG4gICAgICAgIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fY2xvbmVTa2luSW5zdGFuY2VzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBkZXN0cm95TWVzaEluc3RhbmNlcygpIHtcblxuICAgICAgICBjb25zdCBtZXNoSW5zdGFuY2VzID0gdGhpcy5fbWVzaEluc3RhbmNlcztcbiAgICAgICAgaWYgKG1lc2hJbnN0YW5jZXMpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlRnJvbUxheWVycygpO1xuXG4gICAgICAgICAgICAvLyBkZXN0cm95IG1lc2ggaW5zdGFuY2VzIHNlcGFyYXRlbHkgdG8gYWxsb3cgdGhlbSB0byBiZSByZW1vdmVkIGZyb20gdGhlIGNhY2hlXG4gICAgICAgICAgICB0aGlzLl9jbGVhclNraW5JbnN0YW5jZXMoKTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlc1tpXS5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aCA9IDA7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBhZGRUb0xheWVycygpIHtcbiAgICAgICAgY29uc3QgbGF5ZXJzID0gdGhpcy5zeXN0ZW0uYXBwLnNjZW5lLmxheWVycztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gbGF5ZXJzLmdldExheWVyQnlJZCh0aGlzLl9sYXllcnNbaV0pO1xuICAgICAgICAgICAgaWYgKGxheWVyKSB7XG4gICAgICAgICAgICAgICAgbGF5ZXIuYWRkTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbW92ZUZyb21MYXllcnMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzICYmIHRoaXMuX21lc2hJbnN0YW5jZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjb25zdCBsYXllcnMgPSB0aGlzLnN5c3RlbS5hcHAuc2NlbmUubGF5ZXJzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9sYXllcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsYXllciA9IGxheWVycy5nZXRMYXllckJ5SWQodGhpcy5fbGF5ZXJzW2ldKTtcbiAgICAgICAgICAgICAgICBpZiAobGF5ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBvblJlbW92ZUNoaWxkKCkge1xuICAgICAgICB0aGlzLnJlbW92ZUZyb21MYXllcnMoKTtcbiAgICB9XG5cbiAgICAvKiogQHByaXZhdGUgKi9cbiAgICBvbkluc2VydENoaWxkKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcyAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcblxuICAgICAgICB0aGlzLmFzc2V0ID0gbnVsbDtcbiAgICAgICAgdGhpcy5tYXRlcmlhbEFzc2V0ID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9hc3NldFJlZmVyZW5jZS5pZCA9IG51bGw7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5pZCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmVudGl0eS5vZmYoJ3JlbW92ZScsIHRoaXMub25SZW1vdmVDaGlsZCwgdGhpcyk7XG4gICAgICAgIHRoaXMuZW50aXR5Lm9mZignaW5zZXJ0JywgdGhpcy5vbkluc2VydENoaWxkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyc0NoYW5nZWQob2xkQ29tcCwgbmV3Q29tcCkge1xuICAgICAgICB0aGlzLmFkZFRvTGF5ZXJzKCk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdhZGQnLCB0aGlzLm9uTGF5ZXJBZGRlZCwgdGhpcyk7XG4gICAgICAgIG9sZENvbXAub2ZmKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICAgICAgbmV3Q29tcC5vbignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICBuZXdDb21wLm9uKCdyZW1vdmUnLCB0aGlzLm9uTGF5ZXJSZW1vdmVkLCB0aGlzKTtcbiAgICB9XG5cbiAgICBvbkxheWVyQWRkZWQobGF5ZXIpIHtcbiAgICAgICAgY29uc3QgaW5kZXggPSB0aGlzLmxheWVycy5pbmRleE9mKGxheWVyLmlkKTtcbiAgICAgICAgaWYgKGluZGV4IDwgMCkgcmV0dXJuO1xuICAgICAgICBsYXllci5hZGRNZXNoSW5zdGFuY2VzKHRoaXMuX21lc2hJbnN0YW5jZXMpO1xuICAgIH1cblxuICAgIG9uTGF5ZXJSZW1vdmVkKGxheWVyKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gdGhpcy5sYXllcnMuaW5kZXhPZihsYXllci5pZCk7XG4gICAgICAgIGlmIChpbmRleCA8IDApIHJldHVybjtcbiAgICAgICAgbGF5ZXIucmVtb3ZlTWVzaEluc3RhbmNlcyh0aGlzLl9tZXNoSW5zdGFuY2VzKTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgY29uc3QgYXBwID0gdGhpcy5zeXN0ZW0uYXBwO1xuICAgICAgICBjb25zdCBzY2VuZSA9IGFwcC5zY2VuZTtcblxuICAgICAgICB0aGlzLl9yb290Qm9uZS5vblBhcmVudENvbXBvbmVudEVuYWJsZSgpO1xuXG4gICAgICAgIHRoaXMuX2Nsb25lU2tpbkluc3RhbmNlcygpO1xuXG4gICAgICAgIHNjZW5lLm9uKCdzZXQ6bGF5ZXJzJywgdGhpcy5vbkxheWVyc0NoYW5nZWQsIHRoaXMpO1xuICAgICAgICBpZiAoc2NlbmUubGF5ZXJzKSB7XG4gICAgICAgICAgICBzY2VuZS5sYXllcnMub24oJ2FkZCcsIHRoaXMub25MYXllckFkZGVkLCB0aGlzKTtcbiAgICAgICAgICAgIHNjZW5lLmxheWVycy5vbigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpc0Fzc2V0ID0gKHRoaXMuX3R5cGUgPT09ICdhc3NldCcpO1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcyAmJiB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhpcy5hZGRUb0xheWVycygpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzQXNzZXQgJiYgdGhpcy5hc3NldCkge1xuICAgICAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldEFkZGVkKCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb2FkIG1hdGVyaWFsc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5hc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc3lzdGVtLmFwcC5hc3NldHMubG9hZCh0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX2JhdGNoR3JvdXBJZCA+PSAwKSB7XG4gICAgICAgICAgICBhcHAuYmF0Y2hlcj8uaW5zZXJ0KEJhdGNoR3JvdXAuUkVOREVSLCB0aGlzLmJhdGNoR3JvdXBJZCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICBjb25zdCBhcHAgPSB0aGlzLnN5c3RlbS5hcHA7XG4gICAgICAgIGNvbnN0IHNjZW5lID0gYXBwLnNjZW5lO1xuXG4gICAgICAgIHNjZW5lLm9mZignc2V0OmxheWVycycsIHRoaXMub25MYXllcnNDaGFuZ2VkLCB0aGlzKTtcbiAgICAgICAgaWYgKHNjZW5lLmxheWVycykge1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZignYWRkJywgdGhpcy5vbkxheWVyQWRkZWQsIHRoaXMpO1xuICAgICAgICAgICAgc2NlbmUubGF5ZXJzLm9mZigncmVtb3ZlJywgdGhpcy5vbkxheWVyUmVtb3ZlZCwgdGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fYmF0Y2hHcm91cElkID49IDApIHtcbiAgICAgICAgICAgIGFwcC5iYXRjaGVyPy5yZW1vdmUoQmF0Y2hHcm91cC5SRU5ERVIsIHRoaXMuYmF0Y2hHcm91cElkLCB0aGlzLmVudGl0eSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlbW92ZUZyb21MYXllcnMoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTdG9wIHJlbmRlcmluZyB7QGxpbmsgTWVzaEluc3RhbmNlfXMgd2l0aG91dCByZW1vdmluZyB0aGVtIGZyb20gdGhlIHNjZW5lIGhpZXJhcmNoeS4gVGhpc1xuICAgICAqIG1ldGhvZCBzZXRzIHRoZSB7QGxpbmsgTWVzaEluc3RhbmNlI3Zpc2libGV9IHByb3BlcnR5IG9mIGV2ZXJ5IE1lc2hJbnN0YW5jZSB0byBmYWxzZS4gTm90ZSxcbiAgICAgKiB0aGlzIGRvZXMgbm90IHJlbW92ZSB0aGUgbWVzaCBpbnN0YW5jZXMgZnJvbSB0aGUgc2NlbmUgaGllcmFyY2h5IG9yIGRyYXcgY2FsbCBsaXN0LiBTbyB0aGVcbiAgICAgKiByZW5kZXIgY29tcG9uZW50IHN0aWxsIGluY3VycyBzb21lIENQVSBvdmVyaGVhZC5cbiAgICAgKi9cbiAgICBoaWRlKCkge1xuICAgICAgICBpZiAodGhpcy5fbWVzaEluc3RhbmNlcykge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpXS52aXNpYmxlID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmFibGUgcmVuZGVyaW5nIG9mIHRoZSBjb21wb25lbnQncyB7QGxpbmsgTWVzaEluc3RhbmNlfXMgaWYgaGlkZGVuIHVzaW5nXG4gICAgICoge0BsaW5rIFJlbmRlckNvbXBvbmVudCNoaWRlfS4gVGhpcyBtZXRob2Qgc2V0cyB0aGUge0BsaW5rIE1lc2hJbnN0YW5jZSN2aXNpYmxlfSBwcm9wZXJ0eSBvblxuICAgICAqIGFsbCBtZXNoIGluc3RhbmNlcyB0byB0cnVlLlxuICAgICAqL1xuICAgIHNob3coKSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzW2ldLnZpc2libGUgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRBZGRlZCgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCkgcmV0dXJuO1xuXG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldExvYWQoKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5zeXN0ZW0uYXBwLmFzc2V0cy5sb2FkKHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblJlbmRlckFzc2V0TG9hZCgpIHtcblxuICAgICAgICAvLyByZW1vdmUgZXhpc3RpbmcgaW5zdGFuY2VzXG4gICAgICAgIHRoaXMuZGVzdHJveU1lc2hJbnN0YW5jZXMoKTtcblxuICAgICAgICBpZiAodGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlciA9IHRoaXMuX2Fzc2V0UmVmZXJlbmNlLmFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgcmVuZGVyLm9mZignc2V0Om1lc2hlcycsIHRoaXMuX29uU2V0TWVzaGVzLCB0aGlzKTtcbiAgICAgICAgICAgIHJlbmRlci5vbignc2V0Om1lc2hlcycsIHRoaXMuX29uU2V0TWVzaGVzLCB0aGlzKTtcbiAgICAgICAgICAgIGlmIChyZW5kZXIubWVzaGVzKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fb25TZXRNZXNoZXMocmVuZGVyLm1lc2hlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25TZXRNZXNoZXMobWVzaGVzKSB7XG4gICAgICAgIHRoaXMuX2Nsb25lTWVzaGVzKG1lc2hlcyk7XG4gICAgfVxuXG4gICAgX2NsZWFyU2tpbkluc3RhbmNlcygpIHtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX21lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHRoaXMuX21lc2hJbnN0YW5jZXNbaV07XG5cbiAgICAgICAgICAgIC8vIHJlbW92ZSBpdCBmcm9tIHRoZSBjYWNoZVxuICAgICAgICAgICAgU2tpbkluc3RhbmNlQ2FjaGUucmVtb3ZlQ2FjaGVkU2tpbkluc3RhbmNlKG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpO1xuICAgICAgICAgICAgbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY2xvbmVTa2luSW5zdGFuY2VzKCkge1xuXG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aCAmJiB0aGlzLl9yb290Qm9uZS5lbnRpdHkgaW5zdGFuY2VvZiBHcmFwaE5vZGUpIHtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gdGhpcy5fbWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gbWVzaEluc3RhbmNlLm1lc2g7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBza2lubmVkIGJ1dCBkb2VzIG5vdCBoYXZlIGluc3RhbmNlIGNyZWF0ZWQgeWV0XG4gICAgICAgICAgICAgICAgaWYgKG1lc2guc2tpbiAmJiAhbWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlID0gU2tpbkluc3RhbmNlQ2FjaGUuY3JlYXRlQ2FjaGVkU2tpbkluc3RhbmNlKG1lc2guc2tpbiwgdGhpcy5fcm9vdEJvbmUuZW50aXR5LCB0aGlzLmVudGl0eSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2Nsb25lTWVzaGVzKG1lc2hlcykge1xuXG4gICAgICAgIGlmIChtZXNoZXMgJiYgbWVzaGVzLmxlbmd0aCkge1xuXG4gICAgICAgICAgICAvLyBjbG9uZWQgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZXMgPSBbXTtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoZXMubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgICAgIC8vIG1lc2ggaW5zdGFuY2VcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoID0gbWVzaGVzW2ldO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsID0gdGhpcy5fbWF0ZXJpYWxSZWZlcmVuY2VzW2ldICYmIHRoaXMuX21hdGVyaWFsUmVmZXJlbmNlc1tpXS5hc3NldCAmJiB0aGlzLl9tYXRlcmlhbFJlZmVyZW5jZXNbaV0uYXNzZXQucmVzb3VyY2U7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzaEluc3QgPSBuZXcgTWVzaEluc3RhbmNlKG1lc2gsIG1hdGVyaWFsIHx8IHRoaXMuc3lzdGVtLmRlZmF1bHRNYXRlcmlhbCwgdGhpcy5lbnRpdHkpO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXMucHVzaChtZXNoSW5zdCk7XG5cbiAgICAgICAgICAgICAgICAvLyBtb3JwaCBpbnN0YW5jZVxuICAgICAgICAgICAgICAgIGlmIChtZXNoLm1vcnBoKSB7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0Lm1vcnBoSW5zdGFuY2UgPSBuZXcgTW9ycGhJbnN0YW5jZShtZXNoLm1vcnBoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMubWVzaEluc3RhbmNlcyA9IG1lc2hJbnN0YW5jZXM7XG5cbiAgICAgICAgICAgIC8vIHRyeSB0byBjcmVhdGUgc2tpbiBpbnN0YW5jZXMgaWYgcm9vdEJvbmUgaGFzIGJlZW4gc2V0LCBvdGhlcndpc2UgdGhpcyBleGVjdXRlcyB3aGVuIHJvb3RCb25lIGlzIHNldCBsYXRlclxuICAgICAgICAgICAgdGhpcy5fY2xvbmVTa2luSW5zdGFuY2VzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25SZW5kZXJBc3NldFVubG9hZCgpIHtcblxuICAgICAgICAvLyB3aGVuIHVubG9hZGluZyBhc3NldCwgb25seSByZW1vdmUgYXNzZXQgbWVzaCBpbnN0YW5jZXMgKHR5cGUgY291bGQgaGF2ZSBiZWVuIGFscmVhZHkgY2hhbmdlZCB0byAnYm94JyBvciBzaW1pbGFyKVxuICAgICAgICBpZiAodGhpcy5fdHlwZSA9PT0gJ2Fzc2V0Jykge1xuICAgICAgICAgICAgdGhpcy5kZXN0cm95TWVzaEluc3RhbmNlcygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uUmVuZGVyQXNzZXRSZW1vdmUoKSB7XG4gICAgICAgIGlmICh0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldCAmJiB0aGlzLl9hc3NldFJlZmVyZW5jZS5hc3NldC5yZXNvdXJjZSkge1xuICAgICAgICAgICAgdGhpcy5fYXNzZXRSZWZlcmVuY2UuYXNzZXQucmVzb3VyY2Uub2ZmKCdzZXQ6bWVzaGVzJywgdGhpcy5fb25TZXRNZXNoZXMsIHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fb25SZW5kZXJBc3NldFVubG9hZCgpO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsQWRkZWQoaW5kZXgsIGNvbXBvbmVudCwgYXNzZXQpIHtcbiAgICAgICAgaWYgKGFzc2V0LnJlc291cmNlKSB7XG4gICAgICAgICAgICB0aGlzLl9vbk1hdGVyaWFsTG9hZChpbmRleCwgY29tcG9uZW50LCBhc3NldCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnN5c3RlbS5hcHAuYXNzZXRzLmxvYWQoYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgbWF0ZXJpYWwpIHtcbiAgICAgICAgLy8gZmlyc3QgbWF0ZXJpYWwgZm9yIHByaW1pdGl2ZXMgY2FuIGJlIGFjY2Vzc2VkIHVzaW5nIG1hdGVyaWFsIHByb3BlcnR5LCBzbyBzZXQgaXQgdXBcbiAgICAgICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLm1hdGVyaWFsID0gbWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25NYXRlcmlhbExvYWQoaW5kZXgsIGNvbXBvbmVudCwgYXNzZXQpIHtcbiAgICAgICAgaWYgKHRoaXMuX21lc2hJbnN0YW5jZXNbaW5kZXhdKSB7XG4gICAgICAgICAgICB0aGlzLl9tZXNoSW5zdGFuY2VzW2luZGV4XS5tYXRlcmlhbCA9IGFzc2V0LnJlc291cmNlO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZU1haW5NYXRlcmlhbChpbmRleCwgYXNzZXQucmVzb3VyY2UpO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsUmVtb3ZlKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzW2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0ubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdXBkYXRlTWFpbk1hdGVyaWFsKGluZGV4LCB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwpO1xuICAgIH1cblxuICAgIF9vbk1hdGVyaWFsVW5sb2FkKGluZGV4LCBjb21wb25lbnQsIGFzc2V0KSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoSW5zdGFuY2VzW2luZGV4XSkge1xuICAgICAgICAgICAgdGhpcy5fbWVzaEluc3RhbmNlc1tpbmRleF0ubWF0ZXJpYWwgPSB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fdXBkYXRlTWFpbk1hdGVyaWFsKGluZGV4LCB0aGlzLnN5c3RlbS5kZWZhdWx0TWF0ZXJpYWwpO1xuICAgIH1cblxuICAgIHJlc29sdmVEdXBsaWNhdGVkRW50aXR5UmVmZXJlbmNlUHJvcGVydGllcyhvbGRSZW5kZXIsIGR1cGxpY2F0ZWRJZHNNYXApIHtcbiAgICAgICAgaWYgKG9sZFJlbmRlci5yb290Qm9uZSAmJiBkdXBsaWNhdGVkSWRzTWFwW29sZFJlbmRlci5yb290Qm9uZV0pIHtcbiAgICAgICAgICAgIHRoaXMucm9vdEJvbmUgPSBkdXBsaWNhdGVkSWRzTWFwW29sZFJlbmRlci5yb290Qm9uZV07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY2xlYXJTa2luSW5zdGFuY2VzKCk7XG4gICAgfVxufVxuXG5leHBvcnQgeyBSZW5kZXJDb21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJSZW5kZXJDb21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl90eXBlIiwiX2Nhc3RTaGFkb3dzIiwiX3JlY2VpdmVTaGFkb3dzIiwiX2Nhc3RTaGFkb3dzTGlnaHRtYXAiLCJfbGlnaHRtYXBwZWQiLCJfbGlnaHRtYXBTaXplTXVsdGlwbGllciIsIl9pc1N0YXRpYyIsIl9iYXRjaEdyb3VwSWQiLCJfbGF5ZXJzIiwiTEFZRVJJRF9XT1JMRCIsIl9yZW5kZXJTdHlsZSIsIlJFTkRFUlNUWUxFX1NPTElEIiwiX21lc2hJbnN0YW5jZXMiLCJfY3VzdG9tQWFiYiIsIl9hcmVhIiwiX2Fzc2V0UmVmZXJlbmNlIiwiX21hdGVyaWFsUmVmZXJlbmNlcyIsIl9tYXRlcmlhbCIsIl9yb290Qm9uZSIsIkVudGl0eVJlZmVyZW5jZSIsIm9uIiwiX29uU2V0Um9vdEJvbmUiLCJBc3NldFJlZmVyZW5jZSIsImFwcCIsImFzc2V0cyIsImFkZCIsIl9vblJlbmRlckFzc2V0QWRkZWQiLCJsb2FkIiwiX29uUmVuZGVyQXNzZXRMb2FkIiwicmVtb3ZlIiwiX29uUmVuZGVyQXNzZXRSZW1vdmUiLCJ1bmxvYWQiLCJfb25SZW5kZXJBc3NldFVubG9hZCIsImRlZmF1bHRNYXRlcmlhbCIsIm9uUmVtb3ZlQ2hpbGQiLCJvbkluc2VydENoaWxkIiwicmVuZGVyU3R5bGUiLCJNZXNoSW5zdGFuY2UiLCJfcHJlcGFyZVJlbmRlclN0eWxlRm9yQXJyYXkiLCJjdXN0b21BYWJiIiwidmFsdWUiLCJtaSIsImkiLCJsZW5ndGgiLCJzZXRDdXN0b21BYWJiIiwidHlwZSIsImRlc3Ryb3lNZXNoSW5zdGFuY2VzIiwibWF0ZXJpYWwiLCJhc3NldCIsInJlc291cmNlIiwicHJpbURhdGEiLCJnZXRTaGFwZVByaW1pdGl2ZSIsImdyYXBoaWNzRGV2aWNlIiwiYXJlYSIsIm1lc2hJbnN0YW5jZXMiLCJtZXNoIiwiRGVidWciLCJhc3NlcnQiLCJBcnJheSIsImlzQXJyYXkiLCJub2RlIiwiY2FzdFNoYWRvdyIsInJlY2VpdmVTaGFkb3ciLCJpc1N0YXRpYyIsInNldExpZ2h0bWFwcGVkIiwiZW5hYmxlZCIsImFkZFRvTGF5ZXJzIiwibGlnaHRtYXBwZWQiLCJjYXN0U2hhZG93cyIsImxheWVycyIsInNjZW5lIiwibGF5ZXIiLCJnZXRMYXllckJ5SWQiLCJyZW1vdmVTaGFkb3dDYXN0ZXJzIiwiYWRkU2hhZG93Q2FzdGVycyIsInJlY2VpdmVTaGFkb3dzIiwiY2FzdFNoYWRvd3NMaWdodG1hcCIsImxpZ2h0bWFwU2l6ZU11bHRpcGxpZXIiLCJyZW1vdmVNZXNoSW5zdGFuY2VzIiwiYWRkTWVzaEluc3RhbmNlcyIsImJhdGNoR3JvdXBJZCIsIl90aGlzJHN5c3RlbSRhcHAkYmF0YyIsImJhdGNoZXIiLCJCYXRjaEdyb3VwIiwiUkVOREVSIiwiX3RoaXMkc3lzdGVtJGFwcCRiYXRjMiIsImluc2VydCIsIm1hdGVyaWFsQXNzZXRzIiwiaWQiLCJwdXNoIiwiX29uTWF0ZXJpYWxBZGRlZCIsIl9vbk1hdGVyaWFsTG9hZCIsIl9vbk1hdGVyaWFsUmVtb3ZlIiwiX29uTWF0ZXJpYWxVbmxvYWQiLCJBc3NldCIsIm1hcCIsInJlZiIsImFzc2lnbkFzc2V0IiwiX29uUm9vdEJvbmVDaGFuZ2VkIiwiX2NsZWFyU2tpbkluc3RhbmNlcyIsIl9jbG9uZVNraW5JbnN0YW5jZXMiLCJyZW1vdmVGcm9tTGF5ZXJzIiwiZGVzdHJveSIsIm9uUmVtb3ZlIiwibWF0ZXJpYWxBc3NldCIsIm9mZiIsIm9uTGF5ZXJzQ2hhbmdlZCIsIm9sZENvbXAiLCJuZXdDb21wIiwib25MYXllckFkZGVkIiwib25MYXllclJlbW92ZWQiLCJpbmRleCIsImluZGV4T2YiLCJvbkVuYWJsZSIsIm9uUGFyZW50Q29tcG9uZW50RW5hYmxlIiwiaXNBc3NldCIsIl9hcHAkYmF0Y2hlciIsIm9uRGlzYWJsZSIsIl9hcHAkYmF0Y2hlcjIiLCJoaWRlIiwidmlzaWJsZSIsInNob3ciLCJyZW5kZXIiLCJfb25TZXRNZXNoZXMiLCJtZXNoZXMiLCJfY2xvbmVNZXNoZXMiLCJtZXNoSW5zdGFuY2UiLCJTa2luSW5zdGFuY2VDYWNoZSIsInJlbW92ZUNhY2hlZFNraW5JbnN0YW5jZSIsInNraW5JbnN0YW5jZSIsIkdyYXBoTm9kZSIsInNraW4iLCJjcmVhdGVDYWNoZWRTa2luSW5zdGFuY2UiLCJtZXNoSW5zdCIsIm1vcnBoIiwibW9ycGhJbnN0YW5jZSIsIk1vcnBoSW5zdGFuY2UiLCJjb21wb25lbnQiLCJfdXBkYXRlTWFpbk1hdGVyaWFsIiwicmVzb2x2ZUR1cGxpY2F0ZWRFbnRpdHlSZWZlcmVuY2VQcm9wZXJ0aWVzIiwib2xkUmVuZGVyIiwiZHVwbGljYXRlZElkc01hcCIsInJvb3RCb25lIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBZ0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxlQUFlLFNBQVNDLFNBQVMsQ0FBQztBQThFcEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTs7QUFFckI7QUF4Rko7SUFBQSxJQUNBQyxDQUFBQSxLQUFLLEdBQUcsT0FBTyxDQUFBO0FBRWY7SUFBQSxJQUNBQyxDQUFBQSxZQUFZLEdBQUcsSUFBSSxDQUFBO0FBRW5CO0lBQUEsSUFDQUMsQ0FBQUEsZUFBZSxHQUFHLElBQUksQ0FBQTtBQUV0QjtJQUFBLElBQ0FDLENBQUFBLG9CQUFvQixHQUFHLElBQUksQ0FBQTtBQUUzQjtJQUFB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
