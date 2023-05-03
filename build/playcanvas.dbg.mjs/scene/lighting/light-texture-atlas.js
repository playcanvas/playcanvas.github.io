import { Vec2 } from '../../core/math/vec2.js';
import { Vec4 } from '../../core/math/vec4.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { SHADOW_PCF3, LIGHTTYPE_SPOT, LIGHTTYPE_OMNI } from '../constants.js';
import { CookieRenderer } from '../renderer/cookie-renderer.js';
import { ShadowMap } from '../renderer/shadow-map.js';

const _tempArray = [];
const _tempArray2 = [];
const _viewport = new Vec4();
const _scissor = new Vec4();
class Slot {
  constructor(rect) {
    this.size = Math.floor(rect.w * 1024); // size normalized to 1024 atlas
    this.used = false;
    this.lightId = -1; // id of the light using the slot
    this.rect = rect;
  }
}

// A class handling runtime allocation of slots in a texture. It is used to allocate slots in the shadow and cookie atlas.
class LightTextureAtlas {
  constructor(device) {
    this.device = device;
    this.version = 1; // incremented each time slot configuration changes

    this.shadowAtlasResolution = 2048;
    this.shadowAtlas = null;

    // number of additional pixels to render past the required shadow camera angle (90deg for omni, outer for spot) of the shadow camera for clustered lights.
    // This needs to be a pixel more than a shadow filter needs to access.
    this.shadowEdgePixels = 3;
    this.cookieAtlasResolution = 2048;
    this.cookieAtlas = null;
    this.cookieRenderTarget = null;

    // available slots (of type Slot)
    this.slots = [];

    // current subdivision strategy - matches format of LightingParams.atlasSplit
    this.atlasSplit = [];

    // offsets to individual faces of a cubemap inside 3x3 grid in an atlas slot
    this.cubeSlotsOffsets = [new Vec2(0, 0), new Vec2(0, 1), new Vec2(1, 0), new Vec2(1, 1), new Vec2(2, 0), new Vec2(2, 1)];

    // handles gap between slots
    this.scissorVec = new Vec4();
    this.allocateShadowAtlas(1); // placeholder as shader requires it
    this.allocateCookieAtlas(1); // placeholder as shader requires it
    this.allocateUniforms();
  }
  destroy() {
    this.destroyShadowAtlas();
    this.destroyCookieAtlas();
  }
  destroyShadowAtlas() {
    if (this.shadowAtlas) {
      this.shadowAtlas.destroy();
      this.shadowAtlas = null;
    }
  }
  destroyCookieAtlas() {
    if (this.cookieAtlas) {
      this.cookieAtlas.destroy();
      this.cookieAtlas = null;
    }
    if (this.cookieRenderTarget) {
      this.cookieRenderTarget.destroy();
      this.cookieRenderTarget = null;
    }
  }
  allocateShadowAtlas(resolution) {
    if (!this.shadowAtlas || this.shadowAtlas.texture.width !== resolution) {
      // content of atlas is lost, force re-render of static shadows
      this.version++;
      this.destroyShadowAtlas();
      this.shadowAtlas = ShadowMap.createAtlas(this.device, resolution, SHADOW_PCF3);

      // avoid it being destroyed by lights
      this.shadowAtlas.cached = true;

      // leave gap between individual tiles to avoid shadow / cookie sampling other tiles (enough for PCF5)
      // note that this only fades / removes shadows on the edges, which is still not correct - a shader clipping is needed?
      const scissorOffset = 4 / this.shadowAtlasResolution;
      this.scissorVec.set(scissorOffset, scissorOffset, -2 * scissorOffset, -2 * scissorOffset);
    }
  }
  allocateCookieAtlas(resolution) {
    if (!this.cookieAtlas || this.cookieAtlas.width !== resolution) {
      // content of atlas is lost, force re-render of static cookies
      this.version++;
      this.destroyCookieAtlas();
      this.cookieAtlas = CookieRenderer.createTexture(this.device, resolution);
      this.cookieRenderTarget = new RenderTarget({
        colorBuffer: this.cookieAtlas,
        depth: false,
        flipY: true
      });
    }
  }
  allocateUniforms() {
    this._shadowAtlasTextureId = this.device.scope.resolve('shadowAtlasTexture');
    this._shadowAtlasParamsId = this.device.scope.resolve('shadowAtlasParams');
    this._shadowAtlasParams = new Float32Array(2);
    this._cookieAtlasTextureId = this.device.scope.resolve('cookieAtlasTexture');
  }
  updateUniforms() {
    // shadow atlas texture
    const isShadowFilterPcf = true;
    const rt = this.shadowAtlas.renderTargets[0];
    const isDepthShadow = (this.device.isWebGPU || this.device.webgl2) && isShadowFilterPcf;
    const shadowBuffer = isDepthShadow ? rt.depthBuffer : rt.colorBuffer;
    this._shadowAtlasTextureId.setValue(shadowBuffer);

    // shadow atlas params
    this._shadowAtlasParams[0] = this.shadowAtlasResolution;
    this._shadowAtlasParams[1] = this.shadowEdgePixels;
    this._shadowAtlasParamsId.setValue(this._shadowAtlasParams);

    // cookie atlas textures
    this._cookieAtlasTextureId.setValue(this.cookieAtlas);
  }
  subdivide(numLights, lightingParams) {
    let atlasSplit = lightingParams.atlasSplit;

    // if no user specified subdivision
    if (!atlasSplit) {
      // split to equal number of squares
      const gridSize = Math.ceil(Math.sqrt(numLights));
      atlasSplit = _tempArray2;
      atlasSplit[0] = gridSize;
      atlasSplit.length = 1;
    }

    // compare two arrays
    const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

    // if the split has changed, regenerate slots
    if (!arraysEqual(atlasSplit, this.atlasSplit)) {
      this.version++;
      this.slots.length = 0;

      // store current settings
      this.atlasSplit.length = 0;
      this.atlasSplit.push(...atlasSplit);

      // generate top level split
      const splitCount = this.atlasSplit[0];
      if (splitCount > 1) {
        const invSize = 1 / splitCount;
        for (let i = 0; i < splitCount; i++) {
          for (let j = 0; j < splitCount; j++) {
            const rect = new Vec4(i * invSize, j * invSize, invSize, invSize);
            const nextLevelSplit = this.atlasSplit[1 + i * splitCount + j];

            // if need to split again
            if (nextLevelSplit > 1) {
              for (let x = 0; x < nextLevelSplit; x++) {
                for (let y = 0; y < nextLevelSplit; y++) {
                  const invSizeNext = invSize / nextLevelSplit;
                  const rectNext = new Vec4(rect.x + x * invSizeNext, rect.y + y * invSizeNext, invSizeNext, invSizeNext);
                  this.slots.push(new Slot(rectNext));
                }
              }
            } else {
              this.slots.push(new Slot(rect));
            }
          }
        }
      } else {
        // single slot
        this.slots.push(new Slot(new Vec4(0, 0, 1, 1)));
      }

      // sort slots descending
      this.slots.sort((a, b) => {
        return b.size - a.size;
      });
    }
  }
  collectLights(spotLights, omniLights, lightingParams) {
    const cookiesEnabled = lightingParams.cookiesEnabled;
    const shadowsEnabled = lightingParams.shadowsEnabled;

    // get all lights that need shadows or cookies, if those are enabled
    let needsShadowAtlas = false;
    let needsCookieAtlas = false;
    const lights = _tempArray;
    lights.length = 0;
    const processLights = list => {
      for (let i = 0; i < list.length; i++) {
        const light = list[i];
        if (light.visibleThisFrame) {
          const lightShadow = shadowsEnabled && light.castShadows;
          const lightCookie = cookiesEnabled && !!light.cookie;
          needsShadowAtlas || (needsShadowAtlas = lightShadow);
          needsCookieAtlas || (needsCookieAtlas = lightCookie);
          if (lightShadow || lightCookie) {
            lights.push(light);
          }
        }
      }
    };
    if (cookiesEnabled || shadowsEnabled) {
      processLights(spotLights);
      processLights(omniLights);
    }

    // sort lights by maxScreenSize - to have them ordered by atlas slot size
    lights.sort((a, b) => {
      return b.maxScreenSize - a.maxScreenSize;
    });
    if (needsShadowAtlas) {
      this.allocateShadowAtlas(this.shadowAtlasResolution);
    }
    if (needsCookieAtlas) {
      this.allocateCookieAtlas(this.cookieAtlasResolution);
    }
    if (needsShadowAtlas || needsCookieAtlas) {
      this.subdivide(lights.length, lightingParams);
    }
    return lights;
  }

  // configure light to use assigned slot
  setupSlot(light, rect) {
    light.atlasViewport.copy(rect);
    const faceCount = light.numShadowFaces;
    for (let face = 0; face < faceCount; face++) {
      // setup slot for shadow and cookie
      if (light.castShadows || light._cookie) {
        _viewport.copy(rect);
        _scissor.copy(rect);

        // for spot lights in the atlas, make viewport slightly smaller to avoid sampling past the edges
        if (light._type === LIGHTTYPE_SPOT) {
          _viewport.add(this.scissorVec);
        }

        // for cube map, allocate part of the slot
        if (light._type === LIGHTTYPE_OMNI) {
          const smallSize = _viewport.z / 3;
          const offset = this.cubeSlotsOffsets[face];
          _viewport.x += smallSize * offset.x;
          _viewport.y += smallSize * offset.y;
          _viewport.z = smallSize;
          _viewport.w = smallSize;
          _scissor.copy(_viewport);
        }
        if (light.castShadows) {
          const lightRenderData = light.getRenderData(null, face);
          lightRenderData.shadowViewport.copy(_viewport);
          lightRenderData.shadowScissor.copy(_scissor);
        }
      }
    }
  }

  // assign a slot to the light
  assignSlot(light, slotIndex, slotReassigned) {
    light.atlasViewportAllocated = true;
    const slot = this.slots[slotIndex];
    slot.lightId = light.id;
    slot.used = true;

    // slot is reassigned (content needs to be updated)
    if (slotReassigned) {
      light.atlasSlotUpdated = true;
      light.atlasVersion = this.version;
      light.atlasSlotIndex = slotIndex;
    }
  }

  // update texture atlas for a list of lights
  update(spotLights, omniLights, lightingParams) {
    // update texture resolutions
    this.shadowAtlasResolution = lightingParams.shadowAtlasResolution;
    this.cookieAtlasResolution = lightingParams.cookieAtlasResolution;

    // collect lights requiring atlas
    const lights = this.collectLights(spotLights, omniLights, lightingParams);
    if (lights.length > 0) {
      // mark all slots as unused
      const slots = this.slots;
      for (let i = 0; i < slots.length; i++) {
        slots[i].used = false;
      }

      // assign slots to lights
      // The slot to light assignment logic:
      // - internally the atlas slots are sorted in the descending order (done when atlas split changes)
      // - every frame all visible lights are sorted by their screen space size (this handles all cameras where lights
      //   are visible using max value)
      // - all lights in this order get a slot size from the slot list in the same order. Care is taken to not reassign
      //   slot if the size of it is the same and only index changes - this is done using two pass assignment
      const assignCount = Math.min(lights.length, slots.length);

      // first pass - preserve allocated slots for lights requiring slot of the same size
      for (let i = 0; i < assignCount; i++) {
        const light = lights[i];
        if (light.castShadows) light._shadowMap = this.shadowAtlas;

        // if currently assigned slot is the same size as what is needed, and was last used by this light, reuse it
        const previousSlot = slots[light.atlasSlotIndex];
        if (light.atlasVersion === this.version && light.id === (previousSlot == null ? void 0 : previousSlot.lightId)) {
          const _previousSlot = slots[light.atlasSlotIndex];
          if (_previousSlot.size === slots[i].size && !_previousSlot.used) {
            this.assignSlot(light, light.atlasSlotIndex, false);
          }
        }
      }

      // second pass - assign slots to unhandled lights
      let usedCount = 0;
      for (let i = 0; i < assignCount; i++) {
        // skip already used slots
        while (usedCount < slots.length && slots[usedCount].used) usedCount++;
        const light = lights[i];
        if (!light.atlasViewportAllocated) {
          this.assignSlot(light, usedCount, true);
        }

        // set up all slots
        const slot = slots[light.atlasSlotIndex];
        this.setupSlot(light, slot.rect);
      }
    }
    this.updateUniforms();
  }
}

export { LightTextureAtlas };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQtdGV4dHVyZS1hdGxhcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuXG5pbXBvcnQgeyBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsIFNIQURPV19QQ0YzIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENvb2tpZVJlbmRlcmVyIH0gZnJvbSAnLi4vcmVuZGVyZXIvY29va2llLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFNoYWRvd01hcCB9IGZyb20gJy4uL3JlbmRlcmVyL3NoYWRvdy1tYXAuanMnO1xuXG5jb25zdCBfdGVtcEFycmF5ID0gW107XG5jb25zdCBfdGVtcEFycmF5MiA9IFtdO1xuY29uc3QgX3ZpZXdwb3J0ID0gbmV3IFZlYzQoKTtcbmNvbnN0IF9zY2lzc29yID0gbmV3IFZlYzQoKTtcblxuY2xhc3MgU2xvdCB7XG4gICAgY29uc3RydWN0b3IocmVjdCkge1xuICAgICAgICB0aGlzLnNpemUgPSBNYXRoLmZsb29yKHJlY3QudyAqIDEwMjQpOyAgLy8gc2l6ZSBub3JtYWxpemVkIHRvIDEwMjQgYXRsYXNcbiAgICAgICAgdGhpcy51c2VkID0gZmFsc2U7XG4gICAgICAgIHRoaXMubGlnaHRJZCA9IC0xOyAgLy8gaWQgb2YgdGhlIGxpZ2h0IHVzaW5nIHRoZSBzbG90XG4gICAgICAgIHRoaXMucmVjdCA9IHJlY3Q7XG4gICAgfVxufVxuXG4vLyBBIGNsYXNzIGhhbmRsaW5nIHJ1bnRpbWUgYWxsb2NhdGlvbiBvZiBzbG90cyBpbiBhIHRleHR1cmUuIEl0IGlzIHVzZWQgdG8gYWxsb2NhdGUgc2xvdHMgaW4gdGhlIHNoYWRvdyBhbmQgY29va2llIGF0bGFzLlxuY2xhc3MgTGlnaHRUZXh0dXJlQXRsYXMge1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuXG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLnZlcnNpb24gPSAxOyAgIC8vIGluY3JlbWVudGVkIGVhY2ggdGltZSBzbG90IGNvbmZpZ3VyYXRpb24gY2hhbmdlc1xuXG4gICAgICAgIHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uID0gMjA0ODtcbiAgICAgICAgdGhpcy5zaGFkb3dBdGxhcyA9IG51bGw7XG5cbiAgICAgICAgLy8gbnVtYmVyIG9mIGFkZGl0aW9uYWwgcGl4ZWxzIHRvIHJlbmRlciBwYXN0IHRoZSByZXF1aXJlZCBzaGFkb3cgY2FtZXJhIGFuZ2xlICg5MGRlZyBmb3Igb21uaSwgb3V0ZXIgZm9yIHNwb3QpIG9mIHRoZSBzaGFkb3cgY2FtZXJhIGZvciBjbHVzdGVyZWQgbGlnaHRzLlxuICAgICAgICAvLyBUaGlzIG5lZWRzIHRvIGJlIGEgcGl4ZWwgbW9yZSB0aGFuIGEgc2hhZG93IGZpbHRlciBuZWVkcyB0byBhY2Nlc3MuXG4gICAgICAgIHRoaXMuc2hhZG93RWRnZVBpeGVscyA9IDM7XG5cbiAgICAgICAgdGhpcy5jb29raWVBdGxhc1Jlc29sdXRpb24gPSAyMDQ4O1xuICAgICAgICB0aGlzLmNvb2tpZUF0bGFzID0gbnVsbDtcbiAgICAgICAgdGhpcy5jb29raWVSZW5kZXJUYXJnZXQgPSBudWxsO1xuXG4gICAgICAgIC8vIGF2YWlsYWJsZSBzbG90cyAob2YgdHlwZSBTbG90KVxuICAgICAgICB0aGlzLnNsb3RzID0gW107XG5cbiAgICAgICAgLy8gY3VycmVudCBzdWJkaXZpc2lvbiBzdHJhdGVneSAtIG1hdGNoZXMgZm9ybWF0IG9mIExpZ2h0aW5nUGFyYW1zLmF0bGFzU3BsaXRcbiAgICAgICAgdGhpcy5hdGxhc1NwbGl0ID0gW107XG5cbiAgICAgICAgLy8gb2Zmc2V0cyB0byBpbmRpdmlkdWFsIGZhY2VzIG9mIGEgY3ViZW1hcCBpbnNpZGUgM3gzIGdyaWQgaW4gYW4gYXRsYXMgc2xvdFxuICAgICAgICB0aGlzLmN1YmVTbG90c09mZnNldHMgPSBbXG4gICAgICAgICAgICBuZXcgVmVjMigwLCAwKSxcbiAgICAgICAgICAgIG5ldyBWZWMyKDAsIDEpLFxuICAgICAgICAgICAgbmV3IFZlYzIoMSwgMCksXG4gICAgICAgICAgICBuZXcgVmVjMigxLCAxKSxcbiAgICAgICAgICAgIG5ldyBWZWMyKDIsIDApLFxuICAgICAgICAgICAgbmV3IFZlYzIoMiwgMSlcbiAgICAgICAgXTtcblxuICAgICAgICAvLyBoYW5kbGVzIGdhcCBiZXR3ZWVuIHNsb3RzXG4gICAgICAgIHRoaXMuc2Npc3NvclZlYyA9IG5ldyBWZWM0KCk7XG5cbiAgICAgICAgdGhpcy5hbGxvY2F0ZVNoYWRvd0F0bGFzKDEpOyAgLy8gcGxhY2Vob2xkZXIgYXMgc2hhZGVyIHJlcXVpcmVzIGl0XG4gICAgICAgIHRoaXMuYWxsb2NhdGVDb29raWVBdGxhcygxKTsgIC8vIHBsYWNlaG9sZGVyIGFzIHNoYWRlciByZXF1aXJlcyBpdFxuICAgICAgICB0aGlzLmFsbG9jYXRlVW5pZm9ybXMoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmRlc3Ryb3lTaGFkb3dBdGxhcygpO1xuICAgICAgICB0aGlzLmRlc3Ryb3lDb29raWVBdGxhcygpO1xuICAgIH1cblxuICAgIGRlc3Ryb3lTaGFkb3dBdGxhcygpIHtcbiAgICAgICAgaWYgKHRoaXMuc2hhZG93QXRsYXMpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93QXRsYXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dBdGxhcyA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZXN0cm95Q29va2llQXRsYXMoKSB7XG4gICAgICAgIGlmICh0aGlzLmNvb2tpZUF0bGFzKSB7XG4gICAgICAgICAgICB0aGlzLmNvb2tpZUF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuY29va2llQXRsYXMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmNvb2tpZVJlbmRlclRhcmdldCkge1xuICAgICAgICAgICAgdGhpcy5jb29raWVSZW5kZXJUYXJnZXQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5jb29raWVSZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWxsb2NhdGVTaGFkb3dBdGxhcyhyZXNvbHV0aW9uKSB7XG4gICAgICAgIGlmICghdGhpcy5zaGFkb3dBdGxhcyB8fCB0aGlzLnNoYWRvd0F0bGFzLnRleHR1cmUud2lkdGggIT09IHJlc29sdXRpb24pIHtcblxuICAgICAgICAgICAgLy8gY29udGVudCBvZiBhdGxhcyBpcyBsb3N0LCBmb3JjZSByZS1yZW5kZXIgb2Ygc3RhdGljIHNoYWRvd3NcbiAgICAgICAgICAgIHRoaXMudmVyc2lvbisrO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lTaGFkb3dBdGxhcygpO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dBdGxhcyA9IFNoYWRvd01hcC5jcmVhdGVBdGxhcyh0aGlzLmRldmljZSwgcmVzb2x1dGlvbiwgU0hBRE9XX1BDRjMpO1xuXG4gICAgICAgICAgICAvLyBhdm9pZCBpdCBiZWluZyBkZXN0cm95ZWQgYnkgbGlnaHRzXG4gICAgICAgICAgICB0aGlzLnNoYWRvd0F0bGFzLmNhY2hlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGxlYXZlIGdhcCBiZXR3ZWVuIGluZGl2aWR1YWwgdGlsZXMgdG8gYXZvaWQgc2hhZG93IC8gY29va2llIHNhbXBsaW5nIG90aGVyIHRpbGVzIChlbm91Z2ggZm9yIFBDRjUpXG4gICAgICAgICAgICAvLyBub3RlIHRoYXQgdGhpcyBvbmx5IGZhZGVzIC8gcmVtb3ZlcyBzaGFkb3dzIG9uIHRoZSBlZGdlcywgd2hpY2ggaXMgc3RpbGwgbm90IGNvcnJlY3QgLSBhIHNoYWRlciBjbGlwcGluZyBpcyBuZWVkZWQ/XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yT2Zmc2V0ID0gNCAvIHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uO1xuICAgICAgICAgICAgdGhpcy5zY2lzc29yVmVjLnNldChzY2lzc29yT2Zmc2V0LCBzY2lzc29yT2Zmc2V0LCAtMiAqIHNjaXNzb3JPZmZzZXQsIC0yICogc2Npc3Nvck9mZnNldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhbGxvY2F0ZUNvb2tpZUF0bGFzKHJlc29sdXRpb24pIHtcbiAgICAgICAgaWYgKCF0aGlzLmNvb2tpZUF0bGFzIHx8IHRoaXMuY29va2llQXRsYXMud2lkdGggIT09IHJlc29sdXRpb24pIHtcblxuICAgICAgICAgICAgLy8gY29udGVudCBvZiBhdGxhcyBpcyBsb3N0LCBmb3JjZSByZS1yZW5kZXIgb2Ygc3RhdGljIGNvb2tpZXNcbiAgICAgICAgICAgIHRoaXMudmVyc2lvbisrO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lDb29raWVBdGxhcygpO1xuICAgICAgICAgICAgdGhpcy5jb29raWVBdGxhcyA9IENvb2tpZVJlbmRlcmVyLmNyZWF0ZVRleHR1cmUodGhpcy5kZXZpY2UsIHJlc29sdXRpb24pO1xuXG4gICAgICAgICAgICB0aGlzLmNvb2tpZVJlbmRlclRhcmdldCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0aGlzLmNvb2tpZUF0bGFzLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBmbGlwWTogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhbGxvY2F0ZVVuaWZvcm1zKCkge1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1RleHR1cmVJZCA9IHRoaXMuZGV2aWNlLnNjb3BlLnJlc29sdmUoJ3NoYWRvd0F0bGFzVGV4dHVyZScpO1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1BhcmFtc0lkID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnc2hhZG93QXRsYXNQYXJhbXMnKTtcbiAgICAgICAgdGhpcy5fc2hhZG93QXRsYXNQYXJhbXMgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuXG4gICAgICAgIHRoaXMuX2Nvb2tpZUF0bGFzVGV4dHVyZUlkID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY29va2llQXRsYXNUZXh0dXJlJyk7XG4gICAgfVxuXG4gICAgdXBkYXRlVW5pZm9ybXMoKSB7XG5cbiAgICAgICAgLy8gc2hhZG93IGF0bGFzIHRleHR1cmVcbiAgICAgICAgY29uc3QgaXNTaGFkb3dGaWx0ZXJQY2YgPSB0cnVlO1xuICAgICAgICBjb25zdCBydCA9IHRoaXMuc2hhZG93QXRsYXMucmVuZGVyVGFyZ2V0c1swXTtcbiAgICAgICAgY29uc3QgaXNEZXB0aFNoYWRvdyA9ICh0aGlzLmRldmljZS5pc1dlYkdQVSB8fCB0aGlzLmRldmljZS53ZWJnbDIpICYmIGlzU2hhZG93RmlsdGVyUGNmO1xuICAgICAgICBjb25zdCBzaGFkb3dCdWZmZXIgPSBpc0RlcHRoU2hhZG93ID8gcnQuZGVwdGhCdWZmZXIgOiBydC5jb2xvckJ1ZmZlcjtcbiAgICAgICAgdGhpcy5fc2hhZG93QXRsYXNUZXh0dXJlSWQuc2V0VmFsdWUoc2hhZG93QnVmZmVyKTtcblxuICAgICAgICAvLyBzaGFkb3cgYXRsYXMgcGFyYW1zXG4gICAgICAgIHRoaXMuX3NoYWRvd0F0bGFzUGFyYW1zWzBdID0gdGhpcy5zaGFkb3dBdGxhc1Jlc29sdXRpb247XG4gICAgICAgIHRoaXMuX3NoYWRvd0F0bGFzUGFyYW1zWzFdID0gdGhpcy5zaGFkb3dFZGdlUGl4ZWxzO1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1BhcmFtc0lkLnNldFZhbHVlKHRoaXMuX3NoYWRvd0F0bGFzUGFyYW1zKTtcblxuICAgICAgICAvLyBjb29raWUgYXRsYXMgdGV4dHVyZXNcbiAgICAgICAgdGhpcy5fY29va2llQXRsYXNUZXh0dXJlSWQuc2V0VmFsdWUodGhpcy5jb29raWVBdGxhcyk7XG4gICAgfVxuXG4gICAgc3ViZGl2aWRlKG51bUxpZ2h0cywgbGlnaHRpbmdQYXJhbXMpIHtcblxuICAgICAgICBsZXQgYXRsYXNTcGxpdCA9IGxpZ2h0aW5nUGFyYW1zLmF0bGFzU3BsaXQ7XG5cbiAgICAgICAgLy8gaWYgbm8gdXNlciBzcGVjaWZpZWQgc3ViZGl2aXNpb25cbiAgICAgICAgaWYgKCFhdGxhc1NwbGl0KSB7XG5cbiAgICAgICAgICAgIC8vIHNwbGl0IHRvIGVxdWFsIG51bWJlciBvZiBzcXVhcmVzXG4gICAgICAgICAgICBjb25zdCBncmlkU2l6ZSA9IE1hdGguY2VpbChNYXRoLnNxcnQobnVtTGlnaHRzKSk7XG4gICAgICAgICAgICBhdGxhc1NwbGl0ID0gX3RlbXBBcnJheTI7XG4gICAgICAgICAgICBhdGxhc1NwbGl0WzBdID0gZ3JpZFNpemU7XG4gICAgICAgICAgICBhdGxhc1NwbGl0Lmxlbmd0aCA9IDE7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjb21wYXJlIHR3byBhcnJheXNcbiAgICAgICAgY29uc3QgYXJyYXlzRXF1YWwgPSAoYSwgYikgPT4gYS5sZW5ndGggPT09IGIubGVuZ3RoICYmIGEuZXZlcnkoKHYsIGkpID0+IHYgPT09IGJbaV0pO1xuXG4gICAgICAgIC8vIGlmIHRoZSBzcGxpdCBoYXMgY2hhbmdlZCwgcmVnZW5lcmF0ZSBzbG90c1xuICAgICAgICBpZiAoIWFycmF5c0VxdWFsKGF0bGFzU3BsaXQsIHRoaXMuYXRsYXNTcGxpdCkpIHtcblxuICAgICAgICAgICAgdGhpcy52ZXJzaW9uKys7XG4gICAgICAgICAgICB0aGlzLnNsb3RzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgICAgIC8vIHN0b3JlIGN1cnJlbnQgc2V0dGluZ3NcbiAgICAgICAgICAgIHRoaXMuYXRsYXNTcGxpdC5sZW5ndGggPSAwO1xuICAgICAgICAgICAgdGhpcy5hdGxhc1NwbGl0LnB1c2goLi4uYXRsYXNTcGxpdCk7XG5cbiAgICAgICAgICAgIC8vIGdlbmVyYXRlIHRvcCBsZXZlbCBzcGxpdFxuICAgICAgICAgICAgY29uc3Qgc3BsaXRDb3VudCA9IHRoaXMuYXRsYXNTcGxpdFswXTtcbiAgICAgICAgICAgIGlmIChzcGxpdENvdW50ID4gMSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGludlNpemUgPSAxIC8gc3BsaXRDb3VudDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNwbGl0Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHNwbGl0Q291bnQ7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVjdCA9IG5ldyBWZWM0KGkgKiBpbnZTaXplLCBqICogaW52U2l6ZSwgaW52U2l6ZSwgaW52U2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXh0TGV2ZWxTcGxpdCA9IHRoaXMuYXRsYXNTcGxpdFsxICsgaSAqIHNwbGl0Q291bnQgKyBqXTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gaWYgbmVlZCB0byBzcGxpdCBhZ2FpblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKG5leHRMZXZlbFNwbGl0ID4gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHggPSAwOyB4IDwgbmV4dExldmVsU3BsaXQ7IHgrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCB5ID0gMDsgeSA8IG5leHRMZXZlbFNwbGl0OyB5KyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGludlNpemVOZXh0ID0gaW52U2l6ZSAvIG5leHRMZXZlbFNwbGl0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVjdE5leHQgPSBuZXcgVmVjNChyZWN0LnggKyB4ICogaW52U2l6ZU5leHQsIHJlY3QueSArIHkgKiBpbnZTaXplTmV4dCwgaW52U2l6ZU5leHQsIGludlNpemVOZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2xvdHMucHVzaChuZXcgU2xvdChyZWN0TmV4dCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNsb3RzLnB1c2gobmV3IFNsb3QocmVjdCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBzaW5nbGUgc2xvdFxuICAgICAgICAgICAgICAgIHRoaXMuc2xvdHMucHVzaChuZXcgU2xvdChuZXcgVmVjNCgwLCAwLCAxLCAxKSkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzb3J0IHNsb3RzIGRlc2NlbmRpbmdcbiAgICAgICAgICAgIHRoaXMuc2xvdHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBiLnNpemUgLSBhLnNpemU7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbGxlY3RMaWdodHMoc3BvdExpZ2h0cywgb21uaUxpZ2h0cywgbGlnaHRpbmdQYXJhbXMpIHtcblxuICAgICAgICBjb25zdCBjb29raWVzRW5hYmxlZCA9IGxpZ2h0aW5nUGFyYW1zLmNvb2tpZXNFbmFibGVkO1xuICAgICAgICBjb25zdCBzaGFkb3dzRW5hYmxlZCA9IGxpZ2h0aW5nUGFyYW1zLnNoYWRvd3NFbmFibGVkO1xuXG4gICAgICAgIC8vIGdldCBhbGwgbGlnaHRzIHRoYXQgbmVlZCBzaGFkb3dzIG9yIGNvb2tpZXMsIGlmIHRob3NlIGFyZSBlbmFibGVkXG4gICAgICAgIGxldCBuZWVkc1NoYWRvd0F0bGFzID0gZmFsc2U7XG4gICAgICAgIGxldCBuZWVkc0Nvb2tpZUF0bGFzID0gZmFsc2U7XG4gICAgICAgIGNvbnN0IGxpZ2h0cyA9IF90ZW1wQXJyYXk7XG4gICAgICAgIGxpZ2h0cy5sZW5ndGggPSAwO1xuXG4gICAgICAgIGNvbnN0IHByb2Nlc3NMaWdodHMgPSAobGlzdCkgPT4ge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaXN0W2ldO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC52aXNpYmxlVGhpc0ZyYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0U2hhZG93ID0gc2hhZG93c0VuYWJsZWQgJiYgbGlnaHQuY2FzdFNoYWRvd3M7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0Q29va2llID0gY29va2llc0VuYWJsZWQgJiYgISFsaWdodC5jb29raWU7XG5cbiAgICAgICAgICAgICAgICAgICAgbmVlZHNTaGFkb3dBdGxhcyB8fD0gbGlnaHRTaGFkb3c7XG4gICAgICAgICAgICAgICAgICAgIG5lZWRzQ29va2llQXRsYXMgfHw9IGxpZ2h0Q29va2llO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChsaWdodFNoYWRvdyB8fCBsaWdodENvb2tpZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGlnaHRzLnB1c2gobGlnaHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChjb29raWVzRW5hYmxlZCB8fCBzaGFkb3dzRW5hYmxlZCkge1xuICAgICAgICAgICAgcHJvY2Vzc0xpZ2h0cyhzcG90TGlnaHRzKTtcbiAgICAgICAgICAgIHByb2Nlc3NMaWdodHMob21uaUxpZ2h0cyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzb3J0IGxpZ2h0cyBieSBtYXhTY3JlZW5TaXplIC0gdG8gaGF2ZSB0aGVtIG9yZGVyZWQgYnkgYXRsYXMgc2xvdCBzaXplXG4gICAgICAgIGxpZ2h0cy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gYi5tYXhTY3JlZW5TaXplIC0gYS5tYXhTY3JlZW5TaXplO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAobmVlZHNTaGFkb3dBdGxhcykge1xuICAgICAgICAgICAgdGhpcy5hbGxvY2F0ZVNoYWRvd0F0bGFzKHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChuZWVkc0Nvb2tpZUF0bGFzKSB7XG4gICAgICAgICAgICB0aGlzLmFsbG9jYXRlQ29va2llQXRsYXModGhpcy5jb29raWVBdGxhc1Jlc29sdXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5lZWRzU2hhZG93QXRsYXMgfHwgbmVlZHNDb29raWVBdGxhcykge1xuICAgICAgICAgICAgdGhpcy5zdWJkaXZpZGUobGlnaHRzLmxlbmd0aCwgbGlnaHRpbmdQYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGxpZ2h0cztcbiAgICB9XG5cbiAgICAvLyBjb25maWd1cmUgbGlnaHQgdG8gdXNlIGFzc2lnbmVkIHNsb3RcbiAgICBzZXR1cFNsb3QobGlnaHQsIHJlY3QpIHtcblxuICAgICAgICBsaWdodC5hdGxhc1ZpZXdwb3J0LmNvcHkocmVjdCk7XG5cbiAgICAgICAgY29uc3QgZmFjZUNvdW50ID0gbGlnaHQubnVtU2hhZG93RmFjZXM7XG4gICAgICAgIGZvciAobGV0IGZhY2UgPSAwOyBmYWNlIDwgZmFjZUNvdW50OyBmYWNlKyspIHtcblxuICAgICAgICAgICAgLy8gc2V0dXAgc2xvdCBmb3Igc2hhZG93IGFuZCBjb29raWVcbiAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cyB8fCBsaWdodC5fY29va2llKSB7XG5cbiAgICAgICAgICAgICAgICBfdmlld3BvcnQuY29weShyZWN0KTtcbiAgICAgICAgICAgICAgICBfc2Npc3Nvci5jb3B5KHJlY3QpO1xuXG4gICAgICAgICAgICAgICAgLy8gZm9yIHNwb3QgbGlnaHRzIGluIHRoZSBhdGxhcywgbWFrZSB2aWV3cG9ydCBzbGlnaHRseSBzbWFsbGVyIHRvIGF2b2lkIHNhbXBsaW5nIHBhc3QgdGhlIGVkZ2VzXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfU1BPVCkge1xuICAgICAgICAgICAgICAgICAgICBfdmlld3BvcnQuYWRkKHRoaXMuc2Npc3NvclZlYyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gZm9yIGN1YmUgbWFwLCBhbGxvY2F0ZSBwYXJ0IG9mIHRoZSBzbG90XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0Ll90eXBlID09PSBMSUdIVFRZUEVfT01OSSkge1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNtYWxsU2l6ZSA9IF92aWV3cG9ydC56IC8gMztcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdGhpcy5jdWJlU2xvdHNPZmZzZXRzW2ZhY2VdO1xuICAgICAgICAgICAgICAgICAgICBfdmlld3BvcnQueCArPSBzbWFsbFNpemUgKiBvZmZzZXQueDtcbiAgICAgICAgICAgICAgICAgICAgX3ZpZXdwb3J0LnkgKz0gc21hbGxTaXplICogb2Zmc2V0Lnk7XG4gICAgICAgICAgICAgICAgICAgIF92aWV3cG9ydC56ID0gc21hbGxTaXplO1xuICAgICAgICAgICAgICAgICAgICBfdmlld3BvcnQudyA9IHNtYWxsU2l6ZTtcblxuICAgICAgICAgICAgICAgICAgICBfc2Npc3Nvci5jb3B5KF92aWV3cG9ydCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0UmVuZGVyRGF0YSA9IGxpZ2h0LmdldFJlbmRlckRhdGEobnVsbCwgZmFjZSk7XG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dWaWV3cG9ydC5jb3B5KF92aWV3cG9ydCk7XG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0UmVuZGVyRGF0YS5zaGFkb3dTY2lzc29yLmNvcHkoX3NjaXNzb3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIGFzc2lnbiBhIHNsb3QgdG8gdGhlIGxpZ2h0XG4gICAgYXNzaWduU2xvdChsaWdodCwgc2xvdEluZGV4LCBzbG90UmVhc3NpZ25lZCkge1xuXG4gICAgICAgIGxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQgPSB0cnVlO1xuXG4gICAgICAgIGNvbnN0IHNsb3QgPSB0aGlzLnNsb3RzW3Nsb3RJbmRleF07XG4gICAgICAgIHNsb3QubGlnaHRJZCA9IGxpZ2h0LmlkO1xuICAgICAgICBzbG90LnVzZWQgPSB0cnVlO1xuXG4gICAgICAgIC8vIHNsb3QgaXMgcmVhc3NpZ25lZCAoY29udGVudCBuZWVkcyB0byBiZSB1cGRhdGVkKVxuICAgICAgICBpZiAoc2xvdFJlYXNzaWduZWQpIHtcbiAgICAgICAgICAgIGxpZ2h0LmF0bGFzU2xvdFVwZGF0ZWQgPSB0cnVlO1xuICAgICAgICAgICAgbGlnaHQuYXRsYXNWZXJzaW9uID0gdGhpcy52ZXJzaW9uO1xuICAgICAgICAgICAgbGlnaHQuYXRsYXNTbG90SW5kZXggPSBzbG90SW5kZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyB1cGRhdGUgdGV4dHVyZSBhdGxhcyBmb3IgYSBsaXN0IG9mIGxpZ2h0c1xuICAgIHVwZGF0ZShzcG90TGlnaHRzLCBvbW5pTGlnaHRzLCBsaWdodGluZ1BhcmFtcykge1xuXG4gICAgICAgIC8vIHVwZGF0ZSB0ZXh0dXJlIHJlc29sdXRpb25zXG4gICAgICAgIHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uID0gbGlnaHRpbmdQYXJhbXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uO1xuICAgICAgICB0aGlzLmNvb2tpZUF0bGFzUmVzb2x1dGlvbiA9IGxpZ2h0aW5nUGFyYW1zLmNvb2tpZUF0bGFzUmVzb2x1dGlvbjtcblxuICAgICAgICAvLyBjb2xsZWN0IGxpZ2h0cyByZXF1aXJpbmcgYXRsYXNcbiAgICAgICAgY29uc3QgbGlnaHRzID0gdGhpcy5jb2xsZWN0TGlnaHRzKHNwb3RMaWdodHMsIG9tbmlMaWdodHMsIGxpZ2h0aW5nUGFyYW1zKTtcbiAgICAgICAgaWYgKGxpZ2h0cy5sZW5ndGggPiAwKSB7XG5cbiAgICAgICAgICAgIC8vIG1hcmsgYWxsIHNsb3RzIGFzIHVudXNlZFxuICAgICAgICAgICAgY29uc3Qgc2xvdHMgPSB0aGlzLnNsb3RzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzbG90cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHNsb3RzW2ldLnVzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYXNzaWduIHNsb3RzIHRvIGxpZ2h0c1xuICAgICAgICAgICAgLy8gVGhlIHNsb3QgdG8gbGlnaHQgYXNzaWdubWVudCBsb2dpYzpcbiAgICAgICAgICAgIC8vIC0gaW50ZXJuYWxseSB0aGUgYXRsYXMgc2xvdHMgYXJlIHNvcnRlZCBpbiB0aGUgZGVzY2VuZGluZyBvcmRlciAoZG9uZSB3aGVuIGF0bGFzIHNwbGl0IGNoYW5nZXMpXG4gICAgICAgICAgICAvLyAtIGV2ZXJ5IGZyYW1lIGFsbCB2aXNpYmxlIGxpZ2h0cyBhcmUgc29ydGVkIGJ5IHRoZWlyIHNjcmVlbiBzcGFjZSBzaXplICh0aGlzIGhhbmRsZXMgYWxsIGNhbWVyYXMgd2hlcmUgbGlnaHRzXG4gICAgICAgICAgICAvLyAgIGFyZSB2aXNpYmxlIHVzaW5nIG1heCB2YWx1ZSlcbiAgICAgICAgICAgIC8vIC0gYWxsIGxpZ2h0cyBpbiB0aGlzIG9yZGVyIGdldCBhIHNsb3Qgc2l6ZSBmcm9tIHRoZSBzbG90IGxpc3QgaW4gdGhlIHNhbWUgb3JkZXIuIENhcmUgaXMgdGFrZW4gdG8gbm90IHJlYXNzaWduXG4gICAgICAgICAgICAvLyAgIHNsb3QgaWYgdGhlIHNpemUgb2YgaXQgaXMgdGhlIHNhbWUgYW5kIG9ubHkgaW5kZXggY2hhbmdlcyAtIHRoaXMgaXMgZG9uZSB1c2luZyB0d28gcGFzcyBhc3NpZ25tZW50XG4gICAgICAgICAgICBjb25zdCBhc3NpZ25Db3VudCA9IE1hdGgubWluKGxpZ2h0cy5sZW5ndGgsIHNsb3RzLmxlbmd0aCk7XG5cbiAgICAgICAgICAgIC8vIGZpcnN0IHBhc3MgLSBwcmVzZXJ2ZSBhbGxvY2F0ZWQgc2xvdHMgZm9yIGxpZ2h0cyByZXF1aXJpbmcgc2xvdCBvZiB0aGUgc2FtZSBzaXplXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2lnbkNvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcblxuICAgICAgICAgICAgICAgIGlmIChsaWdodC5jYXN0U2hhZG93cylcbiAgICAgICAgICAgICAgICAgICAgbGlnaHQuX3NoYWRvd01hcCA9IHRoaXMuc2hhZG93QXRsYXM7XG5cbiAgICAgICAgICAgICAgICAvLyBpZiBjdXJyZW50bHkgYXNzaWduZWQgc2xvdCBpcyB0aGUgc2FtZSBzaXplIGFzIHdoYXQgaXMgbmVlZGVkLCBhbmQgd2FzIGxhc3QgdXNlZCBieSB0aGlzIGxpZ2h0LCByZXVzZSBpdFxuICAgICAgICAgICAgICAgIGNvbnN0IHByZXZpb3VzU2xvdCA9IHNsb3RzW2xpZ2h0LmF0bGFzU2xvdEluZGV4XTtcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuYXRsYXNWZXJzaW9uID09PSB0aGlzLnZlcnNpb24gJiYgbGlnaHQuaWQgPT09IHByZXZpb3VzU2xvdD8ubGlnaHRJZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmV2aW91c1Nsb3QgPSBzbG90c1tsaWdodC5hdGxhc1Nsb3RJbmRleF07XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcmV2aW91c1Nsb3Quc2l6ZSA9PT0gc2xvdHNbaV0uc2l6ZSAmJiAhcHJldmlvdXNTbG90LnVzZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXNzaWduU2xvdChsaWdodCwgbGlnaHQuYXRsYXNTbG90SW5kZXgsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc2Vjb25kIHBhc3MgLSBhc3NpZ24gc2xvdHMgdG8gdW5oYW5kbGVkIGxpZ2h0c1xuICAgICAgICAgICAgbGV0IHVzZWRDb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFzc2lnbkNvdW50OyBpKyspIHtcblxuICAgICAgICAgICAgICAgIC8vIHNraXAgYWxyZWFkeSB1c2VkIHNsb3RzXG4gICAgICAgICAgICAgICAgd2hpbGUgKHVzZWRDb3VudCA8IHNsb3RzLmxlbmd0aCAmJiBzbG90c1t1c2VkQ291bnRdLnVzZWQpXG4gICAgICAgICAgICAgICAgICAgIHVzZWRDb3VudCsrO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBsaWdodHNbaV07XG4gICAgICAgICAgICAgICAgaWYgKCFsaWdodC5hdGxhc1ZpZXdwb3J0QWxsb2NhdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXNzaWduU2xvdChsaWdodCwgdXNlZENvdW50LCB0cnVlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBzZXQgdXAgYWxsIHNsb3RzXG4gICAgICAgICAgICAgICAgY29uc3Qgc2xvdCA9IHNsb3RzW2xpZ2h0LmF0bGFzU2xvdEluZGV4XTtcbiAgICAgICAgICAgICAgICB0aGlzLnNldHVwU2xvdChsaWdodCwgc2xvdC5yZWN0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudXBkYXRlVW5pZm9ybXMoKTtcbiAgICB9XG59XG5cbmV4cG9ydCB7IExpZ2h0VGV4dHVyZUF0bGFzIH07XG4iXSwibmFtZXMiOlsiX3RlbXBBcnJheSIsIl90ZW1wQXJyYXkyIiwiX3ZpZXdwb3J0IiwiVmVjNCIsIl9zY2lzc29yIiwiU2xvdCIsImNvbnN0cnVjdG9yIiwicmVjdCIsInNpemUiLCJNYXRoIiwiZmxvb3IiLCJ3IiwidXNlZCIsImxpZ2h0SWQiLCJMaWdodFRleHR1cmVBdGxhcyIsImRldmljZSIsInZlcnNpb24iLCJzaGFkb3dBdGxhc1Jlc29sdXRpb24iLCJzaGFkb3dBdGxhcyIsInNoYWRvd0VkZ2VQaXhlbHMiLCJjb29raWVBdGxhc1Jlc29sdXRpb24iLCJjb29raWVBdGxhcyIsImNvb2tpZVJlbmRlclRhcmdldCIsInNsb3RzIiwiYXRsYXNTcGxpdCIsImN1YmVTbG90c09mZnNldHMiLCJWZWMyIiwic2Npc3NvclZlYyIsImFsbG9jYXRlU2hhZG93QXRsYXMiLCJhbGxvY2F0ZUNvb2tpZUF0bGFzIiwiYWxsb2NhdGVVbmlmb3JtcyIsImRlc3Ryb3kiLCJkZXN0cm95U2hhZG93QXRsYXMiLCJkZXN0cm95Q29va2llQXRsYXMiLCJyZXNvbHV0aW9uIiwidGV4dHVyZSIsIndpZHRoIiwiU2hhZG93TWFwIiwiY3JlYXRlQXRsYXMiLCJTSEFET1dfUENGMyIsImNhY2hlZCIsInNjaXNzb3JPZmZzZXQiLCJzZXQiLCJDb29raWVSZW5kZXJlciIsImNyZWF0ZVRleHR1cmUiLCJSZW5kZXJUYXJnZXQiLCJjb2xvckJ1ZmZlciIsImRlcHRoIiwiZmxpcFkiLCJfc2hhZG93QXRsYXNUZXh0dXJlSWQiLCJzY29wZSIsInJlc29sdmUiLCJfc2hhZG93QXRsYXNQYXJhbXNJZCIsIl9zaGFkb3dBdGxhc1BhcmFtcyIsIkZsb2F0MzJBcnJheSIsIl9jb29raWVBdGxhc1RleHR1cmVJZCIsInVwZGF0ZVVuaWZvcm1zIiwiaXNTaGFkb3dGaWx0ZXJQY2YiLCJydCIsInJlbmRlclRhcmdldHMiLCJpc0RlcHRoU2hhZG93IiwiaXNXZWJHUFUiLCJ3ZWJnbDIiLCJzaGFkb3dCdWZmZXIiLCJkZXB0aEJ1ZmZlciIsInNldFZhbHVlIiwic3ViZGl2aWRlIiwibnVtTGlnaHRzIiwibGlnaHRpbmdQYXJhbXMiLCJncmlkU2l6ZSIsImNlaWwiLCJzcXJ0IiwibGVuZ3RoIiwiYXJyYXlzRXF1YWwiLCJhIiwiYiIsImV2ZXJ5IiwidiIsImkiLCJwdXNoIiwic3BsaXRDb3VudCIsImludlNpemUiLCJqIiwibmV4dExldmVsU3BsaXQiLCJ4IiwieSIsImludlNpemVOZXh0IiwicmVjdE5leHQiLCJzb3J0IiwiY29sbGVjdExpZ2h0cyIsInNwb3RMaWdodHMiLCJvbW5pTGlnaHRzIiwiY29va2llc0VuYWJsZWQiLCJzaGFkb3dzRW5hYmxlZCIsIm5lZWRzU2hhZG93QXRsYXMiLCJuZWVkc0Nvb2tpZUF0bGFzIiwibGlnaHRzIiwicHJvY2Vzc0xpZ2h0cyIsImxpc3QiLCJsaWdodCIsInZpc2libGVUaGlzRnJhbWUiLCJsaWdodFNoYWRvdyIsImNhc3RTaGFkb3dzIiwibGlnaHRDb29raWUiLCJjb29raWUiLCJtYXhTY3JlZW5TaXplIiwic2V0dXBTbG90IiwiYXRsYXNWaWV3cG9ydCIsImNvcHkiLCJmYWNlQ291bnQiLCJudW1TaGFkb3dGYWNlcyIsImZhY2UiLCJfY29va2llIiwiX3R5cGUiLCJMSUdIVFRZUEVfU1BPVCIsImFkZCIsIkxJR0hUVFlQRV9PTU5JIiwic21hbGxTaXplIiwieiIsIm9mZnNldCIsImxpZ2h0UmVuZGVyRGF0YSIsImdldFJlbmRlckRhdGEiLCJzaGFkb3dWaWV3cG9ydCIsInNoYWRvd1NjaXNzb3IiLCJhc3NpZ25TbG90Iiwic2xvdEluZGV4Iiwic2xvdFJlYXNzaWduZWQiLCJhdGxhc1ZpZXdwb3J0QWxsb2NhdGVkIiwic2xvdCIsImlkIiwiYXRsYXNTbG90VXBkYXRlZCIsImF0bGFzVmVyc2lvbiIsImF0bGFzU2xvdEluZGV4IiwidXBkYXRlIiwiYXNzaWduQ291bnQiLCJtaW4iLCJfc2hhZG93TWFwIiwicHJldmlvdXNTbG90IiwidXNlZENvdW50Il0sIm1hcHBpbmdzIjoiOzs7Ozs7O0FBU0EsTUFBTUEsVUFBVSxHQUFHLEVBQUUsQ0FBQTtBQUNyQixNQUFNQyxXQUFXLEdBQUcsRUFBRSxDQUFBO0FBQ3RCLE1BQU1DLFNBQVMsR0FBRyxJQUFJQyxJQUFJLEVBQUUsQ0FBQTtBQUM1QixNQUFNQyxRQUFRLEdBQUcsSUFBSUQsSUFBSSxFQUFFLENBQUE7QUFFM0IsTUFBTUUsSUFBSSxDQUFDO0VBQ1BDLFdBQVdBLENBQUNDLElBQUksRUFBRTtBQUNkLElBQUEsSUFBSSxDQUFDQyxJQUFJLEdBQUdDLElBQUksQ0FBQ0MsS0FBSyxDQUFDSCxJQUFJLENBQUNJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUN0QyxJQUFJLENBQUNDLElBQUksR0FBRyxLQUFLLENBQUE7QUFDakIsSUFBQSxJQUFJLENBQUNDLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNsQixJQUFJLENBQUNOLElBQUksR0FBR0EsSUFBSSxDQUFBO0FBQ3BCLEdBQUE7QUFDSixDQUFBOztBQUVBO0FBQ0EsTUFBTU8saUJBQWlCLENBQUM7RUFDcEJSLFdBQVdBLENBQUNTLE1BQU0sRUFBRTtJQUVoQixJQUFJLENBQUNBLE1BQU0sR0FBR0EsTUFBTSxDQUFBO0FBQ3BCLElBQUEsSUFBSSxDQUFDQyxPQUFPLEdBQUcsQ0FBQyxDQUFDOztJQUVqQixJQUFJLENBQUNDLHFCQUFxQixHQUFHLElBQUksQ0FBQTtJQUNqQyxJQUFJLENBQUNDLFdBQVcsR0FBRyxJQUFJLENBQUE7O0FBRXZCO0FBQ0E7SUFDQSxJQUFJLENBQUNDLGdCQUFnQixHQUFHLENB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
