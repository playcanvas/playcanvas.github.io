/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from './event-handler.js';

const events = {
  attach: function (target) {
    const ev = events;
    target._addCallback = ev._addCallback;
    target.on = ev.on;
    target.off = ev.off;
    target.fire = ev.fire;
    target.once = ev.once;
    target.hasEvent = ev.hasEvent;
    target._callbacks = {};
    target._callbackActive = {};
    return target;
  },
  _addCallback: EventHandler.prototype._addCallback,
  on: EventHandler.prototype.on,
  off: EventHandler.prototype.off,
  fire: EventHandler.prototype.fire,
  once: EventHandler.prototype.once,
  hasEvent: EventHandler.prototype.hasEvent
};

export { events };
