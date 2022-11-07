/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { now } from '../../../core/time.js';
import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { EntityReference } from '../../utils/entity-reference.js';
import { Component } from '../component.js';
import { BUTTON_TRANSITION_MODE_SPRITE_CHANGE, BUTTON_TRANSITION_MODE_TINT } from './constants.js';
import { ELEMENTTYPE_GROUP } from '../element/constants.js';

const VisualState = {
  DEFAULT: 'DEFAULT',
  HOVER: 'HOVER',
  PRESSED: 'PRESSED',
  INACTIVE: 'INACTIVE'
};
const STATES_TO_TINT_NAMES = {};
STATES_TO_TINT_NAMES[VisualState.DEFAULT] = '_defaultTint';
STATES_TO_TINT_NAMES[VisualState.HOVER] = 'hoverTint';
STATES_TO_TINT_NAMES[VisualState.PRESSED] = 'pressedTint';
STATES_TO_TINT_NAMES[VisualState.INACTIVE] = 'inactiveTint';
const STATES_TO_SPRITE_ASSET_NAMES = {};
STATES_TO_SPRITE_ASSET_NAMES[VisualState.DEFAULT] = '_defaultSpriteAsset';
STATES_TO_SPRITE_ASSET_NAMES[VisualState.HOVER] = 'hoverSpriteAsset';
STATES_TO_SPRITE_ASSET_NAMES[VisualState.PRESSED] = 'pressedSpriteAsset';
STATES_TO_SPRITE_ASSET_NAMES[VisualState.INACTIVE] = 'inactiveSpriteAsset';
const STATES_TO_SPRITE_FRAME_NAMES = {};
STATES_TO_SPRITE_FRAME_NAMES[VisualState.DEFAULT] = '_defaultSpriteFrame';
STATES_TO_SPRITE_FRAME_NAMES[VisualState.HOVER] = 'hoverSpriteFrame';
STATES_TO_SPRITE_FRAME_NAMES[VisualState.PRESSED] = 'pressedSpriteFrame';
STATES_TO_SPRITE_FRAME_NAMES[VisualState.INACTIVE] = 'inactiveSpriteFrame';

class ButtonComponent extends Component {
  constructor(system, entity) {
    super(system, entity);
    this._visualState = VisualState.DEFAULT;
    this._isHovering = false;
    this._hoveringCounter = 0;
    this._isPressed = false;
    this._defaultTint = new Color(1, 1, 1, 1);
    this._defaultSpriteAsset = null;
    this._defaultSpriteFrame = 0;
    this._imageReference = new EntityReference(this, 'imageEntity', {
      'element#gain': this._onImageElementGain,
      'element#lose': this._onImageElementLose,
      'element#set:color': this._onSetColor,
      'element#set:opacity': this._onSetOpacity,
      'element#set:spriteAsset': this._onSetSpriteAsset,
      'element#set:spriteFrame': this._onSetSpriteFrame
    });
    this._toggleLifecycleListeners('on', system);
  }
  _toggleLifecycleListeners(onOrOff, system) {
    this[onOrOff]('set_active', this._onSetActive, this);
    this[onOrOff]('set_transitionMode', this._onSetTransitionMode, this);
    this[onOrOff]('set_hoverTint', this._onSetTransitionValue, this);
    this[onOrOff]('set_pressedTint', this._onSetTransitionValue, this);
    this[onOrOff]('set_inactiveTint', this._onSetTransitionValue, this);
    this[onOrOff]('set_hoverSpriteAsset', this._onSetTransitionValue, this);
    this[onOrOff]('set_hoverSpriteFrame', this._onSetTransitionValue, this);
    this[onOrOff]('set_pressedSpriteAsset', this._onSetTransitionValue, this);
    this[onOrOff]('set_pressedSpriteFrame', this._onSetTransitionValue, this);
    this[onOrOff]('set_inactiveSpriteAsset', this._onSetTransitionValue, this);
    this[onOrOff]('set_inactiveSpriteFrame', this._onSetTransitionValue, this);
    system.app.systems.element[onOrOff]('add', this._onElementComponentAdd, this);
    system.app.systems.element[onOrOff]('beforeremove', this._onElementComponentRemove, this);
  }
  _onSetActive(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this._updateVisualState();
    }
  }
  _onSetTransitionMode(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this._cancelTween();
      this._resetToDefaultVisualState(oldValue);
      this._forceReapplyVisualState();
    }
  }
  _onSetTransitionValue(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this._forceReapplyVisualState();
    }
  }
  _onElementComponentRemove(entity) {
    if (this.entity === entity) {
      this._toggleHitElementListeners('off');
    }
  }
  _onElementComponentAdd(entity) {
    if (this.entity === entity) {
      this._toggleHitElementListeners('on');
    }
  }
  _onImageElementLose() {
    this._cancelTween();
    this._resetToDefaultVisualState(this.transitionMode);
  }
  _onImageElementGain() {
    this._storeDefaultVisualState();
    this._forceReapplyVisualState();
  }
  _toggleHitElementListeners(onOrOff) {
    if (this.entity.element) {
      const isAdding = onOrOff === 'on';

      if (isAdding && this._hasHitElementListeners) {
        return;
      }
      this.entity.element[onOrOff]('mouseenter', this._onMouseEnter, this);
      this.entity.element[onOrOff]('mouseleave', this._onMouseLeave, this);
      this.entity.element[onOrOff]('mousedown', this._onMouseDown, this);
      this.entity.element[onOrOff]('mouseup', this._onMouseUp, this);
      this.entity.element[onOrOff]('touchstart', this._onTouchStart, this);
      this.entity.element[onOrOff]('touchend', this._onTouchEnd, this);
      this.entity.element[onOrOff]('touchleave', this._onTouchLeave, this);
      this.entity.element[onOrOff]('touchcancel', this._onTouchCancel, this);
      this.entity.element[onOrOff]('selectstart', this._onSelectStart, this);
      this.entity.element[onOrOff]('selectend', this._onSelectEnd, this);
      this.entity.element[onOrOff]('selectenter', this._onSelectEnter, this);
      this.entity.element[onOrOff]('selectleave', this._onSelectLeave, this);
      this.entity.element[onOrOff]('click', this._onClick, this);
      this._hasHitElementListeners = isAdding;
    }
  }
  _storeDefaultVisualState() {
    if (this._imageReference.hasComponent('element')) {
      const element = this._imageReference.entity.element;
      if (element.type !== ELEMENTTYPE_GROUP) {
        this._storeDefaultColor(element.color);
        this._storeDefaultOpacity(element.opacity);
        this._storeDefaultSpriteAsset(element.spriteAsset);
        this._storeDefaultSpriteFrame(element.spriteFrame);
      }
    }
  }
  _storeDefaultColor(color) {
    this._defaultTint.r = color.r;
    this._defaultTint.g = color.g;
    this._defaultTint.b = color.b;
  }
  _storeDefaultOpacity(opacity) {
    this._defaultTint.a = opacity;
  }
  _storeDefaultSpriteAsset(spriteAsset) {
    this._defaultSpriteAsset = spriteAsset;
  }
  _storeDefaultSpriteFrame(spriteFrame) {
    this._defaultSpriteFrame = spriteFrame;
  }
  _onSetColor(color) {
    if (!this._isApplyingTint) {
      this._storeDefaultColor(color);
      this._forceReapplyVisualState();
    }
  }
  _onSetOpacity(opacity) {
    if (!this._isApplyingTint) {
      this._storeDefaultOpacity(opacity);
      this._forceReapplyVisualState();
    }
  }
  _onSetSpriteAsset(spriteAsset) {
    if (!this._isApplyingSprite) {
      this._storeDefaultSpriteAsset(spriteAsset);
      this._forceReapplyVisualState();
    }
  }
  _onSetSpriteFrame(spriteFrame) {
    if (!this._isApplyingSprite) {
      this._storeDefaultSpriteFrame(spriteFrame);
      this._forceReapplyVisualState();
    }
  }
  _onMouseEnter(event) {
    this._isHovering = true;
    this._updateVisualState();
    this._fireIfActive('mouseenter', event);
  }
  _onMouseLeave(event) {
    this._isHovering = false;
    this._isPressed = false;
    this._updateVisualState();
    this._fireIfActive('mouseleave', event);
  }
  _onMouseDown(event) {
    this._isPressed = true;
    this._updateVisualState();
    this._fireIfActive('mousedown', event);
  }
  _onMouseUp(event) {
    this._isPressed = false;
    this._updateVisualState();
    this._fireIfActive('mouseup', event);
  }
  _onTouchStart(event) {
    this._isPressed = true;
    this._updateVisualState();
    this._fireIfActive('touchstart', event);
  }
  _onTouchEnd(event) {
    event.event.preventDefault();
    this._isPressed = false;
    this._updateVisualState();
    this._fireIfActive('touchend', event);
  }
  _onTouchLeave(event) {
    this._isPressed = false;
    this._updateVisualState();
    this._fireIfActive('touchleave', event);
  }
  _onTouchCancel(event) {
    this._isPressed = false;
    this._updateVisualState();
    this._fireIfActive('touchcancel', event);
  }
  _onSelectStart(event) {
    this._isPressed = true;
    this._updateVisualState();
    this._fireIfActive('selectstart', event);
  }
  _onSelectEnd(event) {
    this._isPressed = false;
    this._updateVisualState();
    this._fireIfActive('selectend', event);
  }
  _onSelectEnter(event) {
    this._hoveringCounter++;
    if (this._hoveringCounter === 1) {
      this._isHovering = true;
      this._updateVisualState();
    }
    this._fireIfActive('selectenter', event);
  }
  _onSelectLeave(event) {
    this._hoveringCounter--;
    if (this._hoveringCounter === 0) {
      this._isHovering = false;
      this._isPressed = false;
      this._updateVisualState();
    }
    this._fireIfActive('selectleave', event);
  }
  _onClick(event) {
    this._fireIfActive('click', event);
  }
  _fireIfActive(name, event) {
    if (this.data.active) {
      this.fire(name, event);
    }
  }
  _updateVisualState(force) {
    const oldVisualState = this._visualState;
    const newVisualState = this._determineVisualState();
    if ((oldVisualState !== newVisualState || force) && this.enabled) {
      this._visualState = newVisualState;
      if (oldVisualState === VisualState.HOVER) {
        this._fireIfActive('hoverend');
      }
      if (oldVisualState === VisualState.PRESSED) {
        this._fireIfActive('pressedend');
      }
      if (newVisualState === VisualState.HOVER) {
        this._fireIfActive('hoverstart');
      }
      if (newVisualState === VisualState.PRESSED) {
        this._fireIfActive('pressedstart');
      }
      switch (this.transitionMode) {
        case BUTTON_TRANSITION_MODE_TINT:
          {
            const tintName = STATES_TO_TINT_NAMES[this._visualState];
            const tintColor = this[tintName];
            this._applyTint(tintColor);
            break;
          }
        case BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
          {
            const spriteAssetName = STATES_TO_SPRITE_ASSET_NAMES[this._visualState];
            const spriteFrameName = STATES_TO_SPRITE_FRAME_NAMES[this._visualState];
            const spriteAsset = this[spriteAssetName];
            const spriteFrame = this[spriteFrameName];
            this._applySprite(spriteAsset, spriteFrame);
            break;
          }
      }
    }
  }

  _forceReapplyVisualState() {
    this._updateVisualState(true);
  }

  _resetToDefaultVisualState(transitionMode) {
    if (this._imageReference.hasComponent('element')) {
      switch (transitionMode) {
        case BUTTON_TRANSITION_MODE_TINT:
          this._cancelTween();
          this._applyTintImmediately(this._defaultTint);
          break;
        case BUTTON_TRANSITION_MODE_SPRITE_CHANGE:
          this._applySprite(this._defaultSpriteAsset, this._defaultSpriteFrame);
          break;
      }
    }
  }
  _determineVisualState() {
    if (!this.active) {
      return VisualState.INACTIVE;
    } else if (this._isPressed) {
      return VisualState.PRESSED;
    } else if (this._isHovering) {
      return VisualState.HOVER;
    }
    return VisualState.DEFAULT;
  }
  _applySprite(spriteAsset, spriteFrame) {
    spriteFrame = spriteFrame || 0;
    if (this._imageReference.hasComponent('element')) {
      this._isApplyingSprite = true;
      if (this._imageReference.entity.element.spriteAsset !== spriteAsset) {
        this._imageReference.entity.element.spriteAsset = spriteAsset;
      }
      if (this._imageReference.entity.element.spriteFrame !== spriteFrame) {
        this._imageReference.entity.element.spriteFrame = spriteFrame;
      }
      this._isApplyingSprite = false;
    }
  }
  _applyTint(tintColor) {
    this._cancelTween();
    if (this.fadeDuration === 0) {
      this._applyTintImmediately(tintColor);
    } else {
      this._applyTintWithTween(tintColor);
    }
  }
  _applyTintImmediately(tintColor) {
    if (!tintColor || !this._imageReference.hasComponent('element') || this._imageReference.entity.element.type === ELEMENTTYPE_GROUP) return;
    const color3 = toColor3(tintColor);
    this._isApplyingTint = true;
    if (!color3.equals(this._imageReference.entity.element.color)) this._imageReference.entity.element.color = color3;
    if (this._imageReference.entity.element.opacity !== tintColor.a) this._imageReference.entity.element.opacity = tintColor.a;
    this._isApplyingTint = false;
  }
  _applyTintWithTween(tintColor) {
    if (!tintColor || !this._imageReference.hasComponent('element') || this._imageReference.entity.element.type === ELEMENTTYPE_GROUP) return;
    const color3 = toColor3(tintColor);
    const color = this._imageReference.entity.element.color;
    const opacity = this._imageReference.entity.element.opacity;
    if (color3.equals(color) && tintColor.a === opacity) return;
    this._tweenInfo = {
      startTime: now(),
      from: new Color(color.r, color.g, color.b, opacity),
      to: tintColor.clone(),
      lerpColor: new Color()
    };
  }
  _updateTintTween() {
    const elapsedTime = now() - this._tweenInfo.startTime;
    let elapsedProportion = this.fadeDuration === 0 ? 1 : elapsedTime / this.fadeDuration;
    elapsedProportion = math.clamp(elapsedProportion, 0, 1);
    if (Math.abs(elapsedProportion - 1) > 1e-5) {
      const lerpColor = this._tweenInfo.lerpColor;
      lerpColor.lerp(this._tweenInfo.from, this._tweenInfo.to, elapsedProportion);
      this._applyTintImmediately(new Color(lerpColor.r, lerpColor.g, lerpColor.b, lerpColor.a));
    } else {
      this._applyTintImmediately(this._tweenInfo.to);
      this._cancelTween();
    }
  }
  _cancelTween() {
    delete this._tweenInfo;
  }
  onUpdate() {
    if (this._tweenInfo) {
      this._updateTintTween();
    }
  }
  onEnable() {
    this._isHovering = false;
    this._hoveringCounter = 0;
    this._isPressed = false;
    this._imageReference.onParentComponentEnable();
    this._toggleHitElementListeners('on');
    this._forceReapplyVisualState();
  }
  onDisable() {
    this._toggleHitElementListeners('off');
    this._resetToDefaultVisualState(this.transitionMode);
  }
  onRemove() {
    this._toggleLifecycleListeners('off', this.system);
    this.onDisable();
  }
}
function toColor3(color4) {
  return new Color(color4.r, color4.g, color4.b);
}

export { ButtonComponent };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYnV0dG9uL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi8uLi9jb3JlL3RpbWUuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHlSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi91dGlscy9lbnRpdHktcmVmZXJlbmNlLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHsgQlVUVE9OX1RSQU5TSVRJT05fTU9ERV9TUFJJVEVfQ0hBTkdFLCBCVVRUT05fVFJBTlNJVElPTl9NT0RFX1RJTlQgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBFTEVNRU5UVFlQRV9HUk9VUCB9IGZyb20gJy4uL2VsZW1lbnQvY29uc3RhbnRzLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4uLy4uL2Fzc2V0L2Fzc2V0LmpzJykuQXNzZXR9IEFzc2V0ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vLi4vY29yZS9tYXRoL3ZlYzQuanMnKS5WZWM0fSBWZWM0ICovXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBFbnRpdHkgKi9cbi8qKiBAdHlwZWRlZiB7aW1wb3J0KCcuL3N5c3RlbS5qcycpLkJ1dHRvbkNvbXBvbmVudFN5c3RlbX0gQnV0dG9uQ29tcG9uZW50U3lzdGVtICovXG5cbmNvbnN0IFZpc3VhbFN0YXRlID0ge1xuICAgIERFRkFVTFQ6ICdERUZBVUxUJyxcbiAgICBIT1ZFUjogJ0hPVkVSJyxcbiAgICBQUkVTU0VEOiAnUFJFU1NFRCcsXG4gICAgSU5BQ1RJVkU6ICdJTkFDVElWRSdcbn07XG5cbmNvbnN0IFNUQVRFU19UT19USU5UX05BTUVTID0ge307XG5TVEFURVNfVE9fVElOVF9OQU1FU1tWaXN1YWxTdGF0ZS5ERUZBVUxUXSA9ICdfZGVmYXVsdFRpbnQnO1xuU1RBVEVTX1RPX1RJTlRfTkFNRVNbVmlzdWFsU3RhdGUuSE9WRVJdID0gJ2hvdmVyVGludCc7XG5TVEFURVNfVE9fVElOVF9OQU1FU1tWaXN1YWxTdGF0ZS5QUkVTU0VEXSA9ICdwcmVzc2VkVGludCc7XG5TVEFURVNfVE9fVElOVF9OQU1FU1tWaXN1YWxTdGF0ZS5JTkFDVElWRV0gPSAnaW5hY3RpdmVUaW50JztcblxuY29uc3QgU1RBVEVTX1RPX1NQUklURV9BU1NFVF9OQU1FUyA9IHt9O1xuU1RBVEVTX1RPX1NQUklURV9BU1NFVF9OQU1FU1tWaXN1YWxTdGF0ZS5ERUZBVUxUXSA9ICdfZGVmYXVsdFNwcml0ZUFzc2V0JztcblNUQVRFU19UT19TUFJJVEVfQVNTRVRfTkFNRVNbVmlzdWFsU3RhdGUuSE9WRVJdID0gJ2hvdmVyU3ByaXRlQXNzZXQnO1xuU1RBVEVTX1RPX1NQUklURV9BU1NFVF9OQU1FU1tWaXN1YWxTdGF0ZS5QUkVTU0VEXSA9ICdwcmVzc2VkU3ByaXRlQXNzZXQnO1xuU1RBVEVTX1RPX1NQUklURV9BU1NFVF9OQU1FU1tWaXN1YWxTdGF0ZS5JTkFDVElWRV0gPSAnaW5hY3RpdmVTcHJpdGVBc3NldCc7XG5cbmNvbnN0IFNUQVRFU19UT19TUFJJVEVfRlJBTUVfTkFNRVMgPSB7fTtcblNUQVRFU19UT19TUFJJVEVfRlJBTUVfTkFNRVNbVmlzdWFsU3RhdGUuREVGQVVMVF0gPSAnX2RlZmF1bHRTcHJpdGVGcmFtZSc7XG5TVEFURVNfVE9fU1BSSVRFX0ZSQU1FX05BTUVTW1Zpc3VhbFN0YXRlLkhPVkVSXSA9ICdob3ZlclNwcml0ZUZyYW1lJztcblNUQVRFU19UT19TUFJJVEVfRlJBTUVfTkFNRVNbVmlzdWFsU3RhdGUuUFJFU1NFRF0gPSAncHJlc3NlZFNwcml0ZUZyYW1lJztcblNUQVRFU19UT19TUFJJVEVfRlJBTUVfTkFNRVNbVmlzdWFsU3RhdGUuSU5BQ1RJVkVdID0gJ2luYWN0aXZlU3ByaXRlRnJhbWUnO1xuXG4vKipcbiAqIEEgQnV0dG9uQ29tcG9uZW50IGVuYWJsZXMgYSBncm91cCBvZiBlbnRpdGllcyB0byBiZWhhdmUgbGlrZSBhIGJ1dHRvbiwgd2l0aCBkaWZmZXJlbnQgdmlzdWFsXG4gKiBzdGF0ZXMgZm9yIGhvdmVyIGFuZCBwcmVzcyBpbnRlcmFjdGlvbnMuXG4gKlxuICogQHByb3BlcnR5IHtib29sZWFufSBhY3RpdmUgSWYgc2V0IHRvIGZhbHNlLCB0aGUgYnV0dG9uIHdpbGwgYmUgdmlzaWJsZSBidXQgd2lsbCBub3QgcmVzcG9uZCB0byBob3ZlciBvciB0b3VjaCBpbnRlcmFjdGlvbnMuXG4gKiBAcHJvcGVydHkge0VudGl0eX0gaW1hZ2VFbnRpdHkgQSByZWZlcmVuY2UgdG8gdGhlIGVudGl0eSB0byBiZSB1c2VkIGFzIHRoZSBidXR0b24gYmFja2dyb3VuZC4gVGhlIGVudGl0eSBtdXN0IGhhdmUgYW4gSW1hZ2VFbGVtZW50IGNvbXBvbmVudC5cbiAqIEBwcm9wZXJ0eSB7VmVjNH0gaGl0UGFkZGluZyBQYWRkaW5nIHRvIGJlIHVzZWQgaW4gaGl0LXRlc3QgY2FsY3VsYXRpb25zLiBDYW4gYmUgdXNlZCB0byBleHBhbmQgdGhlIGJvdW5kaW5nIGJveCBzbyB0aGF0IHRoZSBidXR0b24gaXMgZWFzaWVyIHRvIHRhcC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSB0cmFuc2l0aW9uTW9kZSBDb250cm9scyBob3cgdGhlIGJ1dHRvbiByZXNwb25kcyB3aGVuIHRoZSB1c2VyIGhvdmVycyBvdmVyIGl0L3ByZXNzZXMgaXQuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBob3ZlclRpbnQgQ29sb3IgdG8gYmUgdXNlZCBvbiB0aGUgYnV0dG9uIGltYWdlIHdoZW4gdGhlIHVzZXIgaG92ZXJzIG92ZXIgaXQuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBwcmVzc2VkVGludCBDb2xvciB0byBiZSB1c2VkIG9uIHRoZSBidXR0b24gaW1hZ2Ugd2hlbiB0aGUgdXNlciBwcmVzc2VzIGl0LlxuICogQHByb3BlcnR5IHtDb2xvcn0gaW5hY3RpdmVUaW50IENvbG9yIHRvIGJlIHVzZWQgb24gdGhlIGJ1dHRvbiBpbWFnZSB3aGVuIHRoZSBidXR0b24gaXMgbm90IGludGVyYWN0aXZlLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGZhZGVEdXJhdGlvbiBEdXJhdGlvbiB0byBiZSB1c2VkIHdoZW4gZmFkaW5nIGJldHdlZW4gdGludHMsIGluIG1pbGxpc2Vjb25kcy5cbiAqIEBwcm9wZXJ0eSB7QXNzZXR9IGhvdmVyU3ByaXRlQXNzZXQgU3ByaXRlIHRvIGJlIHVzZWQgYXMgdGhlIGJ1dHRvbiBpbWFnZSB3aGVuIHRoZSB1c2VyIGhvdmVycyBvdmVyIGl0LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGhvdmVyU3ByaXRlRnJhbWUgRnJhbWUgdG8gYmUgdXNlZCBmcm9tIHRoZSBob3ZlciBzcHJpdGUuXG4gKiBAcHJvcGVydHkge0Fzc2V0fSBwcmVzc2VkU3ByaXRlQXNzZXQgU3ByaXRlIHRvIGJlIHVzZWQgYXMgdGhlIGJ1dHRvbiBpbWFnZSB3aGVuIHRoZSB1c2VyIHByZXNzZXMgaXQuXG4gKiBAcHJvcGVydHkge251bWJlcn0gcHJlc3NlZFNwcml0ZUZyYW1lIEZyYW1lIHRvIGJlIHVzZWQgZnJvbSB0aGUgcHJlc3NlZCBzcHJpdGUuXG4gKiBAcHJvcGVydHkge0Fzc2V0fSBpbmFjdGl2ZVNwcml0ZUFzc2V0IFNwcml0ZSB0byBiZSB1c2VkIGFzIHRoZSBidXR0b24gaW1hZ2Ugd2hlbiB0aGUgYnV0dG9uIGlzIG5vdCBpbnRlcmFjdGl2ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBpbmFjdGl2ZVNwcml0ZUZyYW1lIEZyYW1lIHRvIGJlIHVzZWQgZnJvbSB0aGUgaW5hY3RpdmUgc3ByaXRlLlxuICogQGF1Z21lbnRzIENvbXBvbmVudFxuICovXG5jbGFzcyBCdXR0b25Db21wb25lbnQgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBCdXR0b25Db21wb25lbnQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0J1dHRvbkNvbXBvbmVudFN5c3RlbX0gc3lzdGVtIC0gVGhlIENvbXBvbmVudFN5c3RlbSB0aGF0IGNyZWF0ZWQgdGhpcyBDb21wb25lbnQuXG4gICAgICogQHBhcmFtIHtFbnRpdHl9IGVudGl0eSAtIFRoZSBFbnRpdHkgdGhhdCB0aGlzIENvbXBvbmVudCBpcyBhdHRhY2hlZCB0by5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihzeXN0ZW0sIGVudGl0eSkge1xuICAgICAgICBzdXBlcihzeXN0ZW0sIGVudGl0eSk7XG5cbiAgICAgICAgdGhpcy5fdmlzdWFsU3RhdGUgPSBWaXN1YWxTdGF0ZS5ERUZBVUxUO1xuICAgICAgICB0aGlzLl9pc0hvdmVyaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2hvdmVyaW5nQ291bnRlciA9IDA7XG4gICAgICAgIHRoaXMuX2lzUHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2RlZmF1bHRUaW50ID0gbmV3IENvbG9yKDEsIDEsIDEsIDEpO1xuICAgICAgICB0aGlzLl9kZWZhdWx0U3ByaXRlQXNzZXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9kZWZhdWx0U3ByaXRlRnJhbWUgPSAwO1xuXG4gICAgICAgIHRoaXMuX2ltYWdlUmVmZXJlbmNlID0gbmV3IEVudGl0eVJlZmVyZW5jZSh0aGlzLCAnaW1hZ2VFbnRpdHknLCB7XG4gICAgICAgICAgICAnZWxlbWVudCNnYWluJzogdGhpcy5fb25JbWFnZUVsZW1lbnRHYWluLFxuICAgICAgICAgICAgJ2VsZW1lbnQjbG9zZSc6IHRoaXMuX29uSW1hZ2VFbGVtZW50TG9zZSxcbiAgICAgICAgICAgICdlbGVtZW50I3NldDpjb2xvcic6IHRoaXMuX29uU2V0Q29sb3IsXG4gICAgICAgICAgICAnZWxlbWVudCNzZXQ6b3BhY2l0eSc6IHRoaXMuX29uU2V0T3BhY2l0eSxcbiAgICAgICAgICAgICdlbGVtZW50I3NldDpzcHJpdGVBc3NldCc6IHRoaXMuX29uU2V0U3ByaXRlQXNzZXQsXG4gICAgICAgICAgICAnZWxlbWVudCNzZXQ6c3ByaXRlRnJhbWUnOiB0aGlzLl9vblNldFNwcml0ZUZyYW1lXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuX3RvZ2dsZUxpZmVjeWNsZUxpc3RlbmVycygnb24nLCBzeXN0ZW0pO1xuICAgIH1cblxuICAgIF90b2dnbGVMaWZlY3ljbGVMaXN0ZW5lcnMob25Pck9mZiwgc3lzdGVtKSB7XG4gICAgICAgIHRoaXNbb25Pck9mZl0oJ3NldF9hY3RpdmUnLCB0aGlzLl9vblNldEFjdGl2ZSwgdGhpcyk7XG4gICAgICAgIHRoaXNbb25Pck9mZl0oJ3NldF90cmFuc2l0aW9uTW9kZScsIHRoaXMuX29uU2V0VHJhbnNpdGlvbk1vZGUsIHRoaXMpO1xuICAgICAgICB0aGlzW29uT3JPZmZdKCdzZXRfaG92ZXJUaW50JywgdGhpcy5fb25TZXRUcmFuc2l0aW9uVmFsdWUsIHRoaXMpO1xuICAgICAgICB0aGlzW29uT3JPZmZdKCdzZXRfcHJlc3NlZFRpbnQnLCB0aGlzLl9vblNldFRyYW5zaXRpb25WYWx1ZSwgdGhpcyk7XG4gICAgICAgIHRoaXNbb25Pck9mZl0oJ3NldF9pbmFjdGl2ZVRpbnQnLCB0aGlzLl9vblNldFRyYW5zaXRpb25WYWx1ZSwgdGhpcyk7XG4gICAgICAgIHRoaXNbb25Pck9mZl0oJ3NldF9ob3ZlclNwcml0ZUFzc2V0JywgdGhpcy5fb25TZXRUcmFuc2l0aW9uVmFsdWUsIHRoaXMpO1xuICAgICAgICB0aGlzW29uT3JPZmZdKCdzZXRfaG92ZXJTcHJpdGVGcmFtZScsIHRoaXMuX29uU2V0VHJhbnNpdGlvblZhbHVlLCB0aGlzKTtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X3ByZXNzZWRTcHJpdGVBc3NldCcsIHRoaXMuX29uU2V0VHJhbnNpdGlvblZhbHVlLCB0aGlzKTtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X3ByZXNzZWRTcHJpdGVGcmFtZScsIHRoaXMuX29uU2V0VHJhbnNpdGlvblZhbHVlLCB0aGlzKTtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X2luYWN0aXZlU3ByaXRlQXNzZXQnLCB0aGlzLl9vblNldFRyYW5zaXRpb25WYWx1ZSwgdGhpcyk7XG4gICAgICAgIHRoaXNbb25Pck9mZl0oJ3NldF9pbmFjdGl2ZVNwcml0ZUZyYW1lJywgdGhpcy5fb25TZXRUcmFuc2l0aW9uVmFsdWUsIHRoaXMpO1xuXG4gICAgICAgIHN5c3RlbS5hcHAuc3lzdGVtcy5lbGVtZW50W29uT3JPZmZdKCdhZGQnLCB0aGlzLl9vbkVsZW1lbnRDb21wb25lbnRBZGQsIHRoaXMpO1xuICAgICAgICBzeXN0ZW0uYXBwLnN5c3RlbXMuZWxlbWVudFtvbk9yT2ZmXSgnYmVmb3JlcmVtb3ZlJywgdGhpcy5fb25FbGVtZW50Q29tcG9uZW50UmVtb3ZlLCB0aGlzKTtcbiAgICB9XG5cbiAgICBfb25TZXRBY3RpdmUobmFtZSwgb2xkVmFsdWUsIG5ld1ZhbHVlKSB7XG4gICAgICAgIGlmIChvbGRWYWx1ZSAhPT0gbmV3VmFsdWUpIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVZpc3VhbFN0YXRlKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25TZXRUcmFuc2l0aW9uTW9kZShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKG9sZFZhbHVlICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fY2FuY2VsVHdlZW4oKTtcbiAgICAgICAgICAgIHRoaXMuX3Jlc2V0VG9EZWZhdWx0VmlzdWFsU3RhdGUob2xkVmFsdWUpO1xuICAgICAgICAgICAgdGhpcy5fZm9yY2VSZWFwcGx5VmlzdWFsU3RhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNldFRyYW5zaXRpb25WYWx1ZShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKG9sZFZhbHVlICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fZm9yY2VSZWFwcGx5VmlzdWFsU3RhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkVsZW1lbnRDb21wb25lbnRSZW1vdmUoZW50aXR5KSB7XG4gICAgICAgIGlmICh0aGlzLmVudGl0eSA9PT0gZW50aXR5KSB7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVIaXRFbGVtZW50TGlzdGVuZXJzKCdvZmYnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbkVsZW1lbnRDb21wb25lbnRBZGQoZW50aXR5KSB7XG4gICAgICAgIGlmICh0aGlzLmVudGl0eSA9PT0gZW50aXR5KSB7XG4gICAgICAgICAgICB0aGlzLl90b2dnbGVIaXRFbGVtZW50TGlzdGVuZXJzKCdvbicpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uSW1hZ2VFbGVtZW50TG9zZSgpIHtcbiAgICAgICAgdGhpcy5fY2FuY2VsVHdlZW4oKTtcbiAgICAgICAgdGhpcy5fcmVzZXRUb0RlZmF1bHRWaXN1YWxTdGF0ZSh0aGlzLnRyYW5zaXRpb25Nb2RlKTtcbiAgICB9XG5cbiAgICBfb25JbWFnZUVsZW1lbnRHYWluKCkge1xuICAgICAgICB0aGlzLl9zdG9yZURlZmF1bHRWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB0aGlzLl9mb3JjZVJlYXBwbHlWaXN1YWxTdGF0ZSgpO1xuICAgIH1cblxuICAgIF90b2dnbGVIaXRFbGVtZW50TGlzdGVuZXJzKG9uT3JPZmYpIHtcbiAgICAgICAgaWYgKHRoaXMuZW50aXR5LmVsZW1lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGlzQWRkaW5nID0gKG9uT3JPZmYgPT09ICdvbicpO1xuXG4gICAgICAgICAgICAvLyBQcmV2ZW50IGR1cGxpY2F0ZSBsaXN0ZW5lcnNcbiAgICAgICAgICAgIGlmIChpc0FkZGluZyAmJiB0aGlzLl9oYXNIaXRFbGVtZW50TGlzdGVuZXJzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCdtb3VzZWVudGVyJywgdGhpcy5fb25Nb3VzZUVudGVyLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LmVsZW1lbnRbb25Pck9mZl0oJ21vdXNlbGVhdmUnLCB0aGlzLl9vbk1vdXNlTGVhdmUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuZWxlbWVudFtvbk9yT2ZmXSgnbW91c2Vkb3duJywgdGhpcy5fb25Nb3VzZURvd24sIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuZWxlbWVudFtvbk9yT2ZmXSgnbW91c2V1cCcsIHRoaXMuX29uTW91c2VVcCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCd0b3VjaHN0YXJ0JywgdGhpcy5fb25Ub3VjaFN0YXJ0LCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LmVsZW1lbnRbb25Pck9mZl0oJ3RvdWNoZW5kJywgdGhpcy5fb25Ub3VjaEVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCd0b3VjaGxlYXZlJywgdGhpcy5fb25Ub3VjaExlYXZlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LmVsZW1lbnRbb25Pck9mZl0oJ3RvdWNoY2FuY2VsJywgdGhpcy5fb25Ub3VjaENhbmNlbCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCdzZWxlY3RzdGFydCcsIHRoaXMuX29uU2VsZWN0U3RhcnQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuZWxlbWVudFtvbk9yT2ZmXSgnc2VsZWN0ZW5kJywgdGhpcy5fb25TZWxlY3RFbmQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuZWxlbWVudFtvbk9yT2ZmXSgnc2VsZWN0ZW50ZXInLCB0aGlzLl9vblNlbGVjdEVudGVyLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LmVsZW1lbnRbb25Pck9mZl0oJ3NlbGVjdGxlYXZlJywgdGhpcy5fb25TZWxlY3RMZWF2ZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCdjbGljaycsIHRoaXMuX29uQ2xpY2ssIHRoaXMpO1xuXG4gICAgICAgICAgICB0aGlzLl9oYXNIaXRFbGVtZW50TGlzdGVuZXJzID0gaXNBZGRpbmc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc3RvcmVEZWZhdWx0VmlzdWFsU3RhdGUoKSB7XG4gICAgICAgIC8vIElmIHRoZSBlbGVtZW50IGlzIG9mIGdyb3VwIHR5cGUsIGFsbCBpdCdzIHZpc3VhbCBwcm9wZXJ0aWVzIGFyZSBudWxsXG4gICAgICAgIGlmICh0aGlzLl9pbWFnZVJlZmVyZW5jZS5oYXNDb21wb25lbnQoJ2VsZW1lbnQnKSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IHRoaXMuX2ltYWdlUmVmZXJlbmNlLmVudGl0eS5lbGVtZW50O1xuICAgICAgICAgICAgaWYgKGVsZW1lbnQudHlwZSAhPT0gRUxFTUVOVFRZUEVfR1JPVVApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdG9yZURlZmF1bHRDb2xvcihlbGVtZW50LmNvbG9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdG9yZURlZmF1bHRPcGFjaXR5KGVsZW1lbnQub3BhY2l0eSk7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3RvcmVEZWZhdWx0U3ByaXRlQXNzZXQoZWxlbWVudC5zcHJpdGVBc3NldCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fc3RvcmVEZWZhdWx0U3ByaXRlRnJhbWUoZWxlbWVudC5zcHJpdGVGcmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfc3RvcmVEZWZhdWx0Q29sb3IoY29sb3IpIHtcbiAgICAgICAgdGhpcy5fZGVmYXVsdFRpbnQuciA9IGNvbG9yLnI7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRUaW50LmcgPSBjb2xvci5nO1xuICAgICAgICB0aGlzLl9kZWZhdWx0VGludC5iID0gY29sb3IuYjtcbiAgICB9XG5cbiAgICBfc3RvcmVEZWZhdWx0T3BhY2l0eShvcGFjaXR5KSB7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRUaW50LmEgPSBvcGFjaXR5O1xuICAgIH1cblxuICAgIF9zdG9yZURlZmF1bHRTcHJpdGVBc3NldChzcHJpdGVBc3NldCkge1xuICAgICAgICB0aGlzLl9kZWZhdWx0U3ByaXRlQXNzZXQgPSBzcHJpdGVBc3NldDtcbiAgICB9XG5cbiAgICBfc3RvcmVEZWZhdWx0U3ByaXRlRnJhbWUoc3ByaXRlRnJhbWUpIHtcbiAgICAgICAgdGhpcy5fZGVmYXVsdFNwcml0ZUZyYW1lID0gc3ByaXRlRnJhbWU7XG4gICAgfVxuXG4gICAgX29uU2V0Q29sb3IoY29sb3IpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9pc0FwcGx5aW5nVGludCkge1xuICAgICAgICAgICAgdGhpcy5fc3RvcmVEZWZhdWx0Q29sb3IoY29sb3IpO1xuICAgICAgICAgICAgdGhpcy5fZm9yY2VSZWFwcGx5VmlzdWFsU3RhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNldE9wYWNpdHkob3BhY2l0eSkge1xuICAgICAgICBpZiAoIXRoaXMuX2lzQXBwbHlpbmdUaW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zdG9yZURlZmF1bHRPcGFjaXR5KG9wYWNpdHkpO1xuICAgICAgICAgICAgdGhpcy5fZm9yY2VSZWFwcGx5VmlzdWFsU3RhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNldFNwcml0ZUFzc2V0KHNwcml0ZUFzc2V0KSB7XG4gICAgICAgIGlmICghdGhpcy5faXNBcHBseWluZ1Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3RvcmVEZWZhdWx0U3ByaXRlQXNzZXQoc3ByaXRlQXNzZXQpO1xuICAgICAgICAgICAgdGhpcy5fZm9yY2VSZWFwcGx5VmlzdWFsU3RhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNldFNwcml0ZUZyYW1lKHNwcml0ZUZyYW1lKSB7XG4gICAgICAgIGlmICghdGhpcy5faXNBcHBseWluZ1Nwcml0ZSkge1xuICAgICAgICAgICAgdGhpcy5fc3RvcmVEZWZhdWx0U3ByaXRlRnJhbWUoc3ByaXRlRnJhbWUpO1xuICAgICAgICAgICAgdGhpcy5fZm9yY2VSZWFwcGx5VmlzdWFsU3RhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vbk1vdXNlRW50ZXIoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5faXNIb3ZlcmluZyA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVmlzdWFsU3RhdGUoKTtcbiAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCdtb3VzZWVudGVyJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9vbk1vdXNlTGVhdmUoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5faXNIb3ZlcmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1ByZXNzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ21vdXNlbGVhdmUnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uTW91c2VEb3duKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuX2lzUHJlc3NlZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVmlzdWFsU3RhdGUoKTtcbiAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCdtb3VzZWRvd24nLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uTW91c2VVcChldmVudCkge1xuICAgICAgICB0aGlzLl9pc1ByZXNzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ21vdXNldXAnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uVG91Y2hTdGFydChldmVudCkge1xuICAgICAgICB0aGlzLl9pc1ByZXNzZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVZpc3VhbFN0YXRlKCk7XG4gICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgndG91Y2hzdGFydCcsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25Ub3VjaEVuZChldmVudCkge1xuICAgICAgICAvLyBUaGUgZGVmYXVsdCBiZWhhdmlvciBvZiB0aGUgYnJvd3NlciBpcyB0byBzaW11bGF0ZSBhIHNlcmllcyBvZlxuICAgICAgICAvLyBgbW91c2VlbnRlci9kb3duL3VwYCBldmVudHMgaW1tZWRpYXRlbHkgYWZ0ZXIgdGhlIGB0b3VjaGVuZGAgZXZlbnQsXG4gICAgICAgIC8vIGluIG9yZGVyIHRvIGVuc3VyZSB0aGF0IHdlYnNpdGVzIHRoYXQgZG9uJ3QgZXhwbGljaXRseSBsaXN0ZW4gZm9yXG4gICAgICAgIC8vIHRvdWNoIGV2ZW50cyB3aWxsIHN0aWxsIHdvcmsgb24gbW9iaWxlIChzZWUgaHR0cHM6Ly93d3cuaHRtbDVyb2Nrcy5jb20vZW4vbW9iaWxlL3RvdWNoYW5kbW91c2UvXG4gICAgICAgIC8vIGZvciByZWZlcmVuY2UpLiBUaGlzIGxlYWRzIHRvIGFuIGlzc3VlIHdoZXJlYnkgYnV0dG9ucyB3aWxsIGVudGVyXG4gICAgICAgIC8vIHRoZSBgaG92ZXJgIHN0YXRlIG9uIG1vYmlsZSBicm93c2VycyBhZnRlciB0aGUgYHRvdWNoZW5kYCBldmVudCBpc1xuICAgICAgICAvLyByZWNlaXZlZCwgaW5zdGVhZCBvZiBnb2luZyBiYWNrIHRvIHRoZSBgZGVmYXVsdGAgc3RhdGUuIENhbGxpbmdcbiAgICAgICAgLy8gcHJldmVudERlZmF1bHQoKSBoZXJlIGZpeGVzIHRoZSBpc3N1ZS5cbiAgICAgICAgZXZlbnQuZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICB0aGlzLl9pc1ByZXNzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ3RvdWNoZW5kJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9vblRvdWNoTGVhdmUoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5faXNQcmVzc2VkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVmlzdWFsU3RhdGUoKTtcbiAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCd0b3VjaGxlYXZlJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9vblRvdWNoQ2FuY2VsKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuX2lzUHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVZpc3VhbFN0YXRlKCk7XG4gICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgndG91Y2hjYW5jZWwnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uU2VsZWN0U3RhcnQoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5faXNQcmVzc2VkID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVmlzdWFsU3RhdGUoKTtcbiAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCdzZWxlY3RzdGFydCcsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25TZWxlY3RFbmQoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5faXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVZpc3VhbFN0YXRlKCk7XG4gICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgnc2VsZWN0ZW5kJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9vblNlbGVjdEVudGVyKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuX2hvdmVyaW5nQ291bnRlcisrO1xuXG4gICAgICAgIGlmICh0aGlzLl9ob3ZlcmluZ0NvdW50ZXIgPT09IDEpIHtcbiAgICAgICAgICAgIHRoaXMuX2lzSG92ZXJpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVmlzdWFsU3RhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgnc2VsZWN0ZW50ZXInLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uU2VsZWN0TGVhdmUoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5faG92ZXJpbmdDb3VudGVyLS07XG5cbiAgICAgICAgaWYgKHRoaXMuX2hvdmVyaW5nQ291bnRlciA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5faXNIb3ZlcmluZyA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5faXNQcmVzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCdzZWxlY3RsZWF2ZScsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25DbGljayhldmVudCkge1xuICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ2NsaWNrJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9maXJlSWZBY3RpdmUobmFtZSwgZXZlbnQpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5hY3RpdmUpIHtcbiAgICAgICAgICAgIHRoaXMuZmlyZShuYW1lLCBldmVudCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfdXBkYXRlVmlzdWFsU3RhdGUoZm9yY2UpIHtcbiAgICAgICAgY29uc3Qgb2xkVmlzdWFsU3RhdGUgPSB0aGlzLl92aXN1YWxTdGF0ZTtcbiAgICAgICAgY29uc3QgbmV3VmlzdWFsU3RhdGUgPSB0aGlzLl9kZXRlcm1pbmVWaXN1YWxTdGF0ZSgpO1xuXG4gICAgICAgIGlmICgob2xkVmlzdWFsU3RhdGUgIT09IG5ld1Zpc3VhbFN0YXRlIHx8IGZvcmNlKSAmJiB0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3Zpc3VhbFN0YXRlID0gbmV3VmlzdWFsU3RhdGU7XG5cbiAgICAgICAgICAgIGlmIChvbGRWaXN1YWxTdGF0ZSA9PT0gVmlzdWFsU3RhdGUuSE9WRVIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ2hvdmVyZW5kJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChvbGRWaXN1YWxTdGF0ZSA9PT0gVmlzdWFsU3RhdGUuUFJFU1NFRCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgncHJlc3NlZGVuZCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAobmV3VmlzdWFsU3RhdGUgPT09IFZpc3VhbFN0YXRlLkhPVkVSKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCdob3ZlcnN0YXJ0Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChuZXdWaXN1YWxTdGF0ZSA9PT0gVmlzdWFsU3RhdGUuUFJFU1NFRCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgncHJlc3NlZHN0YXJ0Jyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHN3aXRjaCAodGhpcy50cmFuc2l0aW9uTW9kZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgQlVUVE9OX1RSQU5TSVRJT05fTU9ERV9USU5UOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpbnROYW1lID0gU1RBVEVTX1RPX1RJTlRfTkFNRVNbdGhpcy5fdmlzdWFsU3RhdGVdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0aW50Q29sb3IgPSB0aGlzW3RpbnROYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYXBwbHlUaW50KHRpbnRDb2xvcik7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlIEJVVFRPTl9UUkFOU0lUSU9OX01PREVfU1BSSVRFX0NIQU5HRToge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzcHJpdGVBc3NldE5hbWUgPSBTVEFURVNfVE9fU1BSSVRFX0FTU0VUX05BTUVTW3RoaXMuX3Zpc3VhbFN0YXRlXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ByaXRlRnJhbWVOYW1lID0gU1RBVEVTX1RPX1NQUklURV9GUkFNRV9OQU1FU1t0aGlzLl92aXN1YWxTdGF0ZV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNwcml0ZUFzc2V0ID0gdGhpc1tzcHJpdGVBc3NldE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzcHJpdGVGcmFtZSA9IHRoaXNbc3ByaXRlRnJhbWVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYXBwbHlTcHJpdGUoc3ByaXRlQXNzZXQsIHNwcml0ZUZyYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ2FsbGVkIHdoZW4gYSBwcm9wZXJ0eSBjaGFuZ2VzIHRoYXQgbWVhbiB0aGUgdmlzdWFsIHN0YXRlIG11c3QgYmUgcmVhcHBsaWVkLFxuICAgIC8vIGV2ZW4gaWYgdGhlIHN0YXRlIGVudW0gaGFzIG5vdCBjaGFuZ2VkLiBFeGFtcGxlcyBvZiB0aGlzIGFyZSB3aGVuIHRoZSB0aW50XG4gICAgLy8gdmFsdWUgZm9yIG9uZSBvZiB0aGUgc3RhdGVzIGlzIGNoYW5nZWQgdmlhIHRoZSBlZGl0b3IuXG4gICAgX2ZvcmNlUmVhcHBseVZpc3VhbFN0YXRlKCkge1xuICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSh0cnVlKTtcbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgYmVmb3JlIHRoZSBpbWFnZSBlbnRpdHkgY2hhbmdlcywgaW4gb3JkZXIgdG8gcmVzdG9yZSB0aGUgcHJldmlvdXNcbiAgICAvLyBpbWFnZSBiYWNrIHRvIGl0cyBvcmlnaW5hbCB0aW50LiBOb3RlIHRoYXQgdGhpcyBoYXBwZW5zIGltbWVkaWF0ZWx5LCBpLmUuXG4gICAgLy8gd2l0aG91dCBhbnkgYW5pbWF0aW9uLlxuICAgIF9yZXNldFRvRGVmYXVsdFZpc3VhbFN0YXRlKHRyYW5zaXRpb25Nb2RlKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbWFnZVJlZmVyZW5jZS5oYXNDb21wb25lbnQoJ2VsZW1lbnQnKSkge1xuICAgICAgICAgICAgc3dpdGNoICh0cmFuc2l0aW9uTW9kZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgQlVUVE9OX1RSQU5TSVRJT05fTU9ERV9USU5UOlxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9jYW5jZWxUd2VlbigpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hcHBseVRpbnRJbW1lZGlhdGVseSh0aGlzLl9kZWZhdWx0VGludCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBCVVRUT05fVFJBTlNJVElPTl9NT0RFX1NQUklURV9DSEFOR0U6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FwcGx5U3ByaXRlKHRoaXMuX2RlZmF1bHRTcHJpdGVBc3NldCwgdGhpcy5fZGVmYXVsdFNwcml0ZUZyYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZGV0ZXJtaW5lVmlzdWFsU3RhdGUoKSB7XG4gICAgICAgIGlmICghdGhpcy5hY3RpdmUpIHtcbiAgICAgICAgICAgIHJldHVybiBWaXN1YWxTdGF0ZS5JTkFDVElWRTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLl9pc1ByZXNzZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBWaXN1YWxTdGF0ZS5QUkVTU0VEO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2lzSG92ZXJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBWaXN1YWxTdGF0ZS5IT1ZFUjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBWaXN1YWxTdGF0ZS5ERUZBVUxUO1xuICAgIH1cblxuICAgIF9hcHBseVNwcml0ZShzcHJpdGVBc3NldCwgc3ByaXRlRnJhbWUpIHtcbiAgICAgICAgc3ByaXRlRnJhbWUgPSBzcHJpdGVGcmFtZSB8fCAwO1xuXG4gICAgICAgIGlmICh0aGlzLl9pbWFnZVJlZmVyZW5jZS5oYXNDb21wb25lbnQoJ2VsZW1lbnQnKSkge1xuICAgICAgICAgICAgdGhpcy5faXNBcHBseWluZ1Nwcml0ZSA9IHRydWU7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5zcHJpdGVBc3NldCAhPT0gc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5zcHJpdGVBc3NldCA9IHNwcml0ZUFzc2V0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5faW1hZ2VSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQuc3ByaXRlRnJhbWUgIT09IHNwcml0ZUZyYW1lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1hZ2VSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQuc3ByaXRlRnJhbWUgPSBzcHJpdGVGcmFtZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5faXNBcHBseWluZ1Nwcml0ZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2FwcGx5VGludCh0aW50Q29sb3IpIHtcbiAgICAgICAgdGhpcy5fY2FuY2VsVHdlZW4oKTtcblxuICAgICAgICBpZiAodGhpcy5mYWRlRHVyYXRpb24gPT09IDApIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGx5VGludEltbWVkaWF0ZWx5KHRpbnRDb2xvcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLl9hcHBseVRpbnRXaXRoVHdlZW4odGludENvbG9yKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9hcHBseVRpbnRJbW1lZGlhdGVseSh0aW50Q29sb3IpIHtcbiAgICAgICAgaWYgKCF0aW50Q29sb3IgfHwgIXRoaXMuX2ltYWdlUmVmZXJlbmNlLmhhc0NvbXBvbmVudCgnZWxlbWVudCcpIHx8IHRoaXMuX2ltYWdlUmVmZXJlbmNlLmVudGl0eS5lbGVtZW50LnR5cGUgPT09IEVMRU1FTlRUWVBFX0dST1VQKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGNvbnN0IGNvbG9yMyA9IHRvQ29sb3IzKHRpbnRDb2xvcik7XG5cbiAgICAgICAgdGhpcy5faXNBcHBseWluZ1RpbnQgPSB0cnVlO1xuXG4gICAgICAgIGlmICghY29sb3IzLmVxdWFscyh0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5jb2xvcikpXG4gICAgICAgICAgICB0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5jb2xvciA9IGNvbG9yMztcblxuICAgICAgICBpZiAodGhpcy5faW1hZ2VSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQub3BhY2l0eSAhPT0gdGludENvbG9yLmEpXG4gICAgICAgICAgICB0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5vcGFjaXR5ID0gdGludENvbG9yLmE7XG5cbiAgICAgICAgdGhpcy5faXNBcHBseWluZ1RpbnQgPSBmYWxzZTtcbiAgICB9XG5cbiAgICBfYXBwbHlUaW50V2l0aFR3ZWVuKHRpbnRDb2xvcikge1xuICAgICAgICBpZiAoIXRpbnRDb2xvciB8fCAhdGhpcy5faW1hZ2VSZWZlcmVuY2UuaGFzQ29tcG9uZW50KCdlbGVtZW50JykgfHwgdGhpcy5faW1hZ2VSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQudHlwZSA9PT0gRUxFTUVOVFRZUEVfR1JPVVApXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY29sb3IzID0gdG9Db2xvcjModGludENvbG9yKTtcbiAgICAgICAgY29uc3QgY29sb3IgPSB0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5jb2xvcjtcbiAgICAgICAgY29uc3Qgb3BhY2l0eSA9IHRoaXMuX2ltYWdlUmVmZXJlbmNlLmVudGl0eS5lbGVtZW50Lm9wYWNpdHk7XG5cbiAgICAgICAgaWYgKGNvbG9yMy5lcXVhbHMoY29sb3IpICYmIHRpbnRDb2xvci5hID09PSBvcGFjaXR5KVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIHRoaXMuX3R3ZWVuSW5mbyA9IHtcbiAgICAgICAgICAgIHN0YXJ0VGltZTogbm93KCksXG4gICAgICAgICAgICBmcm9tOiBuZXcgQ29sb3IoY29sb3IuciwgY29sb3IuZywgY29sb3IuYiwgb3BhY2l0eSksXG4gICAgICAgICAgICB0bzogdGludENvbG9yLmNsb25lKCksXG4gICAgICAgICAgICBsZXJwQ29sb3I6IG5ldyBDb2xvcigpXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgX3VwZGF0ZVRpbnRUd2VlbigpIHtcbiAgICAgICAgY29uc3QgZWxhcHNlZFRpbWUgPSBub3coKSAtIHRoaXMuX3R3ZWVuSW5mby5zdGFydFRpbWU7XG4gICAgICAgIGxldCBlbGFwc2VkUHJvcG9ydGlvbiA9IHRoaXMuZmFkZUR1cmF0aW9uID09PSAwID8gMSA6IChlbGFwc2VkVGltZSAvIHRoaXMuZmFkZUR1cmF0aW9uKTtcbiAgICAgICAgZWxhcHNlZFByb3BvcnRpb24gPSBtYXRoLmNsYW1wKGVsYXBzZWRQcm9wb3J0aW9uLCAwLCAxKTtcblxuICAgICAgICBpZiAoTWF0aC5hYnMoZWxhcHNlZFByb3BvcnRpb24gLSAxKSA+IDFlLTUpIHtcbiAgICAgICAgICAgIGNvbnN0IGxlcnBDb2xvciA9IHRoaXMuX3R3ZWVuSW5mby5sZXJwQ29sb3I7XG4gICAgICAgICAgICBsZXJwQ29sb3IubGVycCh0aGlzLl90d2VlbkluZm8uZnJvbSwgdGhpcy5fdHdlZW5JbmZvLnRvLCBlbGFwc2VkUHJvcG9ydGlvbik7XG4gICAgICAgICAgICB0aGlzLl9hcHBseVRpbnRJbW1lZGlhdGVseShuZXcgQ29sb3IobGVycENvbG9yLnIsIGxlcnBDb2xvci5nLCBsZXJwQ29sb3IuYiwgbGVycENvbG9yLmEpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGx5VGludEltbWVkaWF0ZWx5KHRoaXMuX3R3ZWVuSW5mby50byk7XG4gICAgICAgICAgICB0aGlzLl9jYW5jZWxUd2VlbigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2NhbmNlbFR3ZWVuKCkge1xuICAgICAgICBkZWxldGUgdGhpcy5fdHdlZW5JbmZvO1xuICAgIH1cblxuICAgIG9uVXBkYXRlKCkge1xuICAgICAgICBpZiAodGhpcy5fdHdlZW5JbmZvKSB7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVUaW50VHdlZW4oKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG9uRW5hYmxlKCkge1xuICAgICAgICAvLyBSZXNldCBpbnB1dCBzdGF0ZVxuICAgICAgICB0aGlzLl9pc0hvdmVyaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2hvdmVyaW5nQ291bnRlciA9IDA7XG4gICAgICAgIHRoaXMuX2lzUHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX2ltYWdlUmVmZXJlbmNlLm9uUGFyZW50Q29tcG9uZW50RW5hYmxlKCk7XG4gICAgICAgIHRoaXMuX3RvZ2dsZUhpdEVsZW1lbnRMaXN0ZW5lcnMoJ29uJyk7XG4gICAgICAgIHRoaXMuX2ZvcmNlUmVhcHBseVZpc3VhbFN0YXRlKCk7XG4gICAgfVxuXG4gICAgb25EaXNhYmxlKCkge1xuICAgICAgICB0aGlzLl90b2dnbGVIaXRFbGVtZW50TGlzdGVuZXJzKCdvZmYnKTtcbiAgICAgICAgdGhpcy5fcmVzZXRUb0RlZmF1bHRWaXN1YWxTdGF0ZSh0aGlzLnRyYW5zaXRpb25Nb2RlKTtcbiAgICB9XG5cbiAgICBvblJlbW92ZSgpIHtcbiAgICAgICAgdGhpcy5fdG9nZ2xlTGlmZWN5Y2xlTGlzdGVuZXJzKCdvZmYnLCB0aGlzLnN5c3RlbSk7XG4gICAgICAgIHRoaXMub25EaXNhYmxlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0b0NvbG9yMyhjb2xvcjQpIHtcbiAgICByZXR1cm4gbmV3IENvbG9yKGNvbG9yNC5yLCBjb2xvcjQuZywgY29sb3I0LmIpO1xufVxuXG4vKipcbiAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGlzIHByZXNzZWQgd2hpbGUgdGhlIGN1cnNvciBpcyBvbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjbW91c2Vkb3duXG4gKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGlzIHJlbGVhc2VkIHdoaWxlIHRoZSBjdXJzb3IgaXMgb24gdGhlIGNvbXBvbmVudC5cbiAqXG4gKiBAZXZlbnQgQnV0dG9uQ29tcG9uZW50I21vdXNldXBcbiAqIEBwYXJhbSB7RWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiB0aGUgbW91c2UgY3Vyc29yIGVudGVycyB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjbW91c2VlbnRlclxuICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBjdXJzb3IgbGVhdmVzIHRoZSBjb21wb25lbnQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCNtb3VzZWxlYXZlXG4gKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGlzIHByZXNzZWQgYW5kIHJlbGVhc2VkIG9uIHRoZSBjb21wb25lbnQgb3Igd2hlbiBhIHRvdWNoIHN0YXJ0cyBhbmQgZW5kcyBvblxuICogdGhlIGNvbXBvbmVudC5cbiAqXG4gKiBAZXZlbnQgQnV0dG9uQ29tcG9uZW50I2NsaWNrXG4gKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fEVsZW1lbnRUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gYSB0b3VjaCBzdGFydHMgb24gdGhlIGNvbXBvbmVudC5cbiAqXG4gKiBAZXZlbnQgQnV0dG9uQ29tcG9uZW50I3RvdWNoc3RhcnRcbiAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiBhIHRvdWNoIGVuZHMgb24gdGhlIGNvbXBvbmVudC5cbiAqXG4gKiBAZXZlbnQgQnV0dG9uQ29tcG9uZW50I3RvdWNoZW5kXG4gKiBAcGFyYW0ge0VsZW1lbnRUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gYSB0b3VjaCBpcyBjYW5jZWxlZCBvbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjdG91Y2hjYW5jZWxcbiAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiBhIHRvdWNoIGxlYXZlcyB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjdG91Y2hsZWF2ZVxuICogQHBhcmFtIHtFbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIGEgeHIgc2VsZWN0IHN0YXJ0cyBvbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjc2VsZWN0c3RhcnRcbiAqIEBwYXJhbSB7RWxlbWVudFNlbGVjdEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gYSB4ciBzZWxlY3QgZW5kcyBvbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjc2VsZWN0ZW5kXG4gKiBAcGFyYW0ge0VsZW1lbnRTZWxlY3RFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIGEgeHIgc2VsZWN0IG5vdyBob3ZlcmluZyBvdmVyIHRoZSBjb21wb25lbnQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCNzZWxlY3RlbnRlclxuICogQHBhcmFtIHtFbGVtZW50U2VsZWN0RXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiBhIHhyIHNlbGVjdCBub3QgaG92ZXJpbmcgb3ZlciB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjc2VsZWN0bGVhdmVcbiAqIEBwYXJhbSB7RWxlbWVudFNlbGVjdEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gdGhlIGJ1dHRvbiBjaGFuZ2VzIHN0YXRlIHRvIGJlIGhvdmVyZWQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCNob3ZlcnN0YXJ0XG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIHRoZSBidXR0b24gY2hhbmdlcyBzdGF0ZSB0byBiZSBub3QgaG92ZXJlZC5cbiAqXG4gKiBAZXZlbnQgQnV0dG9uQ29tcG9uZW50I2hvdmVyZW5kXG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIHRoZSBidXR0b24gY2hhbmdlcyBzdGF0ZSB0byBiZSBwcmVzc2VkLlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjcHJlc3NlZHN0YXJ0XG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIHRoZSBidXR0b24gY2hhbmdlcyBzdGF0ZSB0byBiZSBub3QgcHJlc3NlZC5cbiAqXG4gKiBAZXZlbnQgQnV0dG9uQ29tcG9uZW50I3ByZXNzZWRlbmRcbiAqL1xuXG5leHBvcnQgeyBCdXR0b25Db21wb25lbnQgfTtcbiJdLCJuYW1lcyI6WyJWaXN1YWxTdGF0ZSIsIkRFRkFVTFQiLCJIT1ZFUiIsIlBSRVNTRUQiLCJJTkFDVElWRSIsIlNUQVRFU19UT19USU5UX05BTUVTIiwiU1RBVEVTX1RPX1NQUklURV9BU1NFVF9OQU1FUyIsIlNUQVRFU19UT19TUFJJVEVfRlJBTUVfTkFNRVMiLCJCdXR0b25Db21wb25lbnQiLCJDb21wb25lbnQiLCJjb25zdHJ1Y3RvciIsInN5c3RlbSIsImVudGl0eSIsIl92aXN1YWxTdGF0ZSIsIl9pc0hvdmVyaW5nIiwiX2hvdmVyaW5nQ291bnRlciIsIl9pc1ByZXNzZWQiLCJfZGVmYXVsdFRpbnQiLCJDb2xvciIsIl9kZWZhdWx0U3ByaXRlQXNzZXQiLCJfZGVmYXVsdFNwcml0ZUZyYW1lIiwiX2ltYWdlUmVmZXJlbmNlIiwiRW50aXR5UmVmZXJlbmNlIiwiX29uSW1hZ2VFbGVtZW50R2FpbiIsIl9vbkltYWdlRWxlbWVudExvc2UiLCJfb25TZXRDb2xvciIsIl9vblNldE9wYWNpdHkiLCJfb25TZXRTcHJpdGVBc3NldCIsIl9vblNldFNwcml0ZUZyYW1lIiwiX3RvZ2dsZUxpZmVjeWNsZUxpc3RlbmVycyIsIm9uT3JPZmYiLCJfb25TZXRBY3RpdmUiLCJfb25TZXRUcmFuc2l0aW9uTW9kZSIsIl9vblNldFRyYW5zaXRpb25WYWx1ZSIsImFwcCIsInN5c3RlbXMiLCJlbGVtZW50IiwiX29uRWxlbWVudENvbXBvbmVudEFkZCIsIl9vbkVsZW1lbnRDb21wb25lbnRSZW1vdmUiLCJuYW1lIiwib2xkVmFsdWUiLCJuZXdWYWx1ZSIsIl91cGRhdGVWaXN1YWxTdGF0ZSIsIl9jYW5jZWxUd2VlbiIsIl9yZXNldFRvRGVmYXVsdFZpc3VhbFN0YXRlIiwiX2ZvcmNlUmVhcHBseVZpc3VhbFN0YXRlIiwiX3RvZ2dsZUhpdEVsZW1lbnRMaXN0ZW5lcnMiLCJ0cmFuc2l0aW9uTW9kZSIsIl9zdG9yZURlZmF1bHRWaXN1YWxTdGF0ZSIsImlzQWRkaW5nIiwiX2hhc0hpdEVsZW1lbnRMaXN0ZW5lcnMiLCJfb25Nb3VzZUVudGVyIiwiX29uTW91c2VMZWF2ZSIsIl9vbk1vdXNlRG93biIsIl9vbk1vdXNlVXAiLCJfb25Ub3VjaFN0YXJ0IiwiX29uVG91Y2hFbmQiLCJfb25Ub3VjaExlYXZlIiwiX29uVG91Y2hDYW5jZWwiLCJfb25TZWxlY3RTdGFydCIsIl9vblNlbGVjdEVuZCIsIl9vblNlbGVjdEVudGVyIiwiX29uU2VsZWN0TGVhdmUiLCJfb25DbGljayIsImhhc0NvbXBvbmVudCIsInR5cGUiLCJFTEVNRU5UVFlQRV9HUk9VUCIsIl9zdG9yZURlZmF1bHRDb2xvciIsImNvbG9yIiwiX3N0b3JlRGVmYXVsdE9wYWNpdHkiLCJvcGFjaXR5IiwiX3N0b3JlRGVmYXVsdFNwcml0ZUFzc2V0Iiwic3ByaXRlQXNzZXQiLCJfc3RvcmVEZWZhdWx0U3ByaXRlRnJhbWUiLCJzcHJpdGVGcmFtZSIsInIiLCJnIiwiYiIsImEiLCJfaXNBcHBseWluZ1RpbnQiLCJfaXNBcHBseWluZ1Nwcml0ZSIsImV2ZW50IiwiX2ZpcmVJZkFjdGl2ZSIsInByZXZlbnREZWZhdWx0IiwiZGF0YSIsImFjdGl2ZSIsImZpcmUiLCJmb3JjZSIsIm9sZFZpc3VhbFN0YXRlIiwibmV3VmlzdWFsU3RhdGUiLCJfZGV0ZXJtaW5lVmlzdWFsU3RhdGUiLCJlbmFibGVkIiwiQlVUVE9OX1RSQU5TSVRJT05fTU9ERV9USU5UIiwidGludE5hbWUiLCJ0aW50Q29sb3IiLCJfYXBwbHlUaW50IiwiQlVUVE9OX1RSQU5TSVRJT05fTU9ERV9TUFJJVEVfQ0hBTkdFIiwic3ByaXRlQXNzZXROYW1lIiwic3ByaXRlRnJhbWVOYW1lIiwiX2FwcGx5U3ByaXRlIiwiX2FwcGx5VGludEltbWVkaWF0ZWx5IiwiZmFkZUR1cmF0aW9uIiwiX2FwcGx5VGludFdpdGhUd2VlbiIsImNvbG9yMyIsInRvQ29sb3IzIiwiZXF1YWxzIiwiX3R3ZWVuSW5mbyIsInN0YXJ0VGltZSIsIm5vdyIsImZyb20iLCJ0byIsImNsb25lIiwibGVycENvbG9yIiwiX3VwZGF0ZVRpbnRUd2VlbiIsImVsYXBzZWRUaW1lIiwiZWxhcHNlZFByb3BvcnRpb24iLCJtYXRoIiwiY2xhbXAiLCJNYXRoIiwiYWJzIiwibGVycCIsIm9uVXBkYXRlIiwib25FbmFibGUiLCJvblBhcmVudENvbXBvbmVudEVuYWJsZSIsIm9uRGlzYWJsZSIsIm9uUmVtb3ZlIiwiY29sb3I0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBaUJBLE1BQU1BLFdBQVcsR0FBRztBQUNoQkMsRUFBQUEsT0FBTyxFQUFFLFNBQVM7QUFDbEJDLEVBQUFBLEtBQUssRUFBRSxPQUFPO0FBQ2RDLEVBQUFBLE9BQU8sRUFBRSxTQUFTO0FBQ2xCQyxFQUFBQSxRQUFRLEVBQUUsVUFBQTtBQUNkLENBQUMsQ0FBQTtBQUVELE1BQU1DLG9CQUFvQixHQUFHLEVBQUUsQ0FBQTtBQUMvQkEsb0JBQW9CLENBQUNMLFdBQVcsQ0FBQ0MsT0FBTyxDQUFDLEdBQUcsY0FBYyxDQUFBO0FBQzFESSxvQkFBb0IsQ0FBQ0wsV0FBVyxDQUFDRSxLQUFLLENBQUMsR0FBRyxXQUFXLENBQUE7QUFDckRHLG9CQUFvQixDQUFDTCxXQUFXLENBQUNHLE9BQU8sQ0FBQyxHQUFHLGFBQWEsQ0FBQTtBQUN6REUsb0JBQW9CLENBQUNMLFdBQVcsQ0FBQ0ksUUFBUSxDQUFDLEdBQUcsY0FBYyxDQUFBO0FBRTNELE1BQU1FLDRCQUE0QixHQUFHLEVBQUUsQ0FBQTtBQUN2Q0EsNEJBQTRCLENBQUNOLFdBQVcsQ0FBQ0MsT0FBTyxDQUFDLEdBQUcscUJBQXFCLENBQUE7QUFDekVLLDRCQUE0QixDQUFDTixXQUFXLENBQUNFLEtBQUssQ0FBQyxHQUFHLGtCQUFrQixDQUFBO0FBQ3BFSSw0QkFBNEIsQ0FBQ04sV0FBVyxDQUFDRyxPQUFPLENBQUMsR0FBRyxvQkFB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
