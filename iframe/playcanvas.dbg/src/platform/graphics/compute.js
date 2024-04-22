/**
 * A helper class storing a parameter value as well as its scope ID.
 *
 * @ignore
 */
class ComputeParameter {
  constructor() {
    this.value = void 0;
    /** @type {import('./scope-id.js').ScopeId} */
    this.scopeId = null;
  }
}

/**
 * A representation of a compute shader with the associated resources, that can be executed on the
 * GPU. Only supported on WebGPU platform.
 */
class Compute {
  /**
   * Create a compute instance. Note that this is supported on WebGPU only and is a no-op on
   * other platforms.
   *
   * @param {import('./graphics-device.js').GraphicsDevice} graphicsDevice -
   * The graphics device.
   * @param {import('./shader.js').Shader} shader - The compute shader.
   * @param {string} [name] - The name of the compute instance, used for debugging only.
   */
  constructor(graphicsDevice, shader, name = 'Unnamed') {
    /**
     * A compute shader.
     *
     * @type {import('./shader.js').Shader|null}
     * @ignore
     */
    this.shader = null;
    /**
     * The non-unique name of an instance of the class. Defaults to 'Unnamed'.
     *
     * @type {string}
     */
    this.name = void 0;
    /**
     * @type {Map<string, ComputeParameter>}
     * @ignore
     */
    this.parameters = new Map();
    /**
     * @type {number}
     * @ignore
     */
    this.countX = 1;
    /**
     * @type {number|undefined}
     * @ignore
     */
    this.countY = void 0;
    /**
     * @type {number|undefined}
     * @ignore
     */
    this.countZ = void 0;
    this.device = graphicsDevice;
    this.shader = shader;
    this.name = name;
    if (graphicsDevice.supportsCompute) {
      this.impl = graphicsDevice.createComputeImpl(this);
    }
  }

  /**
   * Sets a shader parameter on a compute instance.
   *
   * @param {string} name - The name of the parameter to set.
   * @param {number|number[]|Float32Array|import('./texture.js').Texture|import('./storage-buffer.js').StorageBuffer|import('./vertex-buffer.js').VertexBuffer|import('./index-buffer.js').IndexBuffer} value
   * - The value for the specified parameter.
   */
  setParameter(name, value) {
    let param = this.parameters.get(name);
    if (!param) {
      param = new ComputeParameter();
      param.scopeId = this.device.scope.resolve(name);
      this.parameters.set(name, param);
    }
    param.value = value;
  }

  /**
   * Returns the value of a shader parameter from the compute instance.
   *
   * @param {string} name - The name of the parameter to get.
   * @returns {number|number[]|Float32Array|import('./texture.js').Texture|import('./storage-buffer.js').StorageBuffer|import('./vertex-buffer.js').VertexBuffer|import('./index-buffer.js').IndexBuffer|undefined}
   * The value of the specified parameter.
   */
  getParameter(name) {
    var _this$parameters$get;
    return (_this$parameters$get = this.parameters.get(name)) == null ? void 0 : _this$parameters$get.value;
  }

  /**
   * Deletes a shader parameter from the compute instance.
   *
   * @param {string} name - The name of the parameter to delete.
   */
  deleteParameter(name) {
    this.parameters.delete(name);
  }

  /**
   * Apply the parameters to the scope.
   *
   * @ignore
   */
  applyParameters() {
    for (const [, param] of this.parameters) {
      param.scopeId.setValue(param.value);
    }
  }

  /**
   * Prepare the compute work dispatch.
   *
   * @param {number} x - X dimension of the grid of work-groups to dispatch.
   * @param {number} [y] - Y dimension of the grid of work-groups to dispatch.
   * @param {number} [z] - Z dimension of the grid of work-groups to dispatch.
   */
  setupDispatch(x, y, z) {
    this.countX = x;
    this.countY = y;
    this.countZ = z;
  }
}

export { Compute };
