export interface Handlers {
  ['exit']?: (...args: any[]) => any
  ['entry']?: (...args: any[]) => any
  ['*']?: (...args: any[]) => any
  [name:string]: (...args: any[]) => any
}

export type StateTable = { [name:string]: Handlers };

export class Machine {
  state:string = undefined;
  ready:Promise<any> = Promise.resolve(true);

  constructor(public states?:StateTable, initialState?:string) {
    if (initialState) {
      this.enter(initialState);
    }
  }

  process(name:string, ...args:any[]):Promise<any> {
    return this.ready.then(() => {
      if (name) {
        let handler = undefined;
        if (this.states[this.state]) {
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
    });
  }

  enter(state:string, ...args: any[]):Promise<any> {
    let oldState = this.states[this.state];
    let newState = this.states[state];
    let ret = this.ready.then(() => {
      if (this.state === state) {
        return Promise.resolve(true);
      } else if (!newState) {
        return Promise.reject(new Error('unknown_state'));
      } else {
        let p = Promise.resolve(true);
        if (oldState && oldState.exit) {
          p = p.then(() => Promise.resolve(oldState.exit.apply(this, args)));
        }

        this.state = state;
        if (newState.entry) {
          p = p.then(() => Promise.resolve(newState.entry.apply(this, args)));
        }
        return p;
      }
    });
    this.ready = ret.then(() => {}, () => {});
    return ret;
  }

  eventHandler(name:string): (...args: any[]) => Promise<any>;
  eventHandler(stateHandlers:Handlers): (...args: any[]) => Promise<any>;
  eventHandler(nameOrStateHandlers:any): (...args: any[]) => Promise<any> {
    return (...args: any[]) => {
      if (typeof(nameOrStateHandlers) === 'string') {
        return this.process(nameOrStateHandlers as string, ...args);
      } else {
        let ret = this.ready.then(() => {
          if (nameOrStateHandlers[this.state]) {
            return Promise.resolve(nameOrStateHandlers[this.state].apply(this, args));
          } else if (nameOrStateHandlers['*']) {
            return Promise.resolve(nameOrStateHandlers['*'].apply(this, args));
          } else {
            return Promise.reject(new Error('unhandled'));
          }
        });
        this.ready = ret.then(() => {}, () => {});
        return ret;
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
        h(args);
      }
    }
  }
}
