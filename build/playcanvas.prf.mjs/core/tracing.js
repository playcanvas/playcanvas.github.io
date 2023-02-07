/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
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
