/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterOnStopPS = `
		visMode = outLife < 0.0? -1.0: visMode;
`;

export { particleUpdaterOnStopPS as default };
