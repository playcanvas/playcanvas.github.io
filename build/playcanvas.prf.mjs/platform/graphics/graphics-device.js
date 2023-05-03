import { extends as _extends } from '../../_virtual/_rollupPluginBabelHelpers.js';
import '../../core/tracing.js';
import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { now } from '../../core/time.js';
import { CLEARFLAG_COLOR, CLEARFLAG_DEPTH, PRIMITIVE_TRIFAN, SEMANTIC_POSITION, TYPE_FLOAT32, BUFFER_STATIC, CULLFACE_BACK, PRIMITIVE_POINTS } from './constants.js';
import { BlendState } from './blend-state.js';
import { DepthState } from './depth-state.js';
import { ScopeSpace } from './scope-space.js';
import { VertexBuffer } from './vertex-buffer.js';
import { VertexFormat } from './vertex-format.js';
import { StencilParameters } from './stencil-parameters.js';

class GraphicsDevice extends EventHandler {
	constructor(canvas, options) {
		var _this$initOptions, _this$initOptions$dep, _this$initOptions2, _this$initOptions2$st, _this$initOptions3, _this$initOptions3$an, _this$initOptions4, _this$initOptions4$po;
		super();
		this.canvas = void 0;
		this.isWebGPU = false;
		this.scope = void 0;
		this.boneLimit = void 0;
		this.maxAnisotropy = void 0;
		this.maxCubeMapSize = void 0;
		this.maxTextureSize = void 0;
		this.maxVolumeSize = void 0;
		this.precision = void 0;
		this.samples = void 0;
		this.supportsStencil = void 0;
		this.renderTarget = null;
		this.renderPassIndex = void 0;
		this.insideRenderPass = false;
		this.supportsInstancing = void 0;
		this.supportsUniformBuffers = false;
		this.textureFloatRenderable = void 0;
		this.textureHalfFloatRenderable = void 0;
		this.quadVertexBuffer = void 0;
		this.blendState = new BlendState();
		this.depthState = new DepthState();
		this.stencilEnabled = false;
		this.stencilFront = new StencilParameters();
		this.stencilBack = new StencilParameters();
		this.defaultClearOptions = {
			color: [0, 0, 0, 1],
			depth: 1,
			stencil: 0,
			flags: CLEARFLAG_COLOR | CLEARFLAG_DEPTH
		};
		this.canvas = canvas;
		this.initOptions = _extends({}, options);
		(_this$initOptions$dep = (_this$initOptions = this.initOptions).depth) != null ? _this$initOptions$dep : _this$initOptions.depth = true;
		(_this$initOptions2$st = (_this$initOptions2 = this.initOptions).stencil) != null ? _this$initOptions2$st : _this$initOptions2.stencil = true;
		(_this$initOptions3$an = (_this$initOptions3 = this.initOptions).antialias) != null ? _this$initOptions3$an : _this$initOptions3.antialias = true;
		(_this$initOptions4$po = (_this$initOptions4 = this.initOptions).powerPreference) != null ? _this$initOptions4$po : _this$initOptions4.powerPreference = 'high-performance';
		this._width = 0;
		this._height = 0;
		this._maxPixelRatio = platform.browser ? Math.min(1, window.devicePixelRatio) : 1;
		this.shaders = [];
		this.buffers = [];
		this.textures = [];
		this.targets = [];
		this._vram = {
			texShadow: 0,
			texAsset: 0,
			texLightmap: 0,
			tex: 0,
			vb: 0,
			ib: 0,
			ub: 0
		};
		this._shaderStats = {
			vsCompiled: 0,
			fsCompiled: 0,
			linked: 0,
			materialShaders: 0,
			compileTime: 0
		};
		this.initializeContextCaches();
		this._drawCallsPerFrame = 0;
		this._shaderSwitchesPerFrame = 0;
		this._primsPerFrame = [];
		for (let i = PRIMITIVE_POINTS; i <= PRIMITIVE_TRIFAN; i++) {
			this._primsPerFrame[i] = 0;
		}
		this._renderTargetCreationTime = 0;
		this.scope = new ScopeSpace("Device");
		this.textureBias = this.scope.resolve("textureBias");
		this.textureBias.setValue(0.0);
	}
	postInit() {
		const vertexFormat = new VertexFormat(this, [{
			semantic: SEMANTIC_POSITION,
			components: 2,
			type: TYPE_FLOAT32
		}]);
		const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
		this.quadVertexBuffer = new VertexBuffer(this, vertexFormat, 4, BUFFER_STATIC, positions);
	}
	destroy() {
		var _this$quadVertexBuffe;
		this.fire('destroy');
		(_this$quadVertexBuffe = this.quadVertexBuffer) == null ? void 0 : _this$quadVertexBuffe.destroy();
		this.quadVertexBuffer = null;
	}
	onDestroyShader(shader) {
		this.fire('destroy:shader', shader);
		const idx = this.shaders.indexOf(shader);
		if (idx !== -1) {
			this.shaders.splice(idx, 1);
		}
	}
	postDestroy() {
		this.scope = null;
		this.canvas = null;
	}
	toJSON(key) {
		return undefined;
	}
	initializeContextCaches() {
		this.indexBuffer = null;
		this.vertexBuffers = [];
		this.shader = null;
		this.renderTarget = null;
	}
	initializeRenderState() {
		this.blendState = new BlendState();
		this.depthState = new DepthState();
		this.cullMode = CULLFACE_BACK;
		this.vx = this.vy = this.vw = this.vh = 0;
		this.sx = this.sy = this.sw = this.sh = 0;
	}
	setStencilState(stencilFront, stencilBack) {}
	setBlendState(blendState) {}
	setDepthState(depthState) {}
	setCullMode(cullMode) {}
	setRenderTarget(renderTarget) {
		this.renderTarget = renderTarget;
	}
	setIndexBuffer(indexBuffer) {
		this.indexBuffer = indexBuffer;
	}
	setVertexBuffer(vertexBuffer) {
		if (vertexBuffer) {
			this.vertexBuffers.push(vertexBuffer);
		}
	}
	getRenderTarget() {
		return this.renderTarget;
	}
	initRenderTarget(target) {
		if (target.initialized) return;
		const startTime = now();
		this.fire('fbo:create', {
			timestamp: startTime,
			target: this
		});
		target.init();
		this.targets.push(target);
		this._renderTargetCreationTime += now() - startTime;
	}
	_isBrowserInterface(texture) {
		return this._isImageBrowserInterface(texture) || this._isImageCanvasInterface(texture) || this._isImageVideoInterface(texture);
	}
	_isImageBrowserInterface(texture) {
		return typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap || typeof HTMLImageElement !== 'undefined' && texture instanceof HTMLImageElement;
	}
	_isImageCanvasInterface(texture) {
		return typeof HTMLCanvasElement !== 'undefined' && texture instanceof HTMLCanvasElement;
	}
	_isImageVideoInterface(texture) {
		return typeof HTMLVideoElement !== 'undefined' && texture instanceof HTMLVideoElement;
	}
	resizeCanvas(width, height) {}
	setResolution(width, height) {
		this._width = width;
		this._height = height;
		this.canvas.width = width;
		this.canvas.height = height;
		this.fire(GraphicsDevice.EVENT_RESIZE, width, height);
	}
	updateClientRect() {
		this.clientRect = this.canvas.getBoundingClientRect();
	}
	get width() {
		return this.canvas.width;
	}
	get height() {
		return this.canvas.height;
	}
	set fullscreen(fullscreen) {}
	get fullscreen() {
		return false;
	}
	set maxPixelRatio(ratio) {
		if (this._maxPixelRatio !== ratio) {
			this._maxPixelRatio = ratio;
			this.resizeCanvas(this._width, this._height);
		}
	}
	get maxPixelRatio() {
		return this._maxPixelRatio;
	}
	get deviceType() {
		return this._deviceType;
	}
	getBoneLimit() {
		return this.boneLimit;
	}
	setBoneLimit(maxBones) {
		this.boneLimit = maxBones;
	}
	frameStart() {
		this.renderPassIndex = 0;
	}
}
GraphicsDevice.EVENT_RESIZE = 'resizecanvas';

export { GraphicsDevice };
