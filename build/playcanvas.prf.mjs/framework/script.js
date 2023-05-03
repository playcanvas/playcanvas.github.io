import { events } from '../core/events.js';
import { getApplication } from './globals.js';
import { ScriptTypes } from './script/script-types.js';

let _legacy = false;
let _createdLoadingScreen = false;
const script = {
	app: null,
	create: function (name, callback) {
		if (!_legacy) return;
		const ScriptType = callback(script.app);
		ScriptType._pcScriptName = name;
		ScriptTypes.push(ScriptType, _legacy);
		this.fire("created", name, callback);
	},
	attribute: function (name, type, defaultValue, options) {},
	createLoadingScreen: function (callback) {
		if (_createdLoadingScreen) return;
		_createdLoadingScreen = true;
		const app = getApplication();
		callback(app);
	}
};
Object.defineProperty(script, 'legacy', {
	get: function () {
		return _legacy;
	},
	set: function (value) {
		_legacy = value;
	}
});
events.attach(script);

export { script };
