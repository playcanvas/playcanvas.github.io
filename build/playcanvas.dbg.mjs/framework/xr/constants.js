/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
/**
 * Inline - always available type of session. It has limited features availability and is rendered
 * into HTML element.
 *
 * @type {string}
 */
const XRTYPE_INLINE = 'inline';

/**
 * Immersive VR - session that provides exclusive access to VR device with best available tracking
 * features.
 *
 * @type {string}
 */
const XRTYPE_VR = 'immersive-vr';

/**
 * Immersive AR - session that provides exclusive access to VR/AR device that is intended to be
 * blended with real-world environment.
 *
 * @type {string}
 */
const XRTYPE_AR = 'immersive-ar';

/**
 * Viewer - always supported space with some basic tracking capabilities.
 *
 * @type {string}
 */
const XRSPACE_VIEWER = 'viewer';

/**
 * Local - represents a tracking space with a native origin near the viewer at the time of
 * creation. The exact position and orientation will be initialized based on the conventions of the
 * underlying platform. When using this reference space the user is not expected to move beyond
 * their initial position much, if at all, and tracking is optimized for that purpose. For devices
 * with 6DoF tracking, local reference spaces should emphasize keeping the origin stable relative
 * to the user's environment.
 *
 * @type {string}
 */
const XRSPACE_LOCAL = 'local';

/**
 * Local Floor - represents a tracking space with a native origin at the floor in a safe position
 * for the user to stand. The y axis equals 0 at floor level, with the x and z position and
 * orientation initialized based on the conventions of the underlying platform. Floor level value
 * might be estimated by the underlying platform. When using this reference space, the user is not
 * expected to move beyond their initial position much, if at all, and tracking is optimized for
 * that purpose. For devices with 6DoF tracking, local-floor reference spaces should emphasize
 * keeping the origin stable relative to the user's environment.
 *
 * @type {string}
 */
const XRSPACE_LOCALFLOOR = 'local-floor';

/**
 * Bounded Floor - represents a tracking space with its native origin at the floor, where the user
 * is expected to move within a pre-established boundary. Tracking in a bounded-floor reference
 * space is optimized for keeping the native origin and bounds geometry stable relative to the
 * user's environment.
 *
 * @type {string}
 */
const XRSPACE_BOUNDEDFLOOR = 'bounded-floor';

/**
 * Unbounded - represents a tracking space where the user is expected to move freely around their
 * environment, potentially even long distances from their starting point. Tracking in an unbounded
 * reference space is optimized for stability around the user's current position, and as such the
 * native origin may drift over time.
 *
 * @type {string}
 */
const XRSPACE_UNBOUNDED = 'unbounded';

/**
 * Gaze - indicates the target ray will originate at the viewer and follow the direction it is
 * facing. This is commonly referred to as a "gaze input" device in the context of head-mounted
 * displays.
 *
 * @type {string}
 */
const XRTARGETRAY_GAZE = 'gaze';

/**
 * Screen - indicates that the input source was an interaction with the canvas element associated
 * with an inline session's output context, such as a mouse click or touch event.
 *
 * @type {string}
 */
const XRTARGETRAY_SCREEN = 'screen';

/**
 * Tracked Pointer - indicates that the target ray originates from either a handheld device or
 * other hand-tracking mechanism and represents that the user is using their hands or the held
 * device for pointing.
 *
 * @type {string}
 */
const XRTARGETRAY_POINTER = 'tracked-pointer';

/**
 * None - input source is not meant to be held in hands.
 *
 * @type {string}
 */
const XRHAND_NONE = 'none';

/**
 * Left - indicates that input source is meant to be held in left hand.
 *
 * @type {string}
 */
const XRHAND_LEFT = 'left';

/**
 * Right - indicates that input source is meant to be held in right hand.
 *
 * @type {string}
 */
const XRHAND_RIGHT = 'right';

/**
 * Point - indicates that the hit test results will be computed based on the feature points
 * detected by the underlying Augmented Reality system.
 *
 * @type {string}
 */
const XRTRACKABLE_POINT = 'point';

/**
 * Plane - indicates that the hit test results will be computed based on the planes detected by the
 * underlying Augmented Reality system.
 *
 * @type {string}
 */
const XRTRACKABLE_PLANE = 'plane';

/**
 * Mesh - indicates that the hit test results will be computed based on the meshes detected by the
 * underlying Augmented Reality system.
 *
 * @type {string}
 */
const XRTRACKABLE_MESH = 'mesh';

/**
 * CPU - indicates that depth sensing preferred usage is CPU. This usage path is guaranteed to be
 * supported.
 *
 * @type {string}
 */
const XRDEPTHSENSINGUSAGE_CPU = 'cpu-optimized';

/**
 * GPU - indicates that depth sensing preferred usage is GPU.
 *
 * @type {string}
 */
const XRDEPTHSENSINGUSAGE_GPU = 'gpu-optimized';

/**
 * Luminance Alpha - indicates that depth sensing preferred raw data format is Luminance Alpha.
 * This format is guaranteed to be supported.
 *
 * @type {string}
 */
const XRDEPTHSENSINGFORMAT_L8A8 = 'luminance-alpha';

/**
 * Float 32 - indicates that depth sensing preferred raw data format is Float 32.
 *
 * @type {string}
 */
const XRDEPTHSENSINGFORMAT_F32 = 'float32';

export { XRDEPTHSENSINGFORMAT_F32, XRDEPTHSENSINGFORMAT_L8A8, XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGUSAGE_GPU, XRHAND_LEFT, XRHAND_NONE, XRHAND_RIGHT, XRSPACE_BOUNDEDFLOOR, XRSPACE_LOCAL, XRSPACE_LOCALFLOOR, XRSPACE_UNBOUNDED, XRSPACE_VIEWER, XRTARGETRAY_GAZE, XRTARGETRAY_POINTER, XRTARGETRAY_SCREEN, XRTRACKABLE_MESH, XRTRACKABLE_PLANE, XRTRACKABLE_POINT, XRTYPE_AR, XRTYPE_INLINE, XRTYPE_VR };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL3hyL2NvbnN0YW50cy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIElubGluZSAtIGFsd2F5cyBhdmFpbGFibGUgdHlwZSBvZiBzZXNzaW9uLiBJdCBoYXMgbGltaXRlZCBmZWF0dXJlcyBhdmFpbGFiaWxpdHkgYW5kIGlzIHJlbmRlcmVkXG4gKiBpbnRvIEhUTUwgZWxlbWVudC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJUWVBFX0lOTElORSA9ICdpbmxpbmUnO1xuXG4vKipcbiAqIEltbWVyc2l2ZSBWUiAtIHNlc3Npb24gdGhhdCBwcm92aWRlcyBleGNsdXNpdmUgYWNjZXNzIHRvIFZSIGRldmljZSB3aXRoIGJlc3QgYXZhaWxhYmxlIHRyYWNraW5nXG4gKiBmZWF0dXJlcy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJUWVBFX1ZSID0gJ2ltbWVyc2l2ZS12cic7XG5cbi8qKlxuICogSW1tZXJzaXZlIEFSIC0gc2Vzc2lvbiB0aGF0IHByb3ZpZGVzIGV4Y2x1c2l2ZSBhY2Nlc3MgdG8gVlIvQVIgZGV2aWNlIHRoYXQgaXMgaW50ZW5kZWQgdG8gYmVcbiAqIGJsZW5kZWQgd2l0aCByZWFsLXdvcmxkIGVudmlyb25tZW50LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBYUlRZUEVfQVIgPSAnaW1tZXJzaXZlLWFyJztcblxuLyoqXG4gKiBWaWV3ZXIgLSBhbHdheXMgc3VwcG9ydGVkIHNwYWNlIHdpdGggc29tZSBiYXNpYyB0cmFja2luZyBjYXBhYmlsaXRpZXMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFhSU1BBQ0VfVklFV0VSID0gJ3ZpZXdlcic7XG5cbi8qKlxuICogTG9jYWwgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW4gbmVhciB0aGUgdmlld2VyIGF0IHRoZSB0aW1lIG9mXG4gKiBjcmVhdGlvbi4gVGhlIGV4YWN0IHBvc2l0aW9uIGFuZCBvcmllbnRhdGlvbiB3aWxsIGJlIGluaXRpYWxpemVkIGJhc2VkIG9uIHRoZSBjb252ZW50aW9ucyBvZiB0aGVcbiAqIHVuZGVybHlpbmcgcGxhdGZvcm0uIFdoZW4gdXNpbmcgdGhpcyByZWZlcmVuY2Ugc3BhY2UgdGhlIHVzZXIgaXMgbm90IGV4cGVjdGVkIHRvIG1vdmUgYmV5b25kXG4gKiB0aGVpciBpbml0aWFsIHBvc2l0aW9uIG11Y2gsIGlmIGF0IGFsbCwgYW5kIHRyYWNraW5nIGlzIG9wdGltaXplZCBmb3IgdGhhdCBwdXJwb3NlLiBGb3IgZGV2aWNlc1xuICogd2l0aCA2RG9GIHRyYWNraW5nLCBsb2NhbCByZWZlcmVuY2Ugc3BhY2VzIHNob3VsZCBlbXBoYXNpemUga2VlcGluZyB0aGUgb3JpZ2luIHN0YWJsZSByZWxhdGl2ZVxuICogdG8gdGhlIHVzZXIncyBlbnZpcm9ubWVudC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJTUEFDRV9MT0NBTCA9ICdsb2NhbCc7XG5cbi8qKlxuICogTG9jYWwgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBhIG5hdGl2ZSBvcmlnaW4gYXQgdGhlIGZsb29yIGluIGEgc2FmZSBwb3NpdGlvblxuICogZm9yIHRoZSB1c2VyIHRvIHN0YW5kLiBUaGUgeSBheGlzIGVxdWFscyAwIGF0IGZsb29yIGxldmVsLCB3aXRoIHRoZSB4IGFuZCB6IHBvc2l0aW9uIGFuZFxuICogb3JpZW50YXRpb24gaW5pdGlhbGl6ZWQgYmFzZWQgb24gdGhlIGNvbnZlbnRpb25zIG9mIHRoZSB1bmRlcmx5aW5nIHBsYXRmb3JtLiBGbG9vciBsZXZlbCB2YWx1ZVxuICogbWlnaHQgYmUgZXN0aW1hdGVkIGJ5IHRoZSB1bmRlcmx5aW5nIHBsYXRmb3JtLiBXaGVuIHVzaW5nIHRoaXMgcmVmZXJlbmNlIHNwYWNlLCB0aGUgdXNlciBpcyBub3RcbiAqIGV4cGVjdGVkIHRvIG1vdmUgYmV5b25kIHRoZWlyIGluaXRpYWwgcG9zaXRpb24gbXVjaCwgaWYgYXQgYWxsLCBhbmQgdHJhY2tpbmcgaXMgb3B0aW1pemVkIGZvclxuICogdGhhdCBwdXJwb3NlLiBGb3IgZGV2aWNlcyB3aXRoIDZEb0YgdHJhY2tpbmcsIGxvY2FsLWZsb29yIHJlZmVyZW5jZSBzcGFjZXMgc2hvdWxkIGVtcGhhc2l6ZVxuICoga2VlcGluZyB0aGUgb3JpZ2luIHN0YWJsZSByZWxhdGl2ZSB0byB0aGUgdXNlcidzIGVudmlyb25tZW50LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBYUlNQQUNFX0xPQ0FMRkxPT1IgPSAnbG9jYWwtZmxvb3InO1xuXG4vKipcbiAqIEJvdW5kZWQgRmxvb3IgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2l0aCBpdHMgbmF0aXZlIG9yaWdpbiBhdCB0aGUgZmxvb3IsIHdoZXJlIHRoZSB1c2VyXG4gKiBpcyBleHBlY3RlZCB0byBtb3ZlIHdpdGhpbiBhIHByZS1lc3RhYmxpc2hlZCBib3VuZGFyeS4gVHJhY2tpbmcgaW4gYSBib3VuZGVkLWZsb29yIHJlZmVyZW5jZVxuICogc3BhY2UgaXMgb3B0aW1pemVkIGZvciBrZWVwaW5nIHRoZSBuYXRpdmUgb3JpZ2luIGFuZCBib3VuZHMgZ2VvbWV0cnkgc3RhYmxlIHJlbGF0aXZlIHRvIHRoZVxuICogdXNlcidzIGVudmlyb25tZW50LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBYUlNQQUNFX0JPVU5ERURGTE9PUiA9ICdib3VuZGVkLWZsb29yJztcblxuLyoqXG4gKiBVbmJvdW5kZWQgLSByZXByZXNlbnRzIGEgdHJhY2tpbmcgc3BhY2Ugd2hlcmUgdGhlIHVzZXIgaXMgZXhwZWN0ZWQgdG8gbW92ZSBmcmVlbHkgYXJvdW5kIHRoZWlyXG4gKiBlbnZpcm9ubWVudCwgcG90ZW50aWFsbHkgZXZlbiBsb25nIGRpc3RhbmNlcyBmcm9tIHRoZWlyIHN0YXJ0aW5nIHBvaW50LiBUcmFja2luZyBpbiBhbiB1bmJvdW5kZWRcbiAqIHJlZmVyZW5jZSBzcGFjZSBpcyBvcHRpbWl6ZWQgZm9yIHN0YWJpbGl0eSBhcm91bmQgdGhlIHVzZXIncyBjdXJyZW50IHBvc2l0aW9uLCBhbmQgYXMgc3VjaCB0aGVcbiAqIG5hdGl2ZSBvcmlnaW4gbWF5IGRyaWZ0IG92ZXIgdGltZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJTUEFDRV9VTkJPVU5ERUQgPSAndW5ib3VuZGVkJztcblxuLyoqXG4gKiBHYXplIC0gaW5kaWNhdGVzIHRoZSB0YXJnZXQgcmF5IHdpbGwgb3JpZ2luYXRlIGF0IHRoZSB2aWV3ZXIgYW5kIGZvbGxvdyB0aGUgZGlyZWN0aW9uIGl0IGlzXG4gKiBmYWNpbmcuIFRoaXMgaXMgY29tbW9ubHkgcmVmZXJyZWQgdG8gYXMgYSBcImdhemUgaW5wdXRcIiBkZXZpY2UgaW4gdGhlIGNvbnRleHQgb2YgaGVhZC1tb3VudGVkXG4gKiBkaXNwbGF5cy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJUQVJHRVRSQVlfR0FaRSA9ICdnYXplJztcblxuLyoqXG4gKiBTY3JlZW4gLSBpbmRpY2F0ZXMgdGhhdCB0aGUgaW5wdXQgc291cmNlIHdhcyBhbiBpbnRlcmFjdGlvbiB3aXRoIHRoZSBjYW52YXMgZWxlbWVudCBhc3NvY2lhdGVkXG4gKiB3aXRoIGFuIGlubGluZSBzZXNzaW9uJ3Mgb3V0cHV0IGNvbnRleHQsIHN1Y2ggYXMgYSBtb3VzZSBjbGljayBvciB0b3VjaCBldmVudC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJUQVJHRVRSQVlfU0NSRUVOID0gJ3NjcmVlbic7XG5cbi8qKlxuICogVHJhY2tlZCBQb2ludGVyIC0gaW5kaWNhdGVzIHRoYXQgdGhlIHRhcmdldCByYXkgb3JpZ2luYXRlcyBmcm9tIGVpdGhlciBhIGhhbmRoZWxkIGRldmljZSBvclxuICogb3RoZXIgaGFuZC10cmFja2luZyBtZWNoYW5pc20gYW5kIHJlcHJlc2VudHMgdGhhdCB0aGUgdXNlciBpcyB1c2luZyB0aGVpciBoYW5kcyBvciB0aGUgaGVsZFxuICogZGV2aWNlIGZvciBwb2ludGluZy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJUQVJHRVRSQVlfUE9JTlRFUiA9ICd0cmFja2VkLXBvaW50ZXInO1xuXG4vKipcbiAqIE5vbmUgLSBpbnB1dCBzb3VyY2UgaXMgbm90IG1lYW50IHRvIGJlIGhlbGQgaW4gaGFuZHMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFhSSEFORF9OT05FID0gJ25vbmUnO1xuXG4vKipcbiAqIExlZnQgLSBpbmRpY2F0ZXMgdGhhdCBpbnB1dCBzb3VyY2UgaXMgbWVhbnQgdG8gYmUgaGVsZCBpbiBsZWZ0IGhhbmQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFhSSEFORF9MRUZUID0gJ2xlZnQnO1xuXG4vKipcbiAqIFJpZ2h0IC0gaW5kaWNhdGVzIHRoYXQgaW5wdXQgc291cmNlIGlzIG1lYW50IHRvIGJlIGhlbGQgaW4gcmlnaHQgaGFuZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJIQU5EX1JJR0hUID0gJ3JpZ2h0JztcblxuLyoqXG4gKiBQb2ludCAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWQgYmFzZWQgb24gdGhlIGZlYXR1cmUgcG9pbnRzXG4gKiBkZXRlY3RlZCBieSB0aGUgdW5kZXJseWluZyBBdWdtZW50ZWQgUmVhbGl0eSBzeXN0ZW0uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFhSVFJBQ0tBQkxFX1BPSU5UID0gJ3BvaW50JztcblxuLyoqXG4gKiBQbGFuZSAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWQgYmFzZWQgb24gdGhlIHBsYW5lcyBkZXRlY3RlZCBieSB0aGVcbiAqIHVuZGVybHlpbmcgQXVnbWVudGVkIFJlYWxpdHkgc3lzdGVtLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBYUlRSQUNLQUJMRV9QTEFORSA9ICdwbGFuZSc7XG5cbi8qKlxuICogTWVzaCAtIGluZGljYXRlcyB0aGF0IHRoZSBoaXQgdGVzdCByZXN1bHRzIHdpbGwgYmUgY29tcHV0ZWQgYmFzZWQgb24gdGhlIG1lc2hlcyBkZXRlY3RlZCBieSB0aGVcbiAqIHVuZGVybHlpbmcgQXVnbWVudGVkIFJlYWxpdHkgc3lzdGVtLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBYUlRSQUNLQUJMRV9NRVNIID0gJ21lc2gnO1xuXG4vKipcbiAqIENQVSAtIGluZGljYXRlcyB0aGF0IGRlcHRoIHNlbnNpbmcgcHJlZmVycmVkIHVzYWdlIGlzIENQVS4gVGhpcyB1c2FnZSBwYXRoIGlzIGd1YXJhbnRlZWQgdG8gYmVcbiAqIHN1cHBvcnRlZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJERVBUSFNFTlNJTkdVU0FHRV9DUFUgPSAnY3B1LW9wdGltaXplZCc7XG5cbi8qKlxuICogR1BVIC0gaW5kaWNhdGVzIHRoYXQgZGVwdGggc2Vuc2luZyBwcmVmZXJyZWQgdXNhZ2UgaXMgR1BVLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBYUkRFUFRIU0VOU0lOR1VTQUdFX0dQVSA9ICdncHUtb3B0aW1pemVkJztcblxuLyoqXG4gKiBMdW1pbmFuY2UgQWxwaGEgLSBpbmRpY2F0ZXMgdGhhdCBkZXB0aCBzZW5zaW5nIHByZWZlcnJlZCByYXcgZGF0YSBmb3JtYXQgaXMgTHVtaW5hbmNlIEFscGhhLlxuICogVGhpcyBmb3JtYXQgaXMgZ3VhcmFudGVlZCB0byBiZSBzdXBwb3J0ZWQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFhSREVQVEhTRU5TSU5HRk9STUFUX0w4QTggPSAnbHVtaW5hbmNlLWFscGhhJztcblxuLyoqXG4gKiBGbG9hdCAzMiAtIGluZGljYXRlcyB0aGF0IGRlcHRoIHNlbnNpbmcgcHJlZmVycmVkIHJhdyBkYXRhIGZvcm1hdCBpcyBGbG9hdCAzMi5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgWFJERVBUSFNFTlNJTkdGT1JNQVRfRjMyID0gJ2Zsb2F0MzInO1xuIl0sIm5hbWVzIjpbIlhSVFlQRV9JTkxJTkUiLCJYUlRZUEVfVlIiLCJYUlRZUEVfQVIiLCJYUlNQQUNFX1ZJRVdFUiIsIlhSU1BBQ0VfTE9DQUwiLCJYUlNQQUNFX0xPQ0FMRkxPT1IiLCJYUlNQQUNFX0JPVU5ERURGTE9PUiIsIlhSU1BBQ0VfVU5CT1VOREVEIiwiWFJUQVJHRVRSQVlfR0FaRSIsIlhSVEFSR0VUUkFZX1NDUkVFTiIsIlhSVEFSR0VUUkFZX1BPSU5URVIiLCJYUkhBTkRfTk9ORSIsIlhSSEFORF9MRUZUIiwiWFJIQU5EX1JJR0hUIiwiWFJUUkFDS0FCTEVfUE9JTlQiLCJYUlRSQUNLQUJMRV9QTEFORSIsIlhSVFJBQ0tBQkxFX01FU0giLCJYUkRFUFRIU0VOU0lOR1VTQUdFX0NQVSIsIlhSREVQVEhTRU5TSU5HVVNBR0VfR1BVIiwiWFJERVBUSFNFTlNJTkdGT1JNQVRfTDhBOCIsIlhSREVQVEhTRU5TSU5HRk9STUFUX0YzMiJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQSxhQUFhLEdBQUcsU0FBUTs7QUFFckM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsU0FBUyxHQUFHLGVBQWM7O0FBRXZDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFNBQVMsR0FBRyxlQUFjOztBQUV2QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsY0FBYyxHQUFHLFNBQVE7O0FBRXRDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsYUFBYSxHQUFHLFFBQU87O0FBRXBDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxrQkFBa0IsR0FBRyxjQUFhOztBQUUvQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsb0JBQW9CLEdBQUcsZ0JBQWU7O0FBRW5EO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxZQUFXOztBQUU1QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGdCQUFnQixHQUFHLE9BQU07O0FBRXRDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGtCQUFrQixHQUFHLFNBQVE7O0FBRTFDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsbUJBQW1CLEdBQUcsa0JBQWlCOztBQUVwRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsV0FBVyxHQUFHLE9BQU07O0FBRWpDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxXQUFXLEdBQUcsT0FBTTs7QUFFakM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLFlBQVksR0FBRyxRQUFPOztBQUVuQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxRQUFPOztBQUV4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxpQkFBaUIsR0FBRyxRQUFPOztBQUV4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxnQkFBZ0IsR0FBRyxPQUFNOztBQUV0QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyx1QkFBdUIsR0FBRyxnQkFBZTs7QUFFdEQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHVCQUF1QixHQUFHLGdCQUFlOztBQUV0RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyx5QkFBeUIsR0FBRyxrQkFBaUI7O0FBRTFEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyx3QkFBd0IsR0FBRzs7OzsifQ==
