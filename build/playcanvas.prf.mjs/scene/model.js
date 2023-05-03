import { RENDERSTYLE_WIREFRAME } from './constants.js';
import { MeshInstance } from './mesh-instance.js';
import { MorphInstance } from './morph-instance.js';
import { SkinInstance } from './skin-instance.js';

class Model {
	constructor() {
		this.graph = null;
		this.meshInstances = [];
		this.skinInstances = [];
		this.morphInstances = [];
		this.cameras = [];
		this.lights = [];
		this._shadersVersion = 0;
		this._immutable = false;
	}
	getGraph() {
		return this.graph;
	}
	setGraph(graph) {
		this.graph = graph;
	}
	getCameras() {
		return this.cameras;
	}
	setCameras(cameras) {
		this.cameras = cameras;
	}
	getLights() {
		return this.lights;
	}
	setLights(lights) {
		this.lights = lights;
	}
	getMaterials() {
		const materials = [];
		for (let i = 0; i < this.meshInstances.length; i++) {
			const meshInstance = this.meshInstances[i];
			if (materials.indexOf(meshInstance.material) === -1) {
				materials.push(meshInstance.material);
			}
		}
		return materials;
	}
	clone() {
		const srcNodes = [];
		const cloneNodes = [];
		const _duplicate = function _duplicate(node) {
			const newNode = node.clone();
			srcNodes.push(node);
			cloneNodes.push(newNode);
			for (let idx = 0; idx < node._children.length; idx++) {
				newNode.addChild(_duplicate(node._children[idx]));
			}
			return newNode;
		};
		const cloneGraph = _duplicate(this.graph);
		const cloneMeshInstances = [];
		const cloneSkinInstances = [];
		const cloneMorphInstances = [];
		for (let i = 0; i < this.skinInstances.length; i++) {
			const skin = this.skinInstances[i].skin;
			const cloneSkinInstance = new SkinInstance(skin);
			const bones = [];
			for (let j = 0; j < skin.boneNames.length; j++) {
				const boneName = skin.boneNames[j];
				const bone = cloneGraph.findByName(boneName);
				bones.push(bone);
			}
			cloneSkinInstance.bones = bones;
			cloneSkinInstances.push(cloneSkinInstance);
		}
		for (let i = 0; i < this.morphInstances.length; i++) {
			const morph = this.morphInstances[i].morph;
			const cloneMorphInstance = new MorphInstance(morph);
			cloneMorphInstances.push(cloneMorphInstance);
		}
		for (let i = 0; i < this.meshInstances.length; i++) {
			const meshInstance = this.meshInstances[i];
			const nodeIndex = srcNodes.indexOf(meshInstance.node);
			const cloneMeshInstance = new MeshInstance(meshInstance.mesh, meshInstance.material, cloneNodes[nodeIndex]);
			if (meshInstance.skinInstance) {
				const skinInstanceIndex = this.skinInstances.indexOf(meshInstance.skinInstance);
				cloneMeshInstance.skinInstance = cloneSkinInstances[skinInstanceIndex];
			}
			if (meshInstance.morphInstance) {
				const morphInstanceIndex = this.morphInstances.indexOf(meshInstance.morphInstance);
				cloneMeshInstance.morphInstance = cloneMorphInstances[morphInstanceIndex];
			}
			cloneMeshInstances.push(cloneMeshInstance);
		}
		const clone = new Model();
		clone.graph = cloneGraph;
		clone.meshInstances = cloneMeshInstances;
		clone.skinInstances = cloneSkinInstances;
		clone.morphInstances = cloneMorphInstances;
		clone.getGraph().syncHierarchy();
		return clone;
	}
	destroy() {
		const meshInstances = this.meshInstances;
		for (let i = 0; i < meshInstances.length; i++) {
			meshInstances[i].destroy();
		}
		this.meshInstances.length = 0;
	}
	generateWireframe() {
		MeshInstance._prepareRenderStyleForArray(this.meshInstances, RENDERSTYLE_WIREFRAME);
	}
}

export { Model };
