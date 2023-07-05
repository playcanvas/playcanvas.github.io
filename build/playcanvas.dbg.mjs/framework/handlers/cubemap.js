import { ADDRESS_CLAMP_TO_EDGE, TEXTURETYPE_RGBP, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, TEXTURETYPE_RGBM, TEXTURETYPE_DEFAULT } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { Asset } from '../asset/asset.js';

/** @typedef {import('./handler.js').ResourceHandler} ResourceHandler */

/**
 * Resource handler used for loading cubemap {@link Texture} resources.
 *
 * @implements {ResourceHandler}
 */
class CubemapHandler {
  /**
   * Create a new CubemapHandler instance.
   *
   * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
   * @hideconstructor
   */
  constructor(app) {
    /**
     * Type of the resource the handler handles.
     *
     * @type {string}
     */
    this.handlerType = "cubemap";
    this._device = app.graphicsDevice;
    this._registry = app.assets;
    this._loader = app.loader;
  }
  load(url, callback, asset) {
    this.loadAssets(asset, callback);
  }
  open(url, data, asset) {
    // caller will set our return value to asset.resources[0]. We've already set resources[0],
    // but we must return it again here so it doesn't get overwritten.
    return asset ? asset.resource : null;
  }
  patch(asset, registry) {
    this.loadAssets(asset, function (err, result) {
      if (err) {
        // fire error event if patch failed
        registry.fire('error', asset);
        registry.fire('error:' + asset.id, err, asset);
        asset.fire('error', asset);
      }
      // nothing to do since asset:change would have been raised if
      // resources were changed.
    });
  }

  // get the list of dependent asset ids for the cubemap
  getAssetIds(cubemapAsset) {
    const result = [];

    // prefiltered cubemap is stored at index 0
    result[0] = cubemapAsset.file;

    // faces are stored at index 1..6
    if ((cubemapAsset.loadFaces || !cubemapAsset.file) && cubemapAsset.data && cubemapAsset.data.textures) {
      for (let i = 0; i < 6; ++i) {
        result[i + 1] = cubemapAsset.data.textures[i];
      }
    } else {
      result[1] = result[2] = result[3] = result[4] = result[5] = result[6] = null;
    }
    return result;
  }

  // test whether two assets ids are the same
  compareAssetIds(assetIdA, assetIdB) {
    if (assetIdA && assetIdB) {
      if (parseInt(assetIdA, 10) === assetIdA || typeof assetIdA === 'string') {
        return assetIdA === assetIdB; // id or url
      }
      // else {
      return assetIdA.url === assetIdB.url; // file/url structure with url and filename
    }
    // else {
    return assetIdA !== null === (assetIdB !== null);
  }

  // update the cubemap resources given a newly loaded set of assets with their corresponding ids
  update(cubemapAsset, assetIds, assets) {
    const assetData = cubemapAsset.data || {};
    const oldAssets = cubemapAsset._handlerState.assets;
    const oldResources = cubemapAsset._resources;
    let tex, mip, i;

    // faces, prelit cubemap 128, 64, 32, 16, 8, 4
    const resources = [null, null, null, null, null, null, null];

    // texture type used for faces and prelit cubemaps are both taken from
    // cubemap.data.rgbm
    const getType = function getType() {
      if (assetData.hasOwnProperty('type')) {
        return assetData.type;
      }
      if (assetData.hasOwnProperty('rgbm')) {
        return assetData.rgbm ? TEXTURETYPE_RGBM : TEXTURETYPE_DEFAULT;
      }
      return null;
    };

    // handle the prelit data
    if (!cubemapAsset.loaded || assets[0] !== oldAssets[0]) {
      // prelit asset changed
      if (assets[0]) {
        tex = assets[0].resource;
        if (tex.cubemap) {
          for (i = 0; i < 6; ++i) {
            resources[i + 1] = new Texture(this._device, {
              name: cubemapAsset.name + '_prelitCubemap' + (tex.width >> i),
              cubemap: true,
              // assume prefiltered data has same encoding as the faces asset
              type: getType() || tex.type,
              width: tex.width >> i,
              height: tex.height >> i,
              format: tex.format,
              levels: [tex._levels[i]],
              fixCubemapSeams: true,
              addressU: ADDRESS_CLAMP_TO_EDGE,
              addressV: ADDRESS_CLAMP_TO_EDGE,
              // generate cubemaps on the top level only
              mipmaps: i === 0
            });
          }
        } else {
          // prefiltered data is an env atlas
          tex.type = TEXTURETYPE_RGBP;
          resources[1] = tex;
        }
      }
    } else {
      // prelit asset didn't change so keep the existing cubemap resources
      resources[1] = oldResources[1] || null;
      resources[2] = oldResources[2] || null;
      resources[3] = oldResources[3] || null;
      resources[4] = oldResources[4] || null;
      resources[5] = oldResources[5] || null;
      resources[6] = oldResources[6] || null;
    }
    const faceAssets = assets.slice(1);
    if (!cubemapAsset.loaded || !this.cmpArrays(faceAssets, oldAssets.slice(1))) {
      // face assets have changed
      if (faceAssets.indexOf(null) === -1) {
        var _assetData$mipmaps;
        // extract cubemap level data from face textures
        const faceTextures = faceAssets.map(function (asset) {
          return asset.resource;
        });
        const faceLevels = [];
        for (mip = 0; mip < faceTextures[0]._levels.length; ++mip) {
          faceLevels.push(faceTextures.map(function (faceTexture) {
            // eslint-disable-line no-loop-func
            return faceTexture._levels[mip];
          }));
        }

        // Force RGBA8 if we are loading a RGB8 texture due to a bug on M1 Macs Monterey and Chrome not
        // rendering the face on right of the cubemap (`faceAssets[0]` and `resources[1]`).
        // Using a RGBA8 texture works around the issue https://github.com/playcanvas/engine/issues/4091
        const format = faceTextures[0].format;
        const faces = new Texture(this._device, {
          name: cubemapAsset.name + '_faces',
          cubemap: true,
          type: getType() || faceTextures[0].type,
          width: faceTextures[0].width,
          height: faceTextures[0].height,
          format: format === PIXELFORMAT_RGB8 ? PIXELFORMAT_RGBA8 : format,
          mipmaps: (_assetData$mipmaps = assetData.mipmaps) != null ? _assetData$mipmaps : true,
          levels: faceLevels,
          minFilter: assetData.hasOwnProperty('minFilter') ? assetData.minFilter : faceTextures[0].minFilter,
          magFilter: assetData.hasOwnProperty('magFilter') ? assetData.magFilter : faceTextures[0].magFilter,
          anisotropy: assetData.hasOwnProperty('anisotropy') ? assetData.anisotropy : 1,
          addressU: ADDRESS_CLAMP_TO_EDGE,
          addressV: ADDRESS_CLAMP_TO_EDGE,
          fixCubemapSeams: !!assets[0]
        });
        resources[0] = faces;
      }
    } else {
      // no faces changed so keep existing faces cubemap
      resources[0] = oldResources[0] || null;
    }

    // check if any resource changed
    if (!this.cmpArrays(resources, oldResources)) {
      // set the new resources, change events will fire
      cubemapAsset.resources = resources;
      cubemapAsset._handlerState.assetIds = assetIds;
      cubemapAsset._handlerState.assets = assets;

      // destroy the old cubemap resources that are not longer needed
      for (i = 0; i < oldResources.length; ++i) {
        if (oldResources[i] !== null && resources.indexOf(oldResources[i]) === -1) {
          oldResources[i].destroy();
        }
      }
    }

    // destroy old assets which have been replaced
    for (i = 0; i < oldAssets.length; ++i) {
      if (oldAssets[i] !== null && assets.indexOf(oldAssets[i]) === -1) {
        oldAssets[i].unload();
      }
    }
  }
  cmpArrays(arr1, arr2) {
    if (arr1.length !== arr2.length) {
      return false;
    }
    for (let i = 0; i < arr1.length; ++i) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }
    return true;
  }

  // convert string id to int
  resolveId(value) {
    const valueInt = parseInt(value, 10);
    return valueInt === value || valueInt.toString() === value ? valueInt : value;
  }
  loadAssets(cubemapAsset, callback) {
    // initialize asset structures for tracking load requests
    if (!cubemapAsset.hasOwnProperty('_handlerState')) {
      cubemapAsset._handlerState = {
        // the list of requested asset ids in order of [prelit cubemap, 6 faces]
        assetIds: [null, null, null, null, null, null, null],
        // the dependent (loaded, active) texture assets
        assets: [null, null, null, null, null, null, null]
      };
    }
    const self = this;
    const assetIds = self.getAssetIds(cubemapAsset);
    const assets = [null, null, null, null, null, null, null];
    const loadedAssetIds = cubemapAsset._handlerState.assetIds;
    const loadedAssets = cubemapAsset._handlerState.assets;
    const registry = self._registry;

    // one of the dependent assets has finished loading
    let awaiting = 7;
    const onLoad = function onLoad(index, asset) {
      assets[index] = asset;
      awaiting--;
      if (awaiting === 0) {
        // all dependent assets are finished loading, set them as the active resources
        self.update(cubemapAsset, assetIds, assets);
        callback(null, cubemapAsset.resources);
      }
    };

    // handle an asset load failure
    const onError = function onError(index, err, asset) {
      callback(err);
    };

    // process the texture asset
    const processTexAsset = function processTexAsset(index, texAsset) {
      if (texAsset.loaded) {
        // asset already exists
        onLoad(index, texAsset);
      } else {
        // asset is not loaded, register for load and error events
        registry.once('load:' + texAsset.id, onLoad.bind(self, index));
        registry.once('error:' + texAsset.id, onError.bind(self, index));
        if (!texAsset.loading) {
          // kick off load if it's not already
          registry.load(texAsset);
        }
      }
    };
    let texAsset;
    for (let i = 0; i < 7; ++i) {
      const assetId = this.resolveId(assetIds[i]);
      if (!assetId) {
        // no asset
        onLoad(i, null);
      } else if (self.compareAssetIds(assetId, loadedAssetIds[i])) {
        // asset id hasn't changed from what is currently set
        onLoad(i, loadedAssets[i]);
      } else if (parseInt(assetId, 10) === assetId) {
        // assetId is an asset id
        texAsset = registry.get(assetId);
        if (texAsset) {
          processTexAsset(i, texAsset);
        } else {
          // if we are unable to find the dependent asset, then we introduce here an
          // asynchronous step. this gives the caller (for example the scene loader)
          // a chance to add the dependent scene texture to registry before we attempt
          // to get the asset again.
          setTimeout(function (index, assetId_) {
            const texAsset = registry.get(assetId_);
            if (texAsset) {
              processTexAsset(index, texAsset);
            } else {
              onError(index, 'failed to find dependent cubemap asset=' + assetId_);
            }
          }.bind(null, i, assetId));
        }
      } else {
        // assetId is a url or file object and we're responsible for creating it
        const file = typeof assetId === 'string' ? {
          url: assetId,
          filename: assetId
        } : assetId;
        texAsset = new Asset(cubemapAsset.name + '_part_' + i, 'texture', file);
        registry.add(texAsset);
        registry.once('load:' + texAsset.id, onLoad.bind(self, i));
        registry.once('error:' + texAsset.id, onError.bind(self, i));
        registry.load(texAsset);
      }
    }
  }
}

export { CubemapHandler };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3ViZW1hcC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL2ZyYW1ld29yay9oYW5kbGVycy9jdWJlbWFwLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gICAgQUREUkVTU19DTEFNUF9UT19FREdFLCBQSVhFTEZPUk1BVF9SR0I4LCBQSVhFTEZPUk1BVF9SR0JBOCxcbiAgICBURVhUVVJFVFlQRV9ERUZBVUxULCBURVhUVVJFVFlQRV9SR0JNLCBURVhUVVJFVFlQRV9SR0JQXG59IGZyb20gJy4uLy4uL3BsYXRmb3JtL2dyYXBoaWNzL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBUZXh0dXJlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZ3JhcGhpY3MvdGV4dHVyZS5qcyc7XG5cbmltcG9ydCB7IEFzc2V0IH0gZnJvbSAnLi4vYXNzZXQvYXNzZXQuanMnO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9oYW5kbGVyLmpzJykuUmVzb3VyY2VIYW5kbGVyfSBSZXNvdXJjZUhhbmRsZXIgKi9cblxuLyoqXG4gKiBSZXNvdXJjZSBoYW5kbGVyIHVzZWQgZm9yIGxvYWRpbmcgY3ViZW1hcCB7QGxpbmsgVGV4dHVyZX0gcmVzb3VyY2VzLlxuICpcbiAqIEBpbXBsZW1lbnRzIHtSZXNvdXJjZUhhbmRsZXJ9XG4gKi9cbmNsYXNzIEN1YmVtYXBIYW5kbGVyIHtcbiAgICAvKipcbiAgICAgKiBUeXBlIG9mIHRoZSByZXNvdXJjZSB0aGUgaGFuZGxlciBoYW5kbGVzLlxuICAgICAqXG4gICAgICogQHR5cGUge3N0cmluZ31cbiAgICAgKi9cbiAgICBoYW5kbGVyVHlwZSA9IFwiY3ViZW1hcFwiO1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlIGEgbmV3IEN1YmVtYXBIYW5kbGVyIGluc3RhbmNlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtpbXBvcnQoJy4uL2FwcC1iYXNlLmpzJykuQXBwQmFzZX0gYXBwIC0gVGhlIHJ1bm5pbmcge0BsaW5rIEFwcEJhc2V9LlxuICAgICAqIEBoaWRlY29uc3RydWN0b3JcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihhcHApIHtcbiAgICAgICAgdGhpcy5fZGV2aWNlID0gYXBwLmdyYXBoaWNzRGV2aWNlO1xuICAgICAgICB0aGlzLl9yZWdpc3RyeSA9IGFwcC5hc3NldHM7XG4gICAgICAgIHRoaXMuX2xvYWRlciA9IGFwcC5sb2FkZXI7XG4gICAgfVxuXG4gICAgbG9hZCh1cmwsIGNhbGxiYWNrLCBhc3NldCkge1xuICAgICAgICB0aGlzLmxvYWRBc3NldHMoYXNzZXQsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBvcGVuKHVybCwgZGF0YSwgYXNzZXQpIHtcbiAgICAgICAgLy8gY2FsbGVyIHdpbGwgc2V0IG91ciByZXR1cm4gdmFsdWUgdG8gYXNzZXQucmVzb3VyY2VzWzBdLiBXZSd2ZSBhbHJlYWR5IHNldCByZXNvdXJjZXNbMF0sXG4gICAgICAgIC8vIGJ1dCB3ZSBtdXN0IHJldHVybiBpdCBhZ2FpbiBoZXJlIHNvIGl0IGRvZXNuJ3QgZ2V0IG92ZXJ3cml0dGVuLlxuICAgICAgICByZXR1cm4gYXNzZXQgPyBhc3NldC5yZXNvdXJjZSA6IG51bGw7XG4gICAgfVxuXG4gICAgcGF0Y2goYXNzZXQsIHJlZ2lzdHJ5KSB7XG4gICAgICAgIHRoaXMubG9hZEFzc2V0cyhhc3NldCwgZnVuY3Rpb24gKGVyciwgcmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgLy8gZmlyZSBlcnJvciBldmVudCBpZiBwYXRjaCBmYWlsZWRcbiAgICAgICAgICAgICAgICByZWdpc3RyeS5maXJlKCdlcnJvcicsIGFzc2V0KTtcbiAgICAgICAgICAgICAgICByZWdpc3RyeS5maXJlKCdlcnJvcjonICsgYXNzZXQuaWQsIGVyciwgYXNzZXQpO1xuICAgICAgICAgICAgICAgIGFzc2V0LmZpcmUoJ2Vycm9yJywgYXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gbm90aGluZyB0byBkbyBzaW5jZSBhc3NldDpjaGFuZ2Ugd291bGQgaGF2ZSBiZWVuIHJhaXNlZCBpZlxuICAgICAgICAgICAgLy8gcmVzb3VyY2VzIHdlcmUgY2hhbmdlZC5cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gZ2V0IHRoZSBsaXN0IG9mIGRlcGVuZGVudCBhc3NldCBpZHMgZm9yIHRoZSBjdWJlbWFwXG4gICAgZ2V0QXNzZXRJZHMoY3ViZW1hcEFzc2V0KSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgICAgIC8vIHByZWZpbHRlcmVkIGN1YmVtYXAgaXMgc3RvcmVkIGF0IGluZGV4IDBcbiAgICAgICAgcmVzdWx0WzBdID0gY3ViZW1hcEFzc2V0LmZpbGU7XG5cbiAgICAgICAgLy8gZmFjZXMgYXJlIHN0b3JlZCBhdCBpbmRleCAxLi42XG4gICAgICAgIGlmICgoY3ViZW1hcEFzc2V0LmxvYWRGYWNlcyB8fCAhY3ViZW1hcEFzc2V0LmZpbGUpICYmIGN1YmVtYXBBc3NldC5kYXRhICYmIGN1YmVtYXBBc3NldC5kYXRhLnRleHR1cmVzKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY7ICsraSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtpICsgMV0gPSBjdWJlbWFwQXNzZXQuZGF0YS50ZXh0dXJlc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdFsxXSA9IHJlc3VsdFsyXSA9IHJlc3VsdFszXSA9IHJlc3VsdFs0XSA9IHJlc3VsdFs1XSA9IHJlc3VsdFs2XSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIC8vIHRlc3Qgd2hldGhlciB0d28gYXNzZXRzIGlkcyBhcmUgdGhlIHNhbWVcbiAgICBjb21wYXJlQXNzZXRJZHMoYXNzZXRJZEEsIGFzc2V0SWRCKSB7XG4gICAgICAgIGlmIChhc3NldElkQSAmJiBhc3NldElkQikge1xuICAgICAgICAgICAgaWYgKHBhcnNlSW50KGFzc2V0SWRBLCAxMCkgPT09IGFzc2V0SWRBIHx8IHR5cGVvZiBhc3NldElkQSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXNzZXRJZEEgPT09IGFzc2V0SWRCOyAgICAgICAgICAgLy8gaWQgb3IgdXJsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBhc3NldElkQS51cmwgPT09IGFzc2V0SWRCLnVybDsgICAgICAgLy8gZmlsZS91cmwgc3RydWN0dXJlIHdpdGggdXJsIGFuZCBmaWxlbmFtZVxuICAgICAgICB9XG4gICAgICAgIC8vIGVsc2Uge1xuICAgICAgICByZXR1cm4gKGFzc2V0SWRBICE9PSBudWxsKSA9PT0gKGFzc2V0SWRCICE9PSBudWxsKTtcbiAgICB9XG5cbiAgICAvLyB1cGRhdGUgdGhlIGN1YmVtYXAgcmVzb3VyY2VzIGdpdmVuIGEgbmV3bHkgbG9hZGVkIHNldCBvZiBhc3NldHMgd2l0aCB0aGVpciBjb3JyZXNwb25kaW5nIGlkc1xuICAgIHVwZGF0ZShjdWJlbWFwQXNzZXQsIGFzc2V0SWRzLCBhc3NldHMpIHtcbiAgICAgICAgY29uc3QgYXNzZXREYXRhID0gY3ViZW1hcEFzc2V0LmRhdGEgfHwge307XG4gICAgICAgIGNvbnN0IG9sZEFzc2V0cyA9IGN1YmVtYXBBc3NldC5faGFuZGxlclN0YXRlLmFzc2V0cztcbiAgICAgICAgY29uc3Qgb2xkUmVzb3VyY2VzID0gY3ViZW1hcEFzc2V0Ll9yZXNvdXJjZXM7XG4gICAgICAgIGxldCB0ZXgsIG1pcCwgaTtcblxuICAgICAgICAvLyBmYWNlcywgcHJlbGl0IGN1YmVtYXAgMTI4LCA2NCwgMzIsIDE2LCA4LCA0XG4gICAgICAgIGNvbnN0IHJlc291cmNlcyA9IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXTtcblxuICAgICAgICAvLyB0ZXh0dXJlIHR5cGUgdXNlZCBmb3IgZmFjZXMgYW5kIHByZWxpdCBjdWJlbWFwcyBhcmUgYm90aCB0YWtlbiBmcm9tXG4gICAgICAgIC8vIGN1YmVtYXAuZGF0YS5yZ2JtXG4gICAgICAgIGNvbnN0IGdldFR5cGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoYXNzZXREYXRhLmhhc093blByb3BlcnR5KCd0eXBlJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXNzZXREYXRhLnR5cGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYXNzZXREYXRhLmhhc093blByb3BlcnR5KCdyZ2JtJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXNzZXREYXRhLnJnYm0gPyBURVhUVVJFVFlQRV9SR0JNIDogVEVYVFVSRVRZUEVfREVGQVVMVDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9O1xuXG4gICAgICAgIC8vIGhhbmRsZSB0aGUgcHJlbGl0IGRhdGFcbiAgICAgICAgaWYgKCFjdWJlbWFwQXNzZXQubG9hZGVkIHx8IGFzc2V0c1swXSAhPT0gb2xkQXNzZXRzWzBdKSB7XG4gICAgICAgICAgICAvLyBwcmVsaXQgYXNzZXQgY2hhbmdlZFxuICAgICAgICAgICAgaWYgKGFzc2V0c1swXSkge1xuICAgICAgICAgICAgICAgIHRleCA9IGFzc2V0c1swXS5yZXNvdXJjZTtcbiAgICAgICAgICAgICAgICBpZiAodGV4LmN1YmVtYXApIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IDY7ICsraSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzW2kgKyAxXSA9IG5ldyBUZXh0dXJlKHRoaXMuX2RldmljZSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGN1YmVtYXBBc3NldC5uYW1lICsgJ19wcmVsaXRDdWJlbWFwJyArICh0ZXgud2lkdGggPj4gaSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3ViZW1hcDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBhc3N1bWUgcHJlZmlsdGVyZWQgZGF0YSBoYXMgc2FtZSBlbmNvZGluZyBhcyB0aGUgZmFjZXMgYXNzZXRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBnZXRUeXBlKCkgfHwgdGV4LnR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgd2lkdGg6IHRleC53aWR0aCA+PiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhlaWdodDogdGV4LmhlaWdodCA+PiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcm1hdDogdGV4LmZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsZXZlbHM6IFt0ZXguX2xldmVsc1tpXV0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZml4Q3ViZW1hcFNlYW1zOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFkZHJlc3NVOiBBRERSRVNTX0NMQU1QX1RPX0VER0UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBnZW5lcmF0ZSBjdWJlbWFwcyBvbiB0aGUgdG9wIGxldmVsIG9ubHlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtaXBtYXBzOiBpID09PSAwXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHByZWZpbHRlcmVkIGRhdGEgaXMgYW4gZW52IGF0bGFzXG4gICAgICAgICAgICAgICAgICAgIHRleC50eXBlID0gVEVYVFVSRVRZUEVfUkdCUDtcbiAgICAgICAgICAgICAgICAgICAgcmVzb3VyY2VzWzFdID0gdGV4O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHByZWxpdCBhc3NldCBkaWRuJ3QgY2hhbmdlIHNvIGtlZXAgdGhlIGV4aXN0aW5nIGN1YmVtYXAgcmVzb3VyY2VzXG4gICAgICAgICAgICByZXNvdXJjZXNbMV0gPSBvbGRSZXNvdXJjZXNbMV0gfHwgbnVsbDtcbiAgICAgICAgICAgIHJlc291cmNlc1syXSA9IG9sZFJlc291cmNlc1syXSB8fCBudWxsO1xuICAgICAgICAgICAgcmVzb3VyY2VzWzNdID0gb2xkUmVzb3VyY2VzWzNdIHx8IG51bGw7XG4gICAgICAgICAgICByZXNvdXJjZXNbNF0gPSBvbGRSZXNvdXJjZXNbNF0gfHwgbnVsbDtcbiAgICAgICAgICAgIHJlc291cmNlc1s1XSA9IG9sZFJlc291cmNlc1s1XSB8fCBudWxsO1xuICAgICAgICAgICAgcmVzb3VyY2VzWzZdID0gb2xkUmVzb3VyY2VzWzZdIHx8IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmYWNlQXNzZXRzID0gYXNzZXRzLnNsaWNlKDEpO1xuICAgICAgICBpZiAoIWN1YmVtYXBBc3NldC5sb2FkZWQgfHwgIXRoaXMuY21wQXJyYXlzKGZhY2VBc3NldHMsIG9sZEFzc2V0cy5zbGljZSgxKSkpIHtcbiAgICAgICAgICAgIC8vIGZhY2UgYXNzZXRzIGhhdmUgY2hhbmdlZFxuICAgICAgICAgICAgaWYgKGZhY2VBc3NldHMuaW5kZXhPZihudWxsKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAvLyBleHRyYWN0IGN1YmVtYXAgbGV2ZWwgZGF0YSBmcm9tIGZhY2UgdGV4dHVyZXNcbiAgICAgICAgICAgICAgICBjb25zdCBmYWNlVGV4dHVyZXMgPSBmYWNlQXNzZXRzLm1hcChmdW5jdGlvbiAoYXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFzc2V0LnJlc291cmNlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZhY2VMZXZlbHMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKG1pcCA9IDA7IG1pcCA8IGZhY2VUZXh0dXJlc1swXS5fbGV2ZWxzLmxlbmd0aDsgKyttaXApIHtcbiAgICAgICAgICAgICAgICAgICAgZmFjZUxldmVscy5wdXNoKGZhY2VUZXh0dXJlcy5tYXAoZnVuY3Rpb24gKGZhY2VUZXh0dXJlKSB7ICAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLWxvb3AtZnVuY1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhY2VUZXh0dXJlLl9sZXZlbHNbbWlwXTtcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEZvcmNlIFJHQkE4IGlmIHdlIGFyZSBsb2FkaW5nIGEgUkdCOCB0ZXh0dXJlIGR1ZSB0byBhIGJ1ZyBvbiBNMSBNYWNzIE1vbnRlcmV5IGFuZCBDaHJvbWUgbm90XG4gICAgICAgICAgICAgICAgLy8gcmVuZGVyaW5nIHRoZSBmYWNlIG9uIHJpZ2h0IG9mIHRoZSBjdWJlbWFwIChgZmFjZUFzc2V0c1swXWAgYW5kIGByZXNvdXJjZXNbMV1gKS5cbiAgICAgICAgICAgICAgICAvLyBVc2luZyBhIFJHQkE4IHRleHR1cmUgd29ya3MgYXJvdW5kIHRoZSBpc3N1ZSBodHRwczovL2dpdGh1Yi5jb20vcGxheWNhbnZhcy9lbmdpbmUvaXNzdWVzLzQwOTFcbiAgICAgICAgICAgICAgICBjb25zdCBmb3JtYXQgPSBmYWNlVGV4dHVyZXNbMF0uZm9ybWF0O1xuXG4gICAgICAgICAgICAgICAgY29uc3QgZmFjZXMgPSBuZXcgVGV4dHVyZSh0aGlzLl9kZXZpY2UsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogY3ViZW1hcEFzc2V0Lm5hbWUgKyAnX2ZhY2VzJyxcbiAgICAgICAgICAgICAgICAgICAgY3ViZW1hcDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogZ2V0VHlwZSgpIHx8IGZhY2VUZXh0dXJlc1swXS50eXBlLFxuICAgICAgICAgICAgICAgICAgICB3aWR0aDogZmFjZVRleHR1cmVzWzBdLndpZHRoLFxuICAgICAgICAgICAgICAgICAgICBoZWlnaHQ6IGZhY2VUZXh0dXJlc1swXS5oZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdDogZm9ybWF0ID09PSBQSVhFTEZPUk1BVF9SR0I4ID8gUElYRUxGT1JNQVRfUkdCQTggOiBmb3JtYXQsXG4gICAgICAgICAgICAgICAgICAgIG1pcG1hcHM6IGFzc2V0RGF0YS5taXBtYXBzID8/IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGxldmVsczogZmFjZUxldmVscyxcbiAgICAgICAgICAgICAgICAgICAgbWluRmlsdGVyOiBhc3NldERhdGEuaGFzT3duUHJvcGVydHkoJ21pbkZpbHRlcicpID8gYXNzZXREYXRhLm1pbkZpbHRlciA6IGZhY2VUZXh0dXJlc1swXS5taW5GaWx0ZXIsXG4gICAgICAgICAgICAgICAgICAgIG1hZ0ZpbHRlcjogYXNzZXREYXRhLmhhc093blByb3BlcnR5KCdtYWdGaWx0ZXInKSA/IGFzc2V0RGF0YS5tYWdGaWx0ZXIgOiBmYWNlVGV4dHVyZXNbMF0ubWFnRmlsdGVyLFxuICAgICAgICAgICAgICAgICAgICBhbmlzb3Ryb3B5OiBhc3NldERhdGEuaGFzT3duUHJvcGVydHkoJ2FuaXNvdHJvcHknKSA/IGFzc2V0RGF0YS5hbmlzb3Ryb3B5IDogMSxcbiAgICAgICAgICAgICAgICAgICAgYWRkcmVzc1U6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgICAgICAgICAgYWRkcmVzc1Y6IEFERFJFU1NfQ0xBTVBfVE9fRURHRSxcbiAgICAgICAgICAgICAgICAgICAgZml4Q3ViZW1hcFNlYW1zOiAhIWFzc2V0c1swXVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgcmVzb3VyY2VzWzBdID0gZmFjZXM7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBubyBmYWNlcyBjaGFuZ2VkIHNvIGtlZXAgZXhpc3RpbmcgZmFjZXMgY3ViZW1hcFxuICAgICAgICAgICAgcmVzb3VyY2VzWzBdID0gb2xkUmVzb3VyY2VzWzBdIHx8IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBjaGVjayBpZiBhbnkgcmVzb3VyY2UgY2hhbmdlZFxuICAgICAgICBpZiAoIXRoaXMuY21wQXJyYXlzKHJlc291cmNlcywgb2xkUmVzb3VyY2VzKSkge1xuICAgICAgICAgICAgLy8gc2V0IHRoZSBuZXcgcmVzb3VyY2VzLCBjaGFuZ2UgZXZlbnRzIHdpbGwgZmlyZVxuICAgICAgICAgICAgY3ViZW1hcEFzc2V0LnJlc291cmNlcyA9IHJlc291cmNlcztcbiAgICAgICAgICAgIGN1YmVtYXBBc3NldC5faGFuZGxlclN0YXRlLmFzc2V0SWRzID0gYXNzZXRJZHM7XG4gICAgICAgICAgICBjdWJlbWFwQXNzZXQuX2hhbmRsZXJTdGF0ZS5hc3NldHMgPSBhc3NldHM7XG5cbiAgICAgICAgICAgIC8vIGRlc3Ryb3kgdGhlIG9sZCBjdWJlbWFwIHJlc291cmNlcyB0aGF0IGFyZSBub3QgbG9uZ2VyIG5lZWRlZFxuICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IG9sZFJlc291cmNlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIGlmIChvbGRSZXNvdXJjZXNbaV0gIT09IG51bGwgJiYgcmVzb3VyY2VzLmluZGV4T2Yob2xkUmVzb3VyY2VzW2ldKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgb2xkUmVzb3VyY2VzW2ldLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBkZXN0cm95IG9sZCBhc3NldHMgd2hpY2ggaGF2ZSBiZWVuIHJlcGxhY2VkXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBvbGRBc3NldHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChvbGRBc3NldHNbaV0gIT09IG51bGwgJiYgYXNzZXRzLmluZGV4T2Yob2xkQXNzZXRzW2ldKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICBvbGRBc3NldHNbaV0udW5sb2FkKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjbXBBcnJheXMoYXJyMSwgYXJyMikge1xuICAgICAgICBpZiAoYXJyMS5sZW5ndGggIT09IGFycjIubGVuZ3RoKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnIxLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICBpZiAoYXJyMVtpXSAhPT0gYXJyMltpXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBjb252ZXJ0IHN0cmluZyBpZCB0byBpbnRcbiAgICByZXNvbHZlSWQodmFsdWUpIHtcbiAgICAgICAgY29uc3QgdmFsdWVJbnQgPSBwYXJzZUludCh2YWx1ZSwgMTApO1xuICAgICAgICByZXR1cm4gKCh2YWx1ZUludCA9PT0gdmFsdWUpIHx8ICh2YWx1ZUludC50b1N0cmluZygpID09PSB2YWx1ZSkpID8gdmFsdWVJbnQgOiB2YWx1ZTtcbiAgICB9XG5cbiAgICBsb2FkQXNzZXRzKGN1YmVtYXBBc3NldCwgY2FsbGJhY2spIHtcbiAgICAgICAgLy8gaW5pdGlhbGl6ZSBhc3NldCBzdHJ1Y3R1cmVzIGZvciB0cmFja2luZyBsb2FkIHJlcXVlc3RzXG4gICAgICAgIGlmICghY3ViZW1hcEFzc2V0Lmhhc093blByb3BlcnR5KCdfaGFuZGxlclN0YXRlJykpIHtcbiAgICAgICAgICAgIGN1YmVtYXBBc3NldC5faGFuZGxlclN0YXRlID0ge1xuICAgICAgICAgICAgICAgIC8vIHRoZSBsaXN0IG9mIHJlcXVlc3RlZCBhc3NldCBpZHMgaW4gb3JkZXIgb2YgW3ByZWxpdCBjdWJlbWFwLCA2IGZhY2VzXVxuICAgICAgICAgICAgICAgIGFzc2V0SWRzOiBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF0sXG4gICAgICAgICAgICAgICAgLy8gdGhlIGRlcGVuZGVudCAobG9hZGVkLCBhY3RpdmUpIHRleHR1cmUgYXNzZXRzXG4gICAgICAgICAgICAgICAgYXNzZXRzOiBbbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbCwgbnVsbF1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAgICAgY29uc3QgYXNzZXRJZHMgPSBzZWxmLmdldEFzc2V0SWRzKGN1YmVtYXBBc3NldCk7XG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IFtudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsLCBudWxsXTtcbiAgICAgICAgY29uc3QgbG9hZGVkQXNzZXRJZHMgPSBjdWJlbWFwQXNzZXQuX2hhbmRsZXJTdGF0ZS5hc3NldElkcztcbiAgICAgICAgY29uc3QgbG9hZGVkQXNzZXRzID0gY3ViZW1hcEFzc2V0Ll9oYW5kbGVyU3RhdGUuYXNzZXRzO1xuICAgICAgICBjb25zdCByZWdpc3RyeSA9IHNlbGYuX3JlZ2lzdHJ5O1xuXG4gICAgICAgIC8vIG9uZSBvZiB0aGUgZGVwZW5kZW50IGFzc2V0cyBoYXMgZmluaXNoZWQgbG9hZGluZ1xuICAgICAgICBsZXQgYXdhaXRpbmcgPSA3O1xuICAgICAgICBjb25zdCBvbkxvYWQgPSBmdW5jdGlvbiAoaW5kZXgsIGFzc2V0KSB7XG4gICAgICAgICAgICBhc3NldHNbaW5kZXhdID0gYXNzZXQ7XG4gICAgICAgICAgICBhd2FpdGluZy0tO1xuXG4gICAgICAgICAgICBpZiAoYXdhaXRpbmcgPT09IDApIHtcbiAgICAgICAgICAgICAgICAvLyBhbGwgZGVwZW5kZW50IGFzc2V0cyBhcmUgZmluaXNoZWQgbG9hZGluZywgc2V0IHRoZW0gYXMgdGhlIGFjdGl2ZSByZXNvdXJjZXNcbiAgICAgICAgICAgICAgICBzZWxmLnVwZGF0ZShjdWJlbWFwQXNzZXQsIGFzc2V0SWRzLCBhc3NldHMpO1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIGN1YmVtYXBBc3NldC5yZXNvdXJjZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIGhhbmRsZSBhbiBhc3NldCBsb2FkIGZhaWx1cmVcbiAgICAgICAgY29uc3Qgb25FcnJvciA9IGZ1bmN0aW9uIChpbmRleCwgZXJyLCBhc3NldCkge1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBwcm9jZXNzIHRoZSB0ZXh0dXJlIGFzc2V0XG4gICAgICAgIGNvbnN0IHByb2Nlc3NUZXhBc3NldCA9IGZ1bmN0aW9uIChpbmRleCwgdGV4QXNzZXQpIHtcbiAgICAgICAgICAgIGlmICh0ZXhBc3NldC5sb2FkZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBhc3NldCBhbHJlYWR5IGV4aXN0c1xuICAgICAgICAgICAgICAgIG9uTG9hZChpbmRleCwgdGV4QXNzZXQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBhc3NldCBpcyBub3QgbG9hZGVkLCByZWdpc3RlciBmb3IgbG9hZCBhbmQgZXJyb3IgZXZlbnRzXG4gICAgICAgICAgICAgICAgcmVnaXN0cnkub25jZSgnbG9hZDonICsgdGV4QXNzZXQuaWQsIG9uTG9hZC5iaW5kKHNlbGYsIGluZGV4KSk7XG4gICAgICAgICAgICAgICAgcmVnaXN0cnkub25jZSgnZXJyb3I6JyArIHRleEFzc2V0LmlkLCBvbkVycm9yLmJpbmQoc2VsZiwgaW5kZXgpKTtcbiAgICAgICAgICAgICAgICBpZiAoIXRleEFzc2V0LmxvYWRpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8ga2ljayBvZmYgbG9hZCBpZiBpdCdzIG5vdCBhbHJlYWR5XG4gICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJ5LmxvYWQodGV4QXNzZXQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICBsZXQgdGV4QXNzZXQ7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNzsgKytpKSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldElkID0gdGhpcy5yZXNvbHZlSWQoYXNzZXRJZHNbaV0pO1xuXG4gICAgICAgICAgICBpZiAoIWFzc2V0SWQpIHtcbiAgICAgICAgICAgICAgICAvLyBubyBhc3NldFxuICAgICAgICAgICAgICAgIG9uTG9hZChpLCBudWxsKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc2VsZi5jb21wYXJlQXNzZXRJZHMoYXNzZXRJZCwgbG9hZGVkQXNzZXRJZHNbaV0pKSB7XG4gICAgICAgICAgICAgICAgLy8gYXNzZXQgaWQgaGFzbid0IGNoYW5nZWQgZnJvbSB3aGF0IGlzIGN1cnJlbnRseSBzZXRcbiAgICAgICAgICAgICAgICBvbkxvYWQoaSwgbG9hZGVkQXNzZXRzW2ldKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGFyc2VJbnQoYXNzZXRJZCwgMTApID09PSBhc3NldElkKSB7XG4gICAgICAgICAgICAgICAgLy8gYXNzZXRJZCBpcyBhbiBhc3NldCBpZFxuICAgICAgICAgICAgICAgIHRleEFzc2V0ID0gcmVnaXN0cnkuZ2V0KGFzc2V0SWQpO1xuICAgICAgICAgICAgICAgIGlmICh0ZXhBc3NldCkge1xuICAgICAgICAgICAgICAgICAgICBwcm9jZXNzVGV4QXNzZXQoaSwgdGV4QXNzZXQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIHdlIGFyZSB1bmFibGUgdG8gZmluZCB0aGUgZGVwZW5kZW50IGFzc2V0LCB0aGVuIHdlIGludHJvZHVjZSBoZXJlIGFuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFzeW5jaHJvbm91cyBzdGVwLiB0aGlzIGdpdmVzIHRoZSBjYWxsZXIgKGZvciBleGFtcGxlIHRoZSBzY2VuZSBsb2FkZXIpXG4gICAgICAgICAgICAgICAgICAgIC8vIGEgY2hhbmNlIHRvIGFkZCB0aGUgZGVwZW5kZW50IHNjZW5lIHRleHR1cmUgdG8gcmVnaXN0cnkgYmVmb3JlIHdlIGF0dGVtcHRcbiAgICAgICAgICAgICAgICAgICAgLy8gdG8gZ2V0IHRoZSBhc3NldCBhZ2Fpbi5cbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoaW5kZXgsIGFzc2V0SWRfKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXhBc3NldCA9IHJlZ2lzdHJ5LmdldChhc3NldElkXyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGV4QXNzZXQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzVGV4QXNzZXQoaW5kZXgsIHRleEFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25FcnJvcihpbmRleCwgJ2ZhaWxlZCB0byBmaW5kIGRlcGVuZGVudCBjdWJlbWFwIGFzc2V0PScgKyBhc3NldElkXyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0uYmluZChudWxsLCBpLCBhc3NldElkKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBhc3NldElkIGlzIGEgdXJsIG9yIGZpbGUgb2JqZWN0IGFuZCB3ZSdyZSByZXNwb25zaWJsZSBmb3IgY3JlYXRpbmcgaXRcbiAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0gKHR5cGVvZiBhc3NldElkID09PSAnc3RyaW5nJykgPyB7XG4gICAgICAgICAgICAgICAgICAgIHVybDogYXNzZXRJZCxcbiAgICAgICAgICAgICAgICAgICAgZmlsZW5hbWU6IGFzc2V0SWRcbiAgICAgICAgICAgICAgICB9IDogYXNzZXRJZDtcbiAgICAgICAgICAgICAgICB0ZXhBc3NldCA9IG5ldyBBc3NldChjdWJlbWFwQXNzZXQubmFtZSArICdfcGFydF8nICsgaSwgJ3RleHR1cmUnLCBmaWxlKTtcbiAgICAgICAgICAgICAgICByZWdpc3RyeS5hZGQodGV4QXNzZXQpO1xuICAgICAgICAgICAgICAgIHJlZ2lzdHJ5Lm9uY2UoJ2xvYWQ6JyArIHRleEFzc2V0LmlkLCBvbkxvYWQuYmluZChzZWxmLCBpKSk7XG4gICAgICAgICAgICAgICAgcmVnaXN0cnkub25jZSgnZXJyb3I6JyArIHRleEFzc2V0LmlkLCBvbkVycm9yLmJpbmQoc2VsZiwgaSkpO1xuICAgICAgICAgICAgICAgIHJlZ2lzdHJ5LmxvYWQodGV4QXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnQgeyBDdWJlbWFwSGFuZGxlciB9O1xuIl0sIm5hbWVzIjpbIkN1YmVtYXBIYW5kbGVyIiwiY29uc3RydWN0b3IiLCJhcHAiLCJoYW5kbGVyVHlwZSIsIl9kZXZpY2UiLCJncmFwaGljc0RldmljZSIsIl9yZWdpc3RyeSIsImFzc2V0cyIsIl9sb2FkZXIiLCJsb2FkZXIiLCJsb2FkIiwidXJsIiwiY2FsbGJhY2siLCJhc3NldCIsImxvYWRBc3NldHMiLCJvcGVuIiwiZGF0YSIsInJlc291cmNlIiwicGF0Y2giLCJyZWdpc3RyeSIsImVyciIsInJlc3VsdCIsImZpcmUiLCJpZCIsImdldEFzc2V0SWRzIiwiY3ViZW1hcEFzc2V0IiwiZmlsZSIsImxvYWRGYWNlcyIsInRleHR1cmVzIiwiaSIsImNvbXBhcmVBc3NldElkcyIsImFzc2V0SWRBIiwiYXNzZXRJZEIiLCJwYXJzZUludCIsInVwZGF0ZSIsImFzc2V0SWRzIiwiYXNzZXREYXRhIiwib2xkQXNzZXRzIiwiX2hhbmRsZXJTdGF0ZSIsIm9sZFJlc291cmNlcyIsIl9yZXNvdXJjZXMiLCJ0ZXgiLCJtaXAiLCJyZXNvdXJjZXMiLCJnZXRUeXBlIiwiaGFzT3duUHJvcGVydHkiLCJ0eXBlIiwicmdibSIsIlRFWFRVUkVUWVBFX1JHQk0iLCJURVhUVVJFVFlQRV9ERUZBVUxUIiwibG9hZGVkIiwiY3ViZW1hcCIsIlRleHR1cmUiLCJuYW1lIiwid2lkdGgiLCJoZWlnaHQiLCJmb3JtYXQiLCJsZXZlbHMiLCJfbGV2ZWxzIiwiZml4Q3ViZW1hcFNlYW1zIiwiYWRkcmVzc1UiLCJBRERSRVNTX0NMQU1QX1RPX0VER0UiLCJhZGRyZXNzViIsIm1pcG1hcHMiLCJURVhUVVJFVFlQRV9SR0JQIiwiZmFjZUFzc2V0cyIsInNsaWNlIiwiY21wQXJyYXlzIiwiaW5kZXhPZiIsIl9hc3NldERhdGEkbWlwbWFwcyIsImZhY2VUZXh0dXJlcyIsIm1hcCIsImZhY2VMZXZlbHMiLCJsZW5ndGgiLCJwdXNoIiwiZmFjZVRleHR1cmUiLCJmYWNlcyIsIlBJWEVMRk9STUFUX1JHQjgiLCJQSVhFTEZPUk1BVF9SR0JBOCIsIm1pbkZpbHRlciIsIm1hZ0ZpbHRlciIsImFuaXNvdHJvcHkiLCJkZXN0cm95IiwidW5sb2FkIiwiYXJyMSIsImFycjIiLCJyZXNvbHZlSWQiLCJ2YWx1ZSIsInZhbHVlSW50IiwidG9TdHJpbmciLCJzZWxmIiwibG9hZGVkQXNzZXRJZHMiLCJsb2FkZWRBc3NldHMiLCJhd2FpdGluZyIsIm9uTG9hZCIsImluZGV4Iiwib25FcnJvciIsInByb2Nlc3NUZXhBc3NldCIsInRleEFzc2V0Iiwib25jZSIsImJpbmQiLCJsb2FkaW5nIiwiYXNzZXRJZCIsImdldCIsInNldFRpbWVvdXQiLCJhc3NldElkXyIsImZpbGVuYW1lIiwiQXNzZXQiLCJhZGQiXSwibWFwcGluZ3MiOiI7Ozs7QUFRQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTUEsY0FBYyxDQUFDO0FBUWpCO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNJQyxXQUFXQSxDQUFDQyxHQUFHLEVBQUU7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
