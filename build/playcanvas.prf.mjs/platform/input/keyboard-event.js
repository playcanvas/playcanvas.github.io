/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
