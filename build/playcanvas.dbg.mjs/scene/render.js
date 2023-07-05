import { EventHandler } from '../core/event-handler.js';

/**
 * A render contains an array of meshes that are referenced by a single hierarchy node in a GLB
 * model, and are accessible using {@link ContainerResource#renders} property. The render is the
 * resource of a Render Asset.
 *
 * @augments EventHandler
 * @ignore
 */
class Render extends EventHandler {
  /**
   * Create a new Render instance. These are usually created by the GLB loader and not created
   * by hand.
   */
  constructor() {
    super();

    /**
     * Meshes are reference counted, and this class owns the references and is responsible for
     * releasing the meshes when they are no longer referenced.
     *
     * @type {import('./mesh.js').Mesh[]}
     * @private
     */
    this._meshes = null;
  }

  /**
   * Fired when the meshes are set.
   *
   * @event Render#set:meshes
   * @param {import('./mesh.js').Mesh[]} meshes - The meshes.
   * @ignore
   */

  /**
   * The meshes that the render contains.
   *
   * @type {import('./mesh.js').Mesh[]}
   */
  set meshes(value) {
    // decrement references on the existing meshes
    this.decRefMeshes();

    // assign new meshes
    this._meshes = value;
    this.incRefMeshes();
    this.fire('set:meshes', value);
  }
  get meshes() {
    return this._meshes;
  }
  destroy() {
    this.meshes = null;
  }

  // decrement references to meshes, destroy the ones with zero references
  decRefMeshes() {
    if (this._meshes) {
      const count = this._meshes.length;
      for (let i = 0; i < count; i++) {
        const mesh = this._meshes[i];
        if (mesh) {
          mesh.decRefCount();
          if (mesh.refCount < 1) {
            mesh.destroy();
            this._meshes[i] = null;
          }
        }
      }
    }
  }

  // increments ref count on all meshes
  incRefMeshes() {
    if (this._meshes) {
      const count = this._meshes.length;
      for (let i = 0; i < count; i++) {
        if (this._meshes[i]) {
          this._meshes[i].incRefCount();
        }
      }
    }
  }
}

export { Render };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvc2NlbmUvcmVuZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50SGFuZGxlciB9IGZyb20gJy4uL2NvcmUvZXZlbnQtaGFuZGxlci5qcyc7XG5cbi8qKlxuICogQSByZW5kZXIgY29udGFpbnMgYW4gYXJyYXkgb2YgbWVzaGVzIHRoYXQgYXJlIHJlZmVyZW5jZWQgYnkgYSBzaW5nbGUgaGllcmFyY2h5IG5vZGUgaW4gYSBHTEJcbiAqIG1vZGVsLCBhbmQgYXJlIGFjY2Vzc2libGUgdXNpbmcge0BsaW5rIENvbnRhaW5lclJlc291cmNlI3JlbmRlcnN9IHByb3BlcnR5LiBUaGUgcmVuZGVyIGlzIHRoZVxuICogcmVzb3VyY2Ugb2YgYSBSZW5kZXIgQXNzZXQuXG4gKlxuICogQGF1Z21lbnRzIEV2ZW50SGFuZGxlclxuICogQGlnbm9yZVxuICovXG5jbGFzcyBSZW5kZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBSZW5kZXIgaW5zdGFuY2UuIFRoZXNlIGFyZSB1c3VhbGx5IGNyZWF0ZWQgYnkgdGhlIEdMQiBsb2FkZXIgYW5kIG5vdCBjcmVhdGVkXG4gICAgICogYnkgaGFuZC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogTWVzaGVzIGFyZSByZWZlcmVuY2UgY291bnRlZCwgYW5kIHRoaXMgY2xhc3Mgb3ducyB0aGUgcmVmZXJlbmNlcyBhbmQgaXMgcmVzcG9uc2libGUgZm9yXG4gICAgICAgICAqIHJlbGVhc2luZyB0aGUgbWVzaGVzIHdoZW4gdGhleSBhcmUgbm8gbG9uZ2VyIHJlZmVyZW5jZWQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtpbXBvcnQoJy4vbWVzaC5qcycpLk1lc2hbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX21lc2hlcyA9IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB0aGUgbWVzaGVzIGFyZSBzZXQuXG4gICAgICpcbiAgICAgKiBAZXZlbnQgUmVuZGVyI3NldDptZXNoZXNcbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9tZXNoLmpzJykuTWVzaFtdfSBtZXNoZXMgLSBUaGUgbWVzaGVzLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIFRoZSBtZXNoZXMgdGhhdCB0aGUgcmVuZGVyIGNvbnRhaW5zLlxuICAgICAqXG4gICAgICogQHR5cGUge2ltcG9ydCgnLi9tZXNoLmpzJykuTWVzaFtdfVxuICAgICAqL1xuICAgIHNldCBtZXNoZXModmFsdWUpIHtcbiAgICAgICAgLy8gZGVjcmVtZW50IHJlZmVyZW5jZXMgb24gdGhlIGV4aXN0aW5nIG1lc2hlc1xuICAgICAgICB0aGlzLmRlY1JlZk1lc2hlcygpO1xuXG4gICAgICAgIC8vIGFzc2lnbiBuZXcgbWVzaGVzXG4gICAgICAgIHRoaXMuX21lc2hlcyA9IHZhbHVlO1xuICAgICAgICB0aGlzLmluY1JlZk1lc2hlcygpO1xuXG4gICAgICAgIHRoaXMuZmlyZSgnc2V0Om1lc2hlcycsIHZhbHVlKTtcbiAgICB9XG5cbiAgICBnZXQgbWVzaGVzKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fbWVzaGVzO1xuICAgIH1cblxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMubWVzaGVzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBkZWNyZW1lbnQgcmVmZXJlbmNlcyB0byBtZXNoZXMsIGRlc3Ryb3kgdGhlIG9uZXMgd2l0aCB6ZXJvIHJlZmVyZW5jZXNcbiAgICBkZWNSZWZNZXNoZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fbWVzaGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc2ggPSB0aGlzLl9tZXNoZXNbaV07XG4gICAgICAgICAgICAgICAgaWYgKG1lc2gpIHtcbiAgICAgICAgICAgICAgICAgICAgbWVzaC5kZWNSZWZDb3VudCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAobWVzaC5yZWZDb3VudCA8IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc2guZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaGVzW2ldID0gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGluY3JlbWVudHMgcmVmIGNvdW50IG9uIGFsbCBtZXNoZXNcbiAgICBpbmNSZWZNZXNoZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9tZXNoZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fbWVzaGVzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLl9tZXNoZXNbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWVzaGVzW2ldLmluY1JlZkNvdW50KCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBSZW5kZXIgfTtcbiJdLCJuYW1lcyI6WyJSZW5kZXIiLCJFdmVudEhhbmRsZXIiLCJjb25zdHJ1Y3RvciIsIl9tZXNoZXMiLCJtZXNoZXMiLCJ2YWx1ZSIsImRlY1JlZk1lc2hlcyIsImluY1JlZk1lc2hlcyIsImZpcmUiLCJkZXN0cm95IiwiY291bnQiLCJsZW5ndGgiLCJpIiwibWVzaCIsImRlY1JlZkNvdW50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
