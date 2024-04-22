import { WorldClusters } from '../lighting/world-clusters.js';

const tempClusterArray = [];
class WorldClustersAllocator {
  constructor(graphicsDevice) {
    this._empty = null;
    this._allocated = [];
    this._clusters = new Map();
    this.device = graphicsDevice;
  }
  destroy() {
    if (this._empty) {
      this._empty.destroy();
      this._empty = null;
    }
    this._allocated.forEach(cluster => {
      cluster.destroy();
    });
    this._allocated.length = 0;
  }
  get count() {
    return this._allocated.length;
  }
  get empty() {
    if (!this._empty) {
      const empty = new WorldClusters(this.device);
      empty.name = 'ClusterEmpty';
      empty.update([], false, null);
      this._empty = empty;
    }
    return this._empty;
  }
  assign(renderPasses) {
    const empty = this.empty;
    tempClusterArray.push(...this._allocated);
    this._allocated.length = 0;
    this._clusters.clear();
    const passCount = renderPasses.length;
    for (let p = 0; p < passCount; p++) {
      const renderPass = renderPasses[p];
      const renderActions = renderPass.renderActions;
      if (renderActions) {
        const count = renderActions.length;
        for (let i = 0; i < count; i++) {
          const ra = renderActions[i];
          ra.lightClusters = null;
          const layer = ra.layer;
          if (layer.hasClusteredLights && layer.meshInstances.length) {
            const hash = layer.getLightIdHash();
            const existingRenderAction = this._clusters.get(hash);
            let clusters = existingRenderAction == null ? void 0 : existingRenderAction.lightClusters;
            if (!clusters) {
              var _tempClusterArray$pop;
              clusters = (_tempClusterArray$pop = tempClusterArray.pop()) != null ? _tempClusterArray$pop : new WorldClusters(this.device);
              this._allocated.push(clusters);
              this._clusters.set(hash, ra);
            }
            ra.lightClusters = clusters;
          }
          if (!ra.lightClusters) {
            ra.lightClusters = empty;
          }
        }
      }
    }
    tempClusterArray.forEach(item => item.destroy());
    tempClusterArray.length = 0;
  }
  update(renderPasses, gammaCorrection, lighting) {
    this.assign(renderPasses);
    this._clusters.forEach(renderAction => {
      const layer = renderAction.layer;
      const cluster = renderAction.lightClusters;
      cluster.update(layer.clusteredLightsSet, gammaCorrection, lighting);
    });
  }
}

export { WorldClustersAllocator };
