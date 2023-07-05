var particleAnimTexVS = /* glsl */`
    float animationIndex;

    if (animTexIndexParams.y == 1.0) {
        animationIndex = floor((animTexParams.w + 1.0) * rndFactor3.z) * (animTexParams.z + 1.0);
    } else {
        animationIndex = animTexIndexParams.x * (animTexParams.z + 1.0);
    }

    float atlasX = (animationIndex + animFrame) * animTexTilesParams.x;
    float atlasY = 1.0 - floor(atlasX + 1.0) * animTexTilesParams.y;
    atlasX = fract(atlasX);

    texCoordsAlphaLife.xy *= animTexTilesParams.xy;
    texCoordsAlphaLife.xy += vec2(atlasX, atlasY);
`;

export { particleAnimTexVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVBbmltVGV4LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvcGFydGljbGUvdmVydC9wYXJ0aWNsZUFuaW1UZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgLyogZ2xzbCAqL2BcbiAgICBmbG9hdCBhbmltYXRpb25JbmRleDtcblxuICAgIGlmIChhbmltVGV4SW5kZXhQYXJhbXMueSA9PSAxLjApIHtcbiAgICAgICAgYW5pbWF0aW9uSW5kZXggPSBmbG9vcigoYW5pbVRleFBhcmFtcy53ICsgMS4wKSAqIHJuZEZhY3RvcjMueikgKiAoYW5pbVRleFBhcmFtcy56ICsgMS4wKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBhbmltYXRpb25JbmRleCA9IGFuaW1UZXhJbmRleFBhcmFtcy54ICogKGFuaW1UZXhQYXJhbXMueiArIDEuMCk7XG4gICAgfVxuXG4gICAgZmxvYXQgYXRsYXNYID0gKGFuaW1hdGlvbkluZGV4ICsgYW5pbUZyYW1lKSAqIGFuaW1UZXhUaWxlc1BhcmFtcy54O1xuICAgIGZsb2F0IGF0bGFzWSA9IDEuMCAtIGZsb29yKGF0bGFzWCArIDEuMCkgKiBhbmltVGV4VGlsZXNQYXJhbXMueTtcbiAgICBhdGxhc1ggPSBmcmFjdChhdGxhc1gpO1xuXG4gICAgdGV4Q29vcmRzQWxwaGFMaWZlLnh5ICo9IGFuaW1UZXhUaWxlc1BhcmFtcy54eTtcbiAgICB0ZXhDb29yZHNBbHBoYUxpZmUueHkgKz0gdmVjMihhdGxhc1gsIGF0bGFzWSk7XG5gO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHdCQUFlLFVBQVcsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7OzsifQ==
