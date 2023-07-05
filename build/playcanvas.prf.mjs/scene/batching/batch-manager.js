import '../../core/debug.js';
import { now } from '../../core/time.js';
import { Mat3 } from '../../core/math/mat3.js';
import { Vec3 } from '../../core/math/vec3.js';
import { BoundingBox } from '../../core/shape/bounding-box.js';
import { PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, SEMANTIC_BLENDINDICES, TYPE_FLOAT32, typedArrayTypes, typedArrayTypesByteSize, SEMANTIC_POSITION, SEMANTIC_NORMAL, SEMANTIC_TANGENT, typedArrayIndexFormats, PRIMITIVE_TRIANGLES } from '../../platform/graphics/constants.js';
import { SPRITE_RENDERMODE_SIMPLE } from '../constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { shaderChunks } from '../shader-lib/chunks/chunks.js';
import { Batch } from './batch.js';
import { BatchGroup } from './batch-group.js';
import { SkinBatchInstance } from './skin-batch-instance.js';

function paramsIdentical(a, b) {
	if (a && !b) return false;
	if (!a && b) return false;
	a = a.data;
	b = b.data;
	if (a === b) return true;
	if (a instanceof Float32Array && b instanceof Float32Array) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}
	return false;
}
function equalParamSets(params1, params2) {
	for (const param in params1) {
		if (params1.hasOwnProperty(param) && !paramsIdentical(params1[param], params2[param])) return false;
	}
	for (const param in params2) {
		if (params2.hasOwnProperty(param) && !paramsIdentical(params2[param], params1[param])) return false;
	}
	return true;
}
function equalLightLists(lightList1, lightList2) {
	for (let k = 0; k < lightList1.length; k++) {
		if (lightList2.indexOf(lightList1[k]) < 0) return false;
	}
	for (let k = 0; k < lightList2.length; k++) {
		if (lightList1.indexOf(lightList2[k]) < 0) return false;
	}
	return true;
}
const _triFanIndices = [0, 1, 3, 2, 3, 1];
const _triStripIndices = [0, 1, 3, 0, 3, 2];
const mat3 = new Mat3();
function getScaleSign(mi) {
	return mi.node.worldTransform.scaleSign;
}
class BatchManager {
	constructor(device, root, scene) {
		this.device = device;
		this.rootNode = root;
		this.scene = scene;
		this._init = false;
		this._batchGroups = {};
		this._batchGroupCounter = 0;
		this._batchList = [];
		this._dirtyGroups = [];
		this._stats = {
			createTime: 0,
			updateLastFrameTime: 0
		};
	}
	destroy() {
		this.device = null;
		this.rootNode = null;
		this.scene = null;
		this._batchGroups = {};
		this._batchList = [];
		this._dirtyGroups = [];
	}
	addGroup(name, dynamic, maxAabbSize, id, layers) {
		if (id === undefined) {
			id = this._batchGroupCounter;
			this._batchGroupCounter++;
		}
		if (this._batchGroups[id]) {
			return undefined;
		}
		const group = new BatchGroup(id, name, dynamic, maxAabbSize, layers);
		this._batchGroups[id] = group;
		return group;
	}
	removeGroup(id) {
		if (!this._batchGroups[id]) {
			return;
		}
		const newBatchList = [];
		for (let i = 0; i < this._batchList.length; i++) {
			if (this._batchList[i].batchGroupId === id) {
				this.destroyBatch(this._batchList[i]);
			} else {
				newBatchList.push(this._batchList[i]);
			}
		}
		this._batchList = newBatchList;
		this._removeModelsFromBatchGroup(this.rootNode, id);
		delete this._batchGroups[id];
	}
	markGroupDirty(id) {
		if (this._dirtyGroups.indexOf(id) < 0) {
			this._dirtyGroups.push(id);
		}
	}
	getGroupByName(name) {
		const groups = this._batchGroups;
		for (const group in groups) {
			if (!groups.hasOwnProperty(group)) continue;
			if (groups[group].name === name) {
				return groups[group];
			}
		}
		return null;
	}
	getBatches(batchGroupId) {
		const results = [];
		const len = this._batchList.length;
		for (let i = 0; i < len; i++) {
			const batch = this._batchList[i];
			if (batch.batchGroupId === batchGroupId) {
				results.push(batch);
			}
		}
		return results;
	}
	_removeModelsFromBatchGroup(node, id) {
		if (!node.enabled) return;
		if (node.model && node.model.batchGroupId === id) {
			node.model.batchGroupId = -1;
		}
		if (node.render && node.render.batchGroupId === id) {
			node.render.batchGroupId = -1;
		}
		if (node.element && node.element.batchGroupId === id) {
			node.element.batchGroupId = -1;
		}
		if (node.sprite && node.sprite.batchGroupId === id) {
			node.sprite.batchGroupId = -1;
		}
		for (let i = 0; i < node._children.length; i++) {
			this._removeModelsFromBatchGroup(node._children[i], id);
		}
	}
	insert(type, groupId, node) {
		const group = this._batchGroups[groupId];
		if (group) {
			if (group._obj[type].indexOf(node) < 0) {
				group._obj[type].push(node);
				this.markGroupDirty(groupId);
			}
		}
	}
	remove(type, groupId, node) {
		const group = this._batchGroups[groupId];
		if (group) {
			const idx = group._obj[type].indexOf(node);
			if (idx >= 0) {
				group._obj[type].splice(idx, 1);
				this.markGroupDirty(groupId);
			}
		}
	}
	_extractRender(node, arr, group, groupMeshInstances) {
		if (node.render) {
			if (node.render.isStatic) {
				const drawCalls = this.scene.drawCalls;
				const nodeMeshInstances = node.render.meshInstances;
				for (let i = 0; i < drawCalls.length; i++) {
					if (!drawCalls[i]._staticSource) continue;
					if (nodeMeshInstances.indexOf(drawCalls[i]._staticSource) < 0) continue;
					arr.push(drawCalls[i]);
				}
				for (let i = 0; i < nodeMeshInstances.length; i++) {
					if (drawCalls.indexOf(nodeMeshInstances[i]) >= 0) {
						arr.push(nodeMeshInstances[i]);
					}
				}
			} else {
				arr = groupMeshInstances[node.render.batchGroupId] = arr.concat(node.render.meshInstances);
			}
			node.render.removeFromLayers();
		}
		return arr;
	}
	_extractModel(node, arr, group, groupMeshInstances) {
		if (node.model && node.model.model) {
			if (node.model.isStatic) {
				const drawCalls = this.scene.drawCalls;
				const nodeMeshInstances = node.model.meshInstances;
				for (let i = 0; i < drawCalls.length; i++) {
					if (!drawCalls[i]._staticSource) continue;
					if (nodeMeshInstances.indexOf(drawCalls[i]._staticSource) < 0) continue;
					arr.push(drawCalls[i]);
				}
				for (let i = 0; i < nodeMeshInstances.length; i++) {
					if (drawCalls.indexOf(nodeMeshInstances[i]) >= 0) {
						arr.push(nodeMeshInstances[i]);
					}
				}
			} else {
				arr = groupMeshInstances[node.model.batchGroupId] = arr.concat(node.model.meshInstances);
			}
			node.model.removeModelFromLayers();
		}
		return arr;
	}
	_extractElement(node, arr, group) {
		if (!node.element) return;
		let valid = false;
		if (node.element._text && node.element._text._model.meshInstances.length > 0) {
			arr.push(node.element._text._model.meshInstances[0]);
			node.element.removeModelFromLayers(node.element._text._model);
			valid = true;
		} else if (node.element._image) {
			arr.push(node.element._image._renderable.meshInstance);
			node.element.removeModelFromLayers(node.element._image._renderable.model);
			if (node.element._image._renderable.unmaskMeshInstance) {
				arr.push(node.element._image._renderable.unmaskMeshInstance);
				if (!node.element._image._renderable.unmaskMeshInstance.stencilFront || !node.element._image._renderable.unmaskMeshInstance.stencilBack) {
					node.element._dirtifyMask();
					node.element._onPrerender();
				}
			}
			valid = true;
		}
		if (valid) {
			group._ui = true;
		}
	}
	_collectAndRemoveMeshInstances(groupMeshInstances, groupIds) {
		for (let g = 0; g < groupIds.length; g++) {
			const id = groupIds[g];
			const group = this._batchGroups[id];
			if (!group) continue;
			let arr = groupMeshInstances[id];
			if (!arr) arr = groupMeshInstances[id] = [];
			for (let m = 0; m < group._obj.model.length; m++) {
				arr = this._extractModel(group._obj.model[m], arr, group, groupMeshInstances);
			}
			for (let r = 0; r < group._obj.render.length; r++) {
				arr = this._extractRender(group._obj.render[r], arr, group, groupMeshInstances);
			}
			for (let e = 0; e < group._obj.element.length; e++) {
				this._extractElement(group._obj.element[e], arr, group);
			}
			for (let s = 0; s < group._obj.sprite.length; s++) {
				const node = group._obj.sprite[s];
				if (node.sprite && node.sprite._meshInstance && (group.dynamic || node.sprite.sprite._renderMode === SPRITE_RENDERMODE_SIMPLE)) {
					arr.push(node.sprite._meshInstance);
					node.sprite.removeModelFromLayers();
					group._sprite = true;
					node.sprite._batchGroup = group;
				}
			}
		}
	}
	generate(groupIds) {
		const groupMeshInstances = {};
		if (!groupIds) {
			groupIds = Object.keys(this._batchGroups);
		}
		const newBatchList = [];
		for (let i = 0; i < this._batchList.length; i++) {
			if (groupIds.indexOf(this._batchList[i].batchGroupId) < 0) {
				newBatchList.push(this._batchList[i]);
				continue;
			}
			this.destroyBatch(this._batchList[i]);
		}
		this._batchList = newBatchList;
		this._collectAndRemoveMeshInstances(groupMeshInstances, groupIds);
		if (groupIds === this._dirtyGroups) {
			this._dirtyGroups.length = 0;
		} else {
			const newDirtyGroups = [];
			for (let i = 0; i < this._dirtyGroups.length; i++) {
				if (groupIds.indexOf(this._dirtyGroups[i]) < 0) newDirtyGroups.push(this._dirtyGroups[i]);
			}
			this._dirtyGroups = newDirtyGroups;
		}
		let group, lists, groupData, batch;
		for (const groupId in groupMeshInstances) {
			if (!groupMeshInstances.hasOwnProperty(groupId)) continue;
			group = groupMeshInstances[groupId];
			groupData = this._batchGroups[groupId];
			if (!groupData) {
				continue;
			}
			lists = this.prepare(group, groupData.dynamic, groupData.maxAabbSize, groupData._ui || groupData._sprite);
			for (let i = 0; i < lists.length; i++) {
				batch = this.create(lists[i], groupData.dynamic, parseInt(groupId, 10));
				if (batch) {
					batch.addToLayers(this.scene, groupData.layers);
				}
			}
		}
	}
	prepare(meshInstances, dynamic, maxAabbSize = Number.POSITIVE_INFINITY, translucent) {
		if (meshInstances.length === 0) return [];
		const halfMaxAabbSize = maxAabbSize * 0.5;
		const maxInstanceCount = this.device.supportsBoneTextures ? 1024 : this.device.boneLimit;
		const maxNumVertices = this.device.extUintElement ? 0xffffffff : 0xffff;
		const aabb = new BoundingBox();
		const testAabb = new BoundingBox();
		let skipTranslucentAabb = null;
		let sf;
		const lists = [];
		let j = 0;
		if (translucent) {
			meshInstances.sort(function (a, b) {
				return a.drawOrder - b.drawOrder;
			});
		}
		let meshInstancesLeftA = meshInstances;
		let meshInstancesLeftB;
		const skipMesh = translucent ? function (mi) {
			if (skipTranslucentAabb) {
				skipTranslucentAabb.add(mi.aabb);
			} else {
				skipTranslucentAabb = mi.aabb.clone();
			}
			meshInstancesLeftB.push(mi);
		} : function (mi) {
			meshInstancesLeftB.push(mi);
		};
		while (meshInstancesLeftA.length > 0) {
			lists[j] = [meshInstancesLeftA[0]];
			meshInstancesLeftB = [];
			const material = meshInstancesLeftA[0].material;
			const layer = meshInstancesLeftA[0].layer;
			const defs = meshInstancesLeftA[0]._shaderDefs;
			const params = meshInstancesLeftA[0].parameters;
			const stencil = meshInstancesLeftA[0].stencilFront;
			const lightList = meshInstancesLeftA[0]._staticLightList;
			let vertCount = meshInstancesLeftA[0].mesh.vertexBuffer.getNumVertices();
			const drawOrder = meshInstancesLeftA[0].drawOrder;
			aabb.copy(meshInstancesLeftA[0].aabb);
			const scaleSign = getScaleSign(meshInstancesLeftA[0]);
			const vertexFormatBatchingHash = meshInstancesLeftA[0].mesh.vertexBuffer.format.batchingHash;
			const indexed = meshInstancesLeftA[0].mesh.primitive[0].indexed;
			skipTranslucentAabb = null;
			for (let i = 1; i < meshInstancesLeftA.length; i++) {
				const mi = meshInstancesLeftA[i];
				if (dynamic && lists[j].length >= maxInstanceCount) {
					meshInstancesLeftB = meshInstancesLeftB.concat(meshInstancesLeftA.slice(i));
					break;
				}
				if (material !== mi.material || layer !== mi.layer || vertexFormatBatchingHash !== mi.mesh.vertexBuffer.format.batchingHash || indexed !== mi.mesh.primitive[0].indexed || defs !== mi._shaderDefs || vertCount + mi.mesh.vertexBuffer.getNumVertices() > maxNumVertices) {
					skipMesh(mi);
					continue;
				}
				testAabb.copy(aabb);
				testAabb.add(mi.aabb);
				if (testAabb.halfExtents.x > halfMaxAabbSize || testAabb.halfExtents.y > halfMaxAabbSize || testAabb.halfExtents.z > halfMaxAabbSize) {
					skipMesh(mi);
					continue;
				}
				if (stencil) {
					if (!(sf = mi.stencilFront) || stencil.func !== sf.func || stencil.zpass !== sf.zpass) {
						skipMesh(mi);
						continue;
					}
				}
				if (scaleSign !== getScaleSign(mi)) {
					skipMesh(mi);
					continue;
				}
				if (!equalParamSets(params, mi.parameters)) {
					skipMesh(mi);
					continue;
				}
				const staticLights = mi._staticLightList;
				if (lightList && staticLights) {
					if (!equalLightLists(lightList, staticLights)) {
						skipMesh(mi);
						continue;
					}
				} else if (lightList || staticLights) {
					skipMesh(mi);
					continue;
				}
				if (translucent && skipTranslucentAabb && skipTranslucentAabb.intersects(mi.aabb) && mi.drawOrder !== drawOrder) {
					skipMesh(mi);
					continue;
				}
				aabb.add(mi.aabb);
				vertCount += mi.mesh.vertexBuffer.getNumVertices();
				lists[j].push(mi);
			}
			j++;
			meshInstancesLeftA = meshInstancesLeftB;
		}
		return lists;
	}
	collectBatchedMeshData(meshInstances, dynamic) {
		let streams = null;
		let batchNumVerts = 0;
		let batchNumIndices = 0;
		let material = null;
		for (let i = 0; i < meshInstances.length; i++) {
			if (meshInstances[i].visible) {
				const mesh = meshInstances[i].mesh;
				const numVerts = mesh.vertexBuffer.numVertices;
				batchNumVerts += numVerts;
				if (mesh.primitive[0].indexed) {
					batchNumIndices += mesh.primitive[0].count;
				} else {
					const primitiveType = mesh.primitive[0].type;
					if (primitiveType === PRIMITIVE_TRIFAN || primitiveType === PRIMITIVE_TRISTRIP) {
						if (mesh.primitive[0].count === 4) batchNumIndices += 6;
					}
				}
				if (!streams) {
					material = meshInstances[i].material;
					streams = {};
					const elems = mesh.vertexBuffer.format.elements;
					for (let j = 0; j < elems.length; j++) {
						const semantic = elems[j].name;
						streams[semantic] = {
							numComponents: elems[j].numComponents,
							dataType: elems[j].dataType,
							normalize: elems[j].normalize,
							count: 0
						};
					}
					if (dynamic) {
						streams[SEMANTIC_BLENDINDICES] = {
							numComponents: 1,
							dataType: TYPE_FLOAT32,
							normalize: false,
							count: 0
						};
					}
				}
			}
		}
		return {
			streams: streams,
			batchNumVerts: batchNumVerts,
			batchNumIndices: batchNumIndices,
			material: material
		};
	}
	create(meshInstances, dynamic, batchGroupId) {
		const time = now();
		if (!this._init) {
			const boneLimit = '#define BONE_LIMIT ' + this.device.getBoneLimit() + '\n';
			this.transformVS = boneLimit + '#define DYNAMICBATCH\n' + shaderChunks.transformVS;
			this.skinTexVS = shaderChunks.skinBatchTexVS;
			this.skinConstVS = shaderChunks.skinBatchConstVS;
			this.vertexFormats = {};
			this._init = true;
		}
		let stream = null;
		let semantic;
		let mesh, numVerts;
		let batch = null;
		const batchData = this.collectBatchedMeshData(meshInstances, dynamic);
		if (batchData.streams) {
			const streams = batchData.streams;
			let material = batchData.material;
			const batchNumVerts = batchData.batchNumVerts;
			const batchNumIndices = batchData.batchNumIndices;
			batch = new Batch(meshInstances, dynamic, batchGroupId);
			this._batchList.push(batch);
			let indexBase, numIndices, indexData;
			let verticesOffset = 0;
			let indexOffset = 0;
			let transform;
			const vec = new Vec3();
			const indexArrayType = batchNumVerts <= 0xffff ? Uint16Array : Uint32Array;
			const indices = new indexArrayType(batchNumIndices);
			for (semantic in streams) {
				stream = streams[semantic];
				stream.typeArrayType = typedArrayTypes[stream.dataType];
				stream.elementByteSize = typedArrayTypesByteSize[stream.dataType];
				stream.buffer = new stream.typeArrayType(batchNumVerts * stream.numComponents);
			}
			for (let i = 0; i < meshInstances.length; i++) {
				if (!meshInstances[i].visible) continue;
				mesh = meshInstances[i].mesh;
				numVerts = mesh.vertexBuffer.numVertices;
				if (!dynamic) {
					transform = meshInstances[i].node.getWorldTransform();
				}
				for (semantic in streams) {
					if (semantic !== SEMANTIC_BLENDINDICES) {
						stream = streams[semantic];
						const subarray = new stream.typeArrayType(stream.buffer.buffer, stream.elementByteSize * stream.count);
						const totalComponents = mesh.getVertexStream(semantic, subarray) * stream.numComponents;
						stream.count += totalComponents;
						if (!dynamic && stream.numComponents >= 3) {
							if (semantic === SEMANTIC_POSITION) {
								for (let j = 0; j < totalComponents; j += stream.numComponents) {
									vec.set(subarray[j], subarray[j + 1], subarray[j + 2]);
									transform.transformPoint(vec, vec);
									subarray[j] = vec.x;
									subarray[j + 1] = vec.y;
									subarray[j + 2] = vec.z;
								}
							} else if (semantic === SEMANTIC_NORMAL || semantic === SEMANTIC_TANGENT) {
								transform.invertTo3x3(mat3);
								mat3.transpose();
								for (let j = 0; j < totalComponents; j += stream.numComponents) {
									vec.set(subarray[j], subarray[j + 1], subarray[j + 2]);
									mat3.transformVector(vec, vec);
									subarray[j] = vec.x;
									subarray[j + 1] = vec.y;
									subarray[j + 2] = vec.z;
								}
							}
						}
					}
				}
				if (dynamic) {
					stream = streams[SEMANTIC_BLENDINDICES];
					for (let j = 0; j < numVerts; j++) stream.buffer[stream.count++] = i;
				}
				if (mesh.primitive[0].indexed) {
					indexBase = mesh.primitive[0].base;
					numIndices = mesh.primitive[0].count;
					const srcFormat = mesh.indexBuffer[0].getFormat();
					indexData = new typedArrayIndexFormats[srcFormat](mesh.indexBuffer[0].storage);
				} else {
					const primitiveType = mesh.primitive[0].type;
					if (primitiveType === PRIMITIVE_TRIFAN || primitiveType === PRIMITIVE_TRISTRIP) {
						if (mesh.primitive[0].count === 4) {
							indexBase = 0;
							numIndices = 6;
							indexData = primitiveType === PRIMITIVE_TRIFAN ? _triFanIndices : _triStripIndices;
						} else {
							numIndices = 0;
							continue;
						}
					}
				}
				for (let j = 0; j < numIndices; j++) {
					indices[j + indexOffset] = indexData[indexBase + j] + verticesOffset;
				}
				indexOffset += numIndices;
				verticesOffset += numVerts;
			}
			mesh = new Mesh(this.device);
			for (semantic in streams) {
				stream = streams[semantic];
				mesh.setVertexStream(semantic, stream.buffer, stream.numComponents, undefined, stream.dataType, stream.normalize);
			}
			if (indices.length > 0) mesh.setIndices(indices);
			mesh.update(PRIMITIVE_TRIANGLES, false);
			if (dynamic) {
				material = material.clone();
				material.chunks.transformVS = this.transformVS;
				material.chunks.skinTexVS = this.skinTexVS;
				material.chunks.skinConstVS = this.skinConstVS;
				material.update();
			}
			const meshInstance = new MeshInstance(mesh, material, this.rootNode);
			meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
			meshInstance.parameters = batch.origMeshInstances[0].parameters;
			meshInstance.isStatic = batch.origMeshInstances[0].isStatic;
			meshInstance.layer = batch.origMeshInstances[0].layer;
			meshInstance._staticLightList = batch.origMeshInstances[0]._staticLightList;
			meshInstance._shaderDefs = batch.origMeshInstances[0]._shaderDefs;
			meshInstance.cull = batch.origMeshInstances[0].cull;
			const batchGroup = this._batchGroups[batchGroupId];
			if (batchGroup && batchGroup._ui) meshInstance.cull = false;
			if (dynamic) {
				const nodes = [];
				for (let i = 0; i < batch.origMeshInstances.length; i++) {
					nodes.push(batch.origMeshInstances[i].node);
				}
				meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
			}
			meshInstance._updateAabb = false;
			meshInstance.drawOrder = batch.origMeshInstances[0].drawOrder;
			meshInstance.stencilFront = batch.origMeshInstances[0].stencilFront;
			meshInstance.stencilBack = batch.origMeshInstances[0].stencilBack;
			meshInstance.flipFacesFactor = getScaleSign(batch.origMeshInstances[0]);
			meshInstance.castShadow = batch.origMeshInstances[0].castShadow;
			batch.meshInstance = meshInstance;
			batch.updateBoundingBox();
		}
		this._stats.createTime += now() - time;
		return batch;
	}
	updateAll() {
		if (this._dirtyGroups.length > 0) {
			this.generate(this._dirtyGroups);
		}
		const time = now();
		for (let i = 0; i < this._batchList.length; i++) {
			if (!this._batchList[i].dynamic) continue;
			this._batchList[i].updateBoundingBox();
		}
		this._stats.updateLastFrameTime = now() - time;
	}
	clone(batch, clonedMeshInstances) {
		const batch2 = new Batch(clonedMeshInstances, batch.dynamic, batch.batchGroupId);
		this._batchList.push(batch2);
		const nodes = [];
		for (let i = 0; i < clonedMeshInstances.length; i++) {
			nodes.push(clonedMeshInstances[i].node);
		}
		batch2.meshInstance = new MeshInstance(batch.meshInstance.mesh, batch.meshInstance.material, batch.meshInstance.node);
		batch2.meshInstance._updateAabb = false;
		batch2.meshInstance.parameters = clonedMeshInstances[0].parameters;
		batch2.meshInstance.isStatic = clonedMeshInstances[0].isStatic;
		batch2.meshInstance.cull = clonedMeshInstances[0].cull;
		batch2.meshInstance.layer = clonedMeshInstances[0].layer;
		batch2.meshInstance._staticLightList = clonedMeshInstances[0]._staticLightList;
		if (batch.dynamic) {
			batch2.meshInstance.skinInstance = new SkinBatchInstance(this.device, nodes, this.rootNode);
		}
		batch2.meshInstance.castShadow = batch.meshInstance.castShadow;
		batch2.meshInstance._shader = batch.meshInstance._shader.slice();
		batch2.meshInstance.castShadow = batch.meshInstance.castShadow;
		return batch2;
	}
	destroyBatch(batch) {
		batch.destroy(this.scene, this._batchGroups[batch.batchGroupId].layers);
	}
}

export { BatchManager };
