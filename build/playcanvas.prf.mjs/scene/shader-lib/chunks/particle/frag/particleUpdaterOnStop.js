/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleUpdaterOnStopPS = `
    visMode = outLife < 0.0? -1.0: visMode;
`;

export { particleUpdaterOnStopPS as default };
