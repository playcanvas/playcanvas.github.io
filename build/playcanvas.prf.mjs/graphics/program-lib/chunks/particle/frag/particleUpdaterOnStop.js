/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterOnStopPS = `
    visMode = outLife < 0.0? -1.0: visMode;
`;

export { particleUpdaterOnStopPS as default };
