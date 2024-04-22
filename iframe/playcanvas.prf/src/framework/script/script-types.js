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
