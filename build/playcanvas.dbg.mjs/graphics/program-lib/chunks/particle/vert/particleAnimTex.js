/**
 * @license
 * PlayCanvas Engine v1.57.0 revision f1998a31e (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particleAnimTexVS = `
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVBbmltVGV4LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvZ3JhcGhpY3MvcHJvZ3JhbS1saWIvY2h1bmtzL3BhcnRpY2xlL3ZlcnQvcGFydGljbGVBbmltVGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgZmxvYXQgYW5pbWF0aW9uSW5kZXg7XG5cbiAgICBpZiAoYW5pbVRleEluZGV4UGFyYW1zLnkgPT0gMS4wKSB7XG4gICAgICAgIGFuaW1hdGlvbkluZGV4ID0gZmxvb3IoKGFuaW1UZXhQYXJhbXMudyArIDEuMCkgKiBybmRGYWN0b3IzLnopICogKGFuaW1UZXhQYXJhbXMueiArIDEuMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgYW5pbWF0aW9uSW5kZXggPSBhbmltVGV4SW5kZXhQYXJhbXMueCAqIChhbmltVGV4UGFyYW1zLnogKyAxLjApO1xuICAgIH1cblxuICAgIGZsb2F0IGF0bGFzWCA9IChhbmltYXRpb25JbmRleCArIGFuaW1GcmFtZSkgKiBhbmltVGV4VGlsZXNQYXJhbXMueDtcbiAgICBmbG9hdCBhdGxhc1kgPSAxLjAgLSBmbG9vcihhdGxhc1ggKyAxLjApICogYW5pbVRleFRpbGVzUGFyYW1zLnk7XG4gICAgYXRsYXNYID0gZnJhY3QoYXRsYXNYKTtcblxuICAgIHRleENvb3Jkc0FscGhhTGlmZS54eSAqPSBhbmltVGV4VGlsZXNQYXJhbXMueHk7XG4gICAgdGV4Q29vcmRzQWxwaGFMaWZlLnh5ICs9IHZlYzIoYXRsYXNYLCBhdGxhc1kpO1xuYDtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLHdCQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQWZBOzs7OyJ9
