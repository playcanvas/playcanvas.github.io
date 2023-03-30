/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { Debug } from '../../../core/debug.js';
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

/**
 * A ScrollViewComponent enables a group of entities to behave like a masked scrolling area, with
 * optional horizontal and vertical scroll bars.
 *
 * @property {boolean} horizontal Whether to enable horizontal scrolling.
 * @property {boolean} vertical Whether to enable vertical scrolling.
 * @property {number} scrollMode Specifies how the scroll view should behave when the user scrolls
 * past the end of the content. Modes are defined as follows:
 *
 * - {@link SCROLL_MODE_CLAMP}: Content does not scroll any further than its bounds.
 * - {@link SCROLL_MODE_BOUNCE}: Content scrolls past its bounds and then gently bounces back.
 * - {@link SCROLL_MODE_INFINITE}: Content can scroll forever.
 *
 * @property {number} bounceAmount Controls how far the content should move before bouncing back.
 * @property {number} friction Controls how freely the content should move if thrown, i.e. By
 * flicking on a phone or by flinging the scroll wheel on a mouse. A value of 1 means that content
 * will stop immediately; 0 means that content will continue moving forever (or until the bounds of
 * the content are reached, depending on the scrollMode).
 * @property {boolean} useMouseWheel Whether to use mouse wheel for scrolling (horizontally and
 * vertically).
 * @property {Vec2} mouseWheelSensitivity Mouse wheel horizontal and vertical sensitivity. Only
 * used if useMouseWheel is set. Setting a direction to 0 will disable mouse wheel scrolling in
 * that direction. 1 is a default sensitivity that is considered to feel good. The values can be
 * set higher or lower than 1 to tune the sensitivity. Defaults to [1, 1].
 * @property {number} horizontalScrollbarVisibility Controls whether the horizontal scrollbar
 * should be visible all the time, or only visible when the content exceeds the size of the
 * viewport.
 * @property {number} verticalScrollbarVisibility Controls whether the vertical scrollbar should be
 * visible all the time, or only visible when the content exceeds the size of the viewport.
 * @property {import('../../entity.js').Entity} viewportEntity The entity to be used as the masked
 * viewport area, within which the content will scroll. This entity must have an ElementGroup
 * component.
 * @property {import('../../entity.js').Entity} contentEntity The entity which contains the
 * scrolling content itself. This entity must have an Element component.
 * @property {import('../../entity.js').Entity} horizontalScrollbarEntity The entity to be used as
 * the vertical scrollbar. This entity must have a Scrollbar component.
 * @property {import('../../entity.js').Entity} verticalScrollbarEntity The entity to be used as
 * the vertical scrollbar. This entity must have a Scrollbar component.
 * @augments Component
 */
class ScrollViewComponent extends Component {
  /**
   * Create a new ScrollViewComponent.
   *
   * @param {import('./system.js').ScrollViewComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
   * attached to.
   */
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

  /**
   * Fired whenever the scroll position changes.
   *
   * @event ScrollViewComponent#set:scroll
   * @param {Vec2} scrollPosition - Horizontal and vertical scroll values in the range 0...1.
   */

  /**
   * @param {string} onOrOff - 'on' or 'off'.
   * @param {import('./system.js').ScrollViewComponentSystem} system - The ComponentSystem that
   * created this Component.
   * @private
   */
  _toggleLifecycleListeners(onOrOff, system) {
    this[onOrOff]('set_horizontal', this._onSetHorizontalScrollingEnabled, this);
    this[onOrOff]('set_vertical', this._onSetVerticalScrollingEnabled, this);
    system.app.systems.element[onOrOff]('add', this._onElementComponentAdd, this);
    system.app.systems.element[onOrOff]('beforeremove', this._onElementComponentRemove, this);
  }

  /**
   * @param {string} onOrOff - 'on' or 'off'.
   * @private
   */
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

      // if we haven't already, when scrolling starts
      // disable input on all child elements
      if (!this._disabledContentInput) {
        // Disable input events on content after we've moved past a threshold value
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

    // always update if dragging because drag helper directly updates the entity position
    // always update if scrollValue === 0 because it will be clamped to 0
    // if viewport is larger than content and position could be moved by drag helper but
    // hasChanged will never be true
    if (hasChanged || this._isDragging() || scrollValue === 0) {
      this._scroll[axis] = this._determineNewScrollValue(scrollValue, axis, orientation);
      this._syncContentPosition(orientation);
      this._syncScrollbarPosition(orientation);
    }
    return hasChanged;
  }
  _determineNewScrollValue(scrollValue, axis, orientation) {
    // If scrolling is disabled for the selected orientation, force the
    // scroll position to remain at the current value
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

      // If the content size has changed, adjust the scroll value so that the content will
      // stay in the same place from the user's perspective.
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
      // Setting the value of the scrollbar will fire a 'set:value' event, which in turn
      // will call the _onSetHorizontalScrollbarValue/_onSetVerticalScrollbarValue handlers
      // and cause a cycle. To avoid this we keep track of the fact that we're in the process
      // of updating the scrollbar value.
      this._scrollbarUpdateFlags[orientation] = true;
      scrollbarEntity.scrollbar.value = this._scroll[axis];
      scrollbarEntity.scrollbar.handleSize = this._getScrollbarHandleSize(axis, orientation);
      this._scrollbarUpdateFlags[orientation] = false;
    }
  }

  // Toggles the scrollbar entities themselves to be enabled/disabled based
  // on whether the user has enabled horizontal/vertical scrolling on the
  // scroll view.
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

    // Scale the handle down when the content has been dragged past the bounds
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
      // 50 here is just a magic number – it seems to give us a range of useful
      // range of bounceAmount values, so that 0.1 is similar to the iOS bounce
      // feel, 1.0 is much slower, etc. The + 1 means that when bounceAmount is
      // 0, the content will just snap back immediately instead of moving gradually.
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

  // Create nice tension effect when dragging past the extents of the viewport
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

      // wheelEvent's delta variables are screen space, so they need to be normalized first
      const normalizedDeltaX = wheelEvent.deltaX / this._contentReference.entity.element.calculatedWidth * this.mouseWheelSensitivity.x;
      const normalizedDeltaY = wheelEvent.deltaY / this._contentReference.entity.element.calculatedHeight * this.mouseWheelSensitivity.y;

      // update scroll positions, clamping to [0, maxScrollValue] to always prevent over-shooting
      const scrollX = math.clamp(this._scroll.x + normalizedDeltaX, 0, this._getMaxScrollValue(ORIENTATION_HORIZONTAL));
      const scrollY = math.clamp(this._scroll.y + normalizedDeltaY, 0, this._getMaxScrollValue(ORIENTATION_VERTICAL));
      this.scroll = new Vec2(scrollX, scrollY);
    }
  }

  // re-enable useInput flag on any descendant that was disabled
  _enableContentInput() {
    while (this._disabledContentInputEntities.length) {
      const e = this._disabledContentInputEntities.pop();
      if (e.element) {
        e.element.useInput = true;
      }
    }
    this._disabledContentInput = false;
  }

  // disable useInput flag on all descendants of this contentEntity
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
      // disable input recursively for all children of the content entity
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvc2Nyb2xsLXZpZXcvY29tcG9uZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERlYnVnIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9kZWJ1Zy5qcyc7XG5cbmltcG9ydCB7IG1hdGggfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvbWF0aC5qcyc7XG5pbXBvcnQgeyBWZWMyIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzIuanMnO1xuaW1wb3J0IHsgVmVjMyB9IGZyb20gJy4uLy4uLy4uL2NvcmUvbWF0aC92ZWMzLmpzJztcblxuaW1wb3J0IHsgT1JJRU5UQVRJT05fSE9SSVpPTlRBTCwgT1JJRU5UQVRJT05fVkVSVElDQUwgfSBmcm9tICcuLi8uLi8uLi9zY2VuZS9jb25zdGFudHMuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHlSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi91dGlscy9lbnRpdHktcmVmZXJlbmNlLmpzJztcblxuaW1wb3J0IHsgRWxlbWVudERyYWdIZWxwZXIgfSBmcm9tICcuLi9lbGVtZW50L2VsZW1lbnQtZHJhZy1oZWxwZXIuanMnO1xuXG5pbXBvcnQgeyBTQ1JPTExfTU9ERV9CT1VOQ0UsIFNDUk9MTF9NT0RFX0NMQU1QLCBTQ1JPTExfTU9ERV9JTkZJTklURSwgU0NST0xMQkFSX1ZJU0lCSUxJVFlfU0hPV19BTFdBWVMsIFNDUk9MTEJBUl9WSVNJQklMSVRZX1NIT1dfV0hFTl9SRVFVSVJFRCB9IGZyb20gJy4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudC5qcyc7XG5pbXBvcnQgeyBFVkVOVF9NT1VTRVdIRUVMIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5wdXQvY29uc3RhbnRzLmpzJztcblxuY29uc3QgX3RlbXBTY3JvbGxWYWx1ZSA9IG5ldyBWZWMyKCk7XG5cbi8qKlxuICogQSBTY3JvbGxWaWV3Q29tcG9uZW50IGVuYWJsZXMgYSBncm91cCBvZiBlbnRpdGllcyB0byBiZWhhdmUgbGlrZSBhIG1hc2tlZCBzY3JvbGxpbmcgYXJlYSwgd2l0aFxuICogb3B0aW9uYWwgaG9yaXpvbnRhbCBhbmQgdmVydGljYWwgc2Nyb2xsIGJhcnMuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBob3Jpem9udGFsIFdoZXRoZXIgdG8gZW5hYmxlIGhvcml6b250YWwgc2Nyb2xsaW5nLlxuICogQHByb3BlcnR5IHtib29sZWFufSB2ZXJ0aWNhbCBXaGV0aGVyIHRvIGVuYWJsZSB2ZXJ0aWNhbCBzY3JvbGxpbmcuXG4gKiBAcHJvcGVydHkge251bWJlcn0gc2Nyb2xsTW9kZSBTcGVjaWZpZXMgaG93IHRoZSBzY3JvbGwgdmlldyBzaG91bGQgYmVoYXZlIHdoZW4gdGhlIHVzZXIgc2Nyb2xsc1xuICogcGFzdCB0aGUgZW5kIG9mIHRoZSBjb250ZW50LiBNb2RlcyBhcmUgZGVmaW5lZCBhcyBmb2xsb3dzOlxuICpcbiAqIC0ge0BsaW5rIFNDUk9MTF9NT0RFX0NMQU1QfTogQ29udGVudCBkb2VzIG5vdCBzY3JvbGwgYW55IGZ1cnRoZXIgdGhhbiBpdHMgYm91bmRzLlxuICogLSB7QGxpbmsgU0NST0xMX01PREVfQk9VTkNFfTogQ29udGVudCBzY3JvbGxzIHBhc3QgaXRzIGJvdW5kcyBhbmQgdGhlbiBnZW50bHkgYm91bmNlcyBiYWNrLlxuICogLSB7QGxpbmsgU0NST0xMX01PREVfSU5GSU5JVEV9OiBDb250ZW50IGNhbiBzY3JvbGwgZm9yZXZlci5cbiAqXG4gKiBAcHJvcGVydHkge251bWJlcn0gYm91bmNlQW1vdW50IENvbnRyb2xzIGhvdyBmYXIgdGhlIGNvbnRlbnQgc2hvdWxkIG1vdmUgYmVmb3JlIGJvdW5jaW5nIGJhY2suXG4gKiBAcHJvcGVydHkge251bWJlcn0gZnJpY3Rpb24gQ29udHJvbHMgaG93IGZyZWVseSB0aGUgY29udGVudCBzaG91bGQgbW92ZSBpZiB0aHJvd24sIGkuZS4gQnlcbiAqIGZsaWNraW5nIG9uIGEgcGhvbmUgb3IgYnkgZmxpbmdpbmcgdGhlIHNjcm9sbCB3aGVlbCBvbiBhIG1vdXNlLiBBIHZhbHVlIG9mIDEgbWVhbnMgdGhhdCBjb250ZW50XG4gKiB3aWxsIHN0b3AgaW1tZWRpYXRlbHk7IDAgbWVhbnMgdGhhdCBjb250ZW50IHdpbGwgY29udGludWUgbW92aW5nIGZvcmV2ZXIgKG9yIHVudGlsIHRoZSBib3VuZHMgb2ZcbiAqIHRoZSBjb250ZW50IGFyZSByZWFjaGVkLCBkZXBlbmRpbmcgb24gdGhlIHNjcm9sbE1vZGUpLlxuICogQHByb3BlcnR5IHtib29sZWFufSB1c2VNb3VzZVdoZWVsIFdoZXRoZXIgdG8gdXNlIG1vdXNlIHdoZWVsIGZvciBzY3JvbGxpbmcgKGhvcml6b250YWxseSBhbmRcbiAqIHZlcnRpY2FsbHkpLlxuICogQHByb3BlcnR5IHtWZWMyfSBtb3VzZVdoZWVsU2Vuc2l0aXZpdHkgTW91c2Ugd2hlZWwgaG9yaXpvbnRhbCBhbmQgdmVydGljYWwgc2Vuc2l0aXZpdHkuIE9ubHlcbiAqIHVzZWQgaWYgdXNlTW91c2VXaGVlbCBpcyBzZXQuIFNldHRpbmcgYSBkaXJlY3Rpb24gdG8gMCB3aWxsIGRpc2FibGUgbW91c2Ugd2hlZWwgc2Nyb2xsaW5nIGluXG4gKiB0aGF0IGRpcmVjdGlvbi4gMSBpcyBhIGRlZmF1bHQgc2Vuc2l0aXZpdHkgdGhhdCBpcyBjb25zaWRlcmVkIHRvIGZlZWwgZ29vZC4gVGhlIHZhbHVlcyBjYW4gYmVcbiAqIHNldCBoaWdoZXIgb3IgbG93ZXIgdGhhbiAxIHRvIHR1bmUgdGhlIHNlbnNpdGl2aXR5LiBEZWZhdWx0cyB0byBbMSwgMV0uXG4gKiBAcHJvcGVydHkge251bWJlcn0gaG9yaXpvbnRhbFNjcm9sbGJhclZpc2liaWxpdHkgQ29udHJvbHMgd2hldGhlciB0aGUgaG9yaXpvbnRhbCBzY3JvbGxiYXJcbiAqIHNob3VsZCBiZSB2aXNpYmxlIGFsbCB0aGUgdGltZSwgb3Igb25seSB2aXNpYmxlIHdoZW4gdGhlIGNvbnRlbnQgZXhjZWVkcyB0aGUgc2l6ZSBvZiB0aGVcbiAqIHZpZXdwb3J0LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHZlcnRpY2FsU2Nyb2xsYmFyVmlzaWJpbGl0eSBDb250cm9scyB3aGV0aGVyIHRoZSB2ZXJ0aWNhbCBzY3JvbGxiYXIgc2hvdWxkIGJlXG4gKiB2aXNpYmxlIGFsbCB0aGUgdGltZSwgb3Igb25seSB2aXNpYmxlIHdoZW4gdGhlIGNvbnRlbnQgZXhjZWVkcyB0aGUgc2l6ZSBvZiB0aGUgdmlld3BvcnQuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSB2aWV3cG9ydEVudGl0eSBUaGUgZW50aXR5IHRvIGJlIHVzZWQgYXMgdGhlIG1hc2tlZFxuICogdmlld3BvcnQgYXJlYSwgd2l0aGluIHdoaWNoIHRoZSBjb250ZW50IHdpbGwgc2Nyb2xsLiBUaGlzIGVudGl0eSBtdXN0IGhhdmUgYW4gRWxlbWVudEdyb3VwXG4gKiBjb21wb25lbnQuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBjb250ZW50RW50aXR5IFRoZSBlbnRpdHkgd2hpY2ggY29udGFpbnMgdGhlXG4gKiBzY3JvbGxpbmcgY29udGVudCBpdHNlbGYuIFRoaXMgZW50aXR5IG11c3QgaGF2ZSBhbiBFbGVtZW50IGNvbXBvbmVudC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGhvcml6b250YWxTY3JvbGxiYXJFbnRpdHkgVGhlIGVudGl0eSB0byBiZSB1c2VkIGFzXG4gKiB0aGUgdmVydGljYWwgc2Nyb2xsYmFyLiBUaGlzIGVudGl0eSBtdXN0IGhhdmUgYSBTY3JvbGxiYXIgY29tcG9uZW50LlxuICogQHByb3BlcnR5IHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gdmVydGljYWxTY3JvbGxiYXJFbnRpdHkgVGhlIGVudGl0eSB0byBiZSB1c2VkIGFzXG4gKiB0aGUgdmVydGljYWwgc2Nyb2xsYmFyLiBUaGlzIGVudGl0eSBtdXN0IGhhdmUgYSBTY3JvbGxiYXIgY29tcG9uZW50LlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBTY3JvbGxWaWV3Q29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgU2Nyb2xsVmlld0NvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLlNjcm9sbFZpZXdDb21wb25lbnRTeXN0ZW19IHN5c3RlbSAtIFRoZSBDb21wb25lbnRTeXN0ZW0gdGhhdFxuICAgICAqIGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uLy4uL2VudGl0eS5qcycpLkVudGl0eX0gZW50aXR5IC0gVGhlIEVudGl0eSB0aGF0IHRoaXMgQ29tcG9uZW50IGlzXG4gICAgICogYXR0YWNoZWQgdG8uXG4gICAgICovXG4gICAgY29uc3RydWN0b3Ioc3lzdGVtLCBlbnRpdHkpIHtcbiAgICAgICAgc3VwZXIoc3lzdGVtLCBlbnRpdHkpO1xuXG4gICAgICAgIHRoaXMuX3ZpZXdwb3J0UmVmZXJlbmNlID0gbmV3IEVudGl0eVJlZmVyZW5jZSh0aGlzLCAndmlld3BvcnRFbnRpdHknLCB7XG4gICAgICAgICAgICAnZWxlbWVudCNnYWluJzogdGhpcy5fb25WaWV3cG9ydEVsZW1lbnRHYWluLFxuICAgICAgICAgICAgJ2VsZW1lbnQjcmVzaXplJzogdGhpcy5fb25TZXRDb250ZW50T3JWaWV3cG9ydFNpemVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5fY29udGVudFJlZmVyZW5jZSA9IG5ldyBFbnRpdHlSZWZlcmVuY2UodGhpcywgJ2NvbnRlbnRFbnRpdHknLCB7XG4gICAgICAgICAgICAnZWxlbWVudCNnYWluJzogdGhpcy5fb25Db250ZW50RWxlbWVudEdhaW4sXG4gICAgICAgICAgICAnZWxlbWVudCNsb3NlJzogdGhpcy5fb25Db250ZW50RWxlbWVudExvc2UsXG4gICAgICAgICAgICAnZWxlbWVudCNyZXNpemUnOiB0aGlzLl9vblNldENvbnRlbnRPclZpZXdwb3J0U2l6ZVxuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLl9zY3JvbGxiYXJVcGRhdGVGbGFncyA9IHt9O1xuICAgICAgICB0aGlzLl9zY3JvbGxiYXJSZWZlcmVuY2VzID0ge307XG4gICAgICAgIHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fSE9SSVpPTlRBTF0gPSBuZXcgRW50aXR5UmVmZXJlbmNlKHRoaXMsICdob3Jpem9udGFsU2Nyb2xsYmFyRW50aXR5Jywge1xuICAgICAgICAgICAgJ3Njcm9sbGJhciNzZXQ6dmFsdWUnOiB0aGlzLl9vblNldEhvcml6b250YWxTY3JvbGxiYXJWYWx1ZSxcbiAgICAgICAgICAgICdzY3JvbGxiYXIjZ2Fpbic6IHRoaXMuX29uSG9yaXpvbnRhbFNjcm9sbGJhckdhaW5cbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdID0gbmV3IEVudGl0eVJlZmVyZW5jZSh0aGlzLCAndmVydGljYWxTY3JvbGxiYXJFbnRpdHknLCB7XG4gICAgICAgICAgICAnc2Nyb2xsYmFyI3NldDp2YWx1ZSc6IHRoaXMuX29uU2V0VmVydGljYWxTY3JvbGxiYXJWYWx1ZSxcbiAgICAgICAgICAgICdzY3JvbGxiYXIjZ2Fpbic6IHRoaXMuX29uVmVydGljYWxTY3JvbGxiYXJHYWluXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX3ByZXZDb250ZW50U2l6ZXMgPSB7fTtcbiAgICAgICAgdGhpcy5fcHJldkNvbnRlbnRTaXplc1tPUklFTlRBVElPTl9IT1JJWk9OVEFMXSA9IG51bGw7XG4gICAgICAgIHRoaXMuX3ByZXZDb250ZW50U2l6ZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdID0gbnVsbDtcblxuICAgICAgICB0aGlzLl9zY3JvbGwgPSBuZXcgVmVjMigpO1xuICAgICAgICB0aGlzLl92ZWxvY2l0eSA9IG5ldyBWZWMzKCk7XG5cbiAgICAgICAgdGhpcy5fZHJhZ1N0YXJ0UG9zaXRpb24gPSBuZXcgVmVjMygpO1xuICAgICAgICB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dEVudGl0aWVzID0gW107XG5cbiAgICAgICAgdGhpcy5fdG9nZ2xlTGlmZWN5Y2xlTGlzdGVuZXJzKCdvbicsIHN5c3RlbSk7XG4gICAgICAgIHRoaXMuX3RvZ2dsZUVsZW1lbnRMaXN0ZW5lcnMoJ29uJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbmV2ZXIgdGhlIHNjcm9sbCBwb3NpdGlvbiBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFNjcm9sbFZpZXdDb21wb25lbnQjc2V0OnNjcm9sbFxuICAgICAqIEBwYXJhbSB7VmVjMn0gc2Nyb2xsUG9zaXRpb24gLSBIb3Jpem9udGFsIGFuZCB2ZXJ0aWNhbCBzY3JvbGwgdmFsdWVzIGluIHRoZSByYW5nZSAwLi4uMS5cbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBvbk9yT2ZmIC0gJ29uJyBvciAnb2ZmJy5cbiAgICAgKiBAcGFyYW0ge2ltcG9ydCgnLi9zeXN0ZW0uanMnKS5TY3JvbGxWaWV3Q29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgQ29tcG9uZW50LlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3RvZ2dsZUxpZmVjeWNsZUxpc3RlbmVycyhvbk9yT2ZmLCBzeXN0ZW0pIHtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X2hvcml6b250YWwnLCB0aGlzLl9vblNldEhvcml6b250YWxTY3JvbGxpbmdFbmFibGVkLCB0aGlzKTtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X3ZlcnRpY2FsJywgdGhpcy5fb25TZXRWZXJ0aWNhbFNjcm9sbGluZ0VuYWJsZWQsIHRoaXMpO1xuXG4gICAgICAgIHN5c3RlbS5hcHAuc3lzdGVtcy5lbGVtZW50W29uT3JPZmZdKCdhZGQnLCB0aGlzLl9vbkVsZW1lbnRDb21wb25lbnRBZGQsIHRoaXMpO1xuICAgICAgICBzeXN0ZW0uYXBwLnN5c3RlbXMuZWxlbWVudFtvbk9yT2ZmXSgnYmVmb3JlcmVtb3ZlJywgdGhpcy5fb25FbGVtZW50Q29tcG9uZW50UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gb25Pck9mZiAtICdvbicgb3IgJ29mZicuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfdG9nZ2xlRWxlbWVudExpc3RlbmVycyhvbk9yT2ZmKSB7XG4gICAgICAgIGlmICh0aGlzLmVudGl0eS5lbGVtZW50KSB7XG4gICAgICAgICAgICBpZiAob25Pck9mZiA9PT0gJ29uJyAmJiB0aGlzLl9oYXNFbGVtZW50TGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCdyZXNpemUnLCB0aGlzLl9vblNldENvbnRlbnRPclZpZXdwb3J0U2l6ZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKEVWRU5UX01PVVNFV0hFRUwsIHRoaXMuX29uTW91c2VXaGVlbCwgdGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMuX2hhc0VsZW1lbnRMaXN0ZW5lcnMgPSAob25Pck9mZiA9PT0gJ29uJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25FbGVtZW50Q29tcG9uZW50QWRkKGVudGl0eSkge1xuICAgICAgICBpZiAodGhpcy5lbnRpdHkgPT09IGVudGl0eSkge1xuICAgICAgICAgICAgdGhpcy5fdG9nZ2xlRWxlbWVudExpc3RlbmVycygnb24nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkVsZW1lbnRDb21wb25lbnRSZW1vdmUoZW50aXR5KSB7XG4gICAgICAgIGlmICh0aGlzLmVudGl0eSA9PT0gZW50aXR5KSB7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVFbGVtZW50TGlzdGVuZXJzKCdvZmYnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblZpZXdwb3J0RWxlbWVudEdhaW4oKSB7XG4gICAgICAgIHRoaXMuX3N5bmNBbGwoKTtcbiAgICB9XG5cbiAgICBfb25Db250ZW50RWxlbWVudEdhaW4oKSB7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3lEcmFnSGVscGVyKCk7XG4gICAgICAgIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyID0gbmV3IEVsZW1lbnREcmFnSGVscGVyKHRoaXMuX2NvbnRlbnRSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQpO1xuICAgICAgICB0aGlzLl9jb250ZW50RHJhZ0hlbHBlci5vbignZHJhZzpzdGFydCcsIHRoaXMuX29uQ29udGVudERyYWdTdGFydCwgdGhpcyk7XG4gICAgICAgIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyLm9uKCdkcmFnOmVuZCcsIHRoaXMuX29uQ29udGVudERyYWdFbmQsIHRoaXMpO1xuICAgICAgICB0aGlzLl9jb250ZW50RHJhZ0hlbHBlci5vbignZHJhZzptb3ZlJywgdGhpcy5fb25Db250ZW50RHJhZ01vdmUsIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuX3ByZXZDb250ZW50U2l6ZXNbT1JJRU5UQVRJT05fSE9SSVpPTlRBTF0gPSBudWxsO1xuICAgICAgICB0aGlzLl9wcmV2Q29udGVudFNpemVzW09SSUVOVEFUSU9OX1ZFUlRJQ0FMXSA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5fc3luY0FsbCgpO1xuICAgIH1cblxuICAgIF9vbkNvbnRlbnRFbGVtZW50TG9zZSgpIHtcbiAgICAgICAgdGhpcy5fZGVzdHJveURyYWdIZWxwZXIoKTtcbiAgICB9XG5cbiAgICBfb25Db250ZW50RHJhZ1N0YXJ0KCkge1xuICAgICAgICBpZiAodGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX2RyYWdTdGFydFBvc2l0aW9uLmNvcHkodGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkNvbnRlbnREcmFnRW5kKCkge1xuICAgICAgICB0aGlzLl9wcmV2Q29udGVudERyYWdQb3NpdGlvbiA9IG51bGw7XG4gICAgICAgIHRoaXMuX2VuYWJsZUNvbnRlbnRJbnB1dCgpO1xuICAgIH1cblxuICAgIF9vbkNvbnRlbnREcmFnTW92ZShwb3NpdGlvbikge1xuICAgICAgICBpZiAodGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkgJiYgdGhpcy5lbmFibGVkICYmIHRoaXMuZW50aXR5LmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3dhc0RyYWdnZWQgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fc2V0U2Nyb2xsRnJvbUNvbnRlbnRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9zZXRWZWxvY2l0eUZyb21Db250ZW50UG9zaXRpb25EZWx0YShwb3NpdGlvbik7XG5cbiAgICAgICAgICAgIC8vIGlmIHdlIGhhdmVuJ3QgYWxyZWFkeSwgd2hlbiBzY3JvbGxpbmcgc3RhcnRzXG4gICAgICAgICAgICAvLyBkaXNhYmxlIGlucHV0IG9uIGFsbCBjaGlsZCBlbGVtZW50c1xuICAgICAgICAgICAgaWYgKCF0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dCkge1xuXG4gICAgICAgICAgICAgICAgLy8gRGlzYWJsZSBpbnB1dCBldmVudHMgb24gY29udGVudCBhZnRlciB3ZSd2ZSBtb3ZlZCBwYXN0IGEgdGhyZXNob2xkIHZhbHVlXG4gICAgICAgICAgICAgICAgY29uc3QgZHggPSAocG9zaXRpb24ueCAtIHRoaXMuX2RyYWdTdGFydFBvc2l0aW9uLngpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGR5ID0gKHBvc2l0aW9uLnkgLSB0aGlzLl9kcmFnU3RhcnRQb3NpdGlvbi55KTtcblxuICAgICAgICAgICAgICAgIGlmIChNYXRoLmFicyhkeCkgPiB0aGlzLmRyYWdUaHJlc2hvbGQgfHxcbiAgICAgICAgICAgICAgICAgICAgTWF0aC5hYnMoZHkpID4gdGhpcy5kcmFnVGhyZXNob2xkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2Rpc2FibGVDb250ZW50SW5wdXQoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNldENvbnRlbnRPclZpZXdwb3J0U2l6ZSgpIHtcbiAgICAgICAgdGhpcy5fc3luY0FsbCgpO1xuICAgIH1cblxuICAgIF9vblNldEhvcml6b250YWxTY3JvbGxiYXJWYWx1ZShzY3JvbGxWYWx1ZVgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9zY3JvbGxiYXJVcGRhdGVGbGFnc1tPUklFTlRBVElPTl9IT1JJWk9OVEFMXSAmJiB0aGlzLmVuYWJsZWQgJiYgdGhpcy5lbnRpdHkuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fb25TZXRTY3JvbGwoc2Nyb2xsVmFsdWVYLCBudWxsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNldFZlcnRpY2FsU2Nyb2xsYmFyVmFsdWUoc2Nyb2xsVmFsdWVZKSB7XG4gICAgICAgIGlmICghdGhpcy5fc2Nyb2xsYmFyVXBkYXRlRmxhZ3NbT1JJRU5UQVRJT05fVkVSVElDQUxdICYmIHRoaXMuZW5hYmxlZCAmJiB0aGlzLmVudGl0eS5lbmFibGVkKSB7XG4gICAgICAgICAgICB0aGlzLl9vblNldFNjcm9sbChudWxsLCBzY3JvbGxWYWx1ZVkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2V0SG9yaXpvbnRhbFNjcm9sbGluZ0VuYWJsZWQoKSB7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJFbmFibGVkU3RhdGUoT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgfVxuXG4gICAgX29uU2V0VmVydGljYWxTY3JvbGxpbmdFbmFibGVkKCkge1xuICAgICAgICB0aGlzLl9zeW5jU2Nyb2xsYmFyRW5hYmxlZFN0YXRlKE9SSUVOVEFUSU9OX1ZFUlRJQ0FMKTtcbiAgICB9XG5cbiAgICBfb25Ib3Jpem9udGFsU2Nyb2xsYmFyR2FpbigpIHtcbiAgICAgICAgdGhpcy5fc3luY1Njcm9sbGJhckVuYWJsZWRTdGF0ZShPUklFTlRBVElPTl9IT1JJWk9OVEFMKTtcbiAgICAgICAgdGhpcy5fc3luY1Njcm9sbGJhclBvc2l0aW9uKE9SSUVOVEFUSU9OX0hPUklaT05UQUwpO1xuICAgIH1cblxuICAgIF9vblZlcnRpY2FsU2Nyb2xsYmFyR2FpbigpIHtcbiAgICAgICAgdGhpcy5fc3luY1Njcm9sbGJhckVuYWJsZWRTdGF0ZShPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJQb3NpdGlvbihPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgfVxuXG4gICAgX29uU2V0U2Nyb2xsKHgsIHksIHJlc2V0VmVsb2NpdHkpIHtcbiAgICAgICAgaWYgKHJlc2V0VmVsb2NpdHkgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICB0aGlzLl92ZWxvY2l0eS5zZXQoMCwgMCwgMCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB4Q2hhbmdlZCA9IHRoaXMuX3VwZGF0ZUF4aXMoeCwgJ3gnLCBPUklFTlRBVElPTl9IT1JJWk9OVEFMKTtcbiAgICAgICAgY29uc3QgeUNoYW5nZWQgPSB0aGlzLl91cGRhdGVBeGlzKHksICd5JywgT1JJRU5UQVRJT05fVkVSVElDQUwpO1xuXG4gICAgICAgIGlmICh4Q2hhbmdlZCB8fCB5Q2hhbmdlZCkge1xuICAgICAgICAgICAgdGhpcy5maXJlKCdzZXQ6c2Nyb2xsJywgdGhpcy5fc2Nyb2xsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVBeGlzKHNjcm9sbFZhbHVlLCBheGlzLCBvcmllbnRhdGlvbikge1xuICAgICAgICBjb25zdCBoYXNDaGFuZ2VkID0gKHNjcm9sbFZhbHVlICE9PSBudWxsICYmIE1hdGguYWJzKHNjcm9sbFZhbHVlIC0gdGhpcy5fc2Nyb2xsW2F4aXNdKSA+IDFlLTUpO1xuXG4gICAgICAgIC8vIGFsd2F5cyB1cGRhdGUgaWYgZHJhZ2dpbmcgYmVjYXVzZSBkcmFnIGhlbHBlciBkaXJlY3RseSB1cGRhdGVzIHRoZSBlbnRpdHkgcG9zaXRpb25cbiAgICAgICAgLy8gYWx3YXlzIHVwZGF0ZSBpZiBzY3JvbGxWYWx1ZSA9PT0gMCBiZWNhdXNlIGl0IHdpbGwgYmUgY2xhbXBlZCB0byAwXG4gICAgICAgIC8vIGlmIHZpZXdwb3J0IGlzIGxhcmdlciB0aGFuIGNvbnRlbnQgYW5kIHBvc2l0aW9uIGNvdWxkIGJlIG1vdmVkIGJ5IGRyYWcgaGVscGVyIGJ1dFxuICAgICAgICAvLyBoYXNDaGFuZ2VkIHdpbGwgbmV2ZXIgYmUgdHJ1ZVxuICAgICAgICBpZiAoaGFzQ2hhbmdlZCB8fCB0aGlzLl9pc0RyYWdnaW5nKCkgfHwgc2Nyb2xsVmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX3Njcm9sbFtheGlzXSA9IHRoaXMuX2RldGVybWluZU5ld1Njcm9sbFZhbHVlKHNjcm9sbFZhbHVlLCBheGlzLCBvcmllbnRhdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9zeW5jQ29udGVudFBvc2l0aW9uKG9yaWVudGF0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJQb3NpdGlvbihvcmllbnRhdGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaGFzQ2hhbmdlZDtcbiAgICB9XG5cbiAgICBfZGV0ZXJtaW5lTmV3U2Nyb2xsVmFsdWUoc2Nyb2xsVmFsdWUsIGF4aXMsIG9yaWVudGF0aW9uKSB7XG4gICAgICAgIC8vIElmIHNjcm9sbGluZyBpcyBkaXNhYmxlZCBmb3IgdGhlIHNlbGVjdGVkIG9yaWVudGF0aW9uLCBmb3JjZSB0aGVcbiAgICAgICAgLy8gc2Nyb2xsIHBvc2l0aW9uIHRvIHJlbWFpbiBhdCB0aGUgY3VycmVudCB2YWx1ZVxuICAgICAgICBpZiAoIXRoaXMuX2dldFNjcm9sbGluZ0VuYWJsZWQob3JpZW50YXRpb24pKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fc2Nyb2xsW2F4aXNdO1xuICAgICAgICB9XG5cbiAgICAgICAgc3dpdGNoICh0aGlzLnNjcm9sbE1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgU0NST0xMX01PREVfQ0xBTVA6XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1hdGguY2xhbXAoc2Nyb2xsVmFsdWUsIDAsIHRoaXMuX2dldE1heFNjcm9sbFZhbHVlKG9yaWVudGF0aW9uKSk7XG5cbiAgICAgICAgICAgIGNhc2UgU0NST0xMX01PREVfQk9VTkNFOlxuICAgICAgICAgICAgICAgIHRoaXMuX3NldFZlbG9jaXR5RnJvbU92ZXJzaG9vdChzY3JvbGxWYWx1ZSwgYXhpcywgb3JpZW50YXRpb24pO1xuICAgICAgICAgICAgICAgIHJldHVybiBzY3JvbGxWYWx1ZTtcblxuICAgICAgICAgICAgY2FzZSBTQ1JPTExfTU9ERV9JTkZJTklURTpcbiAgICAgICAgICAgICAgICByZXR1cm4gc2Nyb2xsVmFsdWU7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdVbmhhbmRsZWQgc2Nyb2xsIG1vZGU6JyArIHRoaXMuc2Nyb2xsTW9kZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNjcm9sbFZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3N5bmNBbGwoKSB7XG4gICAgICAgIHRoaXMuX3N5bmNDb250ZW50UG9zaXRpb24oT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNDb250ZW50UG9zaXRpb24oT1JJRU5UQVRJT05fVkVSVElDQUwpO1xuICAgICAgICB0aGlzLl9zeW5jU2Nyb2xsYmFyUG9zaXRpb24oT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJQb3NpdGlvbihPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJFbmFibGVkU3RhdGUoT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgICAgIHRoaXMuX3N5bmNTY3JvbGxiYXJFbmFibGVkU3RhdGUoT1JJRU5UQVRJT05fVkVSVElDQUwpO1xuICAgIH1cblxuICAgIF9zeW5jQ29udGVudFBvc2l0aW9uKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGF4aXMgPSB0aGlzLl9nZXRBeGlzKG9yaWVudGF0aW9uKTtcbiAgICAgICAgY29uc3Qgc2lnbiA9IHRoaXMuX2dldFNpZ24ob3JpZW50YXRpb24pO1xuICAgICAgICBjb25zdCBjb250ZW50RW50aXR5ID0gdGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHk7XG5cbiAgICAgICAgaWYgKGNvbnRlbnRFbnRpdHkpIHtcbiAgICAgICAgICAgIGNvbnN0IHByZXZDb250ZW50U2l6ZSA9IHRoaXMuX3ByZXZDb250ZW50U2l6ZXNbb3JpZW50YXRpb25dO1xuICAgICAgICAgICAgY29uc3QgY3VyckNvbnRlbnRTaXplID0gdGhpcy5fZ2V0Q29udGVudFNpemUob3JpZW50YXRpb24pO1xuXG4gICAgICAgICAgICAvLyBJZiB0aGUgY29udGVudCBzaXplIGhhcyBjaGFuZ2VkLCBhZGp1c3QgdGhlIHNjcm9sbCB2YWx1ZSBzbyB0aGF0IHRoZSBjb250ZW50IHdpbGxcbiAgICAgICAgICAgIC8vIHN0YXkgaW4gdGhlIHNhbWUgcGxhY2UgZnJvbSB0aGUgdXNlcidzIHBlcnNwZWN0aXZlLlxuICAgICAgICAgICAgaWYgKHByZXZDb250ZW50U2l6ZSAhPT0gbnVsbCAmJiBNYXRoLmFicyhwcmV2Q29udGVudFNpemUgLSBjdXJyQ29udGVudFNpemUpID4gMWUtNCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZXZNYXhPZmZzZXQgPSB0aGlzLl9nZXRNYXhPZmZzZXQob3JpZW50YXRpb24sIHByZXZDb250ZW50U2l6ZSk7XG4gICAgICAgICAgICAgICAgY29uc3QgY3Vyck1heE9mZnNldCA9IHRoaXMuX2dldE1heE9mZnNldChvcmllbnRhdGlvbiwgY3VyckNvbnRlbnRTaXplKTtcbiAgICAgICAgICAgICAgICBpZiAoY3Vyck1heE9mZnNldCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zY3JvbGxbYXhpc10gPSAxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3Njcm9sbFtheGlzXSA9IG1hdGguY2xhbXAodGhpcy5fc2Nyb2xsW2F4aXNdICogcHJldk1heE9mZnNldCAvIGN1cnJNYXhPZmZzZXQsIDAsIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdGhpcy5fc2Nyb2xsW2F4aXNdICogdGhpcy5fZ2V0TWF4T2Zmc2V0KG9yaWVudGF0aW9uKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnRQb3NpdGlvbiA9IGNvbnRlbnRFbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICAgICAgY29udGVudFBvc2l0aW9uW2F4aXNdID0gb2Zmc2V0ICogc2lnbjtcblxuICAgICAgICAgICAgY29udGVudEVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKGNvbnRlbnRQb3NpdGlvbik7XG5cbiAgICAgICAgICAgIHRoaXMuX3ByZXZDb250ZW50U2l6ZXNbb3JpZW50YXRpb25dID0gY3VyckNvbnRlbnRTaXplO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3N5bmNTY3JvbGxiYXJQb3NpdGlvbihvcmllbnRhdGlvbikge1xuICAgICAgICBjb25zdCBheGlzID0gdGhpcy5fZ2V0QXhpcyhvcmllbnRhdGlvbik7XG4gICAgICAgIGNvbnN0IHNjcm9sbGJhckVudGl0eSA9IHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbb3JpZW50YXRpb25dLmVudGl0eTtcblxuICAgICAgICBpZiAoc2Nyb2xsYmFyRW50aXR5ICYmIHNjcm9sbGJhckVudGl0eS5zY3JvbGxiYXIpIHtcbiAgICAgICAgICAgIC8vIFNldHRpbmcgdGhlIHZhbHVlIG9mIHRoZSBzY3JvbGxiYXIgd2lsbCBmaXJlIGEgJ3NldDp2YWx1ZScgZXZlbnQsIHdoaWNoIGluIHR1cm5cbiAgICAgICAgICAgIC8vIHdpbGwgY2FsbCB0aGUgX29uU2V0SG9yaXpvbnRhbFNjcm9sbGJhclZhbHVlL19vblNldFZlcnRpY2FsU2Nyb2xsYmFyVmFsdWUgaGFuZGxlcnNcbiAgICAgICAgICAgIC8vIGFuZCBjYXVzZSBhIGN5Y2xlLiBUbyBhdm9pZCB0aGlzIHdlIGtlZXAgdHJhY2sgb2YgdGhlIGZhY3QgdGhhdCB3ZSdyZSBpbiB0aGUgcHJvY2Vzc1xuICAgICAgICAgICAgLy8gb2YgdXBkYXRpbmcgdGhlIHNjcm9sbGJhciB2YWx1ZS5cbiAgICAgICAgICAgIHRoaXMuX3Njcm9sbGJhclVwZGF0ZUZsYWdzW29yaWVudGF0aW9uXSA9IHRydWU7XG4gICAgICAgICAgICBzY3JvbGxiYXJFbnRpdHkuc2Nyb2xsYmFyLnZhbHVlID0gdGhpcy5fc2Nyb2xsW2F4aXNdO1xuICAgICAgICAgICAgc2Nyb2xsYmFyRW50aXR5LnNjcm9sbGJhci5oYW5kbGVTaXplID0gdGhpcy5fZ2V0U2Nyb2xsYmFySGFuZGxlU2l6ZShheGlzLCBvcmllbnRhdGlvbik7XG4gICAgICAgICAgICB0aGlzLl9zY3JvbGxiYXJVcGRhdGVGbGFnc1tvcmllbnRhdGlvbl0gPSBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIFRvZ2dsZXMgdGhlIHNjcm9sbGJhciBlbnRpdGllcyB0aGVtc2VsdmVzIHRvIGJlIGVuYWJsZWQvZGlzYWJsZWQgYmFzZWRcbiAgICAvLyBvbiB3aGV0aGVyIHRoZSB1c2VyIGhhcyBlbmFibGVkIGhvcml6b250YWwvdmVydGljYWwgc2Nyb2xsaW5nIG9uIHRoZVxuICAgIC8vIHNjcm9sbCB2aWV3LlxuICAgIF9zeW5jU2Nyb2xsYmFyRW5hYmxlZFN0YXRlKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IGVudGl0eSA9IHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbb3JpZW50YXRpb25dLmVudGl0eTtcblxuICAgICAgICBpZiAoZW50aXR5KSB7XG4gICAgICAgICAgICBjb25zdCBpc1Njcm9sbGluZ0VuYWJsZWQgPSB0aGlzLl9nZXRTY3JvbGxpbmdFbmFibGVkKG9yaWVudGF0aW9uKTtcbiAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RlZFZpc2liaWxpdHkgPSB0aGlzLl9nZXRTY3JvbGxiYXJWaXNpYmlsaXR5KG9yaWVudGF0aW9uKTtcblxuICAgICAgICAgICAgc3dpdGNoIChyZXF1ZXN0ZWRWaXNpYmlsaXR5KSB7XG4gICAgICAgICAgICAgICAgY2FzZSBTQ1JPTExCQVJfVklTSUJJTElUWV9TSE9XX0FMV0FZUzpcbiAgICAgICAgICAgICAgICAgICAgZW50aXR5LmVuYWJsZWQgPSBpc1Njcm9sbGluZ0VuYWJsZWQ7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIGNhc2UgU0NST0xMQkFSX1ZJU0lCSUxJVFlfU0hPV19XSEVOX1JFUVVJUkVEOlxuICAgICAgICAgICAgICAgICAgICBlbnRpdHkuZW5hYmxlZCA9IGlzU2Nyb2xsaW5nRW5hYmxlZCAmJiB0aGlzLl9jb250ZW50SXNMYXJnZXJUaGFuVmlld3BvcnQob3JpZW50YXRpb24pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ1VuaGFuZGxlZCBzY3JvbGxiYXIgdmlzaWJpbGl0eTonICsgcmVxdWVzdGVkVmlzaWJpbGl0eSk7XG4gICAgICAgICAgICAgICAgICAgIGVudGl0eS5lbmFibGVkID0gaXNTY3JvbGxpbmdFbmFibGVkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NvbnRlbnRJc0xhcmdlclRoYW5WaWV3cG9ydChvcmllbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0Q29udGVudFNpemUob3JpZW50YXRpb24pID4gdGhpcy5fZ2V0Vmlld3BvcnRTaXplKG9yaWVudGF0aW9uKTtcbiAgICB9XG5cbiAgICBfY29udGVudFBvc2l0aW9uVG9TY3JvbGxWYWx1ZShjb250ZW50UG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgbWF4T2Zmc2V0SCA9IHRoaXMuX2dldE1heE9mZnNldChPUklFTlRBVElPTl9IT1JJWk9OVEFMKTtcbiAgICAgICAgY29uc3QgbWF4T2Zmc2V0ViA9IHRoaXMuX2dldE1heE9mZnNldChPUklFTlRBVElPTl9WRVJUSUNBTCk7XG5cbiAgICAgICAgaWYgKG1heE9mZnNldEggPT09IDApIHtcbiAgICAgICAgICAgIF90ZW1wU2Nyb2xsVmFsdWUueCA9IDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfdGVtcFNjcm9sbFZhbHVlLnggPSBjb250ZW50UG9zaXRpb24ueCAvIG1heE9mZnNldEg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobWF4T2Zmc2V0ViA9PT0gMCkge1xuICAgICAgICAgICAgX3RlbXBTY3JvbGxWYWx1ZS55ID0gMDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF90ZW1wU2Nyb2xsVmFsdWUueSA9IGNvbnRlbnRQb3NpdGlvbi55IC8gLW1heE9mZnNldFY7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX3RlbXBTY3JvbGxWYWx1ZTtcbiAgICB9XG5cbiAgICBfZ2V0TWF4T2Zmc2V0KG9yaWVudGF0aW9uLCBjb250ZW50U2l6ZSkge1xuICAgICAgICBjb250ZW50U2l6ZSA9IGNvbnRlbnRTaXplID09PSB1bmRlZmluZWQgPyB0aGlzLl9nZXRDb250ZW50U2l6ZShvcmllbnRhdGlvbikgOiBjb250ZW50U2l6ZTtcblxuICAgICAgICBjb25zdCB2aWV3cG9ydFNpemUgPSB0aGlzLl9nZXRWaWV3cG9ydFNpemUob3JpZW50YXRpb24pO1xuXG4gICAgICAgIGlmIChjb250ZW50U2l6ZSA8IHZpZXdwb3J0U2l6ZSkge1xuICAgICAgICAgICAgcmV0dXJuIC10aGlzLl9nZXRWaWV3cG9ydFNpemUob3JpZW50YXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHZpZXdwb3J0U2l6ZSAtIGNvbnRlbnRTaXplO1xuICAgIH1cblxuICAgIF9nZXRNYXhTY3JvbGxWYWx1ZShvcmllbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5fY29udGVudElzTGFyZ2VyVGhhblZpZXdwb3J0KG9yaWVudGF0aW9uKSA/IDEgOiAwO1xuICAgIH1cblxuICAgIF9nZXRTY3JvbGxiYXJIYW5kbGVTaXplKGF4aXMsIG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IHZpZXdwb3J0U2l6ZSA9IHRoaXMuX2dldFZpZXdwb3J0U2l6ZShvcmllbnRhdGlvbik7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRTaXplID0gdGhpcy5fZ2V0Q29udGVudFNpemUob3JpZW50YXRpb24pO1xuXG4gICAgICAgIGlmIChNYXRoLmFicyhjb250ZW50U2l6ZSkgPCAwLjAwMSkge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYW5kbGVTaXplID0gTWF0aC5taW4odmlld3BvcnRTaXplIC8gY29udGVudFNpemUsIDEpO1xuICAgICAgICBjb25zdCBvdmVyc2hvb3QgPSB0aGlzLl90b092ZXJzaG9vdCh0aGlzLl9zY3JvbGxbYXhpc10sIG9yaWVudGF0aW9uKTtcblxuICAgICAgICBpZiAob3ZlcnNob290ID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gaGFuZGxlU2l6ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNjYWxlIHRoZSBoYW5kbGUgZG93biB3aGVuIHRoZSBjb250ZW50IGhhcyBiZWVuIGRyYWdnZWQgcGFzdCB0aGUgYm91bmRzXG4gICAgICAgIHJldHVybiBoYW5kbGVTaXplIC8gKDEgKyBNYXRoLmFicyhvdmVyc2hvb3QpKTtcbiAgICB9XG5cbiAgICBfZ2V0Vmlld3BvcnRTaXplKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTaXplKG9yaWVudGF0aW9uLCB0aGlzLl92aWV3cG9ydFJlZmVyZW5jZSk7XG4gICAgfVxuXG4gICAgX2dldENvbnRlbnRTaXplKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTaXplKG9yaWVudGF0aW9uLCB0aGlzLl9jb250ZW50UmVmZXJlbmNlKTtcbiAgICB9XG5cbiAgICBfZ2V0U2l6ZShvcmllbnRhdGlvbiwgZW50aXR5UmVmZXJlbmNlKSB7XG4gICAgICAgIGlmIChlbnRpdHlSZWZlcmVuY2UuZW50aXR5ICYmIGVudGl0eVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudCkge1xuICAgICAgICAgICAgcmV0dXJuIGVudGl0eVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudFt0aGlzLl9nZXRDYWxjdWxhdGVkRGltZW5zaW9uKG9yaWVudGF0aW9uKV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG5cbiAgICBfZ2V0U2Nyb2xsaW5nRW5hYmxlZChvcmllbnRhdGlvbikge1xuICAgICAgICBpZiAob3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX0hPUklaT05UQUwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhvcml6b250YWw7XG4gICAgICAgIH0gZWxzZSBpZiAob3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX1ZFUlRJQ0FMKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy52ZXJ0aWNhbDtcbiAgICAgICAgfVxuXG4gICAgICAgIERlYnVnLndhcm4oYFVucmVjb2duaXplZCBvcmllbnRhdGlvbjogJHtvcmllbnRhdGlvbn1gKTtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBfZ2V0U2Nyb2xsYmFyVmlzaWJpbGl0eShvcmllbnRhdGlvbikge1xuICAgICAgICBpZiAob3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX0hPUklaT05UQUwpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhvcml6b250YWxTY3JvbGxiYXJWaXNpYmlsaXR5O1xuICAgICAgICB9IGVsc2UgaWYgKG9yaWVudGF0aW9uID09PSBPUklFTlRBVElPTl9WRVJUSUNBTCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudmVydGljYWxTY3JvbGxiYXJWaXNpYmlsaXR5O1xuICAgICAgICB9XG5cbiAgICAgICAgRGVidWcud2FybihgVW5yZWNvZ25pemVkIG9yaWVudGF0aW9uOiAke29yaWVudGF0aW9ufWApO1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIF9nZXRTaWduKG9yaWVudGF0aW9uKSB7XG4gICAgICAgIHJldHVybiBvcmllbnRhdGlvbiA9PT0gT1JJRU5UQVRJT05fSE9SSVpPTlRBTCA/IDEgOiAtMTtcbiAgICB9XG5cbiAgICBfZ2V0QXhpcyhvcmllbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gb3JpZW50YXRpb24gPT09IE9SSUVOVEFUSU9OX0hPUklaT05UQUwgPyAneCcgOiAneSc7XG4gICAgfVxuXG4gICAgX2dldENhbGN1bGF0ZWREaW1lbnNpb24ob3JpZW50YXRpb24pIHtcbiAgICAgICAgcmV0dXJuIG9yaWVudGF0aW9uID09PSBPUklFTlRBVElPTl9IT1JJWk9OVEFMID8gJ2NhbGN1bGF0ZWRXaWR0aCcgOiAnY2FsY3VsYXRlZEhlaWdodCc7XG4gICAgfVxuXG4gICAgX2Rlc3Ryb3lEcmFnSGVscGVyKCkge1xuICAgICAgICBpZiAodGhpcy5fY29udGVudERyYWdIZWxwZXIpIHtcbiAgICAgICAgICAgIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyLmRlc3Ryb3koKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uVXBkYXRlKCkge1xuICAgICAgICBpZiAodGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVZlbG9jaXR5KCk7XG4gICAgICAgICAgICB0aGlzLl9zeW5jU2Nyb2xsYmFyRW5hYmxlZFN0YXRlKE9SSUVOVEFUSU9OX0hPUklaT05UQUwpO1xuICAgICAgICAgICAgdGhpcy5fc3luY1Njcm9sbGJhckVuYWJsZWRTdGF0ZShPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlVmVsb2NpdHkoKSB7XG4gICAgICAgIGlmICghdGhpcy5faXNEcmFnZ2luZygpKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zY3JvbGxNb2RlID09PSBTQ1JPTExfTU9ERV9CT1VOQ0UpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5faGFzT3ZlcnNob290KCd4JywgT1JJRU5UQVRJT05fSE9SSVpPTlRBTCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fc2V0VmVsb2NpdHlGcm9tT3ZlcnNob290KHRoaXMuc2Nyb2xsLngsICd4JywgT1JJRU5UQVRJT05fSE9SSVpPTlRBTCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2hhc092ZXJzaG9vdCgneScsIE9SSUVOVEFUSU9OX1ZFUlRJQ0FMKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9zZXRWZWxvY2l0eUZyb21PdmVyc2hvb3QodGhpcy5zY3JvbGwueSwgJ3knLCBPUklFTlRBVElPTl9WRVJUSUNBTCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoTWF0aC5hYnModGhpcy5fdmVsb2NpdHkueCkgPiAxZS00IHx8IE1hdGguYWJzKHRoaXMuX3ZlbG9jaXR5LnkpID4gMWUtNCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uID0gdGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkuZ2V0TG9jYWxQb3NpdGlvbigpO1xuICAgICAgICAgICAgICAgIHBvc2l0aW9uLnggKz0gdGhpcy5fdmVsb2NpdHkueDtcbiAgICAgICAgICAgICAgICBwb3NpdGlvbi55ICs9IHRoaXMuX3ZlbG9jaXR5Lnk7XG4gICAgICAgICAgICAgICAgdGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkuc2V0TG9jYWxQb3NpdGlvbihwb3NpdGlvbik7XG5cbiAgICAgICAgICAgICAgICB0aGlzLl9zZXRTY3JvbGxGcm9tQ29udGVudFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5fdmVsb2NpdHkueCAqPSAoMSAtIHRoaXMuZnJpY3Rpb24pO1xuICAgICAgICAgICAgdGhpcy5fdmVsb2NpdHkueSAqPSAoMSAtIHRoaXMuZnJpY3Rpb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2hhc092ZXJzaG9vdChheGlzLCBvcmllbnRhdGlvbikge1xuICAgICAgICByZXR1cm4gTWF0aC5hYnModGhpcy5fdG9PdmVyc2hvb3QodGhpcy5zY3JvbGxbYXhpc10sIG9yaWVudGF0aW9uKSkgPiAwLjAwMTtcbiAgICB9XG5cbiAgICBfdG9PdmVyc2hvb3Qoc2Nyb2xsVmFsdWUsIG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IG1heFNjcm9sbFZhbHVlID0gdGhpcy5fZ2V0TWF4U2Nyb2xsVmFsdWUob3JpZW50YXRpb24pO1xuXG4gICAgICAgIGlmIChzY3JvbGxWYWx1ZSA8IDApIHtcbiAgICAgICAgICAgIHJldHVybiBzY3JvbGxWYWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChzY3JvbGxWYWx1ZSA+IG1heFNjcm9sbFZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gc2Nyb2xsVmFsdWUgLSBtYXhTY3JvbGxWYWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIF9zZXRWZWxvY2l0eUZyb21PdmVyc2hvb3Qoc2Nyb2xsVmFsdWUsIGF4aXMsIG9yaWVudGF0aW9uKSB7XG4gICAgICAgIGNvbnN0IG92ZXJzaG9vdFZhbHVlID0gdGhpcy5fdG9PdmVyc2hvb3Qoc2Nyb2xsVmFsdWUsIG9yaWVudGF0aW9uKTtcbiAgICAgICAgY29uc3Qgb3ZlcnNob290UGl4ZWxzID0gb3ZlcnNob290VmFsdWUgKiB0aGlzLl9nZXRNYXhPZmZzZXQob3JpZW50YXRpb24pICogdGhpcy5fZ2V0U2lnbihvcmllbnRhdGlvbik7XG5cbiAgICAgICAgaWYgKE1hdGguYWJzKG92ZXJzaG9vdFBpeGVscykgPiAwKSB7XG4gICAgICAgICAgICAvLyA1MCBoZXJlIGlzIGp1c3QgYSBtYWdpYyBudW1iZXIg4oCTIGl0IHNlZW1zIHRvIGdpdmUgdXMgYSByYW5nZSBvZiB1c2VmdWxcbiAgICAgICAgICAgIC8vIHJhbmdlIG9mIGJvdW5jZUFtb3VudCB2YWx1ZXMsIHNvIHRoYXQgMC4xIGlzIHNpbWlsYXIgdG8gdGhlIGlPUyBib3VuY2VcbiAgICAgICAgICAgIC8vIGZlZWwsIDEuMCBpcyBtdWNoIHNsb3dlciwgZXRjLiBUaGUgKyAxIG1lYW5zIHRoYXQgd2hlbiBib3VuY2VBbW91bnQgaXNcbiAgICAgICAgICAgIC8vIDAsIHRoZSBjb250ZW50IHdpbGwganVzdCBzbmFwIGJhY2sgaW1tZWRpYXRlbHkgaW5zdGVhZCBvZiBtb3ZpbmcgZ3JhZHVhbGx5LlxuICAgICAgICAgICAgdGhpcy5fdmVsb2NpdHlbYXhpc10gPSAtb3ZlcnNob290UGl4ZWxzIC8gKHRoaXMuYm91bmNlQW1vdW50ICogNTAgKyAxKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zZXRWZWxvY2l0eUZyb21Db250ZW50UG9zaXRpb25EZWx0YShwb3NpdGlvbikge1xuICAgICAgICBpZiAodGhpcy5fcHJldkNvbnRlbnREcmFnUG9zaXRpb24pIHtcbiAgICAgICAgICAgIHRoaXMuX3ZlbG9jaXR5LnN1YjIocG9zaXRpb24sIHRoaXMuX3ByZXZDb250ZW50RHJhZ1Bvc2l0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuX3ByZXZDb250ZW50RHJhZ1Bvc2l0aW9uLmNvcHkocG9zaXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fdmVsb2NpdHkuc2V0KDAsIDAsIDApO1xuICAgICAgICAgICAgdGhpcy5fcHJldkNvbnRlbnREcmFnUG9zaXRpb24gPSBwb3NpdGlvbi5jbG9uZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3NldFNjcm9sbEZyb21Db250ZW50UG9zaXRpb24ocG9zaXRpb24pIHtcbiAgICAgICAgbGV0IHNjcm9sbFZhbHVlID0gdGhpcy5fY29udGVudFBvc2l0aW9uVG9TY3JvbGxWYWx1ZShwb3NpdGlvbik7XG5cbiAgICAgICAgaWYgKHRoaXMuX2lzRHJhZ2dpbmcoKSkge1xuICAgICAgICAgICAgc2Nyb2xsVmFsdWUgPSB0aGlzLl9hcHBseVNjcm9sbFZhbHVlVGVuc2lvbihzY3JvbGxWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9vblNldFNjcm9sbChzY3JvbGxWYWx1ZS54LCBzY3JvbGxWYWx1ZS55LCBmYWxzZSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIG5pY2UgdGVuc2lvbiBlZmZlY3Qgd2hlbiBkcmFnZ2luZyBwYXN0IHRoZSBleHRlbnRzIG9mIHRoZSB2aWV3cG9ydFxuICAgIF9hcHBseVNjcm9sbFZhbHVlVGVuc2lvbihzY3JvbGxWYWx1ZSkge1xuICAgICAgICBjb25zdCBmYWN0b3IgPSAxO1xuXG4gICAgICAgIGxldCBtYXggPSB0aGlzLl9nZXRNYXhTY3JvbGxWYWx1ZShPUklFTlRBVElPTl9IT1JJWk9OVEFMKTtcbiAgICAgICAgbGV0IG92ZXJzaG9vdCA9IHRoaXMuX3RvT3ZlcnNob290KHNjcm9sbFZhbHVlLngsIE9SSUVOVEFUSU9OX0hPUklaT05UQUwpO1xuICAgICAgICBpZiAob3ZlcnNob290ID4gMCkge1xuICAgICAgICAgICAgc2Nyb2xsVmFsdWUueCA9IG1heCArIGZhY3RvciAqIE1hdGgubG9nMTAoMSArIG92ZXJzaG9vdCk7XG4gICAgICAgIH0gZWxzZSBpZiAob3ZlcnNob290IDwgMCkge1xuICAgICAgICAgICAgc2Nyb2xsVmFsdWUueCA9IC1mYWN0b3IgKiBNYXRoLmxvZzEwKDEgLSBvdmVyc2hvb3QpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF4ID0gdGhpcy5fZ2V0TWF4U2Nyb2xsVmFsdWUoT1JJRU5UQVRJT05fVkVSVElDQUwpO1xuICAgICAgICBvdmVyc2hvb3QgPSB0aGlzLl90b092ZXJzaG9vdChzY3JvbGxWYWx1ZS55LCBPUklFTlRBVElPTl9WRVJUSUNBTCk7XG5cbiAgICAgICAgaWYgKG92ZXJzaG9vdCA+IDApIHtcbiAgICAgICAgICAgIHNjcm9sbFZhbHVlLnkgPSBtYXggKyBmYWN0b3IgKiBNYXRoLmxvZzEwKDEgKyBvdmVyc2hvb3QpO1xuICAgICAgICB9IGVsc2UgaWYgKG92ZXJzaG9vdCA8IDApIHtcbiAgICAgICAgICAgIHNjcm9sbFZhbHVlLnkgPSAtZmFjdG9yICogTWF0aC5sb2cxMCgxIC0gb3ZlcnNob290KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzY3JvbGxWYWx1ZTtcbiAgICB9XG5cbiAgICBfaXNEcmFnZ2luZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyICYmIHRoaXMuX2NvbnRlbnREcmFnSGVscGVyLmlzRHJhZ2dpbmc7XG4gICAgfVxuXG4gICAgX3NldFNjcm9sbGJhckNvbXBvbmVudHNFbmFibGVkKGVuYWJsZWQpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fSE9SSVpPTlRBTF0uaGFzQ29tcG9uZW50KCdzY3JvbGxiYXInKSkge1xuICAgICAgICAgICAgdGhpcy5fc2Nyb2xsYmFyUmVmZXJlbmNlc1tPUklFTlRBVElPTl9IT1JJWk9OVEFMXS5lbnRpdHkuc2Nyb2xsYmFyLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdLmhhc0NvbXBvbmVudCgnc2Nyb2xsYmFyJykpIHtcbiAgICAgICAgICAgIHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdLmVudGl0eS5zY3JvbGxiYXIuZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc2V0Q29udGVudERyYWdnaW5nRW5hYmxlZChlbmFibGVkKSB7XG4gICAgICAgIGlmICh0aGlzLl9jb250ZW50RHJhZ0hlbHBlcikge1xuICAgICAgICAgICAgdGhpcy5fY29udGVudERyYWdIZWxwZXIuZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25Nb3VzZVdoZWVsKGV2ZW50KSB7XG4gICAgICAgIGlmICh0aGlzLnVzZU1vdXNlV2hlZWwpIHtcbiAgICAgICAgICAgIGNvbnN0IHdoZWVsRXZlbnQgPSBldmVudC5ldmVudDtcblxuICAgICAgICAgICAgLy8gd2hlZWxFdmVudCdzIGRlbHRhIHZhcmlhYmxlcyBhcmUgc2NyZWVuIHNwYWNlLCBzbyB0aGV5IG5lZWQgdG8gYmUgbm9ybWFsaXplZCBmaXJzdFxuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZERlbHRhWCA9ICh3aGVlbEV2ZW50LmRlbHRhWCAvIHRoaXMuX2NvbnRlbnRSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQuY2FsY3VsYXRlZFdpZHRoKSAqIHRoaXMubW91c2VXaGVlbFNlbnNpdGl2aXR5Lng7XG4gICAgICAgICAgICBjb25zdCBub3JtYWxpemVkRGVsdGFZID0gKHdoZWVsRXZlbnQuZGVsdGFZIC8gdGhpcy5fY29udGVudFJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5jYWxjdWxhdGVkSGVpZ2h0KSAqIHRoaXMubW91c2VXaGVlbFNlbnNpdGl2aXR5Lnk7XG5cbiAgICAgICAgICAgIC8vIHVwZGF0ZSBzY3JvbGwgcG9zaXRpb25zLCBjbGFtcGluZyB0byBbMCwgbWF4U2Nyb2xsVmFsdWVdIHRvIGFsd2F5cyBwcmV2ZW50IG92ZXItc2hvb3RpbmdcbiAgICAgICAgICAgIGNvbnN0IHNjcm9sbFggPSBtYXRoLmNsYW1wKHRoaXMuX3Njcm9sbC54ICsgbm9ybWFsaXplZERlbHRhWCwgMCwgdGhpcy5fZ2V0TWF4U2Nyb2xsVmFsdWUoT1JJRU5UQVRJT05fSE9SSVpPTlRBTCkpO1xuICAgICAgICAgICAgY29uc3Qgc2Nyb2xsWSA9IG1hdGguY2xhbXAodGhpcy5fc2Nyb2xsLnkgKyBub3JtYWxpemVkRGVsdGFZLCAwLCB0aGlzLl9nZXRNYXhTY3JvbGxWYWx1ZShPUklFTlRBVElPTl9WRVJUSUNBTCkpO1xuXG4gICAgICAgICAgICB0aGlzLnNjcm9sbCA9IG5ldyBWZWMyKHNjcm9sbFgsIHNjcm9sbFkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gcmUtZW5hYmxlIHVzZUlucHV0IGZsYWcgb24gYW55IGRlc2NlbmRhbnQgdGhhdCB3YXMgZGlzYWJsZWRcbiAgICBfZW5hYmxlQ29udGVudElucHV0KCkge1xuICAgICAgICB3aGlsZSAodGhpcy5fZGlzYWJsZWRDb250ZW50SW5wdXRFbnRpdGllcy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IGUgPSB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dEVudGl0aWVzLnBvcCgpO1xuICAgICAgICAgICAgaWYgKGUuZWxlbWVudCkge1xuICAgICAgICAgICAgICAgIGUuZWxlbWVudC51c2VJbnB1dCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dCA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIGRpc2FibGUgdXNlSW5wdXQgZmxhZyBvbiBhbGwgZGVzY2VuZGFudHMgb2YgdGhpcyBjb250ZW50RW50aXR5XG4gICAgX2Rpc2FibGVDb250ZW50SW5wdXQoKSB7XG4gICAgICAgIGNvbnN0IF9kaXNhYmxlSW5wdXQgPSAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuZWxlbWVudCAmJiBlLmVsZW1lbnQudXNlSW5wdXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9kaXNhYmxlZENvbnRlbnRJbnB1dEVudGl0aWVzLnB1c2goZSk7XG4gICAgICAgICAgICAgICAgZS5lbGVtZW50LnVzZUlucHV0ID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuID0gZS5jaGlsZHJlbjtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwLCBsID0gY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgX2Rpc2FibGVJbnB1dChjaGlsZHJlbltpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgY29udGVudEVudGl0eSA9IHRoaXMuX2NvbnRlbnRSZWZlcmVuY2UuZW50aXR5O1xuICAgICAgICBpZiAoY29udGVudEVudGl0eSkge1xuICAgICAgICAgICAgLy8gZGlzYWJsZSBpbnB1dCByZWN1cnNpdmVseSBmb3IgYWxsIGNoaWxkcmVuIG9mIHRoZSBjb250ZW50IGVudGl0eVxuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW4gPSBjb250ZW50RW50aXR5LmNoaWxkcmVuO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDAsIGwgPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgICAgICBfZGlzYWJsZUlucHV0KGNoaWxkcmVuW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2Rpc2FibGVkQ29udGVudElucHV0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBvbkVuYWJsZSgpIHtcbiAgICAgICAgdGhpcy5fdmlld3BvcnRSZWZlcmVuY2Uub25QYXJlbnRDb21wb25lbnRFbmFibGUoKTtcbiAgICAgICAgdGhpcy5fY29udGVudFJlZmVyZW5jZS5vblBhcmVudENvbXBvbmVudEVuYWJsZSgpO1xuICAgICAgICB0aGlzLl9zY3JvbGxiYXJSZWZlcmVuY2VzW09SSUVOVEFUSU9OX0hPUklaT05UQUxdLm9uUGFyZW50Q29tcG9uZW50RW5hYmxlKCk7XG4gICAgICAgIHRoaXMuX3Njcm9sbGJhclJlZmVyZW5jZXNbT1JJRU5UQVRJT05fVkVSVElDQUxdLm9uUGFyZW50Q29tcG9uZW50RW5hYmxlKCk7XG4gICAgICAgIHRoaXMuX3NldFNjcm9sbGJhckNvbXBvbmVudHNFbmFibGVkKHRydWUpO1xuICAgICAgICB0aGlzLl9zZXRDb250ZW50RHJhZ2dpbmdFbmFibGVkKHRydWUpO1xuXG4gICAgICAgIHRoaXMuX3N5bmNBbGwoKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuX3NldFNjcm9sbGJhckNvbXBvbmVudHNFbmFibGVkKGZhbHNlKTtcbiAgICAgICAgdGhpcy5fc2V0Q29udGVudERyYWdnaW5nRW5hYmxlZChmYWxzZSk7XG4gICAgfVxuXG4gICAgb25SZW1vdmUoKSB7XG4gICAgICAgIHRoaXMuX3RvZ2dsZUxpZmVjeWNsZUxpc3RlbmVycygnb2ZmJywgdGhpcy5zeXN0ZW0pO1xuICAgICAgICB0aGlzLl90b2dnbGVFbGVtZW50TGlzdGVuZXJzKCdvZmYnKTtcbiAgICAgICAgdGhpcy5fZGVzdHJveURyYWdIZWxwZXIoKTtcbiAgICB9XG5cbiAgICBzZXQgc2Nyb2xsKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuX29uU2V0U2Nyb2xsKHZhbHVlLngsIHZhbHVlLnkpO1xuICAgIH1cblxuICAgIGdldCBzY3JvbGwoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9zY3JvbGw7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTY3JvbGxWaWV3Q29tcG9uZW50IH07XG4iXSwibmFtZXMiOlsiX3RlbXBTY3JvbGxWYWx1ZSIsIlZlYzIiLCJTY3JvbGxWaWV3Q29tcG9uZW50IiwiQ29tcG9uZW50IiwiY29uc3RydWN0b3IiLCJzeXN0ZW0iLCJlbnRpdHkiLCJfdmlld3BvcnRSZWZlcmVuY2UiLCJFbnRpdHlSZWZlcmVuY2UiLCJfb25WaWV3cG9ydEVsZW1lbnRHYWluIiwiX29uU2V0Q29udGVudE9yVmlld3BvcnRTaXplIiwiX2NvbnRlbnRSZWZlcmVuY2UiLCJfb25Db250ZW50RWxlbWVudEdhaW4iLCJfb25Db250ZW50RWxlbWVudExvc2UiLCJfc2Nyb2xsYmFyVXBkYXRlRmxhZ3MiLCJfc2Nyb2xsYmFyUmVmZXJlbmNlcyIsIk9SSUVOVEFUSU9OX0hPUklaT05UQUwiLCJfb25TZXRIb3Jpem9udGFsU2Nyb2xsYmFyVmFsdWUiLCJfb25Ib3Jpem9udGFsU2Nyb2xsYmFyR2FpbiIsIk9SSUVOVEFUSU9OX1ZFUlRJQ0FMIiwiX29uU2V0VmVydGljYWxTY3JvbGxiYXJWYWx1ZSIsIl9vblZlcnRpY2FsU2Nyb2xsYmFyR2FpbiIsIl9wcmV2Q29udGVudFNpemVzIiwiX3Njcm9sbCIsIl92ZWxvY2l0eSIsIlZlYzMiLCJfZHJhZ1N0YXJ0UG9zaXRpb24iLCJfZGlzYWJsZWRDb250ZW50SW5wdXQiLCJfZGlzYWJsZWRDb250ZW50SW5wdXRFbnRpdGllcyIsIl90b2dnbGVMaWZlY3ljbGVMaXN0ZW5lcnMiLCJfdG9nZ2xlRWxlbWVudExpc3RlbmVycyIsIm9uT3JPZmYiLCJfb25TZXRIb3Jpem9udGFsU2Nyb2xsaW5nRW5hYmxlZCIsIl9vblNldFZlcnRpY2FsU2Nyb2xsaW5nRW5hYmxlZCIsImFwcCIsInN5c3RlbXMiLCJlbGVtZW50IiwiX29uRWxlbWVudENvbXBvbmVudEFkZCIsIl9vbkVsZW1lbnRDb21wb25lbnRSZW1vdmUiLCJfaGFzRWxlbWVudExpc3RlbmVycyIsIkVWRU5UX01PVVNFV0hFRUwiLCJfb25Nb3VzZVdoZWVsIiwiX3N5bmNBbGwiLCJfZGVzdHJveURyYWdIZWxwZXIiLCJfY29udGVudERyYWdIZWxwZXIiLCJFbGVtZW50RHJhZ0hlbHBlciIsIm9uIiwiX29uQ29udGVudERyYWdTdGFydCIsIl9vbkNvbnRlbnREcmFnRW5kIiwiX29uQ29udGVudERyYWdNb3ZlIiwiZW5hYmxlZCIsImNvcHkiLCJnZXRMb2NhbFBvc2l0aW9uIiwiX3ByZXZDb250ZW50RHJhZ1Bvc2l0aW9uIiwiX2VuYWJsZUNvbnRlbnRJbnB1dCIsInBvc2l0aW9uIiwiX3dhc0RyYWdnZWQiLCJfc2V0U2Nyb2xsRnJvbUNvbnRlbnRQb3NpdGlvbiIsIl9zZXRWZWxvY2l0eUZyb21Db250ZW50UG9zaXRpb25EZWx0YSIsImR4IiwieCIsImR5IiwieSIsIk1hdGgiLCJhYnMiLCJkcmFnVGhyZXNob2xkIiwiX2Rpc2FibGVDb250ZW50SW5wdXQiLCJzY3JvbGxWYWx1ZVgiLCJfb25TZXRTY3JvbGwiLCJzY3JvbGxWYWx1ZVkiLCJfc3luY1Njcm9sbGJhckVuYWJsZWRTdGF0ZSIsIl9zeW5jU2Nyb2xsYmFyUG9zaXRpb24iLCJyZXNldFZlbG9jaXR5Iiwic2V0IiwieENoYW5nZWQiLCJfdXBkYXRlQXhpcyIsInlDaGFuZ2VkIiwiZmlyZSIsInNjcm9sbFZhbHVlIiwiYXhpcyIsIm9yaWVudGF0aW9uIiwiaGFzQ2hhbmdlZCIsIl9pc0RyYWdnaW5nIiwiX2RldGVybWluZU5ld1Njcm9sbFZhbHVlIiwiX3N5bmNDb250ZW50UG9zaXRpb24iLCJfZ2V0U2Nyb2xsaW5nRW5hYmxlZCIsInNjcm9sbE1vZGUiLCJTQ1JPTExfTU9ERV9DTEFNUCIsIm1hdGgiLCJjbGFtcCIsIl9nZXRNYXhTY3JvbGxWYWx1ZSIsIlNDUk9MTF9NT0RFX0JPVU5DRSIsIl9zZXRWZWxvY2l0eUZyb21PdmVyc2hvb3QiLCJTQ1JPTExfTU9ERV9JTkZJTklURSIsImNvbnNvbGUiLCJ3YXJuIiwiX2dldEF4aXMiLCJzaWduIiwiX2dldFNpZ24iLCJjb250ZW50RW50aXR5IiwicHJldkNvbnRlbnRTaXplIiwiY3VyckNvbnRlbnRTaXplIiwiX2dldENvbnRlbnRTaXplIiwicHJldk1heE9mZnNldCIsIl9nZXRNYXhPZmZzZXQiLCJjdXJyTWF4T2Zmc2V0Iiwib2Zmc2V0IiwiY29udGVudFBvc2l0aW9uIiwic2V0TG9jYWxQb3NpdGlvbiIsInNjcm9sbGJhckVudGl0eSIsInNjcm9sbGJhciIsInZhbHVlIiwiaGFuZGxlU2l6ZSIsIl9nZXRTY3JvbGxiYXJIYW5kbGVTaXplIiwiaXNTY3JvbGxpbmdFbmFibGVkIiwicmVxdWVzdGVkVmlzaWJpbGl0eSIsIl9nZXRTY3JvbGxiYXJWaXNpYmlsaXR5IiwiU0NST0xMQkFSX1ZJU0lCSUxJVFlfU0hPV19BTFdBWVMiLCJTQ1JPTExCQVJfVklTSUJJTElUWV9TSE9XX1dIRU5fUkVRVUlSRUQiLCJfY29udGVudElzTGFyZ2VyVGhhblZpZXdwb3J0IiwiX2dldFZpZXdwb3J0U2l6ZSIsIl9jb250ZW50UG9zaXRpb25Ub1Njcm9sbFZhbHVlIiwibWF4T2Zmc2V0SCIsIm1heE9mZnNldFYiLCJjb250ZW50U2l6ZSIsInVuZGVmaW5lZCIsInZpZXdwb3J0U2l6ZSIsIm1pbiIsIm92ZXJzaG9vdCIsIl90b092ZXJzaG9vdCIsIl9nZXRTaXplIiwiZW50aXR5UmVmZXJlbmNlIiwiX2dldENhbGN1bGF0ZWREaW1lbnNpb24iLCJob3Jpem9udGFsIiwidmVydGljYWwiLCJEZWJ1ZyIsImhvcml6b250YWxTY3JvbGxiYXJWaXNpYmlsaXR5IiwidmVydGljYWxTY3JvbGxiYXJWaXNpYmlsaXR5IiwiZGVzdHJveSIsIm9uVXBkYXRlIiwiX3VwZGF0ZVZlbG9jaXR5IiwiX2hhc092ZXJzaG9vdCIsInNjcm9sbCIsImZyaWN0aW9uIiwibWF4U2Nyb2xsVmFsdWUiLCJvdmVyc2hvb3RWYWx1ZSIsIm92ZXJzaG9vdFBpeGVscyIsImJvdW5jZUFtb3VudCIsInN1YjIiLCJjbG9uZSIsIl9hcHBseVNjcm9sbFZhbHVlVGVuc2lvbiIsImZhY3RvciIsIm1heCIsImxvZzEwIiwiaXNEcmFnZ2luZyIsIl9zZXRTY3JvbGxiYXJDb21wb25lbnRzRW5hYmxlZCIsImhhc0NvbXBvbmVudCIsIl9zZXRDb250ZW50RHJhZ2dpbmdFbmFibGVkIiwiZXZlbnQiLCJ1c2VNb3VzZVdoZWVsIiwid2hlZWxFdmVudCIsIm5vcm1hbGl6ZWREZWx0YVgiLCJkZWx0YVgiLCJjYWxjdWxhdGVkV2lkdGgiLCJtb3VzZVdoZWVsU2Vuc2l0aXZpdHkiLCJub3JtYWxpemVkRGVsdGFZIiwiZGVsdGFZIiwiY2FsY3VsYXRlZEhlaWdodCIsInNjcm9sbFgiLCJzY3JvbGxZIiwibGVuZ3RoIiwiZSIsInBvcCIsInVzZUlucHV0IiwiX2Rpc2FibGVJbnB1dCIsInB1c2giLCJjaGlsZHJlbiIsImkiLCJsIiwib25FbmFibGUiLCJvblBhcmVudENvbXBvbmVudEVuYWJsZSIsIm9uRGlzYWJsZSIsIm9uUmVtb3ZlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBZ0JBLE1BQU1BLGdCQUFnQixHQUFHLElBQUlDLElBQUksRUFBRSxDQUFBOztBQUVuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLG1CQUFtQixTQUFTQyxTQUFTLENBQUM7QUFDeEM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNJQyxFQUFBQSxXQUFXQSxDQUFDQyxNQUFNLEVBQUVDLE1BQU0sRUFBRTtBQUN4QixJQUFBLEtBQUssQ0FBQ0QsTUFBTSxFQUFFQyxNQUFNLENBQUMsQ0FBQTtJ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
