import { RENDERSTYLE_WIREFRAME } from './constants.js';
import { MeshInstance } from './mesh-instance.js';
import { MorphInstance } from './morph-instance.js';
import { SkinInstance } from './skin-instance.js';

/**
 * A model is a graphical object that can be added to or removed from a scene. It contains a
 * hierarchy and any number of mesh instances.
 */
class Model {
  /**
   * The root node of the model's graph node hierarchy.
   *
   * @type {import('./graph-node.js').GraphNode|null}
   */

  /**
   * An array of MeshInstances contained in this model.
   *
   * @type {MeshInstance[]}
   */

  /**
   * An array of SkinInstances contained in this model.
   *
   * @type {SkinInstance[]}
   */

  /**
   * An array of MorphInstances contained in this model.
   *
   * @type {MorphInstance[]}
   */

  /**
   * Creates a new model.
   *
   * @example
   * // Create a new model
   * const model = new pc.Model();
   */
  constructor() {
    this.graph = null;
    this.meshInstances = [];
    this.skinInstances = [];
    this.morphInstances = [];
    this.cameras = [];
    this.lights = [];
    this._shadersVersion = 0;

    // used by the model component to flag that this model has been assigned
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

  /**
   * Clones a model. The returned model has a newly created hierarchy and mesh instances, but
   * meshes are shared between the clone and the specified model.
   *
   * @returns {Model} A clone of the specified model.
   * @example
   * const clonedModel = model.clone();
   */
  clone() {
    // Duplicate the node hierarchy
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

    // Clone the skin instances
    for (let i = 0; i < this.skinInstances.length; i++) {
      const skin = this.skinInstances[i].skin;
      const cloneSkinInstance = new SkinInstance(skin);

      // Resolve bone IDs to actual graph nodes
      const bones = [];
      for (let j = 0; j < skin.boneNames.length; j++) {
        const boneName = skin.boneNames[j];
        const bone = cloneGraph.findByName(boneName);
        bones.push(bone);
      }
      cloneSkinInstance.bones = bones;
      cloneSkinInstances.push(cloneSkinInstance);
    }

    // Clone the morph instances
    for (let i = 0; i < this.morphInstances.length; i++) {
      const morph = this.morphInstances[i].morph;
      const cloneMorphInstance = new MorphInstance(morph);
      cloneMorphInstances.push(cloneMorphInstance);
    }

    // Clone the mesh instances
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

  /**
   * Destroys skinning texture and possibly deletes vertex/index buffers of a model. Mesh is
   * reference-counted, so buffers are only deleted if all models with referencing mesh instances
   * were deleted. That means all in-scene models + the "base" one (asset.resource) which is
   * created when the model is parsed. It is recommended to use asset.unload() instead, which
   * will also remove the model from the scene.
   */
  destroy() {
    const meshInstances = this.meshInstances;
    for (let i = 0; i < meshInstances.length; i++) {
      meshInstances[i].destroy();
    }
    this.meshInstances.length = 0;
  }

  /**
   * Generates the necessary internal data for a model to be renderable as wireframe. Once this
   * function has been called, any mesh instance in the model can have its renderStyle property
   * set to {@link RENDERSTYLE_WIREFRAME}.
   *
   * @example
   * model.generateWireframe();
   * for (let i = 0; i < model.meshInstances.length; i++) {
   *     model.meshInstances[i].renderStyle = pc.RENDERSTYLE_WIREFRAME;
   * }
   */
  generateWireframe() {
    MeshInstance._prepareRenderStyleForArray(this.meshInstances, RENDERSTYLE_WIREFRAME);
  }
}

export { Model };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9kZWwuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9zY2VuZS9tb2RlbC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSRU5ERVJTVFlMRV9XSVJFRlJBTUUgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBNZXNoSW5zdGFuY2UgfSBmcm9tICcuL21lc2gtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgTW9ycGhJbnN0YW5jZSB9IGZyb20gJy4vbW9ycGgtaW5zdGFuY2UuanMnO1xuaW1wb3J0IHsgU2tpbkluc3RhbmNlIH0gZnJvbSAnLi9za2luLWluc3RhbmNlLmpzJztcblxuLyoqXG4gKiBBIG1vZGVsIGlzIGEgZ3JhcGhpY2FsIG9iamVjdCB0aGF0IGNhbiBiZSBhZGRlZCB0byBvciByZW1vdmVkIGZyb20gYSBzY2VuZS4gSXQgY29udGFpbnMgYVxuICogaGllcmFyY2h5IGFuZCBhbnkgbnVtYmVyIG9mIG1lc2ggaW5zdGFuY2VzLlxuICovXG5jbGFzcyBNb2RlbCB7XG4gICAgLyoqXG4gICAgICogVGhlIHJvb3Qgbm9kZSBvZiB0aGUgbW9kZWwncyBncmFwaCBub2RlIGhpZXJhcmNoeS5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vZ3JhcGgtbm9kZS5qcycpLkdyYXBoTm9kZXxudWxsfVxuICAgICAqL1xuICAgIGdyYXBoID0gbnVsbDtcblxuICAgIC8qKlxuICAgICAqIEFuIGFycmF5IG9mIE1lc2hJbnN0YW5jZXMgY29udGFpbmVkIGluIHRoaXMgbW9kZWwuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7TWVzaEluc3RhbmNlW119XG4gICAgICovXG4gICAgbWVzaEluc3RhbmNlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXJyYXkgb2YgU2tpbkluc3RhbmNlcyBjb250YWluZWQgaW4gdGhpcyBtb2RlbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtTa2luSW5zdGFuY2VbXX1cbiAgICAgKi9cbiAgICBza2luSW5zdGFuY2VzID0gW107XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBvZiBNb3JwaEluc3RhbmNlcyBjb250YWluZWQgaW4gdGhpcyBtb2RlbC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtNb3JwaEluc3RhbmNlW119XG4gICAgICovXG4gICAgbW9ycGhJbnN0YW5jZXMgPSBbXTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBuZXcgbW9kZWwuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIENyZWF0ZSBhIG5ldyBtb2RlbFxuICAgICAqIGNvbnN0IG1vZGVsID0gbmV3IHBjLk1vZGVsKCk7XG4gICAgICovXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuY2FtZXJhcyA9IFtdO1xuICAgICAgICB0aGlzLmxpZ2h0cyA9IFtdO1xuXG4gICAgICAgIHRoaXMuX3NoYWRlcnNWZXJzaW9uID0gMDtcblxuICAgICAgICAvLyB1c2VkIGJ5IHRoZSBtb2RlbCBjb21wb25lbnQgdG8gZmxhZyB0aGF0IHRoaXMgbW9kZWwgaGFzIGJlZW4gYXNzaWduZWRcbiAgICAgICAgdGhpcy5faW1tdXRhYmxlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgZ2V0R3JhcGgoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdyYXBoO1xuICAgIH1cblxuICAgIHNldEdyYXBoKGdyYXBoKSB7XG4gICAgICAgIHRoaXMuZ3JhcGggPSBncmFwaDtcbiAgICB9XG5cbiAgICBnZXRDYW1lcmFzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYW1lcmFzO1xuICAgIH1cblxuICAgIHNldENhbWVyYXMoY2FtZXJhcykge1xuICAgICAgICB0aGlzLmNhbWVyYXMgPSBjYW1lcmFzO1xuICAgIH1cblxuICAgIGdldExpZ2h0cygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGlnaHRzO1xuICAgIH1cblxuICAgIHNldExpZ2h0cyhsaWdodHMpIHtcbiAgICAgICAgdGhpcy5saWdodHMgPSBsaWdodHM7XG4gICAgfVxuXG4gICAgZ2V0TWF0ZXJpYWxzKCkge1xuICAgICAgICBjb25zdCBtYXRlcmlhbHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm1lc2hJbnN0YW5jZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc2hJbnN0YW5jZSA9IHRoaXMubWVzaEluc3RhbmNlc1tpXTtcbiAgICAgICAgICAgIGlmIChtYXRlcmlhbHMuaW5kZXhPZihtZXNoSW5zdGFuY2UubWF0ZXJpYWwpID09PSAtMSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKG1lc2hJbnN0YW5jZS5tYXRlcmlhbCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1hdGVyaWFscztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9uZXMgYSBtb2RlbC4gVGhlIHJldHVybmVkIG1vZGVsIGhhcyBhIG5ld2x5IGNyZWF0ZWQgaGllcmFyY2h5IGFuZCBtZXNoIGluc3RhbmNlcywgYnV0XG4gICAgICogbWVzaGVzIGFyZSBzaGFyZWQgYmV0d2VlbiB0aGUgY2xvbmUgYW5kIHRoZSBzcGVjaWZpZWQgbW9kZWwuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TW9kZWx9IEEgY2xvbmUgb2YgdGhlIHNwZWNpZmllZCBtb2RlbC5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGNsb25lZE1vZGVsID0gbW9kZWwuY2xvbmUoKTtcbiAgICAgKi9cbiAgICBjbG9uZSgpIHtcblxuICAgICAgICAvLyBEdXBsaWNhdGUgdGhlIG5vZGUgaGllcmFyY2h5XG4gICAgICAgIGNvbnN0IHNyY05vZGVzID0gW107XG4gICAgICAgIGNvbnN0IGNsb25lTm9kZXMgPSBbXTtcblxuICAgICAgICBjb25zdCBfZHVwbGljYXRlID0gZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICAgIGNvbnN0IG5ld05vZGUgPSBub2RlLmNsb25lKCk7XG5cbiAgICAgICAgICAgIHNyY05vZGVzLnB1c2gobm9kZSk7XG4gICAgICAgICAgICBjbG9uZU5vZGVzLnB1c2gobmV3Tm9kZSk7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGlkeCA9IDA7IGlkeCA8IG5vZGUuX2NoaWxkcmVuLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLmFkZENoaWxkKF9kdXBsaWNhdGUobm9kZS5fY2hpbGRyZW5baWR4XSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbmV3Tm9kZTtcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBjbG9uZUdyYXBoID0gX2R1cGxpY2F0ZSh0aGlzLmdyYXBoKTtcbiAgICAgICAgY29uc3QgY2xvbmVNZXNoSW5zdGFuY2VzID0gW107XG4gICAgICAgIGNvbnN0IGNsb25lU2tpbkluc3RhbmNlcyA9IFtdO1xuICAgICAgICBjb25zdCBjbG9uZU1vcnBoSW5zdGFuY2VzID0gW107XG5cbiAgICAgICAgLy8gQ2xvbmUgdGhlIHNraW4gaW5zdGFuY2VzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5za2luSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBza2luID0gdGhpcy5za2luSW5zdGFuY2VzW2ldLnNraW47XG4gICAgICAgICAgICBjb25zdCBjbG9uZVNraW5JbnN0YW5jZSA9IG5ldyBTa2luSW5zdGFuY2Uoc2tpbik7XG5cbiAgICAgICAgICAgIC8vIFJlc29sdmUgYm9uZSBJRHMgdG8gYWN0dWFsIGdyYXBoIG5vZGVzXG4gICAgICAgICAgICBjb25zdCBib25lcyA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBza2luLmJvbmVOYW1lcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJvbmVOYW1lID0gc2tpbi5ib25lTmFtZXNbal07XG4gICAgICAgICAgICAgICAgY29uc3QgYm9uZSA9IGNsb25lR3JhcGguZmluZEJ5TmFtZShib25lTmFtZSk7XG4gICAgICAgICAgICAgICAgYm9uZXMucHVzaChib25lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNsb25lU2tpbkluc3RhbmNlLmJvbmVzID0gYm9uZXM7XG5cbiAgICAgICAgICAgIGNsb25lU2tpbkluc3RhbmNlcy5wdXNoKGNsb25lU2tpbkluc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENsb25lIHRoZSBtb3JwaCBpbnN0YW5jZXNcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLm1vcnBoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBtb3JwaCA9IHRoaXMubW9ycGhJbnN0YW5jZXNbaV0ubW9ycGg7XG4gICAgICAgICAgICBjb25zdCBjbG9uZU1vcnBoSW5zdGFuY2UgPSBuZXcgTW9ycGhJbnN0YW5jZShtb3JwaCk7XG4gICAgICAgICAgICBjbG9uZU1vcnBoSW5zdGFuY2VzLnB1c2goY2xvbmVNb3JwaEluc3RhbmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENsb25lIHRoZSBtZXNoIGluc3RhbmNlc1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubWVzaEluc3RhbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlID0gdGhpcy5tZXNoSW5zdGFuY2VzW2ldO1xuICAgICAgICAgICAgY29uc3Qgbm9kZUluZGV4ID0gc3JjTm9kZXMuaW5kZXhPZihtZXNoSW5zdGFuY2Uubm9kZSk7XG4gICAgICAgICAgICBjb25zdCBjbG9uZU1lc2hJbnN0YW5jZSA9IG5ldyBNZXNoSW5zdGFuY2UobWVzaEluc3RhbmNlLm1lc2gsIG1lc2hJbnN0YW5jZS5tYXRlcmlhbCwgY2xvbmVOb2Rlc1tub2RlSW5kZXhdKTtcblxuICAgICAgICAgICAgaWYgKG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBza2luSW5zdGFuY2VJbmRleCA9IHRoaXMuc2tpbkluc3RhbmNlcy5pbmRleE9mKG1lc2hJbnN0YW5jZS5za2luSW5zdGFuY2UpO1xuICAgICAgICAgICAgICAgIGNsb25lTWVzaEluc3RhbmNlLnNraW5JbnN0YW5jZSA9IGNsb25lU2tpbkluc3RhbmNlc1tza2luSW5zdGFuY2VJbmRleF07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChtZXNoSW5zdGFuY2UubW9ycGhJbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1vcnBoSW5zdGFuY2VJbmRleCA9IHRoaXMubW9ycGhJbnN0YW5jZXMuaW5kZXhPZihtZXNoSW5zdGFuY2UubW9ycGhJbnN0YW5jZSk7XG4gICAgICAgICAgICAgICAgY2xvbmVNZXNoSW5zdGFuY2UubW9ycGhJbnN0YW5jZSA9IGNsb25lTW9ycGhJbnN0YW5jZXNbbW9ycGhJbnN0YW5jZUluZGV4XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY2xvbmVNZXNoSW5zdGFuY2VzLnB1c2goY2xvbmVNZXNoSW5zdGFuY2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2xvbmUgPSBuZXcgTW9kZWwoKTtcbiAgICAgICAgY2xvbmUuZ3JhcGggPSBjbG9uZUdyYXBoO1xuICAgICAgICBjbG9uZS5tZXNoSW5zdGFuY2VzID0gY2xvbmVNZXNoSW5zdGFuY2VzO1xuICAgICAgICBjbG9uZS5za2luSW5zdGFuY2VzID0gY2xvbmVTa2luSW5zdGFuY2VzO1xuICAgICAgICBjbG9uZS5tb3JwaEluc3RhbmNlcyA9IGNsb25lTW9ycGhJbnN0YW5jZXM7XG5cbiAgICAgICAgY2xvbmUuZ2V0R3JhcGgoKS5zeW5jSGllcmFyY2h5KCk7XG5cbiAgICAgICAgcmV0dXJuIGNsb25lO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3lzIHNraW5uaW5nIHRleHR1cmUgYW5kIHBvc3NpYmx5IGRlbGV0ZXMgdmVydGV4L2luZGV4IGJ1ZmZlcnMgb2YgYSBtb2RlbC4gTWVzaCBpc1xuICAgICAqIHJlZmVyZW5jZS1jb3VudGVkLCBzbyBidWZmZXJzIGFyZSBvbmx5IGRlbGV0ZWQgaWYgYWxsIG1vZGVscyB3aXRoIHJlZmVyZW5jaW5nIG1lc2ggaW5zdGFuY2VzXG4gICAgICogd2VyZSBkZWxldGVkLiBUaGF0IG1lYW5zIGFsbCBpbi1zY2VuZSBtb2RlbHMgKyB0aGUgXCJiYXNlXCIgb25lIChhc3NldC5yZXNvdXJjZSkgd2hpY2ggaXNcbiAgICAgKiBjcmVhdGVkIHdoZW4gdGhlIG1vZGVsIGlzIHBhcnNlZC4gSXQgaXMgcmVjb21tZW5kZWQgdG8gdXNlIGFzc2V0LnVubG9hZCgpIGluc3RlYWQsIHdoaWNoXG4gICAgICogd2lsbCBhbHNvIHJlbW92ZSB0aGUgbW9kZWwgZnJvbSB0aGUgc2NlbmUuXG4gICAgICovXG4gICAgZGVzdHJveSgpIHtcbiAgICAgICAgY29uc3QgbWVzaEluc3RhbmNlcyA9IHRoaXMubWVzaEluc3RhbmNlcztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBtZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBtZXNoSW5zdGFuY2VzW2ldLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm1lc2hJbnN0YW5jZXMubGVuZ3RoID0gMDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZW5lcmF0ZXMgdGhlIG5lY2Vzc2FyeSBpbnRlcm5hbCBkYXRhIGZvciBhIG1vZGVsIHRvIGJlIHJlbmRlcmFibGUgYXMgd2lyZWZyYW1lLiBPbmNlIHRoaXNcbiAgICAgKiBmdW5jdGlvbiBoYXMgYmVlbiBjYWxsZWQsIGFueSBtZXNoIGluc3RhbmNlIGluIHRoZSBtb2RlbCBjYW4gaGF2ZSBpdHMgcmVuZGVyU3R5bGUgcHJvcGVydHlcbiAgICAgKiBzZXQgdG8ge0BsaW5rIFJFTkRFUlNUWUxFX1dJUkVGUkFNRX0uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIG1vZGVsLmdlbmVyYXRlV2lyZWZyYW1lKCk7XG4gICAgICogZm9yIChsZXQgaSA9IDA7IGkgPCBtb2RlbC5tZXNoSW5zdGFuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICogICAgIG1vZGVsLm1lc2hJbnN0YW5jZXNbaV0ucmVuZGVyU3R5bGUgPSBwYy5SRU5ERVJTVFlMRV9XSVJFRlJBTUU7XG4gICAgICogfVxuICAgICAqL1xuICAgIGdlbmVyYXRlV2lyZWZyYW1lKCkge1xuICAgICAgICBNZXNoSW5zdGFuY2UuX3ByZXBhcmVSZW5kZXJTdHlsZUZvckFycmF5KHRoaXMubWVzaEluc3RhbmNlcywgUkVOREVSU1RZTEVfV0lSRUZSQU1FKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IE1vZGVsIH07XG4iXSwibmFtZXMiOlsiTW9kZWwiLCJjb25zdHJ1Y3RvciIsImdyYXBoIiwibWVzaEluc3RhbmNlcyIsInNraW5JbnN0YW5jZXMiLCJtb3JwaEluc3RhbmNlcyIsImNhbWVyYXMiLCJsaWdodHMiLCJfc2hhZGVyc1ZlcnNpb24iLCJfaW1tdXRhYmxlIiwiZ2V0R3JhcGgiLCJzZXRHcmFwaCIsImdldENhbWVyYXMiLCJzZXRDYW1lcmFzIiwiZ2V0TGlnaHRzIiwic2V0TGlnaHRzIiwiZ2V0TWF0ZXJpYWxzIiwibWF0ZXJpYWxzIiwiaSIsImxlbmd0aCIsIm1lc2hJbnN0YW5jZSIsImluZGV4T2YiLCJtYXRlcmlhbCIsInB1c2giLCJjbG9uZSIsInNyY05vZGVzIiwiY2xvbmVOb2RlcyIsIl9kdXBsaWNhdGUiLCJub2RlIiwibmV3Tm9kZSIsImlkeCIsIl9jaGlsZHJlbiIsImFkZENoaWxkIiwiY2xvbmVHcmFwaCIsImNsb25lTWVzaEluc3RhbmNlcyIsImNsb25lU2tpbkluc3RhbmNlcyIsImNsb25lTW9ycGhJbnN0YW5jZXMiLCJza2luIiwiY2xvbmVTa2luSW5zdGFuY2UiLCJTa2luSW5zdGFuY2UiLCJib25lcyIsImoiLCJib25lTmFtZXMiLCJib25lTmFtZSIsImJvbmUiLCJmaW5kQnlOYW1lIiwibW9ycGgiLCJjbG9uZU1vcnBoSW5zdGFuY2UiLCJNb3JwaEluc3RhbmNlIiwibm9kZUluZGV4IiwiY2xvbmVNZXNoSW5zdGFuY2UiLCJNZXNoSW5zdGFuY2UiLCJtZXNoIiwic2tpbkluc3RhbmNlIiwic2tpbkluc3RhbmNlSW5kZXgiLCJtb3JwaEluc3RhbmNlIiwibW9ycGhJbnN0YW5jZUluZGV4Iiwic3luY0hpZXJhcmNoeSIsImRlc3Ryb3kiLCJnZW5lcmF0ZVdpcmVmcmFtZSIsIl9wcmVwYXJlUmVuZGVyU3R5bGVGb3JBcnJheSIsIlJFTkRFUlNUWUxFX1dJUkVGUkFNRSJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLEtBQUssQ0FBQztBQUNSO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTs7QUFHSTtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdJO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSUMsRUFBQUEsV0FBV0EsR0FBRztJQUFBLElBOUJkQyxDQUFBQSxLQUFLLEdBQUcsSUFBSSxDQUFBO0lBQUEsSUFPWkMsQ0FBQUEsYUFBYSxHQUFHLEVBQUUsQ0FBQTtJQUFBLElBT2xCQyxDQUFBQSxhQUFhLEdBQUcsRUFBRSxDQUFBO0lBQUEsSUFPbEJDLENBQUFBLGNBQWMsR0FBRyxFQUFFLENBQUE7SUFVZixJQUFJLENBQUNDLE9BQU8sR0FBRyxFQUFFLENBQUE7SUFDakIsSUFBSSxDQUFDQyxNQUFNLEdBQUcsRUFBRSxDQUFBO0lBRWhCLElBQUksQ0FBQ0MsZUFBZSxHQUFHLENBQUMsQ0FBQTs7QUFFeEI7SUFDQSxJQUFJLENBQUNDLFVBQVUsR0FBRyxLQUFLLENBQUE7QUFDM0IsR0FBQTtBQUVBQyxFQUFBQSxRQUFRQSxHQUFHO0lBQ1AsT0FBTyxJQUFJLENBQUNSLEtBQUssQ0FBQTtBQUNyQixHQUFBO0VBRUFTLFFBQVFBLENBQUNULEtBQUssRUFBRTtJQUNa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
