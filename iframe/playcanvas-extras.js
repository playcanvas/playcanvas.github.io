(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('playcanvas')) :
	typeof define === 'function' && define.amd ? define(['exports', 'playcanvas'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.pcx = {}, global.pc));
})(this, (function (exports, playcanvas) { 'use strict';

	class CpuTimer {
	    constructor(app) {
	        this._frameIndex = 0;
	        this._frameTimings = [];
	        this._timings = [];
	        this._prevTimings = [];
	        this.unitsName = 'ms';
	        this.decimalPlaces = 1;

	        this.enabled = true;

	        app.on('frameupdate', this.begin.bind(this, 'update'));
	        app.on('framerender', this.mark.bind(this, 'render'));
	        app.on('frameend', this.mark.bind(this, 'other'));
	    }

	    // mark the beginning of the frame
	    begin(name) {
	        if (!this.enabled) {
	            return;
	        }

	        // end previous frame timings
	        if (this._frameIndex < this._frameTimings.length) {
	            this._frameTimings.splice(this._frameIndex);
	        }
	        const tmp = this._prevTimings;
	        this._prevTimings = this._timings;
	        this._timings = this._frameTimings;
	        this._frameTimings = tmp;
	        this._frameIndex = 0;

	        this.mark(name);
	    }

	    // mark
	    mark(name) {
	        if (!this.enabled) {
	            return;
	        }

	        const timestamp = playcanvas.now();

	        // end previous mark
	        if (this._frameIndex > 0) {
	            const prev = this._frameTimings[this._frameIndex - 1];
	            prev[1] = timestamp - prev[1];
	        } else if (this._timings.length > 0) {
	            const prev = this._timings[this._timings.length - 1];
	            prev[1] = timestamp - prev[1];
	        }

	        if (this._frameIndex >= this._frameTimings.length) {
	            this._frameTimings.push([name, timestamp]);
	        } else {
	            const timing = this._frameTimings[this._frameIndex];
	            timing[0] = name;
	            timing[1] = timestamp;
	        }
	        this._frameIndex++;
	    }

	    get timings() {
	        // remove the last time point from the list (which is the time spent outside
	        // of PlayCanvas)
	        return this._timings.slice(0, -1).map(v => v[1]);
	    }
	}

	class GpuTimer {
	    constructor(device) {
	        this.device = device;
	        device.gpuProfiler.enabled = true;

	        this.enabled = true;
	        this.unitsName = 'ms';
	        this.decimalPlaces = 1;

	        this._timings = [];
	    }

	    get timings() {
	        this._timings[0] = this.device.gpuProfiler._frameTime;
	        return this._timings;
	    }
	}

	// Stats timer interface for graph
	class StatsTimer {
	    constructor(app, statNames, decimalPlaces, unitsName, multiplier) {
	        this.app = app;
	        this.values = [];

	        // supporting up to 3 stats
	        this.statNames = statNames;
	        if (this.statNames.length > 3)
	            this.statNames.length = 3;

	        this.unitsName = unitsName;
	        this.decimalPlaces = decimalPlaces;
	        this.multiplier = multiplier || 1;

	        // recursively look up properties of objects specified in a string
	        const resolve = (path, obj) => {
	            return path.split('.').reduce((prev, curr) => {
	                return prev ? prev[curr] : null;
	            }, obj || this);
	        };

	        app.on('frameupdate', (ms) => {
	            for (let i = 0; i < this.statNames.length; i++) {

	                // read specified stat from app.stats object
	                this.values[i] = resolve(this.statNames[i], this.app.stats) * this.multiplier;
	            }
	        });
	    }

	    get timings() {
	        return this.values;
	    }
	}

	// Realtime performance graph visual
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

	    // called when context was lost, function releases all context related resources
	    loseContext() {
	        // if timer implements loseContext
	        if (this.timer && (typeof this.timer.loseContext === 'function')) {
	            this.timer.loseContext();
	        }
	    }

	    update(ms) {
	        const timings = this.timer.timings;

	        // calculate stacked total
	        const total = timings.reduce((a, v) => a + v, 0);

	        // update averages
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
	            // update timings
	            let value = 0;
	            const range = 1.5 * this.watermark;
	            for (let i = 0; i < timings.length; ++i) {
	                // scale the value into the range
	                value += Math.floor(timings[i] / range * 255);
	                this.sample[i] = value;
	            }

	            // .a store watermark
	            this.sample[3] = this.watermark / range * 255;

	            // write latest sample
	            const data = this.texture.lock();
	            data.set(this.sample, (this.cursor + this.yOffset * this.texture.width) * 4);
	            this.texture.unlock();

	            // update cursor position
	            this.cursor++;
	            if (this.cursor === this.texture.width) {
	                this.cursor = 0;
	            }
	        }
	    }

	    render(render2d, x, y, w, h) {
	        render2d.quad(x + w, y, -w, h,
	                      this.enabled ? this.cursor : 0,
	                      this.enabled ? 0.5 + this.yOffset : this.texture.height - 1,
	                      -w, 0,
	                      this.texture,
	                      0);
	    }
	}

	class WordAtlas {
	    constructor(device, words) {

	        const initContext = (context) => {
	            context.font = '10px "Lucida Console", Monaco, monospace';
	            context.textAlign = 'left';
	            context.textBaseline = 'alphabetic';
	        };

	        const isNumber = (word) => {
	            return word === '.' || (word.length === 1 && word.charCodeAt(0) >= 48 && word.charCodeAt(0) <= 57);
	        };

	        // create a canvas
	        const canvas = document.createElement('canvas');
	        const context = canvas.getContext('2d', { alpha: true });
	        initContext(context);

	        // measure words
	        const placements = new Map();
	        const padding = 5;
	        const width = 512;
	        let x = padding;
	        let y = padding;

	        words.forEach((word) => {
	            const measurement = context.measureText(word);
	            const l = Math.ceil(-measurement.actualBoundingBoxLeft);
	            const r = Math.ceil(measurement.actualBoundingBoxRight);
	            const a = Math.ceil(measurement.actualBoundingBoxAscent);
	            const d = Math.ceil(measurement.actualBoundingBoxDescent);
	            const w = l + r;
	            const h = a + d;

	            if (x + w + padding >= width) {
	                x = padding;
	                y += 16;
	            }

	            placements.set(word, { l, r, a, d, w, h, x: x, y: y });

	            x += w + padding;
	        });

	        // size canvas
	        canvas.width = 512;
	        canvas.height = playcanvas.math.nextPowerOfTwo(y + 16 + padding);

	        initContext(context);
	        context.fillStyle = 'rgb(0, 0, 0)';
	        context.fillRect(0, 0, canvas.width, canvas.height);

	        // render words
	        placements.forEach((m, word) => {
	            // digits and '.' are white, the rest grey
	            context.fillStyle = isNumber(word) ? 'rgb(255, 255, 255)' : 'rgb(170, 170, 170)';

	            // render the word
	            context.fillText(word, m.x - m.l, m.y + m.a);
	        });

	        this.placements = placements;

	        // convert from black and white data to white texture with alpha
	        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
	        for (let i = 0; i < data.length; i += 4) {
	            data[i + 3] = data[i + 0];
	            data[i + 0] = 255;
	            data[i + 1] = 255;
	            data[i + 2] = 255;
	        }

	        this.texture = new playcanvas.Texture(device, {
	            name: 'mini-stats-word-atlas',
	            width: canvas.width,
	            height: canvas.height,
	            mipmaps: false,
	            minFilter: playcanvas.FILTER_NEAREST,
	            magFilter: playcanvas.FILTER_NEAREST,
	            levels: [data]
	        });
	    }

	    destroy() {
	        this.texture.destroy();
	        this.texture = null;
	    }

	    render(render2d, word, x, y) {
	        const p = this.placements.get(word);
	        if (p) {
	            const padding = 1;
	            render2d.quad(x + p.l - padding,
	                          y - p.d + padding,
	                          p.w + padding * 2,
	                          p.h + padding * 2,
	                          p.x - padding,
	                          this.texture.height - p.y - p.h - padding,
	                          undefined, undefined,
	                          this.texture,
	                          1);
	            return p.w;
	        }
	        return 0;
	    }
	}

	const vertexShader = /* glsl */ `
attribute vec3 vertex_position;         // unnormalized xy, word flag
attribute vec4 vertex_texCoord0;        // unnormalized texture space uv, normalized uv

varying vec4 uv0;
varying float wordFlag;

void main(void) {
    gl_Position = vec4(vertex_position.xy * 2.0 - 1.0, 0.5, 1.0);
    uv0 = vertex_texCoord0;
    wordFlag = vertex_position.z;
}`;

	// this fragment shader renders the bits required for text and graphs. The text is identified
	// in the texture by white color. The graph data is specified as a single row of pixels
	// where the R channel denotes the height of the 1st graph and the G channel the height
	// of the second graph and B channel the height of the last graph
	const fragmentShader$1 = /* glsl */ `
varying vec4 uv0;
varying float wordFlag;

uniform vec4 clr;
uniform sampler2D graphTex;
uniform sampler2D wordsTex;

void main (void) {
    vec4 graphSample = texture2D(graphTex, uv0.xy);

    vec4 graph;
    if (uv0.w < graphSample.r)
        graph = vec4(0.7, 0.2, 0.2, 1.0);
    else if (uv0.w < graphSample.g)
        graph = vec4(0.2, 0.7, 0.2, 1.0);
    else if (uv0.w < graphSample.b)
        graph = vec4(0.2, 0.2, 0.7, 1.0);
    else
        graph = vec4(0.0, 0.0, 0.0, 1.0 - 0.25 * sin(uv0.w * 3.14159));

    vec4 words = texture2D(wordsTex, vec2(uv0.x, 1.0 - uv0.y));

    gl_FragColor = mix(graph, words, wordFlag) * clr;
}`;

	// render 2d textured quads
	class Render2d {
	    constructor(device, maxQuads = 512) {
	        const format = new playcanvas.VertexFormat(device, [
	            { semantic: playcanvas.SEMANTIC_POSITION, components: 3, type: playcanvas.TYPE_FLOAT32 },
	            { semantic: playcanvas.SEMANTIC_TEXCOORD0, components: 4, type: playcanvas.TYPE_FLOAT32 }
	        ]);

	        // generate quad indices
	        const indices = new Uint16Array(maxQuads * 6);
	        for (let i = 0; i < maxQuads; ++i) {
	            indices[i * 6 + 0] = i * 4;
	            indices[i * 6 + 1] = i * 4 + 1;
	            indices[i * 6 + 2] = i * 4 + 2;
	            indices[i * 6 + 3] = i * 4;
	            indices[i * 6 + 4] = i * 4 + 2;
	            indices[i * 6 + 5] = i * 4 + 3;
	        }

	        const shader = playcanvas.shaderChunks.createShaderFromCode(device, vertexShader, fragmentShader$1, 'mini-stats');

	        this.device = device;
	        this.buffer = new playcanvas.VertexBuffer(device, format, maxQuads * 4, playcanvas.BUFFER_STREAM);
	        this.data = new Float32Array(this.buffer.numBytes / 4);
	        this.indexBuffer = new playcanvas.IndexBuffer(device, playcanvas.INDEXFORMAT_UINT16, maxQuads * 6, playcanvas.BUFFER_STATIC, indices);
	        this.prim = {
	            type: playcanvas.PRIMITIVE_TRIANGLES,
	            indexed: true,
	            base: 0,
	            count: 0
	        };
	        this.quads = 0;

	        this.mesh = new playcanvas.Mesh(device);
	        this.mesh.vertexBuffer = this.buffer;
	        this.mesh.indexBuffer[0] = this.indexBuffer;
	        this.mesh.primitive = [this.prim];

	        const material = new playcanvas.Material();
	        this.material = material;
	        material.cull = playcanvas.CULLFACE_NONE;
	        material.shader = shader;
	        material.depthState = playcanvas.DepthState.NODEPTH;
	        material.blendState = new playcanvas.BlendState(true, playcanvas.BLENDEQUATION_ADD, playcanvas.BLENDMODE_SRC_ALPHA, playcanvas.BLENDMODE_ONE_MINUS_SRC_ALPHA,
	                                             playcanvas.BLENDEQUATION_ADD, playcanvas.BLENDMODE_ONE, playcanvas.BLENDMODE_ONE);
	        material.update();

	        this.meshInstance = new playcanvas.MeshInstance(this.mesh, material, new playcanvas.GraphNode('MiniStatsMesh'));

	        this.uniforms = {
	            clr: new Float32Array(4)
	        };

	        this.targetSize = {
	            width: device.width,
	            height: device.height
	        };
	    }

	    quad(x, y, w, h, u, v, uw, uh, texture, wordFlag = 0) {
	        const rw = this.targetSize.width;
	        const rh = this.targetSize.height;
	        const x0 = x / rw;
	        const y0 = y / rh;
	        const x1 = (x + w) / rw;
	        const y1 = (y + h) / rh;

	        const tw = texture.width;
	        const th = texture.height;
	        const u0 = u / tw;
	        const v0 = v / th;
	        const u1 = (u + (uw ?? w)) / tw;
	        const v1 = (v + (uh ?? h)) / th;

	        this.data.set([
	            x0, y0, wordFlag, u0, v0, 0, 0,
	            x1, y0, wordFlag, u1, v0, 1, 0,
	            x1, y1, wordFlag, u1, v1, 1, 1,
	            x0, y1, wordFlag, u0, v1, 0, 1
	        ], 4 * 7 * this.quads);

	        this.quads++;
	        this.prim.count += 6;
	    }

	    startFrame() {
	        this.quads = 0;
	        this.prim.count = 0;

	        this.targetSize.width = this.device.canvas.scrollWidth;
	        this.targetSize.height = this.device.canvas.scrollHeight;
	    }

	    render(app, layer, graphTexture, wordsTexture, clr, height) {

	        // set vertex data (swap storage)
	        this.buffer.setData(this.data.buffer);

	        this.uniforms.clr.set(clr, 0);

	        // material params
	        this.material.setParameter('clr', this.uniforms.clr);
	        this.material.setParameter('graphTex', graphTexture);
	        this.material.setParameter('wordsTex', wordsTexture);

	        app.drawMeshInstance(this.meshInstance, layer);
	    }
	}

	// MiniStats rendering of CPU and GPU timing information
	class MiniStats {
	    constructor(app, options) {
	        const device = app.graphicsDevice;

	        options = options || MiniStats.getDefaultOptions();

	        // create graphs
	        this.initGraphs(app, device, options);

	        // extract list of words
	        const words = new Set(
	            ['', 'ms', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.']
	                .concat(this.graphs.map(graph => graph.name))
	                .concat(options.stats ? options.stats.map(stat => stat.unitsName) : [])
	                .filter(item => !!item)
	        );

	        this.wordAtlas = new WordAtlas(device, words);
	        this.sizes = options.sizes;
	        this._activeSizeIndex = options.startSizeIndex;

	        // create click region so we can resize
	        const div = document.createElement('div');
	        div.setAttribute('id', 'mini-stats');
	        div.style.cssText = 'position:fixed;bottom:0;left:0;background:transparent;';
	        document.body.appendChild(div);

	        div.addEventListener('mouseenter', (event) => {
	            this.opacity = 1.0;
	        });

	        div.addEventListener('mouseleave', (event) => {
	            this.opacity = 0.7;
	        });

	        div.addEventListener('click', (event) => {
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
	        this.drawLayer = app.scene.layers.getLayerById(playcanvas.LAYERID_UI);
	        this.device = device;
	        this.render2d = new Render2d(device);
	        this.div = div;

	        this.width = 0;
	        this.height = 0;
	        this.gspacing = 2;
	        this.clr = [1, 1, 1, 0.5];

	        this._enabled = true;

	        // initial resize
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

	            // sizes of area to render individual graphs in and spacing between individual graphs
	            sizes: [
	                { width: 100, height: 16, spacing: 0, graphs: false },
	                { width: 128, height: 32, spacing: 2, graphs: true },
	                { width: 256, height: 64, spacing: 2, graphs: true }
	            ],

	            // index into sizes array for initial setting
	            startSizeIndex: 0,

	            // refresh rate of text stats in ms
	            textRefreshRate: 500,

	            // cpu graph options
	            cpu: {
	                enabled: true,
	                watermark: 33
	            },

	            // gpu graph options
	            gpu: {
	                enabled: true,
	                watermark: 33
	            },

	            // array of options to render additional graphs based on stats collected into Application.stats
	            stats: [
	                {
	                    // display name
	                    name: 'Frame',

	                    // path to data inside Application.stats
	                    stats: ['frame.ms'],

	                    // number of decimal places (defaults to none)
	                    decimalPlaces: 1,

	                    // units (defaults to "")
	                    unitsName: 'ms',

	                    // watermark - shown as a line on the graph, useful for displaying a budget
	                    watermark: 33
	                },

	                // total number of draw calls
	                {
	                    name: 'DrawCalls',
	                    stats: ['drawCalls.total'],
	                    watermark: 1000
	                }
	            ]
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
	            options.stats.forEach((entry) => {
	                const timer = new StatsTimer(app, entry.stats, entry.decimalPlaces, entry.unitsName, entry.multiplier);
	                const graph = new Graph(entry.name, app, entry.watermark, options.textRefreshRate, timer);
	                this.graphs.push(graph);
	            });
	        }

	        const maxWidth = options.sizes.reduce((max, v) => {
	            return v.width > max ? v.width : max;
	        }, 0);

	        this.texture = new playcanvas.Texture(device, {
	            name: 'mini-stats-graph-texture',
	            width: playcanvas.math.nextPowerOfTwo(maxWidth),
	            height: playcanvas.math.nextPowerOfTwo(this.graphs.length),
	            mipmaps: false,
	            minFilter: playcanvas.FILTER_NEAREST,
	            magFilter: playcanvas.FILTER_NEAREST,
	            addressU: playcanvas.ADDRESS_REPEAT,
	            addressV: playcanvas.ADDRESS_REPEAT
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

	            // render the graph
	            graph.render(render2d, 0, y, width, height);

	            // render the text
	            let x = 1;
	            y += height - 13;

	            // name + space
	            x += wordAtlas.render(render2d, graph.name, x, y) + 10;

	            // timing
	            const timingText = graph.timingText;
	            for (let j = 0; j < timingText.length; ++j) {
	                x += wordAtlas.render(render2d, timingText[j], x, y);
	            }

	            // units
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
	        this.div.style.bottom = (window.innerHeight - rect.bottom) + 'px';
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

	const textureBlitVertexShader = `
    attribute vec2 vertex_position;
    varying vec2 uv0;
    void main(void) {
        gl_Position = vec4(vertex_position, 0.5, 1.0);
        uv0 = vertex_position.xy * 0.5 + 0.5;
    }`;

	const textureBlitFragmentShader = `
    varying vec2 uv0;
    uniform sampler2D blitTexture;
    void main(void) {
        gl_FragColor = texture2D(blitTexture, uv0);
    }`;

	class CoreExporter {
	    /**
	     * Converts a texture to a canvas.
	     *
	     * @param {Texture} texture - The source texture to be converted.
	     * @param {object} options - Object for passing optional arguments.
	     * @param {Color} [options.color] - The tint color to modify the texture with.
	     * @param {number} [options.maxTextureSize] - Maximum texture size. Texture is resized if over the size.
	     * @returns {Promise<HTMLCanvasElement>|Promise<undefined>} - The canvas element containing the image.
	     */
	    textureToCanvas(texture, options = {}) {

	        const image = texture.getSource();

	        if ((typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) ||
	            (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ||
	            (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas) ||
	            (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)) {

	            // texture dimensions
	            const { width, height } = this.calcTextureSize(image.width, image.height, options.maxTextureSize);

	            // convert to a canvas
	            const canvas = document.createElement('canvas');
	            canvas.width = width;
	            canvas.height = height;
	            const context = canvas.getContext('2d');
	            context.drawImage(image, 0, 0, canvas.width, canvas.height);

	            // tint the texture by specified color
	            if (options.color) {
	                const { r, g, b } = options.color;

	                const imagedata = context.getImageData(0, 0, width, height);
	                const data = imagedata.data;

	                for (let i = 0; i < data.length; i += 4) {
	                    data[i + 0] = data[i + 0] * r;
	                    data[i + 1] = data[i + 1] * g;
	                    data[i + 2] = data[i + 2] * b;
	                }

	                context.putImageData(imagedata, 0, 0);
	            }

	            return Promise.resolve(canvas);
	        }

	        // for other image sources, for example compressed textures, we extract the data by rendering the texture to a render target
	        const device = texture.device;
	        const { width, height } = this.calcTextureSize(texture.width, texture.height, options.maxTextureSize);

	        const dstTexture = new playcanvas.Texture(device, {
	            name: 'ExtractedTexture',
	            width,
	            height,
	            format: texture.format,
	            cubemap: false,
	            mipmaps: false,
	            minFilter: playcanvas.FILTER_LINEAR,
	            magFilter: playcanvas.FILTER_LINEAR,
	            addressU: playcanvas.ADDRESS_CLAMP_TO_EDGE,
	            addressV: playcanvas.ADDRESS_CLAMP_TO_EDGE
	        });

	        const renderTarget = new playcanvas.RenderTarget({
	            colorBuffer: dstTexture,
	            depth: false
	        });

	        // render to a render target using a blit shader
	        const shader = playcanvas.createShaderFromCode(device, textureBlitVertexShader, textureBlitFragmentShader, 'ShaderCoreExporterBlit');
	        device.scope.resolve('blitTexture').setValue(texture);
	        device.setBlendState(playcanvas.BlendState.NOBLEND);
	        playcanvas.drawQuadWithShader(device, renderTarget, shader);

	        // read back the pixels
	        // TODO: use async API when ready
	        const pixels = new Uint8ClampedArray(width * height * 4);
	        device.readPixels(0, 0, width, height, pixels);

	        dstTexture.destroy();
	        renderTarget.destroy();

	        // copy pixels to a canvas
	        const newImage = new ImageData(pixels, width, height);
	        const canvas = document.createElement('canvas');
	        canvas.width = width;
	        canvas.height = height;
	        const newContext = canvas.getContext('2d');
	        newContext.putImageData(newImage, 0, 0);

	        return Promise.resolve(canvas);
	    }

	    calcTextureSize(width, height, maxTextureSize) {

	        if (maxTextureSize) {
	            const scale = Math.min(maxTextureSize / Math.max(width, height), 1);
	            width = Math.round(width * scale);
	            height = Math.round(height * scale);
	        }

	        return { width, height };
	    }
	}

	// DEFLATE is a complex format; to read this code, you should probably check the RFC first:

	// aliases for shorter compressed code (most minifers don't do this)
	var u8 = Uint8Array, u16 = Uint16Array, i32 = Int32Array;
	// fixed length extra bits
	var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, /* unused */ 0, 0, /* impossible */ 0]);
	// fixed distance extra bits
	var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, /* unused */ 0, 0]);
	// code length index map
	var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
	// get base, reverse index map from extra bits
	var freb = function (eb, start) {
	    var b = new u16(31);
	    for (var i = 0; i < 31; ++i) {
	        b[i] = start += 1 << eb[i - 1];
	    }
	    // numbers here are at max 18 bits
	    var r = new i32(b[30]);
	    for (var i = 1; i < 30; ++i) {
	        for (var j = b[i]; j < b[i + 1]; ++j) {
	            r[j] = ((j - b[i]) << 5) | i;
	        }
	    }
	    return { b: b, r: r };
	};
	var _a = freb(fleb, 2), fl = _a.b, revfl = _a.r;
	// we can ignore the fact that the other numbers are wrong; they never happen anyway
	fl[28] = 258, revfl[258] = 28;
	var _b = freb(fdeb, 0), revfd = _b.r;
	// map of value to reverse (assuming 16 bits)
	var rev = new u16(32768);
	for (var i = 0; i < 32768; ++i) {
	    // reverse table algorithm from SO
	    var x = ((i & 0xAAAA) >> 1) | ((i & 0x5555) << 1);
	    x = ((x & 0xCCCC) >> 2) | ((x & 0x3333) << 2);
	    x = ((x & 0xF0F0) >> 4) | ((x & 0x0F0F) << 4);
	    rev[i] = (((x & 0xFF00) >> 8) | ((x & 0x00FF) << 8)) >> 1;
	}
	// create huffman tree from u8 "map": index -> code length for code index
	// mb (max bits) must be at most 15
	// TODO: optimize/split up?
	var hMap = (function (cd, mb, r) {
	    var s = cd.length;
	    // index
	    var i = 0;
	    // u16 "map": index -> # of codes with bit length = index
	    var l = new u16(mb);
	    // length of cd must be 288 (total # of codes)
	    for (; i < s; ++i) {
	        if (cd[i])
	            ++l[cd[i] - 1];
	    }
	    // u16 "map": index -> minimum code for bit length = index
	    var le = new u16(mb);
	    for (i = 1; i < mb; ++i) {
	        le[i] = (le[i - 1] + l[i - 1]) << 1;
	    }
	    var co;
	    if (r) {
	        // u16 "map": index -> number of actual bits, symbol for code
	        co = new u16(1 << mb);
	        // bits to remove for reverser
	        var rvb = 15 - mb;
	        for (i = 0; i < s; ++i) {
	            // ignore 0 lengths
	            if (cd[i]) {
	                // num encoding both symbol and bits read
	                var sv = (i << 4) | cd[i];
	                // free bits
	                var r_1 = mb - cd[i];
	                // start value
	                var v = le[cd[i] - 1]++ << r_1;
	                // m is end value
	                for (var m = v | ((1 << r_1) - 1); v <= m; ++v) {
	                    // every 16 bit value starting with the code yields the same result
	                    co[rev[v] >> rvb] = sv;
	                }
	            }
	        }
	    }
	    else {
	        co = new u16(s);
	        for (i = 0; i < s; ++i) {
	            if (cd[i]) {
	                co[i] = rev[le[cd[i] - 1]++] >> (15 - cd[i]);
	            }
	        }
	    }
	    return co;
	});
	// fixed length tree
	var flt = new u8(288);
	for (var i = 0; i < 144; ++i)
	    flt[i] = 8;
	for (var i = 144; i < 256; ++i)
	    flt[i] = 9;
	for (var i = 256; i < 280; ++i)
	    flt[i] = 7;
	for (var i = 280; i < 288; ++i)
	    flt[i] = 8;
	// fixed distance tree
	var fdt = new u8(32);
	for (var i = 0; i < 32; ++i)
	    fdt[i] = 5;
	// fixed length map
	var flm = /*#__PURE__*/ hMap(flt, 9, 0);
	// fixed distance map
	var fdm = /*#__PURE__*/ hMap(fdt, 5, 0);
	// get end of byte
	var shft = function (p) { return ((p + 7) / 8) | 0; };
	// typed array slice - allows garbage collector to free original reference,
	// while being more compatible than .slice
	var slc = function (v, s, e) {
	    if (s == null || s < 0)
	        s = 0;
	    if (e == null || e > v.length)
	        e = v.length;
	    // can't use .constructor in case user-supplied
	    return new u8(v.subarray(s, e));
	};
	// error codes
	var ec = [
	    'unexpected EOF',
	    'invalid block type',
	    'invalid length/literal',
	    'invalid distance',
	    'stream finished',
	    'no stream handler',
	    ,
	    'no callback',
	    'invalid UTF-8 data',
	    'extra field too long',
	    'date not in range 1980-2099',
	    'filename too long',
	    'stream finishing',
	    'invalid zip data'
	    // determined by unknown compression method
	];
	var err = function (ind, msg, nt) {
	    var e = new Error(msg || ec[ind]);
	    e.code = ind;
	    if (Error.captureStackTrace)
	        Error.captureStackTrace(e, err);
	    if (!nt)
	        throw e;
	    return e;
	};
	// starting at p, write the minimum number of bits that can hold v to d
	var wbits = function (d, p, v) {
	    v <<= p & 7;
	    var o = (p / 8) | 0;
	    d[o] |= v;
	    d[o + 1] |= v >> 8;
	};
	// starting at p, write the minimum number of bits (>8) that can hold v to d
	var wbits16 = function (d, p, v) {
	    v <<= p & 7;
	    var o = (p / 8) | 0;
	    d[o] |= v;
	    d[o + 1] |= v >> 8;
	    d[o + 2] |= v >> 16;
	};
	// creates code lengths from a frequency table
	var hTree = function (d, mb) {
	    // Need extra info to make a tree
	    var t = [];
	    for (var i = 0; i < d.length; ++i) {
	        if (d[i])
	            t.push({ s: i, f: d[i] });
	    }
	    var s = t.length;
	    var t2 = t.slice();
	    if (!s)
	        return { t: et, l: 0 };
	    if (s == 1) {
	        var v = new u8(t[0].s + 1);
	        v[t[0].s] = 1;
	        return { t: v, l: 1 };
	    }
	    t.sort(function (a, b) { return a.f - b.f; });
	    // after i2 reaches last ind, will be stopped
	    // freq must be greater than largest possible number of symbols
	    t.push({ s: -1, f: 25001 });
	    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
	    t[0] = { s: -1, f: l.f + r.f, l: l, r: r };
	    // efficient algorithm from UZIP.js
	    // i0 is lookbehind, i2 is lookahead - after processing two low-freq
	    // symbols that combined have high freq, will start processing i2 (high-freq,
	    // non-composite) symbols instead
	    // see https://reddit.com/r/photopea/comments/ikekht/uzipjs_questions/
	    while (i1 != s - 1) {
	        l = t[t[i0].f < t[i2].f ? i0++ : i2++];
	        r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
	        t[i1++] = { s: -1, f: l.f + r.f, l: l, r: r };
	    }
	    var maxSym = t2[0].s;
	    for (var i = 1; i < s; ++i) {
	        if (t2[i].s > maxSym)
	            maxSym = t2[i].s;
	    }
	    // code lengths
	    var tr = new u16(maxSym + 1);
	    // max bits in tree
	    var mbt = ln(t[i1 - 1], tr, 0);
	    if (mbt > mb) {
	        // more algorithms from UZIP.js
	        // TODO: find out how this code works (debt)
	        //  ind    debt
	        var i = 0, dt = 0;
	        //    left            cost
	        var lft = mbt - mb, cst = 1 << lft;
	        t2.sort(function (a, b) { return tr[b.s] - tr[a.s] || a.f - b.f; });
	        for (; i < s; ++i) {
	            var i2_1 = t2[i].s;
	            if (tr[i2_1] > mb) {
	                dt += cst - (1 << (mbt - tr[i2_1]));
	                tr[i2_1] = mb;
	            }
	            else
	                break;
	        }
	        dt >>= lft;
	        while (dt > 0) {
	            var i2_2 = t2[i].s;
	            if (tr[i2_2] < mb)
	                dt -= 1 << (mb - tr[i2_2]++ - 1);
	            else
	                ++i;
	        }
	        for (; i >= 0 && dt; --i) {
	            var i2_3 = t2[i].s;
	            if (tr[i2_3] == mb) {
	                --tr[i2_3];
	                ++dt;
	            }
	        }
	        mbt = mb;
	    }
	    return { t: new u8(tr), l: mbt };
	};
	// get the max length and assign length codes
	var ln = function (n, l, d) {
	    return n.s == -1
	        ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1))
	        : (l[n.s] = d);
	};
	// length codes generation
	var lc = function (c) {
	    var s = c.length;
	    // Note that the semicolon was intentional
	    while (s && !c[--s])
	        ;
	    var cl = new u16(++s);
	    //  ind      num         streak
	    var cli = 0, cln = c[0], cls = 1;
	    var w = function (v) { cl[cli++] = v; };
	    for (var i = 1; i <= s; ++i) {
	        if (c[i] == cln && i != s)
	            ++cls;
	        else {
	            if (!cln && cls > 2) {
	                for (; cls > 138; cls -= 138)
	                    w(32754);
	                if (cls > 2) {
	                    w(cls > 10 ? ((cls - 11) << 5) | 28690 : ((cls - 3) << 5) | 12305);
	                    cls = 0;
	                }
	            }
	            else if (cls > 3) {
	                w(cln), --cls;
	                for (; cls > 6; cls -= 6)
	                    w(8304);
	                if (cls > 2)
	                    w(((cls - 3) << 5) | 8208), cls = 0;
	            }
	            while (cls--)
	                w(cln);
	            cls = 1;
	            cln = c[i];
	        }
	    }
	    return { c: cl.subarray(0, cli), n: s };
	};
	// calculate the length of output from tree, code lengths
	var clen = function (cf, cl) {
	    var l = 0;
	    for (var i = 0; i < cl.length; ++i)
	        l += cf[i] * cl[i];
	    return l;
	};
	// writes a fixed block
	// returns the new bit pos
	var wfblk = function (out, pos, dat) {
	    // no need to write 00 as type: TypedArray defaults to 0
	    var s = dat.length;
	    var o = shft(pos + 2);
	    out[o] = s & 255;
	    out[o + 1] = s >> 8;
	    out[o + 2] = out[o] ^ 255;
	    out[o + 3] = out[o + 1] ^ 255;
	    for (var i = 0; i < s; ++i)
	        out[o + i + 4] = dat[i];
	    return (o + 4 + s) * 8;
	};
	// writes a block
	var wblk = function (dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
	    wbits(out, p++, final);
	    ++lf[256];
	    var _a = hTree(lf, 15), dlt = _a.t, mlb = _a.l;
	    var _b = hTree(df, 15), ddt = _b.t, mdb = _b.l;
	    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
	    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
	    var lcfreq = new u16(19);
	    for (var i = 0; i < lclt.length; ++i)
	        ++lcfreq[lclt[i] & 31];
	    for (var i = 0; i < lcdt.length; ++i)
	        ++lcfreq[lcdt[i] & 31];
	    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
	    var nlcc = 19;
	    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
	        ;
	    var flen = (bl + 5) << 3;
	    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
	    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
	    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
	        return wfblk(out, p, dat.subarray(bs, bs + bl));
	    var lm, ll, dm, dl;
	    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
	    if (dtlen < ftlen) {
	        lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
	        var llm = hMap(lct, mlcb, 0);
	        wbits(out, p, nlc - 257);
	        wbits(out, p + 5, ndc - 1);
	        wbits(out, p + 10, nlcc - 4);
	        p += 14;
	        for (var i = 0; i < nlcc; ++i)
	            wbits(out, p + 3 * i, lct[clim[i]]);
	        p += 3 * nlcc;
	        var lcts = [lclt, lcdt];
	        for (var it = 0; it < 2; ++it) {
	            var clct = lcts[it];
	            for (var i = 0; i < clct.length; ++i) {
	                var len = clct[i] & 31;
	                wbits(out, p, llm[len]), p += lct[len];
	                if (len > 15)
	                    wbits(out, p, (clct[i] >> 5) & 127), p += clct[i] >> 12;
	            }
	        }
	    }
	    else {
	        lm = flm, ll = flt, dm = fdm, dl = fdt;
	    }
	    for (var i = 0; i < li; ++i) {
	        var sym = syms[i];
	        if (sym > 255) {
	            var len = (sym >> 18) & 31;
	            wbits16(out, p, lm[len + 257]), p += ll[len + 257];
	            if (len > 7)
	                wbits(out, p, (sym >> 23) & 31), p += fleb[len];
	            var dst = sym & 31;
	            wbits16(out, p, dm[dst]), p += dl[dst];
	            if (dst > 3)
	                wbits16(out, p, (sym >> 5) & 8191), p += fdeb[dst];
	        }
	        else {
	            wbits16(out, p, lm[sym]), p += ll[sym];
	        }
	    }
	    wbits16(out, p, lm[256]);
	    return p + ll[256];
	};
	// deflate options (nice << 13) | chain
	var deo = /*#__PURE__*/ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
	// empty
	var et = /*#__PURE__*/ new u8(0);
	// compresses data into a raw DEFLATE buffer
	var dflt = function (dat, lvl, plvl, pre, post, st) {
	    var s = st.z || dat.length;
	    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7000)) + post);
	    // writing to this writes to the output buffer
	    var w = o.subarray(pre, o.length - post);
	    var lst = st.l;
	    var pos = (st.r || 0) & 7;
	    if (lvl) {
	        if (pos)
	            w[0] = st.r >> 3;
	        var opt = deo[lvl - 1];
	        var n = opt >> 13, c = opt & 8191;
	        var msk_1 = (1 << plvl) - 1;
	        //    prev 2-byte val map    curr 2-byte val map
	        var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
	        var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
	        var hsh = function (i) { return (dat[i] ^ (dat[i + 1] << bs1_1) ^ (dat[i + 2] << bs2_1)) & msk_1; };
	        // 24576 is an arbitrary number of maximum symbols per block
	        // 424 buffer for last block
	        var syms = new i32(25000);
	        // length/literal freq   distance freq
	        var lf = new u16(288), df = new u16(32);
	        //  l/lcnt  exbits  index          l/lind  waitdx          blkpos
	        var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
	        for (; i + 2 < s; ++i) {
	            // hash value
	            var hv = hsh(i);
	            // index mod 32768    previous index mod
	            var imod = i & 32767, pimod = head[hv];
	            prev[imod] = pimod;
	            head[hv] = imod;
	            // We always should modify head and prev, but only add symbols if
	            // this data is not yet processed ("wait" for wait index)
	            if (wi <= i) {
	                // bytes remaining
	                var rem = s - i;
	                if ((lc_1 > 7000 || li > 24576) && (rem > 423 || !lst)) {
	                    pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
	                    li = lc_1 = eb = 0, bs = i;
	                    for (var j = 0; j < 286; ++j)
	                        lf[j] = 0;
	                    for (var j = 0; j < 30; ++j)
	                        df[j] = 0;
	                }
	                //  len    dist   chain
	                var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
	                if (rem > 2 && hv == hsh(i - dif)) {
	                    var maxn = Math.min(n, rem) - 1;
	                    var maxd = Math.min(32767, i);
	                    // max possible length
	                    // not capped at dif because decompressors implement "rolling" index population
	                    var ml = Math.min(258, rem);
	                    while (dif <= maxd && --ch_1 && imod != pimod) {
	                        if (dat[i + l] == dat[i + l - dif]) {
	                            var nl = 0;
	                            for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
	                                ;
	                            if (nl > l) {
	                                l = nl, d = dif;
	                                // break out early when we reach "nice" (we are satisfied enough)
	                                if (nl > maxn)
	                                    break;
	                                // now, find the rarest 2-byte sequence within this
	                                // length of literals and search for that instead.
	                                // Much faster than just using the start
	                                var mmd = Math.min(dif, nl - 2);
	                                var md = 0;
	                                for (var j = 0; j < mmd; ++j) {
	                                    var ti = i - dif + j & 32767;
	                                    var pti = prev[ti];
	                                    var cd = ti - pti & 32767;
	                                    if (cd > md)
	                                        md = cd, pimod = ti;
	                                }
	                            }
	                        }
	                        // check the previous match
	                        imod = pimod, pimod = prev[imod];
	                        dif += imod - pimod & 32767;
	                    }
	                }
	                // d will be nonzero only when a match was found
	                if (d) {
	                    // store both dist and len data in one int32
	                    // Make sure this is recognized as a len/dist with 28th bit (2^28)
	                    syms[li++] = 268435456 | (revfl[l] << 18) | revfd[d];
	                    var lin = revfl[l] & 31, din = revfd[d] & 31;
	                    eb += fleb[lin] + fdeb[din];
	                    ++lf[257 + lin];
	                    ++df[din];
	                    wi = i + l;
	                    ++lc_1;
	                }
	                else {
	                    syms[li++] = dat[i];
	                    ++lf[dat[i]];
	                }
	            }
	        }
	        for (i = Math.max(i, wi); i < s; ++i) {
	            syms[li++] = dat[i];
	            ++lf[dat[i]];
	        }
	        pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
	        if (!lst) {
	            st.r = (pos & 7) | w[(pos / 8) | 0] << 3;
	            // shft(pos) now 1 less if pos & 7 != 0
	            pos -= 7;
	            st.h = head, st.p = prev, st.i = i, st.w = wi;
	        }
	    }
	    else {
	        for (var i = st.w || 0; i < s + lst; i += 65535) {
	            // end
	            var e = i + 65535;
	            if (e >= s) {
	                // write final block
	                w[(pos / 8) | 0] = lst;
	                e = s;
	            }
	            pos = wfblk(w, pos + 1, dat.subarray(i, e));
	        }
	        st.i = s;
	    }
	    return slc(o, 0, pre + shft(pos) + post);
	};
	// CRC32 table
	var crct = /*#__PURE__*/ (function () {
	    var t = new Int32Array(256);
	    for (var i = 0; i < 256; ++i) {
	        var c = i, k = 9;
	        while (--k)
	            c = ((c & 1) && -306674912) ^ (c >>> 1);
	        t[i] = c;
	    }
	    return t;
	})();
	// CRC32
	var crc = function () {
	    var c = -1;
	    return {
	        p: function (d) {
	            // closures have awful performance
	            var cr = c;
	            for (var i = 0; i < d.length; ++i)
	                cr = crct[(cr & 255) ^ d[i]] ^ (cr >>> 8);
	            c = cr;
	        },
	        d: function () { return ~c; }
	    };
	};
	// deflate with opts
	var dopt = function (dat, opt, pre, post, st) {
	    if (!st) {
	        st = { l: 1 };
	        if (opt.dictionary) {
	            var dict = opt.dictionary.subarray(-32768);
	            var newDat = new u8(dict.length + dat.length);
	            newDat.set(dict);
	            newDat.set(dat, dict.length);
	            dat = newDat;
	            st.w = dict.length;
	        }
	    }
	    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : (12 + opt.mem), pre, post, st);
	};
	// Walmart object spread
	var mrg = function (a, b) {
	    var o = {};
	    for (var k in a)
	        o[k] = a[k];
	    for (var k in b)
	        o[k] = b[k];
	    return o;
	};
	// write bytes
	var wbytes = function (d, b, v) {
	    for (; v; ++b)
	        d[b] = v, v >>>= 8;
	};
	/**
	 * Compresses data with DEFLATE without any wrapper
	 * @param data The data to compress
	 * @param opts The compression options
	 * @returns The deflated version of the data
	 */
	function deflateSync(data, opts) {
	    return dopt(data, opts || {}, 0, 0);
	}
	// flatten a directory structure
	var fltn = function (d, p, t, o) {
	    for (var k in d) {
	        var val = d[k], n = p + k, op = o;
	        if (Array.isArray(val))
	            op = mrg(o, val[1]), val = val[0];
	        if (val instanceof u8)
	            t[n] = [val, op];
	        else {
	            t[n += '/'] = [new u8(0), op];
	            fltn(val, n, t, o);
	        }
	    }
	};
	// text encoder
	var te = typeof TextEncoder != 'undefined' && /*#__PURE__*/ new TextEncoder();
	// text decoder
	var td = typeof TextDecoder != 'undefined' && /*#__PURE__*/ new TextDecoder();
	// text decoder stream
	var tds = 0;
	try {
	    td.decode(et, { stream: true });
	    tds = 1;
	}
	catch (e) { }
	/**
	 * Converts a string into a Uint8Array for use with compression/decompression methods
	 * @param str The string to encode
	 * @param latin1 Whether or not to interpret the data as Latin-1. This should
	 *               not need to be true unless decoding a binary string.
	 * @returns The string encoded in UTF-8/Latin-1 binary
	 */
	function strToU8(str, latin1) {
	    if (latin1) {
	        var ar_1 = new u8(str.length);
	        for (var i = 0; i < str.length; ++i)
	            ar_1[i] = str.charCodeAt(i);
	        return ar_1;
	    }
	    if (te)
	        return te.encode(str);
	    var l = str.length;
	    var ar = new u8(str.length + (str.length >> 1));
	    var ai = 0;
	    var w = function (v) { ar[ai++] = v; };
	    for (var i = 0; i < l; ++i) {
	        if (ai + 5 > ar.length) {
	            var n = new u8(ai + 8 + ((l - i) << 1));
	            n.set(ar);
	            ar = n;
	        }
	        var c = str.charCodeAt(i);
	        if (c < 128 || latin1)
	            w(c);
	        else if (c < 2048)
	            w(192 | (c >> 6)), w(128 | (c & 63));
	        else if (c > 55295 && c < 57344)
	            c = 65536 + (c & 1023 << 10) | (str.charCodeAt(++i) & 1023),
	                w(240 | (c >> 18)), w(128 | ((c >> 12) & 63)), w(128 | ((c >> 6) & 63)), w(128 | (c & 63));
	        else
	            w(224 | (c >> 12)), w(128 | ((c >> 6) & 63)), w(128 | (c & 63));
	    }
	    return slc(ar, 0, ai);
	}
	// extra field length
	var exfl = function (ex) {
	    var le = 0;
	    if (ex) {
	        for (var k in ex) {
	            var l = ex[k].length;
	            if (l > 65535)
	                err(9);
	            le += l + 4;
	        }
	    }
	    return le;
	};
	// write zip header
	var wzh = function (d, b, f, fn, u, c, ce, co) {
	    var fl = fn.length, ex = f.extra, col = co && co.length;
	    var exl = exfl(ex);
	    wbytes(d, b, ce != null ? 0x2014B50 : 0x4034B50), b += 4;
	    if (ce != null)
	        d[b++] = 20, d[b++] = f.os;
	    d[b] = 20, b += 2; // spec compliance? what's that?
	    d[b++] = (f.flag << 1) | (c < 0 && 8), d[b++] = u && 8;
	    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
	    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
	    if (y < 0 || y > 119)
	        err(10);
	    wbytes(d, b, (y << 25) | ((dt.getMonth() + 1) << 21) | (dt.getDate() << 16) | (dt.getHours() << 11) | (dt.getMinutes() << 5) | (dt.getSeconds() >> 1)), b += 4;
	    if (c != -1) {
	        wbytes(d, b, f.crc);
	        wbytes(d, b + 4, c < 0 ? -c - 2 : c);
	        wbytes(d, b + 8, f.size);
	    }
	    wbytes(d, b + 12, fl);
	    wbytes(d, b + 14, exl), b += 16;
	    if (ce != null) {
	        wbytes(d, b, col);
	        wbytes(d, b + 6, f.attrs);
	        wbytes(d, b + 10, ce), b += 14;
	    }
	    d.set(fn, b);
	    b += fl;
	    if (exl) {
	        for (var k in ex) {
	            var exf = ex[k], l = exf.length;
	            wbytes(d, b, +k);
	            wbytes(d, b + 2, l);
	            d.set(exf, b + 4), b += 4 + l;
	        }
	    }
	    if (col)
	        d.set(co, b), b += col;
	    return b;
	};
	// write zip footer (end of central directory)
	var wzf = function (o, b, c, d, e) {
	    wbytes(o, b, 0x6054B50); // skip disk
	    wbytes(o, b + 8, c);
	    wbytes(o, b + 10, c);
	    wbytes(o, b + 12, d);
	    wbytes(o, b + 16, e);
	};
	/**
	 * Synchronously creates a ZIP file. Prefer using `zip` for better performance
	 * with more than one file.
	 * @param data The directory structure for the ZIP archive
	 * @param opts The main options, merged with per-file options
	 * @returns The generated ZIP archive
	 */
	function zipSync(data, opts) {
	    if (!opts)
	        opts = {};
	    var r = {};
	    var files = [];
	    fltn(data, '', r, opts);
	    var o = 0;
	    var tot = 0;
	    for (var fn in r) {
	        var _a = r[fn], file = _a[0], p = _a[1];
	        var compression = p.level == 0 ? 0 : 8;
	        var f = strToU8(fn), s = f.length;
	        var com = p.comment, m = com && strToU8(com), ms = m && m.length;
	        var exl = exfl(p.extra);
	        if (s > 65535)
	            err(11);
	        var d = compression ? deflateSync(file, p) : file, l = d.length;
	        var c = crc();
	        c.p(file);
	        files.push(mrg(p, {
	            size: file.length,
	            crc: c.d(),
	            c: d,
	            f: f,
	            m: m,
	            u: s != fn.length || (m && (com.length != ms)),
	            o: o,
	            compression: compression
	        }));
	        o += 30 + s + exl + l;
	        tot += 76 + 2 * (s + exl) + (ms || 0) + l;
	    }
	    var out = new u8(tot + 22), oe = o, cdl = tot - o;
	    for (var i = 0; i < files.length; ++i) {
	        var f = files[i];
	        wzh(out, f.o, f, f.f, f.u, f.c.length);
	        var badd = 30 + f.f.length + exfl(f.extra);
	        out.set(f.c, f.o + badd);
	        wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
	    }
	    wzf(out, o, files.length, cdl, oe);
	    return out;
	}

	const ROOT_FILE_NAME = 'root';

	const header =
`#usda 1.0
(
    customLayerData = {
        string creator = "PlayCanvas UsdzExporter"
    }
    metersPerUnit = 1
    upAxis = "Y"
)
`	;

	const materialListTemplate = materials => `
def "Materials"
{
    ${materials.join('\n')}
}
`;

	const meshTemplate = (faceVertexCounts, indices, normals, positions, uv0, uv1) => `
def "Mesh"
{
    def Mesh "Mesh"
    {
        int[] faceVertexCounts = [${faceVertexCounts}]
        int[] faceVertexIndices = [${indices}]
        normal3f[] normals = [${normals}] (
            interpolation = "vertex"
        )
        point3f[] points = [${positions}]
        texCoord2f[] primvars:st = [${uv0}] (
            interpolation = "vertex"
        )
        texCoord2f[] primvars:st1 = [${uv1}] (
            interpolation = "vertex"
        )
        uniform token subdivisionScheme = "none"
    }
}
`;

	const meshInstanceTemplate = (nodeName, meshRefPath, worldMatrix, materialRefPath) => `
def Xform "${nodeName}" (
    prepend references = ${meshRefPath}
)
{
    matrix4d xformOp:transform = ${worldMatrix}
    uniform token[] xformOpOrder = ["xformOp:transform"]

    rel material:binding = ${materialRefPath}
}
`;

	const materialValueTemplate = (type, name, value) => `                    ${type} inputs:${name} = ${value}`;

	class UsdzExporter extends CoreExporter {
	    /**
	     * Maps a mesh to a reference (path) inside the usdz container
	     *
	     * @type {Map<Mesh, string>}
	     */
	    meshMap;

	    /**
	     * Maps a material to a reference (path) inside the usdz container
	     *
	     * @type {Map<Material, string>}
	     */
	    materialMap;

	    /**
	     * A list of generated material usda contents, which are processed at the end
	     */
	    materials;

	    /**
	     * A map of texture requests
	     *
	     * @type {Map<Texture, string>}
	     */
	    textureMap;

	    /**
	     * A set of used node names. Used in order to keep them unique.
	     *
	     * @type {Set<string>}
	     */
	    nodeNames;

	    /**
	     * An object, storing a mapping between the file name and its content. Used as input to fflate to
	     * zip up the data.
	     *
	     * @type {object}
	     */
	    files;

	    init() {
	        this.meshMap = new Map();
	        this.textureMap = new Map();
	        this.materialMap = new Map();
	        this.materials = [];
	        this.files = {};
	        this.nodeNames = new Set();
	    }

	    done() {
	        this.meshMap = null;
	        this.textureMap = null;
	        this.materialMap = null;
	        this.materials = null;
	        this.files = null;
	        this.nodeNames = null;
	    }

	    /**
	     * Converts a hierarchy of entities to USDZ format.
	     *
	     * @param {Entity} entity - The root of the entity hierarchy to convert.
	     * @param {object} options - Object for passing optional arguments.
	     * @param {number} [options.maxTextureSize] - Maximum texture size. Texture is resized if over the size.
	     * @returns {Promise<ArrayBuffer>} - The USDZ file content.
	     */
	    build(entity, options = {}) {

	        this.init();

	        // root file should be first in USDZ archive so reserve place here
	        this.addFile(null, ROOT_FILE_NAME);

	        // find all mesh instances
	        const allMeshInstances = [];
	        if (entity) {
	            const renders = entity.findComponents("render");
	            renders.forEach((render) => {
	                allMeshInstances.push(...render.meshInstances);
	            });
	        }

	        let rootContent = '';
	        allMeshInstances.forEach((meshInstance) => {
	            rootContent += this.buildMeshInstance(meshInstance);
	        });

	        // add materials
	        rootContent += materialListTemplate(this.materials);

	        // when the root file is populated, add its content
	        this.addFile(null, ROOT_FILE_NAME, '', rootContent);

	        // process requested textures
	        const textureOptions = {
	            maxTextureSize: options.maxTextureSize
	        };

	        const textureArray = Array.from(this.textureMap.keys());
	        const promises = [];
	        for (let i = 0; i < textureArray.length; i++) {
	            const mimeType = 'image/png' ;

	            // convert texture data to canvas
	            const texture = textureArray[i];
	            const texturePromise = this.textureToCanvas(texture, textureOptions).then((canvas) => {

	                // if texture format is supported
	                if (canvas) {

	                    // async convert them to blog and then to array buffer
	                    // eslint-disable-next-line no-promise-executor-return
	                    return new Promise(resolve => canvas.toBlob(resolve, mimeType, 1)).then(
	                        blob => blob.arrayBuffer()
	                    );
	                }

	                // ignore it if we cannot convert it
	                console.warn(`Export of texture ${texture.name} is not currently supported.`);

	                // eslint-disable-next-line no-promise-executor-return
	                return new Promise(resolve => resolve(null));
	            });
	            promises.push(texturePromise);
	        }

	        // when all textures are converted
	        const finalData = Promise.all(promises).then((values) => {

	            // add all textures as files
	            values.forEach((textureArrayBuffer, index) => {
	                const texture = textureArray[index];
	                const ids = this.getTextureFileIds(texture);
	                this.files[ids.fileName] = new Uint8Array(textureArrayBuffer);
	            });

	            // generate usdz
	            this.alignFiles();
	            const arraybuffer = zipSync(this.files, { level: 0 });

	            this.done();

	            return arraybuffer;
	        });

	        return finalData;
	    }

	    alignFiles() {

	        // 64 byte alignment
	        // https://github.com/101arrowz/fflate/issues/39#issuecomment-777263109
	        let offset = 0;
	        for (const filename in this.files) {

	            const file = this.files[filename];
	            const headerSize = 34 + filename.length;

	            offset += headerSize;
	            const offsetMod64 = offset & 63;

	            if (offsetMod64 !== 4) {

	                const padLength = 64 - offsetMod64;
	                const padding = new Uint8Array(padLength);

	                this.files[filename] = [file, { extra: { 12345: padding } }];
	            }
	            offset = file.length;
	        }
	    }

	    getFileIds(category, name, ref, extension = 'usda') {

	        // filename inside the zip archive
	        const fileName = (category ? `${category}/` : '') + `${name}.${extension}`;

	        // string representing a reference to the file and the refName object inside it
	        const refName = `@./${fileName}@</${ref}>`;

	        return { name, fileName, refName };
	    }

	    getTextureFileIds(texture) {
	        return this.getFileIds('texture', `Texture_${texture.id}`, 'Texture', 'png');
	    }

	    addFile(category, uniqueId, refName = '', content = null) {

	        // prepare the content with the header
	        let contentU8 = null;
	        if (content) {
	            content = header + '\n' + content;
	            contentU8 = strToU8(content);
	        }

	        const ids = this.getFileIds(category, uniqueId, refName);

	        // file
	        this.files[ids.fileName] = contentU8;

	        return ids.refName;
	    }

	    getMaterialRef(material) {

	        let materialRef = this.materialMap.get(material);
	        if (!materialRef) {
	            materialRef = this.buildMaterial(material);
	            this.materialMap.set(material, materialRef);
	        }

	        return materialRef;

	    }

	    getMeshRef(mesh) {

	        let meshRef = this.meshMap.get(mesh);
	        if (!meshRef) {
	            meshRef = this.buildMesh(mesh);
	            this.meshMap.set(mesh, meshRef);
	        }

	        return meshRef;
	    }

	    buildArray2(array) {
	        const components = [];
	        const count = array.length;
	        for (let i = 0; i < count; i += 2) {
	            components.push(`(${array[i]}, ${1 - array[i + 1]})`);
	        }
	        return components.join(', ');
	    }

	    buildArray3(array) {
	        const components = [];
	        const count = array.length;
	        for (let i = 0; i < count; i += 3) {
	            components.push(`(${array[i]}, ${array[i + 1]}, ${array[i + 2]})`);
	        }
	        return components.join(', ');
	    }

	    buildMat4(mat) {
	        const data = mat.data;
	        const vectors = [];
	        for (let i = 0; i < 16; i += 4) {
	            vectors.push(`(${data[i]}, ${data[i + 1]}, ${data[i + 2]}, ${data[i + 3]})`);
	        }
	        return `( ${vectors.join(', ')} )`;
	    }


	    // format: https://graphics.pixar.com/usd/release/spec_usdpreviewsurface.html
	    buildMaterial(material) {

	        const materialName = `Material_${material.id}`;
	        const materialPath = `/Materials/${materialName}`;
	        const materialPropertyPath = property => `<${materialPath}${property}>`;

	        const buildTexture = (texture, textureIds, mapType, uvChannel, tiling, offset, rotation, tintColor) => {

	            // TODO: texture transform values are passed in but do not work correctly in many cases

	            return `
                def Shader "Transform2d_${mapType}" (
                    sdrMetadata = {
                        string role = "math"
                    }
                )
                {
                    uniform token info:id = "UsdTransform2d"
                    float2 inputs:in.connect = ${materialPropertyPath(`/uvReader_${uvChannel}.outputs:result`)}
                    float inputs:rotation = ${rotation}
                    float2 inputs:scale = (${tiling.x}, ${tiling.y})
                    float2 inputs:translation = (${offset.x}, ${offset.y})
                    float2 outputs:result
                }

                def Shader "Texture_${texture.id}_${mapType}"
                {
                    uniform token info:id = "UsdUVTexture"
                    asset inputs:file = @${textureIds.fileName}@
                    float2 inputs:st.connect = ${materialPropertyPath(`/Transform2d_${mapType}.outputs:result`)}
                    token inputs:wrapS = "repeat"
                    token inputs:wrapT = "repeat"
                    float4 inputs:scale = (${tintColor.r}, ${tintColor.g}, ${tintColor.b}, ${tintColor.a})
                    float outputs:r
                    float outputs:g
                    float outputs:b
                    float3 outputs:rgb
                    float outputs:a
                }
            `;
	        };

	        const inputs = [];
	        const samplers = [];

	        const addTexture = (textureSlot, uniform, propType, propName, valueName, handleOpacity = false, tintTexture = false) => {

	            const texture = material[textureSlot];
	            if (texture) {

	                // add texture file
	                const textureIds = this.getTextureFileIds(texture);
	                this.textureMap.set(texture, textureIds.refName);

	                const channel = material[textureSlot + 'Channel'] || 'rgb';
	                const textureValue = materialPropertyPath(`/${textureIds.name}_${valueName}.outputs:${channel}`);
	                inputs.push(materialValueTemplate(propType, `${propName}.connect`, textureValue));

	                if (handleOpacity) {
	                    if (material.alphaTest > 0.0) ;
	                }

	                const tiling = material[textureSlot + 'Tiling'];
	                const offset = material[textureSlot + 'Offset'];
	                const rotation = material[textureSlot + 'Rotation'];

	                // which texture coordinate set to use
	                const uvChannel = material[textureSlot + 'Uv'] === 1 ? 'st1' : 'st';

	                // texture tint
	                const tintColor = tintTexture && uniform ? uniform : playcanvas.Color.WHITE;

	                samplers.push(buildTexture(texture, textureIds, valueName, uvChannel, tiling, offset, rotation, tintColor));

	            } else if (uniform) {

	                const value = propType === 'float' ? `${uniform}` : `(${uniform.r}, ${uniform.g}, ${uniform.b})`;
	                inputs.push(materialValueTemplate(propType, propName, value));
	            }
	        };

	        // add textures / material properties to the material
	        addTexture('diffuseMap', material.diffuse, 'color3f', 'diffuseColor', 'diffuse', false, true);
	        if (material.transparent || material.alphaTest > 0.0) {
	            addTexture('opacityMap', material.opacity, 'float', 'opacity', 'opacity', true);
	        }
	        addTexture('normalMap', null, 'normal3f', 'normal', 'normal');
	        addTexture('emissiveMap', material.emissive, 'color3f', 'emissiveColor', 'emissive', false, true);
	        addTexture('aoMap', null, 'float', 'occlusion', 'occlusion');
	        addTexture('metalnessMap', material.metalness, 'float', 'metallic', 'metallic');
	        addTexture('glossMap', material.gloss, 'float', 'roughness', 'roughness');

	        // main material object
	        const materialObject = `
            def Material "${materialName}"
            {
                def Shader "PreviewSurface"
                {
                    uniform token info:id = "UsdPreviewSurface"
${inputs.join('\n')}
                    int inputs:useSpecularWorkflow = 0
                    token outputs:surface
                }

                token outputs:surface.connect = ${materialPropertyPath('/PreviewSurface.outputs:surface')}

                def Shader "uvReader_st"
                {
                    uniform token info:id = "UsdPrimvarReader_float2"
                    token inputs:varname = "st"
                    float2 inputs:fallback = (0.0, 0.0)
                    float2 outputs:result
                }

                def Shader "uvReader_st1"
                {
                    uniform token info:id = "UsdPrimvarReader_float2"
                    token inputs:varname = "st1"
                    float2 inputs:fallback = (0.0, 0.0)
                    float2 outputs:result
                }

                ${samplers.join('\n')}
            }
        `;

	        this.materials.push(materialObject);

	        return materialPropertyPath('');
	    }

	    buildMesh(mesh) {

	        let positions = [];
	        const indices = [];
	        let normals = [];
	        let uv0 = [];
	        let uv1 = [];

	        mesh.getVertexStream(playcanvas.SEMANTIC_POSITION, positions);
	        mesh.getVertexStream(playcanvas.SEMANTIC_NORMAL, normals);
	        mesh.getVertexStream(playcanvas.SEMANTIC_TEXCOORD0, uv0);
	        mesh.getVertexStream(playcanvas.SEMANTIC_TEXCOORD1, uv1);
	        mesh.getIndices(indices);

	        // vertex counts for each faces (all are triangles)
	        const indicesCount = indices.length || positions.length;
	        const faceVertexCounts = Array(indicesCount / 3).fill(3).join(', ');

	        // face indices if no index buffer
	        if (!indices.length) {
	            for (let i = 0; i < indicesCount; i++)
	                indices[i] = i;
	        }

	        // missing normals or uvs
	        const numVerts = positions.length / 3;
	        normals = normals.length ? normals : Array(numVerts * 3).fill(0);
	        uv0 = uv0.length ? uv0 : Array(numVerts * 2).fill(0);
	        uv1 = uv1.length ? uv1 : Array(numVerts * 2).fill(0);

	        positions = this.buildArray3(positions);
	        normals = this.buildArray3(normals);
	        uv0 = this.buildArray2(uv0);
	        uv1 = this.buildArray2(uv1);
	        const meshObject = meshTemplate(faceVertexCounts, indices, normals, positions, uv0, uv1);

	        const refPath = this.addFile('mesh', `Mesh_${mesh.id}`, 'Mesh', meshObject);
	        return refPath;
	    }

	    buildMeshInstance(meshInstance) {

	        // build a mesh file, get back a reference path to it
	        const meshRefPath = this.getMeshRef(meshInstance.mesh);

	        // build a material file, get back a reference path to it
	        const materialRefPath = this.getMaterialRef(meshInstance.material);

	        // world matrix
	        const worldMatrix = this.buildMat4(meshInstance.node.getWorldTransform());

	        // sanitize node name
	        const name = meshInstance.node.name.replace(/[^a-z0-9]/gi, '_');

	        // make it unique
	        let nodeName = name;
	        while (this.nodeNames.has(nodeName)) {
	            nodeName = `${name}_${Math.random().toString(36).slice(2, 7)}`;
	        }
	        this.nodeNames.add(nodeName);

	        return meshInstanceTemplate(nodeName, meshRefPath, worldMatrix, materialRefPath);
	    }
	}

	const ARRAY_BUFFER = 34962;
	const ELEMENT_ARRAY_BUFFER = 34963;

	const getIndexComponentType = (indexFormat) => {
	    switch (indexFormat) {
	        case playcanvas.INDEXFORMAT_UINT8: return 5121;
	        case playcanvas.INDEXFORMAT_UINT16: return 5123;
	        case playcanvas.INDEXFORMAT_UINT32: return 5125;
	    }
	    return 0;
	};

	const getComponentType = (dataType) => {
	    switch (dataType) {
	        case playcanvas.TYPE_INT8: return 5120;
	        case playcanvas.TYPE_UINT8: return 5121;
	        case playcanvas.TYPE_INT16: return 5122;
	        case playcanvas.TYPE_UINT16: return 5123;
	        case playcanvas.TYPE_INT32: return 5124;
	        case playcanvas.TYPE_UINT32: return 5125;
	        case playcanvas.TYPE_FLOAT32: return 5126;
	    }
	    return 0;
	};

	const getAccessorType = (componentCount) => {
	    switch (componentCount) {
	        case 1: return 'SCALAR';
	        case 2: return 'VEC2';
	        case 3: return 'VEC3';
	        case 4: return 'VEC4';
	    }
	    return 0;
	};

	const getSemantic = (engineSemantic) => {
	    switch (engineSemantic) {
	        case playcanvas.SEMANTIC_POSITION: return 'POSITION';
	        case playcanvas.SEMANTIC_NORMAL: return 'NORMAL';
	        case playcanvas.SEMANTIC_TANGENT: return 'TANGENT';
	        case playcanvas.SEMANTIC_COLOR: return 'COLOR_0';
	        case playcanvas.SEMANTIC_BLENDINDICES: return 'JOINTS_0';
	        case playcanvas.SEMANTIC_BLENDWEIGHT: return 'WEIGHTS_0';
	        case playcanvas.SEMANTIC_TEXCOORD0: return 'TEXCOORD_0';
	        case playcanvas.SEMANTIC_TEXCOORD1: return 'TEXCOORD_1';
	        case playcanvas.SEMANTIC_TEXCOORD2: return 'TEXCOORD_2';
	        case playcanvas.SEMANTIC_TEXCOORD3: return 'TEXCOORD_3';
	        case playcanvas.SEMANTIC_TEXCOORD4: return 'TEXCOORD_4';
	        case playcanvas.SEMANTIC_TEXCOORD5: return 'TEXCOORD_5';
	        case playcanvas.SEMANTIC_TEXCOORD6: return 'TEXCOORD_6';
	        case playcanvas.SEMANTIC_TEXCOORD7: return 'TEXCOORD_7';
	    }
	};

	const getFilter = function (filter) {
	    switch (filter) {
	        case playcanvas.FILTER_NEAREST: return 9728;
	        case playcanvas.FILTER_LINEAR: return 9729;
	        case playcanvas.FILTER_NEAREST_MIPMAP_NEAREST: return 9984;
	        case playcanvas.FILTER_LINEAR_MIPMAP_NEAREST: return 9985;
	        case playcanvas.FILTER_NEAREST_MIPMAP_LINEAR: return 9986;
	        case playcanvas.FILTER_LINEAR_MIPMAP_LINEAR: return 9987;
	    }
	};

	const getWrap = function (wrap) {
	    switch (wrap) {
	        case playcanvas.ADDRESS_CLAMP_TO_EDGE: return 33071;
	        case playcanvas.ADDRESS_MIRRORED_REPEAT: return 33648;
	        case playcanvas.ADDRESS_REPEAT: return 10497;
	    }
	};

	function isCanvasTransparent(canvas) {
	    const context = canvas.getContext('2d');
	    const pixelData = context.getImageData(0, 0, canvas.width, canvas.height).data;

	    for (let i = 3; i < pixelData.length; i += 4) {
	        if (pixelData[i] < 255) {
	            return true;
	        }
	    }

	    return false;
	}

	// supported texture semantics on a material
	const textureSemantics = [
	    'diffuseMap',
	    'colorMap',
	    'normalMap',
	    'metalnessMap',
	    'emissiveMap'
	];

	class GltfExporter extends CoreExporter {
	    collectResources(root) {
	        const resources = {
	            buffers: [],
	            cameras: [],
	            entities: [],
	            materials: [],
	            textures: [],

	            // entry: { node, meshInstances}
	            entityMeshInstances: [],

	            // maps a buffer (vertex or index) to an array of bufferview indices
	            bufferViewMap: new Map(),

	            compressableTexture: new Set()
	        };

	        const { materials, buffers, entityMeshInstances, textures } = resources;

	        // Collect entities
	        root.forEach((entity) => {
	            resources.entities.push(entity);
	        });

	        const collectMeshInstances = (meshInstances) => {
	            meshInstances.forEach((meshInstance) => {

	                // Collect material
	                const material = meshInstance.material;
	                if (materials.indexOf(material) < 0) {
	                    resources.materials.push(material);

	                    // collect textures
	                    textureSemantics.forEach((semantic) => {
	                        const texture = material[semantic];
	                        if (texture && textures.indexOf(texture) < 0) {
	                            // NOTE: don't store normal maps as jpeg,
	                            // because of the way they are sampled, they don't compress well
	                            if (semantic !== 'normalMap') {
	                                resources.compressableTexture.add(texture);
	                            }

	                            textures.push(texture);
	                        }
	                    });
	                }

	                // collect mesh instances per node
	                const node = meshInstance.node;
	                let nodeMeshInstances = entityMeshInstances.find(e => e.node === node);
	                if (!nodeMeshInstances) {
	                    nodeMeshInstances = { node: node, meshInstances: [] };
	                    entityMeshInstances.push(nodeMeshInstances);
	                }
	                nodeMeshInstances.meshInstances.push(meshInstance);

	                // Collect buffers
	                const mesh = meshInstance.mesh;
	                const vertexBuffer = mesh.vertexBuffer;
	                if (buffers.indexOf(vertexBuffer) < 0) {
	                    buffers.unshift(vertexBuffer);
	                }

	                const indexBuffer = mesh.indexBuffer[0];
	                if (buffers.indexOf(indexBuffer) < 0) {
	                    buffers.push(indexBuffer);
	                }
	            });
	        };

	        resources.entities.forEach((entity) => {
	            if (entity.camera) {
	                resources.cameras.push(entity.camera);
	            }

	            if (entity.render && entity.render.enabled) {
	                collectMeshInstances(entity.render.meshInstances);
	            }

	            if (entity.model && entity.model.enabled && entity.model.meshInstances) {
	                collectMeshInstances(entity.model.meshInstances);
	            }
	        });

	        return resources;
	    }

	    writeBufferViews(resources, json) {
	        json.bufferViews = [];

	        for (const buffer of resources.buffers) {
	            GltfExporter.writeBufferView(resources, json, buffer);
	        }
	    }

	    static writeBufferView(resources, json, buffer) {
	        // NOTE: right now we only use one buffer per gltf file
	        json.buffers = json.buffers ?? [];

	        json.buffers[0] = json.buffers[0] ?? { byteLength: 0 };
	        const bufferInfo = json.buffers[0];

	        // To be sure that the buffer is aligned to 4 bytes
	        // so that it can be read as a Uint32Array or Float32Array
	        bufferInfo.byteLength = playcanvas.math.roundUp(bufferInfo.byteLength, 4);
	        const offset = bufferInfo.byteLength;

	        // FIXME: don't create the function every time
	        const addBufferView = (target, byteLength, byteOffset, byteStride) => {

	            const bufferView = {
	                target: target,
	                buffer: 0,
	                byteLength: byteLength,
	                byteOffset: byteOffset,
	                byteStride: byteStride
	            };

	            return json.bufferViews.push(bufferView) - 1;
	        };

	        let arrayBuffer;
	        if (buffer instanceof playcanvas.VertexBuffer) {
	            arrayBuffer = buffer.lock();

	            const format = buffer.getFormat();
	            if (format.interleaved) {

	                const bufferViewIndex = addBufferView(ARRAY_BUFFER, arrayBuffer.byteLength, offset, format.size);
	                resources.bufferViewMap.set(buffer, [bufferViewIndex]);

	            } else {

	                // generate buffer view per element
	                const bufferViewIndices = [];
	                for (const element of format.elements) {

	                    const bufferViewIndex = addBufferView(
	                        ARRAY_BUFFER,
	                        element.size * format.vertexCount,
	                        offset + element.offset,
	                        element.size
	                    );
	                    bufferViewIndices.push(bufferViewIndex);

	                }

	                resources.bufferViewMap.set(buffer, bufferViewIndices);
	            }

	        } else if (buffer instanceof playcanvas.IndexBuffer) {    // index buffer
	            arrayBuffer = buffer.lock();

	            const bufferViewIndex = addBufferView(ARRAY_BUFFER, arrayBuffer.byteLength, offset);
	            resources.bufferViewMap.set(buffer, [bufferViewIndex]);

	        } else {
	            // buffer is an array buffer
	            arrayBuffer = buffer;

	            const bufferViewIndex = addBufferView(ELEMENT_ARRAY_BUFFER, arrayBuffer.byteLength, offset);
	            resources.bufferViewMap.set(buffer, [bufferViewIndex]);

	        }

	        // increment buffer by the size of the array buffer to allocate buffer with enough space
	        bufferInfo.byteLength += arrayBuffer.byteLength;
	    }

	    writeCameras(resources, json) {
	        if (resources.cameras.length > 0) {
	            json.cameras = resources.cameras.map((cam) => {
	                const projection = cam.projection;
	                const nearClip = cam.nearClip;
	                const farClip = cam.farClip;

	                const camera = {};

	                if (projection === playcanvas.PROJECTION_ORTHOGRAPHIC) {
	                    camera.type = 'orthographic';
	                    camera.orthographic = {
	                        xmag: 1,
	                        ymag: 1,
	                        znear: nearClip,
	                        zfar: farClip
	                    };
	                } else {
	                    const fov = cam.fov;

	                    camera.type = 'perspective';
	                    camera.perspective = {
	                        yfov: fov * Math.PI / 180,
	                        znear: nearClip,
	                        zfar: farClip
	                    };
	                }

	                return camera;
	            });
	        }
	    }

	    attachTexture(resources, material, destination, name, textureSemantic, json) {
	        const texture = material[textureSemantic];

	        if (texture) {
	            const textureIndex = resources.textures.indexOf(texture);
	            if (textureIndex < 0) console.logWarn(`Texture ${texture.name} wasn't collected.`);
	            destination[name] = {
	                index: textureIndex
	            };

	            const scale = material[`${textureSemantic}Tiling`];
	            const offset = material[`${textureSemantic}Offset`];
	            const rotation = material[`${textureSemantic}Rotation`];

	            if ((scale && !scale.equals(playcanvas.Vec2.ONE)) || (offset && !offset.equals(playcanvas.Vec2.ZERO)) || rotation !== 0) {
	                destination[name].extensions = {
	                    KHR_texture_transform: {}
	                };

	                json.extensionsUsed = json.extensionsUsed ?? [];
	                if (json.extensionsUsed.indexOf('KHR_texture_transform') < 0) {
	                    json.extensionsUsed.push('KHR_texture_transform');
	                }

	                json.extensionsRequired = json.extensionsRequired ?? [];
	                if (json.extensionsRequired.indexOf('KHR_texture_transform') < 0) {
	                    json.extensionsRequired.push('KHR_texture_transform');
	                }

	                if (scale && !scale.equals(playcanvas.Vec2.ONE)) {
	                    destination[name].extensions.KHR_texture_transform.scale = [scale.x, scale.y];
	                }

	                if (offset && !offset.equals(playcanvas.Vec2.ZERO)) {
	                    destination[name].extensions.KHR_texture_transform.offset = [offset.x, offset.y - 1 + scale.y];
	                }

	                if (rotation !== 0) {
	                    destination[name].extensions.KHR_texture_transform.rotation = rotation * playcanvas.math.DEG_TO_RAD;
	                }
	            }
	        }
	    }

	    writeStandardMaterial(resources, mat, output, json) {

	        const { diffuse, emissive, opacity, metalness, gloss, glossInvert } = mat;
	        const pbr = output.pbrMetallicRoughness;

	        if (!diffuse.equals(playcanvas.Color.WHITE) || opacity !== 1) {
	            pbr.baseColorFactor = [diffuse.r, diffuse.g, diffuse.b, opacity];
	        }

	        if (metalness !== 1) {
	            pbr.metallicFactor = metalness;
	        }

	        const roughness = glossInvert ? gloss : 1 - gloss;
	        if (roughness !== 1) {
	            pbr.roughnessFactor = roughness;
	        }

	        this.attachTexture(resources, mat, pbr, 'baseColorTexture', 'diffuseMap', json);
	        this.attachTexture(resources, mat, pbr, 'metallicRoughnessTexture', 'metalnessMap', json);

	        if (!emissive.equals(playcanvas.Color.BLACK)) {
	            output.emissiveFactor = [emissive.r, emissive.g, emissive.b];
	        }
	    }

	    writeBasicMaterial(resources, mat, output, json) {

	        const { color } = mat;
	        const pbr = output.pbrMetallicRoughness;

	        if (!color.equals(playcanvas.Color.WHITE)) {
	            pbr.baseColorFactor = [color.r, color.g, color.b, color];
	        }

	        this.attachTexture(resources, mat, pbr, 'baseColorTexture', 'colorMap', json);
	    }

	    writeMaterials(resources, json) {

	        if (resources.materials.length > 0) {
	            json.materials = resources.materials.map((mat) => {
	                const { name, blendType, cull, alphaTest } = mat;
	                const material = {
	                    pbrMetallicRoughness: {}
	                };

	                if (name && name.length > 0) {
	                    material.name = name;
	                }

	                if (mat instanceof playcanvas.StandardMaterial) {
	                    this.writeStandardMaterial(resources, mat, material, json);
	                }

	                if (mat instanceof playcanvas.BasicMaterial) {
	                    this.writeBasicMaterial(resources, mat, material, json);
	                }

	                if (blendType === playcanvas.BLEND_NORMAL) {
	                    material.alphaMode = 'BLEND';
	                } else if (blendType === playcanvas.BLEND_NONE) {
	                    if (alphaTest !== 0) {
	                        material.alphaMode = 'MASK';
	                        material.alphaCutoff = alphaTest;
	                    }
	                }

	                if (cull === playcanvas.CULLFACE_NONE) {
	                    material.doubleSided = true;
	                }

	                this.attachTexture(resources, mat, material, 'normalTexture', 'normalMap', json);
	                this.attachTexture(resources, mat, material, 'occlusionTexture', 'aoMap', json);
	                this.attachTexture(resources, mat, material, 'emissiveTexture', 'emissiveMap', json);

	                return material;
	            });
	        }
	    }

	    writeNodes(resources, json) {
	        if (resources.entities.length > 0) {
	            json.nodes = resources.entities.map((entity) => {
	                const name = entity.name;
	                const t = entity.getLocalPosition();
	                const r = entity.getLocalRotation();
	                const s = entity.getLocalScale();

	                const node = {};

	                if (name && name.length > 0) {
	                    node.name = name;
	                }

	                if (!t.equals(playcanvas.Vec3.ZERO)) {
	                    node.translation = [t.x, t.y, t.z];
	                }

	                if (!r.equals(playcanvas.Quat.IDENTITY)) {
	                    node.rotation = [r.x, r.y, r.z, r.w];
	                }

	                if (!s.equals(playcanvas.Vec3.ONE)) {
	                    node.scale = [s.x, s.y, s.z];
	                }

	                if (entity.camera && entity.camera.enabled) {
	                    node.camera = resources.cameras.indexOf(entity.camera);
	                }

	                const entityMeshInstance = resources.entityMeshInstances.find(e => e.node === entity);
	                if (entityMeshInstance) {
	                    node.mesh = resources.entityMeshInstances.indexOf(entityMeshInstance);
	                }

	                if (entity.children.length > 0) {
	                    node.children = [];

	                    entity.children.forEach((child) => {
	                        node.children.push(resources.entities.indexOf(child));
	                    });
	                }

	                return node;
	            });
	        }
	    }

	    writeMeshes(resources, json) {
	        if (resources.entityMeshInstances.length > 0) {
	            json.accessors = [];
	            json.meshes = [];

	            resources.entityMeshInstances.forEach((entityMeshInstances) => {

	                const mesh = {
	                    primitives: []
	                };

	                // all mesh instances of a single node are stores as a single gltf mesh with multiple primitives
	                const meshInstances = entityMeshInstances.meshInstances;
	                meshInstances.forEach((meshInstance) => {
	                    const primitive = GltfExporter.createPrimitive(resources, json, meshInstance.mesh);

	                    primitive.material = resources.materials.indexOf(meshInstance.material);

	                    mesh.primitives.push(primitive);
	                });

	                json.meshes.push(mesh);
	            });
	        }
	    }

	    static createPrimitive(resources, json, mesh) {
	        const primitive = {
	            attributes: {}
	        };

	        // vertex buffer
	        const { vertexBuffer } = mesh;
	        const { format } = vertexBuffer;
	        const { interleaved, elements } = format;
	        const numVertices = vertexBuffer.getNumVertices();
	        elements.forEach((element, elementIndex) => {

	            let bufferView = resources.bufferViewMap.get(vertexBuffer);
	            if (!bufferView) {
	                GltfExporter.writeBufferView(resources, json, vertexBuffer);
	                resources.buffers.push(vertexBuffer);

	                bufferView = resources.bufferViewMap.get(vertexBuffer);
	            }
	            const viewIndex = bufferView[interleaved ? 0 : elementIndex];

	            const accessor = {
	                bufferView: viewIndex,
	                byteOffset: interleaved ? element.offset : 0,
	                componentType: getComponentType(element.dataType),
	                type: getAccessorType(element.numComponents),
	                count: numVertices
	            };

	            const idx = json.accessors.push(accessor) - 1;
	            primitive.attributes[getSemantic(element.name)] = idx;

	            // Position accessor also requires min and max properties
	            if (element.name === playcanvas.SEMANTIC_POSITION) {

	                // compute min and max from positions, as the BoundingBox stores center and extents,
	                // and we get precision warnings from gltf validator
	                const positions = [];
	                mesh.getPositions(positions);
	                const min = new playcanvas.Vec3();
	                const max = new playcanvas.Vec3();
	                playcanvas.BoundingBox.computeMinMax(positions, min, max);

	                accessor.min = [min.x, min.y, min.z];
	                accessor.max = [max.x, max.y, max.z];
	            }
	        });

	        // index buffer
	        const indexBuffer = mesh.indexBuffer[0];
	        if (indexBuffer) {
	            let bufferView = resources.bufferViewMap.get(indexBuffer);
	            if (!bufferView) {
	                GltfExporter.writeBufferView(resources, json, indexBuffer);
	                resources.buffers.push(indexBuffer);

	                bufferView = resources.bufferViewMap.get(indexBuffer);
	            }
	            const viewIndex = bufferView[0];

	            const accessor = {
	                bufferView: viewIndex,
	                componentType: getIndexComponentType(indexBuffer.getFormat()),
	                count: indexBuffer.getNumIndices(),
	                type: 'SCALAR'
	            };

	            const idx = json.accessors.push(accessor) - 1;
	            primitive.indices = idx;
	        }

	        return primitive;
	    }

	    convertTextures(srcTextures, options) {

	        const textureOptions = {
	            maxTextureSize: options.maxTextureSize
	        };

	        const promises = [];
	        srcTextures.forEach((srcTexture) => {
	            const promise = this.textureToCanvas(srcTexture, textureOptions);
	            promise.then((canvas) => {
	                // eslint-disable-next-line no-promise-executor-return
	                return new Promise(resolve => resolve(canvas));
	            });
	            promises.push(promise);
	        });
	        return promises;
	    }

	    writeTextures(resources, textureCanvases, json, options) {
	        const textures = resources.textures;

	        const promises = [];

	        for (let i = 0; i < textureCanvases.length; i++) {

	            // convert texture data to uri
	            const texture = textures[i];
	            const canvas = textureCanvases[i];

	            const isRGBA = isCanvasTransparent(canvas) || !resources.compressableTexture.has(texture);
	            const mimeType = isRGBA ? 'image/png' : 'image/jpeg';

	            promises.push(
	                this.getBlob(canvas, mimeType)
	                    .then((blob) => {
	                        const reader = new FileReader();
	                        reader.readAsArrayBuffer(blob);

	                        return new Promise((resolve) => {
	                            reader.onloadend = () => {
	                                resolve(reader);
	                            };
	                        });
	                    })
	                    .then((reader) => {
	                        const buffer = this.getPaddedArrayBuffer(reader.result);

	                        GltfExporter.writeBufferView(resources, json, buffer);
	                        resources.buffers.push(buffer);

	                        const bufferView = resources.bufferViewMap.get(buffer);

	                        json.images[i] = {
	                            mimeType: mimeType,
	                            bufferView: bufferView[0]
	                        };

	                        json.samplers[i] = {
	                            minFilter: getFilter(texture.minFilter),
	                            magFilter: getFilter(texture.magFilter),
	                            wrapS: getWrap(texture.addressU),
	                            wrapT: getWrap(texture.addressV)
	                        };

	                        json.textures[i] = {
	                            sampler: i,
	                            source: i
	                        };
	                    })
	            );
	        }

	        return Promise.all(promises);
	    }

	    getBlob(canvas, mimeType) {
	        if (canvas.toBlob !== undefined) {
	            return new Promise((resolve) => {
	                canvas.toBlob(resolve, mimeType);
	            });
	        }

	        let quality = 1.0;
	        if (mimeType === 'image/jpeg') {
	            quality = 0.92;
	        }

	        return canvas.convertToBlob({
	            type: mimeType,
	            quality: quality
	        });
	    }

	    getPaddedArrayBuffer(arrayBuffer, paddingByte = 0) {
	        const paddedLength = playcanvas.math.roundUp(arrayBuffer.byteLength, 4);
	        if (paddedLength !== arrayBuffer.byteLength) {
	            const array = new Uint8Array(paddedLength);
	            array.set(new Uint8Array(arrayBuffer));
	            if (paddingByte !== 0) {
	                for (let i = arrayBuffer.byteLength; i < paddedLength; i++) {
	                    array[i] = paddingByte;
	                }
	            }
	            return array.buffer;
	        }
	        return arrayBuffer;
	    }

	    buildJson(resources, options) {

	        const promises = this.convertTextures(resources.textures, options);
	        return Promise.all(promises).then(async (textureCanvases) => {

	            const json = {
	                asset: {
	                    version: '2.0',
	                    generator: 'PlayCanvas GltfExporter'
	                },
	                scenes: [
	                    {
	                        nodes: [
	                            0
	                        ]
	                    }
	                ],
	                images: [
	                ],
	                samplers: [
	                ],
	                textures: [
	                ],
	                scene: 0
	            };

	            this.writeBufferViews(resources, json);
	            this.writeCameras(resources, json);
	            this.writeMeshes(resources, json);
	            this.writeMaterials(resources, json);
	            this.writeNodes(resources, json, options);
	            await this.writeTextures(resources, textureCanvases, json, options);

	            // delete unused properties
	            if (!json.images.length) delete json.images;
	            if (!json.samplers.length) delete json.samplers;
	            if (!json.textures.length) delete json.textures;

	            return json;
	        });
	    }

	    /**
	     * Converts a hierarchy of entities to GLB format.
	     *
	     * @param {Entity} entity - The root of the entity hierarchy to convert.
	     * @param {object} options - Object for passing optional arguments.
	     * @param {number} [options.maxTextureSize] - Maximum texture size. Texture is resized if over the size.
	     * @returns {Promise<ArrayBuffer>} - The GLB file content.
	     */
	    build(entity, options = {}) {
	        const resources = this.collectResources(entity);

	        return this.buildJson(resources, options).then((json) => {

	            const jsonText = JSON.stringify(json);

	            const headerLength = 12;

	            const jsonHeaderLength = 8;
	            const jsonDataLength = jsonText.length;
	            const jsonPaddingLength = (4 - (jsonDataLength & 3)) & 3;

	            const binaryHeaderLength = 8;
	            const binaryDataLength = json.buffers.reduce(
	                (total, buffer) => playcanvas.math.roundUp(total + buffer.byteLength, 4),
	                0
	            );

	            let totalLength = headerLength + jsonHeaderLength + jsonDataLength + jsonPaddingLength;
	            if (binaryDataLength > 0) {
	                totalLength += binaryHeaderLength + binaryDataLength;
	            }

	            const glbBuffer = new ArrayBuffer(totalLength);
	            const glbView = new DataView(glbBuffer);

	            // GLB header
	            glbView.setUint32(0, 0x46546C67, true);
	            glbView.setUint32(4, 2, true);
	            glbView.setUint32(8, totalLength, true);

	            // JSON chunk header
	            glbView.setUint32(12, jsonDataLength + jsonPaddingLength, true);
	            glbView.setUint32(16, 0x4E4F534A, true);

	            let offset = headerLength + jsonHeaderLength;

	            // JSON data
	            for (let i = 0; i < jsonDataLength; i++) {
	                glbView.setUint8(offset + i, jsonText.charCodeAt(i));
	            }

	            offset += jsonDataLength;

	            for (let i = 0; i < jsonPaddingLength; i++) {
	                glbView.setUint8(offset + i, 0x20);
	            }

	            offset += jsonPaddingLength;

	            if (binaryDataLength > 0) {
	                // Binary chunk header
	                glbView.setUint32(offset, binaryDataLength, true);
	                glbView.setUint32(offset + 4, 0x004E4942, true);

	                offset += binaryHeaderLength;

	                resources.buffers.forEach((buffer) => {
	                    let src;

	                    const bufferViewId = resources.bufferViewMap.get(buffer)[0];

	                    const bufferOffset = json.bufferViews[bufferViewId].byteOffset;

	                    if (buffer instanceof ArrayBuffer) {
	                        src = new Uint8Array(buffer);
	                    } else {
	                        const srcBuffer = buffer.lock();
	                        if (srcBuffer instanceof ArrayBuffer) {
	                            src = new Uint8Array(srcBuffer);
	                        } else {
	                            src = new Uint8Array(srcBuffer.buffer, srcBuffer.byteOffset, srcBuffer.byteLength);
	                        }
	                    }
	                    const dst = new Uint8Array(glbBuffer, offset + bufferOffset, src.byteLength);
	                    dst.set(src);
	                });
	            }

	            return Promise.resolve(glbBuffer);
	        });
	    }
	}

	const splatCoreVS = `
    attribute vec3 vertex_position;

    uniform mat4 matrix_model;
    uniform mat4 matrix_view;
    uniform mat4 matrix_projection;
    uniform mat4 matrix_viewProjection;

    uniform vec2 viewport;

    varying vec2 texCoord;
    varying vec4 color;

    mat3 quatToMat3(vec3 R)
    {
        float x = R.x;
        float y = R.y;
        float z = R.z;
        float w = sqrt(1.0 - dot(R, R));

        return mat3(
            1.0 - 2.0 * (z * z + w * w),
                2.0 * (y * z + x * w),
                2.0 * (y * w - x * z),

                2.0 * (y * z - x * w),
            1.0 - 2.0 * (y * y + w * w),
                2.0 * (z * w + x * y),

                2.0 * (y * w + x * z),
                2.0 * (z * w - x * y),
            1.0 - 2.0 * (y * y + z * z)
        );
    }

    uniform vec4 tex_params;
    uniform sampler2D splatColor;
    uniform highp sampler2D splatScale;
    uniform highp sampler2D splatRotation;
    uniform highp sampler2D splatCenter;

    #ifdef INT_INDICES

        attribute uint vertex_id;
        ivec2 dataUV;
        void evalDataUV() {

            // turn vertex_id into int grid coordinates
            ivec2 textureSize = ivec2(tex_params.xy);
            vec2 invTextureSize = tex_params.zw;

            int gridV = int(float(vertex_id) * invTextureSize.x);
            int gridU = int(vertex_id) - gridV * textureSize.x;
            dataUV = ivec2(gridU, gridV);
        }

        vec4 getColor() {
            return texelFetch(splatColor, dataUV, 0);
        }

        vec3 getScale() {
            return texelFetch(splatScale, dataUV, 0).xyz;
        }

        vec3 getRotation() {
            return texelFetch(splatRotation, dataUV, 0).xyz;
        }

        vec3 getCenter() {
            return texelFetch(splatCenter, dataUV, 0).xyz;
        }

    #else

        // TODO: use texture2DLodEXT on WebGL

        attribute float vertex_id;
        vec2 dataUV;
        void evalDataUV() {
            vec2 textureSize = tex_params.xy;
            vec2 invTextureSize = tex_params.zw;

            // turn vertex_id into int grid coordinates
            float gridV = floor(vertex_id * invTextureSize.x);
            float gridU = vertex_id - (gridV * textureSize.x);

            // convert grid coordinates to uv coordinates with half pixel offset
            dataUV = vec2(gridU, gridV) * invTextureSize + (0.5 * invTextureSize);
        }

        vec4 getColor() {
            return texture2D(splatColor, dataUV);
        }

        vec3 getScale() {
            return texture2D(splatScale, dataUV).xyz;
        }

        vec3 getRotation() {
            return texture2D(splatRotation, dataUV).xyz;
        }

        vec3 getCenter() {
            return texture2D(splatCenter, dataUV).xyz;
        }

    #endif

    void computeCov3d(in mat3 rot, in vec3 scale, out vec3 covA, out vec3 covB)
    {
        // M = S * R
        float M0 = scale.x * rot[0][0];
        float M1 = scale.x * rot[0][1];
        float M2 = scale.x * rot[0][2];
        float M3 = scale.y * rot[1][0];
        float M4 = scale.y * rot[1][1];
        float M5 = scale.y * rot[1][2];
        float M6 = scale.z * rot[2][0];
        float M7 = scale.z * rot[2][1];
        float M8 = scale.z * rot[2][2];

        covA = vec3(
            M0 * M0 + M3 * M3 + M6 * M6,
            M0 * M1 + M3 * M4 + M6 * M7,
            M0 * M2 + M3 * M5 + M6 * M8
        );

        covB = vec3(
            M1 * M1 + M4 * M4 + M7 * M7,
            M1 * M2 + M4 * M5 + M7 * M8,
            M2 * M2 + M5 * M5 + M8 * M8
        );
    }

    vec3 evalCenter() {
        evalDataUV();
        return getCenter();
    }

    #ifndef GL2
    #ifndef WEBGPU
    mat3 transpose(in mat3 m) {
        return mat3(
            m[0].x, m[1].x, m[2].x,
            m[0].y, m[1].y, m[2].y,
            m[0].z, m[1].z, m[2].z
        );
    }
    #endif
    #endif

    vec4 evalSplat(vec4 centerWorld)
    {
        vec4 splat_cam = matrix_view * centerWorld;
        vec4 splat_proj = matrix_projection * splat_cam;

        // cull behind camera
        if (splat_proj.z < -splat_proj.w) {
            return vec4(0.0, 0.0, 2.0, 1.0);
        }

        vec3 scale = getScale();
        vec3 rotation = getRotation();

        color = getColor();

        #ifdef DEBUG_RENDER
            vec3 local = quatToMat3(rotation) * (vertex_position * scale * 2.0) + center;
            return matrix_viewProjection * matrix_model * vec4(local, 1.0);
        #else
            vec3 splat_cova;
            vec3 splat_covb;
            computeCov3d(mat3(matrix_model) * quatToMat3(rotation), scale, splat_cova, splat_covb);

            mat3 Vrk = mat3(
                splat_cova.x, splat_cova.y, splat_cova.z, 
                splat_cova.y, splat_covb.x, splat_covb.y,
                splat_cova.z, splat_covb.y, splat_covb.z
            );

            float focal = viewport.x * matrix_projection[0][0];

            mat3 J = mat3(
                focal / splat_cam.z, 0., -(focal * splat_cam.x) / (splat_cam.z * splat_cam.z), 
                0., focal / splat_cam.z, -(focal * splat_cam.y) / (splat_cam.z * splat_cam.z), 
                0., 0., 0.
            );

            mat3 W = transpose(mat3(matrix_view));
            mat3 T = W * J;
            mat3 cov = transpose(T) * Vrk * T;

            float diagonal1 = cov[0][0] + 0.3;
            float offDiagonal = cov[0][1];
            float diagonal2 = cov[1][1] + 0.3;

            float mid = 0.5 * (diagonal1 + diagonal2);
            float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
            float lambda1 = mid + radius;
            float lambda2 = max(mid - radius, 0.1);
            vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
            vec2 v1 = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
            vec2 v2 = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);

            // early out tiny splats
            // TODO: figure out length units and expose as uniform parameter
            // TODO: perhaps make this a shader compile-time option
            if (dot(v1, v1) < 4.0 && dot(v2, v2) < 4.0) {
                return vec4(0.0, 0.0, 2.0, 1.0);
            }

            texCoord = vertex_position.xy * 2.0;

            return splat_proj +
                vec4((vertex_position.x * v1 + vertex_position.y * v2) / viewport * 2.0,
                    0.0, 0.0) * splat_proj.w;
        #endif
    }
`;

	const splatMainVS = `
    void main(void)
    {
        vec3 centerLocal = evalCenter();
        vec4 centerWorld = matrix_model * vec4(centerLocal, 1.0);

        gl_Position = evalSplat(centerWorld);
    }
`;

	const splatCoreFS = /* glsl_ */ `
    varying vec2 texCoord;
    varying vec4 color;

    vec4 evalSplat() {

        #ifdef DEBUG_RENDER

            if (color.a < 0.2) discard;
            return color;

        #else

            float A = -dot(texCoord, texCoord);
            if (A < -4.0) discard;
            float B = exp(A) * color.a;
            return vec4(color.rgb, B);

        #endif
    }
`;

	const splatMainFS = `
    void main(void)
    {
        gl_FragColor = evalSplat();
    }
`;

	// extracted from engine, hash.js
	const hashCode = (str) => {
	    let hash = 0;
	    for (let i = 0, len = str.length; i < len; i++) {
	        hash = ((hash << 5) - hash) + str.charCodeAt(i);
	        // Convert to 32bit integer
	        hash |= 0;
	    }
	    return hash;
	};

	const createSplatMaterial = (device, options = {}) => {

	    const debugRender = options.debugRender;

	    const result = new playcanvas.Material();
	    result.name = 'splatMaterial';
	    result.cull = debugRender ? playcanvas.CULLFACE_BACK : playcanvas.CULLFACE_NONE;
	    result.blendType = playcanvas.BLEND_NORMAL;
	    result.depthWrite = false;

	    const defines = (debugRender ? '#define DEBUG_RENDER\n' : '') +
	        (device.isWebGL1 ? '' : '#define INT_INDICES\n');
	    const vs = defines + splatCoreVS + (options.vertex ?? splatMainVS);
	    const fs = defines + splatCoreFS + (options.fragment ?? splatMainFS);
	    const vsHash = hashCode(vs);
	    const fsHash = hashCode(fs);

	    result.shader = playcanvas.createShaderFromCode(device, vs, fs, `splatShader-${debugRender}-${vsHash}-${fsHash}`, {
	        vertex_position: playcanvas.SEMANTIC_POSITION,
	        vertex_id: playcanvas.SEMANTIC_ATTR13
	    });

	    result.update();

	    return result;
	};

	class Splat {
	    device;

	    numSplats;

	    vertexFormat;

	    format;

	    colorTexture;

	    scaleTexture;

	    rotationTexture;

	    centerTexture;

	    centers;

	    aabb;

	    constructor(device, numSplats, aabb) {
	        this.device = device;
	        this.numSplats = numSplats;
	        this.aabb = aabb;

	        this.vertexFormat = new playcanvas.VertexFormat(device, [
	            { semantic: playcanvas.SEMANTIC_ATTR13, components: 1, type: device.isWebGL1 ? playcanvas.TYPE_FLOAT32 : playcanvas.TYPE_UINT32, asInt: !device.isWebGL1 }
	        ]);

	        // create data textures
	        const size = this.evalTextureSize(numSplats);
	        this.format = this.getTextureFormat(device, false);
	        this.colorTexture = this.createTexture(device, 'splatColor', playcanvas.PIXELFORMAT_RGBA8, size);
	        this.scaleTexture = this.createTexture(device, 'splatScale', this.format.format, size);
	        this.rotationTexture = this.createTexture(device, 'splatRotation', this.format.format, size);
	        this.centerTexture = this.createTexture(device, 'splatCenter', this.format.format, size);
	    }

	    destroy() {
	        this.colorTexture.destroy();
	        this.scaleTexture.destroy();
	        this.rotationTexture.destroy();
	        this.centerTexture.destroy();
	    }

	    createMaterial(options) {
	        const material = createSplatMaterial(this.device, options);
	        const { width, height } = this.colorTexture;

	        material.setParameter('splatColor', this.colorTexture);
	        material.setParameter('splatScale', this.scaleTexture);
	        material.setParameter('splatRotation', this.rotationTexture);
	        material.setParameter('splatCenter', this.centerTexture);
	        material.setParameter('tex_params', new Float32Array([width, height, 1 / width, 1 / height]));

	        return material;
	    }

	    evalTextureSize(count) {
	        const width = Math.ceil(Math.sqrt(count));
	        const height = Math.ceil(count / width);
	        return new playcanvas.Vec2(width, height);
	    }

	    createTexture(device, name, format, size) {
	        return new playcanvas.Texture(device, {
	            name: name,
	            width: size.x,
	            height: size.y,
	            format: format,
	            cubemap: false,
	            mipmaps: false,
	            minFilter: playcanvas.FILTER_NEAREST,
	            magFilter: playcanvas.FILTER_NEAREST,
	            addressU: playcanvas.ADDRESS_CLAMP_TO_EDGE,
	            addressV: playcanvas.ADDRESS_CLAMP_TO_EDGE
	        });
	    }

	    getTextureFormat(device, preferHighPrecision) {
	        const halfFormat = (device.extTextureHalfFloat && device.textureHalfFloatUpdatable) ? playcanvas.PIXELFORMAT_RGBA16F : undefined;
	        const half = halfFormat ? {
	            format: halfFormat,
	            numComponents: 4,
	            isHalf: true
	        } : undefined;

	        const floatFormat = device.isWebGPU ? playcanvas.PIXELFORMAT_RGBA32F : (device.extTextureFloat ? playcanvas.PIXELFORMAT_RGB32F : undefined);
	        const float = floatFormat ? {
	            format: floatFormat,
	            numComponents: floatFormat === playcanvas.PIXELFORMAT_RGBA32F ? 4 : 3,
	            isHalf: false
	        } : undefined;

	        return preferHighPrecision ? (float ?? half) : (half ?? float);
	    }

	    updateColorData(c0, c1, c2, opacity) {
	        const SH_C0 = 0.28209479177387814;
	        const texture = this.colorTexture;
	        const data = texture.lock();

	        const sigmoid = (v) => {
	            if (v > 0) {
	                return 1 / (1 + Math.exp(-v));
	            }

	            const t = Math.exp(v);
	            return t / (1 + t);
	        };

	        for (let i = 0; i < this.numSplats; ++i) {

	            // colors
	            if (c0 && c1 && c2) {
	                data[i * 4 + 0] = playcanvas.math.clamp((0.5 + SH_C0 * c0[i]) * 255, 0, 255);
	                data[i * 4 + 1] = playcanvas.math.clamp((0.5 + SH_C0 * c1[i]) * 255, 0, 255);
	                data[i * 4 + 2] = playcanvas.math.clamp((0.5 + SH_C0 * c2[i]) * 255, 0, 255);
	            }

	            // opacity
	            data[i * 4 + 3] = opacity ? playcanvas.math.clamp(sigmoid(opacity[i]) * 255, 0, 255) : 255;
	        }

	        texture.unlock();
	    }

	    updateScaleData(scale0, scale1, scale2) {
	        const { numComponents, isHalf } = this.format;
	        const texture = this.scaleTexture;
	        const data = texture.lock();
	        const float2Half = playcanvas.FloatPacking.float2Half;

	        for (let i = 0; i < this.numSplats; i++) {

	            const sx = Math.exp(scale0[i]);
	            const sy = Math.exp(scale1[i]);
	            const sz = Math.exp(scale2[i]);

	            if (isHalf) {
	                data[i * numComponents + 0] = float2Half(sx);
	                data[i * numComponents + 1] = float2Half(sy);
	                data[i * numComponents + 2] = float2Half(sz);
	            } else {
	                data[i * numComponents + 0] = sx;
	                data[i * numComponents + 1] = sy;
	                data[i * numComponents + 2] = sz;
	            }
	        }

	        texture.unlock();
	    }

	    updateRotationData(rot0, rot1, rot2, rot3) {
	        const { numComponents, isHalf } = this.format;
	        const quat = new playcanvas.Quat();

	        const texture = this.rotationTexture;
	        const data = texture.lock();
	        const float2Half = playcanvas.FloatPacking.float2Half;

	        for (let i = 0; i < this.numSplats; i++) {

	            quat.set(rot0[i], rot1[i], rot2[i], rot3[i]).normalize();

	            if (quat.w < 0) {
	                quat.conjugate();
	            }

	            if (isHalf) {
	                data[i * numComponents + 0] = float2Half(quat.x);
	                data[i * numComponents + 1] = float2Half(quat.y);
	                data[i * numComponents + 2] = float2Half(quat.z);
	            } else {
	                data[i * numComponents + 0] = quat.x;
	                data[i * numComponents + 1] = quat.y;
	                data[i * numComponents + 2] = quat.z;
	            }
	        }

	        texture.unlock();
	    }

	    updateCenterData(x, y, z) {
	        const { numComponents, isHalf } = this.format;

	        const texture = this.centerTexture;
	        const data = texture.lock();
	        const float2Half = playcanvas.FloatPacking.float2Half;

	        for (let i = 0; i < this.numSplats; i++) {

	            if (isHalf) {
	                data[i * numComponents + 0] = float2Half(x[i]);
	                data[i * numComponents + 1] = float2Half(y[i]);
	                data[i * numComponents + 2] = float2Half(z[i]);
	            } else {
	                data[i * numComponents + 0] = x[i];
	                data[i * numComponents + 1] = y[i];
	                data[i * numComponents + 2] = z[i];
	            }
	        }

	        texture.unlock();
	    }
	}

	// sort blind set of data
	function SortWorker() {

	    // number of bits used to store the distance in integer array. Smaller number gives it a smaller
	    // precision but faster sorting. Could be dynamic for less precise sorting.
	    // 16bit seems plenty of large scenes (train), 10bits is enough for sled.
	    const compareBits = 16;

	    // number of buckets for count sorting to represent each unique distance using compareBits bits
	    const bucketCount = (2 ** compareBits) + 1;

	    let data;
	    let centers;
	    let cameraPosition;
	    let cameraDirection;
	    let intIndices;

	    const lastCameraPosition = { x: 0, y: 0, z: 0 };
	    const lastCameraDirection = { x: 0, y: 0, z: 0 };

	    const boundMin = { x: 0, y: 0, z: 0 };
	    const boundMax = { x: 0, y: 0, z: 0 };

	    let distances;
	    let indices;
	    let target;
	    let countBuffer;

	    const update = () => {
	        if (!centers || !data || !cameraPosition || !cameraDirection) return;

	        const px = cameraPosition.x;
	        const py = cameraPosition.y;
	        const pz = cameraPosition.z;
	        const dx = cameraDirection.x;
	        const dy = cameraDirection.y;
	        const dz = cameraDirection.z;

	        const epsilon = 0.001;

	        if (Math.abs(px - lastCameraPosition.x) < epsilon &&
	            Math.abs(py - lastCameraPosition.y) < epsilon &&
	            Math.abs(pz - lastCameraPosition.z) < epsilon &&
	            Math.abs(dx - lastCameraDirection.x) < epsilon &&
	            Math.abs(dy - lastCameraDirection.y) < epsilon &&
	            Math.abs(dz - lastCameraDirection.z) < epsilon) {
	            return;
	        }

	        lastCameraPosition.x = px;
	        lastCameraPosition.y = py;
	        lastCameraPosition.z = pz;
	        lastCameraDirection.x = dx;
	        lastCameraDirection.y = dy;
	        lastCameraDirection.z = dz;

	        // create distance buffer
	        const numVertices = centers.length / 3;
	        if (distances?.length !== numVertices) {
	            distances = new Uint32Array(numVertices);
	            indices = new Uint32Array(numVertices);
	            target = new Float32Array(numVertices);
	        }

	        // calc min/max distance using bound
	        let minDist;
	        let maxDist;
	        for (let i = 0; i < 8; ++i) {
	            const x = i & 1 ? boundMin.x : boundMax.x;
	            const y = i & 2 ? boundMin.y : boundMax.y;
	            const z = i & 4 ? boundMin.z : boundMax.z;
	            const d = (x - px) * dx + (y - py) * dy + (z - pz) * dz;
	            if (i === 0) {
	                minDist = maxDist = d;
	            } else {
	                minDist = Math.min(minDist, d);
	                maxDist = Math.max(maxDist, d);
	            }
	        }

	        if (!countBuffer)
	            countBuffer = new Uint32Array(bucketCount);

	        for (let i = 0; i < bucketCount; i++)
	            countBuffer[i] = 0;

	        // generate per vertex distance to camera
	        const range = maxDist - minDist;
	        const divider = 1 / range * (2 ** compareBits);
	        for (let i = 0; i < numVertices; ++i) {
	            const istride = i * 3;
	            const d = (centers[istride + 0] - px) * dx +
	                      (centers[istride + 1] - py) * dy +
	                      (centers[istride + 2] - pz) * dz;
	            const sortKey = Math.floor((d - minDist) * divider);

	            distances[i] = sortKey;
	            indices[i] = i;

	            // count occurrences of each distance
	            countBuffer[sortKey]++;
	        }

	        // Change countBuffer[i] so that it contains actual position of this digit in outputArray
	        for (let i = 1; i < bucketCount; i++)
	            countBuffer[i] += countBuffer[i - 1];

	        // Build the output array
	        const outputArray = intIndices ? new Uint32Array(target.buffer) : target;
	        const offset = intIndices ? 0 : 0.2;
	        for (let i = numVertices - 1; i >= 0; i--) {
	            const distance = distances[i];
	            const index = indices[i];
	            outputArray[countBuffer[distance] - 1] = index + offset;
	            countBuffer[distance]--;
	        }

	        // swap
	        const tmp = data;
	        data = target;
	        target = tmp;

	        // send results
	        self.postMessage({
	            data: data.buffer
	        }, [data.buffer]);

	        data = null;
	    };

	    self.onmessage = (message) => {
	        if (message.data.data) {
	            data = new Float32Array(message.data.data);
	        }
	        if (message.data.centers) {
	            centers = new Float32Array(message.data.centers);

	            // calculate bounds
	            boundMin.x = boundMax.x = centers[0];
	            boundMin.y = boundMax.y = centers[1];
	            boundMin.z = boundMax.z = centers[2];

	            const numVertices = centers.length / 3;
	            for (let i = 1; i < numVertices; ++i) {
	                const x = centers[i * 3 + 0];
	                const y = centers[i * 3 + 1];
	                const z = centers[i * 3 + 2];

	                boundMin.x = Math.min(boundMin.x, x);
	                boundMin.y = Math.min(boundMin.y, y);
	                boundMin.z = Math.min(boundMin.z, z);

	                boundMax.x = Math.max(boundMax.x, x);
	                boundMax.y = Math.max(boundMax.y, y);
	                boundMax.z = Math.max(boundMax.z, z);
	            }
	        }
	        if (message.data.intIndices) {
	            intIndices = message.data.intIndices;
	        }
	        if (message.data.cameraPosition) cameraPosition = message.data.cameraPosition;
	        if (message.data.cameraDirection) cameraDirection = message.data.cameraDirection;

	        update();
	    };
	}

	class SplatSorter extends playcanvas.EventHandler {
	    worker;

	    vertexBuffer;

	    constructor() {
	        super();

	        this.worker = new Worker(URL.createObjectURL(new Blob([`(${SortWorker.toString()})()`], {
	            type: 'application/javascript'
	        })));

	        this.worker.onmessage = (message) => {
	            const newData = message.data.data;
	            const oldData = this.vertexBuffer.storage;

	            // send vertex storage to worker to start the next frame
	            this.worker.postMessage({
	                data: oldData
	            }, [oldData]);

	            // update vertex buffer data in the next event cycle so the above postMesssage
	            // call is queued before the relatively slow setData call below is invoked
	            setTimeout(() => {
	                this.vertexBuffer.setData(newData);
	                this.fire('updated');
	            });
	        };
	    }

	    destroy() {
	        this.worker.terminate();
	        this.worker = null;
	    }

	    init(vertexBuffer, centers, intIndices) {
	        this.vertexBuffer = vertexBuffer;

	        // send the initial buffer to worker
	        const buf = vertexBuffer.storage.slice(0);
	        this.worker.postMessage({
	            data: buf,
	            centers: centers.buffer,
	            intIndices: intIndices
	        }, [buf, centers.buffer]);
	    }

	    setCamera(pos, dir) {
	        this.worker.postMessage({
	            cameraPosition: { x: pos.x, y: pos.y, z: pos.z },
	            cameraDirection: { x: dir.x, y: dir.y, z: dir.z }
	        });
	    }
	}

	const mat = new playcanvas.Mat4();
	const cameraPosition = new playcanvas.Vec3();
	const cameraDirection = new playcanvas.Vec3();
	const viewport = [0, 0];

	class SplatInstance {
	    splat;

	    mesh;

	    meshInstance;

	    material;

	    vb;

	    sorter;

	    lastCameraPosition = new playcanvas.Vec3();

	    lastCameraDirection = new playcanvas.Vec3();

	    constructor(splat, options) {
	        this.splat = splat;

	        // material
	        const debugRender = options.debugRender;
	        this.material = splat.createMaterial(options);

	        // mesh
	        const device = splat.device;
	        if (debugRender) {
	            this.mesh = playcanvas.createBox(device, {
	                halfExtents: new playcanvas.Vec3(1.0, 1.0, 1.0)
	            });
	        } else {
	            this.mesh = new playcanvas.Mesh(device);
	            this.mesh.setPositions(new Float32Array([
	                -1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1
	            ]), 2);
	            this.mesh.update();
	        }

	        this.mesh.aabb.copy(splat.aabb);

	        // initialize index data
	        const numSplats = splat.numSplats;
	        let indexData;
	        if (!device.isWebGL1) {
	            indexData = new Uint32Array(numSplats);
	            for (let i = 0; i < numSplats; ++i) {
	                indexData[i] = i;
	            }
	        } else {
	            indexData = new Float32Array(numSplats);
	            for (let i = 0; i < numSplats; ++i) {
	                indexData[i] = i + 0.2;
	            }
	        }

	        const vb = new playcanvas.VertexBuffer(
	            device,
	            splat.vertexFormat,
	            numSplats,
	            playcanvas.BUFFER_DYNAMIC,
	            indexData.buffer
	        );
	        this.vb = vb;

	        this.meshInstance = new playcanvas.MeshInstance(this.mesh, this.material);
	        this.meshInstance.setInstancing(vb, true);
	        this.meshInstance.splatInstance = this;

	        // clone centers to allow multiple instancing of sorter
	        this.centers = new Float32Array(splat.centers);

	        this.sorter = new SplatSorter();
	        this.sorter.init(this.vb, this.centers, !this.splat.device.isWebGL1);

	        // if camera entity is provided, automatically use it to sort splats
	        const cameraEntity = options.cameraEntity;
	        if (cameraEntity) {
	            this.callbackHandle = cameraEntity._app.on('prerender', () => {
	                this.sort(cameraEntity);
	            });
	        }

	        this.updateViewport();
	    }

	    destroy() {
	        this.material.destroy();
	        this.vb.destroy();
	        this.meshInstance.destroy();
	        this.sorter.destroy();
	        this.callbackHandle?.off();
	    }

	    updateViewport() {
	        const device = this.splat.device;
	        viewport[0] = device.width;
	        viewport[1] = device.height;
	        this.material.setParameter('viewport', viewport);
	    }

	    sort(camera) {

	        let sorted = false;

	        const cameraMat = camera.getWorldTransform();
	        cameraMat.getTranslation(cameraPosition);
	        cameraMat.getZ(cameraDirection);

	        const modelMat = this.meshInstance.node.getWorldTransform();
	        const invModelMat = mat.invert(modelMat);
	        invModelMat.transformPoint(cameraPosition, cameraPosition);
	        invModelMat.transformVector(cameraDirection, cameraDirection);

	        // sort if the camera has changed
	        if (!cameraPosition.equalsApprox(this.lastCameraPosition) || !cameraDirection.equalsApprox(this.lastCameraDirection)) {
	            this.lastCameraPosition.copy(cameraPosition);
	            this.lastCameraDirection.copy(cameraDirection);
	            sorted = true;

	            this.sorter.setCamera(cameraPosition, cameraDirection);
	        }

	        this.updateViewport();

	        return sorted;
	    }
	}

	class SplatContainerResource extends playcanvas.ContainerResource {
	    device;

	    splatData;

	    splat;

	    constructor(device, splatData) {
	        super();

	        this.device = device;
	        this.splatData = splatData.isCompressed ? splatData.decompress() : splatData;
	    }

	    destroy() {
	        this.device = null;
	        this.splatData = null;
	        this.splat?.destroy();
	        this.splat = null;
	    }

	    createSplat() {
	        if (!this.splat) {

	            const splatData = this.splatData;

	            const aabb = new playcanvas.BoundingBox();
	            this.splatData.calcAabb(aabb);

	            const splat = new Splat(this.device, splatData.numSplats, aabb);
	            this.splat = splat;

	            // texture data
	            splat.updateColorData(splatData.getProp('f_dc_0'), splatData.getProp('f_dc_1'), splatData.getProp('f_dc_2'), splatData.getProp('opacity'));
	            splat.updateScaleData(splatData.getProp('scale_0'), splatData.getProp('scale_1'), splatData.getProp('scale_2'));
	            splat.updateRotationData(splatData.getProp('rot_0'), splatData.getProp('rot_1'), splatData.getProp('rot_2'), splatData.getProp('rot_3'));
	            splat.updateCenterData(splatData.getProp('x'), splatData.getProp('y'), splatData.getProp('z'));

	            // centers - constant buffer that is sent to the worker
	            const x = splatData.getProp('x');
	            const y = splatData.getProp('y');
	            const z = splatData.getProp('z');

	            const centers = new Float32Array(this.splatData.numSplats * 3);
	            for (let i = 0; i < this.splatData.numSplats; ++i) {
	                centers[i * 3 + 0] = x[i];
	                centers[i * 3 + 1] = y[i];
	                centers[i * 3 + 2] = z[i];
	            }
	            splat.centers = centers;
	        }

	        return this.splat;
	    }

	    instantiateModelEntity(/* options: any */) {
	        return null;
	    }

	    instantiateRenderEntity(options = {}) {

	        // shared splat between instances
	        const splat = this.createSplat();

	        const splatInstance = new SplatInstance(splat, options);

	        const entity = new playcanvas.Entity('Splat');
	        entity.addComponent('render', {
	            type: 'asset',
	            meshInstances: [splatInstance.meshInstance],

	            // shadows not supported
	            castShadows: false
	        });

	        // set custom aabb
	        entity.render.customAabb = splat.aabb.clone();

	        // HACK: store splat instance on the render component, to allow it to be destroye in the following code
	        entity.render.splatInstance = splatInstance;

	        // when the render component gets deleted, destroy the splat instance
	        entity.render.system.on('beforeremove', (entity, component) => {

	            // HACK: the render component is already destroyed, so cannot get splat instance from the mesh instance,
	            // and so get it from the temporary property
	            // TODO: if this gets integrated into the engine, mesh instance would destroy splat instance
	            if (component.splatInstance) {
	                component.splatInstance?.destroy();
	                component.splatInstance = null;
	            }
	        }, this);

	        return entity;
	    }
	}

	const vec3 = new playcanvas.Vec3();
	const mat4 = new playcanvas.Mat4();
	const quat = new playcanvas.Quat();
	const quat2 = new playcanvas.Quat();
	const aabb = new playcanvas.BoundingBox();
	const aabb2 = new playcanvas.BoundingBox();

	const debugPoints = [new playcanvas.Vec3(), new playcanvas.Vec3(), new playcanvas.Vec3(), new playcanvas.Vec3(), new playcanvas.Vec3(), new playcanvas.Vec3(), new playcanvas.Vec3(), new playcanvas.Vec3()];
	const debugLines = [
	    debugPoints[0], debugPoints[1], debugPoints[1], debugPoints[3], debugPoints[3], debugPoints[2], debugPoints[2], debugPoints[0],
	    debugPoints[4], debugPoints[5], debugPoints[5], debugPoints[7], debugPoints[7], debugPoints[6], debugPoints[6], debugPoints[4],
	    debugPoints[0], debugPoints[4], debugPoints[1], debugPoints[5], debugPoints[2], debugPoints[6], debugPoints[3], debugPoints[7]
	];
	const debugColor = new playcanvas.Color(1, 1, 0, 0.4);

	const calcSplatMat = (result, data) => {
	    const px = data.x;
	    const py = data.y;
	    const pz = data.z;
	    const d = Math.sqrt(data.rx * data.rx + data.ry * data.ry + data.rz * data.rz + data.rw * data.rw);
	    const x = data.rx / d;
	    const y = data.ry / d;
	    const z = data.rz / d;
	    const w = data.rw / d;

	    // build rotation matrix
	    result.data.set([
	        1.0 - 2.0 * (z * z + w * w),
	        2.0 * (y * z + x * w),
	        2.0 * (y * w - x * z),
	        0,

	        2.0 * (y * z - x * w),
	        1.0 - 2.0 * (y * y + w * w),
	        2.0 * (z * w + x * y),
	        0,

	        2.0 * (y * w + x * z),
	        2.0 * (z * w - x * y),
	        1.0 - 2.0 * (y * y + z * z),
	        0,

	        px, py, pz, 1
	    ]);
	};

	class SplatData {
	    elements;

	    vertexElement;

	    constructor(elements, performZScale = true) {
	        this.elements = elements;
	        this.vertexElement = elements.find(element => element.name === 'vertex');

	        if (!this.isCompressed && performZScale) {
	            mat4.setScale(-1, -1, 1);
	            this.transform(mat4);
	        }
	    }

	    get numSplats() {
	        return this.vertexElement.count;
	    }

	    static calcSplatAabb(result, data) {
	        calcSplatMat(mat4, data);
	        aabb.center.set(0, 0, 0);
	        aabb.halfExtents.set(data.sx * 2, data.sy * 2, data.sz * 2);
	        result.setFromTransformedAabb(aabb, mat4);
	    }

	    // transform splat data by the given matrix
	    transform(mat) {
	        const x = this.getProp('x');
	        const y = this.getProp('y');
	        const z = this.getProp('z');

	        const rx = this.getProp('rot_0');
	        const ry = this.getProp('rot_1');
	        const rz = this.getProp('rot_2');
	        const rw = this.getProp('rot_3');

	        quat2.setFromMat4(mat);

	        for (let i = 0; i < this.numSplats; ++i) {
	            // transform center
	            vec3.set(x[i], y[i], z[i]);
	            mat.transformPoint(vec3, vec3);
	            x[i] = vec3.x;
	            y[i] = vec3.y;
	            z[i] = vec3.z;

	            // transform orientation
	            quat.set(ry[i], rz[i], rw[i], rx[i]).mul2(quat2, quat);
	            rx[i] = quat.w;
	            ry[i] = quat.x;
	            rz[i] = quat.y;
	            rw[i] = quat.z;

	            // TODO: transform SH
	        }
	    }

	    // access a named property
	    getProp(name) {
	        return this.vertexElement.properties.find(property => property.name === name && property.storage)?.storage;
	    }

	    // add a new property
	    addProp(name, storage) {
	        this.vertexElement.properties.push({
	            type: 'float',
	            name,
	            storage,
	            byteSize: 4
	        });
	    }

	    // calculate scene aabb taking into account splat size
	    calcAabb(result, pred) {
	        const x = this.getProp('x');
	        const y = this.getProp('y');
	        const z = this.getProp('z');

	        const rx = this.getProp('rot_0');
	        const ry = this.getProp('rot_1');
	        const rz = this.getProp('rot_2');
	        const rw = this.getProp('rot_3');

	        const sx = this.getProp('scale_0');
	        const sy = this.getProp('scale_1');
	        const sz = this.getProp('scale_2');

	        const splat = {
	            x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, rw: 0, sx: 0, sy: 0, sz: 0
	        };

	        let first = true;

	        for (let i = 0; i < this.numSplats; ++i) {
	            if (pred && !pred(i)) {
	                continue;
	            }

	            splat.x = x[i];
	            splat.y = y[i];
	            splat.z = z[i];
	            splat.rx = rx[i];
	            splat.ry = ry[i];
	            splat.rz = rz[i];
	            splat.rw = rw[i];
	            splat.sx = Math.exp(sx[i]);
	            splat.sy = Math.exp(sy[i]);
	            splat.sz = Math.exp(sz[i]);

	            if (first) {
	                first = false;
	                SplatData.calcSplatAabb(result, splat);
	            } else {
	                SplatData.calcSplatAabb(aabb2, splat);
	                result.add(aabb2);
	            }
	        }

	        return !first;
	    }

	    calcFocalPoint(result, pred) {
	        const x = this.getProp('x');
	        const y = this.getProp('y');
	        const z = this.getProp('z');

	        const sx = this.getProp('scale_0');
	        const sy = this.getProp('scale_1');
	        const sz = this.getProp('scale_2');

	        result.x = 0;
	        result.y = 0;
	        result.z = 0;

	        let sum = 0;
	        for (let i = 0; i < this.numSplats; ++i) {
	            if (pred && !pred(i)) {
	                continue;
	            }
	            const weight = 1.0 / (1.0 + Math.exp(Math.max(sx[i], sy[i], sz[i])));
	            result.x += x[i] * weight;
	            result.y += y[i] * weight;
	            result.z += z[i] * weight;
	            sum += weight;
	        }
	        result.mulScalar(1 / sum);
	    }

	    renderWireframeBounds(app, worldMat) {
	        const x = this.getProp('x');
	        const y = this.getProp('y');
	        const z = this.getProp('z');

	        const rx = this.getProp('rot_0');
	        const ry = this.getProp('rot_1');
	        const rz = this.getProp('rot_2');
	        const rw = this.getProp('rot_3');

	        const sx = this.getProp('scale_0');
	        const sy = this.getProp('scale_1');
	        const sz = this.getProp('scale_2');

	        const splat = {
	            x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, rw: 0, sx: 0, sy: 0, sz: 0
	        };

	        for (let i = 0; i < this.numSplats; ++i) {
	            splat.x = x[i];
	            splat.y = y[i];
	            splat.z = z[i];
	            splat.rx = rx[i];
	            splat.ry = ry[i];
	            splat.rz = rz[i];
	            splat.rw = rw[i];
	            splat.sx = Math.exp(sx[i]);
	            splat.sy = Math.exp(sy[i]);
	            splat.sz = Math.exp(sz[i]);

	            calcSplatMat(mat4, splat);
	            mat4.mul2(worldMat, mat4);

	            for (let j = 0; j < 8; ++j) {
	                vec3.set(
	                    splat.sx * 2 * ((j & 1) ? 1 : -1),
	                    splat.sy * 2 * ((j & 2) ? 1 : -1),
	                    splat.sz * 2 * ((j & 4) ? 1 : -1)
	                );
	                mat4.transformPoint(vec3, debugPoints[j]);
	            }

	            app.drawLines(debugLines, debugColor);
	        }
	    }

	    // compressed splats
	    get isCompressed() {
	        return this.elements.some(e => e.name === 'chunk') &&
	               ['packed_position', 'packed_rotation', 'packed_scale', 'packed_color'].every(name => this.getProp(name));
	    }

	    decompress() {
	        const members = ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'scale_0', 'scale_1', 'scale_2'];
	        const chunks = this.elements.find(e => e.name === 'chunk');
	        const vertices = this.vertexElement;

	        // allocate uncompressed data
	        const data = {};
	        members.forEach((name) => {
	            data[name] = new Float32Array(vertices.count);
	        });

	        const getChunkProp = (name) => {
	            return chunks.properties.find(p => p.name === name && p.storage)?.storage;
	        };

	        const min_x = getChunkProp('min_x');
	        const min_y = getChunkProp('min_y');
	        const min_z = getChunkProp('min_z');
	        const max_x = getChunkProp('max_x');
	        const max_y = getChunkProp('max_y');
	        const max_z = getChunkProp('max_z');
	        const min_scale_x = getChunkProp('min_scale_x');
	        const min_scale_y = getChunkProp('min_scale_y');
	        const min_scale_z = getChunkProp('min_scale_z');
	        const max_scale_x = getChunkProp('max_scale_x');
	        const max_scale_y = getChunkProp('max_scale_y');
	        const max_scale_z = getChunkProp('max_scale_z');

	        const position = this.getProp('packed_position');
	        const rotation = this.getProp('packed_rotation');
	        const scale = this.getProp('packed_scale');
	        const color = this.getProp('packed_color');

	        const unpackUnorm = (value, bits) => {
	            const t = (1 << bits) - 1;
	            return (value & t) / t;
	        };

	        const unpack111011 = (result, value) => {
	            result.x = unpackUnorm(value >>> 21, 11);
	            result.y = unpackUnorm(value >>> 11, 10);
	            result.z = unpackUnorm(value, 11);
	        };

	        const unpack8888 = (result, value) => {
	            result.x = unpackUnorm(value >>> 24, 8);
	            result.y = unpackUnorm(value >>> 16, 8);
	            result.z = unpackUnorm(value >>> 8, 8);
	            result.w = unpackUnorm(value, 8);
	        };

	        // unpack quaternion with 2,10,10,10 format (largest element, 3x10bit element)
	        const unpackRot = (result, value) => {
	            const norm = 1.0 / (Math.sqrt(2) * 0.5);
	            const a = (unpackUnorm(value >>> 20, 10) - 0.5) * norm;
	            const b = (unpackUnorm(value >>> 10, 10) - 0.5) * norm;
	            const c = (unpackUnorm(value, 10) - 0.5) * norm;
	            const m = Math.sqrt(1.0 - (a * a + b * b + c * c));

	            switch (value >>> 30) {
	                case 0: result.set(m, a, b, c); break;
	                case 1: result.set(a, m, b, c); break;
	                case 2: result.set(a, b, m, c); break;
	                case 3: result.set(a, b, c, m); break;
	            }
	        };

	        const lerp = (a, b, t) => a * (1 - t) + b * t;

	        const p = new playcanvas.Vec3();
	        const r = new playcanvas.Quat();
	        const s = new playcanvas.Vec3();
	        const c = new playcanvas.Vec4();

	        for (let i = 0; i < vertices.count; ++i) {
	            const ci = Math.floor(i / 256);

	            unpack111011(p, position[i]);
	            unpackRot(r, rotation[i]);
	            unpack111011(s, scale[i]);
	            unpack8888(c, color[i]);

	            data.x[i] = lerp(min_x[ci], max_x[ci], p.x);
	            data.y[i] = lerp(min_y[ci], max_y[ci], p.y);
	            data.z[i] = lerp(min_z[ci], max_z[ci], p.z);

	            data.rot_0[i] = r.x;
	            data.rot_1[i] = r.y;
	            data.rot_2[i] = r.z;
	            data.rot_3[i] = r.w;

	            data.scale_0[i] = lerp(min_scale_x[ci], max_scale_x[ci], s.x);
	            data.scale_1[i] = lerp(min_scale_y[ci], max_scale_y[ci], s.y);
	            data.scale_2[i] = lerp(min_scale_z[ci], max_scale_z[ci], s.z);

	            const SH_C0 = 0.28209479177387814;
	            data.f_dc_0[i] = (c.x - 0.5) / SH_C0;
	            data.f_dc_1[i] = (c.y - 0.5) / SH_C0;
	            data.f_dc_2[i] = (c.z - 0.5) / SH_C0;
	            data.opacity[i] = -Math.log(1 / c.w - 1);
	        }

	        return new SplatData([{
	            name: 'vertex',
	            count: vertices.count,
	            properties: members.map((name) => {
	                return {
	                    name: name,
	                    type: 'float',
	                    byteSize: 4,
	                    storage: data[name]
	                };
	            })
	        }], false);
	    }
	}

	const magicBytes = new Uint8Array([112, 108, 121, 10]);                                                 // ply\n
	const endHeaderBytes = new Uint8Array([10, 101, 110, 100, 95, 104, 101, 97, 100, 101, 114, 10]);        // \nend_header\n

	const dataTypeMap = new Map([
	    ['char', Int8Array],
	    ['uchar', Uint8Array],
	    ['short', Int16Array],
	    ['ushort', Uint16Array],
	    ['int', Int32Array],
	    ['uint', Uint32Array],
	    ['float', Float32Array],
	    ['double', Float64Array]
	]);

	// asynchronously read a ply file data
	const readPly = async (reader, propertyFilter = null) => {
	    const concat = (a, b) => {
	        const c = new Uint8Array(a.byteLength + b.byteLength);
	        c.set(a);
	        c.set(b, a.byteLength);
	        return c;
	    };

	    const find = (buf, search) => {
	        const endIndex = buf.length - search.length;
	        let i, j;
	        for (i = 0; i < endIndex; ++i) {
	            for (j = 0; j < search.length; ++j) {
	                if (buf[i + j] !== search[j]) {
	                    break;
	                }
	            }
	            if (j === search.length) {
	                return i;
	            }
	        }
	        return -1;
	    };

	    const startsWith = (a, b) => {
	        if (a.length < b.length) {
	            return false;
	        }

	        for (let i = 0; i < b.length; ++i) {
	            if (a[i] !== b[i]) {
	                return false;
	            }
	        }

	        return true;
	    };

	    let buf;
	    let endHeaderIndex;

	    while (true) {
	        // get the next chunk
	        /* eslint-disable no-await-in-loop */
	        const { value, done } = await reader.read();

	        if (done) {
	            throw new Error('Stream finished before end of header');
	        }

	        // combine new chunk with the previous
	        buf = buf ? concat(buf, value) : value;

	        // check magic bytes
	        if (buf.length >= magicBytes.length && !startsWith(buf, magicBytes)) {
	            throw new Error('Invalid ply header');
	        }

	        // check if we can find the end-of-header marker
	        endHeaderIndex = find(buf, endHeaderBytes);

	        if (endHeaderIndex !== -1) {
	            break;
	        }
	    }

	    // decode buffer header text
	    const headerText = new TextDecoder('ascii').decode(buf.slice(0, endHeaderIndex));

	    // split into lines and remove comments
	    const headerLines = headerText.split('\n')
	        .filter(line => !line.startsWith('comment '));

	    // decode header and allocate data storage
	    const elements = [];
	    for (let i = 1; i < headerLines.length; ++i) {
	        const words = headerLines[i].split(' ');

	        switch (words[0]) {
	            case 'format':
	                if (words[1] !== 'binary_little_endian') {
	                    throw new Error('Unsupported ply format');
	                }
	                break;
	            case 'element':
	                elements.push({
	                    name: words[1],
	                    count: parseInt(words[2], 10),
	                    properties: []
	                });
	                break;
	            case 'property': {
	                if (!dataTypeMap.has(words[1])) {
	                    throw new Error(`Unrecognized property data type '${words[1]}' in ply header`);
	                }
	                const element = elements[elements.length - 1];
	                const storageType = dataTypeMap.get(words[1]);
	                const storage = (!propertyFilter || propertyFilter(words[2])) ? new storageType(element.count) : null;
	                element.properties.push({
	                    type: words[1],
	                    name: words[2],
	                    storage: storage,
	                    byteSize: storageType.BYTES_PER_ELEMENT
	                });
	                break;
	            }
	            default:
	                throw new Error(`Unrecognized header value '${words[0]}' in ply header`);
	        }
	    }

	    // read data
	    let readIndex = endHeaderIndex + endHeaderBytes.length;
	    let remaining = buf.length - readIndex;
	    let dataView = new DataView(buf.buffer);

	    for (let i = 0; i < elements.length; ++i) {
	        const element = elements[i];

	        for (let e = 0; e < element.count; ++e) {
	            for (let j = 0; j < element.properties.length; ++j) {
	                const property = element.properties[j];

	                // if we've run out of data, load the next chunk
	                while (remaining < property.byteSize) {
	                    const { value, done } = await reader.read();

	                    if (done) {
	                        throw new Error('Stream finished before end of data');
	                    }

	                    // create buffer with left-over data from previous chunk and the new data
	                    const tmp = new Uint8Array(remaining + value.byteLength);
	                    tmp.set(buf.slice(readIndex));
	                    tmp.set(value, remaining);

	                    buf = tmp;
	                    dataView = new DataView(buf.buffer);
	                    readIndex = 0;
	                    remaining = buf.length;
	                }

	                if (property.storage) {
	                    switch (property.type) {
	                        case 'char':
	                            property.storage[e] = dataView.getInt8(readIndex);
	                            break;
	                        case 'uchar':
	                            property.storage[e] = dataView.getUint8(readIndex);
	                            break;
	                        case 'short':
	                            property.storage[e] = dataView.getInt16(readIndex, true);
	                            break;
	                        case 'ushort':
	                            property.storage[e] = dataView.getUint16(readIndex, true);
	                            break;
	                        case 'int':
	                            property.storage[e] = dataView.getInt32(readIndex, true);
	                            break;
	                        case 'uint':
	                            property.storage[e] = dataView.getUint32(readIndex, true);
	                            break;
	                        case 'float':
	                            property.storage[e] = dataView.getFloat32(readIndex, true);
	                            break;
	                        case 'double':
	                            property.storage[e] = dataView.getFloat64(readIndex, true);
	                            break;
	                    }
	                }

	                readIndex += property.byteSize;
	                remaining -= property.byteSize;
	            }
	        }
	    }

	    // console.log(elements);

	    return elements;
	};

	// filter out element data we're not going to use
	const defaultElements = [
	    'x', 'y', 'z',
	    'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity',
	    'rot_0', 'rot_1', 'rot_2', 'rot_3',
	    'scale_0', 'scale_1', 'scale_2'
	];

	const defaultElementsSet = new Set(defaultElements);
	const defaultElementFilter = val => defaultElementsSet.has(val);

	class PlyParser {
	    device;

	    assets;

	    maxRetries;

	    constructor(device, assets, maxRetries) {
	        this.device = device;
	        this.assets = assets;
	        this.maxRetries = maxRetries;
	    }

	    async load(url, callback, asset) {
	        const response = await fetch(url.load);
	        readPly(response.body.getReader(), asset.data.elementFilter ?? defaultElementFilter)
	            .then((response) => {
	                callback(null, new SplatContainerResource(this.device, new SplatData(response)));
	            })
	            .catch((err) => {
	                callback(err, null);
	            });
	    }

	    open(url, data) {
	        return data;
	    }
	}

	const registerPlyParser = (app) => {
	    const containerHandler = app.loader.getHandler('container');
	    containerHandler.parsers.ply = new PlyParser(app.graphicsDevice, app.assets, app.loader.maxRetries);
	};

	const getDefaultPlyElements = () => {
	    return defaultElements.slice();
	};

	const fragmentShader = `
    uniform sampler2D sceneTexture;
    uniform sampler2D bloomTexture;
    uniform float bloomIntensity;
    varying vec2 uv0;
    void main() {
        vec4 scene = texture2D(sceneTexture, uv0);
        vec3 bloom = texture2D(bloomTexture, uv0).rgb;

        vec3 result = scene.rgb;
        result += bloom * bloomIntensity;
        result = toneMap(result);
        result = gammaCorrectOutput(result);

        gl_FragColor = vec4(result, scene.a);
    }
`;

	class RenderPassCompose extends playcanvas.RenderPassShaderQuad {
	    bloomIntensity = 0.01;

	    _toneMapping = playcanvas.TONEMAP_ACES2;

	    _shaderDirty = true;

	    _key = '';

	    constructor(graphicsDevice) {
	        super(graphicsDevice);

	        this.sceneTextureId = graphicsDevice.scope.resolve('sceneTexture');
	        this.bloomTextureId = graphicsDevice.scope.resolve('bloomTexture');
	        this.bloomIntensityId = graphicsDevice.scope.resolve('bloomIntensity');
	    }

	    set toneMapping(value) {
	        if (this._toneMapping !== value) {
	            this._toneMapping = value;
	            this._shaderDirty = true;
	        }
	    }

	    get toneMapping() {
	        return this._toneMapping;
	    }

	    get toneMapChunk() {
	        switch (this.toneMapping) {
	            case playcanvas.TONEMAP_LINEAR: return playcanvas.shaderChunks.tonemappingLinearPS;
	            case playcanvas.TONEMAP_FILMIC: return playcanvas.shaderChunks.tonemappingFilmicPS;
	            case playcanvas.TONEMAP_HEJL: return playcanvas.shaderChunks.tonemappingHejlPS;
	            case playcanvas.TONEMAP_ACES: return playcanvas.shaderChunks.tonemappingAcesPS;
	            case playcanvas.TONEMAP_ACES2: return playcanvas.shaderChunks.tonemappingAces2PS;
	        }
	        return playcanvas.shaderChunks.tonemappingNonePS;
	    }

	    postInit() {
	        // clear all buffers to avoid them being loaded from memory
	        this.setClearColor(playcanvas.Color.BLACK);
	        this.setClearDepth(1.0);
	        this.setClearStencil(0);
	    }

	    frameUpdate() {

	        if (this._shaderDirty) {
	            this._shaderDirty = false;

	            const key = `${this.toneMapping}`;
	            if (this._key !== key) {
	                this._key = key;

	                const fsChunks =
	                playcanvas.shaderChunks.decodePS +
	                playcanvas.shaderChunks.gamma2_2PS +
	                this.toneMapChunk;

	                this.shader = this.createQuadShader(`ComposeShader-${key}`, fsChunks + fragmentShader);
	            }
	        }
	    }

	    execute() {

	        this.sceneTextureId.setValue(this.sceneTexture);
	        this.bloomTextureId.setValue(this.bloomTexture);
	        this.bloomIntensityId.setValue(this.bloomIntensity);

	        super.execute();
	    }
	}

	class RenderPassDownSample extends playcanvas.RenderPassShaderQuad {
	    constructor(device, sourceTexture) {
	        super(device);
	        this.sourceTexture = sourceTexture;
	        this.shader = this.createQuadShader('DownSampleShader', `

            uniform sampler2D sourceTexture;
            uniform vec2 sourceInvResolution;
            varying vec2 uv0;

            void main()
            {
                float x = sourceInvResolution.x;
                float y = sourceInvResolution.y;

                vec3 a = texture2D (sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y + 2.0 * y)).rgb;
                vec3 b = texture2D (sourceTexture, vec2 (uv0.x,           uv0.y + 2.0 * y)).rgb;
                vec3 c = texture2D (sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y + 2.0 * y)).rgb;

                vec3 d = texture2D (sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y)).rgb;
                vec3 e = texture2D (sourceTexture, vec2 (uv0.x,           uv0.y)).rgb;
                vec3 f = texture2D (sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y)).rgb;

                vec3 g = texture2D (sourceTexture, vec2 (uv0.x - 2.0 * x, uv0.y - 2.0 * y)).rgb;
                vec3 h = texture2D (sourceTexture, vec2 (uv0.x,           uv0.y - 2.0 * y)).rgb;
                vec3 i = texture2D (sourceTexture, vec2 (uv0.x + 2.0 * x, uv0.y - 2.0 * y)).rgb;

                vec3 j = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y + y)).rgb;
                vec3 k = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y + y)).rgb;
                vec3 l = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y - y)).rgb;
                vec3 m = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y - y)).rgb;

                vec3 value = e * 0.125;
                value += (a + c + g + i) * 0.03125;
                value += (b + d + f + h) * 0.0625;
                value += (j + k + l + m) * 0.125;

                gl_FragColor = vec4(value, 1.0);
            }`
	        );

	        this.sourceTextureId = device.scope.resolve('sourceTexture');
	        this.sourceInvResolutionId = device.scope.resolve('sourceInvResolution');
	        this.sourceInvResolutionValue = new Float32Array(2);
	    }

	    execute() {
	        this.sourceTextureId.setValue(this.sourceTexture);

	        this.sourceInvResolutionValue[0] = 1.0 / this.sourceTexture.width;
	        this.sourceInvResolutionValue[1] = 1.0 / this.sourceTexture.height;
	        this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);

	        super.execute();
	    }
	}

	class RenderPassUpSample extends playcanvas.RenderPassShaderQuad {
	    constructor(device, sourceTexture) {
	        super(device);
	        this.sourceTexture = sourceTexture;

	        this.shader = this.createQuadShader('UpSampleShader', `

            uniform sampler2D sourceTexture;
            uniform vec2 sourceInvResolution;
            varying vec2 uv0;

            void main()
            {
                float x = sourceInvResolution.x;
                float y = sourceInvResolution.y;

                vec3 a = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y + y)).rgb;
                vec3 b = texture2D (sourceTexture, vec2 (uv0.x,     uv0.y + y)).rgb;
                vec3 c = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y + y)).rgb;

                vec3 d = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y)).rgb;
                vec3 e = texture2D (sourceTexture, vec2 (uv0.x,     uv0.y)).rgb;
                vec3 f = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y)).rgb;

                vec3 g = texture2D (sourceTexture, vec2 (uv0.x - x, uv0.y - y)).rgb;
                vec3 h = texture2D (sourceTexture, vec2 (uv0.x,     uv0.y - y)).rgb;
                vec3 i = texture2D (sourceTexture, vec2 (uv0.x + x, uv0.y - y)).rgb;

                vec3 value = e * 4.0;
                value += (b + d + f + h) * 2.0;
                value += (a + c + g + i);
                value *= 1.0 / 16.0;

                gl_FragColor = vec4(value, 1.0);
            }`
	        );

	        this.sourceTextureId = device.scope.resolve('sourceTexture');
	        this.sourceInvResolutionId = device.scope.resolve('sourceInvResolution');
	        this.sourceInvResolutionValue = new Float32Array(2);
	    }

	    execute() {
	        this.sourceTextureId.setValue(this.sourceTexture);

	        this.sourceInvResolutionValue[0] = 1.0 / this.sourceTexture.width;
	        this.sourceInvResolutionValue[1] = 1.0 / this.sourceTexture.height;
	        this.sourceInvResolutionId.setValue(this.sourceInvResolutionValue);

	        super.execute();
	    }
	}

	// based on https://learnopengl.com/Guest-Articles/2022/Phys.-Based-Bloom

	class RenderPassBloom extends playcanvas.RenderPass {
	    bloomTexture;

	    lastMipLevel = 1;

	    bloomRenderTarget;

	    textureFormat;

	    renderTargets = [];

	    constructor(device, sourceTexture, format) {
	        super(device);
	        this.sourceTexture = sourceTexture;
	        this.textureFormat = format;

	        this.bloomRenderTarget = this.createRenderTarget(0);
	        this.bloomTexture = this.bloomRenderTarget.colorBuffer;
	    }

	    destroy() {
	        this.destroyRenderPasses();
	        this.destroyRenderTargets();
	    }

	    destroyRenderTargets(startIndex = 0) {
	        for (let i = startIndex; i < this.renderTargets.length; i++) {
	            const rt = this.renderTargets[i];
	            rt.destroyTextureBuffers();
	            rt.destroy();
	        }
	        this.renderTargets.length = 0;
	    }

	    destroyRenderPasses() {
	        for (let i = 0; i < this.beforePasses.length; i++) {
	            this.beforePasses[i].destroy();
	        }
	        this.beforePasses.length = 0;
	    }

	    createRenderTarget(index) {
	        return new playcanvas.RenderTarget({
	            depth: false,
	            colorBuffer: new playcanvas.Texture(this.device, {
	                name: `BloomTexture${index}`,
	                width: 1,
	                height: 1,
	                format: this.textureFormat,
	                mipmaps: false,
	                minFilter: playcanvas.FILTER_LINEAR,
	                magFilter: playcanvas.FILTER_LINEAR,
	                addressU: playcanvas.ADDRESS_CLAMP_TO_EDGE,
	                addressV: playcanvas.ADDRESS_CLAMP_TO_EDGE
	            })
	        });
	    }

	    createRenderTargets(count) {
	        for (let i = 0; i < count; i++) {
	            const rt = i === 0 ? this.bloomRenderTarget : this.createRenderTarget(i);
	            this.renderTargets.push(rt);
	        }
	    }

	    // number of levels till hitting min size
	    calcMipLevels(width, height, minSize) {
	        const min = Math.min(width, height);
	        return Math.floor(Math.log2(min) - Math.log2(minSize));
	    }

	    createRenderPasses(numPasses) {

	        const device = this.device;

	        // progressive downscale
	        let passSourceTexture = this.sourceTexture;
	        for (let i = 0; i < numPasses; i++) {

	            const pass = new RenderPassDownSample(device, passSourceTexture);
	            const rt = this.renderTargets[i];
	            pass.init(rt, {
	                resizeSource: passSourceTexture,
	                scaleX: 0.5,
	                scaleY: 0.5
	            });
	            pass.setClearColor(playcanvas.Color.BLACK);  // clear when down-scaling
	            this.beforePasses.push(pass);
	            passSourceTexture = rt.colorBuffer;
	        }

	        // progressive upscale
	        passSourceTexture = this.renderTargets[numPasses - 1].colorBuffer;
	        for (let i = numPasses - 2; i >= 0; i--) {

	            const pass = new RenderPassUpSample(device, passSourceTexture);
	            const rt = this.renderTargets[i];
	            pass.init(rt);
	            pass.blendState = playcanvas.BlendState.ADDBLEND;  // blend when up-scaling
	            this.beforePasses.push(pass);
	            passSourceTexture = rt.colorBuffer;
	        }
	    }

	    frameUpdate() {
	        super.frameUpdate();

	        // create an appropriate amount of render passes
	        let numPasses = this.calcMipLevels(this.sourceTexture.width, this.sourceTexture.height, 2 ** this.lastMipLevel);
	        numPasses = Math.max(1, numPasses);

	        if (this.renderTargets.length !== numPasses) {

	            this.destroyRenderPasses();
	            this.destroyRenderTargets(1);
	            this.createRenderTargets(numPasses);
	            this.createRenderPasses(numPasses);
	        }
	    }
	}

	exports.GltfExporter = GltfExporter;
	exports.MiniStats = MiniStats;
	exports.RenderPassBloom = RenderPassBloom;
	exports.RenderPassCompose = RenderPassCompose;
	exports.RenderPassDownSample = RenderPassDownSample;
	exports.RenderPassUpSample = RenderPassUpSample;
	exports.Splat = Splat;
	exports.SplatData = SplatData;
	exports.SplatInstance = SplatInstance;
	exports.UsdzExporter = UsdzExporter;
	exports.getDefaultPlyElements = getDefaultPlyElements;
	exports.registerPlyParser = registerPlyParser;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
