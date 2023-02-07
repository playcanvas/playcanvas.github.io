import { Vec2 } from '../../../core/math/vec2.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { ORIENTATION_HORIZONTAL } from '../../../scene/constants.js';
import { FITTING_NONE } from './constants.js';
import { Component } from '../component.js';
import { LayoutCalculator } from './layout-calculator.js';

function getElement(entity) {
	return entity.element;
}
function isEnabledAndHasEnabledElement(entity) {
	return entity.enabled && entity.element && entity.element.enabled;
}
class LayoutGroupComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this._orientation = ORIENTATION_HORIZONTAL;
		this._reverseX = false;
		this._reverseY = true;
		this._alignment = new Vec2(0, 1);
		this._padding = new Vec4();
		this._spacing = new Vec2();
		this._widthFitting = FITTING_NONE;
		this._heightFitting = FITTING_NONE;
		this._wrap = false;
		this._layoutCalculator = new LayoutCalculator();
		this._listenForReflowEvents(this.entity, 'on');
		this.entity.children.forEach(child => {
			this._listenForReflowEvents(child, 'on');
		});
		this.entity.on('childinsert', this._onChildInsert, this);
		this.entity.on('childremove', this._onChildRemove, this);
		system.app.systems.element.on('add', this._onElementOrLayoutComponentAdd, this);
		system.app.systems.element.on('beforeremove', this._onElementOrLayoutComponentRemove, this);
		system.app.systems.layoutchild.on('add', this._onElementOrLayoutComponentAdd, this);
		system.app.systems.layoutchild.on('beforeremove', this._onElementOrLayoutComponentRemove, this);
	}
	set orientation(value) {
		if (value !== this._orientation) {
			this._orientation = value;
			this._scheduleReflow();
		}
	}
	get orientation() {
		return this._orientation;
	}
	set reverseX(value) {
		if (value !== this._reverseX) {
			this._reverseX = value;
			this._scheduleReflow();
		}
	}
	get reverseX() {
		return this._reverseX;
	}
	set reverseY(value) {
		if (value !== this._reverseY) {
			this._reverseY = value;
			this._scheduleReflow();
		}
	}
	get reverseY() {
		return this._reverseY;
	}
	set alignment(value) {
		if (!value.equals(this._alignment)) {
			this._alignment.copy(value);
			this._scheduleReflow();
		}
	}
	get alignment() {
		return this._alignment;
	}
	set padding(value) {
		if (!value.equals(this._padding)) {
			this._padding.copy(value);
			this._scheduleReflow();
		}
	}
	get padding() {
		return this._padding;
	}
	set spacing(value) {
		if (!value.equals(this._spacing)) {
			this._spacing.copy(value);
			this._scheduleReflow();
		}
	}
	get spacing() {
		return this._spacing;
	}
	set widthFitting(value) {
		if (value !== this._widthFitting) {
			this._widthFitting = value;
			this._scheduleReflow();
		}
	}
	get widthFitting() {
		return this._widthFitting;
	}
	set heightFitting(value) {
		if (value !== this._heightFitting) {
			this._heightFitting = value;
			this._scheduleReflow();
		}
	}
	get heightFitting() {
		return this._heightFitting;
	}
	set wrap(value) {
		if (value !== this._wrap) {
			this._wrap = value;
			this._scheduleReflow();
		}
	}
	get wrap() {
		return this._wrap;
	}
	_isSelfOrChild(entity) {
		return entity === this.entity || this.entity.children.indexOf(entity) !== -1;
	}
	_listenForReflowEvents(target, onOff) {
		if (target.element) {
			target.element[onOff]('enableelement', this._scheduleReflow, this);
			target.element[onOff]('disableelement', this._scheduleReflow, this);
			target.element[onOff]('resize', this._scheduleReflow, this);
			target.element[onOff]('set:pivot', this._scheduleReflow, this);
		}
		if (target.layoutchild) {
			target.layoutchild[onOff]('set_enabled', this._scheduleReflow, this);
			target.layoutchild[onOff]('resize', this._scheduleReflow, this);
		}
	}
	_onElementOrLayoutComponentAdd(entity) {
		if (this._isSelfOrChild(entity)) {
			this._listenForReflowEvents(entity, 'on');
			this._scheduleReflow();
		}
	}
	_onElementOrLayoutComponentRemove(entity) {
		if (this._isSelfOrChild(entity)) {
			this._listenForReflowEvents(entity, 'off');
			this._scheduleReflow();
		}
	}
	_onChildInsert(child) {
		this._listenForReflowEvents(child, 'on');
		this._scheduleReflow();
	}
	_onChildRemove(child) {
		this._listenForReflowEvents(child, 'off');
		this._scheduleReflow();
	}
	_scheduleReflow() {
		if (this.enabled && this.entity && this.entity.enabled && !this._isPerformingReflow) {
			this.system.scheduleReflow(this);
		}
	}
	reflow() {
		const container = getElement(this.entity);
		const elements = this.entity.children.filter(isEnabledAndHasEnabledElement).map(getElement);
		if (!container || elements.length === 0) {
			return;
		}
		const containerWidth = Math.max(container.calculatedWidth, 0);
		const containerHeight = Math.max(container.calculatedHeight, 0);
		const options = {
			orientation: this._orientation,
			reverseX: this._reverseX,
			reverseY: this._reverseY,
			alignment: this._alignment,
			padding: this._padding,
			spacing: this._spacing,
			widthFitting: this._widthFitting,
			heightFitting: this._heightFitting,
			wrap: this._wrap,
			containerSize: new Vec2(containerWidth, containerHeight)
		};
		this._isPerformingReflow = true;
		const layoutInfo = this._layoutCalculator.calculateLayout(elements, options);
		this._isPerformingReflow = false;
		this.fire('reflow', layoutInfo);
	}
	onEnable() {
		this._scheduleReflow();
	}
	onRemove() {
		this.entity.off('childinsert', this._onChildInsert, this);
		this.entity.off('childremove', this._onChildRemove, this);
		this._listenForReflowEvents(this.entity, 'off');
		this.entity.children.forEach(child => {
			this._listenForReflowEvents(child, 'off');
		});
		this.system.app.systems.element.off('add', this._onElementOrLayoutComponentAdd, this);
		this.system.app.systems.element.off('beforeremove', this._onElementOrLayoutComponentRemove, this);
		this.system.app.systems.layoutchild.off('add', this._onElementOrLayoutComponentAdd, this);
		this.system.app.systems.layoutchild.off('beforeremove', this._onElementOrLayoutComponentRemove, this);
	}
}

export { LayoutGroupComponent };
