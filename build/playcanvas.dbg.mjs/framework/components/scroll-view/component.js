/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
import { math } from '../../../math/math.js';
import { Vec2 } from '../../../math/vec2.js';
import { Vec3 } from '../../../math/vec3.js';
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../../scene/constants.js';
import { EntityReference } from '../../utils/entity-reference.js';
import { ElementDragHelper } from '../element/element-drag-helper.js';
import { SCROLL_MODE_INFINITE, SCROLL_MODE_BOUNCE, SCROLL_MODE_CLAMP, SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED, SCROLLBAR_VISIBILITY_SHOW_ALWAYS } from './constants.js';
import { Component } from '../component.js';
import { EVENT_MOUSEWHEEL } from '../../../input/constants.js';

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

    Debug.warn(`Unrecognized orientation: ${orientation}`);
    return undefined;
  }

  _getScrollbarVisibility(orientation) {
    if (orientation === ORIENTATION_HORIZONTAL) {
      return this.horizontalScrollbarVisibility;
    } else if (orientation === ORIENTATION_VERTICAL) {
      return this.verticalScrollbarVisibility;
    }

    Debug.warn(`Unrecognized orientation: ${orientation}`);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2Nyb2xsLXZpZXcvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uLy4uL21hdGgvdmVjMi5qcyc7XG5pbXBvcnQgeyBWZWMzIH0gZnJvbSAnLi4vLi4vLi4vbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHsgT1JJRU5UQVRJT05fSE9SSVpPTlRBTCwgT1JJRU5UQVRJT05fVkVSVElDQUwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHlSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi91dGlscy9lbnRpdHktcmVmZXJlbmNlLmpzJztcblxuaW1wb3J0IHsgRWxlbWVudERyYWdIZWxwZXIgfSBmcm9tICcuLi9lbGVtZW50L2VsZW1lbnQtZHJhZy1oZWxwZXIuanMnO1xuXG5pbXBvcnQgeyBTQ1JPTExfTU9ERV9CT1VOQ0UsIFNDUk9MTF9NT0RFX0NMQU1QLCBTQ1JPTExfTU9ERV9JTkZJTklURSwgU0NST0xMQkFSX1ZJU0lCSUxJVFlfU0hPV19BTFdBWVMsIFNDUk9MTEJBUl9WSVNJQklMSVRZX1NIT1dfV0hFTl9SRVFVSVJFRCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBFVkVOVF9NT1VTRVdIRUVMIH0gZnJvbSAnLi4vLi4vLi4vaW5wdXQvY29uc3RhbnRzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gRW50aXR5ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5TY3JvbGxWaWV3Q29tcG9uZW50U3lzdGVtfSBTY3JvbGxWaWV3Q29tcG9uZW50U3lzdGVtICovXG5cbmNvbnN0IF90ZW1wU2Nyb2xsVmFsdWUgPSBuZXcgVmVjMigpO1xuXG4vKipcbiAqIEEgU2Nyb2xsVmlld0NvbXBvbmVudCBlbmFibGVzIGEgZ3JvdXAgb2YgZW50aXRpZXMgdG8gYmVoYXZlIGxpa2UgYSBtYXNrZWQgc2Nyb2xsaW5nIGFyZWEsIHdpdGhcbiAqIG9wdGlvbmFsIGhvcml6b250YWwgYW5kIHZlcnRpY2FsIHNjcm9sbCBiYXJzLlxuICpcbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gaG9yaXpvbnRhbCBXaGV0aGVyIHRvIGVuYWJsZSBob3Jpem9udGFsIHNjcm9sbGluZy5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdmVydGljYWwgV2hldGhlciB0byBlbmFibGUgdmVydGljYWwgc2Nyb2xsaW5nLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHNjcm9sbE1vZGUgU3BlY2lmaWVzIGhvdyB0aGUgc2Nyb2xsIHZpZXcgc2hvdWxkIGJlaGF2ZSB3aGVuIHRoZSB1c2VyIHNjcm9sbHNcbiAqIHBhc3QgdGhlIGVuZCBvZiB0aGUgY29udGVudC4gTW9kZXMgYXJlIGRlZmluZWQgYXMgZm9sbG93czpcbiAqXG4gKiAtIHtAbGluayBTQ1JPTExfTU9ERV9DTEFNUH06IENvbnRlbnQgZG9lcyBub3Qgc2Nyb2xsIGFueSBmdXJ0aGVyIHRoYW4gaXRzIGJvdW5kcy5cbiAqIC0ge0BsaW5rIFNDUk9MTF9NT0RFX0JPVU5DRX06IENvbnRlbnQgc2Nyb2xscyBwYXN0IGl0cyBib3VuZHMgYW5kIHRoZW4gZ2VudGx5IGJvdW5jZXMgYmFjay5cbiAqIC0ge0BsaW5rIFNDUk9MTF9NT0RFX0lORklOSVRFfTogQ29udGVudCBjYW4gc2Nyb2xsIGZvcmV2ZXIuXG4gKlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGJvdW5jZUFtb3VudCBDb250cm9scyBob3cgZmFyIHRoZSBjb250ZW50IHNob3VsZCBtb3ZlIGJlZm9yZSBib3VuY2luZyBiYWNrLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGZyaWN0aW9uIENvbnRyb2xzIGhvdyBmcmVlbHkgdGhlIGNvbnRlbnQgc2hvdWxkIG1vdmUgaWYgdGhyb3duLCBpLmUuIEJ5XG4gKiBmbGlja2luZyBvbiBhIHBob25lIG9yIGJ5IGZsaW5naW5nIHRoZSBzY3JvbGwgd2hlZWwgb24gYSBtb3VzZS4gQSB2YWx1ZSBvZiAxIG1lYW5zIHRoYXQgY29udGVudFxuICogd2lsbCBzdG9wIGltbWVkaWF0ZWx5OyAwIG1lYW5zIHRoYXQgY29udGVudCB3aWxsIGNvbnRpbnVlIG1vdmluZyBmb3JldmVyIChvciB1bnRpbCB0aGUgYm91bmRzIG9mXG4gKiB0aGUgY29udGVudCBhcmUgcmVhY2hlZCwgZGVwZW5kaW5nIG9uIHRoZSBzY3JvbGxNb2RlKS5cbiAqIEBwcm9wZXJ0eSB7Ym9vbGVhbn0gdXNlTW91c2VXaGVlbCBXaGV0aGVyIHRvIHVzZSBtb3VzZSB3aGVlbCBmb3Igc2Nyb2xsaW5nIChob3Jpem9udGFsbHkgYW5kXG4gKiB2ZXJ0aWNhbGx5KS5cbiAqIEBwcm9wZXJ0eSB7VmVjMn0gbW91c2VXaGVlbFNlbnNpdGl2aXR5IE1vdXNlIHdoZWVsIGhvcml6b250YWwgYW5kIHZlcnRpY2FsIHNlbnNpdGl2aXR5LiBPbmx5XG4gKiB1c2VkIGlmIHVzZU1vdXNlV2hlZWwgaXMgc2V0LiBTZXR0aW5nIGEgZGlyZWN0aW9uIHRvIDAgd2lsbCBkaXNhYmxlIG1vdXNlIHdoZWVsIHNjcm9sbGluZyBpblxuICogdGhhdCBkaXJlY3Rpb24uIDEgaXMgYSBkZWZhdWx0IHNlbnNpdGl2aXR5IHRoYXQgaXMgY29uc2lkZXJlZCB0byBmZWVsIGdvb2QuIFRoZSB2YWx1ZXMgY2FuIGJlXG4gKiBzZXQgaGlnaGVyIG9yIGxvd2VyIHRoYW4gMSB0byB0dW5lIHRoZSBzZW5zaXRpdml0eS4gRGVmYXVsdHMgdG8gWzEsIDFdLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGhvcml6b250YWxTY3JvbGxiYXJWaXNpYmlsaXR5IENvbnRyb2xzIHdoZXRoZXIgdGhlIGhvcml6b250YWwgc2Nyb2xsYmFyXG4gKiBzaG91bGQgYmUgdmlzaWJsZSBhbGwgdGhlIHRpbWUsIG9yIG9ubHkgdmlzaWJsZSB3aGVuIHRoZSBjb250ZW50IGV4Y2VlZHMgdGhlIHNpemUgb2YgdGhlXG4gKiB2aWV3cG9ydC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSB2ZXJ0aWNhbFNjcm9sbGJhclZpc2liaWxpdHkgQ29udHJvbHMgd2hldGhlciB0aGUgdmVydGljYWwgc2Nyb2xsYmFyIHNob3VsZCBiZVxuICogdmlzaWJsZSBhbGwgdGhlIHRpbWUsIG9yIG9ubHkgdmlzaWJsZSB3aGVuIHRoZSBjb250ZW50IGV4Y2VlZHMgdGhlIHNpemUgb2YgdGhlIHZpZXdwb3J0LlxuICogQHByb3BlcnR5IHtFbnRpdHl9IHZpZXdwb3J0RW50aXR5IFRoZSBlbnRpdHkgdG8gYmUgdXNlZCBhcyB0aGUgbWFza2VkIHZpZXdwb3J0IGFyZWEsIHdpdGhpblxuICogd2hpY2ggdGhlIGNvbnRlbnQgd2lsbCBzY3JvbGwuIFRoaXMgZW50aXR5IG11c3QgaGF2ZSBhbiBFbGVtZW50R3JvdXAgY29tcG9uZW50LlxuICogQHByb3BlcnR5IHtFbnRpdHl9IGNvbnRlbnRFbnRpdHkgVGhlIGVudGl0eSB3aGljaCBjb250YWlucyB0aGUgc2Nyb2xsaW5nIGNvbnRlbnQgaXRzZWxmLiBUaGlzXG4gKiBlbnRpdHkgbXVzdCBoYXZlIGFuIEVsZW1lbnQgY29tcG9uZW50LlxuICogQHByb3BlcnR5IHtFbnRpdHl9IGhvcml6b250YWxTY3JvbGxiYXJFbnRpdHkgVGhlIGVudGl0eSB0byBiZSB1c2VkIGFzIHRoZSB2ZXJ0aWNhbCBzY3JvbGxiYXIuXG4gKiBUaGlzIGVudGl0eSBtdXN0IGhhdmUgYSBTY3JvbGxiYXIgY29tcG9uZW50LlxuICogQHByb3BlcnR5IHtFbnRpdHl9IHZlcnRpY2FsU2Nyb2xsYmFyRW50aXR5IFRoZSBlbnRpdHkgdG8gYmUgdXNlZCBhcyB0aGUgdmVydGljYWwgc2Nyb2xsYmFyLiBUaGlzXG4gKiBlbnRpdHkgbXVzdCBoYXZlIGEgU2Nyb2xsYmFyIGNvbXBvbmVudC5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgU2Nyb2xsVmlld0NvbXBvbmVudCBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFNjcm9sbFZpZXdDb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1Njcm9sbFZpZXdDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdCBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgRW50aXR5IHRoYXQgdGhpcyBDb21wb25lbnQgaXMgYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX3ZpZXdwb3J0UmVmZXJlbmNlID0gbmV3IEVudGl0eVJlZmVyZW5jZSh0aGlzLCAndmlld3BvcnRFbnRpdHknLCB7XG4gICAgICAgICAgICAnZWxlbWVudCNnYWluJzogdGhpcy5fb25WaWV3cG9ydEVsZW1lbnRHYWluLFxuICAgICAgICAgICAgJ2VsZW1lbnQjcmVzaXplJzogdGhpcy5fb25TZXRDb250ZW50T3JWaWV3cG9ydFNpemVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5fY29udGVudFJlZmVyZW5jZSA9IG5ldyBFbnRpdHlSZWZlcmVuY2UodGhpcywgJ2NvbnRlbnRFbnRpdHknLCB7XG4gICAgICAgICAgICAnZWxlbWVudCNnYWluJzogdGhpcy5fb25Db250ZW50RWxlbWVudEdhaW4sXG4gICAgICAgICAgICAnZWxlbWVudCNsb3NlJzogdGhpcy5fb25Db250ZW50RWxlbWVudExvc2UsXG4gICAgICAgICAgICAnZWxlbWVudCNyZXNpemUnOiB0aGlzLl9vblNldENvbnRlbnRPclZpZXdwb3J0U2l6ZVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl9zY3JvbGxiYXJVcGRhdGVGbGFncyA9IHt9O1xuICAgICAgICB0aGlzLl9zY3JvbGxiYXJSZWZlcmVuY2VzID0ge307XG4gICAgICAgIHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fSE9SSVpPTlRBTF0gPSBuZXcgRW50aXR5UmVmZXJlbmNlKHRoaXMsICdob3Jpem9udGFsU2Nyb2xsYmFyRW50aXR5Jywge1xuICAgICAgICAgICAgJ3Njcm9sbGJhciNzZXQ6dmFsdWUnOiB0aGlzLl9vblNldEhvcml6b250YWxTY3JvbGxiYXJWYWx1ZSxcbiAgICAgICAgICAgICdzY3JvbGxiYXIjZ2Fpbic6IHRoaXMuX29uSG9yaXpvbnRhbFNjcm9sbGJhckdhaW5cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdID0gbmV3IEVudGl0eVJlZmVyZW5jZSh0aGlzLCAndmVydGljYWxTY3JvbGxiYXJFbnRpdHknLCB7XG4gICAgICAgICAgICAnc2Nyb2xsYmFyI3NldDp2YWx1ZSc6IHRoaXMuX29uU2V0VmVydGljYWxTY3JvbGxiYXJWYWx1ZSxcbiAgICAgICAgICAgICdzY3JvbGxiYXIjZ2Fpbic6IHRoaXMuX29uVmVydGljYWxTY3JvbGxiYXJHYWluXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX3ByZXZDb250ZW50U2l6ZXMgPSB7fTtcbiAgICAgICAgdGhpcy5fcHJldkNvbnRlbnRTaXplc1tPUklFTlRBVElPTl9IT1JJWk9OVEFMXSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3ByZXZDb250ZW50U2l6ZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9zY3JvbGwgPSBuZXcgVmVjMigpO1xuICAgICAgICB0aGlzLl92ZWxvY2l0eSA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgdGhpcy5fZHJhZ1N0YXJ0UG9zaXRpb24gPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dEVudGl0aWVzID0gW107XG5cbiAgICAgICAgdGhpcy5fdG9nZ2xlTGlmZWN5Y2xlTGlzdGVuZXJzKCdvbicsIHN5c3RlbSk7XG4gICAgICAgIHRoaXMuX3RvZ2dsZUVsZW1lbnRMaXN0ZW5lcnMoJ29uJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbmV2ZXIgdGhlIHNjcm9sbCBwb3NpdGlvbiBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcm9sbFZpZXdDb21wb25lbnQjc2V0OnNjcm9sbFxuICAgICAqIEBwYXJhbSB7VmVjMn0gc2Nyb2xsUG9zaXRpb24gLSBIb3Jpem9udGFsIGFuZCB2ZXJ0aWNhbCBzY3JvbGwgdmFsdWVzIGluIHRoZSByYW5nZSAwLi4uMS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBvbk9yT2ZmIC0gJ29uJyBvciAnb2ZmJy5cbiAgICAgKiBAcGFyYW0ge1Njcm9sbFZpZXdDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdCBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RvZ2dsZUxpZmVjeWNsZUxpc3RlbmVycyhvbk9yT2ZmLCBzeXN0ZW0pIHtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X2hvcml6b250YWwnLCB0aGlzLl9vblNldEhvcml6b250YWxTY3JvbGxpbmdFbmFibGVkLCB0aGlzKTtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X3ZlcnRpY2FsJywgdGhpcy5fb25TZXRWZXJ0aWNhbFNjcm9sbGluZ0VuYWJsZWQsIHRoaXMpO1xuXG4gICAgICAgIHN5c3RlbS5hcHAuc3lzdGVtcy5lbGVtZW50W29uT3JPZmZdKCdhZGQnLCB0aGlzLl9vbkVsZW1lbnRDb21wb25lbnRBZGQsIHRoaXMpO1xuICAgICAgICBzeXN0ZW0uYXBwLnN5c3RlbXMuZWxlbWVudFtvbk9yT2ZmXSgnYmVmb3JlcmVtb3ZlJywgdGhpcy5fb25FbGVtZW50Q29tcG9uZW50UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gb25Pck9mZiAtICdvbicgb3IgJ29mZicuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdG9nZ2xlRWxlbWVudExpc3RlbmVycyhvbk9yT2ZmKSB7XG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbGVtZW50KSB7XG4gICAgICAgICAgICBpZiAob25Pck9mZiA9PT0gJ29uJyAmJiB0aGlzLl9oYXNFbGVtZW50TGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCdyZXNpemUnLCB0aGlzLl9vblNldENvbnRlbnRPclZpZXdwb3J0U2l6ZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKEVWRU5UX01PVVNFV0hFRUwsIHRoaXMuX29uTW91c2VXaGVlbCwgdGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMuX2hhc0VsZW1lbnRMaXN0ZW5lcnMgPSAob25Pck9mZiA9PT0gJ29uJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25FbGVtZW50Q29tcG9uZW50QWRkKGVudGl0eSkge1xuICAgICAgICBpZiAodGhpcy5lbnRpdHkgPT09IGVudGl0eSkge1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlRWxlbWVudExpc3RlbmVycygnb24nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkVsZW1lbnRDb21wb25lbnRSZW1vdmUoZW50aXR5KSB7XG4gICAgICAgIGlmICh0aGlzLmVudGl0eSA9PT0gZW50aXR5KSB7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVFbGVtZW50TGlzdGVuZXJzKCdvZmYnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblZpZXdwb3J0RWxlbWVudEdhaW4oKSB7XG4gICAgICAgIHRoaXMuX3N5bmNBbGwoKTtcbiAgICB9XG5cbiAgICBfb25Db250ZW50RWxlbWVudEdhaW4oKSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lEcmFnSGVscGVyKCk7XG4gICAgICAgIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyID0gbmV3IEVsZW1lbnREcmFnSGVscGVyKHRoaXMuX2NvbnRlbnRSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQpO1xuICAgICAgICB0aGlzLl9jb250ZW50RHJhZ0hlbHBlci5vbignZHJhZzpzdGFydCcsIHRoaXMuX29uQ29udGVudERyYWdTdGFydCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyLm9uKCdkcmFnOmVuZCcsIHRoaXMuX29uQ29udGVudERyYWdFbmQsIHRoaXMpO1xuICAgICAgICB0aGlzLl9jb250ZW50RHJhZ0hlbHBlci5vbignZHJhZzptb3ZlJywgdGhpcy5fb25Db250ZW50RHJhZ01vdmUsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX3ByZXZDb250ZW50U2l6ZXNbT1JJRU5UQVRJT05fSE9SSVpPTlRBTF0gPSBudWxsO1xuICAgICAgICB0aGlzLl9wcmV2Q29udGVudFNpemVzW09SSUVOVEFUSU9OX1ZFUlRJQ0FMXSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc3luY0FsbCgpO1xuICAgIH1cblxuICAgIF9vbkNvbnRlbnRFbGVtZW50TG9zZSgpIHtcbiAgICAgICAgdGhpcy5fZGVzdHJveURyYWdIZWxwZXIoKTtcbiAgICB9XG5cbiAgICBfb25Db250ZW50RHJhZ1N0YXJ0KCkge1xuICAgICAgICBpZiAodGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2RyYWdTdGFydFBvc2l0aW9uLmNvcHkodGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkNvbnRlbnREcmFnRW5kKCkge1xuICAgICAgICB0aGlzLl9wcmV2Q29udGVudERyYWdQb3NpdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VuYWJsZUNvbnRlbnRJbnB1dCgpO1xuICAgIH1cblxuICAgIF9vbkNvbnRlbnREcmFnTW92ZShwb3NpdGlvbikge1xuICAgICAgICBpZiAodGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3dhc0RyYWdnZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fc2V0U2Nyb2xsRnJvbUNvbnRlbnRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9zZXRWZWxvY2l0eUZyb21Db250ZW50UG9zaXRpb25EZWx0YShwb3NpdGlvbik7XG5cbiAgICAgICAgICAgIC8vIGlmIHdlIGhhdmVuJ3QgYWxyZWFkeSwgd2hlbiBzY3JvbGxpbmcgc3RhcnRzXG4gICAgICAgICAgICAvLyBkaXNhYmxlIGlucHV0IG9uIGFsbCBjaGlsZCBlbGVtZW50c1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dCkge1xuXG4gICAgICAgICAgICAgICAgLy8gRGlzYWJsZSBpbnB1dCBldmVudHMgb24gY29udGVudCBhZnRlciB3ZSd2ZSBtb3ZlZCBwYXN0IGEgdGhyZXNob2xkIHZhbHVlXG4gICAgICAgICAgICAgICAgY29uc3QgZHggPSAocG9zaXRpb24ueCAtIHRoaXMuX2RyYWdTdGFydFBvc2l0aW9uLngpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGR5ID0gKHBvc2l0aW9uLnkgLSB0aGlzLl9kcmFnU3RhcnRQb3NpdGlvbi55KTtcblxuICAgICAgICAgICAgICAgIGlmIChNYXRoLmFicyhkeCkgPiB0aGlzLmRyYWdUaHJlc2hvbGQgfHxcbiAgICAgICAgICAgICAgICAgICAgTWF0aC5hYnMoZHkpID4gdGhpcy5kcmFnVGhyZXNob2xkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2Rpc2FibGVDb250ZW50SW5wdXQoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNldENvbnRlbnRPclZpZXdwb3J0U2l6ZSgpIHtcbiAgICAgICAgdGhpcy5fc3luY0FsbCgpO1xuICAgIH1cblxuICAgIF9vblNldEhvcml6b250YWxTY3JvbGxiYXJWYWx1ZShzY3JvbGxWYWx1ZVgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zY3JvbGxiYXJVcGRhdGVGbGFnc1tPUklFTlRBVElPTl9IT1JJWk9OVEFMXSAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fb25TZXRTY3JvbGwoc2Nyb2xsVmFsdWVYLCBudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNldFZlcnRpY2FsU2Nyb2xsYmFyVmFsdWUoc2Nyb2xsVmFsdWVZKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Nyb2xsYmFyVXBkYXRlRmxhZ3NbT1JJRU5UQVRJT05fVkVSVElDQUxdICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9vblNldFNjcm9sbChudWxsLCBzY3JvbGxWYWx1ZVkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2V0SG9yaXpvbnRhbFNjcm9sbGluZ0VuYWJsZWQoKSB7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJFbmFibGVkU3RhdGUoT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgfVxuXG4gICAgX29uU2V0VmVydGljYWxTY3JvbGxpbmdFbmFibGVkKCkge1xuICAgICAgICB0aGlzLl9zeW5jU2Nyb2xsYmFyRW5hYmxlZFN0YXRlKE9SSUVOVEFUSU9OX1ZFUlRJQ0FMKTtcbiAgICB9XG5cbiAgICBfb25Ib3Jpem9udGFsU2Nyb2xsYmFyR2FpbigpIHtcbiAgICAgICAgdGhpcy5fc3luY1Njcm9sbGJhckVuYWJsZWRTdGF0ZShPUklFTlRBVElPTl9IT1JJWk9OVEFMKTtcbiAgICAgICAgdGhpcy5fc3luY1Njcm9sbGJhclBvc2l0aW9uKE9SSUVOVEFUSU9OX0hPUklaT05UQUwpO1xuICAgIH1cblxuICAgIF9vblZlcnRpY2FsU2Nyb2xsYmFyR2FpbigpIHtcbiAgICAgICAgdGhpcy5fc3luY1Njcm9sbGJhckVuYWJsZWRTdGF0ZShPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJQb3NpdGlvbihPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgfVxuXG4gICAgX29uU2V0U2Nyb2xsKHgsIHksIHJlc2V0VmVsb2NpdHkpIHtcbiAgICAgICAgaWYgKHJlc2V0VmVsb2NpdHkgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICB0aGlzLl92ZWxvY2l0eS5zZXQoMCwgMCwgMCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB4Q2hhbmdlZCA9IHRoaXMuX3VwZGF0ZUF4aXMoeCwgJ3gnLCBPUklFTlRBVElPTl9IT1JJWk9OVEFMKTtcbiAgICAgICAgY29uc3QgeUNoYW5nZWQgPSB0aGlzLl91cGRhdGVBeGlzKHksICd5JywgT1JJRU5UQVRJT05fVkVSVElDQUwpO1xuXG4gICAgICAgIGlmICh4Q2hhbmdlZCB8fCB5Q2hhbmdlZCkge1xuICAgICAgICAgICAgdGhpcy5maXJlKCdzZXQ6c2Nyb2xsJywgdGhpcy5fc2Nyb2xsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVBeGlzKHNjcm9sbFZhbHVlLCBheGlzLCBvcmllbnRhdGlvbikge1xuICAgICAgICBjb25zdCBoYXNDaGFuZ2VkID0gKHNjcm9sbFZhbHVlICE9PSBudWxsICYmIE1hdGguYWJzKHNjcm9sbFZhbHVlIC0gdGhpcy5fc2Nyb2xsW2F4aXNdKSA+IDFlLTUpO1xuXG4gICAgICAgIC8vIGFsd2F5cyB1cGRhdGUgaWYgZHJhZ2dpbmcgYmVjYXVzZSBkcmFnIGhlbHBlciBkaXJlY3RseSB1cGRhdGVzIHRoZSBlbnRpdHkgcG9zaXRpb25cbiAgICAgICAgLy8gYWx3YXlzIHVwZGF0ZSBpZiBzY3JvbGxWYWx1ZSA9PT0gMCBiZWNhdXNlIGl0IHdpbGwgYmUgY2xhbXBlZCB0byAwXG4gICAgICAgIC8vIGlmIHZpZXdwb3J0IGlzIGxhcmdlciB0aGFuIGNvbnRlbnQgYW5kIHBvc2l0aW9uIGNvdWxkIGJlIG1vdmVkIGJ5IGRyYWcgaGVscGVyIGJ1dFxuICAgICAgICAvLyBoYXNDaGFuZ2VkIHdpbGwgbmV2ZXIgYmUgdHJ1ZVxuICAgICAgICBpZiAoaGFzQ2hhbmdlZCB8fCB0aGlzLl9pc0RyYWdnaW5nKCkgfHwgc2Nyb2xsVmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3Njcm9sbFtheGlzXSA9IHRoaXMuX2RldGVybWluZU5ld1Njcm9sbFZhbHVlKHNjcm9sbFZhbHVlLCBheGlzLCBvcmllbnRhdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9zeW5jQ29udGVudFBvc2l0aW9uKG9yaWVudGF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJQb3NpdGlvbihvcmllbnRhdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaGFzQ2hhbmdlZDtcbiAgICB9XG5cbiAgICBfZGV0ZXJtaW5lTmV3U2Nyb2xsVmFsdWUoc2Nyb2xsVmFsdWUsIGF4aXMsIG9yaWVudGF0aW9uKSB7XG4gICAgICAgIC8vIElmIHNjcm9sbGluZyBpcyBkaXNhYmxlZCBmb3IgdGhlIHNlbGVjdGVkIG9yaWVudGF0aW9uLCBmb3JjZSB0aGVcbiAgICAgICAgLy8gc2Nyb2xsIHBvc2l0aW9uIHRvIHJlbWFpbiBhdCB0aGUgY3VycmVudCB2YWx1ZVxuICAgICAgICBpZiAoIXRoaXMuX2dldFNjcm9sbGluZ0VuYWJsZWQob3JpZW50YXRpb24pKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2Nyb2xsW2F4aXNdO1xuICAgICAgICB9XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLnNjcm9sbE1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgU0NST0xMX01PREVfQ0xBTVA6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hdGguY2xhbXAoc2Nyb2xsVmFsdWUsIDAsIHRoaXMuX2dldE1heFNjcm9sbFZhbHVlKG9yaWVudGF0aW9uKSk7XG5cbiAgICAgICAgICAgIGNhc2UgU0NST0xMX01PREVfQk9VTkNFOlxuICAgICAgICAgICAgICAgIHRoaXMuX3NldFZlbG9jaXR5RnJvbU92ZXJzaG9vdChzY3JvbGxWYWx1ZSwgYXhpcywgb3JpZW50YXRpb24pO1xuICAgICAgICAgICAgICAgIHJldHVybiBzY3JvbGxWYWx1ZTtcblxuICAgICAgICAgICAgY2FzZSBTQ1JPTExfTU9ERV9JTkZJTklURTpcbiAgICAgICAgICAgICAgICByZXR1cm4gc2Nyb2xsVmFsdWU7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdVbmhhbmRsZWQgc2Nyb2xsIG1vZGU6JyArIHRoaXMuc2Nyb2xsTW9kZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNjcm9sbFZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3N5bmNBbGwoKSB7XG4gICAgICAgIHRoaXMuX3N5bmNDb250ZW50UG9zaXRpb24oT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNDb250ZW50UG9zaXRpb24oT1JJRU5UQVRJT05fVkVSVElDQUwpO1xuICAgICAgICB0aGlzLl9zeW5jU2Nyb2xsYmFyUG9zaXRpb24oT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJQb3NpdGlvbihPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJFbmFibGVkU3RhdGUoT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJFbmFibGVkU3RhdGUoT1JJRU5UQVRJT05fVkVSVElDQUwpO1xuICAgIH1cblxuICAgIF9zeW5jQ29udGVudFBvc2l0aW9uKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGF4aXMgPSB0aGlzLl9nZXRBeGlzKG9yaWVudGF0aW9uKTtcbiAgICAgICAgY29uc3Qgc2lnbiA9IHRoaXMuX2dldFNpZ24ob3JpZW50YXRpb24pO1xuICAgICAgICBjb25zdCBjb250ZW50RW50aXR5ID0gdGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHk7XG5cbiAgICAgICAgaWYgKGNvbnRlbnRFbnRpdHkpIHtcbiAgICAgICAgICAgIGNvbnN0IHByZXZDb250ZW50U2l6ZSA9IHRoaXMuX3ByZXZDb250ZW50U2l6ZXNbb3JpZW50YXRpb25dO1xuICAgICAgICAgICAgY29uc3QgY3VyckNvbnRlbnRTaXplID0gdGhpcy5fZ2V0Q29udGVudFNpemUob3JpZW50YXRpb24pO1xuXG4gICAgICAgICAgICAvLyBJZiB0aGUgY29udGVudCBzaXplIGhhcyBjaGFuZ2VkLCBhZGp1c3QgdGhlIHNjcm9sbCB2YWx1ZSBzbyB0aGF0IHRoZSBjb250ZW50IHdpbGxcbiAgICAgICAgICAgIC8vIHN0YXkgaW4gdGhlIHNhbWUgcGxhY2UgZnJvbSB0aGUgdXNlcidzIHBlcnNwZWN0aXZlLlxuICAgICAgICAgICAgaWYgKHByZXZDb250ZW50U2l6ZSAhPT0gbnVsbCAmJiBNYXRoLmFicyhwcmV2Q29udGVudFNpemUgLSBjdXJyQ29udGVudFNpemUpID4gMWUtNCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZXZNYXhPZmZzZXQgPSB0aGlzLl9nZXRNYXhPZmZzZXQob3JpZW50YXRpb24sIHByZXZDb250ZW50U2l6ZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgY3Vyck1heE9mZnNldCA9IHRoaXMuX2dldE1heE9mZnNldChvcmllbnRhdGlvbiwgY3VyckNvbnRlbnRTaXplKTtcbiAgICAgICAgICAgICAgICBpZiAoY3Vyck1heE9mZnNldCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JvbGxbYXhpc10gPSAxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Njcm9sbFtheGlzXSA9IG1hdGguY2xhbXAodGhpcy5fc2Nyb2xsW2F4aXNdICogcHJldk1heE9mZnNldCAvIGN1cnJNYXhPZmZzZXQsIDAsIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdGhpcy5fc2Nyb2xsW2F4aXNdICogdGhpcy5fZ2V0TWF4T2Zmc2V0KG9yaWVudGF0aW9uKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRQb3NpdGlvbiA9IGNvbnRlbnRFbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29udGVudFBvc2l0aW9uW2F4aXNdID0gb2Zmc2V0ICogc2lnbjtcblxuICAgICAgICAgICAgY29udGVudEVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKGNvbnRlbnRQb3NpdGlvbik7XG5cbiAgICAgICAgICAgIHRoaXMuX3ByZXZDb250ZW50U2l6ZXNbb3JpZW50YXRpb25dID0gY3VyckNvbnRlbnRTaXplO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3N5bmNTY3JvbGxiYXJQb3NpdGlvbihvcmllbnRhdGlvbikge1xuICAgICAgICBjb25zdCBheGlzID0gdGhpcy5fZ2V0QXhpcyhvcmllbnRhdGlvbik7XG4gICAgICAgIGNvbnN0IHNjcm9sbGJhckVudGl0eSA9IHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbb3JpZW50YXRpb25dLmVudGl0eTtcblxuICAgICAgICBpZiAoc2Nyb2xsYmFyRW50aXR5ICYmIHNjcm9sbGJhckVudGl0eS5zY3JvbGxiYXIpIHtcbiAgICAgICAgICAgIC8vIFNldHRpbmcgdGhlIHZhbHVlIG9mIHRoZSBzY3JvbGxiYXIgd2lsbCBmaXJlIGEgJ3NldDp2YWx1ZScgZXZlbnQsIHdoaWNoIGluIHR1cm5cbiAgICAgICAgICAgIC8vIHdpbGwgY2FsbCB0aGUgX29uU2V0SG9yaXpvbnRhbFNjcm9sbGJhclZhbHVlL19vblNldFZlcnRpY2FsU2Nyb2xsYmFyVmFsdWUgaGFuZGxlcnNcbiAgICAgICAgICAgIC8vIGFuZCBjYXVzZSBhIGN5Y2xlLiBUbyBhdm9pZCB0aGlzIHdlIGtlZXAgdHJhY2sgb2YgdGhlIGZhY3QgdGhhdCB3ZSdyZSBpbiB0aGUgcHJvY2Vzc1xuICAgICAgICAgICAgLy8gb2YgdXBkYXRpbmcgdGhlIHNjcm9sbGJhciB2YWx1ZS5cbiAgICAgICAgICAgIHRoaXMuX3Njcm9sbGJhclVwZGF0ZUZsYWdzW29yaWVudGF0aW9uXSA9IHRydWU7XG4gICAgICAgICAgICBzY3JvbGxiYXJFbnRpdHkuc2Nyb2xsYmFyLnZhbHVlID0gdGhpcy5fc2Nyb2xsW2F4aXNdO1xuICAgICAgICAgICAgc2Nyb2xsYmFyRW50aXR5LnNjcm9sbGJhci5oYW5kbGVTaXplID0gdGhpcy5fZ2V0U2Nyb2xsYmFySGFuZGxlU2l6ZShheGlzLCBvcmllbnRhdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9zY3JvbGxiYXJVcGRhdGVGbGFnc1tvcmllbnRhdGlvbl0gPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRvZ2dsZXMgdGhlIHNjcm9sbGJhciBlbnRpdGllcyB0aGVtc2VsdmVzIHRvIGJlIGVuYWJsZWQvZGlzYWJsZWQgYmFzZWRcbiAgICAvLyBvbiB3aGV0aGVyIHRoZSB1c2VyIGhhcyBlbmFibGVkIGhvcml6b250YWwvdmVydGljYWwgc2Nyb2xsaW5nIG9uIHRoZVxuICAgIC8vIHNjcm9sbCB2aWV3LlxuICAgIF9zeW5jU2Nyb2xsYmFyRW5hYmxlZFN0YXRlKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbb3JpZW50YXRpb25dLmVudGl0eTtcblxuICAgICAgICBpZiAoZW50aXR5KSB7XG4gICAgICAgICAgICBjb25zdCBpc1Njcm9sbGluZ0VuYWJsZWQgPSB0aGlzLl9nZXRTY3JvbGxpbmdFbmFibGVkKG9yaWVudGF0aW9uKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RlZFZpc2liaWxpdHkgPSB0aGlzLl9nZXRTY3JvbGxiYXJWaXNpYmlsaXR5KG9yaWVudGF0aW9uKTtcblxuICAgICAgICAgICAgc3dpdGNoIChyZXF1ZXN0ZWRWaXNpYmlsaXR5KSB7XG4gICAgICAgICAgICAgICAgY2FzZSBTQ1JPTExCQVJfVklTSUJJTElUWV9TSE9XX0FMV0FZUzpcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LmVuYWJsZWQgPSBpc1Njcm9sbGluZ0VuYWJsZWQ7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIGNhc2UgU0NST0xMQkFSX1ZJU0lCSUxJVFlfU0hPV19XSEVOX1JFUVVJUkVEOlxuICAgICAgICAgICAgICAgICAgICBlbnRpdHkuZW5hYmxlZCA9IGlzU2Nyb2xsaW5nRW5hYmxlZCAmJiB0aGlzLl9jb250ZW50SXNMYXJnZXJUaGFuVmlld3BvcnQob3JpZW50YXRpb24pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1VuaGFuZGxlZCBzY3JvbGxiYXIgdmlzaWJpbGl0eTonICsgcmVxdWVzdGVkVmlzaWJpbGl0eSk7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5lbmFibGVkID0gaXNTY3JvbGxpbmdFbmFibGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NvbnRlbnRJc0xhcmdlclRoYW5WaWV3cG9ydChvcmllbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0Q29udGVudFNpemUob3JpZW50YXRpb24pID4gdGhpcy5fZ2V0Vmlld3BvcnRTaXplKG9yaWVudGF0aW9uKTtcbiAgICB9XG5cbiAgICBfY29udGVudFBvc2l0aW9uVG9TY3JvbGxWYWx1ZShjb250ZW50UG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgbWF4T2Zmc2V0SCA9IHRoaXMuX2dldE1heE9mZnNldChPUklFTlRBVElPTl9IT1JJWk9OVEFMKTtcbiAgICAgICAgY29uc3QgbWF4T2Zmc2V0ViA9IHRoaXMuX2dldE1heE9mZnNldChPUklFTlRBVElPTl9WRVJUSUNBTCk7XG5cbiAgICAgICAgaWYgKG1heE9mZnNldEggPT09IDApIHtcbiAgICAgICAgICAgIF90ZW1wU2Nyb2xsVmFsdWUueCA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfdGVtcFNjcm9sbFZhbHVlLnggPSBjb250ZW50UG9zaXRpb24ueCAvIG1heE9mZnNldEg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF4T2Zmc2V0ViA9PT0gMCkge1xuICAgICAgICAgICAgX3RlbXBTY3JvbGxWYWx1ZS55ID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF90ZW1wU2Nyb2xsVmFsdWUueSA9IGNvbnRlbnRQb3NpdGlvbi55IC8gLW1heE9mZnNldFY7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX3RlbXBTY3JvbGxWYWx1ZTtcbiAgICB9XG5cbiAgICBfZ2V0TWF4T2Zmc2V0KG9yaWVudGF0aW9uLCBjb250ZW50U2l6ZSkge1xuICAgICAgICBjb250ZW50U2l6ZSA9IGNvbnRlbnRTaXplID09PSB1bmRlZmluZWQgPyB0aGlzLl9nZXRDb250ZW50U2l6ZShvcmllbnRhdGlvbikgOiBjb250ZW50U2l6ZTtcblxuICAgICAgICBjb25zdCB2aWV3cG9ydFNpemUgPSB0aGlzLl9nZXRWaWV3cG9ydFNpemUob3JpZW50YXRpb24pO1xuXG4gICAgICAgIGlmIChjb250ZW50U2l6ZSA8IHZpZXdwb3J0U2l6ZSkge1xuICAgICAgICAgICAgcmV0dXJuIC10aGlzLl9nZXRWaWV3cG9ydFNpemUob3JpZW50YXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZpZXdwb3J0U2l6ZSAtIGNvbnRlbnRTaXplO1xuICAgIH1cblxuICAgIF9nZXRNYXhTY3JvbGxWYWx1ZShvcmllbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29udGVudElzTGFyZ2VyVGhhblZpZXdwb3J0KG9yaWVudGF0aW9uKSA/IDEgOiAwO1xuICAgIH1cblxuICAgIF9nZXRTY3JvbGxiYXJIYW5kbGVTaXplKGF4aXMsIG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHZpZXdwb3J0U2l6ZSA9IHRoaXMuX2dldFZpZXdwb3J0U2l6ZShvcmllbnRhdGlvbik7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRTaXplID0gdGhpcy5fZ2V0Q29udGVudFNpemUob3JpZW50YXRpb24pO1xuXG4gICAgICAgIGlmIChNYXRoLmFicyhjb250ZW50U2l6ZSkgPCAwLjAwMSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYW5kbGVTaXplID0gTWF0aC5taW4odmlld3BvcnRTaXplIC8gY29udGVudFNpemUsIDEpO1xuICAgICAgICBjb25zdCBvdmVyc2hvb3QgPSB0aGlzLl90b092ZXJzaG9vdCh0aGlzLl9zY3JvbGxbYXhpc10sIG9yaWVudGF0aW9uKTtcblxuICAgICAgICBpZiAob3ZlcnNob290ID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gaGFuZGxlU2l6ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNjYWxlIHRoZSBoYW5kbGUgZG93biB3aGVuIHRoZSBjb250ZW50IGhhcyBiZWVuIGRyYWdnZWQgcGFzdCB0aGUgYm91bmRzXG4gICAgICAgIHJldHVybiBoYW5kbGVTaXplIC8gKDEgKyBNYXRoLmFicyhvdmVyc2hvb3QpKTtcbiAgICB9XG5cbiAgICBfZ2V0Vmlld3BvcnRTaXplKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTaXplKG9yaWVudGF0aW9uLCB0aGlzLl92aWV3cG9ydFJlZmVyZW5jZSk7XG4gICAgfVxuXG4gICAgX2dldENvbnRlbnRTaXplKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTaXplKG9yaWVudGF0aW9uLCB0aGlzLl9jb250ZW50UmVmZXJlbmNlKTtcbiAgICB9XG5cbiAgICBfZ2V0U2l6ZShvcmllbnRhdGlvbiwgZW50aXR5UmVmZXJlbmNlKSB7XG4gICAgICAgIGlmIChlbnRpdHlSZWZlcmVuY2UuZW50aXR5ICYmIGVudGl0eVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIGVudGl0eVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudFt0aGlzLl9nZXRDYWxjdWxhdGVkRGltZW5zaW9uKG9yaWVudGF0aW9uKV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBfZ2V0U2Nyb2xsaW5nRW5hYmxlZChvcmllbnRhdGlvbikge1xuICAgICAgICBpZiAob3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX0hPUklaT05UQUwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhvcml6b250YWw7XG4gICAgICAgIH0gZWxzZSBpZiAob3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX1ZFUlRJQ0FMKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy52ZXJ0aWNhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnLndhcm4oYFVucmVjb2duaXplZCBvcmllbnRhdGlvbjogJHtvcmllbnRhdGlvbn1gKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBfZ2V0U2Nyb2xsYmFyVmlzaWJpbGl0eShvcmllbnRhdGlvbikge1xuICAgICAgICBpZiAob3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX0hPUklaT05UQUwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhvcml6b250YWxTY3JvbGxiYXJWaXNpYmlsaXR5O1xuICAgICAgICB9IGVsc2UgaWYgKG9yaWVudGF0aW9uID09PSBPUklFTlRBVElPTl9WRVJUSUNBTCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmVydGljYWxTY3JvbGxiYXJWaXNpYmlsaXR5O1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcud2FybihgVW5yZWNvZ25pemVkIG9yaWVudGF0aW9uOiAke29yaWVudGF0aW9ufWApO1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIF9nZXRTaWduKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiBvcmllbnRhdGlvbiA9PT0gT1JJRU5UQVRJT05fSE9SSVpPTlRBTCA/IDEgOiAtMTtcbiAgICB9XG5cbiAgICBfZ2V0QXhpcyhvcmllbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gb3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX0hPUklaT05UQUwgPyAneCcgOiAneSc7XG4gICAgfVxuXG4gICAgX2dldENhbGN1bGF0ZWREaW1lbnNpb24ob3JpZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIG9yaWVudGF0aW9uID09PSBPUklFTlRBVElPTl9IT1JJWk9OVEFMID8gJ2NhbGN1bGF0ZWRXaWR0aCcgOiAnY2FsY3VsYXRlZEhlaWdodCc7XG4gICAgfVxuXG4gICAgX2Rlc3Ryb3lEcmFnSGVscGVyKCkge1xuICAgICAgICBpZiAodGhpcy5fY29udGVudERyYWdIZWxwZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uVXBkYXRlKCkge1xuICAgICAgICBpZiAodGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVZlbG9jaXR5KCk7XG4gICAgICAgICAgICB0aGlzLl9zeW5jU2Nyb2xsYmFyRW5hYmxlZFN0YXRlKE9SSUVOVEFUSU9OX0hPUklaT05UQUwpO1xuICAgICAgICAgICAgdGhpcy5fc3luY1Njcm9sbGJhckVuYWJsZWRTdGF0ZShPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlVmVsb2NpdHkoKSB7XG4gICAgICAgIGlmICghdGhpcy5faXNEcmFnZ2luZygpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zY3JvbGxNb2RlID09PSBTQ1JPTExfTU9ERV9CT1VOQ0UpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faGFzT3ZlcnNob290KCd4JywgT1JJRU5UQVRJT05fSE9SSVpPTlRBTCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0VmVsb2NpdHlGcm9tT3ZlcnNob290KHRoaXMuc2Nyb2xsLngsICd4JywgT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2hhc092ZXJzaG9vdCgneScsIE9SSUVOVEFUSU9OX1ZFUlRJQ0FMKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRWZWxvY2l0eUZyb21PdmVyc2hvb3QodGhpcy5zY3JvbGwueSwgJ3knLCBPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoTWF0aC5hYnModGhpcy5fdmVsb2NpdHkueCkgPiAxZS00IHx8IE1hdGguYWJzKHRoaXMuX3ZlbG9jaXR5LnkpID4gMWUtNCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICAgICAgICAgIHBvc2l0aW9uLnggKz0gdGhpcy5fdmVsb2NpdHkueDtcbiAgICAgICAgICAgICAgICBwb3NpdGlvbi55ICs9IHRoaXMuX3ZlbG9jaXR5Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwb3NpdGlvbik7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRTY3JvbGxGcm9tQ29udGVudFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fdmVsb2NpdHkueCAqPSAoMSAtIHRoaXMuZnJpY3Rpb24pO1xuICAgICAgICAgICAgdGhpcy5fdmVsb2NpdHkueSAqPSAoMSAtIHRoaXMuZnJpY3Rpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhc092ZXJzaG9vdChheGlzLCBvcmllbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gTWF0aC5hYnModGhpcy5fdG9PdmVyc2hvb3QodGhpcy5zY3JvbGxbYXhpc10sIG9yaWVudGF0aW9uKSkgPiAwLjAwMTtcbiAgICB9XG5cbiAgICBfdG9PdmVyc2hvb3Qoc2Nyb2xsVmFsdWUsIG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IG1heFNjcm9sbFZhbHVlID0gdGhpcy5fZ2V0TWF4U2Nyb2xsVmFsdWUob3JpZW50YXRpb24pO1xuXG4gICAgICAgIGlmIChzY3JvbGxWYWx1ZSA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiBzY3JvbGxWYWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzY3JvbGxWYWx1ZSA+IG1heFNjcm9sbFZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gc2Nyb2xsVmFsdWUgLSBtYXhTY3JvbGxWYWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIF9zZXRWZWxvY2l0eUZyb21PdmVyc2hvb3Qoc2Nyb2xsVmFsdWUsIGF4aXMsIG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IG92ZXJzaG9vdFZhbHVlID0gdGhpcy5fdG9PdmVyc2hvb3Qoc2Nyb2xsVmFsdWUsIG9yaWVudGF0aW9uKTtcbiAgICAgICAgY29uc3Qgb3ZlcnNob290UGl4ZWxzID0gb3ZlcnNob290VmFsdWUgKiB0aGlzLl9nZXRNYXhPZmZzZXQob3JpZW50YXRpb24pICogdGhpcy5fZ2V0U2lnbihvcmllbnRhdGlvbik7XG5cbiAgICAgICAgaWYgKE1hdGguYWJzKG92ZXJzaG9vdFBpeGVscykgPiAwKSB7XG4gICAgICAgICAgICAvLyA1MCBoZXJlIGlzIGp1c3QgYSBtYWdpYyBudW1iZXIg4oCTIGl0IHNlZW1zIHRvIGdpdmUgdXMgYSByYW5nZSBvZiB1c2VmdWxcbiAgICAgICAgICAgIC8vIHJhbmdlIG9mIGJvdW5jZUFtb3VudCB2YWx1ZXMsIHNvIHRoYXQgMC4xIGlzIHNpbWlsYXIgdG8gdGhlIGlPUyBib3VuY2VcbiAgICAgICAgICAgIC8vIGZlZWwsIDEuMCBpcyBtdWNoIHNsb3dlciwgZXRjLiBUaGUgKyAxIG1lYW5zIHRoYXQgd2hlbiBib3VuY2VBbW91bnQgaXNcbiAgICAgICAgICAgIC8vIDAsIHRoZSBjb250ZW50IHdpbGwganVzdCBzbmFwIGJhY2sgaW1tZWRpYXRlbHkgaW5zdGVhZCBvZiBtb3ZpbmcgZ3JhZHVhbGx5LlxuICAgICAgICAgICAgdGhpcy5fdmVsb2NpdHlbYXhpc10gPSAtb3ZlcnNob290UGl4ZWxzIC8gKHRoaXMuYm91bmNlQW1vdW50ICogNTAgKyAxKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zZXRWZWxvY2l0eUZyb21Db250ZW50UG9zaXRpb25EZWx0YShwb3NpdGlvbikge1xuICAgICAgICBpZiAodGhpcy5fcHJldkNvbnRlbnREcmFnUG9zaXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3ZlbG9jaXR5LnN1YjIocG9zaXRpb24sIHRoaXMuX3ByZXZDb250ZW50RHJhZ1Bvc2l0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuX3ByZXZDb250ZW50RHJhZ1Bvc2l0aW9uLmNvcHkocG9zaXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdmVsb2NpdHkuc2V0KDAsIDAsIDApO1xuICAgICAgICAgICAgdGhpcy5fcHJldkNvbnRlbnREcmFnUG9zaXRpb24gPSBwb3NpdGlvbi5jbG9uZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldFNjcm9sbEZyb21Db250ZW50UG9zaXRpb24ocG9zaXRpb24pIHtcbiAgICAgICAgbGV0IHNjcm9sbFZhbHVlID0gdGhpcy5fY29udGVudFBvc2l0aW9uVG9TY3JvbGxWYWx1ZShwb3NpdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMuX2lzRHJhZ2dpbmcoKSkge1xuICAgICAgICAgICAgc2Nyb2xsVmFsdWUgPSB0aGlzLl9hcHBseVNjcm9sbFZhbHVlVGVuc2lvbihzY3JvbGxWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9vblNldFNjcm9sbChzY3JvbGxWYWx1ZS54LCBzY3JvbGxWYWx1ZS55LCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG5pY2UgdGVuc2lvbiBlZmZlY3Qgd2hlbiBkcmFnZ2luZyBwYXN0IHRoZSBleHRlbnRzIG9mIHRoZSB2aWV3cG9ydFxuICAgIF9hcHBseVNjcm9sbFZhbHVlVGVuc2lvbihzY3JvbGxWYWx1ZSkge1xuICAgICAgICBjb25zdCBmYWN0b3IgPSAxO1xuXG4gICAgICAgIGxldCBtYXggPSB0aGlzLl9nZXRNYXhTY3JvbGxWYWx1ZShPUklFTlRBVElPTl9IT1JJWk9OVEFMKTtcbiAgICAgICAgbGV0IG92ZXJzaG9vdCA9IHRoaXMuX3RvT3ZlcnNob290KHNjcm9sbFZhbHVlLngsIE9SSUVOVEFUSU9OX0hPUklaT05UQUwpO1xuICAgICAgICBpZiAob3ZlcnNob290ID4gMCkge1xuICAgICAgICAgICAgc2Nyb2xsVmFsdWUueCA9IG1heCArIGZhY3RvciAqIE1hdGgubG9nMTAoMSArIG92ZXJzaG9vdCk7XG4gICAgICAgIH0gZWxzZSBpZiAob3ZlcnNob290IDwgMCkge1xuICAgICAgICAgICAgc2Nyb2xsVmFsdWUueCA9IC1mYWN0b3IgKiBNYXRoLmxvZzEwKDEgLSBvdmVyc2hvb3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4ID0gdGhpcy5fZ2V0TWF4U2Nyb2xsVmFsdWUoT1JJRU5UQVRJT05fVkVSVElDQUwpO1xuICAgICAgICBvdmVyc2hvb3QgPSB0aGlzLl90b092ZXJzaG9vdChzY3JvbGxWYWx1ZS55LCBPUklFTlRBVElPTl9WRVJUSUNBTCk7XG5cbiAgICAgICAgaWYgKG92ZXJzaG9vdCA+IDApIHtcbiAgICAgICAgICAgIHNjcm9sbFZhbHVlLnkgPSBtYXggKyBmYWN0b3IgKiBNYXRoLmxvZzEwKDEgKyBvdmVyc2hvb3QpO1xuICAgICAgICB9IGVsc2UgaWYgKG92ZXJzaG9vdCA8IDApIHtcbiAgICAgICAgICAgIHNjcm9sbFZhbHVlLnkgPSAtZmFjdG9yICogTWF0aC5sb2cxMCgxIC0gb3ZlcnNob290KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzY3JvbGxWYWx1ZTtcbiAgICB9XG5cbiAgICBfaXNEcmFnZ2luZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyICYmIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyLmlzRHJhZ2dpbmc7XG4gICAgfVxuXG4gICAgX3NldFNjcm9sbGJhckNvbXBvbmVudHNFbmFibGVkKGVuYWJsZWQpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fSE9SSVpPTlRBTF0uaGFzQ29tcG9uZW50KCdzY3JvbGxiYXInKSkge1xuICAgICAgICAgICAgdGhpcy5fc2Nyb2xsYmFyUmVmZXJlbmNlc1tPUklFTlRBVElPTl9IT1JJWk9OVEFMXS5lbnRpdHkuc2Nyb2xsYmFyLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdLmhhc0NvbXBvbmVudCgnc2Nyb2xsYmFyJykpIHtcbiAgICAgICAgICAgIHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdLmVudGl0eS5zY3JvbGxiYXIuZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0Q29udGVudERyYWdnaW5nRW5hYmxlZChlbmFibGVkKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb250ZW50RHJhZ0hlbHBlcikge1xuICAgICAgICAgICAgdGhpcy5fY29udGVudERyYWdIZWxwZXIuZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25Nb3VzZVdoZWVsKGV2ZW50KSB7XG4gICAgICAgIGlmICh0aGlzLnVzZU1vdXNlV2hlZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IHdoZWVsRXZlbnQgPSBldmVudC5ldmVudDtcblxuICAgICAgICAgICAgLy8gd2hlZWxFdmVudCdzIGRlbHRhIHZhcmlhYmxlcyBhcmUgc2NyZWVuIHNwYWNlLCBzbyB0aGV5IG5lZWQgdG8gYmUgbm9ybWFsaXplZCBmaXJzdFxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZERlbHRhWCA9ICh3aGVlbEV2ZW50LmRlbHRhWCAvIHRoaXMuX2NvbnRlbnRSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoKSAqIHRoaXMubW91c2VXaGVlbFNlbnNpdGl2aXR5Lng7XG4gICAgICAgICAgICBjb25zdCBub3JtYWxpemVkRGVsdGFZID0gKHdoZWVsRXZlbnQuZGVsdGFZIC8gdGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0KSAqIHRoaXMubW91c2VXaGVlbFNlbnNpdGl2aXR5Lnk7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBzY3JvbGwgcG9zaXRpb25zLCBjbGFtcGluZyB0byBbMCwgbWF4U2Nyb2xsVmFsdWVdIHRvIGFsd2F5cyBwcmV2ZW50IG92ZXItc2hvb3RpbmdcbiAgICAgICAgICAgIGNvbnN0IHNjcm9sbFggPSBtYXRoLmNsYW1wKHRoaXMuX3Njcm9sbC54ICsgbm9ybWFsaXplZERlbHRhWCwgMCwgdGhpcy5fZ2V0TWF4U2Nyb2xsVmFsdWUoT1JJRU5UQVRJT05fSE9SSVpPTlRBTCkpO1xuICAgICAgICAgICAgY29uc3Qgc2Nyb2xsWSA9IG1hdGguY2xhbXAodGhpcy5fc2Nyb2xsLnkgKyBub3JtYWxpemVkRGVsdGFZLCAwLCB0aGlzLl9nZXRNYXhTY3JvbGxWYWx1ZShPUklFTlRBVElPTl9WRVJUSUNBTCkpO1xuXG4gICAgICAgICAgICB0aGlzLnNjcm9sbCA9IG5ldyBWZWMyKHNjcm9sbFgsIHNjcm9sbFkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmUtZW5hYmxlIHVzZUlucHV0IGZsYWcgb24gYW55IGRlc2NlbmRhbnQgdGhhdCB3YXMgZGlzYWJsZWRcbiAgICBfZW5hYmxlQ29udGVudElucHV0KCkge1xuICAgICAgICB3aGlsZSAodGhpcy5fZGlzYWJsZWRDb250ZW50SW5wdXRFbnRpdGllcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IGUgPSB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dEVudGl0aWVzLnBvcCgpO1xuICAgICAgICAgICAgaWYgKGUuZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIGUuZWxlbWVudC51c2VJbnB1dCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIGRpc2FibGUgdXNlSW5wdXQgZmxhZyBvbiBhbGwgZGVzY2VuZGFudHMgb2YgdGhpcyBjb250ZW50RW50aXR5XG4gICAgX2Rpc2FibGVDb250ZW50SW5wdXQoKSB7XG4gICAgICAgIGNvbnN0IF9kaXNhYmxlSW5wdXQgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZWxlbWVudCAmJiBlLmVsZW1lbnQudXNlSW5wdXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dEVudGl0aWVzLnB1c2goZSk7XG4gICAgICAgICAgICAgICAgZS5lbGVtZW50LnVzZUlucHV0ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gZS5jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgX2Rpc2FibGVJbnB1dChjaGlsZHJlbltpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgY29udGVudEVudGl0eSA9IHRoaXMuX2NvbnRlbnRSZWZlcmVuY2UuZW50aXR5O1xuICAgICAgICBpZiAoY29udGVudEVudGl0eSkge1xuICAgICAgICAgICAgLy8gZGlzYWJsZSBpbnB1dCByZWN1cnNpdmVseSBmb3IgYWxsIGNoaWxkcmVuIG9mIHRoZSBjb250ZW50IGVudGl0eVxuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBjb250ZW50RW50aXR5LmNoaWxkcmVuO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBfZGlzYWJsZUlucHV0KGNoaWxkcmVuW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Rpc2FibGVkQ29udGVudElucHV0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fdmlld3BvcnRSZWZlcmVuY2Uub25QYXJlbnRDb21wb25lbnRFbmFibGUoKTtcbiAgICAgICAgdGhpcy5fY29udGVudFJlZmVyZW5jZS5vblBhcmVudENvbXBvbmVudEVuYWJsZSgpO1xuICAgICAgICB0aGlzLl9zY3JvbGxiYXJSZWZlcmVuY2VzW09SSUVOVEFUSU9OX0hPUklaT05UQUxdLm9uUGFyZW50Q29tcG9uZW50RW5hYmxlKCk7XG4gICAgICAgIHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdLm9uUGFyZW50Q29tcG9uZW50RW5hYmxlKCk7XG4gICAgICAgIHRoaXMuX3NldFNjcm9sbGJhckNvbXBvbmVudHNFbmFibGVkKHRydWUpO1xuICAgICAgICB0aGlzLl9zZXRDb250ZW50RHJhZ2dpbmdFbmFibGVkKHRydWUpO1xuXG4gICAgICAgIHRoaXMuX3N5bmNBbGwoKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuX3NldFNjcm9sbGJhckNvbXBvbmVudHNFbmFibGVkKGZhbHNlKTtcbiAgICAgICAgdGhpcy5fc2V0Q29udGVudERyYWdnaW5nRW5hYmxlZChmYWxzZSk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuX3RvZ2dsZUxpZmVjeWNsZUxpc3RlbmVycygnb2ZmJywgdGhpcy5zeXN0ZW0pO1xuICAgICAgICB0aGlzLl90b2dnbGVFbGVtZW50TGlzdGVuZXJzKCdvZmYnKTtcbiAgICAgICAgdGhpcy5fZGVzdHJveURyYWdIZWxwZXIoKTtcbiAgICB9XG5cbiAgICBzZXQgc2Nyb2xsKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX29uU2V0U2Nyb2xsKHZhbHVlLngsIHZhbHVlLnkpO1xuICAgIH1cblxuICAgIGdldCBzY3JvbGwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zY3JvbGw7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTY3JvbGxWaWV3Q29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiX3RlbXBTY3JvbGxWYWx1ZSIsIlZlYzIiLCJTY3JvbGxWaWV3Q29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfdmlld3BvcnRSZWZlcmVuY2UiLCJFbnRpdHlSZWZlcmVuY2UiLCJfb25WaWV3cG9ydEVsZW1lbnRHYWluIiwiX29uU2V0Q29udGVudE9yVmlld3BvcnRTaXplIiwiX2NvbnRlbnRSZWZlcmVuY2UiLCJfb25Db250ZW50RWxlbWVudEdhaW4iLCJfb25Db250ZW50RWxlbWVudExvc2UiLCJfc2Nyb2xsYmFyVXBkYXRlRmxhZ3MiLCJfc2Nyb2xsYmFyUmVmZXJlbmNlcyIsIk9SSUVOVEFUSU9OX0hPUklaT05UQUwiLCJfb25TZXRIb3Jpem9udGFsU2Nyb2xsYmFyVmFsdWUiLCJfb25Ib3Jpem9udGFsU2Nyb2xsYmFyR2FpbiIsIk9SSUVOVEFUSU9OX1ZFUlRJQ0FMIiwiX29uU2V0VmVydGljYWxTY3JvbGxiYXJWYWx1ZSIsIl9vblZlcnRpY2FsU2Nyb2xsYmFyR2FpbiIsIl9wcmV2Q29udGVudFNpemVzIiwiX3Njcm9sbCIsIl92ZWxvY2l0eSIsIlZlYzMiLCJfZHJhZ1N0YXJ0UG9zaXRpb24iLCJfZGlzYWJsZWRDb250ZW50SW5wdXQiLCJfZGlzYWJsZWRDb250ZW50SW5wdXRFbnRpdGllcyIsIl90b2dnbGVMaWZlY3ljbGVMaXN0ZW5lcnMiLCJfdG9nZ2xlRWxlbWVudExpc3RlbmVycyIsIm9uT3JPZmYiLCJfb25TZXRIb3Jpem9udGFsU2Nyb2xsaW5nRW5hYmxlZCIsIl9vblNldFZlcnRpY2FsU2Nyb2xsaW5nRW5hYmxlZCIsImFwcCIsInN5c3RlbXMiLCJlbGVtZW50IiwiX29uRWxlbWVudENvbXBvbmVudEFkZCIsIl9vbkVsZW1lbnRDb21wb25lbnRSZW1vdmUiLCJfaGFzRWxlbWVudExpc3RlbmVycyIsIkVWRU5UX01PVVNFV0hFRUwiLCJfb25Nb3VzZVdoZWVsIiwiX3N5bmNBbGwiLCJfZGVzdHJveURyYWdIZWxwZXIiLCJfY29udGVudERyYWdIZWxwZXIiLCJFbGVtZW50RHJhZ0hlbHBlciIsIm9uIiwiX29uQ29udGVudERyYWdTdGFydCIsIl9vbkNvbnRlbnREcmFnRW5kIiwiX29uQ29udGVudERyYWdNb3ZlIiwiZW5hYmxlZCIsImNvcHkiLCJnZXRMb2NhbFBvc2l0aW9uIiwiX3ByZXZDb250ZW50RHJhZ1Bvc2l0aW9uIiwiX2VuYWJsZUNvbnRlbnRJbnB1dCIsInBvc2l0aW9uIiwiX3dhc0RyYWdnZWQiLCJfc2V0U2Nyb2xsRnJvbUNvbnRlbnRQb3NpdGlvbiIsIl9zZXRWZWxvY2l0eUZyb21Db250ZW50UG9zaXRpb25EZWx0YSIsImR4IiwieCIsImR5IiwieSIsIk1hdGgiLCJhYnMiLCJkcmFnVGhyZXNob2xkIiwiX2Rpc2FibGVDb250ZW50SW5wdXQiLCJzY3JvbGxWYWx1ZVgiLCJfb25TZXRTY3JvbGwiLCJzY3JvbGxWYWx1ZVkiLCJfc3luY1Njcm9sbGJhckVuYWJsZWRTdGF0ZSIsIl9zeW5jU2Nyb2xsYmFyUG9zaXRpb24iLCJyZXNldFZlbG9jaXR5Iiwic2V0IiwieENoYW5nZWQiLCJfdXBkYXRlQXhpcyIsInlDaGFuZ2VkIiwiZmlyZSIsInNjcm9sbFZhbHVlIiwiYXhpcyIsIm9yaWVudGF0aW9uIiwiaGFzQ2hhbmdlZCIsIl9pc0RyYWdnaW5nIiwiX2RldGVybWluZU5ld1Njcm9sbFZhbHVlIiwiX3N5bmNDb250ZW50UG9zaXRpb24iLCJfZ2V0U2Nyb2xsaW5nRW5hYmxlZCIsInNjcm9sbE1vZGUiLCJTQ1JPTExfTU9ERV9DTEFNUCIsIm1hdGgiLCJjbGFtcCIsIl9nZXRNYXhTY3JvbGxWYWx1ZSIsIlNDUk9MTF9NT0RFX0JPVU5DRSIsIl9zZXRWZWxvY2l0eUZyb21PdmVyc2hvb3QiLCJTQ1JPTExfTU9ERV9JTkZJTklURSIsImNvbnNvbGUiLCJ3YXJuIiwiX2dldEF4aXMiLCJzaWduIiwiX2dldFNpZ24iLCJjb250ZW50RW50aXR5IiwicHJldkNvbnRlbnRTaXplIiwiY3VyckNvbnRlbnRTaXplIiwiX2dldENvbnRlbnRTaXplIiwicHJldk1heE9mZnNldCIsIl9nZXRNYXhPZmZzZXQiLCJjdXJyTWF4T2Zmc2V0Iiwib2Zmc2V0IiwiY29udGVudFBvc2l0aW9uIiwic2V0TG9jYWxQb3NpdGlvbiIsInNjcm9sbGJhckVudGl0eSIsInNjcm9sbGJhciIsInZhbHVlIiwiaGFuZGxlU2l6ZSIsIl9nZXRTY3JvbGxiYXJIYW5kbGVTaXplIiwiaXNTY3JvbGxpbmdFbmFibGVkIiwicmVxdWVzdGVkVmlzaWJpbGl0eSIsIl9nZXRTY3JvbGxiYXJWaXNpYmlsaXR5IiwiU0NST0xMQkFSX1ZJU0lCSUxJVFlfU0hPV19BTFdBWVMiLCJTQ1JPTExCQVJfVklTSUJJTElUWV9TSE9XX1dIRU5fUkVRVUlSRUQiLCJfY29udGVudElzTGFyZ2VyVGhhblZpZXdwb3J0IiwiX2dldFZpZXdwb3J0U2l6ZSIsIl9jb250ZW50UG9zaXRpb25Ub1Njcm9sbFZhbHVlIiwibWF4T2Zmc2V0SCIsIm1heE9mZnNldFYiLCJjb250ZW50U2l6ZSIsInVuZGVmaW5lZCIsInZpZXdwb3J0U2l6ZSIsIm1pbiIsIm92ZXJzaG9vdCIsIl90b092ZXJzaG9vdCIsIl9nZXRTaXplIiwiZW50aXR5UmVmZXJlbmNlIiwiX2dldENhbGN1bGF0ZWREaW1lbnNpb24iLCJob3Jpem9udGFsIiwidmVydGljYWwiLCJEZWJ1ZyIsImhvcml6b250YWxTY3JvbGxiYXJWaXNpYmlsaXR5IiwidmVydGljYWxTY3JvbGxiYXJWaXNpYmlsaXR5IiwiZGVzdHJveSIsIm9uVXBkYXRlIiwiX3VwZGF0ZVZlbG9jaXR5IiwiX2hhc092ZXJzaG9vdCIsInNjcm9sbCIsImZyaWN0aW9uIiwibWF4U2Nyb2xsVmFsdWUiLCJvdmVyc2hvb3RWYWx1ZSIsIm92ZXJzaG9vdFBpeGVscyIsImJvdW5jZUFtb3VudCIsInN1YjIiLCJjbG9uZSIsIl9hcHBseVNjcm9sbFZhbHVlVGVuc2lvbiIsImZhY3RvciIsIm1heCIsImxvZzEwIiwiaXNEcmFnZ2luZyIsIl9zZXRTY3JvbGxiYXJDb21wb25lbnRzRW5hYmxlZCIsImhhc0NvbXBvbmVudCIsIl9zZXRDb250ZW50RHJhZ2dpbmdFbmFibGVkIiwiZXZlbnQiLCJ1c2VNb3VzZVdoZWVsIiwid2hlZWxFdmVudCIsIm5vcm1hbGl6ZWREZWx0YVgiLCJkZWx0YVgiLCJjYWxjdWxhdGVkV2lkdGgiLCJtb3VzZVdoZWVsU2Vuc2l0aXZpdHkiLCJub3JtYWxpemVkRGVsdGFZIiwiZGVsdGFZIiwiY2FsY3VsYXRlZEhlaWdodCIsInNjcm9sbFgiLCJzY3JvbGxZIiwibGVuZ3RoIiwiZSIsInBvcCIsInVzZUlucHV0IiwiX2Rpc2FibGVJbnB1dCIsInB1c2giLCJjaGlsZHJlbiIsImkiLCJsIiwib25FbmFibGUiLCJvblBhcmVudENvbXBvbmVudEVuYWJsZSIsIm9uRGlzYWJsZSIsIm9uUmVtb3ZlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBbUJBLE1BQU1BLGdCQUFnQixHQUFHLElBQUlDLElBQUosRUFBekIsQ0FBQTs7QUF5Q0EsTUFBTUMsbUJBQU4sU0FBa0NDLFNBQWxDLENBQTRDO0FBT3hDQyxFQUFBQSxXQUFXLENBQUNDLE1BQUQsRUFBU0MsTUFBVCxFQUFpQjtJQUN4QixLQUFNRCxDQUFBQSxNQUFOLEVBQWNDLE1BQWQsQ0FBQSxDQUFBO0lBRUEsSUFBS0MsQ0FBQUEsa0JBQUwsR0FBMEIsSUFBSUMsZUFBSixDQUFvQixJQUFwQixFQUEwQixnQkFBMUIsRUFBNEM7QUFDbEUsTUFBQSxjQUFBLEVBQWdCLEtBQUtDLHNCQUQ2QztBQUVsRSxNQUFBLGdCQUFBLEVBQWtCLElBQUtDLENBQUFBLDJCQUFBQTtBQUYyQyxLQUE1QyxDQUExQixDQUFBO0lBS0EsSUFBS0MsQ0FBQUEsaUJBQUwsR0FBeUIsSUFBSUgsZUFBSixDQUFvQixJQUFwQixFQUEwQixlQUExQixFQUEyQztBQUNoRSxNQUFBLGNBQUEsRUFBZ0IsS0FBS0kscUJBRDJDO0FBRWhFLE1BQUEsY0FBQSxFQUFnQixLQUFLQyxxQkFGMkM7QUFH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
