var clusteredLightShadowsPS = /* glsl */`
// Clustered Omni Sampling using atlas


void _getShadowCoordPerspZbuffer(mat4 shadowMatrix, vec4 shadowParams, vec3 wPos) {
    vec4 projPos = shadowMatrix * vec4(wPos, 1.0);
    projPos.xyz /= projPos.w;
    dShadowCoord = projPos.xyz;
    // depth bias is already applied on render
}

void getShadowCoordPerspZbufferNormalOffset(mat4 shadowMatrix, vec4 shadowParams, vec3 normal) {
    vec3 wPos = vPositionW + normal * shadowParams.y;
    _getShadowCoordPerspZbuffer(shadowMatrix, shadowParams, wPos);
}

vec3 normalOffsetPointShadow(vec4 shadowParams, vec3 lightPos, inout vec3 lightDir, vec3 lightDirNorm, vec3 normal) {
    float distScale = length(lightDir);
    vec3 wPos = vPositionW + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - lightPos;
    return dir;
}

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
        return getShadowPCF3x3(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
    }

    #endif

    #if defined(CLUSTER_SHADOW_TYPE_PCF5)

    float getShadowOmniClusteredPCF5(SHADOWMAP_ACCEPT(shadowMap), vec4 shadowParams, vec3 omniAtlasViewport, float shadowEdgePixels, vec3 lightDir) {

        float shadowTextureResolution = shadowParams.x;
        vec2 uv = getCubemapAtlasCoordinates(omniAtlasViewport, shadowEdgePixels, shadowTextureResolution, lightDir);

        float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;
        vec3 shadowCoord = vec3(uv, shadowZ);
        return getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
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
        return getShadowPCF3x3(shadowMap, shadowCoord, shadowParams);
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
        return getShadowPCF3x3(shadowMap, shadowCoord, shadowParams);
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
        return getShadowPCF5x5(SHADOWMAP_PASS(shadowMap), shadowCoord, shadowParams);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2x1c3RlcmVkTGlnaHRTaGFkb3dzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvY2x1c3RlcmVkTGlnaHRTaGFkb3dzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4vLyBDbHVzdGVyZWQgT21uaSBTYW1wbGluZyB1c2luZyBhdGxhc1xuXG5cbnZvaWQgX2dldFNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyKG1hdDQgc2hhZG93TWF0cml4LCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyB3UG9zKSB7XG4gICAgdmVjNCBwcm9qUG9zID0gc2hhZG93TWF0cml4ICogdmVjNCh3UG9zLCAxLjApO1xuICAgIHByb2pQb3MueHl6IC89IHByb2pQb3MudztcbiAgICBkU2hhZG93Q29vcmQgPSBwcm9qUG9zLnh5ejtcbiAgICAvLyBkZXB0aCBiaWFzIGlzIGFscmVhZHkgYXBwbGllZCBvbiByZW5kZXJcbn1cblxudm9pZCBnZXRTaGFkb3dDb29yZFBlcnNwWmJ1ZmZlck5vcm1hbE9mZnNldChtYXQ0IHNoYWRvd01hdHJpeCwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgbm9ybWFsKSB7XG4gICAgdmVjMyB3UG9zID0gdlBvc2l0aW9uVyArIG5vcm1hbCAqIHNoYWRvd1BhcmFtcy55O1xuICAgIF9nZXRTaGFkb3dDb29yZFBlcnNwWmJ1ZmZlcihzaGFkb3dNYXRyaXgsIHNoYWRvd1BhcmFtcywgd1Bvcyk7XG59XG5cbnZlYzMgbm9ybWFsT2Zmc2V0UG9pbnRTaGFkb3codmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgbGlnaHRQb3MsIGlub3V0IHZlYzMgbGlnaHREaXIsIHZlYzMgbGlnaHREaXJOb3JtLCB2ZWMzIG5vcm1hbCkge1xuICAgIGZsb2F0IGRpc3RTY2FsZSA9IGxlbmd0aChsaWdodERpcik7XG4gICAgdmVjMyB3UG9zID0gdlBvc2l0aW9uVyArIG5vcm1hbCAqIHNoYWRvd1BhcmFtcy55ICogY2xhbXAoMS4wIC0gZG90KG5vcm1hbCwgLWxpZ2h0RGlyTm9ybSksIDAuMCwgMS4wKSAqIGRpc3RTY2FsZTsgLy8wLjAyXG4gICAgdmVjMyBkaXIgPSB3UG9zIC0gbGlnaHRQb3M7XG4gICAgcmV0dXJuIGRpcjtcbn1cblxuI2lmZGVmIEdMMlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YxKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93T21uaUNsdXN0ZXJlZFBDRjEoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyBvbW5pQXRsYXNWaWV3cG9ydCwgZmxvYXQgc2hhZG93RWRnZVBpeGVscywgdmVjMyBsaWdodERpcikge1xuXG4gICAgICAgIGZsb2F0IHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uID0gc2hhZG93UGFyYW1zLng7XG4gICAgICAgIHZlYzIgdXYgPSBnZXRDdWJlbWFwQXRsYXNDb29yZGluYXRlcyhvbW5pQXRsYXNWaWV3cG9ydCwgc2hhZG93RWRnZVBpeGVscywgc2hhZG93VGV4dHVyZVJlc29sdXRpb24sIGxpZ2h0RGlyKTtcblxuICAgICAgICBmbG9hdCBzaGFkb3daID0gbGVuZ3RoKGxpZ2h0RGlyKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLno7XG4gICAgICAgIHJldHVybiB0ZXh0dXJlU2hhZG93KHNoYWRvd01hcCwgdmVjMyh1diwgc2hhZG93WikpO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YzKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93T21uaUNsdXN0ZXJlZFBDRjMoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyBvbW5pQXRsYXNWaWV3cG9ydCwgZmxvYXQgc2hhZG93RWRnZVBpeGVscywgdmVjMyBsaWdodERpcikge1xuXG4gICAgICAgIGZsb2F0IHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uID0gc2hhZG93UGFyYW1zLng7XG4gICAgICAgIHZlYzIgdXYgPSBnZXRDdWJlbWFwQXRsYXNDb29yZGluYXRlcyhvbW5pQXRsYXNWaWV3cG9ydCwgc2hhZG93RWRnZVBpeGVscywgc2hhZG93VGV4dHVyZVJlc29sdXRpb24sIGxpZ2h0RGlyKTtcblxuICAgICAgICBmbG9hdCBzaGFkb3daID0gbGVuZ3RoKGxpZ2h0RGlyKSAqIHNoYWRvd1BhcmFtcy53ICsgc2hhZG93UGFyYW1zLno7XG4gICAgICAgIHZlYzMgc2hhZG93Q29vcmQgPSB2ZWMzKHV2LCBzaGFkb3daKTtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1BDRjN4MyhTSEFET1dNQVBfUEFTUyhzaGFkb3dNYXApLCBzaGFkb3dDb29yZCwgc2hhZG93UGFyYW1zKTtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuICAgICNpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGNSlcblxuICAgIGZsb2F0IGdldFNoYWRvd09tbmlDbHVzdGVyZWRQQ0Y1KFNIQURPV01BUF9BQ0NFUFQoc2hhZG93TWFwKSwgdmVjNCBzaGFkb3dQYXJhbXMsIHZlYzMgb21uaUF0bGFzVmlld3BvcnQsIGZsb2F0IHNoYWRvd0VkZ2VQaXhlbHMsIHZlYzMgbGlnaHREaXIpIHtcblxuICAgICAgICBmbG9hdCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiA9IHNoYWRvd1BhcmFtcy54O1xuICAgICAgICB2ZWMyIHV2ID0gZ2V0Q3ViZW1hcEF0bGFzQ29vcmRpbmF0ZXMob21uaUF0bGFzVmlld3BvcnQsIHNoYWRvd0VkZ2VQaXhlbHMsIHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uLCBsaWdodERpcik7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93WiA9IGxlbmd0aChsaWdodERpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56O1xuICAgICAgICB2ZWMzIHNoYWRvd0Nvb3JkID0gdmVjMyh1diwgc2hhZG93Wik7XG4gICAgICAgIHJldHVybiBnZXRTaGFkb3dQQ0Y1eDUoU0hBRE9XTUFQX1BBU1Moc2hhZG93TWFwKSwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcyk7XG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiNlbHNlXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjEpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dPbW5pQ2x1c3RlcmVkUENGMShzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyBvbW5pQXRsYXNWaWV3cG9ydCwgZmxvYXQgc2hhZG93RWRnZVBpeGVscywgdmVjMyBsaWdodERpcikge1xuXG4gICAgICAgIGZsb2F0IHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uID0gc2hhZG93UGFyYW1zLng7XG4gICAgICAgIHZlYzIgdXYgPSBnZXRDdWJlbWFwQXRsYXNDb29yZGluYXRlcyhvbW5pQXRsYXNWaWV3cG9ydCwgc2hhZG93RWRnZVBpeGVscywgc2hhZG93VGV4dHVyZVJlc29sdXRpb24sIGxpZ2h0RGlyKTtcblxuICAgICAgICAvLyBubyBmaWx0ZXIgc2hhZG93IHNhbXBsaW5nXG4gICAgICAgIGZsb2F0IGRlcHRoID0gdW5wYWNrRmxvYXQodGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHV2KSk7XG4gICAgICAgIGZsb2F0IHNoYWRvd1ogPSBsZW5ndGgobGlnaHREaXIpICogc2hhZG93UGFyYW1zLncgKyBzaGFkb3dQYXJhbXMuejtcbiAgICAgICAgcmV0dXJuIGRlcHRoID4gc2hhZG93WiA/IDEuMCA6IDAuMDtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuICAgICNpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGMylcblxuICAgIGZsb2F0IGdldFNoYWRvd09tbmlDbHVzdGVyZWRQQ0YzKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzQgc2hhZG93UGFyYW1zLCB2ZWMzIG9tbmlBdGxhc1ZpZXdwb3J0LCBmbG9hdCBzaGFkb3dFZGdlUGl4ZWxzLCB2ZWMzIGxpZ2h0RGlyKSB7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93VGV4dHVyZVJlc29sdXRpb24gPSBzaGFkb3dQYXJhbXMueDtcbiAgICAgICAgdmVjMiB1diA9IGdldEN1YmVtYXBBdGxhc0Nvb3JkaW5hdGVzKG9tbmlBdGxhc1ZpZXdwb3J0LCBzaGFkb3dFZGdlUGl4ZWxzLCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgbGlnaHREaXIpO1xuXG4gICAgICAgIC8vIHBjZjNcbiAgICAgICAgZmxvYXQgc2hhZG93WiA9IGxlbmd0aChsaWdodERpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56O1xuICAgICAgICB2ZWMzIHNoYWRvd0Nvb3JkID0gdmVjMyh1diwgc2hhZG93Wik7XG4gICAgICAgIHJldHVybiBnZXRTaGFkb3dQQ0YzeDMoc2hhZG93TWFwLCBzaGFkb3dDb29yZCwgc2hhZG93UGFyYW1zKTtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuICAgICNpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGNSlcblxuICAgIC8vIHdlIGRvbid0IGhhdmUgUENGNSBpbXBsZW1lbnRhdGlvbiBmb3Igd2ViZ2wxLCB1c2UgUENGM1xuICAgIGZsb2F0IGdldFNoYWRvd09tbmlDbHVzdGVyZWRQQ0Y1KHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzQgc2hhZG93UGFyYW1zLCB2ZWMzIG9tbmlBdGxhc1ZpZXdwb3J0LCBmbG9hdCBzaGFkb3dFZGdlUGl4ZWxzLCB2ZWMzIGxpZ2h0RGlyKSB7XG5cbiAgICAgICAgZmxvYXQgc2hhZG93VGV4dHVyZVJlc29sdXRpb24gPSBzaGFkb3dQYXJhbXMueDtcbiAgICAgICAgdmVjMiB1diA9IGdldEN1YmVtYXBBdGxhc0Nvb3JkaW5hdGVzKG9tbmlBdGxhc1ZpZXdwb3J0LCBzaGFkb3dFZGdlUGl4ZWxzLCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgbGlnaHREaXIpO1xuXG4gICAgICAgIC8vIHBjZjNcbiAgICAgICAgZmxvYXQgc2hhZG93WiA9IGxlbmd0aChsaWdodERpcikgKiBzaGFkb3dQYXJhbXMudyArIHNoYWRvd1BhcmFtcy56O1xuICAgICAgICB2ZWMzIHNoYWRvd0Nvb3JkID0gdmVjMyh1diwgc2hhZG93Wik7XG4gICAgICAgIHJldHVybiBnZXRTaGFkb3dQQ0YzeDMoc2hhZG93TWFwLCBzaGFkb3dDb29yZCwgc2hhZG93UGFyYW1zKTtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuI2VuZGlmXG5cblxuLy8gQ2x1c3RlcmVkIFNwb3QgU2FtcGxpbmcgdXNpbmcgYXRsYXNcblxuI2lmZGVmIEdMMlxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YxKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjEoU0hBRE9XTUFQX0FDQ0VQVChzaGFkb3dNYXApLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgICAgICByZXR1cm4gdGV4dHVyZVNoYWRvdyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkKTtcbiAgICB9XG5cbiAgICAjZW5kaWZcblxuICAgICNpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGMylcblxuICAgIGZsb2F0IGdldFNoYWRvd1Nwb3RDbHVzdGVyZWRQQ0YzKFNIQURPV01BUF9BQ0NFUFQoc2hhZG93TWFwKSwgdmVjMyBzaGFkb3dDb29yZCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcbiAgICAgICAgcmV0dXJuIGdldFNoYWRvd1Nwb3RQQ0YzeDMoU0hBRE9XTUFQX1BBU1Moc2hhZG93TWFwKSwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcyk7XG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjUpXG5cbiAgICBmbG9hdCBnZXRTaGFkb3dTcG90Q2x1c3RlcmVkUENGNShTSEFET1dNQVBfQUNDRVBUKHNoYWRvd01hcCksIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgICAgIHJldHVybiBnZXRTaGFkb3dQQ0Y1eDUoU0hBRE9XTUFQX1BBU1Moc2hhZG93TWFwKSwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcyk7XG4gICAgfVxuICAgICNlbmRpZlxuXG4jZWxzZVxuXG4gICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YxKVxuXG4gICAgZmxvYXQgZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjEoc2FtcGxlcjJEIHNoYWRvd01hcCwgdmVjMyBzaGFkb3dDb29yZCwgdmVjNCBzaGFkb3dQYXJhbXMpIHtcblxuICAgICAgICBmbG9hdCBkZXB0aCA9IHVucGFja0Zsb2F0KHRleHR1cmVTaGFkb3coc2hhZG93TWFwLCBzaGFkb3dDb29yZC54eSkpO1xuXG4gICAgICAgIHJldHVybiBkZXB0aCA+IHNoYWRvd0Nvb3JkLnogPyAxLjAgOiAwLjA7XG5cbiAgICB9XG5cbiAgICAjZW5kaWZcblxuICAgICNpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGMylcblxuICAgIGZsb2F0IGdldFNoYWRvd1Nwb3RDbHVzdGVyZWRQQ0YzKHNhbXBsZXIyRCBzaGFkb3dNYXAsIHZlYzMgc2hhZG93Q29vcmQsIHZlYzQgc2hhZG93UGFyYW1zKSB7XG4gICAgICAgIHJldHVybiBnZXRTaGFkb3dTcG90UENGM3gzKHNoYWRvd01hcCwgc2hhZG93Q29vcmQsIHNoYWRvd1BhcmFtcyk7XG4gICAgfVxuXG4gICAgI2VuZGlmXG5cbiAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjUpXG5cbiAgICAvLyB3ZSBkb24ndCBoYXZlIFBDRjUgaW1wbGVtZW50YXRpb24gZm9yIHdlYmdsMSwgdXNlIFBDRjNcbiAgICBmbG9hdCBnZXRTaGFkb3dTcG90Q2x1c3RlcmVkUENGNShzYW1wbGVyMkQgc2hhZG93TWFwLCB2ZWMzIHNoYWRvd0Nvb3JkLCB2ZWM0IHNoYWRvd1BhcmFtcykge1xuICAgICAgICByZXR1cm4gZ2V0U2hhZG93U3BvdFBDRjN4MyhzaGFkb3dNYXAsIHNoYWRvd0Nvb3JkLCBzaGFkb3dQYXJhbXMpO1xuICAgIH1cblxuICAgICNlbmRpZlxuXG4jZW5kaWZcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsOEJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
