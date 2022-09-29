/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
function hasAudioContext() {
  return !!(typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined');
}

export { hasAudioContext };
