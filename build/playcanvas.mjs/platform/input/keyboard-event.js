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
