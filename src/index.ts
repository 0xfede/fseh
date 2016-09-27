export interface State {
  onEntry?: ()=>void;
  onExit?: ()=>void;
  transitions?: string[];
}

export type StateList = string[];
export type StateTable = { [name:string]: State };

export interface StateHandlers {
  ['*']?: (...args: any[])=>void
  [state:string]: (...args: any[])=>void
}

export class Machine {
  state:string = undefined;
  states:StateTable = undefined;

  constructor(states:StateList, initialState?:string);
  constructor(states:StateTable, initialState?:string);
  constructor(states:any, initialState?:string) {
    if (Array.isArray(states)) {
      this.states = {};
      (states as StateList).forEach(s => {
        this.states[s] = {};
      });
    } else {
      this.states = states as StateTable;
    }
    if (initialState) {
      this.enter(initialState);
    }
  }

  enter(state:string):void {
    if (this.state === state) return;
    var oldState = this.states[this.state];
    if (oldState) {
      if (oldState.transitions && oldState.transitions.indexOf(state) === -1) {
        throw new Error('invalid_transition');
      }
      if (typeof oldState.onExit === 'function') {
        oldState.onExit.apply(this);
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
