/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * This interface is used by {@link AnimEvaluator} to resolve unique animation target path strings
 * into instances of {@link AnimTarget}.
 *
 * @ignore
 */
class AnimBinder {
  // join a list of path segments into a path string using the full stop character. If another character is supplied,
  // it will join using that character instead
  static joinPath(pathSegments, character) {
    character = character || '.';
    const escape = function escape(string) {
      return string.replace(/\\/g, '\\\\').replace(new RegExp('\\' + character, 'g'), '\\' + character);
    };
    return pathSegments.map(escape).join(character);
  }

  // split a path string into its segments and resolve character escaping
  static splitPath(path, character) {
    character = character || '.';
    const result = [];
    let curr = "";
    let i = 0;
    while (i < path.length) {
      let c = path[i++];
      if (c === '\\' && i < path.length) {
        c = path[i++];
        if (c === '\\' || c === character) {
          curr += c;
        } else {
          curr += '\\' + c;
        }
      } else if (c === character) {
        result.push(curr);
        curr = '';
      } else {
        curr += c;
      }
    }
    if (curr.length > 0) {
      result.push(curr);
    }
    return result;
  }

  /**
   * Converts a locator array into its string version.
   *
   * @param {string|string[]} entityPath - The entity location in the scene defined as an array or
   * string path.
   * @param {string} component - The component of the entity the property is located under.
   * @param {string|string[]} propertyPath - The property location in the entity defined as an array
   * or string path.
   * @returns {string} The locator encoded as a string.
   * @example
   * // returns 'spotLight/light/color.r'
   * encode(['spotLight'], 'light', ['color', 'r']);
   */
  static encode(entityPath, component, propertyPath) {
    return `${Array.isArray(entityPath) ? entityPath.join('/') : entityPath}/${component}/${Array.isArray(propertyPath) ? propertyPath.join('/') : propertyPath}`;
  }

  /**
   * Resolve the provided target path and return an instance of {@link AnimTarget} which will
   * handle setting the value, or return null if no such target exists.
   *
   * @param {string} path - The animation curve path to resolve.
   * @returns {import('../evaluator/anim-target.js').AnimTarget|null} - Returns the target
   * instance on success and null otherwise.
   */
  resolve(path) {
    return null;
  }

  /**
   * Called when the {@link AnimEvaluator} no longer has a curve driving the given key.
   *
   * @param {string} path - The animation curve path which is no longer driven.
   */
  unresolve(path) {}

  /**
   * Called by {@link AnimEvaluator} once a frame after animation updates are done.
   *
   * @param {number} deltaTime - Amount of time that passed in the current update.
   */
  update(deltaTime) {}
}

export { AnimBinder };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW5pbS1iaW5kZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9mcmFtZXdvcmsvYW5pbS9iaW5kZXIvYW5pbS1iaW5kZXIuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGlzIGludGVyZmFjZSBpcyB1c2VkIGJ5IHtAbGluayBBbmltRXZhbHVhdG9yfSB0byByZXNvbHZlIHVuaXF1ZSBhbmltYXRpb24gdGFyZ2V0IHBhdGggc3RyaW5nc1xuICogaW50byBpbnN0YW5jZXMgb2Yge0BsaW5rIEFuaW1UYXJnZXR9LlxuICpcbiAqIEBpZ25vcmVcbiAqL1xuY2xhc3MgQW5pbUJpbmRlciB7XG4gICAgLy8gam9pbiBhIGxpc3Qgb2YgcGF0aCBzZWdtZW50cyBpbnRvIGEgcGF0aCBzdHJpbmcgdXNpbmcgdGhlIGZ1bGwgc3RvcCBjaGFyYWN0ZXIuIElmIGFub3RoZXIgY2hhcmFjdGVyIGlzIHN1cHBsaWVkLFxuICAgIC8vIGl0IHdpbGwgam9pbiB1c2luZyB0aGF0IGNoYXJhY3RlciBpbnN0ZWFkXG4gICAgc3RhdGljIGpvaW5QYXRoKHBhdGhTZWdtZW50cywgY2hhcmFjdGVyKSB7XG4gICAgICAgIGNoYXJhY3RlciA9IGNoYXJhY3RlciB8fCAnLic7XG4gICAgICAgIGNvbnN0IGVzY2FwZSA9IGZ1bmN0aW9uIChzdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKS5yZXBsYWNlKG5ldyBSZWdFeHAoJ1xcXFwnICsgY2hhcmFjdGVyLCAnZycpLCAnXFxcXCcgKyBjaGFyYWN0ZXIpO1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gcGF0aFNlZ21lbnRzLm1hcChlc2NhcGUpLmpvaW4oY2hhcmFjdGVyKTtcbiAgICB9XG5cbiAgICAvLyBzcGxpdCBhIHBhdGggc3RyaW5nIGludG8gaXRzIHNlZ21lbnRzIGFuZCByZXNvbHZlIGNoYXJhY3RlciBlc2NhcGluZ1xuICAgIHN0YXRpYyBzcGxpdFBhdGgocGF0aCwgY2hhcmFjdGVyKSB7XG4gICAgICAgIGNoYXJhY3RlciA9IGNoYXJhY3RlciB8fCAnLic7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgICAgICBsZXQgY3VyciA9IFwiXCI7XG4gICAgICAgIGxldCBpID0gMDtcbiAgICAgICAgd2hpbGUgKGkgPCBwYXRoLmxlbmd0aCkge1xuICAgICAgICAgICAgbGV0IGMgPSBwYXRoW2krK107XG5cbiAgICAgICAgICAgIGlmIChjID09PSAnXFxcXCcgJiYgaSA8IHBhdGgubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYyA9IHBhdGhbaSsrXTtcbiAgICAgICAgICAgICAgICBpZiAoYyA9PT0gJ1xcXFwnIHx8IGMgPT09IGNoYXJhY3Rlcikge1xuICAgICAgICAgICAgICAgICAgICBjdXJyICs9IGM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY3VyciArPSAnXFxcXCcgKyBjO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYyA9PT0gY2hhcmFjdGVyKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goY3Vycik7XG4gICAgICAgICAgICAgICAgY3VyciA9ICcnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjdXJyICs9IGM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGN1cnIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goY3Vycik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb252ZXJ0cyBhIGxvY2F0b3IgYXJyYXkgaW50byBpdHMgc3RyaW5nIHZlcnNpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xzdHJpbmdbXX0gZW50aXR5UGF0aCAtIFRoZSBlbnRpdHkgbG9jYXRpb24gaW4gdGhlIHNjZW5lIGRlZmluZWQgYXMgYW4gYXJyYXkgb3JcbiAgICAgKiBzdHJpbmcgcGF0aC5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29tcG9uZW50IC0gVGhlIGNvbXBvbmVudCBvZiB0aGUgZW50aXR5IHRoZSBwcm9wZXJ0eSBpcyBsb2NhdGVkIHVuZGVyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBwcm9wZXJ0eVBhdGggLSBUaGUgcHJvcGVydHkgbG9jYXRpb24gaW4gdGhlIGVudGl0eSBkZWZpbmVkIGFzIGFuIGFycmF5XG4gICAgICogb3Igc3RyaW5nIHBhdGguXG4gICAgICogQHJldHVybnMge3N0cmluZ30gVGhlIGxvY2F0b3IgZW5jb2RlZCBhcyBhIHN0cmluZy5cbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIC8vIHJldHVybnMgJ3Nwb3RMaWdodC9saWdodC9jb2xvci5yJ1xuICAgICAqIGVuY29kZShbJ3Nwb3RMaWdodCddLCAnbGlnaHQnLCBbJ2NvbG9yJywgJ3InXSk7XG4gICAgICovXG4gICAgc3RhdGljIGVuY29kZShlbnRpdHlQYXRoLCBjb21wb25lbnQsIHByb3BlcnR5UGF0aCkge1xuICAgICAgICByZXR1cm4gYCR7XG4gICAgICAgICAgICBBcnJheS5pc0FycmF5KGVudGl0eVBhdGgpID8gZW50aXR5UGF0aC5qb2luKCcvJykgOiBlbnRpdHlQYXRoXG4gICAgICAgIH0vJHtjb21wb25lbnR9LyR7XG4gICAgICAgICAgICBBcnJheS5pc0FycmF5KHByb3BlcnR5UGF0aCkgPyBwcm9wZXJ0eVBhdGguam9pbignLycpIDogcHJvcGVydHlQYXRoXG4gICAgICAgIH1gO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgdGhlIHByb3ZpZGVkIHRhcmdldCBwYXRoIGFuZCByZXR1cm4gYW4gaW5zdGFuY2Ugb2Yge0BsaW5rIEFuaW1UYXJnZXR9IHdoaWNoIHdpbGxcbiAgICAgKiBoYW5kbGUgc2V0dGluZyB0aGUgdmFsdWUsIG9yIHJldHVybiBudWxsIGlmIG5vIHN1Y2ggdGFyZ2V0IGV4aXN0cy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIC0gVGhlIGFuaW1hdGlvbiBjdXJ2ZSBwYXRoIHRvIHJlc29sdmUuXG4gICAgICogQHJldHVybnMge2ltcG9ydCgnLi4vZXZhbHVhdG9yL2FuaW0tdGFyZ2V0LmpzJykuQW5pbVRhcmdldHxudWxsfSAtIFJldHVybnMgdGhlIHRhcmdldFxuICAgICAqIGluc3RhbmNlIG9uIHN1Y2Nlc3MgYW5kIG51bGwgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIHJlc29sdmUocGF0aCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgd2hlbiB0aGUge0BsaW5rIEFuaW1FdmFsdWF0b3J9IG5vIGxvbmdlciBoYXMgYSBjdXJ2ZSBkcml2aW5nIHRoZSBnaXZlbiBrZXkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aCAtIFRoZSBhbmltYXRpb24gY3VydmUgcGF0aCB3aGljaCBpcyBubyBsb25nZXIgZHJpdmVuLlxuICAgICAqL1xuICAgIHVucmVzb2x2ZShwYXRoKSB7XG5cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDYWxsZWQgYnkge0BsaW5rIEFuaW1FdmFsdWF0b3J9IG9uY2UgYSBmcmFtZSBhZnRlciBhbmltYXRpb24gdXBkYXRlcyBhcmUgZG9uZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBkZWx0YVRpbWUgLSBBbW91bnQgb2YgdGltZSB0aGF0IHBhc3NlZCBpbiB0aGUgY3VycmVudCB1cGRhdGUuXG4gICAgICovXG4gICAgdXBkYXRlKGRlbHRhVGltZSkge1xuXG4gICAgfVxufVxuXG5leHBvcnQgeyBBbmltQmluZGVyIH07XG4iXSwibmFtZXMiOlsiQW5pbUJpbmRlciIsImpvaW5QYXRoIiwicGF0aFNlZ21lbnRzIiwiY2hhcmFjdGVyIiwiZXNjYXBlIiwic3RyaW5nIiwicmVwbGFjZSIsIlJlZ0V4cCIsIm1hcCIsImpvaW4iLCJzcGxpdFBhdGgiLCJwYXRoIiwicmVzdWx0IiwiY3VyciIsImkiLCJsZW5ndGgiLCJjIiwicHVzaCIsImVuY29kZSIsImVudGl0eVBhdGgiLCJjb21wb25lbnQiLCJwcm9wZXJ0eVBhdGgiLCJBcnJheSIsImlzQXJyYXkiLCJyZXNvbHZlIiwidW5yZXNvbHZlIiwidXBkYXRlIiwiZGVsdGFUaW1lIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE1BQU1BLFVBQVUsQ0FBQztBQUNiO0FBQ0E7QUFDQSxFQUFBLE9BQU9DLFFBQVEsQ0FBQ0MsWUFBWSxFQUFFQyxTQUFTLEVBQUU7SUFDckNBLFNBQVMsR0FBR0EsU0FBUyxJQUFJLEdBQUcsQ0FBQTtBQUM1QixJQUFBLE1BQU1DLE1BQU0sR0FBRyxTQUFUQSxNQUFNLENBQWFDLE1BQU0sRUFBRTtNQUM3QixPQUFPQSxNQUFNLENBQUNDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUNBLE9BQU8sQ0FBQyxJQUFJQyxNQUFNLENBQUMsSUFBSSxHQUFHSixTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHQSxTQUFTLENBQUMsQ0FBQTtLQUNwRyxDQUFBO0lBQ0QsT0FBT0QsWUFBWSxDQUFDTSxHQUFHLENBQUNKLE1BQU0sQ0FBQyxDQUFDSyxJQUFJLENBQUNOLFNBQVMsQ0FBQyxDQUFBO0FBQ25ELEdBQUE7O0FBRUE7QUFDQSxFQUFBLE9BQU9PLFNBQVMsQ0FBQ0MsSUFBSSxFQUFFUixTQUFTLEVBQUU7SUFDOUJBLFNBQVMsR0FBR0EsU0FBUyxJQUFJLEdBQUcsQ0FBQTtJQUM1QixNQUFNUyxNQUFNLEdBQUcsRUFBRSxDQUFBO0lBQ2pCLElBQUlDLElBQUksR0FBRyxFQUFFLENBQUE7SUFDYixJQUFJQyxDQUFDLEdBQUcsQ0FBQyxDQUFBO0FBQ1QsSUFBQSxPQUFPQSxDQUFDLEdBQUdILElBQUksQ0FBQ0ksTUFBTSxFQUFFO0FBQ3BCLE1BQUEsSUFBSUMsQ0FBQyxHQUFHTCxJQUFJLENBQUNHLENBQUMsRUFBRSxDQUFDLENBQUE7TUFFakIsSUFBSUUsQ0FBQyxLQUFLLElBQUksSUFBSUYsQ0FBQyxHQUFHSCxJQUFJLENBQUNJLE1BQU0sRUFBRTtBQUMvQkMsUUFBQUEsQ0FBQyxHQUFHTCxJQUFJLENBQUNHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDYixRQUFBLElBQUlFLENBQUMsS0FBSyxJQUFJLElBQUlBLENBQUMsS0FBS2IsU0FBUyxFQUFFO0FBQy9CVSxVQUFBQSxJQUFJLElBQUlHLENBQUMsQ0FBQTtBQUNiLFNBQUMsTUFBTTtVQUNISCxJQUFJLElBQUksSUFBSSxHQUFHRyxDQUFDLENBQUE7QUFDcEIsU0FBQTtBQUNKLE9BQUMsTUFBTSxJQUFJQSxDQUFDLEtBQUtiLFNBQVMsRUFBRTtBQUN4QlMsUUFBQUEsTUFBTSxDQUFDSyxJQUFJLENBQUNKLElBQUksQ0FBQyxDQUFBO0FBQ2pCQSxRQUFBQSxJQUFJLEdBQUcsRUFBRSxDQUFBO0FBQ2IsT0FBQyxNQUFNO0FBQ0hBLFFBQUFBLElBQUksSUFBSUcsQ0FBQyxDQUFBO0FBQ2IsT0FBQTtBQUNKLEtBQUE7QUFDQSxJQUFBLElBQUlILElBQUksQ0FBQ0UsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUNqQkgsTUFBQUEsTUFBTSxDQUFDSyxJQUFJLENBQUNKLElBQUksQ0FBQyxDQUFBO0FBQ3JCLEtBQUE7QUFDQSxJQUFBLE9BQU9ELE1BQU0sQ0FBQTtBQUNqQixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0ksRUFBQSxPQUFPTSxNQUFNLENBQUNDLFVBQVUsRUFBRUMsU0FBUyxFQUFFQyxZQUFZLEVBQUU7QUFDL0MsSUFBQSxPQUFRLENBQ0pDLEVBQUFBLEtBQUssQ0FBQ0MsT0FBTyxDQUFDSixVQUFVLENBQUMsR0FBR0EsVUFBVSxDQUFDVixJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUdVLFVBQ3RELENBQUEsQ0FBQSxFQUFHQyxTQUFVLENBQUEsQ0FBQSxFQUNWRSxLQUFLLENBQUNDLE9BQU8sQ0FBQ0YsWUFBWSxDQUFDLEdBQUdBLFlBQVksQ0FBQ1osSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHWSxZQUMxRCxDQUFDLENBQUEsQ0FBQTtBQUNOLEdBQUE7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJRyxPQUFPLENBQUNiLElBQUksRUFBRTtBQUNWLElBQUEsT0FBTyxJQUFJLENBQUE7QUFDZixHQUFBOztBQUVBO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7RUFDSWMsU0FBUyxDQUFDZCxJQUFJLEVBQUUsRUFFaEI7O0FBRUE7QUFDSjtBQUNBO0FBQ0E7QUFDQTtFQUNJZSxNQUFNLENBQUNDLFNBQVMsRUFBRSxFQUVsQjtBQUNKOzs7OyJ9
