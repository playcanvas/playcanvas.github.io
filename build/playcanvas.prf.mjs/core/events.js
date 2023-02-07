/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
