/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
function hasAudioContext() {
	return !!(typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined');
}

export { hasAudioContext };
