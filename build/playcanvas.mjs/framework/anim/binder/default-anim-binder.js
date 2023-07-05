import '../../../core/debug.js';
import { AnimBinder } from './anim-binder.js';
import { AnimTarget } from '../evaluator/anim-target.js';
import { Entity } from '../../entity.js';

class DefaultAnimBinder {
	constructor(graph) {
		this._isPathInMask = (path, checkMaskValue) => {
			const maskItem = this._mask[path];
			if (!maskItem) return false;else if (maskItem.children || checkMaskValue && maskItem.value !== false) return true;
			return false;
		};
		this.graph = graph;
		if (!graph) return;
		this._mask = null;
		const nodes = {};
		const flatten = function flatten(node) {
			nodes[node.name] = node;
			for (let i = 0; i < node.children.length; ++i) {
				flatten(node.children[i]);
			}
		};
		flatten(graph);
		this.nodes = nodes;
		this.targetCache = {};
		const findMeshInstances = function findMeshInstances(node) {
			let object = node;
			while (object && !(object instanceof Entity)) {
				object = object.parent;
			}
			let meshInstances;
			if (object) {
				if (object.render) {
					meshInstances = object.render.meshInstances;
				} else if (object.model) {
					meshInstances = object.model.meshInstances;
				}
			}
			return meshInstances;
		};
		this.nodeCounts = {};
		this.activeNodes = [];
		this.handlers = {
			'localPosition': function (node) {
				const object = node.localPosition;
				const func = function func(value) {
					object.set(...value);
				};
				return DefaultAnimBinder.createAnimTarget(func, 'vector', 3, node, 'localPosition');
			},
			'localRotation': function (node) {
				const object = node.localRotation;
				const func = function func(value) {
					object.set(...value);
				};
				return DefaultAnimBinder.createAnimTarget(func, 'quaternion', 4, node, 'localRotation');
			},
			'localScale': function (node) {
				const object = node.localScale;
				const func = function func(value) {
					object.set(...value);
				};
				return DefaultAnimBinder.createAnimTarget(func, 'vector', 3, node, 'localScale');
			},
			'weight': function (node, weightName) {
				if (weightName.indexOf('name.') === 0) {
					weightName = weightName.replace('name.', '');
				} else {
					weightName = Number(weightName);
				}
				const meshInstances = findMeshInstances(node);
				let setters;
				if (meshInstances) {
					for (let i = 0; i < meshInstances.length; ++i) {
						if (meshInstances[i].node.name === node.name && meshInstances[i].morphInstance) {
							const morphInstance = meshInstances[i].morphInstance;
							const func = value => {
								morphInstance.setWeight(weightName, value[0]);
							};
							if (!setters) setters = [];
							setters.push(func);
						}
					}
				}
				if (setters) {
					const callSetters = value => {
						for (let i = 0; i < setters.length; ++i) {
							setters[i](value);
						}
					};
					return DefaultAnimBinder.createAnimTarget(callSetters, 'number', 1, node, `weight.${weightName}`);
				}
				return null;
			},
			'materialTexture': (node, textureName) => {
				const meshInstances = findMeshInstances(node);
				if (meshInstances) {
					let meshInstance;
					for (let i = 0; i < meshInstances.length; ++i) {
						if (meshInstances[i].node.name === node.name) {
							meshInstance = meshInstances[i];
							break;
						}
					}
					if (meshInstance) {
						const func = value => {
							const textureAsset = this.animComponent.system.app.assets.get(value[0]);
							if (textureAsset && textureAsset.resource && textureAsset.type === 'texture') {
								meshInstance.material[textureName] = textureAsset.resource;
								meshInstance.material.update();
							}
						};
						return DefaultAnimBinder.createAnimTarget(func, 'vector', 1, node, 'materialTexture', 'material');
					}
				}
				return null;
			}
		};
	}
	_isPathActive(path) {
		if (!this._mask) return true;
		const rootNodeNames = [path.entityPath[0], this.graph.name];
		for (let j = 0; j < rootNodeNames.length; ++j) {
			let currEntityPath = rootNodeNames[j];
			if (this._isPathInMask(currEntityPath, path.entityPath.length === 1)) return true;
			for (let i = 1; i < path.entityPath.length; i++) {
				currEntityPath += '/' + path.entityPath[i];
				if (this._isPathInMask(currEntityPath, i === path.entityPath.length - 1)) return true;
			}
		}
		return false;
	}
	findNode(path) {
		if (!this._isPathActive(path)) {
			return null;
		}
		let node;
		if (this.graph) {
			node = this.graph.findByPath(path.entityPath);
			if (!node) {
				node = this.graph.findByPath(path.entityPath.slice(1));
			}
		}
		if (!node) {
			node = this.nodes[path.entityPath[path.entityPath.length - 1] || ""];
		}
		return node;
	}
	static createAnimTarget(func, type, valueCount, node, propertyPath, componentType) {
		const targetPath = AnimBinder.encode(node.path, componentType ? componentType : 'entity', propertyPath);
		return new AnimTarget(func, type, valueCount, targetPath);
	}
	resolve(path) {
		const encodedPath = AnimBinder.encode(path.entityPath, path.component, path.propertyPath);
		let target = this.targetCache[encodedPath];
		if (target) return target;
		const node = this.findNode(path);
		if (!node) {
			return null;
		}
		const handler = this.handlers[path.propertyPath];
		if (!handler) {
			return null;
		}
		target = handler(node);
		if (!target) {
			return null;
		}
		this.targetCache[encodedPath] = target;
		if (!this.nodeCounts[node.path]) {
			this.activeNodes.push(node);
			this.nodeCounts[node.path] = 1;
		} else {
			this.nodeCounts[node.path]++;
		}
		return target;
	}
	unresolve(path) {
		if (path.component !== 'graph') return;
		const node = this.nodes[path.entityPath[path.entityPath.length - 1] || ""];
		this.nodeCounts[node.path]--;
		if (this.nodeCounts[node.path] === 0) {
			const activeNodes = this.activeNodes;
			const i = activeNodes.indexOf(node.node);
			const len = activeNodes.length;
			if (i < len - 1) {
				activeNodes[i] = activeNodes[len - 1];
			}
			activeNodes.pop();
		}
	}
	update(deltaTime) {
		const activeNodes = this.activeNodes;
		for (let i = 0; i < activeNodes.length; ++i) {
			activeNodes[i]._dirtifyLocal();
		}
	}
	assignMask(mask) {
		if (mask !== this._mask) {
			this._mask = mask;
			return true;
		}
		return false;
	}
}

export { DefaultAnimBinder };
