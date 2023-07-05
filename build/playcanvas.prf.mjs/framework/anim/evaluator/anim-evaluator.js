import { AnimTargetValue } from './anim-target-value.js';
import { AnimBlend } from './anim-blend.js';

class AnimEvaluator {
	constructor(binder) {
		this._binder = binder;
		this._clips = [];
		this._inputs = [];
		this._outputs = [];
		this._targets = {};
	}
	get clips() {
		return this._clips;
	}
	addClip(clip) {
		const targets = this._targets;
		const binder = this._binder;
		const curves = clip.track.curves;
		const snapshot = clip.snapshot;
		const inputs = [];
		const outputs = [];
		for (let i = 0; i < curves.length; ++i) {
			const curve = curves[i];
			const paths = curve.paths;
			for (let j = 0; j < paths.length; ++j) {
				const path = paths[j];
				const resolved = binder.resolve(path);
				let target = targets[resolved && resolved.targetPath || null];
				if (!target && resolved) {
					target = {
						target: resolved,
						value: [],
						curves: 0,
						blendCounter: 0
					};
					for (let k = 0; k < target.target.components; ++k) {
						target.value.push(0);
					}
					targets[resolved.targetPath] = target;
					if (binder.animComponent) {
						if (!binder.animComponent.targets[resolved.targetPath]) {
							let type;
							if (resolved.targetPath.substring(resolved.targetPath.length - 13) === 'localRotation') {
								type = AnimTargetValue.TYPE_QUAT;
							} else {
								type = AnimTargetValue.TYPE_VEC3;
							}
							binder.animComponent.targets[resolved.targetPath] = new AnimTargetValue(binder.animComponent, type);
						}
						binder.animComponent.targets[resolved.targetPath].layerCounter++;
						binder.animComponent.targets[resolved.targetPath].setMask(binder.layerIndex, 1);
					}
				}
				if (target) {
					target.curves++;
					inputs.push(snapshot._results[i]);
					outputs.push(target);
				}
			}
		}
		this._clips.push(clip);
		this._inputs.push(inputs);
		this._outputs.push(outputs);
	}
	removeClip(index) {
		const targets = this._targets;
		const binder = this._binder;
		const clips = this._clips;
		const clip = clips[index];
		const curves = clip.track.curves;
		for (let i = 0; i < curves.length; ++i) {
			const curve = curves[i];
			const paths = curve.paths;
			for (let j = 0; j < paths.length; ++j) {
				const path = paths[j];
				const target = this._binder.resolve(path);
				if (target) {
					target.curves--;
					if (target.curves === 0) {
						binder.unresolve(path);
						delete targets[target.targetPath];
						if (binder.animComponent) {
							binder.animComponent.targets[target.targetPath].layerCounter--;
						}
					}
				}
			}
		}
		clips.splice(index, 1);
		this._inputs.splice(index, 1);
		this._outputs.splice(index, 1);
	}
	removeClips() {
		while (this._clips.length > 0) {
			this.removeClip(0);
		}
	}
	updateClipTrack(name, animTrack) {
		this._clips.forEach(clip => {
			if (clip.name.includes(name)) {
				clip.track = animTrack;
			}
		});
		this.rebind();
	}
	findClip(name) {
		const clips = this._clips;
		for (let i = 0; i < clips.length; ++i) {
			const clip = clips[i];
			if (clip.name === name) {
				return clip;
			}
		}
		return null;
	}
	rebind() {
		this._binder.rebind();
		this._targets = {};
		const clips = [...this.clips];
		this.removeClips();
		clips.forEach(clip => {
			this.addClip(clip);
		});
	}
	assignMask(mask) {
		return this._binder.assignMask(mask);
	}
	update(deltaTime, outputAnimation = true) {
		const clips = this._clips;
		const order = clips.map(function (c, i) {
			return i;
		});
		AnimBlend.stableSort(order, function (a, b) {
			return clips[a].blendOrder < clips[b].blendOrder;
		});
		for (let i = 0; i < order.length; ++i) {
			const index = order[i];
			const clip = clips[index];
			const inputs = this._inputs[index];
			const outputs = this._outputs[index];
			const blendWeight = clip.blendWeight;
			if (blendWeight > 0.0) {
				clip._update(deltaTime);
			}
			if (!outputAnimation) break;
			let input;
			let output;
			let value;
			if (blendWeight >= 1.0) {
				for (let j = 0; j < inputs.length; ++j) {
					input = inputs[j];
					output = outputs[j];
					value = output.value;
					AnimBlend.set(value, input, output.target.type);
					output.blendCounter++;
				}
			} else if (blendWeight > 0.0) {
				for (let j = 0; j < inputs.length; ++j) {
					input = inputs[j];
					output = outputs[j];
					value = output.value;
					if (output.blendCounter === 0) {
						AnimBlend.set(value, input, output.target.type);
					} else {
						AnimBlend.blend(value, input, blendWeight, output.target.type);
					}
					output.blendCounter++;
				}
			}
		}
		const targets = this._targets;
		const binder = this._binder;
		for (const path in targets) {
			if (targets.hasOwnProperty(path)) {
				const target = targets[path];
				if (binder.animComponent && target.target.isTransform) {
					const animTarget = binder.animComponent.targets[path];
					if (animTarget.counter === animTarget.layerCounter) {
						animTarget.counter = 0;
					}
					if (!animTarget.path) {
						animTarget.path = path;
						animTarget.baseValue = target.target.get();
						animTarget.setter = target.target.set;
					}
					animTarget.updateValue(binder.layerIndex, target.value);
					animTarget.counter++;
				} else {
					target.target.set(target.value);
				}
				target.blendCounter = 0;
			}
		}
		this._binder.update(deltaTime);
	}
}

export { AnimEvaluator };
