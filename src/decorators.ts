import { deepExtend } from 'eredita';
import { EventHandler, StateTable } from './types';

const classStateTable = Symbol();

function getClassStateTable(target): StateTable {
  if (!target[classStateTable]) {
    target[classStateTable] = {};
  }
  return target[classStateTable];
}
function setEventHandler(state: string, event: string, target, handler: EventHandler | 'defer' | 'noop') {
  const table = getClassStateTable(target.constructor);
  if (!table[state]) {
    table[state] = {};
  }
  table[state][event] = handler;
}

export function fsm(initialState?: string) {
  return function<T extends { new (...args: any[]): any }>(originalConstructor: T) {
    return class extends originalConstructor {
      constructor(...args: any[]) {
        super(...args);
        this.states = deepExtend({}, this.states, getClassStateTable(originalConstructor));
        if (initialState && typeof this.state === 'undefined') {
          this.enter(initialState);
        }
      }
    };
  };
}
export function handle(state: string, event: string): (target, key: string) => void {
  return function(target, key: string) {
    setEventHandler(state, event, target, target[key]);
  };
}
export function entry(state: string): (target, key: string) => void {
  return handle(state, 'entry');
}
export function exit(state: string): (target, key: string) => void {
  return handle(state, 'exit');
}
export function defer(state: string, event: string): (target, key: string) => void {
  return function(target) {
    setEventHandler(state, event, target, 'defer');
  };
}
export function noop(state: string, event: string): (target, key: string) => void {
  return function(target) {
    setEventHandler(state, event, target, 'noop');
  };
}
