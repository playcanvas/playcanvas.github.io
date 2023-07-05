import { AnimNode } from './anim-node.js';

class AnimBlendTree extends AnimNode {
	constructor(state, parent, name, point, parameters, children, syncAnimations, createTree, findParameter) {
		super(state, parent, name, point);
		this._parameters = parameters;
		this._parameterValues = new Array(parameters.length);
		this._children = [];
		this._findParameter = findParameter;
		this._syncAnimations = syncAnimations !== false;
		this._pointCache = {};
		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			if (child.children) {
				this._children.push(createTree(child.type, this, null, name, 1.0, child.parameter ? [child.parameter] : child.parameters, child.children, createTree, findParameter));
			} else {
				this._children.push(new AnimNode(state, this, child.name, child.point, child.speed));
			}
		}
	}
	get weight() {
		this.calculateWeights();
		return this._parent ? this._parent.weight * this._weight : this._weight;
	}
	get syncAnimations() {
		return this._syncAnimations;
	}
	getChild(name) {
		for (let i = 0; i < this._children.length; i++) {
			if (this._children[i].name === name) return this._children[i];
		}
		return null;
	}
	updateParameterValues() {
		let paramsEqual = true;
		for (let i = 0; i < this._parameterValues.length; i++) {
			const updatedParameter = this._findParameter(this._parameters[i]).value;
			if (this._parameterValues[i] !== updatedParameter) {
				this._parameterValues[i] = updatedParameter;
				paramsEqual = false;
			}
		}
		return paramsEqual;
	}
	getNodeWeightedDuration(i) {
		return this._children[i].animTrack.duration / this._children[i].speedMultiplier * this._children[i].weight;
	}
	getNodeCount() {
		let count = 0;
		for (let i = 0; i < this._children.length; i++) {
			const child = this._children[i];
			if (child.constructor === AnimBlendTree) {
				count += this._children[i].getNodeCount();
			} else {
				count++;
			}
		}
		return count;
	}
}

export { AnimBlendTree };
