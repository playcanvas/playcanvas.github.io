import '../../../core/debug.js';
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
