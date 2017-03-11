# fseh
A minimal Finite State Event Handler for JavaScript

[![travis build](https://img.shields.io/travis/0xfede/fseh.svg)](https://travis-ci.org/0xfede/fseh)
[![codecov coverage](https://img.shields.io/codecov/c/github/0xfede/fseh.svg)](https://codecov.io/gh/0xfede/fseh)
[![npm version](https://img.shields.io/npm/v/fseh.svg)](https://www.npmjs.com/package/fseh)

Have you ever had to handle an event differently depending on the state of your application? *fseh* lets you create
state-aware event handler that execute different code depending on the current state of your application.

It's basically an implementation of a Finite State Machine, optimized to be used where callbacks and event handlers are
expected.

## How to Install

```bash
npm install fseh
```

## Introductory example

Here's a quick Node.js/Expressjs example. Suppose you what your web application to automatically respond with a standard
error message when the application is not ready or down for maintenance: you could check for the current state in all
your routes:

```js
var express = require('express')
  , app = express()
  , ready = false;

app.get('/', function(req, res) {
  if (ready) {
    res.send("Thanks for GETting");
  } else {
    res.status(503).send("Sorry, I'm not ready yet...");
  }
});  
app.post('/', function(req, res) {
  if (ready) {
    res.send("Thanks for POSTing");
  } else {
    res.status(503).send("Sorry, I'm not ready yet...");
  }
});  
app.listen(8080);

// connect to a db and perform other init stuff...
// ... or just wait 5 seconds
setTimeout(function() {
  ready = true;
}, 5000);
```

A better approach would be to create a middleware to do the job:

```js
function checkIfReady(req, res, next) {
  if (ready) {
    next();
  } else {
    res.status(503).send("Sorry, I'm not ready yet...");
  }
}

app.get('/', checkIfReady, function(req, res) {
  res.send("Thanks for GETting");
});  
app.post('/', checkIfReady, function(req, res) {
  res.send("Thanks for POSTing");
});  
```

Things would get immediately more complicated if you'd like to handle different types of requests differently or if there's
a greater variety of states that just ready or not. fseh least you define a Finite State Machine (FSM) and event handlers
for each state.

```js
var Machine = require('fseh').Machine
  , express = require('express')
  , app = express()

var fsm = new Machine({
  "setup": {
    "request": function(req, res) {
      res.status(503).send("Sorry, I'm not ready yet...");
    },
    "setup-completed": function() {
      this.enter('ready');
    }
  },
  "ready": {
    "request": function(req, res, next) {
      next();
    }
  }
}, 'setup');

app.use(fsm.eventHandler('request'));

app.get('/', function(req, res) {
  res.send("Thanks for GETting");
});  
app.post('/', function(req, res) {
  res.send("Thanks for POSTing");
});  
app.listen(8080);

setTimeout(fsm.eventHandler('setup-completed'), 5000);
```

In the example above we've defined a state machine that supports two states, called `setup` and `ready`, and the handles
the `request` event differently depending on the state. In the example, the initial state is set up `setup` in the constructor
and the machine transits to the `ready` state after 5 seconds, when a timer expire triggering a `setup-completed` event.
We then create an event handler for the `request` event that it's simply used as a Expressjs middleware.

![Simple FSM](doc/fsm1.png "Simple Finite State Machine")

This is just a very simple scenario: fseh can be used to handle much more complex state machines, like, for instance,
a WebRTC negotiation, where several messages need to be exchanged between two or more parties and the receipt of a message
might need a radically different handling depending on the current negotiation state.

## Usage

Finite State Machines are created instantiating a `Machine` with a `StateTable`, that is a collection of states and the
corresponding events for each state.

```js
var Machine = require('fseh').Machine

var fsm = new Machine({
  "start": {
    "setup": () => {
      this.enter("ready");
    }
  },
  "ready": {
    "introduce": () => {
      return `Hi, I'm a state machine`;
    },
    "greet": name => {
      return `Hi ${name}!`;
    },
    "meet": name => {
      return `Nice to meet you, ${name}!`;
    }
  }
});
```

The example above, creates a FSM with two states: a `start` state, that can only handle a `setup` event, which will make
it transit into the `ready` state. The `ready` state supports three events (`introduce`, `greet` and `meet`), all of
which return strings.

There are three special event that can be defined in each state:
- `entry`, triggered when the FSM enters the state
- `exit`, triggered when the FSM is leaving a state
- `*`, default event handler, triggered when a specific event handler was not found. If a default handler is not defined
and an unknown event is received, an `Error('unhandled')` is returned.

There are also two special event handlers:
- `defer`, the event is queue and the machine will attempt to precess it as soon as another state is entered. Defererred
events are processed after the `entry` event, if defined.
- `noop`, the event is ignored, without throwing an error

```js
var Machine = require('fseh').Machine

var fsm = new Machine({
  "start": {
    "setup": () => {
      this.enter("ready");
    },
    "exit": () => {
      console.log('setup completed');
    },
    "introduce": "defer",
    "*": () => {
      return `Sorry, can't talk right now`;
    }
  },
  "ready": {
    "entry": () => {
      console.log('ready to talk');
    },
    "introduce": () => {
      return `Hi, I'm a state machine`;
    },
    "greet": name => {
      return `Hi ${name}!`;
    },
    "meet": name => {
      return `Nice to meet you, ${name}!`;
    }
  }
});
```

In the above example, the FSM will print to the console`setup completed` and `ready to talk` when transiting from `setup`
to `ready` and it'll return `Sorry, can't talk right now` is, for example, a `greet` event is received while in the
`setup` state. On the other hand, an `introduce` event received in the `start` state will be deferred, i.e. queued and processed
in the next state, which in turn could handle it, deferred it again, ignore it (`noop`) or throw an error.

The StateTable is defined in TypeScript as follows:

```ts
export type EventHandler = (...args: any[]) => any;

export interface Handlers {
  ['exit']?: EventHandler
  ['entry']?: EventHandler
  ['*']?: EventHandler | 'defer' | 'noop';
  [name:string]: EventHandler | 'defer' | 'noop' | undefined
}

export type StateTable = { [name:string]: Handlers };
```

### Machine(states:StateTable, initialState?:string)

Creates a new state machine with the definition passed as `states` and, optionally, transits it to the `intialState`.

### Machine.process(name:string, ...args:any[]):Promise<any>

Processes an event of type `name` in the current state: `args` are passed to the event handler, if any, and its return
value is wrapped into a Promise. If no handler is found and no default handler is defined, the promise is rejected
with `Error('unhandled)`.

### Machine.enter(state:string, ...args: any[]):Promise<any>

Transits the machine to the specified `state`: `args` are passed to the entry event handler if defined its return
value is wrapped into a Promise. If the state is unknown, the promise is rejected with `Error('unknown_state')`.

### Machine.eventHandler(name:string): (...args: any[]) => Promise<any>

Creates an event handler for the event `name`. An event handler is a function the can be passed as a callback to
any javascript function or methods and that will trigger the execution of the correct event handler, based on the
current state of the state machine. The return value of the actual event handler is wrapped in a promise, and so is any
exception that might be throw.

### Machine.callbackEventHandler(name:string): (...args: any[]) => void

Creates an event handler similar to the ones created by `Machine.eventHandler`, with the only exception that if the last
argument is a function, it treats it as a node-style callback `function(err, data)` and uses it to return the outcome
of the promise received by the event handler.
