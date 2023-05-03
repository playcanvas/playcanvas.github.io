import { PRIMITIVE_TRISTRIP } from '../../platform/graphics/constants.js';
import { BLEND_NORMAL } from '../constants.js';
import { GraphNode } from '../graph-node.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { BasicMaterial } from '../materials/basic-material.js';
import { createShaderFromCode } from '../shader-lib/utils.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { ImmediateBatches } from './immediate-batches.js';

const tempPoints = [];
class Immediate {
	constructor(device) {
		this.device = device;
		this.quadMesh = null;
		this.textureShader = null;
		this.depthTextureShader = null;
		this.cubeLocalPos = null;
		this.cubeWorldPos = null;
		this.batchesMap = new Map();
		this.allBatches = new Set();
		this.updatedLayers = new Set();
		this._materialDepth = null;
		this._materialNoDepth = null;
		this.layerMeshInstances = new Map();
	}
	createMaterial(depthTest) {
		const material = new BasicMaterial();
		material.vertexColors = true;
		material.blendType = BLEND_NORMAL;
		material.depthTest = depthTest;
		material.update();
		return material;
	}
	get materialDepth() {
		if (!this._materialDepth) {
			this._materialDepth = this.createMaterial(true);
		}
		return this._materialDepth;
	}
	get materialNoDepth() {
		if (!this._materialNoDepth) {
			this._materialNoDepth = this.createMaterial(false);
		}
		return this._materialNoDepth;
	}
	getBatch(layer, depthTest) {
		let batches = this.batchesMap.get(layer);
		if (!batches) {
			batches = new ImmediateBatches(this.device);
			this.batchesMap.set(layer, batches);
		}
		this.allBatches.add(batches);
		const material = depthTest ? this.materialDepth : this.materialNoDepth;
		return batches.getBatch(material, layer);
	}
	getShader(id, fragment) {
		if (!this[id]) {
			const vertex = `
								attribute vec2 vertex_position;
								uniform mat4 matrix_model;
								varying vec2 uv0;
								void main(void) {
										gl_Position = matrix_model * vec4(vertex_position, 0, 1);
										uv0 = vertex_position.xy + 0.5;
								}
						`;
			this[id] = createShaderFromCode(this.device, vertex, fragment, `DebugShader:${id}`);
		}
		return this[id];
	}
	getTextureShader() {
		return this.getShader('textureShader', `
						varying vec2 uv0;
						uniform sampler2D colorMap;
						void main (void) {
								gl_FragColor = vec4(texture2D(colorMap, uv0).xyz, 1);
						}
				`);
	}
	getUnfilterableTextureShader() {
		return this.getShader('textureShaderUnfilterable', `
						varying vec2 uv0;
						uniform highp sampler2D colorMap;
						void main (void) {
								ivec2 uv = ivec2(uv0 * textureSize(colorMap, 0));
								gl_FragColor = vec4(texelFetch(colorMap, uv, 0).xyz, 1);
						}
				`);
	}
	getDepthTextureShader() {
		return this.getShader('depthTextureShader', `
						${shaderChunks.screenDepthPS}
						varying vec2 uv0;
						void main() {
								float depth = getLinearScreenDepth(uv0) * camera_params.x;
								gl_FragColor = vec4(vec3(depth), 1.0);
						}
				`);
	}
	getQuadMesh() {
		if (!this.quadMesh) {
			this.quadMesh = new Mesh(this.device);
			this.quadMesh.setPositions([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0]);
			this.quadMesh.update(PRIMITIVE_TRISTRIP);
		}
		return this.quadMesh;
	}
	drawMesh(material, matrix, mesh, meshInstance, layer) {
		if (!meshInstance) {
			const graphNode = this.getGraphNode(matrix);
			meshInstance = new MeshInstance(mesh, material, graphNode);
		}
		let layerMeshInstances = this.layerMeshInstances.get(layer);
		if (!layerMeshInstances) {
			layerMeshInstances = [];
			this.layerMeshInstances.set(layer, layerMeshInstances);
		}
		layerMeshInstances.push(meshInstance);
	}
	drawWireAlignedBox(min, max, color, depthTest, layer) {
		tempPoints.push(min.x, min.y, min.z, min.x, max.y, min.z, min.x, max.y, min.z, max.x, max.y, min.z, max.x, max.y, min.z, max.x, min.y, min.z, max.x, min.y, min.z, min.x, min.y, min.z, min.x, min.y, max.z, min.x, max.y, max.z, min.x, max.y, max.z, max.x, max.y, max.z, max.x, max.y, max.z, max.x, min.y, max.z, max.x, min.y, max.z, min.x, min.y, max.z, min.x, min.y, min.z, min.x, min.y, max.z, min.x, max.y, min.z, min.x, max.y, max.z, max.x, max.y, min.z, max.x, max.y, max.z, max.x, min.y, min.z, max.x, min.y, max.z);
		const batch = this.getBatch(layer, depthTest);
		batch.addLinesArrays(tempPoints, color);
		tempPoints.length = 0;
	}
	drawWireSphere(center, radius, color, numSegments, depthTest, layer) {
		const step = 2 * Math.PI / numSegments;
		let angle = 0;
		for (let i = 0; i < numSegments; i++) {
			const sin0 = Math.sin(angle);
			const cos0 = Math.cos(angle);
			angle += step;
			const sin1 = Math.sin(angle);
			const cos1 = Math.cos(angle);
			tempPoints.push(center.x + radius * sin0, center.y, center.z + radius * cos0);
			tempPoints.push(center.x + radius * sin1, center.y, center.z + radius * cos1);
			tempPoints.push(center.x + radius * sin0, center.y + radius * cos0, center.z);
			tempPoints.push(center.x + radius * sin1, center.y + radius * cos1, center.z);
			tempPoints.push(center.x, center.y + radius * sin0, center.z + radius * cos0);
			tempPoints.push(center.x, center.y + radius * sin1, center.z + radius * cos1);
		}
		const batch = this.getBatch(layer, depthTest);
		batch.addLinesArrays(tempPoints, color);
		tempPoints.length = 0;
	}
	getGraphNode(matrix) {
		const graphNode = new GraphNode('ImmediateDebug');
		graphNode.worldTransform = matrix;
		graphNode._dirtyWorld = graphNode._dirtyNormal = false;
		return graphNode;
	}
	onPreRenderLayer(layer, visibleList, transparent) {
		this.batchesMap.forEach((batches, batchLayer) => {
			if (batchLayer === layer) {
				batches.onPreRender(visibleList, transparent);
			}
		});
		if (!this.updatedLayers.has(layer)) {
			this.updatedLayers.add(layer);
			const meshInstances = this.layerMeshInstances.get(layer);
			if (meshInstances) {
				for (let i = 0; i < meshInstances.length; i++) {
					visibleList.list[visibleList.length + i] = meshInstances[i];
				}
				visibleList.length += meshInstances.length;
				meshInstances.length = 0;
			}
		}
	}
	onPostRender() {
		this.allBatches.clear();
		this.updatedLayers.clear();
	}
}

export { Immediate };
