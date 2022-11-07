/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
const BODYTYPE_STATIC = 'static';

const BODYTYPE_DYNAMIC = 'dynamic';

const BODYTYPE_KINEMATIC = 'kinematic';

const BODYFLAG_STATIC_OBJECT = 1;
const BODYFLAG_KINEMATIC_OBJECT = 2;
const BODYFLAG_NORESPONSE_OBJECT = 4;

const BODYSTATE_ACTIVE_TAG = 1;
const BODYSTATE_ISLAND_SLEEPING = 2;
const BODYSTATE_WANTS_DEACTIVATION = 3;
const BODYSTATE_DISABLE_DEACTIVATION = 4;
const BODYSTATE_DISABLE_SIMULATION = 5;

const BODYGROUP_NONE = 0;
const BODYGROUP_DEFAULT = 1;
const BODYGROUP_DYNAMIC = 1;
const BODYGROUP_STATIC = 2;
const BODYGROUP_KINEMATIC = 4;
const BODYGROUP_ENGINE_1 = 8;
const BODYGROUP_TRIGGER = 16;
const BODYGROUP_ENGINE_2 = 32;
const BODYGROUP_ENGINE_3 = 64;
const BODYGROUP_USER_1 = 128;
const BODYGROUP_USER_2 = 256;
const BODYGROUP_USER_3 = 512;
const BODYGROUP_USER_4 = 1024;
const BODYGROUP_USER_5 = 2048;
const BODYGROUP_USER_6 = 4096;
const BODYGROUP_USER_7 = 8192;
const BODYGROUP_USER_8 = 16384;

const BODYMASK_NONE = 0;
const BODYMASK_ALL = 65535;
const BODYMASK_STATIC = 2;
const BODYMASK_NOT_STATIC = 65535 ^ 2;
const BODYMASK_NOT_STATIC_KINEMATIC = 65535 ^ (2 | 4);

export { BODYFLAG_KINEMATIC_OBJECT, BODYFLAG_NORESPONSE_OBJECT, BODYFLAG_STATIC_OBJECT, BODYGROUP_DEFAULT, BODYGROUP_DYNAMIC, BODYGROUP_ENGINE_1, BODYGROUP_ENGINE_2, BODYGROUP_ENGINE_3, BODYGROUP_KINEMATIC, BODYGROUP_NONE, BODYGROUP_STATIC, BODYGROUP_TRIGGER, BODYGROUP_USER_1, BODYGROUP_USER_2, BODYGROUP_USER_3, BODYGROUP_USER_4, BODYGROUP_USER_5, BODYGROUP_USER_6, BODYGROUP_USER_7, BODYGROUP_USER_8, BODYMASK_ALL, BODYMASK_NONE, BODYMASK_NOT_STATIC, BODYMASK_NOT_STATIC_KINEMATIC, BODYMASK_STATIC, BODYSTATE_ACTIVE_TAG, BODYSTATE_DISABLE_DEACTIVATION, BODYSTATE_DISABLE_SIMULATION, BODYSTATE_ISLAND_SLEEPING, BODYSTATE_WANTS_DEACTIVATION, BODYTYPE_DYNAMIC, BODYTYPE_KINEMATIC, BODYTYPE_STATIC };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvZnJhbWV3b3JrL2NvbXBvbmVudHMvcmlnaWQtYm9keS9jb25zdGFudHMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBSaWdpZCBib2R5IGhhcyBpbmZpbml0ZSBtYXNzIGFuZCBjYW5ub3QgbW92ZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgQk9EWVRZUEVfU1RBVElDID0gJ3N0YXRpYyc7XG5cbi8qKlxuICogUmlnaWQgYm9keSBpcyBzaW11bGF0ZWQgYWNjb3JkaW5nIHRvIGFwcGxpZWQgZm9yY2VzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBCT0RZVFlQRV9EWU5BTUlDID0gJ2R5bmFtaWMnO1xuXG4vKipcbiAqIFJpZ2lkIGJvZHkgaGFzIGluZmluaXRlIG1hc3MgYW5kIGRvZXMgbm90IHJlc3BvbmQgdG8gZm9yY2VzIGJ1dCBjYW4gc3RpbGwgYmUgbW92ZWQgYnkgc2V0dGluZ1xuICogdGhlaXIgdmVsb2NpdHkgb3IgcG9zaXRpb24uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IEJPRFlUWVBFX0tJTkVNQVRJQyA9ICdraW5lbWF0aWMnO1xuXG4vLyBDb2xsaXNpb24gZmxhZ3NcbmV4cG9ydCBjb25zdCBCT0RZRkxBR19TVEFUSUNfT0JKRUNUID0gMTtcbmV4cG9ydCBjb25zdCBCT0RZRkxBR19LSU5FTUFUSUNfT0JKRUNUID0gMjtcbmV4cG9ydCBjb25zdCBCT0RZRkxBR19OT1JFU1BPTlNFX09CSkVDVCA9IDQ7XG5cbi8vIEFjdGl2YXRpb24gc3RhdGVzXG5leHBvcnQgY29uc3QgQk9EWVNUQVRFX0FDVElWRV9UQUcgPSAxO1xuZXhwb3J0IGNvbnN0IEJPRFlTVEFURV9JU0xBTkRfU0xFRVBJTkcgPSAyO1xuZXhwb3J0IGNvbnN0IEJPRFlTVEFURV9XQU5UU19ERUFDVElWQVRJT04gPSAzO1xuZXhwb3J0IGNvbnN0IEJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiA9IDQ7XG5leHBvcnQgY29uc3QgQk9EWVNUQVRFX0RJU0FCTEVfU0lNVUxBVElPTiA9IDU7XG5cbi8vIGdyb3Vwc1xuZXhwb3J0IGNvbnN0IEJPRFlHUk9VUF9OT05FID0gMDtcbmV4cG9ydCBjb25zdCBCT0RZR1JPVVBfREVGQVVMVCA9IDE7XG5leHBvcnQgY29uc3QgQk9EWUdST1VQX0RZTkFNSUMgPSAxO1xuZXhwb3J0IGNvbnN0IEJPRFlHUk9VUF9TVEFUSUMgPSAyO1xuZXhwb3J0IGNvbnN0IEJPRFlHUk9VUF9LSU5FTUFUSUMgPSA0O1xuZXhwb3J0IGNvbnN0IEJPRFlHUk9VUF9FTkdJTkVfMSA9IDg7XG5leHBvcnQgY29uc3QgQk9EWUdST1VQX1RSSUdHRVIgPSAxNjtcbmV4cG9ydCBjb25zdCBCT0RZR1JPVVBfRU5HSU5FXzIgPSAzMjtcbmV4cG9ydCBjb25zdCBCT0RZR1JPVVBfRU5HSU5FXzMgPSA2NDtcbmV4cG9ydCBjb25zdCBCT0RZR1JPVVBfVVNFUl8xID0gMTI4O1xuZXhwb3J0IGNvbnN0IEJPRFlHUk9VUF9VU0VSXzIgPSAyNTY7XG5leHBvcnQgY29uc3QgQk9EWUdST1VQX1VTRVJfMyA9IDUxMjtcbmV4cG9ydCBjb25zdCBCT0RZR1JPVVBfVVNFUl80ID0gMTAyNDtcbmV4cG9ydCBjb25zdCBCT0RZR1JPVVBfVVNFUl81ID0gMjA0ODtcbmV4cG9ydCBjb25zdCBCT0RZR1JPVVBfVVNFUl82ID0gNDA5NjtcbmV4cG9ydCBjb25zdCBCT0RZR1JPVVBfVVNFUl83ID0gODE5MjtcbmV4cG9ydCBjb25zdCBCT0RZR1JPVVBfVVNFUl84ID0gMTYzODQ7XG5cbi8vIG1hc2tzXG5leHBvcnQgY29uc3QgQk9EWU1BU0tfTk9ORSA9IDA7XG5leHBvcnQgY29uc3QgQk9EWU1BU0tfQUxMID0gNjU1MzU7XG5leHBvcnQgY29uc3QgQk9EWU1BU0tfU1RBVElDID0gMjtcbmV4cG9ydCBjb25zdCBCT0RZTUFTS19OT1RfU1RBVElDID0gNjU1MzUgXiAyO1xuZXhwb3J0IGNvbnN0IEJPRFlNQVNLX05PVF9TVEFUSUNfS0lORU1BVElDID0gNjU1MzUgXiAoMiB8IDQpO1xuIl0sIm5hbWVzIjpbIkJPRFlUWVBFX1NUQVRJQyIsIkJPRFlUWVBFX0RZTkFNSUMiLCJCT0RZVFlQRV9LSU5FTUFUSUMiLCJCT0RZRkxBR19TVEFUSUNfT0JKRUNUIiwiQk9EWUZMQUdfS0lORU1BVElDX09CSkVDVCIsIkJPRFlGTEFHX05PUkVTUE9OU0VfT0JKRUNUIiwiQk9EWVNUQVRFX0FDVElWRV9UQUciLCJCT0RZU1RBVEVfSVNMQU5EX1NMRUVQSU5HIiwiQk9EWVNUQVRFX1dBTlRTX0RFQUNUSVZBVElPTiIsIkJPRFlTVEFURV9ESVNBQkxFX0RFQUNUSVZBVElPTiIsIkJPRFlTVEFURV9ESVNBQkxFX1NJTVVMQVRJT04iLCJCT0RZR1JPVVBfTk9ORSIsIkJPRFlHUk9VUF9ERUZBVUxUIiwiQk9EWUdST1VQX0RZTkFNSUMiLCJCT0RZR1JPVVBfU1RBVElDIiwiQk9EWUdST1VQX0tJTkVNQVRJQyIsIkJPRFlHUk9VUF9FTkdJTkVfMSIsIkJPRFlHUk9VUF9UUklHR0VSIiwiQk9EWUdST1VQX0VOR0lORV8yIiwiQk9EWUdST1VQX0VOR0lORV8zIiwiQk9EWUdST1VQX1VTRVJfMSIsIkJPRFlHUk9VUF9VU0VSXzIiLCJCT0RZR1JPVVBfVVNFUl8zIiwiQk9EWUdST1VQX1VTRVJfNCIsIkJPRFlHUk9VUF9VU0VSXzUiLCJCT0RZR1JPVVBfVVNFUl82IiwiQk9EWUdST1VQX1VTRVJfNyIsIkJPRFlHUk9VUF9VU0VSXzgiLCJCT0RZTUFTS19OT05FIiwiQk9EWU1BU0tfQUxMIiwiQk9EWU1BU0tfU1RBVElDIiwiQk9EWU1BU0tfTk9UX1NUQVRJQyIsIkJPRFlNQVNLX05PVF9TVEFUSUNfS0lORU1BVElDIl0sIm1hcHBpbmdzIjoiOzs7OztBQUtPLE1BQU1BLGVBQWUsR0FBRyxTQUFROztBQU9oQyxNQUFNQyxnQkFBZ0IsR0FBRyxVQUFTOztBQVFsQyxNQUFNQyxrQkFBa0IsR0FBRyxZQUFXOztBQUd0QyxNQUFNQyxzQkFBc0IsR0FBRyxFQUFDO0FBQ2hDLE1BQU1DLHlCQUF5QixHQUFHLEVBQUM7QUFDbkMsTUFBTUMsMEJBQTBCLEdBQUcsRUFBQzs7QUFHcEMsTUFBTUMsb0JBQW9CLEdBQUcsRUFBQztBQUM5QixNQUFNQyx5QkFBeUIsR0FBRyxFQUFDO0FBQ25DLE1BQU1DLDRCQUE0QixHQUFHLEVBQUM7QUFDdEMsTUFBTUMsOEJBQThCLEdBQUcsRUFBQztBQUN4QyxNQUFNQyw0QkFBNEIsR0FBRyxFQUFDOztBQUd0QyxNQUFNQyxjQUFjLEdBQUcsRUFBQztBQUN4QixNQUFNQyxpQkFBaUIsR0FBRyxFQUFDO0FBQzNCLE1BQU1DLGlCQUFpQixHQUFHLEVBQUM7QUFDM0IsTUFBTUMsZ0JBQWdCLEdBQUcsRUFBQztBQUMxQixNQUFNQyxtQkFBbUIsR0FBRyxFQUFDO0FBQzdCLE1BQU1DLGtCQUFrQixHQUFHLEVBQUM7QUFDNUIsTUFBTUMsaUJBQWlCLEdBQUcsR0FBRTtBQUM1QixNQUFNQyxrQkFBa0IsR0FBRyxHQUFFO0FBQzdCLE1BQU1DLGtCQUFrQixHQUFHLEdBQUU7QUFDN0IsTUFBTUMsZ0JBQWdCLEdBQUcsSUFBRztBQUM1QixNQUFNQyxnQkFBZ0IsR0FBRyxJQUFHO0FBQzVCLE1BQU1DLGdCQUFnQixHQUFHLElBQUc7QUFDNUIsTUFBTUMsZ0JBQWdCLEdBQUcsS0FBSTtBQUM3QixNQUFNQyxnQkFBZ0IsR0FBRyxLQUFJO0FBQzdCLE1BQU1DLGdCQUFnQixHQUFHLEtBQUk7QUFDN0IsTUFBTUMsZ0JBQWdCLEdBQUcsS0FBSTtBQUM3QixNQUFNQyxnQkFBZ0IsR0FBRyxNQUFLOztBQUc5QixNQUFNQyxhQUFhLEdBQUcsRUFBQztBQUN2QixNQUFNQyxZQUFZLEdBQUcsTUFBSztBQUMxQixNQUFNQyxlQUFlLEdBQUcsRUFBQztBQUNuQkMsTUFBQUEsbUJBQW1CLEdBQUcsS0FBSyxHQUFHLEVBQUM7QUFDckMsTUFBTUMsNkJBQTZCLEdBQUcsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDOzs7OyJ9