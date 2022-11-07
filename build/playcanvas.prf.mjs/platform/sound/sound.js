/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class Sound {

  constructor(resource) {
    this.audio = void 0;
    this.buffer = void 0;
    if (resource instanceof Audio) {
      this.audio = resource;
    } else {
      this.buffer = resource;
    }
  }

  get duration() {
    let duration = 0;
    if (this.buffer) {
      duration = this.buffer.duration;
    } else if (this.audio) {
      duration = this.audio.duration;
    }
    return duration || 0;
  }
}

export { Sound };
