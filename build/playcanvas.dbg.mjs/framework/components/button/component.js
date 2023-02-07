/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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

/**
 * A ButtonComponent enables a group of entities to behave like a button, with different visual
 * states for hover and press interactions.
 *
 * @property {boolean} active If set to false, the button will be visible but will not respond to
 * hover or touch interactions.
 * @property {import('../../entity.js').Entity} imageEntity A reference to the entity to be used as
 * the button background. The entity must have an ImageElement component.
 * @property {import('../../../core/math/vec4.js').Vec4} hitPadding Padding to be used in hit-test
 * calculations. Can be used to expand the bounding box so that the button is easier to tap.
 * @property {number} transitionMode Controls how the button responds when the user hovers over
 * it/presses it.
 * @property {Color} hoverTint Color to be used on the button image when the user hovers over it.
 * @property {Color} pressedTint Color to be used on the button image when the user presses it.
 * @property {Color} inactiveTint Color to be used on the button image when the button is not
 * interactive.
 * @property {number} fadeDuration Duration to be used when fading between tints, in milliseconds.
 * @property {import('../../asset/asset.js').Asset} hoverSpriteAsset Sprite to be used as the
 * button image when the user hovers over it.
 * @property {number} hoverSpriteFrame Frame to be used from the hover sprite.
 * @property {import('../../asset/asset.js').Asset} pressedSpriteAsset Sprite to be used as the
 * button image when the user presses it.
 * @property {number} pressedSpriteFrame Frame to be used from the pressed sprite.
 * @property {import('../../asset/asset.js').Asset} inactiveSpriteAsset Sprite to be used as the
 * button image when the button is not interactive.
 * @property {number} inactiveSpriteFrame Frame to be used from the inactive sprite.
 * @augments Component
 */
class ButtonComponent extends Component {
  /**
   * Create a new ButtonComponent instance.
   *
   * @param {import('./system.js').ButtonComponentSystem} system - The ComponentSystem that
   * created this component.
   * @param {import('../../entity.js').Entity} entity - The entity that this component is
   * attached to.
   */
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

      // Prevent duplicate listeners
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
    // If the element is of group type, all it's visual properties are null
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
    // The default behavior of the browser is to simulate a series of
    // `mouseenter/down/up` events immediately after the `touchend` event,
    // in order to ensure that websites that don't explicitly listen for
    // touch events will still work on mobile (see https://www.html5rocks.com/en/mobile/touchandmouse/
    // for reference). This leads to an issue whereby buttons will enter
    // the `hover` state on mobile browsers after the `touchend` event is
    // received, instead of going back to the `default` state. Calling
    // preventDefault() here fixes the issue.
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

  // Called when a property changes that mean the visual state must be reapplied,
  // even if the state enum has not changed. Examples of this are when the tint
  // value for one of the states is changed via the editor.
  _forceReapplyVisualState() {
    this._updateVisualState(true);
  }

  // Called before the image entity changes, in order to restore the previous
  // image back to its original tint. Note that this happens immediately, i.e.
  // without any animation.
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
    // Reset input state
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvYnV0dG9uL2NvbXBvbmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBub3cgfSBmcm9tICcuLi8uLi8uLi9jb3JlL3RpbWUuanMnO1xuXG5pbXBvcnQgeyBtYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9tYXRoL21hdGguanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9jb3JlL21hdGgvY29sb3IuanMnO1xuXG5pbXBvcnQgeyBFbnRpdHlSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi91dGlscy9lbnRpdHktcmVmZXJlbmNlLmpzJztcblxuaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50LmpzJztcblxuaW1wb3J0IHsgQlVUVE9OX1RSQU5TSVRJT05fTU9ERV9TUFJJVEVfQ0hBTkdFLCBCVVRUT05fVFJBTlNJVElPTl9NT0RFX1RJTlQgfSBmcm9tICcuL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBFTEVNRU5UVFlQRV9HUk9VUCB9IGZyb20gJy4uL2VsZW1lbnQvY29uc3RhbnRzLmpzJztcblxuY29uc3QgVmlzdWFsU3RhdGUgPSB7XG4gICAgREVGQVVMVDogJ0RFRkFVTFQnLFxuICAgIEhPVkVSOiAnSE9WRVInLFxuICAgIFBSRVNTRUQ6ICdQUkVTU0VEJyxcbiAgICBJTkFDVElWRTogJ0lOQUNUSVZFJ1xufTtcblxuY29uc3QgU1RBVEVTX1RPX1RJTlRfTkFNRVMgPSB7fTtcblNUQVRFU19UT19USU5UX05BTUVTW1Zpc3VhbFN0YXRlLkRFRkFVTFRdID0gJ19kZWZhdWx0VGludCc7XG5TVEFURVNfVE9fVElOVF9OQU1FU1tWaXN1YWxTdGF0ZS5IT1ZFUl0gPSAnaG92ZXJUaW50JztcblNUQVRFU19UT19USU5UX05BTUVTW1Zpc3VhbFN0YXRlLlBSRVNTRURdID0gJ3ByZXNzZWRUaW50JztcblNUQVRFU19UT19USU5UX05BTUVTW1Zpc3VhbFN0YXRlLklOQUNUSVZFXSA9ICdpbmFjdGl2ZVRpbnQnO1xuXG5jb25zdCBTVEFURVNfVE9fU1BSSVRFX0FTU0VUX05BTUVTID0ge307XG5TVEFURVNfVE9fU1BSSVRFX0FTU0VUX05BTUVTW1Zpc3VhbFN0YXRlLkRFRkFVTFRdID0gJ19kZWZhdWx0U3ByaXRlQXNzZXQnO1xuU1RBVEVTX1RPX1NQUklURV9BU1NFVF9OQU1FU1tWaXN1YWxTdGF0ZS5IT1ZFUl0gPSAnaG92ZXJTcHJpdGVBc3NldCc7XG5TVEFURVNfVE9fU1BSSVRFX0FTU0VUX05BTUVTW1Zpc3VhbFN0YXRlLlBSRVNTRURdID0gJ3ByZXNzZWRTcHJpdGVBc3NldCc7XG5TVEFURVNfVE9fU1BSSVRFX0FTU0VUX05BTUVTW1Zpc3VhbFN0YXRlLklOQUNUSVZFXSA9ICdpbmFjdGl2ZVNwcml0ZUFzc2V0JztcblxuY29uc3QgU1RBVEVTX1RPX1NQUklURV9GUkFNRV9OQU1FUyA9IHt9O1xuU1RBVEVTX1RPX1NQUklURV9GUkFNRV9OQU1FU1tWaXN1YWxTdGF0ZS5ERUZBVUxUXSA9ICdfZGVmYXVsdFNwcml0ZUZyYW1lJztcblNUQVRFU19UT19TUFJJVEVfRlJBTUVfTkFNRVNbVmlzdWFsU3RhdGUuSE9WRVJdID0gJ2hvdmVyU3ByaXRlRnJhbWUnO1xuU1RBVEVTX1RPX1NQUklURV9GUkFNRV9OQU1FU1tWaXN1YWxTdGF0ZS5QUkVTU0VEXSA9ICdwcmVzc2VkU3ByaXRlRnJhbWUnO1xuU1RBVEVTX1RPX1NQUklURV9GUkFNRV9OQU1FU1tWaXN1YWxTdGF0ZS5JTkFDVElWRV0gPSAnaW5hY3RpdmVTcHJpdGVGcmFtZSc7XG5cbi8qKlxuICogQSBCdXR0b25Db21wb25lbnQgZW5hYmxlcyBhIGdyb3VwIG9mIGVudGl0aWVzIHRvIGJlaGF2ZSBsaWtlIGEgYnV0dG9uLCB3aXRoIGRpZmZlcmVudCB2aXN1YWxcbiAqIHN0YXRlcyBmb3IgaG92ZXIgYW5kIHByZXNzIGludGVyYWN0aW9ucy5cbiAqXG4gKiBAcHJvcGVydHkge2Jvb2xlYW59IGFjdGl2ZSBJZiBzZXQgdG8gZmFsc2UsIHRoZSBidXR0b24gd2lsbCBiZSB2aXNpYmxlIGJ1dCB3aWxsIG5vdCByZXNwb25kIHRvXG4gKiBob3ZlciBvciB0b3VjaCBpbnRlcmFjdGlvbnMuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vZW50aXR5LmpzJykuRW50aXR5fSBpbWFnZUVudGl0eSBBIHJlZmVyZW5jZSB0byB0aGUgZW50aXR5IHRvIGJlIHVzZWQgYXNcbiAqIHRoZSBidXR0b24gYmFja2dyb3VuZC4gVGhlIGVudGl0eSBtdXN0IGhhdmUgYW4gSW1hZ2VFbGVtZW50IGNvbXBvbmVudC5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi8uLi9jb3JlL21hdGgvdmVjNC5qcycpLlZlYzR9IGhpdFBhZGRpbmcgUGFkZGluZyB0byBiZSB1c2VkIGluIGhpdC10ZXN0XG4gKiBjYWxjdWxhdGlvbnMuIENhbiBiZSB1c2VkIHRvIGV4cGFuZCB0aGUgYm91bmRpbmcgYm94IHNvIHRoYXQgdGhlIGJ1dHRvbiBpcyBlYXNpZXIgdG8gdGFwLlxuICogQHByb3BlcnR5IHtudW1iZXJ9IHRyYW5zaXRpb25Nb2RlIENvbnRyb2xzIGhvdyB0aGUgYnV0dG9uIHJlc3BvbmRzIHdoZW4gdGhlIHVzZXIgaG92ZXJzIG92ZXJcbiAqIGl0L3ByZXNzZXMgaXQuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBob3ZlclRpbnQgQ29sb3IgdG8gYmUgdXNlZCBvbiB0aGUgYnV0dG9uIGltYWdlIHdoZW4gdGhlIHVzZXIgaG92ZXJzIG92ZXIgaXQuXG4gKiBAcHJvcGVydHkge0NvbG9yfSBwcmVzc2VkVGludCBDb2xvciB0byBiZSB1c2VkIG9uIHRoZSBidXR0b24gaW1hZ2Ugd2hlbiB0aGUgdXNlciBwcmVzc2VzIGl0LlxuICogQHByb3BlcnR5IHtDb2xvcn0gaW5hY3RpdmVUaW50IENvbG9yIHRvIGJlIHVzZWQgb24gdGhlIGJ1dHRvbiBpbWFnZSB3aGVuIHRoZSBidXR0b24gaXMgbm90XG4gKiBpbnRlcmFjdGl2ZS5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBmYWRlRHVyYXRpb24gRHVyYXRpb24gdG8gYmUgdXNlZCB3aGVuIGZhZGluZyBiZXR3ZWVuIHRpbnRzLCBpbiBtaWxsaXNlY29uZHMuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH0gaG92ZXJTcHJpdGVBc3NldCBTcHJpdGUgdG8gYmUgdXNlZCBhcyB0aGVcbiAqIGJ1dHRvbiBpbWFnZSB3aGVuIHRoZSB1c2VyIGhvdmVycyBvdmVyIGl0LlxuICogQHByb3BlcnR5IHtudW1iZXJ9IGhvdmVyU3ByaXRlRnJhbWUgRnJhbWUgdG8gYmUgdXNlZCBmcm9tIHRoZSBob3ZlciBzcHJpdGUuXG4gKiBAcHJvcGVydHkge2ltcG9ydCgnLi4vLi4vYXNzZXQvYXNzZXQuanMnKS5Bc3NldH0gcHJlc3NlZFNwcml0ZUFzc2V0IFNwcml0ZSB0byBiZSB1c2VkIGFzIHRoZVxuICogYnV0dG9uIGltYWdlIHdoZW4gdGhlIHVzZXIgcHJlc3NlcyBpdC5cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBwcmVzc2VkU3ByaXRlRnJhbWUgRnJhbWUgdG8gYmUgdXNlZCBmcm9tIHRoZSBwcmVzc2VkIHNwcml0ZS5cbiAqIEBwcm9wZXJ0eSB7aW1wb3J0KCcuLi8uLi9hc3NldC9hc3NldC5qcycpLkFzc2V0fSBpbmFjdGl2ZVNwcml0ZUFzc2V0IFNwcml0ZSB0byBiZSB1c2VkIGFzIHRoZVxuICogYnV0dG9uIGltYWdlIHdoZW4gdGhlIGJ1dHRvbiBpcyBub3QgaW50ZXJhY3RpdmUuXG4gKiBAcHJvcGVydHkge251bWJlcn0gaW5hY3RpdmVTcHJpdGVGcmFtZSBGcmFtZSB0byBiZSB1c2VkIGZyb20gdGhlIGluYWN0aXZlIHNwcml0ZS5cbiAqIEBhdWdtZW50cyBDb21wb25lbnRcbiAqL1xuY2xhc3MgQnV0dG9uQ29tcG9uZW50IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgQnV0dG9uQ29tcG9uZW50IGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4vc3lzdGVtLmpzJykuQnV0dG9uQ29tcG9uZW50U3lzdGVtfSBzeXN0ZW0gLSBUaGUgQ29tcG9uZW50U3lzdGVtIHRoYXRcbiAgICAgKiBjcmVhdGVkIHRoaXMgY29tcG9uZW50LlxuICAgICAqIEBwYXJhbSB7aW1wb3J0KCcuLi8uLi9lbnRpdHkuanMnKS5FbnRpdHl9IGVudGl0eSAtIFRoZSBlbnRpdHkgdGhhdCB0aGlzIGNvbXBvbmVudCBpc1xuICAgICAqIGF0dGFjaGVkIHRvLlxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN5c3RlbSwgZW50aXR5KSB7XG4gICAgICAgIHN1cGVyKHN5c3RlbSwgZW50aXR5KTtcblxuICAgICAgICB0aGlzLl92aXN1YWxTdGF0ZSA9IFZpc3VhbFN0YXRlLkRFRkFVTFQ7XG4gICAgICAgIHRoaXMuX2lzSG92ZXJpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faG92ZXJpbmdDb3VudGVyID0gMDtcbiAgICAgICAgdGhpcy5faXNQcmVzc2VkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fZGVmYXVsdFRpbnQgPSBuZXcgQ29sb3IoMSwgMSwgMSwgMSk7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRTcHJpdGVBc3NldCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRTcHJpdGVGcmFtZSA9IDA7XG5cbiAgICAgICAgdGhpcy5faW1hZ2VSZWZlcmVuY2UgPSBuZXcgRW50aXR5UmVmZXJlbmNlKHRoaXMsICdpbWFnZUVudGl0eScsIHtcbiAgICAgICAgICAgICdlbGVtZW50I2dhaW4nOiB0aGlzLl9vbkltYWdlRWxlbWVudEdhaW4sXG4gICAgICAgICAgICAnZWxlbWVudCNsb3NlJzogdGhpcy5fb25JbWFnZUVsZW1lbnRMb3NlLFxuICAgICAgICAgICAgJ2VsZW1lbnQjc2V0OmNvbG9yJzogdGhpcy5fb25TZXRDb2xvcixcbiAgICAgICAgICAgICdlbGVtZW50I3NldDpvcGFjaXR5JzogdGhpcy5fb25TZXRPcGFjaXR5LFxuICAgICAgICAgICAgJ2VsZW1lbnQjc2V0OnNwcml0ZUFzc2V0JzogdGhpcy5fb25TZXRTcHJpdGVBc3NldCxcbiAgICAgICAgICAgICdlbGVtZW50I3NldDpzcHJpdGVGcmFtZSc6IHRoaXMuX29uU2V0U3ByaXRlRnJhbWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5fdG9nZ2xlTGlmZWN5Y2xlTGlzdGVuZXJzKCdvbicsIHN5c3RlbSk7XG4gICAgfVxuXG4gICAgX3RvZ2dsZUxpZmVjeWNsZUxpc3RlbmVycyhvbk9yT2ZmLCBzeXN0ZW0pIHtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X2FjdGl2ZScsIHRoaXMuX29uU2V0QWN0aXZlLCB0aGlzKTtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X3RyYW5zaXRpb25Nb2RlJywgdGhpcy5fb25TZXRUcmFuc2l0aW9uTW9kZSwgdGhpcyk7XG4gICAgICAgIHRoaXNbb25Pck9mZl0oJ3NldF9ob3ZlclRpbnQnLCB0aGlzLl9vblNldFRyYW5zaXRpb25WYWx1ZSwgdGhpcyk7XG4gICAgICAgIHRoaXNbb25Pck9mZl0oJ3NldF9wcmVzc2VkVGludCcsIHRoaXMuX29uU2V0VHJhbnNpdGlvblZhbHVlLCB0aGlzKTtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X2luYWN0aXZlVGludCcsIHRoaXMuX29uU2V0VHJhbnNpdGlvblZhbHVlLCB0aGlzKTtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X2hvdmVyU3ByaXRlQXNzZXQnLCB0aGlzLl9vblNldFRyYW5zaXRpb25WYWx1ZSwgdGhpcyk7XG4gICAgICAgIHRoaXNbb25Pck9mZl0oJ3NldF9ob3ZlclNwcml0ZUZyYW1lJywgdGhpcy5fb25TZXRUcmFuc2l0aW9uVmFsdWUsIHRoaXMpO1xuICAgICAgICB0aGlzW29uT3JPZmZdKCdzZXRfcHJlc3NlZFNwcml0ZUFzc2V0JywgdGhpcy5fb25TZXRUcmFuc2l0aW9uVmFsdWUsIHRoaXMpO1xuICAgICAgICB0aGlzW29uT3JPZmZdKCdzZXRfcHJlc3NlZFNwcml0ZUZyYW1lJywgdGhpcy5fb25TZXRUcmFuc2l0aW9uVmFsdWUsIHRoaXMpO1xuICAgICAgICB0aGlzW29uT3JPZmZdKCdzZXRfaW5hY3RpdmVTcHJpdGVBc3NldCcsIHRoaXMuX29uU2V0VHJhbnNpdGlvblZhbHVlLCB0aGlzKTtcbiAgICAgICAgdGhpc1tvbk9yT2ZmXSgnc2V0X2luYWN0aXZlU3ByaXRlRnJhbWUnLCB0aGlzLl9vblNldFRyYW5zaXRpb25WYWx1ZSwgdGhpcyk7XG5cbiAgICAgICAgc3lzdGVtLmFwcC5zeXN0ZW1zLmVsZW1lbnRbb25Pck9mZl0oJ2FkZCcsIHRoaXMuX29uRWxlbWVudENvbXBvbmVudEFkZCwgdGhpcyk7XG4gICAgICAgIHN5c3RlbS5hcHAuc3lzdGVtcy5lbGVtZW50W29uT3JPZmZdKCdiZWZvcmVyZW1vdmUnLCB0aGlzLl9vbkVsZW1lbnRDb21wb25lbnRSZW1vdmUsIHRoaXMpO1xuICAgIH1cblxuICAgIF9vblNldEFjdGl2ZShuYW1lLCBvbGRWYWx1ZSwgbmV3VmFsdWUpIHtcbiAgICAgICAgaWYgKG9sZFZhbHVlICE9PSBuZXdWYWx1ZSkge1xuICAgICAgICAgICAgdGhpcy5fdXBkYXRlVmlzdWFsU3RhdGUoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9vblNldFRyYW5zaXRpb25Nb2RlKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAob2xkVmFsdWUgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9jYW5jZWxUd2VlbigpO1xuICAgICAgICAgICAgdGhpcy5fcmVzZXRUb0RlZmF1bHRWaXN1YWxTdGF0ZShvbGRWYWx1ZSk7XG4gICAgICAgICAgICB0aGlzLl9mb3JjZVJlYXBwbHlWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2V0VHJhbnNpdGlvblZhbHVlKG5hbWUsIG9sZFZhbHVlLCBuZXdWYWx1ZSkge1xuICAgICAgICBpZiAob2xkVmFsdWUgIT09IG5ld1ZhbHVlKSB7XG4gICAgICAgICAgICB0aGlzLl9mb3JjZVJlYXBwbHlWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uRWxlbWVudENvbXBvbmVudFJlbW92ZShlbnRpdHkpIHtcbiAgICAgICAgaWYgKHRoaXMuZW50aXR5ID09PSBlbnRpdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3RvZ2dsZUhpdEVsZW1lbnRMaXN0ZW5lcnMoJ29mZicpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uRWxlbWVudENvbXBvbmVudEFkZChlbnRpdHkpIHtcbiAgICAgICAgaWYgKHRoaXMuZW50aXR5ID09PSBlbnRpdHkpIHtcbiAgICAgICAgICAgIHRoaXMuX3RvZ2dsZUhpdEVsZW1lbnRMaXN0ZW5lcnMoJ29uJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfb25JbWFnZUVsZW1lbnRMb3NlKCkge1xuICAgICAgICB0aGlzLl9jYW5jZWxUd2VlbigpO1xuICAgICAgICB0aGlzLl9yZXNldFRvRGVmYXVsdFZpc3VhbFN0YXRlKHRoaXMudHJhbnNpdGlvbk1vZGUpO1xuICAgIH1cblxuICAgIF9vbkltYWdlRWxlbWVudEdhaW4oKSB7XG4gICAgICAgIHRoaXMuX3N0b3JlRGVmYXVsdFZpc3VhbFN0YXRlKCk7XG4gICAgICAgIHRoaXMuX2ZvcmNlUmVhcHBseVZpc3VhbFN0YXRlKCk7XG4gICAgfVxuXG4gICAgX3RvZ2dsZUhpdEVsZW1lbnRMaXN0ZW5lcnMob25Pck9mZikge1xuICAgICAgICBpZiAodGhpcy5lbnRpdHkuZWxlbWVudCkge1xuICAgICAgICAgICAgY29uc3QgaXNBZGRpbmcgPSAob25Pck9mZiA9PT0gJ29uJyk7XG5cbiAgICAgICAgICAgIC8vIFByZXZlbnQgZHVwbGljYXRlIGxpc3RlbmVyc1xuICAgICAgICAgICAgaWYgKGlzQWRkaW5nICYmIHRoaXMuX2hhc0hpdEVsZW1lbnRMaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuZW50aXR5LmVsZW1lbnRbb25Pck9mZl0oJ21vdXNlZW50ZXInLCB0aGlzLl9vbk1vdXNlRW50ZXIsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuZWxlbWVudFtvbk9yT2ZmXSgnbW91c2VsZWF2ZScsIHRoaXMuX29uTW91c2VMZWF2ZSwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCdtb3VzZWRvd24nLCB0aGlzLl9vbk1vdXNlRG93biwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCdtb3VzZXVwJywgdGhpcy5fb25Nb3VzZVVwLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LmVsZW1lbnRbb25Pck9mZl0oJ3RvdWNoc3RhcnQnLCB0aGlzLl9vblRvdWNoU3RhcnQsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuZWxlbWVudFtvbk9yT2ZmXSgndG91Y2hlbmQnLCB0aGlzLl9vblRvdWNoRW5kLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LmVsZW1lbnRbb25Pck9mZl0oJ3RvdWNobGVhdmUnLCB0aGlzLl9vblRvdWNoTGVhdmUsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuZWxlbWVudFtvbk9yT2ZmXSgndG91Y2hjYW5jZWwnLCB0aGlzLl9vblRvdWNoQ2FuY2VsLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LmVsZW1lbnRbb25Pck9mZl0oJ3NlbGVjdHN0YXJ0JywgdGhpcy5fb25TZWxlY3RTdGFydCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCdzZWxlY3RlbmQnLCB0aGlzLl9vblNlbGVjdEVuZCwgdGhpcyk7XG4gICAgICAgICAgICB0aGlzLmVudGl0eS5lbGVtZW50W29uT3JPZmZdKCdzZWxlY3RlbnRlcicsIHRoaXMuX29uU2VsZWN0RW50ZXIsIHRoaXMpO1xuICAgICAgICAgICAgdGhpcy5lbnRpdHkuZWxlbWVudFtvbk9yT2ZmXSgnc2VsZWN0bGVhdmUnLCB0aGlzLl9vblNlbGVjdExlYXZlLCB0aGlzKTtcbiAgICAgICAgICAgIHRoaXMuZW50aXR5LmVsZW1lbnRbb25Pck9mZl0oJ2NsaWNrJywgdGhpcy5fb25DbGljaywgdGhpcyk7XG5cbiAgICAgICAgICAgIHRoaXMuX2hhc0hpdEVsZW1lbnRMaXN0ZW5lcnMgPSBpc0FkZGluZztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zdG9yZURlZmF1bHRWaXN1YWxTdGF0ZSgpIHtcbiAgICAgICAgLy8gSWYgdGhlIGVsZW1lbnQgaXMgb2YgZ3JvdXAgdHlwZSwgYWxsIGl0J3MgdmlzdWFsIHByb3BlcnRpZXMgYXJlIG51bGxcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlUmVmZXJlbmNlLmhhc0NvbXBvbmVudCgnZWxlbWVudCcpKSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50ID0gdGhpcy5faW1hZ2VSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQ7XG4gICAgICAgICAgICBpZiAoZWxlbWVudC50eXBlICE9PSBFTEVNRU5UVFlQRV9HUk9VUCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0b3JlRGVmYXVsdENvbG9yKGVsZW1lbnQuY29sb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3N0b3JlRGVmYXVsdE9wYWNpdHkoZWxlbWVudC5vcGFjaXR5KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdG9yZURlZmF1bHRTcHJpdGVBc3NldChlbGVtZW50LnNwcml0ZUFzc2V0KTtcbiAgICAgICAgICAgICAgICB0aGlzLl9zdG9yZURlZmF1bHRTcHJpdGVGcmFtZShlbGVtZW50LnNwcml0ZUZyYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9zdG9yZURlZmF1bHRDb2xvcihjb2xvcikge1xuICAgICAgICB0aGlzLl9kZWZhdWx0VGludC5yID0gY29sb3IucjtcbiAgICAgICAgdGhpcy5fZGVmYXVsdFRpbnQuZyA9IGNvbG9yLmc7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRUaW50LmIgPSBjb2xvci5iO1xuICAgIH1cblxuICAgIF9zdG9yZURlZmF1bHRPcGFjaXR5KG9wYWNpdHkpIHtcbiAgICAgICAgdGhpcy5fZGVmYXVsdFRpbnQuYSA9IG9wYWNpdHk7XG4gICAgfVxuXG4gICAgX3N0b3JlRGVmYXVsdFNwcml0ZUFzc2V0KHNwcml0ZUFzc2V0KSB7XG4gICAgICAgIHRoaXMuX2RlZmF1bHRTcHJpdGVBc3NldCA9IHNwcml0ZUFzc2V0O1xuICAgIH1cblxuICAgIF9zdG9yZURlZmF1bHRTcHJpdGVGcmFtZShzcHJpdGVGcmFtZSkge1xuICAgICAgICB0aGlzLl9kZWZhdWx0U3ByaXRlRnJhbWUgPSBzcHJpdGVGcmFtZTtcbiAgICB9XG5cbiAgICBfb25TZXRDb2xvcihjb2xvcikge1xuICAgICAgICBpZiAoIXRoaXMuX2lzQXBwbHlpbmdUaW50KSB7XG4gICAgICAgICAgICB0aGlzLl9zdG9yZURlZmF1bHRDb2xvcihjb2xvcik7XG4gICAgICAgICAgICB0aGlzLl9mb3JjZVJlYXBwbHlWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2V0T3BhY2l0eShvcGFjaXR5KSB7XG4gICAgICAgIGlmICghdGhpcy5faXNBcHBseWluZ1RpbnQpIHtcbiAgICAgICAgICAgIHRoaXMuX3N0b3JlRGVmYXVsdE9wYWNpdHkob3BhY2l0eSk7XG4gICAgICAgICAgICB0aGlzLl9mb3JjZVJlYXBwbHlWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2V0U3ByaXRlQXNzZXQoc3ByaXRlQXNzZXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9pc0FwcGx5aW5nU3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9zdG9yZURlZmF1bHRTcHJpdGVBc3NldChzcHJpdGVBc3NldCk7XG4gICAgICAgICAgICB0aGlzLl9mb3JjZVJlYXBwbHlWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uU2V0U3ByaXRlRnJhbWUoc3ByaXRlRnJhbWUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9pc0FwcGx5aW5nU3ByaXRlKSB7XG4gICAgICAgICAgICB0aGlzLl9zdG9yZURlZmF1bHRTcHJpdGVGcmFtZShzcHJpdGVGcmFtZSk7XG4gICAgICAgICAgICB0aGlzLl9mb3JjZVJlYXBwbHlWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX29uTW91c2VFbnRlcihldmVudCkge1xuICAgICAgICB0aGlzLl9pc0hvdmVyaW5nID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ21vdXNlZW50ZXInLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uTW91c2VMZWF2ZShldmVudCkge1xuICAgICAgICB0aGlzLl9pc0hvdmVyaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2lzUHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVZpc3VhbFN0YXRlKCk7XG4gICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgnbW91c2VsZWF2ZScsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25Nb3VzZURvd24oZXZlbnQpIHtcbiAgICAgICAgdGhpcy5faXNQcmVzc2VkID0gdHJ1ZTtcblxuICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ21vdXNlZG93bicsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25Nb3VzZVVwKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuX2lzUHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVZpc3VhbFN0YXRlKCk7XG4gICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgnbW91c2V1cCcsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25Ub3VjaFN0YXJ0KGV2ZW50KSB7XG4gICAgICAgIHRoaXMuX2lzUHJlc3NlZCA9IHRydWU7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVmlzdWFsU3RhdGUoKTtcbiAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCd0b3VjaHN0YXJ0JywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9vblRvdWNoRW5kKGV2ZW50KSB7XG4gICAgICAgIC8vIFRoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIHRoZSBicm93c2VyIGlzIHRvIHNpbXVsYXRlIGEgc2VyaWVzIG9mXG4gICAgICAgIC8vIGBtb3VzZWVudGVyL2Rvd24vdXBgIGV2ZW50cyBpbW1lZGlhdGVseSBhZnRlciB0aGUgYHRvdWNoZW5kYCBldmVudCxcbiAgICAgICAgLy8gaW4gb3JkZXIgdG8gZW5zdXJlIHRoYXQgd2Vic2l0ZXMgdGhhdCBkb24ndCBleHBsaWNpdGx5IGxpc3RlbiBmb3JcbiAgICAgICAgLy8gdG91Y2ggZXZlbnRzIHdpbGwgc3RpbGwgd29yayBvbiBtb2JpbGUgKHNlZSBodHRwczovL3d3dy5odG1sNXJvY2tzLmNvbS9lbi9tb2JpbGUvdG91Y2hhbmRtb3VzZS9cbiAgICAgICAgLy8gZm9yIHJlZmVyZW5jZSkuIFRoaXMgbGVhZHMgdG8gYW4gaXNzdWUgd2hlcmVieSBidXR0b25zIHdpbGwgZW50ZXJcbiAgICAgICAgLy8gdGhlIGBob3ZlcmAgc3RhdGUgb24gbW9iaWxlIGJyb3dzZXJzIGFmdGVyIHRoZSBgdG91Y2hlbmRgIGV2ZW50IGlzXG4gICAgICAgIC8vIHJlY2VpdmVkLCBpbnN0ZWFkIG9mIGdvaW5nIGJhY2sgdG8gdGhlIGBkZWZhdWx0YCBzdGF0ZS4gQ2FsbGluZ1xuICAgICAgICAvLyBwcmV2ZW50RGVmYXVsdCgpIGhlcmUgZml4ZXMgdGhlIGlzc3VlLlxuICAgICAgICBldmVudC5ldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIHRoaXMuX2lzUHJlc3NlZCA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuX3VwZGF0ZVZpc3VhbFN0YXRlKCk7XG4gICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgndG91Y2hlbmQnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uVG91Y2hMZWF2ZShldmVudCkge1xuICAgICAgICB0aGlzLl9pc1ByZXNzZWQgPSBmYWxzZTtcblxuICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ3RvdWNobGVhdmUnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uVG91Y2hDYW5jZWwoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5faXNQcmVzc2VkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5fdXBkYXRlVmlzdWFsU3RhdGUoKTtcbiAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCd0b3VjaGNhbmNlbCcsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25TZWxlY3RTdGFydChldmVudCkge1xuICAgICAgICB0aGlzLl9pc1ByZXNzZWQgPSB0cnVlO1xuICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ3NlbGVjdHN0YXJ0JywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9vblNlbGVjdEVuZChldmVudCkge1xuICAgICAgICB0aGlzLl9pc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fdXBkYXRlVmlzdWFsU3RhdGUoKTtcbiAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCdzZWxlY3RlbmQnLCBldmVudCk7XG4gICAgfVxuXG4gICAgX29uU2VsZWN0RW50ZXIoZXZlbnQpIHtcbiAgICAgICAgdGhpcy5faG92ZXJpbmdDb3VudGVyKys7XG5cbiAgICAgICAgaWYgKHRoaXMuX2hvdmVyaW5nQ291bnRlciA9PT0gMSkge1xuICAgICAgICAgICAgdGhpcy5faXNIb3ZlcmluZyA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLl91cGRhdGVWaXN1YWxTdGF0ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCdzZWxlY3RlbnRlcicsIGV2ZW50KTtcbiAgICB9XG5cbiAgICBfb25TZWxlY3RMZWF2ZShldmVudCkge1xuICAgICAgICB0aGlzLl9ob3ZlcmluZ0NvdW50ZXItLTtcblxuICAgICAgICBpZiAodGhpcy5faG92ZXJpbmdDb3VudGVyID09PSAwKSB7XG4gICAgICAgICAgICB0aGlzLl9pc0hvdmVyaW5nID0gZmFsc2U7XG4gICAgICAgICAgICB0aGlzLl9pc1ByZXNzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVZpc3VhbFN0YXRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ3NlbGVjdGxlYXZlJywgZXZlbnQpO1xuICAgIH1cblxuICAgIF9vbkNsaWNrKGV2ZW50KSB7XG4gICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgnY2xpY2snLCBldmVudCk7XG4gICAgfVxuXG4gICAgX2ZpcmVJZkFjdGl2ZShuYW1lLCBldmVudCkge1xuICAgICAgICBpZiAodGhpcy5kYXRhLmFjdGl2ZSkge1xuICAgICAgICAgICAgdGhpcy5maXJlKG5hbWUsIGV2ZW50KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF91cGRhdGVWaXN1YWxTdGF0ZShmb3JjZSkge1xuICAgICAgICBjb25zdCBvbGRWaXN1YWxTdGF0ZSA9IHRoaXMuX3Zpc3VhbFN0YXRlO1xuICAgICAgICBjb25zdCBuZXdWaXN1YWxTdGF0ZSA9IHRoaXMuX2RldGVybWluZVZpc3VhbFN0YXRlKCk7XG5cbiAgICAgICAgaWYgKChvbGRWaXN1YWxTdGF0ZSAhPT0gbmV3VmlzdWFsU3RhdGUgfHwgZm9yY2UpICYmIHRoaXMuZW5hYmxlZCkge1xuICAgICAgICAgICAgdGhpcy5fdmlzdWFsU3RhdGUgPSBuZXdWaXN1YWxTdGF0ZTtcblxuICAgICAgICAgICAgaWYgKG9sZFZpc3VhbFN0YXRlID09PSBWaXN1YWxTdGF0ZS5IT1ZFUikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ZpcmVJZkFjdGl2ZSgnaG92ZXJlbmQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG9sZFZpc3VhbFN0YXRlID09PSBWaXN1YWxTdGF0ZS5QUkVTU0VEKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCdwcmVzc2VkZW5kJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChuZXdWaXN1YWxTdGF0ZSA9PT0gVmlzdWFsU3RhdGUuSE9WRVIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9maXJlSWZBY3RpdmUoJ2hvdmVyc3RhcnQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKG5ld1Zpc3VhbFN0YXRlID09PSBWaXN1YWxTdGF0ZS5QUkVTU0VEKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZmlyZUlmQWN0aXZlKCdwcmVzc2Vkc3RhcnQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3dpdGNoICh0aGlzLnRyYW5zaXRpb25Nb2RlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBCVVRUT05fVFJBTlNJVElPTl9NT0RFX1RJTlQ6IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGludE5hbWUgPSBTVEFURVNfVE9fVElOVF9OQU1FU1t0aGlzLl92aXN1YWxTdGF0ZV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpbnRDb2xvciA9IHRoaXNbdGludE5hbWVdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hcHBseVRpbnQodGludENvbG9yKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhc2UgQlVUVE9OX1RSQU5TSVRJT05fTU9ERV9TUFJJVEVfQ0hBTkdFOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNwcml0ZUFzc2V0TmFtZSA9IFNUQVRFU19UT19TUFJJVEVfQVNTRVRfTkFNRVNbdGhpcy5fdmlzdWFsU3RhdGVdO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzcHJpdGVGcmFtZU5hbWUgPSBTVEFURVNfVE9fU1BSSVRFX0ZSQU1FX05BTUVTW3RoaXMuX3Zpc3VhbFN0YXRlXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ByaXRlQXNzZXQgPSB0aGlzW3Nwcml0ZUFzc2V0TmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNwcml0ZUZyYW1lID0gdGhpc1tzcHJpdGVGcmFtZU5hbWVdO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9hcHBseVNwcml0ZShzcHJpdGVBc3NldCwgc3ByaXRlRnJhbWUpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYWxsZWQgd2hlbiBhIHByb3BlcnR5IGNoYW5nZXMgdGhhdCBtZWFuIHRoZSB2aXN1YWwgc3RhdGUgbXVzdCBiZSByZWFwcGxpZWQsXG4gICAgLy8gZXZlbiBpZiB0aGUgc3RhdGUgZW51bSBoYXMgbm90IGNoYW5nZWQuIEV4YW1wbGVzIG9mIHRoaXMgYXJlIHdoZW4gdGhlIHRpbnRcbiAgICAvLyB2YWx1ZSBmb3Igb25lIG9mIHRoZSBzdGF0ZXMgaXMgY2hhbmdlZCB2aWEgdGhlIGVkaXRvci5cbiAgICBfZm9yY2VSZWFwcGx5VmlzdWFsU3RhdGUoKSB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVZpc3VhbFN0YXRlKHRydWUpO1xuICAgIH1cblxuICAgIC8vIENhbGxlZCBiZWZvcmUgdGhlIGltYWdlIGVudGl0eSBjaGFuZ2VzLCBpbiBvcmRlciB0byByZXN0b3JlIHRoZSBwcmV2aW91c1xuICAgIC8vIGltYWdlIGJhY2sgdG8gaXRzIG9yaWdpbmFsIHRpbnQuIE5vdGUgdGhhdCB0aGlzIGhhcHBlbnMgaW1tZWRpYXRlbHksIGkuZS5cbiAgICAvLyB3aXRob3V0IGFueSBhbmltYXRpb24uXG4gICAgX3Jlc2V0VG9EZWZhdWx0VmlzdWFsU3RhdGUodHJhbnNpdGlvbk1vZGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlUmVmZXJlbmNlLmhhc0NvbXBvbmVudCgnZWxlbWVudCcpKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKHRyYW5zaXRpb25Nb2RlKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBCVVRUT05fVFJBTlNJVElPTl9NT0RFX1RJTlQ6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2NhbmNlbFR3ZWVuKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX2FwcGx5VGludEltbWVkaWF0ZWx5KHRoaXMuX2RlZmF1bHRUaW50KTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBjYXNlIEJVVFRPTl9UUkFOU0lUSU9OX01PREVfU1BSSVRFX0NIQU5HRTpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fYXBwbHlTcHJpdGUodGhpcy5fZGVmYXVsdFNwcml0ZUFzc2V0LCB0aGlzLl9kZWZhdWx0U3ByaXRlRnJhbWUpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9kZXRlcm1pbmVWaXN1YWxTdGF0ZSgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmFjdGl2ZSkge1xuICAgICAgICAgICAgcmV0dXJuIFZpc3VhbFN0YXRlLklOQUNUSVZFO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX2lzUHJlc3NlZCkge1xuICAgICAgICAgICAgcmV0dXJuIFZpc3VhbFN0YXRlLlBSRVNTRUQ7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5faXNIb3ZlcmluZykge1xuICAgICAgICAgICAgcmV0dXJuIFZpc3VhbFN0YXRlLkhPVkVSO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFZpc3VhbFN0YXRlLkRFRkFVTFQ7XG4gICAgfVxuXG4gICAgX2FwcGx5U3ByaXRlKHNwcml0ZUFzc2V0LCBzcHJpdGVGcmFtZSkge1xuICAgICAgICBzcHJpdGVGcmFtZSA9IHNwcml0ZUZyYW1lIHx8IDA7XG5cbiAgICAgICAgaWYgKHRoaXMuX2ltYWdlUmVmZXJlbmNlLmhhc0NvbXBvbmVudCgnZWxlbWVudCcpKSB7XG4gICAgICAgICAgICB0aGlzLl9pc0FwcGx5aW5nU3ByaXRlID0gdHJ1ZTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2ltYWdlUmVmZXJlbmNlLmVudGl0eS5lbGVtZW50LnNwcml0ZUFzc2V0ICE9PSBzcHJpdGVBc3NldCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2ltYWdlUmVmZXJlbmNlLmVudGl0eS5lbGVtZW50LnNwcml0ZUFzc2V0ID0gc3ByaXRlQXNzZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5zcHJpdGVGcmFtZSAhPT0gc3ByaXRlRnJhbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5zcHJpdGVGcmFtZSA9IHNwcml0ZUZyYW1lO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLl9pc0FwcGx5aW5nU3ByaXRlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYXBwbHlUaW50KHRpbnRDb2xvcikge1xuICAgICAgICB0aGlzLl9jYW5jZWxUd2VlbigpO1xuXG4gICAgICAgIGlmICh0aGlzLmZhZGVEdXJhdGlvbiA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwbHlUaW50SW1tZWRpYXRlbHkodGludENvbG9yKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGx5VGludFdpdGhUd2Vlbih0aW50Q29sb3IpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX2FwcGx5VGludEltbWVkaWF0ZWx5KHRpbnRDb2xvcikge1xuICAgICAgICBpZiAoIXRpbnRDb2xvciB8fCAhdGhpcy5faW1hZ2VSZWZlcmVuY2UuaGFzQ29tcG9uZW50KCdlbGVtZW50JykgfHwgdGhpcy5faW1hZ2VSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQudHlwZSA9PT0gRUxFTUVOVFRZUEVfR1JPVVApXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgY29uc3QgY29sb3IzID0gdG9Db2xvcjModGludENvbG9yKTtcblxuICAgICAgICB0aGlzLl9pc0FwcGx5aW5nVGludCA9IHRydWU7XG5cbiAgICAgICAgaWYgKCFjb2xvcjMuZXF1YWxzKHRoaXMuX2ltYWdlUmVmZXJlbmNlLmVudGl0eS5lbGVtZW50LmNvbG9yKSlcbiAgICAgICAgICAgIHRoaXMuX2ltYWdlUmVmZXJlbmNlLmVudGl0eS5lbGVtZW50LmNvbG9yID0gY29sb3IzO1xuXG4gICAgICAgIGlmICh0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC5vcGFjaXR5ICE9PSB0aW50Q29sb3IuYSlcbiAgICAgICAgICAgIHRoaXMuX2ltYWdlUmVmZXJlbmNlLmVudGl0eS5lbGVtZW50Lm9wYWNpdHkgPSB0aW50Q29sb3IuYTtcblxuICAgICAgICB0aGlzLl9pc0FwcGx5aW5nVGludCA9IGZhbHNlO1xuICAgIH1cblxuICAgIF9hcHBseVRpbnRXaXRoVHdlZW4odGludENvbG9yKSB7XG4gICAgICAgIGlmICghdGludENvbG9yIHx8ICF0aGlzLl9pbWFnZVJlZmVyZW5jZS5oYXNDb21wb25lbnQoJ2VsZW1lbnQnKSB8fCB0aGlzLl9pbWFnZVJlZmVyZW5jZS5lbnRpdHkuZWxlbWVudC50eXBlID09PSBFTEVNRU5UVFlQRV9HUk9VUClcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBjb25zdCBjb2xvcjMgPSB0b0NvbG9yMyh0aW50Q29sb3IpO1xuICAgICAgICBjb25zdCBjb2xvciA9IHRoaXMuX2ltYWdlUmVmZXJlbmNlLmVudGl0eS5lbGVtZW50LmNvbG9yO1xuICAgICAgICBjb25zdCBvcGFjaXR5ID0gdGhpcy5faW1hZ2VSZWZlcmVuY2UuZW50aXR5LmVsZW1lbnQub3BhY2l0eTtcblxuICAgICAgICBpZiAoY29sb3IzLmVxdWFscyhjb2xvcikgJiYgdGludENvbG9yLmEgPT09IG9wYWNpdHkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdGhpcy5fdHdlZW5JbmZvID0ge1xuICAgICAgICAgICAgc3RhcnRUaW1lOiBub3coKSxcbiAgICAgICAgICAgIGZyb206IG5ldyBDb2xvcihjb2xvci5yLCBjb2xvci5nLCBjb2xvci5iLCBvcGFjaXR5KSxcbiAgICAgICAgICAgIHRvOiB0aW50Q29sb3IuY2xvbmUoKSxcbiAgICAgICAgICAgIGxlcnBDb2xvcjogbmV3IENvbG9yKClcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBfdXBkYXRlVGludFR3ZWVuKCkge1xuICAgICAgICBjb25zdCBlbGFwc2VkVGltZSA9IG5vdygpIC0gdGhpcy5fdHdlZW5JbmZvLnN0YXJ0VGltZTtcbiAgICAgICAgbGV0IGVsYXBzZWRQcm9wb3J0aW9uID0gdGhpcy5mYWRlRHVyYXRpb24gPT09IDAgPyAxIDogKGVsYXBzZWRUaW1lIC8gdGhpcy5mYWRlRHVyYXRpb24pO1xuICAgICAgICBlbGFwc2VkUHJvcG9ydGlvbiA9IG1hdGguY2xhbXAoZWxhcHNlZFByb3BvcnRpb24sIDAsIDEpO1xuXG4gICAgICAgIGlmIChNYXRoLmFicyhlbGFwc2VkUHJvcG9ydGlvbiAtIDEpID4gMWUtNSkge1xuICAgICAgICAgICAgY29uc3QgbGVycENvbG9yID0gdGhpcy5fdHdlZW5JbmZvLmxlcnBDb2xvcjtcbiAgICAgICAgICAgIGxlcnBDb2xvci5sZXJwKHRoaXMuX3R3ZWVuSW5mby5mcm9tLCB0aGlzLl90d2VlbkluZm8udG8sIGVsYXBzZWRQcm9wb3J0aW9uKTtcbiAgICAgICAgICAgIHRoaXMuX2FwcGx5VGludEltbWVkaWF0ZWx5KG5ldyBDb2xvcihsZXJwQ29sb3IuciwgbGVycENvbG9yLmcsIGxlcnBDb2xvci5iLCBsZXJwQ29sb3IuYSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fYXBwbHlUaW50SW1tZWRpYXRlbHkodGhpcy5fdHdlZW5JbmZvLnRvKTtcbiAgICAgICAgICAgIHRoaXMuX2NhbmNlbFR3ZWVuKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfY2FuY2VsVHdlZW4oKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl90d2VlbkluZm87XG4gICAgfVxuXG4gICAgb25VcGRhdGUoKSB7XG4gICAgICAgIGlmICh0aGlzLl90d2VlbkluZm8pIHtcbiAgICAgICAgICAgIHRoaXMuX3VwZGF0ZVRpbnRUd2VlbigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgb25FbmFibGUoKSB7XG4gICAgICAgIC8vIFJlc2V0IGlucHV0IHN0YXRlXG4gICAgICAgIHRoaXMuX2lzSG92ZXJpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faG92ZXJpbmdDb3VudGVyID0gMDtcbiAgICAgICAgdGhpcy5faXNQcmVzc2VkID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5faW1hZ2VSZWZlcmVuY2Uub25QYXJlbnRDb21wb25lbnRFbmFibGUoKTtcbiAgICAgICAgdGhpcy5fdG9nZ2xlSGl0RWxlbWVudExpc3RlbmVycygnb24nKTtcbiAgICAgICAgdGhpcy5fZm9yY2VSZWFwcGx5VmlzdWFsU3RhdGUoKTtcbiAgICB9XG5cbiAgICBvbkRpc2FibGUoKSB7XG4gICAgICAgIHRoaXMuX3RvZ2dsZUhpdEVsZW1lbnRMaXN0ZW5lcnMoJ29mZicpO1xuICAgICAgICB0aGlzLl9yZXNldFRvRGVmYXVsdFZpc3VhbFN0YXRlKHRoaXMudHJhbnNpdGlvbk1vZGUpO1xuICAgIH1cblxuICAgIG9uUmVtb3ZlKCkge1xuICAgICAgICB0aGlzLl90b2dnbGVMaWZlY3ljbGVMaXN0ZW5lcnMoJ29mZicsIHRoaXMuc3lzdGVtKTtcbiAgICAgICAgdGhpcy5vbkRpc2FibGUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRvQ29sb3IzKGNvbG9yNCkge1xuICAgIHJldHVybiBuZXcgQ29sb3IoY29sb3I0LnIsIGNvbG9yNC5nLCBjb2xvcjQuYik7XG59XG5cbi8qKlxuICogRmlyZWQgd2hlbiB0aGUgbW91c2UgaXMgcHJlc3NlZCB3aGlsZSB0aGUgY3Vyc29yIGlzIG9uIHRoZSBjb21wb25lbnQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCNtb3VzZWRvd25cbiAqIEBwYXJhbSB7RWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiB0aGUgbW91c2UgaXMgcmVsZWFzZWQgd2hpbGUgdGhlIGN1cnNvciBpcyBvbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjbW91c2V1cFxuICogQHBhcmFtIHtFbGVtZW50TW91c2VFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIHRoZSBtb3VzZSBjdXJzb3IgZW50ZXJzIHRoZSBjb21wb25lbnQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCNtb3VzZWVudGVyXG4gKiBAcGFyYW0ge0VsZW1lbnRNb3VzZUV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gdGhlIG1vdXNlIGN1cnNvciBsZWF2ZXMgdGhlIGNvbXBvbmVudC5cbiAqXG4gKiBAZXZlbnQgQnV0dG9uQ29tcG9uZW50I21vdXNlbGVhdmVcbiAqIEBwYXJhbSB7RWxlbWVudE1vdXNlRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiB0aGUgbW91c2UgaXMgcHJlc3NlZCBhbmQgcmVsZWFzZWQgb24gdGhlIGNvbXBvbmVudCBvciB3aGVuIGEgdG91Y2ggc3RhcnRzIGFuZCBlbmRzIG9uXG4gKiB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjY2xpY2tcbiAqIEBwYXJhbSB7RWxlbWVudE1vdXNlRXZlbnR8RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiBhIHRvdWNoIHN0YXJ0cyBvbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjdG91Y2hzdGFydFxuICogQHBhcmFtIHtFbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIGEgdG91Y2ggZW5kcyBvbiB0aGUgY29tcG9uZW50LlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjdG91Y2hlbmRcbiAqIEBwYXJhbSB7RWxlbWVudFRvdWNoRXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiBhIHRvdWNoIGlzIGNhbmNlbGVkIG9uIHRoZSBjb21wb25lbnQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCN0b3VjaGNhbmNlbFxuICogQHBhcmFtIHtFbGVtZW50VG91Y2hFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIGEgdG91Y2ggbGVhdmVzIHRoZSBjb21wb25lbnQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCN0b3VjaGxlYXZlXG4gKiBAcGFyYW0ge0VsZW1lbnRUb3VjaEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gYSB4ciBzZWxlY3Qgc3RhcnRzIG9uIHRoZSBjb21wb25lbnQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCNzZWxlY3RzdGFydFxuICogQHBhcmFtIHtFbGVtZW50U2VsZWN0RXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiBhIHhyIHNlbGVjdCBlbmRzIG9uIHRoZSBjb21wb25lbnQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCNzZWxlY3RlbmRcbiAqIEBwYXJhbSB7RWxlbWVudFNlbGVjdEV2ZW50fSBldmVudCAtIFRoZSBldmVudC5cbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gYSB4ciBzZWxlY3Qgbm93IGhvdmVyaW5nIG92ZXIgdGhlIGNvbXBvbmVudC5cbiAqXG4gKiBAZXZlbnQgQnV0dG9uQ29tcG9uZW50I3NlbGVjdGVudGVyXG4gKiBAcGFyYW0ge0VsZW1lbnRTZWxlY3RFdmVudH0gZXZlbnQgLSBUaGUgZXZlbnQuXG4gKi9cblxuLyoqXG4gKiBGaXJlZCB3aGVuIGEgeHIgc2VsZWN0IG5vdCBob3ZlcmluZyBvdmVyIHRoZSBjb21wb25lbnQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCNzZWxlY3RsZWF2ZVxuICogQHBhcmFtIHtFbGVtZW50U2VsZWN0RXZlbnR9IGV2ZW50IC0gVGhlIGV2ZW50LlxuICovXG5cbi8qKlxuICogRmlyZWQgd2hlbiB0aGUgYnV0dG9uIGNoYW5nZXMgc3RhdGUgdG8gYmUgaG92ZXJlZC5cbiAqXG4gKiBAZXZlbnQgQnV0dG9uQ29tcG9uZW50I2hvdmVyc3RhcnRcbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gdGhlIGJ1dHRvbiBjaGFuZ2VzIHN0YXRlIHRvIGJlIG5vdCBob3ZlcmVkLlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjaG92ZXJlbmRcbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gdGhlIGJ1dHRvbiBjaGFuZ2VzIHN0YXRlIHRvIGJlIHByZXNzZWQuXG4gKlxuICogQGV2ZW50IEJ1dHRvbkNvbXBvbmVudCNwcmVzc2Vkc3RhcnRcbiAqL1xuXG4vKipcbiAqIEZpcmVkIHdoZW4gdGhlIGJ1dHRvbiBjaGFuZ2VzIHN0YXRlIHRvIGJlIG5vdCBwcmVzc2VkLlxuICpcbiAqIEBldmVudCBCdXR0b25Db21wb25lbnQjcHJlc3NlZGVuZFxuICovXG5cbmV4cG9ydCB7IEJ1dHRvbkNvbXBvbmVudCB9O1xuIl0sIm5hbWVzIjpbIlZpc3VhbFN0YXRlIiwiREVGQVVMVCIsIkhPVkVSIiwiUFJFU1NFRCIsIklOQUNUSVZFIiwiU1RBVEVTX1RPX1RJTlRfTkFNRVMiLCJTVEFURVNfVE9fU1BSSVRFX0FTU0VUX05BTUVTIiwiU1RBVEVTX1RPX1NQUklURV9GUkFNRV9OQU1FUyIsIkJ1dHRvbkNvbXBvbmVudCIsIkNvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwic3lzdGVtIiwiZW50aXR5IiwiX3Zpc3VhbFN0YXRlIiwiX2lzSG92ZXJpbmciLCJfaG92ZXJpbmdDb3VudGVyIiwiX2lzUHJlc3NlZCIsIl9kZWZhdWx0VGludCIsIkNvbG9yIiwiX2RlZmF1bHRTcHJpdGVBc3NldCIsIl9kZWZhdWx0U3ByaXRlRnJhbWUiLCJfaW1hZ2VSZWZlcmVuY2UiLCJFbnRpdHlSZWZlcmVuY2UiLCJfb25JbWFnZUVsZW1lbnRHYWluIiwiX29uSW1hZ2VFbGVtZW50TG9zZSIsIl9vblNldENvbG9yIiwiX29uU2V0T3BhY2l0eSIsIl9vblNldFNwcml0ZUFzc2V0IiwiX29uU2V0U3ByaXRlRnJhbWUiLCJfdG9nZ2xlTGlmZWN5Y2xlTGlzdGVuZXJzIiwib25Pck9mZiIsIl9vblNldEFjdGl2ZSIsIl9vblNldFRyYW5zaXRpb25Nb2RlIiwiX29uU2V0VHJhbnNpdGlvblZhbHVlIiwiYXBwIiwic3lzdGVtcyIsImVsZW1lbnQiLCJfb25FbGVtZW50Q29tcG9uZW50QWRkIiwiX29uRWxlbWVudENvbXBvbmVudFJlbW92ZSIsIm5hbWUiLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwiX3VwZGF0ZVZpc3VhbFN0YXRlIiwiX2NhbmNlbFR3ZWVuIiwiX3Jlc2V0VG9EZWZhdWx0VmlzdWFsU3RhdGUiLCJfZm9yY2VSZWFwcGx5VmlzdWFsU3RhdGUiLCJfdG9nZ2xlSGl0RWxlbWVudExpc3RlbmVycyIsInRyYW5zaXRpb25Nb2RlIiwiX3N0b3JlRGVmYXVsdFZpc3VhbFN0YXRlIiwiaXNBZGRpbmciLCJfaGFzSGl0RWxlbWVudExpc3RlbmVycyIsIl9vbk1vdXNlRW50ZXIiLCJfb25Nb3VzZUxlYXZlIiwiX29uTW91c2VEb3duIiwiX29uTW91c2VVcCIsIl9vblRvdWNoU3RhcnQiLCJfb25Ub3VjaEVuZCIsIl9vblRvdWNoTGVhdmUiLCJfb25Ub3VjaENhbmNlbCIsIl9vblNlbGVjdFN0YXJ0IiwiX29uU2VsZWN0RW5kIiwiX29uU2VsZWN0RW50ZXIiLCJfb25TZWxlY3RMZWF2ZSIsIl9vbkNsaWNrIiwiaGFzQ29tcG9uZW50IiwidHlwZSIsIkVMRU1FTlRUWVBFX0dST1VQIiwiX3N0b3JlRGVmYXVsdENvbG9yIiwiY29sb3IiLCJfc3RvcmVEZWZhdWx0T3BhY2l0eSIsIm9wYWNpdHkiLCJfc3RvcmVEZWZhdWx0U3ByaXRlQXNzZXQiLCJzcHJpdGVBc3NldCIsIl9zdG9yZURlZmF1bHRTcHJpdGVGcmFtZSIsInNwcml0ZUZyYW1lIiwiciIsImciLCJiIiwiYSIsIl9pc0FwcGx5aW5nVGludCIsIl9pc0FwcGx5aW5nU3ByaXRlIiwiZXZlbnQiLCJfZmlyZUlmQWN0aXZlIiwicHJldmVudERlZmF1bHQiLCJkYXRhIiwiYWN0aXZlIiwiZmlyZSIsImZvcmNlIiwib2xkVmlzdWFsU3RhdGUiLCJuZXdWaXN1YWxTdGF0ZSIsIl9kZXRlcm1pbmVWaXN1YWxTdGF0ZSIsImVuYWJsZWQiLCJCVVRUT05fVFJBTlNJVElPTl9NT0RFX1RJTlQiLCJ0aW50TmFtZSIsInRpbnRDb2xvciIsIl9hcHBseVRpbnQiLCJCVVRUT05fVFJBTlNJVElPTl9NT0RFX1NQUklURV9DSEFOR0UiLCJzcHJpdGVBc3NldE5hbWUiLCJzcHJpdGVGcmFtZU5hbWUiLCJfYXBwbHlTcHJpdGUiLCJfYXBwbHlUaW50SW1tZWRpYXRlbHkiLCJmYWRlRHVyYXRpb24iLCJfYXBwbHlUaW50V2l0aFR3ZWVuIiwiY29sb3IzIiwidG9Db2xvcjMiLCJlcXVhbHMiLCJfdHdlZW5JbmZvIiwic3RhcnRUaW1lIiwibm93IiwiZnJvbSIsInRvIiwiY2xvbmUiLCJsZXJwQ29sb3IiLCJfdXBkYXRlVGludFR3ZWVuIiwiZWxhcHNlZFRpbWUiLCJlbGFwc2VkUHJvcG9ydGlvbiIsIm1hdGgiLCJjbGFtcCIsIk1hdGgiLCJhYnMiLCJsZXJwIiwib25VcGRhdGUiLCJvbkVuYWJsZSIsIm9uUGFyZW50Q29tcG9uZW50RW5hYmxlIiwib25EaXNhYmxlIiwib25SZW1vdmUiLCJjb2xvcjQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFZQSxNQUFNQSxXQUFXLEdBQUc7QUFDaEJDLEVBQUFBLE9BQU8sRUFBRSxTQUFTO0FBQ2xCQyxFQUFBQSxLQUFLLEVBQUUsT0FBTztBQUNkQyxFQUFBQSxPQUFPLEVBQUUsU0FBUztBQUNsQkMsRUFBQUEsUUFBUSxFQUFFLFVBQUE7QUFDZCxDQUFDLENBQUE7QUFFRCxNQUFNQyxvQkFBb0IsR0FBRyxFQUFFLENBQUE7QUFDL0JBLG9CQUFvQixDQUFDTCxXQUFXLENBQUNDLE9BQU8sQ0FBQyxHQUFHLGNBQWMsQ0FBQTtBQUMxREksb0JBQW9CLENBQUNMLFdBQVcsQ0FBQ0UsS0FBSyxDQUFDLEdBQUcsV0FBVyxDQUFBO0FBQ3JERyxvQkFBb0IsQ0FBQ0wsV0FBVyxDQUFDRyxPQUFPLENBQUMsR0FBRyxhQUFhLENBQUE7QUFDekRFLG9CQUFvQixDQUFDTCxXQUFXLENBQUNJLFFBQVEsQ0FBQyxHQUFHLGNBQWMsQ0FBQTtBQUUzRCxNQUFNRSw0QkFBNEIsR0FBRyxFQUFFLENBQUE7QUFDdkNBLDRCQUE0QixDQUFDTixXQUFXLENBQUNDLE9BQU8sQ0FBQyxHQUFHLHFCQUFxQixDQUFBO0FBQ3pFSyw0QkFBNEIsQ0FBQ04sV0FBVyxDQUFDRSxLQUFLLENBQUMsR0FBRyxrQkFBa0IsQ0FBQTtBQUNwRUksNEJBQTRCLENBQUNOLFdBQVcsQ0FBQ0csT0FBTyxDQUFDLEdBQUcsb0JBQW9CLENBQUE7QUFDeEVHLDRCQUE0QixD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
