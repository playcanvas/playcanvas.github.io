import { LAYERID_WORLD } from '../constants.js';

class BatchGroup {
	constructor(id, name, dynamic, maxAabbSize, layers = [LAYERID_WORLD]) {
		this._ui = false;
		this._sprite = false;
		this._obj = {
			model: [],
			element: [],
			sprite: [],
			render: []
		};
		this.id = void 0;
		this.name = void 0;
		this.dynamic = void 0;
		this.maxAabbSize = void 0;
		this.layers = void 0;
		this.id = id;
		this.name = name;
		this.dynamic = dynamic;
		this.maxAabbSize = maxAabbSize;
		this.layers = layers;
	}
}
BatchGroup.MODEL = 'model';
BatchGroup.ELEMENT = 'element';
BatchGroup.SPRITE = 'sprite';
BatchGroup.RENDER = 'render';

export { BatchGroup };
