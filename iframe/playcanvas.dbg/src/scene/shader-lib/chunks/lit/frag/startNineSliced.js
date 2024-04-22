var startNineSlicedPS = /* glsl */`
    nineSlicedUv = vUv0;
    nineSlicedUv.y = 1.0 - nineSlicedUv.y;

`;

export { startNineSlicedPS as default };
