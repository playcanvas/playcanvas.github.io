/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class XrFinger {
  constructor(index, hand) {
    this._index = void 0;
    this._hand = void 0;
    this._joints = [];
    this._tip = null;
    this._index = index;
    this._hand = hand;

    this._hand._fingers.push(this);
  }

  get index() {
    return this._index;
  }

  get hand() {
    return this._hand;
  }

  get joints() {
    return this._joints;
  }

  get tip() {
    return this._tip;
  }

}

export { XrFinger };
