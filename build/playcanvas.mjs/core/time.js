const now = typeof window !== 'undefined' && window.performance && window.performance.now && window.performance.timing ? performance.now.bind(performance) : Date.now;

class Timer {
  constructor() {
    this._isRunning = false;
    this._a = 0;
    this._b = 0;
  }

  start() {
    this._isRunning = true;
    this._a = now();
  }

  stop() {
    this._isRunning = false;
    this._b = now();
  }

  getMilliseconds() {
    return this._b - this._a;
  }

}

export { Timer, now };
