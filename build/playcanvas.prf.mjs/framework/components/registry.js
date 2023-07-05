import { EventHandler } from '../../core/event-handler.js';

class ComponentSystemRegistry extends EventHandler {
	constructor() {
		super();
		this.anim = void 0;
		this.animation = void 0;
		this.audiolistener = void 0;
		this.audiosource = void 0;
		this.button = void 0;
		this.camera = void 0;
		this.collision = void 0;
		this.element = void 0;
		this.joint = void 0;
		this.layoutchild = void 0;
		this.layoutgroup = void 0;
		this.light = void 0;
		this.model = void 0;
		this.particlesystem = void 0;
		this.render = void 0;
		this.rigidbody = void 0;
		this.screen = void 0;
		this.script = void 0;
		this.scrollbar = void 0;
		this.scrollview = void 0;
		this.sound = void 0;
		this.sprite = void 0;
		this.zone = void 0;
		this.list = [];
	}
	add(system) {
		const id = system.id;
		if (this[id]) {
			throw new Error(`ComponentSystem name '${id}' already registered or not allowed`);
		}
		this[id] = system;
		this.list.push(system);
	}
	remove(system) {
		const id = system.id;
		if (!this[id]) {
			throw new Error(`No ComponentSystem named '${id}' registered`);
		}
		delete this[id];
		const index = this.list.indexOf(this[id]);
		if (index !== -1) {
			this.list.splice(index, 1);
		}
	}
	destroy() {
		this.off();
		for (let i = 0; i < this.list.length; i++) {
			this.list[i].destroy();
		}
	}
}

export { ComponentSystemRegistry };
