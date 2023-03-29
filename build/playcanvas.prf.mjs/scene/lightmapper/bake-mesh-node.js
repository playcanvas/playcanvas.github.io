/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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
