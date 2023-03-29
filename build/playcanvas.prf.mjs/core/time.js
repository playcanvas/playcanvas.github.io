/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
const now = typeof window !== 'undefined' && window.performance && window.performance.now && window.performance.timing ? performance.now.bind(performance) : Date.now;

export { now };
