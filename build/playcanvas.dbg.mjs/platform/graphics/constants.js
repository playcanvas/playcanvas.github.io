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

// update this function when exposing additional compressed pixel formats
function isCompressedPixelFormat(format) {
  return format >= PIXELFORMAT_DXT1 && format <= PIXELFORMAT_DXT5 || format >= PIXELFORMAT_ETC1 && format <= PIXELFORMAT_ATC_RGBA;
}

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

// name of the default uniform buffer slot in a bind group
const UNIFORM_BUFFER_DEFAULT_SLOT_NAME = 'default';

// names of bind groups
const bindGroupNames = ['view', 'mesh'];

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

// map of engine PIXELFORMAT_*** enums to the pixel byte size
const pixelFormatByteSizes = [];
pixelFormatByteSizes[PIXELFORMAT_A8] = 1;
pixelFormatByteSizes[PIXELFORMAT_L8] = 1;
pixelFormatByteSizes[PIXELFORMAT_LA8] = 2;
pixelFormatByteSizes[PIXELFORMAT_RGB565] = 2;
pixelFormatByteSizes[PIXELFORMAT_RGBA5551] = 2;
pixelFormatByteSizes[PIXELFORMAT_RGBA4] = 2;
pixelFormatByteSizes[PIXELFORMAT_RGB8] = 4;
pixelFormatByteSizes[PIXELFORMAT_RGBA8] = 4;
pixelFormatByteSizes[PIXELFORMAT_RGB16F] = 8;
pixelFormatByteSizes[PIXELFORMAT_RGBA16F] = 8;
pixelFormatByteSizes[PIXELFORMAT_RGB32F] = 16;
pixelFormatByteSizes[PIXELFORMAT_RGBA32F] = 16;
pixelFormatByteSizes[PIXELFORMAT_R32F] = 4;
pixelFormatByteSizes[PIXELFORMAT_DEPTH] = 4; // can be smaller using WebGL1 extension?
pixelFormatByteSizes[PIXELFORMAT_DEPTHSTENCIL] = 4;
pixelFormatByteSizes[PIXELFORMAT_111110F] = 4;
pixelFormatByteSizes[PIXELFORMAT_SRGB] = 4;
pixelFormatByteSizes[PIXELFORMAT_SRGBA] = 4;

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

export { ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT, ADDRESS_REPEAT, BINDGROUP_MESH, BINDGROUP_VIEW, BLENDEQUATION_ADD, BLENDEQUATION_MAX, BLENDEQUATION_MIN, BLENDEQUATION_REVERSE_SUBTRACT, BLENDEQUATION_SUBTRACT, BLENDMODE_CONSTANT, BLENDMODE_DST_ALPHA, BLENDMODE_DST_COLOR, BLENDMODE_ONE, BLENDMODE_ONE_MINUS_CONSTANT, BLENDMODE_ONE_MINUS_DST_ALPHA, BLENDMODE_ONE_MINUS_DST_COLOR, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_COLOR, BLENDMODE_SRC_ALPHA, BLENDMODE_SRC_ALPHA_SATURATE, BLENDMODE_SRC_COLOR, BLENDMODE_ZERO, BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM, CHUNKAPI_1_51, CHUNKAPI_1_55, CHUNKAPI_1_56, CHUNKAPI_1_57, CHUNKAPI_1_58, CHUNKAPI_1_60, CHUNKAPI_1_62, CLEARFLAG_COLOR, CLEARFLAG_DEPTH, CLEARFLAG_STENCIL, CUBEFACE_NEGX, CUBEFACE_NEGY, CUBEFACE_NEGZ, CUBEFACE_POSX, CUBEFACE_POSY, CUBEFACE_POSZ, CULLFACE_BACK, CULLFACE_FRONT, CULLFACE_FRONTANDBACK, CULLFACE_NONE, DEVICETYPE_WEBGL1, DEVICETYPE_WEBGL2, DEVICETYPE_WEBGPU, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FUNC_ALWAYS, FUNC_EQUAL, FUNC_GREATER, FUNC_GREATEREQUAL, FUNC_LESS, FUNC_LESSEQUAL, FUNC_NEVER, FUNC_NOTEQUAL, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32, INDEXFORMAT_UINT8, PIXELFORMAT_111110F, PIXELFORMAT_A8, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB, PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, PIXELFORMAT_DEPTH, PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5, PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_PVRTC_2BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_R32F, PIXELFORMAT_RGB16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGB565, PIXELFORMAT_RGB8, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA4, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA8, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PRIMITIVE_LINELOOP, PRIMITIVE_LINES, PRIMITIVE_LINESTRIP, PRIMITIVE_POINTS, PRIMITIVE_TRIANGLES, PRIMITIVE_TRIFAN, PRIMITIVE_TRISTRIP, SAMPLETYPE_DEPTH, SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SEMANTIC_ATTR, SEMANTIC_ATTR0, SEMANTIC_ATTR1, SEMANTIC_ATTR10, SEMANTIC_ATTR11, SEMANTIC_ATTR12, SEMANTIC_ATTR13, SEMANTIC_ATTR14, SEMANTIC_ATTR15, SEMANTIC_ATTR2, SEMANTIC_ATTR3, SEMANTIC_ATTR4, SEMANTIC_ATTR5, SEMANTIC_ATTR6, SEMANTIC_ATTR7, SEMANTIC_ATTR8, SEMANTIC_ATTR9, SEMANTIC_BLENDINDICES, SEMANTIC_BLENDWEIGHT, SEMANTIC_COLOR, SEMANTIC_NORMAL, SEMANTIC_POSITION, SEMANTIC_TANGENT, SEMANTIC_TEXCOORD, SEMANTIC_TEXCOORD0, SEMANTIC_TEXCOORD1, SEMANTIC_TEXCOORD2, SEMANTIC_TEXCOORD3, SEMANTIC_TEXCOORD4, SEMANTIC_TEXCOORD5, SEMANTIC_TEXCOORD6, SEMANTIC_TEXCOORD7, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, SHADERSTAGE_COMPUTE, SHADERSTAGE_FRAGMENT, SHADERSTAGE_VERTEX, SHADERTAG_MATERIAL, STENCILOP_DECREMENT, STENCILOP_DECREMENTWRAP, STENCILOP_INCREMENT, STENCILOP_INCREMENTWRAP, STENCILOP_INVERT, STENCILOP_KEEP, STENCILOP_REPLACE, STENCILOP_ZERO, TEXHINT_ASSET, TEXHINT_LIGHTMAP, TEXHINT_NONE, TEXHINT_SHADOWMAP, TEXTUREDIMENSION_1D, TEXTUREDIMENSION_2D, TEXTUREDIMENSION_2D_ARRAY, TEXTUREDIMENSION_3D, TEXTUREDIMENSION_CUBE, TEXTUREDIMENSION_CUBE_ARRAY, TEXTURELOCK_READ, TEXTURELOCK_WRITE, TEXTUREPROJECTION_CUBE, TEXTUREPROJECTION_EQUIRECT, TEXTUREPROJECTION_NONE, TEXTUREPROJECTION_OCTAHEDRAL, TEXTURETYPE_DEFAULT, TEXTURETYPE_RGBE, TEXTURETYPE_RGBM, TEXTURETYPE_RGBP, TEXTURETYPE_SWIZZLEGGGR, TYPE_FLOAT32, TYPE_INT16, TYPE_INT32, TYPE_INT8, TYPE_UINT16, TYPE_UINT32, TYPE_UINT8, UNIFORMTYPE_BOOL, UNIFORMTYPE_BVEC2, UNIFORMTYPE_BVEC3, UNIFORMTYPE_BVEC4, UNIFORMTYPE_FLOAT, UNIFORMTYPE_FLOATARRAY, UNIFORMTYPE_INT, UNIFORMTYPE_IVEC2, UNIFORMTYPE_IVEC3, UNIFORMTYPE_IVEC4, UNIFORMTYPE_MAT2, UNIFORMTYPE_MAT3, UNIFORMTYPE_MAT4, UNIFORMTYPE_MAT4ARRAY, UNIFORMTYPE_TEXTURE2D, UNIFORMTYPE_TEXTURE2D_SHADOW, UNIFORMTYPE_TEXTURE3D, UNIFORMTYPE_TEXTURECUBE, UNIFORMTYPE_TEXTURECUBE_SHADOW, UNIFORMTYPE_VEC2, UNIFORMTYPE_VEC2ARRAY, UNIFORMTYPE_VEC3, UNIFORMTYPE_VEC3ARRAY, UNIFORMTYPE_VEC4, UNIFORMTYPE_VEC4ARRAY, UNIFORM_BUFFER_DEFAULT_SLOT_NAME, bindGroupNames, isCompressedPixelFormat, pixelFormatByteSizes, semanticToLocation, typedArrayIndexFormats, typedArrayIndexFormatsByteSize, typedArrayToType, typedArrayTypes, typedArrayTypesByteSize, uniformTypeToName, vertexTypesNames };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uc3RhbnRzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcGxhdGZvcm0vZ3JhcGhpY3MvY29uc3RhbnRzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogSWdub3JlcyB0aGUgaW50ZWdlciBwYXJ0IG9mIHRleHR1cmUgY29vcmRpbmF0ZXMsIHVzaW5nIG9ubHkgdGhlIGZyYWN0aW9uYWwgcGFydC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQUREUkVTU19SRVBFQVQgPSAwO1xuXG4vKipcbiAqIENsYW1wcyB0ZXh0dXJlIGNvb3JkaW5hdGUgdG8gdGhlIHJhbmdlIDAgdG8gMS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQUREUkVTU19DTEFNUF9UT19FREdFID0gMTtcblxuLyoqXG4gKiBUZXh0dXJlIGNvb3JkaW5hdGUgdG8gYmUgc2V0IHRvIHRoZSBmcmFjdGlvbmFsIHBhcnQgaWYgdGhlIGludGVnZXIgcGFydCBpcyBldmVuLiBJZiB0aGUgaW50ZWdlclxuICogcGFydCBpcyBvZGQsIHRoZW4gdGhlIHRleHR1cmUgY29vcmRpbmF0ZSBpcyBzZXQgdG8gMSBtaW51cyB0aGUgZnJhY3Rpb25hbCBwYXJ0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBBRERSRVNTX01JUlJPUkVEX1JFUEVBVCA9IDI7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgemVyby5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX1pFUk8gPSAwO1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IG9uZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORSA9IDE7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgdGhlIGNvbXBvbmVudHMgb2YgdGhlIHNvdXJjZSBmcmFnbWVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX1NSQ19DT0xPUiA9IDI7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgb25lIG1pbnVzIHRoZSBjb21wb25lbnRzIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SID0gMztcblxuLyoqXG4gKiBNdWx0aXBseSBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSB0aGUgY29tcG9uZW50cyBvZiB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9EU1RfQ09MT1IgPSA0O1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IG9uZSBtaW51cyB0aGUgY29tcG9uZW50cyBvZiB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SID0gNTtcblxuLyoqXG4gKiBNdWx0aXBseSBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSB0aGUgYWxwaGEgdmFsdWUgb2YgdGhlIHNvdXJjZSBmcmFnbWVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX1NSQ19BTFBIQSA9IDY7XG5cbi8qKlxuICogTXVsdGlwbHkgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgdGhlIGFscGhhIHZhbHVlIG9mIHRoZSBzb3VyY2UgZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEUgPSA3O1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IG9uZSBtaW51cyB0aGUgYWxwaGEgdmFsdWUgb2YgdGhlIHNvdXJjZSBmcmFnbWVudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX09ORV9NSU5VU19TUkNfQUxQSEEgPSA4O1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IHRoZSBhbHBoYSB2YWx1ZSBvZiB0aGUgZGVzdGluYXRpb24gZnJhZ21lbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9EU1RfQUxQSEEgPSA5O1xuXG4vKipcbiAqIE11bHRpcGx5IGFsbCBmcmFnbWVudCBjb21wb25lbnRzIGJ5IG9uZSBtaW51cyB0aGUgYWxwaGEgdmFsdWUgb2YgdGhlIGRlc3RpbmF0aW9uIGZyYWdtZW50LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSA9IDEwO1xuXG4vKipcbiAqIE11bHRpcGxpZXMgYWxsIGZyYWdtZW50IGNvbXBvbmVudHMgYnkgYSBjb25zdGFudC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRNT0RFX0NPTlNUQU5UID0gMTE7XG5cbi8qKlxuICogTXVsdGlwbGllcyBhbGwgZnJhZ21lbnQgY29tcG9uZW50cyBieSAxIG1pbnVzIGEgY29uc3RhbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQgPSAxMjtcblxuLyoqXG4gKiBBZGQgdGhlIHJlc3VsdHMgb2YgdGhlIHNvdXJjZSBhbmQgZGVzdGluYXRpb24gZnJhZ21lbnQgbXVsdGlwbGllcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQkxFTkRFUVVBVElPTl9BREQgPSAwO1xuXG4vKipcbiAqIFN1YnRyYWN0IHRoZSByZXN1bHRzIG9mIHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGZyYWdtZW50IG11bHRpcGxpZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ERVFVQVRJT05fU1VCVFJBQ1QgPSAxO1xuXG4vKipcbiAqIFJldmVyc2UgYW5kIHN1YnRyYWN0IHRoZSByZXN1bHRzIG9mIHRoZSBzb3VyY2UgYW5kIGRlc3RpbmF0aW9uIGZyYWdtZW50IG11bHRpcGxpZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ERVFVQVRJT05fUkVWRVJTRV9TVUJUUkFDVCA9IDI7XG5cbi8qKlxuICogVXNlIHRoZSBzbWFsbGVzdCB2YWx1ZS4gQ2hlY2sgYXBwLmdyYXBoaWNzRGV2aWNlLmV4dEJsZW5kTWlubWF4IGZvciBzdXBwb3J0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBCTEVOREVRVUFUSU9OX01JTiA9IDM7XG5cbi8qKlxuICogVXNlIHRoZSBsYXJnZXN0IHZhbHVlLiBDaGVjayBhcHAuZ3JhcGhpY3NEZXZpY2UuZXh0QmxlbmRNaW5tYXggZm9yIHN1cHBvcnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJMRU5ERVFVQVRJT05fTUFYID0gNDtcblxuLyoqXG4gKiBUaGUgZGF0YSBzdG9yZSBjb250ZW50cyB3aWxsIGJlIG1vZGlmaWVkIG9uY2UgYW5kIHVzZWQgbWFueSB0aW1lcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQlVGRkVSX1NUQVRJQyA9IDA7XG5cbi8qKlxuICogVGhlIGRhdGEgc3RvcmUgY29udGVudHMgd2lsbCBiZSBtb2RpZmllZCByZXBlYXRlZGx5IGFuZCB1c2VkIG1hbnkgdGltZXMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEJVRkZFUl9EWU5BTUlDID0gMTtcblxuLyoqXG4gKiBUaGUgZGF0YSBzdG9yZSBjb250ZW50cyB3aWxsIGJlIG1vZGlmaWVkIG9uY2UgYW5kIHVzZWQgYXQgbW9zdCBhIGZldyB0aW1lcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQlVGRkVSX1NUUkVBTSA9IDI7XG5cbi8qKlxuICogVGhlIGRhdGEgc3RvcmUgY29udGVudHMgd2lsbCBiZSBtb2RpZmllZCByZXBlYXRlZGx5IG9uIHRoZSBHUFUgYW5kIHVzZWQgbWFueSB0aW1lcy4gT3B0aW1hbCBmb3JcbiAqIHRyYW5zZm9ybSBmZWVkYmFjayB1c2FnZSAoV2ViR0wyIG9ubHkpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBCVUZGRVJfR1BVRFlOQU1JQyA9IDM7XG5cbi8qKlxuICogQ2xlYXIgdGhlIGNvbG9yIGJ1ZmZlci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ0xFQVJGTEFHX0NPTE9SID0gMTtcblxuLyoqXG4gKiBDbGVhciB0aGUgZGVwdGggYnVmZmVyLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDTEVBUkZMQUdfREVQVEggPSAyO1xuXG4vKipcbiAqIENsZWFyIHRoZSBzdGVuY2lsIGJ1ZmZlci5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ0xFQVJGTEFHX1NURU5DSUwgPSA0O1xuXG4vKipcbiAqIFRoZSBwb3NpdGl2ZSBYIGZhY2Ugb2YgYSBjdWJlbWFwLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDVUJFRkFDRV9QT1NYID0gMDtcblxuLyoqXG4gKiBUaGUgbmVnYXRpdmUgWCBmYWNlIG9mIGEgY3ViZW1hcC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfTkVHWCA9IDE7XG5cbi8qKlxuICogVGhlIHBvc2l0aXZlIFkgZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IENVQkVGQUNFX1BPU1kgPSAyO1xuXG4vKipcbiAqIFRoZSBuZWdhdGl2ZSBZIGZhY2Ugb2YgYSBjdWJlbWFwLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDVUJFRkFDRV9ORUdZID0gMztcblxuLyoqXG4gKiBUaGUgcG9zaXRpdmUgWiBmYWNlIG9mIGEgY3ViZW1hcC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ1VCRUZBQ0VfUE9TWiA9IDQ7XG5cbi8qKlxuICogVGhlIG5lZ2F0aXZlIFogZmFjZSBvZiBhIGN1YmVtYXAuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IENVQkVGQUNFX05FR1ogPSA1O1xuXG4vKipcbiAqIE5vIHRyaWFuZ2xlcyBhcmUgY3VsbGVkLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBDVUxMRkFDRV9OT05FID0gMDtcblxuLyoqXG4gKiBUcmlhbmdsZXMgZmFjaW5nIGF3YXkgZnJvbSB0aGUgdmlldyBkaXJlY3Rpb24gYXJlIGN1bGxlZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ1VMTEZBQ0VfQkFDSyA9IDE7XG5cbi8qKlxuICogVHJpYW5nbGVzIGZhY2luZyB0aGUgdmlldyBkaXJlY3Rpb24gYXJlIGN1bGxlZC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgQ1VMTEZBQ0VfRlJPTlQgPSAyO1xuXG4vKipcbiAqIFRyaWFuZ2xlcyBhcmUgY3VsbGVkIHJlZ2FyZGxlc3Mgb2YgdGhlaXIgb3JpZW50YXRpb24gd2l0aCByZXNwZWN0IHRvIHRoZSB2aWV3IGRpcmVjdGlvbi4gTm90ZVxuICogdGhhdCBwb2ludCBvciBsaW5lIHByaW1pdGl2ZXMgYXJlIHVuYWZmZWN0ZWQgYnkgdGhpcyByZW5kZXIgc3RhdGUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBpZ25vcmVcbiAqL1xuZXhwb3J0IGNvbnN0IENVTExGQUNFX0ZST05UQU5EQkFDSyA9IDM7XG5cbi8qKlxuICogUG9pbnQgc2FtcGxlIGZpbHRlcmluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX05FQVJFU1QgPSAwO1xuXG4vKipcbiAqIEJpbGluZWFyIGZpbHRlcmluZy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX0xJTkVBUiA9IDE7XG5cbi8qKlxuICogVXNlIHRoZSBuZWFyZXN0IG5laWdoYm9yIGluIHRoZSBuZWFyZXN0IG1pcG1hcCBsZXZlbC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QgPSAyO1xuXG4vKipcbiAqIExpbmVhcmx5IGludGVycG9sYXRlIGluIHRoZSBuZWFyZXN0IG1pcG1hcCBsZXZlbC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX05FQVJFU1RfTUlQTUFQX0xJTkVBUiA9IDM7XG5cbi8qKlxuICogVXNlIHRoZSBuZWFyZXN0IG5laWdoYm9yIGFmdGVyIGxpbmVhcmx5IGludGVycG9sYXRpbmcgYmV0d2VlbiBtaXBtYXAgbGV2ZWxzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBGSUxURVJfTElORUFSX01JUE1BUF9ORUFSRVNUID0gNDtcblxuLyoqXG4gKiBMaW5lYXJseSBpbnRlcnBvbGF0ZSBib3RoIHRoZSBtaXBtYXAgbGV2ZWxzIGFuZCBiZXR3ZWVuIHRleGVscy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRklMVEVSX0xJTkVBUl9NSVBNQVBfTElORUFSID0gNTtcblxuLyoqXG4gKiBOZXZlciBwYXNzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBGVU5DX05FVkVSID0gMDtcblxuLyoqXG4gKiBQYXNzIGlmIChyZWYgJiBtYXNrKSA8IChzdGVuY2lsICYgbWFzaykuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEZVTkNfTEVTUyA9IDE7XG5cbi8qKlxuICogUGFzcyBpZiAocmVmICYgbWFzaykgPT0gKHN0ZW5jaWwgJiBtYXNrKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRlVOQ19FUVVBTCA9IDI7XG5cbi8qKlxuICogUGFzcyBpZiAocmVmICYgbWFzaykgPD0gKHN0ZW5jaWwgJiBtYXNrKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRlVOQ19MRVNTRVFVQUwgPSAzO1xuXG4vKipcbiAqIFBhc3MgaWYgKHJlZiAmIG1hc2spID4gKHN0ZW5jaWwgJiBtYXNrKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgRlVOQ19HUkVBVEVSID0gNDtcblxuLyoqXG4gKiBQYXNzIGlmIChyZWYgJiBtYXNrKSAhPSAoc3RlbmNpbCAmIG1hc2spLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBGVU5DX05PVEVRVUFMID0gNTtcblxuLyoqXG4gKiBQYXNzIGlmIChyZWYgJiBtYXNrKSA+PSAoc3RlbmNpbCAmIG1hc2spLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBGVU5DX0dSRUFURVJFUVVBTCA9IDY7XG5cbi8qKlxuICogQWx3YXlzIHBhc3MuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IEZVTkNfQUxXQVlTID0gNztcblxuLyoqXG4gKiA4LWJpdCB1bnNpZ25lZCB2ZXJ0ZXggaW5kaWNlcyAoMCB0byAyNTUpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBJTkRFWEZPUk1BVF9VSU5UOCA9IDA7XG5cbi8qKlxuICogMTYtYml0IHVuc2lnbmVkIHZlcnRleCBpbmRpY2VzICgwIHRvIDY1LDUzNSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IElOREVYRk9STUFUX1VJTlQxNiA9IDE7XG5cbi8qKlxuICogMzItYml0IHVuc2lnbmVkIHZlcnRleCBpbmRpY2VzICgwIHRvIDQsMjk0LDk2NywyOTUpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBJTkRFWEZPUk1BVF9VSU5UMzIgPSAyO1xuXG4vKipcbiAqIDgtYml0IGFscGhhLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9BOCA9IDA7XG5cbi8qKlxuICogOC1iaXQgbHVtaW5hbmNlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9MOCA9IDE7XG5cbi8qKlxuICogOC1iaXQgbHVtaW5hbmNlIHdpdGggOC1iaXQgYWxwaGEuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0xBOCA9IDI7XG5cbi8qKlxuICogMTYtYml0IFJHQiAoNS1iaXRzIGZvciByZWQgY2hhbm5lbCwgNiBmb3IgZ3JlZW4gYW5kIDUgZm9yIGJsdWUpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0I1NjUgPSAzO1xuXG4vKipcbiAqIDE2LWJpdCBSR0JBICg1LWJpdHMgZm9yIHJlZCBjaGFubmVsLCA1IGZvciBncmVlbiwgNSBmb3IgYmx1ZSB3aXRoIDEtYml0IGFscGhhKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTU1NTEgPSA0O1xuXG4vKipcbiAqIDE2LWJpdCBSR0JBICg0LWJpdHMgZm9yIHJlZCBjaGFubmVsLCA0IGZvciBncmVlbiwgNCBmb3IgYmx1ZSB3aXRoIDQtYml0IGFscGhhKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTQgPSA1O1xuXG4vKipcbiAqIDI0LWJpdCBSR0IgKDgtYml0cyBmb3IgcmVkIGNoYW5uZWwsIDggZm9yIGdyZWVuIGFuZCA4IGZvciBibHVlKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCOCA9IDY7XG5cbi8qKlxuICogMzItYml0IFJHQkEgKDgtYml0cyBmb3IgcmVkIGNoYW5uZWwsIDggZm9yIGdyZWVuLCA4IGZvciBibHVlIHdpdGggOC1iaXQgYWxwaGEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0JBOCA9IDc7XG5cbi8qKlxuICogQmxvY2sgY29tcHJlc3NlZCBmb3JtYXQgc3RvcmluZyAxNiBpbnB1dCBwaXhlbHMgaW4gNjQgYml0cyBvZiBvdXRwdXQsIGNvbnNpc3Rpbmcgb2YgdHdvIDE2LWJpdFxuICogUkdCIDU6Njo1IGNvbG9yIHZhbHVlcyBhbmQgYSA0eDQgdHdvIGJpdCBsb29rdXAgdGFibGUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0RYVDEgPSA4O1xuXG4vKipcbiAqIEJsb2NrIGNvbXByZXNzZWQgZm9ybWF0IHN0b3JpbmcgMTYgaW5wdXQgcGl4ZWxzIChjb3JyZXNwb25kaW5nIHRvIGEgNHg0IHBpeGVsIGJsb2NrKSBpbnRvIDEyOFxuICogYml0cyBvZiBvdXRwdXQsIGNvbnNpc3Rpbmcgb2YgNjQgYml0cyBvZiBhbHBoYSBjaGFubmVsIGRhdGEgKDQgYml0cyBmb3IgZWFjaCBwaXhlbCkgZm9sbG93ZWQgYnlcbiAqIDY0IGJpdHMgb2YgY29sb3IgZGF0YTsgZW5jb2RlZCB0aGUgc2FtZSB3YXkgYXMgRFhUMS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfRFhUMyA9IDk7XG5cbi8qKlxuICogQmxvY2sgY29tcHJlc3NlZCBmb3JtYXQgc3RvcmluZyAxNiBpbnB1dCBwaXhlbHMgaW50byAxMjggYml0cyBvZiBvdXRwdXQsIGNvbnNpc3Rpbmcgb2YgNjQgYml0c1xuICogb2YgYWxwaGEgY2hhbm5lbCBkYXRhICh0d28gOCBiaXQgYWxwaGEgdmFsdWVzIGFuZCBhIDR4NCAzIGJpdCBsb29rdXAgdGFibGUpIGZvbGxvd2VkIGJ5IDY0IGJpdHNcbiAqIG9mIGNvbG9yIGRhdGEgKGVuY29kZWQgdGhlIHNhbWUgd2F5IGFzIERYVDEpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9EWFQ1ID0gMTA7XG5cbi8qKlxuICogMTYtYml0IGZsb2F0aW5nIHBvaW50IFJHQiAoMTYtYml0IGZsb2F0IGZvciBlYWNoIHJlZCwgZ3JlZW4gYW5kIGJsdWUgY2hhbm5lbHMpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9SR0IxNkYgPSAxMTtcblxuLyoqXG4gKiAxNi1iaXQgZmxvYXRpbmcgcG9pbnQgUkdCQSAoMTYtYml0IGZsb2F0IGZvciBlYWNoIHJlZCwgZ3JlZW4sIGJsdWUgYW5kIGFscGhhIGNoYW5uZWxzKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCQTE2RiA9IDEyO1xuXG4vKipcbiAqIDMyLWJpdCBmbG9hdGluZyBwb2ludCBSR0IgKDMyLWJpdCBmbG9hdCBmb3IgZWFjaCByZWQsIGdyZWVuIGFuZCBibHVlIGNoYW5uZWxzKS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUkdCMzJGID0gMTM7XG5cbi8qKlxuICogMzItYml0IGZsb2F0aW5nIHBvaW50IFJHQkEgKDMyLWJpdCBmbG9hdCBmb3IgZWFjaCByZWQsIGdyZWVuLCBibHVlIGFuZCBhbHBoYSBjaGFubmVscykuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1JHQkEzMkYgPSAxNDtcblxuLyoqXG4gKiAzMi1iaXQgZmxvYXRpbmcgcG9pbnQgc2luZ2xlIGNoYW5uZWwgZm9ybWF0IChXZWJHTDIgb25seSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1IzMkYgPSAxNTtcblxuLyoqXG4gKiBBIHJlYWRhYmxlIGRlcHRoIGJ1ZmZlciBmb3JtYXQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0RFUFRIID0gMTY7XG5cbi8qKlxuICogQSByZWFkYWJsZSBkZXB0aC9zdGVuY2lsIGJ1ZmZlciBmb3JtYXQgKFdlYkdMMiBvbmx5KS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfREVQVEhTVEVOQ0lMID0gMTc7XG5cbi8qKlxuICogQSBmbG9hdGluZy1wb2ludCBjb2xvci1vbmx5IGZvcm1hdCB3aXRoIDExIGJpdHMgZm9yIHJlZCBhbmQgZ3JlZW4gY2hhbm5lbHMgYW5kIDEwIGJpdHMgZm9yIHRoZVxuICogYmx1ZSBjaGFubmVsIChXZWJHTDIgb25seSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUXzExMTExMEYgPSAxODtcblxuLyoqXG4gKiBDb2xvci1vbmx5IHNSR0IgZm9ybWF0IChXZWJHTDIgb25seSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1NSR0IgPSAxOTtcblxuLyoqXG4gKiBDb2xvciBzUkdCIGZvcm1hdCB3aXRoIGFkZGl0aW9uYWwgYWxwaGEgY2hhbm5lbCAoV2ViR0wyIG9ubHkpLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9TUkdCQSA9IDIwO1xuXG4vKipcbiAqIEVUQzEgY29tcHJlc3NlZCBmb3JtYXQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0VUQzEgPSAyMTtcblxuLyoqXG4gKiBFVEMyIChSR0IpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9FVEMyX1JHQiA9IDIyO1xuXG4vKipcbiAqIEVUQzIgKFJHQkEpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9FVEMyX1JHQkEgPSAyMztcblxuLyoqXG4gKiBQVlJUQyAoMkJQUCBSR0IpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xID0gMjQ7XG5cbi8qKlxuICogUFZSVEMgKDJCUFAgUkdCQSkgY29tcHJlc3NlZCBmb3JtYXQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX1BWUlRDXzJCUFBfUkdCQV8xID0gMjU7XG5cbi8qKlxuICogUFZSVEMgKDRCUFAgUkdCKSBjb21wcmVzc2VkIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JfMSA9IDI2O1xuXG4vKipcbiAqIFBWUlRDICg0QlBQIFJHQkEpIGNvbXByZXNzZWQgZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQkFfMSA9IDI3O1xuXG4vKipcbiAqIEFUQyBjb21wcmVzc2VkIGZvcm1hdCB3aXRoIGFscGhhIGNoYW5uZWwgaW4gYmxvY2tzIG9mIDR4NC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfQVNUQ180eDQgPSAyODtcblxuLyoqXG4gKiBBVEMgY29tcHJlc3NlZCBmb3JtYXQgd2l0aCBubyBhbHBoYSBjaGFubmVsLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQSVhFTEZPUk1BVF9BVENfUkdCID0gMjk7XG5cbi8qKlxuICogQVRDIGNvbXByZXNzZWQgZm9ybWF0IHdpdGggYWxwaGEgY2hhbm5lbC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUElYRUxGT1JNQVRfQVRDX1JHQkEgPSAzMDtcblxuLyoqXG4gKiAzMi1iaXQgQkdSQSAoOC1iaXRzIGZvciBibHVlIGNoYW5uZWwsIDggZm9yIGdyZWVuLCA4IGZvciByZWQgd2l0aCA4LWJpdCBhbHBoYSkuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqIEBpZ25vcmVcbiAqL1xuZXhwb3J0IGNvbnN0IFBJWEVMRk9STUFUX0JHUkE4ID0gMzE7XG5cbi8vIHVwZGF0ZSB0aGlzIGZ1bmN0aW9uIHdoZW4gZXhwb3NpbmcgYWRkaXRpb25hbCBjb21wcmVzc2VkIHBpeGVsIGZvcm1hdHNcbmV4cG9ydCBmdW5jdGlvbiBpc0NvbXByZXNzZWRQaXhlbEZvcm1hdChmb3JtYXQpIHtcbiAgICByZXR1cm4gKGZvcm1hdCA+PSBQSVhFTEZPUk1BVF9EWFQxICYmIGZvcm1hdCA8PSBQSVhFTEZPUk1BVF9EWFQ1KSB8fFxuICAgICAgICAgICAoZm9ybWF0ID49IFBJWEVMRk9STUFUX0VUQzEgJiYgZm9ybWF0IDw9IFBJWEVMRk9STUFUX0FUQ19SR0JBKTtcbn1cblxuLyoqXG4gKiBMaXN0IG9mIGRpc3RpbmN0IHBvaW50cy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUFJJTUlUSVZFX1BPSU5UUyA9IDA7XG5cbi8qKlxuICogRGlzY3JldGUgbGlzdCBvZiBsaW5lIHNlZ21lbnRzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQUklNSVRJVkVfTElORVMgPSAxO1xuXG4vKipcbiAqIExpc3Qgb2YgcG9pbnRzIHRoYXQgYXJlIGxpbmtlZCBzZXF1ZW50aWFsbHkgYnkgbGluZSBzZWdtZW50cywgd2l0aCBhIGNsb3NpbmcgbGluZSBzZWdtZW50XG4gKiBiZXR3ZWVuIHRoZSBsYXN0IGFuZCBmaXJzdCBwb2ludHMuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFBSSU1JVElWRV9MSU5FTE9PUCA9IDI7XG5cbi8qKlxuICogTGlzdCBvZiBwb2ludHMgdGhhdCBhcmUgbGlua2VkIHNlcXVlbnRpYWxseSBieSBsaW5lIHNlZ21lbnRzLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQUklNSVRJVkVfTElORVNUUklQID0gMztcblxuLyoqXG4gKiBEaXNjcmV0ZSBsaXN0IG9mIHRyaWFuZ2xlcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUFJJTUlUSVZFX1RSSUFOR0xFUyA9IDQ7XG5cbi8qKlxuICogQ29ubmVjdGVkIHN0cmlwIG9mIHRyaWFuZ2xlcyB3aGVyZSBhIHNwZWNpZmllZCB2ZXJ0ZXggZm9ybXMgYSB0cmlhbmdsZSB1c2luZyB0aGUgcHJldmlvdXMgdHdvLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBQUklNSVRJVkVfVFJJU1RSSVAgPSA1O1xuXG4vKipcbiAqIENvbm5lY3RlZCBmYW4gb2YgdHJpYW5nbGVzIHdoZXJlIHRoZSBmaXJzdCB2ZXJ0ZXggZm9ybXMgdHJpYW5nbGVzIHdpdGggdGhlIGZvbGxvd2luZyBwYWlycyBvZiB2ZXJ0aWNlcy5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgUFJJTUlUSVZFX1RSSUZBTiA9IDY7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIGEgcG9zaXRpb24uXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1BPU0lUSU9OID0gXCJQT1NJVElPTlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIG5vcm1hbC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfTk9STUFMID0gXCJOT1JNQUxcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHRvIGJlIHRyZWF0ZWQgYXMgYSB0YW5nZW50LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19UQU5HRU5UID0gXCJUQU5HRU5UXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIHNraW4gYmxlbmQgd2VpZ2h0cy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQkxFTkRXRUlHSFQgPSBcIkJMRU5EV0VJR0hUXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB0byBiZSB0cmVhdGVkIGFzIHNraW4gYmxlbmQgaW5kaWNlcy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQkxFTkRJTkRJQ0VTID0gXCJCTEVORElORElDRVNcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHRvIGJlIHRyZWF0ZWQgYXMgYSBjb2xvci5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQ09MT1IgPSBcIkNPTE9SXCI7XG5cbi8vIHByaXZhdGUgc2VtYW50aWMgdXNlZCBmb3IgcHJvZ3JhbW1hdGljIGNvbnN0cnVjdGlvbiBvZiBpbmRpdmlkdWFsIHRleGNvb3JkIHNlbWFudGljc1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX1RFWENPT1JEID0gXCJURVhDT09SRFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDApLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDAgPSBcIlRFWENPT1JEMFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDEpLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDEgPSBcIlRFWENPT1JEMVwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDIpLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDIgPSBcIlRFWENPT1JEMlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDMpLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDMgPSBcIlRFWENPT1JEM1wiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDQpLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDQgPSBcIlRFWENPT1JENFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDUpLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDUgPSBcIlRFWENPT1JENVwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDYpLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDYgPSBcIlRFWENPT1JENlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgdG8gYmUgdHJlYXRlZCBhcyBhIHRleHR1cmUgY29vcmRpbmF0ZSAoc2V0IDcpLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19URVhDT09SRDcgPSBcIlRFWENPT1JEN1wiO1xuXG4vLyBwcml2YXRlIHNlbWFudGljIHVzZWQgZm9yIHByb2dyYW1tYXRpYyBjb25zdHJ1Y3Rpb24gb2YgaW5kaXZpZHVhbCBhdHRyIHNlbWFudGljc1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIgPSBcIkFUVFJcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIwID0gXCJBVFRSMFwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjEgPSBcIkFUVFIxXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMiA9IFwiQVRUUjJcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIzID0gXCJBVFRSM1wiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjQgPSBcIkFUVFI0XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSNSA9IFwiQVRUUjVcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFI2ID0gXCJBVFRSNlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjcgPSBcIkFUVFI3XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSOCA9IFwiQVRUUjhcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFI5ID0gXCJBVFRSOVwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjEwID0gXCJBVFRSMTBcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIxMSA9IFwiQVRUUjExXCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTIgPSBcIkFUVFIxMlwiO1xuXG4vKipcbiAqIFZlcnRleCBhdHRyaWJ1dGUgd2l0aCBhIHVzZXIgZGVmaW5lZCBzZW1hbnRpYy5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0VNQU5USUNfQVRUUjEzID0gXCJBVFRSMTNcIjtcblxuLyoqXG4gKiBWZXJ0ZXggYXR0cmlidXRlIHdpdGggYSB1c2VyIGRlZmluZWQgc2VtYW50aWMuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFNFTUFOVElDX0FUVFIxNCA9IFwiQVRUUjE0XCI7XG5cbi8qKlxuICogVmVydGV4IGF0dHJpYnV0ZSB3aXRoIGEgdXNlciBkZWZpbmVkIHNlbWFudGljLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTRU1BTlRJQ19BVFRSMTUgPSBcIkFUVFIxNVwiO1xuXG5leHBvcnQgY29uc3QgU0hBREVSVEFHX01BVEVSSUFMID0gMTtcblxuLyoqXG4gKiBEb24ndCBjaGFuZ2UgdGhlIHN0ZW5jaWwgYnVmZmVyIHZhbHVlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfS0VFUCA9IDA7XG5cbi8qKlxuICogU2V0IHZhbHVlIHRvIHplcm8uXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNURU5DSUxPUF9aRVJPID0gMTtcblxuLyoqXG4gKiBSZXBsYWNlIHZhbHVlIHdpdGggdGhlIHJlZmVyZW5jZSB2YWx1ZSAoc2VlIHtAbGluayBTdGVuY2lsUGFyYW1ldGVyc30pLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBTVEVOQ0lMT1BfUkVQTEFDRSA9IDI7XG5cbi8qKlxuICogSW5jcmVtZW50IHRoZSB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU1RFTkNJTE9QX0lOQ1JFTUVOVCA9IDM7XG5cbi8qKlxuICogSW5jcmVtZW50IHRoZSB2YWx1ZSBidXQgd3JhcCBpdCB0byB6ZXJvIHdoZW4gaXQncyBsYXJnZXIgdGhhbiBhIG1heGltdW0gcmVwcmVzZW50YWJsZSB2YWx1ZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU1RFTkNJTE9QX0lOQ1JFTUVOVFdSQVAgPSA0O1xuXG4vKipcbiAqIERlY3JlbWVudCB0aGUgdmFsdWUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFNURU5DSUxPUF9ERUNSRU1FTlQgPSA1O1xuXG4vKipcbiAqIERlY3JlbWVudCB0aGUgdmFsdWUgYnV0IHdyYXAgaXQgdG8gYSBtYXhpbXVtIHJlcHJlc2VudGFibGUgdmFsdWUgaWYgdGhlIGN1cnJlbnQgdmFsdWUgaXMgMC5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU1RFTkNJTE9QX0RFQ1JFTUVOVFdSQVAgPSA2O1xuXG4vKipcbiAqIEludmVydCB0aGUgdmFsdWUgYml0d2lzZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgU1RFTkNJTE9QX0lOVkVSVCA9IDc7XG5cbi8qKlxuICogUmVhZCBvbmx5LiBBbnkgY2hhbmdlcyB0byB0aGUgbG9ja2VkIG1pcCBsZXZlbCdzIHBpeGVscyB3aWxsIG5vdCB1cGRhdGUgdGhlIHRleHR1cmUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVMT0NLX1JFQUQgPSAxO1xuXG4vKipcbiAqIFdyaXRlIG9ubHkuIFRoZSBjb250ZW50cyBvZiB0aGUgc3BlY2lmaWVkIG1pcCBsZXZlbCB3aWxsIGJlIGVudGlyZWx5IHJlcGxhY2VkLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFTE9DS19XUklURSA9IDI7XG5cbi8qKlxuICogVGV4dHVyZSBpcyBhIGRlZmF1bHQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRVRZUEVfREVGQVVMVCA9ICdkZWZhdWx0JztcblxuLyoqXG4gKiBUZXh0dXJlIHN0b3JlcyBoaWdoIGR5bmFtaWMgcmFuZ2UgZGF0YSBpbiBSR0JNIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRVRZUEVfUkdCTSA9ICdyZ2JtJztcblxuLyoqXG4gKiBUZXh0dXJlIHN0b3JlcyBoaWdoIGR5bmFtaWMgcmFuZ2UgZGF0YSBpbiBSR0JFIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRVRZUEVfUkdCRSA9ICdyZ2JlJztcblxuLyoqXG4gKiBUZXh0dXJlIHN0b3JlcyBoaWdoIGR5bmFtaWMgcmFuZ2UgZGF0YSBpbiBSR0JQIGVuY29kaW5nLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFVFlQRV9SR0JQID0gJ3JnYnAnO1xuXG4vKipcbiAqIFRleHR1cmUgc3RvcmVzIG5vcm1hbG1hcCBkYXRhIHN3aXp6bGVkIGluIEdHR1IgZm9ybWF0LiBUaGlzIGlzIHVzZWQgZm9yIHRhbmdlbnQgc3BhY2Ugbm9ybWFsXG4gKiBtYXBzLiBUaGUgUiBjb21wb25lbnQgaXMgc3RvcmVkIGluIGFscGhhIGFuZCBHIGlzIHN0b3JlZCBpbiBSR0IuIFRoaXMgcGFja2luZyBjYW4gcmVzdWx0IGluXG4gKiBoaWdoZXIgcXVhbGl0eSB3aGVuIHRoZSB0ZXh0dXJlIGRhdGEgaXMgY29tcHJlc3NlZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRVRZUEVfU1dJWlpMRUdHR1IgPSAnc3dpenpsZUdHR1InO1xuXG5leHBvcnQgY29uc3QgVEVYSElOVF9OT05FID0gMDtcbmV4cG9ydCBjb25zdCBURVhISU5UX1NIQURPV01BUCA9IDE7XG5leHBvcnQgY29uc3QgVEVYSElOVF9BU1NFVCA9IDI7XG5leHBvcnQgY29uc3QgVEVYSElOVF9MSUdIVE1BUCA9IDM7XG5cbmV4cG9ydCBjb25zdCBURVhUVVJFRElNRU5TSU9OXzFEID0gJzFkJztcbmV4cG9ydCBjb25zdCBURVhUVVJFRElNRU5TSU9OXzJEID0gJzJkJztcbmV4cG9ydCBjb25zdCBURVhUVVJFRElNRU5TSU9OXzJEX0FSUkFZID0gJzJkLWFycmF5JztcbmV4cG9ydCBjb25zdCBURVhUVVJFRElNRU5TSU9OX0NVQkUgPSAnY3ViZSc7XG5leHBvcnQgY29uc3QgVEVYVFVSRURJTUVOU0lPTl9DVUJFX0FSUkFZID0gJ2N1YmUtYXJyYXknO1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVESU1FTlNJT05fM0QgPSAnM2QnO1xuXG5leHBvcnQgY29uc3QgU0FNUExFVFlQRV9GTE9BVCA9IDA7XG5leHBvcnQgY29uc3QgU0FNUExFVFlQRV9VTkZJTFRFUkFCTEVfRkxPQVQgPSAxO1xuZXhwb3J0IGNvbnN0IFNBTVBMRVRZUEVfREVQVEggPSAyO1xuXG4vKipcbiAqIFRleHR1cmUgZGF0YSBpcyBub3Qgc3RvcmVkIGEgc3BlY2lmaWMgcHJvamVjdGlvbiBmb3JtYXQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVQUk9KRUNUSU9OX05PTkUgPSBcIm5vbmVcIjtcblxuLyoqXG4gKiBUZXh0dXJlIGRhdGEgaXMgc3RvcmVkIGluIGN1YmVtYXAgcHJvamVjdGlvbiBmb3JtYXQuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IFRFWFRVUkVQUk9KRUNUSU9OX0NVQkUgPSBcImN1YmVcIjtcblxuLyoqXG4gKiBUZXh0dXJlIGRhdGEgaXMgc3RvcmVkIGluIGVxdWlyZWN0YW5ndWxhciBwcm9qZWN0aW9uIGZvcm1hdC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgVEVYVFVSRVBST0pFQ1RJT05fRVFVSVJFQ1QgPSBcImVxdWlyZWN0XCI7XG5cbi8qKlxuICogVGV4dHVyZSBkYXRhIGlzIHN0b3JlZCBpbiBvY3RhaGVkcmFsIHByb2plY3Rpb24gZm9ybWF0LlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMID0gXCJvY3RhaGVkcmFsXCI7XG5cbi8qKlxuICogU2hhZGVyIHNvdXJjZSBjb2RlIHVzZXMgR0xTTCBsYW5ndWFnZS5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgU0hBREVSTEFOR1VBR0VfR0xTTCA9ICdnbHNsJztcblxuLyoqXG4gKiBTaGFkZXIgc291cmNlIGNvZGUgdXNlcyBXR1NMIGxhbmd1YWdlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBTSEFERVJMQU5HVUFHRV9XR1NMID0gJ3dnc2wnO1xuXG4vKipcbiAqIFNpZ25lZCBieXRlIHZlcnRleCBlbGVtZW50IHR5cGUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFRZUEVfSU5UOCA9IDA7XG5cbi8qKlxuICogVW5zaWduZWQgYnl0ZSB2ZXJ0ZXggZWxlbWVudCB0eXBlLlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbmV4cG9ydCBjb25zdCBUWVBFX1VJTlQ4ID0gMTtcblxuLyoqXG4gKiBTaWduZWQgc2hvcnQgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVFlQRV9JTlQxNiA9IDI7XG5cbi8qKlxuICogVW5zaWduZWQgc2hvcnQgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVFlQRV9VSU5UMTYgPSAzO1xuXG4vKipcbiAqIFNpZ25lZCBpbnRlZ2VyIHZlcnRleCBlbGVtZW50IHR5cGUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFRZUEVfSU5UMzIgPSA0O1xuXG4vKipcbiAqIFVuc2lnbmVkIGludGVnZXIgdmVydGV4IGVsZW1lbnQgdHlwZS5cbiAqXG4gKiBAdHlwZSB7bnVtYmVyfVxuICovXG5leHBvcnQgY29uc3QgVFlQRV9VSU5UMzIgPSA1O1xuXG4vKipcbiAqIEZsb2F0aW5nIHBvaW50IHZlcnRleCBlbGVtZW50IHR5cGUuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuZXhwb3J0IGNvbnN0IFRZUEVfRkxPQVQzMiA9IDY7XG5cbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9CT09MID0gMDtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9JTlQgPSAxO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0ZMT0FUID0gMjtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9WRUMyID0gMztcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9WRUMzID0gNDtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9WRUM0ID0gNTtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9JVkVDMiA9IDY7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfSVZFQzMgPSA3O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX0lWRUM0ID0gODtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9CVkVDMiA9IDk7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfQlZFQzMgPSAxMDtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9CVkVDNCA9IDExO1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX01BVDIgPSAxMjtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9NQVQzID0gMTM7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfTUFUNCA9IDE0O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1RFWFRVUkUyRCA9IDE1O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFID0gMTY7XG5leHBvcnQgY29uc3QgVU5JRk9STVRZUEVfRkxPQVRBUlJBWSA9IDE3O1xuZXhwb3J0IGNvbnN0IFVOSUZPUk1UWVBFX1RFWFRVUkUyRF9TSEFET1cgPSAxODtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9URVhUVVJFQ1VCRV9TSEFET1cgPSAxOTtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9URVhUVVJFM0QgPSAyMDtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9WRUMyQVJSQVkgPSAyMTtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9WRUMzQVJSQVkgPSAyMjtcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9WRUM0QVJSQVkgPSAyMztcbmV4cG9ydCBjb25zdCBVTklGT1JNVFlQRV9NQVQ0QVJSQVkgPSAyNDtcblxuZXhwb3J0IGNvbnN0IHVuaWZvcm1UeXBlVG9OYW1lID0gW1xuICAgICdib29sJyxcbiAgICAnaW50JyxcbiAgICAnZmxvYXQnLFxuICAgICd2ZWMyJyxcbiAgICAndmVjMycsXG4gICAgJ3ZlYzQnLFxuICAgICdpdmVjMicsXG4gICAgJ2l2ZWMzJyxcbiAgICAnaXZlYzQnLFxuICAgICdiZWMyJyxcbiAgICAnYmVjMycsXG4gICAgJ2JlYzQnLFxuICAgICdtYXQyJyxcbiAgICAnbWF0MycsXG4gICAgJ21hdDQnLFxuICAgICdzYW1wbGVyMkQnLFxuICAgICdzYW1wbGVyQ3ViZScsXG4gICAgJycsIC8vIG5vdCBkaXJlY3RseSBoYW5kbGVkOiBVTklGT1JNVFlQRV9GTE9BVEFSUkFZXG4gICAgJ3NhbXBsZXIyRFNoYWRvdycsXG4gICAgJ3NhbXBsZXJDdWJlU2hhZG93JyxcbiAgICAnc2FtcGxlcjNEJyxcbiAgICAnJywgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX1ZFQzJBUlJBWVxuICAgICcnLCAvLyBub3QgZGlyZWN0bHkgaGFuZGxlZDogVU5JRk9STVRZUEVfVkVDM0FSUkFZXG4gICAgJycgLy8gbm90IGRpcmVjdGx5IGhhbmRsZWQ6IFVOSUZPUk1UWVBFX1ZFQzRBUlJBWVxuXTtcblxuLyoqXG4gKiBBIFdlYkdMIDEgZGV2aWNlIHR5cGUuXG4gKlxuICogQHR5cGUge3N0cmluZ31cbiAqL1xuZXhwb3J0IGNvbnN0IERFVklDRVRZUEVfV0VCR0wxID0gJ3dlYmdsMSc7XG5cbi8qKlxuICogQSBXZWJHTCAyIGRldmljZSB0eXBlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBERVZJQ0VUWVBFX1dFQkdMMiA9ICd3ZWJnbDInO1xuXG4vKipcbiAqIEEgV2ViR1BVIGRldmljZSB0eXBlLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbmV4cG9ydCBjb25zdCBERVZJQ0VUWVBFX1dFQkdQVSA9ICd3ZWJncHUnO1xuXG4vLyAoYml0LWZsYWdzKSBzaGFkZXIgc3RhZ2VzIGZvciByZXNvdXJjZSB2aXNpYmlsaXR5IG9uIHRoZSBHUFVcbmV4cG9ydCBjb25zdCBTSEFERVJTVEFHRV9WRVJURVggPSAxO1xuZXhwb3J0IGNvbnN0IFNIQURFUlNUQUdFX0ZSQUdNRU5UID0gMjtcbmV4cG9ydCBjb25zdCBTSEFERVJTVEFHRV9DT01QVVRFID0gNDtcblxuLy8gaW5kaWNlcyBvZiBjb21tb25seSB1c2VkIGJpbmQgZ3JvdXBzXG4vLyBzb3J0ZWQgaW4gYSB3YXkgdGhhdCBhbnkgdHJhaWxpbmcgYmluZCBncm91cHMgY2FuIGJlIHVudXNlZCBpbiBhbnkgcmVuZGVyIHBhc3NcbmV4cG9ydCBjb25zdCBCSU5ER1JPVVBfTUVTSCA9IDA7XG5leHBvcnQgY29uc3QgQklOREdST1VQX1ZJRVcgPSAxO1xuXG4vLyBuYW1lIG9mIHRoZSBkZWZhdWx0IHVuaWZvcm0gYnVmZmVyIHNsb3QgaW4gYSBiaW5kIGdyb3VwXG5leHBvcnQgY29uc3QgVU5JRk9STV9CVUZGRVJfREVGQVVMVF9TTE9UX05BTUUgPSAnZGVmYXVsdCc7XG5cbi8vIG5hbWVzIG9mIGJpbmQgZ3JvdXBzXG5leHBvcnQgY29uc3QgYmluZEdyb3VwTmFtZXMgPSBbJ3ZpZXcnLCAnbWVzaCddO1xuXG4vLyBtYXAgb2YgZW5naW5lIFRZUEVfKioqIGVudW1zIHRvIHRoZWlyIGNvcnJlc3BvbmRpbmcgdHlwZWQgYXJyYXkgY29uc3RydWN0b3JzIGFuZCBieXRlIHNpemVzXG5leHBvcnQgY29uc3QgdHlwZWRBcnJheVR5cGVzID0gW0ludDhBcnJheSwgVWludDhBcnJheSwgSW50MTZBcnJheSwgVWludDE2QXJyYXksIEludDMyQXJyYXksIFVpbnQzMkFycmF5LCBGbG9hdDMyQXJyYXldO1xuZXhwb3J0IGNvbnN0IHR5cGVkQXJyYXlUeXBlc0J5dGVTaXplID0gWzEsIDEsIDIsIDIsIDQsIDQsIDRdO1xuZXhwb3J0IGNvbnN0IHZlcnRleFR5cGVzTmFtZXMgPSBbJ0lOVDgnLCAnVUlOVDgnLCAnSU5UMTYnLCAnVUlOVDE2JywgJ0lOVDMyJywgJ1VJTlQzMicsICdGTE9BVDMyJ107XG5cbi8vIG1hcCBvZiB0eXBlZCBhcnJheSB0byBlbmdpbmUgVFlQRV8qKipcbmV4cG9ydCBjb25zdCB0eXBlZEFycmF5VG9UeXBlID0ge1xuICAgIFwiSW50OEFycmF5XCI6IFRZUEVfSU5UOCxcbiAgICBcIlVpbnQ4QXJyYXlcIjogVFlQRV9VSU5UOCxcbiAgICBcIkludDE2QXJyYXlcIjogVFlQRV9JTlQxNixcbiAgICBcIlVpbnQxNkFycmF5XCI6IFRZUEVfVUlOVDE2LFxuICAgIFwiSW50MzJBcnJheVwiOiBUWVBFX0lOVDMyLFxuICAgIFwiVWludDMyQXJyYXlcIjogVFlQRV9VSU5UMzIsXG4gICAgXCJGbG9hdDMyQXJyYXlcIjogVFlQRV9GTE9BVDMyXG59O1xuXG4vLyBtYXAgb2YgZW5naW5lIElOREVYRk9STUFUXyoqKiB0byB0aGVpciBjb3JyZXNwb25kaW5nIHR5cGVkIGFycmF5IGNvbnN0cnVjdG9ycyBhbmQgYnl0ZSBzaXplc1xuZXhwb3J0IGNvbnN0IHR5cGVkQXJyYXlJbmRleEZvcm1hdHMgPSBbVWludDhBcnJheSwgVWludDE2QXJyYXksIFVpbnQzMkFycmF5XTtcbmV4cG9ydCBjb25zdCB0eXBlZEFycmF5SW5kZXhGb3JtYXRzQnl0ZVNpemUgPSBbMSwgMiwgNF07XG5cbi8vIG1hcCBvZiBlbmdpbmUgUElYRUxGT1JNQVRfKioqIGVudW1zIHRvIHRoZSBwaXhlbCBieXRlIHNpemVcbmV4cG9ydCBjb25zdCBwaXhlbEZvcm1hdEJ5dGVTaXplcyA9IFtdO1xucGl4ZWxGb3JtYXRCeXRlU2l6ZXNbUElYRUxGT1JNQVRfQThdID0gMTtcbnBpeGVsRm9ybWF0Qnl0ZVNpemVzW1BJWEVMRk9STUFUX0w4XSA9IDE7XG5waXhlbEZvcm1hdEJ5dGVTaXplc1tQSVhFTEZPUk1BVF9MQThdID0gMjtcbnBpeGVsRm9ybWF0Qnl0ZVNpemVzW1BJWEVMRk9STUFUX1JHQjU2NV0gPSAyO1xucGl4ZWxGb3JtYXRCeXRlU2l6ZXNbUElYRUxGT1JNQVRfUkdCQTU1NTFdID0gMjtcbnBpeGVsRm9ybWF0Qnl0ZVNpemVzW1BJWEVMRk9STUFUX1JHQkE0XSA9IDI7XG5waXhlbEZvcm1hdEJ5dGVTaXplc1tQSVhFTEZPUk1BVF9SR0I4XSA9IDQ7XG5waXhlbEZvcm1hdEJ5dGVTaXplc1tQSVhFTEZPUk1BVF9SR0JBOF0gPSA0O1xucGl4ZWxGb3JtYXRCeXRlU2l6ZXNbUElYRUxGT1JNQVRfUkdCMTZGXSA9IDg7XG5waXhlbEZvcm1hdEJ5dGVTaXplc1tQSVhFTEZPUk1BVF9SR0JBMTZGXSA9IDg7XG5waXhlbEZvcm1hdEJ5dGVTaXplc1tQSVhFTEZPUk1BVF9SR0IzMkZdID0gMTY7XG5waXhlbEZvcm1hdEJ5dGVTaXplc1tQSVhFTEZPUk1BVF9SR0JBMzJGXSA9IDE2O1xucGl4ZWxGb3JtYXRCeXRlU2l6ZXNbUElYRUxGT1JNQVRfUjMyRl0gPSA0O1xucGl4ZWxGb3JtYXRCeXRlU2l6ZXNbUElYRUxGT1JNQVRfREVQVEhdID0gNDsgLy8gY2FuIGJlIHNtYWxsZXIgdXNpbmcgV2ViR0wxIGV4dGVuc2lvbj9cbnBpeGVsRm9ybWF0Qnl0ZVNpemVzW1BJWEVMRk9STUFUX0RFUFRIU1RFTkNJTF0gPSA0O1xucGl4ZWxGb3JtYXRCeXRlU2l6ZXNbUElYRUxGT1JNQVRfMTExMTEwRl0gPSA0O1xucGl4ZWxGb3JtYXRCeXRlU2l6ZXNbUElYRUxGT1JNQVRfU1JHQl0gPSA0O1xucGl4ZWxGb3JtYXRCeXRlU2l6ZXNbUElYRUxGT1JNQVRfU1JHQkFdID0gNDtcblxuLyoqXG4gKiBNYXAgb2YgZW5naW5lIHNlbWFudGljcyBpbnRvIGxvY2F0aW9uIG9uIGRldmljZSBpbiByYW5nZSAwLi4xNSAobm90ZSAtIHNlbWFudGljcyBtYXBwaW5nIHRvIHRoZVxuICogc2FtZSBsb2NhdGlvbiBjYW5ub3QgYmUgdXNlZCBhdCB0aGUgc2FtZSB0aW1lKSBvcmdhbml6ZWQgaW4gYSB3YXkgdGhhdCBBVFRSMC1BVFRSNyBkbyBub3RcbiAqIG92ZXJsYXAgd2l0aCBjb21tb24gaW1wb3J0YW50IHNlbWFudGljcy5cbiAqXG4gKiBAdHlwZSB7b2JqZWN0fVxuICogQGlnbm9yZVxuICovXG5leHBvcnQgY29uc3Qgc2VtYW50aWNUb0xvY2F0aW9uID0ge307XG5cbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19QT1NJVElPTl0gPSAwO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX05PUk1BTF0gPSAxO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0JMRU5EV0VJR0hUXSA9IDI7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQkxFTkRJTkRJQ0VTXSA9IDM7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQ09MT1JdID0gNDtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDBdID0gNTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDFdID0gNjtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDJdID0gNztcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDNdID0gODtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDRdID0gOTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19URVhDT09SRDVdID0gMTA7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfVEVYQ09PUkQ2XSA9IDExO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX1RFWENPT1JEN10gPSAxMjtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19UQU5HRU5UXSA9IDEzO1xuXG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjBdID0gMDtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSMV0gPSAxO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIyXSA9IDI7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjNdID0gMztcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSNF0gPSA0O1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFI1XSA9IDU7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjZdID0gNjtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSN10gPSA3O1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFI4XSA9IDg7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjldID0gOTtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSMTBdID0gMTA7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjExXSA9IDExO1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIxMl0gPSAxMjtcbnNlbWFudGljVG9Mb2NhdGlvbltTRU1BTlRJQ19BVFRSMTNdID0gMTM7XG5zZW1hbnRpY1RvTG9jYXRpb25bU0VNQU5USUNfQVRUUjE0XSA9IDE0O1xuc2VtYW50aWNUb0xvY2F0aW9uW1NFTUFOVElDX0FUVFIxNV0gPSAxNTtcblxuLyoqXG4gKiBDaHVuayBBUEkgdmVyc2lvbnNcbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5leHBvcnQgY29uc3QgQ0hVTktBUElfMV81MSA9ICcxLjUxJztcbmV4cG9ydCBjb25zdCBDSFVOS0FQSV8xXzU1ID0gJzEuNTUnO1xuZXhwb3J0IGNvbnN0IENIVU5LQVBJXzFfNTYgPSAnMS41Nic7XG5leHBvcnQgY29uc3QgQ0hVTktBUElfMV81NyA9ICcxLjU3JztcbmV4cG9ydCBjb25zdCBDSFVOS0FQSV8xXzU4ID0gJzEuNTgnO1xuZXhwb3J0IGNvbnN0IENIVU5LQVBJXzFfNjAgPSAnMS42MCc7XG5leHBvcnQgY29uc3QgQ0hVTktBUElfMV82MiA9ICcxLjYyJztcbiJdLCJuYW1lcyI6WyJBRERSRVNTX1JFUEVBVCIsIkFERFJFU1NfQ0xBTVBfVE9fRURHRSIsIkFERFJFU1NfTUlSUk9SRURfUkVQRUFUIiwiQkxFTkRNT0RFX1pFUk8iLCJCTEVORE1PREVfT05FIiwiQkxFTkRNT0RFX1NSQ19DT0xPUiIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfU1JDX0NPTE9SIiwiQkxFTkRNT0RFX0RTVF9DT0xPUiIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfRFNUX0NPTE9SIiwiQkxFTkRNT0RFX1NSQ19BTFBIQSIsIkJMRU5ETU9ERV9TUkNfQUxQSEFfU0FUVVJBVEUiLCJCTEVORE1PREVfT05FX01JTlVTX1NSQ19BTFBIQSIsIkJMRU5ETU9ERV9EU1RfQUxQSEEiLCJCTEVORE1PREVfT05FX01JTlVTX0RTVF9BTFBIQSIsIkJMRU5ETU9ERV9DT05TVEFOVCIsIkJMRU5ETU9ERV9PTkVfTUlOVVNfQ09OU1RBTlQiLCJCTEVOREVRVUFUSU9OX0FERCIsIkJMRU5ERVFVQVRJT05fU1VCVFJBQ1QiLCJCTEVOREVRVUFUSU9OX1JFVkVSU0VfU1VCVFJBQ1QiLCJCTEVOREVRVUFUSU9OX01JTiIsIkJMRU5ERVFVQVRJT05fTUFYIiwiQlVGRkVSX1NUQVRJQyIsIkJVRkZFUl9EWU5BTUlDIiwiQlVGRkVSX1NUUkVBTSIsIkJVRkZFUl9HUFVEWU5BTUlDIiwiQ0xFQVJGTEFHX0NPTE9SIiwiQ0xFQVJGTEFHX0RFUFRIIiwiQ0xFQVJGTEFHX1NURU5DSUwiLCJDVUJFRkFDRV9QT1NYIiwiQ1VCRUZBQ0VfTkVHWCIsIkNVQkVGQUNFX1BPU1kiLCJDVUJFRkFDRV9ORUdZIiwiQ1VCRUZBQ0VfUE9TWiIsIkNVQkVGQUNFX05FR1oiLCJDVUxMRkFDRV9OT05FIiwiQ1VMTEZBQ0VfQkFDSyIsIkNVTExGQUNFX0ZST05UIiwiQ1VMTEZBQ0VfRlJPTlRBTkRCQUNLIiwiRklMVEVSX05FQVJFU1QiLCJGSUxURVJfTElORUFSIiwiRklMVEVSX05FQVJFU1RfTUlQTUFQX05FQVJFU1QiLCJGSUxURVJfTkVBUkVTVF9NSVBNQVBfTElORUFSIiwiRklMVEVSX0xJTkVBUl9NSVBNQVBfTkVBUkVTVCIsIkZJTFRFUl9MSU5FQVJfTUlQTUFQX0xJTkVBUiIsIkZVTkNfTkVWRVIiLCJGVU5DX0xFU1MiLCJGVU5DX0VRVUFMIiwiRlVOQ19MRVNTRVFVQUwiLCJGVU5DX0dSRUFURVIiLCJGVU5DX05PVEVRVUFMIiwiRlVOQ19HUkVBVEVSRVFVQUwiLCJGVU5DX0FMV0FZUyIsIklOREVYRk9STUFUX1VJTlQ4IiwiSU5ERVhGT1JNQVRfVUlOVDE2IiwiSU5ERVhGT1JNQVRfVUlOVDMyIiwiUElYRUxGT1JNQVRfQTgiLCJQSVhFTEZPUk1BVF9MOCIsIlBJWEVMRk9STUFUX0xBOCIsIlBJWEVMRk9STUFUX1JHQjU2NSIsIlBJWEVMRk9STUFUX1JHQkE1NTUxIiwiUElYRUxGT1JNQVRfUkdCQTQiLCJQSVhFTEZPUk1BVF9SR0I4IiwiUElYRUxGT1JNQVRfUkdCQTgiLCJQSVhFTEZPUk1BVF9EWFQxIiwiUElYRUxGT1JNQVRfRFhUMyIsIlBJWEVMRk9STUFUX0RYVDUiLCJQSVhFTEZPUk1BVF9SR0IxNkYiLCJQSVhFTEZPUk1BVF9SR0JBMTZGIiwiUElYRUxGT1JNQVRfUkdCMzJGIiwiUElYRUxGT1JNQVRfUkdCQTMyRiIsIlBJWEVMRk9STUFUX1IzMkYiLCJQSVhFTEZPUk1BVF9ERVBUSCIsIlBJWEVMRk9STUFUX0RFUFRIU1RFTkNJTCIsIlBJWEVMRk9STUFUXzExMTExMEYiLCJQSVhFTEZPUk1BVF9TUkdCIiwiUElYRUxGT1JNQVRfU1JHQkEiLCJQSVhFTEZPUk1BVF9FVEMxIiwiUElYRUxGT1JNQVRfRVRDMl9SR0IiLCJQSVhFTEZPUk1BVF9FVEMyX1JHQkEiLCJQSVhFTEZPUk1BVF9QVlJUQ18yQlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfMkJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9QVlJUQ180QlBQX1JHQl8xIiwiUElYRUxGT1JNQVRfUFZSVENfNEJQUF9SR0JBXzEiLCJQSVhFTEZPUk1BVF9BU1RDXzR4NCIsIlBJWEVMRk9STUFUX0FUQ19SR0IiLCJQSVhFTEZPUk1BVF9BVENfUkdCQSIsIlBJWEVMRk9STUFUX0JHUkE4IiwiaXNDb21wcmVzc2VkUGl4ZWxGb3JtYXQiLCJmb3JtYXQiLCJQUklNSVRJVkVfUE9JTlRTIiwiUFJJTUlUSVZFX0xJTkVTIiwiUFJJTUlUSVZFX0xJTkVMT09QIiwiUFJJTUlUSVZFX0xJTkVTVFJJUCIsIlBSSU1JVElWRV9UUklBTkdMRVMiLCJQUklNSVRJVkVfVFJJU1RSSVAiLCJQUklNSVRJVkVfVFJJRkFOIiwiU0VNQU5USUNfUE9TSVRJT04iLCJTRU1BTlRJQ19OT1JNQUwiLCJTRU1BTlRJQ19UQU5HRU5UIiwiU0VNQU5USUNfQkxFTkRXRUlHSFQiLCJTRU1BTlRJQ19CTEVORElORElDRVMiLCJTRU1BTlRJQ19DT0xPUiIsIlNFTUFOVElDX1RFWENPT1JEIiwiU0VNQU5USUNfVEVYQ09PUkQwIiwiU0VNQU5USUNfVEVYQ09PUkQxIiwiU0VNQU5USUNfVEVYQ09PUkQyIiwiU0VNQU5USUNfVEVYQ09PUkQzIiwiU0VNQU5USUNfVEVYQ09PUkQ0IiwiU0VNQU5USUNfVEVYQ09PUkQ1IiwiU0VNQU5USUNfVEVYQ09PUkQ2IiwiU0VNQU5USUNfVEVYQ09PUkQ3IiwiU0VNQU5USUNfQVRUUiIsIlNFTUFOVElDX0FUVFIwIiwiU0VNQU5USUNfQVRUUjEiLCJTRU1BTlRJQ19BVFRSMiIsIlNFTUFOVElDX0FUVFIzIiwiU0VNQU5USUNfQVRUUjQiLCJTRU1BTlRJQ19BVFRSNSIsIlNFTUFOVElDX0FUVFI2IiwiU0VNQU5USUNfQVRUUjciLCJTRU1BTlRJQ19BVFRSOCIsIlNFTUFOVElDX0FUVFI5IiwiU0VNQU5USUNfQVRUUjEwIiwiU0VNQU5USUNfQVRUUjExIiwiU0VNQU5USUNfQVRUUjEyIiwiU0VNQU5USUNfQVRUUjEzIiwiU0VNQU5USUNfQVRUUjE0IiwiU0VNQU5USUNfQVRUUjE1IiwiU0hBREVSVEFHX01BVEVSSUFMIiwiU1RFTkNJTE9QX0tFRVAiLCJTVEVOQ0lMT1BfWkVSTyIsIlNURU5DSUxPUF9SRVBMQUNFIiwiU1RFTkNJTE9QX0lOQ1JFTUVOVCIsIlNURU5DSUxPUF9JTkNSRU1FTlRXUkFQIiwiU1RFTkNJTE9QX0RFQ1JFTUVOVCIsIlNURU5DSUxPUF9ERUNSRU1FTlRXUkFQIiwiU1RFTkNJTE9QX0lOVkVSVCIsIlRFWFRVUkVMT0NLX1JFQUQiLCJURVhUVVJFTE9DS19XUklURSIsIlRFWFRVUkVUWVBFX0RFRkFVTFQiLCJURVhUVVJFVFlQRV9SR0JNIiwiVEVYVFVSRVRZUEVfUkdCRSIsIlRFWFRVUkVUWVBFX1JHQlAiLCJURVhUVVJFVFlQRV9TV0laWkxFR0dHUiIsIlRFWEhJTlRfTk9ORSIsIlRFWEhJTlRfU0hBRE9XTUFQIiwiVEVYSElOVF9BU1NFVCIsIlRFWEhJTlRfTElHSFRNQVAiLCJURVhUVVJFRElNRU5TSU9OXzFEIiwiVEVYVFVSRURJTUVOU0lPTl8yRCIsIlRFWFRVUkVESU1FTlNJT05fMkRfQVJSQVkiLCJURVhUVVJFRElNRU5TSU9OX0NVQkUiLCJURVhUVVJFRElNRU5TSU9OX0NVQkVfQVJSQVkiLCJURVhUVVJFRElNRU5TSU9OXzNEIiwiU0FNUExFVFlQRV9GTE9BVCIsIlNBTVBMRVRZUEVfVU5GSUxURVJBQkxFX0ZMT0FUIiwiU0FNUExFVFlQRV9ERVBUSCIsIlRFWFRVUkVQUk9KRUNUSU9OX05PTkUiLCJURVhUVVJFUFJPSkVDVElPTl9DVUJFIiwiVEVYVFVSRVBST0pFQ1RJT05fRVFVSVJFQ1QiLCJURVhUVVJFUFJPSkVDVElPTl9PQ1RBSEVEUkFMIiwiU0hBREVSTEFOR1VBR0VfR0xTTCIsIlNIQURFUkxBTkdVQUdFX1dHU0wiLCJUWVBFX0lOVDgiLCJUWVBFX1VJTlQ4IiwiVFlQRV9JTlQxNiIsIlRZUEVfVUlOVDE2IiwiVFlQRV9JTlQzMiIsIlRZUEVfVUlOVDMyIiwiVFlQRV9GTE9BVDMyIiwiVU5JRk9STVRZUEVfQk9PTCIsIlVOSUZPUk1UWVBFX0lOVCIsIlVOSUZPUk1UWVBFX0ZMT0FUIiwiVU5JRk9STVRZUEVfVkVDMiIsIlVOSUZPUk1UWVBFX1ZFQzMiLCJVTklGT1JNVFlQRV9WRUM0IiwiVU5JRk9STVRZUEVfSVZFQzIiLCJVTklGT1JNVFlQRV9JVkVDMyIsIlVOSUZPUk1UWVBFX0lWRUM0IiwiVU5JRk9STVRZUEVfQlZFQzIiLCJVTklGT1JNVFlQRV9CVkVDMyIsIlVOSUZPUk1UWVBFX0JWRUM0IiwiVU5JRk9STVRZUEVfTUFUMiIsIlVOSUZPUk1UWVBFX01BVDMiLCJVTklGT1JNVFlQRV9NQVQ0IiwiVU5JRk9STVRZUEVfVEVYVFVSRTJEIiwiVU5JRk9STVRZUEVfVEVYVFVSRUNVQkUiLCJVTklGT1JNVFlQRV9GTE9BVEFSUkFZIiwiVU5JRk9STVRZUEVfVEVYVFVSRTJEX1NIQURPVyIsIlVOSUZPUk1UWVBFX1RFWFRVUkVDVUJFX1NIQURPVyIsIlVOSUZPUk1UWVBFX1RFWFRVUkUzRCIsIlVOSUZPUk1UWVBFX1ZFQzJBUlJBWSIsIlVOSUZPUk1UWVBFX1ZFQzNBUlJBWSIsIlVOSUZPUk1UWVBFX1ZFQzRBUlJBWSIsIlVOSUZPUk1UWVBFX01BVDRBUlJBWSIsInVuaWZvcm1UeXBlVG9OYW1lIiwiREVWSUNFVFlQRV9XRUJHTDEiLCJERVZJQ0VUWVBFX1dFQkdMMiIsIkRFVklDRVRZUEVfV0VCR1BVIiwiU0hBREVSU1RBR0VfVkVSVEVYIiwiU0hBREVSU1RBR0VfRlJBR01FTlQiLCJTSEFERVJTVEFHRV9DT01QVVRFIiwiQklOREdST1VQX01FU0giLCJCSU5ER1JPVVBfVklFVyIsIlVOSUZPUk1fQlVGRkVSX0RFRkFVTFRfU0xPVF9OQU1FIiwiYmluZEdyb3VwTmFtZXMiLCJ0eXBlZEFycmF5VHlwZXMiLCJJbnQ4QXJyYXkiLCJVaW50OEFycmF5IiwiSW50MTZBcnJheSIsIlVpbnQxNkFycmF5IiwiSW50MzJBcnJheSIsIlVpbnQzMkFycmF5IiwiRmxvYXQzMkFycmF5IiwidHlwZWRBcnJheVR5cGVzQnl0ZVNpemUiLCJ2ZXJ0ZXhUeXBlc05hbWVzIiwidHlwZWRBcnJheVRvVHlwZSIsInR5cGVkQXJyYXlJbmRleEZvcm1hdHMiLCJ0eXBlZEFycmF5SW5kZXhGb3JtYXRzQnl0ZVNpemUiLCJwaXhlbEZvcm1hdEJ5dGVTaXplcyIsInNlbWFudGljVG9Mb2NhdGlvbiIsIkNIVU5LQVBJXzFfNTEiLCJDSFVOS0FQSV8xXzU1IiwiQ0hVTktBUElfMV81NiIsIkNIVU5LQVBJXzFfNTciLCJDSFVOS0FQSV8xXzU4IiwiQ0hVTktBUElfMV82MCIsIkNIVU5LQVBJXzFfNjIiXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQSxjQUFjLEdBQUcsRUFBQzs7QUFFL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHFCQUFxQixHQUFHLEVBQUM7O0FBRXRDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLHVCQUF1QixHQUFHLEVBQUM7O0FBRXhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxjQUFjLEdBQUcsRUFBQzs7QUFFL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLGFBQWEsR0FBRyxFQUFDOztBQUU5QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsbUJBQW1CLEdBQUcsRUFBQzs7QUFFcEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLDZCQUE2QixHQUFHLEVBQUM7O0FBRTlDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyxtQkFBbUIsR0FBRyxFQUFDOztBQUVwQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsNkJBQTZCLEdBQUcsRUFBQzs7QUFFOUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLG1CQUFtQixHQUFHLEVBQUM7O0FBRXBDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyw0QkFBNEIsR0FBRyxFQUFDOztBQUU3QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sTUFBTUMsNkJBQTZCLEdBQUcsRUFBQzs7QUFFOUM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLE1BQU1DLG1CQUFtQixHQUFHLEVBQUM7O0FBRXBDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxNQUFNQyw2QkFBNkIsR0FBRyxHQUFFOztBQUUvQztBQUNBO0FBQ0E7QUFDQTtB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
