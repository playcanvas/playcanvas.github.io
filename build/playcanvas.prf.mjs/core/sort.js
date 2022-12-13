/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
const cmpPriority = (a, b) => a.priority - b.priority;

const sortPriority = arr => arr.sort(cmpPriority);

export { sortPriority };
