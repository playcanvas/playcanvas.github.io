class KeyboardEvent {
  constructor(keyboard, event) {
    this.key = null;
    this.element = null;
    this.event = null;
    if (event) {
      this.key = event.keyCode;
      this.element = event.target;
      this.event = event;
    }
  }
}

export { KeyboardEvent };
