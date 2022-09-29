/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class Tracing {
  static set(channel, enabled = true) {}

  static get(channel) {
    return Tracing._traceChannels.has(channel);
  }

}

Tracing._traceChannels = new Set();

export { Tracing };
