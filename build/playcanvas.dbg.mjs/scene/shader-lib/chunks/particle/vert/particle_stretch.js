var particle_stretchVS = /* glsl */`
    vec3 moveDir = inVel * stretch;
    vec3 posPrev = particlePos - moveDir;
    posPrev += particlePosMoved;

    vec2 centerToVertexV = normalize((mat3(matrix_view) * localPos).xy);

    float interpolation = dot(-velocityV, centerToVertexV) * 0.5 + 0.5;

    particlePos = mix(particlePos, posPrev, interpolation);
`;

export { particle_stretchVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfc3RyZXRjaC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL3NjZW5lL3NoYWRlci1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVfc3RyZXRjaC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCAvKiBnbHNsICovYFxuICAgIHZlYzMgbW92ZURpciA9IGluVmVsICogc3RyZXRjaDtcbiAgICB2ZWMzIHBvc1ByZXYgPSBwYXJ0aWNsZVBvcyAtIG1vdmVEaXI7XG4gICAgcG9zUHJldiArPSBwYXJ0aWNsZVBvc01vdmVkO1xuXG4gICAgdmVjMiBjZW50ZXJUb1ZlcnRleFYgPSBub3JtYWxpemUoKG1hdDMobWF0cml4X3ZpZXcpICogbG9jYWxQb3MpLnh5KTtcblxuICAgIGZsb2F0IGludGVycG9sYXRpb24gPSBkb3QoLXZlbG9jaXR5ViwgY2VudGVyVG9WZXJ0ZXhWKSAqIDAuNSArIDAuNTtcblxuICAgIHBhcnRpY2xlUG9zID0gbWl4KHBhcnRpY2xlUG9zLCBwb3NQcmV2LCBpbnRlcnBvbGF0aW9uKTtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEseUJBQWUsVUFBVyxDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUM7Ozs7In0=
