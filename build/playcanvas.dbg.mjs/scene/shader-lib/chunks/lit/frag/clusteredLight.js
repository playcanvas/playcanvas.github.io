/**
 * @license
 * PlayCanvas Engine v1.58.0-preview revision 1fec26519 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var clusteredLightPS = `
uniform sampler2D clusterWorldTexture;
uniform sampler2D lightsTexture8;
uniform highp sampler2D lightsTextureFloat;

// complex ifdef expression are not supported, handle it here
// defined(CLUSTER_COOKIES) || defined(CLUSTER_SHADOWS)
#if defined(CLUSTER_COOKIES)
    #define CLUSTER_COOKIES_OR_SHADOWS
#endif
#if defined(CLUSTER_SHADOWS)
    #define CLUSTER_COOKIES_OR_SHADOWS
#endif

#ifdef CLUSTER_SHADOWS
    #ifdef GL2
        // TODO: when VSM shadow is supported, it needs to use sampler2D in webgl2
        uniform sampler2DShadow shadowAtlasTexture;
    #else
        uniform sampler2D shadowAtlasTexture;
    #endif
#endif

#ifdef CLUSTER_COOKIES
    uniform sampler2D cookieAtlasTexture;
#endif

uniform float clusterPixelsPerCell;
uniform vec3 clusterCellsCountByBoundsSize;
uniform vec4 lightsTextureInvSize;
uniform vec3 clusterTextureSize;
uniform vec3 clusterBoundsMin;
uniform vec3 clusterBoundsDelta;
uniform vec3 clusterCellsDot;
uniform vec3 clusterCellsMax;
uniform vec2 clusterCompressionLimit0;
uniform vec2 shadowAtlasParams;

// structure storing light properties of a clustered light
struct ClusterLightData {

    // v coordinate to look up the light textures
    float lightV;

    // type of the light (spot or omni)
    float type;

    // area light shape
    float shape;

    // area light sizes / orientation
    vec3 halfWidth;
    vec3 halfHeight;

    // light follow mode
    float falloffMode;

    // 0.0 if the light doesn't cast shadows
    float shadowIntensity;

    // shadow bias values
    float shadowBias;
    float shadowNormalBias;

    // world space position
    vec3 position;

    // world space direction (spot light only)
    vec3 direction;

    // range of the light
    float range;

    // spot light inner and outer angle cosine
    float innerConeAngleCos;
    float outerConeAngleCos;

    // color
    vec3 color;

    // atlas viewport for omni light shadow and cookie (.xy is offset to the viewport slot, .z is size of the face in the atlas)
    vec3 omniAtlasViewport;

    // 1.0 if the light has a cookie texture
    float cookie;

    // 1.0 if cookie texture is rgb, otherwise it is using a single channel selectable by cookieChannelMask
    float cookieRgb;

    // intensity of the cookie
    float cookieIntensity;

    // channel mask - one of the channels has 1, the others are 0
    vec4 cookieChannelMask;

    // light mask
    float mask;
};

// Note: on some devices (tested on Pixel 3A XL), this matrix when stored inside the light struct has lower precision compared to
// when stored outside, so we store it outside to avoid spot shadow flickering. This might need to be done to other / all members
// of the structure if further similar issues are observed.

// shadow (spot light only) / cookie projection matrix
mat4 lightProjectionMatrix;

// macros for light properties
#define isClusteredLightCastShadow(light) ( light.shadowIntensity > 0.0 )
#define isClusteredLightCookie(light) (light.cookie > 0.5 )
#define isClusteredLightCookieRgb(light) (light.cookieRgb > 0.5 )
#define isClusteredLightSpot(light) ( light.type > 0.5 )
#define isClusteredLightFalloffLinear(light) ( light.falloffMode < 0.5 )

// macros to test light shape
// Note: Following functions need to be called serially in listed order as they do not test both '>' and '<'
#define isClusteredLightArea(light) ( light.shape > 0.1 )
#define isClusteredLightRect(light) ( light.shape < 0.3 )
#define isClusteredLightDisk(light) ( light.shape < 0.6 )

// macro to test light mask (mesh accepts dynamic vs lightmapped lights)
#ifdef CLUSTER_MESH_DYNAMIC_LIGHTS
    // accept lights marked as dynamic or both dynamic and lightmapped
    #define acceptLightMask(light) ( light.mask < 0.75)
#else
    // accept lights marked as lightmapped or both dynamic and lightmapped
    #define acceptLightMask(light) ( light.mask > 0.25)
#endif

vec4 decodeClusterLowRange4Vec4(vec4 d0, vec4 d1, vec4 d2, vec4 d3) {
    return vec4(
        bytes2floatRange4(d0, -2.0, 2.0),
        bytes2floatRange4(d1, -2.0, 2.0),
        bytes2floatRange4(d2, -2.0, 2.0),
        bytes2floatRange4(d3, -2.0, 2.0)
    );
}

vec4 sampleLightsTexture8(const ClusterLightData clusterLightData, float index) {
    return texture2DLodEXT(lightsTexture8, vec2(index * lightsTextureInvSize.z, clusterLightData.lightV), 0.0);
}

vec4 sampleLightTextureF(const ClusterLightData clusterLightData, float index) {
    return texture2DLodEXT(lightsTextureFloat, vec2(index * lightsTextureInvSize.x, clusterLightData.lightV), 0.0);
}

void decodeClusterLightCore(inout ClusterLightData clusterLightData, float lightIndex) {

    // read omni light properties
    clusterLightData.lightV = (lightIndex + 0.5) * lightsTextureInvSize.w;

    // shared data from 8bit texture
    vec4 lightInfo = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_FLAGS);
    clusterLightData.type = lightInfo.x;
    clusterLightData.shape = lightInfo.y;
    clusterLightData.falloffMode = lightInfo.z;
    clusterLightData.shadowIntensity = lightInfo.w;

    // color
    vec4 colorA = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COLOR_A);
    vec4 colorB = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COLOR_B);
    clusterLightData.color = vec3(bytes2float2(colorA.xy), bytes2float2(colorA.zw), bytes2float2(colorB.xy)) * clusterCompressionLimit0.y;

    // cookie
    clusterLightData.cookie = colorB.z;

    // light mask
    clusterLightData.mask = colorB.w;

    #ifdef CLUSTER_TEXTURE_FLOAT

        vec4 lightPosRange = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_POSITION_RANGE);
        clusterLightData.position = lightPosRange.xyz;
        clusterLightData.range = lightPosRange.w;

        // spot light direction
        vec4 lightDir_Unused = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_SPOT_DIRECTION);
        clusterLightData.direction = lightDir_Unused.xyz;

    #else   // 8bit

        vec4 encPosX = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_POSITION_X);
        vec4 encPosY = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_POSITION_Y);
        vec4 encPosZ = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_POSITION_Z);
        clusterLightData.position = vec3(bytes2float4(encPosX), bytes2float4(encPosY), bytes2float4(encPosZ)) * clusterBoundsDelta + clusterBoundsMin;

        vec4 encRange = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_RANGE);
        clusterLightData.range = bytes2float4(encRange) * clusterCompressionLimit0.x;

        // spot light direction
        vec4 encDirX = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SPOT_DIRECTION_X);
        vec4 encDirY = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SPOT_DIRECTION_Y);
        vec4 encDirZ = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SPOT_DIRECTION_Z);
        clusterLightData.direction = vec3(bytes2float4(encDirX), bytes2float4(encDirY), bytes2float4(encDirZ)) * 2.0 - 1.0;

    #endif
}

void decodeClusterLightSpot(inout ClusterLightData clusterLightData) {

    // spot light cos angles
    vec4 coneAngle = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SPOT_ANGLES);
    clusterLightData.innerConeAngleCos = bytes2float2(coneAngle.xy) * 2.0 - 1.0;
    clusterLightData.outerConeAngleCos = bytes2float2(coneAngle.zw) * 2.0 - 1.0;
}

void decodeClusterLightOmniAtlasViewport(inout ClusterLightData clusterLightData) {
    #ifdef CLUSTER_TEXTURE_FLOAT
        clusterLightData.omniAtlasViewport = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_0).xyz;
    #else
        vec4 viewportA = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_ATLAS_VIEWPORT_A);
        vec4 viewportB = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_ATLAS_VIEWPORT_B);
        clusterLightData.omniAtlasViewport = vec3(bytes2float2(viewportA.xy), bytes2float2(viewportA.zw), bytes2float2(viewportB.xy));
    #endif
}

void decodeClusterLightAreaData(inout ClusterLightData clusterLightData) {
    #ifdef CLUSTER_TEXTURE_FLOAT
        clusterLightData.halfWidth = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_AREA_DATA_WIDTH).xyz;
        clusterLightData.halfHeight = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_AREA_DATA_HEIGHT).xyz;
    #else
        vec4 areaWidthX = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_AREA_DATA_WIDTH_X);
        vec4 areaWidthY = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_AREA_DATA_WIDTH_Y);
        vec4 areaWidthZ = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_AREA_DATA_WIDTH_Z);
        clusterLightData.halfWidth = vec3(mantissaExponent2Float(areaWidthX), mantissaExponent2Float(areaWidthY), mantissaExponent2Float(areaWidthZ));

        vec4 areaHeightX = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_AREA_DATA_HEIGHT_X);
        vec4 areaHeightY = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_AREA_DATA_HEIGHT_Y);
        vec4 areaHeightZ = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_AREA_DATA_HEIGHT_Z);
        clusterLightData.halfHeight = vec3(mantissaExponent2Float(areaHeightX), mantissaExponent2Float(areaHeightY), mantissaExponent2Float(areaHeightZ));
    #endif
}

void decodeClusterLightProjectionMatrixData(inout ClusterLightData clusterLightData) {
    
    // shadow matrix
    #ifdef CLUSTER_TEXTURE_FLOAT
        vec4 m0 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_0);
        vec4 m1 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_1);
        vec4 m2 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_2);
        vec4 m3 = sampleLightTextureF(clusterLightData, CLUSTER_TEXTURE_F_PROJ_MAT_3);
    #else
        vec4 m00 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_00);
        vec4 m01 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_01);
        vec4 m02 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_02);
        vec4 m03 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_03);
        vec4 m0 = decodeClusterLowRange4Vec4(m00, m01, m02, m03);

        vec4 m10 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_10);
        vec4 m11 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_11);
        vec4 m12 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_12);
        vec4 m13 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_13);
        vec4 m1 = decodeClusterLowRange4Vec4(m10, m11, m12, m13);

        vec4 m20 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_20);
        vec4 m21 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_21);
        vec4 m22 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_22);
        vec4 m23 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_23);
        vec4 m2 = decodeClusterLowRange4Vec4(m20, m21, m22, m23);

        vec4 m30 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_30);
        vec4 m31 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_31);
        vec4 m32 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_32);
        vec4 m33 = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_PROJ_MAT_33);
        vec4 m3 = vec4(mantissaExponent2Float(m30), mantissaExponent2Float(m31), mantissaExponent2Float(m32), mantissaExponent2Float(m33));
    #endif
    
    lightProjectionMatrix = mat4(m0, m1, m2, m3);
}

void decodeClusterLightShadowData(inout ClusterLightData clusterLightData) {
    
    // shadow biases
    vec4 biases = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_SHADOW_BIAS);
    clusterLightData.shadowBias = bytes2floatRange2(biases.xy, -1.0, 20.0),
    clusterLightData.shadowNormalBias = bytes2float2(biases.zw);
}

void decodeClusterLightCookieData(inout ClusterLightData clusterLightData) {

    vec4 cookieA = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COOKIE_A);
    clusterLightData.cookieIntensity = cookieA.x;
    clusterLightData.cookieRgb = cookieA.y;

    clusterLightData.cookieChannelMask = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_COOKIE_B);
}

void evaluateLight(ClusterLightData light) {

    dAtten3 = vec3(1.0);

    // evaluate omni part of the light
    getLightDirPoint(light.position);

    #ifdef CLUSTER_AREALIGHTS

    // distance attenuation
    if (isClusteredLightArea(light)) { // area light

        // area lights
        decodeClusterLightAreaData(light);

        // handle light shape
        if (isClusteredLightRect(light)) {
            calcRectLightValues(light.position, light.halfWidth, light.halfHeight);
        } else if (isClusteredLightDisk(light)) {
            calcDiskLightValues(light.position, light.halfWidth, light.halfHeight);
        } else { // sphere
            calcSphereLightValues(light.position, light.halfWidth, light.halfHeight);
        }

        dAtten = getFalloffWindow(light.range);

    } else

    #endif

    {   // punctual light

        if (isClusteredLightFalloffLinear(light))
            dAtten = getFalloffLinear(light.range);
        else
            dAtten = getFalloffInvSquared(light.range);
    }

    if (dAtten > 0.00001) {

        #ifdef CLUSTER_AREALIGHTS

        if (isClusteredLightArea(light)) { // area light

            // handle light shape
            if (isClusteredLightRect(light)) {
                dAttenD = getRectLightDiffuse() * 16.0;
            } else if (isClusteredLightDisk(light)) {
                dAttenD = getDiskLightDiffuse() * 16.0;
            } else { // sphere
                dAttenD = getSphereLightDiffuse() * 16.0;
            }

        } else

        #endif

        {
            dAtten *= getLightDiffuse();
        }

        // spot light falloff
        if (isClusteredLightSpot(light)) {
            decodeClusterLightSpot(light);
            dAtten *= getSpotEffect(light.direction, light.innerConeAngleCos, light.outerConeAngleCos);
        }

        #if defined(CLUSTER_COOKIES_OR_SHADOWS)

        if (dAtten > 0.00001) {

            // shadow / cookie
            if (isClusteredLightCastShadow(light) || isClusteredLightCookie(light)) {

                // shared shadow / cookie data depends on light type
                if (isClusteredLightSpot(light)) {
                    decodeClusterLightProjectionMatrixData(light);
                } else {
                    decodeClusterLightOmniAtlasViewport(light);
                }

                float shadowTextureResolution = shadowAtlasParams.x;
                float shadowEdgePixels = shadowAtlasParams.y;

                #ifdef CLUSTER_COOKIES

                // cookie
                if (isClusteredLightCookie(light)) {
                    decodeClusterLightCookieData(light);

                    if (isClusteredLightSpot(light)) {
                        dAtten3 = getCookie2DClustered(cookieAtlasTexture, lightProjectionMatrix, vPositionW, light.cookieIntensity, isClusteredLightCookieRgb(light), light.cookieChannelMask);
                    } else {
                        dAtten3 = getCookieCubeClustered(cookieAtlasTexture, dLightDirW, light.cookieIntensity, isClusteredLightCookieRgb(light), light.cookieChannelMask, shadowTextureResolution, shadowEdgePixels, light.omniAtlasViewport);
                    }
                }

                #endif

                #ifdef CLUSTER_SHADOWS

                // shadow
                if (isClusteredLightCastShadow(light)) {
                    decodeClusterLightShadowData(light);

                    vec4 shadowParams = vec4(shadowTextureResolution, light.shadowNormalBias, light.shadowBias, 1.0 / light.range);

                    if (isClusteredLightSpot(light)) {

                        // spot shadow
                        getShadowCoordPerspZbufferNormalOffset(lightProjectionMatrix, shadowParams);
                        
                        #if defined(CLUSTER_SHADOW_TYPE_PCF1)
                            float shadow = getShadowSpotClusteredPCF1(shadowAtlasTexture, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF3)
                            float shadow = getShadowSpotClusteredPCF3(shadowAtlasTexture, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF5)
                            float shadow = getShadowSpotClusteredPCF5(shadowAtlasTexture, shadowParams);
                        #endif
                        dAtten *= mix(1.0, shadow, light.shadowIntensity);

                    } else {

                        // omni shadow
                        normalOffsetPointShadow(shadowParams);  // normalBias adjusted for distance

                        #if defined(CLUSTER_SHADOW_TYPE_PCF1)
                            float shadow = getShadowOmniClusteredPCF1(shadowAtlasTexture, shadowParams, light.omniAtlasViewport, shadowEdgePixels, dLightDirW);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF3)
                            float shadow = getShadowOmniClusteredPCF3(shadowAtlasTexture, shadowParams, light.omniAtlasViewport, shadowEdgePixels, dLightDirW);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF5)
                            float shadow = getShadowOmniClusteredPCF5(shadowAtlasTexture, shadowParams, light.omniAtlasViewport, shadowEdgePixels, dLightDirW);
                        #endif
                        dAtten *= mix(1.0, shadow, light.shadowIntensity);
                    }
                }

                #endif
            }
        }

        #endif

        // diffuse / specular / clearcoat
        #ifdef CLUSTER_AREALIGHTS

        if (isClusteredLightArea(light)) { // area light

            // area light diffuse
            {
                vec3 areaDiffuse = (dAttenD * dAtten) * light.color * dAtten3;

                #if defined(LIT_SPECULAR)
                    #if defined(LIT_CONSERVE_ENERGY)
                        areaDiffuse = mix(areaDiffuse, vec3(0), dLTCSpecFres);
                    #endif
                #endif

                // area light diffuse - it does not mix diffuse lighting into specular attenuation
                dDiffuseLight += areaDiffuse;
            }

            // specular and clear coat are material settings and get included by a define based on the material
            #ifdef LIT_SPECULAR

                // area light specular
                float areaLightSpecular;

                if (isClusteredLightRect(light)) {
                    areaLightSpecular = getRectLightSpecular();
                } else if (isClusteredLightDisk(light)) {
                    areaLightSpecular = getDiskLightSpecular();
                } else { // sphere
                    areaLightSpecular = getSphereLightSpecular();
                }

                dSpecularLight += dLTCSpecFres * areaLightSpecular * dAtten * light.color * dAtten3;

                #ifdef LIT_CLEARCOAT

                    // area light specular clear coat
                    float areaLightSpecularCC;

                    if (isClusteredLightRect(light)) {
                        areaLightSpecularCC = getRectLightSpecularCC();
                    } else if (isClusteredLightDisk(light)) {
                        areaLightSpecularCC = getDiskLightSpecularCC();
                    } else { // sphere
                        areaLightSpecularCC = getSphereLightSpecularCC();
                    }

                    ccSpecularLight += ccLTCSpecFres * areaLightSpecularCC * dAtten * light.color  * dAtten3;

                #endif

            #endif

        } else

        #endif

        {    // punctual light

            // punctual light diffuse
            {
                vec3 punctualDiffuse = dAtten * light.color * dAtten3;

                #if defined(CLUSTER_AREALIGHTS)
                #if defined(LIT_SPECULAR)
                #if defined(LIT_CONSERVE_ENERGY)
                    punctualDiffuse = mix(punctualDiffuse, vec3(0), dSpecularity);
                #endif
                #endif
                #endif

                dDiffuseLight += punctualDiffuse;
            }
   
            // specular and clear coat are material settings and get included by a define based on the material
            #ifdef LIT_SPECULAR

                vec3 halfDir = normalize(-dLightDirNormW + dViewDirW);
                
                // specular
                #ifdef LIT_SPECULAR_FRESNEL
                    dSpecularLight += getLightSpecular(halfDir) * dAtten * light.color * dAtten3 * getFresnel(dot(dViewDirW, halfDir), dSpecularity);
                #else
                    dSpecularLight += getLightSpecular(halfDir) * dAtten * light.color * dAtten3 * dSpecularity;
                #endif

                #ifdef LIT_CLEARCOAT
                    #ifdef LIT_SPECULAR_FRESNEL
                        ccSpecularLight += getLightSpecularCC(halfDir) * dAtten * light.color * dAtten3 * getFresnelCC(dot(dViewDirW, halfDir));
                    #else
                        ccSpecularLight += getLightSpecularCC(halfDir) * dAtten * light.color * dAtten3;
                    #endif
                #endif

                #ifdef LIT_SHEEN
                    sSpecularLight += getLightSpecularSheen(halfDir) * dAtten * light.color * dAtten3;
                #endif

            #endif
        }
    }
}

void evaluateClusterLight(float lightIndex) {

    // decode core light data from textures
    ClusterLightData clusterLightData;
    decodeClusterLightCore(clusterLightData, lightIndex);

    // evaluate light if it uses accepted light mask
    if (acceptLightMask(clusterLightData))
        evaluateLight(clusterLightData);
}

void addClusteredLights() {
    // world space position to 3d integer cell cordinates in the cluster structure
    vec3 cellCoords = floor((vPositionW - clusterBoundsMin) * clusterCellsCountByBoundsSize);

    // no lighting when cell coordinate is out of range
    if (!(any(lessThan(cellCoords, vec3(0.0))) || any(greaterThanEqual(cellCoords, clusterCellsMax)))) {

        // cell index (mapping from 3d cell coordinates to linear memory)
        float cellIndex = dot(clusterCellsDot, cellCoords);

        // convert cell index to uv coordinates
        float clusterV = floor(cellIndex * clusterTextureSize.y);
        float clusterU = cellIndex - (clusterV * clusterTextureSize.x);
        clusterV = (clusterV + 0.5) * clusterTextureSize.z;

        // loop over maximum possible number of supported light cells
        const float maxLightCells = 256.0 / 4.0;  // 8 bit index, each stores 4 lights
        for (float lightCellIndex = 0.5; lightCellIndex < maxLightCells; lightCellIndex++) {

            vec4 lightIndices = texture2DLodEXT(clusterWorldTexture, vec2(clusterTextureSize.y * (clusterU + lightCellIndex), clusterV), 0.0);
            vec4 indices = lightIndices * 255.0;

            // evaluate up to 4 lights. This is written using a loop instead of manually unrolling to keep shader compile time smaller
            for (int i = 0; i < 4; i++) {
                
                if (indices.x <= 0.0)
                    return;

                evaluateClusterLight(indices.x); 
                indices = indices.yzwx;
            }

            // end of the cell array
            if (lightCellIndex > clusterPixelsPerCell) {
                break;
            }
        }
    }
}
`;

export { clusteredLightPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2x1c3RlcmVkTGlnaHQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9jbHVzdGVyZWRMaWdodC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBzYW1wbGVyMkQgY2x1c3RlcldvcmxkVGV4dHVyZTtcbnVuaWZvcm0gc2FtcGxlcjJEIGxpZ2h0c1RleHR1cmU4O1xudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgbGlnaHRzVGV4dHVyZUZsb2F0O1xuXG4vLyBjb21wbGV4IGlmZGVmIGV4cHJlc3Npb24gYXJlIG5vdCBzdXBwb3J0ZWQsIGhhbmRsZSBpdCBoZXJlXG4vLyBkZWZpbmVkKENMVVNURVJfQ09PS0lFUykgfHwgZGVmaW5lZChDTFVTVEVSX1NIQURPV1MpXG4jaWYgZGVmaW5lZChDTFVTVEVSX0NPT0tJRVMpXG4gICAgI2RlZmluZSBDTFVTVEVSX0NPT0tJRVNfT1JfU0hBRE9XU1xuI2VuZGlmXG4jaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV1MpXG4gICAgI2RlZmluZSBDTFVTVEVSX0NPT0tJRVNfT1JfU0hBRE9XU1xuI2VuZGlmXG5cbiNpZmRlZiBDTFVTVEVSX1NIQURPV1NcbiAgICAjaWZkZWYgR0wyXG4gICAgICAgIC8vIFRPRE86IHdoZW4gVlNNIHNoYWRvdyBpcyBzdXBwb3J0ZWQsIGl0IG5lZWRzIHRvIHVzZSBzYW1wbGVyMkQgaW4gd2ViZ2wyXG4gICAgICAgIHVuaWZvcm0gc2FtcGxlcjJEU2hhZG93IHNoYWRvd0F0bGFzVGV4dHVyZTtcbiAgICAjZWxzZVxuICAgICAgICB1bmlmb3JtIHNhbXBsZXIyRCBzaGFkb3dBdGxhc1RleHR1cmU7XG4gICAgI2VuZGlmXG4jZW5kaWZcblxuI2lmZGVmIENMVVNURVJfQ09PS0lFU1xuICAgIHVuaWZvcm0gc2FtcGxlcjJEIGNvb2tpZUF0bGFzVGV4dHVyZTtcbiNlbmRpZlxuXG51bmlmb3JtIGZsb2F0IGNsdXN0ZXJQaXhlbHNQZXJDZWxsO1xudW5pZm9ybSB2ZWMzIGNsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplO1xudW5pZm9ybSB2ZWM0IGxpZ2h0c1RleHR1cmVJbnZTaXplO1xudW5pZm9ybSB2ZWMzIGNsdXN0ZXJUZXh0dXJlU2l6ZTtcbnVuaWZvcm0gdmVjMyBjbHVzdGVyQm91bmRzTWluO1xudW5pZm9ybSB2ZWMzIGNsdXN0ZXJCb3VuZHNEZWx0YTtcbnVuaWZvcm0gdmVjMyBjbHVzdGVyQ2VsbHNEb3Q7XG51bmlmb3JtIHZlYzMgY2x1c3RlckNlbGxzTWF4O1xudW5pZm9ybSB2ZWMyIGNsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MDtcbnVuaWZvcm0gdmVjMiBzaGFkb3dBdGxhc1BhcmFtcztcblxuLy8gc3RydWN0dXJlIHN0b3JpbmcgbGlnaHQgcHJvcGVydGllcyBvZiBhIGNsdXN0ZXJlZCBsaWdodFxuc3RydWN0IENsdXN0ZXJMaWdodERhdGEge1xuXG4gICAgLy8gdiBjb29yZGluYXRlIHRvIGxvb2sgdXAgdGhlIGxpZ2h0IHRleHR1cmVzXG4gICAgZmxvYXQgbGlnaHRWO1xuXG4gICAgLy8gdHlwZSBvZiB0aGUgbGlnaHQgKHNwb3Qgb3Igb21uaSlcbiAgICBmbG9hdCB0eXBlO1xuXG4gICAgLy8gYXJlYSBsaWdodCBzaGFwZVxuICAgIGZsb2F0IHNoYXBlO1xuXG4gICAgLy8gYXJlYSBsaWdodCBzaXplcyAvIG9yaWVudGF0aW9uXG4gICAgdmVjMyBoYWxmV2lkdGg7XG4gICAgdmVjMyBoYWxmSGVpZ2h0O1xuXG4gICAgLy8gbGlnaHQgZm9sbG93IG1vZGVcbiAgICBmbG9hdCBmYWxsb2ZmTW9kZTtcblxuICAgIC8vIDAuMCBpZiB0aGUgbGlnaHQgZG9lc24ndCBjYXN0IHNoYWRvd3NcbiAgICBmbG9hdCBzaGFkb3dJbnRlbnNpdHk7XG5cbiAgICAvLyBzaGFkb3cgYmlhcyB2YWx1ZXNcbiAgICBmbG9hdCBzaGFkb3dCaWFzO1xuICAgIGZsb2F0IHNoYWRvd05vcm1hbEJpYXM7XG5cbiAgICAvLyB3b3JsZCBzcGFjZSBwb3NpdGlvblxuICAgIHZlYzMgcG9zaXRpb247XG5cbiAgICAvLyB3b3JsZCBzcGFjZSBkaXJlY3Rpb24gKHNwb3QgbGlnaHQgb25seSlcbiAgICB2ZWMzIGRpcmVjdGlvbjtcblxuICAgIC8vIHJhbmdlIG9mIHRoZSBsaWdodFxuICAgIGZsb2F0IHJhbmdlO1xuXG4gICAgLy8gc3BvdCBsaWdodCBpbm5lciBhbmQgb3V0ZXIgYW5nbGUgY29zaW5lXG4gICAgZmxvYXQgaW5uZXJDb25lQW5nbGVDb3M7XG4gICAgZmxvYXQgb3V0ZXJDb25lQW5nbGVDb3M7XG5cbiAgICAvLyBjb2xvclxuICAgIHZlYzMgY29sb3I7XG5cbiAgICAvLyBhdGxhcyB2aWV3cG9ydCBmb3Igb21uaSBsaWdodCBzaGFkb3cgYW5kIGNvb2tpZSAoLnh5IGlzIG9mZnNldCB0byB0aGUgdmlld3BvcnQgc2xvdCwgLnogaXMgc2l6ZSBvZiB0aGUgZmFjZSBpbiB0aGUgYXRsYXMpXG4gICAgdmVjMyBvbW5pQXRsYXNWaWV3cG9ydDtcblxuICAgIC8vIDEuMCBpZiB0aGUgbGlnaHQgaGFzIGEgY29va2llIHRleHR1cmVcbiAgICBmbG9hdCBjb29raWU7XG5cbiAgICAvLyAxLjAgaWYgY29va2llIHRleHR1cmUgaXMgcmdiLCBvdGhlcndpc2UgaXQgaXMgdXNpbmcgYSBzaW5nbGUgY2hhbm5lbCBzZWxlY3RhYmxlIGJ5IGNvb2tpZUNoYW5uZWxNYXNrXG4gICAgZmxvYXQgY29va2llUmdiO1xuXG4gICAgLy8gaW50ZW5zaXR5IG9mIHRoZSBjb29raWVcbiAgICBmbG9hdCBjb29raWVJbnRlbnNpdHk7XG5cbiAgICAvLyBjaGFubmVsIG1hc2sgLSBvbmUgb2YgdGhlIGNoYW5uZWxzIGhhcyAxLCB0aGUgb3RoZXJzIGFyZSAwXG4gICAgdmVjNCBjb29raWVDaGFubmVsTWFzaztcblxuICAgIC8vIGxpZ2h0IG1hc2tcbiAgICBmbG9hdCBtYXNrO1xufTtcblxuLy8gTm90ZTogb24gc29tZSBkZXZpY2VzICh0ZXN0ZWQgb24gUGl4ZWwgM0EgWEwpLCB0aGlzIG1hdHJpeCB3aGVuIHN0b3JlZCBpbnNpZGUgdGhlIGxpZ2h0IHN0cnVjdCBoYXMgbG93ZXIgcHJlY2lzaW9uIGNvbXBhcmVkIHRvXG4vLyB3aGVuIHN0b3JlZCBvdXRzaWRlLCBzbyB3ZSBzdG9yZSBpdCBvdXRzaWRlIHRvIGF2b2lkIHNwb3Qgc2hhZG93IGZsaWNrZXJpbmcuIFRoaXMgbWlnaHQgbmVlZCB0byBiZSBkb25lIHRvIG90aGVyIC8gYWxsIG1lbWJlcnNcbi8vIG9mIHRoZSBzdHJ1Y3R1cmUgaWYgZnVydGhlciBzaW1pbGFyIGlzc3VlcyBhcmUgb2JzZXJ2ZWQuXG5cbi8vIHNoYWRvdyAoc3BvdCBsaWdodCBvbmx5KSAvIGNvb2tpZSBwcm9qZWN0aW9uIG1hdHJpeFxubWF0NCBsaWdodFByb2plY3Rpb25NYXRyaXg7XG5cbi8vIG1hY3JvcyBmb3IgbGlnaHQgcHJvcGVydGllc1xuI2RlZmluZSBpc0NsdXN0ZXJlZExpZ2h0Q2FzdFNoYWRvdyhsaWdodCkgKCBsaWdodC5zaGFkb3dJbnRlbnNpdHkgPiAwLjAgKVxuI2RlZmluZSBpc0NsdXN0ZXJlZExpZ2h0Q29va2llKGxpZ2h0KSAobGlnaHQuY29va2llID4gMC41IClcbiNkZWZpbmUgaXNDbHVzdGVyZWRMaWdodENvb2tpZVJnYihsaWdodCkgKGxpZ2h0LmNvb2tpZVJnYiA+IDAuNSApXG4jZGVmaW5lIGlzQ2x1c3RlcmVkTGlnaHRTcG90KGxpZ2h0KSAoIGxpZ2h0LnR5cGUgPiAwLjUgKVxuI2RlZmluZSBpc0NsdXN0ZXJlZExpZ2h0RmFsbG9mZkxpbmVhcihsaWdodCkgKCBsaWdodC5mYWxsb2ZmTW9kZSA8IDAuNSApXG5cbi8vIG1hY3JvcyB0byB0ZXN0IGxpZ2h0IHNoYXBlXG4vLyBOb3RlOiBGb2xsb3dpbmcgZnVuY3Rpb25zIG5lZWQgdG8gYmUgY2FsbGVkIHNlcmlhbGx5IGluIGxpc3RlZCBvcmRlciBhcyB0aGV5IGRvIG5vdCB0ZXN0IGJvdGggJz4nIGFuZCAnPCdcbiNkZWZpbmUgaXNDbHVzdGVyZWRMaWdodEFyZWEobGlnaHQpICggbGlnaHQuc2hhcGUgPiAwLjEgKVxuI2RlZmluZSBpc0NsdXN0ZXJlZExpZ2h0UmVjdChsaWdodCkgKCBsaWdodC5zaGFwZSA8IDAuMyApXG4jZGVmaW5lIGlzQ2x1c3RlcmVkTGlnaHREaXNrKGxpZ2h0KSAoIGxpZ2h0LnNoYXBlIDwgMC42IClcblxuLy8gbWFjcm8gdG8gdGVzdCBsaWdodCBtYXNrIChtZXNoIGFjY2VwdHMgZHluYW1pYyB2cyBsaWdodG1hcHBlZCBsaWdodHMpXG4jaWZkZWYgQ0xVU1RFUl9NRVNIX0RZTkFNSUNfTElHSFRTXG4gICAgLy8gYWNjZXB0IGxpZ2h0cyBtYXJrZWQgYXMgZHluYW1pYyBvciBib3RoIGR5bmFtaWMgYW5kIGxpZ2h0bWFwcGVkXG4gICAgI2RlZmluZSBhY2NlcHRMaWdodE1hc2sobGlnaHQpICggbGlnaHQubWFzayA8IDAuNzUpXG4jZWxzZVxuICAgIC8vIGFjY2VwdCBsaWdodHMgbWFya2VkIGFzIGxpZ2h0bWFwcGVkIG9yIGJvdGggZHluYW1pYyBhbmQgbGlnaHRtYXBwZWRcbiAgICAjZGVmaW5lIGFjY2VwdExpZ2h0TWFzayhsaWdodCkgKCBsaWdodC5tYXNrID4gMC4yNSlcbiNlbmRpZlxuXG52ZWM0IGRlY29kZUNsdXN0ZXJMb3dSYW5nZTRWZWM0KHZlYzQgZDAsIHZlYzQgZDEsIHZlYzQgZDIsIHZlYzQgZDMpIHtcbiAgICByZXR1cm4gdmVjNChcbiAgICAgICAgYnl0ZXMyZmxvYXRSYW5nZTQoZDAsIC0yLjAsIDIuMCksXG4gICAgICAgIGJ5dGVzMmZsb2F0UmFuZ2U0KGQxLCAtMi4wLCAyLjApLFxuICAgICAgICBieXRlczJmbG9hdFJhbmdlNChkMiwgLTIuMCwgMi4wKSxcbiAgICAgICAgYnl0ZXMyZmxvYXRSYW5nZTQoZDMsIC0yLjAsIDIuMClcbiAgICApO1xufVxuXG52ZWM0IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNvbnN0IENsdXN0ZXJMaWdodERhdGEgY2x1c3RlckxpZ2h0RGF0YSwgZmxvYXQgaW5kZXgpIHtcbiAgICByZXR1cm4gdGV4dHVyZTJETG9kRVhUKGxpZ2h0c1RleHR1cmU4LCB2ZWMyKGluZGV4ICogbGlnaHRzVGV4dHVyZUludlNpemUueiwgY2x1c3RlckxpZ2h0RGF0YS5saWdodFYpLCAwLjApO1xufVxuXG52ZWM0IHNhbXBsZUxpZ2h0VGV4dHVyZUYoY29uc3QgQ2x1c3RlckxpZ2h0RGF0YSBjbHVzdGVyTGlnaHREYXRhLCBmbG9hdCBpbmRleCkge1xuICAgIHJldHVybiB0ZXh0dXJlMkRMb2RFWFQobGlnaHRzVGV4dHVyZUZsb2F0LCB2ZWMyKGluZGV4ICogbGlnaHRzVGV4dHVyZUludlNpemUueCwgY2x1c3RlckxpZ2h0RGF0YS5saWdodFYpLCAwLjApO1xufVxuXG52b2lkIGRlY29kZUNsdXN0ZXJMaWdodENvcmUoaW5vdXQgQ2x1c3RlckxpZ2h0RGF0YSBjbHVzdGVyTGlnaHREYXRhLCBmbG9hdCBsaWdodEluZGV4KSB7XG5cbiAgICAvLyByZWFkIG9tbmkgbGlnaHQgcHJvcGVydGllc1xuICAgIGNsdXN0ZXJMaWdodERhdGEubGlnaHRWID0gKGxpZ2h0SW5kZXggKyAwLjUpICogbGlnaHRzVGV4dHVyZUludlNpemUudztcblxuICAgIC8vIHNoYXJlZCBkYXRhIGZyb20gOGJpdCB0ZXh0dXJlXG4gICAgdmVjNCBsaWdodEluZm8gPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9GTEFHUyk7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS50eXBlID0gbGlnaHRJbmZvLng7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS5zaGFwZSA9IGxpZ2h0SW5mby55O1xuICAgIGNsdXN0ZXJMaWdodERhdGEuZmFsbG9mZk1vZGUgPSBsaWdodEluZm8uejtcbiAgICBjbHVzdGVyTGlnaHREYXRhLnNoYWRvd0ludGVuc2l0eSA9IGxpZ2h0SW5mby53O1xuXG4gICAgLy8gY29sb3JcbiAgICB2ZWM0IGNvbG9yQSA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X0NPTE9SX0EpO1xuICAgIHZlYzQgY29sb3JCID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQ09MT1JfQik7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS5jb2xvciA9IHZlYzMoYnl0ZXMyZmxvYXQyKGNvbG9yQS54eSksIGJ5dGVzMmZsb2F0Mihjb2xvckEuencpLCBieXRlczJmbG9hdDIoY29sb3JCLnh5KSkgKiBjbHVzdGVyQ29tcHJlc3Npb25MaW1pdDAueTtcblxuICAgIC8vIGNvb2tpZVxuICAgIGNsdXN0ZXJMaWdodERhdGEuY29va2llID0gY29sb3JCLno7XG5cbiAgICAvLyBsaWdodCBtYXNrXG4gICAgY2x1c3RlckxpZ2h0RGF0YS5tYXNrID0gY29sb3JCLnc7XG5cbiAgICAjaWZkZWYgQ0xVU1RFUl9URVhUVVJFX0ZMT0FUXG5cbiAgICAgICAgdmVjNCBsaWdodFBvc1JhbmdlID0gc2FtcGxlTGlnaHRUZXh0dXJlRihjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfRl9QT1NJVElPTl9SQU5HRSk7XG4gICAgICAgIGNsdXN0ZXJMaWdodERhdGEucG9zaXRpb24gPSBsaWdodFBvc1JhbmdlLnh5ejtcbiAgICAgICAgY2x1c3RlckxpZ2h0RGF0YS5yYW5nZSA9IGxpZ2h0UG9zUmFuZ2UudztcblxuICAgICAgICAvLyBzcG90IGxpZ2h0IGRpcmVjdGlvblxuICAgICAgICB2ZWM0IGxpZ2h0RGlyX1VudXNlZCA9IHNhbXBsZUxpZ2h0VGV4dHVyZUYoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFX0ZfU1BPVF9ESVJFQ1RJT04pO1xuICAgICAgICBjbHVzdGVyTGlnaHREYXRhLmRpcmVjdGlvbiA9IGxpZ2h0RGlyX1VudXNlZC54eXo7XG5cbiAgICAjZWxzZSAgIC8vIDhiaXRcblxuICAgICAgICB2ZWM0IGVuY1Bvc1ggPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QT1NJVElPTl9YKTtcbiAgICAgICAgdmVjNCBlbmNQb3NZID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUE9TSVRJT05fWSk7XG4gICAgICAgIHZlYzQgZW5jUG9zWiA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BPU0lUSU9OX1opO1xuICAgICAgICBjbHVzdGVyTGlnaHREYXRhLnBvc2l0aW9uID0gdmVjMyhieXRlczJmbG9hdDQoZW5jUG9zWCksIGJ5dGVzMmZsb2F0NChlbmNQb3NZKSwgYnl0ZXMyZmxvYXQ0KGVuY1Bvc1opKSAqIGNsdXN0ZXJCb3VuZHNEZWx0YSArIGNsdXN0ZXJCb3VuZHNNaW47XG5cbiAgICAgICAgdmVjNCBlbmNSYW5nZSA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1JBTkdFKTtcbiAgICAgICAgY2x1c3RlckxpZ2h0RGF0YS5yYW5nZSA9IGJ5dGVzMmZsb2F0NChlbmNSYW5nZSkgKiBjbHVzdGVyQ29tcHJlc3Npb25MaW1pdDAueDtcblxuICAgICAgICAvLyBzcG90IGxpZ2h0IGRpcmVjdGlvblxuICAgICAgICB2ZWM0IGVuY0RpclggPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9TUE9UX0RJUkVDVElPTl9YKTtcbiAgICAgICAgdmVjNCBlbmNEaXJZID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfU1BPVF9ESVJFQ1RJT05fWSk7XG4gICAgICAgIHZlYzQgZW5jRGlyWiA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1NQT1RfRElSRUNUSU9OX1opO1xuICAgICAgICBjbHVzdGVyTGlnaHREYXRhLmRpcmVjdGlvbiA9IHZlYzMoYnl0ZXMyZmxvYXQ0KGVuY0RpclgpLCBieXRlczJmbG9hdDQoZW5jRGlyWSksIGJ5dGVzMmZsb2F0NChlbmNEaXJaKSkgKiAyLjAgLSAxLjA7XG5cbiAgICAjZW5kaWZcbn1cblxudm9pZCBkZWNvZGVDbHVzdGVyTGlnaHRTcG90KGlub3V0IENsdXN0ZXJMaWdodERhdGEgY2x1c3RlckxpZ2h0RGF0YSkge1xuXG4gICAgLy8gc3BvdCBsaWdodCBjb3MgYW5nbGVzXG4gICAgdmVjNCBjb25lQW5nbGUgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9TUE9UX0FOR0xFUyk7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS5pbm5lckNvbmVBbmdsZUNvcyA9IGJ5dGVzMmZsb2F0Mihjb25lQW5nbGUueHkpICogMi4wIC0gMS4wO1xuICAgIGNsdXN0ZXJMaWdodERhdGEub3V0ZXJDb25lQW5nbGVDb3MgPSBieXRlczJmbG9hdDIoY29uZUFuZ2xlLnp3KSAqIDIuMCAtIDEuMDtcbn1cblxudm9pZCBkZWNvZGVDbHVzdGVyTGlnaHRPbW5pQXRsYXNWaWV3cG9ydChpbm91dCBDbHVzdGVyTGlnaHREYXRhIGNsdXN0ZXJMaWdodERhdGEpIHtcbiAgICAjaWZkZWYgQ0xVU1RFUl9URVhUVVJFX0ZMT0FUXG4gICAgICAgIGNsdXN0ZXJMaWdodERhdGEub21uaUF0bGFzVmlld3BvcnQgPSBzYW1wbGVMaWdodFRleHR1cmVGKGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV9GX1BST0pfTUFUXzApLnh5ejtcbiAgICAjZWxzZVxuICAgICAgICB2ZWM0IHZpZXdwb3J0QSA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X0FUTEFTX1ZJRVdQT1JUX0EpO1xuICAgICAgICB2ZWM0IHZpZXdwb3J0QiA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X0FUTEFTX1ZJRVdQT1JUX0IpO1xuICAgICAgICBjbHVzdGVyTGlnaHREYXRhLm9tbmlBdGxhc1ZpZXdwb3J0ID0gdmVjMyhieXRlczJmbG9hdDIodmlld3BvcnRBLnh5KSwgYnl0ZXMyZmxvYXQyKHZpZXdwb3J0QS56dyksIGJ5dGVzMmZsb2F0Mih2aWV3cG9ydEIueHkpKTtcbiAgICAjZW5kaWZcbn1cblxudm9pZCBkZWNvZGVDbHVzdGVyTGlnaHRBcmVhRGF0YShpbm91dCBDbHVzdGVyTGlnaHREYXRhIGNsdXN0ZXJMaWdodERhdGEpIHtcbiAgICAjaWZkZWYgQ0xVU1RFUl9URVhUVVJFX0ZMT0FUXG4gICAgICAgIGNsdXN0ZXJMaWdodERhdGEuaGFsZldpZHRoID0gc2FtcGxlTGlnaHRUZXh0dXJlRihjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfRl9BUkVBX0RBVEFfV0lEVEgpLnh5ejtcbiAgICAgICAgY2x1c3RlckxpZ2h0RGF0YS5oYWxmSGVpZ2h0ID0gc2FtcGxlTGlnaHRUZXh0dXJlRihjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfRl9BUkVBX0RBVEFfSEVJR0hUKS54eXo7XG4gICAgI2Vsc2VcbiAgICAgICAgdmVjNCBhcmVhV2lkdGhYID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQVJFQV9EQVRBX1dJRFRIX1gpO1xuICAgICAgICB2ZWM0IGFyZWFXaWR0aFkgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9BUkVBX0RBVEFfV0lEVEhfWSk7XG4gICAgICAgIHZlYzQgYXJlYVdpZHRoWiA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X0FSRUFfREFUQV9XSURUSF9aKTtcbiAgICAgICAgY2x1c3RlckxpZ2h0RGF0YS5oYWxmV2lkdGggPSB2ZWMzKG1hbnRpc3NhRXhwb25lbnQyRmxvYXQoYXJlYVdpZHRoWCksIG1hbnRpc3NhRXhwb25lbnQyRmxvYXQoYXJlYVdpZHRoWSksIG1hbnRpc3NhRXhwb25lbnQyRmxvYXQoYXJlYVdpZHRoWikpO1xuXG4gICAgICAgIHZlYzQgYXJlYUhlaWdodFggPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9BUkVBX0RBVEFfSEVJR0hUX1gpO1xuICAgICAgICB2ZWM0IGFyZWFIZWlnaHRZID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQVJFQV9EQVRBX0hFSUdIVF9ZKTtcbiAgICAgICAgdmVjNCBhcmVhSGVpZ2h0WiA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X0FSRUFfREFUQV9IRUlHSFRfWik7XG4gICAgICAgIGNsdXN0ZXJMaWdodERhdGEuaGFsZkhlaWdodCA9IHZlYzMobWFudGlzc2FFeHBvbmVudDJGbG9hdChhcmVhSGVpZ2h0WCksIG1hbnRpc3NhRXhwb25lbnQyRmxvYXQoYXJlYUhlaWdodFkpLCBtYW50aXNzYUV4cG9uZW50MkZsb2F0KGFyZWFIZWlnaHRaKSk7XG4gICAgI2VuZGlmXG59XG5cbnZvaWQgZGVjb2RlQ2x1c3RlckxpZ2h0UHJvamVjdGlvbk1hdHJpeERhdGEoaW5vdXQgQ2x1c3RlckxpZ2h0RGF0YSBjbHVzdGVyTGlnaHREYXRhKSB7XG4gICAgXG4gICAgLy8gc2hhZG93IG1hdHJpeFxuICAgICNpZmRlZiBDTFVTVEVSX1RFWFRVUkVfRkxPQVRcbiAgICAgICAgdmVjNCBtMCA9IHNhbXBsZUxpZ2h0VGV4dHVyZUYoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFX0ZfUFJPSl9NQVRfMCk7XG4gICAgICAgIHZlYzQgbTEgPSBzYW1wbGVMaWdodFRleHR1cmVGKGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV9GX1BST0pfTUFUXzEpO1xuICAgICAgICB2ZWM0IG0yID0gc2FtcGxlTGlnaHRUZXh0dXJlRihjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfRl9QUk9KX01BVF8yKTtcbiAgICAgICAgdmVjNCBtMyA9IHNhbXBsZUxpZ2h0VGV4dHVyZUYoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFX0ZfUFJPSl9NQVRfMyk7XG4gICAgI2Vsc2VcbiAgICAgICAgdmVjNCBtMDAgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8wMCk7XG4gICAgICAgIHZlYzQgbTAxID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMDEpO1xuICAgICAgICB2ZWM0IG0wMiA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzAyKTtcbiAgICAgICAgdmVjNCBtMDMgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8wMyk7XG4gICAgICAgIHZlYzQgbTAgPSBkZWNvZGVDbHVzdGVyTG93UmFuZ2U0VmVjNChtMDAsIG0wMSwgbTAyLCBtMDMpO1xuXG4gICAgICAgIHZlYzQgbTEwID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMTApO1xuICAgICAgICB2ZWM0IG0xMSA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzExKTtcbiAgICAgICAgdmVjNCBtMTIgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8xMik7XG4gICAgICAgIHZlYzQgbTEzID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMTMpO1xuICAgICAgICB2ZWM0IG0xID0gZGVjb2RlQ2x1c3Rlckxvd1JhbmdlNFZlYzQobTEwLCBtMTEsIG0xMiwgbTEzKTtcblxuICAgICAgICB2ZWM0IG0yMCA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzIwKTtcbiAgICAgICAgdmVjNCBtMjEgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8yMSk7XG4gICAgICAgIHZlYzQgbTIyID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMjIpO1xuICAgICAgICB2ZWM0IG0yMyA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzIzKTtcbiAgICAgICAgdmVjNCBtMiA9IGRlY29kZUNsdXN0ZXJMb3dSYW5nZTRWZWM0KG0yMCwgbTIxLCBtMjIsIG0yMyk7XG5cbiAgICAgICAgdmVjNCBtMzAgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8zMCk7XG4gICAgICAgIHZlYzQgbTMxID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMzEpO1xuICAgICAgICB2ZWM0IG0zMiA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzMyKTtcbiAgICAgICAgdmVjNCBtMzMgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8zMyk7XG4gICAgICAgIHZlYzQgbTMgPSB2ZWM0KG1hbnRpc3NhRXhwb25lbnQyRmxvYXQobTMwKSwgbWFudGlzc2FFeHBvbmVudDJGbG9hdChtMzEpLCBtYW50aXNzYUV4cG9uZW50MkZsb2F0KG0zMiksIG1hbnRpc3NhRXhwb25lbnQyRmxvYXQobTMzKSk7XG4gICAgI2VuZGlmXG4gICAgXG4gICAgbGlnaHRQcm9qZWN0aW9uTWF0cml4ID0gbWF0NChtMCwgbTEsIG0yLCBtMyk7XG59XG5cbnZvaWQgZGVjb2RlQ2x1c3RlckxpZ2h0U2hhZG93RGF0YShpbm91dCBDbHVzdGVyTGlnaHREYXRhIGNsdXN0ZXJMaWdodERhdGEpIHtcbiAgICBcbiAgICAvLyBzaGFkb3cgYmlhc2VzXG4gICAgdmVjNCBiaWFzZXMgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9TSEFET1dfQklBUyk7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS5zaGFkb3dCaWFzID0gYnl0ZXMyZmxvYXRSYW5nZTIoYmlhc2VzLnh5LCAtMS4wLCAyMC4wKSxcbiAgICBjbHVzdGVyTGlnaHREYXRhLnNoYWRvd05vcm1hbEJpYXMgPSBieXRlczJmbG9hdDIoYmlhc2VzLnp3KTtcbn1cblxudm9pZCBkZWNvZGVDbHVzdGVyTGlnaHRDb29raWVEYXRhKGlub3V0IENsdXN0ZXJMaWdodERhdGEgY2x1c3RlckxpZ2h0RGF0YSkge1xuXG4gICAgdmVjNCBjb29raWVBID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQ09PS0lFX0EpO1xuICAgIGNsdXN0ZXJMaWdodERhdGEuY29va2llSW50ZW5zaXR5ID0gY29va2llQS54O1xuICAgIGNsdXN0ZXJMaWdodERhdGEuY29va2llUmdiID0gY29va2llQS55O1xuXG4gICAgY2x1c3RlckxpZ2h0RGF0YS5jb29raWVDaGFubmVsTWFzayA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X0NPT0tJRV9CKTtcbn1cblxudm9pZCBldmFsdWF0ZUxpZ2h0KENsdXN0ZXJMaWdodERhdGEgbGlnaHQpIHtcblxuICAgIGRBdHRlbjMgPSB2ZWMzKDEuMCk7XG5cbiAgICAvLyBldmFsdWF0ZSBvbW5pIHBhcnQgb2YgdGhlIGxpZ2h0XG4gICAgZ2V0TGlnaHREaXJQb2ludChsaWdodC5wb3NpdGlvbik7XG5cbiAgICAjaWZkZWYgQ0xVU1RFUl9BUkVBTElHSFRTXG5cbiAgICAvLyBkaXN0YW5jZSBhdHRlbnVhdGlvblxuICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0QXJlYShsaWdodCkpIHsgLy8gYXJlYSBsaWdodFxuXG4gICAgICAgIC8vIGFyZWEgbGlnaHRzXG4gICAgICAgIGRlY29kZUNsdXN0ZXJMaWdodEFyZWFEYXRhKGxpZ2h0KTtcblxuICAgICAgICAvLyBoYW5kbGUgbGlnaHQgc2hhcGVcbiAgICAgICAgaWYgKGlzQ2x1c3RlcmVkTGlnaHRSZWN0KGxpZ2h0KSkge1xuICAgICAgICAgICAgY2FsY1JlY3RMaWdodFZhbHVlcyhsaWdodC5wb3NpdGlvbiwgbGlnaHQuaGFsZldpZHRoLCBsaWdodC5oYWxmSGVpZ2h0KTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0NsdXN0ZXJlZExpZ2h0RGlzayhsaWdodCkpIHtcbiAgICAgICAgICAgIGNhbGNEaXNrTGlnaHRWYWx1ZXMobGlnaHQucG9zaXRpb24sIGxpZ2h0LmhhbGZXaWR0aCwgbGlnaHQuaGFsZkhlaWdodCk7XG4gICAgICAgIH0gZWxzZSB7IC8vIHNwaGVyZVxuICAgICAgICAgICAgY2FsY1NwaGVyZUxpZ2h0VmFsdWVzKGxpZ2h0LnBvc2l0aW9uLCBsaWdodC5oYWxmV2lkdGgsIGxpZ2h0LmhhbGZIZWlnaHQpO1xuICAgICAgICB9XG5cbiAgICAgICAgZEF0dGVuID0gZ2V0RmFsbG9mZldpbmRvdyhsaWdodC5yYW5nZSk7XG5cbiAgICB9IGVsc2VcblxuICAgICNlbmRpZlxuXG4gICAgeyAgIC8vIHB1bmN0dWFsIGxpZ2h0XG5cbiAgICAgICAgaWYgKGlzQ2x1c3RlcmVkTGlnaHRGYWxsb2ZmTGluZWFyKGxpZ2h0KSlcbiAgICAgICAgICAgIGRBdHRlbiA9IGdldEZhbGxvZmZMaW5lYXIobGlnaHQucmFuZ2UpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICBkQXR0ZW4gPSBnZXRGYWxsb2ZmSW52U3F1YXJlZChsaWdodC5yYW5nZSk7XG4gICAgfVxuXG4gICAgaWYgKGRBdHRlbiA+IDAuMDAwMDEpIHtcblxuICAgICAgICAjaWZkZWYgQ0xVU1RFUl9BUkVBTElHSFRTXG5cbiAgICAgICAgaWYgKGlzQ2x1c3RlcmVkTGlnaHRBcmVhKGxpZ2h0KSkgeyAvLyBhcmVhIGxpZ2h0XG5cbiAgICAgICAgICAgIC8vIGhhbmRsZSBsaWdodCBzaGFwZVxuICAgICAgICAgICAgaWYgKGlzQ2x1c3RlcmVkTGlnaHRSZWN0KGxpZ2h0KSkge1xuICAgICAgICAgICAgICAgIGRBdHRlbkQgPSBnZXRSZWN0TGlnaHREaWZmdXNlKCkgKiAxNi4wO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0NsdXN0ZXJlZExpZ2h0RGlzayhsaWdodCkpIHtcbiAgICAgICAgICAgICAgICBkQXR0ZW5EID0gZ2V0RGlza0xpZ2h0RGlmZnVzZSgpICogMTYuMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIHNwaGVyZVxuICAgICAgICAgICAgICAgIGRBdHRlbkQgPSBnZXRTcGhlcmVMaWdodERpZmZ1c2UoKSAqIDE2LjA7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlXG5cbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAge1xuICAgICAgICAgICAgZEF0dGVuICo9IGdldExpZ2h0RGlmZnVzZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3BvdCBsaWdodCBmYWxsb2ZmXG4gICAgICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0U3BvdChsaWdodCkpIHtcbiAgICAgICAgICAgIGRlY29kZUNsdXN0ZXJMaWdodFNwb3QobGlnaHQpO1xuICAgICAgICAgICAgZEF0dGVuICo9IGdldFNwb3RFZmZlY3QobGlnaHQuZGlyZWN0aW9uLCBsaWdodC5pbm5lckNvbmVBbmdsZUNvcywgbGlnaHQub3V0ZXJDb25lQW5nbGVDb3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9DT09LSUVTX09SX1NIQURPV1MpXG5cbiAgICAgICAgaWYgKGRBdHRlbiA+IDAuMDAwMDEpIHtcblxuICAgICAgICAgICAgLy8gc2hhZG93IC8gY29va2llXG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodENhc3RTaGFkb3cobGlnaHQpIHx8IGlzQ2x1c3RlcmVkTGlnaHRDb29raWUobGlnaHQpKSB7XG5cbiAgICAgICAgICAgICAgICAvLyBzaGFyZWQgc2hhZG93IC8gY29va2llIGRhdGEgZGVwZW5kcyBvbiBsaWdodCB0eXBlXG4gICAgICAgICAgICAgICAgaWYgKGlzQ2x1c3RlcmVkTGlnaHRTcG90KGxpZ2h0KSkge1xuICAgICAgICAgICAgICAgICAgICBkZWNvZGVDbHVzdGVyTGlnaHRQcm9qZWN0aW9uTWF0cml4RGF0YShsaWdodCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjb2RlQ2x1c3RlckxpZ2h0T21uaUF0bGFzVmlld3BvcnQobGlnaHQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGZsb2F0IHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uID0gc2hhZG93QXRsYXNQYXJhbXMueDtcbiAgICAgICAgICAgICAgICBmbG9hdCBzaGFkb3dFZGdlUGl4ZWxzID0gc2hhZG93QXRsYXNQYXJhbXMueTtcblxuICAgICAgICAgICAgICAgICNpZmRlZiBDTFVTVEVSX0NPT0tJRVNcblxuICAgICAgICAgICAgICAgIC8vIGNvb2tpZVxuICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0Q29va2llKGxpZ2h0KSkge1xuICAgICAgICAgICAgICAgICAgICBkZWNvZGVDbHVzdGVyTGlnaHRDb29raWVEYXRhKGxpZ2h0KTtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodFNwb3QobGlnaHQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBkQXR0ZW4zID0gZ2V0Q29va2llMkRDbHVzdGVyZWQoY29va2llQXRsYXNUZXh0dXJlLCBsaWdodFByb2plY3Rpb25NYXRyaXgsIHZQb3NpdGlvblcsIGxpZ2h0LmNvb2tpZUludGVuc2l0eSwgaXNDbHVzdGVyZWRMaWdodENvb2tpZVJnYihsaWdodCksIGxpZ2h0LmNvb2tpZUNoYW5uZWxNYXNrKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRBdHRlbjMgPSBnZXRDb29raWVDdWJlQ2x1c3RlcmVkKGNvb2tpZUF0bGFzVGV4dHVyZSwgZExpZ2h0RGlyVywgbGlnaHQuY29va2llSW50ZW5zaXR5LCBpc0NsdXN0ZXJlZExpZ2h0Q29va2llUmdiKGxpZ2h0KSwgbGlnaHQuY29va2llQ2hhbm5lbE1hc2ssIHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uLCBzaGFkb3dFZGdlUGl4ZWxzLCBsaWdodC5vbW5pQXRsYXNWaWV3cG9ydCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAjZW5kaWZcblxuICAgICAgICAgICAgICAgICNpZmRlZiBDTFVTVEVSX1NIQURPV1NcblxuICAgICAgICAgICAgICAgIC8vIHNoYWRvd1xuICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0Q2FzdFNoYWRvdyhsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjb2RlQ2x1c3RlckxpZ2h0U2hhZG93RGF0YShsaWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgdmVjNCBzaGFkb3dQYXJhbXMgPSB2ZWM0KHNoYWRvd1RleHR1cmVSZXNvbHV0aW9uLCBsaWdodC5zaGFkb3dOb3JtYWxCaWFzLCBsaWdodC5zaGFkb3dCaWFzLCAxLjAgLyBsaWdodC5yYW5nZSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzQ2x1c3RlcmVkTGlnaHRTcG90KGxpZ2h0KSkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzcG90IHNoYWRvd1xuICAgICAgICAgICAgICAgICAgICAgICAgZ2V0U2hhZG93Q29vcmRQZXJzcFpidWZmZXJOb3JtYWxPZmZzZXQobGlnaHRQcm9qZWN0aW9uTWF0cml4LCBzaGFkb3dQYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQgc2hhZG93ID0gZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjEoc2hhZG93QXRsYXNUZXh0dXJlLCBzaGFkb3dQYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgI2VsaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQgc2hhZG93ID0gZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjMoc2hhZG93QXRsYXNUZXh0dXJlLCBzaGFkb3dQYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgI2VsaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQgc2hhZG93ID0gZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjUoc2hhZG93QXRsYXNUZXh0dXJlLCBzaGFkb3dQYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgI2VuZGlmXG4gICAgICAgICAgICAgICAgICAgICAgICBkQXR0ZW4gKj0gbWl4KDEuMCwgc2hhZG93LCBsaWdodC5zaGFkb3dJbnRlbnNpdHkpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9tbmkgc2hhZG93XG4gICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxPZmZzZXRQb2ludFNoYWRvdyhzaGFkb3dQYXJhbXMpOyAgLy8gbm9ybWFsQmlhcyBhZGp1c3RlZCBmb3IgZGlzdGFuY2VcblxuICAgICAgICAgICAgICAgICAgICAgICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YxKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZsb2F0IHNoYWRvdyA9IGdldFNoYWRvd09tbmlDbHVzdGVyZWRQQ0YxKHNoYWRvd0F0bGFzVGV4dHVyZSwgc2hhZG93UGFyYW1zLCBsaWdodC5vbW5pQXRsYXNWaWV3cG9ydCwgc2hhZG93RWRnZVBpeGVscywgZExpZ2h0RGlyVyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAjZWxpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGMylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmbG9hdCBzaGFkb3cgPSBnZXRTaGFkb3dPbW5pQ2x1c3RlcmVkUENGMyhzaGFkb3dBdGxhc1RleHR1cmUsIHNoYWRvd1BhcmFtcywgbGlnaHQub21uaUF0bGFzVmlld3BvcnQsIHNoYWRvd0VkZ2VQaXhlbHMsIGRMaWdodERpclcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgI2VsaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQgc2hhZG93ID0gZ2V0U2hhZG93T21uaUNsdXN0ZXJlZFBDRjUoc2hhZG93QXRsYXNUZXh0dXJlLCBzaGFkb3dQYXJhbXMsIGxpZ2h0Lm9tbmlBdGxhc1ZpZXdwb3J0LCBzaGFkb3dFZGdlUGl4ZWxzLCBkTGlnaHREaXJXKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICNlbmRpZlxuICAgICAgICAgICAgICAgICAgICAgICAgZEF0dGVuICo9IG1peCgxLjAsIHNoYWRvdywgbGlnaHQuc2hhZG93SW50ZW5zaXR5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICNlbmRpZlxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgLy8gZGlmZnVzZSAvIHNwZWN1bGFyIC8gY2xlYXJjb2F0XG4gICAgICAgICNpZmRlZiBDTFVTVEVSX0FSRUFMSUdIVFNcblxuICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodEFyZWEobGlnaHQpKSB7IC8vIGFyZWEgbGlnaHRcblxuICAgICAgICAgICAgLy8gYXJlYSBsaWdodCBkaWZmdXNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmVjMyBhcmVhRGlmZnVzZSA9IChkQXR0ZW5EICogZEF0dGVuKSAqIGxpZ2h0LmNvbG9yICogZEF0dGVuMztcblxuICAgICAgICAgICAgICAgICNpZiBkZWZpbmVkKExJVF9TUEVDVUxBUilcbiAgICAgICAgICAgICAgICAgICAgI2lmIGRlZmluZWQoTElUX0NPTlNFUlZFX0VORVJHWSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWFEaWZmdXNlID0gbWl4KGFyZWFEaWZmdXNlLCB2ZWMzKDApLCBkTFRDU3BlY0ZyZXMpO1xuICAgICAgICAgICAgICAgICAgICAjZW5kaWZcbiAgICAgICAgICAgICAgICAjZW5kaWZcblxuICAgICAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgZGlmZnVzZSAtIGl0IGRvZXMgbm90IG1peCBkaWZmdXNlIGxpZ2h0aW5nIGludG8gc3BlY3VsYXIgYXR0ZW51YXRpb25cbiAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ICs9IGFyZWFEaWZmdXNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzcGVjdWxhciBhbmQgY2xlYXIgY29hdCBhcmUgbWF0ZXJpYWwgc2V0dGluZ3MgYW5kIGdldCBpbmNsdWRlZCBieSBhIGRlZmluZSBiYXNlZCBvbiB0aGUgbWF0ZXJpYWxcbiAgICAgICAgICAgICNpZmRlZiBMSVRfU1BFQ1VMQVJcblxuICAgICAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgc3BlY3VsYXJcbiAgICAgICAgICAgICAgICBmbG9hdCBhcmVhTGlnaHRTcGVjdWxhcjtcblxuICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0UmVjdChsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJlYUxpZ2h0U3BlY3VsYXIgPSBnZXRSZWN0TGlnaHRTcGVjdWxhcigpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNDbHVzdGVyZWRMaWdodERpc2sobGlnaHQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGFyZWFMaWdodFNwZWN1bGFyID0gZ2V0RGlza0xpZ2h0U3BlY3VsYXIoKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBzcGhlcmVcbiAgICAgICAgICAgICAgICAgICAgYXJlYUxpZ2h0U3BlY3VsYXIgPSBnZXRTcGhlcmVMaWdodFNwZWN1bGFyKCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZFNwZWN1bGFyTGlnaHQgKz0gZExUQ1NwZWNGcmVzICogYXJlYUxpZ2h0U3BlY3VsYXIgKiBkQXR0ZW4gKiBsaWdodC5jb2xvciAqIGRBdHRlbjM7XG5cbiAgICAgICAgICAgICAgICAjaWZkZWYgTElUX0NMRUFSQ09BVFxuXG4gICAgICAgICAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgc3BlY3VsYXIgY2xlYXIgY29hdFxuICAgICAgICAgICAgICAgICAgICBmbG9hdCBhcmVhTGlnaHRTcGVjdWxhckNDO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0UmVjdChsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWFMaWdodFNwZWN1bGFyQ0MgPSBnZXRSZWN0TGlnaHRTcGVjdWxhckNDKCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNDbHVzdGVyZWRMaWdodERpc2sobGlnaHQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmVhTGlnaHRTcGVjdWxhckNDID0gZ2V0RGlza0xpZ2h0U3BlY3VsYXJDQygpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBzcGhlcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWFMaWdodFNwZWN1bGFyQ0MgPSBnZXRTcGhlcmVMaWdodFNwZWN1bGFyQ0MoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNjU3BlY3VsYXJMaWdodCArPSBjY0xUQ1NwZWNGcmVzICogYXJlYUxpZ2h0U3BlY3VsYXJDQyAqIGRBdHRlbiAqIGxpZ2h0LmNvbG9yICAqIGRBdHRlbjM7XG5cbiAgICAgICAgICAgICAgICAjZW5kaWZcblxuICAgICAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgfSBlbHNlXG5cbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgeyAgICAvLyBwdW5jdHVhbCBsaWdodFxuXG4gICAgICAgICAgICAvLyBwdW5jdHVhbCBsaWdodCBkaWZmdXNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmVjMyBwdW5jdHVhbERpZmZ1c2UgPSBkQXR0ZW4gKiBsaWdodC5jb2xvciAqIGRBdHRlbjM7XG5cbiAgICAgICAgICAgICAgICAjaWYgZGVmaW5lZChDTFVTVEVSX0FSRUFMSUdIVFMpXG4gICAgICAgICAgICAgICAgI2lmIGRlZmluZWQoTElUX1NQRUNVTEFSKVxuICAgICAgICAgICAgICAgICNpZiBkZWZpbmVkKExJVF9DT05TRVJWRV9FTkVSR1kpXG4gICAgICAgICAgICAgICAgICAgIHB1bmN0dWFsRGlmZnVzZSA9IG1peChwdW5jdHVhbERpZmZ1c2UsIHZlYzMoMCksIGRTcGVjdWxhcml0eSk7XG4gICAgICAgICAgICAgICAgI2VuZGlmXG4gICAgICAgICAgICAgICAgI2VuZGlmXG4gICAgICAgICAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ICs9IHB1bmN0dWFsRGlmZnVzZTtcbiAgICAgICAgICAgIH1cbiAgIFxuICAgICAgICAgICAgLy8gc3BlY3VsYXIgYW5kIGNsZWFyIGNvYXQgYXJlIG1hdGVyaWFsIHNldHRpbmdzIGFuZCBnZXQgaW5jbHVkZWQgYnkgYSBkZWZpbmUgYmFzZWQgb24gdGhlIG1hdGVyaWFsXG4gICAgICAgICAgICAjaWZkZWYgTElUX1NQRUNVTEFSXG5cbiAgICAgICAgICAgICAgICB2ZWMzIGhhbGZEaXIgPSBub3JtYWxpemUoLWRMaWdodERpck5vcm1XICsgZFZpZXdEaXJXKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBzcGVjdWxhclxuICAgICAgICAgICAgICAgICNpZmRlZiBMSVRfU1BFQ1VMQVJfRlJFU05FTFxuICAgICAgICAgICAgICAgICAgICBkU3BlY3VsYXJMaWdodCArPSBnZXRMaWdodFNwZWN1bGFyKGhhbGZEaXIpICogZEF0dGVuICogbGlnaHQuY29sb3IgKiBkQXR0ZW4zICogZ2V0RnJlc25lbChkb3QoZFZpZXdEaXJXLCBoYWxmRGlyKSwgZFNwZWN1bGFyaXR5KTtcbiAgICAgICAgICAgICAgICAjZWxzZVxuICAgICAgICAgICAgICAgICAgICBkU3BlY3VsYXJMaWdodCArPSBnZXRMaWdodFNwZWN1bGFyKGhhbGZEaXIpICogZEF0dGVuICogbGlnaHQuY29sb3IgKiBkQXR0ZW4zICogZFNwZWN1bGFyaXR5O1xuICAgICAgICAgICAgICAgICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgI2lmZGVmIExJVF9DTEVBUkNPQVRcbiAgICAgICAgICAgICAgICAgICAgI2lmZGVmIExJVF9TUEVDVUxBUl9GUkVTTkVMXG4gICAgICAgICAgICAgICAgICAgICAgICBjY1NwZWN1bGFyTGlnaHQgKz0gZ2V0TGlnaHRTcGVjdWxhckNDKGhhbGZEaXIpICogZEF0dGVuICogbGlnaHQuY29sb3IgKiBkQXR0ZW4zICogZ2V0RnJlc25lbENDKGRvdChkVmlld0RpclcsIGhhbGZEaXIpKTtcbiAgICAgICAgICAgICAgICAgICAgI2Vsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGNjU3BlY3VsYXJMaWdodCArPSBnZXRMaWdodFNwZWN1bGFyQ0MoaGFsZkRpcikgKiBkQXR0ZW4gKiBsaWdodC5jb2xvciAqIGRBdHRlbjM7XG4gICAgICAgICAgICAgICAgICAgICNlbmRpZlxuICAgICAgICAgICAgICAgICNlbmRpZlxuXG4gICAgICAgICAgICAgICAgI2lmZGVmIExJVF9TSEVFTlxuICAgICAgICAgICAgICAgICAgICBzU3BlY3VsYXJMaWdodCArPSBnZXRMaWdodFNwZWN1bGFyU2hlZW4oaGFsZkRpcikgKiBkQXR0ZW4gKiBsaWdodC5jb2xvciAqIGRBdHRlbjM7XG4gICAgICAgICAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgICAgICNlbmRpZlxuICAgICAgICB9XG4gICAgfVxufVxuXG52b2lkIGV2YWx1YXRlQ2x1c3RlckxpZ2h0KGZsb2F0IGxpZ2h0SW5kZXgpIHtcblxuICAgIC8vIGRlY29kZSBjb3JlIGxpZ2h0IGRhdGEgZnJvbSB0ZXh0dXJlc1xuICAgIENsdXN0ZXJMaWdodERhdGEgY2x1c3RlckxpZ2h0RGF0YTtcbiAgICBkZWNvZGVDbHVzdGVyTGlnaHRDb3JlKGNsdXN0ZXJMaWdodERhdGEsIGxpZ2h0SW5kZXgpO1xuXG4gICAgLy8gZXZhbHVhdGUgbGlnaHQgaWYgaXQgdXNlcyBhY2NlcHRlZCBsaWdodCBtYXNrXG4gICAgaWYgKGFjY2VwdExpZ2h0TWFzayhjbHVzdGVyTGlnaHREYXRhKSlcbiAgICAgICAgZXZhbHVhdGVMaWdodChjbHVzdGVyTGlnaHREYXRhKTtcbn1cblxudm9pZCBhZGRDbHVzdGVyZWRMaWdodHMoKSB7XG4gICAgLy8gd29ybGQgc3BhY2UgcG9zaXRpb24gdG8gM2QgaW50ZWdlciBjZWxsIGNvcmRpbmF0ZXMgaW4gdGhlIGNsdXN0ZXIgc3RydWN0dXJlXG4gICAgdmVjMyBjZWxsQ29vcmRzID0gZmxvb3IoKHZQb3NpdGlvblcgLSBjbHVzdGVyQm91bmRzTWluKSAqIGNsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplKTtcblxuICAgIC8vIG5vIGxpZ2h0aW5nIHdoZW4gY2VsbCBjb29yZGluYXRlIGlzIG91dCBvZiByYW5nZVxuICAgIGlmICghKGFueShsZXNzVGhhbihjZWxsQ29vcmRzLCB2ZWMzKDAuMCkpKSB8fCBhbnkoZ3JlYXRlclRoYW5FcXVhbChjZWxsQ29vcmRzLCBjbHVzdGVyQ2VsbHNNYXgpKSkpIHtcblxuICAgICAgICAvLyBjZWxsIGluZGV4IChtYXBwaW5nIGZyb20gM2QgY2VsbCBjb29yZGluYXRlcyB0byBsaW5lYXIgbWVtb3J5KVxuICAgICAgICBmbG9hdCBjZWxsSW5kZXggPSBkb3QoY2x1c3RlckNlbGxzRG90LCBjZWxsQ29vcmRzKTtcblxuICAgICAgICAvLyBjb252ZXJ0IGNlbGwgaW5kZXggdG8gdXYgY29vcmRpbmF0ZXNcbiAgICAgICAgZmxvYXQgY2x1c3RlclYgPSBmbG9vcihjZWxsSW5kZXggKiBjbHVzdGVyVGV4dHVyZVNpemUueSk7XG4gICAgICAgIGZsb2F0IGNsdXN0ZXJVID0gY2VsbEluZGV4IC0gKGNsdXN0ZXJWICogY2x1c3RlclRleHR1cmVTaXplLngpO1xuICAgICAgICBjbHVzdGVyViA9IChjbHVzdGVyViArIDAuNSkgKiBjbHVzdGVyVGV4dHVyZVNpemUuejtcblxuICAgICAgICAvLyBsb29wIG92ZXIgbWF4aW11bSBwb3NzaWJsZSBudW1iZXIgb2Ygc3VwcG9ydGVkIGxpZ2h0IGNlbGxzXG4gICAgICAgIGNvbnN0IGZsb2F0IG1heExpZ2h0Q2VsbHMgPSAyNTYuMCAvIDQuMDsgIC8vIDggYml0IGluZGV4LCBlYWNoIHN0b3JlcyA0IGxpZ2h0c1xuICAgICAgICBmb3IgKGZsb2F0IGxpZ2h0Q2VsbEluZGV4ID0gMC41OyBsaWdodENlbGxJbmRleCA8IG1heExpZ2h0Q2VsbHM7IGxpZ2h0Q2VsbEluZGV4KyspIHtcblxuICAgICAgICAgICAgdmVjNCBsaWdodEluZGljZXMgPSB0ZXh0dXJlMkRMb2RFWFQoY2x1c3RlcldvcmxkVGV4dHVyZSwgdmVjMihjbHVzdGVyVGV4dHVyZVNpemUueSAqIChjbHVzdGVyVSArIGxpZ2h0Q2VsbEluZGV4KSwgY2x1c3RlclYpLCAwLjApO1xuICAgICAgICAgICAgdmVjNCBpbmRpY2VzID0gbGlnaHRJbmRpY2VzICogMjU1LjA7XG5cbiAgICAgICAgICAgIC8vIGV2YWx1YXRlIHVwIHRvIDQgbGlnaHRzLiBUaGlzIGlzIHdyaXR0ZW4gdXNpbmcgYSBsb29wIGluc3RlYWQgb2YgbWFudWFsbHkgdW5yb2xsaW5nIHRvIGtlZXAgc2hhZGVyIGNvbXBpbGUgdGltZSBzbWFsbGVyXG4gICAgICAgICAgICBmb3IgKGludCBpID0gMDsgaSA8IDQ7IGkrKykge1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChpbmRpY2VzLnggPD0gMC4wKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgICAgICAgICBldmFsdWF0ZUNsdXN0ZXJMaWdodChpbmRpY2VzLngpOyBcbiAgICAgICAgICAgICAgICBpbmRpY2VzID0gaW5kaWNlcy55end4O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBlbmQgb2YgdGhlIGNlbGwgYXJyYXlcbiAgICAgICAgICAgIGlmIChsaWdodENlbGxJbmRleCA+IGNsdXN0ZXJQaXhlbHNQZXJDZWxsKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsdUJBQTBCLENBQUE7QUFDMUI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==