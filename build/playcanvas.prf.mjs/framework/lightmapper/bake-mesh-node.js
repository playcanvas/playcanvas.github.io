/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
