/**
 * @license
 * PlayCanvas Engine v1.57.0 revision 18b016876 (PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
import '../core/tracing.js';
import { EventHandler } from '../core/event-handler.js';
import { ScriptHandler } from '../resources/script.js';
import { script } from '../framework/script.js';
import { AppBase } from '../framework/app-base.js';
import { ScriptAttributes } from './script-attributes.js';
import { ScriptType } from './script-type.js';

const reservedScriptNames = new Set(['system', 'entity', 'create', 'destroy', 'swap', 'move', 'scripts', '_scripts', '_scriptsIndex', '_scriptsData', 'enabled', '_oldState', 'onEnable', 'onDisable', 'onPostStateChange', '_onSetEnabled', '_checkState', '_onBeforeRemove', '_onInitializeAttributes', '_onInitialize', '_onPostInitialize', '_onUpdate', '_onPostUpdate', '_callbacks', 'has', 'get', 'on', 'off', 'fire', 'once', 'hasEvent']);

function createScript(name, app) {
  if (script.legacy) {
    return null;
  }

  if (reservedScriptNames.has(name)) throw new Error(`script name: '${name}' is reserved, please change script name`);

  const scriptType = function scriptType(args) {
    EventHandler.prototype.initEventHandler.call(this);
    ScriptType.prototype.initScriptType.call(this, args);
  };

  scriptType.prototype = Object.create(ScriptType.prototype);
  scriptType.prototype.constructor = scriptType;
  scriptType.extend = ScriptType.extend;
  scriptType.attributes = new ScriptAttributes(scriptType);
  registerScript(scriptType, name, app);
  return scriptType;
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
  if (!(script.prototype instanceof ScriptType)) throw new Error(`script class: '${ScriptType.__getScriptName(script)}' does not extend pc.ScriptType.`);
  name = name || script.__name || ScriptType.__getScriptName(script);
  if (reservedScriptNames.has(name)) throw new Error(`script name: '${name}' is reserved, please change script name`);
  script.__name = name;
  const registry = app ? app.scripts : AppBase.getApplication().scripts;
  registry.add(script);

  ScriptHandler._push(script);
}

export { createScript, registerScript };
