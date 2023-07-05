const now = typeof window !== 'undefined' && window.performance && window.performance.now && window.performance.timing ? performance.now.bind(performance) : Date.now;

export { now };
