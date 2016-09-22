interface State {
  onEntry?: ()=>void;
  onExit?: ()=>void;
  transitions?: string[];
}

interface StateHandlers {
  ['*']?: (...args: any[])=>void
  [state:string]: (...args: any[])=>void
}

class Machine {
  state:string = undefined;

  constructor(private states:{ [name:string]: State }, initialState?:string) {
    if (initialState) {
      this.enter(initialState);
    }
  }
  enter(state:string):void {
    if (this.state === state) return;
    var oldState = this.states[this.state];
    if (oldState) {
      if (typeof oldState.onExit === 'function') {
        oldState.onExit.apply(this);
      }
      if (oldState.transitions && oldState.transitions.indexOf(state) === -1) {
        throw new Error('invalid_transition');
      }
    }

    var newState = this.states[state];
    if (!newState) {
      throw new Error('unknown_state');
    }
    this.state = state;
    if (typeof newState.onEntry === 'function') {
      newState.onEntry.apply(this);
    }
  }
  eventHandler(stateHandlers: StateHandlers): (...args: any[])=>void {
    return (...args: any[]) => {
      if (stateHandlers[this.state]) {
        stateHandlers[this.state].apply(this, args);
      } else if (stateHandlers['*']) {
        stateHandlers['*'].apply(this, args);
      }
    }
  }
}

export { Machine };