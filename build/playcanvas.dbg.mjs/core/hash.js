/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * Calculates simple hash value of a string. Designed for performance, not perfect.
 *
 * @param {string} str - String.
 * @returns {number} Hash value.
 * @ignore
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    // Convert to 32bit integer
    hash |= 0;
  }
  return hash;
}

export { hashCode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFzaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvaGFzaC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIENhbGN1bGF0ZXMgc2ltcGxlIGhhc2ggdmFsdWUgb2YgYSBzdHJpbmcuIERlc2lnbmVkIGZvciBwZXJmb3JtYW5jZSwgbm90IHBlcmZlY3QuXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IHN0ciAtIFN0cmluZy5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IEhhc2ggdmFsdWUuXG4gKiBAaWdub3JlXG4gKi9cbmZ1bmN0aW9uIGhhc2hDb2RlKHN0cikge1xuICAgIGxldCBoYXNoID0gMDtcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gc3RyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGhhc2ggPSAoKGhhc2ggPDwgNSkgLSBoYXNoKSArIHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgICAgICAvLyBDb252ZXJ0IHRvIDMyYml0IGludGVnZXJcbiAgICAgICAgaGFzaCB8PSAwO1xuICAgIH1cbiAgICByZXR1cm4gaGFzaDtcbn1cblxuZXhwb3J0IHsgaGFzaENvZGUgfTtcbiJdLCJuYW1lcyI6WyJoYXNoQ29kZSIsInN0ciIsImhhc2giLCJpIiwibGVuIiwibGVuZ3RoIiwiY2hhckNvZGVBdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLFFBQVEsQ0FBQ0MsR0FBRyxFQUFFO0VBQ25CLElBQUlDLElBQUksR0FBRyxDQUFDLENBQUE7QUFDWixFQUFBLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUMsR0FBRyxHQUFHSCxHQUFHLENBQUNJLE1BQU0sRUFBRUYsQ0FBQyxHQUFHQyxHQUFHLEVBQUVELENBQUMsRUFBRSxFQUFFO0FBQzVDRCxJQUFBQSxJQUFJLEdBQUksQ0FBQ0EsSUFBSSxJQUFJLENBQUMsSUFBSUEsSUFBSSxHQUFJRCxHQUFHLENBQUNLLFVBQVUsQ0FBQ0gsQ0FBQyxDQUFDLENBQUE7QUFDL0M7QUFDQUQsSUFBQUEsSUFBSSxJQUFJLENBQUMsQ0FBQTtBQUNiLEdBQUE7QUFDQSxFQUFBLE9BQU9BLElBQUksQ0FBQTtBQUNmOzs7OyJ9
