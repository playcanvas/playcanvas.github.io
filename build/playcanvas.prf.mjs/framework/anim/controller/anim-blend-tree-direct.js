/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { AnimBlendTree } from './anim-blend-tree.js';

class AnimBlendTreeDirect extends AnimBlendTree {
	calculateWeights() {
		if (this.updateParameterValues()) return;
		let weightSum = 0.0;
		let weightedDurationSum = 0.0;
		for (let i = 0; i < this._children.length; i++) {
			weightSum += Math.max(this._parameterValues[i], 0.0);
			if (this._syncAnimations) {
				const child = this._children[i];
				weightedDurationSum += child.animTrack.duration / child.absoluteSpeed * child.weight;
			}
		}
		for (let i = 0; i < this._children.length; i++) {
			const child = this._children[i];
			const weight = Math.max(this._parameterValues[i], 0.0);
			if (weightSum) {
				child.weight = weight / weightSum;
				if (this._syncAnimations) {
					child.weightedSpeed = child.animTrack.duration / child.absoluteSpeed / weightedDurationSum;
				}
			} else {
				child.weight = 0.0;
				if (this._syncAnimations) {
					child.weightedSpeed = 0;
				}
			}
		}
	}
}

export { AnimBlendTreeDirect };
