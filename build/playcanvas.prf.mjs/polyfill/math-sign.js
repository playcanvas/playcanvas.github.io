/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
if (!Math.sign) {
  Math.sign = function (x) {
    return (x > 0) - (x < 0) || +x;
  };
}
