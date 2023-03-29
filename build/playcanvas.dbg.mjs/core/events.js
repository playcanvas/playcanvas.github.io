/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from './event-handler.js';

const events = {
  /**
   * Attach event methods 'on', 'off', 'fire', 'once' and 'hasEvent' to the target object.
   *
   * @param {object} target - The object to add events to.
   * @returns {object} The target object.
   * @example
   * var obj = { };
   * pc.events.attach(obj);
   * @ignore
   */
  attach: function (target) {
    const ev = events;
    target._addCallback = ev._addCallback;
    target.on = ev.on;
    target.off = ev.off;
    target.fire = ev.fire;
    target.once = ev.once;
    target.hasEvent = ev.hasEvent;
    target._callbacks = {};
    target._callbackActive = {};
    return target;
  },
  _addCallback: EventHandler.prototype._addCallback,
  on: EventHandler.prototype.on,
  off: EventHandler.prototype.off,
  fire: EventHandler.prototype.fire,
  once: EventHandler.prototype.once,
  hasEvent: EventHandler.prototype.hasEvent
};

export { events };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29yZS9ldmVudHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi9ldmVudC1oYW5kbGVyLmpzJztcblxuY29uc3QgZXZlbnRzID0ge1xuICAgIC8qKlxuICAgICAqIEF0dGFjaCBldmVudCBtZXRob2RzICdvbicsICdvZmYnLCAnZmlyZScsICdvbmNlJyBhbmQgJ2hhc0V2ZW50JyB0byB0aGUgdGFyZ2V0IG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB0YXJnZXQgLSBUaGUgb2JqZWN0IHRvIGFkZCBldmVudHMgdG8uXG4gICAgICogQHJldHVybnMge29iamVjdH0gVGhlIHRhcmdldCBvYmplY3QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgb2JqID0geyB9O1xuICAgICAqIHBjLmV2ZW50cy5hdHRhY2gob2JqKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXR0YWNoOiBmdW5jdGlvbiAodGFyZ2V0KSB7XG4gICAgICAgIGNvbnN0IGV2ID0gZXZlbnRzO1xuICAgICAgICB0YXJnZXQuX2FkZENhbGxiYWNrID0gZXYuX2FkZENhbGxiYWNrO1xuICAgICAgICB0YXJnZXQub24gPSBldi5vbjtcbiAgICAgICAgdGFyZ2V0Lm9mZiA9IGV2Lm9mZjtcbiAgICAgICAgdGFyZ2V0LmZpcmUgPSBldi5maXJlO1xuICAgICAgICB0YXJnZXQub25jZSA9IGV2Lm9uY2U7XG4gICAgICAgIHRhcmdldC5oYXNFdmVudCA9IGV2Lmhhc0V2ZW50O1xuICAgICAgICB0YXJnZXQuX2NhbGxiYWNrcyA9IHsgfTtcbiAgICAgICAgdGFyZ2V0Ll9jYWxsYmFja0FjdGl2ZSA9IHsgfTtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9LFxuXG4gICAgX2FkZENhbGxiYWNrOiBFdmVudEhhbmRsZXIucHJvdG90eXBlLl9hZGRDYWxsYmFjayxcbiAgICBvbjogRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5vbixcbiAgICBvZmY6IEV2ZW50SGFuZGxlci5wcm90b3R5cGUub2ZmLFxuICAgIGZpcmU6IEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZmlyZSxcbiAgICBvbmNlOiBFdmVudEhhbmRsZXIucHJvdG90eXBlLm9uY2UsXG4gICAgaGFzRXZlbnQ6IEV2ZW50SGFuZGxlci5wcm90b3R5cGUuaGFzRXZlbnRcbn07XG5cbmV4cG9ydCB7IGV2ZW50cyB9O1xuIl0sIm5hbWVzIjpbImV2ZW50cyIsImF0dGFjaCIsInRhcmdldCIsImV2IiwiX2FkZENhbGxiYWNrIiwib24iLCJvZmYiLCJmaXJlIiwib25jZSIsImhhc0V2ZW50IiwiX2NhbGxiYWNrcyIsIl9jYWxsYmFja0FjdGl2ZSIsIkV2ZW50SGFuZGxlciIsInByb3RvdHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBLE1BQU1BLE1BQU0sR0FBRztBQUNYO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0lDLE1BQU0sRUFBRSxVQUFVQyxNQUFNLEVBQUU7SUFDdEIsTUFBTUMsRUFBRSxHQUFHSCxNQUFNLENBQUE7QUFDakJFLElBQUFBLE1BQU0sQ0FBQ0UsWUFBWSxHQUFHRCxFQUFFLENBQUNDLFlBQVksQ0FBQTtBQUNyQ0YsSUFBQUEsTUFBTSxDQUFDRyxFQUFFLEdBQUdGLEVBQUUsQ0FBQ0UsRUFBRSxDQUFBO0FBQ2pCSCxJQUFBQSxNQUFNLENBQUNJLEdBQUcsR0FBR0gsRUFBRSxDQUFDRyxHQUFHLENBQUE7QUFDbkJKLElBQUFBLE1BQU0sQ0FBQ0ssSUFBSSxHQUFHSixFQUFFLENBQUNJLElBQUksQ0FBQTtBQUNyQkwsSUFBQUEsTUFBTSxDQUFDTSxJQUFJLEdBQUdMLEVBQUUsQ0FBQ0ssSUFBSSxDQUFBO0FBQ3JCTixJQUFBQSxNQUFNLENBQUNPLFFBQVEsR0FBR04sRUFBRSxDQUFDTSxRQUFRLENBQUE7QUFDN0JQLElBQUFBLE1BQU0sQ0FBQ1EsVUFBVSxHQUFHLEVBQUcsQ0FBQTtBQUN2QlIsSUFBQUEsTUFBTSxDQUFDUyxlQUFlLEdBQUcsRUFBRyxDQUFBO0FBQzVCLElBQUEsT0FBT1QsTUFBTSxDQUFBO0dBQ2hCO0FBRURFLEVBQUFBLFlBQVksRUFBRVEsWUFBWSxDQUFDQyxTQUFTLENBQUNULFlBQVk7QUFDakRDLEVBQUFBLEVBQUUsRUFBRU8sWUFBWSxDQUFDQyxTQUFTLENBQUNSLEVBQUU7QUFDN0JDLEVBQUFBLEdBQUcsRUFBRU0sWUFBWSxDQUFDQyxTQUFTLENBQUNQLEdBQUc7QUFDL0JDLEVBQUFBLElBQUksRUFBRUssWUFBWSxDQUFDQyxTQUFTLENBQUNOLElBQUk7QUFDakNDLEVBQUFBLElBQUksRUFBRUksWUFBWSxDQUFDQyxTQUFTLENBQUNMLElBQUk7QUFDakNDLEVBQUFBLFFBQVEsRUFBRUcsWUFBWSxDQUFDQyxTQUFTLENBQUNKLFFBQUFBO0FBQ3JDOzs7OyJ9
