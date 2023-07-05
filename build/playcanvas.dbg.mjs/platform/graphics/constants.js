/**
 * Ignores the integer part of texture coordinates, using only the fractional part.
 *
 * @type {number}
 */
const ADDRESS_REPEAT = 0;

/**
 * Clamps texture coordinate to the range 0 to 1.
 *
 * @type {number}
 */
const ADDRESS_CLAMP_TO_EDGE = 1;

/**
 * Texture coordinate to be set to the fractional part if the integer part is even. If the integer
 * part is odd, then the texture coordinate is set to 1 minus the fractional part.
 *
 * @type {number}
 */
const ADDRESS_MIRRORED_REPEAT = 2;

/**
 * Multiply all fragment components by zero.
 *
 * @type {number}
 */
const BLENDMODE_ZERO = 0;

/**
 * Multiply all fragment components by one.
 *
 * @type {number}
 */
const BLENDMODE_ONE = 1;

/**
 * Multiply all fragment components by the components of the source fragment.
 *
 * @type {number}
 */
const BLENDMODE_SRC_COLOR = 2;

/**
 * Multiply all fragment components by one minus the components of the source fragment.
 *
 * @type {number}
 */
const BLENDMODE_ONE_MINUS_SRC_COLOR = 3;

/**
 * Multiply all fragment components by the components of the destination fragment.
 *
 * @type {number}
 */
const BLENDMODE_DST_COLOR = 4;

/**
 * Multiply all fragment components by one minus the components of the destination fragment.
 *
 * @type {number}
 */
const BLENDMODE_ONE_MINUS_DST_COLOR = 5;

/**
 * Multiply all fragment components by the alpha value of the source fragment.
 *
 * @type {number}
 */
const BLENDMODE_SRC_ALPHA = 6;

/**
 * Multiply all fragment components by the alpha value of the source fragment.
 *
 * @type {number}
 */
const BLENDMODE_SRC_ALPHA_SATURATE = 7;

/**
 * Multiply all fragment components by one minus the alpha value of the source fragment.
 *
 * @type {number}
 */
const BLENDMODE_ONE_MINUS_SRC_ALPHA = 8;

/**
 * Multiply all fragment components by the alpha value of the destination fragment.
 *
 * @type {number}
 */
const BLENDMODE_DST_ALPHA = 9;

/**
 * Multiply all fragment components by one minus the alpha value of the destination fragment.
 *
 * @type {number}
 */
const BLENDMODE_ONE_MINUS_DST_ALPHA = 10;

/**
 * Multiplies all fragment components by a constant.
 *
 * @type {number}
 */
const BLENDMODE_CONSTANT = 11;

/**
 * Multiplies all fragment components by 1 minus a constant.
 *
 * @type {number}
 */
const BLENDMODE_ONE_MINUS_CONSTANT = 12;

/**
 * Add the results of the source and destination fragment multiplies.
 *
 * @type {number}
 */
const BLENDEQUATION_ADD = 0;

/**
 * Subtract the results of the source and destination fragment multiplies.
 *
 * @type {number}
 */
const BLENDEQUATION_SUBTRACT = 1;

/**
 * Reverse and subtract the results of the source and destination fragment multiplies.
 *
 * @type {number}
 */
const BLENDEQUATION_REVERSE_SUBTRACT = 2;

/**
 * Use the smallest value. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 */
const BLENDEQUATION_MIN = 3;

/**
 * Use the largest value. Check app.graphicsDevice.extBlendMinmax for support.
 *
 * @type {number}
 */
const BLENDEQUATION_MAX = 4;

/**
 * The data store contents will be modified once and used many times.
 *
 * @type {number}
 */
const BUFFER_STATIC = 0;

/**
 * The data store contents will be modified repeatedly and used many times.
 *
 * @type {number}
 */
const BUFFER_DYNAMIC = 1;

/**
 * The data store contents will be modified once and used at most a few times.
 *
 * @type {number}
 */
const BUFFER_STREAM = 2;

/**
 * The data store contents will be modified repeatedly on the GPU and used many times. Optimal for
 * transform feedback usage (WebGL2 only).
 *
 * @type {number}
 */
const BUFFER_GPUDYNAMIC = 3;

/**
 * Clear the color buffer.
 *
 * @type {number}
 */
const CLEARFLAG_COLOR = 1;

/**
 * Clear the depth buffer.
 *
 * @type {number}
 */
const CLEARFLAG_DEPTH = 2;

/**
 * Clear the stencil buffer.
 *
 * @type {number}
 */
const CLEARFLAG_STENCIL = 4;

/**
 * The positive X face of a cubemap.
 *
 * @type {number}
 */
const CUBEFACE_POSX = 0;

/**
 * The negative X face of a cubemap.
 *
 * @type {number}
 */
const CUBEFACE_NEGX = 1;

/**
 * The positive Y face of a cubemap.
 *
 * @type {number}
 */
const CUBEFACE_POSY = 2;

/**
 * The negative Y face of a cubemap.
 *
 * @type {number}
 */
const CUBEFACE_NEGY = 3;

/**
 * The positive Z face of a cubemap.
 *
 * @type {number}
 */
const CUBEFACE_POSZ = 4;

/**
 * The negative Z face of a cubemap.
 *
 * @type {number}
 */
const CUBEFACE_NEGZ = 5;

/**
 * No triangles are culled.
 *
 * @type {number}
 */
const CULLFACE_NONE = 0;

/**
 * Triangles facing away from the view direction are culled.
 *
 * @type {number}
 */
const CULLFACE_BACK = 1;

/**
 * Triangles facing the view direction are culled.
 *
 * @type {number}
 */
const CULLFACE_FRONT = 2;

/**
 * Triangles are culled regardless of their orientation with respect to the view direction. Note
 * that point or line primitives are unaffected by this render state.
 *
 * @type {number}
 * @ignore
 */
const CULLFACE_FRONTANDBACK = 3;

/**
 * Point sample filtering.
 *
 * @type {number}
 */
const FILTER_NEAREST = 0;

/**
 * Bilinear filtering.
 *
 * @type {number}
 */
const FILTER_LINEAR = 1;

/**
 * Use the nearest neighbor in the nearest mipmap level.
 *
 * @type {number}
 */
const FILTER_NEAREST_MIPMAP_NEAREST = 2;

/**
 * Linearly interpolate in the nearest mipmap level.
 *
 * @type {number}
 */
const FILTER_NEAREST_MIPMAP_LINEAR = 3;

/**
 * Use the nearest neighbor after linearly interpolating between mipmap levels.
 *
 * @type {number}
 */
const FILTER_LINEAR_MIPMAP_NEAREST = 4;

/**
 * Linearly interpolate both the mipmap levels and between texels.
 *
 * @type {number}
 */
const FILTER_LINEAR_MIPMAP_LINEAR = 5;

/**
 * Never pass.
 *
 * @type {number}
 */
const FUNC_NEVER = 0;

/**
 * Pass if (ref & mask) < (stencil & mask).
 *
 * @type {number}
 */
const FUNC_LESS = 1;

/**
 * Pass if (ref & mask) == (stencil & mask).
 *
 * @type {number}
 */
const FUNC_EQUAL = 2;

/**
 * Pass if (ref & mask) <= (stencil & mask).
 *
 * @type {number}
 */
const FUNC_LESSEQUAL = 3;

/**
 * Pass if (ref & mask) > (stencil & mask).
 *
 * @type {number}
 */
const FUNC_GREATER = 4;

/**
 * Pass if (ref & mask) != (stencil & mask).
 *
 * @type {number}
 */
const FUNC_NOTEQUAL = 5;

/**
 * Pass if (ref & mask) >= (stencil & mask).
 *
 * @type {number}
 */
const FUNC_GREATEREQUAL = 6;

/**
 * Always pass.
 *
 * @type {number}
 */
const FUNC_ALWAYS = 7;

/**
 * 8-bit unsigned vertex indices (0 to 255).
 *
 * @type {number}
 */
const INDEXFORMAT_UINT8 = 0;

/**
 * 16-bit unsigned vertex indices (0 to 65,535).
 *
 * @type {number}
 */
const INDEXFORMAT_UINT16 = 1;

/**
 * 32-bit unsigned vertex indices (0 to 4,294,967,295).
 *
 * @type {number}
 */
const INDEXFORMAT_UINT32 = 2;

/**
 * 8-bit alpha.
 *
 * @type {number}
 */
const PIXELFORMAT_A8 = 0;

/**
 * 8-bit luminance.
 *
 * @type {number}
 */
const PIXELFORMAT_L8 = 1;

/**
 * 8-bit luminance with 8-bit alpha.
 *
 * @type {number}
 */
const PIXELFORMAT_LA8 = 2;

/**
 * 16-bit RGB (5-bits for red channel, 6 for green and 5 for blue).
 *
 * @type {number}
 */
const PIXELFORMAT_RGB565 = 3;

/**
 * 16-bit RGBA (5-bits for red channel, 5 for green, 5 for blue with 1-bit alpha).
 *
 * @type {number}
 */
const PIXELFORMAT_RGBA5551 = 4;

/**
 * 16-bit RGBA (4-bits for red channel, 4 for green, 4 for blue with 4-bit alpha).
 *
 * @type {number}
 */
const PIXELFORMAT_RGBA4 = 5;

/**
 * 24-bit RGB (8-bits for red channel, 8 for green and 8 for blue).
 *
 * @type {number}
 */
const PIXELFORMAT_RGB8 = 6;

/**
 * 32-bit RGBA (8-bits for red channel, 8 for green, 8 for blue with 8-bit alpha).
 *
 * @type {number}
 */
const PIXELFORMAT_RGBA8 = 7;

/**
 * Block compressed format storing 16 input pixels in 64 bits of output, consisting of two 16-bit
 * RGB 5:6:5 color values and a 4x4 two bit lookup table.
 *
 * @type {number}
 */
const PIXELFORMAT_DXT1 = 8;

/**
 * Block compressed format storing 16 input pixels (corresponding to a 4x4 pixel block) into 128
 * bits of output, consisting of 64 bits of alpha channel data (4 bits for each pixel) followed by
 * 64 bits of color data; encoded the same way as DXT1.
 *
 * @type {number}
 */
const PIXELFORMAT_DXT3 = 9;

/**
 * Block compressed format storing 16 input pixels into 128 bits of output, consisting of 64 bits
 * of alpha channel data (two 8 bit alpha values and a 4x4 3 bit lookup table) followed by 64 bits
 * of color data (encoded the same way as DXT1).
 *
 * @type {number}
 */
const PIXELFORMAT_DXT5 = 10;

/**
 * 16-bit floating point RGB (16-bit float for each red, green and blue channels).
 *
 * @type {number}
 */
const PIXELFORMAT_RGB16F = 11;

/**
 * 16-bit floating point RGBA (16-bit float for each red, green, blue and alpha channels).
 *
 * @type {number}
 */
const PIXELFORMAT_RGBA16F = 12;

/**
 * 32-bit floating point RGB (32-bit float for each red, green and blue channels).
 *
 * @type {number}
 */
const PIXELFORMAT_RGB32F = 13;

/**
 * 32-bit floating point RGBA (32-bit float for each red, green, blue and alpha channels).
 *
 * @type {number}
 */
const PIXELFORMAT_RGBA32F = 14;

/**
 * 32-bit floating point single channel format (WebGL2 only).
 *
 * @type {number}
 */
const PIXELFORMAT_R32F = 15;

/**
 * A readable depth buffer format.
 *
 * @type {number}
 */
const PIXELFORMAT_DEPTH = 16;

/**
 * A readable depth/stencil buffer format (WebGL2 only).
 *
 * @type {number}
 */
const PIXELFORMAT_DEPTHSTENCIL = 17;

/**
 * A floating-point color-only format with 11 bits for red and green channels and 10 bits for the
 * blue channel (WebGL2 only).
 *
 * @type {number}
 */
const PIXELFORMAT_111110F = 18;

/**
 * Color-only sRGB format (WebGL2 only).
 *
 * @type {number}
 */
const PIXELFORMAT_SRGB = 19;

/**
 * Color sRGB format with additional alpha channel (WebGL2 only).
 *
 * @type {number}
 */
const PIXELFORMAT_SRGBA = 20;

/**
 * ETC1 compressed format.
 *
 * @type {number}
 */
const PIXELFORMAT_ETC1 = 21;

/**
 * ETC2 (RGB) compressed format.
 *
 * @type {number}
 */
const PIXELFORMAT_ETC2_RGB = 22;

/**
 * ETC2 (RGBA) compressed format.
 *
 * @type {number}
 */
const PIXELFORMAT_ETC2_RGBA = 23;

/**
 * PVRTC (2BPP RGB) compressed format.
 *
 * @type {number}
 */
const PIXELFORMAT_PVRTC_2BPP_RGB_1 = 24;

/**
 * PVRTC (2BPP RGBA) compressed format.
 *
 * @type {number}
 */
const PIXELFORMAT_PVRTC_2BPP_RGBA_1 = 25;

/**
 * PVRTC (4BPP RGB) compressed format.
 *
 * @type {number}
 */
const PIXELFORMAT_PVRTC_4BPP_RGB_1 = 26;

/**
 * PVRTC (4BPP RGBA) compressed format.
 *
 * @type {number}
 */
const PIXELFORMAT_PVRTC_4BPP_RGBA_1 = 27;

/**
 * ATC compressed format with alpha channel in blocks of 4x4.
 *
 * @type {number}
 */
const PIXELFORMAT_ASTC_4x4 = 28;

/**
 * ATC compressed format with no alpha channel.
 *
 * @type {number}
 */
const PIXELFORMAT_ATC_RGB = 29;

/**
 * ATC compressed format with alpha channel.
 *
 * @type {number}
 */
const PIXELFORMAT_ATC_RGBA = 30;

/**
 * 32-bit BGRA (8-bits for blue channel, 8 for green, 8 for red with 8-bit alpha).
 *
 * @type {number}
 * @ignore
 */
const PIXELFORMAT_BGRA8 = 31;

// map of engine PIXELFORMAT_*** enums to information about the format
const pixelFormatInfo = new Map([
// uncompressed formats
[PIXELFORMAT_A8, {
  name: 'A8',
  size: 1
}], [PIXELFORMAT_L8, {
  name: 'L8',
  size: 1
}], [PIXELFORMAT_LA8, {
  name: 'LA8',
  size: 2
}], [PIXELFORMAT_RGB565, {
  name: 'RGB565',
  size: 2
}], [PIXELFORMAT_RGBA5551, {
  name: 'RGBA5551',
  size: 2
}], [PIXELFORMAT_RGBA4, {
  name: 'RGBA4',
  size: 2
}], [PIXELFORMAT_RGB8, {
  name: 'RGB8',
  size: 4
}], [PIXELFORMAT_RGBA8, {
  name: 'RGBA8',
  size: 4
}], [PIXELFORMAT_RGB16F, {
  name: 'RGB16F',
  size: 8
}], [PIXELFORMAT_RGBA16F, {
  name: 'RGBA16F',
  size: 8
}], [PIXELFORMAT_RGB32F, {
  name: 'RGB32F',
  size: 16
}], [PIXELFORMAT_RGBA32F, {
  name: 'RGBA32F',
  size: 16
}], [PIXELFORMAT_R32F, {
  name: 'R32F',
  size: 4
}], [PIXELFORMAT_DEPTH, {
  name: 'DEPTH',
  size: 4
}], [PIXELFORMAT_DEPTHSTENCIL, {
  name: 'DEPTHSTENCIL',
  size: 4
}], [PIXELFORMAT_111110F, {
  name: '111110F',
  size: 4
}], [PIXELFORMAT_SRGB, {
  name: 'SRGB',
  size: 4
}], [PIXELFORMAT_SRGBA, {
  name: 'SRGBA',
  size: 4
}], [PIXELFORMAT_BGRA8, {
  name: 'BGRA8',
  size: 4
}],
// compressed formats
[PIXELFORMAT_DXT1, {
  name: 'DXT1',
  blockSize: 8
}], [PIXELFORMAT_DXT3, {
  name: 'DXT3',
  blockSize: 16
}], [PIXELFORMAT_DXT5, {
  name: 'DXT5',
  blockSize: 16
}], [PIXELFORMAT_ETC1, {
  name: 'ETC1',
  blockSize: 8
}], [PIXELFORMAT_ETC2_RGB, {
  name: 'ETC2_RGB',
  blockSize: 8
}], [PIXELFORMAT_ETC2_RGBA, {
  name: 'ETC2_RGBA',
  blockSize: 16
}], [PIXELFORMAT_PVRTC_2BPP_RGB_1, {
  name: 'PVRTC_2BPP_RGB_1',
  blockSize: 8
}], [PIXELFORMAT_PVRTC_2BPP_RGBA_1, {
  name: 'PVRTC_2BPP_RGBA_1',
  blockSize: 8
}], [PIXELFORMAT_PVRTC_4BPP_RGB_1, {
  name: 'PVRTC_4BPP_RGB_1',
  blockSize: 8
}], [PIXELFORMAT_PVRTC_4BPP_RGBA_1, {
  name: 'PVRTC_4BPP_RGBA_1',
  blockSize: 8
}], [PIXELFORMAT_ASTC_4x4, {
  name: 'ASTC_4x4',
  blockSize: 16
}], [PIXELFORMAT_ATC_RGB, {
  name: 'ATC_RGB',
  blockSize: 8
}], [PIXELFORMAT_ATC_RGBA, {
  name: 'ATC_RGBA',
  blockSize: 16
}]]);

// update this function when exposing additional compressed pixel formats
const isCompressedPixelFormat = format => {
  return pixelFormatInfo.get(format).blockSize !== undefined;
};

// get the pixel format array type
const getPixelFormatArrayType = format => {
  switch (format) {
    case PIXELFORMAT_RGB32F:
    case PIXELFORMAT_RGBA32F:
      return Float32Array;
    case PIXELFORMAT_RGB565:
    case PIXELFORMAT_RGBA5551:
    case PIXELFORMAT_RGBA4:
    case PIXELFORMAT_RGB16F:
    case PIXELFORMAT_RGBA16F:
      return Uint16Array;
    default:
      return Uint8Array;
  }
};

/**
 * List of distinct points.
 *
 * @type {number}
 */
const PRIMITIVE_POINTS = 0;

/**
 * Discrete list of line segments.
 *
 * @type {number}
 */
const PRIMITIVE_LINES = 1;

/**
 * List of points that are linked sequentially by line segments, with a closing line segment
 * between the last and first points.
 *
 * @type {number}
 */
const PRIMITIVE_LINELOOP = 2;

/**
 * List of points that are linked sequentially by line segments.
 *
 * @type {number}
 */
const PRIMITIVE_LINESTRIP = 3;

/**
 * Discrete list of triangles.
 *
 * @type {number}
 */
const PRIMITIVE_TRIANGLES = 4;

/**
 * Connected strip of triangles where a specified vertex forms a triangle using the previous two.
 *
 * @type {number}
 */
const PRIMITIVE_TRISTRIP = 5;

/**
 * Connected fan of triangles where the first vertex forms triangles with the following pairs of vertices.
 *
 * @type {number}
 */
const PRIMITIVE_TRIFAN = 6;

/**
 * Vertex attribute to be treated as a position.
 *
 * @type {string}
 */
const SEMANTIC_POSITION = "POSITION";

/**
 * Vertex attribute to be treated as a normal.
 *
 * @type {string}
 */
const SEMANTIC_NORMAL = "NORMAL";

/**
 * Vertex attribute to be treated as a tangent.
 *
 * @type {string}
 */
const SEMANTIC_TANGENT = "TANGENT";

/**
 * Vertex attribute to be treated as skin blend weights.
 *
 * @type {string}
 */
const SEMANTIC_BLENDWEIGHT = "BLENDWEIGHT";

/**
 * Vertex attribute to be treated as skin blend indices.
 *
 * @type {string}
 */
const SEMANTIC_BLENDINDICES = "BLENDINDICES";

/**
 * Vertex attribute to be treated as a color.
 *
 * @type {string}
 */
const SEMANTIC_COLOR = "COLOR";

// private semantic used for programmatic construction of individual texcoord semantics
const SEMANTIC_TEXCOORD = "TEXCOORD";

/**
 * Vertex attribute to be treated as a texture coordinate (set 0).
 *
 * @type {string}
 */
const SEMANTIC_TEXCOORD0 = "TEXCOORD0";

/**
 * Vertex attribute to be treated as a texture coordinate (set 1).
 *
 * @type {string}
 */
const SEMANTIC_TEXCOORD1 = "TEXCOORD1";

/**
 * Vertex attribute to be treated as a texture coordinate (set 2).
 *
 * @type {string}
 */
const SEMANTIC_TEXCOORD2 = "TEXCOORD2";

/**
 * Vertex attribute to be treated as a texture coordinate (set 3).
 *
 * @type {string}
 */
const SEMANTIC_TEXCOORD3 = "TEXCOORD3";

/**
 * Vertex attribute to be treated as a texture coordinate (set 4).
 *
 * @type {string}
 */
const SEMANTIC_TEXCOORD4 = "TEXCOORD4";

/**
 * Vertex attribute to be treated as a texture coordinate (set 5).
 *
 * @type {string}
 */
const SEMANTIC_TEXCOORD5 = "TEXCOORD5";

/**
 * Vertex attribute to be treated as a texture coordinate (set 6).
 *
 * @type {string}
 */
const SEMANTIC_TEXCOORD6 = "TEXCOORD6";

/**
 * Vertex attribute to be treated as a texture coordinate (set 7).
 *
 * @type {string}
 */
const SEMANTIC_TEXCOORD7 = "TEXCOORD7";

// private semantic used for programmatic construction of individual attr semantics
const SEMANTIC_ATTR = "ATTR";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR0 = "ATTR0";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR1 = "ATTR1";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR2 = "ATTR2";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR3 = "ATTR3";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR4 = "ATTR4";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR5 = "ATTR5";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR6 = "ATTR6";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR7 = "ATTR7";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR8 = "ATTR8";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR9 = "ATTR9";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR10 = "ATTR10";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR11 = "ATTR11";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR12 = "ATTR12";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR13 = "ATTR13";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR14 = "ATTR14";

/**
 * Vertex attribute with a user defined semantic.
 *
 * @type {string}
 */
const SEMANTIC_ATTR15 = "ATTR15";
const SHADERTAG_MATERIAL = 1;

/**
 * Don't change the stencil buffer value.
 *
 * @type {number}
 */
const STENCILOP_KEEP = 0;

/**
 * Set value to zero.
 *
 * @type {number}
 */
const STENCILOP_ZERO = 1;

/**
 * Replace value with the reference value (see {@link StencilParameters}).
 *
 * @type {number}
 */
const STENCILOP_REPLACE = 2;

/**
 * Increment the value.
 *
 * @type {number}
 */
const STENCILOP_INCREMENT = 3;

/**
 * Increment the value but wrap it to zero when it's larger than a maximum representable value.
 *
 * @type {number}
 */
const STENCILOP_INCREMENTWRAP = 4;

/**
 * Decrement the value.
 *
 * @type {number}
 */
const STENCILOP_DECREMENT = 5;

/**
 * Decrement the value but wrap it to a maximum representable value if the current value is 0.
 *
 * @type {number}
 */
const STENCILOP_DECREMENTWRAP = 6;

/**
 * Invert the value bitwise.
 *
 * @type {number}
 */
const STENCILOP_INVERT = 7;

/**
 * Read only. Any changes to the locked mip level's pixels will not update the texture.
 *
 * @type {number}
 */
const TEXTURELOCK_READ = 1;

/**
 * Write only. The contents of the specified mip level will be entirely replaced.
 *
 * @type {number}
 */
const TEXTURELOCK_WRITE = 2;

/**
 * Texture is a default type.
 *
 * @type {string}
 */
const TEXTURETYPE_DEFAULT = 'default';

/**
 * Texture stores high dynamic range data in RGBM format.
 *
 * @type {string}
 */
const TEXTURETYPE_RGBM = 'rgbm';

/**
 * Texture stores high dynamic range data in RGBE format.
 *
 * @type {string}
 */
const TEXTURETYPE_RGBE = 'rgbe';

/**
 * Texture stores high dynamic range data in RGBP encoding.
 *
 * @type {string}
 */
const TEXTURETYPE_RGBP = 'rgbp';

/**
 * Texture stores normalmap data swizzled in GGGR format. This is used for tangent space normal
 * maps. The R component is stored in alpha and G is stored in RGB. This packing can result in
 * higher quality when the texture data is compressed.
 *
 * @type {string}
 */
const TEXTURETYPE_SWIZZLEGGGR = 'swizzleGGGR';
const TEXHINT_NONE = 0;
const TEXHINT_SHADOWMAP = 1;
const TEXHINT_ASSET = 2;
const TEXHINT_LIGHTMAP = 3;
const TEXTUREDIMENSION_1D = '1d';
const TEXTUREDIMENSION_2D = '2d';
const TEXTUREDIMENSION_2D_ARRAY = '2d-array';
const TEXTUREDIMENSION_CUBE = 'cube';
const TEXTUREDIMENSION_CUBE_ARRAY = 'cube-array';
const TEXTUREDIMENSION_3D = '3d';
const SAMPLETYPE_FLOAT = 0;
const SAMPLETYPE_UNFILTERABLE_FLOAT = 1;
const SAMPLETYPE_DEPTH = 2;

/**
 * Texture data is not stored a specific projection format.
 *
 * @type {string}
 */
const TEXTUREPROJECTION_NONE = "none";

/**
 * Texture data is stored in cubemap projection format.
 *
 * @type {string}
 */
const TEXTUREPROJECTION_CUBE = "cube";

/**
 * Texture data is stored in equirectangular projection format.
 *
 * @type {string}
 */
const TEXTUREPROJECTION_EQUIRECT = "equirect";

/**
 * Texture data is stored in octahedral projection format.
 *
 * @type {string}
 */
const TEXTUREPROJECTION_OCTAHEDRAL = "octahedral";

/**
 * Shader source code uses GLSL language.
 *
 * @type {string}
 */
const SHADERLANGUAGE_GLSL = 'glsl';

/**
 * Shader source code uses WGSL language.
 *
 * @type {string}
 */
const SHADERLANGUAGE_WGSL = 'wgsl';

/**
 * Signed byte vertex element type.
 *
 * @type {number}
 */
const TYPE_INT8 = 0;

/**
 * Unsigned byte vertex element type.
 *
 * @type {number}
 */
const TYPE_UINT8 = 1;

/**
 * Signed short vertex element type.
 *
 * @type {number}
 */
const TYPE_INT16 = 2;

/**
 * Unsigned short vertex element type.
 *
 * @type {number}
 */
const TYPE_UINT16 = 3;

/**
 * Signed integer vertex element type.
 *
 * @type {number}
 */
const TYPE_INT32 = 4;

/**
 * Unsigned integer vertex element type.
 *
 * @type {number}
 */
const TYPE_UINT32 = 5;

/**
 * Floating point vertex element type.
 *
 * @type {number}
 */
const TYPE_FLOAT32 = 6;
const UNIFORMTYPE_BOOL = 0;
const UNIFORMTYPE_INT = 1;
const UNIFORMTYPE_FLOAT = 2;
const UNIFORMTYPE_VEC2 = 3;
const UNIFORMTYPE_VEC3 = 4;
const UNIFORMTYPE_VEC4 = 5;
const UNIFORMTYPE_IVEC2 = 6;
const UNIFORMTYPE_IVEC3 = 7;
const UNIFORMTYPE_IVEC4 = 8;
const UNIFORMTYPE_BVEC2 = 9;
const UNIFORMTYPE_BVEC3 = 10;
const UNIFORMTYPE_BVEC4 = 11;
const UNIFORMTYPE_MAT2 = 12;
const UNIFORMTYPE_MAT3 = 13;
const UNIFORMTYPE_MAT4 = 14;
const UNIFORMTYPE_TEXTURE2D = 15;
const UNIFORMTYPE_TEXTURECUBE = 16;
const UNIFORMTYPE_FLOATARRAY = 17;
const UNIFORMTYPE_TEXTURE2D_SHADOW = 18;
const UNIFORMTYPE_TEXTURECUBE_SHADOW = 19;
const UNIFORMTYPE_TEXTURE3D = 20;
const UNIFORMTYPE_VEC2ARRAY = 21;
const UNIFORMTYPE_VEC3ARRAY = 22;
const UNIFORMTYPE_VEC4ARRAY = 23;
const UNIFORMTYPE_MAT4ARRAY = 24;
const uniformTypeToName = ['bool', 'int', 'float', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'bec2', 'bec3', 'bec4', 'mat2', 'mat3', 'mat4', 'sampler2D', 'samplerCube', '',
// not directly handled: UNIFORMTYPE_FLOATARRAY
'sampler2DShadow', 'samplerCubeShadow', 'sampler3D', '',
// not directly handled: UNIFORMTYPE_VEC2ARRAY
'',
// not directly handled: UNIFORMTYPE_VEC3ARRAY
'' // not directly handled: UNIFORMTYPE_VEC4ARRAY
];

/**
 * A WebGL 1 device type.
 *
 * @type {string}
 */
const DEVICETYPE_WEBGL1 = 'webgl1';

/**
 * A WebGL 2 device type.
 *
 * @type {string}
 */
const DEVICETYPE_WEBGL2 = 'webgl2';

/**
 * A WebGPU device type.
 *
 * @type {string}
 */
const DEVICETYPE_WEBGPU = 'webgpu';

// (bit-flags) shader stages for resource visibility on the GPU
const SHADERSTAGE_VERTEX = 1;
const SHADERSTAGE_FRAGMENT = 2;
const SHADERSTAGE_COMPUTE = 4;

// indices of commonly used bind groups
// sorted in a way that any trailing bind groups can be unused in any render pass
const BINDGROUP_MESH = 0;
const BINDGROUP_VIEW = 1;

// names of bind groups
const bindGroupNames = ['mesh', 'view'];

// name of the default uniform buffer slot in a bind group
const UNIFORM_BUFFER_DEFAULT_SLOT_NAME = 'default';

// map of engine TYPE_*** enums to their corresponding typed array constructors and byte sizes
const typedArrayTypes = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array];
const typedArrayTypesByteSize = [1, 1, 2, 2, 4, 4, 4];
const vertexTypesNames = ['INT8', 'UINT8', 'INT16', 'UINT16', 'INT32', 'UINT32', 'FLOAT32'];

// map of typed array to engine TYPE_***
const typedArrayToType = {
  "Int8Array": TYPE_INT8,
  "Uint8Array": TYPE_UINT8,
  "Int16Array": TYPE_INT16,
  "Uint16Array": TYPE_UINT16,
  "Int32Array": TYPE_INT32,
  "Uint32Array": TYPE_UINT32,
  "Float32Array": TYPE_FLOAT32
};

// map of engine INDEXFORMAT_*** to their corresponding typed array constructors and byte sizes
const typedArrayIndexFormats = [Uint8Array, Uint16Array, Uint32Array];
const typedArrayIndexFormatsByteSize = [1, 2, 4];

/**
 * Map of engine semantics into location on device in range 0..15 (note - semantics mapping to the
 * same location cannot be used at the same time) organized in a way that ATTR0-ATTR7 do not
 * overlap with common important semantics.
 *
 * @type {object}
 * @ignore
 */
const semanticToLocation = {};
semanticToLocation[SEMANTIC_POSITION] = 0;
semanticToLocation[SEMANTIC_NORMAL] = 1;
semanticToLocation[SEMANTIC_BLENDWEIGHT] = 2;
semanticToLocation[SEMANTIC_BLENDINDICES] = 3;
semanticToLocation[SEMANTIC_COLOR] = 4;
semanticToLocation[SEMANTIC_TEXCOORD0] = 5;
semanticToLocation[SEMANTIC_TEXCOORD1] = 6;
semanticToLocation[SEMANTIC_TEXCOORD2] = 7;
semanticToLocation[SEMANTIC_TEXCOORD3] = 8;
semanticToLocation[SEMANTIC_TEXCOORD4] = 9;
semanticToLocation[SEMANTIC_TEXCOORD5] = 10;
semanticToLocation[SEMANTIC_TEXCOORD6] = 11;
semanticToLocation[SEMANTIC_TEXCOORD7] = 12;
semanticToLocation[SEMANTIC_TANGENT] = 13;
semanticToLocation[SEMANTIC_ATTR0] = 0;
semanticToLocation[SEMANTIC_ATTR1] = 1;
semanticToLocation[SEMANTIC_ATTR2] = 2;
semanticToLocation[SEMANTIC_ATTR3] = 3;
semanticToLocation[SEMANTIC_ATTR4] = 4;
semanticToLocation[SEMANTIC_ATTR5] = 5;
semanticToLocation[SEMANTIC_ATTR6] = 6;
semanticToLocation[SEMANTIC_ATTR7] = 7;
semanticToLocation[SEMANTIC_ATTR8] = 8;
semanticToLocation[SEMANTIC_ATTR9] = 9;
semanticToLocation[SEMANTIC_ATTR10] = 10;
semanticToLocation[SEMANTIC_ATTR11] = 11;
semanticToLocation[SEMANTIC_ATTR12] = 12;
semanticToLocation[SEMANTIC_ATTR13] = 13;
semanticToLocation[SEMANTIC_ATTR14] = 14;
semanticToLocation[SEMANTIC_ATTR15] = 15;

/**
 * Chunk API versions
 *
 * @type {string}
 */
const CHUNKAPI_1_51 = '1.51';
const CHUNKAPI_1_55 = '1.55';
const CHUNKAPI_1_56 = '1.56';
const CHUNKAPI_1_57 = '1.57';
const CHUNKAPI_1_58 = '1.58';
const CHUNKAPI_1_60 = '1.60';
const CHUNKAPI_1_62 = '1.62';

export { ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BINDGROUP_MESH, BINDGROUP_VIEW, BLENDEQUATION_ADD, BLENDEQUATION_MAX, BLENDEQUATION_MIN, BLENDEQUATION_REVERSE_SUBTRACT, BLENDEQUATION_SUBTRACT, BLENDMODE_CONSTANT, BLENDMODE_DST_ALPHA, BLENDMODE_DST_COLOR, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_CONSTANT, BLENDMODE_ONE_MINUS_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_SRC_COLOR, BLENDMODE_ZERO, BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM, CHUNKAPI_1_51, CHUNKAPI_1_55, CHUNKAPI_1_56, CHUNKAPI_1_57, CHUNKAPI_1_58, CHUNKAPI_1_60, CHUNKAPI_1_62, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CUBEFACE_NEGX, CUBEFACE_NEGY, CUBEFACE_NEGZ, CUBEFACE_POSX, CUBEFACE_POSY, CUBEFACE_POSZ, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE, DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FUNC_ALWAYS, FUNC_EQUAL, FUNC_GREATER, FUNC_GREATEREQUAL, FUNC_LESS, FUNC_LESSEQUAL, FUNC_NEVER, FUNC_NOTEQUAL, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, INDEXFORMAT_UINT8, PIXELFORMAT_111110F, PIXELFORMAT_A8, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_R32F, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGB565, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA8, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_LINESTRIP, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SEMANTIC_ATTR, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, SEMANTIC_ATTR5, SEMANTIC_ATTR6, SEMANTIC_ATTR7, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, SHADERTAG_MATERIAL, STENCILOP_DECREMENT, STENCILOP_DECREMENTWRAP, STENCILOP_INCREMENT, STENCILOP_INCREMENTWRAP, STENCILOP_INVERT, STENCILOP_KEEP, STENCILOP_REPLACE, STENCILOP_ZERO, TEXHINT_ASSET, TEXHINT_LIGHTMAP, TEXHINT_NONE, TEXHINT_SHADOWMAP, TEXTUREDIMENSION_1D, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_2D_ARRAY, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_CUBE_ARRAY, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTUREPROJECTION_CUBE, TEXTUREPROJECTION_EQUIRECT, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_OCTAHEDRAL, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR, TYPE_FLOAT32, TYPE_INT16, TYPE_INT32, TYPE_INT8, TYPE_UINT16, TYPE_UINT32, TYPE_UINT8, UNIFORMTYPE_BOOL, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_INT, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT4ARRAY, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4, UNIFORMTYPE_VEC4ARRAY, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, bindGroupNames, getPixelFormatArrayType, isCompressedPixelFormat, pixelFormatInfo, semanticToLocation, typedArrayIndexFormats, typedArrayIndexFormatsByteSize, typedArrayToType, typedArrayTypes, typedArrayTypesByteSize, uniformTypeToName, vertexTypesNames };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSWdub3JlcyB0aGUgaW50ZWdlciBwYXJ0IG9mIHRleHR1cmUgY29vcmRpbmF0ZXMsIHVzaW5nIG9ubHkgdGhlIGZyYWN0aW9uYWwgcGFydC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQUREUkVTU19SRVBFQVQgPSAwO1xuXG4vKipcbiAqIENsYW1wcyB0ZXh0dXJlIGNvb3JkaW5hdGUgdG8gdGhlIHJhbmdlIDAgdG8gMS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQUREUkVTU19DTEFNUF9UT19FREdFID0gMTtcblxuLyoqXG4gKiBUZXh0dXJlIGNvb3JkaW5hdGUgdG8gYmUgc2V0IHRvIHRoZSBmcmFjdGlvbmFsIHBhcnQgaWYgdGhlIGludGVnZXIgcGFydCBpcyBldmVuLiBJZiB0aGUgaW50ZWdlclxuICogcGFydCBpcyBvZGQsIHRoZW4gdGhlIHRleHR1cmUgY29vcmRpbmF0ZSBpcyBzZXQgdG8gMSBtaW51cyB0aGUgZnJhY3Rpb25hbCBwYXJ0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCA9IDI7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgemVyby5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX1pFUk8gPSAwO1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IG9uZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORSA9IDE7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgdGhlIGNvbXBvbmVudHMgb2YgdGhlIHNvdXJjZSBmcmFnbWVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX1NSQ19DT0xPUiA9IDI7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgb25lIG1pbnVzIHRoZSBjb21wb25lbnRzIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SID0gMztcblxuLyoqXG4gKiBNdWx0aXBseSBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSB0aGUgY29tcG9uZW50cyBvZiB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9EU1RfQ09MT1IgPSA0O1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IG9uZSBtaW51cyB0aGUgY29tcG9uZW50cyBvZiB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SID0gNTtcblxuLyoqXG4gKiBNdWx0aXBseSBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSB0aGUgYWxwaGEgdmFsdWUgb2YgdGhlIHNvdXJjZSBmcmFnbWVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX1NSQ19BTFBIQSA9IDY7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgdGhlIGFscGhhIHZhbHVlIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEUgPSA3O1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IG9uZSBtaW51cyB0aGUgYWxwaGEgdmFsdWUgb2YgdGhlIHNvdXJjZSBmcmFnbWVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEgPSA4O1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IHRoZSBhbHBoYSB2YWx1ZSBvZiB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9EU1RfQUxQSEEgPSA5O1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IG9uZSBtaW51cyB0aGUgYWxwaGEgdmFsdWUgb2YgdGhlIGRlc3RpbmF0aW9uIGZyYWdtZW50LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSA9IDEwO1xuXG4vKipcbiAqIE11bHRpcGxpZXMgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgYSBjb25zdGFudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX0NPTlNUQU5UID0gMTE7XG5cbi8qKlxuICogTXVsdGlwbGllcyBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSAxIG1pbnVzIGEgY29uc3RhbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQgPSAxMjtcblxuLyoqXG4gKiBBZGQgdGhlIHJlc3VsdHMgb2YgdGhlIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gZnJhZ21lbnQgbXVsdGlwbGllcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRFUVVBVElPTl9BREQgPSAwO1xuXG4vKipcbiAqIFN1YnRyYWN0IHRoZSByZXN1bHRzIG9mIHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGZyYWdtZW50IG11bHRpcGxpZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ERVFVQVRJT05fU1VCVFJBQ1QgPSAxO1xuXG4vKipcbiAqIFJldmVyc2UgYW5kIHN1YnRyYWN0IHRoZSByZXN1bHRzIG9mIHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGZyYWdtZW50IG11bHRpcGxpZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ERVFVQVRJT05fUkVWRVJTRV9TVUJUUkFDVCA9IDI7XG5cbi8qKlxuICogVXNlIHRoZSBzbWFsbGVzdCB2YWx1ZS4gQ2hlY2sgYXBwLmdyYXBoaWNzRGV2aWNlLmV4dEJsZW5kTWlubWF4IGZvciBzdXBwb3J0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBCTEVOREVRVUFUSU9OX01JTiA9IDM7XG5cbi8qKlxuICogVXNlIHRoZSBsYXJnZXN0IHZhbHVlLiBDaGVjayBhcHAuZ3JhcGhpY3NEZXZpY2UuZXh0QmxlbmRNaW5tYXggZm9yIHN1cHBvcnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ERVFVQVRJT05fTUFYID0gNDtcblxuLyoqXG4gKiBUaGUgZGF0YSBzdG9yZSBjb250ZW50cyB3aWxsIGJlIG1vZGlmaWVkIG9uY2UgYW5kIHVzZWQgbWFueSB0aW1lcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQlVGRkVSX1NUQVRJQyA9IDA7XG5cbi8qKlxuICogVGhlIGRhdGEgc3RvcmUgY29udGVudHMgd2lsbCBiZSBtb2RpZmllZCByZXBlYXRlZGx5IGFuZCB1c2VkIG1hbnkgdGltZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJVRkZFUl9EWU5BTUlDID0gMTtcblxuLyoqXG4gKiBUaGUgZGF0YSBzdG9yZSBjb250ZW50cyB3aWxsIGJlIG1vZGlmaWVkIG9uY2UgYW5kIHVzZWQgYXQgbW9zdCBhIGZldyB0aW1lcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQlVGRkVSX1NUUkVBTSA9IDI7XG5cbi8qKlxuICogVGhlIGRhdGEgc3RvcmUgY29udGVudHMgd2lsbCBiZSBtb2RpZmllZCByZXBlYXRlZGx5IG9uIHRoZSBHUFUgYW5kIHVzZWQgbWFueSB0aW1lcy4gT3B0aW1hbCBmb3JcbiAqIHRyYW5zZm9ybSBmZWVkYmFjayB1c2FnZSAoV2ViR0wyIG9ubHkpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBCVUZGRVJfR1BVRFlOQU1JQyA9IDM7XG5cbi8qKlxuICogQ2xlYXIgdGhlIGNvbG9yIGJ1ZmZlci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ0xFQVJGTEFHX0NPTE9SID0gMTtcblxuLyoqXG4gKiBDbGVhciB0aGUgZGVwdGggYnVmZmVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDTEVBUkZMQUdfREVQVEggPSAyO1xuXG4vKipcbiAqIENsZWFyIHRoZSBzdGVuY2lsIGJ1ZmZlci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ0xFQVJGTEFHX1NURU5DSUwgPSA0O1xuXG4vKipcbiAqIFRoZSBwb3NpdGl2ZSBYIGZhY2Ugb2YgYSBjdWJlbWFwLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDVUJFRkFDRV9QT1NYID0gMDtcblxuLyoqXG4gKiBUaGUgbmVnYXRpdmUgWCBmYWNlIG9mIGEgY3ViZW1hcC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfTkVHWCA9IDE7XG5cbi8qKlxuICogVGhlIHBvc2l0aXZlIFkgZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IENVQkVGQUNFX1BPU1kgPSAyO1xuXG4vKipcbiAqIFRoZSBuZWdhdGl2ZSBZIGZhY2Ugb2YgYSBjdWJlbWFwLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDVUJFRkFDRV9ORUdZID0gMztcblxuLyoqXG4gKiBUaGUgcG9zaXRpdmUgWiBmYWNlIG9mIGEgY3ViZW1hcC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfUE9TWiA9IDQ7XG5cbi8qKlxuICogVGhlIG5lZ2F0aXZlIFogZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IENVQkVGQUNFX05FR1ogPSA1O1xuXG4vKipcbiAqIE5vIHRyaWFuZ2xlcyBhcmUgY3VsbGVkLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDVUxMRkFDRV9OT05FID0gMDtcblxuLyoqXG4gKiBUcmlhbmdsZXMgZmFjaW5nIGF3YXkgZnJvbSB0aGUgdmlldyBkaXJlY3Rpb24gYXJlIGN1bGxlZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ1VMTEZBQ0VfQkFDSyA9IDE7XG5cbi8qKlxuICogVHJpYW5nbGVzIGZhY2luZyB0aGUgdmlldyBkaXJlY3Rpb24gYXJlIGN1bGxlZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ1VMTEZBQ0VfRlJPTlQgPSAyO1xuXG4vKipcbiAqIFRyaWFuZ2xlcyBhcmUgY3VsbGVkIHJlZ2FyZGxlc3Mgb2YgdGhlaXIgb3JpZW50YXRpb24gd2l0aCByZXNwZWN0IHRvIHRoZSB2aWV3IGRpcmVjdGlvbi4gTm90ZVxuICogdGhhdCBwb2ludCBvciBsaW5lIHByaW1pdGl2ZXMgYXJlIHVuYWZmZWN0ZWQgYnkgdGhpcyByZW5kZXIgc3RhdGUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBpZ25vcmVcbiAqL1xuZXhwb3J0IGNvbnN0IENVTExGQUNFX0ZST05UQU5EQkFDSyA9IDM7XG5cbi8qKlxuICogUG9pbnQgc2FtcGxlIGZpbHRlcmluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX05FQVJFU1QgPSAwO1xuXG4vKipcbiAqIEJpbGluZWFyIGZpbHRlcmluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX0xJTkVBUiA9IDE7XG5cbi8qKlxuICogVXNlIHRoZSBuZWFyZXN0IG5laWdoYm9yIGluIHRoZSBuZWFyZXN0IG1pcG1hcCBsZXZlbC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QgPSAyO1xuXG4vKipcbiAqIExpbmVhcmx5IGludGVycG9sYXRlIGluIHRoZSBuZWFyZXN0IG1pcG1hcCBsZXZlbC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiA9IDM7XG5cbi8qKlxuICogVXNlIHRoZSBuZWFyZXN0IG5laWdoYm9yIGFmdGVyIGxpbmVhcmx5IGludGVycG9sYXRpbmcgYmV0d2VlbiBtaXBtYXAgbGV2ZWxzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUID0gNDtcblxuLyoqXG4gKiBMaW5lYXJseSBpbnRlcnBvbGF0ZSBib3RoIHRoZSBtaXBtYXAgbGV2ZWxzIGFuZCBiZXR3ZWVuIHRleGVscy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSID0gNTtcblxuLyoqXG4gKiBOZXZlciBwYXNzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBGVU5DX05FVkVSID0gMDtcblxuLyoqXG4gKiBQYXNzIGlmIChyZWYgJiBtYXNrKSA8IChzdGVuY2lsICYgbWFzaykuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEZVTkNfTEVTUyA9IDE7XG5cbi8qKlxuICogUGFzcyBpZiAocmVmICYgbWFzaykgPT0gKHN0ZW5jaWwgJiBtYXNrKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRlVOQ19FUVVBTCA9IDI7XG5cbi8qKlxuICogUGFzcyBpZiAocmVmICYgbWFzaykgPD0gKHN0ZW5jaWwgJiBtYXNrKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRlVOQ19MRVNTRVFVQUwgPSAzO1xuXG4vKipcbiAqIFBhc3MgaWYgKHJlZiAmIG1hc2spID4gKHN0ZW5jaWwgJiBtYXNrKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRlVOQ19HUkVBVEVSID0gNDtcblxuLyoqXG4gKiBQYXNzIGlmIChyZWYgJiBtYXNrKSAhPSAoc3RlbmNpbCAmIG1hc2spLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBGVU5DX05PVEVRVUFMID0gNTtcblxuLyoqXG4gKiBQYXNzIGlmIChyZWYgJiBtYXNrKSA+PSAoc3RlbmNpbCAmIG1hc2spLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBGVU5DX0dSRUFURVJFUVVBTCA9IDY7XG5cbi8qKlxuICogQWx3YXlzIHBhc3MuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEZVTkNfQUxXQVlTID0gNztcblxuLyoqXG4gKiA4LWJpdCB1bnNpZ25lZCB2ZXJ0ZXggaW5kaWNlcyAoMCB0byAyNTUpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBJTkRFWEZPUk1BVF9VSU5UOCA9IDA7XG5cbi8qKlxuICogMTYtYml0IHVuc2lnbmVkIHZlcnRleCBpbmRpY2VzICgwIHRvIDY1LDUzNSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IElOREVYRk9STUFUX1VJTlQxNiA9IDE7XG5cbi8qKlxuICogMzItYml0IHVuc2lnbmVkIHZlcnRleCBpbmRpY2VzICgwIHRvIDQsMjk0LDk2NywyOTUpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBJTkRFWEZPUk1BVF9VSU5UMzIgPSAyO1xuXG4vKipcbiAqIDgtYml0IGFscGhhLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9BOCA9IDA7XG5cbi8qKlxuICogOC1iaXQgbHVtaW5hbmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9MOCA9IDE7XG5cbi8qKlxuICogOC1iaXQgbHVtaW5hbmNlIHdpdGggOC1iaXQgYWxwaGEuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0xBOCA9IDI7XG5cbi8qKlxuICogMTYtYml0IFJHQiAoNS1iaXRzIGZvciByZWQgY2hhbm5lbCwgNiBmb3IgZ3JlZW4gYW5kIDUgZm9yIGJsdWUpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0I1NjUgPSAzO1xuXG4vKipcbiAqIDE2LWJpdCBSR0JBICg1LWJpdHMgZm9yIHJlZCBjaGFubmVsLCA1IGZvciBncmVlbiwgNSBmb3IgYmx1ZSB3aXRoIDEtYml0IGFscGhhKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTU1NTEgPSA0O1xuXG4vKipcbiAqIDE2LWJpdCBSR0JBICg0LWJpdHMgZm9yIHJlZCBjaGFubmVsLCA0IGZvciBncmVlbiwgNCBmb3IgYmx1ZSB3aXRoIDQtYml0IGFscGhhKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTQgPSA1O1xuXG4vKipcbiAqIDI0LWJpdCBSR0IgKDgtYml0cyBmb3IgcmVkIGNoYW5uZWwsIDggZm9yIGdyZWVuIGFuZCA4IGZvciBibHVlKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCOCA9IDY7XG5cbi8qKlxuICogMzItYml0IFJHQkEgKDgtYml0cyBmb3IgcmVkIGNoYW5uZWwsIDggZm9yIGdyZWVuLCA4IGZvciBibHVlIHdpdGggOC1iaXQgYWxwaGEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0JBOCA9IDc7XG5cbi8qKlxuICogQmxvY2sgY29tcHJlc3NlZCBmb3JtYXQgc3RvcmluZyAxNiBpbnB1dCBwaXhlbHMgaW4gNjQgYml0cyBvZiBvdXRwdXQsIGNvbnNpc3Rpbmcgb2YgdHdvIDE2LWJpdFxuICogUkdCIDU6Njo1IGNvbG9yIHZhbHVlcyBhbmQgYSA0eDQgdHdvIGJpdCBsb29rdXAgdGFibGUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0RYVDEgPSA4O1xuXG4vKipcbiAqIEJsb2NrIGNvbXByZXNzZWQgZm9ybWF0IHN0b3JpbmcgMTYgaW5wdXQgcGl4ZWxzIChjb3JyZXNwb25kaW5nIHRvIGEgNHg0IHBpeGVsIGJsb2NrKSBpbnRvIDEyOFxuICogYml0cyBvZiBvdXRwdXQsIGNvbnNpc3Rpbmcgb2YgNjQgYml0cyBvZiBhbHBoYSBjaGFubmVsIGRhdGEgKDQgYml0cyBmb3IgZWFjaCBwaXhlbCkgZm9sbG93ZWQgYnlcbiAqIDY0IGJpdHMgb2YgY29sb3IgZGF0YTsgZW5jb2RlZCB0aGUgc2FtZSB3YXkgYXMgRFhUMS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfRFhUMyA9IDk7XG5cbi8qKlxuICogQmxvY2sgY29tcHJlc3NlZCBmb3JtYXQgc3RvcmluZyAxNiBpbnB1dCBwaXhlbHMgaW50byAxMjggYml0cyBvZiBvdXRwdXQsIGNvbnNpc3Rpbmcgb2YgNjQgYml0c1xuICogb2YgYWxwaGEgY2hhbm5lbCBkYXRhICh0d28gOCBiaXQgYWxwaGEgdmFsdWVzIGFuZCBhIDR4NCAzIGJpdCBsb29rdXAgdGFibGUpIGZvbGxvd2VkIGJ5IDY0IGJpdHNcbiAqIG9mIGNvbG9yIGRhdGEgKGVuY29kZWQgdGhlIHNhbWUgd2F5IGFzIERYVDEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9EWFQ1ID0gMTA7XG5cbi8qKlxuICogMTYtYml0IGZsb2F0aW5nIHBvaW50IFJHQiAoMTYtYml0IGZsb2F0IGZvciBlYWNoIHJlZCwgZ3JlZW4gYW5kIGJsdWUgY2hhbm5lbHMpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0IxNkYgPSAxMTtcblxuLyoqXG4gKiAxNi1iaXQgZmxvYXRpbmcgcG9pbnQgUkdCQSAoMTYtYml0IGZsb2F0IGZvciBlYWNoIHJlZCwgZ3JlZW4sIGJsdWUgYW5kIGFscGhhIGNoYW5uZWxzKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTE2RiA9IDEyO1xuXG4vKipcbiAqIDMyLWJpdCBmbG9hdGluZyBwb2ludCBSR0IgKDMyLWJpdCBmbG9hdCBmb3IgZWFjaCByZWQsIGdyZWVuIGFuZCBibHVlIGNoYW5uZWxzKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCMzJGID0gMTM7XG5cbi8qKlxuICogMzItYml0IGZsb2F0aW5nIHBvaW50IFJHQkEgKDMyLWJpdCBmbG9hdCBmb3IgZWFjaCByZWQsIGdyZWVuLCBibHVlIGFuZCBhbHBoYSBjaGFubmVscykuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1JHQkEzMkYgPSAxNDtcblxuLyoqXG4gKiAzMi1iaXQgZmxvYXRpbmcgcG9pbnQgc2luZ2xlIGNoYW5uZWwgZm9ybWF0IChXZWJHTDIgb25seSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1IzMkYgPSAxNTtcblxuLyoqXG4gKiBBIHJlYWRhYmxlIGRlcHRoIGJ1ZmZlciBmb3JtYXQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0RFUFRIID0gMTY7XG5cbi8qKlxuICogQSByZWFkYWJsZSBkZXB0aC9zdGVuY2lsIGJ1ZmZlciBmb3JtYXQgKFdlYkdMMiBvbmx5KS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMID0gMTc7XG5cbi8qKlxuICogQSBmbG9hdGluZy1wb2ludCBjb2xvci1vbmx5IGZvcm1hdCB3aXRoIDExIGJpdHMgZm9yIHJlZCBhbmQgZ3JlZW4gY2hhbm5lbHMgYW5kIDEwIGJpdHMgZm9yIHRoZVxuICogYmx1ZSBjaGFubmVsIChXZWJHTDIgb25seSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUXzExMTExMEYgPSAxODtcblxuLyoqXG4gKiBDb2xvci1vbmx5IHNSR0IgZm9ybWF0IChXZWJHTDIgb25seSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1NSR0IgPSAxOTtcblxuLyoqXG4gKiBDb2xvciBzUkdCIGZvcm1hdCB3aXRoIGFkZGl0aW9uYWwgYWxwaGEgY2hhbm5lbCAoV2ViR0wyIG9ubHkpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9TUkdCQSA9IDIwO1xuXG4vKipcbiAqIEVUQzEgY29tcHJlc3NlZCBmb3JtYXQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0VUQzEgPSAyMTtcblxuLyoqXG4gKiBFVEMyIChSR0IpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9FVEMyX1JHQiA9IDIyO1xuXG4vKipcbiAqIEVUQzIgKFJHQkEpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9FVEMyX1JHQkEgPSAyMztcblxuLyoqXG4gKiBQVlJUQyAoMkJQUCBSR0IpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xID0gMjQ7XG5cbi8qKlxuICogUFZSVEMgKDJCUFAgUkdCQSkgY29tcHJlc3NlZCBmb3JtYXQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xID0gMjU7XG5cbi8qKlxuICogUFZSVEMgKDRCUFAgUkdCKSBjb21wcmVzc2VkIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSA9IDI2O1xuXG4vKipcbiAqIFBWUlRDICg0QlBQIFJHQkEpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSA9IDI3O1xuXG4vKipcbiAqIEFUQyBjb21wcmVzc2VkIGZvcm1hdCB3aXRoIGFscGhhIGNoYW5uZWwgaW4gYmxvY2tzIG9mIDR4NC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfQVNUQ180eDQgPSAyODtcblxuLyoqXG4gKiBBVEMgY29tcHJlc3NlZCBmb3JtYXQgd2l0aCBubyBhbHBoYSBjaGFubmVsLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9BVENfUkdCID0gMjk7XG5cbi8qKlxuICogQVRDIGNvbXByZXNzZWQgZm9ybWF0IHdpdGggYWxwaGEgY2hhbm5lbC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfQVRDX1JHQkEgPSAzMDtcblxuLyoqXG4gKiAzMi1iaXQgQkdSQSAoOC1iaXRzIGZvciBibHVlIGNoYW5uZWwsIDggZm9yIGdyZWVuLCA4IGZvciByZWQgd2l0aCA4LWJpdCBhbHBoYSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBpZ25vcmVcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0JHUkE4ID0gMzE7XG5cbi8vIG1hcCBvZiBlbmdpbmUgUElYRUxGT1JNQVRfKioqIGVudW1zIHRvIGluZm9ybWF0aW9uIGFib3V0IHRoZSBmb3JtYXRcbmV4cG9ydCBjb25zdCBwaXhlbEZvcm1hdEluZm8gPSBuZXcgTWFwKFtcblxuICAgIC8vIHVuY29tcHJlc3NlZCBmb3JtYXRzXG4gICAgW1BJWEVMRk9STUFUX0E4LCAgICAgICAgICAgIHsgbmFtZTogJ0E4Jywgc2l6ZTogMSB9XSxcbiAgICBbUElYRUxGT1JNQVRfTDgsICAgICAgICAgICAgeyBuYW1lOiAnTDgnLCBzaXplOiAxIH1dLFxuICAgIFtQSVhFTEZPUk1BVF9MQTgsICAgICAgICAgICB7IG5hbWU6ICdMQTgnLCBzaXplOiAyIH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SR0I1NjUsICAgICAgICB7IG5hbWU6ICdSR0I1NjUnLCBzaXplOiAyIH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SR0JBNTU1MSwgICAgICB7IG5hbWU6ICdSR0JBNTU1MScsIHNpemU6IDIgfV0sXG4gICAgW1BJWEVMRk9STUFUX1JHQkE0LCAgICAgICAgIHsgbmFtZTogJ1JHQkE0Jywgc2l6ZTogMiB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkdCOCwgICAgICAgICAgeyBuYW1lOiAnUkdCOCcsIHNpemU6IDQgfV0sXG4gICAgW1BJWEVMRk9STUFUX1JHQkE4LCAgICAgICAgIHsgbmFtZTogJ1JHQkE4Jywgc2l6ZTogNCB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkdCMTZGLCAgICAgICAgeyBuYW1lOiAnUkdCMTZGJywgc2l6ZTogOCB9XSxcbiAgICBbUElYRUxGT1JNQVRfUkdCQTE2RiwgICAgICAgeyBuYW1lOiAnUkdCQTE2RicsIHNpemU6IDggfV0sXG4gICAgW1BJWEVMRk9STUFUX1JHQjMyRiwgICAgICAgIHsgbmFtZTogJ1JHQjMyRicsIHNpemU6IDE2IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9SR0JBMzJGLCAgICAgICB7IG5hbWU6ICdSR0JBMzJGJywgc2l6ZTogMTYgfV0sXG4gICAgW1BJWEVMRk9STUFUX1IzMkYsICAgICAgICAgIHsgbmFtZTogJ1IzMkYnLCBzaXplOiA0IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9ERVBUSCwgICAgICAgICB7IG5hbWU6ICdERVBUSCcsIHNpemU6IDQgfV0sXG4gICAgW1BJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCwgIHsgbmFtZTogJ0RFUFRIU1RFTkNJTCcsIHNpemU6IDQgfV0sXG4gICAgW1BJWEVMRk9STUFUXzExMTExMEYsICAgICAgIHsgbmFtZTogJzExMTExMEYnLCBzaXplOiA0IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9TUkdCLCAgICAgICAgICB7IG5hbWU6ICdTUkdCJywgc2l6ZTogNCB9XSxcbiAgICBbUElYRUxGT1JNQVRfU1JHQkEsICAgICAgICAgeyBuYW1lOiAnU1JHQkEnLCBzaXplOiA0IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9CR1JBOCwgICAgICAgICB7IG5hbWU6ICdCR1JBOCcsIHNpemU6IDQgfV0sXG5cbiAgICAvLyBjb21wcmVzc2VkIGZvcm1hdHNcbiAgICBbUElYRUxGT1JNQVRfRFhUMSwgeyBuYW1lOiAnRFhUMScsIGJsb2NrU2l6ZTogOCB9XSxcbiAgICBbUElYRUxGT1JNQVRfRFhUMywgeyBuYW1lOiAnRFhUMycsIGJsb2NrU2l6ZTogMTYgfV0sXG4gICAgW1BJWEVMRk9STUFUX0RYVDUsIHsgbmFtZTogJ0RYVDUnLCBibG9ja1NpemU6IDE2IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9FVEMxLCB7IG5hbWU6ICdFVEMxJywgYmxvY2tTaXplOiA4IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9FVEMyX1JHQiwgeyBuYW1lOiAnRVRDMl9SR0InLCBibG9ja1NpemU6IDggfV0sXG4gICAgW1BJWEVMRk9STUFUX0VUQzJfUkdCQSwgeyBuYW1lOiAnRVRDMl9SR0JBJywgYmxvY2tTaXplOiAxNiB9XSxcbiAgICBbUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JfMSwgeyBuYW1lOiAnUFZSVENfMkJQUF9SR0JfMScsIGJsb2NrU2l6ZTogOCB9XSxcbiAgICBbUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEsIHsgbmFtZTogJ1BWUlRDXzJCUFBfUkdCQV8xJywgYmxvY2tTaXplOiA4IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xLCB7IG5hbWU6ICdQVlJUQ180QlBQX1JHQl8xJywgYmxvY2tTaXplOiA4IH1dLFxuICAgIFtQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSwgeyBuYW1lOiAnUFZSVENfNEJQUF9SR0JBXzEnLCBibG9ja1NpemU6IDggfV0sXG4gICAgW1BJWEVMRk9STUFUX0FTVENfNHg0LCB7IG5hbWU6ICdBU1RDXzR4NCcsIGJsb2NrU2l6ZTogMTYgfV0sXG4gICAgW1BJWEVMRk9STUFUX0FUQ19SR0IsIHsgbmFtZTogJ0FUQ19SR0InLCBibG9ja1NpemU6IDggfV0sXG4gICAgW1BJWEVMRk9STUFUX0FUQ19SR0JBLCB7IG5hbWU6ICdBVENfUkdCQScsIGJsb2NrU2l6ZTogMTYgfV1cbl0pO1xuXG4vLyB1cGRhdGUgdGhpcyBmdW5jdGlvbiB3aGVuIGV4cG9zaW5nIGFkZGl0aW9uYWwgY29tcHJlc3NlZCBwaXhlbCBmb3JtYXRzXG5leHBvcnQgY29uc3QgaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQgPSAoZm9ybWF0KSA9PiB7XG4gICAgcmV0dXJuIHBpeGVsRm9ybWF0SW5mby5nZXQoZm9ybWF0KS5ibG9ja1NpemUgIT09IHVuZGVmaW5lZDtcbn07XG5cbi8vIGdldCB0aGUgcGl4ZWwgZm9ybWF0IGFycmF5IHR5cGVcbmV4cG9ydCBjb25zdCBnZXRQaXhlbEZvcm1hdEFycmF5VHlwZSA9IChmb3JtYXQpID0+IHtcbiAgICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQjMyRjpcbiAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0JBMzJGOlxuICAgICAgICAgICAgcmV0dXJuIEZsb2F0MzJBcnJheTtcbiAgICAgICAgY2FzZSBQSVhFTEZPUk1BVF9SR0I1NjU6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTU1NTE6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCQTQ6XG4gICAgICAgIGNhc2UgUElYRUxGT1JNQVRfUkdCMTZGOlxuICAgICAgICBjYXNlIFBJWEVMRk9STUFUX1JHQkExNkY6XG4gICAgICAgICAgICByZXR1cm4gVWludDE2QXJyYXk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICByZXR1cm4gVWludDhBcnJheTtcbiAgICB9XG59O1xuXG4vKipcbiAqIExpc3Qgb2YgZGlzdGluY3QgcG9pbnRzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQUklNSVRJVkVfUE9JTlRTID0gMDtcblxuLyoqXG4gKiBEaXNjcmV0ZSBsaXN0IG9mIGxpbmUgc2VnbWVudHMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBSSU1JVElWRV9MSU5FUyA9IDE7XG5cbi8qKlxuICogTGlzdCBvZiBwb2ludHMgdGhhdCBhcmUgbGlua2VkIHNlcXVlbnRpYWxseSBieSBsaW5lIHNlZ21lbnRzLCB3aXRoIGEgY2xvc2luZyBsaW5lIHNlZ21lbnRcbiAqIGJldHdlZW4gdGhlIGxhc3QgYW5kIGZpcnN0IHBvaW50cy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUFJJTUlUSVZFX0xJTkVMT09QID0gMjtcblxuLyoqXG4gKiBMaXN0IG9mIHBvaW50cyB0aGF0IGFyZSBsaW5rZWQgc2VxdWVudGlhbGx5IGJ5IGxpbmUgc2VnbWVudHMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBSSU1JVElWRV9MSU5FU1RSSVAgPSAzO1xuXG4vKipcbiAqIERpc2NyZXRlIGxpc3Qgb2YgdHJpYW5nbGVzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQUklNSVRJVkVfVFJJQU5HTEVTID0gNDtcblxuLyoqXG4gKiBDb25uZWN0ZWQgc3RyaXAgb2YgdHJpYW5nbGVzIHdoZXJlIGEgc3BlY2lmaWVkIHZlcnRleCBmb3JtcyBhIHRyaWFuZ2xlIHVzaW5nIHRoZSBwcmV2aW91cyB0d28uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBSSU1JVElWRV9UUklTVFJJUCA9IDU7XG5cbi8qKlxuICogQ29ubmVjdGVkIGZhbiBvZiB0cmlhbmdsZXMgd2hlcmUgdGhlIGZpcnN0IHZlcnRleCBmb3JtcyB0cmlhbmdsZXMgd2l0aCB0aGUgZm9sbG93aW5nIHBhaXJzIG9mIHZlcnRpY2VzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQUklNSVRJVkVfVFJJRkFOID0gNjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHRvIGJlIHRyZWF0ZWQgYXMgYSBwb3NpdGlvbi5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfUE9TSVRJT04gPSBcIlBPU0lUSU9OXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgbm9ybWFsLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19OT1JNQUwgPSBcIk5PUk1BTFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRhbmdlbnQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RBTkdFTlQgPSBcIlRBTkdFTlRcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHRvIGJlIHRyZWF0ZWQgYXMgc2tpbiBibGVuZCB3ZWlnaHRzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19CTEVORFdFSUdIVCA9IFwiQkxFTkRXRUlHSFRcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHRvIGJlIHRyZWF0ZWQgYXMgc2tpbiBibGVuZCBpbmRpY2VzLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19CTEVORElORElDRVMgPSBcIkJMRU5ESU5ESUNFU1wiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIGNvbG9yLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19DT0xPUiA9IFwiQ09MT1JcIjtcblxuLy8gcHJpdmF0ZSBzZW1hbnRpYyB1c2VkIGZvciBwcm9ncmFtbWF0aWMgY29uc3RydWN0aW9uIG9mIGluZGl2aWR1YWwgdGV4Y29vcmQgc2VtYW50aWNzXG5leHBvcnQgY29uc3QgU0VNQU5USUNfVEVYQ09PUkQgPSBcIlRFWENPT1JEXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgMCkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JEMCA9IFwiVEVYQ09PUkQwXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgMSkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JEMSA9IFwiVEVYQ09PUkQxXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgMikuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JEMiA9IFwiVEVYQ09PUkQyXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgMykuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JEMyA9IFwiVEVYQ09PUkQzXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgNCkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JENCA9IFwiVEVYQ09PUkQ0XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgNSkuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JENSA9IFwiVEVYQ09PUkQ1XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgNikuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JENiA9IFwiVEVYQ09PUkQ2XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgdGV4dHVyZSBjb29yZGluYXRlIChzZXQgNykuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JENyA9IFwiVEVYQ09PUkQ3XCI7XG5cbi8vIHByaXZhdGUgc2VtYW50aWMgdXNlZCBmb3IgcHJvZ3JhbW1hdGljIGNvbnN0cnVjdGlvbiBvZiBpbmRpdmlkdWFsIGF0dHIgc2VtYW50aWNzXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUiA9IFwiQVRUUlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjAgPSBcIkFUVFIwXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMSA9IFwiQVRUUjFcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIyID0gXCJBVFRSMlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjMgPSBcIkFUVFIzXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSNCA9IFwiQVRUUjRcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFI1ID0gXCJBVFRSNVwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjYgPSBcIkFUVFI2XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSNyA9IFwiQVRUUjdcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFI4ID0gXCJBVFRSOFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjkgPSBcIkFUVFI5XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTAgPSBcIkFUVFIxMFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjExID0gXCJBVFRSMTFcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIxMiA9IFwiQVRUUjEyXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTMgPSBcIkFUVFIxM1wiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjE0ID0gXCJBVFRSMTRcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIxNSA9IFwiQVRUUjE1XCI7XG5cbmV4cG9ydCBjb25zdCBTSEFERVJUQUdfTUFURVJJQUwgPSAxO1xuXG4vKipcbiAqIERvbid0IGNoYW5nZSB0aGUgc3RlbmNpbCBidWZmZXIgdmFsdWUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNURU5DSUxPUF9LRUVQID0gMDtcblxuLyoqXG4gKiBTZXQgdmFsdWUgdG8gemVyby5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU1RFTkNJTE9QX1pFUk8gPSAxO1xuXG4vKipcbiAqIFJlcGxhY2UgdmFsdWUgd2l0aCB0aGUgcmVmZXJlbmNlIHZhbHVlIChzZWUge0BsaW5rIFN0ZW5jaWxQYXJhbWV0ZXJzfSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNURU5DSUxPUF9SRVBMQUNFID0gMjtcblxuLyoqXG4gKiBJbmNyZW1lbnQgdGhlIHZhbHVlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfSU5DUkVNRU5UID0gMztcblxuLyoqXG4gKiBJbmNyZW1lbnQgdGhlIHZhbHVlIGJ1dCB3cmFwIGl0IHRvIHplcm8gd2hlbiBpdCdzIGxhcmdlciB0aGFuIGEgbWF4aW11bSByZXByZXNlbnRhYmxlIHZhbHVlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfSU5DUkVNRU5UV1JBUCA9IDQ7XG5cbi8qKlxuICogRGVjcmVtZW50IHRoZSB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU1RFTkNJTE9QX0RFQ1JFTUVOVCA9IDU7XG5cbi8qKlxuICogRGVjcmVtZW50IHRoZSB2YWx1ZSBidXQgd3JhcCBpdCB0byBhIG1heGltdW0gcmVwcmVzZW50YWJsZSB2YWx1ZSBpZiB0aGUgY3VycmVudCB2YWx1ZSBpcyAwLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUCA9IDY7XG5cbi8qKlxuICogSW52ZXJ0IHRoZSB2YWx1ZSBiaXR3aXNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfSU5WRVJUID0gNztcblxuLyoqXG4gKiBSZWFkIG9ubHkuIEFueSBjaGFuZ2VzIHRvIHRoZSBsb2NrZWQgbWlwIGxldmVsJ3MgcGl4ZWxzIHdpbGwgbm90IHVwZGF0ZSB0aGUgdGV4dHVyZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRUxPQ0tfUkVBRCA9IDE7XG5cbi8qKlxuICogV3JpdGUgb25seS4gVGhlIGNvbnRlbnRzIG9mIHRoZSBzcGVjaWZpZWQgbWlwIGxldmVsIHdpbGwgYmUgZW50aXJlbHkgcmVwbGFjZWQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVMT0NLX1dSSVRFID0gMjtcblxuLyoqXG4gKiBUZXh0dXJlIGlzIGEgZGVmYXVsdCB0eXBlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFVFlQRV9ERUZBVUxUID0gJ2RlZmF1bHQnO1xuXG4vKipcbiAqIFRleHR1cmUgc3RvcmVzIGhpZ2ggZHluYW1pYyByYW5nZSBkYXRhIGluIFJHQk0gZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFVFlQRV9SR0JNID0gJ3JnYm0nO1xuXG4vKipcbiAqIFRleHR1cmUgc3RvcmVzIGhpZ2ggZHluYW1pYyByYW5nZSBkYXRhIGluIFJHQkUgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFVFlQRV9SR0JFID0gJ3JnYmUnO1xuXG4vKipcbiAqIFRleHR1cmUgc3RvcmVzIGhpZ2ggZHluYW1pYyByYW5nZSBkYXRhIGluIFJHQlAgZW5jb2RpbmcuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVUWVBFX1JHQlAgPSAncmdicCc7XG5cbi8qKlxuICogVGV4dHVyZSBzdG9yZXMgbm9ybWFsbWFwIGRhdGEgc3dpenpsZWQgaW4gR0dHUiBmb3JtYXQuIFRoaXMgaXMgdXNlZCBmb3IgdGFuZ2VudCBzcGFjZSBub3JtYWxcbiAqIG1hcHMuIFRoZSBSIGNvbXBvbmVudCBpcyBzdG9yZWQgaW4gYWxwaGEgYW5kIEcgaXMgc3RvcmVkIGluIFJHQi4gVGhpcyBwYWNraW5nIGNhbiByZXN1bHQgaW5cbiAqIGhpZ2hlciBxdWFsaXR5IHdoZW4gdGhlIHRleHR1cmUgZGF0YSBpcyBjb21wcmVzc2VkLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFVFlQRV9TV0laWkxFR0dHUiA9ICdzd2l6emxlR0dHUic7XG5cbmV4cG9ydCBjb25zdCBURVhISU5UX05PTkUgPSAwO1xuZXhwb3J0IGNvbnN0IFRFWEhJTlRfU0hBRE9XTUFQID0gMTtcbmV4cG9ydCBjb25zdCBURVhISU5UX0FTU0VUID0gMjtcbmV4cG9ydCBjb25zdCBURVhISU5UX0xJR0hUTUFQID0gMztcblxuZXhwb3J0IGNvbnN0IFRFWFRVUkVESU1FTlNJT05fMUQgPSAnMWQnO1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVESU1FTlNJT05fMkQgPSAnMmQnO1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVESU1FTlNJT05fMkRfQVJSQVkgPSAnMmQtYXJyYXknO1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVESU1FTlNJT05fQ1VCRSA9ICdjdWJlJztcbmV4cG9ydCBjb25zdCBURVhUVVJFRElNRU5TSU9OX0NVQkVfQVJSQVkgPSAnY3ViZS1hcnJheSc7XG5leHBvcnQgY29uc3QgVEVYVFVSRURJTUVOU0lPTl8zRCA9ICczZCc7XG5cbmV4cG9ydCBjb25zdCBTQU1QTEVUWVBFX0ZMT0FUID0gMDtcbmV4cG9ydCBjb25zdCBTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCA9IDE7XG5leHBvcnQgY29uc3QgU0FNUExFVFlQRV9ERVBUSCA9IDI7XG5cbi8qKlxuICogVGV4dHVyZSBkYXRhIGlzIG5vdCBzdG9yZWQgYSBzcGVjaWZpYyBwcm9qZWN0aW9uIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRVBST0pFQ1RJT05fTk9ORSA9IFwibm9uZVwiO1xuXG4vKipcbiAqIFRleHR1cmUgZGF0YSBpcyBzdG9yZWQgaW4gY3ViZW1hcCBwcm9qZWN0aW9uIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSA9IFwiY3ViZVwiO1xuXG4vKipcbiAqIFRleHR1cmUgZGF0YSBpcyBzdG9yZWQgaW4gZXF1aXJlY3Rhbmd1bGFyIHByb2plY3Rpb24gZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFUFJPSkVDVElPTl9FUVVJUkVDVCA9IFwiZXF1aXJlY3RcIjtcblxuLyoqXG4gKiBUZXh0dXJlIGRhdGEgaXMgc3RvcmVkIGluIG9jdGFoZWRyYWwgcHJvamVjdGlvbiBmb3JtYXQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVQUk9KRUNUSU9OX09DVEFIRURSQUwgPSBcIm9jdGFoZWRyYWxcIjtcblxuLyoqXG4gKiBTaGFkZXIgc291cmNlIGNvZGUgdXNlcyBHTFNMIGxhbmd1YWdlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTSEFERVJMQU5HVUFHRV9HTFNMID0gJ2dsc2wnO1xuXG4vKipcbiAqIFNoYWRlciBzb3VyY2UgY29kZSB1c2VzIFdHU0wgbGFuZ3VhZ2UuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNIQURFUkxBTkdVQUdFX1dHU0wgPSAnd2dzbCc7XG5cbi8qKlxuICogU2lnbmVkIGJ5dGUgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVFlQRV9JTlQ4ID0gMDtcblxuLyoqXG4gKiBVbnNpZ25lZCBieXRlIHZlcnRleCBlbGVtZW50IHR5cGUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFRZUEVfVUlOVDggPSAxO1xuXG4vKipcbiAqIFNpZ25lZCBzaG9ydCB2ZXJ0ZXggZWxlbWVudCB0eXBlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBUWVBFX0lOVDE2ID0gMjtcblxuLyoqXG4gKiBVbnNpZ25lZCBzaG9ydCB2ZXJ0ZXggZWxlbWVudCB0eXBlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBUWVBFX1VJTlQxNiA9IDM7XG5cbi8qKlxuICogU2lnbmVkIGludGVnZXIgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVFlQRV9JTlQzMiA9IDQ7XG5cbi8qKlxuICogVW5zaWduZWQgaW50ZWdlciB2ZXJ0ZXggZWxlbWVudCB0eXBlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBUWVBFX1VJTlQzMiA9IDU7XG5cbi8qKlxuICogRmxvYXRpbmcgcG9pbnQgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVFlQRV9GTE9BVDMyID0gNjtcblxuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0JPT0wgPSAwO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lOVCA9IDE7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfRkxPQVQgPSAyO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzIgPSAzO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzMgPSA0O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzQgPSA1O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lWRUMyID0gNjtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9JVkVDMyA9IDc7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfSVZFQzQgPSA4O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0JWRUMyID0gOTtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9CVkVDMyA9IDEwO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0JWRUM0ID0gMTE7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfTUFUMiA9IDEyO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX01BVDMgPSAxMztcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9NQVQ0ID0gMTQ7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfVEVYVFVSRTJEID0gMTU7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfVEVYVFVSRUNVQkUgPSAxNjtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9GTE9BVEFSUkFZID0gMTc7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfVEVYVFVSRTJEX1NIQURPVyA9IDE4O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVyA9IDE5O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1RFWFRVUkUzRCA9IDIwO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzJBUlJBWSA9IDIxO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzNBUlJBWSA9IDIyO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1ZFQzRBUlJBWSA9IDIzO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX01BVDRBUlJBWSA9IDI0O1xuXG5leHBvcnQgY29uc3QgdW5pZm9ybVR5cGVUb05hbWUgPSBbXG4gICAgJ2Jvb2wnLFxuICAgICdpbnQnLFxuICAgICdmbG9hdCcsXG4gICAgJ3ZlYzInLFxuICAgICd2ZWMzJyxcbiAgICAndmVjNCcsXG4gICAgJ2l2ZWMyJyxcbiAgICAnaXZlYzMnLFxuICAgICdpdmVjNCcsXG4gICAgJ2JlYzInLFxuICAgICdiZWMzJyxcbiAgICAnYmVjNCcsXG4gICAgJ21hdDInLFxuICAgICdtYXQzJyxcbiAgICAnbWF0NCcsXG4gICAgJ3NhbXBsZXIyRCcsXG4gICAgJ3NhbXBsZXJDdWJlJyxcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX0ZMT0FUQVJSQVlcbiAgICAnc2FtcGxlcjJEU2hhZG93JyxcbiAgICAnc2FtcGxlckN1YmVTaGFkb3cnLFxuICAgICdzYW1wbGVyM0QnLFxuICAgICcnLCAvLyBub3QgZGlyZWN0bHkgaGFuZGxlZDogVU5JRk9STVRZUEVfVkVDMkFSUkFZXG4gICAgJycsIC8vIG5vdCBkaXJlY3RseSBoYW5kbGVkOiBVTklGT1JNVFlQRV9WRUMzQVJSQVlcbiAgICAnJyAvLyBub3QgZGlyZWN0bHkgaGFuZGxlZDogVU5JRk9STVRZUEVfVkVDNEFSUkFZXG5dO1xuXG4vKipcbiAqIEEgV2ViR0wgMSBkZXZpY2UgdHlwZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgREVWSUNFVFlQRV9XRUJHTDEgPSAnd2ViZ2wxJztcblxuLyoqXG4gKiBBIFdlYkdMIDIgZGV2aWNlIHR5cGUuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IERFVklDRVRZUEVfV0VCR0wyID0gJ3dlYmdsMic7XG5cbi8qKlxuICogQSBXZWJHUFUgZGV2aWNlIHR5cGUuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IERFVklDRVRZUEVfV0VCR1BVID0gJ3dlYmdwdSc7XG5cbi8vIChiaXQtZmxhZ3MpIHNoYWRlciBzdGFnZXMgZm9yIHJlc291cmNlIHZpc2liaWxpdHkgb24gdGhlIEdQVVxuZXhwb3J0IGNvbnN0IFNIQURFUlNUQUdFX1ZFUlRFWCA9IDE7XG5leHBvcnQgY29uc3QgU0hBREVSU1RBR0VfRlJBR01FTlQgPSAyO1xuZXhwb3J0IGNvbnN0IFNIQURFUlNUQUdFX0NPTVBVVEUgPSA0O1xuXG4vLyBpbmRpY2VzIG9mIGNvbW1vbmx5IHVzZWQgYmluZCBncm91cHNcbi8vIHNvcnRlZCBpbiBhIHdheSB0aGF0IGFueSB0cmFpbGluZyBiaW5kIGdyb3VwcyBjYW4gYmUgdW51c2VkIGluIGFueSByZW5kZXIgcGFzc1xuZXhwb3J0IGNvbnN0IEJJTkRHUk9VUF9NRVNIID0gMDtcbmV4cG9ydCBjb25zdCBCSU5ER1JPVVBfVklFVyA9IDE7XG5cbi8vIG5hbWVzIG9mIGJpbmQgZ3JvdXBzXG5leHBvcnQgY29uc3QgYmluZEdyb3VwTmFtZXMgPSBbJ21lc2gnLCAndmlldyddO1xuXG4vLyBuYW1lIG9mIHRoZSBkZWZhdWx0IHVuaWZvcm0gYnVmZmVyIHNsb3QgaW4gYSBiaW5kIGdyb3VwXG5leHBvcnQgY29uc3QgVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUgPSAnZGVmYXVsdCc7XG5cbi8vIG1hcCBvZiBlbmdpbmUgVFlQRV8qKiogZW51bXMgdG8gdGhlaXIgY29ycmVzcG9uZGluZyB0eXBlZCBhcnJheSBjb25zdHJ1Y3RvcnMgYW5kIGJ5dGUgc2l6ZXNcbmV4cG9ydCBjb25zdCB0eXBlZEFycmF5VHlwZXMgPSBbSW50OEFycmF5LCBVaW50OEFycmF5LCBJbnQxNkFycmF5LCBVaW50MTZBcnJheSwgSW50MzJBcnJheSwgVWludDMyQXJyYXksIEZsb2F0MzJBcnJheV07XG5leHBvcnQgY29uc3QgdHlwZWRBcnJheVR5cGVzQnl0ZVNpemUgPSBbMSwgMSwgMiwgMiwgNCwgNCwgNF07XG5leHBvcnQgY29uc3QgdmVydGV4VHlwZXNOYW1lcyA9IFsnSU5UOCcsICdVSU5UOCcsICdJTlQxNicsICdVSU5UMTYnLCAnSU5UMzInLCAnVUlOVDMyJywgJ0ZMT0FUMzInXTtcblxuLy8gbWFwIG9mIHR5cGVkIGFycmF5IHRvIGVuZ2luZSBUWVBFXyoqKlxuZXhwb3J0IGNvbnN0IHR5cGVkQXJyYXlUb1R5cGUgPSB7XG4gICAgXCJJbnQ4QXJyYXlcIjogVFlQRV9JTlQ4LFxuICAgIFwiVWludDhBcnJheVwiOiBUWVBFX1VJTlQ4LFxuICAgIFwiSW50MTZBcnJheVwiOiBUWVBFX0lOVDE2LFxuICAgIFwiVWludDE2QXJyYXlcIjogVFlQRV9VSU5UMTYsXG4gICAgXCJJbnQzMkFycmF5XCI6IFRZUEVfSU5UMzIsXG4gICAgXCJVaW50MzJBcnJheVwiOiBUWVBFX1VJTlQzMixcbiAgICBcIkZsb2F0MzJBcnJheVwiOiBUWVBFX0ZMT0FUMzJcbn07XG5cbi8vIG1hcCBvZiBlbmdpbmUgSU5ERVhGT1JNQVRfKioqIHRvIHRoZWlyIGNvcnJlc3BvbmRpbmcgdHlwZWQgYXJyYXkgY29uc3RydWN0b3JzIGFuZCBieXRlIHNpemVzXG5leHBvcnQgY29uc3QgdHlwZWRBcnJheUluZGV4Rm9ybWF0cyA9IFtVaW50OEFycmF5LCBVaW50MTZBcnJheSwgVWludDMyQXJyYXldO1xuZXhwb3J0IGNvbnN0IHR5cGVkQXJyYXlJbmRleEZvcm1hdHNCeXRlU2l6ZSA9IFsxLCAyLCA0XTtcblxuLyoqXG4gKiBNYXAgb2YgZW5naW5lIHNlbWFudGljcyBpbnRvIGxvY2F0aW9uIG9uIGRldmljZSBpbiByYW5nZSAwLi4xNSAobm90ZSAtIHNlbWFudGljcyBtYXBwaW5nIHRvIHRoZVxuICogc2FtZSBsb2NhdGlvbiBjYW5ub3QgYmUgdXNlZCBhdCB0aGUgc2FtZSB0aW1lKSBvcmdhbml6ZWQgaW4gYSB3YXkgdGhhdCBBVFRSMC1BVFRSNyBkbyBub3RcbiAqIG92ZXJsYXAgd2l0aCBjb21tb24gaW1wb3J0YW50IHNlbWFudGljcy5cbiAqXG4gKiBAdHlwZSB7b2JqZWN0fVxuICogQGlnbm9yZVxuICovXG5leHBvcnQgY29uc3Qgc2VtYW50aWNUb0xvY2F0aW9uID0ge307XG5cbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19QT1NJVElPTl0gPSAwO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX05PUk1BTF0gPSAxO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0JMRU5EV0VJR0hUXSA9IDI7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQkxFTkRJTkRJQ0VTXSA9IDM7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQ09MT1JdID0gNDtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDBdID0gNTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDFdID0gNjtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDJdID0gNztcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDNdID0gODtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDRdID0gOTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDVdID0gMTA7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfVEVYQ09PUkQ2XSA9IDExO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX1RFWENPT1JEN10gPSAxMjtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19UQU5HRU5UXSA9IDEzO1xuXG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjBdID0gMDtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSMV0gPSAxO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIyXSA9IDI7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjNdID0gMztcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSNF0gPSA0O1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFI1XSA9IDU7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjZdID0gNjtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSN10gPSA3O1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFI4XSA9IDg7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjldID0gOTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSMTBdID0gMTA7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjExXSA9IDExO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIxMl0gPSAxMjtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSMTNdID0gMTM7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjE0XSA9IDE0O1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIxNV0gPSAxNTtcblxuLyoqXG4gKiBDaHVuayBBUEkgdmVyc2lvbnNcbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgQ0hVTktBUElfMV81MSA9ICcxLjUxJztcbmV4cG9ydCBjb25zdCBDSFVOS0FQSV8xXzU1ID0gJzEuNTUnO1xuZXhwb3J0IGNvbnN0IENIVU5LQVBJXzFfNTYgPSAnMS41Nic7XG5leHBvcnQgY29uc3QgQ0hVTktBUElfMV81NyA9ICcxLjU3JztcbmV4cG9ydCBjb25zdCBDSFVOS0FQSV8xXzU4ID0gJzEuNTgnO1xuZXhwb3J0IGNvbnN0IENIVU5LQVBJXzFfNjAgPSAnMS42MCc7XG5leHBvcnQgY29uc3QgQ0hVTktBUElfMV82MiA9ICcxLjYyJztcbiJdLCJuYW1lcyI6WyJBRERSRVNTX1JFUEVBVCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiQkxFTkRNT0RFX1pFUk8iLCJCTEVORE1PREVfT05FIiwiQkxFTkRNT0RFX1NSQ19DT0xPUiIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SIiwiQkxFTkRNT0RFX0RTVF9DT0xPUiIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SIiwiQkxFTkRNT0RFX1NSQ19BTFBIQSIsIkJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEUiLCJCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSIsIkJMRU5ETU9ERV9EU1RfQUxQSEEiLCJCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSIsIkJMRU5ETU9ERV9DT05TVEFOVCIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQiLCJCTEVOREVRVUFUSU9OX0FERCIsIkJMRU5ERVFVQVRJT05fU1VCVFJBQ1QiLCJCTEVOREVRVUFUSU9OX1JFVkVSU0VfU1VCVFJBQ1QiLCJCTEVOREVRVUFUSU9OX01JTiIsIkJMRU5ERVFVQVRJT05fTUFYIiwiQlVGRkVSX1NUQVRJQyIsIkJVRkZFUl9EWU5BTUlDIiwiQlVGRkVSX1NUUkVBTSIsIkJVRkZFUl9HUFVEWU5BTUlDIiwiQ0xFQVJGTEFHX0NPTE9SIiwiQ0xFQVJGTEFHX0RFUFRIIiwiQ0xFQVJGTEFHX1NURU5DSUwiLCJDVUJFRkFDRV9QT1NYIiwiQ1VCRUZBQ0VfTkVHWCIsIkNVQkVGQUNFX1BPU1kiLCJDVUJFRkFDRV9ORUdZIiwiQ1VCRUZBQ0VfUE9TWiIsIkNVQkVGQUNFX05FR1oiLCJDVUxMRkFDRV9OT05FIiwiQ1VMTEZBQ0VfQkFDSyIsIkNVTExGQUNFX0ZST05UIiwiQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLIiwiRklMVEVSX05FQVJFU1QiLCJGSUxURVJfTElORUFSIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsIkZVTkNfTkVWRVIiLCJGVU5DX0xFU1MiLCJGVU5DX0VRVUFMIiwiRlVOQ19MRVNTRVFVQUwiLCJGVU5DX0dSRUFURVIiLCJGVU5DX05PVEVRVUFMIiwiRlVOQ19HUkVBVEVSRVFVQUwiLCJGVU5DX0FMV0FZUyIsIklOREVYRk9STUFUX1VJTlQ4IiwiSU5ERVhGT1JNQVRfVUlOVDE2IiwiSU5ERVhGT1JNQVRfVUlOVDMyIiwiUElYRUxGT1JNQVRfQTgiLCJQSVhFTEZPUk1BVF9MOCIsIlBJWEVMRk9STUFUX0xBOCIsIlBJWEVMRk9STUFUX1JHQjU2NSIsIlBJWEVMRk9STUFUX1JHQkE1NTUxIiwiUElYRUxGT1JNQVRfUkdCQTQiLCJQSVhFTEZPUk1BVF9SR0I4IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJQSVhFTEZPUk1BVF9EWFQxIiwiUElYRUxGT1JNQVRfRFhUMyIsIlBJWEVMRk9STUFUX0RYVDUiLCJQSVhFTEZPUk1BVF9SR0IxNkYiLCJQSVhFTEZPUk1BVF9SR0JBMTZGIiwiUElYRUxGT1JNQVRfUkdCMzJGIiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIlBJWEVMRk9STUFUX1IzMkYiLCJQSVhFTEZPUk1BVF9ERVBUSCIsIlBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCIsIlBJWEVMRk9STUFUXzExMTExMEYiLCJQSVhFTEZPUk1BVF9TUkdCIiwiUElYRUxGT1JNQVRfU1JHQkEiLCJQSVhFTEZPUk1BVF9FVEMxIiwiUElYRUxGT1JNQVRfRVRDMl9SR0IiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQkEiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9BU1RDXzR4NCIsIlBJWEVMRk9STUFUX0FUQ19SR0IiLCJQSVhFTEZPUk1BVF9BVENfUkdCQSIsIlBJWEVMRk9STUFUX0JHUkE4IiwicGl4ZWxGb3JtYXRJbmZvIiwiTWFwIiwibmFtZSIsInNpemUiLCJibG9ja1NpemUiLCJpc0NvbXByZXNzZWRQaXhlbEZvcm1hdCIsImZvcm1hdCIsImdldCIsInVuZGVmaW5lZCIsImdldFBpeGVsRm9ybWF0QXJyYXlUeXBlIiwiRmxvYXQzMkFycmF5IiwiVWludDE2QXJyYXkiLCJVaW50OEFycmF5IiwiUFJJTUlUSVZFX1BPSU5UUyIsIlBSSU1JVElWRV9MSU5FUyIsIlBSSU1JVElWRV9MSU5FTE9PUCIsIlBSSU1JVElWRV9MSU5FU1RSSVAiLCJQUklNSVRJVkVfVFJJQU5HTEVTIiwiUFJJTUlUSVZFX1RSSVNUUklQIiwiUFJJTUlUSVZFX1RSSUZBTiIsIlNFTUFOVElDX1BPU0lUSU9OIiwiU0VNQU5USUNfTk9STUFMIiwiU0VNQU5USUNfVEFOR0VOVCIsIlNFTUFOVElDX0JMRU5EV0VJR0hUIiwiU0VNQU5USUNfQkxFTkRJTkRJQ0VTIiwiU0VNQU5USUNfQ09MT1IiLCJTRU1BTlRJQ19URVhDT09SRCIsIlNFTUFOVElDX1RFWENPT1JEMCIsIlNFTUFOVElDX1RFWENPT1JEMSIsIlNFTUFOVElDX1RFWENPT1JEMiIsIlNFTUFOVElDX1RFWENPT1JEMyIsIlNFTUFOVElDX1RFWENPT1JENCIsIlNFTUFOVElDX1RFWENPT1JENSIsIlNFTUFOVElDX1RFWENPT1JENiIsIlNFTUFOVElDX1RFWENPT1JENyIsIlNFTUFOVElDX0FUVFIiLCJTRU1BTlRJQ19BVFRSMCIsIlNFTUFOVElDX0FUVFIxIiwiU0VNQU5USUNfQVRUUjIiLCJTRU1BTlRJQ19BVFRSMyIsIlNFTUFOVElDX0FUVFI0IiwiU0VNQU5USUNfQVRUUjUiLCJTRU1BTlRJQ19BVFRSNiIsIlNFTUFOVElDX0FUVFI3IiwiU0VNQU5USUNfQVRUUjgiLCJTRU1BTlRJQ19BVFRSOSIsIlNFTUFOVElDX0FUVFIxMCIsIlNFTUFOVElDX0FUVFIxMSIsIlNFTUFOVElDX0FUVFIxMiIsIlNFTUFOVElDX0FUVFIxMyIsIlNFTUFOVElDX0FUVFIxNCIsIlNFTUFOVElDX0FUVFIxNSIsIlNIQURFUlRBR19NQVRFUklBTCIsIlNURU5DSUxPUF9LRUVQIiwiU1RFTkNJTE9QX1pFUk8iLCJTVEVOQ0lMT1BfUkVQTEFDRSIsIlNURU5DSUxPUF9JTkNSRU1FTlQiLCJTVEVOQ0lMT1BfSU5DUkVNRU5UV1JBUCIsIlNURU5DSUxPUF9ERUNSRU1FTlQiLCJTVEVOQ0lMT1BfREVDUkVNRU5UV1JBUCIsIlNURU5DSUxPUF9JTlZFUlQiLCJURVhUVVJFTE9DS19SRUFEIiwiVEVYVFVSRUxPQ0tfV1JJVEUiLCJURVhUVVJFVFlQRV9ERUZBVUxUIiwiVEVYVFVSRVRZUEVfUkdCTSIsIlRFWFRVUkVUWVBFX1JHQkUiLCJURVhUVVJFVFlQRV9SR0JQIiwiVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IiLCJURVhISU5UX05PTkUiLCJURVhISU5UX1NIQURPV01BUCIsIlRFWEhJTlRfQVNTRVQiLCJURVhISU5UX0xJR0hUTUFQIiwiVEVYVFVSRURJTUVOU0lPTl8xRCIsIlRFWFRVUkVESU1FTlNJT05fMkQiLCJURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZIiwiVEVYVFVSRURJTUVOU0lPTl9DVUJFIiwiVEVYVFVSRURJTUVOU0lPTl9DVUJFX0FSUkFZIiwiVEVYVFVSRURJTUVOU0lPTl8zRCIsIlNBTVBMRVRZUEVfRkxPQVQiLCJTQU1QTEVUWVBFX1VORklMVEVSQUJMRV9GTE9BVCIsIlNBTVBMRVRZUEVfREVQVEgiLCJURVhUVVJFUFJPSkVDVElPTl9OT05FIiwiVEVYVFVSRVBST0pFQ1RJT05fQ1VCRSIsIlRFWFRVUkVQUk9KRUNUSU9OX0VRVUlSRUNUIiwiVEVYVFVSRVBST0pFQ1RJT05fT0NUQUhFRFJBTCIsIlNIQURFUkxBTkdVQUdFX0dMU0wiLCJTSEFERVJMQU5HVUFHRV9XR1NMIiwiVFlQRV9JTlQ4IiwiVFlQRV9VSU5UOCIsIlRZUEVfSU5UMTYiLCJUWVBFX1VJTlQxNiIsIlRZUEVfSU5UMzIiLCJUWVBFX1VJTlQzMiIsIlRZUEVfRkxPQVQzMiIsIlVOSUZPUk1UWVBFX0JPT0wiLCJVTklGT1JNVFlQRV9JTlQiLCJVTklGT1JNVFlQRV9GTE9BVCIsIlVOSUZPUk1UWVBFX1ZFQzIiLCJVTklGT1JNVFlQRV9WRUMzIiwiVU5JRk9STVRZUEVfVkVDNCIsIlVOSUZPUk1UWVBFX0lWRUMyIiwiVU5JRk9STVRZUEVfSVZFQzMiLCJVTklGT1JNVFlQRV9JVkVDNCIsIlVOSUZPUk1UWVBFX0JWRUMyIiwiVU5JRk9STVRZUEVfQlZFQzMiLCJVTklGT1JNVFlQRV9CVkVDNCIsIlVOSUZPUk1UWVBFX01BVDIiLCJVTklGT1JNVFlQRV9NQVQzIiwiVU5JRk9STVRZUEVfTUFUNCIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRCIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFIiwiVU5JRk9STVRZUEVfRkxPQVRBUlJBWSIsIlVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1ciLCJVTklGT1JNVFlQRV9URVhUVVJFM0QiLCJVTklGT1JNVFlQRV9WRUMyQVJSQVkiLCJVTklGT1JNVFlQRV9WRUMzQVJSQVkiLCJVTklGT1JNVFlQRV9WRUM0QVJSQVkiLCJVTklGT1JNVFlQRV9NQVQ0QVJSQVkiLCJ1bmlmb3JtVHlwZVRvTmFtZSIsIkRFVklDRVRZUEVfV0VCR0wxIiwiREVWSUNFVFlQRV9XRUJHTDIiLCJERVZJQ0VUWVBFX1dFQkdQVSIsIlNIQURFUlNUQUdFX1ZFUlRFWCIsIlNIQURFUlNUQUdFX0ZSQUdNRU5UIiwiU0hBREVSU1RBR0VfQ09NUFVURSIsIkJJTkRHUk9VUF9NRVNIIiwiQklOREdST1VQX1ZJRVciLCJiaW5kR3JvdXBOYW1lcyIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwidHlwZWRBcnJheVR5cGVzIiwiSW50OEFycmF5IiwiSW50MTZBcnJheSIsIkludDMyQXJyYXkiLCJVaW50MzJBcnJheSIsInR5cGVkQXJyYXlUeXBlc0J5dGVTaXplIiwidmVydGV4VHlwZXNOYW1lcyIsInR5cGVkQXJyYXlUb1R5cGUiLCJ0eXBlZEFycmF5SW5kZXhGb3JtYXRzIiwidHlwZWRBcnJheUluZGV4Rm9ybWF0c0J5dGVTaXplIiwic2VtYW50aWNUb0xvY2F0aW9uIiwiQ0hVTktBUElfMV81MSIsIkNIVU5LQVBJXzFfNTUiLCJDSFVOS0FQSV8xXzU2IiwiQ0hVTktBUElfMV81NyIsIkNIVU5LQVBJ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
