function getTouchTargetCoords(touch) {
	let totalOffsetX = 0;
	let totalOffsetY = 0;
	let target = touch.target;
	while (!(target instanceof HTMLElement)) {
		target = target.parentNode;
	}
	let currentElement = target;
	do {
		totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
		totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
		currentElement = currentElement.offsetParent;
	} while (currentElement);
	return {
		x: touch.pageX - totalOffsetX,
		y: touch.pageY - totalOffsetY
	};
}
class Touch {
	constructor(touch) {
		const coords = getTouchTargetCoords(touch);
		this.id = touch.identifier;
		this.x = coords.x;
		this.y = coords.y;
		this.target = touch.target;
		this.touch = touch;
	}
}
class TouchEvent {
	constructor(device, event) {
		this.element = event.target;
		this.event = event;
		this.touches = [];
		this.changedTouches = [];
		if (event) {
			for (let i = 0, l = event.touches.length; i < l; i++) {
				this.touches.push(new Touch(event.touches[i]));
			}
			for (let i = 0, l = event.changedTouches.length; i < l; i++) {
				this.changedTouches.push(new Touch(event.changedTouches[i]));
			}
		}
	}
	getTouchById(id, list) {
		for (let i = 0, l = list.length; i < l; i++) {
			if (list[i].id === id) {
				return list[i];
			}
		}
		return null;
	}
}

export { Touch, TouchEvent, getTouchTargetCoords };
