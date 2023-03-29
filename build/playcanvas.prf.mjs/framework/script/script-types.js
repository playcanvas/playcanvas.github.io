/**
 * @license
 * PlayCanvas Engine v1.62.0 revision 818511d2b (PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
class ScriptTypes {
	static push(Type, isLegacy) {
		if (isLegacy && ScriptTypes._types.length > 0) {
			console.assert('Script Ordering Error. Contact support@playcanvas.com');
		} else {
			ScriptTypes._types.push(Type);
		}
	}
}
ScriptTypes._types = [];

export { ScriptTypes };
