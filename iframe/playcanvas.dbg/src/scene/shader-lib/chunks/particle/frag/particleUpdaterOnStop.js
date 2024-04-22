var particleUpdaterOnStopPS = /* glsl */`
    visMode = outLife < 0.0? -1.0: visMode;
`;

export { particleUpdaterOnStopPS as default };
