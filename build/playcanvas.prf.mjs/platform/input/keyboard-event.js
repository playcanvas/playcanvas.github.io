/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
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
