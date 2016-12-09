export interface Handlers {
  ['*']?: (...args: any[])=>void
  [name:string]: (...args: any[])=>void
}

export interface State {
  onEntry?: (...args: any[])=>void;
  onExit?: (...args: any[])=>void;
  events?: Handlers;
  transitions?: string[];
}

export type StateList = string[];
export type StateTable = { [name:string]: State };

export class Machine {
  lastEvent:string = undefined;
  state:string = undefined;
  states:StateTable = undefined;

  constructor(states?:StateList, initialState?:string);
  constructor(states?:StateTable, initialState?:string);
  constructor(states?:any, initialState?:string) {
    if (states) {
      this.init(states, initialState);
    }
  }

  init(states:StateList, initialState?:string):this;
  init(states:StateTable, initialState?:string):this;
  init(states:any, initialState?:string):this {
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
    } else {
      this.state = undefined;
    }
    return this;
  }

  protected process(name:string, ...args:any[]):any {
    if (name) {
      var { events: handlers } = this.states[this.state];

      if (handlers) {
        var handler = handlers[name] || handlers['*'];

        if (handler) {
          this.lastEvent = name;
          return handler.apply(this, args);
        }
      }
    }
  }

  enter(state:string, ...args: any[]):void {
    if (this.state === state) return;
    var oldState = this.states[this.state];
    if (oldState) {
      if (oldState.transitions && oldState.transitions.indexOf(state) === -1) {
        throw new Error('invalid_transition');
      }
      if (typeof oldState.onExit === 'function') {
        oldState.onExit.apply(this, args);
      }
    }

    var newState = this.states[state];
    if (!newState) {
      throw new Error('unknown_state');
    }
    this.state = state;
    if (typeof newState.onEntry === 'function') {
      newState.onEntry.apply(this, args);
    }
  }
  eventHandler(name:string): (...args: any[])=>void;
  eventHandler(stateHandlers:Handlers): (...args: any[])=>void;
  eventHandler(nameOrStateHandlers:any): (...args: any[])=>void {
    return (...args: any[]) => {
      if (typeof(nameOrStateHandlers) === 'string') {
        return this.process(nameOrStateHandlers as string, ...args);
      } else {
        if (nameOrStateHandlers[this.state]) {
          return nameOrStateHandlers[this.state].apply(this, args);
        } else if (nameOrStateHandlers['*']) {
          return nameOrStateHandlers['*'].apply(this, args);
        }
      }
    }
  }
}
