/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision e102f2b2a (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG91Y2gtZXZlbnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9pbnB1dC90b3VjaC1ldmVudC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiogQHR5cGVkZWYge2ltcG9ydCgnLi90b3VjaC1kZXZpY2UuanMnKS5Ub3VjaERldmljZX0gVG91Y2hEZXZpY2UgKi9cblxuLyoqXG4gKiBTaW1pbGFyIHRvIHtAbGluayBnZXRUYXJnZXRDb29yZHN9IGZvciB0aGUgTW91c2VFdmVudHMuIFRoaXMgZnVuY3Rpb24gdGFrZXMgYSBicm93c2VyIFRvdWNoXG4gKiBvYmplY3QgYW5kIHJldHVybnMgdGhlIGNvb3JkaW5hdGVzIG9mIHRoZSB0b3VjaCByZWxhdGl2ZSB0byB0aGUgdGFyZ2V0IGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtnbG9iYWxUaGlzLlRvdWNofSB0b3VjaCAtIFRoZSBicm93c2VyIFRvdWNoIG9iamVjdC5cbiAqIEByZXR1cm5zIHtvYmplY3R9IFRoZSBjb29yZGluYXRlcyBvZiB0aGUgdG91Y2ggcmVsYXRpdmUgdG8gdGhlIHRvdWNoLnRhcmdldCBlbGVtZW50LiBJbiB0aGVcbiAqIGZvcm1hdCB7eCwgeX0uXG4gKi9cbmZ1bmN0aW9uIGdldFRvdWNoVGFyZ2V0Q29vcmRzKHRvdWNoKSB7XG4gICAgbGV0IHRvdGFsT2Zmc2V0WCA9IDA7XG4gICAgbGV0IHRvdGFsT2Zmc2V0WSA9IDA7XG4gICAgbGV0IHRhcmdldCA9IHRvdWNoLnRhcmdldDtcbiAgICB3aGlsZSAoISh0YXJnZXQgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkpIHtcbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gICAgfVxuICAgIGxldCBjdXJyZW50RWxlbWVudCA9IHRhcmdldDtcblxuICAgIGRvIHtcbiAgICAgICAgdG90YWxPZmZzZXRYICs9IGN1cnJlbnRFbGVtZW50Lm9mZnNldExlZnQgLSBjdXJyZW50RWxlbWVudC5zY3JvbGxMZWZ0O1xuICAgICAgICB0b3RhbE9mZnNldFkgKz0gY3VycmVudEVsZW1lbnQub2Zmc2V0VG9wIC0gY3VycmVudEVsZW1lbnQuc2Nyb2xsVG9wO1xuICAgICAgICBjdXJyZW50RWxlbWVudCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFBhcmVudDtcbiAgICB9IHdoaWxlIChjdXJyZW50RWxlbWVudCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICB4OiB0b3VjaC5wYWdlWCAtIHRvdGFsT2Zmc2V0WCxcbiAgICAgICAgeTogdG91Y2gucGFnZVkgLSB0b3RhbE9mZnNldFlcbiAgICB9O1xufVxuXG4vKipcbiAqIEEgaW5zdGFuY2Ugb2YgYSBzaW5nbGUgcG9pbnQgdG91Y2ggb24gYSB7QGxpbmsgVG91Y2hEZXZpY2V9LlxuICovXG5jbGFzcyBUb3VjaCB7XG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IFRvdWNoIG9iamVjdCBmcm9tIHRoZSBicm93c2VyIFRvdWNoLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtnbG9iYWxUaGlzLlRvdWNofSB0b3VjaCAtIFRoZSBicm93c2VyIFRvdWNoIG9iamVjdC5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih0b3VjaCkge1xuICAgICAgICBjb25zdCBjb29yZHMgPSBnZXRUb3VjaFRhcmdldENvb3Jkcyh0b3VjaCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpZGVudGlmaWVyIG9mIHRoZSB0b3VjaC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuaWQgPSB0b3VjaC5pZGVudGlmaWVyO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgeCBjb29yZGluYXRlIHJlbGF0aXZlIHRvIHRoZSBlbGVtZW50IHRoYXQgdGhlIFRvdWNoRGV2aWNlIGlzIGF0dGFjaGVkIHRvLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy54ID0gY29vcmRzLng7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgeSBjb29yZGluYXRlIHJlbGF0aXZlIHRvIHRoZSBlbGVtZW50IHRoYXQgdGhlIFRvdWNoRGV2aWNlIGlzIGF0dGFjaGVkIHRvLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy55ID0gY29vcmRzLnk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSB0YXJnZXQgZWxlbWVudCBvZiB0aGUgdG91Y2ggZXZlbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtFbGVtZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50YXJnZXQgPSB0b3VjaC50YXJnZXQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBvcmlnaW5hbCBicm93c2VyIFRvdWNoIG9iamVjdC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2dsb2JhbFRoaXMuVG91Y2h9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnRvdWNoID0gdG91Y2g7XG4gICAgfVxufVxuXG4vKipcbiAqIEEgRXZlbnQgY29ycmVzcG9uZGluZyB0byB0b3VjaHN0YXJ0LCB0b3VjaGVuZCwgdG91Y2htb3ZlIG9yIHRvdWNoY2FuY2VsLiBUb3VjaEV2ZW50IHdyYXBzIHRoZVxuICogc3RhbmRhcmQgYnJvd3NlciBldmVudCBhbmQgcHJvdmlkZXMgbGlzdHMgb2Yge0BsaW5rIFRvdWNofSBvYmplY3RzLlxuICovXG5jbGFzcyBUb3VjaEV2ZW50IHtcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgYSBuZXcgVG91Y2hFdmVudCBpbnN0YW5jZS4gSXQgaXMgY3JlYXRlZCBmcm9tIGFuIGV4aXN0aW5nIGJyb3dzZXIgZXZlbnQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1RvdWNoRGV2aWNlfSBkZXZpY2UgLSBUaGUgc291cmNlIGRldmljZSBvZiB0aGUgdG91Y2ggZXZlbnRzLlxuICAgICAqIEBwYXJhbSB7Z2xvYmFsVGhpcy5Ub3VjaEV2ZW50fSBldmVudCAtIFRoZSBvcmlnaW5hbCBicm93c2VyIFRvdWNoRXZlbnQuXG4gICAgICovXG4gICAgY29uc3RydWN0b3IoZGV2aWNlLCBldmVudCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIHRhcmdldCBFbGVtZW50IHRoYXQgdGhlIGV2ZW50IHdhcyBmaXJlZCBmcm9tLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7RWxlbWVudH1cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuZWxlbWVudCA9IGV2ZW50LnRhcmdldDtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBvcmlnaW5hbCBicm93c2VyIFRvdWNoRXZlbnQuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtnbG9iYWxUaGlzLlRvdWNoRXZlbnR9XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmV2ZW50ID0gZXZlbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEEgbGlzdCBvZiBhbGwgdG91Y2hlcyBjdXJyZW50bHkgaW4gY29udGFjdCB3aXRoIHRoZSBkZXZpY2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtUb3VjaFtdfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy50b3VjaGVzID0gW107XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBIGxpc3Qgb2YgdG91Y2hlcyB0aGF0IGhhdmUgY2hhbmdlZCBzaW5jZSB0aGUgbGFzdCBldmVudC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge1RvdWNoW119XG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLmNoYW5nZWRUb3VjaGVzID0gW107XG5cbiAgICAgICAgaWYgKGV2ZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGV2ZW50LnRvdWNoZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgdGhpcy50b3VjaGVzLnB1c2gobmV3IFRvdWNoKGV2ZW50LnRvdWNoZXNbaV0pKTtcbiAgICAgICAgICAgIH1cblxuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGV2ZW50LmNoYW5nZWRUb3VjaGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgICAgIHRoaXMuY2hhbmdlZFRvdWNoZXMucHVzaChuZXcgVG91Y2goZXZlbnQuY2hhbmdlZFRvdWNoZXNbaV0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldCBhbiBldmVudCBmcm9tIG9uZSBvZiB0aGUgdG91Y2ggbGlzdHMgYnkgdGhlIGlkLiBJdCBpcyB1c2VmdWwgdG8gYWNjZXNzXG4gICAgICogdG91Y2hlcyBieSB0aGVpciBpZCBzbyB0aGF0IHlvdSBjYW4gYmUgc3VyZSB5b3UgYXJlIHJlZmVyZW5jaW5nIHRoZSBzYW1lXG4gICAgICogdG91Y2guXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gaWQgLSBUaGUgaWRlbnRpZmllciBvZiB0aGUgdG91Y2guXG4gICAgICogQHBhcmFtIHtUb3VjaFtdfG51bGx9IGxpc3QgLSBBbiBhcnJheSBvZiB0b3VjaGVzIHRvIHNlYXJjaC5cbiAgICAgKiBAcmV0dXJucyB7VG91Y2h9IFRoZSB7QGxpbmsgVG91Y2h9IG9iamVjdCBvciBudWxsLlxuICAgICAqL1xuICAgIGdldFRvdWNoQnlJZChpZCwgbGlzdCkge1xuICAgICAgICBmb3IgKGxldCBpID0gMCwgbCA9IGxpc3QubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAobGlzdFtpXS5pZCA9PT0gaWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbGlzdFtpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgZ2V0VG91Y2hUYXJnZXRDb29yZHMsIFRvdWNoLCBUb3VjaEV2ZW50IH07XG4iXSwibmFtZXMiOlsiZ2V0VG91Y2hUYXJnZXRDb29yZHMiLCJ0b3VjaCIsInRvdGFsT2Zmc2V0WCIsInRvdGFsT2Zmc2V0WSIsInRhcmdldCIsIkhUTUxFbGVtZW50IiwicGFyZW50Tm9kZSIsImN1cnJlbnRFbGVtZW50Iiwib2Zmc2V0TGVmdCIsInNjcm9sbExlZnQiLCJvZmZzZXRUb3AiLCJzY3JvbGxUb3AiLCJvZmZzZXRQYXJlbnQiLCJ4IiwicGFnZVgiLCJ5IiwicGFnZVkiLCJUb3VjaCIsImNvbnN0cnVjdG9yIiwiY29vcmRzIiwiaWQiLCJpZGVudGlmaWVyIiwiVG91Y2hFdmVudCIsImRldmljZSIsImV2ZW50IiwiZWxlbWVudCIsInRvdWNoZXMiLCJjaGFuZ2VkVG91Y2hlcyIsImkiLCJsIiwibGVuZ3RoIiwicHVzaCIsImdldFRvdWNoQnlJZCIsImxpc3QiXSwibWFwcGluZ3MiOiI7Ozs7O0FBVUEsU0FBU0Esb0JBQVQsQ0FBOEJDLEtBQTlCLEVBQXFDO0VBQ2pDLElBQUlDLFlBQVksR0FBRyxDQUFuQixDQUFBO0VBQ0EsSUFBSUMsWUFBWSxHQUFHLENBQW5CLENBQUE7QUFDQSxFQUFBLElBQUlDLE1BQU0sR0FBR0gsS0FBSyxDQUFDRyxNQUFuQixDQUFBOztBQUNBLEVBQUEsT0FBTyxFQUFFQSxNQUFNLFlBQVlDLFdBQXBCLENBQVAsRUFBeUM7SUFDckNELE1BQU0sR0FBR0EsTUFBTSxDQUFDRSxVQUFoQixDQUFBO0FBQ0gsR0FBQTs7RUFDRCxJQUFJQyxjQUFjLEdBQUdILE1BQXJCLENBQUE7O0VBRUEsR0FBRztBQUNDRixJQUFBQSxZQUFZLElBQUlLLGNBQWMsQ0FBQ0MsVUFBZixHQUE0QkQsY0FBYyxDQUFDRSxVQUEzRCxDQUFBO0FBQ0FOLElBQUFBLFlBQVksSUFBSUksY0FBYyxDQUFDRyxTQUFmLEdBQTJCSCxjQUFjLENBQUNJLFNBQTFELENBQUE7SUFDQUosY0FBYyxHQUFHQSxjQUFjLENBQUNLLFlBQWhDLENBQUE7QUFDSCxHQUpELFFBSVNMLGNBSlQs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