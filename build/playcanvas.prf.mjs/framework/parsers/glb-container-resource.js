import '../../core/debug.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Model } from '../../scene/model.js';
import { MorphInstance } from '../../scene/morph-instance.js';
import { SkinInstance } from '../../scene/skin-instance.js';
import { SkinInstanceCache } from '../../scene/skin-instance-cache.js';
import { Entity } from '../entity.js';
import { Asset } from '../asset/asset.js';

class GlbContainerResource {
	constructor(data, asset, assets, defaultMaterial) {
		const createAsset = function createAsset(type, resource, index) {
			const subAsset = GlbContainerResource.createAsset(asset.name, type, resource, index);
			assets.add(subAsset);
			return subAsset;
		};
		const renders = [];
		for (let i = 0; i < data.renders.length; ++i) {
			renders.push(createAsset('render', data.renders[i], i));
		}
		const materials = [];
		for (let i = 0; i < data.materials.length; ++i) {
			materials.push(createAsset('material', data.materials[i], i));
		}
		const animations = [];
		for (let i = 0; i < data.animations.length; ++i) {
			animations.push(createAsset('animation', data.animations[i], i));
		}
		this.data = data;
		this._model = null;
		this._assetName = asset.name;
		this._assets = assets;
		this._defaultMaterial = defaultMaterial;
		this.renders = renders;
		this.materials = materials;
		this.textures = data.textures;
		this.animations = animations;
	}
	get model() {
		if (!this._model) {
			const model = GlbContainerResource.createModel(this.data, this._defaultMaterial);
			const modelAsset = GlbContainerResource.createAsset(this._assetName, 'model', model, 0);
			this._assets.add(modelAsset);
			this._model = modelAsset;
		}
		return this._model;
	}
	static createAsset(assetName, type, resource, index) {
		const subAsset = new Asset(assetName + '/' + type + '/' + index, type, {
			url: ''
		});
		subAsset.resource = resource;
		subAsset.loaded = true;
		return subAsset;
	}
	instantiateModelEntity(options) {
		const entity = new Entity();
		entity.addComponent('model', Object.assign({
			type: 'asset',
			asset: this.model
		}, options));
		return entity;
	}
	instantiateRenderEntity(options) {
		const defaultMaterial = this._defaultMaterial;
		const skinnedMeshInstances = [];
		const createMeshInstance = function createMeshInstance(root, entity, mesh, materials, meshDefaultMaterials, skins, gltfNode) {
			const materialIndex = meshDefaultMaterials[mesh.id];
			const material = materialIndex === undefined ? defaultMaterial : materials[materialIndex];
			const meshInstance = new MeshInstance(mesh, material);
			if (mesh.morph) {
				meshInstance.morphInstance = new MorphInstance(mesh.morph);
			}
			if (gltfNode.hasOwnProperty('skin')) {
				skinnedMeshInstances.push({
					meshInstance: meshInstance,
					rootBone: root,
					entity: entity
				});
			}
			return meshInstance;
		};
		const cloneHierarchy = (root, node, glb) => {
			const entity = new Entity();
			node._cloneInternal(entity);
			if (!root) root = entity;
			let attachedMi = null;
			let renderAsset = null;
			for (let i = 0; i < glb.nodes.length; i++) {
				const glbNode = glb.nodes[i];
				if (glbNode === node) {
					const gltfNode = glb.gltf.nodes[i];
					if (gltfNode.hasOwnProperty('mesh')) {
						const meshGroup = glb.renders[gltfNode.mesh].meshes;
						renderAsset = this.renders[gltfNode.mesh];
						for (let mi = 0; mi < meshGroup.length; mi++) {
							const mesh = meshGroup[mi];
							if (mesh) {
								const cloneMi = createMeshInstance(root, entity, mesh, glb.materials, glb.meshDefaultMaterials, glb.skins, gltfNode);
								if (!attachedMi) {
									attachedMi = [];
								}
								attachedMi.push(cloneMi);
							}
						}
					}
					if (glb.lights) {
						const lightEntity = glb.lights.get(gltfNode);
						if (lightEntity) {
							entity.addChild(lightEntity.clone());
						}
					}
					if (glb.cameras) {
						const cameraEntity = glb.cameras.get(gltfNode);
						if (cameraEntity) {
							cameraEntity.camera.system.cloneComponent(cameraEntity, entity);
						}
					}
				}
			}
			if (attachedMi) {
				entity.addComponent('render', Object.assign({
					type: 'asset',
					meshInstances: attachedMi,
					rootBone: root
				}, options));
				entity.render.assignAsset(renderAsset);
			}
			const children = node.children;
			for (let i = 0; i < children.length; i++) {
				const childClone = cloneHierarchy(root, children[i], glb);
				entity.addChild(childClone);
			}
			return entity;
		};
		const sceneClones = [];
		for (const scene of this.data.scenes) {
			sceneClones.push(cloneHierarchy(null, scene, this.data));
		}
		skinnedMeshInstances.forEach(data => {
			data.meshInstance.skinInstance = SkinInstanceCache.createCachedSkinInstance(data.meshInstance.mesh.skin, data.rootBone, data.entity);
		});
		return GlbContainerResource.createSceneHierarchy(sceneClones, 'Entity');
	}
	getMaterialVariants() {
		return this.data.variants ? Object.keys(this.data.variants) : [];
	}
	applyMaterialVariant(entity, name) {
		const variant = name ? this.data.variants[name] : null;
		if (variant === undefined) {
			return;
		}
		const renders = entity.findComponents("render");
		for (let i = 0; i < renders.length; i++) {
			const renderComponent = renders[i];
			this._applyMaterialVariant(variant, renderComponent.meshInstances);
		}
	}
	applyMaterialVariantInstances(instances, name) {
		const variant = name ? this.data.variants[name] : null;
		if (variant === undefined) {
			return;
		}
		this._applyMaterialVariant(variant, instances);
	}
	_applyMaterialVariant(variant, instances) {
		instances.forEach(instance => {
			if (variant === null) {
				instance.material = this._defaultMaterial;
			} else {
				const meshVariants = this.data.meshVariants[instance.mesh.id];
				if (meshVariants) {
					instance.material = this.data.materials[meshVariants[variant]];
				}
			}
		});
	}
	static createSceneHierarchy(sceneNodes, nodeType) {
		let root = null;
		if (sceneNodes.length === 1) {
			root = sceneNodes[0];
		} else {
			root = new nodeType('SceneGroup');
			for (const scene of sceneNodes) {
				root.addChild(scene);
			}
		}
		return root;
	}
	static createModel(glb, defaultMaterial) {
		const createMeshInstance = function createMeshInstance(model, mesh, skins, skinInstances, materials, node, gltfNode) {
			const materialIndex = glb.meshDefaultMaterials[mesh.id];
			const material = materialIndex === undefined ? defaultMaterial : materials[materialIndex];
			const meshInstance = new MeshInstance(mesh, material, node);
			if (mesh.morph) {
				const morphInstance = new MorphInstance(mesh.morph);
				meshInstance.morphInstance = morphInstance;
				model.morphInstances.push(morphInstance);
			}
			if (gltfNode.hasOwnProperty('skin')) {
				const skinIndex = gltfNode.skin;
				const skin = skins[skinIndex];
				mesh.skin = skin;
				const skinInstance = skinInstances[skinIndex];
				meshInstance.skinInstance = skinInstance;
				model.skinInstances.push(skinInstance);
			}
			model.meshInstances.push(meshInstance);
		};
		const model = new Model();
		const skinInstances = [];
		for (const skin of glb.skins) {
			const skinInstance = new SkinInstance(skin);
			skinInstance.bones = skin.bones;
			skinInstances.push(skinInstance);
		}
		model.graph = GlbContainerResource.createSceneHierarchy(glb.scenes, 'GraphNode');
		for (let i = 0; i < glb.nodes.length; i++) {
			const node = glb.nodes[i];
			if (node.root === model.graph) {
				const gltfNode = glb.gltf.nodes[i];
				if (gltfNode.hasOwnProperty('mesh')) {
					const meshGroup = glb.renders[gltfNode.mesh].meshes;
					for (let mi = 0; mi < meshGroup.length; mi++) {
						const mesh = meshGroup[mi];
						if (mesh) {
							createMeshInstance(model, mesh, glb.skins, skinInstances, glb.materials, node, gltfNode);
						}
					}
				}
			}
		}
		return model;
	}
	destroy() {
		const registry = this._assets;
		const destroyAsset = function destroyAsset(asset) {
			registry.remove(asset);
			asset.unload();
		};
		const destroyAssets = function destroyAssets(assets) {
			assets.forEach(function (asset) {
				destroyAsset(asset);
			});
		};
		if (this.animations) {
			destroyAssets(this.animations);
			this.animations = null;
		}
		if (this.textures) {
			destroyAssets(this.textures);
			this.textures = null;
		}
		if (this.materials) {
			destroyAssets(this.materials);
			this.materials = null;
		}
		if (this.renders) {
			destroyAssets(this.renders);
			this.renders = null;
		}
		if (this._model) {
			destroyAsset(this._model);
			this._model = null;
		}
		this.data = null;
		this.assets = null;
	}
}

export { GlbContainerResource };
