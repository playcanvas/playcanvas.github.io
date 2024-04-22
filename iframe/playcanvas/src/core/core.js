const version = '0.0.0';
const revision = '5691de68f';
const config = {};
const common = {};
const apps = {};
const data = {};
const typeofs = ['undefined', 'number', 'string', 'boolean'];
const objectTypes = {
  '[object Array]': 'array',
  '[object Object]': 'object',
  '[object Function]': 'function',
  '[object Date]': 'date',
  '[object RegExp]': 'regexp',
  '[object Float32Array]': 'float32array'
};
function type(obj) {
  if (obj === null) {
    return 'null';
  }
  const typeString = typeof obj;
  if (typeofs.includes(typeString)) {
    return typeString;
  }
  return objectTypes[Object.prototype.toString.call(obj)];
}
function extend(target, ex) {
  for (const prop in ex) {
    const copy = ex[prop];
    if (type(copy) === 'object') {
      target[prop] = extend({}, copy);
    } else if (type(copy) === 'array') {
      target[prop] = extend([], copy);
    } else {
      target[prop] = copy;
    }
  }
  return target;
}

export { apps, common, config, data, extend, revision, type, version };
