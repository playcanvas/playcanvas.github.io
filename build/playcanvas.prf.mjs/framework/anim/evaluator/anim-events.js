/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class AnimEvents {
  constructor(events) {
    this._events = [...events];
    this._events.sort((a, b) => a.time - b.time);
  }
  get events() {
    return this._events;
  }
}

export { AnimEvents };
