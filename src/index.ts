export type EventHandler = (...args: any[]) => any;

export interface Handlers {
  ['exit']?: EventHandler
  ['entry']?: EventHandler
  ['*']?: EventHandler
  [name:string]: EventHandler | 'defer' | 'noop' | undefined
}

export type StateTable = { [name:string]: Handlers };

export class Machine {
  state?:string;
  ready:Promise<any> = Promise.resolve(true);
  protected deferredEvents: { event:string, args:any[] }[] = [];

  constructor(public states:StateTable = {}, initialState?:string) {
    if (initialState) {
      this.ready = this.enter(initialState);
    }
  }

  protected defer(event:string): EventHandler {
    return (...args:any[]) => {
      this.deferredEvents.push({ event, args });
    }
  }
  protected flushDeferred(): Promise<any> {
    let p = Promise.resolve();
    if (this.deferredEvents.length) {
      let e = this.deferredEvents;
      this.deferredEvents = [];
      e.forEach(e => {
        p = p.catch(() => {}).then(() => this.process(e.event, ...e.args));
      });
    }
    return p.catch(() => {});
  }

  process(name:string, ...args:any[]):Promise<any> {
    if (name) {
      let handler: EventHandler | undefined;
      if (this.state && this.states[this.state]) {
        switch(this.states[this.state][name]) {
          case 'defer':
            handler = this.defer(name);
            break;
          case 'noop':
            handler = () => {};
            break;
          case undefined:
            handler = this.states[this.state]['*'];
            break;
          default:
            handler = this.states[this.state][name] as EventHandler;
            break;
        }
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
      return p.then(() => this.flushDeferred());
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
