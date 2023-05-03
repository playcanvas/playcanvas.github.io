import { Vec2 } from '../core/math/vec2.js';
import { Vec3 } from '../core/math/vec3.js';
import { SEMANTIC_TANGENT, SEMANTIC_BLENDINDICES, TYPE_UINT8, SEMANTIC_BLENDWEIGHT } from '../platform/graphics/constants.js';
import { Mesh } from './mesh.js';

const primitiveUv1Padding = 4.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;
const shapePrimitives = [];
function calculateNormals(positions, indices) {
	const triangleCount = indices.length / 3;
	const vertexCount = positions.length / 3;
	const p1 = new Vec3();
	const p2 = new Vec3();
	const p3 = new Vec3();
	const p1p2 = new Vec3();
	const p1p3 = new Vec3();
	const faceNormal = new Vec3();
	const normals = [];
	for (let i = 0; i < positions.length; i++) {
		normals[i] = 0;
	}
	for (let i = 0; i < triangleCount; i++) {
		const i1 = indices[i * 3];
		const i2 = indices[i * 3 + 1];
		const i3 = indices[i * 3 + 2];
		p1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
		p2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
		p3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
		p1p2.sub2(p2, p1);
		p1p3.sub2(p3, p1);
		faceNormal.cross(p1p2, p1p3).normalize();
		normals[i1 * 3] += faceNormal.x;
		normals[i1 * 3 + 1] += faceNormal.y;
		normals[i1 * 3 + 2] += faceNormal.z;
		normals[i2 * 3] += faceNormal.x;
		normals[i2 * 3 + 1] += faceNormal.y;
		normals[i2 * 3 + 2] += faceNormal.z;
		normals[i3 * 3] += faceNormal.x;
		normals[i3 * 3 + 1] += faceNormal.y;
		normals[i3 * 3 + 2] += faceNormal.z;
	}
	for (let i = 0; i < vertexCount; i++) {
		const nx = normals[i * 3];
		const ny = normals[i * 3 + 1];
		const nz = normals[i * 3 + 2];
		const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
		normals[i * 3] *= invLen;
		normals[i * 3 + 1] *= invLen;
		normals[i * 3 + 2] *= invLen;
	}
	return normals;
}
function calculateTangents(positions, normals, uvs, indices) {
	const triangleCount = indices.length / 3;
	const vertexCount = positions.length / 3;
	const v1 = new Vec3();
	const v2 = new Vec3();
	const v3 = new Vec3();
	const w1 = new Vec2();
	const w2 = new Vec2();
	const w3 = new Vec2();
	const sdir = new Vec3();
	const tdir = new Vec3();
	const tan1 = new Float32Array(vertexCount * 3);
	const tan2 = new Float32Array(vertexCount * 3);
	const tangents = [];
	for (let i = 0; i < triangleCount; i++) {
		const i1 = indices[i * 3];
		const i2 = indices[i * 3 + 1];
		const i3 = indices[i * 3 + 2];
		v1.set(positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]);
		v2.set(positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]);
		v3.set(positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]);
		w1.set(uvs[i1 * 2], uvs[i1 * 2 + 1]);
		w2.set(uvs[i2 * 2], uvs[i2 * 2 + 1]);
		w3.set(uvs[i3 * 2], uvs[i3 * 2 + 1]);
		const x1 = v2.x - v1.x;
		const x2 = v3.x - v1.x;
		const y1 = v2.y - v1.y;
		const y2 = v3.y - v1.y;
		const z1 = v2.z - v1.z;
		const z2 = v3.z - v1.z;
		const s1 = w2.x - w1.x;
		const s2 = w3.x - w1.x;
		const _t = w2.y - w1.y;
		const _t2 = w3.y - w1.y;
		const area = s1 * _t2 - s2 * _t;
		if (area === 0) {
			sdir.set(0, 1, 0);
			tdir.set(1, 0, 0);
		} else {
			const r = 1 / area;
			sdir.set((_t2 * x1 - _t * x2) * r, (_t2 * y1 - _t * y2) * r, (_t2 * z1 - _t * z2) * r);
			tdir.set((s1 * x2 - s2 * x1) * r, (s1 * y2 - s2 * y1) * r, (s1 * z2 - s2 * z1) * r);
		}
		tan1[i1 * 3 + 0] += sdir.x;
		tan1[i1 * 3 + 1] += sdir.y;
		tan1[i1 * 3 + 2] += sdir.z;
		tan1[i2 * 3 + 0] += sdir.x;
		tan1[i2 * 3 + 1] += sdir.y;
		tan1[i2 * 3 + 2] += sdir.z;
		tan1[i3 * 3 + 0] += sdir.x;
		tan1[i3 * 3 + 1] += sdir.y;
		tan1[i3 * 3 + 2] += sdir.z;
		tan2[i1 * 3 + 0] += tdir.x;
		tan2[i1 * 3 + 1] += tdir.y;
		tan2[i1 * 3 + 2] += tdir.z;
		tan2[i2 * 3 + 0] += tdir.x;
		tan2[i2 * 3 + 1] += tdir.y;
		tan2[i2 * 3 + 2] += tdir.z;
		tan2[i3 * 3 + 0] += tdir.x;
		tan2[i3 * 3 + 1] += tdir.y;
		tan2[i3 * 3 + 2] += tdir.z;
	}
	const t1 = new Vec3();
	const t2 = new Vec3();
	const n = new Vec3();
	const temp = new Vec3();
	for (let i = 0; i < vertexCount; i++) {
		n.set(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
		t1.set(tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]);
		t2.set(tan2[i * 3], tan2[i * 3 + 1], tan2[i * 3 + 2]);
		const ndott = n.dot(t1);
		temp.copy(n).mulScalar(ndott);
		temp.sub2(t1, temp).normalize();
		tangents[i * 4] = temp.x;
		tangents[i * 4 + 1] = temp.y;
		tangents[i * 4 + 2] = temp.z;
		temp.cross(n, t1);
		tangents[i * 4 + 3] = temp.dot(t2) < 0.0 ? -1.0 : 1.0;
	}
	return tangents;
}
function createMesh(device, positions, opts) {
	const mesh = new Mesh(device);
	mesh.setPositions(positions);
	if (opts) {
		if (opts.normals) {
			mesh.setNormals(opts.normals);
		}
		if (opts.tangents) {
			mesh.setVertexStream(SEMANTIC_TANGENT, opts.tangents, 4);
		}
		if (opts.colors) {
			mesh.setColors32(opts.colors);
		}
		if (opts.uvs) {
			mesh.setUvs(0, opts.uvs);
		}
		if (opts.uvs1) {
			mesh.setUvs(1, opts.uvs1);
		}
		if (opts.blendIndices) {
			mesh.setVertexStream(SEMANTIC_BLENDINDICES, opts.blendIndices, 4, opts.blendIndices.length / 4, TYPE_UINT8);
		}
		if (opts.blendWeights) {
			mesh.setVertexStream(SEMANTIC_BLENDWEIGHT, opts.blendWeights, 4);
		}
		if (opts.indices) {
			mesh.setIndices(opts.indices);
		}
	}
	mesh.update();
	return mesh;
}
function createTorus(device, opts = {}) {
	var _opts$tubeRadius, _opts$ringRadius, _opts$segments, _opts$sides, _opts$calculateTangen;
	const rc = (_opts$tubeRadius = opts.tubeRadius) != null ? _opts$tubeRadius : 0.2;
	const rt = (_opts$ringRadius = opts.ringRadius) != null ? _opts$ringRadius : 0.3;
	const segments = (_opts$segments = opts.segments) != null ? _opts$segments : 30;
	const sides = (_opts$sides = opts.sides) != null ? _opts$sides : 20;
	const calcTangents = (_opts$calculateTangen = opts.calculateTangents) != null ? _opts$calculateTangen : false;
	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];
	for (let i = 0; i <= sides; i++) {
		for (let j = 0; j <= segments; j++) {
			const x = Math.cos(2 * Math.PI * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
			const y = Math.sin(2 * Math.PI * i / sides) * rc;
			const z = Math.sin(2 * Math.PI * j / segments) * (rt + rc * Math.cos(2 * Math.PI * i / sides));
			const nx = Math.cos(2 * Math.PI * j / segments) * Math.cos(2 * Math.PI * i / sides);
			const ny = Math.sin(2 * Math.PI * i / sides);
			const nz = Math.sin(2 * Math.PI * j / segments) * Math.cos(2 * Math.PI * i / sides);
			const u = i / sides;
			const v = 1 - j / segments;
			positions.push(x, y, z);
			normals.push(nx, ny, nz);
			uvs.push(u, 1.0 - v);
			if (i < sides && j < segments) {
				const first = i * (segments + 1) + j;
				const second = (i + 1) * (segments + 1) + j;
				const third = i * (segments + 1) + (j + 1);
				const fourth = (i + 1) * (segments + 1) + (j + 1);
				indices.push(first, second, third);
				indices.push(second, fourth, third);
			}
		}
	}
	const options = {
		normals: normals,
		uvs: uvs,
		uvs1: uvs,
		indices: indices
	};
	if (calcTangents) {
		options.tangents = calculateTangents(positions, normals, uvs, indices);
	}
	return createMesh(device, positions, options);
}
function _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
	const pos = new Vec3();
	const bottomToTop = new Vec3();
	const norm = new Vec3();
	const top = new Vec3();
	const bottom = new Vec3();
	const tangent = new Vec3();
	const positions = [];
	const normals = [];
	const uvs = [];
	const uvs1 = [];
	const indices = [];
	let offset;
	if (height > 0) {
		for (let i = 0; i <= heightSegments; i++) {
			for (let j = 0; j <= capSegments; j++) {
				const theta = j / capSegments * 2 * Math.PI - Math.PI;
				const sinTheta = Math.sin(theta);
				const cosTheta = Math.cos(theta);
				bottom.set(sinTheta * baseRadius, -height / 2, cosTheta * baseRadius);
				top.set(sinTheta * peakRadius, height / 2, cosTheta * peakRadius);
				pos.lerp(bottom, top, i / heightSegments);
				bottomToTop.sub2(top, bottom).normalize();
				tangent.set(cosTheta, 0, -sinTheta);
				norm.cross(tangent, bottomToTop).normalize();
				positions.push(pos.x, pos.y, pos.z);
				normals.push(norm.x, norm.y, norm.z);
				let u = j / capSegments;
				let v = i / heightSegments;
				uvs.push(u, 1 - v);
				const _v = v;
				v = u;
				u = _v;
				u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
				v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
				u /= 3;
				uvs1.push(u, 1 - v);
				if (i < heightSegments && j < capSegments) {
					const first = i * (capSegments + 1) + j;
					const second = i * (capSegments + 1) + (j + 1);
					const third = (i + 1) * (capSegments + 1) + j;
					const fourth = (i + 1) * (capSegments + 1) + (j + 1);
					indices.push(first, second, third);
					indices.push(second, fourth, third);
				}
			}
		}
	}
	if (roundedCaps) {
		const latitudeBands = Math.floor(capSegments / 2);
		const longitudeBands = capSegments;
		const capOffset = height / 2;
		for (let lat = 0; lat <= latitudeBands; lat++) {
			const theta = lat * Math.PI * 0.5 / latitudeBands;
			const sinTheta = Math.sin(theta);
			const cosTheta = Math.cos(theta);
			for (let lon = 0; lon <= longitudeBands; lon++) {
				const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
				const sinPhi = Math.sin(phi);
				const cosPhi = Math.cos(phi);
				const x = cosPhi * sinTheta;
				const y = cosTheta;
				const z = sinPhi * sinTheta;
				let u = 1 - lon / longitudeBands;
				let v = 1 - lat / latitudeBands;
				positions.push(x * peakRadius, y * peakRadius + capOffset, z * peakRadius);
				normals.push(x, y, z);
				uvs.push(u, 1 - v);
				u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
				v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
				u /= 3;
				v /= 3;
				u += 1.0 / 3;
				uvs1.push(u, 1 - v);
			}
		}
		offset = (heightSegments + 1) * (capSegments + 1);
		for (let lat = 0; lat < latitudeBands; ++lat) {
			for (let lon = 0; lon < longitudeBands; ++lon) {
				const first = lat * (longitudeBands + 1) + lon;
				const second = first + longitudeBands + 1;
				indices.push(offset + first + 1, offset + second, offset + first);
				indices.push(offset + first + 1, offset + second + 1, offset + second);
			}
		}
		for (let lat = 0; lat <= latitudeBands; lat++) {
			const theta = Math.PI * 0.5 + lat * Math.PI * 0.5 / latitudeBands;
			const sinTheta = Math.sin(theta);
			const cosTheta = Math.cos(theta);
			for (let lon = 0; lon <= longitudeBands; lon++) {
				const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
				const sinPhi = Math.sin(phi);
				const cosPhi = Math.cos(phi);
				const x = cosPhi * sinTheta;
				const y = cosTheta;
				const z = sinPhi * sinTheta;
				let u = 1 - lon / longitudeBands;
				let v = 1 - lat / latitudeBands;
				positions.push(x * peakRadius, y * peakRadius - capOffset, z * peakRadius);
				normals.push(x, y, z);
				uvs.push(u, 1 - v);
				u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
				v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
				u /= 3;
				v /= 3;
				u += 2.0 / 3;
				uvs1.push(u, 1 - v);
			}
		}
		offset = (heightSegments + 1) * (capSegments + 1) + (longitudeBands + 1) * (latitudeBands + 1);
		for (let lat = 0; lat < latitudeBands; ++lat) {
			for (let lon = 0; lon < longitudeBands; ++lon) {
				const first = lat * (longitudeBands + 1) + lon;
				const second = first + longitudeBands + 1;
				indices.push(offset + first + 1, offset + second, offset + first);
				indices.push(offset + first + 1, offset + second + 1, offset + second);
			}
		}
	} else {
		offset = (heightSegments + 1) * (capSegments + 1);
		if (baseRadius > 0) {
			for (let i = 0; i < capSegments; i++) {
				const theta = i / capSegments * 2 * Math.PI;
				const x = Math.sin(theta);
				const y = -height / 2;
				const z = Math.cos(theta);
				let u = 1 - (x + 1) / 2;
				let v = (z + 1) / 2;
				positions.push(x * baseRadius, y, z * baseRadius);
				normals.push(0, -1, 0);
				uvs.push(u, 1 - v);
				u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
				v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
				u /= 3;
				v /= 3;
				u += 1 / 3;
				uvs1.push(u, 1 - v);
				if (i > 1) {
					indices.push(offset, offset + i, offset + i - 1);
				}
			}
		}
		offset += capSegments;
		if (peakRadius > 0) {
			for (let i = 0; i < capSegments; i++) {
				const theta = i / capSegments * 2 * Math.PI;
				const x = Math.sin(theta);
				const y = height / 2;
				const z = Math.cos(theta);
				let u = 1 - (x + 1) / 2;
				let v = (z + 1) / 2;
				positions.push(x * peakRadius, y, z * peakRadius);
				normals.push(0, 1, 0);
				uvs.push(u, 1 - v);
				u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
				v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
				u /= 3;
				v /= 3;
				u += 2 / 3;
				uvs1.push(u, 1 - v);
				if (i > 1) {
					indices.push(offset, offset + i - 1, offset + i);
				}
			}
		}
	}
	return {
		positions: positions,
		normals: normals,
		uvs: uvs,
		uvs1: uvs1,
		indices: indices
	};
}
function createCylinder(device, opts = {}) {
	var _opts$radius, _opts$height, _opts$heightSegments, _opts$capSegments, _opts$calculateTangen2;
	const radius = (_opts$radius = opts.radius) != null ? _opts$radius : 0.5;
	const height = (_opts$height = opts.height) != null ? _opts$height : 1;
	const heightSegments = (_opts$heightSegments = opts.heightSegments) != null ? _opts$heightSegments : 5;
	const capSegments = (_opts$capSegments = opts.capSegments) != null ? _opts$capSegments : 20;
	const calcTangents = (_opts$calculateTangen2 = opts.calculateTangents) != null ? _opts$calculateTangen2 : false;
	const options = _createConeData(radius, radius, height, heightSegments, capSegments, false);
	if (calcTangents) {
		options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
	}
	return createMesh(device, options.positions, options);
}
function createCapsule(device, opts = {}) {
	var _opts$radius2, _opts$height2, _opts$heightSegments2, _opts$sides2, _opts$calculateTangen3;
	const radius = (_opts$radius2 = opts.radius) != null ? _opts$radius2 : 0.3;
	const height = (_opts$height2 = opts.height) != null ? _opts$height2 : 1;
	const heightSegments = (_opts$heightSegments2 = opts.heightSegments) != null ? _opts$heightSegments2 : 1;
	const sides = (_opts$sides2 = opts.sides) != null ? _opts$sides2 : 20;
	const calcTangents = (_opts$calculateTangen3 = opts.calculateTangents) != null ? _opts$calculateTangen3 : false;
	const options = _createConeData(radius, radius, height - 2 * radius, heightSegments, sides, true);
	if (calcTangents) {
		options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
	}
	return createMesh(device, options.positions, options);
}
function createCone(device, opts = {}) {
	var _opts$baseRadius, _opts$peakRadius, _opts$height3, _opts$heightSegments3, _opts$capSegments2, _opts$calculateTangen4;
	const baseRadius = (_opts$baseRadius = opts.baseRadius) != null ? _opts$baseRadius : 0.5;
	const peakRadius = (_opts$peakRadius = opts.peakRadius) != null ? _opts$peakRadius : 0;
	const height = (_opts$height3 = opts.height) != null ? _opts$height3 : 1;
	const heightSegments = (_opts$heightSegments3 = opts.heightSegments) != null ? _opts$heightSegments3 : 5;
	const capSegments = (_opts$capSegments2 = opts.capSegments) != null ? _opts$capSegments2 : 18;
	const calcTangents = (_opts$calculateTangen4 = opts.calculateTangents) != null ? _opts$calculateTangen4 : false;
	const options = _createConeData(baseRadius, peakRadius, height, heightSegments, capSegments, false);
	if (calcTangents) {
		options.tangents = calculateTangents(options.positions, options.normals, options.uvs, options.indices);
	}
	return createMesh(device, options.positions, options);
}
function createSphere(device, opts = {}) {
	var _opts$radius3, _opts$latitudeBands, _opts$longitudeBands, _opts$calculateTangen5;
	const radius = (_opts$radius3 = opts.radius) != null ? _opts$radius3 : 0.5;
	const latitudeBands = (_opts$latitudeBands = opts.latitudeBands) != null ? _opts$latitudeBands : 16;
	const longitudeBands = (_opts$longitudeBands = opts.longitudeBands) != null ? _opts$longitudeBands : 16;
	const calcTangents = (_opts$calculateTangen5 = opts.calculateTangents) != null ? _opts$calculateTangen5 : false;
	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];
	for (let lat = 0; lat <= latitudeBands; lat++) {
		const theta = lat * Math.PI / latitudeBands;
		const sinTheta = Math.sin(theta);
		const cosTheta = Math.cos(theta);
		for (let lon = 0; lon <= longitudeBands; lon++) {
			const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
			const sinPhi = Math.sin(phi);
			const cosPhi = Math.cos(phi);
			const x = cosPhi * sinTheta;
			const y = cosTheta;
			const z = sinPhi * sinTheta;
			const u = 1 - lon / longitudeBands;
			const v = 1 - lat / latitudeBands;
			positions.push(x * radius, y * radius, z * radius);
			normals.push(x, y, z);
			uvs.push(u, 1 - v);
		}
	}
	for (let lat = 0; lat < latitudeBands; ++lat) {
		for (let lon = 0; lon < longitudeBands; ++lon) {
			const first = lat * (longitudeBands + 1) + lon;
			const second = first + longitudeBands + 1;
			indices.push(first + 1, second, first);
			indices.push(first + 1, second + 1, second);
		}
	}
	const options = {
		normals: normals,
		uvs: uvs,
		uvs1: uvs,
		indices: indices
	};
	if (calcTangents) {
		options.tangents = calculateTangents(positions, normals, uvs, indices);
	}
	return createMesh(device, positions, options);
}
function createPlane(device, opts = {}) {
	var _opts$halfExtents, _opts$widthSegments, _opts$lengthSegments, _opts$calculateTangen6;
	const he = (_opts$halfExtents = opts.halfExtents) != null ? _opts$halfExtents : new Vec2(0.5, 0.5);
	const ws = (_opts$widthSegments = opts.widthSegments) != null ? _opts$widthSegments : 5;
	const ls = (_opts$lengthSegments = opts.lengthSegments) != null ? _opts$lengthSegments : 5;
	const calcTangents = (_opts$calculateTangen6 = opts.calculateTangents) != null ? _opts$calculateTangen6 : false;
	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];
	let vcounter = 0;
	for (let i = 0; i <= ws; i++) {
		for (let j = 0; j <= ls; j++) {
			const x = -he.x + 2 * he.x * i / ws;
			const y = 0.0;
			const z = -(-he.y + 2 * he.y * j / ls);
			const u = i / ws;
			const v = j / ls;
			positions.push(x, y, z);
			normals.push(0, 1, 0);
			uvs.push(u, 1 - v);
			if (i < ws && j < ls) {
				indices.push(vcounter + ls + 1, vcounter + 1, vcounter);
				indices.push(vcounter + ls + 1, vcounter + ls + 2, vcounter + 1);
			}
			vcounter++;
		}
	}
	const options = {
		normals: normals,
		uvs: uvs,
		uvs1: uvs,
		indices: indices
	};
	if (calcTangents) {
		options.tangents = calculateTangents(positions, normals, uvs, indices);
	}
	return createMesh(device, positions, options);
}
function createBox(device, opts = {}) {
	var _opts$halfExtents2, _opts$widthSegments2, _opts$lengthSegments2, _opts$heightSegments4, _opts$calculateTangen7;
	const he = (_opts$halfExtents2 = opts.halfExtents) != null ? _opts$halfExtents2 : new Vec3(0.5, 0.5, 0.5);
	const ws = (_opts$widthSegments2 = opts.widthSegments) != null ? _opts$widthSegments2 : 1;
	const ls = (_opts$lengthSegments2 = opts.lengthSegments) != null ? _opts$lengthSegments2 : 1;
	const hs = (_opts$heightSegments4 = opts.heightSegments) != null ? _opts$heightSegments4 : 1;
	const calcTangents = (_opts$calculateTangen7 = opts.calculateTangents) != null ? _opts$calculateTangen7 : false;
	const corners = [new Vec3(-he.x, -he.y, he.z), new Vec3(he.x, -he.y, he.z), new Vec3(he.x, he.y, he.z), new Vec3(-he.x, he.y, he.z), new Vec3(he.x, -he.y, -he.z), new Vec3(-he.x, -he.y, -he.z), new Vec3(-he.x, he.y, -he.z), new Vec3(he.x, he.y, -he.z)];
	const faceAxes = [[0, 1, 3], [4, 5, 7], [3, 2, 6], [1, 0, 4], [1, 4, 2], [5, 0, 6]];
	const faceNormals = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
	const sides = {
		FRONT: 0,
		BACK: 1,
		TOP: 2,
		BOTTOM: 3,
		RIGHT: 4,
		LEFT: 5
	};
	const positions = [];
	const normals = [];
	const uvs = [];
	const uvs1 = [];
	const indices = [];
	let vcounter = 0;
	const generateFace = (side, uSegments, vSegments) => {
		const temp1 = new Vec3();
		const temp2 = new Vec3();
		const temp3 = new Vec3();
		const r = new Vec3();
		for (let i = 0; i <= uSegments; i++) {
			for (let j = 0; j <= vSegments; j++) {
				temp1.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][1]], i / uSegments);
				temp2.lerp(corners[faceAxes[side][0]], corners[faceAxes[side][2]], j / vSegments);
				temp3.sub2(temp2, corners[faceAxes[side][0]]);
				r.add2(temp1, temp3);
				let u = i / uSegments;
				let v = j / vSegments;
				positions.push(r.x, r.y, r.z);
				normals.push(faceNormals[side][0], faceNormals[side][1], faceNormals[side][2]);
				uvs.push(u, 1 - v);
				u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
				v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
				u /= 3;
				v /= 3;
				u += side % 3 / 3;
				v += Math.floor(side / 3) / 3;
				uvs1.push(u, 1 - v);
				if (i < uSegments && j < vSegments) {
					indices.push(vcounter + vSegments + 1, vcounter + 1, vcounter);
					indices.push(vcounter + vSegments + 1, vcounter + vSegments + 2, vcounter + 1);
				}
				vcounter++;
			}
		}
	};
	generateFace(sides.FRONT, ws, hs);
	generateFace(sides.BACK, ws, hs);
	generateFace(sides.TOP, ws, ls);
	generateFace(sides.BOTTOM, ws, ls);
	generateFace(sides.RIGHT, ls, hs);
	generateFace(sides.LEFT, ls, hs);
	const options = {
		normals: normals,
		uvs: uvs,
		uvs1: uvs1,
		indices: indices
	};
	if (calcTangents) {
		options.tangents = calculateTangents(positions, normals, uvs, indices);
	}
	return createMesh(device, positions, options);
}
function getShapePrimitive(device, type) {
	let primData = null;
	for (let i = 0; i < shapePrimitives.length; i++) {
		if (shapePrimitives[i].type === type && shapePrimitives[i].device === device) {
			primData = shapePrimitives[i].primData;
		}
	}
	if (!primData) {
		let mesh, area;
		switch (type) {
			case 'box':
				mesh = createBox(device);
				area = {
					x: 2,
					y: 2,
					z: 2,
					uv: 2.0 / 3
				};
				break;
			case 'capsule':
				mesh = createCapsule(device, {
					radius: 0.5,
					height: 2
				});
				area = {
					x: Math.PI * 2,
					y: Math.PI,
					z: Math.PI * 2,
					uv: 1.0 / 3 + 1.0 / 3 / 3 * 2
				};
				break;
			case 'cone':
				mesh = createCone(device, {
					baseRadius: 0.5,
					peakRadius: 0,
					height: 1
				});
				area = {
					x: 2.54,
					y: 2.54,
					z: 2.54,
					uv: 1.0 / 3 + 1.0 / 3 / 3
				};
				break;
			case 'cylinder':
				mesh = createCylinder(device, {
					radius: 0.5,
					height: 1
				});
				area = {
					x: Math.PI,
					y: 0.79 * 2,
					z: Math.PI,
					uv: 1.0 / 3 + 1.0 / 3 / 3 * 2
				};
				break;
			case 'plane':
				mesh = createPlane(device, {
					halfExtents: new Vec2(0.5, 0.5),
					widthSegments: 1,
					lengthSegments: 1
				});
				area = {
					x: 0,
					y: 1,
					z: 0,
					uv: 1
				};
				break;
			case 'sphere':
				mesh = createSphere(device, {
					radius: 0.5
				});
				area = {
					x: Math.PI,
					y: Math.PI,
					z: Math.PI,
					uv: 1
				};
				break;
			case 'torus':
				mesh = createTorus(device, {
					tubeRadius: 0.2,
					ringRadius: 0.3
				});
				area = {
					x: Math.PI * 0.5 * 0.5 - Math.PI * 0.1 * 0.1,
					y: 0.4,
					z: 0.4,
					uv: 1
				};
				break;
			default:
				throw new Error('Invalid primitive type: ' + type);
		}
		mesh.incRefCount();
		primData = {
			mesh: mesh,
			area: area
		};
		shapePrimitives.push({
			type: type,
			device: device,
			primData: primData
		});
	}
	return primData;
}

export { calculateNormals, calculateTangents, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus, getShapePrimitive };
