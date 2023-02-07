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
