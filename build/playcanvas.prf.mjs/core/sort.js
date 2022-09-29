/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
const cmpPriority = (a, b) => a.priority - b.priority;

const sortPriority = arr => arr.sort(cmpPriority);

export { sortPriority };
