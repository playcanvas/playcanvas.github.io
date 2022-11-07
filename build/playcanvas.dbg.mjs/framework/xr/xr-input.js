/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from '../../core/event-handler.js';
import { XrInputSource } from './xr-input-source.js';

class XrInput extends EventHandler {

  constructor(manager) {
    super();
    this.manager = void 0;
    this._inputSources = [];
    this._onInputSourcesChangeEvt = void 0;
    this.manager = manager;
    this._onInputSourcesChangeEvt = evt => {
      this._onInputSourcesChange(evt);
    };
    this.manager.on('start', this._onSessionStart, this);
    this.manager.on('end', this._onSessionEnd, this);
  }

  _onSessionStart() {
    const session = this.manager.session;
    session.addEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
    session.addEventListener('select', evt => {
      const inputSource = this._getByInputSource(evt.inputSource);
      inputSource.update(evt.frame);
      inputSource.fire('select', evt);
      this.fire('select', inputSource, evt);
    });
    session.addEventListener('selectstart', evt => {
      const inputSource = this._getByInputSource(evt.inputSource);
      inputSource.update(evt.frame);
      inputSource._selecting = true;
      inputSource.fire('selectstart', evt);
      this.fire('selectstart', inputSource, evt);
    });
    session.addEventListener('selectend', evt => {
      const inputSource = this._getByInputSource(evt.inputSource);
      inputSource.update(evt.frame);
      inputSource._selecting = false;
      inputSource.fire('selectend', evt);
      this.fire('selectend', inputSource, evt);
    });
    session.addEventListener('squeeze', evt => {
      const inputSource = this._getByInputSource(evt.inputSource);
      inputSource.update(evt.frame);
      inputSource.fire('squeeze', evt);
      this.fire('squeeze', inputSource, evt);
    });
    session.addEventListener('squeezestart', evt => {
      const inputSource = this._getByInputSource(evt.inputSource);
      inputSource.update(evt.frame);
      inputSource._squeezing = true;
      inputSource.fire('squeezestart', evt);
      this.fire('squeezestart', inputSource, evt);
    });
    session.addEventListener('squeezeend', evt => {
      const inputSource = this._getByInputSource(evt.inputSource);
      inputSource.update(evt.frame);
      inputSource._squeezing = false;
      inputSource.fire('squeezeend', evt);
      this.fire('squeezeend', inputSource, evt);
    });

    const inputSources = session.inputSources;
    for (let i = 0; i < inputSources.length; i++) {
      this._addInputSource(inputSources[i]);
    }
  }

  _onSessionEnd() {
    let i = this._inputSources.length;
    while (i--) {
      const inputSource = this._inputSources[i];
      this._inputSources.splice(i, 1);
      inputSource.fire('remove');
      this.fire('remove', inputSource);
    }
    const session = this.manager.session;
    session.removeEventListener('inputsourceschange', this._onInputSourcesChangeEvt);
  }

  _onInputSourcesChange(evt) {
    for (let i = 0; i < evt.removed.length; i++) {
      this._removeInputSource(evt.removed[i]);
    }

    for (let i = 0; i < evt.added.length; i++) {
      this._addInputSource(evt.added[i]);
    }
  }

  _getByInputSource(xrInputSource) {
    for (let i = 0; i < this._inputSources.length; i++) {
      if (this._inputSources[i].inputSource === xrInputSource) {
        return this._inputSources[i];
      }
    }
    return null;
  }

  _addInputSource(xrInputSource) {
    if (this._getByInputSource(xrInputSource)) return;
    const inputSource = new XrInputSource(this.manager, xrInputSource);
    this._inputSources.push(inputSource);
    this.fire('add', inputSource);
  }

  _removeInputSource(xrInputSource) {
    for (let i = 0; i < this._inputSources.length; i++) {
      if (this._inputSources[i].inputSource !== xrInputSource) continue;
      const inputSource = this._inputSources[i];
      this._inputSources.splice(i, 1);
      let h = inputSource.hitTestSources.length;
      while (h--) {
        inputSource.hitTestSources[h].remove();
      }
      inputSource.fire('remove');
      this.fire('remove', inputSource);
      return;
    }
  }

  update(frame) {
    for (let i = 0; i < this._inputSources.length; i++) {
      this._inputSources[i].update(frame);
    }
  }

  get inputSources() {
    return this._inputSources;
  }
}

export { XrInput };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHItaW5wdXQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsveHIveHItaW5wdXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi4vLi4vY29yZS9ldmVudC1oYW5kbGVyLmpzJztcblxuaW1wb3J0IHsgWHJJbnB1dFNvdXJjZSB9IGZyb20gJy4veHItaW5wdXQtc291cmNlLmpzJztcblxuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4veHItbWFuYWdlci5qcycpLlhyTWFuYWdlcn0gWHJNYW5hZ2VyICovXG5cbi8qKlxuICogUHJvdmlkZXMgYWNjZXNzIHRvIGlucHV0IHNvdXJjZXMgZm9yIFdlYlhSLlxuICpcbiAqIEBhdWdtZW50cyBFdmVudEhhbmRsZXJcbiAqL1xuY2xhc3MgWHJJbnB1dCBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG4gICAgLyoqXG4gICAgICogQHR5cGUge1hyTWFuYWdlcn1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIG1hbmFnZXI7XG5cbiAgICAvKipcbiAgICAgKiBAdHlwZSB7WHJJbnB1dFNvdXJjZVtdfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2lucHV0U291cmNlcyA9IFtdO1xuXG4gICAgLyoqXG4gICAgICogQHR5cGUge0Z1bmN0aW9ufVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uSW5wdXRTb3VyY2VzQ2hhbmdlRXZ0O1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFhySW5wdXQgaW5zdGFuY2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1hyTWFuYWdlcn0gbWFuYWdlciAtIFdlYlhSIE1hbmFnZXIuXG4gICAgICogQGhpZGVjb25zdHJ1Y3RvclxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG1hbmFnZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcblxuICAgICAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuXG4gICAgICAgIHRoaXMuX29uSW5wdXRTb3VyY2VzQ2hhbmdlRXZ0ID0gKGV2dCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5fb25JbnB1dFNvdXJjZXNDaGFuZ2UoZXZ0KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLm1hbmFnZXIub24oJ3N0YXJ0JywgdGhpcy5fb25TZXNzaW9uU3RhcnQsIHRoaXMpO1xuICAgICAgICB0aGlzLm1hbmFnZXIub24oJ2VuZCcsIHRoaXMuX29uU2Vzc2lvbkVuZCwgdGhpcyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiBuZXcge0BsaW5rIFhySW5wdXRTb3VyY2V9IGlzIGFkZGVkIHRvIHRoZSBsaXN0LlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySW5wdXQjYWRkXG4gICAgICogQHBhcmFtIHtYcklucHV0U291cmNlfSBpbnB1dFNvdXJjZSAtIElucHV0IHNvdXJjZSB0aGF0IGhhcyBiZWVuIGFkZGVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLmlucHV0Lm9uKCdhZGQnLCBmdW5jdGlvbiAoaW5wdXRTb3VyY2UpIHtcbiAgICAgKiAgICAgLy8gbmV3IGlucHV0IHNvdXJjZSBpcyBhZGRlZFxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB7QGxpbmsgWHJJbnB1dFNvdXJjZX0gaXMgcmVtb3ZlZCB0byB0aGUgbGlzdC5cbiAgICAgKlxuICAgICAqIEBldmVudCBYcklucHV0I3JlbW92ZVxuICAgICAqIEBwYXJhbSB7WHJJbnB1dFNvdXJjZX0gaW5wdXRTb3VyY2UgLSBJbnB1dCBzb3VyY2UgdGhhdCBoYXMgYmVlbiByZW1vdmVkLlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXBwLnhyLmlucHV0Lm9uKCdyZW1vdmUnLCBmdW5jdGlvbiAoaW5wdXRTb3VyY2UpIHtcbiAgICAgKiAgICAgLy8gaW5wdXQgc291cmNlIGlzIHJlbW92ZWRcbiAgICAgKiB9KTtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEZpcmVkIHdoZW4ge0BsaW5rIFhySW5wdXRTb3VyY2V9IGhhcyB0cmlnZ2VyZWQgcHJpbWFyeSBhY3Rpb24uIFRoaXMgY291bGQgYmUgcHJlc3NpbmcgYVxuICAgICAqIHRyaWdnZXIgYnV0dG9uLCBvciB0b3VjaGluZyBhIHNjcmVlbi5cbiAgICAgKlxuICAgICAqIEBldmVudCBYcklucHV0I3NlbGVjdFxuICAgICAqIEBwYXJhbSB7WHJJbnB1dFNvdXJjZX0gaW5wdXRTb3VyY2UgLSBJbnB1dCBzb3VyY2UgdGhhdCB0cmlnZ2VyZWQgc2VsZWN0IGV2ZW50LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldnQgLSBYUklucHV0U291cmNlRXZlbnQgZXZlbnQgZGF0YSBmcm9tIFdlYlhSIEFQSS5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHZhciByYXkgPSBuZXcgcGMuUmF5KCk7XG4gICAgICogYXBwLnhyLmlucHV0Lm9uKCdzZWxlY3QnLCBmdW5jdGlvbiAoaW5wdXRTb3VyY2UsIGV2dCkge1xuICAgICAqICAgICByYXkuc2V0KGlucHV0U291cmNlLmdldE9yaWdpbigpLCBpbnB1dFNvdXJjZS5nZXREaXJlY3Rpb24oKSk7XG4gICAgICogICAgIGlmIChvYmouaW50ZXJzZWN0c1JheShyYXkpKSB7XG4gICAgICogICAgICAgICAvLyBzZWxlY3RlZCBhbiBvYmplY3Qgd2l0aCBpbnB1dCBzb3VyY2VcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB7QGxpbmsgWHJJbnB1dFNvdXJjZX0gaGFzIHN0YXJ0ZWQgdG8gdHJpZ2dlciBwcmltYXJ5IGFjdGlvbi5cbiAgICAgKlxuICAgICAqIEBldmVudCBYcklucHV0I3NlbGVjdHN0YXJ0XG4gICAgICogQHBhcmFtIHtYcklucHV0U291cmNlfSBpbnB1dFNvdXJjZSAtIElucHV0IHNvdXJjZSB0aGF0IHRyaWdnZXJlZCBzZWxlY3RzdGFydCBldmVudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZXZ0IC0gWFJJbnB1dFNvdXJjZUV2ZW50IGV2ZW50IGRhdGEgZnJvbSBXZWJYUiBBUEkuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHtAbGluayBYcklucHV0U291cmNlfSBoYXMgZW5kZWQgdHJpZ2dlcnJpbmcgcHJpbWFyeSBhY3Rpb24uXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dCNzZWxlY3RlbmRcbiAgICAgKiBAcGFyYW0ge1hySW5wdXRTb3VyY2V9IGlucHV0U291cmNlIC0gSW5wdXQgc291cmNlIHRoYXQgdHJpZ2dlcmVkIHNlbGVjdGVuZCBldmVudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZXZ0IC0gWFJJbnB1dFNvdXJjZUV2ZW50IGV2ZW50IGRhdGEgZnJvbSBXZWJYUiBBUEkuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHtAbGluayBYcklucHV0U291cmNlfSBoYXMgdHJpZ2dlcmVkIHNxdWVlemUgYWN0aW9uLiBUaGlzIGlzIGFzc29jaWF0ZWQgd2l0aFxuICAgICAqIFwiZ3JhYmJpbmdcIiBhY3Rpb24gb24gdGhlIGNvbnRyb2xsZXJzLlxuICAgICAqXG4gICAgICogQGV2ZW50IFhySW5wdXQjc3F1ZWV6ZVxuICAgICAqIEBwYXJhbSB7WHJJbnB1dFNvdXJjZX0gaW5wdXRTb3VyY2UgLSBJbnB1dCBzb3VyY2UgdGhhdCB0cmlnZ2VyZWQgc3F1ZWV6ZSBldmVudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZXZ0IC0gWFJJbnB1dFNvdXJjZUV2ZW50IGV2ZW50IGRhdGEgZnJvbSBXZWJYUiBBUEkuXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBGaXJlZCB3aGVuIHtAbGluayBYcklucHV0U291cmNlfSBoYXMgc3RhcnRlZCB0byB0cmlnZ2VyIHNxZWV6ZSBhY3Rpb24uXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dCNzcXVlZXplc3RhcnRcbiAgICAgKiBAcGFyYW0ge1hySW5wdXRTb3VyY2V9IGlucHV0U291cmNlIC0gSW5wdXQgc291cmNlIHRoYXQgdHJpZ2dlcmVkIHNxdWVlemVzdGFydCBldmVudC5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZXZ0IC0gWFJJbnB1dFNvdXJjZUV2ZW50IGV2ZW50IGRhdGEgZnJvbSBXZWJYUiBBUEkuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBhcHAueHIuaW5wdXQub24oJ3NxdWVlemVzdGFydCcsIGZ1bmN0aW9uIChpbnB1dFNvdXJjZSwgZXZ0KSB7XG4gICAgICogICAgIGlmIChvYmouY29udGFpbnNQb2ludChpbnB1dFNvdXJjZS5nZXRQb3NpdGlvbigpKSkge1xuICAgICAqICAgICAgICAgLy8gZ3JhYmJlZCBhbiBvYmplY3RcbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRmlyZWQgd2hlbiB7QGxpbmsgWHJJbnB1dFNvdXJjZX0gaGFzIGVuZGVkIHRyaWdnZXJyaW5nIHNxZWV6ZSBhY3Rpb24uXG4gICAgICpcbiAgICAgKiBAZXZlbnQgWHJJbnB1dCNzcXVlZXplZW5kXG4gICAgICogQHBhcmFtIHtYcklucHV0U291cmNlfSBpbnB1dFNvdXJjZSAtIElucHV0IHNvdXJjZSB0aGF0IHRyaWdnZXJlZCBzcXVlZXplZW5kIGV2ZW50LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBldnQgLSBYUklucHV0U291cmNlRXZlbnQgZXZlbnQgZGF0YSBmcm9tIFdlYlhSIEFQSS5cbiAgICAgKi9cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblNlc3Npb25TdGFydCgpIHtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IHRoaXMubWFuYWdlci5zZXNzaW9uO1xuICAgICAgICBzZXNzaW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0c291cmNlc2NoYW5nZScsIHRoaXMuX29uSW5wdXRTb3VyY2VzQ2hhbmdlRXZ0KTtcblxuICAgICAgICBzZXNzaW9uLmFkZEV2ZW50TGlzdGVuZXIoJ3NlbGVjdCcsIChldnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0U291cmNlID0gdGhpcy5fZ2V0QnlJbnB1dFNvdXJjZShldnQuaW5wdXRTb3VyY2UpO1xuICAgICAgICAgICAgaW5wdXRTb3VyY2UudXBkYXRlKGV2dC5mcmFtZSk7XG4gICAgICAgICAgICBpbnB1dFNvdXJjZS5maXJlKCdzZWxlY3QnLCBldnQpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdzZWxlY3QnLCBpbnB1dFNvdXJjZSwgZXZ0KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlc3Npb24uYWRkRXZlbnRMaXN0ZW5lcignc2VsZWN0c3RhcnQnLCAoZXZ0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbnB1dFNvdXJjZSA9IHRoaXMuX2dldEJ5SW5wdXRTb3VyY2UoZXZ0LmlucHV0U291cmNlKTtcbiAgICAgICAgICAgIGlucHV0U291cmNlLnVwZGF0ZShldnQuZnJhbWUpO1xuICAgICAgICAgICAgaW5wdXRTb3VyY2UuX3NlbGVjdGluZyA9IHRydWU7XG4gICAgICAgICAgICBpbnB1dFNvdXJjZS5maXJlKCdzZWxlY3RzdGFydCcsIGV2dCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3NlbGVjdHN0YXJ0JywgaW5wdXRTb3VyY2UsIGV2dCk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZXNzaW9uLmFkZEV2ZW50TGlzdGVuZXIoJ3NlbGVjdGVuZCcsIChldnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0U291cmNlID0gdGhpcy5fZ2V0QnlJbnB1dFNvdXJjZShldnQuaW5wdXRTb3VyY2UpO1xuICAgICAgICAgICAgaW5wdXRTb3VyY2UudXBkYXRlKGV2dC5mcmFtZSk7XG4gICAgICAgICAgICBpbnB1dFNvdXJjZS5fc2VsZWN0aW5nID0gZmFsc2U7XG4gICAgICAgICAgICBpbnB1dFNvdXJjZS5maXJlKCdzZWxlY3RlbmQnLCBldnQpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdzZWxlY3RlbmQnLCBpbnB1dFNvdXJjZSwgZXZ0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2Vzc2lvbi5hZGRFdmVudExpc3RlbmVyKCdzcXVlZXplJywgKGV2dCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW5wdXRTb3VyY2UgPSB0aGlzLl9nZXRCeUlucHV0U291cmNlKGV2dC5pbnB1dFNvdXJjZSk7XG4gICAgICAgICAgICBpbnB1dFNvdXJjZS51cGRhdGUoZXZ0LmZyYW1lKTtcbiAgICAgICAgICAgIGlucHV0U291cmNlLmZpcmUoJ3NxdWVlemUnLCBldnQpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdzcXVlZXplJywgaW5wdXRTb3VyY2UsIGV2dCk7XG4gICAgICAgIH0pO1xuICAgICAgICBzZXNzaW9uLmFkZEV2ZW50TGlzdGVuZXIoJ3NxdWVlemVzdGFydCcsIChldnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGlucHV0U291cmNlID0gdGhpcy5fZ2V0QnlJbnB1dFNvdXJjZShldnQuaW5wdXRTb3VyY2UpO1xuICAgICAgICAgICAgaW5wdXRTb3VyY2UudXBkYXRlKGV2dC5mcmFtZSk7XG4gICAgICAgICAgICBpbnB1dFNvdXJjZS5fc3F1ZWV6aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIGlucHV0U291cmNlLmZpcmUoJ3NxdWVlemVzdGFydCcsIGV2dCk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3NxdWVlemVzdGFydCcsIGlucHV0U291cmNlLCBldnQpO1xuICAgICAgICB9KTtcbiAgICAgICAgc2Vzc2lvbi5hZGRFdmVudExpc3RlbmVyKCdzcXVlZXplZW5kJywgKGV2dCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgaW5wdXRTb3VyY2UgPSB0aGlzLl9nZXRCeUlucHV0U291cmNlKGV2dC5pbnB1dFNvdXJjZSk7XG4gICAgICAgICAgICBpbnB1dFNvdXJjZS51cGRhdGUoZXZ0LmZyYW1lKTtcbiAgICAgICAgICAgIGlucHV0U291cmNlLl9zcXVlZXppbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIGlucHV0U291cmNlLmZpcmUoJ3NxdWVlemVlbmQnLCBldnQpO1xuICAgICAgICAgICAgdGhpcy5maXJlKCdzcXVlZXplZW5kJywgaW5wdXRTb3VyY2UsIGV2dCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIGFkZCBpbnB1dCBzb3VyY2VzXG4gICAgICAgIGNvbnN0IGlucHV0U291cmNlcyA9IHNlc3Npb24uaW5wdXRTb3VyY2VzO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlucHV0U291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fYWRkSW5wdXRTb3VyY2UoaW5wdXRTb3VyY2VzW2ldKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBAcHJpdmF0ZSAqL1xuICAgIF9vblNlc3Npb25FbmQoKSB7XG4gICAgICAgIGxldCBpID0gdGhpcy5faW5wdXRTb3VyY2VzLmxlbmd0aDtcbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgY29uc3QgaW5wdXRTb3VyY2UgPSB0aGlzLl9pbnB1dFNvdXJjZXNbaV07XG4gICAgICAgICAgICB0aGlzLl9pbnB1dFNvdXJjZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgaW5wdXRTb3VyY2UuZmlyZSgncmVtb3ZlJyk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGlucHV0U291cmNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLm1hbmFnZXIuc2Vzc2lvbjtcbiAgICAgICAgc2Vzc2lvbi5yZW1vdmVFdmVudExpc3RlbmVyKCdpbnB1dHNvdXJjZXNjaGFuZ2UnLCB0aGlzLl9vbklucHV0U291cmNlc0NoYW5nZUV2dCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtYUklucHV0U291cmNlc0NoYW5nZUV2ZW50fSBldnQgLSBXZWJYUiBpbnB1dCBzb3VyY2VzIGNoYW5nZSBldmVudC5cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbklucHV0U291cmNlc0NoYW5nZShldnQpIHtcbiAgICAgICAgLy8gcmVtb3ZlXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZ0LnJlbW92ZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX3JlbW92ZUlucHV0U291cmNlKGV2dC5yZW1vdmVkW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFkZFxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2dC5hZGRlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5fYWRkSW5wdXRTb3VyY2UoZXZ0LmFkZGVkW2ldKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7WFJJbnB1dFNvdXJjZX0geHJJbnB1dFNvdXJjZSAtIElucHV0IHNvdXJjZSB0byBzZWFyY2ggZm9yLlxuICAgICAqIEByZXR1cm5zIHtYcklucHV0U291cmNlfG51bGx9IFRoZSBpbnB1dCBzb3VyY2UgdGhhdCBtYXRjaGVzIHRoZSBnaXZlbiBXZWJYUiBpbnB1dCBzb3VyY2Ugb3JcbiAgICAgKiBudWxsIGlmIG5vIG1hdGNoIGlzIGZvdW5kLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldEJ5SW5wdXRTb3VyY2UoeHJJbnB1dFNvdXJjZSkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2lucHV0U291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2lucHV0U291cmNlc1tpXS5pbnB1dFNvdXJjZSA9PT0geHJJbnB1dFNvdXJjZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9pbnB1dFNvdXJjZXNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge1hSSW5wdXRTb3VyY2V9IHhySW5wdXRTb3VyY2UgLSBJbnB1dCBzb3VyY2UgdG8gYWRkLlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZElucHV0U291cmNlKHhySW5wdXRTb3VyY2UpIHtcbiAgICAgICAgaWYgKHRoaXMuX2dldEJ5SW5wdXRTb3VyY2UoeHJJbnB1dFNvdXJjZSkpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgY29uc3QgaW5wdXRTb3VyY2UgPSBuZXcgWHJJbnB1dFNvdXJjZSh0aGlzLm1hbmFnZXIsIHhySW5wdXRTb3VyY2UpO1xuICAgICAgICB0aGlzLl9pbnB1dFNvdXJjZXMucHVzaChpbnB1dFNvdXJjZSk7XG4gICAgICAgIHRoaXMuZmlyZSgnYWRkJywgaW5wdXRTb3VyY2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7WFJJbnB1dFNvdXJjZX0geHJJbnB1dFNvdXJjZSAtIElucHV0IHNvdXJjZSB0byByZW1vdmUuXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVtb3ZlSW5wdXRTb3VyY2UoeHJJbnB1dFNvdXJjZSkge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuX2lucHV0U291cmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2lucHV0U291cmNlc1tpXS5pbnB1dFNvdXJjZSAhPT0geHJJbnB1dFNvdXJjZSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgY29uc3QgaW5wdXRTb3VyY2UgPSB0aGlzLl9pbnB1dFNvdXJjZXNbaV07XG4gICAgICAgICAgICB0aGlzLl9pbnB1dFNvdXJjZXMuc3BsaWNlKGksIDEpO1xuXG4gICAgICAgICAgICBsZXQgaCA9IGlucHV0U291cmNlLmhpdFRlc3RTb3VyY2VzLmxlbmd0aDtcbiAgICAgICAgICAgIHdoaWxlIChoLS0pIHtcbiAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5oaXRUZXN0U291cmNlc1toXS5yZW1vdmUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaW5wdXRTb3VyY2UuZmlyZSgncmVtb3ZlJyk7XG4gICAgICAgICAgICB0aGlzLmZpcmUoJ3JlbW92ZScsIGlucHV0U291cmNlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7Kn0gZnJhbWUgLSBYUkZyYW1lIGZyb20gcmVxdWVzdEFuaW1hdGlvbkZyYW1lIGNhbGxiYWNrLlxuICAgICAqIEBpZ25vcmVcbiAgICAgKi9cbiAgICB1cGRhdGUoZnJhbWUpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9pbnB1dFNvdXJjZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuX2lucHV0U291cmNlc1tpXS51cGRhdGUoZnJhbWUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogTGlzdCBvZiBhY3RpdmUge0BsaW5rIFhySW5wdXRTb3VyY2V9IGluc3RhbmNlcy5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtYcklucHV0U291cmNlW119XG4gICAgICovXG4gICAgZ2V0IGlucHV0U291cmNlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lucHV0U291cmNlcztcbiAgICB9XG59XG5cbmV4cG9ydCB7IFhySW5wdXQgfTtcbiJdLCJuYW1lcyI6WyJYcklucHV0IiwiRXZlbnRIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJtYW5hZ2VyIiwiX2lucHV0U291cmNlcyIsIl9vbklucHV0U291cmNlc0NoYW5nZUV2dCIsImV2dCIsIl9vbklucHV0U291cmNlc0NoYW5nZSIsIm9uIiwiX29uU2Vzc2lvblN0YXJ0IiwiX29uU2Vzc2lvbkVuZCIsInNlc3Npb24iLCJhZGRFdmVudExpc3RlbmVyIiwiaW5wdXRTb3VyY2UiLCJfZ2V0QnlJbnB1dFNvdXJjZSIsInVwZGF0ZSIsImZyYW1lIiwiZmlyZSIsIl9zZWxlY3RpbmciLCJfc3F1ZWV6aW5nIiwiaW5wdXRTb3VyY2VzIiwiaSIsImxlbmd0aCIsIl9hZGRJbnB1dFNvdXJjZSIsInNwbGljZSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJyZW1vdmVkIiwiX3JlbW92ZUlucHV0U291cmNlIiwiYWRkZWQiLCJ4cklucHV0U291cmNlIiwiWHJJbnB1dFNvdXJjZSIsInB1c2giLCJoIiwiaGl0VGVzdFNvdXJjZXMiLCJyZW1vdmUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBV0EsTUFBTUEsT0FBTyxTQUFTQyxZQUFZLENBQUM7O0VBeUIvQkMsV0FBVyxDQUFDQyxPQUFPLEVBQUU7QUFDakIsSUFBQSxLQUFLLEVBQUUsQ0FBQTtBQUFDLElBQUEsSUFBQSxDQXJCWkEsT0FBTyxHQUFBLEtBQUEsQ0FBQSxDQUFBO0lBQUEsSUFNUEMsQ0FBQUEsYUFBYSxHQUFHLEVBQUUsQ0FBQTtBQUFBLElBQUEsSUFBQSxDQU1sQkMsd0JBQXdCLEdBQUEsS0FBQSxDQUFBLENBQUE7SUFXcEIsSUFBSSxDQUFDRixPQUFPLEdBQUdBLE9BQU8sQ0FBQTtBQUV0QixJQUFBLElBQUksQ0FBQ0Usd0JBQXdCLEdBQUlDLEdBQUcsSUFBSztBQUNyQyxNQUFBLElBQUksQ0FBQ0MscUJBQXFCLENBQUNELEdBQUcsQ0FBQyxDQUFBO0tBQ2xDLENBQUE7QUFFRCxJQUFBLElBQUksQ0FBQ0gsT0FBTyxDQUFDSyxFQUFFLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQ0MsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFBO0FBQ3BELElBQUEsSUFBSSxDQUFDTixPQUFPLENBQUNLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDRSxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUE7QUFDcEQsR0FBQTs7QUF5RkFELEVBQUFBLGVBQWUsR0FBRztBQUNkLElBQUEsTUFBTUUsT0FBTyxHQUFHLElBQUksQ0FBQ1IsT0FBTyxDQUFDUSxPQUFPLENBQUE7SUFDcENBLE9BQU8sQ0FBQ0MsZ0JBQWdCLENBQUMsb0JBQW9CLEVBQUUsSUFBSSxDQUFDUCx3QkFB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