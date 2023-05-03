var clusteredLightPS = /* glsl */`
uniform highp sampler2D clusterWorldTexture;
uniform highp sampler2D lightsTexture8;
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

#ifdef GL2
    uniform int clusterMaxCells;
#else
    uniform float clusterMaxCells;
    uniform vec4 lightsTextureInvSize;
#endif

// 1.0 if clustered lighting can be skipped (0 lights in the clusters)
uniform float clusterSkip;

uniform vec3 clusterCellsCountByBoundsSize;
uniform vec3 clusterTextureSize;
uniform vec3 clusterBoundsMin;
uniform vec3 clusterBoundsDelta;
uniform vec3 clusterCellsDot;
uniform vec3 clusterCellsMax;
uniform vec2 clusterCompressionLimit0;
uniform vec2 shadowAtlasParams;

// structure storing light properties of a clustered light
// it's sorted to have all vectors aligned to 4 floats to limit padding
struct ClusterLightData {

    // area light sizes / orientation
    vec3 halfWidth;

    // type of the light (spot or omni)
    float lightType;

    // area light sizes / orientation
    vec3 halfHeight;

    #ifdef GL2
        // light index
        int lightIndex;
    #else
        // v coordinate to look up the light textures - this is the same as lightIndex but in 0..1 range
        float lightV;
    #endif

    // world space position
    vec3 position;

    // area light shape
    float shape;

    // world space direction (spot light only)
    vec3 direction;

    // light follow mode
    float falloffMode;

    // color
    vec3 color;

    // 0.0 if the light doesn't cast shadows
    float shadowIntensity;

    // atlas viewport for omni light shadow and cookie (.xy is offset to the viewport slot, .z is size of the face in the atlas)
    vec3 omniAtlasViewport;

    // range of the light
    float range;

    // channel mask - one of the channels has 1, the others are 0
    vec4 cookieChannelMask;

    // shadow bias values
    float shadowBias;
    float shadowNormalBias;

    // spot light inner and outer angle cosine
    float innerConeAngleCos;
    float outerConeAngleCos;

    // 1.0 if the light has a cookie texture
    float cookie;

    // 1.0 if cookie texture is rgb, otherwise it is using a single channel selectable by cookieChannelMask
    float cookieRgb;

    // intensity of the cookie
    float cookieIntensity;

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
#define isClusteredLightSpot(light) ( light.lightType > 0.5 )
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

#ifdef GL2

    vec4 sampleLightsTexture8(const ClusterLightData clusterLightData, int index) {
        return texelFetch(lightsTexture8, ivec2(index, clusterLightData.lightIndex), 0);
    }

    vec4 sampleLightTextureF(const ClusterLightData clusterLightData, int index) {
        return texelFetch(lightsTextureFloat, ivec2(index, clusterLightData.lightIndex), 0);
    }

#else

    vec4 sampleLightsTexture8(const ClusterLightData clusterLightData, float index) {
        return texture2DLodEXT(lightsTexture8, vec2(index * lightsTextureInvSize.z, clusterLightData.lightV), 0.0);
    }

    vec4 sampleLightTextureF(const ClusterLightData clusterLightData, float index) {
        return texture2DLodEXT(lightsTextureFloat, vec2(index * lightsTextureInvSize.x, clusterLightData.lightV), 0.0);
    }

#endif

void decodeClusterLightCore(inout ClusterLightData clusterLightData, float lightIndex) {

    // light index
    #ifdef GL2
        clusterLightData.lightIndex = int(lightIndex);
    #else
        clusterLightData.lightV = (lightIndex + 0.5) * lightsTextureInvSize.w;
    #endif

    // shared data from 8bit texture
    vec4 lightInfo = sampleLightsTexture8(clusterLightData, CLUSTER_TEXTURE_8_FLAGS);
    clusterLightData.lightType = lightInfo.x;
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

void evaluateLight(
    ClusterLightData light, 
    vec3 worldNormal, 
    vec3 viewDir, 
    vec3 reflectionDir,
#if defined(LIT_CLEARCOAT)
    vec3 clearcoatReflectionDir,
#endif
    float gloss, 
    vec3 specularity, 
    vec3 geometricNormal, 
    mat3 tbn, 
#if defined(LIT_IRIDESCENCE)
    vec3 iridescenceFresnel,
#endif
    ClearcoatArgs clearcoat, 
    SheenArgs sheen, 
    IridescenceArgs iridescence
) {

    vec3 cookieAttenuation = vec3(1.0);
    float diffuseAttenuation = 1.0;
    float falloffAttenuation = 1.0;

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

        falloffAttenuation = getFalloffWindow(light.range, dLightDirW);

    } else

    #endif

    {   // punctual light

        if (isClusteredLightFalloffLinear(light))
            falloffAttenuation = getFalloffLinear(light.range, dLightDirW);
        else
            falloffAttenuation = getFalloffInvSquared(light.range, dLightDirW);
    }

    if (falloffAttenuation > 0.00001) {

        #ifdef CLUSTER_AREALIGHTS

        if (isClusteredLightArea(light)) { // area light

            // handle light shape
            if (isClusteredLightRect(light)) {
                diffuseAttenuation = getRectLightDiffuse(worldNormal, viewDir, dLightDirW, dLightDirNormW) * 16.0;
            } else if (isClusteredLightDisk(light)) {
                diffuseAttenuation = getDiskLightDiffuse(worldNormal, viewDir, dLightDirW, dLightDirNormW) * 16.0;
            } else { // sphere
                diffuseAttenuation = getSphereLightDiffuse(worldNormal, viewDir, dLightDirW, dLightDirNormW) * 16.0;
            }

        } else

        #endif

        {
            falloffAttenuation *= getLightDiffuse(worldNormal, viewDir, dLightDirW, dLightDirNormW); 
        }

        // spot light falloff
        if (isClusteredLightSpot(light)) {
            decodeClusterLightSpot(light);
            falloffAttenuation *= getSpotEffect(light.direction, light.innerConeAngleCos, light.outerConeAngleCos, dLightDirNormW);
        }

        #if defined(CLUSTER_COOKIES_OR_SHADOWS)

        if (falloffAttenuation > 0.00001) {

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
                        cookieAttenuation = getCookie2DClustered(TEXTURE_PASS(cookieAtlasTexture), lightProjectionMatrix, vPositionW, light.cookieIntensity, isClusteredLightCookieRgb(light), light.cookieChannelMask);
                    } else {
                        cookieAttenuation = getCookieCubeClustered(TEXTURE_PASS(cookieAtlasTexture), dLightDirW, light.cookieIntensity, isClusteredLightCookieRgb(light), light.cookieChannelMask, shadowTextureResolution, shadowEdgePixels, light.omniAtlasViewport);
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
                        getShadowCoordPerspZbufferNormalOffset(lightProjectionMatrix, shadowParams, geometricNormal);
                        
                        #if defined(CLUSTER_SHADOW_TYPE_PCF1)
                            float shadow = getShadowSpotClusteredPCF1(SHADOWMAP_PASS(shadowAtlasTexture), dShadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF3)
                            float shadow = getShadowSpotClusteredPCF3(SHADOWMAP_PASS(shadowAtlasTexture), dShadowCoord, shadowParams);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF5)
                            float shadow = getShadowSpotClusteredPCF5(SHADOWMAP_PASS(shadowAtlasTexture), dShadowCoord, shadowParams);
                        #endif
                        falloffAttenuation *= mix(1.0, shadow, light.shadowIntensity);

                    } else {

                        // omni shadow
                        normalOffsetPointShadow(shadowParams, dLightPosW, dLightDirW, dLightDirNormW, geometricNormal);  // normalBias adjusted for distance

                        #if defined(CLUSTER_SHADOW_TYPE_PCF1)
                            float shadow = getShadowOmniClusteredPCF1(SHADOWMAP_PASS(shadowAtlasTexture), shadowParams, light.omniAtlasViewport, shadowEdgePixels, dLightDirW);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF3)
                            float shadow = getShadowOmniClusteredPCF3(SHADOWMAP_PASS(shadowAtlasTexture), shadowParams, light.omniAtlasViewport, shadowEdgePixels, dLightDirW);
                        #elif defined(CLUSTER_SHADOW_TYPE_PCF5)
                            float shadow = getShadowOmniClusteredPCF5(SHADOWMAP_PASS(shadowAtlasTexture), shadowParams, light.omniAtlasViewport, shadowEdgePixels, dLightDirW);
                        #endif
                        falloffAttenuation *= mix(1.0, shadow, light.shadowIntensity);
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
                vec3 areaDiffuse = (diffuseAttenuation * falloffAttenuation) * light.color * cookieAttenuation;

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
                    areaLightSpecular = getRectLightSpecular(worldNormal, viewDir);
                } else if (isClusteredLightDisk(light)) {
                    areaLightSpecular = getDiskLightSpecular(worldNormal, viewDir);
                } else { // sphere
                    areaLightSpecular = getSphereLightSpecular(worldNormal, viewDir);
                }

                dSpecularLight += dLTCSpecFres * areaLightSpecular * falloffAttenuation * light.color * cookieAttenuation;

                #ifdef LIT_CLEARCOAT

                    // area light specular clear coat
                    float areaLightSpecularCC;

                    if (isClusteredLightRect(light)) {
                        areaLightSpecularCC = getRectLightSpecular(clearcoat.worldNormal, viewDir);
                    } else if (isClusteredLightDisk(light)) {
                        areaLightSpecularCC = getDiskLightSpecular(clearcoat.worldNormal, viewDir);
                    } else { // sphere
                        areaLightSpecularCC = getSphereLightSpecular(clearcoat.worldNormal, viewDir);
                    }

                    ccSpecularLight += ccLTCSpecFres * areaLightSpecularCC * falloffAttenuation * light.color  * cookieAttenuation;

                #endif

            #endif

        } else

        #endif

        {    // punctual light

            // punctual light diffuse
            {
                vec3 punctualDiffuse = falloffAttenuation * light.color * cookieAttenuation;

                #if defined(CLUSTER_AREALIGHTS)
                #if defined(LIT_SPECULAR)
                #if defined(LIT_CONSERVE_ENERGY)
                    punctualDiffuse = mix(punctualDiffuse, vec3(0), specularity);
                #endif
                #endif
                #endif

                dDiffuseLight += punctualDiffuse;
            }
   
            // specular and clear coat are material settings and get included by a define based on the material
            #ifdef LIT_SPECULAR

                vec3 halfDir = normalize(-dLightDirNormW + viewDir);
                
                // specular
                #ifdef LIT_SPECULAR_FRESNEL
                    dSpecularLight += 
                        getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, dLightDirNormW, gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * 
                        getFresnel(
                            dot(viewDir, halfDir), 
                            gloss, 
                            specularity
                        #if defined(LIT_IRIDESCENCE)
                            , iridescenceFresnel,
                            iridescence
                        #endif
                            );
                #else
                    dSpecularLight += getLightSpecular(halfDir, reflectionDir, worldNormal, viewDir, dLightDirNormW, gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * specularity;
                #endif

                #ifdef LIT_CLEARCOAT
                    #ifdef LIT_SPECULAR_FRESNEL
                        ccSpecularLight += getLightSpecular(halfDir, clearcoatReflectionDir, clearcoat.worldNormal, viewDir, dLightDirNormW, clearcoat.gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation * getFresnelCC(dot(viewDir, halfDir));
                    #else
                        ccSpecularLight += getLightSpecular(halfDir, clearcoatReflectionDir, clearcoat.worldNormal, viewDir, dLightDirNormW, clearcoat.gloss, tbn) * falloffAttenuation * light.color * cookieAttenuation; 
                    #endif
                #endif

                #ifdef LIT_SHEEN
                    sSpecularLight += getLightSpecularSheen(halfDir, worldNormal, viewDir, dLightDirNormW, sheen.gloss) * falloffAttenuation * light.color * cookieAttenuation;
                #endif

            #endif
        }
    }

    // Write to global attenuation values (for lightmapper)
    dAtten = falloffAttenuation;
    dAttenD = diffuseAttenuation;
    dAtten3 = cookieAttenuation;
}

void evaluateClusterLight(
    float lightIndex, 
    vec3 worldNormal, 
    vec3 viewDir, 
    vec3 reflectionDir, 
#if defined(LIT_CLEARCOAT)
    vec3 clearcoatReflectionDir,
#endif
    float gloss, 
    vec3 specularity, 
    vec3 geometricNormal, 
    mat3 tbn, 
#if defined(LIT_IRIDESCENCE)
    vec3 iridescenceFresnel,
#endif
    ClearcoatArgs clearcoat, 
    SheenArgs sheen, 
    IridescenceArgs iridescence
) {

    // decode core light data from textures
    ClusterLightData clusterLightData;
    decodeClusterLightCore(clusterLightData, lightIndex);

    // evaluate light if it uses accepted light mask
    if (acceptLightMask(clusterLightData))
        evaluateLight(
            clusterLightData, 
            worldNormal, 
            viewDir, 
            reflectionDir, 
#if defined(LIT_CLEARCOAT)
            clearcoatReflectionDir, 
#endif
            gloss, 
            specularity, 
            geometricNormal, 
            tbn, 
#if defined(LIT_IRIDESCENCE)
            iridescenceFresnel,
#endif
            clearcoat, 
            sheen, 
            iridescence
        );
}

void addClusteredLights(
    vec3 worldNormal, 
    vec3 viewDir, 
    vec3 reflectionDir, 
#if defined(LIT_CLEARCOAT)
    vec3 clearcoatReflectionDir,
#endif
    float gloss, 
    vec3 specularity, 
    vec3 geometricNormal, 
    mat3 tbn, 
#if defined(LIT_IRIDESCENCE)
    vec3 iridescenceFresnel,
#endif
    ClearcoatArgs clearcoat, 
    SheenArgs sheen, 
    IridescenceArgs iridescence
) {

    // skip lights if no lights at all
    if (clusterSkip > 0.5)
        return;

    // world space position to 3d integer cell cordinates in the cluster structure
    vec3 cellCoords = floor((vPositionW - clusterBoundsMin) * clusterCellsCountByBoundsSize);

    // no lighting when cell coordinate is out of range
    if (!(any(lessThan(cellCoords, vec3(0.0))) || any(greaterThanEqual(cellCoords, clusterCellsMax)))) {

        // cell index (mapping from 3d cell coordinates to linear memory)
        float cellIndex = dot(clusterCellsDot, cellCoords);

        // convert cell index to uv coordinates
        float clusterV = floor(cellIndex * clusterTextureSize.y);
        float clusterU = cellIndex - (clusterV * clusterTextureSize.x);

        #ifdef GL2

            // loop over maximum number of light cells
            for (int lightCellIndex = 0; lightCellIndex < clusterMaxCells; lightCellIndex++) {

                // using a single channel texture with data in alpha channel
                float lightIndex = texelFetch(clusterWorldTexture, ivec2(int(clusterU) + lightCellIndex, clusterV), 0).x;

                if (lightIndex <= 0.0)
                        return;

                evaluateClusterLight(
                    lightIndex * 255.0, 
                    worldNormal, 
                    viewDir, 
                    reflectionDir,
#if defined(LIT_CLEARCOAT)
                    clearcoatReflectionDir,
#endif
                    gloss, 
                    specularity, 
                    geometricNormal, 
                    tbn, 
#if defined(LIT_IRIDESCENCE)
                    iridescenceFresnel,
#endif
                    clearcoat, 
                    sheen, 
                    iridescence
                ); 
            }

        #else

            clusterV = (clusterV + 0.5) * clusterTextureSize.z;

            // loop over maximum possible number of supported light cells
            const float maxLightCells = 256.0;
            for (float lightCellIndex = 0.5; lightCellIndex < maxLightCells; lightCellIndex++) {

                float lightIndex = texture2DLodEXT(clusterWorldTexture, vec2(clusterTextureSize.y * (clusterU + lightCellIndex), clusterV), 0.0).x;

                if (lightIndex <= 0.0)
                    return;
                
                evaluateClusterLight(
                    lightIndex * 255.0, 
                    worldNormal, 
                    viewDir, 
                    reflectionDir,
#if defined(LIT_CLEARCOAT)
                    clearcoatReflectionDir,
#endif
                    gloss, 
                    specularity, 
                    geometricNormal, 
                    tbn, 
#if defined(LIT_IRIDESCENCE)
                    iridescenceFresnel,
#endif
                    clearcoat, 
                    sheen, 
                    iridescence
                ); 
                // end of the cell array
                if (lightCellIndex >= clusterMaxCells) {
                    break;
                }
            }

        #endif
    }
}
`;

export { clusteredLightPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2x1c3RlcmVkTGlnaHQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9jbHVzdGVyZWRMaWdodC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgY2x1c3RlcldvcmxkVGV4dHVyZTtcbnVuaWZvcm0gaGlnaHAgc2FtcGxlcjJEIGxpZ2h0c1RleHR1cmU4O1xudW5pZm9ybSBoaWdocCBzYW1wbGVyMkQgbGlnaHRzVGV4dHVyZUZsb2F0O1xuXG4vLyBjb21wbGV4IGlmZGVmIGV4cHJlc3Npb24gYXJlIG5vdCBzdXBwb3J0ZWQsIGhhbmRsZSBpdCBoZXJlXG4vLyBkZWZpbmVkKENMVVNURVJfQ09PS0lFUykgfHwgZGVmaW5lZChDTFVTVEVSX1NIQURPV1MpXG4jaWYgZGVmaW5lZChDTFVTVEVSX0NPT0tJRVMpXG4gICAgI2RlZmluZSBDTFVTVEVSX0NPT0tJRVNfT1JfU0hBRE9XU1xuI2VuZGlmXG4jaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV1MpXG4gICAgI2RlZmluZSBDTFVTVEVSX0NPT0tJRVNfT1JfU0hBRE9XU1xuI2VuZGlmXG5cbiNpZmRlZiBDTFVTVEVSX1NIQURPV1NcbiAgICAjaWZkZWYgR0wyXG4gICAgICAgIC8vIFRPRE86IHdoZW4gVlNNIHNoYWRvdyBpcyBzdXBwb3J0ZWQsIGl0IG5lZWRzIHRvIHVzZSBzYW1wbGVyMkQgaW4gd2ViZ2wyXG4gICAgICAgIHVuaWZvcm0gc2FtcGxlcjJEU2hhZG93IHNoYWRvd0F0bGFzVGV4dHVyZTtcbiAgICAjZWxzZVxuICAgICAgICB1bmlmb3JtIHNhbXBsZXIyRCBzaGFkb3dBdGxhc1RleHR1cmU7XG4gICAgI2VuZGlmXG4jZW5kaWZcblxuI2lmZGVmIENMVVNURVJfQ09PS0lFU1xuICAgIHVuaWZvcm0gc2FtcGxlcjJEIGNvb2tpZUF0bGFzVGV4dHVyZTtcbiNlbmRpZlxuXG4jaWZkZWYgR0wyXG4gICAgdW5pZm9ybSBpbnQgY2x1c3Rlck1heENlbGxzO1xuI2Vsc2VcbiAgICB1bmlmb3JtIGZsb2F0IGNsdXN0ZXJNYXhDZWxscztcbiAgICB1bmlmb3JtIHZlYzQgbGlnaHRzVGV4dHVyZUludlNpemU7XG4jZW5kaWZcblxuLy8gMS4wIGlmIGNsdXN0ZXJlZCBsaWdodGluZyBjYW4gYmUgc2tpcHBlZCAoMCBsaWdodHMgaW4gdGhlIGNsdXN0ZXJzKVxudW5pZm9ybSBmbG9hdCBjbHVzdGVyU2tpcDtcblxudW5pZm9ybSB2ZWMzIGNsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplO1xudW5pZm9ybSB2ZWMzIGNsdXN0ZXJUZXh0dXJlU2l6ZTtcbnVuaWZvcm0gdmVjMyBjbHVzdGVyQm91bmRzTWluO1xudW5pZm9ybSB2ZWMzIGNsdXN0ZXJCb3VuZHNEZWx0YTtcbnVuaWZvcm0gdmVjMyBjbHVzdGVyQ2VsbHNEb3Q7XG51bmlmb3JtIHZlYzMgY2x1c3RlckNlbGxzTWF4O1xudW5pZm9ybSB2ZWMyIGNsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MDtcbnVuaWZvcm0gdmVjMiBzaGFkb3dBdGxhc1BhcmFtcztcblxuLy8gc3RydWN0dXJlIHN0b3JpbmcgbGlnaHQgcHJvcGVydGllcyBvZiBhIGNsdXN0ZXJlZCBsaWdodFxuLy8gaXQncyBzb3J0ZWQgdG8gaGF2ZSBhbGwgdmVjdG9ycyBhbGlnbmVkIHRvIDQgZmxvYXRzIHRvIGxpbWl0IHBhZGRpbmdcbnN0cnVjdCBDbHVzdGVyTGlnaHREYXRhIHtcblxuICAgIC8vIGFyZWEgbGlnaHQgc2l6ZXMgLyBvcmllbnRhdGlvblxuICAgIHZlYzMgaGFsZldpZHRoO1xuXG4gICAgLy8gdHlwZSBvZiB0aGUgbGlnaHQgKHNwb3Qgb3Igb21uaSlcbiAgICBmbG9hdCBsaWdodFR5cGU7XG5cbiAgICAvLyBhcmVhIGxpZ2h0IHNpemVzIC8gb3JpZW50YXRpb25cbiAgICB2ZWMzIGhhbGZIZWlnaHQ7XG5cbiAgICAjaWZkZWYgR0wyXG4gICAgICAgIC8vIGxpZ2h0IGluZGV4XG4gICAgICAgIGludCBsaWdodEluZGV4O1xuICAgICNlbHNlXG4gICAgICAgIC8vIHYgY29vcmRpbmF0ZSB0byBsb29rIHVwIHRoZSBsaWdodCB0ZXh0dXJlcyAtIHRoaXMgaXMgdGhlIHNhbWUgYXMgbGlnaHRJbmRleCBidXQgaW4gMC4uMSByYW5nZVxuICAgICAgICBmbG9hdCBsaWdodFY7XG4gICAgI2VuZGlmXG5cbiAgICAvLyB3b3JsZCBzcGFjZSBwb3NpdGlvblxuICAgIHZlYzMgcG9zaXRpb247XG5cbiAgICAvLyBhcmVhIGxpZ2h0IHNoYXBlXG4gICAgZmxvYXQgc2hhcGU7XG5cbiAgICAvLyB3b3JsZCBzcGFjZSBkaXJlY3Rpb24gKHNwb3QgbGlnaHQgb25seSlcbiAgICB2ZWMzIGRpcmVjdGlvbjtcblxuICAgIC8vIGxpZ2h0IGZvbGxvdyBtb2RlXG4gICAgZmxvYXQgZmFsbG9mZk1vZGU7XG5cbiAgICAvLyBjb2xvclxuICAgIHZlYzMgY29sb3I7XG5cbiAgICAvLyAwLjAgaWYgdGhlIGxpZ2h0IGRvZXNuJ3QgY2FzdCBzaGFkb3dzXG4gICAgZmxvYXQgc2hhZG93SW50ZW5zaXR5O1xuXG4gICAgLy8gYXRsYXMgdmlld3BvcnQgZm9yIG9tbmkgbGlnaHQgc2hhZG93IGFuZCBjb29raWUgKC54eSBpcyBvZmZzZXQgdG8gdGhlIHZpZXdwb3J0IHNsb3QsIC56IGlzIHNpemUgb2YgdGhlIGZhY2UgaW4gdGhlIGF0bGFzKVxuICAgIHZlYzMgb21uaUF0bGFzVmlld3BvcnQ7XG5cbiAgICAvLyByYW5nZSBvZiB0aGUgbGlnaHRcbiAgICBmbG9hdCByYW5nZTtcblxuICAgIC8vIGNoYW5uZWwgbWFzayAtIG9uZSBvZiB0aGUgY2hhbm5lbHMgaGFzIDEsIHRoZSBvdGhlcnMgYXJlIDBcbiAgICB2ZWM0IGNvb2tpZUNoYW5uZWxNYXNrO1xuXG4gICAgLy8gc2hhZG93IGJpYXMgdmFsdWVzXG4gICAgZmxvYXQgc2hhZG93QmlhcztcbiAgICBmbG9hdCBzaGFkb3dOb3JtYWxCaWFzO1xuXG4gICAgLy8gc3BvdCBsaWdodCBpbm5lciBhbmQgb3V0ZXIgYW5nbGUgY29zaW5lXG4gICAgZmxvYXQgaW5uZXJDb25lQW5nbGVDb3M7XG4gICAgZmxvYXQgb3V0ZXJDb25lQW5nbGVDb3M7XG5cbiAgICAvLyAxLjAgaWYgdGhlIGxpZ2h0IGhhcyBhIGNvb2tpZSB0ZXh0dXJlXG4gICAgZmxvYXQgY29va2llO1xuXG4gICAgLy8gMS4wIGlmIGNvb2tpZSB0ZXh0dXJlIGlzIHJnYiwgb3RoZXJ3aXNlIGl0IGlzIHVzaW5nIGEgc2luZ2xlIGNoYW5uZWwgc2VsZWN0YWJsZSBieSBjb29raWVDaGFubmVsTWFza1xuICAgIGZsb2F0IGNvb2tpZVJnYjtcblxuICAgIC8vIGludGVuc2l0eSBvZiB0aGUgY29va2llXG4gICAgZmxvYXQgY29va2llSW50ZW5zaXR5O1xuXG4gICAgLy8gbGlnaHQgbWFza1xuICAgIGZsb2F0IG1hc2s7XG59O1xuXG4vLyBOb3RlOiBvbiBzb21lIGRldmljZXMgKHRlc3RlZCBvbiBQaXhlbCAzQSBYTCksIHRoaXMgbWF0cml4IHdoZW4gc3RvcmVkIGluc2lkZSB0aGUgbGlnaHQgc3RydWN0IGhhcyBsb3dlciBwcmVjaXNpb24gY29tcGFyZWQgdG9cbi8vIHdoZW4gc3RvcmVkIG91dHNpZGUsIHNvIHdlIHN0b3JlIGl0IG91dHNpZGUgdG8gYXZvaWQgc3BvdCBzaGFkb3cgZmxpY2tlcmluZy4gVGhpcyBtaWdodCBuZWVkIHRvIGJlIGRvbmUgdG8gb3RoZXIgLyBhbGwgbWVtYmVyc1xuLy8gb2YgdGhlIHN0cnVjdHVyZSBpZiBmdXJ0aGVyIHNpbWlsYXIgaXNzdWVzIGFyZSBvYnNlcnZlZC5cblxuLy8gc2hhZG93IChzcG90IGxpZ2h0IG9ubHkpIC8gY29va2llIHByb2plY3Rpb24gbWF0cml4XG5tYXQ0IGxpZ2h0UHJvamVjdGlvbk1hdHJpeDtcblxuLy8gbWFjcm9zIGZvciBsaWdodCBwcm9wZXJ0aWVzXG4jZGVmaW5lIGlzQ2x1c3RlcmVkTGlnaHRDYXN0U2hhZG93KGxpZ2h0KSAoIGxpZ2h0LnNoYWRvd0ludGVuc2l0eSA+IDAuMCApXG4jZGVmaW5lIGlzQ2x1c3RlcmVkTGlnaHRDb29raWUobGlnaHQpIChsaWdodC5jb29raWUgPiAwLjUgKVxuI2RlZmluZSBpc0NsdXN0ZXJlZExpZ2h0Q29va2llUmdiKGxpZ2h0KSAobGlnaHQuY29va2llUmdiID4gMC41IClcbiNkZWZpbmUgaXNDbHVzdGVyZWRMaWdodFNwb3QobGlnaHQpICggbGlnaHQubGlnaHRUeXBlID4gMC41IClcbiNkZWZpbmUgaXNDbHVzdGVyZWRMaWdodEZhbGxvZmZMaW5lYXIobGlnaHQpICggbGlnaHQuZmFsbG9mZk1vZGUgPCAwLjUgKVxuXG4vLyBtYWNyb3MgdG8gdGVzdCBsaWdodCBzaGFwZVxuLy8gTm90ZTogRm9sbG93aW5nIGZ1bmN0aW9ucyBuZWVkIHRvIGJlIGNhbGxlZCBzZXJpYWxseSBpbiBsaXN0ZWQgb3JkZXIgYXMgdGhleSBkbyBub3QgdGVzdCBib3RoICc+JyBhbmQgJzwnXG4jZGVmaW5lIGlzQ2x1c3RlcmVkTGlnaHRBcmVhKGxpZ2h0KSAoIGxpZ2h0LnNoYXBlID4gMC4xIClcbiNkZWZpbmUgaXNDbHVzdGVyZWRMaWdodFJlY3QobGlnaHQpICggbGlnaHQuc2hhcGUgPCAwLjMgKVxuI2RlZmluZSBpc0NsdXN0ZXJlZExpZ2h0RGlzayhsaWdodCkgKCBsaWdodC5zaGFwZSA8IDAuNiApXG5cbi8vIG1hY3JvIHRvIHRlc3QgbGlnaHQgbWFzayAobWVzaCBhY2NlcHRzIGR5bmFtaWMgdnMgbGlnaHRtYXBwZWQgbGlnaHRzKVxuI2lmZGVmIENMVVNURVJfTUVTSF9EWU5BTUlDX0xJR0hUU1xuICAgIC8vIGFjY2VwdCBsaWdodHMgbWFya2VkIGFzIGR5bmFtaWMgb3IgYm90aCBkeW5hbWljIGFuZCBsaWdodG1hcHBlZFxuICAgICNkZWZpbmUgYWNjZXB0TGlnaHRNYXNrKGxpZ2h0KSAoIGxpZ2h0Lm1hc2sgPCAwLjc1KVxuI2Vsc2VcbiAgICAvLyBhY2NlcHQgbGlnaHRzIG1hcmtlZCBhcyBsaWdodG1hcHBlZCBvciBib3RoIGR5bmFtaWMgYW5kIGxpZ2h0bWFwcGVkXG4gICAgI2RlZmluZSBhY2NlcHRMaWdodE1hc2sobGlnaHQpICggbGlnaHQubWFzayA+IDAuMjUpXG4jZW5kaWZcblxudmVjNCBkZWNvZGVDbHVzdGVyTG93UmFuZ2U0VmVjNCh2ZWM0IGQwLCB2ZWM0IGQxLCB2ZWM0IGQyLCB2ZWM0IGQzKSB7XG4gICAgcmV0dXJuIHZlYzQoXG4gICAgICAgIGJ5dGVzMmZsb2F0UmFuZ2U0KGQwLCAtMi4wLCAyLjApLFxuICAgICAgICBieXRlczJmbG9hdFJhbmdlNChkMSwgLTIuMCwgMi4wKSxcbiAgICAgICAgYnl0ZXMyZmxvYXRSYW5nZTQoZDIsIC0yLjAsIDIuMCksXG4gICAgICAgIGJ5dGVzMmZsb2F0UmFuZ2U0KGQzLCAtMi4wLCAyLjApXG4gICAgKTtcbn1cblxuI2lmZGVmIEdMMlxuXG4gICAgdmVjNCBzYW1wbGVMaWdodHNUZXh0dXJlOChjb25zdCBDbHVzdGVyTGlnaHREYXRhIGNsdXN0ZXJMaWdodERhdGEsIGludCBpbmRleCkge1xuICAgICAgICByZXR1cm4gdGV4ZWxGZXRjaChsaWdodHNUZXh0dXJlOCwgaXZlYzIoaW5kZXgsIGNsdXN0ZXJMaWdodERhdGEubGlnaHRJbmRleCksIDApO1xuICAgIH1cblxuICAgIHZlYzQgc2FtcGxlTGlnaHRUZXh0dXJlRihjb25zdCBDbHVzdGVyTGlnaHREYXRhIGNsdXN0ZXJMaWdodERhdGEsIGludCBpbmRleCkge1xuICAgICAgICByZXR1cm4gdGV4ZWxGZXRjaChsaWdodHNUZXh0dXJlRmxvYXQsIGl2ZWMyKGluZGV4LCBjbHVzdGVyTGlnaHREYXRhLmxpZ2h0SW5kZXgpLCAwKTtcbiAgICB9XG5cbiNlbHNlXG5cbiAgICB2ZWM0IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNvbnN0IENsdXN0ZXJMaWdodERhdGEgY2x1c3RlckxpZ2h0RGF0YSwgZmxvYXQgaW5kZXgpIHtcbiAgICAgICAgcmV0dXJuIHRleHR1cmUyRExvZEVYVChsaWdodHNUZXh0dXJlOCwgdmVjMihpbmRleCAqIGxpZ2h0c1RleHR1cmVJbnZTaXplLnosIGNsdXN0ZXJMaWdodERhdGEubGlnaHRWKSwgMC4wKTtcbiAgICB9XG5cbiAgICB2ZWM0IHNhbXBsZUxpZ2h0VGV4dHVyZUYoY29uc3QgQ2x1c3RlckxpZ2h0RGF0YSBjbHVzdGVyTGlnaHREYXRhLCBmbG9hdCBpbmRleCkge1xuICAgICAgICByZXR1cm4gdGV4dHVyZTJETG9kRVhUKGxpZ2h0c1RleHR1cmVGbG9hdCwgdmVjMihpbmRleCAqIGxpZ2h0c1RleHR1cmVJbnZTaXplLngsIGNsdXN0ZXJMaWdodERhdGEubGlnaHRWKSwgMC4wKTtcbiAgICB9XG5cbiNlbmRpZlxuXG52b2lkIGRlY29kZUNsdXN0ZXJMaWdodENvcmUoaW5vdXQgQ2x1c3RlckxpZ2h0RGF0YSBjbHVzdGVyTGlnaHREYXRhLCBmbG9hdCBsaWdodEluZGV4KSB7XG5cbiAgICAvLyBsaWdodCBpbmRleFxuICAgICNpZmRlZiBHTDJcbiAgICAgICAgY2x1c3RlckxpZ2h0RGF0YS5saWdodEluZGV4ID0gaW50KGxpZ2h0SW5kZXgpO1xuICAgICNlbHNlXG4gICAgICAgIGNsdXN0ZXJMaWdodERhdGEubGlnaHRWID0gKGxpZ2h0SW5kZXggKyAwLjUpICogbGlnaHRzVGV4dHVyZUludlNpemUudztcbiAgICAjZW5kaWZcblxuICAgIC8vIHNoYXJlZCBkYXRhIGZyb20gOGJpdCB0ZXh0dXJlXG4gICAgdmVjNCBsaWdodEluZm8gPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9GTEFHUyk7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS5saWdodFR5cGUgPSBsaWdodEluZm8ueDtcbiAgICBjbHVzdGVyTGlnaHREYXRhLnNoYXBlID0gbGlnaHRJbmZvLnk7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS5mYWxsb2ZmTW9kZSA9IGxpZ2h0SW5mby56O1xuICAgIGNsdXN0ZXJMaWdodERhdGEuc2hhZG93SW50ZW5zaXR5ID0gbGlnaHRJbmZvLnc7XG5cbiAgICAvLyBjb2xvclxuICAgIHZlYzQgY29sb3JBID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQ09MT1JfQSk7XG4gICAgdmVjNCBjb2xvckIgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9DT0xPUl9CKTtcbiAgICBjbHVzdGVyTGlnaHREYXRhLmNvbG9yID0gdmVjMyhieXRlczJmbG9hdDIoY29sb3JBLnh5KSwgYnl0ZXMyZmxvYXQyKGNvbG9yQS56dyksIGJ5dGVzMmZsb2F0Mihjb2xvckIueHkpKSAqIGNsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MC55O1xuXG4gICAgLy8gY29va2llXG4gICAgY2x1c3RlckxpZ2h0RGF0YS5jb29raWUgPSBjb2xvckIuejtcblxuICAgIC8vIGxpZ2h0IG1hc2tcbiAgICBjbHVzdGVyTGlnaHREYXRhLm1hc2sgPSBjb2xvckIudztcblxuICAgICNpZmRlZiBDTFVTVEVSX1RFWFRVUkVfRkxPQVRcblxuICAgICAgICB2ZWM0IGxpZ2h0UG9zUmFuZ2UgPSBzYW1wbGVMaWdodFRleHR1cmVGKGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV9GX1BPU0lUSU9OX1JBTkdFKTtcbiAgICAgICAgY2x1c3RlckxpZ2h0RGF0YS5wb3NpdGlvbiA9IGxpZ2h0UG9zUmFuZ2UueHl6O1xuICAgICAgICBjbHVzdGVyTGlnaHREYXRhLnJhbmdlID0gbGlnaHRQb3NSYW5nZS53O1xuXG4gICAgICAgIC8vIHNwb3QgbGlnaHQgZGlyZWN0aW9uXG4gICAgICAgIHZlYzQgbGlnaHREaXJfVW51c2VkID0gc2FtcGxlTGlnaHRUZXh0dXJlRihjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfRl9TUE9UX0RJUkVDVElPTik7XG4gICAgICAgIGNsdXN0ZXJMaWdodERhdGEuZGlyZWN0aW9uID0gbGlnaHREaXJfVW51c2VkLnh5ejtcblxuICAgICNlbHNlICAgLy8gOGJpdFxuXG4gICAgICAgIHZlYzQgZW5jUG9zWCA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BPU0lUSU9OX1gpO1xuICAgICAgICB2ZWM0IGVuY1Bvc1kgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QT1NJVElPTl9ZKTtcbiAgICAgICAgdmVjNCBlbmNQb3NaID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUE9TSVRJT05fWik7XG4gICAgICAgIGNsdXN0ZXJMaWdodERhdGEucG9zaXRpb24gPSB2ZWMzKGJ5dGVzMmZsb2F0NChlbmNQb3NYKSwgYnl0ZXMyZmxvYXQ0KGVuY1Bvc1kpLCBieXRlczJmbG9hdDQoZW5jUG9zWikpICogY2x1c3RlckJvdW5kc0RlbHRhICsgY2x1c3RlckJvdW5kc01pbjtcblxuICAgICAgICB2ZWM0IGVuY1JhbmdlID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUkFOR0UpO1xuICAgICAgICBjbHVzdGVyTGlnaHREYXRhLnJhbmdlID0gYnl0ZXMyZmxvYXQ0KGVuY1JhbmdlKSAqIGNsdXN0ZXJDb21wcmVzc2lvbkxpbWl0MC54O1xuXG4gICAgICAgIC8vIHNwb3QgbGlnaHQgZGlyZWN0aW9uXG4gICAgICAgIHZlYzQgZW5jRGlyWCA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1NQT1RfRElSRUNUSU9OX1gpO1xuICAgICAgICB2ZWM0IGVuY0RpclkgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9TUE9UX0RJUkVDVElPTl9ZKTtcbiAgICAgICAgdmVjNCBlbmNEaXJaID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfU1BPVF9ESVJFQ1RJT05fWik7XG4gICAgICAgIGNsdXN0ZXJMaWdodERhdGEuZGlyZWN0aW9uID0gdmVjMyhieXRlczJmbG9hdDQoZW5jRGlyWCksIGJ5dGVzMmZsb2F0NChlbmNEaXJZKSwgYnl0ZXMyZmxvYXQ0KGVuY0RpclopKSAqIDIuMCAtIDEuMDtcblxuICAgICNlbmRpZlxufVxuXG52b2lkIGRlY29kZUNsdXN0ZXJMaWdodFNwb3QoaW5vdXQgQ2x1c3RlckxpZ2h0RGF0YSBjbHVzdGVyTGlnaHREYXRhKSB7XG5cbiAgICAvLyBzcG90IGxpZ2h0IGNvcyBhbmdsZXNcbiAgICB2ZWM0IGNvbmVBbmdsZSA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1NQT1RfQU5HTEVTKTtcbiAgICBjbHVzdGVyTGlnaHREYXRhLmlubmVyQ29uZUFuZ2xlQ29zID0gYnl0ZXMyZmxvYXQyKGNvbmVBbmdsZS54eSkgKiAyLjAgLSAxLjA7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS5vdXRlckNvbmVBbmdsZUNvcyA9IGJ5dGVzMmZsb2F0Mihjb25lQW5nbGUuencpICogMi4wIC0gMS4wO1xufVxuXG52b2lkIGRlY29kZUNsdXN0ZXJMaWdodE9tbmlBdGxhc1ZpZXdwb3J0KGlub3V0IENsdXN0ZXJMaWdodERhdGEgY2x1c3RlckxpZ2h0RGF0YSkge1xuICAgICNpZmRlZiBDTFVTVEVSX1RFWFRVUkVfRkxPQVRcbiAgICAgICAgY2x1c3RlckxpZ2h0RGF0YS5vbW5pQXRsYXNWaWV3cG9ydCA9IHNhbXBsZUxpZ2h0VGV4dHVyZUYoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFX0ZfUFJPSl9NQVRfMCkueHl6O1xuICAgICNlbHNlXG4gICAgICAgIHZlYzQgdmlld3BvcnRBID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQVRMQVNfVklFV1BPUlRfQSk7XG4gICAgICAgIHZlYzQgdmlld3BvcnRCID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQVRMQVNfVklFV1BPUlRfQik7XG4gICAgICAgIGNsdXN0ZXJMaWdodERhdGEub21uaUF0bGFzVmlld3BvcnQgPSB2ZWMzKGJ5dGVzMmZsb2F0Mih2aWV3cG9ydEEueHkpLCBieXRlczJmbG9hdDIodmlld3BvcnRBLnp3KSwgYnl0ZXMyZmxvYXQyKHZpZXdwb3J0Qi54eSkpO1xuICAgICNlbmRpZlxufVxuXG52b2lkIGRlY29kZUNsdXN0ZXJMaWdodEFyZWFEYXRhKGlub3V0IENsdXN0ZXJMaWdodERhdGEgY2x1c3RlckxpZ2h0RGF0YSkge1xuICAgICNpZmRlZiBDTFVTVEVSX1RFWFRVUkVfRkxPQVRcbiAgICAgICAgY2x1c3RlckxpZ2h0RGF0YS5oYWxmV2lkdGggPSBzYW1wbGVMaWdodFRleHR1cmVGKGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV9GX0FSRUFfREFUQV9XSURUSCkueHl6O1xuICAgICAgICBjbHVzdGVyTGlnaHREYXRhLmhhbGZIZWlnaHQgPSBzYW1wbGVMaWdodFRleHR1cmVGKGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV9GX0FSRUFfREFUQV9IRUlHSFQpLnh5ejtcbiAgICAjZWxzZVxuICAgICAgICB2ZWM0IGFyZWFXaWR0aFggPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9BUkVBX0RBVEFfV0lEVEhfWCk7XG4gICAgICAgIHZlYzQgYXJlYVdpZHRoWSA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X0FSRUFfREFUQV9XSURUSF9ZKTtcbiAgICAgICAgdmVjNCBhcmVhV2lkdGhaID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQVJFQV9EQVRBX1dJRFRIX1opO1xuICAgICAgICBjbHVzdGVyTGlnaHREYXRhLmhhbGZXaWR0aCA9IHZlYzMobWFudGlzc2FFeHBvbmVudDJGbG9hdChhcmVhV2lkdGhYKSwgbWFudGlzc2FFeHBvbmVudDJGbG9hdChhcmVhV2lkdGhZKSwgbWFudGlzc2FFeHBvbmVudDJGbG9hdChhcmVhV2lkdGhaKSk7XG5cbiAgICAgICAgdmVjNCBhcmVhSGVpZ2h0WCA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X0FSRUFfREFUQV9IRUlHSFRfWCk7XG4gICAgICAgIHZlYzQgYXJlYUhlaWdodFkgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9BUkVBX0RBVEFfSEVJR0hUX1kpO1xuICAgICAgICB2ZWM0IGFyZWFIZWlnaHRaID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQVJFQV9EQVRBX0hFSUdIVF9aKTtcbiAgICAgICAgY2x1c3RlckxpZ2h0RGF0YS5oYWxmSGVpZ2h0ID0gdmVjMyhtYW50aXNzYUV4cG9uZW50MkZsb2F0KGFyZWFIZWlnaHRYKSwgbWFudGlzc2FFeHBvbmVudDJGbG9hdChhcmVhSGVpZ2h0WSksIG1hbnRpc3NhRXhwb25lbnQyRmxvYXQoYXJlYUhlaWdodFopKTtcbiAgICAjZW5kaWZcbn1cblxudm9pZCBkZWNvZGVDbHVzdGVyTGlnaHRQcm9qZWN0aW9uTWF0cml4RGF0YShpbm91dCBDbHVzdGVyTGlnaHREYXRhIGNsdXN0ZXJMaWdodERhdGEpIHtcbiAgICBcbiAgICAvLyBzaGFkb3cgbWF0cml4XG4gICAgI2lmZGVmIENMVVNURVJfVEVYVFVSRV9GTE9BVFxuICAgICAgICB2ZWM0IG0wID0gc2FtcGxlTGlnaHRUZXh0dXJlRihjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfRl9QUk9KX01BVF8wKTtcbiAgICAgICAgdmVjNCBtMSA9IHNhbXBsZUxpZ2h0VGV4dHVyZUYoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFX0ZfUFJPSl9NQVRfMSk7XG4gICAgICAgIHZlYzQgbTIgPSBzYW1wbGVMaWdodFRleHR1cmVGKGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV9GX1BST0pfTUFUXzIpO1xuICAgICAgICB2ZWM0IG0zID0gc2FtcGxlTGlnaHRUZXh0dXJlRihjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfRl9QUk9KX01BVF8zKTtcbiAgICAjZWxzZVxuICAgICAgICB2ZWM0IG0wMCA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzAwKTtcbiAgICAgICAgdmVjNCBtMDEgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8wMSk7XG4gICAgICAgIHZlYzQgbTAyID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMDIpO1xuICAgICAgICB2ZWM0IG0wMyA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzAzKTtcbiAgICAgICAgdmVjNCBtMCA9IGRlY29kZUNsdXN0ZXJMb3dSYW5nZTRWZWM0KG0wMCwgbTAxLCBtMDIsIG0wMyk7XG5cbiAgICAgICAgdmVjNCBtMTAgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8xMCk7XG4gICAgICAgIHZlYzQgbTExID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMTEpO1xuICAgICAgICB2ZWM0IG0xMiA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzEyKTtcbiAgICAgICAgdmVjNCBtMTMgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8xMyk7XG4gICAgICAgIHZlYzQgbTEgPSBkZWNvZGVDbHVzdGVyTG93UmFuZ2U0VmVjNChtMTAsIG0xMSwgbTEyLCBtMTMpO1xuXG4gICAgICAgIHZlYzQgbTIwID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMjApO1xuICAgICAgICB2ZWM0IG0yMSA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzIxKTtcbiAgICAgICAgdmVjNCBtMjIgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8yMik7XG4gICAgICAgIHZlYzQgbTIzID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMjMpO1xuICAgICAgICB2ZWM0IG0yID0gZGVjb2RlQ2x1c3Rlckxvd1JhbmdlNFZlYzQobTIwLCBtMjEsIG0yMiwgbTIzKTtcblxuICAgICAgICB2ZWM0IG0zMCA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzMwKTtcbiAgICAgICAgdmVjNCBtMzEgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9QUk9KX01BVF8zMSk7XG4gICAgICAgIHZlYzQgbTMyID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfUFJPSl9NQVRfMzIpO1xuICAgICAgICB2ZWM0IG0zMyA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1BST0pfTUFUXzMzKTtcbiAgICAgICAgdmVjNCBtMyA9IHZlYzQobWFudGlzc2FFeHBvbmVudDJGbG9hdChtMzApLCBtYW50aXNzYUV4cG9uZW50MkZsb2F0KG0zMSksIG1hbnRpc3NhRXhwb25lbnQyRmxvYXQobTMyKSwgbWFudGlzc2FFeHBvbmVudDJGbG9hdChtMzMpKTtcbiAgICAjZW5kaWZcbiAgICBcbiAgICBsaWdodFByb2plY3Rpb25NYXRyaXggPSBtYXQ0KG0wLCBtMSwgbTIsIG0zKTtcbn1cblxudm9pZCBkZWNvZGVDbHVzdGVyTGlnaHRTaGFkb3dEYXRhKGlub3V0IENsdXN0ZXJMaWdodERhdGEgY2x1c3RlckxpZ2h0RGF0YSkge1xuICAgIFxuICAgIC8vIHNoYWRvdyBiaWFzZXNcbiAgICB2ZWM0IGJpYXNlcyA9IHNhbXBsZUxpZ2h0c1RleHR1cmU4KGNsdXN0ZXJMaWdodERhdGEsIENMVVNURVJfVEVYVFVSRV84X1NIQURPV19CSUFTKTtcbiAgICBjbHVzdGVyTGlnaHREYXRhLnNoYWRvd0JpYXMgPSBieXRlczJmbG9hdFJhbmdlMihiaWFzZXMueHksIC0xLjAsIDIwLjApLFxuICAgIGNsdXN0ZXJMaWdodERhdGEuc2hhZG93Tm9ybWFsQmlhcyA9IGJ5dGVzMmZsb2F0MihiaWFzZXMuencpO1xufVxuXG52b2lkIGRlY29kZUNsdXN0ZXJMaWdodENvb2tpZURhdGEoaW5vdXQgQ2x1c3RlckxpZ2h0RGF0YSBjbHVzdGVyTGlnaHREYXRhKSB7XG5cbiAgICB2ZWM0IGNvb2tpZUEgPSBzYW1wbGVMaWdodHNUZXh0dXJlOChjbHVzdGVyTGlnaHREYXRhLCBDTFVTVEVSX1RFWFRVUkVfOF9DT09LSUVfQSk7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS5jb29raWVJbnRlbnNpdHkgPSBjb29raWVBLng7XG4gICAgY2x1c3RlckxpZ2h0RGF0YS5jb29raWVSZ2IgPSBjb29raWVBLnk7XG5cbiAgICBjbHVzdGVyTGlnaHREYXRhLmNvb2tpZUNoYW5uZWxNYXNrID0gc2FtcGxlTGlnaHRzVGV4dHVyZTgoY2x1c3RlckxpZ2h0RGF0YSwgQ0xVU1RFUl9URVhUVVJFXzhfQ09PS0lFX0IpO1xufVxuXG52b2lkIGV2YWx1YXRlTGlnaHQoXG4gICAgQ2x1c3RlckxpZ2h0RGF0YSBsaWdodCwgXG4gICAgdmVjMyB3b3JsZE5vcm1hbCwgXG4gICAgdmVjMyB2aWV3RGlyLCBcbiAgICB2ZWMzIHJlZmxlY3Rpb25EaXIsXG4jaWYgZGVmaW5lZChMSVRfQ0xFQVJDT0FUKVxuICAgIHZlYzMgY2xlYXJjb2F0UmVmbGVjdGlvbkRpcixcbiNlbmRpZlxuICAgIGZsb2F0IGdsb3NzLCBcbiAgICB2ZWMzIHNwZWN1bGFyaXR5LCBcbiAgICB2ZWMzIGdlb21ldHJpY05vcm1hbCwgXG4gICAgbWF0MyB0Ym4sIFxuI2lmIGRlZmluZWQoTElUX0lSSURFU0NFTkNFKVxuICAgIHZlYzMgaXJpZGVzY2VuY2VGcmVzbmVsLFxuI2VuZGlmXG4gICAgQ2xlYXJjb2F0QXJncyBjbGVhcmNvYXQsIFxuICAgIFNoZWVuQXJncyBzaGVlbiwgXG4gICAgSXJpZGVzY2VuY2VBcmdzIGlyaWRlc2NlbmNlXG4pIHtcblxuICAgIHZlYzMgY29va2llQXR0ZW51YXRpb24gPSB2ZWMzKDEuMCk7XG4gICAgZmxvYXQgZGlmZnVzZUF0dGVudWF0aW9uID0gMS4wO1xuICAgIGZsb2F0IGZhbGxvZmZBdHRlbnVhdGlvbiA9IDEuMDtcblxuICAgIC8vIGV2YWx1YXRlIG9tbmkgcGFydCBvZiB0aGUgbGlnaHRcbiAgICBnZXRMaWdodERpclBvaW50KGxpZ2h0LnBvc2l0aW9uKTtcblxuICAgICNpZmRlZiBDTFVTVEVSX0FSRUFMSUdIVFNcblxuICAgIC8vIGRpc3RhbmNlIGF0dGVudWF0aW9uXG4gICAgaWYgKGlzQ2x1c3RlcmVkTGlnaHRBcmVhKGxpZ2h0KSkgeyAvLyBhcmVhIGxpZ2h0XG5cbiAgICAgICAgLy8gYXJlYSBsaWdodHNcbiAgICAgICAgZGVjb2RlQ2x1c3RlckxpZ2h0QXJlYURhdGEobGlnaHQpO1xuXG4gICAgICAgIC8vIGhhbmRsZSBsaWdodCBzaGFwZVxuICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodFJlY3QobGlnaHQpKSB7XG4gICAgICAgICAgICBjYWxjUmVjdExpZ2h0VmFsdWVzKGxpZ2h0LnBvc2l0aW9uLCBsaWdodC5oYWxmV2lkdGgsIGxpZ2h0LmhhbGZIZWlnaHQpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzQ2x1c3RlcmVkTGlnaHREaXNrKGxpZ2h0KSkge1xuICAgICAgICAgICAgY2FsY0Rpc2tMaWdodFZhbHVlcyhsaWdodC5wb3NpdGlvbiwgbGlnaHQuaGFsZldpZHRoLCBsaWdodC5oYWxmSGVpZ2h0KTtcbiAgICAgICAgfSBlbHNlIHsgLy8gc3BoZXJlXG4gICAgICAgICAgICBjYWxjU3BoZXJlTGlnaHRWYWx1ZXMobGlnaHQucG9zaXRpb24sIGxpZ2h0LmhhbGZXaWR0aCwgbGlnaHQuaGFsZkhlaWdodCk7XG4gICAgICAgIH1cblxuICAgICAgICBmYWxsb2ZmQXR0ZW51YXRpb24gPSBnZXRGYWxsb2ZmV2luZG93KGxpZ2h0LnJhbmdlLCBkTGlnaHREaXJXKTtcblxuICAgIH0gZWxzZVxuXG4gICAgI2VuZGlmXG5cbiAgICB7ICAgLy8gcHVuY3R1YWwgbGlnaHRcblxuICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodEZhbGxvZmZMaW5lYXIobGlnaHQpKVxuICAgICAgICAgICAgZmFsbG9mZkF0dGVudWF0aW9uID0gZ2V0RmFsbG9mZkxpbmVhcihsaWdodC5yYW5nZSwgZExpZ2h0RGlyVyk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIGZhbGxvZmZBdHRlbnVhdGlvbiA9IGdldEZhbGxvZmZJbnZTcXVhcmVkKGxpZ2h0LnJhbmdlLCBkTGlnaHREaXJXKTtcbiAgICB9XG5cbiAgICBpZiAoZmFsbG9mZkF0dGVudWF0aW9uID4gMC4wMDAwMSkge1xuXG4gICAgICAgICNpZmRlZiBDTFVTVEVSX0FSRUFMSUdIVFNcblxuICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodEFyZWEobGlnaHQpKSB7IC8vIGFyZWEgbGlnaHRcblxuICAgICAgICAgICAgLy8gaGFuZGxlIGxpZ2h0IHNoYXBlXG4gICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodFJlY3QobGlnaHQpKSB7XG4gICAgICAgICAgICAgICAgZGlmZnVzZUF0dGVudWF0aW9uID0gZ2V0UmVjdExpZ2h0RGlmZnVzZSh3b3JsZE5vcm1hbCwgdmlld0RpciwgZExpZ2h0RGlyVywgZExpZ2h0RGlyTm9ybVcpICogMTYuMDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNDbHVzdGVyZWRMaWdodERpc2sobGlnaHQpKSB7XG4gICAgICAgICAgICAgICAgZGlmZnVzZUF0dGVudWF0aW9uID0gZ2V0RGlza0xpZ2h0RGlmZnVzZSh3b3JsZE5vcm1hbCwgdmlld0RpciwgZExpZ2h0RGlyVywgZExpZ2h0RGlyTm9ybVcpICogMTYuMDtcbiAgICAgICAgICAgIH0gZWxzZSB7IC8vIHNwaGVyZVxuICAgICAgICAgICAgICAgIGRpZmZ1c2VBdHRlbnVhdGlvbiA9IGdldFNwaGVyZUxpZ2h0RGlmZnVzZSh3b3JsZE5vcm1hbCwgdmlld0RpciwgZExpZ2h0RGlyVywgZExpZ2h0RGlyTm9ybVcpICogMTYuMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2VcblxuICAgICAgICAjZW5kaWZcblxuICAgICAgICB7XG4gICAgICAgICAgICBmYWxsb2ZmQXR0ZW51YXRpb24gKj0gZ2V0TGlnaHREaWZmdXNlKHdvcmxkTm9ybWFsLCB2aWV3RGlyLCBkTGlnaHREaXJXLCBkTGlnaHREaXJOb3JtVyk7IFxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3BvdCBsaWdodCBmYWxsb2ZmXG4gICAgICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0U3BvdChsaWdodCkpIHtcbiAgICAgICAgICAgIGRlY29kZUNsdXN0ZXJMaWdodFNwb3QobGlnaHQpO1xuICAgICAgICAgICAgZmFsbG9mZkF0dGVudWF0aW9uICo9IGdldFNwb3RFZmZlY3QobGlnaHQuZGlyZWN0aW9uLCBsaWdodC5pbm5lckNvbmVBbmdsZUNvcywgbGlnaHQub3V0ZXJDb25lQW5nbGVDb3MsIGRMaWdodERpck5vcm1XKTtcbiAgICAgICAgfVxuXG4gICAgICAgICNpZiBkZWZpbmVkKENMVVNURVJfQ09PS0lFU19PUl9TSEFET1dTKVxuXG4gICAgICAgIGlmIChmYWxsb2ZmQXR0ZW51YXRpb24gPiAwLjAwMDAxKSB7XG5cbiAgICAgICAgICAgIC8vIHNoYWRvdyAvIGNvb2tpZVxuICAgICAgICAgICAgaWYgKGlzQ2x1c3RlcmVkTGlnaHRDYXN0U2hhZG93KGxpZ2h0KSB8fCBpc0NsdXN0ZXJlZExpZ2h0Q29va2llKGxpZ2h0KSkge1xuXG4gICAgICAgICAgICAgICAgLy8gc2hhcmVkIHNoYWRvdyAvIGNvb2tpZSBkYXRhIGRlcGVuZHMgb24gbGlnaHQgdHlwZVxuICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0U3BvdChsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjb2RlQ2x1c3RlckxpZ2h0UHJvamVjdGlvbk1hdHJpeERhdGEobGlnaHQpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY29kZUNsdXN0ZXJMaWdodE9tbmlBdGxhc1ZpZXdwb3J0KGxpZ2h0KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBmbG9hdCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiA9IHNoYWRvd0F0bGFzUGFyYW1zLng7XG4gICAgICAgICAgICAgICAgZmxvYXQgc2hhZG93RWRnZVBpeGVscyA9IHNoYWRvd0F0bGFzUGFyYW1zLnk7XG5cbiAgICAgICAgICAgICAgICAjaWZkZWYgQ0xVU1RFUl9DT09LSUVTXG5cbiAgICAgICAgICAgICAgICAvLyBjb29raWVcbiAgICAgICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodENvb2tpZShsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVjb2RlQ2x1c3RlckxpZ2h0Q29va2llRGF0YShsaWdodCk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzQ2x1c3RlcmVkTGlnaHRTcG90KGxpZ2h0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29va2llQXR0ZW51YXRpb24gPSBnZXRDb29raWUyRENsdXN0ZXJlZChURVhUVVJFX1BBU1MoY29va2llQXRsYXNUZXh0dXJlKSwgbGlnaHRQcm9qZWN0aW9uTWF0cml4LCB2UG9zaXRpb25XLCBsaWdodC5jb29raWVJbnRlbnNpdHksIGlzQ2x1c3RlcmVkTGlnaHRDb29raWVSZ2IobGlnaHQpLCBsaWdodC5jb29raWVDaGFubmVsTWFzayk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb29raWVBdHRlbnVhdGlvbiA9IGdldENvb2tpZUN1YmVDbHVzdGVyZWQoVEVYVFVSRV9QQVNTKGNvb2tpZUF0bGFzVGV4dHVyZSksIGRMaWdodERpclcsIGxpZ2h0LmNvb2tpZUludGVuc2l0eSwgaXNDbHVzdGVyZWRMaWdodENvb2tpZVJnYihsaWdodCksIGxpZ2h0LmNvb2tpZUNoYW5uZWxNYXNrLCBzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgc2hhZG93RWRnZVBpeGVscywgbGlnaHQub21uaUF0bGFzVmlld3BvcnQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAjaWZkZWYgQ0xVU1RFUl9TSEFET1dTXG5cbiAgICAgICAgICAgICAgICAvLyBzaGFkb3dcbiAgICAgICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodENhc3RTaGFkb3cobGlnaHQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGRlY29kZUNsdXN0ZXJMaWdodFNoYWRvd0RhdGEobGlnaHQpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZlYzQgc2hhZG93UGFyYW1zID0gdmVjNChzaGFkb3dUZXh0dXJlUmVzb2x1dGlvbiwgbGlnaHQuc2hhZG93Tm9ybWFsQmlhcywgbGlnaHQuc2hhZG93QmlhcywgMS4wIC8gbGlnaHQucmFuZ2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0U3BvdChsaWdodCkpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gc3BvdCBzaGFkb3dcbiAgICAgICAgICAgICAgICAgICAgICAgIGdldFNoYWRvd0Nvb3JkUGVyc3BaYnVmZmVyTm9ybWFsT2Zmc2V0KGxpZ2h0UHJvamVjdGlvbk1hdHJpeCwgc2hhZG93UGFyYW1zLCBnZW9tZXRyaWNOb3JtYWwpO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAjaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjEpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQgc2hhZG93ID0gZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjEoU0hBRE9XTUFQX1BBU1Moc2hhZG93QXRsYXNUZXh0dXJlKSwgZFNoYWRvd0Nvb3JkLCBzaGFkb3dQYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgI2VsaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQgc2hhZG93ID0gZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjMoU0hBRE9XTUFQX1BBU1Moc2hhZG93QXRsYXNUZXh0dXJlKSwgZFNoYWRvd0Nvb3JkLCBzaGFkb3dQYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgI2VsaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQgc2hhZG93ID0gZ2V0U2hhZG93U3BvdENsdXN0ZXJlZFBDRjUoU0hBRE9XTUFQX1BBU1Moc2hhZG93QXRsYXNUZXh0dXJlKSwgZFNoYWRvd0Nvb3JkLCBzaGFkb3dQYXJhbXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgI2VuZGlmXG4gICAgICAgICAgICAgICAgICAgICAgICBmYWxsb2ZmQXR0ZW51YXRpb24gKj0gbWl4KDEuMCwgc2hhZG93LCBsaWdodC5zaGFkb3dJbnRlbnNpdHkpO1xuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG9tbmkgc2hhZG93XG4gICAgICAgICAgICAgICAgICAgICAgICBub3JtYWxPZmZzZXRQb2ludFNoYWRvdyhzaGFkb3dQYXJhbXMsIGRMaWdodFBvc1csIGRMaWdodERpclcsIGRMaWdodERpck5vcm1XLCBnZW9tZXRyaWNOb3JtYWwpOyAgLy8gbm9ybWFsQmlhcyBhZGp1c3RlZCBmb3IgZGlzdGFuY2VcblxuICAgICAgICAgICAgICAgICAgICAgICAgI2lmIGRlZmluZWQoQ0xVU1RFUl9TSEFET1dfVFlQRV9QQ0YxKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZsb2F0IHNoYWRvdyA9IGdldFNoYWRvd09tbmlDbHVzdGVyZWRQQ0YxKFNIQURPV01BUF9QQVNTKHNoYWRvd0F0bGFzVGV4dHVyZSksIHNoYWRvd1BhcmFtcywgbGlnaHQub21uaUF0bGFzVmlld3BvcnQsIHNoYWRvd0VkZ2VQaXhlbHMsIGRMaWdodERpclcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgI2VsaWYgZGVmaW5lZChDTFVTVEVSX1NIQURPV19UWVBFX1BDRjMpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmxvYXQgc2hhZG93ID0gZ2V0U2hhZG93T21uaUNsdXN0ZXJlZFBDRjMoU0hBRE9XTUFQX1BBU1Moc2hhZG93QXRsYXNUZXh0dXJlKSwgc2hhZG93UGFyYW1zLCBsaWdodC5vbW5pQXRsYXNWaWV3cG9ydCwgc2hhZG93RWRnZVBpeGVscywgZExpZ2h0RGlyVyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAjZWxpZiBkZWZpbmVkKENMVVNURVJfU0hBRE9XX1RZUEVfUENGNSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmbG9hdCBzaGFkb3cgPSBnZXRTaGFkb3dPbW5pQ2x1c3RlcmVkUENGNShTSEFET1dNQVBfUEFTUyhzaGFkb3dBdGxhc1RleHR1cmUpLCBzaGFkb3dQYXJhbXMsIGxpZ2h0Lm9tbmlBdGxhc1ZpZXdwb3J0LCBzaGFkb3dFZGdlUGl4ZWxzLCBkTGlnaHREaXJXKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICNlbmRpZlxuICAgICAgICAgICAgICAgICAgICAgICAgZmFsbG9mZkF0dGVudWF0aW9uICo9IG1peCgxLjAsIHNoYWRvdywgbGlnaHQuc2hhZG93SW50ZW5zaXR5KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICNlbmRpZlxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgLy8gZGlmZnVzZSAvIHNwZWN1bGFyIC8gY2xlYXJjb2F0XG4gICAgICAgICNpZmRlZiBDTFVTVEVSX0FSRUFMSUdIVFNcblxuICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodEFyZWEobGlnaHQpKSB7IC8vIGFyZWEgbGlnaHRcblxuICAgICAgICAgICAgLy8gYXJlYSBsaWdodCBkaWZmdXNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdmVjMyBhcmVhRGlmZnVzZSA9IChkaWZmdXNlQXR0ZW51YXRpb24gKiBmYWxsb2ZmQXR0ZW51YXRpb24pICogbGlnaHQuY29sb3IgKiBjb29raWVBdHRlbnVhdGlvbjtcblxuICAgICAgICAgICAgICAgICNpZiBkZWZpbmVkKExJVF9TUEVDVUxBUilcbiAgICAgICAgICAgICAgICAgICAgI2lmIGRlZmluZWQoTElUX0NPTlNFUlZFX0VORVJHWSlcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWFEaWZmdXNlID0gbWl4KGFyZWFEaWZmdXNlLCB2ZWMzKDApLCBkTFRDU3BlY0ZyZXMpO1xuICAgICAgICAgICAgICAgICAgICAjZW5kaWZcbiAgICAgICAgICAgICAgICAjZW5kaWZcblxuICAgICAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgZGlmZnVzZSAtIGl0IGRvZXMgbm90IG1peCBkaWZmdXNlIGxpZ2h0aW5nIGludG8gc3BlY3VsYXIgYXR0ZW51YXRpb25cbiAgICAgICAgICAgICAgICBkRGlmZnVzZUxpZ2h0ICs9IGFyZWFEaWZmdXNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzcGVjdWxhciBhbmQgY2xlYXIgY29hdCBhcmUgbWF0ZXJpYWwgc2V0dGluZ3MgYW5kIGdldCBpbmNsdWRlZCBieSBhIGRlZmluZSBiYXNlZCBvbiB0aGUgbWF0ZXJpYWxcbiAgICAgICAgICAgICNpZmRlZiBMSVRfU1BFQ1VMQVJcblxuICAgICAgICAgICAgICAgIC8vIGFyZWEgbGlnaHQgc3BlY3VsYXJcbiAgICAgICAgICAgICAgICBmbG9hdCBhcmVhTGlnaHRTcGVjdWxhcjtcblxuICAgICAgICAgICAgICAgIGlmIChpc0NsdXN0ZXJlZExpZ2h0UmVjdChsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJlYUxpZ2h0U3BlY3VsYXIgPSBnZXRSZWN0TGlnaHRTcGVjdWxhcih3b3JsZE5vcm1hbCwgdmlld0Rpcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc0NsdXN0ZXJlZExpZ2h0RGlzayhsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJlYUxpZ2h0U3BlY3VsYXIgPSBnZXREaXNrTGlnaHRTcGVjdWxhcih3b3JsZE5vcm1hbCwgdmlld0Rpcik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy8gc3BoZXJlXG4gICAgICAgICAgICAgICAgICAgIGFyZWFMaWdodFNwZWN1bGFyID0gZ2V0U3BoZXJlTGlnaHRTcGVjdWxhcih3b3JsZE5vcm1hbCwgdmlld0Rpcik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZFNwZWN1bGFyTGlnaHQgKz0gZExUQ1NwZWNGcmVzICogYXJlYUxpZ2h0U3BlY3VsYXIgKiBmYWxsb2ZmQXR0ZW51YXRpb24gKiBsaWdodC5jb2xvciAqIGNvb2tpZUF0dGVudWF0aW9uO1xuXG4gICAgICAgICAgICAgICAgI2lmZGVmIExJVF9DTEVBUkNPQVRcblxuICAgICAgICAgICAgICAgICAgICAvLyBhcmVhIGxpZ2h0IHNwZWN1bGFyIGNsZWFyIGNvYXRcbiAgICAgICAgICAgICAgICAgICAgZmxvYXQgYXJlYUxpZ2h0U3BlY3VsYXJDQztcblxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNDbHVzdGVyZWRMaWdodFJlY3QobGlnaHQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhcmVhTGlnaHRTcGVjdWxhckNDID0gZ2V0UmVjdExpZ2h0U3BlY3VsYXIoY2xlYXJjb2F0LndvcmxkTm9ybWFsLCB2aWV3RGlyKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc0NsdXN0ZXJlZExpZ2h0RGlzayhsaWdodCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWFMaWdodFNwZWN1bGFyQ0MgPSBnZXREaXNrTGlnaHRTcGVjdWxhcihjbGVhcmNvYXQud29ybGROb3JtYWwsIHZpZXdEaXIpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyBzcGhlcmVcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZWFMaWdodFNwZWN1bGFyQ0MgPSBnZXRTcGhlcmVMaWdodFNwZWN1bGFyKGNsZWFyY29hdC53b3JsZE5vcm1hbCwgdmlld0Rpcik7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjY1NwZWN1bGFyTGlnaHQgKz0gY2NMVENTcGVjRnJlcyAqIGFyZWFMaWdodFNwZWN1bGFyQ0MgKiBmYWxsb2ZmQXR0ZW51YXRpb24gKiBsaWdodC5jb2xvciAgKiBjb29raWVBdHRlbnVhdGlvbjtcblxuICAgICAgICAgICAgICAgICNlbmRpZlxuXG4gICAgICAgICAgICAjZW5kaWZcblxuICAgICAgICB9IGVsc2VcblxuICAgICAgICAjZW5kaWZcblxuICAgICAgICB7ICAgIC8vIHB1bmN0dWFsIGxpZ2h0XG5cbiAgICAgICAgICAgIC8vIHB1bmN0dWFsIGxpZ2h0IGRpZmZ1c2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2ZWMzIHB1bmN0dWFsRGlmZnVzZSA9IGZhbGxvZmZBdHRlbnVhdGlvbiAqIGxpZ2h0LmNvbG9yICogY29va2llQXR0ZW51YXRpb247XG5cbiAgICAgICAgICAgICAgICAjaWYgZGVmaW5lZChDTFVTVEVSX0FSRUFMSUdIVFMpXG4gICAgICAgICAgICAgICAgI2lmIGRlZmluZWQoTElUX1NQRUNVTEFSKVxuICAgICAgICAgICAgICAgICNpZiBkZWZpbmVkKExJVF9DT05TRVJWRV9FTkVSR1kpXG4gICAgICAgICAgICAgICAgICAgIHB1bmN0dWFsRGlmZnVzZSA9IG1peChwdW5jdHVhbERpZmZ1c2UsIHZlYzMoMCksIHNwZWN1bGFyaXR5KTtcbiAgICAgICAgICAgICAgICAjZW5kaWZcbiAgICAgICAgICAgICAgICAjZW5kaWZcbiAgICAgICAgICAgICAgICAjZW5kaWZcblxuICAgICAgICAgICAgICAgIGREaWZmdXNlTGlnaHQgKz0gcHVuY3R1YWxEaWZmdXNlO1xuICAgICAgICAgICAgfVxuICAgXG4gICAgICAgICAgICAvLyBzcGVjdWxhciBhbmQgY2xlYXIgY29hdCBhcmUgbWF0ZXJpYWwgc2V0dGluZ3MgYW5kIGdldCBpbmNsdWRlZCBieSBhIGRlZmluZSBiYXNlZCBvbiB0aGUgbWF0ZXJpYWxcbiAgICAgICAgICAgICNpZmRlZiBMSVRfU1BFQ1VMQVJcblxuICAgICAgICAgICAgICAgIHZlYzMgaGFsZkRpciA9IG5vcm1hbGl6ZSgtZExpZ2h0RGlyTm9ybVcgKyB2aWV3RGlyKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBzcGVjdWxhclxuICAgICAgICAgICAgICAgICNpZmRlZiBMSVRfU1BFQ1VMQVJfRlJFU05FTFxuICAgICAgICAgICAgICAgICAgICBkU3BlY3VsYXJMaWdodCArPSBcbiAgICAgICAgICAgICAgICAgICAgICAgIGdldExpZ2h0U3BlY3VsYXIoaGFsZkRpciwgcmVmbGVjdGlvbkRpciwgd29ybGROb3JtYWwsIHZpZXdEaXIsIGRMaWdodERpck5vcm1XLCBnbG9zcywgdGJuKSAqIGZhbGxvZmZBdHRlbnVhdGlvbiAqIGxpZ2h0LmNvbG9yICogY29va2llQXR0ZW51YXRpb24gKiBcbiAgICAgICAgICAgICAgICAgICAgICAgIGdldEZyZXNuZWwoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZG90KHZpZXdEaXIsIGhhbGZEaXIpLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBnbG9zcywgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3BlY3VsYXJpdHlcbiAgICAgICAgICAgICAgICAgICAgICAgICNpZiBkZWZpbmVkKExJVF9JUklERVNDRU5DRSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAsIGlyaWRlc2NlbmNlRnJlc25lbCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpcmlkZXNjZW5jZVxuICAgICAgICAgICAgICAgICAgICAgICAgI2VuZGlmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAjZWxzZVxuICAgICAgICAgICAgICAgICAgICBkU3BlY3VsYXJMaWdodCArPSBnZXRMaWdodFNwZWN1bGFyKGhhbGZEaXIsIHJlZmxlY3Rpb25EaXIsIHdvcmxkTm9ybWFsLCB2aWV3RGlyLCBkTGlnaHREaXJOb3JtVywgZ2xvc3MsIHRibikgKiBmYWxsb2ZmQXR0ZW51YXRpb24gKiBsaWdodC5jb2xvciAqIGNvb2tpZUF0dGVudWF0aW9uICogc3BlY3VsYXJpdHk7XG4gICAgICAgICAgICAgICAgI2VuZGlmXG5cbiAgICAgICAgICAgICAgICAjaWZkZWYgTElUX0NMRUFSQ09BVFxuICAgICAgICAgICAgICAgICAgICAjaWZkZWYgTElUX1NQRUNVTEFSX0ZSRVNORUxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNjU3BlY3VsYXJMaWdodCArPSBnZXRMaWdodFNwZWN1bGFyKGhhbGZEaXIsIGNsZWFyY29hdFJlZmxlY3Rpb25EaXIsIGNsZWFyY29hdC53b3JsZE5vcm1hbCwgdmlld0RpciwgZExpZ2h0RGlyTm9ybVcsIGNsZWFyY29hdC5nbG9zcywgdGJuKSAqIGZhbGxvZmZBdHRlbnVhdGlvbiAqIGxpZ2h0LmNvbG9yICogY29va2llQXR0ZW51YXRpb24gKiBnZXRGcmVzbmVsQ0MoZG90KHZpZXdEaXIsIGhhbGZEaXIpKTtcbiAgICAgICAgICAgICAgICAgICAgI2Vsc2VcbiAgICAgICAgICAgICAgICAgICAgICAgIGNjU3BlY3VsYXJMaWdodCArPSBnZXRMaWdodFNwZWN1bGFyKGhhbGZEaXIsIGNsZWFyY29hdFJlZmxlY3Rpb25EaXIsIGNsZWFyY29hdC53b3JsZE5vcm1hbCwgdmlld0RpciwgZExpZ2h0RGlyTm9ybVcsIGNsZWFyY29hdC5nbG9zcywgdGJuKSAqIGZhbGxvZmZBdHRlbnVhdGlvbiAqIGxpZ2h0LmNvbG9yICogY29va2llQXR0ZW51YXRpb247IFxuICAgICAgICAgICAgICAgICAgICAjZW5kaWZcbiAgICAgICAgICAgICAgICAjZW5kaWZcblxuICAgICAgICAgICAgICAgICNpZmRlZiBMSVRfU0hFRU5cbiAgICAgICAgICAgICAgICAgICAgc1NwZWN1bGFyTGlnaHQgKz0gZ2V0TGlnaHRTcGVjdWxhclNoZWVuKGhhbGZEaXIsIHdvcmxkTm9ybWFsLCB2aWV3RGlyLCBkTGlnaHREaXJOb3JtVywgc2hlZW4uZ2xvc3MpICogZmFsbG9mZkF0dGVudWF0aW9uICogbGlnaHQuY29sb3IgKiBjb29raWVBdHRlbnVhdGlvbjtcbiAgICAgICAgICAgICAgICAjZW5kaWZcblxuICAgICAgICAgICAgI2VuZGlmXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXcml0ZSB0byBnbG9iYWwgYXR0ZW51YXRpb24gdmFsdWVzIChmb3IgbGlnaHRtYXBwZXIpXG4gICAgZEF0dGVuID0gZmFsbG9mZkF0dGVudWF0aW9uO1xuICAgIGRBdHRlbkQgPSBkaWZmdXNlQXR0ZW51YXRpb247XG4gICAgZEF0dGVuMyA9IGNvb2tpZUF0dGVudWF0aW9uO1xufVxuXG52b2lkIGV2YWx1YXRlQ2x1c3RlckxpZ2h0KFxuICAgIGZsb2F0IGxpZ2h0SW5kZXgsIFxuICAgIHZlYzMgd29ybGROb3JtYWwsIFxuICAgIHZlYzMgdmlld0RpciwgXG4gICAgdmVjMyByZWZsZWN0aW9uRGlyLCBcbiNpZiBkZWZpbmVkKExJVF9DTEVBUkNPQVQpXG4gICAgdmVjMyBjbGVhcmNvYXRSZWZsZWN0aW9uRGlyLFxuI2VuZGlmXG4gICAgZmxvYXQgZ2xvc3MsIFxuICAgIHZlYzMgc3BlY3VsYXJpdHksIFxuICAgIHZlYzMgZ2VvbWV0cmljTm9ybWFsLCBcbiAgICBtYXQzIHRibiwgXG4jaWYgZGVmaW5lZChMSVRfSVJJREVTQ0VOQ0UpXG4gICAgdmVjMyBpcmlkZXNjZW5jZUZyZXNuZWwsXG4jZW5kaWZcbiAgICBDbGVhcmNvYXRBcmdzIGNsZWFyY29hdCwgXG4gICAgU2hlZW5BcmdzIHNoZWVuLCBcbiAgICBJcmlkZXNjZW5jZUFyZ3MgaXJpZGVzY2VuY2Vcbikge1xuXG4gICAgLy8gZGVjb2RlIGNvcmUgbGlnaHQgZGF0YSBmcm9tIHRleHR1cmVzXG4gICAgQ2x1c3RlckxpZ2h0RGF0YSBjbHVzdGVyTGlnaHREYXRhO1xuICAgIGRlY29kZUNsdXN0ZXJMaWdodENvcmUoY2x1c3RlckxpZ2h0RGF0YSwgbGlnaHRJbmRleCk7XG5cbiAgICAvLyBldmFsdWF0ZSBsaWdodCBpZiBpdCB1c2VzIGFjY2VwdGVkIGxpZ2h0IG1hc2tcbiAgICBpZiAoYWNjZXB0TGlnaHRNYXNrKGNsdXN0ZXJMaWdodERhdGEpKVxuICAgICAgICBldmFsdWF0ZUxpZ2h0KFxuICAgICAgICAgICAgY2x1c3RlckxpZ2h0RGF0YSwgXG4gICAgICAgICAgICB3b3JsZE5vcm1hbCwgXG4gICAgICAgICAgICB2aWV3RGlyLCBcbiAgICAgICAgICAgIHJlZmxlY3Rpb25EaXIsIFxuI2lmIGRlZmluZWQoTElUX0NMRUFSQ09BVClcbiAgICAgICAgICAgIGNsZWFyY29hdFJlZmxlY3Rpb25EaXIsIFxuI2VuZGlmXG4gICAgICAgICAgICBnbG9zcywgXG4gICAgICAgICAgICBzcGVjdWxhcml0eSwgXG4gICAgICAgICAgICBnZW9tZXRyaWNOb3JtYWwsIFxuICAgICAgICAgICAgdGJuLCBcbiNpZiBkZWZpbmVkKExJVF9JUklERVNDRU5DRSlcbiAgICAgICAgICAgIGlyaWRlc2NlbmNlRnJlc25lbCxcbiNlbmRpZlxuICAgICAgICAgICAgY2xlYXJjb2F0LCBcbiAgICAgICAgICAgIHNoZWVuLCBcbiAgICAgICAgICAgIGlyaWRlc2NlbmNlXG4gICAgICAgICk7XG59XG5cbnZvaWQgYWRkQ2x1c3RlcmVkTGlnaHRzKFxuICAgIHZlYzMgd29ybGROb3JtYWwsIFxuICAgIHZlYzMgdmlld0RpciwgXG4gICAgdmVjMyByZWZsZWN0aW9uRGlyLCBcbiNpZiBkZWZpbmVkKExJVF9DTEVBUkNPQVQpXG4gICAgdmVjMyBjbGVhcmNvYXRSZWZsZWN0aW9uRGlyLFxuI2VuZGlmXG4gICAgZmxvYXQgZ2xvc3MsIFxuICAgIHZlYzMgc3BlY3VsYXJpdHksIFxuICAgIHZlYzMgZ2VvbWV0cmljTm9ybWFsLCBcbiAgICBtYXQzIHRibiwgXG4jaWYgZGVmaW5lZChMSVRfSVJJREVTQ0VOQ0UpXG4gICAgdmVjMyBpcmlkZXNjZW5jZUZyZXNuZWwsXG4jZW5kaWZcbiAgICBDbGVhcmNvYXRBcmdzIGNsZWFyY29hdCwgXG4gICAgU2hlZW5BcmdzIHNoZWVuLCBcbiAgICBJcmlkZXNjZW5jZUFyZ3MgaXJpZGVzY2VuY2Vcbikge1xuXG4gICAgLy8gc2tpcCBsaWdodHMgaWYgbm8gbGlnaHRzIGF0IGFsbFxuICAgIGlmIChjbHVzdGVyU2tpcCA+IDAuNSlcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgLy8gd29ybGQgc3BhY2UgcG9zaXRpb24gdG8gM2QgaW50ZWdlciBjZWxsIGNvcmRpbmF0ZXMgaW4gdGhlIGNsdXN0ZXIgc3RydWN0dXJlXG4gICAgdmVjMyBjZWxsQ29vcmRzID0gZmxvb3IoKHZQb3NpdGlvblcgLSBjbHVzdGVyQm91bmRzTWluKSAqIGNsdXN0ZXJDZWxsc0NvdW50QnlCb3VuZHNTaXplKTtcblxuICAgIC8vIG5vIGxpZ2h0aW5nIHdoZW4gY2VsbCBjb29yZGluYXRlIGlzIG91dCBvZiByYW5nZVxuICAgIGlmICghKGFueShsZXNzVGhhbihjZWxsQ29vcmRzLCB2ZWMzKDAuMCkpKSB8fCBhbnkoZ3JlYXRlclRoYW5FcXVhbChjZWxsQ29vcmRzLCBjbHVzdGVyQ2VsbHNNYXgpKSkpIHtcblxuICAgICAgICAvLyBjZWxsIGluZGV4IChtYXBwaW5nIGZyb20gM2QgY2VsbCBjb29yZGluYXRlcyB0byBsaW5lYXIgbWVtb3J5KVxuICAgICAgICBmbG9hdCBjZWxsSW5kZXggPSBkb3QoY2x1c3RlckNlbGxzRG90LCBjZWxsQ29vcmRzKTtcblxuICAgICAgICAvLyBjb252ZXJ0IGNlbGwgaW5kZXggdG8gdXYgY29vcmRpbmF0ZXNcbiAgICAgICAgZmxvYXQgY2x1c3RlclYgPSBmbG9vcihjZWxsSW5kZXggKiBjbHVzdGVyVGV4dHVyZVNpemUueSk7XG4gICAgICAgIGZsb2F0IGNsdXN0ZXJVID0gY2VsbEluZGV4IC0gKGNsdXN0ZXJWICogY2x1c3RlclRleHR1cmVTaXplLngpO1xuXG4gICAgICAgICNpZmRlZiBHTDJcblxuICAgICAgICAgICAgLy8gbG9vcCBvdmVyIG1heGltdW0gbnVtYmVyIG9mIGxpZ2h0IGNlbGxzXG4gICAgICAgICAgICBmb3IgKGludCBsaWdodENlbGxJbmRleCA9IDA7IGxpZ2h0Q2VsbEluZGV4IDwgY2x1c3Rlck1heENlbGxzOyBsaWdodENlbGxJbmRleCsrKSB7XG5cbiAgICAgICAgICAgICAgICAvLyB1c2luZyBhIHNpbmdsZSBjaGFubmVsIHRleHR1cmUgd2l0aCBkYXRhIGluIGFscGhhIGNoYW5uZWxcbiAgICAgICAgICAgICAgICBmbG9hdCBsaWdodEluZGV4ID0gdGV4ZWxGZXRjaChjbHVzdGVyV29ybGRUZXh0dXJlLCBpdmVjMihpbnQoY2x1c3RlclUpICsgbGlnaHRDZWxsSW5kZXgsIGNsdXN0ZXJWKSwgMCkueDtcblxuICAgICAgICAgICAgICAgIGlmIChsaWdodEluZGV4IDw9IDAuMClcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIGV2YWx1YXRlQ2x1c3RlckxpZ2h0KFxuICAgICAgICAgICAgICAgICAgICBsaWdodEluZGV4ICogMjU1LjAsIFxuICAgICAgICAgICAgICAgICAgICB3b3JsZE5vcm1hbCwgXG4gICAgICAgICAgICAgICAgICAgIHZpZXdEaXIsIFxuICAgICAgICAgICAgICAgICAgICByZWZsZWN0aW9uRGlyLFxuI2lmIGRlZmluZWQoTElUX0NMRUFSQ09BVClcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJjb2F0UmVmbGVjdGlvbkRpcixcbiNlbmRpZlxuICAgICAgICAgICAgICAgICAgICBnbG9zcywgXG4gICAgICAgICAgICAgICAgICAgIHNwZWN1bGFyaXR5LCBcbiAgICAgICAgICAgICAgICAgICAgZ2VvbWV0cmljTm9ybWFsLCBcbiAgICAgICAgICAgICAgICAgICAgdGJuLCBcbiNpZiBkZWZpbmVkKExJVF9JUklERVNDRU5DRSlcbiAgICAgICAgICAgICAgICAgICAgaXJpZGVzY2VuY2VGcmVzbmVsLFxuI2VuZGlmXG4gICAgICAgICAgICAgICAgICAgIGNsZWFyY29hdCwgXG4gICAgICAgICAgICAgICAgICAgIHNoZWVuLCBcbiAgICAgICAgICAgICAgICAgICAgaXJpZGVzY2VuY2VcbiAgICAgICAgICAgICAgICApOyBcbiAgICAgICAgICAgIH1cblxuICAgICAgICAjZWxzZVxuXG4gICAgICAgICAgICBjbHVzdGVyViA9IChjbHVzdGVyViArIDAuNSkgKiBjbHVzdGVyVGV4dHVyZVNpemUuejtcblxuICAgICAgICAgICAgLy8gbG9vcCBvdmVyIG1heGltdW0gcG9zc2libGUgbnVtYmVyIG9mIHN1cHBvcnRlZCBsaWdodCBjZWxsc1xuICAgICAgICAgICAgY29uc3QgZmxvYXQgbWF4TGlnaHRDZWxscyA9IDI1Ni4wO1xuICAgICAgICAgICAgZm9yIChmbG9hdCBsaWdodENlbGxJbmRleCA9IDAuNTsgbGlnaHRDZWxsSW5kZXggPCBtYXhMaWdodENlbGxzOyBsaWdodENlbGxJbmRleCsrKSB7XG5cbiAgICAgICAgICAgICAgICBmbG9hdCBsaWdodEluZGV4ID0gdGV4dHVyZTJETG9kRVhUKGNsdXN0ZXJXb3JsZFRleHR1cmUsIHZlYzIoY2x1c3RlclRleHR1cmVTaXplLnkgKiAoY2x1c3RlclUgKyBsaWdodENlbGxJbmRleCksIGNsdXN0ZXJWKSwgMC4wKS54O1xuXG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0SW5kZXggPD0gMC4wKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgZXZhbHVhdGVDbHVzdGVyTGlnaHQoXG4gICAgICAgICAgICAgICAgICAgIGxpZ2h0SW5kZXggKiAyNTUuMCwgXG4gICAgICAgICAgICAgICAgICAgIHdvcmxkTm9ybWFsLCBcbiAgICAgICAgICAgICAgICAgICAgdmlld0RpciwgXG4gICAgICAgICAgICAgICAgICAgIHJlZmxlY3Rpb25EaXIsXG4jaWYgZGVmaW5lZChMSVRfQ0xFQVJDT0FUKVxuICAgICAgICAgICAgICAgICAgICBjbGVhcmNvYXRSZWZsZWN0aW9uRGlyLFxuI2VuZGlmXG4gICAgICAgICAgICAgICAgICAgIGdsb3NzLCBcbiAgICAgICAgICAgICAgICAgICAgc3BlY3VsYXJpdHksIFxuICAgICAgICAgICAgICAgICAgICBnZW9tZXRyaWNOb3JtYWwsIFxuICAgICAgICAgICAgICAgICAgICB0Ym4sIFxuI2lmIGRlZmluZWQoTElUX0lSSURFU0NFTkNFKVxuICAgICAgICAgICAgICAgICAgICBpcmlkZXNjZW5jZUZyZXNuZWwsXG4jZW5kaWZcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJjb2F0LCBcbiAgICAgICAgICAgICAgICAgICAgc2hlZW4sIFxuICAgICAgICAgICAgICAgICAgICBpcmlkZXNjZW5jZVxuICAgICAgICAgICAgICAgICk7IFxuICAgICAgICAgICAgICAgIC8vIGVuZCBvZiB0aGUgY2VsbCBhcnJheVxuICAgICAgICAgICAgICAgIGlmIChsaWdodENlbGxJbmRleCA+PSBjbHVzdGVyTWF4Q2VsbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICNlbmRpZlxuICAgIH1cbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsdUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
