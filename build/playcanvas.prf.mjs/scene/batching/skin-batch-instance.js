/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { SkinInstance } from '../skin-instance.js';

class SkinBatchInstance extends SkinInstance {
	constructor(device, nodes, rootNode) {
		super();
		const numBones = nodes.length;
		this.init(device, numBones);
		this.device = device;
		this.rootNode = rootNode;
		this.bones = nodes;
	}
	updateMatrices(rootNode, skinUpdateIndex) {}
	updateMatrixPalette(rootNode, skinUpdateIndex) {
		const mp = this.matrixPalette;
		const count = this.bones.length;
		for (let i = 0; i < count; i++) {
			const pe = this.bones[i].getWorldTransform().data;
			const base = i * 12;
			mp[base] = pe[0];
			mp[base + 1] = pe[4];
			mp[base + 2] = pe[8];
			mp[base + 3] = pe[12];
			mp[base + 4] = pe[1];
			mp[base + 5] = pe[5];
			mp[base + 6] = pe[9];
			mp[base + 7] = pe[13];
			mp[base + 8] = pe[2];
			mp[base + 9] = pe[6];
			mp[base + 10] = pe[10];
			mp[base + 11] = pe[14];
		}
		this.uploadBones(this.device);
	}
}

export { SkinBatchInstance };
