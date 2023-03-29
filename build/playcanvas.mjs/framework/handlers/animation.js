import { path } from '../../core/path.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { Http, http } from '../../platform/net/http.js';
import { Animation, Node, Key } from '../../scene/animation/animation.js';
import { AnimEvents } from '../anim/evaluator/anim-events.js';
import { GlbParser } from '../parsers/glb-parser.js';

class AnimationHandler {
	constructor(app) {
		this.handlerType = "animation";
		this.maxRetries = 0;
	}
	load(url, callback, asset) {
		if (typeof url === 'string') {
			url = {
				load: url,
				original: url
			};
		}
		const options = {
			retry: this.maxRetries > 0,
			maxRetries: this.maxRetries
		};
		if (url.load.startsWith('blob:') || url.load.startsWith('data:')) {
			if (path.getExtension(url.original).toLowerCase() === '.glb') {
				options.responseType = Http.ResponseType.ARRAY_BUFFER;
			} else {
				options.responseType = Http.ResponseType.JSON;
			}
		}
		http.get(url.load, options, (err, response) => {
			if (err) {
				callback(`Error loading animation resource: ${url.original} [${err}]`);
			} else {
				if (path.getExtension(url.original).toLowerCase() === '.glb') {
					GlbParser.parse('filename.glb', response, null, null, (err, parseResult) => {
						if (err) {
							callback(err);
						} else {
							var _asset$data;
							const animations = parseResult.animations;
							if (asset != null && (_asset$data = asset.data) != null && _asset$data.events) {
								for (let i = 0; i < animations.length; i++) {
									animations[i].events = new AnimEvents(Object.values(asset.data.events));
								}
							}
							parseResult.destroy();
							callback(null, animations);
						}
					});
				} else {
					callback(null, this['_parseAnimationV' + response.animation.version](response));
				}
			}
		});
	}
	open(url, data, asset) {
		return data;
	}
	patch(asset, assets) {}
	_parseAnimationV3(data) {
		const animData = data.animation;
		const anim = new Animation();
		anim.name = animData.name;
		anim.duration = animData.duration;
		for (let i = 0; i < animData.nodes.length; i++) {
			const node = new Node();
			const n = animData.nodes[i];
			node._name = n.name;
			for (let j = 0; j < n.keys.length; j++) {
				const k = n.keys[j];
				const t = k.time;
				const p = k.pos;
				const r = k.rot;
				const s = k.scale;
				const pos = new Vec3(p[0], p[1], p[2]);
				const rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
				const scl = new Vec3(s[0], s[1], s[2]);
				const key = new Key(t, pos, rot, scl);
				node._keys.push(key);
			}
			anim.addNode(node);
		}
		return anim;
	}
	_parseAnimationV4(data) {
		const animData = data.animation;
		const anim = new Animation();
		anim.name = animData.name;
		anim.duration = animData.duration;
		for (let i = 0; i < animData.nodes.length; i++) {
			const node = new Node();
			const n = animData.nodes[i];
			node._name = n.name;
			const defPos = n.defaults.p;
			const defRot = n.defaults.r;
			const defScl = n.defaults.s;
			for (let j = 0; j < n.keys.length; j++) {
				const k = n.keys[j];
				const t = k.t;
				const p = defPos ? defPos : k.p;
				const r = defRot ? defRot : k.r;
				const s = defScl ? defScl : k.s;
				const pos = new Vec3(p[0], p[1], p[2]);
				const rot = new Quat().setFromEulerAngles(r[0], r[1], r[2]);
				const scl = new Vec3(s[0], s[1], s[2]);
				const key = new Key(t, pos, rot, scl);
				node._keys.push(key);
			}
			anim.addNode(node);
		}
		return anim;
	}
}

export { AnimationHandler };
