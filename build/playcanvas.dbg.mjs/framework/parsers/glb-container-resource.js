/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../core/debug.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Model } from '../../scene/model.js';
import { MorphInstance } from '../../scene/morph-instance.js';
import { SkinInstance } from '../../scene/skin-instance.js';
import { SkinInstanceCache } from '../../scene/skin-instance-cache.js';
import { Entity } from '../entity.js';
import { Asset } from '../asset/asset.js';

// Container resource returned by the GlbParser. Implements the ContainerResource interface.
class GlbContainerResource {
  constructor(data, asset, assets, defaultMaterial) {
    const createAsset = function createAsset(type, resource, index) {
      const subAsset = GlbContainerResource.createAsset(asset.name, type, resource, index);
      assets.add(subAsset);
      return subAsset;
    };

    // render assets
    const renders = [];
    for (let i = 0; i < data.renders.length; ++i) {
      renders.push(createAsset('render', data.renders[i], i));
    }

    // create material assets
    const materials = [];
    for (let i = 0; i < data.materials.length; ++i) {
      materials.push(createAsset('material', data.materials[i], i));
    }

    // create animation assets
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
    this.textures = data.textures; // texture assets are created directly
    this.animations = animations;
  }
  get model() {
    if (!this._model) {
      // create model only when needed
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
      // clone mesh instance
      const materialIndex = meshDefaultMaterials[mesh.id];
      const material = materialIndex === undefined ? defaultMaterial : materials[materialIndex];
      const meshInstance = new MeshInstance(mesh, material);

      // create morph instance
      if (mesh.morph) {
        meshInstance.morphInstance = new MorphInstance(mesh.morph);
      }

      // store data to create skin instance after the hierarchy is created
      if (gltfNode.hasOwnProperty('skin')) {
        skinnedMeshInstances.push({
          meshInstance: meshInstance,
          rootBone: root,
          entity: entity
        });
      }
      return meshInstance;
    };

    // helper function to recursively clone a hierarchy of GraphNodes to Entities
    const cloneHierarchy = (root, node, glb) => {
      const entity = new Entity();
      node._cloneInternal(entity);

      // first entity becomes the root
      if (!root) root = entity;

      // find all components needed for this node
      let attachedMi = null;
      let renderAsset = null;
      for (let i = 0; i < glb.nodes.length; i++) {
        const glbNode = glb.nodes[i];
        if (glbNode === node) {
          const gltfNode = glb.gltf.nodes[i];

          // mesh
          if (gltfNode.hasOwnProperty('mesh')) {
            const meshGroup = glb.renders[gltfNode.mesh].meshes;
            renderAsset = this.renders[gltfNode.mesh];
            for (var mi = 0; mi < meshGroup.length; mi++) {
              const mesh = meshGroup[mi];
              if (mesh) {
                const cloneMi = createMeshInstance(root, entity, mesh, glb.materials, glb.meshDefaultMaterials, glb.skins, gltfNode);

                // add it to list
                if (!attachedMi) {
                  attachedMi = [];
                }
                attachedMi.push(cloneMi);
              }
            }
          }

          // light - clone (additional child) entity with the light component
          // cannot clone the component as additional entity has a rotation to handle different light direction
          if (glb.lights) {
            const lightEntity = glb.lights.get(gltfNode);
            if (lightEntity) {
              entity.addChild(lightEntity.clone());
            }
          }

          // camera
          if (glb.cameras) {
            const cameraEntity = glb.cameras.get(gltfNode);
            if (cameraEntity) {
              // clone camera component into the entity
              cameraEntity.camera.system.cloneComponent(cameraEntity, entity);
            }
          }
        }
      }

      // create render components for mesh instances
      if (attachedMi) {
        entity.addComponent('render', Object.assign({
          type: 'asset',
          meshInstances: attachedMi,
          rootBone: root
        }, options));

        // assign asset id without recreating mesh instances which are already set up with materials
        entity.render.assignAsset(renderAsset);
      }

      // recursively clone children
      const children = node.children;
      for (let i = 0; i < children.length; i++) {
        const childClone = cloneHierarchy(root, children[i], glb);
        entity.addChild(childClone);
      }
      return entity;
    };

    // clone scenes hierarchies
    const sceneClones = [];
    for (const scene of this.data.scenes) {
      sceneClones.push(cloneHierarchy(null, scene, this.data));
    }

    // now that the hierarchy is created, create skin instances and resolve bones using the hierarchy
    skinnedMeshInstances.forEach(data => {
      data.meshInstance.skinInstance = SkinInstanceCache.createCachedSkinInstance(data.meshInstance.mesh.skin, data.rootBone, data.entity);
    });

    // return the scene hierarchy created from scene clones
    return GlbContainerResource.createSceneHierarchy(sceneClones, 'Entity');
  }

  // get material variants
  getMaterialVariants() {
    return this.data.variants ? Object.keys(this.data.variants) : [];
  }

  // apply material variant to entity
  applyMaterialVariant(entity, name) {
    const variant = name ? this.data.variants[name] : null;
    if (variant === undefined) {
      Debug.warn(`No variant named ${name} exists in resource`);
      return;
    }
    const renders = entity.findComponents("render");
    for (let i = 0; i < renders.length; i++) {
      const renderComponent = renders[i];
      this._applyMaterialVariant(variant, renderComponent.meshInstances);
    }
  }

  // apply material variant to mesh instances
  applyMaterialVariantInstances(instances, name) {
    const variant = name ? this.data.variants[name] : null;
    if (variant === undefined) {
      Debug.warn(`No variant named ${name} exists in resource`);
      return;
    }
    this._applyMaterialVariant(variant, instances);
  }

  // internally apply variant to instances
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
      Debug.assert(instance.material);
    });
  }

  // helper function to create a single hierarchy from an array of nodes
  static createSceneHierarchy(sceneNodes, nodeType) {
    // create a single root of the hierarchy - either the single scene, or a new Entity parent if multiple scenes
    let root = null;
    if (sceneNodes.length === 1) {
      // use scene if only one
      root = sceneNodes[0];
    } else {
      // create group node for all scenes
      root = new nodeType('SceneGroup');
      for (const scene of sceneNodes) {
        root.addChild(scene);
      }
    }
    return root;
  }

  // create a pc.Model from the parsed GLB data structures
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

    // create skinInstance for each skin
    const skinInstances = [];
    for (const skin of glb.skins) {
      const skinInstance = new SkinInstance(skin);
      skinInstance.bones = skin.bones;
      skinInstances.push(skinInstance);
    }

    // node hierarchy for the model
    model.graph = GlbContainerResource.createSceneHierarchy(glb.scenes, 'GraphNode');

    // create mesh instance for meshes on nodes that are part of hierarchy
    for (let i = 0; i < glb.nodes.length; i++) {
      const node = glb.nodes[i];
      if (node.root === model.graph) {
        const gltfNode = glb.gltf.nodes[i];
        if (gltfNode.hasOwnProperty('mesh')) {
          const meshGroup = glb.renders[gltfNode.mesh].meshes;
          for (var mi = 0; mi < meshGroup.length; mi++) {
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

    // unload and destroy assets
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xiLWNvbnRhaW5lci1yZXNvdXJjZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9wYXJzZXJzL2dsYi1jb250YWluZXItcmVzb3VyY2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRGVidWcgfSBmcm9tICcuLi8uLi9jb3JlL2RlYnVnLmpzJztcblxuaW1wb3J0IHsgTWVzaEluc3RhbmNlIH0gZnJvbSAnLi4vLi4vc2NlbmUvbWVzaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBNb2RlbCB9IGZyb20gJy4uLy4uL3NjZW5lL21vZGVsLmpzJztcbmltcG9ydCB7IE1vcnBoSW5zdGFuY2UgfSBmcm9tICcuLi8uLi9zY2VuZS9tb3JwaC1pbnN0YW5jZS5qcyc7XG5pbXBvcnQgeyBTa2luSW5zdGFuY2UgfSBmcm9tICcuLi8uLi9zY2VuZS9za2luLWluc3RhbmNlLmpzJztcbmltcG9ydCB7IFNraW5JbnN0YW5jZUNhY2hlIH0gZnJvbSAnLi4vLi4vc2NlbmUvc2tpbi1pbnN0YW5jZS1jYWNoZS5qcyc7XG5cbmltcG9ydCB7IEVudGl0eSB9IGZyb20gJy4uL2VudGl0eS5qcyc7XG5pbXBvcnQgeyBBc3NldCB9IGZyb20gJy4uL2Fzc2V0L2Fzc2V0LmpzJztcblxuLy8gQ29udGFpbmVyIHJlc291cmNlIHJldHVybmVkIGJ5IHRoZSBHbGJQYXJzZXIuIEltcGxlbWVudHMgdGhlIENvbnRhaW5lclJlc291cmNlIGludGVyZmFjZS5cbmNsYXNzIEdsYkNvbnRhaW5lclJlc291cmNlIHtcbiAgICBjb25zdHJ1Y3RvcihkYXRhLCBhc3NldCwgYXNzZXRzLCBkZWZhdWx0TWF0ZXJpYWwpIHtcbiAgICAgICAgY29uc3QgY3JlYXRlQXNzZXQgPSBmdW5jdGlvbiAodHlwZSwgcmVzb3VyY2UsIGluZGV4KSB7XG4gICAgICAgICAgICBjb25zdCBzdWJBc3NldCA9IEdsYkNvbnRhaW5lclJlc291cmNlLmNyZWF0ZUFzc2V0KGFzc2V0Lm5hbWUsIHR5cGUsIHJlc291cmNlLCBpbmRleCk7XG4gICAgICAgICAgICBhc3NldHMuYWRkKHN1YkFzc2V0KTtcbiAgICAgICAgICAgIHJldHVybiBzdWJBc3NldDtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyByZW5kZXIgYXNzZXRzXG4gICAgICAgIGNvbnN0IHJlbmRlcnMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLnJlbmRlcnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHJlbmRlcnMucHVzaChjcmVhdGVBc3NldCgncmVuZGVyJywgZGF0YS5yZW5kZXJzW2ldLCBpKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjcmVhdGUgbWF0ZXJpYWwgYXNzZXRzXG4gICAgICAgIGNvbnN0IG1hdGVyaWFscyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEubWF0ZXJpYWxzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBtYXRlcmlhbHMucHVzaChjcmVhdGVBc3NldCgnbWF0ZXJpYWwnLCBkYXRhLm1hdGVyaWFsc1tpXSwgaSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gY3JlYXRlIGFuaW1hdGlvbiBhc3NldHNcbiAgICAgICAgY29uc3QgYW5pbWF0aW9ucyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRhdGEuYW5pbWF0aW9ucy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgYW5pbWF0aW9ucy5wdXNoKGNyZWF0ZUFzc2V0KCdhbmltYXRpb24nLCBkYXRhLmFuaW1hdGlvbnNbaV0sIGkpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgICAgIHRoaXMuX21vZGVsID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXNzZXROYW1lID0gYXNzZXQubmFtZTtcbiAgICAgICAgdGhpcy5fYXNzZXRzID0gYXNzZXRzO1xuICAgICAgICB0aGlzLl9kZWZhdWx0TWF0ZXJpYWwgPSBkZWZhdWx0TWF0ZXJpYWw7XG4gICAgICAgIHRoaXMucmVuZGVycyA9IHJlbmRlcnM7XG4gICAgICAgIHRoaXMubWF0ZXJpYWxzID0gbWF0ZXJpYWxzO1xuICAgICAgICB0aGlzLnRleHR1cmVzID0gZGF0YS50ZXh0dXJlczsgLy8gdGV4dHVyZSBhc3NldHMgYXJlIGNyZWF0ZWQgZGlyZWN0bHlcbiAgICAgICAgdGhpcy5hbmltYXRpb25zID0gYW5pbWF0aW9ucztcbiAgICB9XG5cbiAgICBnZXQgbW9kZWwoKSB7XG4gICAgICAgIGlmICghdGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIC8vIGNyZWF0ZSBtb2RlbCBvbmx5IHdoZW4gbmVlZGVkXG4gICAgICAgICAgICBjb25zdCBtb2RlbCA9IEdsYkNvbnRhaW5lclJlc291cmNlLmNyZWF0ZU1vZGVsKHRoaXMuZGF0YSwgdGhpcy5fZGVmYXVsdE1hdGVyaWFsKTtcbiAgICAgICAgICAgIGNvbnN0IG1vZGVsQXNzZXQgPSBHbGJDb250YWluZXJSZXNvdXJjZS5jcmVhdGVBc3NldCh0aGlzLl9hc3NldE5hbWUsICdtb2RlbCcsIG1vZGVsLCAwKTtcbiAgICAgICAgICAgIHRoaXMuX2Fzc2V0cy5hZGQobW9kZWxBc3NldCk7XG4gICAgICAgICAgICB0aGlzLl9tb2RlbCA9IG1vZGVsQXNzZXQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuX21vZGVsO1xuICAgIH1cblxuICAgIHN0YXRpYyBjcmVhdGVBc3NldChhc3NldE5hbWUsIHR5cGUsIHJlc291cmNlLCBpbmRleCkge1xuICAgICAgICBjb25zdCBzdWJBc3NldCA9IG5ldyBBc3NldChhc3NldE5hbWUgKyAnLycgKyB0eXBlICsgJy8nICsgaW5kZXgsIHR5cGUsIHtcbiAgICAgICAgICAgIHVybDogJydcbiAgICAgICAgfSk7XG4gICAgICAgIHN1YkFzc2V0LnJlc291cmNlID0gcmVzb3VyY2U7XG4gICAgICAgIHN1YkFzc2V0LmxvYWRlZCA9IHRydWU7XG4gICAgICAgIHJldHVybiBzdWJBc3NldDtcbiAgICB9XG5cbiAgICBpbnN0YW50aWF0ZU1vZGVsRW50aXR5KG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3QgZW50aXR5ID0gbmV3IEVudGl0eSgpO1xuICAgICAgICBlbnRpdHkuYWRkQ29tcG9uZW50KCdtb2RlbCcsIE9iamVjdC5hc3NpZ24oeyB0eXBlOiAnYXNzZXQnLCBhc3NldDogdGhpcy5tb2RlbCB9LCBvcHRpb25zKSk7XG4gICAgICAgIHJldHVybiBlbnRpdHk7XG4gICAgfVxuXG4gICAgaW5zdGFudGlhdGVSZW5kZXJFbnRpdHkob3B0aW9ucykge1xuXG4gICAgICAgIGNvbnN0IGRlZmF1bHRNYXRlcmlhbCA9IHRoaXMuX2RlZmF1bHRNYXRlcmlhbDtcbiAgICAgICAgY29uc3Qgc2tpbm5lZE1lc2hJbnN0YW5jZXMgPSBbXTtcblxuICAgICAgICBjb25zdCBjcmVhdGVNZXNoSW5zdGFuY2UgPSBmdW5jdGlvbiAocm9vdCwgZW50aXR5LCBtZXNoLCBtYXRlcmlhbHMsIG1lc2hEZWZhdWx0TWF0ZXJpYWxzLCBza2lucywgZ2x0Zk5vZGUpIHtcblxuICAgICAgICAgICAgLy8gY2xvbmUgbWVzaCBpbnN0YW5jZVxuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWxJbmRleCA9IG1lc2hEZWZhdWx0TWF0ZXJpYWxzW21lc2guaWRdO1xuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSAobWF0ZXJpYWxJbmRleCA9PT0gdW5kZWZpbmVkKSA/IGRlZmF1bHRNYXRlcmlhbCA6IG1hdGVyaWFsc1ttYXRlcmlhbEluZGV4XTtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaCwgbWF0ZXJpYWwpO1xuXG4gICAgICAgICAgICAvLyBjcmVhdGUgbW9ycGggaW5zdGFuY2VcbiAgICAgICAgICAgIGlmIChtZXNoLm1vcnBoKSB7XG4gICAgICAgICAgICAgICAgbWVzaEluc3RhbmNlLm1vcnBoSW5zdGFuY2UgPSBuZXcgTW9ycGhJbnN0YW5jZShtZXNoLm1vcnBoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3RvcmUgZGF0YSB0byBjcmVhdGUgc2tpbiBpbnN0YW5jZSBhZnRlciB0aGUgaGllcmFyY2h5IGlzIGNyZWF0ZWRcbiAgICAgICAgICAgIGlmIChnbHRmTm9kZS5oYXNPd25Qcm9wZXJ0eSgnc2tpbicpKSB7XG4gICAgICAgICAgICAgICAgc2tpbm5lZE1lc2hJbnN0YW5jZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZTogbWVzaEluc3RhbmNlLFxuICAgICAgICAgICAgICAgICAgICByb290Qm9uZTogcm9vdCxcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5OiBlbnRpdHlcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG1lc2hJbnN0YW5jZTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBoZWxwZXIgZnVuY3Rpb24gdG8gcmVjdXJzaXZlbHkgY2xvbmUgYSBoaWVyYXJjaHkgb2YgR3JhcGhOb2RlcyB0byBFbnRpdGllc1xuICAgICAgICBjb25zdCBjbG9uZUhpZXJhcmNoeSA9IChyb290LCBub2RlLCBnbGIpID0+IHtcblxuICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gbmV3IEVudGl0eSgpO1xuICAgICAgICAgICAgbm9kZS5fY2xvbmVJbnRlcm5hbChlbnRpdHkpO1xuXG4gICAgICAgICAgICAvLyBmaXJzdCBlbnRpdHkgYmVjb21lcyB0aGUgcm9vdFxuICAgICAgICAgICAgaWYgKCFyb290KSByb290ID0gZW50aXR5O1xuXG4gICAgICAgICAgICAvLyBmaW5kIGFsbCBjb21wb25lbnRzIG5lZWRlZCBmb3IgdGhpcyBub2RlXG4gICAgICAgICAgICBsZXQgYXR0YWNoZWRNaSA9IG51bGw7XG4gICAgICAgICAgICBsZXQgcmVuZGVyQXNzZXQgPSBudWxsO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbGIubm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBnbGJOb2RlID0gZ2xiLm5vZGVzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChnbGJOb2RlID09PSBub2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZOb2RlID0gZ2xiLmdsdGYubm9kZXNbaV07XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gbWVzaFxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ21lc2gnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzaEdyb3VwID0gZ2xiLnJlbmRlcnNbZ2x0Zk5vZGUubWVzaF0ubWVzaGVzO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVuZGVyQXNzZXQgPSB0aGlzLnJlbmRlcnNbZ2x0Zk5vZGUubWVzaF07XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBtaSA9IDA7IG1pIDwgbWVzaEdyb3VwLmxlbmd0aDsgbWkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSBtZXNoR3JvdXBbbWldO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtZXNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsb25lTWkgPSBjcmVhdGVNZXNoSW5zdGFuY2Uocm9vdCwgZW50aXR5LCBtZXNoLCBnbGIubWF0ZXJpYWxzLCBnbGIubWVzaERlZmF1bHRNYXRlcmlhbHMsIGdsYi5za2lucywgZ2x0Zk5vZGUpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFkZCBpdCB0byBsaXN0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghYXR0YWNoZWRNaSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXR0YWNoZWRNaSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF0dGFjaGVkTWkucHVzaChjbG9uZU1pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAvLyBsaWdodCAtIGNsb25lIChhZGRpdGlvbmFsIGNoaWxkKSBlbnRpdHkgd2l0aCB0aGUgbGlnaHQgY29tcG9uZW50XG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbm5vdCBjbG9uZSB0aGUgY29tcG9uZW50IGFzIGFkZGl0aW9uYWwgZW50aXR5IGhhcyBhIHJvdGF0aW9uIHRvIGhhbmRsZSBkaWZmZXJlbnQgbGlnaHQgZGlyZWN0aW9uXG4gICAgICAgICAgICAgICAgICAgIGlmIChnbGIubGlnaHRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsaWdodEVudGl0eSA9IGdsYi5saWdodHMuZ2V0KGdsdGZOb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsaWdodEVudGl0eSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eS5hZGRDaGlsZChsaWdodEVudGl0eS5jbG9uZSgpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGNhbWVyYVxuICAgICAgICAgICAgICAgICAgICBpZiAoZ2xiLmNhbWVyYXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhbWVyYUVudGl0eSA9IGdsYi5jYW1lcmFzLmdldChnbHRmTm9kZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FtZXJhRW50aXR5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xvbmUgY2FtZXJhIGNvbXBvbmVudCBpbnRvIHRoZSBlbnRpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYW1lcmFFbnRpdHkuY2FtZXJhLnN5c3RlbS5jbG9uZUNvbXBvbmVudChjYW1lcmFFbnRpdHksIGVudGl0eSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSByZW5kZXIgY29tcG9uZW50cyBmb3IgbWVzaCBpbnN0YW5jZXNcbiAgICAgICAgICAgIGlmIChhdHRhY2hlZE1pKSB7XG4gICAgICAgICAgICAgICAgZW50aXR5LmFkZENvbXBvbmVudCgncmVuZGVyJywgT2JqZWN0LmFzc2lnbih7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhc3NldCcsXG4gICAgICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZXM6IGF0dGFjaGVkTWksXG4gICAgICAgICAgICAgICAgICAgIHJvb3RCb25lOiByb290XG4gICAgICAgICAgICAgICAgfSwgb3B0aW9ucykpO1xuXG4gICAgICAgICAgICAgICAgLy8gYXNzaWduIGFzc2V0IGlkIHdpdGhvdXQgcmVjcmVhdGluZyBtZXNoIGluc3RhbmNlcyB3aGljaCBhcmUgYWxyZWFkeSBzZXQgdXAgd2l0aCBtYXRlcmlhbHNcbiAgICAgICAgICAgICAgICBlbnRpdHkucmVuZGVyLmFzc2lnbkFzc2V0KHJlbmRlckFzc2V0KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVjdXJzaXZlbHkgY2xvbmUgY2hpbGRyZW5cbiAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZENsb25lID0gY2xvbmVIaWVyYXJjaHkocm9vdCwgY2hpbGRyZW5baV0sIGdsYik7XG4gICAgICAgICAgICAgICAgZW50aXR5LmFkZENoaWxkKGNoaWxkQ2xvbmUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gZW50aXR5O1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIGNsb25lIHNjZW5lcyBoaWVyYXJjaGllc1xuICAgICAgICBjb25zdCBzY2VuZUNsb25lcyA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHNjZW5lIG9mIHRoaXMuZGF0YS5zY2VuZXMpIHtcbiAgICAgICAgICAgIHNjZW5lQ2xvbmVzLnB1c2goY2xvbmVIaWVyYXJjaHkobnVsbCwgc2NlbmUsIHRoaXMuZGF0YSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbm93IHRoYXQgdGhlIGhpZXJhcmNoeSBpcyBjcmVhdGVkLCBjcmVhdGUgc2tpbiBpbnN0YW5jZXMgYW5kIHJlc29sdmUgYm9uZXMgdXNpbmcgdGhlIGhpZXJhcmNoeVxuICAgICAgICBza2lubmVkTWVzaEluc3RhbmNlcy5mb3JFYWNoKChkYXRhKSA9PiB7XG4gICAgICAgICAgICBkYXRhLm1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UgPSBTa2luSW5zdGFuY2VDYWNoZS5jcmVhdGVDYWNoZWRTa2luSW5zdGFuY2UoZGF0YS5tZXNoSW5zdGFuY2UubWVzaC5za2luLCBkYXRhLnJvb3RCb25lLCBkYXRhLmVudGl0eSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIHJldHVybiB0aGUgc2NlbmUgaGllcmFyY2h5IGNyZWF0ZWQgZnJvbSBzY2VuZSBjbG9uZXNcbiAgICAgICAgcmV0dXJuIEdsYkNvbnRhaW5lclJlc291cmNlLmNyZWF0ZVNjZW5lSGllcmFyY2h5KHNjZW5lQ2xvbmVzLCAnRW50aXR5Jyk7XG4gICAgfVxuXG4gICAgLy8gZ2V0IG1hdGVyaWFsIHZhcmlhbnRzXG4gICAgZ2V0TWF0ZXJpYWxWYXJpYW50cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS52YXJpYW50cyA/IE9iamVjdC5rZXlzKHRoaXMuZGF0YS52YXJpYW50cykgOiBbXTtcbiAgICB9XG5cbiAgICAvLyBhcHBseSBtYXRlcmlhbCB2YXJpYW50IHRvIGVudGl0eVxuICAgIGFwcGx5TWF0ZXJpYWxWYXJpYW50KGVudGl0eSwgbmFtZSkge1xuICAgICAgICBjb25zdCB2YXJpYW50ID0gbmFtZSA/IHRoaXMuZGF0YS52YXJpYW50c1tuYW1lXSA6IG51bGw7XG4gICAgICAgIGlmICh2YXJpYW50ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIERlYnVnLndhcm4oYE5vIHZhcmlhbnQgbmFtZWQgJHtuYW1lfSBleGlzdHMgaW4gcmVzb3VyY2VgKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZW5kZXJzID0gZW50aXR5LmZpbmRDb21wb25lbnRzKFwicmVuZGVyXCIpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbmRlckNvbXBvbmVudCA9IHJlbmRlcnNbaV07XG4gICAgICAgICAgICB0aGlzLl9hcHBseU1hdGVyaWFsVmFyaWFudCh2YXJpYW50LCByZW5kZXJDb21wb25lbnQubWVzaEluc3RhbmNlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhcHBseSBtYXRlcmlhbCB2YXJpYW50IHRvIG1lc2ggaW5zdGFuY2VzXG4gICAgYXBwbHlNYXRlcmlhbFZhcmlhbnRJbnN0YW5jZXMoaW5zdGFuY2VzLCBuYW1lKSB7XG4gICAgICAgIGNvbnN0IHZhcmlhbnQgPSBuYW1lID8gdGhpcy5kYXRhLnZhcmlhbnRzW25hbWVdIDogbnVsbDtcbiAgICAgICAgaWYgKHZhcmlhbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgRGVidWcud2FybihgTm8gdmFyaWFudCBuYW1lZCAke25hbWV9IGV4aXN0cyBpbiByZXNvdXJjZWApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2FwcGx5TWF0ZXJpYWxWYXJpYW50KHZhcmlhbnQsIGluc3RhbmNlcyk7XG4gICAgfVxuXG4gICAgLy8gaW50ZXJuYWxseSBhcHBseSB2YXJpYW50IHRvIGluc3RhbmNlc1xuICAgIF9hcHBseU1hdGVyaWFsVmFyaWFudCh2YXJpYW50LCBpbnN0YW5jZXMpIHtcbiAgICAgICAgaW5zdGFuY2VzLmZvckVhY2goKGluc3RhbmNlKSA9PiB7XG4gICAgICAgICAgICBpZiAodmFyaWFudCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLm1hdGVyaWFsID0gdGhpcy5fZGVmYXVsdE1hdGVyaWFsO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNoVmFyaWFudHMgPSB0aGlzLmRhdGEubWVzaFZhcmlhbnRzW2luc3RhbmNlLm1lc2guaWRdO1xuICAgICAgICAgICAgICAgIGlmIChtZXNoVmFyaWFudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zdGFuY2UubWF0ZXJpYWwgPSB0aGlzLmRhdGEubWF0ZXJpYWxzW21lc2hWYXJpYW50c1t2YXJpYW50XV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgRGVidWcuYXNzZXJ0KGluc3RhbmNlLm1hdGVyaWFsKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gaGVscGVyIGZ1bmN0aW9uIHRvIGNyZWF0ZSBhIHNpbmdsZSBoaWVyYXJjaHkgZnJvbSBhbiBhcnJheSBvZiBub2Rlc1xuICAgIHN0YXRpYyBjcmVhdGVTY2VuZUhpZXJhcmNoeShzY2VuZU5vZGVzLCBub2RlVHlwZSkge1xuXG4gICAgICAgIC8vIGNyZWF0ZSBhIHNpbmdsZSByb290IG9mIHRoZSBoaWVyYXJjaHkgLSBlaXRoZXIgdGhlIHNpbmdsZSBzY2VuZSwgb3IgYSBuZXcgRW50aXR5IHBhcmVudCBpZiBtdWx0aXBsZSBzY2VuZXNcbiAgICAgICAgbGV0IHJvb3QgPSBudWxsO1xuICAgICAgICBpZiAoc2NlbmVOb2Rlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIC8vIHVzZSBzY2VuZSBpZiBvbmx5IG9uZVxuICAgICAgICAgICAgcm9vdCA9IHNjZW5lTm9kZXNbMF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBjcmVhdGUgZ3JvdXAgbm9kZSBmb3IgYWxsIHNjZW5lc1xuICAgICAgICAgICAgcm9vdCA9IG5ldyBub2RlVHlwZSgnU2NlbmVHcm91cCcpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBzY2VuZSBvZiBzY2VuZU5vZGVzKSB7XG4gICAgICAgICAgICAgICAgcm9vdC5hZGRDaGlsZChzY2VuZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9XG5cbiAgICAvLyBjcmVhdGUgYSBwYy5Nb2RlbCBmcm9tIHRoZSBwYXJzZWQgR0xCIGRhdGEgc3RydWN0dXJlc1xuICAgIHN0YXRpYyBjcmVhdGVNb2RlbChnbGIsIGRlZmF1bHRNYXRlcmlhbCkge1xuXG4gICAgICAgIGNvbnN0IGNyZWF0ZU1lc2hJbnN0YW5jZSA9IGZ1bmN0aW9uIChtb2RlbCwgbWVzaCwgc2tpbnMsIHNraW5JbnN0YW5jZXMsIG1hdGVyaWFscywgbm9kZSwgZ2x0Zk5vZGUpIHtcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsSW5kZXggPSBnbGIubWVzaERlZmF1bHRNYXRlcmlhbHNbbWVzaC5pZF07XG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbCA9IChtYXRlcmlhbEluZGV4ID09PSB1bmRlZmluZWQpID8gZGVmYXVsdE1hdGVyaWFsIDogbWF0ZXJpYWxzW21hdGVyaWFsSW5kZXhdO1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gbmV3IE1lc2hJbnN0YW5jZShtZXNoLCBtYXRlcmlhbCwgbm9kZSk7XG5cbiAgICAgICAgICAgIGlmIChtZXNoLm1vcnBoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbW9ycGhJbnN0YW5jZSA9IG5ldyBNb3JwaEluc3RhbmNlKG1lc2gubW9ycGgpO1xuICAgICAgICAgICAgICAgIG1lc2hJbnN0YW5jZS5tb3JwaEluc3RhbmNlID0gbW9ycGhJbnN0YW5jZTtcbiAgICAgICAgICAgICAgICBtb2RlbC5tb3JwaEluc3RhbmNlcy5wdXNoKG1vcnBoSW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZ2x0Zk5vZGUuaGFzT3duUHJvcGVydHkoJ3NraW4nKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNraW5JbmRleCA9IGdsdGZOb2RlLnNraW47XG4gICAgICAgICAgICAgICAgY29uc3Qgc2tpbiA9IHNraW5zW3NraW5JbmRleF07XG4gICAgICAgICAgICAgICAgbWVzaC5za2luID0gc2tpbjtcblxuICAgICAgICAgICAgICAgIGNvbnN0IHNraW5JbnN0YW5jZSA9IHNraW5JbnN0YW5jZXNbc2tpbkluZGV4XTtcbiAgICAgICAgICAgICAgICBtZXNoSW5zdGFuY2Uuc2tpbkluc3RhbmNlID0gc2tpbkluc3RhbmNlO1xuICAgICAgICAgICAgICAgIG1vZGVsLnNraW5JbnN0YW5jZXMucHVzaChza2luSW5zdGFuY2UpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBtb2RlbC5tZXNoSW5zdGFuY2VzLnB1c2gobWVzaEluc3RhbmNlKTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBtb2RlbCA9IG5ldyBNb2RlbCgpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBza2luSW5zdGFuY2UgZm9yIGVhY2ggc2tpblxuICAgICAgICBjb25zdCBza2luSW5zdGFuY2VzID0gW107XG4gICAgICAgIGZvciAoY29uc3Qgc2tpbiBvZiBnbGIuc2tpbnMpIHtcbiAgICAgICAgICAgIGNvbnN0IHNraW5JbnN0YW5jZSA9IG5ldyBTa2luSW5zdGFuY2Uoc2tpbik7XG4gICAgICAgICAgICBza2luSW5zdGFuY2UuYm9uZXMgPSBza2luLmJvbmVzO1xuICAgICAgICAgICAgc2tpbkluc3RhbmNlcy5wdXNoKHNraW5JbnN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBub2RlIGhpZXJhcmNoeSBmb3IgdGhlIG1vZGVsXG4gICAgICAgIG1vZGVsLmdyYXBoID0gR2xiQ29udGFpbmVyUmVzb3VyY2UuY3JlYXRlU2NlbmVIaWVyYXJjaHkoZ2xiLnNjZW5lcywgJ0dyYXBoTm9kZScpO1xuXG4gICAgICAgIC8vIGNyZWF0ZSBtZXNoIGluc3RhbmNlIGZvciBtZXNoZXMgb24gbm9kZXMgdGhhdCBhcmUgcGFydCBvZiBoaWVyYXJjaHlcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBnbGIubm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBnbGIubm9kZXNbaV07XG4gICAgICAgICAgICBpZiAobm9kZS5yb290ID09PSBtb2RlbC5ncmFwaCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGdsdGZOb2RlID0gZ2xiLmdsdGYubm9kZXNbaV07XG4gICAgICAgICAgICAgICAgaWYgKGdsdGZOb2RlLmhhc093blByb3BlcnR5KCdtZXNoJykpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzaEdyb3VwID0gZ2xiLnJlbmRlcnNbZ2x0Zk5vZGUubWVzaF0ubWVzaGVzO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKHZhciBtaSA9IDA7IG1pIDwgbWVzaEdyb3VwLmxlbmd0aDsgbWkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbWVzaCA9IG1lc2hHcm91cFttaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWVzaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZU1lc2hJbnN0YW5jZShtb2RlbCwgbWVzaCwgZ2xiLnNraW5zLCBza2luSW5zdGFuY2VzLCBnbGIubWF0ZXJpYWxzLCBub2RlLCBnbHRmTm9kZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbW9kZWw7XG4gICAgfVxuXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgY29uc3QgcmVnaXN0cnkgPSB0aGlzLl9hc3NldHM7XG5cbiAgICAgICAgY29uc3QgZGVzdHJveUFzc2V0ID0gZnVuY3Rpb24gKGFzc2V0KSB7XG4gICAgICAgICAgICByZWdpc3RyeS5yZW1vdmUoYXNzZXQpO1xuICAgICAgICAgICAgYXNzZXQudW5sb2FkKCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgZGVzdHJveUFzc2V0cyA9IGZ1bmN0aW9uIChhc3NldHMpIHtcbiAgICAgICAgICAgIGFzc2V0cy5mb3JFYWNoKGZ1bmN0aW9uIChhc3NldCkge1xuICAgICAgICAgICAgICAgIGRlc3Ryb3lBc3NldChhc3NldCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyB1bmxvYWQgYW5kIGRlc3Ryb3kgYXNzZXRzXG4gICAgICAgIGlmICh0aGlzLmFuaW1hdGlvbnMpIHtcbiAgICAgICAgICAgIGRlc3Ryb3lBc3NldHModGhpcy5hbmltYXRpb25zKTtcbiAgICAgICAgICAgIHRoaXMuYW5pbWF0aW9ucyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy50ZXh0dXJlcykge1xuICAgICAgICAgICAgZGVzdHJveUFzc2V0cyh0aGlzLnRleHR1cmVzKTtcbiAgICAgICAgICAgIHRoaXMudGV4dHVyZXMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMubWF0ZXJpYWxzKSB7XG4gICAgICAgICAgICBkZXN0cm95QXNzZXRzKHRoaXMubWF0ZXJpYWxzKTtcbiAgICAgICAgICAgIHRoaXMubWF0ZXJpYWxzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnJlbmRlcnMpIHtcbiAgICAgICAgICAgIGRlc3Ryb3lBc3NldHModGhpcy5yZW5kZXJzKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVycyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fbW9kZWwpIHtcbiAgICAgICAgICAgIGRlc3Ryb3lBc3NldCh0aGlzLl9tb2RlbCk7XG4gICAgICAgICAgICB0aGlzLl9tb2RlbCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRhdGEgPSBudWxsO1xuICAgICAgICB0aGlzLmFzc2V0cyA9IG51bGw7XG4gICAgfVxufVxuXG5leHBvcnQgeyBHbGJDb250YWluZXJSZXNvdXJjZSB9O1xuIl0sIm5hbWVzIjpbIkdsYkNvbnRhaW5lclJlc291cmNlIiwiY29uc3RydWN0b3IiLCJkYXRhIiwiYXNzZXQiLCJhc3NldHMiLCJkZWZhdWx0TWF0ZXJpYWwiLCJjcmVhdGVBc3NldCIsInR5cGUiLCJyZXNvdXJjZSIsImluZGV4Iiwic3ViQXNzZXQiLCJuYW1lIiwiYWRkIiwicmVuZGVycyIsImkiLCJsZW5ndGgiLCJwdXNoIiwibWF0ZXJpYWxzIiwiYW5pbWF0aW9ucyIsIl9tb2RlbCIsIl9hc3NldE5hbWUiLCJfYXNzZXRzIiwiX2RlZmF1bHRNYXRlcmlhbCIsInRleHR1cmVzIiwibW9kZWwiLCJjcmVhdGVNb2RlbCIsIm1vZGVsQXNzZXQiLCJhc3NldE5hbWUiLCJBc3NldCIsInVybCIsImxvYWRlZCIsImluc3RhbnRpYXRlTW9kZWxFbnRpdHkiLCJvcHRpb25zIiwiZW50aXR5IiwiRW50aXR5IiwiYWRkQ29tcG9uZW50IiwiT2JqZWN0IiwiYXNzaWduIiwiaW5zdGFudGlhdGVSZW5kZXJFbnRpdHkiLCJza2lubmVkTWVzaEluc3RhbmNlcyIsImNyZWF0ZU1lc2hJbnN0YW5jZSIsInJvb3QiLCJtZXNoIiwibWVzaERlZmF1bHRNYXRlcmlhbHMiLCJza2lucyIsImdsdGZOb2RlIiwibWF0ZXJpYWxJbmRleCIsImlkIiwibWF0ZXJpYWwiLCJ1bmRlZmluZWQiLCJtZXNoSW5zdGFuY2UiLCJNZXNoSW5zdGFuY2UiLCJtb3JwaCIsIm1vcnBoSW5zdGFuY2UiLCJNb3JwaEluc3RhbmNlIiwiaGFzT3duUHJvcGVydHkiLCJyb290Qm9uZSIsImNsb25lSGllcmFyY2h5Iiwibm9kZSIsImdsYiIsIl9jbG9uZUludGVybmFsIiwiYXR0YWNoZWRNaSIsInJlbmRlckFzc2V0Iiwibm9kZXMiLCJnbGJOb2RlIiwiZ2x0ZiIsIm1lc2hHcm91cCIsIm1lc2hlcyIsIm1pIiwiY2xvbmVNaSIsImxpZ2h0cyIsImxpZ2h0RW50aXR5IiwiZ2V0IiwiYWRkQ2hpbGQiLCJjbG9uZSIsImNhbWVyYXMiLCJjYW1lcmFFbnRpdHkiLCJjYW1lcmEiLCJzeXN0ZW0iLCJjbG9uZUNvbXBvbmVudCIsIm1lc2hJbnN0YW5jZXMiLCJyZW5kZXIiLCJhc3NpZ25Bc3NldCIsImNoaWxkcmVuIiwiY2hpbGRDbG9uZSIsInNjZW5lQ2xvbmVzIiwic2NlbmUiLCJzY2VuZXMiLCJmb3JFYWNoIiwic2tpbkluc3RhbmNlIiwiU2tpbkluc3RhbmNlQ2FjaGUiLCJjcmVhdGVDYWNoZWRTa2luSW5zdGFuY2UiLCJza2luIiwiY3JlYXRlU2NlbmVIaWVyYXJjaHkiLCJnZXRNYXRlcmlhbFZhcmlhbnRzIiwidmFyaWFudHMiLCJrZXlzIiwiYXBwbHlNYXRlcmlhbFZhcmlhbnQiLCJ2YXJpYW50IiwiRGVidWciLCJ3YXJuIiwiZmluZENvbXBvbmVudHMiLCJyZW5kZXJDb21wb25lbnQiLCJfYXBwbHlNYXRlcmlhbFZhcmlhbnQiLCJhcHBseU1hdGVyaWFsVmFyaWFudEluc3RhbmNlcyIsImluc3RhbmNlcyIsImluc3RhbmNlIiwibWVzaFZhcmlhbnRzIiwiYXNzZXJ0Iiwic2NlbmVOb2RlcyIsIm5vZGVUeXBlIiwic2tpbkluc3RhbmNlcyIsIm1vcnBoSW5zdGFuY2VzIiwic2tpbkluZGV4IiwiTW9kZWwiLCJTa2luSW5zdGFuY2UiLCJib25lcyIsImdyYXBoIiwiZGVzdHJveSIsInJlZ2lzdHJ5IiwiZGVzdHJveUFzc2V0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
