import '../../../core/tracing.js';
import { math } from '../../../core/math/math.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../../scene/constants.js';
import { EntityReference } from '../../utils/entity-reference.js';
import { ElementDragHelper } from '../element/element-drag-helper.js';
import { SCROLL_MODE_INFINITE, SCROLL_MODE_BOUNCE, SCROLL_MODE_CLAMP, SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED, SCROLLBAR_VISIBILITY_SHOW_ALWAYS } from './constants.js';
import { Component } from '../component.js';
import { EVENT_MOUSEWHEEL } from '../../../platform/input/constants.js';

const _tempScrollValue = new Vec2();

class ScrollViewComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
    this._viewportReference = new EntityReference(this, 'viewportEntity', {
      'element#gain': this._onViewportElementGain,
      'element#resize': this._onSetContentOrViewportSize
    });
    this._contentReference = new EntityReference(this, 'contentEntity', {
      'element#gain': this._onContentElementGain,
      'element#lose': this._onContentElementLose,
      'element#resize': this._onSetContentOrViewportSize
    });
    this._scrollbarUpdateFlags = {};
    this._scrollbarReferences = {};
    this._scrollbarReferences[ORIENTATION_HORIZONTAL] = new EntityReference(this, 'horizontalScrollbarEntity', {
      'scrollbar#set:value': this._onSetHorizontalScrollbarValue,
      'scrollbar#gain': this._onHorizontalScrollbarGain
    });
    this._scrollbarReferences[ORIENTATION_VERTICAL] = new EntityReference(this, 'verticalScrollbarEntity', {
      'scrollbar#set:value': this._onSetVerticalScrollbarValue,
      'scrollbar#gain': this._onVerticalScrollbarGain
    });
    this._prevContentSizes = {};
    this._prevContentSizes[ORIENTATION_HORIZONTAL] = null;
    this._prevContentSizes[ORIENTATION_VERTICAL] = null;
    this._scroll = new Vec2();
    this._velocity = new Vec3();
    this._dragStartPosition = new Vec3();
    this._disabledContentInput = false;
    this._disabledContentInputEntities = [];
    this._toggleLifecycleListeners('on', system);
    this._toggleElementListeners('on');
  }

  _toggleLifecycleListeners(onOrOff, system) {
    this[onOrOff]('set_horizontal', this._onSetHorizontalScrollingEnabled, this);
    this[onOrOff]('set_vertical', this._onSetVerticalScrollingEnabled, this);
    system.app.systems.element[onOrOff]('add', this._onElementComponentAdd, this);
    system.app.systems.element[onOrOff]('beforeremove', this._onElementComponentRemove, this);
  }

  _toggleElementListeners(onOrOff) {
    if (this.entity.element) {
      if (onOrOff === 'on' && this._hasElementListeners) {
        return;
      }
      this.entity.element[onOrOff]('resize', this._onSetContentOrViewportSize, this);
      this.entity.element[onOrOff](EVENT_MOUSEWHEEL, this._onMouseWheel, this);
      this._hasElementListeners = onOrOff === 'on';
    }
  }
  _onElementComponentAdd(entity) {
    if (this.entity === entity) {
      this._toggleElementListeners('on');
    }
  }
  _onElementComponentRemove(entity) {
    if (this.entity === entity) {
      this._toggleElementListeners('off');
    }
  }
  _onViewportElementGain() {
    this._syncAll();
  }
  _onContentElementGain() {
    this._destroyDragHelper();
    this._contentDragHelper = new ElementDragHelper(this._contentReference.entity.element);
    this._contentDragHelper.on('drag:start', this._onContentDragStart, this);
    this._contentDragHelper.on('drag:end', this._onContentDragEnd, this);
    this._contentDragHelper.on('drag:move', this._onContentDragMove, this);
    this._prevContentSizes[ORIENTATION_HORIZONTAL] = null;
    this._prevContentSizes[ORIENTATION_VERTICAL] = null;
    this._syncAll();
  }
  _onContentElementLose() {
    this._destroyDragHelper();
  }
  _onContentDragStart() {
    if (this._contentReference.entity && this.enabled && this.entity.enabled) {
      this._dragStartPosition.copy(this._contentReference.entity.getLocalPosition());
    }
  }
  _onContentDragEnd() {
    this._prevContentDragPosition = null;
    this._enableContentInput();
  }
  _onContentDragMove(position) {
    if (this._contentReference.entity && this.enabled && this.entity.enabled) {
      this._wasDragged = true;
      this._setScrollFromContentPosition(position);
      this._setVelocityFromContentPositionDelta(position);

      if (!this._disabledContentInput) {
        const dx = position.x - this._dragStartPosition.x;
        const dy = position.y - this._dragStartPosition.y;
        if (Math.abs(dx) > this.dragThreshold || Math.abs(dy) > this.dragThreshold) {
          this._disableContentInput();
        }
      }
    }
  }
  _onSetContentOrViewportSize() {
    this._syncAll();
  }
  _onSetHorizontalScrollbarValue(scrollValueX) {
    if (!this._scrollbarUpdateFlags[ORIENTATION_HORIZONTAL] && this.enabled && this.entity.enabled) {
      this._onSetScroll(scrollValueX, null);
    }
  }
  _onSetVerticalScrollbarValue(scrollValueY) {
    if (!this._scrollbarUpdateFlags[ORIENTATION_VERTICAL] && this.enabled && this.entity.enabled) {
      this._onSetScroll(null, scrollValueY);
    }
  }
  _onSetHorizontalScrollingEnabled() {
    this._syncScrollbarEnabledState(ORIENTATION_HORIZONTAL);
  }
  _onSetVerticalScrollingEnabled() {
    this._syncScrollbarEnabledState(ORIENTATION_VERTICAL);
  }
  _onHorizontalScrollbarGain() {
    this._syncScrollbarEnabledState(ORIENTATION_HORIZONTAL);
    this._syncScrollbarPosition(ORIENTATION_HORIZONTAL);
  }
  _onVerticalScrollbarGain() {
    this._syncScrollbarEnabledState(ORIENTATION_VERTICAL);
    this._syncScrollbarPosition(ORIENTATION_VERTICAL);
  }
  _onSetScroll(x, y, resetVelocity) {
    if (resetVelocity !== false) {
      this._velocity.set(0, 0, 0);
    }
    const xChanged = this._updateAxis(x, 'x', ORIENTATION_HORIZONTAL);
    const yChanged = this._updateAxis(y, 'y', ORIENTATION_VERTICAL);
    if (xChanged || yChanged) {
      this.fire('set:scroll', this._scroll);
    }
  }
  _updateAxis(scrollValue, axis, orientation) {
    const hasChanged = scrollValue !== null && Math.abs(scrollValue - this._scroll[axis]) > 1e-5;

    if (hasChanged || this._isDragging() || scrollValue === 0) {
      this._scroll[axis] = this._determineNewScrollValue(scrollValue, axis, orientation);
      this._syncContentPosition(orientation);
      this._syncScrollbarPosition(orientation);
    }
    return hasChanged;
  }
  _determineNewScrollValue(scrollValue, axis, orientation) {
    if (!this._getScrollingEnabled(orientation)) {
      return this._scroll[axis];
    }
    switch (this.scrollMode) {
      case SCROLL_MODE_CLAMP:
        return math.clamp(scrollValue, 0, this._getMaxScrollValue(orientation));
      case SCROLL_MODE_BOUNCE:
        this._setVelocityFromOvershoot(scrollValue, axis, orientation);
        return scrollValue;
      case SCROLL_MODE_INFINITE:
        return scrollValue;
      default:
        console.warn('Unhandled scroll mode:' + this.scrollMode);
        return scrollValue;
    }
  }
  _syncAll() {
    this._syncContentPosition(ORIENTATION_HORIZONTAL);
    this._syncContentPosition(ORIENTATION_VERTICAL);
    this._syncScrollbarPosition(ORIENTATION_HORIZONTAL);
    this._syncScrollbarPosition(ORIENTATION_VERTICAL);
    this._syncScrollbarEnabledState(ORIENTATION_HORIZONTAL);
    this._syncScrollbarEnabledState(ORIENTATION_VERTICAL);
  }
  _syncContentPosition(orientation) {
    const axis = this._getAxis(orientation);
    const sign = this._getSign(orientation);
    const contentEntity = this._contentReference.entity;
    if (contentEntity) {
      const prevContentSize = this._prevContentSizes[orientation];
      const currContentSize = this._getContentSize(orientation);

      if (prevContentSize !== null && Math.abs(prevContentSize - currContentSize) > 1e-4) {
        const prevMaxOffset = this._getMaxOffset(orientation, prevContentSize);
        const currMaxOffset = this._getMaxOffset(orientation, currContentSize);
        if (currMaxOffset === 0) {
          this._scroll[axis] = 1;
        } else {
          this._scroll[axis] = math.clamp(this._scroll[axis] * prevMaxOffset / currMaxOffset, 0, 1);
        }
      }
      const offset = this._scroll[axis] * this._getMaxOffset(orientation);
      const contentPosition = contentEntity.getLocalPosition();
      contentPosition[axis] = offset * sign;
      contentEntity.setLocalPosition(contentPosition);
      this._prevContentSizes[orientation] = currContentSize;
    }
  }
  _syncScrollbarPosition(orientation) {
    const axis = this._getAxis(orientation);
    const scrollbarEntity = this._scrollbarReferences[orientation].entity;
    if (scrollbarEntity && scrollbarEntity.scrollbar) {
      this._scrollbarUpdateFlags[orientation] = true;
      scrollbarEntity.scrollbar.value = this._scroll[axis];
      scrollbarEntity.scrollbar.handleSize = this._getScrollbarHandleSize(axis, orientation);
      this._scrollbarUpdateFlags[orientation] = false;
    }
  }

  _syncScrollbarEnabledState(orientation) {
    const entity = this._scrollbarReferences[orientation].entity;
    if (entity) {
      const isScrollingEnabled = this._getScrollingEnabled(orientation);
      const requestedVisibility = this._getScrollbarVisibility(orientation);
      switch (requestedVisibility) {
        case SCROLLBAR_VISIBILITY_SHOW_ALWAYS:
          entity.enabled = isScrollingEnabled;
          return;
        case SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED:
          entity.enabled = isScrollingEnabled && this._contentIsLargerThanViewport(orientation);
          return;
        default:
          console.warn('Unhandled scrollbar visibility:' + requestedVisibility);
          entity.enabled = isScrollingEnabled;
      }
    }
  }
  _contentIsLargerThanViewport(orientation) {
    return this._getContentSize(orientation) > this._getViewportSize(orientation);
  }
  _contentPositionToScrollValue(contentPosition) {
    const maxOffsetH = this._getMaxOffset(ORIENTATION_HORIZONTAL);
    const maxOffsetV = this._getMaxOffset(ORIENTATION_VERTICAL);
    if (maxOffsetH === 0) {
      _tempScrollValue.x = 0;
    } else {
      _tempScrollValue.x = contentPosition.x / maxOffsetH;
    }
    if (maxOffsetV === 0) {
      _tempScrollValue.y = 0;
    } else {
      _tempScrollValue.y = contentPosition.y / -maxOffsetV;
    }
    return _tempScrollValue;
  }
  _getMaxOffset(orientation, contentSize) {
    contentSize = contentSize === undefined ? this._getContentSize(orientation) : contentSize;
    const viewportSize = this._getViewportSize(orientation);
    if (contentSize < viewportSize) {
      return -this._getViewportSize(orientation);
    }
    return viewportSize - contentSize;
  }
  _getMaxScrollValue(orientation) {
    return this._contentIsLargerThanViewport(orientation) ? 1 : 0;
  }
  _getScrollbarHandleSize(axis, orientation) {
    const viewportSize = this._getViewportSize(orientation);
    const contentSize = this._getContentSize(orientation);
    if (Math.abs(contentSize) < 0.001) {
      return 1;
    }
    const handleSize = Math.min(viewportSize / contentSize, 1);
    const overshoot = this._toOvershoot(this._scroll[axis], orientation);
    if (overshoot === 0) {
      return handleSize;
    }

    return handleSize / (1 + Math.abs(overshoot));
  }
  _getViewportSize(orientation) {
    return this._getSize(orientation, this._viewportReference);
  }
  _getContentSize(orientation) {
    return this._getSize(orientation, this._contentReference);
  }
  _getSize(orientation, entityReference) {
    if (entityReference.entity && entityReference.entity.element) {
      return entityReference.entity.element[this._getCalculatedDimension(orientation)];
    }
    return 0;
  }
  _getScrollingEnabled(orientation) {
    if (orientation === ORIENTATION_HORIZONTAL) {
      return this.horizontal;
    } else if (orientation === ORIENTATION_VERTICAL) {
      return this.vertical;
    }
    return undefined;
  }
  _getScrollbarVisibility(orientation) {
    if (orientation === ORIENTATION_HORIZONTAL) {
      return this.horizontalScrollbarVisibility;
    } else if (orientation === ORIENTATION_VERTICAL) {
      return this.verticalScrollbarVisibility;
    }
    return undefined;
  }
  _getSign(orientation) {
    return orientation === ORIENTATION_HORIZONTAL ? 1 : -1;
  }
  _getAxis(orientation) {
    return orientation === ORIENTATION_HORIZONTAL ? 'x' : 'y';
  }
  _getCalculatedDimension(orientation) {
    return orientation === ORIENTATION_HORIZONTAL ? 'calculatedWidth' : 'calculatedHeight';
  }
  _destroyDragHelper() {
    if (this._contentDragHelper) {
      this._contentDragHelper.destroy();
    }
  }
  onUpdate() {
    if (this._contentReference.entity) {
      this._updateVelocity();
      this._syncScrollbarEnabledState(ORIENTATION_HORIZONTAL);
      this._syncScrollbarEnabledState(ORIENTATION_VERTICAL);
    }
  }
  _updateVelocity() {
    if (!this._isDragging()) {
      if (this.scrollMode === SCROLL_MODE_BOUNCE) {
        if (this._hasOvershoot('x', ORIENTATION_HORIZONTAL)) {
          this._setVelocityFromOvershoot(this.scroll.x, 'x', ORIENTATION_HORIZONTAL);
        }
        if (this._hasOvershoot('y', ORIENTATION_VERTICAL)) {
          this._setVelocityFromOvershoot(this.scroll.y, 'y', ORIENTATION_VERTICAL);
        }
      }
      if (Math.abs(this._velocity.x) > 1e-4 || Math.abs(this._velocity.y) > 1e-4) {
        const position = this._contentReference.entity.getLocalPosition();
        position.x += this._velocity.x;
        position.y += this._velocity.y;
        this._contentReference.entity.setLocalPosition(position);
        this._setScrollFromContentPosition(position);
      }
      this._velocity.x *= 1 - this.friction;
      this._velocity.y *= 1 - this.friction;
    }
  }
  _hasOvershoot(axis, orientation) {
    return Math.abs(this._toOvershoot(this.scroll[axis], orientation)) > 0.001;
  }
  _toOvershoot(scrollValue, orientation) {
    const maxScrollValue = this._getMaxScrollValue(orientation);
    if (scrollValue < 0) {
      return scrollValue;
    } else if (scrollValue > maxScrollValue) {
      return scrollValue - maxScrollValue;
    }
    return 0;
  }
  _setVelocityFromOvershoot(scrollValue, axis, orientation) {
    const overshootValue = this._toOvershoot(scrollValue, orientation);
    const overshootPixels = overshootValue * this._getMaxOffset(orientation) * this._getSign(orientation);
    if (Math.abs(overshootPixels) > 0) {
      this._velocity[axis] = -overshootPixels / (this.bounceAmount * 50 + 1);
    }
  }
  _setVelocityFromContentPositionDelta(position) {
    if (this._prevContentDragPosition) {
      this._velocity.sub2(position, this._prevContentDragPosition);
      this._prevContentDragPosition.copy(position);
    } else {
      this._velocity.set(0, 0, 0);
      this._prevContentDragPosition = position.clone();
    }
  }
  _setScrollFromContentPosition(position) {
    let scrollValue = this._contentPositionToScrollValue(position);
    if (this._isDragging()) {
      scrollValue = this._applyScrollValueTension(scrollValue);
    }
    this._onSetScroll(scrollValue.x, scrollValue.y, false);
  }

  _applyScrollValueTension(scrollValue) {
    const factor = 1;
    let max = this._getMaxScrollValue(ORIENTATION_HORIZONTAL);
    let overshoot = this._toOvershoot(scrollValue.x, ORIENTATION_HORIZONTAL);
    if (overshoot > 0) {
      scrollValue.x = max + factor * Math.log10(1 + overshoot);
    } else if (overshoot < 0) {
      scrollValue.x = -factor * Math.log10(1 - overshoot);
    }
    max = this._getMaxScrollValue(ORIENTATION_VERTICAL);
    overshoot = this._toOvershoot(scrollValue.y, ORIENTATION_VERTICAL);
    if (overshoot > 0) {
      scrollValue.y = max + factor * Math.log10(1 + overshoot);
    } else if (overshoot < 0) {
      scrollValue.y = -factor * Math.log10(1 - overshoot);
    }
    return scrollValue;
  }
  _isDragging() {
    return this._contentDragHelper && this._contentDragHelper.isDragging;
  }
  _setScrollbarComponentsEnabled(enabled) {
    if (this._scrollbarReferences[ORIENTATION_HORIZONTAL].hasComponent('scrollbar')) {
      this._scrollbarReferences[ORIENTATION_HORIZONTAL].entity.scrollbar.enabled = enabled;
    }
    if (this._scrollbarReferences[ORIENTATION_VERTICAL].hasComponent('scrollbar')) {
      this._scrollbarReferences[ORIENTATION_VERTICAL].entity.scrollbar.enabled = enabled;
    }
  }
  _setContentDraggingEnabled(enabled) {
    if (this._contentDragHelper) {
      this._contentDragHelper.enabled = enabled;
    }
  }
  _onMouseWheel(event) {
    if (this.useMouseWheel) {
      const wheelEvent = event.event;

      const normalizedDeltaX = wheelEvent.deltaX / this._contentReference.entity.element.calculatedWidth * this.mouseWheelSensitivity.x;
      const normalizedDeltaY = wheelEvent.deltaY / this._contentReference.entity.element.calculatedHeight * this.mouseWheelSensitivity.y;

      const scrollX = math.clamp(this._scroll.x + normalizedDeltaX, 0, this._getMaxScrollValue(ORIENTATION_HORIZONTAL));
      const scrollY = math.clamp(this._scroll.y + normalizedDeltaY, 0, this._getMaxScrollValue(ORIENTATION_VERTICAL));
      this.scroll = new Vec2(scrollX, scrollY);
    }
  }

  _enableContentInput() {
    while (this._disabledContentInputEntities.length) {
      const e = this._disabledContentInputEntities.pop();
      if (e.element) {
        e.element.useInput = true;
      }
    }
    this._disabledContentInput = false;
  }

  _disableContentInput() {
    const _disableInput = e => {
      if (e.element && e.element.useInput) {
        this._disabledContentInputEntities.push(e);
        e.element.useInput = false;
      }
      const children = e.children;
      for (let i = 0, l = children.length; i < l; i++) {
        _disableInput(children[i]);
      }
    };
    const contentEntity = this._contentReference.entity;
    if (contentEntity) {
      const children = contentEntity.children;
      for (let i = 0, l = children.length; i < l; i++) {
        _disableInput(children[i]);
      }
    }
    this._disabledContentInput = true;
  }
  onEnable() {
    this._viewportReference.onParentComponentEnable();
    this._contentReference.onParentComponentEnable();
    this._scrollbarReferences[ORIENTATION_HORIZONTAL].onParentComponentEnable();
    this._scrollbarReferences[ORIENTATION_VERTICAL].onParentComponentEnable();
    this._setScrollbarComponentsEnabled(true);
    this._setContentDraggingEnabled(true);
    this._syncAll();
  }
  onDisable() {
    this._setScrollbarComponentsEnabled(false);
    this._setContentDraggingEnabled(false);
  }
  onRemove() {
    this._toggleLifecycleListeners('off', this.system);
    this._toggleElementListeners('off');
    this._destroyDragHelper();
  }
  set scroll(value) {
    this._onSetScroll(value.x, value.y);
  }
  get scroll() {
    return this._scroll;
  }
}

export { ScrollViewComponent };