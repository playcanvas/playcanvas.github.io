/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
const CompressUtils = {
  setCompressedPRS: function (entity, data, compressed) {
    const a = compressed.singleVecs;
    let b, i;
    const v = data.___1;
    if (!v) {
      b = compressed.tripleVecs;
      i = data.___2;
    }
    let n = v ? v[0] : b[i];
    entity.setLocalPosition(a[n], a[n + 1], a[n + 2]);
    n = v ? v[1] : b[i + 1];
    entity.setLocalEulerAngles(a[n], a[n + 1], a[n + 2]);
    n = v ? v[2] : b[i + 2];
    entity.setLocalScale(a[n], a[n + 1], a[n + 2]);
  },
  oneCharToKey: function (s, data) {
    const i = s.charCodeAt(0) - data.fieldFirstCode;
    return data.fieldArray[i];
  },
  multCharToKey: function (s, data) {
    let ind = 0;
    for (let i = 0; i < s.length; i++) {
      ind = ind * data.fieldCodeBase + s.charCodeAt(i) - data.fieldFirstCode;
    }
    return data.fieldArray[ind];
  }
};

export { CompressUtils };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHJlc3MtdXRpbHMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9zY2VuZS9jb21wcmVzcy9jb21wcmVzcy11dGlscy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBDb21wcmVzc1V0aWxzID0ge1xuICAgIC8qKlxuICAgICAqIEBwcml2YXRlXG4gICAgICogQGZ1bmN0aW9uXG4gICAgICogQG5hbWUgQ29tcHJlc3NVdGlscyNzZXRDb21wcmVzc2VkUFJTXG4gICAgICogQGRlc2NyaXB0aW9uIFNldCBwb3NpdGlvbiwgcm90YXRpb24gYW5kIHNjYWxlIG9mIGFuIGVudGl0eSB1c2luZyBjb21wcmVzc2VkXG4gICAgICogc2NlbmUgZm9ybWF0LlxuICAgICAqIEBwYXJhbSB7RW50aXR5fSBlbnRpdHkgLSBUaGUgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkYXRhIC0gSnNvbiBlbnRpdHkgZGF0YSBmcm9tIGEgY29tcHJlc3NlZCBzY2VuZS5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gY29tcHJlc3NlZCAtIENvbXByZXNzaW9uIG1ldGFkYXRhLlxuICAgICAqL1xuICAgIHNldENvbXByZXNzZWRQUlM6IGZ1bmN0aW9uIChlbnRpdHksIGRhdGEsIGNvbXByZXNzZWQpIHtcbiAgICAgICAgY29uc3QgYSA9IGNvbXByZXNzZWQuc2luZ2xlVmVjcztcblxuICAgICAgICBsZXQgYiwgaTtcblxuICAgICAgICBjb25zdCB2ID0gZGF0YS5fX18xO1xuXG4gICAgICAgIGlmICghdikge1xuICAgICAgICAgICAgYiA9IGNvbXByZXNzZWQudHJpcGxlVmVjcztcblxuICAgICAgICAgICAgaSA9IGRhdGEuX19fMjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBuID0gdiA/IHZbMF0gOiBiW2ldO1xuXG4gICAgICAgIGVudGl0eS5zZXRMb2NhbFBvc2l0aW9uKGFbbl0sIGFbbiArIDFdLCBhW24gKyAyXSk7XG5cbiAgICAgICAgbiA9IHYgPyB2WzFdIDogYltpICsgMV07XG5cbiAgICAgICAgZW50aXR5LnNldExvY2FsRXVsZXJBbmdsZXMoYVtuXSwgYVtuICsgMV0sIGFbbiArIDJdKTtcblxuICAgICAgICBuID0gdiA/IHZbMl0gOiBiW2kgKyAyXTtcblxuICAgICAgICBlbnRpdHkuc2V0TG9jYWxTY2FsZShhW25dLCBhW24gKyAxXSwgYVtuICsgMl0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIENvbXByZXNzVXRpbHMjb25lQ2hhclRvS2V5XG4gICAgICogQGRlc2NyaXB0aW9uIFJldHJpZXZlIHRoZSBvcmlnaW5hbCBmaWVsZCBuYW1lIChrZXkpIGZvciBhIHNpbmdsZSBjaGFyYWN0ZXIga2V5XG4gICAgICogZnJvbSBhIGNvbXByZXNzZWQgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzIC0gVGhlIGNvbXByZXNzZWQga2V5IHN0cmluZy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIENvbXByZXNzaW9uIG1ldGFkYXRhLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBvcmlnaW5hbCBrZXkuXG4gICAgICovXG4gICAgb25lQ2hhclRvS2V5OiBmdW5jdGlvbiAocywgZGF0YSkge1xuICAgICAgICBjb25zdCBpID0gcy5jaGFyQ29kZUF0KDApIC0gZGF0YS5maWVsZEZpcnN0Q29kZTtcblxuICAgICAgICByZXR1cm4gZGF0YS5maWVsZEFycmF5W2ldO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqIEBmdW5jdGlvblxuICAgICAqIEBuYW1lIENvbXByZXNzVXRpbHMjbXVsdENoYXJUb0tleVxuICAgICAqIEBkZXNjcmlwdGlvbiBSZXRyaWV2ZSB0aGUgb3JpZ2luYWwgZmllbGQgbmFtZSAoa2V5KSBmb3IgYSBtdWx0aS1jaGFyYWN0ZXIga2V5XG4gICAgICogZnJvbSBhIGNvbXByZXNzZWQgZW50aXR5LlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzIC0gVGhlIGNvbXByZXNzZWQga2V5IHN0cmluZy5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gZGF0YSAtIENvbXByZXNzaW9uIG1ldGFkYXRhLlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBvcmlnaW5hbCBrZXkuXG4gICAgICovXG4gICAgbXVsdENoYXJUb0tleTogZnVuY3Rpb24gKHMsIGRhdGEpIHtcbiAgICAgICAgbGV0IGluZCA9IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpbmQgPSBpbmQgKiBkYXRhLmZpZWxkQ29kZUJhc2UgKyBzLmNoYXJDb2RlQXQoaSkgLSBkYXRhLmZpZWxkRmlyc3RDb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRhdGEuZmllbGRBcnJheVtpbmRdO1xuICAgIH1cbn07XG5cbmV4cG9ydCB7IENvbXByZXNzVXRpbHMgfTtcbiJdLCJuYW1lcyI6WyJDb21wcmVzc1V0aWxzIiwic2V0Q29tcHJlc3NlZFBSUyIsImVudGl0eSIsImRhdGEiLCJjb21wcmVzc2VkIiwiYSIsInNpbmdsZVZlY3MiLCJiIiwiaSIsInYiLCJfX18xIiwidHJpcGxlVmVjcyIsIl9fXzIiLCJuIiwic2V0TG9jYWxQb3NpdGlvbiIsInNldExvY2FsRXVsZXJBbmdsZXMiLCJzZXRMb2NhbFNjYWxlIiwib25lQ2hhclRvS2V5IiwicyIsImNoYXJDb2RlQXQiLCJmaWVsZEZpcnN0Q29kZSIsImZpZWxkQXJyYXkiLCJtdWx0Q2hhclRvS2V5IiwiaW5kIiwibGVuZ3RoIiwiZmllbGRDb2RlQmFzZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxNQUFNQSxhQUFhLEdBQUc7QUFXbEJDLEVBQUFBLGdCQUFnQixFQUFFLFVBQVVDLE1BQU0sRUFBRUMsSUFBSSxFQUFFQyxVQUFVLEVBQUU7QUFDbEQsSUFBQSxNQUFNQyxDQUFDLEdBQUdELFVBQVUsQ0FBQ0UsVUFBVSxDQUFBO0lBRS9CLElBQUlDLENBQUMsRUFBRUMsQ0FBQyxDQUFBO0FBRVIsSUFBQSxNQUFNQyxDQUFDLEdBQUdOLElBQUksQ0FBQ08sSUFBSSxDQUFBO0lBRW5CLElBQUksQ0FBQ0QsQ0FBQyxFQUFFO01BQ0pGLENBQUMsR0FBR0gsVUFBVSxDQUFDTyxVQUFVLENBQUE7TUFFekJILENBQUMsR0FBR0wsSUFBSSxDQUFDUyxJQUFJLENBQUE7QUFDakIsS0FBQTtBQUVBLElBQUEsSUFBSUMsQ0FBQyxHQUFHSixDQUFDLEdBQUdBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDQyxDQUFDLENBQUMsQ0FBQTtJQUV2Qk4sTUFBTSxDQUFDWSxnQkFBZ0IsQ0FBQ1QsQ0FBQyxDQUFDUSxDQUFDLENBQUMsRUFBRVIsQ0FBQyxDQUFDUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUVSLENBQUMsQ0FBQ1EsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7QUFFakRBLElBQUFBLENBQUMsR0FBR0osQ0FBQyxHQUFHQSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUdGLENBQUMsQ0FBQ0MsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFBO0lBRXZCTixNQUFNLENBQUNhLG1CQUFtQixDQUFDVixDQUFDLENBQUNRLENBQUMsQ0FBQyxFQUFFUixDQUFDLENBQUNRLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRVIsQ0FBQyxDQUFDUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtBQUVwREEsSUFBQUEsQ0FBQyxHQUFHSixDQUFDLEdBQUdBLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBR0YsQ0FBQyxDQUFDQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUE7SUFFdkJOLE1BQU0sQ0FBQ2MsYUFBYSxDQUFDWCxDQUFDLENBQUNRLENBQUMsQ0FBQyxFQUFFUixDQUFDLENBQUNRLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRVIsQ0FBQyxDQUFDUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtHQUNqRDtBQVlESSxFQUFBQSxZQUFZLEVBQUUsVUFBVUMsQ0FBQyxFQUFFZixJQUFJLEVBQUU7SUFDN0IsTUFBTUssQ0FBQyxHQUFHVSxDQUFDLENBQUNDLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBR2hCLElBQUksQ0FBQ2lCLGNBQWMsQ0FBQTtBQUUvQyxJQUFBLE9BQU9qQixJQUFJLENBQUNrQixVQUFVLENBQUNiLENBQUMsQ0FBQyxDQUFBO0dBQzVCO0FBWURjLEVBQUFBLGFBQWEsRUFBRSxVQUFVSixDQUFDLEVBQUVmLElBQUksRUFBRTtJQUM5QixJQUFJb0IsR0FBRyxHQUFHLENBQUMsQ0FBQTtBQUVYLElBQUEsS0FBSyxJQUFJZixDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdVLENBQUMsQ0FBQ00sTUFBTSxFQUFFaEIsQ0FBQyxFQUFFLEVBQUU7QUFDL0JlLE1BQUFBLEdBQUcsR0FBR0EsR0FBRyxHQUFHcEIsSUFBSSxDQUFDc0IsYUFBYSxHQUFHUCxDQUFDLENBQUNDLFVBQVUsQ0FBQ1gsQ0FBQyxDQUFDLEdBQUdMLElBQUksQ0FBQ2lCLGNBQWMsQ0FBQTtBQUMxRSxLQUFBO0FBRUEsSUFBQSxPQUFPakIsSUFBSSxDQUFDa0IsVUFBVSxDQUFDRSxHQUFHLENBQUMsQ0FBQTtBQUMvQixHQUFBO0FBQ0o7Ozs7In0=