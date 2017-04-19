export interface EventHandler {
  (...args: any[]): any;
}

export interface Handlers {
  ['exit']?: EventHandler;
  ['entry']?: EventHandler;
  ['*']?: EventHandler | 'defer' | 'noop';
  [name:string]: EventHandler | 'defer' | 'noop' | undefined;
}

export type StateTable = { [name:string]: Handlers };

export class Machine {
  state?:string;
  lastEvent?:string;
  ready:Promise<any> = Promise.resolve(true);
  protected deferredEvents: { event:string, args:any[] }[] = [];

  constructor(public states:StateTable = {}, initialState?:string) {
    if (initialState) {
      this.enter(initialState);
    }
  }

  protected defer(event:string): EventHandler {
    return (...args:any[]) => {
      this.deferredEvents.push({ event, args });
    }
  }
  protected async flushDeferred(): Promise<any> {
    if (this.deferredEvents.length) {
      let e = this.deferredEvents;
      this.deferredEvents = [];
      for (let i = 0 ; i < e.length ; i++) {
        try {
          await this.innerProcess(e[i].event, ...e[i].args);
        } catch(err) {}
      }
    }
  }

  protected async innerProcess(name:string, ...args:any[]):Promise<any> {
    if (name) {
      let handler: EventHandler | undefined;
      if (this.state && this.states[this.state]) {
        let tmp = this.states[this.state][name] || this.states[this.state]['*'];
        switch(tmp) {
          case 'defer':
            handler = this.defer(name);
            break;
          case 'noop':
            handler = () => {};
            break;
          default:
            handler = tmp as EventHandler;
            break;
        }
      }
      if (handler) {
        this.lastEvent = name;
        return handler.apply(this, args);
      } else {
        throw new Error('unhandled');
      }
    } else {
      throw new Error('bad_event');
    }
  }

  async process(name:string, ...args:any[]):Promise<any> {
    await this.ready;
    return this.innerProcess(name, ...args);
  }

  async enter(state:string, ...args: any[]):Promise<any> {
    if (!state) {
      throw new Error('invalid_state');
    }
    let ret = this.ready.then(async () => {
      let oldState = this.state ? this.states[this.state] : undefined;
      let newState = this.states[state];
      if (this.state !== state) {
        if (!newState) {
          throw new Error('unknown_state');
        } else {
          if (oldState && oldState.exit) {
            await oldState.exit.apply(this, args);
          }

          this.state = state;
          if (newState.entry) {
            await newState.entry.apply(this, args);
          }
          await this.flushDeferred();
          return true;
        }
      } else {
        return true;
      }
    });
    this.ready = ret.catch(() => {});
    return ret;
  }

  eventHandler(name:string): (...args: any[]) => Promise<any>;
  eventHandler(stateHandlers:Handlers): (...args: any[]) => Promise<any>;
  eventHandler(nameOrStateHandlers:any): (...args: any[]) => Promise<any> {
    return async (...args: any[]) => {
      if (typeof(nameOrStateHandlers) === 'string') {
        return this.process(nameOrStateHandlers as string, ...args);
      } else {
        await this.ready;
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
