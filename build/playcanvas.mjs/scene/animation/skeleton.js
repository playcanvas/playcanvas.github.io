import '../../core/debug.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';

class InterpolatedKey {
	constructor() {
		this._written = false;
		this._name = '';
		this._keyFrames = [];
		this._quat = new Quat();
		this._pos = new Vec3();
		this._scale = new Vec3();
		this._targetNode = null;
	}
	getTarget() {
		return this._targetNode;
	}
	setTarget(node) {
		this._targetNode = node;
	}
}
class Skeleton {
	constructor(graph) {
		this.looping = true;
		this._animation = null;
		this._time = 0;
		this._interpolatedKeys = [];
		this._interpolatedKeyDict = {};
		this._currKeyIndices = {};
		this.graph = null;
		const addInterpolatedKeys = node => {
			const interpKey = new InterpolatedKey();
			interpKey._name = node.name;
			this._interpolatedKeys.push(interpKey);
			this._interpolatedKeyDict[node.name] = interpKey;
			this._currKeyIndices[node.name] = 0;
			for (let i = 0; i < node._children.length; i++) addInterpolatedKeys(node._children[i]);
		};
		addInterpolatedKeys(graph);
	}
	set animation(value) {
		this._animation = value;
		this.currentTime = 0;
	}
	get animation() {
		return this._animation;
	}
	set currentTime(value) {
		this._time = value;
		const numNodes = this._interpolatedKeys.length;
		for (let i = 0; i < numNodes; i++) {
			const node = this._interpolatedKeys[i];
			const nodeName = node._name;
			this._currKeyIndices[nodeName] = 0;
		}
		this.addTime(0);
		this.updateGraph();
	}
	get currentTime() {
		return this._time;
	}
	get numNodes() {
		return this._interpolatedKeys.length;
	}
	addTime(delta) {
		if (this._animation !== null) {
			const nodes = this._animation._nodes;
			const duration = this._animation.duration;
			if (this._time === duration && !this.looping) {
				return;
			}
			this._time += delta;
			if (this._time > duration) {
				this._time = this.looping ? 0.0 : duration;
				for (let i = 0; i < nodes.length; i++) {
					const node = nodes[i];
					const nodeName = node._name;
					this._currKeyIndices[nodeName] = 0;
				}
			} else if (this._time < 0) {
				this._time = this.looping ? duration : 0.0;
				for (let i = 0; i < nodes.length; i++) {
					const node = nodes[i];
					const nodeName = node._name;
					this._currKeyIndices[nodeName] = node._keys.length - 2;
				}
			}
			const offset = delta >= 0 ? 1 : -1;
			for (let i = 0; i < nodes.length; i++) {
				const node = nodes[i];
				const nodeName = node._name;
				const keys = node._keys;
				const interpKey = this._interpolatedKeyDict[nodeName];
				if (interpKey === undefined) {
					continue;
				}
				let foundKey = false;
				if (keys.length !== 1) {
					for (let currKeyIndex = this._currKeyIndices[nodeName]; currKeyIndex < keys.length - 1 && currKeyIndex >= 0; currKeyIndex += offset) {
						const k1 = keys[currKeyIndex];
						const k2 = keys[currKeyIndex + 1];
						if (k1.time <= this._time && k2.time >= this._time) {
							const alpha = (this._time - k1.time) / (k2.time - k1.time);
							interpKey._pos.lerp(k1.position, k2.position, alpha);
							interpKey._quat.slerp(k1.rotation, k2.rotation, alpha);
							interpKey._scale.lerp(k1.scale, k2.scale, alpha);
							interpKey._written = true;
							this._currKeyIndices[nodeName] = currKeyIndex;
							foundKey = true;
							break;
						}
					}
				}
				if (keys.length === 1 || !foundKey && this._time === 0.0 && this.looping) {
					interpKey._pos.copy(keys[0].position);
					interpKey._quat.copy(keys[0].rotation);
					interpKey._scale.copy(keys[0].scale);
					interpKey._written = true;
				}
			}
		}
	}
	blend(skel1, skel2, alpha) {
		const numNodes = this._interpolatedKeys.length;
		for (let i = 0; i < numNodes; i++) {
			const key1 = skel1._interpolatedKeys[i];
			const key2 = skel2._interpolatedKeys[i];
			const dstKey = this._interpolatedKeys[i];
			if (key1._written && key2._written) {
				dstKey._quat.slerp(key1._quat, skel2._interpolatedKeys[i]._quat, alpha);
				dstKey._pos.lerp(key1._pos, skel2._interpolatedKeys[i]._pos, alpha);
				dstKey._scale.lerp(key1._scale, key2._scale, alpha);
				dstKey._written = true;
			} else if (key1._written) {
				dstKey._quat.copy(key1._quat);
				dstKey._pos.copy(key1._pos);
				dstKey._scale.copy(key1._scale);
				dstKey._written = true;
			} else if (key2._written) {
				dstKey._quat.copy(key2._quat);
				dstKey._pos.copy(key2._pos);
				dstKey._scale.copy(key2._scale);
				dstKey._written = true;
			}
		}
	}
	setGraph(graph) {
		this.graph = graph;
		if (graph) {
			for (let i = 0; i < this._interpolatedKeys.length; i++) {
				const interpKey = this._interpolatedKeys[i];
				const graphNode = graph.findByName(interpKey._name);
				this._interpolatedKeys[i].setTarget(graphNode);
			}
		} else {
			for (let i = 0; i < this._interpolatedKeys.length; i++) {
				this._interpolatedKeys[i].setTarget(null);
			}
		}
	}
	updateGraph() {
		if (this.graph) {
			for (let i = 0; i < this._interpolatedKeys.length; i++) {
				const interpKey = this._interpolatedKeys[i];
				if (interpKey._written) {
					const transform = interpKey.getTarget();
					transform.localPosition.copy(interpKey._pos);
					transform.localRotation.copy(interpKey._quat);
					transform.localScale.copy(interpKey._scale);
					if (!transform._dirtyLocal) transform._dirtifyLocal();
					interpKey._written = false;
				}
			}
		}
	}
}

export { Skeleton };
