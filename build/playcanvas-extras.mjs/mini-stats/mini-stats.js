/**
 * @license
 * PlayCanvas Engine v1.63.0 revision 29d4ce307
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Color, Texture, math, FILTER_NEAREST } from 'playcanvas';
import { CpuTimer } from './cpu-timer.js';
import { GpuTimer } from './gpu-timer.js';
import { StatsTimer } from './stats-timer.js';
import { Graph } from './graph.js';
import { WordAtlas } from './word-atlas.js';
import { Render2d } from './render2d.js';

class MiniStats {
	constructor(app, options) {
		const device = app.graphicsDevice;
		this._contextLostHandler = event => {
			event.preventDefault();
			if (this.graphs) {
				for (let i = 0; i < this.graphs.length; i++) {
					this.graphs[i].loseContext();
				}
			}
		};
		device.canvas.addEventListener('webglcontextlost', this._contextLostHandler, false);
		options = options || MiniStats.getDefaultOptions();
		const graphs = this.initGraphs(app, device, options);
		let words = ['', 'ms', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'];
		graphs.forEach(graph => {
			words.push(graph.name);
		});
		if (options.stats) {
			options.stats.forEach(stat => {
				if (stat.unitsName) words.push(stat.unitsName);
			});
		}
		words = words.filter((item, index) => {
			return words.indexOf(item) >= index;
		});
		const maxWidth = options.sizes.reduce((max, v) => {
			return v.width > max ? v.width : max;
		}, 0);
		const wordAtlasData = this.initWordAtlas(device, words, maxWidth, graphs.length);
		const texture = wordAtlasData.texture;
		graphs.forEach((graph, i) => {
			graph.texture = texture;
			graph.yOffset = i;
		});
		this.sizes = options.sizes;
		this._activeSizeIndex = options.startSizeIndex;
		const div = document.createElement('div');
		div.style.cssText = 'position:fixed;bottom:0;left:0;background:transparent;';
		document.body.appendChild(div);
		div.addEventListener('mouseenter', event => {
			this.opacity = 1.0;
		});
		div.addEventListener('mouseleave', event => {
			this.opacity = 0.5;
		});
		div.addEventListener('click', event => {
			event.preventDefault();
			if (this._enabled) {
				this.activeSizeIndex = (this.activeSizeIndex + 1) % this.sizes.length;
				this.resize(this.sizes[this.activeSizeIndex].width, this.sizes[this.activeSizeIndex].height, this.sizes[this.activeSizeIndex].graphs);
			}
		});
		device.on('resizecanvas', () => {
			this.updateDiv();
		});
		app.on('postrender', () => {
			if (this._enabled) {
				this.render();
			}
		});
		this.device = device;
		this.texture = texture;
		this.wordAtlas = wordAtlasData.atlas;
		this.render2d = new Render2d(device, options.colors);
		this.graphs = graphs;
		this.div = div;
		this.width = 0;
		this.height = 0;
		this.gspacing = 2;
		this.clr = [1, 1, 1, 0.5];
		this._enabled = true;
		this.activeSizeIndex = this._activeSizeIndex;
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
			colors: {
				graph0: new Color(0.7, 0.2, 0.2, 1),
				graph1: new Color(0.2, 0.7, 0.2, 1),
				graph2: new Color(0.2, 0.2, 0.7, 1),
				watermark: new Color(0.4, 0.4, 0.2, 1),
				background: new Color(0, 0, 0, 1.0)
			},
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
	initWordAtlas(device, words, maxWidth, numGraphs) {
		const texture = new Texture(device, {
			name: 'mini-stats',
			width: math.nextPowerOfTwo(maxWidth),
			height: 64,
			mipmaps: false,
			minFilter: FILTER_NEAREST,
			magFilter: FILTER_NEAREST
		});
		const wordAtlas = new WordAtlas(texture, words);
		const dest = texture.lock();
		for (let i = 0; i < texture.width * numGraphs; ++i) {
			dest.set([0, 0, 0, 255], i * 4);
		}
		texture.unlock();
		device.setTexture(texture, 0);
		return {
			atlas: wordAtlas,
			texture: texture
		};
	}
	initGraphs(app, device, options) {
		const graphs = [];
		if (options.cpu.enabled) {
			const timer = new CpuTimer(app);
			const graph = new Graph('CPU', app, options.cpu.watermark, options.textRefreshRate, timer);
			graphs.push(graph);
		}
		if (options.gpu.enabled && device.extDisjointTimerQuery) {
			const timer = new GpuTimer(app);
			const graph = new Graph('GPU', app, options.gpu.watermark, options.textRefreshRate, timer);
			graphs.push(graph);
		}
		if (options.stats) {
			options.stats.forEach(entry => {
				const timer = new StatsTimer(app, entry.stats, entry.decimalPlaces, entry.unitsName, entry.multiplier);
				const graph = new Graph(entry.name, app, entry.watermark, options.textRefreshRate, timer);
				graphs.push(graph);
			});
		}
		return graphs;
	}
	render() {
		const graphs = this.graphs;
		const wordAtlas = this.wordAtlas;
		const render2d = this.render2d;
		const width = this.width;
		const height = this.height;
		const gspacing = this.gspacing;
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
		render2d.render(this.clr, height);
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
}

export { MiniStats };
