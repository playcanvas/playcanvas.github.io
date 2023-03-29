export class WordAtlas {
    constructor(texture: any, words: any);
    words: any;
    wordMap: {};
    placements: {
        l: number;
        r: number;
        a: number;
        d: number;
        x: number;
        y: number;
        w: number;
        h: number;
    }[];
    texture: any;
    render(render2d: any, word: any, x: any, y: any): number;
}
