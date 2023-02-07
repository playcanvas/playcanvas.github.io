/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
