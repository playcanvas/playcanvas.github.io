var CubemapRenderer=pc.createScript("cubemapRenderer");CubemapRenderer.attributes.add("resolution",{title:"Resolution",description:"Resolution of one side of a cubemap. Use power of 2 resolution if you wish to use Mipmaps.",type:"number",default:64}),CubemapRenderer.attributes.add("mipmaps",{title:"Mipmaps",description:"If set to true, mipmaps will be allocated and autogenerated.",type:"boolean",default:!0}),CubemapRenderer.attributes.add("depth",{title:"Depth",description:"If set to true, depth buffer will be created.",type:"boolean",default:!0}),CubemapRenderer.prototype.initialize=function(){var e=this.entity.camera;if(e){e.enabled=!1;var t=Math.min(this.resolution,this.app.graphicsDevice.maxCubeMapSize);this.cubeMap=new pc.Texture(this.app.graphicsDevice,{width:t,height:t,format:pc.PIXELFORMAT_R8_G8_B8_A8,cubemap:!0,mipmaps:this.mipmaps,minFilter:pc.FILTER_LINEAR_MIPMAP_LINEAR,magFilter:pc.FILTER_LINEAR});for(var r=[(new pc.Quat).setFromEulerAngles(0,90,180),(new pc.Quat).setFromEulerAngles(0,-90,180),(new pc.Quat).setFromEulerAngles(90,0,0),(new pc.Quat).setFromEulerAngles(-90,0,0),(new pc.Quat).setFromEulerAngles(0,180,180),(new pc.Quat).setFromEulerAngles(0,0,180)],a=0;a<6;a++){var i=new pc.RenderTarget({colorBuffer:this.cubeMap,depth:this.depth,face:a}),p=new pc.Entity("CubeMapCamera_"+a);p.addComponent("camera",{aspectRatio:1,fov:90,layers:e.layers,priority:e.priority,clearColor:e.clearColor,clearColorBuffer:e.clearColorBuffer,clearDepthBuffer:e.clearDepthBuffer,clearStencilBuffer:e.clearStencilBuffer,farClip:e.farClip,nearClip:e.nearClip,frustumCulling:e.frustumCulling,renderTarget:i}),this.entity.addChild(p),p.setRotation(r[a])}}else console.error("CubemapRenderer component requires Camera component to be created on the Entity.")};