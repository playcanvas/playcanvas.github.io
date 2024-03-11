/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 29eb79929
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
class Graph {
  constructor(name, app, watermark, textRefreshRate, timer) {
    this.app = app;
    this.name = name;
    this.device = app.graphicsDevice;
    this.timer = timer;
    this.watermark = watermark;
    this.enabled = false;
    this.textRefreshRate = textRefreshRate;
    this.avgTotal = 0;
    this.avgTimer = 0;
    this.avgCount = 0;
    this.timingText = '';
    this.texture = null;
    this.yOffset = 0;
    this.cursor = 0;
    this.sample = new Uint8ClampedArray(4);
    this.sample.set([0, 0, 0, 255]);
    this.counter = 0;
    this.app.on('frameupdate', this.update, this);
  }
  destroy() {
    this.app.off('frameupdate', this.update, this);
  }
  loseContext() {
    if (this.timer && typeof this.timer.loseContext === 'function') {
      this.timer.loseContext();
    }
  }
  update(ms) {
    const timings = this.timer.timings;
    const total = timings.reduce((a, v) => a + v, 0);
    this.avgTotal += total;
    this.avgTimer += ms;
    this.avgCount++;
    if (this.avgTimer > this.textRefreshRate) {
      this.timingText = (this.avgTotal / this.avgCount).toFixed(this.timer.decimalPlaces);
      this.avgTimer = 0;
      this.avgTotal = 0;
      this.avgCount = 0;
    }
    if (this.enabled) {
      let value = 0;
      const range = 1.5 * this.watermark;
      for (let i = 0; i < timings.length; ++i) {
        value += Math.floor(timings[i] / range * 255);
        this.sample[i] = value;
      }
      this.sample[3] = this.watermark / range * 255;
      const data = this.texture.lock();
      data.set(this.sample, (this.cursor + this.yOffset * this.texture.width) * 4);
      this.texture.unlock();
      this.cursor++;
      if (this.cursor === this.texture.width) {
        this.cursor = 0;
      }
    }
  }
  render(render2d, x, y, w, h) {
    render2d.quad(x + w, y, -w, h, this.enabled ? this.cursor : 0, this.enabled ? 0.5 + this.yOffset : this.texture.height - 1, -w, 0, this.texture, 0);
  }
}

export { Graph };
