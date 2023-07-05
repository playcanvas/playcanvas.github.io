import { math } from '../../../core/math/math.js';
import { ORIENTATION_HORIZONTAL } from '../../../scene/constants.js';
import { Component } from '../component.js';
import { ElementDragHelper } from '../element/element-drag-helper.js';
import { EntityReference } from '../../utils/entity-reference.js';

class ScrollbarComponent extends Component {
	constructor(system, entity) {
		super(system, entity);
		this._handleReference = new EntityReference(this, 'handleEntity', {
			'element#gain': this._onHandleElementGain,
			'element#lose': this._onHandleElementLose,
			'element#set:anchor': this._onSetHandleAlignment,
			'element#set:margin': this._onSetHandleAlignment,
			'element#set:pivot': this._onSetHandleAlignment
		});
		this._toggleLifecycleListeners('on');
	}
	_toggleLifecycleListeners(onOrOff) {
		this[onOrOff]('set_value', this._onSetValue, this);
		this[onOrOff]('set_handleSize', this._onSetHandleSize, this);
		this[onOrOff]('set_orientation', this._onSetOrientation, this);
	}
	_onHandleElementGain() {
		this._destroyDragHelper();
		this._handleDragHelper = new ElementDragHelper(this._handleReference.entity.element, this._getAxis());
		this._handleDragHelper.on('drag:move', this._onHandleDrag, this);
		this._updateHandlePositionAndSize();
	}
	_onHandleElementLose() {
		this._destroyDragHelper();
	}
	_onHandleDrag(position) {
		if (this._handleReference.entity && this.enabled && this.entity.enabled) {
			this.value = this._handlePositionToScrollValue(position[this._getAxis()]);
		}
	}
	_onSetValue(name, oldValue, newValue) {
		if (Math.abs(newValue - oldValue) > 1e-5) {
			this.data.value = math.clamp(newValue, 0, 1);
			this._updateHandlePositionAndSize();
			this.fire('set:value', this.data.value);
		}
	}
	_onSetHandleSize(name, oldValue, newValue) {
		if (Math.abs(newValue - oldValue) > 1e-5) {
			this.data.handleSize = math.clamp(newValue, 0, 1);
			this._updateHandlePositionAndSize();
		}
	}
	_onSetHandleAlignment() {
		this._updateHandlePositionAndSize();
	}
	_onSetOrientation(name, oldValue, newValue) {
		if (newValue !== oldValue && this._handleReference.hasComponent('element')) {
			this._handleReference.entity.element[this._getOppositeDimension()] = 0;
		}
	}
	_updateHandlePositionAndSize() {
		const handleEntity = this._handleReference.entity;
		const handleElement = handleEntity && handleEntity.element;
		if (handleEntity) {
			const position = handleEntity.getLocalPosition();
			position[this._getAxis()] = this._getHandlePosition();
			this._handleReference.entity.setLocalPosition(position);
		}
		if (handleElement) {
			handleElement[this._getDimension()] = this._getHandleLength();
		}
	}
	_handlePositionToScrollValue(handlePosition) {
		return handlePosition * this._getSign() / this._getUsableTrackLength();
	}
	_scrollValueToHandlePosition(value) {
		return value * this._getSign() * this._getUsableTrackLength();
	}
	_getUsableTrackLength() {
		return Math.max(this._getTrackLength() - this._getHandleLength(), 0.001);
	}
	_getTrackLength() {
		if (this.entity.element) {
			return this.orientation === ORIENTATION_HORIZONTAL ? this.entity.element.calculatedWidth : this.entity.element.calculatedHeight;
		}
		return 0;
	}
	_getHandleLength() {
		return this._getTrackLength() * this.handleSize;
	}
	_getHandlePosition() {
		return this._scrollValueToHandlePosition(this.value);
	}
	_getSign() {
		return this.orientation === ORIENTATION_HORIZONTAL ? 1 : -1;
	}
	_getAxis() {
		return this.orientation === ORIENTATION_HORIZONTAL ? 'x' : 'y';
	}
	_getDimension() {
		return this.orientation === ORIENTATION_HORIZONTAL ? 'width' : 'height';
	}
	_getOppositeDimension() {
		return this.orientation === ORIENTATION_HORIZONTAL ? 'height' : 'width';
	}
	_destroyDragHelper() {
		if (this._handleDragHelper) {
			this._handleDragHelper.destroy();
		}
	}
	_setHandleDraggingEnabled(enabled) {
		if (this._handleDragHelper) {
			this._handleDragHelper.enabled = enabled;
		}
	}
	onEnable() {
		this._handleReference.onParentComponentEnable();
		this._setHandleDraggingEnabled(true);
	}
	onDisable() {
		this._setHandleDraggingEnabled(false);
	}
	onRemove() {
		this._destroyDragHelper();
		this._toggleLifecycleListeners('off');
	}
}

export { ScrollbarComponent };
