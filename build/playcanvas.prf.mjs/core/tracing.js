/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (PROFILER)
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
