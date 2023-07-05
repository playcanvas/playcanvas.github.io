import { EventHandler } from '../../core/event-handler.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

class XrTrackedImage extends EventHandler {
	constructor(image, width) {
		super();
		this._image = void 0;
		this._width = void 0;
		this._bitmap = null;
		this._measuredWidth = 0;
		this._trackable = false;
		this._tracking = false;
		this._emulated = false;
		this._pose = null;
		this._position = new Vec3();
		this._rotation = new Quat();
		this._image = image;
		this._width = width;
	}
	get image() {
		return this._image;
	}
	set width(value) {
		this._width = value;
	}
	get width() {
		return this._width;
	}
	get trackable() {
		return this._trackable;
	}
	get tracking() {
		return this._tracking;
	}
	get emulated() {
		return this._emulated;
	}
	prepare() {
		if (this._bitmap) {
			return {
				image: this._bitmap,
				widthInMeters: this._width
			};
		}
		return createImageBitmap(this._image).then(bitmap => {
			this._bitmap = bitmap;
			return {
				image: this._bitmap,
				widthInMeters: this._width
			};
		});
	}
	destroy() {
		this._image = null;
		this._pose = null;
		if (this._bitmap) {
			this._bitmap.close();
			this._bitmap = null;
		}
	}
	getPosition() {
		if (this._pose) this._position.copy(this._pose.transform.position);
		return this._position;
	}
	getRotation() {
		if (this._pose) this._rotation.copy(this._pose.transform.orientation);
		return this._rotation;
	}
}

export { XrTrackedImage };
