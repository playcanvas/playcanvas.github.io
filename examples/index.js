(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react'), require('../../..'), require('@playcanvas/pcui/react')) :
    typeof define === 'function' && define.amd ? define(['exports', 'react', '../../..', '@playcanvas/pcui/react'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.examples = {}, global.React, global.pc, global.pcui));
})(this, (function (exports, React, pc, react) { 'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    var React__default = /*#__PURE__*/_interopDefaultLegacy(React);
    var pc__namespace = /*#__PURE__*/_interopNamespace(pc);

    var BlendTrees1DExample = /** @class */ (function () {
        function BlendTrees1DExample() {
        }
        BlendTrees1DExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.LabelGroup, { text: 'blend' },
                    React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'blend' } })));
        };
        BlendTrees1DExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                'model': new pc__namespace.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                'idleAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/idle.glb' }),
                'danceAnim': new pc__namespace.Asset('danceAnim', 'container', { url: '/static/assets/animations/bitmoji/win-dance.glb' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'bloom': new pc__namespace.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.AnimComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.AnimClipHandler,
                    // @ts-ignore
                    pc__namespace.AnimStateGraphHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.exposure = 2;
                    app.scene.skyboxMip = 2;
                    app.scene.envAtlas = assets.helipad.resource;
                    // Create an Entity with a camera component
                    var cameraEntity = new pc__namespace.Entity();
                    cameraEntity.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                    });
                    cameraEntity.translate(0, 0.75, 3);
                    // add bloom postprocessing (this is ignored by the picker)
                    cameraEntity.addComponent("script");
                    cameraEntity.script.create("bloom", {
                        attributes: {
                            bloomIntensity: 1,
                            bloomThreshold: 0.7,
                            blurAmount: 4
                        }
                    });
                    app.root.addChild(cameraEntity);
                    // Create an entity with a light component
                    var lightEntity = new pc__namespace.Entity();
                    lightEntity.addComponent("light", {
                        castShadows: true,
                        intensity: 1.5,
                        normalOffsetBias: 0.02,
                        shadowType: pc__namespace.SHADOW_PCF5,
                        shadowDistance: 6,
                        shadowResolution: 2048,
                        shadowBias: 0.02
                    });
                    app.root.addChild(lightEntity);
                    lightEntity.setLocalEulerAngles(45, 30, 0);
                    // create an entity from the loaded model using the render component
                    var modelEntity = assets.model.resource.instantiateRenderEntity({
                        castShadows: true
                    });
                    // add an anim component to the entity
                    modelEntity.addComponent('anim', {
                        activate: true
                    });
                    // create an anim state graph
                    var animStateGraphData = {
                        "layers": [
                            {
                                "name": "characterState",
                                "states": [
                                    {
                                        "name": "START"
                                    },
                                    {
                                        "name": "Movement",
                                        "speed": 1.0,
                                        "loop": true,
                                        "blendTree": {
                                            "type": "1D",
                                            "parameter": "blend",
                                            "children": [
                                                {
                                                    "name": "Idle",
                                                    "point": 0.0
                                                },
                                                {
                                                    "name": "Dance",
                                                    "point": 1.0,
                                                    "speed": 0.85
                                                }
                                            ]
                                        }
                                    }
                                ],
                                "transitions": [
                                    {
                                        "from": "START",
                                        "to": "Movement"
                                    }
                                ]
                            }
                        ],
                        "parameters": {
                            "blend": {
                                "name": "blend",
                                "type": "FLOAT",
                                "value": 0
                            }
                        }
                    };
                    // load the state graph into the anim component
                    modelEntity.anim.loadStateGraph(animStateGraphData);
                    // load the state graph asset resource into the anim component
                    var characterStateLayer = modelEntity.anim.baseLayer;
                    characterStateLayer.assignAnimation('Movement.Idle', assets.idleAnim.resource.animations[0].resource);
                    characterStateLayer.assignAnimation('Movement.Dance', assets.danceAnim.resource.animations[0].resource);
                    app.root.addChild(modelEntity);
                    data.on('blend:set', function (blend) {
                        modelEntity.anim.setFloat('blend', blend);
                    });
                });
            });
        };
        BlendTrees1DExample.CATEGORY = 'Animation';
        BlendTrees1DExample.NAME = 'Blend Trees 1D';
        BlendTrees1DExample.WEBGPU_ENABLED = true;
        return BlendTrees1DExample;
    }());

    var BlendTrees2DCartesianExample = /** @class */ (function () {
        function BlendTrees2DCartesianExample() {
        }
        BlendTrees2DCartesianExample.prototype.controls = function () {
            React.useEffect(function () {
                var _a;
                // @ts-ignore engine-tsd
                var pc = (_a = window.top) === null || _a === void 0 ? void 0 : _a.pc;
                if (!pc)
                    return;
                pc.app.on('start', function () {
                    var canvas = window.top.document.getElementById('2d-blend-control');
                    // @ts-ignore engine-tsd
                    var modelEntity = pc.app.root.findByName('model');
                    var width = window.top.controlPanel.offsetWidth;
                    var height = width;
                    var halfWidth = Math.floor(width / 2);
                    var halfHeight = Math.floor(height / 2);
                    canvas.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');
                    canvas.setAttribute('width', width);
                    canvas.setAttribute('height', height);
                    var ctx = canvas.getContext('2d');
                    var position = new pc.Vec2(0);
                    var drawPosition = function (ctx) {
                        ctx.clearRect(0, 0, width, height);
                        ctx.fillStyle = "rgba(128, 128, 128, 0.5)";
                        ctx.fillRect(0, 0, width, height);
                        ctx.fillStyle = '#B1B8BA';
                        ctx.fillRect(halfWidth, 0, 1, height);
                        ctx.fillRect(0, halfHeight, width, 1);
                        ctx.fillStyle = '#232e30';
                        // @ts-ignore engine-tsd
                        modelEntity.anim.baseLayer._controller._states.Emote.animations.forEach(function (animNode) {
                            if (animNode.point) {
                                var posX = (animNode.point.x + 1) * halfWidth;
                                var posY = (animNode.point.y * -1 + 1) * halfHeight;
                                var width_1 = 8;
                                var height_1 = 8;
                                ctx.fillStyle = "#ffffff80";
                                ctx.beginPath();
                                ctx.arc(posX, posY, halfWidth * 0.5 * animNode.weight, 0, 2 * Math.PI);
                                ctx.fill();
                                ctx.fillStyle = '#283538';
                                ctx.beginPath();
                                ctx.moveTo(posX, posY - height_1 / 2);
                                ctx.lineTo(posX - width_1 / 2, posY);
                                ctx.lineTo(posX, posY + height_1 / 2);
                                ctx.lineTo(posX + width_1 / 2, posY);
                                ctx.closePath();
                                ctx.fill();
                            }
                        });
                        ctx.fillStyle = '#F60';
                        ctx.beginPath();
                        ctx.arc((modelEntity.anim.getFloat('posX') + 1) * halfWidth, (modelEntity.anim.getFloat('posY') * -1 + 1) * halfHeight, 5, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.fillStyle = '#283538';
                        ctx.stroke();
                    };
                    drawPosition(ctx);
                    var mouseEvent = function (e) {
                        if (e.targetTouches) {
                            var offset = canvas.getBoundingClientRect();
                            position = new pc.Vec2(e.targetTouches[0].clientX - offset.x, e.targetTouches[0].clientY - offset.y).mulScalar(1 / (width / 2)).sub(pc.Vec2.ONE);
                        }
                        else {
                            if (e.buttons) {
                                position = new pc.Vec2(e.offsetX, e.offsetY).mulScalar(1 / (width / 2)).sub(pc.Vec2.ONE);
                            }
                            else {
                                return;
                            }
                        }
                        position.y *= -1.0;
                        modelEntity.anim.setFloat('posX', position.x);
                        modelEntity.anim.setFloat('posY', position.y);
                        drawPosition(ctx);
                    };
                    canvas.addEventListener('mousemove', mouseEvent);
                    canvas.addEventListener('mousedown', mouseEvent);
                    canvas.addEventListener('touchmove', mouseEvent);
                    canvas.addEventListener('touchstart', mouseEvent);
                });
            });
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement("canvas", { id: '2d-blend-control' }));
        };
        BlendTrees2DCartesianExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'model': new pc__namespace.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                'idleAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/idle.glb' }),
                'walkAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/walk.glb' }),
                'eagerAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/idle-eager.glb' }),
                'danceAnim': new pc__namespace.Asset('danceAnim', 'container', { url: '/static/assets/animations/bitmoji/win-dance.glb' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'bloom': new pc__namespace.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.AnimComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.AnimClipHandler,
                    // @ts-ignore
                    pc__namespace.AnimStateGraphHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    // setup skydome
                    app.scene.exposure = 2;
                    app.scene.skyboxMip = 2;
                    app.scene.envAtlas = assets.helipad.resource;
                    // Create an Entity with a camera component
                    var cameraEntity = new pc__namespace.Entity();
                    cameraEntity.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                    });
                    cameraEntity.translate(0, 0.75, 3);
                    // add bloom postprocessing (this is ignored by the picker)
                    cameraEntity.addComponent("script");
                    cameraEntity.script.create("bloom", {
                        attributes: {
                            bloomIntensity: 1,
                            bloomThreshold: 0.7,
                            blurAmount: 4
                        }
                    });
                    app.root.addChild(cameraEntity);
                    // Create an entity with a light component
                    var lightEntity = new pc__namespace.Entity();
                    lightEntity.addComponent("light", {
                        castShadows: true,
                        intensity: 1.5,
                        normalOffsetBias: 0.02,
                        shadowType: pc__namespace.SHADOW_PCF5,
                        shadowDistance: 6,
                        shadowResolution: 2048,
                        shadowBias: 0.02
                    });
                    app.root.addChild(lightEntity);
                    lightEntity.setLocalEulerAngles(45, 30, 0);
                    // create an entity from the loaded model using the render component
                    var modelEntity = assets.model.resource.instantiateRenderEntity({
                        castShadows: true
                    });
                    modelEntity.name = 'model';
                    // add an anim component to the entity
                    modelEntity.addComponent('anim', {
                        activate: true
                    });
                    // create an anim state graph
                    var animStateGraphData = {
                        "layers": [
                            {
                                "name": "base",
                                "states": [
                                    {
                                        "name": "START"
                                    },
                                    {
                                        "name": "Emote",
                                        "speed": 1.0,
                                        "loop": true,
                                        "blendTree": {
                                            "type": pc__namespace.ANIM_BLEND_2D_CARTESIAN,
                                            "parameters": ["posX", "posY"],
                                            "children": [
                                                {
                                                    "name": "Idle",
                                                    "point": [-0.5, 0.5]
                                                },
                                                {
                                                    "name": "Eager",
                                                    "point": [0.5, 0.5]
                                                },
                                                {
                                                    "name": "Walk",
                                                    "point": [0.5, -0.5]
                                                },
                                                {
                                                    "name": "Dance",
                                                    "point": [-0.5, -0.5]
                                                }
                                            ]
                                        }
                                    }
                                ],
                                "transitions": [
                                    {
                                        "from": "START",
                                        "to": "Emote"
                                    }
                                ]
                            }
                        ],
                        "parameters": {
                            "posX": {
                                "name": "posX",
                                "type": "FLOAT",
                                "value": -0.5
                            },
                            "posY": {
                                "name": "posY",
                                "type": "FLOAT",
                                "value": 0.5
                            }
                        }
                    };
                    // load the state graph into the anim component
                    modelEntity.anim.loadStateGraph(animStateGraphData);
                    // load the state graph asset resource into the anim component
                    var characterStateLayer = modelEntity.anim.baseLayer;
                    characterStateLayer.assignAnimation('Emote.Idle', assets.idleAnim.resource.animations[0].resource);
                    characterStateLayer.assignAnimation('Emote.Eager', assets.eagerAnim.resource.animations[0].resource);
                    characterStateLayer.assignAnimation('Emote.Dance', assets.danceAnim.resource.animations[0].resource);
                    characterStateLayer.assignAnimation('Emote.Walk', assets.walkAnim.resource.animations[0].resource);
                    app.root.addChild(modelEntity);
                    app.start();
                });
            });
        };
        BlendTrees2DCartesianExample.CATEGORY = 'Animation';
        BlendTrees2DCartesianExample.NAME = 'Blend Trees 2D Cartesian';
        BlendTrees2DCartesianExample.WEBGPU_ENABLED = true;
        return BlendTrees2DCartesianExample;
    }());

    var BlendTrees2DDirectionalExample = /** @class */ (function () {
        function BlendTrees2DDirectionalExample() {
        }
        BlendTrees2DDirectionalExample.prototype.controls = function () {
            React.useEffect(function () {
                var _a;
                // @ts-ignore engine-tsd
                var pc = (_a = window.top) === null || _a === void 0 ? void 0 : _a.pc;
                if (!pc)
                    return;
                pc.app.on('start', function () {
                    var canvas = window.top.document.getElementById('2d-blend-control');
                    // @ts-ignore engine-tsd
                    var modelEntity = pc.app.root.findByName('model');
                    var width = window.top.controlPanel.offsetWidth;
                    var height = width;
                    var halfWidth = Math.floor(width / 2);
                    var halfHeight = Math.floor(height / 2);
                    canvas.setAttribute('style', 'width: ' + width + 'px; height: ' + height + 'px;');
                    canvas.setAttribute('width', width);
                    canvas.setAttribute('height', height);
                    var ctx = canvas.getContext('2d');
                    var position = new pc.Vec2(0);
                    var drawPosition = function (ctx) {
                        ctx.clearRect(0, 0, width, height);
                        ctx.fillStyle = "rgba(128, 128, 128, 0.5)";
                        ctx.fillRect(0, 0, width, height);
                        ctx.fillStyle = '#B1B8BA';
                        ctx.fillRect(halfWidth, 0, 1, height);
                        ctx.fillRect(0, halfHeight, width, 1);
                        ctx.fillStyle = '#232e30';
                        // @ts-ignore engine-tsd
                        modelEntity.anim.baseLayer._controller._states.Travel.animations.forEach(function (animNode) {
                            if (animNode.point) {
                                var posX = (animNode.point.x + 1) * halfWidth;
                                var posY = (animNode.point.y * -1 + 1) * halfHeight;
                                var width_1 = 8;
                                var height_1 = 8;
                                ctx.fillStyle = "#ffffff80";
                                ctx.beginPath();
                                ctx.arc(posX, posY, halfWidth * 0.5 * animNode.weight, 0, 2 * Math.PI);
                                ctx.fill();
                                ctx.fillStyle = '#283538';
                                ctx.beginPath();
                                ctx.moveTo(posX, posY - height_1 / 2);
                                ctx.lineTo(posX - width_1 / 2, posY);
                                ctx.lineTo(posX, posY + height_1 / 2);
                                ctx.lineTo(posX + width_1 / 2, posY);
                                ctx.closePath();
                                ctx.fill();
                            }
                        });
                        ctx.fillStyle = '#F60';
                        ctx.beginPath();
                        ctx.arc((modelEntity.anim.getFloat('posX') + 1) * halfWidth, (modelEntity.anim.getFloat('posY') * -1 + 1) * halfHeight, 5, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.fillStyle = '#283538';
                        ctx.stroke();
                    };
                    drawPosition(ctx);
                    var mouseEvent = function (e) {
                        if (e.buttons) {
                            position = new pc.Vec2(e.offsetX, e.offsetY).mulScalar(1 / (width / 2)).sub(pc.Vec2.ONE);
                            position.y *= -1.0;
                            modelEntity.anim.setFloat('posX', position.x);
                            modelEntity.anim.setFloat('posY', position.y);
                            drawPosition(ctx);
                        }
                    };
                    canvas.addEventListener('mousemove', mouseEvent);
                    canvas.addEventListener('mousedown', mouseEvent);
                });
            });
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement("canvas", { id: '2d-blend-control' }));
        };
        BlendTrees2DDirectionalExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'model': new pc__namespace.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                'idleAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/idle.glb' }),
                'walkAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/walk.glb' }),
                'jogAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/run.glb' }),
                'danceAnim': new pc__namespace.Asset('danceAnim', 'container', { url: '/static/assets/animations/bitmoji/win-dance.glb' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'bloom': new pc__namespace.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.AnimComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.AnimClipHandler,
                    // @ts-ignore
                    pc__namespace.AnimStateGraphHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    // setup skydome
                    app.scene.exposure = 2;
                    app.scene.skyboxMip = 2;
                    app.scene.envAtlas = assets.helipad.resource;
                    // Create an Entity with a camera component
                    var cameraEntity = new pc__namespace.Entity();
                    cameraEntity.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                    });
                    cameraEntity.translate(0, 0.75, 3);
                    // add bloom postprocessing (this is ignored by the picker)
                    cameraEntity.addComponent("script");
                    cameraEntity.script.create("bloom", {
                        attributes: {
                            bloomIntensity: 1,
                            bloomThreshold: 0.7,
                            blurAmount: 4
                        }
                    });
                    app.root.addChild(cameraEntity);
                    // Create an entity with a light component
                    var lightEntity = new pc__namespace.Entity();
                    lightEntity.addComponent("light", {
                        castShadows: true,
                        intensity: 1.5,
                        normalOffsetBias: 0.02,
                        shadowType: pc__namespace.SHADOW_PCF5,
                        shadowDistance: 6,
                        shadowResolution: 2048,
                        shadowBias: 0.02
                    });
                    app.root.addChild(lightEntity);
                    lightEntity.setLocalEulerAngles(45, 30, 0);
                    // create an entity from the loaded model using the render component
                    var modelEntity = assets.model.resource.instantiateRenderEntity({
                        castShadows: true
                    });
                    modelEntity.name = 'model';
                    // add an anim component to the entity
                    modelEntity.addComponent('anim', {
                        activate: true
                    });
                    // create an anim state graph
                    var animStateGraphData = {
                        "layers": [
                            {
                                "name": "locomotion",
                                "states": [
                                    {
                                        "name": "START"
                                    },
                                    {
                                        "name": "Travel",
                                        "speed": 1.0,
                                        "loop": true,
                                        "blendTree": {
                                            "type": pc__namespace.ANIM_BLEND_2D_DIRECTIONAL,
                                            "syncDurations": true,
                                            "parameters": ["posX", "posY"],
                                            "children": [
                                                {
                                                    "name": "Idle",
                                                    "point": [0.0, 0.0]
                                                },
                                                {
                                                    "speed": -1,
                                                    "name": "WalkBackwards",
                                                    "point": [0.0, -0.5]
                                                },
                                                {
                                                    "speed": 1,
                                                    "name": "Walk",
                                                    "point": [0.0, 0.5]
                                                },
                                                {
                                                    "speed": 1,
                                                    "name": "Jog",
                                                    "point": [0.0, 1.0]
                                                }
                                            ]
                                        }
                                    }
                                ],
                                "transitions": [
                                    {
                                        "from": "START",
                                        "to": "Travel"
                                    }
                                ]
                            }
                        ],
                        "parameters": {
                            "posX": {
                                "name": "posX",
                                "type": "FLOAT",
                                "value": 0
                            },
                            "posY": {
                                "name": "posY",
                                "type": "FLOAT",
                                "value": 0
                            }
                        }
                    };
                    // load the state graph into the anim component
                    modelEntity.anim.loadStateGraph(animStateGraphData);
                    // load the state graph asset resource into the anim component
                    var locomotionLayer = modelEntity.anim.baseLayer;
                    locomotionLayer.assignAnimation('Travel.Idle', assets.idleAnim.resource.animations[0].resource);
                    locomotionLayer.assignAnimation('Travel.Walk', assets.walkAnim.resource.animations[0].resource);
                    locomotionLayer.assignAnimation('Travel.WalkBackwards', assets.walkAnim.resource.animations[0].resource);
                    locomotionLayer.assignAnimation('Travel.Jog', assets.jogAnim.resource.animations[0].resource);
                    app.root.addChild(modelEntity);
                    app.start();
                });
            });
        };
        BlendTrees2DDirectionalExample.CATEGORY = 'Animation';
        BlendTrees2DDirectionalExample.NAME = 'Blend Trees 2D Directional';
        BlendTrees2DDirectionalExample.WEBGPU_ENABLED = true;
        return BlendTrees2DDirectionalExample;
    }());

    var ComponentPropertiesExample = /** @class */ (function () {
        function ComponentPropertiesExample() {
        }
        ComponentPropertiesExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Button, { text: 'Flash', onClick: function () {
                        data.set('flash', !data.get('flash'));
                    } }));
        };
        ComponentPropertiesExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                'playcanvasGreyTexture': new pc__namespace.Asset('playcanvasGreyTexture', 'texture', { url: '/static/assets/textures/playcanvas-grey.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.AnimComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.AnimClipHandler,
                    // @ts-ignore
                    pc__namespace.AnimStateGraphHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    // create the animation data for two static spot lights
                    var animClipStaticLightData = {
                        "name": "staticLight",
                        "duration": 1.0,
                        // curve keyframe inputs
                        "inputs": [
                            [
                                0.0
                            ]
                        ],
                        // curve keyframe outputs
                        "outputs": [
                            // a single RGBA color keyframe value of a green light
                            {
                                "components": 4,
                                "data": [
                                    0.0, 1.0, 0.0, 1.0
                                ]
                            },
                            // a single quaternion keyframe value with no rotation
                            {
                                "components": 4,
                                "data": [
                                    0.0, 0.0, 0.0, 0.0
                                ]
                            }
                        ],
                        // the curves contained in the clip, each with the path to the property they animation, the index of
                        // their input and output keyframes and the method of interpolation to be used
                        "curves": [
                            {
                                "path": { entityPath: ["lights", "spotLight1"], component: "light", propertyPath: ["color"] },
                                "inputIndex": 0,
                                "outputIndex": 0,
                                "interpolation": 1
                            },
                            {
                                "path": { entityPath: ["lights", "spotLight2"], component: "light", propertyPath: ["color"] },
                                "inputIndex": 0,
                                "outputIndex": 0,
                                "interpolation": 1
                            },
                            {
                                "path": { entityPath: ["lights", "spotLight1"], component: "entity", propertyPath: ["localEulerAngles"] },
                                "inputIndex": 0,
                                "outputIndex": 1,
                                "interpolation": 1
                            },
                            {
                                "path": { entityPath: ["lights", "spotLight2"], component: "entity", propertyPath: ["localEulerAngles"] },
                                "inputIndex": 0,
                                "outputIndex": 1,
                                "interpolation": 1
                            }
                        ]
                    };
                    // create the animation data for two flashing spot lights
                    var animClipFlashingLightData = {
                        "name": "flashingLight",
                        "duration": 2.0,
                        // curve keyframe inputs
                        "inputs": [
                            [
                                0.0, 0.5, 1.0, 1.5, 2.0
                            ],
                            [
                                0, 1, 2
                            ]
                        ],
                        // curve keyframe outputs
                        "outputs": [
                            //  keyframe outputs for a flashing red RGBA color
                            {
                                "components": 4,
                                "data": [
                                    1.0, 0.0, 0.0, 1.0,
                                    0.4, 0.0, 0.0, 1.0,
                                    1.0, 0.0, 0.0, 1.0,
                                    0.4, 0.0, 0.0, 1.0,
                                    1.0, 0.0, 0.0, 1.0
                                ]
                            },
                            //  keyframe outputs for a quaternion rotation
                            {
                                "components": 4,
                                "data": [
                                    4.0, 0.0, 0.0, 0.0,
                                    4.0, 180.0, 0.0, 0.0,
                                    4.0, 0.0, 0.0, 0.0
                                ]
                            },
                            //  keyframe outputs for a quaternion rotation
                            {
                                "components": 4,
                                "data": [
                                    -4.0, 0.0, 0.0, 0.0,
                                    -4.0, 180.0, 0.0, 0.0,
                                    -4.0, 0.0, 0.0, 0.0
                                ]
                            }
                        ],
                        // the curves contained in the clip, each with the path to the property they animation, the index of
                        // their input and output keyframes and the method of interpolation to be used
                        "curves": [
                            {
                                "path": { entityPath: ["lights", "spotLight1"], component: "light", propertyPath: ["color"] },
                                "inputIndex": 0,
                                "outputIndex": 0,
                                "interpolation": 1
                            },
                            {
                                "path": { entityPath: ["lights", "spotLight2"], component: "light", propertyPath: ["color"] },
                                "inputIndex": 0,
                                "outputIndex": 0,
                                "interpolation": 1
                            },
                            {
                                "path": { entityPath: ["lights", "spotLight1"], component: "entity", propertyPath: ["localEulerAngles"] },
                                "inputIndex": 1,
                                "outputIndex": 1,
                                "interpolation": 1
                            },
                            {
                                "path": { entityPath: ["lights", "spotLight2"], component: "entity", propertyPath: ["localEulerAngles"] },
                                "inputIndex": 1,
                                "outputIndex": 2,
                                "interpolation": 1
                            }
                        ]
                    };
                    var animClipHandler = new pc__namespace.AnimClipHandler(app);
                    var animClipStaticLight = animClipHandler.open(undefined, animClipStaticLightData);
                    var animClipFlashingLight = animClipHandler.open(undefined, animClipFlashingLightData);
                    // Create an Entity with a camera component
                    var cameraEntity = new pc__namespace.Entity();
                    cameraEntity.name = 'camera';
                    cameraEntity.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0, 0, 0.0)
                    });
                    cameraEntity.translateLocal(7, 10, 7);
                    cameraEntity.lookAt(0, 0, 0);
                    var boxEntity = new pc__namespace.Entity();
                    boxEntity.addComponent("render", {
                        type: 'box'
                    });
                    boxEntity.name = 'model';
                    boxEntity.setPosition(0, 0.25, 0);
                    boxEntity.setLocalScale(0.5, 0.5, 0.5);
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuseMap = assets.playcanvasGreyTexture.resource;
                    material.update();
                    boxEntity.render.meshInstances[0].material = material;
                    var planeEntity = new pc__namespace.Entity();
                    planeEntity.name = 'plane';
                    planeEntity.addComponent("render", {
                        type: "plane"
                    });
                    planeEntity.setLocalScale(15, 1, 15);
                    planeEntity.setPosition(0, 0, 0);
                    // Create the animatible lights
                    var lightsEntity = new pc__namespace.Entity();
                    lightsEntity.name = 'lights';
                    var light1 = new pc__namespace.Entity();
                    light1.name = 'spotLight1';
                    light1.addComponent("light", {
                        type: "spot",
                        color: new pc__namespace.Color(0.0, 0.0, 0.0, 1.0),
                        intensity: 1,
                        range: 15,
                        innerConeAngle: 5,
                        outerConeAngle: 10
                    });
                    light1.setPosition(0, 10, 0);
                    var light2 = new pc__namespace.Entity();
                    light2.name = 'spotLight2';
                    light2.addComponent("light", {
                        type: "spot",
                        color: new pc__namespace.Color(0.0, 0.0, 0.0, 1.0),
                        intensity: 1,
                        range: 15,
                        innerConeAngle: 5,
                        outerConeAngle: 10
                    });
                    light2.setPosition(0, 10, 0);
                    // Add Entities into the scene hierarchy
                    app.root.addChild(cameraEntity);
                    lightsEntity.addChild(light1);
                    lightsEntity.addChild(light2);
                    app.root.addChild(lightsEntity);
                    app.root.addChild(boxEntity);
                    app.root.addChild(planeEntity);
                    // add the anim component to the lights entity
                    lightsEntity.addComponent("anim", {
                        speed: 1.0,
                        activate: true
                    });
                    // assign animation clip asset resources to the appropriate states
                    lightsEntity.anim.assignAnimation('Static', animClipStaticLight);
                    lightsEntity.anim.assignAnimation('Flash', animClipFlashingLight);
                    app.start();
                    data.on('flash:set', function () {
                        if (lightsEntity.anim.baseLayer.activeState === 'Static') {
                            lightsEntity.anim.baseLayer.transition('Flash', 0.5);
                        }
                        else {
                            lightsEntity.anim.baseLayer.transition('Static', 0.5);
                        }
                    });
                });
            });
        };
        ComponentPropertiesExample.CATEGORY = 'Animation';
        ComponentPropertiesExample.NAME = 'Component Properties';
        ComponentPropertiesExample.WEBGPU_ENABLED = true;
        return ComponentPropertiesExample;
    }());

    var EventsExample = /** @class */ (function () {
        function EventsExample() {
        }
        EventsExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'model': new pc__namespace.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                'walkAnim': new pc__namespace.Asset('walkAnim', 'container', { url: '/static/assets/animations/bitmoji/walk.glb' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'bloom': new pc__namespace.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.AnimComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.AnimClipHandler,
                    // @ts-ignore
                    pc__namespace.AnimStateGraphHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.exposure = 2;
                    app.scene.skyboxMip = 2;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxIntensity = 0.4; // make it darker
                    // Create an Entity with a camera component
                    var cameraEntity = new pc__namespace.Entity();
                    cameraEntity.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                    });
                    cameraEntity.translate(0, 1, 0);
                    // add bloom postprocessing (this is ignored by the picker)
                    cameraEntity.addComponent("script");
                    cameraEntity.script.create("bloom", {
                        attributes: {
                            bloomIntensity: 1,
                            bloomThreshold: 0.7,
                            blurAmount: 4
                        }
                    });
                    app.root.addChild(cameraEntity);
                    var boxes = {};
                    var highlightedBoxes = [];
                    // create a floor made up of box models
                    for (var i = -5; i <= 5; i++) {
                        for (var j = -5; j <= 5; j++) {
                            var material = new pc__namespace.StandardMaterial();
                            material.diffuse = new pc__namespace.Color(0.7, 0.7, 0.7);
                            material.gloss = 0.3;
                            material.metalness = 0.2;
                            material.useMetalness = true;
                            material.update();
                            var box = new pc__namespace.Entity();
                            boxes["".concat(i).concat(j)] = box;
                            box.addComponent('render', {
                                type: 'box',
                                material: material
                            });
                            box.setPosition(i, -0.5, j);
                            box.setLocalScale(0.95, 1, 0.95);
                            app.root.addChild(box);
                        }
                    }
                    // light up a box at the given position with a random color using the emissive material property
                    var highlightBox = function (pos) {
                        var i = Math.floor(pos.x + 0.5);
                        var j = Math.floor(pos.z + 0.5);
                        var colorVec = new pc__namespace.Vec3(Math.random(), Math.random(), Math.random());
                        colorVec.mulScalar(1 / colorVec.length());
                        boxes["".concat(i).concat(j)].render.material.emissive = new pc__namespace.Color(colorVec.x, colorVec.y, colorVec.z);
                        highlightedBoxes.push(boxes["".concat(i).concat(j)]);
                    };
                    // create an entity from the loaded model using the render component
                    var modelEntity = assets.model.resource.instantiateRenderEntity({
                        castShadows: true
                    });
                    // add an anim component to the entity
                    modelEntity.addComponent('anim', {
                        activate: true
                    });
                    modelEntity.setLocalPosition(-3, 0, 0);
                    var modelEntityParent = new pc__namespace.Entity();
                    modelEntityParent.addChild(modelEntity);
                    app.root.addChild(modelEntityParent);
                    // rotate the model in a circle around the center of the scene
                    app.on('update', function (dt) {
                        modelEntityParent.rotate(0, 13.8 * dt, 0);
                    });
                    var walkTrack = assets.walkAnim.resource.animations[0].resource;
                    // Add two anim events to the walk animation, one for each foot step. These events should occur just as each foot touches the ground
                    walkTrack.events = new pc__namespace.AnimEvents([
                        {
                            time: walkTrack.duration * 0.1,
                            name: 'foot_step',
                            bone: 'R_foot0002_bind_JNT'
                        },
                        {
                            time: walkTrack.duration * 0.6,
                            name: 'foot_step',
                            bone: 'L_foot0002_bind_JNT'
                        }
                    ]);
                    // add the animation track to the anim component, with a defined speed
                    modelEntity.anim.assignAnimation('Walk', walkTrack, undefined, 0.62);
                    modelEntity.anim.on('foot_step', function (event) {
                        // highlight the box that is under the foot's bone position
                        highlightBox(modelEntity.findByName(event.bone).getPosition());
                    });
                    app.on('update', function () {
                        // on update, iterate over any currently highlighted boxes and reduce their emissive property
                        highlightedBoxes.forEach(function (box) {
                            var material = box.render.material;
                            var emissive = material.emissive;
                            emissive.lerp(emissive, pc__namespace.Color.BLACK, 0.08);
                            material.update();
                        });
                        // remove old highlighted boxes from the update loop
                        while (highlightedBoxes.length > 5) {
                            highlightedBoxes.shift();
                        }
                        // set the camera to follow the model
                        var modelPosition = modelEntity.getPosition().clone();
                        modelPosition.y = 0.5;
                        cameraEntity.lookAt(modelPosition);
                    });
                });
            });
        };
        EventsExample.CATEGORY = 'Animation';
        EventsExample.NAME = 'Events';
        EventsExample.WEBGPU_ENABLED = true;
        return EventsExample;
    }());

    var LayerMasksExample = /** @class */ (function () {
        function LayerMasksExample() {
        }
        LayerMasksExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Full Body Layer' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'active state' },
                        React__default["default"].createElement(react.SelectInput, { options: [{ v: 'Idle', t: 'Idle' }, { v: 'Walk', t: 'Walk' }], binding: new react.BindingTwoWay(), link: { observer: data, path: 'fullBodyLayer.state' } }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Upper Body Layer' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'active state' },
                        React__default["default"].createElement(react.SelectInput, { options: [{ v: 'Eager', t: 'Eager' }, { v: 'Idle', t: 'Idle' }, { v: 'Dance', t: 'Dance' }], binding: new react.BindingTwoWay(), link: { observer: data, path: 'upperBodyLayer.state' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'blend type' },
                        React__default["default"].createElement(react.SelectInput, { options: [{ v: pc__namespace.ANIM_LAYER_OVERWRITE, t: 'Overwrite' }, { v: pc__namespace.ANIM_LAYER_ADDITIVE, t: 'Additive' }], value: pc__namespace.ANIM_LAYER_ADDITIVE, binding: new react.BindingTwoWay(), link: { observer: data, path: 'upperBodyLayer.blendType' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'use mask' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'upperBodyLayer.useMask' } }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Options' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'blend' },
                        React__default["default"].createElement(react.SliderInput, { min: 0.01, max: 0.99, binding: new react.BindingTwoWay(), link: { observer: data, path: 'options.blend' }, value: 0.5 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'skeleton' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'options.skeleton' } }))));
        };
        LayerMasksExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                'model': new pc__namespace.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                'idleAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/idle.glb' }),
                'idleEagerAnim': new pc__namespace.Asset('idleEagerAnim', 'container', { url: '/static/assets/animations/bitmoji/idle-eager.glb' }),
                'walkAnim': new pc__namespace.Asset('walkAnim', 'container', { url: '/static/assets/animations/bitmoji/walk.glb' }),
                'danceAnim': new pc__namespace.Asset('danceAnim', 'container', { url: '/static/assets/animations/bitmoji/win-dance.glb' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'bloom': new pc__namespace.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.AnimComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.AnimClipHandler,
                    // @ts-ignore
                    pc__namespace.AnimStateGraphHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    // setup data
                    data.set('fullBodyLayer', {
                        state: 'Idle',
                        blendType: pc__namespace.ANIM_LAYER_OVERWRITE
                    });
                    data.set('upperBodyLayer', {
                        state: 'Eager',
                        blendType: pc__namespace.ANIM_LAYER_ADDITIVE,
                        useMask: true
                    });
                    data.set('options', {
                        blend: 0.5,
                        skeleton: true
                    });
                    // setup skydome
                    app.scene.exposure = 2;
                    app.scene.skyboxMip = 2;
                    app.scene.envAtlas = assets.helipad.resource;
                    // Create an Entity with a camera component
                    var cameraEntity = new pc__namespace.Entity();
                    cameraEntity.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                    });
                    cameraEntity.translate(0, 0.75, 3);
                    // add bloom postprocessing (this is ignored by the picker)
                    cameraEntity.addComponent("script");
                    cameraEntity.script.create("bloom", {
                        attributes: {
                            bloomIntensity: 1,
                            bloomThreshold: 0.7,
                            blurAmount: 4
                        }
                    });
                    app.root.addChild(cameraEntity);
                    // Create an entity with a light component
                    var lightEntity = new pc__namespace.Entity();
                    lightEntity.addComponent("light", {
                        castShadows: true,
                        intensity: 1.5,
                        normalOffsetBias: 0.02,
                        shadowType: pc__namespace.SHADOW_PCF5,
                        shadowDistance: 6,
                        shadowResolution: 2048,
                        shadowBias: 0.02
                    });
                    app.root.addChild(lightEntity);
                    lightEntity.setLocalEulerAngles(45, 30, 0);
                    // create an entity from the loaded model using the render component
                    var modelEntity = assets.model.resource.instantiateRenderEntity({
                        castShadows: true
                    });
                    modelEntity.addComponent('anim', {
                        activate: true
                    });
                    app.root.addChild(modelEntity);
                    // retrieve the animation assets
                    var idleTrack = assets.idleAnim.resource.animations[0].resource;
                    var walkTrack = assets.walkAnim.resource.animations[0].resource;
                    var danceTrack = assets.danceAnim.resource.animations[0].resource;
                    var idleEagerTrack = assets.idleEagerAnim.resource.animations[0].resource;
                    // create the full body layer by assigning full body animations to the anim component
                    modelEntity.anim.assignAnimation('Idle', idleTrack);
                    modelEntity.anim.assignAnimation('Walk', walkTrack);
                    // set the default weight for the base layer
                    modelEntity.anim.baseLayer.weight = 1.0 - data.get('options.blend');
                    // create a mask for the upper body layer
                    var upperBodyMask = {
                        // set a path with the children property as true to include that path and all of its children in the mask
                        'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT': {
                            children: true
                        },
                        // set a path to true in the mask to include only that specific path
                        'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT/C_Head': true
                    };
                    // create a new layer for the upper body, with additive layer blending
                    var upperBodyLayer = modelEntity.anim.addLayer('UpperBody', data.get('options.blend'), upperBodyMask, data.get('upperBodyLayer.blendType'));
                    upperBodyLayer.assignAnimation('Eager', idleEagerTrack);
                    upperBodyLayer.assignAnimation('Idle', idleTrack);
                    upperBodyLayer.assignAnimation('Dance', danceTrack);
                    // respond to changes in the data object made by the control panel
                    data.on('*:set', function (path, value) {
                        if (path === 'fullBodyLayer.state') {
                            modelEntity.anim.baseLayer.transition(value, 0.4);
                        }
                        if (path === 'upperBodyLayer.state') {
                            upperBodyLayer.transition(value, 0.4);
                        }
                        if (path === 'fullBodyLayer.blendType') {
                            modelEntity.anim.baseLayer.blendType = value;
                        }
                        if (path === 'upperBodyLayer.blendType') {
                            upperBodyLayer.blendType = value;
                        }
                        if (path === 'upperBodyLayer.useMask') {
                            upperBodyLayer.mask = value ? {
                                'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT': {
                                    children: true
                                }
                            } : null;
                        }
                        if (path === 'options.blend') {
                            modelEntity.anim.baseLayer.weight = 1.0 - value;
                            upperBodyLayer.weight = value;
                        }
                    });
                    var drawSkeleton = function (entity, color) {
                        entity.children.forEach(function (c) {
                            var target = modelEntity.anim._targets[entity.path + '/graph/localPosition'];
                            if (target) {
                                app.drawLine(entity.getPosition(), c.getPosition(), new pc__namespace.Color(target.getWeight(0), 0, target.getWeight(1), 1), false);
                            }
                            drawSkeleton(c);
                        });
                    };
                    app.on('update', function () {
                        if (data.get('options.skeleton')) {
                            drawSkeleton(modelEntity, new pc__namespace.Color(1, 0, 0, modelEntity.anim.baseLayer.weight * 0.5));
                        }
                    });
                    app.start();
                });
            });
        };
        LayerMasksExample.CATEGORY = 'Animation';
        LayerMasksExample.NAME = 'Layer Masks';
        LayerMasksExample.WEBGPU_ENABLED = true;
        return LayerMasksExample;
    }());

    var LocomotionExample = /** @class */ (function () {
        function LocomotionExample() {
        }
        LocomotionExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Button, { text: 'Jump', onClick: function () { return data.emit('jump'); } }),
                React__default["default"].createElement(react.LabelGroup, { text: 'Run: ' },
                    React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'jogToggle' } })));
        };
        LocomotionExample.prototype.example = function (canvas, deviceType, data) {
            pc__namespace.WasmModule.setConfig('Ammo', {
                glueUrl: '/static/lib/ammo/ammo.wasm.js',
                wasmUrl: '/static/lib/ammo/ammo.wasm.wasm',
                fallbackUrl: '/static/lib/ammo/ammo.js'
            });
            pc__namespace.WasmModule.getInstance('Ammo', run);
            function run() {
                var assets = {
                    'playcanvasGreyTexture': new pc__namespace.Asset('playcanvasGreyTexture', 'texture', { url: '/static/assets/textures/playcanvas-grey.png' }),
                    'model': new pc__namespace.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                    'idleAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/idle.glb' }),
                    'walkAnim': new pc__namespace.Asset('walkAnim', 'container', { url: '/static/assets/animations/bitmoji/walk.glb' }),
                    'jogAnim': new pc__namespace.Asset('jogAnim', 'container', { url: '/static/assets/animations/bitmoji/run.glb' }),
                    'jumpAnim': new pc__namespace.Asset('jumpAnim', 'container', { url: '/static/assets/animations/bitmoji/jump-flip.glb' }),
                    helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                };
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.mouse = new pc__namespace.Mouse(document.body);
                    createOptions.touch = new pc__namespace.TouchDevice(document.body);
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.RenderComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem,
                        // @ts-ignore
                        pc__namespace.ScriptComponentSystem,
                        // @ts-ignore
                        pc__namespace.AnimComponentSystem,
                        // @ts-ignore
                        pc__namespace.CollisionComponentSystem,
                        // @ts-ignore
                        pc__namespace.RigidBodyComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler,
                        // @ts-ignore
                        pc__namespace.ScriptHandler,
                        // @ts-ignore
                        pc__namespace.AnimClipHandler,
                        // @ts-ignore
                        pc__namespace.AnimStateGraphHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                    assetListLoader.load(function () {
                        // setup skydome
                        app.scene.skyboxMip = 2;
                        app.scene.skyboxIntensity = 0.7;
                        app.scene.envAtlas = assets.helipad.resource;
                        app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                        // Create an Entity with a camera component
                        var cameraEntity = new pc__namespace.Entity();
                        cameraEntity.name = "Camera";
                        cameraEntity.addComponent("camera", {
                            clearColor: new pc__namespace.Color(0.1, 0.15, 0.2)
                        });
                        cameraEntity.translateLocal(0.5, 3, 8);
                        cameraEntity.rotateLocal(-30, 0, 0);
                        app.root.addChild(cameraEntity);
                        // Create an entity with a light component
                        var light = new pc__namespace.Entity();
                        light.addComponent("light", {
                            type: "directional",
                            color: new pc__namespace.Color(1, 1, 1),
                            castShadows: true,
                            intensity: 2,
                            shadowBias: 0.2,
                            shadowDistance: 16,
                            normalOffsetBias: 0.05,
                            shadowResolution: 2048
                        });
                        light.setLocalEulerAngles(60, 30, 0);
                        app.root.addChild(light);
                        app.start();
                        var characterEntity = new pc__namespace.Entity();
                        // create an entity from the loaded model using the render component
                        var renderEntity = assets.model.resource.instantiateRenderEntity({
                            castShadows: true
                        });
                        // assign the renderEntity as the child of character entity. All transforms of the
                        // renderEntity and its children are driven by the anim component.
                        // The characterEntity transform will be controlled by the Locomotion script.
                        characterEntity.addChild(renderEntity);
                        // add an anim component to the entity
                        characterEntity.addComponent('anim', {
                            activate: true
                        });
                        // create an anim state graph
                        var animStateGraphData = {
                            "layers": [
                                {
                                    "name": "locomotion",
                                    "states": [
                                        {
                                            "name": "START"
                                        },
                                        {
                                            "name": "Idle",
                                            "speed": 1.0
                                        },
                                        {
                                            "name": "Walk",
                                            "speed": 1.0
                                        },
                                        {
                                            "name": "Jump",
                                            "speed": 1
                                        },
                                        {
                                            "name": "Jog",
                                            "speed": 1.0
                                        },
                                        {
                                            "name": "END"
                                        }
                                    ],
                                    "transitions": [
                                        {
                                            "from": "START",
                                            "to": "Idle",
                                            "time": 0,
                                            "priority": 0
                                        },
                                        {
                                            "from": "Idle",
                                            "to": "Walk",
                                            "time": 0.1,
                                            "priority": 0,
                                            "conditions": [
                                                {
                                                    "parameterName": "speed",
                                                    "predicate": pc__namespace.ANIM_GREATER_THAN,
                                                    "value": 0
                                                }
                                            ]
                                        },
                                        {
                                            "from": "ANY",
                                            "to": "Jump",
                                            "time": 0.1,
                                            "priority": 0,
                                            "conditions": [
                                                {
                                                    "parameterName": "jump",
                                                    "predicate": pc__namespace.ANIM_EQUAL_TO,
                                                    "value": true
                                                }
                                            ]
                                        },
                                        {
                                            "from": "Jump",
                                            "to": "Idle",
                                            "time": 0.2,
                                            "priority": 0,
                                            "exitTime": 0.8
                                        },
                                        {
                                            "from": "Jump",
                                            "to": "Walk",
                                            "time": 0.2,
                                            "priority": 0,
                                            "exitTime": 0.8
                                        },
                                        {
                                            "from": "Walk",
                                            "to": "Idle",
                                            "time": 0.1,
                                            "priority": 0,
                                            "conditions": [
                                                {
                                                    "parameterName": "speed",
                                                    "predicate": pc__namespace.ANIM_LESS_THAN_EQUAL_TO,
                                                    "value": 0
                                                }
                                            ]
                                        },
                                        {
                                            "from": "Walk",
                                            "to": "Jog",
                                            "time": 0.1,
                                            "priority": 0,
                                            "conditions": [
                                                {
                                                    "parameterName": "speed",
                                                    "predicate": pc__namespace.ANIM_GREATER_THAN,
                                                    "value": 1
                                                }
                                            ]
                                        },
                                        {
                                            "from": "Jog",
                                            "to": "Walk",
                                            "time": 0.1,
                                            "priority": 0,
                                            "conditions": [
                                                {
                                                    "parameterName": "speed",
                                                    "predicate": pc__namespace.ANIM_LESS_THAN,
                                                    "value": 2
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ],
                            "parameters": {
                                "speed": {
                                    "name": "speed",
                                    "type": pc__namespace.ANIM_PARAMETER_INTEGER,
                                    "value": 0
                                },
                                "jump": {
                                    "name": "jump",
                                    "type": pc__namespace.ANIM_PARAMETER_TRIGGER,
                                    "value": false
                                }
                            }
                        };
                        // load the state graph into the anim component
                        characterEntity.anim.loadStateGraph(animStateGraphData);
                        // assign the loaded animation assets to each of the states present in the state graph
                        var locomotionLayer = characterEntity.anim.baseLayer;
                        locomotionLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);
                        locomotionLayer.assignAnimation('Walk', assets.walkAnim.resource.animations[0].resource);
                        locomotionLayer.assignAnimation('Jog', assets.jogAnim.resource.animations[0].resource);
                        locomotionLayer.assignAnimation('Jump', assets.jumpAnim.resource.animations[0].resource);
                        app.root.addChild(characterEntity);
                        var planeEntity = new pc__namespace.Entity();
                        planeEntity.name = 'Plane';
                        planeEntity.addComponent("render", {
                            type: "plane"
                        });
                        planeEntity.addComponent("collision", {
                            type: 'box',
                            halfExtents: new pc__namespace.Vec3(7.5, 0, 7.5)
                        });
                        planeEntity.addComponent("rigidbody", {
                            type: 'static'
                        });
                        planeEntity.setLocalScale(15, 1, 15);
                        planeEntity.setPosition(0, 0, 0);
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuseMap = assets.playcanvasGreyTexture.resource;
                        material.update();
                        planeEntity.render.meshInstances[0].material = material;
                        app.root.addChild(planeEntity);
                        data.on('jump', function () {
                            var isJumping = characterEntity.anim.baseLayer.activeState === 'Jump';
                            if (!isJumping) {
                                characterEntity.anim.setTrigger('jump');
                            }
                        });
                        // create a Locomotion script and initialize some variables
                        var Locomotion = pc__namespace.createScript('Locomotion');
                        var characterDirection;
                        var targetPosition;
                        // initialize code called once per entity
                        Locomotion.prototype.initialize = function () {
                            characterDirection = new pc__namespace.Vec3(1, 0, 0);
                            targetPosition = new pc__namespace.Vec3(2, 0, 2);
                            document.addEventListener("mousedown", this.onMouseDown);
                        };
                        // @ts-ignore engine-tsd
                        Locomotion.prototype.onMouseDown = function (event) {
                            if (event.button !== 0)
                                return;
                            // Set the character target position to a position on the plane that the user has clicked
                            var cameraEntity = app.root.findByName('Camera');
                            var near = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.nearClip);
                            var far = cameraEntity.camera.screenToWorld(event.x, event.y, cameraEntity.camera.farClip);
                            var result = app.systems.rigidbody.raycastFirst(far, near);
                            if (result) {
                                targetPosition = new pc__namespace.Vec3(result.point.x, 0, result.point.z);
                                characterEntity.anim.setInteger('speed', data.get('jogToggle') ? 2 : 1);
                            }
                        };
                        // defines how many units the character should move per second given its current animation state
                        function speedForState(state) {
                            switch (state) {
                                case 'Walk':
                                    return 1.0;
                                case 'Jog':
                                    return 4.0;
                                case 'Jump':
                                case 'Idle':
                                default:
                                    return 0.0;
                            }
                        }
                        var currentPosition = new pc__namespace.Vec3(0, 0, 0);
                        // update code called every frame
                        Locomotion.prototype.update = function (dt) {
                            if (characterEntity.anim.getInteger('speed')) {
                                // Update position if target position is not the same as entity position. Base the movement speed on the current state
                                // Move the character along X & Z axis based on click target position & make character face click direction
                                var moveSpeed = speedForState(characterEntity.anim.baseLayer.activeState);
                                if (characterEntity.anim.baseLayer.transitioning) {
                                    var prevMoveSpeed = speedForState(characterEntity.anim.baseLayer.previousState);
                                    var progress = characterEntity.anim.baseLayer.transitionProgress;
                                    moveSpeed = (prevMoveSpeed * (1.0 - progress)) + (moveSpeed * progress);
                                }
                                var distance = targetPosition.clone().sub(currentPosition);
                                var direction = distance.clone().normalize();
                                characterDirection = new pc__namespace.Vec3().sub(direction);
                                var movement = direction.clone().mulScalar(dt * moveSpeed);
                                if (movement.length() < distance.length()) {
                                    currentPosition.add(movement);
                                    characterEntity.setPosition(currentPosition);
                                    characterEntity.lookAt(characterEntity.getPosition().clone().add(characterDirection));
                                }
                                else {
                                    currentPosition.copy(targetPosition);
                                    characterEntity.setPosition(currentPosition);
                                    characterEntity.anim.setInteger('speed', 0);
                                }
                            }
                        };
                        characterEntity.addComponent("script");
                        characterEntity.script.create('Locomotion', {});
                    });
                });
            }
        };
        LocomotionExample.CATEGORY = 'Animation';
        LocomotionExample.NAME = 'Locomotion';
        LocomotionExample.WEBGPU_ENABLED = true;
        return LocomotionExample;
    }());

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    var ScriptLoader = /** @class */ (function (_super) {
        __extends(ScriptLoader, _super);
        function ScriptLoader() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        ScriptLoader.load = function (resource, app, onLoad) {
            fetch(resource.url)
                .then(function (response) { return response.text(); })
                .then(function (data) {
                window[resource.name] = (Function('module', 'exports', data).call(module, module, module.exports), module).exports;
                onLoad();
            });
        };
        return ScriptLoader;
    }(React__default["default"].Component));

    var TweenExample = /** @class */ (function () {
        function TweenExample() {
        }
        TweenExample.prototype.load = function () {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(ScriptLoader, { name: 'TWEEN', url: 'https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js' }));
        };
        TweenExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' }),
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/animation/tween.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler,
                    // @ts-ignore
                    pc__namespace.JsonHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Utility function to create a text element-based entity
                    var createText = function (fontAsset, message, x, y, z, rot) {
                        var text = new pc__namespace.Entity();
                        text.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            fontAsset: fontAsset,
                            fontSize: 0.5,
                            pivot: [1, 0.5],
                            text: message,
                            type: pc__namespace.ELEMENTTYPE_TEXT
                        });
                        text.setLocalPosition(x, y, z);
                        text.setLocalEulerAngles(0, 0, rot);
                        app.root.addChild(text);
                    };
                    var easingFunctions = [
                        'Linear',
                        'Quadratic',
                        'Cubic',
                        'Quartic',
                        'Quintic',
                        'Sinusoidal',
                        'Exponential',
                        'Circular',
                        'Elastic',
                        'Back',
                        'Bounce'
                    ];
                    var points = [];
                    var colors = [];
                    for (var i = 0; i < easingFunctions.length; i++) {
                        // Create an entity with a sphere render component
                        var sphere = new pc__namespace.Entity();
                        sphere.addComponent("render", {
                            type: "sphere"
                        });
                        var material = sphere.render.material;
                        material.diffuse.set(1, 0, 0);
                        material.specular.set(0.6, 0.6, 0.6);
                        material.gloss = 0.2;
                        sphere.addComponent("script");
                        sphere.script.create("tween", {
                            attributes: {
                                tweens: [{
                                        autoPlay: true,
                                        delay: 0,
                                        duration: 1500,
                                        easingFunction: i,
                                        easingType: 2,
                                        end: new pc__namespace.Vec4(4, -i, 0, 0),
                                        path: 'localPosition',
                                        repeat: -1,
                                        repeatDelay: 0,
                                        start: new pc__namespace.Vec4(0, -i, 0, 0),
                                        yoyo: true // Ping pong between start and end values
                                    }]
                            }
                        });
                        sphere.setLocalScale(0.8, 0.8, 0.8);
                        app.root.addChild(sphere);
                        // Add a line for the path of the sphere
                        points.push(new pc__namespace.Vec3(0, -i, 0), new pc__namespace.Vec3(4, -i, 0));
                        colors.push(pc__namespace.Color.WHITE, pc__namespace.Color.WHITE);
                        // Create a text label for the sphere
                        createText(assets.font, easingFunctions[i], -0.5, -i, 0, 0);
                    }
                    // Create an entity with a directional light component
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "directional"
                    });
                    light.setLocalEulerAngles(70, 30, 0);
                    app.root.addChild(light);
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0.65, -5.5, 20);
                    app.root.addChild(camera);
                    app.on('update', function () {
                        app.drawLines(points, colors);
                    });
                });
            });
        };
        TweenExample.CATEGORY = 'Animation';
        TweenExample.NAME = 'Tween';
        TweenExample.WEBGPU_ENABLED = true;
        return TweenExample;
    }());

    var index$9 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        BlendTrees1DExample: BlendTrees1DExample,
        BlendTrees2DCartesianExample: BlendTrees2DCartesianExample,
        BlendTrees2DDirectionalExample: BlendTrees2DDirectionalExample,
        ComponentPropertiesExample: ComponentPropertiesExample,
        EventsExample: EventsExample,
        LayerMasksExample: LayerMasksExample,
        LocomotionExample: LocomotionExample,
        TweenExample: TweenExample
    });

    var FirstPersonExample = /** @class */ (function () {
        function FirstPersonExample() {
        }
        FirstPersonExample.prototype.example = function (canvas, deviceType) {
            // Create the application and start the update loop
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(document.body),
                touch: new pc__namespace.TouchDevice(document.body),
                gamepads: new pc__namespace.GamePads(),
                keyboard: new pc__namespace.Keyboard(window)
            });
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/first-person-camera.js' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                pc__namespace.WasmModule.setConfig('Ammo', {
                    glueUrl: '/static/lib/ammo/ammo.wasm.js',
                    wasmUrl: '/static/lib/ammo/ammo.wasm.wasm',
                    fallbackUrl: '/static/lib/ammo/ammo.js'
                });
                pc__namespace.WasmModule.getInstance('Ammo', run);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                function run() {
                    app.start();
                    // Create a physical floor
                    var floor = new pc__namespace.Entity();
                    floor.addComponent("collision", {
                        type: "box",
                        halfExtents: new pc__namespace.Vec3(100, 0.5, 100)
                    });
                    floor.addComponent("rigidbody", {
                        type: "static",
                        restitution: 0.5
                    });
                    floor.setLocalPosition(0, -0.5, 0);
                    app.root.addChild(floor);
                    var floorModel = new pc__namespace.Entity();
                    floorModel.addComponent("render", {
                        type: "plane"
                    });
                    floorModel.setLocalPosition(0, 0.5, 0);
                    floorModel.setLocalScale(200, 1, 200);
                    floor.addChild(floorModel);
                    // Create a model entity and assign the statue model
                    var model = assets.statue.resource.instantiateRenderEntity({
                        castShadows: true
                    });
                    model.addComponent("collision", {
                        type: "mesh",
                        asset: assets.statue.resource.model
                    });
                    model.addComponent("rigidbody", {
                        type: "static",
                        restitution: 0.5
                    });
                    app.root.addChild(model);
                    // Create a camera that will be driven by the character controller
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5),
                        farClip: 100,
                        fov: 65,
                        nearClip: 0.1
                    });
                    camera.setLocalPosition(0, 1, 0);
                    // Create a physical character controller
                    var characterController = new pc__namespace.Entity();
                    characterController.addComponent("collision", {
                        axis: 0,
                        height: 2,
                        radius: 0.5,
                        type: "capsule"
                    });
                    characterController.addComponent("rigidbody", {
                        angularDamping: 0,
                        angularFactor: pc__namespace.Vec3.ZERO,
                        friction: 0.3,
                        linearDamping: 0,
                        linearFactor: pc__namespace.Vec3.ONE,
                        mass: 80,
                        restitution: 0,
                        type: "dynamic"
                    });
                    characterController.addComponent("script");
                    characterController.script.create("characterController");
                    characterController.script.create("firstPersonCamera", {
                        attributes: {
                            camera: camera
                        }
                    });
                    characterController.script.create("gamePadInput");
                    characterController.script.create("keyboardInput");
                    characterController.script.create("mouseInput");
                    characterController.script.create("touchInput");
                    characterController.setLocalPosition(0, 1, 10);
                    // Add the character controller and camera to the hierarchy
                    app.root.addChild(characterController);
                    characterController.addChild(camera);
                    // Create a directional light
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        castShadows: true,
                        color: new pc__namespace.Color(1, 1, 1),
                        normalOffsetBias: 0.05,
                        shadowBias: 0.2,
                        shadowDistance: 40,
                        type: "directional",
                        shadowResolution: 2048
                    });
                    app.root.addChild(light);
                    light.setLocalEulerAngles(45, 30, 0);
                }
            });
        };
        FirstPersonExample.CATEGORY = 'Camera';
        FirstPersonExample.NAME = 'First Person';
        return FirstPersonExample;
    }());

    var OrbitExample = /** @class */ (function () {
        function OrbitExample() {
        }
        OrbitExample.prototype.example = function (canvas, deviceType) {
            // Create the app and start the update loop
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(document.body),
                touch: new pc__namespace.TouchDevice(document.body)
            });
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                // Create an entity hierarchy representing the statue
                var statueEntity = assets.statue.resource.instantiateRenderEntity();
                statueEntity.setLocalScale(0.07, 0.07, 0.07);
                statueEntity.setLocalPosition(0, -0.5, 0);
                app.root.addChild(statueEntity);
                // Create a camera with an orbit camera script
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                });
                camera.addComponent("script");
                camera.script.create("orbitCamera", {
                    attributes: {
                        inertiaFactor: 0.2 // Override default of 0 (no inertia)
                    }
                });
                camera.script.create("orbitCameraInputMouse");
                camera.script.create("orbitCameraInputTouch");
                app.root.addChild(camera);
                // Create a directional light
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    type: "directional"
                });
                app.root.addChild(light);
                light.setLocalEulerAngles(45, 30, 0);
                app.start();
            });
        };
        OrbitExample.CATEGORY = 'Camera';
        OrbitExample.NAME = 'Orbit';
        return OrbitExample;
    }());

    var FlyExample = /** @class */ (function () {
        function FlyExample() {
        }
        FlyExample.prototype.example = function (canvas, deviceType) {
            // Create the application and start the update loop
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(canvas),
                keyboard: new pc__namespace.Keyboard(window)
            });
            var assets = {
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/fly-camera.js' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                app.start();
                // ***********    Helper functions    *******************
                function createMaterial(color) {
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuse = color;
                    // we need to call material.update when we change its properties
                    material.update();
                    return material;
                }
                function createBox(position, size, material) {
                    // create an entity and add a model component of type 'box'
                    var box = new pc__namespace.Entity();
                    box.addComponent("render", {
                        type: "box",
                        material: material
                    });
                    // move the box
                    box.setLocalPosition(position);
                    box.setLocalScale(size);
                    // add the box to the hierarchy
                    app.root.addChild(box);
                }
                // ***********    Create Boxes    *******************
                // create a few boxes in our scene
                var red = createMaterial(pc__namespace.Color.RED);
                for (var i = 0; i < 3; i++) {
                    for (var j = 0; j < 2; j++) {
                        createBox(new pc__namespace.Vec3(i * 2, 0, j * 4), pc__namespace.Vec3.ONE, red);
                    }
                }
                // create a floor
                var white = createMaterial(pc__namespace.Color.WHITE);
                createBox(new pc__namespace.Vec3(0, -0.5, 0), new pc__namespace.Vec3(10, 0.1, 10), white);
                // ***********    Create lights   *******************
                // make our scene prettier by adding a directional light
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    type: "omni",
                    color: new pc__namespace.Color(1, 1, 1),
                    range: 100
                });
                light.setLocalPosition(0, 0, 2);
                // add the light to the hierarchy
                app.root.addChild(light);
                // ***********    Create camera    *******************
                // Create an Entity with a camera component
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.5, 0.5, 0.8),
                    nearClip: 0.3,
                    farClip: 30
                });
                // add the fly camera script to the camera
                camera.addComponent("script");
                camera.script.create("flyCamera");
                // add the camera to the hierarchy
                app.root.addChild(camera);
                // Move the camera a little further away
                camera.translate(2, 0.8, 9);
            });
        };
        FlyExample.CATEGORY = 'Camera';
        FlyExample.NAME = 'Fly';
        return FlyExample;
    }());

    var index$8 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        FirstPersonExample: FirstPersonExample,
        OrbitExample: OrbitExample,
        FlyExample: FlyExample
    });

    var AreaLightsExample$1 = /** @class */ (function () {
        function AreaLightsExample() {
        }
        AreaLightsExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'color': new pc__namespace.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.jpg' }),
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/seaside-rocks01-normal.jpg' }),
                'gloss': new pc__namespace.Asset('gloss', 'texture', { url: '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
                'luts': new pc__namespace.Asset('luts', 'json', { url: '/static/assets/json/area-light-luts.json' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.JsonHandler,
                    // @ts-ignore
                    pc__namespace.CubemapHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    // helper function to create a primitive with shape type, position, scale, color
                    function createPrimitive(primitiveType, position, scale, color, assetManifest) {
                        // create material of specified color
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = color;
                        material.gloss = 0.8;
                        material.useMetalness = true;
                        if (assetManifest) {
                            material.diffuseMap = assetManifest.color.resource;
                            material.normalMap = assetManifest.normal.resource;
                            material.glossMap = assetManifest.gloss.resource;
                            material.metalness = 0.7;
                            material.diffuseMapTiling.set(7, 7);
                            material.normalMapTiling.set(7, 7);
                            material.glossMapTiling.set(7, 7);
                        }
                        material.update();
                        // create primitive
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            material: material
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // helper function to create area light including its visual representation in the world
                    function createAreaLight(type, shape, position, scale, color, intensity, shadows, range) {
                        var lightParent = new pc__namespace.Entity();
                        lightParent.translate(position);
                        app.root.addChild(lightParent);
                        var light = new pc__namespace.Entity();
                        light.addComponent("light", {
                            type: type,
                            shape: shape,
                            color: color,
                            intensity: intensity,
                            falloffMode: pc__namespace.LIGHTFALLOFF_INVERSESQUARED,
                            range: range,
                            castShadows: shadows,
                            innerConeAngle: 80,
                            outerConeAngle: 85,
                            shadowBias: 0.1,
                            normalOffsetBias: 0.1,
                            shadowResolution: 2048
                        });
                        light.setLocalScale(scale, scale, scale);
                        lightParent.addChild(light);
                        // emissive material that is the light source color
                        var brightMaterial = new pc__namespace.StandardMaterial();
                        brightMaterial.emissive = color;
                        brightMaterial.useLighting = false;
                        brightMaterial.cull = (shape === pc__namespace.LIGHTSHAPE_RECT) ? pc__namespace.CULLFACE_NONE : pc__namespace.CULLFACE_BACK;
                        brightMaterial.update();
                        var brightShape = new pc__namespace.Entity();
                        // primitive shape that matches light source shape
                        brightShape.addComponent("render", {
                            type: (shape === pc__namespace.LIGHTSHAPE_SPHERE) ? "sphere" : (shape === pc__namespace.LIGHTSHAPE_DISK) ? "cone" : "plane",
                            material: brightMaterial,
                            castShadows: type !== "directional"
                        });
                        brightShape.setLocalScale(((type === "directional") ? scale * range : scale), (shape === pc__namespace.LIGHTSHAPE_DISK) ? 0.001 : ((type === "directional") ? scale * range : scale), ((type === "directional") ? scale * range : scale));
                        lightParent.addChild(brightShape);
                        // add black primitive shape if not omni-directional or global directional
                        if (type === "spot") {
                            // black material
                            var blackMaterial = new pc__namespace.StandardMaterial();
                            blackMaterial.diffuse = new pc__namespace.Color(0, 0, 0);
                            blackMaterial.useLighting = false;
                            blackMaterial.cull = (shape === pc__namespace.LIGHTSHAPE_RECT) ? pc__namespace.CULLFACE_NONE : pc__namespace.CULLFACE_BACK;
                            blackMaterial.update();
                            var blackShape = new pc__namespace.Entity();
                            blackShape.addComponent("render", {
                                type: (shape === pc__namespace.LIGHTSHAPE_SPHERE) ? "sphere" : (shape === pc__namespace.LIGHTSHAPE_DISK) ? "cone" : "plane",
                                material: blackMaterial
                            });
                            blackShape.setLocalPosition(0, 0.01 / scale, 0);
                            blackShape.setLocalEulerAngles(-180, 0, 0);
                            brightShape.addChild(blackShape);
                        }
                        return lightParent;
                    }
                    var far = 5000.0;
                    app.start();
                    // enable area lights which are disabled by default for clustered lighting
                    app.scene.lighting.areaLightsEnabled = true;
                    // set the loaded area light LUT data
                    var luts = assets.luts.resource;
                    app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);
                    // set up some general scene rendering properties
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // setup skydome
                    app.scene.skyboxMip = 1; // use top mipmap level of cubemap (full resolution)
                    app.scene.skyboxIntensity = 0.4; // make it darker
                    app.scene.envAtlas = assets.helipad.resource;
                    // create ground plane
                    createPrimitive("plane", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(20, 20, 20), new pc__namespace.Color(0.3, 0.3, 0.3), assets);
                    // get the instance of the statue and set up with render component
                    var statue = assets.statue.resource.instantiateRenderEntity();
                    statue.setLocalScale(0.4, 0.4, 0.4);
                    app.root.addChild(statue);
                    // Create the camera, which renders entities
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.2, 0.2, 0.2),
                        fov: 60,
                        farClip: 100000
                    });
                    app.root.addChild(camera);
                    camera.setLocalPosition(0, 2.5, 12);
                    camera.lookAt(0, 0, 0);
                    // Create lights with light source shape
                    var light1 = createAreaLight("spot", pc__namespace.LIGHTSHAPE_RECT, new pc__namespace.Vec3(-3, 4, 0), 4, new pc__namespace.Color(1, 1, 1), 2, true, 10);
                    var light2 = createAreaLight("omni", pc__namespace.LIGHTSHAPE_SPHERE, new pc__namespace.Vec3(5, 2, -2), 2, new pc__namespace.Color(1, 1, 0), 2, false, 10);
                    var light3 = createAreaLight("directional", pc__namespace.LIGHTSHAPE_DISK, new pc__namespace.Vec3(0, 0, 0), 0.2, new pc__namespace.Color(0.7, 0.7, 1), 10, true, far);
                    // update things each frame
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        var factor1 = (Math.sin(time) + 1) * 0.5;
                        var factor2 = (Math.sin(time * 0.6) + 1) * 0.5;
                        var factor3 = (Math.sin(time * 0.4) + 1) * 0.5;
                        if (light1) {
                            light1.setLocalEulerAngles(pc__namespace.math.lerp(-90, 110, factor1), 0, 90);
                            light1.setLocalPosition(-4, pc__namespace.math.lerp(2, 4, factor3), pc__namespace.math.lerp(-2, 2, factor2));
                        }
                        if (light2) {
                            light2.setLocalPosition(5, pc__namespace.math.lerp(1, 3, factor1), pc__namespace.math.lerp(-2, 2, factor2));
                        }
                        if (light3) {
                            light3.setLocalEulerAngles(pc__namespace.math.lerp(230, 310, factor2), pc__namespace.math.lerp(-30, 0, factor3), 90);
                            var dir = light3.getWorldTransform().getY();
                            var campos = camera.getPosition();
                            light3.setPosition(campos.x + dir.x * far, campos.y + dir.y * far, campos.z + dir.z * far);
                        }
                    });
                });
            });
        };
        AreaLightsExample.CATEGORY = 'Graphics';
        AreaLightsExample.NAME = 'Area Lights';
        AreaLightsExample.WEBGPU_ENABLED = true;
        return AreaLightsExample;
    }());

    var AreaPickerExample = /** @class */ (function () {
        function AreaPickerExample() {
        }
        AreaPickerExample.prototype.example = function (canvas, deviceType) {
            var _this = this;
            var assets = {
                'bloom': new pc__namespace.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.TextureHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.skyboxMip = 2;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxIntensity = 0.1;
                    // use a quarter resolution for picker render target (faster but less precise - can miss small objects)
                    var pickerScale = 0.25;
                    var mouseX = 0, mouseY = 0;
                    // generate a box area with specified size of random primitives
                    var size = 30;
                    var halfSize = size * 0.5;
                    for (var i = 0; i < 300; i++) {
                        var shape = Math.random() < 0.5 ? "cylinder" : "sphere";
                        var position = new pc__namespace.Vec3(Math.random() * size - halfSize, Math.random() * size - halfSize, Math.random() * size - halfSize);
                        var scale = 1 + Math.random();
                        var entity = createPrimitive(shape, position, new pc__namespace.Vec3(scale, scale, scale));
                        app.root.addChild(entity);
                    }
                    // handle mouse move event and store current mouse position to use as a position to pick from the scene
                    new pc__namespace.Mouse(document.body).on(pc__namespace.EVENT_MOUSEMOVE, function (event) {
                        mouseX = event.x;
                        mouseY = event.y;
                    }, _this);
                    // Create an instance of the picker class
                    // Lets use quarter of the resolution to improve performance - this will miss very small objects, but it's ok in our case
                    var picker = new pc__namespace.Picker(app, canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);
                    // helper function to create a primitive with shape type, position, scale
                    function createPrimitive(primitiveType, position, scale) {
                        // create material of random color
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                        material.gloss = 0.6;
                        material.metalness = 0.4;
                        material.useMetalness = true;
                        material.update();
                        // create primitive
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            material: material
                        });
                        // set position and scale
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        return primitive;
                    }
                    // Create main camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                    });
                    // add bloom postprocessing (this is ignored by the picker)
                    camera.addComponent("script");
                    camera.script.create("bloom", {
                        attributes: {
                            bloomIntensity: 1,
                            bloomThreshold: 0.7,
                            blurAmount: 4
                        }
                    });
                    app.root.addChild(camera);
                    // function to draw a 2D rectangle in the screen space coordinates
                    function drawRectangle(x, y, w, h) {
                        var pink = new pc__namespace.Color(1, 0.02, 0.58);
                        // transform 4 2D screen points into world space
                        var pt0 = camera.camera.screenToWorld(x, y, 1);
                        var pt1 = camera.camera.screenToWorld(x + w, y, 1);
                        var pt2 = camera.camera.screenToWorld(x + w, y + h, 1);
                        var pt3 = camera.camera.screenToWorld(x, y + h, 1);
                        // and connect them using white lines
                        var points = [pt0, pt1, pt1, pt2, pt2, pt3, pt3, pt0];
                        var colors = [pink, pink, pink, pink, pink, pink, pink, pink];
                        app.drawLines(points, colors);
                    }
                    // sets material emissive color to specified color
                    function highlightMaterial(material, color) {
                        material.emissive = color;
                        material.update();
                    }
                    // array of highlighted materials
                    var highlights = [];
                    // update each frame
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt * 0.1;
                        // orbit the camera around
                        if (!camera) {
                            return;
                        }
                        camera.setLocalPosition(40 * Math.sin(time), 0, 40 * Math.cos(time));
                        camera.lookAt(pc__namespace.Vec3.ZERO);
                        // turn all previously highlighted meshes to black at the start of the frame
                        for (var h = 0; h < highlights.length; h++) {
                            highlightMaterial(highlights[h], pc__namespace.Color.BLACK);
                        }
                        highlights.length = 0;
                        // Make sure the picker is the right size, and prepare it, which renders meshes into its render target
                        if (picker) {
                            picker.resize(canvas.clientWidth * pickerScale, canvas.clientHeight * pickerScale);
                            picker.prepare(camera.camera, app.scene);
                        }
                        // areas we want to sample - two larger rectangles, one small square, and one pixel at a mouse position
                        // assign them different highlight colors as well
                        var areas = [
                            {
                                pos: new pc__namespace.Vec2(canvas.clientWidth * 0.3, canvas.clientHeight * 0.3),
                                size: new pc__namespace.Vec2(100, 200),
                                color: pc__namespace.Color.YELLOW
                            },
                            {
                                pos: new pc__namespace.Vec2(canvas.clientWidth * 0.6, canvas.clientHeight * 0.7),
                                size: new pc__namespace.Vec2(200, 20),
                                color: pc__namespace.Color.CYAN
                            },
                            {
                                pos: new pc__namespace.Vec2(canvas.clientWidth * 0.8, canvas.clientHeight * 0.3),
                                size: new pc__namespace.Vec2(5, 5),
                                color: pc__namespace.Color.MAGENTA
                            },
                            {
                                // area based on mouse position
                                pos: new pc__namespace.Vec2(mouseX, mouseY),
                                size: new pc__namespace.Vec2(1, 1),
                                color: pc__namespace.Color.RED
                            }
                        ];
                        // process all areas
                        for (var a = 0; a < areas.length; a++) {
                            var areaPos = areas[a].pos;
                            var areaSize = areas[a].size;
                            var color = areas[a].color;
                            // display 2D rectangle around it
                            drawRectangle(areaPos.x, areaPos.y, areaSize.x, areaSize.y);
                            // get list of meshInstances inside the area from the picker
                            // this scans the pixels inside the render target and maps the id value stored there into meshInstances
                            var selection = picker.getSelection(areaPos.x * pickerScale, areaPos.y * pickerScale, areaSize.x * pickerScale, areaSize.y * pickerScale);
                            // process all meshInstances it found - highlight them to appropriate color for the area
                            for (var s = 0; s < selection.length; s++) {
                                if (selection[s]) {
                                    var material = selection[s].material;
                                    highlightMaterial(material, color);
                                    highlights.push(material);
                                }
                            }
                        }
                    });
                });
            });
        };
        AreaPickerExample.CATEGORY = 'Graphics';
        AreaPickerExample.NAME = 'Area Picker';
        return AreaPickerExample;
    }());

    var AssetViewerExample = /** @class */ (function () {
        function AssetViewerExample() {
        }
        AssetViewerExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Asset' },
                    React__default["default"].createElement(react.Button, { text: 'Previous', onClick: function () { return data.emit('previous'); } }),
                    React__default["default"].createElement(react.Button, { text: 'Next', onClick: function () { return data.emit('next'); } })));
        };
        AssetViewerExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                orbitCamera: new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                dish: new pc__namespace.Asset('dish', 'container', { url: '/static/assets/models/IridescentDishWithOlives.glb' }),
                mosquito: new pc__namespace.Asset('mosquito', 'container', { url: '/static/assets/models/MosquitoInAmber.glb' }),
                sheen: new pc__namespace.Asset('sheen', 'container', { url: '/static/assets/models/SheenChair.glb' }),
                lamp: new pc__namespace.Asset('lamp', 'container', { url: '/static/assets/models/StainedGlassLamp.glb' }),
                font: new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' }),
                checkerboard: new pc__namespace.Asset('checkerboard', 'texture', { url: '/static/assets/textures/checkboard.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.JsonHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
                    // Move the depth layer to take place after World and Skydome layers, to capture both of them.
                    var depthLayer = app.scene.layers.getLayerById(pc__namespace.LAYERID_DEPTH);
                    app.scene.layers.remove(depthLayer);
                    app.scene.layers.insertOpaque(depthLayer, 2);
                    var createText = function (fontAsset, message, x, z) {
                        // Create a text element-based entity
                        var text = new pc__namespace.Entity();
                        text.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            fontAsset: fontAsset,
                            fontSize: 0.2,
                            pivot: [0.5, 0.5],
                            text: message,
                            type: pc__namespace.ELEMENTTYPE_TEXT
                        });
                        text.setLocalPosition(x, -0.9, z);
                        text.setLocalEulerAngles(-90, 0, 0);
                        app.root.addChild(text);
                    };
                    var createVisual = function (resource, pos, scale) {
                        var entity = resource.instantiateRenderEntity({
                            castShadows: true
                        });
                        entity.setLocalScale(scale, scale, scale);
                        entity.setLocalPosition(pos);
                        app.root.addChild(entity);
                        return entity;
                    };
                    var currentAssetIndex = 0;
                    // create the scene by instantiating glbs
                    var mosquito = createVisual(assets.mosquito.resource, new pc__namespace.Vec3(0, 0.5, 0), 25);
                    createText(assets.font, "KHR_materials_volume\nKHR_materials_ior\nKHR_materials_transmission", 0, 2);
                    var dish = createVisual(assets.dish.resource, new pc__namespace.Vec3(-4, -0.5, 0), 9);
                    createText(assets.font, "KHR_materials_specular\nKHR_materials_volume\nKHR_materials_ior\nKHR_materials_transmission", -4, 2);
                    var sheen1 = createVisual(assets.sheen.resource, new pc__namespace.Vec3(8, -1.0, 0), 4);
                    createText(assets.font, "Mango Velvet", 8, 1);
                    var sheen2 = createVisual(assets.sheen.resource, new pc__namespace.Vec3(4, -1.0, 0), 4);
                    assets.sheen.resource.applyMaterialVariant(sheen2, "Peacock Velvet");
                    createText(assets.font, "KHR_materials_sheen\nKHR_materials_variants", 5.5, 2);
                    createText(assets.font, "Peacock Velvet", 4, 1);
                    var lamp = createVisual(assets.lamp.resource, new pc__namespace.Vec3(-8, -1.0, 0), 5);
                    createText(assets.font, "Lamp on", -8, 1);
                    var lamp2 = createVisual(assets.lamp.resource, new pc__namespace.Vec3(-11, -1.0, 0), 5);
                    assets.lamp.resource.applyMaterialVariant(lamp2, "Lamp off");
                    createText(assets.font, "Lamp off", -11, 1);
                    createText(assets.font, "KHR_materials_transmission\nKHR_materials_ior\nKHR_materials_volume\nKHR_materials_variants\nKHR_materials_clearcoat", -9.5, 2);
                    var assetList = [
                        lamp2, lamp, dish, mosquito, sheen2, sheen1
                    ];
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuseMap = assets.checkerboard.resource;
                    material.diffuseMapTiling = new pc__namespace.Vec2(16, 6);
                    material.update();
                    var plane = new pc__namespace.Entity();
                    plane.addComponent('render', {
                        type: 'plane',
                        material: material
                    });
                    plane.setLocalScale(new pc__namespace.Vec3(25, 0, 10));
                    plane.setLocalPosition(0, -1.0, 0);
                    app.root.addChild(plane);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {});
                    camera.setLocalPosition(0, 55, 160);
                    camera.camera.requestSceneColorMap(true);
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            distanceMin: 8,
                            distanceMax: 50
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    var directionalLight = new pc__namespace.Entity();
                    directionalLight.addComponent("light", {
                        type: "directional",
                        color: pc__namespace.Color.WHITE,
                        castShadows: true,
                        intensity: 1,
                        shadowBias: 0.2,
                        normalOffsetBias: 0.05,
                        shadowResolution: 2048
                    });
                    directionalLight.setEulerAngles(45, 180, 0);
                    app.root.addChild(directionalLight);
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    app.scene.skyboxRotation = new pc__namespace.Quat().setFromEulerAngles(0, 70, 0);
                    app.scene.skyboxIntensity = 1.5;
                    window.addEventListener("touchstart", function (event) {
                        var touch = event.touches[0];
                        var entity = data.get('selection.focusEntity');
                        var newEntity = entity;
                        if (touch.clientX <= canvas.width * 0.2) {
                            newEntity = Math.max(0, entity - 1);
                        }
                        else if (touch.clientX >= canvas.width * 0.8) {
                            newEntity = Math.min(entity + 1, assetList.length);
                        }
                        if (entity !== newEntity) {
                            data.set('selection.focusEntity', newEntity);
                        }
                    }, false);
                    function jumpToAsset(offset) {
                        // wrap around
                        var count = assetList.length - 1;
                        currentAssetIndex += offset;
                        if (currentAssetIndex < 0)
                            currentAssetIndex = count;
                        if (currentAssetIndex > count)
                            currentAssetIndex = 0;
                        var pos = assetList[currentAssetIndex].getLocalPosition();
                        var newPos = new pc__namespace.Vec3(0, 2.0, 6.0).add(pos);
                        camera.setLocalPosition(newPos);
                        // @ts-ignore engine-tsd
                        camera.script.orbitCamera.focusEntity = assetList[currentAssetIndex];
                    }
                    // focus on mosquito
                    jumpToAsset(3);
                    data.on('previous', function () {
                        jumpToAsset(-1);
                    });
                    // remove light button handler
                    data.on('next', function () {
                        jumpToAsset(1);
                    });
                });
            });
        };
        AssetViewerExample.CATEGORY = 'Graphics';
        AssetViewerExample.NAME = 'Asset Viewer';
        return AssetViewerExample;
    }());

    var BatchingDynamicExample = /** @class */ (function () {
        function BatchingDynamicExample() {
        }
        BatchingDynamicExample.prototype.example = function (canvas, deviceType) {
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                // @ts-ignore
                createOptions.batchManager = pc__namespace.BatchManager;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                app.start();
                window.addEventListener("resize", function () {
                    app.resizeCanvas(canvas.width, canvas.height);
                });
                // create two material
                var material1 = new pc__namespace.StandardMaterial();
                material1.diffuse = new pc__namespace.Color(1, 1, 0);
                material1.gloss = 0.4;
                material1.metalness = 0.5;
                material1.useMetalness = true;
                material1.update();
                var material2 = new pc__namespace.StandardMaterial();
                material2.diffuse = new pc__namespace.Color(0, 1, 1);
                material2.gloss = 0.4;
                material2.metalness = 0.5;
                material2.useMetalness = true;
                material2.update();
                // create a single BatchGroup. Make it dynamic to allow batched meshes to be freely moved every frame.
                var batchGroup = app.batcher.addGroup("Meshes", true, 100);
                // create various primitive instances using one of the two materials
                var numInstances = 500;
                var shapes = ["box", "cone", "cylinder", "sphere", "capsule"];
                var entities = [];
                for (var i = 0; i < numInstances; i++) {
                    // random shape
                    var shapeName = shapes[Math.floor(Math.random() * shapes.length)];
                    var entity = new pc__namespace.Entity();
                    // create render component
                    entity.addComponent("render", {
                        type: shapeName,
                        material: Math.random() < 0.5 ? material1 : material2,
                        castShadows: true,
                        // add it to the batchGroup - this instructs engine to try and render these meshes in a small number of draw calls.
                        // there will be at least 2 draw calls, one for each material
                        batchGroupId: batchGroup.id
                    });
                    // add entity for rendering
                    app.root.addChild(entity);
                    // keep in the list to adjust positions each frame
                    entities.push(entity);
                }
                // Create an Entity for the ground
                var ground = new pc__namespace.Entity();
                ground.addComponent("render", {
                    type: "box",
                    material: material2
                });
                ground.setLocalScale(150, 1, 150);
                ground.setLocalPosition(0, -26, 0);
                app.root.addChild(ground);
                // Create an entity with a camera component
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.2, 0.2, 0.2)
                });
                app.root.addChild(camera);
                // Create an entity with a directional light component
                // Add it as a child of a camera to rotate with the camera
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    type: "directional",
                    castShadows: true,
                    shadowBias: 0.2,
                    normalOffsetBias: 0.06,
                    shadowDistance: 150
                });
                camera.addChild(light);
                light.setLocalEulerAngles(15, 30, 0);
                // Set an update function on the app's update event
                var time = 0;
                app.on("update", function (dt) {
                    time += dt;
                    // move all entities along orbits
                    for (var i = 0; i < entities.length; i++) {
                        var radius = 5 + 20.0 * i / numInstances;
                        var speed = i / numInstances;
                        entities[i].setLocalPosition(radius * Math.sin(i + time * speed), radius * Math.cos(i + time * speed), radius * Math.cos(i + 2 * time * speed));
                        entities[i].lookAt(pc__namespace.Vec3.ZERO);
                    }
                    // orbit camera around
                    camera.setLocalPosition(70 * Math.sin(time), 0, 70 * Math.cos(time));
                    camera.lookAt(pc__namespace.Vec3.ZERO);
                });
            });
        };
        BatchingDynamicExample.CATEGORY = 'Graphics';
        BatchingDynamicExample.NAME = 'Batching Dynamic';
        BatchingDynamicExample.WEBGPU_ENABLED = true;
        return BatchingDynamicExample;
    }());

    var ReflectionBoxExample = /** @class */ (function () {
        function ReflectionBoxExample() {
        }
        ReflectionBoxExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Settings' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Update' },
                        React__default["default"].createElement(react.SelectInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.updateFrequency' }, type: "number", options: [
                                { v: 0, t: 'Once' },
                                { v: 1, t: 'Every frame' },
                                { v: 10, t: 'Every 10 frames' },
                                { v: 30, t: 'Every 30 frames' }
                            ] })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Gloss' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.gloss' }, min: 0, max: 1, precision: 2 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Metalness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.metalness' }, min: 0, max: 1, precision: 2 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Reflectivity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.reflectivity' }, min: 0, max: 1, precision: 2 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Bumpiness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.bumpiness' }, min: 0, max: 1, precision: 2 }))));
        };
        ReflectionBoxExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                'script1': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                'script2': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/utils/cubemap-renderer.js' }),
                'batmobile': new pc__namespace.Asset('batmobile', 'container', { url: '/static/assets/models/batmobile-armored.glb' }),
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/normal-map.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    data.set('settings', {
                        updateFrequency: 10,
                        gloss: 0.8,
                        metalness: 0.9,
                        bumpiness: 0.2,
                        reflectivity: 0.5
                    });
                    // create a layer for object that do not render into reflection cubemap
                    var excludedLayer = new pc__namespace.Layer({ name: "Excluded" });
                    app.scene.layers.push(excludedLayer);
                    // get world layer
                    var worldLayer = app.scene.layers.getLayerByName("World");
                    // create an envAtlas texture, which will hold a prefiltered lighting generated from the cubemap.
                    // This represents a reflection prefiltered for different levels of roughness
                    var envAtlas = new pc__namespace.Texture(app.graphicsDevice, {
                        width: 512,
                        height: 512,
                        format: pc__namespace.PIXELFORMAT_RGBA8,
                        type: pc__namespace.TEXTURETYPE_RGBM,
                        projection: pc__namespace.TEXTUREPROJECTION_EQUIRECT,
                        addressU: pc__namespace.ADDRESS_CLAMP_TO_EDGE,
                        addressV: pc__namespace.ADDRESS_CLAMP_TO_EDGE,
                        mipmaps: false
                    });
                    // material for the walls
                    var roomMaterial = new pc__namespace.StandardMaterial();
                    roomMaterial.useMetalness = true;
                    roomMaterial.diffuse = pc__namespace.Color.WHITE;
                    roomMaterial.normalMap = assets.normal.resource;
                    roomMaterial.normalMapTiling.set(5, 5);
                    roomMaterial.bumpiness = 0.1;
                    roomMaterial.gloss = 0.9;
                    roomMaterial.reflectivity = 0.3;
                    // @ts-ignore
                    roomMaterial.envAtlas = envAtlas; // use reflection from env atlas
                    roomMaterial.metalness = 0.5;
                    // the material uses box projected cubemap for reflections. Set its bounding box the the size of the room
                    // so that the reflections line up
                    roomMaterial.cubeMapProjection = pc__namespace.CUBEPROJ_BOX;
                    roomMaterial.cubeMapProjectionBox = new pc__namespace.BoundingBox(new pc__namespace.Vec3(0, 200, 0), new pc__namespace.Vec3(400, 200, 400));
                    roomMaterial.update();
                    // material for the magenta emissive beams
                    var emissiveMaterial = new pc__namespace.StandardMaterial();
                    emissiveMaterial.emissive = pc__namespace.Color.MAGENTA;
                    emissiveMaterial.diffuse = pc__namespace.Color.BLACK;
                    emissiveMaterial.update();
                    // material for the white sphere representing an omni light
                    var lightMaterial = new pc__namespace.StandardMaterial();
                    lightMaterial.emissive = pc__namespace.Color.WHITE;
                    lightMaterial.diffuse = pc__namespace.Color.BLACK;
                    lightMaterial.update();
                    // material for the reflective sphere in the center
                    var sphereMaterial = new pc__namespace.StandardMaterial();
                    sphereMaterial.useMetalness = true;
                    sphereMaterial.diffuse = pc__namespace.Color.WHITE;
                    sphereMaterial.normalMap = assets.normal.resource;
                    sphereMaterial.normalMapTiling.set(5, 5);
                    sphereMaterial.bumpiness = 0.7;
                    sphereMaterial.gloss = 0.3;
                    sphereMaterial.metalness = 0.7;
                    sphereMaterial.reflectivity = 0.3;
                    // @ts-ignore
                    sphereMaterial.envAtlas = envAtlas; // use reflection from env atlas
                    sphereMaterial.update();
                    var videoTexture;
                    if (!app.graphicsDevice.isWebGPU) {
                        // set up video playback into a texture
                        videoTexture = new pc__namespace.Texture(app.graphicsDevice, {
                            format: pc__namespace.PIXELFORMAT_RGB565,
                            mipmaps: false,
                            minFilter: pc__namespace.FILTER_LINEAR,
                            magFilter: pc__namespace.FILTER_LINEAR,
                            addressU: pc__namespace.ADDRESS_CLAMP_TO_EDGE,
                            addressV: pc__namespace.ADDRESS_CLAMP_TO_EDGE
                        });
                        // create a HTML element with the video
                        var video_1 = document.createElement('video');
                        video_1.id = 'vid';
                        video_1.loop = true;
                        video_1.muted = true;
                        video_1.autoplay = true;
                        video_1.playsInline = true;
                        video_1.crossOrigin = "anonymous";
                        video_1.setAttribute('style', 'display: block; width: 1px; height: 1px; position: absolute; opacity: 0; z-index: -1000; top: 0px; pointer-events: none');
                        video_1.src = '/static/assets/video/SampleVideo_1280x720_1mb.mp4';
                        document.body.append(video_1);
                        video_1.addEventListener('canplaythrough', function () {
                            videoTexture.setSource(video_1);
                        });
                    }
                    // materials used on the TV screen to display the video texture
                    var screenMaterial = new pc__namespace.StandardMaterial();
                    screenMaterial.useLighting = false;
                    screenMaterial.emissiveMap = videoTexture;
                    screenMaterial.update();
                    // helper function to create a 3d primitive including its material
                    function createPrimitive(primitiveType, position, scale, material) {
                        // create the primitive using the material
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            material: material,
                            layers: [worldLayer.id, excludedLayer.id],
                            castShadows: false,
                            receiveShadows: false
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                    }
                    // create the ground plane from the boxes
                    createPrimitive("box", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(800, 2, 800), roomMaterial);
                    createPrimitive("box", new pc__namespace.Vec3(0, 400, 0), new pc__namespace.Vec3(800, 2, 800), roomMaterial);
                    // walls
                    createPrimitive("box", new pc__namespace.Vec3(400, 200, 0), new pc__namespace.Vec3(2, 400, 800), roomMaterial);
                    createPrimitive("box", new pc__namespace.Vec3(-400, 200, 0), new pc__namespace.Vec3(2, 400, 800), roomMaterial);
                    createPrimitive("box", new pc__namespace.Vec3(0, 200, -400), new pc__namespace.Vec3(800, 400, 0), roomMaterial);
                    createPrimitive("box", new pc__namespace.Vec3(0, 200, 400), new pc__namespace.Vec3(800, 400, 0), roomMaterial);
                    // emissive pillars
                    createPrimitive("box", new pc__namespace.Vec3(400, 200, -50), new pc__namespace.Vec3(20, 400, 20), emissiveMaterial);
                    createPrimitive("box", new pc__namespace.Vec3(400, 200, 50), new pc__namespace.Vec3(20, 400, 20), emissiveMaterial);
                    createPrimitive("box", new pc__namespace.Vec3(-400, 200, 50), new pc__namespace.Vec3(20, 400, 20), emissiveMaterial);
                    createPrimitive("box", new pc__namespace.Vec3(-400, 200, -50), new pc__namespace.Vec3(20, 400, 20), emissiveMaterial);
                    createPrimitive("box", new pc__namespace.Vec3(0, 400, 50), new pc__namespace.Vec3(800, 20, 20), emissiveMaterial);
                    createPrimitive("box", new pc__namespace.Vec3(0, 400, -50), new pc__namespace.Vec3(800, 20, 20), emissiveMaterial);
                    // screen
                    createPrimitive("box", new pc__namespace.Vec3(0, 200, 400), new pc__namespace.Vec3(500, 250, 5), screenMaterial);
                    // batmobile
                    var batmobileEntity = assets.batmobile.resource.instantiateRenderEntity({
                        castShadows: false,
                        receiveShadows: false
                    });
                    batmobileEntity.setLocalScale(100, 100, 100);
                    batmobileEntity.rotateLocal(0, 0, 90);
                    app.root.addChild(batmobileEntity);
                    // apply shiny material to it
                    var renders = batmobileEntity.findComponents('render');
                    renders.forEach(function (render) {
                        for (var i = 0; i < render.meshInstances.length; i++) {
                            var meshInstance = render.meshInstances[i];
                            meshInstance.material = sphereMaterial;
                        }
                    });
                    // create an omni light white orbits the room to avoid it being completely dark
                    var lightOmni = new pc__namespace.Entity();
                    lightOmni.addComponent("light", {
                        type: "omni",
                        layers: [excludedLayer.id],
                        castShadows: false,
                        color: pc__namespace.Color.WHITE,
                        intensity: 0.2,
                        range: 1000
                    });
                    // add a white sphere to light so that we can see where it is. This sphere is excluded from the reflections.
                    lightOmni.addComponent("render", {
                        type: "sphere",
                        layers: [excludedLayer.id],
                        material: lightMaterial,
                        castShadows: false,
                        receiveShadows: false
                    });
                    lightOmni.setLocalScale(20, 20, 20);
                    app.root.addChild(lightOmni);
                    // create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        fov: 100,
                        layers: [worldLayer.id, excludedLayer.id],
                        farClip: 1500
                    });
                    camera.setLocalPosition(270, 90, -260);
                    // add orbit camera script with a mouse and a touch support
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            distanceMax: 390,
                            frameOnStart: false
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    // create a probe object with cubemapRenderer script which takes care of rendering dynamic cubemap
                    var probe = new pc__namespace.Entity();
                    probe.addComponent('script');
                    // add camera component to the probe - this defines camera properties for cubemap rendering
                    probe.addComponent('camera', {
                        // optimization - no need to clear as all pixels get overwritten
                        clearColorBuffer: false,
                        // priority - render before world camera
                        priority: -1,
                        // only render meshes on the worldLayer (and not excluded layer)
                        layers: [worldLayer.id],
                        // disable as this is not a camera that renders cube map but only a container for properties for cube map rendering
                        enabled: false,
                        nearClip: 1,
                        farClip: 500
                    });
                    // Add a cubemap renderer script, which renders to a cubemap of size 128 with mipmaps, which is directly useable
                    // as a lighting source for envAtlas generation
                    // Position it in the center of the room.
                    probe.script.create('cubemapRenderer', {
                        attributes: {
                            resolution: 128,
                            mipmaps: true,
                            depth: true
                        }
                    });
                    probe.setPosition(0, 200, 0);
                    app.root.addChild(probe);
                    // handle onCubemapPostRender event fired by the cubemapRenderer when all faces of the cubemap are done rendering
                    probe.on('onCubemapPostRender', function () {
                        // prefilter just rendered cubemap into envAtlas, so that it can be used for reflection during the rest of the frame
                        // @ts-ignore
                        pc__namespace.EnvLighting.generateAtlas(probe.script.cubemapRenderer.cubeMap, {
                            target: envAtlas
                        });
                    });
                    // Set an update function on the app's update event
                    var time = 0;
                    var updateProbeCount = 1;
                    var updateVideo = true;
                    app.on("update", function (dt) {
                        time += dt * 0.3;
                        // Update the video data to the texture every other frame
                        if (updateVideo && videoTexture) {
                            videoTexture.upload();
                        }
                        updateVideo = !updateVideo;
                        // move the light around
                        lightOmni.setLocalPosition(300 * Math.sin(time), 300, 300 * Math.cos(time));
                        // update the reflection probe as needed
                        var updateFrequency = data.get('settings.updateFrequency');
                        updateProbeCount--;
                        if (updateFrequency === 0)
                            updateProbeCount = 1;
                        if (updateProbeCount <= 0) {
                            // enable probe rendering
                            probe.enabled = true;
                            updateProbeCount = updateFrequency;
                        }
                        else {
                            probe.enabled = false;
                        }
                        // update material properties based on settings
                        var gloss = data.get('settings.gloss');
                        var metalness = data.get('settings.metalness');
                        var bumpiness = data.get('settings.bumpiness');
                        var reflectivity = data.get('settings.reflectivity');
                        roomMaterial.gloss = gloss;
                        roomMaterial.metalness = metalness;
                        roomMaterial.bumpiness = bumpiness;
                        roomMaterial.reflectivity = reflectivity;
                        roomMaterial.update();
                        sphereMaterial.gloss = gloss;
                        sphereMaterial.metalness = metalness;
                        sphereMaterial.bumpiness = bumpiness;
                        sphereMaterial.reflectivity = reflectivity;
                        sphereMaterial.update();
                    });
                });
            });
        };
        ReflectionBoxExample.CATEGORY = 'Graphics';
        ReflectionBoxExample.NAME = 'Reflection Box';
        ReflectionBoxExample.WEBGPU_ENABLED = true;
        return ReflectionBoxExample;
    }());

    var AreaLightsExample = /** @class */ (function () {
        function AreaLightsExample() {
        }
        AreaLightsExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Material' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Gloss' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.material.gloss' }, min: 0, max: 1, precision: 2 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Metalness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.material.metalness' }, min: 0, max: 1, precision: 2 }))));
        };
        AreaLightsExample.prototype.example = function (canvas, deviceType, data) {
            data.set('settings', {
                material: {
                    gloss: 0.8,
                    metalness: 0.7
                }
            });
            var assets = {
                'bloom': new pc__namespace.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' }),
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                'color': new pc__namespace.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.jpg' }),
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/seaside-rocks01-normal.jpg' }),
                'gloss': new pc__namespace.Asset('gloss', 'texture', { url: '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
                'luts': new pc__namespace.Asset('luts', 'json', { url: '/static/assets/json/area-light-luts.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.JsonHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // set up some general scene rendering properties
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // enabled clustered lighting. This is a temporary API and will change in the future
                    app.scene.clusteredLightingEnabled = true;
                    // adjust default clustered lighting parameters to handle many lights
                    var lighting = app.scene.lighting;
                    // 1) subdivide space with lights into this many cells
                    lighting.cells = new pc__namespace.Vec3(30, 2, 30);
                    // 2) and allow this many lights per cell
                    lighting.maxLightsPerCell = 20;
                    lighting.areaLightsEnabled = true;
                    lighting.shadowsEnabled = false;
                    // pure black material - used on back side of light objects
                    var blackMaterial = new pc__namespace.StandardMaterial();
                    blackMaterial.diffuse = new pc__namespace.Color(0, 0, 0);
                    blackMaterial.useLighting = false;
                    blackMaterial.update();
                    // ground material
                    var groundMaterial = new pc__namespace.StandardMaterial();
                    groundMaterial.diffuse = pc__namespace.Color.GRAY;
                    groundMaterial.gloss = 0.8;
                    groundMaterial.metalness = 0.7;
                    groundMaterial.useMetalness = true;
                    // helper function to create a primitive with shape type, position, scale, color
                    function createPrimitive(primitiveType, position, scale, assetManifest) {
                        if (assetManifest) {
                            groundMaterial.diffuseMap = assetManifest.color.resource;
                            groundMaterial.normalMap = assetManifest.normal.resource;
                            groundMaterial.glossMap = assetManifest.gloss.resource;
                            groundMaterial.diffuseMapTiling.set(17, 17);
                            groundMaterial.normalMapTiling.set(17, 17);
                            groundMaterial.glossMapTiling.set(17, 17);
                        }
                        groundMaterial.update();
                        // create primitive
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            material: groundMaterial
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // helper function to create area light including its visual representation in the world
                    function createAreaLight(type, shape, position, scale, color, intensity, range) {
                        var light = new pc__namespace.Entity();
                        light.addComponent("light", {
                            type: type,
                            shape: shape,
                            color: color,
                            intensity: intensity,
                            falloffMode: pc__namespace.LIGHTFALLOFF_INVERSESQUARED,
                            range: range,
                            innerConeAngle: 88,
                            outerConeAngle: 89
                        });
                        light.setLocalScale(scale);
                        light.setLocalPosition(position);
                        if (type === "spot") {
                            light.rotate(-90, 0, 0);
                        }
                        app.root.addChild(light);
                        // emissive material that is the light source color
                        var brightMaterial = new pc__namespace.StandardMaterial();
                        brightMaterial.emissive = new pc__namespace.Color(color.r * 0.8, color.g * 0.8, color.b * 0.8);
                        brightMaterial.useLighting = false;
                        brightMaterial.update();
                        // primitive shape that matches light source shape
                        var lightPrimitive = (shape === pc__namespace.LIGHTSHAPE_SPHERE) ? "sphere" : (shape === pc__namespace.LIGHTSHAPE_DISK) ? "cylinder" : "box";
                        // primitive scale - flatten it to disk / rectangle
                        var primitiveScale = new pc__namespace.Vec3(1, shape !== pc__namespace.LIGHTSHAPE_SPHERE ? 0.001 : 1, 1);
                        // bright primitive representing the area light source
                        var brightShape = new pc__namespace.Entity();
                        brightShape.addComponent("render", {
                            type: lightPrimitive,
                            material: brightMaterial
                        });
                        brightShape.setLocalScale(primitiveScale);
                        light.addChild(brightShape);
                        // black primitive representing the back of the light source which is not emitting light
                        if (type === "spot") {
                            var blackShape = new pc__namespace.Entity();
                            blackShape.addComponent("render", {
                                type: lightPrimitive,
                                material: blackMaterial
                            });
                            blackShape.setLocalPosition(0, 0.004, 0);
                            blackShape.setLocalEulerAngles(-180, 0, 0);
                            blackShape.setLocalScale(primitiveScale);
                            light.addChild(blackShape);
                        }
                        return light;
                    }
                    // set the loaded area light LUT data
                    var luts = assets.luts.resource;
                    app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);
                    // set up some general scene rendering properties
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // create ground plane
                    var ground = createPrimitive("plane", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(45, 1, 45), assets);
                    // Create the camera, which renders entities
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1),
                        fov: 60,
                        farClip: 1000
                    });
                    camera.setLocalPosition(3, 3, 12);
                    // add orbit camera script with a mouse and a touch support
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: ground,
                            distanceMax: 60,
                            frameOnStart: false
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    // add bloom postprocessing
                    camera.script.create("bloom", {
                        attributes: {
                            bloomIntensity: 1.5,
                            bloomThreshold: 0.6,
                            blurAmount: 6
                        }
                    });
                    // generate a grid of area lights of sphere, disk and rect shapes
                    for (var x = -20; x <= 20; x += 5) {
                        for (var y = -20; y <= 20; y += 5) {
                            var pos = new pc__namespace.Vec3(x, 0.6, y);
                            var color = new pc__namespace.Color(0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7);
                            var rand = Math.random();
                            if (rand < 0.3) {
                                createAreaLight("omni", pc__namespace.LIGHTSHAPE_SPHERE, pos, new pc__namespace.Vec3(1.5, 1.5, 1.5), color, 2, 6);
                            }
                            else if (rand < 0.6) {
                                createAreaLight("spot", pc__namespace.LIGHTSHAPE_DISK, pos, new pc__namespace.Vec3(1.5, 1.5, 1.5), color, 2.5, 5);
                            }
                            else {
                                createAreaLight("spot", pc__namespace.LIGHTSHAPE_RECT, pos, new pc__namespace.Vec3(2, 1, 1), color, 2.5, 5);
                            }
                        }
                    }
                    // handle HUD changes - update properties on the material
                    data.on('*:set', function (path, value) {
                        var pathArray = path.split('.');
                        if (pathArray[2] === "gloss")
                            groundMaterial.gloss = value;
                        if (pathArray[2] === "metalness")
                            groundMaterial.metalness = value;
                        groundMaterial.update();
                    });
                });
            });
        };
        AreaLightsExample.CATEGORY = 'Graphics';
        AreaLightsExample.NAME = 'Clustered Area Lights';
        AreaLightsExample.WEBGPU_ENABLED = true;
        return AreaLightsExample;
    }());

    var ClusteredLightingExample = /** @class */ (function () {
        function ClusteredLightingExample() {
        }
        ClusteredLightingExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/normal-map.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    var pointLightList = [];
                    var spotLightList = [];
                    var dirLight = null;
                    // enabled clustered lighting. This is a temporary API and will change in the future
                    app.scene.clusteredLightingEnabled = true;
                    // adjust default clustered lighting parameters to handle many lights
                    var lighting = app.scene.lighting;
                    // 1) subdivide space with lights into this many cells
                    lighting.cells = new pc__namespace.Vec3(12, 16, 12);
                    // 2) and allow this many lights per cell
                    lighting.maxLightsPerCell = 48;
                    lighting.shadowsEnabled = false;
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // material with tiled normal map
                    var material = new pc__namespace.StandardMaterial();
                    material.normalMap = assets.normal.resource;
                    material.normalMapTiling.set(5, 5);
                    material.bumpiness = 1;
                    // enable specular
                    material.gloss = 0.5;
                    material.metalness = 0.3;
                    material.useMetalness = true;
                    material.update();
                    // ground plane
                    var ground = new pc__namespace.Entity();
                    ground.addComponent('render', {
                        type: "plane",
                        material: material
                    });
                    ground.setLocalScale(150, 150, 150);
                    app.root.addChild(ground);
                    // high polycount cylinder
                    var cylinderMesh = pc__namespace.createCylinder(app.graphicsDevice, { capSegments: 200 });
                    var cylinder = new pc__namespace.Entity();
                    cylinder.addComponent('render', {
                        material: material,
                        meshInstances: [new pc__namespace.MeshInstance(cylinderMesh, material)],
                        castShadows: true
                    });
                    app.root.addChild(cylinder);
                    cylinder.setLocalPosition(0, 50, 0);
                    cylinder.setLocalScale(50, 100, 50);
                    // create many omni lights that do not cast shadows
                    var count = 30;
                    for (var i = 0; i < count; i++) {
                        var color = new pc__namespace.Color(Math.random(), Math.random(), Math.random(), 1);
                        var lightPoint = new pc__namespace.Entity();
                        lightPoint.addComponent("light", {
                            type: "omni",
                            color: color,
                            range: 12,
                            castShadows: false,
                            falloffMode: pc__namespace.LIGHTFALLOFF_INVERSESQUARED
                        });
                        // attach a render component with a small sphere to each light
                        var material_1 = new pc__namespace.StandardMaterial();
                        material_1.emissive = color;
                        material_1.update();
                        lightPoint.addComponent('render', {
                            type: "sphere",
                            material: material_1,
                            castShadows: true
                        });
                        lightPoint.setLocalScale(5, 5, 5);
                        // add it to the scene and also keep it in an array
                        app.root.addChild(lightPoint);
                        pointLightList.push(lightPoint);
                    }
                    // create many spot lights
                    count = 16;
                    for (var i = 0; i < count; i++) {
                        var color = new pc__namespace.Color(Math.random(), Math.random(), Math.random(), 1);
                        var lightSpot = new pc__namespace.Entity();
                        lightSpot.addComponent("light", {
                            type: "spot",
                            color: color,
                            innerConeAngle: 5,
                            outerConeAngle: 6 + Math.random() * 40,
                            range: 25,
                            castShadows: false
                        });
                        // attach a render component with a small cone to each light
                        material = new pc__namespace.StandardMaterial();
                        material.emissive = color;
                        material.update();
                        lightSpot.addComponent('render', {
                            type: "cone",
                            material: material
                        });
                        lightSpot.setLocalScale(5, 5, 5);
                        lightSpot.setLocalPosition(100, 50, 70);
                        lightSpot.lookAt(new pc__namespace.Vec3(100, 60, 70));
                        app.root.addChild(lightSpot);
                        spotLightList.push(lightSpot);
                    }
                    // Create a single directional light which casts shadows
                    dirLight = new pc__namespace.Entity();
                    dirLight.addComponent("light", {
                        type: "directional",
                        color: pc__namespace.Color.WHITE,
                        intensity: 0.15,
                        range: 300,
                        shadowDistance: 600,
                        castShadows: true,
                        shadowBias: 0.2,
                        normalOffsetBias: 0.05
                    });
                    app.root.addChild(dirLight);
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.05, 0.05, 0.05),
                        farClip: 500,
                        nearClip: 0.1
                    });
                    camera.setLocalPosition(140, 140, 140);
                    camera.lookAt(new pc__namespace.Vec3(0, 40, 0));
                    // add orbit camera script with mouse and touch support
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: app.root,
                            distanceMax: 400,
                            frameOnStart: false
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    // Set an update function on the app's update event
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // move lights along sin based waves around the cylinder
                        pointLightList.forEach(function (light, i) {
                            var angle = (i / pointLightList.length) * Math.PI * 2;
                            var y = Math.sin(time * 0.5 + 7 * angle) * 30 + 70;
                            light.setLocalPosition(30 * Math.sin(angle), y, 30 * Math.cos(angle));
                        });
                        // rotate spot lights around
                        spotLightList.forEach(function (spotlight, i) {
                            var angle = (i / spotLightList.length) * Math.PI * 2;
                            spotlight.setLocalPosition(40 * Math.sin(time + angle), 5, 40 * Math.cos(time + angle));
                            spotlight.lookAt(pc__namespace.Vec3.ZERO);
                            spotlight.rotateLocal(90, 0, 0);
                        });
                        // rotate directional light
                        if (dirLight) {
                            dirLight.setLocalEulerAngles(25, -30 * time, 0);
                        }
                    });
                });
            });
        };
        ClusteredLightingExample.CATEGORY = 'Graphics';
        ClusteredLightingExample.NAME = 'Clustered Lighting';
        ClusteredLightingExample.ENGINE = 'PERFORMANCE';
        ClusteredLightingExample.WEBGPU_ENABLED = true;
        return ClusteredLightingExample;
    }());

    var ClusteredOmniShadowsExample = /** @class */ (function () {
        function ClusteredOmniShadowsExample() {
        }
        ClusteredOmniShadowsExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Settings' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Filter' },
                        React__default["default"].createElement(react.SelectInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.shadowType' }, type: "number", options: [
                                { v: pc__namespace.SHADOW_PCF1, t: 'PCF1' },
                                { v: pc__namespace.SHADOW_PCF3, t: 'PCF3' },
                                { v: pc__namespace.SHADOW_PCF5, t: 'PCF5' }
                            ] })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Shadow Res' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.shadowAtlasResolution' }, min: 512, max: 4096, precision: 0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Shadows On' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.shadowsEnabled' }, value: data.get('settings.shadowsEnabled') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Cookies On' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.cookiesEnabled' }, value: data.get('settings.cookiesEnabled') }))));
        };
        ClusteredOmniShadowsExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/normal-map.png' }),
                "xmas_negx": new pc__namespace.Asset("xmas_negx", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_negx.png" }),
                "xmas_negy": new pc__namespace.Asset("xmas_negy", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_negy.png" }),
                "xmas_negz": new pc__namespace.Asset("xmas_negz", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_negz.png" }),
                "xmas_posx": new pc__namespace.Asset("xmas_posx", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_posx.png" }),
                "xmas_posy": new pc__namespace.Asset("xmas_posy", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_posy.png" }),
                "xmas_posz": new pc__namespace.Asset("xmas_posz", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_posz.png" })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.CubemapHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // set up some general scene rendering properties
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    data.set('settings', {
                        shadowAtlasResolution: 1300,
                        shadowType: pc__namespace.SHADOW_PCF3,
                        shadowsEnabled: true,
                        cookiesEnabled: true
                    });
                    // enabled clustered lighting. This is a temporary API and will change in the future
                    app.scene.clusteredLightingEnabled = true;
                    // adjust default clustered lighting parameters to handle many lights
                    var lighting = app.scene.lighting;
                    // 1) subdivide space with lights into this many cells
                    lighting.cells = new pc__namespace.Vec3(16, 12, 16);
                    // 2) and allow this many lights per cell
                    lighting.maxLightsPerCell = 12;
                    // enable clustered shadows (it's enabled by default as well)
                    lighting.shadowsEnabled = true;
                    // enable clustered cookies
                    lighting.cookiesEnabled = true;
                    // resolution of the shadow and cookie atlas
                    lighting.shadowAtlasResolution = data.get('settings.shadowAtlasResolution');
                    lighting.cookieAtlasResolution = 2048;
                    // helper function to create a 3d primitive including its material
                    function createPrimitive(primitiveType, position, scale) {
                        // create a material
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = new pc__namespace.Color(0.7, 0.7, 0.7);
                        // normal map
                        material.normalMap = assets.normal.resource;
                        material.normalMapTiling.set(5, 5);
                        material.bumpiness = 0.7;
                        // enable specular
                        material.gloss = 0.4;
                        material.metalness = 0.3;
                        material.useMetalness = true;
                        material.update();
                        // create the primitive using the material
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            material: material
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // create the ground plane from the boxes
                    createPrimitive("box", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(800, 2, 800));
                    createPrimitive("box", new pc__namespace.Vec3(0, 400, 0), new pc__namespace.Vec3(800, 2, 800));
                    // walls
                    createPrimitive("box", new pc__namespace.Vec3(400, 200, 0), new pc__namespace.Vec3(2, 400, 800));
                    createPrimitive("box", new pc__namespace.Vec3(-400, 200, 0), new pc__namespace.Vec3(2, 400, 800));
                    createPrimitive("box", new pc__namespace.Vec3(0, 200, 400), new pc__namespace.Vec3(800, 400, 0));
                    createPrimitive("box", new pc__namespace.Vec3(0, 200, -400), new pc__namespace.Vec3(800, 400, 0));
                    var numTowers = 7;
                    for (var i = 0; i < numTowers; i++) {
                        var scale = 25;
                        var fraction = i / numTowers * Math.PI * 2;
                        var radius = (i % 2) ? 340 : 210;
                        for (var y = 0; y <= 7; y++) {
                            var prim = createPrimitive("box", new pc__namespace.Vec3(radius * Math.sin(fraction), 2 + y * 25, radius * Math.cos(fraction)), new pc__namespace.Vec3(scale, scale, scale));
                            prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
                        }
                        scale -= 1.5;
                    }
                    // construct the cubemap asset for the omni light cookie texture
                    // Note: the textures array could contain 6 texture asset names to load instead as well
                    var cubemapAsset = new pc__namespace.Asset('xmas_cubemap', 'cubemap', null, {
                        textures: [
                            assets.xmas_posx.id, assets.xmas_negx.id,
                            assets.xmas_posy.id, assets.xmas_negy.id,
                            assets.xmas_posz.id, assets.xmas_negz.id
                        ],
                        // don't generate mipmaps for the cookie cubemap if clustered lighting is used,
                        // as only top levels are copied to the cookie atlas.
                        mipmaps: !app.scene.clusteredLightingEnabled
                    });
                    cubemapAsset.loadFaces = true;
                    app.assets.add(cubemapAsset);
                    var omniLights = [];
                    var numLights = 10;
                    for (var i = 0; i < numLights; i++) {
                        var lightOmni = new pc__namespace.Entity("Omni");
                        lightOmni.addComponent("light", {
                            type: "omni",
                            color: pc__namespace.Color.WHITE,
                            intensity: 10 / numLights,
                            range: 350,
                            castShadows: true,
                            shadowBias: 0.2,
                            normalOffsetBias: 0.2,
                            // cookie texture
                            cookieAsset: cubemapAsset,
                            cookieChannel: "rgb"
                        });
                        // attach a render component with a small sphere to it
                        var material = new pc__namespace.StandardMaterial();
                        material.emissive = pc__namespace.Color.WHITE;
                        material.update();
                        lightOmni.addComponent('render', {
                            type: "sphere",
                            material: material,
                            castShadows: false
                        });
                        lightOmni.setPosition(0, 120, 0);
                        lightOmni.setLocalScale(5, 5, 5);
                        app.root.addChild(lightOmni);
                        omniLights.push(lightOmni);
                    }
                    // create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        fov: 80,
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1),
                        farClip: 1500
                    });
                    // and position it in the world
                    camera.setLocalPosition(300, 120, 25);
                    // add orbit camera script with a mouse and a touch support
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: app.root,
                            distanceMax: 1200,
                            frameOnStart: false
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    // handle HUD changes - update properties on the scene
                    data.on('*:set', function (path, value) {
                        var pathArray = path.split('.');
                        // @ts-ignore
                        lighting[pathArray[1]] = value;
                    });
                    // Set an update function on the app's update event
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt * 0.3;
                        var radius = 250;
                        for (var i = 0; i < omniLights.length; i++) {
                            var fraction = i / omniLights.length * Math.PI * 2;
                            omniLights[i].setPosition(radius * Math.sin(time + fraction), 190 + Math.sin(time + fraction) * 150, radius * Math.cos(time + fraction));
                        }
                        // display shadow texture (debug feature)
                        if (app.graphicsDevice.isWebGPU) {
                            // @ts-ignore engine-tsd
                            app.drawTexture(-0.7, -0.7, 0.5, 0.5, app.renderer.lightTextureAtlas.shadowAtlas.texture, undefined, undefined, false);
                        }
                    });
                });
            });
        };
        ClusteredOmniShadowsExample.CATEGORY = 'Graphics';
        ClusteredOmniShadowsExample.NAME = 'Clustered Omni Shadows';
        return ClusteredOmniShadowsExample;
    }());

    var ClusteredSpotShadowsExample = /** @class */ (function () {
        function ClusteredSpotShadowsExample() {
        }
        ClusteredSpotShadowsExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Atlas' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Resolution' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.shadowAtlasResolution' }, min: 256, max: 4096, precision: 0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Split' },
                        React__default["default"].createElement(react.SelectInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.atlasSplit' }, type: "number", options: [
                                { v: 0, t: 'Automatic' },
                                { v: 1, t: '7 Shadows' },
                                { v: 2, t: '12 Shadows' },
                                { v: 3, t: '16 Shadows' }
                            ] })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Filter' },
                        React__default["default"].createElement(react.SelectInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.shadowType' }, type: "number", options: [
                                { v: pc__namespace.SHADOW_PCF1, t: 'PCF1' },
                                { v: pc__namespace.SHADOW_PCF3, t: 'PCF3' },
                                { v: pc__namespace.SHADOW_PCF5, t: 'PCF5' }
                            ] }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Lights' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Shadows On' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.shadowsEnabled' }, value: data.get('settings.shadowsEnabled') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Cookies On' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.cookiesEnabled' }, value: data.get('settings.cookiesEnabled') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Static' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.static' }, value: data.get('settings.static') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Shadow Intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.shadowIntensity' }, min: 0, max: 1, value: data.get('settings.shadowIntensity') })),
                    React__default["default"].createElement(react.Button, { text: 'Add Light', onClick: function () { return data.emit('add'); } }),
                    React__default["default"].createElement(react.Button, { text: 'Remove Light', onClick: function () { return data.emit('remove'); } }),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Light Count' },
                        React__default["default"].createElement(react.Label, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.numLights' }, value: data.get('settings.numLights') }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Debug' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Cells' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.debug' }, value: data.get('settings.debug') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Atlas' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.debugAtlas' }, value: data.get('settings.debugAtlas') }))));
        };
        ClusteredSpotShadowsExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                "channels": new pc__namespace.Asset("channels", "texture", { url: "/static/assets/textures/channels.png" }),
                "heart": new pc__namespace.Asset("heart", "texture", { url: "/static/assets/textures/heart.png" }),
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/normal-map.png' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    data.set('settings', {
                        shadowAtlasResolution: 1024,
                        shadowType: pc__namespace.SHADOW_PCF3,
                        shadowsEnabled: true,
                        cookiesEnabled: true,
                        shadowIntensity: 1,
                        numLights: 0,
                        debug: false,
                        debugAtlas: false,
                        splitOptions: 0,
                        static: false
                    });
                    // setup skydome as ambient light
                    app.scene.skyboxMip = 3;
                    app.scene.skyboxIntensity = 0.1;
                    app.scene.envAtlas = assets.helipad.resource;
                    // enabled clustered lighting. This is a temporary API and will change in the future
                    app.scene.clusteredLightingEnabled = true;
                    // adjust default clustered lighting parameters to handle many lights
                    var lighting = app.scene.lighting;
                    // 1) subdivide space with lights into this many cells
                    lighting.cells = new pc__namespace.Vec3(12, 4, 12);
                    // 2) and allow this many lights per cell
                    var maxLights = 24;
                    lighting.maxLightsPerCell = maxLights;
                    // enable clustered shadows (it's enabled by default as well)
                    lighting.shadowsEnabled = data.get('settings.shadowsEnabled');
                    // enable clustered cookies
                    lighting.cookiesEnabled = data.get('settings.cookiesEnabled');
                    // resolution of the shadow and cookie atlas
                    lighting.shadowAtlasResolution = data.get('settings.shadowAtlasResolution');
                    lighting.cookieAtlasResolution = 1500;
                    var splitOptions = [
                        null,
                        [2, 1, 1, 2, 1],
                        [3, 2],
                        [4] // 16 shadows: split atlas to 4x4
                    ];
                    // lights are static (not moving and so do not need to update shadows) or dynamic
                    var lightsStatic = false;
                    // debug rendering is enabled
                    var debugAtlas = false;
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // ground material
                    var groundMaterial = new pc__namespace.StandardMaterial();
                    groundMaterial.gloss = 0.55;
                    groundMaterial.metalness = 0.4;
                    groundMaterial.useMetalness = true;
                    groundMaterial.normalMap = assets.normal.resource;
                    groundMaterial.normalMapTiling.set(10, 10);
                    groundMaterial.bumpiness = 0.5;
                    groundMaterial.update();
                    // cube material
                    var cubeMaterial = new pc__namespace.StandardMaterial();
                    cubeMaterial.gloss = 0.55;
                    cubeMaterial.metalness = 0.4;
                    cubeMaterial.useMetalness = true;
                    cubeMaterial.normalMap = assets.normal.resource;
                    cubeMaterial.normalMapTiling.set(0.25, 0.25);
                    cubeMaterial.bumpiness = 0.5;
                    cubeMaterial.update();
                    // helper function to create a 3d primitive including its material
                    function createPrimitive(primitiveType, position, scale, mat) {
                        // create the primitive using the material
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            castShadows: true,
                            material: mat
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // create some visible geometry
                    var ground = createPrimitive("box", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(500, 1, 500), groundMaterial);
                    var numTowers = 8;
                    for (var i = 0; i < numTowers; i++) {
                        var scale = 12;
                        var fraction = i / numTowers * Math.PI * 2;
                        var radius = 200;
                        var numCubes = 12;
                        for (var y = 0; y <= 10; y++) {
                            var elevationRadius = radius * (1 - (y / numCubes));
                            var pos = new pc__namespace.Vec3(elevationRadius * Math.sin(fraction), y * 6, elevationRadius * Math.cos(fraction));
                            var prim = createPrimitive("box", pos, new pc__namespace.Vec3(scale, scale, scale), cubeMaterial);
                            prim.setLocalEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
                        }
                        scale -= 1.5;
                    }
                    var spotLightList = [];
                    var cookieChannels = ["r", "g", "b", "a", "rgb"];
                    // helper function to create a light
                    function createLight(index) {
                        var intensity = 1.5;
                        var color = new pc__namespace.Color(intensity * Math.random(), intensity * Math.random(), intensity * Math.random(), 1);
                        var lightSpot = new pc__namespace.Entity("Spot-".concat(index));
                        var heartTexture = Math.random() < 0.5;
                        var cookieTexture = heartTexture ? assets.heart : assets.channels;
                        var cookieChannel = heartTexture ? "a" : cookieChannels[Math.floor(Math.random() * cookieChannels.length)];
                        lightSpot.addComponent("light", {
                            type: "spot",
                            color: color,
                            intensity: 3,
                            innerConeAngle: 30,
                            outerConeAngle: 35,
                            range: 150,
                            castShadows: true,
                            shadowBias: 0.4,
                            normalOffsetBias: 0.1,
                            shadowResolution: 512,
                            // when lights are static, only render shadows one time (or as needed when they use different atlas slot)
                            shadowUpdateMode: lightsStatic ? pc__namespace.SHADOWUPDATE_THISFRAME : pc__namespace.SHADOWUPDATE_REALTIME,
                            // cookie texture
                            cookie: cookieTexture.resource,
                            cookieChannel: cookieChannel,
                            cookieIntensity: 0.5
                        });
                        // attach a render component with a small cone to each light
                        var material = new pc__namespace.StandardMaterial();
                        material.emissive = color;
                        material.update();
                        lightSpot.addComponent('render', {
                            type: "cone",
                            material: material,
                            castShadows: false
                        });
                        lightSpot.setLocalScale(5, 5, 5);
                        app.root.addChild(lightSpot);
                        spotLightList.push(lightSpot);
                    }
                    // create many spot lights
                    var count = 10;
                    for (var i = 0; i < count; i++) {
                        createLight(i);
                    }
                    updateLightCount();
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.2, 0.2, 0.2),
                        farClip: 2000,
                        nearClip: 1
                    });
                    app.root.addChild(camera);
                    camera.setLocalPosition(300 * Math.sin(0), 150, 300 * Math.cos(0));
                    // add orbit camera script with mouse and touch support
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: ground,
                            distanceMax: 1200,
                            frameOnStart: false
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    // handle HUD changes - update properties on the scene
                    data.on('*:set', function (path, value) {
                        var pathArray = path.split('.');
                        if (pathArray[1] === 'static') {
                            lightsStatic = value;
                            updateLightCount();
                        }
                        else if (pathArray[1] === 'atlasSplit') {
                            // assign atlas split option
                            lighting.atlasSplit = splitOptions[value];
                        }
                        else if (pathArray[1] === 'debug') {
                            // debug rendering of lighting clusters on world layer
                            lighting.debugLayer = value ? app.scene.layers.getLayerByName("World").id : undefined;
                        }
                        else if (pathArray[1] === 'debugAtlas') {
                            // show debug atlas
                            debugAtlas = value;
                        }
                        else if (pathArray[1] === 'shadowIntensity') {
                            for (var i = 0; i < spotLightList.length; i++) {
                                spotLightList[i].light.shadowIntensity = value;
                            }
                        }
                        else {
                            // @ts-ignore
                            lighting[pathArray[1]] = value;
                        }
                    });
                    function updateLightCount() {
                        // update the number on HUD
                        data.set('settings.numLights', spotLightList.length);
                        // shadow update mode (need to force render shadow when we add / remove light, as they all move)
                        spotLightList.forEach(function (spot) {
                            spot.light.shadowUpdateMode = lightsStatic ? pc__namespace.SHADOWUPDATE_THISFRAME : pc__namespace.SHADOWUPDATE_REALTIME;
                        });
                    }
                    // add light button handler
                    data.on('add', function () {
                        if (spotLightList.length < maxLights) {
                            createLight(spotLightList.length);
                            updateLightCount();
                        }
                    });
                    // remove light button handler
                    data.on('remove', function () {
                        if (spotLightList.length) {
                            var light = spotLightList.pop();
                            app.root.removeChild(light);
                            light.destroy();
                            updateLightCount();
                        }
                    });
                    // Set an update function on the app's update event
                    var time = 0;
                    app.on("update", function (dt) {
                        // don't move lights around when they're static
                        if (!lightsStatic) {
                            time += dt * 0.15;
                        }
                        // rotate spot lights around
                        var lightPos = new pc__namespace.Vec3();
                        spotLightList.forEach(function (spotlight, i) {
                            var angle = (i / spotLightList.length) * Math.PI * 2;
                            var x = 130 * Math.sin(angle + time);
                            var z = 130 * Math.cos(angle + time);
                            lightPos.set(x, 100, z);
                            spotlight.setLocalPosition(lightPos);
                            lightPos.y = 0;
                            spotlight.lookAt(lightPos, pc__namespace.Vec3.RIGHT);
                            spotlight.rotateLocal(90, 0, 0);
                        });
                        // display shadow texture (debug feature, only works when depth is stored as color, which is webgl1)
                        // app.drawTexture(-0.7, 0.7, 0.4, 0.4, app.renderer.lightTextureAtlas.shadowAtlas.texture);
                        // display cookie texture (debug feature)
                        if (debugAtlas) {
                            // @ts-ignore engine-tsd
                            app.drawTexture(-0.7, 0.2, 0.4, 0.4, app.renderer.lightTextureAtlas.cookieAtlas);
                        }
                    });
                });
            });
        };
        ClusteredSpotShadowsExample.CATEGORY = 'Graphics';
        ClusteredSpotShadowsExample.NAME = 'Clustered Spot Shadows';
        ClusteredSpotShadowsExample.ENGINE = 'DEBUG';
        ClusteredSpotShadowsExample.WEBGPU_ENABLED = true;
        return ClusteredSpotShadowsExample;
    }());

    var ContactHardeningShadowsExample = /** @class */ (function () {
        function ContactHardeningShadowsExample() {
        }
        ContactHardeningShadowsExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Area light' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Enabled' },
                        React__default["default"].createElement(react.BooleanInput, { id: 'area-light', binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.area.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.area.intensity' }, min: 0.0, max: 32.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Softness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.area.size' }, min: 0.1, max: 35.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Shadows' },
                        React__default["default"].createElement(react.SelectInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.area.shadowType' }, options: [{ v: pc__namespace.SHADOW_PCSS, t: 'PCSS' }, { v: pc__namespace.SHADOW_PCF5, t: 'PCF' }] }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Point light' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Enabled' },
                        React__default["default"].createElement(react.BooleanInput, { id: 'point-light', binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.point.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.point.intensity' }, min: 0.0, max: 32.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Softness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.point.size' }, min: 0.1, max: 35.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Shadows' },
                        React__default["default"].createElement(react.SelectInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.point.shadowType' }, options: [{ v: pc__namespace.SHADOW_PCSS, t: 'PCSS' }, { v: pc__namespace.SHADOW_PCF5, t: 'PCF' }] }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Directional light' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Enabled' },
                        React__default["default"].createElement(react.BooleanInput, { id: 'directional-light', binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.directional.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.directional.intensity' }, min: 0.0, max: 32.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Softness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.directional.size' }, min: 0.1, max: 35.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Shadows' },
                        React__default["default"].createElement(react.SelectInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.directional.shadowType' }, options: [{ v: pc__namespace.SHADOW_PCSS, t: 'PCSS' }, { v: pc__namespace.SHADOW_PCF5, t: 'PCF' }] }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Animate' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Cycle Active Light' },
                        React__default["default"].createElement(react.BooleanInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.cycle' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Animate Lights' },
                        React__default["default"].createElement(react.BooleanInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.animate' } }))));
        };
        ContactHardeningShadowsExample.prototype.example = function (canvas, deviceType, data) {
            pc__namespace.WasmModule.setConfig('DracoDecoderModule', {
                glueUrl: '/static/lib/draco/draco.wasm.js',
                wasmUrl: '/static/lib/draco/draco.wasm.wasm',
                fallbackUrl: '/static/lib/draco/draco.js'
            });
            pc__namespace.WasmModule.getInstance('DracoDecoderModule', demo);
            function demo() {
                var assets = {
                    orbitCamera: new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                    helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP }),
                    cube: new pc__namespace.Asset('cube', 'container', { url: '/static/assets/models/playcanvas-cube.glb' }),
                    luts: new pc__namespace.Asset('luts', 'json', { url: '/static/assets/json/area-light-luts.json' }),
                    asset: new pc__namespace.Asset('asset', 'container', { url: '/static/assets/models/old_tree.glb' })
                };
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                    createOptions.mouse = new pc__namespace.Mouse(document.body);
                    createOptions.touch = new pc__namespace.TouchDevice(document.body);
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.RenderComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem,
                        // @ts-ignore
                        pc__namespace.ScriptComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler,
                        // @ts-ignore
                        pc__namespace.ScriptHandler,
                        // @ts-ignore
                        pc__namespace.JsonHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                    assetListLoader.load(function () {
                        app.start();
                        app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                        app.scene.skyboxMip = 1;
                        app.scene.ambientLight.set(0, 0, 0);
                        app.scene.ambientLuminance = 0;
                        app.scene.setSkybox(assets.helipad.resources);
                        // enable area lights which are disabled by default for clustered lighting
                        app.scene.clusteredLightingEnabled = false;
                        app.scene.skyboxIntensity = 0.1;
                        // set the loaded area light LUT data
                        var luts = assets.luts.resource;
                        app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);
                        var planeMaterial = new pc__namespace.StandardMaterial();
                        planeMaterial.gloss = 0.0;
                        planeMaterial.metalness = 0.7;
                        planeMaterial.useMetalness = true;
                        planeMaterial.update();
                        var plane = new pc__namespace.Entity();
                        plane.addComponent('render', {
                            type: 'plane',
                            material: planeMaterial
                        });
                        plane.setLocalScale(new pc__namespace.Vec3(100, 0, 100));
                        plane.setLocalPosition(0, -1.0, 0);
                        app.root.addChild(plane);
                        data.set('script', {
                            cycle: true,
                            animate: true,
                            area: {
                                enabled: true,
                                intensity: 16.0,
                                size: 8,
                                shadowType: pc__namespace.SHADOW_PCSS
                            },
                            point: {
                                enabled: true,
                                intensity: 4.0,
                                size: 8,
                                shadowType: pc__namespace.SHADOW_PCSS
                            },
                            directional: {
                                enabled: true,
                                intensity: 2.0,
                                size: 20,
                                shadowType: pc__namespace.SHADOW_PCSS
                            }
                        });
                        var occluder = assets.asset.resource.instantiateRenderEntity();
                        app.root.addChild(occluder);
                        app.scene.envAtlas = assets.helipad.resource;
                        var areaLight = new pc__namespace.Entity();
                        areaLight.addComponent("light", {
                            type: "spot",
                            shape: pc__namespace.LIGHTSHAPE_RECT,
                            color: new pc__namespace.Color(0.25, 1, 0.25),
                            castShadows: true,
                            range: 150,
                            shadowResolution: 2048,
                            shadowDistance: 100,
                            penumbraSize: data.get('script.area.size'),
                            shadowType: data.get('script.area.shadowType'),
                            intensity: data.get('script.area.intensity'),
                            falloffMode: pc__namespace.LIGHTFALLOFF_INVERSESQUARED,
                            innerConeAngle: 45,
                            outerConeAngle: 50,
                            normalOffsetBias: 0.1
                        });
                        areaLight.setLocalScale(3, 1, 3);
                        areaLight.setEulerAngles(45, 90, 0);
                        areaLight.setLocalPosition(4, 7, 0);
                        // emissive material that is the light source color
                        var brightMaterial = new pc__namespace.StandardMaterial();
                        brightMaterial.emissive = areaLight.light.color;
                        brightMaterial.emissiveIntensity = areaLight.light.intensity;
                        brightMaterial.useLighting = false;
                        brightMaterial.cull = pc__namespace.CULLFACE_NONE;
                        brightMaterial.update();
                        var brightShape = new pc__namespace.Entity();
                        // primitive shape that matches light source shape
                        brightShape.addComponent("render", {
                            type: "plane",
                            material: brightMaterial,
                            castShadows: false
                        });
                        areaLight.addChild(brightShape);
                        app.root.addChild(areaLight);
                        var directionalLight = new pc__namespace.Entity();
                        directionalLight.addComponent("light", {
                            type: "directional",
                            color: new pc__namespace.Color(1, 1, 1),
                            castShadows: true,
                            numCascades: 1,
                            penumbraSize: data.get('script.directional.size'),
                            shadowType: data.get('script.directional.shadowType'),
                            intensity: data.get('script.directional.intensity'),
                            shadowBias: 0.5,
                            shadowDistance: 50,
                            normalOffsetBias: 0.1,
                            shadowResolution: 2048
                        });
                        directionalLight.setEulerAngles(65, 35, 0);
                        app.root.addChild(directionalLight);
                        var lightOmni = new pc__namespace.Entity("Omni");
                        lightOmni.addComponent("light", {
                            type: "omni",
                            color: new pc__namespace.Color(1, 0.25, 0.25),
                            range: 25,
                            penumbraSize: data.get('script.point.size'),
                            shadowType: data.get('script.point.shadowType'),
                            intensity: data.get('script.point.intensity'),
                            castShadows: true,
                            shadowBias: 0.2,
                            normalOffsetBias: 0.2,
                            shadowResolution: 2048
                        });
                        lightOmni.setLocalPosition(-4, 7, 0);
                        var omniMaterial = new pc__namespace.StandardMaterial();
                        omniMaterial.emissive = lightOmni.light.color;
                        omniMaterial.emissiveIntensity = lightOmni.light.intensity;
                        omniMaterial.useLighting = false;
                        omniMaterial.cull = pc__namespace.CULLFACE_NONE;
                        omniMaterial.update();
                        var omniShape = new pc__namespace.Entity();
                        omniShape.addComponent("render", {
                            type: "sphere",
                            material: omniMaterial,
                            castShadows: false
                        });
                        omniShape.setLocalScale(0.2, 0.2, 0.2);
                        lightOmni.addChild(omniShape);
                        app.root.addChild(lightOmni);
                        // Create an Entity with a camera component
                        var camera = new pc__namespace.Entity();
                        camera.addComponent("camera", {
                            clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                        });
                        camera.setLocalPosition(0, 5, 11);
                        camera.camera.requestSceneColorMap(true);
                        camera.addComponent("script");
                        camera.script.create("orbitCamera", {
                            attributes: {
                                inertiaFactor: 0.2,
                                focusEntity: occluder,
                                distanceMax: 500,
                                frameOnStart: false
                            }
                        });
                        camera.script.create("orbitCameraInputMouse");
                        camera.script.create("orbitCameraInputTouch");
                        app.root.addChild(camera);
                        data.on('*:set', function (path, value) {
                            switch (path) {
                                case 'script.area.enabled':
                                    areaLight.enabled = value;
                                    break;
                                case 'script.area.intensity':
                                    areaLight.light.intensity = value;
                                    brightMaterial.emissiveIntensity = value;
                                    brightMaterial.update();
                                    break;
                                case 'script.area.size':
                                    areaLight.light.penumbraSize = value;
                                    break;
                                case 'script.area.shadowType':
                                    areaLight.light.shadowType = parseInt(value);
                                    break;
                                case 'script.directional.enabled':
                                    directionalLight.enabled = value;
                                    break;
                                case 'script.directional.intensity':
                                    directionalLight.light.intensity = value;
                                    break;
                                case 'script.directional.size':
                                    directionalLight.light.penumbraSize = value;
                                    break;
                                case 'script.directional.shadowType':
                                    directionalLight.light.shadowType = parseInt(value);
                                    break;
                                case 'script.point.enabled':
                                    lightOmni.enabled = value;
                                    break;
                                case 'script.point.intensity':
                                    lightOmni.light.intensity = value;
                                    break;
                                case 'script.point.size':
                                    lightOmni.light.penumbraSize = value;
                                    break;
                                case 'script.point.shadowType':
                                    lightOmni.light.shadowType = parseInt(value);
                                    break;
                            }
                        });
                        var areaLightElement = window.top.document.getElementById('area-light');
                        var pointLightElement = window.top.document.getElementById('point-light');
                        var directionalLightElement = window.top.document.getElementById('directional-light');
                        var resizeControlPanel = true;
                        var time = 0;
                        var timeDiff = 0;
                        var index = 0;
                        app.on("update", function (dt) {
                            if (time === 0) {
                                // @ts-ignore engine-tsd
                                camera.script.orbitCamera.distance = 25;
                            }
                            timeDiff += dt;
                            if (data.get('script.cycle')) {
                                if ((timeDiff / 5) > 1) {
                                    index = (index + 1) % 3;
                                    timeDiff = 0;
                                }
                                areaLight.enabled = index === 0;
                                directionalLight.enabled = index === 1;
                                lightOmni.enabled = index === 2;
                                areaLightElement.ui.enabled = false;
                                pointLightElement.ui.enabled = false;
                                directionalLightElement.ui.enabled = false;
                            }
                            else {
                                areaLightElement.ui.enabled = true;
                                pointLightElement.ui.enabled = true;
                                directionalLightElement.ui.enabled = true;
                                areaLight.enabled = data.get('script.area.enabled');
                                directionalLight.enabled = data.get('script.directional.enabled');
                                lightOmni.enabled = data.get('script.point.enabled');
                            }
                            if (data.get('script.animate')) {
                                time += dt;
                                var x = Math.sin(time * 0.2);
                                var z = Math.cos(time * 0.2);
                                lightOmni.setLocalPosition(x * 4, 5, z * 4);
                                directionalLight.setEulerAngles(65, 35 + (time * 2), 0);
                                areaLight.setEulerAngles(45, 180 + time * 0.2 * 180.0 / Math.PI, 0);
                                areaLight.setLocalPosition(-x * 4, 7, -z * 4);
                            }
                            // resize control panel to fit the content better
                            if (resizeControlPanel) {
                                var panel = window.top.document.getElementById('controlPanel');
                                if (panel) {
                                    panel.style.width = '360px';
                                    resizeControlPanel = false;
                                }
                            }
                        });
                    });
                });
            }
        };
        ContactHardeningShadowsExample.CATEGORY = 'Graphics';
        ContactHardeningShadowsExample.NAME = 'Contact Hardening Shadows';
        ContactHardeningShadowsExample.WEBGPU_ENABLED = false;
        return ContactHardeningShadowsExample;
    }());

    var GrabPassExample = /** @class */ (function () {
        function GrabPassExample() {
        }
        GrabPassExample.prototype.example = function (canvas, deviceType, files) {
            var assets = {
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/normal-map.png' }),
                "roughness": new pc__namespace.Asset("roughness", "texture", { url: "/static/assets/textures/pc-gray.png" }),
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.skyboxMip = 0;
                    app.scene.exposure = 2;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // Depth layer is where the framebuffer is copied to a texture to be used in the following layers.
                    // Move the depth layer to take place after World and Skydome layers, to capture both of them.
                    var depthLayer = app.scene.layers.getLayerById(pc__namespace.LAYERID_DEPTH);
                    app.scene.layers.remove(depthLayer);
                    app.scene.layers.insertOpaque(depthLayer, 2);
                    // helper function to create a primitive with shape type, position, scale, color
                    function createPrimitive(primitiveType, position, scale, color) {
                        // create material of specified color
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = color;
                        material.gloss = 0.6;
                        material.metalness = 0.4;
                        material.useMetalness = true;
                        material.update();
                        // create primitive
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            material: material
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // create few primitives, keep their references to rotate them later
                    var primitives = [];
                    var count = 7;
                    var shapes = ["box", "cone", "cylinder", "sphere", "capsule"];
                    for (var i = 0; i < count; i++) {
                        var shapeName = shapes[Math.floor(Math.random() * shapes.length)];
                        var color = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                        var angle = 2 * Math.PI * i / count;
                        var pos = new pc__namespace.Vec3(12 * Math.sin(angle), 0, 12 * Math.cos(angle));
                        primitives.push(createPrimitive(shapeName, pos, new pc__namespace.Vec3(4, 8, 4), color));
                    }
                    // Create the camera, which renders entities
                    var camera = new pc__namespace.Entity("SceneCamera");
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.2, 0.2, 0.2)
                    });
                    app.root.addChild(camera);
                    camera.setLocalPosition(0, 10, 20);
                    camera.lookAt(pc__namespace.Vec3.ZERO);
                    // enable the camera to render the scene's color map.
                    camera.camera.requestSceneColorMap(true);
                    // create a primitive which uses refraction shader to distort the view behind it
                    var glass = createPrimitive("box", new pc__namespace.Vec3(1, 3, 0), new pc__namespace.Vec3(10, 10, 10), new pc__namespace.Color(1, 1, 1));
                    glass.render.castShadows = false;
                    glass.render.receiveShadows = false;
                    var shader = pc__namespace.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader');
                    // reflection material using the shader
                    var refractionMaterial = new pc__namespace.Material();
                    refractionMaterial.shader = shader;
                    glass.render.material = refractionMaterial;
                    // set an offset map on the material
                    refractionMaterial.setParameter('uOffsetMap', assets.normal.resource);
                    // set roughness map
                    refractionMaterial.setParameter('uRoughnessMap', assets.roughness.resource);
                    // tint colors
                    refractionMaterial.setParameter('tints[0]', new Float32Array([
                        1, 0.7, 0.7,
                        1, 1, 1,
                        0.7, 0.7, 1,
                        1, 1, 1 // white
                    ]));
                    // transparency
                    refractionMaterial.blendType = pc__namespace.BLEND_NORMAL;
                    refractionMaterial.update();
                    // update things each frame
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // rotate the primitives
                        primitives.forEach(function (prim) {
                            prim.rotate(0.3, 0.2, 0.1);
                        });
                        glass.rotate(-0.1, 0.1, -0.15);
                        // orbit the camera
                        camera.setLocalPosition(20 * Math.sin(time * 0.2), 7, 20 * Math.cos(time * 0.2));
                        camera.lookAt(new pc__namespace.Vec3(0, 2, 0));
                    });
                });
            });
        };
        GrabPassExample.CATEGORY = 'Graphics';
        GrabPassExample.NAME = 'Grab Pass';
        GrabPassExample.WEBGPU_ENABLED = true;
        GrabPassExample.FILES = {
            'shader.vert': /* glsl */ "\n            attribute vec3 vertex_position;\n            attribute vec2 vertex_texCoord0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n\n            varying vec2 texCoord;\n\n            void main(void)\n            {\n                // project the position\n                vec4 pos = matrix_model * vec4(vertex_position, 1.0);\n                gl_Position = matrix_viewProjection * pos;\n\n                texCoord = vertex_texCoord0;\n            }\n        ",
            'shader.frag': /* glsl */ "\n            // use the special uSceneColorMap texture, which is a built-in texture containing\n            // a copy of the color buffer at the point of capture, inside the Depth layer.\n            uniform sampler2D uSceneColorMap;\n\n            // normal map providing offsets\n            uniform sampler2D uOffsetMap;\n\n            // roughness map\n            uniform sampler2D uRoughnessMap;\n\n            // tint colors\n            uniform vec3 tints[4];\n\n            // engine built-in constant storing render target size in .xy and inverse size in .zw\n            uniform vec4 uScreenSize;\n\n            varying vec2 texCoord;\n\n            void main(void)\n            {\n                float roughness = 1.0 - texture2D(uRoughnessMap, texCoord).r;\n\n                // sample offset texture - used to add distortion to the sampled background\n                vec2 offset = texture2D(uOffsetMap, texCoord).rg;\n                offset = 2.0 * offset - 1.0;\n\n                // offset strength\n                offset *= (0.2 + roughness) * 0.015;\n\n                // get normalized uv coordinates for canvas\n                vec2 grabUv = gl_FragCoord.xy * uScreenSize.zw;\n\n                // roughness dictates which mipmap level gets used, in 0..4 range\n                float mipmap = roughness * 5.0;\n\n                // get background pixel color with distorted offset\n                vec3 grabColor = texture2DLodEXT(uSceneColorMap, grabUv + offset, mipmap).rgb;\n\n                // tint the material based on mipmap, on WebGL2 only, as WebGL1 does not support non-constant array indexing\n                // (note - this could be worked around by using a series of if statements in this case)\n                #ifdef GL2\n                    float tintIndex = clamp(mipmap, 0.0, 3.0);\n                    grabColor *= tints[int(tintIndex)];\n                #endif\n\n                // brighten the refracted texture a little bit\n                // brighten even more the rough parts of the glass\n                gl_FragColor = vec4(grabColor * 1.1, 1.0) + roughness * 0.09;\n            }\n        "
        };
        return GrabPassExample;
    }());

    var GroundFogExample = /** @class */ (function () {
        function GroundFogExample() {
        }
        GroundFogExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Controls' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'softness' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.softness' } }))));
        };
        GroundFogExample.prototype.example = function (canvas, deviceType, files, data) {
            var assets = {
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                'terrain': new pc__namespace.Asset('terrain', 'container', { url: '/static/assets/models/terrain.glb' }),
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'texture': new pc__namespace.Asset('color', 'texture', { url: '/static/assets/textures/clouds.jpg' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js',
                // WebGPU does not currently support antialiased depth resolve, disable it till we implement a shader resolve solution
                antialias: false
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    data.set('data', {
                        softness: true
                    });
                    // setup skydome
                    app.scene.skyboxMip = 3;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxRotation = new pc__namespace.Quat().setFromEulerAngles(0, -70, 0);
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // disable skydome rendering
                    var skyLayer = app.scene.layers.getLayerById(pc__namespace.LAYERID_SKYBOX);
                    skyLayer.enabled = false;
                    // instantiate the terrain
                    var terrain = assets.terrain.resource.instantiateRenderEntity();
                    terrain.setLocalScale(30, 30, 30);
                    app.root.addChild(terrain);
                    // find a tree in the middle to use as a focus point
                    var tree = terrain.findOne("name", "Arbol 2.002");
                    // create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(150 / 255, 213 / 255, 63 / 255),
                        farClip: 1000
                    });
                    // and position it in the world
                    camera.setLocalPosition(-200, 120, 225);
                    // add orbit camera script with a mouse and a touch support
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: tree,
                            distanceMax: 600
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    // enable the camera to render the scene's depth map.
                    camera.camera.requestSceneDepthMap(true);
                    // Create a directional light casting cascaded shadows
                    var dirLight = new pc__namespace.Entity();
                    dirLight.addComponent("light", {
                        type: "directional",
                        color: pc__namespace.Color.WHITE,
                        shadowBias: 0.3,
                        normalOffsetBias: 0.2,
                        intensity: 1.0,
                        // enable shadow casting
                        castShadows: true,
                        shadowDistance: 1000,
                        shadowResolution: 2048,
                        shadowType: pc__namespace.SHADOW_PCF3
                    });
                    app.root.addChild(dirLight);
                    dirLight.setLocalEulerAngles(45, 350, 20);
                    // create a custom fog shader
                    // @ts-ignore
                    var vertex = "#define VERTEXSHADER\n" + pc__namespace.shaderChunks.screenDepthPS + files['shader.vert'];
                    // @ts-ignore
                    var fragment = pc__namespace.shaderChunks.screenDepthPS + files['shader.frag'];
                    var shader = pc__namespace.createShaderFromCode(app.graphicsDevice, vertex, fragment, 'GroundFogShader');
                    // and set up a material using this shader
                    var material = new pc__namespace.Material();
                    material.shader = shader;
                    material.setParameter('uTexture', assets.texture.resource);
                    material.depthWrite = false;
                    material.depthWrite = false;
                    material.blendType = pc__namespace.BLEND_NORMAL;
                    material.update();
                    // create a subdivided plane mesh, to allow for vertex animation by the shader
                    var mesh = pc__namespace.createPlane(app.graphicsDevice, { widthSegments: 20, lengthSegments: 20 });
                    var meshInstance = new pc__namespace.MeshInstance(mesh, material);
                    var ground = new pc__namespace.Entity();
                    ground.addComponent("render", {
                        meshInstances: [meshInstance],
                        material: material,
                        castShadows: false,
                        receiveShadows: false
                    });
                    ground.setLocalScale(500, 1, 500);
                    ground.setLocalPosition(0, 25, 0);
                    app.root.addChild(ground);
                    var firstFrame = true;
                    var currentTime = 0;
                    app.on("update", function (dt) {
                        // on the first frame, when camera is updated, move it further away from the focus tree
                        if (firstFrame) {
                            firstFrame = false;
                            // @ts-ignore engine-tsd
                            camera.script.orbitCamera.distance = 320;
                        }
                        // Update the time and pass it to shader
                        currentTime += dt;
                        material.setParameter('uTime', currentTime);
                        // based on sofness toggle, set shader parameter
                        material.setParameter('uSoftening', data.get('data.softness') ? 50 : 1000);
                        // debug rendering of the deptht texture in the corner
                        app.drawDepthTexture(0.7, -0.7, 0.5, -0.5);
                    });
                });
            });
        };
        GroundFogExample.CATEGORY = 'Graphics';
        GroundFogExample.NAME = 'Ground Fog';
        GroundFogExample.WEBGPU_ENABLED = true;
        GroundFogExample.FILES = {
            'shader.vert': /* glsl */ "\n            attribute vec3 vertex_position;\n            attribute vec2 vertex_texCoord0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n            uniform float uTime;\n            uniform sampler2D uTexture;\n\n            varying vec2 texCoord0;\n            varying vec2 texCoord1;\n            varying vec2 texCoord2;\n            varying vec4 screenPos;\n            varying float depth;\n\n            void main(void)\n            {\n                // 3 scrolling texture coordinates with different direction and speed\n                texCoord0 = vertex_texCoord0 * 2.0 + vec2(uTime * 0.003, uTime * 0.01);\n                texCoord1 = vertex_texCoord0 * 1.5 + vec2(uTime * -0.02, uTime * 0.02);\n                texCoord2 = vertex_texCoord0 * 1.0 + vec2(uTime * 0.01, uTime * -0.003);\n\n                // sample the fog texture to have elevation for this vertex\n                vec2 offsetTexCoord = vertex_texCoord0 + vec2(uTime * 0.001, uTime * -0.0003);\n                float offset = texture2D(uTexture, offsetTexCoord).r;\n\n                // vertex in the world space\n                vec4 pos = matrix_model * vec4(vertex_position, 1.0);\n\n                // move it up based on the offset\n                pos.y += offset * 25.0;\n\n                // position in projected (screen) space\n                vec4 projPos = matrix_viewProjection * pos;\n                gl_Position = projPos;\n\n                // the linear depth of the vertex (in camera space)\n                depth = getLinearDepth(pos.xyz);\n\n                // screen fragment position, used to sample the depth texture\n                screenPos = projPos;\n            }\n        ",
            'shader.frag': /* glsl */ "\n            uniform sampler2D uTexture;\n            uniform float uSoftening;\n\n            varying vec2 texCoord0;\n            varying vec2 texCoord1;\n            varying vec2 texCoord2;\n            varying vec4 screenPos;\n            varying float depth;\n            \n            void main(void)\n            {\n                // sample the texture 3 times and compute average intensity of the fog\n                vec4 diffusTexture0 = texture2D (uTexture, texCoord0);\n                vec4 diffusTexture1 = texture2D (uTexture, texCoord1);\n                vec4 diffusTexture2 = texture2D (uTexture, texCoord2);\n                float alpha = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r);\n\n                // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords\n                vec2 screenCoord = getGrabScreenPos(screenPos);\n\n                // read the depth from the depth buffer\n                float sceneDepth = getLinearScreenDepth(screenCoord) * camera_params.x;\n\n                // depth of the current fragment (on the fog plane)\n                float fragmentDepth = depth * camera_params.x;\n\n                // difference between these two depths is used to adjust the alpha, to fade out\n                // the fog near the geometry\n                float depthDiff = clamp(abs(fragmentDepth - sceneDepth) * uSoftening, 0.0, 1.0);\n                alpha *= smoothstep(0.0, 1.0, depthDiff);\n\n                // final color\n                vec3 fogColor = vec3(1.0, 1.0, 1.0);\n                gl_FragColor = vec4(fogColor, alpha);\n            }\n        "
        };
        return GroundFogExample;
    }());

    var HardwareInstancingExample = /** @class */ (function () {
        function HardwareInstancingExample() {
        }
        HardwareInstancingExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.skyboxMip = 2;
                    app.scene.exposure = 0.3;
                    app.scene.envAtlas = assets.helipad.resource;
                    // set up some general scene rendering properties
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.ambientLight = new pc__namespace.Color(0.1, 0.1, 0.1);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {});
                    app.root.addChild(camera);
                    // Move the camera back to see the cubes
                    camera.translate(0, 0, 10);
                    // create standard material and enable instancing on it
                    var material = new pc__namespace.StandardMaterial();
                    material.onUpdateShader = function (options) {
                        options.litOptions.useInstancing = true;
                        return options;
                    };
                    material.gloss = 0.6;
                    material.metalness = 0.7;
                    material.useMetalness = true;
                    material.update();
                    // Create a Entity with a cylinder render component and the instancing material
                    var box = new pc__namespace.Entity("InstancingEntity");
                    box.addComponent("render", {
                        material: material,
                        type: "cylinder"
                    });
                    // add the box entity to the hierarchy
                    app.root.addChild(box);
                    if (app.graphicsDevice.supportsInstancing) {
                        // number of instances to render
                        var instanceCount = 1000;
                        // store matrices for individual instances into array
                        var matrices = new Float32Array(instanceCount * 16);
                        var matrixIndex = 0;
                        var radius = 5;
                        var pos = new pc__namespace.Vec3();
                        var rot = new pc__namespace.Quat();
                        var scl = new pc__namespace.Vec3();
                        var matrix = new pc__namespace.Mat4();
                        for (var i = 0; i < instanceCount; i++) {
                            // generate random positions / scales and rotations
                            pos.set(Math.random() * radius - radius * 0.5, Math.random() * radius - radius * 0.5, Math.random() * radius - radius * 0.5);
                            scl.set(0.1 + Math.random() * 0.1, 0.1 + Math.random() * 0.3, 0.1 + Math.random() * 0.1);
                            rot.setFromEulerAngles(i * 30, i * 50, i * 70);
                            matrix.setTRS(pos, rot, scl);
                            // copy matrix elements into array of floats
                            for (var m = 0; m < 16; m++)
                                matrices[matrixIndex++] = matrix.data[m];
                        }
                        // create static vertex buffer containing the matrices
                        var vertexBuffer = new pc__namespace.VertexBuffer(app.graphicsDevice, pc__namespace.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice), instanceCount, pc__namespace.BUFFER_STATIC, matrices);
                        // initialize instancing using the vertex buffer on meshInstance of the created box
                        var boxMeshInst = box.render.meshInstances[0];
                        boxMeshInst.setInstancing(vertexBuffer);
                    }
                    // Set an update function on the app's update event
                    var angle = 0;
                    app.on("update", function (dt) {
                        // orbit camera around
                        angle += dt * 0.2;
                        camera.setLocalPosition(8 * Math.sin(angle), 0, 8 * Math.cos(angle));
                        camera.lookAt(pc__namespace.Vec3.ZERO);
                    });
                });
            }).catch(console.error);
        };
        HardwareInstancingExample.CATEGORY = 'Graphics';
        HardwareInstancingExample.NAME = 'Hardware Instancing';
        HardwareInstancingExample.WEBGPU_ENABLED = true;
        return HardwareInstancingExample;
    }());

    var HierarchyExample = /** @class */ (function () {
        function HierarchyExample() {
        }
        HierarchyExample.prototype.example = function (canvas, deviceType) {
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                app.start();
                app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                // helper function to create a primitive with shape type, position, scale
                function createPrimitive(primitiveType, position, scale) {
                    // create material of random color
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuse = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                    material.update();
                    // create primitive with a render component
                    var primitive = new pc__namespace.Entity();
                    primitive.addComponent('render', {
                        type: primitiveType,
                        material: material
                    });
                    // set position and scale
                    primitive.setLocalPosition(position);
                    primitive.setLocalScale(scale);
                    return primitive;
                }
                // list of all created entities
                var entities = [];
                // helper recursive function to create a next layer of entities for a specified parent
                function createChildren(parent, gridSize, scale, scaleDelta, spacing, levels) {
                    if (levels >= 0) {
                        var offset = spacing * (gridSize - 1) * 0.5;
                        for (var x = 0; x < gridSize; x++) {
                            for (var y = 0; y < gridSize; y++) {
                                var shape = Math.random() < 0.5 ? "box" : "sphere";
                                var position = new pc__namespace.Vec3(x * spacing - offset, spacing, y * spacing - offset);
                                var entity = createPrimitive(shape, position, new pc__namespace.Vec3(scale, scale, scale));
                                parent.addChild(entity);
                                entities.push(entity);
                                createChildren(entity, gridSize, scale - scaleDelta, scaleDelta, spacing * 0.7, levels - 1);
                            }
                        }
                    }
                }
                // dummy root entity
                var root = new pc__namespace.Entity();
                app.root.addChild(root);
                // generate hierarchy of children entities
                var levels = 5;
                var gridSize = 2;
                var scale = 1.7;
                var scaleDelta = 0.25;
                var spacing = 7;
                createChildren(root, gridSize, scale, scaleDelta, spacing, levels);
                console.log("number of created entities: " + entities.length);
                // Create main camera
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                });
                camera.setLocalPosition(90 * Math.sin(0), 40, 90 * Math.cos(0));
                camera.lookAt(new pc__namespace.Vec3(0, 5, 0));
                app.root.addChild(camera);
                // Create an Entity with a omni light component
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    type: "omni",
                    color: new pc__namespace.Color(1, 1, 1),
                    range: 150
                });
                light.translate(40, 60, 50);
                app.root.addChild(light);
                // update each frame
                var time = 0;
                app.on("update", function (dt) {
                    time += dt;
                    // rotation quaternion changing with time
                    var rot = new pc__namespace.Quat();
                    rot.setFromEulerAngles(time * 5, time * 13, time * 6);
                    // apply it to all entities
                    for (var e = 0; e < entities.length; e++) {
                        entities[e].setLocalRotation(rot);
                    }
                });
            });
        };
        HierarchyExample.CATEGORY = 'Graphics';
        HierarchyExample.NAME = 'Hierarchy';
        HierarchyExample.WEBGPU_ENABLED = true;
        return HierarchyExample;
    }());

    var LayersExample = /** @class */ (function () {
        function LayersExample() {
        }
        LayersExample.prototype.example = function (canvas, deviceType) {
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                app.start();
                app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                // Create a new layer to put in front of everything
                var layer = new pc__namespace.Layer({
                    name: "Front Layer"
                });
                // get the world layer index
                var worldLayer = app.scene.layers.getLayerByName("World");
                var idx = app.scene.layers.getTransparentIndex(worldLayer);
                // insert the new layer after the world layer
                app.scene.layers.insert(layer, idx + 1);
                // Create an Entity with a camera component
                // Make sure it renders both World and Front Layer
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.4, 0.45, 0.5),
                    layers: [worldLayer.id, layer.id]
                });
                camera.translate(0, 0, 24);
                app.root.addChild(camera);
                // Create an Entity with a omni light component
                // Make sure it lights both World and Front Layer
                var light = new pc__namespace.Entity();
                light.addComponent('light', {
                    type: 'omni',
                    color: new pc__namespace.Color(1, 1, 1),
                    range: 100,
                    layers: [worldLayer.id, layer.id]
                });
                light.translate(5, 0, 15);
                app.root.addChild(light);
                // red material is semi-transparent
                var red = new pc__namespace.StandardMaterial();
                red.diffuse.set(1, 0, 0);
                red.blendType = pc__namespace.BLEND_NORMAL;
                red.opacity = 0.5;
                red.update();
                // blue material does not test the existing depth buffer
                var blue = new pc__namespace.StandardMaterial();
                blue.diffuse.set(0, 0, 1);
                blue.depthTest = false;
                blue.update();
                // red box is rendered first in World layer
                var redBox = new pc__namespace.Entity();
                redBox.addComponent('render', {
                    type: 'box',
                    material: red
                });
                redBox.setLocalScale(5, 5, 5);
                app.root.addChild(redBox);
                // blue box is rendered in the Front Layer which is after World
                // because it does not test for depth
                // and is in a later layer
                // it is visible even though it should be inside the red box
                var blueBox = new pc__namespace.Entity();
                blueBox.addComponent('render', {
                    type: 'box',
                    material: blue,
                    layers: [layer.id] // try removing this line, the blue box will appear inside the red one
                });
                blueBox.setLocalScale(2.5, 2.5, 2.5);
                app.root.addChild(blueBox);
                app.on("update", function (dt) {
                    if (redBox) {
                        redBox.rotate(0, 10 * dt, 0);
                    }
                    if (blueBox) {
                        blueBox.rotate(0, -10 * dt, 0);
                    }
                });
            });
        };
        LayersExample.CATEGORY = 'Graphics';
        LayersExample.NAME = 'Layers';
        LayersExample.WEBGPU_ENABLED = true;
        return LayersExample;
    }());

    var LightsBakedAOExample = /** @class */ (function () {
        function LightsBakedAOExample() {
        }
        LightsBakedAOExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Lightmap Filter Settings' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enable' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.settings.lightmapFilterEnabled' }, value: data.get('data.settings.lightmapFilterEnabled') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'range' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.settings.lightmapFilterRange' }, value: data.get('data.settings.lightmapFilterRange'), min: 1, max: 20, precision: 0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'smoothness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.settings.lightmapFilterSmoothness' }, value: data.get('data.settings.lightmapFilterSmoothness'), min: 0.1, max: 2, precision: 1 }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Ambient light' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'bake' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.ambient.ambientBake' }, value: data.get('data.ambient.ambientBake') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'cubemap' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.ambient.cubemap' }, value: data.get('data.ambient.cubemap') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'hemisphere' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.ambient.hemisphere' }, value: data.get('data.ambient.hemisphere') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'samples' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.ambient.ambientBakeNumSamples' }, value: data.get('data.ambient.ambientBakeNumSamples'), max: 64, precision: 0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'contrast' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.ambient.ambientBakeOcclusionContrast' }, value: data.get('data.ambient.ambientBakeOcclusionContrast'), min: -1, max: 1, precision: 1 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'brightness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.ambient.ambientBakeOcclusionBrightness' }, value: data.get('data.ambient.ambientBakeOcclusionBrightness'), min: -1, max: 1, precision: 1 }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Directional light' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enable' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.directional.enabled' }, value: data.get('data.directional.enabled') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'bake' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.directional.bake' }, value: data.get('data.directional.bake') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'samples' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.directional.bakeNumSamples' }, value: data.get('data.directional.bakeNumSamples'), max: 64, precision: 0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'area' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.directional.bakeArea' }, value: data.get('data.directional.bakeArea'), max: 40, precision: 0 }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Other lights' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enable' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.other.enabled' }, value: data.get('data.other.enabled') }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Bake stats' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'duration' },
                        React__default["default"].createElement(react.Label, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.stats.duration' }, value: data.get('data.stats.duration') }))));
        };
        LightsBakedAOExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'house': new pc__namespace.Asset('house', 'container', { url: '/static/assets/models/house.glb' }),
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                // @ts-ignore
                createOptions.lightmapper = pc__namespace.Lightmapper;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.CubemapHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome - this is the main source of ambient light
                    app.scene.skyboxMip = 3;
                    app.scene.skyboxIntensity = 0.6;
                    app.scene.envAtlas = assets.helipad.resource;
                    // if skydome cubemap is disabled using HUD, a constant ambient color is used instead
                    app.scene.ambientLight = new pc__namespace.Color(0.1, 0.3, 0.4);
                    // instantiate the house model, which has unwrapped texture coordinates for lightmap in UV1
                    var house = assets.house.resource.instantiateRenderEntity();
                    house.setLocalScale(100, 100, 100);
                    app.root.addChild(house);
                    // change its materials to lightmapping
                    var renders = house.findComponents("render");
                    renders.forEach(function (render) {
                        render.castShadows = true;
                        render.castShadowsLightmap = true;
                        render.lightmapped = true;
                    });
                    // directional light
                    var lightDirectional = new pc__namespace.Entity("Directional");
                    lightDirectional.addComponent("light", {
                        type: "directional",
                        affectDynamic: true,
                        affectLightmapped: true,
                        castShadows: true,
                        normalOffsetBias: 0.05,
                        shadowBias: 0.2,
                        shadowDistance: 100,
                        shadowResolution: 2048,
                        shadowType: pc__namespace.SHADOW_PCF3,
                        color: new pc__namespace.Color(0.7, 0.7, 0.5),
                        intensity: 1.6
                    });
                    app.root.addChild(lightDirectional);
                    lightDirectional.setLocalEulerAngles(-55, 0, -30);
                    // Create an entity with a omni light component that is configured as a baked light
                    var lightOmni = new pc__namespace.Entity("Omni");
                    lightOmni.addComponent("light", {
                        type: "omni",
                        affectDynamic: false,
                        affectLightmapped: true,
                        bake: true,
                        castShadows: true,
                        normalOffsetBias: 0.05,
                        shadowBias: 0.2,
                        shadowDistance: 25,
                        shadowResolution: 512,
                        shadowType: pc__namespace.SHADOW_PCF3,
                        color: pc__namespace.Color.YELLOW,
                        range: 25,
                        intensity: 0.9
                    });
                    lightOmni.setLocalPosition(-4, 10, 5);
                    app.root.addChild(lightOmni);
                    // Create an entity with a spot light component that is configured as a baked light
                    var lightSpot = new pc__namespace.Entity("Spot");
                    lightSpot.addComponent("light", {
                        type: "spot",
                        affectDynamic: false,
                        affectLightmapped: true,
                        bake: true,
                        castShadows: true,
                        normalOffsetBias: 0.05,
                        shadowBias: 0.2,
                        shadowDistance: 50,
                        shadowResolution: 512,
                        shadowType: pc__namespace.SHADOW_PCF3,
                        color: pc__namespace.Color.RED,
                        range: 10,
                        intensity: 2.5
                    });
                    lightSpot.setLocalPosition(-5, 10, -7.5);
                    app.root.addChild(lightSpot);
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5),
                        farClip: 100,
                        nearClip: 1
                    });
                    camera.setLocalPosition(40, 20, 40);
                    // add orbit camera script with a mouse and a touch support
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: house,
                            distanceMax: 60
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    // lightmap baking properties
                    var bakeType = pc__namespace.BAKE_COLOR;
                    app.scene.lightmapMode = bakeType;
                    app.scene.lightmapMaxResolution = 1024;
                    // multiplier for lightmap resolution
                    app.scene.lightmapSizeMultiplier = 512;
                    // bake when settings are changed only
                    var needBake = false;
                    // handle data changes from HUD to modify baking properties
                    data.on('*:set', function (path, value) {
                        var bakeSettingChanged = true;
                        var pathArray = path.split('.');
                        // ambient light
                        if (pathArray[1] === 'ambient') {
                            if (pathArray[2] === 'cubemap') {
                                // enable / disable cubemap
                                app.scene.envAtlas = value ? assets.helipad.resource : null;
                            }
                            else if (pathArray[2] === 'hemisphere') {
                                // switch between smaller upper hemisphere and full sphere
                                app.scene.ambientBakeSpherePart = value ? 0.4 : 1;
                            }
                            else {
                                // all other values are set directly on the scene
                                // @ts-ignore engine-tsd
                                app.scene[pathArray[2]] = value;
                            }
                        }
                        else if (pathArray[1] === 'directional') {
                            // @ts-ignore engine-tsd
                            lightDirectional.light[pathArray[2]] = value;
                        }
                        else if (pathArray[1] === 'settings') {
                            // @ts-ignore engine-tsd
                            app.scene[pathArray[2]] = value;
                        }
                        else if (pathArray[1] === 'other') {
                            // @ts-ignore engine-tsd
                            lightOmni.light[pathArray[2]] = value;
                            // @ts-ignore engine-tsd
                            lightSpot.light[pathArray[2]] = value;
                        }
                        else {
                            // don't rebake if stats change
                            bakeSettingChanged = false;
                        }
                        // trigger bake on the next frame if relevant settings were changes
                        needBake || (needBake = bakeSettingChanged);
                    });
                    // bake properties connected to the HUD
                    data.set('data', {
                        settings: {
                            lightmapFilterEnabled: true,
                            lightmapFilterRange: 10,
                            lightmapFilterSmoothness: 0.2
                        },
                        ambient: {
                            ambientBake: true,
                            cubemap: true,
                            hemisphere: true,
                            ambientBakeNumSamples: 20,
                            ambientBakeOcclusionContrast: -0.6,
                            ambientBakeOcclusionBrightness: -0.5
                        },
                        directional: {
                            enabled: true,
                            bake: true,
                            bakeNumSamples: 15,
                            bakeArea: 10
                        },
                        other: {
                            enabled: true
                        },
                        stats: {
                            duration: ''
                        }
                    });
                    // Set an update function on the app's update event
                    app.on("update", function (dt) {
                        // bake lightmaps when HUD properties change
                        if (needBake) {
                            needBake = false;
                            app.lightmapper.bake(null, bakeType);
                            // update stats with the bake duration
                            data.set('data.stats.duration', app.lightmapper.stats.totalRenderTime.toFixed(1) + 'ms');
                        }
                    });
                });
            });
        };
        LightsBakedAOExample.CATEGORY = 'Graphics';
        LightsBakedAOExample.NAME = 'Lights Baked AO';
        return LightsBakedAOExample;
    }());

    var LightsBakedExample = /** @class */ (function () {
        function LightsBakedExample() {
        }
        LightsBakedExample.prototype.example = function (canvas, deviceType) {
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                // @ts-ignore
                createOptions.lightmapper = pc__namespace.Lightmapper;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                app.start();
                // create material used on the geometry
                var material = new pc__namespace.StandardMaterial();
                material.gloss = 0.6;
                material.metalness = 0.4;
                material.useMetalness = true;
                material.update();
                // All render component primitive shape types
                var shapes = ["box", "cone", "cylinder", "sphere", "capsule", "torus"];
                for (var i = 0; i < 40; i++) {
                    var shape = shapes[Math.floor(Math.random() * shapes.length)];
                    // Create an entity with a render component that is set up to be lightmapped with baked direct lighting
                    var entity = new pc__namespace.Entity();
                    entity.addComponent('render', {
                        castShadows: false,
                        castShadowsLightmap: true,
                        lightmapped: true,
                        type: shape,
                        material: material
                    });
                    app.root.addChild(entity);
                    // random orientation
                    entity.setLocalPosition(Math.random() * 10 - 5, Math.random() * 5, Math.random() * 10 - 5);
                }
                var ground = new pc__namespace.Entity();
                ground.addComponent('render', {
                    castShadows: false,
                    castShadowsLightmap: false,
                    lightmapped: true,
                    type: "plane",
                    material: material
                });
                app.root.addChild(ground);
                ground.setLocalPosition(0, -1, 0);
                ground.setLocalScale(40, 40, 40);
                // Create an entity with a directional light component that is configured as a baked light
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    affectDynamic: false,
                    affectLightmapped: true,
                    bake: true,
                    castShadows: true,
                    normalOffsetBias: 0.05,
                    shadowBias: 0.2,
                    shadowDistance: 50,
                    shadowResolution: 2048,
                    shadowType: pc__namespace.SHADOW_PCF3,
                    color: pc__namespace.Color.GREEN,
                    type: "directional"
                });
                app.root.addChild(light);
                light.setLocalEulerAngles(45, 30, 0);
                // Create an entity with an omni light component that is configured as a baked light
                var lightPoint = new pc__namespace.Entity();
                lightPoint.addComponent("light", {
                    affectDynamic: false,
                    affectLightmapped: true,
                    bake: true,
                    castShadows: true,
                    normalOffsetBias: 0.05,
                    shadowBias: 0.2,
                    shadowDistance: 50,
                    shadowResolution: 512,
                    shadowType: pc__namespace.SHADOW_PCF3,
                    color: pc__namespace.Color.RED,
                    range: 100,
                    type: "point"
                });
                lightPoint.setLocalPosition(0, 2, 0);
                app.root.addChild(lightPoint);
                // Create an entity with a camera component
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.4, 0.45, 0.5),
                    farClip: 100,
                    nearClip: 0.05
                });
                app.root.addChild(camera);
                // lightmap baking properties
                app.scene.lightmapMode = pc__namespace.BAKE_COLOR;
                app.scene.lightmapMaxResolution = 2048;
                // For baked lights, this property perhaps has the biggest impact on lightmap resolution:
                app.scene.lightmapSizeMultiplier = 32;
                // bake lightmaps
                app.lightmapper.bake(null, pc__namespace.BAKE_COLORDIR);
                // Set an update function on the app's update event
                var time = 4;
                app.on("update", function (dt) {
                    time += dt;
                    // orbit camera
                    camera.setLocalPosition(20 * Math.sin(time * 0.4), 3, 6);
                    camera.lookAt(pc__namespace.Vec3.ZERO);
                });
            });
        };
        LightsBakedExample.CATEGORY = 'Graphics';
        LightsBakedExample.NAME = 'Lights Baked';
        return LightsBakedExample;
    }());

    var LightsExample$1 = /** @class */ (function () {
        function LightsExample() {
        }
        LightsExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'OMNI LIGHT [KEY_1]' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enabled' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.omni.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.omni.intensity' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'shadow intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.omni.shadowIntensity' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'cookie' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.omni.cookieIntensity' } }))),
                React__default["default"].createElement(react.Panel, { headerText: 'SPOT LIGHT [KEY_2]' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enabled' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.spot.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.spot.intensity' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'shadow intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.spot.shadowIntensity' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'cookie' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.spot.cookieIntensity' } }))),
                React__default["default"].createElement(react.Panel, { headerText: 'DIRECTIONAL LIGHT [KEY_3]' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enabled' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.directional.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.directional.intensity' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'shadow intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'lights.directional.shadowIntensity' } }))));
        };
        LightsExample.prototype.example = function (canvas, deviceType, data) {
            var _this = this;
            function createMaterial(colors) {
                var material = new pc__namespace.StandardMaterial();
                for (var param in colors) {
                    material[param] = colors[param];
                }
                material.update();
                return material;
            }
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
                "heart": new pc__namespace.Asset("heart", "texture", { url: "/static/assets/textures/heart.png" }),
                "xmas_negx": new pc__namespace.Asset("xmas_negx", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_negx.png" }),
                "xmas_negy": new pc__namespace.Asset("xmas_negy", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_negy.png" }),
                "xmas_negz": new pc__namespace.Asset("xmas_negz", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_negz.png" }),
                "xmas_posx": new pc__namespace.Asset("xmas_posx", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_posx.png" }),
                "xmas_posy": new pc__namespace.Asset("xmas_posy", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_posy.png" }),
                "xmas_posz": new pc__namespace.Asset("xmas_posz", "texture", { url: "/static/assets/cubemaps/xmas_faces/xmas_posz.png" })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.CubemapHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // enable cookies which are disabled by default for clustered lighting
                    app.scene.lighting.cookiesEnabled = true;
                    // ambient lighting
                    app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                    // create an entity with the statue
                    var entity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(entity);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0, 15, 35);
                    camera.rotate(-14, 0, 0);
                    app.root.addChild(camera);
                    // ground material
                    var material = createMaterial({
                        ambient: pc__namespace.Color.GRAY,
                        diffuse: pc__namespace.Color.GRAY
                    });
                    // Create an Entity for the ground
                    var ground = new pc__namespace.Entity();
                    ground.addComponent("render", {
                        type: "box",
                        material: material
                    });
                    ground.setLocalScale(70, 1, 70);
                    ground.setLocalPosition(0, -0.5, 0);
                    app.root.addChild(ground);
                    // setup light data
                    data.set('lights', {
                        spot: {
                            enabled: true,
                            intensity: 0.8,
                            cookieIntensity: 1,
                            shadowIntensity: 1
                        },
                        omni: {
                            enabled: true,
                            intensity: 0.8,
                            cookieIntensity: 1,
                            shadowIntensity: 1
                        },
                        directional: {
                            enabled: true,
                            intensity: 0.8,
                            shadowIntensity: 1
                        }
                    });
                    var lights = {};
                    // Create an spot light
                    lights.spot = new pc__namespace.Entity();
                    lights.spot.addComponent("light", __assign({
                        type: "spot",
                        color: pc__namespace.Color.WHITE,
                        innerConeAngle: 30,
                        outerConeAngle: 31,
                        range: 100,
                        castShadows: true,
                        shadowBias: 0.05,
                        normalOffsetBias: 0.03,
                        shadowResolution: 2048,
                        // heart texture's alpha channel as a cookie texture
                        cookie: assets.heart.resource,
                        cookieChannel: "a"
                    }, data.get('lights.spot')));
                    var cone = new pc__namespace.Entity();
                    cone.addComponent("render", {
                        type: "cone",
                        castShadows: false,
                        material: createMaterial({ emissive: pc__namespace.Color.WHITE })
                    });
                    lights.spot.addChild(cone);
                    app.root.addChild(lights.spot);
                    // construct the cubemap asset for the omni light cookie texture
                    // Note: the textures array could contain 6 texture asset names to load instead as well
                    var cubemapAsset = new pc__namespace.Asset('xmas_cubemap', 'cubemap', null, {
                        textures: [
                            assets.xmas_posx.id, assets.xmas_negx.id,
                            assets.xmas_posy.id, assets.xmas_negy.id,
                            assets.xmas_posz.id, assets.xmas_negz.id
                        ]
                    });
                    cubemapAsset.loadFaces = true;
                    app.assets.add(cubemapAsset);
                    // Create a omni light
                    lights.omni = new pc__namespace.Entity();
                    lights.omni.addComponent("light", __assign({
                        type: "omni",
                        color: pc__namespace.Color.YELLOW,
                        castShadows: true,
                        range: 111,
                        cookieAsset: cubemapAsset,
                        cookieChannel: "rgb"
                    }, data.get('lights.omni')));
                    lights.omni.addComponent("render", {
                        type: "sphere",
                        castShadows: false,
                        material: createMaterial({ diffuse: pc__namespace.Color.BLACK, emissive: pc__namespace.Color.YELLOW })
                    });
                    app.root.addChild(lights.omni);
                    // Create a directional light
                    lights.directional = new pc__namespace.Entity();
                    lights.directional.addComponent("light", __assign({
                        type: "directional",
                        color: pc__namespace.Color.CYAN,
                        range: 100,
                        shadowDistance: 50,
                        castShadows: true,
                        shadowBias: 0.1,
                        normalOffsetBias: 0.2
                    }, data.get('lights.directional')));
                    app.root.addChild(lights.directional);
                    // Allow user to toggle individual lights
                    app.keyboard.on("keydown", function (e) {
                        // if the user is editing an input field, ignore key presses
                        if (e.element.constructor.name === 'HTMLInputElement')
                            return;
                        switch (e.key) {
                            case pc__namespace.KEY_1:
                                data.set('lights.omni.enabled', !data.get('lights.omni.enabled'));
                                break;
                            case pc__namespace.KEY_2:
                                data.set('lights.spot.enabled', !data.get('lights.spot.enabled'));
                                break;
                            case pc__namespace.KEY_3:
                                data.set('lights.directional.enabled', !data.get('lights.directional.enabled'));
                                break;
                        }
                    }, _this);
                    // Simple update loop to rotate the light
                    var angleRad = 1;
                    app.on("update", function (dt) {
                        angleRad += 0.3 * dt;
                        if (entity) {
                            lights.spot.lookAt(new pc__namespace.Vec3(0, -5, 0));
                            lights.spot.rotateLocal(90, 0, 0);
                            lights.spot.setLocalPosition(15 * Math.sin(angleRad), 25, 15 * Math.cos(angleRad));
                            lights.omni.setLocalPosition(5 * Math.sin(-2 * angleRad), 10, 5 * Math.cos(-2 * angleRad));
                            lights.omni.rotate(0, 50 * dt, 0);
                            lights.directional.setLocalEulerAngles(45, -60 * angleRad, 0);
                        }
                    });
                    data.on('*:set', function (path, value) {
                        var pathArray = path.split('.');
                        if (pathArray[2] === 'enabled') {
                            lights[pathArray[1]].enabled = value;
                        }
                        else {
                            // @ts-ignore
                            lights[pathArray[1]].light[pathArray[2]] = value;
                        }
                    });
                });
            });
        };
        LightsExample.CATEGORY = 'Graphics';
        LightsExample.NAME = 'Lights';
        LightsExample.WEBGPU_ENABLED = true;
        return LightsExample;
    }());

    var LightPhysicalUnitsExample = /** @class */ (function () {
        function LightPhysicalUnitsExample() {
        }
        LightPhysicalUnitsExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Lights' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Rect (lm)' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.rect.luminance' }, min: 0.0, max: 800000.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Point (lm)' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.point.luminance' }, min: 0.0, max: 800000.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Spot (lm)' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.spot.luminance' }, min: 0.0, max: 200000.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Spot angle' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.spot.aperture' }, min: 1.0, max: 90.0 }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Camera' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Aperture (F/x)' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.camera.aperture' }, min: 1.0, max: 16.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Shutter (1/x) s' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.camera.shutter' }, min: 1.0, max: 1000.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'ISO' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.camera.sensitivity' }, min: 100.0, max: 1000.0 }))),
                React__default["default"].createElement(react.Panel, { headerText: 'Scene' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Animate' },
                        React__default["default"].createElement(react.BooleanInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.camera.animate' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Physical' },
                        React__default["default"].createElement(react.BooleanInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.scene.physicalUnits' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Skylight' },
                        React__default["default"].createElement(react.BooleanInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.scene.sky' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Sky (lm/m2)' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.sky.luminance' }, min: 0.0, max: 100000.0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Sun (lm/m2)' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'script.sun.luminance' }, min: 0.0, max: 100000.0 }))));
        };
        LightPhysicalUnitsExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                orbitCamera: new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                lights: new pc__namespace.Asset('lights', 'container', { url: '/static/assets/models/Lights.glb' }),
                sheen: new pc__namespace.Asset('sheen', 'container', { url: '/static/assets/models/SheenChair.glb' }),
                color: new pc__namespace.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.jpg' }),
                normal: new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/seaside-rocks01-normal.jpg' }),
                gloss: new pc__namespace.Asset('gloss', 'texture', { url: '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
                luts: new pc__namespace.Asset('luts', 'json', { url: '/static/assets/json/area-light-luts.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.JsonHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    app.scene.ambientLight.set(1, 0, 0);
                    app.scene.ambientLuminance = 20000;
                    // enable area lights which are disabled by default for clustered lighting
                    app.scene.lighting.areaLightsEnabled = true;
                    // set the loaded area light LUT data
                    var luts = assets.luts.resource;
                    app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);
                    var sheen1 = assets.sheen.resource.instantiateRenderEntity({
                        castShadows: true
                    });
                    sheen1.setLocalScale(new pc__namespace.Vec3(3, 3, 3));
                    sheen1.setLocalPosition(7, -1.0, 0);
                    app.root.addChild(sheen1);
                    var sheen2 = assets.sheen.resource.instantiateRenderEntity({
                        castShadows: true
                    });
                    sheen2.setLocalScale(new pc__namespace.Vec3(3, 3, 3));
                    sheen2.setLocalPosition(4, -1.0, 0);
                    assets.sheen.resource.applyMaterialVariant(sheen2, "Peacock Velvet");
                    app.root.addChild(sheen2);
                    var lights = assets.lights.resource.instantiateRenderEntity({
                        castShadows: true
                    });
                    // enable all lights from the glb
                    var lightComponents = lights.findComponents("light");
                    lightComponents.forEach(function (component) {
                        component.enabled = true;
                    });
                    lights.setLocalPosition(10, 0, 0);
                    app.root.addChild(lights);
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuseMap = assets.color.resource;
                    material.normalMap = assets.normal.resource;
                    material.gloss = 0.8;
                    material.glossMap = assets.gloss.resource;
                    material.metalness = 0.7;
                    material.useMetalness = true;
                    material.diffuseMapTiling.set(17, 17);
                    material.normalMapTiling.set(17, 17);
                    material.glossMapTiling.set(17, 17);
                    material.update();
                    var plane = new pc__namespace.Entity();
                    plane.addComponent('render', {
                        type: 'plane',
                        material: material
                    });
                    plane.setLocalScale(new pc__namespace.Vec3(100, 0, 100));
                    plane.setLocalPosition(0, -1.0, 0);
                    app.root.addChild(plane);
                    data.set('script', {
                        sun: {
                            luminance: 100000
                        },
                        sky: {
                            luminance: 20000
                        },
                        spot: {
                            luminance: 200000,
                            aperture: 45
                        },
                        point: {
                            luminance: 100000
                        },
                        rect: {
                            luminance: 200000
                        },
                        camera: {
                            aperture: 16.0,
                            shutter: 1000,
                            sensitivity: 1000,
                            animate: false
                        },
                        scene: {
                            physicalUnits: true,
                            sky: true
                        }
                    });
                    app.scene.physicalUnits = data.get('script.scene.physicalUnits');
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxLuminance = data.get('script.sky.luminance');
                    var directionalLight = new pc__namespace.Entity();
                    directionalLight.addComponent("light", {
                        type: "directional",
                        color: pc__namespace.Color.WHITE,
                        castShadows: true,
                        luminance: data.get('script.sun.luminance'),
                        shadowBias: 0.2,
                        normalOffsetBias: 0.05,
                        shadowResolution: 2048
                    });
                    directionalLight.setEulerAngles(45, 35, 0);
                    app.root.addChild(directionalLight);
                    var omniLight = new pc__namespace.Entity();
                    omniLight.addComponent("light", {
                        type: "omni",
                        color: pc__namespace.Color.WHITE,
                        castShadows: false,
                        luminance: data.get('script.point.luminance'),
                        shadowBias: 0.2,
                        normalOffsetBias: 0.05,
                        shadowResolution: 2048
                    });
                    omniLight.setLocalPosition(0, 5, 0);
                    app.root.addChild(omniLight);
                    var spotLight = new pc__namespace.Entity();
                    spotLight.addComponent("light", {
                        type: "spot",
                        color: pc__namespace.Color.WHITE,
                        castShadows: false,
                        luminance: data.get('script.spot.luminance'),
                        shadowBias: 0.2,
                        normalOffsetBias: 0.05,
                        shadowResolution: 2048,
                        outerConeAngle: data.get('script.spot.aperture'),
                        innerConeAngle: 0
                    });
                    spotLight.setEulerAngles(0, 0, 0);
                    spotLight.setLocalPosition(10, 5, 5);
                    app.root.addChild(spotLight);
                    var areaLight = new pc__namespace.Entity();
                    areaLight.addComponent("light", {
                        type: "spot",
                        shape: pc__namespace.LIGHTSHAPE_RECT,
                        color: pc__namespace.Color.YELLOW,
                        range: 9999,
                        luminance: data.get('script.rect.luminance'),
                        falloffMode: pc__namespace.LIGHTFALLOFF_INVERSESQUARED,
                        innerConeAngle: 80,
                        outerConeAngle: 85,
                        normalOffsetBias: 0.1
                    });
                    areaLight.setLocalScale(4, 1, 5);
                    areaLight.setEulerAngles(70, 180, 0);
                    areaLight.setLocalPosition(5, 3, -5);
                    // emissive material that is the light source color
                    var brightMaterial = new pc__namespace.StandardMaterial();
                    brightMaterial.emissive = pc__namespace.Color.YELLOW;
                    brightMaterial.emissiveIntensity = areaLight.light.luminance;
                    brightMaterial.useLighting = false;
                    brightMaterial.cull = pc__namespace.CULLFACE_NONE;
                    brightMaterial.update();
                    var brightShape = new pc__namespace.Entity();
                    // primitive shape that matches light source shape
                    brightShape.addComponent("render", {
                        type: "plane",
                        material: brightMaterial,
                        castShadows: false
                    });
                    areaLight.addChild(brightShape);
                    app.root.addChild(areaLight);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5),
                        aperture: data.get('script.camera.aperture'),
                        shutter: 1 / data.get('script.camera.shutter'),
                        sensitivity: data.get('script.camera.sensitivity')
                    });
                    camera.setLocalPosition(0, 5, 11);
                    camera.camera.requestSceneColorMap(true);
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: sheen1,
                            distanceMin: 1,
                            distanceMax: 400,
                            frameOnStart: false
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    data.on('*:set', function (path, value) {
                        if (path === 'script.sun.luminance') {
                            directionalLight.light.luminance = value;
                        }
                        else if (path === 'script.sky.luminance') {
                            app.scene.skyboxLuminance = value;
                        }
                        else if (path === 'script.spot.luminance') {
                            spotLight.light.luminance = value;
                        }
                        else if (path === 'script.spot.aperture') {
                            spotLight.light.outerConeAngle = value;
                        }
                        else if (path === 'script.point.luminance') {
                            omniLight.light.luminance = value;
                        }
                        else if (path === 'script.rect.luminance') {
                            areaLight.light.luminance = value;
                            brightMaterial.emissiveIntensity = value;
                            brightMaterial.update();
                        }
                        else if (path === 'script.camera.aperture') {
                            camera.camera.aperture = value;
                        }
                        else if (path === 'script.camera.shutter') {
                            camera.camera.shutter = 1 / value;
                        }
                        else if (path === 'script.camera.sensitivity') {
                            camera.camera.sensitivity = value;
                        }
                        else if (path === 'script.scene.physicalUnits') {
                            app.scene.physicalUnits = value;
                        }
                        else if (path === 'script.scene.sky') {
                            if (value) {
                                app.scene.setSkybox(assets.helipad.resources);
                            }
                            else {
                                app.scene.setSkybox(null);
                            }
                        }
                    });
                    var resizeControlPanel = true;
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // resize control panel to fit the content better
                        if (resizeControlPanel) {
                            var panel = window.top.document.getElementById('controlPanel');
                            if (panel) {
                                panel.style.width = '360px';
                                resizeControlPanel = false;
                            }
                        }
                        if (data.get('script.camera.animate')) {
                            data.set('script.camera.aperture', 3 + (1 + Math.sin(time)) * 5.0);
                        }
                    });
                });
            });
        };
        LightPhysicalUnitsExample.CATEGORY = 'Graphics';
        LightPhysicalUnitsExample.NAME = 'Light Physical Units';
        LightPhysicalUnitsExample.WEBGPU_ENABLED = true;
        return LightPhysicalUnitsExample;
    }());

    var LinesExample = /** @class */ (function () {
        function LinesExample() {
        }
        LinesExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.skyboxMip = 2;
                    app.scene.exposure = 0.2;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxRotation = new pc__namespace.Quat().setFromEulerAngles(0, 30, 0);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                    });
                    camera.setLocalPosition(80, 40, 80);
                    camera.lookAt(new pc__namespace.Vec3(0, -35, 0));
                    app.root.addChild(camera);
                    // Create a directional light
                    var directionallight = new pc__namespace.Entity();
                    directionallight.addComponent("light", {
                        type: "directional",
                        color: pc__namespace.Color.WHITE,
                        castShadows: false
                    });
                    app.root.addChild(directionallight);
                    // create a circle of meshes
                    var meshes = [];
                    var numMeshes = 10;
                    for (var i = 0; i < numMeshes; i++) {
                        var entity = new pc__namespace.Entity();
                        entity.setLocalScale(4, 4, 4);
                        // use material with random color
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                        material.update();
                        // create render component
                        entity.addComponent("render", {
                            type: (i % 2 ? "sphere" : "cylinder"),
                            material: material,
                            receiveShadows: false
                        });
                        if (!(i % 2)) {
                            entity.setLocalScale(3, 5, 3);
                        }
                        // add entity for rendering
                        app.root.addChild(entity);
                        meshes.push(entity);
                    }
                    // helper function to generate elevation of a point with [x, y] coordinates
                    function groundElevation(time, x, z) {
                        return Math.sin(time + 0.2 * x) * 2 + Math.cos(time * 0.2 + 0.5 * z + 0.2 * x);
                    }
                    // helper function to generate a color for 3d point by lerping between green and red color
                    // based on its y coordinate
                    function groundColor(color, point) {
                        color.lerp(pc__namespace.Color.GREEN, pc__namespace.Color.RED, pc__namespace.math.clamp((point.y + 3) * 0.25, 0, 1));
                    }
                    // Set an update function on the app's update event
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // generate grid of lines - store positions and colors as an arrays of numbers instead of
                        // Vec3s and Colors to improve performance
                        var positions = [];
                        var colors = [];
                        // temporary instances for calculations
                        var pt1 = new pc__namespace.Vec3();
                        var pt2 = new pc__namespace.Vec3();
                        var pt3 = new pc__namespace.Vec3();
                        var c1 = new pc__namespace.Color();
                        var c2 = new pc__namespace.Color();
                        var c3 = new pc__namespace.Color();
                        for (var x = 1; x < 60; x++) {
                            for (var z = 1; z < 60; z++) {
                                // generate 3 points: one start point, one along x and one along z axis
                                pt1.set(x, groundElevation(time, x, z), z);
                                pt2.set(x - 1, groundElevation(time, x - 1, z), z);
                                pt3.set(x, groundElevation(time, x, z - 1), z - 1);
                                // generate colors for the 3 points
                                groundColor(c1, pt1);
                                groundColor(c2, pt2);
                                groundColor(c3, pt3);
                                // add line connecting points along z axis
                                if (x > 1) {
                                    positions.push(pt1.x, pt1.y, pt1.z, pt2.x, pt2.y, pt2.z);
                                    colors.push(c1.r, c1.g, c1.b, c1.a, c2.r, c2.g, c2.b, c2.a);
                                }
                                // add line connecting points along x axis
                                if (z > 1) {
                                    positions.push(pt1.x, pt1.y, pt1.z, pt3.x, pt3.y, pt3.z);
                                    colors.push(c1.r, c1.g, c1.b, c1.a, c3.r, c3.g, c3.b, c3.a);
                                }
                            }
                        }
                        // submit the generated arrays of lines and colors for rendering
                        app.drawLineArrays(positions, colors);
                        // array of Vec3 and Color classes for different way to render lines
                        var grayLinePositions = [];
                        var grayLineColors = [];
                        // handle the array of meshes
                        for (var i = 0; i < numMeshes; i++) {
                            // move them equally spaced out around in the circle
                            var offset = i * Math.PI * 2 / numMeshes;
                            var entity = meshes[i];
                            entity.setLocalPosition(30 + 20 * Math.sin(time * 0.2 + offset), 5 + 2 * Math.sin(time + 3 * i / numMeshes), 30 + 20 * Math.cos(time * 0.2 + offset));
                            // rotate the meshes
                            entity.rotate((i + 1) * dt, 4 * (i + 1) * dt, 6 * (i + 1) * dt);
                            // draw a single magenta line from this mesh to the next mesh
                            var nextEntity = meshes[(i + 1) % meshes.length];
                            app.drawLine(entity.getPosition(), nextEntity.getPosition(), pc__namespace.Color.MAGENTA);
                            // store positions and colors of lines connecting objects to a center point
                            grayLinePositions.push(entity.getPosition(), new pc__namespace.Vec3(0, 10, 0));
                            grayLineColors.push(pc__namespace.Color.GRAY, pc__namespace.Color.GRAY);
                        }
                        // render all gray lines
                        app.drawLines(grayLinePositions, grayLineColors);
                    });
                });
            });
        };
        LinesExample.CATEGORY = 'Graphics';
        LinesExample.NAME = 'Lines';
        LinesExample.WEBGPU_ENABLED = true;
        return LinesExample;
    }());

    var LightsExample = /** @class */ (function () {
        function LightsExample() {
        }
        LightsExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    app.scene.envAtlas = assets.helipad.resource;
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera");
                    camera.translate(0, 6, 6);
                    camera.rotate(-48, 0, 0);
                    app.root.addChild(camera);
                    // Create an entity with a directional light component
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "directional"
                    });
                    app.root.addChild(light);
                    var e = light.getLocalEulerAngles();
                    light.setLocalEulerAngles(e.x + 90, e.y - 75, e.z);
                    var NUM_SPHERES_X = 11;
                    var NUM_SPHERES_Z = 6;
                    var createSphere = function (x, y, z) {
                        var material = new pc__namespace.StandardMaterial();
                        material.metalness = 1.0;
                        material.gloss = z / (NUM_SPHERES_Z - 1);
                        material.useMetalness = true;
                        material.anisotropy = ((2 * x / (NUM_SPHERES_X - 1)) - 1.0) * -1.0;
                        material.enableGGXSpecular = true;
                        material.update();
                        var sphere = new pc__namespace.Entity();
                        sphere.addComponent("render", {
                            material: material,
                            type: "sphere"
                        });
                        sphere.setLocalPosition(x - (NUM_SPHERES_X - 1) * 0.5, y, z - (NUM_SPHERES_Z - 1) * 0.5);
                        sphere.setLocalScale(0.7, 0.7, 0.7);
                        app.root.addChild(sphere);
                    };
                    var createText = function (fontAsset, message, x, y, z, rotx, roty) {
                        // Create a text element-based entity
                        var text = new pc__namespace.Entity();
                        text.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            fontAsset: fontAsset,
                            fontSize: 0.5,
                            pivot: [0.5, 0.5],
                            text: message,
                            type: pc__namespace.ELEMENTTYPE_TEXT
                        });
                        text.setLocalPosition(x, y, z);
                        text.setLocalEulerAngles(rotx, roty, 0);
                        app.root.addChild(text);
                    };
                    for (var i = 0; i < NUM_SPHERES_Z; i++) {
                        for (var j = 0; j < NUM_SPHERES_X; j++) {
                            createSphere(j, 0, i);
                        }
                    }
                    createText(assets.font, 'Anisotropy', 0, 0, ((NUM_SPHERES_Z + 1) * 0.5), -90, 0);
                    createText(assets.font, 'Roughness', -(NUM_SPHERES_X + 1) * 0.5, 0, 0, -90, 90);
                });
            });
        };
        LightsExample.CATEGORY = 'Graphics';
        LightsExample.NAME = 'Material Anisotropic';
        LightsExample.WEBGPU_ENABLED = true;
        return LightsExample;
    }());

    var MaterialBasicExample = /** @class */ (function () {
        function MaterialBasicExample() {
        }
        MaterialBasicExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' }),
                'rocks': new pc__namespace.Asset("rocks", "texture", { url: "/static/assets/textures/seaside-rocks01-diffuse-alpha.png" })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.1, 0.1, 0.1, 1)
                    });
                    camera.translate(2, 1, 8);
                    camera.lookAt(new pc__namespace.Vec3(0, -0.3, 0));
                    app.root.addChild(camera);
                    var NUM_BOXES = 5;
                    // alpha blend modes for individual rows
                    var blendModes = [
                        pc__namespace.BLEND_ADDITIVE,
                        pc__namespace.BLEND_SUBTRACTIVE,
                        pc__namespace.BLEND_SCREEN,
                        pc__namespace.BLEND_NORMAL,
                        pc__namespace.BLEND_NONE
                    ];
                    var createPrimitive = function (x, y, z) {
                        // a basic material, which does not have support for lighting
                        var material = new pc__namespace.BasicMaterial();
                        // diffuse color
                        material.color.set(x, y, 1 - y);
                        // diffuse texture with alpha channel for transparency
                        material.colorMap = assets.rocks.resource;
                        // disable culling to see back faces as well
                        material.cull = pc__namespace.CULLFACE_NONE;
                        // set up alpha test value
                        material.alphaTest = x / NUM_BOXES - 0.1;
                        // alpha blend mode
                        material.blendType = blendModes[y];
                        var box = new pc__namespace.Entity();
                        box.addComponent("render", {
                            material: material,
                            type: "box",
                            // Note: basic material cannot currently cast shadows, disable it
                            castShadows: false
                        });
                        box.setLocalPosition(x - (NUM_BOXES - 1) * 0.5, y - (NUM_BOXES - 1) * 0.5, z);
                        box.setLocalScale(0.7, 0.7, 0.7);
                        app.root.addChild(box);
                        return box;
                    };
                    var boxes = [];
                    for (var i = 0; i < NUM_BOXES; i++) {
                        for (var j = 0; j < NUM_BOXES; j++) {
                            boxes.push(createPrimitive(j, i, 0));
                        }
                    }
                    var createText = function (fontAsset, message, x, y, z, rot) {
                        // Create a text element-based entity
                        var text = new pc__namespace.Entity();
                        text.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            fontAsset: fontAsset,
                            fontSize: 0.5,
                            pivot: [0.5, 0.5],
                            text: message,
                            type: pc__namespace.ELEMENTTYPE_TEXT
                        });
                        text.setLocalPosition(x, y, z);
                        text.setLocalEulerAngles(0, 0, rot);
                        app.root.addChild(text);
                    };
                    createText(assets.font, 'Alpha Test', 0, -(NUM_BOXES + 1) * 0.5, 0, 0);
                    createText(assets.font, 'Alpha Blend', -(NUM_BOXES + 1) * 0.5, 0, 0, 90);
                    // Set an update function on the app's update event
                    var time = 0;
                    var rot = new pc__namespace.Quat();
                    app.on("update", function (dt) {
                        time += dt;
                        // rotate the boxes
                        rot.setFromEulerAngles(20 * time, 30 * time, 0);
                        boxes.forEach(function (box) {
                            box.setRotation(rot);
                        });
                    });
                });
            });
        };
        MaterialBasicExample.CATEGORY = 'Graphics';
        MaterialBasicExample.NAME = 'Material Basic';
        MaterialBasicExample.WEBGPU_ENABLED = true;
        return MaterialBasicExample;
    }());

    var MaterialClearCoatExample = /** @class */ (function () {
        function MaterialClearCoatExample() {
        }
        MaterialClearCoatExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/flakes5n.png' }),
                'diffuse': new pc__namespace.Asset('diffuse', 'texture', { url: '/static/assets/textures/flakes5c.png' }),
                'other': new pc__namespace.Asset('other', 'texture', { url: '/static/assets/textures/flakes5o.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxMip = 1;
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera");
                    camera.translate(0, 0, 3);
                    app.root.addChild(camera);
                    // Create an entity with a directional light component
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "directional",
                        color: new pc__namespace.Color(1, 0.8, 0.25)
                    });
                    app.root.addChild(light);
                    light.setLocalEulerAngles(85, -100, 0);
                    // function to create sphere
                    var createSphere = function (x, y, z, material) {
                        var sphere = new pc__namespace.Entity();
                        sphere.addComponent("render", {
                            material: material,
                            type: "sphere"
                        });
                        sphere.setLocalPosition(x, y, z);
                        sphere.setLocalScale(0.7, 0.7, 0.7);
                        app.root.addChild(sphere);
                    };
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuseMap = assets.diffuse.resource;
                    material.metalnessMap = assets.other.resource;
                    material.metalnessMapChannel = 'r';
                    material.glossMap = assets.other.resource;
                    material.glossMapChannel = 'g';
                    material.normalMap = assets.normal.resource;
                    material.diffuse = new pc__namespace.Color(0.6, 0.6, 0.9);
                    material.diffuseTint = true;
                    material.metalness = 1.0;
                    material.gloss = 0.9;
                    material.bumpiness = 0.7;
                    material.useMetalness = true;
                    material.update();
                    createSphere(-0.5, 0, 0, material);
                    var clearCoatMaterial = new pc__namespace.StandardMaterial();
                    clearCoatMaterial.diffuseMap = assets.diffuse.resource;
                    clearCoatMaterial.metalnessMap = assets.other.resource;
                    clearCoatMaterial.metalnessMapChannel = 'r';
                    clearCoatMaterial.glossMap = assets.other.resource;
                    clearCoatMaterial.glossMapChannel = 'g';
                    clearCoatMaterial.normalMap = assets.normal.resource;
                    clearCoatMaterial.diffuse = new pc__namespace.Color(0.6, 0.6, 0.9);
                    clearCoatMaterial.diffuseTint = true;
                    clearCoatMaterial.metalness = 1.0;
                    clearCoatMaterial.gloss = 0.9;
                    clearCoatMaterial.bumpiness = 0.7;
                    clearCoatMaterial.useMetalness = true;
                    clearCoatMaterial.clearCoat = 0.25;
                    clearCoatMaterial.clearCoatGloss = 0.9;
                    clearCoatMaterial.update();
                    createSphere(0.5, 0, 0, clearCoatMaterial);
                    // update things each frame
                    var time = 0;
                    app.on("update", function (dt) {
                        // rotate camera around the objects
                        time += dt;
                        camera.setLocalPosition(3 * Math.sin(time * 0.5), 0, 3 * Math.cos(time * 0.5));
                        camera.lookAt(pc__namespace.Vec3.ZERO);
                    });
                });
            });
        };
        MaterialClearCoatExample.CATEGORY = 'Graphics';
        MaterialClearCoatExample.NAME = 'Material Clear Coat';
        MaterialClearCoatExample.WEBGPU_ENABLED = true;
        return MaterialClearCoatExample;
    }());

    var MaterialPhysicalExample = /** @class */ (function () {
        function MaterialPhysicalExample() {
        }
        MaterialPhysicalExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera");
                    camera.translate(0, 0, 9);
                    app.root.addChild(camera);
                    var NUM_SPHERES = 5;
                    var createSphere = function (x, y, z) {
                        var material = new pc__namespace.StandardMaterial();
                        material.metalness = y / (NUM_SPHERES - 1);
                        material.gloss = x / (NUM_SPHERES - 1);
                        material.useMetalness = true;
                        material.update();
                        var sphere = new pc__namespace.Entity();
                        sphere.addComponent("render", {
                            material: material,
                            type: "sphere"
                        });
                        sphere.setLocalPosition(x - (NUM_SPHERES - 1) * 0.5, y - (NUM_SPHERES - 1) * 0.5, z);
                        sphere.setLocalScale(0.9, 0.9, 0.9);
                        app.root.addChild(sphere);
                    };
                    var createText = function (fontAsset, message, x, y, z, rot) {
                        // Create a text element-based entity
                        var text = new pc__namespace.Entity();
                        text.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            fontAsset: fontAsset,
                            fontSize: 0.5,
                            pivot: [0.5, 0.5],
                            text: message,
                            type: pc__namespace.ELEMENTTYPE_TEXT
                        });
                        text.setLocalPosition(x, y, z);
                        text.setLocalEulerAngles(0, 0, rot);
                        app.root.addChild(text);
                    };
                    for (var i = 0; i < NUM_SPHERES; i++) {
                        for (var j = 0; j < NUM_SPHERES; j++) {
                            createSphere(j, i, 0);
                        }
                    }
                    createText(assets.font, 'Glossiness', 0, -(NUM_SPHERES + 1) * 0.5, 0, 0);
                    createText(assets.font, 'Metalness', -(NUM_SPHERES + 1) * 0.5, 0, 0, 90);
                    // rotate the skybox using mouse input
                    var mouse = new pc__namespace.Mouse(document.body);
                    var x = 0;
                    var y = 0;
                    var rot = new pc__namespace.Quat();
                    mouse.on('mousemove', function (event) {
                        if (event.buttons[pc__namespace.MOUSEBUTTON_LEFT]) {
                            x += event.dx;
                            y += event.dy;
                            rot.setFromEulerAngles(0.2 * y, 0.2 * x, 0);
                            app.scene.skyboxRotation = rot;
                        }
                    });
                });
            }).catch(console.error);
        };
        MaterialPhysicalExample.CATEGORY = 'Graphics';
        MaterialPhysicalExample.NAME = 'Material Physical';
        MaterialPhysicalExample.WEBGPU_ENABLED = true;
        return MaterialPhysicalExample;
    }());

    var MaterialTranslucentSpecularExample = /** @class */ (function () {
        function MaterialTranslucentSpecularExample() {
        }
        MaterialTranslucentSpecularExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxMip = 1;
                    app.scene.skyboxIntensity = 1;
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera");
                    camera.translate(0, 0, 8);
                    camera.rotate(0, 0, 0);
                    app.root.addChild(camera);
                    // Create an entities with a directional light components
                    for (var i = 0; i < 3; i++) {
                        var light = new pc__namespace.Entity();
                        light.addComponent("light", {
                            type: "directional"
                        });
                        app.root.addChild(light);
                        light.rotateLocal(60 + 10 * i, 30 + 90 * i, 0);
                    }
                    var NUM_SPHERES_X = 10;
                    var NUM_SPHERES_Z = 5;
                    var createSphere = function (x, y, z) {
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = new pc__namespace.Color(0.7, 0.7, 0.7);
                        material.specular = new pc__namespace.Color(1, 1, 1);
                        material.metalness = 0.0;
                        material.gloss = ((z) / (NUM_SPHERES_Z - 1) * 0.5) + 0.5;
                        material.useMetalness = true;
                        material.blendType = pc__namespace.BLEND_NORMAL;
                        material.opacity = (x >= 5) ? ((x - 5) / 5 + 0.2) * ((x - 5) / 5 + 0.2) : (x / 5 + 0.2) * (x / 5 + 0.2);
                        material.opacityFadesSpecular = !(x >= 5);
                        material.alphaWrite = false;
                        material.update();
                        var sphere = new pc__namespace.Entity();
                        sphere.addComponent("render", {
                            material: material,
                            type: "sphere"
                        });
                        sphere.setLocalPosition(x - (NUM_SPHERES_X - 1) * 0.5, z - (NUM_SPHERES_Z - 1) * 0.5, 0);
                        sphere.setLocalScale(0.7, 0.7, 0.7);
                        app.root.addChild(sphere);
                    };
                    var createText = function (fontAsset, message, x, y, z, rotx, roty) {
                        // Create a text element-based entity
                        var text = new pc__namespace.Entity();
                        text.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            fontAsset: fontAsset,
                            fontSize: 0.5,
                            pivot: [0.5, 0.5],
                            text: message,
                            type: pc__namespace.ELEMENTTYPE_TEXT
                        });
                        text.setLocalPosition(x, y, z);
                        text.setLocalEulerAngles(rotx, roty, 0);
                        app.root.addChild(text);
                    };
                    for (var i = 0; i < NUM_SPHERES_Z; i++) {
                        for (var j = 0; j < NUM_SPHERES_X; j++) {
                            createSphere(j, 0, i);
                        }
                    }
                    createText(assets.font, 'Spec Fade On', -NUM_SPHERES_X * 0.25, ((NUM_SPHERES_Z + 1) * -0.5), 0, -0, 0);
                    createText(assets.font, 'Spec Fade Off', NUM_SPHERES_X * 0.25, ((NUM_SPHERES_Z + 1) * -0.5), 0, -0, 0);
                });
            });
        };
        MaterialTranslucentSpecularExample.CATEGORY = 'Graphics';
        MaterialTranslucentSpecularExample.NAME = 'Material Translucent Specular';
        MaterialTranslucentSpecularExample.WEBGPU_ENABLED = true;
        return MaterialTranslucentSpecularExample;
    }());

    var MeshDecalsExample = /** @class */ (function () {
        function MeshDecalsExample() {
        }
        MeshDecalsExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'spark': new pc__namespace.Asset('spark', 'texture', { url: '/static/assets/textures/spark.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                    // create material for the plane
                    var planeMaterial = new pc__namespace.StandardMaterial();
                    planeMaterial.gloss = 0.6;
                    planeMaterial.metalness = 0.3;
                    planeMaterial.useMetalness = true;
                    planeMaterial.update();
                    // create plane primitive
                    var primitive = new pc__namespace.Entity();
                    primitive.addComponent('render', {
                        type: "plane",
                        material: planeMaterial
                    });
                    // set position and scale and add it to scene
                    primitive.setLocalScale(new pc__namespace.Vec3(20, 20, 20));
                    primitive.setLocalPosition(new pc__namespace.Vec3(0, -0.01, 0));
                    app.root.addChild(primitive);
                    // Create an Entity with a omni light component
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        color: new pc__namespace.Color(0.2, 0.2, 0.2),
                        range: 30,
                        castShadows: true,
                        shadowBias: 0.1,
                        normalOffsetBias: 0.2
                    });
                    light.translate(0, 8, 0);
                    app.root.addChild(light);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.2, 0.2, 0.2)
                    });
                    // Add the camera to the hierarchy
                    app.root.addChild(camera);
                    // Position the camera
                    camera.translate(0, 10, 20);
                    camera.lookAt(pc__namespace.Vec3.ZERO);
                    // Create bouncing ball model and add it to hierarchy
                    var ball = new pc__namespace.Entity();
                    ball.addComponent("render", {
                        type: "sphere"
                    });
                    app.root.addChild(ball);
                    // Allocate space for decals. Each decal is a quad with 4 vertices
                    var numDecals = 500;
                    var numDecalVertices = 4 * numDecals;
                    // Allocate storage for vertex positions, vertex stores x, y and z
                    var positions = new Float32Array(3 * numDecalVertices);
                    // Allocate storage for colors, each vertex stores r, g, b and a
                    var colors = new Uint8ClampedArray(4 * numDecalVertices);
                    // Allocate storage for uvs, each vertex stores u and v. And fill them up to display whole texture
                    var uvs = [];
                    for (var i = 0; i < numDecals; i++)
                        uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
                    // Allocate and generate indices. Each quad is representing using 2 triangles, and uses 4 vertices
                    var quadTriangles = [
                        0, 1, 2,
                        2, 3, 0
                    ];
                    var indices = new Uint16Array(6 * numDecals);
                    for (var i = 0; i < numDecals; i++) {
                        indices[6 * i + 0] = 4 * i + quadTriangles[0];
                        indices[6 * i + 1] = 4 * i + quadTriangles[1];
                        indices[6 * i + 2] = 4 * i + quadTriangles[2];
                        indices[6 * i + 3] = 4 * i + quadTriangles[3];
                        indices[6 * i + 4] = 4 * i + quadTriangles[4];
                        indices[6 * i + 5] = 4 * i + quadTriangles[5];
                    }
                    // Helper function to generate a decal with index i at position pos. It fills up information for all 4 vertices of a quad
                    function createDecal(i, pos) {
                        // random size and rotation angle
                        var size = 0.5 + Math.random();
                        var angle = Math.random() * Math.PI;
                        // random color
                        var r = Math.random() * 255;
                        var g = Math.random() * 255;
                        var b = Math.random() * 255;
                        for (var j = 0; j < 4; j++) {
                            colors[i * 16 + j * 4 + 0] = r;
                            colors[i * 16 + j * 4 + 1] = g;
                            colors[i * 16 + j * 4 + 2] = b;
                            colors[i * 16 + j * 4 + 3] = 0; // alpha is not used by shader
                        }
                        // vertex positions to form a square quad with random rotation and size
                        positions[12 * i + 0] = pos.x + size * Math.sin(angle);
                        positions[12 * i + 1] = 0;
                        positions[12 * i + 2] = pos.z + size * Math.cos(angle);
                        angle += Math.PI * 0.5;
                        positions[12 * i + 3] = pos.x + size * Math.sin(angle);
                        positions[12 * i + 4] = 0;
                        positions[12 * i + 5] = pos.z + size * Math.cos(angle);
                        angle += Math.PI * 0.5;
                        positions[12 * i + 6] = pos.x + size * Math.sin(angle);
                        positions[12 * i + 7] = 0;
                        positions[12 * i + 8] = pos.z + size * Math.cos(angle);
                        angle += Math.PI * 0.5;
                        positions[12 * i + 9] = pos.x + size * Math.sin(angle);
                        positions[12 * i + 10] = 0;
                        positions[12 * i + 11] = pos.z + size * Math.cos(angle);
                        angle += Math.PI * 0.5;
                    }
                    // helper function to update required vertex streams
                    function updateMesh(mesh, updatePositions, updateColors, initAll) {
                        // update positions when needed
                        if (updatePositions)
                            mesh.setPositions(positions);
                        // update colors when needed
                        if (updateColors)
                            mesh.setColors32(colors);
                        // update indices and uvs only one time, as they never change
                        if (initAll) {
                            mesh.setIndices(indices);
                            mesh.setUvs(0, uvs);
                        }
                        mesh.update(pc__namespace.PRIMITIVE_TRIANGLES);
                    }
                    // Create a mesh with dynamic vertex buffer and static index buffer
                    var mesh = new pc__namespace.Mesh(app.graphicsDevice);
                    mesh.clear(true, false);
                    updateMesh(mesh, true, true, true);
                    // create material
                    var material = new pc__namespace.StandardMaterial();
                    material.useLighting = false; // turn off lighting - we use emissive texture only. Also, lighting needs normal maps which we don't generate
                    material.diffuse = new pc__namespace.Color(0, 0, 0);
                    material.emissiveVertexColor = true;
                    material.blendType = pc__namespace.BLEND_ADDITIVE; // additive alpha blend
                    material.depthWrite = false; // optimization - no need to write to depth buffer, as decals are part of the ground plane
                    material.emissiveMap = assets.spark.resource;
                    material.update();
                    // Create the mesh instance
                    var meshInstance = new pc__namespace.MeshInstance(mesh, material);
                    // Create Entity with a render component to render the mesh instance
                    var entity = new pc__namespace.Entity();
                    entity.addComponent("render", {
                        type: 'asset',
                        meshInstances: [meshInstance],
                        castShadows: false
                    });
                    app.root.addChild(entity);
                    // Set an update function on the app's update event
                    var time = 0;
                    var decalIndex = 0;
                    app.on("update", function (dt) {
                        var previousTime = time;
                        time += dt;
                        // Bounce the ball around in a circle with changing radius
                        var radius = Math.abs(Math.sin(time * 0.55) * 9);
                        var previousElevation = 2 * Math.cos(previousTime * 7);
                        var elevation = 2 * Math.cos(time * 7);
                        ball.setLocalPosition(new pc__namespace.Vec3(radius * Math.sin(time), 0.5 + Math.abs(elevation), radius * Math.cos(time)));
                        // When ball crossed the ground plane
                        var positionsUpdated = false;
                        var colorsUpdated = false;
                        if ((previousElevation < 0 && elevation >= 0) || (elevation < 0 && previousElevation >= 0)) {
                            // create new decal at next index, and roll the index around if out of range
                            createDecal(decalIndex, ball.getLocalPosition());
                            decalIndex++;
                            if (decalIndex >= numDecals)
                                decalIndex = 0;
                            // both position and color streams were updated
                            positionsUpdated = true;
                            colorsUpdated = true;
                        }
                        // fade out all vertex colors once a second
                        if (Math.round(time) != Math.round(previousTime)) {
                            for (var i = 0; i < colors.length; i++)
                                colors[i] -= 2;
                            // colors were updated
                            colorsUpdated = true;
                        }
                        // update mesh with the streams that were updated
                        updateMesh(mesh, positionsUpdated, colorsUpdated);
                    });
                });
            });
        };
        MeshDecalsExample.CATEGORY = 'Graphics';
        MeshDecalsExample.NAME = 'Mesh Decals';
        MeshDecalsExample.WEBGPU_ENABLED = true;
        return MeshDecalsExample;
    }());

    var MeshDeformationExample = /** @class */ (function () {
        function MeshDeformationExample() {
        }
        MeshDeformationExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.skyboxMip = 2;
                    app.scene.exposure = 1;
                    app.scene.envAtlas = assets.helipad.resource;
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0, 7, 24);
                    app.root.addChild(camera);
                    // create a hierarchy of entities with render components, representing the statue model
                    var entity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(entity);
                    // collect positions from all mesh instances to work on
                    var allMeshes = [];
                    var renders = entity.findComponents("render");
                    renders.forEach(function (render) {
                        // collect positions from all mesh instances on this render component
                        var meshInstances = render.meshInstances;
                        for (var i = 0; i < meshInstances.length; i++) {
                            var meshInstance = meshInstances[i];
                            // get positions from the mesh
                            var mesh = meshInstance.mesh;
                            var srcPositions = [];
                            mesh.getPositions(srcPositions);
                            // store it
                            allMeshes.push({
                                mesh: mesh,
                                srcPositions: srcPositions
                            });
                        }
                    });
                    // temporary work array of positions to avoid per frame allocations
                    var tempPositions = [];
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        if (entity) {
                            // orbit the camera
                            camera.setLocalPosition(25 * Math.sin(time * 0.2), 15, 25 * Math.cos(time * 0.2));
                            camera.lookAt(new pc__namespace.Vec3(0, 7, 0));
                            var strength = 50;
                            // modify mesh positions on each frame
                            for (var i = 0; i < allMeshes.length; i++) {
                                tempPositions.length = 0;
                                var srcPositions = allMeshes[i].srcPositions;
                                // loop over all positions, and fill up tempPositions array with waved version of positions from srcPositions array
                                // modify .x and .z components based on sin function, which uses .y component
                                for (var k = 0; k < srcPositions.length; k += 3) {
                                    tempPositions[k] = srcPositions[k] + strength * Math.sin(time + srcPositions[k + 1] * 0.01);
                                    tempPositions[k + 1] = srcPositions[k + 1];
                                    tempPositions[k + 2] = srcPositions[k + 2] + strength * Math.sin(time + srcPositions[k + 1] * 0.01);
                                }
                                // set new positions on the mesh
                                var mesh = allMeshes[i].mesh;
                                mesh.setPositions(tempPositions);
                                mesh.update();
                            }
                        }
                    });
                });
            }).catch(console.error);
        };
        MeshDeformationExample.CATEGORY = 'Graphics';
        MeshDeformationExample.NAME = 'Mesh Deformation';
        MeshDeformationExample.WEBGPU_ENABLED = true;
        return MeshDeformationExample;
    }());

    var MeshGenerationExample = /** @class */ (function () {
        function MeshGenerationExample() {
        }
        MeshGenerationExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'playcanvasGrey': new pc__namespace.Asset('playcanvasGrey', 'texture', { url: '/static/assets/textures/playcanvas-grey.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.ambientLight = new pc__namespace.Color(0.1, 0.1, 0.1);
                    // helper function to create a light
                    function createLight(color, scale) {
                        // Create an Entity with a omni light component, which is casting shadows (using rendering to cubemap)
                        var light = new pc__namespace.Entity();
                        light.addComponent("light", {
                            type: "omni",
                            color: color,
                            radius: 10,
                            castShadows: false
                        });
                        // create material of specified color
                        var material = new pc__namespace.StandardMaterial();
                        material.emissive = color;
                        material.update();
                        // add sphere at the position of light
                        light.addComponent("render", {
                            type: "sphere",
                            material: material
                        });
                        // Scale the sphere
                        light.setLocalScale(scale, scale, scale);
                        app.root.addChild(light);
                        return light;
                    }
                    // create 4 lights that will move in the scene and deform the mesh as well
                    var lights = [
                        { radius: 7, speed: 1.0, scale: 2.5, light: createLight(new pc__namespace.Color(0.3, 0.9, 0.6), 1.0) },
                        { radius: 3, speed: 1.2, scale: 3.0, light: createLight(new pc__namespace.Color(0.7, 0.2, 0.3), 1.3) },
                        { radius: 5, speed: -0.8, scale: 4.0, light: createLight(new pc__namespace.Color(0.2, 0.2, 0.9), 1.5) },
                        { radius: 4, speed: -0.3, scale: 5.5, light: createLight(new pc__namespace.Color(0.8, 0.9, 0.4), 1.7) }
                    ];
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.2, 0.2, 0.2)
                    });
                    // Add the new Entity to the hierarchy
                    app.root.addChild(camera);
                    // Position the camera
                    camera.translate(0, 5, 20);
                    camera.lookAt(pc__namespace.Vec3.ZERO);
                    // Generate a 3D grid plane with world size of 20, and resolution of 60
                    var resolution = 60;
                    var extent = 20;
                    var scale = extent / resolution;
                    // Generate positions and uv coordinates for vertices, store them in Float32Arrays
                    var positions = new Float32Array(3 * resolution * resolution);
                    var uvs = new Float32Array(2 * resolution * resolution);
                    var index = 0;
                    for (var x = 0; x < resolution; x++) {
                        for (var z = 0; z < resolution; z++) {
                            positions[3 * index] = scale * (x - resolution * 0.5);
                            positions[3 * index + 1] = 0; // no elevation, flat grid
                            positions[3 * index + 2] = scale * (z - resolution * 0.5);
                            uvs[2 * index] = x / resolution;
                            uvs[2 * index + 1] = 1 - z / resolution;
                            index++;
                        }
                    }
                    // Generate array of indices to form triangle list - two triangles per grid square
                    var indexArray = [];
                    for (var x = 0; x < resolution - 1; x++) {
                        for (var y = 0; y < resolution - 1; y++) {
                            indexArray.push(x * resolution + y + 1, (x + 1) * resolution + y, x * resolution + y, (x + 1) * resolution + y, x * resolution + y + 1, (x + 1) * resolution + y + 1);
                        }
                    }
                    // helper function to update required vertex / index streams
                    function updateMesh(mesh, initAll) {
                        // Set updated positions and normal each frame
                        mesh.setPositions(positions);
                        // @ts-ignore engine-tsd
                        mesh.setNormals(pc__namespace.calculateNormals(positions, indexArray));
                        // update mesh Uvs and Indices only one time, as they do not change each frame
                        if (initAll) {
                            mesh.setUvs(0, uvs);
                            mesh.setIndices(indexArray);
                        }
                        // Let mesh update Vertex and Index buffer as needed
                        mesh.update(pc__namespace.PRIMITIVE_TRIANGLES);
                    }
                    // Create a mesh with dynamic vertex buffer and static index buffer
                    var mesh = new pc__namespace.Mesh(app.graphicsDevice);
                    mesh.clear(true, false);
                    updateMesh(mesh, true);
                    // create material
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuseMap = assets.playcanvasGrey.resource;
                    material.gloss = 0.5;
                    material.metalness = 0.3;
                    material.useMetalness = true;
                    material.update();
                    // Create the mesh instance
                    var meshInstance = new pc__namespace.MeshInstance(mesh, material);
                    // Create the entity with render component using meshInstances
                    var entity = new pc__namespace.Entity();
                    entity.addComponent("render", {
                        meshInstances: [meshInstance]
                    });
                    app.root.addChild(entity);
                    // Set an update function on the app's update event
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // Move the lights along circles, also keep separate list of their position for faster update in next block of code
                        var lightPositions = [];
                        for (var l = 0; l < lights.length; l++) {
                            var element = lights[l];
                            var lightPos = new pc__namespace.Vec2(element.radius * Math.sin(time * element.speed), element.radius * Math.cos(time * element.speed));
                            lightPositions.push(lightPos);
                            element.light.setLocalPosition(lightPos.x, 3, lightPos.y);
                        }
                        // animate .y coordinate of grid vertices by moving them up when lights are close
                        var index = 0;
                        for (var x = 0; x < resolution; x++) {
                            for (var z = 0; z < resolution; z++) {
                                var elevation = 0;
                                // Evaluate distance of grid vertex to each light position, and increase elevation if light is within the range
                                for (var l = 0; l < lightPositions.length; l++) {
                                    var dx = positions[index] - lightPositions[l].x;
                                    var dz = positions[index + 2] - lightPositions[l].y;
                                    var dist = Math.sqrt(dx * dx + dz * dz);
                                    dist = pc__namespace.math.clamp(dist, 0, lights[l].scale);
                                    dist = pc__namespace.math.smoothstep(0, lights[l].scale, dist);
                                    elevation += (1 - dist);
                                }
                                // Store elevation in .y element
                                positions[index + 1] = elevation;
                                index += 3;
                            }
                        }
                        // update the mesh
                        updateMesh(mesh);
                    });
                });
            });
        };
        MeshGenerationExample.CATEGORY = 'Graphics';
        MeshGenerationExample.NAME = 'Mesh Generation';
        MeshGenerationExample.WEBGPU_ENABLED = true;
        return MeshGenerationExample;
    }());

    var MeshMorphManyExample = /** @class */ (function () {
        function MeshMorphManyExample() {
        }
        MeshMorphManyExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                morph: new pc__namespace.Asset('glb', 'container', { url: '/static/assets/models/morph-stress-test.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.skyboxMip = 2;
                    app.scene.exposure = 1.2;
                    app.scene.envAtlas = assets.helipad.resource;
                    // create an instance of the morph target model
                    var morphEntity = assets.morph.resource.instantiateRenderEntity();
                    app.root.addChild(morphEntity);
                    // get the morph instance, which we apply the weights to
                    var morphInstance = morphEntity.render.meshInstances[1].morphInstance;
                    // Create an entity with a directional light component
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "directional",
                        castShadows: true,
                        shadowBias: 0.5,
                        normalOffsetBias: 0.2,
                        shadowDistance: 25
                    });
                    app.root.addChild(light);
                    light.setLocalEulerAngles(45, 45, 0);
                    // Create an entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera");
                    app.root.addChild(camera);
                    // position the camera
                    camera.setLocalPosition(0, 4, 9);
                    camera.lookAt(pc__namespace.Vec3.ZERO);
                    // update function called once per frame
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // modify weights of all morph targets along sin curve
                        var targetsCount = morphInstance.morph.targets.length;
                        for (var i = 0; i < targetsCount; i++) {
                            morphInstance.setWeight(i, Math.abs(Math.sin(time + i * 0.4)));
                        }
                        // debug display the morph target textures blended together
                        if (morphInstance.texturePositions) {
                            // @ts-ignore
                            app.drawTexture(-0.7, -0.7, 0.4, 0.4, morphInstance.texturePositions);
                        }
                    });
                });
            });
        };
        MeshMorphManyExample.CATEGORY = 'Graphics';
        MeshMorphManyExample.NAME = 'Mesh Morph Many';
        return MeshMorphManyExample;
    }());

    var MeshMorphExample = /** @class */ (function () {
        function MeshMorphExample() {
        }
        MeshMorphExample.prototype.example = function (canvas, deviceType) {
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                app.start();
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                // Create an entity with a directional light component
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    type: "directional"
                });
                app.root.addChild(light);
                light.setLocalEulerAngles(45, 30, 0);
                // Create an entity with a camera component
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                });
                app.root.addChild(camera);
                // helper function to return the shortest distance from point [x, y, z] to a plane defined by [a, b, c] normal
                var shortestDistance = function (x, y, z, a, b, c) {
                    var d = Math.abs(a * x + b * y + c * z);
                    var e = Math.sqrt(a * a + b * b + c * c);
                    return d / e;
                };
                // helper function that creates a morph target from original positions, normals and indices, and a plane normal [nx, ny, nz]
                var createMorphTarget = function (positions, normals, indices, nx, ny, nz) {
                    // modify vertices to separate array
                    var modifiedPositions = new Float32Array(positions.length);
                    var dist, i, displacement;
                    var limit = 0.2;
                    for (i = 0; i < positions.length; i += 3) {
                        // distance of the point to the specified plane
                        dist = shortestDistance(positions[i], positions[i + 1], positions[i + 2], nx, ny, nz);
                        // modify distance to displacement amount - displace nearby points more than distant points
                        displacement = pc__namespace.math.smoothstep(0, limit, dist);
                        displacement = 1 - displacement;
                        // generate new position by extruding vertex along normal by displacement
                        modifiedPositions[i] = positions[i] + normals[i] * displacement;
                        modifiedPositions[i + 1] = positions[i + 1] + normals[i + 1] * displacement;
                        modifiedPositions[i + 2] = positions[i + 2] + normals[i + 2] * displacement;
                    }
                    // generate normals based on modified positions and indices
                    // @ts-ignore engine-tsd
                    var modifiedNormals = new Float32Array(pc__namespace.calculateNormals(modifiedPositions, indices));
                    // generate delta positions and normals - as morph targets store delta between base position / normal and modified position / normal
                    for (i = 0; i < modifiedNormals.length; i++) {
                        modifiedPositions[i] -= positions[i];
                        modifiedNormals[i] -= normals[i];
                    }
                    // create a morph target
                    // @ts-ignore engine-tsd
                    return new pc__namespace.MorphTarget({
                        deltaPositions: modifiedPositions,
                        deltaNormals: modifiedNormals
                    });
                };
                var createMorphInstance = function (x, y, z) {
                    // create the base mesh - a sphere, with higher amount of vertices / triangles
                    var mesh = pc__namespace.createSphere(app.graphicsDevice, { latitudeBands: 200, longitudeBands: 200 });
                    // obtain base mesh vertex / index data
                    var srcPositions = [];
                    var srcNormals = [];
                    var indices = [];
                    mesh.getPositions(srcPositions);
                    mesh.getNormals(srcNormals);
                    mesh.getIndices(indices);
                    // build 3 targets by expanding a part of sphere along 3 planes, specified by the normal
                    var targets = [];
                    targets.push(createMorphTarget(srcPositions, srcNormals, indices, 1, 0, 0));
                    targets.push(createMorphTarget(srcPositions, srcNormals, indices, 0, 1, 0));
                    targets.push(createMorphTarget(srcPositions, srcNormals, indices, 0, 0, 1));
                    // create a morph using these 3 targets
                    mesh.morph = new pc__namespace.Morph(targets, app.graphicsDevice);
                    // Create the mesh instance
                    var material = new pc__namespace.StandardMaterial();
                    var meshInstance = new pc__namespace.MeshInstance(mesh, material);
                    // add morph instance - this is where currently set weights are stored
                    var morphInstance = new pc__namespace.MorphInstance(mesh.morph);
                    meshInstance.morphInstance = morphInstance;
                    // Create Entity and add it to the scene
                    var entity = new pc__namespace.Entity();
                    entity.setLocalPosition(x, y, z);
                    app.root.addChild(entity);
                    // Add a render component with meshInstance
                    entity.addComponent('render', {
                        material: material,
                        meshInstances: [meshInstance]
                    });
                    return morphInstance;
                };
                // create 3 morph instances
                var morphInstances = [];
                for (var k = 0; k < 3; k++) {
                    morphInstances.push(createMorphInstance(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3));
                }
                // update function called once per frame
                var time = 0;
                app.on("update", function (dt) {
                    time += dt;
                    for (var m = 0; m < morphInstances.length; m++) {
                        // modify weights of all 3 morph targets along some sin curve with different frequency
                        morphInstances[m].setWeight(0, Math.abs(Math.sin(time + m)));
                        morphInstances[m].setWeight(1, Math.abs(Math.sin(time * 0.3 + m)));
                        morphInstances[m].setWeight(2, Math.abs(Math.sin(time * 0.7 + m)));
                    }
                    // orbit camera around
                    camera.setLocalPosition(16 * Math.sin(time * 0.2), 4, 16 * Math.cos(time * 0.2));
                    camera.lookAt(pc__namespace.Vec3.ZERO);
                    // debug display the morph target textures blended together
                    if (morphInstances[0].texturePositions) {
                        // @ts-ignore
                        app.drawTexture(-0.7, -0.7, 0.4, 0.4, morphInstances[0].texturePositions);
                    }
                    if (morphInstances[0].textureNormals) {
                        // @ts-ignore
                        app.drawTexture(0.7, -0.7, 0.4, 0.4, morphInstances[0].textureNormals);
                    }
                });
            });
        };
        MeshMorphExample.CATEGORY = 'Graphics';
        MeshMorphExample.NAME = 'Mesh Morph';
        MeshMorphExample.WEBGPU_ENABLED = true;
        return MeshMorphExample;
    }());

    var ModelAssetExample = /** @class */ (function () {
        function ModelAssetExample() {
        }
        ModelAssetExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.ModelComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                    // create an entity with render assets
                    var entity = assets.statue.resource.instantiateModelEntity({
                        castShadows: true
                    });
                    app.root.addChild(entity);
                    // clone a small version of the entity
                    var clone = entity.clone();
                    clone.setLocalScale(0.2, 0.2, 0.2);
                    clone.setLocalPosition(-4, 12, 0);
                    app.root.addChild(clone);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0, 7, 24);
                    app.root.addChild(camera);
                    // Create an Entity with a omni light component
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        color: new pc__namespace.Color(1, 1, 1),
                        range: 100,
                        castShadows: true
                    });
                    light.translate(5, 0, 15);
                    app.root.addChild(light);
                    app.on("update", function (dt) {
                        if (entity) {
                            entity.rotate(0, 10 * dt, 0);
                        }
                    });
                });
            });
        };
        ModelAssetExample.CATEGORY = 'Graphics';
        ModelAssetExample.NAME = 'Model Asset';
        ModelAssetExample.WEBGPU_ENABLED = true;
        return ModelAssetExample;
    }());

    var ModelOutlineExample = /** @class */ (function () {
        function ModelOutlineExample() {
        }
        ModelOutlineExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'outline': new pc__namespace.Asset('outline', 'script', { url: '/static/scripts/posteffects/posteffect-outline.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                    // helper function to create a primitive with shape type, position, scale, color and layer
                    function createPrimitive(primitiveType, position, scale, color, layer) {
                        // create material of specified color
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = color;
                        material.update();
                        // create primitive
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            layers: layer,
                            material: material
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // create texture and render target for rendering into, including depth buffer
                    function createRenderTarget() {
                        var texture = new pc__namespace.Texture(app.graphicsDevice, {
                            name: 'OutlineObjects',
                            width: app.graphicsDevice.width,
                            height: app.graphicsDevice.height,
                            format: pc__namespace.PIXELFORMAT_RGBA8,
                            mipmaps: false,
                            minFilter: pc__namespace.FILTER_LINEAR,
                            magFilter: pc__namespace.FILTER_LINEAR
                        });
                        return new pc__namespace.RenderTarget({
                            colorBuffer: texture,
                            depth: true
                        });
                    }
                    var renderTarget = createRenderTarget();
                    // create a layer for rendering to texture, and add it to the beginning of layers to render into it first
                    var outlineLayer = new pc__namespace.Layer({ name: "OutlineLayer" });
                    app.scene.layers.insert(outlineLayer, 0);
                    // get world layer
                    var worldLayer = app.scene.layers.getLayerByName("World");
                    // create ground plane and 3 primitives, visible in both layers
                    createPrimitive("plane", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(20, 20, 20), new pc__namespace.Color(0.3, 0.5, 0.3), [worldLayer.id]);
                    createPrimitive("sphere", new pc__namespace.Vec3(-2, 1, 0), new pc__namespace.Vec3(2, 2, 2), new pc__namespace.Color(1, 0, 0), [worldLayer.id]);
                    createPrimitive("box", new pc__namespace.Vec3(2, 1, 0), new pc__namespace.Vec3(2, 2, 2), new pc__namespace.Color(1, 1, 0), [worldLayer.id, outlineLayer.id]);
                    createPrimitive("cone", new pc__namespace.Vec3(0, 1, -2), new pc__namespace.Vec3(2, 2, 2), new pc__namespace.Color(0, 1, 1), [worldLayer.id]);
                    // Create main camera, which renders entities in world layer
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.2, 0.2, 0.4),
                        layers: [worldLayer.id]
                    });
                    camera.translate(0, 20, 25);
                    camera.lookAt(pc__namespace.Vec3.ZERO);
                    // Create outline camera, which renders entities in outline layer into the render target
                    var outlineCamera = new pc__namespace.Entity();
                    outlineCamera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.0, 0.0, 0.0, 0.0),
                        layers: [outlineLayer.id],
                        renderTarget: renderTarget
                    });
                    app.root.addChild(outlineCamera);
                    // @ts-ignore engine-tsd
                    var outline = new OutlineEffect(app.graphicsDevice, 3);
                    outline.color = new pc__namespace.Color(0, 0.5, 1, 1);
                    outline.texture = renderTarget.colorBuffer;
                    camera.camera.postEffects.addEffect(outline);
                    app.root.addChild(camera);
                    // Create an Entity with a omni light component and add it to both layers
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        color: new pc__namespace.Color(1, 1, 1),
                        range: 20,
                        castShadows: true,
                        shadowBias: 0.05,
                        normalOffsetBias: 0.03,
                        layers: [worldLayer.id]
                    });
                    light.translate(0, 2, 5);
                    app.root.addChild(light);
                    // handle canvas resize
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                        // re-create the render target for the outline camera
                        renderTarget.colorBuffer.destroy();
                        renderTarget.destroy();
                        renderTarget = createRenderTarget();
                        outlineCamera.camera.renderTarget = renderTarget;
                        outline.texture = renderTarget.colorBuffer;
                    });
                    // update things each frame
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // rotate the camera around the objects
                        camera.setLocalPosition(12 * Math.sin(time), 5, 12 * Math.cos(time));
                        camera.lookAt(pc__namespace.Vec3.ZERO);
                        // outline camera needs to match the main camera
                        outlineCamera.setLocalPosition(camera.getLocalPosition());
                        outlineCamera.setLocalRotation(camera.getLocalRotation());
                    });
                });
            });
        };
        ModelOutlineExample.CATEGORY = 'Graphics';
        ModelOutlineExample.NAME = 'Model Outline';
        return ModelOutlineExample;
    }());

    var ModelTexturedBoxExample = /** @class */ (function () {
        function ModelTexturedBoxExample() {
        }
        ModelTexturedBoxExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'clouds': new pc__namespace.Asset('clouds', 'texture', { url: '/static/assets/textures/clouds.jpg' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                    // material with the diffuse texture
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuseMap = assets.clouds.resource;
                    material.update();
                    // Create a Entity with a Box model component
                    var box = new pc__namespace.Entity();
                    box.addComponent("render", {
                        type: "box",
                        material: material
                    });
                    // Create an Entity with a omni light component and a sphere model component.
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        color: new pc__namespace.Color(1, 0, 0),
                        radius: 10
                    });
                    light.addComponent("render", {
                        type: "sphere"
                    });
                    // Scale the sphere down to 0.1m
                    light.setLocalScale(0.1, 0.1, 0.1);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    // Add the new Entities to the hierarchy
                    app.root.addChild(box);
                    app.root.addChild(light);
                    app.root.addChild(camera);
                    // Move the camera 10m along the z-axis
                    camera.translate(0, 0, 10);
                    // Set an update function on the app's update event
                    var angle = 0;
                    app.on("update", function (dt) {
                        angle += dt;
                        if (angle > 360) {
                            angle = 0;
                        }
                        // Move the light in a circle
                        light.setLocalPosition(3 * Math.sin(angle), 0, 3 * Math.cos(angle));
                        // Rotate the box
                        box.setEulerAngles(angle * 2, angle * 4, angle * 8);
                    });
                });
            });
        };
        ModelTexturedBoxExample.CATEGORY = 'Graphics';
        ModelTexturedBoxExample.NAME = 'Model Textured Box';
        ModelTexturedBoxExample.WEBGPU_ENABLED = true;
        return ModelTexturedBoxExample;
    }());

    var MultiViewExample = /** @class */ (function () {
        function MultiViewExample() {
        }
        MultiViewExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Debug Shader Rendering' }, React__default["default"].createElement(react.LabelGroup, { text: 'Mode' },
                    React__default["default"].createElement(react.SelectInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.shaderPassName' }, type: "string", options: [
                            { v: pc__namespace.SHADERPASS_FORWARD, t: 'None' },
                            { v: pc__namespace.SHADERPASS_ALBEDO, t: 'Albedo' },
                            { v: pc__namespace.SHADERPASS_OPACITY, t: 'Opacity' },
                            { v: pc__namespace.SHADERPASS_WORLDNORMAL, t: 'World Normal' },
                            { v: pc__namespace.SHADERPASS_SPECULARITY, t: 'Specularity' },
                            { v: pc__namespace.SHADERPASS_GLOSS, t: 'Gloss' },
                            { v: pc__namespace.SHADERPASS_METALNESS, t: 'Metalness' },
                            { v: pc__namespace.SHADERPASS_AO, t: 'AO' },
                            { v: pc__namespace.SHADERPASS_EMISSION, t: 'Emission' },
                            { v: pc__namespace.SHADERPASS_LIGHTING, t: 'Lighting' },
                            { v: pc__namespace.SHADERPASS_UV0, t: 'UV0' }
                        ] }))));
        };
        MultiViewExample.prototype.example = function (canvas, deviceType, data) {
            // set up and load draco module, as the glb we load is draco compressed
            pc__namespace.WasmModule.setConfig('DracoDecoderModule', {
                glueUrl: '/static/lib/draco/draco.wasm.js',
                wasmUrl: '/static/lib/draco/draco.wasm.wasm',
                fallbackUrl: '/static/lib/draco/draco.js'
            });
            pc__namespace.WasmModule.getInstance('DracoDecoderModule', demo);
            function demo() {
                var assets = {
                    'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                    'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                    'board': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/chess-board.glb' })
                };
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.mouse = new pc__namespace.Mouse(document.body);
                    createOptions.touch = new pc__namespace.TouchDevice(document.body);
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.RenderComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem,
                        // @ts-ignore
                        pc__namespace.ScriptComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler,
                        // @ts-ignore
                        pc__namespace.ScriptHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                    assetListLoader.load(function () {
                        app.start();
                        data.set('settings', {
                            shaderPassName: pc__namespace.SHADERPASS_FORWARD
                        });
                        // get the instance of the chess board and set up with render component
                        var boardEntity = assets.board.resource.instantiateRenderEntity({
                            castShadows: true,
                            receiveShadows: true
                        });
                        app.root.addChild(boardEntity);
                        // Create left camera
                        var cameraLeft = new pc__namespace.Entity('LeftCamera');
                        cameraLeft.addComponent("camera", {
                            farClip: 500,
                            rect: new pc__namespace.Vec4(0, 0, 0.5, 0.5)
                        });
                        app.root.addChild(cameraLeft);
                        // Create right orthographic camera
                        var cameraRight = new pc__namespace.Entity('RightCamera');
                        cameraRight.addComponent("camera", {
                            farClip: 500,
                            rect: new pc__namespace.Vec4(0.5, 0, 0.5, 0.5),
                            projection: pc__namespace.PROJECTION_ORTHOGRAPHIC,
                            orthoHeight: 150
                        });
                        cameraRight.translate(0, 150, 0);
                        cameraRight.lookAt(pc__namespace.Vec3.ZERO, pc__namespace.Vec3.RIGHT);
                        app.root.addChild(cameraRight);
                        // Create top camera
                        var cameraTop = new pc__namespace.Entity('TopCamera');
                        cameraTop.addComponent("camera", {
                            farClip: 500,
                            rect: new pc__namespace.Vec4(0, 0.5, 1, 0.5)
                        });
                        cameraTop.translate(-100, 75, 100);
                        cameraTop.lookAt(0, 7, 0);
                        app.root.addChild(cameraTop);
                        // add orbit camera script with a mouse and a touch support
                        cameraTop.addComponent("script");
                        cameraTop.script.create("orbitCamera", {
                            attributes: {
                                inertiaFactor: 0.2,
                                focusEntity: app.root,
                                distanceMax: 300,
                                frameOnStart: false
                            }
                        });
                        cameraTop.script.create("orbitCameraInputMouse");
                        cameraTop.script.create("orbitCameraInputTouch");
                        // Create a single directional light which casts shadows
                        var dirLight = new pc__namespace.Entity();
                        dirLight.addComponent("light", {
                            type: "directional",
                            color: pc__namespace.Color.WHITE,
                            intensity: 2,
                            range: 500,
                            shadowDistance: 500,
                            castShadows: true,
                            shadowBias: 0.2,
                            normalOffsetBias: 0.05
                        });
                        app.root.addChild(dirLight);
                        dirLight.setLocalEulerAngles(45, 0, 30);
                        // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
                        app.scene.envAtlas = assets.helipad.resource;
                        app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                        app.scene.skyboxMip = 1;
                        // handle HUD changes - update the debug mode on the top camera
                        data.on('*:set', function (path, value) {
                            cameraTop.camera.setShaderPass(value);
                        });
                        // update function called once per frame
                        var time = 0;
                        app.on("update", function (dt) {
                            time += dt;
                            // orbit camera left around
                            cameraLeft.setLocalPosition(100 * Math.sin(time * 0.2), 35, 100 * Math.cos(time * 0.2));
                            cameraLeft.lookAt(pc__namespace.Vec3.ZERO);
                            // zoom in and out the orthographic camera
                            cameraRight.camera.orthoHeight = 90 + Math.sin(time * 0.3) * 60;
                        });
                    });
                });
            }
        };
        MultiViewExample.CATEGORY = 'Graphics';
        MultiViewExample.NAME = 'Multi View';
        MultiViewExample.WEBGPU_ENABLED = true;
        return MultiViewExample;
    }());

    var MrtExample = /** @class */ (function () {
        function MrtExample() {
        }
        MrtExample.prototype.example = function (canvas, deviceType, files) {
            // set up and load draco module, as the glb we load is draco compressed
            pc__namespace.WasmModule.setConfig('DracoDecoderModule', {
                glueUrl: '/static/lib/draco/draco.wasm.js',
                wasmUrl: '/static/lib/draco/draco.wasm.wasm',
                fallbackUrl: '/static/lib/draco/draco.js'
            });
            var assets = {
                'board': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/chess-board.glb' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxMip = 1;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // get world and skybox layers
                    var worldLayer = app.scene.layers.getLayerByName("World");
                    var skyboxLayer = app.scene.layers.getLayerByName("Skybox");
                    // create a layer for object that render into texture, add it right after the world layer
                    var rtLayer = new pc__namespace.Layer({ name: "RTLayer" });
                    app.scene.layers.insert(rtLayer, 1);
                    // helper function to create a texture to render to
                    var createTexture = function (name, width, height) {
                        return new pc__namespace.Texture(app.graphicsDevice, {
                            name: name,
                            width: width,
                            height: height,
                            format: pc__namespace.PIXELFORMAT_R8_G8_B8_A8,
                            mipmaps: true,
                            minFilter: pc__namespace.FILTER_LINEAR_MIPMAP_LINEAR,
                            magFilter: pc__namespace.FILTER_LINEAR,
                            addressU: pc__namespace.ADDRESS_CLAMP_TO_EDGE,
                            addressV: pc__namespace.ADDRESS_CLAMP_TO_EDGE
                        });
                    };
                    // create textures and render target for rendering into, including depth buffer
                    var texture0 = createTexture('RT-texture-0', 512, 512);
                    var texture1 = createTexture('RT-texture-1', 512, 512);
                    var texture2 = createTexture('RT-texture-2', 512, 512);
                    // render to multiple targets if supported
                    var colorBuffers = app.graphicsDevice.supportsMrt ? [texture0, texture1, texture2] : [texture0];
                    var renderTarget = new pc__namespace.RenderTarget({
                        name: "MRT",
                        colorBuffers: colorBuffers,
                        depth: true,
                        flipY: true,
                        samples: 2
                    });
                    // Create texture camera, which renders entities in RTLayer into the texture
                    var textureCamera = new pc__namespace.Entity("TextureCamera");
                    textureCamera.addComponent("camera", {
                        layers: [rtLayer.id],
                        farClip: 500,
                        // set the priority of textureCamera to lower number than the priority of the main camera (which is at default 0)
                        // to make it rendered first each frame
                        priority: -1,
                        // this camera renders into texture target
                        renderTarget: renderTarget
                    });
                    app.root.addChild(textureCamera);
                    // if MRT is supported, set the shader pass to use MRT output
                    if (app.graphicsDevice.supportsMrt) {
                        textureCamera.camera.setShaderPass('MyMRT');
                    }
                    // get the instance of the chess board. Render it into RTLayer only.
                    var boardEntity = assets.board.resource.instantiateRenderEntity({
                        layers: [rtLayer.id]
                    });
                    app.root.addChild(boardEntity);
                    // override output shader chunk for the material of the chess board, to inject our
                    // custom shader chunk which outputs to multiple render targets during our custom
                    // shader pass
                    var outputChunk = files['output.frag'];
                    var renders = boardEntity.findComponents("render");
                    renders.forEach(function (render) {
                        var meshInstances = render.meshInstances;
                        for (var i = 0; i < meshInstances.length; i++) {
                            // @ts-ignore engine-tsd
                            meshInstances[i].material.chunks.outputPS = outputChunk;
                        }
                    });
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        layers: [worldLayer.id, skyboxLayer.id]
                    });
                    app.root.addChild(camera);
                    // update things every frame
                    var angle = 1;
                    app.on("update", function (dt) {
                        angle += dt;
                        // orbit the camera around
                        textureCamera.setLocalPosition(110 * Math.sin(angle * 0.2), 45, 110 * Math.cos(angle * 0.2));
                        textureCamera.lookAt(pc__namespace.Vec3.ZERO);
                        // debug draw the texture on the screen in the world layer of the main camera
                        // @ts-ignore engine-tsd
                        app.drawTexture(0, 0.4, 1, 1, texture0, null, worldLayer);
                        // @ts-ignore engine-tsd
                        app.drawTexture(-0.5, -0.5, 0.7, 0.7, texture1, null, worldLayer);
                        // @ts-ignore engine-tsd
                        app.drawTexture(0.5, -0.5, 0.7, 0.7, texture2, null, worldLayer);
                    });
                });
            });
        };
        MrtExample.CATEGORY = 'Graphics';
        MrtExample.NAME = 'Multi Render Targets';
        MrtExample.WEBGPU_ENABLED = true;
        MrtExample.FILES = {
            // shader chunk which outputs to multiple render targets
            // Note: gl_FragColor is not modified, and so the forward pass output is used for target 0
            'output.frag': /* glsl */ "\n            #ifdef MYMRT_PASS\n                // output world normal to target 1\n                pcFragColor1 = vec4(litShaderArgs.worldNormal * 0.5 + 0.5, 1.0);\n\n                // output gloss to target 2\n                pcFragColor2 = vec4(vec3(litShaderArgs.gloss) , 1.0);\n            #endif\n        "
        };
        return MrtExample;
    }());

    var PainterExample = /** @class */ (function () {
        function PainterExample() {
        }
        PainterExample.prototype.example = function (canvas, deviceType) {
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.ParticleSystemComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                app.start();
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                // helper function to create a primitive with shape type, position, scale, color and layer
                function createPrimitive(primitiveType, position, scale, layer, material) {
                    // create primitive
                    var primitive = new pc__namespace.Entity();
                    primitive.addComponent('render', {
                        type: primitiveType,
                        layers: layer,
                        material: material,
                        castShadows: false,
                        receiveShadows: false
                    });
                    // set position and scale and add it to scene
                    primitive.setLocalPosition(position);
                    primitive.setLocalScale(scale);
                    app.root.addChild(primitive);
                    return primitive;
                }
                // create texture and render target for rendering into
                var texture = new pc__namespace.Texture(app.graphicsDevice, {
                    width: 1024,
                    height: 1024,
                    format: pc__namespace.PIXELFORMAT_RGB8,
                    mipmaps: false,
                    minFilter: pc__namespace.FILTER_LINEAR,
                    magFilter: pc__namespace.FILTER_LINEAR
                });
                var renderTarget = new pc__namespace.RenderTarget({
                    colorBuffer: texture,
                    depth: false
                });
                // create a layer for rendering to texture, and add it to the beginning of layers to render into it first
                var paintLayer = new pc__namespace.Layer({ name: "paintLayer" });
                app.scene.layers.insert(paintLayer, 0);
                // create a material we use for the paint brush - it uses emissive color to control its color, which is assigned later
                var brushMaterial = new pc__namespace.StandardMaterial();
                brushMaterial.emissiveTint = true;
                brushMaterial.useLighting = false;
                brushMaterial.update();
                // we render multiple brush imprints each frame to make smooth lines, and set up pool to reuse them each frame
                var brushes = [];
                function getBrush() {
                    var brush;
                    if (brushes.length === 0) {
                        // create new brush - use sphere primitive, but could use plane with a texture as well
                        // Note: plane would need to be rotated by -90 degrees along x-axis to face camera and be visible
                        brush = createPrimitive("sphere", new pc__namespace.Vec3(2, 1, 0), new pc__namespace.Vec3(1, 1, 1), [paintLayer.id], brushMaterial);
                    }
                    else {
                        // reuse already allocated brush
                        brush = brushes.pop();
                        brush.enabled = true;
                    }
                    return brush;
                }
                // Create orthographic camera, which renders brushes in paintLayer, and renders before the main camera
                var paintCamera = new pc__namespace.Entity();
                paintCamera.addComponent("camera", {
                    clearColorBuffer: false,
                    projection: pc__namespace.PROJECTION_ORTHOGRAPHIC,
                    layers: [paintLayer.id],
                    renderTarget: renderTarget,
                    priority: -1
                });
                // make it look at the center of the render target, some distance away
                paintCamera.setLocalPosition(0, 0, -10);
                paintCamera.lookAt(pc__namespace.Vec3.ZERO);
                app.root.addChild(paintCamera);
                // Create main camera, which renders entities in world layer - this is where we show the render target on the box
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.2, 0.2, 0.2)
                });
                camera.translate(0, 0, 30);
                camera.lookAt(pc__namespace.Vec3.ZERO);
                app.root.addChild(camera);
                // material used to add render target into the world
                var material = new pc__namespace.StandardMaterial();
                material.emissiveMap = texture;
                material.useLighting = false;
                material.update();
                // create a box which we use to display rendered texture in the world layer
                var worldLayer = app.scene.layers.getLayerByName("World");
                var box = createPrimitive("box", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(15, 15, 15), [worldLayer.id], material);
                var progress = 1;
                var scale;
                var startPos, endPos;
                var pos = new pc__namespace.Vec3();
                var usedBrushes = [];
                // update things each frame
                app.on("update", function (dt) {
                    // if the last brush stroke is finished, generate new random one
                    if (progress >= 1) {
                        progress = 0;
                        // generate start and end position for the stroke
                        startPos = new pc__namespace.Vec3(Math.random() * 20 - 10, Math.random() * 20 - 10, 0);
                        endPos = new pc__namespace.Vec3(Math.random() * 20 - 10, Math.random() * 20 - 10, 0);
                        // random width (scale)
                        scale = 0.1 + Math.random();
                        // assign random color to the brush
                        brushMaterial.emissive = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                        brushMaterial.update();
                    }
                    // disable brushes from the previous frame and return them to the free pool
                    while (usedBrushes.length > 0) {
                        var brush = usedBrushes.pop();
                        brush.enabled = false;
                        brushes.push(brush);
                    }
                    // step along the brush line multiple times each frame to make the line smooth
                    var stepCount = 30;
                    var stepProgress = 0.005;
                    // in each step
                    for (var i = 0; i < stepCount; i++) {
                        // move position little bit
                        pos.lerp(startPos, endPos, progress);
                        // setup brush to be rendered this frame
                        var activeBrush = getBrush();
                        activeBrush.setLocalPosition(pos);
                        activeBrush.setLocalScale(scale, scale, scale);
                        usedBrushes.push(activeBrush);
                        // progress for the next step
                        progress += stepProgress;
                    }
                    // rotate the box in the world
                    box.rotate(5 * dt, 10 * dt, 15 * dt);
                });
            });
        };
        PainterExample.CATEGORY = 'Graphics';
        PainterExample.NAME = 'Painter';
        PainterExample.WEBGPU_ENABLED = true;
        return PainterExample;
    }());

    var PaintMeshExample = /** @class */ (function () {
        function PaintMeshExample() {
        }
        PaintMeshExample.prototype.example = function (canvas, deviceType, files) {
            // Create the app and start the update loop
            var app = new pc__namespace.Application(canvas);
            // load the textures
            var assets = {
                'helipad': new pc__namespace.Asset('helipad.dds', 'cubemap', { url: '/static/assets/cubemaps/helipad.dds' }, { type: pc__namespace.TEXTURETYPE_RGBM }),
                'color': new pc__namespace.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.jpg' }),
                'decal': new pc__namespace.Asset('color', 'texture', { url: '/static/assets/textures/heart.png' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                app.start();
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                app.scene.setSkybox(assets.helipad.resources);
                app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                app.scene.skyboxIntensity = 1;
                app.scene.skyboxMip = 2;
                // helper function to create high polygon version of a sphere and sets up an entity to allow it to be added to the scene
                var createHighQualitySphere = function (material, layer) {
                    // Create Entity and add it to the scene
                    var entity = new pc__namespace.Entity("HighResSphere");
                    app.root.addChild(entity);
                    // create hight resolution sphere
                    var mesh = pc__namespace.createSphere(app.graphicsDevice, { latitudeBands: 200, longitudeBands: 200 });
                    // Add a render component with the mesh
                    entity.addComponent('render', {
                        type: 'asset',
                        layers: layer,
                        meshInstances: [new pc__namespace.MeshInstance(mesh, material)]
                    });
                    return entity;
                };
                // We render decals to a texture, so create a render target for it. Note that the texture needs
                // to be of renderable format here, and so it cannot be compressed.
                var texture = assets.color.resource;
                var renderTarget = new pc__namespace.RenderTarget({
                    colorBuffer: texture,
                    depth: false
                });
                // create a layer for rendering to decals
                var decalLayer = new pc__namespace.Layer({ name: "decalLayer" });
                app.scene.layers.insert(decalLayer, 0);
                // Create a camera, which renders decals using a decalLayer, and renders before the main camera
                // Note that this camera does not need its position set, as it's only used to trigger
                // the rendering, but the camera matrix is not used for the rendering (our custom shader
                // does not need it).
                var decalCamera = new pc__namespace.Entity('DecalCamera');
                decalCamera.addComponent("camera", {
                    clearColorBuffer: false,
                    layers: [decalLayer.id],
                    renderTarget: renderTarget,
                    priority: -1
                });
                app.root.addChild(decalCamera);
                // Create main camera, which renders entities in world layer - this is where we show mesh with decals
                var camera = new pc__namespace.Entity('MainCamera');
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.1, 0.1, 0.1, 1)
                });
                camera.translate(20, 10, 40);
                camera.lookAt(new pc__namespace.Vec3(0, -7, 0));
                app.root.addChild(camera);
                // material used on the sphere
                var material = new pc__namespace.StandardMaterial();
                material.diffuseMap = texture;
                material.gloss = 0.6;
                material.metalness = 0.4;
                material.useMetalness = true;
                material.update();
                // sphere with the texture
                var worldLayer = app.scene.layers.getLayerByName("World");
                var meshEntity = createHighQualitySphere(material, [worldLayer.id]);
                meshEntity.setLocalScale(15, 15, 15);
                // Create the shader definition and shader from the vertex and fragment shaders
                var shaderDefinition = {
                    attributes: {
                        aPosition: pc__namespace.SEMANTIC_POSITION,
                        aUv0: pc__namespace.SEMANTIC_TEXCOORD0
                    },
                    vshader: files['shader.vert'],
                    fshader: files['shader.frag']
                };
                var shader = new pc__namespace.Shader(app.graphicsDevice, shaderDefinition);
                // Create a decal material with the new shader
                var decalMaterial = new pc__namespace.Material();
                decalMaterial.cull = pc__namespace.CULLFACE_NONE;
                decalMaterial.shader = shader;
                decalMaterial.blendType = pc__namespace.BLEND_NORMAL;
                decalMaterial.setParameter('uDecalMap', assets.decal.resource);
                // To render into uv space of the mesh, we need to render the mesh using our custom shader into
                // the texture. In order to do this, we creates a new entity, containing the same mesh instances,
                // but using our custom shader. We make it a child of the original entity, to use its transform.
                var meshInstances = meshEntity.render.meshInstances.map(function (srcMeshInstance) {
                    return new pc__namespace.MeshInstance(srcMeshInstance.mesh, decalMaterial);
                });
                var cloneEntity = new pc__namespace.Entity('cloneEntity');
                cloneEntity.addComponent('render', {
                    meshInstances: meshInstances,
                    layers: [decalLayer.id],
                    castShadows: false,
                    receiveShadows: false
                });
                meshEntity.addChild(cloneEntity);
                // Create an entity with a directional light component
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    type: "directional",
                    intensity: 3
                });
                app.root.addChild(light);
                light.setLocalEulerAngles(45, 90, 0);
                // update things each frame
                var time = 0;
                var decalTime = 0;
                var decalFrequency = 0.5;
                app.on("update", function (dt) {
                    time += dt * 0.7;
                    // a decal projection box is an orthographic projection from some position. We calculate position
                    // here to be in an orbit around the sphere. Draw a line showing the projection point and direction.
                    var decalProjectionPos = new pc__namespace.Vec3(8 * Math.cos(time), 8 * Math.cos(time * 0.3), 8 * Math.sin(time));
                    app.drawLine(decalProjectionPos, pc__namespace.Vec3.ZERO, pc__namespace.Color.WHITE);
                    // render recal every half a second
                    decalTime += dt;
                    if (decalTime > decalFrequency) {
                        decalTime -= decalFrequency;
                        // enable decal camera, which renders the decal
                        decalCamera.enabled = true;
                        // construct a view matrix, looking from the decal position to the center of the sphere
                        var viewMatrix = new pc__namespace.Mat4().setLookAt(decalProjectionPos, pc__namespace.Vec3.ZERO, pc__namespace.Vec3.UP);
                        viewMatrix.invert();
                        // ortographics projection matrix - this defines the size of the decal, but also its depth range (0..5)
                        var projMatrix = new pc__namespace.Mat4().setOrtho(-1, 1, -1, 1, 0, 5);
                        // final matrix is a combination of view and projection matrix. Make it available to the shader.
                        var viewProj = new pc__namespace.Mat4();
                        viewProj.mul2(projMatrix, viewMatrix);
                        decalMaterial.setParameter('matrix_decal_viewProj', viewProj.data);
                    }
                    else {
                        // otherwise the decal camera is disabled
                        decalCamera.enabled = false;
                    }
                    // draw the texture we render decals to for demonstration purposes
                    // @ts-ignore engine-tsd
                    app.drawTexture(0, -0.6, 1.4, 0.6, texture);
                });
            });
        };
        PaintMeshExample.CATEGORY = 'Graphics';
        PaintMeshExample.NAME = 'Paint Mesh';
        PaintMeshExample.FILES = {
            'shader.vert': /* glsl */ "\n            // Attributes per vertex: position and uv\n            attribute vec4 aPosition;\n            attribute vec2 aUv0;\n        \n            // model matrix of the mesh\n            uniform mat4 matrix_model;\n\n            // decal view-projection matrix (orthographic)\n            uniform mat4 matrix_decal_viewProj;\n\n            // decal projected position to fragment program\n            varying vec4 decalPos;\n\n            void main(void)\n            {\n                // We render in texture space, so a position of this fragment is its uv-coordinates.\n                // Changes the range of uv coordinates from 0..1 to projection space -1 to 1.\n                gl_Position = vec4(aUv0.x * 2.0 - 1.0, aUv0.y * 2.0 - 1.0, 0, 1.0);\n\n                // transform the vertex position to world space and then to decal space, and pass it\n                // to the fragment shader to sample the decal texture\n                vec4 worldPos = matrix_model * aPosition;\n                decalPos = matrix_decal_viewProj * worldPos;\n            }",
            'shader.frag': /* glsl */ "\n            precision lowp float;\n            varying vec4 decalPos;\n            uniform sampler2D uDecalMap;\n\n            void main(void)\n            {\n                // decal space position from -1..1 range, to texture space range 0..1\n                vec4 p = decalPos * 0.5 + 0.5;\n \n                // if the position is outside out 0..1 projection box, ignore the pixel\n                if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0)\n                    discard;\n\n                gl_FragColor = texture2D(uDecalMap, p.xy);\n            }"
        };
        return PaintMeshExample;
    }());

    var ParticlesAnimIndexExample = /** @class */ (function () {
        function ParticlesAnimIndexExample() {
        }
        ParticlesAnimIndexExample.prototype.example = function (canvas, deviceType) {
            // Create the application and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            var assets = {
                'particlesNumbers': new pc__namespace.Asset('particlesNumbers', 'texture', { url: '/static/assets/textures/particles-numbers.png' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                // Create an Entity with a camera component
                var cameraEntity = new pc__namespace.Entity();
                cameraEntity.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.75, 0.75, 0.75)
                });
                cameraEntity.rotateLocal(0, 0, 0);
                cameraEntity.translateLocal(0, 0, 20);
                // Create a directional light
                var lightDirEntity = new pc__namespace.Entity();
                lightDirEntity.addComponent("light", {
                    type: "directional",
                    color: new pc__namespace.Color(1, 1, 1),
                    intensity: 1
                });
                lightDirEntity.setLocalEulerAngles(45, 0, 0);
                // Create a screen to display the particle texture
                var screenEntity = new pc__namespace.Entity();
                screenEntity.addComponent("screen", { resolution: new pc__namespace.Vec2(640, 480), screenSpace: true });
                screenEntity.screen.scaleMode = "blend";
                screenEntity.screen.referenceResolution = new pc__namespace.Vec2(1280, 720);
                // Create a panel to display the full particle texture
                var panel = new pc__namespace.Entity();
                screenEntity.addChild(panel);
                // Add Entities into the scene hierarchy
                app.root.addChild(cameraEntity);
                app.root.addChild(lightDirEntity);
                app.root.addChild(screenEntity);
                // Create entity for first particle system
                var particleEntity1 = new pc__namespace.Entity();
                app.root.addChild(particleEntity1);
                particleEntity1.setLocalPosition(-3, 3, 0);
                // Create entity for second particle system
                var particleEntity2 = new pc__namespace.Entity();
                app.root.addChild(particleEntity2);
                particleEntity2.setLocalPosition(3, 3, 0);
                // Create entity for third particle system
                var particleEntity3 = new pc__namespace.Entity();
                app.root.addChild(particleEntity3);
                particleEntity3.setLocalPosition(-3, -3, 0);
                // Create entity for fourth particle system
                var particleEntity4 = new pc__namespace.Entity();
                app.root.addChild(particleEntity4);
                particleEntity4.setLocalPosition(3, -3, 0);
                // when the texture is loaded add particlesystem components to particle entities
                // gradually make sparks bigger
                var scaleCurve = new pc__namespace.Curve([0, 0, 1, 1]);
                var particleSystemConfiguration = {
                    numParticles: 8,
                    lifetime: 4,
                    rate: 0.5,
                    colorMap: assets.particlesNumbers.resource,
                    initialVelocity: 0.25,
                    emitterShape: pc__namespace.EMITTERSHAPE_SPHERE,
                    emitterRadius: 0.1,
                    animLoop: true,
                    animTilesX: 4,
                    animTilesY: 4,
                    animSpeed: 1,
                    autoPlay: true,
                    scaleGraph: scaleCurve
                };
                var options;
                options = Object.assign(particleSystemConfiguration, {
                    // states that each animation in the sprite sheet has 4 frames
                    animNumFrames: 4,
                    // set the animation index of the first particle system to 0
                    animIndex: 0
                });
                particleEntity1.addComponent("particlesystem", options);
                options = Object.assign(particleSystemConfiguration, {
                    // states that each animation in the sprite sheet has 4 frames
                    animNumFrames: 4,
                    // set the animation index of the second particle system to 1
                    animIndex: 1
                });
                particleEntity2.addComponent("particlesystem", options);
                options = Object.assign(particleSystemConfiguration, {
                    // states that each animation in the sprite sheet has 4 frames
                    animNumFrames: 4,
                    // set the animation index of the third particle system to 2
                    animIndex: 2
                });
                particleEntity3.addComponent("particlesystem", options);
                options = Object.assign(particleSystemConfiguration, {
                    // states that each animation in the sprite sheet has 4 frames
                    animNumFrames: 4,
                    // set the animation index of the fourth particle system to 3
                    animIndex: 3
                });
                particleEntity4.addComponent("particlesystem", options);
                // add the full particle texture to the panel
                panel.addComponent('element', {
                    anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                    pivot: new pc__namespace.Vec2(0.5, 0.5),
                    width: 100,
                    height: 100,
                    type: "image",
                    textureAsset: assets.particlesNumbers
                });
                app.start();
            });
        };
        ParticlesAnimIndexExample.CATEGORY = 'Graphics';
        ParticlesAnimIndexExample.NAME = 'Particles: Anim Index';
        return ParticlesAnimIndexExample;
    }());

    var ParticlesRandomSpritesExample = /** @class */ (function () {
        function ParticlesRandomSpritesExample() {
        }
        ParticlesRandomSpritesExample.prototype.example = function (canvas, deviceType) {
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(document.body),
                touch: new pc__namespace.TouchDevice(document.body),
                elementInput: new pc__namespace.ElementInput(canvas)
            });
            var assets = {
                'particlesCoinsTexture': new pc__namespace.Asset('particlesCoinsTexture', 'texture', { url: '/static/assets/textures/particles-coins.png' }),
                'particlesBonusTexture': new pc__namespace.Asset('particlesBonusTexture', 'texture', { url: '/static/assets/textures/particles-bonus.png' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                // Create an Entity with a camera component
                var cameraEntity = new pc__namespace.Entity();
                cameraEntity.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.23, 0.5, 0.75)
                });
                cameraEntity.rotateLocal(0, 0, 0);
                cameraEntity.translateLocal(0, 0, 20);
                // Create a directional light
                var lightDirEntity = new pc__namespace.Entity();
                lightDirEntity.addComponent("light", {
                    type: "directional",
                    color: new pc__namespace.Color(1, 1, 1),
                    intensity: 1
                });
                lightDirEntity.setLocalEulerAngles(45, 0, 0);
                // Create a screen to display the particle systems textures
                var screenEntity = new pc__namespace.Entity();
                screenEntity.addComponent("screen", { resolution: new pc__namespace.Vec2(640, 480), screenSpace: true });
                screenEntity.screen.scaleMode = "blend";
                screenEntity.screen.referenceResolution = new pc__namespace.Vec2(1280, 720);
                // Create a panel to display the full particle textures
                var panel = new pc__namespace.Entity();
                screenEntity.addChild(panel);
                var panel2 = new pc__namespace.Entity();
                screenEntity.addChild(panel2);
                // Add Entities into the scene hierarchy
                app.root.addChild(cameraEntity);
                app.root.addChild(lightDirEntity);
                app.root.addChild(screenEntity);
                // Create entity for first particle system
                var particleEntity1 = new pc__namespace.Entity();
                app.root.addChild(particleEntity1);
                particleEntity1.setLocalPosition(-3, 3, 0);
                // Create entity for second particle system
                var particleEntity2 = new pc__namespace.Entity();
                app.root.addChild(particleEntity2);
                particleEntity2.setLocalPosition(3, 3, 0);
                // gradually make particles bigger
                var scaleCurve = new pc__namespace.Curve([0, 0.1, 1, 0.5]);
                // make particles fade in and out
                var alphaCurve = new pc__namespace.Curve([0, 0, 0.5, 1, 1, 0]);
                var particleSystemConfiguration = function (asset, animTilesX, animTilesY) {
                    return {
                        numParticles: 32,
                        lifetime: 2,
                        rate: 0.2,
                        colorMap: asset.resource,
                        initialVelocity: 0.125,
                        emitterShape: pc__namespace.EMITTERSHAPE_SPHERE,
                        emitterRadius: 2.0,
                        animLoop: true,
                        animTilesX: animTilesX,
                        animTilesY: animTilesY,
                        animSpeed: 4,
                        autoPlay: true,
                        alphaGraph: alphaCurve,
                        scaleGraph: scaleCurve
                    };
                };
                // add particlesystem component to particle entity
                particleEntity1.addComponent("particlesystem", Object.assign(particleSystemConfiguration(assets.particlesCoinsTexture, 4, 6), {
                    // set the number of animations in the sprite sheet to 4
                    animNumAnimations: 4,
                    // set the number of frames in each animation to 6
                    animNumFrames: 6,
                    // set the particle system to randomly select a different animation for each particle
                    randomizeAnimIndex: true
                }));
                // display the full coin texture to the left of the panel
                panel.addComponent('element', {
                    anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                    pivot: new pc__namespace.Vec2(1.75, 1.0),
                    width: 150,
                    height: 225,
                    type: "image",
                    textureAsset: assets.particlesCoinsTexture
                });
                // add particlesystem component to particle entity
                particleEntity2.addComponent("particlesystem", Object.assign(particleSystemConfiguration(assets.particlesBonusTexture, 4, 2), {
                    // set the number of animations in the sprite sheet to 7
                    animNumAnimations: 7,
                    // set the number of frames in each animation to 1
                    animNumFrames: 1,
                    // set the particle system to randomly select a different animation for each particle
                    randomizeAnimIndex: true
                }));
                // display the full bonus item texture to the left of the panel
                panel2.addComponent('element', {
                    anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                    pivot: new pc__namespace.Vec2(-0.5, 1.0),
                    width: 200,
                    height: 100,
                    type: "image",
                    textureAsset: assets.particlesBonusTexture
                });
                app.start();
            });
        };
        ParticlesRandomSpritesExample.CATEGORY = 'Graphics';
        ParticlesRandomSpritesExample.NAME = 'Particles: Random Sprites';
        return ParticlesRandomSpritesExample;
    }());

    var ParticlesSnowExample = /** @class */ (function () {
        function ParticlesSnowExample() {
        }
        ParticlesSnowExample.prototype.example = function (canvas, deviceType) {
            // Create the application and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            var assets = {
                'snowflake': new pc__namespace.Asset('snowflake', 'texture', { url: '/static/assets/textures/snowflake.png' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                app.start();
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                // Create an Entity with a camera component
                var cameraEntity = new pc__namespace.Entity();
                cameraEntity.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0, 0, 0)
                });
                cameraEntity.rotateLocal(0, 0, 0);
                cameraEntity.translateLocal(0, 0, 10);
                // Create a directional light
                var lightDirEntity = new pc__namespace.Entity();
                lightDirEntity.addComponent("light", {
                    type: "directional",
                    color: new pc__namespace.Color(1, 1, 1),
                    intensity: 1
                });
                lightDirEntity.setLocalEulerAngles(45, 0, 0);
                // Add Entities into the scene hierarchy
                app.root.addChild(cameraEntity);
                app.root.addChild(lightDirEntity);
                // set up random downwards velocity from -0.4 to -0.7
                var velocityCurve = new pc__namespace.CurveSet([
                    [0, 0],
                    [0, -0.7],
                    [0, 0] // z
                ]);
                var velocityCurve2 = new pc__namespace.CurveSet([
                    [0, 0],
                    [0, -0.4],
                    [0, 0] // z
                ]);
                // set up random rotation speed from -100 to 100 degrees per second
                var rotCurve = new pc__namespace.Curve([0, 100]);
                var rotCurve2 = new pc__namespace.Curve([0, -100]);
                // scale is constant at 0.1
                var scaleCurve = new pc__namespace.Curve([0, 0.1]);
                // Create entity for particle system
                var entity = new pc__namespace.Entity();
                app.root.addChild(entity);
                entity.setLocalPosition(0, 3, 0);
                // load snowflake texture
                app.assets.loadFromUrl('/static/assets/textures/snowflake.png', 'texture', function () {
                    // when texture is loaded add particlesystem component to entity
                    entity.addComponent("particlesystem", {
                        numParticles: 100,
                        lifetime: 10,
                        rate: 0.1,
                        startAngle: 360,
                        startAngle2: -360,
                        emitterExtents: new pc__namespace.Vec3(5, 0, 0),
                        velocityGraph: velocityCurve,
                        velocityGraph2: velocityCurve2,
                        scaleGraph: scaleCurve,
                        rotationSpeedGraph: rotCurve,
                        rotationSpeedGraph2: rotCurve2,
                        colorMap: assets.snowflake.resource
                    });
                });
            });
        };
        ParticlesSnowExample.CATEGORY = 'Graphics';
        ParticlesSnowExample.NAME = 'Particles: Snow';
        return ParticlesSnowExample;
    }());

    var ParticlesSparkExample = /** @class */ (function () {
        function ParticlesSparkExample() {
        }
        ParticlesSparkExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'spark': new pc__namespace.Asset('spark', 'texture', { url: '/static/assets/textures/spark.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ParticleSystemComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Create an Entity with a camera component
                    var cameraEntity = new pc__namespace.Entity();
                    cameraEntity.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0, 0, 0.05)
                    });
                    cameraEntity.rotateLocal(0, 0, 0);
                    cameraEntity.translateLocal(0, 0, 10);
                    // Create a directional light
                    var lightDirEntity = new pc__namespace.Entity();
                    lightDirEntity.addComponent("light", {
                        type: "directional",
                        color: new pc__namespace.Color(1, 1, 1),
                        intensity: 1
                    });
                    lightDirEntity.setLocalEulerAngles(45, 0, 0);
                    // Add Entities into the scene hierarchy
                    app.root.addChild(cameraEntity);
                    app.root.addChild(lightDirEntity);
                    // Offset position
                    var localPosCurve = new pc__namespace.CurveSet([
                        [0, 0, 1, 4],
                        [0, 0, 1, 3],
                        [0, 0, 1, 0]
                    ]);
                    localPosCurve.type = pc__namespace.CURVE_LINEAR;
                    // make particles move in different directions
                    var localVelocityCurve = new pc__namespace.CurveSet([
                        [0, 0, 1, 8],
                        [0, 0, 1, 6],
                        [0, 0, 1, 0]
                    ]);
                    var localVelocityCurve2 = new pc__namespace.CurveSet([
                        [0, 0, 1, -8],
                        [0, 0, 1, -6],
                        [0, 0, 1, 0]
                    ]);
                    // increasing gravity
                    var worldVelocityCurve = new pc__namespace.CurveSet([
                        [0, 0],
                        [0, 0, 0.2, 6, 1, -48],
                        [0, 0]
                    ]);
                    // gradually make sparks bigger
                    var scaleCurve = new pc__namespace.Curve([0, 0, 0.5, 0.3, 0.8, 0.2, 1, 0.1]);
                    // rotate sparks 360 degrees per second
                    var angleCurve = new pc__namespace.Curve([0, 360]);
                    // color changes throughout lifetime
                    var colorCurve = new pc__namespace.CurveSet([
                        [0, 1, 0.25, 1, 0.375, 0.5, 0.5, 0],
                        [0, 0, 0.125, 0.25, 0.25, 0.5, 0.375, 0.75, 0.5, 1],
                        [0, 0, 1, 0]
                    ]);
                    // Create entity for particle system
                    var entity = new pc__namespace.Entity('Sparks');
                    app.root.addChild(entity);
                    entity.setLocalPosition(0, 0, 0);
                    // when texture is loaded add particlesystem component to entity
                    entity.addComponent("particlesystem", {
                        numParticles: 200,
                        lifetime: 2,
                        rate: 0.01,
                        scaleGraph: scaleCurve,
                        rotationSpeedGraph: angleCurve,
                        colorGraph: colorCurve,
                        colorMap: assets.spark.resource,
                        velocityGraph: worldVelocityCurve,
                        localVelocityGraph: localVelocityCurve,
                        localVelocityGraph2: localVelocityCurve2
                    });
                });
            });
        };
        ParticlesSparkExample.CATEGORY = 'Graphics';
        ParticlesSparkExample.NAME = 'Particles: Spark';
        return ParticlesSparkExample;
    }());

    var PointCloudSimulationExample = /** @class */ (function () {
        function PointCloudSimulationExample() {
        }
        PointCloudSimulationExample.prototype.example = function (canvas, deviceType, files) {
            // Create the application and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            app.start();
            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
            // Create an Entity with a camera component
            var camera = new pc__namespace.Entity();
            camera.addComponent("camera", {
                clearColor: new pc__namespace.Color(0, 0, 0)
            });
            // Add entity into scene hierarchy
            app.root.addChild(camera);
            // allocate two buffers to store positions of particles
            var maxNumPoints = 100000;
            var visiblePoints = 10000;
            var positions = new Float32Array(3 * maxNumPoints);
            var oldPositions = new Float32Array(3 * maxNumPoints);
            // generate random positions and old positions within small cube (delta between them represents velocity)
            for (var i = 0; i < 3 * maxNumPoints; i++) {
                positions[i] = Math.random() * 2 - 1;
                oldPositions[i] = positions[i] + Math.random() * 0.04 - 0.01;
            }
            // helper function to update vertex of the mesh
            function updateMesh(mesh) {
                // Set current positions on mesh - this reallocates vertex buffer if more space is needed to test it.
                // For best performance, we could preallocate enough space using mesh.Clear.
                // Also turn off bounding box generation, as we set up large box manually
                mesh.setPositions(positions, 3, visiblePoints);
                mesh.update(pc__namespace.PRIMITIVE_POINTS, false);
            }
            // Create a mesh with dynamic vertex buffer (index buffer is not needed)
            var mesh = new pc__namespace.Mesh(app.graphicsDevice);
            mesh.clear(true);
            updateMesh(mesh);
            // set large bounding box so we don't need to update it each frame
            mesh.aabb = new pc__namespace.BoundingBox(new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(15, 15, 15));
            // Create the shader from the vertex and fragment shaders
            var shader = new pc__namespace.Shader(app.graphicsDevice, {
                attributes: { aPosition: pc__namespace.SEMANTIC_POSITION },
                vshader: files['shader.vert'],
                fshader: files['shader.frag']
            });
            // Create a new material with the new shader and additive alpha blending
            var material = new pc__namespace.Material();
            material.shader = shader;
            material.blendType = pc__namespace.BLEND_ADDITIVEALPHA;
            material.depthWrite = false;
            // Create the mesh instance
            var meshInstance = new pc__namespace.MeshInstance(mesh, material);
            // Create Entity to render the mesh instances using a render component
            var entity = new pc__namespace.Entity();
            entity.addComponent("render", {
                type: 'asset',
                meshInstances: [meshInstance],
                material: material,
                castShadows: false
            });
            app.root.addChild(entity);
            // Set an update function on the app's update event
            var time = 0, previousTime;
            app.on("update", function (dt) {
                previousTime = time;
                time += dt;
                // update particle positions using simple Verlet integration, and keep them inside a sphere boundary
                var dist;
                var pos = new pc__namespace.Vec3();
                var old = new pc__namespace.Vec3();
                var delta = new pc__namespace.Vec3();
                var next = new pc__namespace.Vec3();
                for (var i = 0; i < maxNumPoints; i++) {
                    // read positions from buffers
                    old.set(oldPositions[i * 3], oldPositions[i * 3 + 1], oldPositions[i * 3 + 2]);
                    pos.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
                    // verlet integration to move them
                    delta.sub2(pos, old);
                    next.add2(pos, delta);
                    // boundary collision to keep them inside a sphere. If outside, simply move them in opposite direction
                    dist = next.length();
                    if (dist > 15)
                        next.copy(old);
                    // write out changed positions
                    positions[i * 3] = next.x;
                    positions[i * 3 + 1] = next.y;
                    positions[i * 3 + 2] = next.z;
                    oldPositions[i * 3] = pos.x;
                    oldPositions[i * 3 + 1] = pos.y;
                    oldPositions[i * 3 + 2] = pos.z;
                }
                // once a second change how many points are visible
                if (Math.round(time) !== Math.round(previousTime))
                    visiblePoints = Math.floor(50000 + Math.random() * maxNumPoints - 50000);
                // update mesh vertices
                updateMesh(mesh);
                // Rotate the camera around
                var cameraTime = time * 0.2;
                var cameraPos = new pc__namespace.Vec3(20 * Math.sin(cameraTime), 10, 20 * Math.cos(cameraTime));
                camera.setLocalPosition(cameraPos);
                camera.lookAt(pc__namespace.Vec3.ZERO);
            });
        };
        PointCloudSimulationExample.CATEGORY = 'Graphics';
        PointCloudSimulationExample.NAME = 'Point Cloud Simulation';
        PointCloudSimulationExample.FILES = {
            'shader.vert': /* glsl */ "\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\n\n// position of the camera\nuniform vec3 view_position;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    // vertex in world space\n    vec4 vertexWorld = matrix_model * aPosition;\n\n    // point sprite size depends on its distance to camera\n    float dist = 25.0 - length(vertexWorld.xyz - view_position);\n    gl_PointSize = clamp(dist * 2.0 - 1.0, 1.0, 15.0);\n\n    // color depends on position of particle\n    outColor = vec4(vertexWorld.y * 0.1, 0.1, vertexWorld.z * 0.1, 1);\n}",
            'shader.frag': /* glsl */ "\nprecision mediump float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // color supplied by vertex shader\n    gl_FragColor = outColor;\n\n    // make point round instead of square - make pixels outside of the circle black, using provided gl_PointCoord\n    vec2 dist = gl_PointCoord.xy - vec2(0.5, 0.5);\n    gl_FragColor.a = 1.0 - smoothstep(0.4, 0.5, sqrt(dot(dist, dist)));\n\n}"
        };
        return PointCloudSimulationExample;
    }());

    var PointCloudExample = /** @class */ (function () {
        function PointCloudExample() {
        }
        PointCloudExample.prototype.example = function (canvas, deviceType, files) {
            // Create the application and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                // Create an Entity with a camera component
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                });
                camera.translate(0, 7, 24);
                // Add entity into scene hierarchy
                app.root.addChild(camera);
                app.start();
                // Create a new Entity
                var entity = assets.statue.resource.instantiateRenderEntity();
                app.root.addChild(entity);
                // Create the shader definition and shader from the vertex and fragment shaders
                var shaderDefinition = {
                    attributes: {
                        aPosition: pc__namespace.SEMANTIC_POSITION
                    },
                    vshader: files['shader.vert'],
                    fshader: files['shader.frag']
                };
                var shader = new pc__namespace.Shader(app.graphicsDevice, shaderDefinition);
                // Create a new material with the new shader
                var material = new pc__namespace.Material();
                material.shader = shader;
                // find all render components
                var renderComponents = entity.findComponents('render');
                // for all render components
                renderComponents.forEach(function (render) {
                    // For all meshes in the render component, assign new material
                    render.meshInstances.forEach(function (meshInstance) {
                        meshInstance.material = material;
                    });
                    // set it to render as points
                    render.renderStyle = pc__namespace.RENDERSTYLE_POINTS;
                });
                var currentTime = 0;
                app.on("update", function (dt) {
                    // Update the time and pass it to shader
                    currentTime += dt;
                    material.setParameter('uTime', currentTime);
                    // Rotate the model
                    entity.rotate(0, 15 * dt, 0);
                });
            });
        };
        PointCloudExample.CATEGORY = 'Graphics';
        PointCloudExample.NAME = 'Point Cloud';
        PointCloudExample.FILES = {
            'shader.vert': /* glsl */ "\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\nuniform mat4   matrix_view;\n\n// time\nuniform float uTime;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry\n    mat4 modelView = matrix_view * matrix_model;\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    // vertex in world space\n    vec4 vertexWorld = matrix_model * aPosition;\n\n    // use sine way to generate intensity value based on time and also y-coordinate of model\n    float intensity = abs(sin(0.6 * vertexWorld.y + uTime * 1.0));\n\n    // intensity smoothly drops to zero for smaller values than 0.9\n    intensity = smoothstep(0.9, 1.0, intensity);\n\n    // point size depends on intensity\n    gl_PointSize = clamp(12.0 * intensity, 1.0, 64.0);\n\n    // color mixes red and yellow based on intensity\n    outColor = mix(vec4(1.0, 1.0, 0.0, 1.0), vec4(0.9, 0.0, 0.0, 1.0), intensity);\n}",
            'shader.frag': /* glsl */ "\nprecision lowp float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // just output color supplied by vertex shader\n    gl_FragColor = outColor;\n}"
        };
        return PointCloudExample;
    }());

    var PortalExample = /** @class */ (function () {
        function PortalExample() {
        }
        PortalExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'portal': new pc__namespace.Asset('portal', 'container', { url: '/static/assets/models/portal.glb' }),
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
                'bitmoji': new pc__namespace.Asset('bitmoji', 'container', { url: '/static/assets/models/bitmoji.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    app.scene.skyboxIntensity = 0.7;
                    ////////////////////////////////
                    // Script to rotate the scene //
                    ////////////////////////////////
                    var Rotator = pc__namespace.createScript('rotator');
                    var t = 0;
                    Rotator.prototype.update = function (dt) {
                        t += dt;
                        this.entity.setEulerAngles(0, Math.sin(t) * 40, 0);
                    };
                    //////////////////////////////////////////////////
                    // Script to set up rendering the portal itself //
                    //////////////////////////////////////////////////
                    var Portal = pc__namespace.createScript('portal');
                    // initialize code called once per entity
                    Portal.prototype.initialize = function () {
                        // increment value in stencil (from 0 to 1) for stencil geometry
                        var stencil = new pc__namespace.StencilParameters({
                            zpass: pc__namespace.STENCILOP_INCREMENT
                        });
                        // set the stencil and other parameters on all materials
                        var renders = this.entity.findComponents("render");
                        renders.forEach(function (render) {
                            for (var _i = 0, _a = render.meshInstances; _i < _a.length; _i++) {
                                var meshInstance = _a[_i];
                                var mat = meshInstance.material;
                                mat.stencilBack = mat.stencilFront = stencil;
                                // We only want to write to the stencil buffer
                                mat.depthWrite = false;
                                mat.redWrite = mat.greenWrite = mat.blueWrite = mat.alphaWrite = false;
                                mat.update();
                            }
                        });
                    };
                    /////////////////////////////////////////////////////////////////////////////
                    // Script to set stencil options for entities inside or outside the portal //
                    /////////////////////////////////////////////////////////////////////////////
                    var PortalGeometry = pc__namespace.createScript('portalGeometry');
                    PortalGeometry.attributes.add('inside', {
                        type: 'boolean',
                        default: true,
                        title: 'True indicating the geometry is inside the portal, false for outside'
                    });
                    PortalGeometry.prototype.initialize = function () {
                        // based on value in the stencil buffer (0 outside, 1 inside), either render
                        // the geometry when the value is equal, or not equal to zero.
                        var stencil = new pc__namespace.StencilParameters({
                            func: this.inside ? pc__namespace.FUNC_NOTEQUAL : pc__namespace.FUNC_EQUAL,
                            ref: 0
                        });
                        // set the stencil parameters on all materials
                        var renders = this.entity.findComponents("render");
                        renders.forEach(function (render) {
                            for (var _i = 0, _a = render.meshInstances; _i < _a.length; _i++) {
                                var meshInstance = _a[_i];
                                meshInstance.material.stencilBack = meshInstance.material.stencilFront = stencil;
                            }
                        });
                    };
                    /////////////////////////////////////////////////////////////////////////////
                    // find world layer - majority of objects render to this layer
                    var worldLayer = app.scene.layers.getLayerByName("World");
                    // find skybox layer - to enable it for the camera
                    var skyboxLayer = app.scene.layers.getLayerByName("Skybox");
                    // portal layer - this is where the portal geometry is written to the stencil
                    // buffer, and this needs to render first, so insert it before the world layer
                    var portalLayer = new pc__namespace.Layer({ name: "Portal" });
                    app.scene.layers.insert(portalLayer, 0);
                    // Create an Entity with a camera component
                    // this camera renders both world and portal layers
                    var camera = new pc__namespace.Entity();
                    camera.addComponent('camera', {
                        layers: [worldLayer.id, portalLayer.id, skyboxLayer.id]
                    });
                    camera.setLocalPosition(7, 5.5, 7.1);
                    camera.setLocalEulerAngles(-27, 45, 0);
                    app.root.addChild(camera);
                    // Create an Entity with a directional light component
                    var light = new pc__namespace.Entity();
                    light.addComponent('light', {
                        type: 'directional',
                        color: new pc__namespace.Color(1, 1, 1)
                    });
                    light.setEulerAngles(45, 35, 0);
                    app.root.addChild(light);
                    // Create a root for the graphical scene
                    var group = new pc__namespace.Entity();
                    group.addComponent('script');
                    group.script.create('rotator');
                    app.root.addChild(group);
                    // Create the portal entity - this plane is written to stencil buffer,
                    // which is then used to test for inside / outside. This needs to render
                    // before all elements requiring stencil buffer, so add to to a portalLayer.
                    // This is the plane that fills the inside of the portal geometry.
                    var portal = new pc__namespace.Entity("Portal");
                    portal.addComponent('render', {
                        type: 'plane',
                        material: new pc__namespace.StandardMaterial(),
                        layers: [portalLayer.id]
                    });
                    portal.addComponent('script');
                    portal.script.create('portal'); // comment out this line to see the geometry
                    portal.setLocalPosition(0, 0.4, -0.3);
                    portal.setLocalEulerAngles(90, 0, 0);
                    portal.setLocalScale(3.7, 1, 6.7);
                    group.addChild(portal);
                    // Create the portal visual geometry
                    var portalEntity = assets.portal.resource.instantiateRenderEntity();
                    portalEntity.setLocalPosition(0, -3, 0);
                    portalEntity.setLocalScale(0.02, 0.02, 0.02);
                    group.addChild(portalEntity);
                    // Create a statue entity, whic is visible inside the portal only
                    var statue = assets.statue.resource.instantiateRenderEntity();
                    statue.addComponent('script');
                    statue.script.create('portalGeometry', {
                        attributes: {
                            inside: true
                        }
                    });
                    statue.setLocalPosition(0, -1, -2);
                    statue.setLocalScale(0.25, 0.25, 0.25);
                    group.addChild(statue);
                    // Create a bitmoji entity, whic is visible outside the portal only
                    var bitmoji = assets.bitmoji.resource.instantiateRenderEntity();
                    bitmoji.addComponent('script');
                    bitmoji.script.create('portalGeometry', {
                        attributes: {
                            inside: false
                        }
                    });
                    bitmoji.setLocalPosition(0, -1, -2);
                    bitmoji.setLocalScale(2.5, 2.5, 2.5);
                    group.addChild(bitmoji);
                });
            });
        };
        PortalExample.CATEGORY = 'Graphics';
        PortalExample.NAME = 'Portal';
        PortalExample.WEBGPU_ENABLED = true;
        return PortalExample;
    }());

    var PostEffectsExample = /** @class */ (function () {
        function PostEffectsExample() {
        }
        PostEffectsExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'BLOOM [KEY_1]' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enabled' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.bloom.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'intensity' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.bloom.bloomIntensity' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'threshold' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.bloom.bloomThreshold' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'blur amount' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.bloom.blurAmount' }, min: 1, max: 30 }))),
                React__default["default"].createElement(react.Panel, { headerText: 'SEPIA [KEY_2]' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enabled' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.sepia.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'amount' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.sepia.amount' } }))),
                React__default["default"].createElement(react.Panel, { headerText: 'VIGNETTE [KEY_3]' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enabled' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.vignette.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'darkness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.vignette.darkness' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'offset' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.vignette.offset' }, max: 2 }))),
                React__default["default"].createElement(react.Panel, { headerText: 'BOKEH [KEY_4]' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enabled' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.bokeh.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'aperture' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.bokeh.aperture' }, max: 0.2 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'max blur' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.bokeh.maxBlur' }, max: 0.1 }))),
                React__default["default"].createElement(react.Panel, { headerText: 'SSAO [KEY_5]' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enabled' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.enabled' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'radius' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.radius' }, max: 10 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'samples' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.samples' }, max: 32 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'brightness' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.brightness' } })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'downscale' },
                        React__default["default"].createElement(react.SelectInput, { options: [{ v: 1, t: 'None' }, { v: 2, t: '50%' }, { v: '4', t: '25%' }], binding: new react.BindingTwoWay(), link: { observer: data, path: 'scripts.ssao.downscale' } }))),
                React__default["default"].createElement(react.Panel, { headerText: 'POST-PROCESS UI [KEY_6]' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'enabled' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'data.postProcessUI.enabled' } }))));
        };
        PostEffectsExample.prototype.example = function (canvas, deviceType, data) {
            var _this = this;
            // set up and load draco module, as the glb we load is draco compressed
            pc__namespace.WasmModule.setConfig('DracoDecoderModule', {
                glueUrl: '/static/lib/draco/draco.wasm.js',
                wasmUrl: '/static/lib/draco/draco.wasm.wasm',
                fallbackUrl: '/static/lib/draco/draco.js'
            });
            var assets = {
                'board': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/chess-board.glb' }),
                'bloom': new pc__namespace.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' }),
                'bokeh': new pc__namespace.Asset('bokeh', 'script', { url: '/static/scripts/posteffects/posteffect-bokeh.js' }),
                'sepia': new pc__namespace.Asset('sepia', 'script', { url: '/static/scripts/posteffects/posteffect-sepia.js' }),
                'vignette': new pc__namespace.Asset('vignette', 'script', { url: '/static/scripts/posteffects/posteffect-vignette.js' }),
                'ssao': new pc__namespace.Asset('ssao', 'script', { url: '/static/scripts/posteffects/posteffect-ssao.js' }),
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js',
                // WebGPU does not currently support antialiased depth resolve, disable it till we implement a shader resolve solution
                antialias: false
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // setup skydome
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxMip = 2;
                    app.scene.exposure = 1;
                    // helper function to create a 3d primitive including its material
                    function createPrimitive(primitiveType, position, scale, brightness, allowEmissive) {
                        // create a material
                        var material = new pc__namespace.StandardMaterial();
                        material.gloss = 0.4;
                        material.metalness = 0.6;
                        material.useMetalness = true;
                        material.emissive = pc__namespace.Color.YELLOW;
                        material.update();
                        // create the primitive using the material
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            material: material,
                            castShadows: false,
                            receiveShadows: false
                        });
                        // set scale and add it to scene
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // get the instance of the chess board and set up with render component
                    var boardEntity = assets.board.resource.instantiateRenderEntity({
                        castShadows: true,
                        receiveShadows: true
                    });
                    app.root.addChild(boardEntity);
                    // create a sphere which represents the point of focus for the bokeh filter
                    var focusPrimitive = createPrimitive("sphere", pc__namespace.Vec3.ZERO, new pc__namespace.Vec3(3, 3, 3));
                    // add an omni light as a child of this sphere
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        color: pc__namespace.Color.YELLOW,
                        intensity: 2,
                        range: 150,
                        shadowDistance: 150,
                        castShadows: true
                    });
                    focusPrimitive.addChild(light);
                    // Create an Entity with a camera component, and attach postprocessing effects scripts on it
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5),
                        farClip: 500
                    });
                    camera.addComponent("script");
                    data.set('scripts', {
                        ssao: {
                            enabled: true,
                            radius: 5,
                            samples: 16,
                            brightness: 0,
                            downscale: 1
                        },
                        bloom: {
                            enabled: true,
                            bloomIntensity: 0.8,
                            bloomThreshold: 0.7,
                            blurAmount: 15
                        },
                        sepia: {
                            enabled: true,
                            amount: 0.4
                        },
                        vignette: {
                            enabled: true,
                            darkness: 1,
                            offset: 1.2
                        },
                        bokeh: {
                            enabled: true,
                            aperture: 0.1,
                            maxBlur: 0.02
                        }
                    });
                    Object.keys(data.get('scripts')).forEach(function (key) {
                        camera.script.create(key, {
                            attributes: data.get("scripts.".concat(key))
                        });
                    });
                    // position the camera in the world
                    camera.setLocalPosition(0, 30, -60);
                    camera.lookAt(0, 0, 100);
                    app.root.addChild(camera);
                    // Allow user to toggle individual post effects
                    app.keyboard.on("keydown", function (e) {
                        // if the user is editing an input field, ignore key presses
                        if (e.element.constructor.name === 'HTMLInputElement')
                            return;
                        switch (e.key) {
                            case pc__namespace.KEY_1:
                                data.set('scripts.bloom.enabled', !data.get('scripts.bloom.enabled'));
                                break;
                            case pc__namespace.KEY_2:
                                data.set('scripts.sepia.enabled', !data.get('scripts.sepia.enabled'));
                                break;
                            case pc__namespace.KEY_3:
                                data.set('scripts.vignette.enabled', !data.get('scripts.vignette.enabled'));
                                break;
                            case pc__namespace.KEY_4:
                                data.set('scripts.bokeh.enabled', !data.get('scripts.bokeh.enabled'));
                                break;
                            case pc__namespace.KEY_5:
                                data.set('scripts.ssao.enabled', !data.get('scripts.ssao.enabled'));
                                break;
                            case pc__namespace.KEY_6:
                                data.set('data.postProcessUI.enabled', !data.get('data.postProcessUI.enabled'));
                                break;
                        }
                    }, _this);
                    // Create a 2D screen to place UI on
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // create a text element to show which effects are enabled
                    var text = new pc__namespace.Entity();
                    text.addComponent("element", {
                        anchor: new pc__namespace.Vec4(0.1, 0.1, 0.5, 0.5),
                        fontAsset: assets.font,
                        fontSize: 28,
                        pivot: new pc__namespace.Vec2(0.5, 0.1),
                        type: pc__namespace.ELEMENTTYPE_TEXT,
                        alignment: pc__namespace.Vec2.ZERO
                    });
                    screen.addChild(text);
                    // Display some UI text which the post processing can be tested against
                    text.element.text = 'Test UI Text';
                    // update things every frame
                    var angle = 0;
                    app.on("update", function (dt) {
                        angle += dt;
                        // rotate the skydome
                        app.scene.skyboxRotation = new pc__namespace.Quat().setFromEulerAngles(0, angle * 20, 0);
                        // move the focus sphere in the world
                        var focusPosition = new pc__namespace.Vec3(0, 30, Math.sin(1 + angle * 0.3) * 90);
                        focusPrimitive.setPosition(focusPosition);
                        // set the focus distance to the bokeh effect
                        // - it's a negative distance between the camera and the focus sphere
                        camera.script.bokeh.focus = -focusPosition.sub(camera.getPosition()).length();
                        // orbit the camera around
                        camera.setLocalPosition(110 * Math.sin(angle * 0.2), 45, 110 * Math.cos(angle * 0.2));
                        focusPosition.y -= 20;
                        camera.lookAt(focusPosition);
                        // display the depth texture if it was rendered
                        if (data.get('scripts.bokeh.enabled') || data.get('scripts.ssao.enabled')) {
                            // @ts-ignore engine-tsd
                            app.drawDepthTexture(0.7, -0.7, 0.5, -0.5);
                        }
                    });
                    data.on('*:set', function (path, value) {
                        var pathArray = path.split('.');
                        if (pathArray[0] === 'scripts') {
                            camera.script[pathArray[1]][pathArray[2]] = value;
                        }
                        else {
                            camera.camera.disablePostEffectsLayer = camera.camera.disablePostEffectsLayer === pc__namespace.LAYERID_UI ? undefined : pc__namespace.LAYERID_UI;
                        }
                    });
                });
            });
        };
        PostEffectsExample.CATEGORY = 'Graphics';
        PostEffectsExample.NAME = 'Post Effects';
        PostEffectsExample.WEBGPU_ENABLED = true;
        return PostEffectsExample;
    }());

    var ReflectionPlanarExample = /** @class */ (function () {
        function ReflectionPlanarExample() {
        }
        ReflectionPlanarExample.prototype.example = function (canvas, deviceType, files) {
            var assets = {
                envatlas: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/utils/planar-renderer.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // set up some general scene rendering properties
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // setup skydome
                    app.scene.envAtlas = assets.envatlas.resource;
                    app.scene.skyboxMip = 1;
                    app.scene.skyboxIntensity = 1.7; // make it brighter
                    // helper function to create a primitive with shape type, position, scale, color and layer
                    function createPrimitive(primitiveType, position, scale, color, layer, material) {
                        if (material === void 0) { material = null; }
                        // create material of specified color
                        if (!material) {
                            var standardMaterial = new pc__namespace.StandardMaterial();
                            standardMaterial.diffuse = color;
                            standardMaterial.gloss = 0.6;
                            standardMaterial.metalness = 0.7;
                            standardMaterial.useMetalness = true;
                            standardMaterial.update();
                            material = standardMaterial;
                        }
                        // create primitive
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            layers: layer,
                            material: material
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // create a layer for objects that do not render into texture
                    var excludedLayer = new pc__namespace.Layer({ name: "Excluded" });
                    app.scene.layers.push(excludedLayer);
                    // get world and skybox layers
                    var worldLayer = app.scene.layers.getLayerByName("World");
                    var skyboxLayer = app.scene.layers.getLayerByName("Skybox");
                    // Create the shader from the vertex and fragment shaders
                    var shader = pc__namespace.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
                        aPosition: pc__namespace.SEMANTIC_POSITION,
                        aUv0: pc__namespace.SEMANTIC_TEXCOORD0
                    });
                    // reflective ground
                    // This is in the excluded layer so it does not render into reflection texture
                    var groundMaterial = new pc__namespace.Material();
                    groundMaterial.shader = shader;
                    createPrimitive("plane", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(40, 1, 40), new pc__namespace.Color(0.5, 0.5, 0.5), [excludedLayer.id], groundMaterial);
                    // get the instance of the statue and set up with render component
                    var statueEntity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(statueEntity);
                    // create few random primitives in the world layer
                    var entities = [];
                    var shapes = ["box", "cone", "cylinder", "sphere", "capsule"];
                    for (var i = 0; i < 6; i++) {
                        var shapeName = shapes[Math.floor(Math.random() * shapes.length)];
                        var color = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                        entities.push(createPrimitive(shapeName, pc__namespace.Vec3.ZERO, new pc__namespace.Vec3(3, 3, 3), color, [worldLayer.id]));
                    }
                    // Create main camera, which renders entities in world, excluded and skybox layers
                    var camera = new pc__namespace.Entity("MainCamera");
                    camera.addComponent("camera", {
                        fov: 60,
                        layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id]
                    });
                    app.root.addChild(camera);
                    // create reflection camera, which renders entities in world and skybox layers only
                    var reflectionCamera = new pc__namespace.Entity("ReflectionCamera");
                    reflectionCamera.addComponent("camera", {
                        fov: 60,
                        layers: [worldLayer.id, skyboxLayer.id],
                        priority: -1 // render reflections before the main camera
                    });
                    // add planarRenderer script which renders the reflection texture
                    reflectionCamera.addComponent('script');
                    reflectionCamera.script.create('planarRenderer', {
                        attributes: {
                            sceneCameraEntity: camera,
                            scale: 1,
                            mipmaps: false,
                            depth: true,
                            planePoint: pc__namespace.Vec3.ZERO,
                            planeNormal: pc__namespace.Vec3.UP
                        }
                    });
                    app.root.addChild(reflectionCamera);
                    // update things each frame
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // rotate primitives around their center and also orbit them around the shiny sphere
                        for (var e = 0; e < entities.length; e++) {
                            var scale = (e + 1) / entities.length;
                            var offset = time + e * 200;
                            entities[e].setLocalPosition(7 * Math.sin(offset), e + 5, 7 * Math.cos(offset));
                            entities[e].rotate(1 * scale, 2 * scale, 3 * scale);
                        }
                        // slowly orbit camera around
                        camera.setLocalPosition(30 * Math.cos(time * 0.2), 10, 30 * Math.sin(time * 0.2));
                        camera.lookAt(pc__namespace.Vec3.ZERO);
                        // animate FOV
                        camera.camera.fov = 60 + 20 * Math.sin(time * 0.5);
                        // trigger reflection camera update (must be called after all parameters of the main camera are updated)
                        // @ts-ignore engine-tsd
                        var reflectionTexture = reflectionCamera.script.planarRenderer.frameUpdate();
                        groundMaterial.setParameter('uDiffuseMap', reflectionTexture);
                        groundMaterial.update();
                    });
                });
            });
        };
        ReflectionPlanarExample.CATEGORY = 'Graphics';
        ReflectionPlanarExample.NAME = 'Reflection Planar';
        ReflectionPlanarExample.WEBGPU_ENABLED = true;
        ReflectionPlanarExample.FILES = {
            'shader.vert': /* glsl */ "\n            attribute vec3 aPosition;\n            attribute vec2 aUv0;\n\n            uniform mat4 matrix_model;\n            uniform mat4 matrix_viewProjection;\n\n            void main(void)\n            {\n                gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);;\n            }",
            'shader.frag': /* glsl */ "\n\n            // engine built-in constant storing render target size in .xy and inverse size in .zw\n            uniform vec4 uScreenSize;\n\n            // reflection texture\n            uniform sampler2D uDiffuseMap;\n\n            void main(void)\n            {\n                // sample reflection texture\n                vec2 coord = gl_FragCoord.xy * uScreenSize.zw;\n                coord.y = 1.0 - coord.y;\n                vec4 reflection = texture2D(uDiffuseMap, coord);\n\n                gl_FragColor = vec4(reflection.xyz * 0.7, 1);\n            }"
        };
        return ReflectionPlanarExample;
    }());

    var RenderAssetExample = /** @class */ (function () {
        function RenderAssetExample() {
        }
        RenderAssetExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
                'cube': new pc__namespace.Asset('cube', 'container', { url: '/static/assets/models/playcanvas-cube.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    var cubeEntities = [];
                    // get the instance of the cube it set up with render component and add it to scene
                    cubeEntities[0] = assets.cube.resource.instantiateRenderEntity();
                    cubeEntities[0].setLocalPosition(7, 12, 0);
                    cubeEntities[0].setLocalScale(3, 3, 3);
                    app.root.addChild(cubeEntities[0]);
                    // clone another copy of it and add it to scene
                    cubeEntities[1] = cubeEntities[0].clone();
                    cubeEntities[1].setLocalPosition(-7, 12, 0);
                    cubeEntities[1].setLocalScale(3, 3, 3);
                    app.root.addChild(cubeEntities[1]);
                    // get the instance of the statue and set up with render component
                    var statueEntity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(statueEntity);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.2, 0.1, 0.1),
                        farClip: 100
                    });
                    camera.translate(-20, 15, 20);
                    camera.lookAt(0, 7, 0);
                    app.root.addChild(camera);
                    // set skybox
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    // spin the meshes
                    app.on("update", function (dt) {
                        if (cubeEntities[0]) {
                            cubeEntities[0].rotate(3 * dt, 10 * dt, 6 * dt);
                        }
                        if (cubeEntities[1]) {
                            cubeEntities[1].rotate(-7 * dt, 5 * dt, -2 * dt);
                        }
                        if (statueEntity) {
                            statueEntity.rotate(0, -12 * dt, 0);
                        }
                    });
                });
            }).catch(console.error);
        };
        RenderAssetExample.CATEGORY = 'Graphics';
        RenderAssetExample.NAME = 'Render Asset';
        RenderAssetExample.WEBGPU_ENABLED = true;
        return RenderAssetExample;
    }());

    var ReflectionCubemapExample = /** @class */ (function () {
        function ReflectionCubemapExample() {
        }
        ReflectionCubemapExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/utils/cubemap-renderer.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // set up some general scene rendering properties
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // setup skydome
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxMip = 0; // use top mipmap level of cubemap (full resolution)
                    app.scene.skyboxIntensity = 2; // make it brighter
                    // helper function to create high polygon version of a sphere and sets up an entity to allow it to be added to the scene
                    var createHighQualitySphere = function (material, layer) {
                        // Create Entity and add it to the scene
                        var entity = new pc__namespace.Entity("ShinyBall");
                        app.root.addChild(entity);
                        // create hight resolution sphere
                        var mesh = pc__namespace.createSphere(app.graphicsDevice, { latitudeBands: 200, longitudeBands: 200 });
                        // Add a render component with the mesh
                        entity.addComponent('render', {
                            type: 'asset',
                            layers: layer,
                            meshInstances: [new pc__namespace.MeshInstance(mesh, material)]
                        });
                        return entity;
                    };
                    // helper function to create a primitive with shape type, position, scale, color and layer
                    function createPrimitive(primitiveType, position, scale, color, layer) {
                        // create material of specified color
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = color;
                        material.gloss = 0.6;
                        material.metalness = 0.7;
                        material.useMetalness = true;
                        material.update();
                        // create primitive
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            layers: layer,
                            material: material
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // create a layer for object that do not render into texture
                    var excludedLayer = new pc__namespace.Layer({ name: "Excluded" });
                    app.scene.layers.push(excludedLayer);
                    // create material for the shiny ball
                    var shinyMat = new pc__namespace.StandardMaterial();
                    // create shiny ball mesh - this is on excluded layer as it does not render to cubemap
                    var shinyBall = createHighQualitySphere(shinyMat, [excludedLayer.id]);
                    shinyBall.setLocalPosition(0, 0, 0);
                    shinyBall.setLocalScale(10, 10, 10);
                    // get world and skybox layers
                    var worldLayer = app.scene.layers.getLayerByName("World");
                    var skyboxLayer = app.scene.layers.getLayerByName("Skybox");
                    var immediateLayer = app.scene.layers.getLayerByName("Immediate");
                    // add camera component to shiny ball - this defines camera properties for cubemap rendering
                    shinyBall.addComponent('camera', {
                        // optimization - clear the surface even though all pixels are overwritten,
                        // as this has performance benefits on tiled architectures
                        clearColorBuffer: true,
                        // cubemap camera will render objects on world layer and also skybox
                        layers: [worldLayer.id, skyboxLayer.id],
                        // priority - render before world camera
                        priority: -1,
                        // disable as this is not a camera that renders cube map but only a container for properties for cube map rendering
                        enabled: false
                    });
                    // add cubemapRenderer script component which takes care of rendering dynamic cubemap
                    shinyBall.addComponent('script');
                    shinyBall.script.create('cubemapRenderer', {
                        attributes: {
                            resolution: 256,
                            mipmaps: true,
                            depth: true
                        }
                    });
                    // finish set up of shiny material - make reflection a bit darker
                    shinyMat.diffuse = new pc__namespace.Color(0.6, 0.6, 0.6);
                    // use cubemap which is generated by cubemapRenderer instead of global skybox cubemap
                    shinyMat.useSkybox = false;
                    // @ts-ignore engine-tsd
                    shinyMat.cubeMap = shinyBall.script.cubemapRenderer.cubeMap;
                    // make it shiny without diffuse component
                    shinyMat.metalness = 1;
                    shinyMat.useMetalness = true;
                    shinyMat.update();
                    // create few random primitives in the world layer
                    var entities = [];
                    var shapes = ["box", "cone", "cylinder", "sphere", "capsule"];
                    for (var i = 0; i < 6; i++) {
                        var shapeName = shapes[Math.floor(Math.random() * shapes.length)];
                        var color = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                        entities.push(createPrimitive(shapeName, pc__namespace.Vec3.ZERO, new pc__namespace.Vec3(3, 3, 3), color, [worldLayer.id]));
                    }
                    // create green plane as a base to cast shadows on
                    createPrimitive("plane", new pc__namespace.Vec3(0, -8, 0), new pc__namespace.Vec3(20, 20, 20), new pc__namespace.Color(0.3, 0.5, 0.3), [worldLayer.id]);
                    // Create main camera, which renders entities in world, excluded and skybox layers
                    var camera = new pc__namespace.Entity("MainCamera");
                    camera.addComponent("camera", {
                        fov: 60,
                        layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id, immediateLayer.id]
                    });
                    app.root.addChild(camera);
                    // Create an Entity with a directional light component
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "directional",
                        color: pc__namespace.Color.YELLOW,
                        range: 40,
                        castShadows: true,
                        layers: [worldLayer.id],
                        shadowBias: 0.2,
                        shadowResolution: 1024,
                        normalOffsetBias: 0.05,
                        shadowDistance: 40
                    });
                    app.root.addChild(light);
                    // helper function to create a texture that can be used to project cubemap to
                    function createReprojectionTexture(projection, size) {
                        return new pc__namespace.Texture(app.graphicsDevice, {
                            width: size,
                            height: size,
                            format: pc__namespace.PIXELFORMAT_RGB8,
                            mipmaps: false,
                            minFilter: pc__namespace.FILTER_LINEAR,
                            magFilter: pc__namespace.FILTER_LINEAR,
                            addressU: pc__namespace.ADDRESS_CLAMP_TO_EDGE,
                            addressV: pc__namespace.ADDRESS_CLAMP_TO_EDGE,
                            projection: projection
                        });
                    }
                    // create 2 uqirect and 2 octahedral textures
                    var textureEqui = createReprojectionTexture(pc__namespace.TEXTUREPROJECTION_EQUIRECT, 256);
                    var textureEqui2 = createReprojectionTexture(pc__namespace.TEXTUREPROJECTION_EQUIRECT, 256);
                    var textureOcta = createReprojectionTexture(pc__namespace.TEXTUREPROJECTION_OCTAHEDRAL, 64);
                    var textureOcta2 = createReprojectionTexture(pc__namespace.TEXTUREPROJECTION_OCTAHEDRAL, 32);
                    // create one envAtlas texture
                    var textureAtlas = createReprojectionTexture(pc__namespace.TEXTUREPROJECTION_OCTAHEDRAL, 512);
                    // update things each frame
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // rotate primitives around their center and also orbit them around the shiny sphere
                        for (var e = 0; e < entities.length; e++) {
                            var scale = (e + 1) / entities.length;
                            var offset = time + e * 200;
                            entities[e].setLocalPosition(7 * Math.sin(offset), 2 * (e - 3), 7 * Math.cos(offset));
                            entities[e].rotate(1 * scale, 2 * scale, 3 * scale);
                        }
                        // slowly orbit camera around
                        camera.setLocalPosition(20 * Math.cos(time * 0.2), 2, 20 * Math.sin(time * 0.2));
                        camera.lookAt(pc__namespace.Vec3.ZERO);
                        // project textures, and display them on the screen
                        // @ts-ignore engine-tsd
                        var srcCube = shinyBall.script.cubemapRenderer.cubeMap;
                        // cube -> equi1
                        pc__namespace.reprojectTexture(srcCube, textureEqui, {
                            numSamples: 1
                        });
                        // @ts-ignore engine-tsd
                        app.drawTexture(-0.6, 0.7, 0.6, 0.3, textureEqui);
                        // cube -> octa1
                        pc__namespace.reprojectTexture(srcCube, textureOcta, {
                            numSamples: 1
                        });
                        // @ts-ignore engine-tsd
                        app.drawTexture(0.7, 0.7, 0.4, 0.4, textureOcta);
                        // equi1 -> octa2
                        pc__namespace.reprojectTexture(textureEqui, textureOcta2, {
                            specularPower: 32,
                            numSamples: 1024
                        });
                        // @ts-ignore engine-tsd
                        app.drawTexture(-0.7, -0.7, 0.4, 0.4, textureOcta2);
                        // octa1 -> equi2
                        pc__namespace.reprojectTexture(textureOcta, textureEqui2, {
                            specularPower: 16,
                            numSamples: 512
                        });
                        // @ts-ignore engine-tsd
                        app.drawTexture(0.6, -0.7, 0.6, 0.3, textureEqui2);
                        // cube -> envAtlas
                        pc__namespace.EnvLighting.generateAtlas(srcCube, {
                            target: textureAtlas
                        });
                        // @ts-ignore engine-tsd
                        app.drawTexture(0, -0.7, 0.5, 0.4, textureAtlas);
                    });
                });
            });
        };
        ReflectionCubemapExample.CATEGORY = 'Graphics';
        ReflectionCubemapExample.NAME = 'Reflection Cubemap';
        ReflectionCubemapExample.WEBGPU_ENABLED = true;
        return ReflectionCubemapExample;
    }());

    var RenderToTextureExample = /** @class */ (function () {
        function RenderToTextureExample() {
        }
        RenderToTextureExample.prototype.example = function (canvas, deviceType) {
            // Overview:
            // There are 3 layers used:
            // - worldLayer - it contains objects that render into main camera and also into texture
            // - excludedLayer - it contains objects that are excluded from rendering into texture and so render only into main camera
            // - skyboxLayer - it contains skybox and renders into both main and texture camera
            // There are two cameras:
            // - textureCamera - this camera renders into texture, objects from World and also Skybox layers
            // - camera - this camera renders into main framebuffer, objects from World, Excluded and also Skybox layers
            var assets = {
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                checkerboard: new pc__namespace.Asset('checkerboard', 'texture', { url: '/static/assets/textures/checkboard.png' }),
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem,
                    // @ts-ignore
                    pc__namespace.ParticleSystemComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // helper function to create a primitive with shape type, position, scale, color and layer
                    function createPrimitive(primitiveType, position, scale, color, layer) {
                        // create material of specified color
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = color;
                        material.update();
                        // create primitive
                        var primitive = new pc__namespace.Entity();
                        primitive.addComponent('render', {
                            type: primitiveType,
                            layers: layer,
                            material: material
                        });
                        // set position and scale and add it to scene
                        primitive.setLocalPosition(position);
                        primitive.setLocalScale(scale);
                        app.root.addChild(primitive);
                        return primitive;
                    }
                    // helper function to create a basic particle system
                    function createParticleSystem(position) {
                        // make particles move in different directions
                        var localVelocityCurve = new pc__namespace.CurveSet([
                            [0, 0, 0.5, 8],
                            [0, 0, 0.5, 8],
                            [0, 0, 0.5, 8]
                        ]);
                        var localVelocityCurve2 = new pc__namespace.CurveSet([
                            [0, 0, 0.5, -8],
                            [0, 0, 0.5, -8],
                            [0, 0, 0.5, -8]
                        ]);
                        // increasing gravity
                        var worldVelocityCurve = new pc__namespace.CurveSet([
                            [0, 0],
                            [0, 0, 0.2, 6, 1, -48],
                            [0, 0]
                        ]);
                        // Create entity for particle system
                        var entity = new pc__namespace.Entity();
                        app.root.addChild(entity);
                        entity.setLocalPosition(position);
                        // add particlesystem component to entity
                        entity.addComponent("particlesystem", {
                            numParticles: 200,
                            lifetime: 1,
                            rate: 0.01,
                            scaleGraph: new pc__namespace.Curve([0, 0.5]),
                            velocityGraph: worldVelocityCurve,
                            localVelocityGraph: localVelocityCurve,
                            localVelocityGraph2: localVelocityCurve2
                        });
                    }
                    // create texture and render target for rendering into, including depth buffer
                    var texture = new pc__namespace.Texture(app.graphicsDevice, {
                        width: 512,
                        height: 256,
                        format: pc__namespace.PIXELFORMAT_RGB8,
                        mipmaps: true,
                        minFilter: pc__namespace.FILTER_LINEAR,
                        magFilter: pc__namespace.FILTER_LINEAR,
                        addressU: pc__namespace.ADDRESS_CLAMP_TO_EDGE,
                        addressV: pc__namespace.ADDRESS_CLAMP_TO_EDGE
                    });
                    var renderTarget = new pc__namespace.RenderTarget({
                        name: "RT",
                        colorBuffer: texture,
                        depth: true,
                        flipY: true,
                        samples: 2
                    });
                    // create a layer for object that do not render into texture, add it right after the world layer
                    var excludedLayer = new pc__namespace.Layer({ name: "Excluded" });
                    app.scene.layers.insert(excludedLayer, 1);
                    // get world and skybox layers
                    var worldLayer = app.scene.layers.getLayerByName("World");
                    var skyboxLayer = app.scene.layers.getLayerByName("Skybox");
                    // create ground plane and 3 primitives, visible in world layer
                    var plane = createPrimitive("plane", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(20, 20, 20), new pc__namespace.Color(3, 4, 2), [worldLayer.id]);
                    var planeMaterial = plane.render.meshInstances[0].material;
                    // make the texture tiles and use anisotropic filtering to prevent blurring
                    planeMaterial.diffuseMap = assets.checkerboard.resource;
                    planeMaterial.diffuseTint = true;
                    planeMaterial.diffuseMapTiling.set(10, 10);
                    planeMaterial.anisotropy = 16;
                    createPrimitive("sphere", new pc__namespace.Vec3(-2, 1, 0), new pc__namespace.Vec3(2, 2, 2), pc__namespace.Color.RED, [worldLayer.id]);
                    createPrimitive("cone", new pc__namespace.Vec3(0, 1, -2), new pc__namespace.Vec3(2, 2, 2), pc__namespace.Color.CYAN, [worldLayer.id]);
                    createPrimitive("box", new pc__namespace.Vec3(2, 1, 0), new pc__namespace.Vec3(2, 2, 2), pc__namespace.Color.YELLOW, [worldLayer.id]);
                    // particle system
                    createParticleSystem(new pc__namespace.Vec3(2, 3, 0));
                    // Create main camera, which renders entities in world, excluded and skybox layers
                    var camera = new pc__namespace.Entity("Camera");
                    camera.addComponent("camera", {
                        fov: 100,
                        layers: [worldLayer.id, excludedLayer.id, skyboxLayer.id]
                    });
                    camera.translate(0, 9, 15);
                    camera.lookAt(1, 4, 0);
                    app.root.addChild(camera);
                    // add orbit camera script with a mouse and a touch support
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: plane,
                            distanceMax: 20,
                            frameOnStart: false
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    // Create texture camera, which renders entities in world and skybox layers into the texture
                    var textureCamera = new pc__namespace.Entity("TextureCamera");
                    textureCamera.addComponent("camera", {
                        layers: [worldLayer.id, skyboxLayer.id],
                        // set the priority of textureCamera to lower number than the priority of the main camera (which is at default 0)
                        // to make it rendered first each frame
                        priority: -1,
                        // this camera renders into texture target
                        renderTarget: renderTarget
                    });
                    // add sphere at the position of this camera to see it in the world
                    textureCamera.addComponent("render", {
                        type: "sphere"
                    });
                    app.root.addChild(textureCamera);
                    // Create an Entity with a omni light component and add it to world layer (and so used by both cameras)
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        color: pc__namespace.Color.WHITE,
                        range: 200,
                        castShadows: true,
                        layers: [worldLayer.id]
                    });
                    light.translate(0, 2, 5);
                    app.root.addChild(light);
                    // create a plane called tv which we use to display rendered texture
                    // this is only added to excluded Layer, so it does not render into texture
                    var tv = createPrimitive("plane", new pc__namespace.Vec3(6, 8, -5), new pc__namespace.Vec3(20, 10, 10), pc__namespace.Color.BLACK, [excludedLayer.id]);
                    tv.setLocalEulerAngles(90, 0, 0);
                    tv.render.castShadows = false;
                    tv.render.receiveShadows = false;
                    var material = tv.render.material;
                    material.emissiveMap = texture; // assign the rendered texture as an emissive texture
                    material.update();
                    // setup skydome, use top mipmap level of cubemap (full resolution)
                    app.scene.skyboxMip = 0;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // update things each frame
                    var time = 0;
                    var switchTime = 0;
                    app.on("update", function (dt) {
                        // rotate texture camera around the objects
                        time += dt;
                        textureCamera.setLocalPosition(12 * Math.sin(time), 3, 12 * Math.cos(time));
                        textureCamera.lookAt(pc__namespace.Vec3.ZERO);
                        // every 5 seconds switch texture camera between perspective and orthographic projection
                        switchTime += dt;
                        if (switchTime > 5) {
                            switchTime = 0;
                            if (textureCamera.camera.projection === pc__namespace.PROJECTION_ORTHOGRAPHIC) {
                                textureCamera.camera.projection = pc__namespace.PROJECTION_PERSPECTIVE;
                            }
                            else {
                                textureCamera.camera.projection = pc__namespace.PROJECTION_ORTHOGRAPHIC;
                                textureCamera.camera.orthoHeight = 5;
                            }
                        }
                    });
                });
            });
        };
        RenderToTextureExample.CATEGORY = 'Graphics';
        RenderToTextureExample.NAME = 'Render to Texture';
        RenderToTextureExample.WEBGPU_ENABLED = true;
        return RenderToTextureExample;
    }());

    var ShaderBurnExample = /** @class */ (function () {
        function ShaderBurnExample() {
        }
        ShaderBurnExample.prototype.example = function (canvas, deviceType, files) {
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' }),
                'clouds': new pc__namespace.Asset('clouds', 'texture', { url: '/static/assets/textures/clouds.jpg' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0, 7, 24);
                    // Create an Entity with a omni light component and a sphere model component.
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        color: new pc__namespace.Color(1, 1, 1),
                        radius: 10
                    });
                    light.translate(0, 1, 0);
                    // Add entities into scene hierarchy
                    app.root.addChild(camera);
                    app.root.addChild(light);
                    // Create the shader from the vertex and fragment shaders
                    var shader = pc__namespace.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
                        aPosition: pc__namespace.SEMANTIC_POSITION,
                        aUv0: pc__namespace.SEMANTIC_TEXCOORD0
                    });
                    // Create a new material with the new shader
                    var material = new pc__namespace.Material();
                    material.shader = shader;
                    material.setParameter('uHeightMap', assets.clouds.resource);
                    // create a hierarchy of entities with render components, representing the statue model
                    var entity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(entity);
                    // Set the new material on all meshes in the model, and use original texture from the model on the new material
                    var originalTexture = null;
                    var renders = entity.findComponents("render");
                    renders.forEach(function (render) {
                        var meshInstances = render.meshInstances;
                        for (var i = 0; i < meshInstances.length; i++) {
                            var meshInstance = meshInstances[i];
                            if (!originalTexture) {
                                var originalMaterial = meshInstance.material;
                                originalTexture = originalMaterial.diffuseMap;
                            }
                            meshInstance.material = material;
                        }
                    });
                    // material is set up, update it
                    material.setParameter('uDiffuseMap', originalTexture);
                    material.update();
                    var time = 0;
                    app.on("update", function (dt) {
                        time += 0.2 * dt;
                        // reverse time
                        var t = time % 2;
                        if (t > 1) {
                            t = 1 - (t - 1);
                        }
                        // set time parameter for the shader
                        material.setParameter('uTime', t);
                        material.update();
                    });
                });
            });
        };
        ShaderBurnExample.CATEGORY = 'Graphics';
        ShaderBurnExample.NAME = 'Shader Burn';
        ShaderBurnExample.WEBGPU_ENABLED = true;
        ShaderBurnExample.FILES = {
            'shader.vert': /* glsl */ "\nattribute vec3 aPosition;\nattribute vec2 aUv0;\n\nuniform mat4 matrix_model;\nuniform mat4 matrix_viewProjection;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    vUv0 = aUv0;\n    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);\n}",
            'shader.frag': /* glsl */ "\nprecision mediump float;\n\nvarying vec2 vUv0;\n\nuniform sampler2D uDiffuseMap;\nuniform sampler2D uHeightMap;\nuniform float uTime;\n\nvoid main(void)\n{\n    float height = texture2D(uHeightMap, vUv0).r;\n    vec4 color = texture2D(uDiffuseMap, vUv0);\n    if (height < uTime) {\n    discard;\n    }\n    if (height < (uTime + uTime * 0.1)) {\n    color = vec4(1.0, 0.2, 0.0, 1.0);\n    }\n    gl_FragColor = color;\n}"
        };
        return ShaderBurnExample;
    }());

    var ShaderCompileExample = /** @class */ (function () {
        function ShaderCompileExample() {
        }
        ShaderCompileExample.prototype.example = function (canvas, deviceType) {
            // This example servers as a test framework for large shader compilation speed test. Enable tracking for it.
            pc__namespace.Tracing.set(pc__namespace.TRACEID_SHADER_COMPILE, true);
            // Create the app and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            var assets = {
                'color': new pc__namespace.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.jpg' }),
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/seaside-rocks01-normal.jpg' }),
                'gloss': new pc__namespace.Asset('gloss', 'texture', { url: '/static/assets/textures/seaside-rocks01-gloss.jpg' }),
                'luts': new pc__namespace.Asset('luts', 'json', { url: '/static/assets/json/area-light-luts.json' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                // helper function to create a primitive with shape type, position, scale, color
                function createPrimitive(primitiveType, position, scale, color, assetManifest, id) {
                    if (id === void 0) { id = false; }
                    // create material of specified color
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuse = color;
                    material.gloss = 0.4;
                    material.useMetalness = true;
                    material.diffuseMap = assetManifest.color.resource;
                    material.normalMap = assetManifest.normal.resource;
                    material.glossMap = assetManifest.gloss.resource;
                    material.metalness = 0.4;
                    material.diffuseMapTiling.set(7, 7);
                    material.normalMapTiling.set(7, 7);
                    material.glossMapTiling.set(7, 7);
                    // do a small update to a chunk to generate unique shader each time, to avoid any shader compilation caching
                    if (id) {
                        material.chunks.viewDirPS = "\n                        void getViewDir() {\n                            dViewDirW = normalize(view_position - vPositionW);\n                            dViewDirW.x += 0.00001 * ".concat(Math.random(), ";\n                        }\n                    ");
                    }
                    material.update();
                    // create primitive
                    var primitive = new pc__namespace.Entity();
                    primitive.addComponent('render', {
                        type: primitiveType,
                        material: material
                    });
                    // set position and scale and add it to scene
                    primitive.setLocalPosition(position);
                    primitive.setLocalScale(scale);
                    app.root.addChild(primitive);
                    return primitive;
                }
                app.start();
                // enable area lights which are disabled by default for clustered lighting
                app.scene.lighting.areaLightsEnabled = true;
                // set the loaded area light LUT data
                var luts = assets.luts.resource;
                app.setAreaLightLuts(luts.LTC_MAT_1, luts.LTC_MAT_2);
                // set up some general scene rendering properties
                app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                // setup skydome
                app.scene.skyboxMip = 1;
                app.scene.skyboxIntensity = 0.7;
                app.scene.envAtlas = assets.helipad.resource;
                // create ground plane
                createPrimitive("plane", new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(20, 20, 20), new pc__namespace.Color(0.3, 0.3, 0.3), assets);
                // Create the camera, which renders entities
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.2, 0.2, 0.2),
                    fov: 60,
                    farClip: 100000
                });
                app.root.addChild(camera);
                camera.setLocalPosition(0, 15, 40);
                camera.lookAt(0, 0, 0);
                // generate a grid of spheres, each with a unique material / shader
                for (var x = -10; x <= 10; x += 6) {
                    for (var y = -10; y <= 10; y += 6) {
                        var pos = new pc__namespace.Vec3(x, 0.6, y);
                        var color = new pc__namespace.Color(0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7);
                        createPrimitive("sphere", pos, new pc__namespace.Vec3(1, 1, 1), color, assets, true);
                    }
                }
                // create some omni lights
                var count = 10;
                var lights = [];
                for (var i = 0; i < count; i++) {
                    var color = new pc__namespace.Color(Math.random(), Math.random(), Math.random(), 1);
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "spot",
                        color: color,
                        intensity: 4,
                        range: 16,
                        castShadows: false
                    });
                    // attach a render component with a small cone to each light
                    var material = new pc__namespace.StandardMaterial();
                    material.emissive = color;
                    material.update();
                    light.addComponent('render', {
                        type: "sphere",
                        material: material
                    });
                    light.setLocalScale(0.5, 0.5, 0.5);
                    app.root.addChild(light);
                    lights.push(light);
                }
                // update things each frame
                var time = 0;
                app.on("update", function (dt) {
                    time += dt;
                    // orbit spot lights around
                    lights.forEach(function (light, i) {
                        var angle = (i / lights.length) * Math.PI * 2;
                        light.setLocalPosition(8 * Math.sin(time + angle), 4, 8 * Math.cos(time + angle));
                    });
                });
            });
        };
        ShaderCompileExample.CATEGORY = 'Graphics';
        ShaderCompileExample.NAME = 'Shader Compile';
        return ShaderCompileExample;
    }());

    var ShaderToonExample = /** @class */ (function () {
        function ShaderToonExample() {
        }
        ShaderToonExample.prototype.example = function (canvas, deviceType, files) {
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0, 7, 24);
                    // Create an Entity with a omni light component and a sphere model component.
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        color: new pc__namespace.Color(1, 1, 1),
                        radius: 10
                    });
                    light.translate(0, 1, 0);
                    // Add entities into scene hierarchy
                    app.root.addChild(camera);
                    app.root.addChild(light);
                    // Create the shader from the vertex and fragment shaders
                    var shader = pc__namespace.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
                        aPosition: pc__namespace.SEMANTIC_POSITION,
                        aNormal: pc__namespace.SEMANTIC_NORMAL,
                        aUv: pc__namespace.SEMANTIC_TEXCOORD0
                    });
                    // Create a new material with the new shader
                    var material = new pc__namespace.Material();
                    material.shader = shader;
                    // create a hierarchy of entities with render components, representing the statue model
                    var entity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(entity);
                    // Set the new material on all meshes in the model, and use original texture from the model on the new material
                    var originalTexture = null;
                    var renders = entity.findComponents("render");
                    renders.forEach(function (render) {
                        var meshInstances = render.meshInstances;
                        for (var i = 0; i < meshInstances.length; i++) {
                            var meshInstance = meshInstances[i];
                            if (!originalTexture) {
                                var originalMaterial = meshInstance.material;
                                originalTexture = originalMaterial.diffuseMap;
                            }
                            meshInstance.material = material;
                        }
                    });
                    // material parameters
                    var lightPosArray = [light.getPosition().x, light.getPosition().y, light.getPosition().z];
                    material.setParameter('uLightPos', lightPosArray);
                    material.setParameter('uTexture', originalTexture);
                    material.update();
                    // rotate the statue
                    app.on("update", function (dt) {
                        entity.rotate(0, 60 * dt, 0);
                    });
                });
            });
        };
        ShaderToonExample.CATEGORY = 'Graphics';
        ShaderToonExample.NAME = 'Shader Toon';
        ShaderToonExample.WEBGPU_ENABLED = true;
        ShaderToonExample.FILES = {
            'shader.vert': /* glsl */ "\n// Attributes per vertex: position, normal and texture coordinates\nattribute vec4 aPosition;\nattribute vec3 aNormal;\nattribute vec2 aUv;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\nuniform mat4   matrix_view;\nuniform mat3   matrix_normal;\nuniform vec3   uLightPos;\n\n// Color to fragment program\nvarying float vertOutTexCoord;\nvarying vec2 texCoord;\n\nvoid main(void)\n{\n    mat4 modelView = matrix_view * matrix_model;\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n\n    // Get surface normal in eye coordinates\n    vec3 eyeNormal = normalize(matrix_normal * aNormal);\n\n    // Get vertex position in eye coordinates\n    vec4 vertexPos = modelView * aPosition;\n    vec3 vertexEyePos = vertexPos.xyz / vertexPos.w;\n\n    // Get vector to light source\n    vec3 lightDir = normalize(uLightPos - vertexEyePos);\n\n    // Dot product gives us diffuse intensity. The diffuse intensity will be\n    // used as the 1D color texture coordinate to look for the color of the\n    // resulting fragment (see fragment shader).\n    vertOutTexCoord = max(0.0, dot(eyeNormal, lightDir));\n    texCoord = aUv;\n\n    // Transform the geometry\n    gl_Position = modelViewProj * aPosition;\n}",
            'shader.frag': /* glsl */ "\nprecision mediump float;\nuniform sampler2D uTexture;\nvarying float vertOutTexCoord;\nvarying vec2 texCoord;\nvoid main(void)\n{\n    float v = vertOutTexCoord;\n    v = float(int(v * 6.0)) / 6.0;\n    // vec4 color = texture2D (uTexture, texCoord); // try this to use the diffuse color.\n    vec4 color = vec4(0.5, 0.47, 0.43, 1.0);\n    gl_FragColor = color * vec4(v, v, v, 1.0);\n}\n"
        };
        return ShaderToonExample;
    }());

    var ShaderWobbleExample = /** @class */ (function () {
        function ShaderWobbleExample() {
        }
        ShaderWobbleExample.prototype.example = function (canvas, deviceType, files) {
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0, 7, 25);
                    // Create an Entity with a omni light component and a sphere model component.
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "omni",
                        color: new pc__namespace.Color(1, 1, 1),
                        radius: 10
                    });
                    light.translate(0, 1, 0);
                    // Add entities into scene hierarchy
                    app.root.addChild(camera);
                    app.root.addChild(light);
                    // Create the shader from the vertex and fragment shaders
                    var shader = pc__namespace.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myShader', {
                        aPosition: pc__namespace.SEMANTIC_POSITION,
                        aUv0: pc__namespace.SEMANTIC_TEXCOORD0
                    });
                    // Create a new material with the new shader
                    var material = new pc__namespace.Material();
                    material.shader = shader;
                    // create a hierarchy of entities with render components, representing the statue model
                    var entity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(entity);
                    // Set the new material on all meshes in the model, and use original texture from the model on the new material
                    var originalTexture = null;
                    var renders = entity.findComponents("render");
                    renders.forEach(function (render) {
                        var meshInstances = render.meshInstances;
                        for (var i = 0; i < meshInstances.length; i++) {
                            var meshInstance = meshInstances[i];
                            if (!originalTexture) {
                                var originalMaterial = meshInstance.material;
                                originalTexture = originalMaterial.diffuseMap;
                            }
                            meshInstance.material = material;
                        }
                    });
                    // material is set up, update it
                    material.setParameter('uDiffuseMap', originalTexture);
                    material.update();
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // set time parameter for the shader
                        material.setParameter('uTime', time);
                        material.update();
                    });
                });
            });
        };
        ShaderWobbleExample.CATEGORY = 'Graphics';
        ShaderWobbleExample.NAME = 'Shader Wobble';
        ShaderWobbleExample.WEBGPU_ENABLED = true;
        ShaderWobbleExample.FILES = {
            'shader.vert': /* glsl */ "\nattribute vec3 aPosition;\nattribute vec2 aUv0;\n\nuniform mat4 matrix_model;\nuniform mat4 matrix_viewProjection;\nuniform float uTime;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    vec4 pos = matrix_model * vec4(aPosition, 1.0);\n    pos.x += sin(uTime + pos.y * 4.0) * 0.1;\n    pos.y += cos(uTime + pos.x * 4.0) * 0.1;\n    vUv0 = aUv0;\n    gl_Position = matrix_viewProjection * pos;\n}",
            'shader.frag': /* glsl */ "\nprecision mediump float;\n\nuniform sampler2D uDiffuseMap;\n\nvarying vec2 vUv0;\n\nvoid main(void)\n{\n    gl_FragColor = texture2D(uDiffuseMap, vUv0);\n}"
        };
        return ShaderWobbleExample;
    }());

    var ShadowCascadesExample = /** @class */ (function () {
        function ShadowCascadesExample() {
        }
        ShadowCascadesExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Panel, { headerText: 'Shadow Cascade Settings' },
                    React__default["default"].createElement(react.LabelGroup, { text: 'Filtering' },
                        React__default["default"].createElement(react.SelectInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.light.shadowType' }, type: "number", options: [
                                { v: pc__namespace.SHADOW_PCF1, t: 'PCF1' },
                                { v: pc__namespace.SHADOW_PCF3, t: 'PCF3' },
                                { v: pc__namespace.SHADOW_PCF5, t: 'PCF5' },
                                { v: pc__namespace.SHADOW_VSM8, t: 'VSM8' },
                                { v: pc__namespace.SHADOW_VSM16, t: 'VSM16' },
                                { v: pc__namespace.SHADOW_VSM32, t: 'VSM32' }
                            ] })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Count' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.light.numCascades' }, min: 1, max: 4, precision: 0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Every Frame' },
                        React__default["default"].createElement(react.BooleanInput, { type: 'toggle', binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.light.everyFrame' }, value: data.get('settings.light.everyFrame') })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Resolution' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.light.shadowResolution' }, min: 128, max: 2048, precision: 0 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'Distribution' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.light.cascadeDistribution' }, min: 0, max: 1, precision: 2 })),
                    React__default["default"].createElement(react.LabelGroup, { text: 'VSM Blur' },
                        React__default["default"].createElement(react.SliderInput, { binding: new react.BindingTwoWay(), link: { observer: data, path: 'settings.light.vsmBlurSize' }, min: 1, max: 25, precision: 0 }))));
        };
        ShadowCascadesExample.prototype.example = function (canvas, deviceType, data) {
            var assets = {
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' }),
                'terrain': new pc__namespace.Asset('terrain', 'container', { url: '/static/assets/models/terrain.glb' }),
                helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    data.set('settings', {
                        light: {
                            numCascades: 4,
                            shadowResolution: 2048,
                            cascadeDistribution: 0.5,
                            shadowType: pc__namespace.SHADOW_PCF3,
                            vsmBlurSize: 11,
                            everyFrame: true // true if all cascades update every frame
                        }
                    });
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // setup skydome
                    app.scene.skyboxMip = 3;
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.skyboxRotation = new pc__namespace.Quat().setFromEulerAngles(0, -70, 0);
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    // instantiate the terrain
                    var terrain = assets.terrain.resource.instantiateRenderEntity();
                    terrain.setLocalScale(30, 30, 30);
                    app.root.addChild(terrain);
                    // get the clouds so that we can animate them
                    // @ts-ignore
                    var srcClouds = terrain.find(function (node) {
                        var isCloud = node.name.includes('Icosphere');
                        if (isCloud) {
                            // no shadow receiving for clouds
                            node.render.receiveShadows = false;
                        }
                        return isCloud;
                    });
                    // clone some additional clouds
                    var clouds = [];
                    srcClouds.forEach(function (cloud) {
                        clouds.push(cloud);
                        for (var i = 0; i < 3; i++) {
                            var clone = cloud.clone();
                            cloud.parent.addChild(clone);
                            clouds.push(clone);
                        }
                    });
                    // shuffle the array to give clouds random order
                    clouds.sort(function () { return Math.random() - 0.5; });
                    // find a tree in the middle to use as a focus point
                    // @ts-ignore
                    var tree = terrain.findOne("name", "Arbol 2.002");
                    // create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.9, 0.9, 0.9),
                        farClip: 1000
                    });
                    // and position it in the world
                    camera.setLocalPosition(300, 160, 25);
                    // add orbit camera script with a mouse and a touch support
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2,
                            focusEntity: tree,
                            distanceMax: 600
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    // Create a directional light casting cascaded shadows
                    var dirLight = new pc__namespace.Entity();
                    dirLight.addComponent("light", __assign({
                        type: "directional",
                        color: pc__namespace.Color.WHITE,
                        shadowBias: 0.3,
                        normalOffsetBias: 0.2,
                        intensity: 1.0,
                        // enable shadow casting
                        castShadows: true,
                        shadowDistance: 1000
                    }, data.get('settings.light')));
                    app.root.addChild(dirLight);
                    dirLight.setLocalEulerAngles(45, 350, 20);
                    // update mode of cascades
                    var updateEveryFrame = true;
                    // handle HUD changes - update properties on the light
                    data.on('*:set', function (path, value) {
                        var pathArray = path.split('.');
                        if (pathArray[2] === 'everyFrame') {
                            updateEveryFrame = value;
                        }
                        else {
                            // @ts-ignore
                            dirLight.light[pathArray[2]] = value;
                        }
                    });
                    var cloudSpeed = 0.2;
                    var frameNumber = 0;
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt;
                        // on the first frame, when camera is updated, move it further away from the focus tree
                        if (frameNumber === 0) {
                            // @ts-ignore engine-tsd
                            camera.script.orbitCamera.distance = 470;
                        }
                        if (updateEveryFrame) {
                            // no per cascade rendering control
                            dirLight.light.shadowUpdateOverrides = null;
                        }
                        else {
                            // set up shadow update overrides, nearest cascade updates each frame, then next one every 5 and so on
                            dirLight.light.shadowUpdateOverrides = [
                                pc__namespace.SHADOWUPDATE_THISFRAME,
                                (frameNumber % 5) === 0 ? pc__namespace.SHADOWUPDATE_THISFRAME : pc__namespace.SHADOWUPDATE_NONE,
                                (frameNumber % 10) === 0 ? pc__namespace.SHADOWUPDATE_THISFRAME : pc__namespace.SHADOWUPDATE_NONE,
                                (frameNumber % 15) === 0 ? pc__namespace.SHADOWUPDATE_THISFRAME : pc__namespace.SHADOWUPDATE_NONE
                            ];
                        }
                        // move the clouds around
                        clouds.forEach(function (cloud, index) {
                            var redialOffset = (index / clouds.length) * (6.24 / cloudSpeed);
                            var radius = 9 + 4 * Math.sin(redialOffset);
                            var cloudTime = time + redialOffset;
                            cloud.setLocalPosition(2 + radius * Math.sin(cloudTime * cloudSpeed), 4, -5 + radius * Math.cos(cloudTime * cloudSpeed));
                        });
                        frameNumber++;
                    });
                });
            });
        };
        ShadowCascadesExample.CATEGORY = 'Graphics';
        ShadowCascadesExample.NAME = 'Shadow Cascades';
        ShadowCascadesExample.WEBGPU_ENABLED = true;
        return ShadowCascadesExample;
    }());

    var ShapesExample = /** @class */ (function () {
        function ShapesExample() {
        }
        ShapesExample.prototype.example = function (canvas, deviceType) {
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                app.start();
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                app.scene.lighting.shadowsEnabled = false;
                // All render component primitive shape types
                var shapes = ["box", "plane", "cone", "cylinder", "sphere", "capsule"];
                var x = -1, y = -1;
                shapes.forEach(function (shape) {
                    // Create an entity with a render component
                    var entity = new pc__namespace.Entity();
                    entity.addComponent("render", {
                        type: shape
                    });
                    app.root.addChild(entity);
                    // Lay out the 6 primitives in two rows, 3 per row
                    entity.setLocalPosition(x * 1.2, y, 0);
                    if (x++ === 1) {
                        x = -1;
                        y = 1;
                    }
                });
                // Create an entity with a directional light component
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    type: "directional",
                    castShadows: false
                });
                app.root.addChild(light);
                light.setLocalEulerAngles(45, 30, 0);
                // Create an entity with a camera component
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                });
                app.root.addChild(camera);
                camera.setLocalPosition(0, 0, 5);
            }).catch(console.error);
        };
        ShapesExample.CATEGORY = 'Graphics';
        ShapesExample.NAME = 'Shapes';
        ShapesExample.WEBGPU_ENABLED = true;
        return ShapesExample;
    }());

    var TextureBasisExample = /** @class */ (function () {
        function TextureBasisExample() {
        }
        // Color textures have been converted with the following arguments:
        //   basisu seaside-rocks01-gloss.jpg -q 255 -mipmap
        // The normalmap has been converted with the following arguments:
        //   basisu seaside-rocks01-normal.jpg -normal_map -swizzle gggr -renorm -q 255 -mipmap
        TextureBasisExample.prototype.example = function (canvas, deviceType) {
            // initialize basis
            pc__namespace.basisInitialize({
                glueUrl: '/static/lib/basis/basis.wasm.js',
                wasmUrl: '/static/lib/basis/basis.wasm.wasm',
                fallbackUrl: '/static/lib/basis/basis.js'
            });
            var assets = {
                'color': new pc__namespace.Asset('color', 'texture', { url: '/static/assets/textures/seaside-rocks01-color.basis' }),
                'gloss': new pc__namespace.Asset('gloss', 'texture', { url: '/static/assets/textures/seaside-rocks01-gloss.basis' }),
                'normal': new pc__namespace.Asset('normal', 'texture', { url: '/static/assets/textures/seaside-rocks01-normal.basis' }, { type: pc__namespace.TEXTURETYPE_SWIZZLEGGGR }),
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Set skybox
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    app.scene.skyboxIntensity = 1.4;
                    app.scene.envAtlas = assets.helipad.resource;
                    // Create directional light
                    var light = new pc__namespace.Entity();
                    light.addComponent('light', {
                        type: 'directional'
                    });
                    light.setLocalEulerAngles(45, 0, 45);
                    // Construct material
                    var material = new pc__namespace.StandardMaterial();
                    material.useMetalness = true;
                    material.diffuse = new pc__namespace.Color(0.3, 0.3, 0.3);
                    material.gloss = 0.8;
                    material.metalness = 0.7;
                    material.diffuseMap = assets.color.resource;
                    material.normalMap = assets.normal.resource;
                    material.glossMap = assets.gloss.resource;
                    material.diffuseMapTiling.set(7, 7);
                    material.normalMapTiling.set(7, 7);
                    material.glossMapTiling.set(7, 7);
                    material.update();
                    // Create a torus shape
                    var torus = pc__namespace.createTorus(app.graphicsDevice, {
                        tubeRadius: 0.2,
                        ringRadius: 0.3,
                        segments: 50,
                        sides: 40
                    });
                    var shape = new pc__namespace.Entity();
                    shape.addComponent('render', {
                        material: material,
                        meshInstances: [new pc__namespace.MeshInstance(torus, material)]
                    });
                    shape.setPosition(0, 0, 0);
                    shape.setLocalScale(2, 2, 2);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    // Adjust the camera position
                    camera.translate(0, 0, 4);
                    // Add the new Entities to the hierarchy
                    app.root.addChild(light);
                    app.root.addChild(shape);
                    app.root.addChild(camera);
                    // Set an update function on the app's update event
                    var angle = 0;
                    app.on("update", function (dt) {
                        angle = (angle + dt * 10) % 360;
                        // Rotate the boxes
                        shape.setEulerAngles(angle, angle * 2, angle * 4);
                    });
                });
            });
        };
        TextureBasisExample.CATEGORY = 'Graphics';
        TextureBasisExample.NAME = 'Texture Basis';
        return TextureBasisExample;
    }());

    var TransformFeedbackExample = /** @class */ (function () {
        function TransformFeedbackExample() {
        }
        TransformFeedbackExample.prototype.example = function (canvas, deviceType, files) {
            // Create the app and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            var assets = {
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                app.start();
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                // create small 2D texture representing movement direction (wind)
                var textureResolution = 10;
                var textureData = new Uint8ClampedArray(textureResolution * textureResolution * 4);
                for (var i = 0; i < textureResolution * textureResolution; i++) {
                    // rgb store biased movement direction
                    textureData[i * 4] = 127 + Math.random() * 50 - 25;
                    textureData[i * 4 + 1] = 127 + Math.random() * 50 - 25;
                    textureData[i * 4 + 2] = 127 + Math.random() * 50 - 25;
                    // set alpha to 255 for debugging purposes
                    textureData[i * 4 + 3] = 255;
                }
                // create texture
                var texture = new pc__namespace.Texture(app.graphicsDevice, {
                    width: textureResolution,
                    height: textureResolution,
                    format: pc__namespace.PIXELFORMAT_RGBA8,
                    cubemap: false,
                    mipmaps: false,
                    minFilter: pc__namespace.FILTER_LINEAR,
                    magFilter: pc__namespace.FILTER_LINEAR,
                    addressU: pc__namespace.ADDRESS_CLAMP_TO_EDGE,
                    addressV: pc__namespace.ADDRESS_CLAMP_TO_EDGE
                });
                // initialize it with data
                var pixels = texture.lock();
                pixels.set(textureData);
                texture.unlock();
                // Create main camera, which renders the world
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
                });
                app.root.addChild(camera);
                // set up texture transform part, on webgl2 devices only
                var tf;
                var shader;
                var areaSize = 30;
                // resolve parameters to simulation shader parameters
                var areaSizeUniform = app.graphicsDevice.scope.resolve("areaSize");
                var deltaTimeUniform = app.graphicsDevice.scope.resolve("deltaTime");
                var directionSampler = app.graphicsDevice.scope.resolve("directionSampler");
                // @ts-ignore engine-tsd
                if (app.graphicsDevice.webgl2) {
                    // simulated particles
                    var maxNumPoints = 200000;
                    var positions = new Float32Array(4 * maxNumPoints);
                    // generate random data, these are used as seeds to generate particles in vertex shader
                    for (var i = 0; i < maxNumPoints; i++) {
                        positions[i * 4] = Math.random();
                        positions[i * 4 + 1] = Math.random();
                        positions[i * 4 + 2] = Math.random();
                        // set life time to 0 which triggers particle restart in shader
                        positions[i * 4 + 3] = 0;
                    }
                    // store these in a vertex buffer of a mesh
                    var mesh = new pc__namespace.Mesh(app.graphicsDevice);
                    mesh.setPositions(positions, 4);
                    mesh.update(pc__namespace.PRIMITIVE_POINTS, false);
                    // set large bounding box so we don't need to update it each frame
                    mesh.aabb = new pc__namespace.BoundingBox(new pc__namespace.Vec3(0, 0, 0), new pc__namespace.Vec3(100, 100, 100));
                    // Create the shader from the vertex and fragment shaders which is used to render point sprites
                    shader = new pc__namespace.Shader(app.graphicsDevice, {
                        attributes: { aPosition: pc__namespace.SEMANTIC_POSITION },
                        vshader: files['shaderCloud.vert'],
                        fshader: files['shaderCloud.frag']
                    });
                    // Create a new material with the new shader and additive alpha blending
                    var material = new pc__namespace.Material();
                    material.shader = shader;
                    material.blendType = pc__namespace.BLEND_ADDITIVEALPHA;
                    material.depthWrite = false;
                    // Create the mesh instance
                    var meshInstance = new pc__namespace.MeshInstance(mesh, material);
                    // create an entity used to render the mesh instance using a render component
                    var entity = new pc__namespace.Entity();
                    entity.addComponent("render", {
                        type: 'asset',
                        meshInstances: [meshInstance]
                    });
                    app.root.addChild(entity);
                    // set up transform feedback. This creates a clone of the vertex buffer, and sets up rendering to ping pong between them
                    tf = new pc__namespace.TransformFeedback(mesh.vertexBuffer);
                    shader = pc__namespace.TransformFeedback.createShader(app.graphicsDevice, files['shaderFeedback.vert'], "transformShaderExample");
                }
                // update things each frame
                var time = 0;
                app.on("update", function (dt) {
                    // rotate camera around
                    time += dt;
                    camera.setLocalPosition(9 * Math.sin(time * 0.2), 6, 25 * Math.cos(time * 0.2));
                    camera.lookAt(new pc__namespace.Vec3(0, 3, 0));
                    // if transform feedback was initialized
                    if (tf) {
                        // set up simulation parameters
                        areaSizeUniform.setValue(areaSize);
                        deltaTimeUniform.setValue(dt);
                        directionSampler.setValue(texture);
                        // execute simulation
                        tf.process(shader);
                    }
                });
            });
        };
        TransformFeedbackExample.CATEGORY = 'Graphics';
        TransformFeedbackExample.NAME = 'Transform Feedback';
        TransformFeedbackExample.FILES = {
            'shaderFeedback.vert': /* glsl */ "\n// vertex shader used to move particles during transform-feedback simulation step\n\n// input and output is vec4, containing position in .xyz and lifetime in .w\nattribute vec4 vertex_position;\nvarying vec4 out_vertex_position;\n\n// parameters controlling simulation\nuniform float deltaTime;\nuniform float areaSize;\n\n// texture storing random direction vectors\nuniform sampler2D directionSampler;\n\n// function returning random number based on vec2 seed parameter\nfloat rand(vec2 co) {\n    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);\n}\n\nvoid main(void) {\n\n    // texture contains direction of particle movement - read it based on particle's position\n    vec2 texCoord = vertex_position.xz / areaSize + 0.5;\n    vec3 dir = texture2D(directionSampler, texCoord).xyz;\n    dir = dir * 2.0 - 1.0;\n\n    // move particle along direction with some speed\n    float speed = 20.0 * deltaTime;\n    vec3 pos = vertex_position.xyz + dir * speed;\n\n    // age the particle\n    float liveTime = vertex_position.w;\n    liveTime -= deltaTime;\n\n    // if particle is too old, regenerate it\n    if (liveTime <= 0.0) {\n\n        // random life time\n        liveTime = rand(pos.xy) * 2.0;\n\n        // random position\n        pos.x = rand(pos.xz) * areaSize - 0.5 * areaSize;\n        pos.y = rand(pos.xy) * 4.0;\n        pos.z = rand(pos.yz) * areaSize - 0.5 * areaSize;\n    }\n\n    // write out updated particle\n    out_vertex_position = vec4(pos, liveTime);\n}",
            'shaderCloud.vert': /* glsl */ "\n// vertex shader used to render point sprite particles\n\n// Attributes per vertex: position\nattribute vec4 aPosition;\n\nuniform mat4   matrix_viewProjection;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // Transform the geometry (ignore life time which is stored in .w of position)\n    vec4 worldPosition = vec4(aPosition.xyz, 1);\n    gl_Position = matrix_viewProjection * worldPosition;\n\n    // point sprite size\n    gl_PointSize = 2.0;\n\n    // color depends on position of particle\n    outColor = vec4(worldPosition.y * 0.25, 0.1, worldPosition.z * 0.2, 1);\n}",
            'shaderCloud.frag': /* glsl */ "\n// fragment shader used to render point sprite particles\nprecision mediump float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // color supplied by vertex shader\n    gl_FragColor = outColor;\n}"
        };
        return TransformFeedbackExample;
    }());

    var VideoTextureExample = /** @class */ (function () {
        function VideoTextureExample() {
        }
        VideoTextureExample.prototype.example = function (canvas, deviceType) {
            // Create the application and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            var assets = {
                'tv': new pc__namespace.Asset('tv', 'container', { url: '/static/assets/models/tv.glb' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                app.start();
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                // Create an Entity with a camera component
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                });
                camera.translate(0, 0, 15);
                // Create an Entity with a omni light
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    type: "omni",
                    color: new pc__namespace.Color(1, 1, 1),
                    range: 30
                });
                light.translate(5, 5, 10);
                app.root.addChild(camera);
                app.root.addChild(light);
                // Create a texture to hold the video frame data
                var videoTexture = new pc__namespace.Texture(app.graphicsDevice, {
                    format: pc__namespace.PIXELFORMAT_RGB565,
                    mipmaps: false,
                    minFilter: pc__namespace.FILTER_LINEAR,
                    magFilter: pc__namespace.FILTER_LINEAR,
                    addressU: pc__namespace.ADDRESS_CLAMP_TO_EDGE,
                    addressV: pc__namespace.ADDRESS_CLAMP_TO_EDGE
                });
                // Create our HTML element with the video
                var video = document.createElement('video');
                video.id = 'vid';
                video.loop = true;
                // Muted so that we can autoplay
                video.muted = true;
                video.autoplay = true;
                // Inline needed for iOS otherwise it plays at fullscreen
                video.playsInline = true;
                video.crossOrigin = "anonymous";
                // Make sure that the video is in view on the page otherwise it doesn't
                // load on some browsers, especially mobile
                video.setAttribute('style', 'display: block; width: 1px; height: 1px; position: absolute; opacity: 0; z-index: -1000; top: 0px; pointer-events: none');
                video.src = '/static/assets/video/SampleVideo_1280x720_1mb.mp4';
                document.body.append(video);
                video.addEventListener('canplaythrough', function () {
                    videoTexture.setSource(video);
                });
                // create an entity to render the tv mesh
                var entity = assets.tv.resource.instantiateRenderEntity();
                app.root.addChild(entity);
                // Create a material that will use our video texture
                var material = new pc__namespace.StandardMaterial();
                material.useLighting = false;
                material.emissiveMap = videoTexture;
                material.update();
                // set the material on the screen mesh
                entity.render.meshInstances[1].material = material;
                video.load();
                var mouse = new pc__namespace.Mouse(document.body);
                mouse.on('mousedown', function (event) {
                    if (entity && event.buttons[pc__namespace.MOUSEBUTTON_LEFT]) {
                        video.muted = !video.muted;
                    }
                });
                var upload = false;
                var time = 0;
                app.on('update', function (dt) {
                    time += dt;
                    // rotate the tv object
                    entity.setLocalEulerAngles(100 + Math.sin(time) * 50, 0, -90);
                    // Upload the video data to the texture every other frame
                    upload = !upload;
                    if (upload) {
                        videoTexture.upload();
                    }
                });
            });
        };
        VideoTextureExample.CATEGORY = 'Graphics';
        VideoTextureExample.NAME = 'Video Texture';
        return VideoTextureExample;
    }());

    var index$7 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        AreaLightsExample: AreaLightsExample$1,
        AreaPickerExample: AreaPickerExample,
        AssetViewerExample: AssetViewerExample,
        BatchingDynamicExample: BatchingDynamicExample,
        ReflectionBoxExample: ReflectionBoxExample,
        ClusteredAreaLightsExample: AreaLightsExample,
        ClusteredLightingExample: ClusteredLightingExample,
        ClusteredOmniShadowsExample: ClusteredOmniShadowsExample,
        ClusteredSpotShadowsExample: ClusteredSpotShadowsExample,
        ContactHardeningShadowsExample: ContactHardeningShadowsExample,
        GrabPassExample: GrabPassExample,
        GroundFogExample: GroundFogExample,
        HardwareInstancingExample: HardwareInstancingExample,
        HierarchyExample: HierarchyExample,
        LayersExample: LayersExample,
        LightsBakedAOExample: LightsBakedAOExample,
        LightsBakedExample: LightsBakedExample,
        LightsExample: LightsExample$1,
        LightPhysicalUnitsExample: LightPhysicalUnitsExample,
        LinesExample: LinesExample,
        MaterialAnisotropicExample: LightsExample,
        MaterialBasicExample: MaterialBasicExample,
        MaterialClearCoatExample: MaterialClearCoatExample,
        MaterialPhysicalExample: MaterialPhysicalExample,
        MaterialTranslucentSpecularExample: MaterialTranslucentSpecularExample,
        MeshDecalsExample: MeshDecalsExample,
        MeshDeformationExample: MeshDeformationExample,
        MeshGenerationExample: MeshGenerationExample,
        MeshMorphManyExample: MeshMorphManyExample,
        MeshMorphExample: MeshMorphExample,
        ModelAssetExample: ModelAssetExample,
        ModelOutlineExample: ModelOutlineExample,
        ModelTexturedBoxExample: ModelTexturedBoxExample,
        MultiViewExample: MultiViewExample,
        MrtExample: MrtExample,
        PainterExample: PainterExample,
        PaintMeshExample: PaintMeshExample,
        ParticlesAnimIndexExample: ParticlesAnimIndexExample,
        ParticlesRandomSpritesExample: ParticlesRandomSpritesExample,
        ParticlesSnowExample: ParticlesSnowExample,
        ParticlesSparkExample: ParticlesSparkExample,
        PointCloudSimulationExample: PointCloudSimulationExample,
        PointCloudExample: PointCloudExample,
        PortalExample: PortalExample,
        PostEffectsExample: PostEffectsExample,
        ReflectionPlanarExample: ReflectionPlanarExample,
        RenderAssetExample: RenderAssetExample,
        ReflectionCubemapExample: ReflectionCubemapExample,
        RenderToTextureExample: RenderToTextureExample,
        ShaderBurnExample: ShaderBurnExample,
        ShaderCompileExample: ShaderCompileExample,
        ShaderToonExample: ShaderToonExample,
        ShaderWobbleExample: ShaderWobbleExample,
        ShadowCascadesExample: ShadowCascadesExample,
        ShapesExample: ShapesExample,
        TextureBasisExample: TextureBasisExample,
        TransformFeedbackExample: TransformFeedbackExample,
        VideoTextureExample: VideoTextureExample
    });

    var GamepadExample = /** @class */ (function () {
        function GamepadExample() {
        }
        GamepadExample.prototype.example = function (canvas, deviceType) {
            // Create the application and start the update loop
            var assets = {
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // set skybox
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.exposure = 1.6;
                    app.scene.skyboxMip = 1;
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0, 7, 25);
                    app.root.addChild(camera);
                    var entity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(entity);
                    var gamepads = new pc__namespace.GamePads();
                    app.on("update", function () {
                        gamepads.update();
                        if (gamepads.isPressed(pc__namespace.PAD_1, pc__namespace.PAD_LEFT)) {
                            entity.rotate(0, -1, 0);
                        }
                        if (gamepads.isPressed(pc__namespace.PAD_1, pc__namespace.PAD_RIGHT)) {
                            entity.rotate(0, 1, 0);
                        }
                        if (gamepads.wasPressed(pc__namespace.PAD_1, pc__namespace.PAD_UP)) {
                            entity.rotate(-1, 0, 0);
                        }
                        if (gamepads.wasPressed(pc__namespace.PAD_1, pc__namespace.PAD_DOWN)) {
                            entity.rotate(1, 0, 0);
                        }
                    });
                });
            });
        };
        GamepadExample.CATEGORY = 'Input';
        GamepadExample.NAME = 'Gamepad';
        GamepadExample.WEBGPU_ENABLED = true;
        return GamepadExample;
    }());

    var KeyboardExample = /** @class */ (function () {
        function KeyboardExample() {
        }
        KeyboardExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // set skybox
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.exposure = 1.6;
                    app.scene.skyboxMip = 1;
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0, 7, 25);
                    app.root.addChild(camera);
                    var entity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(entity);
                    var keyboard = new pc__namespace.Keyboard(document.body);
                    app.on("update", function () {
                        if (keyboard.isPressed(pc__namespace.KEY_LEFT)) {
                            entity.rotate(0, -1, 0);
                        }
                        if (keyboard.isPressed(pc__namespace.KEY_RIGHT)) {
                            entity.rotate(0, 1, 0);
                        }
                    });
                });
            });
        };
        KeyboardExample.CATEGORY = 'Input';
        KeyboardExample.NAME = 'Keyboard';
        KeyboardExample.WEBGPU_ENABLED = true;
        return KeyboardExample;
    }());

    var MouseExample = /** @class */ (function () {
        function MouseExample() {
        }
        MouseExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'statue': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/statue.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // set skybox
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.exposure = 1.6;
                    app.scene.skyboxMip = 1;
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
                    });
                    camera.translate(0, 7, 25);
                    app.root.addChild(camera);
                    var entity = assets.statue.resource.instantiateRenderEntity();
                    app.root.addChild(entity);
                    var mouse = new pc__namespace.Mouse(document.body);
                    var x = 0;
                    var y = 0;
                    mouse.on('mousemove', function (event) {
                        if (event.buttons[pc__namespace.MOUSEBUTTON_LEFT]) {
                            x += event.dx;
                            entity.setLocalEulerAngles(0.2 * y, 0.2 * x, 0);
                        }
                    });
                });
            });
        };
        MouseExample.CATEGORY = 'Input';
        MouseExample.NAME = 'Mouse';
        MouseExample.WEBGPU_ENABLED = true;
        return MouseExample;
    }());

    var index$6 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        GamepadExample: GamepadExample,
        KeyboardExample: KeyboardExample,
        MouseExample: MouseExample
    });

    var DracoGlbExample = /** @class */ (function () {
        function DracoGlbExample() {
        }
        DracoGlbExample.prototype.example = function (canvas, deviceType) {
            pc__namespace.WasmModule.setConfig('DracoDecoderModule', {
                glueUrl: '/static/lib/draco/draco.wasm.js',
                wasmUrl: '/static/lib/draco/draco.wasm.wasm',
                fallbackUrl: '/static/lib/draco/draco.js'
            });
            pc__namespace.WasmModule.getInstance('DracoDecoderModule', demo);
            function demo() {
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.RenderComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    var assets = {
                        heart: new pc__namespace.Asset('heart', 'container', { url: '/static/assets/models/heart_draco.glb' })
                    };
                    var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                    assetListLoader.load(function () {
                        app.start();
                        app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                        // create an instance using render component
                        var entity = assets.heart.resource.instantiateRenderEntity({
                            receiveShadows: false
                        });
                        app.root.addChild(entity);
                        entity.setLocalScale(20, 20, 20);
                        // Create an Entity with a camera component
                        var camera = new pc__namespace.Entity();
                        camera.addComponent("camera", {
                            clearColor: new pc__namespace.Color(0.2, 0.2, 0.2)
                        });
                        camera.translate(0, 0.5, 4);
                        app.root.addChild(camera);
                        // Create an entity with a omni light component
                        var light = new pc__namespace.Entity();
                        light.addComponent("light", {
                            type: "omni",
                            intensity: 3
                        });
                        light.setLocalPosition(1, 1, 5);
                        app.root.addChild(light);
                        app.on("update", function (dt) {
                            if (entity) {
                                entity.rotate(4 * dt, -20 * dt, 0);
                            }
                        });
                    });
                });
            }
        };
        DracoGlbExample.CATEGORY = 'Loaders';
        DracoGlbExample.NAME = 'Draco GLB';
        DracoGlbExample.WEBGPU_ENABLED = true;
        return DracoGlbExample;
    }());

    var LoadersGlExample = /** @class */ (function () {
        function LoadersGlExample() {
        }
        LoadersGlExample.prototype.load = function () {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(ScriptLoader, { name: 'CORE', url: 'https://cdn.jsdelivr.net/npm/@loaders.gl/core@2.3.6/dist/dist.min.js' }),
                React__default["default"].createElement(ScriptLoader, { name: 'DRACO', url: 'https://cdn.jsdelivr.net/npm/@loaders.gl/draco@2.3.6/dist/dist.min.js' }));
        };
        LoadersGlExample.prototype.example = function (canvas, deviceType, files) {
            // This example uses draco point cloud loader library from https://loaders.gl/
            // Note that many additional formats are supported by the library and can be used.
            // Create the app
            var app = new pc__namespace.Application(canvas, {});
            function loadModel(url) {
                return __awaiter(this, void 0, void 0, function () {
                    var modelData, srcColors, numVertices, colors32, i, mesh, shaderDefinition, shader, material, entity;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, CORE.load(url, DRACO.DracoLoader)];
                            case 1:
                                modelData = _a.sent();
                                srcColors = modelData.attributes.COLOR_0.value;
                                numVertices = srcColors.length / modelData.attributes.COLOR_0.size;
                                colors32 = new Uint8Array(numVertices * 4);
                                for (i = 0; i < numVertices; i++) {
                                    colors32[i * 4 + 0] = srcColors[i * 3 + 0];
                                    colors32[i * 4 + 1] = srcColors[i * 3 + 1];
                                    colors32[i * 4 + 2] = srcColors[i * 3 + 2];
                                    colors32[i * 4 + 3] = 255;
                                }
                                mesh = new pc__namespace.Mesh(app.graphicsDevice);
                                mesh.clear(true, false);
                                mesh.setPositions(modelData.attributes.POSITION.value, modelData.attributes.POSITION.size);
                                mesh.setColors32(colors32);
                                mesh.update(pc__namespace.PRIMITIVE_POINTS);
                                shaderDefinition = {
                                    attributes: {
                                        aPosition: pc__namespace.SEMANTIC_POSITION,
                                        aColor: pc__namespace.SEMANTIC_COLOR
                                    },
                                    vshader: files['shader.vert'],
                                    fshader: files['shader.frag']
                                };
                                shader = new pc__namespace.Shader(app.graphicsDevice, shaderDefinition);
                                material = new pc__namespace.Material();
                                material.shader = shader;
                                material.blendType = pc__namespace.BLENDMODE_ONE_MINUS_DST_ALPHA;
                                material.cull = pc__namespace.CULLFACE_NONE;
                                entity = new pc__namespace.Entity();
                                entity.addComponent('render', {
                                    material: material,
                                    meshInstances: [new pc__namespace.MeshInstance(mesh, material)]
                                });
                                app.root.addChild(entity);
                                return [2 /*return*/];
                        }
                    });
                });
            }
            // Create an Entity with a camera component
            var camera = new pc__namespace.Entity();
            camera.addComponent("camera", {
                clearColor: new pc__namespace.Color(0.1, 0.1, 0.1),
                farClip: 100
            });
            camera.translate(-20, 15, 20);
            camera.lookAt(0, 7, 0);
            app.root.addChild(camera);
            // load the draco model, and then start the application
            loadModel("/static/assets/models/park_points.drc").then(function () {
                app.start();
            });
            // update things each frame
            var time = 0;
            app.on("update", function (dt) {
                time += dt;
                // orbit the camera
                if (camera) {
                    camera.setLocalPosition(40 * Math.sin(time * 0.5), 10, 20 * Math.cos(time * 0.5));
                    camera.lookAt(pc__namespace.Vec3.ZERO);
                }
            });
        };
        LoadersGlExample.CATEGORY = 'Loaders';
        LoadersGlExample.NAME = 'Loaders.gl';
        LoadersGlExample.FILES = {
            'shader.vert': /* glsl */ "\n// Attributes per vertex: position\nattribute vec4 aPosition;\nattribute vec4 aColor;\n\nuniform mat4   matrix_viewProjection;\nuniform mat4   matrix_model;\n\n// Color to fragment program\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    mat4 modelViewProj = matrix_viewProjection * matrix_model;\n    gl_Position = modelViewProj * aPosition;\n\n    gl_PointSize = 1.5;\n    outColor = aColor;\n}",
            'shader.frag': /* glsl */ "\nprecision lowp float;\nvarying vec4 outColor;\n\nvoid main(void)\n{\n    // just output color supplied by vertex shader\n    gl_FragColor = outColor;\n}"
        };
        return LoadersGlExample;
    }());

    var GlbExample = /** @class */ (function () {
        function GlbExample() {
        }
        GlbExample.prototype.example = function (canvas, deviceType) {
            // The example demonstrates loading of glb file, which contains meshes,
            // lights and cameras, and switches between the cameras every 2 seconds.
            var assets = {
                'scene': new pc__namespace.Asset('scene', 'container', { url: '/static/assets/models/geometry-camera-light.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // the array will store loaded cameras
                    var camerasComponents = null;
                    // glb lights use physical units
                    app.scene.physicalUnits = true;
                    // create an instance using render component
                    var entity = assets.scene.resource.instantiateRenderEntity({});
                    app.root.addChild(entity);
                    // find all cameras - by default they are disabled
                    camerasComponents = entity.findComponents("camera");
                    camerasComponents.forEach(function (component) {
                        // set the aspect ratio to automatic to work with any window size
                        component.aspectRatioMode = pc__namespace.ASPECT_AUTO;
                        // set up exposure for physical units
                        component.aperture = 4;
                        component.shutter = 1 / 100;
                        component.sensitivity = 500;
                    });
                    // enable all lights from the glb
                    var lightComponents = entity.findComponents("light");
                    lightComponents.forEach(function (component) {
                        component.enabled = true;
                    });
                    var time = 0;
                    var activeCamera = 0;
                    app.on("update", function (dt) {
                        time -= dt;
                        // change the camera every few seconds
                        if (time <= 0) {
                            time = 2;
                            // disable current camera
                            camerasComponents[activeCamera].enabled = false;
                            // activate next camera
                            activeCamera = (activeCamera + 1) % camerasComponents.length;
                            camerasComponents[activeCamera].enabled = true;
                        }
                    });
                });
            });
        };
        GlbExample.CATEGORY = 'Loaders';
        GlbExample.NAME = 'GLB';
        GlbExample.WEBGPU_ENABLED = true;
        return GlbExample;
    }());

    var GltfExportExample = /** @class */ (function () {
        function GltfExportExample() {
        }
        GltfExportExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Button, { text: 'Download GLTF', onClick: function () { return data.emit('download'); } }));
        };
        GltfExportExample.prototype.example = function (canvas, deviceType, pcx, data) {
            // set up and load draco module, as the glb we load is draco compressed
            pc__namespace.WasmModule.setConfig('DracoDecoderModule', {
                glueUrl: '/static/lib/draco/draco.wasm.js',
                wasmUrl: '/static/lib/draco/draco.wasm.wasm',
                fallbackUrl: '/static/lib/draco/draco.js'
            });
            pc__namespace.WasmModule.getInstance('DracoDecoderModule', demo);
            function demo() {
                var assets = {
                    'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                    'bench': new pc__namespace.Asset('bench', 'container', { url: '/static/assets/models/bench_wooden_01.glb' }),
                    'model': new pc__namespace.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                    'board': new pc__namespace.Asset('statue', 'container', { url: '/static/assets/models/chess-board.glb' })
                };
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.RenderComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                    assetListLoader.load(function () {
                        app.start();
                        // get the instance of the bench and set up with render component
                        var entity1 = assets.bench.resource.instantiateRenderEntity();
                        entity1.setLocalPosition(0, 0, -1.5);
                        app.root.addChild(entity1);
                        // the character
                        var entity2 = assets.model.resource.instantiateRenderEntity();
                        app.root.addChild(entity2);
                        // chess board
                        var entity3 = assets.board.resource.instantiateRenderEntity();
                        entity3.setLocalScale(0.01, 0.01, 0.01);
                        app.root.addChild(entity3);
                        // a render component with a sphere and cone primitives
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = pc__namespace.Color.RED;
                        material.update();
                        var entity = new pc__namespace.Entity("TwoMeshInstances");
                        entity.addComponent('render', {
                            type: 'asset',
                            meshInstances: [
                                new pc__namespace.MeshInstance(pc__namespace.createSphere(app.graphicsDevice), material),
                                new pc__namespace.MeshInstance(pc__namespace.createCone(app.graphicsDevice), material)
                            ]
                        });
                        app.root.addChild(entity);
                        entity.setLocalPosition(0, 1.5, -1.5);
                        // Create an Entity with a camera component
                        var camera = new pc__namespace.Entity();
                        camera.addComponent("camera", {
                            clearColor: new pc__namespace.Color(0.2, 0.1, 0.1),
                            farClip: 100
                        });
                        camera.translate(-3, 1, 2);
                        camera.lookAt(0, 0.5, 0);
                        app.root.addChild(camera);
                        // set skybox
                        app.scene.envAtlas = assets.helipad.resource;
                        app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                        app.scene.skyboxMip = 1;
                        app.scene.exposure = 1.5;
                        // a link element, created in the html part of the examples.
                        var link = document.getElementById('ar-link');
                        // export the whole scene into a glb format
                        var options = {
                            maxTextureSize: 1024
                        };
                        new pcx.GltfExporter().build(app.root, options).then(function (arrayBuffer) {
                            var blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                            // @ts-ignore
                            link.download = "scene.glb";
                            // @ts-ignore
                            link.href = URL.createObjectURL(blob);
                        }).catch(console.error);
                        // when clicking on the download UI button, trigger the download
                        data.on('download', function () {
                            link.click();
                        });
                    });
                });
            }
        };
        GltfExportExample.CATEGORY = 'Loaders';
        GltfExportExample.NAME = 'GLTF Export';
        GltfExportExample.WEBGPU_ENABLED = true;
        return GltfExportExample;
    }());

    var ObjExample = /** @class */ (function () {
        function ObjExample() {
        }
        ObjExample.prototype.example = function (canvas, deviceType) {
            // Create the app and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
            var objurl = "/static/assets/models/monkey.obj";
            var scripturl = "/static/scripts/parsers/obj-model.js";
            var entity;
            app.assets.loadFromUrl(scripturl, "script", function () {
                // OBJ Parser is not enabled by default in engine. Add the parser to the model resource handler
                // set up obj parser
                // @ts-ignore globally loaded ObjModelParser
                app.loader.getHandler("model").addParser(new ObjModelParser(app.graphicsDevice), function (url) {
                    return (pc__namespace.path.getExtension(url) === '.obj');
                });
                app.assets.loadFromUrl(objurl, "model", function (err, asset) {
                    app.start();
                    entity = new pc__namespace.Entity();
                    entity.addComponent("model");
                    entity.model.model = asset.resource;
                    app.root.addChild(entity);
                    // add a randomly generated material to all mesh instances
                    var mis = entity.model.meshInstances;
                    for (var i = 0; i < mis.length; i++) {
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = new pc__namespace.Color(pc__namespace.math.random(0, 1), pc__namespace.math.random(0, 1), pc__namespace.math.random(0, 1));
                        material.update();
                        mis[i].material = material;
                    }
                });
            });
            // Create an Entity with a camera component
            var camera = new pc__namespace.Entity();
            camera.addComponent("camera", {
                clearColor: new pc__namespace.Color(0.4, 0.45, 0.5)
            });
            camera.translate(0, 0, 5);
            app.root.addChild(camera);
            // Create an Entity with a omni light component
            var light = new pc__namespace.Entity();
            light.addComponent("light", {
                type: "omni",
                color: new pc__namespace.Color(1, 1, 1),
                range: 100
            });
            light.translate(5, 0, 15);
            app.root.addChild(light);
            app.on("update", function (dt) {
                if (entity) {
                    entity.rotate(0, 100 * dt, 0);
                }
            });
        };
        ObjExample.CATEGORY = 'Loaders';
        ObjExample.NAME = 'OBJ';
        return ObjExample;
    }());

    var UsdzExportExample = /** @class */ (function () {
        function UsdzExportExample() {
        }
        UsdzExportExample.prototype.controls = function (data) {
            return React__default["default"].createElement(React__default["default"].Fragment, null,
                React__default["default"].createElement(react.Button, { text: 'Download USDZ', onClick: function () { return data.emit('download'); } }));
        };
        UsdzExportExample.prototype.example = function (canvas, deviceType, pcx, data) {
            var assets = {
                'helipad': new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                'bench': new pc__namespace.Asset('bench', 'container', { url: '/static/assets/models/bench_wooden_01.glb' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // get the instance of the bench and set up with render component
                    var entity = assets.bench.resource.instantiateRenderEntity();
                    app.root.addChild(entity);
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(0.2, 0.1, 0.1),
                        farClip: 100
                    });
                    camera.translate(-3, 1, 2);
                    camera.lookAt(0, 0.5, 0);
                    app.root.addChild(camera);
                    // set skybox
                    app.scene.envAtlas = assets.helipad.resource;
                    app.scene.toneMapping = pc__namespace.TONEMAP_ACES;
                    app.scene.skyboxMip = 1;
                    // a link element, created in the html part of the examples.
                    var link = document.getElementById('ar-link');
                    // convert the loaded entity into asdz file
                    var options = {
                        maxTextureSize: 1024
                    };
                    new pcx.UsdzExporter().build(entity, options).then(function (arrayBuffer) {
                        var blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
                        // On iPhone Safari, this link creates a clickable AR link on the screen. When this is clicked,
                        // the download of the .asdz file triggers its opening in QuickLook AT mode.
                        // In other browsers, this simply downloads the generated .asdz file.
                        // @ts-ignore
                        link.download = "bench.usdz";
                        // @ts-ignore
                        link.href = URL.createObjectURL(blob);
                    }).catch(console.error);
                    // when clicking on the download UI button, trigger the download
                    data.on('download', function () {
                        link.click();
                    });
                    // spin the meshe
                    app.on("update", function (dt) {
                        if (entity) {
                            entity.rotate(0, -12 * dt, 0);
                        }
                    });
                });
            });
        };
        UsdzExportExample.CATEGORY = 'Loaders';
        UsdzExportExample.NAME = 'USDZ Export';
        UsdzExportExample.WEBGPU_ENABLED = true;
        return UsdzExportExample;
    }());

    var index$5 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        DracoGlbExample: DracoGlbExample,
        LoadersGlExample: LoadersGlExample,
        GlbExample: GlbExample,
        GltfExportExample: GltfExportExample,
        ObjExample: ObjExample,
        UsdzExportExample: UsdzExportExample
    });

    var HelloWorldExample = /** @class */ (function () {
        function HelloWorldExample() {
        }
        HelloWorldExample.prototype.example = function (canvas, deviceType) {
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ContainerHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                app.start();
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                // create box entity
                var box = new pc__namespace.Entity('cube');
                box.addComponent('render', {
                    type: 'box'
                });
                app.root.addChild(box);
                // create camera entity
                var camera = new pc__namespace.Entity('camera');
                camera.addComponent('camera', {
                    clearColor: new pc__namespace.Color(0.5, 0.6, 0.9)
                });
                app.root.addChild(camera);
                camera.setPosition(0, 0, 3);
                // create directional light entity
                var light = new pc__namespace.Entity('light');
                light.addComponent('light');
                app.root.addChild(light);
                light.setEulerAngles(45, 0, 0);
                // rotate the box according to the delta time since the last frame
                app.on('update', function (dt) { return box.rotate(10 * dt, 20 * dt, 30 * dt); });
            });
        };
        HelloWorldExample.CATEGORY = 'Misc';
        HelloWorldExample.NAME = 'Hello World';
        HelloWorldExample.WEBGPU_ENABLED = true;
        return HelloWorldExample;
    }());

    var MiniStatsExample = /** @class */ (function () {
        function MiniStatsExample() {
        }
        MiniStatsExample.prototype.example = function (canvas, deviceType, pcx) {
            // Create the application and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            app.start();
            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
            window.addEventListener("resize", function () {
                app.resizeCanvas(canvas.width, canvas.height);
            });
            // set up options for mini-stats, start with the default options
            var options = pcx.MiniStats.getDefaultOptions();
            // configure sizes
            options.sizes = [
                { width: 128, height: 16, spacing: 0, graphs: false },
                { width: 256, height: 32, spacing: 2, graphs: true },
                { width: 500, height: 64, spacing: 2, graphs: true }
            ];
            // when the application starts, use the largest size
            options.startSizeIndex = 2;
            // display additional counters
            // Note: for most of these to report values, either debug or profiling engine build needs to be used.
            options.stats = [
                // frame update time in ms
                {
                    name: "Update",
                    stats: ["frame.updateTime"],
                    decimalPlaces: 1,
                    unitsName: "ms",
                    watermark: 33
                },
                // total number of draw calls
                {
                    name: "DrawCalls",
                    stats: ["drawCalls.total"],
                    watermark: 2000
                },
                // total number of triangles, in 1000s
                {
                    name: "triCount",
                    stats: ["frame.triangles"],
                    decimalPlaces: 1,
                    multiplier: 1 / 1000,
                    unitsName: "k",
                    watermark: 500
                },
                // number of materials used in a frame
                {
                    name: "materials",
                    stats: ["frame.materials"],
                    watermark: 2000
                },
                // frame time it took to do frustum culling
                {
                    name: "cull",
                    stats: ["frame.cullTime"],
                    decimalPlaces: 1,
                    watermark: 1,
                    unitsName: "ms"
                },
                // used VRAM, displayed using 2 colors - red for textures, green for geometry
                {
                    name: "VRAM",
                    stats: ["vram.tex", "vram.geom"],
                    decimalPlaces: 1,
                    multiplier: 1 / (1024 * 1024),
                    unitsName: "MB",
                    watermark: 100
                },
                // frames per second
                {
                    name: "FPS",
                    stats: ["frame.fps"],
                    watermark: 60
                },
                // delta time
                {
                    name: "Frame",
                    stats: ["frame.ms"],
                    decimalPlaces: 1,
                    unitsName: "ms",
                    watermark: 33
                }
            ];
            // create mini-stats system
            new pcx.MiniStats(app, options);
            // add directional lights to the scene
            var light = new pc__namespace.Entity();
            light.addComponent("light", {
                type: "directional"
            });
            app.root.addChild(light);
            light.setLocalEulerAngles(45, 30, 0);
            // Create an entity with a camera component
            var camera = new pc__namespace.Entity();
            camera.addComponent("camera", {
                clearColor: new pc__namespace.Color(0.1, 0.1, 0.1)
            });
            app.root.addChild(camera);
            camera.setLocalPosition(20, 10, 10);
            camera.lookAt(pc__namespace.Vec3.ZERO);
            // helper function to create a primitive with shape type, position, scale
            function createPrimitive(primitiveType, position, scale) {
                // create material of random color
                var material = new pc__namespace.StandardMaterial();
                material.diffuse = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                material.update();
                // create primitive
                var primitive = new pc__namespace.Entity();
                primitive.addComponent('model', {
                    type: primitiveType
                });
                primitive.model.material = material;
                // set position and scale
                primitive.setLocalPosition(position);
                primitive.setLocalScale(scale);
                return primitive;
            }
            // list of all created engine resources
            var entities = [];
            var vertexBuffers = [];
            var textures = [];
            // update function called every frame
            var adding = true;
            var step = 10, max = 2000;
            var entity, vertexBuffer, texture;
            app.on("update", function () {
                // execute some tasks multiple times per frame
                for (var i = 0; i < step; i++) {
                    // allocating resources
                    if (adding) {
                        // add entity (they used shared geometry internally, and we create individual material for each)
                        var shape = Math.random() < 0.5 ? "box" : "sphere";
                        var position = new pc__namespace.Vec3(Math.random() * 10, Math.random() * 10, Math.random() * 10);
                        var scale = 0.5 + Math.random();
                        entity = createPrimitive(shape, position, new pc__namespace.Vec3(scale, scale, scale));
                        entities.push(entity);
                        app.root.addChild(entity);
                        // if allocation reached the max limit, switch to removing mode
                        if (entities.length >= max) {
                            adding = false;
                        }
                        // add vertex buffer
                        var vertexCount = 500;
                        var data = new Float32Array(vertexCount * 16);
                        vertexBuffer = new pc__namespace.VertexBuffer(app.graphicsDevice, pc__namespace.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice), vertexCount, pc__namespace.BUFFER_STATIC, data);
                        vertexBuffers.push(vertexBuffer);
                        // allocate texture
                        var texture_1 = new pc__namespace.Texture(app.graphicsDevice, {
                            width: 64,
                            height: 64,
                            format: pc__namespace.PIXELFORMAT_RGB8,
                            mipmaps: false
                        });
                        textures.push(texture_1);
                        // ensure texture is uploaded (actual VRAM is allocated)
                        texture_1.lock();
                        texture_1.unlock();
                        // @ts-ignore engine-tsd
                        app.graphicsDevice.setTexture(texture_1, 0);
                    }
                    else { // de-allocating resources
                        if (entities.length > 0) {
                            // destroy entities
                            entity = entities[entities.length - 1];
                            // @ts-ignore engine-tsd
                            entity.destroy();
                            entities.length--;
                            // destroy vertex buffer
                            vertexBuffer = vertexBuffers[vertexBuffers.length - 1];
                            vertexBuffer.destroy();
                            vertexBuffers.length--;
                            // destroy texture
                            texture = textures[textures.length - 1];
                            texture.destroy();
                            textures.length--;
                        }
                        else {
                            adding = true;
                        }
                    }
                }
            });
        };
        MiniStatsExample.CATEGORY = 'Misc';
        MiniStatsExample.NAME = 'Mini Stats';
        MiniStatsExample.ENGINE = 'PERFORMANCE';
        MiniStatsExample.MINISTATS = true;
        return MiniStatsExample;
    }());

    var SpineboyExample = /** @class */ (function () {
        function SpineboyExample() {
        }
        SpineboyExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'skeleton': new pc__namespace.Asset('skeleton', 'json', { url: '/static/assets/spine/spineboy-pro.json' }),
                'atlas': new pc__namespace.Asset('atlas', 'text', { url: '/static/assets/spine/spineboy-pro.atlas' }),
                'texture': new pc__namespace.Asset('spineboy-pro.png', 'texture', { url: '/static/assets/spine/spineboy-pro.png' }),
                'spinescript': new pc__namespace.Asset('spinescript', 'script', { url: '/static/scripts/spine/playcanvas-spine.3.8.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler,
                    // @ts-ignore
                    pc__namespace.JsonHandler,
                    // @ts-ignore
                    pc__namespace.TextHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // create camera entity
                    var camera = new pc__namespace.Entity('camera');
                    camera.addComponent('camera', {
                        clearColor: new pc__namespace.Color(0.5, 0.6, 0.9)
                    });
                    app.root.addChild(camera);
                    camera.translateLocal(0, 7, 20);
                    var createSpineInstance = function (position, scale, timeScale) {
                        var spineEntity = new pc__namespace.Entity();
                        spineEntity.addComponent("spine", {
                            atlasAsset: assets.atlas.id,
                            skeletonAsset: assets.skeleton.id,
                            textureAssets: [assets.texture.id]
                        });
                        spineEntity.setLocalPosition(position);
                        spineEntity.setLocalScale(scale);
                        app.root.addChild(spineEntity);
                        // play spine animation
                        // @ts-ignore
                        spineEntity.spine.state.setAnimation(0, "portal", true);
                        // @ts-ignore
                        spineEntity.spine.state.timeScale = timeScale;
                    };
                    // create spine entity 1
                    createSpineInstance(new pc__namespace.Vec3(2, 2, 0), new pc__namespace.Vec3(1, 1, 1), 1);
                    // create spine entity 2
                    createSpineInstance(new pc__namespace.Vec3(2, 10, 0), new pc__namespace.Vec3(-0.5, 0.5, 0.5), 0.5);
                });
            });
        };
        SpineboyExample.CATEGORY = 'Misc';
        SpineboyExample.NAME = 'Spineboy';
        SpineboyExample.WEBGPU_ENABLED = true;
        return SpineboyExample;
    }());

    var index$4 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        HelloWorldExample: HelloWorldExample,
        MiniStatsExample: MiniStatsExample,
        SpineboyExample: SpineboyExample
    });

    var CompoundCollisionExample = /** @class */ (function () {
        function CompoundCollisionExample() {
        }
        CompoundCollisionExample.prototype.example = function (canvas, deviceType) {
            pc__namespace.WasmModule.setConfig('Ammo', {
                glueUrl: '/static/lib/ammo/ammo.wasm.js',
                wasmUrl: '/static/lib/ammo/ammo.wasm.wasm',
                fallbackUrl: '/static/lib/ammo/ammo.js'
            });
            pc__namespace.WasmModule.getInstance('Ammo', demo);
            function demo() {
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.RenderComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem,
                        // @ts-ignore
                        pc__namespace.ScriptComponentSystem,
                        // @ts-ignore
                        pc__namespace.CollisionComponentSystem,
                        // @ts-ignore
                        pc__namespace.RigidBodyComponentSystem,
                        // @ts-ignore
                        pc__namespace.ElementComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler,
                        // @ts-ignore
                        pc__namespace.ScriptHandler,
                        // @ts-ignore
                        pc__namespace.JsonHandler,
                        // @ts-ignore
                        pc__namespace.FontHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    app.start();
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                    function createMaterial(color) {
                        var material = new pc__namespace.StandardMaterial();
                        material.diffuse = color;
                        material.update();
                        return material;
                    }
                    // Create a couple of materials for our objects
                    var red = createMaterial(new pc__namespace.Color(0.7, 0.3, 0.3));
                    var gray = createMaterial(new pc__namespace.Color(0.7, 0.7, 0.7));
                    // Define a scene hierarchy in JSON format. This is loaded/parsed in
                    // the parseScene function below
                    var scene = [
                        {
                            // The Chair entity has a collision component of type 'compound' and a
                            // rigidbody component. This means that any descendent entity with a
                            // collision component is added to a compound collision shape on the
                            // Chair entity. You can use compound collision shapes to define
                            // complex, rigid shapes.
                            name: 'Chair',
                            pos: [0, 1, 0],
                            components: [
                                {
                                    type: 'collision',
                                    options: {
                                        type: 'compound'
                                    }
                                }, {
                                    type: 'rigidbody',
                                    options: {
                                        type: 'dynamic',
                                        friction: 0.5,
                                        mass: 10,
                                        restitution: 0.5
                                    }
                                }
                            ],
                            children: [
                                {
                                    name: 'Seat',
                                    components: [
                                        {
                                            type: 'collision',
                                            options: {
                                                type: 'box',
                                                halfExtents: [0.25, 0.025, 0.25]
                                            }
                                        }
                                    ],
                                    children: [
                                        {
                                            name: 'Seat Model',
                                            scl: [0.5, 0.05, 0.5],
                                            components: [
                                                {
                                                    type: 'render',
                                                    options: {
                                                        type: 'box',
                                                        material: gray
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }, {
                                    name: 'Seat Back',
                                    pos: [0, 0.3, -0.2],
                                    components: [
                                        {
                                            type: 'collision',
                                            options: {
                                                type: 'box',
                                                halfExtents: [0.25, 0.2, 0.025]
                                            }
                                        }
                                    ],
                                    children: [
                                        {
                                            name: 'Seat Back Model',
                                            scl: [0.5, 0.4, 0.05],
                                            components: [
                                                {
                                                    type: 'render',
                                                    options: {
                                                        type: 'box',
                                                        material: gray
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }, {
                                    name: 'Leg 1',
                                    pos: [0.2, -0.25, 0.2],
                                    components: [
                                        {
                                            type: 'collision',
                                            options: {
                                                type: 'cylinder',
                                                height: 0.5,
                                                radius: 0.025
                                            }
                                        }
                                    ],
                                    children: [
                                        {
                                            name: 'Leg 1 Model',
                                            scl: [0.05, 0.5, 0.05],
                                            components: [
                                                {
                                                    type: 'render',
                                                    options: {
                                                        type: 'cylinder',
                                                        material: gray
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }, {
                                    name: 'Leg 2',
                                    pos: [-0.2, -0.25, 0.2],
                                    components: [
                                        {
                                            type: 'collision',
                                            options: {
                                                type: 'cylinder',
                                                height: 0.5,
                                                radius: 0.025
                                            }
                                        }
                                    ],
                                    children: [
                                        {
                                            name: 'Leg 2 Model',
                                            scl: [0.05, 0.5, 0.05],
                                            components: [
                                                {
                                                    type: 'render',
                                                    options: {
                                                        type: 'cylinder',
                                                        material: gray
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }, {
                                    name: 'Leg 3',
                                    pos: [0.2, 0, -0.2],
                                    components: [
                                        {
                                            type: 'collision',
                                            options: {
                                                type: 'cylinder',
                                                height: 1,
                                                radius: 0.025
                                            }
                                        }
                                    ],
                                    children: [
                                        {
                                            name: 'Leg 3 Model',
                                            scl: [0.05, 1, 0.05],
                                            components: [
                                                {
                                                    type: 'render',
                                                    options: {
                                                        type: 'cylinder',
                                                        material: gray
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }, {
                                    name: 'Leg 4',
                                    pos: [-0.2, 0, -0.2],
                                    components: [
                                        {
                                            type: 'collision',
                                            options: {
                                                type: 'cylinder',
                                                height: 1,
                                                radius: 0.025
                                            }
                                        }
                                    ],
                                    children: [
                                        {
                                            name: 'Leg 4 Model',
                                            scl: [0.05, 1, 0.05],
                                            components: [
                                                {
                                                    type: 'render',
                                                    options: {
                                                        type: 'cylinder',
                                                        material: gray
                                                    }
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }, {
                            name: 'Ground',
                            pos: [0, -0.5, 0],
                            components: [
                                {
                                    type: 'collision',
                                    options: {
                                        type: 'box',
                                        halfExtents: [5, 0.5, 5]
                                    }
                                }, {
                                    type: 'rigidbody',
                                    options: {
                                        type: 'static',
                                        restitution: 0.5
                                    }
                                }
                            ],
                            children: [
                                {
                                    name: 'Ground Model',
                                    scl: [10, 1, 10],
                                    components: [
                                        {
                                            type: 'render',
                                            options: {
                                                type: 'box',
                                                material: gray
                                            }
                                        }
                                    ]
                                }
                            ]
                        }, {
                            name: 'Directional Light',
                            rot: [45, 130, 0],
                            components: [
                                {
                                    type: 'light',
                                    options: {
                                        type: 'directional',
                                        castShadows: true,
                                        shadowDistance: 8,
                                        shadowBias: 0.1,
                                        intensity: 1,
                                        normalOffsetBias: 0.05
                                    }
                                }
                            ]
                        }, {
                            name: 'Camera',
                            pos: [0, 4, 7],
                            rot: [-30, 0, 0],
                            components: [
                                {
                                    type: 'camera',
                                    options: {
                                        color: [0.5, 0.5, 0.5]
                                    }
                                }
                            ]
                        }
                    ];
                    // Convert an entity definition in the structure above to a pc.Entity object
                    function parseEntity(e) {
                        var entity = new pc__namespace.Entity(e.name);
                        if (e.pos) {
                            entity.setLocalPosition(e.pos[0], e.pos[1], e.pos[2]);
                        }
                        if (e.rot) {
                            entity.setLocalEulerAngles(e.rot[0], e.rot[1], e.rot[2]);
                        }
                        if (e.scl) {
                            entity.setLocalScale(e.scl[0], e.scl[1], e.scl[2]);
                        }
                        if (e.components) {
                            e.components.forEach(function (c) {
                                entity.addComponent(c.type, c.options);
                            });
                        }
                        if (e.children) {
                            e.children.forEach(function (child) {
                                entity.addChild(parseEntity(child));
                            });
                        }
                        return entity;
                    }
                    // Parse the scene data above into entities and add them to the scene's root entity
                    function parseScene(s) {
                        s.forEach(function (e) {
                            app.root.addChild(parseEntity(e));
                        });
                    }
                    parseScene(scene);
                    var numChairs = 0;
                    // Clone the chair entity hierarchy and add it to the scene root
                    function spawnChair() {
                        var chair = app.root.findByName('Chair');
                        var clone = chair.clone();
                        clone.setLocalPosition(Math.random() * 1 - 0.5, Math.random() * 2 + 1, Math.random() * 1 - 0.5);
                        app.root.addChild(clone);
                        numChairs++;
                    }
                    // Set an update function on the application's update event
                    var time = 0;
                    app.on("update", function (dt) {
                        // Add a new chair every 250 ms
                        time += dt;
                        if (time > 0.25 && numChairs < 20) {
                            spawnChair();
                            time = 0;
                        }
                        // Show active bodies in red and frozen bodies in gray
                        app.root.findComponents('rigidbody').forEach(function (body) {
                            body.entity.findComponents('render').forEach(function (render) {
                                render.material = body.isActive() ? red : gray;
                            });
                        });
                    });
                });
            }
        };
        CompoundCollisionExample.CATEGORY = 'Physics';
        CompoundCollisionExample.NAME = 'Compound Collision';
        CompoundCollisionExample.WEBGPU_ENABLED = true;
        return CompoundCollisionExample;
    }());

    var OffsetCollisionExample = /** @class */ (function () {
        function OffsetCollisionExample() {
        }
        OffsetCollisionExample.prototype.example = function (canvas, deviceType, data) {
            pc__namespace.WasmModule.setConfig('Ammo', {
                glueUrl: '/static/lib/ammo/ammo.wasm.js',
                wasmUrl: '/static/lib/ammo/ammo.wasm.wasm',
                fallbackUrl: '/static/lib/ammo/ammo.js'
            });
            pc__namespace.WasmModule.getInstance('Ammo', demo);
            function demo() {
                var assets = {
                    'model': new pc__namespace.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
                    'idleAnim': new pc__namespace.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/idle.glb' }),
                    helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                };
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.RenderComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem,
                        // @ts-ignore
                        pc__namespace.ScriptComponentSystem,
                        // @ts-ignore
                        pc__namespace.CollisionComponentSystem,
                        // @ts-ignore
                        pc__namespace.RigidBodyComponentSystem,
                        // @ts-ignore
                        pc__namespace.AnimComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler,
                        // @ts-ignore
                        pc__namespace.ScriptHandler,
                        // @ts-ignore
                        pc__namespace.AnimClipHandler,
                        // @ts-ignore
                        pc__namespace.AnimStateGraphHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                    assetListLoader.load(function () {
                        app.start();
                        // setup skydome
                        app.scene.exposure = 2;
                        app.scene.skyboxMip = 2;
                        app.scene.envAtlas = assets.helipad.resource;
                        // Create an entity with a light component
                        var lightEntity = new pc__namespace.Entity();
                        lightEntity.addComponent("light", {
                            castShadows: true,
                            intensity: 1.5,
                            normalOffsetBias: 0.2,
                            shadowType: pc__namespace.SHADOW_PCF5,
                            shadowDistance: 12,
                            shadowResolution: 4096,
                            shadowBias: 0.2
                        });
                        app.root.addChild(lightEntity);
                        lightEntity.setLocalEulerAngles(45, 30, 0);
                        // Set the gravity for our rigid bodies
                        app.systems.rigidbody.gravity.set(0, -9.81, 0);
                        function createMaterial(color) {
                            var material = new pc__namespace.StandardMaterial();
                            material.diffuse = color;
                            // we need to call material.update when we change its properties
                            material.update();
                            return material;
                        }
                        // create a few materials for our objects
                        var red = createMaterial(new pc__namespace.Color(1, 0.3, 0.3));
                        var gray = createMaterial(new pc__namespace.Color(0.7, 0.7, 0.7));
                        var floor = new pc__namespace.Entity();
                        floor.addComponent("render", {
                            type: "box",
                            material: gray
                        });
                        // Scale it and move it so that the top is at 0 on the y axis
                        floor.setLocalScale(10, 1, 10);
                        floor.translateLocal(0, -0.5, 0);
                        // Add a rigidbody component so that other objects collide with it
                        floor.addComponent("rigidbody", {
                            type: "static",
                            restitution: 0.5
                        });
                        // Add a collision component
                        floor.addComponent("collision", {
                            type: "box",
                            halfExtents: new pc__namespace.Vec3(5, 0.5, 5)
                        });
                        // Add the floor to the hierarchy
                        app.root.addChild(floor);
                        // Create an entity from the loaded model using the render component
                        var modelEntity = assets.model.resource.instantiateRenderEntity({
                            castShadows: true
                        });
                        // Add an anim component to the entity
                        modelEntity.addComponent('anim', {
                            activate: true
                        });
                        // create an anim state graph
                        var animStateGraphData = {
                            "layers": [
                                {
                                    "name": "characterState",
                                    "states": [
                                        {
                                            "name": "START"
                                        },
                                        {
                                            "name": "Idle",
                                            "speed": 1.0,
                                            "loop": true
                                        }
                                    ],
                                    "transitions": [
                                        {
                                            "from": "START",
                                            "to": "Idle"
                                        }
                                    ]
                                }
                            ],
                            "parameters": {}
                        };
                        // load the state graph into the anim component
                        modelEntity.anim.loadStateGraph(animStateGraphData);
                        // Add a rigid body and collision for the head with offset as the model's origin is
                        // at the feet on the floor
                        modelEntity.addComponent("rigidbody", {
                            type: "static",
                            restitution: 0.5
                        });
                        modelEntity.addComponent("collision", {
                            type: "sphere",
                            radius: 0.3,
                            linearOffset: [0, 1.25, 0]
                        });
                        // load the state graph asset resource into the anim component
                        var characterStateLayer = modelEntity.anim.baseLayer;
                        characterStateLayer.assignAnimation('Idle', assets.idleAnim.resource.animations[0].resource);
                        app.root.addChild(modelEntity);
                        // Create an Entity with a camera component
                        var cameraEntity = new pc__namespace.Entity();
                        cameraEntity.addComponent("camera");
                        cameraEntity.translate(0, 2, 5);
                        var lookAtPosition = modelEntity.getPosition();
                        cameraEntity.lookAt(lookAtPosition.x, lookAtPosition.y + 0.75, lookAtPosition.z);
                        app.root.addChild(cameraEntity);
                        // create a ball template that we can clone in the update loop
                        var ball = new pc__namespace.Entity();
                        ball.tags.add('shape');
                        ball.setLocalScale(0.4, 0.4, 0.4);
                        ball.addComponent("render", {
                            type: "sphere"
                        });
                        ball.addComponent("rigidbody", {
                            type: "dynamic",
                            mass: 50,
                            restitution: 0.5
                        });
                        ball.addComponent("collision", {
                            type: "sphere",
                            radius: 0.2
                        });
                        ball.enabled = false;
                        // initialize variables for our update function
                        var timer = 0;
                        var count = 40;
                        // Set an update function on the application's update event
                        app.on("update", function (dt) {
                            // create a falling box every 0.2 seconds
                            if (count > 0) {
                                timer -= dt;
                                if (timer <= 0) {
                                    count--;
                                    timer = 0.5;
                                    // Create a new ball to drop
                                    var clone = ball.clone();
                                    clone.rigidbody.teleport(pc__namespace.math.random(-0.25, 0.25), 5, pc__namespace.math.random(-0.25, 0.25));
                                    app.root.addChild(clone);
                                    clone.enabled = true;
                                }
                            }
                            // Show active bodies in red and frozen bodies in gray
                            app.root.findByTag("shape").forEach(function (entity) {
                                entity.render.meshInstances[0].material = entity.rigidbody.isActive() ? red : gray;
                            });
                            // Render the offset collision
                            app.scene.immediate.drawWireSphere(modelEntity.collision.getShapePosition(), 0.3, pc__namespace.Color.GREEN, 16, true, app.scene.layers.getLayerByName("World"));
                        });
                    });
                });
            }
        };
        OffsetCollisionExample.CATEGORY = 'Physics';
        OffsetCollisionExample.NAME = 'Offset Collision';
        OffsetCollisionExample.WEBGPU_ENABLED = true;
        return OffsetCollisionExample;
    }());

    var FallingShapesExample = /** @class */ (function () {
        function FallingShapesExample() {
        }
        FallingShapesExample.prototype.example = function (canvas, deviceType) {
            pc__namespace.WasmModule.setConfig('Ammo', {
                glueUrl: '/static/lib/ammo/ammo.wasm.js',
                wasmUrl: '/static/lib/ammo/ammo.wasm.wasm',
                fallbackUrl: '/static/lib/ammo/ammo.js'
            });
            pc__namespace.WasmModule.getInstance('Ammo', demo);
            function demo() {
                var assets = {
                    'torus': new pc__namespace.Asset('torus', 'container', { url: '/static/assets/models/torus.glb' })
                };
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.RenderComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem,
                        // @ts-ignore
                        pc__namespace.ScriptComponentSystem,
                        // @ts-ignore
                        pc__namespace.CollisionComponentSystem,
                        // @ts-ignore
                        pc__namespace.RigidBodyComponentSystem,
                        // @ts-ignore
                        pc__namespace.ElementComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler,
                        // @ts-ignore
                        pc__namespace.ScriptHandler,
                        // @ts-ignore
                        pc__namespace.JsonHandler,
                        // @ts-ignore
                        pc__namespace.FontHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                    assetListLoader.load(function () {
                        app.start();
                        app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                        // Set the gravity for our rigid bodies
                        app.systems.rigidbody.gravity.set(0, -9.81, 0);
                        function createMaterial(color) {
                            var material = new pc__namespace.StandardMaterial();
                            material.diffuse = color;
                            // we need to call material.update when we change its properties
                            material.update();
                            return material;
                        }
                        // create a few materials for our objects
                        var red = createMaterial(new pc__namespace.Color(1, 0.3, 0.3));
                        var gray = createMaterial(new pc__namespace.Color(0.7, 0.7, 0.7));
                        // ***********    Create our floor   *******************
                        var floor = new pc__namespace.Entity();
                        floor.addComponent("render", {
                            type: "box",
                            material: gray
                        });
                        // scale it
                        floor.setLocalScale(10, 1, 10);
                        // add a rigidbody component so that other objects collide with it
                        floor.addComponent("rigidbody", {
                            type: "static",
                            restitution: 0.5
                        });
                        // add a collision component
                        floor.addComponent("collision", {
                            type: "box",
                            halfExtents: new pc__namespace.Vec3(5, 0.5, 5)
                        });
                        // add the floor to the hierarchy
                        app.root.addChild(floor);
                        // ***********    Create lights   *******************
                        // make our scene prettier by adding a directional light
                        var light = new pc__namespace.Entity();
                        light.addComponent("light", {
                            type: "directional",
                            color: new pc__namespace.Color(1, 1, 1),
                            castShadows: true,
                            shadowBias: 0.2,
                            shadowDistance: 25,
                            normalOffsetBias: 0.05,
                            shadowResolution: 2048
                        });
                        // set the direction for our light
                        light.setLocalEulerAngles(45, 30, 0);
                        // Add the light to the hierarchy
                        app.root.addChild(light);
                        // ***********    Create camera    *******************
                        // Create an Entity with a camera component
                        var camera = new pc__namespace.Entity();
                        camera.addComponent("camera", {
                            clearColor: new pc__namespace.Color(0.5, 0.5, 0.8),
                            farClip: 50
                        });
                        // add the camera to the hierarchy
                        app.root.addChild(camera);
                        // Move the camera a little further away
                        camera.translate(0, 10, 15);
                        camera.lookAt(0, 2, 0);
                        // helper function which creates a template for a collider
                        var createTemplate = function (type, collisionOptions, template) {
                            // add a render component (visible mesh)
                            if (!template) {
                                template = new pc__namespace.Entity();
                                template.addComponent("render", {
                                    type: type
                                });
                            }
                            // ...a rigidbody component of type 'dynamic' so that it is simulated by the physics engine...
                            template.addComponent("rigidbody", {
                                type: "dynamic",
                                mass: 50,
                                restitution: 0.5
                            });
                            // ... and a collision component
                            template.addComponent("collision", collisionOptions);
                            return template;
                        };
                        // ***********    Create templates    *******************
                        // Create a template for a falling box
                        var boxTemplate = createTemplate("box", {
                            type: "box",
                            halfExtents: new pc__namespace.Vec3(0.5, 0.5, 0.5)
                        });
                        // A sphere...
                        var sphereTemplate = createTemplate("sphere", {
                            type: "sphere",
                            radius: 0.5
                        });
                        // A capsule...
                        var capsuleTemplate = createTemplate("capsule", {
                            type: "capsule",
                            radius: 0.5,
                            height: 2
                        });
                        // A cylinder...
                        var cylinderTemplate = createTemplate("cylinder", {
                            type: "cylinder",
                            radius: 0.5,
                            height: 1
                        });
                        // A torus mesh...
                        var container = assets.torus.resource;
                        var meshTemplate = container.instantiateRenderEntity();
                        createTemplate(null, {
                            type: 'mesh',
                            renderAsset: container.renders[0]
                        }, meshTemplate);
                        // add all the templates to an array so that
                        // we can randomly spawn them
                        var templates = [boxTemplate, sphereTemplate, capsuleTemplate, cylinderTemplate, meshTemplate];
                        // disable the templates because we don't want them to be visible
                        // we'll just use them to clone other Entities
                        templates.forEach(function (template) {
                            template.enabled = false;
                        });
                        // ***********    Update Function   *******************
                        // initialize variables for our update function
                        var timer = 0;
                        var count = 40;
                        // Set an update function on the application's update event
                        app.on("update", function (dt) {
                            // create a falling box every 0.2 seconds
                            if (count > 0) {
                                timer -= dt;
                                if (timer <= 0) {
                                    count--;
                                    timer = 0.2;
                                    // Clone a random template and position it above the floor
                                    var template = templates[Math.floor(Math.random() * templates.length)];
                                    var clone = template.clone();
                                    // enable the clone because the template is disabled
                                    clone.enabled = true;
                                    app.root.addChild(clone);
                                    clone.rigidbody.teleport(pc__namespace.math.random(-1, 1), 10, pc__namespace.math.random(-1, 1));
                                    clone.rigidbody.angularVelocity = new pc__namespace.Vec3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
                                }
                            }
                            // Show active bodies in red and frozen bodies in gray
                            app.root.findComponents('rigidbody').forEach(function (body) {
                                body.entity.render.meshInstances[0].material = body.isActive() ? red : gray;
                            });
                        });
                    });
                });
            }
        };
        FallingShapesExample.CATEGORY = 'Physics';
        FallingShapesExample.NAME = 'Falling Shapes';
        FallingShapesExample.WEBGPU_ENABLED = true;
        return FallingShapesExample;
    }());

    var RaycastExample = /** @class */ (function () {
        function RaycastExample() {
        }
        RaycastExample.prototype.example = function (canvas, deviceType) {
            pc__namespace.WasmModule.setConfig('Ammo', {
                glueUrl: '/static/lib/ammo/ammo.wasm.js',
                wasmUrl: '/static/lib/ammo/ammo.wasm.wasm',
                fallbackUrl: '/static/lib/ammo/ammo.js'
            });
            pc__namespace.WasmModule.getInstance('Ammo', demo);
            function demo() {
                var assets = {
                    'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' })
                };
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.RenderComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem,
                        // @ts-ignore
                        pc__namespace.ScriptComponentSystem,
                        // @ts-ignore
                        pc__namespace.CollisionComponentSystem,
                        // @ts-ignore
                        pc__namespace.RigidBodyComponentSystem,
                        // @ts-ignore
                        pc__namespace.ElementComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler,
                        // @ts-ignore
                        pc__namespace.ScriptHandler,
                        // @ts-ignore
                        pc__namespace.JsonHandler,
                        // @ts-ignore
                        pc__namespace.FontHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                    assetListLoader.load(function () {
                        app.start();
                        app.scene.ambientLight = new pc__namespace.Color(0.2, 0.2, 0.2);
                        function createMaterial(color) {
                            var material = new pc__namespace.StandardMaterial();
                            material.diffuse = color;
                            material.update();
                            return material;
                        }
                        // Create a couple of materials
                        var red = createMaterial(new pc__namespace.Color(1, 0, 0));
                        var green = createMaterial(new pc__namespace.Color(0, 1, 0));
                        // Create light
                        var light = new pc__namespace.Entity();
                        light.addComponent("light", {
                            type: "directional"
                        });
                        app.root.addChild(light);
                        light.setEulerAngles(45, 30, 0);
                        // Create camera
                        var camera = new pc__namespace.Entity();
                        camera.addComponent("camera", {
                            clearColor: new pc__namespace.Color(0.5, 0.5, 0.8)
                        });
                        app.root.addChild(camera);
                        camera.setPosition(5, 0, 15);
                        function createPhysicalShape(type, material, x, y, z) {
                            var e = new pc__namespace.Entity();
                            // Have to set the position of the entity before adding the static rigidbody
                            // component because static bodies cannot be moved after creation
                            app.root.addChild(e);
                            e.setPosition(x, y, z);
                            e.addComponent("render", {
                                type: type,
                                material: material
                            });
                            e.addComponent("rigidbody", {
                                type: "static"
                            });
                            e.addComponent("collision", {
                                type: type,
                                height: type === 'capsule' ? 2 : 1
                            });
                            return e;
                        }
                        // Create two rows of physical geometric shapes
                        var types = ['box', 'capsule', 'cone', 'cylinder', 'sphere'];
                        types.forEach(function (type, idx) {
                            createPhysicalShape(type, green, idx * 2 + 1, 2, 0);
                        });
                        types.forEach(function (type, idx) {
                            createPhysicalShape(type, green, idx * 2 + 1, -2, 0);
                        });
                        // Allocate some colors
                        var white = new pc__namespace.Color(1, 1, 1);
                        var blue = new pc__namespace.Color(0, 0, 1);
                        // Allocate some vectors
                        var start = new pc__namespace.Vec3();
                        var end = new pc__namespace.Vec3();
                        var temp = new pc__namespace.Vec3();
                        // Set an update function on the application's update event
                        var time = 0;
                        var y = 0;
                        app.on("update", function (dt) {
                            time += dt;
                            // Reset all shapes to green
                            app.root.findComponents('render').forEach(function (render) {
                                render.material = green;
                            });
                            y = 2 + 1.2 * Math.sin(time);
                            start.set(0, y, 0);
                            end.set(10, y, 0);
                            // Render the ray used in the raycast
                            app.drawLine(start, end, white);
                            var result = app.systems.rigidbody.raycastFirst(start, end);
                            if (result) {
                                result.entity.render.material = red;
                                // Render the normal on the surface from the hit point
                                temp.copy(result.normal).mulScalar(0.3).add(result.point);
                                app.drawLine(result.point, temp, blue);
                            }
                            y = -2 + 1.2 * Math.sin(time);
                            start.set(0, y, 0);
                            end.set(10, y, 0);
                            // Render the ray used in the raycast
                            app.drawLine(start, end, white);
                            var results = app.systems.rigidbody.raycastAll(start, end);
                            results.forEach(function (result) {
                                result.entity.render.material = red;
                                // Render the normal on the surface from the hit point
                                temp.copy(result.normal).mulScalar(0.3).add(result.point);
                                app.drawLine(result.point, temp, blue);
                            }, this);
                        });
                        var createText = function (fontAsset, message, x, y, z, rot) {
                            // Create a text element-based entity
                            var text = new pc__namespace.Entity();
                            text.addComponent("element", {
                                anchor: [0.5, 0.5, 0.5, 0.5],
                                fontAsset: fontAsset,
                                fontSize: 0.5,
                                pivot: [0, 0.5],
                                text: message,
                                type: pc__namespace.ELEMENTTYPE_TEXT
                            });
                            text.setLocalPosition(x, y, z);
                            text.setLocalEulerAngles(0, 0, rot);
                            app.root.addChild(text);
                        };
                        createText(assets.font, 'raycastFirst', 0.5, 3.75, 0, 0);
                        createText(assets.font, 'raycastAll', 0.5, -0.25, 0, 0);
                    });
                });
            }
        };
        RaycastExample.CATEGORY = 'Physics';
        RaycastExample.NAME = 'Raycast';
        RaycastExample.WEBGPU_ENABLED = true;
        return RaycastExample;
    }());

    var VehicleExample = /** @class */ (function () {
        function VehicleExample() {
        }
        VehicleExample.prototype.example = function (canvas, deviceType) {
            pc__namespace.WasmModule.setConfig('Ammo', {
                glueUrl: '/static/lib/ammo/ammo.wasm.js',
                wasmUrl: '/static/lib/ammo/ammo.wasm.wasm',
                fallbackUrl: '/static/lib/ammo/ammo.js'
            });
            pc__namespace.WasmModule.getInstance('Ammo', demo);
            function demo() {
                var assets = {
                    helipad: new pc__namespace.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc__namespace.TEXTURETYPE_RGBP, mipmaps: false }),
                    'script1': new pc__namespace.Asset('script1', 'script', { url: '/static/scripts/camera/tracking-camera.js' }),
                    'script2': new pc__namespace.Asset('script2', 'script', { url: '/static/scripts/physics/render-physics.js' }),
                    'script3': new pc__namespace.Asset('script3', 'script', { url: '/static/scripts/physics/action-physics-reset.js' }),
                    'script4': new pc__namespace.Asset('script4', 'script', { url: '/static/scripts/physics/vehicle.js' })
                };
                var gfxOptions = {
                    deviceTypes: [deviceType],
                    glslangUrl: '/static/lib/glslang/glslang.js',
                    twgslUrl: '/static/lib/twgsl/twgsl.js'
                };
                pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                    var createOptions = new pc__namespace.AppOptions();
                    createOptions.graphicsDevice = device;
                    createOptions.keyboard = new pc__namespace.Keyboard(document.body);
                    createOptions.componentSystems = [
                        // @ts-ignore
                        pc__namespace.ModelComponentSystem,
                        // @ts-ignore
                        pc__namespace.CameraComponentSystem,
                        // @ts-ignore
                        pc__namespace.LightComponentSystem,
                        // @ts-ignore
                        pc__namespace.ScriptComponentSystem,
                        // @ts-ignore
                        pc__namespace.CollisionComponentSystem,
                        // @ts-ignore
                        pc__namespace.RigidBodyComponentSystem
                    ];
                    createOptions.resourceHandlers = [
                        // @ts-ignore
                        pc__namespace.TextureHandler,
                        // @ts-ignore
                        pc__namespace.ContainerHandler,
                        // @ts-ignore
                        pc__namespace.ScriptHandler,
                        // @ts-ignore
                        pc__namespace.JsonHandler
                    ];
                    var app = new pc__namespace.AppBase(canvas);
                    app.init(createOptions);
                    // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                    app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                    app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                    var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                    assetListLoader.load(function () {
                        app.start();
                        // setup skydome
                        app.scene.skyboxMip = 2;
                        app.scene.exposure = 0.3;
                        app.scene.envAtlas = assets.helipad.resource;
                        var lighting = app.scene.lighting;
                        lighting.shadowsEnabled = false;
                        // Create a static ground shape for our car to drive on
                        var ground = new pc__namespace.Entity('Ground');
                        ground.addComponent('rigidbody', {
                            type: 'static'
                        });
                        ground.addComponent('collision', {
                            type: 'box',
                            halfExtents: new pc__namespace.Vec3(50, 0.5, 50)
                        });
                        ground.setLocalPosition(0, -0.5, 0);
                        app.root.addChild(ground);
                        // Create 4 wheels for our vehicle
                        var wheels = [];
                        [
                            { name: 'Front Left Wheel', pos: new pc__namespace.Vec3(0.8, 0.4, 1.2), front: true },
                            { name: 'Front Right Wheel', pos: new pc__namespace.Vec3(-0.8, 0.4, 1.2), front: true },
                            { name: 'Back Left Wheel', pos: new pc__namespace.Vec3(0.8, 0.4, -1.2), front: false },
                            { name: 'Back Right Wheel', pos: new pc__namespace.Vec3(-0.8, 0.4, -1.2), front: false }
                        ].forEach(function (wheelDef) {
                            // Create a wheel
                            var wheel = new pc__namespace.Entity(wheelDef.name);
                            wheel.addComponent('script');
                            wheel.script.create('vehicleWheel', {
                                attributes: {
                                    debugRender: true,
                                    isFront: wheelDef.front
                                }
                            });
                            wheel.setLocalPosition(wheelDef.pos);
                            wheels.push(wheel);
                        });
                        // Create a physical vehicle
                        var vehicle = new pc__namespace.Entity('Vehicle');
                        vehicle.addComponent('rigidbody', {
                            mass: 800,
                            type: 'dynamic'
                        });
                        vehicle.addComponent('collision', {
                            type: 'compound'
                        });
                        vehicle.addComponent('script');
                        vehicle.script.create('vehicle', {
                            attributes: {
                                wheels: wheels
                            }
                        });
                        vehicle.script.create('vehicleControls');
                        vehicle.script.create('actionPhysicsReset', {
                            attributes: {
                                event: 'reset'
                            }
                        });
                        vehicle.setLocalPosition(0, 2, 0);
                        // Create the car chassis, offset upwards in Y from the compound body
                        var chassis = new pc__namespace.Entity('Chassis');
                        chassis.addComponent('collision', {
                            type: 'box',
                            halfExtents: [0.6, 0.35, 1.65]
                        });
                        chassis.setLocalPosition(0, 0.65, 0);
                        // Create the car chassis, offset upwards in Y from the compound body
                        var cab = new pc__namespace.Entity('Cab');
                        cab.addComponent('collision', {
                            type: 'box',
                            halfExtents: [0.5, 0.2, 1]
                        });
                        cab.setLocalPosition(0, 1.2, -0.25);
                        // Add the vehicle to the hierarchy
                        wheels.forEach(function (wheel) {
                            vehicle.addChild(wheel);
                        });
                        vehicle.addChild(chassis);
                        vehicle.addChild(cab);
                        app.root.addChild(vehicle);
                        // Build a wall of blocks for the car to smash through
                        for (var i = 0; i < 10; i++) {
                            for (var j = 0; j < 5; j++) {
                                var block = new pc__namespace.Entity('Block');
                                block.addComponent('rigidbody', {
                                    type: 'dynamic'
                                });
                                block.addComponent('collision', {
                                    type: 'box'
                                });
                                block.addComponent('script');
                                block.script.create('actionPhysicsReset', {
                                    attributes: {
                                        event: 'reset'
                                    }
                                });
                                block.setLocalPosition(i - 4.5, j + 0.5, -10);
                                app.root.addChild(block);
                            }
                        }
                        // Create a directional light source
                        var light = new pc__namespace.Entity('Directional Light');
                        light.addComponent("light", {
                            type: "directional",
                            color: new pc__namespace.Color(1, 1, 1),
                            castShadows: true,
                            shadowBias: 0.2,
                            shadowDistance: 40,
                            normalOffsetBias: 0.05,
                            shadowResolution: 2048
                        });
                        light.setLocalEulerAngles(45, 30, 0);
                        app.root.addChild(light);
                        // Create a camera to render the scene
                        var camera = new pc__namespace.Entity('Camera');
                        camera.addComponent("camera");
                        camera.addComponent('script');
                        camera.script.create('trackingCamera', {
                            attributes: {
                                target: vehicle
                            }
                        });
                        camera.translate(0, 10, 15);
                        camera.lookAt(0, 0, 0);
                        app.root.addChild(camera);
                        // Enable rendering and resetting of all rigid bodies in the scene
                        app.root.addComponent('script');
                        app.root.script.create('renderPhysics', {
                            attributes: {
                                drawShapes: true,
                                opacity: 1
                            }
                        });
                        app.keyboard.on(pc__namespace.EVENT_KEYDOWN, function (e) {
                            if (e.key === pc__namespace.KEY_R) {
                                app.fire('reset');
                            }
                        });
                    });
                });
            }
        };
        VehicleExample.CATEGORY = 'Physics';
        VehicleExample.NAME = 'Vehicle';
        VehicleExample.WEBGPU_ENABLED = true;
        return VehicleExample;
    }());

    var index$3 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        CompoundCollisionExample: CompoundCollisionExample,
        OffsetCollisionExample: OffsetCollisionExample,
        FallingShapesExample: FallingShapesExample,
        RaycastExample: RaycastExample,
        VehicleExample: VehicleExample
    });

    var PositionalExample = /** @class */ (function () {
        function PositionalExample() {
        }
        PositionalExample.prototype.example = function (canvas, deviceType) {
            // Create the application and start the update loop
            var app = new pc__namespace.Application(canvas, {});
            var assets = {
                'model': new pc__namespace.Asset('model', 'model', { url: '/static/assets/models/playbot/playbot.json' }),
                'runAnim': new pc__namespace.Asset('runAnim', 'animation', { url: '/static/assets/animations/playbot/playbot-run.json' }),
                'gravel': new pc__namespace.Asset('gravel', 'audio', { url: '/static/assets/sounds/footsteps.mp3' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                // Create an Entity with a camera component
                var camera = new pc__namespace.Entity();
                camera.addComponent("camera", {
                    clearColor: new pc__namespace.Color(1, 0, 0)
                });
                camera.addComponent("audiolistener");
                camera.rotateLocal(-30, 0, 0);
                camera.translateLocal(0, 0, 5);
                app.root.addChild(camera);
                // Create an Entity for the ground
                var material = new pc__namespace.StandardMaterial();
                material.diffuse = pc__namespace.Color.GRAY;
                material.update();
                var ground = new pc__namespace.Entity();
                ground.addComponent("render", {
                    type: "box",
                    material: material
                });
                ground.setLocalScale(50, 1, 50);
                ground.setLocalPosition(0, -0.5, 0);
                app.root.addChild(ground);
                // Create an entity with a light component
                var light = new pc__namespace.Entity();
                light.addComponent("light", {
                    type: "directional",
                    color: new pc__namespace.Color(1, 1, 1),
                    castShadows: true,
                    intensity: 2,
                    shadowBias: 0.2,
                    shadowDistance: 16,
                    normalOffsetBias: 0.05,
                    shadowResolution: 2048
                });
                light.setLocalEulerAngles(45, 30, 0);
                app.root.addChild(light);
                app.start();
                // Create walking dude
                var entity = new pc__namespace.Entity();
                // add sound component
                entity.addComponent('sound');
                // add footsteps slot
                entity.sound.addSlot('footsteps', {
                    asset: assets.gravel.id,
                    pitch: 1.7,
                    loop: true,
                    autoPlay: true
                });
                // add model
                entity.addComponent("model", {
                    type: "asset",
                    asset: assets.model,
                    castShadows: true
                });
                // add animation
                entity.addComponent("animation", {
                    assets: [assets.runAnim],
                    speed: 0.8
                });
                // add entity in the hierarchy
                app.root.addChild(entity);
                var angle = 135;
                var radius = 3;
                var height = 0; // 1.1;
                app.on("update", function (dt) {
                    angle += 30 * dt;
                    if (angle > 360) {
                        angle -= 360;
                    }
                    entity.setLocalPosition(radius * Math.sin(angle * pc__namespace.math.DEG_TO_RAD), height, radius * Math.cos(angle * pc__namespace.math.DEG_TO_RAD));
                    entity.setLocalEulerAngles(0, angle + 90, 0);
                });
            });
        };
        PositionalExample.CATEGORY = 'Sound';
        PositionalExample.NAME = 'Positional';
        return PositionalExample;
    }());

    var index$2 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        PositionalExample: PositionalExample
    });

    var ButtonBasicExample = /** @class */ (function () {
        function ButtonBasicExample() {
        }
        ButtonBasicExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // Button
                    var button = new pc__namespace.Entity();
                    button.addComponent("button", {
                        imageEntity: button
                    });
                    button.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        height: 40,
                        pivot: [0.5, 0.5],
                        type: pc__namespace.ELEMENTTYPE_IMAGE,
                        width: 175,
                        useInput: true
                    });
                    screen.addChild(button);
                    // Create a label for the button
                    var label = new pc__namespace.Entity();
                    label.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        color: new pc__namespace.Color(0, 0, 0),
                        fontAsset: assets.font.id,
                        fontSize: 32,
                        height: 64,
                        pivot: [0.5, 0.5],
                        text: "CLICK ME",
                        type: pc__namespace.ELEMENTTYPE_TEXT,
                        width: 128,
                        wrapLines: true
                    });
                    button.addChild(label);
                    // Change the background color every time the button is clicked
                    button.button.on('click', function () {
                        camera.camera.clearColor = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                    });
                });
            });
        };
        ButtonBasicExample.CATEGORY = 'User Interface';
        ButtonBasicExample.NAME = 'Button Basic';
        ButtonBasicExample.WEBGPU_ENABLED = true;
        return ButtonBasicExample;
    }());

    var ButtonSpriteExample = /** @class */ (function () {
        function ButtonSpriteExample() {
        }
        ButtonSpriteExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' }),
                'red_button_atlas': new pc__namespace.Asset('red_button_atlas', 'texture', { url: '/static/assets/button/red_button_atlas.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // Create a simple button
                    var button = new pc__namespace.Entity();
                    button.addComponent("button", {
                        active: true,
                        imageEntity: button,
                        transitionMode: pc__namespace.BUTTON_TRANSITION_MODE_SPRITE_CHANGE
                    });
                    button.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        height: 64,
                        pivot: [0.5, 0.5],
                        type: pc__namespace.ELEMENTTYPE_IMAGE,
                        width: 175,
                        useInput: true
                    });
                    screen.addChild(button);
                    // Create a label for the button
                    var label = new pc__namespace.Entity();
                    label.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        color: new pc__namespace.Color(1, 1, 1),
                        fontAsset: assets.font.id,
                        fontSize: 32,
                        height: 64,
                        opacity: 0.5,
                        pivot: [0.5, 0.5],
                        text: "CLICK ME",
                        type: pc__namespace.ELEMENTTYPE_TEXT,
                        width: 128,
                        wrapLines: true
                    });
                    button.addChild(label);
                    // Change the background color every time the button is clicked
                    button.button.on('click', function () {
                        var r = Math.random();
                        camera.camera.clearColor = new pc__namespace.Color(r, r, r);
                    });
                    // Move the button's label with the animation of the sprite
                    button.button.on('pressedstart', function () {
                        label.translateLocal(0, -4, 0);
                    });
                    button.button.on('pressedend', function () {
                        label.translateLocal(0, 4, 0);
                    });
                    // Apply the font to the text element
                    var texture = assets.red_button_atlas.resource;
                    texture.addressU = pc__namespace.ADDRESS_CLAMP_TO_EDGE;
                    texture.addressV = pc__namespace.ADDRESS_CLAMP_TO_EDGE;
                    texture.minFilter = pc__namespace.FILTER_NEAREST;
                    texture.magFilter = pc__namespace.FILTER_NEAREST;
                    var atlas = new pc__namespace.TextureAtlas();
                    atlas.frames = {
                        "0": {
                            rect: new pc__namespace.Vec4(0, 147, 190, 49),
                            pivot: new pc__namespace.Vec2(0.5, 0.5),
                            border: new pc__namespace.Vec4(7, 11, 7, 7)
                        },
                        "1": {
                            rect: new pc__namespace.Vec4(0, 98, 190, 49),
                            pivot: new pc__namespace.Vec2(0.5, 0.5),
                            border: new pc__namespace.Vec4(7, 11, 7, 7)
                        },
                        "2": {
                            rect: new pc__namespace.Vec4(0, 49, 190, 49),
                            pivot: new pc__namespace.Vec2(0.5, 0.5),
                            border: new pc__namespace.Vec4(7, 11, 7, 7)
                        },
                        "3": {
                            rect: new pc__namespace.Vec4(0, 0, 190, 49),
                            pivot: new pc__namespace.Vec2(0.5, 0.5),
                            border: new pc__namespace.Vec4(7, 11, 7, 7)
                        }
                    };
                    atlas.texture = texture;
                    var createSpriteAsset = function (frame) {
                        var sprite = new pc__namespace.Sprite(app.graphicsDevice, {
                            atlas: atlas,
                            frameKeys: [frame],
                            pixelsPerUnit: 1,
                            renderMode: pc__namespace.SPRITE_RENDERMODE_SIMPLE
                        });
                        var spriteAsset = new pc__namespace.Asset('sprite', 'sprite', { url: '' });
                        spriteAsset.resource = sprite;
                        spriteAsset.loaded = true;
                        app.assets.add(spriteAsset);
                        return spriteAsset;
                    };
                    button.element.spriteAsset = createSpriteAsset('0').id;
                    button.button.hoverSpriteAsset = createSpriteAsset('1');
                    button.button.pressedSpriteAsset = createSpriteAsset('2');
                    button.button.inactiveSpriteAsset = createSpriteAsset('3');
                });
            });
        };
        ButtonSpriteExample.CATEGORY = 'User Interface';
        ButtonSpriteExample.NAME = 'Button Sprite';
        ButtonSpriteExample.WEBGPU_ENABLED = true;
        return ButtonSpriteExample;
    }());

    var CustomShaderExample = /** @class */ (function () {
        function CustomShaderExample() {
        }
        CustomShaderExample.prototype.example = function (canvas, deviceType, files) {
            var assets = {
                "playcanvas": new pc__namespace.Asset("playcanvas", "texture", { url: "/static/assets/textures/playcanvas.png" })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // Create the shader from the vertex and fragment shader
                    var shader = pc__namespace.createShaderFromCode(app.graphicsDevice, files['shader.vert'], files['shader.frag'], 'myUIShader', {
                        vertex_position: pc__namespace.SEMANTIC_POSITION,
                        vertex_texCoord0: pc__namespace.SEMANTIC_TEXCOORD0
                    });
                    // Create a new material with the new shader and additive alpha blending
                    var material = new pc__namespace.Material();
                    material.shader = shader;
                    material.blendType = pc__namespace.BLEND_ADDITIVEALPHA;
                    material.depthWrite = true;
                    material.setParameter("uDiffuseMap", assets.playcanvas.resource);
                    material.update();
                    // Create the UI image element with the custom material
                    var entity = new pc__namespace.Entity();
                    entity.addComponent("element", {
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                        width: 350,
                        height: 350,
                        type: pc__namespace.ELEMENTTYPE_IMAGE
                    });
                    entity.element.material = material;
                    screen.addChild(entity);
                    // update the material's 'amount' parameter to animate the inverse effect
                    var time = 0;
                    app.on('update', function (dt) {
                        time += dt;
                        // animate the amount as a sine wave varying from 0 to 1
                        material.setParameter("amount", (Math.sin(time * 4) + 1) * 0.5);
                    });
                });
            });
        };
        CustomShaderExample.CATEGORY = 'User Interface';
        CustomShaderExample.NAME = 'Custom Shader';
        CustomShaderExample.WEBGPU_ENABLED = true;
        CustomShaderExample.FILES = {
            'shader.vert': /* glsl */ "\n/**\n * Simple Screen-Space Vertex Shader with one UV coordinate.\n * This shader is useful for simple UI shaders.\n * \n * Usage: the following attributes must be configured when creating a new pc.Shader:\n *   vertex_position: pc.SEMANTIC_POSITION\n *   vertex_texCoord0: pc.SEMANTIC_TEXCOORD0\n */\n\n// Default PlayCanvas uniforms\nuniform mat4 matrix_viewProjection;\nuniform mat4 matrix_model;\n\n// Additional inputs\nattribute vec3 vertex_position;\nattribute vec2 vertex_texCoord0;\n\n// Additional shader outputs\nvarying vec2 vUv0;\n\nvoid main(void) {\n    // UV is simply passed along as varying\n    vUv0 = vertex_texCoord0;\n\n    // Position for screen-space\n    gl_Position = matrix_model * vec4(vertex_position, 1.0);\n    gl_Position.zw = vec2(0.0, 1.0);\n}",
            'shader.frag': /* glsl */ "\n/**\n * Simple Color-Inverse Fragment Shader with intensity control.\n * \n * Usage: the following parameters must be set:\n *   uDiffuseMap: image texture.\n *   amount: float that controls the amount of the inverse-color effect. 0 means none (normal color), while 1 means full inverse.\n *\n * Additionally, the Vertex shader that is paired with this Fragment shader must specify:\n *   varying vec2 vUv0: for the UV.\n */\n\n// The following line is for setting the shader precision for floats. It is commented out because, ideally, it must be configured\n// on a per-device basis before loading the Shader. Please check the accompanying TypeScript code and look for 'app.graphicsDevice.precision'.\n\n// precision mediump float;\n\n// Additional varying from vertex shader\nvarying vec2 vUv0;\n\n// Custom Parameters (must be set from code via material.setParameter())\nuniform sampler2D uDiffuseMap;\nuniform float amount;\n\nvoid main(void)\n{\n    vec4 color = texture2D(uDiffuseMap, vUv0);\n    vec3 roloc = 1.0 - color.rgb;\n    gl_FragColor = vec4(mix(color.rgb, roloc, amount), color.a);\n}"
        };
        return CustomShaderExample;
    }());

    var LayoutGroupExample = /** @class */ (function () {
        function LayoutGroupExample() {
        }
        LayoutGroupExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem,
                    // @ts-ignore
                    pc__namespace.LayoutGroupComponentSystem,
                    // @ts-ignore
                    pc__namespace.LayoutChildComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // Create Layout Group Entity
                    var group = new pc__namespace.Entity();
                    group.addComponent("element", {
                        // a Layout Group needs a 'group' element component
                        type: pc__namespace.ELEMENTTYPE_GROUP,
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        pivot: [0.5, 0.5],
                        // the element's width and height dictate the group's bounds
                        width: 350,
                        height: 150
                    });
                    group.addComponent("layoutgroup", {
                        orientation: pc__namespace.ORIENTATION_HORIZONTAL,
                        spacing: new pc__namespace.Vec2(10, 10),
                        // fit_both for width and height, making all child elements take the entire space
                        widthFitting: pc__namespace.FITTING_BOTH,
                        heightFitting: pc__namespace.FITTING_BOTH,
                        // wrap children
                        wrap: true
                    });
                    screen.addChild(group);
                    // create 15 children to show off the layout group
                    for (var i = 0; i < 15; ++i) {
                        // create a random-colored panel
                        var child = new pc__namespace.Entity();
                        child.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            pivot: [0.5, 0.5],
                            color: new pc__namespace.Color(Math.random(), Math.random(), Math.random()),
                            type: pc__namespace.ELEMENTTYPE_IMAGE
                        });
                        child.addComponent("layoutchild", {
                            excludeFromLayout: false
                        });
                        group.addChild(child);
                        // add a text label
                        var childLabel = new pc__namespace.Entity();
                        childLabel.addComponent("element", {
                            // center-position and attach to the borders of parent
                            // meaning this text element will scale along with parent
                            anchor: [0, 0, 1, 1],
                            margin: [0, 0, 0, 0],
                            pivot: [0.5, 0.5],
                            color: new pc__namespace.Color(1, 1, 1),
                            fontAsset: assets.font.id,
                            text: "".concat(i + 1),
                            type: pc__namespace.ELEMENTTYPE_TEXT,
                            // auto font size
                            autoWidth: false,
                            autoHeight: false,
                            autoFitWidth: true,
                            autoFitHeight: true
                        });
                        child.addChild(childLabel);
                    }
                });
            });
        };
        LayoutGroupExample.CATEGORY = 'User Interface';
        LayoutGroupExample.NAME = 'Layout Group';
        LayoutGroupExample.WEBGPU_ENABLED = true;
        return LayoutGroupExample;
    }());

    var ParticleSystemExample = /** @class */ (function () {
        function ParticleSystemExample() {
        }
        ParticleSystemExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' }),
                'spark': new pc__namespace.Asset('spark', 'texture', { url: '/static/assets/textures/spark.png' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem,
                    // @ts-ignore
                    pc__namespace.ParticleSystemComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // Create a simple panel
                    var panel = new pc__namespace.Entity();
                    panel.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        color: new pc__namespace.Color(0.4, 0.4, 0.4),
                        height: 40,
                        pivot: [0.5, 0.5],
                        type: pc__namespace.ELEMENTTYPE_IMAGE,
                        width: 175,
                        useInput: true
                    });
                    screen.addChild(panel);
                    // Create a label for the panel
                    var label = new pc__namespace.Entity();
                    label.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        color: new pc__namespace.Color(1, 1, 0),
                        fontAsset: assets.font.id,
                        fontSize: 36,
                        height: 64,
                        pivot: [0.5, 0.5],
                        text: "LABEL",
                        type: pc__namespace.ELEMENTTYPE_TEXT,
                        width: 128,
                        wrapLines: true
                    });
                    panel.addChild(label);
                    // Create entity for particle system
                    var particles = new pc__namespace.Entity();
                    // insert sparks as a child of the panel, but before Label - that is the order for rendering
                    panel.insertChild(particles, 0);
                    // particles will render in UI layer
                    var UILayer = app.scene.layers.getLayerByName("UI");
                    // particle size
                    var scaleCurve = new pc__namespace.Curve([0, 0.03]);
                    // color changes throughout lifetime
                    var colorCurve = new pc__namespace.CurveSet([
                        [0, 1, 0.25, 1, 0.375, 0.5, 0.5, 0],
                        [0, 0, 0.125, 0.25, 0.25, 0.5, 0.375, 0.75, 0.5, 1],
                        [0, 0, 1, 0]
                    ]);
                    // increasing gravity to get them to move
                    var worldVelocityCurve = new pc__namespace.CurveSet([
                        [0, 0],
                        [0, 0, 0.1, 0.1, 0.1, -0.1],
                        [0, 0]
                    ]);
                    // rotate sparks 360 degrees per second
                    var angleCurve = new pc__namespace.Curve([0, 360]);
                    // when texture is loaded add particlesystem component to entity
                    particles.addComponent("particlesystem", {
                        numParticles: 100,
                        lifetime: 1,
                        rate: 0.01,
                        // make them follow the buttn in screen-space
                        localSpace: true,
                        screenSpace: true,
                        emitterShape: pc__namespace.EMITTERSHAPE_SPHERE,
                        emitterRadius: 100,
                        scaleGraph: scaleCurve,
                        rotationSpeedGraph: angleCurve,
                        colorGraph: colorCurve,
                        velocityGraph: worldVelocityCurve,
                        colorMap: assets.spark.resource,
                        layers: [UILayer.id]
                    });
                    // sort all screen elements
                    screen.screen.syncDrawOrder();
                    var time = 0;
                    app.on("update", function (dt) {
                        time += dt * 0.3;
                        // move buttons along the circular path
                        panel.setLocalPosition(300 * Math.sin(time), 300 * Math.cos(time), 0);
                    });
                });
            });
        };
        ParticleSystemExample.CATEGORY = 'User Interface';
        ParticleSystemExample.NAME = 'Particle System';
        return ParticleSystemExample;
    }());

    var ScrollViewExample = /** @class */ (function () {
        function ScrollViewExample() {
        }
        ScrollViewExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem,
                    // @ts-ignore
                    pc__namespace.LayoutGroupComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScrollViewComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScrollbarComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    app.root.addChild(camera);
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    app.root.addChild(screen);
                    screen.addComponent("screen", {
                        screenSpace: true,
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        scaleBlend: 0.5
                    });
                    function createScrollbar(horizontal) {
                        var handle = new pc__namespace.Entity('Handle');
                        var handleOptions = {
                            type: pc__namespace.ELEMENTTYPE_IMAGE,
                            color: new pc__namespace.Color(1, 1, 1),
                            opacity: 1,
                            margin: new pc__namespace.Vec4(0, 0, 0, 0),
                            rect: new pc__namespace.Vec4(0, 0, 1, 1),
                            mask: false,
                            useInput: true
                        };
                        if (horizontal) {
                            // @ts-ignore engine-tsd
                            handleOptions.anchor = new pc__namespace.Vec4(0, 0, 0, 1); // Split in Y
                            // @ts-ignore engine-tsd
                            handleOptions.pivot = new pc__namespace.Vec2(0, 0); // Bottom left
                        }
                        else {
                            // @ts-ignore engine-tsd
                            handleOptions.anchor = new pc__namespace.Vec4(0, 1, 1, 1); // Split in X
                            // @ts-ignore engine-tsd
                            handleOptions.pivot = new pc__namespace.Vec2(1, 1); // Top right
                        }
                        handle.addComponent('element', handleOptions);
                        handle.addComponent('button', {
                            active: true,
                            imageEntity: handle,
                            hitPadding: new pc__namespace.Vec4(0, 0, 0, 0),
                            transitionMode: pc__namespace.BUTTON_TRANSITION_MODE_TINT,
                            hoverTint: new pc__namespace.Color(1, 1, 1),
                            pressedTint: new pc__namespace.Color(1, 1, 1),
                            inactiveTint: new pc__namespace.Color(1, 1, 1),
                            fadeDuration: 0
                        });
                        var scrollbar = new pc__namespace.Entity(horizontal ? 'HorizontalScrollbar' : 'VerticalScrollbar');
                        scrollbar.addChild(handle);
                        var scrollbarOptions = {
                            type: pc__namespace.ELEMENTTYPE_IMAGE,
                            color: new pc__namespace.Color(0.5, 0.5, 0.5),
                            opacity: 1,
                            rect: new pc__namespace.Vec4(0, 0, 1, 1),
                            mask: false,
                            useInput: false
                        };
                        var scrollbarSize = 20;
                        if (horizontal) {
                            // @ts-ignore engine-tsd
                            scrollbarOptions.anchor = new pc__namespace.Vec4(0, 0, 1, 0);
                            // @ts-ignore engine-tsd
                            scrollbarOptions.pivot = new pc__namespace.Vec2(0, 0);
                            // @ts-ignore engine-tsd
                            scrollbarOptions.margin = new pc__namespace.Vec4(0, 0, scrollbarSize, -scrollbarSize);
                        }
                        else {
                            // @ts-ignore engine-tsd
                            scrollbarOptions.anchor = new pc__namespace.Vec4(1, 0, 1, 1);
                            // @ts-ignore engine-tsd
                            scrollbarOptions.pivot = new pc__namespace.Vec2(1, 1);
                            // @ts-ignore engine-tsd
                            scrollbarOptions.margin = new pc__namespace.Vec4(-scrollbarSize, scrollbarSize, 0, 0);
                        }
                        scrollbar.addComponent('element', scrollbarOptions);
                        scrollbar.addComponent('scrollbar', {
                            orientation: horizontal ? pc__namespace.ORIENTATION_HORIZONTAL : pc__namespace.ORIENTATION_VERTICAL,
                            value: 0,
                            handleSize: 0.5,
                            handleEntity: handle
                        });
                        return scrollbar;
                    }
                    // Create some text content
                    var text = new pc__namespace.Entity("Text");
                    text.addComponent("element", {
                        alignment: new pc__namespace.Vec2(0, 0),
                        anchor: new pc__namespace.Vec4(0, 1, 0, 1),
                        autoHeight: true,
                        autoWidth: false,
                        fontAsset: assets.font.id,
                        fontSize: 32,
                        lineHeight: 36,
                        pivot: new pc__namespace.Vec2(0, 1),
                        text: "This is a scroll view control. You can scroll the content by dragging the vertical " +
                            "or horizontal scroll bars, by dragging the content itself, by using the mouse wheel, or " +
                            "by using a trackpad. Notice the elastic bounce if you drag the content beyond the " +
                            "limits of the scroll view.",
                        type: pc__namespace.ELEMENTTYPE_TEXT,
                        width: 600,
                        wrapLines: true
                    });
                    // Group to hold the content inside the scroll view's viewport
                    var content = new pc__namespace.Entity('Content');
                    content.addChild(text);
                    content.addComponent('element', {
                        anchor: new pc__namespace.Vec4(0, 1, 0, 1),
                        height: 400,
                        pivot: new pc__namespace.Vec2(0, 1),
                        type: pc__namespace.ELEMENTTYPE_GROUP,
                        useInput: true,
                        width: 600
                    });
                    // Scroll view viewport
                    var viewport = new pc__namespace.Entity('Viewport');
                    viewport.addChild(content);
                    viewport.addComponent('element', {
                        anchor: new pc__namespace.Vec4(0, 0, 1, 1),
                        color: new pc__namespace.Color(0.2, 0.2, 0.2),
                        margin: new pc__namespace.Vec4(0, 20, 20, 0),
                        mask: true,
                        opacity: 1,
                        pivot: new pc__namespace.Vec2(0, 1),
                        rect: new pc__namespace.Vec4(0, 0, 1, 1),
                        type: pc__namespace.ELEMENTTYPE_IMAGE,
                        useInput: false
                    });
                    var horizontalScrollbar = createScrollbar(true);
                    var verticalScrollbar = createScrollbar(false);
                    // Create a scroll view
                    var scrollview = new pc__namespace.Entity('ScrollView');
                    scrollview.addChild(viewport);
                    scrollview.addChild(horizontalScrollbar);
                    scrollview.addChild(verticalScrollbar);
                    // You must add the scrollview entity to the hierarchy BEFORE adding the scrollview component
                    screen.addChild(scrollview);
                    scrollview.addComponent('element', {
                        anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                        height: 200,
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        type: pc__namespace.ELEMENTTYPE_GROUP,
                        useInput: false,
                        width: 400
                    });
                    scrollview.addComponent('scrollview', {
                        bounceAmount: 0.1,
                        contentEntity: content,
                        friction: 0.05,
                        useMouseWheel: true,
                        mouseWheelSensitivity: pc__namespace.Vec2.ONE,
                        horizontal: true,
                        horizontalScrollbarEntity: horizontalScrollbar,
                        horizontalScrollbarVisibility: pc__namespace.SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED,
                        scrollMode: pc__namespace.SCROLL_MODE_BOUNCE,
                        vertical: true,
                        verticalScrollbarEntity: verticalScrollbar,
                        verticalScrollbarVisibility: pc__namespace.SCROLLBAR_VISIBILITY_SHOW_WHEN_REQUIRED,
                        viewportEntity: viewport
                    });
                });
            });
        };
        ScrollViewExample.CATEGORY = 'User Interface';
        ScrollViewExample.NAME = 'Scroll View';
        ScrollViewExample.WEBGPU_ENABLED = true;
        return ScrollViewExample;
    }());

    var TextAutoFontSizeExample = /** @class */ (function () {
        function TextAutoFontSizeExample() {
        }
        TextAutoFontSizeExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem,
                    // @ts-ignore
                    pc__namespace.LayoutGroupComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScrollViewComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScrollbarComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // Create a container entity with an image component
                    var autoFontSizeContainer = new pc__namespace.Entity();
                    autoFontSizeContainer.addComponent("element", {
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                        width: 220,
                        height: 50,
                        color: new pc__namespace.Color(60 / 255, 60 / 255, 60 / 255),
                        type: pc__namespace.ELEMENTTYPE_IMAGE
                    });
                    // Create a text element with auto font size, and place it inside the container
                    var autoFontSizeText = new pc__namespace.Entity();
                    autoFontSizeText.addComponent("element", {
                        // place the text taking the entire parent space
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0, 0, 1, 1),
                        margin: new pc__namespace.Vec4(0, 0, 0, 0),
                        fontAsset: assets.font.id,
                        autoWidth: false,
                        autoHeight: false,
                        autoFitWidth: true,
                        autoFitHeight: true,
                        minFontSize: 10,
                        maxFontSize: 100,
                        text: "Auto font size!",
                        type: pc__namespace.ELEMENTTYPE_TEXT
                    });
                    screen.addChild(autoFontSizeContainer);
                    autoFontSizeContainer.addChild(autoFontSizeText);
                    // update the container's size to showcase the auto-sizing feature
                    var time = 0;
                    app.on('update', function (dt) {
                        time += dt;
                        autoFontSizeContainer.element.width = 280 + (Math.sin(time) * 80);
                        autoFontSizeContainer.element.height = 60 + (Math.sin(time * 0.5) * 50);
                    });
                });
            });
        };
        TextAutoFontSizeExample.CATEGORY = 'User Interface';
        TextAutoFontSizeExample.NAME = 'Text Auto Font Size';
        TextAutoFontSizeExample.WEBGPU_ENABLED = true;
        return TextAutoFontSizeExample;
    }());

    var TextEmojisExample = /** @class */ (function () {
        function TextEmojisExample() {
        }
        TextEmojisExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/arial.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem,
                    // @ts-ignore
                    pc__namespace.LayoutGroupComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScrollViewComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScrollbarComponentSystem,
                    // @ts-ignore
                    pc__namespace.LayoutChildComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // some sample text
                    var firstLineText = "PlayCanvas supports Emojis via CanvasFont!";
                    var flagsText = "Flags: 🇺🇸🇩🇪🇮🇪🇮🇹🏴‍☠️🇨🇦";
                    var complexText = "Complex emoji: 👨🏿3️⃣👁️‍🗨️";
                    // Create a canvas font asset
                    var size = 64;
                    var elSize = 32;
                    var canvasFont = new pc__namespace.CanvasFont(app, {
                        color: new pc__namespace.Color(1, 1, 1),
                        fontName: "Arial",
                        fontSize: size,
                        width: 256,
                        height: 256
                    });
                    // The first texture update needs to be `createTextures()`. Follow-up calls need to be `updateTextures()`.
                    canvasFont.createTextures(firstLineText);
                    canvasFont.updateTextures(flagsText);
                    canvasFont.updateTextures(complexText);
                    // Create the text entities
                    function createText(y, text) {
                        var canvasElementEntity = new pc__namespace.Entity();
                        canvasElementEntity.setLocalPosition(0, y, 0);
                        canvasElementEntity.addComponent("element", {
                            pivot: new pc__namespace.Vec2(0.5, 0.5),
                            anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                            fontSize: elSize,
                            text: text,
                            type: pc__namespace.ELEMENTTYPE_TEXT
                        });
                        canvasElementEntity.element.font = canvasFont;
                        screen.addChild(canvasElementEntity);
                    }
                    createText(225, firstLineText);
                    createText(150, flagsText);
                    createText(100, complexText);
                    // Canvas Fonts Debug - you shouldn't do this in your actual project
                    var debugText = new pc__namespace.Entity();
                    debugText.setLocalPosition(0, -50, 0);
                    debugText.addComponent("element", {
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                        fontAsset: assets.font.id,
                        fontSize: elSize,
                        text: "The following are the CanvasFont's Texture Atlases,\ncontaining all the rendered characters:",
                        type: pc__namespace.ELEMENTTYPE_TEXT
                    });
                    screen.addChild(debugText);
                    // Create Layout Group Entity
                    var group = new pc__namespace.Entity();
                    group.setLocalPosition(0, -150, 0);
                    group.addComponent("element", {
                        // a Layout Group needs a 'group' element component
                        type: pc__namespace.ELEMENTTYPE_GROUP,
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        pivot: [0.5, 0.5],
                        // the element's width and height dictate the group's bounds
                        width: 300,
                        height: 100
                    });
                    group.addComponent("layoutgroup", {
                        orientation: pc__namespace.ORIENTATION_HORIZONTAL,
                        // fit_both for width and height, making all child elements take the entire space
                        widthFitting: pc__namespace.FITTING_BOTH,
                        heightFitting: pc__namespace.FITTING_BOTH,
                        // wrap children
                        wrap: true
                    });
                    screen.addChild(group);
                    // create 1 child per texture
                    for (var i = 0; i < canvasFont.textures.length; i++) {
                        var texture = canvasFont.textures[i];
                        // create a random-colored panel
                        var child = new pc__namespace.Entity();
                        child.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            pivot: [0.5, 0.5],
                            texture: texture,
                            type: pc__namespace.ELEMENTTYPE_IMAGE
                        });
                        child.addComponent("layoutchild", {
                            excludeFromLayout: false
                        });
                        group.addChild(child);
                    }
                });
            });
        };
        TextEmojisExample.CATEGORY = 'User Interface';
        TextEmojisExample.NAME = 'Text Emojis';
        return TextEmojisExample;
    }());

    var TextLocalizationExample = /** @class */ (function () {
        function TextLocalizationExample() {
        }
        TextLocalizationExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    app.i18n.addData({
                        header: {
                            version: 1
                        },
                        data: [{
                                info: {
                                    locale: 'en-US'
                                },
                                messages: {
                                    "HELLO": "Hi"
                                }
                            }, {
                                info: {
                                    locale: 'fr-FR'
                                },
                                messages: {
                                    "HELLO": "Salut"
                                }
                            }, {
                                info: {
                                    locale: 'es-ES'
                                },
                                messages: {
                                    "HELLO": "Hola"
                                }
                            }, {
                                info: {
                                    locale: 'pt-BR'
                                },
                                messages: {
                                    "HELLO": "Oi!"
                                }
                            }]
                    });
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // Create a basic text element
                    var text = new pc__namespace.Entity();
                    text.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        autoWidth: false,
                        fontAsset: assets.font.id,
                        fontSize: 128,
                        pivot: [0.5, 0.5],
                        key: "HELLO",
                        type: pc__namespace.ELEMENTTYPE_TEXT,
                        width: 640
                    });
                    screen.addChild(text);
                    function createButton(labelText, x, y) {
                        // Create a simple button
                        var button = new pc__namespace.Entity();
                        button.addComponent("button", {
                            imageEntity: button
                        });
                        button.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            height: 40,
                            pivot: [0.5, 0.5],
                            type: pc__namespace.ELEMENTTYPE_IMAGE,
                            width: 128,
                            useInput: true
                        });
                        // Create a label for the button
                        var label = new pc__namespace.Entity();
                        label.addComponent("element", {
                            anchor: [0.5, 0.5, 0.5, 0.5],
                            color: new pc__namespace.Color(0, 0, 0),
                            fontAsset: assets.font.id,
                            fontSize: 32,
                            height: 64,
                            pivot: [0.5, 0.5],
                            text: labelText,
                            type: pc__namespace.ELEMENTTYPE_TEXT,
                            width: 128,
                            wrapLines: true
                        });
                        button.addChild(label);
                        // Change the locale to the button text
                        button.button.on('click', function () {
                            app.i18n.locale = labelText;
                        });
                        button.setLocalPosition(x, y, 0);
                        return button;
                    }
                    screen.addChild(createButton("en-US", -225, -100));
                    screen.addChild(createButton("fr-FR", -75, -100));
                    screen.addChild(createButton("es-ES", 75, -100));
                    screen.addChild(createButton("pt-BR", 225, -100));
                });
            });
        };
        TextLocalizationExample.CATEGORY = 'User Interface';
        TextLocalizationExample.NAME = 'Text Localization';
        TextLocalizationExample.WEBGPU_ENABLED = true;
        return TextLocalizationExample;
    }());

    var TextTypewriterExample = /** @class */ (function () {
        function TextTypewriterExample() {
        }
        TextTypewriterExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // Create a text element that wraps text over several lines
                    var loremIpsum = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
                    var text = new pc__namespace.Entity();
                    text.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        autoWidth: false,
                        fontAsset: assets.font.id,
                        fontSize: 32,
                        pivot: [0.5, 0.5],
                        text: loremIpsum,
                        type: pc__namespace.ELEMENTTYPE_TEXT,
                        width: 512,
                        wrapLines: true
                    });
                    screen.addChild(text);
                    // Start with no text printed
                    text.element.rangeStart = 0;
                    text.element.rangeEnd = 0;
                    // Render a new character every 75ms
                    setInterval(function () {
                        text.element.rangeEnd += 1;
                        if (text.element.rangeEnd >= loremIpsum.length) {
                            text.element.rangeEnd = 0;
                        }
                    }, 75);
                });
            });
        };
        TextTypewriterExample.CATEGORY = 'User Interface';
        TextTypewriterExample.NAME = 'Text Typewriter';
        TextTypewriterExample.WEBGPU_ENABLED = true;
        return TextTypewriterExample;
    }());

    var TextExample = /** @class */ (function () {
        function TextExample() {
        }
        TextExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem,
                    // @ts-ignore
                    pc__namespace.LayoutGroupComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScrollViewComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScrollbarComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    window.addEventListener("resize", function () {
                        app.resizeCanvas(canvas.width, canvas.height);
                    });
                    // Create a camera
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    app.root.addChild(camera);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        scaleBlend: 0.5,
                        scaleMode: pc__namespace.SCALEMODE_BLEND,
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    // Basic Text
                    var textBasic = new pc__namespace.Entity();
                    textBasic.setLocalPosition(0, 200, 0);
                    textBasic.addComponent("element", {
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                        fontAsset: assets.font.id,
                        fontSize: 42,
                        text: "Basic Text",
                        type: pc__namespace.ELEMENTTYPE_TEXT
                    });
                    screen.addChild(textBasic);
                    // Markup Text with wrap
                    var textMarkup = new pc__namespace.Entity();
                    textMarkup.setLocalPosition(0, 50, 0);
                    textMarkup.addComponent("element", {
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                        fontAsset: assets.font.id,
                        fontSize: 32,
                        text: 'There are seven colors in the rainbow: [color="#ff0000"]red[/color], [color="#ffa500"]orange[/color], [color="#ffff00"]yellow[/color], [color="#00ff00"]green[/color], [color="#0000ff"]blue[/color], [color="#4b0082"]indigo[/color] and [color="#7f00ff"]violet[/color].',
                        width: 500,
                        height: 100,
                        autoWidth: false,
                        autoHeight: false,
                        wrapLines: true,
                        enableMarkup: true,
                        type: pc__namespace.ELEMENTTYPE_TEXT
                    });
                    screen.addChild(textMarkup);
                    // Text with outline
                    var textOutline = new pc__namespace.Entity();
                    textOutline.setLocalPosition(0, -100, 0);
                    textOutline.addComponent("element", {
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                        fontAsset: assets.font.id,
                        fontSize: 62,
                        text: "Outline",
                        color: new pc__namespace.Color(0, 0, 0),
                        outlineColor: new pc__namespace.Color(1, 1, 1),
                        outlineThickness: 0.75,
                        type: pc__namespace.ELEMENTTYPE_TEXT
                    });
                    screen.addChild(textOutline);
                    // Text with drop shadow
                    var textDropShadow = new pc__namespace.Entity();
                    textDropShadow.setLocalPosition(0, -200, 0);
                    textDropShadow.addComponent("element", {
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                        fontAsset: assets.font.id,
                        fontSize: 62,
                        text: "Drop Shadow",
                        shadowColor: new pc__namespace.Color(1, 0, 0),
                        shadowOffset: new pc__namespace.Vec2(0.25, -0.25),
                        type: pc__namespace.ELEMENTTYPE_TEXT
                    });
                    screen.addChild(textDropShadow);
                });
            });
        };
        TextExample.CATEGORY = 'User Interface';
        TextExample.NAME = 'Text';
        TextExample.WEBGPU_ENABLED = true;
        return TextExample;
    }());

    var WorldToScreenExample = /** @class */ (function () {
        function WorldToScreenExample() {
        }
        WorldToScreenExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                "checkboard": new pc__namespace.Asset("checkboard", "texture", { url: "/static/assets/textures/checkboard.png" }),
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Create an Entity with a camera component
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    camera.rotateLocal(-30, 0, 0);
                    camera.translateLocal(0, 0, 7);
                    app.root.addChild(camera);
                    // Create an Entity for the ground
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuse = pc__namespace.Color.WHITE;
                    material.diffuseMap = assets.checkboard.resource;
                    material.diffuseMapTiling = new pc__namespace.Vec2(50, 50);
                    material.update();
                    var ground = new pc__namespace.Entity();
                    ground.addComponent("render", {
                        type: "box",
                        material: material
                    });
                    ground.setLocalScale(50, 1, 50);
                    ground.setLocalPosition(0, -0.5, 0);
                    app.root.addChild(ground);
                    // Create an entity with a light component
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "directional",
                        color: new pc__namespace.Color(1, 1, 1),
                        castShadows: true,
                        intensity: 1,
                        shadowBias: 0.2,
                        shadowDistance: 16,
                        normalOffsetBias: 0.05,
                        shadowResolution: 2048
                    });
                    light.setLocalEulerAngles(45, 30, 0);
                    app.root.addChild(light);
                    // Create a 2D screen
                    var screen = new pc__namespace.Entity();
                    screen.setLocalScale(0.01, 0.01, 0.01);
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        screenSpace: true
                    });
                    app.root.addChild(screen);
                    /**
                     * Converts a coordinate in world space into a screen's space.
                     *
                     * @param {pc.Vec3} worldPosition - the Vec3 representing the world-space coordinate.
                     * @param {pc.CameraComponent} camera - the Camera.
                     * @param {pc.ScreenComponent} screen - the Screen
                     * @returns {pc.Vec3} a Vec3 of the input worldPosition relative to the camera and screen. The Z coordinate represents the depth,
                     * and negative numbers signal that the worldPosition is behind the camera.
                     */
                    function worldToScreenSpace(worldPosition, camera, screen) {
                        var screenPos = camera.worldToScreen(worldPosition);
                        // take pixel ratio into account
                        var pixelRatio = app.graphicsDevice.maxPixelRatio;
                        screenPos.x *= pixelRatio;
                        screenPos.y *= pixelRatio;
                        // account for screen scaling
                        var scale = screen.scale;
                        // invert the y position
                        screenPos.y = screen.resolution.y - screenPos.y;
                        // put that into a Vec3
                        return new pc__namespace.Vec3(screenPos.x / scale, screenPos.y / scale, screenPos.z / scale);
                    }
                    function createPlayer(id, startingAngle, speed, radius) {
                        // Create a capsule entity to represent a player in the 3d world
                        var entity = new pc__namespace.Entity();
                        entity.setLocalScale(new pc__namespace.Vec3(0.5, 0.5, 0.5));
                        entity.addComponent("render", {
                            type: "capsule"
                        });
                        app.root.addChild(entity);
                        // update the player position every frame with some mock logic
                        // normally, this would be taking inputs, running physics simulation, etc
                        var angle = startingAngle;
                        var height = 0.5;
                        app.on("update", function (dt) {
                            angle += dt * speed;
                            if (angle > 360) {
                                angle -= 360;
                            }
                            entity.setLocalPosition(radius * Math.sin(angle * pc__namespace.math.DEG_TO_RAD), height, radius * Math.cos(angle * pc__namespace.math.DEG_TO_RAD));
                            entity.setLocalEulerAngles(0, angle + 90, 0);
                        });
                        // Create a text element that will hover the player's head
                        var playerInfo = new pc__namespace.Entity();
                        playerInfo.addComponent("element", {
                            pivot: new pc__namespace.Vec2(0.5, 0),
                            anchor: new pc__namespace.Vec4(0, 0, 0, 0),
                            width: 150,
                            height: 50,
                            opacity: 0.05,
                            type: pc__namespace.ELEMENTTYPE_IMAGE
                        });
                        screen.addChild(playerInfo);
                        var name = new pc__namespace.Entity();
                        name.addComponent("element", {
                            pivot: new pc__namespace.Vec2(0.5, 0.5),
                            anchor: new pc__namespace.Vec4(0, 0.4, 1, 1),
                            margin: new pc__namespace.Vec4(0, 0, 0, 0),
                            fontAsset: assets.font.id,
                            fontSize: 20,
                            text: "Player ".concat(id),
                            useInput: true,
                            type: pc__namespace.ELEMENTTYPE_TEXT
                        });
                        name.addComponent("button", {
                            imageEntity: name
                        });
                        name.button.on('click', function () {
                            var color = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                            name.element.color = color;
                            entity.render.material.setParameter("material_diffuse", [color.r, color.g, color.b]);
                        });
                        playerInfo.addChild(name);
                        var healthBar = new pc__namespace.Entity();
                        healthBar.addComponent("element", {
                            pivot: new pc__namespace.Vec2(0.5, 0),
                            anchor: new pc__namespace.Vec4(0, 0, 1, 0.4),
                            margin: new pc__namespace.Vec4(0, 0, 0, 0),
                            color: new pc__namespace.Color(0.2, 0.6, 0.2, 1),
                            opacity: 1,
                            type: pc__namespace.ELEMENTTYPE_IMAGE
                        });
                        playerInfo.addChild(healthBar);
                        // update the player text's position to always hover the player
                        app.on("update", function () {
                            // get the desired world position
                            var worldPosition = entity.getPosition();
                            worldPosition.y += 0.6; // slightly above the player's head
                            // convert to screen position
                            var screenPosition = worldToScreenSpace(worldPosition, camera.camera, screen.screen);
                            if (screenPosition.z > 0) {
                                // if world position is in front of the camera, show it
                                playerInfo.enabled = true;
                                // set the UI position
                                playerInfo.setLocalPosition(screenPosition);
                            }
                            else {
                                // if world position is actually *behind* the camera, hide the UI
                                playerInfo.enabled = false;
                            }
                        });
                    }
                    createPlayer(1, 135, 30, 1.5);
                    createPlayer(2, 65, -18, 1);
                    createPlayer(3, 0, 15, 2.5);
                });
            });
        };
        WorldToScreenExample.CATEGORY = 'User Interface';
        WorldToScreenExample.NAME = 'World to Screen';
        WorldToScreenExample.WEBGPU_ENABLED = true;
        return WorldToScreenExample;
    }());

    var WorldUiExample = /** @class */ (function () {
        function WorldUiExample() {
        }
        WorldUiExample.prototype.example = function (canvas, deviceType) {
            var assets = {
                "checkboard": new pc__namespace.Asset("checkboard", "texture", { url: "/static/assets/textures/checkboard.png" }),
                'font': new pc__namespace.Asset('font', 'font', { url: '/static/assets/fonts/courier.json' }),
                'script': new pc__namespace.Asset('script', 'script', { url: '/static/scripts/camera/orbit-camera.js' })
            };
            var gfxOptions = {
                deviceTypes: [deviceType],
                glslangUrl: '/static/lib/glslang/glslang.js',
                twgslUrl: '/static/lib/twgsl/twgsl.js'
            };
            pc__namespace.createGraphicsDevice(canvas, gfxOptions).then(function (device) {
                var createOptions = new pc__namespace.AppOptions();
                createOptions.graphicsDevice = device;
                createOptions.mouse = new pc__namespace.Mouse(document.body);
                createOptions.touch = new pc__namespace.TouchDevice(document.body);
                createOptions.elementInput = new pc__namespace.ElementInput(canvas);
                createOptions.componentSystems = [
                    // @ts-ignore
                    pc__namespace.RenderComponentSystem,
                    // @ts-ignore
                    pc__namespace.CameraComponentSystem,
                    // @ts-ignore
                    pc__namespace.LightComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScreenComponentSystem,
                    // @ts-ignore
                    pc__namespace.ButtonComponentSystem,
                    // @ts-ignore
                    pc__namespace.ElementComponentSystem,
                    // @ts-ignore
                    pc__namespace.ScriptComponentSystem
                ];
                createOptions.resourceHandlers = [
                    // @ts-ignore
                    pc__namespace.TextureHandler,
                    // @ts-ignore
                    pc__namespace.FontHandler,
                    // @ts-ignore
                    pc__namespace.ScriptHandler
                ];
                var app = new pc__namespace.AppBase(canvas);
                app.init(createOptions);
                // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
                assetListLoader.load(function () {
                    app.start();
                    // Create an Entity with a camera component and simple orbiter script
                    var camera = new pc__namespace.Entity();
                    camera.addComponent("camera", {
                        clearColor: new pc__namespace.Color(30 / 255, 30 / 255, 30 / 255)
                    });
                    camera.rotateLocal(-30, 0, 0);
                    camera.translateLocal(0, 0, 7);
                    camera.addComponent("script");
                    camera.script.create("orbitCamera", {
                        attributes: {
                            inertiaFactor: 0.2 // Override default of 0 (no inertia)
                        }
                    });
                    camera.script.create("orbitCameraInputMouse");
                    camera.script.create("orbitCameraInputTouch");
                    app.root.addChild(camera);
                    // Create an Entity for the ground
                    var material = new pc__namespace.StandardMaterial();
                    material.diffuse = pc__namespace.Color.WHITE;
                    material.diffuseMap = assets.checkboard.resource;
                    material.diffuseMapTiling = new pc__namespace.Vec2(50, 50);
                    material.update();
                    var ground = new pc__namespace.Entity();
                    ground.addComponent("render", {
                        type: "box",
                        material: material
                    });
                    ground.setLocalScale(50, 1, 50);
                    ground.setLocalPosition(0, -0.5, 0);
                    app.root.addChild(ground);
                    // Create an entity with a light component
                    var light = new pc__namespace.Entity();
                    light.addComponent("light", {
                        type: "directional",
                        color: new pc__namespace.Color(1, 1, 1),
                        castShadows: true,
                        intensity: 1,
                        shadowBias: 0.2,
                        shadowDistance: 16,
                        normalOffsetBias: 0.05,
                        shadowResolution: 2048
                    });
                    light.setLocalEulerAngles(45, 30, 0);
                    app.root.addChild(light);
                    // Create a 3D world screen, which is basically a `screen` with `screenSpace` set to false
                    var screen = new pc__namespace.Entity();
                    screen.setLocalScale(0.01, 0.01, 0.01);
                    screen.setPosition(0, 0.01, 0); // place UI slightly above the ground
                    screen.setLocalRotation(new pc__namespace.Quat().setFromEulerAngles(-90, 0, 0));
                    screen.addComponent("screen", {
                        referenceResolution: new pc__namespace.Vec2(1280, 720),
                        screenSpace: false
                    });
                    app.root.addChild(screen);
                    // Text
                    var text = new pc__namespace.Entity();
                    text.setLocalPosition(0, 25, 0);
                    text.addComponent("element", {
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0.5, 0.5, 0.5, 0.5),
                        fontAsset: assets.font.id,
                        fontSize: 18,
                        text: "this is a UI screen placed in the 3D world",
                        width: 200,
                        height: 100,
                        autoWidth: false,
                        autoHeight: false,
                        wrapLines: true,
                        enableMarkup: true,
                        type: pc__namespace.ELEMENTTYPE_TEXT
                    });
                    screen.addChild(text);
                    // Button
                    var button = new pc__namespace.Entity();
                    button.setLocalPosition(0, -25, 0);
                    button.addComponent("button", {
                        imageEntity: button
                    });
                    button.addComponent("element", {
                        anchor: [0.5, 0.5, 0.5, 0.5],
                        width: 100,
                        height: 25,
                        pivot: [0.5, 0.5],
                        type: pc__namespace.ELEMENTTYPE_IMAGE,
                        useInput: true
                    });
                    screen.addChild(button);
                    // Create a label for the button
                    var buttonText = new pc__namespace.Entity();
                    buttonText.addComponent("element", {
                        pivot: new pc__namespace.Vec2(0.5, 0.5),
                        anchor: new pc__namespace.Vec4(0, 0, 1, 1),
                        margin: new pc__namespace.Vec4(0, 0, 0, 0),
                        color: new pc__namespace.Color(0, 0, 0),
                        fontAsset: assets.font.id,
                        fontSize: 12,
                        text: "and this is a button",
                        type: pc__namespace.ELEMENTTYPE_TEXT,
                        wrapLines: true
                    });
                    button.addChild(buttonText);
                    // Change the background color every time the button is clicked
                    button.button.on('click', function () {
                        camera.camera.clearColor = new pc__namespace.Color(Math.random(), Math.random(), Math.random());
                    });
                });
            });
        };
        WorldUiExample.CATEGORY = 'User Interface';
        WorldUiExample.NAME = 'World UI';
        WorldUiExample.WEBGPU_ENABLED = true;
        return WorldUiExample;
    }());

    var index$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ButtonBasicExample: ButtonBasicExample,
        ButtonSpriteExample: ButtonSpriteExample,
        CustomShaderExample: CustomShaderExample,
        LayoutGroupExample: LayoutGroupExample,
        ParticleSystemExample: ParticleSystemExample,
        ScrollViewExample: ScrollViewExample,
        TextAutoFontSizeExample: TextAutoFontSizeExample,
        TextEmojisExample: TextEmojisExample,
        TextLocalizationExample: TextLocalizationExample,
        TextTypewriterExample: TextTypewriterExample,
        TextExample: TextExample,
        WorldToScreenExample: WorldToScreenExample,
        WorldUiExample: WorldUiExample
    });

    var ArBasicExample = /** @class */ (function () {
        function ArBasicExample() {
        }
        ArBasicExample.prototype.example = function (canvas, deviceType) {
            var message = function (msg) {
                var el = document.querySelector('.message');
                if (!el) {
                    el = document.createElement('div');
                    el.classList.add('message');
                    document.body.append(el);
                }
                el.textContent = msg;
            };
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(canvas),
                touch: new pc__namespace.TouchDevice(canvas),
                keyboard: new pc__namespace.Keyboard(window),
                graphicsDeviceOptions: { alpha: true }
            });
            // use device pixel ratio
            app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
            app.start();
            // create camera
            var c = new pc__namespace.Entity();
            c.addComponent('camera', {
                clearColor: new pc__namespace.Color(0, 0, 0, 0),
                farClip: 10000
            });
            app.root.addChild(c);
            var l = new pc__namespace.Entity();
            l.addComponent("light", {
                type: "spot",
                range: 30
            });
            l.translate(0, 10, 0);
            app.root.addChild(l);
            var createCube = function (x, y, z) {
                var cube = new pc__namespace.Entity();
                cube.addComponent("render", {
                    type: "box"
                });
                cube.setLocalScale(0.5, 0.5, 0.5);
                cube.translate(x * 0.5, y, z * 0.5);
                app.root.addChild(cube);
            };
            // create a grid of cubes
            var SIZE = 4;
            for (var x = 0; x < SIZE; x++) {
                for (var y = 0; y < SIZE; y++) {
                    createCube(2 * x - SIZE, 0.25, 2 * y - SIZE);
                }
            }
            if (app.xr.supported) {
                var activate_1 = function () {
                    if (app.xr.isAvailable(pc__namespace.XRTYPE_AR)) {
                        c.camera.startXr(pc__namespace.XRTYPE_AR, pc__namespace.XRSPACE_LOCALFLOOR, {
                            callback: function (err) {
                                if (err)
                                    message("WebXR Immersive AR failed to start: " + err.message);
                            }
                        });
                    }
                    else {
                        message("Immersive AR is not available");
                    }
                };
                app.mouse.on("mousedown", function () {
                    if (!app.xr.active)
                        activate_1();
                });
                if (app.touch) {
                    app.touch.on("touchend", function (evt) {
                        if (!app.xr.active) {
                            // if not in VR, activate
                            activate_1();
                        }
                        else {
                            // otherwise reset camera
                            c.camera.endXr();
                        }
                        evt.event.preventDefault();
                        evt.event.stopPropagation();
                    });
                }
                // end session by keyboard ESC
                app.keyboard.on('keydown', function (evt) {
                    if (evt.key === pc__namespace.KEY_ESCAPE && app.xr.active) {
                        app.xr.end();
                    }
                });
                app.xr.on('start', function () {
                    message("Immersive AR session has started");
                });
                app.xr.on('end', function () {
                    message("Immersive AR session has ended");
                });
                app.xr.on('available:' + pc__namespace.XRTYPE_AR, function (available) {
                    message("Immersive AR is " + (available ? 'available' : 'unavailable'));
                });
                if (!app.xr.isAvailable(pc__namespace.XRTYPE_AR)) {
                    message("Immersive AR is not available");
                }
            }
            else {
                message("WebXR is not supported");
            }
        };
        ArBasicExample.CATEGORY = 'XR';
        ArBasicExample.NAME = 'AR Basic';
        return ArBasicExample;
    }());

    var ArHitTestExample = /** @class */ (function () {
        function ArHitTestExample() {
        }
        ArHitTestExample.prototype.example = function (canvas, deviceType) {
            var message = function (msg) {
                var el = document.querySelector('.message');
                if (!el) {
                    el = document.createElement('div');
                    el.classList.add('message');
                    document.body.append(el);
                }
                el.textContent = msg;
            };
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(canvas),
                touch: new pc__namespace.TouchDevice(canvas),
                keyboard: new pc__namespace.Keyboard(window),
                graphicsDeviceOptions: { alpha: true }
            });
            app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
            window.addEventListener("resize", function () {
                app.resizeCanvas(canvas.width, canvas.height);
            });
            // use device pixel ratio
            app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
            app.start();
            // create camera
            var c = new pc__namespace.Entity();
            c.addComponent('camera', {
                clearColor: new pc__namespace.Color(0, 0, 0, 0),
                farClip: 10000
            });
            app.root.addChild(c);
            var l = new pc__namespace.Entity();
            l.addComponent("light", {
                type: "spot",
                range: 30
            });
            l.translate(0, 10, 0);
            app.root.addChild(l);
            var target = new pc__namespace.Entity();
            target.addComponent("render", {
                type: "cylinder"
            });
            target.setLocalScale(0.5, 0.01, 0.5);
            app.root.addChild(target);
            if (app.xr.supported) {
                var activate_1 = function () {
                    if (app.xr.isAvailable(pc__namespace.XRTYPE_AR)) {
                        c.camera.startXr(pc__namespace.XRTYPE_AR, pc__namespace.XRSPACE_LOCALFLOOR, {
                            callback: function (err) {
                                if (err)
                                    message("WebXR Immersive AR failed to start: " + err.message);
                            }
                        });
                    }
                    else {
                        message("Immersive AR is not available");
                    }
                };
                app.mouse.on("mousedown", function () {
                    if (!app.xr.active)
                        activate_1();
                });
                if (app.touch) {
                    app.touch.on("touchend", function (evt) {
                        if (!app.xr.active) {
                            // if not in VR, activate
                            activate_1();
                        }
                        else {
                            // otherwise reset camera
                            c.camera.endXr();
                        }
                        evt.event.preventDefault();
                        evt.event.stopPropagation();
                    });
                }
                // end session by keyboard ESC
                app.keyboard.on('keydown', function (evt) {
                    if (evt.key === pc__namespace.KEY_ESCAPE && app.xr.active) {
                        app.xr.end();
                    }
                });
                app.xr.on('start', function () {
                    message("Immersive AR session has started");
                    if (!app.xr.hitTest.supported)
                        return;
                    app.xr.hitTest.start({
                        entityTypes: [pc__namespace.XRTRACKABLE_POINT, pc__namespace.XRTRACKABLE_PLANE],
                        callback: function (err, hitTestSource) {
                            if (err) {
                                message("Failed to start AR hit test");
                                return;
                            }
                            hitTestSource.on('result', function (position, rotation) {
                                target.setPosition(position);
                                target.setRotation(rotation);
                            });
                        }
                    });
                });
                app.xr.on('end', function () {
                    message("Immersive AR session has ended");
                });
                app.xr.on('available:' + pc__namespace.XRTYPE_AR, function (available) {
                    if (available) {
                        if (app.xr.hitTest.supported) {
                            message("Touch screen to start AR session and look at the floor or walls");
                        }
                        else {
                            message("AR Hit Test is not supported");
                        }
                    }
                    else {
                        message("Immersive AR is unavailable");
                    }
                });
                if (!app.xr.isAvailable(pc__namespace.XRTYPE_AR)) {
                    message("Immersive AR is not available");
                }
                else if (!app.xr.hitTest.supported) {
                    message("AR Hit Test is not supported");
                }
                else {
                    message("Touch screen to start AR session and look at the floor or walls");
                }
            }
            else {
                message("WebXR is not supported");
            }
        };
        ArHitTestExample.CATEGORY = 'XR';
        ArHitTestExample.NAME = 'AR Hit Test';
        return ArHitTestExample;
    }());

    var VrBasicExample = /** @class */ (function () {
        function VrBasicExample() {
        }
        VrBasicExample.prototype.example = function (canvas, deviceType) {
            var message = function (msg) {
                var el = document.querySelector('.message');
                if (!el) {
                    el = document.createElement('div');
                    el.classList.add('message');
                    document.body.append(el);
                }
                el.textContent = msg;
            };
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(canvas),
                touch: new pc__namespace.TouchDevice(canvas),
                keyboard: new pc__namespace.Keyboard(window)
            });
            app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
            window.addEventListener("resize", function () {
                app.resizeCanvas(canvas.width, canvas.height);
            });
            // use device pixel ratio
            app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
            app.start();
            // create camera
            var c = new pc__namespace.Entity();
            c.addComponent('camera', {
                clearColor: new pc__namespace.Color(44 / 255, 62 / 255, 80 / 255),
                farClip: 10000
            });
            app.root.addChild(c);
            var l = new pc__namespace.Entity();
            l.addComponent("light", {
                type: "spot",
                range: 30
            });
            l.translate(0, 10, 0);
            app.root.addChild(l);
            var createCube = function (x, y, z) {
                var cube = new pc__namespace.Entity();
                cube.addComponent("render", {
                    type: "box"
                });
                cube.setLocalScale(1, 1, 1);
                cube.translate(x, y, z);
                app.root.addChild(cube);
            };
            // create a grid of cubes
            var SIZE = 16;
            for (var x = 0; x < SIZE; x++) {
                for (var y = 0; y < SIZE; y++) {
                    createCube(2 * x - SIZE, -1.5, 2 * y - SIZE);
                }
            }
            if (app.xr.supported) {
                var activate_1 = function () {
                    if (app.xr.isAvailable(pc__namespace.XRTYPE_VR)) {
                        c.camera.startXr(pc__namespace.XRTYPE_VR, pc__namespace.XRSPACE_LOCAL, {
                            callback: function (err) {
                                if (err)
                                    message("WebXR Immersive VR failed to start: " + err.message);
                            }
                        });
                    }
                    else {
                        message("Immersive VR is not available");
                    }
                };
                app.mouse.on("mousedown", function () {
                    if (!app.xr.active)
                        activate_1();
                });
                if (app.touch) {
                    app.touch.on("touchend", function (evt) {
                        if (!app.xr.active) {
                            // if not in VR, activate
                            activate_1();
                        }
                        else {
                            // otherwise reset camera
                            c.camera.endXr();
                        }
                        evt.event.preventDefault();
                        evt.event.stopPropagation();
                    });
                }
                // end session by keyboard ESC
                app.keyboard.on('keydown', function (evt) {
                    if (evt.key === pc__namespace.KEY_ESCAPE && app.xr.active) {
                        app.xr.end();
                    }
                });
                app.xr.on('start', function () {
                    message("Immersive VR session has started");
                });
                app.xr.on('end', function () {
                    message("Immersive VR session has ended");
                });
                app.xr.on('available:' + pc__namespace.XRTYPE_VR, function (available) {
                    message("Immersive VR is " + (available ? 'available' : 'unavailable'));
                });
                if (!app.xr.isAvailable(pc__namespace.XRTYPE_VR)) {
                    message("Immersive VR is not available");
                }
            }
            else {
                message("WebXR is not supported");
            }
        };
        VrBasicExample.CATEGORY = 'XR';
        VrBasicExample.NAME = 'VR Basic';
        return VrBasicExample;
    }());

    var VrControllersExample = /** @class */ (function () {
        function VrControllersExample() {
        }
        VrControllersExample.prototype.example = function (canvas, deviceType) {
            var message = function (msg) {
                var el = document.querySelector('.message');
                if (!el) {
                    el = document.createElement('div');
                    el.classList.add('message');
                    document.body.append(el);
                }
                el.textContent = msg;
            };
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(canvas),
                touch: new pc__namespace.TouchDevice(canvas),
                keyboard: new pc__namespace.Keyboard(window)
            });
            var assets = {
                'glb': new pc__namespace.Asset('glb', 'container', { url: '/static/assets/models/vr-controller.glb' })
            };
            var assetListLoader = new pc__namespace.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(function () {
                app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
                app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
                window.addEventListener("resize", function () {
                    app.resizeCanvas(canvas.width, canvas.height);
                });
                // use device pixel ratio
                app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
                app.start();
                // create camera
                var c = new pc__namespace.Entity();
                c.addComponent('camera', {
                    clearColor: new pc__namespace.Color(44 / 255, 62 / 255, 80 / 255)
                });
                app.root.addChild(c);
                var l = new pc__namespace.Entity();
                l.addComponent("light", {
                    type: "directional",
                    castShadows: true,
                    shadowBias: 0.05,
                    normalOffsetBias: 0.05,
                    shadowDistance: 5
                });
                l.setEulerAngles(45, 135, 0);
                app.root.addChild(l);
                var createCube = function (x, y, z) {
                    var cube = new pc__namespace.Entity();
                    cube.addComponent("render", {
                        type: "box",
                        material: new pc__namespace.StandardMaterial()
                    });
                    cube.translate(x, y, z);
                    app.root.addChild(cube);
                };
                var controllers = [];
                // create controller model
                var createController = function (inputSource) {
                    var entity = new pc__namespace.Entity();
                    entity.addComponent('model', {
                        type: 'asset',
                        asset: assets.glb.resource.model,
                        castShadows: true
                    });
                    app.root.addChild(entity);
                    // @ts-ignore engine-tsd
                    entity.inputSource = inputSource;
                    controllers.push(entity);
                    // destroy input source related entity
                    // when input source is removed
                    inputSource.on('remove', function () {
                        controllers.splice(controllers.indexOf(entity), 1);
                        entity.destroy();
                    });
                };
                // create a grid of cubes
                var SIZE = 4;
                for (var x = 0; x <= SIZE; x++) {
                    for (var y = 0; y <= SIZE; y++) {
                        createCube(2 * x - SIZE, -1.5, 2 * y - SIZE);
                    }
                }
                if (app.xr.supported) {
                    var activate_1 = function () {
                        if (app.xr.isAvailable(pc__namespace.XRTYPE_VR)) {
                            c.camera.startXr(pc__namespace.XRTYPE_VR, pc__namespace.XRSPACE_LOCAL, {
                                callback: function (err) {
                                    if (err)
                                        message("Immersive VR failed to start: " + err.message);
                                }
                            });
                        }
                        else {
                            message("Immersive VR is not available");
                        }
                    };
                    app.mouse.on("mousedown", function () {
                        if (!app.xr.active)
                            activate_1();
                    });
                    if (app.touch) {
                        app.touch.on("touchend", function (evt) {
                            if (!app.xr.active) {
                                // if not in VR, activate
                                activate_1();
                            }
                            else {
                                // otherwise reset camera
                                c.camera.endXr();
                            }
                            evt.event.preventDefault();
                            evt.event.stopPropagation();
                        });
                    }
                    // end session by keyboard ESC
                    app.keyboard.on('keydown', function (evt) {
                        if (evt.key === pc__namespace.KEY_ESCAPE && app.xr.active) {
                            app.xr.end();
                        }
                    });
                    // when new input source added
                    app.xr.input.on('add', function (inputSource) {
                        message("Controller Added");
                        createController(inputSource);
                    });
                    message("Tap on screen to enter VR, and see controllers");
                    // update position and rotation for each controller
                    app.on('update', function () {
                        for (var i = 0; i < controllers.length; i++) {
                            var inputSource = controllers[i].inputSource;
                            if (inputSource.grip) {
                                // some controllers can be gripped
                                controllers[i].enabled = true;
                                controllers[i].setLocalPosition(inputSource.getLocalPosition());
                                controllers[i].setLocalRotation(inputSource.getLocalRotation());
                            }
                            else {
                                // some controllers cannot be gripped
                                controllers[i].enabled = false;
                            }
                        }
                    });
                }
                else {
                    message("WebXR is not supported");
                }
            });
        };
        VrControllersExample.CATEGORY = 'XR';
        VrControllersExample.NAME = 'VR Controllers';
        return VrControllersExample;
    }());

    var VrHandsExample = /** @class */ (function () {
        function VrHandsExample() {
        }
        VrHandsExample.prototype.example = function (canvas, deviceType) {
            var message = function (msg) {
                var el = document.querySelector('.message');
                if (!el) {
                    el = document.createElement('div');
                    el.classList.add('message');
                    document.body.append(el);
                }
                el.textContent = msg;
            };
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(canvas),
                touch: new pc__namespace.TouchDevice(canvas),
                keyboard: new pc__namespace.Keyboard(window)
            });
            app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
            window.addEventListener("resize", function () {
                app.resizeCanvas(canvas.width, canvas.height);
            });
            // use device pixel ratio
            app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
            app.scene.ambientLight = new pc__namespace.Color(0.1, 0.1, 0.1);
            app.start();
            // create camera
            var c = new pc__namespace.Entity();
            c.addComponent('camera', {
                clearColor: new pc__namespace.Color(44 / 255, 62 / 255, 80 / 255)
            });
            app.root.addChild(c);
            var l = new pc__namespace.Entity();
            l.addComponent("light", {
                type: "directional"
            });
            l.setEulerAngles(45, 135, 0);
            app.root.addChild(l);
            var createCube = function (x, y, z) {
                var cube = new pc__namespace.Entity();
                cube.addComponent("render", {
                    type: "box",
                    material: new pc__namespace.StandardMaterial()
                });
                cube.translate(x, y, z);
                app.root.addChild(cube);
            };
            var controllers = [];
            // create controller model
            var createController = function (inputSource) {
                var entity = new pc__namespace.Entity();
                if (inputSource.hand) {
                    // hand input
                    // @ts-ignore engine-tsd
                    entity.joints = [];
                    var material = new pc__namespace.StandardMaterial();
                    // create box for each hand joint
                    for (var i = 0; i < inputSource.hand.joints.length; i++) {
                        var joint = inputSource.hand.joints[i];
                        var jointEntity = new pc__namespace.Entity();
                        jointEntity.addComponent('model', {
                            type: 'box',
                            material: material
                        });
                        // @ts-ignore engine-tsd
                        jointEntity.joint = joint;
                        // @ts-ignore engine-tsd
                        entity.joints.push(jointEntity);
                        entity.addChild(jointEntity);
                    }
                    // when tracking lost, paint joints to red
                    inputSource.hand.on('trackinglost', function () {
                        // @ts-ignore engine-tsd
                        entity.joints[0].model.material.diffuse.set(1, 0, 0);
                        // @ts-ignore engine-tsd
                        entity.joints[0].model.material.update();
                    });
                    // when tracking recovered, paint joints to white
                    inputSource.hand.on('tracking', function () {
                        // @ts-ignore engine-tsd
                        entity.joints[0].model.material.diffuse.set(1, 1, 1);
                        // @ts-ignore engine-tsd
                        entity.joints[0].model.material.update();
                    });
                }
                else {
                    // other inputs
                    entity.addComponent('model', {
                        type: 'box',
                        castShadows: true
                    });
                    entity.setLocalScale(0.05, 0.05, 0.05);
                }
                app.root.addChild(entity);
                // @ts-ignore engine-tsd
                entity.inputSource = inputSource;
                controllers.push(entity);
                // destroy input source related entity
                // when input source is removed
                inputSource.on('remove', function () {
                    controllers.splice(controllers.indexOf(entity), 1);
                    entity.destroy();
                });
            };
            // create a grid of cubes
            var SIZE = 4;
            for (var x = 0; x <= SIZE; x++) {
                for (var y = 0; y <= SIZE; y++) {
                    createCube(2 * x - SIZE, -1.5, 2 * y - SIZE);
                }
            }
            if (app.xr.supported) {
                var activate_1 = function () {
                    if (app.xr.isAvailable(pc__namespace.XRTYPE_VR)) {
                        c.camera.startXr(pc__namespace.XRTYPE_VR, pc__namespace.XRSPACE_LOCAL, {
                            callback: function (err) {
                                if (err)
                                    message("Immersive VR failed to start: " + err.message);
                            }
                        });
                    }
                    else {
                        message("Immersive VR is not available");
                    }
                };
                app.mouse.on("mousedown", function () {
                    if (!app.xr.active)
                        activate_1();
                });
                if (app.touch) {
                    app.touch.on("touchend", function (evt) {
                        if (!app.xr.active) {
                            // if not in VR, activate
                            activate_1();
                        }
                        else {
                            // otherwise reset camera
                            c.camera.endXr();
                        }
                        evt.event.preventDefault();
                        evt.event.stopPropagation();
                    });
                }
                // end session by keyboard ESC
                app.keyboard.on('keydown', function (evt) {
                    if (evt.key === pc__namespace.KEY_ESCAPE && app.xr.active) {
                        app.xr.end();
                    }
                });
                // when new input source added
                app.xr.input.on('add', function (inputSource) {
                    message("Controller Added");
                    createController(inputSource);
                });
                if (window.XRHand) {
                    message("Tap on screen to enter VR, and switch to hand input");
                }
                else {
                    message("WebXR Hands Input is not supported by your platform");
                }
                // update position and rotation for each controller
                app.on('update', function () {
                    for (var i = 0; i < controllers.length; i++) {
                        var inputSource = controllers[i].inputSource;
                        if (inputSource.hand) {
                            // hand input source
                            controllers[i].enabled = true;
                            // update each hand joint
                            for (var j = 0; j < controllers[i].joints.length; j++) {
                                var joint = controllers[i].joints[j].joint;
                                var r = joint.radius * 2;
                                controllers[i].joints[j].setLocalScale(r, r, r);
                                controllers[i].joints[j].setPosition(joint.getPosition());
                                controllers[i].joints[j].setRotation(joint.getRotation());
                            }
                        }
                        else if (inputSource.grip) {
                            // grippable input source
                            controllers[i].enabled = true;
                            controllers[i].setLocalPosition(inputSource.getLocalPosition());
                            controllers[i].setLocalRotation(inputSource.getLocalRotation());
                        }
                        else {
                            // some controllers cannot be gripped
                            controllers[i].enabled = false;
                        }
                    }
                });
            }
            else {
                message("WebXR is not supported");
            }
        };
        VrHandsExample.CATEGORY = 'XR';
        VrHandsExample.NAME = 'VR Hands';
        return VrHandsExample;
    }());

    var VrMovementExample = /** @class */ (function () {
        function VrMovementExample() {
        }
        VrMovementExample.prototype.example = function (canvas, deviceType) {
            var message = function (msg) {
                var el = document.querySelector('.message');
                if (!el) {
                    el = document.createElement('div');
                    el.classList.add('message');
                    document.body.append(el);
                }
                el.textContent = msg;
            };
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(canvas),
                touch: new pc__namespace.TouchDevice(canvas),
                keyboard: new pc__namespace.Keyboard(window)
            });
            app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
            window.addEventListener("resize", function () {
                app.resizeCanvas(canvas.width, canvas.height);
            });
            // use device pixel ratio
            app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
            app.start();
            // create camera parent
            var cameraParent = new pc__namespace.Entity();
            app.root.addChild(cameraParent);
            // create camera
            var c = new pc__namespace.Entity();
            c.addComponent('camera', {
                clearColor: new pc__namespace.Color(44 / 255, 62 / 255, 80 / 255),
                farClip: 10000
            });
            cameraParent.addChild(c);
            var l = new pc__namespace.Entity();
            l.addComponent("light", {
                type: "spot",
                range: 30
            });
            l.translate(0, 10, 0);
            app.root.addChild(l);
            var createCube = function (x, y, z) {
                var cube = new pc__namespace.Entity();
                cube.addComponent("render", {
                    type: "box",
                    material: new pc__namespace.StandardMaterial()
                });
                cube.setLocalScale(1, 1, 1);
                cube.translate(x, y, z);
                app.root.addChild(cube);
            };
            var controllers = [];
            // create controller box
            var createController = function (inputSource) {
                var entity = new pc__namespace.Entity();
                entity.addComponent('model', {
                    type: 'box'
                });
                entity.setLocalScale(0.05, 0.05, 0.05);
                cameraParent.addChild(entity);
                // @ts-ignore engine-tsd
                entity.inputSource = inputSource;
                controllers.push(entity);
                // destroy input source related entity
                // when input source is removed
                inputSource.on('remove', function () {
                    controllers.splice(controllers.indexOf(entity), 1);
                    entity.destroy();
                });
            };
            // create a grid of cubes
            var SIZE = 4;
            for (var x = 0; x <= SIZE; x++) {
                for (var y = 0; y <= SIZE; y++) {
                    createCube(2 * x - SIZE, -1.5, 2 * y - SIZE);
                }
            }
            if (app.xr.supported) {
                var activate_1 = function () {
                    if (app.xr.isAvailable(pc__namespace.XRTYPE_VR)) {
                        c.camera.startXr(pc__namespace.XRTYPE_VR, pc__namespace.XRSPACE_LOCAL, {
                            callback: function (err) {
                                if (err)
                                    message("Immersive VR failed to start: " + err.message);
                            }
                        });
                    }
                    else {
                        message("Immersive VR is not available");
                    }
                };
                app.mouse.on("mousedown", function () {
                    if (!app.xr.active)
                        activate_1();
                });
                if (app.touch) {
                    app.touch.on("touchend", function (evt) {
                        if (!app.xr.active) {
                            // if not in VR, activate
                            activate_1();
                        }
                        else {
                            // otherwise reset camera
                            c.camera.endXr();
                        }
                        evt.event.preventDefault();
                        evt.event.stopPropagation();
                    });
                }
                // end session by keyboard ESC
                app.keyboard.on('keydown', function (evt) {
                    if (evt.key === pc__namespace.KEY_ESCAPE && app.xr.active) {
                        app.xr.end();
                    }
                });
                // when new input source added
                app.xr.input.on('add', function (inputSource) {
                    createController(inputSource);
                });
                message("Tap on screen to enter VR, use left thumbstick to move and right thumbstick to rotate");
                var movementSpeed_1 = 1.5; // 1.5 m/s
                var rotateSpeed_1 = 45;
                var rotateThreshold_1 = 0.5;
                var rotateResetThreshold_1 = 0.25;
                var lastRotateValue_1 = 0;
                var tmpVec2A_1 = new pc__namespace.Vec2();
                var tmpVec2B_1 = new pc__namespace.Vec2();
                var tmpVec3A_1 = new pc__namespace.Vec3();
                var tmpVec3B_1 = new pc__namespace.Vec3();
                var lineColor_1 = new pc__namespace.Color(1, 1, 1);
                // update position and rotation for each controller
                app.on('update', function (dt) {
                    var i, inputSource;
                    // first we update movement
                    for (i = 0; i < controllers.length; i++) {
                        inputSource = controllers[i].inputSource;
                        // should have gamepad
                        if (!inputSource.gamepad)
                            continue;
                        // left controller - for movement
                        if (inputSource.handedness === pc__namespace.XRHAND_LEFT) {
                            // set vector based on gamepad thumbstick axes values
                            tmpVec2A_1.set(inputSource.gamepad.axes[2], inputSource.gamepad.axes[3]);
                            // if there is input
                            if (tmpVec2A_1.length()) {
                                tmpVec2A_1.normalize();
                                // we need to take in account camera facing
                                // so we figure out Yaw of camera
                                tmpVec2B_1.x = c.forward.x;
                                tmpVec2B_1.y = c.forward.z;
                                tmpVec2B_1.normalize();
                                var rad = Math.atan2(tmpVec2B_1.x, tmpVec2B_1.y) - (Math.PI / 2);
                                // and rotate our movement vector based on camera yaw
                                var t = tmpVec2A_1.x * Math.sin(rad) - tmpVec2A_1.y * Math.cos(rad);
                                tmpVec2A_1.y = tmpVec2A_1.y * Math.sin(rad) + tmpVec2A_1.x * Math.cos(rad);
                                tmpVec2A_1.x = t;
                                // set movement speed
                                tmpVec2A_1.mulScalar(movementSpeed_1 * dt);
                                // move camera parent based on calculated movement vector
                                cameraParent.translate(tmpVec2A_1.x, 0, tmpVec2A_1.y);
                            }
                            // right controller - for rotation
                        }
                        else if (inputSource.handedness === pc__namespace.XRHAND_RIGHT) {
                            // get rotation from thumbsitck
                            var rotate = -inputSource.gamepad.axes[2];
                            // each rotate should be done by moving thumbstick to the side enough
                            // then thumbstick should be moved back close to neutral position
                            // before it can be used again to rotate
                            if (lastRotateValue_1 > 0 && rotate < rotateResetThreshold_1) {
                                lastRotateValue_1 = 0;
                            }
                            else if (lastRotateValue_1 < 0 && rotate > -rotateResetThreshold_1) {
                                lastRotateValue_1 = 0;
                            }
                            // if thumbstick is reset and moved enough to the side
                            if (lastRotateValue_1 === 0 && Math.abs(rotate) > rotateThreshold_1) {
                                lastRotateValue_1 = Math.sign(rotate);
                                // we want to rotate relative to camera position
                                tmpVec3A_1.copy(c.getLocalPosition());
                                cameraParent.translateLocal(tmpVec3A_1);
                                cameraParent.rotateLocal(0, Math.sign(rotate) * rotateSpeed_1, 0);
                                cameraParent.translateLocal(tmpVec3A_1.mulScalar(-1));
                            }
                        }
                    }
                    // after movement and rotation is done
                    // we update/render controllers
                    for (i = 0; i < controllers.length; i++) {
                        inputSource = controllers[i].inputSource;
                        // render controller ray
                        tmpVec3A_1.copy(inputSource.getOrigin());
                        tmpVec3B_1.copy(inputSource.getDirection());
                        tmpVec3B_1.mulScalar(100).add(tmpVec3A_1);
                        app.drawLine(tmpVec3A_1, tmpVec3B_1, lineColor_1);
                        // render controller
                        if (inputSource.grip) {
                            // some controllers can be gripped
                            controllers[i].model.enabled = true;
                            controllers[i].setLocalPosition(inputSource.getLocalPosition);
                            controllers[i].setLocalRotation(inputSource.getLocalRotation);
                        }
                        else {
                            // some controllers cannot be gripped
                            controllers[i].model.enabled = false;
                        }
                    }
                });
            }
            else {
                message("WebXR is not supported");
            }
        };
        VrMovementExample.CATEGORY = 'XR';
        VrMovementExample.NAME = 'VR Movement';
        return VrMovementExample;
    }());

    var XrPickingExample = /** @class */ (function () {
        function XrPickingExample() {
        }
        XrPickingExample.prototype.example = function (canvas, deviceType) {
            var message = function (msg) {
                var el = document.querySelector('.message');
                if (!el) {
                    el = document.createElement('div');
                    el.classList.add('message');
                    document.body.append(el);
                }
                el.textContent = msg;
            };
            var app = new pc__namespace.Application(canvas, {
                mouse: new pc__namespace.Mouse(canvas),
                touch: new pc__namespace.TouchDevice(canvas),
                keyboard: new pc__namespace.Keyboard(window)
            });
            app.setCanvasFillMode(pc__namespace.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc__namespace.RESOLUTION_AUTO);
            window.addEventListener("resize", function () {
                app.resizeCanvas(canvas.width, canvas.height);
            });
            // use device pixel ratio
            app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
            app.start();
            // create camera
            var c = new pc__namespace.Entity();
            c.addComponent('camera', {
                clearColor: new pc__namespace.Color(44 / 255, 62 / 255, 80 / 255),
                farClip: 10000
            });
            app.root.addChild(c);
            var l = new pc__namespace.Entity();
            l.addComponent("light", {
                type: "spot",
                range: 30
            });
            l.translate(0, 10, 0);
            app.root.addChild(l);
            var cubes = [];
            var createCube = function (x, y, z) {
                var cube = new pc__namespace.Entity();
                cube.addComponent("render", {
                    type: "box",
                    material: new pc__namespace.StandardMaterial()
                });
                cube.setLocalScale(1, 1, 1);
                cube.translate(x, y, z);
                app.root.addChild(cube);
                cubes.push(cube);
            };
            // create a grid of cubes
            var SIZE = 4;
            for (var x = 0; x <= SIZE; x++) {
                for (var y = 0; y <= SIZE; y++) {
                    createCube(2 * x - SIZE, -1.5, 2 * y - SIZE);
                }
            }
            if (app.xr.supported) {
                var activate_1 = function () {
                    if (app.xr.isAvailable(pc__namespace.XRTYPE_VR)) {
                        c.camera.startXr(pc__namespace.XRTYPE_VR, pc__namespace.XRSPACE_LOCAL, {
                            callback: function (err) {
                                if (err)
                                    message("Immersive VR failed to start: " + err.message);
                            }
                        });
                    }
                    else {
                        message("Immersive VR is not available");
                    }
                };
                app.mouse.on("mousedown", function () {
                    if (!app.xr.active)
                        activate_1();
                });
                if (app.touch) {
                    app.touch.on("touchend", function (evt) {
                        if (!app.xr.active) {
                            // if not in VR, activate
                            activate_1();
                        }
                        else {
                            // otherwise reset camera
                            c.camera.endXr();
                        }
                        evt.event.preventDefault();
                        evt.event.stopPropagation();
                    });
                }
                // end session by keyboard ESC
                app.keyboard.on('keydown', function (evt) {
                    if (evt.key === pc__namespace.KEY_ESCAPE && app.xr.active) {
                        app.xr.end();
                    }
                });
                message("Tap on screen to enter VR, and then pick objects");
                // when input source is triggers select
                // pick closest box and change its color
                var ray_1 = new pc__namespace.Ray();
                app.xr.input.on('select', function (inputSource) {
                    var candidate = null;
                    var candidateDist = Infinity;
                    for (var i = 0; i < cubes.length; i++) {
                        var mesh = cubes[i].model.meshInstances[0];
                        // check if mesh bounding box intersects with input source ray
                        ray_1.set(inputSource.getOrigin(), inputSource.getDirection());
                        if (mesh.aabb.intersectsRay(ray_1)) {
                            // check distance to camera
                            var dist = mesh.aabb.center.distance(c.getPosition());
                            // if it is closer than previous distance
                            if (dist < candidateDist) {
                                // set new candidate
                                candidate = mesh;
                                candidateDist = dist;
                            }
                        }
                    }
                    // if we have picked candidate
                    if (candidate) {
                        // randomize its color
                        candidate.material.diffuse.set(Math.random(), Math.random(), Math.random());
                        candidate.material.update();
                    }
                });
                var tmpVec_1 = new pc__namespace.Vec3();
                var lineColor_1 = new pc__namespace.Color(1, 1, 1);
                // on each app update
                // render input source rays as a line
                app.on('update', function () {
                    for (var i = 0; i < app.xr.input.inputSources.length; i++) {
                        var inputSource = app.xr.input.inputSources[i];
                        var direction = inputSource.getDirection();
                        var origin_1 = inputSource.getOrigin();
                        tmpVec_1.copy(direction).mulScalar(100).add(origin_1);
                        app.drawLine(inputSource.getOrigin(), tmpVec_1, lineColor_1);
                    }
                });
            }
            else {
                message("WebXR is not supported");
            }
        };
        XrPickingExample.CATEGORY = 'XR';
        XrPickingExample.NAME = 'XR Picking';
        return XrPickingExample;
    }());

    var index = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ArBasicExample: ArBasicExample,
        ArHitTestExample: ArHitTestExample,
        VrBasicExample: VrBasicExample,
        VrControllersExample: VrControllersExample,
        VrHandsExample: VrHandsExample,
        VrMovementExample: VrMovementExample,
        XrPickingExample: XrPickingExample
    });

    exports.Animation = index$9;
    exports.Camera = index$8;
    exports.Graphics = index$7;
    exports.Input = index$6;
    exports.Loaders = index$5;
    exports.Misc = index$4;
    exports.Physics = index$3;
    exports.Sound = index$2;
    exports.UserInterface = index$1;
    exports.Xr = index;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
