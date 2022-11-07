/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class KeyboardEvent {
  constructor(keyboard, event) {
    if (event) {
      this.key = event.keyCode;
      this.element = event.target;
      this.event = event;
    } else {
      this.key = null;
      this.element = null;
      this.event = null;
    }
  }
}

export { KeyboardEvent };