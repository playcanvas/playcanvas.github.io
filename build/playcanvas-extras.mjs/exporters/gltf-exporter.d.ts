export class GltfExporter extends CoreExporter {
    collectResources(root: any): {
        buffers: any[];
        cameras: any[];
        entities: any[];
        materials: any[];
        textures: any[];
        entityMeshInstances: any[];
        bufferViewMap: Map<any, any>;
    };
    writeBuffers(resources: any, json: any): void;
    writeBufferViews(resources: any, json: any): void;
    writeCameras(resources: any, json: any): void;
    writeMaterials(resources: any, json: any): void;
    writeNodes(resources: any, json: any): void;
    writeMeshes(resources: any, json: any): void;
    convertTextures(textures: any, json: any, options: any): void;
    buildJson(resources: any, options: any): {
        asset: {
            version: string;
            generator: string;
        };
        scenes: {
            nodes: number[];
        }[];
        images: any[];
        samplers: any[];
        textures: any[];
        scene: number;
    };
    /**
     * Converts a hierarchy of entities to GLB format.
     *
     * @param {Entity} entity - The root of the entity hierarchy to convert.
     * @param {object} options - Object for passing optional arguments.
     * @param {number} [options.maxTextureSize] - Maximum texture size. Texture is resized if over the size.
     * @returns {ArrayBuffer} - The GLB file content.
     */
    build(entity: Entity, options?: {
        maxTextureSize?: number;
    }): ArrayBuffer;
}
import { CoreExporter } from "./core-exporter.js";
