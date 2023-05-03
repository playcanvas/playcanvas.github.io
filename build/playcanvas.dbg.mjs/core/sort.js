/**
 * @param {{priority: number}} a - First object with priority property.
 * @param {{priority: number}} b - Second object with priority property.
 * @returns {number} A number indicating the relative position.
 * @ignore
 */
const cmpPriority = (a, b) => a.priority - b.priority;

/**
 * @param {Array<{priority: number}>} arr - Array to be sorted in place where each element contains
 * an object with at least a priority property.
 * @returns {Array<{priority: number}>} In place sorted array.
 * @ignore
 */
const sortPriority = arr => arr.sort(cmpPriority);

export { sortPriority };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29ydC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2NvcmUvc29ydC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBwYXJhbSB7e3ByaW9yaXR5OiBudW1iZXJ9fSBhIC0gRmlyc3Qgb2JqZWN0IHdpdGggcHJpb3JpdHkgcHJvcGVydHkuXG4gKiBAcGFyYW0ge3twcmlvcml0eTogbnVtYmVyfX0gYiAtIFNlY29uZCBvYmplY3Qgd2l0aCBwcmlvcml0eSBwcm9wZXJ0eS5cbiAqIEByZXR1cm5zIHtudW1iZXJ9IEEgbnVtYmVyIGluZGljYXRpbmcgdGhlIHJlbGF0aXZlIHBvc2l0aW9uLlxuICogQGlnbm9yZVxuICovXG5jb25zdCBjbXBQcmlvcml0eSA9IChhLCBiKSA9PiBhLnByaW9yaXR5IC0gYi5wcmlvcml0eTtcblxuLyoqXG4gKiBAcGFyYW0ge0FycmF5PHtwcmlvcml0eTogbnVtYmVyfT59IGFyciAtIEFycmF5IHRvIGJlIHNvcnRlZCBpbiBwbGFjZSB3aGVyZSBlYWNoIGVsZW1lbnQgY29udGFpbnNcbiAqIGFuIG9iamVjdCB3aXRoIGF0IGxlYXN0IGEgcHJpb3JpdHkgcHJvcGVydHkuXG4gKiBAcmV0dXJucyB7QXJyYXk8e3ByaW9yaXR5OiBudW1iZXJ9Pn0gSW4gcGxhY2Ugc29ydGVkIGFycmF5LlxuICogQGlnbm9yZVxuICovXG5leHBvcnQgY29uc3Qgc29ydFByaW9yaXR5ID0gYXJyID0+IGFyci5zb3J0KGNtcFByaW9yaXR5KTtcbiJdLCJuYW1lcyI6WyJjbXBQcmlvcml0eSIsImEiLCJiIiwicHJpb3JpdHkiLCJzb3J0UHJpb3JpdHkiLCJhcnIiLCJzb3J0Il0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxNQUFNQSxXQUFXLEdBQUdBLENBQUNDLENBQUMsRUFBRUMsQ0FBQyxLQUFLRCxDQUFDLENBQUNFLFFBQVEsR0FBR0QsQ0FBQyxDQUFDQyxRQUFRLENBQUE7O0FBRXJEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBR0MsR0FBRyxJQUFJQSxHQUFHLENBQUNDLElBQUksQ0FBQ04sV0FBVzs7OzsifQ==
