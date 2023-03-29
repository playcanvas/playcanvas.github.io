/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * Represents the resource of an audio asset.
 */
class Sound {
  /**
   * If the Web Audio API is not supported this contains the audio data.
   *
   * @type {HTMLAudioElement}
   */

  /**
   * If the Web Audio API is supported this contains the audio data.
   *
   * @type {AudioBuffer}
   */

  /**
   * Create a new Sound instance.
   *
   * @param {HTMLAudioElement|AudioBuffer} resource - If the Web Audio API is supported, pass an
   * AudioBuffer object, otherwise an Audio object.
   */
  constructor(resource) {
    this.audio = void 0;
    this.buffer = void 0;
    if (resource instanceof Audio) {
      this.audio = resource;
    } else {
      this.buffer = resource;
    }
  }

  /**
   * Gets the duration of the sound. If the sound is not loaded it returns 0.
   *
   * @type {number}
   */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291bmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wbGF0Zm9ybS9zb3VuZC9zb3VuZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlcHJlc2VudHMgdGhlIHJlc291cmNlIG9mIGFuIGF1ZGlvIGFzc2V0LlxuICovXG5jbGFzcyBTb3VuZCB7XG4gICAgLyoqXG4gICAgICogSWYgdGhlIFdlYiBBdWRpbyBBUEkgaXMgbm90IHN1cHBvcnRlZCB0aGlzIGNvbnRhaW5zIHRoZSBhdWRpbyBkYXRhLlxuICAgICAqXG4gICAgICogQHR5cGUge0hUTUxBdWRpb0VsZW1lbnR9XG4gICAgICovXG4gICAgYXVkaW87XG5cbiAgICAgLyoqXG4gICAgICAqIElmIHRoZSBXZWIgQXVkaW8gQVBJIGlzIHN1cHBvcnRlZCB0aGlzIGNvbnRhaW5zIHRoZSBhdWRpbyBkYXRhLlxuICAgICAgKlxuICAgICAgKiBAdHlwZSB7QXVkaW9CdWZmZXJ9XG4gICAgICAqL1xuICAgIGJ1ZmZlcjtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBTb3VuZCBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEF1ZGlvRWxlbWVudHxBdWRpb0J1ZmZlcn0gcmVzb3VyY2UgLSBJZiB0aGUgV2ViIEF1ZGlvIEFQSSBpcyBzdXBwb3J0ZWQsIHBhc3MgYW5cbiAgICAgKiBBdWRpb0J1ZmZlciBvYmplY3QsIG90aGVyd2lzZSBhbiBBdWRpbyBvYmplY3QuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IocmVzb3VyY2UpIHtcbiAgICAgICAgaWYgKHJlc291cmNlIGluc3RhbmNlb2YgQXVkaW8pIHtcbiAgICAgICAgICAgIHRoaXMuYXVkaW8gPSByZXNvdXJjZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyID0gcmVzb3VyY2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBHZXRzIHRoZSBkdXJhdGlvbiBvZiB0aGUgc291bmQuIElmIHRoZSBzb3VuZCBpcyBub3QgbG9hZGVkIGl0IHJldHVybnMgMC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICovXG4gICAgZ2V0IGR1cmF0aW9uKCkge1xuICAgICAgICBsZXQgZHVyYXRpb24gPSAwO1xuICAgICAgICBpZiAodGhpcy5idWZmZXIpIHtcbiAgICAgICAgICAgIGR1cmF0aW9uID0gdGhpcy5idWZmZXIuZHVyYXRpb247XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5hdWRpbykge1xuICAgICAgICAgICAgZHVyYXRpb24gPSB0aGlzLmF1ZGlvLmR1cmF0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGR1cmF0aW9uIHx8IDA7XG4gICAgfVxufVxuXG5leHBvcnQgeyBTb3VuZCB9O1xuIl0sIm5hbWVzIjpbIlNvdW5kIiwiY29uc3RydWN0b3IiLCJyZXNvdXJjZSIsImF1ZGlvIiwiYnVmZmVyIiwiQXVkaW8iLCJkdXJhdGlvbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxLQUFLLENBQUM7QUFDUjtBQUNKO0FBQ0E7QUFDQTtBQUNBOztBQUdLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7O0FBR0k7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLFdBQVcsQ0FBQ0MsUUFBUSxFQUFFO0FBQUEsSUFBQSxJQUFBLENBZnRCQyxLQUFLLEdBQUEsS0FBQSxDQUFBLENBQUE7QUFBQSxJQUFBLElBQUEsQ0FPTEMsTUFBTSxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBU0YsSUFBSUYsUUFBUSxZQUFZRyxLQUFLLEVBQUU7TUFDM0IsSUFBSSxDQUFDRixLQUFLLEdBQUdELFFBQVEsQ0FBQTtBQUN6QixLQUFDLE1BQU07TUFDSCxJQUFJLENBQUNFLE1BQU0sR0FBR0YsUUFBUSxDQUFBO0FBQzFCLEtBQUE7QUFDSixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDSSxFQUFBLElBQUlJLFFBQVEsR0FBRztJQUNYLElBQUlBLFFBQVEsR0FBRyxDQUFDLENBQUE7SUFDaEIsSUFBSSxJQUFJLENBQUNGLE1BQU0sRUFBRTtBQUNiRSxNQUFBQSxRQUFRLEdBQUcsSUFBSSxDQUFDRixNQUFNLENBQUNFLFFBQVEsQ0FBQTtBQUNuQyxLQUFDLE1BQU0sSUFBSSxJQUFJLENBQUNILEtBQUssRUFBRTtBQUNuQkcsTUFBQUEsUUFBUSxHQUFHLElBQUksQ0FBQ0gsS0FBSyxDQUFDRyxRQUFRLENBQUE7QUFDbEMsS0FBQTtJQUVBLE9BQU9BLFFBQVEsSUFBSSxDQUFDLENBQUE7QUFDeEIsR0FBQTtBQUNKOzs7OyJ9
