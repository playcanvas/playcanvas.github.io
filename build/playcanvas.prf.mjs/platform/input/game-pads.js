/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
const MAPS = {
  DEFAULT: {
    buttons: [
    'PAD_FACE_1', 'PAD_FACE_2', 'PAD_FACE_3', 'PAD_FACE_4',
    'PAD_L_SHOULDER_1', 'PAD_R_SHOULDER_1', 'PAD_L_SHOULDER_2', 'PAD_R_SHOULDER_2',
    'PAD_SELECT', 'PAD_START', 'PAD_L_STICK_BUTTON', 'PAD_R_STICK_BUTTON',
    'PAD_UP', 'PAD_DOWN', 'PAD_LEFT', 'PAD_RIGHT',
    'PAD_VENDOR'],
    axes: [
    'PAD_L_STICK_X', 'PAD_L_STICK_Y', 'PAD_R_STICK_X', 'PAD_R_STICK_Y']
  },
  PS3: {
    buttons: [
    'PAD_FACE_1', 'PAD_FACE_2', 'PAD_FACE_4', 'PAD_FACE_3',
    'PAD_L_SHOULDER_1', 'PAD_R_SHOULDER_1', 'PAD_L_SHOULDER_2', 'PAD_R_SHOULDER_2',
    'PAD_SELECT', 'PAD_START', 'PAD_L_STICK_BUTTON', 'PAD_R_STICK_BUTTON',
    'PAD_UP', 'PAD_DOWN', 'PAD_LEFT', 'PAD_RIGHT', 'PAD_VENDOR'],
    axes: [
    'PAD_L_STICK_X', 'PAD_L_STICK_Y', 'PAD_R_STICK_X', 'PAD_R_STICK_Y']
  }
};
const PRODUCT_CODES = {
  'Product: 0268': 'PS3'
};

class GamePads {
  constructor() {
    this.gamepadsSupported = !!navigator.getGamepads || !!navigator.webkitGetGamepads;
    this.current = [];
    this.previous = [];
    this.deadZone = 0.25;
  }

  update() {
    for (let i = 0, l = this.current.length; i < l; i++) {
      const buttons = this.current[i].pad.buttons;
      const buttonsLen = buttons.length;
      for (let j = 0; j < buttonsLen; j++) {
        if (this.previous[i] === undefined) {
          this.previous[i] = [];
        }
        this.previous[i][j] = buttons[j].pressed;
      }
    }

    this.poll(this.current);
  }

  poll(pads = []) {
    if (pads.length > 0) {
      pads.length = 0;
    }
    if (this.gamepadsSupported) {
      const padDevices = navigator.getGamepads ? navigator.getGamepads() : navigator.webkitGetGamepads();
      for (let i = 0, len = padDevices.length; i < len; i++) {
        if (padDevices[i]) {
          pads.push({
            map: this.getMap(padDevices[i]),
            pad: padDevices[i]
          });
        }
      }
    }
    return pads;
  }
  getMap(pad) {
    for (const code in PRODUCT_CODES) {
      if (pad.id.indexOf(code) >= 0) {
        return MAPS[PRODUCT_CODES[code]];
      }
    }
    return MAPS.DEFAULT;
  }

  isPressed(index, button) {
    if (!this.current[index]) {
      return false;
    }
    const key = this.current[index].map.buttons[button];
    return this.current[index].pad.buttons[pc[key]].pressed;
  }

  wasPressed(index, button) {
    if (!this.current[index]) {
      return false;
    }
    const key = this.current[index].map.buttons[button];
    const i = pc[key];

    return this.current[index].pad.buttons[i].pressed && !(this.previous[index] && this.previous[index][i]);
  }

  wasReleased(index, button) {
    if (!this.current[index]) {
      return false;
    }
    const key = this.current[index].map.buttons[button];
    const i = pc[key];

    return !this.current[index].pad.buttons[i].pressed && this.previous[index] && this.previous[index][i];
  }

  getAxis(index, axes) {
    if (!this.current[index]) {
      return 0;
    }
    const key = this.current[index].map.axes[axes];
    let value = this.current[index].pad.axes[pc[key]];
    if (Math.abs(value) < this.deadZone) {
      value = 0;
    }
    return value;
  }
}

export { GamePads };
