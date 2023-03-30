/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { VertexFormat, SEMANTIC_POSITION, TYPE_FLOAT32, SEMANTIC_TEXCOORD0, shaderChunks, VertexBuffer, BUFFER_STREAM, IndexBuffer, INDEXFORMAT_UINT16, BUFFER_STATIC, BlendState, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_ONE, PRIMITIVE_TRIANGLES, CULLFACE_NONE, DepthState } from 'playcanvas';

class Render2d {
	constructor(device, colors, maxQuads = 512) {
		const vertexShader = 'attribute vec3 vertex_position;\n' + 'attribute vec4 vertex_texCoord0;\n' + 'uniform vec4 screenAndTextureSize;\n' + 'varying vec4 uv0;\n' + 'varying float enabled;\n' + 'void main(void) {\n' + '    vec2 pos = vertex_position.xy / screenAndTextureSize.xy;\n' + '    gl_Position = vec4(pos * 2.0 - 1.0, 0.5, 1.0);\n' + '    uv0 = vec4(vertex_texCoord0.xy / screenAndTextureSize.zw, vertex_texCoord0.zw);\n' + '    enabled = vertex_position.z;\n' + '}\n';
		const fragmentShader = 'varying vec4 uv0;\n' + 'varying float enabled;\n' + 'uniform vec4 clr;\n' + 'uniform vec4 col0;\n' + 'uniform vec4 col1;\n' + 'uniform vec4 col2;\n' + 'uniform vec4 watermark;\n' + 'uniform float watermarkSize;\n' + 'uniform vec4 background;\n' + 'uniform sampler2D source;\n' + 'void main (void) {\n' + '    vec4 tex = texture2D(source, uv0.xy);\n' + '    if (!(tex.rgb == vec3(1.0, 1.0, 1.0))) {\n' + '       if (enabled < 0.5)\n' + '           tex = background;\n' + '       else if (abs(uv0.w - tex.a) < watermarkSize)\n' + '           tex = watermark;\n' + '       else if (uv0.w < tex.r)\n' + '           tex = col0;\n' + '       else if (uv0.w < tex.g)\n' + '           tex = col1;\n' + '       else if (uv0.w < tex.b)\n' + '           tex = col2;\n' + '       else\n' + '           tex = background;\n' + '    }\n' + '    gl_FragColor = tex * clr;\n' + '}\n';
		const format = new VertexFormat(device, [{
			semantic: SEMANTIC_POSITION,
			components: 3,
			type: TYPE_FLOAT32
		}, {
			semantic: SEMANTIC_TEXCOORD0,
			components: 4,
			type: TYPE_FLOAT32
		}]);
		const indices = new Uint16Array(maxQuads * 6);
		for (let i = 0; i < maxQuads; ++i) {
			indices[i * 6 + 0] = i * 4;
			indices[i * 6 + 1] = i * 4 + 1;
			indices[i * 6 + 2] = i * 4 + 2;
			indices[i * 6 + 3] = i * 4;
			indices[i * 6 + 4] = i * 4 + 2;
			indices[i * 6 + 5] = i * 4 + 3;
		}
		this.device = device;
		this.shader = shaderChunks.createShaderFromCode(device, vertexShader, fragmentShader, 'mini-stats');
		this.buffer = new VertexBuffer(device, format, maxQuads * 4, BUFFER_STREAM);
		this.data = new Float32Array(this.buffer.numBytes / 4);
		this.indexBuffer = new IndexBuffer(device, INDEXFORMAT_UINT16, maxQuads * 6, BUFFER_STATIC, indices);
		this.prims = [];
		this.prim = null;
		this.primIndex = -1;
		this.quads = 0;
		const setupColor = (name, value) => {
			this[name] = new Float32Array([value.r, value.g, value.b, value.a]);
			this[name + 'Id'] = device.scope.resolve(name);
		};
		setupColor('col0', colors.graph0);
		setupColor('col1', colors.graph1);
		setupColor('col2', colors.graph2);
		setupColor('watermark', colors.watermark);
		setupColor('background', colors.background);
		this.watermarkSizeId = device.scope.resolve('watermarkSize');
		this.clrId = device.scope.resolve('clr');
		this.clr = new Float32Array(4);
		this.screenTextureSizeId = device.scope.resolve('screenAndTextureSize');
		this.screenTextureSize = new Float32Array(4);
		this.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDEQUATION_ADD, BLENDMODE_ONE, BLENDMODE_ONE);
	}
	quad(texture, x, y, w, h, u, v, uw, uh, enabled) {
		const quad = this.quads++;
		let prim = this.prim;
		if (prim && prim.texture === texture) {
			prim.count += 6;
		} else {
			this.primIndex++;
			if (this.primIndex === this.prims.length) {
				prim = {
					type: PRIMITIVE_TRIANGLES,
					indexed: true,
					base: quad * 6,
					count: 6,
					texture: texture
				};
				this.prims.push(prim);
			} else {
				prim = this.prims[this.primIndex];
				prim.base = quad * 6;
				prim.count = 6;
				prim.texture = texture;
			}
			this.prim = prim;
		}
		const x1 = x + w;
		const y1 = y + h;
		const u1 = u + (uw === undefined ? w : uw);
		const v1 = v + (uh === undefined ? h : uh);
		const colorize = enabled ? 1 : 0;
		this.data.set([x, y, colorize, u, v, 0, 0, x1, y, colorize, u1, v, 1, 0, x1, y1, colorize, u1, v1, 1, 1, x, y1, colorize, u, v1, 0, 1], 4 * 7 * quad);
	}
	render(clr, height) {
		const device = this.device;
		const buffer = this.buffer;
		buffer.setData(this.data.buffer);
		device.updateBegin();
		device.setCullMode(CULLFACE_NONE);
		device.setBlendState(this.blendState);
		device.setDepthState(DepthState.NODEPTH);
		device.setVertexBuffer(buffer, 0);
		device.setIndexBuffer(this.indexBuffer);
		device.setShader(this.shader);
		const pr = Math.min(device.maxPixelRatio, window.devicePixelRatio);
		this.clr.set(clr, 0);
		this.clrId.setValue(this.clr);
		this.screenTextureSize[0] = device.width / pr;
		this.screenTextureSize[1] = device.height / pr;
		this.col0Id.setValue(this.col0);
		this.col1Id.setValue(this.col1);
		this.col2Id.setValue(this.col2);
		this.watermarkId.setValue(this.watermark);
		this.backgroundId.setValue(this.background);
		for (let i = 0; i <= this.primIndex; ++i) {
			const prim = this.prims[i];
			this.screenTextureSize[2] = prim.texture.width;
			this.screenTextureSize[3] = prim.texture.height;
			this.screenTextureSizeId.setValue(this.screenTextureSize);
			device.constantTexSource.setValue(prim.texture);
			this.watermarkSizeId.setValue(0.5 / height);
			device.draw(prim);
		}
		device.updateEnd();
		this.prim = null;
		this.primIndex = -1;
		this.quads = 0;
	}
}

export { Render2d };
