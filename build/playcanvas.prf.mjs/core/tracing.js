/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
class Tracing {

  static set(channel, enabled = true) {}

  static get(channel) {
    return Tracing._traceChannels.has(channel);
  }
}
Tracing._traceChannels = new Set();
Tracing.stack = false;

export { Tracing };
