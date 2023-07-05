export class MiniStats {
    static getDefaultOptions(): {
        sizes: {
            width: number;
            height: number;
            spacing: number;
            graphs: boolean;
        }[];
        startSizeIndex: number;
        textRefreshRate: number;
        colors: {
            graph0: any;
            graph1: any;
            graph2: any;
            watermark: any;
            background: any;
        };
        cpu: {
            enabled: boolean;
            watermark: number;
        };
        gpu: {
            enabled: boolean;
            watermark: number;
        };
        stats: ({
            name: string;
            stats: string[];
            decimalPlaces: number;
            unitsName: string;
            watermark: number;
        } | {
            name: string;
            stats: string[];
            watermark: number;
            decimalPlaces?: undefined;
            unitsName?: undefined;
        })[];
    };
    constructor(app: any, options: any);
    _contextLostHandler: (event: any) => void;
    sizes: any;
    _activeSizeIndex: any;
    set opacity(arg: number);
    get opacity(): number;
    set activeSizeIndex(arg: any);
    get activeSizeIndex(): any;
    device: any;
    texture: any;
    wordAtlas: WordAtlas;
    render2d: Render2d;
    graphs: Graph[];
    div: HTMLDivElement;
    width: number;
    height: number;
    gspacing: number;
    clr: number[];
    _enabled: boolean;
    get overallHeight(): number;
    set enabled(arg: boolean);
    get enabled(): boolean;
    initWordAtlas(device: any, words: any, maxWidth: any, numGraphs: any): {
        atlas: WordAtlas;
        texture: any;
    };
    initGraphs(app: any, device: any, options: any): Graph[];
    render(): void;
    resize(width: any, height: any, showGraphs: any): void;
    updateDiv(): void;
}
import { WordAtlas } from './word-atlas.js';
import { Render2d } from './render2d.js';
import { Graph } from './graph.js';
