import { BoundingBox } from '../../core/shape/bounding-box.js';

class Batch {
	constructor(meshInstances, dynamic, batchGroupId) {
		this._aabb = new BoundingBox();
		this.origMeshInstances = void 0;
		this.meshInstance = null;
		this.dynamic = void 0;
		this.batchGroupId = void 0;
		this.origMeshInstances = meshInstances;
		this.dynamic = dynamic;
		this.batchGroupId = batchGroupId;
	}
	destroy(scene, layers) {
		if (this.meshInstance) {
			this.removeFromLayers(scene, layers);
			this.meshInstance.destroy();
			this.meshInstance = null;
		}
	}
	addToLayers(scene, layers) {
		for (let i = 0; i < layers.length; i++) {
			const layer = scene.layers.getLayerById(layers[i]);
			if (layer) {
				layer.addMeshInstances([this.meshInstance]);
			}
		}
	}
	removeFromLayers(scene, layers) {
		for (let i = 0; i < layers.length; i++) {
			const layer = scene.layers.getLayerById(layers[i]);
			if (layer) {
				layer.removeMeshInstances([this.meshInstance]);
			}
		}
	}
	updateBoundingBox() {
		this._aabb.copy(this.origMeshInstances[0].aabb);
		for (let i = 1; i < this.origMeshInstances.length; i++) {
			this._aabb.add(this.origMeshInstances[i].aabb);
		}
		this.meshInstance.aabb = this._aabb;
		this.meshInstance._aabbVer = 0;
	}
}

export { Batch };
