export class CoreExporter {
    /**
     * Converts a texture to a canvas.
     *
     * @param {Texture} texture - The source texture to be converted.
     * @param {object} options - Object for passing optional arguments.
     * @param {Color} [options.color] - The tint color to modify the texture with.
     * @param {number} [options.maxTextureSize] - Maximum texture size. Texture is resized if over the size.
     * @returns {HTMLCanvasElement|undefined} - The canvas element containing the image.
     */
    textureToCanvas(texture: Texture, options?: {
        color?: Color;
        maxTextureSize?: number;
    }): HTMLCanvasElement | undefined;
}
