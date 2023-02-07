import { Component } from '../component.js';

class LayoutChildComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this._minWidth = 0;
		this._minHeight = 0;
		this._maxWidth = null;
		this._maxHeight = null;
		this._fitWidthProportion = 0;
		this._fitHeightProportion = 0;
		this._excludeFromLayout = false;
	}
	set minWidth(value) {
		if (value !== this._minWidth) {
			this._minWidth = value;
			this.fire('resize');
		}
	}
	get minWidth() {
		return this._minWidth;
	}
	set minHeight(value) {
		if (value !== this._minHeight) {
			this._minHeight = value;
			this.fire('resize');
		}
	}
	get minHeight() {
		return this._minHeight;
	}
	set maxWidth(value) {
		if (value !== this._maxWidth) {
			this._maxWidth = value;
			this.fire('resize');
		}
	}
	get maxWidth() {
		return this._maxWidth;
	}
	set maxHeight(value) {
		if (value !== this._maxHeight) {
			this._maxHeight = value;
			this.fire('resize');
		}
	}
	get maxHeight() {
		return this._maxHeight;
	}
	set fitWidthProportion(value) {
		if (value !== this._fitWidthProportion) {
			this._fitWidthProportion = value;
			this.fire('resize');
		}
	}
	get fitWidthProportion() {
		return this._fitWidthProportion;
	}
	set fitHeightProportion(value) {
		if (value !== this._fitHeightProportion) {
			this._fitHeightProportion = value;
			this.fire('resize');
		}
	}
	get fitHeightProportion() {
		return this._fitHeightProportion;
	}
	set excludeFromLayout(value) {
		if (value !== this._excludeFromLayout) {
			this._excludeFromLayout = value;
			this.fire('resize');
		}
	}
	get excludeFromLayout() {
		return this._excludeFromLayout;
	}
}

export { LayoutChildComponent };
