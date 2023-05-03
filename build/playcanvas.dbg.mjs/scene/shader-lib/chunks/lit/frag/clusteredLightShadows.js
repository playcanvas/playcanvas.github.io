var clusteredLightShadowsPS = /* glsl */`
// Clustered Omni Sampling using atlas

#ifdef GL2

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowOmniClusteredPCF1(SHADOWMAP_ACCEPT(shadowMap), vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
        return textureShadow(shadowMap, vec3(uv, shadowZ));
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowOmniClusteredPCF3(SHADOWMAP_ACCEPT(shadowMap), vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
        vec3 shadowCoord = vec3(uv, shadowZ);
        return getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams.xyz);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    float getShadowOmniClusteredPCF5(SHADOWMAP_ACCEPT(shadowMap), vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
        vec3 shadowCoord = vec3(uv, shadowZ);
        return getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams.xyz);
    }

    #endif

#else

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowOmniClusteredPCF1(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        // no filter shadow sampling
        float depth = unpackFloat(textureShadow(shadowMap, uv));
        float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
        return depth > shadowZ ? 1.0 : 0.0;
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowOmniClusteredPCF3(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        // pcf3
        float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
        vec3 shadowCoord = vec3(uv, shadowZ);
        return getShadowPCF3x3(shadowMap, shadowCoord, shadowParams.xyz);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    // we don't have PCF5 implementation for webgl1, use PCF3
    float getShadowOmniClusteredPCF5(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        // pcf3
        float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
        vec3 shadowCoord = vec3(uv, shadowZ);
        return getShadowPCF3x3(shadowMap, shadowCoord, shadowParams.xyz);
    }

    #endif

#endif


// Clustered Spot Sampling using atlas

#ifdef GL2

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowSpotClusteredPCF1(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
        return textureShadow(shadowMap, shadowCoord);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowSpotClusteredPCF3(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
        return getShadowSpotPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    float getShadowSpotClusteredPCF5(SHADOWMAP_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams) {
        return getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams.xyz);
    }
    #endif

#else

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowSpotClusteredPCF1(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams) {

        float depth = unpackFloat(textureShadow(shadowMap, shadowCoord.xy));

        return depth > shadowCoord.z ? 1.0 : 0.0;

    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowSpotClusteredPCF3(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams) {
        return getShadowSpotPCF3x3(shadowMap, shadowCoord, shadowParams);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    // we don't have PCF5 implementation for webgl1, use PCF3
    float getShadowSpotClusteredPCF5(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams) {
        return getShadowSpotPCF3x3(shadowMap, shadowCoord, shadowParams);
    }

    #endif

#endif
`;

export { clusteredLightShadowsPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2x1c3RlcmVkTGlnaHRTaGFkb3dzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvY2x1c3RlcmVkTGlnaHRTaGFkb3dzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBDbHVzdGVyZWQgT21uaSBTYW1wbGluZyB1c2luZyBhdGxhc1xuXG4jaWZkZWYgR0wyXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjEpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dPbW5pQ2x1c3RlcmVkUENGMShTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzQgc2hhZG93UGFyYW1zLCB2ZWMzIG9tbmlBdGxhc1ZpZXdwb3J0LCBmbG9hdCBzaGFkb3dFZGdlUGl4ZWxzLCB2ZWMzIGxpZ2h0RGlyKSB7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93VGV4dHVyZVJlc29sdXRpb24gPSBzaGFkb3dQYXJhbXMueDtcbiAgICAgICAgdmVjMiB1diA9IGdldEN1YmVtYXBBdGxhc0Nvb3JkaW5hdGVzKG9tbmlBdGxhc1ZpZXdwb3J0LCBzaGFkb3dFZGdlUGl4ZWxzLCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgbGlnaHREaXIpO1xuXG4gICAgICAgIGZsb2F0IHNoYWRvd1ogPSBsZW5ndGgobGlnaHREaXIpICogc2hhZG93UGFyYW1zLncgKyBzaGFkb3dQYXJhbXMuejtcbiAgICAgICAgcmV0dXJuIHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB2ZWMzKHV2LCBzaGFkb3daKSk7XG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjMpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dPbW5pQ2x1c3RlcmVkUENGMyhTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzQgc2hhZG93UGFyYW1zLCB2ZWMzIG9tbmlBdGxhc1ZpZXdwb3J0LCBmbG9hdCBzaGFkb3dFZGdlUGl4ZWxzLCB2ZWMzIGxpZ2h0RGlyKSB7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93VGV4dHVyZVJlc29sdXRpb24gPSBzaGFkb3dQYXJhbXMueDtcbiAgICAgICAgdmVjMiB1diA9IGdldEN1YmVtYXBBdGxhc0Nvb3JkaW5hdGVzKG9tbmlBdGxhc1ZpZXdwb3J0LCBzaGFkb3dFZGdlUGl4ZWxzLCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgbGlnaHREaXIpO1xuXG4gICAgICAgIGZsb2F0IHNoYWRvd1ogPSBsZW5ndGgobGlnaHREaXIpICogc2hhZG93UGFyYW1zLncgKyBzaGFkb3dQYXJhbXMuejtcbiAgICAgICAgdmVjMyBzaGFkb3dDb29yZCA9IHZlYzModXYsIHNoYWRvd1opO1xuICAgICAgICByZXR1cm4gZ2V0U2hhZG93UENGM3gzKFNIQURPV01BUF9QQVNTKHNoYWRvd01hcCksIHNoYWRvd0Nvb3JkLCBzaGFkb3dQYXJhbXMueHl6KTtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuICAgICNpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGNSlcblxuICAgIGZsb2F0IGdldFNoYWRvd09tbmlDbHVzdGVyZWRQQ0Y1KFNIQURPV01BUF9BQ0NFUFQoc2hhZG93TWFwKSwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgb21uaUF0bGFzVmlld3BvcnQsIGZsb2F0IHNoYWRvd0VkZ2VQaXhlbHMsIHZlYzMgbGlnaHREaXIpIHtcblxuICAgICAgICBmbG9hdCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiA9IHNoYWRvd1BhcmFtcy54O1xuICAgICAgICB2ZWMyIHV2ID0gZ2V0Q3ViZW1hcEF0bGFzQ29vcmRpbmF0ZXMob21uaUF0bGFzVmlld3BvcnQsIHNoYWRvd0VkZ2VQaXhlbHMsIHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uLCBsaWdodERpcik7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93WiA9IGxlbmd0aChsaWdodERpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56O1xuICAgICAgICB2ZWMzIHNoYWRvd0Nvb3JkID0gdmVjMyh1diwgc2hhZG93Wik7XG4gICAgICAgIHJldHVybiBnZXRTaGFkb3dQQ0Y1eDUoU0hBRE9XTUFQX1BBU1Moc2hhZG93TWFwKSwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcy54eXopO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4jZWxzZVxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YxKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93T21uaUNsdXN0ZXJlZFBDRjEoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgb21uaUF0bGFzVmlld3BvcnQsIGZsb2F0IHNoYWRvd0VkZ2VQaXhlbHMsIHZlYzMgbGlnaHREaXIpIHtcblxuICAgICAgICBmbG9hdCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiA9IHNoYWRvd1BhcmFtcy54O1xuICAgICAgICB2ZWMyIHV2ID0gZ2V0Q3ViZW1hcEF0bGFzQ29vcmRpbmF0ZXMob21uaUF0bGFzVmlld3BvcnQsIHNoYWRvd0VkZ2VQaXhlbHMsIHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uLCBsaWdodERpcik7XG5cbiAgICAgICAgLy8gbm8gZmlsdGVyIHNoYWRvdyBzYW1wbGluZ1xuICAgICAgICBmbG9hdCBkZXB0aCA9IHVucGFja0Zsb2F0KHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCB1dikpO1xuICAgICAgICBmbG9hdCBzaGFkb3daID0gbGVuZ3RoKGxpZ2h0RGlyKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLno7XG4gICAgICAgIHJldHVybiBkZXB0aCA+IHNoYWRvd1ogPyAxLjAgOiAwLjA7XG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjMpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dPbW5pQ2x1c3RlcmVkUENGMyhzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyBvbW5pQXRsYXNWaWV3cG9ydCwgZmxvYXQgc2hhZG93RWRnZVBpeGVscywgdmVjMyBsaWdodERpcikge1xuXG4gICAgICAgIGZsb2F0IHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uID0gc2hhZG93UGFyYW1zLng7XG4gICAgICAgIHZlYzIgdXYgPSBnZXRDdWJlbWFwQXRsYXNDb29yZGluYXRlcyhvbW5pQXRsYXNWaWV3cG9ydCwgc2hhZG93RWRnZVBpeGVscywgc2hhZG93VGV4dHVyZVJlc29sdXRpb24sIGxpZ2h0RGlyKTtcblxuICAgICAgICAvLyBwY2YzXG4gICAgICAgIGZsb2F0IHNoYWRvd1ogPSBsZW5ndGgobGlnaHREaXIpICogc2hhZG93UGFyYW1zLncgKyBzaGFkb3dQYXJhbXMuejtcbiAgICAgICAgdmVjMyBzaGFkb3dDb29yZCA9IHZlYzModXYsIHNoYWRvd1opO1xuICAgICAgICByZXR1cm4gZ2V0U2hhZG93UENGM3gzKHNoYWRvd01hcCwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcy54eXopO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0Y1KVxuXG4gICAgLy8gd2UgZG9uJ3QgaGF2ZSBQQ0Y1IGltcGxlbWVudGF0aW9uIGZvciB3ZWJnbDEsIHVzZSBQQ0YzXG4gICAgZmxvYXQgZ2V0U2hhZG93T21uaUNsdXN0ZXJlZFBDRjUoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgb21uaUF0bGFzVmlld3BvcnQsIGZsb2F0IHNoYWRvd0VkZ2VQaXhlbHMsIHZlYzMgbGlnaHREaXIpIHtcblxuICAgICAgICBmbG9hdCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiA9IHNoYWRvd1BhcmFtcy54O1xuICAgICAgICB2ZWMyIHV2ID0gZ2V0Q3ViZW1hcEF0bGFzQ29vcmRpbmF0ZXMob21uaUF0bGFzVmlld3BvcnQsIHNoYWRvd0VkZ2VQaXhlbHMsIHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uLCBsaWdodERpcik7XG5cbiAgICAgICAgLy8gcGNmM1xuICAgICAgICBmbG9hdCBzaGFkb3daID0gbGVuZ3RoKGxpZ2h0RGlyKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLno7XG4gICAgICAgIHZlYzMgc2hhZG93Q29vcmQgPSB2ZWMzKHV2LCBzaGFkb3daKTtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1BDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLCBzaGFkb3dQYXJhbXMueHl6KTtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuI2VuZGlmXG5cblxuLy8gQ2x1c3RlcmVkIFNwb3QgU2FtcGxpbmcgdXNpbmcgYXRsYXNcblxuI2lmZGVmIEdMMlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YxKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjEoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgICAgICByZXR1cm4gdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkKTtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuICAgICNpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGMylcblxuICAgIGZsb2F0IGdldFNoYWRvd1Nwb3RDbHVzdGVyZWRQQ0YzKFNIQURPV01BUF9BQ0NFUFQoc2hhZG93TWFwKSwgdmVjMyBzaGFkb3dDb29yZCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1Nwb3RQQ0YzeDMoU0hBRE9XTUFQX1BBU1Moc2hhZG93TWFwKSwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcyk7XG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjUpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dTcG90Q2x1c3RlcmVkUENGNShTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgICAgIHJldHVybiBnZXRTaGFkb3dQQ0Y1eDUoU0hBRE9XTUFQX1BBU1Moc2hhZG93TWFwKSwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcy54eXopO1xuICAgIH1cbiAgICAjZW5kaWZcblxuI2Vsc2VcblxuICAgICNpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGMSlcblxuICAgIGZsb2F0IGdldFNoYWRvd1Nwb3RDbHVzdGVyZWRQQ0YxKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG5cbiAgICAgICAgZmxvYXQgZGVwdGggPSB1bnBhY2tGbG9hdCh0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgc2hhZG93Q29vcmQueHkpKTtcblxuICAgICAgICByZXR1cm4gZGVwdGggPiBzaGFkb3dDb29yZC56ID8gMS4wIDogMC4wO1xuXG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjMpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dTcG90Q2x1c3RlcmVkUENGMyhzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgICAgICByZXR1cm4gZ2V0U2hhZG93U3BvdFBDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLCBzaGFkb3dQYXJhbXMpO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0Y1KVxuXG4gICAgLy8gd2UgZG9uJ3QgaGF2ZSBQQ0Y1IGltcGxlbWVudGF0aW9uIGZvciB3ZWJnbDEsIHVzZSBQQ0YzXG4gICAgZmxvYXQgZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjUoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dDb29yZCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1Nwb3RQQ0YzeDMoc2hhZG93TWFwLCBzaGFkb3dDb29yZCwgc2hhZG93UGFyYW1zKTtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuI2VuZGlmXG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDhCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
