var aoSpecOccPS = /* glsl */`
uniform float material_occludeSpecularIntensity;

void occludeSpecular(float gloss, float ao, vec3 worldNormal, vec3 viewDir) {
    // approximated specular occlusion from AO
    float specPow = exp2(gloss * 11.0);
    // http://research.tri-ace.com/Data/cedec2011_RealtimePBR_Implementation_e.pptx
    float specOcc = saturate(pow(dot(worldNormal, viewDir) + ao, 0.01*specPow) - 1.0 + ao);
    specOcc = mix(1.0, specOcc, material_occludeSpecularIntensity);

    dSpecularLight *= specOcc;
    dReflection *= specOcc;
    
#ifdef LIT_SHEEN
    sSpecularLight *= specOcc;
    sReflection *= specOcc;
#endif
}
`;

export { aoSpecOccPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYW9TcGVjT2NjLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvbGl0L2ZyYWcvYW9TcGVjT2NjLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG51bmlmb3JtIGZsb2F0IG1hdGVyaWFsX29jY2x1ZGVTcGVjdWxhckludGVuc2l0eTtcblxudm9pZCBvY2NsdWRlU3BlY3VsYXIoZmxvYXQgZ2xvc3MsIGZsb2F0IGFvLCB2ZWMzIHdvcmxkTm9ybWFsLCB2ZWMzIHZpZXdEaXIpIHtcbiAgICAvLyBhcHByb3hpbWF0ZWQgc3BlY3VsYXIgb2NjbHVzaW9uIGZyb20gQU9cbiAgICBmbG9hdCBzcGVjUG93ID0gZXhwMihnbG9zcyAqIDExLjApO1xuICAgIC8vIGh0dHA6Ly9yZXNlYXJjaC50cmktYWNlLmNvbS9EYXRhL2NlZGVjMjAxMV9SZWFsdGltZVBCUl9JbXBsZW1lbnRhdGlvbl9lLnBwdHhcbiAgICBmbG9hdCBzcGVjT2NjID0gc2F0dXJhdGUocG93KGRvdCh3b3JsZE5vcm1hbCwgdmlld0RpcikgKyBhbywgMC4wMSpzcGVjUG93KSAtIDEuMCArIGFvKTtcbiAgICBzcGVjT2NjID0gbWl4KDEuMCwgc3BlY09jYywgbWF0ZXJpYWxfb2NjbHVkZVNwZWN1bGFySW50ZW5zaXR5KTtcblxuICAgIGRTcGVjdWxhckxpZ2h0ICo9IHNwZWNPY2M7XG4gICAgZFJlZmxlY3Rpb24gKj0gc3BlY09jYztcbiAgICBcbiNpZmRlZiBMSVRfU0hFRU5cbiAgICBzU3BlY3VsYXJMaWdodCAqPSBzcGVjT2NjO1xuICAgIHNSZWZsZWN0aW9uICo9IHNwZWNPY2M7XG4jZW5kaWZcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsa0JBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
