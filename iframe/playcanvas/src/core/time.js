const now = typeof window !== 'undefined' && window.performance && window.performance.now ? performance.now.bind(performance) : Date.now;

export { now };
