const detectPassiveEvents = () => {
	let result = false;
	try {
		const opts = Object.defineProperty({}, 'passive', {
			get: function () {
				result = true;
				return false;
			}
		});
		window.addEventListener('testpassive', null, opts);
		window.removeEventListener('testpassive', null, opts);
	} catch (e) {}
	return result;
};
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const environment = typeof window !== 'undefined' ? 'browser' : 'node';
const platformName = /android/i.test(ua) ? 'android' : /ip([ao]d|hone)/i.test(ua) ? 'ios' : /windows/i.test(ua) ? 'windows' : /mac os/i.test(ua) ? 'osx' : /linux/i.test(ua) ? 'linux' : /cros/i.test(ua) ? 'cros' : null;
const browserName = environment !== 'browser' ? null : /(Chrome\/|Chromium\/|Edg.*\/)/.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : /Firefox\//.test(ua) ? 'firefox' : 'other';
const xbox = /xbox/i.test(ua);
const touch = environment === 'browser' && ('ontouchstart' in window || 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 0);
const gamepads = environment === 'browser' && (!!navigator.getGamepads || !!navigator.webkitGetGamepads);
const workers = typeof Worker !== 'undefined';
const passiveEvents = detectPassiveEvents();
const platform = {
	environment: environment,
	global: environment === 'browser' ? window : global,
	browser: environment === 'browser',
	desktop: ['windows', 'osx', 'linux', 'cros'].includes(platformName),
	mobile: ['android', 'ios'].includes(platformName),
	ios: platformName === 'ios',
	android: platformName === 'android',
	xbox: xbox,
	gamepads: gamepads,
	touch: touch,
	workers: workers,
	passiveEvents: passiveEvents,
	browserName: browserName
};

export { platform };
