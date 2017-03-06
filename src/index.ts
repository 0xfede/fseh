export type EventHandler = (...args: any[]) => any;

export interface Handlers {
  ['exit']?: EventHandler
  ['entry']?: EventHandler
  ['*']?: EventHandler
  [name:string]: EventHandler | undefined
}

export type StateTable = { [name:string]: Handlers };

export class Machine {
  state?:string;
  ready:Promise<any> = Promise.resolve(true);

  constructor(public states:StateTable = {}, initialState?:string) {
    if (initialState) {
      this.ready = this.enter(initialState);
    }
  }

  process(name:string, ...args:any[]):Promise<any> {
    if (name) {
      let handler: EventHandler | undefined;
      if (this.state && this.states[this.state]) {
        handler = this.states[this.state][name] || this.states[this.state]['*'];
      }
      if (handler) {
        return Promise.resolve(handler.apply(this, args));
      } else {
        return Promise.reject(new Error('unhandled'));
      }
    } else {
      return Promise.reject(new Error('bad_event'));
    }
  }

  enter(state:string, ...args: any[]):Promise<any> {
    if (!state) {
      return Promise.reject(new Error('invalid_state'));
    }
    let oldState = this.state ? this.states[this.state] : undefined;
    let newState = this.states[state];
    if (this.state === state) {
      return Promise.resolve(true);
    } else if (!newState) {
      return Promise.reject(new Error('unknown_state'));
    } else {
      let p = Promise.resolve(true);
      p = p.then(() => {
        if (oldState && oldState.exit) {
          return Promise.resolve(oldState.exit.apply(this, args))
        }
      });

      this.state = state;
      p = p.then(() => {
        if (newState.entry) {
          return Promise.resolve(newState.entry.apply(this, args));
        }
      });
      return p;
    }
  }

  eventHandler(name:string): (...args: any[]) => Promise<any>;
  eventHandler(stateHandlers:Handlers): (...args: any[]) => Promise<any>;
  eventHandler(nameOrStateHandlers:any): (...args: any[]) => Promise<any> {
    return (...args: any[]) => {
      if (typeof(nameOrStateHandlers) === 'string') {
        return this.process(nameOrStateHandlers as string, ...args);
      } else {
        if (this.state && nameOrStateHandlers[this.state]) {
          return Promise.resolve(nameOrStateHandlers[this.state].apply(this, args));
        } else if (nameOrStateHandlers['*']) {
          return Promise.resolve(nameOrStateHandlers['*'].apply(this, args));
        } else {
          return Promise.reject(new Error('unhandled'));
        }
      }
    }
  }

  callbackEventHandler(name:string): (...args: any[]) => void;
  callbackEventHandler(stateHandlers:Handlers): (...args: any[]) => void;
  callbackEventHandler(nameOrStateHandlers:any): (...args: any[]) => void {
    let h = this.eventHandler(nameOrStateHandlers);
    return (...args: any[]) => {
      if (args.length && typeof args[args.length - 1] === 'function') {
        let cb = args.pop();
        h(args).then((...args:any[]) => {
          cb(null, ...args);
        }, err => {
          cb(err);
        });
      } else {
        h(...args);
      }
    }
  }
}
