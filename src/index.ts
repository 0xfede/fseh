export interface Handlers {
  ['*']?: (...args: any[])=>void
  [name:string]: (...args: any[])=>void
}

export interface State {
  onEntry?: ()=>void;
  onExit?: ()=>void;
  events?: Handlers;
  transitions?: string[];
}

export type StateList = string[];
export type StateTable = { [name:string]: State };

export class Event {
  constructor(public name:string, public args:any[]) {
  }
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

  private process(event:Event):void {
    if (event) {
      var { events: handlers } = this.states[this.state];

      if (handlers) {
        var handler = handlers[event.name] || handlers['*'];

        if (handler) {
          handler.apply(this, event.args);
        }
      }
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
  eventHandler(name:string): (...args: any[])=>void;
  eventHandler(stateHandlers:Handlers): (...args: any[])=>void;
  eventHandler(nameOrStateHandlers:any): (...args: any[])=>void {
    return (...args: any[]) => {
      if (typeof(nameOrStateHandlers) === 'string') {
        this.process(new Event(nameOrStateHandlers as string, args));
      } else {
        if (nameOrStateHandlers[this.state]) {
          nameOrStateHandlers[this.state].apply(this, args);
        } else if (nameOrStateHandlers['*']) {
          nameOrStateHandlers['*'].apply(this, args);
        }
      }
    }
  }
}
