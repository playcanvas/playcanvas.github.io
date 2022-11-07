/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
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