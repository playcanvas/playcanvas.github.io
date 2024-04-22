import { script } from '../script.js';
import { AppBase } from '../app-base.js';
import { ScriptAttributes } from './script-attributes.js';
import { Script } from './script.js';
import { ScriptTypes } from './script-types.js';

const reservedScriptNames = new Set(['system', 'entity', 'create', 'destroy', 'swap', 'move', 'data', 'scripts', '_scripts', '_scriptsIndex', '_scriptsData', 'enabled', '_oldState', 'onEnable', 'onDisable', 'onPostStateChange', '_onSetEnabled', '_checkState', '_onBeforeRemove', '_onInitializeAttributes', '_onInitialize', '_onPostInitialize', '_onUpdate', '_onPostUpdate', '_callbacks', '_callbackActive', 'has', 'get', 'on', 'off', 'fire', 'once', 'hasEvent']);
function getReservedScriptNames() {
  return reservedScriptNames;
}
function createScript(name, app) {
  if (script.legacy) {
    return null;
  }
  if (reservedScriptNames.has(name)) throw new Error(`Script name '${name}' is reserved, please rename the script`);
  class ScriptWithAttributes extends Script {
    constructor(...args) {
      super(...args);
      this.attributes = new ScriptAttributes(ScriptWithAttributes);
    }
  }
  registerScript(ScriptWithAttributes, name, app);
  return ScriptWithAttributes;
}
const reservedAttributes = {};
ScriptAttributes.reservedNames.forEach((value, value2, set) => {
  reservedAttributes[value] = 1;
});
createScript.reservedAttributes = reservedAttributes;
function registerScript(script, name, app) {
  if (script.legacy) {
    return;
  }
  if (typeof script !== 'function') throw new Error(`script class: '${script}' must be a constructor function (i.e. class).`);
  if (!(script.prototype instanceof Script)) throw new Error(`script class: '${Script.__getScriptName(script)}' does not extend pc.Script.`);
  name = name || script.__name || Script.__getScriptName(script);
  if (reservedScriptNames.has(name)) throw new Error(`script name: '${name}' is reserved, please change script name`);
  script.__name = name;
  const registry = app ? app.scripts : AppBase.getApplication().scripts;
  registry.add(script);
  ScriptTypes.push(script, script.legacy);
}

export { createScript, getReservedScriptNames, registerScript };
