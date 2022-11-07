/**
 * @license
 * PlayCanvas Engine v1.58.0-dev revision 1331860ee (DEBUG PROFILER)
 * Copyright 2011-2022 PlayCanvas Ltd. All rights reserved.
 */
var webgpuVS = `
#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)

#define GL2
#define VERTEXSHADER
`;

export { webgpuVS as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2ViZ3B1LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvc2NlbmUvc2hhZGVyLWxpYi9jaHVua3MvY29tbW9uL3ZlcnQvd2ViZ3B1LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IC8qIGdsc2wgKi9gXG4jZGVmaW5lIHRleHR1cmUyRChyZXMsIHV2KSB0ZXh0dXJlKHNhbXBsZXIyRChyZXMsIHJlcyAjIyBfc2FtcGxlciksIHV2KVxuXG4jZGVmaW5lIEdMMlxuI2RlZmluZSBWRVJURVhTSEFERVJcbmA7XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxlQUEwQixDQUFBO0FBQzFCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FMQTs7OzsifQ==
