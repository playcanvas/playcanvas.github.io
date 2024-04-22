class ComputeParameter {
  constructor() {
    this.value = void 0;
    this.scopeId = null;
  }
}
class Compute {
  constructor(graphicsDevice, shader, name = 'Unnamed') {
    this.shader = null;
    this.name = void 0;
    this.parameters = new Map();
    this.countX = 1;
    this.countY = void 0;
    this.countZ = void 0;
    this.device = graphicsDevice;
    this.shader = shader;
    this.name = name;
    if (graphicsDevice.supportsCompute) {
      this.impl = graphicsDevice.createComputeImpl(this);
    }
  }
  setParameter(name, value) {
    let param = this.parameters.get(name);
    if (!param) {
      param = new ComputeParameter();
      param.scopeId = this.device.scope.resolve(name);
      this.parameters.set(name, param);
    }
    param.value = value;
  }
  getParameter(name) {
    var _this$parameters$get;
    return (_this$parameters$get = this.parameters.get(name)) == null ? void 0 : _this$parameters$get.value;
  }
  deleteParameter(name) {
    this.parameters.delete(name);
  }
  applyParameters() {
    for (const [, param] of this.parameters) {
      param.scopeId.setValue(param.value);
    }
  }
  setupDispatch(x, y, z) {
    this.countX = x;
    this.countY = y;
    this.countZ = z;
  }
}

export { Compute };
