import { Mat4 } from '../../core/math/mat4.js';
import { PRIMITIVE_LINES } from '../../platform/graphics/constants.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { GraphNode } from '../graph-node.js';

const identityGraphNode = new GraphNode();
identityGraphNode.worldTransform = Mat4.IDENTITY;
identityGraphNode._dirtyWorld = identityGraphNode._dirtyNormal = false;
class ImmediateBatch {
	constructor(device, material, layer) {
		this.material = material;
		this.layer = layer;
		this.positions = [];
		this.colors = [];
		this.mesh = new Mesh(device);
		this.meshInstance = null;
	}
	addLines(positions, color) {
		const destPos = this.positions;
		const count = positions.length;
		for (let i = 0; i < count; i++) {
			const pos = positions[i];
			destPos.push(pos.x, pos.y, pos.z);
		}
		const destCol = this.colors;
		if (color.length) {
			for (let i = 0; i < count; i++) {
				const col = color[i];
				destCol.push(col.r, col.g, col.b, col.a);
			}
		} else {
			for (let i = 0; i < count; i++) {
				destCol.push(color.r, color.g, color.b, color.a);
			}
		}
	}
	addLinesArrays(positions, color) {
		const destPos = this.positions;
		for (let i = 0; i < positions.length; i += 3) {
			destPos.push(positions[i], positions[i + 1], positions[i + 2]);
		}
		const destCol = this.colors;
		if (color.length) {
			for (let i = 0; i < color.length; i += 4) {
				destCol.push(color[i], color[i + 1], color[i + 2], color[i + 3]);
			}
		} else {
			const count = positions.length / 3;
			for (let i = 0; i < count; i++) {
				destCol.push(color.r, color.g, color.b, color.a);
			}
		}
	}
	onPreRender(visibleList, transparent) {
		if (this.positions.length > 0 && this.material.transparent === transparent) {
			this.mesh.setPositions(this.positions);
			this.mesh.setColors(this.colors);
			this.mesh.update(PRIMITIVE_LINES, false);
			if (!this.meshInstance) {
				this.meshInstance = new MeshInstance(this.mesh, this.material, identityGraphNode);
			}
			this.positions.length = 0;
			this.colors.length = 0;
			visibleList.list.push(this.meshInstance);
			visibleList.length++;
		}
	}
}

export { ImmediateBatch };
