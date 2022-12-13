/**
 * @license
 * PlayCanvas Engine v1.59.0-preview revision 797466563 (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var particle_blendAddPS = `
    dBlendModeFogFactor = 0.0;
    rgb *= saturate(gammaCorrectInput(max(a, 0.0)));
    if ((rgb.r + rgb.g + rgb.b) < 0.000001) discard;
`;

export { particle_blendAddPS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFydGljbGVfYmxlbmRBZGQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uL3NyYy9zY2VuZS9zaGFkZXItbGliL2NodW5rcy9wYXJ0aWNsZS9mcmFnL3BhcnRpY2xlX2JsZW5kQWRkLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4gICAgZEJsZW5kTW9kZUZvZ0ZhY3RvciA9IDAuMDtcbiAgICByZ2IgKj0gc2F0dXJhdGUoZ2FtbWFDb3JyZWN0SW5wdXQobWF4KGEsIDAuMCkpKTtcbiAgICBpZiAoKHJnYi5yICsgcmdiLmcgKyByZ2IuYikgPCAwLjAwMDAwMSkgZGlzY2FyZDtcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSwwQkFBMEIsQ0FBQTtBQUMxQjtBQUNBO0FBQ0E7QUFDQSxDQUFDOzs7OyJ9
