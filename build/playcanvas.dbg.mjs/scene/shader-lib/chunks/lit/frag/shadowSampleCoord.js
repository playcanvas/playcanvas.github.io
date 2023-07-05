var shadowSampleCoordPS = /* glsl */`

vec3 getShadowSampleCoord$LIGHT(mat4 shadowTransform, vec4 shadowParams, vec3 worldPosition, vec3 lightPos, inout vec3 lightDir, vec3 lightDirNorm, vec3 normal) {

    vec3 surfacePosition = worldPosition;

#ifdef SHADOW_SAMPLE_POINT
    #ifdef SHADOW_SAMPLE_NORMAL_OFFSET
        float distScale = length(lightDir);
        surfacePosition = worldPosition + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;
        lightDir = surfacePosition - lightPos;
        return lightDir;
    #endif
#else
    #ifdef SHADOW_SAMPLE_SOURCE_ZBUFFER
        #ifdef SHADOW_SAMPLE_NORMAL_OFFSET
            surfacePosition = worldPosition + normal * shadowParams.y;
        #endif
    #else
        #ifdef SHADOW_SAMPLE_NORMAL_OFFSET
            #ifdef SHADOW_SAMPLE_ORTHO
                float distScale = 1.0;
            #else
                float distScale = abs(dot(vPositionW - lightPos, lightDirNorm));
            #endif
            surfacePosition = worldPosition + normal * shadowParams.y * clamp(1.0 - dot(normal, -lightDirNorm), 0.0, 1.0) * distScale;
        #endif
    #endif

    vec4 positionInShadowSpace = shadowTransform * vec4(surfacePosition, 1.0);
    #ifdef SHADOW_SAMPLE_ORTHO
        positionInShadowSpace.z = saturate(positionInShadowSpace.z) - 0.0001;
    #else
        #ifdef SHADOW_SAMPLE_SOURCE_ZBUFFER
            positionInShadowSpace.xyz /= positionInShadowSpace.w;
        #else
            positionInShadowSpace.xy /= positionInShadowSpace.w;
            positionInShadowSpace.z = length(lightDir) * shadowParams.w;
        #endif
    #endif

    #ifdef SHADOW_SAMPLE_Z_BIAS
        positionInShadowSpace.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif
    surfacePosition = positionInShadowSpace.xyz;
#endif

    return surfacePosition;
}
`;

export { shadowSampleCoordPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhZG93U2FtcGxlQ29vcmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9zaGFkb3dTYW1wbGVDb29yZC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuXG52ZWMzIGdldFNoYWRvd1NhbXBsZUNvb3JkJExJR0hUKG1hdDQgc2hhZG93VHJhbnNmb3JtLCB2ZWM0IHNoYWRvd1BhcmFtcywgdmVjMyB3b3JsZFBvc2l0aW9uLCB2ZWMzIGxpZ2h0UG9zLCBpbm91dCB2ZWMzIGxpZ2h0RGlyLCB2ZWMzIGxpZ2h0RGlyTm9ybSwgdmVjMyBub3JtYWwpIHtcblxuICAgIHZlYzMgc3VyZmFjZVBvc2l0aW9uID0gd29ybGRQb3NpdGlvbjtcblxuI2lmZGVmIFNIQURPV19TQU1QTEVfUE9JTlRcbiAgICAjaWZkZWYgU0hBRE9XX1NBTVBMRV9OT1JNQUxfT0ZGU0VUXG4gICAgICAgIGZsb2F0IGRpc3RTY2FsZSA9IGxlbmd0aChsaWdodERpcik7XG4gICAgICAgIHN1cmZhY2VQb3NpdGlvbiA9IHdvcmxkUG9zaXRpb24gKyBub3JtYWwgKiBzaGFkb3dQYXJhbXMueSAqIGNsYW1wKDEuMCAtIGRvdChub3JtYWwsIC1saWdodERpck5vcm0pLCAwLjAsIDEuMCkgKiBkaXN0U2NhbGU7XG4gICAgICAgIGxpZ2h0RGlyID0gc3VyZmFjZVBvc2l0aW9uIC0gbGlnaHRQb3M7XG4gICAgICAgIHJldHVybiBsaWdodERpcjtcbiAgICAjZW5kaWZcbiNlbHNlXG4gICAgI2lmZGVmIFNIQURPV19TQU1QTEVfU09VUkNFX1pCVUZGRVJcbiAgICAgICAgI2lmZGVmIFNIQURPV19TQU1QTEVfTk9STUFMX09GRlNFVFxuICAgICAgICAgICAgc3VyZmFjZVBvc2l0aW9uID0gd29ybGRQb3NpdGlvbiArIG5vcm1hbCAqIHNoYWRvd1BhcmFtcy55O1xuICAgICAgICAjZW5kaWZcbiAgICAjZWxzZVxuICAgICAgICAjaWZkZWYgU0hBRE9XX1NBTVBMRV9OT1JNQUxfT0ZGU0VUXG4gICAgICAgICAgICAjaWZkZWYgU0hBRE9XX1NBTVBMRV9PUlRIT1xuICAgICAgICAgICAgICAgIGZsb2F0IGRpc3RTY2FsZSA9IDEuMDtcbiAgICAgICAgICAgICNlbHNlXG4gICAgICAgICAgICAgICAgZmxvYXQgZGlzdFNjYWxlID0gYWJzKGRvdCh2UG9zaXRpb25XIC0gbGlnaHRQb3MsIGxpZ2h0RGlyTm9ybSkpO1xuICAgICAgICAgICAgI2VuZGlmXG4gICAgICAgICAgICBzdXJmYWNlUG9zaXRpb24gPSB3b3JsZFBvc2l0aW9uICsgbm9ybWFsICogc2hhZG93UGFyYW1zLnkgKiBjbGFtcCgxLjAgLSBkb3Qobm9ybWFsLCAtbGlnaHREaXJOb3JtKSwgMC4wLCAxLjApICogZGlzdFNjYWxlO1xuICAgICAgICAjZW5kaWZcbiAgICAjZW5kaWZcblxuICAgIHZlYzQgcG9zaXRpb25JblNoYWRvd1NwYWNlID0gc2hhZG93VHJhbnNmb3JtICogdmVjNChzdXJmYWNlUG9zaXRpb24sIDEuMCk7XG4gICAgI2lmZGVmIFNIQURPV19TQU1QTEVfT1JUSE9cbiAgICAgICAgcG9zaXRpb25JblNoYWRvd1NwYWNlLnogPSBzYXR1cmF0ZShwb3NpdGlvbkluU2hhZG93U3BhY2UueikgLSAwLjAwMDE7XG4gICAgI2Vsc2VcbiAgICAgICAgI2lmZGVmIFNIQURPV19TQU1QTEVfU09VUkNFX1pCVUZGRVJcbiAgICAgICAgICAgIHBvc2l0aW9uSW5TaGFkb3dTcGFjZS54eXogLz0gcG9zaXRpb25JblNoYWRvd1NwYWNlLnc7XG4gICAgICAgICNlbHNlXG4gICAgICAgICAgICBwb3NpdGlvbkluU2hhZG93U3BhY2UueHkgLz0gcG9zaXRpb25JblNoYWRvd1NwYWNlLnc7XG4gICAgICAgICAgICBwb3NpdGlvbkluU2hhZG93U3BhY2UueiA9IGxlbmd0aChsaWdodERpcikgKiBzaGFkb3dQYXJhbXMudztcbiAgICAgICAgI2VuZGlmXG4gICAgI2VuZGlmXG5cbiAgICAjaWZkZWYgU0hBRE9XX1NBTVBMRV9aX0JJQVNcbiAgICAgICAgcG9zaXRpb25JblNoYWRvd1NwYWNlLnogKz0gZ2V0U2hhZG93QmlhcyhzaGFkb3dQYXJhbXMueCwgc2hhZG93UGFyYW1zLnopO1xuICAgICNlbmRpZlxuICAgIHN1cmZhY2VQb3NpdGlvbiA9IHBvc2l0aW9uSW5TaGFkb3dTcGFjZS54eXo7XG4jZW5kaWZcblxuICAgIHJldHVybiBzdXJmYWNlUG9zaXRpb247XG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLDBCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
