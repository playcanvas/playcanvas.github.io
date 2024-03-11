/**
 * @license
 * PlayCanvas Engine v0.0.0 revision 29eb79929
 * Copyright 2011-2024 PlayCanvas Ltd. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { LAYERID_UI, Texture, math, FILTER_NEAREST, ADDRESS_REPEAT } from 'playcanvas';
import { CpuTimer } from './cpu-timer.js';
import { GpuTimer } from './gpu-timer.js';
import { StatsTimer } from './stats-timer.js';
import { Graph } from './graph.js';
import { WordAtlas } from './word-atlas.js';
import { Render2d } from './render2d.js';

class MiniStats {
  constructor(app, options) {
    const device = app.graphicsDevice;
    options = options || MiniStats.getDefaultOptions();
    this.initGraphs(app, device, options);
    const words = new Set(['', 'ms', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'].concat(this.graphs.map(graph => graph.name)).concat(options.stats ? options.stats.map(stat => stat.unitsName) : []).filter(item => !!item));
    this.wordAtlas = new WordAtlas(device, words);
    this.sizes = options.sizes;
    this._activeSizeIndex = options.startSizeIndex;
    const div = document.createElement('div');
    div.setAttribute('id', 'mini-stats');
    div.style.cssText = 'position:fixed;bottom:0;left:0;background:transparent;';
    document.body.appendChild(div);
    div.addEventListener('mouseenter', event => {
      this.opacity = 1.0;
    });
    div.addEventListener('mouseleave', event => {
      this.opacity = 0.7;
    });
    div.addEventListener('click', event => {
      event.preventDefault();
      if (this._enabled) {
        this.activeSizeIndex = (this.activeSizeIndex + 1) % this.sizes.length;
        this.resize(this.sizes[this.activeSizeIndex].width, this.sizes[this.activeSizeIndex].height, this.sizes[this.activeSizeIndex].graphs);
      }
    });
    device.on('resizecanvas', this.updateDiv, this);
    device.on('losecontext', this.loseContext, this);
    app.on('postrender', this.postRender, this);
    this.app = app;
    this.drawLayer = app.scene.layers.getLayerById(LAYERID_UI);
    this.device = device;
    this.render2d = new Render2d(device);
    this.div = div;
    this.width = 0;
    this.height = 0;
    this.gspacing = 2;
    this.clr = [1, 1, 1, 0.5];
    this._enabled = true;
    this.activeSizeIndex = this._activeSizeIndex;
  }
  destroy() {
    this.device.off('resizecanvas', this.updateDiv, this);
    this.device.off('losecontext', this.loseContext, this);
    this.app.off('postrender', this.postRender, this);
    this.graphs.forEach(graph => graph.destroy());
    this.wordAtlas.destroy();
    this.texture.destroy();
  }
  static getDefaultOptions() {
    return {
      sizes: [{
        width: 100,
        height: 16,
        spacing: 0,
        graphs: false
      }, {
        width: 128,
        height: 32,
        spacing: 2,
        graphs: true
      }, {
        width: 256,
        height: 64,
        spacing: 2,
        graphs: true
      }],
      startSizeIndex: 0,
      textRefreshRate: 500,
      cpu: {
        enabled: true,
        watermark: 33
      },
      gpu: {
        enabled: true,
        watermark: 33
      },
      stats: [{
        name: 'Frame',
        stats: ['frame.ms'],
        decimalPlaces: 1,
        unitsName: 'ms',
        watermark: 33
      }, {
        name: 'DrawCalls',
        stats: ['drawCalls.total'],
        watermark: 1000
      }]
    };
  }
  set activeSizeIndex(value) {
    this._activeSizeIndex = value;
    this.gspacing = this.sizes[value].spacing;
    this.resize(this.sizes[value].width, this.sizes[value].height, this.sizes[value].graphs);
  }
  get activeSizeIndex() {
    return this._activeSizeIndex;
  }
  set opacity(value) {
    this.clr[3] = value;
  }
  get opacity() {
    return this.clr[3];
  }
  get overallHeight() {
    const graphs = this.graphs;
    const spacing = this.gspacing;
    return this.height * graphs.length + spacing * (graphs.length - 1);
  }
  set enabled(value) {
    if (value !== this._enabled) {
      this._enabled = value;
      for (let i = 0; i < this.graphs.length; ++i) {
        this.graphs[i].enabled = value;
        this.graphs[i].timer.enabled = value;
      }
    }
  }
  get enabled() {
    return this._enabled;
  }
  initGraphs(app, device, options) {
    this.graphs = [];
    if (options.cpu.enabled) {
      const timer = new CpuTimer(app);
      const graph = new Graph('CPU', app, options.cpu.watermark, options.textRefreshRate, timer);
      this.graphs.push(graph);
    }
    if (options.gpu.enabled) {
      const timer = new GpuTimer(device);
      const graph = new Graph('GPU', app, options.gpu.watermark, options.textRefreshRate, timer);
      this.graphs.push(graph);
    }
    if (options.stats) {
      options.stats.forEach(entry => {
        const timer = new StatsTimer(app, entry.stats, entry.decimalPlaces, entry.unitsName, entry.multiplier);
        const graph = new Graph(entry.name, app, entry.watermark, options.textRefreshRate, timer);
        this.graphs.push(graph);
      });
    }
    const maxWidth = options.sizes.reduce((max, v) => {
      return v.width > max ? v.width : max;
    }, 0);
    this.texture = new Texture(device, {
      name: 'mini-stats-graph-texture',
      width: math.nextPowerOfTwo(maxWidth),
      height: math.nextPowerOfTwo(this.graphs.length),
      mipmaps: false,
      minFilter: FILTER_NEAREST,
      magFilter: FILTER_NEAREST,
      addressU: ADDRESS_REPEAT,
      addressV: ADDRESS_REPEAT
    });
    this.graphs.forEach((graph, i) => {
      graph.texture = this.texture;
      graph.yOffset = i;
    });
  }
  render() {
    const graphs = this.graphs;
    const wordAtlas = this.wordAtlas;
    const render2d = this.render2d;
    const width = this.width;
    const height = this.height;
    const gspacing = this.gspacing;
    render2d.startFrame();
    for (let i = 0; i < graphs.length; ++i) {
      const graph = graphs[i];
      let y = i * (height + gspacing);
      graph.render(render2d, 0, y, width, height);
      let x = 1;
      y += height - 13;
      x += wordAtlas.render(render2d, graph.name, x, y) + 10;
      const timingText = graph.timingText;
      for (let j = 0; j < timingText.length; ++j) {
        x += wordAtlas.render(render2d, timingText[j], x, y);
      }
      if (graph.timer.unitsName) {
        x += 3;
        wordAtlas.render(render2d, graph.timer.unitsName, x, y);
      }
    }
    render2d.render(this.app, this.drawLayer, this.texture, this.wordAtlas.texture, this.clr, height);
  }
  resize(width, height, showGraphs) {
    const graphs = this.graphs;
    for (let i = 0; i < graphs.length; ++i) {
      graphs[i].enabled = showGraphs;
    }
    this.width = width;
    this.height = height;
    this.updateDiv();
  }
  updateDiv() {
    const rect = this.device.canvas.getBoundingClientRect();
    this.div.style.left = rect.left + 'px';
    this.div.style.bottom = window.innerHeight - rect.bottom + 'px';
    this.div.style.width = this.width + 'px';
    this.div.style.height = this.overallHeight + 'px';
  }
  loseContext() {
    this.graphs.forEach(graph => graph.loseContext());
  }
  postRender() {
    if (this._enabled) {
      this.render();
    }
  }
}

export { MiniStats };
