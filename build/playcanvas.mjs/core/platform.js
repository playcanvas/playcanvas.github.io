let desktop = false;
let mobile = false;
let windows = false;
let xbox = false;
let android = false;
let ios = false;
let touch = false;
let gamepads = false;
let workers = false;
let passiveEvents = false;
if (typeof navigator !== 'undefined') {
	const ua = navigator.userAgent;
	if (/(windows|mac os|linux|cros)/i.test(ua)) desktop = true;
	if (/xbox/i.test(ua)) xbox = true;
	if (/(windows phone|iemobile|wpdesktop)/i.test(ua)) {
		desktop = false;
		mobile = true;
		windows = true;
	} else if (/android/i.test(ua)) {
		desktop = false;
		mobile = true;
		android = true;
	} else if (/ip([ao]d|hone)/i.test(ua)) {
		desktop = false;
		mobile = true;
		ios = true;
	}
	if (typeof window !== 'undefined') {
		touch = 'ontouchstart' in window || 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0;
	}
	gamepads = !!navigator.getGamepads || !!navigator.webkitGetGamepads;
	workers = typeof Worker !== 'undefined';
	try {
		const opts = Object.defineProperty({}, 'passive', {
			get: function () {
				passiveEvents = true;
				return false;
			}
		});
		window.addEventListener('testpassive', null, opts);
		window.removeEventListener('testpassive', null, opts);
	} catch (e) {}
}
const environment = typeof window !== 'undefined' ? 'browser' : 'node';
const platform = {
	environment: environment,
	global: environment === 'browser' ? window : global,
	browser: environment === 'browser',
	desktop: desktop,
	mobile: mobile,
	ios: ios,
	android: android,
	windows: windows,
	xbox: xbox,
	gamepads: gamepads,
	touch: touch,
	workers: workers,
	passiveEvents: passiveEvents
};

export { platform };
