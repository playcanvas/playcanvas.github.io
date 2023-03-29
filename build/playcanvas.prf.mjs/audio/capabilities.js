/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
function hasAudioContext() {
  return !!(typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined');
}

export { hasAudioContext };
