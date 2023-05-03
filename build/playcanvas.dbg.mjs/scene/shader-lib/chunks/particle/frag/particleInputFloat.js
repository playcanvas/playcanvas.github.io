var particleInputFloatPS = /* glsl */`
void readInput(float uv) {
    vec4 tex = texture2D(particleTexIN, vec2(uv, 0.25));
    vec4 tex2 = texture2D(particleTexIN, vec2(uv, 0.75));

    inPos = tex.xyz;
    inVel = tex2.xyz;
    inAngle = (tex.w < 0.0? -tex.w : tex.w) - 1000.0;
    inShow = tex.w >= 0.0;
    inLife = tex2.w;
}
`;

export { particleInputFloatPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVJbnB1dEZsb2F0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvZnJhZy9wYXJ0aWNsZUlucHV0RmxvYXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbnZvaWQgcmVhZElucHV0KGZsb2F0IHV2KSB7XG4gICAgdmVjNCB0ZXggPSB0ZXh0dXJlMkQocGFydGljbGVUZXhJTiwgdmVjMih1diwgMC4yNSkpO1xuICAgIHZlYzQgdGV4MiA9IHRleHR1cmUyRChwYXJ0aWNsZVRleElOLCB2ZWMyKHV2LCAwLjc1KSk7XG5cbiAgICBpblBvcyA9IHRleC54eXo7XG4gICAgaW5WZWwgPSB0ZXgyLnh5ejtcbiAgICBpbkFuZ2xlID0gKHRleC53IDwgMC4wPyAtdGV4LncgOiB0ZXgudykgLSAxMDAwLjA7XG4gICAgaW5TaG93ID0gdGV4LncgPj0gMC4wO1xuICAgIGluTGlmZSA9IHRleDIudztcbn1cbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMkJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
