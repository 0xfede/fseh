import { EventEmitter } from 'events';
import { EventHandler, Handlers, StateTable } from './types';

export class Machine extends EventEmitter {
  state?: string;
  lastEvent?: string;
  ready: Promise<any> = Promise.resolve(true);
  protected deferredEvents: { event: string; args: any[]; resolve: (value?: any) => void }[] = [];

  constructor(public states: StateTable = {}, initialState?: string) {
    super();
    if (initialState) {
      this.enter(initialState);
    }
  }

  protected defer(event: string): EventHandler {
    return (...args: any[]) => {
      return new Promise(resolve => {
        this.deferredEvents.push({ event, args, resolve });
      });
    };
  }
  protected async flushDeferred(): Promise<any> {
    if (this.deferredEvents.length) {
      let e = this.deferredEvents;
      this.deferredEvents = [];
      for (let i = 0; i < e.length; i++) {
        try {
          let result = this.innerProcess(e[i].event, ...e[i].args);
          e[i].resolve(result);
        } catch (err) {}
      }
    }
  }

  protected async innerProcess(name: string, ...args: any[]): Promise<any> {
    if (name) {
      let handler: EventHandler | undefined;
      if (this.state && this.states[this.state]) {
        let tmp = this.states[this.state][name] || this.states[this.state]['*'];
        switch (tmp) {
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

  async process(name: string, ...args: any[]): Promise<any> {
    await this.ready;
    return this.innerProcess(name, ...args);
  }

  protected processStateEventHandler(s: Handlers | undefined, e: 'entry' | 'exit', args: any[]): Promise<any> {
    return Promise.resolve(s && s[e] ? (s[e] as EventHandler).apply(this, args) : true);
  }

  enter(state: string, ...args: any[]): Promise<any> {
    if (!state) {
      return Promise.reject(new Error('invalid_state'));
    }
    let oldState = this.state ? this.states[this.state] : undefined;
    let newState = this.states[state];
    if (this.state !== state) {
      if (!newState) {
        return Promise.reject(new Error('unknown_state'));
      } else {
        if (this.state) {
          this.emit(`${this.state}:exit`, state, ...args);
          this.emit('exit', this.state, state, ...args);
        }
        this.emit(`${state}:pre-entry`, ...args);
        this.emit('pre-entry', state, ...args);
        let unlockReady;
        this.ready = new Promise(resolve => {
          unlockReady = resolve;
        });
        this.state = state;
        return (async () => {
          try {
            await this.processStateEventHandler(oldState, 'exit', args);
            await this.processStateEventHandler(newState, 'entry', args);
            await this.flushDeferred();
            unlockReady && unlockReady();
            this.emit(`${state}:entry`, ...args);
            this.emit('entry', state, ...args);
            this.emit(state, ...args);
            return true;
          } catch (err) {
            unlockReady && unlockReady();
            throw err;
          }
        })();
      }
    } else {
      return Promise.resolve(true);
    }
  }

  eventHandler(name: string): (...args: any[]) => Promise<any>;
  eventHandler(stateHandlers: Handlers): (...args: any[]) => Promise<any>;
  eventHandler(nameOrStateHandlers: any): (...args: any[]) => Promise<any> {
    return async (...args: any[]) => {
      if (typeof nameOrStateHandlers === 'string') {
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
    };
  }

  callbackEventHandler(name: string): (...args: any[]) => void;
  callbackEventHandler(stateHandlers: Handlers): (...args: any[]) => void;
  callbackEventHandler(nameOrStateHandlers: any): (...args: any[]) => void {
    let h = this.eventHandler(nameOrStateHandlers);
    return (...args: any[]) => {
      if (args.length && typeof args[args.length - 1] === 'function') {
        let cb = args.pop();
        h(args).then(
          (...args: any[]) => {
            cb(null, ...args);
          },
          err => {
            cb(err);
          }
        );
      } else {
        h(...args);
      }
    };
  }
}