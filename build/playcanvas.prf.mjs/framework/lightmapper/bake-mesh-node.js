class BakeMeshNode {
	constructor(node, meshInstances = null) {
		this.node = node;
		this.component = node.render || node.model;
		meshInstances = meshInstances || this.component.meshInstances;
		this.store();
		this.meshInstances = meshInstances;
		this.bounds = null;
		this.renderTargets = [];
	}
	store() {
		this.castShadows = this.component.castShadows;
	}
	restore() {
		this.component.castShadows = this.castShadows;
	}
}

export { BakeMeshNode };
