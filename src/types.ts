export interface EventHandler {
  (...args: any[]): any;
}

export interface Handlers {
  ['exit']?: EventHandler;
  ['entry']?: EventHandler;
  ['*']?: EventHandler | 'defer' | 'noop';
  [name: string]: EventHandler | 'defer' | 'noop' | string | undefined;
}

export type StateTable = { [name: string]: Handlers };
