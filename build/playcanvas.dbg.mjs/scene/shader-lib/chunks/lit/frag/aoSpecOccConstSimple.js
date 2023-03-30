/**
 * @license
 * PlayCanvas Engine v1.63.0-dev revision 9f3635a4e (DEBUG PROFILER)
 * Copyright 2011-2023 PlayCanvas Ltd. All rights reserved.
 */
var aoSpecOccConstSimplePS = /* glsl */`
void occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {
    dSpecularLight *= ao;
    dReflection *= ao;

#ifdef LIT_SHEEN
    sSpecularLight *= ao;
    sReflection *= ao;
#endif
}
`;

export { aoSpecOccConstSimplePS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjQ29uc3RTaW1wbGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9saXQvZnJhZy9hb1NwZWNPY2NDb25zdFNpbXBsZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxudm9pZCBvY2NsdWRlU3BlY3VsYXIoZmxvYXQgZ2xvc3MsIGZsb2F0IGFvLCB2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIpIHtcbiAgICBkU3BlY3VsYXJMaWdodCAqPSBhbztcbiAgICBkUmVmbGVjdGlvbiAqPSBhbztcblxuI2lmZGVmIExJVF9TSEVFTlxuICAgIHNTcGVjdWxhckxpZ2h0ICo9IGFvO1xuICAgIHNSZWZsZWN0aW9uICo9IGFvO1xuI2VuZGlmXG59XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsNkJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
