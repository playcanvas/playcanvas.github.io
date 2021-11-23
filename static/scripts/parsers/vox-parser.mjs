import{Component as t}from"../../src/framework/components/component.js";import{ComponentSystem as e}from"../../src/framework/components/system.js";const s=new Uint8Array(new Uint32Array([0,4294967295,4291624959,4288282623,4284940287,4281597951,4278255615,4294954239,4291611903,4288269567,4284927231,4281584895,4278242559,4294941183,4291598847,4288256511,4284914175,4281571839,4278229503,4294928127,4291585791,4288243455,4284901119,4281558783,4278216447,4294915071,4291572735,4288230399,4284888063,4281545727,4278203391,4294902015,4291559679,4288217343,4284875007,4281532671,4278190335,4294967244,4291624908,4288282572,4284940236,4281597900,4278255564,4294954188,4291611852,4288269516,4284927180,4281584844,4278242508,4294941132,4291598796,4288256460,4284914124,4281571788,4278229452,4294928076,4291585740,4288243404,4284901068,4281558732,4278216396,4294915020,4291572684,4288230348,4284888012,4281545676,4278203340,4294901964,4291559628,4288217292,4284874956,4281532620,4278190284,4294967193,4291624857,4288282521,4284940185,4281597849,4278255513,4294954137,4291611801,4288269465,4284927129,4281584793,4278242457,4294941081,4291598745,4288256409,4284914073,4281571737,4278229401,4294928025,4291585689,4288243353,4284901017,4281558681,4278216345,4294914969,4291572633,4288230297,4284887961,4281545625,4278203289,4294901913,4291559577,4288217241,4284874905,4281532569,4278190233,4294967142,4291624806,4288282470,4284940134,4281597798,4278255462,4294954086,4291611750,4288269414,4284927078,4281584742,4278242406,4294941030,4291598694,4288256358,4284914022,4281571686,4278229350,4294927974,4291585638,4288243302,4284900966,4281558630,4278216294,4294914918,4291572582,4288230246,4284887910,4281545574,4278203238,4294901862,4291559526,4288217190,4284874854,4281532518,4278190182,4294967091,4291624755,4288282419,4284940083,4281597747,4278255411,4294954035,4291611699,4288269363,4284927027,4281584691,4278242355,4294940979,4291598643,4288256307,4284913971,4281571635,4278229299,4294927923,4291585587,4288243251,4284900915,4281558579,4278216243,4294914867,4291572531,4288230195,4284887859,4281545523,4278203187,4294901811,4291559475,4288217139,4284874803,4281532467,4278190131,4294967040,4291624704,4288282368,4284940032,4281597696,4278255360,4294953984,4291611648,4288269312,4284926976,4281584640,4278242304,4294940928,4291598592,4288256256,4284913920,4281571584,4278229248,4294927872,4291585536,4288243200,4284900864,4281558528,4278216192,4294914816,4291572480,4288230144,4284887808,4281545472,4278203136,4294901760,4291559424,4288217088,4284874752,4281532416,4278190318,4278190301,4278190267,4278190250,4278190216,4278190199,4278190165,4278190148,4278190114,4278190097,4278251008,4278246656,4278237952,4278233600,4278224896,4278220544,4278211840,4278207488,4278198784,4278194432,4293787648,4292673536,4290445312,4289331200,4287102976,4285988864,4283760640,4282646528,4280418304,4279304192,4293848814,4292730333,4290493371,4289374890,4287137928,4286019447,4283782485,4282664004,4280427042,4279308561]).buffer);class n{constructor(t){this.data=t,this.tmp=[0,0,0,0]}clr(t){const e=this.tmp;return e[0]=this.data[4*t+0],e[1]=this.data[4*t+1],e[2]=this.data[4*t+2],e[3]=this.data[4*t+3],e}}class a{constructor(t){this._data=t,this._bound=null,this._flattened=null}get data(){return this._data}get numVoxels(){return this.data.length/4}get bound(){if(!this._bound){const t=this.data,e=[t[0],t[2],t[1]],s=[t[0],t[2],t[1]],n=this.numVoxels;for(let a=1;a<n;++a){const n=t[4*a+0],i=t[4*a+2],o=t[4*a+1];n<e[0]?e[0]=n:n>s[0]&&(s[0]=n),i<e[1]?e[1]=i:i>s[1]&&(s[1]=i),o<e[2]?e[2]=o:o>s[2]&&(s[2]=o)}this._bound={min:e,max:s,extent:[s[0]-e[0]+1,s[1]-e[1]+1,s[2]-e[2]+1]}}return this._bound}get flattened(){if(!this._flattened){const t=this.data,e=this.bound.min,s=(this.bound.max,this.bound.extent),n=new Uint8Array(s[0]*s[1]*s[2]),a=this.numVoxels;for(let i=0;i<a;++i){const a=t[4*i+0]-e[0]+(t[4*i+2]-e[1])*s[0]+(t[4*i+1]-e[2])*s[0]*s[1];n[a]=t[4*i+3]}this._flattened={extent:s,data:n,at:(t,e,a)=>{if(t<0||e<0||a<0||t>=s[0]||e>=s[1]||a>=s[2])return 0;const i=t+e*s[0]+a*s[0]*s[1];return n[i]}}}return this._flattened}}class i{constructor(){this.frames=[],this.palette=null}addFrame(t){this.frames.push(t)}setPalette(t){this.palette=t}}const o=(t,e)=>{t[0]+=e[0],t[1]+=e[1],t[2]+=e[2]};class r{constructor(t,e){this.device=t,this.voxModel=e}instantiateModelEntity(t){return null}instantiateRenderEntity(t){const e=new pc.StandardMaterial;e.diffuseVertexColor=!0;const s=this.voxModel.frames.map(((t,s)=>{const n=class{static mesh(t,e,s){const n=e.frames[s];if(!n)return null;const a=n.flattened,i=[],r=[],h=[],l=[],d=[0,0,0],c=[0,0,0],u=(t,s,n,a)=>{const u=i.length/3;var p,m;l.push(u,u+1,u+2,u,u+2,u+3),(p=c)[0]=(m=d)[0],p[1]=m[1],p[2]=m[2],i.push(c[0],c[1],c[2]),o(c,t),i.push(c[0],c[1],c[2]),o(c,s),i.push(c[0],c[1],c[2]),((t,e)=>{t[0]-=e[0],t[1]-=e[1],t[2]-=e[2]})(c,t),i.push(c[0],c[1],c[2]),r.push(n[0],n[1],n[2]),r.push(n[0],n[1],n[2]),r.push(n[0],n[1],n[2]),r.push(n[0],n[1],n[2]);const f=e.palette.clr(a-1);h.push(f[0],f[1],f[2],f[3]),h.push(f[0],f[1],f[2],f[3]),h.push(f[0],f[1],f[2],f[3]),h.push(f[0],f[1],f[2],f[3])},p=[1,0,0],m=[0,1,0],f=[0,0,1],y=[-1,0,0],x=[0,-1,0],v=[0,0,-1];for(let t=0;t<=a.extent[2];++t){d[2]=t;for(let e=0;e<=a.extent[1];++e){d[1]=e;for(let s=0;s<=a.extent[0];++s){d[0]=s;const n=a.at(s,e,t),i=a.at(s-1,e,t),o=a.at(s,e-1,t),r=a.at(s,e,t-1);0!==n?(0===i&&u(f,m,y,n),0===o&&u(p,f,x,n),0===r&&u(m,p,v,n)):(0!==i&&u(m,f,p,i),0!==o&&u(f,p,m,o),0!==r&&u(p,m,f,r))}}}const w=new pc.Mesh(t);return w.setPositions(i),w.setNormals(r),w.setColors32(h),w.setIndices(l),w.update(),w}}.mesh(this.device,this.voxModel,s);return new pc.MeshInstance(n,e)})),n=new pc.Entity;return n.addComponent("render",{material:e,meshInstances:s}),n.addComponent("voxanim",{}),this.renders=[],n}}const h=["enabled"];class l{constructor(){this.enabled=!0}}class d extends t{constructor(t,e){super(t,e),this.playing=!0,this.timer=0,this.fps=10}update(t){this.playing&&(this.timer+=t);const e=this.entity.render?.meshInstances||this.entity.model?.meshInstances;if(e){const t=Math.floor(this.timer*this.fps)%e.length;for(let s=0;s<e.length;++s)e[s].visible=s===t}}}class c extends e{constructor(t){super(t),this.id="voxanim",this.ComponentType=d,this.DataType=l,this.schema=h,this.app.systems.on("update",this.onUpdate,this)}initializeComponentData(t,e,s){s=["playing","timer","fps"];for(let n=0;n<s.length;n++)e.hasOwnProperty(s[n])&&(t[s[n]]=e[s[n]]);super.initializeComponentData(t,e,h)}cloneComponent(t,e){const s=t.voxanim,n={playing:s.playing,timer:s.timer,fps:s.fps};return this.addComponent(e,n)}onUpdate(t){const e=this.store;for(const s in e)if(e.hasOwnProperty(s)){const n=e[s].entity;if(n.enabled){const e=n.voxanim;e.enabled&&e.update(t)}}}destroy(){super.destroy(),this.app.systems.off("update",this.onUpdate,this)}}t._buildAccessors(d.prototype,h);class u{constructor(t,e,s){this._device=t,this._assets=e,this._maxRetries=s}load(t,e,o){pc.Asset.fetchArrayBuffer(t.load,((t,o)=>{t?e(t):e(null,new r(this._device,class{static load(t){const e=new pc.ReadStream(t),o=()=>({id:e.readChars(4),numBytes:e.readU32(),numChildBytes:e.readU32()});if("VOX "!==e.readChars(4))return console.log("invalid vox header"),null;if(150!==e.readU32())return console.log("invalid vox version"),null;const r=o();if("MAIN"!==r.id)return console.log("invalid first chunk in vox"),null;const h=new i;for(;e.offset<r.numChildBytes;){const s=o();switch(s.id){case"XYZI":{const s=e.readU32();h.addFrame(new a(new Uint8Array(t,e.offset,4*s))),e.skip(4*s);break}case"RGBA":h.setPalette(new n(new Uint8Array(t,e.offset,1024))),e.skip(1536);break;default:e.skip(s.numBytes+s.numChildBytes)}}return h.palette||h.setPalette(s),h}}.load(o)))}),o,this._maxRetries)}open(t,e,s){return e}}const p=t=>{t.systems.add(new c(t)),t.loader.getHandler("container").parsers.vox=new u(t.graphicsDevice,t.assets)};export{p as registerVoxParser};