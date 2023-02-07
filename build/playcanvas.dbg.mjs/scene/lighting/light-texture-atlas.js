/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
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
    const shadowBuffer = this.device.webgl2 && isShadowFilterPcf ? rt.depthBuffer : rt.colorBuffer;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGlnaHQtdGV4dHVyZS1hdGxhcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjZW5lL2xpZ2h0aW5nL2xpZ2h0LXRleHR1cmUtYXRsYXMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVmVjMiB9IGZyb20gJy4uLy4uL2NvcmUvbWF0aC92ZWMyLmpzJztcbmltcG9ydCB7IFZlYzQgfSBmcm9tICcuLi8uLi9jb3JlL21hdGgvdmVjNC5qcyc7XG5cbmltcG9ydCB7IFJlbmRlclRhcmdldCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL3JlbmRlci10YXJnZXQuanMnO1xuXG5pbXBvcnQgeyBMSUdIVFRZUEVfT01OSSwgTElHSFRUWVBFX1NQT1QsIFNIQURPV19QQ0YzIH0gZnJvbSAnLi4vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENvb2tpZVJlbmRlcmVyIH0gZnJvbSAnLi4vcmVuZGVyZXIvY29va2llLXJlbmRlcmVyLmpzJztcbmltcG9ydCB7IFNoYWRvd01hcCB9IGZyb20gJy4uL3JlbmRlcmVyL3NoYWRvdy1tYXAuanMnO1xuXG5jb25zdCBfdGVtcEFycmF5ID0gW107XG5jb25zdCBfdGVtcEFycmF5MiA9IFtdO1xuY29uc3QgX3ZpZXdwb3J0ID0gbmV3IFZlYzQoKTtcbmNvbnN0IF9zY2lzc29yID0gbmV3IFZlYzQoKTtcblxuY2xhc3MgU2xvdCB7XG4gICAgY29uc3RydWN0b3IocmVjdCkge1xuICAgICAgICB0aGlzLnNpemUgPSBNYXRoLmZsb29yKHJlY3QudyAqIDEwMjQpOyAgLy8gc2l6ZSBub3JtYWxpemVkIHRvIDEwMjQgYXRsYXNcbiAgICAgICAgdGhpcy51c2VkID0gZmFsc2U7XG4gICAgICAgIHRoaXMubGlnaHRJZCA9IC0xOyAgLy8gaWQgb2YgdGhlIGxpZ2h0IHVzaW5nIHRoZSBzbG90XG4gICAgICAgIHRoaXMucmVjdCA9IHJlY3Q7XG4gICAgfVxufVxuXG4vLyBBIGNsYXNzIGhhbmRsaW5nIHJ1bnRpbWUgYWxsb2NhdGlvbiBvZiBzbG90cyBpbiBhIHRleHR1cmUuIEl0IGlzIHVzZWQgdG8gYWxsb2NhdGUgc2xvdHMgaW4gdGhlIHNoYWRvdyBhbmQgY29va2llIGF0bGFzLlxuY2xhc3MgTGlnaHRUZXh0dXJlQXRsYXMge1xuICAgIGNvbnN0cnVjdG9yKGRldmljZSkge1xuXG4gICAgICAgIHRoaXMuZGV2aWNlID0gZGV2aWNlO1xuICAgICAgICB0aGlzLnZlcnNpb24gPSAxOyAgIC8vIGluY3JlbWVudGVkIGVhY2ggdGltZSBzbG90IGNvbmZpZ3VyYXRpb24gY2hhbmdlc1xuXG4gICAgICAgIHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uID0gMjA0ODtcbiAgICAgICAgdGhpcy5zaGFkb3dBdGxhcyA9IG51bGw7XG5cbiAgICAgICAgLy8gbnVtYmVyIG9mIGFkZGl0aW9uYWwgcGl4ZWxzIHRvIHJlbmRlciBwYXN0IHRoZSByZXF1aXJlZCBzaGFkb3cgY2FtZXJhIGFuZ2xlICg5MGRlZyBmb3Igb21uaSwgb3V0ZXIgZm9yIHNwb3QpIG9mIHRoZSBzaGFkb3cgY2FtZXJhIGZvciBjbHVzdGVyZWQgbGlnaHRzLlxuICAgICAgICAvLyBUaGlzIG5lZWRzIHRvIGJlIGEgcGl4ZWwgbW9yZSB0aGFuIGEgc2hhZG93IGZpbHRlciBuZWVkcyB0byBhY2Nlc3MuXG4gICAgICAgIHRoaXMuc2hhZG93RWRnZVBpeGVscyA9IDM7XG5cbiAgICAgICAgdGhpcy5jb29raWVBdGxhc1Jlc29sdXRpb24gPSAyMDQ4O1xuICAgICAgICB0aGlzLmNvb2tpZUF0bGFzID0gbnVsbDtcbiAgICAgICAgdGhpcy5jb29raWVSZW5kZXJUYXJnZXQgPSBudWxsO1xuXG4gICAgICAgIC8vIGF2YWlsYWJsZSBzbG90cyAob2YgdHlwZSBTbG90KVxuICAgICAgICB0aGlzLnNsb3RzID0gW107XG5cbiAgICAgICAgLy8gY3VycmVudCBzdWJkaXZpc2lvbiBzdHJhdGVneSAtIG1hdGNoZXMgZm9ybWF0IG9mIExpZ2h0aW5nUGFyYW1zLmF0bGFzU3BsaXRcbiAgICAgICAgdGhpcy5hdGxhc1NwbGl0ID0gW107XG5cbiAgICAgICAgLy8gb2Zmc2V0cyB0byBpbmRpdmlkdWFsIGZhY2VzIG9mIGEgY3ViZW1hcCBpbnNpZGUgM3gzIGdyaWQgaW4gYW4gYXRsYXMgc2xvdFxuICAgICAgICB0aGlzLmN1YmVTbG90c09mZnNldHMgPSBbXG4gICAgICAgICAgICBuZXcgVmVjMigwLCAwKSxcbiAgICAgICAgICAgIG5ldyBWZWMyKDAsIDEpLFxuICAgICAgICAgICAgbmV3IFZlYzIoMSwgMCksXG4gICAgICAgICAgICBuZXcgVmVjMigxLCAxKSxcbiAgICAgICAgICAgIG5ldyBWZWMyKDIsIDApLFxuICAgICAgICAgICAgbmV3IFZlYzIoMiwgMSlcbiAgICAgICAgXTtcblxuICAgICAgICAvLyBoYW5kbGVzIGdhcCBiZXR3ZWVuIHNsb3RzXG4gICAgICAgIHRoaXMuc2Npc3NvclZlYyA9IG5ldyBWZWM0KCk7XG5cbiAgICAgICAgdGhpcy5hbGxvY2F0ZVNoYWRvd0F0bGFzKDEpOyAgLy8gcGxhY2Vob2xkZXIgYXMgc2hhZGVyIHJlcXVpcmVzIGl0XG4gICAgICAgIHRoaXMuYWxsb2NhdGVDb29raWVBdGxhcygxKTsgIC8vIHBsYWNlaG9sZGVyIGFzIHNoYWRlciByZXF1aXJlcyBpdFxuICAgICAgICB0aGlzLmFsbG9jYXRlVW5pZm9ybXMoKTtcbiAgICB9XG5cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmRlc3Ryb3lTaGFkb3dBdGxhcygpO1xuICAgICAgICB0aGlzLmRlc3Ryb3lDb29raWVBdGxhcygpO1xuICAgIH1cblxuICAgIGRlc3Ryb3lTaGFkb3dBdGxhcygpIHtcbiAgICAgICAgaWYgKHRoaXMuc2hhZG93QXRsYXMpIHtcbiAgICAgICAgICAgIHRoaXMuc2hhZG93QXRsYXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dBdGxhcyA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBkZXN0cm95Q29va2llQXRsYXMoKSB7XG4gICAgICAgIGlmICh0aGlzLmNvb2tpZUF0bGFzKSB7XG4gICAgICAgICAgICB0aGlzLmNvb2tpZUF0bGFzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuY29va2llQXRsYXMgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmNvb2tpZVJlbmRlclRhcmdldCkge1xuICAgICAgICAgICAgdGhpcy5jb29raWVSZW5kZXJUYXJnZXQuZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5jb29raWVSZW5kZXJUYXJnZXQgPSBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWxsb2NhdGVTaGFkb3dBdGxhcyhyZXNvbHV0aW9uKSB7XG4gICAgICAgIGlmICghdGhpcy5zaGFkb3dBdGxhcyB8fCB0aGlzLnNoYWRvd0F0bGFzLnRleHR1cmUud2lkdGggIT09IHJlc29sdXRpb24pIHtcblxuICAgICAgICAgICAgLy8gY29udGVudCBvZiBhdGxhcyBpcyBsb3N0LCBmb3JjZSByZS1yZW5kZXIgb2Ygc3RhdGljIHNoYWRvd3NcbiAgICAgICAgICAgIHRoaXMudmVyc2lvbisrO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lTaGFkb3dBdGxhcygpO1xuICAgICAgICAgICAgdGhpcy5zaGFkb3dBdGxhcyA9IFNoYWRvd01hcC5jcmVhdGVBdGxhcyh0aGlzLmRldmljZSwgcmVzb2x1dGlvbiwgU0hBRE9XX1BDRjMpO1xuXG4gICAgICAgICAgICAvLyBhdm9pZCBpdCBiZWluZyBkZXN0cm95ZWQgYnkgbGlnaHRzXG4gICAgICAgICAgICB0aGlzLnNoYWRvd0F0bGFzLmNhY2hlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIGxlYXZlIGdhcCBiZXR3ZWVuIGluZGl2aWR1YWwgdGlsZXMgdG8gYXZvaWQgc2hhZG93IC8gY29va2llIHNhbXBsaW5nIG90aGVyIHRpbGVzIChlbm91Z2ggZm9yIFBDRjUpXG4gICAgICAgICAgICAvLyBub3RlIHRoYXQgdGhpcyBvbmx5IGZhZGVzIC8gcmVtb3ZlcyBzaGFkb3dzIG9uIHRoZSBlZGdlcywgd2hpY2ggaXMgc3RpbGwgbm90IGNvcnJlY3QgLSBhIHNoYWRlciBjbGlwcGluZyBpcyBuZWVkZWQ/XG4gICAgICAgICAgICBjb25zdCBzY2lzc29yT2Zmc2V0ID0gNCAvIHRoaXMuc2hhZG93QXRsYXNSZXNvbHV0aW9uO1xuICAgICAgICAgICAgdGhpcy5zY2lzc29yVmVjLnNldChzY2lzc29yT2Zmc2V0LCBzY2lzc29yT2Zmc2V0LCAtMiAqIHNjaXNzb3JPZmZzZXQsIC0yICogc2Npc3Nvck9mZnNldCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhbGxvY2F0ZUNvb2tpZUF0bGFzKHJlc29sdXRpb24pIHtcbiAgICAgICAgaWYgKCF0aGlzLmNvb2tpZUF0bGFzIHx8IHRoaXMuY29va2llQXRsYXMud2lkdGggIT09IHJlc29sdXRpb24pIHtcblxuICAgICAgICAgICAgLy8gY29udGVudCBvZiBhdGxhcyBpcyBsb3N0LCBmb3JjZSByZS1yZW5kZXIgb2Ygc3RhdGljIGNvb2tpZXNcbiAgICAgICAgICAgIHRoaXMudmVyc2lvbisrO1xuXG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3lDb29raWVBdGxhcygpO1xuICAgICAgICAgICAgdGhpcy5jb29raWVBdGxhcyA9IENvb2tpZVJlbmRlcmVyLmNyZWF0ZVRleHR1cmUodGhpcy5kZXZpY2UsIHJlc29sdXRpb24pO1xuXG4gICAgICAgICAgICB0aGlzLmNvb2tpZVJlbmRlclRhcmdldCA9IG5ldyBSZW5kZXJUYXJnZXQoe1xuICAgICAgICAgICAgICAgIGNvbG9yQnVmZmVyOiB0aGlzLmNvb2tpZUF0bGFzLFxuICAgICAgICAgICAgICAgIGRlcHRoOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBmbGlwWTogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBhbGxvY2F0ZVVuaWZvcm1zKCkge1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1RleHR1cmVJZCA9IHRoaXMuZGV2aWNlLnNjb3BlLnJlc29sdmUoJ3NoYWRvd0F0bGFzVGV4dHVyZScpO1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1BhcmFtc0lkID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnc2hhZG93QXRsYXNQYXJhbXMnKTtcbiAgICAgICAgdGhpcy5fc2hhZG93QXRsYXNQYXJhbXMgPSBuZXcgRmxvYXQzMkFycmF5KDIpO1xuXG4gICAgICAgIHRoaXMuX2Nvb2tpZUF0bGFzVGV4dHVyZUlkID0gdGhpcy5kZXZpY2Uuc2NvcGUucmVzb2x2ZSgnY29va2llQXRsYXNUZXh0dXJlJyk7XG4gICAgfVxuXG4gICAgdXBkYXRlVW5pZm9ybXMoKSB7XG5cbiAgICAgICAgLy8gc2hhZG93IGF0bGFzIHRleHR1cmVcbiAgICAgICAgY29uc3QgaXNTaGFkb3dGaWx0ZXJQY2YgPSB0cnVlO1xuICAgICAgICBjb25zdCBydCA9IHRoaXMuc2hhZG93QXRsYXMucmVuZGVyVGFyZ2V0c1swXTtcbiAgICAgICAgY29uc3Qgc2hhZG93QnVmZmVyID0gKHRoaXMuZGV2aWNlLndlYmdsMiAmJiBpc1NoYWRvd0ZpbHRlclBjZikgPyBydC5kZXB0aEJ1ZmZlciA6IHJ0LmNvbG9yQnVmZmVyO1xuICAgICAgICB0aGlzLl9zaGFkb3dBdGxhc1RleHR1cmVJZC5zZXRWYWx1ZShzaGFkb3dCdWZmZXIpO1xuXG4gICAgICAgIC8vIHNoYWRvdyBhdGxhcyBwYXJhbXNcbiAgICAgICAgdGhpcy5fc2hhZG93QXRsYXNQYXJhbXNbMF0gPSB0aGlzLnNoYWRvd0F0bGFzUmVzb2x1dGlvbjtcbiAgICAgICAgdGhpcy5fc2hhZG93QXRsYXNQYXJhbXNbMV0gPSB0aGlzLnNoYWRvd0VkZ2VQaXhlbHM7XG4gICAgICAgIHRoaXMuX3NoYWRvd0F0bGFzUGFyYW1zSWQuc2V0VmFsdWUodGhpcy5fc2hhZG93QXRsYXNQYXJhbXMpO1xuXG4gICAgICAgIC8vIGNvb2tpZSBhdGxhcyB0ZXh0dXJlc1xuICAgICAgICB0aGlzLl9jb29raWVBdGxhc1RleHR1cmVJZC5zZXRWYWx1ZSh0aGlzLmNvb2tpZUF0bGFzKTtcbiAgICB9XG5cbiAgICBzdWJkaXZpZGUobnVtTGlnaHRzLCBsaWdodGluZ1BhcmFtcykge1xuXG4gICAgICAgIGxldCBhdGxhc1NwbGl0ID0gbGlnaHRpbmdQYXJhbXMuYXRsYXNTcGxpdDtcblxuICAgICAgICAvLyBpZiBubyB1c2VyIHNwZWNpZmllZCBzdWJkaXZpc2lvblxuICAgICAgICBpZiAoIWF0bGFzU3BsaXQpIHtcblxuICAgICAgICAgICAgLy8gc3BsaXQgdG8gZXF1YWwgbnVtYmVyIG9mIHNxdWFyZXNcbiAgICAgICAgICAgIGNvbnN0IGdyaWRTaXplID0gTWF0aC5jZWlsKE1hdGguc3FydChudW1MaWdodHMpKTtcbiAgICAgICAgICAgIGF0bGFzU3BsaXQgPSBfdGVtcEFycmF5MjtcbiAgICAgICAgICAgIGF0bGFzU3BsaXRbMF0gPSBncmlkU2l6ZTtcbiAgICAgICAgICAgIGF0bGFzU3BsaXQubGVuZ3RoID0gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNvbXBhcmUgdHdvIGFycmF5c1xuICAgICAgICBjb25zdCBhcnJheXNFcXVhbCA9IChhLCBiKSA9PiBhLmxlbmd0aCA9PT0gYi5sZW5ndGggJiYgYS5ldmVyeSgodiwgaSkgPT4gdiA9PT0gYltpXSk7XG5cbiAgICAgICAgLy8gaWYgdGhlIHNwbGl0IGhhcyBjaGFuZ2VkLCByZWdlbmVyYXRlIHNsb3RzXG4gICAgICAgIGlmICghYXJyYXlzRXF1YWwoYXRsYXNTcGxpdCwgdGhpcy5hdGxhc1NwbGl0KSkge1xuXG4gICAgICAgICAgICB0aGlzLnZlcnNpb24rKztcbiAgICAgICAgICAgIHRoaXMuc2xvdHMubGVuZ3RoID0gMDtcblxuICAgICAgICAgICAgLy8gc3RvcmUgY3VycmVudCBzZXR0aW5nc1xuICAgICAgICAgICAgdGhpcy5hdGxhc1NwbGl0Lmxlbmd0aCA9IDA7XG4gICAgICAgICAgICB0aGlzLmF0bGFzU3BsaXQucHVzaCguLi5hdGxhc1NwbGl0KTtcblxuICAgICAgICAgICAgLy8gZ2VuZXJhdGUgdG9wIGxldmVsIHNwbGl0XG4gICAgICAgICAgICBjb25zdCBzcGxpdENvdW50ID0gdGhpcy5hdGxhc1NwbGl0WzBdO1xuICAgICAgICAgICAgaWYgKHNwbGl0Q291bnQgPiAxKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW52U2l6ZSA9IDEgLyBzcGxpdENvdW50O1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3BsaXRDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgc3BsaXRDb3VudDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZWN0ID0gbmV3IFZlYzQoaSAqIGludlNpemUsIGogKiBpbnZTaXplLCBpbnZTaXplLCBpbnZTaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG5leHRMZXZlbFNwbGl0ID0gdGhpcy5hdGxhc1NwbGl0WzEgKyBpICogc3BsaXRDb3VudCArIGpdO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiBuZWVkIHRvIHNwbGl0IGFnYWluXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobmV4dExldmVsU3BsaXQgPiAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCBuZXh0TGV2ZWxTcGxpdDsgeCsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IHkgPSAwOyB5IDwgbmV4dExldmVsU3BsaXQ7IHkrKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW52U2l6ZU5leHQgPSBpbnZTaXplIC8gbmV4dExldmVsU3BsaXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZWN0TmV4dCA9IG5ldyBWZWM0KHJlY3QueCArIHggKiBpbnZTaXplTmV4dCwgcmVjdC55ICsgeSAqIGludlNpemVOZXh0LCBpbnZTaXplTmV4dCwgaW52U2l6ZU5leHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zbG90cy5wdXNoKG5ldyBTbG90KHJlY3ROZXh0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2xvdHMucHVzaChuZXcgU2xvdChyZWN0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIHNpbmdsZSBzbG90XG4gICAgICAgICAgICAgICAgdGhpcy5zbG90cy5wdXNoKG5ldyBTbG90KG5ldyBWZWM0KDAsIDAsIDEsIDEpKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHNvcnQgc2xvdHMgZGVzY2VuZGluZ1xuICAgICAgICAgICAgdGhpcy5zbG90cy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGIuc2l6ZSAtIGEuc2l6ZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29sbGVjdExpZ2h0cyhzcG90TGlnaHRzLCBvbW5pTGlnaHRzLCBsaWdodGluZ1BhcmFtcykge1xuXG4gICAgICAgIGNvbnN0IGNvb2tpZXNFbmFibGVkID0gbGlnaHRpbmdQYXJhbXMuY29va2llc0VuYWJsZWQ7XG4gICAgICAgIGNvbnN0IHNoYWRvd3NFbmFibGVkID0gbGlnaHRpbmdQYXJhbXMuc2hhZG93c0VuYWJsZWQ7XG5cbiAgICAgICAgLy8gZ2V0IGFsbCBsaWdodHMgdGhhdCBuZWVkIHNoYWRvd3Mgb3IgY29va2llcywgaWYgdGhvc2UgYXJlIGVuYWJsZWRcbiAgICAgICAgbGV0IG5lZWRzU2hhZG93QXRsYXMgPSBmYWxzZTtcbiAgICAgICAgbGV0IG5lZWRzQ29va2llQXRsYXMgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgbGlnaHRzID0gX3RlbXBBcnJheTtcbiAgICAgICAgbGlnaHRzLmxlbmd0aCA9IDA7XG5cbiAgICAgICAgY29uc3QgcHJvY2Vzc0xpZ2h0cyA9IChsaXN0KSA9PiB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpc3RbaV07XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LnZpc2libGVUaGlzRnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRTaGFkb3cgPSBzaGFkb3dzRW5hYmxlZCAmJiBsaWdodC5jYXN0U2hhZG93cztcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRDb29raWUgPSBjb29raWVzRW5hYmxlZCAmJiAhIWxpZ2h0LmNvb2tpZTtcblxuICAgICAgICAgICAgICAgICAgICBuZWVkc1NoYWRvd0F0bGFzIHx8PSBsaWdodFNoYWRvdztcbiAgICAgICAgICAgICAgICAgICAgbmVlZHNDb29raWVBdGxhcyB8fD0gbGlnaHRDb29raWU7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGxpZ2h0U2hhZG93IHx8IGxpZ2h0Q29va2llKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaWdodHMucHVzaChsaWdodCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGNvb2tpZXNFbmFibGVkIHx8IHNoYWRvd3NFbmFibGVkKSB7XG4gICAgICAgICAgICBwcm9jZXNzTGlnaHRzKHNwb3RMaWdodHMpO1xuICAgICAgICAgICAgcHJvY2Vzc0xpZ2h0cyhvbW5pTGlnaHRzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNvcnQgbGlnaHRzIGJ5IG1heFNjcmVlblNpemUgLSB0byBoYXZlIHRoZW0gb3JkZXJlZCBieSBhdGxhcyBzbG90IHNpemVcbiAgICAgICAgbGlnaHRzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBiLm1heFNjcmVlblNpemUgLSBhLm1heFNjcmVlblNpemU7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChuZWVkc1NoYWRvd0F0bGFzKSB7XG4gICAgICAgICAgICB0aGlzLmFsbG9jYXRlU2hhZG93QXRsYXModGhpcy5zaGFkb3dBdGxhc1Jlc29sdXRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5lZWRzQ29va2llQXRsYXMpIHtcbiAgICAgICAgICAgIHRoaXMuYWxsb2NhdGVDb29raWVBdGxhcyh0aGlzLmNvb2tpZUF0bGFzUmVzb2x1dGlvbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobmVlZHNTaGFkb3dBdGxhcyB8fCBuZWVkc0Nvb2tpZUF0bGFzKSB7XG4gICAgICAgICAgICB0aGlzLnN1YmRpdmlkZShsaWdodHMubGVuZ3RoLCBsaWdodGluZ1BhcmFtcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbGlnaHRzO1xuICAgIH1cblxuICAgIC8vIGNvbmZpZ3VyZSBsaWdodCB0byB1c2UgYXNzaWduZWQgc2xvdFxuICAgIHNldHVwU2xvdChsaWdodCwgcmVjdCkge1xuXG4gICAgICAgIGxpZ2h0LmF0bGFzVmlld3BvcnQuY29weShyZWN0KTtcblxuICAgICAgICBjb25zdCBmYWNlQ291bnQgPSBsaWdodC5udW1TaGFkb3dGYWNlcztcbiAgICAgICAgZm9yIChsZXQgZmFjZSA9IDA7IGZhY2UgPCBmYWNlQ291bnQ7IGZhY2UrKykge1xuXG4gICAgICAgICAgICAvLyBzZXR1cCBzbG90IGZvciBzaGFkb3cgYW5kIGNvb2tpZVxuICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzIHx8IGxpZ2h0Ll9jb29raWUpIHtcblxuICAgICAgICAgICAgICAgIF92aWV3cG9ydC5jb3B5KHJlY3QpO1xuICAgICAgICAgICAgICAgIF9zY2lzc29yLmNvcHkocmVjdCk7XG5cbiAgICAgICAgICAgICAgICAvLyBmb3Igc3BvdCBsaWdodHMgaW4gdGhlIGF0bGFzLCBtYWtlIHZpZXdwb3J0IHNsaWdodGx5IHNtYWxsZXIgdG8gYXZvaWQgc2FtcGxpbmcgcGFzdCB0aGUgZWRnZXNcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9TUE9UKSB7XG4gICAgICAgICAgICAgICAgICAgIF92aWV3cG9ydC5hZGQodGhpcy5zY2lzc29yVmVjKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBmb3IgY3ViZSBtYXAsIGFsbG9jYXRlIHBhcnQgb2YgdGhlIHNsb3RcbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuX3R5cGUgPT09IExJR0hUVFlQRV9PTU5JKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc21hbGxTaXplID0gX3ZpZXdwb3J0LnogLyAzO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBvZmZzZXQgPSB0aGlzLmN1YmVTbG90c09mZnNldHNbZmFjZV07XG4gICAgICAgICAgICAgICAgICAgIF92aWV3cG9ydC54ICs9IHNtYWxsU2l6ZSAqIG9mZnNldC54O1xuICAgICAgICAgICAgICAgICAgICBfdmlld3BvcnQueSArPSBzbWFsbFNpemUgKiBvZmZzZXQueTtcbiAgICAgICAgICAgICAgICAgICAgX3ZpZXdwb3J0LnogPSBzbWFsbFNpemU7XG4gICAgICAgICAgICAgICAgICAgIF92aWV3cG9ydC53ID0gc21hbGxTaXplO1xuXG4gICAgICAgICAgICAgICAgICAgIF9zY2lzc29yLmNvcHkoX3ZpZXdwb3J0KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobGlnaHQuY2FzdFNoYWRvd3MpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGlnaHRSZW5kZXJEYXRhID0gbGlnaHQuZ2V0UmVuZGVyRGF0YShudWxsLCBmYWNlKTtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1ZpZXdwb3J0LmNvcHkoX3ZpZXdwb3J0KTtcbiAgICAgICAgICAgICAgICAgICAgbGlnaHRSZW5kZXJEYXRhLnNoYWRvd1NjaXNzb3IuY29weShfc2Npc3Nvcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYXNzaWduIGEgc2xvdCB0byB0aGUgbGlnaHRcbiAgICBhc3NpZ25TbG90KGxpZ2h0LCBzbG90SW5kZXgsIHNsb3RSZWFzc2lnbmVkKSB7XG5cbiAgICAgICAgbGlnaHQuYXRsYXNWaWV3cG9ydEFsbG9jYXRlZCA9IHRydWU7XG5cbiAgICAgICAgY29uc3Qgc2xvdCA9IHRoaXMuc2xvdHNbc2xvdEluZGV4XTtcbiAgICAgICAgc2xvdC5saWdodElkID0gbGlnaHQuaWQ7XG4gICAgICAgIHNsb3QudXNlZCA9IHRydWU7XG5cbiAgICAgICAgLy8gc2xvdCBpcyByZWFzc2lnbmVkIChjb250ZW50IG5lZWRzIHRvIGJlIHVwZGF0ZWQpXG4gICAgICAgIGlmIChzbG90UmVhc3NpZ25lZCkge1xuICAgICAgICAgICAgbGlnaHQuYXRsYXNTbG90VXBkYXRlZCA9IHRydWU7XG4gICAgICAgICAgICBsaWdodC5hdGxhc1ZlcnNpb24gPSB0aGlzLnZlcnNpb247XG4gICAgICAgICAgICBsaWdodC5hdGxhc1Nsb3RJbmRleCA9IHNsb3RJbmRleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIHVwZGF0ZSB0ZXh0dXJlIGF0bGFzIGZvciBhIGxpc3Qgb2YgbGlnaHRzXG4gICAgdXBkYXRlKHNwb3RMaWdodHMsIG9tbmlMaWdodHMsIGxpZ2h0aW5nUGFyYW1zKSB7XG5cbiAgICAgICAgLy8gdXBkYXRlIHRleHR1cmUgcmVzb2x1dGlvbnNcbiAgICAgICAgdGhpcy5zaGFkb3dBdGxhc1Jlc29sdXRpb24gPSBsaWdodGluZ1BhcmFtcy5zaGFkb3dBdGxhc1Jlc29sdXRpb247XG4gICAgICAgIHRoaXMuY29va2llQXRsYXNSZXNvbHV0aW9uID0gbGlnaHRpbmdQYXJhbXMuY29va2llQXRsYXNSZXNvbHV0aW9uO1xuXG4gICAgICAgIC8vIGNvbGxlY3QgbGlnaHRzIHJlcXVpcmluZyBhdGxhc1xuICAgICAgICBjb25zdCBsaWdodHMgPSB0aGlzLmNvbGxlY3RMaWdodHMoc3BvdExpZ2h0cywgb21uaUxpZ2h0cywgbGlnaHRpbmdQYXJhbXMpO1xuICAgICAgICBpZiAobGlnaHRzLmxlbmd0aCA+IDApIHtcblxuICAgICAgICAgICAgLy8gbWFyayBhbGwgc2xvdHMgYXMgdW51c2VkXG4gICAgICAgICAgICBjb25zdCBzbG90cyA9IHRoaXMuc2xvdHM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNsb3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgc2xvdHNbaV0udXNlZCA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBhc3NpZ24gc2xvdHMgdG8gbGlnaHRzXG4gICAgICAgICAgICAvLyBUaGUgc2xvdCB0byBsaWdodCBhc3NpZ25tZW50IGxvZ2ljOlxuICAgICAgICAgICAgLy8gLSBpbnRlcm5hbGx5IHRoZSBhdGxhcyBzbG90cyBhcmUgc29ydGVkIGluIHRoZSBkZXNjZW5kaW5nIG9yZGVyIChkb25lIHdoZW4gYXRsYXMgc3BsaXQgY2hhbmdlcylcbiAgICAgICAgICAgIC8vIC0gZXZlcnkgZnJhbWUgYWxsIHZpc2libGUgbGlnaHRzIGFyZSBzb3J0ZWQgYnkgdGhlaXIgc2NyZWVuIHNwYWNlIHNpemUgKHRoaXMgaGFuZGxlcyBhbGwgY2FtZXJhcyB3aGVyZSBsaWdodHNcbiAgICAgICAgICAgIC8vICAgYXJlIHZpc2libGUgdXNpbmcgbWF4IHZhbHVlKVxuICAgICAgICAgICAgLy8gLSBhbGwgbGlnaHRzIGluIHRoaXMgb3JkZXIgZ2V0IGEgc2xvdCBzaXplIGZyb20gdGhlIHNsb3QgbGlzdCBpbiB0aGUgc2FtZSBvcmRlci4gQ2FyZSBpcyB0YWtlbiB0byBub3QgcmVhc3NpZ25cbiAgICAgICAgICAgIC8vICAgc2xvdCBpZiB0aGUgc2l6ZSBvZiBpdCBpcyB0aGUgc2FtZSBhbmQgb25seSBpbmRleCBjaGFuZ2VzIC0gdGhpcyBpcyBkb25lIHVzaW5nIHR3byBwYXNzIGFzc2lnbm1lbnRcbiAgICAgICAgICAgIGNvbnN0IGFzc2lnbkNvdW50ID0gTWF0aC5taW4obGlnaHRzLmxlbmd0aCwgc2xvdHMubGVuZ3RoKTtcblxuICAgICAgICAgICAgLy8gZmlyc3QgcGFzcyAtIHByZXNlcnZlIGFsbG9jYXRlZCBzbG90cyBmb3IgbGlnaHRzIHJlcXVpcmluZyBzbG90IG9mIHRoZSBzYW1lIHNpemVcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXNzaWduQ291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbGlnaHRzW2ldO1xuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0LmNhc3RTaGFkb3dzKVxuICAgICAgICAgICAgICAgICAgICBsaWdodC5fc2hhZG93TWFwID0gdGhpcy5zaGFkb3dBdGxhcztcblxuICAgICAgICAgICAgICAgIC8vIGlmIGN1cnJlbnRseSBhc3NpZ25lZCBzbG90IGlzIHRoZSBzYW1lIHNpemUgYXMgd2hhdCBpcyBuZWVkZWQsIGFuZCB3YXMgbGFzdCB1c2VkIGJ5IHRoaXMgbGlnaHQsIHJldXNlIGl0XG4gICAgICAgICAgICAgICAgY29uc3QgcHJldmlvdXNTbG90ID0gc2xvdHNbbGlnaHQuYXRsYXNTbG90SW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodC5hdGxhc1ZlcnNpb24gPT09IHRoaXMudmVyc2lvbiAmJiBsaWdodC5pZCA9PT0gcHJldmlvdXNTbG90Py5saWdodElkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZXZpb3VzU2xvdCA9IHNsb3RzW2xpZ2h0LmF0bGFzU2xvdEluZGV4XTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHByZXZpb3VzU2xvdC5zaXplID09PSBzbG90c1tpXS5zaXplICYmICFwcmV2aW91c1Nsb3QudXNlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hc3NpZ25TbG90KGxpZ2h0LCBsaWdodC5hdGxhc1Nsb3RJbmRleCwgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzZWNvbmQgcGFzcyAtIGFzc2lnbiBzbG90cyB0byB1bmhhbmRsZWQgbGlnaHRzXG4gICAgICAgICAgICBsZXQgdXNlZENvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXNzaWduQ291bnQ7IGkrKykge1xuXG4gICAgICAgICAgICAgICAgLy8gc2tpcCBhbHJlYWR5IHVzZWQgc2xvdHNcbiAgICAgICAgICAgICAgICB3aGlsZSAodXNlZENvdW50IDwgc2xvdHMubGVuZ3RoICYmIHNsb3RzW3VzZWRDb3VudF0udXNlZClcbiAgICAgICAgICAgICAgICAgICAgdXNlZENvdW50Kys7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IGxpZ2h0c1tpXTtcbiAgICAgICAgICAgICAgICBpZiAoIWxpZ2h0LmF0bGFzVmlld3BvcnRBbGxvY2F0ZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hc3NpZ25TbG90KGxpZ2h0LCB1c2VkQ291bnQsIHRydWUpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIHNldCB1cCBhbGwgc2xvdHNcbiAgICAgICAgICAgICAgICBjb25zdCBzbG90ID0gc2xvdHNbbGlnaHQuYXRsYXNTbG90SW5kZXhdO1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0dXBTbG90KGxpZ2h0LCBzbG90LnJlY3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy51cGRhdGVVbmlmb3JtcygpO1xuICAgIH1cbn1cblxuZXhwb3J0IHsgTGlnaHRUZXh0dXJlQXRsYXMgfTtcbiJdLCJuYW1lcyI6WyJfdGVtcEFycmF5IiwiX3RlbXBBcnJheTIiLCJfdmlld3BvcnQiLCJWZWM0IiwiX3NjaXNzb3IiLCJTbG90IiwiY29uc3RydWN0b3IiLCJyZWN0Iiwic2l6ZSIsIk1hdGgiLCJmbG9vciIsInciLCJ1c2VkIiwibGlnaHRJZCIsIkxpZ2h0VGV4dHVyZUF0bGFzIiwiZGV2aWNlIiwidmVyc2lvbiIsInNoYWRvd0F0bGFzUmVzb2x1dGlvbiIsInNoYWRvd0F0bGFzIiwic2hhZG93RWRnZVBpeGVscyIsImNvb2tpZUF0bGFzUmVzb2x1dGlvbiIsImNvb2tpZUF0bGFzIiwiY29va2llUmVuZGVyVGFyZ2V0Iiwic2xvdHMiLCJhdGxhc1NwbGl0IiwiY3ViZVNsb3RzT2Zmc2V0cyIsIlZlYzIiLCJzY2lzc29yVmVjIiwiYWxsb2NhdGVTaGFkb3dBdGxhcyIsImFsbG9jYXRlQ29va2llQXRsYXMiLCJhbGxvY2F0ZVVuaWZvcm1zIiwiZGVzdHJveSIsImRlc3Ryb3lTaGFkb3dBdGxhcyIsImRlc3Ryb3lDb29raWVBdGxhcyIsInJlc29sdXRpb24iLCJ0ZXh0dXJlIiwid2lkdGgiLCJTaGFkb3dNYXAiLCJjcmVhdGVBdGxhcyIsIlNIQURPV19QQ0YzIiwiY2FjaGVkIiwic2Npc3Nvck9mZnNldCIsInNldCIsIkNvb2tpZVJlbmRlcmVyIiwiY3JlYXRlVGV4dHVyZSIsIlJlbmRlclRhcmdldCIsImNvbG9yQnVmZmVyIiwiZGVwdGgiLCJmbGlwWSIsIl9zaGFkb3dBdGxhc1RleHR1cmVJZCIsInNjb3BlIiwicmVzb2x2ZSIsIl9zaGFkb3dBdGxhc1BhcmFtc0lkIiwiX3NoYWRvd0F0bGFzUGFyYW1zIiwiRmxvYXQzMkFycmF5IiwiX2Nvb2tpZUF0bGFzVGV4dHVyZUlkIiwidXBkYXRlVW5pZm9ybXMiLCJpc1NoYWRvd0ZpbHRlclBjZiIsInJ0IiwicmVuZGVyVGFyZ2V0cyIsInNoYWRvd0J1ZmZlciIsIndlYmdsMiIsImRlcHRoQnVmZmVyIiwic2V0VmFsdWUiLCJzdWJkaXZpZGUiLCJudW1MaWdodHMiLCJsaWdodGluZ1BhcmFtcyIsImdyaWRTaXplIiwiY2VpbCIsInNxcnQiLCJsZW5ndGgiLCJhcnJheXNFcXVhbCIsImEiLCJiIiwiZXZlcnkiLCJ2IiwiaSIsInB1c2giLCJzcGxpdENvdW50IiwiaW52U2l6ZSIsImoiLCJuZXh0TGV2ZWxTcGxpdCIsIngiLCJ5IiwiaW52U2l6ZU5leHQiLCJyZWN0TmV4dCIsInNvcnQiLCJjb2xsZWN0TGlnaHRzIiwic3BvdExpZ2h0cyIsIm9tbmlMaWdodHMiLCJjb29raWVzRW5hYmxlZCIsInNoYWRvd3NFbmFibGVkIiwibmVlZHNTaGFkb3dBdGxhcyIsIm5lZWRzQ29va2llQXRsYXMiLCJsaWdodHMiLCJwcm9jZXNzTGlnaHRzIiwibGlzdCIsImxpZ2h0IiwidmlzaWJsZVRoaXNGcmFtZSIsImxpZ2h0U2hhZG93IiwiY2FzdFNoYWRvd3MiLCJsaWdodENvb2tpZSIsImNvb2tpZSIsIm1heFNjcmVlblNpemUiLCJzZXR1cFNsb3QiLCJhdGxhc1ZpZXdwb3J0IiwiY29weSIsImZhY2VDb3VudCIsIm51bVNoYWRvd0ZhY2VzIiwiZmFjZSIsIl9jb29raWUiLCJfdHlwZSIsIkxJR0hUVFlQRV9TUE9UIiwiYWRkIiwiTElHSFRUWVBFX09NTkkiLCJzbWFsbFNpemUiLCJ6Iiwib2Zmc2V0IiwibGlnaHRSZW5kZXJEYXRhIiwiZ2V0UmVuZGVyRGF0YSIsInNoYWRvd1ZpZXdwb3J0Iiwic2hhZG93U2Npc3NvciIsImFzc2lnblNsb3QiLCJzbG90SW5kZXgiLCJzbG90UmVhc3NpZ25lZCIsImF0bGFzVmlld3BvcnRBbGxvY2F0ZWQiLCJzbG90IiwiaWQiLCJhdGxhc1Nsb3RVcGRhdGVkIiwiYXRsYXNWZXJzaW9uIiwiYXRsYXNTbG90SW5kZXgiLCJ1cGRhdGUiLCJhc3NpZ25Db3VudCIsIm1pbiIsIl9zaGFkb3dNYXAiLCJwcmV2aW91c1Nsb3QiLCJ1c2VkQ291bnQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQVNBLE1BQU1BLFVBQVUsR0FBRyxFQUFFLENBQUE7QUFDckIsTUFBTUMsV0FBVyxHQUFHLEVBQUUsQ0FBQTtBQUN0QixNQUFNQyxTQUFTLEdBQUcsSUFBSUMsSUFBSSxFQUFFLENBQUE7QUFDNUIsTUFBTUMsUUFBUSxHQUFHLElBQUlELElBQUksRUFBRSxDQUFBO0FBRTNCLE1BQU1FLElBQUksQ0FBQztFQUNQQyxXQUFXLENBQUNDLElBQUksRUFBRTtBQUNkLElBQUEsSUFBSSxDQUFDQyxJQUFJLEdBQUdDLElBQUksQ0FBQ0MsS0FBSyxDQUFDSCxJQUFJLENBQUNJLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUN0QyxJQUFJLENBQUNDLElBQUksR0FBRyxLQUFLLENBQUE7QUFDakIsSUFBQSxJQUFJLENBQUNDLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNsQixJQUFJLENBQUNOLElBQUksR0FBR0EsSUFBSSxDQUFBO0FBQ3BCLEdBQUE7QUFDSixDQUFBOztBQUVBO0FBQ0EsTUFBTU8saUJBQWlCLENBQUM7RUFDcEJSLFdBQVcsQ0FBQ1MsTUFBTSxFQUFFO0lBRWhCLElBQUksQ0FBQ0EsTUFBTSxHQUFHQSxNQUFNLENBQUE7QUFDcEIsSUFBQSxJQUFJLENBQUNDLE9BQU8sR0FBRyxDQUFDLENBQUM7O0lBRWpCLElBQUksQ0FBQ0MscUJBQXFCLEdBQUcsSUFBSSxDQUFBO0lBQ2pDLElBQUksQ0FBQ0MsV0FBVyxHQUFHLElBQUksQ0FBQTs7QUFFdkI7QUFDQTtJQUNBLElBQUksQ0FBQ0MsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFBO0lBRXpCLElBQUksQ0FBQ0MscUJBQXFCLEdBQUcsSUFBSSxDQUFBO0lBQ2pDLElBQUksQ0FBQ0MsV0FBVyxHQUFHLElBQUksQ0FBQTtJQUN2QixJQUFJ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
