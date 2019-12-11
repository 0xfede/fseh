export class InvalidEventError extends Error {
  public args: any[];

  constructor(public event: any, public state: string = 'unknown', public deferred: boolean = false, ...args: any[]) {
    super(`Invalid ${deferred ? 'deferred ' : ''}event "${event}" in state "${state}"`);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidEventError);
    }
    this.args = args;
  }
}

export class UnhandledEventError extends Error {
  public args: any[];

  constructor(public event: string, public state: string = 'unknown', public deferred: boolean = false, ...args: any[]) {
    super(`Unhandled ${deferred ? 'deferred ' : ''}event "${event}" in state "${state}"`);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnhandledEventError);
    }
    this.args = args;
  }
}

export class InvalidStateError extends Error {
  public args: any[];

  constructor(public state: any, ...args: any[]) {
    super(`Invalid state "${state}"`);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidStateError);
    }
    this.args = args;
  }
}

export class UnknownStateError extends Error {
  public args: any[];

  constructor(public state: string, ...args: any[]) {
    super(`Unknown state "${state}"`);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidStateError);
    }
    this.args = args;
  }
}
