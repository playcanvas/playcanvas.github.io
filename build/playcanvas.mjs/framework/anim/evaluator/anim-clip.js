import { extends as _extends } from '../../../_virtual/_rollupPluginBabelHelpers.js';
import { AnimSnapshot } from './anim-snapshot.js';

class AnimClip {
	constructor(track, time, speed, playing, loop, eventHandler) {
		this._name = track.name;
		this._track = track;
		this._snapshot = new AnimSnapshot(track);
		this._playing = playing;
		this._time = time;
		this._speed = speed;
		this._loop = loop;
		this._blendWeight = 1.0;
		this._blendOrder = 0.0;
		this._eventHandler = eventHandler;
		this.alignCursorToCurrentTime();
	}
	set name(name) {
		this._name = name;
	}
	get name() {
		return this._name;
	}
	set track(track) {
		this._track = track;
		this._snapshot = new AnimSnapshot(track);
	}
	get track() {
		return this._track;
	}
	get snapshot() {
		return this._snapshot;
	}
	set time(time) {
		this._time = time;
		this.alignCursorToCurrentTime();
	}
	get time() {
		return this._time;
	}
	set speed(speed) {
		this._speed = speed;
	}
	get speed() {
		return this._speed;
	}
	set loop(loop) {
		this._loop = loop;
	}
	get loop() {
		return this._loop;
	}
	set blendWeight(blendWeight) {
		this._blendWeight = blendWeight;
	}
	get blendWeight() {
		return this._blendWeight;
	}
	set blendOrder(blendOrder) {
		this._blendOrder = blendOrder;
	}
	get blendOrder() {
		return this._blendOrder;
	}
	set eventCursor(value) {
		this._eventCursor = value;
	}
	get eventCursor() {
		return this._eventCursor;
	}
	alignCursorToCurrentTime() {
		this._eventCursor = 0;
		while (this._track.events[this._eventCursor] && this._track.events[this._eventCursor].time < this.time) {
			this._eventCursor++;
		}
	}
	activeEventsForFrame(frameStartTime, frameEndTime) {
		if (frameStartTime === 0) {
			this.eventCursor = 0;
		}
		let clippedFrameDuration;
		if (frameEndTime > this.track.duration) {
			clippedFrameDuration = frameEndTime - this.track.duration;
			frameEndTime = this.track.duration;
		}
		while (this.track.events[this.eventCursor] && this.track.events[this.eventCursor].time >= frameStartTime && (frameEndTime === this.track.duration ? this.track.events[this.eventCursor].time <= frameEndTime : this.track.events[this.eventCursor].time < frameEndTime)) {
			const event = this.track.events[this.eventCursor];
			this._eventHandler.fire(event.name, _extends({
				track: this.track
			}, event));
			this.eventCursor++;
		}
		if (Number.isFinite(clippedFrameDuration)) {
			this.activeEventsForFrame(0, clippedFrameDuration);
		}
	}
	progressForTime(time) {
		return time * this._speed / this._track.duration;
	}
	_update(deltaTime) {
		if (this._playing) {
			let time = this._time;
			const duration = this._track.duration;
			const speed = this._speed;
			const loop = this._loop;
			if (this._track.events.length > 0 && duration > 0) {
				this.activeEventsForFrame(time, time + speed * deltaTime);
			}
			time += speed * deltaTime;
			if (speed >= 0) {
				if (time > duration) {
					if (loop) {
						time = time % duration || 0;
					} else {
						time = this._track.duration;
						this.pause();
					}
				}
			} else {
				if (time < 0) {
					if (loop) {
						time = duration + (time % duration || 0);
					} else {
						time = 0;
						this.pause();
					}
				}
			}
			this._time = time;
		}
		if (this._time !== this._snapshot._time) {
			this._track.eval(this._time, this._snapshot);
		}
	}
	play() {
		this._playing = true;
		this._time = 0;
	}
	stop() {
		this._playing = false;
		this._time = 0;
	}
	pause() {
		this._playing = false;
	}
	resume() {
		this._playing = true;
	}
	reset() {
		this._time = 0;
	}
}

export { AnimClip };
