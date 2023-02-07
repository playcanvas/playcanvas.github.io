/**
 * @license
 * PlayCanvas Engine v1.62.0-dev revision 7d088032c (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var clusteredLightShadowsPS = /* glsl */`
// Clustered Omni Sampling using atlas

#ifdef GL2

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowOmniClusteredPCF1(sampler2DShadow shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        return textureShadow(shadowMap, vec3(uv, shadowZ));
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowOmniClusteredPCF3(sampler2DShadow shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        dShadowCoord = vec3(uv, shadowZ);
        return getShadowPCF3x3(shadowMap, shadowParams.xyz);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    float getShadowOmniClusteredPCF5(sampler2DShadow shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        dShadowCoord = vec3(uv, shadowZ);
        return getShadowPCF5x5(shadowMap, shadowParams.xyz);
    }

    #endif

#else

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowOmniClusteredPCF1(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        // no filter shadow sampling
        float depth = unpackFloat(textureShadow(shadowMap, uv));
        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        return depth > shadowZ ? 1.0 : 0.0;
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowOmniClusteredPCF3(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        // pcf3
        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        dShadowCoord = vec3(uv, shadowZ);
        return getShadowPCF3x3(shadowMap, shadowParams.xyz);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    // we don't have PCF5 implementation for webgl1, use PCF3
    float getShadowOmniClusteredPCF5(sampler2D shadowMap, vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 dir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, dir);

        // pcf3
        float shadowZ = length(dir) * shadowParams.w + shadowParams.z;
        dShadowCoord = vec3(uv, shadowZ);
        return getShadowPCF3x3(shadowMap, shadowParams.xyz);
    }

    #endif

#endif


// Clustered Spot Sampling using atlas

#ifdef GL2

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowSpotClusteredPCF1(sampler2DShadow shadowMap, vec4 shadowParams) {
        return textureShadow(shadowMap, dShadowCoord);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowSpotClusteredPCF3(sampler2DShadow shadowMap, vec4 shadowParams) {
        return getShadowSpotPCF3x3(shadowMap, shadowParams);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    float getShadowSpotClusteredPCF5(sampler2DShadow shadowMap, vec4 shadowParams) {
        return getShadowPCF5x5(shadowMap, shadowParams.xyz);
    }
    #endif

#else

    #if defined(CLUSTER_SHADOW_TYPE_PCF1)

    float getShadowSpotClusteredPCF1(sampler2D shadowMap, vec4 shadowParams) {

        float depth = unpackFloat(textureShadow(shadowMap, dShadowCoord.xy));

        return depth > dShadowCoord.z ? 1.0 : 0.0;

    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF3)

    float getShadowSpotClusteredPCF3(sampler2D shadowMap, vec4 shadowParams) {
        return getShadowSpotPCF3x3(shadowMap, shadowParams);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    // we don't have PCF5 implementation for webgl1, use PCF3
    float getShadowSpotClusteredPCF5(sampler2D shadowMap, vec4 shadowParams) {
        return getShadowSpotPCF3x3(shadowMap, shadowParams);
    }

    #endif

#endif
`;

export { clusteredLightShadowsPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2x1c3RlcmVkTGlnaHRTaGFkb3dzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvY2x1c3RlcmVkTGlnaHRTaGFkb3dzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBDbHVzdGVyZWQgT21uaSBTYW1wbGluZyB1c2luZyBhdGxhc1xuXG4jaWZkZWYgR0wyXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjEpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dPbW5pQ2x1c3RlcmVkUENGMShzYW1wbGVyMkRTaGFkb3cgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyBvbW5pQXRsYXNWaWV3cG9ydCwgZmxvYXQgc2hhZG93RWRnZVBpeGVscywgdmVjMyBkaXIpIHtcblxuICAgICAgICBmbG9hdCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiA9IHNoYWRvd1BhcmFtcy54O1xuICAgICAgICB2ZWMyIHV2ID0gZ2V0Q3ViZW1hcEF0bGFzQ29vcmRpbmF0ZXMob21uaUF0bGFzVmlld3BvcnQsIHNoYWRvd0VkZ2VQaXhlbHMsIHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uLCBkaXIpO1xuXG4gICAgICAgIGZsb2F0IHNoYWRvd1ogPSBsZW5ndGgoZGlyKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLno7XG4gICAgICAgIHJldHVybiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1diwgc2hhZG93WikpO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YzKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93T21uaUNsdXN0ZXJlZFBDRjMoc2FtcGxlcjJEU2hhZG93IHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgb21uaUF0bGFzVmlld3BvcnQsIGZsb2F0IHNoYWRvd0VkZ2VQaXhlbHMsIHZlYzMgZGlyKSB7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93VGV4dHVyZVJlc29sdXRpb24gPSBzaGFkb3dQYXJhbXMueDtcbiAgICAgICAgdmVjMiB1diA9IGdldEN1YmVtYXBBdGxhc0Nvb3JkaW5hdGVzKG9tbmlBdGxhc1ZpZXdwb3J0LCBzaGFkb3dFZGdlUGl4ZWxzLCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgZGlyKTtcblxuICAgICAgICBmbG9hdCBzaGFkb3daID0gbGVuZ3RoKGRpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56O1xuICAgICAgICBkU2hhZG93Q29vcmQgPSB2ZWMzKHV2LCBzaGFkb3daKTtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1BDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcy54eXopO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0Y1KVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93T21uaUNsdXN0ZXJlZFBDRjUoc2FtcGxlcjJEU2hhZG93IHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgb21uaUF0bGFzVmlld3BvcnQsIGZsb2F0IHNoYWRvd0VkZ2VQaXhlbHMsIHZlYzMgZGlyKSB7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93VGV4dHVyZVJlc29sdXRpb24gPSBzaGFkb3dQYXJhbXMueDtcbiAgICAgICAgdmVjMiB1diA9IGdldEN1YmVtYXBBdGxhc0Nvb3JkaW5hdGVzKG9tbmlBdGxhc1ZpZXdwb3J0LCBzaGFkb3dFZGdlUGl4ZWxzLCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgZGlyKTtcblxuICAgICAgICBmbG9hdCBzaGFkb3daID0gbGVuZ3RoKGRpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56O1xuICAgICAgICBkU2hhZG93Q29vcmQgPSB2ZWMzKHV2LCBzaGFkb3daKTtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1BDRjV4NShzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcy54eXopO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4jZWxzZVxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YxKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93T21uaUNsdXN0ZXJlZFBDRjEoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgb21uaUF0bGFzVmlld3BvcnQsIGZsb2F0IHNoYWRvd0VkZ2VQaXhlbHMsIHZlYzMgZGlyKSB7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93VGV4dHVyZVJlc29sdXRpb24gPSBzaGFkb3dQYXJhbXMueDtcbiAgICAgICAgdmVjMiB1diA9IGdldEN1YmVtYXBBdGxhc0Nvb3JkaW5hdGVzKG9tbmlBdGxhc1ZpZXdwb3J0LCBzaGFkb3dFZGdlUGl4ZWxzLCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgZGlyKTtcblxuICAgICAgICAvLyBubyBmaWx0ZXIgc2hhZG93IHNhbXBsaW5nXG4gICAgICAgIGZsb2F0IGRlcHRoID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHV2KSk7XG4gICAgICAgIGZsb2F0IHNoYWRvd1ogPSBsZW5ndGgoZGlyKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLno7XG4gICAgICAgIHJldHVybiBkZXB0aCA+IHNoYWRvd1ogPyAxLjAgOiAwLjA7XG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjMpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dPbW5pQ2x1c3RlcmVkUENGMyhzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyBvbW5pQXRsYXNWaWV3cG9ydCwgZmxvYXQgc2hhZG93RWRnZVBpeGVscywgdmVjMyBkaXIpIHtcblxuICAgICAgICBmbG9hdCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiA9IHNoYWRvd1BhcmFtcy54O1xuICAgICAgICB2ZWMyIHV2ID0gZ2V0Q3ViZW1hcEF0bGFzQ29vcmRpbmF0ZXMob21uaUF0bGFzVmlld3BvcnQsIHNoYWRvd0VkZ2VQaXhlbHMsIHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uLCBkaXIpO1xuXG4gICAgICAgIC8vIHBjZjNcbiAgICAgICAgZmxvYXQgc2hhZG93WiA9IGxlbmd0aChkaXIpICogc2hhZG93UGFyYW1zLncgKyBzaGFkb3dQYXJhbXMuejtcbiAgICAgICAgZFNoYWRvd0Nvb3JkID0gdmVjMyh1diwgc2hhZG93Wik7XG4gICAgICAgIHJldHVybiBnZXRTaGFkb3dQQ0YzeDMoc2hhZG93TWFwLCBzaGFkb3dQYXJhbXMueHl6KTtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuICAgICNpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGNSlcblxuICAgIC8vIHdlIGRvbid0IGhhdmUgUENGNSBpbXBsZW1lbnRhdGlvbiBmb3Igd2ViZ2wxLCB1c2UgUENGM1xuICAgIGZsb2F0IGdldFNoYWRvd09tbmlDbHVzdGVyZWRQQ0Y1KHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzQgc2hhZG93UGFyYW1zLCB2ZWMzIG9tbmlBdGxhc1ZpZXdwb3J0LCBmbG9hdCBzaGFkb3dFZGdlUGl4ZWxzLCB2ZWMzIGRpcikge1xuXG4gICAgICAgIGZsb2F0IHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uID0gc2hhZG93UGFyYW1zLng7XG4gICAgICAgIHZlYzIgdXYgPSBnZXRDdWJlbWFwQXRsYXNDb29yZGluYXRlcyhvbW5pQXRsYXNWaWV3cG9ydCwgc2hhZG93RWRnZVBpeGVscywgc2hhZG93VGV4dHVyZVJlc29sdXRpb24sIGRpcik7XG5cbiAgICAgICAgLy8gcGNmM1xuICAgICAgICBmbG9hdCBzaGFkb3daID0gbGVuZ3RoKGRpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56O1xuICAgICAgICBkU2hhZG93Q29vcmQgPSB2ZWMzKHV2LCBzaGFkb3daKTtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1BDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcy54eXopO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4jZW5kaWZcblxuXG4vLyBDbHVzdGVyZWQgU3BvdCBTYW1wbGluZyB1c2luZyBhdGxhc1xuXG4jaWZkZWYgR0wyXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjEpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dTcG90Q2x1c3RlcmVkUENGMShzYW1wbGVyMkRTaGFkb3cgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgICAgICByZXR1cm4gdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIGRTaGFkb3dDb29yZCk7XG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjMpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dTcG90Q2x1c3RlcmVkUENGMyhzYW1wbGVyMkRTaGFkb3cgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgICAgICByZXR1cm4gZ2V0U2hhZG93U3BvdFBDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd1BhcmFtcyk7XG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjUpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dTcG90Q2x1c3RlcmVkUENGNShzYW1wbGVyMkRTaGFkb3cgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgICAgICByZXR1cm4gZ2V0U2hhZG93UENGNXg1KHNoYWRvd01hcCwgc2hhZG93UGFyYW1zLnh5eik7XG4gICAgfVxuICAgICNlbmRpZlxuXG4jZWxzZVxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YxKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjEoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcblxuICAgICAgICBmbG9hdCBkZXB0aCA9IHVucGFja0Zsb2F0KHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCBkU2hhZG93Q29vcmQueHkpKTtcblxuICAgICAgICByZXR1cm4gZGVwdGggPiBkU2hhZG93Q29vcmQueiA/IDEuMCA6IDAuMDtcblxuICAgIH1cblxuICAgICNlbmRpZlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YzKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjMoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1Nwb3RQQ0YzeDMoc2hhZG93TWFwLCBzaGFkb3dQYXJhbXMpO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0Y1KVxuXG4gICAgLy8gd2UgZG9uJ3QgaGF2ZSBQQ0Y1IGltcGxlbWVudGF0aW9uIGZvciB3ZWJnbDEsIHVzZSBQQ0YzXG4gICAgZmxvYXQgZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjUoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1Nwb3RQQ0YzeDMoc2hhZG93TWFwLCBzaGFkb3dQYXJhbXMpO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4jZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSw4QkFBZSxVQUFXLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
