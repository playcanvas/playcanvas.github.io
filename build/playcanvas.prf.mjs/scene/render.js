import { EventHandler } from '../core/event-handler.js';

class Render extends EventHandler {
	constructor() {
		super();
		this._meshes = null;
	}
	set meshes(value) {
		this.decRefMeshes();
		this._meshes = value;
		this.incRefMeshes();
		this.fire('set:meshes', value);
	}
	get meshes() {
		return this._meshes;
	}
	destroy() {
		this.meshes = null;
	}
	decRefMeshes() {
		if (this._meshes) {
			const count = this._meshes.length;
			for (let i = 0; i < count; i++) {
				const mesh = this._meshes[i];
				if (mesh) {
					mesh.decRefCount();
					if (mesh.refCount < 1) {
						mesh.destroy();
						this._meshes[i] = null;
					}
				}
			}
		}
	}
	incRefMeshes() {
		if (this._meshes) {
			const count = this._meshes.length;
			for (let i = 0; i < count; i++) {
				if (this._meshes[i]) {
					this._meshes[i].incRefCount();
				}
			}
		}
	}
}

export { Render };
