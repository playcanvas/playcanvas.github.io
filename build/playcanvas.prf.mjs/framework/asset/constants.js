const ABSOLUTE_URL = new RegExp('^' + '\\s*' + '(?:' + '(?:' + '[a-z]+[a-z0-9\\-\\+\\.]*' + ':' + ')?' + '//' + '|' + 'data:' + '|blob:' + ')', 'i');
const ASSET_ANIMATION = 'animation';
const ASSET_AUDIO = 'audio';
const ASSET_IMAGE = 'image';
const ASSET_JSON = 'json';
const ASSET_MODEL = 'model';
const ASSET_MATERIAL = 'material';
const ASSET_TEXT = 'text';
const ASSET_TEXTURE = 'texture';
const ASSET_TEXTUREATLAS = 'textureatlas';
const ASSET_CUBEMAP = 'cubemap';
const ASSET_SHADER = 'shader';
const ASSET_CSS = 'css';
const ASSET_HTML = 'html';
const ASSET_SCRIPT = 'script';
const ASSET_CONTAINER = 'container';

export { ABSOLUTE_URL, ASSET_ANIMATION, ASSET_AUDIO, ASSET_CONTAINER, ASSET_CSS, ASSET_CUBEMAP, ASSET_HTML, ASSET_IMAGE, ASSET_JSON, ASSET_MATERIAL, ASSET_MODEL, ASSET_SCRIPT, ASSET_SHADER, ASSET_TEXT, ASSET_TEXTURE, ASSET_TEXTUREATLAS };
