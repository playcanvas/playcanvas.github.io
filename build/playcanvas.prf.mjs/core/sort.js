/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
const cmpPriority = (a, b) => a.priority - b.priority;
const sortPriority = arr => arr.sort(cmpPriority);

export { sortPriority };
