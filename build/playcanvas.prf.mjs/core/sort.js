const cmpPriority = (a, b) => a.priority - b.priority;
const sortPriority = arr => arr.sort(cmpPriority);

export { sortPriority };
