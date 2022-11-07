/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import { EventHandler } from './event-handler.js';

const events = {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvY29yZS9ldmVudHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRIYW5kbGVyIH0gZnJvbSAnLi9ldmVudC1oYW5kbGVyLmpzJztcblxuY29uc3QgZXZlbnRzID0ge1xuICAgIC8qKlxuICAgICAqIEF0dGFjaCBldmVudCBtZXRob2RzICdvbicsICdvZmYnLCAnZmlyZScsICdvbmNlJyBhbmQgJ2hhc0V2ZW50JyB0byB0aGUgdGFyZ2V0IG9iamVjdC5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSB0YXJnZXQgLSBUaGUgb2JqZWN0IHRvIGFkZCBldmVudHMgdG8uXG4gICAgICogQHJldHVybnMge29iamVjdH0gVGhlIHRhcmdldCBvYmplY3QuXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiB2YXIgb2JqID0geyB9O1xuICAgICAqIHBjLmV2ZW50cy5hdHRhY2gob2JqKTtcbiAgICAgKiBAaWdub3JlXG4gICAgICovXG4gICAgYXR0YWNoOiBmdW5jdGlvbiAodGFyZ2V0KSB7XG4gICAgICAgIGNvbnN0IGV2ID0gZXZlbnRzO1xuICAgICAgICB0YXJnZXQuX2FkZENhbGxiYWNrID0gZXYuX2FkZENhbGxiYWNrO1xuICAgICAgICB0YXJnZXQub24gPSBldi5vbjtcbiAgICAgICAgdGFyZ2V0Lm9mZiA9IGV2Lm9mZjtcbiAgICAgICAgdGFyZ2V0LmZpcmUgPSBldi5maXJlO1xuICAgICAgICB0YXJnZXQub25jZSA9IGV2Lm9uY2U7XG4gICAgICAgIHRhcmdldC5oYXNFdmVudCA9IGV2Lmhhc0V2ZW50O1xuICAgICAgICB0YXJnZXQuX2NhbGxiYWNrcyA9IHsgfTtcbiAgICAgICAgdGFyZ2V0Ll9jYWxsYmFja0FjdGl2ZSA9IHsgfTtcbiAgICAgICAgcmV0dXJuIHRhcmdldDtcbiAgICB9LFxuXG4gICAgX2FkZENhbGxiYWNrOiBFdmVudEhhbmRsZXIucHJvdG90eXBlLl9hZGRDYWxsYmFjayxcbiAgICBvbjogRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5vbixcbiAgICBvZmY6IEV2ZW50SGFuZGxlci5wcm90b3R5cGUub2ZmLFxuICAgIGZpcmU6IEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZmlyZSxcbiAgICBvbmNlOiBFdmVudEhhbmRsZXIucHJvdG90eXBlLm9uY2UsXG4gICAgaGFzRXZlbnQ6IEV2ZW50SGFuZGxlci5wcm90b3R5cGUuaGFzRXZlbnRcbn07XG5cbmV4cG9ydCB7IGV2ZW50cyB9O1xuIl0sIm5hbWVzIjpbImV2ZW50cyIsImF0dGFjaCIsInRhcmdldCIsImV2IiwiX2FkZENhbGxiYWNrIiwib24iLCJvZmYiLCJmaXJlIiwib25jZSIsImhhc0V2ZW50IiwiX2NhbGxiYWNrcyIsIl9jYWxsYmFja0FjdGl2ZSIsIkV2ZW50SGFuZGxlciIsInByb3RvdHlwZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUVBLE1BQU1BLE1BQU0sR0FBRztFQVdYQyxNQUFNLEVBQUUsVUFBVUMsTUFBTSxFQUFFO0lBQ3RCLE1BQU1DLEVBQUUsR0FBR0gsTUFBTSxDQUFBO0FBQ2pCRSxJQUFBQSxNQUFNLENBQUNFLFlBQVksR0FBR0QsRUFBRSxDQUFDQyxZQUFZLENBQUE7QUFDckNGLElBQUFBLE1BQU0sQ0FBQ0csRUFBRSxHQUFHRixFQUFFLENBQUNFLEVBQUUsQ0FBQTtBQUNqQkgsSUFBQUEsTUFBTSxDQUFDSSxHQUFHLEdBQUdILEVBQUUsQ0FBQ0csR0FBRyxDQUFBO0FBQ25CSixJQUFBQSxNQUFNLENBQUNLLElBQUksR0FBR0osRUFBRSxDQUFDSSxJQUFJLENBQUE7QUFDckJMLElBQUFBLE1BQU0sQ0FBQ00sSUFBSSxHQUFHTCxFQUFFLENBQUNLLElBQUksQ0FBQTtBQUNyQk4sSUFBQUEsTUFBTSxDQUFDTyxRQUFRLEdBQUdOLEVBQUUsQ0FBQ00sUUFBUSxDQUFBO0FBQzdCUCxJQUFBQSxNQUFNLENBQUNRLFVBQVUsR0FBRyxFQUFHLENBQUE7QUFDdkJSLElBQUFBLE1BQU0sQ0FBQ1MsZUFBZSxHQUFHLEVBQUcsQ0FBQTtBQUM1QixJQUFBLE9BQU9ULE1BQU0sQ0FBQTtHQUNoQjtBQUVERSxFQUFBQSxZQUFZLEVBQUVRLFlBQVksQ0FBQ0MsU0FBUyxDQUFDVCxZQUFZO0FBQ2pEQyxFQUFBQSxFQUFFLEVBQUVPLFlBQVksQ0FBQ0MsU0FBUyxDQUFDUixFQUFFO0FBQzdCQyxFQUFBQSxHQUFHLEVBQUVNLFlBQVksQ0FBQ0MsU0FBUyxDQUFDUCxHQUFHO0FBQy9CQyxFQUFBQSxJQUFJLEVBQUVLLFlBQVksQ0FBQ0MsU0FBUyxDQUFDTixJQUFJO0FBQ2pDQyxFQUFBQSxJQUFJLEVBQUVJLFlBQVksQ0FBQ0MsU0FBUyxDQUFDTCxJQUFJO0FBQ2pDQyxFQUFBQSxRQUFRLEVBQUVHLFlBQVksQ0FBQ0MsU0FBUyxDQUFDSixRQUFBQTtBQUNyQzs7OzsifQ==