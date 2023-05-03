/**
 * Reports whether this device supports the Web Audio API.
 *
 * @returns {boolean} True if Web Audio is supported and false otherwise.
 * @ignore
 */
function hasAudioContext() {
  return !!(typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined');
}

export { hasAudioContext };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FwYWJpbGl0aWVzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vYXVkaW8vY2FwYWJpbGl0aWVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUmVwb3J0cyB3aGV0aGVyIHRoaXMgZGV2aWNlIHN1cHBvcnRzIHRoZSBXZWIgQXVkaW8gQVBJLlxuICpcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIFdlYiBBdWRpbyBpcyBzdXBwb3J0ZWQgYW5kIGZhbHNlIG90aGVyd2lzZS5cbiAqIEBpZ25vcmVcbiAqL1xuZnVuY3Rpb24gaGFzQXVkaW9Db250ZXh0KCkge1xuICAgIHJldHVybiAhISh0eXBlb2YgQXVkaW9Db250ZXh0ICE9PSAndW5kZWZpbmVkJyB8fCB0eXBlb2Ygd2Via2l0QXVkaW9Db250ZXh0ICE9PSAndW5kZWZpbmVkJyk7XG59XG5cbmV4cG9ydCB7IGhhc0F1ZGlvQ29udGV4dCB9O1xuIl0sIm5hbWVzIjpbImhhc0F1ZGlvQ29udGV4dCIsIkF1ZGlvQ29udGV4dCIsIndlYmtpdEF1ZGlvQ29udGV4dCJdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0EsZUFBZUEsR0FBRztFQUN2QixPQUFPLENBQUMsRUFBRSxPQUFPQyxZQUFZLEtBQUssV0FBVyxJQUFJLE9BQU9DLGtCQUFrQixLQUFLLFdBQVcsQ0FBQyxDQUFBO0FBQy9GOzs7OyJ9
