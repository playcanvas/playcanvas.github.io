class NullRenderTarget {
  destroy(device) {}
  init(device, renderTarget) {}
  loseContext() {}
  resolve(device, target, color, depth) {}
}

export { NullRenderTarget };
